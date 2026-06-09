// ─── FETCH CON TIMEOUT ────────────────────────────────────────
async function fetchConTimeout(url, opciones = {}, ms = 15000) {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opciones, signal: ctrl.signal });
  } finally {
    clearTimeout(tid);
  }
}

function mostrarErrorCarga(msg) {
  const el = document.getElementById("error-carga");
  if (el) { el.innerHTML = `⚠️ ${msg}`; el.style.display = "block"; }
}
function ocultarErrorCarga() {
  const el = document.getElementById("error-carga");
  if (el) el.style.display = "none";
}

function _setVariablesUsuario(nombre) {
  USUARIO = nombre;
  PARTNER = USUARIO.toLowerCase() === "daniel" ? "Ama" : "Daniel";
  CATS_INGRESO_REAL = USUARIO.toLowerCase() === "ama"
    ? ["Sueldo", "Otros Ingresos", "Intereses"]
    : ["Sueldo", "Otros Ingresos"];
  categResponsabilidad = ["Mío", "Compartido", "De " + PARTNER];
  const _savedTheme = localStorage.getItem('fin-theme');
  const _defaultTheme = USUARIO.toLowerCase() === "ama" ? "light" : "dark";
  document.documentElement.dataset.theme = _savedTheme || _defaultTheme;
  const _sun  = document.getElementById('theme-icon-sun');
  const _moon = document.getElementById('theme-icon-moon');
  const _activeTheme = _savedTheme || _defaultTheme;
  if (_sun)  _sun.style.display  = _activeTheme === 'dark' ? '' : 'none';
  if (_moon) _moon.style.display = _activeTheme === 'dark' ? 'none' : '';
}

function _configurarUsuario(session) {
  const metaNombre   = session.user.user_metadata?.nombre;
  const metaEmojis   = session.user.user_metadata?.cat_emojis;
  const isGoogleOnly = session.user.app_metadata?.provider === 'google'
                    && !session.user.app_metadata?.providers?.includes('email');
  if (isGoogleOnly && !metaNombre) {
    supabaseClient.auth.signOut();
    const res = document.getElementById('google-login-result') || document.getElementById('test-result');
    if (res) res.innerHTML = '<span class="fail">❌ Esta cuenta de Google no está vinculada a ningún usuario. Iniciá sesión con email y vinculá tu cuenta desde Categorías → Cuenta y Seguridad.</span>';
    return;
  }
  _setVariablesUsuario(metaNombre || "");
  if (USUARIO && metaEmojis && typeof metaEmojis === "object") {
    localStorage.setItem(USUARIO + "_cat_emojis", JSON.stringify(metaEmojis));
    _userCatEmojis = metaEmojis;
  }
  if (USUARIO) _actualizarStringsUsuario();
  // getSession() devuelve JWT cacheado — user_metadata puede estar desactualizado.
  // getUser() hace fetch real y trae los emojis frescos de otros dispositivos.
  if (USUARIO) {
    supabaseClient.auth.getUser().then(({ data: { user } }) => {
      const fresh = user?.user_metadata?.cat_emojis;
      if (fresh && typeof fresh === "object") {
        localStorage.setItem(USUARIO + "_cat_emojis", JSON.stringify(fresh));
        _userCatEmojis = fresh;
      }
    }).catch(() => {});
  }
}

