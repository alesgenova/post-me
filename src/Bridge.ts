import _get from 'lodash.get';

import { TEvents, TModel, InnerType } from './common';

import debugFactory from './debug';

import { Dispatcher } from './dispatcher';
import { TCallMessage, TEventMessage, TResponseMessage } from './msg/native';
import { CALL_REQUEST, REMOTE_EVENT } from './msg/dispatcher';

// TODO this also needs to be an instance variable
const debug = debugFactory('ibridge:Bridge');

export interface IBridge<
  E0 extends TEvents = {},
  M1 extends TModel = {},
  E1 extends TEvents = {}
> {
  call: <K extends keyof M1>(
    methodName: K,
    ...args: Parameters<M1[K]>
  ) => Promise<InnerType<ReturnType<M1[K]>>>;
  addEventListener: <K extends keyof E1>(
    eventName: K,
    callback: (data: E1[K]) => void
  ) => void;
  removeEventListener: <K extends keyof E1>(
    eventName: K,
    callback: (data: E1[K]) => void
  ) => void;
  emit: <K extends keyof E0>(eventName: K, data: E0[K]) => void;
}

export class Bridge<M extends TModel = {}> implements IBridge {
  private dispatcher: Dispatcher;
  private model: M;
  private eventListeners: Record<string, Set<(data: any) => void>>;

  constructor(dispatcher: Dispatcher, model: M) {
    this.dispatcher = dispatcher;
    this.model = model;
    this.eventListeners = {};

    this.dispatcher.on(CALL_REQUEST, this.handleCall.bind(this));
    this.dispatcher.on(REMOTE_EVENT, this.handleEvent.bind(this));
  }

  async call(methodName: string, ...args: any[]) {
    const responseEvent = this.dispatcher.callOnRemote(methodName, ...args);
    const response: TResponseMessage<any>['data'] = await this.dispatcher.once(
      responseEvent
    );
    const { value, error } = response;
    if (error) {
      throw new Error(value);
    }

    return value;
  }

  emit(eventName: string, data: any) {
    this.dispatcher.emitToRemote(eventName, data);
  }

  addEventListener(eventName: string, listener: (data: any) => void) {
    let listeners = this.eventListeners[eventName];
    if (!listeners) {
      listeners = new Set();
      this.eventListeners[eventName] = listeners;
    }

    listeners.add(listener);
  }

  removeEventListener(eventName: string, listener: (data: any) => void) {
    let listeners = this.eventListeners[eventName];
    if (!listeners) {
      return;
    }

    listeners.delete(listener);
  }

  private async handleCall(data: TCallMessage<any[]>['data']): Promise<void> {
    const { requestId, methodName, args } = data;
    // property might be a full lodash path
    const fn = _get(this.model, methodName);

    let value: any;
    let error = false;
    try {
      if (typeof fn !== 'function') {
        debug(
          `the model ${methodName} was called, but it isn't a function, got ${fn}`
        );
        throw new Error(`model function "${methodName}" not found`);
      }
      value = await fn(...args);
    } catch (err) {
      error = true;
      value = err && err.message ? err.message : err;
    }

    this.dispatcher.respondToRemote(requestId, value, error);
  }

  handleEvent(data: TEventMessage<any>['data']) {
    const { eventName, payload } = data;
    const listeners = this.eventListeners[eventName];
    if (!listeners) {
      return;
    }

    for (let listener of listeners) {
      listener(payload);
    }
  }
}
