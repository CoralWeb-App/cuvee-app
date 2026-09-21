import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const APNS_HOST = { production: 'https://api.push.apple.com', sandbox: 'https://api.sandbox.push.apple.com' } as const
type Env = keyof typeof APNS_HOST
const CONCURRENCY = 25
const MAX_TITLE = 80
const MAX_BODY = 240

// deno-lint-ignore no-explicit-any
type Db = any
interface TokenRow { token: string; user_id: string; environment: Env | null }

const b64u = (buf: ArrayBuffer | Uint8Array) => {
  let s = ''
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b)
  return btoa(s).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}
const text = (s: string) => new TextEncoder().encode(s)

// Il .p8 incollato nei secret può perdere gli a capo o averli come "\n" letterali: si tiene solo il corpo base64.
function pemToDer(pem: string): ArrayBuffer {
  const body = pem.replace(/\\n/g, '').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0)).buffer as ArrayBuffer
}

// JWT del provider (ES256). Apple chiede di non rigenerarlo più di una volta ogni 20 minuti e di non
// usarlo oltre 60: si riusa per 40 minuti.
let cachedJwt: { token: string; at: number; id: string } | null = null
export async function makeProviderToken(pem: string, keyId: string, teamId: string, now = Date.now()): Promise<string> {
  const id = `${keyId}|${teamId}|${pem}`
  if (cachedJwt && cachedJwt.id === id && now - cachedJwt.at < 40 * 60_000) return cachedJwt.token
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(pem), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const head = b64u(text(JSON.stringify({ alg: 'ES256', kid: keyId })))
  const claims = b64u(text(JSON.stringify({ iss: teamId, iat: Math.floor(now / 1000) })))
  // WebCrypto restituisce la firma già nel formato r||s richiesto da JWS
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, text(`${head}.${claims}`))
  const token = `${head}.${claims}.${b64u(sig)}`
  cachedJwt = { token, at: now, id }
  return token
}

interface PushResult { status: number; reason?: string }

async function sendOne(jwt: string, topic: string, env: Env, token: string, payload: string): Promise<PushResult> {
  const r = await fetch(`${APNS_HOST[env]}/3/device/${token}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${jwt}`,
      'apns-topic': topic,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    },
    body: payload,
  })
  if (r.status === 200) return { status: 200 }
  let reason: string | undefined
  try { reason = (await r.json())?.reason } catch (_) { /* corpo vuoto */ }
  return { status: r.status, reason }
}

// I token generati dalle build di sviluppo (Xcode) valgono solo sul server sandbox, quelli di TestFlight/App
// Store solo su quello di produzione, e dal telefono non si distinguono: si prova prima l'ambiente noto
// (o produzione) e in caso di token rifiutato l'altro, memorizzando quello che funziona.
async function deliver(db: Db, jwt: string, topic: string, row: TokenRow, payload: string) {
  const first: Env = row.environment ?? 'production'
  const second: Env = first === 'production' ? 'sandbox' : 'production'
  let res = await sendOne(jwt, topic, first, row.token, payload)
  let used = first
  if (res.status === 400 && res.reason === 'BadDeviceToken') {
    const alt = await sendOne(jwt, topic, second, row.token, payload)
    if (alt.status === 200 || alt.status !== 400) { res = alt; used = second }
  }
  if (res.status === 200) {
    if (row.environment !== used) await db.from('push_tokens').update({ environment: used }).eq('token', row.token)
    return { ok: true as const }
  }
  const dead = res.status === 410 || (res.status === 400 && (res.reason === 'BadDeviceToken' || res.reason === 'DeviceTokenNotForTopic')) || res.reason === 'Unregistered'
  if (dead) await db.from('push_tokens').delete().eq('token', row.token)
  return { ok: false as const, removed: dead, status: res.status, reason: res.reason }
}

