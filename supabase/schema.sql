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

-- =====================================================================
-- BLOC 2 · Secció «A obra» de la home (afegit el 2026-09-23)
-- Torna a executar aquest fitxer sencer: és segur, no esborra res.
-- =====================================================================

create table if not exists public.destacats (
    id          uuid primary key default gen_random_uuid(),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    titol       text not null check (char_length(titol) between 2 and 80),
    etiqueta    text check (char_length(etiqueta) <= 40),
    imatge      jsonb not null,              -- {"full": "...", "thumb": "..."} · vertical
    video_url   text check (video_url is null or video_url ~ '^https://(www\.)?(youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)/'),
    ordre       int not null default 0,
    publicat    boolean not null default true
);

create index if not exists destacats_llistat_idx
    on public.destacats (publicat, ordre, created_at desc);

drop trigger if exists destacats_updated_at on public.destacats;
create trigger destacats_updated_at
    before update on public.destacats
    for each row execute function public.touch_updated_at();

alter table public.destacats enable row level security;

drop policy if exists "lectura publica destacats" on public.destacats;
create policy "lectura publica destacats" on public.destacats
    for select using (publicat or public.is_admin());

drop policy if exists "admins creen destacats" on public.destacats;
create policy "admins creen destacats" on public.destacats
    for insert to authenticated with check (public.is_admin());

drop policy if exists "admins editen destacats" on public.destacats;
create policy "admins editen destacats" on public.destacats
    for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins esborren destacats" on public.destacats;
create policy "admins esborren destacats" on public.destacats
    for delete to authenticated using (public.is_admin());

-- =====================================================================
-- BLOC 3 · Testimonis i preguntes freqüents (afegit el 2026-09-28)
-- Torna a executar aquest fitxer sencer: és segur i no esborra res.
-- Les dades que ja hi ha a la web s'hi insereixen només el primer cop.
-- =====================================================================

create table if not exists public.testimonis (
    id          uuid primary key default gen_random_uuid(),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    text        text not null check (char_length(text) between 10 and 600),
    autor       text not null check (char_length(autor) between 2 and 80),
    detall      text check (char_length(detall) <= 120),
    estrelles   int not null default 5 check (estrelles between 1 and 5),
    ordre       int not null default 0,
    publicat    boolean not null default true
);

create table if not exists public.faqs (
    id          uuid primary key default gen_random_uuid(),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    pagina      text not null default 'home'
                check (pagina in ('home', 'obra-nova', 'reformes', 'piscines', 'pedra')),
    pregunta    text not null check (char_length(pregunta) between 5 and 200),
    resposta    text not null check (char_length(resposta) between 5 and 1500),
    ordre       int not null default 0,
    publicat    boolean not null default true
);

create index if not exists testimonis_llistat_idx on public.testimonis (publicat, ordre, created_at);
create index if not exists faqs_llistat_idx on public.faqs (pagina, publicat, ordre, created_at);

drop trigger if exists testimonis_updated_at on public.testimonis;
create trigger testimonis_updated_at before update on public.testimonis
    for each row execute function public.touch_updated_at();

drop trigger if exists faqs_updated_at on public.faqs;
create trigger faqs_updated_at before update on public.faqs
    for each row execute function public.touch_updated_at();

alter table public.testimonis enable row level security;
alter table public.faqs enable row level security;

drop policy if exists "lectura publica testimonis" on public.testimonis;
create policy "lectura publica testimonis" on public.testimonis
    for select using (publicat or public.is_admin());
drop policy if exists "admins creen testimonis" on public.testimonis;
create policy "admins creen testimonis" on public.testimonis
    for insert to authenticated with check (public.is_admin());
drop policy if exists "admins editen testimonis" on public.testimonis;
create policy "admins editen testimonis" on public.testimonis
    for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins esborren testimonis" on public.testimonis;
create policy "admins esborren testimonis" on public.testimonis
    for delete to authenticated using (public.is_admin());

drop policy if exists "lectura publica faqs" on public.faqs;
create policy "lectura publica faqs" on public.faqs
    for select using (publicat or public.is_admin());
drop policy if exists "admins creen faqs" on public.faqs;
create policy "admins creen faqs" on public.faqs
    for insert to authenticated with check (public.is_admin());
drop policy if exists "admins editen faqs" on public.faqs;
create policy "admins editen faqs" on public.faqs
    for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins esborren faqs" on public.faqs;
create policy "admins esborren faqs" on public.faqs
    for delete to authenticated using (public.is_admin());

-- ---------- Contingut actual de la web ----------
insert into public.testimonis (text, autor, detall, ordre)
select * from (values
    ('Ens van reformar el bany i la cuina i no podem estar més contents. Seriosos, nets i molt atents als detalls.', 'Marta i Jordi', 'Reforma de bany i cuina · Tàrrega', 0),
    ('L''Albert i el seu equip ens van fer la terrassa i el jardí. Compliment de terminis, pressupost respectat i un acabat excel·lent.', 'Família Solé', 'Terrassa i jardí · Verdú', 10),
    ('Vam fer la reforma d''una caseta de poble i ens l''han deixat com nova. Molt recomanables.', 'Anna P.', 'Reforma de casa petita · Cervera', 20)
) as v(text, autor, detall, ordre)
where not exists (select 1 from public.testimonis);

