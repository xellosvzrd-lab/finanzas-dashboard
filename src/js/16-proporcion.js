// ─── PROPORCIÓN DE GASTOS COMPARTIDOS ──────────────────────────
let proporcionesCompartidos = []; // filas de proporcion_compartidos cacheadas en memoria

async function cargarProporcionesCompartidos() {
  try {
    const { data, error } = await supabaseClient
      .from('proporcion_compartidos')
      .select('*');
    if (error) throw error;
    proporcionesCompartidos = data || [];
  } catch(e) {
    console.warn("Error cargando proporcion_compartidos:", e);
    proporcionesCompartidos = [];
  }
}

// Resuelve el ratio vigente para un mes/año dado, con herencia del último
// valor configurado hacia atrás en el tiempo. Fallback 50/50 si no hay nada.
function obtenerProporcionParaMes(mes, anio) {
  const periodoObjetivo = anio * 12 + mes;
  const candidatas = proporcionesCompartidos
    .filter(p => (p.anio * 12 + p.mes) <= periodoObjetivo)
    .sort((a, b) => (b.anio * 12 + b.mes) - (a.anio * 12 + a.mes));
  if (!candidatas.length) return { pctDaniel: 50, pctAma: 50 };
  const pctDaniel = Number(candidatas[0].pct_daniel);
  return { pctDaniel, pctAma: 100 - pctDaniel };
}

// Fracción (0–1) que le corresponde al usuario de la sesión actual (USUARIO)
// para un mes dado. Los consumidores que solo necesitan "mi propia parte"
// (Mi mes, Resumen, cuotas, sparklines) usan este helper en vez de
// obtenerProporcionParaMes() directamente.
function obtenerFactorCompartidoPropio(mes, anio) {
  const { pctDaniel, pctAma } = obtenerProporcionParaMes(mes, anio);
  const pct = esMiembroReferenciaWorkspace() ? pctDaniel : pctAma;
  return pct / 100;
}

async function guardarProporcionMes(mes, anio, pctDanielInput) {
  const pctDaniel = Math.max(0, Math.min(100, parsearDecimal(pctDanielInput)));
  try {
    const { error } = await supabaseClient
      .from('proporcion_compartidos')
      .upsert(
        { mes, anio, pct_daniel: pctDaniel, updated_by: USUARIO, updated_at: new Date().toISOString() },
        { onConflict: 'mes,anio' }
      );
    if (error) throw error;
    const idx = proporcionesCompartidos.findIndex(p => p.mes === mes && p.anio === anio);
    if (idx >= 0) proporcionesCompartidos[idx].pct_daniel = pctDaniel;
    else proporcionesCompartidos.push({ mes, anio, pct_daniel: pctDaniel, updated_by: USUARIO });
    showToast("✅ Reparto actualizado", "ok");
    if (typeof cargarCompartidos === "function") cargarCompartidos();
  } catch(e) {
    console.warn("Error guardando proporcion_compartidos:", e);
    showToast("⚠️ No se pudo guardar el reparto", "err");
  }
}
