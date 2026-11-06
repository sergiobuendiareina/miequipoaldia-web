// "¿Está tu liga? Busca tu equipo": busca en las clasificaciones de las ligas que
// ya sincroniza la app y devuelve el grupo con el equipo para enseñarlo sin registrarse.
//   GET ?q=texto           -> equipos que coinciden
//   GET ?grupo=<club_id>   -> clasificación completa de ese grupo
const SUPABASE_URL = 'https://orxdobcorsqejuecpouc.supabase.co'
const OCULTOS = ['prueba', 'demo']

const sinTildes = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim()

async function rest(ruta) {
  const k = (process.env.SUPABASE_SECRET_KEY || '').trim()
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, { headers: { apikey: k, Authorization: `Bearer ${k}` } })
  return r.ok ? r.json() : []
}

module.exports = async (req, res) => {
  if (!process.env.SUPABASE_SECRET_KEY) return res.status(500).json({ ok: false })
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600')
  const clubes = (await rest('clubes?select=id,slug,nombre,competicion,estado,rfaf_clasificacion_url')).filter((c) => !OCULTOS.includes(c.slug) && c.estado !== 'suspendido')
  const porId = new Map(clubes.map((c) => [c.id, c]))
  const liga = (c) => ({
    grupo: c.id,
    liga: c.competicion || 'Liga federada',
    federacion: (c.rfaf_clasificacion_url || '').startsWith('ffcv:') ? 'Valenciana' : 'Andaluza',
  })

  if (req.query.grupo) {
    const c = porId.get(String(req.query.grupo))
    if (!c) return res.status(404).json({ ok: false })
    const filas = await rest(`clasificacion?select=posicion,equipo,escudo_url,pj,pts&club_id=eq.${c.id}&order=posicion`)
    return res.status(200).json({ ok: true, ...liga(c), filas })
  }

  const q = sinTildes(req.query.q).slice(0, 40)
  if (q.length < 3) return res.status(200).json({ ok: true, resultados: [] })
  const filas = (await rest('clasificacion?select=club_id,posicion,equipo,escudo_url,pts&limit=5000')).filter((f) => porId.has(f.club_id))
  const palabras = q.split(' ')
  const vistos = new Set()
  const resultados = filas
    .filter((f) => { const n = sinTildes(f.equipo); return palabras.every((p) => n.includes(p)) })
    .filter((f) => { const k = `${f.club_id}|${f.equipo}`; if (vistos.has(k)) return false; vistos.add(k); return true })
    .slice(0, 12)
    .map((f) => {
      const c = porId.get(f.club_id)
      // ¿Es el propio club que ya usa la app?
      const cliente = sinTildes(f.equipo).includes(sinTildes(c.nombre).split(' ').pop()) ? c.slug : null
      return { equipo: f.equipo, escudo: f.escudo_url, posicion: f.posicion, pts: f.pts, cliente, ...liga(c) }
    })
  return res.status(200).json({ ok: true, resultados })
}
