import http from 'node:http';
import { GoogleGenAI } from '@google/genai';
import { GoogleAuth } from 'google-auth-library';

const PORT = Number(process.env.PORT || 8080);
const PROCESSOR_SHARED_SECRET = process.env.PROCESSOR_SHARED_SECRET || '';
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || '';
const GCP_REGION = process.env.GCP_REGION || 'us-central1';
const API_TIMEOUT_MS = 120_000;
const UPSCALE_TIMEOUT_MS = 180_000;
const DEFAULT_OUTPUT_RESOLUTION = '2K';
const SUPPORTED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const UPSCALE_MIME_TYPES = new Set(['image/jpeg', 'image/png']);

const CORE_SYSTEM_PROMPT = `===============================================================
SYSTEM DIRECTIVE - PHOTO RESTORATION CORE RULES v4.0
===============================================================

You are an expert forensic photograph restoration specialist.
Your mission: restore degraded photographs with maximum fidelity to the original subjects and scene.

STRICTLY FORBIDDEN:
- Altering, idealizing, beautifying, or reconstructing facial identity.
- Changing expressions, age, or ethnicity.
- Introducing AI-generated plastic textures or unnatural smoothness.
- Hallucinating new objects or background elements not present in the original.

CORE PRINCIPLES:
1. IDENTITY PRESERVATION: Every facial feature must be preserved with 100% accuracy.
2. PHOTOGRAPHIC AUTHENTICITY: The output must look like a real, high-end historical photograph, not a digital painting.
3. UNIFORM QUALITY: Every region must receive identical restoration quality.
===============================================================`;

const PORTRAIT_SPECIALIST_MODULE = `=== PORTRAIT SPECIALIST MODE ===
- Recover facial micro-detail faithfully.
- Reconstruct damaged clothing texture realistically.
- Remove scratches, mold, stains, and blur without plastic smoothing.`;

const GROUP_SPECIALIST_MODULE = `=== GROUP AND SCENE SPECIALIST MODE ===
- Keep every subject equally restored.
- Preserve realistic depth and background integrity.
- Maintain consistent lighting and material detail across the whole frame.`;

const ID_PHOTO_CORE_PROMPT = `===============================================================
SYSTEM DIRECTIVE - ID PHOTO STUDIO RULES v1.0
===============================================================
You are an expert biometric-safe ID photo editor.
Preserve exact identity above all else.
Never beautify the face into a different person.
Output must look like a realistic formal studio ID photo.
===============================================================`;

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
  });
  response.end(message);
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    request.on('data', (chunk) => {
      chunks.push(chunk);
    });

    request.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });

    request.on('error', reject);
  });
}

function requireSharedSecret(request) {
  if (!PROCESSOR_SHARED_SECRET) {
    throw new Error('PROCESSOR_SHARED_SECRET is not configured on Cloud Run.');
  }

  const suppliedSecret = request.headers['x-processor-secret'];
  if (suppliedSecret !== PROCESSOR_SHARED_SECRET) {
    const error = new Error('Unauthorized processor request.');
    error.statusCode = 401;
    throw error;
  }
}

function extractImagePayload(imageDataUri) {
  const [metaPart, base64Data] = String(imageDataUri || '').split(',');
  const rawMimeType = metaPart?.split(';')?.[0]?.split(':')?.[1] || '';
  const mimeType = rawMimeType === 'image/jpg' ? 'image/jpeg' : rawMimeType;

  if (!base64Data) {
    throw new Error('Ảnh không hợp lệ. Vui lòng chọn lại ảnh.');
  }

  if (!SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error(`Định dạng ảnh ${mimeType || '(không xác định)'} chưa được hỗ trợ. Vui lòng dùng JPG, PNG hoặc WEBP.`);
  }

  return { base64Data, mimeType };
}

function extractImageFromResponse(response) {
  const parts = response?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return `data:${part.inlineData.mimeType || 'image/jpeg'};base64,${part.inlineData.data}`;
    }
  }
  return '';
}

function usageFromResponse(response) {
  const usage = response?.usageMetadata || {};
  const inputTokens = Number(usage.promptTokenCount ?? usage.inputTokenCount ?? 0);
  const outputTokens = Number(usage.candidatesTokenCount ?? usage.outputTokenCount ?? 0);
  return { inputTokens, outputTokens };
}

function supportsImageInputError(error) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /does not support image input|Cannot read\s+"image\.[^"]+"/i.test(message);
}

function isTimeoutError(error) {
  const message = error instanceof Error ? error.message : String(error || '');
  return message.startsWith('Timeout');
}

