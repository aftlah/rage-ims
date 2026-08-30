import { supabase } from './supabase'

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
      return { ok: false, error: error.message || 'Gagal memanggil admin-sync-user' }
    }

    const res = (data || {}) as { ok?: boolean; error?: string; email?: string }
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
