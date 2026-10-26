import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {Miniflare} from 'miniflare';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {testServer} from './helpers/server.mjs';
import {DEFAULT_MENU} from '../catalog.js';
const token='test-only-review-admin-key-very-long';let api='',sent=[];
const server=await testServer({apiUrl:()=>api}),origin=new URL(server.base).origin;
const runtime=new Miniflare({scriptPath:'cloudflare-worker.js',modules:true,compatibilityDate:'2026-07-30',host:'127.0.0.1',port:0,cf:false,kvNamespaces:['CATALOG'],durableObjects:{PUBLIC_DATA:{className:'PublicData',useSQLite:true}},bindings:{ADMIN_TOKEN:token,ALLOWED_ORIGIN:origin,TELEGRAM_BOT_TOKEN:'test-only',TELEGRAM_CHAT_ID:'test-only'},outboundService:async request=>{sent.push(await request.json());return Response.json({ok:true});}});
api=(await runtime.ready).origin;
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
try {
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.route('https://fonts.googleapis.com/**',r=>r.abort());await context.route('https://fonts.gstatic.com/**',r=>r.abort());
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(server.base+'reviews.html');
  await expect(page.locator('#reviews-feed-status')).toContainText('пока нет отзывов');
  await page.locator('[name=rating][value="4"]').check();await page.locator('#review-name').fill('Анна');
  const message='Очень вкусные роллы! <img src=x onerror=alert(1)> Приедем ещё.';
  await page.locator('#review-text').fill(message);const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.locator('#review-choose-photo').press('Enter')]);await chooser.setFiles('assets/menu/salmon-roll.webp');
  await expect(page.locator('#review-status')).toContainText('Фото готово');
  await page.route(api+'/reviews',route=>route.request().method()==='POST'?route.fulfill({status:503,contentType:'application/json',body:'{"ok":false}'}):route.continue());
  await page.locator('#review-form [type=submit]').click();await expect(page.locator('#review-status')).toContainText('Не удалось');
  assert.equal(await page.locator('#review-text').inputValue(),message);await expect(page.locator('#review-photo-preview')).toBeVisible();
  await page.unroute(api+'/reviews');await page.locator('#review-form [type=submit]').click();await expect(page.locator('#review-status')).toContainText('отзыв опубликован');
  await expect(page.locator('.review-card')).toHaveCount(1);assert.equal(await page.locator('.review-body').textContent(),message);assert.equal(await page.locator('.review-body img').count(),0);
  await page.waitForFunction(()=>document.querySelector('.review-image-link img')?.naturalWidth>0);await expect(page.locator('#reviews-summary')).toContainText('4 / 5');await expect(page.locator('#reviews-summary')).toContainText(/1 отзыв$/);
  await page.reload();await expect(page.locator('.review-card')).toHaveCount(1);
  await page.locator('[data-lang=uk]').click();await expect(page.locator('h1')).toHaveText('Смачно? Розкажіть.');
  await page.locator('#review-name').fill('Олена');await page.locator('#review-text').fill('Смачний сет, але доставку хотілося б трохи швидше.');await page.locator('[name=rating][value="3"]').check();
  await page.locator('#review-form [type=submit]').click();await expect(page.locator('#review-status')).toContainText('опубліковано');await expect(page.locator('.review-card')).toHaveCount(2);await expect(page.locator('#reviews-summary')).toContainText('3,5');await expect(page.locator('#reviews-summary')).toContainText(/2 відгуки$/);
  await page.locator('#review-name').fill('Олена');await page.locator('#review-text').fill('Третій відгук для перевірки ліміту надсилань.');await page.locator('[name=rating][value="2"]').check();await page.locator('#review-form [type=submit]').click();await expect(page.locator('#review-status')).toContainText('Забагато');assert.equal(await page.locator('#review-text').inputValue(),'Третій відгук для перевірки ліміту надсилань.');
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:tmpdir()+'/yanasushi-reviews-mobile.png',fullPage:true});
  const admin=await context.newPage();admin.on('dialog',d=>d.accept());admin.on('pageerror',e=>errors.push(e.message));await admin.goto(server.base+'admin.html');
  await admin.locator('[data-admin-tab=reviews]').click();await expect(admin.locator('.admin-review')).toHaveCount(2);
  await admin.locator('.connection summary').click();await admin.locator('#token').fill('wrong');await admin.locator('.admin-review').filter({hasText:'Анна'}).locator('[data-delete-review]').click();await expect(admin.locator('#admin-reviews-status')).toContainText('Неверный ключ');
  await admin.locator('#token').fill(token);await admin.locator('.admin-review').filter({hasText:'Анна'}).locator('[data-delete-review]').click();await expect(admin.locator('#admin-reviews-status')).toContainText('Отзыв и фото удалены');await expect(admin.locator('.admin-review')).toHaveCount(1);
  await page.reload();await expect(page.locator('.review-card')).toHaveCount(1);await expect(page.locator('#reviews-summary')).toContainText('3 / 5');
  // A price changed after the catalog loaded: refuse it, preserve the cart, and
  // require an explicit new confirmation before accepting the recalculated order.
  const shop=await context.newPage();shop.on('pageerror',e=>errors.push(e.message));await shop.goto(server.base+'sushi.html');await shop.locator('[data-lang=ru]').click();await shop.locator('[data-act=add][data-id=phila]').click();
  const kv=await runtime.getKVNamespace('CATALOG');await kv.put('menu',JSON.stringify(DEFAULT_MENU.map(p=>p.id==='phila'?{...p,price:300}:p)));
  await shop.locator('[data-act=open-cart]').click();await shop.locator('[data-act=checkout]').click();
  async function fillOrder(){await shop.locator('[name=name]').fill('Тестовый гость');await shop.locator('[name=phone]').fill('+380000000000');await shop.locator('[name=address]').fill('Тестовый адрес 10');await shop.locator('button[form=checkout-form]').click();}
  await fillOrder();await expect(shop.locator('#order-send-status')).toContainText('цены изменились');assert.equal(sent.length,0);assert.equal(await shop.locator('#cart-count').textContent(),'1');
  await shop.locator('[data-act=reprice]').click();await expect(shop.locator('#drawer-foot .sum-total')).toContainText('360');await shop.locator('[data-act=checkout]').click();await expect(shop.locator('[name=address]')).toHaveValue('Тестовый адрес 10');await fillOrder();await expect(shop.locator('#order-send-status')).toContainText('Заказ отправлен');assert.equal(sent.length,1);assert.match(sent[0].text,/360\.00/);assert.equal(await shop.locator('#cart-count').textContent(),'0');
  assert.deepEqual(errors,[]);console.log('Reviews browser PASS: photo upload/preview, stars, failed send preserves form, real publication, reload, escaping, RU/UA, spam limit, mobile, admin auth/removal; stale order prices require explicit new confirmation');
}finally{await browser.close();await runtime.dispose();await server.close();}
