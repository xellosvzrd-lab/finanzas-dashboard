# Signup directo (email o Google) sin invitación previa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que cualquier persona cree su **propio** workspace desde la pantalla de login sin necesidad de un link de invitación, con dos caminos (email+contraseña, que ya existe, y Google, nuevo), y que el botón de Google cree la cuenta en vez de rechazarla **solo** cuando la persona llegó explícitamente desde "Crear cuenta nueva".

**Architecture:** Todo vive en el único `index.html` (sin build pipeline, JS/HTML/CSS inline). Se introduce un flag efímero `sessionStorage['fp_signup_intent'] = '1'`, seteado justo antes del redirect de OAuth en la nueva función `guardarRegistroGoogle()` y consumido una sola vez dentro de `_configurarUsuario()`. El gate anti-cuenta-huérfana agregado en `b7d73c0` (`isGoogleOnly && !metaNombre`) se mantiene intacto para el botón de Google del login normal (`guardarConfigGoogle()`); se le agrega la excepción `&& !intentaCrearCuenta`. No hay migración de base de datos — el trigger `handle_new_user()` en Supabase ya crea un workspace propio en cada alta de `auth.users`.

**Tech Stack:** JS/HTML/CSS vanilla en `index.html`. Supabase Auth (`signInWithOAuth`, `getSession`). `sessionStorage` para la intención de signup. Sin tests automatizados (single-file) — verificación manual en navegador + syntax-check de bloques `<script>` con Node.

## Global Constraints

- Sin build pipeline, sin frameworks, sin npm — todo vive en `index.html` (de `CLAUDE.md`, sección "Project Architecture").
- **Los números de línea de este plan son de referencia PRE-implementación.** Cada edit se aplica por coincidencia de string exacta, no por número de línea, porque las Tasks 1 y 2 agregan líneas que corren el resto del archivo. Aplicar las tasks en orden.
- Spec de referencia (fuente de verdad): `docs/superpowers/specs/2026-07-09-signup-directo-google-design.md` (aprobado).
- **Decisión sobre dónde se setea `fp_signup_intent`:** el flag se setea **únicamente dentro de `guardarRegistroGoogle()`**, inmediatamente antes de iniciar el OAuth. NO se setea en `mostrarRegistro()`. (La sección de diseño de la spec menciona ambos lugares de forma redundante; se resuelve a favor de la variante más ajustada y segura: si se seteara en `mostrarRegistro()`, alguien que entra a registro, vuelve al login con `mostrarLogin()` — que no limpia el flag — y toca el botón de Google normal, se saltearía el gate. Setearlo justo antes del redirect evita ese caso.)
- El flag se **consume una sola vez**: `_configurarUsuario()` lo lee a un `const` y lo borra con `sessionStorage.removeItem('fp_signup_intent')` inmediatamente, antes de decidir aceptar o rechazar.
- Identificadores exactos a usar: función `guardarRegistroGoogle`; id del botón `btn-google-registro`; id del div de resultado `registro-google-result`; id del nuevo link de login `login-signup-nuevo-link`; clave de sessionStorage `fp_signup_intent`; variable local en `_configurarUsuario` `intentaCrearCuenta`.
- Copy exacto del nuevo link de login: `¿No tenés cuenta?` + link `Creá una nueva →`.
- El nuevo link de login es **siempre visible** y convive con el link condicional de invitación existente (`login-crear-cuenta-link`, `display:none`) — no lo reemplaza ni lo oculta.
- El botón de Google en registro reutiliza el **mismo SVG inline** y las mismas clases (`btn btn-google`, `login-divider`) que el botón de `card-login`.
- La función `guardarRegistroGoogle()` reutiliza los helpers existentes `_esNavegadorEmbebido()` y `_MENSAJE_NAVEGADOR_EMBEBIDO` — NO se duplican ni modifican.
- **Fuera de alcance — NO tocar:** `vincularGoogle()` (vincular Google a cuenta de email existente); el botón de Google del login normal `guardarConfigGoogle()` (salvo confirmar que sigue sin setear el flag); el flujo de invitación a pareja (`?invite=TOKEN`, `aceptarInvitacionPendiente()`, `accept_workspace_invite`); cualquier cambio de base de datos o migración.

**Syntax-check (correr verbatim como verificación en cada task de código):**

