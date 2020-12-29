import { Message, isHandshakeMessage } from './message';

type MessageListener = (event: MessageEvent) => void;
type ListenerRemover = () => void;

export interface Messenger {
  postMessage: (message: Message<any>) => void;
  addMessageListener: (listener: MessageListener) => ListenerRemover;
}

const acceptableEventOrigin = (event: MessageEvent, acceptedOrigin: string) => {
  const { origin } = event;

  if (origin !== acceptedOrigin && acceptedOrigin !== '*') {
    return false;
  }

  return true;
};

export class ParentWindowMessenger implements Messenger {
  postMessage: (message: Message<any>) => void;
  addMessageListener: (listener: MessageListener) => ListenerRemover;

  constructor({
    localWindow,
    remoteWindow,
    remoteOrigin,
  }: {
    localWindow: Window;
    remoteWindow: Window;
    remoteOrigin: string;
  }) {
    this.postMessage = (message) => {
      remoteWindow.postMessage(message, remoteOrigin);
    };

    this.addMessageListener = (listener) => {
      const outerListener = (event: MessageEvent) => {
        if (acceptableEventOrigin(event, remoteOrigin)) {
          listener(event);
        }
      };

      localWindow.addEventListener('message', outerListener);

      const removeListener = () => {
        localWindow.removeEventListener('message', outerListener);
      };

      return removeListener;
    };
  }
}

export class ChildWindowMessenger implements Messenger {
  postMessage: (message: Message<any>) => void;
  addMessageListener: (listener: MessageListener) => ListenerRemover;

  constructor({
    localWindow,
    remoteOrigin,
  }: {
    localWindow: Window;
    remoteOrigin: string;
  }) {
    this.postMessage = () => {
      throw new Error(
        "ChildWindowMessenger::postMessage is called before it's initialized"
      );
    };

    this.addMessageListener = (listener) => {
      const outerListener = (event: MessageEvent) => {
        if (acceptableEventOrigin(event, remoteOrigin)) {
          listener(event);
        }
      };

      localWindow.addEventListener('message', outerListener);

      const removeListener = () => {
        localWindow.removeEventListener('message', outerListener);
      };

      return removeListener;
    };

    // We can't know to which window we need to post messages to until we receive a handshake request.
    // Add a temporary listener for this purpose.
    let removeTemporaryListener: () => void;

    const temporaryListener = (event: MessageEvent) => {
      const { source, data } = event;
      if (source && isHandshakeMessage(data)) {
        removeTemporaryListener();

        this.postMessage = (message) =>
          (source as Window).postMessage(message, remoteOrigin);
      }
    };

    removeTemporaryListener = this.addMessageListener(temporaryListener);
  }
}

export class WindowMessenger implements Messenger {
  private _messenger: Messenger;

  constructor({
    localWindow,
    remoteWindow,
    remoteOrigin,
  }: {
    localWindow?: Window;
    remoteWindow?: Window;
    remoteOrigin: string;
  }) {
    localWindow = localWindow || window;

    if (!!remoteWindow) {
      this._messenger = new ParentWindowMessenger({
        localWindow,
        remoteWindow,
        remoteOrigin,
      });
    } else {
      this._messenger = new ChildWindowMessenger({ localWindow, remoteOrigin });
    }
  }

  postMessage(message: Message<any>) {
    this._messenger.postMessage(message);
  }

  addMessageListener(listener: MessageListener) {
    return this._messenger.addMessageListener(listener);
  }
}

export class WorkerMessenger implements Messenger {
  postMessage: (message: Message<any>) => void;
  addMessageListener: (listener: MessageListener) => ListenerRemover;

  constructor({ worker }: { worker: Worker }) {
    this.postMessage = (message) => {
      worker.postMessage(message);
    };

    this.addMessageListener = (listener) => {
      const outerListener = (event: MessageEvent) => {
        listener(event);
      };

      worker.addEventListener('message', outerListener);

      const removeListener = () => {
        worker.removeEventListener('message', outerListener);
      };

      return removeListener;
    };
  }
}
