'use strict';
const form = document.querySelector('.filters');
if (form) {
  const search = document.querySelector('#search'), playlist = document.querySelector('#playlist'), date = document.querySelector('#date');
  const cards = [...document.querySelectorAll('#episodes .episode')];
  function fromURL() {
    const p = new URLSearchParams(location.search);
    search.value = p.get('q') || '';
    playlist.value = [...playlist.options].some(o => o.value === p.get('playlist')) ? p.get('playlist') : 'all';
    date.value = [...date.options].some(o => o.value === p.get('date')) ? p.get('date') : 'all';
    filter(false);
  }
  function filter(update = true) {
    const words = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let count = 0;
    cards.forEach(c => {
      c.hidden = !words.every(w => c.dataset.search.includes(w)) || (playlist.value !== 'all' && !c.dataset.playlists.split(' ').includes(playlist.value)) || (date.value !== 'all' && date.value !== c.dataset.date);
      if (!c.hidden) count++;
    });
    document.querySelector('#results').textContent = `${count} episode${count === 1 ? '' : 's'}`;
    document.querySelector('#empty').hidden = count !== 0;
    document.querySelector('#empty-detail').textContent = playlist.value !== 'all' && !cards.some(c => c.dataset.playlists.split(' ').includes(playlist.value)) ? 'This playlist has no published episodes yet. Explore Research for the launch edition.' : 'Try another playlist, date, or search.';
    if (update) {
      const p = new URLSearchParams();
      if (search.value.trim()) p.set('q', search.value.trim());
      if (playlist.value !== 'all') p.set('playlist', playlist.value);
      if (date.value !== 'all') p.set('date', date.value);
      history.replaceState(null, '', location.pathname + (p.size ? '?' + p : '') + location.hash);
    }
  }
  form.addEventListener('submit', e => { e.preventDefault(); filter(); });
  form.addEventListener('input', () => filter());
  form.addEventListener('change', () => filter());
  form.addEventListener('reset', () => { search.value=''; playlist.value='all'; date.value='all'; filter(); });
  window.addEventListener('popstate', fromURL);
  fromURL();
}
document.querySelectorAll('.load-video').forEach(button => button.addEventListener('click', () => {
  const container = button.closest('.player');
  if (container.querySelector('iframe')) return;
  const iframe = document.createElement('iframe');
  iframe.src = container.dataset.embed;
  iframe.title = document.querySelector('h1').textContent + ' video player';
  iframe.allow = 'autoplay; fullscreen';
  iframe.allowFullscreen = true;
  container.replaceChildren(iframe);
  iframe.focus();
}));

const menuButton = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('#main-nav');
if (menuButton && mainNav) {
  document.documentElement.classList.add('js');
  menuButton.hidden = false;
  const mobile = matchMedia('(max-width: 680px)');
  function setMenu(open, restoreFocus = false) {
    menuButton.setAttribute('aria-expanded', String(open));
    mainNav.classList.toggle('is-open', open);
    menuButton.querySelector('span').textContent = open ? '−' : '+';
    if (restoreFocus) menuButton.focus();
  }
  menuButton.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') setMenu(false, true);
  });
  mainNav.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false); });
  document.addEventListener('click', event => {
    if (!event.target.closest('.top') && menuButton.getAttribute('aria-expanded') === 'true') setMenu(false);
  });
  mobile.addEventListener('change', () => setMenu(false));
}

// Pointer-localized button light. It never moves the label or click target.
const reducedButtonMotion = matchMedia('(prefers-reduced-motion: reduce)');
document.querySelectorAll('.top nav a, .rss, .button:not(.primary), .filters button, .menu-toggle, .text-link').forEach(control => control.classList.add('glow-control'));
document.querySelectorAll('.glow-control, .thumb, .load-video, .button.primary').forEach(control => {
  let frame = 0;
  let point = null;
  function resetLight() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; point = null;
    control.style.removeProperty('--glow-x');
    control.style.removeProperty('--glow-y');
  }
  control.addEventListener('pointermove', event => {
    if (reducedButtonMotion.matches || event.pointerType === 'touch' || control.matches(':disabled,[aria-disabled="true"]')) return;
    const bounds = control.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    point = [Math.max(0, Math.min(100, (event.clientX - bounds.left) / bounds.width * 100)), Math.max(0, Math.min(100, (event.clientY - bounds.top) / bounds.height * 100))];
    if (!frame) frame = requestAnimationFrame(() => {
      control.style.setProperty('--glow-x', point[0].toFixed(2) + '%');
      control.style.setProperty('--glow-y', point[1].toFixed(2) + '%');
      frame = 0;
    });
  });
  control.addEventListener('pointerleave', resetLight);
  reducedButtonMotion.addEventListener('change', resetLight);
});
