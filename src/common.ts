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

/**
 * @internal
 */
export type MethodsType = Record<KeyType, Callable<any[], ValueOrPromise<any>>>;

/**
 * @internal
 */
export type EventsType = Record<KeyType, any>;

/**
 * @internal
 */
export type Callable<A extends Array<any>, R> = (...args: A) => R;

/**
 * @internal
 */
export type ValueOrPromise<T> = T | Promise<T>;

/**
 * @internal
 */
export type InnerType<T extends ValueOrPromise<any>> = T extends Promise<
  infer U
>
  ? U
  : T;

export function createUniqueIdFn() {
  let __id = 0;
  return function () {
    const id = __id;
    __id += 1;
    return id;
  };
}
