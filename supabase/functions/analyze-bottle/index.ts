import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk@0.39.0'

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

// norm: converte accenti (é→e, è→e, à→a, ç→c …) poi rimuove non-alfanumerici
// Senza questo, 'Frères' → 'frres' e 'Freres' → 'freres' non si trovavano mai
const norm = (s: string) => (s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')   // rimuove segni diacritici: é→e, è→e, à→a, ç→c…
  .replace(/[^a-z0-9]/g, '')         // rimuove spazi, trattini, apostrofi ecc.

// Parole significative per maison (norm intera prima — più sicuro contro falsi positivi)
// es. 'Henri Giraud' → 'henrigiraud' (1 token): evita che 'Henriot' ⊃ 'henri' faccia match
const STOP = new Set(['de','du','des','le','la','les','et','en','au','aux','sur','un','une'])
const sigWords = (s: string): string[] =>
  (norm(s).match(/[a-z0-9]{2,}/g) || []).filter(w => !STOP.has(w))

// Match maison: prima strict (includes), poi word-overlap come fallback
const maisonMatch = (db: string, ai: string): boolean => {
  const dbn = norm(db), ain = norm(ai)
  if (!dbn || !ain) return false
  if (dbn.includes(ain) || ain.includes(dbn)) return true
  const dbW = sigWords(db), aiW = sigWords(ai)
  const [shorter, longer] = dbW.length <= aiW.length ? [dbW, aiW] : [aiW, dbW]
  if (shorter.length === 0) return false
  return shorter.every(w => longer.some(lw => lw.includes(w) || w.includes(lw)))
}

// Parole significative per cuvée — esclude termini generici champagne
// 'cuvee' è incluso apposta: da solo non basta a distinguere una bottiglia
// (es. "La Cuvée" non deve matchare "Alexandra Grande Cuvée Rosé" solo perché
// condividono quella parola).
const STOP_C = new Set([
  'de','du','des','le','la','les','et','en','au','aux','sur','un','une',
  'brut','extra','champagne','blanc','noirs','blancs','rose','nature','sec','demi','grand','cru',
  'cuvee'
])
const cuveeWords = (s: string): string[] =>
  ((s || '').match(/[a-zA-ZÀ-ÿ0-9]+/g) || [])
    .map(w => norm(w))
    .filter(w => w.length >= 2 && !STOP_C.has(w))

// Match cuvée: prima substring intera, poi word-level overlap
// Gestisce: 'MV20' ↔ 'Mémoire de Vignes 20', 'R.D.' ↔ 'RD', ecc.
const cuveeMatch = (db: string, ai: string): boolean => {
  const dbn = norm(db), ain = norm(ai)
  if (!dbn || !ain) return false
  // 1. Inclusione stringa intera (bidirezionale)
  if (dbn.includes(ain) || ain.includes(dbn)) return true
  // 2. Word-level overlap: ogni parola significativa del termine più corto
  //    deve apparire come sottostringa in almeno una parola dell'altro termine
  const dbW = cuveeWords(db), aiW = cuveeWords(ai)
  if (dbW.length === 0 || aiW.length === 0) return false
  const [shorter, longer] = dbW.length <= aiW.length ? [dbW, aiW] : [aiW, dbW]
  return shorter.every(w => longer.some(lw => lw.includes(w) || w.includes(lw)))
}

// Match esatto sul nome cuvée (solo inclusione stringa intera, nessun word-overlap).
// Usato per dare sempre priorità a un match certo quando ne esiste uno tra i candidati.
const cuveeExactMatch = (db: string, ai: string): boolean => {
  const dbn = norm(db), ain = norm(ai)
  if (!dbn || !ain) return false
  return dbn === ain || dbn.includes(ain) || ain.includes(dbn)
}

// "Rosé" è un discriminante assoluto, non un dettaglio stilistico: "Cristal" e
// "Cristal Rosé" (o Dom Pérignon/Dom Pérignon Rosé, Comtes de Champagne/Comtes
// de Champagne Rosé, ecc.) sono bottiglie diverse a tutti gli effetti, ma il
// confronto testuale le vedrebbe combaciare (il nome base è contenuto in
// quello con Rosé) — trattata come annata/millesimato: se non coincide, mai match.
const isRose = (s: string): boolean => /rose/.test(norm(s))

// Numero di edizione/collection/cuvée presente nel nome (es. "Grande Cuvée 173ème Édition" -> "173",
// "Grand Siècle N°26" -> "26", "Collection 244" -> "244"). null se il nome non ha un'edizione esplicita:
// un numero qualsiasi (annata, MV20, P2) NON conta, serve un riferimento di edizione vero.
const editionKey = (s: string): string | null => {
  const t = (s || '').normalize('NFC').toLowerCase()
  const m = t.match(/(?:n\s*[°º]\s*|collection\s*|[ée]dition\s*(?:n\s*[°º]\s*)?)(\d{1,4})/)
    || t.match(/(\d{1,4})\s*(?:[èe]me\b|[èe]?\s*[ée]dition)/)
  return m ? m[1] : null
}

// Trova un match SICURO nel catalogo — non indovina mai tra più candidati validi.
// Regola: se esiste un solo match esatto, vince sempre quello anche se altri
// candidati soddisfano solo il confronto approssimativo. Se ci sono più match
// esatti, o nessun esatto e più di un match approssimativo, il risultato è
// ambiguo → ritorna null piuttosto che scegliere a caso (meglio "non trovata"
// che "trovata quella sbagliata").
const findConfidentMatch = (
  bottles: any[],
  maisonName: string,
  cuveeName: string,
  annata: unknown,
  isSa: unknown
): any | null => {
  const candidates = bottles.filter(b => {
    const maisonNome = b.maison?.nome ?? b.nome_maison ?? ''
    if (!maisonMatch(maisonNome, maisonName)) return false
    if (!cuveeMatch(b.nome || '', cuveeName)) return false
    // Rosé è un discriminante assoluto: mai confondere la versione base con la Rosé
    if (isRose(b.nome || '') !== isRose(cuveeName)) return false
    // Edizione numerata (es. Krug 173ème Édition): il numero identifica la bottiglia in modo univoco.
    // Nel catalogo è millesimato (annata base nota) ma l'etichetta non riporta nessuna annata, quindi
    // la scansione dice "sans année": le guardie annata/sans année non devono scartarla.
    const dbEd = editionKey(b.nome || '')
    const sameEdition = !!dbEd && dbEd === editionKey(cuveeName)
    // DB ha un'annata specifica e la scansione pure: devono coincidere
    if (!sameEdition && b.is_millesimato && b.annata && annata) {
      if (String(b.annata) !== String(annata)) return false
    }
    // DB è sans-année ma la scansione rileva un'annata specifica → no match
    if (!b.is_millesimato && !isSa && annata) return false
    // DB è millesimato ma la scansione dice chiaramente sans-année → no match
    // (guardia simmetrica, prima mancante: evitava match errati solo in un verso)
    if (b.is_millesimato && isSa && !sameEdition) return false
    return true
  })

  if (candidates.length === 0) return null

  const exact = candidates.filter(b => cuveeExactMatch(b.nome || '', cuveeName))
  if (exact.length === 1) return exact[0]
  if (exact.length > 1) return null // ambiguo anche tra match esatti: non indovinare

  // Nessun match esatto: un solo candidato approssimativo è accettabile,
  // più di uno significa che non siamo sicuri di quale sia quello giusto.
  if (candidates.length === 1) return candidates[0]
  return null
}

// Controlli deterministici sul risultato dell'AI: non ci si affida solo al fatto che il modello
// obbedisca al prompt. Annate solo dove hanno senso, percentuali coerenti, altrimenti null.
const toNum = (v: unknown): number | null => {
  if (typeof v === 'number' && isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && isFinite(Number(v))) return Number(v)
  return null
}
// La ricerca web lascia nei testi dei segnaposto <cite index="...">: vanno tolti prima di salvare
const stripCite = (v: unknown): unknown => {
  if (typeof v === 'string') return v.replace(/<\/?cite[^>]*>/gi, '').replace(/\s{2,}/g, ' ').trim()
  if (Array.isArray(v)) return v.map(stripCite)
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, stripCite(x)]))
  return v
}
const sanitizeAi = (aiIn: Record<string, unknown>): Record<string, unknown> => {
  const ai = stripCite(aiIn) as Record<string, unknown>
  const isEdition = ai.edizione_numerata === true
  if (isEdition) ai.is_sa = false

  // ── prezzo e punteggio: SOLO da valori realmente trovati (liste con fonte); il calcolo lo fa il codice, mai il modello ──
  const prezziRaw = (Array.isArray(ai.prezzi_trovati) ? ai.prezzi_trovati as any[] : [])
    .map(x => toNum(x?.prezzo)).filter((v): v is number => v !== null && v >= 8 && v <= 20000)
  // Un prezzo è attendibile se almeno un altro negozio è entro il ±25%; i valori isolati (magnum, altra annata,
  // errori) si scartano. Un solo prezzo trovato in assoluto si tiene (è un prezzo realmente visto).
  let prezzi: number[] = []
  if (prezziRaw.length === 1) prezzi = prezziRaw
  else {
    for (const v of prezziRaw) {
      const g = prezziRaw.filter(x => x >= v * 0.8 && x <= v * 1.25)
      if (g.length > prezzi.length) prezzi = g
    }
    if (prezzi.length < 2) prezzi = []
  }
  const r5 = (v: number) => Math.round(v / 5) * 5
  ai.prezzo_min = prezzi.length ? r5(Math.min(...prezzi)) : null
  ai.prezzo_max = prezzi.length ? r5(Math.max(...prezzi)) : null
  if (ai.prezzo_max === ai.prezzo_min) ai.prezzo_max = null   // un solo prezzo: l'app lo mostra come "da X €", non "X–X"
  const punti = (Array.isArray(ai.punteggi_trovati) ? ai.punteggi_trovati as any[] : [])
    .map(x => ({ fonte: String(x?.fonte ?? '').trim(), p: toNum(x?.punteggio) }))
    .filter((x): x is { fonte: string; p: number } => x.fonte !== '' && x.p !== null && x.p >= 70 && x.p <= 100)
  // Punteggio = media di tutti i punteggi su scala 100 trovati (critici, guide, community). Con 3 o più valori si
  // scartano quelli a più di 5 punti dalla mediana (voti gonfiati o riferiti ad altre annate).
  let puntiOk = punti
  if (punti.length >= 3) {
    const ord = punti.map(x => x.p).sort((a, b) => a - b)
    const med = ord[Math.floor(ord.length / 2)]
    puntiOk = punti.filter(x => Math.abs(x.p - med) <= 5)
  }
  ai.punteggio = puntiOk.length ? Math.round(puntiOk.reduce((t, x) => t + x.p, 0) / puntiOk.length) : null
  ai.score_note = puntiOk.length ? puntiOk.map(x => x.fonte + ' ' + x.p).join(', ') : null

  // ── dosaggio: il tipo (letto in etichetta) prevale; i g/l incoerenti col tipo non sono un dato certo ──
  const DOS: Record<string, [number, number]> = { 'brut nature': [0, 3], 'extra brut': [0, 6], 'brut': [0, 12], 'extra sec': [12, 17], 'extra dry': [12, 17], 'sec': [17, 32], 'demi-sec': [32, 50], 'demi sec': [32, 50], 'doux': [50, 300] }
  const dRange = typeof ai.dosage === 'string' ? DOS[(ai.dosage as string).trim().toLowerCase()] : undefined
  const dGl = toNum(ai.dosaggio_gl)
  if (dRange && dGl !== null && (dGl < dRange[0] || dGl > dRange[1])) ai.dosaggio_gl = null

  // ── assemblaggio ──
  let items: Array<Record<string, unknown>> | null = null
  if (Array.isArray(ai.assemblaggio)) {
    items = (ai.assemblaggio as any[])
      .filter(i => i && typeof i === 'object')
      .map(i => ({ ...i, perc: toNum(i.perc) }))
      .filter(i => i.perc !== null && (i.perc as number) > 0 && (i.perc as number) <= 100)
    if (!items.length) items = null
  }
  // l'assemblaggio descrive annate e riserve, mai vitigni o villaggi (quelli hanno i loro campi)
  if (items && items.some(i => 'uva' in i || 'vitigno' in i || 'provenienza' in i || 'cru' in i || 'villaggio' in i)) items = null
  if (items) {
    const total = items.reduce((t, i) => t + (i.perc as number), 0)
    if (total < 98 || total > 102) items = null // incoerente: non è un dato certo
  }
  // millesimato (non edizione numerata): l'assemblaggio è certo solo se tutte le voci sono l'annata della bottiglia;
  // "50% annata + 50% riserva" spesso è l'uvaggio (Chardonnay/Pinot) scambiato per assemblaggio
  if (items && !isEdition && ai.is_sa === false && ai.annata) {
    if (!items.every(i => String(i.anno ?? '') === String(ai.annata))) items = null
  }
  if (items) {
    const soloSA = !isEdition && ai.is_sa !== false
    if (soloSA) {
      // Sans Année non numerata: le annate cambiano ogni anno, nell'assemblaggio restano solo le percentuali
      const conAnno = items.filter(i => i.anno !== undefined && i.anno !== null && i.anno !== '')
      const altri = items.filter(i => !(i.anno !== undefined && i.anno !== null && i.anno !== ''))
      const out: Array<Record<string, unknown>> = []
      if (conAnno.length) out.push({ perc: conAnno.reduce((t, i) => t + (i.perc as number), 0) })
      for (const i of altri) { const { anno: _a, ...rest } = i; out.push(rest) }
      items = out
    }
  }
  // Millesimato (non edizione numerata): per disciplinare l'uvaggio è al 100% della vendemmia dichiarata
  if (!isEdition && ai.is_champagne === true && ai.is_sa === false && /^\d{4}$/.test(String(ai.annata ?? ''))) {
    items = [{ anno: Number(ai.annata), perc: 100 }]
  }
  ai.assemblaggio = items

  // Edizione numerata: annata prevalente derivata SOLO dall'assemblaggio già certo
  if (isEdition && !ai.annata && items) {
    const conAnno = items.filter(i => i.anno !== undefined && i.anno !== null && i.anno !== '')
    if (conAnno.length) {
      conAnno.sort((a, b) => (b.perc as number) - (a.perc as number))
      ai.annata = String(conAnno[0].anno)
    }
  }
  // Per le edizioni numerate il numero di edizione identifica la bottiglia: l'anno non va in coda al nome
  if (isEdition && ai.annata && typeof ai.cuvee === 'string') {
    ai.cuvee = (ai.cuvee as string).replace(new RegExp('\\s+' + String(ai.annata) + '\\s*$'), '')
  }
  // Edizione numerata SENZA annata base nota (es. riserva perpetua): si comporta da Sans Année, non da millesimato
  if (isEdition && !ai.annata) ai.is_sa = true
  if (ai.is_sa === true) ai.annata = null

  // ── percentuali uvaggio: se presenti devono sommare ~100, altrimenti non sono certe ──
  const pcts = ['pct_chardonnay', 'pct_pinot_noir', 'pct_meunier'].map(k => toNum(ai[k]))
  const presenti = pcts.filter((v): v is number => v !== null)
  const okRange = presenti.every(v => v >= 0 && v <= 100)
  const somma = presenti.reduce((t, v) => t + v, 0)
  if (presenti.length && (!okRange || somma < 98 || somma > 102)) {
    ai.pct_chardonnay = null; ai.pct_pinot_noir = null; ai.pct_meunier = null
  } else if (presenti.length && presenti.length < 3) {
    // uvaggio già completo (es. 100% Chardonnay, o 50/50): i vitigni non nominati sono 0, non "sconosciuti"
    for (const k of ['pct_chardonnay', 'pct_pinot_noir', 'pct_meunier']) if (toNum(ai[k]) === null) ai[k] = 0
  }
  return ai
}

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
const PRICE_WEB_SEARCH = 0.01                // $10 / 1000 ricerche

