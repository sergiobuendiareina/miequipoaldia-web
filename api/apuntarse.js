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
  // Datos nuevos del formulario (equipo, federación, liga y normas). Si la tabla aún no
  // tiene esas columnas, se guarda igualmente lo básico.
  const n = (v, a, z) => { const x = parseInt(v, 10); return x >= a && x <= z ? x : null }
  const rg = b.reglas && typeof b.reglas === 'object' ? b.reglas : {}
  const reglas = { parte: n(rg.parte, 10, 60), cambios: n(rg.cambios, 1, 30), ventanas: n(rg.ventanas, 1, 10), convocados: n(rg.convocados, 7, 30) }
  if (reglas.ventanas) reglas.ventanas_por = rg.ventanas_por === 'parte' ? 'parte' : 'partido'
  const extra = {
    equipo: limpiar(b.equipo, 10) || null,
    federacion: limpiar(b.federacion, 30) || null,
    liga: limpiar(b.liga, 120) || null,
    reglas: Object.values(reglas).some(Boolean) ? Object.fromEntries(Object.entries(reglas).filter(([, v]) => v)) : null,
  }
  if (!fila.nombre || !fila.club || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fila.email)) {
    return res.status(400).json({ ok: false, error: 'Datos incompletos' })
  }

  const guardar = (datos) => fetch(`${SUPABASE_URL}/rest/v1/interesados`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(datos),
  })
  let r = await guardar({ ...fila, ...extra })
  if (!r.ok) {
    console.log('Sin columnas nuevas en interesados:', r.status, (await r.text()).slice(0, 160))
    r = await guardar({ ...fila, club: fila.club + (extra.equipo && extra.equipo !== 'Único' ? ` ${extra.equipo}` : '') })
  }
  if (!r.ok) return res.status(502).json({ ok: false, error: 'No se pudo guardar' })

  // El aviso no debe impedir que el registro quede guardado
  let aviso = 'sin RESEND_API_KEY'
  if (process.env.RESEND_API_KEY) {
    const lineas = [
      `Nombre: ${fila.nombre}`,
      `Club: ${fila.club}`,
      `Equipo: ${extra.equipo || '-'}`,
      `Federación: ${extra.federacion || '-'}`,
      `Liga: ${extra.liga || '-'}`,
      `Normas: ${extra.reglas ? [extra.reglas.parte && `partes de ${extra.reglas.parte}'`, extra.reglas.cambios ? `${extra.reglas.cambios} cambios` : 'cambios ilimitados', extra.reglas.ventanas && `${extra.reglas.ventanas} ventanas (${extra.reglas.ventanas_por === 'parte' ? 'por parte' : 'en el partido'})`, extra.reglas.convocados && `máx. ${extra.reglas.convocados} convocados`].filter(Boolean).join(', ') : '-'}`,
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
          subject: `⚽ Nuevo interesado: ${fila.club}${extra.equipo && extra.equipo !== 'Único' ? ` ${extra.equipo}` : ''}${fila.categoria ? ` · ${fila.categoria}` : ''}`,
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
