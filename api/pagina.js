// Página de la app para cada club (miequipoaldia.com/<club>/). Es la misma app,
// pero con el nombre, el icono y el manifest del club ya en el HTML: así el
// "añadir a pantalla de inicio" del móvil guarda ESTE equipo y no Marianistas.
const { datosClub, esc } = require('./_club')
const APP = 'https://juvenil-a-marianistas.vercel.app/marianistas/index.html'

module.exports = async (req, res) => {
  const slug = String(req.query.club || '').toLowerCase()
  const [html, c] = await Promise.all([fetch(APP).then((r) => r.text()), datosClub(slug)])
  let out = html
  if (c) {
    const nombre = esc(c.nombre_corto || c.nombre)
    out = out
      .replace(/<title>[^<]*<\/title>/, `<title>${nombre} · Mi Equipo Al Día</title>`)
      .replace(/(<meta name="apple-mobile-web-app-title" content=")[^"]*"/, `$1${nombre}"`)
      .replace(/(<link rel="manifest" href=")[^"]*"/, `$1/${slug}/manifest.webmanifest"`)
      .replace(/(<meta name="theme-color" content=")[^"]*"/, `$1${esc(c.color || '#1B7A43')}"`)
    if (c.icono_url) {
      out = out
        .replace(/(<link rel="apple-touch-icon" href=")[^"]*"/, `$1${esc(c.icono_url)}"`)
        .replace(/(<link rel="icon" type="image\/png" href=")[^"]*"/, `$1${esc(c.icono_url)}"`)
    }
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600')
  res.status(200).send(out)
}
