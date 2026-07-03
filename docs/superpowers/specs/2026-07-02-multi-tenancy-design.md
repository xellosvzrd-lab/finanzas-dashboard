# Spec: Multi-tenancy — workspace de pareja

**Fecha:** 2026-07-02
**Estado:** Aprobado — pendiente de implementación
**Track de STRATEGY.md:** "Multi-tenancy y aislamiento de datos"

---

## Resumen

Hoy toda la app gira en torno a un único par de usuarios (Daniel y Ama) sobre una sola instancia Supabase compartida. La visibilidad cruzada entre ambos (necesaria para Compartidos, liquidación, etc.) está resuelta con un hack en la policy RLS de `transacciones`: un `OR` que hardcodea los 2 UUIDs reales de Daniel y Ama. Ninguna otra tabla (`categorias`, `presupuesto`, `compras_cuotas`, `metas_ahorro`, `plazos_fijos`, `acciones`, `recurrentes`) tiene un mecanismo equivalente de visibilidad cruzada consistente, y `proporcion_compartidos` resuelve el problema al revés (sin `user_id`, visible para cualquier autenticado de la instancia).

Esta feature introduce el concepto de **workspace** como unidad central de aislamiento de datos: cada pareja es un workspace independiente, con sus propios miembros, y las políticas RLS pasan de "hardcodeado a 2 personas específicas" a "cualquier miembro del mismo workspace". Es la base técnica mínima para que el producto pueda tener más de una pareja usándolo sobre la misma infraestructura compartida (Supabase + Vercel), sin que ninguna pareja vea datos de otra.

Es un cambio de infraestructura de datos, no de UX visible: para Daniel y Ama, el comportamiento observable de la app debe ser exactamente igual antes y después de esta migración.

---

## Decisiones de diseño

| Decisión | Elección |
|---|---|
| Cardinalidad de miembros por workspace (modelo de datos) | Abierto a N desde el día uno (`workspace_members` sin restricción de cantidad) |
| Cardinalidad de la lógica de negocio de responsabilidad/liquidación | Binaria (2 personas) para este MVP — limitación conocida, documentada, no bloqueante |
| Workspaces por usuario | Exactamente 1 workspace activo por usuario a la vez (`unique(user_id)` en `workspace_members`) |
| Creación del workspace | Implícita al registrarse — todo usuario nuevo obtiene automáticamente su propio workspace individual |
| Mecanismo de invitación | Link único con token, sin código corto alternativo |
| Expiración de invitación | 7 días, revocable manualmente antes de vencer |
| Invitado con datos propios existentes | Bloqueado (a nivel de base de datos, no solo aviso visual) — no se soporta merge de datos en este MVP |
| Mecanismo de aislamiento RLS | Subquery vía función `security definer` (`my_workspace_id()`), no JWT custom claims |
| Alcance del refactor de identidad en el cliente | Mínimo — se mantiene el campo `usuario` (texto) y los ~24 filtros existentes tal cual; solo cambia cómo se resuelven `USUARIO`/`PARTNER` |
| Estrategia de migración | Big-bang: todas las tablas reciben `workspace_id` en una sola ventana de mantenimiento, con backfill inmediato para Daniel/Ama |
| Tolerancia a downtime | Aceptable una ventana corta (minutos) |
| Generalización regional (tema por nombre, categorías especiales de Ama, MEP) | Explícitamente fuera de alcance — pertenece al track separado "Generalización regional" de STRATEGY.md |

---

## 1. Modelo de datos

### Tablas nuevas

```sql
create table workspaces (
  id         uuid primary key default gen_random_uuid(),
  nombre     text,                    -- opcional, informativo (ej. "Daniel & Ama")
  created_at timestamptz not null default now()
);

create table workspace_members (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  nombre       text not null default '',        -- ver nota de diseño abajo
  role         text not null default 'member',  -- 'owner' | 'member' — reservado a futuro, sin uso funcional en el MVP
  joined_at    timestamptz not null default now(),
  unique (user_id)   -- fuerza "1 workspace activo por usuario" a nivel de base de datos
);

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

create index idx_workspace_members_workspace on workspace_members(workspace_id);
create index idx_workspace_invites_workspace on workspace_invites(workspace_id);
create index idx_workspace_invites_token     on workspace_invites(token);
```

