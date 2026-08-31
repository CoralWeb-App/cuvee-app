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

// Bucket storage di proprietà dell'utente — ogni file vive sotto una cartella
// "{userId}/...". NON tocca 'champagne-photos' (catalogo, non dati utente).
const USER_STORAGE_BUCKETS = ['avatars', 'scan-photos', 'carnet-photos']

// Tabelle con una colonna user_id che referenzia l'account da eliminare.
const USER_DATA_TABLES = ['bottle_scans', 'scan_history', 'carnet_notes', 'favorites', 'wishlist']

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    // ── Auth: solo l'utente stesso può richiedere l'eliminazione del proprio account ──
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Non autorizzato' }, 401)

    const SUPA_URL     = Deno.env.get('SUPABASE_URL')!
    const SUPA_ANON    = Deno.env.get('SUPABASE_ANON_KEY')!
    const SUPA_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userSupa = createClient(SUPA_URL, SUPA_ANON, {
      global: { headers: { Authorization: authHeader } },
    })
    // Client con service_role: unico modo per eliminare file/righe di altre
    // tabelle indipendentemente dalle policy RLS, e l'unico modo possibile
    // per eliminare l'utente da auth.users (richiede privilegi admin).
    const adminSupa = createClient(SUPA_URL, SUPA_SERVICE)

    const { data: { user }, error: authErr } = await userSupa.auth.getUser()
    if (authErr || !user) return json({ error: 'Non autorizzato' }, 401)

    // Corpo opzionale: { target_user_id }. Usato dalla piattaforma admin per
    // eliminare l'account di un ALTRO utente — richiede che il chiamante
    // (verificato sopra tramite il suo stesso token) sia admin. Senza questo
    // campo (o se coincide col chiamante) il comportamento resta invariato:
    // un utente elimina solo se stesso, esattamente come prima.
    let uid = user.id
    try {
      const body = await req.json()
      if (body?.target_user_id && body.target_user_id !== user.id) {
        const { data: caller } = await adminSupa.from('users').select('is_admin').eq('id', user.id).single()
        if (!caller?.is_admin) return json({ error: 'Non autorizzato a eliminare altri account' }, 403)
        uid = body.target_user_id
      }
    } catch (_) { /* nessun body / body non JSON: nessuna richiesta di eliminare un altro utente */ }

    // ── Storage: rimuove ogni file dell'utente nei bucket personali ──
    for (const bucket of USER_STORAGE_BUCKETS) {
      const { data: files } = await adminSupa.storage.from(bucket).list(uid)
      if (files && files.length) {
        const paths = files.map((f) => `${uid}/${f.name}`)
        await adminSupa.storage.from(bucket).remove(paths)
      }
    }

    // ── Database: elimina ogni riga collegata all'utente ──
    for (const table of USER_DATA_TABLES) {
      await adminSupa.from(table).delete().eq('user_id', uid)
    }
    await adminSupa.from('users').delete().eq('id', uid)

    // ── Auth: elimina l'account — da qui in poi non può più accedere ──
    const { error: delErr } = await adminSupa.auth.admin.deleteUser(uid)
    if (delErr) throw delErr

    return json({ success: true })
  } catch (e) {
    return json({ error: (e as Error).message || 'Errore durante l\'eliminazione dell\'account' }, 500)
  }
})
