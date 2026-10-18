import { gsap } from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger.js';
import { SCENES, ACCENT, QUALITY, withSpans } from './data/content.js';
import { detectLang, loadLang, lang, t } from './i18n/i18n.js';
import { buildSections } from './ui/sections.js';
import { createLabels } from './ui/labels.js';
import { createInput } from './interaction.js';
import { createAudio } from './audio.js';
import { createShootingStar } from './shootingStar.js';

gsap.registerPlugin(ScrollTrigger);

const scenes = withSpans(SCENES);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
const story = document.getElementById('story');
const star = createShootingStar(document.querySelector('.preloader'), reduced);

await loadLang(detectLang());
const sections = buildSections(story, scenes);
const ruler = buildRuler();
splitHero();
setupReveals();

const input = createInput();
const audio = createAudio();
setupControls();

let layout = { blocks: [] };
measure();

const canvas = document.getElementById('stage');
const quality = QUALITY[pickQuality()];
let tree = null;
if (webglAvailable()) {
  try {
    const { createTreeScene } = await import('./tree/TreeScene.js');
    tree = createTreeScene(canvas, scenes, { quality, accent: ACCENT });
  } catch (err) {
    console.error(err);
  }
}
if (!tree) {
  document.body.classList.add('no-webgl');
  setTheme(1);
  document.body.classList.add('is-ready');
} else {
  start(tree);
}
introHero();

