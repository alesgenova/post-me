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
