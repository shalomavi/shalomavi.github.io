// Procedural tree skeleton. Pure data, no three.js: every branch is a polyline
// with a growth window on the 0..1 scroll axis, so the renderer only needs the
// current progress to know how much of each branch exists.

const TRUNK_HEIGHT = 9;
const TRUNK_POINTS = 48;
const LIMB_POINTS = 22;

export function buildSkeleton(scenes, { seed = 7, decorLeaves = 600 } = {}) {
  const rnd = mulberry32(seed);
  const branches = [];
  const leaves = [];
  const fruits = [];

  const trunkScene = scenes.find((s) => s.kind === 'trunk');
  const limbScenes = scenes.filter((s) => s.kind === 'branch');
  const rootScenes = scenes.filter((s) => s.kind === 'root');
  const fruitScenes = scenes.filter((s) => s.kind === 'fruit');

  const trunkWindow = [trunkScene.span[0], limbScenes[limbScenes.length - 1].span[1]];
  const trunk = makeTrunk(rnd, trunkScene.id, trunkWindow);
  branches.push(trunk);

  // Sapling twigs low on the trunk carry the trunk scene's own skills.
  const trunkRange = trunkWindow[1] - trunkWindow[0];
  const saplingTop = (trunkScene.span[1] - trunkWindow[0]) / trunkRange;
  [0.2, 0.45].forEach((f, i) => {
    const t = f * saplingTop;
    const dir = sphericalDir(i === 0 ? 0.3 : Math.PI - 0.3, 0.8, rnd);
    const window = [trunkWindow[0] + t * trunkRange, trunkScene.span[1]];
    growLimb(branches, rnd, trunk, t, dir, 2.1, 0.055, 1, trunkScene.id, 'branch', 2, window);
  });

  rootScenes.forEach((scene, i) => {
    const azimuth = (i / rootScenes.length) * Math.PI * 2 + 0.6;
    const dir = sphericalDir(azimuth, -(0.35 + rnd() * 0.5), rnd);
    // Slightly wider than the trunk base: roots slant away and taper, so they read narrower on screen.
    const root = { id: `root-${scene.id}`, sceneId: scene.id, kind: 'root', depth: 0,
      window: scene.span, ...curvedPath(rnd, [0, 0, 0], dir, 3 + rnd(), trunk.widths[0] * 1.3, 0, 0, 'root') };
    branches.push(root);
    spawnChildren(branches, rnd, root, 2, scene.id, 'root', 2);
  });

  limbScenes.forEach((scene, i) => {
    const count = scene.branches ?? 1;
    for (let k = 0; k < count; k++) {
      const base = (scene.span[0] - trunkWindow[0]) / (trunkWindow[1] - trunkWindow[0]);
      const t = Math.min(0.97, base + 0.04 + k * 0.08);
      const side = (i + k) % 2 === 0 ? 1 : -1;
      const azimuth = side > 0 ? 0.2 + rnd() * 0.5 : Math.PI - 0.2 - rnd() * 0.5;
      const pitch = 0.25 + t * 0.55 + rnd() * 0.15;
      const len = 3.6 + rnd() * 1.4 + (1 - t) * 1.6;
      // Start only once the trunk has reached the attach point, or the limb floats in mid-air.
      const window = [Math.min(trunkWindow[0] + t * (trunkWindow[1] - trunkWindow[0]) + 0.01, scene.span[1] - 0.02), scene.span[1]];
      growLimb(branches, rnd, trunk, t, sphericalDir(azimuth, pitch, rnd), len, 0.085, 1, scene.id, 'branch', 3, window);
    }
  });

  placeLeaves(leaves, rnd, branches, scenes, decorLeaves);

  fruitScenes.forEach((scene, i) => {
    const host = limbScenes[Math.max(0, limbScenes.length - 1 - i)];
    const candidates = branches.filter((b) => b.sceneId === host.id && b.depth === 1);
    const b = candidates[Math.floor(rnd() * candidates.length)] ?? trunk;
    const idx = Math.floor(b.points.length * 0.7);
    fruits.push({ sceneId: scene.id, pos: b.points[idx], flex: b.flex[idx], window: scene.span });
  });

  // The fruit scene's camera is close on the fruit, so its skill leaves move onto grown
  // branch points around it, spread evenly by angle.
  fruits.forEach((fruit) => {
    const own = leaves.filter((l) => l.skill && l.sceneId === fruit.sceneId);
    const near = branches.filter((b) => b.kind === 'branch' && b.depth >= 1)
      .flatMap((b) => b.points.map((pos, i) => ({ pos, flex: b.flex[i], grown: b.window[0] + (i / (b.points.length - 1)) * (b.window[1] - b.window[0]) })))
      .filter((s) => s.grown < fruit.window[0] && Math.hypot(...sub(s.pos, fruit.pos)) > 0.3 && Math.hypot(...sub(s.pos, fruit.pos)) < 1.4)
      .sort((a, b) => Math.atan2(a.pos[1] - fruit.pos[1], a.pos[0] - fruit.pos[0]) - Math.atan2(b.pos[1] - fruit.pos[1], b.pos[0] - fruit.pos[0]));
    if (near.length < own.length) return;
    own.forEach((leaf, i) => {
      const s = near[Math.floor(((i + 0.5) / own.length) * near.length)];
      Object.assign(leaf, { pos: s.pos, flex: s.flex });
    });
  });

  return { branches, leaves, fruits, trunkTop: trunk.points[trunk.points.length - 1] };
}