// ── Ricerca web nell'analisi delle bottiglie NON in catalogo ──────────────
// Unico percorso: Haiku 4.5 + 3 ricerche web (nessun Sonnet). Ogni ricerca costa 1 centesimo più i token delle pagine (~7-8 centesimi a scheda).
const WEB_SEARCH_MAX_USES = 3   // una per scopo: scheda tecnica, prezzi, punteggi
const RESEARCH_MODEL = 'claude-haiku-4-5-20251001'

const SYSTEM_PROMPT =
  'Sei un maestro sommelier con 30 anni di esperienza enologica internazionale, specializzato in Champagne ma con conoscenza enciclopedica di ogni vino del mondo: rossi, bianchi, rosati, fermi e spumanti, di qualsiasi produttore, denominazione o paese. ' +
  'Hai degustato migliaia di Champagne (maison, cuvee speciali, annate) e altrettanti vini di ogni altra regione, e conosci perfettamente vitigni, terroir, tecniche di vinificazione, invecchiamento, blend, dosaggi e stile di ogni produttore.\n\n' +

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
  'Il campo "cuvee" deve contenere il nome COMPLETO con denominazioni speciali, SENZA nome maison.\n' +
  'SE la bottiglia è millesimata (ha un annata specifica, is_sa=false): il nome cuvee DEVE terminare ' +
  'con l anno, esattamente come lo chiamerebbe un sommelier o come è scritto sul catalogo di riferimento ' +
  '— "Cristal 2013", non "Cristal". "Comtes de Champagne 2012", non "Comtes de Champagne". ' +
  '"Dom Perignon P2 2004", non solo "P2". L annata va comunque SEMPRE ripetuta anche nel campo separato "annata".\n' +
  'SE la bottiglia è Sans Année/non-vintage (is_sa=true): nessun anno nel nome, ovviamente.\n' +
  '- Dom Perignon P2/Deuxieme Plenitude, annata 2004 -> cuvee: "P2 2004"\n' +
  '- Dom Perignon P3, annata 2000 -> cuvee: "P3 2000"\n' +
  '- Bollinger R.D., annata 2007 -> cuvee: "R.D. 2007"\n' +
  '- Krug Grande Cuvee (Sans Année) -> cuvee: "Grande Cuvee" (nessun anno)\n' +
  '- Taittinger Comtes de Champagne, annata 2012 -> cuvee: "Comtes de Champagne 2012"\n' +
  '- Perrier-Jouet Belle Epoque, annata 2013 -> cuvee: "Belle Epoque 2013"\n' +
  '- Louis Roederer Cristal, annata 2013 -> cuvee: "Cristal 2013"\n\n' +
  '=== REGOLA ASSOLUTA #4: LEGGERE IL NOME MAISON CON PRECISIONE ASSOLUTA ===\n' +
  'Leggi il nome del produttore LETTERA PER LETTERA dall etichetta. Non confondere mai:\n' +
  '- "Henri GIRAUD" (Ay Grand Cru, bottiglia scura, MV series) ≠ "HENRIOT" (Reims, etichetta bianca)\n' +
  '- "Perrier-JOUET" (Belle Epoque) ≠ "Laurent-PERRIER" (Tours-sur-Marne)\n' +
  '- "GOSSET" ≠ "GONET" ≠ "GOSSE"\n' +
  '- "BILLECART-SALMON" ≠ altri nomi simili\n' +
  '- "BOLLINGER" ≠ "BOLIEU" ≠ altri\n' +
  'Se l etichetta dice "HENRI GIRAUD" -> maison: "Henri Giraud". MAI "Henriot".\n' +
  'In caso di dubbio sul nome esatto, rileggi l etichetta prima di rispondere.\n\n' +

  '=== REGOLA ASSOLUTA #5: PRODUTTORE NON VISIBILE SULL ETICHETTA ===\n' +
  'Molte cuvee di prestigio non riportano il nome del produttore in modo prominente ' +
  'sull etichetta frontale (a volte il produttore non compare affatto sul fronte). ' +
  'In questi casi NON lasciare maison vuoto o nullo, e non confondere mai il nome della ' +
  'cuvee stessa con quello del produttore: usa la tua conoscenza enciclopedica per risalire ' +
  'al vero produttore da cuvee/design bottiglia/capsula. Esempi che sbagliano spesso:\n' +
  '- "Cristal" (bottiglia trasparente, capsula gialla) -> maison: "Louis Roederer", MAI "Cristal"\n' +
  '- "Comtes de Champagne" -> maison: "Taittinger"\n' +
  '- "Belle Epoque" (bottiglia dipinta a fiori) -> maison: "Perrier-Jouet"\n' +
  '- "Grande Cuvee" / "Clos du Mesnil" / "Clos d Ambonnay" -> maison: "Krug"\n' +
  '- "Cuvee Sir Winston Churchill" -> maison: "Pol Roger"\n' +
  '- "La Grande Dame" -> maison: "Veuve Clicquot"\n' +
  '- "Cuvee William Deutz" -> maison: "Deutz"\n' +
  '- "N.P.U." -> maison: "Bruno Paillard"\n' +
  '- "Cuvee des Enchanteleurs" -> maison: "Piper-Heidsieck"\n' +
  '- "Amour de Deutz" -> maison: "Deutz"\n' +
  'Se dopo aver applicato questa regola resti genuinamente incerto su quale sia il produttore, ' +
  'e SOLO in quel caso, lascia maison null piuttosto che indovinare un nome sbagliato.\n\n' +

  '=== REGOLA ASSOLUTA #6: SCHEDA PRODUTTORE (maison_*) ===\n' +
  'Compila i campi maison_* SOLO se compaiono nello schema JSON della richiesta, e ognuno solo se lo sai con certezza assoluta ' +
  '(sede, anno di fondazione, proprietà, direzione, chef de cave, ettari, percentuali del vigneto, produzione, certificazioni, ' +
  'descrizione, filosofia). Per vigneron/RM poco noti la scheda può restare quasi vuota: è la risposta corretta, mai riempirla a memoria.\n\n' +

  '=== REGOLA ASSOLUTA #7: VERITÀ E CERTEZZA — MAI INVENTARE ===\n' +
  'Non hai accesso a internet: rispondi solo con ciò che sai con CERTEZZA ASSOLUTA per questa specifica bottiglia. ' +
  'È VIETATO inventare, stimare, dedurre "per stile" o "per fascia", o applicare valori tipici della maison o della denominazione a una cuvée specifica. ' +
  'Se non sei certo al 100% di un dato -> null. Vale per assemblaggio, percentuali di uvaggio, dosaggio, dosaggio_gl, maturazione_mesi, produzione_bottiglie, ' +
  'punteggio (solo se realmente pubblicato da una guida o un critico per QUELLA cuvée e annata), prezzi, finestra di degustazione e scheda produttore. ' +
  'Anche note_degustazione, abbinamento, vinificazione, descrizione e filosofia vanno scritti solo se conosci davvero la bottiglia o il produttore, senza dettagli specifici inventati. ' +
  'Con la ricerca web devi trovare e compilare tutti i campi principali (uvaggio, dosaggio, maturazione, prezzo, punteggio): null solo se dopo la ricerca nessuna fonte li riporta. ' +
  'Ciò che si legge sull etichetta (produttore, cuvee, annata, dosaggio, tipo, numero di edizione) è sempre un dato affidabile da riportare.\n\n' +

  '=== REGOLA ASSOLUTA #8: EDIZIONI NUMERATE, COLLECTION E ASSEMBLAGGIO ===\n' +
  'Esamina SEMPRE etichetta e nome per capire se la bottiglia è un edizione numerata: numero di edizione (173ème Édition, 174ème, Édition 172), ' +
  'numero di cuvée o collection (Cuvée N° 746, Collection 244), numero progressivo (Krug Rosé 29ème, Grand Siècle N°26), o altro numero fisso che identifica ' +
  'una specifica uscita (una volta uscita resta quella, non ruota in silenzio come un Brut generico). Un numero qualsiasi (annata, sigla come P2 o MV20) NON è un edizione. ' +
  'Se è un edizione numerata: edizione_numerata=true, is_sa=false (si comporta come un millesimato), il nome cuvee contiene il numero di edizione e NON l anno in coda, ' +
  'annata = anno base prevalente SOLO se lo sai con certezza (altrimenti null), assemblaggio con le annate reali dei vins de base e le % dei vins de reserve SOLO se certi (altrimenti null). ' +
  'Se NON è un edizione numerata: edizione_numerata=false. ' +
  'Sans Année NON numerata: nell assemblaggio NESSUNA annata (le annate cambiano ogni anno), solo percentuali, es. [{"perc":65},{"tipo":"riserva","perc":35}], solo se certe; altrimenti null.'

