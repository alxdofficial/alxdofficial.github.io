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
  form.addEventListener('submit', e => {
    e.preventDefault(); filter();
    document.querySelector('#episodes').scrollIntoView({behavior:'instant'});
  });
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

// Source-informed shared menu aura/floor. Native buttons and links keep keyboard access.
const menuRoot = document.querySelector('.reference-nav');
if (menuRoot) {
  document.documentElement.classList.add('js');
  const bar = menuRoot.querySelector('.nav-bar');
  const panel = menuRoot.querySelector('.menu-panel');
  const toggle = menuRoot.querySelector('.menu-toggle');
  const triggers = [...menuRoot.querySelectorAll('.menu-trigger')];
  const sections = [...panel.querySelectorAll('.menu-section')];
  const mobileMenu = matchMedia('(max-width:680px)');
  let active = null, closeTimer = 0, retainTimer = 0, lastTrigger = toggle;
  let previousY = window.scrollY, downward = 0;
  toggle.hidden = false;
  function cancelClose() { clearTimeout(closeTimer); closeTimer = 0; }
  function measureMenu() {
    const height = Math.min(520, panel.scrollHeight, mobileMenu.matches ? Math.max(120, innerHeight - 100) : 520);
    menuRoot.style.setProperty('--menu-height', height + 'px');
  }
  function closeMenu(restoreFocus = false, immediate = false) {
    cancelClose(); clearTimeout(retainTimer);
    active = null; menuRoot.dataset.open = 'false';
    toggle.setAttribute('aria-expanded','false');
    triggers.forEach(button => button.setAttribute('aria-expanded','false'));
    panel.inert = true;
    const finish = () => { panel.hidden = true; menuRoot.dataset.retained = 'false'; sections.forEach(s => { s.hidden = true; }); };
    if (immediate) finish(); else retainTimer = setTimeout(finish,320);
    if (restoreFocus) lastTrigger.focus();
  }
  function openMenu(key,button) {
    cancelClose(); clearTimeout(retainTimer);
    lastTrigger = button || toggle;
    active = key;
    sections.forEach(section => { section.hidden = section.dataset.menuKey !== key; });
    panel.hidden = false; panel.inert = false;
    menuRoot.dataset.retained = 'true';
    measureMenu();
    if (button && !mobileMenu.matches) {
      const bounds = button.getBoundingClientRect(), rootBounds = menuRoot.getBoundingClientRect();
      menuRoot.style.setProperty('--aura-x', ((bounds.left + bounds.width/2-rootBounds.left)/rootBounds.width*100).toFixed(2)+'%');
    }
    // Force a closed layout before expansion when the panel was hidden.
    panel.getBoundingClientRect();
    menuRoot.dataset.open = 'true';
    menuRoot.dataset.mobileHidden = 'false';
    toggle.setAttribute('aria-expanded',String(key==='mobile'));
    triggers.forEach(trigger => trigger.setAttribute('aria-expanded',String(trigger.dataset.menu===key)));
  }
  function delayedClose() { cancelClose(); closeTimer = setTimeout(() => closeMenu(),140); }
  triggers.forEach(button => {
    button.addEventListener('mouseenter',()=>{ if (!mobileMenu.matches) openMenu(button.dataset.menu,button); });
    button.addEventListener('click',()=>{
      if (active===button.dataset.menu) closeMenu(); else openMenu(button.dataset.menu,button);
    });
    button.addEventListener('keydown',event=>{
      if (event.key==='ArrowDown') { event.preventDefault(); openMenu(button.dataset.menu,button); panel.querySelector('.menu-section:not([hidden]) a')?.focus(); }
    });
  });
  bar.addEventListener('mouseenter',cancelClose);
  bar.addEventListener('mouseleave',()=>{ if (!mobileMenu.matches && active) delayedClose(); });
  panel.addEventListener('mouseenter',cancelClose);
  panel.addEventListener('mouseleave',()=>{ if (!mobileMenu.matches && active) delayedClose(); });
  toggle.addEventListener('click',()=>{ if (active) closeMenu(); else openMenu('mobile',toggle); });
  document.addEventListener('keydown',event=>{ if(event.key==='Escape' && active) closeMenu(true); });
  document.addEventListener('click',event=>{ if(mobileMenu.matches && active && !event.target.closest('.reference-nav')) closeMenu(); });
  panel.addEventListener('click',event=>{
    const link=event.target.closest('a');
    if(!link) return;
    closeMenu();
    const destination=new URL(link.href);
    if(destination.pathname===location.pathname && destination.hash==='#search') {
      requestAnimationFrame(()=>document.querySelector('#search')?.focus({preventScroll:true}));
    }
  });
  menuRoot.addEventListener('focusout',()=>setTimeout(()=>{ if(active && !menuRoot.contains(document.activeElement)) closeMenu(); },0));
  function updateScroll() {
    const y=window.scrollY,dy=y-previousY;
    menuRoot.dataset.scrolled=String(y>8);
    if(mobileMenu.matches) {
      if(y<40) { downward=0; menuRoot.dataset.mobileHidden='false'; }
      else if(dy>0) { if(active) closeMenu(); downward+=dy; if(downward>24) menuRoot.dataset.mobileHidden='true'; }
      else if(dy < -2) { downward=0; menuRoot.dataset.mobileHidden='false'; }
    }
    previousY=y;
  }
  addEventListener('scroll',updateScroll,{passive:true});
  addEventListener('resize',()=>{ if(active) measureMenu(); });
  mobileMenu.addEventListener('change',()=>{ closeMenu(false,true); menuRoot.dataset.mobileHidden='false'; downward=0; });
  updateScroll();
}

