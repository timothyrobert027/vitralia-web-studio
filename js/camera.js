// Camera cinematografica: una sola camera, movimenti su curve Catmull-Rom, sguardo interpolato con quaternioni.
import * as THREE from 'three';

export const pose = (p, t, fov = 42) => ({ p: new THREE.Vector3(...p), t: new THREE.Vector3(...t), fov });
const easeIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeSoft = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

export class CameraRig {
  constructor(cam) { this.cam = cam; this.move = null; this.look = new THREE.Vector3(); this.breath = 1; this.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; }
  set(p) { this.cam.position.copy(p.p); this.look.copy(p.t); this.cam.fov = p.fov; this.cam.updateProjectionMatrix(); this.cam.lookAt(this.look); this.at = p; }
  // vola da dove sei a "to", passando per i punti "via" (curva continua); lo sguardo passa da un target all'altro
  fly(to, { dur = 2.4, via = [], ease = easeIO, lookVia = null, onDone } = {}) {
    if (this.reduce) dur *= 0.45;
    const pts = [this.cam.position.clone(), ...via.map((v) => v.clone()), to.p.clone()];
    if (pts.length === 2) pts.splice(1, 0, pts[0].clone().lerp(pts[1], 0.5));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
    const looks = [this.look.clone(), ...(lookVia || []), to.t.clone()];
    const lookCurve = looks.length > 2 ? new THREE.CatmullRomCurve3(looks, false, 'centripetal') : null;
    this.move = { curve, lookCurve, from: { t: this.look.clone(), fov: this.cam.fov }, to, dur, t0: performance.now() / 1000, ease, onDone };
  }
  // percorso lungo una curva data (il viaggio iniziale), con lo sguardo che guarda avanti lungo la curva
  path(curve, { dur, lookAhead = 0.035, endPose, blendFrom = 0.82, speed = (x) => x, onDone, onProgress } = {}) {
    if (this.reduce) dur *= 0.6;
    this.move = { pathCurve: curve, dur, lookAhead, endPose, blendFrom, speed, t0: performance.now() / 1000, onDone, onProgress, from: { fov: this.cam.fov } };
  }
  update(now) {
    const m = this.move;
    if (m) {
      let k = Math.min(1, (now - m.t0) / m.dur);
      if (m.pathCurve) {
        const u = m.speed(k), p = m.pathCurve.getPointAt(u), ahead = m.pathCurve.getPointAt(Math.min(1, u + m.lookAhead));
        if (u + m.lookAhead > 1) ahead.add(m.pathCurve.getTangentAt(1).multiplyScalar((u + m.lookAhead - 1) * m.pathCurve.getLength()));
        this.cam.position.copy(p);
        const b = m.endPose ? easeSoft(Math.max(0, (u - m.blendFrom) / (1 - m.blendFrom))) : 0;
        this.look.copy(ahead).lerp(m.endPose ? m.endPose.t : ahead, b);
        if (m.endPose) { this.cam.fov = m.from.fov + (m.endPose.fov - m.from.fov) * b; this.cam.updateProjectionMatrix(); }
        m.onProgress && m.onProgress(u);
      } else {
        const e = m.ease(k); this.cam.position.copy(m.curve.getPointAt(e));
        if (m.lookCurve) this.look.copy(m.lookCurve.getPointAt(easeSoft(k))); else this.look.copy(m.from.t).lerp(m.to.t, easeSoft(Math.min(1, k * 1.08)));
        this.cam.fov = m.from.fov + (m.to.fov - m.from.fov) * e; this.cam.updateProjectionMatrix();
      }
      if (k >= 1) { this.move = null; if (m.to) this.at = m.to; else if (m.endPose) this.at = m.endPose; m.onDone && m.onDone(); }
    }
    // respiro: un operatore che tiene la camera a mano, impercettibile, solo da fermi
    const br = this.move || this.reduce ? 0 : this.breath;
    this.cam.lookAt(this.look.x + Math.sin(now * 0.31) * 0.03 * br, this.look.y + Math.cos(now * 0.23) * 0.02 * br, this.look.z);
  }
  get busy() { return !!this.move; }
}
