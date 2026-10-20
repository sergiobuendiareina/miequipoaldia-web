// GET /api/confirmar-pago?session_id=cs_...
// Al volver de Stripe, la app llama aquí para activar el club en el momento
// (el webhook hace lo mismo por si el usuario cerró la página antes de volver).
const { stripe, aplicarPago } = require('./_pagos')

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false })
  const id = String(req.query.session_id || '')
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) return res.status(400).json({ ok: false, error: 'Pago no válido' })
  if (!process.env.STRIPE_SECRET_KEY || !process.env.SUPABASE_SECRET_KEY) return res.status(500).json({ ok: false, error: 'Pagos sin configurar' })

  const s = await stripe(`/checkout/sessions/${id}`)
  if (!s.ok) return res.status(400).json({ ok: false, error: 'No se encontró el pago' })
  const r = await aplicarPago(s.datos)
  return res.status(r.ok ? 200 : 400).json(r)
}
