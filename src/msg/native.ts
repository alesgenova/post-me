import { IdType } from '../common';

export const IBRIDGE_MARKER = '@ibridge';

export enum MessageType {
  HandshakeRequest = 'handshakeRequest',
  HandshakeResponse = 'handshakeResponse',
  Call = 'call',
  Response = 'response',
  Event = 'event',
}

// TODO better name
/**
 * This is the raw payload we send through
 * postMessage message.data, inside of it
 * we have the inner higher level event information
 */
export type TNativeMessage<N = MessageType, T = unknown> = {
  /* simple ibridge marker for all ibridge events */
  type: typeof IBRIDGE_MARKER;
  /* id for the connection between a given pair of bridges */
  sessionId: string;
  /* the type of action this message encodes (handshake, call, respond, emit, ...) */
  name: N;
  /* any data attached to the message */
  data: T;
};

export type THandshakeRequestMessage = TNativeMessage<
  MessageType.HandshakeRequest,
  void
>;

export type THandshakeResponseMessage = TNativeMessage<
  MessageType.HandshakeResponse,
  void
>;

export type TCallMessage<A extends Array<any>> = TNativeMessage<
  MessageType.Call,
  {
    requestId: IdType;
    methodName: string;
    args: A;
  }
>;

export type TResponseMessage<R> = TNativeMessage<
  MessageType.Response,
  {
    requestId: IdType;
    value: R;
    error: boolean;
  }
>;

export type TEventMessage<P> = TNativeMessage<
  MessageType.Event,
  {
    eventName: string;
    payload: P;
  }
>;

// Message Creators

export function createHandshakeRequestMessage(
  sessionId: IdType
): THandshakeRequestMessage {
  return {
    type: IBRIDGE_MARKER,
    name: MessageType.HandshakeRequest,
    sessionId,
    data: undefined,
  };
}

export function createHandshakeResponseMessage(
  sessionId: IdType
): THandshakeResponseMessage {
  return {
    type: IBRIDGE_MARKER,
    name: MessageType.HandshakeResponse,
    sessionId,
    data: undefined,
  };
}

export function createCallMessage<A extends Array<any>>(
  sessionId: IdType,
  requestId: IdType,
  methodName: string,
  ...args: A
): TCallMessage<A> {
  return {
    type: IBRIDGE_MARKER,
    name: MessageType.Call,
    sessionId,
    data: {
      requestId,
      methodName,
      args,
    },
  };
}

export function createResponsMessage<R>(
  sessionId: IdType,
  requestId: IdType,
  value: R,
  error: boolean
): TResponseMessage<R> {
  return {
    type: IBRIDGE_MARKER,
    name: MessageType.Response,
    sessionId,
    data: {
      requestId,
      value,
      error,
    },
  };
}

export function createEventMessage<P>(
  sessionId: IdType,
  eventName: string,
  payload: P
): TEventMessage<P> {
  return {
    type: IBRIDGE_MARKER,
    name: MessageType.Event,
    sessionId,
    data: {
      eventName,
      payload,
    },
  };
}

// Type Guards

export function isNativeMessage(m: any): m is TNativeMessage {
  return m.type === IBRIDGE_MARKER && m.sessionId !== undefined;
}

export function isHandshakeRequestMessage(
  m: TNativeMessage
): m is THandshakeRequestMessage {
  return isNativeMessage(m) && m.name === MessageType.HandshakeRequest;
}

export function isHandshakeResponseMessage(
  m: TNativeMessage
): m is THandshakeResponseMessage {
  return isNativeMessage(m) && m.name === MessageType.HandshakeResponse;
}

export function isCallMessage(m: TNativeMessage): m is TCallMessage<any[]> {
  return isNativeMessage(m) && m.name === MessageType.Call;
}

export function isResponseMessage(
  m: TNativeMessage
): m is TResponseMessage<any> {
  return isNativeMessage(m) && m.name === MessageType.Response;
}

export function isEventMessage(m: TNativeMessage): m is TEventMessage<any> {
  return isNativeMessage(m) && m.name === MessageType.Event;
}
