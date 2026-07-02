# Multi-tenancy — Workspace de Pareja — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el hack de 2 UUIDs hardcodeados en la RLS de `transacciones` (y la ausencia de un mecanismo equivalente en el resto de las tablas) por un modelo real de "workspace de pareja": `workspace_id` en las 9 tablas de contenido, RLS basada en membresía, y un flujo de invitación por link para sumar al segundo miembro — sin cambiar ningún comportamiento observable para Daniel y Ama.

**Architecture:** 3 tablas nuevas (`workspaces`, `workspace_members`, `workspace_invites`) y una función `security definer` (`my_workspace_id()`) que centraliza "cuál es mi workspace" para todas las políticas RLS. Dos funciones `security definer` adicionales (`handle_new_user()`, `accept_workspace_invite()`) manejan el alta automática de workspace para usuarios nuevos y la aceptación de invitaciones sin exponer `workspace_members` a escritura directa desde el cliente. Del lado del cliente, un módulo nuevo `src/js/17-workspace.js` resuelve `PARTNER` dinámicamente desde `workspace_members` en vez de comparar contra los strings `"Daniel"`/`"Ama"`, y agrega la UI de invitar/aceptar. La migración de datos de Daniel/Ama es big-bang, en una sola ventana de mantenimiento.

**Tech Stack:** Vanilla JS, Supabase (PostgreSQL + RLS + Postgres Functions/Triggers), build.sh (concatenación alfabética de `src/js/*.js`)

## Global Constraints

- Spec de referencia: `docs/superpowers/specs/2026-07-02-multi-tenancy-design.md` (aprobado).
- El modelo de datos de membresía (`workspace_members`) admite N miembros por workspace desde el día uno; la lógica de negocio de responsabilidad/liquidación sigue siendo binaria (2 personas) — limitación conocida y documentada, no se resuelve en este plan.
- Un usuario pertenece a exactamente 1 workspace activo a la vez (`unique(user_id)` en `workspace_members`).
- Toda función `security definer` DEBE fijar `search_path` explícitamente (`set search_path = public, pg_temp`) para evitar search-path hijacking. Después de crear las 3 funciones `security definer`, hay que correr los Database Advisors de Supabase y confirmar que no quedan warnings de seguridad (ver checkpoint en Tarea 6).
- No hay merge de datos al aceptar una invitación: si el workspace del invitado ya tiene filas en cualquiera de las 9 tablas de contenido, se bloquea a nivel de base de datos, no solo con un aviso visual.
- UPDATE/DELETE de las tablas de contenido se mantienen restringidas al dueño de la fila (`user_id = auth.uid()`) — sin cambio de comportamiento respecto a hoy.
- `PARTNER`/`USUARIO` son variables dinámicas — nunca hardcodear "Daniel"/"Ama" en lógica de membresía nueva (sí pueden seguir apareciendo como literales en ramas de personalización regional ya existentes, que quedan fuera de alcance de este plan).
- Sin suite de tests automatizada en este proyecto — toda verificación es manual sobre el preview de Vercel y, para la migración de datos reales, sobre producción durante la ventana de mantenimiento.
- Mobile responsiveness y tema claro de Ama (`[data-theme="light"]`) son restricciones de diseño obligatorias para cualquier UI nueva.
- Fuera de alcance (no implementar en este plan): selector de múltiples workspaces por usuario, código corto de invitación, merge de datos, JWT custom claims, normalización completa de `usuario`→`user_id` en la lógica de negocio existente, generalización regional (tema/moneda/MEP por workspace), permisos diferenciados por `role`.

---

## Archivos involucrados

| Acción | Archivo |
|---|---|
| SQL (manual) | Supabase SQL Editor — tablas `workspaces`, `workspace_members`, `workspace_invites`, funciones `security definer`, backfill, RLS |
| Crear | `src/js/17-workspace.js` |
| Modificar | `src/index.template.html` — card "Mi pareja" en Categorías, modal de aceptar invitación, card de registro por email, empty state de Compartidos |
| Modificar | `src/js/01-config.js` — captura de `?invite=` en `DOMContentLoaded`, estado global `workspaceMembers` |
| Modificar | `src/js/02-auth.js` — flujo de registro por email (nuevo, no existía) |
| Modificar | `src/js/03-data.js` — `_setVariablesUsuario`, `_configurarUsuario`, `guardarNombre`, `iniciarApp` |
| Modificar | `src/js/06-compartidos.js` — empty state cuando `PARTNER === null` |

> `build.sh` incluye `17-workspace.js` automáticamente: usa `sorted(glob.glob("src/js/*.js"))` — orden alfabético, sin cambios necesarios en `build.sh`.

### Gap descubierto durante la investigación (no estaba en el spec)

El spec asume que un invitado "se registra (o inicia sesión si ya tenía cuenta)". Al revisar `src/js/02-auth.js` y `src/index.template.html`, **hoy no existe ningún flujo de alta por email/contraseña** — `guardarConfig()` solo llama a `signInWithPassword` (login, no signup); la única forma de crear una cuenta nueva hoy es manualmente desde el Dashboard de Supabase, o vía Google OAuth (que sí auto-provisiona la cuenta en el primer login). Esto significa que, sin trabajo adicional, **solo alguien con Google podría aceptar una invitación** — cualquier invitado que prefiera email/contraseña quedaría bloqueado sin poder crear su cuenta. La Tarea 10 de este plan agrega un flujo mínimo de alta por email para cerrar ese hueco.

---

## Task 1: SQL — Tablas base y función `my_workspace_id()`

**Files:**
- SQL a ejecutar en: Supabase Dashboard → SQL Editor

- [ ] **Paso 1: Ejecutar la migración de tablas base**

```sql
create table workspaces (
  id         uuid primary key default gen_random_uuid(),
  nombre     text,
  created_at timestamptz not null default now()
);

create table workspace_members (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  nombre       text not null default '',
  role         text not null default 'member',
  joined_at    timestamptz not null default now(),
  unique (user_id)
);

create index idx_workspace_members_workspace on workspace_members(workspace_id);

alter table workspaces        enable row level security;
alter table workspace_members enable row level security;
```

- [ ] **Paso 2: Crear la función helper `my_workspace_id()` con `search_path` fijo**

```sql
create function my_workspace_id()
returns uuid
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select workspace_id from workspace_members where user_id = auth.uid() limit 1
$$;
```

- [ ] **Paso 3: Políticas RLS de `workspaces` y `workspace_members`**

```sql
-- workspaces: un miembro puede ver el workspace al que pertenece
create policy "workspaces_select" on workspaces
  for select using (id = my_workspace_id());

-- workspace_members: cualquier miembro del mismo workspace ve la lista completa
-- (necesario para resolver el nombre de PARTNER en el cliente)
create policy "workspace_members_select" on workspace_members
  for select using (workspace_id = my_workspace_id());

-- Nota: NO se crean policies de insert/update/delete para workspace_members
-- ni para workspaces. Con RLS habilitado y sin policy que lo permita, el
-- cliente (anon/authenticated key) no puede escribir en estas tablas bajo
-- ninguna circunstancia — toda escritura pasa exclusivamente por las
-- funciones security definer de las Tareas 5 y 6, que bypasean RLS.
```

- [ ] **Paso 4: Verificar en Supabase Dashboard**

Table Editor → confirmar que `workspaces` y `workspace_members` existen con RLS habilitado (ícono de candado). Database → Functions → confirmar que `my_workspace_id` aparece con "Security Definer" = true.

- [ ] **Paso 5: Commit**

```bash
git commit --allow-empty -m "infra: tablas workspaces/workspace_members + my_workspace_id()"
```

