-- ============================================================
--  FINANZAS DASHBOARD — Schema Supabase (snapshot de referencia)
--  Proyecto: finanzas-daniel (único proyecto Supabase, workspace-scoped)
--
--  Este archivo es una FOTO del schema real de producción, generada
--  introspectando information_schema/pg_policies/pg_constraint —
--  no un script pensado para correr de punta a punta (el orden de
--  creación de tablas, funciones como my_workspace_id(), y la
--  migración big-bang de multi-tenancy se aplicaron directo en el
--  SQL Editor, sin quedar como archivos de migración). Para el DDL
--  real de esa migración ver docs/superpowers/plans/2026-07-02-multi-tenancy.md.
--  Actualizado: 2026-07-29.
-- ============================================================

-- ─── MODELO ─────────────────────────────────────────────────
-- RLS es workspace-scoped, NO user-scoped: cada fila de contenido lleva
-- workspace_id + user_id. SELECT filtra por workspace_id = my_workspace_id()
-- (así los dos miembros del workspace se ven los datos del otro).
-- INSERT/UPDATE/DELETE exigen además user_id = auth.uid() (cada quien solo
-- escribe sus propias filas, salvo proporcion_compartidos que es compartida).
--
-- my_workspace_id(): función (definición no capturada acá) que resuelve el
-- workspace_id del usuario autenticado actual vía workspace_members.

-- ─── TABLA: workspaces ────────────────────────────────────────
create table workspaces (
  id         uuid primary key default gen_random_uuid(),
  nombre     text,
  created_at timestamptz not null default now()
);
-- RLS: solo select, del propio workspace (id = my_workspace_id())

-- ─── TABLA: workspace_members ─────────────────────────────────
create table workspace_members (
  id         uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id    uuid not null unique references auth.users(id) on delete cascade,
  nombre     text not null default '',
  role       text not null default 'member',
  joined_at  timestamptz not null default now()
);
-- RLS: solo select (workspace_id = my_workspace_id()). Sin policy de UPDATE —
-- el propio nombre se escribe vía RPC security definer set_mi_nombre()
-- (docs/supabase/migrations/2026-07-09-set-mi-nombre-workspace.sql).

-- ─── TABLA: workspace_invites ──────────────────────────────────
create table workspace_invites (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  token        uuid not null unique default gen_random_uuid(),
  created_by   uuid not null references auth.users(id),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '7 days'),
  revoked_at   timestamptz,
  accepted_at  timestamptz,
  accepted_by  uuid references auth.users(id)
);

-- ─── TABLA: transacciones ─────────────────────────────────────
create table transacciones (
  id              text primary key,
  fecha           date not null,
  tipo            text not null check (tipo in ('Gasto', 'Ingreso')),
  categoria       text not null,
  monto           numeric not null check (monto >= 0),
  descripcion     text not null default '',
  usuario         text not null,
  responsabilidad text not null default 'Mío',
  fuente          text not null default '',
  moneda          text not null default 'ARS' check (moneda in ('ARS', 'USD')),
  user_id         uuid references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  mes_liquidacion text,                                          -- "YYYY-MM", solo fuentes tipo tarjeta
  compra_id       uuid,                                          -- FK lógica a compras_cuotas (sin constraint FK)
  cuota_nro       smallint,
  cuota_total     smallint,
  categoria_id    uuid not null references categorias(id) on delete restrict,
  cuenta_id       uuid not null references categorias(id) on delete restrict,
  workspace_id    uuid not null references workspaces(id),
  es_liquidacion  boolean not null default false                 -- docs/supabase/migrations/2026-07-12-liquidacion-flag.sql
);

-- ─── TABLA: categorias (gasto/ingreso/fuente/tarjeta) ─────────
create table categorias (
  id           uuid primary key default gen_random_uuid(),
  tipo         text not null check (tipo in ('GASTO', 'INGRESO', 'FUENTE', 'FUENTE_TC')),
  valor        text not null,
  usuario      text not null default '',
  user_id      uuid references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  activa       boolean default true,
  workspace_id uuid not null references workspaces(id),
  unique (tipo, valor, user_id)
);

-- ─── TABLA: presupuesto ───────────────────────────────────────
create table presupuesto (
  id           uuid primary key default gen_random_uuid(),
  mes          smallint not null check (mes between 1 and 12),
  anio         smallint not null,
  categoria    text not null,
  monto        numeric not null check (monto >= 0),
  usuario      text not null default '',
  user_id      uuid references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  workspace_id uuid not null references workspaces(id),
  unique (mes, anio, categoria, user_id)
);

