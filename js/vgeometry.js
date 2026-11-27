// La V di Vitralia: UNA sola geometria, ricostruita dal file del logo
// (assets/references/vitralia-logo-v.jpg, 1701 x 1919 px) e riusata per logo 3D, tunnel e architettura.
import * as THREE from 'three';
import { mergeGeometries } from './vendor/jsm/utils/BufferGeometryUtils.js';
import { logoGradient, C } from './palette.js';

// Contorni misurati sul logo originale, in pixel del file.
export const V_OUTER = [[65, 278], [497, 278], [845, 1180], [1193, 278], [1625, 278], [1029, 1822], [662, 1822]];
export const V_LAYER = [[220, 470], [1470, 470], [962, 1745], [703, 1745]];          // trapezio degli strati interni
export const V_LAYER_SCALES = [1, 0.816, 0.669, 0.544, 0.444, 0.363, 0.295, 0.241];   // progressione degli strati nel logo
export const V_CORE_SCALE = 0.194;                                                    // centro scuro
export const V_DARK = [0.03, 0.06, 0.1, 0.15, 0.25, 0.4, 0.6, 0.8];                    // quanto si scurisce ogni strato verso il centro
// Punto di ingresso del tunnel: appena sopra la punta interna della V, dove i due lati convergono.
export const V_ENTRY = [845, 1150];
// Centro di convergenza degli strati nel logo.
const V_ANCHOR = [845, 1271];
export const PX = 1 / 154.4;      // 1544 px di altezza = 10 unità

// pixel del logo -> unità 3D, con origine nel punto di ingresso (y verso l'alto)
export const toUnits = ([x, y]) => [(x - V_ENTRY[0]) * PX, -(y - V_ENTRY[1]) * PX];
const scaled = (pts, s) => pts.map(([x, y]) => [V_ANCHOR[0] + (x - V_ANCHOR[0]) * s, V_ANCHOR[1] + (y - V_ANCHOR[1]) * s]);

function ccw(pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; a += x1 * y2 - x2 * y1; } return a > 0 ? pts : [...pts].reverse(); }
// contorno spostato verso l'interno di d (intersezione delle rette dei lati spostati)
export function inset(pts, d) {
  pts = ccw(pts); const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    const e1 = [p1[0] - p0[0], p1[1] - p0[1]], e2 = [p2[0] - p1[0], p2[1] - p1[1]];
    const l1 = Math.hypot(...e1), l2 = Math.hypot(...e2);
    const n1 = [-e1[1] / l1, e1[0] / l1], n2 = [-e2[1] / l2, e2[0] / l2];
    const a = [p0[0] + n1[0] * d, p0[1] + n1[1] * d], b = [p1[0] + n2[0] * d, p1[1] + n2[1] * d];
    const den = e1[0] * e2[1] - e1[1] * e2[0];
    if (Math.abs(den) < 1e-9) { out.push([p1[0] + n1[0] * d, p1[1] + n1[1] * d]); continue; }
    const t = ((b[0] - a[0]) * e2[1] - (b[1] - a[1]) * e2[0]) / den;
    out.push([a[0] + e1[0] * t, a[1] + e1[1] * t]);
  }
  return out;
}
const shapeOf = (pts) => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); s.closePath(); return s; };

// tubo lungo un contorno, colorato con il gradiente del logo da sinistra (blu) a destra (verde acqua)
function edgeTube(pts, r, z, xMin, xMax, closed = true) {
  const path = new THREE.CurvePath();
  for (let i = 0; i < (closed ? pts.length : pts.length - 1); i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; path.add(new THREE.LineCurve3(new THREE.Vector3(a[0], a[1], z), new THREE.Vector3(b[0], b[1], z))); }
  const g = new THREE.TubeGeometry(path, pts.length * 20, r, 8, closed);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { const c = logoGradient((pos.getX(i) - xMin) / (xMax - xMin)); col.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/**
 * Costruisce la V.
 *  opts.glass     materiale vetro per il corpo della V
 *  opts.depth     distanza a cui il logo si legge identico (gli strati vengono messi in profondità con la prospettiva)
 *  opts.tunnel    numero di cornici extra che proseguono oltre il logo (0 = solo logo)
 *  opts.spacing   distanza tra le cornici del tunnel
 *  opts.scale     scala generale
 */
export function buildV({ glass, depth = 14, tunnel = 0, spacing = 8, scale = 1, edgeR = 0.045, coreMat } = {}) {
  const g = new THREE.Group(); g.name = 'VitraliaV';
  const outer = V_OUTER.map(toUnits), xs = outer.map((p) => p[0]), xMin = Math.min(...xs), xMax = Math.max(...xs);
  const edgeMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });

  // corpo esterno: vetro spesso con bordi smussati
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(shapeOf(outer), { depth: 0.42, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 4, curveSegments: 1 }), glass);
  body.position.z = -0.21; body.name = 'VBody'; g.add(body);
  const tubes = [edgeTube(outer, edgeR * 2.2, 0.28, xMin, xMax), edgeTube(outer, edgeR * 1.4, -0.26, xMin, xMax)];

  // strati interni: stessa sagoma, messi in profondità in modo che dalla distanza "depth" ricompongano il logo
  const layerZ = (s) => -depth * (1 / s - 1) - 0.4;
  const fills = [];
  V_LAYER_SCALES.forEach((s, i) => {
    const clip = layerClipped(s), pts = clip.fill.map(toUnits); // stessa dimensione fisica: è la prospettiva a rimpicciolirli
    const z = layerZ(s);
    tubes.push(edgeTube(clip.edge.map(toUnits), edgeR * (1.1 + i * 0.12), z, xMin, xMax, false));
    const f = new THREE.Mesh(new THREE.ShapeGeometry(shapeOf(pts)), new THREE.MeshBasicMaterial({ color: C.navy, transparent: true, opacity: V_DARK[i], depthWrite: false, side: THREE.DoubleSide }));
    f.position.z = z; f.renderOrder = 2; f.userData.baseOpacity = V_DARK[i]; fills.push(f); g.add(f);
  });
  // centro scuro: la sagoma della V in piccolo, nel fondo
  const coreZ = layerZ(V_CORE_SCALE * 1.24);
  const core = new THREE.Mesh(new THREE.ShapeGeometry(shapeOf(outer)), coreMat || new THREE.MeshBasicMaterial({ color: C.navy, transparent: true, opacity: 0.92, depthWrite: false, side: THREE.DoubleSide }));
  core.position.z = coreZ; g.add(core);
  tubes.push(edgeTube(outer, edgeR * 2.5, coreZ, xMin, xMax));

  // il tunnel prosegue con cornici identiche
  const frames = [];
  for (let i = 1; i <= tunnel; i++) {
    const pts = V_LAYER.map(toUnits), z = coreZ - i * spacing;
    tubes.push(edgeTube(pts, edgeR * 3, z, xMin, xMax));
    frames.push(z);
  }
  const edges = new THREE.Mesh(mergeGeometries(tubes), edgeMat); edges.name = 'VEdges'; g.add(edges);
  g.scale.setScalar(scale);
  g.userData = { body, fills, core, coreZ, frames, length: -coreZ + tunnel * spacing, xMin, xMax };
  return g;
}

