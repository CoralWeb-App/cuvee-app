-- ================================================================
-- CUVÉE — UPDATE CAMPI TECNICI ORIGINALI (tutte le bottiglie)
-- Riscritto interamente: provenienza_uve, vini_base, vinificazione,
-- note_vigneto — nessun testo copiato da Lupetti
-- note_degustazione, abbinamento, score_medio, score_note
-- erano già stati corretti nella sessione precedente
-- ================================================================


-- ──────────────────────────────────────────────────────────────
-- A. BERGÈRE
-- ──────────────────────────────────────────────────────────────

UPDATE bottiglie SET
  provenienza_uve = 'Férebrianges, Étoges e Congy (Val du Petit Morin)',
  vini_base       = 'Interamente dalla vendemmia 2021; nessun vino di riserva',
  vinificazione   = 'Vasche inox (70%) e botte grande (30%)',
  note_vigneto    = 'Tre comuni del Val du Petit Morin convergono in questo Blanc de Blancs senza dosaggio: Férebrianges, Étoges e Congy, sul versante meridionale della Champagne con suoli calcareo-argillosi. La scelta del Brut Nature riflette la filosofia di Olivier Bergère: ogni aggiunta di dosaggio è vista come una correzione, e questi Chardonnay su suoli crayeux non ne hanno bisogno.'
WHERE slug = 'a-bergere-terres-blanches';

UPDATE bottiglie SET
  provenienza_uve = 'Parcella omonima su suoli profondamente calcarei a Étoges, Val du Petit Morin',
  vini_base       = 'Esclusivamente dalla vendemmia 2019',
  vinificazione   = 'Botte grande, lunga permanenza',
  note_vigneto    = 'Cuvée da un''unica parcella a Étoges — uno dei comuni meno noti ma più interessanti del Val du Petit Morin, con suoli a forte vocazione gessosa. La vendemmia 2019, calda e generosa, è stata qui interpretata con affinamento prolungato in botte grande: il calore dell''annata viene progressivamente assorbito dalla struttura calcarea del terroir, restituendo un vino di profondità e freschezza inattesa.'
WHERE slug = 'a-bergere-les-vignes-de-nuit-2019';

UPDATE bottiglie SET
  provenienza_uve = 'Selezione parcellare a Férebrianges, Vallée du Petit Morin',
  vini_base       = 'Interamente dalla vendemmia 2020; base co-fermentata sulle bucce',
  vinificazione   = 'Vasche inox con quota in barrique; co-macerazione breve sulle bucce',
  note_vigneto    = 'Rosé ottenuto con co-macerazione di Pinot Noir e Chardonnay sulle bucce a Férebrianges. La saignée — letteralmente il salasso del mosto parzialmente colorato — è eseguita prima che la macerazione sia completa, garantendo freschezza e colore rosato senza perdere la tensione acida del Chardonnay. Una produzione limitata da parcelle selezionate nella Vallée du Petit Morin.'
WHERE slug = 'a-bergere-rose-de-saignee';


-- ──────────────────────────────────────────────────────────────
-- A. LAMBLOT
-- ──────────────────────────────────────────────────────────────

UPDATE bottiglie SET
  provenienza_uve = 'Lieu-dit Le Clos, Vrigny (Massif de Saint-Thierry) — suolo sabbioso misto ad argilla',
  vini_base       = 'Interamente dalla vendemmia 2020',
  vinificazione   = 'Demi-muid da 600 litri, 24 mesi di élevage',
  note_vigneto    = 'Il vigneto porta il soprannome affettuoso della bisnonna di Alexandre Lamblot: un omaggio familiare trasformato in etichetta. Le vigne crescono sul suolo sabbioso di Vrigny, nel Massif de Saint-Thierry — zona meno esplorata della Champagne, dove il Pinot Meunier trova un''espressione unica, più morbida e avvolgente. Affinamento prolungato in demi-muid da 600 litri per costruire rotondità e profondità.'
WHERE slug = 'a-lamblot-la-vigne-a-vovonne';

UPDATE bottiglie SET
  provenienza_uve = 'Lieu-dit Les Cochènes, Chenay (Massif de Saint-Thierry) — suolo sabbioso',
  vini_base       = 'Interamente dalla vendemmia 2020',
  vinificazione   = 'Demi-muid da 400 litri',
  note_vigneto    = 'Blanc de Noirs da un''unica parcella su suolo sabbioso a Chenay, piantata nel 1990. Il Massif de Saint-Thierry è un territorio viticolo a sé stante, lontano dai Grand Cru classici: i suoi suoli leggeri danno al Pinot Noir una struttura più tenue ma una bevibilità e un''immediatezza rare nel panorama champenois.'
WHERE slug = 'a-lamblot-les-cochenes';

UPDATE bottiglie SET
  provenienza_uve = 'Vrigny, Janvry e Chenay (Massif de Saint-Thierry) — vigne da 21 a 60 anni',
  vini_base       = '50% base 2021, 50% réserve perpétuelle da annate 2017–2021',
  vinificazione   = 'Barrique e demi-muid in proporzioni variabili per lotto',
  note_vigneto    = 'Cuvée che cambia identità a ogni uscita — il nome non è casuale. L''assemblaggio attinge a vigne tra i 21 e i 60 anni in tre comuni del Massif de Saint-Thierry: Vrigny, Janvry e Chenay. La réserve perpétuelle di Pinot Noir costruita sulle annate 2017–2021 è il cuore del blend, contribuendo complessità temporale a ogni disgorgiamento. Una bottiglia che racconta lo stile di Alexandre Lamblot in continua evoluzione.'
WHERE slug = 'a-lamblot-mouvance-21';