**Nota de diseño — por qué `nombre` está duplicado en `workspace_members`:** el cliente opera con la `anon key` y RLS; Supabase Auth no permite que un usuario lea el `user_metadata` de otro usuario desde el cliente (eso requiere `service role`, que no vive en el frontend). Como el producto necesita que cada miembro pueda mostrar el nombre real de su pareja (ej. "Compartidos con Marina"), ese nombre debe estar denormalizado en una tabla que ambos puedan leer vía RLS. `workspace_members.nombre` cumple ese rol y se mantiene sincronizado desde `guardarNombre()` (ver Sección 4). Esto es deuda de denormalización intencional, análoga a la que ya existe hoy entre `user_id` (uuid, para RLS) y `usuario` (texto, para filtrado y display) en `transacciones`.

### Columna nueva en las tablas de contenido

Se agrega `workspace_id` a las 9 tablas: `transacciones`, `categorias`, `presupuesto`, `compras_cuotas`, `metas_ahorro`, `plazos_fijos`, `acciones`, `recurrentes`, `proporcion_compartidos`.

```sql
alter table <tabla> add column workspace_id uuid references workspaces(id);
-- tras el backfill (Sección 5): alter table <tabla> alter column workspace_id set not null;
create index idx_<tabla>_workspace_id on <tabla>(workspace_id);
```

`proporcion_compartidos` no tiene `user_id` (es intencionalmente compartida entre los miembros); con `workspace_id` deja de necesitar su policy especial de "cualquier autenticado" — pasa a usar el mismo mecanismo que el resto de las tablas.

### Función helper para RLS

```sql
create function my_workspace_id() returns uuid
language sql security definer stable
as $$ select workspace_id from workspace_members where user_id = auth.uid() limit 1 $$;
```

`security definer` evita que las policies de `workspace_members` necesiten referenciarse a sí mismas de forma directa (lo que puede causar problemas de recursión en RLS), y centraliza en un solo lugar la lógica "cuál es mi workspace", reutilizada por las políticas de las 9 tablas de contenido más `workspace_members` y `workspace_invites`.

---

## 2. Políticas RLS

**Patrón para cada una de las 9 tablas de contenido** (reemplaza el hack de 2 UUIDs en `transacciones`, las policies simples `auth.uid() = user_id` del resto, y la policy de "cualquier autenticado" de `proporcion_compartidos`):

```sql
create policy "<tabla>_select" on <tabla>
  for select using (workspace_id = my_workspace_id());

create policy "<tabla>_insert" on <tabla>
  for insert with check (workspace_id = my_workspace_id() and user_id = auth.uid());

create policy "<tabla>_update" on <tabla>
  for update using (user_id = auth.uid() and workspace_id = my_workspace_id());

create policy "<tabla>_delete" on <tabla>
  for delete using (user_id = auth.uid() and workspace_id = my_workspace_id());
```

Para `proporcion_compartidos` (sin `user_id`), INSERT/UPDATE validan únicamente `workspace_id = my_workspace_id()` — cualquier miembro del workspace puede escribir, igual que hoy.

**Comportamiento preservado a propósito:** SELECT pasa de "solo mis filas" (o el hack de 2 UUIDs) a "todas las filas de mi workspace" — esto es lo que da visibilidad cruzada real y consistente en las 9 tablas por igual. UPDATE/DELETE se mantienen restringidos al dueño de la fila (`user_id = auth.uid()`), igual que hoy: un miembro puede ver las transacciones de su pareja pero no editarlas ni borrarlas directamente. No se introduce ningún cambio de comportamiento ahí.

