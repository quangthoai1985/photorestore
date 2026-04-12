import type { Env } from './env';

interface ProcessorResponse {
  image: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  };
}

interface UpscaleResponse {
  image: string;
}

function normalizeProcessorBaseUrl(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function ensureProcessorConfigured(env: Env) {
  if (!env.GEMINI_PROCESSOR_URL) {
    throw new Error('GEMINI_PROCESSOR_URL is not configured.');
  }

  if (!env.PROCESSOR_SHARED_SECRET) {
    throw new Error('PROCESSOR_SHARED_SECRET is not configured.');
  }

  return {
    baseUrl: normalizeProcessorBaseUrl(env.GEMINI_PROCESSOR_URL),
    sharedSecret: env.PROCESSOR_SHARED_SECRET,
  };
}

export async function callUpscaleProcessor(
  env: Env,
  payload: unknown,
): Promise<UpscaleResponse> {
  const { baseUrl, sharedSecret } = ensureProcessorConfigured(env);

  const response = await fetch(`${baseUrl}/process/upscale`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Processor-Secret': sharedSecret,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Upscale processor failed with status ${response.status}`);
  }

  return response.json() as Promise<UpscaleResponse>;
}

export async function callGeminiProcessor(
  env: Env,
  path: '/process/restore' | '/process/id-photo',
  payload: unknown,
): Promise<ProcessorResponse> {
  const { baseUrl, sharedSecret } = ensureProcessorConfigured(env);

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Processor-Secret': sharedSecret,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Gemini processor failed with status ${response.status}`);
  }

  return response.json() as Promise<ProcessorResponse>;
}

export async function checkGeminiProcessorHealth(env: Env) {
  if (!env.GEMINI_PROCESSOR_URL) {
    return {
      configured: false,
      ok: false,
      error: 'GEMINI_PROCESSOR_URL is not configured.',
    };
  }

  const baseUrl = normalizeProcessorBaseUrl(env.GEMINI_PROCESSOR_URL);

  try {
    const response = await fetch(`${baseUrl}/health`);
    const body = await response.json().catch(() => null);

    return {
      configured: true,
      ok: response.ok,
      status: response.status,
      body,
      error: response.ok ? null : `Processor health check failed with status ${response.status}`,
    };
  } catch (error) {
    return {
      configured: true,
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown processor error',
    };
  }
}
