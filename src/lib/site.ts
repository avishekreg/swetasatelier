/** Canonical production site. */
export const PRODUCTION_APP_URL = 'https://swetasatelier.vercel.app';

/** Prefer current origin in browser; fall back to env / production URL. */
export function getAppOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  const fromEnv = import.meta.env.VITE_APP_URL;
  return String(fromEnv || PRODUCTION_APP_URL).replace(/\/+$/, '');
}

export function appUrl(path = '/'): string {
  const origin = getAppOrigin();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${normalized}`;
}
