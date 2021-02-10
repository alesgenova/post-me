export interface Communicator {
  rank(): number;
  size(): number;
  send<T = any>(
    data: T,
    destination: number,
    tag: number,
    transfer?: Transferable[]
  ): Promise<void>;
  recv<T = any>(source: number, tag: number): Promise<T>;
  bcast<T = any>(data: T | null, root: number): Promise<T>;
  barrier(): Promise<void>;
  scatter<T extends ArrayLike>(data: T | null, root: number): Promise<T>;
  gather<T extends ArrayLike>(data: T, root: number): Promise<T | null>;
  allGather<T extends ArrayLike>(data: T): Promise<T>;
  reduce<T = any>(
    data: T,
    reducer: (a: T, b: T) => T,
    root: number
  ): Promise<T | null>;
  allReduce<T = any>(data: T, reducer: (a: T, b: T) => T): Promise<T>;
}

export type ArrayLike =
  | Array<any>
  | Uint8Array
  | Uint16Array
  | Uint32Array
  | BigUint64Array
  | Int8Array
  | Int16Array
  | Int32Array
  | BigInt64Array
  | Float32Array
  | Float64Array
  | Uint8ClampedArray;

export type Send = Communicator['send'];
export type Recv = Communicator['recv'];
export type Bcast = Communicator['bcast'];
export type Barrier = Communicator['barrier'];
export type Scatter = Communicator['scatter'];
export type Gather = Communicator['gather'];
export type AllGather = Communicator['allGather'];
export type Reduce = Communicator['reduce'];
export type AllReduce = Communicator['allReduce'];

type CollectiveOpBuilder<Op extends (...args: any[]) => Promise<any>> = (
  rank: number,
  size: number,
  send: Send,
  recv: Recv
) => Op;

const BARRIER_TAG = -1;
const BCAST_TAG = -2;
const SCATTER_TAG = -3;
const GATHER_TAG = -4;
const REDUCE_TAG = -5;

export const buildBarrier: CollectiveOpBuilder<Barrier> = function (
  rank,
  size,
  send,
  recv
) {
  return async function () {
    const destination = (rank + 1) % size;
    const source = (size + rank - 1) % size;
    const tag = BARRIER_TAG;
    let rounds = 2;

    while (rounds > 0) {
      if (rank === 0) {
        await send(true, destination, tag);
      }

      await recv(source, tag);

      if (rank !== 0) {
        await send(true, destination, tag);
      }

      rounds -= 1;
    }
  };
};

export const buildBcast: CollectiveOpBuilder<Bcast> = function (
  rank,
  size,
  send,
  recv
) {
  return async function (data: any, root: number) {
    const tag = BCAST_TAG;

    // O(logN) broadcast implementation
    const delta = (rank + size - root) % size;
    let stride = 1;

    while (stride < size) {
      if (delta < stride && delta + stride < size) {
        const destination = (rank + stride) % size;
        send(data, destination, tag);
      } else if (delta >= stride && delta - stride < stride) {
        const source = (rank + size - stride) % size;
        data = await recv(source, tag);
      }

      stride = stride * 2;
    }

    return data;
  };
};

export const buildScatter: CollectiveOpBuilder<Scatter> = function (
  rank,
  size,
  send,
  recv
) {
  return async function <T extends ArrayLike = ArrayLike>(
    data: T | null,
    root: number
  ) {
    const tag = SCATTER_TAG;

    // O(N) scatter implementation can probably do better
    if (rank === root) {
      const fullSize = data!.length;
      const subSize = Math.max(Math.floor(fullSize / size), 1);
      const remainder = Math.max(fullSize - subSize * size, 0);
      for (let destination = 0; destination < size; ++destination) {
        const extraStart = destination < remainder ? destination : remainder;
        const extraStop = destination < remainder ? 1 : 0;
        const start = destination * subSize + extraStart;
        const stop = start + subSize + extraStop;
        const subData = data!.slice(start, stop);
        let transfer: Transferable[] | undefined;
        if ((subData as any).buffer) {
          transfer = [(subData as any).buffer];
        }
        send(subData, destination, tag, transfer);
      }
    }

    const scatterData = await recv(root, tag);

    return scatterData;
  };
};

export const buildGather: CollectiveOpBuilder<Gather> = function (
  rank,
  size,
  send,
  recv
) {
  return async function <T extends ArrayLike = ArrayLike>(
    data: T,
    root: number
  ) {
    const tag = GATHER_TAG;

    // O(N) scatter implementation can probably do better

    let transfer: Transferable[] | undefined;
    if ((data as any).buffer) {
      transfer = [(data as any).buffer];
    }
    send(data, root, tag, transfer);

    let gatheredData: T | null = null;

    if (rank === root) {
      for (let source = 0; source < size; ++source) {
        let subData: T = await recv(source, tag);
        if (source === 0) {
          gatheredData = subData;
        } else {
          const C: any = gatheredData!.constructor;
          gatheredData = C.of(...gatheredData!, ...subData);
        }
      }
    }

    return gatheredData;
  };
};

export const buildAllGather: CollectiveOpBuilder<AllGather> = function (
  rank,
  size,
  send,
  recv
) {
  return async function <T extends ArrayLike = ArrayLike>(data: T) {
    const gather = buildGather(rank, size, send, recv);
    const bcast = buildBcast(rank, size, send, recv);

    const root = 0;

    const gatheredData = await gather(data, root);
    return await bcast(gatheredData, root);
  };
};

export const buildReduce: CollectiveOpBuilder<Reduce> = function (
  rank,
  size,
  send,
  recv
) {
  return async function reduce<T = any>(
    data: T,
    reducer: (a: T, b: T) => T,
    root: number
  ): Promise<T | null> {
    const tag = REDUCE_TAG;

    let result = data;

    // O(logN) reduce implementation
    const delta = (rank + size - root) % size;
    let stride = 1;

    while (stride <= Math.floor(size / 2)) {
      if (delta % stride !== 0) {
        break;
      }

      const currSize = Math.floor(size / stride);

      // If there is an unpaired process at this iteration, reduce with root
      if (currSize % 2 !== 0) {
        const unpaired = (root + (currSize - 1) * stride) % size;
        if (rank === unpaired) {
          send(result, root, tag);
          break;
        } else if (rank === root) {
          const otherResult = await recv(unpaired, tag);
          result = reducer(result, otherResult);
        }
      }

      if (delta % (stride * 2) === 0) {
        const source = (rank + stride) % size;
        const otherResult = await recv(source, tag);
        result = reducer(result, otherResult);
      } else {
        const destination = (rank + size - stride) % size;
        send(result, destination, tag);
        break;
      }

      stride = stride * 2;
    }

    if (rank === root) {
      return result;
    } else {
      return null;
    }
  };
};

export const buildAllReduce: CollectiveOpBuilder<AllReduce> = function (
  rank,
  size,
  send,
  recv
) {
  return async function <T = any>(
    data: T,
    reducer: (a: T, b: T) => T
  ): Promise<T> {
    const reduce = buildReduce(rank, size, send, recv);
    const bcast = buildBcast(rank, size, send, recv);

    const root = 0;

    const reducedData = await reduce(data, reducer, root);
    return await bcast(reducedData, root);
  };
};
