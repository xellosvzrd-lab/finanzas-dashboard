# Rediseño visual "Liquid Glass" — Dashboard Finanzas

> Spec de diseño. Estado: aprobado por Daniel el 2026-07-05 tras revisión de mockups en el companion visual.

## 1. Objetivo

Reemplazar el look visual actual (tarjetas planas con fondo violeta magenta sólido, tema oscuro para Daniel / claro para Ama) por un lenguaje "liquid glass": paneles translúcidos con blur, bordes con brillo especular, y un tinte de color de marca sobre un fondo oscuro con gradiente radial. Es un cambio **puramente visual (CSS)** — no toca lógica de negocio, cálculos, ni estructura de datos.

## 2. Alcance

- Las 6 pantallas del nav: Mi mes, Transacciones, Compartidos, Categorías, Inversiones, Resumen.
- Ambos breakpoints: desktop (topnav con 6 pills) y mobile (bottom-nav de 4 tabs + FAB central).
- Se aplica a `index.html` (single-file, sin build pipeline) — todo vive en el `<style>` global y en las plantillas HTML existentes.

**Fuera de alcance:** cambios de lógica JS, cambios de esquema de datos, nuevas features. Páginas fuera del nav principal (`page-nueva`, `page-anual`, `page-importar`) no se tocan en esta pasada — quedan con el estilo viejo hasta una iteración posterior (mencionar explícitamente si se detecta inconsistencia visual al implementar).

## 3. Decisión clave: un solo tema, no más Daniel-dark/Ama-light

Hoy `index.html` tiene `:root[data-theme='dark']` (Daniel) y `:root[data-theme='light']` (Ama) con paletas distintas. El liquid glass se aprueba **unificado**: un solo tema oscuro con vidrio traslúcido para ambos usuarios. Se elimina la rama `[data-theme='light']` como tema visual separado (o se deja como alias del nuevo tema único, a decidir en el plan de implementación — no debe quedar código muerto).

## 4. Paleta — fundamentada en psicología del color en fintech

Investigación previa (ver conversación): azul = confianza/calma (dominante en bancos tradicionales); verde/rojo = convención intocable para ganancia/pérdida; violeta = lujo/creatividad/personalización, preferido por fintechs modernas frente a bancos corporativos. Warm colors (rojo/naranja) dominantes elevan ansiedad si se usan como fondo, no solo como acento puntual.

**Decisión:** correr el violeta magenta actual (`oklch(0.74 0.15 300)`) hacia índigo (`oklch(0.72 0.17 270)`) — más azul, ganando calma/confianza sin perder la personalidad creativa del violeta.

### Tokens de color (dark base, único tema)

```css
--bg:          #10121f;
--bg-grad:     radial-gradient(120% 80% at 80% -10%, #1f2247 0%, #10121f 55%);
--brand:       oklch(0.72 0.17 270);        /* antes: oklch(0.74 0.15 300) */
--brand-rgb:   122, 116, 232;               /* para rgba() en glass tints */
--text:        #f4f1fa;
--text-dim:    #b3aac6;

/* Intocables — convención financiera universal */
--green:       #4ec476;   /* positivo / ingreso / a favor */
--red:         #e56e4a;   /* negativo / gasto / excedido */
--yellow:      #d2bc3a;   /* alerta media / pacing */
```

## 5. Componente base: `.g` (glass panel)

Todo panel/card/pill del dashboard se construye sobre esta clase base:

```css
.g {
  background: linear-gradient(155deg, rgba(122,116,232,0.20), rgba(255,255,255,0.05));
  border: 1px solid rgba(255,255,255,0.15);
  backdrop-filter: blur(16px) saturate(160%);
  -webkit-backdrop-filter: blur(16px) saturate(160%);
  border-radius: 16px;
  box-shadow: 0 8px 26px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.22);
}

/* Variante con brillo especular arriba — para cards destacadas (hero, KPIs principales) */
.g.spec::before {
  content: "";
  position: absolute; top: 0; left: 6%; right: 6%; height: 36%;
  background: linear-gradient(180deg, rgba(255,255,255,.3), rgba(255,255,255,0));
  border-radius: 16px 16px 60% 60%;
  pointer-events: none;
}
```

**Fallback sin `backdrop-filter`** (navegadores viejos / Firefox con la flag desactivada): degrada a `.g` con `background` sólido semi-opaco (sin blur) vía `@supports not (backdrop-filter: blur(1px))`. El contenido debe seguir siendo legible sin el blur — no depender del blur para contraste de texto.

## 6. Navegación

- **Desktop (topnav):** fila de pills `.g`, cada pill con `border-radius:999px`. El tab activo suma `background: linear-gradient(155deg, rgba(122,116,232,0.5), rgba(255,255,255,0.08))` + `box-shadow` con glow del brand.
- **Mobile (bottom-nav):** barra `.g` fija abajo, `display:grid` con `grid-template-columns: 1fr 1fr auto 1fr 1fr` (4 tabs + FAB central) — **no usar `justify-around` con flex**, generaba espaciado desparejo entre íconos/labels en los mockups iniciales. El FAB central es un círculo con gradiente de marca, elevado con `transform: translateY(-14px)` para que sobresalga de la barra.

