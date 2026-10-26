import { DEFAULT_MENU, validateCatalog } from './catalog.js';
import { ApiError,fail,readJson,submissionId,validateOrder,orderMessage,validateReview,sha256 } from './commerce.js';
const MIN_FORM_MS=2000, CHALLENGE_TTL=20*60*1000;
const response=(value,status=200,headers={})=>Response.json(value,{status,headers});
const expired=(value,now)=>!value||value.expiresAt<=now;

// Durable Object transactions serialize rate limits, one-use challenges and submissions
// across all Worker isolates. Telegram delivery runs outside the storage transaction.
export class PublicData {
  constructor(ctx,env) {
    this.ctx=ctx;this.env=env;
    this.ready=ctx.blockConcurrencyWhile(async()=>{
      this.salt=await ctx.storage.get('visitor-salt');
      if(!this.salt){this.salt=crypto.randomUUID();await ctx.storage.put('visitor-salt',this.salt);}
    });
  }
  async expiring(tx,key,value,expiresAt) {
    await tx.put(key,{...value,expiresAt});
    await tx.put(`expires:${String(expiresAt).padStart(13,'0')}:${crypto.randomUUID()}`,{key,expiresAt});
  }
  async rate(tx,key,limit,windowMs,now) {
    const existing=await tx.get(key), record=expired(existing,now)?{count:0,expiresAt:now+windowMs}:existing;
    if(record.count>=limit)fail(429,'RATE_LIMIT','Слишком много отправок. Попробуйте позже.',{retryAfter:Math.ceil((record.expiresAt-now)/1000)});
    if(record.count===0)await this.expiring(tx,key,{count:1},record.expiresAt);
    else await tx.put(key,{...record,count:record.count+1});
  }
  async consume(tx,body,purpose,visitor,now) {
    if(typeof body.website!=='string'||body.website.trim())fail(400,'SPAM','Не удалось проверить форму. Обновите страницу.');
    const token=typeof body.challenge==='string'?body.challenge:'';
    if(!/^[-a-z0-9]{36}$/.test(token))fail(400,'CHALLENGE','Обновите проверку формы и повторите отправку.');
    const key='challenge:'+token, challenge=await tx.get(key);
    if(expired(challenge,now)||challenge.visitor!==visitor||challenge.purpose!==purpose)fail(400,'CHALLENGE','Проверка формы истекла. Повторите отправку.');
    if(now-challenge.createdAt<MIN_FORM_MS)fail(429,'FORM_TOO_FAST','Подождите пару секунд перед отправкой.',{retryAfter:2});
    await tx.delete(key);
  }
  async scheduleCleanup() { if(await this.ctx.storage.getAlarm()===null)await this.ctx.storage.setAlarm(Date.now()+60000); }
  async alarm() {
    const now=Date.now(), entries=await this.ctx.storage.list({prefix:'expires:',limit:128});
    for(const [expiryKey,item]of entries){
      if(item.expiresAt>now)break;
      await this.ctx.storage.transaction(async tx=>{const value=await tx.get(item.key);if(value?.expiresAt===item.expiresAt)await tx.delete(item.key);await tx.delete(expiryKey);});
    }
    const next=await this.ctx.storage.list({prefix:'expires:',limit:1});
    if(next.size)await this.ctx.storage.setAlarm(Math.max(Date.now()+1000,next.values().next().value.expiresAt));
  }
  async fetch(request) {
    try {
      await this.ready;
      const url=new URL(request.url),path=url.pathname;
      if(request.method==='GET'&&path==='/reviews')return await this.listReviews(url);
      if(request.method==='GET'&&/^\/reviews\/[-a-z0-9]{36}\/photo$/.test(path))return await this.photo(path.split('/')[2]);
      if(request.method==='DELETE'&&/^\/reviews\/[-a-z0-9]{36}$/.test(path))return await this.deleteReview(path.split('/')[2]);
      const visitor=await sha256(this.salt+':'+request.headers.get('X-Visitor-IP'));
      if(request.method==='GET'&&path==='/challenge'){
        const purpose=url.searchParams.get('purpose');if(!['order','review'].includes(purpose))fail(400,'VALIDATION','Некорректная форма.');
        const now=Date.now(),token=crypto.randomUUID();
        await this.ctx.storage.transaction(async tx=>{
          await this.rate(tx,'rate:challenge:'+visitor,30,600000,now);
          await this.expiring(tx,'challenge:'+token,{visitor,purpose,createdAt:now},now+CHALLENGE_TTL);
        });
        await this.scheduleCleanup();return response({token,minWaitMs:MIN_FORM_MS,expiresInMs:CHALLENGE_TTL});
      }
      if(request.method==='POST'&&path==='/reviews')return await this.addReview(await readJson(request,450000),visitor);
      if(request.method==='POST'&&path==='/')return await this.placeOrder(await readJson(request,32000),visitor);
      return response({ok:false,error:'Not found'},404);
    }catch(error){
      if(error instanceof ApiError)return response({ok:false,code:error.code,error:error.message,...error.details},error.status,error.details.retryAfter?{'Retry-After':String(error.details.retryAfter)}:{});
      return response({ok:false,error:'Сервис временно недоступен. Повторите позже.'},503);
    }
  }
  async placeOrder(body,visitor) {
    if(!this.env.TELEGRAM_BOT_TOKEN||!this.env.TELEGRAM_CHAT_ID)fail(503,'NOT_CONFIGURED','Приём заказов временно недоступен.');
    const now=Date.now();
    // Short, explicitly configured rollout window: the previous storefront has
    // no challenge or ID. Still enforce authoritative prices, atomic limits and
    // deduplication; this compatibility path expires automatically.
    const legacy=!body.order?.id&&typeof body.text==='string'&&now<Date.parse(this.env.LEGACY_CHECKOUT_UNTIL||'');
    const input=legacy?{...body.order,id:'legacy-'+(await sha256(JSON.stringify(body.order))).slice(0,48)}:body.order;
    if(legacy&&body.website===undefined)body.website='';
    if(typeof body.website!=='string'||body.website.trim())fail(400,'SPAM','Не удалось проверить форму.');
    if(!input||typeof input!=='object')fail(400,'VALIDATION','Передайте состав заказа.');
    const id=submissionId(input.id),key='order:'+id;
    const fingerprint=await sha256(JSON.stringify(input));
    // A retry with the same ID must never send a successfully delivered order twice.
    const previous=await this.ctx.storage.get(key);
    if(!expired(previous,now)){
      if(previous.visitor!==visitor||previous.fingerprint!==fingerprint)fail(409,'ID_CONFLICT','Номер отправки уже использован.');
      if(previous.status==='sent')return response(previous.result);
      if(previous.status!=='failed')fail(409,'ORDER_PENDING','Этот заказ уже обрабатывается. Не отправляйте его повторно.');
    }
    const menu=validateCatalog((this.env.CATALOG?await this.env.CATALOG.get('menu','json'):null)??DEFAULT_MENU);
    const order=validateOrder(input,menu),number=previous?.number||`${new Date().toISOString().slice(0,10).replaceAll('-','')}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
    const message=orderMessage(order,number);
    if(message.length>4000)fail(400,'ORDER_TOO_LONG','Заказ слишком длинный. Сократите комментарий или количество разных блюд.');
    const claim=await this.ctx.storage.transaction(async tx=>{
      const existing=await tx.get(key);
      if(!expired(existing,now)){
        if(existing.visitor!==visitor||existing.fingerprint!==fingerprint)fail(409,'ID_CONFLICT','Номер отправки уже использован.');
        if(existing.status==='sent')return existing.result;
        if(existing.status!=='failed')fail(409,'ORDER_PENDING','Этот заказ уже обрабатывается.');
        if(existing.attempts>=3)fail(429,'RATE_LIMIT','Лимит повторных попыток исчерпан. Попробуйте позже.');
      }else{
        if(!legacy)await this.consume(tx,body,'order',visitor,now);
        await this.rate(tx,'rate:order:'+visitor,3,600000,now);
      }
      await this.expiring(tx,key,{visitor,fingerprint,number,status:'pending',attempts:(existing?.attempts||0)+1},now+86400000);
      return null;
    });
    if(claim)return response(claim);
    await this.scheduleCleanup();
    let telegram;
    try {
      telegram=await fetch(`https://api.telegram.org/bot${this.env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:this.env.TELEGRAM_CHAT_ID,text:message,disable_web_page_preview:true}),signal:AbortSignal.timeout(12000)});
    }catch{
      // Delivery may have succeeded even when its response was lost. Keep the claim
      // to prevent a retry from creating a second real Telegram order.
      fail(503,'ORDER_UNCERTAIN','Ответ службы заказов не получен. Повторная отправка этого заказа заблокирована, чтобы избежать дубля.');
    }
    const result=await telegram.json().catch(()=>null);
    if(result?.ok===false){
      await this.ctx.storage.transaction(async tx=>{const record=await tx.get(key);await tx.put(key,{...record,status:'failed'});});
      fail(502,'DELIVERY_FAILED','Не удалось отправить заказ. Корзина сохранена, попробуйте ещё раз.');
    }
    if(!telegram.ok||result?.ok!==true)fail(503,'ORDER_UNCERTAIN','Не удалось подтвердить отправку заказа. Повторная отправка заблокирована, чтобы избежать дубля.');
    const receipt={ok:true,orderNumber:number,subtotal:order.subtotal,delivery:order.delivery,total:order.total};
    await this.ctx.storage.transaction(async tx=>{const record=await tx.get(key);await tx.put(key,{...record,status:'sent',result:receipt});});
    return response(receipt);
  }
  async addReview(body,visitor) {
    if(typeof body.website!=='string'||body.website.trim())fail(400,'SPAM','Не удалось проверить форму.');
    const id=submissionId(body.id),review=validateReview(body),now=Date.now();
    const fingerprint=await sha256(JSON.stringify(review)), key='review-submit:'+id;
    const photoChunks=review.photo?Array.from({length:Math.ceil(review.photo.length/60000)},(_,i)=>review.photo.slice(i*60000,(i+1)*60000)):[];
    const reviewId=crypto.randomUUID(),indexKey=`review:${String(9999999999999-now).padStart(13,'0')}:${reviewId}`;
    const record={id:reviewId,name:review.name,text:review.text,rating:review.rating,createdAt:new Date(now).toISOString(),hasPhoto:!!review.photo};
    const result=await this.ctx.storage.transaction(async tx=>{
      const submitted=await tx.get(key);
      if(!expired(submitted,now)){
        if(submitted.visitor!==visitor||submitted.fingerprint!==fingerprint)fail(409,'ID_CONFLICT','Номер отправки уже использован.');
        return submitted.result;
      }
      await this.consume(tx,body,'review',visitor,now);
      const duplicate=await tx.get('review-duplicate:'+fingerprint);
      if(!expired(duplicate,now))fail(409,'DUPLICATE','Такой отзыв уже опубликован.');
      await this.rate(tx,'rate:review:'+visitor,2,3600000,now);
      await tx.put(indexKey,record);await tx.put('review-id:'+reviewId,{indexKey,chunks:photoChunks.length,type:review.photoType});
      for(let i=0;i<photoChunks.length;i++)await tx.put(`photo:${reviewId}:${i}`,photoChunks[i]);
      const stats=(await tx.get('review-stats'))||{count:0,sum:0};await tx.put('review-stats',{count:stats.count+1,sum:stats.sum+review.rating});
      const result={ok:true,review:record};
      await this.expiring(tx,key,{visitor,fingerprint,result},now+86400000);
      await this.expiring(tx,'review-duplicate:'+fingerprint,{},now+86400000);
      return result;
    });
    await this.scheduleCleanup();return response(result,201);
  }
  async listReviews(url) {
    const cursor=url.searchParams.get('cursor')||'';
    if(cursor&&!/^review:\d{13}:[-a-z0-9]{36}$/.test(cursor))fail(400,'VALIDATION','Некорректная страница отзывов.');
    const entries=await this.ctx.storage.list({prefix:'review:',limit:13,...(cursor?{startAfter:cursor}:{})});
    const list=Array.from(entries),page=list.slice(0,12),stats=(await this.ctx.storage.get('review-stats'))||{count:0,sum:0};
    return response({reviews:page.map(([,value])=>value),nextCursor:list.length>12?page.at(-1)[0]:'',count:stats.count,average:stats.count?Math.round(stats.sum/stats.count*10)/10:null});
  }
  async photo(id) {
    const meta=await this.ctx.storage.get('review-id:'+id);
    if(!meta?.chunks)return response({error:'Not found'},404);
    const keys=Array.from({length:meta.chunks},(_,i)=>`photo:${id}:${i}`),parts=await this.ctx.storage.get(keys);
    if(keys.some(key=>!parts.has(key)))return response({error:'Not found'},404);
    const bytes=Uint8Array.from(atob(keys.map(key=>parts.get(key)).join('')),c=>c.charCodeAt(0));
    return new Response(bytes,{headers:{'Content-Type':meta.type,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'}});
  }
  async deleteReview(id) {
    await this.ctx.storage.transaction(async tx=>{
      const meta=await tx.get('review-id:'+id);if(!meta)fail(404,'NOT_FOUND','Отзыв не найден.');
      const review=await tx.get(meta.indexKey),stats=await tx.get('review-stats');
      if(review&&stats)await tx.put('review-stats',{count:Math.max(0,stats.count-1),sum:Math.max(0,stats.sum-review.rating)});
      await tx.delete([meta.indexKey,'review-id:'+id,...Array.from({length:meta.chunks},(_,i)=>`photo:${id}:${i}`)]);
    });
    return response({ok:true});
  }
}
