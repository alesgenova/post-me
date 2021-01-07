importScripts('https://unpkg.com/debug-browser/dist/index.js');
importScripts('./post-me.js');

const postMe = self['post-me'];
const debug = self['debug'];

debug.enable('post-me:worker');

const methods = {
  sum: (x, y) => x + y,
  mul: (x, y) => x * y,
};

const log = debug('post-me:worker');
let messenger = new postMe.WorkerMessenger({ worker: self });
messenger = postMe.DebugMessenger(messenger, log);
postMe.ChildHandshake(messenger, methods).then((_connection) => {});
