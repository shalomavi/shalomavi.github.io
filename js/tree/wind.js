// Branch sway, shared by every tree shader. windJS mirrors it so DOM labels
// track the leaves they belong to. Change both together.

export const windUniforms = () => ({
  uTime: { value: 0 },
  uGust: { value: 0 },
  uPointer: { value: [0, -100, 0] },
  uPointerActive: { value: 0 },
});

export const windGLSL = /* glsl */ `
uniform float uTime;
uniform float uGust;
uniform vec3 uPointer;
uniform float uPointerActive;

vec3 windOffset(vec3 p, float flex) {
  float s = sin(uTime * 0.9 + p.y * 0.35 + p.x * 0.2) * 0.6 + sin(uTime * 1.7 + p.x * 0.8) * 0.25;
  vec3 off = vec3(s * (0.12 + uGust), 0.0, cos(uTime * 0.7 + p.y * 0.5) * 0.08);
  vec3 d = p - uPointer;
  float fall = exp(-dot(d, d) * 0.25) * uPointerActive;
  off += normalize(d + vec3(0.0001)) * fall * 0.6;
  return off * flex;
}
`;

export function windJS(p, flex, u) {
  const s = Math.sin(u.uTime.value * 0.9 + p[1] * 0.35 + p[0] * 0.2) * 0.6 + Math.sin(u.uTime.value * 1.7 + p[0] * 0.8) * 0.25;
  let ox = s * (0.12 + u.uGust.value);
  let oy = 0;
  let oz = Math.cos(u.uTime.value * 0.7 + p[1] * 0.5) * 0.08;
  const q = u.uPointer.value;
  const dx = p[0] - q[0], dy = p[1] - q[1], dz = p[2] - q[2];
  const d2 = dx * dx + dy * dy + dz * dz;
  const fall = Math.exp(-d2 * 0.25) * u.uPointerActive.value;
  const len = Math.sqrt(d2) || 1;
  ox += (dx / len) * fall * 0.6;
  oy += (dy / len) * fall * 0.6;
  oz += (dz / len) * fall * 0.6;
  return [p[0] + ox * flex, p[1] + oy * flex, p[2] + oz * flex];
}
