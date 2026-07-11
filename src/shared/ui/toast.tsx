import React from 'react';
import TopToast from '../components/TopToast';

export type ToastVariant = 'success' | 'error' | 'info';

type ToastEvent = {
  message: string;
  variant?: ToastVariant;
  durationMs?: number;
  topOffset?: number;
};

type Listener = (event: ToastEvent) => void;

const listeners = new Set<Listener>();
let toastTopOffset = 10;

export function setToastTopOffset(offset: number) {
  if (!Number.isFinite(offset)) return;
  toastTopOffset = Math.max(0, Math.round(offset));
}

export function resetToastTopOffset() {
  toastTopOffset = 10;
}

export function showToast(message: string, variant: ToastVariant = 'info', durationMs = 2600) {
  const event: ToastEvent = { message, variant, durationMs, topOffset: toastTopOffset };
  listeners.forEach((l) => {
    try {
      l(event);
    } catch {
      // ignore listener errors
    }
  });
}

export function ToastHost() {
  const [message, setMessage] = React.useState<string | null>(null);
  const [visible, setVisible] = React.useState(false);
  const [variant, setVariant] = React.useState<ToastVariant>('info');
  const [topOffset, setTopOffset] = React.useState<number>(toastTopOffset);
  const hideTimer = React.useRef<any>(null);

  React.useEffect(() => {
    const listener: Listener = (ev) => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }

      setMessage(ev.message);
      setVariant(ev.variant ?? 'info');
      setTopOffset(Number.isFinite(ev.topOffset as number) ? Math.max(0, Math.round(ev.topOffset as number)) : toastTopOffset);
      setVisible(true);

      const duration = Math.max(800, ev.durationMs ?? 2600);
      hideTimer.current = setTimeout(() => {
        setVisible(false);
      }, duration);
    };

    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  return <TopToast message={message} visible={visible} variant={variant} topOffset={topOffset} />;
}
