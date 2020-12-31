export const CALL_REQUEST = '@ibridge/CallRequest';
export const CALL_RESPONSE = '@ibridge/CallResponse';

export interface ICallRequest<TArgs extends Array<any>> {
  /* the remote method call id */
  callId: string;
  /* model property */
  property: string;
  /* arguments */
  args: TArgs;
}

export function createCallRequest<TArgs extends Array<any>>(
  data: ICallRequest<TArgs>
): [eventName: string, data: ICallRequest<TArgs>] {
  const eventName = CALL_REQUEST;

  return [eventName, data];
}

export interface ICallResponse<TReturn, TError = any> {
  /* the remote method call id */
  callId: string;
  /* model property */
  property: string;
  /* the return value */
  value?: TReturn;
  /* the error thrown by the method */
  error?: TError;
}

export function createCallResponseEventName(callId: string): string {
  return `${CALL_RESPONSE}/${callId}`;
}

export function createCallResponse<TReturn>(
  data: ICallResponse<TReturn>
): [eventName: string, data: ICallResponse<TReturn>] {
  const eventName = createCallResponseEventName(data.callId);

  return [eventName, data];
}
