// Vitralia Web Studio: un solo mondo, una sola camera, un solo viaggio.
import * as THREE from 'three';
import { EffectComposer } from './vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/jsm/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from './vendor/jsm/geometries/RoundedBoxGeometry.js';
import { PALETTE, C } from './palette.js';
import { buildV, buildTunnel } from './vgeometry.js';
import { LAB, EARTH, SUN_DIR, R_LAB, DEPTS, canvasTex, siteScreen, makeEnvironment, makeMaterials, buildSpace, buildMoon, buildLab, buildCards, buildRocket } from './world.js';
import { CameraRig } from './camera.js';
import { Sound } from './audio.js';
import { configurator } from './configurator.js';

const $ = (s) => document.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const rad = (d) => (d * Math.PI) / 180;
const polar = (r, deg, y = 0) => new THREE.Vector3(r * Math.cos(rad(deg)), y, r * Math.sin(rad(deg)));
const L = (x, y, z) => new THREE.Vector3(x, y, z).add(LAB);           // coordinate del laboratorio -> mondo
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;

// ================= stato centralizzato =================
// Ogni passaggio di scena passa da qui. Il lancio è bloccato se il pagamento non è confermato
// (o se il visitatore sta guardando esplicitamente l'anteprima dimostrativa).
const FLOW = {
  INITIAL: ['INTRO', 'LAUNCH'],
  INTRO: ['PORTAL', 'LAB_EXTERIOR'],
  PORTAL: ['LAB_EXTERIOR'],
  LAB_EXTERIOR: ['FEATURE_SELECTION', 'DEPARTMENT_SELECTION'],
  FEATURE_SELECTION: ['DEPARTMENT_SELECTION', 'DEPARTMENT_INTERIOR'],
  DEPARTMENT_SELECTION: ['DEPARTMENT_INTERIOR', 'FEATURE_SELECTION'],
  DEPARTMENT_INTERIOR: ['WORKSTATION_SELECTION', 'DEPARTMENT_SELECTION'],
  WORKSTATION_SELECTION: ['BOARDING_PASS', 'DEPARTMENT_SELECTION', 'DEPARTMENT_INTERIOR'],
  BOARDING_PASS: ['PAYMENT', 'WORKSTATION_SELECTION', 'DEPARTMENT_INTERIOR'],
  PAYMENT: ['BOARDING_PASS', 'LAUNCH'],
  LAUNCH: ['ORBIT'],
  ORBIT: [],
};
const store = {
  state: 'INITIAL', ctx: { dept: null, slot: null, paid: false, demoPreview: false }, subs: [],
  go(next, patch = {}) {
    if (!FLOW[this.state].includes(next)) { console.warn(`[stato] ${this.state} -> ${next} non consentito`); return false; }
    const ctx = { ...this.ctx, ...patch };
    if (next === 'LAUNCH' && !(ctx.paid || ctx.demoPreview)) { console.warn('[stato] lancio bloccato: pagamento non confermato'); return false; }
    const prev = this.state; this.state = next; this.ctx = ctx; document.documentElement.dataset.state = next;
    for (const f of this.subs) f(next, prev, ctx);
    return true;
  },
  on(f) { this.subs.push(f); },
};
window.vitralia = { store };
 // utile per i test

// ================= dati =================
const cfg = await fetch('data/config.json', { cache: 'no-store' }).then((r) => r.json());
const live = cfg.mode === 'live';
let slots = cfg.slots, slotsAreDemo = cfg.slotsAreDemo !== false, bookingOff = false;
if (live) {
  try { const r = await fetch(`${cfg.api}/slots`, { cache: 'no-store' }); if (!r.ok) throw 0; slots = (await r.json()).slots; slotsAreDemo = false; }
  catch { bookingOff = true; } // il backend non risponde: si può visitare tutto, ma non prenotare
}
const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
for (const p of Object.values(cfg.packages)) p.priceLabel = p.price == null ? 'Su richiesta' : `${p.from ? 'Da ' : ''}CHF ${fmt(p.price)}`;
const deposit = (p) => (p.price == null ? null : Math.round((p.price * cfg.depositPercent) / 100));
const dfmt = new Intl.DateTimeFormat('it-CH', { day: 'numeric', month: 'short', year: 'numeric' });
const date = (s) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? dfmt.format(new Date(s + 'T12:00:00')) : s || '—');

// ================= renderer =================
const canvas = $('#gl');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
  if (!renderer.getContext()) throw 0;
} catch {
  $('#loading').hidden = true; $('#nogl').hidden = false; throw new Error('WebGL non disponibile');
}
let dpr = Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2);
renderer.setPixelRatio(dpr);
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = !mobile; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); $('#nogl').hidden = false; });

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.night);
scene.environment = makeEnvironment(renderer);
scene.fog = new THREE.FogExp2(PALETTE.night, 0.0009); // la superficie lunare sfuma nel buio verso l'orizzonte
const cam = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.08, 12000);
scene.add(cam);
const rig = new CameraRig(cam);
// in verticale si allarga il campo per tenere la stessa inquadratura orizzontale
const adj = (f) => { const a = innerWidth / innerHeight; if (a >= 1.2) return f; return Math.min(74, (2 * Math.atan((Math.tan(rad(f) / 2) * 1.45) / a) * 180) / Math.PI); };
const P = (p, t, fov) => ({ p: p.clone ? p.clone() : new THREE.Vector3(...p), t: t.clone ? t.clone() : new THREE.Vector3(...t), fov: adj(fov) });

let composer = null, bloom = null;
function makeComposer() {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, cam));
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), mobile ? 0.45 : 0.6, 0.55, 0.86);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}
makeComposer();

// ================= luci =================
scene.add(new THREE.HemisphereLight(0x8fa8ff, 0x0d1018, 0.22));
const sun = new THREE.DirectionalLight(0xdfe7ff, 1.6);
sun.position.copy(LAB).addScaledVector(SUN_DIR, 120); sun.target.position.copy(LAB); scene.add(sun, sun.target);
if (!mobile) { sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 300 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; }

