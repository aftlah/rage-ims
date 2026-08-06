import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Secure Discord notify — webhook URLs live in Edge secrets only.
 * Frontend sends channel + content/embeds; never webhook URLs.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type DiscordChannel =
  | "orders"
  | "order_window"
  | "dashboard"
  | "order_payment"
  | "storan"
  | "absen"
  | "nitip_cuci"
  | "drugs"
  | "rage_cash";

type DiscordAction = "post" | "patch" | "delete";

const CHANNELS = new Set<string>([
  "orders",
  "order_window",
  "dashboard",
  "order_payment",
  "storan",
  "absen",
  "nitip_cuci",
  "drugs",
  "rage_cash",
]);

function env(name: string): string {
  return String(Deno.env.get(name) || "").trim();
}

function resolveWebhook(channel: DiscordChannel): string | null {
  const def = env("DISCORD_WEBHOOK_URL");
  const storan = env("DISCORD_STORAN_WEBHOOK_URL") || def;

  switch (channel) {
    case "orders":
    case "order_window":
    case "dashboard":
      return def || null;
    case "order_payment":
      return env("DISCORD_ORDER_PAYMENT_WEBHOOK_URL") || def || null;
    case "storan":
      return storan || null;
    case "absen":
      return env("DISCORD_ABSEN_WEBHOOK_URL") || null;
    case "nitip_cuci":
      return env("DISCORD_NITIP_CUCI_WEBHOOK_URL") || storan || def || null;
    case "drugs":
      return env("DISCORD_DRUGS_WEBHOOK_URL") || def || null;
    case "rage_cash":
      return env("DISCORD_RAGE_CASH_WEBHOOK_URL") || null;
    default:
      return null;
  }
}

function parseWebhook(url: string) {
  const m = String(url || "").match(/webhooks\/(\d+)\/([^/?]+)/i);
  if (!m) return null;
  return { webhookId: m[1], webhookToken: m[2] };
}

function withWait(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("wait", "true");
    return u.toString();
  } catch {
    return url.includes("?") ? `${url}&wait=true` : `${url}?wait=true`;
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (env("DISCORD_ENABLED").toLowerCase() === "false") {
      return json({ ok: true, skipped: true, detail: "DISCORD_ENABLED=false" });
    }

    const body = await req.json();
    const channel = String(body.channel || "").trim() as DiscordChannel;
    const action = (String(body.action || "post").trim().toLowerCase() ||
      "post") as DiscordAction;
    const messageId = String(body.messageId || "").trim();
    const content =
      body.content === null || body.content === undefined
        ? undefined
        : String(body.content);
    const embeds = Array.isArray(body.embeds) ? body.embeds : undefined;

    if (!CHANNELS.has(channel)) {
      return json({ ok: false, detail: "channel tidak valid" }, 400);
    }
    if (action !== "post" && action !== "patch" && action !== "delete") {
      return json({ ok: false, detail: "action tidak valid" }, 400);
    }

    const webhookUrl = resolveWebhook(channel);
    if (!webhookUrl) {
      return json({
        ok: true,
        skipped: true,
        detail: `Webhook untuk channel ${channel} belum di-set`,
      });
    }

    const parsed = parseWebhook(webhookUrl);
    if (!parsed) {
      return json({ ok: false, detail: "Format webhook secret tidak valid" }, 500);
    }

    if (action === "delete") {
      if (!messageId) {
        return json({ ok: false, detail: "messageId wajib untuk delete" }, 400);
      }
      const url =
        `https://discord.com/api/v10/webhooks/${parsed.webhookId}/${parsed.webhookToken}/messages/${encodeURIComponent(messageId)}`;
      const res = await fetch(url, { method: "DELETE" });
      const text = await res.text();
      const ok = res.ok || res.status === 204 || res.status === 404;
      return json({
        ok,
        status: res.status,
        detail: text.slice(0, 500) || undefined,
      });
    }

    if (action === "patch") {
      if (!messageId) {
        return json({ ok: false, detail: "messageId wajib untuk patch" }, 400);
      }
      const url =
        `https://discord.com/api/v10/webhooks/${parsed.webhookId}/${parsed.webhookToken}/messages/${encodeURIComponent(messageId)}`;
      const payload: Record<string, unknown> = {};
      if (content !== undefined) payload.content = content;
      if (embeds !== undefined) payload.embeds = embeds;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let mid = messageId;
      try {
        const data = JSON.parse(text);
        if (data && data.id) mid = String(data.id);
      } catch {
        /* ignore */
      }
      return json({
        ok: res.ok,
        messageId: mid,
        status: res.status,
        detail: res.ok ? undefined : text.slice(0, 500),
      });
    }

    // post
    if (content === undefined && (!embeds || !embeds.length)) {
      return json({ ok: false, detail: "content atau embeds wajib" }, 400);
    }
    const url = withWait(
      `https://discord.com/api/v10/webhooks/${parsed.webhookId}/${parsed.webhookToken}`,
    );
    const payload: Record<string, unknown> = {};
    if (content !== undefined) payload.content = content;
    if (embeds !== undefined) payload.embeds = embeds;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let mid: string | undefined;
    try {
      const data = JSON.parse(text);
      if (data && data.id) mid = String(data.id);
    } catch {
      /* ignore */
    }
    return json({
      ok: res.ok,
      messageId: mid,
      status: res.status,
      detail: res.ok ? undefined : text.slice(0, 500),
    });
  } catch (e) {
    return json(
      {
        ok: false,
        detail: String(e instanceof Error ? e.message : e),
      },
      500,
    );
  }
});
