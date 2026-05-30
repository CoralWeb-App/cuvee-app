-- ================================================================
-- CUVÉE — Batch: Bruno Paillard NPU 2009 + C.H. Piconnet (2) + Cazals (2)
-- ================================================================

INSERT INTO maison (nome, slug, is_published, needs_review)
VALUES ('C.H. Piconnet', 'ch-piconnet', true, false)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO maison (nome, slug, is_published, needs_review)
VALUES ('Cazals', 'cazals', true, false)
ON CONFLICT (slug) DO NOTHING;


-- ================================================================
-- BRUNO PAILLARD — N.P.U. 2009 (Nec Plus Ultra)
-- 50% PN / 50% CH — millesimato 2009
-- Online critics avg ≈ 93 (Suckling 93, avg aggregata 93) | Lupetti 95
-- score_medio = round((93 + 95) / 2) = 94
-- ================================================================

INSERT INTO bottiglie (
  nome, slug, maison_id, tipo, is_millesimato, annata,
  dosaggio_tipo, dosaggio_gl, pct_pinot_noir, pct_chardonnay, pct_meunier,
  provenienza_uve, vini_base, vinificazione, malolattica, maturazione_mesi, produzione_bottiglie,
  note_vigneto, note_degustazione, abbinamento, stile,
  score_medio, score_note, finestra_da, finestra_a,
  prezzo_min, prezzo_max, fascia_prezzo, is_published, needs_review, source
)
SELECT
  'N.P.U. 2009', 'bruno-paillard-npu-2009', m.id,
  'assemblage', true, 2009,
  'Extra Brut', 5, 50, 50, 0,
  '6 Grand Cru: Oger, Le-Mesnil-sur-Oger, Chouilly (Chardonnay) — Verzenay, Mailly-Champagne, Bouzy (Pinot Noir)',
  'Esclusivamente dalla vendemmia 2009',
  'Barrique con 10 mesi di élevage',
  'Svolta',
  144, 9659,
  'N.P.U. sta per Nec Plus Ultra — letteralmente il massimo. La cuvée di punta di Bruno Paillard nasce dal più rigoroso assemblaggio paritetico tra Pinot Noir e Chardonnay, selezionati da sei Grand Cru storici. Dieci mesi di affinamento in barrique, oltre dodici anni di permanenza sui lieviti e almeno due anni di riposo post-sboccatura prima di raggiungere il mercato. 9.659 bottiglie numerate — ogni singolo dettaglio produttivo è dichiarato sull''etichetta posteriore.',
  'Naso di straordinaria profondità e vinosità: grassezze evolute, tostature raffinate e una materia che parla apertamente di dodici anni trascorsi con i lieviti. L''assemblaggio paritetico si esprime con chiarezza — agrumi gialli, pesca croccante, profondità e freschezza in equilibrio quasi contraddittorio. In bocca è ''completo'' nel senso più alto: denso, strutturato, con un''acidità sostenuta che non cede mai e una progressione lunghissima e precisa. Chiusura sulle dolcezze agrumate, non zuccherine, pulita e persistente. Uno champagne che aspira al podio del 2009.',
  'Aragosta armoricana in bisque con dragoncello e burro al limone; risotto al tartufo bianco d''Alba con fonduta di Parmigiano stravecchio 36 mesi',
  'Prestige', 94,
  'Nec Plus Ultra: dodici anni sui lieviti e sei Grand Cru per uno champagne che raggiunge il podio del suo millesimo.',
  2024, 2040, 280, 320, '€€€€',
  true, false, 'book+web'
FROM maison m WHERE m.slug = 'bruno-paillard';


-- ================================================================
-- C.H. PICONNET — Rosé Les Vignes de Charles
-- 50% PN (15% in rosso) / 30% CH / 20% Pinot Blanc — non millesimato
-- Online critics avg ≈ 88 (piccolo produttore, limitata copertura)
-- Lupetti oggi 92
-- score_medio = round((88 + 92) / 2) = 90
-- ================================================================

