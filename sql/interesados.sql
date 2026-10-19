-- Tabla para el formulario "Quiero probarla" de miequipoaldia.com
-- Ejecutar una vez en Supabase > SQL Editor

create table if not exists public.interesados (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  nombre     text not null check (char_length(nombre) between 1 and 80),
  club       text not null check (char_length(club) between 1 and 120),
  categoria  text check (char_length(categoria) <= 40),
  rol        text check (char_length(rol) <= 40),
  email      text not null check (char_length(email) <= 120 and email like '%@%'),
  telefono   text check (char_length(telefono) <= 20)
);

-- Seguridad: la web solo puede INSERTAR. Nadie puede leer la lista desde fuera.
alter table public.interesados enable row level security;

drop policy if exists "web puede apuntarse" on public.interesados;
create policy "web puede apuntarse"
  on public.interesados for insert
  to anon
  with check (true);

-- Para ver quién se ha apuntado: Supabase > Table Editor > interesados
