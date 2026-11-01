// Sincroniza ya la liga de un club (botón "Sincronizar liga" del panel).
// Solo el superadmin. POST {club: slug}
const { lanzarSync } = require('./_sync')
const SUPABASE_URL = 'https://orxdobcorsqejuecpouc.supabase.co'
const k = () => (process.env.SUPABASE_SECRET_KEY || '').trim()

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false })
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ ok: false, error: 'Sin sesión' })
  const yo = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: k(), Authorization: `Bearer ${token}` } })
  if (!yo.ok) return res.status(401).json({ ok: false, error: 'Sesión no válida' })
  const usuario = await yo.json()
  const sa = await fetch(`${SUPABASE_URL}/rest/v1/superadmins?select=user_id&user_id=eq.${usuario.id}`, { headers: { apikey: k(), Authorization: `Bearer ${k()}` } })
  const filas = sa.ok ? await sa.json() : []
  if (!filas.length) return res.status(403).json({ ok: false, error: 'Solo el superadmin' })
  let b = req.body
  if (typeof b === 'string') { try { b = JSON.parse(b) } catch { b = {} } }
  const slug = String(b?.club || '').toLowerCase()
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) return res.status(400).json({ ok: false, error: 'Club no válido' })
  const r = await lanzarSync(slug)
  return res.status(r.ok ? 200 : 500).json(r.ok ? { ok: true } : { ok: false, error: r.motivo })
}
