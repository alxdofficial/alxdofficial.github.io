'use strict';
const generate = require('./generate.cjs');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'papers/episodes.json'), 'utf8'));
const transcripts = Object.fromEntries(source.episodes.map(e => [e.id, fs.readFileSync(path.join(root, 'papers', e.transcript_path), 'utf8')]));
const templates = Object.fromEntries(['shell','home'].map(k => [k, fs.readFileSync(path.join(__dirname, 'templates', k + '.html'), 'utf8')]));
function runTests(generate,source,transcripts,templates) {
 const assert=(v,message)=>{if(!v)throw Error(message);};
 const a=generate(source,transcripts,templates),b=generate(source,transcripts,templates);
 assert(JSON.stringify(a)===JSON.stringify(b),'Deterministic generation');
 assert(Object.keys(a).length===source.episodes.length+4,'Output count');
 for(const e of source.episodes){
  const html=a[e.id+'/index.html'];
  assert(html.includes(e.title.replaceAll('&','&amp;')),'Full title '+e.id);
  assert(html.includes(e.venue)&&html.includes(e.publication_status.toUpperCase()),'Visible publication metadata '+e.id);
  assert(html.includes('watch-cta')&&html.includes('aria-label="Watch '),'Accessible Watch button '+e.id);
  const cat=JSON.parse(a['catalog.json']).episodes.find(x=>x.id===e.id);
  assert(cat.transcript===transcripts[e.id],'Transcript parity '+e.id);
  assert(cat.verified_source_url===e.paper_url,'Source verification URL '+e.id);
  if(e.thumbnail_source_url){
   assert(html.includes(e.thumbnail_credit)&&html.includes(e.thumbnail_license_url)&&html.includes(e.thumbnail_changes),'Visible thumbnail attribution and changes '+e.id);
   assert(html.includes('/papers/'+e.thumbnail_path)&&html.includes('Full figure'),'Full-size original figure link '+e.id);
  }
  const schema=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
  assert(schema.name===e.title&&schema.duration==='PT'+e.duration_seconds+'S','Schema '+e.id);
  assert(!html.includes('{{'),'No unresolved template');
 }
 assert(a['latent/index.html'].includes('2:45'),'Half-second duration rounding');
 const newest=source.episodes.map(e=>e.published).sort().at(-1), future=new Date(new Date(newest+'T00:00:00Z').getTime()+86400000).toISOString().slice(0,10);
 const cloned=JSON.parse(JSON.stringify(source)), e={...cloned.episodes[0],id:'test-future',published:future,transcript_path:'test-future/transcript.txt',playlists:['research','health']};
 cloned.episodes.push(e);
 const c=generate(cloned,{...transcripts,'test-future':transcripts[e.id]||transcripts[source.episodes[0].id]},templates);
 assert(c['index.html'].indexOf('data-date="'+future+'"')<c['index.html'].indexOf('data-date="'+newest+'"'),'Newest first');
 assert(c['index.html'].includes('value="'+future+'"'),'Date filter added');
 assert(c['index.html'].includes('date='+future+'#episodes'),'Archive added');
 assert(JSON.parse(c['catalog.json']).episodes.length===source.episodes.length+1,'One record, no playlist duplicates');
 assert(c['feed.xml'].includes('/test-future/'),'RSS new episode');
 assert(c['sitemap.xml'].includes('/test-future/'),'Sitemap new episode');
 assert(c['index.html'].includes('02 / '+(source.episodes.filter(e=>e.playlists.includes('health')).length+1)+' EPISODES'),'Playlist updated');
 // Creation order deliberately differs from paper publication and revision order.
 const chronology=JSON.parse(JSON.stringify(source));
 chronology.episodes=source.episodes.slice(0,3).map((e,i)=>({...e,
   published:['2026-10-20','2026-10-21','2026-10-21'][i],
   paper_date:['2026-10-19','2026-09-01','2026-09-02'][i],
   paper_revised:['2026-10-19','2026-09-03','2026-09-04'][i],
   playlists:['research','health','across-ai']
 }));
 const ordered=generate(chronology,transcripts,templates), home=ordered['index.html'];
 const expected=[chronology.episodes[1],chronology.episodes[2],chronology.episodes[0]].map(e=>e.id);
 const catalog=JSON.parse(ordered['catalog.json']);
 assert(JSON.stringify(catalog.episodes.map(e=>e.id))===JSON.stringify(expected),'Video creation order with stable same-day ties, independent of paper dates');
 const cards=[...home.matchAll(/<article class="episode"[\s\S]*?<h3><a href="\/papers\/([^/]+)\//g)].map(m=>m[1]);
 assert(JSON.stringify(cards)===JSON.stringify(expected),'Static channel creation order');
 assert(home.includes('Video created<select id="date"'),'Date filter names video creation');
 assert(home.includes('By video creation day.'),'Archive names video creation');
 assert(home.indexOf('value="2026-10-21"')<home.indexOf('value="2026-10-20"'),'Creation date options newest first');
 assert(home.indexOf('?date=2026-10-21#episodes')<home.indexOf('?date=2026-10-20#episodes'),'Archive groups newest first');
 assert(home.includes('data-date="2026-10-21"')&&!home.includes('data-date="2026-09-01"'),'Groups use creation date, not paper date');
 assert(home.match(/<section class="featured"[\s\S]*?<a [^>]*href="([^"]+)"/)[1]==='/papers/'+expected[0]+'/','Latest video featured');
 for(const id of expected){
   assert(ordered[id+'/index.html'].includes('VIDEO CREATED:'),'Watch page labels creation date');
   assert(ordered[id+'/index.html'].includes('PAPER:')&&ordered[id+'/index.html'].includes('REVISED'),'Paper and version dates remain separate');
 }
 assert(ordered['feed.xml'].indexOf('/'+expected[0]+'/')<ordered['feed.xml'].indexOf('/'+expected[2]+'/'),'Feed follows video creation order');
 for(const mutate of [
  s=>s.episodes.push({...s.episodes[0]}),
  s=>delete s.episodes[0].publication_status,
  s=>s.episodes[0].playlists=['invalid'],
  s=>s.episodes[0].transcript_path='../private.txt',
  s=>s.episodes[0].duration_seconds=-1,
  s=>s.episodes[0].paper_date='2026-02-30',
  s=>s.episodes[0].video_id='bad',
  s=>s.episodes[0].thumbnail_source_url='https://example.com/unverified.png'
 ]) {
  const bad=JSON.parse(JSON.stringify(source));mutate(bad);let failed=false;
  try{generate(bad,transcripts,templates);}catch{failed=true;}assert(failed,'Invalid record rejected');
 }
 return 'PASS: deterministic generation, title/publication metadata, transcript parity, schema, duration, synthetic daily ingestion, video creation chronology, archive/playlists/feed/sitemap, invalid-input rejection.';
}
console.log(runTests(generate, source, transcripts, templates));
