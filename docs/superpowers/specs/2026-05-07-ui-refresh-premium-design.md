# UI Refresh — Premium + Cálido/Humano

**Fecha:** 2026-05-07  
**Enfoque:** Header-First Cascade  
**Alcance:** Global (todas las páginas/tabs)  
**Prioridad:** Headers → KPI cards → Iconos → Micro-interacciones

---

## Objetivo

Elevar el dashboard de "funcional" a "premium + cálido" sin romper consistencia. Paleta terracota más presente, glassmorphism sutil en KPI cards, sistema de iconos Lucide unificado, y jerarquía tipográfica expresiva.

---

## 1. Headers de sección

### Page titles (Mi mes, Transacciones, Compartidos, Categorías, Inversiones)

- **Peso:** Bricolage Grotesque weight 800
- **Tamaño:** 1.75rem (up desde ~1.5rem actual)
- **Color:** degradado diagonal `var(--text) → var(--accent)`
  ```css
  background: linear-gradient(135deg, var(--text) 0%, var(--accent) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  ```
- **Eyebrow label** encima del título:
  ```css
  font-size: 0.65rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent);
  opacity: 0.7;
  ```
  Contenido dinámico: "MAYO 2026 · DANIEL" (mes actual + usuario)

### Sub-section headers (comp-title, pres-title, chart-title, etc.)

- Barra vertical izquierda 3px terracota:
  ```css
  border-left: 3px solid var(--accent);
  padding-left: 0.75rem;
  ```
- Weight 700, color `var(--text)` puro (sin degradado — reservado para page titles)
- Sin eyebrow

### Separadores post-header

- Línea `1px` después del page header:
  ```css
  background: linear-gradient(to right, var(--accent), transparent);
  height: 1px;
  opacity: 0.3;
  ```
- Reemplaza separadores planos actuales

---

## 2. KPI Cards — Glassmorphism

Aplica a los 6 KPI cards de Mi mes + hero card. Los cards de tabla (Compartidos, Inversiones) usan misma lógica sin el highlight superior.

### Background y borde

```css
background: rgba(var(--card-rgb), 0.55);
backdrop-filter: blur(14px);
-webkit-backdrop-filter: blur(14px);
border: 1px solid rgba(var(--accent-rgb), 0.12);
```

> **Nota:** Requiere agregar `--card-rgb` y `--accent-rgb` como variables CSS con valores RGB separados (sin `rgba()` wrapper) para poder usarlos con `rgba()`.

### Highlight superior

```css
box-shadow: 
  0 4px 24px rgba(0,0,0,0.25),
  inset 0 1px 0 rgba(255,255,255,0.04);
position: relative;
```

Pseudo-elemento top:
```css
.kpi-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(to right, var(--accent), transparent);
  opacity: 0.4;
  border-radius: var(--radius) var(--radius) 0 0;
}
```

### Iconos en círculo semántico