```bash
node -e '
const fs=require("fs");
const html=fs.readFileSync("index.html","utf8");
const re=/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m,i=0,bad=0;
while((m=re.exec(html))){i++;try{new Function(m[1]);}catch(e){bad++;console.error("Block #"+i+" FAIL: "+e.message);}}
console.log("Checked "+i+" inline <script> blocks, "+bad+" with errors.");
process.exit(bad?1:0);
'
```
Salida esperada: `Checked 2 inline <script> blocks, 0 with errors.` (exit 0). Si reporta errores o un conteo distinto que incluye un fallo, el edit rompió un template literal o una etiqueta — arreglar antes de commitear.

Footer obligatorio en todos los commits:
```
Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```

---

## Task 1: Link "Creá una nueva →" siempre visible en `card-login`

Agrega el punto de entrada general a "Crear cuenta", independiente de la invitación a pareja.

**Files:**
- Modify: `index.html:2533-2536` (`card-login` — links debajo de `#test-result`)

**Interfaces:**
- Consumes: `mostrarRegistro()` (ya existe, `index.html:4295`).
- Produces: elemento `#login-signup-nuevo-link`.

- [ ] **Step 1: Insertar el nuevo link debajo del link de invitación existente**

Ubicar (líneas ~2533-2536):
```html
    <div id="login-crear-cuenta-link" style="display:none;margin-top:.5rem;font-size:.83rem;color:var(--text-muted)">
      ¿Te invitaron a un workspace? <a href="#" onclick="mostrarRegistro();return false">Creá tu cuenta acá</a>
    </div>
    <div id="aviso-navegador-embebido" style="display:none;margin-top:.5rem;font-size:.83rem;color:var(--red)">
```
Reemplazar por (inserta el nuevo div entre ambos; el link de invitación queda intacto):
```html
    <div id="login-crear-cuenta-link" style="display:none;margin-top:.5rem;font-size:.83rem;color:var(--text-muted)">
      ¿Te invitaron a un workspace? <a href="#" onclick="mostrarRegistro();return false">Creá tu cuenta acá</a>
    </div>
    <div id="login-signup-nuevo-link" style="margin-top:.5rem;font-size:.83rem;color:var(--text-muted)">
      ¿No tenés cuenta? <a href="#" onclick="mostrarRegistro();return false">Creá una nueva →</a>
    </div>
    <div id="aviso-navegador-embebido" style="display:none;margin-top:.5rem;font-size:.83rem;color:var(--red)">
```

- [ ] **Step 2: Syntax-check**

Correr el snippet de Node de "Global Constraints". Esperado: `Checked 2 inline <script> blocks, 0 with errors.`

- [ ] **Step 3: Verificar en navegador**

Abrir la app sin ningún query param (`?invite`) ni sesión. En `card-login`:
- El link "¿No tenés cuenta? Creá una nueva →" debe verse siempre (no depende de invitación).
- El link "¿Te invitaron a un workspace? Creá tu cuenta acá" debe seguir **oculto** (su `display:none` no cambió).
- Tocar "Creá una nueva →" debe mostrar `card-registro` (login se oculta). Confirmar en DevTools:
```js
getComputedStyle(document.getElementById('card-registro')).display; // "block" o "" (visible)
getComputedStyle(document.getElementById('card-login')).display;     // "none"
```

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(auth): link \"Creá una nueva\" siempre visible en el login

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Botón "Continuar con Google" en `card-registro` + `guardarRegistroGoogle()`

Agrega el segundo camino de alta (Google) a la pantalla de crear cuenta y la función que lo dispara.

**Files:**
- Modify: `index.html:2570-2571` (`card-registro` — después de `#registro-result`)
- Modify: `index.html:4223-4225` (nueva función entre `guardarConfigGoogle` y `vincularGoogle`)

**Interfaces:**
- Consumes: `_esNavegadorEmbebido()` (`index.html:4200`), `_MENSAJE_NAVEGADOR_EMBEBIDO` (`index.html:4199`), `escapeHtml()` (existente), `supabaseClient.auth.signInWithOAuth`.
- Produces: función global `guardarRegistroGoogle()`; elementos `#btn-google-registro`, `#registro-google-result`; escribe/borra `sessionStorage['fp_signup_intent']`.

- [ ] **Step 1: Agregar el divisor + botón de Google al final de `card-registro`**

Ubicar (líneas ~2570-2571, el cierre de `card-registro`):
```html
    <div id="registro-result"></div>
  </div>
```
Reemplazar por (mismo patrón visual y SVG que `card-login`):
```html
    <div id="registro-result"></div>
    <div class="login-divider">o</div>
    <button class="btn btn-google" id="btn-google-registro" onclick="guardarRegistroGoogle()">
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
        <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 6.294C4.672 4.169 6.656 3.58 9 3.58z" fill="#EA4335"/>
      </svg>
      Continuar con Google
    </button>
    <div id="registro-google-result" style="margin-top:.4rem;font-size:.82rem"></div>
  </div>
```

