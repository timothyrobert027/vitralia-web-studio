// Palette ufficiale, campionata dal logo originale (assets/references).
import * as THREE from 'three';

export const PALETTE = {
  blue: '#2f6bff',   // lato sinistro della V
  azure: '#2392d2',  // transizione centrale
  teal: '#17b8a6',   // lato destro della V
  navy: '#16203b',   // centro scuro della V, profondità
  night: '#04070f',  // sfondo
  white: '#eef4ff',  // testi e luce fredda
};
export const C = Object.fromEntries(Object.entries(PALETTE).map(([k, v]) => [k, new THREE.Color(v)]));

// Gradiente del logo: da blu (t=0) a verde acqua (t=1) passando per l'azzurro.
export function logoGradient(t) {
  t = Math.min(1, Math.max(0, t));
  return t < 0.5 ? C.blue.clone().lerp(C.azure, t * 2) : C.azure.clone().lerp(C.teal, (t - 0.5) * 2);
}
