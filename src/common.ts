export type IdType = string;

export type TModel = Required<
  Record<string, Callable<any[], ValueOrPromise<any>>>
>;

export type TEvents = Record<string, any>;

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
