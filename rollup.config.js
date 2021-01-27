import typescript from '@rollup/plugin-typescript';
import { getBabelOutputPlugin } from '@rollup/plugin-babel';

export default {
  input: 'src/index.ts',
  output: [
    // ES Module, straight TS to JS compilation
    {
      file: 'dist/index.esnext.mjs',
      format: 'esm'
    },
    // ES Module, transpiled to ES5
    {
      file: 'dist/index.es5.mjs',
      format: 'esm',
      plugins: [
        getBabelOutputPlugin({
          presets: [['@babel/preset-env', { modules: false }]]
        })
      ]
    },
    // UMD, transpiled to ES5
    {
      file: 'dist/index.js',
      format: 'esm',
      plugins: [
        getBabelOutputPlugin({
          moduleId: 'PostMe',
          presets: [['@babel/preset-env', { modules: 'umd' }]],
        })
      ]
    }
  ],
  plugins: [typescript({ target: 'esnext', module: 'esnext', declaration: false })]
}