**`workspace_members`:** SELECT permitido para cualquier miembro del mismo workspace (vía `my_workspace_id()`). INSERT/UPDATE de esta tabla **no se exponen al cliente** — solo ocurren a través de dos funciones `security definer`: el trigger de alta de usuario nuevo, y `accept_workspace_invite()` (Sección 3). Esto evita que un usuario pueda auto-asignarse a un workspace ajeno manipulando una request directa.

**`workspace_invites`:** SELECT/INSERT restringidos a miembros del workspace dueño de la invitación (`workspace_id = my_workspace_id()`). La aceptación de una invitación por parte de alguien de **otro** workspace no pasa por INSERT/UPDATE directo sobre esta tabla — pasa por `accept_workspace_invite(token)`, que al ser `security definer` puede operar sin estar limitada por esa policy.

### Corrección post-implementación: `categorias` y `presupuesto` NO son workspace-wide en SELECT

Al desplegar esto en producción se detectó una regresión real: `categorias` (`unique(tipo, valor, user_id)`) y `presupuesto` (`unique(mes, anio, categoria, user_id)`) estaban diseñadas desde antes de esta feature para que **cada persona mantenga su propia lista/configuración privada**, no para visibilidad compartida — a diferencia de `transacciones`, donde la visibilidad cruzada para "Compartido" es la funcionalidad central. Aplicarles el mismo patrón de SELECT que al resto (`workspace_id = my_workspace_id()`) hizo que Daniel y Ama vieran la unión de sus dos listas de categorías (duplicados) y de sus dos configuraciones de presupuesto por categoría/mes.

**Política correcta para estas 2 tablas específicamente** (el resto del patrón — INSERT/UPDATE/DELETE — no cambia):

```sql
create policy "categorias_select" on categorias
  for select using (workspace_id = my_workspace_id() and user_id = auth.uid());

create policy "presupuesto_select" on presupuesto
  for select using (workspace_id = my_workspace_id() and user_id = auth.uid());
```

Esto mantiene el aislamiento por workspace (tenant) y **además** restaura el aislamiento por usuario dentro del propio workspace, igual que el comportamiento previo a esta migración. Las 7 tablas restantes (`transacciones`, `compras_cuotas`, `metas_ahorro`, `plazos_fijos`, `acciones`, `recurrentes`, `proporcion_compartidos`) sí son correctamente workspace-wide en SELECT — se verificó manualmente contra producción que no presentan el mismo problema.

**Lección para futuras tablas de contenido:** antes de aplicar el patrón "SELECT workspace-wide" a una tabla nueva, confirmar si esa tabla fue diseñada con semántica per-usuario (buscar `unique(..., user_id)` o constraints equivalentes) — no asumir que todo el contenido de un workspace debe ser visible para todos sus miembros por igual.

---

## 3. Flujo de invitación

### Generar invitación

Pantalla nueva "Invitar a mi pareja" (ubicación de UI a definir en el plan de implementación — candidato natural: Categorías, junto a "Cuenta y Seguridad"). Botón "Generar link de invitación":

- Inserta una fila en `workspace_invites` para mi workspace.
- Si ya existe una invitación pendiente (no vencida, no revocada, no aceptada) para mi workspace, se **revoca automáticamente** antes de crear la nueva — evita que circulen links duplicados válidos simultáneamente.
- Muestra `https://<app>/?invite=<token>` con botón de copiar.
- Botón "Revocar" visible mientras la invitación esté pendiente.

### Aceptar invitación

La app (single-file, sin router) detecta `?invite=<token>` en la URL al cargar:

