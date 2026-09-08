# Deploy RAGE IMS (Vite React) — Shared Hosting Apache

Target: Cloud Hosting NextGen (or similar Apache + PHP shared hosting). This app is a **static SPA**; Node is only needed on your PC to build.

## Prerequisites

- Node.js 20+ on your machine
- Supabase project (same as app lama)
- File Manager / FTP access to public web root (often `public_html`)

## 1. Environment at build time

Create `.env` in the project root (**local only — do not upload / commit**):

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Use the **anon** key only. Never put `SERVICE_ROLE_KEY`, Discord webhooks, or admin PIN in frontend env.

Vite bakes these into the JS bundle during `npm run build`. Changing env later requires a **rebuild + re-upload**.

## 2. Build

```bash
npm install
npm run build
```

Output folder: `dist/`

Confirm `dist/index.html`, `dist/assets/…`, and `dist/.htaccess` exist.

## 3. Upload

Upload **contents** of `dist/` into the site document root (e.g. `public_html/`):

- `index.html`
- `.htaccess` (SPA fallback — required for `/order`, `/kas`, etc.)
- `assets/` folder

Do **not** upload:

- `.env`
- `node_modules/`
- `src/`
- repo root files

## 4. Apache rewrite

`public/.htaccess` is copied into `dist/` by Vite. It rewrites unknown paths to `index.html`.

If routes 404 after refresh:

1. Confirm `.htaccess` is in the same folder as `index.html`
2. Confirm host allows `mod_rewrite` / `.htaccess` overrides
3. If the app lives in a subdirectory (e.g. `/rage/`), set `RewriteBase /rage/` in `.htaccess` and rebuild with matching Vite `base` (ask if needed)

## 5. App settings (one-time SQL)

Site settings (maintenance, delete PIN, notice) live in Supabase table `app_settings`.

1. Open Supabase → SQL Editor
2. Run the contents of `supabase/app_settings.sql`
3. Run the contents of `supabase/catalog_sell_price.sql` (harga base + harga jual di Catalog)
3. Confirm table `app_settings` has 4 seed rows
4. Login as **admin** → Admin → Settings → set PIN hapus (min 6 chars) and toggle maintenance as needed

PIN is checked in the browser (same model as app lama `ADMIN_DELETE_PIN`). Do not treat it as a server secret.

## 6. Discord notify (Edge Function)

Webhook URLs **must not** go in frontend `.env`. They live as Supabase Edge Function secrets.

### 6.1 Deploy function

From the project root (requires [Supabase CLI](https://supabase.com/docs/guides/cli) linked to the same project as the app lama):

```bash
supabase functions deploy discord-notify
supabase functions deploy admin-sync-user
supabase functions deploy admin-delete-user
supabase functions deploy admin-create-user
```

Sources:
- `supabase/functions/discord-notify/index.ts`
- `supabase/functions/admin-sync-user/index.ts`
- `supabase/functions/admin-delete-user/index.ts`
- `supabase/functions/admin-create-user/index.ts`

JWT verification stays **on** (default) so only logged-in clients can invoke them.

### 6.2 Set secrets

Supabase Dashboard → Edge Functions → Secrets, or CLI:

```bash
supabase secrets set DISCORD_ENABLED=true
supabase secrets set DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
supabase secrets set DISCORD_ORDER_PAYMENT_WEBHOOK_URL="..."
supabase secrets set DISCORD_STORAN_WEBHOOK_URL="..."
supabase secrets set DISCORD_ABSEN_WEBHOOK_URL="..."
supabase secrets set DISCORD_NITIP_CUCI_WEBHOOK_URL="..."
supabase secrets set DISCORD_DRUGS_WEBHOOK_URL="..."
supabase secrets set DISCORD_RAGE_CASH_WEBHOOK_URL="..."
```

Copy values from app lama `config.js` (do not commit them).

| Channel (client) | Secret |
|------------------|--------|
| orders / order_window / dashboard | `DISCORD_WEBHOOK_URL` |
| order_payment | `DISCORD_ORDER_PAYMENT_WEBHOOK_URL` (fallback default) |
| storan | `DISCORD_STORAN_WEBHOOK_URL` (fallback default) |
| absen | `DISCORD_ABSEN_WEBHOOK_URL` (no fallback) |
| nitip_cuci | `DISCORD_NITIP_CUCI_WEBHOOK_URL` → storan → default |
| drugs | `DISCORD_DRUGS_WEBHOOK_URL` (fallback default) |
| rage_cash | `DISCORD_RAGE_CASH_WEBHOOK_URL` (no fallback) |

Set `DISCORD_ENABLED=false` to soft-disable all Discord posts without undeploying.

### 6.3 Discord smoke test

1. Login → submit Order / Storan / Absen / Drugs / Kas / Nitip → message appears in the matching Discord channel
2. Soft-delete a row → Discord message deleted (when `discord_message_id` column exists)
3. Admin → Periode Order → open window (`orderanke < 1000`) → `@here` announce; **Announce buka** button works
4. Rekap → **Share qty** / **Share bayar**; Storan → **Announce rekap**; Drugs → **Kirim total**
5. Built JS bundle must **not** contain webhook URL strings

## 7. Smoke test after deploy

1. Open the site URL → login works
2. Refresh on `/rekap` or `/kas` → still loads (not Apache 404)
3. Storan / Absen / Kas / Drugs create → rows appear in Supabase tables
4. Admin Settings → save PIN / maintenance → non-admin sees maintenance screen when enabled
5. Hapus data → dialog minta PIN
6. Discord flows above (section 6.3)

## Checklist

- [ ] `.env` filled locally, not committed
- [ ] `supabase/app_settings.sql` executed once
- [ ] `supabase/catalog_sell_price.sql` executed once
- [ ] `discord-notify`, `admin-sync-user`, `admin-delete-user`, and `admin-create-user` deployed
- [ ] `npm run build` succeeded
- [ ] Uploaded `dist/` contents including `.htaccess`
- [ ] Hard refresh browser after upload
- [ ] Admin PIN set in Settings
- [ ] Discord smoke test passed