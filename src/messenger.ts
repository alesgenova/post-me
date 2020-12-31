export type MessageListener = (event: MessageEvent) => void;
export type ListenerRemover = () => void;

// TODO jsdocs
export interface IMessenger {
  postMessage: (message: any) => void;
  addMessageListener: (listener: MessageListener) => ListenerRemover;
}

// TODO jsdocs
export class WindowMessenger implements IMessenger {
  localWindow: Window = window;
  remoteWindow: Window;
  remoteOrigin: string;

  constructor({
    localWindow = window,
    remoteWindow,
    remoteOrigin,
  }: {
    localWindow: Window;
    remoteWindow: Window;
    remoteOrigin: string;
  }) {
    this.localWindow = localWindow;
    this.remoteWindow = remoteWindow;
    this.remoteOrigin = remoteOrigin;
  }

  postMessage(message: any): void {
    this.remoteWindow.postMessage(message, this.remoteOrigin);
  }

  addMessageListener(listener: MessageListener): ListenerRemover {
    const outerListener = (event: MessageEvent) => {
      if (this.isValid(event)) {
        listener(event);
      }
    };

    this.localWindow.addEventListener('message', outerListener);

    const removeListener = () => {
      this.localWindow.removeEventListener('message', outerListener);
    };

    return removeListener;
  }

  isValid(event: MessageEvent): boolean {
    const { source, origin } = event;

    if (source !== this.remoteWindow) {
      return false;
    }

    if (this.remoteOrigin !== '*' && origin !== this.remoteOrigin) {
      return false;
    }

    return true;
  }
}

// TODO jsdocs
export class WorkerMessenger implements IMessenger {
  worker: Worker | DedicatedWorkerGlobalScope;

  constructor(worker: Worker | DedicatedWorkerGlobalScope) {
    this.worker = worker;
  }

  postMessage(message: any): void {
    this.worker.postMessage(message);
  }

  addMessageListener(listener: MessageListener): ListenerRemover {
    // TODO remove any
    this.worker.addEventListener('message', listener as any);

    // TODO remove any
    const removeListener = () => {
      this.worker.removeEventListener('message', listener as any);
    };

    return removeListener;
  }
}
