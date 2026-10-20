// Alta de un club nuevo. Solo la puede usar el superadmin (Sergio) desde la app.
// Crea el club, invita por email al entrenador (le llega un enlace para entrar)
// y le da permisos de staff de ese club.
// Variables de entorno en Vercel (proyecto miequipoaldia-web):
//   SUPABASE_SECRET_KEY -> clave secreta de Supabase (sb_secret_...)
const SUPABASE_URL = 'https://orxdobcorsqejuecpouc.supabase.co'

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

const limpiar = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false })
  if (!process.env.SUPABASE_SECRET_KEY) return res.status(500).json({ ok: false, error: 'Falta SUPABASE_SECRET_KEY en Vercel' })

  // 1) ¿Quién llama? Tiene que ser superadmin
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ ok: false, error: 'Sin sesión' })
  const yo = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: cabeceras().apikey, Authorization: `Bearer ${token}` } })
  if (!yo.ok) return res.status(401).json({ ok: false, error: 'Sesión no válida' })
  const usuario = await yo.json()
  const sa = await rest(`/rest/v1/superadmins?select=user_id&user_id=eq.${usuario.id}`)
  if (!sa.ok || !sa.datos?.length) return res.status(403).json({ ok: false, error: 'Solo el superadmin puede dar de alta clubes' })

  // 2) Datos del club
  let b = req.body
  if (typeof b === 'string') { try { b = JSON.parse(b) } catch { b = {} } }
  b = b || {}
  const slug = limpiar(b.slug, 40).toLowerCase()
  const email = limpiar(b.email, 120).toLowerCase()
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) return res.status(400).json({ ok: false, error: 'Dirección (slug) no válida: solo minúsculas, números y guiones' })
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ ok: false, error: 'Email del entrenador no válido' })
  const reservados = ['api', 'assets', 'demo', 'admin', 'www', 'app', 'privacidad', 'aviso-legal']
  if (reservados.includes(slug)) return res.status(400).json({ ok: false, error: 'Esa dirección está reservada' })

  const diasPrueba = Number(b.dias_prueba) || 30
  const club = {
    slug,
    nombre: limpiar(b.nombre, 80),
    nombre_corto: limpiar(b.nombre_corto, 40) || limpiar(b.nombre, 40),
    nombre_grafico: limpiar(b.nombre, 80).toUpperCase(),
    clave: (limpiar(b.clave, 40) || limpiar(b.nombre_corto, 40)).toLowerCase(),
    color: limpiar(b.color, 7) || '#1B7A43',
    emojis: limpiar(b.emojis, 12) || '⚪',
    hashtags: limpiar(b.hashtags, 160) || null,
    competicion: limpiar(b.competicion, 80).toUpperCase() || null,
    campo_casa: limpiar(b.campo_casa, 60).toUpperCase() || null,
    rfaf_calendario_url: limpiar(b.rfaf_calendario_url, 400) || null,
    rfaf_clasificacion_url: limpiar(b.rfaf_clasificacion_url, 400) || null,
    rfaf_jornada_url: limpiar(b.rfaf_jornada_url, 400) || null,
    estado: 'prueba',
    plan: 'prueba',
    prueba_hasta: new Date(Date.now() + diasPrueba * 86400000).toISOString().slice(0, 10),
    contacto_email: email,
  }
  if (!club.nombre) return res.status(400).json({ ok: false, error: 'Falta el nombre del club' })

  const creado = await rest('/rest/v1/clubes', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(club) })
  if (!creado.ok) {
    const msg = JSON.stringify(creado.datos)
    return res.status(400).json({ ok: false, error: /duplicate|unique/i.test(msg) ? 'Ya existe un club con esa dirección' : `No se pudo crear el club: ${msg}` })
  }
  const clubId = creado.datos[0].id

  // 3) Invitar al entrenador (o reutilizar su usuario si ya existe)
  const origen = req.headers['x-forwarded-host'] ? `https://${req.headers['x-forwarded-host']}` : 'https://www.miequipoaldia.com'
  let userId = null
  const inv = await rest(`/auth/v1/invite?redirect_to=${encodeURIComponent(`${origen}/${slug}/`)}`, { method: 'POST', body: JSON.stringify({ email }) })
  if (inv.ok) userId = inv.datos?.id
  else {
    // Ya tiene cuenta: buscarlo
    for (let pagina = 1; pagina <= 10 && !userId; pagina++) {
      const lista = await rest(`/auth/v1/admin/users?page=${pagina}&per_page=100`)
      const u = (lista.datos?.users || []).find((x) => (x.email || '').toLowerCase() === email)
      if (u) userId = u.id
      if (!lista.datos?.users?.length) break
    }
  }
  if (!userId) return res.status(200).json({ ok: true, club: slug, aviso: `Club creado, pero no se pudo invitar a ${email}: ${JSON.stringify(inv.datos)}` })

  await rest('/rest/v1/staff', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates' }, body: JSON.stringify({ user_id: userId, club_id: clubId, email, rol: 'admin' }) })

  // 4) Catálogo de multas inicial y marcar el interesado como dado de alta
  await rest('/rest/v1/tipos_multa', {
    method: 'POST',
    body: JSON.stringify([
      { club_id: clubId, motivo: 'Llegar tarde al entreno', importe_sugerido: 1 },
      { club_id: clubId, motivo: 'Faltar sin avisar', importe_sugerido: 3 },
      { club_id: clubId, motivo: 'Olvidar el material', importe_sugerido: 2 },
    ]),
  })
  if (b.interesado_id) {
    await rest(`/rest/v1/interesados?id=eq.${Number(b.interesado_id)}`, { method: 'PATCH', body: JSON.stringify({ club_slug: slug }) })
  }

  return res.status(200).json({ ok: true, club: slug, enlace: `${origen}/${slug}`, invitado: inv.ok })
}
