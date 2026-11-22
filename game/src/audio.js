// Ember Court — sound, synthesized live with WebAudio. No audio files,
// no network: every effect is a few oscillators shaped in code. The
// context is created on the first user gesture, so it never blocks.

let ctx = null;
let muted = false;

export function ensureAudio() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      ctx = null;
    }
  }
  if (ctx && ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

/** One short tone: frequency, duration, wave shape, volume, slide. */
function tone(freq, dur, type = 'sine', vol = 0.12, slideTo = null, delay = 0) {
  if (muted) return;
  const ac = ensureAudio();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const sfx = {
  click() { tone(660, 0.06, 'triangle', 0.06); },
  deal() { tone(440, 0.09, 'sine', 0.08, 880); },
  playCard() { tone(220, 0.14, 'triangle', 0.14, 440); tone(330, 0.1, 'sine', 0.08, 660, 0.05); },
  attack() { tone(160, 0.16, 'sawtooth', 0.1, 70); },
  hurt() { tone(110, 0.2, 'square', 0.07, 60); },
  combo() { tone(523, 0.1, 'sine', 0.1); tone(659, 0.1, 'sine', 0.1, null, 0.08); tone(784, 0.16, 'sine', 0.12, null, 0.16); },
  win() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.28, 'triangle', 0.12, null, i * 0.11));
    tone(262, 0.6, 'sine', 0.08, null, 0.5);
  },
  lose() {
    [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'sine', 0.1, null, i * 0.14));
  },
};
