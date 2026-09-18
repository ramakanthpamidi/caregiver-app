package expo.modules.ailinkscale

import android.os.Handler
import android.os.Looper
import android.util.Log
import cn.net.aicare.modulelibrary.module.EightBodyfatscale.EightBodyFatMcuDeviceData
import cn.net.aicare.modulelibrary.module.EightBodyfatscale.EightBodyFatUtil
import com.pingwang.bluetoothlib.AILinkBleManager
import com.pingwang.bluetoothlib.AILinkSDK
import com.pingwang.bluetoothlib.bean.BleValueBean
import com.pingwang.bluetoothlib.bean.SupportUnitBean
import com.pingwang.bluetoothlib.config.BleConfig
import com.pingwang.bluetoothlib.listener.OnCallbackBle
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Bridges the AILink 8-electrode body fat scale to JS.
 *
 * Flow: start() -> scan (AILink service UUID) -> first device whose CID is the
 * eight-electrode scale is auto-connected -> weight / impedance / heart-rate
 * callbacks stream in -> on MEASUREMENT_END the vendor body-composition
 * algorithm runs with the user profile -> a single "bodyfat" event carries the
 * full result. Every event goes through the "onScaleEvent" emitter.
 */
class AilinkScaleModule : Module() {

  private companion object {
    const val TAG = "AilinkScale"
    const val EVENT = "onScaleEvent"
    const val LB_TO_KG = 0.45359237f
  }

  private var sessionActive = false
  private var connecting = false
  private var deviceData: EightBodyFatMcuDeviceData? = null
  private var lastWeightKg = 0.0
  private var lastHeartRate = 0
  private var finished = false

  private var userSex = 1 // 1 = male, 0 = female
  private var userAge = 30
  private var userHeightCm = 170

  private fun emit(vararg pairs: Pair<String, Any?>) {
    try {
      sendEvent(EVENT, mapOf(*pairs))
    } catch (_: Throwable) {
    }
  }

  private fun toKg(value: Double, unit: Int): Double = when (unit) {
    EightBodyFatUtil.JIN -> value / 2.0
    EightBodyFatUtil.LB, EightBodyFatUtil.ST -> value * LB_TO_KG
    else -> value // KG (0) and anything else treated as kg
  }

  private fun rawToKg(raw: Int, unit: Int, decimal: Int): Double {
    val value = raw / Math.pow(10.0, decimal.toDouble())
    return toKg(value, unit)
  }