- [ ] **Step 2: Agregar `guardarRegistroGoogle()` entre `guardarConfigGoogle` y `vincularGoogle`**

Ubicar (líneas ~4218-4225, el cierre de `guardarConfigGoogle` y el inicio de `vincularGoogle`):
```js
  if (error) {
    res.innerHTML = `<span class="fail">❌ ${escapeHtml(error.message)}</span>`;
    btn.disabled = false;
    btn.querySelector('svg').nextSibling.textContent = ' Continuar con Google';
  }
}

async function vincularGoogle() {
```
Reemplazar por (inserta la función nueva entre ambas; `guardarConfigGoogle` y `vincularGoogle` quedan intactas):
```js
  if (error) {
    res.innerHTML = `<span class="fail">❌ ${escapeHtml(error.message)}</span>`;
    btn.disabled = false;
    btn.querySelector('svg').nextSibling.textContent = ' Continuar con Google';
  }
}

async function guardarRegistroGoogle() {
  sessionStorage.setItem('fp_signup_intent', '1');
  const btn = document.getElementById('btn-google-registro');
  const res = document.getElementById('registro-google-result');
  if (_esNavegadorEmbebido()) {
    res.innerHTML = `<span class="fail">${_MENSAJE_NAVEGADOR_EMBEBIDO}</span>`;
    sessionStorage.removeItem('fp_signup_intent');
    return;
  }
  btn.disabled = true;
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
  if (error) {
    sessionStorage.removeItem('fp_signup_intent');
    res.innerHTML = `<span class="fail">❌ ${escapeHtml(error.message)}</span>`;
    btn.disabled = false;
  }
}

async function vincularGoogle() {
```

- [ ] **Step 3: Syntax-check**

Correr el snippet de Node de "Global Constraints". Esperado: `Checked 2 inline <script> blocks, 0 with errors.` Si reporta un fallo, revisar el template literal de `res.innerHTML` recién agregado.

- [ ] **Step 4: Verificar en navegador**

1. Ir a login → tocar "Creá una nueva →" → en `card-registro` deben verse: los inputs de email/contraseña, el botón "Crear cuenta →", el divisor "o" y el botón "Continuar con Google" con el ícono de Google.
2. En DevTools, confirmar que la función y los elementos existen y que el flag arranca sin setear:
```js
typeof guardarRegistroGoogle;                     // "function"
!!document.getElementById('btn-google-registro'); // true
sessionStorage.getItem('fp_signup_intent');       // null (antes de tocar el botón)
```
3. (Opcional, si hay una cuenta de Google de prueba) Tocar "Continuar con Google": el botón debe quedar `disabled` y arrancar el redirect de OAuth. Antes de que el navegador redirija, `sessionStorage.getItem('fp_signup_intent')` debe ser `"1"`. El resultado end-to-end (llegar al modal de nombre) se valida en la Task 4, que necesita el cambio de la Task 3.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(auth): botón \"Continuar con Google\" en la pantalla de crear cuenta

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Excepción de signup en `_configurarUsuario()`

Consume el flag `fp_signup_intent` y agrega la excepción al gate anti-cuenta-huérfana.

**Files:**
- Modify: `index.html:4511-4515` (inicio de `_configurarUsuario`, lectura del flag + condición del gate)

**Interfaces:**
- Consumes: `sessionStorage['fp_signup_intent']` (producido por Task 2).
- Produces: nada nuevo — solo cambia el comportamiento del gate `isGoogleOnly`.

- [ ] **Step 1: Leer y consumir el flag, y relajar la condición del gate**

Ubicar (líneas ~4511-4515, el inicio del cuerpo de `_configurarUsuario`):
```js
  const metaNombre   = session.user.user_metadata?.nombre;
  const metaEmojis   = session.user.user_metadata?.cat_emojis;
  const isGoogleOnly = session.user.app_metadata?.provider === 'google'
                    && !session.user.app_metadata?.providers?.includes('email');
  if (isGoogleOnly && !metaNombre) {
```
Reemplazar por:
```js
  const metaNombre   = session.user.user_metadata?.nombre;
  const metaEmojis   = session.user.user_metadata?.cat_emojis;
  const intentaCrearCuenta = sessionStorage.getItem('fp_signup_intent') === '1';
  sessionStorage.removeItem('fp_signup_intent');
  const isGoogleOnly = session.user.app_metadata?.provider === 'google'
                    && !session.user.app_metadata?.providers?.includes('email');
  if (isGoogleOnly && !metaNombre && !intentaCrearCuenta) {
```

