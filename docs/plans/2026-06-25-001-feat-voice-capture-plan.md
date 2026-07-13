---
title: "feat: Captura de transacciones por voz (Web Speech API)"
status: active
origin: solicitud directa del usuario (2026-06-25)
created: 2026-06-25
---

# feat: Captura de transacciones por voz (Web Speech API)

## Problema

El formulario de nueva transacción (`#page-nueva`) tiene 6+ campos (fecha, tipo, moneda, monto, categoría, responsabilidad, fuente, descripción). Llenarlos a mano es tedioso, especialmente en mobile. Queremos que el usuario pueda dictar la transacción ("quinientos super compartido débito") y que la app pre-llene los campos para que solo tenga que revisar y guardar.

## Solución

Botón 🎤 en el header de `#page-nueva` (junto a "Carga múltiple") que usa la **Web Speech API** nativa (`SpeechRecognition` / `webkitSpeechRecognition`), disponible en Chrome desktop/Android y Safari iOS. Costo cero, sin APIs externas, sin claves.

Flujo: presionar 🎤 → reconocimiento de voz (`lang: 'es-AR'`) → transcript → parseo client-side → pre-llenado de campos del form usando las funciones existentes (`setTipo`, `setMoneda`, `seleccionarResp`) y asignación directa a inputs/selects → el usuario revisa y guarda con el botón existente.

Toda la lógica nueva vive en un módulo aislado `src/js/15-captura-voz.js`. No se modifica ninguna función existente de transacciones; solo se invocan desde el nuevo módulo.

## Scope

### Incluido
- Módulo nuevo `src/js/15-captura-voz.js` con: detección de soporte, control del ciclo de reconocimiento, parser de español (monto en palabras + dígitos, tipo, categoría, responsabilidad, fuente, descripción), y pre-llenado del form.
- Botón 🎤 + UI de estado (idle / escuchando / procesando / listo / error) + transcript breve, en `src/index.template.html`.
- CSS para el botón y la animación pulse roja de "escuchando".
- `vercel.json`: `microphone=()` → `microphone=(self)` en Permissions-Policy.
- `build.sh`: ningún cambio de código necesario (usa glob), pero se documenta la verificación de que `15-captura-voz.js` entra en la concatenación.
- Degradación elegante: si la API no existe, el botón se oculta.

### Excluido
- Reconocimiento en idiomas distintos de `es-AR`.
- Dictado continuo / multi-transacción en una sola frase.
- Guardado automático tras el dictado (siempre requiere revisión humana).
- Parseo de fecha por voz ("ayer", "el martes") — la fecha queda con su default actual.
- NLP avanzado o llamadas a modelos externos.
- Edición por voz de transacciones existentes (solo creación en `#page-nueva`).

## Decisiones técnicas (KTDs)

