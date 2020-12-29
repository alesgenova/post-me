import { IdType } from './common';
import { MethodsType } from './handle';
import { Messenger } from './messenger';
import { Connection, ConcreteConnection } from './connection';
import {
  createHandshakeMessage,
  isHandshakeMessage,
  createResponsMessage,
  isResponseMessage,
} from './message';

const uniqueSessionId: () => IdType = (() => {
  let __sessionId = 0;
  return () => {
    const sessionId = __sessionId;
    __sessionId += 1;
    return sessionId;
  };
})();

export const HANDSHAKE_SUCCESS = '@post-me/handshake-success';

export function ParentHandshake<M0 extends MethodsType>(
  localMethods: M0,
  messenger: Messenger
): Promise<Connection> {
  const thisSessionId = uniqueSessionId();

  return new Promise<ConcreteConnection<M0>>((resolve, reject) => {
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
          resolve(new ConcreteConnection(localMethods, messenger, sessionId));
        }
      }
    };

    removeHandshakeListener = messenger.addMessageListener(handshakeListener);

    const message = createHandshakeMessage(thisSessionId);
    messenger.postMessage(message);
  });
}

export function ChildHandshake<M0 extends MethodsType>(
  localMethods: M0,
  messenger: Messenger
): Promise<Connection> {
  return new Promise<ConcreteConnection<M0>>((resolve, reject) => {
    let removeHandshakeListener: () => void;

    const handshakeListener = (event: MessageEvent) => {
      const { data } = event;

      if (isHandshakeMessage(data)) {
        removeHandshakeListener();

        const { sessionId, requestId } = data;

        const message = createResponsMessage(
          sessionId,
          requestId,
          HANDSHAKE_SUCCESS
        );

        messenger.postMessage(message);

        resolve(new ConcreteConnection(localMethods, messenger, sessionId));
      }
    };

    removeHandshakeListener = messenger.addMessageListener(handshakeListener);
  });
}
