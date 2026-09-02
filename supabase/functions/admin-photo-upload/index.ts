import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Non autorizzato' }, 401)

    const SUPA_URL     = Deno.env.get('SUPABASE_URL')!
    const SUPA_ANON    = Deno.env.get('SUPABASE_ANON_KEY')!
    const SUPA_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userSupa  = createClient(SUPA_URL, SUPA_ANON, {
      global: { headers: { Authorization: authHeader } },
    })
    const adminSupa = createClient(SUPA_URL, SUPA_SERVICE)

    // Verifica admin
    const { data: { user }, error: authErr } = await userSupa.auth.getUser()
    if (authErr || !user) return json({ error: 'Non autorizzato' }, 401)

    const { data: profile } = await adminSupa
      .from('users').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) return json({ error: 'Accesso negato' }, 403)

    const body = await req.json()
    const { action, bottle_id, image_base64, pending_id } = body

    // ── DELETE ────────────────────────────────────────────
    if (action === 'delete') {
      if (!bottle_id) return json({ error: 'bottle_id mancante' }, 400)
      const { error: delErr } = await adminSupa.storage
        .from('champagne-photos')
        .remove([`bottles/${bottle_id}.jpg`])
      if (delErr) return json({ error: delErr.message }, 500)
      return json({ ok: true })
    }

    // ── APPROVE_PHOTO — promuove una foto in coda a foto ufficiale ──
    // Sovrascrive bottles/{bottiglia_id}.jpg (upsert): la vecchia foto, se
    // c'era, viene sostituita in place, nessuna riga/file resta orfano.
    // Le altre foto eventualmente ancora in coda per la stessa bottiglia
    // NON vengono toccate: restano in attesa di una decisione singola.
    if (action === 'approve_photo') {
      if (!pending_id) return json({ error: 'pending_id mancante' }, 400)
      const { data: pending, error: pErr } = await adminSupa
        .from('foto_bottiglia_pending').select('*').eq('id', pending_id).single()
      if (pErr || !pending) return json({ error: 'Foto in approvazione non trovata' }, 404)

      const { data: fileData, error: dlErr } = await adminSupa.storage
        .from('champagne-photos').download(pending.storage_path)
      if (dlErr) return json({ error: dlErr.message }, 500)

      const canonicalPath = `bottles/${pending.bottiglia_id}.jpg`
      const { error: upErr } = await adminSupa.storage
        .from('champagne-photos')
        .upload(canonicalPath, fileData, { contentType: 'image/jpeg', upsert: true })
      if (upErr) return json({ error: upErr.message }, 500)

      const { data: urlData } = adminSupa.storage.from('champagne-photos').getPublicUrl(canonicalPath)
      const { error: updErr } = await adminSupa
        .from('bottiglie').update({ foto_url: urlData.publicUrl }).eq('id', pending.bottiglia_id)
      if (updErr) return json({ error: updErr.message }, 500)

      // Pulizia: il file in pending è già stato promosso, non serve più.
      await adminSupa.storage.from('champagne-photos').remove([pending.storage_path])
      await adminSupa.from('foto_bottiglia_pending').delete().eq('id', pending_id)

      return json({ ok: true, url: urlData.publicUrl })
    }

    // ── REJECT_PHOTO — scarta una foto in coda, cancellata subito ──
    if (action === 'reject_photo') {
      if (!pending_id) return json({ error: 'pending_id mancante' }, 400)
      const { data: pending } = await adminSupa
        .from('foto_bottiglia_pending').select('storage_path').eq('id', pending_id).single()
      if (pending?.storage_path) {
        await adminSupa.storage.from('champagne-photos').remove([pending.storage_path])
      }
      const { error: delPendErr } = await adminSupa
        .from('foto_bottiglia_pending').delete().eq('id', pending_id)
      if (delPendErr) return json({ error: delPendErr.message }, 500)
      return json({ ok: true })
    }

    // ── UPLOAD (default) ──────────────────────────────────
    if (!bottle_id)    return json({ error: 'bottle_id mancante' }, 400)
    if (!image_base64) return json({ error: 'image_base64 mancante' }, 400)

    const imageBytes  = Uint8Array.from(atob(image_base64), c => c.charCodeAt(0))
    const storagePath = `bottles/${bottle_id}.jpg`

    const { error: uploadErr } = await adminSupa.storage
      .from('champagne-photos')
      .upload(storagePath, imageBytes, { contentType: 'image/jpeg', upsert: true })
    if (uploadErr) return json({ error: uploadErr.message }, 500)

    const { data: urlData } = adminSupa.storage
      .from('champagne-photos')
      .getPublicUrl(storagePath)

    return json({ url: urlData.publicUrl })

  } catch (err) {
    console.error('admin-photo-upload error:', err)
    return json({ error: String(err) }, 500)
  }
})
