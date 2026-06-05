// ─── CATEGORÍAS Y FUENTES — PÁGINA CONFIGURACIÓN ─────────────
function renderizarConfig() {
  _renderLista("gasto",      categGasto,   "GASTO");
  _renderLista("ingreso",    categIngreso, "INGRESO");
  _renderListaFuentes("fuente",   categFuentes,   "FUENTE");
  _renderListaFuentes("fuentetc", categFuentesTC, "FUENTE_TC");
  renderizarSeccionCuenta();
}

function _renderLista(tipo, items, tipoAPI) {
  const el = document.getElementById("cfg-lista-" + tipo);
  if (!el) return;

  const inactivas = _todasCategorias.filter(r => r.tipo === tipoAPI && r.activa === false).map(r => r.valor).sort();

  let html = "";
  if (!items.length && !inactivas.length) {
    html = '<div style="color:var(--text-muted);font-size:.84rem;padding:.5rem">Sin ítems</div>';
  } else {
    html = items.map(item => {
      const emo = getCatEmoji(item);
      return `
      <div class="cfg-item">
        <button class="cfg-emoji-btn" onclick="editarEmojiCategoria(${JSON.stringify(item)},this)" title="Cambiar emoji">${emo}</button>
        <span class="cfg-item-name">${escapeHtml(item)}</span>
        <button class="cfg-reclasif-btn" onclick="toggleCategoria('${tipoAPI}',${JSON.stringify(item)},false,this)" title="Ocultar" style="opacity:.6">Ocultar</button>
        <button class="cfg-del-btn" onclick="eliminarCategoria('${tipoAPI}',${JSON.stringify(item)},this)" title="Eliminar">✕</button>
      </div>`;
    }).join("");

    if (inactivas.length) {
      html += `<div style="font-size:.75rem;color:var(--text-muted);margin:.6rem 0 .3rem;letter-spacing:.04em;text-transform:uppercase">Disponibles (inactivas)</div>`;
      html += inactivas.map(item => `
        <div class="cfg-item" style="opacity:.55">
          <span class="cfg-item-name">${escapeHtml(item)}</span>
          <button class="cfg-reclasif-btn" onclick="toggleCategoria('${tipoAPI}',${JSON.stringify(item)},true,this)" title="Activar">Activar</button>
        </div>`).join("");
    }
  }

  el.innerHTML = html;
}

function _renderListaFuentes(tipo, items, tipoAPI) {
  const el = document.getElementById("cfg-lista-" + tipo);
  if (!el) return;
  if (!items.length) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:.84rem;padding:.5rem">Sin ítems</div>';
    return;
  }
  const esTC = tipoAPI === "FUENTE_TC";
  const reclasifLabel = esTC ? "→ pago inmediato" : "→ TC";
  el.innerHTML = items.map(item => {
    const itemJ = JSON.stringify(item);
    return `<div class="cfg-item">
      ${esTC ? '<span class="tc-badge">TC</span>' : ''}
      <span class="cfg-item-name" style="${esTC ? 'margin-left:.4rem' : ''}">${escapeHtml(item)}</span>
      <button class="cfg-reclasif-btn" onclick="confirmarReclasificarFuente(${itemJ},'${tipoAPI}')" title="Cambiar tipo">${reclasifLabel}</button>
      <button class="cfg-del-btn" onclick="eliminarCategoria('${tipoAPI}',${itemJ},this)" title="Eliminar">✕</button>
    </div>`;
  }).join("");
}

async function agregarCategoria(tipoAPI) {
  const tipoKey = tipoAPI === 'FUENTE_TC' ? 'fuentetc' : tipoAPI.toLowerCase();
  const inputId = "cfg-nueva-" + tipoKey;
  const msgId   = "cfg-msg-"   + tipoKey;
  const input   = document.getElementById(inputId);
  const msg     = document.getElementById(msgId);
  const valor   = input.value.trim();
  if (!valor) { msg.innerHTML = '<span style="color:var(--red)">Escribí un nombre primero.</span>'; return; }

  msg.innerHTML = "⏳ Guardando...";
  try {
    const { error } = await supabaseClient
      .from('categorias')
      .insert({ tipo: tipoAPI, valor, usuario: USUARIO, user_id: supabaseSession.user.id });
    if (error) throw error;
    if      (tipoAPI === "GASTO")     { categGasto.push(valor);     categGasto.sort(); }
    else if (tipoAPI === "INGRESO")   { categIngreso.push(valor);   categIngreso.sort(); }
    else if (tipoAPI === "FUENTE")    { categFuentes.push(valor); }
    else if (tipoAPI === "FUENTE_TC") { categFuentesTC.push(valor); }
    guardarCacheCateg({ gasto: categGasto, ingreso: categIngreso, fuentes: categFuentes, fuentesTC: categFuentesTC, responsabilidad: categResponsabilidad });
    renderizarConfig();
    _refrescarSelectores();
    input.value = "";
    msg.innerHTML = `<span style="color:var(--green)">✅ "${valor}" agregado.</span>`;
  } catch(e) {
    msg.innerHTML = `<span style="color:var(--red)">❌ ${escapeHtml(e.message) || "Error de conexión."}</span>`;
  }
  setTimeout(() => { msg.innerHTML = ""; }, 3000);
}

