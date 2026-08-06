import { fmtAbsenDateTime, fmtAbsenDuration, fmtLocalDateTime } from './dates'
import { fmtIdMoney, fmtUsd, formatWindowDateTime } from './format'
import { formatOrderankeLabel } from './orderWindow'

/** Discord money — mirror old `fmt` (USD-style). */
export function fmtDiscordMoney(n: number): string {
  return fmtUsd(Number(n) || 0)
}

export function fmtDiscordNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(Number(n) || 0)
}

export type OrderDiscordItem = {
  order_id?: string | null
  item: string
  harga: number
  qty: number
  subtotal: number
  scrap?: number | null
}

export function buildOrderDiscordMessage(
  items: OrderDiscordItem[],
  nama: string,
  orderanke: number,
): string {
  const orderIds = Array.from(new Set(items.map((r) => r.order_id))).filter(
    Boolean,
  )
  const count = orderIds.length
  const total = items.reduce((a, r) => a + (r.subtotal || 0), 0)
  let totalScrap = 0
  items.forEach((r) => {
    totalScrap += (Number(r.scrap) || 0) * (r.qty || 0)
  })
  const m = Math.floor(orderanke / 10)
  const w = orderanke % 10
  const grouped: Record<string, OrderDiscordItem> = {}
  items.forEach((r) => {
    const key = r.item
    if (!grouped[key]) grouped[key] = { ...r, qty: 0 }
    grouped[key].qty += r.qty
  })
  const maxLen = Math.max(
    ...Object.values(grouped).map((r) => String(r.item || '').length),
    1,
  )
  const details = Object.values(grouped)
    .sort((a, b) => String(a.item).localeCompare(String(b.item)))
    .map(
      (r) =>
        `• ${String(r.qty).padStart(2)}x ${String(r.item).padEnd(maxLen)} : ${fmtDiscordMoney(
          (r.harga || 0) * (r.qty || 0),
        )}`,
    )
    .join('\n')
  return (
    '```\n' +
    `Periode: M${m}-W${w} (#${orderanke})\n` +
    `Nama  : ${nama}\n` +
    `Order : ${count}\n` +
    `Total : ${fmtDiscordMoney(total)}\n` +
    (totalScrap > 0 ? `Total Scrap : ${totalScrap}\n` : '') +
    `\n` +
    `Detail Orderan :\n` +
    details +
    '```'
  )
}

export function buildStoranDiscordMessage(opts: {
  periodeLabel: string
  nama: string
  penerima: string
  statusLabel: string
  status: string
  waktu: string
}): string {
  let msg = '```'
  msg += `\nSTORAN MINGGUAN`
  if (opts.periodeLabel) msg += `\nPeriode : ${opts.periodeLabel}`
  msg += `\nNama    : ${opts.nama}`
  if (opts.penerima) msg += `\nPenerima: ${opts.penerima}`
  msg += `\nStatus  : ${opts.statusLabel}`
  if (String(opts.status).toUpperCase() === 'SUDAH') {
    msg += `\nItem    : 100 MS, 100 Empty Bottle, 100 Empty Can`
  }
  msg += `\nWaktu   : ${opts.waktu}`
  msg += '\n```'
  return msg
}

export function buildStoranPeriodStatusMessage(status: {
  label: string
  done: string[]
  pending: string[]
}): string {
  const total = status.done.length + status.pending.length
  const list = (names: string[], max = 40) => {
    if (!names.length) return '• (kosong)'
    const lines = names.slice(0, max).map((n) => `• ${n}`)
    if (names.length > max) {
      lines.push(`• ... dan ${names.length - max} lainnya`)
    }
    return lines.join('\n')
  }
  let msg = '```\n'
  msg += 'STORAN MINGGUAN — REKAP\n'
  msg += `Periode : ${status.label}\n`
  msg += `SUDAH   : ${status.done.length}/${total}\n`
  msg += `BELUM   : ${status.pending.length}/${total}\n`
  msg += `\nSUDAH (${status.done.length})\n`
  msg += `${list(status.done)}\n`
  msg += `\nBELUM (${status.pending.length})\n`
  msg += `${list(status.pending)}\n`
  msg += '```'
  return msg
}

