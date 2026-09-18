package expo.modules.icomonscale

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import cn.icomon.icdevicemanager.ICDeviceManager
import cn.icomon.icdevicemanager.ICDeviceManagerDelegate
import cn.icomon.icdevicemanager.callback.ICScanDeviceDelegate
import cn.icomon.icdevicemanager.model.data.ICCoordData
import cn.icomon.icdevicemanager.model.data.ICFoodInfo
import cn.icomon.icdevicemanager.model.data.ICKitchenScaleData
import cn.icomon.icdevicemanager.model.data.ICRulerData
import cn.icomon.icdevicemanager.model.data.ICSkipData
import cn.icomon.icdevicemanager.model.data.ICWeightCenterData
import cn.icomon.icdevicemanager.model.data.ICWeightData
import cn.icomon.icdevicemanager.model.data.ICWeightHistoryData
import cn.icomon.icdevicemanager.model.device.ICDevice
import cn.icomon.icdevicemanager.model.device.ICDeviceInfo
import cn.icomon.icdevicemanager.model.device.ICScanDeviceInfo
import cn.icomon.icdevicemanager.model.device.ICUserInfo
import cn.icomon.icdevicemanager.model.other.ICConstant
import cn.icomon.icdevicemanager.model.other.ICDeviceManagerConfig
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Bridges the ICOMON / Welland ICDeviceManager BLE SDK (weight + BMI +
 * body-composition scales) to JS.
 *
 * Flow: start() -> lazily init the (process-wide) ICDeviceManager singleton ->
 * scanDevice() -> first weight/fat-scale device found is stopScan()'d and
 * addDevice()'d, which both registers and connects it -> weight readings
 * stream in via onReceiveWeightData -> once isStabilized, emit a "final"
 * event (plain weight/BMI) or a richer "bodyfat" event when the connected
 * scale also measured impedance. Every event goes through "onScaleEvent".
 */
class IcomonScaleModule : Module() {

  private companion object {
    const val TAG = "IcomonScale"
    const val EVENT = "onScaleEvent"

    // ICDeviceManager.shared() is a process-wide singleton that outlives the
    // React/JS bridge — a Metro reload (or any bridge teardown) destroys this
    // Module instance and creates a fresh one, but the singleton keeps
    // retrying whatever device the *previous* instance called addDevice() on.
    // Track that MAC/device here (companion = one copy per process, not per
    // instance) so a new instance can still find and remove it.
    private var lastKnownDevice: ICDevice? = null
  }

  private val mainHandler = Handler(Looper.getMainLooper())

  private var sessionActive = false
  private var connecting = false
  private var finished = false
  private var scanTimeoutRunnable: Runnable? = null

  private var lastWeightKg = 0.0
  private var lastWeightLbs = 0.0
  private var lastHeartRate = 0

  private var userSex = 1 // 1 = male, 0 = female
  private var userAge = 30
  private var userHeightCm = 170

  // 0 = not started, 1 = in progress, 2 = done-ok, 3 = done-fail
  private var initState = 0
  private val initWaiters = mutableListOf<(Boolean) -> Unit>()

  private fun emit(vararg pairs: Pair<String, Any?>) {
    try {
      sendEvent(EVENT, mapOf(*pairs))
    } catch (_: Throwable) {
    }
  }

  private fun cancelScanTimeout() {
    scanTimeoutRunnable?.let { mainHandler.removeCallbacks(it) }
    scanTimeoutRunnable = null
  }

