-- ============================================================
--  Migración: tabla de diagnóstico client_error_logs
--  Captura evidencia real (user agent, estado de sesión) cuando
--  ocurre el error "Auth session missing!" en el login/onboarding,
--  para no seguir adivinando la causa a ciegas.
--
--  Aplicar en: SQL Editor del proyecto Supabase de producción.
--  Es un log de solo-escritura desde el cliente (anon insert), sin
--  policy de lectura pública — consultar desde el dashboard de
--  Supabase (bypassa RLS) o con la service role key.
--
--  Este log es temporal para diagnosticar el bug reportado por
--  Sabdy. Una vez resuelto, se puede borrar la tabla.
-- ============================================================

create table if not exists client_error_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  contexto text not null,
  detalle jsonb
);

alter table client_error_logs enable row level security;

create policy "cualquiera puede insertar logs de diagnóstico"
  on client_error_logs for insert
  to anon, authenticated
  with check (true);
