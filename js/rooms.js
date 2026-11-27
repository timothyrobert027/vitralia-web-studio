// Le sale del laboratorio: in ogni reparto c'è una postazione di vetro dove si prepara un pezzo del sito.
// Quando il cliente accende una funzionalità, il pezzo parte dalle scrivanie della sala e vola al suo posto.
// Alla fine tutti i pezzi scelti volano nell'atrio e compongono il sito.
import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/jsm/geometries/RoundedBoxGeometry.js';
import { DEPTS, canvasTex } from './world.js';
import { PALETTE } from './palette.js';
import { ICON } from './configurator.js';

export const ROOMS = {
  start: { name: 'Sala Fondamenta', sub: 'Le basi del tuo sito' },
  business: { name: 'Sala Visibilità', sub: 'Farti trovare e scegliere' },
  premium: { name: 'Sala Espansione', sub: 'Vendere, incassare, parlare più lingue' },
  custom: { name: 'Sala Su misura', sub: 'Quello che ancora non esiste' },
};
export const ROOM_ORDER = ['start', 'business', 'premium', 'custom'];

const rad = (d) => (d * Math.PI) / 180;
const polar = (r, deg, y = 0) => new THREE.Vector3(r * Math.cos(rad(deg)), y, r * Math.sin(rad(deg)));
const midOf = (k) => (DEPTS[k].phi[0] + DEPTS[k].phi[1]) / 2;
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const TW = 1.5, TH = 0.74;

