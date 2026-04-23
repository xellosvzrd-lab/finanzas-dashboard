# Rewrite Plan B — Presupuesto (Nav + Hooks + PresupuestoPage)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement shared infrastructure (navigation, TanStack Query hooks, shared UI) and PresupuestoPage with full feature parity — KPIs (Ingresos, Gastos, Saldo), donut chart, desglose por categoría, and edición de presupuesto.

**Architecture:** Five TanStack Query hooks wrap the Supabase API layer. App.tsx refactored to nested routes so AppLayout (TopNav + BottomNav + FAB) mounts once per session. PresupuestoPage reads `mes`/`anio` from `uiStore.filters`, derives net-by-category via `computeNetByCategory`, and renders all Mi mes UI. TransaccionesPage (CRUD + virtualised table) is Plan C.

**Tech Stack:** React 19, TypeScript, TanStack Query v5, Zustand, react-chartjs-2 (Doughnut), React Router v7 nested routes, Supabase JS v2.

---

## Files created/modified in this plan

```
finanzas-dashboard-v2/src/
  hooks/
    useTransactions.ts      ← NEW
    useCategories.ts        ← NEW
    useBudget.ts            ← NEW
    useMonthSummary.ts      ← NEW
    useTipoCambio.ts        ← NEW
  components/
    layout/
      AppLayout.tsx         ← NEW — Outlet + TopNav + BottomNav + FAB
      TopNav.tsx            ← NEW
      BottomNav.tsx         ← NEW
      FAB.tsx               ← NEW
    shared/
      MonthYearPicker.tsx   ← NEW
      KPICard.tsx           ← NEW
      Toast.tsx             ← NEW
    charts/
      DonutChart.tsx        ← NEW
    forms/
      BudgetForm.tsx        ← NEW
  pages/
    PresupuestoPage.tsx     ← REPLACE placeholder
  App.tsx                   ← MODIFY — nested routes
  index.css                 ← MODIFY — add .topnav, .bottom-nav, .fab, .kpi-card CSS
```

---

## Task 1: TanStack Query hooks

**Files:**
- Create: `src/hooks/useTransactions.ts`
- Create: `src/hooks/useCategories.ts`
- Create: `src/hooks/useBudget.ts`
- Create: `src/hooks/useMonthSummary.ts`
- Create: `src/hooks/useTipoCambio.ts`

- [ ] **Step 1.1: Crear `src/hooks/useTransactions.ts`**

```typescript
// src/hooks/useTransactions.ts
import { useQuery } from '@tanstack/react-query'
import { getTransactions } from '../api/transactions'

export function useTransactions() {
  return useQuery({
    queryKey: ['transactions'],
    queryFn: getTransactions,
  })
}
```

- [ ] **Step 1.2: Crear `src/hooks/useCategories.ts`**

```typescript
// src/hooks/useCategories.ts
import { useQuery } from '@tanstack/react-query'
import { getCategories } from '../api/categories'

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  })
}
```

- [ ] **Step 1.3: Crear `src/hooks/useBudget.ts`**

```typescript
// src/hooks/useBudget.ts
import { useQuery } from '@tanstack/react-query'
import { getBudget } from '../api/budget'
import { useAuthStore } from '../stores/authStore'

export function useBudget(year: number, month: number) {
  const userId = useAuthStore((s) => s.session?.user.id ?? '')

  return useQuery({
    queryKey: ['budget', userId, year, month],
    queryFn: () => getBudget(userId, year, month),
    enabled: !!userId,
  })
}
```

- [ ] **Step 1.4: Crear `src/hooks/useMonthSummary.ts`**

`computeNetByCategory` filtra transacciones por mes efectivo (usando `getMesLiquidacion`), excluye moneda USD y categorías de transferencia, y aplica la lógica de responsabilidad (Mío 100%, Compartido 50%, De partner 100%, De user 0%).

