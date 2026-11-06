// Manifest propio de cada club: nombre, icono y dirección al "añadir a inicio"
const { datosClub } = require('./_club')

module.exports = async (req, res) => {
  const slug = String(req.query.club || '').toLowerCase()
  const c = await datosClub(slug)
  const nombre = c?.nombre_corto || c?.nombre || 'Mi Equipo Al Día'
  const base = c ? `/${slug}/` : '/'
  const icono = c?.icono_url
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400')
  res.status(200).send(JSON.stringify({
    id: base,
    name: `${nombre} · Mi Equipo Al Día`,
    short_name: nombre,
    start_url: base,
    scope: base,
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: c?.color || '#1B7A43',
    lang: 'es',
    icons: icono
      ? [{ src: icono, sizes: '512x512', type: 'image/png', purpose: 'any' }, { src: icono, sizes: '192x192', type: 'image/png', purpose: 'any' }]
      : [
          { src: '/marianistas/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/marianistas/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/marianistas/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
  }))
}
