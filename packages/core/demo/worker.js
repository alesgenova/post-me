importScripts('https://unpkg.com/debug-browser/dist/index.js');
importScripts('./post-me.js');

const { WorkerMessenger, DebugMessenger, ChildHandshake } = PostMe;

debug.enable('post-me:worker');

const methods = {
  sum: (x, y) => x + y,
  mul: (x, y) => x * y,
};

const log = debug('post-me:worker');
let messenger = new WorkerMessenger({ worker: self });
messenger = DebugMessenger(messenger, log);
ChildHandshake(messenger, methods).then((_connection) => {});