-- ──────────────────────────────────────────────────────────────
-- ALEXANDRE BONNET
-- ──────────────────────────────────────────────────────────────

UPDATE bottiglie SET
  provenienza_uve = 'Parcella omonima a Les-Riceys, Côte des Bar — suolo Kimmeridgiano, 220 m s.l.m., esposizione est',
  vini_base       = 'Esclusivamente dalla vendemmia 2019',
  vinificazione   = 'Vasche inox (cuve)',
  note_vigneto    = 'Singola parcella a quota 220 metri sul livello del mare, esposta a est su suoli Kimmeridgiani a Les-Riceys, nella Côte des Bar. Lo stesso calcare delle migliori parcelle di Chablis conferisce al Pinot Noir una mineralità tesa e una freschezza acida fuori dal comune per questa zona della Champagne, dove il clima più continentale porta generalmente frutto più maturo e morbido.'
WHERE slug = 'alexandre-bonnet-les-vignes-blanches-2019';

UPDATE bottiglie SET
  provenienza_uve = 'Lieux-dits Le Velue e Valingrain a Les-Riceys, Côte des Bar',
  vini_base       = 'Esclusivamente dalla vendemmia 2020',
  vinificazione   = 'Vasche inox con macerazione controllata sulle bucce',
  note_vigneto    = 'Rosé millesimato da Pinot Noir selezionato in due lieux-dits di Les-Riceys: Le Velue e Valingrain. La macerazione sulle bucce è condotta in modo calibrato per estrarre colore e struttura senza le durezze di un vino rosso. Les-Riceys è celebre per il suo rosato fermo (Rosé des Riceys AOC) e questi champagne di macerazione si inseriscono coerentemente in questa tradizione locale.'
WHERE slug = 'alexandre-bonnet-rose-de-maceration-2020';


-- ──────────────────────────────────────────────────────────────
-- ALEXANDRE FILAINE
-- ──────────────────────────────────────────────────────────────

UPDATE bottiglie SET
  provenienza_uve = 'Damery (Vallée de la Marne) — vigne di varia età',
  vini_base       = '60% base 2021, 40% base 2020',
  vinificazione   = 'Barrique e demi-muid',
  note_vigneto    = 'La sigla DMY sta per Damery Meunier Years: un omaggio al villaggio in cui affondano le radici delle vigne di Fabrice Gass. Questo non millesimato a dominante Pinot Meunier — con una quota di Pinot Noir — riflette il carattere brioche e fruttato del Meunier champenois, vinificato in legno per aggiungere sostanza e rotondità al profilo.'
WHERE slug = 'alexandre-filaine-dmy';

UPDATE bottiglie SET
  provenienza_uve = '4 lieux-dits storici a Damery (Vallée de la Marne): Le Mur Blanchet, Le Champ du Coq, Les Pierres e altri — vigne 1978',
  vini_base       = 'Esclusivamente dalla vendemmia 2019',
  vinificazione   = 'Barrique e demi-muid per lotti separati',
  note_vigneto    = 'Tête de cuvée millesimata dalle vigne storiche della maison, tutte piantate nel 1978 con selezione massale. Quattro lieux-dits di Damery — Le Mur Blanchet, Le Champ du Coq e Les Pierres tra gli altri — confluiscono in un solo vino che racchiude la profondità del terroir della Vallée de la Marne. Le vecchie viti, con rese naturalmente basse, massimizzano la concentrazione e la complessità aromatica.'
WHERE slug = 'alexandre-filaine-sensuum-vertigo-2019';

UPDATE bottiglie SET
  provenienza_uve = 'Damery (Vallée de la Marne)',
  vini_base       = '60% base 2023, 40% base 2022',
  vinificazione   = 'Barrique e demi-muid',
  note_vigneto    = 'Il champagne di punta della gamma Filaine, identificato da una semplice sigla per distinguerlo nettamente dall''universo dei grandi marchi. L''Sp nasce da un assemblaggio di vigne di Damery a prevalenza di Pinot Meunier, vinificato in legno tra barrique e demi-muid. Fabrice Gass cerca un profilo che unisca freschezza e morbidezza, la bevibilità immediata di un non millesimato artigianale rigoroso.'
WHERE slug = 'alexandre-filaine-sp';


-- ──────────────────────────────────────────────────────────────
-- ALFRED GRATIEN
-- ──────────────────────────────────────────────────────────────

UPDATE bottiglie SET
  provenienza_uve = 'Clos omonimo di 19,5 are a Cumières, Premier Cru (Vallée de la Marne)',
  vini_base       = 'Esclusivamente dalla vendemmia 2018',
  vinificazione   = 'Barrique di Chablis usate',
  note_vigneto    = 'Un clos di soli 19,5 are — meno di un quinto di ettaro — a Cumières Premier Cru, individuato dal chef de cave Nicolas Jaeger durante le sue esplorazioni del territorio. Questo piccolo appezzamento restituisce un Pinot Noir di finezza straordinaria, interpretato con le barrique di Chablis usate che sono la firma centenaria di Alfred Gratien: legno integrato, rispettoso del frutto.'
WHERE slug = 'alfred-gratien-clos-le-village-2018';

UPDATE bottiglie SET
  provenienza_uve = 'Selezione dai migliori Grand Cru e Premier Cru entro 40 km da Épernay — fornitori partner storici',
  vini_base       = 'Esclusivamente dalla vendemmia 2016',
  vinificazione   = 'Barrique di Chablis usate, selezione annuale delle migliori partite',
  note_vigneto    = 'La cuvée di punta di Alfred Gratien nasce ogni anno da una scelta meticolosa: Nicolas Jaeger assaggia barrique per barrique entro 40 km da Épernay, selezionando solo le migliori partite — per la maggior parte da Grand Cru. Il 2016 era un''annata difficile, ma la rigorosità della selezione l''ha trasformata in un millésimé di carattere proprio, con tensione e verticalità inattese.'
