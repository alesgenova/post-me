import { IdType, KeyType, MARKER } from './common';

export enum MessageType {
  HandshakeRequest = 'handshake-request',
  HandshakeResponse = 'handshake-response',
  Call = 'call',
  Response = 'response',
  Error = 'error',
  Event = 'event',
  Callback = 'callback',
}

export interface Message<T extends MessageType> {
  type: typeof MARKER;
  action: T;
  sessionId: IdType;
}

export interface HandshakeRequestMessage
  extends Message<MessageType.HandshakeRequest> {}

export interface HandshakeResponseMessage
  extends Message<MessageType.HandshakeResponse> {}

export interface CallMessage<A extends Array<any>>
  extends Message<MessageType.Call> {
  requestId: IdType;
  methodName: KeyType;
  args: A;
}

export interface ResponseMessage<R> extends Message<MessageType.Response> {
  requestId: IdType;
  result?: R;
  error?: string;
}

export interface CallbackMessage<A extends Array<any>>
  extends Message<MessageType.Callback> {
  requestId: IdType;
  callbackId: IdType;
  args: A;
}

export interface EventMessage<P> extends Message<MessageType.Event> {
  eventName: KeyType;
  payload: P;
}

// Message Creators

export function createHandshakeRequestMessage(
  sessionId: IdType
): HandshakeRequestMessage {
  return {
    type: MARKER,
    action: MessageType.HandshakeRequest,
    sessionId,
  };
}

export function createHandshakeResponseMessage(
  sessionId: IdType
): HandshakeResponseMessage {
  return {
    type: MARKER,
    action: MessageType.HandshakeResponse,
    sessionId,
  };
}

export function createCallMessage<A extends Array<any>>(
  sessionId: IdType,
  requestId: IdType,
  methodName: KeyType,
  args: A
): CallMessage<A> {
  return {
    type: MARKER,
    action: MessageType.Call,
    sessionId,
    requestId,
    methodName,
    args,
  };
}

export function createResponsMessage<R>(
  sessionId: IdType,
  requestId: IdType,
  result: R,
  error?: string
): ResponseMessage<R> {
  const message: ResponseMessage<R> = {
    type: MARKER,
    action: MessageType.Response,
    sessionId,
    requestId,
  };

  if (result !== undefined) {
    message.result = result;
  }

  if (error !== undefined) {
    message.error = error;
  }

  return message;
}

export function createCallbackMessage<A extends Array<any>>(
  sessionId: IdType,
  requestId: IdType,
  callbackId: IdType,
  args: A
): CallbackMessage<A> {
  return {
    type: MARKER,
    action: MessageType.Callback,
    sessionId,
    requestId,
    callbackId,
    args,
  };
}

export function createEventMessage<P>(
  sessionId: IdType,
  eventName: KeyType,
  payload: P
): EventMessage<P> {
  return {
    type: MARKER,
    action: MessageType.Event,
    sessionId,
    eventName,
    payload,
  };
}

// Type Guards

export function isMessage(m: any): m is Message<any> {
  return m && m.type === MARKER;
}

export function isHandshakeRequestMessage(
  m: Message<any>
): m is HandshakeRequestMessage {
  return isMessage(m) && m.action === MessageType.HandshakeRequest;
}

export function isHandshakeResponseMessage(
  m: Message<any>
): m is HandshakeResponseMessage {
  return isMessage(m) && m.action === MessageType.HandshakeResponse;
}

export function isCallMessage(m: Message<any>): m is CallMessage<any[]> {
  return isMessage(m) && m.action === MessageType.Call;
}

export function isResponseMessage(m: Message<any>): m is ResponseMessage<any> {
  return isMessage(m) && m.action === MessageType.Response;
}

export function isCallbackMessage(m: Message<any>): m is CallbackMessage<any> {
  return isMessage(m) && m.action === MessageType.Callback;
}

export function isEventMessage(m: Message<any>): m is EventMessage<any> {
  return isMessage(m) && m.action === MessageType.Event;
}
