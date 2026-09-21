import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

// La risposta a OPTIONS fa da "sonda di versione": l'app e il pannello admin la
// leggono per sapere se questa versione della funzione è già online, prima di
// promettere all'utente la cancellazione programmata. NON usare mai un POST come
// sonda: le versioni vecchie eliminano l'account a qualsiasi POST autenticato.
const FLOW_VERSION = 'ok:v2'

// Bucket storage di proprietà dell'utente — ogni file vive sotto una cartella
// "{userId}/...". NON tocca 'champagne-photos' (catalogo, non dati utente).
const USER_STORAGE_BUCKETS = ['avatars', 'scan-photos', 'carnet-photos']

// Tabelle con una colonna user_id che referenzia l'account da eliminare.
const USER_DATA_TABLES = ['bottle_scans', 'scan_history', 'carnet_notes', 'favorites', 'wishlist']

const RETENTION_DAYS = 30
const DAY_MS = 86_400_000
const SWEEP_BATCH = 20
const PROFILE_COLS_LEGACY =
  'id, email, full_name, created_at, is_premium, premium_source, subscription_plan, premium_from, premium_until'
const PROFILE_COLS = PROFILE_COLS_LEGACY + ', deletion_requested_at'

// deno-lint-ignore no-explicit-any
type Db = any
interface Profile {
  id: string
  email: string | null
  full_name: string | null
  created_at: string | null
  is_premium: boolean | null
  premium_source: string | null
  subscription_plan: string | null
  premium_from: string | null
  premium_until: string | null
  deletion_requested_at: string | null
}
type Actor = 'user' | 'admin' | 'system'

const isUuid = (s: unknown): s is string =>
  typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)

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

// Chiamante di sistema = chiunque presenti la chiave segreta del progetto. Nei progetti che usano le nuove
// API key la variabile d'ambiente può non coincidere con la chiave che si copia dalla dashboard (formato
// diverso), quindi oltre al confronto diretto si prova la chiave: solo una chiave segreta valida può
// elencare gli utenti. I token utente (ruolo "authenticated") non vengono nemmeno provati.
async function isSystemCaller(bearer: string, url: string, envService: string): Promise<boolean> {
  if (!bearer) return false
  if (safeEqual(bearer, envService)) return true
  if (jwtRole(bearer) !== 'service_role' && !bearer.startsWith('sb_secret_')) return false
  try {
    const { error } = await createClient(url, bearer).auth.admin.listUsers({ page: 1, perPage: 1 })
    return !error
  } catch (_) { return false }
}

// "Premium a pagamento" = abbonamento reale (RevenueCat) ancora in corso. I Premium
// concessi a mano dall'admin non hanno pagato nulla e si eliminano subito come i Free.
function payingUntil(p: Profile | null): Date | null {
  if (!p || p.is_premium !== true || p.premium_source !== 'revenuecat' || !p.premium_until) return null
  const d = new Date(p.premium_until)
  return d.getTime() > Date.now() ? d : null
}

async function loadProfile(admin: Db, uid: string): Promise<Profile | null> {
  let { data, error } = await admin.from('users').select(PROFILE_COLS).eq('id', uid).maybeSingle()
  if (error && /deletion_requested_at/.test(error.message)) {
    // Migrazione SQL non ancora eseguita: le eliminazioni immediate continuano a funzionare come prima
    ;({ data, error } = await admin.from('users').select(PROFILE_COLS_LEGACY).eq('id', uid).maybeSingle())
    if (data) data.deletion_requested_at = null
  }
  if (error) throw new Error('Lettura profilo: ' + error.message)
  return (data as Profile | null) ?? null
}

async function buildSnapshot(admin: Db, uid: string) {
  const count = async (table: string): Promise<number> => {
    const { count: c } = await admin.from(table).select('*', { count: 'exact', head: true }).eq('user_id', uid)
    return c ?? 0
  }
  const latest = async (table: string): Promise<string | null> => {
    const { data } = await admin.from(table).select('created_at').eq('user_id', uid)
      .order('created_at', { ascending: false }).limit(1)
    return data?.[0]?.created_at ?? null
  }
  const [scans, notes, favs, wish, lastScan, lastNote] = await Promise.all([
    count('bottle_scans'), count('carnet_notes'), count('favorites'), count('wishlist'),
    latest('bottle_scans'), latest('carnet_notes'),
  ])
  const dates = [lastScan, lastNote].filter(Boolean) as string[]
  const last = dates.length ? dates.reduce((a, b) => (new Date(a) > new Date(b) ? a : b)) : null
  return {
    scan_count: scans, carnet_count: notes, favorites_count: favs, wishlist_count: wish,
    last_activity_at: last,
  }
}

