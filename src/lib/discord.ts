import { isMissingColumnError } from './orderUtils'
import { supabase } from './supabase'

export type DiscordChannel =
  | 'orders'
  | 'order_window'
  | 'dashboard'
  | 'order_payment'
  | 'storan'
  | 'absen'
  | 'nitip_cuci'
  | 'drugs'
  | 'rage_cash'

export type DiscordAction = 'post' | 'patch' | 'delete'

export type DiscordNotifyResult = {
  ok: boolean
  messageId?: string
  skipped?: boolean
  detail?: string
}

export type DiscordNotifyRequest = {
  channel: DiscordChannel
  action: DiscordAction
  content?: string | null
  embeds?: Record<string, unknown>[]
  messageId?: string
}

const DISCORD_MESSAGE_ID_RPC: Record<string, string> = {
  drugs_sales: 'set_drugs_discord_message_id',
  nitip_cuci_logs: 'set_nitip_cuci_discord_message_id',
  rage_cash_logs: 'set_rage_cash_discord_message_id',
}

export function normalizeDiscordMessageId(
  id: string | number | null | undefined,
): string {
  return String(id || '').trim()
}

/** Invoke Edge Function `discord-notify`. Soft-fails — never throws to callers. */
export async function notifyDiscord(
  req: DiscordNotifyRequest,
): Promise<DiscordNotifyResult> {
  try {
    const { data, error } = await supabase.functions.invoke('discord-notify', {
      body: {
        channel: req.channel,
        action: req.action,
        content: req.content === undefined ? undefined : req.content,
        embeds: req.embeds,
        messageId: req.messageId
          ? normalizeDiscordMessageId(req.messageId)
          : undefined,
      },
    })

    if (error) {
      console.warn('[discord-notify]', error.message || error)
      return { ok: false, detail: error.message || 'invoke failed' }
    }

    const res = (data || {}) as DiscordNotifyResult
    return {
      ok: !!res.ok || !!res.skipped,
      messageId: res.messageId
        ? normalizeDiscordMessageId(res.messageId)
        : undefined,
      skipped: !!res.skipped,
      detail: res.detail,
    }
  } catch (e) {
    console.warn('[discord-notify]', e)
    return {
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    }
  }
}

export async function postDiscord(opts: {
  channel: DiscordChannel
  content?: string | null
  embeds?: Record<string, unknown>[]
}): Promise<string | null> {
  const res = await notifyDiscord({
    channel: opts.channel,
    action: 'post',
    content: opts.content,
    embeds: opts.embeds,
  })
  if (!res.ok || res.skipped) return null
  return res.messageId || null
}

export async function patchDiscord(opts: {
  channel: DiscordChannel
  messageId: string
  content?: string | null
  embeds?: Record<string, unknown>[]
}): Promise<string | null> {
  const res = await notifyDiscord({
    channel: opts.channel,
    action: 'patch',
    messageId: opts.messageId,
    content: opts.content,
    embeds: opts.embeds,
  })
  if (!res.ok || res.skipped) return null
  return res.messageId || opts.messageId
}

export async function deleteDiscordMessage(
  channel: DiscordChannel,
  messageId: string | null | undefined,
): Promise<void> {
  const mid = normalizeDiscordMessageId(messageId)
  if (!mid) return
  await notifyDiscord({ channel, action: 'delete', messageId: mid })
}

export async function persistDiscordMessageId(
  tableName: string,
  rowId: string | number,
  messageId: string,
): Promise<void> {
  const mid = normalizeDiscordMessageId(messageId)
  if (!mid || rowId == null || rowId === '') return

  const rpcName = DISCORD_MESSAGE_ID_RPC[tableName]
  if (rpcName) {
    const { error: rpcErr } = await supabase.rpc(rpcName, {
      p_id: rowId,
      p_message_id: mid,
    })
    if (!rpcErr) return
  }

  const { error } = await supabase
    .from(tableName)
    .update({ discord_message_id: mid })
    .eq('id', rowId)

  if (error && isMissingColumnError(error, 'discord_message_id')) {
    console.warn(`Kolom discord_message_id belum ada di ${tableName}`)
  }
}

export async function fetchDiscordMessageId(
  tableName: string,
  rowId: string | number,
): Promise<string | null> {
  const { data, error } = await supabase
    .from(tableName)
    .select('discord_message_id')
    .eq('id', rowId)
    .maybeSingle()

  if (error) {
    if (isMissingColumnError(error, 'discord_message_id')) return null
    return null
  }
  return normalizeDiscordMessageId(
    (data as { discord_message_id?: string } | null)?.discord_message_id,
  ) || null
}

export async function saveDiscordMessageIdOnMemberOrders(
  memberId: number,
  orderanke: number,
  messageId: string,
): Promise<void> {
  const mid = normalizeDiscordMessageId(messageId)
  if (!mid || !memberId || !orderanke) return
  const { error } = await supabase
    .from('orders')
    .update({ discord_message_id: mid })
    .eq('member_id', memberId)
    .eq('orderanke', orderanke)
    .is('deleted_at', null)

  if (error && isMissingColumnError(error, 'discord_message_id')) {
    console.warn('Kolom discord_message_id belum ada di orders')
  }
}

/** Fetch active member orders for a periode and post Discord summary. */
export async function sendMemberOrdersDiscord(
  memberId: number,
  nama: string,
  orderanke: number,
  scrapByItem?: Record<string, number>,
): Promise<string | null> {
  let includeDelivered = true
  let filterActiveOnly = true
  let items: Record<string, unknown>[] | null = null
  let qError: { message?: string } | null = null

  for (let i = 0; i < 3; i += 1) {
    const fields = includeDelivered
      ? 'id,order_id,order_no,nama,orderanke,waktu,kategori,item,harga,qty,subtotal,delivered'
      : 'id,order_id,order_no,nama,orderanke,waktu,kategori,item,harga,qty,subtotal'
    let q = supabase
      .from('orders')
      .select(fields)
      .eq('member_id', memberId)
      .eq('orderanke', orderanke)
      .order('waktu', { ascending: false })
      .limit(200)
    if (filterActiveOnly) q = q.is('deleted_at', null)
    const res = await q
    items = (res.data as Record<string, unknown>[] | null) || null
    qError = res.error
    if (!qError) break
    if (isMissingColumnError(qError, 'deleted_at')) {
      filterActiveOnly = false
      continue
    }
    if (String(qError.message || '').includes('delivered')) {
      includeDelivered = false
      continue
    }
    break
  }

  if (qError || !items?.length) return null

  const { buildOrderDiscordMessage } = await import('./discordMessages')
  const mapped = items.map((r) => {
    const item = String(r.item || '')
    return {
      order_id: r.order_id ? String(r.order_id) : null,
      item,
      harga: Number(r.harga) || 0,
      qty: Number(r.qty) || 0,
      subtotal: Number(r.subtotal) || 0,
      scrap: scrapByItem?.[item] ?? 0,
    }
  })
  const msg = buildOrderDiscordMessage(mapped, nama, orderanke)
  const messageId = await postDiscord({ channel: 'orders', content: msg })
  if (messageId) {
    await saveDiscordMessageIdOnMemberOrders(memberId, orderanke, messageId)
  }
  return messageId
}

export async function deleteDiscordForTableRow(
  channel: DiscordChannel,
  tableName: string,
  rowId: string | number,
): Promise<void> {
  const mid = await fetchDiscordMessageId(tableName, rowId)
  if (mid) await deleteDiscordMessage(channel, mid)
}
