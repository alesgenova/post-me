const argv = process.argv.slice(2);

if (argv.length === 0) {
  throw new Error('Pleas provide a destination folder.');
}

const destination = argv[0];

const fs = require('fs-extra');

if (fs.existsSync(destination)) {
  fs.rmdirSync(destination, { recursive: true });
}

fs.mkdirSync(destination);

fs.copySync('dist/index.esm.js', `${destination}/post-me.esm.js`);
fs.copySync('dist/index.min.js', `${destination}/post-me.js`);
fs.copySync('demo', destination);
