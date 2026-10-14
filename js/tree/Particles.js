import * as THREE from 'three';
import { windJS } from './wind.js';

const pointFrag = /* glsl */ `
uniform vec3 uColorNight;
uniform vec3 uColorDay;
uniform float uLight;
varying float vAlpha;
void main() {
  float r = length(gl_PointCoord - 0.5);
  float a = exp(-r * r * 18.0) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(mix(uColorNight, uColorDay, uLight), a);
}
`;

// Sap: light travelling inside grown branches. Up the trunk and limbs, and
// toward the trunk inside roots. Positions are updated on the CPU each frame.
export function createSap(branches, uniforms, count) {
  const flowable = branches.filter((b) => b.depth <= 2);
  const parts = Array.from({ length: count }, () => ({
    b: flowable[Math.floor(Math.random() * flowable.length)],
    t: Math.random(),
    speed: 0.12 + Math.random() * 0.25,
  }));
  const pos = new Float32Array(count * 3);
  const alpha = new Float32Array(count);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uSize: { value: 26 }, uColorNight: { value: new THREE.Color(0.55, 1.0, 0.9) }, uColorDay: { value: new THREE.Color(1.0, 0.8, 0.45) } },
    vertexShader: /* glsl */ `
      uniform float uSize;
      uniform float uPixelRatio;
      attribute float aAlpha;
      varying float vAlpha;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uSize * uPixelRatio / -mv.z;
        vAlpha = aAlpha;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: pointFrag,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  points.renderOrder = 3;

  points.userData.update = (dt, growth) => {
    const dim = 1 - uniforms.uLight.value * 0.9;
    parts.forEach((p, i) => {
      const { b } = p;
      const g = Math.min(1, Math.max(0, (growth - b.window[0]) / (b.window[1] - b.window[0])));
      p.t += dt * p.speed / Math.max(0.6, b.len ?? 6);
      if (p.t > 1) p.t -= 1;
      const along = b.kind === 'root' ? 1 - p.t : p.t;
      const reach = along * g;
      const f = reach * (b.points.length - 1);
      const k = Math.min(b.points.length - 2, Math.floor(f));
      const a = b.points[k], c = b.points[k + 1], w = f - k;
      const pt = [a[0] + (c[0] - a[0]) * w, a[1] + (c[1] - a[1]) * w, a[2] + (c[2] - a[2]) * w];
      const flex = b.flex[k] + (b.flex[k + 1] - b.flex[k]) * w;
      pos.set(windJS(pt, flex, uniforms), i * 3);
      alpha[i] = g > 0.02 ? Math.sin(p.t * Math.PI) * dim : 0;
    });
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
  };
  return points;
}

// Fireflies at night, drifting dust motes by day. Drift and pointer attraction run on the GPU.
export function createDust(uniforms, count) {
  const base = new Float32Array(count * 3), rnd = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    base.set([(Math.random() - 0.5) * 26, -5 + Math.random() * 20, (Math.random() - 0.5) * 12], i * 3);
    rnd.set([Math.random(), Math.random(), Math.random()], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(base, 3));
  geo.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 3));
  const material = new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uColorNight: { value: new THREE.Color(0.75, 1.0, 0.55) }, uColorDay: { value: new THREE.Color(1.0, 0.93, 0.8) } },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uLight;
      uniform float uPixelRatio;
      uniform vec3 uPointer;
      uniform float uPointerActive;
      attribute vec3 aRnd;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        float t = uTime * (0.15 + aRnd.x * 0.25);
        p += vec3(sin(t + aRnd.y * 30.0) * 1.2, sin(t * 0.7 + aRnd.z * 20.0) * 0.8, cos(t * 0.8 + aRnd.x * 10.0) * 0.8);
        vec3 d = uPointer - p;
        p += d * uPointerActive * 0.45 * exp(-dot(d, d) * 0.06);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float blink = mix(0.5 + 0.5 * sin(uTime * (1.5 + aRnd.z * 3.0) + aRnd.y * 50.0), 1.0, uLight);
        gl_PointSize = mix(34.0, 12.0, uLight) * (0.5 + aRnd.z) * uPixelRatio / -mv.z;
        vAlpha = blink * mix(0.9, 0.08, uLight) * step(0.35 + uLight * 0.3, aRnd.x);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: pointFrag,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  points.renderOrder = 4;
  return points;
}
