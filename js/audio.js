// Audio opzionale, sintetizzato (nessun file, nessun brano con licenza). Parte solo quando il visitatore lo accende.
export class Sound {
  constructor() { this.on = false; this.ctx = null; }
  toggle() { this.on = !this.on; if (this.on) this.start(); else this.stop(); return this.on; }
  start() {
    if (!this.ctx) { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.master = this.ctx.createGain(); this.master.gain.value = 0; this.master.connect(this.ctx.destination); this.pad(); }
    this.ctx.resume(); this.master.gain.setTargetAtTime(0.5, this.ctx.currentTime, 0.6);
  }
  stop() { if (this.ctx) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3); }
  pad() { // ambiente spaziale: accordo lento e filtrato
    const c = this.ctx, f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.connect(this.master);
    [55, 82.4, 110, 164.8, 220].forEach((hz, i) => { const o = c.createOscillator(), g = c.createGain(); o.type = i % 2 ? 'sine' : 'triangle'; o.frequency.value = hz; o.detune.value = (i - 2) * 4; g.gain.value = 0.035 / (i + 1); const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 0.05 + i * 0.02; lg.gain.value = 0.02 / (i + 1); l.connect(lg); lg.connect(g.gain); l.start(); o.connect(g); g.connect(f); o.start(); });
  }
  noise(dur, from, to, gain = 0.25) { // soffio filtrato: tunnel, passaggi, motore
    if (!this.on || !this.ctx) return; const c = this.ctx, n = c.sampleRate * dur, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = b; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8; f.frequency.setValueAtTime(from, c.currentTime); f.frequency.exponentialRampToValueAtTime(to, c.currentTime + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0, c.currentTime); g.gain.linearRampToValueAtTime(gain, c.currentTime + dur * 0.3); g.gain.linearRampToValueAtTime(0, c.currentTime + dur); s.connect(f); f.connect(g); g.connect(this.master); s.start();
  }
  chime(hz = 880) { if (!this.on || !this.ctx) return; const c = this.ctx; [hz, hz * 1.5].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = f; g.gain.setValueAtTime(0, c.currentTime + i * 0.06); g.gain.linearRampToValueAtTime(0.06, c.currentTime + i * 0.06 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 1.4); o.connect(g); g.connect(this.master); o.start(); o.stop(c.currentTime + 1.5); }); }
  tunnel() { this.noise(5, 300, 4000, 0.18); }
  whoosh() { this.noise(1.2, 400, 2500, 0.12); }
  engine() { this.noise(7, 60, 900, 0.45); }
}