function makeTrunk(rnd, sceneId, window) {
  const points = [], widths = [], flex = [];
  const phase = rnd() * 6;
  for (let i = 0; i <= TRUNK_POINTS; i++) {
    const t = i / TRUNK_POINTS;
    const y = t * TRUNK_HEIGHT;
    const wander = Math.sin(y * 0.55 + phase) * 0.35 * t + Math.sin(y * 1.7 + phase * 2) * 0.08;
    points.push([wander, y, Math.cos(y * 0.8 + phase) * 0.12 * t]);
    widths.push(0.24 * (1 - t) ** 1.2 + 0.04);
    flex.push(0.22 * t ** 1.6);
  }
  return { id: 'trunk', sceneId, kind: 'trunk', depth: 0, points, widths, flex, window };
}

// Grows a limb off `parent` at parameter t, then its children. Returns the limb.
// Without `window`, the limb starts when the parent's growth reaches t.
function growLimb(branches, rnd, parent, t, dir, len, width, depth, sceneId, kind, maxDepth, window) {
  const idx = Math.min(parent.points.length - 1, Math.round(t * (parent.points.length - 1)));
  const start = parent.points[idx];
  const pw = parent.window;
  const t0 = pw[0] + t * (pw[1] - pw[0]);
  const t1 = Math.min(pw[1] + 0.03, t0 + (pw[1] - pw[0]) * 0.7 + 0.01);
  const limb = {
    id: `${parent.id}/${branches.length}`, sceneId, kind, depth, window: window ?? [t0, t1],
    ...curvedPath(rnd, start, dir, len, Math.min(width, parent.widths[idx] * 0.75), parent.flex[idx], depth, kind),
  };
  branches.push(limb);
  if (depth < maxDepth) spawnChildren(branches, rnd, limb, depth + 1, sceneId, kind, maxDepth);
  return limb;
}

function spawnChildren(branches, rnd, parent, depth, sceneId, kind, maxDepth) {
  const n = depth === 1 ? 3 : 2 + Math.round(rnd());
  for (let i = 0; i < n; i++) {
    const t = 0.35 + (i + rnd() * 0.6) * (0.6 / n);
    const idx = Math.round(t * (parent.points.length - 1));
    const tangent = sub(parent.points[Math.min(idx + 1, parent.points.length - 1)], parent.points[Math.max(idx - 1, 0)]);
    const dir = rotateAway(normalize(tangent), 0.5 + rnd() * 0.5, rnd, kind === 'root' ? -1 : 1);
    const len = parent.len * (0.5 + rnd() * 0.2);
    growLimb(branches, rnd, parent, t, dir, len, parent.widths[0] * 0.6, depth, sceneId, kind, maxDepth);
  }
}

// A polyline that starts along `dir`, then bends (up for limbs, down for roots).
function curvedPath(rnd, start, dir, len, width, baseFlex, depth, kind) {
  const points = [], widths = [], flex = [];
  const n = LIMB_POINTS;
  const bend = kind === 'root' ? -0.35 : 0.25 + rnd() * 0.25;
  const wobble = rnd() * 6;
  let p = [...start];
  let d = [...dir];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    points.push([...p]);
    widths.push(width * (1 - t * 0.85));
    flex.push(baseFlex + t * (0.18 + 0.16 * depth));
    const step = len / n;
    d = normalize([
      d[0] + Math.sin(t * 7 + wobble) * 0.05,
      d[1] + bend * step * 0.35,
      d[2] + Math.cos(t * 5 + wobble) * 0.05,
    ]);
    p = [p[0] + d[0] * step, p[1] + d[1] * step, p[2] + d[2] * step];
  }
  return { points, widths, flex, len };
}