// ================= mondo =================
const mats = makeMaterials(mobile);
const space = buildSpace(scene, mobile);
const moon = buildMoon(scene, mats, mobile);
const lab = buildLab(scene, mats, { slots }, mobile);
if (!mobile) Object.assign(mats.cardGlass, { color: new THREE.Color(0xd8fff8), attenuationColor: new THREE.Color(0x3aa7b4), attenuationDistance: 1.4, thickness: 0.5, roughness: 0.22, emissive: new THREE.Color(0x0c3a44), emissiveIntensity: 0.6 });
else Object.assign(mats.cardGlass, { color: new THREE.Color(0x1a2c52), opacity: 0.7 });
const cards = buildCards(lab.lab, mats, cfg.packages);
const rk = buildRocket(lab.lab, mats, mobile);

// La V: a 20 unità gli strati in profondità si sommano e ricompongono esattamente il logo.
const V_DEPTH = 20, ANCHOR_Y = -(1271 - 1150) / 154.4; // asse di convergenza degli strati (vgeometry.js)
const V = buildV({ glass: mats.heroGlass, depth: V_DEPTH, tunnel: 0, edgeR: 0.05 });
scene.add(V);
// wordmark di vetro sotto la V
const word = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 1.25), new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false, depthWrite: false, map: canvasTex(2048, 305, (c, w, h) => {
  c.textAlign = 'center';
  const g = c.createLinearGradient(w * 0.18, 0, w * 0.82, 0); g.addColorStop(0, '#6f98ff'); g.addColorStop(0.5, '#7fc4ee'); g.addColorStop(1, '#5fe0cf');
  c.font = '300 150px Montserrat, sans-serif'; c.letterSpacing = '62px';
  c.shadowColor = 'rgba(80,170,255,.55)'; c.shadowBlur = 30; c.fillStyle = g; c.fillText('VITRALIA', w / 2 + 31, 160);
  c.shadowBlur = 0; c.globalCompositeOperation = 'source-atop';
  const hl = c.createLinearGradient(0, 40, 0, 170); hl.addColorStop(0, 'rgba(255,255,255,.75)'); hl.addColorStop(0.45, 'rgba(255,255,255,0)'); c.fillStyle = hl; c.fillRect(0, 0, w, 175);
  c.globalCompositeOperation = 'source-over'; c.font = '400 52px Montserrat, sans-serif'; c.letterSpacing = '40px'; c.fillStyle = 'rgba(225,236,255,.85)'; c.fillText('WEB STUDIO', w / 2 + 20, 265);
}) }));
word.position.set(0, -5.55, 0.4); scene.add(word);

// Il percorso: dal fronte della V, lungo l'asse di convergenza, dentro il centro scuro, giù nel tunnel fino sopra il laboratorio.
const OVER = P(L(0, 30, 64), L(0, 3, -2), 44);
const route = [[0, ANCHOR_Y, V_DEPTH], [0, ANCHOR_Y, 0], [0, ANCHOR_Y, -66], [0, -4, -140], [0, -30, -250], [0, -115, -400], [0, -240, -555], [0, -326, -690], [0, -360, -790], [OVER.p.x, OVER.p.y, OVER.p.z]].map((a) => new THREE.Vector3(...a));
const journey = new THREE.CatmullRomCurve3(route, false, 'centripetal');
const lift = new THREE.Vector3(0, -ANCHOR_Y, 0); // il tunnel ha l'origine delle cornici sopra l'asse, come gli strati della V
const tunCurve = new THREE.CatmullRomCurve3(route.map((p) => p.clone().add(lift)), false, 'centripetal');
const uAt = (test) => { for (let i = 0; i <= 2000; i++) { const u = i / 2000; if (test(journey.getPointAt(u))) return u; } return 1; };
const uT0 = uAt((p) => p.z < -68), uT1 = uAt((p) => p.y < -318);
const tunnel = buildTunnel(tunCurve, { count: Math.round((journey.getLength() * (uT1 - uT0)) / 9), from: uT0, to: uT1, edgeR: 0.07 });
scene.add(tunnel);

// Carta d'imbarco: lastra di vetro vero agganciata alla camera, dietro al testo HTML.
const passMat = mobile
  ? new THREE.MeshPhysicalMaterial({ color: 0x14223f, roughness: 0.25, transparent: true, opacity: 0.86, clearcoat: 1, envMapIntensity: 1.3, depthWrite: false })
  : new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 1, roughness: 0.36, thickness: 1.6, ior: 1.5, attenuationColor: new THREE.Color(0x24406e), attenuationDistance: 0.9, clearcoat: 0.4, clearcoatRoughness: 0.1, envMapIntensity: 1.1, specularIntensity: 0.25 });
const passSlab = new THREE.Mesh(new THREE.BufferGeometry(), passMat); passSlab.visible = false; passSlab.renderOrder = 10; cam.add(passSlab);
const PASS_D = 1.0;
function fitPass() {
  const r = $('#pass').getBoundingClientRect(); if (!r.width) return;
  const wpp = (2 * PASS_D * Math.tan(rad(cam.fov) / 2)) / innerHeight, w = r.width * wpp, h = r.height * wpp;
  passSlab.geometry.dispose(); passSlab.geometry = new RoundedBoxGeometry(w, h, 0.05, 5, 30 * wpp);
  passSlab.position.set((r.left + r.width / 2 - innerWidth / 2) * wpp, -(r.top + r.height / 2 - innerHeight / 2) * wpp, -PASS_D);
}

