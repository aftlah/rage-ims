import type { User } from '@supabase/supabase-js'
import {
  AUTH_EMAIL_DOMAIN,
  DEVICE_ID_KEY,
  LEGACY_AUTH_EMAIL_DOMAIN,
} from './constants'
import { supabase } from './supabase'

export type Member = {
  id: number
  nama: string
  role: string
  auth_user_id: string | null
}

export function isAdminRole(role: string | null | undefined): boolean {
  return String(role || '')
    .trim()
    .toLowerCase() === 'admin'
}

export function isAdminMember(member: Member | null | undefined): boolean {
  return isAdminRole(member?.role)
}

export function buildEmailCandidates(usernameOrEmail: string): string[] {
  const value = usernameOrEmail.trim().slice(0, 160)
  if (!value) return []
  if (value.includes('@')) return [value]
  return [`${value}@${AUTH_EMAIL_DOMAIN}`, `${value}@${LEGACY_AUTH_EMAIL_DOMAIN}`]
}

export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY)
    if (existing) return existing
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${String(Math.random()).slice(2)}`
    localStorage.setItem(DEVICE_ID_KEY, id)
    return id
  } catch {
    return 'unknown'
  }
}

export async function resolveMember(user: User): Promise<Member | null> {
  const uid = user.id
  const { data, error } = await supabase
    .from('members')
    .select('id,nama,role,auth_user_id')
    .eq('auth_user_id', uid)
    .limit(1)

  if (error) {
    console.warn('resolveMember:', error.message)
    return null
  }

  const row = Array.isArray(data) && data.length ? data[0] : null
  if (!row) return null

  return {
    id: Number(row.id),
    nama: String(row.nama || ''),
    role: String(row.role || ''),
    auth_user_id: row.auth_user_id ? String(row.auth_user_id) : null,
  }
}

/** Optional: mirror login.html failed_login_attempts insert. */
export async function logFailedLogin(
  usernameOrEmail: string,
  reason: string,
): Promise<void> {
  try {
    await supabase.from('failed_login_attempts').insert({
      username: String(usernameOrEmail || '').trim().slice(0, 160),
      ip_address: null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent || '' : '',
      failure_reason: String(reason || 'unknown').slice(0, 200),
    })
  } catch {
    // optional logging — ignore failures
  }
}

/** Optional: mirror login.html user_login_sessions insert. */
export async function recordLoginSession(authUserId: string): Promise<void> {
  try {
    await supabase.from('user_login_sessions').insert({
      auth_user_id: authUserId,
      device_id: getDeviceId(),
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent || '' : '',
    })
  } catch {
    // optional logging — ignore failures
  }
}

/** Optional: mirror script.js markSessionLogout. */
export async function markSessionLogout(authUserId: string): Promise<void> {
  try {
    await supabase
      .from('user_login_sessions')
      .update({
        logout_time: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      })
      .eq('auth_user_id', authUserId)
      .eq('device_id', getDeviceId())
  } catch {
    // optional logging — ignore failures
  }
}

export function getUsernameFromEmail(email: string | null | undefined): string {
  const raw = String(email || '').trim()
  if (!raw) return ''
  return raw.split('@')[0] || ''
}

export function validatePasswordStrength(
  password: string,
): { ok: true } | { ok: false; message: string } {
  const value = String(password || '')
  if (value.length < 6) {
    return { ok: false, message: 'Password minimal 6 karakter' }
  }
  return { ok: true }
}

export async function changeCurrentUserPassword(
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { data: userRes, error: userError } = await supabase.auth.getUser()
    if (userError) {
      return { ok: false, error: userError.message }
    }

    const user = userRes.user
    const meta = user?.user_metadata ?? {}
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      data: { ...meta, must_change_password: false },
    })

    if (error) {
      return { ok: false, error: error.message }
    }
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Gagal mengubah password',
    }
  }
}
