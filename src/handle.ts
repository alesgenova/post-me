import { InnerType, MethodsType, EventsType } from './common';
import { Emitter, IEmitter } from './emitter';

export interface RemoteHandle<
  M extends MethodsType = MethodsType,
  E extends EventsType = EventsType
> extends IEmitter<E> {
  call: <K extends keyof M>(
    methodName: K,
    ...args: Parameters<M[K]>
  ) => Promise<InnerType<ReturnType<M[K]>>>;
}

export class ConcreteRemoteHandle<
    M extends MethodsType = MethodsType,
    E extends EventsType = EventsType
  >
  extends Emitter<E>
  implements RemoteHandle<M, E> {
  public call;

  constructor(callFn: RemoteHandle<M, E>['call']) {
    super();
    this.call = callFn;
  }
}

export interface LocalHandle<E extends EventsType = EventsType> {
  emit: <K extends keyof E>(eventName: K, data: E[K]) => void;
}

export class ConcreteLocalHandle<E extends EventsType = EventsType>
  implements LocalHandle<E> {
  public emit;

  constructor(emitFn: LocalHandle<E>['emit']) {
    this.emit = emitFn;
  }
}
