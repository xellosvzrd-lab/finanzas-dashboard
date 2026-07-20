// screens-key2.jsx — Transacciones + Compartidos (desktop)
/* global React, Shell, MonthPill, Icons, TXN, SHARED, fmtARS, Bar */

// ── TRANSACCIONES ───────────────────────────────────────────────
function Transacciones({ dark }) {
  const neto = TXN.reduce((s, t) => s + (t.cur === 'USD' ? 0 : t.amt), 0);
  const ingresos = TXN.filter((t) => t.tipo === 'ingreso' && t.cur === 'ARS').reduce((s, t) => s + t.amt, 0);
  const gastos = TXN.filter((t) => t.tipo === 'gasto' && t.cur === 'ARS').reduce((s, t) => s + t.amt, 0);
  const cols = ['Fecha', 'Categoría', '¿De quién?', 'Descripción', 'Fuente', 'Monto'];
  return (
    <Shell active="Transacciones" title="Transacciones" subtitle="Historial · Junio 2026"
      actions={<><button className="btn btn-ghost"><Icons.upload s={16} /> Importar</button><button className="btn btn-primary"><Icons.plus s={16} sw={2.2} /> Anotar</button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
        {/* filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 14px', minWidth: 240, color: 'var(--text-faint)' }}>
            <Icons.search s={17} /><span style={{ fontSize: 14 }}>Buscar descripción…</span>
          </div>
          <span className="chip on">Todos</span>
          <span className="chip">Ingresos</span>
          <span className="chip">Gastos</span>
          <div style={{ width: 1, height: 24, background: 'var(--line)' }} />
          <span className="chip">Categoría <Icons.chevD s={13} /></span>
          <span className="chip">Fuente <Icons.chevD s={13} /></span>
          <span className="chip">Mío · Ama <Icons.chevD s={13} /></span>
          <div style={{ flex: 1 }} />
          <span className="chip"><Icons.upload s={14} /> CSV</span>
        </div>

        {/* summary line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 26, padding: '2px 2px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-faint)', fontWeight: 600 }}>Neto del período</span>
            <span className="num" style={{ fontSize: 19, fontWeight: 700, color: neto >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{fmtARS(neto, { sign: true })}</span>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
            <span style={{ color: 'var(--text-faint)', fontWeight: 600 }}>↑ <span className="num pos" style={{ fontWeight: 700 }}>{fmtARS(ingresos)}</span></span>
            <span style={{ color: 'var(--text-faint)', fontWeight: 600 }}>↓ <span className="num neg" style={{ fontWeight: 700 }}>{fmtARS(Math.abs(gastos))}</span></span>
          </div>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 13, color: 'var(--text-faint)', fontWeight: 600 }}>{TXN.length} movimientos</span>
        </div>

        {/* table */}
        <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '88px 1.1fr 0.9fr 1.6fr 1.1fr 140px', padding: '13px 20px', borderBottom: '1px solid var(--line)', fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
            {cols.map((c, i) => <div key={i} style={{ textAlign: i === cols.length - 1 ? 'right' : 'left' }}>{c}</div>)}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {TXN.map((t, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '88px 1.1fr 0.9fr 1.6fr 1.1fr 140px', alignItems: 'center', padding: '13px 20px', borderBottom: '1px solid var(--line)' }}>
                <div className="num" style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600 }}>{t.d}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{t.emoji}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{t.cat}</span>
                </div>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                    background: t.who === 'Compartido' ? 'var(--brand-soft)' : 'var(--surface-2)',
                    color: t.who === 'Compartido' ? 'var(--brand)' : 'var(--text-dim)' }}>{t.who}</span>
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.desc}</div>
                <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>{t.src}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 7 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-faint)', border: '1px solid var(--line)', borderRadius: 6, padding: '1px 5px' }}>{t.cur}</span>
                  <span className="num" style={{ fontSize: 14, fontWeight: 700, color: t.amt > 0 ? 'var(--pos)' : 'var(--text)' }}>{fmtARS(t.amt, { sign: t.amt > 0 })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}