WHERE slug = 'alfred-gratien-cuvee-paradis-2016';

UPDATE bottiglie SET
  provenienza_uve = 'Selezione Grand Cru e Premier Cru entro 40 km da Épernay; vino rosso da Bouzy per l''assemblaggio rosato',
  vini_base       = 'Esclusivamente dalla vendemmia 2008',
  vinificazione   = 'Barrique di Chablis con almeno 15 anni d''uso; vino rosso di Bouzy vinificato separatamente',
  note_vigneto    = 'La versione rosata della cuvée di punta richiede una selezione ulteriore rispetto alla bianca. Il vino rosso di Bouzy — vinificato anch''esso in barrique di Chablis di almeno 15 anni d''uso — viene integrato in proporzione precisa. La vendemmia 2008, straordinaria per acidità e longevità in Champagne, ha già raggiunto una maturità espressiva di raro equilibrio. Tra le più rare uscite della maison.'
WHERE slug = 'alfred-gratien-cuvee-paradis-rose-2008';


-- ──────────────────────────────────────────────────────────────
-- ANDRÉ BEAUFORT
-- ──────────────────────────────────────────────────────────────

UPDATE bottiglie SET
  provenienza_uve = 'Polisy (Barséquanais, Aube) — suoli Kimmeridgiani',
  vini_base       = 'Interamente dalla vendemmia 2022',
  vinificazione   = 'Barrique usate (minimo 3-4 anni d''uso)',
  note_vigneto    = 'Lo champagne senza dosaggio di Polisy riflette la filosofia integrale di André Beaufort: nessun intervento chimico, affinamento in barrique usate di almeno 3-4 anni. Polisy, nel Barséquanais (Aube), ha suoli Kimmeridgiani che donano ai Pinot Noir una struttura rotonda e una mineralità discreta — terroir particolarmente adatto al profilo secco e austero del Brut Nature.'
WHERE slug = 'andre-beaufort-reserve-polisy-brut-nature';

UPDATE bottiglie SET
  provenienza_uve = 'Polisy (Barséquanais, Aube) — suoli Kimmeridgiani',
  vini_base       = 'Esclusivamente dalla vendemmia 2017',
  vinificazione   = 'Barrique usate',
  note_vigneto    = 'Il millesimato di Polisy attende in cantina fino a quando la famiglia ne decide la sboccatura, senza pianificare finestre di degustazione predefinite. Il 2017 proviene dallo stesso terroir Kimmeridgiano del Sans Année: un anno più fresco della media, che ha sviluppato nel tempo una complessità minerale e austera in linea con lo stile biodinamico della maison.'
WHERE slug = 'andre-beaufort-polisy-millesime-2017';

UPDATE bottiglie SET
  provenienza_uve = 'Polisy (Barséquanais, Aube) — suoli Kimmeridgiani',
  vini_base       = 'Esclusivamente dalla vendemmia 2004',
  vinificazione   = 'Barrique usate',
  note_vigneto    = 'Vent''anni in cantina prima della sboccatura: i Beaufort degorgiano secondo la propria sensibilità, non secondo calendari commerciali. Il millesimo 2004 di Polisy è un''eccezione storica: suoli Kimmeridgiani, conduzione biodinamica, barrique usate e zero dosaggio convergono in una bottiglia che documenta la straordinaria longevità del Pinot Noir del Barséquanais.'
WHERE slug = 'andre-beaufort-polisy-millesime-2004';


-- ──────────────────────────────────────────────────────────────
-- ANDRÉ ROBERT
-- ──────────────────────────────────────────────────────────────

UPDATE bottiglie SET
  provenienza_uve = '7 lieux-dits nel solo comune di Le-Mesnil-sur-Oger, Grand Cru (Côte des Blancs)',
  vini_base       = '68% base 2020, 32% réserve perpétuelle da annate precedenti',
  vinificazione   = 'Vasche inox (49%) e barrique (51%), 10 mesi di élevage',
  note_vigneto    = 'Sette lieux-dits di Le-Mesnil-sur-Oger Grand Cru — Les Finciarts, Les Playons, Les Coullemets e altri — convergono in un assemblaggio che è la carta d''identità più articolata del comune più verticale della Côte des Blancs. Il 51% di barrique introduce struttura senza appesantire; la réserve perpétuelle aggiunge memoria storica a ogni disgorgiamento.'
WHERE slug = 'andre-robert-les-jardins-du-mesnil';

UPDATE bottiglie SET
  provenienza_uve = 'Montigny-sous-Châtillon, Vallée de la Marne',
  vini_base       = 'Interamente dalla vendemmia 2021',
  vinificazione   = 'Barrique da 228 litri, 10 mesi di élevage',
  note_vigneto    = 'Incursione nella Vallée de la Marne per un domaine radicato al Mesnil: Jean-Baptiste Robert coltiva parcelle di Pinot Noir a Montigny-sous-Châtillon, dove i suoli sono profondamente diversi dalla craie bianca della Côte des Blancs. Il risultato è un Blanc de Noirs con un profilo fruttato più generoso e avvolgente, interpretato in barrique da 228 litri per 10 mesi.'
WHERE slug = 'andre-robert-les-vignes-de-montigny';

