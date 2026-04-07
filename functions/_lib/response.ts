import { applyGuestSessionCookie } from './session';

export function jsonWithSession(data: unknown, userId: string, shouldSetCookie: boolean, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');

  if (shouldSetCookie) {
    applyGuestSessionCookie(headers, userId);
  }

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}
