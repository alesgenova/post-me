importScripts('./ibridge.umd.js');
const ibridge = self['ibridge'];

const methods = {
  sum: (x, y) => x + y,
  mul: (x, y) => x * y,
};

const messenger = new ibridge.WorkerMessenger(self);
new ibridge.Child(messenger, methods).handshake().then((_connection) => {
  console.log('Worker successfully connected');
});
