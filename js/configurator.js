// Il configuratore: il cliente sceglie cosa gli serve, vede il suo sito prendere forma
// e riceve il pacchetto consigliato (il più basso che include tutte le funzionalità scelte).
const RANK = { start: 0, business: 1, premium: 2, custom: 3 };
const KEYS = ['start', 'business', 'premium', 'custom'];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// testi della pagina d'esempio per settore (solo per l'anteprima)
const HERO = {
  'Ristorante / bar': ['Il gusto che ti aspetta', 'Prenota un tavolo'],
  Negozio: ['Le novità sono arrivate', 'Scopri i prodotti'],
  'Studio / professionista': ['Competenza al tuo servizio', 'Fissa un appuntamento'],
  'Hotel / turismo': ['Il tuo soggiorno inizia qui', 'Verifica disponibilità'],
  'Salute / benessere': ['Prenditi cura di te', 'Prenota un trattamento'],
  'Artigiano / servizi': ['Lavori fatti a regola d\'arte', 'Richiedi un preventivo'],
  Altro: ['Benvenuti', 'Scopri di più'],
};
const ICON = {
  pages: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  contact: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  map: '<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>',
  whatsapp: '<path d="M5 19l1.2-3.6A7.5 7.5 0 1 1 9 18.6z"/><path d="M9.5 9.5c.3 1.8 1.5 3.3 3.2 4.1l1.1-1 1.7.8-.4 1.5c-3 .3-6.4-2.8-6.6-5.8l1.5-.5.7 1.7z"/>',
  blog: '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>',
  booking: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4M9 14l2 2 4-4"/>',
  seo: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  gallery: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M3 17l5-4 4 3 3-2 6 4"/>',
  langs: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.5 2.5 14.5 0 17M12 3.5c-2.5 2.5-2.5 14.5 0 17"/>',
  shop: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  payments: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',
  login: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-4 3-6 7-6s7 2 7 6"/>',
  integrations: '<rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="14" y="13" width="7" height="7" rx="1.5"/><path d="M10 7.5h4a3 3 0 0 1 3 3V13"/>',
  customfx: '<path d="M12 3l2.2 5.2L20 9l-4.3 3.8L17 19l-5-3-5 3 1.3-6.2L4 9l5.8-.8z"/>',
  app: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
};
const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k] || ICON.pages}</svg>`;

export function configurator({ cfg, slots, slotsAreDemo, onGo, onSkip, onRecommend, fmt }) {
  const root = document.querySelector('#cfg');
  const F = cfg.features || [], P = cfg.packages;
  const st = { step: 0, sector: '', business: '', on: new Set(['pages', 'contact']), sent: false };
  const freeCount = (k) => (slots[k] || []).filter((s) => s.status === 'free').length;

  const recommend = () => { let r = 0; for (const id of st.on) { const f = F.find((x) => x.id === id); if (f) r = Math.max(r, RANK[f.pkg] ?? 0); } return KEYS[r]; };
  const needs = (k) => F.filter((f) => st.on.has(f.id) && f.pkg === k).map((f) => f.label);

  // ---------- anteprima del sito del cliente ----------
  function preview() {
    const on = (id) => st.on.has(id), name = esc(st.business || 'La tua attività'), [h1, cta] = HERO[st.sector] || HERO.Altro;
    const nav = ['Home', 'Chi siamo', on('shop') && 'Shop', on('booking') && 'Prenota', on('blog') && 'Novità', on('gallery') && 'Galleria', on('contact') && 'Contatti'].filter(Boolean);
    return `
      ${on('seo') ? `<div class="pv-google"><span>Google</span><b>${name} · ${esc(st.sector || 'la tua città')}</b><i>${name.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'tuosito'}.ch</i></div>` : ''}
      <div class="pv-win">
        <div class="pv-bar"><i></i><i></i><i></i><span>${name.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'tuosito'}.ch</span></div>
        <div class="pv-page">
          <header class="pv-head"><b>${name}</b><nav>${nav.map((n) => `<span>${n}</span>`).join('')}</nav>
            ${on('langs') ? '<span class="pv-lang">IT · DE · FR · EN</span>' : ''}${on('login') ? '<span class="pv-login">Accedi</span>' : ''}${on('shop') ? '<span class="pv-cart">🛒 2</span>' : ''}</header>
          <section class="pv-hero"><h3>${esc(h1)}</h3><span class="pv-btn">${esc(on('booking') ? cta : on('shop') ? 'Vai allo shop' : 'Contattaci')}</span></section>
          ${on('booking') ? `<section class="pv-blk pv-cal"><b>Prenota online</b><div>${Array.from({ length: 14 }, (_, i) => `<span class="${[3, 6, 9].includes(i) ? 'free' : ''}">${i + 1}</span>`).join('')}</div></section>` : ''}
          ${on('shop') ? `<section class="pv-blk pv-shop"><b>Shop</b><div>${[1, 2, 3].map(() => `<span><i></i>CHF —${on('payments') ? '<em>Acquista</em>' : ''}</span>`).join('')}</div>${on('payments') ? '<small>Carta · TWINT</small>' : ''}</section>` : ''}
          ${on('gallery') ? '<section class="pv-blk pv-gal"><b>Galleria</b><div><i></i><i></i><i></i><i></i></div></section>' : ''}
          ${on('blog') ? '<section class="pv-blk pv-blog"><b>Novità</b><div><span></span><span></span></div></section>' : ''}
          ${on('customfx') ? '<section class="pv-blk pv-fx"><b>✦ La tua funzione su misura</b></section>' : ''}
          ${on('map') || on('contact') ? `<section class="pv-blk pv-foot">${on('map') ? '<div class="pv-map"><i></i></div>' : ''}${on('contact') ? '<div class="pv-form"><span></span><span></span><em>Invia</em></div>' : ''}</section>` : ''}
          ${on('integrations') ? '<div class="pv-sync">⟳ sincronizzato con il tuo gestionale</div>' : ''}
        </div>
        ${on('whatsapp') ? '<span class="pv-wa">WhatsApp</span>' : ''}
      </div>
      ${on('app') ? `<div class="pv-phone"><div><b>${name}</b><span></span><span></span></div></div>` : ''}`;
  }

  // ---------- passi ----------
  function render() {
    const rec = recommend(), p = P[rec], free = freeCount(rec);
    const steps = ['La tua attività', 'Il tuo sito', 'La tua proposta'];
    let body = '';
    if (st.step === 0) {
      body = `<h2>Che attività hai?</h2><p class="cfg-sub">Costruiamo insieme l'anteprima del tuo sito.</p>
        <div class="chips">${cfg.sectors.map((s) => `<button type="button" class="chip${st.sector === s ? ' on' : ''}" data-sector="${esc(s)}">${esc(s)}</button>`).join('')}</div>
        <label class="fld"><span>Nome dell'attività</span><input id="cfgBiz" type="text" maxlength="60" autocomplete="organization" placeholder="Es. Caffè Lago" value="${esc(st.business)}"></label>
        <div class="cfg-acts"><button class="btn" type="button" data-go="1" ${st.sector ? '' : 'disabled'}><span class="t"><span>Avanti</span></span></button></div>`;
    } else if (st.step === 1) {
      body = `<h2>Cosa deve fare il tuo sito?</h2><p class="cfg-sub">Accendi le funzioni: il tuo sito prende forma qui accanto.</p>
        <div class="feats">${F.map((f) => `<button type="button" class="feat${st.on.has(f.id) ? ' on' : ''}" data-f="${f.id}" aria-pressed="${st.on.has(f.id)}">${svg(f.id)}<span><b>${esc(f.label)}</b><small>${esc(f.sub)}</small></span><em class="tag-${f.pkg}">${esc(P[f.pkg].name)}</em></button>`).join('')}</div>
        <div class="rec">
          <div><small>Pacchetto consigliato</small><b>${esc(p.name)} <span>${esc(p.priceLabel)}</span></b>
            <small class="why">${rec === 'start' ? 'Tutto quello che hai scelto è incluso.' : `Per ${esc(needs(rec).join(', '))}`}</small>
            ${rec !== 'custom' ? `<small class="avail">${free ? `${free} ${free === 1 ? 'postazione libera' : 'postazioni libere'} in questo reparto${slotsAreDemo ? ' (dati dimostrativi)' : ''}` : 'Nessuna postazione libera al momento'}</small>` : ''}</div>
          <button class="btn" type="button" data-go="2"><span class="t"><span>${rec === 'start' ? 'Continua' : `Scegli ${esc(p.name)}`}</span><small>${rec === 'start' ? 'Ricevi la tua proposta' : 'Il pacchetto giusto per quello che vuoi'}</small></span></button>
        </div>
        ${cfg.featuresDraft ? '<p class="draft">Elenco funzionalità in bozza.</p>' : ''}`;
    } else {
      body = st.sent
        ? `<h2>Grazie${st.name ? ', ' + esc(st.name.split(' ')[0]) : ''}.</h2><p class="cfg-sub">Abbiamo ricevuto la tua richiesta. Ora scegli la tua postazione nel reparto ${esc(p.name)}.</p>
           <div class="cfg-acts"><button class="btn" type="button" data-dept="${rec}"><span class="t"><span>Vai al reparto ${esc(p.name)}</span></span></button></div>`
        : `<h2>Ricevi la tua proposta</h2><p class="cfg-sub">Ti scriviamo con la proposta per <b>${esc(st.business || 'la tua attività')}</b>: pacchetto ${esc(p.name)}, ${st.on.size} funzionalità.</p>
        <form id="cfgForm" class="form" novalidate>
          <label class="fld"><span>Nome e cognome</span><input name="name" required autocomplete="name" maxlength="80"></label>
          <label class="fld"><span>Email</span><input name="email" type="email" required autocomplete="email" maxlength="120"></label>
          <label class="fld"><span>Telefono <i>(facoltativo)</i></span><input name="phone" type="tel" autocomplete="tel" maxlength="40"></label>
          <label class="fld"><span>Qualcosa da aggiungere? <i>(facoltativo)</i></span><textarea name="notes" rows="2" maxlength="800"></textarea></label>
          <label class="ok"><input type="checkbox" name="consent" required> <span>Acconsento a essere ricontattato da Vitralia Web Studio per questa richiesta.</span></label>
          <p class="err" id="cfgErr" role="alert"></p>
          <div class="cfg-acts"><button class="btn" type="submit"><span class="t"><span>Invia e vai al reparto ${esc(p.name)}</span><small>Poi scegli la tua postazione</small></span></button></div>
          <button class="lnk" type="button" data-dept="${rec}">Continua senza inviare</button>
        </form>`;
    }
    root.querySelector('.cfg-steps').innerHTML = steps.map((s, i) => `<span class="${i === st.step ? 'on' : i < st.step ? 'done' : ''}">${i + 1}. ${s}</span>`).join('');
    root.querySelector('.cfg-body').innerHTML = body;
    root.querySelector('.cfg-preview').innerHTML = preview();
    onRecommend(st.step >= 1 ? rec : null);
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.sector) { st.sector = b.dataset.sector; render(); return; }
    if (b.dataset.f) { const id = b.dataset.f; st.on.has(id) ? st.on.delete(id) : st.on.add(id); render(); root.querySelector(`[data-f="${id}"]`)?.focus({ preventScroll: true }); return; }
    if (b.dataset.go) { st.step = +b.dataset.go; render(); root.querySelector('.cfg-body h2')?.focus?.(); root.querySelector('.cfg-scroll').scrollTop = 0; return; }
    if (b.dataset.dept) { onGo(b.dataset.dept, summary()); return; }
    if (b.dataset.skip !== undefined) { onSkip(); }
  });
  root.addEventListener('input', (e) => { if (e.target.id === 'cfgBiz') { st.business = e.target.value; root.querySelector('.cfg-preview').innerHTML = preview(); } });
  root.addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target, err = root.querySelector('#cfgErr');
    if (!f.reportValidity()) return;
    const btn = f.querySelector('[type=submit]'); btn.disabled = true; err.textContent = '';
    const data = { 'form-name': 'configuratore', sector: st.sector, business: st.business, name: f.name.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim(), notes: f.notes.value.trim(),
      features: [...st.on].map((id) => F.find((x) => x.id === id)?.label).join(', '), package: P[recommend()].name, consent: 'sì', 'bot-field': '' };
    try {
      const r = await fetch('/', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data).toString() });
      if (!r.ok) throw new Error(r.status);
      st.sent = true; st.name = data.name; render();
    } catch {
      btn.disabled = false; err.textContent = 'Invio non riuscito. Riprova tra poco, oppure continua senza inviare.';
    }
  });

  const summary = () => ({ sector: st.sector, business: st.business, features: [...st.on], recommended: recommend(), sent: st.sent });
  return {
    open() { root.hidden = false; render(); requestAnimationFrame(() => root.classList.add('on')); },
    close() { root.classList.remove('on'); root.hidden = true; onRecommend(null); },
    summary,
  };
}
