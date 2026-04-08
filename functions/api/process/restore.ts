import { decryptApiKey } from '../../_lib/crypto';
import type { Env } from '../../_lib/env';
import { callGeminiProcessor } from '../../_lib/processor';
import { jsonWithSession } from '../../_lib/response';
import { getOrCreateGuestSession } from '../../_lib/session';
import type { AnalysisResult, RestoreOptions } from '../../../src/shared/types';

interface RestoreRequestBody {
  imageDataUri?: string;
  analysis?: AnalysisResult;
  options?: RestoreOptions;
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const { userId, setCookie } = getOrCreateGuestSession(request);
  const body = (await request.json()) as RestoreRequestBody;

  if (!body.imageDataUri || !body.analysis || !body.options) {
    return new Response('Thiếu dữ liệu xử lý ảnh.', { status: 400 });
  }

  if (!env.MASTER_SECRET) {
    return new Response('MASTER_SECRET is not configured.', { status: 500 });
  }

  try {
    const userSettings = await env.DB
      .prepare('SELECT gemini_api_key_enc, iv FROM user_settings WHERE user_id = ?')
      .bind(userId)
      .first<{ gemini_api_key_enc: string; iv: string }>();

    if (!userSettings) {
      return new Response('Bạn chưa cấu hình Gemini API key cho session này.', { status: 400 });
    }

    const apiKey = await decryptApiKey(userSettings.gemini_api_key_enc, userSettings.iv, env.MASTER_SECRET);
    const result = await callGeminiProcessor(env, '/process/restore', {
      apiKey,
      imageDataUri: body.imageDataUri,
      analysis: body.analysis,
      options: body.options,
    });

    await env.DB
      .prepare(
        'INSERT INTO usage_logs (user_id, task_type, input_tokens, output_tokens, cost_usd) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(userId, 'restore', result.usage.inputTokens, result.usage.outputTokens, result.usage.costUsd)
      .run();

    return jsonWithSession(
      {
        image: result.image,
        usage: result.usage,
      },
      userId,
      setCookie,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Đã xảy ra lỗi khi phục hồi ảnh.';
    const isDecryptError = /decrypt|AES-GCM|operation-specific reason/i.test(message);

    return new Response(
      isDecryptError
        ? 'Không thể giải mã Gemini API key đã lưu. Có thể MASTER_SECRET đã thay đổi sau khi chuyển hệ thống. Hãy lưu lại API key một lần nữa.'
        : message,
      { status: 500 },
    );
  }
};
