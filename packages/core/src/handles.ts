import {
  InnerType,
  MethodsType,
  EventsType,
  EmitOptions,
  CallOptions,
} from './common';
import { Emitter, ConcreteEmitter } from './emitter';
import { Dispatcher } from './dispatcher';
import {
  MessageType,
  CallMessage,
  EventMessage,
  ResponseMessage,
  CallbackMessage,
} from './messages';
import { createCallbackProxy, isCallbackProxy } from './proxy';

/**
 * A handle to the other end of the connection
 *
 * @remarks
 *
 * Use this handle to:
 *
 *   - Call methods exposed by the other end
 *
 *   - Add listeners to custom events emitted by the other end
 *
 * @typeParam M - The methods exposed by the other context
 * @typeParam E - The events exposed by the other context
 *
 * @public
 *
 */
export interface RemoteHandle<
  M extends MethodsType = any,
  E extends EventsType = any
> extends Emitter<E> {
  /**
   * Call a method exposed by the other end.
   *
   * @param methodName - The name of the method
   * @param args - The list of arguments passed to the method
   * @returns A Promise of the value returned by the method
   *
   */
  call<K extends keyof M>(
    methodName: K,
    ...args: Parameters<M[K]>
  ): Promise<InnerType<ReturnType<M[K]>>>;

  /**
   * Call a method exposed by the other end.
   *
   * @param methodName - The name of the method
   * @param args - The list of arguments passed to the method
   * @param options - The {@link CallOptions} to customize this method call
   * @returns A Promise of the value returned by the method
   *
   */
  customCall<K extends keyof M>(
    methodName: K,
    args: Parameters<M[K]>,
    options?: CallOptions
  ): Promise<InnerType<ReturnType<M[K]>>>;

  /**
   * Specify which parts of the arguments of a given method call should be transferred
   * into the other context instead of cloned.
   *
   * @remarks
   *
   * You only need to call setCallTransfer once per method. After the transfer function is set,
   * it will automatically be used by all subsequent calls to the specified method.
   *
   * @param methodName - The name of the method
   * @param transfer - A function that takes as parameters the arguments of a method call, and returns a list of transferable objects.
   *
   */
  setCallTransfer<K extends keyof M>(
    methodName: K,
    transfer: (...args: Parameters<M[K]>) => Transferable[]
  ): void;
}

/**
 * A handle to the local end of the connection
 *
 * @remarks
 *
 * Use this handle to:
 *
 * - Emit custom events to the other end
 *
 * - Set the methods that are exposed to the other end
 *
 * @typeParam M - The methods exposed by this context
 * @typeParam E - The events exposed by this context
 *
 * @public
 *
 */
export interface LocalHandle<
  M extends MethodsType = any,
  E extends EventsType = any
> {
  /**
   * Emit a custom event with a payload. The event can be captured by the other context.
   *
   * @param eventName - The name of the event
   * @param data - The payload associated with the event
   * @param options - The {@link EmitOptions} to customize this emit call
   *
   */
  emit<K extends keyof E>(
    eventName: K,
    data: E[K],
    options?: EmitOptions
  ): void;

  /**
   * Set the methods that will be exposed to the other end of the connection.
   *
   * @param methods - An object mapping method names to functions
   *
   */
  setMethods(methods: M): void;

  /**
   * Set a specific method that will be exposed to the other end of the connection.
   *
   * @param methodName - The name of the method
   * @param method - The function that will be exposed
   *
   */
  setMethod<K extends keyof M>(methodName: K, method: M[K]): void;

  /**
   * Specify which parts of the return value of a given method call should be transferred
   * into the other context instead of cloned.
   *
   * @remarks
   *
   * You only need to call setReturnTransfer once per method. After the transfer function is set,
   * it will automatically be used every time a value is returned by the specified method.
   *
   * @param methodName - The name of the method
   * @param transfer - A function that takes as parameter the return value of a method call, and returns a list of transferable objects.
   *
   */
  setReturnTransfer<K extends keyof M>(
    methodName: K,
    transfer: (result: InnerType<ReturnType<M[K]>>) => Transferable[]
  ): void;

  /**
   * Specify which parts of the payload of a given event should be transferred
   * into the other context instead of cloned.
   *
   * @remarks
   *
   * You only need to call setEmitTransfer once per event type. After the transfer function is set,
   * it will automatically be used every time a payload is attached to the specific event.
   *
   * @param eventName - The name of the method
   * @param transfer - A function that takes as parameter the payload of an event, and returns a list of transferable objects.
   *
   */
  setEmitTransfer<K extends keyof E>(
    eventName: K,
    transfer: (payload: E[K]) => Transferable[]
  ): void;
}

export class ConcreteRemoteHandle<
    M extends MethodsType = any,
    E extends EventsType = any
  >
  extends ConcreteEmitter<E>
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

  setMethods(methods: M) {
    this._methods = methods;
  }

  setMethod<K extends keyof M>(methodName: K, method: M[K]) {
    this._methods[methodName] = method;
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

      Promise.resolve(this._methods[methodName](...desanitizedArgs))
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
