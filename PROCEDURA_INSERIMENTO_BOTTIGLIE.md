# Procedura — Inserimento nuove bottiglie da foto

## Regole assolute (mai derogare)

1. **Zero testo copiato** da qualsiasi fonte cartacea o digitale. Ogni campo testuale è scritto ex-novo.
2. **Note degustazione** — originali, scritte come sommelier esperto con 30 anni di esperienza sullo Champagne. Nessuna frase presa da libri, guide o schede tecniche.
3. **Abbinamenti** — ricercati e scritti di testa propria da sommelier professionista. Mai copiati da fonti.
4. **"lo champagne"** — sempre, mai "il champagne" (come "lo shampoo", suono palatale).
5. **Mai "Lupetti"** in nessun campo del DB — né in `source`, né in `score_note`, né in `note_degustazione`, né in nessun altro campo. Nemmeno come riferimento parziale (es. "media Lupetti/WS"), nemmeno come fonte dello score. Se si usa il punteggio Lupetti per calcolare la media, il risultato va in `score_medio` come numero puro, e `score_note` riporta solo le altre fonti (es. `"RP 95, WS 93"`). Se non ci sono altre fonti, `score_note = NULL`.
6. **Mai inserire maison** — esistono già nel DB. Solo INSERT su `bottiglie`.
7. **Mai includere colonne GENERATED** nell'INSERT: `id`, `nome_norm`, `created_at`, `updated_at`.

---

## Struttura INSERT bottiglie

```sql
INSERT INTO bottiglie (
  maison_id,
  nome,
  slug,
  tipo,
  is_millesimato,
  annata,               -- solo se is_millesimato = true
  dosaggio_gl,
  dosaggio_tipo,
  pct_pinot_noir,
  pct_chardonnay,
  pct_meunier,
  provenienza_uve,
  vinificazione,
  malolattica,
  maturazione_mesi,
  note_vigneto,
  note_degustazione,
  abbinamento,
  vini_base,
  assemblaggio,
  produzione_bottiglie,
  prezzo_min,
  prezzo_max,
  score_medio,
  score_note,
  finestra_da,
  finestra_a,
  stile,
  fascia_prezzo,
  source,
  needs_review,
  is_published
) VALUES (...);
```

### Valori ammessi per `tipo`
| Valore | Significato |
|---|---|
| `'assemblage'` | Blend di vitigni (Pinot Noir + Chardonnay + Meunier) |
| `'blanc_de_blancs'` | Solo Chardonnay (o vitigni bianchi) |
| `'blanc_de_noirs'` | Solo uve nere vinificate in bianco |
| `'rose'` | Rosé (qualsiasi metodo) |

### Formato `assemblaggio` (JSONB)
```json
-- Millesimato con blend annate:
[{"anno": 2019, "perc": 60}, {"anno": 2018, "perc": 40}]

-- Con riserva:
[{"tipo": "riserva", "perc": 30}, {"anno": 2019, "perc": 70}]

-- Solera:
[{"tipo": "solera", "perc": 100}]

-- Sans année semplice: NULL
```

### Formato `vini_base` (JSONB)
```json
[{"villaggio": "Aÿ", "cru": "grand", "perc": 40}, {"villaggio": "Mareuil", "cru": "premier", "perc": 60}]
-- oppure NULL se non noto
```

### Slug
Formato: `maison-slug` + `-` + `nome-cuvee-normalizzato` + eventuale `-ANNO`
Esempio: `krug-grande-cuvee-173`, `selosse-initial`, `bollinger-rdd-2014`
Tutto minuscolo, trattini, no accenti, no caratteri speciali.

### `fascia_prezzo`
| Valore | Range indicativo |
|---|---|
| `'entry'` | < €40 |
| `'mid'` | €40–€100 |
| `'premium'` | €100–€200 |
| `'prestige'` | €200–€500 |
| `'ultra'` | > €500 |

### `source`
Usare solo codici neutrali come `'lupetti_book_2025'`… **NO** — vedi regola 5.
Usare: `NULL` oppure una fonte neutrale senza nomi di autori (es. `'scheda_tecnica'`, `'produttore'`).

