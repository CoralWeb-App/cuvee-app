-- ================================================================
-- CUVÉE — Batch: Brice (1) + Bruno Paillard (4)
-- Procedura corretta: tecnici riformulati, web per score/prezzi/abbinamenti
-- ================================================================

-- ── MAISON ───────────────────────────────────────────────────────

INSERT INTO maison (nome, slug, is_published, needs_review)
VALUES ('Brice', 'brice', true, false)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO maison (nome, slug, is_published, needs_review)
VALUES ('Bruno Paillard', 'bruno-paillard', true, false)
ON CONFLICT (slug) DO NOTHING;


-- ================================================================
-- BRICE — Héritage Rosé XXII
-- 80% PN (6% in rosso) / 20% CH — non millesimato
-- Online critics avg ≈ 89 | Lupetti oggi 92
-- score_medio = round((89 + 92) / 2) = 91
-- ================================================================

INSERT INTO bottiglie (
  nome, slug, maison_id,
  tipo, is_millesimato,
  dosaggio_tipo, dosaggio_gl,
  pct_pinot_noir, pct_chardonnay, pct_meunier,
  provenienza_uve, vini_base,
  vinificazione, malolattica, maturazione_mesi, produzione_bottiglie,
  note_vigneto, note_degustazione, abbinamento, stile,
  score_medio, score_note,
  finestra_da, finestra_a,
  prezzo_min, prezzo_max, fascia_prezzo,
  is_published, needs_review, source
)
SELECT
  'Héritage Rosé XXII',
  'brice-heritage-rose-xxii',
  m.id,
  'rose', false,
  'Extra Brut', 2,
  80, 20, 0,
  'Bouzy Grand Cru e Loches-sur-Ource (Pinot Noir), Grauves Premier Cru (Chardonnay)',
  'Interamente dalla vendemmia 2022 — non millesimato in etichetta; quota di 6% in rosso da Bouzy Rouge',
  'Vasche inox e barrique in proporzione variabile',
  'Non svolta',
  22, 10000,
  'La maison Brice affonda le sue radici a Bouzy dal 1684 — una delle famiglie viticole più longeve della Champagne. L''Héritage Rosé non è il classico rosé con aggiunta di vino rosso: nasce dall''assemblaggio dei vini più fruttati dell''annata con una quota di taille vinificata in barrique e una parte di Bouzy Rouge, creando un profilo più strutturato e territoriale. La scelta di non svolgere la malolattica accentua la vivacità acida e la freschezza del frutto rosso.',
  'Naso vivace e identitario: arancia sanguinella, melograno, karkadè e un tocco di erbe aromatiche orientali creano un profilo insolito e intrigante. La malolattica bloccata mantiene una freschezza acida netta che percorre tutto il sorso. Bocca elegante, asciutta, con un velo tannico quasi impercettibile — il segno del Pinot Noir di Bouzy — e una chiusura su frutto rosso maturo e mineralità scura. Un rosé che unisce la firma di una maison storica alla personalità identitaria del viticoltore.',
  'Salmone selvatico alla griglia con salsa di melograno e aneto fresco; charcuterie board con mortadella artigianale, bresaola e crostini con ricotta e scorza di limone',
  'Rosé',
  91,
  'Bouzy in forma rosata: malolattica bloccata e Bouzy Rouge firmano un rosé di rara identità territoriale, asciutto e preciso.',
  2025, 2028,
  38, 58, '€€',
  true, false, 'book+web'
FROM maison m WHERE m.slug = 'brice';

UPDATE bottiglie SET
  assemblaggio = '[{"anno":2022,"perc":94},{"tipo":"riserva","label":"Bouzy Rouge","perc":6}]'::jsonb
WHERE slug = 'brice-heritage-rose-xxii';


-- ================================================================
-- BRUNO PAILLARD — Rosé Première Cuvée
-- 85% PN (5% in rosso) / 15% CH — non millesimato
-- Online critics avg ≈ 92 (WA 93, WS 92, WE 90, Vinous 92, Suckling 92)
-- Lupetti oggi 92
-- score_medio = round((92 + 92) / 2) = 92
-- ================================================================

