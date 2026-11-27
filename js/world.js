// Il mondo unico: spazio, Terra, Luna, il laboratorio circolare, il razzo. Tutto nella stessa scena, nella stessa luce.
import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from './vendor/jsm/utils/BufferGeometryUtils.js';
import { buildV, buildTunnel, vShape } from './vgeometry.js';
import { PALETTE, C, logoGradient } from './palette.js';

export const LAB = new THREE.Vector3(0, -400, -900);       // centro del laboratorio sulla Luna
export const ROCKET_AT = new THREE.Vector3(31, 0, 7);       // posizione del razzo, relativa al laboratorio (non si sposta mai)
export const EARTH = { c: new THREE.Vector3(0, -1417, -5000), r: 1500 };
export const R_LAB = 18, H_FACADE = 6.6;
// direzione della luce del Sole (notte lunare: luce radente e fredda; la Terra è illuminata di lato e mostra le città sul lato in ombra)
export const SUN_DIR = new THREE.Vector3(-0.85, 0.42, -0.32).normalize();
// I quattro reparti: settore (angoli in gradi, da +x verso +z) e colore della luce, sul gradiente del logo.
export const DEPTS = {
  start: { phi: [108, 168], color: logoGradient(0.0) },
  business: { phi: [12, 72], color: logoGradient(0.33) },
  premium: { phi: [-78, -12], color: logoGradient(0.66) },
  custom: { phi: [192, 258], color: logoGradient(1.0) },
};
const rad = (d) => (d * Math.PI) / 180;
const polar = (r, deg, y = 0) => new THREE.Vector3(r * Math.cos(rad(deg)), y, r * Math.sin(rad(deg)));
const rnd = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// ---------- texture fotorealistiche (generate con Higgsfield, assets/tex) ----------
const _ld = new THREE.TextureLoader();
export function photoTex(name, mobile, { rep = [1, 1], srgb = true } = {}) {
  const t = _ld.load(`assets/tex/${name}${mobile ? '-m' : ''}.jpg`);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = 8;
  return t;
}

// ---------- texture disegnate in codice ----------
export function canvasTex(w, h, draw, { srgb = true, repeat = 0 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  return t;
}
function gradText(ctx, text, x, y, w) { const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0); g.addColorStop(0, PALETTE.blue); g.addColorStop(0.5, PALETTE.azure); g.addColorStop(1, PALETTE.teal); return g; }
// schermata di un sito sui monitor
export const siteScreen = (accent = PALETTE.azure, title = '') => canvasTex(512, 320, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#0b1636'); g.addColorStop(1, '#0d2f4d'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(0, 0, w, 26); ['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(16 + i * 14, 13, 4, 0, 7); c.fill(); });
  c.fillStyle = '#eef4ff'; c.font = '600 30px Montserrat, sans-serif'; c.fillText(title || 'Il tuo sito', 28, 86);
  c.fillStyle = 'rgba(238,244,255,.5)'; c.fillRect(28, 104, 220, 8); c.fillRect(28, 120, 170, 8);
  const b = c.createLinearGradient(28, 0, 160, 0); b.addColorStop(0, PALETTE.blue); b.addColorStop(1, PALETTE.teal); c.fillStyle = b; c.beginPath(); c.roundRect(28, 140, 120, 30, 15); c.fill();
  const m = c.createLinearGradient(300, 50, 490, 180); m.addColorStop(0, accent); m.addColorStop(1, '#0d2f4d'); c.fillStyle = m; c.beginPath(); c.roundRect(300, 50, 186, 130, 10); c.fill();
  c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.moveTo(320, 165); c.lineTo(370, 100); c.lineTo(410, 140); c.lineTo(440, 110); c.lineTo(470, 165); c.fill();
  for (let i = 0; i < 3; i++) { c.fillStyle = 'rgba(255,255,255,.1)'; c.beginPath(); c.roundRect(28 + i * 156, 204, 140, 90, 8); c.fill(); }
});

// ---------- ambiente per i riflessi del vetro: studio scuro con strisce di luce blu, azzurro, verde acqua e bianco ----------
export function makeEnvironment(renderer) {
  const s = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ color: 0x05080f, side: THREE.BackSide }));
  s.add(room);
  const strip = (w, h, col, x, y, z, ry = 0, rx = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); s.add(m); };
  strip(60, 4, new THREE.Color(PALETTE.white).multiplyScalar(4), 0, 30, -10, 0, Math.PI / 2);
  strip(4, 30, new THREE.Color(PALETTE.blue).multiplyScalar(3), -40, 5, 0, Math.PI / 2);
  strip(4, 30, new THREE.Color(PALETTE.teal).multiplyScalar(3), 40, 5, 0, -Math.PI / 2);
  strip(30, 3, new THREE.Color(PALETTE.azure).multiplyScalar(2), 0, 8, -40);
  strip(20, 2, new THREE.Color(PALETTE.white).multiplyScalar(2), 0, 4, 40, Math.PI);
  const pm = new THREE.PMREMGenerator(renderer); const env = pm.fromScene(s, 0.02).texture; pm.dispose();
  return env;
}

