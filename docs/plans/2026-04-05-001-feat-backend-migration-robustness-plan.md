---
title: "feat: Backend migration and robustness upgrade"
type: feat
status: active
date: 2026-04-05
---

# Backend migration and robustness upgrade

## Overview

El backend actual (Google Apps Script + Google Sheets) tiene cuatro problemas concretos que limitan la confiabilidad y el crecimiento del proyecto: el workaround delete+add para editar transacciones puede destruir datos, los fallos de lectura son silenciosos, no hay timeout en ningún fetch, y el stack en general tiene un techo bajo para nuevas features. Este plan aborda todos esos problemas en dos fases: (1) mejoras inmediatas al GAS existente para eliminar los riesgos más graves hoy mismo, y (2) migración a Supabase como backend de largo plazo.

## Problem Frame

Los dashboards tienen ~5100 líneas de JS vanilla cada uno. El backend es un Web App de Google Apps Script con 4 GET + 6 POST endpoints. Los problemas actuales son:

- **Integridad de datos**: editar una transacción hace DELETE + ADD en dos llamadas separadas. Si la red cae entre las dos, la transacción queda borrada para siempre sin posibilidad de recovery automático
- **Fallos silenciosos**: `getTransacciones` y `getCategorias` fallan sin ningún feedback al usuario — la app renderiza vacía sin explicar por qué
- **Sin timeout**: un cold start de GAS (5–10s) bloquea la UI sin posibilidad de escape
- **Techo arquitectural**: sin queries reales, sin auth nativa, sin filtrado server-side — el dataset completo de ambos usuarios viaja al browser en cada carga

## Requirements Trace

- R1. El usuario puede editar transacciones sin riesgo de pérdida de datos
- R2. El usuario ve un error claro si el backend no responde (carga inicial o background refresh)
- R3. Cada fetch tiene timeout explícito; la UI responde aunque GAS esté lento
- R4. El backend soporta operaciones CRUD completas (create, read, **update**, delete) de forma atómica
- R5. La seguridad mejora respecto al modelo "URL secreta": cada usuario solo puede leer sus propios datos
- R6. La latencia del backend desde Argentina es ≤ 100ms en steady state (hoy es 200–300ms)
- R7. El frontend mantiene su stack actual (HTML + vanilla JS, sin npm ni build step)
- R8. El costo operativo sigue siendo $0

## Scope Boundaries

- **No incluye** rediseño de la UI, nuevas páginas, ni nuevas features funcionales
- **No incluye** unificar los dos dashboards en uno (siguen siendo repos separados)
- **No incluye** migrar a TypeScript ni agregar build pipeline
- **No incluye** migración de GAS para Ama — mismo plan se aplica a ambos repos de forma paralela
- La migración de datos (Sheets → Supabase) es parte del plan pero fuera del alcance de los units de código — se ejecuta manualmente por Daniel vía CSV export/import

## Context & Research

### Relevant Code and Patterns

- `index.html` — toda la lógica está inline en un único archivo por dashboard
- Las llamadas al backend están en funciones nombradas: `cargarTodasTransacciones()`, `cargarCategorias()`, `guardarTransaccion()`, `eliminarTransaccion()`, `guardarEdicionTransaccion()`, `savePresupuesto()`, `batchAddTransacciones()`, `addCategoria()`, `deleteCategoria()`
- El patrón de cache es stale-while-revalidate via `localStorage` — renderiza del cache y hace background-fetch
- `guardarEdicionTransaccion()` tiene comentario explícito "la fila fue borrada pero no re-creada" — acknowledges el riesgo
- El prefijo de localStorage es `fp_` en Daniel y `fp_ama_` en Ama — no hay colisiones

### Institutional Learnings

- El proyecto tiene workarounds documentados para case-sensitivity (`_normalizarCategorias`), decimal con coma (`parsearDecimal`), y el delete+add. Estos workarounds existen por limitaciones del backend — desaparecen naturalmente con Supabase
- Los dos repos son copias divergidas — cualquier cambio debe aplicarse en `finanzas-dashboard-live` y `finanzas-dashboard-ama-live`. El workflow es develop → PR → main con GitHub Actions validando