-- ─── TABLA: proporcion_compartidos ─────────────────────────────
-- Compartida entre los 2 miembros del workspace (sin user_id) — el % de
-- reparto es un solo valor por mes, no una preferencia por usuario.
create table proporcion_compartidos (
  id           uuid primary key default gen_random_uuid(),
  mes          smallint not null check (mes between 1 and 12),
  anio         smallint not null,
  pct_daniel   numeric not null check (pct_daniel between 0 and 100),  -- ancla histórica, no gating por nombre — ver esMiembroReferenciaWorkspace()
  updated_by   text,
  updated_at   timestamptz not null default now(),
  workspace_id uuid not null references workspaces(id),
  unique (mes, anio)  -- nota: sin workspace_id en el constraint pese a insertarse con onConflict:'workspace_id,mes,anio' en el cliente
);

-- ─── TABLA: compras_cuotas ─────────────────────────────────────
create table compras_cuotas (
  id             uuid primary key default gen_random_uuid(),
  usuario        text not null,
  descripcion    text not null,
  categoria      text not null,
  responsabilidad text not null,
  fuente         text not null,
  moneda         text not null default 'ARS',
  monto_total    numeric not null,
  cuotas_total   smallint not null check (cuotas_total between 2 and 60),
  monto_cuota    numeric not null,
  primer_mes_liq text not null,       -- "YYYY-MM"
  cft_anual_pct  numeric,
  estado         text not null default 'activa',
  created_at     timestamptz not null default now(),
  user_id        uuid not null,
  workspace_id   uuid not null references workspaces(id)
);

-- ─── TABLA: plazos_fijos ────────────────────────────────────────
create table plazos_fijos (
  id                 uuid primary key default gen_random_uuid(),
  descripcion        text not null,
  monto              numeric not null check (monto > 0),
  moneda             text not null default 'ARS' check (moneda in ('ARS','USD')),
  tna                numeric not null check (tna >= 0),
  fecha_inicio       date not null,
  fecha_vencimiento  date not null,
  usuario            text not null default '',
  user_id            uuid references auth.users(id),
  created_at         timestamptz default now(),
  workspace_id       uuid not null references workspaces(id)
);

-- ─── TABLA: acciones (acciones + cripto) ───────────────────────
create table acciones (
  id            uuid primary key default gen_random_uuid(),
  simbolo       text not null,
  cantidad      numeric not null check (cantidad > 0),
  nombre        text not null default '',
  precio_compra numeric,
  usuario       text not null default '',
  user_id       uuid references auth.users(id),
  created_at    timestamptz default now(),
  workspace_id  uuid not null references workspaces(id)
);

-- ─── TABLA: recurrentes ─────────────────────────────────────────
create table recurrentes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade,
  usuario         text not null,
  descripcion     text not null,
  categoria       text not null,
  monto_ref       numeric,
  fuente          text,
  responsabilidad text default 'Mío',
  activa          boolean default true,
  created_at      timestamptz default now(),
  workspace_id    uuid not null references workspaces(id)
);

-- ─── TABLA: metas_ahorro ────────────────────────────────────────
create table metas_ahorro (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  usuario        text not null,
  nombre         text not null,
  monto_objetivo numeric not null check (monto_objetivo > 0),
  moneda         text not null default 'ARS',
  fecha_objetivo date,
  fecha_inicio   timestamptz not null default now(),
  compartida     boolean not null default false,
  activa         boolean not null default true,
  created_at     timestamptz not null default now(),
  workspace_id   uuid not null references workspaces(id)
);

-- ─── ROW LEVEL SECURITY (todas las tablas de contenido) ────────
-- Patrón repetido en transacciones / categorias / presupuesto /
-- compras_cuotas / plazos_fijos / acciones / recurrentes / metas_ahorro:
--   select: workspace_id = my_workspace_id()
--   insert: workspace_id = my_workspace_id() and user_id = auth.uid()
--   update/delete: user_id = auth.uid() and workspace_id = my_workspace_id()
-- Excepciones:
--   categorias_select también exige user_id = auth.uid() (no ve las
--     categorías de la pareja por RLS — cargarCategorias() en el cliente
--     hace select('*') sin filtro igual, cubierto por el propio RLS).
--   proporcion_compartidos: sin user_id en ninguna policy (compartida).
--   workspace_members / workspaces: solo select.
