import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { buildSkeleton } from './skeleton.js';
import { windUniforms } from './wind.js';
import { createBranches } from './Branches.js';
import { createLeaves } from './Leaves.js';
import { createSky } from './Sky.js';
import { createSap, createDust } from './Particles.js';
import { createSeed, createFruits } from './Fruit.js';

THREE.ColorManagement.enabled = false;

export function createTreeScene(canvas, scenes, { quality, accent }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  let dpr = Math.min(window.devicePixelRatio, quality.dprCap);
  renderer.setPixelRatio(dpr);

  const skeleton = buildSkeleton(scenes, { decorLeaves: quality.decorLeaves });
  const uniforms = {
    ...windUniforms(),
    uGrowth: { value: 0 },
    uLight: { value: 0 },
    uHorizon: { value: -0.3 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uGlow: { value: new THREE.Color(accent) },
    uPixelRatio: { value: dpr },
  };

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  const trunkScene = scenes.find((s) => s.kind === 'trunk');
  const seed = createSeed(uniforms, trunkScene.span[0], accent);
  const fruits = createFruits(skeleton.fruits, uniforms, accent);
  const sap = createSap(skeleton.branches, uniforms, quality.sap);
  scene.add(createSky(uniforms), createBranches(skeleton.branches, uniforms),
    createLeaves(skeleton.leaves, uniforms), sap, createDust(uniforms, quality.dust), seed, fruits);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 1.2, 0.55, 0.15);
  composer.addPass(bloom);

  const keys = cameraKeys(scenes, skeleton);
  const lightAt = lightCurve(scenes);
  const camPos = new THREE.Vector3(), camTarget = new THREE.Vector3();
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit = new THREE.Vector3();
  let width = 1, height = 1, railSide = 1;

  function resize(w, h, side) {
    width = w; height = h; railSide = side;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.resolution.set(w * quality.bloomScale, h * quality.bloomScale);
    uniforms.uRes.value.set(w, h);
    camera.aspect = w / h;
    const halfH = Math.tan(THREE.MathUtils.degToRad(21)) / Math.min(1, camera.aspect);
    camera.fov = Math.max(42, THREE.MathUtils.radToDeg(2 * Math.atan(halfH)));
    // Shift the tree away from the text rail on wide screens, upward on narrow ones.
    if (w > 900) camera.setViewOffset(w, h, side * w * 0.16, 0, w, h);
    else camera.setViewOffset(w, h, 0, h * 0.14, w, h);
    camera.updateProjectionMatrix();
  }

  function update({ progress, growth, time, dt, pointer, tilt }) {
    uniforms.uTime.value = time;
    uniforms.uGrowth.value = growth;
    const light = lightAt(progress);
    uniforms.uLight.value = light;

    sampleCamera(keys, progress, camPos, camTarget);
    camera.position.copy(camPos).add(new THREE.Vector3(tilt.x * 0.8 + pointer.x * 0.25, tilt.y * 0.5 + pointer.y * 0.15, 0));
    camera.lookAt(camTarget);
    camera.updateMatrixWorld();

    const h = new THREE.Vector3(camTarget.x, 0, 0).project(camera);
    uniforms.uHorizon.value = h.y;

    ray.setFromCamera(pointer, camera);
    if (ray.ray.intersectPlane(plane, hit)) uniforms.uPointer.value = [hit.x, hit.y, hit.z];
    uniforms.uPointerActive.value += ((pointer.active ? 1 : 0) - uniforms.uPointerActive.value) * 0.06;
    uniforms.uGust.value += (Math.min(0.5, Math.abs(pointer.vx) * 0.6) - uniforms.uGust.value) * 0.05;

    seed.userData.update(growth, time);
    fruits.userData.update(growth, time);
    sap.userData.update(dt, growth);

    // A bright sky crosses any bloom threshold and hazes the whole frame, so bloom is gone by day.
    bloom.strength = 1.35 * (1 - THREE.MathUtils.smoothstep(light, 0.25, 0.7));
    bloom.threshold = THREE.MathUtils.lerp(0.1, 0.6, light);
    bloom.enabled = bloom.strength > 0.01;
    composer.render(dt);
    return light;
  }

  // Projects a world point to CSS pixels; z > 1 means behind the camera.
  const tmp = new THREE.Vector3();
  function project(p) {
    tmp.set(p[0], p[1], p[2]).project(camera);
    return { x: (tmp.x * 0.5 + 0.5) * width, y: (-tmp.y * 0.5 + 0.5) * height, z: tmp.z };
  }

  function lowerResolution() {
    dpr = Math.max(0.75, dpr * 0.75);
    renderer.setPixelRatio(dpr);
    uniforms.uPixelRatio.value = dpr;
    resize(width, height, railSide);
    return dpr;
  }

  return { update, resize, project, lowerResolution, skeleton, uniforms, fruitAnchor: () => fruits.children[0]?.position };
}

