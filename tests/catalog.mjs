import assert from 'node:assert/strict';
import worker from '../worker.js';
import {DEFAULT_MENU,validateCatalog} from '../catalog.js';
let stored = null;
const env = {ADMIN_TOKEN:'local-testing-key-at-least-24-characters',CATALOG:{get:async()=>stored,put:async(key,value)=>{stored=JSON.parse(value)}}};
async function request(method,body,token,extra={}) {return worker.fetch(new Request('http://localhost/catalog',{method,headers:{...(token?{Authorization:`Bearer ${token}`} : {}),'Content-Type':'application/json'},...(body!==undefined?{body:JSON.stringify(body)}:{})}),{...env,...extra});}
assert.equal((await request('GET')).status,200);
assert.deepEqual(await (await request('GET')).json(),DEFAULT_MENU);
assert.equal((await request('PUT',DEFAULT_MENU)).status,401);
assert.equal((await request('PUT',DEFAULT_MENU,'wrong')).status,401);
assert.equal(stored,null);
assert.equal((await request('PUT',DEFAULT_MENU,env.ADMIN_TOKEN)).status,200);
assert.deepEqual(stored,DEFAULT_MENU);
assert.equal((await request('PUT',[DEFAULT_MENU[0],DEFAULT_MENU[0]],env.ADMIN_TOKEN)).status,400);
assert.equal((await request('PUT',[{...DEFAULT_MENU[0],image:'javascript:alert(1)'}],env.ADMIN_TOKEN)).status,400);
assert.equal((await request('PUT',[{...DEFAULT_MENU[0],price:-1}],env.ADMIN_TOKEN)).status,400);
assert.equal((await request('PUT',[],env.ADMIN_TOKEN)).status,200);
assert.deepEqual(await (await request('GET')).json(),[]);
assert.equal((await request('PUT',DEFAULT_MENU,env.ADMIN_TOKEN,{CATALOG:undefined})).status,503);
assert.equal((await request('PUT',DEFAULT_MENU,env.ADMIN_TOKEN,{ALLOWED_ORIGIN:'https://example.org'})).status,403);
const preflight=await request('OPTIONS');assert.equal(preflight.status,204);assert.match(preflight.headers.get('Access-Control-Allow-Headers'),/Authorization/);
for (const image of ['https://example.org/a.jpg','data:image/webp;base64,YQ==']) validateCatalog([{...DEFAULT_MENU[0],image}]);
console.log('Catalog: default, auth, persistence, deletion, validation, CORS and configuration checks PASS');
const oldFetch = globalThis.fetch;
let sent = 0;
globalThis.fetch = async () => { sent++; return Response.json({ok:true}); };
try {
  const response = await worker.fetch(new Request('http://localhost/', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'Тест заказа'})}),{TELEGRAM_BOT_TOKEN:'test-only',TELEGRAM_CHAT_ID:'test-only'});
  assert.equal(response.status,200);assert.equal(sent,1);
  assert.equal((await worker.fetch(new Request('http://localhost/',{method:'POST',body:'{}'}),{})).status,500);
  console.log('Existing order route regression checks PASS; Telegram mocked');
} finally { globalThis.fetch = oldFetch; }
const {withCatalogPhotos,validImage} = await import('../catalog.js');
const {existsSync} = await import('node:fs');
assert.equal(DEFAULT_MENU.length,17);
for (const item of DEFAULT_MENU) {
  assert(validImage(item.image));
  assert(existsSync(new URL('../'+item.image,import.meta.url)));
}
const {image,...olderItem} = DEFAULT_MENU[0];
assert.equal(withCatalogPhotos([olderItem])[0].image,image);
assert.equal(withCatalogPhotos([{...olderItem,image:''}])[0].image,'');
assert.deepEqual(withCatalogPhotos([]),[]);
console.log('All 17 bundled photos exist; older menus gain photos; explicit removal and deleted items preserved');
