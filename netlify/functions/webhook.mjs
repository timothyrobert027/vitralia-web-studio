// POST /.netlify/functions/webhook  (endpoint da registrare in Stripe)
// Verifica la firma Stripe e conferma la prenotazione solo a pagamento riuscito.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { store, confirmBooking, json } from './_lib/core.mjs';
function verify(payload, header, secret) {
  const parts = Object.fromEntries((header || '').split(',').map((p) => p.split('=')));
  const t = Number(parts.t); if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const exp = createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
  return (header.match(/v1=([a-f0-9]+)/g) || []).some((v) => { const a = Buffer.from(v.slice(3)), b = Buffer.from(exp); return a.length === b.length && timingSafeEqual(a, b); });
}
export default async (req) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET; if (!secret) return json(500, { error: 'webhook non configurato' });
  const payload = await req.text();
  if (!verify(payload, req.headers.get('stripe-signature'), secret)) return json(400, { error: 'firma non valida' });
  const ev = JSON.parse(payload), session = ev.data?.object;
  if ((ev.type === 'checkout.session.completed' && session.payment_status === 'paid') || ev.type === 'checkout.session.async_payment_succeeded') {
    const r = await confirmBooking(session); if (!r.ok) console.error('booking', r.reason, session.id);
  } else if (ev.type === 'checkout.session.expired' || ev.type === 'checkout.session.async_payment_failed') {
    const slotId = session.metadata?.slotId, s = store();
    const hold = slotId && (await s.get(`hold/${slotId}`, { type: 'json' }));
    if (hold?.session === session.id) await s.delete(`hold/${slotId}`);
  }
  return json(200, { received: true });
};
