importScripts('./post-me.umd.js');
const PostMe = self['post-me'];

const methods = {
  sum: (x, y) => x + y,
  mul: (x, y) => x * y,
};

PostMe.ChildHandshake(methods, '*', self).then((_connection) => {
  console.log('Worker successfully connected');
});
