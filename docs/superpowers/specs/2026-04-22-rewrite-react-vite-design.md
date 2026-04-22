# Rewrite: finanzas-dashboard — React + Vite + TypeScript

**Fecha:** 2026-04-22
**Estado:** Aprobado por Daniel
**Contexto:** Rewrite completo del single-file `index.html` (~6100 líneas vanilla JS) a stack moderno. Motivado por audit de Opus: math financiera duplicada en 5 lugares, 329 `getElementById`, render doble en startup, XSS vectors, sin routing, sin tests.

---

## 1. Stack

| Capa | Tecnología | Razón |
|------|-----------|-------|
| Build | Vite 6 | Dev server rápido, HMR, bundle optimizado |
| UI | React 19 + TypeScript | JSX elimina XSS, TS detecta bugs en compile-time |
| Routing | React Router v7 | URL como estado — filtros, mes/año, página |
| Server state | TanStack Query v5 | Cache, SWR, dedup automático, optimistic updates |
| Client state | Zustand | Filtros, UI, modals — minimal boilerplate |
| Charts | react-chartjs-2 | Wrapper React para Chart.js — `chart.update()` automático |
| Estilos | CSS Modules | Preserva variables CSS actuales, sin Tailwind overhead |
| Validación | Zod | Schema único de Transaction compartido en forms + import |
| Backend | Supabase (sin cambios) | Typed client via `supabase gen types typescript` |
| Tests | Vitest | Unit tests para `lib/finance.ts` |
| Deploy | Vercel (sin cambios) | Sin cambios de infraestructura |

---

## 2. Estructura de directorios

```
src/
  api/
    supabase.ts           ← cliente tipado singleton
    transactions.ts       ← queries/mutations (getAll, insert, delete)
    categories.ts         ← queries/mutations
    budget.ts             ← get/save presupuesto
  lib/
    finance.ts            ← computeNetByCategory(), esTransferencia(), getMesLiquidacion()
    format.ts             ← fmt(), fmtMoneda(), fmtFecha(), fmtShort()
    pdfParser.ts          ← PDF import logic (Galicia VISA + fallback genérico)
    fingerprint.ts        ← hash para dedup en import
  hooks/
    useTransactions.ts    ← TanStack Query wrapper
    useCategories.ts
    useBudget.ts
    useMonthSummary.ts    ← selector derivado: computeNetByCategory sobre useTransactions
    useTipoCambio.ts      ← MEP fetch (solo Ama)
  stores/
    authStore.ts          ← session, USUARIO, PARTNER, CATS_*
    uiStore.ts            ← filters, sort, modals, disclosure state
  components/
    layout/
      TopNav.tsx
      BottomNav.tsx
      FAB.tsx
    charts/
      CatChart.tsx
      DonutChart.tsx
      EvolutionChart.tsx
      AnualChart.tsx
    tables/
      TransactionTable.tsx    ← virtualizado con TanStack Virtual
      TransactionRow.tsx
    forms/
      TransactionForm.tsx     ← reutilizado en Nueva + Editar + Ráfaga
      BudgetForm.tsx
    shared/
      SharedBalance.tsx
      MonthYearPicker.tsx     ← componente único reemplaza 4 selectores duplicados
      KPICard.tsx
    ui/
      Toast.tsx
      Modal.tsx
      Disclosure.tsx
  pages/
    PresupuestoPage.tsx
    TransaccionesPage.tsx
    CompartidosPage.tsx
    AnualPage.tsx
    ConfigPage.tsx
    ImportPage.tsx
    LoginPage.tsx
  types/
    supabase.ts             ← generado por `supabase gen types typescript`
    domain.ts               ← Transaction, Category, Budget (wrappers tipados)
  App.tsx                   ← router + auth guard
  main.tsx
```

---

## 3. Estado y flujo de datos

### Auth
```
App.tsx → <AuthGuard>
  ├── no session → <LoginPage>
  └── session → <AppLayout> → <Outlet>
```

`supabase.auth.onAuthStateChange` en `useEffect` global. `USUARIO` y `PARTNER` derivados de `user_metadata.nombre` y almacenados en `authStore`.

### Server state (TanStack Query)

Tres queries base — todo lo demás se deriva:

```typescript
useTransactions()          // todas las tx (propias + compartidas del partner via RLS)
useCategories()            // gasto, ingreso, fuentes, fuentesTC
useBudget(year, month)     // presupuesto del mes
```

**Cache:** `staleTime: 5min`, `gcTime: 30min`.
**Mutations:** optimistic updates — UI responde inmediatamente, revierte si falla.
**Elimina:** double-render del `iniciarApp` actual.

### `lib/finance.ts` — lógica financiera pura

```typescript
// Reemplaza las 5 copias duplicadas de la fórmula de responsabilidad
computeNetByCategory(
  transactions: Transaction[],
  params: { user: string; partner: string; month: number; year: number }
): Record<string, number>

esTransferencia(categoria: string): boolean
getMesLiquidacion(tx: Transaction): string  // YYYY-MM
```

Testeable con Vitest sin browser. Un solo source of truth para todas las páginas.

### Client state (Zustand — `uiStore`)

