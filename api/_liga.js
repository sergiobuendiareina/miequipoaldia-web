// (No es una función de Vercel por sí sola: la sirve api/buscar-equipo.js para no pasar del límite de 12 del plan gratis)
// Páginas públicas de clasificación para Google (SEO):
//   /clasificacion            -> índice de las ligas que ya sincroniza la app
//   /clasificacion/<liga>     -> clasificación, última jornada y llamada a probar la app
// Solo nombres de equipos y resultados (datos públicos de la federación). Nunca jugadores.
const SUPABASE_URL = 'https://orxdobcorsqejuecpouc.supabase.co'
const OCULTOS = ['prueba', 'demo']
const WEB = 'https://www.miequipoaldia.com'
const TEMPORADA = '2026-27'

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const slugify = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)

async function rest(ruta) {
  const k = (process.env.SUPABASE_SECRET_KEY || '').trim()
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, { headers: { apikey: k, Authorization: `Bearer ${k}` } })
  return r.ok ? r.json() : []
}

// Una entrada por liga (si dos clubes clientes comparten grupo, se usa el primero)
async function ligas() {
  const clubes = (await rest('clubes?select=id,slug,competicion,estado,rfaf_clasificacion_url&order=created_at'))
    .filter((c) => !OCULTOS.includes(c.slug) && c.estado !== 'suspendido' && c.competicion)
  const porSlug = new Map()
  for (const c of clubes) {
    const s = slugify(c.competicion)
    if (s && !porSlug.has(s)) porSlug.set(s, { slug: s, nombre: c.competicion, club_id: c.id, federacion: (c.rfaf_clasificacion_url || '').startsWith('ffcv:') ? 'Federación de Fútbol de la Comunitat Valenciana' : 'Real Federación Andaluza de Fútbol' })
  }
  return [...porSlug.values()]
}

const CSS = `
@font-face{font-family:BCI;src:url(/assets/bci.woff) format("woff");font-display:swap}
:root{--verde:#1B7A43;--verde2:#14603A;--amarillo:#FFD23F;--tinta:#0E1B2E;--suave:#F4FAF6;--gris:#5B6B7F;--linea:#E1E8E3;--fondo:#ffffff}
@media (prefers-color-scheme:dark){:root{--tinta:#E9EEF3;--suave:#13202F;--gris:#9AA8B5;--linea:#24344A;--fondo:#0B1420;--verde:#3DBE73}}
*{box-sizing:border-box}
body{margin:0;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--tinta);background:var(--fondo);-webkit-font-smoothing:antialiased;line-height:1.5}
a{color:inherit}
.wrap{max-width:820px;margin:0 auto;padding:0 max(16px,env(safe-area-inset-left,0px))}
header.top{background:#1B7A43;color:#fff;padding:18px 0 34px}
.marca{display:inline-flex;align-items:center;gap:8px;background:#fff;color:#0E1B2E;padding:6px 12px;border-radius:12px;text-decoration:none;font-weight:800;font-size:14px}
.marca img{width:26px;height:26px}
h1,h2{font-family:BCI,"Arial Narrow",Inter,sans-serif;font-weight:800;line-height:.95;margin:0;text-transform:uppercase;text-wrap:balance}
h1{font-size:clamp(34px,7vw,56px);margin-top:22px}
.sub{opacity:.9;margin:10px 0 0;font-size:15px}
main{padding:28px 0 40px;display:flex;flex-direction:column;gap:26px}
h2{font-size:28px;margin-bottom:10px}
.tabla{overflow-x:auto;border:1px solid var(--linea);border-radius:14px}
table{border-collapse:collapse;width:100%;font-size:14px;font-variant-numeric:tabular-nums}
th,td{padding:9px 8px;text-align:center;border-bottom:1px solid var(--linea);white-space:nowrap}
th{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--gris);background:var(--suave)}
td.eq{text-align:left;font-weight:600;white-space:normal;min-width:150px}
td.eq span{display:flex;align-items:center;gap:8px}
td.eq img{width:22px;height:22px;object-fit:contain;flex:none}
td.pts{font-weight:800}
tr:last-child td{border-bottom:0}
.res{display:grid;gap:6px}
.par{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;padding:9px 12px;border:1px solid var(--linea);border-radius:12px;font-size:14px}
.par .l{text-align:right}.par b{font-size:16px;font-variant-numeric:tabular-nums;min-width:48px;text-align:center}
.cta{background:#FFD23F;color:#0E1B2E;border-radius:18px;padding:22px}
.cta h2{font-size:30px}
.cta p{margin:8px 0 16px;max-width:60ch}
.btn{display:inline-block;background:#0E1B2E;color:#fff;text-decoration:none;font-weight:800;padding:14px 22px;border-radius:12px}
.lista{display:grid;gap:10px}
.lista a{display:block;padding:14px 16px;border:1px solid var(--linea);border-radius:14px;text-decoration:none;font-weight:700}
.lista small{display:block;color:var(--gris);font-weight:500}
@media (max-width:480px){th.g,td.g{display:none}th,td{padding:9px 6px}}
.acc{display:flex;flex-wrap:wrap;gap:14px;align-items:center}
.acc .demo{font-weight:700}
footer{border-top:1px solid var(--linea);padding:18px 0 30px;color:var(--gris);font-size:13px}
`

