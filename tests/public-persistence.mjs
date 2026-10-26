import assert from 'node:assert/strict';
import {Miniflare} from 'miniflare';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const folder=await mkdtemp(join(tmpdir(),'yanasushi-public-persist-'));
const options={scriptPath:'cloudflare-worker.js',modules:true,compatibilityDate:'2026-07-30',cf:false,durableObjects:{PUBLIC_DATA:{className:'PublicData',useSQLite:true}},durableObjectsPersist:folder};
let runtime=new Miniflare(options);
const call=(path,body)=>runtime.dispatchFetch('https://worker.test'+path,{method:body?'POST':'GET',headers:{'CF-Connecting-IP':'192.0.2.30'},...(body?{body:JSON.stringify(body)}:{})});
try {
  const bytes=await readFile('assets/banners/dragon.webp'),challenge=(await(await call('/challenge?purpose=review')).json()).token;
  await new Promise(resolve=>setTimeout(resolve,2100));
  const body={id:crypto.randomUUID(),name:'Гость',text:'Очень хороший сет и свежие роллы!',rating:5,photo:'data:image/webp;base64,'+bytes.toString('base64'),website:'',challenge};
  const posted=await call('/reviews',body);assert.equal(posted.status,201);const {review}=await posted.json();
  await runtime.dispose();runtime=new Miniflare(options);
  const restored=await(await call('/reviews')).json();assert.equal(restored.count,1);assert.equal(restored.average,5);assert.equal(restored.reviews[0].id,review.id);
  assert.deepEqual(new Uint8Array(await(await call(`/reviews/${review.id}/photo`)).arrayBuffer()),new Uint8Array(bytes));
  assert.equal((await call('/reviews',body)).status,201,'Idempotency record and visitor salt survive a Worker restart');assert.equal((await(await call('/reviews')).json()).count,1);
  console.log('Persistence PASS: SQLite survives Worker restart; multi-chunk photo, rating, visitor salt and idempotency are restored');
}finally{await runtime.dispose();await rm(folder,{recursive:true,force:true});}
