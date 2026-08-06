import { isMissingColumnError } from './orderUtils'
import { supabase } from './supabase'

export type MemberLite = {
  id: number
  nama: string
}

export async function fetchMembersLite(): Promise<{
  data: MemberLite[]
  error: string | null
}> {
  let res = await supabase
    .from('members')
    .select('id,nama')
    .is('deleted_at', null)
    .order('nama', { ascending: true })
    .limit(500)

  if (res.error && isMissingColumnError(res.error, 'deleted_at')) {
    res = await supabase
      .from('members')
      .select('id,nama')
      .order('nama', { ascending: true })
      .limit(500)
  }

  if (res.error) return { data: [], error: res.error.message }
  return {
    data: (res.data || []).map((r) => ({
      id: Number(r.id),
      nama: String(r.nama || ''),
    })),
    error: null,
  }
}
