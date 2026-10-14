import * as THREE from 'three';
import { windGLSL } from './wind.js';

const RADIAL = 7;

// One merged tube mesh for every branch. Each ring vertex stores the centerline
// point plus a radial normal, so the shader can grow, taper, and sway the tube.
export function createBranches(branches, uniforms) {
  const pos = [], nrm = [], rad = [], prog = [], win = [], flex = [], kind = [], index = [];
  let base = 0;

  for (const b of branches) {
    const frames = parallelTransport(b.points);
    const k = b.kind === 'root' ? 1 : 0;
    b.points.forEach((p, i) => {
      const { n, bn } = frames[i];
      for (let j = 0; j < RADIAL; j++) {
        const a = (j / RADIAL) * Math.PI * 2;
        const c = Math.cos(a), s = Math.sin(a);
        pos.push(...p);
        nrm.push(n[0] * c + bn[0] * s, n[1] * c + bn[1] * s, n[2] * c + bn[2] * s);
        rad.push(b.widths[i]);
        prog.push(i / (b.points.length - 1));
        win.push(...b.window);
        flex.push(b.flex[i]);
        kind.push(k);
      }
    });
    for (let i = 0; i < b.points.length - 1; i++) {
      for (let j = 0; j < RADIAL; j++) {
        const a = base + i * RADIAL + j;
        const b2 = base + i * RADIAL + ((j + 1) % RADIAL);
        const c = a + RADIAL, d = b2 + RADIAL;
        index.push(a, c, b2, b2, c, d);
      }
    }
    base += b.points.length * RADIAL;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aNormal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('aRadius', new THREE.Float32BufferAttribute(rad, 1));
  geo.setAttribute('aProgress', new THREE.Float32BufferAttribute(prog, 1));
  geo.setAttribute('aWindow', new THREE.Float32BufferAttribute(win, 2));
  geo.setAttribute('aFlex', new THREE.Float32BufferAttribute(flex, 1));
  geo.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
  geo.setIndex(index);

  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader });
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  return mesh;
}

function parallelTransport(points) {
  const frames = [];
  let n = null;
  for (let i = 0; i < points.length; i++) {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    const t = norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
    if (!n) n = norm(cross(t, Math.abs(t[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]));
    const bn = norm(cross(t, n));
    n = norm(cross(bn, t));
    frames.push({ n, bn });
  }
  return frames;
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v) => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

const vertexShader = /* glsl */ `
uniform float uGrowth;
attribute vec3 aNormal;
attribute float aRadius;
attribute float aProgress;
attribute vec2 aWindow;
attribute float aFlex;
attribute float aKind;
varying vec3 vNormal;
varying vec3 vView;
varying float vTip;
varying float vProg;
varying float vKind;
varying float vY;
${windGLSL}

void main() {
  float g = clamp((uGrowth - aWindow.x) / max(aWindow.y - aWindow.x, 1e-4), 0.0, 1.0);
  float alive = 1.0 - smoothstep(g - 0.02, g, aProgress);
  float taper = mix(0.15, 1.0, clamp((g - aProgress) / 0.1, 0.0, 1.0));
  float r = aRadius * alive * taper * step(0.0001, g);
  vec3 center = position + windOffset(position, aFlex);
  vec4 mv = modelViewMatrix * vec4(center + aNormal * r, 1.0);
  vNormal = normalize(normalMatrix * aNormal);
  vView = -mv.xyz;
  vTip = (1.0 - clamp((g - aProgress) / 0.12, 0.0, 1.0)) * (1.0 - smoothstep(0.97, 1.0, g));
  vProg = aProgress;
  vKind = aKind;
  vY = position.y;
  gl_Position = projectionMatrix * mv;
}
`;

const fragmentShader = /* glsl */ `
uniform float uLight;
uniform float uTime;
uniform vec3 uGlow;
varying vec3 vNormal;
varying vec3 vView;
varying float vTip;
varying float vProg;
varying float vKind;
varying float vY;

void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(vView);
  float fres = pow(1.0 - abs(dot(n, v)), 2.2);
  float pulse = smoothstep(0.85, 1.0, sin(vProg * 26.0 - uTime * 2.4 + vY * 0.6)) * 0.5;

  vec3 night = uGlow * (0.18 + fres * 1.1 + pulse) + uGlow * vTip * 1.8;

  vec3 sun = normalize(vec3(0.5, 0.7, 0.6));
  float lambert = max(dot(n, sun), 0.0);
  vec3 bark = mix(vec3(0.20, 0.13, 0.09), vec3(0.47, 0.34, 0.24), lambert);
  bark += vec3(1.0, 0.78, 0.5) * fres * 0.35;
  vec3 day = bark + vec3(1.0, 0.85, 0.55) * vTip * 1.2;

  // Roots stay luminous underground; daylight only warms them.
  float light = vKind > 0.5 ? uLight * 0.45 : uLight;
  gl_FragColor = vec4(mix(night, day, smoothstep(0.15, 0.85, light)), 1.0);
}
`;
