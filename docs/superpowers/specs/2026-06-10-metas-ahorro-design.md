---
date: 2026-06-10
topic: metas-ahorro
status: approved
---

# Spec: Metas de Ahorro

## Contexto y motivación

El dashboard ya calcula "Ahorro acumulado" por usuario: la suma histórica de todas las
transacciones de tipo Gasto con `categoria === "Ahorro"`. Hoy esa cifra se muestra sin
ningún objetivo de referencia (tarjeta `mm-sc-ahorro` en Mi mes).

Esta feature agrega la posibilidad de definir una **meta de ahorro** (nombre, monto
objetivo, fecha opcional) y convierte esa tarjeta en una barra de progreso hacia esa
meta. Opcionalmente la meta puede marcarse como **compartida**, haciéndola visible
también para [PARTNER].

## Alcance v1

- Una meta **activa** por usuario (`metas_ahorro` con índice único parcial).
- El progreso se calcula sumando transacciones `categoria === "Ahorro"` desde
  `fecha_inicio` de la meta (no desde el inicio de los tiempos).
- Reemplazar la meta actual archiva la anterior (`activa = false`) y resetea
  `fecha_inicio`, así el progreso de la nueva meta arranca en 0.
- Meta compartida = mismo nombre/monto/fecha visibles para ambos usuarios, pero
  **cada uno ve su propio progreso** (no hay suma combinada — limitación de RLS,
  ver "Decisiones" abajo).
- Fuera de alcance v1: múltiples metas en paralelo, suma combinada de progreso entre
  usuarios, historial de metas cumplidas en UI (se guarda en DB pero no se muestra).

## Modelo de datos (Supabase)

```sql
create table metas_ahorro (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  usuario text not null,              -- "Daniel" | "Ama"
  nombre text not null,               -- "Vacaciones a Bariloche"
  monto_objetivo numeric(12,2) not null check (monto_objetivo > 0),
  moneda text not null default 'ARS', -- ARS | USD
  fecha_objetivo date,                -- opcional
  fecha_inicio timestamptz not null default now(),
  compartida boolean not null default false,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_metas_ahorro_user_id on metas_ahorro(user_id);

alter table metas_ahorro enable row level security;

create policy "metas_ahorro_select" on metas_ahorro
  for select using (auth.uid() = user_id or compartida = true);

create policy "metas_ahorro_insert" on metas_ahorro
  for insert with check (auth.uid() = user_id);

create policy "metas_ahorro_update" on metas_ahorro
  for update using (auth.uid() = user_id);

create policy "metas_ahorro_delete" on metas_ahorro
  for delete using (auth.uid() = user_id);

-- Solo una meta activa por usuario
create unique index metas_ahorro_activa_unica on metas_ahorro(user_id) where activa = true;
```

## Decisiones de diseño

### Por qué no hay suma combinada en metas compartidas

La RLS de `transacciones` es estricta: `auth.uid() = user_id` en SELECT. Ningún
usuario puede leer las filas de transacciones del otro. Por lo tanto no es posible
calcular `progreso_daniel + progreso_ama` client-side sin una función SQL agregada
adicional (`security definer`).

Para v1, una meta `compartida = true` es visible para ambos vía RLS (la policy de
`metas_ahorro` permite `select` si `compartida = true`, sin importar `user_id`). Cada
usuario calcula su propio progreso usando sus propias transacciones contra el mismo
`monto_objetivo` / `fecha_inicio`. Si en el futuro se quiere un total combinado, se
puede agregar una función `sum_ahorro_meta(meta_id)` con `security definer` que
devuelva solo el agregado (sin exponer filas individuales).

### Fallback cuando no hay meta propia pero el partner tiene una compartida

Query de carga: `select * from metas_ahorro where activa = true and (user_id =
auth.uid() or compartida = true)`.

- Si el usuario tiene meta propia activa → se usa esa.
- Si no tiene propia pero hay una `compartida = true` del partner → se usa esa,
  calculando el progreso con las transacciones propias del usuario actual desde el
  `fecha_inicio` de esa meta.
- Si ambos casos coexisten (usuario tiene propia Y existe una compartida del
  partner) → se prioriza la meta propia del usuario.

## UI — Tarjeta "Ahorro acumulado" (Mi mes)

**Sin meta configurada:**
- Comportamiento actual sin cambios (monto del mes + acumulado total).
- Se agrega link "🎯 Definir meta de ahorro".

**Con meta activa:**
- Label: nombre de la meta (reemplaza "Ahorro acumulado").
- Valor principal: barra de progreso + porcentaje (`62%`).
- Sub-texto: `$310.000 / $500.000 · faltan $190.000` (+ `· meta: dic 2026` si hay
  `fecha_objetivo`).
- Ícono ✏️ para editar/eliminar (abre modal).
- Si `compartida = true`: badge 🤝 indicando que [PARTNER] también la sigue.

**Modal "Meta de ahorro"** (mismo patrón visual que modales de recurrentes/cuotas):
- Nombre (texto, requerido)
- Monto objetivo (numérico, `parsearDecimal`, requerido)
- Moneda (select ARS/USD)
- Fecha objetivo (date picker, opcional)
- Checkbox "Meta compartida con [PARTNER]"
- Botones: Guardar / Eliminar meta (si existe una activa)

## Lógica de progreso

```javascript
function calcularProgresoMeta(meta) {
  const desde = new Date(meta.fecha_inicio);
  const total = allTransac
    .filter(t => t.categoria === "Ahorro" && !esTransferencia(t) && new Date(t.fecha) >= desde)
    .reduce((s, t) => s + Math.abs(Number(t.monto)), 0);
  const pct = Math.min(100, (total / meta.monto_objetivo) * 100);
  return { total, pct, restante: Math.max(0, meta.monto_objetivo - total) };
}
```

### Casos borde

- **Reemplazo de meta:** crear una nueva meta marca la anterior `activa = false`
  (queda en historial en DB, no se borra) y la nueva arranca con
  `fecha_inicio = now()`.
- **Meta cumplida (pct >= 100):** confetti (patrón existente del sprint de mayo) +
  toast "¡Felicitaciones, cumpliste tu meta de ahorro! 🎉", disparado una sola vez por
  meta vía flag en localStorage: `USUARIO + "_meta_celebrada_" + meta.id`.
- **monto_objetivo <= 0:** bloqueado por `check` constraint en DB y validación en el
  formulario antes de enviar.
- **Eliminar meta activa:** borra la fila (no archiva) — el usuario vuelve al estado
  "sin meta configurada".

## Integración

- **03-data.js:** cargar meta activa (propia o compartida del partner) junto con el
  resto de datos al iniciar la app, similar a `cargarRecurrentes`.
- **07-presupuesto.js:** `renderPresupuesto()` y `actualizarKpisPres()` deben
  actualizar la tarjeta `mm-sc-ahorro` con el nuevo modo "meta" cuando corresponda
  (ambas funciones duplican lógica de KPIs — ver gotcha conocido en memoria de
  proyecto).
- Nuevo módulo `14-metas-ahorro.js` (CRUD Supabase, cálculo de progreso, render de
  tarjeta y modal), siguiendo la convención de módulos numerados ya establecida.
- XSS: el nombre de la meta se renderiza con el helper `_esc` existente (mismo
  patrón que recurrentes).
