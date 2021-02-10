/**
 * @packageDocumentation MPI-like concurrency for a pool of web workers
 */

import { createPool, WorkerPool } from './parent';
import {
  joinPool,
  PoolConnection,
  ParallelMethod,
  ParallelMethods,
} from './worker';
import { Communicator } from './mpi';

export {
  // Methods
  createPool,
  joinPool,
  // Interfaces
  WorkerPool,
  PoolConnection,
  Communicator,
  // Type Helpers
  ParallelMethod,
  ParallelMethods,
};