// ---------- materiali ----------
export function makeMaterials(mobile) {
  // Vetro "eroe" (V, schede, carta d'imbarco): trasmissione con rifrazione della scena dietro (screen-space), spessore, fresnel e riflessi.
  const heroGlass = mobile
    ? new THREE.MeshPhysicalMaterial({ color: 0xeaf4ff, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.32, clearcoat: 1, envMapIntensity: 1.6, depthWrite: false })
    : new THREE.MeshPhysicalMaterial({ color: 0xf3f9ff, roughness: 0.05, metalness: 0, transmission: 1, thickness: 0.55, ior: 1.46, attenuationColor: new THREE.Color(0xbfe0ff), attenuationDistance: 2.5, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.4, specularIntensity: 1 });
  return {
    heroGlass,
    cardGlass: heroGlass.clone(),
    facade: new THREE.MeshPhysicalMaterial({ color: 0xcfe6ff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.13, envMapIntensity: 2.2, side: THREE.DoubleSide, depthWrite: false }),
    frame: new THREE.MeshStandardMaterial({ map: photoTex('alu', mobile), color: 0xe6ebf2, roughness: 0.32, metalness: 0.85, envMapIntensity: 1.2 }),
    white: new THREE.MeshStandardMaterial({ color: 0xd9dfe8, roughness: 0.3, metalness: 0.05, envMapIntensity: 1 }),
    floor: new THREE.MeshStandardMaterial({ map: photoTex('floor', mobile, { rep: [7, 7] }), color: 0xffffff, roughness: 0.3, metalness: 0.25, envMapIntensity: 1.6 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1b2135, roughness: 0.45, metalness: 0.2 }),
    navy: new THREE.MeshStandardMaterial({ color: 0x1b2a55, roughness: 0.65 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xd9c4b4, roughness: 0.7 }),
    plant: new THREE.MeshStandardMaterial({ color: 0x2f6b46, roughness: 0.85 }),
  };
}

// ---------- cielo: stelle, Terra con atmosfera, orbita e sito ----------
export function buildSpace(scene, mobile) {
  // il cielo: panorama a 360° con la Via Lattea (segue la camera, quindi è sempre "infinitamente" lontano)
  const sky = photoTex('sky', mobile); sky.wrapT = THREE.ClampToEdgeWrapping;
  const stars = new THREE.Mesh(new THREE.SphereGeometry(9500, 64, 32), new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false, color: 0xd8d8d8 }));
  stars.renderOrder = -10; stars.frustumCulled = false; scene.add(stars);

  // Terra: NASA Blue Marble (giorno) e Earth at Night (città), immagini di pubblico dominio
  const ld = new THREE.TextureLoader(), sfx = mobile ? '-2k' : '';
  const tex = ld.load(`assets/earth/day${sfx}.jpg`), lights = ld.load(`assets/earth/night${sfx}.jpg`);
  tex.colorSpace = THREE.SRGBColorSpace; lights.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = lights.anisotropy = 8;
  // un solo shader: giorno (Blue Marble) illuminato da un sole radente, città accese sul lato in ombra, bordo con riflesso atmosferico
  const ES = new THREE.Vector3(-0.62, 0.42, 0.66).normalize();
  const earthMat = new THREE.ShaderMaterial({ uniforms: { day: { value: tex }, night: { value: lights }, sun: { value: ES }, k: { value: 1 }, rim: { value: new THREE.Color(PALETTE.azure) } },
    vertexShader: 'varying vec2 vUv;varying vec3 wn;varying vec3 wp;void main(){vUv=uv;wn=normalize(mat3(modelMatrix)*normal);vec4 w=modelMatrix*vec4(position,1.);wp=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: `uniform sampler2D day;uniform sampler2D night;uniform vec3 sun;uniform float k;uniform vec3 rim;varying vec2 vUv;varying vec3 wn;varying vec3 wp;
      void main(){vec3 n=normalize(wn);float d=dot(n,sun);float lit=smoothstep(-.12,.35,d);
        vec3 dc=texture2D(day,vUv).rgb;
        vec3 nc=texture2D(night,vUv).rgb*vec3(1.,.82,.6)*3.2*k;
        vec3 v=normalize(cameraPosition-wp);float f=pow(1.-max(dot(n,v),0.),3.);
        vec3 c=dc*(.02+1.15*lit)+nc*(1.-smoothstep(-.25,.1,d))+rim*f*(.25+.9*lit);
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(EARTH.r, 128, 64), earthMat); earth.position.copy(EARTH.c); earth.rotation.set(-0.3, -1.84, 0); scene.add(earth); // l'Europa (e la Svizzera) verso la camera nel finale
  earth.userData.city = { material: { uniforms: { k: earthMat.uniforms.k } }, rotation: new THREE.Euler() };
  // atmosfera: solo un alone oltre il bordo
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(EARTH.r * 1.04, 96, 48), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.FrontSide, blending: THREE.AdditiveBlending,
    uniforms: { c1: { value: new THREE.Color(PALETTE.azure) }, c2: { value: new THREE.Color(PALETTE.teal) }, R: { value: EARTH.r }, C: { value: EARTH.c } },
    vertexShader: 'varying vec3 wn;varying vec3 wp;void main(){wn=normalize(mat3(modelMatrix)*normal);vec4 w=modelMatrix*vec4(position,1.);wp=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: 'uniform vec3 c1;uniform vec3 c2;uniform float R;uniform vec3 C;varying vec3 wn;varying vec3 wp;void main(){vec3 v=normalize(wp-cameraPosition);vec3 oc=cameraPosition-C;float b=dot(oc,v);float h=b*b-dot(oc,oc)+R*R;if(h>0.)discard;float dm=sqrt(max(dot(oc,oc)-b*b,0.));float t=clamp((dm-R)/(R*.04),0.,1.);float f=pow(1.-t,2.6);gl_FragColor=vec4(mix(c2,c1,t)*1.6*f,f);}' }));
  atmo.position.copy(EARTH.c); scene.add(atmo);
  // orbita luminosa e il sito in orbita (visibili solo nel finale)
  const orbit = new THREE.Mesh(new THREE.TorusGeometry(EARTH.r * 1.18, 5, 12, 360), new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.teal).multiplyScalar(2.2), transparent: true, opacity: 0, toneMapped: false }));
  orbit.position.copy(EARTH.c); orbit.rotation.set(Math.PI / 2 - 0.42, 0.18, 0); scene.add(orbit);
  return { stars, earth, atmo, orbit };
}

