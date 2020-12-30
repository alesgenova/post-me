[![workflow status](https://github.com/ibridge-js/ibridge/workflows/main/badge.svg?branch=main)](https://github.com/ibridge-js/ibridge/actions?query=workflow%3Amain+branch%3Amain)
[![npm package](https://img.shields.io/npm/v/ibridge.svg)](https://www.npmjs.com/package/ibridge)
[![codecov](https://codecov.io/gh/ibridge-js/ibridge/branch/main/graph/badge.svg)](https://codecov.io/gh/ibridge-js/ibridge)

<h1 align='center'>ibridge</h1>

`ibridge` is a library that facilitates two way communication with web workers, iframes, popups, and more.

Under the hood `ibridge` uses the low level [`postMessage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) API.

`ibridge` was inspired by [`postmate`](https://github.com/dollarshaveclub/postmate), and it provides several major improvements:
  - Native `typescript` support to allow strong typings of method calls and event payloads during development.
  - Method calls can have both arguments and a return value.
  - Both parent and child can expose methods and events (instead of child only).
  - Exceptions that occur in a method call can be caught by the caller.
  - Communicate between any two windows, not just iframes (e.g. workers, popups, and tabs).
  - Create multiple concurrent connections.

## Demo
In this [live demo](https://ibridge-js.github.io/ibridge/) a parent window achieves two-way communication with its 5 children (4 iframes and 1 web worker).

## Usage
To establish a connection between two windows follow the steps below:
  - Initiate a handshake between the parent window and the child window by calling the `ParentHandshake()` and `ChildHandshake()` methods respectively.
  - The `methods` parameter contain the methods that each window will expose to the other.
  - The handshake returns a `Promise<Connection>` to the two windows.
  - Get a handle to the other window by calling the `connection.getRemoteHandle()` method.
    - Use `remoteHandle.call(methodName, ...args)` to call methods on the other window. It returns a `Promise` of the result.
    - Use `remoteHandle.addEventListener(eventName, callback)` to listen to specific events dispatched by the other window.
    - Use `remoteHandle.removeEventListener(eventName, callback)` to remove listeners.
  - Get a handle to the local window by calling the `connection.getLocalHandle()` method.
    - Use `localHandle.emit(eventName, payload)` to emit a specific event with the given payload.

Refer to the code snippet below as an example of these steps.

### Parent code
```typescript
import { ParentHandshake, WindowMessenger } from 'ibridge';

// Create the child window any way you like (iframe here, but could be popup or tab too)
const childFrame = document.createElement('iframe');
childFrame.src = './child.html';
const childWindow = childFrame.contentWindow;

// Define the methods you want to expose to the other window.
// Methods can either return values or Promises
const methods = {
  foo: (s, x) => s.length * x,
  bar: (x) => Promise.resolve(x * 2),
}

// Start the handshake
// For safety it is strongly adviced to pass the explicit child origin instead of '*'
const messenger = new WindowMessenger({
  remoteWindow: childWindow,
  remoteOrigin: '*'
});
ParentHandshake(methods, messenger);
  .then((connection) => {
    const localHandle = connection.localHandle();
    const remoteHandle = connection.remoteHandle();

    // Call a method on the child
    remoteHandle.call('baz', 3)
      .then((value) => {
        console.log(value); // 9
      })

    // Listen for an event emitted by the child
    remoteHandle.addEventListener('some-child-event', (payload) => {
      console.log(payload) // 'Hi from child'
    });

    // Emit an evevent
    localHandle.emit('some-parent-event', 'Hi from parent');
  })
```

### Child code
```typescript
import { ChildHandshake, WindowMessenger } from 'ibridge';

// Define the methods you want to expose to the other window.
// Methods can either return values or Promises
const methods = {
  baz: (x) => x * 3,
}

// Start the handshake
// For safety it is strongly adviced to pass the explicit parent origin instead of '*'
const messenger = new WindowMessenger({
  remoteWindow: window.parent,
  remoteOrigin: '*'
});
const messenger = new WindowMessenger({ remoteOrigin: '*' });
ChildHandshake(methods, messenger)
  .then((connection) => {
    const localHandle = connection.localHandle();
    const remoteHandle = connection.remoteHandle();

    // Call a method on the parent
    remoteHandle.call('foo', 'ciao', 2)
      .then((value) => {
        console.log(value); // 8
      })

    // Listen for an event emitted by the child
    remoteHandle.addEventListener('some-parent-event', (payload) => {
      console.log(payload) // 'Hi from parent'
    });

    // Emit an evevent
    localHandle.emit('some-child-event', 'Hi from child');
  })
```

## Typescript
Thanks to `ibridge` typescript support, the correctness of the methods call arguments and event payloads can be statically enforced during development.

Ideally methods and events types should be defined in a third package that will be imported by both the parent and the child. This way, it will be ensured that both applications are working with up to date type definition.

Below a modified version of the previous example using typescript.

### Common code
```typescript
// common.ts

export type ParentMethods = {
  foo: (s: string, x: number) => number;
  bar: (x: number) => Promise<number>;
};

export type ParentEvents = {
  'some-parent-event': string;
}

export type ChildMethods = {
  baz: (x: number) => number;
};

export type ChildEvents = {
  'some-child-event': string;
}
```

### Parent code
```typescript
import { ParentHandshake, WindowMessenger, Connection } from 'ibridge';

import { ParentMethods, ParentEvents, ChildMethods, ChildEvents} from '/path/to/common';

// Create the child window any way you like (iframe here, but could be popup or tab too)
const childFrame = document.createElement('iframe');
childFrame.src = './child.html';
const childWindow = childFrame.contentWindow;

// Define the methods you want to expose to the other window.
// Methods can either return values or Promises
const methods: ParentMethods = {
  foo: (s, x) => s.length * x,
  bar: (x) => Promise.resolve(x * 2),
}

// Start the handshake
// For safety it is strongly adviced to pass the explicit child origin instead of '*'
const messenger = new WindowMessenger({
  remoteWindow: childWindow,
  remoteOrigin: '*'
});
ParentHandshake(methods, messenger);
  .then((connection: Connection<ParentEvents, ChildMethods, ChildEvents>) => {
    const localHandle = connection.localHandle();
    const remoteHandle = connection.remoteHandle();

    // Call a method on the child
    remoteHandle.call('baz', 3)
      .then((value) => {
        console.log(value); // 9
      })

    // Listen for an event emitted by the child
    remoteHandle.addEventListener('some-child-event', (payload) => {
      console.log(payload) // 'Hi from child'
    });

    // Emit an evevent
    localHandle.emit('some-parent-event', 'Hi from parent');
  })
```

### Child code
```typescript
import { ChildHandshake, WindowMessenger, Connection } from 'ibridge';

import { ParentMethods, ParentEvents, ChildMethods, ChildEvents} from '/path/to/common';

// Define the methods you want to expose to the other window.
// Methods can either return values or Promises
const methods: ChildMethods = {
  baz: (x) => x * 3,
}

// Start the handshake
// For safety it is strongly adviced to pass the explicit parent origin instead of '*'
const messenger = new WindowMessenger({
  remoteWindow: window.parent,
  remoteOrigin: '*'
});
ChildHandshake(methods, messenger)
  .then((connection: Connection<ChildEvents, ParentMethods, ParentEvents>) => {
    const localHandle = connection.localHandle();
    const remoteHandle = connection.remoteHandle();

    // Call a method on the parent
    remoteHandle.call('foo', 'ciao', 2)
      .then((value) => {
        console.log(value); // 8
      })

    // Listen for an event emitted by the child
    remoteHandle.addEventListener('some-parent-event', (payload) => {
      console.log(payload) // 'Hi from parent'
    });

    // Emit an evevent
    localHandle.emit('some-child-event', 'Hi from child');
  })
```

## Workers
A minimal example of using `ibridge` with a web worker can be found in the demo source code.
  - Parent: [source](https://github.com/ibridge-js/ibridge/blob/main/demo/parent.js#L162-L165)
  - Worker: [source](https://github.com/ibridge-js/ibridge/blob/main/demo/worker.js)

### Parent code
```typescript
import { ParentHandshake, WorkerMessenger } from 'ibridge';

// Create a dedicated web worker.
const worker = new Worker('./worker.js');

// Start the handshake
const messenger = new WorkerMessenger({ worker });
const methods = {};

ParentHandshake(methods, messenger).then((connection) => {
  const remoteHandle = connection.remoteHandle();

  // Call a method on the worker
  remoteHandle.call('sum', 3, 4)
    .then((value) => {
      console.log(value); // 7
    });

  remoteHandle.call('mul', 3, 4)
    .then((value) => {
      console.log(value); // 12
    });
})
```

### Worker code
```typescript
importScripts('./ibridge.umd.js');
const Ibridge = self['ibridge'];

const methods = {
  sum: (x, y) => x + y,
  mul: (x, y) => x * y,
};

const messenger = new Ibridge.WorkerMessenger({ worker: self });
Ibridge.ChildHandshake(methods, messenger).then((_connection) => {
  console.log('Worker successfully connected');
});
```