UPDATE bottiglie SET
  provenienza_uve = 'Selezione parcellare a Le-Mesnil-sur-Oger, Grand Cru — lieux-dits Les Vaucherots e Les Coullemets',
  vini_base       = 'Esclusivamente dalla vendemmia 2019',
  vinificazione   = 'Barrique da 228 litri, 10 mesi di élevage',
  note_vigneto    = 'Millesimato di punta del domaine, frutto di una selezione parcellare annuale a Le-Mesnil-sur-Oger. Per il 2019, Jean-Baptiste Robert ha scelto Les Vaucherots e Les Coullemets, lieux-dits con viti di oltre 40 anni. L''affinamento in barrique da 228 litri per 10 mesi aggiunge struttura senza soffocare la mineralità gessosa che è la firma inconfondibile del Grand Cru del Mesnil.'
WHERE slug = 'andre-robert-terre-du-mesnil-2019';


-- ──────────────────────────────────────────────────────────────
-- ANTOINE BOUVET
-- ──────────────────────────────────────────────────────────────

UPDATE bottiglie SET
  provenienza_uve = 'Lieu-dit Aux Plantels, Avenay-Val-d''Or — due parcelle adiacenti',
  vini_base       = '50% base 2020, 50% base 2019',
  vinificazione   = 'Barrique e demi-muid con élevage di durata variabile per lotto (9–21 mesi)',
  note_vigneto    = 'Blanc de Blancs monovillaggio da un singolo lieu-dit di Avenay-Val-d''Or: Aux Plantels, formato da due parcelle adiacenti su suoli calcarei. Avenay è uno dei comuni meno celebrati della Montagne de Reims eppure i suoi Chardonnay producono una delicatezza floreale che contrasta piacevolmente con la ricchezza del legno. Barrique e demi-muid per élevage di durata differente costruiscono texture senza sacrificare la freschezza.'
WHERE slug = 'antoine-bouvet-avenay-val-d-or';

UPDATE bottiglie SET
  provenienza_uve = 'Avenay-Val-d''Or, Mareuil e Bisseuil — zona di confine Montagne/Marne',
  vini_base       = '60% base 2022, 40% da annate 2021 e 2020',
  vinificazione   = 'Barrique e demi-muid, 9 mesi di élevage',
  note_vigneto    = 'La cuvée simbolo della maison attinge a vigne di circa 40 anni distribuite su tre comuni tra loro contigui: Avenay-Val-d''Or, Mareuil e Bisseuil, nella zona di confine tra Montagne de Reims e Vallée de la Marne. La vinificazione in legno per 9 mesi dona struttura e rotondità; il blend Pinot Noir / Chardonnay persegue un equilibrio tra freschezza e sostanza che è la cifra stilistica di Antoine Bouvet.'
WHERE slug = 'antoine-bouvet-les-monts-de-la-vallee';

UPDATE bottiglie SET
  provenienza_uve = 'Avenay-Val-d''Or, Mareuil e Bisseuil',
  vini_base       = 'Interamente dalla vendemmia 2022',
  vinificazione   = 'Barrique e demi-muid, 9 mesi di élevage; aggiunta di vino rosso per il colore',
  note_vigneto    = 'La versione rosata della cuvée principale di Bouvet nasce da un assemblaggio più strutturato di un semplice saignée: 90% Pinot Noir di cui una quota co-fermentata con le bucce, completata da Chardonnay per freschezza e verticalità. Stessi comuni di origine (Avenay, Mareuil, Bisseuil), stesso approccio in legno: un rosato di carattere e personalità decisa.'
WHERE slug = 'antoine-bouvet-les-monts-de-la-vallee-rose';


-- ──────────────────────────────────────────────────────────────
-- AR LENOBLE
-- ──────────────────────────────────────────────────────────────

UPDATE bottiglie SET
  provenienza_uve = 'Bisseuil (Vallée de la Marne, Premier Cru), Chouilly (Grand Cru) e Damery',
  vini_base       = '49% base 2021, 51% réserve perpétuelle di Pinot Noir e Chardonnay',
  vinificazione   = 'Vasche inox (90%) e barrique (10%)',
  note_vigneto    = 'Il grande non millesimato di Lenoble, rinominato con una sigla che identifica il millesimo di base. I tre cru storici della maison — Bisseuil, Chouilly e Damery — si assemblano in proporzioni annuali variabili, integrati da una réserve perpétuelle che porta profondità storica. La quota di barrique (10%) introduce tridimensionalità senza appesantire la struttura principale.'
WHERE slug = 'ar-lenoble-extra-brut-v21';

UPDATE bottiglie SET
  provenienza_uve = 'Bisseuil, Vallée de la Marne (Premier Cru) — suoli argillo-calcarei',
  vini_base       = 'Esclusivamente dalla vendemmia 2016',
  vinificazione   = 'Botti da 50 hl e barrique da 228 litri, in proporzioni variabili',
  note_vigneto    = 'Sesta uscita di una serie di Blanc de Noirs monovillaggio da Bisseuil Premier Cru, avviata con la vendemmia 1998. Il millesimo 2016 documenta la capacità di invecchiamento del Pinot Noir di Bisseuil: meno celebre di Aÿ o Bouzy, ma i suoli argillo-calcarei profondi restituiscono struttura e longevità notevoli. Vinificazione in botti da 50 hl e barrique da 228 litri per un profilo bilanciato.'
WHERE slug = 'ar-lenoble-blanc-de-noirs-2016';

UPDATE bottiglie SET
  provenienza_uve = 'Selezione parcellare a Chouilly, Grand Cru (Côte des Blancs) — tre lieux-dits',
  vini_base       = 'Esclusivamente dalla vendemmia 2012',
  vinificazione   = 'Vasche inox (80%) e barrique (20%), 7 mesi di élevage',
  note_vigneto    = 'Blanc de Blancs millesimato da selezione parcellare a Chouilly Grand Cru — il cru più morbido della Côte des Blancs, con suoli argillo-gessosi che donano un Chardonnay più vellutato di Le Mesnil ma di grande eleganza. Tre lieux-dits vinificati separatamente, poi assemblati con una quota di barrique (20%) che aggiunge tridimensionalità alla mineralità di fondo. Il 2012 ha dimostrato una longevità straordinaria per questa cuvée.'
