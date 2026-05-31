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

// Deriva fascia_prezzo dal prezzo_min (allineato ai breakpoint JS)
const fasciaFromPrezzo = (p: number | null): string | null => {
  if (!p) return null
  if (p <= 50)  return 'entry'
  if (p <= 90)  return 'media_gamma'
  if (p <= 130) return 'premium'
  if (p <= 200) return 'alta_gamma'
  if (p <= 300) return 'lusso'
  return 'gran_lusso'
}

// Genera slug URL-safe da una stringa
const makeSlug = (s: string) => (s || '')
  .toLowerCase()
  .replace(/[àáâã]/g,'a').replace(/[èéêë]/g,'e').replace(/[ìíîï]/g,'i')
  .replace(/[òóôõö]/g,'o').replace(/[ùúûü]/g,'u').replace(/[ñ]/g,'n')
  .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')

// ── Prezzi API (USD per token) — aggiornare se Anthropic cambia tariffe ──
const PRICE_HAIKU_IN   = 1.00  / 1_000_000  // $1.00 / MTok  input
const PRICE_HAIKU_OUT  = 5.00  / 1_000_000  // $5.00 / MTok  output
const PRICE_SONNET_IN  = 3.00  / 1_000_000  // $3.00 / MTok  input
const PRICE_SONNET_OUT = 15.00 / 1_000_000  // $15.00 / MTok output

const SYSTEM_PROMPT =
  'Sei un maestro sommelier con 30 anni di esperienza in Champagne e conoscenza enciclopedica di ogni maison, cuvee speciale e annata. ' +
  'Hai degustato migliaia di Champagne e conosci perfettamente blend, dosaggi, maturazioni e stile di ogni produttore.\n\n' +

  '=== REGOLA ASSOLUTA #1: is_bottle ===\n' +
  'Prima di tutto determina se l immagine mostra una bottiglia o contenitore di bevanda.\n' +
  'Se l immagine NON contiene una bottiglia (es. persona, cibo, animale, oggetto generico, paesaggio, parte del corpo, documento, ecc.) -> is_bottle: false, is_champagne: false, stop.\n' +
  'Solo se is_bottle: true procedi con l analisi.\n\n' +

  '=== REGOLA ASSOLUTA #2: is_champagne - PROCESSO DI VERIFICA ===\n' +
  'Lo Champagne AOC e ESCLUSIVAMENTE un vino spumante prodotto:\n' +
  '- In FRANCIA, nella regione delimitata AOC Champagne\n' +
  '- Nei dipartimenti autorizzati: Marne, Aube, Aisne, Seine-et-Marne, Haute-Marne\n' +
  '- Con uve autorizzate: Pinot Noir, Pinot Meunier, Chardonnay, Pinot Blanc, Arbane, Petit Meslier\n' +
  '- Con metodo champenoise in bottiglia\n\n' +
  'CATENA DECISIONALE OBBLIGATORIA per is_champagne:\n' +
  'STEP 1: C e scritto "Champagne" sull etichetta o capsula? SE SI -> is_champagne: true. SE NO -> continua.\n' +
  'STEP 2: Il produttore e italiano, spagnolo, tedesco, americano, australiano o di qualsiasi paese non francese? SE SI -> is_champagne: false, STOP.\n' +
  'STEP 3: Il produttore e francese ma fuori dalla regione Champagne (Alsazia, Loira, Borgogna, Provenza, ecc.)? SE SI -> is_champagne: false, STOP.\n' +
  'STEP 4: Non riesci a determinare l origine? -> is_champagne: false (sii sempre conservativo).\n\n' +
  'NON SONO CHAMPAGNE - esempi espliciti (is_champagne: false SEMPRE):\n' +
  '- Franciacorta (Ca del Bosco, Berlucchi, Bellavista, Nicola Gatta, ecc.) -> ITALIANO\n' +
  '- Trento DOC, Ferrari Trento -> ITALIANO\n' +
  '- Prosecco, Valdobbiadene -> ITALIANO\n' +
  '- Cava -> SPAGNOLO\n' +
  '- Cremant d Alsace, Cremant de Loire, Cremant de Bourgogne -> FRANCESE ma NON Champagne AOC\n' +
  '- Sekt -> TEDESCO/AUSTRIACO\n' +
  '- Qualsiasi acqua minerale, birra, liquore, succo, vino fermo -> NON champagne\n\n' +

  '=== REGOLA #3: campo cuvee ===\n' +
  'Il campo "cuvee" deve contenere il nome COMPLETO con denominazioni speciali, SENZA nome maison e SENZA annata.\n' +
  '- Dom Perignon P2/Deuxieme Plenitude -> cuvee: "P2"\n' +
  '- Dom Perignon P3 -> cuvee: "P3"\n' +
  '- Bollinger R.D. -> cuvee: "R.D."\n' +
  '- Krug Grande Cuvee -> cuvee: "Grande Cuvee"\n' +
  '- Taittinger Comtes de Champagne -> cuvee: "Comtes de Champagne"\n' +
  '- Perrier-Jouet Belle Epoque -> cuvee: "Belle Epoque"\n\n' +
  '=== REGOLA ASSOLUTA #4: LEGGERE IL NOME MAISON CON PRECISIONE ASSOLUTA ===\n' +
  'Leggi il nome del produttore LETTERA PER LETTERA dall etichetta. Non confondere mai:\n' +
  '- "Henri GIRAUD" (Ay Grand Cru, bottiglia scura, MV series) ≠ "HENRIOT" (Reims, etichetta bianca)\n' +
  '- "Perrier-JOUET" (Belle Epoque) ≠ "Laurent-PERRIER" (Tours-sur-Marne)\n' +
  '- "GOSSET" ≠ "GONET" ≠ "GOSSE"\n' +
  '- "BILLECART-SALMON" ≠ altri nomi simili\n' +
  '- "BOLLINGER" ≠ "BOLIEU" ≠ altri\n' +
  'Se l etichetta dice "HENRI GIRAUD" -> maison: "Henri Giraud". MAI "Henriot".\n' +
  'In caso di dubbio sul nome esatto, rileggi l etichetta prima di rispondere.\n\n' +
  'Per campi tecnici usa la tua conoscenza enciclopedica anche se non visibili sull etichetta.'

