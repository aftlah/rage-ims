import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'

type FunctionJson = {
  ok?: boolean
  error?: string
  email?: string
  deletedMemberId?: number
  deletedAuthUserId?: string | null
  nama?: string
  memberId?: number
  authUserId?: string
  role?: string
  username?: string
}

async function readFunctionJsonError(
  error: unknown,
  data: unknown,
): Promise<string> {
  const fromData = (data as FunctionJson)?.error
  if (fromData) return fromData

  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as FunctionJson
      if (body?.error) return body.error
    } catch {
      // ignore parse errors
    }
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Gagal memanggil Edge Function'
}

export type SyncAuthUserEmailResult =
  | { ok: true; email: string }
  | { ok: false; error: string }

/** Admin-only: sync Supabase Auth login email via Edge Function. */
export async function syncAuthUserEmail(args: {
  targetAuthUserId: string
  email: string
}): Promise<SyncAuthUserEmailResult> {
  try {
    const { data, error } = await supabase.functions.invoke('admin-sync-user', {
      body: {
        targetAuthUserId: args.targetAuthUserId,
        email: args.email,
      },
    })

    if (error) {
      return {
        ok: false,
        error: await readFunctionJsonError(error, data),
      }
    }

    const res = (data || {}) as FunctionJson
    if (!res.ok) {
      return { ok: false, error: res.error || 'Gagal sync email Auth' }
    }

    return { ok: true, email: String(res.email || args.email) }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Gagal sync email Auth',
    }
  }
}

export type DeleteAuthUserResult =
  | {
      ok: true
      deletedMemberId: number
      deletedAuthUserId: string | null
      nama: string
    }
  | { ok: false; error: string }

export type CreateAuthUserResult =
  | {
      ok: true
      memberId: number
      authUserId: string
      nama: string
      role: string
      email: string
      username: string
    }
  | { ok: false; error: string }

/** Admin-only: create Auth user + members row via Edge Function. */
export async function createAuthUserViaEdge(args: {
  nama: string
  username: string
  password: string
  role: string
}): Promise<CreateAuthUserResult> {
  try {
    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: {
        nama: args.nama,
        username: args.username,
        password: args.password,
        role: args.role,
      },
    })

    if (error) {
      return {
        ok: false,
        error: await readFunctionJsonError(error, data),
      }
    }

    const res = (data || {}) as FunctionJson
    if (!res.ok) {
      return { ok: false, error: res.error || 'Gagal menambah member' }
    }

    return {
      ok: true,
      memberId: Number(res.memberId || 0),
      authUserId: String(res.authUserId || ''),
      nama: String(res.nama || args.nama),
      role: String(res.role || args.role),
      email: String(res.email || ''),
      username: String(res.username || args.username),
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Gagal menambah member',
    }
  }
}

/** Admin-only: delete members row + Supabase Auth user via Edge Function. */
export async function deleteAuthUserViaEdge(args: {
  memberId: number
  targetAuthUserId: string | null
}): Promise<DeleteAuthUserResult> {
  try {
    const { data, error } = await supabase.functions.invoke('admin-delete-user', {
      body: {
        memberId: args.memberId,
        targetAuthUserId: args.targetAuthUserId || '',
        cascade: true,
      },
    })

    if (error) {
      return {
        ok: false,
        error: await readFunctionJsonError(error, data),
      }
    }

    const res = (data || {}) as FunctionJson
    if (!res.ok) {
      return { ok: false, error: res.error || 'Gagal hapus member' }
    }

    return {
      ok: true,
      deletedMemberId: Number(res.deletedMemberId || args.memberId),
      deletedAuthUserId: res.deletedAuthUserId ?? args.targetAuthUserId,
      nama: String(res.nama || ''),
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Gagal hapus member',
    }
  }
}