```typescript
// src/hooks/useMonthSummary.ts
import { useMemo } from 'react'
import { useTransactions } from './useTransactions'
import { useAuthStore } from '../stores/authStore'
import { computeNetByCategory } from '../lib/finance'

export function useMonthSummary(month: number, year: number) {
  const { data: transactions = [] } = useTransactions()
  const usuario = useAuthStore((s) => s.usuario)
  const partner = useAuthStore((s) => s.partner)

  return useMemo(
    () => computeNetByCategory(transactions, { user: usuario, partner, month, year }),
    [transactions, usuario, partner, month, year],
  )
}
```

- [ ] **Step 1.5: Crear `src/hooks/useTipoCambio.ts`**

Solo Ama usa esto para calcular `salaryBase` en ARS (ingresos ARS + saldo USD × MEP). El hook no fetcha cuando `usuario !== 'Ama'`.

```typescript
// src/hooks/useTipoCambio.ts
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../stores/authStore'

async function fetchMEP(): Promise<number> {
  const res = await fetch('https://dolarapi.com/v1/dolares/bolsa')
  if (!res.ok) throw new Error('MEP fetch failed')
  const data = await res.json() as { venta: number }
  return data.venta
}

export function useTipoCambio() {
  const usuario = useAuthStore((s) => s.usuario)

  return useQuery({
    queryKey: ['tipoCambioMEP'],
    queryFn: fetchMEP,
    enabled: usuario === 'Ama',
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
}
```

- [ ] **Step 1.6: Verificar TypeScript**

```bash
cd ~/Documents/ProyectosClaude/finanzas-dashboard-v2
npx tsc --noEmit
```

Esperado: 0 errores.

- [ ] **Step 1.7: Commit**

```bash
git add src/hooks/
git commit -m "feat: TanStack Query hooks — useTransactions, useCategories, useBudget, useMonthSummary, useTipoCambio"
```

---

## Task 2: AppLayout + navegación + CSS

**Files:**
- Create: `src/components/layout/AppLayout.tsx`
- Create: `src/components/layout/TopNav.tsx`
- Create: `src/components/layout/BottomNav.tsx`
- Create: `src/components/layout/FAB.tsx`
- Modify: `src/App.tsx`
- Modify: `src/index.css`

- [ ] **Step 2.1: Crear `src/components/layout/TopNav.tsx`**

Muestra en desktop: 4 tabs con `NavLink` (active state automático), nombre de usuario, botón Salir.

```tsx
// src/components/layout/TopNav.tsx
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../../api/supabase'
import { useAuthStore } from '../../stores/authStore'

const NAV_ITEMS = [
  { to: '/presupuesto', label: 'Mi mes' },
  { to: '/transacciones', label: 'Gastos' },
  { to: '/compartidos', label: 'Compartidos' },
  { to: '/config', label: 'Categorías' },
]

export function TopNav() {
  const { clearAuth, usuario } = useAuthStore()
  const navigate = useNavigate()

  async function handleLogout() {
    await supabase.auth.signOut()
    clearAuth()
    navigate('/login')
  }

  return (
    <nav className="topnav">
      {NAV_ITEMS.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
        >
          {label}
        </NavLink>
      ))}
      <span className="topnav-user">{usuario}</span>
      <button className="topnav-logout" onClick={handleLogout}>Salir</button>
    </nav>
  )
}
```

- [ ] **Step 2.2: Crear `src/components/layout/BottomNav.tsx`**

4 ítems con `NavLink`. Se muestra solo en mobile (via CSS media query).

```tsx
// src/components/layout/BottomNav.tsx
import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/presupuesto', label: 'Mi mes' },
  { to: '/transacciones', label: 'Gastos' },
  { to: '/compartidos', label: 'Compartidos' },
  { to: '/config', label: 'Categ.' },
]

export function BottomNav() {
  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `bn-item${isActive ? ' active' : ''}`}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
```

- [ ] **Step 2.3: Crear `src/components/layout/FAB.tsx`**

Botón flotante visible en `/presupuesto` y `/transacciones`. Navega a `/transacciones?nueva=1` (Plan C implementará la apertura del form en esa URL).

