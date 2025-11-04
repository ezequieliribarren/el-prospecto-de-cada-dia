import axios from 'axios';

let CURRENT_BASE = (typeof window !== 'undefined' && localStorage.getItem('apiBase'))
  || process.env.NEXT_PUBLIC_API_BASE
  || 'http://localhost:4000/api';

const CANDIDATE_BASES = Array.from(new Set([
  process.env.NEXT_PUBLIC_API_BASE || '',
  'http://localhost:4000/api',
  'http://127.0.0.1:4000/api',
  'http://localhost:4001/api',
  'http://127.0.0.1:4001/api',
  'http://localhost:4002/api',
  'http://127.0.0.1:4002/api',
].filter(Boolean)));

export const api = axios.create({ baseURL: CURRENT_BASE, withCredentials: true });

let detectionPromise: Promise<void> | null = null;
async function detectBase() {
  if (detectionPromise) return detectionPromise;
  detectionPromise = (async () => {
    for (const base of [CURRENT_BASE, ...CANDIDATE_BASES]) {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 800);
        const res = await fetch(base.replace(/\/$/, '') + '/health', { credentials: 'include', signal: controller.signal });
        clearTimeout(t);
        if (res.ok) {
          CURRENT_BASE = base;
          if (typeof window !== 'undefined') localStorage.setItem('apiBase', CURRENT_BASE);
          api.defaults.baseURL = CURRENT_BASE;
          return;
        }
      } catch (_) {}
    }
  })();
  return detectionPromise;
}

api.interceptors.request.use(async (config) => {
  await detectBase();
  config.baseURL = CURRENT_BASE;
  config.withCredentials = true;
  return config;
});

export function apiUrl(path: string) {
  return `${CURRENT_BASE}${path}`;
}

export const API_BASE = CURRENT_BASE;

export async function ensureApiBase(): Promise<{ base: string; up: boolean }> {
  await detectBase();
  try {
    const res = await fetch(`${CURRENT_BASE.replace(/\/$/, '')}/health`, { credentials: 'include' });
    return { base: CURRENT_BASE, up: res.ok };
  } catch {
    return { base: CURRENT_BASE, up: false };
  }
}
