import Emittery from 'emittery';
import debugFactory from 'debug';
import _get from 'lodash.get';
import { v4 as uuid } from 'uuid';

import { IMessenger } from './messenger';
import {
  CALL_REQUEST,
  ICallRequest,
  ICallResponse,
  createCallRequest,
  createCallResponse,
  createCallResponseEventName,
} from './msg/call';
import { INativeEventData, createNativeEventData } from './msg/native';

// TODO this also needs to be an instance variable
const debug = debugFactory('ibridge:Bridge');

export interface IConstructorArgs<TModel> {
  messenger: IMessenger;
  model: TModel;
}

export default class Bridge<TModel> extends Emittery {
  messenger: IMessenger;
  model: TModel;
  context: any = {};
  private sessionId: string;

  constructor(args: IConstructorArgs<TModel>) {
    super();

    this.messenger = args.messenger;
    this.model = args.model;
    this.sessionId = uuid();

    this.messenger.addMessageListener(this.dispatcher.bind(this));
    this.on(CALL_REQUEST, this.handleCall.bind(this) as any);
  }

  private dispatcher(event: MessageEvent<INativeEventData>): void {
    debug(`dispatcher got native event %O`, event);
    const { eventName, data, sessionId } = event.data;
    if (sessionId !== this.sessionId) {
      return;
    }
    debug(`dispatcher got ibridge event "%s" with data %O`, eventName, data);
    this.emitToLocal(eventName, data);
  }

  // This is only to avoid confusions between Emittery's
  // this.emit and this.emitToRemote, as a rule of thumb this.emit
  // should only be used by the dispatcher, the restof the code
  // and even the lib consumers should use emitToRemote
  private emitToLocal(eventName: string, data?: unknown): void {
    super.emit(eventName, data);
  }

  async emit(eventName: string, data?: unknown): Promise<void> {
    console.warn(
      'this function is private and has now effect, you should probably want to use emitToRemote'
    );
  }

  emitToRemote(eventName: string, data?: unknown): void {
    debug(`emit "%s" with data %O`, eventName, data);

    this.messenger.postMessage(
      createNativeEventData(this.sessionId, eventName, data)
    );
  }

  // TODO review with alesgenova statically typing these methods
  // (call and handleCall) doesn't make sense, becuase it only makes
  // sense to validate `call` against the remote Model, so the lib consumer
  // would require to somehgow share the type definitions between each side
  // of the bridge and then pass it as a potentiall type argument toi this function
  // whcih is something that post-me wasn't even doing.
  //
  // Typing handleCall might make more sense but it does not provide
  // much usefulness as we would still need to provide runtime checks so
  // that we can propvide useful runtime information to the user.
  async call(property: string, ...args: Array<any>): Promise<any> {
    const callId = uuid();

    this.emitToRemote(...createCallRequest({ callId, property, args }));
    const eventName = createCallResponseEventName(callId);
    debug('get await for response event %s', eventName);
    const { value, error } = (await this.once(eventName)) as ICallResponse<any>;
    if (error) {
      throw error;
    }

    return value;
  }

  private async handleCall<TArgs extends Array<any>>(
    data: ICallRequest<TArgs>
  ): Promise<void> {
    const { callId, property, args } = data;
    // property might be a full lodash path
    const fn = _get(this.model, property);

    let value, error;
    try {
      if (typeof fn !== 'function') {
        debug(
          `the model ${property} was called, but it isn't a function, got ${fn}`
        );
        throw new Error('model function not found');
      }
      // TODO remove context?
      value = await fn.call(this.context, ...args);
    } catch (err) {
      error = err;
    }

    this.emitToRemote(
      ...createCallResponse({
        callId,
        property,
        value,
        error,
      })
    );
  }
}
