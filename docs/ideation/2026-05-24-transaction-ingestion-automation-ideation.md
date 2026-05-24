---
date: 2026-05-24
topic: transaction-ingestion-automation
focus: automatizar ingreso de transacciones en tiempo real para dashboard finanzas personales Argentina
mode: repo-grounded
---

# Ideation: Automatización de Ingreso de Transacciones

## Grounding Context

**Stack:** Vanilla JS + Supabase single-file app (~6000 líneas index.html), 2 usuarios (Daniel y Ama), Vercel deployed. Sin build pipeline.

**Estado actual:** 100% ingreso manual — formulario con 6 campos (tipo, categoria, monto, responsabilidad, fuente, descripcion). CSV import existe pero es flujo mensual de paste+parse. PDF parser removido.

**Hallazgo clave:** La integración completa con Mercado Pago fue construida (commit `fee4394`) y revertida en abril 2026 — OAuth + `/v1/payments/search` + preview/confirm flow están en git history, recuperables.

**Fuentes de pago en uso:** Apple Pay (respaldado por tarjetas Galicia/BBVA), Mercado Pago (QR, transferencias), efectivo.

**Infraestructura disponible:**
- Apple Shortcuts Wallet trigger (iOS 17+): dispara al momento del pago, expone merchant + monto + tarjeta
- Google Apps Script: ya es el backend, free, cron-capable, lee Gmail, puede POST a Supabase REST
- Galicia y BBVA envían email por cada transacción con merchant + monto + fecha en el subject
- Supabase Edge Functions: disponibles, aún no deployadas
- Mercado Pago API: OAuth disponible; devuelve pagos recibidos de manera confiable
- Argentina Open Finance (Decreto 353/2025): ley existe, APIs bancarias aún no disponibles

**Patrones reutilizables en codebase:**
- `confirmarImport()` — batch insert a Supabase, reutilizable para cualquier fuente
- `_parsearLinea()` — regex patterns de extracción, portables a Edge Function
- `_normalizarCategorias()` — normalization logic, replicable server-side
- `allTransac[]` — historial completo en memoria al login (descripcion + categoria pairs)

## Topic Axes

1. **Capture trigger** — cuándo/cómo se detecta una transacción
2. **Data extraction & normalization** — convertir señal raw en fila estructurada
3. **Deduplication & conflict resolution** — misma transacción desde múltiples fuentes
4. **Categorization & enrichment** — auto-asignar categoria, responsabilidad, fuente
5. **UX & review flow** — confirmar, corregir, descartar capturas automáticas

## Ranked Ideas

### 1. Apple Wallet Shortcut → Supabase Edge Function
**Axis:** Capture trigger
**Description:** iOS 17+ expone un trigger nativo de Wallet en Shortcuts (Automatizaciones → Wallet) que dispara en el momento exacto del pago sin abrir ninguna app, entregando merchant name, amount, y card used. Un Shortcut envía estos datos vía HTTP POST a un Supabase Edge Function que normaliza y los inserta directamente usando el mismo row shape que `confirmarImport()`. El usuario nunca necesita recordar registrar el gasto — ocurre antes de volver a guardar el teléfono.
**Basis:** `direct:` iOS 17+ Wallet automation trigger documentado en Shortcuts bajo Automatizaciones → Wallet. El Edge Function recibe el POST y llama Supabase insert con el mismo schema de `confirmarImport()` en línea 6827 de index.html.
**Rationale:** Elimina el paso de "abrir la app" para todos los pagos NFC con tarjeta — el ingreso ocurre en tiempo real sin fricción. Para compras físicas (supermercado, farmacia, nafta) esto cubre el 60-70% del volumen de transacciones de Daniel.
**Downsides:** Solo funciona para Apple Pay NFC (no compras online, no Mercado Pago QR, no cubre a Ama si no usa Apple Pay). Requiere el primer Edge Function deployment del proyecto.
**Confidence:** 90%
**Complexity:** Low-Medium — 1 Supabase Edge Function + configurar el Shortcut en iOS
**Status:** Unexplored

---