const USER_PROMPT =
  'Analizza questa immagine con la massima precisione.\n\n' +
  'STEP 1 - PRIMA DI TUTTO: l immagine mostra una bottiglia o contenitore di bevanda?\n' +
  'Se NO (persona, cibo, oggetto, parte del corpo, ecc.) -> rispondi solo: {"is_bottle":false,"is_champagne":false,"confidence":0}\n\n' +
  'STEP 2 - Solo se is_bottle=true: segui la catena decisionale champagne dal system prompt.\n\n' +
  'STEP 3 - Se is_champagne=true, usa tutta la tua conoscenza enciclopedica:\n' +
  '1. "cuvee": COMPLETO con denominazioni speciali (P2, P3, R.D., Belle Epoque, Rose, Blanc de Blancs) SENZA maison e SENZA annata\n' +
  '2. Per uvaggio: usa conoscenza enciclopedica della maison/cuvee\n' +
  '3. maturazione_mesi: P2=144, P3=216, R.D.=180, Dom Perignon=84, Cristal=72, Krug GC=72, NM standard=36\n' +
  '4. punteggio Parker/RVF: P2=98, Dom Perignon=96, Cristal=95, Krug GC=95, NM Brut grande maison=87-89\n' +
  '5. assemblaggio: per NV indica le annate dei vins de base con % e i vins de reserve con %. Per millesimati lascia null.\n' +
  '6. PREZZO (campo critico - sii preciso): indica il prezzo REALE di vendita al dettaglio in Italia (enoteca/online italiano,\n' +
  '   bottiglia 75cl). USA questi riferimenti precisi di mercato italiano 2025-2026:\n' +
  '   - NM entry (Moët Brut, Veuve Clicquot Yellow, Mumm Cordon Rouge): 38-50€\n' +
  '   - NM premium (Bollinger Special Cuvée, Pol Roger Brut, Taittinger Brut): 50-70€\n' +
  '   - Rosé NM grande maison: 55-80€\n' +
  '   - RM/RC artigiani noti (Egly-Ouriet, Selosse, Larmandier): 60-120€\n' +
  '   - Prestige NM (Dom Pérignon, Cristal, Belle Epoque, Comtes de Champagne): 150-250€\n' +
  '   - Prestige ultra (Krug GC, Dom Pérignon P2, Cristal Rosé): 200-400€\n' +
  '   - Icone (Salon, Krug Clos du Mesnil, Dom Pérignon P3): 400-900€\n' +
  '   NON usare prezzi francesi o UK. Arrotonda a multipli di 5€.\n\n' +
  'Rispondi SOLO con JSON valido, zero testo extra:\n' +
  '{\n' +
  '  "is_bottle": true se bottiglia/contenitore bevanda, false se altro,\n' +
  '  "is_champagne": boolean (segui catena decisionale obbligatoria),\n' +
  '  "confidence": 0-100,\n' +
  '  "maison": "nome produttore o null",\n' +
  '  "cuvee": "nome COMPLETO con denominazioni speciali SENZA maison e SENZA annata, o null",\n' +
  '  "annata": "anno stringa es 2018, o null se sans annee",\n' +
  '  "is_sa": true se sans annee/non-vintage, false se ha annata,\n' +
  '  "dosage": "Brut Nature" o "Extra Brut" o "Brut" o "Extra Sec" o "Sec" o "Demi-Sec" o "Doux" o null,\n' +
  '  "tipo": "blanc de blancs" o "blanc de noirs" o "rose" o "assemblage" o null,\n' +
  '  "prestige": true se cuvee prestige/tete de cuvee,\n' +
  '  "descrizione": "max 180 caratteri italiano tono elegante, o null",\n' +
  '  "punteggio": intero 0-100 scala Parker/RVF o null,\n' +
  '  "note_degustazione": "200-300 caratteri italiano: colore perlage profumi gusto, o null",\n' +
  '  "abbinamento": "2-3 abbinamenti gastronomici italiani separati da virgola, o null",\n' +
  '  "finestra_da": anno intero inizio finestra ottimale o null,\n' +
  '  "finestra_a": anno intero fine finestra o null,\n' +
  '  "pct_chardonnay": integer 0-100 o null,\n' +
  '  "pct_pinot_noir": integer 0-100 o null,\n' +
  '  "pct_meunier": integer 0-100 o null,\n' +
  '  "assemblaggio": array di oggetti per NV: [{"anno":2021,"perc":65},{"tipo":"riserva","perc":35}] oppure con label [{"tipo":"riserva","label":"reserve perpetuelle","perc":30}], null per millesimati,\n' +
  '  "provenienza_uve": "zona/village o null",\n' +
  '  "vinificazione": "breve descrizione o null",\n' +
  '  "malolattica": "completa" o "parziale" o "assente" o null,\n' +
  '  "maturazione_mesi": integer o null,\n' +
  '  "produzione_bottiglie": integer o null,\n' +
  '  "prezzo_min": integer prezzo minimo vendita dettaglio Italia 75cl in euro, arrotondato a 5, o null,\n' +
  '  "prezzo_max": integer prezzo massimo vendita dettaglio Italia 75cl in euro, arrotondato a 5, o null,\n' +
  '  "not_champagne_type": "tipo bevanda/prodotto se NOT champagne, o null"\n' +
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
      .select('is_premium, premium_until')
      .eq('id', user.id)
      .single()

    const isPremium = profile?.is_premium === true &&
      (!profile?.premium_until || new Date(profile.premium_until) > new Date())

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

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })
    const imgSource  = { type: 'base64' as const, media_type: media_type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: image_base64 }
    const _dbErrors: string[] = []

    // ── Token counters ───────────────────────────────────────────
    let haikuInTok  = 0  // quick-check haiku tokens
    let haikuOutTok = 0
    let sonnetInTok  = 0  // full-analysis sonnet tokens (0 if cache hit)
    let sonnetOutTok = 0

    // ════════════════════════════════════════════════════════════
    // STAGE 1 — Quick pre-check con Haiku (economico)
    //   Identifica solo maison+cuvee senza analisi completa.
    //   Se la bottiglia è già nel catalogo saltiamo Sonnet → risparmio 80-90% costi AI.
    // ════════════════════════════════════════════════════════════
    const QUICK_PROMPT =
      'Guarda questa immagine. Rispondi SOLO con JSON valido, zero testo extra:\n' +
      '{"is_bottle":true/false,"is_champagne":true/false,' +
      '"maison":"nome produttore o null","cuvee":"nome cuvee SENZA maison e SENZA annata o null",' +
      '"annata":"anno es.2018 o null","is_sa":true/false,' +
      '"confidence":0-100,"not_champagne_type":"tipo se non champagne o null"}'

    let quick: Record<string, unknown> = { is_bottle: true, is_champagne: false, confidence: 0 }
    try {
      const qMsg = await anthropic.messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 250,
        messages: [{ role: 'user', content: [
          { type: 'image', source: imgSource },
          { type: 'text',  text: QUICK_PROMPT },
        ]}],
      })
      // Traccia token usage haiku quick-check
      haikuInTok  = qMsg.usage?.input_tokens  ?? 0
      haikuOutTok = qMsg.usage?.output_tokens ?? 0

      const qText = qMsg.content[0].type === 'text' ? qMsg.content[0].text : ''
      const m = qText.match(/\{[\s\S]*\}/)
      if (m) quick = JSON.parse(m[0])
    } catch(e) {
      console.error('quick-check error:', e)
      // Se Haiku fallisce procediamo direttamente con Sonnet (nessun risparmio ma nessuna perdita)
    }

    // ════════════════════════════════════════════════════════════
    // STAGE 2 — Ricerca nel catalogo con dati quick-check
    // ════════════════════════════════════════════════════════════
    let matchedBottle: Record<string, unknown> | null = null
    let bottleHasPhoto = false

    if (quick.is_champagne && quick.maison && quick.cuvee) {
      const qMaison = norm(quick.maison as string)
      const qCuvee  = norm(quick.cuvee  as string)

      const { data: bottles } = await adminSupa
        .from('bottiglie')
        .select('id, nome, tipo, dosaggio_tipo, dosaggio_gl, annata, is_millesimato, foto_url, prezzo_min, prezzo_max, fascia_prezzo, score_medio, note_degustazione, abbinamento, finestra_da, finestra_a, pct_chardonnay, pct_pinot_noir, pct_meunier, provenienza_uve, vinificazione, malolattica, maturazione_mesi, produzione_bottiglie, maison(id, nome, slug)')
        .eq('is_published', true)
        .eq('needs_review', false)

      if (bottles) {
        const found = (bottles as any[]).find(b => {
          const bNome   = norm(b.nome || '')
          const bMaison = norm(b.maison?.nome || '')
          return (bMaison.includes(qMaison) || qMaison.includes(bMaison)) &&
                 (bNome.includes(qCuvee)    || qCuvee.includes(bNome))
        })
        if (found) { matchedBottle = found; bottleHasPhoto = !!found.foto_url }
      }
    }

    // ════════════════════════════════════════════════════════════
    // STAGE 3a — DB HIT: bottiglia già nel catalogo
    //   → scan_type = 'haiku_only', costo = solo haiku quick-check
    //   → Nessuna chiamata a Sonnet: risparmio garantito!
    // ════════════════════════════════════════════════════════════
    if (matchedBottle) {
      // Upload foto se la bottiglia non ne ha ancora una
      let uploadedPhotoUrl: string | null = null
      const mb = matchedBottle as any

      if (!bottleHasPhoto && image_base64) {
        try {
          const { data: buckets } = await adminSupa.storage.listBuckets()
          const bucketExists = (buckets || []).some((b: any) => b.name === 'champagne-photos')
          if (!bucketExists) {
            await adminSupa.storage.createBucket('champagne-photos', { public: true })
          }
          const imageBytes  = Uint8Array.from(atob(image_base64), c => c.charCodeAt(0))
          const storagePath = 'bottles/' + mb.id + '.jpg'
          const { error: uploadErr } = await adminSupa.storage
            .from('champagne-photos')
            .upload(storagePath, imageBytes, { contentType: 'image/jpeg', upsert: true })
          if (!uploadErr) {
            const { data: urlData } = adminSupa.storage.from('champagne-photos').getPublicUrl(storagePath)
            uploadedPhotoUrl = urlData.publicUrl
            await adminSupa.from('bottiglie').update({ foto_url: uploadedPhotoUrl }).eq('id', mb.id)
          } else {
            console.error('photo upload (cache hit):', JSON.stringify(uploadErr))
          }
        } catch(e) { console.error('photo exception (cache hit):', e) }
      }

      // Costo: solo haiku quick-check
      const costUsd = parseFloat(
        (haikuInTok * PRICE_HAIKU_IN + haikuOutTok * PRICE_HAIKU_OUT).toFixed(6)
      )

      // Salva record scansione con tracking completo
      const { data: scan } = await userSupa
        .from('bottle_scans')
        .insert({
          user_id:              user.id,
          is_champagne:         true,
          detected_maison:      quick.maison ?? null,
          detected_cuvee:       quick.cuvee  ?? null,
          detected_annata:      quick.annata ?? null,
          detected_dosage:      mb.dosaggio_tipo ?? null,
          detected_tipo:        mb.tipo ?? null,
          confidence:           quick.confidence ?? 0,
          matched_bottle_id:    mb.id,
          new_bottle_id:        null,
          result_json:          { ...quick, from_cache: true },
          // ── Tracking costi ──
          scan_type:            'haiku_only',
          haiku_input_tokens:   haikuInTok,
          haiku_output_tokens:  haikuOutTok,
          sonnet_input_tokens:  null,
          sonnet_output_tokens: null,
          cost_usd:             costUsd,
        })
        .select('id')
        .single()

      // Risposta identica alla scansione reale — l'utente non vede differenza
      return json({
        scan_id:            scan?.id,
        is_bottle:          true,
        is_champagne:       true,
        confidence:         quick.confidence ?? 90,
        not_champagne_type: null,
        maison:             quick.maison  ?? mb.maison?.nome ?? null,
        cuvee:              quick.cuvee   ?? mb.nome ?? null,
        annata:             quick.annata  ?? mb.annata ?? null,
        is_sa:              quick.is_sa   ?? !mb.is_millesimato,
        dosage:             mb.dosaggio_tipo ?? null,
        tipo:               mb.tipo ?? null,
        prestige:           false,
        is_in_catalog:      true,
        matched_bottle:     matchedBottle,
        matched_bottle_id:  mb.id,
        new_bottle_id:      null,
        bottle_has_photo:   bottleHasPhoto,
        uploaded_photo_url: uploadedPhotoUrl,
        from_cache:         true,
        // Dati tecnici dal catalogo
        score_medio:          mb.score_medio          ?? null,
        note_degustazione:    mb.note_degustazione     ?? null,
        abbinamento:          mb.abbinamento           ?? null,
        finestra_da:          mb.finestra_da           ?? null,
        finestra_a:           mb.finestra_a            ?? null,
        pct_chardonnay:       mb.pct_chardonnay        ?? null,
        pct_pinot_noir:       mb.pct_pinot_noir        ?? null,
        pct_meunier:          mb.pct_meunier           ?? null,
        provenienza_uve:      mb.provenienza_uve       ?? null,
        vinificazione:        mb.vinificazione         ?? null,
        malolattica:          mb.malolattica           ?? null,
        maturazione_mesi:     mb.maturazione_mesi      ?? null,
        produzione_bottiglie: mb.produzione_bottiglie  ?? null,
        dosaggio_gl:          mb.dosaggio_gl           ?? null,
      })
    }

    // ════════════════════════════════════════════════════════════
    // STAGE 3b — DB MISS: bottiglia non in catalogo
    //   → Analisi completa con Sonnet (scan_type = 'sonnet_full')
    //   → Fallback a Haiku se Sonnet non disponibile (scan_type = 'haiku_fallback')
    // ════════════════════════════════════════════════════════════
    let rawText = ''
    const scanType = 'sonnet_full'

    // ── Sonnet full analysis — nessun fallback silenzioso a Haiku ──
    // Se Sonnet fallisce, la scansione fallisce con errore esplicito.
    // Meglio un errore visibile che un'analisi degradata di nascosto.
    try {
      const aiMsg = await anthropic.messages.create({
        model:      'claude-sonnet-4-6',
        max_tokens: 2000,
        system:     SYSTEM_PROMPT,
        messages: [{ role: 'user', content: [
          { type: 'image', source: imgSource },
          { type: 'text',  text: USER_PROMPT },
        ]}],
      })
      sonnetInTok  = aiMsg.usage?.input_tokens  ?? 0
      sonnetOutTok = aiMsg.usage?.output_tokens ?? 0
      rawText = aiMsg.content[0].type === 'text' ? aiMsg.content[0].text : ''
    } catch (aiErr: any) {
      console.error('Sonnet error:', JSON.stringify(aiErr))
      return json({
        error: 'Analisi non disponibile al momento, riprova tra qualche istante.',
        error_detail: aiErr?.message || String(aiErr),
      }, 503)
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

    // ── Auto-aggiunta al catalogo (Champagne non trovato) ────────
    let newBottleId: string | null = null

    // ── Secondo controllo DB con i dati accurati di Sonnet ──────
    // Il quick-check Haiku può sbagliare il nome maison (es. "Henriot" invece di "Henri Giraud").
    // Dopo Sonnet rifacciamo la ricerca con il nome corretto prima di creare una bottiglia nuova.
    if (ai.is_champagne && ai.maison && ai.cuvee) {
      const sMaison = norm(ai.maison as string)
      const sCuvee  = norm(ai.cuvee  as string)
      const { data: allBottles2 } = await adminSupa
        .from('bottiglie')
        .select('id, nome, tipo, dosaggio_tipo, dosaggio_gl, annata, is_millesimato, foto_url, prezzo_min, prezzo_max, fascia_prezzo, score_medio, note_degustazione, abbinamento, finestra_da, finestra_a, pct_chardonnay, pct_pinot_noir, pct_meunier, provenienza_uve, vinificazione, malolattica, maturazione_mesi, produzione_bottiglie, assemblaggio, maison(id, nome, slug)')
        .eq('is_published', true)
        .eq('needs_review', false)
      if (allBottles2) {
        const found2 = (allBottles2 as any[]).find(b => {
          const bNome   = norm(b.nome || '')
          const bMaison = norm(b.maison?.nome || '')
          return (bMaison.includes(sMaison) || sMaison.includes(bMaison)) &&
                 (bNome.includes(sCuvee)    || sCuvee.includes(bNome))
        })
        if (found2) {
          // Trovata! Sonnet ha corretto Haiku — restituiamo come cache hit
          const mb2 = found2 as any
          const costUsd2 = parseFloat((
            haikuInTok * PRICE_HAIKU_IN + haikuOutTok * PRICE_HAIKU_OUT +
            sonnetInTok * PRICE_SONNET_IN + sonnetOutTok * PRICE_SONNET_OUT
          ).toFixed(6))
          await userSupa.from('bottle_scans').insert({
            user_id: user.id, is_champagne: true,
            detected_maison: ai.maison ?? null, detected_cuvee: ai.cuvee ?? null,
            detected_annata: ai.annata ?? null, detected_dosage: mb2.dosaggio_tipo ?? null,
            detected_tipo: mb2.tipo ?? null, confidence: (ai.confidence as number) ?? 0,
            matched_bottle_id: mb2.id, new_bottle_id: null,
            result_json: { ...ai, from_cache: true, sonnet_corrected_haiku: true },
            scan_type: 'sonnet_corrected',
            haiku_input_tokens: haikuInTok, haiku_output_tokens: haikuOutTok,
            sonnet_input_tokens: sonnetInTok, sonnet_output_tokens: sonnetOutTok,
            cost_usd: costUsd2,
          })
          return json({
            scan_id: null, is_bottle: true, is_champagne: true,
            confidence: ai.confidence ?? 90, not_champagne_type: null,
            maison: ai.maison ?? mb2.maison?.nome ?? null,
            cuvee:  ai.cuvee  ?? mb2.nome ?? null,
            annata: ai.annata ?? mb2.annata ?? null,
            is_sa:  ai.is_sa  ?? !mb2.is_millesimato,
            dosage: mb2.dosaggio_tipo ?? null, tipo: mb2.tipo ?? null,
            prestige: ai.prestige ?? false, is_in_catalog: true,
            matched_bottle: found2, matched_bottle_id: mb2.id, new_bottle_id: null,
            bottle_has_photo: !!mb2.foto_url, uploaded_photo_url: null, from_cache: true,
            score_medio: mb2.score_medio ?? null, note_degustazione: mb2.note_degustazione ?? null,
            abbinamento: mb2.abbinamento ?? null, finestra_da: mb2.finestra_da ?? null,
            finestra_a: mb2.finestra_a ?? null, pct_chardonnay: mb2.pct_chardonnay ?? null,
            pct_pinot_noir: mb2.pct_pinot_noir ?? null, pct_meunier: mb2.pct_meunier ?? null,
            provenienza_uve: mb2.provenienza_uve ?? null, vinificazione: mb2.vinificazione ?? null,
            malolattica: mb2.malolattica ?? null, maturazione_mesi: mb2.maturazione_mesi ?? null,
            produzione_bottiglie: mb2.produzione_bottiglie ?? null, dosaggio_gl: mb2.dosaggio_gl ?? null,
            assemblaggio: mb2.assemblaggio ?? null,
            prezzo_min: mb2.prezzo_min ?? null, prezzo_max: mb2.prezzo_max ?? null,
            fascia_prezzo: mb2.fascia_prezzo ?? fasciaFromPrezzo(mb2.prezzo_min ?? null),
          })
        }
      }
    }

    // ── Auto-aggiunta al catalogo (bottiglia genuinamente nuova) ─
    if (ai.is_champagne && ai.maison && ai.cuvee) {
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
            is_millesimato:       !(ai.is_sa ?? true),
            dosaggio_tipo:        ai.dosage ?? null,
            tipo:                 ai.tipo ? (ai.tipo as string).replace(/ /g, '_') : null,
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
            assemblaggio:         ai.assemblaggio ?? null,
            prezzo_min:           ai.prezzo_min ?? null,
            prezzo_max:           ai.prezzo_max ?? null,
            fascia_prezzo:        fasciaFromPrezzo((ai.prezzo_min as number | null) ?? null),
            source:               'scan',
            is_published:         true,
            needs_review:         true,
          })
          .select('id')
          .single()

        if (bottErr) {
          console.error('bottiglie insert error:', JSON.stringify(bottErr))
          _dbErrors.push('bottiglie: ' + bottErr.message)
          const { data: nb2, error: bottErr2 } = await adminSupa
            .from('bottiglie')
            .insert({
              nome:           ai.cuvee,
              slug:           bottleSlug + '-' + Date.now(),
              maison_id:      maisonId,
              annata:         ai.is_sa ? null : (ai.annata ?? null),
              is_millesimato: !(ai.is_sa ?? true),
              dosaggio_tipo:  ai.dosage ?? null,
              tipo:           ai.tipo ? (ai.tipo as string).replace(/ /g, '_') : null,
              score_medio:    ai.punteggio ?? null,
              source:         'scan',
              is_published:   true,
              needs_review:   true,
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

    // ── Upload foto (bottiglia nuova) ────────────────────────────
    let uploadedPhotoUrl: string | null = null
    const bottleId = newBottleId

    if (ai.is_champagne && bottleId && image_base64) {
      try {
        const { data: buckets } = await adminSupa.storage.listBuckets()
        const bucketExists = (buckets || []).some((b: any) => b.name === 'champagne-photos')
        if (!bucketExists) {
          await adminSupa.storage.createBucket('champagne-photos', { public: true })
        }
        const imageBytes  = Uint8Array.from(atob(image_base64), c => c.charCodeAt(0))
        const storagePath = 'bottles/' + bottleId + '.jpg'
        const { error: uploadErr } = await adminSupa.storage
          .from('champagne-photos')
          .upload(storagePath, imageBytes, { contentType: 'image/jpeg', upsert: true })
        if (uploadErr) {
          console.error('storage upload error:', JSON.stringify(uploadErr))
          _dbErrors.push('storage: ' + uploadErr.message)
        } else {
          const { data: urlData } = adminSupa.storage.from('champagne-photos').getPublicUrl(storagePath)
          uploadedPhotoUrl = urlData.publicUrl
          const { error: updateErr } = await adminSupa
            .from('bottiglie').update({ foto_url: uploadedPhotoUrl }).eq('id', bottleId)
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

    // ── Costo totale scansione completa ──────────────────────────
    const costUsd = parseFloat((
      haikuInTok  * PRICE_HAIKU_IN  + haikuOutTok  * PRICE_HAIKU_OUT +
      sonnetInTok * PRICE_SONNET_IN + sonnetOutTok * PRICE_SONNET_OUT
    ).toFixed(6))

    // ── Salva record scansione con tracking completo ─────────────
    const { data: scan } = await userSupa
      .from('bottle_scans')
      .insert({
        user_id:            user.id,
        is_champagne:       ai.is_champagne ?? false,
        detected_maison:    ai.maison ?? null,
        detected_cuvee:     ai.cuvee  ?? null,
        detected_annata:    ai.annata ?? null,
        detected_dosage:    ai.dosage ?? null,
        detected_tipo:      ai.tipo   ?? null,
        confidence:         ai.confidence ?? 0,
        not_champagne_type: ai.not_champagne_type ?? null,
        matched_bottle_id:  null,
        new_bottle_id:      newBottleId,
        result_json:        { ...ai, from_cache: false },
        // ── Tracking costi ──
        scan_type:            scanType,
        haiku_input_tokens:   haikuInTok,
        haiku_output_tokens:  haikuOutTok,
        sonnet_input_tokens:  sonnetInTok  > 0 ? sonnetInTok  : null,
        sonnet_output_tokens: sonnetOutTok > 0 ? sonnetOutTok : null,
        cost_usd:             costUsd,
      })
      .select('id')
      .single()

    // ── Enriched data: prefer catalog, fallback to AI ────────────
    const enriched = {
      score_medio:          (ai.punteggio as number | null) ?? null,
      note_degustazione:    ai.note_degustazione    ?? null,
      abbinamento:          ai.abbinamento          ?? null,
      finestra_da:          ai.finestra_da          ?? null,
      finestra_a:           ai.finestra_a           ?? null,
      pct_chardonnay:       ai.pct_chardonnay       ?? null,
      pct_pinot_noir:       ai.pct_pinot_noir       ?? null,
      pct_meunier:          ai.pct_meunier          ?? null,
      provenienza_uve:      ai.provenienza_uve      ?? null,
      vinificazione:        ai.vinificazione        ?? null,
      malolattica:          ai.malolattica          ?? null,
      maturazione_mesi:     ai.maturazione_mesi     ?? null,
      produzione_bottiglie: ai.produzione_bottiglie ?? null,
      dosaggio_gl:          null,
      assemblaggio:         ai.assemblaggio         ?? null,
      prezzo_min:           (ai.prezzo_min as number | null) ?? null,
      prezzo_max:           (ai.prezzo_max as number | null) ?? null,
      fascia_prezzo:        fasciaFromPrezzo((ai.prezzo_min as number | null) ?? null),
    }

    // ── Risposta ─────────────────────────────────────────────────
    return json({
      scan_id:            scan?.id,
      is_bottle:          ai.is_bottle ?? true,
      is_champagne:       ai.is_champagne,
      confidence:         ai.confidence,
      not_champagne_type: ai.not_champagne_type,
      maison:             ai.maison,
      cuvee:              ai.cuvee,
      annata:             ai.annata,
      is_sa:              ai.is_sa ?? true,
      dosage:             ai.dosage,
      tipo:               ai.tipo,
      prestige:           ai.prestige,
      is_in_catalog:      false,
      matched_bottle:     null,
      matched_bottle_id:  null,
      new_bottle_id:      newBottleId,
      bottle_has_photo:   false,
      uploaded_photo_url: uploadedPhotoUrl,
      from_cache:         false,
      _debug:             _dbErrors.length ? _dbErrors : undefined,
      ...enriched,
    })

  } catch (err) {
    console.error('analyze-bottle error:', err)
    return json({ error: 'Errore interno: ' + String(err) }, 500)
  }
})