const SYSTEM_PROMPT_WEB = SYSTEM_PROMPT.replace(
  'Non hai accesso a internet: rispondi solo con ciò che sai con CERTEZZA ASSOLUTA per questa specifica bottiglia. ',
  'Hai a disposizione la ricerca web e DEVI usarla: scheda tecnica ufficiale (sito del produttore), prezzi nei negozi italiani, punteggi dei critici. Rispondi solo con ciò che è CONFERMATO dalle pagine trovate; non citare fonti nei testi. '
)
if (SYSTEM_PROMPT_WEB === SYSTEM_PROMPT) throw new Error('SYSTEM_PROMPT_WEB: frase da sostituire non trovata')

const buildUserPrompt = (includeMaison: boolean): string => {
  const head =
    'Analizza questa immagine con la massima precisione.\n\n' +
    'STEP 1 - PRIMA DI TUTTO: l immagine mostra una bottiglia o contenitore di bevanda?\n' +
    'Se NO (persona, cibo, oggetto, parte del corpo, ecc.) -> rispondi solo: {"is_bottle":false,"is_champagne":false,"confidence":0}\n\n' +
    'STEP 2 - Solo se is_bottle=true: segui la catena decisionale champagne dal system prompt per determinare is_champagne. ' +
    'Determina anche is_wine: true se è vino (fermo o spumante, Champagne o qualsiasi altra denominazione/paese: Barolo, Bordeaux, Prosecco, Franciacorta, Cava, Cremant, Sekt, rosati, vini dolci, ecc — is_champagne=true implica sempre is_wine=true). ' +
    'is_wine deve essere false per qualsiasi bevanda che NON sia vino: birra, superalcolici/liquori, acqua, bibite, succhi, ecc.\n\n' +
    'STEP 3 - Analisi VERITIERA, mai inventata (REGOLA #7): compila ogni campo SOLO se lo sai con certezza assoluta per QUESTA specifica bottiglia, altrimenti null. Un campo null è sempre meglio di un dato incerto o stimato. Ciò che si legge sull etichetta (produttore, cuvee, annata, dosaggio, tipo, numero di edizione) ha la priorità; tutto il resto solo se noto con certezza. Sii uguale di rigoroso per Champagne e per qualsiasi altro vino:\n' +
    '1. "cuvee": nome COMPLETO dell etichetta/vino SENZA produttore e SENZA annata. Per Champagne includi le denominazioni speciali (P2, P3, R.D., Belle Epoque, Rose, Blanc de Blancs) e, se presente, il numero di edizione/collection/cuvée (es. 173ème Édition, N° 746, Collection 244).\n' +
    '2. maturazione_mesi: mesi di affinamento sui lieviti dichiarati dal produttore o da fonti concordi per QUESTA cuvée e annata (non valori a memoria); altrimenti null. Nessuna stima per stile o denominazione.\n' +
    '3. punteggi_trovati (IMPORTANTE: il punteggio è il dato che l utente cerca di più): elenca OGNI punteggio su scala 100 realmente letto su una pagina, di critici, guide o community (Suckling, Decanter, Wine Advocate/Parker, Wine Spectator, Wine Enthusiast, Vinous, Falstaff, Gambero Rosso, Bibenda, Juhlin, RVF, CellarTracker...) per QUESTA cuvée e annata (per le Sans Année: per la cuvée), con la fonte. Non convertire scale diverse dalla centesimale (Vivino su 5, Jancis su 20). Mai ricordare o stimare un punteggio: lista vuota se non ne hai letti.\n' +
    '4. Campi SOLO Champagne — pct_chardonnay, pct_pinot_noir, pct_meunier, dosage, dosaggio_gl, tipo, assemblaggio: solo se certi (dosage e tipo si leggono spesso in etichetta: ciò che è scritto in etichetta prevale sempre sul web). Se il vino è 100% di un vitigno gli altri due valgono 0. Se NON è Champagne lasciali tutti null e descrivi vitigno/blend dentro "provenienza_uve" solo se lo sai con certezza.\n' +
    '5. provenienza_uve, vinificazione, malolattica, produzione_bottiglie: solo se riportati dal sito del produttore o da almeno 2 fonti concordi; altrimenti null. note_degustazione, abbinamento, finestra_da/finestra_a: scrivili da sommelier esperto, coerenti con il profilo verificato (uvaggio, dosaggio, maturazione, annata) e con le descrizioni trovate; nessun dettaglio tecnico non verificato dentro i testi.\n' +
    '6. assemblaggio (solo Champagne), vedi REGOLA #8: (a) millesimato o edizione numerata: annate reali dei vins de base con % e vins de reserve con %; (b) Sans Année NON numerata: NESSUNA annata, solo percentuali senza anno. Solo se certo, e le % devono sommare 100; altrimenti null. L assemblaggio descrive SOLO annate dei vins de base e riserve: mai vitigni o villaggi (quelli hanno i loro campi). Non Champagne: null.\n' +
    '7. prezzi_trovati: elenca OGNI prezzo di vendita al dettaglio realmente visto in negozi ed enoteche italiani (75cl, euro) per QUESTA cuvée e annata, con il dominio del negozio. NON usare prezzi francesi, UK o USA, né magnum. Mai ricordare o stimare un prezzo: lista vuota se non ne hai visti.\n\n'

  const step4 = includeMaison
    ? 'STEP 4 - SOLO se is_champagne=true e hai identificato un maison: compila anche i campi maison_* (REGOLA #6), ognuno solo se certo, altrimenti null.\n\n'
    : ''

  const baseFields = [
    '"is_bottle": true se bottiglia/contenitore bevanda, false se altro',
    '"is_champagne": boolean (segui catena decisionale obbligatoria)',
    '"is_wine": true se è vino (Champagne o qualsiasi altro vino fermo/spumante), false se è birra/superalcolico/acqua/bibita/altro non-vino, null se is_bottle=false',
    '"confidence": 0-100',
    '"maison": "nome produttore o null"',
    '"cuvee": "nome COMPLETO dell etichetta SENZA produttore e SENZA annata (per Champagne includi denominazioni speciali e numero di edizione/collection se presente), o null"',
    '"edizione_numerata": true se la bottiglia ha un numero di edizione, di cuvée o di collection che identifica una specifica uscita (es. 173ème Édition, N° 746, Collection 244, Rosé 29ème, Grand Siècle N°26), false altrimenti (REGOLA #8)',
    '"annata": "anno stringa es 2018, o null se sans annee. Per edizioni numerate: anno base prevalente SOLO se certo, altrimenti null"',
    '"is_sa": true se sans annee/non-vintage e NON edizione numerata; false se ha annata OPPURE è un edizione numerata',
    '"dosage": "Brut Nature" o "Extra Brut" o "Brut" o "Extra Sec" o "Sec" o "Demi-Sec" o "Doux" o null — SOLO Champagne, solo se certo',
    '"tipo": "blanc de blancs" o "blanc de noirs" o "rose" o "assemblage" o null — SOLO Champagne, solo se certo',
    '"prestige": true se cuvee/etichetta di prestigio (top di gamma del produttore), false altrimenti',
    '"punteggi_trovati": array [{"fonte":"nome del critico o della guida","punteggio":intero 0-100}] con TUTTI i punteggi realmente letti, oppure []',
    '"prezzi_trovati": array [{"fonte":"dominio del negozio italiano","prezzo":numero in euro, 75cl}] con TUTTI i prezzi realmente visti, oppure []',
    '"note_degustazione": "200-300 caratteri italiano da sommelier: colore/aspetto, profumi, gusto — basati sulle descrizioni trovate e sul profilo verificato della bottiglia"',
    '"abbinamento": "2-3 abbinamenti gastronomici italiani separati da virgola, coerenti con lo stile verificato della bottiglia"',
    '"finestra_da": anno intero inizio finestra ottimale (valutazione da sommelier su annata e maturazione), null solo se manca ogni base',
    '"finestra_a": anno intero fine finestra ottimale (valutazione da sommelier), null solo se manca ogni base',
    '"pct_chardonnay": integer 0-100 o null — SOLO Champagne, solo se certo',
    '"pct_pinot_noir": integer 0-100 o null — SOLO Champagne, solo se certo',
    '"pct_meunier": integer 0-100 o null — SOLO Champagne, solo se certo',
    '"assemblaggio": array di oggetti, solo se certo. Millesimato/edizione numerata: [{"anno":2017,"perc":58},{"tipo":"riserva","perc":42}] (anche con label es. {"tipo":"riserva","label":"reserve perpetuelle","perc":30}). Sans Année NON numerata: SENZA anno, [{"perc":65},{"tipo":"riserva","perc":35}]. Le % sommano 100. null se non certo o non Champagne',
    '"provenienza_uve": "zona/village/denominazione — per vini non Champagne anche vitigno/blend in forma testuale — solo se certo, altrimenti null"',
    '"vinificazione": "breve descrizione tecnica trovata sul sito del produttore o su 2 fonti concordi, altrimenti null"',
    '"malolattica": "completa" o "parziale" o "assente" o null',
    '"dosaggio_gl": numero decimale grammi/litro solo se noto con certezza per questa cuvee, altrimenti null — SOLO Champagne',
    '"maturazione_mesi": integer solo se noto con certezza per questa cuvee, altrimenti null',
    '"produzione_bottiglie": integer solo se noto con certezza, altrimenti null',
    '"not_champagne_type": "denominazione/tipologia del vino/bevanda se NOT champagne (es. \'Barolo DOCG\', \'Franciacorta DOCG\', \'vino rosso fermo\'), o null se è Champagne"',
  ]
  const maisonFields = [
    '"maison_tipo": "NM" o "RM" o "RC" o "CM" o "SR" o "ND" o "MA" o null — sigla ufficiale sul tappo/etichetta (NM=grande maison, RM=vigneron/récoltant-manipulant, RC=récoltant-coopérateur, CM=cooperativa, SR=société de récoltants, ND=négociant-distributeur, MA=marque auxiliaire), SOLO se is_champagne e leggibile/certa, altrimenti null',
    '"maison_sede_comune": "comune sede del produttore o null se non certo"',
    '"maison_zona": "Montagne de Reims" o "Côte des Blancs" o "Vallée de la Marne" o "Côte des Bar" o "Côte de Sézanne" o null — solo se certa',
    '"maison_anno_fondazione": integer solo se certo, altrimenti null',
    '"maison_proprieta": "proprietà/famiglia/gruppo proprietario, solo se certo, altrimenti null"',
    '"maison_direzione": "nome di chi dirige la maison oggi, solo se certo, altrimenti null"',
    '"maison_chef_de_cave": "nome del chef de cave, solo se certo, altrimenti null"',
    '"maison_ettari_totali": numero decimale ettari vitati totali, solo se certo, altrimenti null',
    '"maison_pct_chardonnay": integer 0-100 percentuale Chardonnay nel vigneto, solo se certa, altrimenti null',
    '"maison_pct_pinot_noir": integer 0-100 percentuale Pinot Noir nel vigneto, solo se certa, altrimenti null',
    '"maison_pct_meunier": integer 0-100 percentuale Meunier nel vigneto, solo se certa, altrimenti null',
    '"maison_produzione_bottiglie": integer produzione annua in bottiglie, solo se certa, altrimenti null',
    '"maison_certificazioni": array di stringhe (es. ["Biologico","Biodinamico (Demeter)","HVE"]) solo se certe, altrimenti null',
    '"maison_descrizione": "2-4 frasi in italiano: storia e identità del produttore, solo se lo conosci davvero, altrimenti null"',
    '"maison_filosofia": "1-2 frasi in italiano: approccio stilistico/enologico, solo se lo conosci davvero, altrimenti null"',
  ]
  const fields = includeMaison ? baseFields.concat(maisonFields) : baseFields
  return head + step4 + 'Rispondi SOLO con JSON valido, zero testo extra:\n{\n' + fields.map(f => '  ' + f).join(',\n') + '\n}'
}

