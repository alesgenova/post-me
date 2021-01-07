import { IdType, KeyType, createUniqueIdFn } from './common';
import { Messenger } from './messenger';
import { Emitter } from './emitter';
import {
  isMessage,
  isCallMessage,
  isResponseMessage,
  isEventMessage,
  MessageType,
  CallMessage,
  EventMessage,
  ResponseMessage,
  createCallMessage,
  createEventMessage,
  createResponsMessage,
  HandshakeResponseMessage,
  isHandshakeResponseMessage,
  createHandshakeRequestMessage,
  HandshakeRequestMessage,
  isHandshakeRequestMessage,
  createHandshakeResponseMessage,
} from './messages';

export type DispatcherEvents = {
  [MessageType.Call]: CallMessage<any[]>;
  [MessageType.Event]: EventMessage<any>;
  [x: number]: ResponseMessage<any>;
};

export class Dispatcher extends Emitter<DispatcherEvents> {
  private messenger: Messenger;
  private sessionId: IdType;
  private removeMessengerListener: () => void;
  private uniqueId: () => IdType;

  constructor(messenger: Messenger, sessionId: IdType) {
    super();

    this.uniqueId = createUniqueIdFn();

    this.messenger = messenger;
    this.sessionId = sessionId;

    this.removeMessengerListener = this.messenger.addMessageListener(
      this.messengerListener.bind(this)
    );
  }

  private messengerListener(event: MessageEvent) {
    const { data } = event;

    if (!isMessage(data)) {
      return;
    }

    if (this.sessionId !== data.sessionId) {
      return;
    }

    if (isCallMessage(data)) {
      this.emit(MessageType.Call, data);
    } else if (isResponseMessage(data)) {
      this.emit(data.requestId, data);
    } else if (isEventMessage(data)) {
      this.emit(MessageType.Event, data);
    }
  }

  callOnRemote(methodName: KeyType, ...args: any[]): IdType {
    const requestId = this.uniqueId();
    const message = createCallMessage(
      this.sessionId,
      requestId,
      methodName,
      ...args
    );
    this.messenger.postMessage(message);

    return requestId;
  }

  respondToRemote(requestId: IdType, value: any, error?: any) {
    const message = createResponsMessage(
      this.sessionId,
      requestId,
      value,
      error
    );
    this.messenger.postMessage(message);
  }

  emitToRemote(eventName: KeyType, payload: any) {
    const message = createEventMessage(this.sessionId, eventName, payload);
    this.messenger.postMessage(message);
  }

  close() {
    this.removeMessengerListener();
    this.removeAllListeners();
  }
}

export type ParentHandshakeDispatcherEvents = {
  [x: number]: HandshakeResponseMessage;
};

export class ParentHandshakeDispatcher extends Emitter<ParentHandshakeDispatcherEvents> {
  private messenger: Messenger;
  private sessionId: IdType;
  private removeMessengerListener: () => void;

  constructor(messenger: Messenger, sessionId: IdType) {
    super();

    this.messenger = messenger;
    this.sessionId = sessionId;

    this.removeMessengerListener = this.messenger.addMessageListener(
      this.messengerListener.bind(this)
    );
  }

  private messengerListener(event: MessageEvent) {
    const { data } = event;

    if (!isMessage(data)) {
      return;
    }

    if (this.sessionId !== data.sessionId) {
      return;
    }

    if (isHandshakeResponseMessage(data)) {
      this.emit(data.sessionId, data);
    }
  }

  initiateHandshake(): IdType {
    const message = createHandshakeRequestMessage(this.sessionId);
    this.messenger.postMessage(message);
    return this.sessionId;
  }

  close() {
    this.removeMessengerListener();
    this.removeAllListeners();
  }
}

export type ChildHandshakeDispatcherEvents = {
  [MessageType.HandshakeRequest]: HandshakeRequestMessage;
};

export class ChildHandshakeDispatcher extends Emitter<ChildHandshakeDispatcherEvents> {
  private messenger: Messenger;
  private removeMessengerListener: () => void;

  constructor(messenger: Messenger) {
    super();

    this.messenger = messenger;

    this.removeMessengerListener = this.messenger.addMessageListener(
      this.messengerListener.bind(this)
    );
  }

  private messengerListener(event: MessageEvent) {
    const { data } = event;

    if (isHandshakeRequestMessage(data)) {
      this.emit(MessageType.HandshakeRequest, data);
    }
  }

  acceptHandshake(sessionId: IdType) {
    const message = createHandshakeResponseMessage(sessionId);
    this.messenger.postMessage(message);
  }

  close() {
    this.removeMessengerListener();
    this.removeAllListeners();
  }
}