// ---------- Luna ----------
export const MOON_R = 2800;                                     // la Luna è una sfera: si vede la curvatura e l'orizzonte
export const MOON_C = new THREE.Vector3(LAB.x, LAB.y - MOON_R, LAB.z);
const onMoon = (x, z, lift = 0) => { const d = new THREE.Vector3(x - MOON_C.x, 0, z - MOON_C.z); d.y = Math.sqrt(Math.max(0, MOON_R * MOON_R - d.x * d.x - d.z * d.z)); d.normalize(); return { p: MOON_C.clone().addScaledVector(d, MOON_R + lift), n: d }; };
export function buildMoon(scene, mats, mobile) {
  // superficie: terreno lunare a grande scala (mari e crateri visti dall'alto) moltiplicato per la regolite in dettaglio;
  // il rilievo viene dalla regolite (crateri piccoli, sassi). Texture fotorealistiche generate con Higgsfield.
  const map = photoTex('terrain', mobile, { rep: [9, 4.5] });
  const detail = photoTex('regolith', mobile);
  const bump = photoTex('regolith-h', mobile, { rep: [110, 55], srgb: false });
  const mat = new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 3.2, roughness: 1, metalness: 0, color: 0xe2e4ea });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.detailMap = { value: detail }; sh.uniforms.detailScale = { value: 110 / 9 };
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_pars_fragment>', '#include <map_pars_fragment>\nuniform sampler2D detailMap;uniform float detailScale;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n#ifdef USE_MAP\ndiffuseColor.rgb *= texture2D(detailMap, vMapUv * detailScale).rgb * 2.05;\n#endif');
  };
  const cm = new THREE.MeshStandardMaterial({ map: photoTex('regolith', mobile, { rep: [2, 2] }), bumpMap: photoTex('regolith-h', mobile, { rep: [2, 2], srgb: false }), bumpScale: 2.5, roughness: 1, color: 0xc4c6cc });
  const ground = new THREE.Mesh(new THREE.SphereGeometry(MOON_R, mobile ? 192 : 320, mobile ? 96 : 160), mat);
  ground.position.copy(MOON_C); ground.rotation.z = Math.PI / 2; ground.receiveShadow = !mobile; scene.add(ground);
  // crateri 3D attorno al laboratorio: pareti interne in ombra, bordi in luce radente
  const craters = new THREE.Group(); scene.add(craters);
  for (let i = 0; i < (mobile ? 10 : 18); i++) {
    const a = rnd(i + 50) * Math.PI * 2, r = 55 + rnd(i + 51) * 380, cr = 5 + Math.pow(rnd(i + 52), 2) * 38;
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a)) - Math.PI / 2) < 0.5 && r < 160) continue; // libera la vista davanti all'ingresso
    const prof = [[0, 0.02], [0.7, 0.02], [0.86, 0.06], [1, 0.16], [1.12, 0.11], [1.5, 0.02], [1.75, -0.03]].map(([x, y]) => new THREE.Vector2(x * cr, y * cr));
    const m = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), cm); const at = onMoon(LAB.x + Math.cos(a) * r, LAB.z + Math.sin(a) * r);
    m.position.copy(at.p); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), at.n); m.receiveShadow = m.castShadow = !mobile; craters.add(m);
  }
  // sassi
  // sassi irregolari: sfera deformata con la stessa regolite (niente poliedri regolari)
  const rg = mergeVertices(new THREE.IcosahedronGeometry(1, 3).deleteAttribute('normal').deleteAttribute('uv')), rp = rg.attributes.position;
  for (let i = 0; i < rp.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(rp, i), n = 0.72 + 0.28 * Math.abs(Math.sin(v.x * 3.1 + 1.7) * Math.cos(v.y * 2.3 - v.z * 2.9)) + 0.12 * Math.sin(v.x * 9 + v.z * 7); v.multiplyScalar(n); v.y *= 0.78; rp.setXYZ(i, v.x, v.y, v.z); }
  rg.computeVertexNormals();
  { const uv = new Float32Array(rp.count * 2); for (let i = 0; i < rp.count; i++) { const x = rp.getX(i), y = rp.getY(i), z = rp.getZ(i); uv[i * 2] = 0.5 + Math.atan2(z, x) / (2 * Math.PI); uv[i * 2 + 1] = 0.5 + y * 0.5; } rg.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); }
  const rocks = new THREE.InstancedMesh(rg, new THREE.MeshStandardMaterial({ map: photoTex('regolith', mobile, { rep: [0.6, 0.6] }), bumpMap: photoTex('regolith-h', mobile, { rep: [0.6, 0.6], srgb: false }), bumpScale: 2, roughness: 1, color: 0xc9ccd2 }), mobile ? 140 : 420);
  const mm = new THREE.Matrix4();
  for (let i = 0; i < rocks.count; i++) { const a = rnd(i) * Math.PI * 2, r = 26 + rnd(i + 1) * 300, sc = 0.2 + Math.pow(rnd(i + 2), 3) * 2.4, at = onMoon(LAB.x + Math.cos(a) * r, LAB.z + Math.sin(a) * r, sc * 0.25); mm.compose(at.p, new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(i + 3) * 3, rnd(i + 4) * 3, 0)), new THREE.Vector3(sc, sc * 0.6, sc)); rocks.setMatrixAt(i, mm); }
  rocks.castShadow = !mobile; rocks.receiveShadow = !mobile; scene.add(rocks);
  ground.userData.rocks = rocks; ground.userData.craters = craters;
  return ground;
}

