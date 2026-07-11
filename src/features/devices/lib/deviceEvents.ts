type Callback = () => void;
const subs = new Set<Callback>();

export function subscribeDeviceUpdates(cb: Callback) {
  subs.add(cb);
  return () => subs.delete(cb);
}

export function emitDeviceUpdates() {
  for (const cb of Array.from(subs)) {
    try {
      cb();
    } catch {}
  }
}
