import { IdType } from './common';
import { MethodsType } from './handle';
import { Connection, ConcreteConnection } from './connection';
import {
  createHandshakeMessage,
  isHandshakeMessage,
  createResponsMessage,
  isResponseMessage,
  Message,
} from './message';
import { isWindow } from './worker';

const uniqueSessionId: () => IdType = (() => {
  let __sessionId = 0;
  return () => {
    const sessionId = __sessionId;
    __sessionId += 1;
    return sessionId;
  };
})();

export const HANDSHAKE_SUCCESS = '@post-me/handshake-success';

const makeWindowPostMessage = (w: Window, origin: string) => {
  return (message: Message<any>) => {
    w.postMessage(message, origin);
  };
};

const makeWorkerPostMessage = (w: Worker | DedicatedWorkerGlobalScope) => {
  return (message: Message<any>) => {
    w.postMessage(message);
  };
};

const makeWindowAddMessageListener = (w: Window, acceptedOrigin: string) => {
  const acceptEvent = (event: MessageEvent) => {
    const { origin } = event;

    if (origin !== acceptedOrigin && acceptedOrigin !== '*') {
      return false;
    }

    return true;
  };
  return (listener: (event: MessageEvent) => void) => {
    const outerListener = (event: MessageEvent) => {
      if (acceptEvent(event)) {
        listener(event);
      }
    };

    w.addEventListener('message', outerListener);

    const removeListener = () => {
      w.removeEventListener('message', outerListener);
    };

    return removeListener;
  };
};

const makeWorkerAddMessageListener = (w: Worker | WorkerGlobalScope) => {
  const acceptEvent = (_event: MessageEvent) => {
    return true;
  };
  return (listener: (message: MessageEvent) => void) => {
    const outerListener = (event: any) => {
      if (acceptEvent(event)) {
        listener(event);
      }
    };

    w.addEventListener('message', outerListener);

    const removeListener = () => {
      w.removeEventListener('message', outerListener);
    };

    return removeListener;
  };
};

export function ParentHandshake<M0 extends MethodsType>(
  localMethods: M0,
  otherWindow: Window | Worker,
  acceptedOrigin: string,
  _thisWindow?: Window | DedicatedWorkerGlobalScope
): Promise<Connection> {
  const thisWindow = _thisWindow || window;

  const thisSessionId = uniqueSessionId();

  return new Promise<ConcreteConnection<M0>>((resolve, reject) => {
    let postMessage: ((message: Message<any>) => void) | undefined;
    let addMessageListener:
      | ((listener: (event: MessageEvent) => void) => () => void)
      | undefined;

    if (isWindow(otherWindow)) {
      postMessage = makeWindowPostMessage(otherWindow, acceptedOrigin);
    } else {
      postMessage = makeWorkerPostMessage(otherWindow);
    }

    if (isWindow(thisWindow) && isWindow(otherWindow)) {
      addMessageListener = makeWindowAddMessageListener(
        thisWindow,
        acceptedOrigin
      );
    }

    if (isWindow(thisWindow) && !isWindow(otherWindow)) {
      addMessageListener = makeWorkerAddMessageListener(otherWindow);
    }

    if (postMessage === undefined || addMessageListener === undefined) {
      reject(new Error('post-me does not work yet with this type of worker.'));
      return;
    }

    let removeHandshakeListener: () => void;

    const handshakeListener = (event: MessageEvent) => {
      const { data } = event;

      if (isResponseMessage(data)) {
        const { sessionId, requestId, result } = data;

        if (
          sessionId === thisSessionId &&
          requestId === thisSessionId &&
          result === HANDSHAKE_SUCCESS
        ) {
          removeHandshakeListener();
          resolve(
            new ConcreteConnection(
              localMethods,
              postMessage as (message: Message<any>) => void,
              addMessageListener as (
                listener: (event: MessageEvent) => void
              ) => () => void,
              sessionId
            )
          );
        }
      }
    };

    removeHandshakeListener = addMessageListener(handshakeListener);

    const message = createHandshakeMessage(thisSessionId);
    postMessage(message);
  });
}

export function ChildHandshake<M0 extends MethodsType>(
  localMethods: M0,
  acceptedOrigin: string,
  _thisWindow?: Window | DedicatedWorkerGlobalScope
): Promise<Connection> {
  const thisWindow = _thisWindow || window;

  return new Promise<ConcreteConnection<M0>>((resolve, reject) => {
    let postMessage: ((message: Message<any>) => void) | undefined;
    let addMessageListener:
      | ((listener: (event: MessageEvent) => void) => () => void)
      | undefined;

    if (isWindow(thisWindow)) {
      addMessageListener = makeWindowAddMessageListener(
        thisWindow,
        acceptedOrigin
      );
    } else {
      addMessageListener = makeWorkerAddMessageListener(thisWindow);
    }

    if (addMessageListener === undefined) {
      reject(new Error('post-me does not work yet with this type of worker.'));
      return;
    }

    let removeHandshakeListener: () => void;

    const handshakeListener = (event: MessageEvent) => {
      const { source, data } = event;

      if (isHandshakeMessage(data)) {
        removeHandshakeListener();

        if (source && isWindow(source)) {
          postMessage = makeWindowPostMessage(source as any, acceptedOrigin);
        } else if (!source && !isWindow(thisWindow)) {
          postMessage = makeWorkerPostMessage(thisWindow);
        }

        if (postMessage === undefined) {
          reject(
            new Error('post-me does not work yet with this type of worker.')
          );
          return;
        }

        const { sessionId, requestId } = data;

        const message = createResponsMessage(
          sessionId,
          requestId,
          HANDSHAKE_SUCCESS
        );
        postMessage(message);

        resolve(
          new ConcreteConnection(
            localMethods,
            postMessage,
            addMessageListener as (
              listener: (event: MessageEvent) => void
            ) => () => void,
            sessionId
          )
        );
      }
    };

    removeHandshakeListener = addMessageListener(handshakeListener);
  });
}
