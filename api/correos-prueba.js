// Correos automáticos durante el mes de prueba (lo lanza Vercel cada mañana).
//   bienvenida  -> al día siguiente del alta: 3 cosas para la primera semana
//   sin_uso     -> a los 4 días, si todavía no ha apuntado nada: ofrecer ayuda
//   quedan7     -> cuando quedan 7 días o menos: lo que lleva hecho + cómo pagar
//   terminada   -> en los 3 días siguientes al final de la prueba: sus datos siguen ahí
// Cada correo sale una sola vez por club (se apunta en clubes.correos).
// Variables de entorno en Vercel:
//   RESEND_API_KEY    -> para enviar
//   EMAIL_REMITENTE   -> p. ej. "Sergio · Mi Equipo Al Día <hola@miequipoaldia.com>" (dominio verificado en Resend).
//                        Sin ella, MODO PRUEBA: todos los correos te llegan a ti (AVISO_EMAIL) para revisarlos.
//   CRON_SECRET       -> (opcional) protege la dirección; Vercel la manda sola en el cron
const { rest, plazasFundadorLibres } = require('./_pagos')

const DIA = 86400000
const RESPONDER = 'miequipoaldia@gmail.com'
const hoy = () => new Date(new Date().toISOString().slice(0, 10))
const dias = (a, b) => Math.round((a - b) / DIA)

function plantilla(tipo, c, d) {
  const url = `https://www.miequipoaldia.com/${c.slug}/`
  const quien = c.nombre_corto || c.nombre
  const firma = '\n\nUn saludo,\nSergio\nMi Equipo Al Día\n\n(Si tienes cualquier duda, responde a este correo: me llega a mí.)'
  if (tipo === 'bienvenida') {
    return {
      asunto: `${quien}: 3 cosas para tu primera semana con la app`,
      texto: `Hola, míster:\n\nYa tienes la app de ${c.nombre} lista en ${url}\n\nPara sacarle partido desde la primera semana:\n\n1. Pasa lista en el próximo entreno: tocas solo a quien falta y el resto queda como presente.\n2. Haz la convocatoria del partido: verás quién ha entrenado, las amarillas y las sanciones de cada jugador.\n3. Pon el once tocando los huecos del campo y, el día del partido, usa el Modo partido para apuntar goles, tarjetas y cambios. Los minutos se calculan solos.\n\nConsejo: añade la app a la pantalla de inicio del móvil (en el navegador, «Compartir» → «Añadir a pantalla de inicio») para tenerla como una app más.${firma}`,
    }
  }
  if (tipo === 'sin_uso') {
    return {
      asunto: `¿Te ayudo a arrancar con la app de ${quien}?`,
      texto: `Hola, míster:\n\nHe visto que todavía no has podido apuntar nada en la app de ${c.nombre}. Es normal: al principio cuesta encontrar el momento.\n\nSi quieres, contéstame a este correo con lo que más te cueste (la plantilla, los entrenos, la convocatoria…) y te lo dejo preparado yo. Y si prefieres verlo primero, en la demo puedes tocar todo sin miedo: https://www.miequipoaldia.com/demo/\n\nTu app: ${url}${firma}`,
    }
  }
  if (tipo === 'quedan7') {
    const hecho = [
      d.entrenos && `${d.entrenos} entreno${d.entrenos > 1 ? 's' : ''} con lista`,
      d.convocatorias && `${d.convocatorias} convocatoria${d.convocatorias > 1 ? 's' : ''}`,
      d.partidos && `${d.partidos} partido${d.partidos > 1 ? 's' : ''} apuntado${d.partidos > 1 ? 's' : ''}`,
    ].filter(Boolean)
    const precio = d.precio
    return {
      asunto: `Te quedan ${d.quedan} día${d.quedan === 1 ? '' : 's'} de prueba en ${quien}`,
      texto: `Hola, míster:\n\nTu mes de prueba de ${c.nombre} termina el ${new Date(c.prueba_hasta).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}.\n\n${hecho.length ? `En este mes llevas ${hecho.join(', ')}. ` : ''}Para seguir usándola toda la temporada es un único pago de ${precio.texto} hasta el 30 de junio, sin renovaciones automáticas${precio.nota ? ` (${precio.nota})` : ''}.\n\nPuedes pagar desde la propia app con el botón «Pagar temporada»: ${url}\n\nSi no sigues, la parte pública (inicio, liga y equipo) sigue funcionando y no se borra nada.${firma}`,
    }
  }
  if (tipo === 'terminada') {
    return {
      asunto: `Tu prueba de ${quien} ha terminado (tus datos siguen ahí)`,
      texto: `Hola, míster:\n\nTu mes de prueba de ${c.nombre} ha terminado. No se ha borrado nada: jugadores, partidos, entrenos y estadísticas siguen guardados.\n\nPara volver a gestionarlo todo, paga la temporada desde la app (${d.precio.texto}, hasta el 30 de junio): ${url}\n\nSi hay algo que te ha frenado o que echas en falta, cuéntamelo respondiendo a este correo. Me ayuda mucho.${firma}`,
    }
  }
  return null
}