// Finale: il sito in orbita, la scia blu-verde acqua.
const panel = new THREE.Group(); panel.visible = false; scene.add(panel); window.vitralia.panel = panel; window.vitralia.cam = cam; window.vitralia.space = space; window.vitralia.scene = scene; window.vitralia.moon = moon;
{
  const glass = new THREE.Mesh(new RoundedBoxGeometry(16, 10.4, 0.5, 5, 0.9), mobile ? new THREE.MeshPhysicalMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.25, clearcoat: 1, envMapIntensity: 1.5, depthWrite: false }) : mats.heroGlass.clone());
  const face = new THREE.Mesh(new THREE.PlaneGeometry(14.6, 9.1), new THREE.MeshBasicMaterial({ map: siteScreen(PALETTE.azure, 'Il tuo sito'), toneMapped: false, transparent: true, opacity: 0.95 }));
  face.position.z = 0.27; panel.add(glass, face);
}
const trail = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  uniforms: { r: { value: 0 }, c1: { value: C.blue.clone().multiplyScalar(1.8) }, c2: { value: C.teal.clone().multiplyScalar(1.8) } },
  vertexShader: 'varying vec2 vUv;varying float vd;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);vd=-mv.z;gl_Position=projectionMatrix*mv;}',
  fragmentShader: 'uniform float r;uniform vec3 c1;uniform vec3 c2;varying vec2 vUv;varying float vd;void main(){float x=vUv.x;if(x>r)discard;float head=exp(-pow((r-x)*120.,2.))*1.5;float near=smoothstep(6.,45.,vd);gl_FragColor=vec4(mix(c1,c2,smoothstep(.1,1.,x))*(.7+head),near*(.25+.75*smoothstep(0.,.15,x))*(.75+head));}' }));
trail.visible = false; scene.add(trail);
const comet = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(256, 256, (c) => { const g = c.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.15, 'rgba(160,255,240,.7)'); g.addColorStop(0.5, 'rgba(63,224,204,.15)'); g.addColorStop(1, 'rgba(63,224,204,0)'); c.fillStyle = g; c.fillRect(0, 0, 256, 256); }), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
const dust = (() => {
  const n = mobile ? 500 : 1100, p = new Float32Array(n * 3); for (let i = 0; i < n * 3; i++) p[i] = Math.random() * 240;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { cam: { value: new THREE.Vector3() }, off: { value: 0 }, px: { value: Math.min(2, devicePixelRatio || 1) } },
    vertexShader: 'uniform vec3 cam;uniform float off;uniform float px;varying float a;void main(){vec3 q=mod(position-cam+vec3(0.,0.,off)+120.,240.)-120.;vec4 mv=viewMatrix*vec4(cam+q,1.);gl_Position=projectionMatrix*mv;float d=length(q);a=smoothstep(120.,30.,d)*smoothstep(2.,10.,d);gl_PointSize=px*(1.2+30./max(-mv.z,1.));}',
    fragmentShader: 'varying float a;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(vec3(.75,.88,1.),a*.55*(1.-d*2.));}' });
  const d = new THREE.Points(g, m); d.frustumCulled = false; d.visible = false; scene.add(d); return d;
})();
comet.visible = false; scene.add(comet);
space.orbit.material.color = new THREE.Color(PALETTE.teal).multiplyScalar(2.2);
space.orbit.visible = false;

// ================= interfaccia =================
const ui = { say: $('#say'), tag: $('#tag'), dock: $('#dock'), pass: $('#pass'), pay: $('#pay'), final: $('#final') };
let sayT = 0;
function say(t, ms = 0) { clearTimeout(sayT); ui.say.classList.remove('on'); if (!t) return; setTimeout(() => { ui.say.textContent = t; ui.say.classList.add('on'); }, 250); if (ms) sayT = setTimeout(() => ui.say.classList.remove('on'), ms); }
function dock(items) {
  ui.dock.innerHTML = ''; if (!items) { ui.dock.classList.remove('on'); return; }
  for (const it of items) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'opt' + (it.cls ? ' ' + it.cls : ''); b.innerHTML = it.html;
    if (it.label) b.setAttribute('aria-label', it.label);
    if (it.disabled) b.setAttribute('aria-disabled', 'true');
    b.addEventListener('click', () => { if (!it.disabled) it.on(); });
    if (it.hover) { for (const [ev, v] of [['pointerenter', true], ['pointerleave', false], ['focus', true], ['blur', false]]) b.addEventListener(ev, () => it.hover(v)); }
    ui.dock.append(b);
  }
  ui.dock.classList.add('on');
}
const sound = new Sound();
$('#sound').addEventListener('click', (e) => { const on = sound.toggle(); e.currentTarget.setAttribute('aria-pressed', on); e.currentTarget.textContent = on ? 'Audio on' : 'Audio'; });

// ================= scelta con il puntatore =================
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let picks = [], hovered = null;
function pickAt(e) {
  if (!picks.length || rig.busy) return null;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, cam);
  const hit = ray.intersectObjects(picks.map((p) => p.obj), false)[0];
  return hit ? picks.find((p) => p.obj === hit.object) : null;
}
canvas.addEventListener('pointermove', (e) => { if (e.pointerType === 'touch') return; const p = pickAt(e); if (p !== hovered) { hovered?.hover?.(false); hovered = p; p?.hover?.(true); } canvas.style.cursor = p && !p.disabled ? 'pointer' : ''; });
canvas.addEventListener('click', (e) => { const p = pickAt(e); if (p && !p.disabled) p.on(); else if (store.state === 'INTRO') enter(); });

const tagAt = (world, title, sub) => { ui.tag.querySelector('b').textContent = title; ui.tag.querySelector('span').textContent = sub || ''; ui.tag._w = world; ui.tag.style.opacity = world ? 1 : 0; };
function placeTag() {
  const w = ui.tag._w; if (!w) return; const v = w.clone().project(cam);
  if (v.z > 1) { ui.tag.style.opacity = 0; return; }
  ui.tag.style.left = `${((v.x + 1) / 2) * innerWidth}px`; ui.tag.style.top = `${((1 - v.y) / 2) * innerHeight - 8}px`;
}