```tsx
// src/components/layout/FAB.tsx
import { useNavigate, useLocation } from 'react-router-dom'

const FAB_PAGES = ['/presupuesto', '/transacciones']

export function FAB() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  if (!FAB_PAGES.includes(pathname)) return null

  return (
    <button
      className="fab"
      onClick={() => navigate('/transacciones?nueva=1')}
      aria-label="Nueva transacción"
    >
      +
    </button>
  )
}
```

- [ ] **Step 2.4: Crear `src/components/layout/AppLayout.tsx`**

Layout wrapper para rutas autenticadas. Usa `<Outlet>` de React Router v7 para renderizar la página activa.

```tsx
// src/components/layout/AppLayout.tsx
import { Outlet } from 'react-router-dom'
import { AuthGuard } from './AuthGuard'
import { TopNav } from './TopNav'
import { BottomNav } from './BottomNav'
import { FAB } from './FAB'

export function AppLayout() {
  return (
    <AuthGuard>
      <TopNav />
      <main className="app-main">
        <Outlet />
      </main>
      <FAB />
      <BottomNav />
    </AuthGuard>
  )
}
```

- [ ] **Step 2.5: Refactorizar `src/App.tsx` con nested routes**

Reemplazar el `AppLayout` children-based actual por nested routes con `<Outlet>`. Esto monta `AppLayout` una sola vez sin re-montar al cambiar de página.

```tsx
// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { PresupuestoPage } from './pages/PresupuestoPage'
import { TransaccionesPage } from './pages/TransaccionesPage'
import { CompartidosPage } from './pages/CompartidosPage'
import { ConfigPage } from './pages/ConfigPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime:   30 * 60 * 1000,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AppLayout />}>
            <Route path="/presupuesto" element={<PresupuestoPage />} />
            <Route path="/transacciones" element={<TransaccionesPage />} />
            <Route path="/compartidos" element={<CompartidosPage />} />
            <Route path="/config" element={<ConfigPage />} />
            <Route path="*" element={<Navigate to="/presupuesto" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 2.6: Agregar CSS de navegación y FAB a `src/index.css`**

Agregar al final de `src/index.css` (no reemplazar lo existente — solo append):

```css
/* ─── TOPNAV (desktop) ─────────────────────────────────── */
.topnav {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 1rem;
  background: var(--card);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 100;
}
.nav-item {
  padding: 0.4rem 0.85rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-muted);
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
}
.nav-item:hover { background: var(--bg2); color: var(--text); }
.nav-item.active { background: var(--accent-dim); color: var(--accent); font-weight: 600; }
.topnav-user {
  margin-left: auto;
  font-size: 0.82rem;
  color: var(--text-muted);
  padding-right: 0.5rem;
}
.topnav-logout {
  background: none;
  border: 1px solid var(--border2);
  border-radius: 8px;
  padding: 0.3rem 0.7rem;
  font-size: 0.82rem;
  color: var(--text-muted);
  cursor: pointer;
}
.topnav-logout:hover { color: var(--red); border-color: var(--red); }

/* ─── BOTTOM NAV (mobile) ──────────────────────────────── */
.bottom-nav {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 62px;
  background: var(--card);
  border-top: 1px solid var(--border);
  z-index: 100;
  justify-content: space-around;
  align-items: center;
}
.bn-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-muted);
  text-decoration: none;
  transition: color 0.15s;
}
.bn-item.active { color: var(--accent); font-weight: 600; }

/* ─── FAB ───────────────────────────────────────────────── */
.fab {
  position: fixed;
  bottom: 78px;
  right: 1.25rem;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--accent);
  color: white;
  font-size: 1.75rem;
  line-height: 1;
  border: none;
  cursor: pointer;
  z-index: 200;
  box-shadow: 0 3px 12px var(--accent-glow);
  transition: transform 0.15s, box-shadow 0.15s;
}
.fab:hover { transform: scale(1.07); box-shadow: 0 5px 18px var(--accent-glow); }

/* ─── APP MAIN ──────────────────────────────────────────── */
.app-main {
  padding-bottom: 70px; /* espacio para bottom nav en mobile */
}

