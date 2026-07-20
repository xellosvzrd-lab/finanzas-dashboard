// helpers.jsx — formatters + SVG chart primitives (theme-aware via CSS vars)
/* global React */

// ── money / number formatting (es-AR) ──────────────────────────
const fmtARS = (n, opts = {}) => {
  const { sign = false, decimals = 0 } = opts;
  const s = new Intl.NumberFormat('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Math.abs(n));
  const pre = n < 0 ? '−' : (sign ? '+' : '');
  return `${pre}$${s}`;
};
const fmtUSD = (n) => 'U$S ' + new Intl.NumberFormat('es-AR').format(Math.round(n));
const fmtPct = (n) => `${n > 0 ? '' : ''}${Math.round(n)}%`;
const fmtK = (n) => {
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace('.0', '') + 'M';
  if (a >= 1e3) return Math.round(n / 1e3) + 'k';
  return String(n);
};

// resolve a CSS var to a usable color in canvas (SVG gradients need real values
// sometimes, but currentColor + var() works for fills/strokes directly)
const cssvar = (v) => `var(${v})`;

// ── Donut / ring chart ─────────────────────────────────────────
// segments: [{label, value, color}]  color is a css var string
function Donut({ segments, size = 168, thickness = 22, gap = 3, center }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={thickness} />
        {segments.map((s, i) => {
          const frac = s.value / total;
          const len = Math.max(0, frac * c - gap);
          const off = -acc * c;
          acc += frac;
          return (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={s.color} strokeWidth={thickness} strokeLinecap="round"
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={off} />
          );
        })}
      </svg>
      {center && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          {center}
        </div>
      )}
    </div>
  );
}

// ── Horizontal category bars ───────────────────────────────────
// rows: [{label, value, color, pct?}]
function HBars({ rows, money = true }) {
  const max = Math.max(...rows.map((r) => r.value)) || 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</span>
          </div>
          <span className="num" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-dim)' }}>{money ? fmtARS(r.value) : r.value}</span>
          <div style={{ gridColumn: '1 / -1', height: 8, borderRadius: 6, background: 'var(--surface-2)', overflow: 'hidden' }}>
            <div style={{ width: `${(r.value / max) * 100}%`, height: '100%', borderRadius: 6, background: r.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 12-month columns: income vs expense ────────────────────────
// data: [{m, inc, exp}]
function MonthBars({ data, height = 150 }) {
  const max = Math.max(...data.flatMap((d) => [d.inc, d.exp])) || 1;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'min(1.4%, 10px)', height, width: '100%' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, height: '100%', justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: '100%', width: '100%', justifyContent: 'center' }}>
            <div title="ingresos" style={{ width: '38%', height: `${(d.inc / max) * 100}%`, background: 'var(--pos)', borderRadius: '4px 4px 0 0', minHeight: 3 }} />
            <div title="gastos" style={{ width: '38%', height: `${(d.exp / max) * 100}%`, background: 'var(--neg)', borderRadius: '4px 4px 0 0', minHeight: 3, opacity: .85 }} />
          </div>
          <span className="num" style={{ fontSize: 10, color: 'var(--text-faint)', fontWeight: 600 }}>{d.m}</span>
        </div>
      ))}
    </div>
  );
}

// ── Area sparkline ─────────────────────────────────────────────
function Spark({ points, w = 240, h = 56, color = 'var(--brand)', fill = true }) {
  const max = Math.max(...points), min = Math.min(...points);
  const rng = max - min || 1;
  const step = w / (points.length - 1);
  const pts = points.map((p, i) => [i * step, h - ((p - min) / rng) * (h - 8) - 4]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  const gid = 'sg' + Math.random().toString(36).slice(2, 7);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${gid})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Progress ring (single value) ───────────────────────────────
function Ring({ value, size = 60, thickness = 7, color = 'var(--brand)', children }) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const len = Math.min(1, Math.max(0, value)) * c;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={thickness} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={thickness} strokeLinecap="round" strokeDasharray={`${len} ${c}`} />
      </svg>
      {children && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>}
    </div>
  );
}

// ── Linear progress ────────────────────────────────────────────
function Bar({ value, color = 'var(--brand)', track = 'var(--surface-2)', h = 8 }) {
  return (
    <div style={{ height: h, borderRadius: 6, background: track, overflow: 'hidden', width: '100%' }}>
      <div style={{ width: `${Math.min(100, Math.max(0, value * 100))}%`, height: '100%', borderRadius: 6, background: color }} />
    </div>
  );
}

Object.assign(window, { fmtARS, fmtUSD, fmtPct, fmtK, cssvar, Donut, HBars, MonthBars, Spark, Ring, Bar });
