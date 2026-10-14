import { SKILLS, LINKS } from '../data/content.js';
import { t } from '../i18n/i18n.js';

const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'text') node.textContent = v;
    else if (k === 'i18n') { node.dataset.i18n = v; node.textContent = t(v); }
    else node.setAttribute(k, v);
  }
  node.append(...children.filter(Boolean));
  return node;
};

const reveal = (node) => { node.classList.add('rv'); return node; };

// Builds one <section> per scene. Section height is proportional to scene
// weight, which is what keeps scroll position and tree growth in step.
export function buildSections(root, scenes) {
  root.replaceChildren();
  return scenes.map((scene) => {
    const card = builders[scene.kind](scene);
    const section = el('section', { class: `scene scene--${scene.kind}`, 'data-scene': scene.id, style: `--weight:${scene.weight}` }, [card]);
    root.append(section);
    return { scene, section, card };
  });
}

const k = (scene, key) => `scenes.${scene.id}.${key}`;

function skillList(scene) {
  if (!scene.skills?.length) return null;
  return el('div', { class: 'skills rv' }, [
    el('p', { class: 'label', i18n: 'ui.skillsLabel' }),
    el('ul', { class: 'chips', dir: 'ltr' }, scene.skills.map((id) => el('li', { 'data-skill': id, text: SKILLS[id] }))),
  ]);
}

function milestone(scene) {
  return el('article', { class: 'card' }, [
    reveal(el('p', { class: 'eyebrow', i18n: k(scene, 'eyebrow') })),
    reveal(el('h2', { class: 'org', i18n: k(scene, 'org') })),
    reveal(el('p', { class: 'role', i18n: k(scene, 'role') })),
    reveal(el('p', { class: 'body', i18n: k(scene, 'body') })),
    skillList(scene),
  ]);
}

const builders = {
  hero: (scene) => el('header', { class: 'card card--hero' }, [
    reveal(el('p', { class: 'eyebrow', i18n: k(scene, 'eyebrow') })),
    el('h1', { class: 'hero-name', i18n: 'ui.name' }),
    reveal(el('p', { class: 'hero-title', i18n: 'ui.title' })),
    reveal(el('p', { class: 'hero-line', i18n: 'ui.oneliner' })),
    el('p', { class: 'scroll-hint rv', 'aria-hidden': 'true' }, [el('span', { i18n: 'ui.scroll' }), el('i')]),
  ]),
  root: milestone,
  trunk: milestone,
  branch: milestone,
  fruit: (scene) => el('article', { class: 'card card--fruit' }, [
    reveal(el('p', { class: 'eyebrow', i18n: k(scene, 'eyebrow') })),
    reveal(el('h2', { class: 'org org--xl', i18n: k(scene, 'org') })),
    reveal(el('p', { class: 'tagline', i18n: k(scene, 'role') })),
    reveal(el('p', { class: 'body', i18n: k(scene, 'body') })),
    scene.media && reveal(promo(scene)),
    reveal(decisions(scene)),
    reveal(el('p', { class: 'stack', dir: 'ltr', i18n: k(scene, 'stack') })),
    reveal(el('p', { class: 'actions' }, [
      el('a', { class: 'btn btn--solid', href: scene.links.live, target: '_blank', rel: 'noopener', i18n: 'ui.live' }),
      el('a', { class: 'btn', href: scene.links.repo, target: '_blank', rel: 'noopener', i18n: 'ui.repo' }),
    ])),
    skillList(scene),
  ]),
  contact: (scene) => el('footer', { class: 'card card--contact' }, [
    reveal(portrait()),
    reveal(el('p', { class: 'eyebrow', i18n: k(scene, 'eyebrow') })),
    reveal(el('h2', { class: 'org org--xl', i18n: k(scene, 'heading') })),
    reveal(el('p', { class: 'body', i18n: k(scene, 'body') })),
    reveal(el('ul', { class: 'contact-links' }, [
      el('li', {}, [el('a', { href: `mailto:${LINKS.email}`, dir: 'ltr', text: LINKS.email })]),
      el('li', {}, [el('a', { href: LINKS.linkedin, target: '_blank', rel: 'noopener', i18n: 'ui.linkedin' })]),
      el('li', {}, [el('a', { href: LINKS.github, target: '_blank', rel: 'noopener', i18n: 'ui.github' })]),
    ])),
    reveal(el('p', { class: 'actions' }, [el('a', { class: 'btn btn--solid', href: LINKS.cv, download: '', i18n: 'ui.cv' })])),
    reveal(el('p', { class: 'colophon' }, [el('span', { i18n: 'ui.footer' }), el('span', { i18n: 'ui.colophon' })])),
  ]),
};

// GIF preview loads lazily; the MP4 only loads when the visitor asks for it.
function promo(scene) {
  const figure = el('figure', { class: 'promo' }, [
    el('button', { class: 'promo-play', type: 'button', 'data-i18n-aria': 'ui.videoCaption', 'aria-label': t('ui.videoCaption') }, [
      el('img', { src: scene.media.poster, alt: '', loading: 'lazy', decoding: 'async' }),
      el('span', { class: 'promo-icon', 'aria-hidden': 'true' }),
    ]),
    el('figcaption', { i18n: 'ui.videoCaption' }),
  ]);
  figure.querySelector('button').addEventListener('click', (e) => {
    const video = el('video', { src: scene.media.video, controls: '', autoplay: '', playsinline: '' });
    e.currentTarget.replaceWith(video);
  }, { once: true });
  return figure;
}

function decisions(scene) {
  const list = t(k(scene, 'decisions'));
  return el('ol', { class: 'decisions' }, (Array.isArray(list) ? list : []).map((_, i) => el('li', {}, [
    el('span', { class: 'num', text: String(i + 1).padStart(2, '0') }),
    el('h3', { i18n: k(scene, `decisions.${i}.t`) }),
    el('p', { i18n: k(scene, `decisions.${i}.b`) }),
  ])));
}

function portrait() {
  if (LINKS.photo) return el('div', { class: 'portrait' }, [el('img', { src: LINKS.photo, alt: t('ui.name'), loading: 'lazy' })]);
  return el('div', { class: 'portrait is-empty', 'aria-hidden': 'true' }, [el('span', { text: 'SA' })]);
}