### 2. Source Event ID como Idempotency Key
**Axis:** Deduplication & conflict resolution
**Description:** Agregar columna `idempotency_key text unique` a la tabla `transacciones`. Cada fuente de ingreso genera el key antes de insertar: fuentes con ID de evento real (MP API devuelve `payment.id`, Wallet Shortcut expone un transaction ID) usan `source_mp_{id}` o `source_wallet_{id}`; entrada manual y email parse usan hash de `(user_id + fecha + monto + descripcion[:20])`. Cualquier insert duplicado — desde cualquier fuente, ahora o en el futuro — es silenciosamente ignorado con `.upsert(..., { onConflict: 'idempotency_key', ignoreDuplicates: true })`.
**Basis:** `direct:` El `confirmarImport()` actual hace `.insert(rows)` sin ninguna guarda de deduplicación — dos fuentes que capturan el mismo pago insertan dos filas sin error. `external:` Sistema ISBT 128 (banco de sangre): identificar por ID de evento exacto es más confiable que heurísticas de similitud (mismo monto ± 5 minutos puede colidir con compras reales).
**Rationale:** Prerequisito para habilitar múltiples fuentes simultáneas. Sin esto, Wallet Shortcut + email parse + MP cron insertarían el mismo pago tres veces. Una migration, cero cambio de UX, hace todo el stack de automatización seguro para deployar.
**Downsides:** Requiere actualizar todos los callsites de insert (~8 en index.html) para pasar el key. Los hashes de fallback tienen riesgo teórico de colisión en edge cases (mismo merchant, mismo monto, mismo día, transacciones distintas).
**Confidence:** 95%
**Complexity:** Low — 1 migration Supabase + 2-line change por callsite de insert
**Status:** Unexplored

---

### 3. Bank Email Galicia/BBVA → Google Apps Script → Supabase
**Axis:** Capture trigger
**Description:** Galicia y BBVA envían email por cada transacción de tarjeta con merchant + monto + fecha en el subject. Un Google Apps Script (ya es el backend live del proyecto) con time-trigger cada 15 minutos busca emails no leídos de los bancos con `GmailApp.search('from:notificaciones@galicia.com.ar')`, extrae los campos del subject con regex, y hace POST al endpoint REST de Supabase para insertar la transacción. Cubre compras online, ambas tarjetas, ambos usuarios — casos que el Wallet Shortcut no alcanza.
**Basis:** `direct:` Apps Script es el backend documentado en CLAUDE.md como live y operativo. Galicia y BBVA envían emails estructurados por transacción, documentado en grounding. `GmailApp.search()` + time-trigger es infraestructura Apps Script estándar.
**Rationale:** Mayor cobertura que el Wallet Shortcut usando infraestructura que ya existe y el equipo ya conoce. No agrega dependencias. El email parse es más estable que el PDF parse (el subject line bancario cambia menos que los templates de PDF).
**Downsides:** Latencia de hasta 15 minutos (vs. instantáneo con Wallet Shortcut). Si el banco cambia el template del subject silenciosamente el parser falla ruidosamente. Wallet + email parsearán el mismo pago físico → requiere idempotency key (idea 2).
**Confidence:** 85%
**Complexity:** Low — Apps Script nuevo en proyecto existente + Supabase REST POST. Sin nueva infraestructura de hosting.
**Status:** Unexplored

---

### 4. Mercado Pago Nightly Cron (Restaurar Integración Revertida)
**Axis:** Capture trigger
**Description:** El commit `fee4394` construyó la integración completa con MP: OAuth flow, `/v1/payments/search`, `/v1/collections/search`, clasificación cobros=Ingreso/pagos=Gasto, preview + confirm via batch insert. Fue revertida — el código existe completo en git history. La causa probable fue la UX de ingresar el access token manualmente cada vez. Solución: guardar el token una sola vez en `supabaseClient.auth.updateUser({ data: { mp_access_token } })` + un Vercel cron nightly en `vercel.json` (ya existe) que llama el endpoint `/api/mp-sync` para los últimos 24 horas.
**Basis:** `direct:` Commit `fee4394` contiene toda la cadena de API calls, clasificación, y batch insert. El repo ya tiene `vercel.json` con soporte de crons. `api/quote.js` demuestra el patrón de Vercel serverless function ya en uso.
**Rationale:** Para transacciones de Mercado Pago (QR, transferencias, cobros) esta es la única automatización posible — no hay Wallet trigger ni email estructurado. El código ya fue probado y validado en este mismo codebase; el trabajo es restaurar y ajustar el token storage.
**Downsides:** El access token MP personal expira (~6 meses) y requiere renovación manual. La API cubre pagos *recibidos* de manera confiable; pagos *enviados* tienen cobertura parcial. Requiere diagnosticar el motivo exacto del revert antes de restaurar.
**Confidence:** 80%
**Complexity:** Medium — recuperar código de git history + token storage en user_metadata + Vercel cron
**Status:** Unexplored

