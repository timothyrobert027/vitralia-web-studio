// GET /.netlify/functions/order?session_id=… -> il sito avvia il lancio SOLO se Stripe dice "paid"
import { stripe, confirmBooking, json } from './_lib/core.mjs';
export default async (req) => {
  const id = new URL(req.url).searchParams.get('session_id');
  if (!id || !/^cs_[A-Za-z0-9_]+$/.test(id)) return json(400, { paid: false });
  try {
    const session = await stripe(`checkout/sessions/${id}`);
    const paid = session.payment_status === 'paid';
    if (paid) await confirmBooking(session);
    return json(200, { paid, dept: session.metadata?.dept, slotId: session.metadata?.slotId });
  } catch (e) { console.error('order', e.message); return json(502, { paid: false }); }
};