// Ricerca web guidata: identità fissa letta in etichetta + 3 ricerche con scopi diversi.
const buildWebHint = (id: { maison?: unknown; cuvee?: unknown; annata?: unknown }): string => {
  const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const maison = s(id.maison), cuvee = s(id.cuvee), annata = s(id.annata)
  const ident = maison && cuvee
    ? '\n\nIDENTITÀ FISSA (letta in etichetta): ' + maison + ' — ' + cuvee + (annata && !cuvee.includes(annata) ? ' ' + annata : '') + '. ' +
      'Maison e cuvée sono queste: non cambiarle né correggerle, cercale esattamente così. Se le pagine trovate parlano di un vino con nome diverso (altra cuvée, altra annata), IGNORALE.'
    : ''
  return ident +
    '\n\nRICERCA WEB OBBLIGATORIA: esegui TUTTE E 3 le ricerche, ciascuna con uno scopo diverso, includendo sempre produttore, cuvée e annata: ' +
    '(1) SCHEDA TECNICA, preferendo il sito ufficiale del produttore: uvaggio, assemblaggio, dosaggio, maturazione sui lieviti, vinificazione, malolattica, produzione; ' +
    '(2) PREZZI nei negozi e nelle enoteche italiane (euro, 75cl): cerca di trovarne almeno 3 di negozi diversi; ' +
    '(3) PUNTEGGI su scala 100 di critici, guide e community: è il dato più importante per l utente, cercalo a fondo. ' +
    'REGOLE: i dati tecnici si compilano solo se li riporta il sito ufficiale del produttore oppure almeno 2 fonti indipendenti concordi; se le fonti si contraddicono: null. ' +
    'Ciò che si legge in etichetta (dosage, tipo, annata, numero di edizione) prevale sempre sul web. ' +
    'Prezzi e punteggi: considera solo pagine che riguardano ESATTAMENTE questa cuvée e annata (niente altre annate, magnum, mezze bottiglie o cofanetti). NON scegliere un valore, elenca in prezzi_trovati e punteggi_trovati TUTTI quelli realmente visti con la fonte (il calcolo lo fa il sistema); niente valori ricordati a memoria. ' +
    'Compila tutto ciò che è confermato; ciò che nessuna fonte riporta resta null.'
}

