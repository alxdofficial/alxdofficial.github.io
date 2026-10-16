const { test, expect } = require('@playwright/test');
const source = require('../../../papers/episodes.json');
for (const width of [320,390,768,1440]) {
  test('responsive channel at ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/papers/');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('#episodes .episode:visible')).toHaveCount(source.episodes.length);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await expect(page.locator('#episodes .thumb').first()).toHaveAccessibleName(/Watch/);
    for (const episode of source.episodes) await expect(page.locator('#episodes')).toContainText(episode.title);
    if (width <= 680) {
      const menu=page.getByRole('button',{name:/Menu/});
      await expect(menu).toBeVisible();
      expect((await menu.boundingBox()).height).toBeGreaterThanOrEqual(44);
      await menu.click();
      await expect(menu).toHaveAttribute('aria-expanded','true');
      await page.keyboard.press('Escape');
      await expect(menu).toHaveAttribute('aria-expanded','false');
      await expect(menu).toBeFocused();
      await menu.click();
      await menu.click();
      await page.waitForTimeout(360);
      await expect(menu).toHaveAttribute('aria-expanded','false');
    }
    await page.screenshot({path:'test-results/home-'+width+'.png',fullPage:true});
    await page.locator('#search').fill(source.episodes[0].title);
    await expect(page.locator('#episodes .episode:visible')).toHaveCount(1);
    await page.getByRole('button',{name:'Reset'}).click();
    await expect(page.locator('#episodes .episode:visible')).toHaveCount(source.episodes.length);
    await page.locator('#playlist').selectOption('health');
    await expect(page.locator('#episodes .episode:visible')).toHaveCount(source.episodes.filter(e=>e.playlists.includes('health')).length);
    await page.reload();
    await expect(page.locator('#playlist')).toHaveValue('health');
    await page.getByRole('button',{name:'Reset'}).click();
    await page.goto('/papers/'+source.episodes[0].id+'/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await expect(page.locator('h1')).toHaveText(source.episodes[0].title);
    await expect(page.locator('.paper-meta')).toContainText(source.episodes[0].venue);
    await expect(page.locator('#transcript')).toContainText('1. Problem');
    await page.screenshot({path:'test-results/episode-'+width+'.png',fullPage:true});
    await page.route('https://drive.google.com/**', route=>route.fulfill({contentType:'text/html',body:'<p>External player fixture</p>'}));
    await page.getByRole('button',{name:/Watch .* video from Google Drive/}).click({position:{x:10,y:10}});
    await expect(page.locator('.player iframe')).toHaveCount(1);
  });
}
test('static transcript without JavaScript and reduced motion', async ({browser,page})=>{
  const context=await browser.newContext({javaScriptEnabled:false,baseURL:'http://127.0.0.1:8765'});
  const p=await context.newPage();await p.goto('/papers/cortex/');
  await expect(p.locator('#transcript')).toContainText('1. Problem');
  await expect(p.locator('#credits')).toContainText('Synthetic narration');
  await context.close();
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/papers/');
  expect(await page.locator('.thumb').first().evaluate(e=>getComputedStyle(e,'::after').transitionDuration)).toBe('0s');
});

