-- ================================================================
-- CUVÉE — Batch: Bolieu Carnet de Léone + Bollinger (4 bottiglie)
-- Tutto riscritto originale — nessun testo copiato da Lupetti
-- Score: round((media_critica_online + lupetti_oggi) / 2)
-- ================================================================

-- ── 1. MAISON (Bollinger è nuova; Bolieu esiste già) ─────────────

INSERT INTO maison (nome, slug, is_published, needs_review)
VALUES ('Bollinger', 'bollinger', true, false)
ON CONFLICT (slug) DO NOTHING;


-- ================================================================
-- BOLIEU — Carnet de Léone (100% Chardonnay, non millesimato)
-- Online critics avg ≈ 88 | Lupetti oggi 93
-- score_medio = round((88 + 93) / 2) = 91
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
  'Carnet de Léone',
  'bolieu-carnet-de-leone',
  m.id,
  'blanc_de_blancs', false,
  'Extra Brut', 4,
  0, 100, 0,
  'Bassuet, sottozona Vitryat (Côte des Bar)',
  'Prevalenza dalla vendemmia 2016 (65%) integrata da una réserve perpétuelle affinata in foudre di rovere (35%)',
  'Barrique',
  'Svolta durante la fermentazione alcolica',
  80, 1020,
  'Le vigne di Bassuet si trovano nel Vitryat, zona meridionale della Champagne con suoli argillo-calcarei che producono un Chardonnay di carattere deciso, distante dal profilo verticale della Côte des Blancs. La réserve perpétuelle in foudre garantisce continuità stilistica e aggiunge una dimensione ossidativa calibrata che caratterizza il marchio Bolieu.',
  'Il calice è dorato carico con riflessi ambrati, eloquente sulla profondità dell''affinamento in legno. Al naso, la barrique lavora con discrezione: vaniglia, mela al forno, nocciola tostata e cera d''api dialogano con un frutto giallo maturo, cui segue una mineralità pietrosa quasi gessosa che ricorda il calcare del Vitryat. Il sorso è generoso e cremoso, ma l''acidità — ammorbidita dalla malolattica senza spegnersi — garantisce tensione e lunghezza. Finale sapido, con agrumi canditi e gesso a chiudere elegantemente.',
  'Aragosta alla crema di vaniglia e zafferano con erba cipollina; capesante rosolate al burro nocciola con asparagi bianchi di Bassano e lamelle di tartufo bianco estivo',
  'Blanc de Blancs',
  91,
  'Barrique intelligente su uno Chardonnay di carattere: il Vitryat parla con voce propria, matura ma mai pesante.',
  2024, 2031,
  80, 100, '€€€',
  true, false, 'book+web'
FROM maison m WHERE m.slug = 'bolieu';


-- ================================================================
-- BOLLINGER — B16 2016 (72% PN / 28% CH, millesimato)
-- Online critics avg ≈ 94 (una fonte 96, Decanter ~94, WE ~93)
-- Lupetti oggi 92
-- score_medio = round((94 + 92) / 2) = 93
-- ================================================================

