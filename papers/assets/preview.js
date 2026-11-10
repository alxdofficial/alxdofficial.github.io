(function () {
  'use strict';
  const validDriveId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{10,200}$/.test(value);
  function previewUrl(id) {
    if (!validDriveId(id)) throw new TypeError('Invalid Drive file ID');
    return 'https://drive.google.com/file/d/' + id + '/preview';
  }
  function readQuery(search) {
    const params = new URLSearchParams(search);
    if (!params.size) return { state: 'empty' };
    const ids = params.getAll('video');
    if (params.size !== 1 || ids.length !== 1 || !validDriveId(ids[0])) return { state: 'invalid' };
    return { state: 'valid', id: ids[0] };
  }
  if (typeof module === 'object' && module.exports) {
    module.exports = { validDriveId, previewUrl, readQuery };
    return;
  }
  const result = readQuery(window.location.search);
  const message = document.getElementById('preview-status');
  if (result.state === 'empty') return;
  if (result.state === 'invalid') {
    message.textContent = 'Invalid input. Enter only a Drive file ID, not a URL. No video was loaded.';
    return;
  }
  document.getElementById('video-id').value = result.id;
  const frame = document.createElement('iframe');
  frame.src = previewUrl(result.id);
  frame.title = 'Drive video playback preview';
  frame.allow = 'autoplay; fullscreen';
  frame.allowFullscreen = true;
  document.getElementById('preview-player').appendChild(frame);
  message.textContent = 'Preview loaded. Start playback and verify it advances. This is not a publication or a readiness result.';
})();
