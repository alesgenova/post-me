import { IdType } from './common';
import { MethodsType, EventsType } from './handle';
import { Connection, ConcreteConnection } from './connection';
import { createHandshakeMessage, isHandshakeMessage, createResponsMessage, isResponseMessage } from './message';

const uniqueSessionId: () => IdType = (() => {
  let __sessionId = 0;
  return () => {
    const sessionId = __sessionId;
    __sessionId += 1;
    return sessionId;
  }
})();

export const HANDSHAKE_SUCCESS = '@post-me/handshake-success';

export function ParentHandshake<M0 extends MethodsType, E0 extends EventsType, M1 extends MethodsType, E1 extends EventsType>(otherOrigin: string, otherWindow: Window, localMethods: M0, _thisWindow?: Window): Promise<Connection<E0, M1, E1>> {
  const thisWindow = _thisWindow || window;

  const thisSessionId = uniqueSessionId();

  return new Promise<ConcreteConnection<M0, E0, M1, E1>>((resolve, reject) => {
    const handshakeListener = (event: MessageEvent) => {
      const {origin, source, data} = event;

      if ((origin !== otherOrigin && otherOrigin !== '*') || !source) {
        return;
      }

      if (isResponseMessage(data)) {
        const { sessionId, requestId, result } = data;
        if (sessionId === thisSessionId && requestId === thisSessionId && result === HANDSHAKE_SUCCESS) {
          thisWindow.removeEventListener('message', handshakeListener);
          resolve(new ConcreteConnection(localMethods, thisWindow, source, origin, sessionId));
        }
      }
    };

    thisWindow.addEventListener('message', handshakeListener);

    if (otherOrigin === '*') {
      console.warn('In order to prevent cross-origin attacks, it is strongly adviced to provide an explicit origin instead of "*"');
    }

    const message = createHandshakeMessage(thisSessionId);
    otherWindow.postMessage(message, otherOrigin);
  });
}

export function ChildHandshake<M0 extends MethodsType, E0 extends EventsType, M1 extends MethodsType, E1 extends EventsType>(otherOrigin: string, localMethods: M0, _thisWindow?: Window): Promise<Connection<E0, M1, E1>> {
  const thisWindow = _thisWindow || window;

  return new Promise<ConcreteConnection<M0, E0, M1, E1>>((resolve, reject) => {
    const handshakeListener = (event: MessageEvent) => {
      const {origin, source, data} = event;

      if ((origin !== otherOrigin && otherOrigin !== '*') || !source) {
        return;
      }

      if (isHandshakeMessage(data)) {
        if (otherOrigin === '*') {
          console.warn('In order to prevent cross-origin attacks, it is strongly adviced to provide an explicit origin instead of "*"');
        }

        const { sessionId, requestId } = data;
        thisWindow.removeEventListener('message', handshakeListener);
        const message = createResponsMessage(sessionId, requestId, HANDSHAKE_SUCCESS);
        (source as any).postMessage(message, otherOrigin);
        resolve(new ConcreteConnection(localMethods, thisWindow, source, origin, sessionId));
      }
    };

    thisWindow.addEventListener('message', handshakeListener);
  });
}
