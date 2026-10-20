// Recibe el formulario "Quiero probarla": lo guarda en Supabase y te avisa por email.
// Variables de entorno en Vercel (proyecto miequipoaldia-web):
//   RESEND_API_KEY  -> clave de resend.com (para el email)
//   AVISO_EMAIL     -> a quién avisar (por defecto miequipoaldia@gmail.com)
const SUPABASE_URL = 'https://orxdobcorsqejuecpouc.supabase.co'
const SUPABASE_KEY = 'sb_publishable_znScSXTgDv7wnFtZwNfjLw_shUPDfzl' // clave pública (solo puede insertar aquí)

const limpiar = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false })
  let b = req.body
  if (typeof b === 'string') {
    try { b = JSON.parse(b) } catch { b = {} }
  }
  b = b || {}
  if (b.web) return res.status(200).json({ ok: true }) // trampa para bots

  const fila = {
    nombre: limpiar(b.nombre, 80),
    club: limpiar(b.club, 120),
    categoria: limpiar(b.categoria, 40) || null,
    rol: limpiar(b.rol, 40) || null,
    email: limpiar(b.email, 120),
    telefono: limpiar(b.telefono, 20) || null,
  }
  if (!fila.nombre || !fila.club || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fila.email)) {
    return res.status(400).json({ ok: false, error: 'Datos incompletos' })
  }

  const r = await fetch(`${SUPABASE_URL}/rest/v1/interesados`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(fila),
  })
  if (!r.ok) return res.status(502).json({ ok: false, error: 'No se pudo guardar' })

  // El aviso no debe impedir que el registro quede guardado
  let aviso = 'sin RESEND_API_KEY'
  if (process.env.RESEND_API_KEY) {
    const lineas = [
      `Nombre: ${fila.nombre}`,
      `Club / equipo: ${fila.club}`,
      `Categoría: ${fila.categoria || '-'}`,
      `Rol: ${fila.rol || '-'}`,
      `Email: ${fila.email}`,
      `Teléfono: ${fila.telefono || '-'}`,
    ]
    try {
      const r2 = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Mi Equipo Al Día <onboarding@resend.dev>',
          to: [(process.env.AVISO_EMAIL || 'miequipoaldia@gmail.com').trim()],
          reply_to: fila.email,
          subject: `⚽ Nuevo interesado: ${fila.club}`,
          text: `Alguien quiere probar Mi Equipo Al Día:\n\n${lineas.join('\n')}\n\nResponde a este email para escribirle directamente.`,
        }),
      })
      aviso = r2.ok ? 'enviado' : `error ${r2.status}: ${(await r2.text()).slice(0, 200)}`
    } catch (e) {
      aviso = `error: ${e.message}`
    }
  }
  console.log('Aviso por email:', aviso)
  return res.status(200).json({ ok: true, aviso })
}