async function baseRow(admin: Db, uid: string, p: Profile | null) {
  let email = p?.email ?? null
  let registered = p?.created_at ?? null
  if (!email || !registered) {
    try {
      const { data } = await admin.auth.admin.getUserById(uid)
      email = email ?? data?.user?.email ?? null
      registered = registered ?? data?.user?.created_at ?? null
    } catch (_) { /* profilo incompleto: si salva quel che c'è */ }
  }
  return {
    user_id: uid,
    email,
    full_name: p?.full_name ?? null,
    registered_at: registered,
    was_premium: p?.is_premium === true,
    premium_source: p?.premium_source ?? null,
    subscription_plan: p?.subscription_plan ?? null,
    premium_from: p?.premium_from ?? null,
    premium_until: p?.premium_until ?? null,
    ...(await buildSnapshot(admin, uid)),
  }
}

async function listAllFiles(admin: Db, bucket: string, prefix: string, depth = 0): Promise<string[]> {
  const out: string[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000, offset })
    if (error || !data || !data.length) break
    for (const item of data) {
      // Le cartelle non hanno id: si scende (max 3 livelli) per non lasciare foto orfane
      if (item.id) out.push(`${prefix}/${item.name}`)
      else if (depth < 3) out.push(...await listAllFiles(admin, bucket, `${prefix}/${item.name}`, depth + 1))
    }
    if (data.length < 1000) break
  }
  return out
}

async function executeDeletion(admin: Db, uid: string, actor: Actor) {
  const p = await loadProfile(admin, uid)
  const row = await baseRow(admin, uid, p)

  // Se la cancellazione era stata programmata, la scheda esistente sa chi l'ha chiesta e che piano aveva:
  // alla scadenza il profilo è già tornato "free", quindi quei dati vanno conservati, non sovrascritti.
  const { data: ex } = await admin.from('deleted_users')
    .select('status, deleted_by, was_premium, premium_source, subscription_plan, premium_from, premium_until')
    .eq('user_id', uid).maybeSingle()
  const deletedBy: string = actor === 'system' ? (ex?.deleted_by ?? 'user') : actor
  if (ex?.status === 'scheduled' && ex.was_premium && p?.is_premium !== true) {
    row.was_premium = true
    row.premium_source = ex.premium_source ?? row.premium_source
    row.subscription_plan = ex.subscription_plan ?? row.subscription_plan
    row.premium_from = ex.premium_from ?? row.premium_from
    row.premium_until = ex.premium_until ?? row.premium_until
  }

  // Il riepilogo è "best effort": non deve mai impedire all'utente di cancellarsi (obbligo Apple/GDPR).
  // Se la scrittura fallisce, il trigger sul DB registra comunque l'eliminazione come 'dashboard'.
  const now = new Date()
  try {
    const { error } = await admin.from('deleted_users').upsert({
      ...row,
      status: 'deleted',
      deleted_by: deletedBy,
      requested_at: p?.deletion_requested_at ?? now.toISOString(),
      scheduled_for: null,
      deleted_at: now.toISOString(),
      purge_at: new Date(now.getTime() + RETENTION_DAYS * DAY_MS).toISOString(),
    }, { onConflict: 'user_id' })
    if (error) console.error('deleted_users upsert:', error.message)
  } catch (e) {
    console.error('deleted_users upsert:', (e as Error).message)
  }

  for (const bucket of USER_STORAGE_BUCKETS) {
    const paths = await listAllFiles(admin, bucket, uid)
    for (let i = 0; i < paths.length; i += 1000) {
      const { error } = await admin.storage.from(bucket).remove(paths.slice(i, i + 1000))
      if (error) console.error(`storage ${bucket}:`, error.message)
    }
  }

  for (const table of USER_DATA_TABLES) {
    const { error } = await admin.from(table).delete().eq('user_id', uid)
    if (error) console.error(`delete ${table}:`, error.message)
  }
  await admin.from('users').delete().eq('id', uid)

  const { error: delErr } = await admin.auth.admin.deleteUser(uid)
  if (delErr && delErr.status !== 404 && delErr.code !== 'user_not_found') throw delErr
}

async function scheduleDeletion(admin: Db, uid: string, p: Profile, actor: Actor, until: Date) {
  if (!p.deletion_requested_at) {
    const requestedAt = new Date().toISOString()
    const { error } = await admin.from('users').update({ deletion_requested_at: requestedAt }).eq('id', uid)
    if (error) throw new Error('Programmazione: ' + error.message)
    p.deletion_requested_at = requestedAt
  }
  await upsertScheduledRow(admin, uid, p, actor, until)
}

