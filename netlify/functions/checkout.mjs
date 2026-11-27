// POST /.netlify/functions/checkout {dept, slotId}
// 1) ricontrolla la disponibilità  2) riserva la postazione (scrittura atomica)  3) crea la sessione Stripe Checkout
import { catalog, slotState, store, json, depositOf, stripe, HOLD_MIN } from './_lib/core.mjs';
export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Metodo non consentito' });
  if (catalog.mode !== 'live') return json(403, { error: 'Pagamenti non attivi (modalità demo).' });
  let body; try { body = await req.json(); } catch { return json(400, { error: 'Richiesta non valida' }); }
  const { dept, slotId } = body || {};
  const known = new Set((catalog.features || []).map((f) => f.id));
  const features = (Array.isArray(body?.features) ? body.features : []).filter((f) => known.has(f)).join(',').slice(0, 450);
  const sector = typeof body?.sector === 'string' ? body.sector.slice(0, 100) : '';
  const pkg = catalog.packages[dept];
  if (!pkg || pkg.price == null) return json(400, { error: 'Questo reparto non prevede pagamento online.' });
  const st = await slotState(dept, slotId);
  if (st.status !== 'free') return json(409, { error: 'Questa postazione non è più disponibile. Scegline un’altra.' });

  const s = store(), expires = Date.now() + HOLD_MIN * 60 * 1000, hold = { dept, slotId, expires, session: null };
  // riserva atomica: se due visitatori pagano insieme, solo uno ottiene la postazione
  const w = st.hold?.etag ? await s.setJSON(`hold/${slotId}`, hold, { onlyIfMatch: st.hold.etag }) : await s.setJSON(`hold/${slotId}`, hold, { onlyIfNew: true });
  if (!w.modified) return json(409, { error: 'Qualcuno sta prenotando questa postazione proprio ora. Scegline un’altra.' });

  const site = process.env.SITE_URL || new URL(req.url).origin, dep = depositOf(pkg);
  try {
    const session = await stripe('checkout/sessions', { method: 'POST', form: {
      mode: 'payment', locale: 'it',
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': catalog.currency.toLowerCase(),
      'line_items[0][price_data][unit_amount]': String(dep * 100),
      'line_items[0][price_data][product_data][name]': `Acconto ${catalog.depositPercent}% · ${pkg.name} · postazione ${slotId}`,
      'metadata[dept]': dept, 'metadata[slotId]': slotId, 'metadata[features]': features, 'metadata[sector]': sector,
      'payment_intent_data[metadata][dept]': dept, 'payment_intent_data[metadata][slotId]': slotId,
      expires_at: String(Math.floor(expires / 1000)),
      success_url: `${site}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/?canceled=1`,
    } });
    await s.setJSON(`hold/${slotId}`, { ...hold, session: session.id });
    return json(200, { url: session.url });
  } catch (e) {
    await s.delete(`hold/${slotId}`);
    console.error('checkout', e.message);
    return json(502, { error: 'Pagamento non disponibile in questo momento.' });
  }
};
