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
      await page.locator('#main-nav').getByRole('link',{name:'Episodes'}).click();
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
