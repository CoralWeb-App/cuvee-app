-- ================================================================
-- CUVÉE — UPDATE assemblaggio (JSONB) per tutte le bottiglie
-- Fonte: dati "Vini:" dalle foto del libro
-- Millesimati 100% singola annata → gestiti dal fallback annata
-- Solo non-millesimati e millesimati con blend complesso
-- ================================================================


-- ──────────────────────────────────────────────────────────────
-- A. BERGÈRE
-- ──────────────────────────────────────────────────────────────

-- Terres Blanches: 100% 2021
UPDATE bottiglie SET assemblaggio = '[{"anno":2021,"perc":100}]'::jsonb
WHERE slug = 'a-bergere-terres-blanches';

-- Rosé de Saignée: 100% 2020
UPDATE bottiglie SET assemblaggio = '[{"anno":2020,"perc":100}]'::jsonb
WHERE slug = 'a-bergere-rose-de-saignee';

-- Les Vignes de Nuit 2019: millesimato puro → fallback annata, nessun assemblaggio necessario


-- ──────────────────────────────────────────────────────────────
-- A. LAMBLOT
-- ──────────────────────────────────────────────────────────────

-- La Vigne à Vovonne: 100% 2020
UPDATE bottiglie SET assemblaggio = '[{"anno":2020,"perc":100}]'::jsonb
WHERE slug = 'a-lamblot-la-vigne-a-vovonne';

-- Les Cochènes: 100% 2020
UPDATE bottiglie SET assemblaggio = '[{"anno":2020,"perc":100}]'::jsonb
WHERE slug = 'a-lamblot-les-cochenes';

-- Mouvance 21: 50% 2021 + 50% réserve perpétuelle 2017–2021
UPDATE bottiglie SET assemblaggio = '[{"anno":2021,"perc":50},{"tipo":"riserva","label":"Réserve Perpétuelle 2017–2021","perc":50}]'::jsonb
WHERE slug = 'a-lamblot-mouvance-21';


-- ──────────────────────────────────────────────────────────────
-- ALEXANDRE BONNET (millesimati puri → fallback annata)
-- ──────────────────────────────────────────────────────────────
-- Les Vignes Blanches 2019, Rosé de Macération 2020: nessun assemblaggio necessario


-- ──────────────────────────────────────────────────────────────
-- ALEXANDRE FILAINE
-- ──────────────────────────────────────────────────────────────

-- DMY: 60% 2021 + 40% 2020
UPDATE bottiglie SET assemblaggio = '[{"anno":2021,"perc":60},{"anno":2020,"perc":40}]'::jsonb
WHERE slug = 'alexandre-filaine-dmy';

-- Sp: 60% 2023 + 40% 2022
UPDATE bottiglie SET assemblaggio = '[{"anno":2023,"perc":60},{"anno":2022,"perc":40}]'::jsonb
WHERE slug = 'alexandre-filaine-sp';

-- Sensuum Vertigo 2019: millesimato puro → fallback annata


-- ──────────────────────────────────────────────────────────────
-- ALFRED GRATIEN (tutti millesimati puri → fallback annata)
-- ──────────────────────────────────────────────────────────────


-- ──────────────────────────────────────────────────────────────
-- ANDRÉ BEAUFORT
-- ──────────────────────────────────────────────────────────────

-- Réserve Polisy Brut Nature: 100% 2022
UPDATE bottiglie SET assemblaggio = '[{"anno":2022,"perc":100}]'::jsonb
WHERE slug = 'andre-beaufort-reserve-polisy-brut-nature';

-- Polisy Millésime 2017 e 2004: millesimati puri → fallback annata


-- ──────────────────────────────────────────────────────────────
-- ANDRÉ ROBERT
-- ──────────────────────────────────────────────────────────────

-- Les Jardins du Mesnil: 68% 2020 + 32% réserve perpétuelle
UPDATE bottiglie SET assemblaggio = '[{"anno":2020,"perc":68},{"tipo":"riserva","label":"Réserve Perpétuelle","perc":32}]'::jsonb
WHERE slug = 'andre-robert-les-jardins-du-mesnil';