function start(tree) {
  const labels = createLabels(document.getElementById('labels'), tree.skeleton.leaves, tree.uniforms);
  const skillSpawns = tree.skeleton.leaves.filter((l) => l.skill).map((l) => l.spawn);
  const resize = () => {
    tree.resize(innerWidth, innerHeight, root.dir === 'rtl' ? -1 : 1);
    measure();
  };
  addEventListener('resize', resize);
  root.addEventListener('langchange', resize);
  resize();

  let progress = scrollProgress(), last = performance.now(), slowFrames = 0, frames = 0, downgrades = 0, revealed = false;
  const loop = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const target = scrollProgress();
    const prev = progress;
    progress = reduced ? target : progress + (target - progress) * (1 - Math.exp(-dt * 5));
    input.tick();

    const growth = reduced ? 1 : progress;
    const light = tree.update({
      progress, growth, dt, time: reduced ? 0 : now / 1000,
      pointer: input.pointer, tilt: input.tilt,
    });
    labels({ growth, activeScene: activeScene(), pointer: input.pointer, project: tree.project });
    setTheme(light);
    audio.setLight(light);
    ruler.style.setProperty('--p', progress.toFixed(4));
    if (skillSpawns.some((s) => prev < s && s <= progress)) audio.chime();
    if (!revealed) {
      // The loading dot is a looping shooting star. Once it lands, it grows to the
      // WebGL seed's on-screen size, then the preloader fades onto the real seed.
      const seed = tree.project([0, 0, 0]);
      const edge = tree.project([0.128, 0, 0]);
      const dot = document.querySelector('.preloader i');
      dot.style.left = `${seed.x}px`;
      dot.style.top = `${seed.y}px`;
      const w = Math.max(10, Math.abs(edge.x - seed.x) * 2);
      dot.style.setProperty('--seed-w', `${w}px`);
      dot.style.setProperty('--seed-h', `${w * 1.44}px`);
      star.setTarget(seed.x, seed.y);
      const reveal = () => document.body.classList.add('is-ready');
      if (reduced) reveal();
      else {
        star.land(() => {
          dot.classList.add('grow');
          dot.addEventListener('animationend', reveal, { once: true });
          setTimeout(reveal, 3000);
        });
      }
      revealed = true;
    }

    // Drop resolution if the device can't hold ~30fps over a two-second window.
    frames++;
    if (dt > 0.034) slowFrames++;
    if (frames === 120) {
      if (slowFrames > 60 && downgrades < 2) { tree.lowerResolution(); downgrades++; }
      frames = slowFrames = 0;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function measure() {
  layout = { blocks: sections.map(({ section }) => ({ top: section.offsetTop, h: section.offsetHeight })) };
}

// Read at mid-screen, the same line where cards switch and labels pick their
// scene, so the tree never lags behind the text.
function scrollProgress() {
  const anchor = scrollY + innerHeight / 2;
  let idx = layout.blocks.findIndex((b) => anchor < b.top + b.h);
  if (idx === -1) idx = layout.blocks.length - 1;
  const { top, h } = layout.blocks[idx];
  const local = Math.min(1, Math.max(0, (anchor - top) / h));
  const [a, b] = scenes[idx].span;
  return a + local * (b - a);
}

function activeScene() {
  const mid = scrollY + innerHeight / 2;
  const i = layout.blocks.findIndex((b) => mid < b.top + b.h);
  return scenes[i === -1 ? scenes.length - 1 : i].id;
}

function setTheme(light) {
  const theme = light > 0.5 ? 'day' : 'night';
  if (root.dataset.theme !== theme) root.dataset.theme = theme;
}

function setupReveals() {
  sections.forEach(({ scene, section, card }) => {
    const items = card.querySelectorAll('.rv');
    const long = scene.kind === 'fruit' || scene.kind === 'contact';
    gsap.set(items, { autoAlpha: 0, y: 24 });
    ScrollTrigger.create({
      trigger: section,
      // Short cards switch exactly at mid-screen, so only one is ever on.
      start: long ? 'top 75%' : 'top 50%',
      end: long ? 'bottom 15%' : 'bottom 50%',
      onToggle: ({ isActive }) => {
        card.classList.toggle('is-active', isActive);
        if (isActive) gsap.to(items, { autoAlpha: 1, y: 0, duration: reduced ? 0 : 1.1, stagger: reduced ? 0 : 0.07, ease: 'expo.out', overwrite: true });
        else gsap.to(items, { autoAlpha: 0, y: -14, duration: reduced ? 0 : 0.45, stagger: reduced ? 0 : 0.02, ease: 'power2.in', overwrite: true });
      },
    });
  });
}

// Words rise out of a mask. Rebuilt on language change, so it reads t() directly.
function splitHero() {
  const h1 = document.querySelector('.hero-name');
  h1.removeAttribute('data-i18n');
  h1.setAttribute('aria-label', t('ui.name'));
  h1.replaceChildren(...t('ui.name').split(' ').map((w) => {
    const mask = document.createElement('span');
    mask.className = 'word';
    mask.setAttribute('aria-hidden', 'true');
    const inner = document.createElement('span');
    inner.textContent = w;
    mask.append(inner);
    return mask;
  }));
}

function introHero() {
  const words = document.querySelectorAll('.hero-name .word > span');
  if (reduced) return;
  gsap.fromTo(words, { yPercent: 110, rotate: 4 }, { yPercent: 0, rotate: 0, duration: 1.6, stagger: 0.12, ease: 'expo.out', delay: 0.5 });
}

function buildRuler() {
  const nav = document.getElementById('ruler');
  nav.replaceChildren(...scenes.filter((s) => s.kind !== 'hero').map((s, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.style.setProperty('--at', s.span[0].toFixed(4));
    b.dataset.i18nAria = s.kind === 'contact' ? `scenes.${s.id}.eyebrow` : `scenes.${s.id}.org`;
    b.setAttribute('aria-label', t(b.dataset.i18nAria));
    b.addEventListener('click', () => {
      const { top } = layout.blocks[scenes.indexOf(s)];
      scrollTo({ top: top + innerHeight * 0.1, behavior: reduced ? 'auto' : 'smooth' });
    });
    return b;
  }));
  return nav;
}

function setupControls() {
  const langBtn = document.getElementById('lang');
  langBtn.addEventListener('click', async () => {
    await loadLang(lang() === 'he' ? 'en' : 'he');
    splitHero();
    soundLabel();
    measure();
    ScrollTrigger.refresh();
    root.dispatchEvent(new Event('langchange'));
  });

  const soundBtn = document.getElementById('sound');
  const soundLabel = () => {
    const key = audio.isOn() ? 'ui.soundOn' : 'ui.soundOff';
    soundBtn.querySelector('[data-i18n]').dataset.i18n = key;
    soundBtn.querySelector('[data-i18n]').textContent = t(key);
    soundBtn.setAttribute('aria-pressed', String(audio.isOn()));
  };
  soundBtn.addEventListener('click', () => { audio.toggle(); soundLabel(); });
  soundLabel();

  const tiltBtn = document.getElementById('tilt');
  if (input.tiltSupported && !reduced) {
    tiltBtn.hidden = false;
    tiltBtn.addEventListener('click', async () => {
      if (input.tilt.enabled) input.disableTilt();
      else await input.enableTilt();
      tiltBtn.setAttribute('aria-pressed', String(input.tilt.enabled));
    });
  }
}

function pickQuality() {
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = navigator.deviceMemory ?? 4;
  const coarse = matchMedia('(pointer: coarse)').matches;
  if (cores <= 4 || memory <= 3) return 'low';
  if (!coarse && innerWidth > 900 && cores >= 8) return 'high';
  return 'mid';
}

function webglAvailable() {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}
