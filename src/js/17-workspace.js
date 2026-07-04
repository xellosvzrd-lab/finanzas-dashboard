// ─── WORKSPACE DE PAREJA ────────────────────────────────────────
let workspaceMembers = []; // filas de workspace_members visibles para mi workspace

async function cargarWorkspaceMembers() {
  try {
    const { data, error } = await supabaseClient.from('workspace_members').select('*');
    if (error) throw error;
    workspaceMembers = data || [];
  } catch(e) {
    console.warn("Error cargando workspace_members:", e);
    workspaceMembers = [];
  }
}

// Nombre del primer miembro del workspace que no soy yo. null si todavía
// estoy solo (no invité a nadie, o la invitación no fue aceptada aún).
function resolverPartnerNombre() {
  if (!supabaseSession) return null;
  const otro = workspaceMembers.find(m => m.user_id !== supabaseSession.user.id);
  return otro ? otro.nombre : null;
}

// workspace_id de la sesión actual. Requerido en todo insert/upsert a las
// tablas de contenido (RLS exige workspace_id = my_workspace_id() server-side).
function miWorkspaceId() {
  if (!supabaseSession) return null;
  return workspaceMembers.find(m => m.user_id === supabaseSession.user.id)?.workspace_id || null;
}

// Ancla determinística para columnas legadas tipo pct_daniel/pct_ama que
// necesitan distinguir a los 2 miembros de un workspace sin depender de
// nombres literales ("Daniel"/"Ama" eran solo el ancla original del piloto).
// Se ordena por user_id: quien tenga el user_id más chico es "el miembro A".
// Mismo criterio en escritura y lectura → resultado consistente para ambos.
function esMiembroReferenciaWorkspace() {
  if (!supabaseSession || !workspaceMembers.length) return true;
  const ids = workspaceMembers.map(m => m.user_id).sort();
  return ids[0] === supabaseSession.user.id;
}

async function generarInvitacion() {
  try {
    const wsId = miWorkspaceId();
    if (!wsId) throw new Error("No se encontró mi workspace");

    // Revocar cualquier invitación pendiente previa antes de crear una nueva
    const pendientes = await listarInvitacionesPendientes();
    for (const inv of pendientes) await revocarInvitacion(inv.id);

    const { data, error } = await supabaseClient
      .from('workspace_invites')
      .insert({ workspace_id: wsId, created_by: supabaseSession.user.id })
      .select('token')
      .single();
    if (error) throw error;

    return `${window.location.origin}${window.location.pathname}?invite=${data.token}`;
  } catch(e) {
    console.warn("Error generando invitación:", e);
    showToast("⚠️ No se pudo generar el link de invitación", "err");
    return null;
  }
}

async function listarInvitacionesPendientes() {
  try {
    const { data, error } = await supabaseClient
      .from('workspace_invites')
      .select('*')
      .is('revoked_at', null)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString());
    if (error) throw error;
    return data || [];
  } catch(e) {
    console.warn("Error listando invitaciones:", e);
    return [];
  }
}

async function revocarInvitacion(inviteId) {
  try {
    const { error } = await supabaseClient
      .from('workspace_invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', inviteId);
    if (error) throw error;
  } catch(e) {
    console.warn("Error revocando invitación:", e);
  }
}

// Se llama una vez por sesión, desde iniciarApp() (Tarea 9), después de que
// USUARIO y workspaceMembers ya están resueltos.
function aceptarInvitacionPendiente() {
  const token = sessionStorage.getItem("fp_invite_token");
  if (!token) return;
  document.getElementById("modal-invitacion").style.display = "flex";
}

function cerrarModalInvitacion() {
  sessionStorage.removeItem("fp_invite_token");
  document.getElementById("modal-invitacion").style.display = "none";
}

async function confirmarAceptarInvitacion() {
  const token = sessionStorage.getItem("fp_invite_token");
  const msg   = document.getElementById("modal-invitacion-msg");
  if (!token) { cerrarModalInvitacion(); return; }

  msg.innerHTML = "⏳ Uniéndote...";
  const { error } = await supabaseClient.rpc("accept_workspace_invite", { p_token: token });

  const MENSAJES = {
    INVITE_NOT_FOUND:        "Ese link de invitación no existe.",
    INVITE_REVOKED:          "Esa invitación fue revocada.",
    INVITE_ALREADY_ACCEPTED: "Esa invitación ya fue aceptada.",
    INVITE_EXPIRED:          "Ese link de invitación venció — pedile a tu pareja que genere uno nuevo.",
    ALREADY_MEMBER:          "Ya formás parte de ese workspace.",
    HAS_OWN_DATA:            "Ya tenés datos propios cargados — no podemos unirte automáticamente a otro workspace. Contactanos para resolverlo a mano.",
  };

  if (error) {
    const codigo = (error.message || "").match(/[A-Z_]{5,}/)?.[0];
    msg.innerHTML = `<span style="color:var(--red)">${escapeHtml(MENSAJES[codigo] || "No se pudo procesar la invitación.")}</span>`;
    return;
  }

  sessionStorage.removeItem("fp_invite_token");
  msg.innerHTML = '<span style="color:var(--green)">✅ ¡Listo! Recargando...</span>';
  setTimeout(() => window.location.reload(), 1200);
}

async function renderizarPanelWorkspace() {
  const cont = document.getElementById('workspace-panel');
  if (!cont) return;

  const partnerNombre = resolverPartnerNombre();
  if (partnerNombre) {
    cont.innerHTML = `
      <div style="display:flex;align-items:center;gap:.6rem;color:var(--text)">
        <span style="font-size:1.3rem">🤝</span>
        <span>Compartís este workspace con <strong>${escapeHtml(partnerNombre)}</strong>.</span>
      </div>`;
    return;
  }

  const pendientes = await listarInvitacionesPendientes();
  if (pendientes.length) {
    const inv = pendientes[0];
    const url = `${window.location.origin}${window.location.pathname}?invite=${inv.token}`;
    cont.innerHTML = `
      <p style="color:var(--text-muted);font-size:.85rem;margin:0 0 .6rem">
        Todavía no invitaste a tu pareja. Tenés una invitación pendiente — compartile este link:
      </p>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">
        <input type="text" readonly value="${escapeHtml(url)}" id="workspace-invite-url"
               style="flex:1;min-width:200px;padding:.5rem .7rem;border-radius:8px;
                      border:1px solid var(--border);background:var(--bg2);color:var(--text);font-size:.8rem">
        <button class="btn btn-primary" onclick="_copiarInviteUrl()">Copiar</button>
        <button class="btn" style="background:none;color:var(--red)" onclick="_revocarYRerender('${inv.id}')">Revocar</button>
      </div>`;
    return;
  }

  cont.innerHTML = `
    <p style="color:var(--text-muted);font-size:.85rem;margin:0 0 .6rem">
      Todavía no invitaste a tu pareja a este workspace.
    </p>
    <button class="btn btn-primary" onclick="_generarYRerender()">Invitar a mi pareja</button>`;
}

async function _generarYRerender() {
  const url = await generarInvitacion();
  if (url) showToast("✅ Link de invitación generado", "ok");
  await renderizarPanelWorkspace();
}

async function _revocarYRerender(inviteId) {
  await revocarInvitacion(inviteId);
  await renderizarPanelWorkspace();
}

function _copiarInviteUrl() {
  const input = document.getElementById('workspace-invite-url');
  if (!input) return;
  input.select();
  navigator.clipboard?.writeText(input.value);
  showToast("✅ Link copiado", "ok");
}