/* ─── RESPONSIVE ────────────────────────────────────────── */
@media (max-width: 768px) {
  .topnav { display: none; }
  .bottom-nav { display: flex; }
}
```

- [ ] **Step 2.7: Verificar build**

```bash
npx tsc --noEmit && npm run build
```

Esperado: 0 errores TS, build exitoso.

- [ ] **Step 2.8: Verificar manualmente**

```bash
npm run dev
```

1. Login → navegar a `/presupuesto`
2. TopNav visible en desktop, BottomNav visible en mobile (resize ventana)
3. Tabs resaltan correctamente al cambiar de página
4. Botón Salir → redirige a `/login`
5. FAB `+` visible en `/presupuesto` y `/transacciones`, oculto en `/compartidos` y `/config`

- [ ] **Step 2.9: Commit**

```bash
git add src/components/layout/ src/App.tsx src/index.css
git commit -m "feat: AppLayout, TopNav, BottomNav, FAB con nested routes React Router v7"
```

---

## Task 3: Shared UI — MonthYearPicker, KPICard, Toast

**Files:**
- Create: `src/components/shared/MonthYearPicker.tsx`
- Create: `src/components/shared/KPICard.tsx`
- Create: `src/components/shared/Toast.tsx`
- Modify: `src/index.css`

- [ ] **Step 3.1: Crear `src/components/shared/MonthYearPicker.tsx`**

Componente único que reemplaza los 4 selectores duplicados del `index.html` actual. `mes` es 1-indexed (1=enero).

```tsx
// src/components/shared/MonthYearPicker.tsx
const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

interface MonthYearPickerProps {
  mes: number    // 1-12
  anio: number
  onChange: (mes: number, anio: number) => void
  yearsBack?: number
}

export function MonthYearPicker({ mes, anio, onChange, yearsBack = 4 }: MonthYearPickerProps) {
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: yearsBack + 1 }, (_, i) => currentYear - i)

  return (
    <div className="month-year-picker">
      <select value={mes} onChange={(e) => onChange(Number(e.target.value), anio)}>
        {MONTHS.map((m, i) => (
          <option key={i} value={i + 1}>{m}</option>
        ))}
      </select>
      <select value={anio} onChange={(e) => onChange(mes, Number(e.target.value))}>
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  )
}
```

- [ ] **Step 3.2: Crear `src/components/shared/KPICard.tsx`**

Tarjeta de KPI con label, valor (usando `fmt`), y trend opcional. `trend` aplica color verde/rojo.

```tsx
// src/components/shared/KPICard.tsx
import { fmt } from '../../lib/format'

interface KPICardProps {
  label: string
  value: number
  trend?: 'positive' | 'negative' | 'neutral'
  subtitle?: string
}

export function KPICard({ label, value, trend, subtitle }: KPICardProps) {
  const trendColor =
    trend === 'positive' ? 'var(--green)' :
    trend === 'negative' ? 'var(--red)' :
    'inherit'

  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ color: trendColor }}>{fmt(value)}</div>
      {subtitle && <div className="kpi-subtitle">{subtitle}</div>}
    </div>
  )
}
```

- [ ] **Step 3.3: Crear `src/components/shared/Toast.tsx`**

Hook `useToast` + componente `ToastBanner`. El toast se auto-oculta a los 3 segundos.

```tsx
// src/components/shared/Toast.tsx
import { useState, useCallback } from 'react'

export function useToast() {
  const [message, setMessage] = useState<string | null>(null)

  const toast = useCallback((msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(null), 3000)
  }, [])

  return { message, toast }
}

export function ToastBanner({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="toast-banner">
      {message}
    </div>
  )
}
```

- [ ] **Step 3.4: Agregar CSS de shared components a `src/index.css`**

Agregar al final de `src/index.css`:

```css
/* ─── MONTH YEAR PICKER ─────────────────────────────────── */
.month-year-picker {
  display: flex;
  gap: 0.4rem;
}
.month-year-picker select {
  background: var(--bg2);
  border: 1px solid var(--border2);
  border-radius: 8px;
  padding: 0.3rem 0.5rem;
  color: var(--text);
  font-size: 0.9rem;
  cursor: pointer;
}

