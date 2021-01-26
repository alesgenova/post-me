export const MARKER = '@post-me';

export type IdType = number;
export type KeyType = string;

/**
 * The options that can be passed when calling a method on the other context with RemoteHandle.customCall()
 *
 * @public
 *
 */
export type CallOptions = {
  transfer?: Transferable[];
};

/**
 * The options that can be passed when emitting an event to the other context with LocalHandle.emit()
 *
 * @public
 *
 */
export type EmitOptions = {
  transfer?: Transferable[];
};

export type MethodsType = Record<KeyType, Callable<any[], ValueOrPromise<any>>>;

export type EventsType = Record<KeyType, any>;

export type Callable<A extends Array<any>, R> = (...args: A) => R;

export type ValueOrPromise<T> = T | Promise<T>;

export type InnerType<T extends ValueOrPromise<any>> = T extends Promise<
  infer U
>
  ? U
  : T;

export type ArgumentsType<T extends Callable<any[], any>> = T extends Callable<
  infer A,
  any
>
  ? A
  : [];

export type ReturnType<T extends Callable<any[], any>> = T extends Callable<
  any,
  infer R
>
  ? R
  : any;

export type ItemType<T> = T extends (...args: any) => ValueOrPromise<unknown>
  ? InnerType<ReturnType<T>>
  : InnerType<T>;

export type ItemArgs<T> = T extends (
  ...args: infer A
) => ValueOrPromise<unknown>
  ? A
  : [];

export function createUniqueIdFn() {
  let __id = 0;
  return function () {
    const id = __id;
    __id += 1;
    return id;
  };
}
