import typescript from 'rollup-plugin-typescript2';

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
  plugins: [typescript()]
}
