import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RELATED_MEMBER_TABLES = [
  "orders",
  "storan_logs",
  "absen_kota_logs",
  "drugs_sales",
  "nitip_cuci_logs",
] as const;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function env(name: string): string {
  return String(Deno.env.get(name) || "").trim();
}

async function deleteMemberRelatedData(
  adminClient: SupabaseClient,
  memberId: number,
): Promise<{ ok: true; deleted: Record<string, number> } | { ok: false; error: string }> {
  const deleted: Record<string, number> = {};

  for (const table of RELATED_MEMBER_TABLES) {
    const { error, count } = await adminClient
      .from(table)
      .delete({ count: "exact" })
      .eq("member_id", memberId);

    if (error) {
      if (/relation.*does not exist|could not find the table/i.test(error.message)) {
        deleted[table] = 0;
        continue;
      }
      return {
        ok: false,
        error: `Gagal hapus data ${table}: ${error.message}`,
      };
    }

    deleted[table] = typeof count === "number" ? count : 0;
  }

  await adminClient
    .from("account_audit_logs")
    .delete()
    .eq("target_member_id", memberId);

  return { ok: true, deleted };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ ok: false, error: "Unauthorized" });
    }

    const supabaseUrl = env("SUPABASE_URL");
    const anonKey = env("SUPABASE_ANON_KEY");
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ ok: false, error: "Server config tidak lengkap" });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return json({ ok: false, error: "Unauthorized" });
    }

    const { data: actorRows, error: actorError } = await userClient
      .from("members")
      .select("id, role")
      .eq("auth_user_id", user.id)
      .limit(1);

    if (actorError) {
      return json({ ok: false, error: actorError.message });
    }

    const actorRow = Array.isArray(actorRows) ? actorRows[0] : null;
    const actorRole = String(
      actorRow ? (actorRow as { role?: string }).role : "",
    )
      .trim()
      .toLowerCase();

    if (actorRole !== "admin") {
      return json({
        ok: false,
        error: "Hanya admin yang boleh menghapus member",
      });
    }

    const body = await req.json();
    const memberId = Number(body.memberId);
    const targetAuthUserId = String(body.targetAuthUserId || "").trim();
    const cascade = body.cascade !== false;

    if (!memberId || !Number.isFinite(memberId)) {
      return json({ ok: false, error: "memberId wajib" });
    }

    if (targetAuthUserId && targetAuthUserId === user.id) {
      return json({ ok: false, error: "Tidak bisa menghapus akun sendiri" });
    }

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: targetRows, error: targetError } = await adminClient
      .from("members")
      .select("id, nama, role, auth_user_id")
      .eq("id", memberId)
      .limit(1);

    if (targetError) {
      return json({ ok: false, error: targetError.message });
    }

    const target = Array.isArray(targetRows) ? targetRows[0] : null;
    if (!target) {
      return json({ ok: false, error: "Member tidak ditemukan" });
    }

    const targetAuthId = String(
      (target as { auth_user_id?: string | null }).auth_user_id || "",
    ).trim();

    if (targetAuthId && targetAuthId === user.id) {
      return json({ ok: false, error: "Tidak bisa menghapus akun sendiri" });
    }

    const actorMemberId = Number(
      actorRow ? (actorRow as { id?: number }).id : 0,
    );
    if (actorMemberId && actorMemberId === memberId) {
      return json({ ok: false, error: "Tidak bisa menghapus akun sendiri" });
    }

    let cascadeDeleted: Record<string, number> | null = null;
    if (cascade) {
      const cascadeResult = await deleteMemberRelatedData(adminClient, memberId);
      if (!cascadeResult.ok) {
        return json({ ok: false, error: cascadeResult.error });
      }
      cascadeDeleted = cascadeResult.deleted;
    }

    const { error: memberDeleteError } = await adminClient
      .from("members")
      .delete()
      .eq("id", memberId);

    if (memberDeleteError) {
      return json({
        ok: false,
        error: memberDeleteError.message,
      });
    }

    const authIdToDelete = targetAuthUserId || targetAuthId;
    if (authIdToDelete) {
      const { error: authDeleteError } =
        await adminClient.auth.admin.deleteUser(authIdToDelete);

      if (authDeleteError) {
        return json({
          ok: false,
          error: `Baris member terhapus, tapi gagal hapus login Auth: ${authDeleteError.message}`,
        });
      }
    }

    return json({
      ok: true,
      deletedMemberId: memberId,
      deletedAuthUserId: authIdToDelete || null,
      nama: String((target as { nama?: string }).nama || ""),
      cascadeDeleted,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: msg });
  }
});