---

## Task 2: SQL — Backfill de Daniel y Ama a un workspace único

**Files:**
- SQL a ejecutar en: Supabase Dashboard → SQL Editor

**Interfaces:**
- Consumes: `workspaces`, `workspace_members` (Tarea 1)
- Produces: 1 fila en `workspaces` y 2 filas en `workspace_members` que Task 3 usará para el backfill de `workspace_id` en las 9 tablas de contenido

- [ ] **Paso 1: Confirmar qué UUID corresponde a Daniel y cuál a Ama**

Estos son los mismos 2 UUIDs que hoy aparecen hardcodeados en la policy `transacciones_select` (confirmados previamente contra `pg_policies`): `8c17e31c-f333-4575-a220-4f157f34c314` y `d04747c8-4217-4a9f-a539-dc55465040a8`. Antes de usarlos, confirmar la asignación exacta por email en Supabase Dashboard → Authentication → Users:

```sql
select id, email from auth.users
where id in ('8c17e31c-f333-4575-a220-4f157f34c314', 'd04747c8-4217-4a9f-a539-dc55465040a8');
```

Anotar cuál de los dos `id` corresponde al email de Daniel y cuál al de Ama antes de continuar al Paso 2.

- [ ] **Paso 2: Insertar el workspace y las 2 membresías**

```sql
-- Ajustar cuál UUID va con 'Daniel' y cuál con 'Ama' según lo confirmado en el Paso 1
with nuevo_ws as (
  insert into workspaces (nombre) values ('Daniel & Ama') returning id
)
insert into workspace_members (workspace_id, user_id, nombre, role)
select id, '8c17e31c-f333-4575-a220-4f157f34c314'::uuid, 'Daniel', 'owner' from nuevo_ws
union all
select id, 'd04747c8-4217-4a9f-a539-dc55465040a8'::uuid, 'Ama',    'member' from nuevo_ws;
```

- [ ] **Paso 3: Verificar y guardar el `workspace_id` resultante**

```sql
select w.id as workspace_id, wm.nombre, wm.user_id
from workspaces w join workspace_members wm on wm.workspace_id = w.id;
```

Debe devolver 2 filas con el mismo `workspace_id`. **Copiar ese `workspace_id`** — se usa literal en la Tarea 3.

- [ ] **Paso 4: Commit**

```bash
git commit --allow-empty -m "infra: backfill workspace único para Daniel y Ama"
```

---

## Task 3: SQL — `workspace_id` en las 9 tablas de contenido

**Files:**
- SQL a ejecutar en: Supabase Dashboard → SQL Editor

**Interfaces:**
- Consumes: `workspace_id` obtenido en la Tarea 2, Paso 3

- [ ] **Paso 1: Agregar la columna nullable a las 9 tablas**

```sql
alter table transacciones          add column workspace_id uuid references workspaces(id);
alter table categorias             add column workspace_id uuid references workspaces(id);
alter table presupuesto            add column workspace_id uuid references workspaces(id);
alter table compras_cuotas         add column workspace_id uuid references workspaces(id);
alter table metas_ahorro           add column workspace_id uuid references workspaces(id);
alter table plazos_fijos           add column workspace_id uuid references workspaces(id);
alter table acciones               add column workspace_id uuid references workspaces(id);
alter table recurrentes            add column workspace_id uuid references workspaces(id);
alter table proporcion_compartidos add column workspace_id uuid references workspaces(id);
```

- [ ] **Paso 2: Backfill — todas las filas existentes pertenecen al único workspace**

```sql
-- Reemplazar <workspace-id> por el valor copiado en la Tarea 2, Paso 3
update transacciones          set workspace_id = '<workspace-id>' where workspace_id is null;
update categorias             set workspace_id = '<workspace-id>' where workspace_id is null;
update presupuesto            set workspace_id = '<workspace-id>' where workspace_id is null;
update compras_cuotas         set workspace_id = '<workspace-id>' where workspace_id is null;
update metas_ahorro           set workspace_id = '<workspace-id>' where workspace_id is null;
update plazos_fijos           set workspace_id = '<workspace-id>' where workspace_id is null;
update acciones               set workspace_id = '<workspace-id>' where workspace_id is null;
update recurrentes            set workspace_id = '<workspace-id>' where workspace_id is null;
update proporcion_compartidos set workspace_id = '<workspace-id>' where workspace_id is null;
```

- [ ] **Paso 2b: Verificar que no queda ninguna fila sin `workspace_id`**

```sql
select 'transacciones'          as tabla, count(*) from transacciones          where workspace_id is null
union all select 'categorias',             count(*) from categorias             where workspace_id is null
union all select 'presupuesto',            count(*) from presupuesto            where workspace_id is null
union all select 'compras_cuotas',         count(*) from compras_cuotas         where workspace_id is null
union all select 'metas_ahorro',           count(*) from metas_ahorro           where workspace_id is null
union all select 'plazos_fijos',           count(*) from plazos_fijos           where workspace_id is null
union all select 'acciones',               count(*) from acciones               where workspace_id is null
union all select 'recurrentes',            count(*) from recurrentes            where workspace_id is null
union all select 'proporcion_compartidos', count(*) from proporcion_compartidos where workspace_id is null;
```

Todas las filas deben devolver `count = 0` antes de continuar al Paso 3. Si alguna tabla devuelve un valor mayor a 0, no seguir — investigar por qué esa tabla tiene filas fuera del backfill (ej. filas insertadas entre la Tarea 2 y este paso) antes de forzar `not null`.

- [ ] **Paso 3: `not null` + índice en cada tabla**

```sql
alter table transacciones          alter column workspace_id set not null;
alter table categorias             alter column workspace_id set not null;
alter table presupuesto            alter column workspace_id set not null;
alter table compras_cuotas         alter column workspace_id set not null;
alter table metas_ahorro           alter column workspace_id set not null;
alter table plazos_fijos           alter column workspace_id set not null;
alter table acciones               alter column workspace_id set not null;
alter table recurrentes            alter column workspace_id set not null;
alter table proporcion_compartidos alter column workspace_id set not null;

create index idx_transacciones_workspace_id          on transacciones(workspace_id);
create index idx_categorias_workspace_id             on categorias(workspace_id);
create index idx_presupuesto_workspace_id            on presupuesto(workspace_id);
create index idx_compras_cuotas_workspace_id         on compras_cuotas(workspace_id);
create index idx_metas_ahorro_workspace_id           on metas_ahorro(workspace_id);
create index idx_plazos_fijos_workspace_id           on plazos_fijos(workspace_id);
create index idx_acciones_workspace_id               on acciones(workspace_id);
create index idx_recurrentes_workspace_id            on recurrentes(workspace_id);
create index idx_proporcion_compartidos_workspace_id on proporcion_compartidos(workspace_id);
```

- [ ] **Paso 4: Commit**

```bash
git commit --allow-empty -m "infra: workspace_id agregado y backfilleado en las 9 tablas de contenido"
```

---

## Task 4: SQL — Reemplazo de políticas RLS en las 9 tablas de contenido

**Files:**
- SQL a ejecutar en: Supabase Dashboard → SQL Editor

**Interfaces:**
- Consumes: `my_workspace_id()` (Tarea 1)

- [ ] **Paso 1: Borrar las políticas viejas**