// One camera key per scene, derived from the skeleton so new scenes get a view for free.
function cameraKeys(scenes, skeleton) {
  const roots = scenes.filter((s) => s.kind === 'root');
  return scenes.map((s) => {
    const p = (s.span[0] + s.span[1]) / 2;
    if (s.kind === 'hero') return { p, target: [0, 0.15, 0], pos: [0, 0.5, 4.2] };
    if (s.kind === 'root') {
      const a = (roots.indexOf(s) - (roots.length - 1) / 2) * 0.32;
      return { p, target: [0, -1.9, 0], pos: [Math.sin(a) * 9, -1.4, Math.cos(a) * 9] };
    }
    if (s.kind === 'trunk') return { p, target: [0, 1.4, 0], pos: [0.6, 1.2, 8.5] };
    if (s.kind === 'branch') {
      const pts = skeleton.branches.filter((b) => b.sceneId === s.id && b.depth === 1).flatMap((b) => b.points);
      const c = pts.reduce((acc, q) => [acc[0] + q[0], acc[1] + q[1], acc[2] + q[2]], [0, 0, 0]).map((v) => v / pts.length);
      const a = (scenes.indexOf(s) % 2 ? -1 : 1) * 0.3;
      const dist = 10 + c[1] * 0.45;
      return { p, target: [c[0] * 0.4, c[1], 0], pos: [c[0] * 0.4 + Math.sin(a) * dist, c[1] + 0.8, Math.cos(a) * dist] };
    }
    if (s.kind === 'fruit') {
      const f = skeleton.fruits.find((x) => x.sceneId === s.id) ?? skeleton.fruits[0];
      const t = [f.pos[0], f.pos[1] - 0.45, f.pos[2]];
      return { p, target: t, pos: [t[0] + 1.8, t[1] + 0.4, t[2] + 5] };
    }
    return { p, target: [0, 4.4, 0], pos: [0, 4.9, 21] };
  });
}

function sampleCamera(keys, p, pos, target) {
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].p < p) i++;
  const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
  const raw = b.p === a.p ? 0 : THREE.MathUtils.clamp((p - a.p) / (b.p - a.p), 0, 1);
  const t = raw * raw * raw * (raw * (raw * 6 - 15) + 10);
  pos.set(...a.pos).lerp(new THREE.Vector3(...b.pos), t);
  target.set(...a.target).lerp(new THREE.Vector3(...b.target), t);
}

// 0 through the roots, rises from the moment the trunk breaks ground, 1 at contact.
function lightCurve(scenes) {
  const start = scenes.find((s) => s.kind === 'trunk').span[0];
  const end = scenes.find((s) => s.kind === 'contact').span[0];
  return (p) => {
    const t = THREE.MathUtils.clamp((p - start) / (end - start), 0, 1);
    return t * t * (3 - 2 * t) * 0.92 + THREE.MathUtils.clamp((p - end) / 0.05, 0, 1) * 0.08;
  };
}