// ================= le scene =================
const KEYS = ['start', 'business', 'premium', 'custom'];
const glow = { dept: null, card: null };
let cardsShown = 1;

// 1 - la V nello spazio
function intro() {
  store.go('INTRO');
  rig.set(P([0, ANCHOR_Y + 1.2, 46], [0, 0.6, 0], 44));
  rig.fly(P([0, ANCHOR_Y, V_DEPTH], [0, 0.55, 0], 46), { dur: 6.5, ease: (x) => 1 - Math.pow(1 - x, 3) });
  lab.lab.visible = false; // la Luna c'è sempre: è la nebbia della distanza a farla emergere dal buio mentre ci si avvicina
  setTimeout(() => { if (store.state === 'INTRO') dock([{ html: 'Entra nella V', on: enter }]); }, reduce ? 300 : 2600);
}
// 2 - portale e tunnel
function enter() {
  if (store.state !== 'INTRO') return;
  dock(null); say(null); store.go('PORTAL'); sound.tunnel();
  rig.breath = 0;
  rig.path(journey, {
    dur: reduce ? 9 : 15, lookAhead: 0.03, endPose: OVER, blendFrom: 0.78,
    speed: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2) * 0.985 + k * 0.015,
    onProgress: (u) => {
      const z = cam.position.z;
      V.userData.body.visible = z > 0.6;
      word.material.opacity = smooth((z - 6) / 10);
      if (u > 0.15 && !lab.lab.visible) lab.lab.visible = true;
      V.visible = u < 0.5; tunnel.visible = u < uT1 + 0.08;
    },
    onDone: arriveLab,
  });
}
function setMoon(a) {
  for (const m of [moon.material, moon.userData.rocks.material]) { m.transparent = a < 1; m.opacity = a; m.depthWrite = a > 0.5; }
}
// 3 - il laboratorio visto dall'alto
function arriveLab() {
  renderer.setClearColor(0x1b2a47);
  V.visible = tunnel.visible = false; setMoon(1); rig.breath = 1;
  store.go('LAB_EXTERIOR');
  say('The Website Lab', 2600);
  setTimeout(toLobby, reduce ? 900 : 2900);
}
function skip() {
  if (!['INTRO', 'PORTAL'].includes(store.state)) return;
  store.go('LAB_EXTERIOR');
  rig.move = null; dock(null);
  V.visible = tunnel.visible = false; lab.lab.visible = moon.visible = moon.userData.rocks.visible = true; setMoon(1);
  rig.set(OVER); rig.breath = 1; renderer.setClearColor(0x1b2a47); say('The Website Lab', 2400);
  setTimeout(toLobby, 1800);
}
$('#skip').addEventListener('click', skip);
addEventListener('wheel', (e) => { if (store.state === 'INTRO' && e.deltaY > 8) enter(); }, { passive: true });
let ty = 0; addEventListener('touchstart', (e) => { ty = e.touches[0].clientY; }, { passive: true });
addEventListener('touchmove', (e) => { if (store.state === 'INTRO' && ty - e.touches[0].clientY > 30) enter(); }, { passive: true });

// 4 - i quattro reparti
const LOBBY = () => P(L(0, 2.25, 8.4), L(0, 1.7, 2.0), 50);
function toLobby() {
  store.go('FEATURE_SELECTION');
  rig.fly(LOBBY(), { dur: 5.2, via: [L(0, 9, 36), L(0, 3.2, R_LAB + 3.5), L(0, 2.4, R_LAB - 2.5)], lookVia: [L(0, 2.8, R_LAB), L(0, 2, 6)], onDone: () => conf.open() });
  showCards(true);
}
// 4a - il configuratore: cosa serve al tuo business
const conf = configurator({
  cfg, slots, slotsAreDemo, fmt,
  onRecommend: (k) => { glow.card = k; },
  onGo: (k, req) => { store.ctx.request = req; conf.close(); openDept(k); },
  onSkip: () => { store.ctx.request = conf.summary(); conf.close(); if (store.go('DEPARTMENT_SELECTION')) lobbyReady(); },
});
function openConfig() { if (!store.go('FEATURE_SELECTION')) return; picks = []; dock(null); say(null); tagAt(null); conf.open(); }
function lobbyReady() {
  say('Scegli il tuo reparto.');
  const items = KEYS.map((k) => ({ html: `${cfg.packages[k].name} <small>${cfg.packages[k].priceLabel}</small>`, label: `${cfg.packages[k].name}, ${cfg.packages[k].priceLabel}: ${cfg.packages[k].desc}`, on: () => openDept(k), hover: (v) => hoverCard(k, v) }));
  items.push({ html: 'Le tue funzionalità', cls: 'back', on: openConfig });
  dock(items);
  picks = KEYS.map((k) => ({ obj: cards[k].hit, on: () => openDept(k), hover: (v) => hoverCard(k, v) }));
}
function hoverCard(k, on) {
  glow.card = on ? k : null;
  if (on) tagAt(cards[k].tag.localToWorld(new THREE.Vector3(0, -1.22, 0)), '', cfg.packages[k].desc); else tagAt(null);
}
function showCards(v) { cardsShown = v ? 1 : 0; }
function backToLobby() {
  if (!store.go('DEPARTMENT_SELECTION')) return;
  passOff(); picks = []; dock(null); say(null); tagAt(null); resetSeat();
  showCards(true);
  rig.fly(LOBBY(), { dur: 3, via: [L(0, 3.6, 3)], onDone: lobbyReady });
}

