import { MethodsType, EventsType } from './common';
import { Dispatcher } from './dispatcher';
import {
  ConcreteLocalHandle,
  ConcreteRemoteHandle,
  LocalHandle,
  RemoteHandle,
} from './handles';

export interface Connection<
  M0 extends MethodsType = any,
  E0 extends EventsType = any,
  M1 extends MethodsType = any,
  E1 extends EventsType = any
> {
  localHandle: () => LocalHandle<M0, E0>;
  remoteHandle: () => RemoteHandle<M1, E1>;
  close: () => void;
}

export class ConcreteConnection<M0 extends MethodsType> implements Connection {
  private _dispatcher: Dispatcher;
  private _remoteHandle: ConcreteRemoteHandle;
  private _localHandle: ConcreteLocalHandle;

  constructor(dispatcher: Dispatcher, localMethods: M0) {
    this._dispatcher = dispatcher;
    this._localHandle = new ConcreteLocalHandle<M0, any>(
      dispatcher,
      localMethods
    );
    this._remoteHandle = new ConcreteRemoteHandle<any, any>(dispatcher);
  }

  close() {
    this._dispatcher.close();
    this.remoteHandle().close();
  }

  localHandle() {
    return this._localHandle;
  }

  remoteHandle() {
    return this._remoteHandle;
  }
}
