// ─── RECURRENTES ──────────────────────────────────────────────
let recurrentesActivas    = []; // cargadas desde Supabase
let _candidatasDetectadas = []; // candidatas del ciclo de render actual

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
  }, 80);
  showToast("📋 " + recurrente.descripcion + " — ingresá el monto", "ok");
}

// ─── RENDER SECCIÓN MI MES ────────────────────────────────────

function _esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderRecurrentes() {
  const section = document.getElementById('recurrentes-section');
  const list    = document.getElementById('recur-list');
  const badge   = document.getElementById('recur-badge');
  if (!section || !list || !badge) return;

  const activas = recurrentesActivas.filter(r => r.activa);
  _candidatasDetectadas = detectarCandidatas();

  if (!activas.length && !_candidatasDetectadas.length) {
    section.style.display = 'none';
    return;
  }
  section.style.display = '';

  const estados    = activas.map(r => ({ r, estado: getEstadoMes(r) }));
  const pendientes = estados.filter(x => !x.estado.ok).length;

  if (pendientes > 0) {
    badge.textContent = pendientes + ' pendiente' + (pendientes > 1 ? 's' : '');
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }

  const filasActivas = estados.map(({ r, estado }) => {
    if (estado.ok) {
      return `<div class="recur-row recur-row--ok">
        <div class="recur-row-icon">✅</div>
        <div class="recur-row-info">
          <div class="recur-row-name">${_esc(r.descripcion)}</div>
          <div class="recur-row-cat">${_esc(r.categoria)}</div>
        </div>
        <div class="recur-row-right">
          <div class="recur-status-ok">${fmt(estado.monto)}</div>
        </div>
      </div>`;
    } else {
      return `<div class="recur-row recur-row--pending" data-recur-id="${r.id}" onclick="_cargarRecurrentePorId(this.dataset.recurId)">
        <div class="recur-row-icon">⚠️</div>
        <div class="recur-row-info">
          <div class="recur-row-name">${_esc(r.descripcion)}</div>
          <div class="recur-row-cat">${_esc(r.categoria)} · tocá para cargar</div>
        </div>
        <div class="recur-row-right">
          <div class="recur-status-warn">pendiente</div>
          ${r.monto_ref ? `<div class="recur-status-sub">~${fmt(r.monto_ref)}</div>` : ''}
        </div>
      </div>`;
    }
  }).join('');

  const filasCandidatas = _candidatasDetectadas.map((c, idx) => `
    <div class="recur-row recur-row--suggest">
      <div class="recur-row-icon">💡</div>
      <div class="recur-row-info">
        <div class="recur-row-name">${_esc(c.descripcion)} <span class="recur-tag-suggest">sugerida</span></div>
        <div class="recur-row-cat">${_esc(c.categoria)} · apareció ${c.meses.size} meses</div>
        <div class="recur-suggest-actions">
          <button class="btn-recur-confirm" onclick="_confirmarCandidataIdx(${idx})">✓ Confirmar</button>
          <button class="btn-recur-ignore"  onclick="_ignorarCandidataIdx(${idx})">Ignorar</button>
        </div>
      </div>
    </div>
  `).join('');

  list.innerHTML = filasActivas + filasCandidatas;
}

// Helpers para onclick seguros (sin JSON en HTML)
function _cargarRecurrentePorId(id) {
  const r = recurrentesActivas.find(x => x.id === id);
  if (r) cargarRecurrenteForm(r);
}
function _confirmarCandidataIdx(idx) {
  const c = _candidatasDetectadas[idx];
  if (c) confirmarRecurrente(c);
}
function _ignorarCandidataIdx(idx) {
  const c = _candidatasDetectadas[idx];
  if (c) ignorarCandidata(c.descripcion, c.categoria);
}

// ─── MODAL GESTIÓN ────────────────────────────────────────────

function abrirModalRecurrentes() {
  _renderModalRecurrentes();
  _poblarSelectsModal();
  document.getElementById('modal-recurrentes').style.display = 'flex';
}

function cerrarModalRecurrentes() {
  document.getElementById('modal-recurrentes').style.display = 'none';
  document.getElementById('modal-recur-add-form').style.display = 'none';
}

function _renderModalRecurrentes() {
  const body = document.getElementById('modal-recur-body');
  if (!body) return;

  const activas  = recurrentesActivas.filter(r => r.activa);
  const pausadas = recurrentesActivas.filter(r => !r.activa);

  let html = '';

  if (activas.length) {
    html += `<div class="modal-recur-section-label">Activas</div>`;
    html += activas.map(r => _htmlModalRow(r)).join('');
  }
  if (pausadas.length) {
    html += `<div class="modal-recur-section-label">Pausadas</div>`;
    html += pausadas.map(r => _htmlModalRow(r)).join('');
  }
  if (!recurrentesActivas.length) {
    html = `<p style="color:var(--text-muted);font-size:.8rem;padding:.5rem 0">Aún no hay recurrentes confirmadas.</p>`;
  }

  body.innerHTML = html;
}

function _htmlModalRow(r) {
  return `<div class="modal-recur-row">
    <div class="modal-recur-info">
      <div class="modal-recur-name">${_esc(r.descripcion)}</div>
      <div class="modal-recur-cat">${_esc(r.categoria)}${r.fuente ? ' · ' + _esc(r.fuente) : ''}</div>
    </div>
    <span class="pill-toggle ${r.activa ? 'pill-toggle--on' : ''}"
          onclick="toggleRecurrente('${r.id}')">
      ${r.activa ? 'activa' : 'pausada'}
    </span>
    <span class="modal-recur-del" onclick="eliminarRecurrente('${r.id}')">×</span>
  </div>`;
}

function _poblarSelectsModal() {
  const selCat  = document.getElementById('modal-recur-cat');
  const selFte  = document.getElementById('modal-recur-fuente');
  const selResp = document.getElementById('modal-recur-resp');
  if (selCat) {
    selCat.innerHTML = '<option value="">Categoría…</option>' +
      categGasto.map(c => `<option value="${c}">${c}</option>`).join('');
  }
  if (selFte) {
    selFte.innerHTML = '<option value="">Fuente (opcional)</option>' +
      categFuentes.map(f => `<option value="${f}">${f}</option>`).join('');
  }
  if (selResp) {
    selResp.innerHTML = categResponsabilidad
      .map(r => `<option value="${r}">${r}</option>`).join('');
  }
}

function _mostrarFormRecurManual() {
  _poblarSelectsModal();
  document.getElementById('modal-recur-desc').value = '';
  document.getElementById('modal-recur-add-form').style.display = '';
}

function _guardarRecurrenteManualForm() {
  const desc   = document.getElementById('modal-recur-desc').value.trim();
  const cat    = document.getElementById('modal-recur-cat').value;
  const fuente = document.getElementById('modal-recur-fuente').value;
  const resp   = document.getElementById('modal-recur-resp').value;
  agregarRecurrenteManual(desc, cat, fuente, resp);
  document.getElementById('modal-recur-add-form').style.display = 'none';
}
