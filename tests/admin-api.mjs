import assert from 'node:assert/strict';
import {catalogEndpoint,fetchCatalog,publishCatalog} from '../admin-api.js';
for (const input of ['https://example.com','https://example.com/','https://example.com/catalog','https://example.com/catalog/']) assert.equal(catalogEndpoint(input),'https://example.com/catalog');
assert.equal(catalogEndpoint('https://example.com/api/?discard=yes#x'),'https://example.com/api/catalog');
assert.equal(catalogEndpoint('http://127.0.0.1:8787/'),'http://127.0.0.1:8787/catalog');
for (const input of ['http://example.com','javascript:alert(1)','https://user:password@example.com','bad url']) assert.throws(()=>catalogEndpoint(input));
const oldFetch=globalThis.fetch;
try {
  let calls=[];
  globalThis.fetch=async(url,options)=>{calls.push({url,options});return Response.json({error:'Method not allowed'},{status:405});};
  await assert.rejects(publishCatalog('https://example.com',[],'test-only'),/старая версия/);
  assert.equal(calls.length,1);assert.equal(calls[0].options.method,undefined,'Do not send a key to a legacy deployment');
  globalThis.fetch=async()=>{throw new TypeError('Failed to fetch');};
  await assert.rejects(fetchCatalog('https://example.com'),/CORS/);
  globalThis.fetch=async()=>{throw new DOMException('timeout','TimeoutError');};
  await assert.rejects(fetchCatalog('https://example.com'),/не ответил вовремя/);
  globalThis.fetch=async()=>new Response('<html>bad route</html>');
  await assert.rejects(fetchCatalog('https://example.com'),/не JSON/);
  globalThis.fetch=async()=>Response.json({error:'unauthorized'},{status:401});
  await assert.rejects(fetchCatalog('https://example.com'),/Неверный ключ/);
} finally {globalThis.fetch=oldFetch;}
console.log('Admin API PASS: URL normalization, invalid URLs, legacy detection before authentication, CORS/network errors, timeout, invalid JSON, wrong token');