async function contar(tabla, clubId, columna) {
  // Número de filas distintas por columna (partido_id, entreno_id…) de un club
  const r = await rest(`/rest/v1/${tabla}?select=${columna}&club_id=eq.${clubId}&limit=1000`)
  return Array.isArray(r.datos) ? new Set(r.datos.map((x) => x[columna])).size : 0
}

module.exports = async (req, res) => {
  const secreto = (process.env.CRON_SECRET || '').trim()
  if (secreto && req.headers.authorization !== `Bearer ${secreto}`) return res.status(401).json({ ok: false })

  const real = !!(process.env.EMAIL_REMITENTE || '').trim()
  const remitente = real ? process.env.EMAIL_REMITENTE.trim() : 'Mi Equipo Al Día <onboarding@resend.dev>'
  const aviso = (process.env.AVISO_EMAIL || RESPONDER).trim()

  const r = await rest('/rest/v1/clubes?select=id,slug,nombre,nombre_corto,estado,plan,prueba_hasta,created_at,contacto_email,correos,referido_por&estado=eq.prueba')
  if (!r.ok) return res.status(500).json({ ok: false, error: r.datos })
  const libres = await plazasFundadorLibres().catch(() => 0)
  const base = libres > 0 ? 25 : 39

  const enviados = []
  for (const c of r.datos || []) {
    if (!c.contacto_email || !c.prueba_hasta || c.slug === 'demo' || c.slug === 'prueba') continue
    const desdeAlta = dias(hoy(), new Date(c.created_at.slice(0, 10)))
    const quedan = dias(new Date(c.prueba_hasta), hoy())
    const ya = c.correos || {}
    const clave = (t) => (real ? t : `prueba_${t}`)

    let tipo = null
    let d = {}
    if (quedan < 0 && quedan >= -3 && !ya[clave('terminada')]) tipo = 'terminada'
    else if (quedan >= 1 && quedan <= 7 && !ya[clave('quedan7')]) tipo = 'quedan7'
    else if (desdeAlta >= 4 && quedan > 7 && !ya[clave('sin_uso')]) {
      const usado = (await contar('asistencia_entrenos', c.id, 'entreno_id')) + (await contar('convocatorias', c.id, 'partido_id'))
      if (!usado) tipo = 'sin_uso'
    }
    if (!tipo && desdeAlta >= 1 && desdeAlta <= 3 && !ya[clave('bienvenida')]) tipo = 'bienvenida'
    if (!tipo) continue

    if (tipo === 'quedan7' || tipo === 'terminada') {
      const pct = c.referido_por ? 10 : 0
      const final = Math.round(base * (100 - pct)) / 100
      d = {
        quedan,
        entrenos: await contar('asistencia_entrenos', c.id, 'entreno_id'),
        convocatorias: await contar('convocatorias', c.id, 'partido_id'),
        partidos: await contar('minutos_jugados', c.id, 'partido_id'),
        precio: { texto: `${String(final).replace('.', ',')} €`, nota: [libres > 0 && 'precio de club fundador', pct && '10% por venir invitado'].filter(Boolean).join(' y ') },
      }
    }
    const m = plantilla(tipo, c, d)
    const para = real ? c.contacto_email : aviso
    const asunto = real ? m.asunto : `[PRUEBA → ${c.contacto_email}] ${m.asunto}`
    const envio = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${(process.env.RESEND_API_KEY || '').trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: remitente, to: [para], reply_to: RESPONDER, subject: asunto, text: m.texto }),
    })
    if (!envio.ok) {
      enviados.push({ club: c.slug, tipo, error: `${envio.status} ${(await envio.text()).slice(0, 120)}` })
      continue
    }
    await rest(`/rest/v1/clubes?id=eq.${c.id}`, { method: 'PATCH', body: JSON.stringify({ correos: { ...ya, [clave(tipo)]: new Date().toISOString() } }) })
    enviados.push({ club: c.slug, tipo, para })
  }
  return res.status(200).json({ ok: true, modo: real ? 'real' : 'prueba (todo a ti)', enviados })
}
