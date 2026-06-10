// ─── METAS DE AHORRO ──────────────────────────────────────────
let metaActiva = null; // meta activa cargada desde Supabase (propia o compartida del partner)

// ─── SUPABASE: CARGA ──────────────────────────────────────────

async function cargarMetaAhorro() {
  try {
    const { data, error } = await supabaseClient
      .from('metas_ahorro')
      .select('*')
      .eq('activa', true);
    if (error) throw error;
    const metas = data || [];
    const propia = metas.find(m => m.usuario === USUARIO);
    const compartidaPartner = metas.find(m => m.compartida && m.usuario !== USUARIO);
    metaActiva = propia || compartidaPartner || null;
  } catch(e) {
    console.warn("Error cargando meta de ahorro:", e);
    metaActiva = null;
  }
}

// ─── PROGRESO ─────────────────────────────────────────────────

function calcularProgresoMeta(meta) {
  const desde = new Date(meta.fecha_inicio);
  const total = allTransac
    .filter(t => t.categoria === "Ahorro" && !esTransferencia(t) && new Date(t.fecha) >= desde)
    .reduce((s, t) => s + Math.abs(Number(t.monto)), 0);
  const pct = Math.min(100, (total / meta.monto_objetivo) * 100);
  return { total, pct, restante: Math.max(0, meta.monto_objetivo - total) };
}

// ─── SUPABASE: CRUD ───────────────────────────────────────────

async function guardarMetaAhorro({ nombre, monto_objetivo, moneda, fecha_objetivo, compartida }) {
  if (!nombre || !(monto_objetivo > 0)) {
    showToast("Completá nombre y monto objetivo", "err");
    return;
  }
  try {
    const propia = metaActiva && metaActiva.usuario === USUARIO ? metaActiva : null;
    if (propia) {
      const { error: errArchivar } = await supabaseClient
        .from('metas_ahorro')
        .update({ activa: false })
        .eq('id', propia.id);
      if (errArchivar) throw errArchivar;
    }
    const payload = {
      user_id:        supabaseSession.user.id,
      usuario:        USUARIO,
      nombre,
      monto_objetivo,
      moneda,
      fecha_objetivo: fecha_objetivo || null,
      compartida:     !!compartida,
      activa:         true
    };
    const { error } = await supabaseClient.from('metas_ahorro').insert([payload]);
    if (error) throw error;
    await cargarMetaAhorro();
    renderMetaAhorro();
    cerrarModalMeta();
    showToast("✅ Meta guardada", "ok");
  } catch(e) {
    showToast("❌ Error al guardar la meta", "err");
  }
}

async function eliminarMetaAhorro() {
  const propia = metaActiva && metaActiva.usuario === USUARIO ? metaActiva : null;
  if (!propia) return;
  if (!confirm("¿Eliminar esta meta de ahorro?")) return;
  try {
    const { error } = await supabaseClient.from('metas_ahorro').delete().eq('id', propia.id);
    if (error) throw error;
    await cargarMetaAhorro();
    renderMetaAhorro();
    cerrarModalMeta();
    showToast("✅ Meta eliminada", "ok");
  } catch(e) {
    showToast("❌ Error al eliminar la meta", "err");
  }
}
