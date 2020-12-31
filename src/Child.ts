import debugFactory from 'debug';
import Bridge, { IConstructorArgs } from './Bridge';
import { HANDSHAKE_REQUEST, HANDSHAKE_RESPONSE } from './msg/handshake';

// TODO make this an instance variable, include the sessionId
const debug = debugFactory('ibridge:child');

export default class ChildAPI<TModel> extends Bridge<TModel> {
  constructor(args: IConstructorArgs<TModel>) {
    super(args);
  }

  async handshake(): Promise<ChildAPI<TModel>> {
    await this.once(HANDSHAKE_REQUEST);
    debug('received handshake from Parent');
    debug('sending handshake reply to Parent');
    this.emitToRemote(HANDSHAKE_RESPONSE);
    debug('handshake ok');
    return this;
  }
}
