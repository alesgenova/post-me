import {
  ParentHandshake,
  RemoteHandle,
  WorkerMessenger,
  Connection,
  MethodsType,
  InnerType,
} from 'post-me';
import { InitMethods } from './worker';

export interface WorkerPool<M extends MethodsType = any> {
  call<K extends keyof M>(
    methodName: K,
    args: (rank: number) => Parameters<M[K]>,
    transfer?: (rank: number, args: Parameters<M[K]>) => Transferable[]
  ): Promise<InnerType<ReturnType<M[K]>>[]>;
}

function createUniqueIdFn() {
  let __id = 0;
  return function () {
    const id = __id;
    __id += 1;
    return id;
  };
}

export function createPool(
  workers: Worker[],
  ChannelConstructor?: any
): Promise<WorkerPool> {
  ChannelConstructor = ChannelConstructor || MessageChannel;
  return new Promise((resolve, reject) => {
    const size = workers.length;

    // Create channels for direct inter-worker communication
    const channels: { [_: string]: MessageChannel } = {};
    for (let i = 0; i < size; ++i) {
      for (let j = i; j < size; ++j) {
        const key = channelKey(i, j);
        channels[key] = new ChannelConstructor();
      }
    }

    const connectTasks: Promise<Connection>[] = workers.map((worker, rank) => {
      let messenger = new WorkerMessenger({ worker });
      return ParentHandshake(messenger).then((connection) => {
        return connection;
      });
    });

    Promise.all(connectTasks)
      .then((connections) => {
        const initializeTasks = connections.map((connection, rank) => {
          const remoteHandle: RemoteHandle<InitMethods> = connection.remoteHandle();

          // Ensure MessagePorts to create direct Worker-to-Workern communication are transferred.
          remoteHandle.setCallTransfer(
            'initComm',
            (_rank, ports) =>
              ports.filter((port) => port !== undefined) as Transferable[]
          );

          const ports: (MessagePort | undefined)[] = [];

          for (let otherRank = 0; otherRank < size; ++otherRank) {
            if (otherRank === rank) {
              ports.push(undefined);
            } else {
              const key = channelKey(rank, otherRank);
              const channel = channels[key];
              let port = rank < otherRank ? channel.port1 : channel.port2;
              ports.push(port);
            }
          }

          return remoteHandle.call('initComm', rank, ports);
        });

        Promise.all(initializeTasks)
          .then(() => {
            const workerPool = new ConcreteWorkerPool(connections);
            resolve(workerPool);
          })
          .catch(reject);
      })
      .catch(reject);
  });
}

class ConcreteWorkerPool<M extends MethodsType = any> implements WorkerPool<M> {
  private _connections: Connection[];
  private _taskId: () => number;

  constructor(connections: Connection[]) {
    this._connections = connections;
    this._taskId = createUniqueIdFn();
  }

  call<K extends keyof M>(
    methodName: K,
    argsFn: (rank: number) => Parameters<M[K]>,
    transferFn?: (rank: number, args: Parameters<M[K]>) => Transferable[]
  ): Promise<InnerType<ReturnType<M[K]>>[]> {
    const taskId = this._taskId();
    return Promise.all(
      this._connections.map((connection, rank) => {
        const remoteHandle = connection.remoteHandle();
        const args = argsFn(rank);
        const options = transferFn
          ? { transfer: transferFn(rank, args) }
          : undefined;
        return remoteHandle.customCall(methodName, [taskId, ...args], options);
      })
    );
  }
}

function channelKey(_i: number, _j: number): string {
  let i = _i;
  let j = _j;
  if (i > j) {
    i = _j;
    j = _i;
  }

  return `${i},${j}`;
}
