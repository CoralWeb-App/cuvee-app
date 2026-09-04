# Procedura inserimento bottiglie — Cuvée

Ricostruita il 2026-09-01 dopo smarrimento del file originale (mai versionato in git). Fonte: conversazioni salvate in `conversazioni/`, procedura definitiva del 2026-06-02, integrata con le correzioni del 2026-09-01.

## Regole assolute

1. **Zero testo copiato** da qualsiasi fonte (schede tecniche, siti rivenditori, note critici) — riformulare sempre con parole proprie.
2. **Note degustazione, note vigneto, abbinamenti** — testi originali, scritti come un sommelier esperto con 30 anni di esperienza in Champagne. Mai incollare/parafrasare minimamente da una fonte.
3. **"lo champagne"** — sempre, mai "il champagne".
4. **"Sans Année"** — mai "non vintage" o "NV" nel testo italiano.
5. **Mai citare la fonte nei campi visibili** (niente nomi di libri, siti, critici dentro `source`, `score_note`, ecc. — se si usa uno score di terzi, va solo il numero in `score_medio`; `score_note` riporta solo la fonte in codice neutro, es. "RP", "WS", "Decanter", "JD" — mai nomi propri di persone o libri non ufficiali).
6. **Mai INSERT sulla tabella `maison`** — i produttori esistono già o vanno verificati/aggiunti separatamente con la stessa cura.
7. **Mai colonne GENERATED nell'INSERT**: `id`, `nome_norm`, `created_at`, `updated_at`.

## Selezione delle cuvée — regola aggiunta il 2026-09-01

Inserire solo cuvée **stabili e sempre presenti in gamma**, quelle che il produttore fa costantemente ogni anno/ciclo. Escludere sempre, senza eccezioni e senza chiedere:
- Progetti collaborativi occasionali con altri vigneron (es. "Sapience" di Marguet, fatta insieme a Léclapart e Laval)
- Cuvée sperimentali, edizioni limitate una tantum, o annate singole non ripetute nel tempo
- Qualsiasi bottiglia sulla cui disponibilità/continuità nel tempo non si è sicuri al 100%

**Why:** L'utente il 2026-09-01 ha confermato: "assolutamente no, il dubbio non va bene quindi scartiamo... solo perfezione e sicurezza delle info al 100%". Se emerge un dubbio di questo tipo durante la ricerca, non lo si segnala nemmeno come dubbio nel riscontro finale: si scarta e basta, silenziosamente.

## Verifica dati tecnici — regola aggiunta il 2026-09-01, rafforzata dopo audit di 50 bottiglie

**Zero tolleranza per stime "plausibili" o "a stile della maison".** Prima di inserire qualsiasi bottiglia, **cercare la scheda tecnica reale della cuvée sul web** (sito del produttore, rivenditori seri, guide di settore, più fonti quando possibile per incrociare i dati). Solo dopo aver trovato dati verificabili si compilano i campi tecnici precisi:

- **`assemblaggio`** (annate/percentuali che compongono un Sans Année) — inserirlo **solo se la fonte lo conferma con certezza al 100%**. Se non si trova un dato verificato, il campo resta `NULL` — non va escluso a priori, va cercato per ogni bottiglia, ma mai stimato.
- Stesso criterio per `dosaggio_gl`, `pct_pinot_noir/chardonnay/meunier`, `maturazione_mesi`, `produzione_bottiglie`, `finestra_da/a`, `score_medio`: solo se trovati su una fonte verificabile. Se non si trova un dato con certezza, resta `NULL` — non si stima "a stile" della maison.
- Se dopo una ricerca ragionevole non si trova la scheda tecnica dettagliata, oppure se una bottiglia risulterebbe con troppi campi NULL per incertezza, **si salta completamente quella cuvée** e si passa alla successiva — non si inserisce comunque con troppi buchi.
- Verificare anche il **nome esatto della cuvée** (non solo i dati tecnici): capita che nomi plausibili non esistano davvero o siano stati dismessi/rinominati dal produttore nel tempo.

## Campo `assemblaggio` — ricerca OBBLIGATORIA per ogni bottiglia, rafforzata il 2026-09-03

