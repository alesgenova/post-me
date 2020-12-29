importScripts('./post-me.umd.js');
const PostMe = self['post-me'];

const methods = {
  sum: (x, y) => x + y,
  mul: (x, y) => x * y,
};

const messenger = new PostMe.WorkerMessenger({ worker: self });
PostMe.ChildHandshake(methods, messenger).then((_connection) => {
  console.log('Worker successfully connected');
});