WHERE slug = 'ar-lenoble-gentilhomme-2012';


-- ──────────────────────────────────────────────────────────────
-- ASSAILLY
-- ──────────────────────────────────────────────────────────────

UPDATE bottiglie SET
  provenienza_uve = 'Lieu-dit Les Bauves, Cramant Grand Cru (Côte des Blancs) — viti di 40 anni',
  vini_base       = 'Interamente dalla vendemmia 2018 (non rivendicata in etichetta)',
  vinificazione   = 'Demi-muid da 300 e 500 litri con bâtonnage regolare',
  note_vigneto    = 'Il primo parcellaire della maison Assailly, nato nel 2010 e ribattezzato per ragioni legali. La parcella Les Bauves a Cramant Grand Cru — viti di 40 anni su calcare puro — è vinificata separatamente in demi-muid da 300 e 500 litri con bâtonnage regolare. Un Blanc de Blancs di carattere artigianale che racconta la storia familiare dei fratelli Assailly attraverso la chiarezza minerale del Grand Cru di Cramant.'
WHERE slug = 'assailly-p-assailly';

UPDATE bottiglie SET
  provenienza_uve = 'Lieu-dit Les Monts Chéneveaux, Avize Grand Cru (Côte des Blancs) — viti ultracinquantenarie',
  vini_base       = 'Esclusivamente dalla vendemmia 2013',
  vinificazione   = 'Demi-muid da 300 litri',
  note_vigneto    = 'Millesimato da una singola parcella di oltre 60 anni nel lieu-dit Les Monts Chéneveaux, sul versante meridionale di Avize Grand Cru. Il 2013 è stato un''annata difficile in Champagne — piccola e tardiva — ma le vecchie viti di Avize, con apparato radicale profondo nel calcare, hanno prodotto un vino di concentrazione e acidità notevoli, che si è evoluto negli anni verso una complessità minerale di grande carattere.'
WHERE slug = 'assailly-millesime-2013';

UPDATE bottiglie SET
  provenienza_uve = 'Tre lieux-dits tra Avize e Cramant Grand Cru: La Fosse aux Pourceaux, La Voie d''Epernay, Les Bauves',
  vini_base       = 'Interamente dalla vendemmia 2018 (non rivendicata in etichetta)',
  vinificazione   = 'Demi-muid da 300 e 600 litri, parcelle separate',
  note_vigneto    = 'Assemblaggio di tre vecchie parcelle tra Avize e Cramant Grand Cru: La Fosse aux Pourceaux, La Voie d''Epernay e Les Bauves. Tre lieux-dits, due comuni, un solo terroir calcareo d''eccellenza. Le viti — alcune ultracentenarie — sono coltivate con pratiche bio e vinificate separatamente in demi-muid, poi assemblate per creare un Blanc de Blancs di complessità mosaicata.'
WHERE slug = 'assailly-parcellaires';


-- ──────────────────────────────────────────────────────────────
-- BENOÎT LAHAYE
-- ──────────────────────────────────────────────────────────────

UPDATE bottiglie SET
  provenienza_uve = 'Bouzy e Ambonnay (Grand Cru della Montagne de Reims)',
  vini_base       = '50% base 2021, 50% réserve perpétuelle da annate precedenti',
  vinificazione   = 'Barrique usate e botte, senza soutirage',
  note_vigneto    = 'Lo champagne senza dosaggio di Lahaye è il vino d''ingresso per capirne la filosofia: stessa origine Grand Cru (Bouzy e Ambonnay), stessa struttura produttiva, zero interferenze. La réserve perpétuelle costruisce profondità temporale; la vinificazione in barrique usate e botte senza soutirage rispetta la texture naturale del Pinot Noir senza levigarne le asperità.'
WHERE slug = 'benoit-lahaye-brut-nature';

UPDATE bottiglie SET
  provenienza_uve = 'Due parcelle adiacenti a Bouzy Grand Cru: Les Vaux Bitins e Raies Tortues — viti oltre 30 anni',
  vini_base       = 'Interamente dalla vendemmia 2021 (non millesimato in etichetta)',
  vinificazione   = 'Barrique usate, senza soutirage',
  note_vigneto    = 'Due parcelle adiacenti nel Grand Cru di Bouzy — Les Vaux Bitins e Raies Tortues, viti di oltre 30 anni — convergono nel vino-simbolo della maison. Benoît Lahaye vinifica in barrique usate senza soutirage, lasciando al Pinot Noir la sua espressione naturale: struttura tannica, profondità cromatica, mineralità ferrosa caratteristica del suolo di Bouzy.'
WHERE slug = 'benoit-lahaye-blanc-de-noirs';

UPDATE bottiglie SET
  provenienza_uve = 'Parcella Grosse Pierre a Bouzy Grand Cru — complantation di 7 varietà, piantata nel 1923',
  vini_base       = 'Esclusivamente dalla vendemmia 2020',
  vinificazione   = 'Barrique usate, senza soutirage',
  note_vigneto    = 'Una parcella piantata nel 1923 in cui convivono tutte e sette le varietà autorizzate in Champagne: è il complant, simbolo vivente della viticoltura pre-moderna. Le proporzioni tra i vitigni rispecchiano la composizione naturale della vigna — non vengono corrette — rendendo ogni millesimo un ritratto irripetibile. Il 2020, caldo e generoso, esprime la ricchezza dell''annata filtrata dalla mineralità profonda del Bouzy Grand Cru.'
