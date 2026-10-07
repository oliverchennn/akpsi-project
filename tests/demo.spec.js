import { test, expect } from '@playwright/test';
const ids = ['coffee', 'rice', 'oats', 'sugar'];
test.beforeEach(async ({ page }) => { await page.goto('/'); });
test('loads four complete platforms without console errors', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.reload();
  await expect(page.getByRole('slider')).toHaveCount(4);
  await expect(page.locator('#total-net')).toHaveText('31.00 kg');
  await expect(page.locator('#healthy-count')).toHaveText('04 of 4 bins');
  expect(errors).toEqual([]);
});
test('every dial works with keyboard and keeps the other bins independent', async ({ page }) => {
  const starts = [7.7,12.2,4.4,9];
  for (const [index,id] of ids.entries()) {
    const dial = page.locator(`#card-${id} [role=slider]`);
    await dial.focus(); await page.keyboard.press('ArrowDown');
    await expect(dial).toHaveAttribute('aria-valuenow', String(Math.round((starts[index] - .1)*100)/100));
    await page.keyboard.press('PageUp');
    await expect(dial).toHaveAttribute('aria-valuenow', String(Math.round((starts[index] + .9)*100)/100));
    await page.keyboard.press('Home'); await expect(dial).toHaveAttribute('aria-valuenow', '0');
    await expect(page.locator(`#card-${id} .dial-main`)).toHaveText('0.00');
    await page.keyboard.press('End');
    await expect(page.locator(`#card-${id} .fill-percent`)).toHaveText('100% full');
    if(index < 3) await expect(page.locator(`#gross-${ids[index+1]}`)).toHaveValue(starts[index+1].toFixed(2));
  }
});
test('every dial responds to pointer dragging', async ({ page }) => {
  for(const id of ids){
    const dial=page.locator(`#card-${id} [role=slider]`); const box=await dial.boundingBox();
    const before=await dial.getAttribute('aria-valuenow');
    await page.mouse.move(box.x+box.width*.1,box.y+box.width*.5);
    await page.mouse.down(); await page.mouse.move(box.x+box.width*.5,box.y+box.width*.1,{steps:5}); await page.mouse.up();
    expect(await dial.getAttribute('aria-valuenow')).not.toBe(before);
  }
});
test('numeric bounds, tare floor, plus/minus and save configuration', async ({ page }) => {
  const input=page.locator('#gross-coffee');
  await input.fill('-2'); await input.press('Enter'); await expect(input).toHaveValue('0.00');
  await input.fill('999'); await input.press('Enter'); await expect(input).toHaveValue('10.50');
  await input.fill('0.2'); await input.press('Enter'); await expect(page.locator('#card-coffee .dial-main')).toHaveText('0.00');
  await input.fill('5'); await input.press('Enter');
  await page.getByRole('button',{name:'Configure Coffee beans'}).click();
  await page.locator('[name=name]').fill('Demo lentils'); await page.locator('[name=tare]').fill('1');
  await page.locator('[name=capacity]').fill('12'); await page.locator('[name=threshold]').fill('4'); await page.locator('[name=monthly]').fill('60');
  await page.getByRole('button',{name:'Save settings'}).click();
  await expect(page.locator('#card-coffee h3')).toHaveText('Demo lentils');
  await expect(page.locator('#card-coffee .dial-main')).toHaveText('4.00');
  await expect(page.locator('#card-coffee .stock-badge')).toHaveText('Low stock');
  await expect(page.locator('#card-coffee .monthly-display')).toHaveText('60.00 kg');
  await page.getByRole('button',{name:'Increase Demo lentils gross weight'}).click();
  await expect(page.locator('#card-coffee .stock-badge')).toHaveText('In stock');
});
test('one alert per crossing, no repeated preset or refill spam, requests only simulated', async ({ page }) => {
  await page.getByRole('switch').check();
  await page.getByRole('button',{name:'Busy afternoon'}).click();
  await expect(page.locator('#low-count')).toHaveText('02 low-stock bins');
  await expect(page.locator('.request-row')).toHaveCount(2);
  await expect(page.locator('.activity-row[data-type=alert]')).toHaveCount(2);
  await page.getByRole('button',{name:'Busy afternoon'}).click();
  await expect(page.locator('.request-row')).toHaveCount(2);
  await expect(page.locator('.activity-row[data-type=alert]')).toHaveCount(2);
  await page.locator('#gross-coffee').fill('1'); await page.locator('#gross-coffee').press('Enter');
  await expect(page.locator('.activity-row[data-type=alert]')).toHaveCount(2);
  await page.locator('#card-coffee .refill-button').click();
  await expect(page.locator('#card-coffee .stock-badge')).toHaveText('In stock');
  await expect(page.locator('.request-state.fulfilled')).toHaveCount(1);
  const feed=await page.locator('#activity-list').innerText();
  await page.locator('#card-coffee .refill-button').click(); expect(await page.locator('#activity-list').innerText()).toBe(feed);
  await page.getByRole('button',{name:'Refill all',exact:true}).click(); await expect(page.locator('#low-count')).toHaveText('00 low-stock bins');
  await page.getByRole('button',{name:'Reset demo'}).click();
  await expect(page.locator('.request-row')).toHaveCount(0); await expect(page.getByRole('switch')).not.toBeChecked();
  await expect(page.locator('#total-net')).toHaveText('31.00 kg');
});
test('configuration validates threshold and updates live stock state on save', async ({ page }) => {
  await page.getByRole('button',{name:'Configure Coffee beans'}).click();
  await page.locator('[name=threshold]').fill('10'); await page.getByRole('button',{name:'Save settings'}).click();
  await expect(page.locator('#form-error')).toContainText('below capacity');
  await page.locator('[name=threshold]').fill('8'); await page.getByRole('button',{name:'Save settings'}).click();
  await expect(page.locator('#card-coffee .stock-badge')).toHaveText('Low stock');
  await expect(page.locator('.activity-row[data-type=alert]')).toHaveCount(1);
  await page.getByRole('button',{name:'Configure Coffee beans'}).click();
  await page.locator('[name=threshold]').fill('2'); await page.getByRole('button',{name:'Save settings'}).click();
  await expect(page.locator('#card-coffee .stock-badge')).toHaveText('In stock');
});
test('mobile layout has no horizontal clipping and controls work', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByRole('slider')).toHaveCount(4);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const id of ids) { await page.locator(`#card-${id} .refill-button`).click(); await expect(page.locator(`#card-${id} .fill-percent`)).toHaveText('100% full'); }
  await page.getByRole('button',{name:'Configure Cane sugar'}).click();
  await expect(page.getByRole('dialog')).toBeVisible(); await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.screenshot({path:'/tmp/tarely-mobile.png',fullPage:true});
});
test('help and keyboard modal dismissal plus desktop layout', async ({ page }) => {
  await page.setViewportSize({width:1512,height:1100});
  await page.getByRole('button',{name:'How this demo works'}).click();
  await expect(page.getByRole('heading',{name:'Meet your virtual stockroom'})).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:'/tmp/tarely-desktop.png',fullPage:true});
});