test('reference secondary glow, pointer light, fixed labels, primary clarity and disabled states', async ({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/papers/cortex/');
  const secondary=page.getByRole('link',{name:'Download transcript'});
  const read = () => secondary.evaluate(el=>{
    const p=getComputedStyle(el,'::before'),s=getComputedStyle(el),r=el.getBoundingClientRect();
    return {width:parseFloat(p.width),height:parseFloat(p.height),hostWidth:r.width,hostHeight:r.height,opacity:p.opacity,filter:p.filter,radius:p.borderRadius,duration:p.transitionDuration,easing:p.transitionTimingFunction,background:p.backgroundImage,color:s.color,shadow:s.boxShadow,x:el.style.getPropertyValue('--glow-x'),y:el.style.getPropertyValue('--glow-y')};
  });
  await secondary.scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0,0);
  let state=await read();
  expect(state.width/state.hostWidth).toBeCloseTo(.6,1);
  expect(state.height/state.hostHeight).toBeCloseTo(.32,1);
  expect(state.opacity).toBe('0.38');expect(state.filter).toBe('blur(7px)');
  expect(state.duration.split(',').every(v=>v.trim()==='0.26s')).toBeTruthy();
  expect(state.easing).toContain('cubic-bezier(0.2, 0.6, 0.2, 1)');
  const before=await secondary.boundingBox();
  await secondary.hover({position:{x:20,y:15}});await page.waitForTimeout(300);
  state=await read();expect(state.width/state.hostWidth).toBeCloseTo(1,1);expect(state.height/state.hostHeight).toBeCloseTo(1,1);
  expect(state.radius).toBe('0px');expect(state.filter).toBe('blur(0px)');expect(state.opacity).toBe('1');
  expect(state.x).not.toBe('');expect(state.background).toContain('radial-gradient');
  const after=await secondary.boundingBox();expect(after).toEqual(before);
  await page.mouse.down();state=await read();expect(state.filter).toBe('none');expect(state.background).toBe('none');await page.mouse.move(0,0);await page.mouse.up();
  await page.keyboard.press('Tab');await secondary.focus();state=await read();expect(state.shadow).toContain('0px 1px 0px');
  await secondary.evaluate(el=>el.setAttribute('aria-disabled','true'));await page.waitForTimeout(300);
  state=await read();expect(state.opacity).toBe('0');
  const primary=page.getByRole('link',{name:'Read the paper'});
  expect(await primary.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(247, 223, 201)');
  expect(await page.locator('.watch-cta').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(247, 223, 201)');
  await page.emulateMedia({reducedMotion:'reduce'});
  await secondary.evaluate(el=>el.removeAttribute('aria-disabled'));await secondary.hover();
  state=await read();expect(state.duration).toBe('0s');expect(state.x).toBe('');
});
test('touch retains readable solid primary and stable secondary controls',async({browser})=>{
  const context=await browser.newContext({baseURL:'http://127.0.0.1:8765',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();await page.goto('/papers/cortex/');
  const secondary=page.getByRole('link',{name:'Download transcript'});
  const state=await secondary.evaluate(el=>{const p=getComputedStyle(el,'::before');return {filter:p.filter,radius:p.borderRadius,opacity:p.opacity};});
  expect(state.filter).toBe('none');expect(state.radius).toBe('0px');expect(state.opacity).toBe('0.16');
  expect(await page.locator('.watch-cta').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(247, 223, 201)');
  await page.screenshot({path:'test-results/touch-reference-controls.png',fullPage:true});
  await context.close();
});

test('desktop reference menu hover, delayed close, click, keyboard and shadow floor',async({page})=>{
  await page.setViewportSize({width:1440,height:900});await page.goto('/papers/');
  const root=page.locator('.reference-nav'), trigger=page.getByRole('button',{name:'Episodes',exact:true}), panel=page.locator('#main-nav');
  await trigger.hover();await expect(trigger).toHaveAttribute('aria-expanded','true');await page.waitForTimeout(360);
  await expect(panel).toContainText(source.episodes[0].title);
  const style=await root.evaluate(el=>{const a=getComputedStyle(el.querySelector('.nav-aura')),f=getComputedStyle(el.querySelector('.nav-floor')),t=getComputedStyle(el.querySelector('.menu-trigger'),'::before');return {filter:a.filter,height:parseFloat(a.height),duration:a.transitionDuration,floor:f.backgroundColor,glow:t.display};});
  expect(style.filter).toBe('blur(10px)');expect(style.height).toBeGreaterThan(80);expect(style.duration).toContain('0.32s');expect(style.floor).toBe('rgb(30, 34, 36)');expect(style.glow).toBe('none');
  await panel.hover();await page.waitForTimeout(180);await expect(trigger).toHaveAttribute('aria-expanded','true');
  await trigger.hover();await page.waitForTimeout(360);await expect(panel.locator('a:visible').first()).toBeVisible();
  await page.screenshot({path:'test-results/desktop-menu-open-1440.png',fullPage:false});
  await trigger.hover();await panel.hover();
  const elapsed=await panel.evaluate(el=>new Promise(resolve=>{
    const button=document.querySelector('[data-menu="episodes"]'),start=performance.now();
    const observer=new MutationObserver(()=>{if(button.getAttribute('aria-expanded')==='false'){observer.disconnect();resolve(performance.now()-start);}});
    observer.observe(button,{attributes:true,attributeFilter:['aria-expanded']});
    el.dispatchEvent(new MouseEvent('mouseleave'));
  }));
  expect(elapsed).toBeGreaterThanOrEqual(130);expect(elapsed).toBeLessThan(300);
  await page.mouse.move(5,850);
  await trigger.hover();await trigger.click();await expect(trigger).toHaveAttribute('aria-expanded','false');
  await trigger.focus();await page.keyboard.press('ArrowDown');await expect(trigger).toHaveAttribute('aria-expanded','true');
  await expect(panel.locator('a:visible').first()).toBeFocused();
  await page.evaluate(()=>scrollTo(0,100));await expect(root).toHaveAttribute('data-scrolled','true');await expect(trigger).toHaveAttribute('aria-expanded','true');
  await page.keyboard.press('Escape');await expect(trigger).toBeFocused();await expect(trigger).toHaveAttribute('aria-expanded','false');
});
test('mobile reference menu remains opaque during open and close, outside tap and scroll',async({browser})=>{
  const context=await browser.newContext({baseURL:'http://127.0.0.1:8765',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();await page.goto('/papers/');
  const root=page.locator('.reference-nav'),menu=page.getByRole('button',{name:/Menu/}),panel=page.locator('#main-nav');
  let b=await menu.boundingBox();expect(Math.round(b.width)).toBe(148);expect(Math.round(b.height)).toBe(52);expect(Math.round(390-b.x-b.width)).toBe(10);expect(Math.round(844-b.y-b.height)).toBe(16);
  await menu.tap();await page.waitForTimeout(380);await expect(menu).toHaveAttribute('aria-expanded','true');
  expect(await panel.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(30, 34, 36)');
  const floor=page.locator('.nav-floor');expect(await floor.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(30, 34, 36)');
  expect((await floor.boundingBox()).height).toBeGreaterThan(200);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.screenshot({path:'test-results/mobile-menu-open-390.png',fullPage:true});
  await page.touchscreen.tap(10,200);await expect(menu).toHaveAttribute('aria-expanded','false');
  await page.waitForTimeout(100);await expect(root).toHaveAttribute('data-retained','true');expect((await floor.boundingBox()).height).toBeGreaterThan(200);
  await page.screenshot({path:'test-results/mobile-menu-closing-390.png',fullPage:true});
  await page.waitForTimeout(260);await expect(panel).toBeHidden();
  await page.evaluate(()=>scrollTo(0,120));await expect(root).toHaveAttribute('data-mobile-hidden','true');
  await page.evaluate(()=>scrollTo(0,80));await expect(root).toHaveAttribute('data-mobile-hidden','false');
  await page.evaluate(()=>scrollTo(0,0));await menu.tap();await page.keyboard.press('Escape');await expect(menu).toBeFocused();
  await page.emulateMedia({reducedMotion:'reduce'});expect(await panel.evaluate(e=>getComputedStyle(e).transitionDuration)).toBe('0s');
  await context.close();
});
