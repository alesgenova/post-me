import { MethodsType, EventsType } from './common';
import { Dispatcher } from './dispatcher';
import {
  ConcreteLocalHandle,
  ConcreteRemoteHandle,
  LocalHandle,
  RemoteHandle,
} from './handles';

/**
 * An active connection between two contexts
 *
 * @typeParam M0 - The methods exposed by this context
 * @typeParam E0 - The events exposed by this context
 * @typeParam M1 - The methods exposed by the other context
 * @typeParam E1 - The events exposed by the other context
 *
 * @public
 *
 */
export interface Connection<
  M0 extends MethodsType = any,
  E0 extends EventsType = any,
  M1 extends MethodsType = any,
  E1 extends EventsType = any
> {
  /**
   * Get a handle to the local end of the connection
   *
   * @returns A {@link LocalHandle} to the local side of the Connection
   */
  localHandle(): LocalHandle<M0, E0>;

  /**
   * Get a handle to the other end of the connection
   *
   * @returns A {@link RemoteHandle} to the other side of the Connection
   */
  remoteHandle(): RemoteHandle<M1, E1>;

  /**
   * Stop listening to incoming message from the other side
   */
  close(): void;
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
