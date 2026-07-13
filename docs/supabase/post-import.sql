-- ============================================================
--  POST-IMPORT: ejecutar DESPUÉS de importar los CSVs
--  Reemplazá '<uuid-del-usuario>' con el UUID real del usuario
--  (lo encontrás en Supabase → Authentication → Users)
-- ============================================================

-- Asignar user_id a todas las filas importadas (que llegan con user_id NULL)
update transacciones set user_id = '<uuid-del-usuario>' where user_id is null;
update categorias     set user_id = '<uuid-del-usuario>' where user_id is null;
update presupuesto    set user_id = '<uuid-del-usuario>' where user_id is null;

-- Verificar que no quedaron filas sin user_id
select 'transacciones sin user_id' as tabla, count(*) from transacciones where user_id is null
union all
select 'categorias sin user_id',              count(*) from categorias     where user_id is null
union all
select 'presupuesto sin user_id',             count(*) from presupuesto    where user_id is null;
