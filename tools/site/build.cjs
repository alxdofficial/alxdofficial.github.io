#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const output = path.join(root, '.site');
execFileSync(process.execPath, [path.join(root, 'tools/papers/build.cjs'), '--check'], { stdio: 'inherit' });
const source = JSON.parse(fs.readFileSync(path.join(root, 'papers/episodes.json'), 'utf8'));
const files = new Set(require('./public-files.json'));
for (const e of source.episodes) {
  files.add('papers/' + e.id + '/index.html');
  files.add('papers/' + e.transcript_path);
  files.add('papers/' + e.thumbnail_path);
}
// Only the reviewed public paths and catalog assets enter the Pages artifact.
for (const file of files) {
  if (path.isAbsolute(file) || file.split('/').some(p => !p || p === '..' || p === '.')) throw Error('Unsafe public path: ' + file);
  const full = path.join(root, file);
  if (fs.realpathSync(full) !== full || !fs.statSync(full).isFile()) throw Error('Expected a regular public file: ' + file);
}
fs.rmSync(output, { recursive: true, force: true });
for (const file of files) {
  const dest = path.join(output, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(root, file), dest);
}
console.log('Prepared ' + files.size + ' public files in .site/; source, tools and local artifacts are excluded.');
