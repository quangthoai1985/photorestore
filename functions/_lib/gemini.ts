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

interface ReferenceImage {
  label: string;
  base64Data: string;
  mimeType: string;
}

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

async function runImageGeneration(
  apiKey: string,
  modelName: string,
  base64Data: string,
  mimeType: string,
  prompt: string,
  label: string,
  referenceImages?: ReferenceImage[],
) {
  const ai = new GoogleGenAI({ apiKey });

  const parts: any[] = [];

  // Label and add subject photo
  if (referenceImages?.length) {
    parts.push({ text: '=== SUBJECT PHOTO (Image 1) ===' });
  }
  parts.push({ inlineData: { data: base64Data, mimeType } });

  // Add reference images with labels
  if (referenceImages?.length) {
    let imageIndex = 2;
    for (const ref of referenceImages) {
      parts.push({ text: `=== ${ref.label} (Image ${imageIndex}) ===` });
      parts.push({ inlineData: { data: ref.base64Data, mimeType: ref.mimeType } });
      imageIndex += 1;
    }
  }

  // Add prompt text last
  parts.push({ text: prompt });

  return generateWithRetry(
    ai,
    {
      model: modelName,
      contents: { parts },
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

  // Build reference images array
  const referenceImages: ReferenceImage[] = [];

  if (options.replaceClothing && options.clothingMode === 'reference_image' && options.clothingReferenceImage) {
    const clothingPayload = extractImagePayload(options.clothingReferenceImage);
    referenceImages.push({
      label: 'REFERENCE CLOTHING',
      base64Data: clothingPayload.base64Data,
      mimeType: clothingPayload.mimeType,
    });
  }

  if (options.backgroundMode === 'reference_image' && options.backgroundReferenceImage) {
    const bgPayload = extractImagePayload(options.backgroundReferenceImage);
    referenceImages.push({
      label: 'REFERENCE BACKGROUND',
      base64Data: bgPayload.base64Data,
      mimeType: bgPayload.mimeType,
    });
  }

  let response: any = null;
  let lastError: unknown = null;

  for (const model of fallbackModels) {
    try {
      response = await runImageGeneration(apiKey, model, base64Data, mimeType, prompt, `IdPhoto:${model}`, referenceImages.length > 0 ? referenceImages : undefined);
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
