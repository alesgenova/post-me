// TODO: Need to adjust the rollup configuration, because the bundle generated when including 'debug' doesn't work in the browser

// import debugFactory from 'debug';

// function debugFactory(namespace: string, log?: (...data: any[]) => void) {
//     log = log || console.debug || console.log || (() => { });
//     return (...data: any[]) => {
//         log!(namespace, ...data);
//     };
// };

let debugFactory = function (_namespace: string) {
  return function (..._args: any[]) {};
};

export default debugFactory;
