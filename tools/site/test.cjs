'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const output = path.join(root, '.site');
const source = require('../../papers/episodes.json');
const expected = new Set(require('./public-files.json'));
for (const e of source.episodes) for (const file of [e.id + '/index.html', e.transcript_path, e.thumbnail_path]) expected.add('papers/' + file);
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir,e.name)) : [path.relative(output,path.join(dir,e.name))]);
}
assert.deepEqual(walk(output).sort(), [...expected].sort(), 'Only approved files are deployed');
for (const file of expected) assert.deepEqual(fs.readFileSync(path.join(output,file)),fs.readFileSync(path.join(root,file)), 'Public asset parity: ' + file);
for (const excluded of ['tools', '.git', '.github', 'README.md', 'papers/episodes.json', 'node_modules']) assert(!fs.existsSync(path.join(output,excluded)), 'Internal source excluded: ' + excluded);
const halo = fs.readFileSync(path.join(output,'halo/index.html'),'utf8');
assert(!/\/(?:home|Users)\//.test(halo), 'No local user paths in HALO');
assert(!/"(?:training_args|source_provenance|oof_cache)"/.test(halo), 'No internal training bookkeeping in HALO');
console.log('PASS: public artifact allowlist, public asset parity and HALO metadata boundaries.');