Non è un campo opzionale da compilare "se capita di trovarlo" mentre si cerca altro. Per **ogni** Sans Année, la ricerca deve includere esplicitamente una query dedicata su annata base e percentuale di vini di riserva (es. `"<maison>" "<cuvée>" annata riserva dosage`, oppure in inglese `"base year" OR "reserve wines" percentage`) — allo stesso livello di priorità di uvaggio e dosaggio, non come ricerca accessoria. Se il dato emerge, va **sempre** strutturato nel campo `assemblaggio` in JSON (mai lasciato solo nel testo di `vinificazione`/`provenienza_uve`):
- Con annata nota: `[{"anno": 2019, "perc": 54}, {"perc": 46, "tipo": "riserva"}]`
- Senza annata specifica ma con percentuale: `[{"perc": 65}, {"perc": 35, "tipo": "riserva"}]`
- Riserva perpetua/solera con anno di avvio noto: `{"perc": N, "tipo": "riserva perpetua dal AAAA"}`

**Why:** L'utente il 2026-09-03 ha scoperto che su ~228 bottiglie inserite in pochi giorni, 209 avevano `assemblaggio` NULL — non perché il dato non esistesse, ma perché la ricerca dedicata non veniva mai fatta sistematicamente. "Se ti dico di fare attenzione a tutti devi farlo... quei dati sono i più importanti, l'utente si aspetta un'analisi dettagliata della bottiglia." Stesso principio va applicato a `maturazione_mesi` e `malolattica`: non fermarsi alle note degustative, controllare sempre anche questi campi tecnici.

Stesso criterio di sempre: se non si trova un dato con certezza al 100%, il campo resta `NULL` — non si stima, non si approssima, non si esclude la ricerca a priori.

## Sans Année "a edizione numerata" — trattarle come millesimati, aggiunta il 2026-09-04

Alcune cuvée sono formalmente Sans Année (AOC) ma in pratica funzionano come un millesimato: ogni uscita ha un numero/edizione fisso e non ruota mai silenziosamente sotto lo stesso nome — una volta uscita la "172ème Édition" di Krug resta per sempre quella bottiglia, non diventa mai un'altra annata base come invece succede a un Grand Brut generico. Per queste bottiglie **non** si usa il sistema Sans Année a durata (`finestra_consumo_min_anni/max_anni`), ma esattamente la stessa struttura dei millesimati:

