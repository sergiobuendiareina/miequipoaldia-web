// Cuerpo técnico de un club: el entrenador invita o quita a su segundo,
// delegado, etc. desde "Mi club".
//   POST   {club, email}    -> invita por email y le da permisos de staff
//   DELETE {club, user_id}  -> le quita los permisos
// Solo puede hacerlo el admin del club (quien lo dio de alta) o el superadmin.
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

const MAX_STAFF = 6

module.exports = async (req, res) => {
  if (!['POST', 'DELETE'].includes(req.method)) return res.status(405).json({ ok: false })
  if (!process.env.SUPABASE_SECRET_KEY) return res.status(500).json({ ok: false, error: 'Falta SUPABASE_SECRET_KEY en Vercel' })

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ ok: false, error: 'Inicia sesión' })
  const yo = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: cabeceras().apikey, Authorization: `Bearer ${token}` } })
  if (!yo.ok) return res.status(401).json({ ok: false, error: 'Sesión no válida, vuelve a entrar' })
  const usuario = await yo.json()

  let b = req.body
  if (typeof b === 'string') { try { b = JSON.parse(b) } catch { b = {} } }
  b = b || {}
  const slug = String(b.club || '').toLowerCase()
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) return res.status(400).json({ ok: false, error: 'Club no válido' })

  const c = await rest(`/rest/v1/clubes?select=id,slug,nombre&slug=eq.${slug}`)
  const club = c.datos?.[0]
  if (!club) return res.status(404).json({ ok: false, error: 'Club no encontrado' })

  // ¿Quién lo pide? Admin del club o superadmin
  const mio = await rest(`/rest/v1/staff?select=rol&user_id=eq.${usuario.id}&club_id=eq.${club.id}`)
  const sa = await rest(`/rest/v1/superadmins?select=user_id&user_id=eq.${usuario.id}`)
  const esAdmin = mio.datos?.[0]?.rol === 'admin' || !!sa.datos?.length
  if (!esAdmin) return res.status(403).json({ ok: false, error: 'Solo el entrenador principal del club puede gestionar el cuerpo técnico' })

  if (req.method === 'DELETE') {
    const uid = String(b.user_id || '')
    if (!/^[0-9a-f-]{36}$/.test(uid)) return res.status(400).json({ ok: false, error: 'Usuario no válido' })
    if (uid === usuario.id) return res.status(400).json({ ok: false, error: 'No puedes quitarte a ti mismo' })
    const r = await rest(`/rest/v1/staff?user_id=eq.${uid}&club_id=eq.${club.id}`, { method: 'DELETE' })
    return res.status(r.ok ? 200 : 500).json({ ok: r.ok })
  }

  // POST: invitar
  const email = String(b.email || '').trim().toLowerCase().slice(0, 120)
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ ok: false, error: 'Email no válido' })

  const actuales = await rest(`/rest/v1/staff?select=user_id,email&club_id=eq.${club.id}`)
  if ((actuales.datos || []).some((s) => (s.email || '').toLowerCase() === email)) return res.status(400).json({ ok: false, error: 'Esa persona ya está en el cuerpo técnico' })
  if ((actuales.datos || []).length >= MAX_STAFF) return res.status(400).json({ ok: false, error: `Máximo ${MAX_STAFF} personas en el cuerpo técnico` })

  const origen = req.headers['x-forwarded-host'] ? `https://${req.headers['x-forwarded-host']}` : 'https://www.miequipoaldia.com'
  let userId = null
  let invitado = false
  const inv = await rest(`/auth/v1/invite?redirect_to=${encodeURIComponent(`${origen}/${slug}/`)}`, { method: 'POST', body: JSON.stringify({ email }) })
  if (inv.ok) {
    userId = inv.datos?.id
    invitado = true
  } else {
    // Ya tiene cuenta (por ejemplo, es staff de otro club): se reutiliza
    for (let pagina = 1; pagina <= 10 && !userId; pagina++) {
      const lista = await rest(`/auth/v1/admin/users?page=${pagina}&per_page=100`)
      const u = (lista.datos?.users || []).find((x) => (x.email || '').toLowerCase() === email)
      if (u) userId = u.id
      if (!lista.datos?.users?.length) break
    }
  }
  if (!userId) return res.status(400).json({ ok: false, error: `No se pudo invitar a ${email}. Prueba en unos minutos.` })

  const st = await rest('/rest/v1/staff', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates' },
    body: JSON.stringify({ user_id: userId, club_id: club.id, email, rol: 'staff' }),
  })
  if (!st.ok) return res.status(500).json({ ok: false, error: 'No se pudieron dar los permisos' })
  return res.status(200).json({ ok: true, invitado })
}
