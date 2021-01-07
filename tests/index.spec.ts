import { ParentHandshake, ChildHandshake } from '../src/handshake';
import { Connection } from '../src/connection';
import {
  Messenger,
  WindowMessenger,
  DebugMessenger,
  debug,
} from '../src/messenger';

import { JSDOM } from 'jsdom';

import MessageEventJSDOM from 'jsdom/lib/jsdom/living/generated/MessageEvent';
import { fireAnEvent } from 'jsdom/lib/jsdom/living/helpers/events';

type ChildMethods = {
  foo: (x: number) => number;
  bar: () => Promise<{ status: number; message: string }>;
  throws: () => Promise<number>;
  ping: (s: string) => string;
};

type ChildEvents = {
  clicked: number;
  tapped: string;
};

type ParentMethods = {
  baz: (x: number, s: string) => number;
  wut: () => Promise<string>;
  throws: () => Promise<number>;
  ping: (s: string) => string;
};

type ParentEvents = {
  opened: { type: string; message: string };
  closed: string;
};

const parentMethods: ParentMethods = {
  baz: (x, s) => x * s.length,
  wut: () => Promise.resolve('Oh hi!'),
  throws: () => Promise.reject(new Error('Oh no! - parent')),
  ping: (s) => s,
};

const childMethods: ChildMethods = {
  foo: (x) => x * 2,
  bar: () => Promise.resolve({ status: 200, message: 'ok' }),
  throws: () => Promise.reject(new Error('Oh no! - child')),
  ping: (s) => s,
};

function bindPostMessageToSource(target: Window, source: Window) {
  // A simplified copy of JSDOM postMessage, that adds a fixed origin and source to the event.
  return function (message: any, targetOrigin: string) {
    if (arguments.length < 2) {
      throw new TypeError(
        "'postMessage' requires 2 arguments: 'message' and 'targetOrigin'"
      );
    }

    if (targetOrigin !== '*' && targetOrigin !== target.origin) {
      return;
    }

    setTimeout(() => {
      fireAnEvent('message', target, MessageEventJSDOM, {
        source,
        origin: source.origin,
        data: message,
      });
    }, 0);
  };
}

function makeWindows(parentOrigin: string, childOrigin: string) {
  const parentDOM = new JSDOM(``, { url: parentOrigin });
  const childDOM = new JSDOM(``, { url: childOrigin });

  const parentWindow: Window = parentDOM.window as any;
  const childWindow: Window = childDOM.window as any;

  parentWindow.postMessage = bindPostMessageToSource(parentWindow, childWindow);
  childWindow.postMessage = bindPostMessageToSource(childWindow, parentWindow);

  return [parentWindow, childWindow] as const;
}

function makeHandshake(
  _windows?: [Window, Window]
): Promise<
  [
    Connection<ParentEvents, ChildMethods, ChildEvents>,
    Connection<ChildEvents, ParentMethods, ParentEvents>
  ]
> {
  let windows =
    _windows ||
    makeWindows('https://parent.example.com', 'https://child.example.com');
  const [parentWindow, childWindow] = windows;

  const parentMessenger = new WindowMessenger({
    localWindow: parentWindow,
    remoteWindow: childWindow,
    remoteOrigin: childWindow.origin,
  });
  const childMessenger = new WindowMessenger({
    localWindow: childWindow,
    remoteWindow: parentWindow,
    remoteOrigin: parentWindow.origin,
  });
  const handshakes = [
    ParentHandshake(parentMessenger, parentMethods),
    ChildHandshake(childMessenger, childMethods),
  ] as const;

  return Promise.all(handshakes);
}

