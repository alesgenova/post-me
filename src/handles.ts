import { InnerType, MethodsType, EventsType } from './common';
import { Emitter, IEmitter } from './emitter';
import { Dispatcher } from './dispatcher';
import { MessageType, CallMessage, EventMessage } from './messages';

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
      const responseEvent = this._dispatcher.callOnRemote(
        methodName as string,
        ...args
      );
      this._dispatcher.once(responseEvent).then((response) => {
        const { result, error } = response;
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

      Promise.resolve(method(...args))
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