---

### 5. Description-Cluster Auto-Categorizer (In-Memory, Zero Infrastructure)
**Axis:** Categorization & enrichment
**Description:** Al construir el render de la app, crear un `Map<normalized_merchant, categoria>` en <5ms desde `allTransac[]` agrupando por descripcion normalizada. Cuando llega una nueva transacción (manual o automática) con descripcion conocida, `categoria` se auto-asigna sin mostrar el selector. Solo se muestra el picker para merchants genuinamente nuevos (~20% de transacciones). El map se invalida y reconstruye al agregar correcciones.
**Basis:** `direct:` `allTransac[]` está cargado globalmente al login con el historial completo de pares `(descripcion, categoria)`. `_normalizarCategorias()` (CLAUDE.md §5) ya demuestra el patrón de backward-lookup — esto es el complemento forward. `SELECT descripcion, categoria, COUNT(*) GROUP BY ... ORDER BY 3 DESC` en datos existentes produce el mapping inicial sin trabajo manual.
**Rationale:** Para ~80% de las transacciones el merchant es conocido (Carrefour, Rappi, YPF, farmacia de barrio). Eliminar la selección de categoría para esos casos corta el tiempo de entrada a la mitad para ingreso manual y mejora la calidad de capturas automáticas (el Edge Function puede hacer el mismo lookup).
**Downsides:** Merchants con nombre inconsistente en descripcion (distintas truncaciones según banco o fuente) pueden no matchear. Las correcciones de categoría deben propagarse al map.
**Confidence:** 90%
**Complexity:** Low — ~20 líneas JS en `_renderApp()`, sin backend, sin migration
**Status:** Unexplored

---

### 6. Smart Responsabilidad Default desde Fuente
**Axis:** Categorization & enrichment
**Description:** Un objeto de lookup `{ fuente: responsabilidad }` guardado en localStorage (editable en Configuración) auto-setea `f-responsabilidad` cuando el usuario cambia `f-fuente`, usando el hook `onchange` ya existente en ese select y la función `seleccionarResp(valor)` ya expuesta por `inicializarRespButtons()`. Daniel paga con Galicia Débito → "Mío" auto-seteado. Tarjeta compartida → "Compartido". El usuario sobrescribe libremente.
**Basis:** `direct:` El `f-fuente` select tiene `onchange` handler (`_actualizarMesLiqField(this.value)`) en el código actual — el hook de extensión ya existe. `seleccionarResp(valor)` e `inicializarRespButtons()` exponen la API programática. La correlación fuente→responsabilidad es verificable en `allTransac[]` antes de construir nada.
**Rationale:** `responsabilidad` es el campo que más frecuentemente se setea mal bajo presión mobile, causando errores en el balance de Compartidos que solo se descubren al fin de mes. El fuente→responsabilidad mapping es una convención entre Daniel y Ama que ya existe en su cabeza — el código solo la externaliza.
**Downsides:** Requiere que Daniel y Ama acuerden el mapeo (conversación de 5 minutos antes de implementar). Si una fuente se usa para ambas responsabilidades con frecuencia similar, el default puede ser incorrecto con regularidad.
**Confidence:** 88%
**Complexity:** Low — ~15 líneas JS, localStorage, sin migration
**Status:** Unexplored

---

### 7. Pendiente Review Strip
**Axis:** UX & review flow
**Description:** Las transacciones auto-capturadas entran a Supabase con `estado: 'pendiente'`. Un strip dismissible en la parte superior de Mi mes muestra "3 transacciones capturadas automáticamente — revisar" con swipe-to-confirm individual o "Confirmar todo" en un tap. `cargarPresupuesto()` filtra `estado != 'pendiente'` de los cálculos de KPIs hasta confirmación. El strip solo aparece cuando hay pendientes; confirmar todas en lote es el happy path para días sin errores.
**Basis:** `direct:` Sin este mecanismo, transacciones auto-capturadas con categoria incorrecta (merchant nuevo) corrompen silenciosamente los KPIs de Mi mes. El pattern de `cargarPresupuesto()` filtrando por estado es análogo al filtro `mes_liquidacion` ya implementado. El espacio visual en `page-presupuesto` sobre el grid de KPIs puede alojar el strip sin rediseño.
**Rationale:** Responde la objeción principal a la automatización ("¿y si se equivoca?"). Separa la velocidad de captura de la corrección de datos. El usuario confía en la automatización porque los errores son visibles antes de afectar el reporte. Es la capa de confianza que hace los otros 6 puntos desplegables sin ansiedad.
**Downsides:** Agrega una responsabilidad de UX — el strip visible puede ignorarse y las pendientes acumularse. Necesita TTL o recordatorio si el usuario no revisa. Depende de que al menos una fuente automática exista para ser útil.
**Confidence:** 85%
**Complexity:** Low-Medium — 1 migration (columna `estado` en transacciones) + strip UI en Mi mes
**Status:** Unexplored

