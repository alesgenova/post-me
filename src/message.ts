import { IdType } from './common';

export enum MessageType {
  Handshake = '@post-me/handshake',
  Call = '@post-me/call',
  Response = '@post-me/response',
  Error = '@post-me/error',
  Event = '@post-me/event',
}

export interface Message<T extends MessageType> {
  sessionId: IdType;
  type: T;
}

export interface HandshakeMessage extends Message<MessageType.Handshake> {
  requestId: IdType;
}

export interface CallMessage<A extends Array<any>>
  extends Message<MessageType.Call> {
  requestId: IdType;
  name: string;
  args: A;
}

export interface ResponseMessage<R> extends Message<MessageType.Response> {
  requestId: IdType;
  result: R;
}

export interface ErrorMessage extends Message<MessageType.Error> {
  requestId: IdType;
  error: string;
}

export interface EventMessage<P> extends Message<MessageType.Event> {
  name: string;
  payload: P;
}

// Message Creators

export function createHandshakeMessage(sessionId: IdType): HandshakeMessage {
  return {
    type: MessageType.Handshake,
    sessionId,
    requestId: sessionId,
  };
}

export function createCallMessage<A extends Array<any>>(
  sessionId: IdType,
  requestId: IdType,
  name: string,
  ...args: A
): CallMessage<A> {
  return {
    type: MessageType.Call,
    sessionId,
    requestId,
    name,
    args,
  };
}

export function createResponsMessage<R>(
  sessionId: IdType,
  requestId: IdType,
  result: R
): ResponseMessage<R> {
  return {
    type: MessageType.Response,
    sessionId,
    requestId,
    result,
  };
}

export function createErrorMessage(
  sessionId: IdType,
  requestId: IdType,
  error: string
): ErrorMessage {
  return {
    type: MessageType.Error,
    sessionId,
    requestId,
    error,
  };
}

export function createEventMessage<P>(
  sessionId: IdType,
  name: string,
  payload: P
): EventMessage<P> {
  return {
    type: MessageType.Event,
    sessionId,
    name,
    payload,
  };
}

// Type Guards

export function isMessage(m: any): m is Message<any> {
  return (
    (m as Message<any>).type !== undefined &&
    (m as Message<any>).sessionId !== undefined
  );
}

export function isHandshakeMessage(m: Message<any>): m is HandshakeMessage {
  return (
    isMessage(m) &&
    m.type === MessageType.Handshake &&
    (m as HandshakeMessage).requestId !== undefined
  );
}

export function isCallMessage(m: Message<any>): m is CallMessage<any[]> {
  return (
    isMessage(m) &&
    m.type === MessageType.Call &&
    (m as CallMessage<any[]>).requestId !== undefined &&
    (m as CallMessage<any[]>).name !== undefined &&
    Array.isArray((m as CallMessage<any[]>).args)
  );
}

export function isResponseMessage(m: Message<any>): m is ResponseMessage<any> {
  return (
    isMessage(m) &&
    m.type === MessageType.Response &&
    (m as ResponseMessage<any>).requestId !== undefined
  );
}

export function isErrorMessage(m: Message<any>): m is ErrorMessage {
  return (
    isMessage(m) &&
    m.type === MessageType.Error &&
    (m as ErrorMessage).requestId !== undefined &&
    (m as ErrorMessage).error !== undefined
  );
}

export function isEventMessage(m: Message<any>): m is EventMessage<any> {
  return isMessage(m) && m.type === MessageType.Event;
}
