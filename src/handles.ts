import { InnerType, MethodsType, EventsType } from './common';
import { Emitter, IEmitter } from './emitter';
import { Dispatcher } from './dispatcher';
import {
  MessageType,
  CallMessage,
  EventMessage,
  ResponseMessage,
  CallbackMessage,
} from './messages';
import { createCallbackProxy, isCallbackProxy } from './proxy';

export interface RemoteHandle<
  M extends MethodsType = MethodsType,
  E extends EventsType = EventsType
> extends IEmitter<E> {
  call: <K extends keyof M>(
    methodName: K,
    ...args: Parameters<M[K]>
  ) => Promise<InnerType<ReturnType<M[K]>>>;
}

export interface LocalHandle<E extends EventsType = EventsType> {
  emit: <K extends keyof E>(eventName: K, data: E[K]) => void;
}

export class ConcreteRemoteHandle<
    M extends MethodsType = MethodsType,
    E extends EventsType = EventsType
  >
  extends Emitter<E>
  implements RemoteHandle<M, E> {
  private _dispatcher: Dispatcher;

  constructor(dispatcher: Dispatcher) {
    super();

    this._dispatcher = dispatcher;

    this._dispatcher.addEventListener(
      MessageType.Event,
      this._handleEvent.bind(this)
    );
  }

  close() {
    this.removeAllListeners();
  }

  call<K extends keyof M>(
    methodName: K,
    ...args: Parameters<M[K]>
  ): Promise<InnerType<ReturnType<M[K]>>> {
    return new Promise((resolve, reject) => {
      const sanitizedArgs: any[] = [];
      const callbacks: Function[] = [];
      let callbackId = 0;
      args.forEach((arg) => {
        if (typeof arg === 'function') {
          callbacks.push(arg);
          sanitizedArgs.push(createCallbackProxy(callbackId));
          callbackId += 1;
        } else {
          sanitizedArgs.push(arg);
        }
      });

      const hasCallbacks = callbacks.length > 0;

      let callbackListener:
        | undefined
        | ((data: CallbackMessage<any>) => void) = undefined;

      if (hasCallbacks) {
        callbackListener = (data) => {
          const { callbackId, args } = data;
          callbacks[callbackId](...args);
        };
      }

      const { callbackEvent, responseEvent } = this._dispatcher.callOnRemote(
        methodName as string,
        sanitizedArgs
      );

      if (hasCallbacks) {
        this._dispatcher.addEventListener(
          callbackEvent,
          callbackListener as any
        );
      }

      this._dispatcher.once(responseEvent).then((response) => {
        if (callbackListener) {
          this._dispatcher.removeEventListener(
            callbackEvent,
            callbackListener as any
          );
        }

        const { result, error } = response as ResponseMessage<any>;

        if (error !== undefined) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  }

  private _handleEvent(data: EventMessage<any>) {
    const { eventName, payload } = data;
    this.emit(eventName, payload);
  }
}

export class ConcreteLocalHandle<
  M extends MethodsType = MethodsType,
  E extends EventsType = EventsType
> implements LocalHandle<E> {
  private _dispatcher: Dispatcher;
  private _methods: M;

  constructor(dispatcher: Dispatcher, localMethods: M) {
    this._dispatcher = dispatcher;
    this._methods = localMethods;

    this._dispatcher.addEventListener(
      MessageType.Call,
      this._handleCall.bind(this)
    );
  }

  emit<K extends keyof E>(eventName: K, payload: E[K]) {
    this._dispatcher.emitToRemote(eventName as string, payload);
  }

  private _handleCall(data: CallMessage<any[]>) {
    const { requestId, methodName, args } = data;

    const callMethod = new Promise<any>((resolve, reject) => {
      const method = this._methods[methodName];
      if (typeof method !== 'function') {
        reject(
          new Error(`The method "${methodName}" has not been implemented.`)
        );
        return;
      }

      const desanitizedArgs = args.map((arg) => {
        if (isCallbackProxy(arg)) {
          const { callbackId } = arg;
          return (...args: any[]) => {
            this._dispatcher.callbackToRemote(requestId, callbackId, args);
          };
        } else {
          return arg;
        }
      });

      Promise.resolve(method(...desanitizedArgs))
        .then(resolve)
        .catch(reject);
    });

    callMethod
      .then((value) => {
        this._dispatcher.respondToRemote(requestId, value);
      })
      .catch((error) => {
        this._dispatcher.respondToRemote(requestId, undefined, error);
      });
  }
}