| Decisión | Rationale |
|---|---|
| **KTD-1** Web Speech API nativa, sin API externa | Costo cero, sin claves, sin backend; ya aprobado. Cubre Chrome y Safari iOS, los navegadores reales de Daniel y Ama. |
| **KTD-2** Módulo aislado `15-captura-voz.js`, no tocar funciones existentes de transacciones | Cumple "no romper el form existente". El módulo solo *llama* `setTipo`/`setMoneda`/`seleccionarResp` y asigna a inputs; si el módulo falla, el form a mano sigue intacto. |
| **KTD-3** Pre-llenar, nunca auto-guardar | El reconocimiento de voz es impreciso; el usuario siempre revisa antes de `guardarTransaccion()`. Evita transacciones erróneas silenciosas. |
| **KTD-4** Parser determinístico por keyword matching, sin librerías | Sin build pipeline ni npm. ES5/ES6 vanilla. El dominio es acotado (categorías/fuentes/responsabilidades ya son arrays globales finitos). |
| **KTD-5** Monto: número en palabras (es) + dígitos directos, primer match gana | Cubre "quinientos", "mil quinientos", "500", "1500". Tabla de palabras-número en español acotada a montos realistas (unidades, decenas, centenas, miles). |
| **KTD-6** `lang: 'es-AR'` | Mejor reconocimiento rioplatense. Fallback implícito del navegador si la variante no está, pero se pide `es-AR` explícito. |
| **KTD-7** `continuous = false`, `interimResults = false`, `maxAlternatives = 1` | Una frase, un resultado final. Simplifica el ciclo de estados y el parseo. Menos ruido. |
| **KTD-8** El botón solo existe en `#page-nueva`, no es global | Requisito explícito. Se coloca dentro del markup de esa page; no hay nada global que ocultar/mostrar al navegar. |
| **KTD-9** Detección de soporte al cargar → ocultar botón si no hay API | Degradación elegante. Sin `SpeechRecognition` ni `webkitSpeechRecognition`, el botón se setea a `display:none`. |
| **KTD-10** Si el parse no detecta monto → error orientativo, no pre-llenar parcialmente de forma confusa | El monto es el dato central de una transacción; sin él, mostrar el transcript + mensaje de ejemplo. Los demás campos sí se pueden pre-llenar parcial (categoría, fuente) porque son opcionales de revisar. |
| **KTD-11** `microphone=(self)` en vez de `microphone=*` | Mínimo privilegio: solo el propio origen puede usar el micrófono. Corrige el bloqueo actual sin abrir a terceros/iframes. |
| **KTD-12** Permisos del micrófono: dejar que el navegador maneje el prompt nativo; capturar `onerror` con `not-allowed`/`service-not-allowed` | No reinventar el manejo de permisos. Si el usuario deniega, mostrar estado de error con instrucción de habilitar el micrófono. |
| **KTD-13** Limpieza de tokens consumidos antes de derivar descripción | La descripción es "lo que queda". Cada campo detectado remueve sus tokens del string para que la descripción no repita "compartido débito". |

## Dependencias y secuencia

```
U1: Permissions-Policy (vercel.json)        ← prerequisito de runtime (sin esto, getUserMedia/SpeechRecognition se bloquea)
U2: Markup + CSS del botón y panel de estado (template)
     └─ U3: Módulo base — detección de soporte + ciclo de reconocimiento + estados UI
          └─ U4: Parser de voz (monto, tipo, categoría, resp, fuente, descripción)
               └─ U5: Pre-llenado del formulario (usa funciones existentes)
                    └─ U6: Integración build + verificación end-to-end
```

U1 y U2 son independientes entre sí; U3–U5 son secuenciales; U6 cierra.

---

## Unidades de implementación

### U1: Corregir Permissions-Policy en `vercel.json`
**Archivo:** `vercel.json`

**Qué cambia:**

En el header `Permissions-Policy`, reemplazar:
```
camera=(), microphone=(), geolocation=()
```
por:
```
camera=(), microphone=(self), geolocation=()
```

`microphone=()` (lista vacía) bloquea el micrófono en todos los orígenes, incluido el propio; con el header así, `SpeechRecognition` lanza `not-allowed` antes de pedir permiso. `microphone=(self)` lo habilita solo para el origen de la app (KTD-11). `camera` y `geolocation` quedan bloqueados (no se usan).

**Escenarios de test:**
- Tras deploy a Vercel, inspeccionar el response header `Permissions-Policy` → contiene `microphone=(self)`.
- En el preview, al presionar 🎤 el navegador muestra el prompt nativo de permiso de micrófono (no un error inmediato).
- `camera` sigue mostrando `camera=()` (sin regresión).

---

### U2: Markup del botón 🎤 y panel de estado + CSS
**Archivo:** `src/index.template.html`

**Qué cambia:**

1. **Botón** — en el `.page-header` de `#page-nueva` (~línea 2792), junto al botón "Carga múltiple":
   ```html
   <button id="btn-voz" class="btn-voz" onclick="toggleCapturaVoz()" title="Dictar transacción por voz" aria-label="Dictar transacción por voz" hidden>🎤</button>
   ```
   - `hidden` por defecto: U3 lo revela solo si hay soporte (KTD-9). Usar el atributo `hidden` (no `display` inline) para que U3 controle visibilidad limpiamente.

2. **Panel de estado** — dentro de `.form-card` de `#page-nueva`, arriba de la "Fila 1" (antes del primer `.form-row`), para que el feedback aparezca sobre el formulario:
   ```html
   <div id="voz-status" class="voz-status" hidden>
     <span id="voz-status-icon" class="voz-status-icon"></span>
     <span id="voz-status-text" class="voz-status-text"></span>
     <span id="voz-transcript" class="voz-transcript"></span>
   </div>
   ```

