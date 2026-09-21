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
// Nella push compare solo l'inizio del testo: il messaggio completo si legge dentro l'app. Questi sono i
// limiti di ciò che si mostra nella notifica di sistema, non del messaggio.
const PUSH_TITLE_CHARS = 65
const PUSH_BODY_CHARS = 110
const INPUT_MAX_TITLE = 200
const INPUT_MAX_BODY = 2000

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

function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}
function jwtRole(token: string): string | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const role = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))).role
    return typeof role === 'string' ? role : null
  } catch (_) { return null }
}
// Chiunque presenti la chiave segreta del progetto (stesso criterio di delete-account)
async function isSystemCaller(bearer: string, url: string, envService: string): Promise<boolean> {
  if (!bearer) return false
  if (safeEqual(bearer, envService)) return true
  if (jwtRole(bearer) !== 'service_role' && !bearer.startsWith('sb_secret_')) return false
  try {
    const { error } = await createClient(url, bearer).auth.admin.listUsers({ page: 1, perPage: 1 })
    return !error
  } catch (_) { return false }
}

interface Plan { row: TokenRow; title: string; body: string; notificationId?: string }
const isUuid = (s: unknown): s is string =>
  typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)

// Accorcia al limite tagliando su una parola intera e aggiungendo i puntini
export function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut
  return base.replace(/[\s,;:.\-–—]+$/, '') + '…'
}

export function buildPayload(title: string, body: string, notificationId?: string, badge?: number): string {
  return JSON.stringify({
    aps: {
      alert: { title: clip(title, PUSH_TITLE_CHARS), body: clip(body, PUSH_BODY_CHARS) },
      sound: 'default',
      ...(typeof badge === 'number' ? { badge } : {}),
    },
    ...(notificationId ? { notification_id: notificationId } : {}),
  })
}

