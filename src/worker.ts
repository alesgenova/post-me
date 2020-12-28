export interface ISupportedWindow {
  postMessage: Window['postMessage'];
  addEventListener: Window['addEventListener'];
  removeEventListener: Window['removeEventListener'];
}

export function isWindow(w: unknown): w is ISupportedWindow {
  if (!w || typeof w !== 'object' || Array.isArray(w)) {
    return false;
  }
  const { postMessage, addEventListener, removeEventListener } = w as Record<
    string | symbol | number,
    unknown
  >;
  return (
    typeof postMessage === 'function' &&
    typeof addEventListener === 'function' &&
    typeof removeEventListener === 'function'
  );
}