```sql
-- transacciones (incluye el hack de 2 UUIDs hardcodeados)
drop policy if exists "transacciones_select" on transacciones;
drop policy if exists "transacciones_insert" on transacciones;
drop policy if exists "transacciones_update" on transacciones;
drop policy if exists "transacciones_delete" on transacciones;

-- categorias / presupuesto (policies simples auth.uid()=user_id)
drop policy if exists "categorias_select" on categorias;
drop policy if exists "categorias_insert" on categorias;
drop policy if exists "categorias_update" on categorias;
drop policy if exists "categorias_delete" on categorias;
drop policy if exists "presupuesto_select" on presupuesto;
drop policy if exists "presupuesto_insert" on presupuesto;
drop policy if exists "presupuesto_update" on presupuesto;
drop policy if exists "presupuesto_delete" on presupuesto;

-- proporcion_compartidos (policy "cualquier autenticado")
drop policy if exists "proporcion_compartidos_select" on proporcion_compartidos;
drop policy if exists "proporcion_compartidos_insert" on proporcion_compartidos;
drop policy if exists "proporcion_compartidos_update" on proporcion_compartidos;

-- compras_cuotas / metas_ahorro / plazos_fijos / acciones / recurrentes:
-- si existen policies previas con otros nombres, listarlas primero con
-- `select policyname from pg_policies where tablename = '<tabla>';`
-- y borrarlas una por una antes de crear las nuevas del Paso 2.
```

- [ ] **Paso 2: Crear las políticas nuevas para las 8 tablas con `user_id`**

```sql
-- Repetir este bloque de 4 policies para cada una de estas 8 tablas:
-- transacciones, categorias, presupuesto, compras_cuotas, metas_ahorro,
-- plazos_fijos, acciones, recurrentes

create policy "transacciones_select" on transacciones
  for select using (workspace_id = my_workspace_id());
create policy "transacciones_insert" on transacciones
  for insert with check (workspace_id = my_workspace_id() and user_id = auth.uid());
create policy "transacciones_update" on transacciones
  for update using (user_id = auth.uid() and workspace_id = my_workspace_id());
create policy "transacciones_delete" on transacciones
  for delete using (user_id = auth.uid() and workspace_id = my_workspace_id());

create policy "categorias_select" on categorias
  for select using (workspace_id = my_workspace_id());
create policy "categorias_insert" on categorias
  for insert with check (workspace_id = my_workspace_id() and user_id = auth.uid());
create policy "categorias_update" on categorias
  for update using (user_id = auth.uid() and workspace_id = my_workspace_id());
create policy "categorias_delete" on categorias
  for delete using (user_id = auth.uid() and workspace_id = my_workspace_id());

create policy "presupuesto_select" on presupuesto
  for select using (workspace_id = my_workspace_id());
create policy "presupuesto_insert" on presupuesto
  for insert with check (workspace_id = my_workspace_id() and user_id = auth.uid());
create policy "presupuesto_update" on presupuesto
  for update using (user_id = auth.uid() and workspace_id = my_workspace_id());
create policy "presupuesto_delete" on presupuesto
  for delete using (user_id = auth.uid() and workspace_id = my_workspace_id());

create policy "compras_cuotas_select" on compras_cuotas
  for select using (workspace_id = my_workspace_id());
create policy "compras_cuotas_insert" on compras_cuotas
  for insert with check (workspace_id = my_workspace_id() and user_id = auth.uid());
create policy "compras_cuotas_update" on compras_cuotas
  for update using (user_id = auth.uid() and workspace_id = my_workspace_id());
create policy "compras_cuotas_delete" on compras_cuotas
  for delete using (user_id = auth.uid() and workspace_id = my_workspace_id());

create policy "metas_ahorro_select" on metas_ahorro
  for select using (workspace_id = my_workspace_id());
create policy "metas_ahorro_insert" on metas_ahorro
  for insert with check (workspace_id = my_workspace_id() and user_id = auth.uid());
create policy "metas_ahorro_update" on metas_ahorro
  for update using (user_id = auth.uid() and workspace_id = my_workspace_id());
create policy "metas_ahorro_delete" on metas_ahorro
  for delete using (user_id = auth.uid() and workspace_id = my_workspace_id());

create policy "plazos_fijos_select" on plazos_fijos
  for select using (workspace_id = my_workspace_id());
create policy "plazos_fijos_insert" on plazos_fijos
  for insert with check (workspace_id = my_workspace_id() and user_id = auth.uid());
create policy "plazos_fijos_update" on plazos_fijos
  for update using (user_id = auth.uid() and workspace_id = my_workspace_id());
create policy "plazos_fijos_delete" on plazos_fijos
  for delete using (user_id = auth.uid() and workspace_id = my_workspace_id());

create policy "acciones_select" on acciones
  for select using (workspace_id = my_workspace_id());
create policy "acciones_insert" on acciones
  for insert with check (workspace_id = my_workspace_id() and user_id = auth.uid());
create policy "acciones_update" on acciones
  for update using (user_id = auth.uid() and workspace_id = my_workspace_id());
create policy "acciones_delete" on acciones
  for delete using (user_id = auth.uid() and workspace_id = my_workspace_id());

create policy "recurrentes_select" on recurrentes
  for select using (workspace_id = my_workspace_id());
create policy "recurrentes_insert" on recurrentes
  for insert with check (workspace_id = my_workspace_id() and user_id = auth.uid());
create policy "recurrentes_update" on recurrentes
  for update using (user_id = auth.uid() and workspace_id = my_workspace_id());
create policy "recurrentes_delete" on recurrentes
  for delete using (user_id = auth.uid() and workspace_id = my_workspace_id());
```

- [ ] **Paso 3: Crear las políticas nuevas para `proporcion_compartidos` (sin `user_id`)**

```sql
create policy "proporcion_compartidos_select" on proporcion_compartidos
  for select using (workspace_id = my_workspace_id());
create policy "proporcion_compartidos_insert" on proporcion_compartidos
  for insert with check (workspace_id = my_workspace_id());
create policy "proporcion_compartidos_update" on proporcion_compartidos
  for update using (workspace_id = my_workspace_id());
```

- [ ] **Paso 4: Verificar con `pg_policies`**

```sql
select tablename, policyname, cmd
from pg_policies
where tablename in ('transacciones','categorias','presupuesto','compras_cuotas',
                     'metas_ahorro','plazos_fijos','acciones','recurrentes',
                     'proporcion_compartidos')
order by tablename, cmd;
```

Confirmar que cada tabla tiene exactamente 4 policies (3 para `proporcion_compartidos`, sin `delete`), y que ninguna contiene ya el `OR` con UUIDs literales de Daniel/Ama.

- [ ] **Paso 5: Commit**

```bash
git commit --allow-empty -m "security: reemplazar hack de 2 UUIDs por RLS basada en workspace_id en las 9 tablas"
```

---

## Task 5: SQL — Alta automática de workspace para usuarios nuevos (`handle_new_user`)

**Files:**
- SQL a ejecutar en: Supabase Dashboard → SQL Editor

**Interfaces:**
- Consumes: `workspaces`, `workspace_members` (Tarea 1)
- Produces: cualquier fila nueva en `auth.users` (registro futuro) dispara automáticamente la creación de su workspace individual + membership

- [ ] **Paso 1: Crear la función `handle_new_user()` con `search_path` fijo**

```sql
create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  nuevo_ws_id uuid;
begin
  insert into workspaces (nombre) values (null) returning id into nuevo_ws_id;
  insert into workspace_members (workspace_id, user_id, nombre, role)
    values (nuevo_ws_id, new.id, coalesce(new.raw_user_meta_data->>'nombre', ''), 'owner');
  return new;
end;
$$;
```

- [ ] **Paso 2: Crear el trigger sobre `auth.users`**

