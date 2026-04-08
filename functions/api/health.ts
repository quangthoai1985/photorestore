import type { Env } from '../_lib/env';
import { checkGeminiProcessorHealth } from '../_lib/processor';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  let databaseOk = false;
  let databaseError: string | null = null;

  try {
    await env.DB.prepare('SELECT 1 as ok').first();
    databaseOk = true;
  } catch (error) {
    databaseError = error instanceof Error ? error.message : 'Unknown D1 error';
  }

  const processor = await checkGeminiProcessorHealth(env);

  return Response.json({
    ok: databaseOk && processor.ok,
    service: 'photorestore',
    runtime: 'cloudflare-pages-functions',
    masterSecretConfigured: Boolean(env.MASTER_SECRET),
    processorConfigured: Boolean(env.GEMINI_PROCESSOR_URL && env.PROCESSOR_SHARED_SECRET),
    database: {
      ok: databaseOk,
      error: databaseError,
    },
    processor,
  });
};