function restoreModelFallbacks(model) {
  if (model === 'gemini-3.1-flash-image-preview') {
    return ['gemini-3.1-flash-image-preview', 'gemini-3-pro-image-preview'];
  }

  return ['gemini-3-pro-image-preview', 'gemini-3.1-flash-image-preview'];
}

function buildUserPrompt(analysisData, options) {
  const colorLabel = analysisData.is_black_white ? 'B&W' : analysisData.is_sepia ? 'Sepia' : 'Color';
  const isPortraitPhoto =
    analysisData.photo_type.includes('portrait_single') ||
    analysisData.photo_type.includes('child_portrait') ||
    analysisData.photo_type.includes('elderly_portrait');
  const specializedModule = isPortraitPhoto ? PORTRAIT_SPECIALIST_MODULE : GROUP_SPECIALIST_MODULE;

  let prompt = `${CORE_SYSTEM_PROMPT}\n\n${specializedModule}\n\n=== CONFIRMED PHOTO ANALYSIS ===\nPhoto type       : ${analysisData.photo_type}\nSubjects         : ${analysisData.subject_count} person(s) · face size: ${analysisData.face_sizes}\nColor mode       : ${colorLabel}\nEstimated era    : ${analysisData.era_estimate}\nDamage types     : ${analysisData.damage_types?.length ? analysisData.damage_types.join(', ') : 'general aging'}\nDamage severity  : ${analysisData.damage_severity}\nBackground       : ${analysisData.background_complexity} complexity · importance: ${analysisData.background_importance}\nOutput resolution: ${DEFAULT_OUTPUT_RESOLUTION}\nColorize option  : ${options.colorize ? 'enabled by user' : 'disabled by user'}`;

  if (analysisData.special_challenges) {
    prompt += `\nSpecial challenge: ${analysisData.special_challenges}`;
  }

  if (options.colorize) {
    prompt += '\n\n=== COLORIZATION ===\n- Colorize naturally and historically accurately.';
  }

  if (isPortraitPhoto && options.replaceClothing && options.clothingPrompt) {
    prompt += `\n\n=== CLOTHING REPLACEMENT ===\n- Replace current clothing with: ${options.clothingPrompt}`;
  }

  prompt += '\n\nCRITICAL: Output ONE complete restored image at the highest possible quality.';
  return prompt;
}

