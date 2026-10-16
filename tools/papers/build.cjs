#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const generate = require('./generate.cjs');
const root = path.resolve(__dirname, '../..');
const papers = path.join(root, 'papers');
const sourceFile = path.join(papers, 'episodes.json');
const args = process.argv.slice(2);
if (args.length && !(args.length === 1 && args[0] === '--check') && !(args.length === 2 && args[0] === '--add')) {
  throw Error('Usage: node tools/papers/build.cjs [--check | --add episode.json]');
}
const source = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
if (args[0] === '--add') source.episodes.push(JSON.parse(fs.readFileSync(path.resolve(args[1]), 'utf8')));
const transcripts = {};
for (const episode of source.episodes) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(episode.id) || episode.transcript_path !== episode.id + '/transcript.txt' || !/^assets\/[a-z0-9-]+\.(jpg|png|webp)$/.test(episode.thumbnail_path)) throw Error('Unsafe asset path');
  transcripts[episode.id] = fs.readFileSync(path.join(papers, episode.transcript_path), 'utf8');
  if (!fs.statSync(path.join(papers, episode.thumbnail_path)).isFile()) throw Error('Thumbnail missing: ' + episode.id);
}
const templates = {
  shell: fs.readFileSync(path.join(__dirname, 'templates/shell.html'), 'utf8'),
  home: fs.readFileSync(path.join(__dirname, 'templates/home.html'), 'utf8')
};
const outputs = generate(source, transcripts, templates); // Validate every record before writing anything.
if (args[0] === '--check') {
  for (const [name, content] of Object.entries(outputs)) {
    const file = path.join(papers, name);
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content) throw Error('Generated file is stale: papers/' + name + '. Run node tools/papers/build.cjs');
  }
  console.log('Generated pages, catalog, dates, playlists, RSS and sitemap are current.');
} else {
  for (const [name, content] of Object.entries(outputs)) {
    const file = path.join(papers, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  if (args[0] === '--add') fs.writeFileSync(sourceFile, JSON.stringify(source, null, 2) + '\n');
  console.log('Built ' + source.episodes.length + ' episodes. Review and commit manually; this command never publishes.');
}
module.exports = { source, transcripts, templates };
