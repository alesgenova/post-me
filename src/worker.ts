export function isWindow(
  w:
    | Window
    | Worker
    | SharedWorker
    | WorkerGlobalScope
    | MessagePort
    | ServiceWorker
): w is Window {
  return globalThis.Window
    ? w.constructor.name === globalThis.Window.name
    : false;
}