INSERT INTO bottiglie (
  nome, slug, maison_id,
  tipo, is_millesimato,
  dosaggio_tipo, dosaggio_gl,
  pct_pinot_noir, pct_chardonnay, pct_meunier,
  provenienza_uve, vini_base,
  vinificazione, malolattica, maturazione_mesi, produzione_bottiglie,
  note_vigneto, note_degustazione, abbinamento, stile,
  score_medio, score_note,
  finestra_da, finestra_a,
  prezzo_min, prezzo_max, fascia_prezzo,
  is_published, needs_review, source
)
SELECT
  'Rosé Première Cuvée',
  'bruno-paillard-rose-premiere-cuvee',
  m.id,
  'rose', false,
  'Brut', 6,
  85, 15, 0,
  'Prevalentemente Grand Cru e Premier Cru — Mailly, Verzenay, Bouzy (PN), Les-Riceys (vino rosso)',
  '70% base 2019, 30% réserve perpétuelle da annate precedenti; 5% vino rosso da cru selezionati annualmente',
  'Vasche inox (75%) e barrique (25%)',
  'Svolta',
  36, NULL,
  'Il Rosé Première Cuvée rappresenta circa il 12% dell''intera produzione di Bruno Paillard — un dato che racconta la centralità di questa tipologia nella visione della maison. La quota di vino rosso (5%) non ha una formula fissa: Alice Paillard sceglie ogni anno i cru di riferimento tra Mailly, Verzenay, Bouzy e Les-Riceys in base alle caratteristiche dell''annata. La réserve perpétuelle e il 25% di barrique costruiscono profondità e continuità stilistica disgorgiamento dopo disgorgiamento.',
  'Naso di grande eleganza: pompelmo rosa, fragoline di bosco selvatiche e una mineralità di grafite che si apre lentamente su note di brioche. La fusione tra il frutto del Pinot Noir e la freschezza del Chardonnay è impeccabile. In bocca è succoso e sapido, con agrumi amari che guidano una progressione pulita fino a una chiusura asciutta e minerale. Un rosé di struttura e finezza, che si esprime tanto all''aperitivo quanto a tavola con piatti complessi.',
  'Tartare di tonno rosso con avocado, sesamo tostato e lime; risotto alla barbabietola con capesante rosolate e crema di caprino fresco',
  'Rosé',
  92,
  'Alice Paillard ha trasformato questo rosé in un campione di equilibrio: agrumato, minerale, generoso — e impossibile da fermare al primo sorso.',
  2024, 2030,
  72, 92, '€€€',
  true, false, 'book+web'
FROM maison m WHERE m.slug = 'bruno-paillard';

UPDATE bottiglie SET
  assemblaggio = '[{"anno":2019,"perc":70},{"tipo":"riserva","label":"Réserve Perpétuelle","perc":30}]'::jsonb
WHERE slug = 'bruno-paillard-rose-premiere-cuvee';


-- ================================================================
-- BRUNO PAILLARD — Blanc de Blancs Grand Cru
-- 100% Chardonnay — non millesimato
-- Online critics avg ≈ 91 (WE 94, CellarTracker 90.9, Jancis Robinson)
-- Lupetti oggi 91
-- score_medio = round((91 + 91) / 2) = 91
-- ================================================================

