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

    const aiMsg = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      system: `Sei un maestro sommelier con 30 anni di esperienza in Champagne e conoscenza enciclopedica di ogni maison, cuvée speciale e annata. Hai degustato migliaia di Champagne e conosci perfettamente blend, dosaggi, maturazioni e stile di ogni produttore.

REGOLA CRITICA per il campo "cuvee" — LEGGI CON ATTENZIONE:
Il campo "cuvee" deve contenere il nome COMPLETO e PRECISO della cuvée, incluse TUTTE le denominazioni speciali visibili sulla bottiglia o capsula, MA senza il nome della maison se già nel campo "maison" e senza l'annata.

Esempi fondamentali:
• Dom Pérignon con "P2" o "Deuxième Plénitude" sulla capsula/bottiglia → cuvee: "P2"
• Dom Pérignon con "P3" o "Troisième Plénitude" → cuvee: "P3"
• Dom Pérignon normale → cuvee: "Dom Pérignon"
• Dom Pérignon Rosé → cuvee: "Dom Pérignon Rosé"
• Bollinger R.D. → cuvee: "R.D."
• Bollinger La Grande Année → cuvee: "La Grande Année"
• Krug Grande Cuvée → cuvee: "Grande Cuvée"
• Pol Roger Sir Winston Churchill → cuvee: "Sir Winston Churchill"
• Pommery Louise → cuvee: "Louise"
• Laurent-Perrier Grand Siècle → cuvee: "Grand Siècle"
• Taittinger Comtes de Champagne → cuvee: "Comtes de Champagne"
• Louis Roederer Cristal Rosé → cuvee: "Cristal Rosé"
• Perrier-Jouët Belle Époque → cuvee: "Belle Époque"
• Ruinart Blanc de Blancs → cuvee: "Blanc de Blancs"

Per campi tecnici come uvaggio, dosaggio, vinificazione, malolattica, maturazione:
Usa la tua conoscenza enciclopedica per fornire dati precisi anche se non visibili sull'etichetta. Per le grandi cuvées di cui conosci le caratteristiche, inserisci sempre i valori corretti.`,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type, data: image_base64 },
          },
          {
            type: 'text',
            text: `Analizza questa bottiglia con la massima precisione.

ISTRUZIONI SPECIALI:
1. "cuvee": scrivi il nome COMPLETO con denominazioni speciali (P2, P3, R.D., Belle Époque, Rosé, Blanc de Blancs, ecc.) ma SENZA il nome della maison se già in "maison" e SENZA l'annata
2. Per uvaggio (pct_chardonnay/pinot_noir/meunier): usa la tua conoscenza delle caratteristiche tipiche della maison e cuvée
3. Per maturazione_mesi: per cuvées speciali come P2 = ~144 mesi, P3 = ~216 mesi, R.D. = 180+ mesi, Dom Pérignon = ~84 mesi, Cristal = ~72 mesi
4. Per score: usa la scala Parker/RVF (Dom Pérignon P2 ~98, Dom Pérignon ~96, Cristal ~95, Cristal Rosé ~97, Krug GC ~95, NM Brut ~87-89)
5. Per finestra_da/finestra_a: calcola basandoti sull'annata e sulla tipologia

Rispondi SOLO con un oggetto JSON valido, zero testo extra prima o dopo:
{
  "is_champagne": boolean,
  "confidence": 0-100,
  "maison": "nome esatto del produttore/maison come scritto in etichetta, o null",
  "cuvee": "nome COMPLETO della cuvée con denominazioni speciali (P2, P3, R.D., Belle Époque, Rosé...) ma SENZA il nome maison se già sopra e SENZA l'annata, o null",
  "annata": "anno come stringa es '2018', o null se sans année",
  "is_sa": true se sans année/non-vintage, false se ha annata specifica,
  "dosage": uno tra "Brut Nature","Extra Brut","Brut","Extra Sec","Sec","Demi-Sec","Doux" oppure null,
  "tipo": uno tra "blanc de blancs","blanc de noirs","rosé","assemblage" oppure null,
  "prestige": true se cuvée prestige/tête de cuvée (es. Dom Pérignon, Cristal, Belle Époque, R.D., Grande Année, Grande Cuvée, Grand Siècle, Comtes de Champagne, Sir Winston Churchill, Louise, Clos du Mesnil),
  "descrizione": "massimo 180 caratteri in italiano, tono elegante, oppure null",
  "punteggio": numero intero 0-100 qualità stimata scala Parker/RVF, o null se non identificabile con certezza,
  "note_degustazione": "note degustazione professionali in italiano 200-300 caratteri: colore, perlage, profumi, gusto, oppure null",
  "abbinamento": "2-3 abbinamenti gastronomici in italiano separati da virgola, oppure null",
  "finestra_da": anno intero inizio finestra degustazione ottimale (es: 2024), o null,
  "finestra_a": anno intero fine finestra degustazione (es: 2035), o null,
  "pct_chardonnay": percentuale integer Chardonnay 0-100 (usa conoscenza tipica della cuvée) o null,
  "pct_pinot_noir": percentuale integer Pinot Noir 0-100 o null,
  "pct_meunier": percentuale integer Pinot Meunier 0-100 o null,
  "provenienza_uve": "zona/village di provenienza uve in italiano, oppure null",
  "vinificazione": "breve descrizione vinificazione in italiano, oppure null",
  "malolattica": "completa, parziale o assente, oppure null",
  "maturazione_mesi": numero integer mesi maturazione sui lieviti o null,
  "produzione_bottiglie": numero integer stima bottiglie prodotte o null,
  "not_champagne_type": "tipo bevanda se NON è Champagne AOC (Prosecco, Cava, Franciacorta...) oppure null"
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

      // Cerca maison esistente (prima parola)
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
          .insert({ nome: ai.maison, needs_review: true })
          .select('id')
          .single()
        if (maisonErr) {
          console.error('maison insert error:', JSON.stringify(maisonErr))
          _dbErrors.push('maison: ' + maisonErr.message)
        }
        maisonId = newMaison?.id ?? null
      }

      if (maisonId) {
        const bottlePayload: Record<string, unknown> = {
          nome:                 ai.cuvee,
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
        }

        const { data: nb, error: bottErr } = await adminSupa
          .from('bottiglie')
          .insert(bottlePayload)
          .select('id')
          .single()

        if (bottErr) {
          console.error('bottiglie insert error:', JSON.stringify(bottErr))
          _dbErrors.push('bottiglie: ' + bottErr.message)
          // Retry senza campi opzionali che potrebbero mancare nello schema
          const { data: nb2, error: bottErr2 } = await adminSupa
            .from('bottiglie')
            .insert({
              nome:          ai.cuvee,
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
    return json({ error: "Errore durante l'analisi. Riprova." }, 500)
  }
})