  // On Android 12+ (API 31), connecting/scanning via the vendor BLE stack
  // requires BLUETOOTH_CONNECT / BLUETOOTH_SCAN at runtime, same as the JS
  // ble-plx scan path. Unlike that path, the ICDeviceManager SDK calls below
  // (addDevice/scanDevice) are not wrapped by Expo's own permission gate, and
  // this module can be driven by the always-on device monitor before the user
  // ever opens the Add Device screen (the only place that currently requests
  // these permissions) — so check explicitly instead of letting a missing
  // grant surface as an uncaught SecurityException from the native SDK.
  private fun hasBlePermissions(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
    val connect = context.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)
    val scan = context.checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN)
    return connect == PackageManager.PERMISSION_GRANTED && scan == PackageManager.PERMISSION_GRANTED
  }

  // Shared by onReceiveWeightData (plain weight/BMI scales) and
  // onReceiveMeasureStepData's ICMeasureStepMeasureWeightData/MeasureOver
  // cases (8-electrode/impedance scales, which report through the step
  // callback instead) — see onReceiveMeasureStepData below.
  private fun handleWeightData(data: ICWeightData) {
    Log.d(
      TAG,
      "handleWeightData: sessionActive=$sessionActive finished=$finished kg=${data.getWeight_kg()} " +
        "stabilized=${data.isStabilized()} imp=${data.getImp()}",
    )
    if (!sessionActive) return
    val kg = data.getWeight_kg()
    val lbs = data.getWeight_lb()

    if (!data.isStabilized()) {
      // A fresh unstabilized reading means a new measurement cycle has begun.
      // The native connection can stay open across many consecutive
      // weigh-ins/retakes without start() ever being called again (unlike the
      // session-per-measurement flow this was originally written for), so the
      // "already emitted" latch below must be cleared here or every retake
      // after the first completed measurement gets silently dropped.
      finished = false
      emit("type" to "weight", "weightKg" to kg, "weightLbs" to lbs, "stable" to false)
      return
    }

    if (finished) return // this cycle's completion was already emitted

    if (kg > 0.0) {
      lastWeightKg = kg
      lastWeightLbs = lbs
    }
    if (data.isSupportHR() && data.getHr() > 0) lastHeartRate = data.getHr()
    finished = true

    if (data.getImp() != 0.0) {
      emit(
        "type" to "bodyfat",
        "weightKg" to lastWeightKg,
        "weightLbs" to lastWeightLbs,
        "bmi" to data.getBmi(),
        "bodyFatPct" to data.getBodyFatPercent(),
        "musclePct" to data.getMusclePercent(),
        "waterPct" to data.getMoisturePercent(),
        "proteinPct" to data.getProteinPercent(),
        "visceralFat" to data.getVisceralFat(),
        "bmr" to data.getBmr(),
        "bodyAge" to data.getPhysicalAge(),
        "heartRate" to lastHeartRate,
      )
    } else {
      emit("type" to "final", "weightKg" to lastWeightKg, "weightLbs" to lastWeightLbs, "bmi" to data.getBmi())
    }
  }

  private fun applyUserInfo() {
    val info = ICUserInfo()
    info.setAge(userAge)
    info.setHeight(userHeightCm)
    info.setSex(if (userSex == 1) ICConstant.ICSexType.ICSexTypeMale else ICConstant.ICSexType.ICSexTypeFemal)
    info.setPeopleType(ICConstant.ICPeopleType.ICPeopleTypeNormal)
    ICDeviceManager.shared().updateUserInfo(info)
  }

  // The manager is a process-wide singleton — init it once (lazily, on first
  // start()/initialize() call) and fan the result out to every waiter.
  private fun ensureInit(context: Context, cb: (Boolean) -> Unit) {
    if (initState == 2) {
      cb(true)
      return
    }
    initWaiters.add(cb)
    if (initState == 1) return
    initState = 1
    ICDeviceManager.shared().setDelegate(delegate)
    applyUserInfo()
    val config = ICDeviceManagerConfig()
    config.setContext(context.applicationContext)
    ICDeviceManager.shared().initMgrWithConfig(config)
  }

  // Remove whatever device is currently registered with the singleton (from
  // this instance or a prior, now-destroyed one — e.g. a Metro JS reload),
  // then invoke `cb`. Waits for the SDK's removeDevice callback before
  // proceeding: calling addDevice() again for the same MAC before the
  // removal actually lands races the singleton's internal state and can
  // leave it silently stuck (no further connected/error/weight events ever
  // fire) — this is what caused ICOMON to go dead after a plain JS reload.
  // A watchdog guards against the callback never arriving.
  private fun removeKnownDevice(cb: () -> Unit) {
    val dev = lastKnownDevice
    if (dev == null) {
      cb()
      return
    }
    lastKnownDevice = null
    var done = false
    val proceed = {
      if (!done) {
        done = true
        cb()
      }
    }
    val watchdog = Runnable {
      Log.d(TAG, "removeDevice callback timed out for mac=${dev.getMacAddr()}, proceeding anyway")
      proceed()
    }
    try {
      Log.d(TAG, "removing previously-registered device mac=${dev.getMacAddr()}")
      mainHandler.postDelayed(watchdog, 2000)
      ICDeviceManager.shared().removeDevice(dev, object : ICConstant.ICRemoveDeviceCallBack {
        override fun onCallBack(device: ICDevice?, code: ICConstant.ICRemoveDeviceCallBackCode?) {
          Log.d(TAG, "removeDevice callback: mac=${device?.getMacAddr()} code=$code")
          mainHandler.removeCallbacks(watchdog)
          proceed()
        }
      })
    } catch (_: Throwable) {
      mainHandler.removeCallbacks(watchdog)
      proceed()
    }
  }

  private fun connectTo(mac: String) {
    try {
      val device = ICDevice()
      device.setMacAddr(mac)
      lastKnownDevice = device
      ICDeviceManager.shared().addDevice(device, object : ICConstant.ICAddDeviceCallBack {
        override fun onCallBack(device: ICDevice?, code: ICConstant.ICAddDeviceCallBackCode?) {
          Log.d(TAG, "addDevice callback: mac=${device?.getMacAddr()} code=$code")
          if (!sessionActive) return
          if (code != ICConstant.ICAddDeviceCallBackCode.ICAddDeviceCallBackCodeSuccess) {
            connecting = false
            emit("type" to "error", "message" to "Could not connect to the scale ($code). Please try again.")
          }
        }
      })
    } catch (e: SecurityException) {
      // Permission revoked between the start()-time check and now (e.g. user
      // pulled Bluetooth permission from Settings mid-session) — fail the
      // connect gracefully instead of crashing the app.
      Log.d(TAG, "connectTo: SecurityException, mac=$mac", e)
      connecting = false
      emit("type" to "error", "message" to "Bluetooth permission is required to connect to the scale.")
    }
  }

  private val scanDelegate = object : ICScanDeviceDelegate {
    override fun onScanResult(deviceInfo: ICScanDeviceInfo?) {
      Log.d(
        TAG,
        "onScanResult: name=${deviceInfo?.getName()} mac=${deviceInfo?.getMacAddr()} " +
          "type=${deviceInfo?.getType()} subType=${deviceInfo?.getSubType()} rssi=${deviceInfo?.getRssi()} " +
          "sessionActive=$sessionActive connecting=$connecting",
      )
      if (!sessionActive || connecting || deviceInfo == null) return
      val mac = deviceInfo.getMacAddr() ?: return
      val type = deviceInfo.getType()
      emit("type" to "scanFound", "name" to deviceInfo.getName(), "mac" to mac, "deviceType" to type?.toString())

      val isScale = type == ICConstant.ICDeviceType.ICDeviceTypeWeightScale ||
        type == ICConstant.ICDeviceType.ICDeviceTypeFatScale ||
        type == ICConstant.ICDeviceType.ICDeviceTypeFatScaleWithTemperature
      if (!isScale) {
        Log.d(TAG, "onScanResult: ignoring $mac, type=$type is not a scale type")
        return
      }

      connecting = true
      cancelScanTimeout()
      ICDeviceManager.shared().stopScan()
      emit("type" to "connecting", "name" to deviceInfo.getName(), "mac" to mac)
      connectTo(mac)
    }
  }

  private val delegate = object : ICDeviceManagerDelegate {
    override fun onInitFinish(bSuccess: Boolean) {
      Log.d(TAG, "onInitFinish: $bSuccess")
      initState = if (bSuccess) 2 else 3
      val waiters = initWaiters.toList()
      initWaiters.clear()
      waiters.forEach { it(bSuccess) }
    }

    override fun onBleState(state: ICConstant.ICBleState?) {
      Log.d(TAG, "onBleState: $state")
    }

    override fun onDeviceConnectionChanged(device: ICDevice?, state: ICConstant.ICDeviceConnectState?) {
      Log.d(TAG, "onDeviceConnectionChanged: mac=${device?.getMacAddr()} state=$state sessionActive=$sessionActive")
      if (!sessionActive) return
      when (state) {
        ICConstant.ICDeviceConnectState.ICDeviceConnectStateConnected -> {
          connecting = false
          emit("type" to "connected", "mac" to device?.getMacAddr())
        }
        ICConstant.ICDeviceConnectState.ICDeviceConnectStateDisconnected -> {
          connecting = false
          if (!finished) emit("type" to "disconnected")
        }
        else -> {}
      }
    }

    override fun onNodeConnectionChanged(device: ICDevice?, nodeId: Int, state: ICConstant.ICDeviceConnectState?) {}

    override fun onReceiveWeightData(device: ICDevice?, data: ICWeightData?) {
      if (data != null) handleWeightData(data)
    }

    override fun onReceiveKitchenScaleData(device: ICDevice?, data: ICKitchenScaleData?) {}
    override fun onReceiveKitchenScaleHistoryData(device: ICDevice?, list: MutableList<ICKitchenScaleData>?) {}
    override fun onReceiveKitchenScaleUnitChanged(device: ICDevice?, unit: ICConstant.ICKitchenScaleUnit?) {}
    override fun onReceiveKitchenScaleCommonFoods(device: ICDevice?, list: MutableList<ICFoodInfo>?) {}
    override fun onReceiveCoordData(device: ICDevice?, data: ICCoordData?) {}
    override fun onReceiveRulerData(device: ICDevice?, data: ICRulerData?) {}
    override fun onReceiveRulerHistoryData(device: ICDevice?, data: ICRulerData?) {}
    override fun onReceiveWeightCenterData(device: ICDevice?, data: ICWeightCenterData?) {}
    override fun onReceiveWeightUnitChanged(device: ICDevice?, unit: ICConstant.ICWeightUnit?) {}
    override fun onReceiveRulerUnitChanged(device: ICDevice?, unit: ICConstant.ICRulerUnit?) {}
    override fun onReceiveRulerMeasureModeChanged(device: ICDevice?, mode: ICConstant.ICRulerMeasureMode?) {}

    override fun onReceiveMeasureStepData(device: ICDevice?, step: ICConstant.ICMeasureStep?, data2: Any?) {
      // 8-electrode/impedance scales (confirmed via logcat against the vendor's
      // own FitdaysPro app: this device reports ICMeasureStepMeasureWeightData ->
      // ICMeasureStepAdcStart -> ICMeasureStepMeasureOver here instead of ever
      // calling onReceiveWeightData directly) — mirrors the reference SDK demo's
      // switch in MainActivity.onReceiveMeasureStepData.
      Log.d(TAG, "onReceiveMeasureStepData: step=$step sessionActive=$sessionActive")
      when (step) {
        ICConstant.ICMeasureStep.ICMeasureStepMeasureWeightData -> {
          (data2 as? ICWeightData)?.let { handleWeightData(it) }
        }
        ICConstant.ICMeasureStep.ICMeasureStepMeasureOver -> {
          (data2 as? ICWeightData)?.let {
            it.setStabilized(true)
            handleWeightData(it)
          }
        }
        else -> {}
      }
    }

    override fun onReceiveWeightHistoryData(device: ICDevice?, data: ICWeightHistoryData?) {}
    override fun onReceiveSkipData(device: ICDevice?, data: ICSkipData?) {}
    override fun onReceiveHistorySkipData(device: ICDevice?, data: ICSkipData?) {}
    override fun onReceiveBattery(device: ICDevice?, battery: Int, ext: Any?) {}
    override fun onReceiveUpgradePercent(device: ICDevice?, status: ICConstant.ICUpgradeStatus?, percent: Int) {}
    override fun onReceiveDeviceInfo(device: ICDevice?, info: ICDeviceInfo?) {}
    override fun onReceiveDebugData(device: ICDevice?, i: Int, o: Any?) {}
    override fun onReceiveConfigWifiResult(device: ICDevice?, type: ICConstant.ICConfigWifiResultType?, o: Any?) {}

    override fun onReceiveHR(device: ICDevice?, hr: Int) {
      if (!sessionActive || hr <= 0) return
      lastHeartRate = hr
      emit("type" to "heartRate", "heartRate" to hr)
    }

    override fun onReceiveUserInfo(device: ICDevice?, userInfo: ICUserInfo?) {}
    override fun onReceiveUserInfoList(device: ICDevice?, list: MutableList<ICUserInfo>?) {}
    override fun onReceiveRSSI(device: ICDevice?, rssi: Int) {}
    override fun onReceiveDeviceLightSetting(device: ICDevice?, o: Any?) {}
    override fun onReceiveScanWifiInfo_W(device: ICDevice?, s: String?, i1: Int?, i2: Int?) {}
    override fun onReceiveCurrentWifiInfo_W(device: ICDevice?, i1: Int?, s1: String?, s2: String?, i2: Int?) {}
    override fun onReceiveBindState_W(device: ICDevice?, i: Int?) {}
    override fun onReceiveCurrentPage(device: ICDevice?, i: Int?) {}
  }

  override fun definition() = ModuleDefinition {
    Name("IcomonScale")

    Events(EVENT)

    AsyncFunction("setUserInfo") { sex: Int, age: Int, heightCm: Int ->
      userSex = sex
      userAge = age
      userHeightCm = heightCm
      if (initState == 2) applyUserInfo()
    }

    // Bind + init the ICDeviceManager singleton. JS calls this on screen mount
    // so the service is ready by the time the user taps Connect.
    AsyncFunction("initialize") { promise: Promise ->
      val context = appContext.reactContext?.applicationContext
      if (context == null) {
        promise.reject("E_NO_CONTEXT", "Android context unavailable", null)
        return@AsyncFunction
      }
      mainHandler.post {
        ensureInit(context) { success ->
          if (success) promise.resolve(true)
          else promise.reject("E_INIT_FAILED", "The scale service failed to start", null)
        }
      }
    }

    // Start a session. If `mac` is a real address, connect straight to it;
    // otherwise scan and auto-connect to the first weight/BMI/fat scale found.
    AsyncFunction("start") { mac: String?, scanTimeoutMs: Double, promise: Promise ->
      val context = appContext.reactContext?.applicationContext
      if (context == null) {
        promise.reject("E_NO_CONTEXT", "Android context unavailable", null)
        return@AsyncFunction
      }
      if (!hasBlePermissions(context)) {
        Log.d(TAG, "start(): missing BLUETOOTH_CONNECT/BLUETOOTH_SCAN — refusing to touch the native SDK")
        emit("type" to "error", "message" to "Bluetooth permission is required to connect to the scale.")
        promise.resolve(null)
        return@AsyncFunction
      }
      sessionActive = true
      connecting = false
      finished = false
      lastWeightKg = 0.0
      lastWeightLbs = 0.0
      lastHeartRate = 0

      val begin = Runnable {
        if (!sessionActive) {
          promise.resolve(null)
          return@Runnable
        }
        // Clear out anything left registered by a previous, now-destroyed
        // instance (e.g. a Metro reload mid-session) before starting fresh —
        // otherwise the singleton keeps retrying it forever in the background.
        // Wait for the removal to actually land before re-registering (see
        // removeKnownDevice's doc comment) instead of racing it.
        removeKnownDevice {
          if (!sessionActive) return@removeKnownDevice
          if (!mac.isNullOrEmpty()) {
            emit("type" to "connecting", "mac" to mac)
            connecting = true
            connectTo(mac)
          } else {
            Log.d(TAG, "start(): calling scanDevice(), timeout=${scanTimeoutMs}ms")
            emit("type" to "scanning")
            try {
              ICDeviceManager.shared().scanDevice(scanDelegate)
            } catch (e: SecurityException) {
              Log.d(TAG, "start(): SecurityException from scanDevice()", e)
              emit("type" to "error", "message" to "Bluetooth permission is required to connect to the scale.")
              return@removeKnownDevice
            }
            val timeout = Runnable {
              Log.d(TAG, "scan timeout fired: sessionActive=$sessionActive connecting=$connecting")
              if (sessionActive && !connecting) {
                ICDeviceManager.shared().stopScan()
                emit(
                  "type" to "error",
                  "message" to "No BMI scale found nearby. Step on the scale to wake it up, then try again.",
                )
              }
            }
            scanTimeoutRunnable = timeout
            mainHandler.postDelayed(timeout, scanTimeoutMs.toLong())
          }
        }
        promise.resolve(null)
      }

      mainHandler.post {
        ensureInit(context) { success ->
          if (success) begin.run()
          else {
            emit("type" to "error", "message" to "The scale service failed to start. Restart the app and try again.")
            promise.resolve(null)
          }
        }
      }
    }

    AsyncFunction("stop") { promise: Promise ->
      sessionActive = false
      connecting = false
      cancelScanTimeout()
      mainHandler.post {
        try {
          if (initState == 2) {
            ICDeviceManager.shared().stopScan()
            removeKnownDevice {}
          }
        } catch (_: Throwable) {
        }
      }
      promise.resolve(null)
    }
  }
}