INSERT INTO bottiglie (
  nome, slug, maison_id,
  tipo, is_millesimato,
  dosaggio_tipo, dosaggio_gl,
  pct_pinot_noir, pct_chardonnay, pct_meunier,
  provenienza_uve, vini_base,
  vinificazione, malolattica, maturazione_mesi, produzione_bottiglie,
  note_vigneto, note_degustazione, abbinamento, stile,
  score_medio, score_note,
  finestra_da, finestra_a,
  prezzo_min, prezzo_max, fascia_prezzo,
  is_published, needs_review, source
)
SELECT
  'Blanc de Blancs Grand Cru',
  'bruno-paillard-blanc-de-blancs-grand-cru',
  m.id,
  'blanc_de_blancs', false,
  'Extra Brut', 5,
  0, 100, 0,
  'Oger Grand Cru e Le-Mesnil-sur-Oger Grand Cru (Côte des Blancs)',
  '65% base 2019, 35% réserve perpétuelle avviata nel 1990',
  'Vasche inox (75%) e barrique (25%)',
  'Svolta',
  36, 20000,
  'Nasce dalle prime vigne acquistate da Bruno Paillard, su due Grand Cru della Côte des Blancs — Oger e Le-Mesnil — che costituiscono il riferimento bianco storico della maison. Bruno Paillard adotta una pressione di tiraggio ridotta (4,5 atmosfere, ex crémant) che conferisce un perlage particolarmente fine e una texture setosa al palato. La réserve perpétuelle, avviata nel 1990, completa il blend con una profondità storica rara tra i Blanc de Blancs non millesimati. Il vino riposa almeno 10 mesi dopo la sboccatura prima della commercializzazione.',
  'Schiuma finissima che preannuncia un vino di grande precisione. Al naso: crostata al limone, cannolo siciliano, frutta secca tostata, poi foglia di limone fresca e una mineralità calcarea crescente con l''ossigenazione. L''equilibrio tra ricchezza e tensione è quasi magistrale — nessun elemento prevale sull''altro. In bocca è agrumato, materico, con una salinità che richiama la craie di Le Mesnil. Finale lungo, pulito, con una tostatura delicata. Un Blanc de Blancs di riferimento, esemplare per la sua misura.',
  'Ostriche Belon con granita di lime e bottarga di muggine; gnocchi di ricotta al burro di malga con caviale di trota e erba cipollina',
  'Blanc de Blancs',
  91,
  'Demi-mousse, réserve dal 1990 e due Grand Cru puri: Bruno Paillard firma un Blanc de Blancs di misura perfetta, dove nessun eccesso è tollerato.',
  2024, 2032,
  68, 88, '€€€',
  true, false, 'book+web'
FROM maison m WHERE m.slug = 'bruno-paillard';

UPDATE bottiglie SET
  assemblaggio = '[{"anno":2019,"perc":65},{"tipo":"riserva","label":"Réserve Perpétuelle dal 1990","perc":35}]'::jsonb
WHERE slug = 'bruno-paillard-blanc-de-blancs-grand-cru';


-- ================================================================
-- BRUNO PAILLARD — Cuvée 72
-- 45% PN / 33% CH / 22% Mu — non millesimato
-- Online critics avg ≈ 91 (CellarTracker 92.1, WE ~91)
-- Lupetti oggi 92
-- score_medio = round((91 + 92) / 2) = 92
-- ================================================================

INSERT INTO bottiglie (
  nome, slug, maison_id,
  tipo, is_millesimato,
  dosaggio_tipo, dosaggio_gl,
  pct_pinot_noir, pct_chardonnay, pct_meunier,
  provenienza_uve, vini_base,
  vinificazione, malolattica, maturazione_mesi, produzione_bottiglie,
  note_vigneto, note_degustazione, abbinamento, stile,
  score_medio, score_note,
  finestra_da, finestra_a,
  prezzo_min, prezzo_max, fascia_prezzo,
  is_published, needs_review, source
)
SELECT
  'Cuvée 72',
  'bruno-paillard-cuvee-72',
  m.id,
  'assemblage', false,
  'Brut', 6,
  45, 33, 22,
  '30 cru della Marne selezionati sulla craie calcarea',
  '65% base 2019, 35% réserve perpétuelle avviata nel 1985',
  'Vasche inox (75%) e barrique (25%)',
  'Svolta',
  72, 10000,
  'Il nome "72" racchiude la formula produttiva: 36 mesi di permanenza sui lieviti, seguiti da 36 mesi di riposo in cantina dopo la sboccatura — sei anni totali. In controtendenza rispetto al culto dei dégorgement tardifs, Bruno Paillard sceglie di completare la maturazione post-sboccatura, a contatto con l''aria. Un approccio controcorrente che restituisce un''espressività diversa e una piacevolezza immediata che fa di questa cuvée un riferimento assoluto per il rapporto qualità-prezzo.',
  'Un assemblaggio classico di tutti e tre i vitigni champenois che raggiunge la sua forma migliore dopo sei anni di pazienza. Al naso: equilibrio e raffinatezza senza ostentazione — mela golden, pera matura, agrumi integrati, mineralità e un richiamo al panettone milanese. In bocca c''è freschezza e al tempo stesso evoluzione: bevibilità immediata ma anche una trama che racconta il tempo trascorso. Chiusura sapida, con una tostatura leggera. Il champagne da cantina per eccellenza.',
  'Petto di pollo ruspante arrosto con salsa ai funghi porcini e timo; tagliolini al burro con tartufo nero estivo e Parmigiano Reggiano 24 mesi',
  'Prestige',
  92,
  '36 mesi sui lieviti + 36 mesi post-sboccatura: la formula matematica di Bruno Paillard produce un champagne di bevibilità e complessità difficili da scindere.',
  2025, 2035,
  58, 75, '€€€',
  true, false, 'book+web'
