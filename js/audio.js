// Generative ambience. A low drone and a soft noise bed behind a lowpass filter
// that opens as the scene gets brighter, plus a bell for each skill leaf that sprouts.
// Sound defaults to on, but browsers block audio until the first tap or key press,
// so nothing is created before unlock() runs inside one.

const NIGHT_SCALE = [220, 261.6, 293.7, 329.6, 392, 440, 523.3]; // A minor pentatonic
const DAY_SCALE = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3];   // C major pentatonic

export function createAudio({ on = true } = {}) {
  let ctx = null, master, filter, delay, light = 0;

  function build() {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);

    filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 280;
    filter.Q.value = 0.7;
    filter.connect(master);

    [[55, 0.16], [82.4, 0.09], [110.3, 0.05]].forEach(([f, g], i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 2 ? 'triangle' : 'sine';
      osc.frequency.value = f;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + i * 0.03;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 1.5;
      lfo.connect(lfoGain).connect(osc.detune);
      const gain = ctx.createGain();
      gain.gain.value = g;
      osc.connect(gain).connect(filter);
      osc.start();
      lfo.start();
    });

    const noise = ctx.createBufferSource();
    noise.buffer = pinkNoise(ctx, 4);
    noise.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 900;
    band.Q.value = 0.4;
    const ng = ctx.createGain();
    ng.gain.value = 0.035;
    noise.connect(band).connect(ng).connect(filter);
    noise.start();

    delay = ctx.createDelay(1);
    delay.delayTime.value = 0.38;
    const fb = ctx.createGain();
    fb.gain.value = 0.35;
    const wet = ctx.createGain();
    wet.gain.value = 0.3;
    delay.connect(fb).connect(delay);
    delay.connect(wet).connect(master);
  }

  // Returns true once audio is running (or off), so the caller can stop retrying.
  function unlock() {
    if (!on) return true;
    if (!ctx) {
      build();
      master.gain.setTargetAtTime(0.55, ctx.currentTime, 0.4);
    }
    ctx.resume();
    return ctx.state === 'running';
  }

  // While sound is on but still blocked, the press starts it instead of muting it.
  function toggle() {
    if (on && ctx?.state !== 'running') { unlock(); return on; }
    if (!ctx) build();
    on = !on;
    const now = ctx.currentTime;
    if (on) ctx.resume();
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(on ? 0.55 : 0, now, 0.4);
    if (!on) setTimeout(() => { if (!on) ctx.suspend(); }, 1600);
    return on;
  }

  function setLight(l) {
    light = l;
    if (on && ctx) filter.frequency.setTargetAtTime(280 + l * l * 2600, ctx.currentTime, 0.3);
  }

  function chime() {
    if (!on || ctx?.state !== 'running') return;
    const scale = light > 0.5 ? DAY_SCALE : NIGHT_SCALE;
    const f = scale[Math.floor(Math.random() * scale.length)] * (Math.random() < 0.3 ? 2 : 1);
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.07, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
    osc.connect(g);
    g.connect(master);
    g.connect(delay);
    osc.start(now);
    osc.stop(now + 2.5);
  }

  document.addEventListener('visibilitychange', () => {
    if (!ctx || !on) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  return { unlock, toggle, setLight, chime, isOn: () => on };
}

function pinkNoise(ctx, seconds) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12;
  }
  return buf;
}