// icona SVG -> immagine, disegnata sul canvas quando è pronta
function iconImg(id, color) {
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICON[id] || ICON.pages}</svg>`);
  return img;
}
function tileTexture(f, on) {
  const col = on ? '#3fe0cc' : 'rgba(200,220,245,.55)';
  const img = iconImg(f.id, on ? '#7ff0e0' : '#9fb4d0');
  const tex = canvasTex(512, 252, (c, w, h) => draw(c, w, h));
  function draw(c, w, h) {
    c.clearRect(0, 0, w, h);
    c.fillStyle = on ? 'rgba(14,60,70,.82)' : 'rgba(18,28,50,.55)'; c.beginPath(); c.roundRect(6, 6, w - 12, h - 12, 34); c.fill();
    c.lineWidth = on ? 5 : 3; c.strokeStyle = col; if (!on) c.setLineDash([14, 10]); c.shadowColor = '#3fe0cc'; c.shadowBlur = on ? 24 : 0; c.beginPath(); c.roundRect(6, 6, w - 12, h - 12, 34); c.stroke(); c.setLineDash([]); c.shadowBlur = 0;
    if (img.complete && img.naturalWidth) c.drawImage(img, 34, h / 2 - 48, 96, 96);
    c.fillStyle = on ? '#ffffff' : 'rgba(225,235,250,.7)'; c.font = '500 44px Montserrat, sans-serif'; c.textBaseline = 'middle';
    const words = f.label.split(' '); let l1 = f.label, l2 = '';
    if (c.measureText(f.label).width > 330) { let i = words.length - 1; while (i > 0 && c.measureText(words.slice(0, i).join(' ')).width > 330) i--; l1 = words.slice(0, i).join(' '); l2 = words.slice(i).join(' '); }
    if (l2) { c.fillText(l1, 150, h / 2 - 24); c.fillText(l2, 150, h / 2 + 26); } else c.fillText(l1, 150, h / 2);
  }
  img.onload = () => { const c = tex.image.getContext('2d'); draw(c, tex.image.width, tex.image.height); tex.needsUpdate = true; };
  return tex;
}

export function buildRooms({ lab, mats, features, seats, mobile }) {
  const stations = {}, tiles = {}, flights = [];
  const glowMat = (o) => new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.teal).multiplyScalar(2.2), transparent: true, opacity: o, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending });
  // vetro delle postazioni: meno speculare, così le luci del laboratorio non coprono i titoli
  const slabMat = mats.cardGlass.clone(); slabMat.clearcoat = 0; slabMat.specularIntensity = 0.12; slabMat.envMapIntensity = 0.6;
  for (const k of ROOM_ORDER) {
    const mid = midOf(k), g = new THREE.Group(), pos = polar(6.9, mid, 0.31);
    g.position.copy(pos); g.rotation.y = Math.atan2(-pos.x, -pos.z); lab.add(g);
    // pedana con anello di luce, lastra di vetro, titolo della sala
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, 0.12, 64), mats.frame); base.position.y = 0.06; g.add(base);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.025, 8, 96), glowMat(0.9)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.13; g.add(ring);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.75, 12), mats.frame); pole.position.y = 0.5; g.add(pole);
    const slab = new THREE.Mesh(new RoundedBoxGeometry(3.6, 2.45, 0.06, 4, 0.16), slabMat); slab.position.y = 2.05; g.add(slab);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new RoundedBoxGeometry(3.6, 2.45, 0.06, 2, 0.16), 30), new THREE.LineBasicMaterial({ color: 0x7ff0e0, transparent: true, opacity: 0.55 })); edge.position.copy(slab.position); g.add(edge);
    const title = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 0.52), new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false, depthWrite: false, map: canvasTex(1024, 162, (c, w, h) => {
      c.textBaseline = 'middle'; c.font = '500 56px Montserrat, sans-serif'; c.fillStyle = '#ffffff'; c.letterSpacing = '6px'; c.fillText(ROOMS[k].name.toUpperCase(), 10, 52);
      c.letterSpacing = '0px'; c.font = '400 36px Montserrat, sans-serif'; c.fillStyle = 'rgba(160,240,230,.9)'; c.fillText(ROOMS[k].sub, 12, 118);
    }) }));
    title.position.set(0, 2.92, 0.05); g.add(title);
    const halo = { intensity: 0 };
    // i pezzi della sala: spenti sono contorni tratteggiati, accesi brillano
    const list = features.filter((f) => f.pkg === k), slots = [];
    list.forEach((f, i) => {
      const col = i % 2, row = Math.floor(i / 2), rows = Math.ceil(list.length / 2), lone = list.length % 2 === 1 && i === list.length - 1;
      const x = lone ? 0 : col ? 0.86 : -0.86, y = 1.72 + ((rows - 1) / 2 - row) * 0.84;
      const slot = new THREE.Vector3(x, y, 0.06);
      const off = new THREE.Mesh(new THREE.PlaneGeometry(TW, TH), new THREE.MeshBasicMaterial({ map: tileTexture(f, false), transparent: true, toneMapped: false, depthWrite: false }));
      off.position.copy(slot); g.add(off);
      const on = new THREE.Mesh(new THREE.PlaneGeometry(TW, TH), new THREE.MeshBasicMaterial({ map: tileTexture(f, true), transparent: true, toneMapped: false, depthWrite: false, opacity: 0 }));
      on.position.copy(slot).add(new THREE.Vector3(0, 0, 0.01)); on.visible = false; g.add(on);
      const hit = new THREE.Mesh(new THREE.PlaneGeometry(TW, TH), new THREE.MeshBasicMaterial({ visible: false })); hit.position.copy(slot); g.add(hit);
      tiles[f.id] = { f, k, g, off, on, hit, slot, state: 0, target: 0 };
      slots.push(slot);
    });
    stations[k] = { g, mid, halo, ring, edge, list };
  }
  // l'assemblaggio finale, nell'atrio
  const asm = new THREE.Group(); asm.position.set(0, 0.31, 2.0); lab.add(asm); asm.visible = false;
  const asmSlab = new THREE.Mesh(new RoundedBoxGeometry(5.4, 3.3, 0.06, 4, 0.22), slabMat); asmSlab.position.y = 2.05; asm.add(asmSlab);
  const asmEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new RoundedBoxGeometry(5.4, 3.3, 0.06, 2, 0.22), 30), new THREE.LineBasicMaterial({ color: 0x7ff0e0, transparent: true, opacity: 0.7 })); asmEdge.position.y = 2.05; asm.add(asmEdge);
  let asmTitleTex = null;
  const asmTitle = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.46), new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false, depthWrite: false })); asmTitle.position.set(0, 3.42, 0.05); asm.add(asmTitle);
  const asmTiles = [];

  const spark = canvasTex(128, 128, (c) => { const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(120,255,235,.6)'); g.addColorStop(1, 'rgba(63,224,204,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); });
  const sparkMat = () => new THREE.SpriteMaterial({ map: spark, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const now = () => performance.now() / 1000;
  const wpos = (obj, v) => obj.localToWorld(v.clone());

  // un pezzo vola da una scrivania della sala al suo posto sulla postazione
  function fly(t, dur) {
    const desks = seats[t.k] || [], d = desks.length ? desks[Math.floor(Math.random() * desks.length)] : null;
    const from = d ? lab.worldToLocal(d.scr.getWorldPosition(new THREE.Vector3())) : lab.worldToLocal(wpos(t.g, new THREE.Vector3(0, 0.5, -2)));
    const to = lab.worldToLocal(wpos(t.g, t.slot));
    const ctrl = from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, 2.2, 0));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(TW, TH), new THREE.MeshBasicMaterial({ map: t.on.material.map, transparent: true, toneMapped: false, depthWrite: false }));
    m.quaternion.copy(t.g.quaternion); lab.add(m);
    const sp = new THREE.Sprite(sparkMat()); sp.scale.setScalar(0.8); lab.add(sp);
    flights.push({ m, sp, from, ctrl, to, t0: now(), dur, done: () => { t.on.visible = true; t.flash = now(); } });
  }
  function set(id, on, silent) {
    const t = tiles[id]; if (!t) return; t.target = on ? 1 : 0;
    if (on && silent) { t.on.visible = true; t.on.material.opacity = 1; return; }
    if (on) { t.on.visible = false; t.on.material.opacity = 0; fly(t, mobile ? 0.8 : 1.0); stations[t.k].pulse = now(); }
  }
  // assemblaggio: i pezzi scelti volano dalle sale all'atrio
  function assemble(ids, name) {
    for (const a of asmTiles) { lab.remove(a.m); }
    asmTiles.length = 0;
    asmTitleTex?.dispose();
    asmTitleTex = canvasTex(1100, 100, (c, w, h) => { c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '500 52px Montserrat, sans-serif'; const g = c.createLinearGradient(w * 0.2, 0, w * 0.8, 0); g.addColorStop(0, '#8fb4ff'); g.addColorStop(1, '#6ff0de'); c.fillStyle = g; c.fillText(`IL SITO DI ${(name || 'LA TUA ATTIVITÀ').toUpperCase()}`, w / 2, h / 2); });
    asmTitle.material.map = asmTitleTex; asmTitle.material.needsUpdate = true;
    asm.visible = true; asm.userData.t0 = now();
    const cols = 4, n = ids.length, rows = Math.ceil(n / cols), sc = 0.72;
    ids.forEach((id, i) => {
      const t = tiles[id]; if (!t) return;
      const r = Math.floor(i / cols), inRow = Math.min(cols, n - r * cols), c = i % cols;
      const x = (c - (inRow - 1) / 2) * 1.22, y = 2.05 + ((rows - 1) / 2 - r) * 0.62;
      const from = lab.worldToLocal(wpos(t.g, t.slot)), to = new THREE.Vector3(x, y + 0.31, 2.06);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(TW * sc, TH * sc), new THREE.MeshBasicMaterial({ map: t.on.material.map, transparent: true, toneMapped: false, depthWrite: false }));
      lab.add(m); m.position.copy(from);
      const sp = new THREE.Sprite(sparkMat()); sp.scale.setScalar(0.7); lab.add(sp);
      const ctrl = from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, 3.2, 0));
      flights.push({ m, sp, from, ctrl, to, t0: now() + 0.12 * i, dur: 1.5, keep: true, qFrom: t.g.quaternion.clone() });
      asmTiles.push({ m });
    });
  }
  function hideAssembly() { asm.visible = false; for (const a of asmTiles) lab.remove(a.m); asmTiles.length = 0; }

  const _q = new THREE.Quaternion();
  function tick(dt, t) {
    for (const s of Object.values(stations)) {
      const p = s.pulse ? Math.max(0, 1 - (t - s.pulse) / 1.2) : 0;
      s.ring.material.opacity = 0.6 + 0.3 * Math.sin(t * 2) + 0.4 * p; s.edge.material.opacity = 0.5 + 0.5 * p;
    }
    for (const x of Object.values(tiles)) {
      if (x.target === 0 && x.on.visible) { x.on.material.opacity -= dt * 3; if (x.on.material.opacity <= 0) x.on.visible = false; }
      if (x.target === 1 && x.on.visible && x.on.material.opacity < 1) x.on.material.opacity = Math.min(1, x.on.material.opacity + dt * 4);
      const fl = x.flash ? t - x.flash : 9; x.on.scale.setScalar(1 + 0.12 * Math.max(0, 1 - fl / 0.5));
      if (x.target === 1 && x.on.visible) x.on.position.z = x.slot.z + 0.01 + Math.sin(t * 1.6 + x.slot.x * 3) * 0.015;
    }
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i], k = (t - f.t0) / f.dur; if (k < 0) { f.m.visible = f.sp.visible = false; continue; }
      f.m.visible = f.sp.visible = true;
      const e = ease(Math.min(1, k)), a = f.from.clone().lerp(f.ctrl, e), b = f.ctrl.clone().lerp(f.to, e), p = a.lerp(b, e);
      f.m.position.copy(p); f.sp.position.copy(p).add(new THREE.Vector3(0, 0, -0.05)); f.sp.material.opacity = 1 - Math.max(0, (k - 0.85) / 0.15);
      f.m.scale.setScalar(0.35 + 0.65 * e);
      if (f.qFrom) f.m.quaternion.copy(_q.copy(f.qFrom).slerp(new THREE.Quaternion(), e));
      if (k >= 1) {
        lab.remove(f.sp); flights.splice(i, 1);
        if (!f.keep) { lab.remove(f.m); f.done?.(); }
      }
    }
    if (asm.visible) { const k = Math.min(1, (t - asm.userData.t0) / 0.8); asmSlab.scale.set(k, k, 1); asmEdge.scale.set(k, k, 1); asmTitle.material.opacity = k; }
  }
  const picks = () => Object.values(tiles).map((x) => ({ obj: x.hit, id: x.f.id }));
  return { stations, tiles, set, assemble, hideAssembly, tick, picks, midOf };
}
