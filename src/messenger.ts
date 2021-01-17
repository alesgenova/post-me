type MessageListener = (event: MessageEvent) => void;
type ListenerRemover = () => void;

export interface Messenger {
  postMessage: (message: any, transfer?: Transferable[]) => void;
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
  postMessage: (message: any, transfer?: Transferable[]) => void;
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

    this.postMessage = (message, transfer) => {
      remoteWindow.postMessage(message, remoteOrigin, transfer);
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
  postMessage: (message: any, transfer?: Transferable[]) => void;
  addMessageListener: (listener: MessageListener) => ListenerRemover;

  constructor({ worker }: { worker: Worker }) {
    this.postMessage = (message, transfer = []) => {
      worker.postMessage(message, transfer);
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

export const debug = (namespace: string, log?: (...data: any[]) => void) => {
  log = log || console.debug || console.log || (() => {});
  return (...data: any[]) => {
    log!(namespace, ...data);
  };
};

export function DebugMessenger(
  messenger: Messenger,
  log?: (...data: any[]) => void
): Messenger {
  log = log || debug('post-me');

  const debugListener: MessageListener = function (event) {
    const { data } = event;
    log!('⬅️ received message', data);
  };

  messenger.addMessageListener(debugListener);

  return {
    postMessage: function (message) {
      log!('➡️ sending message', message);
      messenger.postMessage(message);
    },
    addMessageListener: function (listener) {
      return messenger.addMessageListener(listener);
    },
  };
}
