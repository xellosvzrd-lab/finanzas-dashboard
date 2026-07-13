# USUARIO Dinámico — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que `USUARIO` se determine dinámicamente desde la sesión Supabase, con un prompt self-service la primera vez si `user_metadata.nombre` no está seteado.

**Architecture:** Cuando el usuario se loguea, `_configurarUsuario(session)` ya lee `session.user.user_metadata?.nombre`. El problema es que los usuarios Supabase no tienen `nombre` en su metadata → ambos caen en el fallback `"Daniel"`. La solución: si `nombre` falta, mostrar un modal de bienvenida que pida el nombre y lo persista vía `supabaseClient.auth.updateUser({ data: { nombre } })`. Una vez guardado, no vuelve a aparecer.

**Tech Stack:** HTML/CSS/JS vanilla, Supabase JS SDK (`supabaseClient.auth.updateUser`)

---

## Files

- Modify: `index.html` — único archivo. Cambios en 3 zonas:
  1. HTML: modal `#modal-nombre` (después de `#app`)
  2. CSS: estilos del modal (en el bloque `<style>`)
  3. JS: lógica de check y guardado

---

### Task 1: Agregar HTML del modal de nombre

**Files:**
- Modify: `index.html` — zona HTML, después del div `#app`

- [ ] **Step 1: Localizar dónde insertar el modal**

Buscar en `index.html`:
```
</div><!-- /app -->
```
El modal va inmediatamente después de ese cierre.

- [ ] **Step 2: Insertar el HTML del modal**

Agregar después de `</div><!-- /app -->`:

```html
<!-- ── MODAL: setup nombre (primera vez) ──────────── -->
<div id="modal-nombre" style="display:none;position:fixed;inset:0;z-index:9999;
     background:rgba(0,0,0,.7);display:none;align-items:center;justify-content:center;">
  <div style="background:var(--card);border:1px solid var(--border);border-radius:16px;
              padding:2rem;max-width:360px;width:90%;text-align:center;">
    <div style="font-size:2rem;margin-bottom:.5rem;">👋</div>
    <h2 style="margin:0 0 .5rem;font-size:1.2rem;">¿Cómo te llamás?</h2>
    <p style="color:var(--text-muted);font-size:.85rem;margin:0 0 1.25rem;">
      Lo usamos para separar tus gastos de los de tu pareja. Solo la primera vez.
    </p>
    <input type="text" id="input-nombre" placeholder="Ej: Daniel o Ama"
           style="width:100%;box-sizing:border-box;padding:.65rem .9rem;border-radius:8px;
                  border:1px solid var(--border);background:var(--bg2);color:var(--text);
                  font-size:1rem;margin-bottom:1rem;"
           onkeydown="if(event.key==='Enter') guardarNombre()">
    <button class="btn btn-primary" style="width:100%" onclick="guardarNombre()">
      Guardar →
    </button>
    <div id="modal-nombre-msg" style="margin-top:.75rem;font-size:.82rem;min-height:1rem;"></div>
  </div>
</div>
```

- [ ] **Step 3: Verificar que el HTML está bien formado**

Abrir `index.html` en el navegador y confirmar que no hay errores de sintaxis en la consola (el modal no debe ser visible todavía).

---

### Task 2: Agregar lógica JS de check y guardado

**Files:**
- Modify: `index.html` — zona JS, cerca de `_configurarUsuario`

- [ ] **Step 1: Modificar `_configurarUsuario` para detectar nombre faltante**

Localizar esta línea en `_configurarUsuario` (aprox. línea 2314):
```javascript
  USUARIO = session.user.user_metadata?.nombre || "Daniel";
```

Reemplazar con:
```javascript
  const metaNombre = session.user.user_metadata?.nombre;
  USUARIO = metaNombre || "";   // vacío si no está configurado
```

- [ ] **Step 2: Agregar check post-login en `iniciarApp`**

Localizar la función `iniciarApp()` (buscar `async function iniciarApp`). Al final de esa función, antes del cierre `}`, agregar:

```javascript
  // Si el nombre no está configurado, mostrar modal de bienvenida
  if (!USUARIO) {
    document.getElementById("modal-nombre").style.display = "flex";
    document.getElementById("input-nombre").focus();
    return;  // no continuar cargando datos hasta que tenga nombre
  }
```

- [ ] **Step 3: Agregar función `guardarNombre`**

Agregar esta función cerca de `_configurarUsuario`:

```javascript
async function guardarNombre() {
  const input = document.getElementById("input-nombre");
  const msg   = document.getElementById("modal-nombre-msg");
  const nombre = input.value.trim();

  if (!nombre) {
    msg.innerHTML = '<span style="color:var(--red)">Escribí tu nombre primero.</span>';
    return;
  }

  msg.innerHTML = '⏳ Guardando...';

  const { error } = await supabaseClient.auth.updateUser({
    data: { nombre }
  });

  if (error) {
    msg.innerHTML = `<span style="color:var(--red)">Error: ${error.message}</span>`;
    return;
  }

  // Actualizar variables globales
  USUARIO = nombre;
  PARTNER = USUARIO.toLowerCase() === "daniel" ? "Ama" : "Daniel";
  CATS_INGRESO_REAL = USUARIO.toLowerCase() === "ama"
    ? ["Sueldo", "Otros Ingresos", "Intereses"]
    : ["Sueldo", "Otros Ingresos"];
  categResponsabilidad = ["Mío", "Compartido", "De " + PARTNER];

  // Ocultar modal y continuar
  document.getElementById("modal-nombre").style.display = "none";
  _actualizarStringsUsuario();
  iniciarApp();
}
```

- [ ] **Step 4: Extraer `_actualizarStringsUsuario` de `_configurarUsuario`**

Extraer la parte de actualización de HTML de `_configurarUsuario` a una función separada para poder llamarla también desde `guardarNombre`. 

Localizar `_configurarUsuario` y separar así:

```javascript
function _configurarUsuario(session) {
  const metaNombre = session.user.user_metadata?.nombre;
  USUARIO = metaNombre || "";
  PARTNER = USUARIO.toLowerCase() === "daniel" ? "Ama" : "Daniel";
  CATS_INGRESO_REAL = USUARIO.toLowerCase() === "ama"
    ? ["Sueldo", "Otros Ingresos", "Intereses"]
    : ["Sueldo", "Otros Ingresos"];
  categResponsabilidad = ["Mío", "Compartido", "De " + PARTNER];
  if (USUARIO) _actualizarStringsUsuario();
}

function _actualizarStringsUsuario() {
  const tit = document.getElementById("comp-titulo");
  if (tit) tit.textContent = "👫 Compartidos con " + PARTNER;
  const nota = document.getElementById("comp-nota");
  if (nota) nota.textContent = `* Neto por categoría: positivo = ${PARTNER} te debe · negativo = vos le debés a ${PARTNER}.`;
  const thU = document.getElementById("comp-th-usuario");
  if (thU) thU.textContent = USUARIO;
  const thP = document.getElementById("comp-th-partner");
  if (thP) thP.textContent = PARTNER;
  const gastSub = document.getElementById("pres-kpi-gastado-sub");
  if (gastSub) gastSub.textContent = `50% compartidos · sin "De ${PARTNER}"`;
  const noteP = document.getElementById("pres-note-partner");
  if (noteP) noteP.textContent = "De " + PARTNER;
  const usdCard = document.getElementById("pres-kpi-usd-card");
  if (usdCard) {
    usdCard.style.display = USUARIO.toLowerCase() === "ama" ? "" : "none";
    const grid = document.getElementById("pres-kpi-grid");
    if (grid) {
      grid.className = USUARIO.toLowerCase() === "ama" ? "kpi-grid kpi-grid-5" : "kpi-grid kpi-grid-4";
    }
  }
  document.getElementById("sidebar-user").textContent = USUARIO;
}
```

**Nota:** Reemplazar las comparaciones `USUARIO === "Ama"` y `USUARIO === "Daniel"` con `.toLowerCase() === "ama"` / `.toLowerCase() === "daniel"` para ser case-insensitive.