function pagina({ titulo, descripcion, canonica, cuerpo, h1, sub }) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descripcion)}">
<link rel="canonical" href="${canonica}">
<meta property="og:title" content="${esc(titulo)}"><meta property="og:description" content="${esc(descripcion)}">
<meta property="og:type" content="website"><meta property="og:url" content="${canonica}"><meta property="og:image" content="${WEB}/assets/icon-192.png">
<link rel="icon" href="/assets/favicon.png">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body>
<header class="top"><div class="wrap"><a class="marca" href="/"><img src="/assets/logo.png" alt="">MI EQUIPO AL DÍA</a>
<h1>${h1}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div></header>
<main class="wrap">${cuerpo}</main>
<footer><div class="wrap">Datos públicos de la federación, actualizados automáticamente por <a href="/">Mi Equipo Al Día</a>, la app para entrenadores de fútbol base. · <a href="/clasificacion">Otras ligas</a></div></footer>
</body></html>`
}

const cta = (liga) => `<section class="cta"><h2>¿Entrenas en ${esc(liga)}?</h2>
<p>Esta clasificación se actualiza sola. Con <b>Mi Equipo Al Día</b> la tienes dentro de la app de tu equipo, junto a tu calendario, la plantilla, las convocatorias, los minutos de cada jugador y las sanciones del Comité. <b>1 mes gratis, sin tarjeta.</b></p>
<div class="acc"><a class="btn" href="/#probar">Quiero la app de mi equipo →</a><a class="demo" href="/demo/">Ver la demo</a></div></section>`

module.exports = async (req, res) => {
  if (!process.env.SUPABASE_SECRET_KEY) return res.status(500).send('Sin configurar')
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
  const todas = await ligas()
  const l = slugify(req.query.l || '')

  if (!l) {
    const cuerpo = `<section><h2>Ligas disponibles</h2><div class="lista">${todas.map((x) => `<a href="/clasificacion/${x.slug}">${esc(x.nombre)}<small>${esc(x.federacion)} · temporada ${TEMPORADA}</small></a>`).join('')}</div></section>${cta('fútbol base')}`
    return res.status(200).send(pagina({ titulo: `Clasificaciones de fútbol base ${TEMPORADA} | Mi Equipo Al Día`, descripcion: `Clasificaciones y resultados actualizados de ligas de fútbol base, temporada ${TEMPORADA}.`, canonica: `${WEB}/clasificacion`, h1: 'Clasificaciones de fútbol base', sub: `Temporada ${TEMPORADA} · se actualizan solas cada semana`, cuerpo }))
  }

  const liga = todas.find((x) => x.slug === l)
  if (!liga) {
    res.setHeader('Cache-Control', 'public, s-maxage=300')
    return res.status(404).send(pagina({ titulo: 'Liga no encontrada | Mi Equipo Al Día', descripcion: 'Liga no encontrada', canonica: `${WEB}/clasificacion`, h1: 'Liga no encontrada', sub: 'Puede que esta liga aún no esté disponible.', cuerpo: `<p><a href="/clasificacion">Ver las ligas disponibles →</a></p>` }))
  }

  const [filas, resultados] = await Promise.all([
    rest(`clasificacion?select=posicion,equipo,escudo_url,pj,pg,pe,pp,gf,gc,pts&club_id=eq.${liga.club_id}&order=posicion`),
    rest(`resultados_liga?select=jornada,fecha,local,visitante,gl,gv&club_id=eq.${liga.club_id}&order=jornada.desc&limit=60`),
  ])
  const ultima = resultados.length ? resultados[0].jornada : null
  const deUltima = resultados.filter((r) => r.jornada === ultima)
  const v = (x) => (x ?? '')
  const tabla = filas.length ? `<section><h2>Clasificación</h2><div class="tabla"><table>