// ---------- persone stilizzate, da plastico di architettura ----------
const P_G = { torso: new THREE.CapsuleGeometry(0.19, 0.42, 4, 12), head: new THREE.SphereGeometry(0.12, 20, 14), arm: new THREE.CapsuleGeometry(0.055, 0.42, 4, 8), leg: new THREE.CapsuleGeometry(0.075, 0.5, 4, 8) };
export function person(mats, { seated = true } = {}) {
  const p = new THREE.Group();
  const torso = new THREE.Mesh(P_G.torso, mats.navy); torso.position.y = seated ? 0.92 : 1.16; p.add(torso);
  const head = new THREE.Mesh(P_G.head, mats.skin); head.position.y = torso.position.y + 0.45; p.add(head);
  for (const sx of [-1, 1]) {
    const a = new THREE.Mesh(P_G.arm, mats.navy); a.position.set(sx * 0.24, torso.position.y + 0.02, seated ? -0.18 : 0); a.rotation.x = seated ? -1.0 : 0.05; p.add(a);
    const l = new THREE.Mesh(P_G.leg, mats.dark); if (seated) { l.position.set(sx * 0.1, 0.52, -0.25); l.rotation.x = Math.PI / 2; } else l.position.set(sx * 0.1, 0.42, 0); p.add(l);
  }
  p.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return p;
}

// ---------- postazione ----------
// scrivanie
const D_G = { top: new RoundedBoxGeometry(1.5, 0.05, 0.78, 2, 0.02), leg: new THREE.CylinderGeometry(0.02, 0.02, 0.72, 10), mon: new RoundedBoxGeometry(0.66, 0.4, 0.025, 2, 0.01), seat: new THREE.CylinderGeometry(0.24, 0.24, 0.08, 24), back: new RoundedBoxGeometry(0.46, 0.5, 0.05, 2, 0.02) };
export function workstation(mats, { occupied, screen }) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(D_G.top, mats.white); top.position.y = 0.74; top.castShadow = top.receiveShadow = true; g.add(top);
  for (const sx of [-0.68, 0.68]) for (const sz of [-0.32, 0.32]) { const l = new THREE.Mesh(D_G.leg, mats.frame); l.position.set(sx, 0.37, sz); g.add(l); }
  const mon = new THREE.Mesh(D_G.mon, mats.dark); mon.position.set(0, 1.06, -0.26); g.add(mon);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.36), new THREE.MeshBasicMaterial({ map: screen, toneMapped: false })); scr.position.set(0, 1.06, -0.245); g.add(scr);
  const st = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.04), mats.frame); st.position.set(0, 0.86, -0.28); g.add(st);
  const seat = new THREE.Mesh(D_G.seat, mats.dark); seat.position.set(0, 0.5, 0.52); g.add(seat);
  const back = new THREE.Mesh(D_G.back, mats.dark); back.position.set(0, 0.82, 0.76); g.add(back);
  // indicatore di stato sul bordo della scrivania: verde acqua se libera, rosso discreto se occupata
  const ind = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.012, 0.02), new THREE.MeshBasicMaterial({ color: occupied ? new THREE.Color(0xff5a5a).multiplyScalar(1.4) : new THREE.Color(PALETTE.teal).multiplyScalar(2), toneMapped: false }));
  ind.position.set(0, 0.765, 0.39); g.add(ind);
  // alone a terra per le libere
  const halo = new THREE.Mesh(new THREE.CircleGeometry(1.1, 48), new THREE.MeshBasicMaterial({ color: PALETTE.teal, transparent: true, opacity: 0, depthWrite: false }));
  halo.rotation.x = -Math.PI / 2; halo.position.set(0, 0.02, 0.2); g.add(halo);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.6, 2.1), new THREE.MeshBasicMaterial({ visible: false })); hit.position.set(0, 0.8, 0.3); g.add(hit);
  return { g, scr, ind, halo, hit };
}
// targhetta sopra la scrivania: codice, stato, lucchetto (verde acqua se libera, rosso discreto se occupata)
export function seatBadge(mats, id, free) {
  const t = glassTag(mats, 0.62, 0.5, (c, w, h) => {
    const col = free ? '#3fe0cc' : '#ff7a7a';
    c.strokeStyle = free ? 'rgba(63,224,204,.9)' : 'rgba(255,122,122,.5)'; c.lineWidth = 6; c.shadowColor = col; c.shadowBlur = free ? 22 : 8; c.beginPath(); c.roundRect(8, 8, w - 16, h - 16, 60); c.stroke(); c.shadowBlur = 0;
    c.textAlign = 'center'; c.fillStyle = '#ffffff'; c.font = '500 96px Montserrat, sans-serif'; c.fillText(id, w / 2, 140);
    c.fillStyle = col; c.font = '400 60px Montserrat, sans-serif'; c.fillText(free ? 'Libera' : 'Occupata', w / 2, 230);
    c.strokeStyle = col; c.lineWidth = 7; const x = w / 2, y = 300; c.strokeRect(x - 26, y, 52, 40); c.beginPath(); free ? c.arc(x + 20, y, 18, Math.PI, 0) : c.arc(x, y, 18, Math.PI, 0); c.stroke();
  });
  t.userData.free = free; return t;
}

// targhetta di vetro con testo (postazioni e reparti)
export function glassTag(mats, w, h, draw) {
  const g = new THREE.Group();
  const slab = new THREE.Mesh(new RoundedBoxGeometry(w, h, 0.05, 4, Math.min(w, h) * 0.18), mats.cardGlass); g.add(slab);
  const tex = canvasTex(512, Math.round(512 * h / w), draw);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false }));
  face.position.z = 0.03; g.add(face);
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new RoundedBoxGeometry(w, h, 0.05, 2, Math.min(w, h) * 0.18), 30), new THREE.LineBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.35 }));
  g.add(edge);
  g.userData = { slab, face, tex, edge };
  return g;
}

