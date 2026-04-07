import { GoogleGenAI } from '@google/genai';
import {
  API_TIMEOUT_MS,
  DEFAULT_OUTPUT_RESOLUTION,
  buildIdPhotoPrompt,
  buildUserPrompt,
  extractImageFromResponse,
  extractImagePayload,
  isTimeoutError,
  restoreModelFallbacks,
  supportsImageInputError,
} from '../../src/shared/geminiPipeline';
import type { AnalysisResult, IdPhotoOptions, RestoreOptions } from '../../src/shared/types';

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout sau ${timeoutMs / 1000}s tại bước: ${label}`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function generateWithRetry(ai: GoogleGenAI, params: any, label: string, maxRetries = 2) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      if (attempt > 0) {
        await delay(attempt * 6000);
      }

      return await withTimeout(ai.models.generateContent(params), API_TIMEOUT_MS, label);
    } catch (error) {
      lastError = error;

      if (!supportsImageInputError(error) || attempt === maxRetries || isTimeoutError(error)) {
        throw error;
      }
    }
  }

  throw lastError;
}

function usageFromResponse(response: any) {
  const usage = response?.usageMetadata ?? {};
  const inputTokens = Number(usage.promptTokenCount ?? usage.inputTokenCount ?? 0);
  const outputTokens = Number(usage.candidatesTokenCount ?? usage.outputTokenCount ?? 0);
  return { inputTokens, outputTokens };
}

function calculateCostUsd(inputTokens: number, outputTokens: number) {
  return 0;
}

async function runImageGeneration(apiKey: string, modelName: string, base64Data: string, mimeType: string, prompt: string, label: string) {
  const ai = new GoogleGenAI({ apiKey });

  return generateWithRetry(
    ai,
    {
      model: modelName,
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { text: prompt },
        ],
      },
      config: {
        temperature: 0.1,
        responseModalities: ['IMAGE', 'TEXT'],
        imageConfig: {
          imageSize: DEFAULT_OUTPUT_RESOLUTION,
        },
      },
    },
    label,
  );
}

export async function processRestoreImage(apiKey: string, imageDataUri: string, analysisData: AnalysisResult, options: RestoreOptions) {
  const { base64Data, mimeType } = extractImagePayload(imageDataUri);
  const prompt = buildUserPrompt(analysisData, options);
  const fallbackModels = restoreModelFallbacks(options.model);

  let response: any = null;
  let lastError: unknown = null;

  for (const model of fallbackModels) {
    try {
      response = await runImageGeneration(apiKey, model, base64Data, mimeType, prompt, `GlobalRestore:${model}`);
      break;
    } catch (error) {
      lastError = error;
      const isLastModel = model === fallbackModels[fallbackModels.length - 1];
      const shouldFallback = supportsImageInputError(error) || (isTimeoutError(error) && model === 'gemini-3.1-flash-image-preview');

      if (!shouldFallback || isLastModel) {
        throw error;
      }
    }
  }

  if (!response && lastError) {
    throw lastError;
  }

  const image = extractImageFromResponse(response);
  if (!image) {
    throw new Error('Model không trả về ảnh. Vui lòng thử lại hoặc chọn model khác.');
  }

  const usage = usageFromResponse(response);

  return {
    image,
    usage: {
      ...usage,
      costUsd: calculateCostUsd(usage.inputTokens, usage.outputTokens),
    },
  };
}

export async function processIdPhoto(apiKey: string, imageDataUri: string, options: IdPhotoOptions) {
  const { base64Data, mimeType } = extractImagePayload(imageDataUri);
  const prompt = buildIdPhotoPrompt(options);
  const fallbackModels = restoreModelFallbacks(options.model);

  let response: any = null;
  let lastError: unknown = null;

  for (const model of fallbackModels) {
    try {
      response = await runImageGeneration(apiKey, model, base64Data, mimeType, prompt, `IdPhoto:${model}`);
      break;
    } catch (error) {
      lastError = error;
      const isLastModel = model === fallbackModels[fallbackModels.length - 1];
      const shouldFallback = supportsImageInputError(error) || (isTimeoutError(error) && model === 'gemini-3.1-flash-image-preview');

      if (!shouldFallback || isLastModel) {
        throw error;
      }
    }
  }

  if (!response && lastError) {
    throw lastError;
  }

  const image = extractImageFromResponse(response);
  if (!image) {
    throw new Error('Model không trả về ảnh ID. Vui lòng thử lại hoặc đổi model khác.');
  }

  const usage = usageFromResponse(response);

  return {
    image,
    usage: {
      ...usage,
      costUsd: calculateCostUsd(usage.inputTokens, usage.outputTokens),
    },
  };
}