3. **CSS** — en el `<style>` del template, usando variables de tema (CLAUDE.md §9: respetar tema claro de Ama):
   ```css
   .btn-voz {
     font-size: 1.1rem; line-height: 1; padding: .5rem .7rem;
     background: var(--card); border: 1px solid var(--border);
     border-radius: 10px; cursor: pointer; color: var(--text);
     transition: transform .12s ease, background .12s ease;
   }
   .btn-voz:hover { background: var(--bg2); }
   .btn-voz.listening { animation: voz-pulse 1.1s ease-in-out infinite; border-color: var(--red); }
   @keyframes voz-pulse {
     0%,100% { box-shadow: 0 0 0 0 rgba(220,53,69,.55); }
     50%     { box-shadow: 0 0 0 8px rgba(220,53,69,0); }
   }
   .voz-status {
     display: flex; align-items: center; gap: .5rem; flex-wrap: wrap;
     margin-bottom: .8rem; padding: .55rem .7rem;
     background: var(--bg2); border: 1px solid var(--border); border-radius: 10px;
     font-size: .85rem;
   }
   .voz-status.is-error { border-color: var(--red); }
   .voz-status-text { color: var(--text); }
   .voz-transcript  { color: var(--text-dim); font-style: italic; }
   ```
   (Confirmar nombres exactos de variables `--red`, `--bg2`, `--text-dim`, `--card`, `--border`, `--text` en el `<style>`; CLAUDE.md las referencia. Ajustar si difieren.)

**Notas:** Si `prefers-reduced-motion: reduce`, desactivar `voz-pulse` (envolver el `.listening` en un `@media (prefers-reduced-motion: no-preference)` o agregar la query que anule la animación) para accesibilidad.

**Escenarios de test:**
- En desktop/mobile, el botón 🎤 aparece a la derecha del header de Nueva transacción, alineado con "Carga múltiple", sin overflow (CLAUDE.md: chequear overflow en mobile).
- El panel `#voz-status` está oculto al cargar.
- En el tema de Ama (`[data-theme="light"]`), botón y panel usan colores claros legibles (no hardcoded oscuros).

---

### U3: Módulo base — detección de soporte, ciclo de reconocimiento, estados UI
**Archivo NUEVO:** `src/js/15-captura-voz.js`

**Qué cambia:**

Crear el módulo con: una IIFE/funciones globales (consistente con los otros módulos que exponen funciones globales como `setTipo`). Sin clases si los demás módulos no las usan; preferir funciones + estado a nivel de módulo.

Estructura:

