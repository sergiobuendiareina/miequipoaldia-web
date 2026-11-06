// Sugerencias de los entrenadores desde la app (aviso semanal "¿Qué mejorarías?").
//   POST {club, texto}  (con la sesión del entrenador)
// Se guarda en la tabla "sugerencias" y te llega por email (responder = contestarle).
const SUPABASE_URL = 'https://orxdobcorsqejuecpouc.supabase.co'

function cabeceras() {
  const k = (process.env.SUPABASE_SECRET_KEY || '').trim()
  return { apikey: k, Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false })
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
  const texto = String(b.texto || '').trim().slice(0, 3000)
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) return res.status(400).json({ ok: false, error: 'Club no válido' })
  if (texto.length < 2) return res.status(400).json({ ok: false, error: 'Escribe algo antes de enviar' })

  const c = await fetch(`${SUPABASE_URL}/rest/v1/clubes?select=id,nombre&slug=eq.${slug}`, { headers: cabeceras() })
  const club = (await c.json())?.[0]
  if (!club) return res.status(404).json({ ok: false, error: 'Club no encontrado' })

  const g = await fetch(`${SUPABASE_URL}/rest/v1/sugerencias`, {
    method: 'POST',
    headers: { ...cabeceras(), Prefer: 'return=minimal' },
    body: JSON.stringify({ club_id: club.id, user_id: usuario.id, email: usuario.email, texto }),
  })
  if (!g.ok) console.log('No se pudo guardar la sugerencia:', g.status, (await g.text()).slice(0, 200))

  let aviso = 'sin RESEND_API_KEY'
  if (process.env.RESEND_API_KEY) {
    try {
      const r2 = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Mi Equipo Al Día <onboarding@resend.dev>',
          to: [(process.env.AVISO_EMAIL || 'miequipoaldia@gmail.com').trim()],
          reply_to: usuario.email,
          subject: `💬 Sugerencia de ${club.nombre}`,
          text: `${club.nombre} (/${slug}) · ${usuario.email}\n\n${texto}\n\nResponde a este email para contestarle directamente.`,
        }),
      })
      aviso = r2.ok ? 'enviado' : `error ${r2.status}`
    } catch (e) {
      aviso = `error: ${e.message}`
    }
  }
  console.log('Sugerencia:', slug, 'guardada:', g.ok, 'email:', aviso)
  return res.status(g.ok || aviso === 'enviado' ? 200 : 500).json({ ok: g.ok || aviso === 'enviado' })
}
