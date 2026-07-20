// screens-mp-desktop2.jsx — Compartidos · Categorías · Inversiones · Resumen · Nueva transacción (2/2)
/* global React, Icons, MpIcons, MPShell, MPBand, MPPickerD, MPDonut, MP_CATS, COMP_ROWS, CONFIG_GRUPOS, MES, YEAR, INV, CUOTAS, fmtARS, fmtUSD */

// ════════════════ COMPARTIDOS · desktop ════════════════
function CompartidosMPDesktop() {
  return (
    <MPShell active="Compartidos">
      <MPBand>
        <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
          <div style={{ display: 'flex' }}>
            <div className="mp-avatar" style={{ width: 52, height: 52, fontSize: 19 }}>D</div>
            <div className="mp-avatar" style={{ width: 52, height: 52, fontSize: 19, marginLeft: -14, background: 'rgba(255,255,255,0.35)' }}>A</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>Balance de junio · Le debés a Ama</div>
            <div className="num" style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.03em' }}>{fmtARS(23400)}</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.72)', marginTop: 4 }}>Debés pagarle {fmtARS(23400)} a Ama para saldar el mes</div>
          </div>
          <MPPickerD />
        </div>
      </MPBand>
      <div className="glass" style={{ borderRadius: 22, overflow: 'hidden', flex: 1 }}>
        <div style={{ padding: '15px 20px 11px', fontSize: 15, fontWeight: 700 }}>Gastos compartidos de junio</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 0.9fr 0.9fr', padding: '8px 20px', borderTop: '0.5px solid var(--g-hair)', borderBottom: '0.5px solid var(--g-hair)', fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase' }} className="g3">
          <div>Categoría · Descripción</div><div>Quién pagó</div><div style={{ textAlign: 'right' }}>Monto</div><div style={{ textAlign: 'right' }}>Fecha</div>
        </div>
        {COMP_ROWS.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 0.9fr 0.9fr', alignItems: 'center', padding: '12px 20px', borderBottom: '0.5px solid var(--g-hair)' }}>
            <div><span style={{ fontSize: 13.5, fontWeight: 600 }}>{r.cat}</span>{r.desc && <span className="g3" style={{ fontSize: 13, fontWeight: 500 }}> · {r.desc}</span>}</div>
            <div><span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap',
              color: r.chip === 'Pagué yo' ? 'var(--brand)' : r.chip === 'Pagó Ama' ? 'var(--brand-2)' : 'var(--info)',
              background: r.chip === 'Pagué yo' ? 'color-mix(in oklab,var(--brand) 15%,transparent)' : r.chip === 'Pagó Ama' ? 'color-mix(in oklab,var(--brand-2) 18%,transparent)' : 'color-mix(in oklab,var(--info) 14%,transparent)' }}>{r.chip}</span></div>
            <div className="num" style={{ textAlign: 'right', fontSize: 13.5, fontWeight: 700 }}>{fmtARS(r.monto)}</div>
            <div className="num g3" style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 600 }}>{r.fecha}</div>
          </div>
        ))}
      </div>
    </MPShell>
  );
}

// ════════════════ CATEGORÍAS · desktop (ConfigPage) ════════════════
function CategoriasMPDesktop() {
  return (
    <MPShell active="Categorías">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px' }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em' }}>Categorías y fuentes</h1>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, flex: 1, minHeight: 0 }}>
        {CONFIG_GRUPOS.map(([label, items], gi) => (
          <div key={gi} className="glass" style={{ borderRadius: 22, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 18px 10px', fontSize: 14.5, fontWeight: 700 }}>{label}</div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {items.map((it, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 18px', borderTop: '0.5px solid var(--g-hair)' }}>
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{it}</span>
                  <span className="g3"><Icons.edit s={14} /></span>
                  <span style={{ color: 'var(--neg)', opacity: .7 }}><MpIcons.trash s={14} /></span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, padding: '10px 18px 14px', borderTop: '0.5px solid var(--g-hair)' }}>
              <div className="glass glass-deep" style={{ flex: 1, borderRadius: 11, padding: '9px 13px', fontSize: 12.5, boxShadow: 'none' }}><span className="g3">Agregar…</span></div>
              <span className="mp-cava" style={{ width: 36, height: 36, color: 'var(--brand)' }}><Icons.plus s={17} sw={2.2} /></span>
            </div>
          </div>
        ))}
      </div>
    </MPShell>
  );
}

