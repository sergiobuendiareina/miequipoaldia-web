// GET  /api/pago            -> precios y plazas de fundador que quedan
// POST /api/pago {club}     -> crea el pago en Stripe y devuelve la dirección para pagar
//                              (solo staff de ese club, con su sesión iniciada)
const { SUPABASE_URL, PLANES, rest, stripe, cabeceras, plazasFundadorLibres } = require('./_pagos')

module.exports = async (req, res) => {
  if (!process.env.SUPABASE_SECRET_KEY) return res.status(500).json({ ok: false, error: 'Falta SUPABASE_SECRET_KEY en Vercel' })

  if (req.method === 'GET') {
    const libres = await plazasFundadorLibres()
    return res.status(200).json({
      ok: true,
      plan: libres > 0 ? 'fundador' : 'temporada',
      precio: (libres > 0 ? PLANES.fundador : PLANES.temporada).precio / 100,
      precioNormal: PLANES.temporada.precio / 100,
      plazasFundador: libres,
    })
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false })
  if (!process.env.STRIPE_SECRET_KEY) return res.status(500).json({ ok: false, error: 'Los pagos aún no están configurados (falta STRIPE_SECRET_KEY)' })

  // ¿Quién paga? Tiene que ser staff del club (o el superadmin)
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ ok: false, error: 'Inicia sesión para pagar' })
  const yo = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: cabeceras().apikey, Authorization: `Bearer ${token}` } })
  if (!yo.ok) return res.status(401).json({ ok: false, error: 'Sesión no válida, vuelve a entrar' })
  const usuario = await yo.json()

  let b = req.body
  if (typeof b === 'string') { try { b = JSON.parse(b) } catch { b = {} } }
  const slug = String(b?.club || '').toLowerCase()
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) return res.status(400).json({ ok: false, error: 'Club no válido' })

  const c = await rest(`/rest/v1/clubes?select=id,slug,nombre,contacto_email&slug=eq.${slug}`)
  const club = c.datos?.[0]
  if (!club) return res.status(404).json({ ok: false, error: 'Club no encontrado' })

  const st = await rest(`/rest/v1/staff?select=user_id&user_id=eq.${usuario.id}&club_id=eq.${club.id}`)
  const sa = await rest(`/rest/v1/superadmins?select=user_id&user_id=eq.${usuario.id}`)
  if (!st.datos?.length && !sa.datos?.length) return res.status(403).json({ ok: false, error: 'Solo el staff del club puede pagar' })

  const plan = (await plazasFundadorLibres()) > 0 ? 'fundador' : 'temporada'
  const origen = req.headers['x-forwarded-host'] ? `https://${req.headers['x-forwarded-host']}` : 'https://www.miequipoaldia.com'

  const sesion = await stripe('/checkout/sessions', 'POST', {
    mode: 'payment',
    locale: 'es',
    customer_email: usuario.email || club.contacto_email || undefined,
    line_items: {
      0: {
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: PLANES[plan].precio,
          product_data: { name: `Mi Equipo Al Día · ${PLANES[plan].nombre}`, description: `${club.nombre} · hasta el 30 de junio` },
        },
      },
    },
    metadata: { club_id: club.id, slug: club.slug, plan },
    payment_intent_data: { metadata: { club_id: club.id, slug: club.slug, plan } },
    success_url: `${origen}/${club.slug}/?pago={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origen}/${club.slug}/?pago=cancelado`,
  })
  if (!sesion.ok) return res.status(500).json({ ok: false, error: sesion.datos?.error?.message || 'No se pudo crear el pago' })
  return res.status(200).json({ ok: true, url: sesion.datos.url })
}
