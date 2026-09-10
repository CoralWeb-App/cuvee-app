-- Aggiunge i nuovi campi dell'esame visivo (colore, perlage, evoluzione) e
-- due parametri sensoriali mancanti (corpo, équilibre) alla scheda di
-- degustazione del Carnet. Nessun dato esistente viene toccato: sono tutte
-- colonne nullable, le note già salvate restano valide senza modifiche.
-- Da eseguire manualmente nell'SQL Editor di Supabase (Dashboard → SQL Editor).

alter table public.carnet_notes
  add column colore     text,
  add column perlage    integer,
  add column corpo      integer,
  add column equilibrio integer,
  add column evoluzione text;