INSERT INTO bottiglie (
  nome, slug, maison_id, tipo, is_millesimato,
  dosaggio_tipo, dosaggio_gl, pct_pinot_noir, pct_chardonnay, pct_meunier,
  provenienza_uve, vini_base, vinificazione, malolattica, maturazione_mesi, produzione_bottiglie,
  note_vigneto, note_degustazione, abbinamento, stile,
  score_medio, score_note, finestra_da, finestra_a,
  prezzo_min, prezzo_max, fascia_prezzo, is_published, needs_review, source
)
SELECT
  'Rosé Les Vignes de Charles', 'ch-piconnet-rose-les-vignes-de-charles', m.id,
  'rose', false,
  'Brut Nature', 0, 50, 30, 0,
  'Tutte le parcelle del Domaine Piconnet — 50% Pinot Noir (di cui 15% vinificato in rosso), 30% Chardonnay, 20% Pinot Blanc',
  'Interamente dalla vendemmia 2019, non rivendicata in etichetta',
  'Vasche inox (cuve)',
  'Svolta',
  24, 6000,
  'Clément e Hubert Piconnet producono con un principio fisso: tutte le parcelle del domaine, nessun collage, nessuna filtrazione. Il rosé è la versione ''a colori'' del domaine. La presenza del Pinot Blanc al 20% è insolita in Champagne e contribuisce alla finezza floreale del profilo. La quota di 15% in rosso è integrata prima del tiraggio per struttura e colore. Un rosé non dosato di rara identità, prodotto in 6.000 bottiglie.',
  'Colore corallo brillante che preannuncia un naso profondo e stratificato: visciola, marasca, spezie orientali, karkadè e una mineralità cinerea che aleggia sul frutto rosso. La bocca è asciutta, gustosa, legata agli agrumi (arancia sanguinella) con una mineralità salina pervasiva. Tesa, definita, con equilibrio impeccabile e una chiusura di pulizia e precisione rare per un rosé non dosato.',
  'Tartare di ricciola con vinaigrette di lamponi e aneto fresco; insalata di gamberi rossi di Mazara con agrumi canditi e erba cipollina',
  'Rosé', 90,
  'Pinot Blanc al 20% e zero dosaggio: un rosé non dosato di rara finezza, dove ogni dettaglio parla delle vigne del domaine senza mediazioni.',
  2024, 2028, 65, 85, '€€€',
  true, false, 'book+web'
FROM maison m WHERE m.slug = 'ch-piconnet';

UPDATE bottiglie SET
  assemblaggio = '[{"anno":2019,"perc":100}]'::jsonb
WHERE slug = 'ch-piconnet-rose-les-vignes-de-charles';


-- ================================================================
-- C.H. PICONNET — La Bretonne
-- 100% Pinot Noir — non millesimato, blanc de noirs
-- Online critics avg ≈ 89 | Lupetti oggi 92
-- score_medio = round((89 + 92) / 2) = 91
-- ================================================================

