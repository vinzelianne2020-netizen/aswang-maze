const listeners = new Map();

export function on(eventName, listener) {
  if (!listeners.has(eventName)) listeners.set(eventName, new Set());
  listeners.get(eventName).add(listener);
  return () => listeners.get(eventName)?.delete(listener);
}

export function emit(eventName, detail = null) {
  const eventListeners = listeners.get(eventName);
  if (!eventListeners) return;
  eventListeners.forEach((listener) => listener(detail));
}