function sleep(duration: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

test('handshake', () => {
  return new Promise<void>((resolve) => {
    makeHandshake().then(([_parentConnection, _childConnection]) => {
      resolve();
    });
  });
});

test('call', () => {
  return new Promise<void>((resolve, reject) => {
    makeHandshake().then(([parentConnection, childConnection]) => {
      const tasks: Promise<any>[] = [];

      // Code in the parent app
      {
        const remoteHandle = parentConnection.remoteHandle();

        const args0 = [2] as const;

        const task0 = remoteHandle.call('foo', ...args0).then(async (value) => {
          expect(value).toEqual(childMethods.foo(...args0));
          return value;
        });
        tasks.push(task0);

        const args1 = [] as const;
        const task1 = remoteHandle.call('bar', ...args1).then(async (value) => {
          expect(value).toEqual(await childMethods.bar(...args1));
          return value;
        });
        tasks.push(task1);
      }

      // Code in the child app
      {
        const remoteHandle = childConnection.remoteHandle();

        const args0 = [2, 'four'] as const;

        const task0 = remoteHandle.call('baz', ...args0).then(async (value) => {
          expect(value).toEqual(parentMethods.baz(...args0));
          return value;
        });
        tasks.push(task0);

        const args1 = [] as const;
        const task1 = remoteHandle.call('wut', ...args1).then(async (value) => {
          expect(value).toEqual(await parentMethods.wut(...args1));
          return value;
        });
        tasks.push(task1);
      }

      Promise.all(tasks).then(() => resolve());
    });
  });
});

test('emit', () => {
  return new Promise<void>((resolve, reject) => {
    makeHandshake().then(([parentConnection, childConnection]) => {
      const tasks: Promise<any>[] = [];

      const maxRunTime = 500;
      const nEmits = 4;

      const messageFromParent: ParentEvents['opened'] = {
        type: 'foo',
        message: 'bar',
      };
      const messageFromChild: ChildEvents['tapped'] =
        'Emitting an important message!';

      // Code in the parent app
      {
        const remoteHandle = parentConnection.remoteHandle();

        const task0 = new Promise((resolve) => {
          let count = 0;
          remoteHandle.addEventListener('tapped', (data) => {
            expect(data).toEqual(messageFromChild);
            count += 1;
          });

          setTimeout(() => {
            expect(count).toEqual(nEmits);
            resolve(count);
          }, maxRunTime);
        });
        tasks.push(task0);

        const task1 = new Promise((resolve) => {
          let count = 0;
          // Remove listener
          const listener = (data: typeof messageFromChild) => {
            remoteHandle.removeEventListener('tapped', listener);
            expect(data).toEqual(messageFromChild);
            count += 1;
          };
          remoteHandle.addEventListener('tapped', listener);

          setTimeout(() => {
            expect(count).toEqual(1);
            resolve(count);
          }, maxRunTime);
        });
        tasks.push(task1);

        const task2 = new Promise((resolve) => {
          let count = 0;
          remoteHandle.once('tapped').then((data) => {
            expect(data).toEqual(messageFromChild);
            count += 1;
          });

          setTimeout(() => {
            expect(count).toEqual(1);
            resolve(count);
          }, maxRunTime);
        });
        tasks.push(task2);

        const localHanlde = parentConnection.localHandle();
        setTimeout(() => {
          for (let i = 0; i < nEmits; ++i) {
            localHanlde.emit('opened', messageFromParent);
          }
        }, 50);
      }

      // Code in the child app
      {
        const remoteHandle = childConnection.remoteHandle();

        const task0 = new Promise((resolve) => {
          let count = 0;
          remoteHandle.addEventListener('opened', (data) => {
            expect(data).toEqual(messageFromParent);
            count += 1;
          });

          setTimeout(() => {
            expect(count).toEqual(nEmits);
            resolve(count);
          }, maxRunTime);
        });
        tasks.push(task0);

        const task1 = new Promise((resolve) => {
          let count = 0;
          // Remove listener
          const listener = (data: typeof messageFromParent) => {
            remoteHandle.removeEventListener('opened', listener);
            expect(data).toEqual(messageFromParent);
            count += 1;
          };
          remoteHandle.addEventListener('opened', listener);

          setTimeout(() => {
            expect(count).toEqual(1);
            resolve(count);
          }, maxRunTime);
        });
        tasks.push(task1);

        const task2 = new Promise((resolve) => {
          let count = 0;
          remoteHandle.once('opened').then((data) => {
            expect(data).toEqual(messageFromParent);
            count += 1;
          });

          setTimeout(() => {
            expect(count).toEqual(1);
            resolve(count);
          }, maxRunTime);
        });
        tasks.push(task2);

        const localHanlde = childConnection.localHandle();
        setTimeout(() => {
          for (let i = 0; i < nEmits; ++i) {
            localHanlde.emit('tapped', messageFromChild);
          }
        }, 50);
      }

      Promise.all(tasks).then(() => resolve());
    });
  });
});

test('error', () => {
  return new Promise<void>((resolve, reject) => {
    makeHandshake().then(([parentConnection, childConnection]) => {
      const tasks: Promise<any>[] = [];

      // Code in the parent app
      {
        const remoteHandle = parentConnection.remoteHandle();

        const args0 = [] as const;

        // The method actually throws an error
        const task0 = remoteHandle
          .call('throws', ...args0)
          .then((_value) => {
            throw new Error("It shouldn't have resolved");
          })
          .catch((e: Error) => {
            expect(e.message).toEqual('Oh no! - child');
            return e;
          });
        tasks.push(task0);

        // The method doesn't exist (typescript would actually catch the mistake during dev)
        const task1 = remoteHandle
          .call('whatever' as any, ...[])
          .then((_value) => {
            throw new Error("It shouldn't have resolved");
          })
          .catch((e: Error) => {
            expect(e.message).toEqual(
              `The method "whatever" has not been implemented.`
            );
            return e;
          });
        tasks.push(task1);
      }

      // Code in the child app
      {
        const remoteHandle = childConnection.remoteHandle();

        const args0 = [] as const;

        // The method actually throws an error
        const task0 = remoteHandle
          .call('throws', ...args0)
          .then((_value) => {
            throw new Error("It shouldn't have resolved");
          })
          .catch((e: Error) => {
            expect(e.message).toEqual('Oh no! - parent');
            return e;
          });
        tasks.push(task0);

        // The method doesn't exist (typescript would actually catch the mistake during dev)
        const task1 = remoteHandle
          .call('anything' as any, ...[])
          .then((_value) => {
            throw new Error("It shouldn't have resolved");
          })
          .catch((e: Error) => {
            expect(e.message).toEqual(
              `The method "anything" has not been implemented.`
            );
            return e;
          });
        tasks.push(task1);
      }

      Promise.all(tasks).then(() => resolve());
    });
  });
});

test('close', () => {
  return new Promise<void>((resolve, reject) => {
    makeHandshake().then(([parentConnection, childConnection]) => {
      const tasks: Promise<any>[] = [];

      const maxRunTime = 500;
      const nEmits = 4;

      const messageFromChild: ChildEvents['tapped'] =
        'Emitting an important message!';

      // Code in the parent app
      {
        const remoteHandle = parentConnection.remoteHandle();

        const task0 = new Promise<void>((resolve, reject) => {
          remoteHandle.addEventListener('tapped', (data) => {
            expect(data).toEqual(messageFromChild);
            reject(new Error(`Shouldn't receive after connection close`));
          });

          setTimeout(() => {
            parentConnection.close();
          }, 0);

          setTimeout(() => {
            resolve();
          }, maxRunTime);
        });
        tasks.push(task0);
      }

      // Code in the child app
      {
        const localHanlde = childConnection.localHandle();
        setTimeout(() => {
          for (let i = 0; i < nEmits; ++i) {
            localHanlde.emit('tapped', messageFromChild);
          }
        }, 50);
      }

      Promise.all(tasks).then(() => resolve());
    });
  });
});

test('handshake fail due to wrong origin', () => {
  return new Promise<void>((resolve, reject) => {
    const parentOrigin = 'https://parent.example.com';
    const childOrigin = 'https://child.example.com';
    const wrongParentOrigin = 'https://wrong.example.com';
    const [parentWindow, childWindow] = makeWindows(parentOrigin, childOrigin);

    const maxRunTime = 500;

    const parentMessenger = new WindowMessenger({
      localWindow: parentWindow,
      remoteWindow: childWindow,
      remoteOrigin: childOrigin,
    });
    const childMessenger = new WindowMessenger({
      localWindow: childWindow,
      remoteWindow: parentWindow,
      remoteOrigin: wrongParentOrigin,
    });

    const parentHandshake = ParentHandshake(parentMessenger);
    const childHandshake = ChildHandshake(childMessenger);

    parentHandshake
      .then((_connection) => {
        reject(new Error('The handshake should be failing. - parent'));
      })
      .catch(resolve);

    childHandshake.then((_connection) => {
      reject(new Error('The handshake should be failing. - child'));
    });
  });
});

xtest('multi-connection', () => {
  return new Promise<void>((resolve, reject) => {
    // One parent connected to two children

    const parentOrigin = 'https://parent.example.com';
    const child0Origin = 'https://child0.example.com';
    const child1Origin = 'https://child0.example.com';
    // Because of JSDOM limitations, the two child windows need to have the same origin
    const [parentWindow, child0Window] = makeWindows(
      parentOrigin,
      child0Origin
    );

    const child1Window: Window = new JSDOM(``, { url: child1Origin })
      .window as any;
    child1Window.postMessage = bindPostMessageToSource(
      child1Window,
      parentWindow
    );

    const maxRunTime = 500;
    const nEmits = 4;

    makeHandshake([parentWindow, child0Window]).then(
      ([parent0Connection, child0Connection]) => {
        parentWindow.postMessage = bindPostMessageToSource(
          parentWindow,
          child1Window
        );
        makeHandshake([parentWindow, child1Window]).then(
          ([parent1Connection, child1Connection]) => {
            const tasks: Promise<any>[] = [];
            {
              // Parent Code
              {
                // Child 0 connection
                const localHandle = parent0Connection.localHandle();
                const remoteHandle = parent0Connection.remoteHandle();

                const task0 = remoteHandle
                  .call('ping', 'child0')
                  .then((res) => {
                    expect(res).toEqual('child0');
                    return res;
                  });
                tasks.push(task0);

                const task1 = new Promise((resolve) => {
                  let count = 0;
                  remoteHandle.addEventListener('clicked', (data) => {
                    expect(data).toEqual(0);
                    count += 1;
                  });

                  setTimeout(() => {
                    expect(count).toEqual(nEmits);
                    resolve(count);
                  }, maxRunTime);
                });
                tasks.push(task1);

                setTimeout(() => {
                  for (let i = 0; i < nEmits; ++i) {
                    localHandle.emit('opened', {
                      type: 'foo',
                      message: 'child0',
                    });
                  }
                }, 50);
              }
              {
                // Child 1 connection
                const localHandle = parent1Connection.localHandle();
                const remoteHandle = parent1Connection.remoteHandle();

                const task0 = remoteHandle
                  .call('ping', 'child0')
                  .then((res) => {
                    expect(res).toEqual('child0');
                    return res;
                  });
                tasks.push(task0);

                const task1 = new Promise((resolve) => {
                  let count = 0;
                  remoteHandle.addEventListener('clicked', (data) => {
                    expect(data).toEqual(1);
                    count += 1;
                  });

                  setTimeout(() => {
                    expect(count).toEqual(nEmits);
                    resolve(count);
                  }, maxRunTime);
                });
                tasks.push(task1);

                setTimeout(() => {
                  for (let i = 0; i < nEmits; ++i) {
                    localHandle.emit('opened', {
                      type: 'foo',
                      message: 'child1',
                    });
                  }
                }, 50);
              }
            }

            {
              // Child0 Code
              const localHandle = child0Connection.localHandle();
              const remoteHandle = child0Connection.remoteHandle();

              const task0 = new Promise((resolve) => {
                let count = 0;
                remoteHandle.addEventListener('opened', (data) => {
                  expect(data.message).toEqual('child0');
                  count += 1;
                });

                setTimeout(() => {
                  expect(count).toEqual(nEmits);
                  resolve(count);
                }, maxRunTime);
              });
              tasks.push(task0);

              setTimeout(() => {
                for (let i = 0; i < nEmits; ++i) {
                  localHandle.emit('clicked', 0);
                }
              }, 50);
            }

            {
              // Child1 Code
              const localHandle = child1Connection.localHandle();
              const remoteHandle = child1Connection.remoteHandle();

              const task0 = new Promise((resolve) => {
                let count = 0;
                remoteHandle.addEventListener('opened', (data) => {
                  expect(data.message).toEqual('child1');
                  count += 1;
                });

                setTimeout(() => {
                  expect(count).toEqual(nEmits);
                  resolve(count);
                }, maxRunTime);
              });
              tasks.push(task0);

              setTimeout(() => {
                for (let i = 0; i < nEmits; ++i) {
                  localHandle.emit('clicked', 1);
                }
              }, 50);
            }

            Promise.all(tasks).then(() => resolve());
          }
        );
      }
    );
  });
});

test('parent handshake before child', async () => {
  const parentOrigin = 'https://parent.example.com';
  const childOrigin = 'https://child.example.com';
  const [parentWindow, childWindow] = makeWindows(parentOrigin, childOrigin);
  let parentConnection: Promise<Connection>,
    childConnection: Promise<Connection>;

  const parentMessenger = new WindowMessenger({
    localWindow: parentWindow,
    remoteWindow: childWindow,
    remoteOrigin: childWindow.origin,
  });
  parentConnection = ParentHandshake(parentMessenger);

  await sleep(100);

  const childMessenger = new WindowMessenger({
    localWindow: childWindow,
    remoteWindow: parentWindow,
    remoteOrigin: parentWindow.origin,
  });
  childConnection = ChildHandshake(childMessenger);
  await Promise.all([parentConnection, childConnection]);
});

test('child handshake before parent', async () => {
  const parentOrigin = 'https://parent.example.com';
  const childOrigin = 'https://child.example.com';
  const [parentWindow, childWindow] = makeWindows(parentOrigin, childOrigin);
  let parentConnection: Promise<Connection>,
    childConnection: Promise<Connection>;

  const childMessenger = new WindowMessenger({
    localWindow: childWindow,
    remoteWindow: parentWindow,
    remoteOrigin: parentWindow.origin,
  });
  childConnection = ChildHandshake(childMessenger);

  await sleep(100);

  const parentMessenger = new WindowMessenger({
    localWindow: parentWindow,
    remoteWindow: childWindow,
    remoteOrigin: childWindow.origin,
  });
  parentConnection = ParentHandshake(parentMessenger);

  await Promise.all([childConnection, parentConnection]);
});

test('debug', () => {
  const makeBouceBackMessenger = function (): Messenger {
    const listeners = new Set<(event: MessageEvent) => void>();
    return {
      postMessage: function (message: any) {
        listeners.forEach((listener) => {
          listener({ data: message } as any);
        });
      },
      addMessageListener: function (listener) {
        listeners.add(listener);
        return function () {
          listeners.delete(listener);
        };
      },
    };
  };

  const jestLog = jest.fn();
  const namespace = 'post-me';
  const log = debug(namespace, jestLog);

  let messenger = makeBouceBackMessenger();
  messenger = DebugMessenger(messenger, log);

  messenger.postMessage(1);
  messenger.postMessage(2);

  expect(jestLog).toHaveBeenCalledWith(namespace, '➡️ sending message', 1);
  expect(jestLog).toHaveBeenCalledWith(namespace, '⬅️ received message', 1);
  expect(jestLog).toHaveBeenCalledWith(namespace, '➡️ sending message', 2);
  expect(jestLog).toHaveBeenCalledWith(namespace, '⬅️ received message', 2);
  expect(jestLog).toHaveBeenCalledTimes(4);
});