WHERE slug = 'benoit-lahaye-le-jardin-de-la-grosse-pierre-2020';

UPDATE bottiglie SET
  provenienza_uve = 'Lieu-dit Les Monts de Tauxières, Bouzy Grand Cru — viti del 1966',
  vini_base       = 'Esclusivamente dalla vendemmia 2014',
  vinificazione   = 'Barrique usate, senza soutirage',
  note_vigneto    = 'Vigna del 1966 nel lieu-dit Les Monts de Tauxières a Bouzy Grand Cru: quasi 60 anni di radici nel calcare producono una concentrazione difficile da eguagliare. La vendemmia 2014 — precisa, acida, austera da giovane — ha sviluppato nel tempo una complessità minerale che ricompensa la pazienza. Benoît Lahaye vinifica senza soutirage e senza interventi correttivi: la natura lavora, la cantina rispetta.'
WHERE slug = 'benoit-lahaye-millesime-2014';

UPDATE bottiglie SET
  provenienza_uve = 'Les Monts des Tours a Bouzy Grand Cru (Pinot Noir) e Les Argentières a Tauxières (Chardonnay)',
  vini_base       = 'Esclusivamente dalla vendemmia 2020',
  vinificazione   = 'Barrique usate, senza soutirage, zero solfiti aggiunti',
  note_vigneto    = 'La cuvée-manifesto di Benoît Lahaye: monoannata, zero dosaggio e zero solfiti aggiunti — una scelta radicale che richiede vigne in perfetta salute e cantina impeccabile. Il Pinot Noir di Bouzy (Les Monts des Tours) e lo Chardonnay di Tauxières (Les Argentières) si fondono in un blend di rara coerenza. Il 2020 porta frutto maturo che bilancia la tensione naturale del vino senza zucchero né correzioni.'
WHERE slug = 'benoit-lahaye-violaine-2020';


-- ──────────────────────────────────────────────────────────────
-- BENOÎT MUNIER
-- ──────────────────────────────────────────────────────────────

UPDATE bottiglie SET
  provenienza_uve = 'Quattro lieux-dits a Cramant Grand Cru: Les Bauves, Les Bas Bourons, La Crayère, Les Moyens du Couchant',
  vini_base       = 'Esclusivamente dalla vendemmia 2019',
  vinificazione   = 'Barrique e demi-muid, 9 mesi di élevage',
  note_vigneto    = 'Quattro piccole parcelle nel Grand Cru di Cramant — Les Bauves, Les Bas Bourons, La Crayère e Les Moyens du Couchant — convergono in questo Blanc de Blancs. Cramant è uno dei cru più reputati della Côte des Blancs, con suoli gessosi profondi che donano fragranza, mineralità e tensione acida naturale. L''affinamento in barrique e demi-muid per 9 mesi aggiunge texture senza coprire il terroir.'
WHERE slug = 'benoit-munier-l-ours-2019';

UPDATE bottiglie SET
  provenienza_uve = 'Lieu-dit Les Avats du Levant, Avize Grand Cru (Côte des Blancs) — 20 are, viti 1956',
  vini_base       = 'Esclusivamente dalla vendemmia 2017',
  vinificazione   = 'Barrique, 7 mesi di élevage',
  note_vigneto    = 'La parcella principale di Benoît Munier: 20 are nel lieu-dit Les Avats du Levant ad Avize Grand Cru, viti piantate nel 1956 con radici profonde nel calcare puro della Côte des Blancs. Il 2017 è stato l''anno delle gelate tardive devastanti in Champagne, ma le viti anziane — con apparato radicale che raggiunge il calcare madre — hanno superato meglio degli impianti giovani la crisi, producendo un millesimo di concentrazione e mineralità straordinarie.'
WHERE slug = 'benoit-munier-les-avats-du-levant-2017';


-- ──────────────────────────────────────────────────────────────
-- BÉRÊCHE ET FILS
-- ──────────────────────────────────────────────────────────────

UPDATE bottiglie SET
  provenienza_uve = 'Due lieux-dits a Mareuil-le-Port: Maisoncelle e La Côte aux Châtaigniers (riva sinistra della Marne)',
  vini_base       = 'Esclusivamente dalla vendemmia 2020',
  vinificazione   = 'Barrique, tiraggio sous liège',
  note_vigneto    = 'Blanc de Noirs da 100% Meunier in purezza, dalla riva sinistra della Marne che dà il nome alla cuvée. Per il millesimo 2020 vengono impiegati due lieux-dits di Mareuil-le-Port: Maisoncelle e La Côte aux Châtaigniers. Il Meunier di Bérêche è lontano dall''idea di vitigno secondario: vinificato sous liège e affinato in barrique, rivela una profondità e una longevità che sfidano i preconcetti su questo vitigno.'
WHERE slug = 'bereche-rive-gauche-2020';

UPDATE bottiglie SET
  provenienza_uve = 'Parcella complantée di 71 are a Ormes, Montagne de Reims (65% PN, 25% CH, 10% Meunier)',
  vini_base       = 'Esclusivamente dalla vendemmia 2020; aggiunta di Coteaux Champenois rouge dalla stessa parcella',
  vinificazione   = 'Barrique per il bianco; vino rosso da saignée separata — tiraggio sous liège',
  note_vigneto    = 'Rosé millesimato da una vecchia parcella complantée di 71 are a Ormes, Montagne de Reims. La proporzione delle tre varietà (65% Pinot Noir, 25% Chardonnay, 10% Meunier) rispecchia la composizione naturale del vigneto. Il vino rosso aggiunto è un Coteaux Champenois rouge prodotto dalla stessa parcella: rosé che nasce dal territorio, non da scelte di cantina.'
