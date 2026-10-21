import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {testServer} from './helpers/server.mjs';
const server = await testServer();
const base = server.base;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const browser=await chromium.launch({executablePath,args:['--no-sandbox']}).catch(async error => { await server.close(); throw error; });
const pages={ 'index.html':4,'sushi.html':10,'sets.html':3,'promo.html':5,'extras.html':4,'contacts.html':0 };
try {
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.route('https://fonts.googleapis.com/**',r=>r.abort());
  await context.route('https://fonts.gstatic.com/**',r=>r.abort());
  await context.route('https://yellow-term-d7c1.zubashenkoserhii.workers.dev/**',r=>r.fulfill({status:503,body:'offline'}));
  const page=await context.newPage();page.setDefaultTimeout(10000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const [name,count] of Object.entries(pages)) {
    await page.goto(base+name);
    assert.equal(await page.locator('.card').count(),count,name);
    assert.equal(await page.locator('h1').count(),1,name);
    assert.equal(await page.locator('.nav [aria-current=page]').count(),1,name);
    for(const image of await page.locator('.card img').all()) await image.scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('.card img')).every(i=>i.complete&&i.naturalWidth>0));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' overflow');
  }
  await page.goto(base+'sushi.html');
  await page.locator('[data-act=add]').first().click();
  assert.equal(await page.locator('#cart-count').textContent(),'1');
  await page.locator('.nav a[href="sets.html"]').click();
  assert.equal(await page.locator('#cart-count').textContent(),'1');
  await page.locator('[data-act=add]').first().click();
  assert.equal(await page.locator('#cart-count').textContent(),'2');
  await page.locator('[data-act=lang][data-lang=uk]').click();
  assert.equal(await page.locator('h1').textContent(),'Набори для компанії');
  await page.locator('.nav a[href="promo.html"]').click();
  assert.equal(await page.locator('#cart-count').textContent(),'2');
  assert.equal(await page.locator('html').getAttribute('lang'),'uk');
  await page.locator('[data-act=open-cart]').click();
  assert.equal(await page.locator('.line').count(),2);
  await page.locator('[data-act=checkout]').click();
  assert(await page.locator('#checkout-form').isVisible());
  await page.locator('button[data-act=close-cart]').click();
  await page.locator('[data-act=lang][data-lang=ru]').click();
  await page.goto(base+'sushi.html');
  for(const image of await page.locator('.card img').all()) await image.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('.card img')).every(i=>i.complete&&i.naturalWidth>0));
  await page.screenshot({path:tmpdir()+'/yanasushi-sushi-desktop.png',fullPage:true,animations:'disabled'});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:tmpdir()+'/yanasushi-sushi-mobile.png',fullPage:true,animations:'disabled'});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.goto(base+'index.html');
  await page.screenshot({path:tmpdir()+'/yanasushi-home.png',fullPage:true,animations:'disabled'});
  assert.deepEqual(errors,[]);
  await context.close();

  const staticContext=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
  await staticContext.route('https://fonts.googleapis.com/**',r=>r.abort());
  await staticContext.route('https://fonts.gstatic.com/**',r=>r.abort());
  const staticPage=await staticContext.newPage();
  for (const [name,count] of Object.entries(pages)) {
    await staticPage.goto(base+name);
    assert.equal(await staticPage.locator('.card').count(),count,'Without JS: '+name);
    if(count) assert(await staticPage.locator('.card h3').first().isVisible());
  }
  await staticContext.close();

  const brokenContext=await browser.newContext();
  await brokenContext.route('**/app.bundle.js*',r=>r.abort());
  await brokenContext.route('https://fonts.googleapis.com/**',r=>r.abort());await brokenContext.route('https://fonts.gstatic.com/**',r=>r.abort());
  const brokenPage=await brokenContext.newPage();await brokenPage.goto(base+'sushi.html');
  assert.equal(await brokenPage.locator('.card').count(),10);
  assert(await brokenPage.locator('.card h3').first().isVisible());
  await brokenContext.close();
  console.log('PASS: six pages under /yanasushi/, all photos, cart and language persist between pages, checkout, mobile, API unavailable, JavaScript disabled, JS bundle blocked; no page errors');
} finally {await browser.close();await server.close();}
