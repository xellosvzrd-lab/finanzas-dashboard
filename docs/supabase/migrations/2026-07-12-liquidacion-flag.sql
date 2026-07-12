-- ============================================================
--  Migración: transacciones.es_liquidacion
--  Hasta ahora, una transacción de settlement (Liquidar / Saldar todo en
--  Compartidos) se identificaba SOLO por descripcion = 'Liquidación'. Si un
--  usuario escribía a mano una transacción normal con esa misma descripción,
--  el sistema la trataba como settlement: la contaba en "yaLiquidado" (ocultando
--  los botones de saldar) y el botón "Deshacer liquidación" podía borrarla.
--
--  Esta migración agrega una columna dedicada para no depender más de un
--  string mágico. El código (deshacerLiquidacion, yaLiquidado, confirmarLiquidar,
--  confirmarSaldarTodo) pasa a filtrar por es_liquidacion = true.
--
--  Aplicar en: SQL Editor del proyecto Supabase de producción.
--  Después de aplicar esta migración, mergear el PR de código correspondiente
--  (usa RPC/insert con es_liquidacion — falla si la columna no existe todavía).
-- ============================================================

alter table transacciones
  add column if not exists es_liquidacion boolean not null default false;

-- Backfill: todo lo que hasta ahora se identificaba por el string mágico se marca
-- como liquidación real (asume que ninguna transacción manual usó ese texto a propósito;
-- si alguna vez apareció una transacción normal con esa descripción, quedará marcada
-- como liquidación y debería revisarse/corregirse a mano después de aplicar esto).
update transacciones
  set es_liquidacion = true
  where descripcion = 'Liquidación';