// Numero da mostrare sull'icona dell'app: messaggi attivi che quell'utente non ha ancora letto.
// Se la lettura fallisce si omette il numero (meglio nessun numero che uno sbagliato).
async function unreadByUser(db: Db, userIds: string[]): Promise<Map<string, number> | null> {
  try {
    const { data: active, error } = await db.from('notifications').select('id').eq('is_active', true)
    if (error) return null
    const activeIds = new Set<string>((active ?? []).map((r: { id: string }) => r.id))
    const readCount = new Map<string, number>()
    for (let i = 0; i < userIds.length; i += 200) {
      const chunk = userIds.slice(i, i + 200)
      for (let from = 0; ; from += 1000) {
        const { data, error: e2 } = await db.from('notification_reads').select('user_id, notification_id')
          .in('user_id', chunk).order('read_at', { ascending: true }).range(from, from + 999)
        if (e2) return null
        for (const r of data ?? []) if (activeIds.has(r.notification_id)) readCount.set(r.user_id, (readCount.get(r.user_id) ?? 0) + 1)
        if (!data || data.length < 1000) break
      }
    }
    // Messaggi personali (notifiche automatiche) non ancora letti
    const personal = new Map<string, number>()
    const since = new Date(Date.now() - 60 * 86_400_000).toISOString()
    for (let i = 0; i < userIds.length; i += 200) {
      const chunk = userIds.slice(i, i + 200)
      for (let from = 0; ; from += 1000) {
        const { data, error: e3 } = await db.from('personal_notifications').select('user_id')
          .in('user_id', chunk).is('read_at', null).gte('created_at', since).order('created_at', { ascending: true }).range(from, from + 999)
        if (e3) return null
        for (const r of data ?? []) personal.set(r.user_id, (personal.get(r.user_id) ?? 0) + 1)
        if (!data || data.length < 1000) break
      }
    }
    const out = new Map<string, number>()
    for (const id of userIds) out.set(id, Math.max(0, activeIds.size - (readCount.get(id) ?? 0)) + (personal.get(id) ?? 0))
    return out
  } catch (_) { return null }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Non autorizzato' }, 401)
    const SUPA_URL = Deno.env.get('SUPABASE_URL')!
    const SUPA_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const db = createClient(SUPA_URL, SUPA_SERVICE)

    const bearer = authHeader.replace(/^Bearer\s+/i, '').trim()
    const system = await isSystemCaller(bearer, SUPA_URL, SUPA_SERVICE)
    let callerId = ''
    if (!system) {
      const userSupa = createClient(SUPA_URL, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
      const { data: { user }, error: authErr } = await userSupa.auth.getUser()
      if (authErr || !user) return json({ error: 'Non autorizzato' }, 401)
      const { data: caller } = await db.from('users').select('is_admin').eq('id', user.id).maybeSingle()
      if (!caller?.is_admin) return json({ error: 'Solo gli admin possono inviare notifiche' }, 403)
      callerId = user.id
    }

    let body: Record<string, unknown> = {}
    try { body = (await req.json()) ?? {} } catch (_) { return json({ error: 'Richiesta non valida' }, 400) }

    const pem = Deno.env.get('APNS_KEY_P8')
    const keyId = Deno.env.get('APNS_KEY_ID')
    const teamId = Deno.env.get('APNS_TEAM_ID')
    const topic = Deno.env.get('APNS_BUNDLE_ID') ?? 'com.coralweb.cuvee'

    // ── Piano di invio: chi riceve cosa ──
    let plans: Plan[] = []
    if (system) {
      // Messaggi personali (notifiche automatiche): ognuno con il proprio testo e il proprio collegamento
      const raw = Array.isArray(body.deliveries) ? body.deliveries : []
      const deliveries = new Map<string, { title: string; body: string; notification_id?: string }>()
      for (const d of raw as Array<Record<string, unknown>>) {
        if (!isUuid(d?.user_id) || !String(d?.title ?? '').trim() || !String(d?.body ?? '').trim()) continue
        deliveries.set(d.user_id, { title: String(d.title), body: String(d.body), notification_id: typeof d.notification_id === 'string' ? d.notification_id : undefined })
        if (deliveries.size >= 1000) break
      }
      if (!deliveries.size) return json({ success: true, total: 0, sent: 0, failed: 0, removed: 0, note: 'Nessun destinatario' })
      if (!pem || !keyId || !teamId) return json({ error: 'Chiave APNs non configurata nei secret di Supabase' }, 500)
      const ids = [...deliveries.keys()]
      for (let i = 0; i < ids.length; i += 200) {
        const { data, error } = await db.from('push_tokens').select('token, user_id, environment').in('user_id', ids.slice(i, i + 200))
        if (error) return json({ error: 'Lettura dispositivi: ' + error.message }, 500)
        for (const row of (data ?? []) as TokenRow[]) {
          const d = deliveries.get(row.user_id)!
          plans.push({ row, title: d.title, body: d.body, notificationId: d.notification_id })
        }
      }
    } else {
      const title = String(body.title ?? '').trim()
      const message = String(body.body ?? '').trim()
      const audience = String(body.audience ?? 'all')
      const notificationId = typeof body.notification_id === 'string' ? body.notification_id : undefined
      if (!title || !message) return json({ error: 'Titolo e messaggio sono obbligatori' }, 400)
      if (title.length > INPUT_MAX_TITLE) return json({ error: `Titolo troppo lungo (max ${INPUT_MAX_TITLE} caratteri)` }, 400)
      if (message.length > INPUT_MAX_BODY) return json({ error: `Messaggio troppo lungo (max ${INPUT_MAX_BODY} caratteri)` }, 400)
      if (!['all', 'premium', 'free', 'test'].includes(audience)) return json({ error: 'Destinatari non validi' }, 400)
      if (!pem || !keyId || !teamId) return json({ error: 'Chiave APNs non configurata nei secret di Supabase' }, 500)
      const tokens = await loadTokens(db, audience, callerId)
      plans = tokens.map((row) => ({ row, title, body: message, notificationId }))
    }

    if (!plans.length) return json({ success: true, total: 0, sent: 0, failed: 0, removed: 0, note: 'Nessun dispositivo registrato per questi destinatari' })

    let jwt: string
    try { jwt = await makeProviderToken(pem!, keyId!, teamId!) } catch (e) { return json({ error: 'Chiave APNs non valida: ' + (e as Error).message }, 500) }

    const unread = await unreadByUser(db, [...new Set(plans.map((p) => p.row.user_id))])
    let sent = 0, removed = 0
    const failures: Record<string, number> = {}
    let fatal: string | null = null

    for (let i = 0; i < plans.length && !fatal; i += CONCURRENCY) {
      const results = await Promise.all(plans.slice(i, i + CONCURRENCY).map((p) =>
        deliver(db, jwt, topic, p.row, buildPayload(p.title, p.body, p.notificationId, unread?.get(p.row.user_id)))))
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

    if (fatal) return json({ error: fatal, total: plans.length, sent, failures }, 502)
    return json({ success: true, total: plans.length, sent, failed: plans.length - sent - removed, removed, failures })
  } catch (e) {
    return json({ error: (e as Error).message || 'Errore durante l\'invio' }, 500)
  }
})
