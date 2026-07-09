# Signup directo (email o Google) sin invitación previa

## Contexto

Investigando por qué a Sabdy le fallaba el login (ver commits de la sesión
`fix/no-mostrar-modal-nombre-tras-rechazo` y los diagnósticos previos),
se aclaró la causa real: Daniel le compartió la URL pelada de la app en
vez de un link de invitación real (`?invite=TOKEN`, generado desde
Categorías → "Mi pareja" → "Invitar a mi pareja"). Sin ese token, el link
"Creá tu cuenta acá" nunca aparece, y Sabdy terminó tocando "Continuar
con Google" directo — un camino pensado solo para *vincular* una cuenta
de Google a una cuenta de email ya existente, no para crear cuenta nueva.

Además, el link de invitación existente solo sirve para unirse al
workspace **compartido** de Daniel (rol de "pareja"). No existe hoy una
forma de que alguien cree su **propio** workspace independiente sin ser
invitado por nadie — que es lo que Sabdy realmente quería (probar la app
con sus propios datos, no mezclarse con las finanzas de Daniel y Ama).

Confirmado: existe un trigger en Supabase que crea automáticamente un
workspace propio para cualquier fila nueva en `auth.users`, sin importar
el método de login (email o Google) ni si hubo invitación de por medio.
Esto significa que **no hace falta ningún cambio de base de datos** — el
trabajo es enteramente en el cliente (`index.html`).

## Qué se construye

1. Un punto de entrada de "Crear cuenta nueva" siempre visible en la
   pantalla de login (`card-login`), sin depender de haber llegado con
   un link de invitación.
2. La pantalla de "Crear cuenta" (`card-registro`) pasa a ofrecer dos
   caminos, igual que el login: email + contraseña (ya existe) y un
   botón nuevo "Continuar con Google".
3. El gate que rechaza cuentas de Google nuevas sin vincular (agregado en
   `b7d73c0`, el que causó el bug de Sabdy) se mantiene intacto para el
   botón de Google del login normal — sigue evitando que alguien cree una
   cuenta huérfana por tocar el botón sin querer. Se agrega una excepción
   puntual: si la persona llegó explícitamente desde "Crear cuenta
   nueva", ese mismo botón de Google debe crear la cuenta en vez de
   rechazarla.
4. El flujo de invitación a pareja (`?invite=TOKEN`) no se toca — sigue
   funcionando igual, es un camino aparte y ortogonal a este.

## Diseño

### Nuevo estado: intención de signup

Se usa `sessionStorage` para distinguir "vengo a loguearme/vincular" de
"vengo a crear cuenta nueva", igual que ya se usa `fp_invite_token` para
la invitación a pareja:

- `fp_signup_intent = "1"` — seteado al entrar a la pantalla de "Crear
  cuenta" (`mostrarRegistro()`), sin importar si hay o no un
  `fp_invite_token` simultáneo (ambos pueden coexistir: alguien puede
  entrar con invitación de pareja Y elegir crear cuenta con Google).
- Se borra apenas se consume (dentro de `_configurarUsuario()`, en el
  momento en que decide si aceptar o rechazar una cuenta de Google sin
  vincular).

### Cambios de UI

**`card-login`:** debajo del link actual de "¿Te invitaron a un
workspace? Creá tu cuenta acá" (que se mantiene para el caso de
invitación a pareja), se agrega un segundo link siempre visible:
"¿No tenés cuenta? Creá una nueva →", que también llama a
`mostrarRegistro()`. Los dos links pueden coexistir; no son
mutuamente excluyentes visualmente (invitación a pareja es un caso
particular, "crear cuenta nueva" es el caso general).

**`card-registro`:** se agrega, después del botón "Crear cuenta →"
existente, el mismo patrón visual que el login: un divisor "o" y un
botón "Continuar con Google" (reutiliza el ícono SVG ya usado en
`card-login`). Nueva función `guardarRegistroGoogle()`:

```js
async function guardarRegistroGoogle() {
  sessionStorage.setItem('fp_signup_intent', '1');
  const btn = document.getElementById('btn-google-registro');
  const res = document.getElementById('registro-google-result');
  if (_esNavegadorEmbebido()) {
    res.innerHTML = `<span class="fail">${_MENSAJE_NAVEGADOR_EMBEBIDO}</span>`;
    sessionStorage.removeItem('fp_signup_intent');
    return;
  }
  btn.disabled = true;
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
  if (error) {
    sessionStorage.removeItem('fp_signup_intent');
    res.innerHTML = `<span class="fail">❌ ${escapeHtml(error.message)}</span>`;
    btn.disabled = false;
  }
}
```

### Cambio en `_configurarUsuario()`

```js
const intentaCrearCuenta = sessionStorage.getItem('fp_signup_intent') === '1';
sessionStorage.removeItem('fp_signup_intent');

if (isGoogleOnly && !metaNombre && !intentaCrearCuenta) {
  // comportamiento actual sin cambios: signOut() + mensaje de "vinculá tu cuenta"
}
```

Si `intentaCrearCuenta` es `true`, el flujo sigue de largo igual que
cualquier login exitoso — `metaNombre` sigue vacío, así que
`iniciarApp()` va a mostrar el modal "¿Cómo te llamás?" correctamente
(esta vez de forma legítima, no por el bug ya arreglado), y al guardar el
nombre la cuenta queda funcionando con su propio workspace (por el
trigger de Supabase).

### Qué NO cambia

- El botón "Continuar con Google" del login normal (`card-login`) sigue
  rechazando cuentas de Google no vinculadas, salvo que se haya pasado
  por "Crear cuenta nueva" primero.
- `vincularGoogle()` (vincular Google a una cuenta de email ya
  existente, desde Categorías → Cuenta y Seguridad) no se toca.
- El flujo de invitación a pareja (`?invite=TOKEN`,
  `aceptarInvitacionPendiente()`, `accept_workspace_invite`) no se toca.
- No hay cambios de base de datos — el trigger que crea el workspace
  propio en `auth.users` ya cubre este caso.

## Testing

- Entrar a la app sin ningún link especial → debe verse el link "¿No
  tenés cuenta? Creá una nueva →" en el login.
- Tocar ese link → pantalla de registro con email+contraseña y el nuevo
  botón de Google.
- Crear cuenta nueva con Google (cuenta de Google que nunca usó la app) →
  debe llegar al modal de nombre y completar el alta sin el error de
  sesión perdida.
- Confirmar que, sin pasar por "Crear cuenta nueva", tocar "Continuar con
  Google" en el login normal con una cuenta de Google nueva sigue
  mostrando el mensaje de rechazo (comportamiento actual, sin regresión).
- Confirmar que el flujo de invitación a pareja (`?invite=TOKEN`) sigue
  funcionando igual que antes.
