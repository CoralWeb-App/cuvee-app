import { createClient } from 'npm:@supabase/supabase-js@2'

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

const PROFILE_COLS =
  'id, is_premium, premium_source, premium_from, premium_until, deletion_requested_at, rc_event_at'

// Eventi che significano "l'abbonamento è (di nuovo) attivo fino a expiration_at_ms"
const GRANT_EVENTS = new Set([
  'INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE', 'SUBSCRIPTION_EXTENDED',
  'REFUND_REVERSED', 'TEMPORARY_ENTITLEMENT_GRANT', 'NON_RENEWING_PURCHASE',
])

interface Profile {
  id: string
  is_premium: boolean | null
  premium_source: string | null
  premium_from: string | null
  premium_until: string | null
  deletion_requested_at: string | null
  rc_event_at: string | null
}

const isUuid = (s: unknown): s is string =>
  typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)

function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

const iso = (ms: number) => new Date(ms).toISOString()

// Calcola come aggiornare la riga utente per un evento. Ogni evento scrive lo stato ASSOLUTO
// (non "incrementi"), quindi un evento ripetuto da RevenueCat è innocuo; l'ordine è protetto
// da event_timestamp_ms perché RevenueCat non garantisce che gli eventi arrivino in sequenza.
function computeUpdate(
  ev: Record<string, unknown>, p: Profile, nowMs: number,
): { updates: Record<string, unknown> } | { ignored: string } {
  const type = String(ev.type)
  const tsMs = typeof ev.event_timestamp_ms === 'number' ? ev.event_timestamp_ms : null
  const exp = typeof ev.expiration_at_ms === 'number' ? ev.expiration_at_ms : null
  const purchasedMs = typeof ev.purchased_at_ms === 'number' ? ev.purchased_at_ms : null

  if (tsMs !== null && p.rc_event_at && tsMs < Date.parse(p.rc_event_at)) return { ignored: 'stale_event' }

  // Premium regalato dall'admin: RevenueCat non ha nulla da dire su questi account
  if (p.premium_source === 'admin' && p.is_premium === true &&
      (!p.premium_until || Date.parse(p.premium_until) > nowMs)) {
    return { ignored: 'admin_granted_premium' }
  }

  const stamp: Record<string, unknown> = tsMs !== null ? { rc_event_at: iso(tsMs) } : {}

  if (GRANT_EVENTS.has(type) || type === 'CANCELLATION') {
    const active = exp === null || exp > nowMs

    if (!active) {
      return { updates: { ...stamp, is_premium: false, premium_until: null, cancel_at_period_end: false } }
    }

    const updates: Record<string, unknown> = {
      ...stamp,
      is_premium: true,
      premium_until: exp === null ? null : iso(exp),
      premium_source: 'revenuecat',
      // CANCELLATION = rinnovo disattivato ma accesso valido fino a scadenza; ogni altro evento lo riattiva
      cancel_at_period_end: type === 'CANCELLATION',
    }
    if (purchasedMs !== null && (type === 'INITIAL_PURCHASE' || p.is_premium !== true || !p.premium_from)) {
      updates.premium_from = iso(purchasedMs)
    }
    return { updates }
  }

  if (type === 'EXPIRATION') {
    // Se nel DB c'è già un periodo più recente di quello che scade, l'evento è vecchio
    if (exp !== null && p.premium_until) {
      const current = Date.parse(p.premium_until)
      if (current > exp + 60_000 && current > nowMs) return { ignored: 'newer_period_active' }
    }
    return { updates: { ...stamp, is_premium: false, premium_until: null, cancel_at_period_end: false } }
  }

  return { ignored: 'event_not_handled' }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const expected = Deno.env.get('REVENUECAT_WEBHOOK_AUTH')
  if (!expected) return json({ error: 'Webhook non configurato' }, 500)
  const got = (req.headers.get('authorization') ?? '').trim()
  const strip = (s: string) => s.replace(/^Bearer\s+/i, '').trim()
  if (!safeEqual(strip(got), strip(expected))) return json({ error: 'Non autorizzato' }, 401)

  let payload: { event?: Record<string, unknown> }
  try { payload = await req.json() } catch (_) { return json({ error: 'JSON non valido' }, 400) }
  const ev = payload?.event
  if (!ev || typeof ev.type !== 'string') return json({ ignored: 'no_event' })
  if (ev.type === 'TEST') return json({ ok: true, test: true })

  const SUPA_URL     = Deno.env.get('SUPABASE_URL')!
  const SUPA_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(SUPA_URL, SUPA_SERVICE)

  // L'app collega RevenueCat all'utente con il suo id Supabase (logIn): può comparire come
  // app_user_id, come alias o come destinatario di un trasferimento. Gli id anonimi ($RCAnonymousID) si ignorano.
  const rawIds = [
    ev.app_user_id, ev.original_app_user_id,
    ...(Array.isArray(ev.aliases) ? ev.aliases : []),
    ...(Array.isArray(ev.transferred_to) ? ev.transferred_to : []),
  ]
  const ids = [...new Set(rawIds.filter(isUuid).map((s) => s.toLowerCase()))]
  if (!ids.length) return json({ ignored: 'no_user_id' })

  const { data: rows, error: readErr } = await admin.from('users').select(PROFILE_COLS).in('id', ids)
  if (readErr) return json({ error: 'Lettura utente: ' + readErr.message }, 500)
  if (!rows || !rows.length) return json({ ignored: 'user_not_found' })
  const preferred = typeof ev.app_user_id === 'string' ? ev.app_user_id.toLowerCase() : ''
  const p = (rows as Profile[]).find((r) => r.id === preferred) ?? (rows as Profile[])[0]

  const result = computeUpdate(ev, p, Date.now())
  if ('ignored' in result) return json({ ignored: result.ignored })

  const { error: writeErr } = await admin.from('users').update(result.updates).eq('id', p.id)
  if (writeErr) return json({ error: 'Aggiornamento utente: ' + writeErr.message }, 500)

  if (p.deletion_requested_at) {
    if (result.updates.is_premium === true) {
      // Il rinnovo ha spostato la scadenza: la scheda "programmata" nel pannello admin resta allineata
      const until = result.updates.premium_until
      if (typeof until === 'string') {
        await admin.from('deleted_users').update({ scheduled_for: until, premium_until: until })
          .eq('user_id', p.id).eq('status', 'scheduled')
      }
    } else if (result.updates.is_premium === false) {
      // L'abbonamento è davvero finito: si esegue la cancellazione programmata (la funzione ricontrolla tutto)
      const r = await fetch(`${SUPA_URL}/functions/v1/delete-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPA_SERVICE}`, apikey: SUPA_SERVICE },
        body: JSON.stringify({ action: 'execute', target_user_id: p.id }),
      })
      // Un errore qui fa ritentare RevenueCat (5 tentativi); l'operazione è idempotente
      if (!r.ok) return json({ error: 'delete-account ' + r.status }, 500)
    }
  }

  return json({ ok: true, applied: ev.type })
})
