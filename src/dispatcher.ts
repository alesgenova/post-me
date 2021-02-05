import { IdType, KeyType, createUniqueIdFn } from './common';
import { Messenger } from './messenger';
import { ConcreteEmitter } from './emitter';
import {
  isMessage,
  isCallMessage,
  isResponseMessage,
  isCallbackMessage,
  isEventMessage,
  MessageType,
  CallMessage,
  EventMessage,
  ResponseMessage,
  CallbackMessage,
  createCallMessage,
  createEventMessage,
  createResponsMessage,
  createCallbackMessage,
  HandshakeResponseMessage,
  isHandshakeResponseMessage,
  createHandshakeRequestMessage,
  HandshakeRequestMessage,
  isHandshakeRequestMessage,
  createHandshakeResponseMessage,
} from './messages';

function makeCallbackEvent(requestId: IdType): string {
  return `callback_${requestId}`;
}

function makeResponseEvent(requestId: IdType): string {
  return `response_${requestId}`;
}

export type DispatcherEvents = {
  [x: string]:
    | CallMessage<any[]>
    | EventMessage<any>
    | CallbackMessage<any[]>
    | ResponseMessage<any>;
  [MessageType.Call]: CallMessage<any[]>;
  [MessageType.Event]: EventMessage<any>;
};

export class Dispatcher extends ConcreteEmitter<DispatcherEvents> {
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
      this.emit(makeResponseEvent(data.requestId), data);
    } else if (isEventMessage(data)) {
      this.emit(MessageType.Event, data);
    } else if (isCallbackMessage(data)) {
      this.emit(makeCallbackEvent(data.requestId), data);
    }
  }

  callOnRemote(methodName: KeyType, args: any[], transfer?: Transferable[]) {
    const requestId = this.uniqueId();
    const callbackEvent = makeCallbackEvent(requestId);
    const responseEvent = makeResponseEvent(requestId);
    const message = createCallMessage(
      this.sessionId,
      requestId,
      methodName,
      args
    );
    this.messenger.postMessage(message, transfer);

    return { callbackEvent, responseEvent };
  }

  respondToRemote(
    requestId: IdType,
    value: any,
    error: any,
    transfer?: Transferable[]
  ) {
    if (error instanceof Error) {
      error = {
        name: error.name,
        message: error.message,
      };
    }
    const message = createResponsMessage(
      this.sessionId,
      requestId,
      value,
      error
    );
    this.messenger.postMessage(message, transfer);
  }

  callbackToRemote(requestId: IdType, callbackId: IdType, args: any[]) {
    const message = createCallbackMessage(
      this.sessionId,
      requestId,
      callbackId,
      args
    );
    this.messenger.postMessage(message);
  }

  emitToRemote(eventName: KeyType, payload: any, transfer?: Transferable[]) {
    const message = createEventMessage(this.sessionId, eventName, payload);
    this.messenger.postMessage(message, transfer);
  }

  close() {
    this.removeMessengerListener();
    this.removeAllListeners();
  }
}

export type ParentHandshakeDispatcherEvents = {
  [x: number]: HandshakeResponseMessage;
};

export class ParentHandshakeDispatcher extends ConcreteEmitter<ParentHandshakeDispatcherEvents> {
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

export class ChildHandshakeDispatcher extends ConcreteEmitter<ChildHandshakeDispatcherEvents> {
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
