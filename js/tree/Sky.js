import * as THREE from 'three';

// Fullscreen backdrop drawn in clip space. Above the horizon: night sky with
// stars, through dawn, to warm day. Below it: a soil cross-section for the roots.
export function createSky(uniforms) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader, fragmentShader, depthWrite: false, depthTest: false,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return mesh;
}

const vertexShader = /* glsl */ `
varying vec2 vNdc;
void main() {
  vNdc = position.xy;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform float uLight;
uniform float uHorizon;
uniform float uTime;
uniform vec2 uRes;
uniform vec3 uGlow;
varying vec2 vNdc;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
vec3 ramp(vec3 a, vec3 b, vec3 c, float t) {
  return t < 0.5 ? mix(a, b, t * 2.0) : mix(b, c, t * 2.0 - 1.0);
}

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 uv = vec2(vNdc.x * aspect, vNdc.y);
  float h = vNdc.y - uHorizon;
  float l = uLight;

  vec3 top = ramp(vec3(0.010, 0.016, 0.030), vec3(0.16, 0.17, 0.33), vec3(0.80, 0.87, 0.90), l);
  vec3 hor = ramp(vec3(0.020, 0.075, 0.085), vec3(0.95, 0.56, 0.38), vec3(0.99, 0.94, 0.84), l);
  vec3 sky = mix(hor, top, smoothstep(0.0, 1.4, h));

  // The sun rises in the far corner, away from the trunk, with a tight glow.
  vec2 sunPos = vec2(0.85 * aspect, mix(uHorizon - 0.1, 0.8, smoothstep(0.25, 0.9, l)));
  float sd = length(uv - sunPos);
  float sunAmt = smoothstep(0.25, 0.6, l);
  sky += vec3(1.0, 0.72, 0.42) * exp(-sd * 5.0) * 0.35 * sunAmt;
  sky += vec3(1.0, 0.95, 0.85) * (1.0 - smoothstep(0.05, 0.062, sd)) * sunAmt * 0.6;

  vec2 sg = uv * 70.0;
  vec2 cell = floor(sg);
  float star = step(0.985, hash(cell));
  float tw = 0.5 + 0.5 * sin(uTime * (1.0 + hash(cell + 3.0) * 3.0) + hash(cell) * 40.0);
  float sdist = length(fract(sg) - 0.5);
  sky += vec3(0.85, 0.95, 1.0) * star * tw * (1.0 - smoothstep(0.0, 0.12, sdist)) * (1.0 - smoothstep(0.0, 0.35, l)) * smoothstep(0.0, 0.3, h);

  float strata = noise(vec2(uv.x * 1.5, h * 14.0)) * 0.5 + noise(uv * 9.0) * 0.5;
  vec3 soilTop = mix(vec3(0.030, 0.026, 0.022), vec3(0.42, 0.31, 0.22), l);
  vec3 soilDeep = mix(vec3(0.006, 0.006, 0.008), vec3(0.20, 0.14, 0.10), l);
  vec3 soil = mix(soilTop, soilDeep, smoothstep(0.0, 0.9, -h)) * (0.8 + strata * 0.4);
  float spark = step(0.992, hash(floor(uv * 90.0))) * (1.0 - l) * 0.8;
  soil += uGlow * spark * (0.5 + 0.5 * sin(uTime * 2.0 + hash(floor(uv * 90.0)) * 30.0));

  float edge = smoothstep(-0.004, 0.004, h);
  vec3 col = mix(soil, sky, edge);
  float rim = exp(-abs(h) * 60.0);
  col += mix(uGlow * 0.5, vec3(1.0, 0.85, 0.6) * 0.35, l) * rim;

  float grain = (hash(gl_FragCoord.xy + fract(uTime) * 100.0) - 0.5) * 0.025;
  float vig = 1.0 - smoothstep(0.7, 1.6, length(vNdc)) * mix(0.55, 0.15, l);
  gl_FragColor = vec4(col * vig + grain, 1.0);
}
`;
