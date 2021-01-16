[![workflow status](https://github.com/alesgenova/post-me/workflows/main/badge.svg?branch=main)](https://github.com/alesgenova/post-me/actions?query=workflow%3Amain+branch%3Amain)
[![npm package](https://img.shields.io/npm/v/post-me.svg)](https://www.npmjs.com/package/post-me)
[![codecov](https://codecov.io/gh/alesgenova/post-me/branch/main/graph/badge.svg)](https://codecov.io/gh/alesgenova/post-me)

<h1 align="center">post-me</h1>

<p align="center">Communicate with web <code>Workers</code> and other <code>Windows</code> using a simple <code>Promise</code> based API</p>

![diagram](./diagram.png)

With __post-me__ it is easy for a parent (for example the main app) and a child (for example a worker or an iframe) to expose methods and custom events to each other.

Main features:
- Parent and child can both expose methods and/or events.
- Strong typing of method names, arguments, return values, as well as event names and payloads.
- Seamlessly pass callbacks to the other context to get progress or partial results.
- Establish multiple concurrent connections.
- Easily extensible to more use cases.
- No dependencies: 2kb gzip bundle.
- Excellent test coverage.
- Open source (MIT)

## Demo
In this [live demo](https://alesgenova.github.io/post-me/) a parent window achieves two-way communication with its 5 children (4 iframes and 1 web worker).

## Usage
In the example below, the parent application calls methods exposed by the worker and listens to events emitted by it.

For the sake of simiplicity, only the worker is expositng methods and events, but the parent application could just as well expose methods and events.

Parent code:
```typescript
import { ParentHandshake, WorkerMessenger } from 'post-me';

const worker = new Worker('./worker.js');

const messenger = new WorkerMessenger({ worker });

ParentHandshake(messenger).then((connection) => {
  const remoteHandle = connection.remoteHandle();

  // Call methods on the worker and get the result as a promise
  remoteHandle.call('sum', 3, 4).then((result) => {
    console.log(result); // 7
  });

  // Listen for a specific custom event from the worker
  remoteHandle.addEventListener('ping', (payload) => {
    console.log(payload) // 'Oh, hi!'
  });
});
```

Worker code:
```typescript
import { ChildHandshake, WorkerMessenger } from 'post-me';

// Methods exposed by the worker: each function can either return a value or a Promise.
const methods = {
  sum: (x, y) => x + y,
  mul: (x, y) => x * y
}

const messenger = WorkerMessenger({worker: self});
ChildHandshake(messenger, methods).then((connection) => {
  const remoteHandle = connection.remoteHandle();

  // Emit custom events to the app
  localHandle.emit('ping',  'Oh, hi!');
});
```

## Typescript
Using typescript you can ensure that the parent and the child are using each other's methods and events correctly. Most coding mistakes will be caught during development by the typescript compiler.

Thanks to __post-me__ extensive typescript support, the correctness of the following items can be statically checked during development:
- Method names
- Argument number and types
- Return values type
- Event names
- Event payload type

Below a modified version of the previous example using typescript.

Types code:
```typescript
// types.ts

export type WorkerMethods = {
  sum: (x: number, y: number) => number;
  mul: (x: number, y: number) => number;
}

export type WorkerEvents = {
  'ping': string;
}
```

Parent Code:
```typescript
import {
 ParentHandshake, WorkerMessenger, RemoteHandle
} from 'post-me';

import { WorkerMethods, WorkerEvents } from './types';

const worker = new Worker('./worker.js');

const messenger = new WorkerMessenger({ worker });

ParentHandshake(messenger).then((connection) => {
  const remoteHandle: RemoteHandle<WorkerMethods, WorkerEvents>
    = connection.remoteHandle();

  // Call methods on the worker and get the result as a Promise
  remoteHandle.call('sum', 3, 4).then((result) => {
    console.log(result); // 7
  });

  // Listen for a specific custom event from the app
  remoteHandle.addEventListener('ping', (payload) => {
    console.log(payload) // 'Oh, hi!'
  });

  // The following lines have various mistakes that will be caught by the compiler
  remoteHandle.call('mul', 3, 'four'); // Wrong argument type
  remoteHandle.call('foo'); // 'foo' doesn't exist on WorkerMethods type
});
```

Worker code:
```typescript
import { ChildHandshake, WorkerMessenger, LocalHandle } from 'post-me';

import { WorkerMethods, WorkerEvents } from './types';

const methods: WorkerMethods = {
  sum: (x: number, y: number) => x + y,
  mul: (x: number, y: number) => x * y,
}

const messenger = WorkerMessenger({worker: self});
ChildHandshake(messenger, methods).then((connection) => {
  const localHandle: LocalHandle<WorkerEvents>
    = connection.localHandle();

  // Emit custom events to the worker
  localHandle.emit('ping',  'Oh, hi!');
});
```

## Other Windows
post-me can establish the same level of bidirectional communications not only with workers but with other windows too (e.g. iframes).

Internally, the low level differences between communicating with a `Worker` or a `Window` have been abstracted, and the `Handshake` will accept any object that implements the `Messenger` interface defined by post-me.

This approach makes it easy for post-me to be extended by its users.

A `Messenger` implementation for communicating between window is already provided in the library (`WindowMessenger`).

Here is an example of using post-me to communicate with an iframe.

Parent code:
```typescript
import { ParentHandshake, WindowMessenger } from 'post-me';

// For safety it is strongly adviced to pass the explicit child origin instead of '*'
const messenger = new WindowMessenger({
  localWindow: window,
  remoteWindow: childWindow,
  remoteOrigin: '*'
});

ParentHandshake(messenger).then((connection) => {/* ... */});
```

Child code:
```typescript
import { ChildHandshake, WindowMessenger } from 'post-me';

// For safety it is strongly adviced to pass the explicit child origin instead of '*'
const messenger = new WindowMessenger({
  localWindow: window,
  remoteWindow: window.parent,
  remoteOrigin: '*'
});

ChildHandshake(messenger).then((connection) => {/* ... */});
```

## Callbacks as call parameters
Even though functions cannot actually be shared across contexts, with a little magic under the hood __post-me__ let's you pass callback functions as arguments when calling a method on the other worker/window.

Passing callbacks can be useful to obtain progress or partial results from a long running task.

Parent code:
```typescript
//...
ParentHandshake(messenger).then(connection => {
  const remoteHandle = connection.remoteHandle();

  const onProgress = (progress) => {
    console.log(progress); // 0.25, 0.5, 0.75
  }

  remoteHandle.call("slowSum", 2, 3, onProgress).then(result => {
    console.log(result); // 5
  });
});
```

Worker code:
```typescript
const methods = {
  slowSum: (x, y, onProgress) => {
    onProgress(0.25);
    onProgress(0.5);
    onProgress(0.75);

    return x + y;
}
// ...
ChildHandshake(messenger, methods).then(connection => {/* */})
```

## Debugging
You can optionally output the internal low-level messages exchanged between the two ends.

To enable debugging, simply decorate any `Messenger` instance with the provided `DebugMessenger` decorator.

You can optionally pass to the decorator your own logging function (a glorified `console.log` by default), which can be useful to make the output more readable, or to inspect messages in automated tests.

### Example
```typescript
import { ParentHandshake, WindowMessenger, DebugMessenger } from 'post-me';

import debug from 'debug';          // Use the full feature logger from the debug library
// import { debug } from 'post-me'; // Or the lightweight implementation provided

let messenger = new WindowMessenger({
  localWindow: window,
  remoteWindow: childWindow,
  remoteOrigin: '*'
});

// To enable debugging of each message exchange, decorate the messenger with DebugMessenger
const log = debug('post-me:parent'); // optional
messenger = DebugMessenger(messenger, log);

ParentHandshake(messenger).then((connection) => {
  // ...
});

```

### Output
![debug output](debug.png)

## References
The __post-me__ API is loosely inspired by [postmate](https://github.com/dollarshaveclub/postmate), with several major improvements and fixes to outstanding issues:
- Native typescript support
- Method calls can have both arguments and a return value: ([#94](https://github.com/dollarshaveclub/postmate/issues/94))
- Parent and child can both expose methods and/or events (instead of child only): [#118](https://github.com/dollarshaveclub/postmate/issues/118)
- Exceptions that occur in a method call can be caught by the caller.
- Better control over handshake origin and attempts: ([#150](https://github.com/dollarshaveclub/postmate/issues/150), [#195](https://github.com/dollarshaveclub/postmate/issues/195))
- Multiple listeners for each event: ([#58](https://github.com/dollarshaveclub/postmate/issues/58))
