// ─── INICIALIZACIÓN ───────────────────────────────────────────
window.addEventListener("DOMContentLoaded", async () => {
  if (window.lucide) lucide.createIcons();
  document.getElementById("f-fecha").valueAsDate = new Date();
  poblarSelectoresFecha();

  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  // Detectar retorno desde email de recuperación de contraseña
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      supabaseSession = session;
      document.getElementById("setup-screen").style.display = "flex";
      document.getElementById("card-login").style.display         = "none";
      document.getElementById("card-reset").style.display         = "none";
      document.getElementById("card-nueva-password").style.display = "";
      document.getElementById("nueva-password").focus();
    }
  });

  // Pre-llenar email guardado
  document.getElementById("sb-email").value = localStorage.getItem("fp_sb_email") || "";

  // Intentar recuperar sesión existente
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) { supabaseSession = session; _configurarUsuario(session); iniciarApp(); return; }

  // No hay sesión activa — mostrar pantalla de login
});

// ─── CONFIGURACIÓN ────────────────────────────────────────────
async function guardarConfig() {
  const email    = document.getElementById("sb-email").value.trim();
  const password = document.getElementById("sb-password").value;
  const res      = document.getElementById("test-result");
  const btn      = document.getElementById("btn-conectar");

  if (!email || !password) {
    res.innerHTML = '<span class="fail">❌ Completá email y contraseña.</span>';
    return;
  }

  btn.disabled = true;
  btn.textContent = "⏳ Conectando...";
  res.innerHTML = "";

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    supabaseSession = data.session;
    _configurarUsuario(data.session);
    localStorage.setItem("fp_sb_email", email);
    localStorage.removeItem("fp_sb_password");
    iniciarApp();
  } catch(e) {
    res.innerHTML = `<span class="fail">❌ ${escapeHtml(e.message) || "Error al conectar"}</span>`;
    btn.disabled = false;
    btn.textContent = "Entrar →";
  }
}

async function guardarConfigGoogle() {
  const btn = document.getElementById('btn-google-login');
  const res = document.getElementById('google-login-result');
  btn.disabled = true;
  btn.querySelector('svg').nextSibling.textContent = ' Redirigiendo…';
  res.innerHTML = '';
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
  if (error) {
    res.innerHTML = `<span class="fail">❌ ${escapeHtml(error.message)}</span>`;
    btn.disabled = false;
    btn.querySelector('svg').nextSibling.textContent = ' Continuar con Google';
  }
}

async function vincularGoogle() {
  const btn = document.getElementById('btn-vincular-google');
  const res = document.getElementById('cuenta-msg');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Redirigiendo…'; }
  const { error } = await supabaseClient.auth.linkIdentity({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
  if (error) {
    if (res) res.innerHTML = `<span class="fail">❌ ${escapeHtml(error.message)}</span>`;
    if (btn) { btn.disabled = false; btn.textContent = 'Vincular →'; }
  }
}

async function renderizarSeccionCuenta() {
  const container = document.getElementById('cuenta-identities');
  if (!container) return;
  const { data: { user } } = await supabaseClient.auth.getUser();
  const identities = user?.identities || [];
  const hasGoogle = identities.some(i => i.provider === 'google');
  const hasEmail  = identities.some(i => i.provider === 'email');
  const googleSVG = `<svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true" style="flex-shrink:0">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
    <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 6.294C4.672 4.169 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>`;
  container.innerHTML = `
    <div class="cuenta-row">
      <div class="cuenta-provider">
        <span style="font-size:1rem">📧</span>
        <span>Email / Contraseña</span>
        <span class="cuenta-badge-${hasEmail ? 'ok' : 'no'}">${hasEmail ? '✓ Activo' : '— No configurado'}</span>
      </div>
    </div>
    <div class="cuenta-row">
      <div class="cuenta-provider">
        ${googleSVG}
        <span>Google</span>
        <span class="cuenta-badge-${hasGoogle ? 'ok' : 'no'}">${hasGoogle ? '✓ Vinculado' : '— No vinculado'}</span>
      </div>
      ${!hasGoogle ? `<button class="btn btn-ghost" id="btn-vincular-google" onclick="vincularGoogle()" style="font-size:.8rem;padding:.4rem .85rem">Vincular →</button>` : ''}
    </div>
    <div id="cuenta-msg" style="margin-top:.5rem;font-size:.82rem"></div>`;
}

async function volverConfig() {
  if (supabaseClient) await supabaseClient.auth.signOut();
  supabaseSession = null;
  document.getElementById("app").style.display = "none";
  document.getElementById("mobile-header").style.display = "none";
  closeSidebar();
  mostrarLogin();
  document.getElementById("setup-screen").style.display = "flex";
}

function mostrarLogin() {
  document.getElementById("card-login").style.display        = "";
  document.getElementById("card-reset").style.display        = "none";
  document.getElementById("card-nueva-password").style.display = "none";
  document.getElementById("test-result").innerHTML = "";
}

function mostrarRecuperarPassword() {
  document.getElementById("card-login").style.display        = "none";
  document.getElementById("card-reset").style.display        = "";
  document.getElementById("card-nueva-password").style.display = "none";
  // Pre-llenar email si ya lo escribió
  const email = document.getElementById("sb-email").value.trim();
  if (email) document.getElementById("reset-email").value = email;
  document.getElementById("reset-result").innerHTML = "";
  document.getElementById("reset-email").focus();
}

async function enviarResetPassword() {
  const email = document.getElementById("reset-email").value.trim();
  const res   = document.getElementById("reset-result");
  const btn   = document.getElementById("btn-reset");
  if (!email) { res.innerHTML = '<span class="fail">❌ Ingresá tu email.</span>'; return; }
  btn.disabled = true;
  btn.textContent = "⏳ Enviando...";
  res.innerHTML = "";
  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    });
    if (error) throw error;
    res.innerHTML = '<span class="ok">✅ Revisá tu email — te enviamos el link para resetear tu contraseña.</span>';
    btn.textContent = "Enviado";
  } catch(e) {
    res.innerHTML = `<span class="fail">❌ ${escapeHtml(e.message) || "Error al enviar."}</span>`;
    btn.disabled = false;
    btn.textContent = "Enviar email →";
  }
}