INSERT INTO bottiglie (
  nome, slug, maison_id, tipo, is_millesimato,
  dosaggio_tipo, dosaggio_gl, pct_pinot_noir, pct_chardonnay, pct_meunier,
  provenienza_uve, vini_base, vinificazione, malolattica, maturazione_mesi, produzione_bottiglie,
  note_vigneto, note_degustazione, abbinamento, stile,
  score_medio, score_note, finestra_da, finestra_a,
  prezzo_min, prezzo_max, fascia_prezzo, is_published, needs_review, source
)
SELECT
  'La Bretonne', 'ch-piconnet-la-bretonne', m.id,
  'blanc_de_noirs', false,
  'Brut Nature', 0, 100, 0, 0,
  'Lieu-dit La Bretonne a Gyé-sur-Seine (Côte des Bar) — vigna più antica del domaine, piantata dal nonno di Clément',
  'Interamente dalla vendemmia 2021, non rivendicata in etichetta',
  'Vasche inox (cuve)',
  'Svolta',
  24, 1100,
  'Il parcellaire più convincente del domaine Piconnet, nato dall''assaggio dei campioni a febbraio: quando un vino comunica di non aver bisogno degli altri per esprimersi, viene imbottigliato da solo. La Bretonne è la vigna più antica della cantina, piantata dal nonno di Clément a Gyé-sur-Seine. Il 2021 — vendemmia fresca e tesa — è la base ideale per un Pinot Noir che punta alla precisione minerale. Poco più di 1.000 bottiglie, senza collage né filtrazione.',
  'Blanc de noirs di rara cesellatura. Naso: cedro candito, pepe bianco e una mineralità rocciosa intensa — agrumato e speziato, sorprendentemente nitido. La bollicina finissima si integra perfettamente con la materia. Bocca levigata ed essenziale: salina, con pesca bianca e arancia restituite con limpidezza assoluta. Finale amaricante e rinfrescante, con un richiamo al tamarindo che firma la chiusura. Precisione artigianale in ogni sorso.',
  'Sashimi di ricciola con salsa ponzu e zenzero fresco; risotto alle erbe aromatiche con tartare di gamberi rossi e scorza di limone Amalfi',
  'Blanc de Noirs', 91,
  'La vigna del nonno, zero dosaggio, 1.000 bottiglie: un blanc de noirs che dimostra cosa significa quando una parcella non ha bisogno di nessun altro.',
  2024, 2029, 80, 105, '€€€',
  true, false, 'book+web'
FROM maison m WHERE m.slug = 'ch-piconnet';

UPDATE bottiglie SET
  assemblaggio = '[{"anno":2021,"perc":100}]'::jsonb
WHERE slug = 'ch-piconnet-la-bretonne';


-- ================================================================
-- CAZALS — Soléra
-- 100% Chardonnay — non millesimato, blanc de blancs
-- Online critics avg ≈ 93 (Decanter review) | Lupetti oggi 94
-- score_medio = round((93 + 94) / 2) = 94
-- ================================================================

INSERT INTO bottiglie (
  nome, slug, maison_id, tipo, is_millesimato,
  dosaggio_tipo, dosaggio_gl, pct_pinot_noir, pct_chardonnay, pct_meunier,
  provenienza_uve, vini_base, vinificazione, malolattica, maturazione_mesi, produzione_bottiglie,
  note_vigneto, note_degustazione, abbinamento, stile,
  score_medio, score_note, finestra_da, finestra_a,
  prezzo_min, prezzo_max, fascia_prezzo, is_published, needs_review, source
)
SELECT
  'Soléra', 'cazals-solera', m.id,
  'blanc_de_blancs', false,
  'Extra Brut', 2, 0, 100, 0,
  '80% Le-Mesnil-sur-Oger Grand Cru, 20% Oger Grand Cru (Côte des Blancs)',
  '100% réserve perpétuelle costruita da Delphine Cazals tra il 2004 e il 2020 — nessun vino base recente',
  'Vasche inox (cuve)',
  'Svolta',
  36, 3500,
  'Nel 2004 Delphine Cazals avvia una réserve perpétuelle di solo Chardonnay da Le-Mesnil-sur-Oger (80%) e Oger (20%) — due Grand Cru dalla personalità complementare. Nel 2021 nasce l''idea di uno champagne costruito interamente su questa riserva, senza vendemmia base recente: un assemblaggio multi-generazionale che abbraccia le annate 2004–2020. Una solera champenoise di rara profondità filosofica oltre che gustativa. 3.500 bottiglie.',
  'Naso importante, pieno e strutturato che non ostenta la propria complessità: frutta secca, spezie, ricordi orientali (sandalo), freschezza balsamica e una mineralità calcarea che cresce con l''ossigenazione. La concentrazione non è maturità — è energia pura. Bocca densa e vellutata all''attacco, poi ''trasparente'' nella sua freschezza, con una dimensione minerale brillante e multilivello che emerge nel finale. Uno champagne che mostra cosa possono fare le vigne di Le-Mesnil con sedici anni di riserva.',
  'Turbot in crosta di sale con burro al limone e capperi di Pantelleria; salmone selvaggio marinato con finocchio, aneto e crema di yogurt greco',
  'Blanc de Blancs', 94,
  'Una réserve perpétuelle da 16 anni che si beve come un grande millesimo: Le-Mesnil e Oger esprimono tutto il loro potenziale senza fretta.',
  2024, 2035, 82, 108, '€€€',
  true, false, 'book+web'
