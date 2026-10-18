// The loading seed: a head that sweeps along a curved path and lands at the
// seed's spot, shedding tiny stars as it goes. Loops until land() is called,
// then calls back as soon as the head has arrived.

const TRAVEL = 1.25;
const CYCLE = 1.7;

export function createShootingStar(preloader, reduced) {
  const dot = preloader.querySelector('i');
  if (reduced) return { setTarget() {}, land: (cb) => cb() };

  const canvas = document.createElement('canvas');
  preloader.insertBefore(canvas, dot);
  const ctx = canvas.getContext('2d');
  let dpr = 1;
  const fit = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
  };
  fit();
  addEventListener('resize', fit);

  const rest = dot.getBoundingClientRect();
  let target = { x: rest.left + rest.width / 2, y: rest.top + rest.height / 2 };
  let landCb = null;
  let landed = false;
  let start = performance.now();
  let last = start;
  const dust = [];
  let prev = null;

  // Cubic Bézier that sweeps right along the top from the top-left corner, then
  // bends down into the seed. One smooth bow, no loop.
  function pathAt(u) {
    const v = 1 - u;
    const p0 = [-30, -30];
    const p1 = [target.x * 0.85, target.y * 0.05];
    const p2 = [target.x * 1.08, target.y * 0.45];
    const p3 = [target.x, target.y];
    const k0 = v * v * v, k1 = 3 * v * v * u, k2 = 3 * v * u * u, k3 = u * u * u;
    return [k0 * p0[0] + k1 * p1[0] + k2 * p2[0] + k3 * p3[0], k0 * p0[1] + k1 * p1[1] + k2 * p2[1] + k3 * p3[1]];
  }

  // The head moves tens of pixels per frame, so dust is laid along the whole
  // segment it crossed since the last frame. Spawning only at the head leaves gaps.
  function spawnAlong(x0, y0, x1, y1) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.min(120, Math.ceil(dist / 2.5));
    for (let i = 1; i <= n; i++) {
      const f = i / n;
      const x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f;
      const a = Math.random() * Math.PI * 2;
      const drift = 4 + Math.random() * 14;
      dust.push({
        x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 6,
        vx: Math.cos(a) * drift, vy: Math.sin(a) * drift + 3,
        size: 0.5 + Math.random() * 1.3, life: 0, max: 0.8 + Math.random() * 0.9,
        warm: Math.random() < 0.3, tw: Math.random() * 6,
      });
    }
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - start) / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);

    if (!landed) {
      const u = Math.min(1, t / TRAVEL);
      const e = 1 - (1 - u) ** 2.6;
      const [x, y] = pathAt(e);
      dot.style.transform = `translate(${x - target.x}px, ${y - target.y}px)`;
      if (prev && u > 0) spawnAlong(prev[0], prev[1], x, y);
      prev = [x, y];
      if (u >= 1 && landCb) {
        landed = true;
        dot.style.transform = '';
        landCb();
        landCb = null;
      } else if (t >= CYCLE) {
        start = now;
        prev = null;
      }
    }

    ctx.globalCompositeOperation = 'lighter';
    for (let i = dust.length - 1; i >= 0; i--) {
      const d = dust[i];
      d.life += dt;
      if (d.life >= d.max) { dust.splice(i, 1); continue; }
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      const fade = 1 - d.life / d.max;
      const twinkle = 0.6 + 0.4 * Math.sin(d.life * 14 + d.tw);
      ctx.globalAlpha = fade * fade * twinkle;
      ctx.fillStyle = d.warm ? '#ccfbf1' : '#5eead4';
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.size * (0.5 + fade * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (!(landed && dust.length === 0 && document.body.classList.contains('is-ready'))) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);

  return {
    setTarget(x, y) { target = { x, y }; },
    land(cb) { landCb = cb; },
  };
}