export function buildAbsenKotaDiscordEmbeds(row: {
  nama: string
  tanggal: string
  catatan?: string | null
  dicatat_oleh?: string | null
  jam_masuk_kota?: string | null
  jam_keluar_kota?: string | null
  bukti_masuk_url?: string | null
  bukti_keluar_url?: string | null
}): { content: null; embeds: Record<string, unknown>[] } {
  const nama = row.nama || '-'
  const tanggal = row.tanggal ? String(row.tanggal).slice(0, 10) : '-'
  const catatan = String(row.catatan || '').trim()
  const actor = String(row.dicatat_oleh || '').trim()

  const fmtTanggalReadable = (tgl: string) => {
    try {
      const d = new Date(`${tgl}T12:00:00`)
      const bulan = [
        'Januari',
        'Februari',
        'Maret',
        'April',
        'Mei',
        'Juni',
        'Juli',
        'Agustus',
        'September',
        'Oktober',
        'November',
        'Desember',
      ]
      return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`
    } catch {
      return tgl
    }
  }

  const tanggalReadable = fmtTanggalReadable(tanggal)
  const hasMasuk = !!row.jam_masuk_kota
  const hasKeluar = !!row.jam_keluar_kota

  let statusText: string
  let statusEmoji: string
  if (hasKeluar) {
    statusText = 'Sudah Keluar Kota'
    statusEmoji = '🔴'
  } else if (hasMasuk) {
    statusText = 'Sedang Di Kota'
    statusEmoji = '🟢'
  } else {
    statusText = 'Belum Masuk'
    statusEmoji = '⚪'
  }

  const fields: Record<string, unknown>[] = [
    { name: '📅 Tanggal', value: `\`${tanggalReadable}\``, inline: true },
    {
      name: `${statusEmoji} Status`,
      value: `**${statusText}**`,
      inline: true,
    },
    { name: '\u200b', value: '\u200b', inline: true },
  ]

  if (hasMasuk) {
    fields.push({
      name: '🟢 Jam Masuk',
      value: `\`${fmtAbsenDateTime(row.jam_masuk_kota, { hideToday: false })}\``,
      inline: true,
    })
  }

  if (hasKeluar) {
    fields.push({
      name: '🔴 Jam Keluar',
      value: `\`${fmtAbsenDateTime(row.jam_keluar_kota, { hideToday: false })}\``,
      inline: true,
    })
    const dur = fmtAbsenDuration(row.jam_masuk_kota, row.jam_keluar_kota)
    if (dur !== '—') {
      fields.push({ name: '⏱️ Durasi', value: `\`${dur}\``, inline: true })
    }
  }

  if (catatan) {
    fields.push({ name: '📝 Catatan', value: catatan, inline: false })
  }

  let embedColor = 0x6b7280
  if (hasKeluar) embedColor = 0xf97316
  else if (hasMasuk) embedColor = 0x22c55e

  const embed: Record<string, unknown> = {
    color: embedColor,
    author: { name: `📍 Absen Kota — ${nama}` },
    fields,
    footer: {
      text: actor ? `Dicatat oleh ${actor}` : 'R.A.G.E Absen System',
    },
    timestamp: new Date().toISOString(),
  }

  if (hasMasuk && row.bukti_masuk_url && !hasKeluar) {
    embed.image = { url: String(row.bukti_masuk_url) }
  } else if (hasKeluar && row.bukti_keluar_url) {
    embed.image = { url: String(row.bukti_keluar_url) }
    if (row.bukti_masuk_url) {
      embed.thumbnail = { url: String(row.bukti_masuk_url) }
    }
  } else if (hasMasuk && row.bukti_masuk_url) {
    embed.image = { url: String(row.bukti_masuk_url) }
  }

  return { content: null, embeds: [embed] }
}

export function buildDrugsEntryEmbed(payload: {
  mode?: 'insert' | 'edit' | 'update'
  nama: string
  jenis: string
  jumlahTotal: number
  duitMerahTotal: number
  upahPutihTotal: number
  periode_orderanke: number
  waktu?: string
}): Record<string, unknown> {
  const periodeLabel = formatOrderankeLabel(payload.periode_orderanke)
  let modeColor = 0xfbbf24
  let modeText = 'INPUT BARU'
  if (payload.mode === 'edit') {
    modeColor = 0x3b82f6
    modeText = 'UPDATE DATA'
  } else if (payload.mode === 'update') {
    modeColor = 0x8b5cf6
    modeText = 'TAMBAH TOTAL'
  }

  const desc = `\`Nama   :\` **${payload.nama || '-'}**
\`Jenis  :\` **${payload.jenis || '-'}**
\`Jumlah :\` **${fmtDiscordNumber(payload.jumlahTotal)} items**`

  return {
    author: { name: `Laporan Penjualan Drugs  —  ${modeText}` },
    color: modeColor,
    description: desc,
    fields: [
      {
        name: '🔴  Duit Merah',
        value: `\`\`\`diff\n- ${fmtDiscordMoney(payload.duitMerahTotal || 0)}\n\`\`\``,
        inline: false,
      },
      {
        name: '🟢  Gaji Putih',
        value: `\`\`\`diff\n+ ${fmtDiscordMoney(payload.upahPutihTotal || 0)}\n\`\`\``,
        inline: false,
      },
    ],
    footer: { text: `Periode: ${periodeLabel}` },
    timestamp: payload.waktu || new Date().toISOString(),
  }
}

