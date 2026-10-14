// Pointer in NDC (for the scene) and CSS pixels (for labels), plus optional device tilt.
export function createInput() {
  const pointer = { x: 0, y: 0, px: -999, py: -999, vx: 0, active: false };
  const tilt = { x: 0, y: 0, enabled: false };
  const rawTilt = { x: 0, y: 0 };
  let lastX = 0;

  const move = (e) => {
    pointer.px = e.clientX;
    pointer.py = e.clientY;
    const x = (e.clientX / innerWidth) * 2 - 1;
    pointer.vx = x - lastX;
    lastX = x;
    pointer.x = x;
    pointer.y = -(e.clientY / innerHeight) * 2 + 1;
    pointer.active = true;
  };
  addEventListener('pointermove', move, { passive: true });
  addEventListener('pointerdown', move, { passive: true });
  document.addEventListener('pointerleave', () => { pointer.active = false; });
  addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') pointer.active = false; });
  addEventListener('pointercancel', () => { pointer.active = false; });

  function onOrientation(e) {
    if (e.gamma == null) return;
    rawTilt.x = Math.max(-1, Math.min(1, e.gamma / 30));
    rawTilt.y = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
  }

  async function enableTilt() {
    const DOE = window.DeviceOrientationEvent;
    if (!DOE) return false;
    if (typeof DOE.requestPermission === 'function' && (await DOE.requestPermission()) !== 'granted') return false;
    addEventListener('deviceorientation', onOrientation);
    tilt.enabled = true;
    return true;
  }

  function disableTilt() {
    removeEventListener('deviceorientation', onOrientation);
    tilt.enabled = false;
    rawTilt.x = rawTilt.y = 0;
  }

  // Called once per frame: smooths tilt and decays pointer velocity.
  function tick() {
    tilt.x += (rawTilt.x - tilt.x) * 0.08;
    tilt.y += (rawTilt.y - tilt.y) * 0.08;
    pointer.vx *= 0.9;
  }

  return { pointer, tilt, tick, enableTilt, disableTilt, tiltSupported: 'DeviceOrientationEvent' in window && matchMedia('(pointer: coarse)').matches };
}
