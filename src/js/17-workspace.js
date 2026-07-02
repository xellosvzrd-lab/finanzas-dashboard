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

async function generarInvitacion() {
  try {
    const miWorkspaceId = workspaceMembers.find(m => m.user_id === supabaseSession.user.id)?.workspace_id;
    if (!miWorkspaceId) throw new Error("No se encontró mi workspace");

    // Revocar cualquier invitación pendiente previa antes de crear una nueva
    const pendientes = await listarInvitacionesPendientes();
    for (const inv of pendientes) await revocarInvitacion(inv.id);

    const { data, error } = await supabaseClient
      .from('workspace_invites')
      .insert({ workspace_id: miWorkspaceId, created_by: supabaseSession.user.id })
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