FROM maison m WHERE m.slug = 'bruno-paillard';

UPDATE bottiglie SET
  assemblaggio = '[{"anno":2019,"perc":65},{"tipo":"riserva","label":"Réserve Perpétuelle dal 1985","perc":35}]'::jsonb
WHERE slug = 'bruno-paillard-cuvee-72';


-- ================================================================
-- BRUNO PAILLARD — D:Z (Dosage Zéro)
-- 25% PN / 25% CH / 50% Mu — non millesimato
-- Online critics avg ≈ 92 (W&S 94, Vinous 93, Suckling 93, Parker 90, WE 89)
-- Lupetti oggi 94
-- score_medio = round((92 + 94) / 2) = 93
-- ================================================================

INSERT INTO bottiglie (
  nome, slug, maison_id,
  tipo, is_millesimato,
  dosaggio_tipo, dosaggio_gl,
  pct_pinot_noir, pct_chardonnay, pct_meunier,
  provenienza_uve, vini_base,
  vinificazione, malolattica, maturazione_mesi, produzione_bottiglie,
  note_vigneto, note_degustazione, abbinamento, stile,
  score_medio, score_note,
  finestra_da, finestra_a,
  prezzo_min, prezzo_max, fascia_prezzo,
  is_published, needs_review, source
)
SELECT
  'D:Z Dosage Zéro',
  'bruno-paillard-dz',
  m.id,
  'assemblage', false,
  'Brut Nature', 0,
  25, 25, 50,
  '30 cru della Marne selezionati sulla craie calcarea',
  '50% base 2019, 50% réserve perpétuelle avviata nel 2000 (include NPU 2000 remis en cercle)',
  'Vasche inox (50%) e barrique (50%)',
  'Svolta',
  36, NULL,
  'D:Z sta per Dosage Zéro: la sfida che Bruno Paillard ha avviato nel 1985 e completato nel 2014 con il primo assemblaggio di questo progetto, giunto ora alla terza uscita. Il Pinot Meunier domina al 50% — vitigno storicamente marginale ma qui protagonista assoluto. La réserve perpétuelle avviata nel 2000 include l''NPU 2000 ''remis en cercle'', il cru di punta della maison. La quota di barrique al 50% è decisiva per integrare la durezza di un non dosato in un vino da pasto completo.',
  'Il pas dosé secondo Bruno Paillard sfida ogni preconcetto sulla categoria. Naso nobile e sfaccettato: crema di limoncello, mora matura, verbena fresca, sandalo e macchia mediterranea. La quota di barrique al 50% lavora in silenzio, aggiungendo texture e tostatura senza appesantire. Bocca levigata, gustosa, con una chiusura asciutta e rinfrescante al tè verde che conquista. Non sembra un non dosato: è una dichiarazione d''intenti, perfetta a tavola con proteine nobili.',
  'T-bone di Chianina alla brace con fleur de sel di Guérande e rosmarino fresco; carpaccio di polpo tiepido con citronette al prezzemolo e olive taggiasche',
  'Brut Nature',
  93,
  'Meunier al 50%, zero dosaggio e réserve perpétuelle dal 2000: Bruno Paillard riscrive le regole del non dosato con una complessità che disarma.',
  2024, 2030,
  62, 80, '€€€',
  true, false, 'book+web'
FROM maison m WHERE m.slug = 'bruno-paillard';

UPDATE bottiglie SET
  assemblaggio = '[{"anno":2019,"perc":50},{"tipo":"riserva","label":"Réserve Perpétuelle dal 2000","perc":50}]'::jsonb
WHERE slug = 'bruno-paillard-dz';
