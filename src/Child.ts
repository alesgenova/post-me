import debugFactory from './debug';
import { IBridge, Bridge } from './Bridge';
import { IdType, TModel } from './common';
import { Dispatcher } from './dispatcher';
import { IMessenger } from './messenger';
import { HANDSHAKE_REQUEST } from './msg/dispatcher';

// TODO make this an instance variable, include the sessionId
const debug = debugFactory('ibridge:child');

export class Child<M extends TModel> {
  messenger: IMessenger;
  model: M;

  constructor(messenger: IMessenger, model: M) {
    this.messenger = messenger;
    this.model = model;
  }

  async handshake(): Promise<IBridge> {
    const dispatcher = new Dispatcher(this.messenger);
    const sessionId: IdType = await dispatcher.once(HANDSHAKE_REQUEST);
    debug('received handshake from Parent');
    debug('sending handshake reply to Parent');
    dispatcher.acceptHandshake(sessionId);
    debug('handshake ok');
    return new Bridge(dispatcher, this.model);
  }
}
