// Tiny procedural kitchen sounds through the Web Audio API: no files, no network, nothing that
// the hosted site's content policy blocks. The context is created on the first real gesture so
// browsers allow it; every note is a short oscillator burst with an exponential fade.

export function createAudio() {
  let context = null;

  function ensure() {
    if (context === null) {
      const Audio = window.AudioContext ?? window.webkitAudioContext;
      if (!Audio) return null;
      try {
        context = new Audio();
      } catch {
        return null;
      }
    }
    if (context.state === 'suspended') context.resume().catch(() => {});
    return context;
  }

  function note(frequency, duration, type, volume, slideTo) {
    const ctx = ensure();
    if (ctx === null) return;
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  return {
    unlock() {
      ensure();
    },
    pick() {
      note(520, 0.07, 'triangle', 0.05, 660);
    },
    chop() {
      note(220, 0.06, 'square', 0.035, 140);
      window.setTimeout(() => note(300, 0.05, 'square', 0.025, 180), 70);
    },
    cook() {
      note(160, 0.18, 'sawtooth', 0.025, 240);
    },
    plate() {
      note(440, 0.09, 'triangle', 0.045, 330);
    },
    serve() {
      note(660, 0.09, 'triangle', 0.055, 880);
      window.setTimeout(() => note(990, 0.12, 'triangle', 0.045, 1320), 80);
    },
    miss() {
      note(300, 0.18, 'sawtooth', 0.045, 120);
    },
    start() {
      note(392, 0.1, 'triangle', 0.05, 523);
      window.setTimeout(() => note(784, 0.14, 'triangle', 0.045, 784), 90);
    },
    over() {
      note(330, 0.22, 'sawtooth', 0.05, 220);
      window.setTimeout(() => note(196, 0.3, 'sawtooth', 0.04, 98), 180);
    },
  };
}
