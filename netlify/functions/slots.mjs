// GET /.netlify/functions/slots -> disponibilità reale delle postazioni
import { catalog, slotState, json } from './_lib/core.mjs';
export default async () => {
  const out = {};
  for (const [dept, list] of Object.entries(catalog.slots)) {
    out[dept] = [];
    for (const s of list) {
      const st = s.status === 'free' ? (await slotState(dept, s.id)).status : 'occupied';
      out[dept].push({ id: s.id, status: st === 'free' ? 'free' : 'occupied', ...(st === 'free' ? { start: s.start, online: s.online } : {}) });
    }
  }
  return json(200, { slots: out });
};