-- Les Vignes de Montigny: 100% 2021
UPDATE bottiglie SET assemblaggio = '[{"anno":2021,"perc":100}]'::jsonb
WHERE slug = 'andre-robert-les-vignes-de-montigny';

-- Terre du Mesnil 2019: millesimato puro → fallback annata


-- ──────────────────────────────────────────────────────────────
-- ANTOINE BOUVET
-- ──────────────────────────────────────────────────────────────

-- Avenay-Val-d'Or: 50% 2020 + 50% 2019
UPDATE bottiglie SET assemblaggio = '[{"anno":2020,"perc":50},{"anno":2019,"perc":50}]'::jsonb
WHERE slug = 'antoine-bouvet-avenay-val-d-or';

-- Les Monts de la Vallée: 60% 2022 + 40% riserve 2021-2020
UPDATE bottiglie SET assemblaggio = '[{"anno":2022,"perc":60},{"tipo":"riserva","label":"Annate 2021–2020","perc":40}]'::jsonb
WHERE slug = 'antoine-bouvet-les-monts-de-la-vallee';

-- Les Monts de la Vallée Rosé: 100% 2022
UPDATE bottiglie SET assemblaggio = '[{"anno":2022,"perc":100}]'::jsonb
WHERE slug = 'antoine-bouvet-les-monts-de-la-vallee-rose';


-- ──────────────────────────────────────────────────────────────
-- AR LENOBLE
-- ──────────────────────────────────────────────────────────────

-- Extra Brut V.21: 49% 2021 + 51% réserve perpétuelle
UPDATE bottiglie SET assemblaggio = '[{"anno":2021,"perc":49},{"tipo":"riserva","label":"Réserve Perpétuelle","perc":51}]'::jsonb
WHERE slug = 'ar-lenoble-extra-brut-v21';

-- Blanc de Noirs 2016, Gentilhomme 2012: millesimati puri → fallback annata


-- ──────────────────────────────────────────────────────────────
-- ASSAILLY
-- ──────────────────────────────────────────────────────────────

-- P. Assailly: 100% 2018 (non millesimato)
UPDATE bottiglie SET assemblaggio = '[{"anno":2018,"perc":100}]'::jsonb
WHERE slug = 'assailly-p-assailly';

-- Parcellaires: 100% 2018 (non millesimato)
UPDATE bottiglie SET assemblaggio = '[{"anno":2018,"perc":100}]'::jsonb
WHERE slug = 'assailly-parcellaires';

-- Millésime 2013: millesimato puro → fallback annata


-- ──────────────────────────────────────────────────────────────
-- BENOÎT LAHAYE
-- ──────────────────────────────────────────────────────────────

-- Brut Nature: 50% 2021 + 50% réserve perpétuelle
UPDATE bottiglie SET assemblaggio = '[{"anno":2021,"perc":50},{"tipo":"riserva","label":"Réserve Perpétuelle","perc":50}]'::jsonb
WHERE slug = 'benoit-lahaye-brut-nature';

-- Blanc de Noirs: 100% 2021 (non millesimato)
UPDATE bottiglie SET assemblaggio = '[{"anno":2021,"perc":100}]'::jsonb
WHERE slug = 'benoit-lahaye-blanc-de-noirs';

-- Le Jardin de la Grosse Pierre 2020, Millésime 2014, Violaine 2020: millesimati → fallback annata


-- ──────────────────────────────────────────────────────────────
-- BENOÎT MUNIER (millesimati puri → fallback annata)
-- ──────────────────────────────────────────────────────────────


-- ──────────────────────────────────────────────────────────────
-- BÉRÊCHE ET FILS
-- ──────────────────────────────────────────────────────────────

-- Rive Gauche 2020, Campania Remenis 2020, Mailly-Champagne 2019: millesimati → fallback annata

