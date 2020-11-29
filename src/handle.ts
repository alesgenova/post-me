import { Callable, ValueOrPromise, InnerType } from './common';

export type MethodsType = Required<
  Record<string, Callable<any[], ValueOrPromise<any>>>
>;

export type EventsType = Record<string, any>;

export interface RemoteHandle<
  M extends MethodsType = {},
  E extends EventsType = {}
> {
  call: <K extends keyof M>(
    methodName: K,
    ...args: Parameters<M[K]>
  ) => Promise<InnerType<ReturnType<M[K]>>>;
  addEventListener: <K extends keyof E>(
    eventName: K,
    callback: (data: E[K]) => void
  ) => void;
  removeEventListener: <K extends keyof E>(
    eventName: K,
    callback: (data: E[K]) => void
  ) => void;
}

export interface LocalHandle<E extends EventsType = {}> {
  emit: <K extends keyof E>(eventName: K, data: E[K]) => void;
}