async function eliminarCategoria(tipoAPI, valor, btn) {
  if (!confirm(`¿Eliminar "${valor}" de ${tipoAPI}?`)) return;
  btn.disabled = true;
  const tipoKey = tipoAPI === 'FUENTE_TC' ? 'fuentetc' : tipoAPI.toLowerCase();
  const msgEl = document.getElementById("cfg-msg-" + tipoKey);
  try {
    const { error } = await supabaseClient
      .from('categorias').delete().eq('tipo', tipoAPI).eq('valor', valor);
    if (error) throw error;
    if      (tipoAPI === "GASTO")     categGasto     = categGasto.filter(x => x !== valor);
    else if (tipoAPI === "INGRESO")   categIngreso   = categIngreso.filter(x => x !== valor);
    else if (tipoAPI === "FUENTE")    categFuentes   = categFuentes.filter(x => x !== valor);
    else if (tipoAPI === "FUENTE_TC") categFuentesTC = categFuentesTC.filter(x => x !== valor);
    guardarCacheCateg({ gasto: categGasto, ingreso: categIngreso, fuentes: categFuentes, fuentesTC: categFuentesTC, responsabilidad: categResponsabilidad });
    renderizarConfig();
    _refrescarSelectores();
    if (msgEl) { msgEl.innerHTML = `<span style="color:var(--green)">✅ "${valor}" eliminado.</span>`; }
  } catch(e) {
    const esFKViolation = e.code === '23503' || e.message?.includes('violates foreign key');
    const msg = esFKViolation
      ? `❌ "${valor}" tiene transacciones asociadas y no se puede eliminar. Podés ocultarla con "Ocultar".`
      : '❌ Error de conexión.';
    if (msgEl) { msgEl.innerHTML = `<span style="color:var(--red)">${msg}</span>`; }
    btn.disabled = false;
  }
  setTimeout(() => { if (msgEl) msgEl.innerHTML = ""; }, 3000);
}

async function toggleCategoria(tipoAPI, valor, activar, btn) {
  btn.disabled = true;
  const tipoKey = tipoAPI === 'FUENTE_TC' ? 'fuentetc' : tipoAPI.toLowerCase();
  const msgEl = document.getElementById("cfg-msg-" + tipoKey);
  try {
    const { error } = await supabaseClient
      .from('categorias')
      .update({ activa: activar })
      .eq('tipo', tipoAPI)
      .eq('valor', valor)
      .eq('usuario', USUARIO);
    if (error) throw error;

    const cat = _todasCategorias.find(r => r.tipo === tipoAPI && r.valor === valor && r.usuario === USUARIO);
    if (cat) cat.activa = activar;

    if (activar) {
      if      (tipoAPI === "GASTO")    { categGasto.push(valor);    categGasto.sort(); }
      else if (tipoAPI === "INGRESO")  { categIngreso.push(valor);  categIngreso.sort(); }
      else if (tipoAPI === "FUENTE")   { categFuentes.push(valor); }
      else if (tipoAPI === "FUENTE_TC"){ categFuentesTC.push(valor); }
    } else {
      if      (tipoAPI === "GASTO")    categGasto     = categGasto.filter(x => x !== valor);
      else if (tipoAPI === "INGRESO")  categIngreso   = categIngreso.filter(x => x !== valor);
      else if (tipoAPI === "FUENTE")   categFuentes   = categFuentes.filter(x => x !== valor);
      else if (tipoAPI === "FUENTE_TC")categFuentesTC = categFuentesTC.filter(x => x !== valor);
    }

    guardarCacheCateg({ gasto: categGasto, ingreso: categIngreso, fuentes: categFuentes, fuentesTC: categFuentesTC, responsabilidad: categResponsabilidad });
    renderizarConfig();
    _refrescarSelectores();
    if (msgEl) { msgEl.innerHTML = `<span style="color:var(--green)">✅ "${valor}" ${activar ? "activada" : "desactivada"}.</span>`; }
  } catch(e) {
    if (msgEl) { msgEl.innerHTML = '<span style="color:var(--red)">❌ Error de conexión.</span>'; }
    btn.disabled = false;
  }
  setTimeout(() => { if (msgEl) msgEl.innerHTML = ""; }, 3000);
}