```js
/* ============================================================
   15-captura-voz.js — Captura de transacciones por voz
   Web Speech API (es-AR). Pre-llena el form de #page-nueva.
   No modifica funciones existentes; solo las invoca.
   ============================================================ */

var _vozReconocedor = null;   // instancia SpeechRecognition
var _vozEscuchando = false;

function _vozSoportado() {
  return typeof window !== 'undefined' &&
         (window.SpeechRecognition || window.webkitSpeechRecognition);
}

// Detección de soporte al cargar (KTD-9)
function _vozInit() {
  var btn = document.getElementById('btn-voz');
  if (!btn) return;
  if (!_vozSoportado()) { btn.hidden = true; return; }
  btn.hidden = false;
}

// Estados UI: 'idle' | 'listening' | 'processing' | 'ready' | 'error'
function _vozSetEstado(estado, texto, transcript) {
  var btn = document.getElementById('btn-voz');
  var panel = document.getElementById('voz-status');
  var icon = document.getElementById('voz-status-icon');
  var txt = document.getElementById('voz-status-text');
  var tr  = document.getElementById('voz-transcript');
  if (!btn || !panel) return;

  btn.classList.toggle('listening', estado === 'listening');
  panel.classList.toggle('is-error', estado === 'error');

  if (estado === 'idle') { panel.hidden = true; return; }
  panel.hidden = false;

  var icons = { listening: '🔴', processing: '⏳', ready: '✅', error: '⚠️' };
  icon.textContent = icons[estado] || '';
  txt.textContent = texto || '';
  tr.textContent = transcript ? ('"' + transcript + '"') : '';
}

function toggleCapturaVoz() {
  if (!_vozSoportado()) return;
  if (_vozEscuchando) { _vozDetener(); return; }
  _vozIniciar();
}

function _vozIniciar() {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  _vozReconocedor = new SR();
  _vozReconocedor.lang = 'es-AR';           // KTD-6
  _vozReconocedor.continuous = false;        // KTD-7
  _vozReconocedor.interimResults = false;    // KTD-7
  _vozReconocedor.maxAlternatives = 1;       // KTD-7

  _vozReconocedor.onstart = function () {
    _vozEscuchando = true;
    _vozSetEstado('listening', 'Escuchando… decí el gasto', '');
  };
  _vozReconocedor.onerror = function (e) {
    _vozEscuchando = false;
    var msg = 'No se pudo capturar el audio. Probá de nuevo.';
    if (e && (e.error === 'not-allowed' || e.error === 'service-not-allowed')) {
      msg = 'Permiso de micrófono denegado. Habilitalo en el navegador.';
    } else if (e && e.error === 'no-speech') {
      msg = 'No te escuché. Tocá 🎤 y volvé a intentar.';
    }
    _vozSetEstado('error', msg, '');
  };
  _vozReconocedor.onend = function () { _vozEscuchando = false; };
  _vozReconocedor.onresult = function (e) {
    var transcript = (e.results[0][0].transcript || '').trim();
    _vozSetEstado('processing', 'Procesando…', transcript);
    _vozProcesarTranscript(transcript);   // definido en U4/U5
  };

  try { _vozReconocedor.start(); }
  catch (err) { _vozSetEstado('error', 'No se pudo iniciar el micrófono.', ''); }
}

function _vozDetener() {
  if (_vozReconocedor) { try { _vozReconocedor.stop(); } catch (e) {} }
  _vozEscuchando = false;
  _vozSetEstado('idle', '', '');
}
```

**Inicialización:** `_vozInit()` debe llamarse cuando el DOM y las globales del usuario están listos. Patrón seguro: agregar la llamada al final del flujo de arranque post-login (CLAUDE.md §2: `_renderApp()`), o un `DOMContentLoaded` defensivo dentro del módulo que solo toca el botón. Dado que el botón está en el DOM estático del template, un listener `DOMContentLoaded` que llame `_vozInit()` es suficiente y autónomo (no depende de `USUARIO`). **Decisión:** usar `DOMContentLoaded` dentro del módulo para no acoplar con `_renderApp()`.

**Escenarios de test:**
- Navegador sin Web Speech API (simular borrando `window.SpeechRecognition` y `webkitSpeechRecognition`) → botón queda `hidden`, nada se rompe.
- Navegador con soporte → botón visible.
- Presionar 🎤 → estado "Escuchando", botón con clase `listening` (pulse). Presionar de nuevo → vuelve a idle (`_vozDetener`).
- Denegar permiso de micrófono → estado error con mensaje de permiso.
- Hablar sin que se detecte voz (`no-speech`) → mensaje "No te escuché".

---

### U4: Parser de voz
**Archivo:** `src/js/15-captura-voz.js`

**Qué cambia:**

Función pura `_vozParsear(textoOriginal)` que devuelve un objeto con los campos detectados y la descripción residual. No toca el DOM (testeable de forma aislada).

