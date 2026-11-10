const { test, expect } = require('@playwright/test');
const id = 'AbcdefGhijk1234567890_-';
const expected = 'https://drive.google.com/file/d/' + id + '/preview';
for (const width of [320,390,768,1440]) {
  test('safe preview at '+width, async ({page})=>{
    await page.setViewportSize({width,height:900});
    await page.route('https://drive.google.com/**',route=>route.fulfill({contentType:'text/html',body:'<p>Mock player for UI checks, not real playback.</p>'}));
    await page.goto('/papers/preview/');
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','noindex,nofollow,noarchive');
    await page.getByLabel('Drive video file ID').fill(id);
    await page.getByRole('button',{name:'Load playback preview'}).click();
    await expect(page.locator('iframe')).toHaveAttribute('src',expected);
    await expect(page.locator('iframe')).toHaveAttribute('allow','autoplay; fullscreen');
    await expect(page.locator('#preview-status')).toContainText('not a publication');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
    await page.screenshot({path:'test-results/preview-'+width+'.png',fullPage:true});
  });
}
test('preview rejects query injection without requesting a frame',async({page})=>{
  const frames=[];page.on('request',r=>{if(r.url().startsWith('https://drive.google.com/'))frames.push(r.url());});
  for(const q of ['?video='+encodeURIComponent('<img src=x onerror=alert(1)>'),'?video='+id+'&video='+id,'?video='+id+'&target=https://evil.example','?video='+encodeURIComponent('https://evil.example/'),'?video=goodid1234%0A']) {
    await page.goto('/papers/preview/'+q);
    await expect(page.locator('#preview-status')).toContainText('Invalid input');
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(page.locator('#preview-player img')).toHaveCount(0);
  }
  expect(frames).toEqual([]);
});