- [ ] **Step 5: Verificar comparaciones USUARIO en el resto del archivo**

Buscar en `index.html`:
```
USUARIO === "Ama"
USUARIO === "Daniel"
```

Para cada ocurrencia verificar si corresponde comparar con `.toLowerCase()` (para comparaciones de identidad del usuario actual) vs. mantener igual (para comparaciones de datos de transacciones que ya vienen normalizados).

Las comparaciones de **identidad** que deben volverse case-insensitive:
- `if (USUARIO === "Ama")` en `actualizarKpisPres`, `renderPresupuesto`, `renderAnual`
- Reemplazar con `USUARIO.toLowerCase() === "ama"`

Las comparaciones de **datos de transacciones** como `(t.usuario || "Daniel") === USUARIO` son correctas tal como están (los datos en la BD son "Daniel" o "Ama" normalizados).

- [ ] **Step 6: Commit intermedio**

```bash
git checkout -b feature/usuario-dinamico
git add index.html
git commit -m "feat: prompt self-service de nombre en primer login

Si user_metadata.nombre no está seteado en Supabase,
muestra modal de bienvenida. Guarda con auth.updateUser
para que no vuelva a aparecer."
```

---

### Task 3: Actualizar CLAUDE.md

**Files:**
- Modify: `index.html` — no, es CLAUDE.md

- [ ] **Step 1: Actualizar sección de variables globales en CLAUDE.md**

Encontrar en CLAUDE.md:
```
let USUARIO = "";          // "Daniel" o "Ama"
```

Actualizar la descripción para reflejar el flujo actual:
```
let USUARIO = "";          // Set por _configurarUsuario() desde session.user.user_metadata.nombre
                           // Si no está en metadata → modal de bienvenida → guardarNombre()
let PARTNER = "";          // Derivado de USUARIO. "Ama" si USUARIO es "Daniel", y viceversa
```

- [ ] **Step 2: Actualizar sección de arquitectura**

Actualizar la descripción de los dos dashboards → ya no hay dos dashboards, hay uno unificado con login Supabase.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: actualizar CLAUDE.md — dashboard unificado, USUARIO dinámico"
```

---

### Task 4: Test manual y PR

- [ ] **Step 1: Probar flujo de Daniel**

1. Abrir la app en modo incógnito (sin sesión guardada)
2. Loguearse como Daniel
3. Si aparece el modal → tipear "Daniel" → Guardar
4. Verificar: `sidebar-user` muestra "Daniel", filtros de transacciones muestran las de Daniel

- [ ] **Step 2: Probar flujo de Ama**

1. Cerrar sesión (`volverConfig()`)
2. Loguearse como Ama
3. Si aparece el modal → tipear "Ama" → Guardar
4. Verificar: `sidebar-user` muestra "Ama", KPI USD card visible, filtros muestran las de Ama

- [ ] **Step 3: Verificar que no vuelve a aparecer el modal**

1. Cerrar y volver a abrir (sesión persistida en localStorage)
2. Loguearse de nuevo
3. Modal NO debe aparecer (`user_metadata.nombre` ya está seteado en Supabase)

- [ ] **Step 4: Crear PR**

```bash
git push -u origin feature/usuario-dinamico
gh pr create \
  --base main \
  --title "feat: USUARIO dinámico desde Supabase con setup self-service" \
  --body "$(cat <<'EOF'
## Problema
USUARIO estaba hardcodeado a 'Daniel'. Ama veía los datos de Daniel al loguearse.

## Solución
- Si user_metadata.nombre ya está seteado en Supabase → funciona directo (sin cambio visible)
- Si no está seteado → modal de bienvenida la primera vez → guarda con auth.updateUser

## Cómo testear
1. Login como Ama (primera vez) → aparece modal → tipear 'Ama' → guardar → ver datos de Ama
2. Logout → login de nuevo → NO aparece modal → sigue viendo datos de Ama
3. Login como Daniel → idem
EOF
)"
```
