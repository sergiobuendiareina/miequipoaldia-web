// /sitemap.xml: portada + páginas de clasificación de cada liga sincronizada
const { ligas } = require('./liga')
const WEB = 'https://www.miequipoaldia.com'
module.exports = async (req, res) => {
  const hoy = new Date().toISOString().slice(0, 10)
  const urls = [`${WEB}/`, `${WEB}/clasificacion`, ...(await ligas().catch(() => [])).map((l) => `${WEB}/clasificacion/${l.slug}`)]
  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=3600')
  res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${hoy}</lastmod><changefreq>weekly</changefreq></url>`).join('\n')}\n</urlset>\n`)
}
