-- =====================================================================
-- Construccions i Reformes Albert i Tomàs · Esquema Supabase
-- Executa-ho sencer a: Supabase → SQL Editor → New query → Run
-- =====================================================================

-- ---------- Taula de projectes ----------
create table if not exists public.projectes (
    id            uuid primary key default gen_random_uuid(),
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    titol         text not null check (char_length(titol) between 2 and 120),
    slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    categoria     text not null check (categoria in ('obra-nova', 'reformes', 'piscines', 'pedra')),
    resum         text check (char_length(resum) <= 220),
    descripcio    text check (char_length(descripcio) <= 5000),
    ubicacio      text check (char_length(ubicacio) <= 80),
    any_projecte  int  check (any_projecte between 1990 and 2100),
    video_url     text check (video_url is null or video_url ~ '^https://(www\.)?(youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)/'),
    portada       jsonb,                              -- {"full": "...", "thumb": "..."}
    imatges       jsonb not null default '[]'::jsonb,  -- [{"full": "...", "thumb": "..."}]
    ordre         int  not null default 0,
    publicat      boolean not null default true
);

create index if not exists projectes_llistat_idx
    on public.projectes (publicat, ordre, created_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at := now();
    return new;
end $$;

drop trigger if exists projectes_updated_at on public.projectes;
create trigger projectes_updated_at
    before update on public.projectes
    for each row execute function public.touch_updated_at();

-- ---------- Administradors ----------
-- Només els usuaris que hi siguin aquí poden crear/editar/esborrar.
create table if not exists public.admins (
    user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;
-- (sense polítiques: la taula no és accessible des de l'API)

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
    select exists (select 1 from public.admins where user_id = auth.uid());
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- ---------- Seguretat de la taula projectes ----------
alter table public.projectes enable row level security;

drop policy if exists "lectura publica" on public.projectes;
create policy "lectura publica" on public.projectes
    for select using (publicat or public.is_admin());

drop policy if exists "admins creen" on public.projectes;
create policy "admins creen" on public.projectes
    for insert to authenticated with check (public.is_admin());

drop policy if exists "admins editen" on public.projectes;
create policy "admins editen" on public.projectes
    for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins esborren" on public.projectes;
create policy "admins esborren" on public.projectes
    for delete to authenticated using (public.is_admin());

-- ---------- Storage: bucket d'imatges ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('projectes', 'projectes', true, 10485760, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admins pugen imatges" on storage.objects;
create policy "admins pugen imatges" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'projectes' and public.is_admin());

drop policy if exists "admins editen imatges" on storage.objects;
create policy "admins editen imatges" on storage.objects
    for update to authenticated
    using (bucket_id = 'projectes' and public.is_admin());

drop policy if exists "admins esborren imatges" on storage.objects;
create policy "admins esborren imatges" on storage.objects
    for delete to authenticated
    using (bucket_id = 'projectes' and public.is_admin());

-- =====================================================================
-- DESPRÉS de crear l'usuari del client (Authentication → Users → Add user),
-- executa aquesta línia canviant el correu:
--
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'correu-del-client@exemple.com';
-- =====================================================================
