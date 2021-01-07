import { MethodsType, EventsType, KeyType } from './common';
import { Dispatcher } from './dispatcher';
import {
  LocalHandle,
  RemoteHandle,
  ConcreteRemoteHandle,
  ConcreteLocalHandle,
} from './handle';
import { MessageType, CallMessage, EventMessage } from './messages';

export interface Connection<
  E0 extends EventsType = EventsType,
  M1 extends MethodsType = MethodsType,
  E1 extends EventsType = EventsType
> {
  localHandle: () => LocalHandle<E0>;
  remoteHandle: () => RemoteHandle<M1, E1>;
}

export class ConcreteConnection<M0 extends MethodsType> implements Connection {
  private dispatcher: Dispatcher;
  private methods: M0;
  private _remoteHandle: ConcreteRemoteHandle;
  private _localHandle: ConcreteLocalHandle;

  constructor(dispatcher: Dispatcher, localMethods: M0) {
    this.dispatcher = dispatcher;
    this.methods = localMethods;
    this._remoteHandle = new ConcreteRemoteHandle(
      this.callRemoteMethod.bind(this)
    );
    this._localHandle = new ConcreteLocalHandle(
      this.dispatcher.emitToRemote.bind(this.dispatcher)
    );

    this.dispatcher.addEventListener(
      MessageType.Call,
      this.handleCall.bind(this)
    );
    this.dispatcher.addEventListener(
      MessageType.Event,
      this.handleEvent.bind(this)
    );
  }

  localHandle() {
    return this._localHandle;
  }

  remoteHandle() {
    return this._remoteHandle;
  }

  private handleCall(data: CallMessage<any[]>) {
    const { requestId, methodName, args } = data;

    const callMethod = new Promise<any>((resolve, reject) => {
      const method = this.methods[methodName];
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
        this.dispatcher.respondToRemote(requestId, value);
      })
      .catch((error) => {
        this.dispatcher.respondToRemote(requestId, undefined, error);
      });
  }

  private handleEvent(data: EventMessage<any>) {
    const { eventName, payload } = data;
    (this._remoteHandle as any).emit(eventName, payload);
  }

  private callRemoteMethod(methodName: KeyType, ...args: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const responseEvent = this.dispatcher.callOnRemote(methodName, ...args);
      this.dispatcher.once(responseEvent).then((response) => {
        const { result, error } = response;
        if (error !== undefined) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  }
}