WHERE slug = 'bereche-campania-remenis-2020';

UPDATE bottiglie SET
  provenienza_uve = 'Mailly-Champagne Grand Cru — parcelle Les Chalois (al confine con Verzenay) e Les Barrisets',
  vini_base       = 'Esclusivamente dalla vendemmia 2019',
  vinificazione   = 'Barrique, tiraggio sous liège',
  note_vigneto    = 'Blanc de Noirs esclusivamente da Pinot Noir nel Grand Cru Mailly-Champagne. Per il 2019 vengono selezionate due delle parcelle consuetudinarie: Les Chalois, al confine con Verzenay, e Les Barrisets. Mailly-Champagne è il Grand Cru più settentrionale della Montagne de Reims — suoli gessosi su marne di Micraster che conferiscono al Pinot Noir una texture calcarea e salina di grande originalità.'
WHERE slug = 'bereche-mailly-champagne-2019';

UPDATE bottiglie SET
  provenienza_uve = 'Vigne di proprietà tra Ludes, Trépail, Ormes e Mareuil-le-Port',
  vini_base       = '70% base 2018, 30% réserve perpétuelle da annate 1982–2017',
  vinificazione   = 'Barrique, tiraggio sous liège; formato esclusivo magnum 1,5 L',
  note_vigneto    = 'Il grande assemblaggio della gamma Bérêche, prodotto unicamente in magnum da 1,5 litri (1.200 pezzi per annata). Vigne distribuite tra Ludes, Trépail, Ormes e Mareuil-le-Port formano la base della vendemmia 2018; il restante 30% è una réserve perpétuelle costruita da Raphaël e Vincent nel corso di decenni, con annate risalenti al 1982. Un vino di memoria e profondità raramente eguagliato tra i non millesimati champenois.'
WHERE slug = 'bereche-reflet-d-antan';


-- ──────────────────────────────────────────────────────────────
-- BESSERAT DE BELLEFON
-- ──────────────────────────────────────────────────────────────

UPDATE bottiglie SET
  provenienza_uve = 'Sei Grand Cru della Côte des Blancs: Cramant, Le-Mesnil-sur-Oger, Oger, Avize, Chouilly e Oiry',
  vini_base       = 'Interamente dalla vendemmia 2017 (non rivendicata in etichetta)',
  vinificazione   = 'Vasche in acciaio inossidabile',
  note_vigneto    = 'Tutti e sei i comuni classificati al 100% della Côte des Blancs confluiscono in questo Blanc de Blancs: Cramant, Le Mesnil, Oger, Avize, Chouilly e Oiry. Un assemblaggio che è prima di tutto una dichiarazione geografica — la possibilità, riservata a poche maison con accesso a tutti questi Grand Cru, di costruire la complessità attraverso la diversità territoriale piuttosto che attraverso l''affinamento in legno.'
WHERE slug = 'besserat-de-bellefon-blanc-de-blancs';

UPDATE bottiglie SET
  provenienza_uve = 'Oltre 50 cru della Vallée de la Marne, con 3 Grand Cru e 5 Premier Cru',
  vini_base       = 'Interamente dalla vendemmia 2017 (non rivendicata in etichetta); più 11% vino rosso Coteaux Champenois',
  vinificazione   = 'Vasche in acciaio inossidabile; vino rosso vinificato separatamente',
  note_vigneto    = 'Rosé di grande assemblaggio nato nella prima metà degli anni ''70, quando pochi produttori investivano su questa tipologia. Oggi attinge a oltre 50 cru della Vallée de la Marne, integrati da 11% di vino rosso Coteaux Champenois per struttura e colore. La Maison Besserat ha progressivamente affinato la selezione delle fonti per offrire un rosato di equilibrio e ampiezza con identità aromatica sempre più definita nel tempo.'
WHERE slug = 'besserat-de-bellefon-rose-brut';

UPDATE bottiglie SET
  provenienza_uve = 'Mailly, Ambonnay, Avize, Chouilly, Le-Mesnil-sur-Oger, Grauves, Vertus, Boursault',
  vini_base       = 'Esclusivamente dalla vendemmia 2012',
  vinificazione   = 'Vasche in acciaio inossidabile',
  note_vigneto    = 'La Cuvée des Moines è la firma storica di Besserat de Bellefon, un richiamo alla tradizione monastica della Champagne. Il millesimo 2012 — anno di precisione e acidità strutturata nella regione — viene proposto in questa veste di prestigio: otto comuni tra Grand Cru e Premier Cru, assemblati in acciaio per preservare la freschezza e lasciare che l''annata si esprima nella sua forma più pura.'
WHERE slug = 'besserat-de-bellefon-cuvee-des-moines-2012';


-- ──────────────────────────────────────────────────────────────
-- BILLECART-SALMON
-- ──────────────────────────────────────────────────────────────

UPDATE bottiglie SET
  provenienza_uve = 'Vallée de la Marne, Côte des Blancs, Montagne de Reims e Vitryat',
  vini_base       = '29% base 2020, 71% vini di riserva su 15 annate (con réserve perpétuelle 2006–2019)',
  vinificazione   = 'Vasche inox (92%) e botte (8%)',
  note_vigneto    = 'Il Brut di riferimento di Billecart-Salmon ha acquisito precisione e carattere grazie a due scelte precise: l''allargamento dell''area di approvvigionamento al Vitryat e la costruzione di una réserve perpétuelle a partire dal 2006. Con 71% di vini di riserva su 15 annate, questo non millesimato offre una complessità insolita per la sua categoria, che evolve disgorgiamento dopo disgorgiamento.'