export function buildDrugsTotalsEmbed(opts: {
  orderanke: number
  rows: { nama: string; upah_putih: number }[]
}): Record<string, unknown> {
  const m = Math.floor((opts.orderanke % 1000) / 10)
  const w = (opts.orderanke % 1000) % 10
  let desc = 'Berikut adalah total gaji karyawan untuk batch ini:\n'
  desc += '```yaml\n'
  desc += 'NAMA               GAJI PUTIH \n'
  desc += '------------------------------\n'
  opts.rows
    .slice()
    .sort((a, b) => String(a.nama).localeCompare(String(b.nama)))
    .forEach((r) => {
      const n = String(r.nama).padEnd(16, ' ')
      const g = String(fmtDiscordMoney(r.upah_putih)).padStart(12, ' ')
      desc += `${n} : ${g}\n`
    })
  desc += '```'
  return {
    author: { name: `R.A.G.E DRUGS PAYROLL  —  M${m}-W${w}` },
    color: 0x10b981,
    description: desc,
    footer: { text: `ID Periode: #${opts.orderanke}` },
    timestamp: new Date().toISOString(),
  }
}

export function buildRageCashEmbed(payload: {
  type: 'IN' | 'OUT'
  amount: number
  category: string
  note?: string
  waktu?: string
  actor?: string
  balance?: number | null
}): Record<string, unknown> {
  const isIn = payload.type === 'IN'
  const typeLabel = isIn ? 'PEMASUKAN' : 'PENGELUARAN'
  const tsIso = payload.waktu || new Date().toISOString()
  const amount = Number(payload.amount) || 0
  const sign = isIn ? '+' : '-'
  const color = isIn ? 0x57f287 : 0xed4245
  const when = fmtLocalDateTime(tsIso)
  const category = payload.category || '-'
  const note = payload.note ? String(payload.note).trim() : ''
  const amountText = `${sign}${fmtDiscordMoney(amount)}`
  const dot = isIn ? '🟢' : '🔴'
  const actor = payload.actor ? String(payload.actor) : ''
  const balanceField =
    payload.balance == null
      ? null
      : {
          name: 'SALDO TOTAL',
          value: `\`${fmtDiscordMoney(payload.balance)}\``,
          inline: false,
        }

  return {
    title: `${dot}  ${typeLabel}`,
    color,
    description:
      '```' +
      `\nNOMINAL  : ${amountText}` +
      `\nKATEGORI : ${category}` +
      (note ? `\nCATATAN  : ${note}` : '') +
      (actor ? `\nOLEH    : ${actor}` : '') +
      `\nWAKTU    : ${when}` +
      '\n```',
    ...(balanceField ? { fields: [balanceField] } : {}),
    timestamp: tsIso,
  }
}

export function buildNitipCuciDiscordPayload(opts: {
  nama: string
  uangMerah: number
  uangPutih: number
  keterangan: string
  periodeLabel?: string
  waktu?: string
  actor?: string
  imageUrl?: string | null
  isPaid?: boolean | null
}): { content: string; embeds: Record<string, unknown>[] } {
  const ts = opts.waktu || new Date().toISOString()
  const actorName = String(opts.actor || '').trim()
  const memberName = String(opts.nama || '-').trim()
  const lines = [
    'NITIP CUCI UANG MERAH',
    '',
    `Nama       : ${memberName}`,
    `Merah      : ${fmtIdMoney(opts.uangMerah)}`,
    `Putih      : ${fmtIdMoney(opts.uangPutih)}`,
    `Keterangan : ${opts.keterangan || 'Nitip cuci'}`,
  ]
  if (opts.periodeLabel) lines.push(`Periode    : ${opts.periodeLabel}`)
  if (actorName && actorName.toLowerCase() !== memberName.toLowerCase()) {
    lines.push(`Dicatat    : ${actorName}`)
  }
  lines.push(`Waktu      : ${fmtLocalDateTime(ts)}`)

  const paid = opts.isPaid === true
  const unpaid = opts.isPaid === false
  const embed: Record<string, unknown> = {
    color: paid ? 0x22c55e : 0xf59e0b,
  }
  if (paid) embed.footer = { text: '✅ SUDAH DIKASIH uang putih' }
  else if (unpaid) embed.footer = { text: '⏳ BELUM DIKASIH' }
  if (opts.imageUrl) embed.image = { url: String(opts.imageUrl) }

  return {
    content: '```\n' + lines.join('\n') + '\n```',
    embeds: [embed],
  }
}

