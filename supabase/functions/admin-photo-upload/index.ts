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
    const { action, bottle_id, image_base64 } = body

    // ── DELETE ────────────────────────────────────────────
    if (action === 'delete') {
      if (!bottle_id) return json({ error: 'bottle_id mancante' }, 400)
      const { error: delErr } = await adminSupa.storage
        .from('champagne-photos')
        .remove([`bottles/${bottle_id}.jpg`])
      if (delErr) return json({ error: delErr.message }, 500)
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
