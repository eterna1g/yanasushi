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
    "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
  };
};

function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }
    if (env.ALLOWED_ORIGIN && origin !== env.ALLOWED_ORIGIN) {
      return json({ ok: false, error: "Origin not allowed" }, 403, headers);
    }
    const path = new URL(request.url).pathname;
    if (path === '/catalog') {
      if (request.method === 'GET') {
        const items = env.CATALOG ? await env.CATALOG.get('menu', 'json') : null;
        return json(items ?? DEFAULT_MENU, 200, { ...headers, 'Cache-Control': 'no-store' });
      }
      if (request.method !== 'PUT') return json({ error: 'Method not allowed' }, 405, headers);
      if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 24 || !env.CATALOG) return json({ error: 'Настройте CATALOG KV и ADMIN_TOKEN (от 24 символов) в Cloudflare' }, 503, headers);
      const supplied = request.headers.get('Authorization') || '';
      const digest = async value => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
      const a = await digest(supplied), b = await digest(`Bearer ${env.ADMIN_TOKEN}`);
      let difference = 0;
      for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
      if (difference) return json({ error: 'Неверный ключ администратора' }, 401, headers);
      try {
        // Bound the body while reading, including requests without Content-Length.
        const reader = request.body?.getReader();
        if (!reader) throw new Error('Пустой запрос');
        let size = 0; const chunks = [];
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 8000000) { await reader.cancel(); return json({ error: 'Каталог больше 8 МБ' }, 413, headers); }
          chunks.push(value);
        }
        const bytes = new Uint8Array(size); let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        const items = validateCatalog(JSON.parse(new TextDecoder().decode(bytes)));
        await env.CATALOG.put('menu', JSON.stringify(items));
        return json({ ok: true }, 200, headers);
      } catch (error) { return json({ error: error.message }, 400, headers); }
    }
    if (path !== '/') return json({ error: 'Not found' }, 404, headers);
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, headers);
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
      return json({ ok: false, error: "Worker Telegram secrets are not configured" }, 500, headers);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ ok: false, error: "Invalid JSON" }, 400, headers);
    }

    const text = typeof payload?.text === "string" ? payload.text.trim() : "";
    if (!text || text.length > 12000) {
      return json({ ok: false, error: "Invalid order text" }, 400, headers);
    }

    const tgResponse = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: `🍣 НОВЫЙ ЗАКАЗ YANASUSHI\n\n${text}`,
          disable_web_page_preview: true
        })
      }
    );

    const tgResult = await tgResponse.json().catch(() => ({}));
    if (!tgResponse.ok || !tgResult.ok) {
      return json({ ok: false, error: "Telegram could not deliver the order" }, 502, headers);
    }
    return json({ ok: true }, 200, headers);
  }
};