### `needs_review` e `is_published`
- `needs_review = false`, `is_published = true` → bottiglia verificata, visibile
- `needs_review = true`, `is_published = false` → da controllare prima di pubblicare

---

## Procedura passo-passo

### 1. Ricevi le foto
Foto della pagina libro o etichetta. Ogni foto = una bottiglia (a meno che non siano chiaramente due).

### 2. Estrai i dati tecnici
Dalla pagina/etichetta:
- Nome maison + cuvée (esatti, come scritti)
- Annata se millesimato
- Dosaggio (g/L e tipo: Nature/Extra-Brut/Brut/etc.)
- Percentuali vitigni
- Mesi sui lieviti
- Dati vigneto se presenti
- Produzione bottiglie se indicata

### 3. Ricerca maison_id
```sql
SELECT id FROM maison WHERE nome = 'Nome Maison';
```
Usa l'ID trovato. Non creare nuove maison.

### 4. Costruisci i campi testuali (originali)

**`note_degustazione`** — 3-5 righe, registro sommelier:
- Colore e perlage
- Naso (profumi primari, secondari, evolutivi)
- Bocca (attacco, struttura, acidità, persistenza)
- Finale
- Potenziale evolutivo se rilevante
Tutto in italiano. Nessuna citazione. Nessun copia-incolla.

**`note_vigneto`** — se noto: territorio, suolo, esposizione, altitudine, età viti.

**`abbinamento`** — 3-5 abbinamenti gastronomici originali, con ragionamento sensoriale.
Esempi di struttura: *"Eccellente con ostriche bretoni e burro salato; regge la grassezza di un risotto allo champagne con midollo; sorprendente con formaggi a pasta molle a crosta fiorita."*

**`vinificazione`** — tecniche usate: fermentazione in legno/acciaio/cemento, batonnage, malolattica sì/no, metodo di dégorgement se noto.

**`provenienza_uve`** — zone, village, grand/premier cru se noto.

### 5. Score
- Usa solo punteggi di fonti pubbliche verificabili (RP, WS, Decanter, JD, WE, ecc.)
- `score_medio` = media aritmetica dei punteggi trovati (arrotondato a 0.5)
- `score_note` = stringa con solo quelle fonti, es. `'RP 95, WS 93'`
- **Mai** inserire "Lupetti" o qualsiasi nome dell'autore del libro in `score_note` o altrove

### 6. Finestra di consumo
- `finestra_da` = anno consigliato inizio (es. anno release + 2-3 per NV, + 5-8 per millesimato)
- `finestra_a` = anno apice/fine (stima ragionata)

### 7. Verifica finale prima di eseguire la query

Checklist mentale:
- [ ] Nessun campo contiene "lupetti" o "Lupetti"
- [ ] `nome_norm`, `id`, `created_at`, `updated_at` assenti dall'INSERT
- [ ] `note_degustazione` è testo originale, non copiato
- [ ] `abbinamento` è originale, non copiato
- [ ] `source` è NULL o codice neutro senza nomi autori
- [ ] `tipo` è uno dei 4 valori ammessi
- [ ] `slug` è unico e formattato correttamente
- [ ] Se millesimato: `is_millesimato = true` e `annata` valorizzata
- [ ] Se sans année: `is_millesimato = false` e `annata = NULL`
- [ ] `lo champagne` nel testo, mai "il champagne"

### 8. Esegui la query nel SQL Editor Supabase

URL: https://supabase.com → progetto `wlfxgbmffvhuqmqjiuqo` → SQL Editor

---

## Query di verifica post-inserimento

```sql
-- Controlla che non ci siano riferimenti a lupetti rimasti
SELECT id, nome, source, score_note
FROM bottiglie
WHERE
  source ILIKE '%lupetti%' OR
  score_note ILIKE '%lupetti%' OR
  note_degustazione ILIKE '%lupetti%' OR
  note_vigneto ILIKE '%lupetti%' OR
  abbinamento ILIKE '%lupetti%';
-- Deve restituire 0 righe
```

---

*Ultima revisione: giugno 2026*
