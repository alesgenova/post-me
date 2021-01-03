import { v4 as uuid } from 'uuid';

import debugFactory from './debug';
import { Bridge, IBridge } from './Bridge';
import { TModel } from './common';
import { Dispatcher } from './dispatcher';
import { IMessenger } from './messenger';

// TODO make this an instance variable, include the sessionId
const debug = debugFactory('ibridge:parent');

// Since all the communication capabilities are inside of the Bridge class
// this Parent class now only needs to deal with the handshake.
// In fact, consumers that might not care about a handshake might use
// Bridge directly, or perhaps they want to build their own handshake logic
// with the communication primitives that Bridge already provides.
//
// TODO perhaps this can be renamed to something else?
// THe main purpose of calling it Parent or Server is that
// this is the thing that "initializes" the handshake process.
export class Parent<M extends TModel> {
  /**
   * The maximum number of attempts to send a handshake request to the parent
   */
  static maxHandshakeRequests = 5;
  messenger: IMessenger;
  model: M;

  constructor(messenger: IMessenger, model: M) {
    this.messenger = messenger;
    this.model = model;
  }

  async handshake(): Promise<IBridge> {
    debug('starting handshake');
    let attempt = 0;
    const dispatcher = new Dispatcher(this.messenger);
    const sessionId = uuid();

    const tryHandshake = async () => {
      while (attempt < Parent.maxHandshakeRequests) {
        attempt++;
        debug(`handshake attempt %s %s`, attempt, this.messenger);
        const responseEvent = dispatcher.initiateHandshake(sessionId);

        try {
          await Promise.race([dispatcher.once(responseEvent), timeout(500)]);
        } catch (err) {
          // this should only happen if the timeout is reached, try again
          dispatcher.clearListeners(responseEvent);
          continue;
        }

        debug('Received handshake reply from Child');
        // Clean up any outstanding handhsake reply "once" listeners
        dispatcher.clearListeners(responseEvent);
        return;
      }

      throw new Error('maximum handshake attempts reached');
    };

    await tryHandshake();
    debug('handshake ok');
    return new Bridge(dispatcher, this.model);
  }
}

export function timeout(ms: number): Promise<never> {
  return new Promise((_resolve, reject) => setTimeout(reject, ms));
}
