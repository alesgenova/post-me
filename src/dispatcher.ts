import Emittery from 'emittery';
import { v4 as uuid } from 'uuid';

import { IMessenger } from './messenger';
import {
  createCallMessage,
  createEventMessage,
  createHandshakeRequestMessage,
  createHandshakeResponseMessage,
  createResponsMessage,
  isCallMessage,
  isEventMessage,
  isHandshakeRequestMessage,
  isHandshakeResponseMessage,
  isNativeMessage,
  isResponseMessage,
} from './msg/native';

import {
  HANDSHAKE_REQUEST,
  CALL_REQUEST,
  REMOTE_EVENT,
} from './msg/dispatcher';

export class Dispatcher extends Emittery {
  private messenger: IMessenger;
  private sessionId?: string;

  constructor(messenger: IMessenger) {
    super();

    this.messenger = messenger;
    messenger.addMessageListener(this.mainListener.bind(this));
  }

  private mainListener(event: MessageEvent) {
    const { data: msg } = event;

    if (!isNativeMessage(msg)) {
      return;
    }

    if (!this.sessionId) {
      if (isHandshakeRequestMessage(msg)) {
        this.emit(HANDSHAKE_REQUEST, msg.sessionId);
      }
      return;
    }

    if (this.sessionId !== msg.sessionId) {
      return;
    }

    if (isCallMessage(msg)) {
      this.emit(CALL_REQUEST, msg.data);
    } else if (isResponseMessage(msg)) {
      this.emit(msg.data.requestId, msg.data);
    } else if (isEventMessage(msg)) {
      this.emit(REMOTE_EVENT, msg.data);
    } else if (isHandshakeResponseMessage(msg)) {
      this.emit(msg.sessionId);
    }
  }

  setSessionId(sessionId: string) {
    this.sessionId = sessionId;
  }

  callOnRemote(name: string, ...args: any[]): string {
    if (!this.sessionId) {
      throw new Error(
        'Trying to communicate before the handshake is established'
      );
    }

    const requestId = uuid();
    const message = createCallMessage(this.sessionId, requestId, name, ...args);
    this.messenger.postMessage(message);

    return requestId;
  }

  respondToRemote(requestId: string, value: any, error: boolean) {
    if (!this.sessionId) {
      throw new Error(
        'Trying to communicate before the handshake is established'
      );
    }

    const message = createResponsMessage(
      this.sessionId,
      requestId,
      value,
      error
    );
    this.messenger.postMessage(message);
  }

  emitToRemote(name: string, payload: any) {
    if (!this.sessionId) {
      throw new Error(
        'Trying to communicate before the handshake is established'
      );
    }

    const message = createEventMessage(this.sessionId, name, payload);
    this.messenger.postMessage(message);
  }

  initiateHandshake(sessionId: string): string {
    this.setSessionId(sessionId);
    const message = createHandshakeRequestMessage(sessionId);
    this.messenger.postMessage(message);
    return sessionId;
  }

  acceptHandshake(sessionId: string) {
    this.setSessionId(sessionId);
    const message = createHandshakeResponseMessage(sessionId);
    this.messenger.postMessage(message);
  }
}
