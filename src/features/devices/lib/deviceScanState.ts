/**
 * Shared observable for whether the device-scan modal is actively scanning.
 * HomeScreen uses this to pause the BLE live-monitor while the scan modal is open,
 * instead of blanket-disabling monitoring on the entire Devices tab.
 */

const listeners = new Set<() => void>();
let _scanModalOpen = false;

export function isScanModalOpen(): boolean {
  return _scanModalOpen;
}

export function setScanModalOpen(open: boolean) {
  if (_scanModalOpen === open) return;
  _scanModalOpen = open;
  for (const l of Array.from(listeners)) {
    try { l(); } catch {}
  }
}

export function subscribeScanModalOpen(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