async function loadTokens(db: Db, audience: string, callerId: string): Promise<TokenRow[]> {
  const rows: TokenRow[] = []
  for (let from = 0; ; from += 1000) {
    let q = db.from('push_tokens').select('token, user_id, environment').order('created_at', { ascending: true }).range(from, from + 999)
    if (audience === 'test') q = q.eq('user_id', callerId)
    const { data, error } = await q
    if (error) throw new Error('Lettura dispositivi: ' + error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  if (audience === 'all' || audience === 'test') return rows

  const nowIso = new Date().toISOString()
  const ids = new Set<string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('users').select('id').eq('is_premium', true)
      .or(`premium_until.is.null,premium_until.gt.${nowIso}`).range(from, from + 999)
    if (error) throw new Error('Lettura utenti: ' + error.message)
    for (const u of data ?? []) ids.add(u.id)
    if (!data || data.length < 1000) break
  }
  return rows.filter((r) => (audience === 'premium') === ids.has(r.user_id))
}

export function buildPayload(title: string, body: string, notificationId?: string): string {
  return JSON.stringify({ aps: { alert: { title, body }, sound: 'default' }, ...(notificationId ? { notification_id: notificationId } : {}) })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Non autorizzato' }, 401)
    const SUPA_URL = Deno.env.get('SUPABASE_URL')!
    const db = createClient(SUPA_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const userSupa = createClient(SUPA_URL, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authErr } = await userSupa.auth.getUser()
    if (authErr || !user) return json({ error: 'Non autorizzato' }, 401)
    const { data: caller } = await db.from('users').select('is_admin').eq('id', user.id).maybeSingle()
    if (!caller?.is_admin) return json({ error: 'Solo gli admin possono inviare notifiche' }, 403)

    let body: Record<string, unknown> = {}
    try { body = (await req.json()) ?? {} } catch (_) { return json({ error: 'Richiesta non valida' }, 400) }
    const title = String(body.title ?? '').trim()
    const message = String(body.body ?? '').trim()
    const audience = String(body.audience ?? 'all')
    const notificationId = typeof body.notification_id === 'string' ? body.notification_id : undefined
    if (!title || !message) return json({ error: 'Titolo e messaggio sono obbligatori' }, 400)
    if (title.length > MAX_TITLE) return json({ error: `Titolo troppo lungo (max ${MAX_TITLE} caratteri)` }, 400)
    if (message.length > MAX_BODY) return json({ error: `Messaggio troppo lungo per una push (max ${MAX_BODY} caratteri)` }, 400)
    if (!['all', 'premium', 'free', 'test'].includes(audience)) return json({ error: 'Destinatari non validi' }, 400)

    const pem = Deno.env.get('APNS_KEY_P8')
    const keyId = Deno.env.get('APNS_KEY_ID')
    const teamId = Deno.env.get('APNS_TEAM_ID')
    const topic = Deno.env.get('APNS_BUNDLE_ID') ?? 'com.coralweb.cuvee'
    if (!pem || !keyId || !teamId) return json({ error: 'Chiave APNs non configurata nei secret di Supabase' }, 500)

    const tokens = await loadTokens(db, audience, user.id)
    if (!tokens.length) return json({ success: true, total: 0, sent: 0, failed: 0, removed: 0, note: 'Nessun dispositivo registrato per questi destinatari' })

    let jwt: string
    try { jwt = await makeProviderToken(pem, keyId, teamId) } catch (e) { return json({ error: 'Chiave APNs non valida: ' + (e as Error).message }, 500) }

    const payload = buildPayload(title, message, notificationId)
    let sent = 0, removed = 0
    const failures: Record<string, number> = {}
    let fatal: string | null = null

    for (let i = 0; i < tokens.length && !fatal; i += CONCURRENCY) {
      const results = await Promise.all(tokens.slice(i, i + CONCURRENCY).map((t) => deliver(db, jwt, topic, t, payload)))
      for (const r of results) {
        if (r.ok) { sent++; continue }
        if (r.removed) removed++
        const why = r.reason ?? String(r.status)
        failures[why] = (failures[why] ?? 0) + 1
        // Errori che riguardano la nostra chiave, non il singolo telefono: inutile insistere
        if (r.reason === 'InvalidProviderToken' || r.reason === 'ExpiredProviderToken' || r.reason === 'MissingProviderToken') {
          fatal = 'Apple ha rifiutato la chiave APNs (' + r.reason + '): controlla Key ID, Team ID e contenuto del file .p8'
        }
      }
    }

    if (fatal) return json({ error: fatal, total: tokens.length, sent, failures }, 502)
    return json({ success: true, total: tokens.length, sent, failed: tokens.length - sent - removed, removed, failures })
  } catch (e) {
    return json({ error: (e as Error).message || 'Errore durante l\'invio' }, 500)
  }
})