```js
function _vozParsear(textoOriginal) {
  var texto = (textoOriginal || '').toLowerCase().trim();
  var resto = ' ' + texto + ' ';          // padding para reemplazos por palabra
  var out = { monto: null, tipo: 'Gasto', categoria: null,
              responsabilidad: null, fuente: null, descripcion: '' };

  function quitar(frase) { resto = resto.replace(new RegExp('\\b' + frase + '\\b', 'g'), ' '); }

  // ---- 1. MONTO (KTD-5): dígitos directos primero, luego palabras ----
  var mNum = resto.match(/\b(\d{1,3}(?:[.\s]\d{3})*|\d+)([,.]\d+)?\b/);
  if (mNum) {
    out.monto = parseFloat(mNum[0].replace(/[.\s]/g, '').replace(',', '.'));
    quitar(mNum[0].replace(/[.]/g, '\\.'));
  } else {
    var palabras = _vozMontoEnPalabras(resto);   // devuelve {valor, frase} o null
    if (palabras) { out.monto = palabras.valor; resto = resto.replace(palabras.frase, ' '); }
  }

  // ---- 2. TIPO ----
  if (/\b(ingreso|sueldo|cobr[eé]|me pagaron|deposit)/.test(texto)) out.tipo = 'Ingreso';
  // (default Gasto)

  // ---- 3. CATEGORÍA: keyword match contra array global según tipo ----
  var cats = (out.tipo === 'Ingreso') ? categIngreso : categGasto;
  out.categoria = _vozMatchLista(resto, cats, /* sinonimos */ _VOZ_SINONIMOS_CATEG);
  if (out.categoria) quitar(_vozNorm(out.categoria));

  // ---- 4. RESPONSABILIDAD ----
  if (/\bcompartido\b|\bjuntos\b/.test(resto)) { out.responsabilidad = 'Compartido'; quitar('compartido'); quitar('juntos'); }
  else if (/\bm[ií]o\b|\bsolo m[ií]o\b/.test(resto)) { out.responsabilidad = 'Mío'; quitar('solo'); quitar('m[ií]o'); }
  else {
    // "de <nombre>": usar USUARIO/PARTNER dinámicos (CLAUDE.md: nunca hardcodear)
    var rx = new RegExp('\\bde\\s+(' + _vozNorm(USUARIO) + '|' + _vozNorm(PARTNER) + ')\\b');
    var mDe = resto.match(rx);
    if (mDe) { out.responsabilidad = 'De ' + (/* capitalizar al nombre canónico */ _vozNombreCanonico(mDe[1])); quitar('de\\s+' + mDe[1]); }
  }

  // ---- 5. FUENTE: keyword match contra categFuentes ----
  out.fuente = _vozMatchLista(resto, categFuentes, _VOZ_SINONIMOS_FUENTE);
  if (out.fuente) quitar(_vozNorm(out.fuente));

  // ---- 6. DESCRIPCIÓN: lo que queda (KTD-13) ----
  out.descripcion = resto.replace(/\s+/g, ' ').trim();

  return out;
}
```

Helpers a implementar en el mismo módulo:

- `_vozMontoEnPalabras(str)` — tabla de números en español. Soporta unidades (uno…nueve), diez–quince, veinte/treinta/…/noventa, "cien"/"ciento", doscientos…novecientos, "mil", y composición simple "mil quinientos" = 1500, "dos mil" = 2000, "mil doscientos cincuenta" = 1250. Devuelve `{valor, frase}` con la frase exacta consumida (para removerla del resto). Acotar a montos realistas (hasta cientos de miles); no hace falta cubrir millones.
- `_vozMatchLista(str, lista, sinonimos)` — normaliza (sin tildes, lower) y busca cada item de la lista (y sus sinónimos) como substring por palabra; devuelve el **valor canónico** de la lista (no el sinónimo). Primer match gana; si hay empate, el item más largo (más específico) gana.
- `_vozNorm(s)` — lower + quita tildes (`normalize('NFD').replace(/[̀-ͯ]/g,'')`).
- `_vozNombreCanonico(n)` — mapea el nombre reconocido al valor canónico (`USUARIO`/`PARTNER`) respetando capitalización de la BD.
- `_VOZ_SINONIMOS_CATEG` / `_VOZ_SINONIMOS_FUENTE` — mapas opcionales de sinónimos hablados → valor canónico (ej: "super"/"supermercado" → "Alimentación"; "débito"/"tarjeta de débito" → "Débito"; "efe" → "Efectivo"). Mantener corto y editable.

**Notas:**
- El orden importa: monto y responsabilidad/fuente se extraen y se *quitan* del `resto` antes de derivar la descripción (KTD-13), para que la descripción no repita esos tokens.
- Categoría se matchea contra `categGasto`/`categIngreso` reales del usuario (globales), no contra una lista fija → respeta categorías personalizadas.
- Todo case-insensitive y sin tildes para tolerar el output del reconocedor.

