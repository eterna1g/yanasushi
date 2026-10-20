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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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
    if (request.method !== "POST") {
      return json({ ok: false, error: "Method not allowed" }, 405, headers);
    }
    if (env.ALLOWED_ORIGIN && origin !== env.ALLOWED_ORIGIN) {
      return json({ ok: false, error: "Origin not allowed" }, 403, headers);
    }
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