async function upsertScheduledRow(admin: Db, uid: string, p: Profile, actor: Actor, until: Date) {
  try {
    const { error } = await admin.from('deleted_users').upsert({
      ...(await baseRow(admin, uid, p)),
      status: 'scheduled',
      deleted_by: actor,
      requested_at: p.deletion_requested_at,
      scheduled_for: until.toISOString(),
      deleted_at: null,
      purge_at: null,
    }, { onConflict: 'user_id' })
    if (error) console.error('deleted_users schedule:', error.message)
  } catch (e) {
    console.error('deleted_users schedule:', (e as Error).message)
  }
}

async function cancelDeletion(admin: Db, uid: string) {
  const { error } = await admin.from('users').update({ deletion_requested_at: null }).eq('id', uid)
  if (error) throw new Error('Annullamento: ' + error.message)
  await admin.from('deleted_users').delete().eq('user_id', uid).eq('status', 'scheduled')
}

async function fetchRcEntitlement(key: string, uid: string): Promise<{ active: boolean; expires: string | null }> {
  const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`, {
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  })
  if (!r.ok) throw new Error('RevenueCat ' + r.status)
  const j = await r.json()
  let lifetime = false
  let latest = 0
  for (const e of Object.values(j?.subscriber?.entitlements ?? {}) as Array<Record<string, string | null>>) {
    if (e?.expires_date === null) { lifetime = true; continue }
    const end = Math.max(e?.expires_date ? Date.parse(e.expires_date) : 0,
      e?.grace_period_expires_date ? Date.parse(e.grace_period_expires_date) : 0)
    if (end > latest) latest = end
  }
  const active = lifetime || latest > Date.now()
  return { active, expires: !lifetime && latest ? new Date(latest).toISOString() : null }
}

// Decide se una cancellazione programmata può essere eseguita ora. Principio: nel dubbio NON si cancella
// mai un utente che sta pagando — un'attesa in più costa niente, un account cancellato per errore sì.
async function scheduledEligibility(admin: Db, p: Profile): Promise<{ ok: boolean; reason?: string }> {
  if (!p.deletion_requested_at) return { ok: false, reason: 'not_scheduled' }
  if (p.is_premium !== true) return { ok: true }
  if (!p.premium_until) return { ok: false, reason: 'premium_without_expiry' }
  const until = Date.parse(p.premium_until)
  if (until > Date.now() - DAY_MS) return { ok: false, reason: 'premium_active' }
  if (p.premium_source !== 'revenuecat') return { ok: true }

  // Data scaduta da oltre un giorno ma il DB dice ancora "premium": il webhook potrebbe non essere arrivato
  const key = Deno.env.get('REVENUECAT_SECRET_KEY')
  if (!key) return { ok: false, reason: 'stale_premium_unverified' }
  try {
    const rc = await fetchRcEntitlement(key, p.id)
    if (!rc.active) return { ok: true }
    await admin.from('users').update({ is_premium: true, premium_until: rc.expires }).eq('id', p.id)
    return { ok: false, reason: 'premium_active_on_revenuecat' }
  } catch (e) {
    console.error('RevenueCat check:', (e as Error).message)
    return { ok: false, reason: 'revenuecat_check_failed' }
  }
}

async function runSweep(admin: Db) {
  const deleted: string[] = []
  const skipped: Array<{ id: string; reason?: string }> = []
  const failed: Array<{ id: string; error: string }> = []

  const { data: pending, error } = await admin.from('users').select(PROFILE_COLS)
    .not('deletion_requested_at', 'is', null).limit(SWEEP_BATCH)
  if (error) throw new Error('Sweep: ' + error.message)

  for (const p of (pending ?? []) as Profile[]) {
    const el = await scheduledEligibility(admin, p)
    if (!el.ok) { skipped.push({ id: p.id, reason: el.reason }); continue }
    try {
      await executeDeletion(admin, p.id, 'system')
      deleted.push(p.id)
    } catch (e) {
      failed.push({ id: p.id, error: (e as Error).message })
    }
  }

  // Riallinea le schede "programmata" al DB: ne manca una, o l'utente ha annullato senza passare da qui
  const pendingIds = new Set(((pending ?? []) as Profile[]).map((p) => p.id))
  const { data: scheduled } = await admin.from('deleted_users').select('user_id').eq('status', 'scheduled').limit(500)
  const haveCard = new Set<string>((scheduled ?? []).map((r: { user_id: string }) => r.user_id))
  for (const p of (pending ?? []) as Profile[]) {
    if (!deleted.includes(p.id) && !haveCard.has(p.id)) {
      const until = p.premium_until ? new Date(p.premium_until) : new Date()
      await upsertScheduledRow(admin, p.id, p, 'user', until)
    }
  }
  // Una scheda "programmata" senza richiesta attiva è orfana. Si controlla sul DB (non solo sul lotto
  // di questo giro) per non cancellare schede valide quando le richieste in coda sono più del lotto.
  const unmatched = [...haveCard].filter((id) => !pendingIds.has(id))
  if (unmatched.length) {
    const { data: stillPending } = await admin.from('users').select('id')
      .in('id', unmatched).not('deletion_requested_at', 'is', null)
    const valid = new Set((stillPending ?? []).map((r: { id: string }) => r.id))
    for (const id of unmatched) {
      if (!valid.has(id)) await admin.from('deleted_users').delete().eq('user_id', id).eq('status', 'scheduled')
    }
  }

  await admin.from('deleted_users').delete().eq('status', 'deleted').lt('purge_at', new Date().toISOString())
  return { deleted, skipped, failed }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(FLOW_VERSION, { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Non autorizzato' }, 401)

    const SUPA_URL     = Deno.env.get('SUPABASE_URL')!
    const SUPA_ANON    = Deno.env.get('SUPABASE_ANON_KEY')!
    const SUPA_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Client con service_role: unico modo per eliminare file/righe di altre tabelle indipendentemente
    // dalle policy RLS, e l'unico per eliminare l'utente da auth.users (richiede privilegi admin).
    const adminSupa = createClient(SUPA_URL, SUPA_SERVICE)

    let body: Record<string, unknown> = {}
    try { body = (await req.json()) ?? {} } catch (_) { /* nessun body: cancellazione dell'utente stesso, come nelle versioni precedenti */ }
    const action = typeof body.action === 'string' ? body.action : 'delete'
    const target = body.target_user_id
    if (target !== undefined && target !== null && !isUuid(target)) return json({ error: 'Utente non valido' }, 400)

    // ── Chiamate di sistema (webhook RevenueCat, job giornaliero): autenticate con la service key ──
    const bearer = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (await isSystemCaller(bearer, SUPA_URL, SUPA_SERVICE)) {
      if (action === 'ping') return json({ ok: true, version: 2 })
      if (action === 'sweep') return json({ success: true, ...(await runSweep(adminSupa)) })
      if (action === 'execute' && isUuid(target)) {
        const p = await loadProfile(adminSupa, target)
        if (!p) return json({ success: true, skipped: 'already_deleted' })
        const el = await scheduledEligibility(adminSupa, p)
        if (!el.ok) return json({ success: true, skipped: el.reason })
        await executeDeletion(adminSupa, target, 'system')
        return json({ success: true, deleted: true })
      }
      return json({ error: 'Azione non valida' }, 400)
    }

    // ── Chiamate utente: il token verificato qui sotto è quello del chiamante ──
    const userSupa = createClient(SUPA_URL, SUPA_ANON, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authErr } = await userSupa.auth.getUser()
    if (authErr || !user) return json({ error: 'Non autorizzato' }, 401)

    // La piattaforma admin può agire su un ALTRO utente passando target_user_id: richiede che il
    // chiamante sia admin. Senza (o se coincide col chiamante) un utente agisce solo su se stesso.
    let uid = user.id
    let actor: Actor = 'user'
    if (isUuid(target) && target !== user.id) {
      const { data: caller } = await adminSupa.from('users').select('is_admin').eq('id', user.id).single()
      if (!caller?.is_admin) return json({ error: 'Non autorizzato a modificare altri account' }, 403)
      uid = target
      actor = 'admin'
    }

    if (action === 'ping') return json({ ok: true, version: 2 })

    if (action === 'cancel') {
      await cancelDeletion(adminSupa, uid)
      return json({ success: true, cancelled: true })
    }

    if (action !== 'delete') return json({ error: 'Azione non valida' }, 400)

    const profile = await loadProfile(adminSupa, uid)
    const until = payingUntil(profile)
    const forceNow = actor === 'admin' && body.mode === 'now'

    if (profile && until && !forceNow) {
      await scheduleDeletion(adminSupa, uid, profile, actor, until)
      return json({ success: true, scheduled: true, scheduled_for: until.toISOString() })
    }

    await executeDeletion(adminSupa, uid, actor)
    return json({ success: true, scheduled: false })
  } catch (e) {
    return json({ error: (e as Error).message || 'Errore durante l\'eliminazione dell\'account' }, 500)
  }
})
