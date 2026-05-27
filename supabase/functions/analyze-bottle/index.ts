import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0'

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

const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    // ── Auth ────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Non autorizzato' }, 401)

    const SUPA_URL     = Deno.env.get('SUPABASE_URL')!
    const SUPA_ANON    = Deno.env.get('SUPABASE_ANON_KEY')!
    const SUPA_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userSupa = createClient(SUPA_URL, SUPA_ANON, {
      global: { headers: { Authorization: authHeader } },
    })
    const adminSupa = createClient(SUPA_URL, SUPA_SERVICE)

    const { data: { user }, error: authErr } = await userSupa.auth.getUser()
    if (authErr || !user) return json({ error: 'Non autorizzato' }, 401)

    // ── Rate limiting (free: 5 scansioni/mese) ──────────────────
    const { data: profile } = await userSupa
      .from('profiles')
      .select('is_premium')
      .eq('id', user.id)
      .single()

    const isPremium = profile?.is_premium ?? false

    if (!isPremium) {
      const monthStart = new Date()
      monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)

      const { count } = await userSupa
        .from('bottle_scans')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', monthStart.toISOString())

      if ((count ?? 0) >= 5) {
        return json({
          error: 'rate_limit',
          scans_used: count,
          message: 'Hai usato le 5 scansioni mensili gratuite. Passa a Premium per scansioni illimitate.',
        }, 429)
      }
    }

    // ── Parse request ────────────────────────────────────────────
    const { image_base64, media_type = 'image/jpeg' } = await req.json()
    if (!image_base64) return json({ error: 'Immagine mancante' }, 400)

    // ── Anthropic Vision ─────────────────────────────────────────
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

    const aiMsg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type, data: image_base64 },
          },
          {
            type: 'text',
            text: `Sei un esperto sommelier di Champagne. Analizza con attenzione l'etichetta della bottiglia nell'immagine.

Rispondi SOLO con un oggetto JSON valido, zero testo extra prima o dopo:
{
  "is_champagne": boolean,
  "confidence": 0-100,
  "maison": "nome esatto del produttore come scritto in etichetta, o null",
  "cuvee": "nome esatto della cuvée come scritto in etichetta, o null",
  "annata": "anno come stringa es '2018', o null se sans année",
  "is_sa": true se sans année/non-vintage, false se ha annata specifica,
  "dosage": uno tra "Brut Nature","Extra Brut","Brut","Extra Sec","Sec","Demi-Sec","Doux" oppure null,
  "tipo": uno tra "blanc de blancs","blanc de noirs","rosé","assemblage" oppure null,
  "prestige": true se cuvée prestige/tête de cuvée (es. Dom Pérignon, Cristal, Belle Époque),
  "descrizione": "massimo 180 caratteri in italiano, tono elegante, oppure null",
  "not_champagne_type": "tipo di bevanda se NON è Champagne AOC, es: Prosecco, Cava, Franciacorta, vino bianco, birra... oppure null"
}`,
          },
        ],
      }],
    })

    // ── Parse JSON risposta AI ───────────────────────────────────
    const rawText = aiMsg.content[0].type === 'text' ? aiMsg.content[0].text : ''
    let ai: Record<string, unknown> = {}
    try {
      const m = rawText.match(/\{[\s\S]*\}/)
      if (m) ai = JSON.parse(m[0])
    } catch {
      ai = { is_champagne: false, confidence: 0 }
    }

    // ── Ricerca nel catalogo ─────────────────────────────────────
    let matchedBottle: Record<string, unknown> | null = null
    let bottleHasPhoto = false

    if (ai.is_champagne && ai.maison && ai.cuvee) {
      const qMaison = norm(ai.maison as string)
      const qCuvee  = norm(ai.cuvee as string)

      const { data: bottles } = await adminSupa
        .from('bottiglie')
        .select('id, nome, tipo, dosaggio_tipo, annata, is_sa, foto_url, descrizione, prezzo_min, prezzo_max, fascia_prezzo, maison(id, nome, slug)')
        .eq('is_published', true)
        .eq('needs_review', false)

      if (bottles) {
        const found = (bottles as any[]).find(b => {
          const bNome   = norm(b.nome || '')
          const bMaison = norm(b.maison?.nome || '')
          const maisonOk = bMaison.includes(qMaison) || qMaison.includes(bMaison)
          const cuveeOk  = bNome.includes(qCuvee)   || qCuvee.includes(bNome)
          return maisonOk && cuveeOk
        })
        if (found) {
          matchedBottle  = found
          bottleHasPhoto = !!found.foto_url
        }
      }
    }

    // ── Auto-aggiunta al catalogo (Champagne non trovato) ────────
    let newBottleId: string | null = null

    if (ai.is_champagne && !matchedBottle && ai.maison && ai.cuvee) {
      // Trova o crea la maison
      let maisonId: string | null = null

      const { data: existingMaison } = await adminSupa
        .from('maison')
        .select('id')
        .ilike('nome', `%${(ai.maison as string).split(' ')[0]}%`)
        .limit(1)
        .maybeSingle()

      if (existingMaison) {
        maisonId = existingMaison.id
      } else {
        const { data: newMaison } = await adminSupa
          .from('maison')
          .insert({ nome: ai.maison, source: 'ai_scan', needs_review: true })
          .select('id')
          .single()
        maisonId = newMaison?.id ?? null
      }

      if (maisonId) {
        const { data: nb } = await adminSupa
          .from('bottiglie')
          .insert({
            nome:         ai.cuvee,
            maison_id:    maisonId,
            annata:       ai.is_sa ? null : (ai.annata ?? null),
            is_sa:        ai.is_sa ?? true,
            dosaggio_tipo: ai.dosage ?? null,
            tipo:         ai.tipo ?? null,
            descrizione:  ai.descrizione ?? null,
            is_published: true,
            source:       'ai_scan',
            needs_review: true,
          })
          .select('id')
          .single()
        newBottleId = nb?.id ?? null
      }
    }

    // ── Salva record scansione ───────────────────────────────────
    const { data: scan } = await userSupa
      .from('bottle_scans')
      .insert({
        user_id:          user.id,
        is_champagne:     ai.is_champagne ?? false,
        detected_maison:  ai.maison ?? null,
        detected_cuvee:   ai.cuvee ?? null,
        detected_annata:  ai.annata ?? null,
        detected_dosage:  ai.dosage ?? null,
        detected_tipo:    ai.tipo ?? null,
        confidence:       ai.confidence ?? 0,
        not_champagne_type: ai.not_champagne_type ?? null,
        matched_bottle_id: matchedBottle?.id ?? null,
        new_bottle_id:    newBottleId,
        result_json:      ai,
      })
      .select('id')
      .single()

    // ── Risposta ─────────────────────────────────────────────────
    return json({
      scan_id:          scan?.id,
      is_champagne:     ai.is_champagne,
      confidence:       ai.confidence,
      not_champagne_type: ai.not_champagne_type,
      maison:           ai.maison,
      cuvee:            ai.cuvee,
      annata:           ai.annata,
      is_sa:            ai.is_sa,
      dosage:           ai.dosage,
      tipo:             ai.tipo,
      prestige:         ai.prestige,
      descrizione:      ai.descrizione,
      is_in_catalog:    !!matchedBottle,
      matched_bottle:   matchedBottle,
      matched_bottle_id: matchedBottle?.id ?? null,
      new_bottle_id:    newBottleId,
      bottle_has_photo: bottleHasPhoto,
    })

  } catch (err) {
    console.error('analyze-bottle error:', err)
    return json({ error: "Errore durante l'analisi. Riprova." }, 500)
  }
})