## 7. Patrones por tipo de contenido

| Patrón | Dónde se usa | Notas |
|---|---|---|
| Hero card (`.g.spec`, grande) | Mi mes ("Te queda para gastar"), Inversiones (Patrimonio) | Valor grande con `background-clip:text` gradiente blanco→lavanda claro |
| KPI/stat card chica | Mi mes (quick stats, stat-cards), Resumen (KPI grid), Inversiones (Asignación) | Grid de 3-4 columnas desktop → 2 columnas mobile |
| Tabla | Mi mes (editar presupuesto), Transacciones (desktop), Compartidos (desglose/reembolsos) | Filas con `border-bottom` sutil, sin fondo propio — el contenedor `.g` es la única superficie de vidrio |
| Lista agrupada (no tabla) | Transacciones (mobile) | Agrupada por fecha, ícono circular por categoría, swipe-to-delete se mantiene |
| Barra de progreso | Presupuesto, Cuotas, Inversiones (asignación) | `background: rgba(255,255,255,.08)` track + fill de color semántico (verde/amarillo/rojo o brand) |
| Chip/pill de alerta | Tendencias (Mi mes) | `.g` chip chico, color de texto semántico |
| Gráficos (Chart.js) | Resumen | Mismos tipos actuales (bar, doughnut, mixed bar+line) — actualizar solo la paleta de colores de dataset para usar los tokens nuevos, no cambiar tipo de gráfico ni librería |

## 8. Pantallas (referencia visual)

Los 12 mockups completos (6 pantallas × desktop/mobile) fueron validados interactivamente en el companion de brainstorming y quedan persistidos como referencia en:

```
.superpowers/brainstorm/46460-1783279654/content/
  mimes-desktop-indigo.html      (versión final con paleta índigo)
  mimes-mobile.html
  transacciones-desktop.html
  transacciones-mobile.html
  compartidos-desktop.html
  compartidos-mobile.html
  categorias-desktop.html
  categorias-mobile.html
  inversiones-desktop.html
  inversiones-mobile.html
  resumen-desktop.html
  resumen-mobile.html
```

Nota: estos archivos usan colores/contenido de ejemplo aproximado (no datos reales de Supabase) y clases con prefijo local (`.lgd2-`, `.lgm-`, etc.) que **no** se copian literal al código de producción — son referencia de layout/estilo, la implementación debe integrarse con las clases y estructura HTML reales de `index.html` (`.mm-hero`, `.mm-sc`, `.pres-input`, `.data-table`, etc.), aplicándoles el nuevo look de vidrio.

### Resumen por pantalla

1. **Mi mes:** header + hero "Te queda para gastar" + quick stats (Ingresos/Gastos/Ahorro) + desglose del sueldo + 4 stat-cards (Ahorro/Compartidos/Cuotas/Futuro) + chips de tendencia + cuotas activas + tus categorías + tabla editar presupuesto (monto $ + % calculado, ya implementado en `renderPresupuesto()`).
2. **Transacciones:** desktop = tabla con filtros; mobile = lista agrupada por día con swipe-to-delete. Chips de filtro rápido solo en mobile.
3. **Compartidos:** reparto editable + balance del mes + contribución (barras Daniel/Ama) + 2 tablas (desglose por categoría, reembolsos). Mobile: todo en columna única.
4. **Categorías:** grid de 4 cards (Gasto/Ingreso/Fuentes/Tarjetas) + cards de cuenta y pareja abajo. Mobile: columna única.
5. **Inversiones:** patrimonio + asignación (barras Plazos fijos/Activos) + 2 listas (plazos fijos, activos&cripto) en cards.
6. **Resumen:** KPI grid (4) + 3 gráficos (barras categorías, donut ingresos/gastos, lista top gastos) + gráfico de evolución mensual full-width.

## 9. Accesibilidad y performance

- Contraste de texto sobre vidrio: verificar que `--text` (#f4f1fa) sobre el fondo más claro del glass (con blur) siga cumpliendo AA — el mockup usa opacidad de tinte baja (0.20) precisamente para esto, no subir la opacidad del tinte sin re-chequear contraste.
- `backdrop-filter` con blur alto (16-22px) en muchos elementos simultáneos puede pesar en dispositivos viejos — usar `blur(16px)` como default (ya validado en mockups), no subir a valores mayores sin medir performance real en el mobile de Daniel/Ama.
- Mantener `prefers-reduced-motion` respetado donde ya existe (transiciones de barras, sparklines).

## 10. No-goals explícitos

- No se cambia el motor de gráficos (Chart.js se mantiene).
- No se cambia la lógica de cálculo de ningún KPI.
- No se agregan features nuevas "mientras estamos".
- No se toca el esquema de Supabase.