export function buildOrderWindowAnnounceMessage(opts: {
  orderanke: number | null
  startTime: string
  endTime: string
  kind: 'open' | 'close'
}): string {
  const v = opts.orderanke
  let label = 'Periode'
  let typeStr = 'Orderan'
  if (v) {
    const isDrugs = v >= 1000
    const val = isDrugs ? v - 1000 : v
    label = `M${Math.floor(val / 10)}-W${val % 10}`
    if (isDrugs) typeStr = 'Drugs'
  }
  const start = formatWindowDateTime(opts.startTime)
  const end = formatWindowDateTime(opts.endTime)
  if (opts.kind === 'open') {
    return `# ${typeStr} periode ${label} dibuka dari ${start} sampai ${end}\n@here`
  }
  return `# ${typeStr} periode ${label} telah ditutup.\nDibuka dari ${start} sampai ${end}\nDi tunggu open order selanjutnya yaa \n@here`
}

export function buildPaymentStatusShareMessage(opts: {
  periodText: string
  nameFilter?: string
  paid: { name: string; batch: number; qty: number; total: number }[]
  unpaid: { name: string; batch: number; qty: number; total: number }[]
}): string {
  const fmtBatch = (batch: number) => {
    if (!batch) return '-'
    const raw = batch
    const m = Math.floor(raw / 10)
    const w = raw % 10
    return `M${m}-W${w} (#${raw})`
  }
  const batchLabels = Array.from(
    new Set(
      [...opts.paid, ...opts.unpaid].map((x) => fmtBatch(x.batch)),
    ),
  )
  const singleBatchLabel = batchLabels.length === 1 ? batchLabels[0] : ''

  const makeSection = (
    title: string,
    rows: { name: string; batch: number; qty: number; total: number }[],
  ) => {
    const totalQty = rows.reduce((sum, r) => sum + (r.qty || 0), 0)
    const totalMoney = rows.reduce((sum, r) => sum + (r.total || 0), 0)
    if (!rows.length) {
      return [
        `### ${title}`,
        `> Orang: 0 • Item: 0 • Total: ${fmtDiscordMoney(0)}`,
        '',
        '_Tidak ada data_',
      ].join('\n')
    }
    const entriesText = rows.map((r) => {
      const periodText = singleBatchLabel ? '' : ` • ${fmtBatch(r.batch)}`
      return {
        label: `${r.name}${periodText}`,
        total: fmtDiscordMoney(r.total),
      }
    })
    const maxLabel = entriesText.reduce(
      (max, r) => Math.max(max, r.label.length),
      4,
    )
    const maxTotal = entriesText.reduce(
      (max, r) => Math.max(max, r.total.length),
      5,
    )
    const allNames = [
      '```yaml',
      ...entriesText.map(
        (r) => `${r.label.padEnd(maxLabel)} : ${r.total.padStart(maxTotal)}`,
      ),
      '```',
    ].join('\n')
    return [
      `### ${title}`,
      `> Orang: ${rows.length} • Item: ${fmtDiscordNumber(totalQty)} • Total: ${fmtDiscordMoney(totalMoney)}`,
      '',
      allNames,
    ].join('\n')
  }

  return [
    '## Status Pembayaran Order Senjata',
    `> 🗓️ Periode: ${opts.periodText}`,
    opts.nameFilter ? `> 👤 Nama: ${opts.nameFilter}` : '',
    '',
    makeSection('✅ Sudah Bayar', opts.paid),
    '',
    makeSection('❌ Belum Bayar', opts.unpaid),
  ]
    .filter(Boolean)
    .join('\n')
}

export function buildDashboardShareMessage(lines: string[]): string {
  return '```\n' + lines.join('\n') + '\n```'
}
