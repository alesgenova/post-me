import { MARKER, IdType } from './common';

export enum ProxyType {
  Callback = 'callback',
}

export interface BaseProxy<P extends ProxyType> {
  type: typeof MARKER;
  proxy: P;
}

export interface CallbackProxy extends BaseProxy<ProxyType.Callback> {
  callbackId: IdType;
}

export function createCallbackProxy(callbackId: IdType): CallbackProxy {
  return {
    type: MARKER,
    proxy: ProxyType.Callback,
    callbackId,
  };
}

export function isCallbackProxy(p: any): p is CallbackProxy {
  return p.type === MARKER && p.proxy === ProxyType.Callback;
}