// Skill leaves sit on their own scene's branches (on roots they render as glowing
// nodes). Decorative leaves only go on limbs above ground.
function placeLeaves(leaves, rnd, branches, scenes, decorTotal) {
  const leafy = branches.filter((b) => b.kind === 'branch' && b.depth >= 1);
  const hosts = branches.filter((b) => b.kind === 'root' || (b.kind === 'branch' && b.depth >= 1));
  const byScene = new Map();
  hosts.forEach((b) => byScene.set(b.sceneId, [...(byScene.get(b.sceneId) ?? []), b]));

  const pick = (list) => {
    const b = list[Math.floor(rnd() * list.length)];
    const t = 0.3 + rnd() * 0.7;
    const idx = Math.round(t * (b.points.length - 1));
    const spawn = b.window[0] + t * (b.window[1] - b.window[0]) + 0.005;
    return { pos: b.points[idx], flex: b.flex[idx], spawn, sceneId: b.sceneId };
  };

  scenes.forEach((scene) => {
    const list = byScene.get(scene.id);
    if (!list) return;
    const skills = scene.skills ?? [];
    const spots = skillSpots(list, scene, skills.length);
    skills.forEach((skill) => {
      const spot = spots.splice(Math.floor(rnd() * spots.length), 1)[0];
      rnd(); // Same draw count as pick(), so the leaves and fruit after this don't move.
      leaves.push({ ...spot, skill, size: 0.46 + rnd() * 0.1, seed: rnd() });
    });
  });

  const fruitSkills = scenes.filter((s) => s.kind === 'fruit').flatMap((s) => s.skills ?? []);
  const hostList = byScene.get(scenes.filter((s) => s.kind === 'branch').at(-1).id);
  const fruit = scenes.find((s) => s.kind === 'fruit');
  fruitSkills.forEach((skill) => {
    const leaf = pick(hostList);
    leaves.push({ ...leaf, sceneId: fruit.id, spawn: fruit.span[0] + rnd() * 0.05, skill, size: 0.46 + rnd() * 0.1, seed: rnd() });
  });

  for (let i = 0; i < decorTotal; i++) {
    const b = leafy[Math.floor(rnd() * leafy.length)];
    leaves.push({ ...pick([b]), skill: null, size: 0.18 + rnd() * 0.2, seed: rnd() });
  }
}

// Labels only show while their scene is active, so skill leaves go on branch points
// grown by 40% of the scene, or a little later if too few have grown by then.
function skillSpots(hosts, scene, count) {
  const [a, b] = scene.span;
  const spots = hosts.flatMap((h) => h.points.map((pos, i) => {
    const t = i / (h.points.length - 1);
    return { pos, flex: h.flex[i], spawn: h.window[0] + t * (h.window[1] - h.window[0]) + 0.005, sceneId: h.sceneId, t };
  })).filter((s) => s.t >= 0.1).map(({ t, ...s }) => s);
  for (let f = 0.4; f < 3; f += 0.05) {
    const ready = spots.filter((s) => s.spawn < a + f * (b - a));
    if (ready.length >= count * 1.2) return ready;
  }
  return spots;
}

function sphericalDir(azimuth, pitch, rnd) {
  const c = Math.cos(pitch);
  return normalize([Math.cos(azimuth) * c, Math.sin(pitch), Math.sin(azimuth) * c * 0.6 + (rnd() - 0.5) * 0.2]);
}

// Rotates `dir` by `angle` around a random axis perpendicular to it, biased toward +y (or -y for roots).
function rotateAway(dir, angle, rnd, upSign) {
  const helper = Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const side = normalize(cross(dir, helper));
  const up = normalize(cross(side, dir));
  const theta = rnd() * Math.PI * 2;
  const perp = [
    side[0] * Math.cos(theta) + up[0] * Math.sin(theta) * upSign * 0.6,
    side[1] * Math.cos(theta) + up[1] * Math.sin(theta) * upSign * 0.6 + 0.3 * upSign,
    side[2] * Math.cos(theta) + up[2] * Math.sin(theta) * upSign * 0.6,
  ];
  const n = normalize(perp);
  return normalize([
    dir[0] * Math.cos(angle) + n[0] * Math.sin(angle),
    dir[1] * Math.cos(angle) + n[1] * Math.sin(angle),
    dir[2] * Math.cos(angle) + n[2] * Math.sin(angle),
  ]);
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function normalize(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
