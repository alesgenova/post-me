import { IdType, InnerType } from './common';
import { LocalHandle, RemoteHandle, MethodsType, EventsType } from './handle';
import {
  Message,
  createCallMessage,
  createErrorMessage,
  createResponsMessage,
  isCallMessage,
  isMessage,
  isResponseMessage,
  createEventMessage,
  isEventMessage,
  isErrorMessage,
} from './message';

export interface Connection<
  E0 extends EventsType = {},
  M1 extends MethodsType = {},
  E1 extends EventsType = {}
> {
  sessionId: () => IdType;
  localHandle: () => LocalHandle<E0>;
  remoteHandle: () => RemoteHandle<M1, E1>;
  destroy: () => void;
}

type PromiseMethods<T = any, E = any> = {
  resolve: (v: T) => void;
  reject: (e: E) => void;
};

export class ConcreteConnection<M0 extends MethodsType> implements Connection {
  private _localMethods: M0;
  private _postMessage: (message: Message<any>) => void;
  private _addMessageListener: (
    listener: (event: MessageEvent) => void
  ) => () => void;
  private _removeMainListener: () => void;
  private _sessionId: IdType;
  private _localHandle: LocalHandle;
  private _remoteHandle: RemoteHandle;
  private _requests: Record<IdType, PromiseMethods>;
  private _eventListeners: Record<string, Set<(data: any) => void>>;

  constructor(
    localMethods: M0,
    postMessage: (message: Message<any>) => void,
    addMessageListener: (listener: (event: MessageEvent) => void) => () => void,
    sessionId: number
  ) {
    this._localMethods = localMethods;
    this._postMessage = postMessage;
    this._addMessageListener = addMessageListener;
    this._sessionId = sessionId;
    this._requests = {};
    this._eventListeners = {};

    this._localHandle = {
      emit: this.localEmit,
    };

    this._remoteHandle = {
      call: this.remoteCall,
      addEventListener: this.remoteAddEventListener,
      removeEventListener: this.remoteRemoveEventListener,
    };

    this._removeMainListener = this._addMessageListener(this.onMessage);
  }

  localHandle() {
    return this._localHandle;
  }

  remoteHandle() {
    return this._remoteHandle;
  }

  sessionId() {
    return this._sessionId;
  }

  destroy() {
    this._removeMainListener();
  }

  private onMessage = (ev: MessageEvent) => {
    const { data } = ev;

    if (!isMessage(data)) {
      return;
    }

    if (data.sessionId !== this.sessionId()) {
      return;
    }

    if (isCallMessage(data)) {
      const { requestId, name, args } = data;
      (this.localCall as any)(name, ...args)
        .then((value: any) => {
          const message = createResponsMessage(
            this.sessionId(),
            requestId,
            value
          );
          this.sendMessage(message);
        })
        .catch((e: any) => {
          const message = createErrorMessage(this.sessionId(), requestId, e);
          this.sendMessage(message);
        });
    } else if (isResponseMessage(data)) {
      const { requestId, result } = data;
      const promiseMethods = this._requests[requestId];
      if (!promiseMethods) {
        return;
      }

      promiseMethods.resolve(result);

      delete this._requests[requestId];

      return;
    } else if (isEventMessage(data)) {
      const { name, payload } = data;
      const listeners = this._eventListeners[name];
      if (!listeners) {
        return;
      }

      for (let listener of listeners) {
        listener(payload);
      }

      return;
    } else if (isErrorMessage(data)) {
      const { requestId, error } = data;
      const promiseMethods = this._requests[requestId];
      if (!promiseMethods) {
        return;
      }

      promiseMethods.reject(error);

      delete this._requests[requestId];

      return;
    }
  };

  private localEmit = (eventName: string, data: any) => {
    const message = createEventMessage(
      this.sessionId(),
      eventName as string,
      data
    );
    this.sendMessage(message);
  };

  private remoteCall = (methodName: string, ...args: any[]) => {
    return new Promise<any>((resolve, reject) => {
      const requestId = this.uniqueRequestId();
      this._requests[requestId] = { resolve, reject };
      const message = createCallMessage(
        this.sessionId(),
        requestId,
        methodName as string,
        ...args
      );
      this.sendMessage(message);
    });
  };

  private localCall: <K extends keyof M0>(
    methodName: K,
    ...args: Parameters<M0[K]>
  ) => Promise<InnerType<ReturnType<M0[K]>>> = (methodName, ...args) => {
    return new Promise((resolve, reject) => {
      const method = this._localMethods[methodName];
      if (!method) {
        reject(
          new Error(`The method "${methodName}" has not been implemented.`)
        );
        return;
      }

      Promise.resolve(method(...args))
        .then((val) => resolve(val))
        .catch((e) => reject(e));
    });
  };

  private remoteAddEventListener = (
    eventName: string,
    callback: (data: any) => void
  ) => {
    let listeners = this._eventListeners[eventName as string];
    if (!listeners) {
      listeners = new Set();
      this._eventListeners[eventName as string] = listeners;
    }

    listeners.add(callback);
  };

  private remoteRemoveEventListener = (
    eventName: string,
    callback: (data: any) => void
  ) => {
    let listeners = this._eventListeners[eventName as string];
    if (!listeners) {
      return;
    }

    listeners.delete(callback);
  };

  private sendMessage(message: Message<any>) {
    this._postMessage(message);
  }

  private uniqueRequestId: () => IdType = (() => {
    let __requestId = 0;
    return () => {
      const requestId = __requestId;
      __requestId += 1;
      return requestId;
    };
  })();
}
