import { AUTH_EMAIL_DOMAIN } from './constants'
import { rpcAdminInsertAuditLog, rpcAdminPatchMember } from './adminRpc'
import { supabase } from './supabase'

export type AdminMember = {
  id: number
  nama: string
  role: string
  email: string | null
  auth_user_id: string | null
}

export type AuditRow = {
  created_at: string
  action: string
  actor_auth_user_id: string | null
  target_auth_user_id: string | null
  target_member_id: number | null
}

export const MEMBER_ROLES = [
  'Internship',
  'Hangaround',
  'Hoodlum',
  'Highrank',
  'Admin',
] as const

export async function fetchAdminMembers(): Promise<{
  data: AdminMember[]
  error: string | null
}> {
  const { data, error } = await supabase
    .from('members')
    .select('id,nama,role,email,auth_user_id')
    .order('nama', { ascending: true })
    .limit(500)

  if (error) return { data: [], error: error.message }
  return {
    data: (data || []).map((r) => ({
      id: Number(r.id),
      nama: String(r.nama || ''),
      role: String(r.role || ''),
      email: r.email == null ? null : String(r.email),
      auth_user_id: r.auth_user_id == null ? null : String(r.auth_user_id),
    })),
    error: null,
  }
}

export async function fetchAccountAuditLogs(): Promise<{
  data: AuditRow[]
  error: string | null
}> {
  const { data, error } = await supabase
    .from('account_audit_logs')
    .select(
      'created_at,action,actor_auth_user_id,target_auth_user_id,target_member_id',
    )
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return { data: [], error: error.message }
  return {
    data: (data || []).map((r) => ({
      created_at: String(r.created_at || ''),
      action: String(r.action || ''),
      actor_auth_user_id: r.actor_auth_user_id
        ? String(r.actor_auth_user_id)
        : null,
      target_auth_user_id: r.target_auth_user_id
        ? String(r.target_auth_user_id)
        : null,
      target_member_id:
        r.target_member_id == null ? null : Number(r.target_member_id),
    })),
    error: null,
  }
}

/** Role update via table + RLS (mirror updateMemberRole). Not service role. */
export async function updateMemberRole(args: {
  memberId: number
  role: string
  actorAuthUserId: string | null
  targetAuthUserId: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('members')
    .update({ role: args.role })
    .eq('id', args.memberId)

  if (error) return { ok: false, error: error.message }

  await rpcAdminInsertAuditLog({
    action: 'set_member_role',
    actor_auth_user_id: args.actorAuthUserId,
    target_auth_user_id: args.targetAuthUserId,
    target_member_id: args.memberId,
    meta: { role: args.role },
  })

  return { ok: true }
}

/**
 * Patch members.email/username via RPC only.
 * Auth login email sync requires service role → Edge Function TODO.
 */
export async function patchMemberProfileViaRpc(args: {
  memberId: number
  username: string
  actorAuthUserId: string | null
  targetAuthUserId: string | null
}): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const username = String(args.username || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
  if (!username || username.length < 3) {
    return { ok: false, error: 'Username minimal 3 karakter' }
  }

  const nextEmail = `${username}@${AUTH_EMAIL_DOMAIN}`
  const patchRes = await rpcAdminPatchMember(args.memberId, {
    email: nextEmail,
    username,
  })
  if (!patchRes.ok) return patchRes

  await rpcAdminInsertAuditLog({
    action: 'set_username_members_only',
    actor_auth_user_id: args.actorAuthUserId,
    target_auth_user_id: args.targetAuthUserId,
    target_member_id: args.memberId,
    meta: {
      new_email: nextEmail,
      new_username: username,
      note: 'Auth email tidak diubah — butuh Edge Function',
    },
  })

  return { ok: true, email: nextEmail }
}
