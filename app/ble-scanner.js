// app/ble-scanner.js — generic BLE scanner / inspector.
// Lists every nearby BLE device (name, signal, advertised service UUIDs),
// connects on tap and shows the GATT services + characteristics. Useful for
// bringing up new devices and confirming what a device advertises.
import { Ionicons } from '@expo/vector-icons';
import { Buffer } from 'buffer';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getManager, requestBlePermissions, waitForPoweredOn } from '../ble/bleClient';
import { COLORS, FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING, shadow } from '../constants/theme';

const SCAN_SECONDS = 15;

function signalMeta(rssi) {
  if (rssi == null) return { label: '—', color: COLORS.textMuted, bars: 0 };
  if (rssi >= -60) return { label: 'Strong', color: COLORS.success, bars: 3 };
  if (rssi >= -75) return { label: 'Good', color: COLORS.warning, bars: 2 };
  return { label: 'Weak', color: COLORS.danger, bars: 1 };
}

export default function BleScannerScreen() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState({}); // id -> { device, rssi, name, serviceUUIDs }
  const [error, setError] = useState(null);
  const [connectingId, setConnectingId] = useState(null);
  const [connected, setConnected] = useState(null); // { id, name, services: [{uuid, characteristics:[]}] }
  const [packets, setPackets] = useState([]); // live notifications: { t, char, hex }
  const monitorsRef = useRef([]);
  const secondsRef = useRef(null);
  const [countdown, setCountdown] = useState(0);

  const stopScan = useCallback(() => {
    try { getManager().stopDeviceScan(); } catch {}
    if (secondsRef.current) { clearInterval(secondsRef.current); secondsRef.current = null; }
    setScanning(false);
    setCountdown(0);
  }, []);

  const startScan = useCallback(async () => {
    setError(null);
    setDevices({});
    try {
      const granted = await requestBlePermissions();
      if (!granted) { setError('Bluetooth permission denied. Enable it in Settings and retry.'); return; }
      const manager = getManager();
      await waitForPoweredOn(manager);

      setScanning(true);
      setCountdown(SCAN_SECONDS);
      secondsRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) { stopScan(); return 0; }
          return c - 1;
        });
      }, 1000);

      manager.startDeviceScan(null, { allowDuplicates: true }, (err, device) => {
        if (err) { setError(err.message); stopScan(); return; }
        if (!device) return;
        setDevices((prev) => ({
          ...prev,
          [device.id]: {
            device,
            rssi: device.rssi,
            name: device.name || device.localName || null,
            serviceUUIDs: device.serviceUUIDs || [],
          },
        }));
      });
    } catch (e) {
      setError(e?.message ?? String(e));
      stopScan();
    }
  }, [stopScan]);

  const clearMonitors = useCallback(() => {
    for (const m of monitorsRef.current) { try { m.remove(); } catch {} }
    monitorsRef.current = [];
  }, []);

  const connect = useCallback(async (entry) => {
    stopScan();
    setError(null);
    setPackets([]);
    clearMonitors();
    setConnectingId(entry.device.id);
    try {
      const device = await entry.device.connect({ timeout: 12000 });
      await device.discoverAllServicesAndCharacteristics();
      const svcs = await device.services();
      const services = [];
      for (const s of svcs) {
        const chars = await s.characteristics();
        services.push({
          uuid: s.uuid,
          characteristics: chars.map((c) => ({
            uuid: c.uuid,
            props: [
              c.isReadable && 'R',
              (c.isWritableWithResponse || c.isWritableWithoutResponse) && 'W',
              c.isNotifiable && 'N',
              c.isIndicatable && 'I',
            ].filter(Boolean).join(' '),
          })),
        });

        // Subscribe to every notify/indicate characteristic and log raw bytes,
        // so standing on the scale surfaces its live data packets.
        for (const c of chars) {
          if (!c.isNotifiable && !c.isIndicatable) continue;
          const label = c.uuid.split('-')[0];
          const sub = c.monitor((err, ch) => {
            if (err || !ch?.value) return;
            const hex = Buffer.from(ch.value, 'base64').toString('hex')
              .replace(/(..)/g, '$1 ').trim();
            setPackets((prev) => [
              { t: new Date().toLocaleTimeString(), char: label, hex },
              ...prev,
            ].slice(0, 40));
          });
          monitorsRef.current.push(sub);
        }
      }
      setConnected({ id: device.id, name: entry.name || device.id, services });
    } catch (e) {
      setError(`Connect failed: ${e?.message ?? e}`);
    } finally {
      setConnectingId(null);
    }
  }, [stopScan, clearMonitors]);

  const disconnect = useCallback(async () => {
    if (!connected) return;
    clearMonitors();
    try { await getManager().cancelDeviceConnection(connected.id); } catch {}
    setConnected(null);
    setPackets([]);
  }, [connected, clearMonitors]);

  // Keep the latest connection in a ref so the unmount-only cleanup below can
  // reach it without re-running (and tearing down monitors) on every change.
  const connectedRef = useRef(null);
  useEffect(() => { connectedRef.current = connected; }, [connected]);

  useEffect(() => () => {
    stopScan();
    clearMonitors();
    const c = connectedRef.current;
    if (c) { getManager().cancelDeviceConnection(c.id).catch(() => {}); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = Object.values(devices).sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999));

  const renderItem = ({ item }) => {
    const sig = signalMeta(item.rssi);
    const isConnecting = connectingId === item.device.id;
    return (
      <TouchableOpacity style={styles.row} onPress={() => connect(item)} disabled={isConnecting} activeOpacity={0.85}>
        <View style={[styles.rowIcon, { backgroundColor: sig.color + '18' }]}>
          <Ionicons name="bluetooth" size={20} color={sig.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowName} numberOfLines={1}>{item.name || 'Unnamed device'}</Text>
          <Text style={styles.rowSub} numberOfLines={1}>{item.device.id}</Text>
          {item.serviceUUIDs.length > 0 && (
            <Text style={styles.rowUuids} numberOfLines={1}>
              {item.serviceUUIDs.map((u) => u.split('-')[0]).join(', ')}
            </Text>
          )}
        </View>
        <View style={styles.rowRight}>
          {isConnecting
            ? <ActivityIndicator size="small" color={COLORS.secondary} />
            : <>
                <Text style={[styles.rowRssi, { color: sig.color }]}>{item.rssi ?? '—'} dBm</Text>
                <Text style={[styles.rowSignal, { color: sig.color }]}>{sig.label}</Text>
              </>}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient colors={[COLORS.primary, COLORS.primaryMid]} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>BLE Scanner</Text>
          <Text style={styles.headerSub}>
            {scanning ? `Scanning… ${countdown}s` : `${list.length} device${list.length === 1 ? '' : 's'} found`}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.scanBtn}
          onPress={scanning ? stopScan : startScan}
        >
          <Ionicons name={scanning ? 'stop' : 'search'} size={16} color={COLORS.white} />
          <Text style={styles.scanBtnText}>{scanning ? 'Stop' : 'Scan'}</Text>
        </TouchableOpacity>
      </LinearGradient>

      {error && (
        <View style={styles.errorBar}>
          <Ionicons name="warning-outline" size={16} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {connected ? (
        <View style={styles.detail}>
          <View style={styles.detailHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailTitle}>{connected.name}</Text>
              <Text style={styles.detailSub}>{connected.id} · connected</Text>
            </View>
            <TouchableOpacity style={styles.disconnectBtn} onPress={disconnect}>
              <Text style={styles.disconnectText}>Disconnect</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: SPACING.md }}>
            {/* Live notification data — stand on the scale to capture packets */}
            <View style={styles.liveHead}>
              <Ionicons name="pulse" size={16} color={COLORS.secondary} />
              <Text style={styles.liveTitle}>Live Data ({packets.length})</Text>
              {packets.length > 0 && (
                <TouchableOpacity onPress={() => setPackets([])}>
                  <Text style={styles.clearData}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.liveCard}>
              {packets.length === 0 ? (
                <Text style={styles.liveEmpty}>Waiting for data — step on the scale / trigger a measurement…</Text>
              ) : (
                packets.map((p, i) => (
                  <View key={`${p.t}-${i}`} style={styles.pktRow}>
                    <Text style={styles.pktMeta}>{p.t} · {p.char}</Text>
                    <Text style={styles.pktHex}>{p.hex}</Text>
                  </View>
                ))
              )}
            </View>

            {connected.services.map((s) => (
              <View key={s.uuid} style={styles.svcCard}>
                <Text style={styles.svcUuid}>Service {s.uuid.split('-')[0]}</Text>
                {s.characteristics.map((c) => (
                  <View key={c.uuid} style={styles.charRow}>
                    <Text style={styles.charUuid}>{c.uuid.split('-')[0]}</Text>
                    <Text style={styles.charProps}>{c.props || '—'}</Text>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(d) => d.device.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="bluetooth-outline" size={48} color={COLORS.textDisabled} />
              <Text style={styles.emptyText}>
                {scanning ? 'Searching for nearby devices…' : 'Tap Scan to search for BLE devices'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: COLORS.background },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, gap: SPACING.sm },
  backBtn:     { padding: 6, borderRadius: RADIUS.full, backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, color: COLORS.white },
  headerSub:   { fontSize: FONT_SIZE.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  scanBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SPACING.md, paddingVertical: 8, borderRadius: RADIUS.md, backgroundColor: COLORS.secondary },
  scanBtnText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: COLORS.white },

  errorBar:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.dangerBg, paddingHorizontal: SPACING.md, paddingVertical: 10 },
  errorText:   { flex: 1, fontSize: FONT_SIZE.xs, color: COLORS.danger },

  listContent: { padding: SPACING.md, gap: SPACING.sm, flexGrow: 1 },
  row:         { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.md, ...shadow.xs },
  rowIcon:     { width: 40, height: 40, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  rowName:     { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold, color: COLORS.textDark },
  rowSub:      { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 1 },
  rowUuids:    { fontSize: FONT_SIZE.xs, color: COLORS.secondary, marginTop: 2 },
  rowRight:    { alignItems: 'flex-end', minWidth: 64 },
  rowRssi:     { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  rowSignal:   { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.medium },

  empty:       { alignItems: 'center', justifyContent: 'center', paddingTop: SPACING.xxl, gap: SPACING.md, flex: 1 },
  emptyText:   { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, textAlign: 'center', paddingHorizontal: SPACING.xl },

  detail:      { flex: 1 },
  detailHead:  { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  detailTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: COLORS.textDark },
  detailSub:   { fontSize: FONT_SIZE.xs, color: COLORS.success, marginTop: 2 },
  disconnectBtn: { paddingHorizontal: SPACING.md, paddingVertical: 8, borderRadius: RADIUS.sm, borderWidth: 1.5, borderColor: COLORS.danger },
  disconnectText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, color: COLORS.danger },

  liveHead:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm },
  liveTitle:   { flex: 1, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: COLORS.textDark },
  clearData:   { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, color: COLORS.danger },
  liveCard:    { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, minHeight: 60 },
  liveEmpty:   { fontSize: FONT_SIZE.xs, color: COLORS.accentLight, fontStyle: 'italic' },
  pktRow:      { marginBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)', paddingBottom: 6 },
  pktMeta:     { fontSize: FONT_SIZE.xs, color: COLORS.accent, fontWeight: FONT_WEIGHT.semibold, marginBottom: 2 },
  pktHex:      { fontSize: FONT_SIZE.xs, color: COLORS.white, fontFamily: 'monospace', lineHeight: 16 },
  svcCard:     { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, ...shadow.xs },
  svcUuid:     { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: COLORS.primaryMid, marginBottom: 6 },
  charRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderTopWidth: 1, borderTopColor: COLORS.divider },
  charUuid:    { fontSize: FONT_SIZE.sm, color: COLORS.textBody, fontFamily: 'monospace' },
  charProps:   { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, fontWeight: FONT_WEIGHT.semibold },
});
