// Lanza en GitHub la sincronización de la liga de UN club (la RFAF no responde
// a los servidores de Vercel; la sincronización corre en GitHub Actions).
// Variable de entorno en Vercel (proyecto miequipoaldia-web):
//   GITHUB_TOKEN_SYNC -> token "fine-grained" de GitHub con permiso
//                        "Actions: Read and write" sobre el repo de la app.
const REPO = 'sergiobuendiareina/Juvenil-A-Marianistas'

async function lanzarSync(slug) {
  const token = (process.env.GITHUB_TOKEN_SYNC || '').trim()
  if (!token) return { ok: false, motivo: 'falta GITHUB_TOKEN_SYNC en Vercel' }
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/sync-liga.yml/dispatches`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'miequipoaldia', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: 'main', inputs: { club: slug } }),
    })
    return r.status === 204 ? { ok: true } : { ok: false, motivo: `GitHub respondió ${r.status}` }
  } catch (e) {
    return { ok: false, motivo: e.message }
  }
}

module.exports = { lanzarSync }