// ════════════════ NUEVA TRANSACCIÓN · desktop (TransactionForm real) ════════════════
function NuevaTransaccionMPDesktop() {
  const F = ({ label, children, span }) => (
    <div style={{ gridColumn: span ? '1 / -1' : undefined }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }} className="g2">{label}</div>
      {children}
    </div>
  );
  const box = { borderRadius: 13, padding: '11px 14px', fontSize: 13.5, fontWeight: 600, background: 'var(--g-mat-deep)', border: '0.5px solid var(--g-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 };
  return (
    <MPShell active="">
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="glass glass-strong" style={{ width: 640, borderRadius: 26, padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em' }}>Nueva transacción</h2>
            <div style={{ display: 'flex', gap: 4, borderRadius: 999, padding: 4, background: 'var(--g-mat-deep)', border: '0.5px solid var(--g-border)' }}>
              {[['Gasto', 'var(--neg)'], ['Ingreso', 'var(--pos)']].map(([t, col], i) => (
                <span key={i} style={{ borderRadius: 999, padding: '7px 18px', fontSize: 13, fontWeight: 700,
                  background: i === 0 ? col : 'transparent', color: i === 0 ? '#fff' : 'var(--g-text-3)' }}>{t}</span>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 12px' }}>
            <F label="Fecha"><div style={{ ...box }}><span>15/07/2026</span><span className="g3"><MpIcons.cal s={15} /></span></div></F>
            <F label="Categoría"><div style={{ ...box }}><span>Mercado</span><span className="g3"><Icons.chevD s={14} /></span></div></F>
            <F label="Monto">
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ ...box, flex: 1 }}><span className="num">48.900</span></div>
                <div style={{ ...box, width: 92 }}><span>ARS</span><span className="g3"><Icons.chevD s={14} /></span></div>
              </div>
            </F>
            <F label="Fuente de pago"><div style={{ ...box }}><span>Galicia VISA</span><span className="g3"><Icons.chevD s={14} /></span></div></F>
            <F label="Mes de liquidación"><div style={{ ...box }}><span>Agosto 2026</span><span className="g3"><Icons.chevD s={14} /></span></div></F>
            <F label="Responsabilidad"><div style={{ ...box, borderColor: 'color-mix(in oklab,var(--brand) 40%,transparent)', background: 'color-mix(in oklab,var(--brand) 10%,var(--g-mat-deep))' }}><span style={{ color: 'var(--brand)' }}>Lo pagamos juntos</span><span className="g3"><Icons.chevD s={14} /></span></div></F>
            <F label="Descripción (opcional)" span><div style={{ ...box }}><span className="g3">Coto — compra semanal</span></div></F>
          </div>
          <div className="num g3" style={{ fontSize: 12, fontWeight: 600, marginTop: 10 }}>≈ {fmtUSD(48900 / MES.mep)} al MEP · se divide 50/50 con Ama</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <div className="glass" style={{ flex: 1, height: 46, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--g-text-2)' }}>Cancelar</div>
            <div style={{ flex: 2, height: 46, borderRadius: 999, background: 'linear-gradient(150deg,var(--brand),var(--brand-2))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14.5, fontWeight: 700, boxShadow: '0 8px 22px color-mix(in oklab,var(--brand) 45%,transparent)' }}>Guardar gasto</div>
          </div>
        </div>
      </div>
    </MPShell>
  );
}

// ════════════════ INVERSIONES · desktop (tab real) ════════════════
function InversionesMPDesktop() {
  const totalPF = INV.plazos.reduce((s, p) => s + p.monto, 0);
  const totalAct = INV.activos.reduce((s, a) => s + a.val, 0);
  return (
    <MPShell active="Inversiones">
      <MPBand>
        <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>Total invertido <MpIcons.eye s={16} /></div>
            <div className="num" style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em' }}>{fmtARS(totalPF + totalAct)}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <span className="mp-wpill num">Plazos fijos {fmtARS(totalPF)}</span>
              <span className="mp-wpill num">Acciones & cripto {fmtARS(totalAct)}</span>
            </div>
          </div>
          <span className="mp-wbtn">+ Agregar</span>
        </div>
      </MPBand>
      {/* sección colapsable: Plazos Fijos (ARS/USD) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 6px 0', fontSize: 15, fontWeight: 700 }}>Plazos Fijos <span className="g3" style={{ fontSize: 12 }}>▾</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {INV.plazos.map((p, i) => (
          <div key={i} className="glass" style={{ borderRadius: 20, padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13.5, fontWeight: 700 }}>🏦 {p.banco} · ARS</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--save)', background: 'color-mix(in oklab,var(--save) 15%,transparent)', padding: '3px 10px', borderRadius: 999 }}>{p.tna}% TNA</span>
            </div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700, marginTop: 10 }}>{fmtARS(p.monto)}</div>
            <div style={{ fontSize: 12, marginTop: 4 }} className="g3">Vence {p.vence} · {p.dias} días</div>
          </div>
        ))}
      </div>
      {/* sección colapsable: Acciones & Cripto con precios live */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 6px 0', fontSize: 15, fontWeight: 700 }}>Acciones & Cripto <span className="g3" style={{ fontSize: 12 }}>▾</span><span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 600 }} className="g3">Precios: Coinbase / proxy · auto-refresh</span></div>
      <div className="glass" style={{ borderRadius: 22, overflow: 'hidden', flex: 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.7fr 0.9fr 0.9fr 0.7fr', padding: '10px 20px', borderBottom: '0.5px solid var(--g-hair)', fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase' }} className="g3">
          <div>Activo</div><div style={{ textAlign: 'right' }}>Cantidad</div><div style={{ textAlign: 'right' }}>P. compra</div><div style={{ textAlign: 'right' }}>Valor</div><div style={{ textAlign: 'right' }}>Var.</div>
        </div>
        {INV.activos.map((a, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.7fr 0.9fr 0.9fr 0.7fr', alignItems: 'center', padding: '11px 20px', borderBottom: '0.5px solid var(--g-hair)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <span className="mp-cava" style={{ width: 34, height: 34, fontSize: 16 }}>{a.emoji}</span>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{a.t}</span>
            </div>
            <div className="num g2" style={{ textAlign: 'right', fontSize: 13, fontWeight: 600 }}>{a.q}</div>
            <div className="num g3" style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 600 }}>{fmtARS(Math.round(a.val / (1 + a.chg / 100)))}</div>
            <div className="num" style={{ textAlign: 'right', fontSize: 13.5, fontWeight: 700 }}>{fmtARS(a.val)}</div>
            <div className="num" style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: a.chg >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{a.chg >= 0 ? '+' : ''}{a.chg}%</div>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px' }}>
          <span style={{ fontSize: 20 }}>💳</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Cuotas activas: {fmtARS(CUOTAS.esteMes)} este mes</div>
            <div style={{ fontSize: 11.5 }} className="g3">{CUOTAS.compras.map((c) => `${c.desc} ${c.cuota}`).join(' · ')}</div>
          </div>
          <span style={{ color: 'var(--brand)' }}><Icons.chevR s={18} /></span>
        </div>
      </div>
    </MPShell>
  );
}

// ════════════════ RESUMEN · desktop (page-resumen, chartEvolCombo) ════════════════
function ResumenMPDesktop() {
  const segs = MP_CATS;
  const segTotal = segs.reduce((s, x) => s + x.gastado, 0);
  const maxM = Math.max(...YEAR.flatMap((y) => [y.inc, y.exp]));
  const H = 150, W = 640;
  const pts = YEAR.map((y, i) => `${(i + 0.5) * (W / 12)},${H - ((y.inc - y.exp) / maxM) * H * 1.6}`).join(' ');
  return (
    <MPShell active="Resumen">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px' }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em' }}>Resumen</h1>
        <MPPickerD />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[['Ingresos', MES.ingresos, 'var(--pos)'], ['Gastos', MES.gastos, 'var(--neg)'], ['Neto', MES.balance, 'var(--pos)']].map((s, i) => (
          <div key={i} className="glass" style={{ borderRadius: 20, padding: '15px 18px' }}>
            <div style={{ fontSize: 12.5, fontWeight: 600 }} className="g2">{s[0]}</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700, marginTop: 5, color: s[2] }}>{fmtARS(s[1], { sign: s[0] === 'Neto' })}</div>
          </div>
        ))}
      </div>
      <div className="glass" style={{ borderRadius: 22, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Evolución · 12 meses</span>
          <span style={{ display: 'flex', gap: 14, fontSize: 12, fontWeight: 600 }} className="g2">
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--pos)' }} />Ingresos</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--neg)' }} />Gastos</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><i style={{ width: 14, height: 3, borderRadius: 2, background: 'var(--info)' }} />Neto (eje der.)</span>
          </span>
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: H }}>
            {YEAR.map((y, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 3, height: '100%', justifyContent: 'center' }}>
                <div style={{ width: '36%', height: `${y.inc / maxM * 100}%`, background: 'var(--pos)', borderRadius: '4px 4px 0 0' }} />
                <div style={{ width: '36%', height: `${y.exp / maxM * 100}%`, background: 'var(--neg)', borderRadius: '4px 4px 0 0', opacity: .85 }} />
              </div>
            ))}
          </div>
          <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <polyline points={pts} fill="none" stroke="var(--info)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          {YEAR.map((y, i) => <span key={i} className="num g3" style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: 600 }}>{y.m}</span>)}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 14, flex: 1, minHeight: 0 }}>
        <div className="glass" style={{ borderRadius: 22, padding: 20, display: 'flex', gap: 16, alignItems: 'center' }}>
          <MPDonut segs={segs.map((c) => ({ value: c.gastado, color: c.color }))} size={128} thickness={18} center={<><div style={{ fontSize: 10, fontWeight: 600 }} className="g3">Gastos</div><div className="num" style={{ fontSize: 15, fontWeight: 700 }}>$1,3M</div></>} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...segs].sort((a, b) => b.gastado - a.gastado).slice(0, 4).map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                <i style={{ width: 9, height: 9, borderRadius: 3, background: c.color, flex: 'none' }} />
                <span style={{ flex: 1, fontWeight: 600 }}>{c.label}</span>
                <span className="num g2" style={{ fontWeight: 700 }}>{Math.round(c.gastado / segTotal * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
        <div className="glass" style={{ borderRadius: 22, padding: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Promedios y totales del año</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '10px 24px' }}>
            {[['Ingreso promedio', fmtARS(1870000), 'var(--pos)'], ['Gasto promedio', fmtARS(1340000), 'var(--neg)'], ['Ahorro acumulado', fmtARS(MES.ahorroAcum), 'var(--save)'], ['Tasa de ahorro', `${MES.ahorroPct}%`, 'var(--save)']].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '0.5px solid var(--g-hair)', fontSize: 13 }}>
                <span style={{ fontWeight: 600 }} className="g2">{r[0]}</span>
                <span className="num" style={{ fontWeight: 700, color: r[2] }}>{r[1]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MPShell>
  );
}

Object.assign(window, { CompartidosMPDesktop, CategoriasMPDesktop, InversionesMPDesktop, ResumenMPDesktop, NuevaTransaccionMPDesktop });
