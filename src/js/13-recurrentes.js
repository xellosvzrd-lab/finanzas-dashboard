// ─── RECURRENTES ──────────────────────────────────────────────
let recurrentesActivas = []; // cargadas desde Supabase

// ─── DETECCIÓN ───────────────────────────────────────────────

function detectarCandidatas() {
  // Filtra: solo gastos sin cuotas
  const gastos = allTransac.filter(t => t.tipo === "Gasto" && !t.compra_id);

  // Agrupa por descripcion||categoria → meses en que aparece
  const grupos = {};
  for (const t of gastos) {
    const key = t.descripcion + "||" + t.categoria;
    const mes = t.fecha.slice(0, 7); // "YYYY-MM"
    if (!grupos[key]) {
      grupos[key] = { descripcion: t.descripcion, categoria: t.categoria, meses: new Set(), ultimo: t };
    }
    grupos[key].meses.add(mes);
    if (t.fecha > grupos[key].ultimo.fecha) grupos[key].ultimo = t;
  }

  // Claves ya confirmadas
  const confirmadas = new Set(
    recurrentesActivas.map(r => r.descripcion + "||" + r.categoria)
  );

  // Claves ignoradas este mes
  const mesActual = new Date().toISOString().slice(0, 7);
  let ignoradas = [];
  try {
    ignoradas = JSON.parse(localStorage.getItem("recur_ignoradas_" + USUARIO + "_" + mesActual) || "[]");
  } catch(e) {}
  const ignoradasSet = new Set(ignoradas);

  return Object.values(grupos).filter(g =>
    g.meses.size >= 2 &&
    !confirmadas.has(g.descripcion + "||" + g.categoria) &&
    !ignoradasSet.has(g.descripcion + "||" + g.categoria)
  );
}

function getEstadoMes(recurrente) {
  const mesActual = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const encontrada = allTransac.find(t =>
    t.descripcion === recurrente.descripcion &&
    t.categoria   === recurrente.categoria &&
    t.fecha.startsWith(mesActual) &&
    !t.compra_id
  );
  return encontrada
    ? { ok: true, monto: encontrada.monto }
    : { ok: false };
}

function ignorarCandidata(descripcion, categoria) {
  const mesActual = new Date().toISOString().slice(0, 7);
  const key = "recur_ignoradas_" + USUARIO + "_" + mesActual;
  let ignoradas = [];
  try { ignoradas = JSON.parse(localStorage.getItem(key) || "[]"); } catch(e) {}
  const keyStr = descripcion + "||" + categoria;
  if (!ignoradas.includes(keyStr)) {
    ignoradas.push(keyStr);
    localStorage.setItem(key, JSON.stringify(ignoradas));
  }
  renderRecurrentes();
}

// ─── SUPABASE CRUD ────────────────────────────────────────────

async function cargarRecurrentes() {
  try {
    const { data, error } = await supabaseClient
      .from('recurrentes')
      .select('*')
      .eq('usuario', USUARIO)
      .order('created_at', { ascending: true });
    if (error) throw error;
    recurrentesActivas = data || [];
  } catch(e) {
    console.warn("Error cargando recurrentes:", e);
    recurrentesActivas = [];
  }
}

async function confirmarRecurrente(candidata) {
  try {
    const payload = {
      user_id:        supabaseSession.user.id,
      usuario:        USUARIO,
      descripcion:    candidata.descripcion,
      categoria:      candidata.categoria,
      monto_ref:      candidata.ultimo.monto,
      fuente:         candidata.ultimo.fuente || null,
      responsabilidad: candidata.ultimo.responsabilidad || 'Mío',
      activa:         true
    };
    const { error } = await supabaseClient.from('recurrentes').insert([payload]);
    if (error) throw error;
    await cargarRecurrentes();
    renderRecurrentes();
    showToast("✅ Recurrente confirmada", "ok");
  } catch(e) {
    showToast("❌ Error al confirmar", "err");
  }
}

async function toggleRecurrente(id) {
  const r = recurrentesActivas.find(x => x.id === id);
  if (!r) return;
  try {
    const { error } = await supabaseClient
      .from('recurrentes').update({ activa: !r.activa }).eq('id', id);
    if (error) throw error;
    await cargarRecurrentes();
    _renderModalRecurrentes();
    renderRecurrentes();
  } catch(e) {
    showToast("❌ Error al actualizar", "err");
  }
}

async function eliminarRecurrente(id) {
  if (!confirm("¿Eliminar esta recurrente?")) return;
  try {
    const { error } = await supabaseClient.from('recurrentes').delete().eq('id', id);
    if (error) throw error;
    await cargarRecurrentes();
    _renderModalRecurrentes();
    renderRecurrentes();
    showToast("✅ Recurrente eliminada", "ok");
  } catch(e) {
    showToast("❌ Error al eliminar", "err");
  }
}

async function agregarRecurrenteManual(descripcion, categoria, fuente, responsabilidad) {
  if (!descripcion || !categoria) { showToast("Completá descripción y categoría", "err"); return; }
  try {
    const payload = {
      user_id:        supabaseSession.user.id,
      usuario:        USUARIO,
      descripcion,
      categoria,
      monto_ref:      null,
      fuente:         fuente || null,
      responsabilidad: responsabilidad || 'Mío',
      activa:         true
    };
    const { error } = await supabaseClient.from('recurrentes').insert([payload]);
    if (error) throw error;
    await cargarRecurrentes();
    _renderModalRecurrentes();
    renderRecurrentes();
    showToast("✅ Recurrente agregada", "ok");
  } catch(e) {
    showToast("❌ Error al agregar", "err");
  }
}

// ─── NAVEGACIÓN AL FORM ──────────────────────────────────────

function cargarRecurrenteForm(recurrente) {
  navegarA('nueva');
  setTimeout(() => {
    setTipo('Gasto');
    document.getElementById('f-descripcion').value = recurrente.descripcion || '';
    const selCat = document.getElementById('f-categoria');
    const selFte = document.getElementById('f-fuente');
    if (selCat) selCat.value = recurrente.categoria || '';
    if (selFte) selFte.value = recurrente.fuente || '';
    seleccionarResp(recurrente.responsabilidad || 'Mío');
    document.getElementById('f-monto').focus();
  }, 30);
  showToast("📋 " + recurrente.descripcion + " — ingresá el monto", "ok");
}