1. Si no hay sesión activa, se muestra el login/registro normal; el token se guarda en `sessionStorage` hasta completar el login/registro.
2. Una vez logueado, se muestra un modal de confirmación: *"Vas a unirte al workspace de \<nombre de quien invita>. Esto es definitivo en esta versión — no se puede combinar con datos propios ya cargados."*
3. Botón "Unirme" llama a la función `accept_workspace_invite(token)`, que:
   a. Valida que el token exista, no esté vencido, no esté revocado y no esté ya aceptado.
   b. Verifica que el workspace actual de quien acepta **no tenga ninguna fila** en ninguna de las 9 tablas de contenido — el bloqueo de "no merge de datos" (ver Decisiones de diseño) se aplica a nivel de base de datos, no solo como aviso en el cliente.
   c. Si tiene datos → aborta devolviendo un error explícito; el cliente lo traduce a *"Ya tenés datos propios cargados — no podemos unirte automáticamente a otro workspace. Contactanos para resolverlo a mano."*
   d. Si no tiene datos → actualiza su fila en `workspace_members` para apuntar al `workspace_id` de quien invitó, borra (cascade) su workspace individual anterior (que quedó vacío), y marca la invitación como aceptada (`accepted_at`, `accepted_by`).

---

## 4. Cambios en el cliente

### Nuevo módulo `src/js/17-workspace.js`

Sigue la convención de un archivo por feature (`13-recurrentes.js`, `14-metas-ahorro.js`, `15-captura-voz.js`, `16-proporcion.js`).

```javascript
let workspaceMembers = [];   // filas de workspace_members visibles para mi workspace (cacheadas en memoria)

async function cargarWorkspaceMembers() {
  // SELECT * FROM workspace_members (RLS ya limita a mi workspace)
  // cachea en workspaceMembers[]
}

function _resolverPartner() {
  // busca en workspaceMembers el primer miembro que no sea session.user.id
  // devuelve su .nombre, o null si todavía no hay nadie más (workspace solo, sin invitación aceptada)
}
```

Funciones para generar/revocar/aceptar invitaciones (`generarInvitacion()`, `revocarInvitacion()`, `aceptarInvitacion(token)`) también viven en este módulo.

### Cambios en módulos existentes

- **`USUARIO`** sigue derivándose exactamente igual que hoy, de `session.user.user_metadata.nombre` (sin cambios — es mi propio nombre, no depende del workspace).
- **`PARTNER`** cambia de raíz: en `_setVariablesUsuario()` (`03-data.js`), la línea `PARTNER = USUARIO.toLowerCase() === "daniel" ? "Ama" : "Daniel"` se reemplaza por el resultado de `_resolverPartner()`. **Estado nuevo que no existe hoy:** un workspace recién creado, solo, sin pareja invitada todavía, tiene `PARTNER = null`. Compartidos debe manejar ese estado con una pantalla vacía ("Todavía no invitaste a tu pareja → [Invitar]") en vez de intentar calcular balances contra un `PARTNER` inexistente. El detalle exacto de esa UI se define en el plan de implementación.
- **`guardarNombre()`** (`03-data.js`) se extiende para además actualizar `workspace_members.nombre` de mi propia fila (no solo `auth.updateUser({ data: { nombre } })`), para que mi pareja pueda leer mi nombre real.
- **`_configurarUsuario(session)`** (`03-data.js`) dispara `cargarWorkspaceMembers()` antes de calcular `PARTNER`, análogo a cómo ya dispara la carga de otras tablas chicas en `iniciarApp()`.

### Explícitamente fuera de alcance en el cliente

Las ramas de código que hoy usan el nombre literal para decidir comportamiento **regional/personal** (no de membresía) se dejan intactas y fuera de este track:

- Tema por defecto claro/oscuro según `USUARIO.toLowerCase() === "ama"`.
- `CATS_INGRESO_REAL` con "Intereses" agregado para Ama.
- Uso de `tipoCambioMEP` (dólar MEP, específico de Argentina).

Para cualquier pareja nueva que se registre, esas condiciones nunca serán ciertas (sus nombres no serán "Daniel" ni "Ama"), y el código cae de forma segura en el branch por defecto — no rompe nada, simplemente no aplica personalización regional todavía. Resolver esto pertenece al track "Generalización regional" de STRATEGY.md, no a este.

