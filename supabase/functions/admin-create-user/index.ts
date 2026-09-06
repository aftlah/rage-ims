import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Must match `AUTH_EMAIL_DOMAIN` in src/lib/constants.ts */
const AUTH_EMAIL_DOMAIN = "rage.example.com";

const ALLOWED_ROLES = new Set([
  "Internship",
  "Hangaround",
  "Hoodlum",
  "Highrank",
  "Admin",
]);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function env(name: string): string {
  return String(Deno.env.get(name) || "").trim();
}

function normalizeUsername(raw: string): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
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
      return json(
        { ok: false, error: "Hanya admin yang boleh menambah member" },
        403,
      );
    }

    const body = await req.json();
    const nama = String(body.nama || "").trim();
    const username = normalizeUsername(String(body.username || ""));
    const password = String(body.password || "");
    const role = String(body.role || "Hoodlum").trim() || "Hoodlum";

    if (!nama || nama.length < 2) {
      return json({ ok: false, error: "Nama minimal 2 karakter" }, 400);
    }
    if (!username || username.length < 3) {
      return json({ ok: false, error: "Username minimal 3 karakter" }, 400);
    }
    if (password.length < 6) {
      return json({ ok: false, error: "Password minimal 6 karakter" }, 400);
    }
    if (!ALLOWED_ROLES.has(role)) {
      return json({ ok: false, error: "Role tidak valid" }, 400);
    }

    const email = `${username}@${AUTH_EMAIL_DOMAIN}`;

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: byEmail } = await adminClient
      .from("members")
      .select("id")
      .eq("email", email)
      .limit(1);
    if (Array.isArray(byEmail) && byEmail.length) {
      return json(
        { ok: false, error: "Username sudah dipakai member lain" },
        400,
      );
    }

    const { data: byNama } = await adminClient
      .from("members")
      .select("id")
      .ilike("nama", nama)
      .limit(1);
    if (Array.isArray(byNama) && byNama.length) {
      return json(
        { ok: false, error: "Nama member sudah dipakai" },
        400,
      );
    }

    const { data: created, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          nama,
          username,
          must_change_password: true,
        },
      });

    if (createError || !created.user) {
      return json(
        {
          ok: false,
          error: createError?.message || "Gagal membuat akun Auth",
        },
        400,
      );
    }

    const authUserId = created.user.id;

    const insertFull = {
      nama,
      role,
      email,
      username,
      auth_user_id: authUserId,
    };

    let { data: memberRow, error: insertError } = await adminClient
      .from("members")
      .insert(insertFull)
      .select("id,nama,role,email,auth_user_id")
      .maybeSingle();

    if (
      insertError &&
      /username|column/i.test(String(insertError.message || ""))
    ) {
      ;({ data: memberRow, error: insertError } = await adminClient
        .from("members")
        .insert({
          nama,
          role,
          email,
          auth_user_id: authUserId,
        })
        .select("id,nama,role,email,auth_user_id")
        .maybeSingle());
    }

    if (insertError || !memberRow) {
      await adminClient.auth.admin.deleteUser(authUserId);
      return json(
        {
          ok: false,
          error: insertError?.message || "Gagal insert members",
        },
        400,
      );
    }

    return json({
      ok: true,
      memberId: Number(memberRow.id),
      nama: String(memberRow.nama || nama),
      role: String(memberRow.role || role),
      email: String(memberRow.email || email),
      authUserId,
      username,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: msg }, 500);
  }
});
