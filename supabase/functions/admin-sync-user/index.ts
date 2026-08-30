import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function env(name: string): string {
  return String(Deno.env.get(name) || "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const supabaseUrl = env("SUPABASE_URL");
    const anonKey = env("SUPABASE_ANON_KEY");
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ ok: false, error: "Server config tidak lengkap" }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const { data: actorRows, error: actorError } = await userClient
      .from("members")
      .select("role")
      .eq("auth_user_id", user.id)
      .limit(1);

    if (actorError) {
      return json({ ok: false, error: actorError.message }, 403);
    }

    const actorRole = String(
      Array.isArray(actorRows) && actorRows[0]
        ? (actorRows[0] as { role?: string }).role
        : "",
    )
      .trim()
      .toLowerCase();

    if (actorRole !== "admin") {
      return json({ ok: false, error: "Hanya admin yang boleh mengubah username" }, 403);
    }

    const body = await req.json();
    const targetAuthUserId = String(body.targetAuthUserId || "").trim();
    const email = String(body.email || "").trim().toLowerCase();

    if (!targetAuthUserId) {
      return json({ ok: false, error: "targetAuthUserId wajib" }, 400);
    }
    if (!email || !email.includes("@")) {
      return json({ ok: false, error: "Email login tidak valid" }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      targetAuthUserId,
      { email, email_confirm: true },
    );

    if (updateError) {
      return json({ ok: false, error: updateError.message }, 400);
    }

    return json({ ok: true, email });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: msg }, 500);
  }
});