function buildIdPhotoPrompt(options) {
  const backgroundInstruction = options.backgroundMode === 'custom'
    ? (options.backgroundCustomPrompt?.trim() || 'Clean solid studio background, uniform and distraction-free.')
    : options.backgroundMode === 'white'
    ? 'Pure white studio background, clean, uniform, and shadow-free.'
    : options.backgroundMode === 'blue'
    ? 'Solid light blue ID photo background, clean, uniform, and shadow-free.'
    : 'Soft light gray studio background, neutral, clean, and uniform.';

  let prompt = `${ID_PHOTO_CORE_PROMPT}\n\n=== OUTPUT FORMAT ===\n- Final aspect ratio: ${options.aspectRatio}\n- Output resolution: ${DEFAULT_OUTPUT_RESOLUTION}\n- Maintain clean official ID-photo composition.\n\n=== BACKGROUND ===\n- ${backgroundInstruction}\n\n=== SAFETY ===\n- Preserve exact facial identity, age, skin texture, and recognizable facial proportions.\n- Do not beautify or redesign facial structure.`;

  if (options.replaceClothing && options.clothingPrompt) {
    prompt += `\n\n=== CLOTHING ===\n- Replace clothing with: ${options.clothingPrompt}`;
  }

  if (options.additionalInstructions?.trim()) {
    prompt += `\n\n=== USER EXTRA NOTES ===\n- ${options.additionalInstructions.trim()}`;
  }

  prompt += '\n\nCRITICAL: Output ONE complete ID photo image.';
  return prompt;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, timeoutMs, label) {
  return new Promise((resolve, reject) => {
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

async function generateWithRetry(ai, params, label, maxRetries = 2) {
  let lastError = null;

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

async function runImageGeneration(apiKey, modelName, base64Data, mimeType, prompt, label) {
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

async function processRestoreImage(apiKey, imageDataUri, analysisData, options) {
  const { base64Data, mimeType } = extractImagePayload(imageDataUri);
  const prompt = buildUserPrompt(analysisData, options);
  const fallbackModels = restoreModelFallbacks(options.model);

  let response = null;
  let lastError = null;

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
      costUsd: 0,
    },
  };
}

async function processIdPhoto(apiKey, imageDataUri, options) {
  const { base64Data, mimeType } = extractImagePayload(imageDataUri);
  const prompt = buildIdPhotoPrompt(options);
  const fallbackModels = restoreModelFallbacks(options.model);

  let response = null;
  let lastError = null;

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
      costUsd: 0,
    },
  };
}

async function processUpscale(imageDataUri, upscaleFactor) {
  if (!GCP_PROJECT_ID) {
    throw new Error('GCP_PROJECT_ID chưa được cấu hình trên Cloud Run.');
  }

  const { base64Data, mimeType } = extractImagePayload(imageDataUri);

  if (!UPSCALE_MIME_TYPES.has(mimeType)) {
    throw new Error(`Upscale chỉ hỗ trợ JPEG và PNG. Định dạng hiện tại: ${mimeType}`);
  }

  const validFactors = ['x2', 'x4'];
  if (!validFactors.includes(upscaleFactor)) {
    throw new Error(`Upscale factor không hợp lệ: ${upscaleFactor}. Chỉ hỗ trợ: ${validFactors.join(', ')}`);
  }

  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const accessToken = (await client.getAccessToken()).token;

  const endpoint = `https://${GCP_REGION}-aiplatform.googleapis.com/v1/projects/${GCP_PROJECT_ID}/locations/${GCP_REGION}/publishers/google/models/imagen-4.0-upscale-preview:predict`;

  const requestBody = {
    instances: [
      {
        prompt: 'Upscale the image with maximum quality and sharpness',
        image: { bytesBase64Encoded: base64Data },
      },
    ],
    parameters: {
      mode: 'upscale',
      upscaleConfig: { upscaleFactor },
      outputOptions: {
        mimeType: mimeType === 'image/png' ? 'image/png' : 'image/jpeg',
        compressionQuality: 95,
      },
    },
  };

  const fetchPromise = fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const res = await withTimeout(fetchPromise, UPSCALE_TIMEOUT_MS, 'Imagen Upscale');

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Imagen Upscale lỗi (${res.status}): ${errText}`);
  }

  const result = await res.json();
  const prediction = result.predictions?.[0];

  if (!prediction?.bytesBase64Encoded) {
    throw new Error('Imagen Upscale không trả về ảnh. Vui lòng thử lại.');
  }

  const outputMime = prediction.mimeType || mimeType;
  return {
    image: `data:${outputMime};base64,${prediction.bytesBase64Encoded}`,
  };
}

async function handleProcessUpscale(request, response) {
  requireSharedSecret(request);
  const body = await readRequestBody(request);

  if (!body.imageDataUri || !body.upscaleFactor) {
    sendText(response, 400, 'Thiếu imageDataUri hoặc upscaleFactor.');
    return;
  }

  const result = await processUpscale(body.imageDataUri, body.upscaleFactor);
  sendJson(response, 200, result);
}

async function handleProcessRestore(request, response) {
  requireSharedSecret(request);
  const body = await readRequestBody(request);

  if (!body.apiKey || !body.imageDataUri || !body.analysis || !body.options) {
    sendText(response, 400, 'Thiếu dữ liệu xử lý ảnh.');
    return;
  }

  const result = await processRestoreImage(body.apiKey, body.imageDataUri, body.analysis, body.options);
  sendJson(response, 200, result);
}

async function handleProcessIdPhoto(request, response) {
  requireSharedSecret(request);
  const body = await readRequestBody(request);

  if (!body.apiKey || !body.imageDataUri || !body.options) {
    sendText(response, 400, 'Thiếu dữ liệu tạo ID photo.');
    return;
  }

  const result = await processIdPhoto(body.apiKey, body.imageDataUri, body.options);
  sendJson(response, 200, result);
}

const server = http.createServer(async (request, response) => {
  try {
    if (!request.url) {
      sendText(response, 404, 'Not found');
      return;
    }

    if (request.method === 'GET' && request.url === '/health') {
      sendJson(response, 200, {
        ok: true,
        service: 'photorestore-gemini-processor',
        runtime: 'google-cloud-run',
        sharedSecretConfigured: Boolean(PROCESSOR_SHARED_SECRET),
      });
      return;
    }

    if (request.method === 'POST' && request.url === '/process/restore') {
      await handleProcessRestore(request, response);
      return;
    }

    if (request.method === 'POST' && request.url === '/process/id-photo') {
      await handleProcessIdPhoto(request, response);
      return;
    }

    if (request.method === 'POST' && request.url === '/process/upscale') {
      await handleProcessUpscale(request, response);
      return;
    }

    sendText(response, 404, 'Not found');
  } catch (error) {
    const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : 'Internal server error';
    sendText(response, statusCode, message);
  }
});

server.listen(PORT, () => {
  console.log(`Gemini processor listening on port ${PORT}`);
});