-- Reflet d'Antan: 70% 2018 + 30% réserve perpétuelle 1982–2017
UPDATE bottiglie SET assemblaggio = '[{"anno":2018,"perc":70},{"tipo":"riserva","label":"Réserve Perpétuelle 1982–2017","perc":30}]'::jsonb
WHERE slug = 'bereche-reflet-d-antan';


-- ──────────────────────────────────────────────────────────────
-- BESSERAT DE BELLEFON
-- ──────────────────────────────────────────────────────────────

-- Blanc de Blancs: 100% 2017 (non millesimato)
UPDATE bottiglie SET assemblaggio = '[{"anno":2017,"perc":100}]'::jsonb
WHERE slug = 'besserat-de-bellefon-blanc-de-blancs';

-- Rosé Brut: 89% 2017 + 11% vino rosso Coteaux Champenois
UPDATE bottiglie SET assemblaggio = '[{"anno":2017,"perc":89},{"tipo":"riserva","label":"Vino rosso Champenois","perc":11}]'::jsonb
WHERE slug = 'besserat-de-bellefon-rose-brut';

-- Cuvée des Moines 2012: millesimato puro → fallback annata


-- ──────────────────────────────────────────────────────────────
-- BILLECART-SALMON
-- ──────────────────────────────────────────────────────────────

-- Le Réserve: 29% 2020 + 71% réserve perpétuelle (15 annate)
UPDATE bottiglie SET assemblaggio = '[{"anno":2020,"perc":29},{"tipo":"riserva","label":"Réserve Perpétuelle — 15 annate","perc":71}]'::jsonb
WHERE slug = 'billecart-salmon-le-reserve';

-- Le Sous Bois: 63% 2018 + 37% riserve 2006–2017
UPDATE bottiglie SET assemblaggio = '[{"anno":2018,"perc":63},{"tipo":"riserva","label":"Riserve 2006–2017 in botte","perc":37}]'::jsonb
WHERE slug = 'billecart-salmon-le-sous-bois';

-- Le Rosé: 44% 2021 + 56% annate 2020–2018
UPDATE bottiglie SET assemblaggio = '[{"anno":2021,"perc":44},{"tipo":"riserva","label":"Annate 2020–2018","perc":56}]'::jsonb
WHERE slug = 'billecart-salmon-le-rose';

-- Cuvée Nicolas-François 2012, Louis Salmon 2013, Élisabeth Salmon 2013: millesimati → fallback annata


-- ──────────────────────────────────────────────────────────────
-- BOLIEU
-- ──────────────────────────────────────────────────────────────

-- Fleur de Craie: 75% 2016 + 25% réserve perpétuelle (cuve + foudre)
UPDATE bottiglie SET assemblaggio = '[{"anno":2016,"perc":75},{"tipo":"riserva","label":"Réserve Perpétuelle","perc":25}]'::jsonb
WHERE slug = 'bolieu-fleur-de-craie';

-- Carnet de Léone (nuova — da eseguire dopo INSERT): 65% 2016 + 35% réserve perpétuelle in foudre
UPDATE bottiglie SET assemblaggio = '[{"anno":2016,"perc":65},{"tipo":"riserva","label":"Réserve Perpétuelle in foudre","perc":35}]'::jsonb
WHERE slug = 'bolieu-carnet-de-leone';


-- ──────────────────────────────────────────────────────────────
-- BOLLINGER (nuove — da eseguire dopo INSERT)
-- ──────────────────────────────────────────────────────────────

-- B16 2016: millesimato puro → fallback annata

-- PN TX20: 48% 2016 + 27% 2019 in cuve + 25% riserve storiche 2012+2008 in magnum
UPDATE bottiglie SET assemblaggio = '[{"anno":2016,"perc":48},{"anno":2019,"perc":27},{"tipo":"riserva","label":"Riserve 2012+2008 in magnum","perc":25}]'::jsonb
WHERE slug = 'bollinger-pn-tx20';

-- La Côte aux Enfants 2015: millesimato puro → fallback annata

-- Vieilles Vignes Françaises 2016: millesimato puro → fallback annata
