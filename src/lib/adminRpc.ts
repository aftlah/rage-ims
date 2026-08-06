import { supabase } from './supabase'

export type AdminMemberPatch = {
  email?: string | null
  username?: string | null
}

export type AuditLogPayload = {
  action: string
  actor_auth_user_id?: string | null
  target_auth_user_id?: string | null
  target_member_id?: number | null
  meta?: Record<string, unknown>
}

/** Mirror rpcAdminInsertAuditLog — no service role. */
export async function rpcAdminInsertAuditLog(
  payload: AuditLogPayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.rpc('rage_admin_insert_audit_log', {
    p_payload: payload || {},
  })
  if (error) {
    return {
      ok: false,
      error:
        error.message +
        ' — pastikan RPC rage_admin_insert_audit_log tersedia untuk authenticated',
    }
  }
  return { ok: true }
}

/** Mirror rpcAdminPatchMember — patches email/username only (per SQL migration). */
export async function rpcAdminPatchMember(
  memberId: number,
  patch: AdminMemberPatch,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = Number(memberId)
  if (!id) return { ok: false, error: 'member_id tidak valid' }
  const { error } = await supabase.rpc('rage_admin_patch_member', {
    p_member_id: id,
    p_patch: patch || {},
  })
  if (error) {
    return {
      ok: false,
      error:
        error.message +
        ' — pastikan RPC rage_admin_patch_member tersedia untuk authenticated',
    }
  }
  return { ok: true }
}