// Nel logo gli strati esistono solo dentro la V: tra i due bracci (la tacca) non ci sono.
// Lo strato è disegnato in grandezza piena e rimpicciolito dalla prospettiva di un fattore s,
// quindi nel suo piano la tacca va ingrandita di 1/s attorno al centro di convergenza.
const NOTCH = [[497, 278], [845, 1180], [1193, 278]];
function layerClipped(s) {
  const [TL, TR, BR, BL] = V_LAYER, n = NOTCH.map(([x, y]) => [V_ANCHOR[0] + (x - V_ANCHOR[0]) / s, V_ANCHOR[1] + (y - V_ANCHOR[1]) / s]);
  const tip = n[1], yTop = TL[1];
  if (tip[1] <= yTop) return { fill: V_LAYER, edge: [...V_LAYER, TL] };
  const at = (a, b) => [a[0] + (b[0] - a[0]) * ((yTop - a[1]) / (b[1] - a[1])), yTop];
  const A = at(n[0], tip), B = at(n[2], tip);
  return { fill: [TL, A, tip, B, TR, BR, BL], edge: [A, TL, BL, BR, TR, B] };
}

// Solo la sagoma piatta della V (per insegne e dettagli architettonici), stessa geometria.
export function vShape() { return shapeOf(V_OUTER.map(toUnits)); }

// Il tunnel: le stesse cornici degli strati della V, disposte lungo una curva (CatmullRom) e orientate sulla tangente.
export function buildTunnel(curve, { count = 60, edgeR = 0.13, from = 0.0, to = 1.0 } = {}) {
  const pts = V_LAYER.map(toUnits), outer = V_OUTER.map(toUnits), xs = outer.map((p) => p[0]), xMin = Math.min(...xs), xMax = Math.max(...xs);
  const geos = [], up = new THREE.Vector3(0, 1, 0), m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const glassGeos = [];
  for (let i = 0; i < count; i++) {
    const u = from + (to - from) * (i / (count - 1));
    const p = curve.getPointAt(u), t = curve.getTangentAt(u).normalize();
    // orientamento: -z della cornice lungo la tangente, il "su" resta il più vicino possibile al su del mondo
    const z = t.clone().negate(), x = new THREE.Vector3().crossVectors(up, z).normalize(), y = new THREE.Vector3().crossVectors(z, x);
    m.makeBasis(x, y, z).setPosition(p);
    const fade = Math.min(1, (count - 1 - i) / (count * 0.3)), taper = 0.12 + 0.88 * fade * fade * (3 - 2 * fade); // all'uscita le cornici si assottigliano fino a sparire
    const g = edgeTube(pts, edgeR * (1 + 0.35 * Math.sin(i * 0.9)) * taper, 0, xMin, xMax); g.applyMatrix4(m); geos.push(g);
    // sottili lastre di vetro ai lati, come nello storyboard: il tunnel ha pareti, non solo anelli
    if (i % 2 === 0 && i < count * 0.8) {
      const band = new THREE.ShapeGeometry(shapeOf(pts));
      const ring = new THREE.ShapeGeometry((() => { const s = shapeOf(pts); s.holes.push(new THREE.Path(inset(pts, 0.55).map(([a, b]) => new THREE.Vector2(a, b)))); return s; })());
      ring.applyMatrix4(m); glassGeos.push(ring); band.dispose();
    }
  }
  const edges = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
  const glass = new THREE.Mesh(mergeGeometries(glassGeos), new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  const g = new THREE.Group(); g.add(glass, edges); g.name = 'VTunnel';
  return g;
}