- `is_millesimato = true`
- `assemblaggio`: si riportano le annate reali del vino base (mai solo `{"perc": N}` senza anno) — es. `[{"anno": 2016, "perc": 58}, {"perc": 42, "tipo": "riserva", "label": "vins de réserve"}]`
- `annata`: l'anno prevalente del vino base. Se il blend ha un'unica annata base dominante, quella. Se il blend è multi-annata senza un anno chiaramente maggioritario (es. Grande Cuvée 171ème: 2015/20%+2014/15%+2013/10%), si usa comunque l'anno con la percentuale più alta tra i componenti come "annata prevalente" — l'`assemblaggio` resta la fonte di dettaglio precisa, `annata` è solo un'etichetta semplificata.
- `finestra_da`/`finestra_a`: finestra di degustazione calendarizzata, ricercata come per un millesimato normale (non la versione a durata-dall'acquisto).
- Nome bottiglia: **non** si aggiunge l'anno in coda — il numero di edizione è già l'identificativo univoco (es. resta "Grande Cuvée 172ème Édition", non "...172ème Édition 2016").

**Maison/cuvée note che rientrano in questa categoria** (lista aperta, aggiungere qui ogni volta che se ne trova una nuova):
- **Krug** — Grande Cuvée "XXXème Édition" e Krug Rosé "XXème" (ogni edizione = annata base fissa)
- **Laurent-Perrier** — Grand Siècle "N°XX" (blend di 2-3 annate ma numero fisso per uscita)
- **Jacquesson** — Cuvée "N° 7XX" (ogni numero = blend fisso e non rotante)
- **Louis Roederer** — Collection "XXX" (numerata come le precedenti)

**Why:** L'utente il 2026-09-04 ha notato che per queste maison il numero di edizione identifica una release fissa esattamente come farebbe un'annata dichiarata, quindi trattarle come Sans Année "tradizionali" (a durata rotante) sarebbe sbagliato — porterebbe a mostrare finestre di degustazione a durata invece che calendarizzate su bottiglie che in realtà hanno un'annata base precisa e nota.

**How to apply — IMPORTANTE per inserimenti futuri:** ogni volta che si inserisce una nuova bottiglia di una di queste maison/cuvée (nuove edizioni Krug, nuovi N° di Grand Siècle, nuove Collection Roederer, ecc.), va **sempre** usata questa struttura da millesimato fin dall'inserimento iniziale — mai lasciarla prima come Sans Année tradizionale e poi "convertirla" dopo. Se si scopre una nuova maison/cuvée con lo stesso pattern (edizione/numero fisso non rotante), va aggiunta alla lista sopra e trattata allo stesso modo.

## Campo `score_medio` — ricerca OBBLIGATORIA per ogni bottiglia, senza eccezioni, aggiunta il 2026-09-03

Vale lo stesso identico principio di `assemblaggio`: per **ogni** bottiglia, senza eccezioni, va fatta una ricerca dedicata di un punteggio da fonte riconosciuta (RP/WS/Decanter/JD — vedi checklist). **Non si decide a priori che una bottiglia "è troppo entry-level per essere recensita" e si salta la ricerca** — si cerca sempre, e solo se dopo la ricerca non si trova nulla il campo resta `NULL`. Stesso vale per `prezzo_min/max`: la ricerca del prezzo reale sul mercato italiano è sempre dovuta, non solo quando "sembra facile" trovarlo.

Se una fonte con punteggio è dietro paywall (es. Decanter Premium) e non se ne vede il numero, non ci si ferma lì: si prova almeno un'altra fonte riconosciuta prima di lasciare NULL.

**Chiarimento 2026-09-03 — piccole discordanze tra ricerche sullo STESSO critico non sono un motivo per lasciare NULL:** è normale che ricerche diverse restituiscano per lo stesso critico (es. James Suckling) numeri leggermente diversi (es. 91 in una ricerca, 93 in un'altra) — non è un conflitto reale, è solo rumore di aggregazione. In questo caso si fa la **media** e si usa quella (es. 91+93 → 92), non si scarta il dato. Il conflitto vero che giustifica il NULL è solo quando le FONTI (non le ricerche) sono in disaccordo su un dato di fatto strutturale, es. annata base o percentuale nell'assemblaggio (80% 2022 vs 80% 2020) — lì sì che non si inventa un numero a caso. Per il punteggio invece è normale che critici diversi (RP, WS, Decanter, JS) diano voti leggermente diversi tra loro: si riportano tutti in `score_note` e si usa il più alto come `score_medio`, come da convenzione già in uso.

**Cercare anche sui siti dei rivenditori italiani, non solo su ricerche generiche:** i punteggi critici spesso compaiono come badge puliti sulle schede prodotto di rivenditori come winekissyou.com, callmewine.com, tannico.it, vino.com, glugulp.com — una ricerca generica aggregata a volte non li restituisce se non sono tra i primi risultati sintetizzati. Se la prima ricerca generica non trova nulla, provare esplicitamente questi domini prima di concludere che il dato non esiste.

**Why:** L'utente il 2026-09-03, controllando un batch di 6 bottiglie Moët & Chandon, ha scoperto che per le 4 Sans Année (Rosé, Nectar Impérial, Ice Impérial, Ice Impérial Rosé) non era mai stata fatta una ricerca dedicata al punteggio — solo al prezzo — sull'assunto non verificato che prodotti entry-level non venissero recensiti. Reazione netta: "non abbiamo mai avuto problemi su questi due aspetti... le regole sono tassative, punto! Non puoi dire pensavo ecc." Zero tolleranza per ricerche saltate sulla base di un'assunzione, qualunque sia il ragionamento dietro.

**How to apply:** Prima di ogni INSERT, la checklist di ricerca dedicata comprende sempre, per ogni singola bottiglia senza eccezioni: uvaggio, dosaggio, assemblaggio, maturazione, malolattica, **punteggio critico**, **prezzo reale**. Non saltare nessuna di queste ricerche per nessun motivo — nemmeno "presumo che per questo tipo di prodotto non esista il dato". Solo dopo aver effettivamente cercato e non trovato nulla di certo, il campo resta NULL.

**Controllo incrociato obbligatorio prima di scrivere il dato:** trovare UN numero non basta. Prima di inserirlo, verificare sempre: (1) il dato appartiene davvero alla cuvée che sto inserendo, non a un'altra cuvée della stessa maison con nome simile (es. "Brut Réserve" vs "Cuvée Tradition" — succede spesso che una fonte descriva la cuvée sbagliata); (2) nessun'altra fonte affidabile riporta un numero diverso per la stessa cuvée. Se una seconda fonte con un numero diverso esiste (anche solo un rivenditore contro il sito ufficiale), il sito ufficiale del produttore vince; se il disaccordo persiste anche dopo aver cercato la fonte ufficiale, il campo resta `NULL`. Scoperto il 2026-09-03 durante un audit: 4 bottiglie su 44 avevano dati presi da una fonte in conflitto con un'altra, o addirittura attribuiti alla cuvée sbagliata per errore di lettura della fonte.

## Flusso di lavoro — un produttore alla volta, aggiunto il 2026-09-01

1. Procedi **un produttore alla volta**, mai in batch multi-produttore.
2. Per ogni cuvée del produttore: verifica nome reale + continuità in gamma + scheda tecnica, tutto prima di scrivere qualunque campo.
3. Completato l'inserimento delle cuvée di un produttore, fermati e dai un riscontro dettagliato (cosa inserito, cosa verificato, cosa lasciato NULL e perché) — senza elencare dubbi scartati, quelli non si menzionano.
4. Aspetta la conferma esplicita dell'utente prima di passare al produttore successivo.
5. Non chiedere il permesso per l'azione di inserire/correggere in sé (già autorizzata in modo permanente) — il checkpoint è solo tra un produttore e l'altro.

## Passo-passo

| Step | Azione |
|---|---|
| 1 | Individuare la cuvée reale ed esistente del produttore target |
| 2 | Cercare sul web la scheda tecnica ufficiale/verificabile della cuvée |
| 3 | `SELECT id FROM maison WHERE nome = '...'` per il `maison_id` |
| 4 | Compilare solo i campi tecnici confermati dalla fonte; il resto `NULL` |
| 5 | Scrivere `note_degustazione` originale (colore → naso → bocca → finale), stile sommelier |
| 6 | Scrivere `abbinamento` originale con ragionamento sensoriale |
| 7 | Scrivere `note_vigneto` e `vinificazione` solo se i dati lo permettono |
| 8 | Score: solo da fonti pubbliche riconosciute (RP/WS/Decanter/JD), mai stimato di testa propria come fatto reale |
| 9 | Checklist pre-esecuzione (sotto) |
| 10 | Esegui l'INSERT — batch da 10 quando possibile, con tutti i 30 campi della tabella espliciti |

## Checklist pre-esecuzione

- [ ] Nessun testo copiato da nessuna fonte
- [ ] `note_degustazione`, `note_vigneto`, `abbinamento` sono testi originali
- [ ] "lo champagne" nel testo, mai "il champagne"; "Sans Année" mai "non vintage"
- [ ] `source`/`score_note` senza nomi propri di persone o libri non ufficiali
- [ ] `id`, `nome_norm`, `created_at`, `updated_at` assenti dall'INSERT
- [ ] `tipo` è uno dei valori validi: `assemblage` / `blanc_de_blancs` / `blanc_de_noirs` / `rose` / `prestige`
- [ ] `is_millesimato` + `annata` coerenti tra loro
- [ ] Ogni campo tecnico numerico/`assemblaggio` è o verificato da fonte reale o `NULL` — mai stimato
- [ ] Ricerca DEDICATA fatta per `assemblaggio` (annata base + % riserva), non solo trovata di striscio cercando uvaggio/dosaggio
- [ ] `maturazione_mesi` e `malolattica` controllati esplicitamente, non solo le note degustative
- [ ] Ricerca DEDICATA fatta per `score_medio` (fonte riconosciuta RP/WS/Decanter/JD) su OGNI bottiglia, mai saltata per assunzione ("è troppo entry-level")
- [ ] Ricerca DEDICATA fatta per `prezzo_min/max` reale sul mercato italiano su OGNI bottiglia