// 5 - dentro il reparto, le postazioni
const deptPose = (k) => { const d = DEPTS[k], mid = (d.phi[0] + d.phi[1]) / 2; return P(polar(2.2, mid, 4.3).add(LAB), polar(12.6, mid, 0.5).add(LAB), 54); };
function openDept(k) {
  const from = store.state;
  if (!store.go('DEPARTMENT_INTERIOR', { dept: k, slot: null })) return;
  picks = []; dock(null); say(null); tagAt(null); passOff(); resetSeat(); sound.whoosh();
  glow.dept = k; showCards(false);
  const to = deptPose(k), mid = (DEPTS[k].phi[0] + DEPTS[k].phi[1]) / 2;
  const via = from === 'DEPARTMENT_SELECTION' || from === 'FEATURE_SELECTION' ? [L(0, 3.4, 5.2), polar(2.2, mid, 3.6).add(LAB)] : [polar(4.5, mid + 25, 3.3).add(LAB), L(0, 3.8, 0)];
  rig.fly(to, { dur: 3.6, via, onDone: () => seatsReady(k) });
}
let seatFocus = null;
function seatsReady(k) {
  if (store.state !== 'WORKSTATION_SELECTION') store.go('WORKSTATION_SELECTION');
  say(bookingOff ? 'Prenotazioni momentaneamente non disponibili.' : 'Scegli la tua postazione.');
  const list = lab.seats[k];
  const info = (s) => (s.slot.status === 'free' ? `Libera · avvio ${date(s.slot.start)}` : 'Occupata');
  const items = list.map((s) => ({
    html: `<span class="dot"></span>${s.slot.id}`, cls: s.slot.status === 'free' && !bookingOff ? '' : 'busy', disabled: s.slot.status !== 'free' || bookingOff,
    label: `Postazione ${s.slot.id}: ${info(s)}`, on: () => chooseSeat(s), hover: (v) => hoverSeat(s, v, info(s)),
  }));
  items.push({ html: 'Reparti', cls: 'back', on: backToLobby });
  dock(items);
  picks = list.map((s) => ({ obj: s.hit, disabled: s.slot.status !== 'free' || bookingOff, on: () => chooseSeat(s), hover: (v) => hoverSeat(s, v, info(s)) }));
}
function hoverSeat(s, on, info) { seatFocus = on ? s : null; s.badge.scale.setScalar(on ? 1.25 : 1); if (on) tagAt(s.g.localToWorld(new THREE.Vector3(0, 2.35, 0)), '', info); else tagAt(null); }
let seatScreenOld = null, seatActive = null;
function resetSeat() { if (seatActive && seatScreenOld) { seatActive.scr.material.map = seatScreenOld; } seatActive = seatScreenOld = null; }
function chooseSeat(s) {
  if (!store.go('BOARDING_PASS', { slot: s.slot })) return;
  picks = []; dock(null); say(null); tagAt(null); seatFocus = null;
  const k = store.ctx.dept, eye = s.g.localToWorld(new THREE.Vector3(0, 1.3, 0.95)), mon = s.scr.getWorldPosition(new THREE.Vector3());
  rig.fly(P(eye, mon, 46), {
    dur: 3.4, via: [s.g.localToWorld(new THREE.Vector3(2.3, 2.6, 3.4)), s.g.localToWorld(new THREE.Vector3(0.9, 1.8, 1.9))], lookVia: [s.g.localToWorld(new THREE.Vector3(0, 0.9, 0))],
    onDone: async () => {
      seatActive = s; seatScreenOld = s.scr.material.map;
      s.scr.material.map = siteScreen(DEPTS[k].color.getStyle(), 'Il tuo sito'); sound.chime(988);
      await sleep(reduce ? 300 : 1300);
      if (store.state !== 'BOARDING_PASS') return;
      rig.fly(P(s.g.localToWorld(new THREE.Vector3(0, 1.85, 3.1)), s.g.localToWorld(new THREE.Vector3(0, 1.15, -0.3)), 50), { dur: 1.8, onDone: passOn });
    },
  });
}

// 6 - la carta d'imbarco
function passOn() {
  const { dept: k, slot } = store.ctx, p = cfg.packages[k];
  $('#fDept').textContent = p.name; $('#fSlot').textContent = slot.id;
  $('#fStart').textContent = date(slot.start); $('#fOnline').textContent = date(slot.online);
  $('#fPrice').textContent = p.priceLabel;
  const dep = deposit(p); $('#fDeposit').textContent = dep == null ? '—' : `${p.from ? 'Da ' : ''}CHF ${fmt(dep)}`;
  $('#demoNote').hidden = !slotsAreDemo;
  const req = store.ctx.request, fl = req?.features?.map((id) => cfg.features.find((f) => f.id === id)?.label).filter(Boolean) || [];
  $('#fFeat').hidden = !fl.length; $('#fFeat').textContent = fl.length ? `Il tuo sito: ${fl.join(' · ')}` : '';
  $('#passShot').src = siteScreen(DEPTS[k].color.getStyle(), 'Il tuo sito').image.toDataURL();
  const go = $('#go');
  go.querySelector('.t span').textContent = p.price == null ? 'Richiedi un incontro' : 'Prendi il volo';
  go.querySelector('small').textContent = p.price == null ? 'Prezzo e tempi si definiscono insieme' : "Paga l'acconto e avvia il tuo progetto";
  const up = $('#upgrade'); up.textContent = k === 'start' || k === 'business' ? 'Passa a Premium' : 'Cambia reparto';
  ui.pass.hidden = false; requestAnimationFrame(() => { fitPass(); passSlab.visible = true; ui.pass.classList.add('on'); go.focus({ preventScroll: true }); });
}
function passOff() { ui.pass.classList.remove('on'); ui.pass.hidden = true; passSlab.visible = false; }
$('#change').addEventListener('click', () => { const k = store.ctx.dept; if (!store.go('WORKSTATION_SELECTION', { slot: null })) return; passOff(); resetSeat(); rig.fly(deptPose(k), { dur: 2.6, onDone: () => seatsReady(k) }); });
$('#upgrade').addEventListener('click', () => { const k = store.ctx.dept; openDept(k === 'start' || k === 'business' ? 'premium' : KEYS[(KEYS.indexOf(k) + 1) % 4]); });

