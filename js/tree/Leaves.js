import * as THREE from 'three';
import { windGLSL } from './wind.js';

// Camera-facing leaf sprites, one instance each. Skill leaves are larger and
// carry a halo; below ground they render as glowing nodes instead of leaves.
export function createLeaves(leaves, uniforms) {
  const geo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  geo.setAttribute('uv', quad.attributes.uv);

  const n = leaves.length;
  const aPos = new Float32Array(n * 3), aData = new Float32Array(n * 4), aFlex = new Float32Array(n);
  leaves.forEach((l, i) => {
    aPos.set(l.pos, i * 3);
    aData.set([l.spawn, l.size, l.seed, l.skill ? 1 : 0], i * 4);
    aFlex[i] = l.flex;
  });
  geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(aPos, 3));
  geo.setAttribute('aData', new THREE.InstancedBufferAttribute(aData, 4));
  geo.setAttribute('aFlex', new THREE.InstancedBufferAttribute(aFlex, 1));
  geo.instanceCount = n;

  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  return mesh;
}

const vertexShader = /* glsl */ `
uniform float uGrowth;
attribute vec3 aPos;
attribute vec4 aData;
attribute float aFlex;
varying vec2 vUv;
varying float vSeed;
varying float vSkill;
varying float vUnder;
varying float vBorn;
${windGLSL}

float easeOutBack(float x) {
  float c1 = 1.70158, c3 = c1 + 1.0, y = x - 1.0;
  return 1.0 + c3 * y * y * y + c1 * y * y;
}

void main() {
  float born = clamp((uGrowth - aData.x) / 0.025, 0.0, 1.0);
  float s = easeOutBack(born) * aData.y;
  vec3 c = aPos + windOffset(aPos, aFlex);
  vec4 mv = modelViewMatrix * vec4(c, 1.0);
  float ang = aData.z * 6.2831 + sin(uTime * 1.3 + aData.z * 40.0) * 0.25;
  float halo = aData.w > 0.5 ? 2.2 : 1.0;
  vec2 q = position.xy * halo;
  mv.xy += mat2(cos(ang), sin(ang), -sin(ang), cos(ang)) * q * s;
  vUv = q;
  vSeed = aData.z;
  vSkill = aData.w;
  vUnder = step(aPos.y, -0.05);
  vBorn = born;
  gl_Position = projectionMatrix * mv;
}
`;

const fragmentShader = /* glsl */ `
uniform float uLight;
uniform vec3 uGlow;
varying vec2 vUv;
varying float vSeed;
varying float vSkill;
varying float vUnder;
varying float vBorn;

void main() {
  vec2 p = vUv;
  float y = p.y + 0.5;
  float w = 0.32 * sin(3.14159 * clamp(y, 0.0, 1.0)) * (1.0 - 0.35 * y);
  float leaf = (1.0 - smoothstep(w - 0.04, w, abs(p.x))) * step(0.0, y) * step(y, 1.0);
  float vein = (1.0 - smoothstep(0.0, 0.025, abs(p.x))) * leaf * 0.35;
  leaf *= 1.0 - vUnder;

  float r = length(p);
  float halo = vSkill * exp(-r * r * 7.0) * (vUnder > 0.5 ? 1.4 : mix(0.55, 0.12, uLight));
  float core = vUnder * vSkill * (1.0 - smoothstep(0.08, 0.13, r));

  vec3 nightLeaf = mix(vec3(0.15, 0.85, 0.62), vec3(0.55, 1.0, 0.75), vSeed) * (0.55 + vSkill * 0.9);
  vec3 dayLeaf = mix(vec3(0.24, 0.45, 0.20), vec3(0.62, 0.72, 0.30), vSeed);
  dayLeaf = mix(dayLeaf, vec3(0.86, 0.55, 0.22), step(0.93, vSeed));
  dayLeaf -= vein * 0.4;
  vec3 leafCol = mix(nightLeaf + vein * 0.3, dayLeaf, uLight);

  vec3 haloCol = mix(uGlow * 1.6, vec3(1.0, 0.86, 0.55), uLight * (1.0 - vUnder));
  vec3 col = leafCol * leaf + haloCol * (halo + core * 2.0);
  float a = clamp(leaf + halo + core, 0.0, 1.0) * vBorn;
  if (a < 0.01) discard;
  gl_FragColor = vec4(col / max(a, 0.001), a);
}
`;