function _actualizarStringsUsuario() {
  const tit = document.getElementById("comp-titulo");
  if (tit) tit.textContent = "Compartidos con " + PARTNER;
  const nota = document.getElementById("comp-nota");
  if (nota) nota.textContent = `* Neto por categoría: positivo = ${PARTNER} te debe · negativo = vos le debés a ${PARTNER}.`;
  const thU = document.getElementById("comp-th-usuario");
  if (thU) thU.textContent = USUARIO;
  const thP = document.getElementById("comp-th-partner");
  if (thP) thP.textContent = PARTNER;
  const gastSub = document.getElementById("pres-kpi-gastado-sub");
  if (gastSub) gastSub.textContent = `50% compartidos · sin "De ${PARTNER}"`;
  const noteP = document.getElementById("pres-note-partner");
  if (noteP) noteP.textContent = "De " + PARTNER;
  const sidebarUser = document.getElementById("sidebar-user");
  if (sidebarUser) sidebarUser.textContent = USUARIO;
  const greeting = document.getElementById("mm-greeting");
  if (greeting) greeting.textContent = `Hola, ${USUARIO} 👋`;
  const sidebarAvatar = document.getElementById("sidebar-avatar");
  if (sidebarAvatar) sidebarAvatar.textContent = USUARIO.charAt(0).toUpperCase();
  const drawerName = document.getElementById("mobile-drawer-name");
  if (drawerName) drawerName.textContent = USUARIO;
  const topnavUser = document.getElementById("topnav-user");
  if (topnavUser) topnavUser.textContent = USUARIO;
  const _eyebrowMeses = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
  const _eyebrowNow = new Date();
  const _eyebrowBase = `${_eyebrowMeses[_eyebrowNow.getMonth()]} ${_eyebrowNow.getFullYear()} · ${USUARIO.toUpperCase()}`;
  ['presupuesto','transacciones','compartidos','config','inversiones'].forEach(id => {
    const _eyebrowEl = document.getElementById(`eyebrow-${id}`);
    if (_eyebrowEl) _eyebrowEl.textContent = _eyebrowBase;
  });
}

async function guardarNombre() {
  const input = document.getElementById("input-nombre");
  const msg   = document.getElementById("modal-nombre-msg");
  const nombre = input.value.trim();

  if (!nombre) {
    msg.innerHTML = '<span style="color:var(--red)">Escribí tu nombre primero.</span>';
    return;
  }

  msg.innerHTML = '⏳ Guardando...';

  const { error } = await supabaseClient.auth.updateUser({ data: { nombre } });

  if (error) {
    msg.innerHTML = `<span style="color:var(--red)">Error: ${escapeHtml(error.message)}</span>`;
    return;
  }

  _setVariablesUsuario(nombre);

  document.getElementById("modal-nombre").style.display = "none";
  await iniciarApp();
}

async function fetchTipoCambioMEP() {
  try {
    const res = await fetch("https://dolarapi.com/v1/dolares/bolsa");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (data?.venta) tipoCambioMEP = data.venta;
  } catch (e) {
    console.warn("No se pudo obtener el tipo de cambio MEP:", e);
    tipoCambioMEP = null;
  }
}

async function iniciarApp() {
  document.getElementById("setup-screen").style.display = "none";
  document.getElementById("app").style.display = "block";
  if (USUARIO) { const su = document.getElementById("sidebar-user"); if (su) su.textContent = USUARIO; }
  if (USUARIO) { const tu = document.getElementById("topnav-user"); if (tu) tu.textContent = USUARIO; }
  if (window.innerWidth <= 768) {
    document.getElementById("mobile-header").style.display = "flex";
  }

  if (!USUARIO) {
    document.getElementById("modal-nombre").style.display = "flex";
    setTimeout(() => document.getElementById("input-nombre").focus(), 50);
    return;
  }

  const cachedTransac = localStorage.getItem(CACHE_TRANSAC_KEY);
  const cachedCateg   = localStorage.getItem(CACHE_CATEG_KEY);

  if (cachedTransac && cachedCateg) {
    // Cache hit → renderizar inmediatamente con datos guardados
    try {
      _aplicarCacheCateg(JSON.parse(cachedCateg));
      allTransac = JSON.parse(cachedTransac);
      _renderApp();
    } catch(e) { /* datos corruptos — caemos al fetch normal */ }

    // Actualizar en background sin bloquear la UI
    const badge = document.getElementById("refresh-badge");
    if (badge) badge.style.display = "block";
    Promise.all([cargarCategorias(), cargarTodasTransacciones(), cargarRecurrentes()])
      .then(() => { ocultarErrorCarga(); _renderApp(); if (badge) badge.style.display = "none"; })
      .catch(e => {
        console.warn("Background refresh error:", e);
        if (badge) badge.style.display = "none";
        showToast("⚠️ Sin conexión — mostrando datos guardados", "err");
      });
  } else {
    // Primera vez o cache vacío → esperar el fetch
    try {
      await Promise.all([cargarCategorias(), cargarTodasTransacciones(), cargarRecurrentes()]);
      ocultarErrorCarga();
      _renderApp();
    } catch(e) {
      mostrarErrorCarga("No se pudo conectar al servidor. Verificá la URL en Configuración o tu conexión a internet.");
    }
  }
}

