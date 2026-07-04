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
  const pct = meta.monto_objetivo > 0 ? Math.min(100, (total / meta.monto_objetivo) * 100) : 0;
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
      workspace_id:   miWorkspaceId(),
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

// ─── RENDER TARJETA MI MES ────────────────────────────────────

function renderMetaAhorro() {
  const cardDefault = document.getElementById('mm-sc-ahorro-default');
  const cardMeta    = document.getElementById('mm-sc-ahorro-meta');
  if (!cardDefault || !cardMeta) return;

  if (!metaActiva) {
    cardDefault.style.display = '';
    cardMeta.style.display = 'none';
    return;
  }

  cardDefault.style.display = 'none';
  cardMeta.style.display = '';

  const { total, pct, restante } = calcularProgresoMeta(metaActiva);

  document.getElementById('mm-sc-meta-nombre').textContent = metaActiva.nombre;
  document.getElementById('mm-sc-meta-bar').style.width = pct + '%';
  document.getElementById('mm-sc-meta-pct').textContent = Math.round(pct) + '%';

  let sub = `${fmtMoneda(total, metaActiva.moneda)} / ${fmtMoneda(metaActiva.monto_objetivo, metaActiva.moneda)} · faltan ${fmtMoneda(restante, metaActiva.moneda)}`;
  if (metaActiva.fecha_objetivo) {
    sub += ` · meta: ${fmtFecha(metaActiva.fecha_objetivo)}`;
  }
  document.getElementById('mm-sc-meta-sub').textContent = sub;

  const badge = document.getElementById('mm-sc-meta-badge');
  if (metaActiva.compartida) {
    document.getElementById('mm-sc-meta-partner').textContent = PARTNER;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }

  if (pct >= 100) {
    const flag = USUARIO + "_meta_celebrada_" + metaActiva.id;
    if (!localStorage.getItem(flag)) {
      _confettiBrief({ count: 80 });
      showToast("¡Felicitaciones, cumpliste tu meta de ahorro! 🎉", "ok");
      localStorage.setItem(flag, "1");
    }
  }
}

// ─── MODAL META DE AHORRO ─────────────────────────────────────

function abrirModalMeta() {
  _renderModalMeta();
  document.getElementById('modal-meta-ahorro').style.display = 'flex';
}

function cerrarModalMeta() {
  document.getElementById('modal-meta-ahorro').style.display = 'none';
}

function _renderModalMeta() {
  const propia = metaActiva && metaActiva.usuario === USUARIO ? metaActiva : null;
  document.getElementById('meta-nombre').value     = propia ? propia.nombre : '';
  document.getElementById('meta-monto').value      = propia ? propia.monto_objetivo : '';
  document.getElementById('meta-moneda').value     = propia ? propia.moneda : 'ARS';
  document.getElementById('meta-fecha').value      = propia && propia.fecha_objetivo ? propia.fecha_objetivo : '';
  document.getElementById('meta-compartida').checked = propia ? !!propia.compartida : false;
  document.getElementById('meta-partner-label').textContent = PARTNER;
  document.getElementById('meta-btn-eliminar').style.display = propia ? '' : 'none';
}

function _guardarMetaForm() {
  const nombre     = document.getElementById('meta-nombre').value.trim();
  const monto      = parsearDecimal(document.getElementById('meta-monto').value);
  const moneda     = document.getElementById('meta-moneda').value;
  const fecha      = document.getElementById('meta-fecha').value;
  const compartida = document.getElementById('meta-compartida').checked;
  guardarMetaAhorro({ nombre, monto_objetivo: monto, moneda, fecha_objetivo: fecha, compartida });
}

function _eliminarMetaForm() {
  eliminarMetaAhorro();
}
