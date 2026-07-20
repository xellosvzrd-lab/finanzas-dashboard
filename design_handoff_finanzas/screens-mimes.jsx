// screens-mimes.jsx — "Mi mes" hero in 3 directions
/* global React, IOSDevice, MES, CATS, Icons, fmtARS, fmtUSD, Ring, Bar, Spark, YEAR */

// budget helpers
const budgetOf = (c) => Math.round((c.pctSueldo / 100) * MES.sueldo);
const MICATS = CATS.filter((c) => c.label !== 'Ahorro').map((c) => {
  const b = budgetOf(c);
  return { ...c, budget: b, used: Math.min(1, c.gastado / b), restante: b - c.gastado };
});

const TopPad = ({ children, style }) => (
  <div style={{ paddingTop: 56, minHeight: '100%', display: 'flex', flexDirection: 'column', ...style }}>{children}</div>
);

// ════════════════════════════════════════════════════════════════
// A · CÁLIDA  (recomendada) — personal, redonda, violeta
// ════════════════════════════════════════════════════════════════
function MiMesCalida({ dark }) {
  return (
    <IOSDevice width={402} height={874} dark={dark}>
      <div className="fin" style={{ overflow: 'hidden' }}>
        <TopPad>
          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px 14px' }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-faint)', fontWeight: 600 }}>Hola, Dani 👋</div>
              <div className="chip" style={{ marginTop: 6, background: 'var(--surface-2)', fontWeight: 700, color: 'var(--text)' }}>Junio 2026 <Icons.chevD s={14} /></div>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}><Icons.bell s={18} /></div>
          </div>

          {/* HERO */}
          <div style={{ margin: '0 16px', borderRadius: 28, padding: '24px 22px', position: 'relative', overflow: 'hidden',
            background: 'linear-gradient(150deg, var(--brand) 0%, var(--brand-2) 100%)', color: '#fff',
            boxShadow: '0 18px 40px color-mix(in oklab, var(--brand) 40%, transparent)' }}>
            <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: 999, right: -50, top: -60, background: 'rgba(255,255,255,.16)' }} />
            <div style={{ fontSize: 14, fontWeight: 600, opacity: .9, position: 'relative' }}>💸 Te queda para gastar</div>
            <div className="num" style={{ fontSize: 52, fontWeight: 700, lineHeight: 1.05, marginTop: 6, position: 'relative' }}>{fmtARS(MES.quedaMes)}</div>
            <div style={{ fontSize: 13.5, opacity: .9, marginTop: 4, position: 'relative' }}>de tu sueldo, hasta fin de mes</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18, position: 'relative' }}>
              <div style={{ flex: 1, background: 'rgba(255,255,255,.16)', borderRadius: 16, padding: '11px 14px', backdropFilter: 'blur(4px)' }}>
                <div style={{ fontSize: 11.5, opacity: .85, fontWeight: 600 }}>Por día</div>
                <div className="num" style={{ fontSize: 19, fontWeight: 700 }}>{fmtARS(MES.porDia)}</div>
              </div>
              <div style={{ flex: 1, background: 'rgba(255,255,255,.16)', borderRadius: 16, padding: '11px 14px', backdropFilter: 'blur(4px)' }}>
                <div style={{ fontSize: 11.5, opacity: .85, fontWeight: 600 }}>En USD</div>
                <div className="num" style={{ fontSize: 19, fontWeight: 700 }}>{fmtUSD(MES.quedaMes / MES.mep)}</div>
              </div>
            </div>
          </div>

          {/* quick stats */}
          <div style={{ display: 'flex', gap: 10, padding: '16px 16px 4px' }}>
            {[['Ingresos', MES.ingresos, 'var(--pos)', '↑'], ['Gastos', MES.gastos, 'var(--neg)', '↓'], ['Ahorro', MES.ahorroPct + '%', 'var(--save)', '🐷']].map((s, i) => (
              <div key={i} className="card" style={{ flex: 1, padding: '12px 13px' }}>
                <div style={{ fontSize: 11.5, color: 'var(--text-faint)', fontWeight: 600 }}>{s[0]}</div>
                <div className="num" style={{ fontSize: 16.5, fontWeight: 700, marginTop: 3, color: s[2] }}>{typeof s[1] === 'number' ? fmtARS(s[1]) : s[1]}</div>
              </div>
            ))}
          </div>

          {/* desglose del sueldo */}
          <div className="card" style={{ margin: '12px 16px 0', borderRadius: 18, padding: '6px 0' }}>
            {[['Sueldo', MES.sueldo, 'var(--text)'], ['Presupuestado', MES.presupuestado, 'var(--text-dim)'], ['Gastado', MES.gastadoReal, 'var(--neg)'], ['Margen planeado', MES.margenPlaneado, 'var(--save)']].map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                <span style={{ fontSize: 13.5, color: 'var(--text-dim)', fontWeight: 600 }}>{r[0]}</span>
                <span className="num" style={{ fontSize: 14.5, fontWeight: 700, color: r[2] }}>{fmtARS(r[1])}</span>
              </div>
            ))}
          </div>

          {/* cuotas activas */}
          <div className="card" style={{ margin: '12px 16px 0', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7 }}>💳 Cuotas activas <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)', background: 'var(--brand-soft)', padding: '2px 8px', borderRadius: 999 }}>{CUOTAS.compras.length}</span></span>
              <span style={{ fontSize: 12, color: 'var(--text-faint)', fontWeight: 600 }}>Ver todas</span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 12, padding: '9px 12px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 600 }}>Este mes</div>
                <div className="num" style={{ fontSize: 16, fontWeight: 700 }}>{fmtARS(CUOTAS.esteMes)}</div>
              </div>
              <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 12, padding: '9px 12px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 600 }}>Comprometido futuro</div>
                <div className="num" style={{ fontSize: 16, fontWeight: 700, color: 'var(--warn)' }}>{fmtARS(CUOTAS.futuro)}</div>
              </div>
            </div>
          </div>

          {/* categorías */}
          <div style={{ padding: '16px 20px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap' }}>Tus categorías</span>
            <span style={{ fontSize: 13, color: 'var(--brand)', fontWeight: 600, whiteSpace: 'nowrap' }}>Ver todas</span>
          </div>
          <div className="card" style={{ margin: '0 16px', borderRadius: 22, padding: '4px 0' }}>
            {MICATS.slice(0, 4).map((c, i) => (
              <div key={i} style={{ padding: '12px 16px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 11, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{c.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{c.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Quedan {fmtARS(c.restante)}</div>
                  </div>
                  <div className="num" style={{ fontSize: 13, fontWeight: 700, color: c.used >= 1 ? 'var(--neg)' : 'var(--text-dim)' }}>{Math.round(c.used * 100)}%</div>
                </div>
                <div style={{ marginTop: 9, marginLeft: 47 }}><Bar value={c.used} color={c.used >= 1 ? 'var(--neg)' : c.color} h={6} /></div>
              </div>
            ))}
          </div>
          <div style={{ flex: 1 }} />

          {/* bottom nav */}
          <NavCalida />
        </TopPad>
      </div>
    </IOSDevice>
  );
}
function NavCalida({ active = 'Mi mes' }) {
  const items = [['Mi mes', Icons.home], ['Resumen', Icons.chart], ['add'], ['Compartidos', Icons.users], ['Más', Icons.grid]];
  return (
    <div style={{ position: 'sticky', bottom: 0, padding: '10px 18px 30px', background: 'linear-gradient(0deg, var(--bg) 60%, transparent)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: '10px 16px', boxShadow: 'var(--shadow-card)' }}>
        {items.map((it, i) => it[0] === 'add' ? (
          <div key={i} style={{ width: 50, height: 50, borderRadius: 16, background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px color-mix(in oklab,var(--brand) 45%,transparent)', marginTop: -2 }}><Icons.plus s={24} sw={2.2} /></div>
        ) : (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: it[0] === active ? 'var(--brand)' : 'var(--text-faint)' }}>
            {React.createElement(it[1], { s: 21 })}
            <span style={{ fontSize: 10, fontWeight: 600 }}>{it[0]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// B · EDITORIAL — tipográfica, ledger, hairlines, un solo acento
// ════════════════════════════════════════════════════════════════
function MiMesEditorial({ dark }) {
  const meta = [['Por día', fmtARS(MES.porDia)], ['Días', MES.diasRestantes], ['En USD', fmtUSD(MES.quedaMes / MES.mep)]];
  return (
    <IOSDevice width={402} height={874} dark={dark}>
      <div className="fin" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <TopPad style={{ padding: '56px 0 0' }}>
          {/* top bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 22px 16px' }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>Mi mes</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 14, fontWeight: 700 }}>
              <span style={{ color: 'var(--text-faint)' }}>‹</span>
              <span>Junio 2026</span>
              <span style={{ color: 'var(--text-faint)' }}>›</span>
            </div>
          </div>
          <div style={{ height: 1, background: 'var(--text)', opacity: .9, margin: '0 22px' }} />

          {/* hero number */}
          <div style={{ padding: '26px 22px 18px' }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--brand)' }}>Lo que te queda</div>
            <div className="num" style={{ fontSize: 64, fontWeight: 700, lineHeight: 1, marginTop: 8, letterSpacing: '-0.04em' }}>{fmtARS(MES.quedaMes)}</div>
            <div style={{ fontSize: 13.5, color: 'var(--text-dim)', marginTop: 8 }}>Sueldo {fmtARS(MES.sueldo)} − gastado {fmtARS(MES.sueldo - MES.quedaMes)}</div>
          </div>
          {/* meta strip */}
          <div style={{ display: 'flex', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', margin: '0 22px' }}>
            {meta.map((m, i) => (
              <div key={i} style={{ flex: 1, padding: '14px 4px', borderLeft: i ? '1px solid var(--line)' : 'none' }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>{m[0]}</div>
                <div className="num" style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{m[1]}</div>
              </div>
            ))}
          </div>

          {/* ledger */}
          <div style={{ padding: '20px 22px 4px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>Por categoría</span>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>Restante</span>
          </div>
          <div style={{ padding: '0 22px' }}>
            {MICATS.slice(0, 5).map((c, i) => (
              <div key={i} style={{ padding: '13px 0', borderTop: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600 }}>{c.label}</span>
                  <span className="num" style={{ fontSize: 14.5, fontWeight: 700, color: c.restante < 0 ? 'var(--neg)' : 'var(--text)' }}>{fmtARS(c.restante)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                  <div style={{ flex: 1, height: 3, background: 'var(--surface-2)' }}>
                    <div style={{ width: `${c.used * 100}%`, height: '100%', background: c.used >= 1 ? 'var(--neg)' : 'var(--brand)' }} />
                  </div>
                  <span className="num" style={{ fontSize: 11.5, color: 'var(--text-faint)', fontWeight: 600, width: 34, textAlign: 'right' }}>{Math.round(c.used * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          {/* text tab bar */}
          <div style={{ display: 'flex', justifyContent: 'space-around', padding: '14px 10px 30px', borderTop: '1px solid var(--line)', fontSize: 12.5, fontWeight: 700 }}>
            {['Mi mes', 'Resumen', 'Mov.', 'Ama', 'Más'].map((t, i) => (
              <span key={i} style={{ color: i === 0 ? 'var(--brand)' : 'var(--text-faint)', letterSpacing: '.02em' }}>{t}</span>
            ))}
          </div>
        </TopPad>
      </div>
    </IOSDevice>
  );
}

// ════════════════════════════════════════════════════════════════
// C · GLASS — fintech sleek, anillo de presupuesto, FAB
// ════════════════════════════════════════════════════════════════
function MiMesGlass({ dark }) {
  const usadoPct = (MES.sueldo - MES.quedaMes) / MES.sueldo;
  return (
    <IOSDevice width={402} height={874} dark={dark}>
      <div className="fin" style={{ overflow: 'hidden' }}>
        {/* gradient blobs */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', width: 280, height: 280, borderRadius: 999, top: -60, left: -40, background: 'radial-gradient(circle, color-mix(in oklab,var(--brand) 55%, transparent), transparent 70%)', filter: 'blur(20px)' }} />
          <div style={{ position: 'absolute', width: 240, height: 240, borderRadius: 999, top: 120, right: -70, background: 'radial-gradient(circle, color-mix(in oklab,var(--brand-2) 50%, transparent), transparent 70%)', filter: 'blur(20px)' }} />
        </div>
        <TopPad style={{ position: 'relative' }}>
          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 22px 10px' }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Mi mes</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[Icons.spark, Icons.bell].map((I, i) => (
                <div key={i} style={{ width: 38, height: 38, borderRadius: 999, background: 'rgba(255,255,255,.07)', border: '1px solid var(--line-strong)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)' }}>{React.createElement(I, { s: 17 })}</div>
              ))}
            </div>
          </div>

          {/* ring hero */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 0 6px' }}>
            <div style={{ position: 'relative', width: 230, height: 230 }}>
              <svg width="230" height="230" style={{ transform: 'rotate(-90deg)' }}>
                <defs>
                  <linearGradient id="gring" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="var(--brand)" /><stop offset="100%" stopColor="var(--brand-2)" />
                  </linearGradient>
                </defs>
                <circle cx="115" cy="115" r="100" fill="none" stroke="var(--surface-2)" strokeWidth="16" />
                <circle cx="115" cy="115" r="100" fill="none" stroke="url(#gring)" strokeWidth="16" strokeLinecap="round"
                  strokeDasharray={`${(1 - usadoPct) * 2 * Math.PI * 100} ${2 * Math.PI * 100}`} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 12.5, color: 'var(--text-faint)', fontWeight: 600 }}>Te queda</div>
                <div className="num" style={{ fontSize: 35, fontWeight: 700, lineHeight: 1.15 }}>{fmtARS(MES.quedaMes)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{Math.round((1 - usadoPct) * 100)}% del sueldo</div>
              </div>
            </div>
          </div>

          {/* glass stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '14px 18px 0' }}>
            {[['Por día', fmtARS(MES.porDia), '📅'], ['Saldo USD', fmtUSD(MES.quedaMes / MES.mep), '💵'], ['Gastos', fmtARS(MES.gastos), '💳'], ['Ahorro', MES.ahorroPct + '%', '🐷']].map((s, i) => (
              <div key={i} style={{ borderRadius: 20, padding: '14px 16px', background: 'rgba(255,255,255,.06)', border: '1px solid var(--line-strong)', backdropFilter: 'blur(14px)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>{s[0]} <span>{s[2]}</span></div>
                <div className="num" style={{ fontSize: 20, fontWeight: 700, marginTop: 6 }}>{s[1]}</div>
              </div>
            ))}
          </div>
          <div style={{ flex: 1 }} />

          {/* glass bottom nav + FAB */}
          <div style={{ position: 'relative', padding: '0 22px 30px' }}>
            <div style={{ height: 64, borderRadius: 28, background: 'rgba(255,255,255,.07)', border: '1px solid var(--line-strong)', backdropFilter: 'blur(18px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px', boxShadow: 'var(--shadow-pop)' }}>
              {[Icons.home, Icons.chart, null, Icons.users, Icons.grid].map((I, i) => I ? (
                <div key={i} style={{ color: i === 0 ? 'var(--brand)' : 'var(--text-faint)' }}>{React.createElement(I, { s: 22 })}</div>
              ) : <div key={i} style={{ width: 30 }} />)}
            </div>
            <div style={{ position: 'absolute', left: '50%', top: -6, transform: 'translateX(-50%)', width: 56, height: 56, borderRadius: 20, background: 'linear-gradient(150deg,var(--brand),var(--brand-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 10px 26px color-mix(in oklab,var(--brand) 55%,transparent)' }}><Icons.plus s={26} sw={2.2} /></div>
          </div>
        </TopPad>
      </div>
    </IOSDevice>
  );
}

Object.assign(window, { MiMesCalida, MiMesEditorial, MiMesGlass, NavCalida, TopPad });
