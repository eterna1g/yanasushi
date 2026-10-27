export { PublicData } from './public-api.js';
import { ApiError } from './commerce.js';
import { DEFAULT_SLIDES, validateSlides } from './slides-config.js';
import { DEFAULT_MENU, validateCatalog } from './catalog.js';

/**
 * YANASUSHI Telegram order receiver — Cloudflare Worker
 *
 * Required Worker secrets:
 *   TELEGRAM_BOT_TOKEN = token from @BotFather
 *   TELEGRAM_CHAT_ID   = numeric chat/group/channel ID receiving orders
 *
 * Optional variable:
 *   ALLOWED_ORIGIN = exact site origin, e.g. https://your-site.netlify.app
 */
const corsHeaders = (origin, env) => {
  const allowed = env.ALLOWED_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin": allowed === "*" ? "*" : (origin === allowed ? allowed : "null"),
    "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Yanasushi-API": "1",
    "Vary": "Origin",
  };
};

function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers });
}

async function isAdmin(request,env) {
  if(typeof env.ADMIN_TOKEN!=='string'||env.ADMIN_TOKEN.length<24)return false;
  const digest=async value=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
  const a=await digest(request.headers.get('Authorization')||''),b=await digest(`Bearer ${env.ADMIN_TOKEN}`);
  let difference=0;for(let i=0;i<a.length;i++)difference|=a[i]^b[i];return difference===0;
}

async function handle(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }
    const path = new URL(request.url).pathname;
    const publicRead = request.method === 'GET' && !origin && (['/health','/catalog','/slides','/reviews'].includes(path) || /^\/reviews\/[-a-z0-9]{36}\/photo$/.test(path));
    if (env.ALLOWED_ORIGIN && origin !== env.ALLOWED_ORIGIN && !publicRead) {
      return json({ ok: false, error: "Origin not allowed" }, 403, headers);
    }
    if (path === '/health' && request.method === 'GET') {
      return json({ok:true,apiVersion:2,publicData:!!env.PUBLIC_DATA,catalogStorage:!!env.CATALOG,adminConfigured:typeof env.ADMIN_TOKEN==='string' && env.ADMIN_TOKEN.length>=24},200,headers);
    }
    if (path === '/catalog' || path === '/slides') {
      const isSlides=path==='/slides';
      const key=isSlides?'slides':'menu';
      if (request.method === 'GET') {
        const items = env.CATALOG ? await env.CATALOG.get(key, 'json') : null;
        return json(items ?? (isSlides?DEFAULT_SLIDES:DEFAULT_MENU), 200, { ...headers, 'Cache-Control': 'no-store' });
      }
      if (request.method !== 'PUT') return json({ error: 'Method not allowed' }, 405, headers);
      if (!env.CATALOG) return json({ error: 'В Cloudflare не подключено KV-хранилище CATALOG. Подключите привязку и повторите публикацию.' }, 503, headers);
      if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 24) return json({ error: 'В Cloudflare не настроен ADMIN_TOKEN (секрет от 24 символов).' }, 503, headers);
      if(!await isAdmin(request,env))return json({error:'Неверный ключ администратора'},401,headers);
      try {
        // Bound the body while reading, including requests without Content-Length.
        const reader = request.body?.getReader();
        if (!reader) throw new Error('Пустой запрос');
        let size = 0; const chunks = [];
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 8000000) { await reader.cancel(); return json({ error: 'Данные больше 8 МБ' }, 413, headers); }
          chunks.push(value);
        }
        const bytes = new Uint8Array(size); let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        const items = (isSlides?validateSlides:validateCatalog)(JSON.parse(new TextDecoder().decode(bytes)));
        try { await env.CATALOG.put(key, JSON.stringify(items)); }
        catch { return json({error:`Хранилище ${isSlides?'слайдов':'меню'} недоступно. Черновик не опубликован; повторите позже.`},503,headers); }
        return json({ ok: true }, 200, headers);
      } catch (error) { return json({ error: error.message }, 400, headers); }
    }
    const publicRoute=(path==='/'&&request.method==='POST') || (path==='/challenge'&&request.method==='GET') || (path==='/reviews'&&['GET','POST'].includes(request.method)) || (/^\/reviews\/[-a-z0-9]{36}\/photo$/.test(path)&&request.method==='GET');
    const deleteReview=/^\/reviews\/[-a-z0-9]{36}$/.test(path)&&request.method==='DELETE';
    if(publicRoute||deleteReview){
      if(deleteReview && !await isAdmin(request,env))return json({ok:false,error:'Неверный ключ администратора'},401,headers);
      if(!env.PUBLIC_DATA)return json({ok:false,code:'NOT_CONFIGURED',error:'Приём заказов и отзывов временно недоступен.'},503,headers);
      const id=env.PUBLIC_DATA.idFromName('public-v1');
      const forwarded=new Request(request.url,{method:request.method,headers:{'Content-Type':request.headers.get('Content-Type')||'application/json','X-Visitor-IP':request.headers.get('CF-Connecting-IP')||'unknown'},...(request.body?{body:request.body,duplex:'half'}:{})});
      const result=await env.PUBLIC_DATA.get(id).fetch(forwarded);
      const merged=new Headers(headers);result.headers.forEach((value,key)=>merged.set(key,value));
      return new Response(result.body,{status:result.status,headers:merged});
    }
    return json({ok:false,error:'Not found'},404,headers);
}

export default {
  async fetch(request,env) {
    try { return await handle(request,env); }
    catch(error) { if(error instanceof ApiError)return json({ok:false,code:error.code,error:error.message,...error.details},error.status,corsHeaders(request.headers.get('Origin')||'',env));return json({ok:false,error:"Сервис временно недоступен. Повторите запрос позже."},503,corsHeaders(request.headers.get("Origin") || "",env)); }
  }
};