// ---------- il laboratorio circolare ----------
export function buildLab(scene, mats, data, mobile) {
  const lab = new THREE.Group(); lab.position.copy(LAB); scene.add(lab);
  const add = (o, x = 0, y = 0, z = 0) => { o.position.set(x, y, z); lab.add(o); return o; };
  // basamento e pavimento lucido
  add(new THREE.Mesh(new THREE.CylinderGeometry(R_LAB + 0.8, R_LAB + 1.2, 0.3, 128), mats.frame), 0, 0.15, 0).receiveShadow = true;
  const fl = add(new THREE.Mesh(new THREE.CircleGeometry(R_LAB, 128), mats.floor), 0, 0.31, 0); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true;
  // facciata di vetro e montanti
  add(new THREE.Mesh(new THREE.CylinderGeometry(R_LAB, R_LAB, H_FACADE, 128, 1, true), mats.facade), 0, H_FACADE / 2 + 0.3, 0);
  const mull = [];
  for (let a = 0; a < 360; a += 7.5) { if (a > 82 && a < 98) continue; const b = new THREE.BoxGeometry(0.07, H_FACADE, 0.12); b.rotateY(-rad(a)); b.translate(R_LAB * Math.cos(rad(a)), H_FACADE / 2 + 0.3, R_LAB * Math.sin(rad(a))); mull.push(b); }
  add(new THREE.Mesh(mergeGeometries(mull), mats.frame));
  for (const y of [0.32, H_FACADE + 0.3]) { const t = add(new THREE.Mesh(new THREE.TorusGeometry(R_LAB, 0.07, 8, 160), mats.frame), 0, y, 0); t.rotation.x = Math.PI / 2; }
  // cupola di vetro con nervature
  const h = 3.8, Rs = (R_LAB * R_LAB + h * h) / (2 * h), th = Math.asin(R_LAB / Rs), cy = H_FACADE + 0.3 + h - Rs;
  add(new THREE.Mesh(new THREE.SphereGeometry(Rs, 96, 24, 0, Math.PI * 2, 0, th), mats.facade), 0, cy, 0);
  const ribs = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.SphereGeometry(Rs, 24, 5, 0, Math.PI * 2, 0, th), 1), new THREE.LineBasicMaterial({ color: 0xd3deec, transparent: true, opacity: 0.45 }));
  add(ribs, 0, cy, 0);
  // la V originale sulla sommità
  const topV = buildV({ glass: mats.heroGlass, depth: 3, tunnel: 0, edgeR: 0.06 }); topV.scale.setScalar(0.34); add(topV, 0, H_FACADE + h + 2.2, 0.0);
  // insegna: VITRALIA / WEB STUDIO e THE WEBSITE LAB sopra l'ingresso
  const sign = (w, hh, draw, y, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), new THREE.MeshBasicMaterial({ map: canvasTex(1024, Math.round(1024 * hh / w), draw), transparent: true, toneMapped: false })); return add(m, 0, y, z); };
  sign(9, 1.6, (c, w, hh) => { c.textAlign = 'center'; c.font = '500 118px Montserrat, sans-serif'; c.letterSpacing = '34px'; c.fillStyle = gradText(c, '', w / 2, 0, 760); c.fillText('VITRALIA', w / 2 + 17, 116); c.font = '500 34px Montserrat, sans-serif'; c.letterSpacing = '22px'; c.fillStyle = '#dfe9f8'; c.fillText('WEB STUDIO', w / 2 + 11, 172); }, H_FACADE - 0.75, R_LAB + 0.05);
  const panel = add(new THREE.Mesh(new RoundedBoxGeometry(5.2, 0.7, 0.08, 3, 0.12), mats.dark), 0, 3.55, R_LAB + 0.08);
  sign(5, 0.6, (c, w, hh) => { c.textAlign = 'center'; c.font = '500 64px Montserrat, sans-serif'; c.letterSpacing = '16px'; c.fillStyle = '#eef4ff'; c.fillText('THE WEBSITE LAB', w / 2 + 8, 82); }, 3.55, R_LAB + 0.14);
  // ingresso
  for (const x of [-1.9, 1.9]) add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 3, 0.18), mats.frame), x, 1.8, R_LAB);
  // pareti di vetro tra i reparti (l'atrio centrale e il corridoio d'ingresso restano aperti)
  const wall = (len, ang, rIn) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 3.1), mats.facade); m.position.copy(polar(rIn + len / 2, ang, 1.85)); m.rotation.y = -rad(ang); lab.add(m); const e = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.05), mats.frame); e.position.copy(polar(rIn + len / 2, ang, 3.4)); e.rotation.y = -rad(ang); lab.add(e); };
  wall(R_LAB - 5.6, 0, 5.4); wall(R_LAB - 5.6, 180, 5.4); wall(R_LAB - 5.6, 270, 5.4);
  // atrio: anello di luce, banco circolare
  const ringL = add(new THREE.Mesh(new THREE.TorusGeometry(4.4, 0.06, 12, 160), new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.white).multiplyScalar(2.2), toneMapped: false })), 0, 4.6, 0); ringL.rotation.x = Math.PI / 2;
  const desk = add(new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.35, 16, 64, Math.PI * 1.4), mats.white), 0, 0.85, -1.8); desk.rotation.x = Math.PI / 2; desk.rotation.z = Math.PI * 0.3;
  // luci: una per reparto con il suo colore, una bianca nell'atrio
  const lights = {};
  for (const [k, d] of Object.entries(DEPTS)) {
    const mid = (d.phi[0] + d.phi[1]) / 2, l = new THREE.PointLight(d.color, mobile ? 40 : 55, 26, 2); l.position.copy(polar(11, mid, 5.2)); lab.add(l); lights[k] = l;
    const arc = new THREE.Mesh(new THREE.TorusGeometry(R_LAB - 0.5, 0.035, 8, 64, rad(d.phi[1] - d.phi[0])), new THREE.MeshBasicMaterial({ color: d.color.clone().multiplyScalar(2.4), toneMapped: false }));
    arc.rotation.x = -Math.PI / 2; arc.rotation.z = -rad(d.phi[1]); arc.position.y = H_FACADE + 0.1; lab.add(arc); d.arc = arc;
  }
  const lobbyLight = new THREE.PointLight(0xeaf2ff, mobile ? 30 : 45, 18, 2); lobbyLight.position.set(0, 4.2, 0); lab.add(lobbyLight);
  // piante, poche
  const plant = (x, z) => { const v = add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.55, 20), mats.white), x, 0.58, z); const b = add(new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), mats.plant), x, 1.25, z); b.scale.y = 1.35; };
  [[-15.5, 6], [15.5, 6], [6, -15.5], [-6, -15.5]].forEach(([x, z]) => plant(x, z));

  // ---------- postazioni, dai dati ----------
  const seats = {};
  const outward = (phi) => Math.atan2(-Math.cos(rad(phi)), -Math.sin(rad(phi)));
  const placeArc = (k, list, radii) => {
    const d = DEPTS[k], per = Math.ceil(list.length / radii.length); let i = 0;
    for (const r of radii) for (let j = 0; j < per && i < list.length; j++, i++) {
      const phi = d.phi[0] + (d.phi[1] - d.phi[0]) * ((j + 0.5) / per);
      const ws = workstation(mats, { occupied: list[i].status !== 'free', screen: siteScreen(d.color.getStyle()) });
      ws.g.position.copy(polar(r, phi, 0.31)); ws.g.rotation.y = outward(phi); lab.add(ws.g);
      const b = seatBadge(mats, list[i].id, list[i].status === 'free'); b.position.set(0, 1.72, 0.35); ws.g.add(b);
      seats[k].push({ ...ws, k, slot: list[i], phi, r, badge: b });
    }
  };
  for (const k of Object.keys(DEPTS)) seats[k] = [];
  placeArc('start', data.slots.start || [], [9.6, 13.8]);
  placeArc('business', data.slots.business || [], [10.2, 14.2]);
  // Premium: suite di vetro private
  (data.slots.premium || []).forEach((slot, i, arr) => {
    const d = DEPTS.premium, phi = d.phi[0] + (d.phi[1] - d.phi[0]) * ((i + 0.5) / arr.length), c = polar(12.2, phi, 0.31);
    const box = new THREE.Mesh(new THREE.BoxGeometry(3.6, 3, 3.6), mats.facade); box.position.copy(c).setY(1.85); box.rotation.y = outward(phi); lab.add(box);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), new THREE.LineBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.4 })); e.position.copy(box.position); e.rotation.copy(box.rotation); lab.add(e);
    const ws = workstation(mats, { occupied: slot.status !== 'free', screen: siteScreen(d.color.getStyle()) }); ws.g.position.copy(c); ws.g.rotation.y = outward(phi); lab.add(ws.g);
    const b = seatBadge(mats, slot.id, slot.status === 'free'); b.position.set(0, 1.72, 0.35); ws.g.add(b);
    seats.premium.push({ ...ws, k: 'premium', slot, phi, r: 12.2, badge: b });
  });
  // Su misura: salotto con grande schermo
  {
    const d = DEPTS.custom, mid = (d.phi[0] + d.phi[1]) / 2, c = polar(11, mid, 0.31);
    const sofa = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.42, 16, 80, Math.PI * 1.25), mats.white); sofa.rotation.x = -Math.PI / 2; sofa.rotation.z = rad(mid) + Math.PI * 0.38; sofa.position.copy(c).setY(0.75); lab.add(sofa);
    const tb = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.06, 48), mats.frame); tb.position.copy(c).setY(0.85); lab.add(tb);
    const scrP = polar(16.6, mid, 2.1), scr = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.4), new THREE.MeshBasicMaterial({ map: siteScreen(d.color.getStyle(), 'Su misura'), toneMapped: false })); scr.position.copy(scrP); scr.lookAt(new THREE.Vector3(0, 2.1, 0)); lab.add(scr);
    (data.slots.custom || []).forEach((slot, i) => {
      const phi = mid + (i - 0.5) * 16, ws = workstation(mats, { occupied: slot.status !== 'free', screen: siteScreen(d.color.getStyle(), 'Su misura') });
      ws.g.position.copy(polar(14.2, phi, 0.31)); ws.g.rotation.y = outward(phi); lab.add(ws.g); const b = seatBadge(mats, slot.id, slot.status === 'free'); b.position.set(0, 1.72, 0.35); ws.g.add(b); seats.custom.push({ ...ws, k: 'custom', slot, phi, r: 14.2, badge: b });
    });
  }
  // persone che camminano nell'atrio
  const walkers = [];
  // luci a terra attorno al basamento e anello luminoso sotto le schede: il laboratorio si legge di notte
  const dotG = new THREE.SphereGeometry(0.09, 10, 8), dotM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xcfe6ff).multiplyScalar(3), toneMapped: false });
  const dots = new THREE.InstancedMesh(dotG, dotM, 48); const mm = new THREE.Matrix4();
  for (let i = 0; i < 48; i++) { mm.setPosition(polar(R_LAB + 2.2, i * 7.5 + 3.75, 0.1)); dots.setMatrixAt(i, mm); } lab.add(dots);
  const crown = add(new THREE.Mesh(new THREE.TorusGeometry(R_LAB - 0.15, 0.05, 8, 200), new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.azure).multiplyScalar(2.6), toneMapped: false })), 0, H_FACADE + 0.15, 0); crown.rotation.x = Math.PI / 2;
  const base = add(new THREE.Mesh(new THREE.TorusGeometry(R_LAB + 1.05, 0.04, 8, 200), new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.teal).multiplyScalar(2.2), toneMapped: false })), 0, 0.3, 0); base.rotation.x = Math.PI / 2;
  const stage = add(new THREE.Mesh(new THREE.RingGeometry(3.05, 3.12, 160, 1, Math.PI * 0.2, Math.PI * 0.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.teal).multiplyScalar(2.5), toneMapped: false, side: THREE.DoubleSide })), 0, 0.33, -0.6); stage.rotation.x = -Math.PI / 2;
  lab.traverse((o) => { if (o.isMesh && !mobile) { o.castShadow = o.castShadow || false; } });
  return { lab, seats, lights, walkers };
}

