import debugFactory from 'debug';
import Bridge, { IConstructorArgs } from './Bridge';
import { HANDSHAKE_REQUEST, HANDSHAKE_RESPONSE } from './msg/handshake';

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
export default class ParentAPI<TModel> extends Bridge<TModel> {
  /**
   * The maximum number of attempts to send a handshake request to the parent
   */
  static maxHandshakeRequests = 5;

  constructor(args: IConstructorArgs<TModel>) {
    super(args);
  }

  async handshake(): Promise<ParentAPI<TModel>> {
    debug('starting handshake');
    let attempt = 0;

    const tryHandshake = async () => {
      while (attempt < ParentAPI.maxHandshakeRequests) {
        attempt++;
        debug(`handshake attempt %s %s`, attempt, this.messenger);
        this.emitToRemote(HANDSHAKE_REQUEST);

        try {
          await Promise.race([this.once(HANDSHAKE_RESPONSE), timeout(500)]);
        } catch (err) {
          // this should only happen if the timeout is reached, try again
          continue;
        }

        debug('Received handshake reply from Child');
        // Clean up any outstanding handhsake reply "once" listeners
        this.clearListeners(HANDSHAKE_RESPONSE);
        return;
      }

      throw new Error('maximum handshake attempts reached');
    };

    await tryHandshake();
    debug('handshake ok');
    return this;
  }
}

export function timeout(ms: number): Promise<never> {
  return new Promise((_resolve, reject) => setTimeout(reject, ms));
}
