type MessageListener = (event: MessageEvent) => void;
type ListenerRemover = () => void;

/**
 * An interface used internally to exchange low level messages across contexts.
 *
 * @remarks
 *
 * Having a single interface lets post-me deal with Workers, Windows, and MessagePorts
 * without having to worry about their differences.
 *
 * A few concrete implementations of the Messenger interface are provided.
 *
 * @public
 *
 */
export interface Messenger {
  /**
   * Send a message to the other context
   *
   * @param message - The payload of the message
   * @param transfer - A list of Transferable objects that should be transferred to the other context instead of cloned.
   */
  postMessage(message: any, transfer?: Transferable[]): void;

  /**
   * Add a listener to messages received by the other context
   *
   * @param listener - A listener that will receive the MessageEvent
   * @returns A function that can be invoked to remove the listener
   */
  addMessageListener(listener: MessageListener): ListenerRemover;
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

/**
 * A concrete implementation of {@link Messenger} used to communicate with another Window.
 *
 * @public
 *
 */
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

interface Postable {
  postMessage(message: any, transfer?: Transferable[]): void;
  addEventListener(eventName: 'message', listener: MessageListener): void;
  removeEventListener(eventName: 'message', listener: MessageListener): void;
}

/** @public */
export class BareMessenger implements Messenger {
  postMessage: (message: any, transfer?: Transferable[]) => void;
  addMessageListener: (listener: MessageListener) => ListenerRemover;

  constructor(postable: Postable) {
    this.postMessage = (message, transfer = []) => {
      postable.postMessage(message, transfer);
    };

    this.addMessageListener = (listener) => {
      const outerListener = (event: MessageEvent) => {
        listener(event);
      };

      postable.addEventListener('message', outerListener);

      const removeListener = () => {
        postable.removeEventListener('message', outerListener);
      };

      return removeListener;
    };
  }
}

/**
 * A concrete implementation of {@link Messenger} used to communicate with a Worker.
 *
 * @public
 *
 */
export class WorkerMessenger extends BareMessenger implements Messenger {
  constructor({ worker }: { worker: Worker }) {
    super(worker);
  }
}

/**
 * A concrete implementation of {@link Messenger} used to communicate with a MessagePort.
 *
 * @public
 *
 */
export class PortMessenger extends BareMessenger implements Messenger {
  constructor({ port }: { port: MessagePort }) {
    port.start();
    super(port);
  }
}

/**
 * Create a logger function with a specific namespace
 *
 * @param namespace - The namespace will be prepended to all the arguments passed to the logger function
 * @param log - The underlying logger (`console.log` by default)
 *
 * @public
 *
 */
export function debug(namespace: string, log?: (...data: any[]) => void) {
  log = log || console.debug || console.log || (() => {});
  return (...data: any[]) => {
    log!(namespace, ...data);
  };
}

/**
 * Decorate a {@link Messenger} so that it will log any message exchanged
 * @param messenger - The Messenger that will be decorated
 * @param log - The logger function that will receive each message
 * @returns A decorated Messenger
 *
 * @public
 *
 */
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
    postMessage: function (message, transfer) {
      log!('➡️ sending message', message);
      messenger.postMessage(message, transfer);
    },
    addMessageListener: function (listener) {
      return messenger.addMessageListener(listener);
    },
  };
}
