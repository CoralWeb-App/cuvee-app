import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.39.0'

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

// Genera slug URL-safe da una stringa
const makeSlug = (s: string) => (s || '')
  .toLowerCase()
  .replace(/[àáâã]/g,'a').replace(/[èéêë]/g,'e').replace(/[ìíîï]/g,'i')
  .replace(/[òóôõö]/g,'o').replace(/[ùúûü]/g,'u').replace(/[ñ]/g,'n')
  .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')

const SYSTEM_PROMPT =
  'Sei un maestro sommelier con 30 anni di esperienza in Champagne e conoscenza enciclopedica di ogni maison, cuvee speciale e annata. ' +
  'Hai degustato migliaia di Champagne e conosci perfettamente blend, dosaggi, maturazioni e stile di ogni produttore.\n\n' +
  'REGOLA CRITICA per il campo "cuvee":\n' +
  'Il campo "cuvee" deve contenere il nome COMPLETO e PRECISO incluse TUTTE le denominazioni speciali visibili sulla bottiglia o capsula, ' +
  'MA senza il nome della maison se gia nel campo "maison" e senza l annata.\n\n' +
  'Esempi fondamentali:\n' +
  '- Dom Perignon con P2 o Deuxieme Plenitude sulla capsula/bottiglia -> cuvee: "P2"\n' +
  '- Dom Perignon con P3 o Troisieme Plenitude -> cuvee: "P3"\n' +
  '- Dom Perignon normale -> cuvee: "Dom Perignon"\n' +
  '- Dom Perignon Rose -> cuvee: "Dom Perignon Rose"\n' +
  '- Bollinger R.D. -> cuvee: "R.D."\n' +
  '- Bollinger La Grande Annee -> cuvee: "La Grande Annee"\n' +
  '- Krug Grande Cuvee -> cuvee: "Grande Cuvee"\n' +
  '- Pol Roger Sir Winston Churchill -> cuvee: "Sir Winston Churchill"\n' +
  '- Laurent-Perrier Grand Siecle -> cuvee: "Grand Siecle"\n' +
  '- Taittinger Comtes de Champagne -> cuvee: "Comtes de Champagne"\n' +
  '- Louis Roederer Cristal Rose -> cuvee: "Cristal Rose"\n' +
  '- Perrier-Jouet Belle Epoque -> cuvee: "Belle Epoque"\n\n' +
  'Per campi tecnici come uvaggio, dosaggio, vinificazione, malolattica, maturazione: ' +
  'usa la tua conoscenza enciclopedica per fornire dati precisi anche se non visibili sull etichetta.'

