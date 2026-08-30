import { parseWeeklyProfitViewerIds } from './weeklyProfitAccess'
import { supabase } from './supabase'

export const DEFAULT_GUN_ATTACHMENT_MARKUP_PCT = 10

export const APP_SETTING_KEYS = [
  'maintenance_mode',
  'maintenance_message',
  'admin_delete_pin',
  'site_notice',
  'weekly_profit_viewers',
  'gun_attachment_markup_pct',
] as const

export type AppSettingKey = (typeof APP_SETTING_KEYS)[number]

export type AppSettings = {
  maintenanceMode: boolean
  maintenanceMessage: string
  adminDeletePin: string
  siteNotice: string
  weeklyProfitViewerIds: number[]
  gunAttachmentMarkupPct: number
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  maintenanceMode: false,
  maintenanceMessage: 'Sedang maintenance: Sebentar yaa kawan',
  adminDeletePin: '',
  siteNotice: '',
  weeklyProfitViewerIds: [],
  gunAttachmentMarkupPct: DEFAULT_GUN_ATTACHMENT_MARKUP_PCT,
}

type SettingRow = {
  key: string
  value: unknown
}

function unwrapJson(value: unknown): unknown {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as unknown
    } catch {
      return value
    }
  }
  return value
}

function asBool(value: unknown, fallback: boolean): boolean {
  const v = unwrapJson(value)
  if (typeof v === 'boolean') return v
  if (v === 'true' || v === 1) return true
  if (v === 'false' || v === 0) return false
  return fallback
}

function asString(value: unknown, fallback: string): string {
  const v = unwrapJson(value)
  if (typeof v === 'string') return v
  if (v == null) return fallback
  return String(v)
}

export function normalizeGunAttachmentMarkupPct(value: unknown): number {
  const v = unwrapJson(value)
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return DEFAULT_GUN_ATTACHMENT_MARKUP_PCT
  return Math.min(100, Math.max(0, Math.round(n)))
}

export function validateGunAttachmentMarkupPct(
  value: number,
): { ok: true; value: number } | { ok: false; error: string } {
  if (!Number.isFinite(value)) {
    return { ok: false, error: 'Markup harus angka valid' }
  }
  const rounded = Math.round(value)
  if (rounded < 0 || rounded > 100) {
    return { ok: false, error: 'Markup harus antara 0–100%' }
  }
  return { ok: true, value: rounded }
}

export function rowsToAppSettings(rows: SettingRow[]): AppSettings {
  const map = new Map(rows.map((r) => [r.key, r.value]))
  return {
    maintenanceMode: asBool(
      map.get('maintenance_mode'),
      DEFAULT_APP_SETTINGS.maintenanceMode,
    ),
    maintenanceMessage: asString(
      map.get('maintenance_message'),
      DEFAULT_APP_SETTINGS.maintenanceMessage,
    ),
    adminDeletePin: asString(
      map.get('admin_delete_pin'),
      DEFAULT_APP_SETTINGS.adminDeletePin,
    ),
    siteNotice: asString(
      map.get('site_notice'),
      DEFAULT_APP_SETTINGS.siteNotice,
    ),
    weeklyProfitViewerIds: parseWeeklyProfitViewerIds(
      map.get('weekly_profit_viewers'),
    ),
    gunAttachmentMarkupPct: normalizeGunAttachmentMarkupPct(
      map.get('gun_attachment_markup_pct'),
    ),
  }
}

export function validateAdminDeletePin(pin: string): {
  ok: boolean
  message: string
} {
  const s = String(pin || '').trim()
  if (!s) {
    return {
      ok: false,
      message: 'PIN hapus belum diatur. Atur di Admin → Settings.',
    }
  }
  if (s.length < 6) {
    return { ok: false, message: 'PIN hapus minimal 6 karakter' }
  }
  return { ok: true, message: '' }
}

export function matchAdminDeletePin(
  typed: string,
  stored: string,
): { ok: boolean; message: string } {
  const check = validateAdminDeletePin(stored)
  if (!check.ok) return check
  if (String(typed || '') !== String(stored || '')) {
    return { ok: false, message: 'PIN salah' }
  }
  return { ok: true, message: '' }
}

export async function fetchAppSettings(): Promise<{
  data: AppSettings
  error: string | null
}> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', [...APP_SETTING_KEYS])

  if (error) {
    const missing =
      /schema cache|does not exist|Could not find the table/i.test(
        error.message || '',
      )
    return {
      data: { ...DEFAULT_APP_SETTINGS },
      error: missing
        ? 'Tabel app_settings belum ada. Jalankan supabase/app_settings.sql di Supabase SQL Editor.'
        : error.message || 'Gagal memuat settings',
    }
  }

  return {
    data: rowsToAppSettings((data || []) as SettingRow[]),
    error: null,
  }
}

export async function upsertAppSetting(
  key: AppSettingKey,
  value: boolean | string | number | number[],
  updatedBy: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (key === 'gun_attachment_markup_pct') {
    const check = validateGunAttachmentMarkupPct(Number(value))
    if (!check.ok) return { ok: false, error: check.error }
  }

  if (key === 'admin_delete_pin') {
    const pin = String(value).trim()
    if (pin) {
      const check = validateAdminDeletePin(pin)
      if (!check.ok) return { ok: false, error: check.message }
    }
  }

  const payload = {
    key,
    value,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  }

  const { error } = await supabase.from('app_settings').upsert(payload, {
    onConflict: 'key',
  })

  if (error) {
    return { ok: false, error: error.message || 'Gagal menyimpan setting' }
  }
  return { ok: true }
}

export async function saveAppSettingsPatch(
  patch: Partial<{
    maintenanceMode: boolean
    maintenanceMessage: string
    adminDeletePin: string
    siteNotice: string
    weeklyProfitViewerIds: number[]
    gunAttachmentMarkupPct: number
  }>,
  updatedBy: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const entries: Array<[AppSettingKey, boolean | string | number | number[]]> =
    []

  if (patch.maintenanceMode !== undefined) {
    entries.push(['maintenance_mode', patch.maintenanceMode])
  }
  if (patch.maintenanceMessage !== undefined) {
    entries.push(['maintenance_message', patch.maintenanceMessage])
  }
  if (patch.adminDeletePin !== undefined) {
    entries.push(['admin_delete_pin', patch.adminDeletePin.trim()])
  }
  if (patch.siteNotice !== undefined) {
    entries.push(['site_notice', patch.siteNotice])
  }
  if (patch.weeklyProfitViewerIds !== undefined) {
    entries.push(['weekly_profit_viewers', patch.weeklyProfitViewerIds])
  }
  if (patch.gunAttachmentMarkupPct !== undefined) {
    const check = validateGunAttachmentMarkupPct(patch.gunAttachmentMarkupPct)
    if (!check.ok) return { ok: false, error: check.error }
    entries.push(['gun_attachment_markup_pct', check.value])
  }

  for (const [key, value] of entries) {
    const res = await upsertAppSetting(key, value, updatedBy)
    if (!res.ok) return res
  }

  return { ok: true }
}
