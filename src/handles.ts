import {
  InnerType,
  MethodsType,
  EventsType,
  EmitOptions,
  CallOptions,
} from './common';
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
  M extends MethodsType = any,
  E extends EventsType = any
> extends IEmitter<E> {
  call: <K extends keyof M>(
    methodName: K,
    ...args: Parameters<M[K]>
  ) => Promise<InnerType<ReturnType<M[K]>>>;
  customCall: <K extends keyof M>(
    methodName: K,
    args: Parameters<M[K]>,
    options?: CallOptions
  ) => Promise<InnerType<ReturnType<M[K]>>>;
  setCallTransfer: <K extends keyof M>(
    methodName: K,
    transfer: (...args: Parameters<M[K]>) => Transferable[]
  ) => void;
}

export interface LocalHandle<
  M extends MethodsType = any,
  E extends EventsType = any
> {
  emit: <K extends keyof E>(
    eventName: K,
    data: E[K],
    options?: EmitOptions
  ) => void;
  setReturnTransfer: <K extends keyof M>(
    methodName: K,
    transfer: (result: InnerType<ReturnType<M[K]>>) => Transferable[]
  ) => void;
  setEmitTransfer: <K extends keyof E>(
    eventName: K,
    transfer: (payload: E[K]) => Transferable[]
  ) => void;
}

export class ConcreteRemoteHandle<
    M extends MethodsType = any,
    E extends EventsType = any
  >
  extends Emitter<E>
  implements RemoteHandle<M, E> {
  private _dispatcher: Dispatcher;
  private _callTransfer: { [x: string]: (...args: any) => Transferable[] };

  constructor(dispatcher: Dispatcher) {
    super();

    this._dispatcher = dispatcher;
    this._callTransfer = {};

    this._dispatcher.addEventListener(
      MessageType.Event,
      this._handleEvent.bind(this)
    );
  }

  close() {
    this.removeAllListeners();
  }

  setCallTransfer<K extends keyof M>(
    methodName: K,
    transfer: (...args: Parameters<M[K]>) => Transferable[]
  ) {
    this._callTransfer[methodName as string] = transfer;
  }

  call<K extends keyof M>(
    methodName: K,
    ...args: Parameters<M[K]>
  ): Promise<InnerType<ReturnType<M[K]>>> {
    return this.customCall(methodName, args);
  }

  customCall<K extends keyof M>(
    methodName: K,
    args: Parameters<M[K]>,
    options: CallOptions = {}
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

      let transfer: Transferable[] | undefined = options.transfer;
      if (transfer === undefined && this._callTransfer[methodName as string]) {
        transfer = this._callTransfer[methodName as string](...sanitizedArgs);
      }

      const { callbackEvent, responseEvent } = this._dispatcher.callOnRemote(
        methodName as string,
        sanitizedArgs,
        transfer
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
  M extends MethodsType = any,
  E extends EventsType = any
> implements LocalHandle<M, E> {
  private _dispatcher: Dispatcher;
  private _methods: M;
  private _returnTransfer: { [x: string]: (result: any) => Transferable[] };
  private _emitTransfer: { [x: string]: (payload: any) => Transferable[] };

  constructor(dispatcher: Dispatcher, localMethods: M) {
    this._dispatcher = dispatcher;
    this._methods = localMethods;
    this._returnTransfer = {};
    this._emitTransfer = {};

    this._dispatcher.addEventListener(
      MessageType.Call,
      this._handleCall.bind(this)
    );
  }

  emit<K extends keyof E>(
    eventName: K,
    payload: E[K],
    options: EmitOptions = {}
  ) {
    let transfer: Transferable[] | undefined = options.transfer;
    if (transfer === undefined && this._emitTransfer[eventName as string]) {
      transfer = this._emitTransfer[eventName as string](payload);
    }

    this._dispatcher.emitToRemote(eventName as string, payload, transfer);
  }

  setReturnTransfer<K extends keyof M>(
    methodName: K,
    transfer: (result: InnerType<ReturnType<M[K]>>) => Transferable[]
  ) {
    this._returnTransfer[methodName as string] = transfer;
  }

  setEmitTransfer<K extends keyof E>(
    eventName: K,
    transfer: (payload: E[K]) => Transferable[]
  ) {
    this._emitTransfer[eventName as string] = transfer;
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
      .then((result) => {
        let transfer: Transferable[] | undefined;
        if (this._returnTransfer[methodName]) {
          transfer = this._returnTransfer[methodName](result);
        }

        this._dispatcher.respondToRemote(
          requestId,
          result,
          undefined,
          transfer
        );
      })
      .catch((error) => {
        this._dispatcher.respondToRemote(requestId, undefined, error);
      });
  }
}