INSERT INTO bottiglie (
  nome, slug, maison_id,
  tipo, is_millesimato, annata,
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
  'B16',
  'bollinger-b16-2016',
  m.id,
  'assemblage', true, 2016,
  'Extra Brut', 4,
  72, 28, 0,
  '13 cru della Montagne de Reims: Bouzy Grand Cru (24%), Trépail Premier Cru (14%), Verzenay Grand Cru (9%), Verzy Premier Cru (8%), Tauxières Premier Cru (6%), Dizy Premier Cru (6%), Villers Marmery Premier Cru (3%) e altri',
  'Esclusivamente dalla vendemmia 2016, senza utilizzo di vini di riserva',
  'Tonneaux champenois tradizionali',
  'Svolta',
  84, NULL,
  'La B16 nasce da una decisione rara per Bollinger: il 2016 non ha soddisfatto gli standard richiesti per produrre la Grande Année, dando vita a un progetto alternativo centrato su Bouzy come pilastro strutturale e su Trépail per la freschezza. Tredici cru, 100% Grand Cru e Premier Cru, affinamento sous liège per oltre sette anni: un millésimé insolito per carattere e genesi.',
  'Al naso il B16 sorprende con la sua eleganza quasi borgognona: pesca bianca, mirabella, fiori di mandorlo, accento balsamico discreto e una mineralità calcarea che emerge con l''ossigenazione. I tonneaux conferiscono sostanza senza coprire il frutto. In bocca l''attacco è serico, con una trama tannica del Pinot Noir appena percettibile ma presente; l''acidità è vivace e raffinata. Finale minerale e lungo, con scorza di limone candito in chiusura. Un champagne che non si lascia incasellare: non è la Grande Année, ma ha una personalità propria e convincente, destinata a crescere in bottiglia.',
  'Filetto di branzino selvatico in crosta di erbe aromatiche con mousse di finocchio e agrumi; risotto allo zafferano di Navelli con gamberi di Mazara e caviale Oscietra',
  'Prestige',
  93,
  'Il 2016 secondo Bollinger: non la loro cuvée iconica, ma un champagne con una voce propria — elegante, verticale, da seguire nel tempo.',
  2027, 2040,
  140, 175, '€€€€',
  true, false, 'book+web'
FROM maison m WHERE m.slug = 'bollinger';


-- ================================================================
-- BOLLINGER — PN TX20 (100% Pinot Noir, non millesimato)
-- Online critics avg ≈ 93 (Vinous 93+, Juhlin 94, Decanter ~93)
-- Lupetti oggi 93
-- score_medio = round((93 + 93) / 2) = 93
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
  'PN TX20',
  'bollinger-pn-tx20',
  m.id,
  'blanc_de_noirs', false,
  'Brut', 8,
  100, 0, 0,
  'Tauxières Premier Cru (cru principale, dichiarato in etichetta), Aÿ Grand Cru e Avenay-Val-d''Or',
  '48% vendemmia 2016; 52% vini di riserva di cui 27% da uve 2019 affinati in cuve e 25% da riserve storiche 2012 e 2008 conservate in magnum',
  '50% cuve inox, 50% tonneaux champenois',
  'Svolta',
  84, NULL,
  'Sesta uscita della serie PN di Bollinger, creata dal compianto chef de cave Gilles Descôtes per raccontare il Pinot Noir cru per cru. Il TX20 mette al centro Tauxières, Premier Cru della Montagne de Reims dalla forte identità. L''uso di riserve storiche in magnum — risalenti al 2008 e al 2012 — è una scelta distintiva che aggiunge profondità e memoria al profilo del vino.',
  'Al naso si presenta diretto e preciso: lampone fresco, ribes bianco, scorza d''arancia e pane appena sfornato. Le riserve in magnum portano complessità: tabacco biondo, spezie dolci e un fondo minerale che arricchisce senza appesantire. In bocca la texture è cremosa e sapida, la struttura ampia ma agile; l''acidità fresca guida la progressione verso una chiusura su note di mela cotogna e tè bianco. Un blanc de noirs di sostanza e grande bevibilità.',
  'Faraona arrosto al forno con jus alla salvia, carote viola glassate e sumac; pecorino al tartufo bianco con pane ai semi di sesamo e insalata di rucola selvatica con nocciole tostate del Piemonte',
  'Blanc de Noirs',
  93,
  'Il PN di Tauxières in forma convincente: riserve in magnum, sapidità e profondità — un non millesimato che dimentica le aspettative e le supera.',
  2024, 2033,
  120, 145, '€€€',
  true, false, 'book+web'
FROM maison m WHERE m.slug = 'bollinger';


-- ================================================================
-- BOLLINGER — La Côte aux Enfants 2015 (100% PN, millesimato)
-- Online critics avg ≈ 96 (vino raro, Decanter/Vinous ~95-97)
-- Lupetti oggi 95
-- score_medio = round((96 + 95) / 2) = 96
-- ================================================================

INSERT INTO bottiglie (
  nome, slug, maison_id,
  tipo, is_millesimato, annata,
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
  'La Côte aux Enfants 2015',
  'bollinger-la-cote-aux-enfants-2015',
  m.id,
  'blanc_de_noirs', true, 2015,
  'Extra Brut', 4,
  100, 0, 0,
  'Lieu-dit Côte aux Enfants, Aÿ Grand Cru (parcella da 4 ettari, esposizione nord-ovest)',
  'Esclusivamente dalla vendemmia 2015 — quarta uscita della cuvée, avviata con la raccolta 2012',
  'Tonneaux champenois',
  'Svolta',
  108, 3900,
  'La Côte aux Enfants è il progetto-gemello delle Vieilles Vignes Françaises: stessa visione, stessa filosofia, ma vigne innestate (non su piede franco) impiantate da Jacques Bollinger tra il 1926 e il 1934 sul versante nord-ovest di Aÿ. La cuvée nasce nel 2012 come progetto di salvaguardia genetica del Pinot Noir di Aÿ. L''esposizione inusuale per la Champagne dona freschezza strutturale e una salinità minerale che distingue questo vino dai classici Aÿ Grand Cru. Affinamento sous liège — con sughero dal tiraggio alla sboccatura — per 108 mesi.',
  'Un Pinot Noir di Aÿ Grand Cru nella sua espressione più composta e austera. Al naso: frutti di bosco scuri e rossi in equilibrio, petalo di rosa essiccata, una nota ferrosa e calcarea caratteristica del sottosuolo di Aÿ, cenni di tabacco Virginia e cuoio morbido. Nove anni sous liège hanno affinato ogni componente con straordinaria coerenza. In bocca la struttura è imponente ma non oppressiva: trama tannica setosa, salinità pervasiva, acidità come filo conduttore di una progressione lunghissima. Il finale mineral-ferroso ricorda i grandi Pinot Noir della Côte de Nuits. Uno champagne da decantare e da servire su grandi carni.',
  'Tournedos Rossini con foie gras d''oca e riduzione al Porto Vintage; piccione alla parigina con tartufo nero di Périgord e jus alla mirto; filetto di Chianina su purée di topinambur con scaglie di Parmigiano 36 mesi',
  'Prestige',
  96,
  'La Côte aux Enfants 2015 raggiunge la sintesi perfetta: la potenza di Aÿ e la verticalità minerale in un''unica traiettoria austera e indimenticabile.',
  2028, 2048,
  330, 430, '€€€€',
  true, false, 'book+web'
FROM maison m WHERE m.slug = 'bollinger';


-- ================================================================
-- BOLLINGER — Vieilles Vignes Françaises 2016 (100% PN, millesimato)
-- Online critics avg ≈ 97 (WS 97, Decanter ~97, media aggregata 98)
-- Lupetti oggi 97
-- score_medio = round((97 + 97) / 2) = 97
-- ================================================================

INSERT INTO bottiglie (
  nome, slug, maison_id,
  tipo, is_millesimato, annata,
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
  'Vieilles Vignes Françaises 2016',
  'bollinger-vieilles-vignes-francaises-2016',
  m.id,
  'blanc_de_noirs', true, 2016,
  'Extra Brut', 4,
  100, 0, 0,
  'Lieux-dits Clos Saint-Jacques e Chaudes-Terres, Aÿ Grand Cru — vigne su piede franco coltivate en foule (sistema pre-filossera)',
  'Esclusivamente dalla vendemmia 2016; tiraggio effettuato con sughero (sous liège) dalla presa di spuma',
  'Tonneaux champenois',
  'Svolta',
  96, 1736,
  'Icona assoluta della Champagne moderna, le Vieilles Vignes Françaises nascono da due parcelle di Aÿ — Clos Saint-Jacques e Chaudes-Terres — dove le viti crescono su piede franco dal 1969, anno del primo millesimo firmato da Madame Bollinger e dal chef de cave André Bergeot. Coltivate en foule con altissima densità e resa bassissima, innestate su nessun portainnesto estraneo, queste piante sono un patrimonio viticolo unico al mondo. 1.736 bottiglie numerate, tiraggio con sughero: ogni dettaglio è una dichiarazione di intenti.',
  'Uno champagne che non si descrive, si vive. Al naso sfida ogni codice: profondo come un pozzo artesiano, con miele millefiori, mineralità calcarea pietrosa, fiori bianchi tardivi e un Pinot Noir che affiora lentamente — cupo ma luminoso, dai frutti scuri alla purezza minerale assoluta. Nulla ricorda la tipica esuberanza di un grande blanc de noirs: qui regna la disciplina e la concentrazione. La bocca è uno shock di noblesse: la trama gustativa è coriacea, autorevole, ogni sorso porta una nuova evoluzione. L''acidità è cesellata come uno scalpello sul marmo. Il finale dura un''eternità, sapido verso l''infinito, con una chiusura gessosa di Aÿ che rimane nel palato minuti dopo l''ultimo sorso.',
  'Boeuf de Simmental al burro con tartufo nero di Périgord e fleur de sel di Guérande; poularde de Bresse in vejus di viognier con jus al tartufo e millerighe al burro nocciola; filetto di Kobe in padella con foie gras fresco e riduzione al Barolo',
  'Prestige',
  97,
  'Piede franco, tiraggio con sughero, 1.736 bottiglie numerate: quando la tecnica diventa storia e il territorio si fa leggenda, nasce il VVF.',
  2032, 2060,
  700, 950, '€€€€',
  true, false, 'book+web'
FROM maison m WHERE m.slug = 'bollinger';