**Escenarios de test (sobre `_vozParsear`, sin DOM):**
- "quinientos super compartido débito" → `{monto:500, tipo:'Gasto', categoria:'Alimentación', responsabilidad:'Compartido', fuente:'Débito', descripcion:'super'}` (o descripción vacía si "super" es sinónimo consumido — definir cuál; preferible consumir el sinónimo de categoría).
- "mil quinientos nafta" → `{monto:1500, categoria:<match transporte/auto si existe>, ...}`.
- "1500 alquiler mío" → `{monto:1500, categoria:'Alquiler', responsabilidad:'Mío'}`.
- "cobré sueldo cincuenta mil" → `{tipo:'Ingreso', categoria:'Sueldo', monto:50000}`.
- "doscientos efectivo" → `{monto:200, fuente:'Efectivo'}`.
- "de daniel mil café" (cuando PARTNER='Daniel') → `responsabilidad:'De Daniel'`, monto 1000.
- Texto sin número ("compré cosas") → `monto:null` (U5 maneja el error).
- Números con separador de miles dictado como "mil doscientos cincuenta" → 1250; y "1.250" en dígitos → 1250.

---

### U5: Pre-llenado del formulario
**Archivo:** `src/js/15-captura-voz.js`

**Qué cambia:**

`_vozProcesarTranscript(transcript)` toma el resultado de `_vozParsear` y rellena el form usando las funciones/elementos existentes. **No** llama `guardarTransaccion()` (KTD-3).

```js
function _vozProcesarTranscript(transcript) {
  var p = _vozParsear(transcript);

  // KTD-10: sin monto, no pre-llenamos de forma confusa → error orientativo
  if (p.monto === null || isNaN(p.monto)) {
    _vozSetEstado('error',
      'No detecté un monto. Probá: "quinientos super compartido débito".',
      transcript);
    return;
  }

  // Tipo (funciones existentes — 05-transacciones.js)
  if (typeof setTipo === 'function') setTipo(p.tipo);

  // Monto: respetar el input type="text" inputmode="decimal" + formatearMiles
  var inMonto = document.getElementById('f-monto');
  if (inMonto) {
    inMonto.value = String(p.monto).replace('.', ',');   // coma argentina
    if (typeof formatearMiles === 'function') formatearMiles(inMonto);
  }

  // Categoría: setear el <select> solo si el valor existe como opción
  _vozSetSelect('f-categoria', p.categoria);

  // Responsabilidad: usar seleccionarResp (12-inversiones.js) si hay valor
  if (p.responsabilidad && typeof seleccionarResp === 'function') {
    seleccionarResp(p.responsabilidad);
  }

  // Fuente
  _vozSetSelect('f-fuente', p.fuente);

  // Descripción (textarea)
  var inDesc = document.getElementById('f-descripcion');
  if (inDesc && p.descripcion) inDesc.value = p.descripcion;

  // Resumen de lo entendido + recordatorio de revisar
  var resumen = '$' + p.monto + (p.categoria ? ' · ' + p.categoria : '') +
                (p.fuente ? ' · ' + p.fuente : '');
  _vozSetEstado('ready', 'Listo: ' + resumen + '. Revisá y guardá.', transcript);
}

// Setea un <select> solo si el valor existe como <option> (case/tilde-insensitive)
function _vozSetSelect(id, valor) {
  if (!valor) return false;
  var sel = document.getElementById(id);
  if (!sel) return false;
  var objetivo = _vozNorm(valor);
  for (var i = 0; i < sel.options.length; i++) {
    if (_vozNorm(sel.options[i].value) === objetivo) { sel.selectedIndex = i; return true; }
  }
  return false;
}
```

**Notas de integración (verificadas en el código):**
- `setTipo` y `setMoneda` están en `src/js/05-transacciones.js`; `seleccionarResp` y `resetRespField` en `src/js/12-inversiones.js`. Como `build.sh` concatena por orden alfabético, `15-captura-voz.js` se concatena **después** de todos ellos → las funciones ya están definidas en el scope global al ejecutarse. Aun así, se usan guards `typeof fn === 'function'` por robustez.
- `#f-monto` es `type="text" inputmode="decimal"` con `oninput="formatearMiles(this); ..."`. Asignar el valor con coma y llamar `formatearMiles` replica el formateo que haría el usuario tipeando.
- `#f-responsabilidad` se puebla dinámicamente (`inicializarRespButtons`); por eso se usa `seleccionarResp(valor)` con el valor canónico ("Mío"/"Compartido"/"De "+PARTNER) — el mismo que usa el flujo de duplicar (CLAUDE.md §5).
- No se toca la moneda por voz en este scope: queda el default actual (`setMoneda('ARS')`). (El parser no detecta USD; si más adelante se quiere, agregar regex "dólares/USD" → `setMoneda('USD')`.)
- No se resetea nada del form que el usuario ya haya tocado salvo los campos detectados; el dictado *completa*, no borra todo.

