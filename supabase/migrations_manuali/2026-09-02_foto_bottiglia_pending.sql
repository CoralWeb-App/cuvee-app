-- Foto scansionate dagli utenti in attesa di approvazione admin, per bottiglie
-- GIÀ a catalogo. Sostituisce la scrittura diretta su bottiglie.foto_url che
-- avveniva prima da analyze-bottle quando la bottiglia non aveva ancora foto.
-- Da eseguire manualmente nell'SQL Editor di Supabase (Dashboard → SQL Editor).

create table public.foto_bottiglia_pending (
  id            uuid primary key default gen_random_uuid(),
  bottiglia_id  uuid not null references public.bottiglie(id) on delete cascade,
  user_id       uuid references public.users(id) on delete set null,
  storage_path  text not null,
  foto_url      text not null,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at    timestamptz not null default now()
);

create index foto_bottiglia_pending_bottiglia_id_idx on public.foto_bottiglia_pending (bottiglia_id);
create index foto_bottiglia_pending_status_idx on public.foto_bottiglia_pending (status);

alter table public.foto_bottiglia_pending enable row level security;

-- Solo gli admin possono leggere la coda (il pannello admin usa la sessione
-- dell'admin loggato, non service_role, per il SELECT nella lista).
-- Tutte le scritture (insert/update/delete) avvengono sempre via service_role
-- nelle Edge Function (analyze-bottle per l'insert, admin-photo-upload per
-- approvazione/rifiuto) — bypassano RLS, quindi non servono policy INSERT/DELETE.
create policy "admin can read foto_bottiglia_pending"
  on public.foto_bottiglia_pending
  for select
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin = true));