/* ─── KPI CARD ──────────────────────────────────────────── */
.kpi-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1rem;
  box-shadow: var(--shadow);
}
.kpi-label {
  font-size: 0.78rem;
  color: var(--text-muted);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 0.3rem;
}
.kpi-value {
  font-family: 'Bricolage Grotesque', system-ui, sans-serif;
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--text);
}
.kpi-subtitle {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin-top: 0.2rem;
}

/* ─── TOAST ─────────────────────────────────────────────── */
.toast-banner {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--accent);
  color: white;
  padding: 0.5rem 1.25rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 500;
  z-index: 500;
  box-shadow: 0 2px 10px var(--accent-glow);
  pointer-events: none;
}
```

- [ ] **Step 3.5: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: 0 errores.

- [ ] **Step 3.6: Commit**

```bash
git add src/components/shared/ src/index.css
git commit -m "feat: shared components — MonthYearPicker, KPICard, Toast"
```

---

## Task 4: DonutChart

**Files:**
- Create: `src/components/charts/DonutChart.tsx`

El chart muestra gastos netos por categoría. Usa la paleta terracota del design system. Registra los elementos de Chart.js al importar (una sola vez por módulo).

- [ ] **Step 4.1: Crear `src/components/charts/DonutChart.tsx`**

```tsx
// src/components/charts/DonutChart.tsx
import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { fmtShort } from '../../lib/format'

ChartJS.register(ArcElement, Tooltip, Legend)

// Paleta terracota del design system
const PALETTE = [
  '#C8845A', '#e07a5f', '#d4956a', '#f2ae72', '#b07d62',
  '#a0522d', '#cd853f', '#8b5e3c', '#e5a87b', '#d2691e',
]

interface DonutChartProps {
  data: Record<string, number>  // categoria → monto neto
}

export function DonutChart({ data }: DonutChartProps) {
  const entries = Object.entries(data).filter(([, v]) => v > 0)

  if (!entries.length) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
        Sin gastos este mes
      </div>
    )
  }

  const labels = entries.map(([k]) => k)
  const values = entries.map(([, v]) => v)

  const chartData = {
    labels,
    datasets: [{
      data: values,
      backgroundColor: PALETTE.slice(0, labels.length),
      borderWidth: 2,
      borderColor: 'var(--card)',
    }],
  }

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          font: { size: 12 },
          color: 'var(--text)',
          boxWidth: 12,
          padding: 10,
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx: { label: string; raw: unknown }) =>
            ` ${ctx.label}: ${fmtShort(ctx.raw as number)}`,
        },
      },
    },
  }

  return <Doughnut data={chartData} options={options} />
}
```

- [ ] **Step 4.2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: 0 errores.

- [ ] **Step 4.3: Commit**

```bash
git add src/components/charts/DonutChart.tsx
git commit -m "feat: DonutChart con paleta terracota y react-chartjs-2"
```

---

## Task 5: BudgetForm

**Files:**
- Create: `src/components/forms/BudgetForm.tsx`

Formulario para editar los porcentajes de presupuesto por categoría. Los valores se guardan via `upsertBudget`. Si ya existe un item para la categoría (detectado por `current`), se incluye su `id` para hacer update; si no existe, el DB genera el id (insert).

- [ ] **Step 5.1: Crear `src/components/forms/BudgetForm.tsx`**

```tsx
// src/components/forms/BudgetForm.tsx
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { upsertBudget } from '../../api/budget'
import { useAuthStore } from '../../stores/authStore'
import { parsearDecimal } from '../../lib/finance'
import type { Budget, BudgetInsert } from '../../types/domain'

interface BudgetFormProps {
  categories: string[]   // ordered list of gasto category names
  current: Budget[]      // existing budget rows for this month
  year: number
  month: number
  onSaved: () => void
}

