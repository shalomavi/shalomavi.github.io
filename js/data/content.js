// Single place to edit when the story changes. Everything else derives from it.
//
// A SCENE is one scroll segment. Kinds:
//   hero     the seed, before anything grows
//   root     pre-tech years, drawn underground
//   trunk    the moment the trunk breaks ground
//   branch   a job or course; sprouts from the trunk at the height it has reached
//   fruit    a project; hangs from the latest branch
//   contact  the end, tree complete
// `weight` is relative scroll length. `skills` are ids from SKILLS and become
// leaves on that scene's branch. `branches` is how many main limbs a job grows.

export const ACCENT = '#14b8a6';

export const LINKS = {
  email: 'shalomavi3@gmail.com',
  linkedin: 'https://www.linkedin.com/in/shalom-avichail/',
  github: 'https://github.com/shalomavi',
  cv: 'assets/Shalom_Avichail_Resume.pdf',
  // Set to e.g. 'assets/photo.jpg' once the file is in the repo.
  photo: null,
};

export const SKILLS = {
  typescript: 'TypeScript', javascript: 'JavaScript', python: 'Python', c: 'C',
  react: 'React', nextjs: 'Next.js', redux: 'Redux Toolkit', saga: 'Redux-Saga',
  tailwind: 'Tailwind', html: 'HTML', css: 'CSS',
  django: 'Django', drf: 'Django REST', flask: 'Flask', fastapi: 'FastAPI',
  node: 'Node.js', express: 'Express', celery: 'Celery', redis: 'Redis', websocket: 'WebSocket',
  postgres: 'PostgreSQL', sqlite: 'SQLite', mongo: 'MongoDB', firebase: 'Firebase',
  capacitor: 'Capacitor', docker: 'Docker', grafana: 'Grafana', selenium: 'Selenium', git: 'Git',
  llm: 'LLM APIs', cursor: 'Cursor', claudecode: 'Claude Code',
  rag: 'RAG', agents: 'AI agents', mcp: 'MCP', prompting: 'Prompt engineering',
  supabase: 'Supabase', gemini: 'Gemini', vite: 'Vite', pwa: 'PWA', vitest: 'Vitest', webaudio: 'Web Audio',
  excel: 'Excel', statistics: 'Statistics', economics: 'Economics',
};

export const SCENES = [
  { id: 'hero', kind: 'hero', weight: 1.2 },

  { id: 'bgu', kind: 'root', weight: 1,
    skills: ['economics', 'statistics'] },
  { id: 'tutor', kind: 'root', weight: 0.9,
    skills: ['excel'] },
  { id: 'adamot', kind: 'root', weight: 1,
    skills: [] },

  { id: 'masterschool', kind: 'trunk', weight: 1.2,
    skills: ['python', 'javascript', 'html', 'css', 'flask', 'fastapi', 'sqlite', 'git', 'c'] },

  { id: 'webeet', kind: 'branch', weight: 1.2, branches: 2,
    skills: ['react', 'nextjs', 'typescript', 'tailwind', 'firebase', 'mongo', 'websocket', 'node'] },
  { id: 'rokka', kind: 'branch', weight: 1.8, branches: 3,
    skills: ['redux', 'saga', 'django', 'drf', 'postgres', 'capacitor', 'docker', 'grafana',
      'celery', 'redis', 'express', 'selenium', 'llm', 'cursor', 'claudecode'] },
  { id: 'elevation', kind: 'branch', weight: 1, branches: 2,
    skills: ['prompting', 'rag', 'agents', 'mcp'] },

  { id: 'fridger', kind: 'fruit', weight: 2.2,
    links: { live: 'https://fridger-app.netlify.app', repo: 'https://github.com/shalomavi/fridger' },
    media: { poster: 'assets/fridger/promo.gif', video: 'assets/fridger/promo.mp4' },
    skills: ['supabase', 'gemini', 'vite', 'pwa', 'vitest', 'webaudio'] },

  { id: 'contact', kind: 'contact', weight: 1.3 },
];

// Adds span: [p0, p1] on the 0..1 scroll axis to each scene.
export function withSpans(scenes) {
  const total = scenes.reduce((s, c) => s + c.weight, 0);
  let acc = 0;
  return scenes.map((scene) => {
    const p0 = acc / total;
    acc += scene.weight;
    return { ...scene, span: [p0, acc / total] };
  });
}

export const QUALITY = {
  high: { dust: 1600, sap: 1400, decorLeaves: 900, dprCap: 2, bloomScale: 1 },
  mid: { dust: 900, sap: 700, decorLeaves: 550, dprCap: 1.5, bloomScale: 0.5 },
  low: { dust: 400, sap: 300, decorLeaves: 300, dprCap: 1.25, bloomScale: 0.5 },
};