async function confirmarReclasificarFuente(valor, tipoActual) {
  const tipoKey = tipoActual === 'FUENTE_TC' ? 'fuentetc' : 'fuente';
  const msgEl = document.getElementById("cfg-msg-" + tipoKey);
  if (!msgEl) return;
  msgEl.innerHTML = "⏳ Verificando...";

  try {
    const { count, error } = await supabaseClient
      .from('transacciones')
      .select('*', { count: 'exact', head: true })
      .eq('fuente', valor)
      .eq('usuario', USUARIO);
    if (error) throw error;

    const nuevoTipo  = tipoActual === 'FUENTE_TC' ? 'FUENTE' : 'FUENTE_TC';
    const nuevoLabel = nuevoTipo  === 'FUENTE_TC' ? 'tarjeta de crédito' : 'pago inmediato';
    const esc = valor.replace(/'/g, "\\'");

    if (count > 0) {
      msgEl.innerHTML = `<div class="cfg-confirm-inline">
        <span>${count} transacción${count !== 1 ? 'es' : ''} de esta fuente seguirán usando su fecha original. ¿Marcar como ${nuevoLabel}?</span>
        <button class="btn btn-primary" style="font-size:.8rem;padding:.3rem .7rem" onclick="ejecutarReclasificarFuente('${esc}','${tipoActual}')">Confirmar</button>
        <button class="btn" style="font-size:.8rem;padding:.3rem .7rem" onclick="renderizarConfig()">Cancelar</button>
      </div>`;
    } else {
      await ejecutarReclasificarFuente(valor, tipoActual);
    }
  } catch(e) {
    msgEl.innerHTML = `<span style="color:var(--red)">❌ ${escapeHtml(e.message) || "Error de conexión."}</span>`;
    setTimeout(() => { msgEl.innerHTML = ""; }, 3000);
  }
}

async function ejecutarReclasificarFuente(valor, tipoActual) {
  const tipoKey = tipoActual === 'FUENTE_TC' ? 'fuentetc' : 'fuente';
  const msgEl = document.getElementById("cfg-msg-" + tipoKey);
  if (msgEl) msgEl.innerHTML = "⏳ Guardando...";

  const nuevoTipo  = tipoActual === 'FUENTE_TC' ? 'FUENTE' : 'FUENTE_TC';
  const nuevoLabel = nuevoTipo  === 'FUENTE_TC' ? 'tarjeta de crédito' : 'pago inmediato';

  try {
    const { error } = await supabaseClient
      .from('categorias')
      .update({ tipo: nuevoTipo })
      .eq('tipo', tipoActual)
      .eq('valor', valor);
    if (error) throw error;

    if (nuevoTipo === 'FUENTE_TC') {
      categFuentes   = categFuentes.filter(x => x !== valor);
      categFuentesTC = [...categFuentesTC, valor];
    } else {
      categFuentesTC = categFuentesTC.filter(x => x !== valor);
      categFuentes   = [...categFuentes, valor];
    }
    guardarCacheCateg({ gasto: categGasto, ingreso: categIngreso, fuentes: categFuentes, fuentesTC: categFuentesTC, responsabilidad: categResponsabilidad });
    renderizarConfig();
    _refrescarSelectores();

    const destKey = nuevoTipo === 'FUENTE_TC' ? 'fuentetc' : 'fuente';
    const destEl  = document.getElementById("cfg-msg-" + destKey);
    if (destEl) {
      destEl.innerHTML = `<span style="color:var(--green)">✅ "${valor}" marcado como ${nuevoLabel}.</span>`;
      setTimeout(() => { destEl.innerHTML = ""; }, 3000);
    }
  } catch(e) {
    if (msgEl) {
      msgEl.innerHTML = `<span style="color:var(--red)">❌ ${escapeHtml(e.message) || "Error de conexión."}</span>`;
      setTimeout(() => { msgEl.innerHTML = ""; }, 3000);
    }
  }
}

// Refresca todos los selects del formulario y filtros
function _refrescarSelectores() {
  const todasFuentes = [...categFuentes, ...categFuentesTC];
  // Formulario fuente
  const selFuente = document.getElementById("f-fuente");
  if (selFuente) {
    const curVal = selFuente.value;
    selFuente.innerHTML = '<option value="">— Sin especificar —</option>' +
      todasFuentes.map(f => `<option value="${f}">${f}</option>`).join("");
    selFuente.value = curVal;
  }
  // Filtro fuente
  const filFuente = document.getElementById("fil-fuente");
  if (filFuente) {
    const curVal = filFuente.value;
    filFuente.innerHTML = '<option value="">Todas las fuentes</option>' +
      todasFuentes.map(f => `<option value="${f}">${f}</option>`).join("");
    filFuente.value = curVal;
  }
  // Formulario categoría (según tipo actual)
  setTipo(tipoActual);
}

function editarEmojiCategoria(cat, btnEl) {
  const inp = document.createElement("input");
  inp.type = "text";
  inp.value = getCatEmoji(cat);
  inp.style.cssText = "width:2.4rem;font-size:1.1rem;text-align:center;background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:.1rem .2rem;cursor:text;outline:none";
  inp.title = "Pegá o escribí un emoji y presioná Enter";

  const save = () => {
    const raw = inp.value.trim();
    const glyph = raw ? [...raw][0] : null;
    if (glyph) setCatEmoji(cat, glyph);
    renderizarConfig();
  };

  inp.addEventListener("blur", save);
  inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); inp.blur(); } if (e.key === "Escape") { inp.removeEventListener("blur", save); renderizarConfig(); } });

  btnEl.replaceWith(inp);
  inp.focus();
  inp.select();
}