const USER_PROMPT =
  'Analizza questa bottiglia con la massima precisione.\n\n' +
  'ISTRUZIONI:\n' +
  '1. "cuvee": nome COMPLETO con denominazioni speciali (P2, P3, R.D., Belle Epoque, Rose, Blanc de Blancs, ecc.) ma SENZA nome maison e SENZA annata\n' +
  '2. Per uvaggio: usa la tua conoscenza delle caratteristiche tipiche della maison e cuvee\n' +
  '3. Per maturazione_mesi: P2=144, P3=216, R.D.=180+, Dom Perignon=84, Cristal=72\n' +
  '4. Per punteggio scala Parker/RVF: Dom Perignon P2=98, Dom Perignon=96, Cristal=95, Cristal Rose=97, Krug GC=95, NM Brut=87-89\n' +
  '5. Per finestra_da/finestra_a: calcola basandoti sull annata e tipologia\n\n' +
  'Rispondi SOLO con un oggetto JSON valido, zero testo extra prima o dopo:\n' +
  '{\n' +
  '  "is_champagne": boolean,\n' +
  '  "confidence": 0-100,\n' +
  '  "maison": "nome esatto produttore come in etichetta, o null",\n' +
  '  "cuvee": "nome COMPLETO con denominazioni speciali ma SENZA maison e SENZA annata, o null",\n' +
  '  "annata": "anno come stringa es 2018, o null se sans annee",\n' +
  '  "is_sa": true se sans annee/non-vintage, false se ha annata specifica,\n' +
  '  "dosage": "Brut Nature" o "Extra Brut" o "Brut" o "Extra Sec" o "Sec" o "Demi-Sec" o "Doux" o null,\n' +
  '  "tipo": "blanc de blancs" o "blanc de noirs" o "rose" o "assemblage" o null,\n' +
  '  "prestige": true se cuvee prestige/tete de cuvee,\n' +
  '  "descrizione": "max 180 caratteri italiano tono elegante, o null",\n' +
  '  "punteggio": numero intero 0-100 qualita stimata scala Parker/RVF o null,\n' +
  '  "note_degustazione": "200-300 caratteri italiano: colore perlage profumi gusto, o null",\n' +
  '  "abbinamento": "2-3 abbinamenti gastronomici italiani separati da virgola, o null",\n' +
  '  "finestra_da": anno intero inizio finestra degustazione ottimale o null,\n' +
  '  "finestra_a": anno intero fine finestra degustazione o null,\n' +
  '  "pct_chardonnay": percentuale integer Chardonnay 0-100 o null,\n' +
  '  "pct_pinot_noir": percentuale integer Pinot Noir 0-100 o null,\n' +
  '  "pct_meunier": percentuale integer Pinot Meunier 0-100 o null,\n' +
  '  "provenienza_uve": "zona/village provenienza uve italiano, o null",\n' +
  '  "vinificazione": "breve descrizione vinificazione italiano, o null",\n' +
  '  "malolattica": "completa" o "parziale" o "assente" o null,\n' +
  '  "maturazione_mesi": numero integer mesi maturazione sui lieviti o null,\n' +
  '  "produzione_bottiglie": numero integer stima bottiglie prodotte o null,\n' +
  '  "not_champagne_type": "tipo bevanda se NON e Champagne AOC, o null"\n' +
  '}'

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

    // ── Rate limiting ────────────────────────────────────────────
    const { data: profile } = await adminSupa
      .from('users')
      .select('is_premium')
      .eq('id', user.id)
      .single()

    const isPremium = profile?.is_premium === true

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

    let rawText = ''
    try {
      const aiMsg = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: media_type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: image_base64 },
            },
            { type: 'text', text: USER_PROMPT },
          ],
        }],
      })
      rawText = aiMsg.content[0].type === 'text' ? aiMsg.content[0].text : ''
    } catch (aiErr: any) {
      console.error('Sonnet error, trying haiku:', JSON.stringify(aiErr))
      // Fallback su Haiku se Sonnet non disponibile
      try {
        const fallbackMsg = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2000,
          system: SYSTEM_PROMPT,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: media_type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: image_base64 },
              },
              { type: 'text', text: USER_PROMPT },
            ],
          }],
        })
        rawText = fallbackMsg.content[0].type === 'text' ? fallbackMsg.content[0].text : ''
      } catch (fallbackErr: any) {
        console.error('Haiku fallback error:', JSON.stringify(fallbackErr))
        return json({ error: 'AI non disponibile: ' + (aiErr?.message || String(aiErr)) }, 500)
      }
    }

    // ── Parse JSON risposta AI ───────────────────────────────────
    let ai: Record<string, unknown> = {}
    try {
      const m = rawText.match(/\{[\s\S]*\}/)
      if (m) ai = JSON.parse(m[0])
    } catch {
      console.error('JSON parse error, raw:', rawText.substring(0, 500))
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
        .select('id, nome, tipo, dosaggio_tipo, dosaggio_gl, annata, is_sa, foto_url, descrizione, prezzo_min, prezzo_max, fascia_prezzo, score_medio, note_degustazione, abbinamento, finestra_da, finestra_a, pct_chardonnay, pct_pinot_noir, pct_meunier, provenienza_uve, vinificazione, malolattica, maturazione_mesi, produzione_bottiglie, maison(id, nome, slug)')
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
    const _dbErrors: string[] = []

    if (ai.is_champagne && !matchedBottle && ai.maison && ai.cuvee) {
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
        const { data: newMaison, error: maisonErr } = await adminSupa
          .from('maison')
          .insert({ nome: ai.maison, slug: makeSlug(ai.maison as string), needs_review: true })
          .select('id')
          .single()
        if (maisonErr) {
          console.error('maison insert error:', JSON.stringify(maisonErr))
          _dbErrors.push('maison: ' + maisonErr.message)
        }
        maisonId = newMaison?.id ?? null
      }

      if (maisonId) {
        // Genera slug univoco: maison-cuvee[-annata]
        const bottleSlug = makeSlug(
          (ai.maison as string) + '-' + (ai.cuvee as string) +
          (!ai.is_sa && ai.annata ? '-' + ai.annata : '')
        )

        const { data: nb, error: bottErr } = await adminSupa
          .from('bottiglie')
          .insert({
            nome:                 ai.cuvee,
            slug:                 bottleSlug,
            maison_id:            maisonId,
            annata:               ai.is_sa ? null : (ai.annata ?? null),
            is_sa:                ai.is_sa ?? true,
            dosaggio_tipo:        ai.dosage ?? null,
            tipo:                 ai.tipo ?? null,
            descrizione:          ai.descrizione ?? null,
            note_degustazione:    ai.note_degustazione ?? null,
            abbinamento:          ai.abbinamento ?? null,
            finestra_da:          ai.finestra_da ?? null,
            finestra_a:           ai.finestra_a  ?? null,
            pct_chardonnay:       ai.pct_chardonnay ?? null,
            pct_pinot_noir:       ai.pct_pinot_noir ?? null,
            pct_meunier:          ai.pct_meunier ?? null,
            provenienza_uve:      ai.provenienza_uve ?? null,
            vinificazione:        ai.vinificazione ?? null,
            malolattica:          ai.malolattica ?? null,
            maturazione_mesi:     ai.maturazione_mesi ?? null,
            produzione_bottiglie: ai.produzione_bottiglie ?? null,
            score_medio:          ai.punteggio ?? null,
            is_published:         true,
            needs_review:         true,
          })
          .select('id')
          .single()

        if (bottErr) {
          console.error('bottiglie insert error:', JSON.stringify(bottErr))
          _dbErrors.push('bottiglie: ' + bottErr.message)
          // Retry con soli campi essenziali + slug
          const { data: nb2, error: bottErr2 } = await adminSupa
            .from('bottiglie')
            .insert({
              nome:          ai.cuvee,
              slug:          bottleSlug + '-' + Date.now(),
              maison_id:     maisonId,
              annata:        ai.is_sa ? null : (ai.annata ?? null),
              is_sa:         ai.is_sa ?? true,
              dosaggio_tipo: ai.dosage ?? null,
              tipo:          ai.tipo ?? null,
              score_medio:   ai.punteggio ?? null,
              is_published:  true,
              needs_review:  true,
            })
            .select('id')
            .single()
          if (bottErr2) {
            console.error('bottiglie retry error:', JSON.stringify(bottErr2))
            _dbErrors.push('bottiglie_retry: ' + bottErr2.message)
          }
          newBottleId = nb2?.id ?? null
        } else {
          newBottleId = nb?.id ?? null
        }
      }
    }

    // ── Upload foto nel catalogo (service role, bypassa RLS) ─────
    let uploadedPhotoUrl: string | null = null
    const bottleId = matchedBottle?.id ?? newBottleId

    if (ai.is_champagne && bottleId && !bottleHasPhoto && image_base64) {
      try {
        // Assicura che il bucket esista (crea se non esiste)
        const { data: buckets } = await adminSupa.storage.listBuckets()
        const bucketExists = (buckets || []).some((b: any) => b.name === 'champagne-photos')
        if (!bucketExists) {
          const { error: bucketErr } = await adminSupa.storage.createBucket('champagne-photos', { public: true })
          if (bucketErr) {
            console.error('bucket create error:', JSON.stringify(bucketErr))
            _dbErrors.push('bucket_create: ' + bucketErr.message)
          }
        }

        const imageBytes = Uint8Array.from(atob(image_base64), c => c.charCodeAt(0))
        const storagePath = 'bottles/' + bottleId + '.jpg'

        const { error: uploadErr } = await adminSupa.storage
          .from('champagne-photos')
          .upload(storagePath, imageBytes, { contentType: 'image/jpeg', upsert: true })

        if (uploadErr) {
          console.error('storage upload error:', JSON.stringify(uploadErr))
          _dbErrors.push('storage: ' + uploadErr.message)
        } else {
          const { data: urlData } = adminSupa.storage
            .from('champagne-photos')
            .getPublicUrl(storagePath)
          uploadedPhotoUrl = urlData.publicUrl

          const { error: updateErr } = await adminSupa
            .from('bottiglie')
            .update({ foto_url: uploadedPhotoUrl })
            .eq('id', bottleId)

          if (updateErr) {
            console.error('foto_url update error:', JSON.stringify(updateErr))
            _dbErrors.push('foto_update: ' + updateErr.message)
          }
        }
      } catch(e) {
        console.error('photo upload exception:', e)
        _dbErrors.push('photo_exception: ' + String(e))
      }
    }

    // ── Salva record scansione ───────────────────────────────────
    const { data: scan } = await userSupa
      .from('bottle_scans')
      .insert({
        user_id:            user.id,
        is_champagne:       ai.is_champagne ?? false,
        detected_maison:    ai.maison ?? null,
        detected_cuvee:     ai.cuvee ?? null,
        detected_annata:    ai.annata ?? null,
        detected_dosage:    ai.dosage ?? null,
        detected_tipo:      ai.tipo ?? null,
        confidence:         ai.confidence ?? 0,
        not_champagne_type: ai.not_champagne_type ?? null,
        matched_bottle_id:  matchedBottle?.id ?? null,
        new_bottle_id:      newBottleId,
        result_json:        ai,
      })
      .select('id')
      .single()

    // ── Enriched data: prefer catalog, fallback to AI ────────────
    const mb = matchedBottle as any
    const enriched = {
      score_medio:          mb?.score_medio          ?? (ai.punteggio as number | null) ?? null,
      note_degustazione:    mb?.note_degustazione     ?? ai.note_degustazione    ?? null,
      abbinamento:          mb?.abbinamento           ?? ai.abbinamento          ?? null,
      finestra_da:          mb?.finestra_da           ?? ai.finestra_da          ?? null,
      finestra_a:           mb?.finestra_a            ?? ai.finestra_a           ?? null,
      pct_chardonnay:       mb?.pct_chardonnay        ?? ai.pct_chardonnay       ?? null,
      pct_pinot_noir:       mb?.pct_pinot_noir        ?? ai.pct_pinot_noir       ?? null,
      pct_meunier:          mb?.pct_meunier           ?? ai.pct_meunier          ?? null,
      provenienza_uve:      mb?.provenienza_uve       ?? ai.provenienza_uve      ?? null,
      vinificazione:        mb?.vinificazione         ?? ai.vinificazione        ?? null,
      malolattica:          mb?.malolattica           ?? ai.malolattica          ?? null,
      maturazione_mesi:     mb?.maturazione_mesi      ?? ai.maturazione_mesi     ?? null,
      produzione_bottiglie: mb?.produzione_bottiglie  ?? ai.produzione_bottiglie ?? null,
      dosaggio_gl:          mb?.dosaggio_gl           ?? null,
    }

    // ── Risposta ─────────────────────────────────────────────────
    return json({
      scan_id:            scan?.id,
      is_champagne:       ai.is_champagne,
      confidence:         ai.confidence,
      not_champagne_type: ai.not_champagne_type,
      maison:             ai.maison,
      cuvee:              ai.cuvee,
      annata:             ai.annata,
      is_sa:              ai.is_sa,
      dosage:             ai.dosage,
      tipo:               ai.tipo,
      prestige:           ai.prestige,
      descrizione:        ai.descrizione,
      is_in_catalog:      !!matchedBottle,
      matched_bottle:     matchedBottle,
      matched_bottle_id:  matchedBottle?.id ?? null,
      new_bottle_id:      newBottleId,
      bottle_has_photo:   bottleHasPhoto,
      uploaded_photo_url: uploadedPhotoUrl,
      _debug:             _dbErrors.length ? _dbErrors : undefined,
      ...enriched,
    })

  } catch (err) {
    console.error('analyze-bottle error:', err)
    return json({ error: 'Errore interno: ' + String(err) }, 500)
  }
})
