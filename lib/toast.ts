type ToastMsg = { id: string; message: string; type?: "default" | "success" | "error" };
type Listener = (toasts: ToastMsg[]) => void;

let _toasts: ToastMsg[] = [];
let _listener: Listener | null = null;

export function toast(message: string, type?: ToastMsg["type"]) {
  const id = crypto.randomUUID();
  _toasts = [{ id, message, type }, ..._toasts].slice(0, 3);
  _listener?.([..._toasts]);
  setTimeout(() => {
    _toasts = _toasts.filter((t) => t.id !== id);
    _listener?.([..._toasts]);
  }, 3500);
}

export function registerToastListener(fn: Listener) { _listener = fn; }
export function unregisterToastListener() { _listener = null; }