### External References

- [Supabase CDN para vanilla JS](https://github.com/supabase/supabase-js) — `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2">`
- [Row Level Security — Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [PostgREST API auto-generada](https://supabase.com/docs/guides/api) — CRUD sin escribir código de backend
- [GAS LockService](https://developers.google.com/apps-script/reference/lock/lock-service) — para writes concurrentes seguros en GAS Phase 0
- [Región São Paulo (sa-east-1)](https://supabase.com/docs/guides/platform/regions) — latencia óptima desde Argentina

## Key Technical Decisions

- **Decisión: migrar a Supabase, no mejorar GAS indefinidamente.** GAS puede tener `updateTransaccion` funcional hoy, pero el techo arquitectural es bajo: sin queries reales, sin auth, sin paginación. Supabase ofrece PostgreSQL real con PostgREST auto-generado, CDN JS client compatible con vanilla JS, y región São Paulo para latencia <100ms desde Argentina. Costo: $0 en free tier para este volumen (<5000 transacciones/año = ~5MB de datos). **Rationale:** migración de bajo riesgo porque el API surface es pequeño (4 GET + 6 POST, en funciones nombradas) — ~15 funciones a reescribir, sin tocar HTML/CSS ni lógica de render
- **Decisión: Phase 0 con mejoras a GAS existente antes de migrar.** Implementar `updateTransaccion`, fix de errores silenciosos, y timeout en GAS primero. Esto elimina el riesgo de pérdida de datos hoy y da tiempo para planificar la migración sin presión
- **Decisión: un proyecto Supabase por dashboard** (Daniel y Ama tienen proyectos separados). El free tier permite 2 proyectos activos. Esto mantiene el aislamiento de datos que ya existe y evita RLS compleja
- **Decisión: auth por email/password via Supabase Auth**, no API key expuesta. Los dos dashboards hacen `signInWithPassword()` en el primer uso. Session en `localStorage`. El anon key del frontend queda expuesto pero es inerte sin RLS
- **Decisión: usar PostgREST directo** (fetch a `/rest/v1/transacciones`) en lugar de supabase-js client cuando sea posible, para mantener dependencias mínimas. Usar supabase-js solo para auth (simplifica manejo de tokens)
- **Decisión: no paginar `getTransacciones` en esta fase.** Con <5000 transacciones el fetch completo es <100ms de processing. Agregar paginación haría la migración más compleja. Deferir a una fase futura si el dataset crece
- **Decisión: keep-alive via UptimeRobot** para prevenir pausa de proyectos Supabase free (pausa tras 7 días de inactividad). Ping a `/rest/v1/` cada 4 días — gratis, sin código

## Open Questions

### Resolved During Planning

- **¿GAS puede hacer update atómico?** Sí, via read-modify-write con `getValues()`/`setValues()` + `LockService`. Pero es un workaround costoso comparado con `PATCH` en Supabase
- **¿Supabase CDN es compatible con el constraint de no-npm?** Sí — `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2">` funciona igual que Chart.js
- **¿El anon key en el frontend es un problema de seguridad?** No, si RLS está habilitado desde el primer día. El key es público por diseño; las policies son la barrera real
- **¿Dos proyectos Supabase caben en el free tier?** Sí — el free tier permite exactamente 2 proyectos activos
- **¿Qué región usar?** São Paulo (`sa-east-1`) — disponible en free tier desde 2025, ~50ms desde Argentina vs 200–300ms de Iowa (GAS actual)
- **¿El pausing de Supabase free es un problema real?** Sí para uso esporádico. Mitigación: UptimeRobot gratis pinguea el endpoint cada 4 días

### Deferred to Implementation

- Schema exacto de PostgreSQL: tipos de columnas, constraints, índices — decisión en Unit 5 al ver los datos reales
- RLS policies exactas: la política base es `user_id = auth.uid()` pero el comportamiento de "Compartidos" (ambos usuarios necesitan ver transacciones con `responsabilidad = 'Compartido'`) requiere una policy adicional que se define durante implementación
- Nombres exactos de los Supabase endpoints — dependen del schema final
- Si `batchAddTransacciones` se implementa como una RPC (Postgres function) o como múltiples inserts en el cliente — decidir en Unit 7

## High-Level Technical Design

> *Esto ilustra el enfoque y es orientación de diseño para revisión, no especificación de implementación.*

```
Fase 0 (hoy): GAS mejorado
┌──────────────┐    fetch + AbortController(15s)    ┌─────────────────┐
│  Frontend    │ ──────────────────────────────────> │  GAS Web App    │
│  (vanilla)   │ <── JSON estructurado + error objs ─│  (mejorado)     │
└──────────────┘                                     │  + LockService  │
                                                     │  + updateTxn    │
                                                     └─────────────────┘

Fase 1 (migración): Supabase
┌──────────────┐    supabase-js (CDN) + fetch       ┌─────────────────┐
│  Frontend    │ ──────────────────────────────────> │  Supabase       │
│  (vanilla)   │ <── PostgREST JSON response ────── │  (São Paulo)    │
│  + auth      │                                     │  PostgreSQL     │
│  session     │                                     │  + RLS          │
└──────────────┘                                     │  + PostgREST    │
                                                     └─────────────────┘

Tablas Supabase (por proyecto, no compartidas):
  transacciones (id, fecha, tipo, categoria, monto, descripcion, 
                 usuario, responsabilidad, fuente, moneda, user_id)
  categorias (id, tipo, valor, usuario, user_id)
  presupuesto (id, mes, anio, categoria, porcentaje, usuario, user_id)
```

## Implementation Units

### Fase 0: Mejoras inmediatas al GAS

- [ ] **Unit 1: `updateTransaccion` en GAS + recovery del edit en frontend**

**Goal:** Eliminar la posibilidad de pérdida de datos al editar una transacción

**Requirements:** R1, R4

**Dependencies:** Ninguna

**Files:**
- Modify: `index.html` — función `guardarEdicionTransaccion()`
- Modify: GAS backend (archivo `.gs` del Apps Script de Daniel y Ama — no están en el repo, se editan desde Google Apps Script IDE)

**Approach:**
- En GAS: agregar acción `updateTransaccion` que recibe el objeto completo de la transacción con su `id`. Implementar como read-modify-write: `getValues()` del sheet de transacciones → buscar la fila por `id` → mutar los campos → `setValues()`. Proteger con `LockService.getScriptLock().waitLock(10000)` para prevenir escrituras concurrentes
- En el frontend: mientras GAS no tenga `updateTransaccion`, modificar `guardarEdicionTransaccion()` para guardar una copia del objeto original antes del DELETE. Si el ADD falla, hacer re-ADD automático del original antes de mostrar el error al usuario. Este recovery se puede deprecar cuando se complete la migración a Supabase
- El GAS update debe devolver `{ok: true, transaccion: {...}}` con el objeto actualizado para que el frontend pueda actualizar su array local sin re-fetch

**Patterns to follow:**
- El patrón de error existente en `addTransaccion`: mostrar mensaje inline rojo en el formulario
- El objeto de transacción en `guardarEdicionTransaccion()` — todos los campos deben enviarse en el body del POST

**Test scenarios:**
- Happy path: editar descripción → el campo se actualiza en la tabla, sin reload
- Happy path: editar monto → los KPIs de Resumen se recalculan correctamente
- Error path: simular fallo en el ADD después de DELETE exitoso → la transacción original se restaura, el usuario ve un error claro (no "recargá la página")
- Edge case: editar mientras la conexión es lenta → el botón se deshabilita durante el request, sin doble submit

**Verification:**
- Editar una transacción en ambos dashboards y verificar que el dato persiste en el sheet
- Verificar que `_normalizarCategorias()` sigue funcionando sobre el objeto retornado por `updateTransaccion`

---

- [ ] **Unit 2: Error states visibles en cargas fallidas + fetch timeout**

**Goal:** El usuario sabe cuando el backend no responde, ya sea en carga inicial o refresh. Ningún fetch bloquea la UI indefinidamente

**Requirements:** R2, R3

**Dependencies:** Ninguna

**Files:**
- Modify: `index.html` — funciones `cargarTodasTransacciones()`, `cargarCategorias()`, `iniciarApp()`, función wrapper para fetch

**Approach:**
- Crear una función wrapper `fetchConTimeout(url, opciones, ms = 15000)` que use `AbortController` para cancelar el request después de `ms` ms. Todas las llamadas al GAS usarán este wrapper en lugar de `fetch()` directo
- En `cargarTodasTransacciones()` y `cargarCategorias()`: si la llamada falla en carga inicial (no hay cache), mostrar un estado de error visible en la UI en lugar de renderizar vacío. Un banner o mensaje en la sección principal es suficiente: "No se pudo conectar al servidor. Revisá tu conexión."
- En el background refresh (ya hay cache y se actualiza en segundo plano): si falla, mostrar un badge discreto o toast "Sin conexión — mostrando datos guardados" sin interrumpir el uso
- Verificar `r.ok` antes de `.json()` — si GAS devuelve un error HTTP (que puede ser HTML), el catch actual confunde el error. Agregar: `if (!r.ok) throw new Error(\`HTTP \${r.status}\`)`

**Patterns to follow:**
- El toast existente de undo-delete (`_showToastUndo`) para el badge de "datos guardados"
- El patrón de inline red message existente en mutations para los errores de carga inicial

**Test scenarios:**
- Happy path: carga normal con cache previo → UI renderiza inmediatamente del cache, background fetch actualiza silenciosamente
- Error path: GAS no responde y no hay cache → aparece mensaje de error, no renderiza vacío
- Error path: GAS no responde pero hay cache → se muestra toast de "datos guardados", la app sigue usable
- Error path: fetch tarda más de 15 segundos → se cancela con AbortError, se muestra como error de conexión (no queda colgado)
- Error path: GAS devuelve error HTTP (HTML) → se captura correctamente sin "SyntaxError: Unexpected token '<'"

**Verification:**
- Temporalmente setear la API_URL a una URL inválida y verificar que aparece el error correcto sin pantalla en blanco

---

- [ ] **Unit 3: Respuestas de error estructuradas en GAS**

**Goal:** Todos los errores del GAS devuelven JSON con estructura consistente, no HTML ni strings ad-hoc

**Requirements:** R2, R4

**Dependencies:** Unit 2 (el frontend espera `{ok: false, error: "..."}`)

**Files:**
- Modify: GAS backend — `doGet()` y `doPost()` deben envolver toda su lógica en try/catch top-level y devolver `ContentService.createTextOutput(JSON.stringify({ok: false, error: e.message})).setMimeType(ContentService.MimeType.JSON)` en caso de error
- Modify: `index.html` — actualizar los handlers que verifican `j.ok` para consumir `j.error` en el mensaje al usuario cuando `ok === false`

**Approach:**
- GAS: el `doPost()` y `doGet()` actuales probablemente tienen un switch/if sobre `action`. Envolverlos en try/catch. El catch devuelve `{ok: false, error: message}` con status 200 (GAS no puede devolver status codes custom fácilmente, devuelve siempre 200)
- Frontend: ya verifica `j.ok === false` en mutations — agregar `j.error` al mensaje mostrado en lugar de un string hardcodeado genérico

**Test scenarios:**
- Happy path: todas las actions existentes siguen devolviendo `{ok: true, ...}`
- Error path: enviar una action inválida → devuelve `{ok: false, error: "Acción no reconocida: X"}` (no HTML 500)
- Error path: intentar addTransaccion con campos faltantes → devuelve `{ok: false, error: "campo X requerido"}`

**Verification:**
- Testear en la consola del browser: todas las respuestas del GAS son JSON parseables, incluyendo las de error

---

### Fase 1: Migración a Supabase

- [ ] **Unit 4: Configurar proyectos Supabase + schema + RLS**

**Goal:** Dos proyectos Supabase (uno por dashboard) con el schema correcto, RLS habilitado, y dos usuarios de auth creados

**Requirements:** R5, R6, R8

**Dependencies:** Fase 0 completa (migrar con el GAS ya estable)

**Files:**
- Create: `docs/supabase/schema.sql` — DDL del schema a aplicar en ambos proyectos
- Create: `docs/supabase/rls-policies.sql` — RLS policies para las 3 tablas

**Approach:**
- Crear dos proyectos en Supabase dashboard en región `sa-east-1` (São Paulo): `finanzas-daniel` y `finanzas-ama`
- Schema base (3 tablas, igual para ambos proyectos):
  - `transacciones`: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `fecha date`, `tipo text`, `categoria text`, `monto numeric`, `descripcion text`, `usuario text`, `responsabilidad text`, `fuente text`, `moneda text CHECK (moneda IN ('ARS','USD'))`, `user_id uuid REFERENCES auth.users`
  - `categorias`: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `tipo text CHECK (tipo IN ('Gasto','Ingreso','Fuente'))`, `valor text`, `usuario text`, `user_id uuid REFERENCES auth.users`
  - `presupuesto`: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `mes int`, `anio int`, `categoria text`, `porcentaje numeric`, `usuario text`, `user_id uuid REFERENCES auth.users`, `UNIQUE(mes, anio, categoria, user_id)`
- RLS: habilitar en las 3 tablas. Policy base: `user_id = auth.uid()` para SELECT/INSERT/UPDATE/DELETE
- Policy adicional para Compartidos: transacciones con `responsabilidad = 'Compartido'` deben ser visibles para ambos usuarios (el cálculo de "Ama te debe" en Daniel requiere ver gastos compartidos de Ama). Opciones: (a) columna `responsabilidad = 'Compartido'` visible para cualquier usuario autenticado del mismo proyecto — válido porque los dos proyectos son completamente independientes, o (b) duplicar la fila en ambos proyectos al hacer insert. **Deferir esta decisión a implementación** — evaluar en ese momento
- Crear usuarios auth via Supabase dashboard: `daniel@finanzas.local` (password) y `ama@finanzas.local` (password). Las credenciales se guardan solo en el frontend config, no en el repo

**Test scenarios:**
- Happy path: `SELECT * FROM transacciones` con el anon key devuelve solo las filas del usuario autenticado
- Security: intentar SELECT sin autenticar → 0 filas (RLS vacío, no error)
- Security: autenticar como user A e intentar ver filas de user B → 0 filas

**Verification:**
- Desde el Supabase Table Editor, verificar que RLS está enabled en las 3 tablas y que las policies existen

---

- [ ] **Unit 5: Migración de datos GAS → Supabase**

**Goal:** Los datos históricos de transacciones, categorías y presupuesto de Sheets están en PostgreSQL

**Requirements:** R4

**Dependencies:** Unit 4

**Files:**
- Modify: GAS backend — agregar action `exportAll` que devuelve todos los datos en JSON estructurado (útil para exportación limpia)
- No se crean archivos de datos en el repo — son datos personales

**Approach:**
- Exportar desde Google Sheets: `Archivo → Descargar → CSV` para cada sheet (transacciones, categorías, presupuesto) — o usar la action `exportAll` del GAS si se agrega
- Transformar si es necesario: verificar que los formatos de fecha son `YYYY-MM-DD`, que los montos son numeric (no strings con coma), que los IDs son consistentes
- Importar via Supabase Table Editor → Import CSV. El campo `user_id` se puede setear via una Supabase migration o un script SQL post-import (`UPDATE transacciones SET user_id = '<uuid-de-daniel>'`)
- Hacer esto para ambos proyectos (Daniel y Ama)

**Test scenarios:**
- Happy path: query `SELECT COUNT(*) FROM transacciones` en Supabase coincide con número de filas en Sheets
- Happy path: transacción con monto en USD está correctamente tipada como `numeric`, no como string
- Edge case: verificar que caracteres especiales en `descripcion` (ñ, tildes, símbolos de pesos) sobrevivieron la exportación/importación

**Verification:**
- Ejecutar un cálculo de control: suma de gastos ARS del mes más reciente en Sheets vs Supabase — deben coincidir

---

- [ ] **Unit 6: Integrar supabase-js CDN + manejo de sesión**

**Goal:** El frontend puede autenticarse y mantener sesión contra Supabase. Reemplaza el campo "API URL" actual del GAS

**Requirements:** R5, R7

**Dependencies:** Unit 4

**Files:**
- Modify: `index.html` — agregar `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2">`, agregar variables globales `supabaseClient`, `supabaseSession`
- Modify: `index.html` — pantalla de configuración (`page-config`) para ingresar Project URL + anon key en lugar del GAS URL, y un flujo de login (email/password)

**Approach:**
- Inicializar: `const supabaseClient = supabase.createClient(PROJECT_URL, ANON_KEY)` usando los valores del `localStorage` (igual que hoy se guarda `API_URL`)
- Auth: `supabaseClient.auth.signInWithPassword({email, password})`. Si ya hay sesión en localStorage la recupera automáticamente via `supabaseClient.auth.getSession()`
- Los valores de `PROJECT_URL`, `ANON_KEY`, email y password se guardan en `localStorage` (aceptable para uso personal single-device)
- La pantalla de config (`page-config`) muestra un campo "Project URL", un campo "Anon Key", y un botón "Conectar" que hace signIn. Success → muestra el email autenticado. El botón "ping" existente puede reutilizarse para verificar la conexión
- Agregar `supabaseClient.auth.onAuthStateChange()` para detectar sesión expirada y mostrar el config screen

**Patterns to follow:**
- El patrón existente de `page-config` con validación y mensajes de estado inline
- Las variables globales `API_URL`, `USUARIO` como referencias para el nuevo `supabaseClient`

**Test scenarios:**
- Happy path: ingresar credenciales válidas → sesión establecida, app funciona normalmente
- Error path: credenciales incorrectas → mensaje "Email o contraseña incorrectos", el usuario puede reintentar
- Edge case: sesión expirada (24h) → el usuario ve la pantalla de login, datos de cache siguen visibles

**Verification:**
- El Supabase dashboard muestra el usuario autenticado en Auth → Users

---

- [ ] **Unit 7: Reescribir la capa de API del frontend (~15 funciones)**

**Goal:** Todas las funciones de fetch hacia GAS son reemplazadas por calls a Supabase PostgREST. La lógica de render no cambia

**Requirements:** R1, R2, R3, R4, R5, R6

**Dependencies:** Units 4, 5, 6

**Files:**
- Modify: `index.html` — reescribir las funciones: `cargarTodasTransacciones()`, `cargarCategorias()`, `guardarTransaccion()`, `eliminarTransaccion()`, `guardarEdicionTransaccion()`, `savePresupuesto()`, `cargarPresupuesto()`, `batchAddTransacciones()`, `addCategoria()`, `deleteCategoria()`
- Modify: `index.html` — reescribir `fetchConTimeout()` para usar `supabaseClient` (o mantener fetch directo a PostgREST con el Authorization header de la sesión)

**Approach:**
- Mapeo de endpoints:
  - `getTransacciones` → `supabaseClient.from('transacciones').select('*').order('fecha', {ascending: false})`
  - `addTransaccion` → `supabaseClient.from('transacciones').insert({...transaccion, user_id: session.user.id})`
  - `updateTransaccion` → `supabaseClient.from('transacciones').update({...campos}).eq('id', id)` — **el update nativo que no existe en GAS**
  - `deleteTransaccion` → `supabaseClient.from('transacciones').delete().eq('id', id)`
  - `batchAddTransacciones` → `supabaseClient.from('transacciones').insert([...rows])` — PostgREST soporta insert de array nativo
  - `getCategorias` → `supabaseClient.from('categorias').select('*').eq('usuario', USUARIO)`
  - `addCategoria` → `supabaseClient.from('categorias').insert({...})`
  - `deleteCategoria` → `supabaseClient.from('categorias').delete().eq('valor', valor).eq('tipo', tipo)`
  - `getPresupuesto` → `supabaseClient.from('presupuesto').select('*').eq('mes', mes).eq('anio', anio).eq('usuario', USUARIO)`
  - `savePresupuesto` → `supabaseClient.from('presupuesto').upsert([...items])` — upsert aprovecha la UNIQUE constraint del schema
- Supabase devuelve `{data, error}` — adaptar el manejo de errores existente (`j.ok === false`) al patrón `if (error) ...`
- El timeout de 15s de Unit 2 sigue aplicando — wrappear los calls de supabase-js con la misma lógica de AbortController si es necesario, o confiar en el timeout del fetch nativo de supabase-js (configurable)
- `guardarEdicionTransaccion()` se simplifica radicalmente: ya no es delete+add, es un simple `update`

**Execution note:** Implementar función por función, verificando que cada una funciona contra Supabase antes de pasar a la siguiente. No reescribir todo de una vez.

**Patterns to follow:**
- El patrón de respuesta consistente del resto de las funciones: actualizar el array local, re-renderizar, mostrar toast/mensaje de éxito
- `_normalizarCategorias()` sigue siendo llamada después de `cargarTodasTransacciones()` — no cambia

**Test scenarios:**
- Happy path: cargar la app con datos en Supabase → todos los KPIs y gráficos coinciden con los valores del período
- Happy path: agregar transacción → aparece en la tabla, los KPIs se actualizan
- Happy path: **editar transacción** → el dato se actualiza en Supabase y en la UI **sin delete+add**
- Happy path: eliminar transacción con undo → si se cancela el undo, la transacción se restaura
- Happy path: importar lote CSV → todas las filas aparecen en la tabla
- Integration: guardar presupuesto y recargar → los porcentajes persisten correctamente
- Error path: Supabase devuelve `{error: {...}}` → el usuario ve el mensaje de error, la app no crashea

**Verification:**
- Abrir ambos dashboards en el browser, realizar una operación de cada tipo (add, edit, delete, export), verificar que la data en Supabase es consistente

---

- [ ] **Unit 8: Keep-alive de proyectos Supabase**

**Goal:** Los proyectos Supabase no se pausan por inactividad

**Requirements:** R8

**Dependencies:** Unit 4

**Files:**
- No hay archivos de código — es configuración externa

**Approach:**
- Crear cuenta en UptimeRobot (free tier: 50 monitors, check cada 5 minutos)
- Configurar 2 monitores HTTP(S) — uno por proyecto — apuntando a `https://<project>.supabase.co/rest/v1/` con el header `apikey: <anon-key>`
- Setear check interval: 4 días (o el mínimo disponible). Supabase pausa tras 7 días de inactividad — cualquier check dentro de esa ventana es suficiente

**Test scenarios:**
- Happy path: el monitor de UptimeRobot reporta status "UP" para ambos proyectos

**Verification:**
- Verificar en el Supabase dashboard que el proyecto no está en estado "Paused" después de varios días

---

## System-Wide Impact

- **Interacción con ambos repos**: cada unit de código debe aplicarse a `finanzas-dashboard-live/index.html` Y `finanzas-dashboard-ama-live/index.html`. Los Units 4–5 tienen proyectos Supabase independientes para cada dashboard. El Unit 8 configura monitores para ambos
- **Propagación de errores**: con Supabase, los errores tienen estructura `{data, error}` — el patrón de error handling cambia de `j.ok === false` a `if (error)`. Este cambio es local a las ~15 funciones de la capa API
- **`_normalizarCategorias()`**: sigue siendo necesaria post-migración. Supabase no valida case-sensitivity en strings — los datos históricos pueden tener variaciones que este normalizador resuelve
- **El cache de localStorage**: el patrón stale-while-revalidate no cambia. Las keys (`fp_` y `fp_ama_`) siguen siendo las mismas. Los datos cacheados del GAS deben invalidarse al migrar (limpiar `localStorage` una vez al hacer el cutover)
- **`getTransacciones` sigue trayendo todo**: no hay paginación en esta fase. El comportamiento es idéntico al actual. La diferencia es que la query solo trae las filas del usuario autenticado (RLS), no las de ambos usuarios — el cálculo de Compartidos debe revisarse en el context de la policy de RLS (ver Unit 4 deferred question)
- **Invariantes que no cambian**: toda la lógica de render (`cargarResumenMes`, `cargarEvolucion`, `filtrarTabla`, `cargarAnual`, `_tendencia`, etc.), el data model de la transacción, las clases CSS, el sistema de navegación — nada de esto cambia

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| El cálculo de "Ama te debe" / "Compartidos" requiere que Daniel vea gastos compartidos de Ama | Resolver en Unit 4 — policy RLS específica para `responsabilidad = 'Compartido'`. Si el schema es independiente por proyecto, puede no ser necesario si los datos compartidos ya están duplicados en ambos sheets |
| Supabase project pausing toma la app offline en el primer request post-pausa (20–30s) | Unit 8 (UptimeRobot) previene el pausing. Más la caché de localStorage muestra datos mientras el proyecto "despierta" |
| Los IDs actuales de GAS (strings) pueden no ser UUIDs compatibles con Supabase | Al importar CSV, si los IDs del GAS no son UUIDs, Supabase puede generar nuevos UUIDs. El frontend usa `id` solo para delete/update — mientras sea único y consistente, funciona. Verificar en Unit 5 |
| Un error en Unit 7 puede romper el dashboard completo | Implementar función a función sobre la rama `develop`, no en un solo commit gigante. El workflow CI/CD existente valida `getTransacciones` y otras funciones críticas por nombre |
| La sesión de Supabase Auth expira cada 1h (JWT) y se refresca automáticamente, pero si la app está abierta varios días sin uso, puede perder sesión | `supabase.auth.onAuthStateChange()` detecta expiración. Mostrar el login screen si la sesión no puede refrescarse |
| Los datos personales (finanzas) ahora están en un servidor de terceros (Supabase) | Supabase es GDPR-compliant, datos en São Paulo. El riesgo es similar al actual (datos en Google Sheets). La diferencia: RLS da más control que "URL secreta" |

## Documentation / Operational Notes

- El `CLAUDE.md` de ambos repos debe actualizarse en la Fase 1 para reflejar el nuevo backend (Supabase URL, tabla names, auth pattern) y deprecar las referencias al GAS
- La sección 6 de CLAUDE.md ("Backend API (Apps Script)") pasa a describir la API de Supabase PostgREST
- Las variables globales `API_URL` y el campo de config en `page-config` cambian de nombre/propósito — documentar en el commit
- Los proyectos GAS no se decommisionan hasta confirmar que la migración está estable en producción (main branch) por al menos 1 semana

## Sources & References

- Related code: `index.html:cargarTodasTransacciones()` — función principal de fetch
- Related code: `index.html:guardarEdicionTransaccion()` — el delete+add con comentario de riesgo
- Related code: `index.html:iniciarApp()` — orchestración de carga inicial
- External docs: https://supabase.com/docs/guides/database/postgres/row-level-security
- External docs: https://supabase.com/docs/guides/api (PostgREST auto-generado)
- External docs: https://github.com/supabase/supabase-js (CDN usage)
- External docs: https://developers.google.com/apps-script/reference/lock/lock-service