// ── COMPARTIDOS ─────────────────────────────────────────────────
function Compartidos({ dark }) {
  const debes = SHARED.balance < 0;
  const danielTotal = SHARED.rows.reduce((s, r) => s + r.daniel, 0);
  const amaTotal = SHARED.rows.reduce((s, r) => s + r.ama, 0);
  const total = danielTotal + amaTotal;
  return (
    <Shell active="Compartidos" title="Compartidos con Ama" subtitle="Junio 2026 · gastos divididos al 50%"
      actions={<><MonthPill /><button className="btn btn-primary">Saldar todo</button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, height: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 16 }}>
          {/* balance hero */}
          <div className="card" style={{ padding: 22, position: 'relative', overflow: 'hidden',
            background: debes ? 'linear-gradient(150deg, var(--neg), oklch(0.62 0.16 12))' : 'linear-gradient(150deg, var(--pos), oklch(0.66 0.15 165))', color: '#fff', border: 'none' }}>
            <div style={{ fontSize: 14, fontWeight: 600, opacity: .92 }}>{debes ? '🫶 Le debés a Ama' : '🫶 Ama te debe'}</div>
            <div className="num" style={{ fontSize: 40, fontWeight: 700, marginTop: 6 }}>{fmtARS(Math.abs(SHARED.balance))}</div>
            <div style={{ fontSize: 13, opacity: .9, marginTop: 6 }}>Balance neto del mes, después de dividir todo.</div>
            <button className="btn" style={{ background: 'rgba(255,255,255,.22)', color: '#fff', marginTop: 18, backdropFilter: 'blur(4px)' }}>Registrar pago →</button>
          </div>
          {/* contribution */}
          <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 18 }}>Contribución del mes</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, flex: 1, justifyContent: 'center' }}>
              {[['Daniel', danielTotal, 'var(--info)'], ['Ama', amaTotal, 'var(--brand-2)']].map((p, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 7 }}>
                    <span style={{ fontWeight: 700 }}>{p[0]}</span>
                    <span className="num" style={{ fontWeight: 700, color: 'var(--text-dim)' }}>{fmtARS(p[1])} · {Math.round(p[1] / total * 100)}%</span>
                  </div>
                  <Bar value={p[1] / total} color={p[2]} h={12} />
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 14, display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
              <span style={{ color: 'var(--text-faint)', fontWeight: 600 }}>Total compartido</span>
              <span className="num" style={{ fontWeight: 700 }}>{fmtARS(total)}</span>
            </div>
          </div>
        </div>

        {/* split table */}
        <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 22px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Desglose por categoría</span>
            <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>· cada valor ya dividido ÷2</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', padding: '10px 22px', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
            <div>Categoría</div><div style={{ textAlign: 'right' }}>Daniel pagó</div><div style={{ textAlign: 'right' }}>Ama pagó</div><div style={{ textAlign: 'right' }}>Neto</div>
          </div>
          {SHARED.rows.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', alignItems: 'center', padding: '14px 22px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{r.emoji}</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{r.cat}</span>
              </div>
              <div className="num" style={{ textAlign: 'right', fontSize: 13.5, fontWeight: 600, color: 'var(--text-dim)' }}>{fmtARS(r.daniel)}</div>
              <div className="num" style={{ textAlign: 'right', fontSize: 13.5, fontWeight: 600, color: 'var(--text-dim)' }}>{fmtARS(r.ama)}</div>
              <div className="num" style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, color: r.neto === 0 ? 'var(--text-faint)' : r.neto > 0 ? 'var(--pos)' : 'var(--neg)' }}>{r.neto === 0 ? '—' : fmtARS(r.neto, { sign: true })}</div>
            </div>
          ))}
          <div style={{ padding: '12px 22px', fontSize: 12, color: 'var(--text-faint)' }}>Neto positivo = Ama te debe · negativo = vos le debés a Ama.</div>
        </div>
      </div>
    </Shell>
  );
}

Object.assign(window, { Transacciones, Compartidos });
