// screens-mobile.jsx — Cálida mobile: Resumen, Transacciones, Compartidos
/* global React, IOSDevice, NavCalida, TopPad, Icons, MES, CATS, YEAR, TXN, SHARED,
   fmtARS, fmtUSD, Donut, MonthBars, Spark, Bar */

// shared mobile header
const MHeader = ({ title, emoji, right }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px 12px' }}>
    <div>
      <h1 style={{ fontSize: 24 }}>{emoji} {title}</h1>
      <div className="chip" style={{ marginTop: 7, background: 'var(--surface-2)', fontWeight: 700, color: 'var(--text)' }}>Junio 2026 <Icons.chevD s={14} /></div>
    </div>
    {right || <div style={{ width: 40, height: 40, borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}><Icons.bell s={18} /></div>}
  </div>
);

// ════════════════════════ RESUMEN (mobile) ════════════════════════
function ResumenM({ dark }) {
  const segs = CATS.filter((c) => c.label !== 'Ahorro').map((c) => ({ label: c.label, value: c.value, color: c.color }));
  const segTotal = segs.reduce((s, x) => s + x.value, 0);
  const top = [...CATS].sort((a, b) => b.value - a.value).slice(0, 4);
  return (
    <IOSDevice width={402} height={874} dark={dark}>
      <div className="fin" style={{ overflow: 'hidden' }}>
        <TopPad>
          <MHeader title="Resumen" emoji="📊" />
          {/* KPI duo */}
          <div style={{ display: 'flex', gap: 10, padding: '4px 16px 0' }}>
            {[['Ingresos', MES.ingresos, 'var(--pos)', '↑ 4%'], ['Gastos', MES.gastos, 'var(--neg)', '↓ 2%']].map((s, i) => (
              <div key={i} className="card" style={{ flex: 1, padding: 15 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--text-faint)', fontWeight: 600 }}>{s[0]}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: s[2] }}>{s[3]}</span>
                </div>
                <div className="num" style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: s[2] }}>{fmtARS(s[1])}</div>
                <div style={{ marginTop: 8 }}><Spark points={i ? YEAR.map((y) => y.exp) : YEAR.map((y) => y.inc)} w={150} h={28} color={s[2]} /></div>
              </div>
            ))}
          </div>
          {/* balance band */}
          <div className="card" style={{ margin: '12px 16px 0', padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--brand-soft)', borderColor: 'color-mix(in oklab, var(--brand) 30%, transparent)' }}>
            <div>
              <div style={{ fontSize: 12.5, color: 'var(--brand)', fontWeight: 700 }}>Balance del mes</div>
              <div className="num" style={{ fontSize: 26, fontWeight: 700, marginTop: 2 }}>{fmtARS(MES.balance, { sign: true })}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', fontWeight: 600 }}>Ahorro</div>
              <div className="num" style={{ fontSize: 20, fontWeight: 700, color: 'var(--save)' }}>{MES.ahorroPct}%</div>
            </div>
          </div>
          {/* donut */}
          <div className="card" style={{ margin: '12px 16px 0', padding: 18 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Gastos por categoría</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Donut segments={segs} size={130} thickness={18} center={<><div style={{ fontSize: 10.5, color: 'var(--text-faint)', fontWeight: 600 }}>Total</div><div className="num" style={{ fontSize: 16, fontWeight: 700 }}>$1,37M</div></>} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {top.map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                    <i style={{ width: 9, height: 9, borderRadius: 3, background: c.color, flex: 'none' }} />
                    <span style={{ flex: 1, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</span>
                    <span className="num" style={{ fontWeight: 700, color: 'var(--text-faint)' }}>{Math.round(c.value / segTotal * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* 12m */}
          <div className="card" style={{ margin: '12px 16px 0', padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 14.5, fontWeight: 700 }}>Últimos 12 meses</span>
              <span style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--text-faint)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><i style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--pos)' }} />Ing</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><i style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--neg)' }} />Gas</span>
              </span>
            </div>
            <MonthBars data={YEAR} height={96} />
          </div>
          <div style={{ flex: 1, minHeight: 14 }} />
          <NavCalida active="Resumen" />
        </TopPad>
      </div>
    </IOSDevice>
  );
}

// ════════════════════════ TRANSACCIONES (mobile) ════════════════════════
function TransaccionesM({ dark }) {
  // group by day
  const groups = TXN.reduce((acc, t) => { (acc[t.d] = acc[t.d] || []).push(t); return acc; }, {});
  return (
    <IOSDevice width={402} height={874} dark={dark}>
      <div className="fin" style={{ overflow: 'hidden' }}>
        <TopPad>
          <MHeader title="Movimientos" emoji="🧾" right={
            <div style={{ width: 40, height: 40, borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}><Icons.upload s={18} /></div>
          } />
          {/* search */}
          <div style={{ padding: '2px 16px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 13, padding: '11px 14px', color: 'var(--text-faint)' }}>
              <Icons.search s={17} /><span style={{ fontSize: 14 }}>Buscar movimiento…</span>
            </div>
          </div>
          {/* filter chips */}
          <div style={{ display: 'flex', gap: 8, padding: '0 16px 12px', overflow: 'hidden' }}>
            <span className="chip on">Todos</span>
            <span className="chip">Ingresos</span>
            <span className="chip">Gastos</span>
            <span className="chip">Compartido</span>
          </div>
          {/* list grouped */}
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {Object.entries(groups).slice(0, 4).map(([day, items], gi) => (
              <div key={gi}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)', letterSpacing: '.04em', padding: '0 4px 7px' }}>{day === TXN[0].d ? 'Hoy' : day}</div>
                <div className="card" style={{ borderRadius: 18, overflow: 'hidden' }}>
                  {items.map((t, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flex: 'none' }}>{t.emoji}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.desc}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {t.src}
                          {t.who === 'Compartido' && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand)', background: 'var(--brand-soft)', padding: '1px 6px', borderRadius: 999 }}>÷ Ama</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flex: 'none' }}>
                        <div className="num" style={{ fontSize: 14.5, fontWeight: 700, color: t.amt > 0 ? 'var(--pos)' : 'var(--text)' }}>{fmtARS(t.amt, { sign: t.amt > 0 })}</div>
                        {t.cur === 'USD' && <div style={{ fontSize: 10, color: 'var(--text-faint)', fontWeight: 700 }}>USD</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, minHeight: 14 }} />
          <NavCalida active="" />
        </TopPad>
      </div>
    </IOSDevice>
  );
}

// ════════════════════════ COMPARTIDOS (mobile) ════════════════════════
function CompartidosM({ dark }) {
  const debes = SHARED.balance < 0;
  const danielTotal = SHARED.rows.reduce((s, r) => s + r.daniel, 0);
  const amaTotal = SHARED.rows.reduce((s, r) => s + r.ama, 0);
  const total = danielTotal + amaTotal;
  return (
    <IOSDevice width={402} height={874} dark={dark}>
      <div className="fin" style={{ overflow: 'hidden' }}>
        <TopPad>
          <MHeader title="Con Ama" emoji="🫶" />
          {/* hero balance */}
          <div style={{ margin: '4px 16px 0', borderRadius: 26, padding: '22px 22px', position: 'relative', overflow: 'hidden', color: '#fff',
            background: debes ? 'linear-gradient(150deg, var(--neg), oklch(0.62 0.16 12))' : 'linear-gradient(150deg, var(--pos), oklch(0.66 0.15 165))',
            boxShadow: '0 16px 36px color-mix(in oklab, var(--neg) 32%, transparent)' }}>
            <div style={{ position: 'absolute', width: 150, height: 150, borderRadius: 999, right: -40, top: -50, background: 'rgba(255,255,255,.16)' }} />
            <div style={{ fontSize: 13.5, fontWeight: 600, opacity: .92, position: 'relative' }}>{debes ? 'Le debés a Ama' : 'Ama te debe'}</div>
            <div className="num" style={{ fontSize: 44, fontWeight: 700, marginTop: 6, position: 'relative' }}>{fmtARS(Math.abs(SHARED.balance))}</div>
            <button className="btn" style={{ background: 'rgba(255,255,255,.22)', color: '#fff', marginTop: 16, position: 'relative', width: '100%' }}>Registrar pago →</button>
          </div>
          {/* contribution */}
          <div className="card" style={{ margin: '14px 16px 0', padding: 18 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 16 }}>Contribución del mes</div>
            {[['Daniel', danielTotal, 'var(--info)'], ['Ama', amaTotal, 'var(--brand-2)']].map((p, i) => (
              <div key={i} style={{ marginBottom: i ? 0 : 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ fontWeight: 700 }}>{p[0]}</span>
                  <span className="num" style={{ fontWeight: 700, color: 'var(--text-dim)' }}>{fmtARS(p[1])} · {Math.round(p[1] / total * 100)}%</span>
                </div>
                <Bar value={p[1] / total} color={p[2]} h={11} />
              </div>
            ))}
          </div>
          {/* breakdown */}
          <div style={{ padding: '16px 20px 8px', fontSize: 14.5, fontWeight: 700 }}>Desglose por categoría</div>
          <div className="card" style={{ margin: '0 16px', borderRadius: 18, overflow: 'hidden' }}>
            {SHARED.rows.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flex: 'none' }}>{r.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{r.cat}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>Vos {fmtARS(r.daniel)} · Ama {fmtARS(r.ama)}</div>
                </div>
                <div className="num" style={{ fontSize: 14, fontWeight: 700, color: r.neto === 0 ? 'var(--text-faint)' : r.neto > 0 ? 'var(--pos)' : 'var(--neg)' }}>{r.neto === 0 ? '—' : fmtARS(r.neto, { sign: true })}</div>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, minHeight: 14 }} />
          <NavCalida active="Compartidos" />
        </TopPad>
      </div>
    </IOSDevice>
  );
}

Object.assign(window, { ResumenM, TransaccionesM, CompartidosM });
