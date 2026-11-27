# Vitralia Web Studio: sito 3D

Un solo mondo three.js (r160, moduli ES, nessuna build): la V del logo nello spazio, il tunnel, The Website Lab sulla Luna, i reparti, le postazioni, la carta d'imbarco, il pagamento, il lancio e l'orbita.

## Struttura

| File | Cosa contiene |
|---|---|
| `index.html`, `css/style.css` | Interfaccia HTML minimale: barra delle scelte, carta d'imbarco, pagamento, finale |
| `js/app.js` | Gestore di stato, scene, camera, scelte, pagamento, lancio e orbita |
| `js/vgeometry.js` | La V ricostruita dalle coordinate del logo originale: logo 3D, strati, tunnel |
| `js/world.js` | Spazio, Terra, Luna, laboratorio circolare, postazioni, schede, razzo |
| `js/camera.js` | Camera unica su curve Catmull-Rom |
| `js/audio.js` | Audio sintetizzato, spento di default |
| `data/config.json` | Prezzi, acconto, postazioni e date. **Le postazioni attuali sono dimostrative** |
| `netlify/functions/*` | Backend: disponibilità, riserva, Stripe Checkout, webhook, verifica ordine |

Stati: `INITIAL → INTRO → PORTAL → LAB_EXTERIOR → FEATURE_SELECTION → PREVIEW_FLIGHT → DEPARTMENT_INTERIOR → WORKSTATION_SELECTION → BOARDING_PASS → PAYMENT → LAUNCH → ORBIT`.

Il viaggio completo arriva prima dell'acquisto. Il sito assemblato decolla (`PREVIEW_FLIGHT`, testo "Il tuo sito è pronto per l'orbita."), poi in orbita compaiono la proposta e il modulo di contatto. Infine si torna al laboratorio per reparto, postazione e pagamento. Dopo un pagamento confermato il lancio si ripete con il testo "Il tuo sito è in orbita.".
Il passaggio a `LAUNCH` viene rifiutato se il pagamento non è confermato. L'unica eccezione è l'anteprima demo, chiaramente etichettata.

## Modalità demo e produzione

- `"mode": "demo"` (attuale): nessun pagamento. Il pulsante dice "Guarda il lancio (demo)" e il finale dice "nessun ordine è stato creato".
- `"mode": "live"`: il sito legge le postazioni da `/.netlify/functions/slots`. Il pagamento passa da Stripe Checkout e il lancio parte solo quando `/order` conferma `payment_status = paid`.

## Cosa configurare per i pagamenti reali

1. **Deploy con le funzioni.** Collega la cartella a un repository Git su Netlify, oppure usa `netlify deploy --prod`. Il caricamento zip usato finora pubblica solo la parte statica, senza funzioni.
2. In Netlify, in Site configuration → Environment variables:
   - `STRIPE_SECRET_KEY`: chiave segreta `sk_live_…` (`sk_test_…` per provare)
   - `STRIPE_WEBHOOK_SECRET`: `whsec_…` del punto 3
   - `SITE_URL`: ad es. `https://vitralia-web-studio.netlify.app`
   Nessuna chiave va mai nel frontend né in `config.json`.
3. In Stripe, in Developers → Webhooks, aggiungi l'endpoint `https://<sito>/.netlify/functions/webhook` con gli eventi:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
4. In Stripe, in Settings → Payment methods, attiva **TWINT** (richiede valuta CHF e un account svizzero) oltre alle carte. Checkout mostra automaticamente i metodi attivi.
5. In `data/config.json` imposta `"mode": "live"`, sostituisci le postazioni con quelle reali e, se vuoi, aggiungi `contactEmail` per i progetti su misura.

## Protezione dalla doppia prenotazione

- `checkout` ricontrolla la postazione lato server. Poi crea una **riserva di 30 minuti** con una scrittura atomica su Netlify Blobs (`onlyIfNew` / `onlyIfMatch`). Due visitatori non possono riservare la stessa postazione nello stesso momento.
- Il prezzo dell'acconto è calcolato **sul server** a partire da `config.json`. Il browser non lo invia.
- Il webhook verifica la firma Stripe e registra la prenotazione. `order` fa lo stesso se il visitatore torna prima del webhook: l'operazione è idempotente.
- Una riserva scaduta (sessione Stripe scaduta) libera la postazione.
- Un eventuale doppio pagamento viene salvato in `conflict/…` e va gestito a mano con un rimborso.

## Prova in locale

`python3 -m http.server` nella cartella apre la versione demo. Per le funzioni serve `netlify dev`.

## Crediti delle immagini

- `assets/earth/day*.jpg`: NASA Blue Marble (pubblico dominio), dal pacchetto npm `three-globe`.
- `assets/earth/night*.jpg`: NASA Earth at Night (pubblico dominio), dal pacchetto npm `three-globe`.
- `js/vendor/`: three.js r160 (licenza MIT).

## Anteprima del lancio

In modalità demo, `/?scena=lancio` porta subito al decollo: serve per test e presentazioni.

## Configuratore (prima dei reparti)

Il configuratore è un giro per le **sale** del laboratorio (`js/rooms.js`). Ogni reparto ha una postazione di vetro dove si prepara un pezzo del sito:
- Fondamenta (Start)
- Visibilità (Business)
- Espansione (Premium)
- Su misura

Quando il cliente accende una funzionalità, il pezzo parte da una scrivania della sala e vola al suo posto. Nel finale tutti i pezzi scelti volano nell'atrio e compongono il sito. La sala di ogni funzionalità è il suo `pkg`: se cambi il pacchetto di una funzionalità, cambia anche la sala.

Nell'atrio del laboratorio il cliente indica settore e nome dell'attività, accende le funzionalità che gli servono e vede un'anteprima del suo sito che prende forma. Il pacchetto consigliato è il più basso che include tutte le funzionalità scelte (`js/configurator.js`).

- **Funzionalità e pacchetti:** in `data/config.json` → `features` (campo `pkg`). **È una bozza da confermare** (`featuresDraft: true`, mostra la nota "Elenco funzionalità in bozza").
- **Dati del cliente:** inviati con Netlify Forms, modulo `configuratore` (settore, attività, nome, email, telefono, note, funzionalità, pacchetto). Li trovi in Netlify, alla voce Forms. Per riceverli via email: Forms → Form notifications → Add notification → Email notification.
- Il rilevamento dei moduli deve essere attivo (Forms → Form detection → Enable).
- Con i pagamenti attivi, funzionalità e settore viaggiano anche nei metadati della sessione Stripe. Il prezzo resta calcolato sul server.
- Manca un'informativa sulla privacy da collegare al consenso.
