import * as THREE from 'three';
import { windJS } from './wind.js';

const glowFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uLight;
uniform float uIntensity;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vLocal;
void main() {
  vec3 n = normalize(vNormal);
  float fres = pow(1.0 - abs(dot(n, normalize(vView))), 2.0);
  float swirl = 0.5 + 0.5 * sin(vLocal.y * 14.0 + sin(vLocal.x * 9.0 + uTime) * 2.0 - uTime * 1.5);
  float lambert = max(dot(n, normalize(vec3(0.5, 0.7, 0.6))), 0.0);
  vec3 night = uColor * (0.6 + swirl * 0.5 + fres * 2.4) * uIntensity;
  vec3 day = uColor * (0.45 + lambert * 0.7) + vec3(1.0) * pow(lambert, 24.0) * 0.6 + uColor * fres * 0.8;
  gl_FragColor = vec4(mix(night, day, uLight * 0.85), 1.0);
}
`;
const glowVert = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vLocal;
void main() {
  vLocal = position;
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

function glowMesh(uniforms, color, geometry) {
  const material = new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uColor: { value: new THREE.Color(color) }, uIntensity: { value: 1 } },
    vertexShader: glowVert, fragmentShader: glowFrag,
  });
  return new THREE.Mesh(geometry, material);
}

// The seed waits at the origin until the trunk breaks ground, then shrinks into it.
export function createSeed(uniforms, trunkStart, color) {
  const mesh = glowMesh(uniforms, color, new THREE.SphereGeometry(0.16, 32, 16));
  mesh.scale.set(0.8, 1.15, 0.8);
  mesh.userData.update = (growth, time) => {
    const fade = 1 - THREE.MathUtils.smoothstep(growth, trunkStart, trunkStart + 0.03);
    const breathe = 1 + Math.sin(time * 1.6) * 0.06;
    mesh.scale.set(0.8 * fade * breathe, 1.15 * fade * breathe, 0.8 * fade * breathe);
    mesh.material.uniforms.uIntensity.value = 1.2 + Math.sin(time * 1.6) * 0.4;
    mesh.visible = fade > 0.001;
  };
  return mesh;
}

export function createFruits(fruits, uniforms, color) {
  const group = new THREE.Group();
  const geometry = new THREE.SphereGeometry(0.34, 48, 24);
  const meshes = fruits.map((f) => {
    const mesh = glowMesh(uniforms, color, geometry);
    mesh.userData.fruit = f;
    group.add(mesh);
    return mesh;
  });
  group.userData.update = (growth, time) => {
    meshes.forEach((mesh) => {
      const f = mesh.userData.fruit;
      const g = THREE.MathUtils.clamp((growth - f.window[0]) / 0.04, 0, 1);
      const s = g === 0 ? 0 : 1 + 2.70158 * (g - 1) ** 3 + 1.70158 * (g - 1) ** 2;
      const hang = windJS([f.pos[0], f.pos[1] - 0.45, f.pos[2]], f.flex + 0.1, uniforms);
      mesh.position.set(...hang);
      mesh.scale.setScalar(Math.max(0.0001, s * (1 + Math.sin(time * 2.2) * 0.04)));
      mesh.material.uniforms.uIntensity.value = 1 + Math.sin(time * 2.2) * 0.25;
      mesh.visible = s > 0.001;
    });
  };
  return group;
}
