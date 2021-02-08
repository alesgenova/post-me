import {
  ParentHandshake,
  ChildHandshake,
  WorkerMessenger,
  PortMessenger,
  Connection,
  RemoteHandle,
  LocalHandle,
  MethodsType,
  Callable,
  ValueOrPromise,
  InnerType,
} from 'post-me';
import {
  Communicator,
  Send,
  Barrier,
  Bcast,
  Scatter,
  Gather,
  AllGather,
  Reduce,
  AllReduce,
  buildBarrier,
  buildBcast,
  buildScatter,
  buildGather,
  buildAllGather,
  buildReduce,
  buildAllReduce,
} from './mpi';

export type InitMethods = {
  initComm(rank: number, ports: (MessagePort | undefined)[]): Promise<void>;
};

export type ParallelMethod<F extends Callable<any, any>> = (
  comm: Communicator
) => Callable<Parameters<F>, ValueOrPromise<InnerType<ReturnType<F>>>>;

export type ParallelMethods<M extends MethodsType> = {
  [K in keyof M]: ParallelMethod<M[K]>;
};

export interface PoolConnection<M extends MethodsType = any> {
  registerMethods(methods: ParallelMethods<M>): void;
  registerMethod<K extends keyof M>(
    methodName: K,
    method: ParallelMethod<M[K]>
  ): void;
  setReturnTransfer<K extends keyof M>(
    methodName: K,
    transfer: (result: InnerType<ReturnType<M[K]>>) => Transferable[]
  ): void;
}

export function joinPool(workerScope: any): Promise<PoolConnection> {
  return new Promise((resolve, reject) => {
    let messenger = new WorkerMessenger({ worker: workerScope });
    ChildHandshake(messenger)
      .then((connection) => {
        const parentConnection = connection;

        const initMethods: InitMethods = {
          initComm(rank, ports) {
            return new Promise<void>((thisResolve, thisReject) => {
              const handshakes = ports.map((port, otherRank) => {
                if (port === undefined) {
                  return Promise.resolve(undefined);
                }
                let messenger = new PortMessenger({ port });
                const Handshake =
                  otherRank < rank ? ChildHandshake : ParentHandshake;
                return Handshake(messenger);
              });

              Promise.all(handshakes)
                .then((connections) => {
                  const poolConnection = new ConcretePoolConnection(
                    parentConnection,
                    rank,
                    connections
                  );
                  resolve(poolConnection);
                  thisResolve();
                })
                .catch((err) => {
                  reject(err);
                  thisReject(err);
                });
            });
          },
        };

        parentConnection.localHandle().setMethods(initMethods);
      })
      .catch(reject);
  });
}

type IntraPoolMethods = {
  send(taskId: number, source: number, tag: number, data: any): Promise<void>;
};

class ConcretePoolConnection<M extends MethodsType = any>
  implements PoolConnection<M> {
  private _size: number;
  private _rank: number;
  private _connections: (Connection | undefined)[];
  private _communicators: { [taskId: number]: ConcreteCommunicator };
  private _parentConnection: Connection;

  constructor(
    parentConnection: Connection,
    rank: number,
    connections: (Connection | undefined)[]
  ) {
    this._rank = rank;
    this._size = connections.length;
    this._connections = connections;
    this._parentConnection = parentConnection;
    this._communicators = {};

    this._connections.forEach((connection) => {
      if (connection !== undefined) {
        const localHandle: LocalHandle<IntraPoolMethods> = connection.localHandle();
        localHandle.setMethod('send', this._handleSend.bind(this));
      }
    });
  }

  registerMethods(methods: ParallelMethods<M>) {
    const exposedMethods = Object.entries(methods).reduce(
      (tot, [methodName, method]: [string, ParallelMethod<any>]) => {
        tot[methodName] = this._exposeParallelMethod(method);
        return tot;
      },
      {} as any
    );

    this._parentConnection.localHandle().setMethods(exposedMethods);
  }

  registerMethod<K extends keyof M>(
    methodName: K,
    method: ParallelMethod<M[K]>
  ) {
    this._parentConnection
      .localHandle()
      .setMethod(methodName, this._exposeParallelMethod(method));
  }

  setReturnTransfer<K extends keyof M>(
    methodName: K,
    transfer: (result: InnerType<ReturnType<M[K]>>) => Transferable[]
  ) {
    this._parentConnection
      .localHandle()
      .setReturnTransfer(methodName, transfer);
  }

  private _exposeParallelMethod<S extends Callable<any, any>>(
    method: ParallelMethod<S>
  ) {
    return (taskId: number, ...args: Parameters<S>) => {
      const send: Send = (data, destination, tag, transfer) => {
        return this._sendToChannel(
          taskId,
          this._rank,
          destination,
          tag,
          data,
          transfer
        );
      };

      const communicator = new ConcreteCommunicator(
        this._rank,
        this._size,
        send
      );

      this._communicators[taskId] = communicator;

      return new Promise((resolve, reject) => {
        setTimeout(() => {
          Promise.resolve(method(communicator)(...args))
            .then(resolve)
            .catch(reject);
        }, 0);
      });
    };
  }

  private _sendToChannel(
    taskId: number,
    source: number,
    destination: number,
    tag: number,
    data: any,
    transfer?: Transferable[]
  ) {
    const connection = this._connections[destination];

    if (connection === undefined) {
      return Promise.reject(new Error('The destination is out of range'));
    }

    const remoteHandle: RemoteHandle<IntraPoolMethods> = connection.remoteHandle();
    return remoteHandle.customCall('send', [taskId, source, tag, data], {
      transfer,
    });
  }

  private _handleSend(
    taskId: number,
    source: number,
    tag: number,
    data: any
  ): Promise<void> {
    const communicator = this._communicators[taskId];
    if (communicator === undefined) {
      return Promise.reject('A communicator does not exist for this task.');
    }

    return communicator._handleSend(source, tag, data);
  }
}

