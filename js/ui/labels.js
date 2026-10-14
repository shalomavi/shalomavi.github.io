import { SKILLS } from '../data/content.js';
import { windJS } from '../tree/wind.js';

const HOVER_RADIUS = 30;

// DOM labels pinned to skill leaves. A label shows while its scene is active,
// while the pointer is near its leaf, or while its chip in the card is hovered.
export function createLabels(layer, leaves, uniforms) {
  const items = leaves.filter((l) => l.skill).map((leaf) => {
    const node = document.createElement('span');
    node.className = 'leaf-label';
    node.dir = 'ltr';
    node.textContent = SKILLS[leaf.skill];
    layer.append(node);
    return { leaf, node, shown: false };
  });
  let chipSkill = null;

  document.addEventListener('pointerover', (e) => {
    chipSkill = e.target.closest?.('[data-skill]')?.dataset.skill ?? null;
  });

  return function update({ growth, activeScene, pointer, project }) {
    let hovered = null, best = HOVER_RADIUS;
    const placed = items.map((item) => {
      const grown = growth > item.leaf.spawn + 0.012;
      if (!grown) return null;
      const s = project(windJS(item.leaf.pos, item.leaf.flex, uniforms));
      if (pointer.active) {
        const d = Math.hypot(s.x - pointer.px, s.y - pointer.py);
        if (d < best) { best = d; hovered = item; }
      }
      return s;
    });

    items.forEach((item, i) => {
      const s = placed[i];
      const show = !!s && s.z < 1 && (item.leaf.sceneId === activeScene || item === hovered || item.leaf.skill === chipSkill);
      if (show) item.node.style.transform = `translate3d(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px, 0)`;
      if (show !== item.shown) { item.node.classList.toggle('is-on', show); item.shown = show; }
      item.node.classList.toggle('is-focus', item === hovered || item.leaf.skill === chipSkill);
    });
  };
}