// 7 - pagamento: Stripe lato server in produzione, anteprima dichiarata in demo
$('#go').addEventListener('click', () => {
  if (!store.go('PAYMENT')) return;
  const { dept: k } = store.ctx, p = cfg.packages[k], dep = deposit(p);
  const payGo = $('#payGo');
  if (p.price == null) {
    $('#payT').textContent = 'Progetto su misura';
    $('#payTxt').textContent = 'Per i progetti speciali prezzo, tempi e postazione si definiscono insieme. Nessun acconto ora.';
    $('#payAmt').textContent = 'Su richiesta';
    const mail = cfg.contactEmail;
    payGo.hidden = !mail; payGo.querySelector('span').textContent = 'Scrivici';
    payGo.onclick = () => { location.href = `mailto:${mail}?subject=${encodeURIComponent('Progetto su misura')}`; };
    $('#payFine').textContent = mail ? '' : 'Contatto non ancora configurato.';
  } else if (!live) {
    $('#payT').textContent = 'Modalità dimostrativa';
    $('#payTxt').textContent = 'I pagamenti non sono ancora attivi su questo sito: nessun addebito e nessuna prenotazione. Puoi vedere come prosegue il viaggio.';
    $('#payAmt').textContent = `CHF ${fmt(dep)}`;
    payGo.hidden = false; payGo.querySelector('span').textContent = 'Guarda il lancio (demo)';
    payGo.onclick = () => { closePay(); launch({ demoPreview: true }); };
    $('#payFine').textContent = "In produzione l'acconto si paga su Stripe (carta o TWINT) e il lancio parte solo dopo la conferma del pagamento.";
  } else {
    $('#payT').textContent = 'Avvia il tuo progetto';
    $('#payTxt').textContent = `Acconto del ${cfg.depositPercent}% su una pagina di pagamento sicura Stripe. La postazione resta riservata per 30 minuti.`;
    $('#payAmt').textContent = `CHF ${fmt(dep)}`;
    payGo.hidden = false; payGo.querySelector('span').textContent = "Paga l'acconto";
    payGo.onclick = checkout; $('#payFine').textContent = 'Carta o TWINT. Il volo parte quando il pagamento è confermato.';
  }
  ui.pay.hidden = false; payGo.focus();
});
function closePay() { ui.pay.hidden = true; }
$('#payBack').addEventListener('click', () => { closePay(); store.go('BOARDING_PASS'); });
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (!ui.pay.hidden) $('#payBack').click(); else if (store.state === 'WORKSTATION_SELECTION') backToLobby(); }
  if (store.state === 'INTRO' && ['ArrowDown', ' ', 'Enter', 'PageDown'].includes(e.key) && document.activeElement === document.body) enter();
});
async function checkout() {
  const btn = $('#payGo'); btn.disabled = true; $('#payFine').textContent = 'Verifica della disponibilità…';
  try {
    const r = await fetch(`${cfg.api}/checkout`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dept: store.ctx.dept, slotId: store.ctx.slot.id, features: store.ctx.request?.features || [], sector: store.ctx.request?.sector || '' }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.url) throw new Error(j.error || 'Pagamento non disponibile in questo momento.');
    location.href = j.url; // pagina Stripe; il ritorno porta ?session_id=…
  } catch (err) { $('#payFine').textContent = err.message; btn.disabled = false; }
}

