-- ============================================================
--  Fix: workspace_members.nombre nunca se guardaba para usuarios
--  nuevos reales (Sabdy, Diego) — causa raíz confirmada:
--
--  RLS en workspace_members solo tiene policy de SELECT. El cliente
--  intentaba escribir el nombre con un UPDATE directo desde
--  guardarNombre() (`supabaseClient.from('workspace_members').update(...)`),
--  que RLS bloquea en silencio (0 filas afectadas, sin error — y el
--  código nunca chequeaba el resultado). auth.users.raw_user_meta_data
--  quedaba bien (esa escritura es vía Supabase Auth, no pasa por esta
--  tabla), pero workspace_members.nombre quedaba vacío para siempre.
--
--  Daniel y Ama no tienen este problema porque sus filas se cargaron
--  por la migración big-bang de multi-tenancy (servicio con rol
--  elevado, bypasea RLS) — nunca ejercitaron este camino del cliente.
--
--  Aplicar en: SQL Editor del proyecto Supabase de producción.
-- ============================================================

-- 1) Backfill: copiar el nombre ya correcto de auth.users a las filas
--    de workspace_members que quedaron vacías por este bug.
update workspace_members wm
set nombre = u.raw_user_meta_data ->> 'nombre'
from auth.users u
where wm.user_id = u.id
  and (wm.nombre is null or wm.nombre = '')
  and coalesce(u.raw_user_meta_data ->> 'nombre', '') <> '';

-- 2) Fix de raíz: función security definer para que el cliente pueda
--    setear SU PROPIO nombre sin necesitar (ni abrir) UPDATE directo
--    sobre workspace_members. Mismo patrón que accept_workspace_invite().
create function set_mi_nombre(p_nombre text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update workspace_members
    set nombre = p_nombre
    where user_id = auth.uid();
end;
$$;

grant execute on function set_mi_nombre(text) to authenticated;
