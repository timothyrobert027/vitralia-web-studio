// Logica condivisa lato server. Qui vivono prezzi e pianificazione AUTORITATIVI:
// il browser li mostra, ma non decide mai quanto si paga né se una postazione è libera.
import { getStore } from '@netlify/blobs';
import { readFileSync } from 'node:fs';

const here = new URL('.', import.meta.url);
export const catalog = JSON.parse(readFileSync(new URL('../../../data/config.json', here), 'utf8'));
export const HOLD_MIN = 30; // minuti di riserva temporanea durante il pagamento (minimo consentito da Stripe Checkout)

export const store = () => getStore({ name: 'vitralia-bookings', consistency: 'strong' });
export const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
export const depositOf = (pkg) => Math.round((pkg.price * catalog.depositPercent) / 100);

export function findSlot(dept, slotId) {
  const list = catalog.slots?.[dept] || [];
  return list.find((s) => s.id === slotId) || null;
}

// stato reale di una postazione: pianificazione dello studio + prenotazioni pagate + riserve attive
export async function slotState(dept, slotId) {
  const base = findSlot(dept, slotId);
  if (!base) return { status: 'missing' };
  if (base.status !== 'free') return { status: 'occupied' };
  const s = store();
  if (await s.get(`booking/${slotId}`)) return { status: 'occupied' };
  const hold = await s.getWithMetadata(`hold/${slotId}`, { type: 'json' });
  if (hold?.data && hold.data.expires > Date.now()) return { status: 'held', hold };
  return { status: 'free', hold };
}

export async function stripe(path, { method = 'GET', form } = {}) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY non configurata');
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method, headers: { authorization: `Bearer ${key}`, ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || `Stripe ${r.status}`);
  return j;
}

// registra la prenotazione pagata (idempotente: webhook e pagina di ritorno possono arrivare in qualsiasi ordine)
export async function confirmBooking(session) {
  const { dept, slotId } = session.metadata || {};
  if (!dept || !slotId) return { ok: false, reason: 'metadata' };
  const s = store();
  const rec = { session: session.id, dept, slotId, amount: session.amount_total, currency: session.currency, email: session.customer_details?.email || null, paidAt: Date.now() };
  const res = await s.setJSON(`booking/${slotId}`, rec, { onlyIfNew: true });
  if (!res.modified) {
    const cur = await s.get(`booking/${slotId}`, { type: 'json' });
    if (cur?.session !== session.id) {
      // due pagamenti sulla stessa postazione: non dovrebbe succedere grazie alla riserva, ma se succede va gestito a mano (rimborso)
      await s.setJSON(`conflict/${session.id}`, rec);
      return { ok: false, reason: 'conflict' };
    }
  }
  await s.delete(`hold/${slotId}`);
  return { ok: true };
}