FROM maison m WHERE m.slug = 'cazals';

UPDATE bottiglie SET
  assemblaggio = '[{"tipo":"riserva","label":"Réserve Perpétuelle 2004–2020","perc":100}]'::jsonb
WHERE slug = 'cazals-solera';


-- ================================================================
-- CAZALS — Clos Cazals 2016 (Vieilles Vignes)
-- 100% Chardonnay — millesimato 2016, blanc de blancs
-- Online critics avg ≈ 93 (2015: 91-93, 2016 alta qualità nel clos)
-- Lupetti oggi 96
-- score_medio = round((93 + 96) / 2) = 95
-- ================================================================

INSERT INTO bottiglie (
  nome, slug, maison_id, tipo, is_millesimato, annata,
  dosaggio_tipo, dosaggio_gl, pct_pinot_noir, pct_chardonnay, pct_meunier,
  provenienza_uve, vini_base, vinificazione, malolattica, maturazione_mesi, produzione_bottiglie,
  note_vigneto, note_degustazione, abbinamento, stile,
  score_medio, score_note, finestra_da, finestra_a,
  prezzo_min, prezzo_max, fascia_prezzo, is_published, needs_review, source
)
SELECT
  'Clos Cazals 2016', 'cazals-clos-cazals-2016', m.id,
  'blanc_de_blancs', true, 2016,
  'Extra Brut', 3, 0, 100, 0,
  'Clos omonimo a Oger Grand Cru (Côte des Blancs) — esclusivamente le due parcelle più antiche, piantate nel 1957 (Vieilles Vignes)',
  'Esclusivamente dalla vendemmia 2016',
  'Vasche inox (80%) e barrique (20%)',
  'Svolta',
  108, 5500,
  'Solo le due parcelle più antiche del clos di Oger — piantate da Claude Cazals nel 1957 — entrano in questa cuvée, contraddistinta dal sottotitolo Vieilles Vignes. Fu Delphine, nel 1995, a convincere il padre a separare queste vigne storiche in un champagne autonomo. La struttura muraria del clos garantisce una microtermica favorevole che nel 2016 — annata difficile in Champagne — ha permesso una maturazione più regolare rispetto alle parcelle esposte. Vinificazione mista: 80% acciaio per la freschezza, 20% barrique per la struttura. 5.500 bottiglie.',
  'Un champagne di impatto raffinato: non arriva con forza, ma con una stretta di mano che non si dimentica. Naso generoso ed energico: frutto bianco, agrumi come olii essenziali, florealità bianca gioiosa, freschezza quasi al vetiver e una mineralità iodica caratteristica di questo clos specifico. La bocca è solidissima e ''risoluta'' — levigata e intensissima, con un''acidità cesellata che scorre cristallina attraverso ogni sorso. Uno champagne che si guadagna la fiducia a poco a poco, poi non ti lascia più andare.',
  'Branzino selvatico al forno con zucchine trifolate e salsa vierge agli agrumi; linguine con astice fresco, pomodorini datterini e basilico',
  'Prestige', 95,
  'Le vigne del 1957, 9 anni sui lieviti e il microclima del clos: Oger Grand Cru nella sua espressione più austera e convincente.',
  2027, 2045, 130, 168, '€€€€',
  true, false, 'book+web'
FROM maison m WHERE m.slug = 'cazals';
