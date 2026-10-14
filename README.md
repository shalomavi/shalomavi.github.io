# shalomavi.github.io

My portfolio. A seed grows into a tree as you scroll. The roots are the years before code, the trunk breaks ground at Masterschool, each job grows branches, each skill is a leaf, and projects are fruit. The scene starts at night and ends in daylight.

Live at https://shalomavi.github.io/.

## Stack

Plain HTML, CSS, and ES modules. There is no build step. three.js and GSAP load from jsDelivr through the import map in `index.html`, pinned to exact versions. GitHub Pages serves the `main` branch as is.

## Edit content

All content lives in two places:

- `js/data/content.js` holds the structure: scenes in order, which skills sprout where, links, and the photo path.
- `js/i18n/en.json` and `js/i18n/he.json` hold all copy. Both files must have the same keys.

### Add a project

1. Add a scene to `SCENES` in `content.js` before `contact`:

   ```js
   { id: 'myproject', kind: 'fruit', weight: 1.6,
     links: { live: 'https://…', repo: 'https://github.com/shalomavi/…' },
     media: { poster: 'assets/myproject/preview.gif', video: 'assets/myproject/video.mp4' },
     skills: ['react', 'supabase'] },
   ```

   `media` is optional. Skill ids must exist in `SKILLS`; add new ones there.

2. Add `scenes.myproject` to both language files with `eyebrow`, `org` (the name), `role` (the tagline), `body`, `stack`, and a `decisions` list of `{ "t": title, "b": body }`.

Each fruit hangs from the newest branch and gets its own camera stop. Nothing else needs to change.

### Add a job or course

Add a `kind: 'branch'` scene after the last branch, with `branches` set to how many main limbs it grows (1 to 3). Add its copy to both language files with `eyebrow`, `org`, `role`, and `body`.

### Add the photo

Put the file at `assets/photo.jpg` and set `photo: 'assets/photo.jpg'` in `LINKS`. Until then, the contact card shows a monogram.

## Files

| Path | Role |
| --- | --- |
| `js/main.js` | Boot, scroll-to-progress mapping, reveals, controls, render loop |
| `js/tree/skeleton.js` | Deterministic tree generator. Pure data, no three.js |
| `js/tree/TreeScene.js` | Renderer, camera path, bloom, light curve |
| `js/tree/Branches.js`, `Leaves.js`, `Particles.js`, `Fruit.js`, `Sky.js` | The shaders |
| `js/tree/wind.js` | Branch sway, in GLSL and a JS mirror that keeps labels on their leaves |
| `js/ui/sections.js`, `js/ui/labels.js` | DOM cards and skill labels |
| `js/audio.js` | Generative Web Audio ambience, off until the visitor turns it on |

## Run locally

Any static server works, for example `python3 -m http.server`, then open http://localhost:8000.
