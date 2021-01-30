import { EventsType } from './common';

/**
 * A simple event emitter interface used to implement the observer pattern throughout the codebase.
 *
 * @public
 *
 */
export interface Emitter<E extends EventsType> {
  /**
   * Add a listener to a specific event.
   *
   * @param eventName - The name of the event
   * @param listener - A listener function that takes as parameter the payload of the event
   */
  addEventListener<K extends keyof E>(
    eventName: K,
    listener: (data: E[K]) => void
  ): void;

  /**
   * Remove a listener from a specific event.
   *
   * @param eventName - The name of the event
   * @param listener - A listener function that had been added previously
   */
  removeEventListener<K extends keyof E>(
    eventName: K,
    listener: (data: E[K]) => void
  ): void;

  /**
   * Add a listener to a specific event, that will only be invoked once
   *
   * @remarks
   *
   * After the first occurrence of the specified event, the listener will be invoked and
   * immediately removed.
   *
   * @param eventName - The name of the event
   * @param listener - A listener function that had been added previously
   */
  once<K extends keyof E>(eventName: K): Promise<E[K]>;
}

/**
 * A concrete implementation of the {@link Emitter} interface
 *
 * @public
 */
export class ConcreteEmitter<E extends EventsType> implements Emitter<E> {
  private _listeners: Partial<Record<keyof E, Set<(data: any) => void>>>;

  constructor() {
    this._listeners = {};
  }

  /** {@inheritDoc Emitter.addEventListener} */
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

  /** {@inheritDoc Emitter.removeEventListener} */
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

  /** {@inheritDoc Emitter.once} */
  once<K extends keyof E>(eventName: K): Promise<E[K]> {
    return new Promise((resolve) => {
      const listener = (data: E[K]) => {
        this.removeEventListener(eventName, listener);
        resolve(data);
      };

      this.addEventListener(eventName, listener);
    });
  }

  /** @internal */
  protected emit<K extends keyof E>(eventName: K, data: E[K]) {
    let listeners = this._listeners[eventName];

    if (!listeners) {
      return;
    }

    listeners.forEach((listener) => {
      listener(data);
    });
  }

  /** @internal */
  protected removeAllListeners() {
    Object.values(this._listeners).forEach((listeners) => {
      if (listeners) {
        listeners.clear();
      }
    });
  }
}