  // This scale computes body composition onboard (MCU algorithm) and pushes the
  // finished values after the app answers its sync-user-info request. We reply
  // with setUserInfo, stream weight, and emit the full result on onTestSuccess.
  private val fatCallback = object : EightBodyFatMcuDeviceData.onEightBodyFatMcuCallback {
    override fun onState(type: Int, state: Int) {}

    override fun onSyncUserInfo() {
      // The scale blocks on this until it gets a profile. userId=1, userType=0
      // (normal) mirror the vendor demo defaults.
      deviceData?.setUserInfo(1, 0, userSex, userAge, userHeightCm)
      if (sessionActive) emit("type" to "note", "message" to "Measuring body composition — stand still…")
    }

    override fun onWeight(status: Int, weight: Int, unit: Int, decimal: Int) {
      if (!sessionActive) return
      val kg = rawToKg(weight, unit, decimal)
      val stable = status == EightBodyFatUtil.WEIGHT_STABILIZATION_WEIGHT
      if (stable && kg > 0.0) lastWeightKg = kg
      emit("type" to "weight", "weightKg" to kg, "stable" to stable)
    }

    override fun onHeight(status: Int, height: Int, unit: Int) {}

    override fun onImpedance(status: Int, adc: EightBodyFatMcuDeviceData.EightBodyFatAdc?, part: Int) {}

    override fun onHeartRate(status: Int, heartRate: Int) {
      if (heartRate > 0) lastHeartRate = heartRate
      if (sessionActive && heartRate > 0) emit("type" to "heartRate", "heartRate" to heartRate)
    }

    override fun onTemp(sign: Int, temp: Int, unit: Int, decimal: Int) {}
    override fun onVersion(version: String?) {}
    override fun onCompletionData() {}
    override fun onSupportUnit(list: MutableList<SupportUnitBean>?) {}
    override fun onErrCode(code: Int) {
      Log.e(TAG, "onErrCode $code")
      if (sessionActive) emit("type" to "error", "message" to "The scale reported error code $code")
    }

    override fun showData(data: String?) {}

    override fun onBodyFatData(step: Int, info: EightBodyFatMcuDeviceData.EightBodyFatInfo?) {
      // Progress during onboard computation; final values arrive in onTestSuccess.
    }

    override fun onTestSuccess(info: EightBodyFatMcuDeviceData.EightBodyFatInfo?) {
      if (!sessionActive || finished) return
      if (info == null) {
        emitWeightOnly()
        return
      }
      finished = true
      val kg = if (info.weight > 0) rawToKg(info.weight, info.weightUnit, info.weightDecimal) else lastWeightKg
      val hr = if (info.heartRate > 0) info.heartRate else lastHeartRate
      emit(
        "type" to "bodyfat",
        "weightKg" to kg,
        "bmi" to info.bmi,
        "bodyFatPct" to info.bfr,
        "subcutaneousFatPct" to info.sfr,
        "visceralFat" to info.uvi,
        "musclePct" to info.rom,
        "bmr" to info.bmr,
        "boneMassKg" to info.bm,
        "waterPct" to info.vwc,
        "bodyAge" to info.bodyAge,
        "proteinPct" to info.pp,
        "heartRate" to hr,
      )
    }
  }

  private fun emitWeightOnly() {
    if (finished) return
    finished = true
    emit(
      "type" to "measureEnd",
      "weightKg" to lastWeightKg,
      "heartRate" to lastHeartRate,
    )
  }

  private val bleCallback = object : OnCallbackBle {
    override fun onScanning(bean: BleValueBean?) {
      if (!sessionActive || connecting || bean == null) return
      // BleValueBean has both a getCid() method and a public `cid` byte[] field,
      // so Kotlin property syntax is ambiguous — call the getters explicitly.
      val cid = bean.getCid()
      val name = bean.getName() ?: ""
      val mac = bean.getMac()

      // Surface every AILink device we see so the CID of the actual scale is
      // visible in-app during bring-up.
      emit("type" to "scanFound", "name" to name, "cid" to cid, "mac" to mac)

      // The scan is already filtered to AILink devices by service UUID, so any
      // hit is an AILink device. In this deployment the body fat scale is the
      // only AILink device present, so connect to the first one found — pass the
      // scanned bean so the SDK carries its CID/VID/PID into the connection.
      connecting = true
      emit("type" to "connecting", "name" to name, "mac" to mac, "cid" to cid)
      val manager = AILinkBleManager.getInstance()
      manager.stopScan()
      manager.connectDevice(bean)
    }

    override fun onScanTimeOut() {
      if (!sessionActive || connecting) return
      emit(
        "type" to "error",
        "message" to "No body fat scale found nearby. Step on the scale to wake it up, then try again.",
      )
    }

    override fun onServicesDiscovered(mac: String?) {
      if (!sessionActive || mac == null) return
      val bleDevice = AILinkBleManager.getInstance().getBleDevice(mac)
      if (bleDevice == null) {
        emit("type" to "error", "message" to "Connected, but the device handle was unavailable. Please try again.")
        return
      }
      deviceData = EightBodyFatMcuDeviceData(bleDevice).also {
        it.setEightBodyFatCallback(fatCallback)
      }
      emit("type" to "connected", "mac" to mac)
    }

    override fun onDisConnected(mac: String?, code: Int) {
      if (!sessionActive) return
      connecting = false
      deviceData = null
      emit("type" to "disconnected", "code" to code)
    }
  }

