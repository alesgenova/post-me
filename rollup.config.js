import typescript from '@rollup/plugin-typescript';

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.esm.js',
        format: 'esm'
      }
    ],
    plugins: [typescript({ target: 'esnext', module: 'esnext', declaration: false })]
  },
  {
    input: 'src/index.ts',
    output: [
      {
        name: 'post-me',
        file: 'dist/index.js',
        format: 'umd'
      }
    ],
    plugins: [typescript({ target: 'es5', declaration: false })]
  }
]