### Lo que NO cambia

Ninguna de las queries `select('*')` sobre las 9 tablas de contenido necesita tocarse — RLS filtra por workspace automáticamente en el servidor. Los ~24 filtros existentes `t.usuario === USUARIO` / `=== PARTNER` (en `04-graficos.js`, `05-transacciones.js`, `06-compartidos.js`, `07-presupuesto.js`, `10-utils.js`, `16-proporcion.js`) siguen funcionando exactamente igual — solo cambia de dónde salen los valores de `USUARIO`/`PARTNER`, no cómo se usan.

---

## 5. Plan de migración (big-bang)

1. **Ventana de mantenimiento** (minutos — aceptado explícitamente para esta migración).
2. **Migración SQL**, en este orden:
   - Crear `workspaces`, `workspace_members`, `workspace_invites` y la función `my_workspace_id()`.
   - Insertar 1 fila en `workspaces` para Daniel + Ama.
   - Insertar 2 filas en `workspace_members` (un `user_id` real por persona, con su `nombre` ya conocido) apuntando a ese workspace.
   - Agregar `workspace_id` (nullable) a las 9 tablas de contenido.
   - Backfill: `update <tabla> set workspace_id = '<el-único-workspace-id>'` — trivial, porque en este momento de la migración solo existe un workspace posible.
   - `alter column workspace_id set not null` + FK + índice, en cada una de las 9 tablas.
   - Reemplazar las policies viejas (hack de 2 UUIDs en `transacciones`; `auth.uid() = user_id` simple en `categorias`/`presupuesto`/etc.; "cualquier autenticado" en `proporcion_compartidos`) por las nuevas de la Sección 2.
   - Crear trigger `on auth.users insert` (`handle_new_user()`) que crea automáticamente workspace + membership para **cualquier registro futuro**. No afecta a Daniel/Ama, ya creados a mano en los pasos anteriores de este mismo script.
3. **Deploy del cliente nuevo** (con `17-workspace.js` y los ajustes de la Sección 4) en la misma ventana, para minimizar el tiempo en que el cliente viejo corre contra el schema nuevo.
4. **Verificación post-migración:** Daniel y Ama entran por separado y confirman que ven exactamente los mismos números que antes de la migración en Mi mes, Compartidos, Transacciones, Inversiones, Recurrentes, Metas de ahorro y Proporción de compartidos. Este es el criterio de aceptación de retrocompatibilidad total — cero cambios visibles para ellos.
5. **Rollback:** el cambio es aditivo (tablas nuevas + columna nueva + reemplazo de policies, sin borrar columnas ni datos existentes). Ante una falla, se puede restaurar desde un backup point-in-time de Supabase, o revertir manualmente las policies a las de `docs/supabase/schema.sql`. El riesgo práctico es bajo dado que hoy solo hay 2 usuarios reales con datos.

---

## 6. Manejo de errores y casos borde

- **Workspace individual sin pareja invitada todavía:** `PARTNER = null`. Compartidos, KPIs de liquidación y cualquier cálculo que dependa de `PARTNER` deben degradar a un estado vacío/informativo en vez de fallar (`PARTNER` nulo no debe propagarse a un `NaN` o a un `undefined` visible en la UI).
- **Invitación vencida (>7 días):** `accept_workspace_invite()` la rechaza; el cliente muestra "Este link de invitación venció — pedile a tu pareja que genere uno nuevo."
- **Invitación revocada o ya aceptada por otra persona:** mismo tratamiento — rechazo explícito con mensaje claro, sin estado ambiguo.
- **Invitado con datos propios existentes:** bloqueado a nivel de base de datos (Sección 3, paso 3.b/3.c) — no hay ruta de auto-merge en este MVP; se resuelve manualmente si aparece durante el piloto.
- **Escritura concurrente en `workspace_members`:** protegida por `unique(user_id)` — si dos operaciones intentaran mover al mismo usuario a dos workspaces distintos a la vez, la segunda falla por violación de constraint. Caso de probabilidad prácticamente nula (una persona solo acepta una invitación genuina a la vez).
- **Falla la carga de `workspace_members`** (red, Supabase caído): igual que el patrón ya usado para `proporcion_compartidos` — `cargarWorkspaceMembers()` captura el error, `workspaceMembers` queda como estaba (o vacío en la carga inicial), y `PARTNER` cae a `null` en el peor caso. La app no debe romperse; en el peor caso, Compartidos se ve temporalmente como "sin pareja" hasta que la carga se recupere.
- **Migración de Daniel/Ama en producción:** cubierta en la Sección 5 — riesgo mitigado por ser un cambio aditivo con posibilidad de rollback vía backup.

