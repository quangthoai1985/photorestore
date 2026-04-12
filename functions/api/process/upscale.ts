import type { Env } from '../../_lib/env';
import { callUpscaleProcessor } from '../../_lib/processor';
import { jsonWithSession } from '../../_lib/response';
import { getOrCreateGuestSession } from '../../_lib/session';

interface UpscaleRequestBody {
  imageDataUri?: string;
  upscaleFactor?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const { userId, setCookie } = getOrCreateGuestSession(request);
  const body = (await request.json()) as UpscaleRequestBody;

  if (!body.imageDataUri || !body.upscaleFactor) {
    return new Response('Thiếu imageDataUri hoặc upscaleFactor.', { status: 400 });
  }

  try {
    const result = await callUpscaleProcessor(env, {
      imageDataUri: body.imageDataUri,
      upscaleFactor: body.upscaleFactor,
    });

    await env.DB
      .prepare(
        'INSERT INTO usage_logs (user_id, task_type, input_tokens, output_tokens, cost_usd) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(userId, 'upscale', 0, 0, 0)
      .run();

    return jsonWithSession(
      { image: result.image },
      userId,
      setCookie,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Đã xảy ra lỗi khi upscale ảnh.';
    return new Response(message, { status: 500 });
  }
};
