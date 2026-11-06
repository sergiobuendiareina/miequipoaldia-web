// Datos públicos de un club para personalizar la página y el "añadir a inicio"
const SUPABASE_URL = 'https://orxdobcorsqejuecpouc.supabase.co'
const SUPABASE_KEY = 'sb_publishable_znScSXTgDv7wnFtZwNfjLw_shUPDfzl'

async function datosClub(slug) {
  if (!/^[a-z0-9-]{2,40}$/.test(slug || '')) return null
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/clubes?select=slug,nombre,nombre_corto,color,icono_url,estado&slug=eq.${slug}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    })
    const c = (await r.json())?.[0]
    return c && c.estado !== 'suspendido' ? c : null
  } catch {
    return null
  }
}

const esc = (t) => String(t || '').replace(/[&<>"]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[x]))

module.exports = { datosClub, esc }
