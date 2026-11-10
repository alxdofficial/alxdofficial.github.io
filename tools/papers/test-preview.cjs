'use strict';
const assert = require('node:assert/strict');
const { validDriveId, previewUrl, readQuery } = require('../../papers/assets/preview.js');
const good = 'AbcdefGhijk1234567890_-';
assert(validDriveId(good));
assert.equal(previewUrl(good), 'https://drive.google.com/file/d/' + good + '/preview');
for (const bad of ['', 'short', 'a'.repeat(201), 'https://example.com', '../somewhere', '<img src=x onerror=alert(1)>', 'goodid1234\n', 'javascript:alert(1)', null, 123]) {
  assert(!validDriveId(bad));
  assert.throws(() => previewUrl(bad));
}
assert.deepEqual(readQuery(''), {state:'empty'});
assert.deepEqual(readQuery('?video='+good), {state:'valid', id:good});
for (const query of ['?video='+good+'&video='+good, '?video='+good+'&target=https://evil.example', '?video=%3Cscript%3Ealert(1)%3C%2Fscript%3E', '?video=goodid1234%0A', '?video=https%3A%2F%2Fevil.example', '?other='+good]) assert.equal(readQuery(query).state,'invalid');
console.log('PASS: Drive preview validation, fixed host, duplicate/extra query rejection and unsafe-input rejection.');