async function guardarNuevaPassword() {
  const p1  = document.getElementById("nueva-password").value;
  const p2  = document.getElementById("nueva-password2").value;
  const res = document.getElementById("nueva-password-result");
  const btn = document.getElementById("btn-nueva-password");
  if (!p1 || p1.length < 6) { res.innerHTML = '<span class="fail">❌ La contraseña debe tener al menos 6 caracteres.</span>'; return; }
  if (p1 !== p2)             { res.innerHTML = '<span class="fail">❌ Las contraseñas no coinciden.</span>'; return; }
  btn.disabled = true;
  btn.textContent = "⏳ Guardando...";
  res.innerHTML = "";
  try {
    const { error } = await supabaseClient.auth.updateUser({ password: p1 });
    if (error) throw error;
    res.innerHTML = '<span class="ok">✅ Contraseña actualizada. Redirigiendo...</span>';
    localStorage.removeItem("fp_sb_password");
    setTimeout(() => { _configurarUsuario(supabaseSession); iniciarApp(); }, 1500);
  } catch(e) {
    res.innerHTML = `<span class="fail">❌ ${escapeHtml(e.message) || "Error al guardar."}</span>`;
    btn.disabled = false;
    btn.textContent = "Guardar contraseña →";
  }
}

// ─── INICIO APP ───────────────────────────────────────────────
function _aplicarCacheCateg(catData) {
  categGasto           = catData.gasto           || [];
  categIngreso         = catData.ingreso          || [];
  categFuentes         = catData.fuentes          || [];
  categFuentesTC       = catData.fuentesTC        || [];
  categResponsabilidad = catData.responsabilidad  || categResponsabilidad;
  if (catData.todas) _todasCategorias = catData.todas;
  // Poblar selectores con los datos cacheados
  // (f-responsabilidad ahora es hidden input + radio buttons — se inicializa en inicializarRespButtons)
  const filResp = document.getElementById("fil-resp");
  if (filResp) filResp.innerHTML = '<option value="">Todas</option>' +
    categResponsabilidad.map(rv => `<option value="${rv}">${rv}</option>`).join("");
  const todasFuentes = [...categFuentes, ...categFuentesTC];
  const selFuente = document.getElementById("f-fuente");
  if (selFuente) selFuente.innerHTML = '<option value="">— Sin especificar —</option>' +
    todasFuentes.map(f => `<option value="${f}">${f}</option>`).join("");
  const filFuente = document.getElementById("fil-fuente");
  if (filFuente) filFuente.innerHTML = '<option value="">Todas las fuentes</option>' +
    todasFuentes.map(f => `<option value="${f}">${f}</option>`).join("");
  _restaurarFiltros();
}

// ─ Normaliza categorías, fuente y responsabilidad contra las listas canónicas (case-insensitive)
function _normalizarCategorias() {
  if (!categGasto.length && !categIngreso.length) return;
  const allCats   = [...categGasto, ...categIngreso];
  const catLookup  = Object.fromEntries(allCats.map(c => [c.toLowerCase().trim(), c]));
  const fuenteLookup = Object.fromEntries([...categFuentes, ...categFuentesTC].map(f => [f.toLowerCase().trim(), f]));
  const respLookup   = Object.fromEntries(categResponsabilidad.map(r => [r.toLowerCase().trim(), r]));
  allTransac.forEach(t => {
    if (t.categoria) {
      const norm = catLookup[t.categoria.toLowerCase().trim()];
      if (norm) t.categoria = norm;
    }
    if (t.fuente) {
      const norm = fuenteLookup[t.fuente.toLowerCase().trim()];
      if (norm) t.fuente = norm;
    }
    if (t.responsabilidad) {
      const norm = respLookup[t.responsabilidad.toLowerCase().trim()];
      if (norm) t.responsabilidad = norm;
    }
  });
}

function _renderApp() {
  _normalizarCategorias();
  setTipo("Gasto");
  filtrarTabla();
  inicializarSelectoresCompartidos();
  inicializarSelectoresPresupuesto();
  inicializarRespButtons();
  navegarA("presupuesto");
  if (window.lucide) lucide.createIcons();
}