```typescript
{
  filters: { mes, anio, tipo, fuente, resp, buscar, cats: string[] },
  sort: { col: string, dir: 'asc' | 'desc' },
  modals: { editando: string | null, liquidar: LiquidarState | null },
  disclosure: { mimes: boolean, compartidos: boolean }
}
```

Filtros sincronizados con URL via `useSearchParams` — refresh y back-button funcionan.

### Supabase typed client

```bash
supabase gen types typescript --project-id eutarjfnlkcehhigqqxr > src/types/supabase.ts
```

`Transaction`, `Categoria`, `Presupuesto` tipados desde el schema. Error de TS si un campo cambia en DB.

---

## 4. Routing (URL como estado)

| URL | Página |
|-----|--------|
| `/` | redirect → `/presupuesto` |
| `/presupuesto` | Mi mes (landing post-login) |
| `/transacciones?mes=04&anio=2026&tipo=Gasto` | Transacciones con filtros |
| `/compartidos/2026-04` | Compartidos del mes |
| `/anual?anio=2026` | Resumen anual |
| `/config` | Categorías |
| `/importar` | Import PDF/texto |

Back button, refresh, links directos: todos funcionan.

---

## 5. Componentes clave

### TransactionTable
- Virtualizado con TanStack Virtual — 10k rows sin lag
- Reemplaza el `innerHTML` manual actual
- Filtros debounced 150ms en search input
- Columnas: fecha, tipo, categoría, fuente, responsabilidad, descripción, monto, moneda, acciones

### Charts
- `react-chartjs-2` maneja `chart.update()` automáticamente (sin destroy/recreate)
- Paleta terracota actual preservada en `chartTheme.ts`
- Animación de delta (10→11) en lugar de siempre desde 0

### TransactionForm
- Único componente reutilizado en: Nueva transacción, Editar, Modo Ráfaga
- Schema Zod compartido — validación consistente en todos los entry points
- Responsabilidad: mismo modelo "Mío / Compartido / De [PARTNER]" con labels dinámicos

### MonthYearPicker
- Componente único reemplaza los 4 selectores duplicados actuales
- Props: `value`, `onChange`, `yearsBack = 4`

---

## 6. Import PDF — mejoras

- **Fingerprint dedup:** `hash(fecha|monto|descripcion|fuente|usuario)` en columna `fingerprint` con índice unique. Importar el mismo PDF dos veces → "X duplicados salteados"
- **Log de parseo:** "Parseadas 87 líneas, 72 matches, 15 salteadas — última: [texto]"
- **Parser:** mismo algoritmo Galicia VISA actual (DD-MM-YY + comprobante como ancla) + fallback genérico DD/MM. Migrado a `lib/pdfParser.ts` como función pura.

---

## 7. Mejoras UX incluidas en scope

- `animateKPI` desde valor previo (no desde 0 siempre)
- Logout limpia todo el localStorage `fp_*`
- Eliminar categoría muestra warning si hay transacciones que la usan
- Tema claro (Ama) y oscuro (Daniel) preservados via CSS variables en CSS Modules

### Fuera de scope (post-rewrite)
- Offline queue / IndexedDB
- Insights automáticos (recurring transactions detection)
- Net worth / account balances
- Dark mode para Daniel
- Bills calendar

---

## 8. Plan de migración incremental

El `index.html` actual permanece en prod durante el rewrite. Nuevo repo en paralelo.

| Fase | Contenido | Criterio de done |
|------|-----------|-----------------|
| 1 | Scaffold Vite+React+TS, auth, Supabase typed client, routing skeleton | Login funciona, navegación entre páginas vacías |
| 2 | `lib/finance.ts` + Vitest unit tests | `computeNetByCategory` pasa tests con fixtures del app actual |
| 3 | PresupuestoPage — Mi mes completo | Feature parity con `index.html`: KPIs, gráfico, desglose |
| 4 | TransaccionesPage — tabla virtualizada + filtros + CRUD | Feature parity: filtrar, crear, editar, eliminar, duplicar |
| 5 | CompartidosPage + AnualPage | Feature parity |
| 6 | ConfigPage (categorías) + ImportPage (PDF + texto) | Feature parity + fingerprint dedup |
| 7 | QA final + cutover | Dominio apunta al nuevo repo, `index.html` archivado |

---

## 9. Decisiones de diseño

| Decisión | Alternativa descartada | Razón |
|----------|----------------------|-------|
| React 19 | Preact | Bundle no es problema crítico; React tiene mejor ecosistema |
| CSS Modules | Tailwind | Preserva variables CSS existentes sin reescribir todos los estilos |
| TanStack Query | SWR | Más features: optimistic updates, background refetch, devtools |
| Migración incremental | Big-bang rewrite | Mantiene `index.html` funcional en prod durante la transición |
| Mantener Supabase | Migrar backend | No hay problemas con Supabase; RLS ya corregido |

---

## 10. Notas de seguridad

- React elimina la clase de bugs XSS por JSX auto-escaping
- `unsafe-inline` en CSP puede eliminarse en el nuevo build (Vite genera hashes para inline)
- RLS de Supabase ya corregido (session 2026-04-22)
- `fp_sb_password` ya eliminado del localStorage