insert into public.faqs (pagina, pregunta, resposta, ordre)
select * from (values
    ('home', 'Quina zona cobriu?', 'Treballem principalment a Tàrrega i comarques de Lleida (Urgell, Segarra, Pla d''Urgell, Segrià). Per a projectes propers consulta''ns sense compromís.', 0),
    ('home', 'Feu pressupostos sense compromís?', 'Sí. Visitem el lloc, escoltem què necessites i et passem un pressupost detallat i transparent, sense cap compromís.', 10),
    ('home', 'Quant triga una reforma de bany o cuina?', 'Depèn de l''abast, però un bany sol durar entre 2 i 4 setmanes i una cuina entre 3 i 5. T''oferim un calendari clar des del primer dia.', 20),
    ('home', 'Us encarregueu de tots els gremis?', 'Sí. Coordinem tots els gremis (electricista, lampista, fuster, pintor…) per tu, amb un únic interlocutor de principi a fi.', 30),
    ('home', 'Quins materials utilitzeu?', 'Treballem amb marques de confiança (Roca, Porcelanosa, Knauf, Cosentino…) i et ajudem a triar els acabats segons pressupost i preferències.', 40),

    ('obra-nova', 'Quant triga construir una casa nova?', 'Depèn de la mida i complexitat, però una casa unifamiliar sol construir-se en 10 a 14 mesos des de l''inici d''obra.', 0),
    ('obra-nova', 'Us encarregueu de les llicències?', 'Sí. Coordinem amb l''arquitecte i tramitem llicències, permisos municipals i altres gestions necessàries.', 10),
    ('obra-nova', 'Feu cases claus en mà?', 'Sí. T''oferim un servei claus en mà: projecte, execució, acabats i lliurament final llest per entrar-hi a viure.', 20),
    ('obra-nova', 'Quina garantia oferiu?', 'Complim amb totes les garanties legals: 1 any per acabats, 3 anys per instal·lacions i 10 anys per estructura.', 30),

    ('reformes', 'Quant triga una reforma integral?', 'Depèn de la mida i complexitat, però un pis sol reformar-se entre 8 i 14 setmanes.', 0),
    ('reformes', 'Es pot viure al pis durant l''obra?', 'No ho recomanem: una reforma integral implica pols, sorolls i talls d''aigua i llum. Millor buidar l''habitatge.', 10),
    ('reformes', 'Feu projecte tècnic si cal?', 'Sí. Col·laborem amb arquitectes i tècnics per redactar el projecte tècnic i tramitar la llicència d''obres.', 20),
    ('reformes', 'Qui tria els materials?', 'Tu decideixes amb el nostre assessorament. T''acompanyem a botigues i showrooms per triar els acabats.', 30),

    ('piscines', 'Quant triga construir una piscina?', 'Una piscina d''obra completa sol trigar entre 8 i 14 setmanes, en funció del disseny i les condicions del terreny.', 0),
    ('piscines', 'Cal llicència?', 'Sí, cal llicència d''obres municipal. Ens encarreguem de tramitar-la per tu.', 10),
    ('piscines', 'Quin revestiment recomaneu?', 'Depèn del gust i el pressupost. El gresite és la solució més duradora; el microciment ofereix un acabat contemporani; la pedra natural, un aire més càlid.', 20),
    ('piscines', 'Feu manteniment posterior?', 'Sí, oferim contractes de manteniment i posada a punt anual.', 30),

    ('pedra', 'Quin tipus de pedra utilitzeu?', 'Segons el projecte: pedra calcària de Lleida, granit, pissarra, pedra rústica recuperada… Sempre triem el material que millor encaixa amb l''entorn.', 0),
    ('pedra', 'Feu rehabilitació de masies?', 'Sí. Restaurem masies i cases de poble respectant l''estructura, els materials originals i el caràcter del conjunt.', 10),
    ('pedra', 'És més car un mur de pedra que un mur convencional?', 'Sí, un mur de pedra és més artesanal i costós, però envelleix millor, aporta caràcter i és una inversió a llarg termini.', 20),
    ('pedra', 'Cal manteniment?', 'La pedra és molt duradora. Recomanem aplicar tractaments hidròfugs cada certs anys segons l''exposició.', 30)
) as v(pagina, pregunta, resposta, ordre)
where not exists (select 1 from public.faqs);

-- =====================================================================
-- BLOC 4 · Missatges del formulari de contacte (afegit el 2026-09-28)
-- Torna a executar aquest fitxer sencer: és segur i no esborra res.
-- =====================================================================

create table if not exists public.missatges (
    id          uuid primary key default gen_random_uuid(),
    created_at  timestamptz not null default now(),
    nom         text not null check (char_length(nom) between 2 and 100),
    telefon     text not null check (char_length(telefon) between 6 and 30),
    email       text not null check (char_length(email) between 5 and 120),
    servei      text check (char_length(servei) <= 40),
    missatge    text not null check (char_length(missatge) between 5 and 2000),
    llegit      boolean not null default false
);

create index if not exists missatges_llistat_idx on public.missatges (llegit, created_at desc);

alter table public.missatges enable row level security;

-- Qualsevol visitant pot enviar el formulari, però ningú pot llegir els missatges
-- ni modificar-los si no és administrador.
drop policy if exists "qualsevol pot enviar" on public.missatges;
create policy "qualsevol pot enviar" on public.missatges
    for insert to anon, authenticated with check (llegit = false);

drop policy if exists "admins llegeixen missatges" on public.missatges;
create policy "admins llegeixen missatges" on public.missatges
    for select to authenticated using (public.is_admin());

drop policy if exists "admins marquen missatges" on public.missatges;
create policy "admins marquen missatges" on public.missatges
    for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins esborren missatges" on public.missatges;
create policy "admins esborren missatges" on public.missatges
    for delete to authenticated using (public.is_admin());