// 8 - lancio e orbita
const ROCKET_VIEW = () => P(L(12, 3.5, 36), L(31, 7.5, 7), 44);
function launch(patch) {
  if (!store.go('LAUNCH', patch)) return;
  passOff(); picks = []; dock(null); tagAt(null); $('#skip').hidden = true;
  const k = store.ctx.dept, mid = k ? (DEPTS[k].phi[0] + DEPTS[k].phi[1]) / 2 : 90;
  const via = cam.position.distanceTo(LAB) < R_LAB ? [polar(6, mid, 3.2).add(LAB), L(0, 3.2, 9), L(0, 3.4, R_LAB + 4), L(5, 4, R_LAB + 14)] : [];
  dust.visible = true;
  rig.fly(ROCKET_VIEW(), { dur: via.length ? 6 : 0.01, via, lookVia: via.length ? [L(0, 2.6, R_LAB), L(20, 5, R_LAB + 6)] : null, onDone: ignite });
}
let fx = null;
const ORBIT_POSE = () => P([0, 230, -3500], [0, 430, -5000], 50);
// dove il razzo arriva in orbita e diventa il sito: a destra della scritta (sopra, in verticale)
function finale() {
  const end = ORBIT_POSE(), f = end.t.clone().sub(end.p).normalize(), right = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize(), up = new THREE.Vector3().crossVectors(right, f);
  const portrait = innerWidth / innerHeight < 1;
  return { end, f, right, up, portrait, at: end.p.clone().addScaledVector(f, 80).addScaledVector(right, portrait ? 0 : 27).addScaledVector(up, portrait ? 19 : 6) };
}
function ignite() {
  say(store.ctx.demoPreview ? 'Anteprima: decollo.' : 'Decollo.', 2500); sound.engine(); rig.breath = 0; rig.move = null;
  const R = rk.rocket; scene.attach(R); // il razzo lascia la rampa: da qui vive nel mondo
  const start = R.position.clone(), F = finale();
  // la rotta: sale in verticale, si inclina verso la Terra e la raggiunge in orbita (la Terra resta sempre davanti, dietro al razzo)
  const route = new THREE.CatmullRomCurve3([start, start.clone().add(new THREE.Vector3(0, 40, 0)), start.clone().add(new THREE.Vector3(-4, 135, -55)), start.clone().add(new THREE.Vector3(-14, 290, -430)),
    new THREE.Vector3(10, 120, -1900), F.end.p.clone().addScaledVector(F.f, 150).addScaledVector(F.right, F.portrait ? -25 : -60).addScaledVector(F.up, F.portrait ? -45 : -38),
    F.end.p.clone().addScaledVector(F.f, 105).addScaledVector(F.right, F.portrait ? -8 : 0).addScaledVector(F.up, F.portrait ? 0 : -6), F.at.clone()], false, 'centripetal');
  trail.geometry.dispose(); trail.geometry = new THREE.TubeGeometry(route, 900, 0.2, 8, false); trail.visible = true; trail.material.uniforms.r.value = 0;
  panel.position.copy(F.at); panel.lookAt(F.end.p); if (!F.portrait) panel.rotateY(-0.3); panel.userData.y0 = panel.position.y; panel.scale.setScalar(0.001);
  fx = { t0: performance.now() / 1000, camFrom: cam.position.clone(), lookFrom: rig.look.clone(), route, F, o0: cam.position.clone().sub(start), o1: F.end.p.clone().sub(F.at), T: reduce ? 8 : 16 };
}
const _q = new THREE.Quaternion(), _y = new THREE.Vector3(0, 1, 0), _v = new THREE.Vector3(), _w = new THREE.Vector3();
function tickLaunch(now) {
  if (!fx) return;
  const t = now - fx.t0, R = rk.rocket, ign = smooth(t / 1.4);
  rk.flameMat.uniforms.k.value = ign * (0.85 + Math.sin(now * 40) * 0.08) * (fx.arrived ? 0 : 1); rk.flameMat.uniforms.t.value = now;
  rk.engineLight.intensity = ign * 900 * (fx.arrived ? 0 : 1);
  for (const sm of rk.smoke) {
    const tt = Math.max(0, t - sm.d), r = Math.min(16, sm.v * tt * 3.2);
    sm.s.position.set(Math.cos(sm.a) * r, 0.9 + tt * 0.35, Math.sin(sm.a) * r);
    const sc = 1.2 + tt * 1.7; sm.s.scale.set(sc, sc, sc); sm.s.material.opacity = ign * Math.max(0, 0.55 - tt * 0.04);
  }
  // avanzamento: parte da fermo, accelera, rallenta all'arrivo in orbita
  const tau = clamp01((t - 1.7) / fx.T), u = tau * tau * (3 - 2 * tau);
  const pos = fx.route.getPointAt(u), tan = fx.route.getTangentAt(Math.min(u, 0.999));
  if (!fx.arrived) { R.position.copy(pos); R.quaternion.copy(_q.setFromUnitVectors(_y, tan)); }
  trail.material.uniforms.r.value = u;
  if (t > 2 && t < 3.2) R.position.x += Math.sin(now * 70) * 0.03; // vibrazione del motore
  // camera: dalla posizione a terra passa all'inseguimento; la distanza cresce con la velocità; all'arrivo si mette nell'inquadratura finale
  const aim = _w.set(0, -260, -5000), away = _v.copy(pos).sub(aim).normalize();
  const D = 26 + 40 * smooth(u * 3), chase = pos.clone().addScaledVector(away, D).add(new THREE.Vector3(0, 4 + 6 * smooth(u * 3), 0));
  const fin = smooth((u - 0.68) / 0.32);
  chase.lerp(fx.F.end.p, fin);
  const k = smooth((t - 1.9) / 3.2);
  cam.position.copy(fx.camFrom).lerp(chase, k);
  const lookR = pos.clone().add(new THREE.Vector3(0, 2 + 4 * smooth(u * 3), 0));
  rig.look.copy(fx.lookFrom).lerp(lookR, smooth((t - 0.6) / 2.2)).lerp(fx.F.end.t, fin);
  if (t > 2 && t < 3.5) cam.position.y += Math.sin(now * 55) * 0.04 * (3.5 - t); // la camera sente il motore
  if (fx.arrived) { const d = now - fx.arrived; cam.position.copy(fx.F.end.p).add(drift(d)); rig.look.copy(fx.F.end.t).addScaledVector(drift(d), 0.4); }
  cam.lookAt(rig.look);
  if (u > 0.55 && lab.lab.visible) lab.lab.visible = false;
  // il razzo arriva e diventa il sito in orbita
  if (u >= 1 && !fx.arrived) { fx.arrived = now; store.go('ORBIT'); say(null); flash(now); setTimeout(showFinal, reduce ? 200 : 900); }
  if (fx.arrived) {
    const d = now - fx.arrived, s = smooth(d / 1.2);
    R.scale.setScalar(Math.max(0.001, 1 - s)); panel.visible = true; panel.scale.setScalar(0.001 + smooth((d - 0.3) / 1.6));
    panel.position.y = panel.userData.y0 + Math.sin(now * 0.7) * 0.5; panel.rotation.z = Math.sin(now * 0.4) * 0.015;
    if (d > 1.3) R.visible = false;
  }
  const fl = fx.flashT ? now - fx.flashT : 9; comet.visible = fl < 1.6; if (comet.visible) { comet.position.copy(panel.position); comet.scale.setScalar(6 + fl * 22); comet.material.opacity = Math.pow(1 - fl / 1.6, 2); }
}
// dopo l'arrivo non si sta fermi: la camera continua a scivolare in orbita
const drift = (d) => (reduce ? new THREE.Vector3() : new THREE.Vector3(Math.sin(d * 0.05) * 16, Math.sin(d * 0.07) * 5, -Math.sin(d * 0.035) * 22));
function flash(now) { fx.flashT = now; sound.chime(660); }
function showFinal() {
  renderer.setClearColor(0x000000);
  // ogni lettera entra da sola, poi il blocco galleggia
  ui.final.querySelectorAll('.orbit-title, .orbit-brand, .orbit-claim').forEach((el) => {
    let i = 0; const wrap = (node) => { for (const n of [...node.childNodes]) { if (n.nodeType === 3) { const frag = document.createDocumentFragment(); for (const ch of n.textContent) { const sp = document.createElement('span'); sp.className = 'ch'; sp.textContent = ch; sp.style.setProperty('--i', i++); frag.append(sp); } n.replaceWith(frag); } else if (n.nodeName !== 'BR') wrap(n); } };
    wrap(el);
  });
  if (store.ctx.demoPreview) ui.final.querySelector('.orbit-claim').insertAdjacentHTML('afterend', '<p class="demo">Anteprima dimostrativa: nessun ordine è stato creato.</p>');
  ui.final.hidden = false; requestAnimationFrame(() => ui.final.classList.add('on'));
}
$('#again').addEventListener('click', () => { location.href = location.pathname; });