// `call` = anthropic.messages.create (in produzione) oppure una fetch REST (nei test)
const runWebAnalysis = async (
  call: (body: any) => Promise<any>,
  args: { imgSource: any; includeMaison: boolean; hint: string },
) => {
  let messages: any[] = [{ role: 'user', content: [
    { type: 'image', source: args.imgSource },
    { type: 'text',  text: buildUserPrompt(args.includeMaison) + args.hint },
  ]}]
  let inTok = 0, outTok = 0, searches = 0, text = ''
  const domains = new Set<string>()
  for (let turn = 0; turn < 6; turn++) {
    const msg: any = await call({
      model:      RESEARCH_MODEL,
      max_tokens: 4096,
      system:     SYSTEM_PROMPT_WEB.replace('la ricerca web', WEB_SEARCH_MAX_USES + ' ricerche web'),
      messages,
      tools:      [{ type: 'web_search_20250305', name: 'web_search', max_uses: WEB_SEARCH_MAX_USES }],
      // al primo giro la ricerca è obbligatoria: il modello non può rispondere "a memoria"
      ...(turn === 0 ? { tool_choice: { type: 'any' } } : {}),
    })
    inTok    += msg.usage?.input_tokens  ?? 0
    outTok   += msg.usage?.output_tokens ?? 0
    searches += msg.usage?.server_tool_use?.web_search_requests ?? 0
    // Il JSON finale sta nel testo dopo l'ultimo risultato di ricerca (il testo può essere spezzato in più blocchi)
    const blocks: any[] = msg.content || []
    let lastResult = -1
    blocks.forEach((bl, i) => {
      if (bl.type === 'web_search_tool_result') {
        lastResult = i
        for (const x of (Array.isArray(bl.content) ? bl.content : [])) {
          try { if (x?.url) domains.add(new URL(x.url).hostname.replace(/^www\./, '')) } catch (_e) { /* url non valido */ }
        }
      }
    })
    const after = blocks.slice(lastResult + 1).filter(bl => bl.type === 'text').map(bl => bl.text as string)
    text = (after.length ? after : blocks.filter(bl => bl.type === 'text').map(bl => bl.text as string)).join('')
    if (msg.stop_reason === 'pause_turn') { messages = [...messages, { role: 'assistant', content: msg.content }]; continue }
    break
  }
  return { inTok, outTok, searches, text, domains: [...domains] }
}

