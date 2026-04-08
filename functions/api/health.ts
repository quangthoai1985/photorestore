import type { Env } from '../_lib/env';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  let databaseOk = false;
  let databaseError: string | null = null;

  try {
    await env.DB.prepare('SELECT 1 as ok').first();
    databaseOk = true;
  } catch (error) {
    databaseError = error instanceof Error ? error.message : 'Unknown D1 error';
  }

  return Response.json({
    ok: databaseOk,
    service: 'photorestore',
    runtime: 'cloudflare-pages-functions',
    masterSecretConfigured: Boolean(env.MASTER_SECRET),
    database: {
      ok: databaseOk,
      error: databaseError,
    },
  });
};
