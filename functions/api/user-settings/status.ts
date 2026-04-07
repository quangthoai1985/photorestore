import type { Env } from '../../_lib/env';
import { jsonWithSession } from '../../_lib/response';
import { getOrCreateGuestSession } from '../../_lib/session';

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const { userId, setCookie } = getOrCreateGuestSession(request);

  const result = await env.DB
    .prepare('SELECT 1 FROM user_settings WHERE user_id = ?')
    .bind(userId)
    .first();

  return jsonWithSession(
    {
      hasApiKey: Boolean(result),
      userId,
    },
    userId,
    setCookie,
  );
};