---

## 7. Testing y verificación

El proyecto no tiene suite de tests automatizados (sin npm, sin framework de testing — confirmado en CLAUDE.md). La verificación es manual, sobre el preview de Vercel de la rama de feature, y luego sobre producción durante la ventana de migración.

**Funcional — aislamiento:**

1. Con la migración aplicada, Daniel y Ama ven exactamente los mismos datos que antes (Mi mes, Compartidos, Transacciones, Inversiones, Recurrentes, Metas, Proporción) — regresión cero.
2. Un usuario nuevo (pareja piloto ficticia para pruebas) se registra, no ve ninguna fila de Daniel/Ama en ninguna tabla, y viceversa.
3. Intentar leer/escribir manualmente (vía API directa con el token de un usuario) una fila de un `workspace_id` ajeno debe fallar por RLS, para las 9 tablas.

**Funcional — invitación:**

4. Generar un link de invitación, abrirlo en otra sesión/navegador, registrarse, aceptar → el nuevo usuario queda en el mismo workspace, ve las transacciones de quien invitó, y `PARTNER` se resuelve correctamente en ambas sesiones.
5. Generar una segunda invitación sin que la primera haya sido aceptada → la primera queda revocada automáticamente.
6. Intentar aceptar una invitación vencida (forzar `expires_at` en el pasado) → rechazo con mensaje claro.
7. Intentar aceptar una invitación teniendo datos propios cargados → bloqueado con el mensaje de la Sección 3.
8. Revocar una invitación manualmente antes de que sea aceptada → el link deja de funcionar.

**Funcional — estado "workspace solo":**

9. Un usuario nuevo, sin invitar a nadie todavía, navega a Compartidos → ve el estado vacío ("Todavía no invitaste a tu pareja"), no un error ni un cálculo roto.

**Regresión:**

10. Todas las verificaciones funcionales de las specs previas (`recurrentes`, `metas-ahorro`, `cuotas`, `proporcion-compartidos`) deben seguir pasando igual para Daniel y Ama tras la migración.

---

## Fuera de alcance (explícitamente descartado en esta versión)

- Generalización de la lógica de responsabilidad/liquidación a más de 2 personas por workspace (el modelo de datos lo permite a futuro, la lógica de negocio no lo resuelve ahora).
- Selector de "workspace activo" en la UI (un usuario pertenece a un único workspace a la vez).
- Merge de datos al aceptar una invitación estando en un workspace con datos propios.
- Código corto de invitación como alternativa al link.
- Aislamiento vía JWT custom claims (Enfoque C evaluado y descartado por complejidad de infraestructura no justificada al volumen actual).
- Normalización completa de identidad reemplazando el campo `usuario` (texto) por comparaciones directas de `user_id` en toda la lógica de negocio (Enfoque B evaluado y descartado por alcance/riesgo; queda como deuda técnica documentada para una iteración futura).
- Generalización regional (moneda base configurable, tema por workspace, fuentes de importación opcionales) — track separado en STRATEGY.md.
- Permisos diferenciados por `role` ('owner' vs 'member') — la columna se reserva en el schema pero no tiene efecto funcional en este MVP.