WHERE slug = 'billecart-salmon-le-reserve';

UPDATE bottiglie SET
  provenienza_uve = 'Vallée de la Marne, Côte des Blancs, Montagne de Reims e Vitryat',
  vini_base       = '63% base 2018, 37% vini di riserva 2006–2017 (réserve perpétuelle in botte)',
  vinificazione   = 'Botte e barrique con réserve perpétuelle in botte grande',
  note_vigneto    = 'Nato con la vendemmia 2007, Le Sous Bois rappresenta il ritorno al legno da parte di Billecart-Salmon dopo decenni di affinamento prevalentemente in inox. La réserve perpétuelle in botte porta continuità e profondità a ogni disgorgiamento. Stesso approvvigionamento geografico del Brut Réserve, ma interpretato attraverso il legno: profilo più ricco, maturità più evidente, complessità diversa.'
WHERE slug = 'billecart-salmon-le-sous-bois';

UPDATE bottiglie SET
  provenienza_uve = 'Vallée de la Marne, Côte des Blancs, Montagne de Reims e Vitryat',
  vini_base       = '44% base 2021, 56% assemblaggio su annate 2020–2018; vini rossi da Pinot Noir',
  vinificazione   = 'Vasche inox per le basi bianche; vini rossi vinificati separatamente in acciaio',
  note_vigneto    = 'Il rosato iconico della maison, lanciato negli anni ''70 con Jean Billecart come punto di rottura con i rosé champenois del tempo. La proporzione di Chardonnay (45%) — insolita per un rosé — dona freschezza e finezza che distinguono questo vino dalla massa. I vini rossi vengono vinificati in acciaio per preservarne la purezza del frutto prima dell''assemblaggio. La malolattica parziale mantiene vivacità acida e verve.'
WHERE slug = 'billecart-salmon-le-rose';

UPDATE bottiglie SET
  provenienza_uve = 'Aÿ 20% e Mareuil 10% (PN); Verzenay 30% (PN); Le-Mesnil 14%, Avize 12%, Chouilly 14% (CH) — tutti Grand/Premier Cru',
  vini_base       = 'Esclusivamente dalla vendemmia 2012',
  vinificazione   = 'Vasche inox (90%) e barrique (10%); malolattica parziale',
  note_vigneto    = 'La cuvée che omaggia il fondatore Nicolas-François Billecart è anche il millesimato di punta della maison. Il 2012 si distingue per la grande acidità e precisione: la selezione abbraccia i Grand Cru più rappresentativi — Aÿ, Verzenay, Le Mesnil, Avize e Chouilly. Vinificazione in prevalenza inox con quota di barrique (10%); malolattica parziale per preservare la freschezza distintiva di Billecart-Salmon.'
WHERE slug = 'billecart-salmon-cuvee-nicolas-francois-2012';

UPDATE bottiglie SET
  provenienza_uve = 'Grand Cru selezionati della Côte des Blancs: Le-Mesnil-sur-Oger, Avize, Chouilly',
  vini_base       = 'Esclusivamente dalla vendemmia 2013',
  vinificazione   = 'Vasche inox con quota di barrique; malolattica parziale',
  note_vigneto    = 'Il Blanc de Blancs millesimato di Billecart-Salmon, creato in omaggio a Louis Salmon che portò nel 1818 il proprio domaine nel blend matrimoniale da cui nacque la maison. La selezione del 2013 attinge esclusivamente ai Grand Cru della Côte des Blancs — principalmente Le Mesnil, Avize e Chouilly. Un millesimo austero per quantità ma di grande precisione e tensione minerale per i Blanc de Blancs.'
WHERE slug = 'billecart-salmon-cuvee-louis-salmon-2013';

UPDATE bottiglie SET
  provenienza_uve = 'Grand Cru selezionati della Montagne de Reims e Côte des Blancs — Pinot Noir da Aÿ e Mareuil',
  vini_base       = 'Esclusivamente dalla vendemmia 2013',
  vinificazione   = 'Vinificazione separata del Pinot Noir per il colore rosato; base inox con malolattica parziale',
  note_vigneto    = 'La cuvée che porta il nome di Élisabeth Salmon è la firma di lusso del rosato millesimato di Billecart-Salmon: da Pinot Noir Grand Cru, con vinificazione dedicata che la separa nettamente dal Brut Rosé. Il 2013, annata austera per la Champagne, ha prodotto un''Élisabeth di struttura raccolta ma di grande finezza e definizione aromatica. Un rosato pensato per l''invecchiamento.'
WHERE slug = 'billecart-salmon-cuvee-elisabeth-salmon-2013';


-- ──────────────────────────────────────────────────────────────
-- BOLIEU
-- ──────────────────────────────────────────────────────────────

UPDATE bottiglie SET
  provenienza_uve = 'Bassuet (70%), Lisse-en-Champagne e Val de Vière (Coteaux Vitryats)',
  vini_base       = '75% base 2016, 25% réserve perpétuelle in parti uguali tra cuve e foudre di rovere',
  vinificazione   = 'Acciaio inossidabile; un solo travaso, effettuato tardivamente',
  note_vigneto    = 'Il brut sans année di casa Bolieu è il vino d''ingresso al mondo di Charles e Sophie Leclerc. La base 2016 (75%) si integra con la réserve perpétuelle della cantina: metà conservata in cuve inox, metà in foudre di rovere. Quest''ultima porzione aggiunge una dimensione ossidativa calibrata senza mai uscire dal registro fresco dello Chardonnay del Vitryat. La scelta di un solo travaso tardivo è deliberata: la cantina non interviene più del necessario.'
WHERE slug = 'bolieu-fleur-de-craie';
