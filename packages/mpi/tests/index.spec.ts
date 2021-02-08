import { ConcreteEmitter, MethodsType } from 'post-me';
import {
  createPool,
  joinPool,
  ParallelMethods,
  WorkerPool,
  ParallelMethod,
} from '../src';

function MockWorker(script: (self: any) => void) {
  const worker: any = new ConcreteEmitter();
  const self: any = new ConcreteEmitter();

  self.postMessage = (payload: any) => {
    worker.emit('message', { data: payload });
  };

  worker.postMessage = (payload: any) => {
    self.emit('message', { data: payload });
  };

  script(self);

  return worker;
}

class MockChannel {
  public port1: any;
  public port2: any;
  constructor() {
    const port1: any = new ConcreteEmitter();
    port1.start = () => {};
    const port2: any = new ConcreteEmitter();
    port2.start = () => {};

    port1.postMessage = (payload: any) => {
      port2.emit('message', { data: payload });
    };

    port2.postMessage = (payload: any) => {
      port1.emit('message', { data: payload });
    };

    this.port1 = port1;
    this.port2 = port2;
  }
}

function makeHandshake<M extends MethodsType = any>(
  n: number,
  methods: ParallelMethods<M>
): Promise<WorkerPool<M>> {
  const workerScript = (self: any) => {
    joinPool(self).then((connection) => {
      connection.registerMethods(methods);
    });
  };

  const workers: Worker[] = [];
  for (let i = 0; i < N_WORKERS; ++i) {
    const worker = MockWorker(workerScript);
    workers.push(worker);
  }

  return createPool(workers, MockChannel);
}

const N_WORKERS = 7;

test('create pool', () => {
  return new Promise<void>((resolve) => {
    makeHandshake(N_WORKERS, {}).then((pool) => {
      resolve();
    });
  });
});

test('send', () => {
  return new Promise<void>((resolve) => {
    const send: ParallelMethod<(data: number) => number> = (
      communicator
    ) => async (data) => {
      const rank = communicator.rank();
      const size = communicator.size();
      const destination = (rank + 1) % size;
      const source = (rank + size - 1) % size;
      communicator.send(data, destination, 0);
      data = await communicator.recv(source, 0);
      return data;
    };
    makeHandshake(N_WORKERS, { send }).then((pool) => {
      pool
        .call('send', (rank) => [rank])
        .then((result) => {
          for (let i = 0; i < N_WORKERS; ++i) {
            expect(result[i]).toEqual((i + N_WORKERS - 1) % N_WORKERS);
          }
          resolve();
        });
    });
  });
});

test('send', async () => {
  const send: ParallelMethod<(data: number) => number> = (
    communicator
  ) => async (data) => {
    const rank = communicator.rank();
    const size = communicator.size();
    const destination = (rank + 1) % size;
    const source = (rank + size - 1) % size;
    communicator.send(data, destination, 0);
    data = await communicator.recv(source, 0);
    return data;
  };

  const pool = await makeHandshake(N_WORKERS, { send });
  const result = await pool.call('send', (rank) => [rank]);
  result.forEach((value, i) => {
    expect(value).toEqual((i + N_WORKERS - 1) % N_WORKERS);
  });
});

test('bcast', async () => {
  const bcast: ParallelMethod<(data: number | null, root: number) => number> = (
    communicator
  ) => async (data, root) => {
    return await communicator.bcast(data, root);
  };

  const ROOT = N_WORKERS - 1;
  const pool = await makeHandshake(N_WORKERS, { bcast });
  const result = await pool.call('bcast', (rank) => [
    rank === ROOT ? rank : null,
    ROOT,
  ]);
  result.forEach((value) => {
    expect(value).toEqual(ROOT);
  });
});

function makeSeq(start: number, size: number): Uint16Array {
  const array = new Uint16Array(size);
  for (let i = 0; i < size; ++i) {
    array[i] = i + start;
  }

  return array;
}

test('scatter', async () => {
  const scatter: ParallelMethod<
    (data: Uint16Array | null, root: number) => Uint16Array
  > = (communicator) => async (data, root) => {
    return await communicator.scatter(data, root);
  };

  const ROOT = N_WORKERS - 1;
  const input = makeSeq(0, N_WORKERS * 4 + 3);
  const pool = await makeHandshake(N_WORKERS, { scatter });
  const result = await pool.call('scatter', (rank) => [
    rank === ROOT ? input : null,
    ROOT,
  ]);
  const N = Math.floor(input.length / N_WORKERS);
  let output = new Uint16Array(0);
  result.forEach((value) => {
    expect(value.length).toBeGreaterThanOrEqual(N);
    expect(value.length).toBeLessThanOrEqual(N + 1);
    output = Uint16Array.of(...output, ...value);
  });

  expect(output).toEqual(input);
});

test('gather', async () => {
  const gather: ParallelMethod<
    (data: Uint16Array, root: number) => Uint16Array | null
  > = (communicator) => async (data, root) => {
    return await communicator.gather(data, root);
  };

  const allGather: ParallelMethod<(data: Uint16Array) => Uint16Array> = (
    communicator
  ) => async (data) => {
    return await communicator.allGather(data);
  };

  const ROOT = N_WORKERS - 1;
  const SIZE = 4;
  const pool = await makeHandshake(N_WORKERS, { gather, allGather });

  {
    const result = await pool.call('gather', (rank) => [
      makeSeq(rank * SIZE, SIZE),
      ROOT,
    ]);
    result.forEach((value, i) => {
      if (i === ROOT) {
        expect(value).toEqual(makeSeq(0, SIZE * N_WORKERS));
      } else {
        expect(value).toEqual(null);
      }
    });
  }

  {
    const result = await pool.call('allGather', (rank) => [
      makeSeq(rank * SIZE, SIZE),
    ]);
    result.forEach((value, i) => {
      expect(value).toEqual(makeSeq(0, SIZE * N_WORKERS));
    });
  }
});

test('reduce', async () => {
  const reduce: ParallelMethod<
    (data: number, root: number) => number | null
  > = (communicator) => async (data, root) => {
    return await communicator.reduce(data, (a, b) => a + b, root);
  };

  const allReduce: ParallelMethod<(data: number) => number> = (
    communicator
  ) => async (data) => {
    return await communicator.allReduce(data, (a, b) => a + b);
  };

  const ROOT = 0;
  const pool = await makeHandshake(N_WORKERS, { reduce, allReduce });

  {
    const result = await pool.call('reduce', (rank) => [rank, ROOT]);
    result.forEach((value, i) => {
      if (i === ROOT) {
        expect(value).toEqual(((N_WORKERS - 1) * N_WORKERS) / 2);
      } else {
        expect(value).toEqual(null);
      }
    });
  }

  {
    const result = await pool.call('allReduce', (rank) => [rank]);
    result.forEach((value, i) => {
      expect(value).toEqual(((N_WORKERS - 1) * N_WORKERS) / 2);
    });
  }
});

function sleep(time: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
}

test('barrier', async () => {
  const barrier: ParallelMethod<(t: number) => number> = (
    communicator
  ) => async (t) => {
    const t0: any = new Date();
    await sleep(t);
    await communicator.barrier();
    const t1: any = new Date();
    return t1 - t0;
  };

  const MAX_SLEEP = 500;
  const pool = await makeHandshake(N_WORKERS, { barrier });
  const result = await pool.call('barrier', (rank) => [
    (MAX_SLEEP * rank) / (N_WORKERS - 1),
  ]);
  const eps = 2;
  result.forEach((value) => {
    expect(Math.abs(value - MAX_SLEEP)).toBeLessThanOrEqual(eps);
  });
});
