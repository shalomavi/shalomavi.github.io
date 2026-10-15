import { SKILLS } from '../data/content.js';
import { windJS } from '../tree/wind.js';

const HOVER_RADIUS = 30;
const OFFSET_X = 12;
const GAP = 3;
// Vertical slots tried, in label heights, when a label would overlap one already placed.
const SLOTS = [0, 1, -1, 2, -2, 3, -3];

// DOM labels pinned to skill leaves. A label shows while its scene is active,
// while the pointer is near its leaf, or while its chip in the card is hovered.
// Labels are placed greedily, focused ones first, and slide to a free slot on overlap.
export function createLabels(layer, leaves, uniforms) {
  const items = leaves.filter((l) => l.skill).map((leaf) => {
    const node = document.createElement('span');
    node.className = 'leaf-label';
    node.dir = 'ltr';
    node.textContent = SKILLS[leaf.skill];
    layer.append(node);
    return { leaf, node, shown: false, w: 0, h: 0 };
  });
  const measure = () => items.forEach((it) => { it.w = it.node.offsetWidth; it.h = it.node.offsetHeight; });
  measure();
  document.fonts?.ready.then(measure);

  let chipSkill = null;
  document.addEventListener('pointerover', (e) => {
    chipSkill = e.target.closest?.('[data-skill]')?.dataset.skill ?? null;
  });

  return function update({ growth, activeScene, pointer, project }) {
    let hovered = null, best = HOVER_RADIUS;
    const candidates = [];
    for (const item of items) {
      if (growth <= item.leaf.spawn + 0.004) continue;
      const s = project(windJS(item.leaf.pos, item.leaf.flex, uniforms));
      if (s.z >= 1) continue;
      if (pointer.active) {
        const d = Math.hypot(s.x - pointer.px, s.y - pointer.py);
        if (d < best) { best = d; hovered = item; }
      }
      candidates.push({ item, s });
    }

    const focused = (it) => it === hovered || it.leaf.skill === chipSkill;
    const wanted = candidates
      .filter(({ item }) => item.leaf.sceneId === activeScene || focused(item))
      .sort((a, b) => focused(b.item) - focused(a.item));

    const placed = [];
    const visible = new Set();
    for (const { item, s } of wanted) {
      const x = s.x + OFFSET_X;
      const slot = SLOTS.find((k) => {
        const y = s.y - item.h / 2 + k * (item.h + GAP);
        return !placed.some((r) => x < r.x + r.w + GAP && r.x < x + item.w + GAP && y < r.y + r.h && r.y < y + item.h);
      });
      if (slot === undefined) continue;
      const y = s.y - item.h / 2 + slot * (item.h + GAP);
      placed.push({ x, y, w: item.w, h: item.h });
      item.node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      visible.add(item);
    }

    for (const item of items) {
      const show = visible.has(item);
      if (show !== item.shown) { item.node.classList.toggle('is-on', show); item.shown = show; }
      item.node.classList.toggle('is-focus', show && focused(item));
    }
  };
}