Círculo 36×36px con Lucide icon (18px) dentro:
```css
.kpi-icon-wrap {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

| KPI | Ícono Lucide | Color círculo |
|---|---|---|
| Ingresos | `arrow-down-circle` | `rgba(var(--green-rgb), 0.12)` · icon verde |
| Gastos | `arrow-up-circle` | `rgba(var(--red-rgb), 0.12)` · icon rojo |
| Lo que te queda | `wallet` | `rgba(var(--accent-rgb), 0.12)` · icon terracota |
| Ahorro | `piggy-bank` | `rgba(var(--yellow-rgb), 0.12)` · icon amarillo |
| Mes saldado | `check-circle` | `rgba(var(--green-rgb), 0.12)` · icon verde |
| Plazo fijo | `landmark` | `rgba(var(--text-muted-rgb), 0.08)` · icon muted |

### Hover (solo desktop)

```css
@media (hover: hover) {
  .kpi-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06);
  }
}
```

---

## 3. Sistema de Iconos — Lucide

### Carga

```html
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
```

Inicializar después de cada render que actualice el DOM:
```javascript
if (window.lucide) lucide.createIcons();
```

### Nav icons (outline, 20px stroke-width 1.75)

| Tab | Lucide |
|---|---|
| Mi mes | `calendar-days` |
| Transacciones | `receipt` |
| Compartidos | `users` |
| Categorías | `tag` |
| Inversiones | `trending-up` |

Implementación via `data-lucide` attribute:
```html
<i data-lucide="calendar-days"></i>
```

### KPI icons

Ver tabla sección 2. Usar atributo `data-lucide` + `fill="currentColor"` para variante fill.

### Action icons (outline, 16px)

| Acción | Lucide | Reemplaza |
|---|---|---|
| Editar | `pencil` | `IC_EDIT` SVG inline |
| Eliminar | `trash-2` | `IC_TRASH` SVG inline |
| Copiar | `copy` | `IC_COPY` SVG inline |

### Emojis eliminados

| Emoji actual | Reemplazo |
|---|---|
| `☰` hamburger | `<i data-lucide="menu">` |
| `✕` cerrar | `<i data-lucide="x">` |
| `📊 Sugerir` | `<i data-lucide="bar-chart-2">` + texto |
| `▲▼` trends | Mantener como texto (semánticos) |
| `✓` settlement badge | Mantener texto (funcional) |

---

## 4. Calor y Micro-interacciones

### Paleta terracota más presente

No cambiar valores de `--accent` (#C8845A). Usarlo más consistentemente:
- Eyebrow labels → `var(--accent)` con `opacity: 0.7`
- Barra lateral sub-headers → `var(--accent)`
- Top highlight cards → `var(--accent)` con `opacity: 0.4`
- Círculos KPI icon → `rgba(var(--accent-rgb), 0.12)`

Colores semánticos (verde/rojo/amarillo) no cambian — son funcionales.

### Micro-interacciones nuevas

**Nav icon active/hover:**
```css
.nav-item:hover svg, .nav-item.active svg {
  transform: scale(1.1);
  color: var(--accent);
  transition: transform 0.15s var(--ease-out), color 0.15s;
}
```

**Botón guardar — shimmer:**
Al presionar guardar transacción, añadir clase `.btn-saving` que dispara un shimmer left-to-right (reemplaza el "✓ Guardado" actual por un efecto más visual antes del mensaje).

**Settlement badge entrada:**
```css
.saldado-badge {
  animation: badgeEntrada 0.3s var(--ease-out);
}
@keyframes badgeEntrada {
  from { transform: scale(0.8); opacity: 0; }
  to   { transform: scale(1);   opacity: 1; }
}
```

### Tipografía numérica

Verificar y agregar donde falte:
```css
.kpi-value, #sub-neto, .comp-balance-value {
  font-variant-numeric: tabular-nums;
}
```

---

## Variables CSS nuevas requeridas

Agregar al `:root` para soporte `rgba()`:
```css
--card-rgb: 30, 24, 20;        /* equivalente a --card actual */
--accent-rgb: 200, 132, 90;    /* #C8845A */
--green-rgb: 74, 222, 128;     /* equivalente a --green */
--red-rgb: 248, 113, 113;      /* equivalente a --red */
--yellow-rgb: 250, 204, 21;    /* equivalente a --yellow */
--text-muted-rgb: 120, 110, 100;
```

Y en `[data-theme="light"]` los equivalentes del tema claro.

---

## Orden de implementación

1. Variables CSS RGB nuevas
2. Lucide CDN + `createIcons()` en puntos de render
3. Headers: eyebrow + degradado + separadores + sub-header bars
4. KPI cards: glassmorphism + highlight + hover
5. Iconos: nav → KPIs → actions → eliminar emojis
6. Micro-interacciones: nav hover, settlement badge, shimmer guardar

---

## Archivos afectados

- `index.html` — único archivo (CSS inline + HTML + JS)

## Fuera de scope

- Cambios de layout o estructura de datos
- Nuevas features o KPIs
- Tema claro de Ama (misma lógica, verificar que `[data-theme="light"]` no quede roto)
