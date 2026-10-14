const STORAGE_KEY = 'lang';
const cache = {};
let current = null;

export function detectLang() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'en' || saved === 'he') return saved;
  return navigator.language?.startsWith('he') ? 'he' : 'en';
}

export async function loadLang(lang) {
  if (!cache[lang]) {
    // Revalidate so copy edits show on the next visit instead of after the 10-minute Pages cache.
    const res = await fetch(`js/i18n/${lang}.json`, { cache: 'no-cache' });
    cache[lang] = await res.json();
  }
  current = { lang, dict: cache[lang] };
  localStorage.setItem(STORAGE_KEY, lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  document.title = cache[lang].meta.title;
  document.querySelector('meta[name=description]')?.setAttribute('content', cache[lang].meta.description);
  applyStatic();
  return current;
}

export const lang = () => current.lang;

// t('ui.cv') or t('scenes.rokka.body'). Missing keys return the key so they are visible.
export function t(path) {
  const value = path.split('.').reduce((o, k) => (o == null ? o : o[k]), current.dict);
  return value ?? path;
}

function applyStatic() {
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
}