**Escenarios de test:**
- Dictar "quinientos super compartido débito" → `#f-monto` muestra "500" formateado, tipo Gasto activo, `#f-categoria`=Alimentación, responsabilidad=Compartido, `#f-fuente`=Débito, descripción con el residual; estado "Listo… Revisá y guardá".
- La categoría dictada no existe como opción → `#f-categoria` queda sin cambiar (no rompe), resto se llena igual.
- Dictar algo sin monto → estado error con el ejemplo; ningún campo se modifica.
- Tras pre-llenar, presionar el botón Guardar existente → `guardarTransaccion()` corre normal con los valores pre-llenados (el form no quedó en estado inválido).
- Dictar un ingreso → toggle cambia a Ingreso y `#f-categoria` se evalúa contra `categIngreso`.
- En Ama (tema claro) el flujo funciona igual; `seleccionarResp` muestra labels con `PARTNER` correcto.

---

### U6: Integración build + verificación end-to-end
**Archivos:** `build.sh` (verificación), `index.html` (generado)

**Qué cambia:**

1. **build.sh** no requiere edición: usa `sorted(glob.glob("src/js/*.js"))`, así que `15-captura-voz.js` entra automáticamente en orden alfabético (después de `14-metas-ahorro.js`). Verificar que la corrida lo lista.

2. Correr `./build.sh` y confirmar:
   - La salida lista `15-captura-voz.js` con su conteo de líneas.
   - `index.html` regenerado incluye el código del módulo y el markup nuevo del template.

3. Smoke test manual en preview de Vercel (CLAUDE.md: feature branch → preview):
   - Header `Permissions-Policy` con `microphone=(self)`.
   - Botón 🎤 visible en Nueva transacción (Chrome desktop, Android Chrome, Safari iOS).
   - Flujo completo de dictado → pre-llenado → guardar.
   - En un navegador sin la API, el botón no aparece y el form a mano sigue funcionando.

**Escenarios de test:**
- `./build.sh` corre sin error y reporta 15 módulos.
- `grep -c "15-captura-voz" index.html` o búsqueda de una función del módulo (`toggleCapturaVoz`) en `index.html` → presente.
- Editar `src/index.template.html` / `src/js/15-captura-voz.js` y rebuild → cambios reflejados (recordatorio CLAUDE.md: editar en `src/`, nunca en `index.html` directo).

---

## Checklist de cierre

- [ ] U1 `vercel.json` → `microphone=(self)`
- [ ] U2 markup botón + panel + CSS (tema claro y oscuro, `prefers-reduced-motion`)
- [ ] U3 módulo: soporte, ciclo de reconocimiento, estados
- [ ] U4 parser puro con tests de los escenarios listados
- [ ] U5 pre-llenado vía funciones existentes, sin auto-guardar
- [ ] U6 `./build.sh` incluye el módulo; smoke test en preview Chrome + Safari iOS
- [ ] Degradación elegante verificada (sin API → botón oculto)
- [ ] Commit en feature branch → push → verificar preview (workflow CLAUDE.md)

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Safari iOS tiene soporte parcial/variable de Web Speech API | Probar explícitamente en iOS; si falla, el botón se oculta por la detección de soporte (no rompe nada). |
| Reconocimiento de montos en palabras es frágil en español | Dígitos directos como camino primario; palabras como complemento. Sin monto → error claro, no transacción inválida. |
| Categoría/fuente mal matcheadas | Solo se setea el select si el valor existe como opción; el usuario revisa antes de guardar (KTD-3). |
| Nombres de variables CSS asumidos | Confirmar `--red/--bg2/--text-dim/--card/--border/--text` en el `<style>` antes de pegar el CSS de U2. |
| Permiso de micrófono denegado | `onerror` con mensaje orientativo; no bloquea el form manual. |
