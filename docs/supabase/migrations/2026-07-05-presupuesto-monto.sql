-- ============================================================
--  Migración: presupuesto.porcentaje → presupuesto.monto
--  El presupuesto por categoría pasa a ingresarse en pesos ($)
--  en lugar de % del sueldo. El % ahora es un campo calculado
--  en el frontend, no se almacena.
--
--  Aplicar en: SQL Editor del proyecto Supabase de producción.
--  IMPORTANTE: los valores existentes (0-100, en % del sueldo)
--  quedan tal cual pero pasan a interpretarse como pesos. Los
--  meses históricos ya guardados van a mostrar montos sin sentido
--  hasta que se re-guarden. Si se prefiere, se puede limpiar la
--  tabla antes de aplicar (ver comentado abajo).
-- ============================================================

-- Opcional: borrar presupuestos existentes en vez de reinterpretarlos como monto.
-- delete from presupuesto;

alter table presupuesto rename column porcentaje to monto;
alter table presupuesto alter column monto type numeric(12, 2);
alter table presupuesto drop constraint if exists presupuesto_porcentaje_check;
alter table presupuesto add constraint presupuesto_monto_check check (monto >= 0);