export function BudgetForm({ categories, current, year, month, onSaved }: BudgetFormProps) {
  const { session, usuario } = useAuthStore()

  // Initialize pct strings from existing budget rows; default '0' for unset categories
  const [pcts, setPcts] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const cat of categories) {
      const existing = current.find((b) => b.categoria === cat)
      init[cat] = existing ? String(existing.porcentaje) : '0'
    }
    return init
  })

  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      const userId = session?.user.id ?? ''
      const items: BudgetInsert[] = categories
        .filter((cat) => parsearDecimal(pcts[cat]) > 0)
        .map((cat) => {
          const existing = current.find((b) => b.categoria === cat)
          return {
            ...(existing ? { id: existing.id } : {}),
            categoria: cat,
            porcentaje: parsearDecimal(pcts[cat]),
            anio: year,
            mes: month,
            user_id: userId,
            usuario,
          }
        })
      await upsertBudget(items)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget'] })
      onSaved()
    },
  })

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); mutation.mutate() }}
      style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
    >
      {categories.map((cat) => (
        <div
          key={cat}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <label style={{ flex: 1, fontSize: '0.9rem' }}>{cat}</label>
          <input
            type="text"
            inputMode="decimal"
            value={pcts[cat]}
            onChange={(e) => setPcts((p) => ({ ...p, [cat]: e.target.value }))}
            style={{
              width: '64px',
              textAlign: 'right',
              background: 'var(--bg2)',
              border: '1px solid var(--border2)',
              borderRadius: '6px',
              padding: '0.25rem 0.4rem',
              color: 'var(--text)',
            }}
          />
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', width: '1rem' }}>%</span>
        </div>
      ))}

      {mutation.error && (
        <p style={{ color: 'var(--red)', fontSize: '0.85rem' }}>
          {(mutation.error as Error).message}
        </p>
      )}

      <button
        type="submit"
        disabled={mutation.isPending}
        style={{
          marginTop: '0.5rem',
          padding: '0.5rem 1rem',
          background: 'var(--accent)',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        {mutation.isPending ? 'Guardando…' : 'Guardar presupuesto'}
      </button>
    </form>
  )
}
```

- [ ] **Step 5.2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: 0 errores.

- [ ] **Step 5.3: Commit**

```bash
git add src/components/forms/BudgetForm.tsx
git commit -m "feat: BudgetForm — edición de % presupuesto por categoría con TanStack mutation"
```

---

## Task 6: PresupuestoPage — feature parity completa

**Files:**
- Modify: `src/pages/PresupuestoPage.tsx` (reemplazar placeholder)

PresupuestoPage ("Mi mes") muestra:
1. Header con `MonthYearPicker` sincronizado con `uiStore.filters.mes`/`anio`
2. 3 KPI cards: Ingresos, Gastos, Saldo del mes (solo ARS)
3. `DonutChart` con gastos netos por categoría
4. Toggle "Ver desglose" → tabla de categorías con % presupuesto vs gasto real
5. Botón "Editar presupuesto" → `BudgetForm` inline

Para Ama: `salaryBase = ingresos_ARS + ingresos_USD × tipoCambioMEP`. Para Daniel: `salaryBase = ingresos_ARS`.

La lógica de cálculo de totales (`calcTotalesMes`) se define dentro del mismo archivo — filtra por mes efectivo con `getMesLiquidacion`, solo ARS.

- [ ] **Step 6.1: Reemplazar `src/pages/PresupuestoPage.tsx`**

```tsx
// src/pages/PresupuestoPage.tsx
import { useState } from 'react'
import { useTransactions } from '../hooks/useTransactions'
import { useCategories } from '../hooks/useCategories'
import { useBudget } from '../hooks/useBudget'
import { useMonthSummary } from '../hooks/useMonthSummary'
import { useTipoCambio } from '../hooks/useTipoCambio'
import { useUIStore } from '../stores/uiStore'
import { useAuthStore } from '../stores/authStore'
import { MonthYearPicker } from '../components/shared/MonthYearPicker'
import { KPICard } from '../components/shared/KPICard'
import { DonutChart } from '../components/charts/DonutChart'
import { BudgetForm } from '../components/forms/BudgetForm'
import { useToast, ToastBanner } from '../components/shared/Toast'
import { fmt } from '../lib/format'
import { getMesLiquidacion } from '../lib/finance'
import type { Transaction } from '../types/domain'

