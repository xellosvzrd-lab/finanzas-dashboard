-- ============================================================
--  FINANZAS DASHBOARD — Schema Supabase
--  Aplicar en: SQL Editor del proyecto (finanzas-daniel O finanzas-ama)
--  Ambos proyectos usan el mismo schema.
-- ============================================================

-- ─── EXTENSIONES ─────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── TABLA: transacciones ─────────────────────────────────────
create table if not exists transacciones (
  id              uuid primary key default gen_random_uuid(),
  fecha           date not null,
  tipo            text not null check (tipo in ('Gasto', 'Ingreso')),
  categoria       text not null,
  monto           numeric(12, 2) not null check (monto >= 0),
  descripcion     text not null default '',
  usuario         text not null,
  responsabilidad text not null default 'Mío',
  fuente          text not null default '',
  moneda          text not null default 'ARS' check (moneda in ('ARS', 'USD')),
  user_id         uuid references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now()
);

-- ─── TABLA: categorias ────────────────────────────────────────
create table if not exists categorias (
  id        uuid primary key default gen_random_uuid(),
  tipo      text not null check (tipo in ('GASTO', 'INGRESO', 'FUENTE')),
  valor     text not null,
  usuario   text not null default '',
  user_id   uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (tipo, valor, user_id)
);

-- ─── TABLA: presupuesto ───────────────────────────────────────
create table if not exists presupuesto (
  id         uuid primary key default gen_random_uuid(),
  mes        smallint not null check (mes between 1 and 12),
  anio       smallint not null,
  categoria  text not null,
  monto      numeric(12, 2) not null check (monto >= 0),
  usuario    text not null default '',
  user_id    uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (mes, anio, categoria, user_id)
);

-- ─── TABLA: proporcion_compartidos ─────────────────────────────
create table if not exists proporcion_compartidos (
  id           uuid primary key default gen_random_uuid(),
  mes          smallint not null check (mes between 1 and 12),
  anio         smallint not null,
  pct_daniel   numeric(5,2) not null check (pct_daniel >= 0 and pct_daniel <= 100),
  updated_by   text,
  updated_at   timestamptz not null default now(),
  unique (mes, anio)
);

-- ─── ÍNDICES ──────────────────────────────────────────────────
create index if not exists idx_transacciones_user_id  on transacciones(user_id);
create index if not exists idx_transacciones_fecha    on transacciones(fecha desc);
create index if not exists idx_categorias_user_id     on categorias(user_id);
create index if not exists idx_presupuesto_user_id    on presupuesto(user_id);
create index if not exists idx_presupuesto_mes_anio   on presupuesto(mes, anio);
create index if not exists idx_proporcion_compartidos_mes_anio on proporcion_compartidos(mes, anio);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────
alter table transacciones enable row level security;
alter table categorias     enable row level security;
alter table presupuesto    enable row level security;
alter table proporcion_compartidos enable row level security;

-- Transacciones: cada usuario ve y modifica solo sus filas
create policy "transacciones_select" on transacciones
  for select using (auth.uid() = user_id);

create policy "transacciones_insert" on transacciones
  for insert with check (auth.uid() = user_id);

create policy "transacciones_update" on transacciones
  for update using (auth.uid() = user_id);

create policy "transacciones_delete" on transacciones
  for delete using (auth.uid() = user_id);

-- Categorias: ídem
create policy "categorias_select" on categorias
  for select using (auth.uid() = user_id);

create policy "categorias_insert" on categorias
  for insert with check (auth.uid() = user_id);

create policy "categorias_update" on categorias
  for update using (auth.uid() = user_id);

create policy "categorias_delete" on categorias
  for delete using (auth.uid() = user_id);

-- Presupuesto: ídem
create policy "presupuesto_select" on presupuesto
  for select using (auth.uid() = user_id);

create policy "presupuesto_insert" on presupuesto
  for insert with check (auth.uid() = user_id);

create policy "presupuesto_update" on presupuesto
  for update using (auth.uid() = user_id);

create policy "presupuesto_delete" on presupuesto
  for delete using (auth.uid() = user_id);

-- Proporción de compartidos: sin user_id, el ratio es compartido entre
-- Daniel y Ama — cualquier usuario autenticado de esta instancia puede
-- leer y escribir todas las filas.
create policy "proporcion_compartidos_select" on proporcion_compartidos
  for select using (auth.role() = 'authenticated');

create policy "proporcion_compartidos_insert" on proporcion_compartidos
  for insert with check (auth.role() = 'authenticated');

create policy "proporcion_compartidos_update" on proporcion_compartidos
  for update using (auth.role() = 'authenticated');