---

## Rejection Summary

| # | Idea | Razón Rechazada |
|---|------|-----------------|
| 1 | iOS Shortcut → PWA deep-link pre-fill | Dominada por idea 1 — el form es lo que se elimina, no lo que se pre-llena |
| 2 | n8n email parsing | Misma idea que survivor 3 pero con dependencia externa nueva; Apps Script ya es el backend |
| 3 | Recurring transaction templates | Mejora UX manual, no automatización — debajo del umbral de ambición |
| 4 | Pending tray (quick-save cash) | Cash sin señal automática es un problema diferente; no avanza la automatización |
| 5 | merchant_rules table + feedback loop | Dominada por survivor 5 — mismo resultado, zero infrastructure vs. nueva tabla |
| 6 | MCC code backbone | Solo aplica a MP, requiere que MP integration exista primero, complejidad media |
| 7 | _normalizarCategorias() como Postgres function | Scale erróneo — 2 usuarios no lo necesitan; valid para más adelante |
| 8 | Confidence score + auto-confirm threshold | Segundo orden — valioso solo cuando el volumen de capturas automáticas lo justifica |
| 9 | Dedup heurístico (±5 min, mismo monto) | Dominado por survivor 2 — event IDs exactos son más confiables que heurísticas |
| 10 | WhatsApp receipt photo → vision API | Dos dependencias nuevas para cubrir cash receipts — ROI bajo para 2 usuarios |
| 11 | Gmail label como interfaz de captura | Paso manual en el flujo — contradice el objetivo de automatización |
| 12 | Transaction as merchant signal (reframe) | Rewrite arquitectónico del schema — demasiado heavy para SPA single-file |
| 13 | Future spend prediction desde compras_cuotas | Gran idea, topic diferente — no es ingestion automation |
| 14 | pg_cron spend velocity + Web Push | Topic diferente — alerting proactivo, no ingestion |
| 15 | Web Share Target | Mejora incremental al flujo manual, no automatización |
| 16 | End-of-day voice note batch | Nuevo hábito incierto; peor que el review strip async |
| 17 | End-of-day digest de capturas | Downstream — depende de que las automatizaciones existan primero |
| 18 | Budget detects what's missing | Topic diferente — prompting proactivo |
| 19 | Shared expense propagation via DB trigger | Dirección correcta, scope diferente — Compartidos merece su propio ideation |
| 20 | Package tracking → event sourcing | Scope overrun para esta escala de app |
| 21 | ATC handoff → shared expense acknowledgment | Más específico que shared expense propagation; ambas fuera de scope de ingestion |
| - | axis: Data extraction & normalization | Gap deliberado — survivors 1, 3 y 4 incluyen extracción en su scope; Edge Function genérico de normalización es detalle de implementación, no idea de producto |

---

## Secuencia de Implementación Sugerida

```
Semana 1 (zero infra):
  → Idea 6: fuente→responsabilidad default (15 líneas JS, sin migration)
  → Idea 5: description-cluster auto-categorizer (20 líneas JS, sin migration)

Semana 2 (primer server-side):
  → Idea 2: idempotency key migration (prerequisito para todo lo que sigue)
  → Idea 1: Wallet Shortcut + primer Supabase Edge Function
  → Idea 7: pendiente review strip (migration estado + strip UI)

Semana 3-4 (ampliar cobertura):
  → Idea 3: bank email via Apps Script
  → Idea 4: MP nightly cron (restaurar desde git history)
```

Ideas 5 y 6 se pueden construir hoy sin tocar el servidor. Idea 2 desbloquea todo lo demás de manera segura.
