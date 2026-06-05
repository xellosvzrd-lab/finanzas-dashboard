// ─── SUPABASE CONFIG ─────────────────────────────────────────
const SUPABASE_URL = "https://eutarjfnlkcehhigqqxr.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1dGFyamZubGtjZWhoaWdxcXhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MTA0MTQsImV4cCI6MjA5MTA4NjQxNH0._7-AO_9_12PumXjDfcAWkgKyS4s_kXZTxb8EKSdxlAg";

// ─── SVG ICONS ────────────────────────────────────────────────
const IC_COPY  = `<i data-lucide="copy"    width="14" height="14" style="vertical-align:middle;pointer-events:none"></i>`;
const IC_EDIT  = `<i data-lucide="pencil"  width="14" height="14" style="vertical-align:middle;pointer-events:none"></i>`;
const IC_TRASH = `<i data-lucide="trash-2" width="14" height="14" style="vertical-align:middle;pointer-events:none"></i>`;

function _confettiBrief(opts = {}) {
  if (typeof confetti !== "function") return;
  confetti({
    particleCount: opts.count || 55,
    spread: opts.spread || 52,
    colors: opts.colors || ["#C8845A", "#5A8C6B", "#C8A45A", "#EDE8E3", "#C85A5A"],
    origin: opts.origin || { y: 0.55 },
    scalar: 0.82,
    gravity: 1.1,
    drift: 0,
  });
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ─── ESTADO GLOBAL ───────────────────────────────────────────
let supabaseClient  = null;
let supabaseSession = null;
let USUARIO         = "Daniel";
let PARTNER         = "Ama";
let comprasEnCuotas = [];  // loaded by cargarCuotasActivas()
let CATS_INGRESO_REAL = ["Sueldo", "Otros Ingresos"];
let tipoCambioMEP   = null;
let allTransac  = [];
let resumenData = [];
// Categorías de movimiento entre cuentas propias — se muestran en la tabla
// para control, pero se excluyen de todos los KPIs y gráficos financieros.
const CATS_TRANSFERENCIA = ["Internas"];
let categGasto           = [];
let categIngreso         = [];
let categFuentes         = [];
let categFuentesTC       = [];
let categResponsabilidad = ["Mío","Compartido","De Ama"];
let _todasCategorias     = [];

function _getCategoriaId(valor, tipoTx) {
  const tipoCat = tipoTx === 'Gasto' ? 'GASTO' : 'INGRESO';
  return _todasCategorias.find(c => c.valor === valor && c.tipo === tipoCat && c.usuario === USUARIO)?.id ?? null;
}
function _getCuentaId(fuente) {
  return _todasCategorias.find(c => c.valor === fuente && (c.tipo === 'FUENTE' || c.tipo === 'FUENTE_TC') && c.usuario === USUARIO)?.id ?? null;
}

let chartCat       = null;
let chartDonut     = null;
let chartEvolCombo = null;

// ─── COLORES DE GRÁFICOS (tokens → constantes JS) ────────────
const _C = {
  muted:      "#8C7B72",   // var(--text-muted)
  grid:       "rgba(45,41,38,0.06)",
  accent:     "#C8845A",   // var(--accent)
  green:      "#5A8C6B",   // var(--green)
  greenA75:   "rgba(90,140,107,.75)",
  greenA65:   "rgba(90,140,107,.65)",
  greenA90:   "rgba(90,140,107,.9)",
  red:        "#C85A5A",   // var(--red)
  redA75:     "rgba(200,90,90,.75)",
  redA65:     "rgba(200,90,90,.65)",
  redA90:     "rgba(200,90,90,.9)",
  accentA13:  "rgba(200,132,90,.13)",
  greenChart: "rgba(52,211,153,0.7)",
  redChart:   "rgba(248,113,113,0.7)",
};

// ─── PALETA DE COLORES ────────────────────────────────────────
const PALETTE = [
  "#A070D5",  // brand   — violeta
  "#6680DC",  // info    — azul índigo
  "#D97060",  // neg     — coral
  "#58C0B0",  // save    — teal
  "#C8BC45",  // warn    — ámbar
  "#DE7EC5",  // brand-2 — rosa
  "#5ABB78",  // pos     — verde
  "#E09060",  // naranja cálido
  "#7BA8D4",  // celeste
  "#B87AD4",  // lavanda
  "#80C878",  // lima
  "#D4A060",  // sienna
];

function _catColor(cat) {
  let h = 0;
  for (let i = 0; i < cat.length; i++) h = (Math.imul(31, h) + cat.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

// ─── SORT STATE ───────────────────────────────────────────────
let sortCol = "fecha";
let sortDir = -1; // -1 = desc (más reciente primero), 1 = asc

// ─── PENDING DELETE (undo) ────────────────────────────────────
let _pendingDelete = null; // { id, timeout }

// ─── CACHE (stale-while-revalidate) ───────────────────────────
const CACHE_TRANSAC_KEY = "fp_transac_cache";
const CACHE_CATEG_KEY   = "fp_categ_cache";

function guardarCacheTransac() {
  try { localStorage.setItem(CACHE_TRANSAC_KEY, JSON.stringify(allTransac)); } catch(e) {}
}
function guardarCacheCateg(data) {
  try { localStorage.setItem(CACHE_CATEG_KEY, JSON.stringify(data)); } catch(e) {}
}

