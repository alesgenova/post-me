import typescript from 'rollup-plugin-typescript2';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'src/index.ts',
  output: [
    {
      name: 'ibridge',
      file: 'dist/index.umd.js',
      format: 'umd'
    },
    {
      file: 'dist/index.esm.js',
      format: 'esm'
    }
  ],
  plugins: [resolve(), commonjs(), typescript()]
}
