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
