/**
 * Safe, environment-aware API base resolver for ULTIDA web client.
 * In production (e.g. https://ultida.vercel.app), relative '/api' is used to talk
 * to the co-hosted serverless functions without leaking localhost:8800 calls.
 */
export function getApiBase(): string {
  const configured = String(import.meta.env.VITE_API_BASE ?? '').trim();
  if (typeof window !== 'undefined') {
    if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(window.location.origin)) {
      return '/api';
    }
  }
  return configured || '/api';
}

export const apiBase = getApiBase;