function messageKey(source: number, tag: number): string {
  return `${source},${tag}`;
}

interface QueueItem {
  resolve(data?: any): void;
  reject(error?: any): void;
}

interface MessageQueueItem extends QueueItem {
  data: any;
}

class ConcreteCommunicator implements Communicator {
  private _size: number;
  private _rank: number;
  private _messageQueue: { [key: string]: MessageQueueItem[] };
  private _receiveQueue: { [key: string]: QueueItem[] };
  private _sendFn: Send;
  bcast: Bcast;
  barrier: Barrier;
  scatter: Scatter;
  gather: Gather;
  allGather: AllGather;
  reduce: Reduce;
  allReduce: AllReduce;

  constructor(rank: number, size: number, sendFn: Send) {
    this._rank = rank;
    this._size = size;
    this._messageQueue = {};
    this._receiveQueue = {};
    this._sendFn = sendFn;

    const send = this.send.bind(this);
    const recv = this.recv.bind(this);
    this.bcast = buildBcast(rank, size, send, recv);
    this.barrier = buildBarrier(rank, size, send, recv);
    this.scatter = buildScatter(rank, size, send, recv);
    this.gather = buildGather(rank, size, send, recv);
    this.allGather = buildAllGather(rank, size, send, recv);
    this.reduce = buildReduce(rank, size, send, recv);
    this.allReduce = buildAllReduce(rank, size, send, recv);
  }

  rank() {
    return this._rank;
  }

  size() {
    return this._size;
  }

  send(
    data: any,
    destination: number,
    tag: number,
    transfer?: Transferable[]
  ): Promise<void> {
    if (destination === this.rank()) {
      this._handleSend(this.rank(), tag, data);
      // Resolve to avoid deadlock
      return Promise.resolve();
    }

    return this._sendFn(data, destination, tag, transfer);
  }

  recv(source: number, tag: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const key = messageKey(source, tag);
      if (this._messageQueue[key] && this._messageQueue[key].length > 0) {
        const [sender] = this._messageQueue[key].splice(0, 1);
        sender.resolve();
        resolve(sender.data);
      } else {
        if (this._receiveQueue[key] === undefined) {
          this._receiveQueue[key] = [];
        }

        this._receiveQueue[key].push({ resolve, reject });
      }
    });
  }

  _handleSend(source: number, tag: number, data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const key = messageKey(source, tag);

      if (this._receiveQueue[key] && this._receiveQueue[key].length > 0) {
        const [receiver] = this._receiveQueue[key].splice(0, 1);
        resolve();
        receiver.resolve(data);
      } else {
        if (this._messageQueue[key] === undefined) {
          this._messageQueue[key] = [];
        }

        this._messageQueue[key].push({ resolve, reject, data });
      }
    });
  }
}