> El resto del bloque del gate (`supabaseClient.auth.signOut()`, el mensaje de "vinculá tu cuenta", `return false`) queda **sin cambios**. Cuando `intentaCrearCuenta` es `true`, el flujo sigue de largo: `_setVariablesUsuario("")` deja `USUARIO` vacío y `iniciarApp()` muestra el modal "¿Cómo te llamás?" de forma legítima; al guardar el nombre, el trigger de Supabase ya creó el workspace propio.

- [ ] **Step 2: Syntax-check**

Correr el snippet de Node de "Global Constraints". Esperado: `Checked 2 inline <script> blocks, 0 with errors.`

- [ ] **Step 3: Verificar que el flag se consume una sola vez (DevTools)**

Con una sesión ya iniciada (cualquier usuario), en la consola:
```js
sessionStorage.setItem('fp_signup_intent','1');
await _configurarUsuario(supabaseSession);
sessionStorage.getItem('fp_signup_intent'); // null — se consumió y borró
```
(No debe haber errores en consola. Recargar después para volver al estado real.)

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(auth): excepcion de signup con Google cuando se viene de \"crear cuenta\"

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Verificación integral (sin commit)

Confirma el comportamiento end-to-end y que ningún camino existente sufrió regresión.

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Grep de identificadores nuevos y de aislamiento**

```bash
grep -n "guardarRegistroGoogle\|btn-google-registro\|registro-google-result\|login-signup-nuevo-link\|fp_signup_intent\|intentaCrearCuenta" index.html
```
Esperado:
- `guardarRegistroGoogle` → 2 (onclick en HTML + definición).
- `btn-google-registro` → 2 (HTML + `getElementById`).
- `registro-google-result` → 2 (HTML + `getElementById`).
- `login-signup-nuevo-link` → 1 (HTML).
- `fp_signup_intent` → 4 (set + remove en `guardarRegistroGoogle`; read + remove en `_configurarUsuario`).
- `intentaCrearCuenta` → 2 (declaración + uso en la condición).

- [ ] **Step 2: Confirmar que los caminos fuera de alcance NO cambiaron**

```bash
grep -n "fp_signup_intent" index.html | grep -i "guardarConfigGoogle\|vincularGoogle"
```
Esperado: **sin resultados** (ni `guardarConfigGoogle` ni `vincularGoogle` setean el flag). Además confirmar manualmente que `vincularGoogle()` (`index.html` ~4225) y `guardarConfigGoogle()` (~4204) quedaron idénticas a `main`:
```bash
git diff main -- index.html | grep -A2 -B2 "linkIdentity\|guardarConfigGoogle"
```
Esperado: el diff no debe tocar el cuerpo de esas dos funciones.

- [ ] **Step 3: Recorrido funcional — alta nueva con Google (camino feliz)**

En el preview de Vercel (Google OAuth necesita un origin real), con una cuenta de Google que **nunca** usó la app:
1. Entrar sin `?invite`. Tocar "¿No tenés cuenta? Creá una nueva →".
2. En `card-registro`, tocar "Continuar con Google" y completar el consentimiento.
3. Al volver, debe aparecer el modal "¿Cómo te llamás?" (NO el mensaje de rechazo "Esta cuenta de Google no está vinculada…"). Confirmar en la consola: sin errores; `sessionStorage.getItem('fp_signup_intent')` es `null`.
4. Guardar el nombre → la app carga con su propio workspace (vacío), sin el error "Auth session missing!".

- [ ] **Step 4: Recorrido funcional — regresión del login normal**

Con una cuenta de Google nueva (o tras `supabaseClient.auth.signOut()` y limpiar `fp_signup_intent`), en `card-login` tocar directamente "Continuar con Google" **sin** pasar por "Crear cuenta nueva":
- Debe seguir mostrando el rechazo: `❌ Esta cuenta de Google no está vinculada a ningún usuario…` en `#google-login-result`, y `supabaseClient.auth.signOut()` debe haber corrido (queda sin sesión). Comportamiento idéntico a `main`.

- [ ] **Step 5: Recorrido funcional — invitación a pareja intacta**

Abrir la app con `?invite=<token-válido>`:
- El flujo de aceptación de invitación (`aceptarInvitacionPendiente()` / modal / `accept_workspace_invite`) debe funcionar igual que antes. El nuevo flag `fp_signup_intent` no interfiere (puede coexistir con `fp_invite_token`). Confirmar que unirse al workspace del invitador sigue funcionando.

- [ ] **Step 6: Sin commit**

Esta task es solo verificación. Si algo falla, volver a la task correspondiente.