// The reference eases the hotspot (0.22) and proximity (0.18) independently.
// Retarget the current light on entry, movement and exit; never move the label.
const reducedButtonMotion = matchMedia('(prefers-reduced-motion: reduce)');
const fineButtonPointer = matchMedia('(hover: hover) and (pointer: fine)');
document.querySelectorAll('.button, .filters button, .text-link, .play, .watch-cta').forEach(control => {
  control.classList.add('glow-control');
  const label = document.createElement('span');
  label.className = 'label';
  label.append(...control.childNodes);
  control.append(label);
  let frame = 0;
  let tx = 50, ty = 50, tp = 0;
  let cx = 50, cy = 50, cp = 0;
  const disabled = () => control.matches(':disabled,[aria-disabled="true"]');
  const canTrack = event => fineButtonPointer.matches && !reducedButtonMotion.matches && event.pointerType !== 'touch' && !disabled();
  function resetLight() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; tx = cx = 50; ty = cy = 50; tp = cp = 0;
    ['--mx','--my','--prox'].forEach(property => control.style.removeProperty(property));
  }
  function tick() {
    if (!control.isConnected || disabled()) { resetLight(); return; }
    cx += (tx - cx) * .22;
    cy += (ty - cy) * .22;
    cp += (tp - cp) * .18;
    control.style.setProperty('--mx',cx.toFixed(2)+'%');
    control.style.setProperty('--my',cy.toFixed(2)+'%');
    control.style.setProperty('--prox',cp.toFixed(3));
    frame = Math.abs(tx-cx)>.1 || Math.abs(ty-cy)>.1 || Math.abs(tp-cp)>.005 ? requestAnimationFrame(tick) : 0;
  }
  function kick() { if (!frame) frame = requestAnimationFrame(tick); }
  control.addEventListener('pointerenter',event => { if (canTrack(event)) { tp = 1; kick(); } });
  control.addEventListener('pointermove', event => {
    if (!canTrack(event)) return;
    const bounds = control.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    tx = Math.max(0,Math.min(100,(event.clientX-bounds.left)/bounds.width*100));
    ty = Math.max(0,Math.min(100,(event.clientY-bounds.top)/bounds.height*100));
    kick();
  });
  control.addEventListener('pointerleave',() => { tp = 0; tx = ty = 50; if (frame || cp) kick(); });
  control.addEventListener('pointercancel',resetLight);
  reducedButtonMotion.addEventListener('change', resetLight);
  fineButtonPointer.addEventListener('change',resetLight);
});
