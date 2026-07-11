import { NativeModules, Platform } from 'react-native';

const { NavigationBarColor } = NativeModules as {
  NavigationBarColor?: {
    setColor?: (color: string, isLight: boolean) => void;
    setColorAnimated?: (color: string, isLight: boolean, durationMs: number) => void;
  };
};

const modalVisualProgress = new Map<string, number>();
const MODAL_SCRIM_ALPHA = 0.45;

function toHexChannel(value: number): string {
  return value.toString(16).padStart(2, '0').toUpperCase();
}

function getOverlayColor(progress: number): string {
  const clamped = Math.max(0, Math.min(1, progress));
  const channel = Math.round(255 * (1 - MODAL_SCRIM_ALPHA * clamped));
  const hex = toHexChannel(channel);
  return `#${hex}${hex}${hex}`;
}

function applyNavigationBarVisualState(): void {
  if (Platform.OS !== 'android' || typeof NavigationBarColor?.setColor !== 'function') return;

  let progress = 0;
  for (const value of modalVisualProgress.values()) {
    if (value > progress) progress = value;
  }

  // Keep dark icons throughout; the dimmed nav bar stays light enough for contrast,
  // and this avoids an additional icon-mode transition on top of the color fade.
  NavigationBarColor.setColor(getOverlayColor(progress), true);
}

export function setModalVisualProgress(id: string, progress: number): void {
  modalVisualProgress.set(id, Math.max(0, Math.min(1, progress)));
  applyNavigationBarVisualState();
}

export function clearModalVisualProgress(id: string): void {
  if (!modalVisualProgress.has(id)) return;
  modalVisualProgress.delete(id);
  applyNavigationBarVisualState();
}

type Listener = (open: boolean) => void;
let count = 0;
const listeners = new Set<Listener>();
export function pushModal() {
  count += 1;
  notify();
}
export function popModal() {
  count = Math.max(0, count - 1);
  notify();
}
export function isModalOpen() {
  return count > 0;
}
export function subscribe(fn: Listener) {
  listeners.add(fn);
  // call immediately
  fn(isModalOpen());
  return () => {
    listeners.delete(fn);
  };
}
function notify() {
  const open = isModalOpen();

  for (const fn of Array.from(listeners)) fn(open);
}