// Ingresos del usuario en el mes (ARS + USD separados para salaryBase).
// Gastos = sum of netByCategory (responsibility-weighted via computeNetByCategory).
function calcIngresosMes(
  transactions: Transaction[],
  month: number,
  year: number,
  usuario: string,
): { ingresosARS: number; ingresosUSD: number } {
  const mesStr = `${year}-${String(month).padStart(2, '0')}`
  let ingresosARS = 0
  let ingresosUSD = 0

  for (const t of transactions) {
    if (t.tipo !== 'Ingreso') continue
    if (t.usuario !== usuario) continue
    if (getMesLiquidacion(t) !== mesStr) continue
    if (t.moneda === 'USD') ingresosUSD += t.monto
    else ingresosARS += t.monto
  }

  return { ingresosARS, ingresosUSD }
}

export function PresupuestoPage() {
  const { filters, setFilters, disclosureMimes, setDisclosure } = useUIStore()
  const { mes, anio } = filters
  const { usuario } = useAuthStore()
  const [editingBudget, setEditingBudget] = useState(false)
  const { message: toastMsg, toast } = useToast()

  const { data: transactions = [], isLoading } = useTransactions()
  const { data: categories = [] } = useCategories()
  const { data: budget = [] } = useBudget(anio, mes)
  const { data: tipoCambio } = useTipoCambio()
  const netByCategory = useMonthSummary(mes, anio)

  const { ingresosARS, ingresosUSD } = calcIngresosMes(transactions, mes, anio, usuario)
  // gastos = net responsibility total (computeNetByCategory already applies 50%/100%/0% weighting)
  const gastos = Object.values(netByCategory).reduce((sum, v) => sum + v, 0)
  const saldo = ingresosARS - gastos

  // salaryBase: Daniel → ARS ingresos. Ama → ARS + USD×MEP
  const salaryBase =
    usuario === 'Ama'
      ? ingresosARS + ingresosUSD * (tipoCambio ?? 0)
      : ingresosARS

  const catGasto = categories
    .filter((c) => c.tipo === 'gasto')
    .map((c) => c.valor)
    .sort()

  if (isLoading) {
    return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Cargando…</div>
  }

  return (
    <div style={{ padding: '1rem', maxWidth: 640, margin: '0 auto' }}>
      <ToastBanner message={toastMsg} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontFamily: 'Bricolage Grotesque, system-ui', fontSize: '1.4rem' }}>Mi mes</h2>
        <MonthYearPicker
          mes={mes}
          anio={anio}
          onChange={(m, a) => setFilters({ mes: m, anio: a })}
        />
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <KPICard label="Ingresos" value={ingresosARS} trend="positive" />
        <KPICard label="Gastos" value={gastos} />
        <KPICard label="Saldo" value={saldo} trend={saldo >= 0 ? 'positive' : 'negative'} />
      </div>

      {/* Donut chart */}
      <div style={{ maxWidth: 320, margin: '0 auto 1.5rem' }}>
        <DonutChart data={netByCategory} />
      </div>

      {/* Disclosure toggle */}
      <button
        onClick={() => setDisclosure('mimes', !disclosureMimes)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--accent)',
          cursor: 'pointer',
          fontSize: '0.9rem',
          fontWeight: 600,
          marginBottom: '0.5rem',
          padding: 0,
        }}
      >
        {disclosureMimes ? '▼' : '▶'} Ver desglose
      </button>

      {disclosureMimes && (
        <div style={{ overflowX: 'auto', marginBottom: '1.25rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border2)' }}>
                <th style={{ textAlign: 'left', padding: '0.35rem 0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Categoría</th>
                <th style={{ textAlign: 'right', padding: '0.35rem 0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>% Presup.</th>
                <th style={{ textAlign: 'right', padding: '0.35rem 0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Gasto actual</th>
                <th style={{ textAlign: 'right', padding: '0.35rem 0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>% Real</th>
              </tr>
            </thead>
            <tbody>
              {catGasto.map((cat) => {
                const gasto = netByCategory[cat] ?? 0
                const budgetRow = budget.find((b) => b.categoria === cat)
                const pctPres = budgetRow?.porcentaje ?? 0
                const montoPresupuesto = salaryBase > 0 ? (pctPres / 100) * salaryBase : 0
                const pctReal = salaryBase > 0 ? (gasto / salaryBase) * 100 : 0
                const overBudget = pctPres > 0 && gasto > montoPresupuesto

                if (gasto === 0 && pctPres === 0) return null

                return (
                  <tr
                    key={cat}
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    <td style={{ padding: '0.35rem 0.5rem' }}>{cat}</td>
                    <td style={{ textAlign: 'right', padding: '0.35rem 0.5rem', color: 'var(--text-muted)' }}>
                      {pctPres > 0 ? `${pctPres}%` : '—'}
                    </td>
                    <td style={{
                      textAlign: 'right',
                      padding: '0.35rem 0.5rem',
                      color: overBudget ? 'var(--red)' : 'inherit',
                      fontWeight: overBudget ? 600 : 400,
                    }}>
                      {fmt(gasto)}
                    </td>
                    <td style={{ textAlign: 'right', padding: '0.35rem 0.5rem', color: 'var(--text-muted)' }}>
                      {pctReal.toFixed(1)}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Budget edit */}
      <button
        onClick={() => setEditingBudget((v) => !v)}
        style={{
          padding: '0.45rem 1rem',
          background: editingBudget ? 'var(--bg3)' : 'var(--accent-dim)',
          color: 'var(--accent)',
          border: '1px solid var(--accent)',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '0.875rem',
          marginBottom: '1rem',
        }}
      >
        {editingBudget ? 'Cancelar' : 'Editar presupuesto'}
      </button>

      {editingBudget && (
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '1rem',
        }}>
          <BudgetForm
            categories={catGasto}
            current={budget}
            year={anio}
            month={mes}
            onSaved={() => {
              setEditingBudget(false)
              toast('Presupuesto guardado ✓')
            }}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6.2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: 0 errores.

- [ ] **Step 6.3: Build de producción**

```bash
npm run build
```

Esperado: build exitoso sin errores.

- [ ] **Step 6.4: Verificar manualmente en el browser**

```bash
npm run dev
```

1. Login → `/presupuesto`
2. KPI cards muestran valores reales del mes actual (o $0,00 si no hay transacciones)
3. Cambiar mes con el picker → KPIs y chart se actualizan
4. "Ver desglose" → tabla aparece/desaparece
5. "Editar presupuesto" → `BudgetForm` aparece con inputs numéricos por categoría
6. Ingresar porcentajes → "Guardar presupuesto" → toast "Presupuesto guardado ✓", form se cierra
7. Desglose muestra % presup. actualizado

- [ ] **Step 6.5: Commit**

```bash
git add src/pages/PresupuestoPage.tsx
git commit -m "feat: PresupuestoPage — KPIs, DonutChart, desglose, BudgetForm con feature parity"
```

---

## Entregables de Plan B

Al terminar este plan, el proyecto tiene:
- ✅ 5 TanStack Query hooks (`useTransactions`, `useCategories`, `useBudget`, `useMonthSummary`, `useTipoCambio`)
- ✅ AppLayout con TopNav (desktop) + BottomNav (mobile) + FAB
- ✅ Routing actualizado a nested routes (AppLayout monta una sola vez)
- ✅ `MonthYearPicker` único reutilizable
- ✅ `KPICard` con trend color
- ✅ `Toast` hook + banner
- ✅ `DonutChart` con paleta terracota
- ✅ `BudgetForm` con upsert optimistic
- ✅ `PresupuestoPage` con feature parity completa

**Siguiente paso:** Plan C — TransaccionesPage (TransactionForm + tabla virtualizada TanStack Virtual + filtros + CRUD: crear, editar, eliminar, duplicar).