<thead><tr><th>#</th><th style="text-align:left">Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th class="g">GF</th><th class="g">GC</th><th>Pts</th></tr></thead><tbody>
${filas.map((f) => `<tr><td>${v(f.posicion)}</td><td class="eq"><span>${f.escudo_url ? `<img src="${esc(f.escudo_url)}" alt="" loading="lazy">` : ''}${esc(f.equipo)}</span></td><td>${v(f.pj)}</td><td>${v(f.pg)}</td><td>${v(f.pe)}</td><td>${v(f.pp)}</td><td class="g">${v(f.gf)}</td><td class="g">${v(f.gc)}</td><td class="pts">${v(f.pts)}</td></tr>`).join('')}
</tbody></table></div></section>` : '<p>La clasificación aparecerá en cuanto se juegue la primera jornada.</p>'
  const jornada = deUltima.length ? `<section><h2>Resultados de la jornada ${esc(ultima)}</h2><div class="res">${deUltima.map((r) => `<div class="par"><span class="l">${esc(r.local)}</span><b>${v(r.gl)} - ${v(r.gv)}</b><span>${esc(r.visitante)}</span></div>`).join('')}</div></section>` : ''
  const lider = filas[0]
  const desc = `Clasificación ${liga.nombre} ${TEMPORADA} actualizada${lider ? `: ${lider.equipo} lidera con ${lider.pts} puntos` : ''}.${ultima ? ` Resultados de la jornada ${ultima}.` : ''}`
  return res.status(200).send(pagina({
    titulo: `Clasificación ${liga.nombre} ${TEMPORADA} | Mi Equipo Al Día`,
    descripcion: desc,
    canonica: `${WEB}/clasificacion/${liga.slug}`,
    h1: `Clasificación ${esc(liga.nombre)}`,
    sub: `${esc(liga.federacion)} · temporada ${TEMPORADA}${ultima ? ` · actualizada tras la jornada ${esc(ultima)}` : ''}`,
    cuerpo: tabla + cta(liga.nombre) + jornada,
  }))
}
module.exports.ligas = ligas

// /sitemap.xml: portada + páginas de clasificación
module.exports.sitemap = async (req, res) => {
  const hoy = new Date().toISOString().slice(0, 10)
  const urls = [`${WEB}/`, `${WEB}/clasificacion`, ...(await ligas().catch(() => [])).map((l) => `${WEB}/clasificacion/${l.slug}`)]
  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=3600')
  res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${hoy}</lastmod><changefreq>weekly</changefreq></url>`).join('\n')}\n</urlset>\n`)
}
