import { createUniqueIdFn } from './common';
import { MethodsType } from './common';
import { Messenger } from './messenger';
import {
  ParentHandshakeDispatcher,
  ChildHandshakeDispatcher,
  Dispatcher,
} from './dispatcher';
import { Connection, ConcreteConnection } from './connection';
import { MessageType } from './messages';

const uniqueSessionId = createUniqueIdFn();

const runUntil = (
  worker: () => void,
  condition: () => boolean,
  unfulfilled: () => void,
  maxAttempts: number,
  attemptInterval: number
): void => {
  let attempt = 0;
  const fn = () => {
    if (!condition() && (attempt < maxAttempts || maxAttempts < 1)) {
      worker();
      attempt += 1;
      setTimeout(fn, attemptInterval);
    } else if (!condition() && attempt >= maxAttempts && maxAttempts >= 1) {
      unfulfilled();
    }
  };
  fn();
};

/**
 * Initiate the handshake from the Parent side
 *
 * @param messenger - The Messenger used to send and receive messages from the other end
 * @param localMethods - The methods that will be exposed to the other end
 * @param maxAttempts - The maximum number of handshake attempts
 * @param attemptsInterval - The interval between handshake attempts
 * @returns A Promise to an active {@link Connection} to the other end
 *
 * @public
 */
export function ParentHandshake<M0 extends MethodsType>(
  messenger: Messenger,
  localMethods: M0 = {} as M0,
  maxAttempts: number = 5,
  attemptsInterval: number = 100
): Promise<Connection> {
  const thisSessionId = uniqueSessionId();
  let connected = false;
  return new Promise((resolve, reject) => {
    const handshakeDispatcher = new ParentHandshakeDispatcher(
      messenger,
      thisSessionId
    );

    handshakeDispatcher.once(thisSessionId).then((response) => {
      connected = true;
      handshakeDispatcher.close();
      const { sessionId } = response;
      const dispatcher = new Dispatcher(messenger, sessionId);
      const connection = new ConcreteConnection(dispatcher, localMethods);
      resolve(connection);
    });

    runUntil(
      () => handshakeDispatcher.initiateHandshake(),
      () => connected,
      () =>
        reject(
          new Error(`Handshake failed, reached maximum number of attempts`)
        ),
      maxAttempts,
      attemptsInterval
    );
  });
}

/**
 * Initiate the handshake from the Child side
 *
 * @param messenger - The Messenger used to send and receive messages from the other end
 * @param localMethods - The methods that will be exposed to the other end
 * @returns A Promise to an active {@link Connection} to the other end
 *
 * @public
 */
export function ChildHandshake<M extends MethodsType>(
  messenger: Messenger,
  localMethods: M = {} as M
): Promise<Connection> {
  return new Promise((resolve, reject) => {
    const handshakeDispatcher = new ChildHandshakeDispatcher(messenger);

    handshakeDispatcher.once(MessageType.HandshakeRequest).then((response) => {
      const { sessionId } = response;
      handshakeDispatcher.acceptHandshake(sessionId);
      handshakeDispatcher.close();
      const dispatcher = new Dispatcher(messenger, sessionId);
      const connection = new ConcreteConnection(dispatcher, localMethods);
      resolve(connection);
    });
  });
}
