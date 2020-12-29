type MessageListener = (event: MessageEvent) => void;
type ListenerRemover = () => void;

export interface Messenger {
  postMessage: (message: any) => void;
  addMessageListener: (listener: MessageListener) => ListenerRemover;
}

const acceptableMessageEvent = (
  event: MessageEvent,
  remoteWindow: Window,
  acceptedOrigin: string
) => {
  const { source, origin } = event;

  if (source !== remoteWindow) {
    return false;
  }

  if (origin !== acceptedOrigin && acceptedOrigin !== '*') {
    return false;
  }

  return true;
};

export class WindowMessenger implements Messenger {
  postMessage: (message: any) => void;
  addMessageListener: (listener: MessageListener) => ListenerRemover;

  constructor({
    localWindow,
    remoteWindow,
    remoteOrigin,
  }: {
    localWindow?: Window;
    remoteWindow: Window;
    remoteOrigin: string;
  }) {
    localWindow = localWindow || window;

    this.postMessage = (message) => {
      remoteWindow.postMessage(message, remoteOrigin);
    };

    this.addMessageListener = (listener) => {
      const outerListener = (event: MessageEvent) => {
        if (acceptableMessageEvent(event, remoteWindow, remoteOrigin)) {
          listener(event);
        }
      };

      localWindow!.addEventListener('message', outerListener);

      const removeListener = () => {
        localWindow!.removeEventListener('message', outerListener);
      };

      return removeListener;
    };
  }
}

export class WorkerMessenger implements Messenger {
  postMessage: (message: any) => void;
  addMessageListener: (listener: MessageListener) => ListenerRemover;

  constructor({ worker }: { worker: Worker | DedicatedWorkerGlobalScope }) {
    this.postMessage = (message) => {
      worker.postMessage(message);
    };

    this.addMessageListener = (listener) => {
      const outerListener = (event: MessageEvent) => {
        listener(event);
      };

      (worker as any).addEventListener('message', outerListener);

      const removeListener = () => {
        (worker as any).removeEventListener('message', outerListener);
      };

      return removeListener;
    };
  }
}
