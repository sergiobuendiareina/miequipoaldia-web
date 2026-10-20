// Aviso automático de Stripe cuando se completa un pago.
// En Stripe: Developers > Webhooks > Add endpoint
//   URL: https://www.miequipoaldia.com/api/stripe-webhook
//   Evento: checkout.session.completed
const crypto = require('crypto')
const { aplicarPago } = require('./_pagos')

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    const trozos = []
    req.on('data', (t) => trozos.push(typeof t === 'string' ? Buffer.from(t) : t))
    req.on('end', () => resolve(Buffer.concat(trozos)))
    req.on('error', reject)
  })
}

function firmaValida(cuerpo, cabecera, secreto) {
  if (!cabecera || !secreto) return false
  const partes = Object.fromEntries(cabecera.split(',').map((p) => p.split('=')).filter((p) => p.length === 2 && p[0] !== 'v1'))
  const firmas = cabecera.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3))
  const t = partes.t
  if (!t || Math.abs(Date.now() / 1000 - Number(t)) > 600) return false
  const esperada = crypto.createHmac('sha256', secreto).update(`${t}.${cuerpo.toString('utf8')}`).digest('hex')
  return firmas.some((f) => f.length === esperada.length && crypto.timingSafeEqual(Buffer.from(f), Buffer.from(esperada)))
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end()
  const cuerpo = await leerCuerpo(req)
  if (!firmaValida(cuerpo, req.headers['stripe-signature'], (process.env.STRIPE_WEBHOOK_SECRET || '').trim())) {
    return res.status(400).json({ ok: false, error: 'Firma no válida' })
  }
  const evento = JSON.parse(cuerpo.toString('utf8'))
  if (evento.type === 'checkout.session.completed' || evento.type === 'checkout.session.async_payment_succeeded') {
    const r = await aplicarPago(evento.data.object)
    if (!r.ok) console.error('Pago no aplicado', r)
  }
  return res.status(200).json({ received: true })
}

// Necesitamos el cuerpo tal cual llega para comprobar la firma
module.exports.config = { api: { bodyParser: false } }
