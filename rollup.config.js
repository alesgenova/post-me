import typescript from '@rollup/plugin-typescript';
import babel from '@rollup/plugin-babel';

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
    input: 'dist/index.esm.js',
    output: [
      {
        name: 'PostMe',
        file: 'dist/index.js',
        format: 'umd'
      }
    ],
    plugins: [
      babel({ presets: ['@babel/preset-env'], babelHelpers: 'inline' }),
    ]
  }
]
