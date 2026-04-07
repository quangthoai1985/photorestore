const SESSION_COOKIE = 'qt_guest_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 365;

function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};

  return Object.fromEntries(
    cookieHeader
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=');
        if (index === -1) return [part, ''];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

export function getOrCreateGuestSession(request: Request): { userId: string; setCookie: boolean } {
  const cookies = parseCookies(request.headers.get('Cookie'));
  const existing = cookies[SESSION_COOKIE];

  if (existing) {
    return { userId: existing, setCookie: false };
  }

  return {
    userId: crypto.randomUUID(),
    setCookie: true,
  };
}

export function applyGuestSessionCookie(headers: Headers, userId: string) {
  headers.append(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(userId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}; Secure`,
  );
}