  override fun definition() = ModuleDefinition {
    Name("AilinkScale")

    Events(EVENT)

    AsyncFunction("setUserInfo") { sex: Int, age: Int, heightCm: Int ->
      userSex = sex
      userAge = age
      userHeightCm = heightCm
    }

    // Bind the AILink ELinkBleServer service. The bind is asynchronous, so this
    // must complete (onInitSuccess) before scanning/connecting — doing both in
    // one call races and throws "please call init()". JS calls this on screen
    // mount so the service is ready by the time the user taps Connect.
    AsyncFunction("initialize") { promise: Promise ->
      val context = appContext.reactContext?.applicationContext
      if (context == null) {
        promise.reject("E_NO_CONTEXT", "Android context unavailable", null)
        return@AsyncFunction
      }
      try { AILinkSDK.getInstance().init(context) } catch (_: Throwable) {}
      val manager = AILinkBleManager.getInstance()
      if (manager.isInitOk) {
        emit("type" to "note", "message" to "Bluetooth service ready")
        promise.resolve(true)
        return@AsyncFunction
      }
      Handler(Looper.getMainLooper()).post {
        manager.init(context, object : AILinkBleManager.onInitListener {
          override fun onInitSuccess() {
            emit("type" to "note", "message" to "Bluetooth service ready")
            promise.resolve(true)
          }
          override fun onInitFailure() {
            promise.reject("E_INIT_FAILED", "The AILink Bluetooth service failed to start", null)
          }
        })
      }
    }

    // Start a session. If `mac` is a real address, connect straight to it
    // (discovery done by the reliable ble-plx scanner in JS); otherwise fall
    // back to the AILink broadcast-UUID scan.
    AsyncFunction("start") { mac: String?, scanTimeoutMs: Double, promise: Promise ->
      val context = appContext.reactContext?.applicationContext
      if (context == null) {
        promise.reject("E_NO_CONTEXT", "Android context unavailable", null)
        return@AsyncFunction
      }
      sessionActive = true
      connecting = false
      finished = false
      lastWeightKg = 0.0
      lastHeartRate = 0

      try { AILinkSDK.getInstance().init(context) } catch (_: Throwable) {}
      val manager = AILinkBleManager.getInstance()

      val begin = Runnable {
        manager.setOnCallbackBle(bleCallback)
        if (!mac.isNullOrEmpty()) {
          emit("type" to "connecting", "mac" to mac)
          manager.stopScan()
          manager.connectDevice(mac)
        } else {
          emit("type" to "scanning")
          manager.startScan(
            scanTimeoutMs.toLong(),
            BleConfig.UUID_BROADCAST_AILINK,
            BleConfig.UUID_SERVER_BROADCAST_AILINK,
            BleConfig.UUID_SERVER_AILINK,
          )
        }
        promise.resolve(null)
      }

      // Everything must run on the main thread and only after the service binds.
      Handler(Looper.getMainLooper()).post {
        if (manager.isInitOk) {
          begin.run()
        } else {
          manager.init(context, object : AILinkBleManager.onInitListener {
            override fun onInitSuccess() {
              if (sessionActive) begin.run() else promise.resolve(null)
            }
            override fun onInitFailure() {
              emit("type" to "error", "message" to "The AILink Bluetooth service failed to start. Restart the app and try again.")
              promise.resolve(null)
            }
          })
        }
      }
    }

    AsyncFunction("stop") { promise: Promise ->
      sessionActive = false
      connecting = false
      Handler(Looper.getMainLooper()).post {
        try {
          val manager = AILinkBleManager.getInstance()
          if (manager.isInitOk) {
            manager.stopScan()
            manager.disconnectAll()
          }
          manager.removeOnCallbackBle(bleCallback)
        } catch (_: Throwable) {
        }
      }
      deviceData = null
      promise.resolve(null)
    }
  }
}