```sql
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

- [ ] **Paso 3: Verificar con un usuario de prueba**

Crear un usuario nuevo desde Authentication → Users → Add User (email de prueba, ej. `test-workspace@example.com`). Correr:

```sql
select w.id, wm.user_id, wm.nombre, wm.role
from workspaces w
join workspace_members wm on wm.workspace_id = w.id
where wm.user_id = (select id from auth.users where email = 'test-workspace@example.com');
```

Debe devolver exactamente 1 fila con `role = 'owner'`. Borrar el usuario de prueba después de verificar (Authentication → Users → Delete User; el `on delete cascade` de `workspace_members.user_id` limpia la membership, y la fila de `workspaces` queda huérfana pero vacía — se puede borrar a mano con `delete from workspaces where id not in (select workspace_id from workspace_members);` si se quiere prolijidad, no es obligatorio).

- [ ] **Paso 4: Commit**

```bash
git commit --allow-empty -m "infra: trigger handle_new_user() crea workspace individual en cada alta"
```

---

## Task 6: SQL — Invitaciones (`workspace_invites` + `accept_workspace_invite`) + checkpoint de seguridad

**Files:**
- SQL a ejecutar en: Supabase Dashboard → SQL Editor

**Interfaces:**
- Consumes: `workspaces`, `workspace_members`, `my_workspace_id()` (Tareas 1, 5)
- Produces: `accept_workspace_invite(p_token uuid)` — función RPC llamada desde el cliente en la Tarea 8

- [ ] **Paso 1: Crear la tabla `workspace_invites`**

```sql
create table workspace_invites (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  token        uuid not null default gen_random_uuid() unique,
  created_by   uuid not null references auth.users(id),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '7 days'),
  revoked_at   timestamptz,
  accepted_at  timestamptz,
  accepted_by  uuid references auth.users(id)
);

create index idx_workspace_invites_workspace on workspace_invites(workspace_id);
create index idx_workspace_invites_token     on workspace_invites(token);

alter table workspace_invites enable row level security;

create policy "workspace_invites_select" on workspace_invites
  for select using (workspace_id = my_workspace_id());
create policy "workspace_invites_insert" on workspace_invites
  for insert with check (workspace_id = my_workspace_id() and created_by = auth.uid());
create policy "workspace_invites_update" on workspace_invites
  for update using (workspace_id = my_workspace_id());
```

`workspace_invites_update` permite a cualquier miembro de mi propio workspace revocar una invitación (`set revoked_at = now()`) — es la única escritura directa desde el cliente sobre esta tabla. Aceptar una invitación de OTRO workspace no puede pasar por esta policy (el que acepta no pertenece a ese workspace); eso lo resuelve la función del Paso 2.

- [ ] **Paso 2: Crear `accept_workspace_invite(p_token uuid)` con `search_path` fijo**

```sql
create function accept_workspace_invite(p_token uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invite       workspace_invites%rowtype;
  v_mi_ws_id     uuid;
  v_filas_propias bigint;
begin
  select * into v_invite from workspace_invites where token = p_token;

  if v_invite.id is null then
    raise exception 'INVITE_NOT_FOUND';
  end if;
  if v_invite.revoked_at is not null then
    raise exception 'INVITE_REVOKED';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'INVITE_ALREADY_ACCEPTED';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'INVITE_EXPIRED';
  end if;

  select workspace_id into v_mi_ws_id from workspace_members where user_id = auth.uid();

  if v_mi_ws_id = v_invite.workspace_id then
    raise exception 'ALREADY_MEMBER';
  end if;

  select
    (select count(*) from transacciones          where workspace_id = v_mi_ws_id) +
    (select count(*) from categorias             where workspace_id = v_mi_ws_id) +
    (select count(*) from presupuesto            where workspace_id = v_mi_ws_id) +
    (select count(*) from compras_cuotas         where workspace_id = v_mi_ws_id) +
    (select count(*) from metas_ahorro           where workspace_id = v_mi_ws_id) +
    (select count(*) from plazos_fijos           where workspace_id = v_mi_ws_id) +
    (select count(*) from acciones               where workspace_id = v_mi_ws_id) +
    (select count(*) from recurrentes            where workspace_id = v_mi_ws_id) +
    (select count(*) from proporcion_compartidos where workspace_id = v_mi_ws_id)
  into v_filas_propias;

  if v_filas_propias > 0 then
    raise exception 'HAS_OWN_DATA';
  end if;

  update workspace_members
    set workspace_id = v_invite.workspace_id
    where user_id = auth.uid();

  delete from workspaces where id = v_mi_ws_id;

  update workspace_invites
    set accepted_at = now(), accepted_by = auth.uid()
    where id = v_invite.id;
end;
$$;

grant execute on function accept_workspace_invite(uuid) to authenticated;
```

Nota sobre el orden de operaciones (importante, coincide con el spec): primero se actualiza `workspace_members` para mover al usuario a su nuevo workspace, y **recién después** se borra el workspace viejo — así el `on delete cascade` de `workspace_members.workspace_id` no borra por error la fila que ya se movió.

- [ ] **Paso 3: Probar la función manualmente**

Con dos usuarios de prueba (uno "invitador", uno "invitado", ambos sin datos propios): generar un token a mano (`insert into workspace_invites (workspace_id, created_by) values ('<ws-invitador>', '<uid-invitador>') returning token;`), después ejecutar como el usuario invitado (usando el SQL Editor con `set role authenticated; set request.jwt.claim.sub = '<uid-invitado>';` o, más simple, probando desde el cliente en la Tarea 8) `select accept_workspace_invite('<token>');`, y verificar con la query de la Tarea 5, Paso 3 que el invitado ahora pertenece al workspace del invitador.

- [ ] **Paso 4 — CHECKPOINT DE SEGURIDAD (obligatorio antes de continuar):**

Correr los Database Advisors de Supabase: Dashboard → **Database → Advisors → Security Advisor** (o, si se dispone del tool MCP de Supabase, `get_advisors` con `type: "security"`). Confirmar explícitamente:

1. **No aparece ningún warning "Function Search Path Mutable"** para `my_workspace_id`, `handle_new_user` ni `accept_workspace_invite` — las tres deben figurar con `search_path` fijo (`public, pg_temp`), confirmando que el `set search_path` de los Pasos anteriores se aplicó correctamente.
2. **No aparece ningún warning de RLS deshabilitado** para `workspaces`, `workspace_members` ni `workspace_invites`.
3. Si aparece cualquier otro warning nuevo relacionado a estas tablas/funciones, no continuar a la Tarea 7 sin resolverlo o documentar explícitamente por qué se acepta el riesgo.

Si el Advisor reporta algún hallazgo, corregirlo con `alter function <nombre> set search_path = public, pg_temp;` (si el problema es search_path) antes de marcar este paso como completo.

- [ ] **Paso 5: Commit**

```bash
git commit --allow-empty -m "infra: workspace_invites + accept_workspace_invite(), checkpoint de seguridad OK"
```

---

## Task 7: Cliente — `src/js/17-workspace.js` (estado, resolución de PARTNER, invitaciones)

**Files:**
- Create: `src/js/17-workspace.js`

**Interfaces:**
- Produces: `workspaceMembers` (array), `cargarWorkspaceMembers()` (async, sin retorno), `resolverPartnerNombre()` → string|null, `generarInvitacion()` (async) → string (URL completa) o `null` si falla, `revocarInvitacion(inviteId)` (async, sin retorno), `listarInvitacionesPendientes()` (async) → array

- [ ] **Paso 1: Crear el archivo con estado y carga de miembros**

```javascript
// ─── WORKSPACE DE PAREJA ────────────────────────────────────────
let workspaceMembers = []; // filas de workspace_members visibles para mi workspace

async function cargarWorkspaceMembers() {
  try {
    const { data, error } = await supabaseClient.from('workspace_members').select('*');
    if (error) throw error;
    workspaceMembers = data || [];
  } catch(e) {
    console.warn("Error cargando workspace_members:", e);
    workspaceMembers = [];
  }
}

// Nombre del primer miembro del workspace que no soy yo. null si todavía
// estoy solo (no invité a nadie, o la invitación no fue aceptada aún).
function resolverPartnerNombre() {
  if (!supabaseSession) return null;
  const otro = workspaceMembers.find(m => m.user_id !== supabaseSession.user.id);
  return otro ? otro.nombre : null;
}
```

- [ ] **Paso 2: Agregar generación y revocación de invitaciones**

Agregar al final del archivo:

```javascript

async function generarInvitacion() {
  try {
    const miWorkspaceId = workspaceMembers.find(m => m.user_id === supabaseSession.user.id)?.workspace_id;
    if (!miWorkspaceId) throw new Error("No se encontró mi workspace");

    // Revocar cualquier invitación pendiente previa antes de crear una nueva
    const pendientes = await listarInvitacionesPendientes();
    for (const inv of pendientes) await revocarInvitacion(inv.id);

    const { data, error } = await supabaseClient
      .from('workspace_invites')
      .insert({ workspace_id: miWorkspaceId, created_by: supabaseSession.user.id })
      .select('token')
      .single();
    if (error) throw error;

    return `${window.location.origin}${window.location.pathname}?invite=${data.token}`;
  } catch(e) {
    console.warn("Error generando invitación:", e);
    showToast("⚠️ No se pudo generar el link de invitación", "err");
    return null;
  }
}

async function listarInvitacionesPendientes() {
  try {
    const { data, error } = await supabaseClient
      .from('workspace_invites')
      .select('*')
      .is('revoked_at', null)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString());
    if (error) throw error;
    return data || [];
  } catch(e) {
    console.warn("Error listando invitaciones:", e);
    return [];
  }
}

