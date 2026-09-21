import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// Le notifiche automatiche partono solo di giorno, ora italiana: dalle 10:00 alle 19:59
const SEND_FROM_HOUR = 10
const SEND_UNTIL_HOUR = 20
const BATCH = 200

// deno-lint-ignore no-explicit-any
type Db = any
interface Rule { key: string; title: string; body: string; cta_label: string | null; cta_action: string | null }

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
async function isSystemCaller(bearer: string, url: string, envService: string): Promise<boolean> {
  if (!bearer) return false
  if (safeEqual(bearer, envService)) return true
  if (jwtRole(bearer) !== 'service_role' && !bearer.startsWith('sb_secret_')) return false
  try {
    const { error } = await createClient(url, bearer).auth.admin.listUsers({ page: 1, perPage: 1 })
    return !error
  } catch (_) { return false }
}

export function romeHour(now = new Date()): number {
  const h = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: 'numeric', hourCycle: 'h23' }).format(now)
  return parseInt(h, 10)
}
export const inSendWindow = (now = new Date()) => {
  const h = romeHour(now)
  return h >= SEND_FROM_HOUR && h < SEND_UNTIL_HOUR
}

async function createPersonal(db: Db, userId: string, rule: Rule, isTest: boolean): Promise<string> {
  const { data, error } = await db.from('personal_notifications').insert({
    user_id: userId, auto_key: rule.key, title: rule.title, body: rule.body,
    cta_label: rule.cta_label, cta_action: rule.cta_action, is_test: isTest,
  }).select('id').single()
  if (error || !data) throw new Error('Messaggio personale: ' + (error?.message ?? 'nessun id'))
  return data.id as string
}

// L'invio vero e proprio ad Apple lo fa send-push, che sa già gestire ambienti, token non validi e numero sull'icona
async function pushDeliveries(supaUrl: string, serviceKey: string, deliveries: Array<Record<string, string>>) {
  if (!deliveries.length) return { total: 0, sent: 0 }
  const r = await fetch(`${supaUrl}/functions/v1/send-push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
    body: JSON.stringify({ deliveries }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) return { total: deliveries.length, sent: 0, error: j?.error ?? `send-push ${r.status}` }
  return { total: j.total ?? 0, sent: j.sent ?? 0, removed: j.removed ?? 0, failed: j.failed ?? 0 }
}

async function runRule(db: Db, rule: Rule, supaUrl: string, serviceKey: string) {
  const { data: cands, error } = await db.rpc('automation_candidates', { p_key: rule.key, p_limit: BATCH })
  if (error) throw new Error(`Regola ${rule.key}: ${error.message}`)
  const deliveries: Array<Record<string, string>> = []
  let created = 0
  for (const c of (cands ?? []) as Array<{ user_id: string; period_key: string }>) {
    // Si prenota prima di scrivere: se due esecuzioni si sovrappongono, il messaggio parte una volta sola
    const { data: claimed } = await db.rpc('automation_claim', { p_user: c.user_id, p_key: rule.key, p_period: c.period_key })
    if (claimed !== true) continue
    try {
      const id = await createPersonal(db, c.user_id, rule, false)
      created++
      deliveries.push({ user_id: c.user_id, title: rule.title, body: rule.body, notification_id: 'p:' + id })
    } catch (e) {
      console.error(`${rule.key} ${c.user_id}:`, (e as Error).message)
    }
  }
  const push = await pushDeliveries(supaUrl, serviceKey, deliveries)
  return { key: rule.key, candidates: (cands ?? []).length, messages: created, push }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Non autorizzato' }, 401)
    const SUPA_URL = Deno.env.get('SUPABASE_URL')!
    const SUPA_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const db = createClient(SUPA_URL, SUPA_SERVICE)

    let body: Record<string, unknown> = {}
    try { body = (await req.json()) ?? {} } catch (_) { /* nessun body */ }
    const action = typeof body.action === 'string' ? body.action : ''

    const bearer = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (await isSystemCaller(bearer, SUPA_URL, SUPA_SERVICE)) {
      if (action === 'ping') return json({ ok: true })
      if (action !== 'run') return json({ error: 'Azione non valida' }, 400)

      // "force" serve solo per le verifiche manuali: fuori orario la funzione non invia nulla
      if (body.force !== true && !inSendWindow()) return json({ success: true, skipped: 'fuori orario', hour: romeHour() })

      const { data: rules, error } = await db.from('auto_notifications').select('key, title, body, cta_label, cta_action')
        .eq('enabled', true).order('sort', { ascending: true })
      if (error) return json({ error: 'Lettura regole: ' + error.message }, 500)

      // In sequenza: ogni regola vede gli invii già registrati dalle precedenti, così i tetti di frequenza valgono anche tra regole diverse
      const results = []
      for (const rule of (rules ?? []) as Rule[]) {
        try { results.push(await runRule(db, rule, SUPA_URL, SUPA_SERVICE)) }
        catch (e) { results.push({ key: rule.key, error: (e as Error).message }) }
      }
      return json({ success: true, rules: results })
    }

    // ── Chiamate dal pannello admin (JWT dell'admin) ──
    const userSupa = createClient(SUPA_URL, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authErr } = await userSupa.auth.getUser()
    if (authErr || !user) return json({ error: 'Non autorizzato' }, 401)
    const { data: caller } = await db.from('users').select('is_admin').eq('id', user.id).maybeSingle()
    if (!caller?.is_admin) return json({ error: 'Solo gli admin possono usare le notifiche automatiche' }, 403)

    if (action === 'test') {
      // Prova: manda il messaggio della regola solo all'admin che la richiede, senza controlli né registro
      const key = String(body.key ?? '')
      const { data: rule } = await db.from('auto_notifications').select('key, title, body, cta_label, cta_action').eq('key', key).maybeSingle()
      if (!rule) return json({ error: 'Regola non trovata' }, 404)
      const id = await createPersonal(db, user.id, rule as Rule, true)
      const push = await pushDeliveries(SUPA_URL, SUPA_SERVICE, [{ user_id: user.id, title: rule.title, body: rule.body, notification_id: 'p:' + id }])
      return json({ success: true, message_id: id, push })
    }
    return json({ error: 'Azione non valida' }, 400)
  } catch (e) {
    return json({ error: (e as Error).message || 'Errore' }, 500)
  }
})
