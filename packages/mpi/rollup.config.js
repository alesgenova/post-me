import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { getBabelOutputPlugin } from '@rollup/plugin-babel';

export default [
  {
    input: 'src/index.ts',
    output: [
      // ES Module, straight TS to JS compilation
      {
        file: 'dist/index.esnext.mjs',
        format: 'esm'
      },
      // ES Module, transpiled to ES5
      {
        file: 'dist/index.mjs',
        format: 'esm',
        plugins: [
          getBabelOutputPlugin({
            presets: [['@babel/preset-env', { modules: false }]]
          })
        ]
      }
    ],
    plugins: [typescript({ target: 'esnext', module: 'esnext', declaration: false })]
  },
  {
    input: 'src/index.ts',
    output: [
      // UMD, transpiled to ES5
      {
        file: 'dist/index.js',
        format: 'esm',
        plugins: [
          getBabelOutputPlugin({
            moduleId: '@post-me/mpi',
            presets: [['@babel/preset-env', { modules: 'umd' }]],
          })
        ]
      }
    ],
    plugins: [nodeResolve(), typescript({ target: 'esnext', module: 'esnext', declaration: false })]
  }
]