async function revocarInvitacion(inviteId) {
  try {
    const { error } = await supabaseClient
      .from('workspace_invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', inviteId);
    if (error) throw error;
  } catch(e) {
    console.warn("Error revocando invitación:", e);
  }
}
```

- [ ] **Paso 3: Build y verificar que no hay errores de sintaxis**

```bash
./build.sh
node --check index.html 2>&1 | head -5 || true
```

(El `node --check` sobre un archivo HTML fallará por el HTML en sí — el chequeo real es que `build.sh` termine sin error de Python y que el conteo de líneas de `17-workspace.js` aparezca en el output.)

- [ ] **Paso 4: Commit**

```bash
git add src/js/17-workspace.js
git commit -m "feat(workspace): módulo cliente — carga de miembros, resolución de PARTNER, invitaciones"
```

---

## Task 8: Cliente — Aceptar invitación (detección de `?invite=`, modal, RPC)

**Files:**
- Modify: `src/js/01-config.js` (captura del parámetro de URL)
- Modify: `src/js/17-workspace.js` (función de aceptación)
- Modify: `src/index.template.html` (modal de confirmación)

**Interfaces:**
- Consumes: `accept_workspace_invite` (RPC de la Tarea 6), `cargarWorkspaceMembers()` (Tarea 7)
- Produces: `aceptarInvitacionPendiente()` (async, sin retorno), llamado desde `iniciarApp()` en la Tarea 9

- [ ] **Paso 1: Capturar `?invite=` al cargar la página, antes de cualquier login**

En `src/js/01-config.js`, dentro de `window.addEventListener("DOMContentLoaded", async () => { ... })`, agregar como primera línea del handler (antes de `if (window.lucide) lucide.createIcons();`):

```javascript
window.addEventListener("DOMContentLoaded", async () => {
  const _inviteParam = new URLSearchParams(window.location.search).get("invite");
  if (_inviteParam) {
    sessionStorage.setItem("fp_invite_token", _inviteParam);
    // Limpiar el query param de la URL visible sin recargar la página
    window.history.replaceState({}, "", window.location.pathname);
  }

  if (window.lucide) lucide.createIcons();
  // ... resto del handler existente sin cambios
```

- [ ] **Paso 2: Agregar el modal de confirmación al HTML**

En `src/index.template.html`, agregar después del cierre de `<div id="modal-nombre">` (buscar la línea `</div>` que cierra ese modal, alrededor de la línea 3679 del archivo actual):

```html
<!-- MODAL: aceptar invitación de workspace -->
<div id="modal-invitacion" style="display:none;position:fixed;inset:0;z-index:9999;
     background:var(--overlay);align-items:center;justify-content:center;">
  <div style="background:var(--card);border:1px solid var(--border);border-radius:16px;
              padding:2rem;max-width:380px;width:90%;text-align:center;">
    <div style="font-size:2rem;margin-bottom:.5rem;">🤝</div>
    <h2 style="margin:0 0 .5rem;font-size:1.2rem;">Invitación a un workspace</h2>
    <p style="color:var(--text-muted);font-size:.85rem;margin:0 0 1.25rem;">
      Vas a unirte a un workspace compartido. Esto es definitivo en esta versión —
      no se puede combinar con datos propios ya cargados.
    </p>
    <div style="display:flex;gap:.6rem;justify-content:center;">
      <button class="btn" style="background:none;color:var(--text-muted)" onclick="cerrarModalInvitacion()">Cancelar</button>
      <button class="btn btn-primary" onclick="confirmarAceptarInvitacion()">Unirme →</button>
    </div>
    <div id="modal-invitacion-msg" style="margin-top:.75rem;font-size:.82rem;min-height:1rem;"></div>
  </div>
</div>
```

- [ ] **Paso 3: Agregar las funciones de aceptación a `17-workspace.js`**

Agregar al final del archivo:

```javascript

// Se llama una vez por sesión, desde iniciarApp() (Tarea 9), después de que
// USUARIO y workspaceMembers ya están resueltos.
function aceptarInvitacionPendiente() {
  const token = sessionStorage.getItem("fp_invite_token");
  if (!token) return;
  document.getElementById("modal-invitacion").style.display = "flex";
}

function cerrarModalInvitacion() {
  sessionStorage.removeItem("fp_invite_token");
  document.getElementById("modal-invitacion").style.display = "none";
}

async function confirmarAceptarInvitacion() {
  const token = sessionStorage.getItem("fp_invite_token");
  const msg   = document.getElementById("modal-invitacion-msg");
  if (!token) { cerrarModalInvitacion(); return; }

  msg.innerHTML = "⏳ Uniéndote...";
  const { error } = await supabaseClient.rpc("accept_workspace_invite", { p_token: token });

  const MENSAJES = {
    INVITE_NOT_FOUND:        "Ese link de invitación no existe.",
    INVITE_REVOKED:          "Esa invitación fue revocada.",
    INVITE_ALREADY_ACCEPTED: "Esa invitación ya fue aceptada.",
    INVITE_EXPIRED:          "Ese link de invitación venció — pedile a tu pareja que genere uno nuevo.",
    ALREADY_MEMBER:          "Ya formás parte de ese workspace.",
    HAS_OWN_DATA:            "Ya tenés datos propios cargados — no podemos unirte automáticamente a otro workspace. Contactanos para resolverlo a mano.",
  };

  if (error) {
    const codigo = (error.message || "").match(/[A-Z_]{5,}/)?.[0];
    msg.innerHTML = `<span style="color:var(--red)">${escapeHtml(MENSAJES[codigo] || "No se pudo procesar la invitación.")}</span>`;
    return;
  }

  sessionStorage.removeItem("fp_invite_token");
  msg.innerHTML = '<span style="color:var(--green)">✅ ¡Listo! Recargando...</span>';
  setTimeout(() => window.location.reload(), 1200);
}
```

- [ ] **Paso 4: Build y commit**

```bash
./build.sh
git add src/js/01-config.js src/js/17-workspace.js src/index.template.html index.html
git commit -m "feat(workspace): flujo de aceptación de invitación — detección de URL, modal, RPC"
```

---

## Task 9: Cliente — Integrar workspace en `_setVariablesUsuario`/`_configurarUsuario`/`iniciarApp`

**Files:**
- Modify: `src/js/03-data.js:21-36` (`_setVariablesUsuario`)
- Modify: `src/js/03-data.js:38-66` (`_configurarUsuario`)
- Modify: `src/js/03-data.js:100-123` (`guardarNombre`)
- Modify: `src/js/03-data.js:137-183` (`iniciarApp`)

**Interfaces:**
- Consumes: `cargarWorkspaceMembers()`, `resolverPartnerNombre()`, `aceptarInvitacionPendiente()` (Tareas 7, 8)

- [ ] **Paso 1: Cambiar cómo se calcula `PARTNER` en `_setVariablesUsuario`**

En `src/js/03-data.js`, reemplazar:

```javascript
function _setVariablesUsuario(nombre) {
  USUARIO = nombre;
  PARTNER = USUARIO.toLowerCase() === "daniel" ? "Ama" : "Daniel";
  CATS_INGRESO_REAL = USUARIO.toLowerCase() === "ama"
    ? ["Sueldo", "Otros Ingresos", "Intereses"]
    : ["Sueldo", "Otros Ingresos"];
  categResponsabilidad = ["Mío", "Compartido", "De " + PARTNER];
```

por:

```javascript
function _setVariablesUsuario(nombre) {
  USUARIO = nombre;
  PARTNER = resolverPartnerNombre(); // null si todavía no hay nadie más en mi workspace
  CATS_INGRESO_REAL = USUARIO.toLowerCase() === "ama"
    ? ["Sueldo", "Otros Ingresos", "Intereses"]
    : ["Sueldo", "Otros Ingresos"];
  categResponsabilidad = PARTNER ? ["Mío", "Compartido", "De " + PARTNER] : ["Mío"];
```

El resto de la función (tema por defecto, iconos sol/luna) queda sin cambios — es personalización regional/individual, fuera de alcance de este plan.

- [ ] **Paso 2: Cargar `workspaceMembers` antes de resolver variables en `_configurarUsuario`**

Reemplazar el inicio de `_configurarUsuario`:

```javascript
function _configurarUsuario(session) {
  const metaNombre   = session.user.user_metadata?.nombre;
  const metaEmojis   = session.user.user_metadata?.cat_emojis;
  const isGoogleOnly = session.user.app_metadata?.provider === 'google'
                    && !session.user.app_metadata?.providers?.includes('email');
  if (isGoogleOnly && !metaNombre) {
    supabaseClient.auth.signOut();
    const res = document.getElementById('google-login-result') || document.getElementById('test-result');
    if (res) res.innerHTML = '<span class="fail">❌ Esta cuenta de Google no está vinculada a ningún usuario. Iniciá sesión con email y vinculá tu cuenta desde Categorías → Cuenta y Seguridad.</span>';
    return;
  }
  _setVariablesUsuario(metaNombre || "");
```

por:

```javascript
async function _configurarUsuario(session) {
  const metaNombre   = session.user.user_metadata?.nombre;
  const metaEmojis   = session.user.user_metadata?.cat_emojis;
  const isGoogleOnly = session.user.app_metadata?.provider === 'google'
                    && !session.user.app_metadata?.providers?.includes('email');
  if (isGoogleOnly && !metaNombre) {
    supabaseClient.auth.signOut();
    const res = document.getElementById('google-login-result') || document.getElementById('test-result');
    if (res) res.innerHTML = '<span class="fail">❌ Esta cuenta de Google no está vinculada a ningún usuario. Iniciá sesión con email y vinculá tu cuenta desde Categorías → Cuenta y Seguridad.</span>';
    return;
  }
  await cargarWorkspaceMembers();
  _setVariablesUsuario(metaNombre || "");
```

`_configurarUsuario` pasa a ser `async`. Hay 3 call sites existentes que hoy la llaman sin `await` — actualizar cada uno así:

1. `src/js/01-config.js:27` — ya está dentro de un handler `async` (`DOMContentLoaded`). Cambiar:
   ```javascript
   if (session) { supabaseSession = session; _configurarUsuario(session); iniciarApp(); return; }
   ```
   por:
   ```javascript
   if (session) { supabaseSession = session; await _configurarUsuario(session); iniciarApp(); return; }
   ```

2. `src/js/02-auth.js:52` — ya está dentro de `async function guardarConfig()`. Cambiar:
   ```javascript
   _configurarUsuario(data.session);
   ```
   por:
   ```javascript
   await _configurarUsuario(data.session);
   ```

3. `src/js/02-auth.js:191` — está dentro de un callback de `setTimeout` que **no** es `async`. Cambiar:
   ```javascript
   setTimeout(() => { _configurarUsuario(supabaseSession); iniciarApp(); }, 1500);
   ```
   por:
   ```javascript
   setTimeout(async () => { await _configurarUsuario(supabaseSession); iniciarApp(); }, 1500);
   ```

- [ ] **Paso 3: Sincronizar `workspace_members.nombre` en `guardarNombre()`**

Reemplazar en `guardarNombre()`:

```javascript
  const { error } = await supabaseClient.auth.updateUser({ data: { nombre } });

  if (error) {
    msg.innerHTML = `<span style="color:var(--red)">Error: ${escapeHtml(error.message)}</span>`;
    return;
  }

  _setVariablesUsuario(nombre);
```

por:

```javascript
  const { error } = await supabaseClient.auth.updateUser({ data: { nombre } });

  if (error) {
    msg.innerHTML = `<span style="color:var(--red)">Error: ${escapeHtml(error.message)}</span>`;
    return;
  }

  await supabaseClient.from('workspace_members').update({ nombre }).eq('user_id', supabaseSession.user.id);
  await cargarWorkspaceMembers();
  _setVariablesUsuario(nombre);
```

- [ ] **Paso 4: Disparar el modal de invitación pendiente al final de `iniciarApp()`**

Al final de `iniciarApp()`, después del bloque `if (cachedTransac && cachedCateg) { ... } else { ... }` (ambas ramas ya llaman a `_renderApp()`), agregar una sola línea al final de la función:

```javascript
  aceptarInvitacionPendiente();
}
```

(Se agrega justo antes de la llave de cierre `}` de `iniciarApp`, se ejecuta en ambas ramas porque está después del `if/else`, no dentro de él.)

- [ ] **Paso 5: Build, verificación manual, y commit**

```bash
./build.sh
```

Abrir `index.html` localmente (o el preview de Vercel de la rama), loguearse como Daniel, confirmar en la consola del navegador que no hay errores de JS y que `PARTNER` resuelve a `"Ama"` (`console.log(PARTNER)` desde la consola).

```bash
git add src/js/03-data.js index.html
git commit -m "feat(workspace): resolver PARTNER dinámicamente desde workspace_members"
```

---

## Task 10: Cliente — Registro por email para invitados sin cuenta (gap descubierto)

**Files:**
- Modify: `src/js/02-auth.js`
- Modify: `src/index.template.html`

**Interfaces:**
- Produces: `guardarRegistro()` (async, sin retorno)

- [ ] **Paso 1: Agregar la card de registro al HTML**

En `src/index.template.html`, agregar después del cierre de `<div class="setup-card" id="card-login">` (antes de `<!-- ── Pantalla: recuperar contraseña ─── -->`):

```html
  <!-- ── Pantalla: crear cuenta (para invitados sin Google) ──── -->
  <div class="setup-card" id="card-registro" style="display:none;">
    <h1>💰 Crear cuenta</h1>
    <p>Vas a unirte a un workspace compartido. Elegí tu email y contraseña.</p>

    <label for="reg-email">Email</label>
    <input type="email" id="reg-email" placeholder="vos@email.com" autocomplete="email"
           onkeydown="if(event.key==='Enter') guardarRegistro()">

    <label for="reg-password">Contraseña</label>
    <input type="password" id="reg-password" placeholder="Mínimo 6 caracteres" autocomplete="new-password"
           onkeydown="if(event.key==='Enter') guardarRegistro()">

    <div style="display:flex; gap:.75rem; align-items:center;">
      <button class="btn btn-primary" id="btn-registro" onclick="guardarRegistro()">Crear cuenta →</button>
      <button class="btn" style="background:none;color:var(--text-muted);font-size:.83rem;padding:.3rem .5rem"
              onclick="mostrarLogin()">← Ya tengo cuenta</button>
    </div>
    <div id="registro-result"></div>
  </div>
```

Y en `card-login`, agregar un link para llegar a `card-registro` cuando hay una invitación pendiente — debajo del botón "¿Olvidaste tu contraseña?":

```html
    <div id="login-crear-cuenta-link" style="display:none;margin-top:.5rem;font-size:.83rem;color:var(--text-muted)">
      ¿Te invitaron a un workspace? <a href="#" onclick="mostrarRegistro();return false">Creá tu cuenta acá</a>
    </div>
```

- [ ] **Paso 2: Mostrar el link de "crear cuenta" solo cuando hay una invitación pendiente sin sesión**

En `src/js/01-config.js`, dentro del bloque agregado en la Tarea 8 Paso 1, extender:

```javascript
  const _inviteParam = new URLSearchParams(window.location.search).get("invite");
  if (_inviteParam) {
    sessionStorage.setItem("fp_invite_token", _inviteParam);
    window.history.replaceState({}, "", window.location.pathname);
  }
  if (sessionStorage.getItem("fp_invite_token")) {
    const _link = document.getElementById("login-crear-cuenta-link");
    if (_link) _link.style.display = "block";
  }
```

- [ ] **Paso 3: Agregar `mostrarRegistro()` y `guardarRegistro()` a `02-auth.js`**

```javascript
function mostrarRegistro() {
  document.getElementById("card-login").style.display    = "none";
  document.getElementById("card-reset").style.display    = "none";
  document.getElementById("card-registro").style.display = "";
  document.getElementById("registro-result").innerHTML   = "";
}

async function guardarRegistro() {
  const email    = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const res      = document.getElementById("registro-result");
  const btn      = document.getElementById("btn-registro");

  if (!email || password.length < 6) {
    res.innerHTML = '<span class="fail">❌ Completá un email válido y una contraseña de al menos 6 caracteres.</span>';
    return;
  }

  btn.disabled = true;
  btn.textContent = "⏳ Creando...";
  res.innerHTML = "";

  try {
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) throw error;
    if (!data.session) {
      res.innerHTML = '<span class="ok">✅ Revisá tu email para confirmar la cuenta, después volvé a este link de invitación.</span>';
      btn.textContent = "Enviado";
      return;
    }
    supabaseSession = data.session;
    await _configurarUsuario(data.session);
    iniciarApp();
  } catch(e) {
    res.innerHTML = `<span class="fail">❌ ${escapeHtml(e.message) || "Error al crear la cuenta"}</span>`;
    btn.disabled = false;
    btn.textContent = "Crear cuenta →";
  }
}
```

Nota: si el proyecto Supabase tiene confirmación de email habilitada, `data.session` viene `null` hasta que el usuario confirma — se le pide revisar el email y volver a abrir el mismo link de invitación (el token sigue en `sessionStorage`... salvo que haya cerrado el navegador; documentar esto como limitación conocida menor, no bloqueante para el piloto de pocas parejas).

- [ ] **Paso 4: Build, verificación manual, y commit**

Probar: abrir el link de invitación en una ventana de incógnito (sin sesión), confirmar que aparece el link "¿Te invitaron...?", crear una cuenta nueva, confirmar que dispara el modal de aceptación de invitación de la Tarea 8.

```bash
./build.sh
git add src/js/02-auth.js src/js/01-config.js src/index.template.html index.html
git commit -m "feat(workspace): registro por email para invitados sin cuenta de Google"
```

---

## Task 11: Cliente — UI "Invitar a mi pareja" en Categorías

**Files:**
- Modify: `src/index.template.html:3476-3483` (card "Cuenta y Seguridad" en `page-config`)
- Modify: `src/js/17-workspace.js`

**Interfaces:**
- Consumes: `generarInvitacion()`, `revocarInvitacion()`, `listarInvitacionesPendientes()`, `resolverPartnerNombre()` (Tarea 7)

- [ ] **Paso 1: Agregar la card al HTML**

En `src/index.template.html`, después del cierre de la card "Cuenta y Seguridad" (línea ~3482, antes de `</div><!-- /page-config -->`):

```html
        <!-- Mi pareja / Workspace -->
        <div class="chart-card" style="margin-top:1.5rem">
          <div class="chart-title">Mi pareja</div>
          <div id="workspace-panel">
            <div style="color:var(--text-muted);font-size:.85rem">Cargando…</div>
          </div>
        </div>
```

- [ ] **Paso 2: Agregar la función de render a `17-workspace.js`**

```javascript

async function renderizarPanelWorkspace() {
  const cont = document.getElementById('workspace-panel');
  if (!cont) return;

  const partnerNombre = resolverPartnerNombre();
  if (partnerNombre) {
    cont.innerHTML = `
      <div style="display:flex;align-items:center;gap:.6rem;color:var(--text)">
        <span style="font-size:1.3rem">🤝</span>
        <span>Compartís este workspace con <strong>${escapeHtml(partnerNombre)}</strong>.</span>
      </div>`;
    return;
  }

  const pendientes = await listarInvitacionesPendientes();
  if (pendientes.length) {
    const inv = pendientes[0];
    const url = `${window.location.origin}${window.location.pathname}?invite=${inv.token}`;
    cont.innerHTML = `
      <p style="color:var(--text-muted);font-size:.85rem;margin:0 0 .6rem">
        Todavía no invitaste a tu pareja. Tenés una invitación pendiente — compartile este link:
      </p>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">
        <input type="text" readonly value="${escapeHtml(url)}" id="workspace-invite-url"
               style="flex:1;min-width:200px;padding:.5rem .7rem;border-radius:8px;
                      border:1px solid var(--border);background:var(--bg2);color:var(--text);font-size:.8rem">
        <button class="btn btn-primary" onclick="_copiarInviteUrl()">Copiar</button>
        <button class="btn" style="background:none;color:var(--red)" onclick="_revocarYRerender('${inv.id}')">Revocar</button>
      </div>`;
    return;
  }

  cont.innerHTML = `
    <p style="color:var(--text-muted);font-size:.85rem;margin:0 0 .6rem">
      Todavía no invitaste a tu pareja a este workspace.
    </p>
    <button class="btn btn-primary" onclick="_generarYRerender()">Invitar a mi pareja</button>`;
}

async function _generarYRerender() {
  const url = await generarInvitacion();
  if (url) showToast("✅ Link de invitación generado", "ok");
  await renderizarPanelWorkspace();
}

async function _revocarYRerender(inviteId) {
  await revocarInvitacion(inviteId);
  await renderizarPanelWorkspace();
}

function _copiarInviteUrl() {
  const input = document.getElementById('workspace-invite-url');
  if (!input) return;
  input.select();
  navigator.clipboard?.writeText(input.value);
  showToast("✅ Link copiado", "ok");
}
```

- [ ] **Paso 3: Disparar el render al entrar a Categorías**

Buscar la función `navegarA(pagina)` en el módulo correspondiente (contiene el `switch`/`if` que llama a `renderizarSeccionCuenta()` cuando `pagina === "config"`) y agregar la llamada junto a esa:

```javascript
if (pagina === "config") {
  renderizarSeccionCuenta();
  renderizarPanelWorkspace();
}
```

(Ubicar el bloque exacto con `grep -n "renderizarSeccionCuenta()" src/js/*.js` antes de editar — depende de en qué archivo esté `navegarA`.)

- [ ] **Paso 4: Verificación manual y commit**

Probar en el preview: entrar a Categorías logueado como Daniel, ver el estado "Compartís este workspace con Ama" (dado que ya están migrados desde la Tarea 2). Con un usuario de prueba sin pareja, confirmar que aparece el botón "Invitar a mi pareja", que genera un link copiable, y que "Revocar" lo invalida.

```bash
./build.sh
git add src/js/17-workspace.js src/index.template.html index.html
git commit -m "feat(workspace): UI 'Mi pareja' en Categorías — invitar, copiar link, revocar"
```

---

## Task 12: Cliente — Empty state de Compartidos cuando `PARTNER` es `null`

**Files:**
- Modify: `src/js/06-compartidos.js`

**Interfaces:**
- Consumes: `PARTNER` (ahora puede ser `null`, ver Tarea 9)

- [ ] **Paso 1: Early return al principio de `cargarCompartidos()`**

En `src/js/06-compartidos.js`, al principio de `function cargarCompartidos() {`, antes de cualquier cálculo:

```javascript
function cargarCompartidos() {
  if (!PARTNER) {
    const cont = document.getElementById("page-compartidos");
    if (cont) {
      const existente = document.getElementById("comp-empty-state");
      if (!existente) {
        const div = document.createElement("div");
        div.id = "comp-empty-state";
        div.className = "chart-card";
        div.style.textAlign = "center";
        div.style.padding = "2.5rem 1.5rem";
        div.innerHTML = `
          <div style="font-size:2.2rem;margin-bottom:.5rem">🤝</div>
          <h3 style="margin:0 0 .4rem">Todavía no invitaste a tu pareja</h3>
          <p style="color:var(--text-muted);font-size:.9rem;margin:0 0 1rem">
            Compartidos se activa cuando hay dos personas en el mismo workspace.
          </p>
          <button class="btn btn-primary" onclick="navegarA('config')">Invitar a mi pareja</button>`;
        cont.prepend(div);
      }
    }
    // Ocultar el resto del contenido de Compartidos mientras no haya pareja
    Array.from(document.getElementById("page-compartidos")?.children || [])
      .forEach(el => { if (el.id !== "comp-empty-state") el.style.display = "none"; });
    return;
  }
  const existente = document.getElementById("comp-empty-state");
  if (existente) existente.remove();
  Array.from(document.getElementById("page-compartidos")?.children || [])
    .forEach(el => { if (el.id !== "comp-empty-state") el.style.display = ""; });

  // ... resto de la función existente sin cambios, continúa con
  // const mes = parseInt(document.getElementById("comp-mes").value); etc.
```

- [ ] **Paso 2: Verificación manual**

Con un usuario de prueba sin pareja invitada, navegar a Compartidos y confirmar que se ve el estado vacío en vez de un error de JS (antes de este cambio, `PARTNER` siendo `null` hacía que expresiones como `"De " + PARTNER` dieran `"De null"` y comparaciones `t.usuario === PARTNER` nunca calzaran — no rompía, pero mostraba números sin sentido; ahora se bloquea explícitamente con un mensaje claro). Con Daniel/Ama (que sí tienen `PARTNER` resuelto), confirmar que Compartidos se ve exactamente igual que antes de este plan.

- [ ] **Paso 3: Build y commit**

```bash
./build.sh
git add src/js/06-compartidos.js index.html
git commit -m "fix(compartidos): empty state cuando todavía no hay pareja en el workspace"
```

---

## Task 13: Verificación end-to-end y checklist de regresión

**Files:**
- Ninguno (verificación manual)

- [ ] **Paso 1: Regresión — Daniel y Ama ven exactamente lo mismo que antes**

Sobre el preview de Vercel de la rama (después de aplicar las Tareas 1-6 en el proyecto Supabase real, siguiendo la ventana de mantenimiento acordada), loguearse como Daniel y como Ama por separado y comparar contra capturas/valores de antes de la migración en: Mi mes (KPIs), Compartidos (balance y tabla por categoría), Transacciones, Inversiones (Plazos fijos, Acciones), Recurrentes, Metas de ahorro, Proporción de compartidos. Deben coincidir exactamente — cero regresión, como exige la Sección 5 del spec.

- [ ] **Paso 2: Aislamiento — un tercer usuario no ve nada de Daniel/Ama**

Crear un usuario de prueba nuevo (sin invitación), confirmar que no ve ninguna transacción/categoría/etc. de Daniel o Ama, y viceversa (Daniel/Ama no ven nada del usuario de prueba). Confirmar además, con una llamada directa a la API REST de Supabase usando el token del usuario de prueba (`curl` con el header `Authorization: Bearer <token-prueba>` contra `.../rest/v1/transacciones?workspace_id=eq.<workspace-daniel-ama>`), que la respuesta es una lista vacía (bloqueado por RLS), no un error 500 ni datos filtrados.

- [ ] **Paso 3: Invitación — flujo completo con y sin Google**

Con dos usuarios de prueba nuevos (sin datos): (a) invitador genera link desde Categorías → Mi pareja; (b) invitado abre el link en una ventana de incógnito, crea cuenta por email (Tarea 10), acepta la invitación (Tarea 8); confirmar que ambos ven las mismas transacciones de prueba que cargue cualquiera de los dos, y que `PARTNER` se resuelve con el nombre real en ambas sesiones. Repetir el mismo flujo con un invitado que usa Google OAuth en vez de email.

- [ ] **Paso 4: Casos borde de invitación**

Confirmar, uno por uno: invitación vencida rechazada con mensaje claro; invitación revocada rechazada; invitación ya aceptada rechazada; invitado con datos propios bloqueado con el mensaje de `HAS_OWN_DATA`; generar una segunda invitación revoca automáticamente la primera.

- [ ] **Paso 5: Checkpoint de seguridad final**

Volver a correr el Security Advisor de Supabase (mismo paso que la Tarea 6, Paso 4) una vez desplegadas todas las tareas, para confirmar que ningún cambio posterior introdujo un warning nuevo.

- [ ] **Paso 6: Commit final**

```bash
git commit --allow-empty -m "chore(workspace): verificación end-to-end de multi-tenancy completada"
```

---

## Fuera de alcance de este plan (recordatorio, ver spec)

- Generalizar responsabilidad/liquidación a más de 2 personas por workspace.
- Selector de múltiples workspaces por usuario.
- Código corto de invitación como alternativa al link.
- Merge de datos al aceptar una invitación con datos propios.
- Aislamiento vía JWT custom claims.
- Reemplazo completo de `usuario` (texto) por `user_id` en la lógica de negocio existente.
- Generalización regional (moneda base, tema por workspace, fuentes de importación configurables).
- Permisos diferenciados por `role` ('owner' vs 'member').
