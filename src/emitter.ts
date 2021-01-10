import { EventsType } from './common';

export interface IEmitter<E extends EventsType> {
  addEventListener: <K extends keyof E>(
    eventName: K,
    listener: (data: E[K]) => void
  ) => void;
  removeEventListener: <K extends keyof E>(
    eventName: K,
    listener: (data: E[K]) => void
  ) => void;
  once: <K extends keyof E>(eventName: K) => Promise<E[K]>;
}

export class Emitter<E extends EventsType> implements IEmitter<E> {
  private _listeners: Partial<Record<keyof E, Set<(data: any) => void>>>;

  constructor() {
    this._listeners = {};
  }

  addEventListener<K extends keyof E>(
    eventName: K,
    listener: (data: E[K]) => void
  ) {
    let listeners = this._listeners[eventName];

    if (!listeners) {
      listeners = new Set();
      this._listeners[eventName] = listeners;
    }

    listeners.add(listener);
  }

  removeEventListener<K extends keyof E>(
    eventName: K,
    listener: (data: E[K]) => void
  ) {
    let listeners = this._listeners[eventName];

    if (!listeners) {
      return;
    }

    listeners.delete(listener);
  }

  once<K extends keyof E>(eventName: K): Promise<E[K]> {
    return new Promise((resolve) => {
      const listener = (data: E[K]) => {
        this.removeEventListener(eventName, listener);
        resolve(data);
      };

      this.addEventListener(eventName, listener);
    });
  }

  protected emit<K extends keyof E>(eventName: K, data: E[K]) {
    let listeners = this._listeners[eventName];

    if (!listeners) {
      return;
    }

    listeners.forEach((listener) => {
      listener(data);
    });
  }

  protected removeAllListeners() {
    Object.values(this._listeners).forEach((listeners) => {
      if (listeners) {
        listeners.clear();
      }
    });
  }
}
