// Lógica compartida de pagos (Stripe). Los archivos que empiezan por "_" no
// son direcciones de la web: solo los usan las demás funciones.
// Variables de entorno en Vercel (proyecto miequipoaldia-web):
//   SUPABASE_SECRET_KEY    -> clave secreta de Supabase (sb_secret_...)
//   STRIPE_SECRET_KEY      -> clave secreta de Stripe (sk_test_... para pruebas, sk_live_... de verdad)
//   STRIPE_WEBHOOK_SECRET  -> secreto del webhook de Stripe (whsec_...)
const SUPABASE_URL = 'https://orxdobcorsqejuecpouc.supabase.co'

const PLANES = {
  temporada: { precio: 3900, nombre: 'Temporada completa' },
  fundador: { precio: 2500, nombre: 'Temporada · precio fundador' },
}
const PLAZAS_FUNDADOR = 10

function cabeceras() {
  const k = (process.env.SUPABASE_SECRET_KEY || '').trim()
  return { apikey: k, Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' }
}

async function rest(ruta, opciones = {}) {
  const r = await fetch(`${SUPABASE_URL}${ruta}`, { ...opciones, headers: { ...cabeceras(), ...(opciones.headers || {}) } })
  const texto = await r.text()
  let datos = null
  try { datos = texto ? JSON.parse(texto) : null } catch { datos = texto }
  return { ok: r.ok, status: r.status, datos }
}

// Llamada a la API de Stripe sin librerías (formulario codificado)
function aFormulario(obj, prefijo = '', partes = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue
    const clave = prefijo ? `${prefijo}[${k}]` : k
    if (typeof v === 'object') aFormulario(v, clave, partes)
    else partes.push(`${encodeURIComponent(clave)}=${encodeURIComponent(v)}`)
  }
  return partes.join('&')
}

async function stripe(ruta, metodo = 'GET', cuerpo) {
  const r = await fetch(`https://api.stripe.com/v1${ruta}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${(process.env.STRIPE_SECRET_KEY || '').trim()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: cuerpo ? aFormulario(cuerpo) : undefined,
  })
  const datos = await r.json()
  return { ok: r.ok, datos }
}

async function plazasFundadorLibres() {
  const r = await rest('/rest/v1/clubes?select=id&plan=eq.fundador&slug=neq.marianistas')
  const usadas = Array.isArray(r.datos) ? r.datos.length : 0
  return Math.max(0, PLAZAS_FUNDADOR - usadas)
}

// La temporada de fútbol base acaba el 30 de junio.
// Si ya tenía pagado hasta un 30 de junio futuro, se le suma otra temporada.
function finDeTemporada(pagadoHastaActual) {
  const hoy = new Date()
  let anio = hoy.getMonth() >= 5 ? hoy.getFullYear() + 1 : hoy.getFullYear() // de junio en adelante -> próxima temporada
  if (pagadoHastaActual) {
    const actual = new Date(pagadoHastaActual)
    if (actual >= new Date(`${anio}-06-30`)) anio = actual.getFullYear() + 1
  }
  return `${anio}-06-30`
}

// Marca el club como pagado a partir de una sesión de Stripe ya pagada.
// Se puede llamar varias veces con la misma sesión: solo cuenta una.
async function aplicarPago(sesion) {
  if (!sesion || sesion.payment_status !== 'paid') return { ok: false, error: 'El pago no está completado' }
  const clubId = sesion.metadata?.club_id
  const plan = sesion.metadata?.plan === 'fundador' ? 'fundador' : 'temporada'
  if (!clubId) return { ok: false, error: 'Pago sin club' }

  const r = await rest(`/rest/v1/clubes?select=id,slug,pagado_hasta,ultimo_pago&id=eq.${clubId}`)
  const club = r.datos?.[0]
  if (!club) return { ok: false, error: 'Club no encontrado' }
  if (club.ultimo_pago === sesion.id) return { ok: true, slug: club.slug, pagado_hasta: club.pagado_hasta, repetido: true }

  const pagado_hasta = finDeTemporada(club.pagado_hasta)
  const upd = await rest(`/rest/v1/clubes?id=eq.${clubId}`, {
    method: 'PATCH',
    body: JSON.stringify({ estado: 'activo', plan, pagado_hasta, ultimo_pago: sesion.id }),
  })
  if (!upd.ok) return { ok: false, error: `No se pudo activar el club: ${JSON.stringify(upd.datos)}` }
  return { ok: true, slug: club.slug, pagado_hasta }
}

module.exports = { SUPABASE_URL, PLANES, rest, stripe, cabeceras, plazasFundadorLibres, aplicarPago }
