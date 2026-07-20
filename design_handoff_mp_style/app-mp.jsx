// app-mp.jsx — canvas: rediseño inspirado en Mercado Pago (estructura MP + warm liquid glass)
/* global React, ReactDOM, DesignCanvas, DCSection, DCArtboard, Icons,
   MiMesMP, TransaccionesMP, CompartidosMP, CategoriasMP,
   MiMesMPDesktop, TransaccionesMPDesktop, CompartidosMPDesktop, CategoriasMPDesktop, InversionesMPDesktop, ResumenMPDesktop, NuevaTransaccionMPDesktop */

function MPToolbar({ theme, setTheme }) {
  const glass = {
    backdropFilter: 'blur(32px) saturate(180%) brightness(1.05)',
    WebkitBackdropFilter: 'blur(32px) saturate(180%) brightness(1.05)',
    background: 'rgba(250,253,251,0.55)',
    border: '0.5px solid rgba(246,252,248,0.8)',
    boxShadow: 'inset 1.2px 1.2px 0 rgba(255,255,255,0.9), inset -1px -1px 1px rgba(255,255,255,0.4), 0 6px 24px rgba(20,70,45,0.18)',
  };
  return (
    <div style={{ position: 'fixed', top: 16, left: 0, right: 0, zIndex: 90, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', pointerEvents: 'none', fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif' }}>
      <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 10, ...glass, borderRadius: 18, padding: '9px 16px' }}>
        <span style={{ fontSize: 18 }}>💚</span>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#14201a', lineHeight: 1.1 }}>Finanzas — MP Style</div>
          <div style={{ fontSize: 11.5, color: 'rgba(20,32,26,0.55)' }}>Estructura MP 2026 · verde bosque glass</div>
        </div>
      </div>
      <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 4, ...glass, borderRadius: 999, padding: 4 }}>
        {[['light', Icons.sun, 'Claro'], ['dark', Icons.moon, 'Oscuro']].map(([k, Ic, label]) => {
          const on = theme === k;
          return (
            <button key={k} onClick={() => setTheme(k)} style={{ display: 'flex', alignItems: 'center', gap: 7, border: 'none', cursor: 'pointer',
              background: on ? 'rgba(20,70,45,0.14)' : 'transparent',
              boxShadow: on ? 'inset 1px 1px 0 rgba(255,255,255,0.6), 0 2px 8px rgba(20,70,45,0.14)' : 'none',
              color: on ? '#14201a' : 'rgba(20,32,26,0.45)',
              borderRadius: 999, padding: '7px 14px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', transition: 'all .15s' }}>
              {React.createElement(Ic, { s: 15 })}{label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function App() {
  const [theme, setTheme] = React.useState('light');
  React.useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  return (
    <>
      <MPToolbar theme={theme} setTheme={setTheme} />
      <DesignCanvas>
        <DCSection id="mp-mobile" title="MP Style · mobile" subtitle="Basado en el repo real finanzas-dashboard (index.html): bottom nav con CTA central, Mi mes con meta de ahorro y cuotas, barra de neto en Transacciones.">
          <DCArtboard id="m-mes" label="Mi mes" width={402} height={874}><MiMesMP /></DCArtboard>
          <DCArtboard id="m-transac" label="Transacciones" width={402} height={874}><TransaccionesMP /></DCArtboard>
          <DCArtboard id="m-comp" label="Compartidos" width={402} height={874}><CompartidosMP /></DCArtboard>
          <DCArtboard id="m-cat" label="Categorías" width={402} height={874}><CategoriasMP /></DCArtboard>
        </DCSection>
        <DCSection id="mp-desktop" title="MP Style · escritorio" subtitle="Los 6 tabs reales (Mi mes · Transacciones · Compartidos · Categorías · Inversiones · Resumen) + Nueva transacción.">
          <DCArtboard id="d-mes" label="Mi mes" width={1280} height={880}><MiMesMPDesktop /></DCArtboard>
          <DCArtboard id="d-transac" label="Transacciones" width={1280} height={880}><TransaccionesMPDesktop /></DCArtboard>
          <DCArtboard id="d-comp" label="Compartidos" width={1280} height={880}><CompartidosMPDesktop /></DCArtboard>
          <DCArtboard id="d-cat" label="Categorías" width={1280} height={880}><CategoriasMPDesktop /></DCArtboard>
          <DCArtboard id="d-inv" label="Inversiones" width={1280} height={880}><InversionesMPDesktop /></DCArtboard>
          <DCArtboard id="d-resumen" label="Resumen" width={1280} height={880}><ResumenMPDesktop /></DCArtboard>
          <DCArtboard id="d-nueva" label="Nueva transacción" width={1280} height={880}><NuevaTransaccionMPDesktop /></DCArtboard>
        </DCSection>
      </DesignCanvas>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