// ================= ritorno da Stripe =================
async function returnFromStripe() {
  const q = new URLSearchParams(location.search), sid = q.get('session_id');
  if (!sid) return false;
  history.replaceState(null, '', location.pathname);
  V.visible = tunnel.visible = false; lab.lab.visible = moon.visible = moon.userData.rocks.visible = true; setMoon(1);
  renderer.setClearColor(0x1b2a47); rig.set(ROCKET_VIEW()); say('Verifica del pagamento…');
  try {
    const r = await fetch(`${cfg.api}/order?session_id=${encodeURIComponent(sid)}`, { cache: 'no-store' }), j = await r.json();
    if (j.paid) { say(null); launch({ paid: true, dept: j.dept, slot: { id: j.slotId } }); return true; }
    say('Il pagamento non risulta confermato. Nessun addebito definitivo.');
  } catch { say('Non riusciamo a verificare il pagamento. Ti scriveremo noi per confermare.'); }
  return false;
}

// ================= ciclo =================
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); cam.aspect = w / h;
  if (rig.at) cam.fov = rig.at.fov;
  cam.updateProjectionMatrix(); composer.setPixelRatio(dpr); composer.setSize(w, h); bloom.resolution.set(w / 2, h / 2);
  if (!ui.pass.hidden) fitPass();
}
addEventListener('resize', resize);

const tmpC = new THREE.Color();
let last = performance.now() / 1000, frames = 0, fpsT = last, slowCount = 0;
function frame() {
  const now = performance.now() / 1000, dt = Math.min(0.05, now - last); last = now;
  rig.update(now);
  // schede dei reparti: salgono o scendono nel pavimento, quella puntata si illumina
  for (const k of KEYS) {
    const c = cards[k], hot = glow.card === k;
    const target = cardsShown ? 1 : 0; c.vis = (c.vis ?? 1) + (target - (c.vis ?? 1)) * Math.min(1, dt * 3);
    c.tag.visible = c.vis > 0.02; c.tag.position.y = c.base.y - (1 - c.vis) * 2.2 + Math.sin(now * 0.9 + KEYS.indexOf(k)) * 0.025;
    c.tag.userData.face.material.opacity = c.vis * (glow.card && !hot ? 0.45 : 1);
    c.tag.userData.edge.material.opacity = 0.35 + (hot ? 0.5 : 0);
    c.tag.scale.setScalar(1 + (hot ? 0.05 : 0));
    c.tag.userData.glow.material.opacity = c.vis * (hot ? 0.95 : glow.card ? 0.2 : 0.5);
  }
  // luce dei reparti: quello scelto o puntato è più intenso
  for (const k of KEYS) {
    const on = glow.dept === k || glow.card === k, l = lab.lights[k];
    l.intensity += ((on ? 130 : 62) - l.intensity) * Math.min(1, dt * 3);
    DEPTS[k].arc.material.color.copy(tmpC.copy(DEPTS[k].color).multiplyScalar(on ? 3.4 : 1.8));
  }
  // postazioni libere: alone che respira; quella puntata più evidente
  if (store.state === 'WORKSTATION_SELECTION') {
    for (const s of lab.seats[store.ctx.dept]) s.halo.material.opacity = s.slot.status === 'free' && !bookingOff ? (seatFocus === s ? 0.42 : 0.1 + 0.06 * Math.sin(now * 2.4)) : 0;
  } else for (const k of KEYS) for (const s of lab.seats[k]) if (s.halo.material.opacity) s.halo.material.opacity = 0;
  for (const w of lab.walkers) { const a = now * 0.18 + w.userData.ph; w.position.set(Math.cos(a) * 2.6, 0.31, Math.sin(a) * 2.6 - 1.8); w.rotation.y = -a; }
  space.earth.rotation.y += dt * 0.004; space.earth.userData.city.rotation.y = space.earth.rotation.y;
  tickLaunch(now); dust.material.uniforms.cam.value.copy(cam.position); dust.material.uniforms.off.value += dt * (store.state === 'ORBIT' ? 6 : 0);
  if (ui.tag._w) placeTag();
  composer.render(dt);
  // qualità adattiva: se il dispositivo fatica, si riduce la risoluzione
  frames++; if (now - fpsT > 2) { const fps = frames / (now - fpsT); frames = 0; fpsT = now; if (fps < 38 && dpr > 1) { dpr = Math.max(1, dpr - 0.25); renderer.setPixelRatio(dpr); resize(); } else if (fps < 24 && ++slowCount > 1 && bloom.enabled) { bloom.enabled = false; } }
  requestAnimationFrame(frame);
}

await document.fonts?.ready;
renderer.compile(scene, cam);
const paidReturn = await returnFromStripe();
if (!live && new URLSearchParams(location.search).get('scena') === 'lancio') { V.visible = tunnel.visible = false; setMoon(1); renderer.setClearColor(0x1b2a47); store.ctx.dept = 'business'; launch({ demoPreview: true }); }
if (!paidReturn && store.state === 'INITIAL') intro();
requestAnimationFrame(frame);
setTimeout(() => { $('#loading').style.opacity = 0; setTimeout(() => ($('#loading').hidden = true), 800); }, 150);
