import { encryptApiKey } from '../../_lib/crypto';
import type { Env } from '../../_lib/env';
import { jsonWithSession } from '../../_lib/response';
import { getOrCreateGuestSession } from '../../_lib/session';

interface SaveApiKeyBody {
  apiKey?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  if (!env.MASTER_SECRET) {
    return new Response('MASTER_SECRET is not configured.', { status: 500 });
  }

  const { userId, setCookie } = getOrCreateGuestSession(request);
  const body = (await request.json()) as SaveApiKeyBody;
  const apiKey = body.apiKey?.trim();

  if (!apiKey) {
    return new Response('API key is required.', { status: 400 });
  }

  const encrypted = await encryptApiKey(apiKey, env.MASTER_SECRET);

  await env.DB
    .prepare(
      `INSERT INTO user_settings (user_id, gemini_api_key_enc, iv)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         gemini_api_key_enc = excluded.gemini_api_key_enc,
         iv = excluded.iv`,
    )
    .bind(userId, encrypted.cipherText, encrypted.iv)
    .run();

  return jsonWithSession(
    {
      ok: true,
      hasApiKey: true,
      userId,
    },
    userId,
    setCookie,
  );
};

export const onRequestDelete: PagesFunction<Env> = async ({ env, request }) => {
  const { userId, setCookie } = getOrCreateGuestSession(request);

  await env.DB.prepare('DELETE FROM user_settings WHERE user_id = ?').bind(userId).run();

  return jsonWithSession(
    {
      ok: true,
      hasApiKey: false,
      userId,
    },
    userId,
    setCookie,
  );
};