// Scheda produttore mostrata nel risultato della scansione. Si legge sempre dal database: per un produttore già in
// catalogo sono i dati verificati, per uno nuovo i dati appena salvati dalla scansione (in approvazione). Finché il
// produttore non è approvato si espone solo il sottoinsieme sicuro (niente proprietà, direzione, produzione, uvaggio).
const loadMaisonScheda = async (sb: any, maisonId: string | null) => {
  if (!maisonId) return null
  try {
    const { data: m } = await sb.from('maison')
      .select('id, nome, tipo, sede_comune, anno_fondazione, proprieta, direzione, chef_de_cave, ettari_totali, certificazioni, descrizione, filosofia, zona_id, is_free, is_published, needs_review')
      .eq('id', maisonId).maybeSingle()
    if (!m) return null
    let zona: string | null = null
    if (m.zona_id) {
      const { data: z } = await sb.from('zone').select('nome').eq('id', m.zona_id).maybeSingle()
      zona = z?.nome ?? null
    }
    const inCatalogo = m.is_published === true && m.needs_review === false
    return {
      id: m.id, nome: m.nome, tipo: m.tipo ?? null, zona, sede_comune: m.sede_comune ?? null,
      ettari_totali: m.ettari_totali ?? null,
      certificazioni: Array.isArray(m.certificazioni) && m.certificazioni.length ? m.certificazioni : null,
      descrizione: m.descrizione ?? null, filosofia: m.filosofia ?? null,
      anno_fondazione: inCatalogo ? (m.anno_fondazione ?? null) : null,
      proprieta:       inCatalogo ? (m.proprieta ?? null) : null,
      direzione:       inCatalogo ? (m.direzione ?? null) : null,
      chef_de_cave:    inCatalogo ? (m.chef_de_cave ?? null) : null,
      is_free: m.is_free ?? null,
      in_catalogo: inCatalogo,
    }
  } catch (_e) { return null }
}

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
      .select('is_premium, premium_until, scan_override')
      .eq('id', user.id)
      .single()

    const isPremium = profile?.is_premium === true &&
      (!profile?.premium_until || new Date(profile.premium_until) > new Date())

    const SCAN_LIMIT = isPremium ? 50 : 3

    const monthStart = new Date()
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)

    const { count } = await userSupa
      .from('bottle_scans')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', monthStart.toISOString())

    // Un admin può forzare manualmente il numero di scansioni "usate" questo mese
    // dalla piattaforma admin (campo scan_override su users) — ha priorità sul
    // conteggio reale calcolato da bottle_scans.
    const scansUsed = profile?.scan_override ?? (count ?? 0)

    if (scansUsed >= SCAN_LIMIT) {
      return json({
        error: 'rate_limit',
        scans_used: scansUsed,
        scan_limit: SCAN_LIMIT,
        message: isPremium
          ? 'Hai usato le 50 scansioni sommelier di questo mese. Si rinnovano il mese prossimo.'
          : 'Hai usato le 3 scansioni mensili gratuite. Passa a Premium per 50 scansioni sommelier al mese.',
      }, 429)
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
    let webSearches = 0                 // ricerche web effettivamente eseguite
    const mainCostUsd = () => sonnetInTok * PRICE_HAIKU_IN + sonnetOutTok * PRICE_HAIKU_OUT + webSearches * PRICE_WEB_SEARCH

    // ════════════════════════════════════════════════════════════
    // STAGE 1 — Quick pre-check con Haiku (economico)
    //   Identifica solo maison+cuvee senza analisi completa.
    //   Se la bottiglia è già nel catalogo saltiamo Sonnet → risparmio 80-90% costi AI.
    // ════════════════════════════════════════════════════════════
    const QUICK_PROMPT =
      'Guarda questa immagine. Rispondi SOLO con JSON valido, zero testo extra:\n' +
      '{\n' +
      '  "is_bottle": true se vedi una bottiglia, false altrimenti,\n' +
      '  "is_wine": true se la bottiglia contiene vino (fermo o spumante, Champagne o qualsiasi altra denominazione: Barolo, Bordeaux, Prosecco, Franciacorta, Cava, Cremant, Sekt, rosati, vini dolci ecc.), false se contiene qualsiasi cosa che NON sia vino (acqua, latte, birra, superalcolici/liquori, bibite, succhi ecc.) o se is_bottle=false. Sii conservativo: se l etichetta non è leggibile ma la forma/colore della bottiglia è chiaramente da vino, true comunque.\n' +
      '  "is_champagne": true se è Champagne AOC francese,\n' +
      '  "maison": "nome ESATTO del produttore come scritto sull etichetta (es. Krug, Henri Giraud, Moët & Chandon, Jacques Selosse). Se il produttore non è scritto sull etichetta (frequente per cuvée di prestigio: Cristal->Louis Roederer, Comtes de Champagne->Taittinger, Belle Epoque->Perrier-Jouët, Grande Cuvée/Clos du Mesnil->Krug, Cuvée Sir Winston Churchill->Pol Roger, La Grande Dame->Veuve Clicquot), deducilo dal nome della cuvée con la tua conoscenza enciclopedica invece di lasciarlo vuoto — non scrivere mai il nome della cuvée al posto del produttore. null solo se davvero non identificabile.",\n' +
      '  "cuvee": "nome ESATTO della cuvée come scritto sull etichetta SENZA maison. Se sull etichetta c e un numero di edizione, di cuvée o di collection (es. 173ème Édition, N° 746, Collection 244) includilo SEMPRE nel nome. Includi codici alfanumerici (es. MV20, MV16, RD, R.D., P2, P3, VO, V.O., Clos du Mesnil, Grande Cuvée 173ème, Belle Epoque, Cristal, Blanc de Blancs). NON scrivere denominazioni territoriali (Grand Cru, Premier Cru, Aÿ, Reims ecc.) a meno che non siano parte del nome cuvée. SE la bottiglia ha un annata (is_sa=false), l anno va SEMPRE aggiunto alla fine del nome cuvée (es. \'Cristal 2013\', \'Comtes de Champagne 2012\', \'P2 2004\'), non solo nel campo annata separato — TRANNE per le edizioni numerate (es. Grande Cuvée 173ème Édition), dove il numero di edizione identifica la bottiglia e l anno non va nel nome. Se è Sans Année (is_sa=true) nessun anno nel nome. o null",\n' +
      '  "annata": "anno es.2018 o null se sans année",\n' +
      '  "is_sa": true se sans année/non-vintage, false se ha annata,\n' +
      '  "confidence": 0-100,\n' +
      '  "not_champagne_type": "tipo bevanda se non è champagne o null"\n' +
      '}'

    let quick: Record<string, unknown> = { is_bottle: true, is_champagne: false, confidence: 0 }
    try {
      const qMsg = await anthropic.messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 350,
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
    // STAGE 1b — BLOCCO ANTICIPATO: non è una bottiglia o non è vino
    //   Se il quick-check economico è già sicuro che non serve a niente
    //   approfondire (acqua, latte, birra, superalcolici, oggetto generico…)
    //   ci fermiamo qui e risparmiamo la chiamata Sonnet, costosa e inutile.
    //   La scansione conta comunque nella quota mensile dell'utente (riga
    //   bottle_scans regolare), ma il frontend non la mostra nello storico
    //   (si basa su is_bottle/is_wine per decidere cosa salvare lì).
    // ════════════════════════════════════════════════════════════
    if (quick.is_bottle === false || quick.is_wine === false) {
      const costUsd = parseFloat(
        (haikuInTok * PRICE_HAIKU_IN + haikuOutTok * PRICE_HAIKU_OUT).toFixed(6)
      )
      const { data: blockedScan } = await userSupa
        .from('bottle_scans')
        .insert({
          user_id:              user.id,
          is_champagne:         false,
          detected_maison:      null,
          detected_cuvee:       null,
          detected_annata:      null,
          detected_dosage:      null,
          detected_tipo:        null,
          confidence:           quick.confidence ?? 0,
          not_champagne_type:   quick.not_champagne_type ?? null,
          matched_bottle_id:    null,
          new_bottle_id:        null,
          result_json:          { ...quick, blocked_non_wine: true },
          // ── Tracking costi ──
          scan_type:            'blocked_non_wine',
          haiku_input_tokens:   haikuInTok,
          haiku_output_tokens:  haikuOutTok,
          sonnet_input_tokens:  null,
          sonnet_output_tokens: null,
          cost_usd:             costUsd,
        })
        .select('id')
        .single()

      return json({
        scan_id:            blockedScan?.id,
        is_bottle:          quick.is_bottle ?? true,
        is_champagne:       false,
        is_wine:            false,
        not_champagne_type: quick.not_champagne_type ?? null,
        from_cache:         false,
      })
    }

    // ════════════════════════════════════════════════════════════
    // STAGE 2 — Ricerca nel catalogo con dati quick-check
    // ════════════════════════════════════════════════════════════
    let matchedBottle: Record<string, unknown> | null = null
    let bottleHasPhoto = false

    if (quick.is_champagne && quick.maison && quick.cuvee) {
      const { data: bottles } = await adminSupa
        .from('bottiglie')
        .select('id, nome, tipo, dosaggio_tipo, dosaggio_gl, annata, is_millesimato, foto_url, prezzo_min, prezzo_max, fascia_prezzo, score_medio, note_degustazione, abbinamento, finestra_da, finestra_a, pct_chardonnay, pct_pinot_noir, pct_meunier, provenienza_uve, vinificazione, malolattica, maturazione_mesi, produzione_bottiglie, assemblaggio, maison(id, nome, slug)')
        .eq('is_published', true)
        .eq('needs_review', false)

      if (bottles) {
        const found = findConfidentMatch(bottles as any[], quick.maison as string, quick.cuvee as string, quick.annata, quick.is_sa)
        if (found) { matchedBottle = found; bottleHasPhoto = !!found.foto_url }
      }
    }

    // ════════════════════════════════════════════════════════════
    // STAGE 3a — DB HIT: bottiglia già nel catalogo
    //   → scan_type = 'haiku_only', costo = solo haiku quick-check
    //   → Nessuna chiamata a Sonnet: risparmio garantito!
    // ════════════════════════════════════════════════════════════
    if (matchedBottle) {
      // Ogni foto scansionata di una bottiglia già a catalogo va in
      // approvazione — mai scritta direttamente su bottiglie.foto_url, anche
      // se la bottiglia non ha ancora nessuna foto. È l'admin a scegliere
      // manualmente quale candidata pubblicare (vedi foto_bottiglia_pending).
      let uploadedPhotoUrl: string | null = null
      const mb = matchedBottle as any

      if (image_base64) {
        try {
          const { data: buckets } = await adminSupa.storage.listBuckets()
          const bucketExists = (buckets || []).some((b: any) => b.name === 'champagne-photos')
          if (!bucketExists) {
            await adminSupa.storage.createBucket('champagne-photos', { public: true })
          }
          const imageBytes  = Uint8Array.from(atob(image_base64), c => c.charCodeAt(0))
          const pendingId    = crypto.randomUUID()
          const storagePath = 'pending/' + pendingId + '.jpg'
          const { error: uploadErr } = await adminSupa.storage
            .from('champagne-photos')
            .upload(storagePath, imageBytes, { contentType: 'image/jpeg', upsert: true })
          if (!uploadErr) {
            const { data: urlData } = adminSupa.storage.from('champagne-photos').getPublicUrl(storagePath)
            uploadedPhotoUrl = urlData.publicUrl
            await adminSupa.from('foto_bottiglia_pending').insert({
              id: pendingId,
              bottiglia_id: mb.id,
              user_id: user.id,
              storage_path: storagePath,
              foto_url: uploadedPhotoUrl,
              status: 'pending',
            })
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
      // DB HIT: i dati del catalogo hanno sempre priorità su Haiku (nomi completi e corretti)
      let msIdHit: string | null = ((mb as any).maison_id as string | undefined) ?? null
      if (!msIdHit) {
        const { data: bm } = await adminSupa.from('bottiglie').select('maison_id').eq('id', (mb as any).id).maybeSingle()
        msIdHit = bm?.maison_id ?? null
      }
      const maisonSchedaHit = await loadMaisonScheda(adminSupa, msIdHit)

      return json({
        maison_id:          msIdHit,
        maison_scheda:      maisonSchedaHit,
        scan_id:            scan?.id,
        is_bottle:          true,
        is_champagne:       true,
        is_wine:            true,
        confidence:         quick.confidence ?? 90,
        not_champagne_type: null,
        maison:             mb.maison?.nome ?? quick.maison ?? null,
        cuvee:              mb.nome         ?? quick.cuvee  ?? null,
        annata:             mb.annata       !== undefined ? (mb.annata ?? null) : (quick.annata ?? null),
        is_sa:              !mb.is_millesimato,
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
        assemblaggio:         mb.assemblaggio          ?? null,
        prezzo_min:           mb.prezzo_min            ?? null,
        prezzo_max:           mb.prezzo_max            ?? null,
        fascia_prezzo:        mb.fascia_prezzo         ?? fasciaFromPrezzo(mb.prezzo_min ?? null),
      })
    }

    // ════════════════════════════════════════════════════════════
    // STAGE 3b — DB MISS: bottiglia non in catalogo
    //   → Analisi completa con Sonnet (scan_type = 'sonnet_full')
    //   → Fallback a Haiku se Sonnet non disponibile (scan_type = 'haiku_fallback')
    // ════════════════════════════════════════════════════════════
    let rawText = ''
    const scanType = 'sonnet_full'

    // La scheda produttore costa molti token in uscita: si chiede solo se il produttore NON è già nel database
    let includeMaison = true
    try {
      if (quick.maison) {
        const { data: knownMaisons } = await adminSupa.from('maison').select('id, nome')
        if ((knownMaisons || []).some((m: any) => maisonMatch(m.nome || '', quick.maison as string))) includeMaison = false
      }
    } catch (_e) { /* nel dubbio si richiede la scheda */ }

    // ── Analisi completa (bottiglia non in catalogo) ──
    // Haiku 4.5 + 3 ricerche web obbligatorie (scheda tecnica, prezzi, punteggi). Se la ricerca fallisce: errore
    // esplicito, nessun ripiego su altri modelli né su dati a memoria.
    let webDomains: string[] = []
    try {
      const run = await runWebAnalysis(
        (body) => anthropic.messages.create(body),
        { imgSource, includeMaison, hint: buildWebHint({ maison: quick.maison, cuvee: quick.cuvee, annata: quick.annata }) },
      )
      webSearches  = run.searches
      webDomains   = run.domains
      sonnetInTok  = run.inTok
      sonnetOutTok = run.outTok
      rawText      = run.text
    } catch (aiErr: any) {
      console.error('Analisi completa error:', JSON.stringify(aiErr))
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
    ai = sanitizeAi(ai)
    ai.fonti_lette   = webDomains   // domini realmente letti dalla ricerca (controllo in approvazione)
    ai.ricerche_web  = webSearches

    // ── Auto-aggiunta al catalogo (bottiglia genuinamente nuova) ─
    let newBottleId: string | null = null
    let finalMaisonId: string | null = null
    if (ai.is_champagne && ai.maison && ai.cuvee) {
      let maisonId: string | null = null

      // Usa maisonMatch per trovare la maison corretta — NON split(' ')[0] + ILIKE
      // che causava "Henri Giraud" → "Henriot" (primo match alfabetico con 'Henri')
      const { data: allMaisons } = await adminSupa
        .from('maison')
        .select('id, nome')

      const matchedMaison = (allMaisons || []).find(
        (m: any) => maisonMatch(m.nome || '', ai.maison as string)
      )

      if (matchedMaison) {
        maisonId = (matchedMaison as any).id

        // ── Ricontrolla il catalogo GIÀ PUBBLICATO prima di creare un doppione ──
        // Il quick-check haiku non aveva trovato nulla, ma Sonnet potrebbe aver
        // letto l'etichetta con più precisione. Se ora c'è un match sicuro,
        // aggiorniamo quella bottiglia (come una cache hit) invece di crearne
        // una nuova in attesa di revisione — evita doppioni e foto attaccate
        // alla bottiglia sbagliata.
        const { data: publishedBottles } = await adminSupa
          .from('bottiglie')
          .select('id, nome, tipo, dosaggio_tipo, dosaggio_gl, annata, is_millesimato, foto_url, prezzo_min, prezzo_max, fascia_prezzo, score_medio, note_degustazione, abbinamento, finestra_da, finestra_a, pct_chardonnay, pct_pinot_noir, pct_meunier, provenienza_uve, vinificazione, malolattica, maturazione_mesi, produzione_bottiglie, assemblaggio, maison(id, nome, slug)')
          .eq('maison_id', maisonId)
          .eq('is_published', true)
          .eq('needs_review', false)

        const catalogMatch = publishedBottles
          ? findConfidentMatch(publishedBottles as any[], ai.maison as string, ai.cuvee as string, ai.annata, ai.is_sa)
          : null

        if (catalogMatch) {
          const mb = catalogMatch as any
          let uploadedPhotoUrlCm: string | null = null

          // Stessa regola del cache-hit sopra: sempre in approvazione, mai
          // scritta direttamente su bottiglie.foto_url.
          if (image_base64) {
            try {
              const { data: buckets } = await adminSupa.storage.listBuckets()
              const bucketExists = (buckets || []).some((b: any) => b.name === 'champagne-photos')
              if (!bucketExists) {
                await adminSupa.storage.createBucket('champagne-photos', { public: true })
              }
              const imageBytes  = Uint8Array.from(atob(image_base64), c => c.charCodeAt(0))
              const pendingIdCm  = crypto.randomUUID()
              const storagePath = 'pending/' + pendingIdCm + '.jpg'
              const { error: uploadErr } = await adminSupa.storage
                .from('champagne-photos')
                .upload(storagePath, imageBytes, { contentType: 'image/jpeg', upsert: true })
              if (!uploadErr) {
                const { data: urlData } = adminSupa.storage.from('champagne-photos').getPublicUrl(storagePath)
                uploadedPhotoUrlCm = urlData.publicUrl
                await adminSupa.from('foto_bottiglia_pending').insert({
                  id: pendingIdCm,
                  bottiglia_id: mb.id,
                  user_id: user.id,
                  storage_path: storagePath,
                  foto_url: uploadedPhotoUrlCm,
                  status: 'pending',
                })
              } else {
                console.error('photo upload (sonnet catalog match):', JSON.stringify(uploadErr))
              }
            } catch(e) { console.error('photo exception (sonnet catalog match):', e) }
          }

          const costUsdCm = parseFloat((
            haikuInTok  * PRICE_HAIKU_IN  + haikuOutTok  * PRICE_HAIKU_OUT +
            mainCostUsd()
          ).toFixed(6))

          const { data: scanCm } = await userSupa
            .from('bottle_scans')
            .insert({
              user_id:              user.id,
              is_champagne:         true,
              detected_maison:      ai.maison ?? null,
              detected_cuvee:       ai.cuvee  ?? null,
              detected_annata:      ai.annata ?? null,
              detected_dosage:      mb.dosaggio_tipo ?? null,
              detected_tipo:        mb.tipo ?? null,
              confidence:           ai.confidence ?? 0,
              matched_bottle_id:    mb.id,
              new_bottle_id:        null,
              result_json:          { ...ai, from_cache: false, matched_after_sonnet: true },
              scan_type:            'sonnet_full',
              haiku_input_tokens:   haikuInTok,
              haiku_output_tokens:  haikuOutTok,
              sonnet_input_tokens:  sonnetInTok  > 0 ? sonnetInTok  : null,
              sonnet_output_tokens: sonnetOutTok > 0 ? sonnetOutTok : null,
              cost_usd:             costUsdCm,
            })
            .select('id')
            .single()

          const maisonSchedaCm = await loadMaisonScheda(adminSupa, maisonId)
          return json({
            maison_id:          maisonId,
            maison_scheda:      maisonSchedaCm,
            scan_id:            scanCm?.id,
            is_bottle:          true,
            is_champagne:       true,
            confidence:         ai.confidence ?? 90,
            not_champagne_type: null,
            maison:             (matchedMaison as any).nome ?? ai.maison ?? null,
            cuvee:              mb.nome ?? ai.cuvee ?? null,
            annata:             mb.annata !== undefined ? (mb.annata ?? null) : (ai.annata ?? null),
            is_sa:              !mb.is_millesimato,
            dosage:             mb.dosaggio_tipo ?? null,
            tipo:               mb.tipo ?? null,
            prestige:           false,
            is_in_catalog:      true,
            matched_bottle:     catalogMatch,
            matched_bottle_id:  mb.id,
            new_bottle_id:      null,
            bottle_has_photo:   !!mb.foto_url,
            uploaded_photo_url: uploadedPhotoUrlCm,
            from_cache:         false,
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
            assemblaggio:         mb.assemblaggio          ?? null,
            prezzo_min:           mb.prezzo_min            ?? null,
            prezzo_max:           mb.prezzo_max            ?? null,
            fascia_prezzo:        mb.fascia_prezzo         ?? fasciaFromPrezzo(mb.prezzo_min ?? null),
          })
        }
      } else {
        // Risolve maison_zona (nome testuale dato da Sonnet) nell'id reale della
        // tabella zone — senza questo lookup la nuova maison in approvazione
        // resterebbe senza zona, uno dei campi che rendevano la scheda incompleta.
        let zonaId: string | null = null
        if (ai.maison_zona) {
          const { data: zoneRow } = await adminSupa
            .from('zone')
            .select('id')
            .ilike('nome', ai.maison_zona as string)
            .maybeSingle()
          zonaId = zoneRow?.id ?? null
        }

        const { data: newMaison, error: maisonErr } = await adminSupa
          .from('maison')
          .insert({
            nome:                 ai.maison,
            slug:                 makeSlug(ai.maison as string),
            tipo:                 ai.maison_tipo ?? null,
            zona_id:              zonaId,
            sede_comune:          ai.maison_sede_comune ?? null,
            anno_fondazione:      ai.maison_anno_fondazione ?? null,
            proprieta:            ai.maison_proprieta ?? null,
            direzione:            ai.maison_direzione ?? null,
            chef_de_cave:         ai.maison_chef_de_cave ?? null,
            ettari_totali:        ai.maison_ettari_totali ?? null,
            pct_chardonnay:       ai.maison_pct_chardonnay ?? null,
            pct_pinot_noir:       ai.maison_pct_pinot_noir ?? null,
            pct_meunier:          ai.maison_pct_meunier ?? null,
            produzione_bottiglie: ai.maison_produzione_bottiglie ?? null,
            certificazioni:       Array.isArray(ai.maison_certificazioni) ? ai.maison_certificazioni : null,
            descrizione:          ai.maison_descrizione ?? null,
            filosofia:            ai.maison_filosofia ?? null,
            source:               'scan',
            needs_review:         true,
            is_published:         false,   // resta fuori dall'elenco Produttori finché non lo approvi in admin
          })
          .select('id')
          .single()
        if (maisonErr) {
          console.error('maison insert error:', JSON.stringify(maisonErr))
          _dbErrors.push('maison: ' + maisonErr.message)
        }
        maisonId = newMaison?.id ?? null
      }

      finalMaisonId = maisonId
      if (maisonId) {
        const cuveeStr = (ai.cuvee as string) || ''
        const annataStr = ai.annata ? String(ai.annata) : ''
        // Il nome cuvee dei millesimati include già l'annata (REGOLA #3): la
        // aggiungiamo allo slug solo se il modello non l'ha ripetuta lì, per
        // evitare slug tipo "cristal-2013-2013".
        const needsAnnataSuffix = !ai.is_sa && annataStr && !cuveeStr.includes(annataStr)
        const bottleSlug = makeSlug(
          (ai.maison as string) + '-' + cuveeStr +
          (needsAnnataSuffix ? '-' + annataStr : '')
        )

        // Dedup: se esiste già una bottiglia con needs_review=true per questa maison+cuvée, non inserirne un'altra
        const { data: pendingBottles } = await adminSupa
          .from('bottiglie')
          .select('id, nome, annata, is_millesimato, tipo, dosaggio_tipo, dosaggio_gl, note_degustazione, abbinamento, finestra_da, finestra_a, pct_chardonnay, pct_pinot_noir, pct_meunier, provenienza_uve, vinificazione, malolattica, maturazione_mesi, produzione_bottiglie, assemblaggio, score_medio, score_note, prezzo_min, prezzo_max')
          .eq('maison_id', maisonId)
          .eq('needs_review', true)

        const existingPending = (pendingBottles || []).find((pb: any) => {
          if (!cuveeMatch(pb.nome || '', ai.cuvee as string)) return false
          // Per millesimati: annata deve coincidere
          if (pb.is_millesimato && pb.annata && !ai.is_sa && ai.annata) {
            if (String(pb.annata) !== String(ai.annata)) return false
          }
          return true
        })

        if (existingPending) {
          newBottleId = (existingPending as any).id
          // La riga in approvazione esiste già: si completano SOLO i campi ancora vuoti con i dati di questa
          // scansione, senza mai sovrascrivere ciò che c'è (le scansioni migliori arricchiscono, non peggiorano).
          try {
            const ex: any = existingPending
            const empty = (v: unknown) => v === null || v === undefined || v === ''
            const patch: Record<string, unknown> = {}
            const fill = (col: string, val: unknown) => { if (empty(ex[col]) && !empty(val)) patch[col] = val }
            fill('tipo', ai.tipo ? (ai.tipo as string).replace(/ /g, '_') : null)
            fill('dosaggio_tipo', ai.dosage)
            fill('dosaggio_gl', ai.dosaggio_gl)
            for (const c of ['note_degustazione', 'abbinamento', 'finestra_da', 'finestra_a', 'provenienza_uve', 'vinificazione', 'malolattica', 'maturazione_mesi', 'produzione_bottiglie', 'assemblaggio']) fill(c, (ai as any)[c])
            // gruppi coerenti: si completano solo se il gruppo è interamente vuoto (niente valori presi da scansioni diverse)
            if (empty(ex.pct_chardonnay) && empty(ex.pct_pinot_noir) && empty(ex.pct_meunier) && !empty(ai.pct_chardonnay)) {
              patch.pct_chardonnay = ai.pct_chardonnay; patch.pct_pinot_noir = ai.pct_pinot_noir ?? null; patch.pct_meunier = ai.pct_meunier ?? null
            }
            if (empty(ex.prezzo_min) && empty(ex.prezzo_max) && !empty(ai.prezzo_min)) {
              patch.prezzo_min = ai.prezzo_min; patch.prezzo_max = ai.prezzo_max ?? null
              patch.fascia_prezzo = fasciaFromPrezzo(ai.prezzo_min as number)
            }
            if (empty(ex.score_medio) && !empty(ai.punteggio)) { patch.score_medio = ai.punteggio; patch.score_note = ai.score_note ?? null }
            if (Object.keys(patch).length) {
              const { error: upErr } = await adminSupa.from('bottiglie').update(patch).eq('id', ex.id)
              if (upErr) { console.error('bottiglie completamento error:', JSON.stringify(upErr)); _dbErrors.push('completamento: ' + upErr.message) }
            }
          } catch (fillErr) { console.error('completamento riga esistente fallito:', fillErr) }
        } else {
        const { data: nb, error: bottErr } = await adminSupa
          .from('bottiglie')
          .insert({
            nome:                 ai.cuvee,
            slug:                 bottleSlug,
            maison_id:            maisonId,
            annata:               ai.is_sa ? null : (ai.annata ?? null),
            is_millesimato:       !(ai.is_sa ?? true),
            dosaggio_tipo:        ai.dosage ?? null,
            dosaggio_gl:          ai.dosaggio_gl ?? null,
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
            score_note:           (ai.score_note as string | null) ?? null,
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
              nome:                 ai.cuvee,
              slug:                 bottleSlug + '-' + Date.now(),
              maison_id:            maisonId,
              annata:               ai.is_sa ? null : (ai.annata ?? null),
              is_millesimato:       !(ai.is_sa ?? true),
              dosaggio_tipo:        ai.dosage ?? null,
              dosaggio_gl:          ai.dosaggio_gl ?? null,
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
              assemblaggio:         ai.assemblaggio ?? null,
              score_medio:          ai.punteggio ?? null,
            score_note:           (ai.score_note as string | null) ?? null,
              prezzo_min:           ai.prezzo_min ?? null,
              prezzo_max:           ai.prezzo_max ?? null,
              fascia_prezzo:        fasciaFromPrezzo((ai.prezzo_min as number | null) ?? null),
              source:               'scan',
              is_published:         true,
              needs_review:         true,
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
        } // end else (no existingPending)
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
      mainCostUsd()
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
      dosaggio_gl:          (ai.dosaggio_gl as number | null) ?? null,
      assemblaggio:         ai.assemblaggio         ?? null,
      prezzo_min:           (ai.prezzo_min as number | null) ?? null,
      prezzo_max:           (ai.prezzo_max as number | null) ?? null,
      fascia_prezzo:        fasciaFromPrezzo((ai.prezzo_min as number | null) ?? null),
    }

    // ── Risposta ─────────────────────────────────────────────────
    const maisonSchedaNew = await loadMaisonScheda(adminSupa, finalMaisonId)
    return json({
      maison_id:          finalMaisonId,
      maison_scheda:      maisonSchedaNew,
      scan_id:            scan?.id,
      is_bottle:          ai.is_bottle ?? true,
      is_champagne:       ai.is_champagne,
      is_wine:            (ai.is_wine as boolean | null) ?? (ai.is_champagne ? true : null),
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