// ---------- le quattro schede di vetro nell'atrio ----------
const ICON = {
  start: (c, x, y, s) => { c.beginPath(); c.moveTo(x, y - s); c.quadraticCurveTo(x + s * 0.45, y - s * 0.4, x + s * 0.3, y + s * 0.4); c.lineTo(x - s * 0.3, y + s * 0.4); c.quadraticCurveTo(x - s * 0.45, y - s * 0.4, x, y - s); c.stroke(); c.beginPath(); c.arc(x, y - s * 0.2, s * 0.14, 0, 7); c.stroke(); },
  business: (c, x, y, s) => { [0.35, 0.65, 1].forEach((hh, i) => c.strokeRect(x - s * 0.6 + i * s * 0.45, y + s * 0.5 - s * hh, s * 0.28, s * hh)); },
  premium: (c, x, y, s) => { c.beginPath(); c.moveTo(x - s * 0.7, y - s * 0.25); c.lineTo(x - s * 0.35, y - s * 0.6); c.lineTo(x + s * 0.35, y - s * 0.6); c.lineTo(x + s * 0.7, y - s * 0.25); c.lineTo(x, y + s * 0.6); c.closePath(); c.moveTo(x - s * 0.7, y - s * 0.25); c.lineTo(x + s * 0.7, y - s * 0.25); c.stroke(); },
  custom: (c, x, y, s) => { [-0.35, 0, 0.35].forEach((o) => { c.beginPath(); c.moveTo(x - s * 0.6, y + o * s); c.lineTo(x, y + o * s - s * 0.3); c.lineTo(x + s * 0.6, y + o * s); c.lineTo(x, y + o * s + s * 0.3); c.closePath(); c.stroke(); }); },
};
let _glow = null;
const GLOW = () => _glow || (_glow = canvasTex(256, 256, (c) => { const g = c.createRadialGradient(128, 128, 10, 128, 128, 128); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.45, 'rgba(255,255,255,.25)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 256, 256); }));
export function buildCards(lab, mats, packages) {
  const keys = ['start', 'business', 'premium', 'custom'], cards = {};
  keys.forEach((k, i) => {
    const p = packages[k];
    const tag = glassTag(mats, 1.55, 2.0, (c, w, h) => {
      c.strokeStyle = 'rgba(63,224,204,.85)'; c.lineWidth = 5; c.shadowColor = '#3fe0cc'; c.shadowBlur = 26; c.beginPath(); c.roundRect(6, 6, w - 12, h - 12, 70); c.stroke(); c.shadowBlur = 18;
      c.strokeStyle = '#7ff0e0'; c.lineWidth = 9; c.lineJoin = 'round'; ICON[k](c, w / 2, h * 0.3, 74); c.shadowBlur = 0;
      c.textAlign = 'center'; c.fillStyle = '#ffffff'; c.font = '500 72px Montserrat, sans-serif'; c.fillText(p.name, w / 2, h * 0.62);
      c.fillStyle = 'rgba(235,242,255,.85)'; c.font = '400 46px Montserrat, sans-serif'; c.fillText(p.priceLabel, w / 2, h * 0.75);
    });
    const x = (i - 1.5) * 1.95, z = 2.4 - Math.abs(i - 1.5) * 0.55;
    tag.position.set(x, 1.75, z); tag.rotation.y = -(i - 1.5) * 0.16; lab.add(tag);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.2, 0.4), new THREE.MeshBasicMaterial({ visible: false })); tag.add(hit);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.1), new THREE.MeshBasicMaterial({ map: GLOW(), color: new THREE.Color(PALETTE.teal).multiplyScalar(0.9), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    glow.position.z = -0.12; tag.add(glow); tag.userData.glow = glow;
    cards[k] = { tag, hit, base: tag.position.clone() };
  });
  return cards;
}

// ---------- razzo DEPLOY WEBSITES e torre di lancio ----------
export function buildRocket(lab, mats, mobile) {
  const R = new THREE.Group(); R.position.copy(ROCKET_AT); lab.add(R);
  const padSide = new THREE.MeshStandardMaterial({ color: 0x5a5d63, roughness: 0.85, metalness: 0.1 }), padTop = new THREE.MeshStandardMaterial({ map: photoTex('pad', mobile), roughness: 0.9, metalness: 0.05, color: 0xd6d8dc });
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.6, 1.2, 96), [padSide, padTop, padSide]); pad.position.y = -0.1; pad.receiveShadow = true; R.add(pad);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5.4, 0.05, 8, 128), new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.azure).multiplyScalar(2), toneMapped: false })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.52; R.add(ring);
  // torre a traliccio
  const tw = new THREE.Group(); tw.position.set(-3.2, 0.5, 0); R.add(tw); const tg = [];
  for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) { const b = new THREE.BoxGeometry(0.12, 14, 0.12); b.translate(x, 7, z); tg.push(b); }
  for (let y = 1; y < 14; y += 1.4) { for (const [ax, az, len, rot] of [[0, -0.6, 1.2, 0], [0, 0.6, 1.2, 0], [-0.6, 0, 1.2, Math.PI / 2], [0.6, 0, 1.2, Math.PI / 2]]) { const b = new THREE.BoxGeometry(len, 0.06, 0.06); b.rotateY(rot); b.translate(ax, y, az); tg.push(b); } const d = new THREE.BoxGeometry(1.6, 0.05, 0.05); d.rotateZ(0.9); d.translate(0, y + 0.7, -0.6); tg.push(d); }
  for (const y of [5, 9.5]) { const a = new THREE.BoxGeometry(2.4, 0.1, 0.1); a.translate(1.6, y, 0); tg.push(a); }
  tw.add(new THREE.Mesh(mergeGeometries(tg), mats.frame));
  // il razzo
  const rocket = new THREE.Group(); rocket.position.y = 0.5; R.add(rocket);
  const hullImg = new Image(); hullImg.src = `assets/tex/hull${mobile ? '-m' : ''}.jpg`;
  const drawHull = (c, w, h) => {
    c.fillStyle = '#eef1f5'; c.fillRect(0, 0, w, h);
    if (hullImg.complete && hullImg.naturalWidth) {
      // pannelli in tessere quasi quadrate; la fuliggine solo nell'ultima fila in basso
      const tw = w / 2, th = h / 4, sw = hullImg.naturalWidth, sh = hullImg.naturalHeight;
      for (let r = 0; r < 4; r++) for (let q = 0; q < 2; q++) { const last = r === 3; c.drawImage(hullImg, 0, last ? 0 : 0, sw, last ? sh : sh * 0.74, q * tw, r * th, tw, th); }
    }
    const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, PALETTE.blue); g.addColorStop(1, PALETTE.teal); c.fillStyle = g; c.fillRect(0, h * 0.9, w, 40); c.fillRect(0, h * 0.345, w, 16);
    c.save(); c.translate(w * 0.25, h * 0.655); c.rotate(-Math.PI / 2); c.font = '600 72px Montserrat, sans-serif'; c.letterSpacing = '16px'; c.fillStyle = '#16203b'; c.textAlign = 'center'; c.fillText('DEPLOY WEBSITES', 0, 36); c.restore();
    // la V del logo (stessa sagoma, in scala) sopra la scritta
    const vs = 0.08, ox = w * 0.25 - 845 * vs, oy = h * 0.37 - 278 * vs; const vg = c.createLinearGradient(ox, 0, ox + 1690 * vs, 0); vg.addColorStop(0, PALETTE.blue); vg.addColorStop(0.5, PALETTE.azure); vg.addColorStop(1, PALETTE.teal);
    c.fillStyle = vg; c.beginPath(); [[65, 278], [497, 278], [845, 1180], [1193, 278], [1625, 278], [1029, 1822], [662, 1822]].forEach(([x, y], i) => (i ? c.lineTo(ox + x * vs, oy + y * vs) : c.moveTo(ox + x * vs, oy + y * vs))); c.closePath(); c.fill();
  };
  const tex = canvasTex(1024, 2048, drawHull);
  hullImg.onload = () => { drawHull(tex.image.getContext('2d'), 1024, 2048); tex.needsUpdate = true; };
  const prof = [[0, 0], [0.62, 0], [0.7, 0.4], [0.7, 6.2], [0.6, 7.2], [0.4, 8.1], [0.16, 8.8], [0, 9.0]].map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 96), new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.25, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.1 })); body.position.y = 1.2; body.castShadow = true; rocket.add(body);
  const win = new THREE.Mesh(new THREE.TorusGeometry(0.71, 0.06, 10, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.azure).multiplyScalar(1.8), toneMapped: false })); win.rotation.x = Math.PI / 2; win.position.y = 7.6; rocket.add(win);
  for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2, f = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.9, 1.0), new THREE.MeshStandardMaterial({ color: i % 2 ? PALETTE.blue : PALETTE.teal, roughness: 0.4 })); f.position.set(Math.cos(a) * 0.8, 2.2, Math.sin(a) * 0.8); f.rotation.y = -a; rocket.add(f); }
  const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.55, 0.6, 32, 1, true), mats.frame); noz.position.y = 0.95; rocket.add(noz);
  // fiamma e luce del motore
  const flameMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { t: { value: 0 }, k: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform float t;uniform float k;varying vec2 vUv;void main(){float y=vUv.y;float n=sin(y*40.-t*30.)*.06+sin(y*13.+t*17.)*.05;float core=smoothstep(.0,.9,y)*(1.-abs(vUv.x-.5)*2.);vec3 c=mix(vec3(.45,.75,1.),vec3(1.,.97,.9),pow(y,3.));gl_FragColor=vec4(c*1.8,clamp(core+n,0.,1.)*k*pow(y,.6));}' });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.62, 9, 32, 1, true), flameMat); flame.rotation.x = Math.PI; flame.position.y = -3.8; rocket.add(flame);
  // fari della rampa, come nelle basi di lancio vere: illuminano lo scafo di notte
  for (const [x, z, c] of [[-9, 11, 0xfff2dd], [10, 9, 0xdfefff]]) { const f = new THREE.SpotLight(c, 260, 45, 0.42, 0.7, 1.6); f.position.set(x, 13, z); f.target.position.set(0, 5, 0); R.add(f, f.target); }
  const engineLight = new THREE.PointLight(0x9fd0ff, 0, 60, 2); engineLight.position.y = -0.5; rocket.add(engineLight);
  // fumo
  const smokeTex = canvasTex(128, 128, (c) => { const g = c.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, 'rgba(225,228,236,.85)'); g.addColorStop(1, 'rgba(225,228,236,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); });
  const smoke = []; for (let i = 0; i < (mobile ? 40 : 90); i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, opacity: 0, depthWrite: false, color: 0xd8dde6 })); s.position.set(0, 0.8, 0); R.add(s); smoke.push({ s, a: rnd(i) * Math.PI * 2, v: 0.5 + rnd(i + 1) * 1.3, d: rnd(i + 2) * 0.8 }); }
  return { group: R, rocket, flameMat, engineLight, smoke };
}

export { vShape, buildV, buildTunnel };