// ─── CATEGORÍAS Y FUENTES ─────────────────────────────────────
async function cargarCategorias() {
  try {
    const { data, error } = await supabaseClient.from('categorias').select('*');
    if (error) throw error;
    const catData = {
      gasto:           data.filter(r => r.tipo === 'GASTO'     && r.activa !== false).map(r => r.valor).sort(),
      ingreso:         data.filter(r => r.tipo === 'INGRESO'   && r.activa !== false).map(r => r.valor).sort(),
      fuentes:         data.filter(r => r.tipo === 'FUENTE'    && r.activa !== false).map(r => r.valor),
      fuentesTC:       data.filter(r => r.tipo === 'FUENTE_TC' && r.activa !== false).map(r => r.valor),
      responsabilidad: categResponsabilidad,
      todas:           data
    };
    _aplicarCacheCateg(catData);
    guardarCacheCateg(catData);
  } catch(e) { console.warn("No se pudieron cargar categorías:", e); throw e; }
}

// ─── TRANSACCIONES ────────────────────────────────────────────
async function cargarTodasTransacciones() {
  try {
    const PAGE = 1000;
    let all = [], from = 0;
    while (true) {
      const { data, error } = await supabaseClient
        .from('transacciones').select('*').order('fecha', { ascending: false }).range(from, from + PAGE - 1);
      if (error) throw error;
      all = all.concat(data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    allTransac = all.map(t => ({
      ...t,
      monto:           parseFloat(t.monto),
      responsabilidad: t.responsabilidad || 'Mío',
      fuente:          t.fuente || '',
      moneda:          t.moneda || 'ARS'
    }));
    _normalizarCategorias();
    guardarCacheTransac();
  } catch(e) { console.warn("Error cargando transacciones:", e); throw e; }
}

// ─── SELECTORES FECHA ─────────────────────────────────────────
const SEL_MES_KEY  = "fp_sel_mes";
const SEL_ANIO_KEY = "fp_sel_anio";
const FIL_MES_KEY    = "fp_fil_mes";
const FIL_ANIO_KEY   = "fp_fil_anio";
const FIL_TIPO_KEY   = "fp_fil_tipo";
const FIL_FUENTE_KEY = "fp_fil_fuente";
const FIL_RESP_KEY   = "fp_fil_resp";
const FIL_BUSCAR_KEY = "fp_fil_buscar";

function guardarSelFecha() {
  try {
    localStorage.setItem(SEL_MES_KEY,  document.getElementById("sel-mes-resumen")?.value || "");
    localStorage.setItem(SEL_ANIO_KEY, document.getElementById("sel-anio-resumen")?.value || "");
    localStorage.setItem(FIL_MES_KEY,  document.getElementById("fil-mes")?.value || "");
    localStorage.setItem(FIL_ANIO_KEY, document.getElementById("fil-anio")?.value || "");
  } catch(e) {}
}

function _guardarFiltros() {
  try {
    localStorage.setItem(FIL_TIPO_KEY,   document.getElementById("fil-tipo")?.value   || "");
    localStorage.setItem(FIL_FUENTE_KEY, document.getElementById("fil-fuente")?.value || "");
    localStorage.setItem(FIL_RESP_KEY,   document.getElementById("fil-resp")?.value   || "");
    localStorage.setItem(FIL_BUSCAR_KEY, document.getElementById("fil-buscar")?.value || "");
  } catch(e) {}
}

function _restaurarFiltros() {
  try {
    const tipo   = localStorage.getItem(FIL_TIPO_KEY);
    const fuente = localStorage.getItem(FIL_FUENTE_KEY);
    const resp   = localStorage.getItem(FIL_RESP_KEY);
    const buscar = localStorage.getItem(FIL_BUSCAR_KEY);
    if (tipo)   { const el = document.getElementById("fil-tipo");   if (el) el.value = tipo; }
    if (fuente) { const el = document.getElementById("fil-fuente"); if (el) el.value = fuente; }
    if (resp)   { const el = document.getElementById("fil-resp");   if (el) el.value = resp; }
    if (buscar) { const el = document.getElementById("fil-buscar"); if (el) el.value = buscar; }
  } catch(e) {}
}

// ─── SORT ─────────────────────────────────────────────────────
function setSortCol(col) {
  if (sortCol === col) { sortDir = -sortDir; }
  else { sortCol = col; sortDir = (col === "monto") ? -1 : (col === "fecha" ? -1 : 1); }
  filtrarTabla();
}

function _sortarDatos(datos) {
  return [...datos].sort((a, b) => {
    let va, vb;
    switch (sortCol) {
      case "monto":     va = Math.abs(Number(a.monto));  vb = Math.abs(Number(b.monto));  break;
      case "categoria": va = a.categoria.toLowerCase();  vb = b.categoria.toLowerCase();  break;
      case "tipo":      va = a.tipo;                     vb = b.tipo;                     break;
      default:          va = new Date(a.fecha);          vb = new Date(b.fecha);
    }
    if (va < vb) return -sortDir;
    if (va > vb) return sortDir;
    return 0;
  });
}

function _actualizarSortUI() {
  ["fecha","tipo","categoria","monto"].forEach(col => {
    const th  = document.getElementById("sort-th-" + col);
    const ind = document.getElementById("sort-ind-" + col);
    if (!th || !ind) return;
    if (col === sortCol) {
      th.classList.add("sort-active");
      ind.textContent = sortDir === -1 ? "▼" : "▲";
    } else {
      th.classList.remove("sort-active");
      ind.textContent = "";
    }
  });
}

function poblarSelectoresFecha() {
  const hoy  = new Date();
  const meses = [
    ["01","Enero"],["02","Febrero"],["03","Marzo"],["04","Abril"],
    ["05","Mayo"],["06","Junio"],["07","Julio"],["08","Agosto"],
    ["09","Septiembre"],["10","Octubre"],["11","Noviembre"],["12","Diciembre"]
  ];
  const ids = ["sel-mes-resumen","fil-mes"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    el.innerHTML = "";
    meses.forEach(([v,n]) => {
      const o = document.createElement("option");
      o.value = v; o.textContent = n;
      if (parseInt(v) === hoy.getMonth() + 1) o.selected = true;
      el.appendChild(o);
    });
  });

  const anioIds = ["sel-anio-resumen","fil-anio"];
  anioIds.forEach(id => {
    const el = document.getElementById(id);
    el.innerHTML = '<option value="">Todos los años</option>';
    for (let y = hoy.getFullYear(); y >= hoy.getFullYear() - 4; y--) {
      const o = document.createElement("option");
      o.value = y; o.textContent = y;
      if (y === hoy.getFullYear()) o.selected = true;
      el.appendChild(o);
    }
  });

  // Filtro anio-resumen no tiene "todos"
  const srAnio = document.getElementById("sel-anio-resumen");
  Array.from(srAnio.options).forEach(o => {
    if (o.value === "") srAnio.removeChild(o);
  });

  // Restaurar valores guardados
  try {
    const savedSelMes  = localStorage.getItem(SEL_MES_KEY);
    const savedSelAnio = localStorage.getItem(SEL_ANIO_KEY);
    const savedFilMes  = localStorage.getItem(FIL_MES_KEY);
    const savedFilAnio = localStorage.getItem(FIL_ANIO_KEY);
    if (savedSelMes)  { const el = document.getElementById("sel-mes-resumen"); if (el) el.value = savedSelMes; }
    if (savedSelAnio) { const el = document.getElementById("sel-anio-resumen"); if (el) el.value = savedSelAnio; }
    if (savedFilMes)  { const el = document.getElementById("fil-mes"); if (el) el.value = savedFilMes; }
    if (savedFilAnio) { const el = document.getElementById("fil-anio"); if (el) el.value = savedFilAnio; }
  } catch(e) {}
}

