import { useState, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';

// ─────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT BẤT BIẾN — từ photo-restoration-pipeline-v4.md
// ─────────────────────────────────────────────────────────────────────────
const CORE_SYSTEM_PROMPT = `===============================================================
SYSTEM DIRECTIVE — PHOTO RESTORATION CORE RULES v4.0
===============================================================

You are an expert forensic photograph restoration specialist. 
Your mission: restore degraded photographs with maximum fidelity to the original subjects and scene.

STRICTLY FORBIDDEN:
✗ Altering, idealizing, beautifying, or reconstructing facial identity.
✗ Changing expressions, age, or ethnicity.
✗ Introducing AI-generated "plastic" textures or unnatural smoothness.
✗ Hallucinating new objects or background elements not present in the original.

CORE PRINCIPLES:
1. IDENTITY PRESERVATION: Every facial feature must be preserved with 100% accuracy.
2. PHOTOGRAPHIC AUTHENTICITY: The output must look like a real, high-end historical photograph, not a digital painting.
3. UNIFORM QUALITY: Every region (face, clothing, background) must receive identical restoration quality.

VIOLATION OF THESE RULES = RESTORATION FAILURE.
===============================================================`;

// ─────────────────────────────────────────────────────────────────────────
// SPECIALIZED MODULES
// ─────────────────────────────────────────────────────────────────────────

const PORTRAIT_SPECIALIST_MODULE = `=== PORTRAIT SPECIALIST MODE: MICRO-DETAIL & MATERIAL FOCUS ===

Your primary objective is extreme precision on the central subject.

1. FACIAL MICRO-TEXTURES:
- Recover microscopic details: skin pores, fine facial hairs, subtle wrinkles, and natural moisture in eyes.
- Avoid any "beauty filter" effect; maintain all natural imperfections (moles, scars, asymmetry).

2. ADVANCED CLOTHING RECONSTRUCTION:
- MATERIAL SYNTHESIS: Identify the fabric type (e.g., Silk, Cotton, Wool, Lace, Velvet, Vest). 
- DEEP TEXTURE RECOVERY: If the fabric is damaged, blurred, or faded, DO NOT just smooth it. Reconstruct the physical weave patterns, thread details, and natural fabric folds.
- LIGHTING ON FABRIC: Replicate how light interacts with the specific material (e.g., the sheen of silk vs. the matte texture of wool).

3. NOISE & DAMAGE ERADICATION:
- Treat dust, scratches, mold, and stains as physical obstructions. Remove them to reveal the underlying material texture, rather than just blurring them.

OUTPUT GOAL: A high-end, professional portrait that looks like it was captured with a premium prime lens.`;

const GROUP_SPECIALIST_MODULE = `=== GROUP & SCENE SPECIALIST MODE: UNIFORMITY & DEPTH FOCUS ===

Your primary objective is maintaining consistency across multiple subjects and the entire environment.

1. GLOBAL UNIFORMITY & CONSISTENCY:
- SUBJECT EQUALITY: Ensure every person in the frame, whether large or small, receives identical restoration quality and sharpness.
- LIGHTING COHESION: Maintain consistent lighting, shadows, and color temperature across all subjects and the entire scene.

2. SCENE & BACKGROUND INTEGRITY:
- ARCHITECTURAL RECONSTRUCTION: Treat the background as a primary subject. Recover textures of walls, furniture, floor, or any environmental elements.
- DEPTH OF FIELD: Maintain the original spatial relationships. Ensure the transition between the foreground subjects and the background remains realistic and deep.
- ATMOSPHERIC CLARITY: Remove haze, dust, and light scattering to reveal the true clarity and depth of the entire scene.

3. COMPLEX PATTERN PRESERVATION:
- For group photos with diverse clothing, preserve 100% of all patterns, embroidery, and intricate details without simplification.

OUTPUT GOAL: A crystal-clear, high-resolution group photograph with perfect spatial depth and uniform sharpness across all subjects and the background.`;

// ─────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────
export type ModelType = 'gemini-3-pro-image-preview' | 'gemini-3.1-flash-image-preview';
export type ResolutionType = '1K' | '2K' | '4K';

export interface AnalysisResult {
  photo_type: string;
  subject_count: number;
  face_sizes: string;
  is_black_white: boolean;
  is_sepia: boolean;
  damage_types: string[];
  damage_severity: string;
  clothing_visible: boolean;
  clothing_detail_needed: boolean;
  background_complexity: string;
  background_importance: string;
  era_estimate: string;
  requires_group_restore: boolean;
  recommended_model: string;
  special_challenges: string | null;
}

export interface PipelineStatus {
  step: string;
  progress: number;
}

export interface RestoreOptions {
  model: ModelType;
  resolution: ResolutionType;
  colorize: boolean;
  replaceClothing: boolean;
  clothingPrompt: string;
}

const API_TIMEOUT_MS = 120_000;
const SUPPORTED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const DEFAULT_ANALYSIS: AnalysisResult = {
  photo_type: 'portrait_single',
  subject_count: 1,
  face_sizes: 'medium',
  is_black_white: false,
  is_sepia: false,
  damage_types: ['fade', 'color_shift'],
  damage_severity: 'moderate',
  clothing_visible: true,
  clothing_detail_needed: true,
  background_complexity: 'simple',
  background_importance: 'medium',
  era_estimate: 'unknown',
  requires_group_restore: false,
  recommended_model: 'gemini_flash',
  special_challenges: null,
};

// ─────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────
export const useGeminiPipeline = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<PipelineStatus>({ step: '', progress: 0 });
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  const delay = (ms: number) => new Promise<void>(res => setTimeout(res, ms));

  const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout sau ${timeoutMs / 1000}s tại bước: ${label}`));
      }, timeoutMs);
      promise.then(
        (v) => { clearTimeout(timer); resolve(v); },
        (e) => { clearTimeout(timer); reject(e); }
      );
    });
  };

  const generateWithRetry = async (
    ai: GoogleGenAI,
    params: any,
    label: string,
    maxRetries = 2
  ) => {
    let lastError: any = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const retryDelay = attempt * 6000;
          console.log(`[${label}] Retry ${attempt}/${maxRetries}, waiting ${retryDelay}ms…`);
          await delay(retryDelay);
        }
        const result = await withTimeout(
          ai.models.generateContent(params),
          API_TIMEOUT_MS,
          label
        );
        return result;
      } catch (err: any) {
        console.error(`[${label}] Attempt ${attempt + 1} failed:`, err?.message ?? err);
        lastError = err;
        if (err?.status === 400 || err?.message?.includes('400')) {
          const isImageCapabilityGlitch = supportsImageInputError(err);
          if (!isImageCapabilityGlitch || attempt === maxRetries) {
            throw err;
          }
        }
        if (err?.message?.startsWith('Timeout')) throw err;
      }
    }
    throw lastError;
  };

  const supportsImageInputError = (err: any): boolean => {
    const message = err?.message ?? '';
    return /does not support image input|Cannot read\s+"image\.[^"]+"/i.test(message);
  };

  const isTimeoutError = (err: any): boolean => {
    const message = err?.message ?? '';
    return message.startsWith('Timeout');
  };

  const restoreModelFallbacks = (model: ModelType): ModelType[] => {
    if (model === 'gemini-3.1-flash-image-preview') {
      return ['gemini-3.1-flash-image-preview', 'gemini-3-pro-image-preview'];
    }
    return ['gemini-3-pro-image-preview'];
  };

  const extractImagePayload = (imageDataUri: string): { base64Data: string; mimeType: string } => {
    const [metaPart, base64Data] = imageDataUri.split(',');
    const rawMimeType = metaPart?.split(';')?.[0]?.split(':')?.[1] ?? '';
    const mimeType = rawMimeType === 'image/jpg' ? 'image/jpeg' : rawMimeType;

    if (!base64Data) {
      throw new Error('Ảnh không hợp lệ. Vui lòng chọn lại ảnh.');
    }

    if (!SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
      throw new Error(`Định dạng ảnh ${mimeType || '(không xác định)'} chưa được hỗ trợ. Vui lòng dùng JPG, PNG hoặc WEBP.`);
    }

    return { base64Data, mimeType };
  };

  const extractImageFromResponse = (response: any): string => {
    const parts = response?.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        return `data:${part.inlineData.mimeType ?? 'image/jpeg'};base64,${part.inlineData.data}`;
      }
    }
    return '';
  };

  const getAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('API Key không khả dụng. Vui lòng chọn API Key từ menu.');
    return new GoogleGenAI({ apiKey });
  };

  const setManualAnalysis = useCallback((analysisData: AnalysisResult) => {
    setError(null);
    setAnalysis(analysisData);
  }, []);

  // ─────────────────────────────────────────────────────────────────────
  // BUILD USER PROMPT — dựa trên metadata analysis và module chuyên biệt
  // ─────────────────────────────────────────────────────────────────────
  const buildUserPrompt = (analysisData: AnalysisResult, options: RestoreOptions): string => {
    const colorLabel = analysisData.is_black_white ? 'B&W' : analysisData.is_sepia ? 'Sepia' : 'Color';

    // 1. Lắp ghép Module chuyên biệt dựa trên photo_type
    const isPortraitPhoto =
      analysisData.photo_type.includes('portrait_single') ||
      analysisData.photo_type.includes('child_portrait') ||
      analysisData.photo_type.includes('elderly_portrait');

    let specializedModule = '';
    if (isPortraitPhoto) {
      specializedModule = PORTRAIT_SPECIALIST_MODULE;
    } else {
      // Mặc định dùng Group Module cho các loại ảnh còn lại
      specializedModule = GROUP_SPECIALIST_MODULE;
    }

    // 2. Xây dựng Prompt hoàn chỉnh
    let prompt = `${CORE_SYSTEM_PROMPT}

${specializedModule}

=== CONFIRMED PHOTO ANALYSIS ===
Photo type       : ${analysisData.photo_type}
Subjects         : ${analysisData.subject_count} person(s) · face size: ${analysisData.face_sizes}
Color mode       : ${colorLabel}
Estimated era    : ${analysisData.era_estimate}
Damage types     : ${analysisData.damage_types.length > 0 ? analysisData.damage_types.join(', ') : 'general aging'}
Damage severity  : ${analysisData.damage_severity}
Background       : ${analysisData.background_complexity} complexity · importance: ${analysisData.background_importance}
Output resolution: ${options.resolution} — maximize detail for this resolution
Colorize option : ${options.colorize ? 'enabled by user (Lên màu)' : 'disabled by user'}
${analysisData.special_challenges ? `Special challenge: ${analysisData.special_challenges}` : ''}`;

    // 3. Xử lý tùy chọn màu sắc
    if (options.colorize) {
      prompt += `

=== COLORIZATION INSTRUCTIONS ===
- Colorize naturally and historically accurately.
- Keep skin tones natural, clothing colors believable, and remove yellow aging stains without oversaturation.`;
    } else if (analysisData.is_black_white) {
      prompt += `

=== COLOR PRESERVATION ===
- Preserve authentic black-and-white output.
- Do NOT colorize when user colorize option is disabled.`;
    } else if (analysisData.is_sepia) {
      prompt += `

=== COLOR PRESERVATION ===
- Preserve authentic sepia tone.
- Do NOT convert to full color when user colorize option is disabled.`;
    } else {
      prompt += `

=== COLOR PRESERVATION ===
- Keep the original palette, correcting only fading, white balance, and color shift.`;
    }

    // 4. Xử lý tùy chọn thay đổi trang phục
    if (isPortraitPhoto && options.replaceClothing && options.clothingPrompt) {
      prompt += `

=== CLOTHING REPLACEMENT ===
- Replace current clothing with: ${options.clothingPrompt}
- Keep exact body proportions, pose, and realism. Match the era and lighting.`;
    }

    // 5. Kết thúc Prompt
    prompt += `

CRITICAL: Output ONE complete restored image at the highest possible quality.
Every area must be equally sharp. No region should be blurry or soft.`;

    return prompt;
  };

  // ─────────────────────────────────────────────────────────────────────
  // BƯỚC 2 + 3: PHỤC HỒI CHÍNH
  // Model: do người dùng chọn
  // ─────────────────────────────────────────────────────────────────────
  const restoreImage = useCallback(async (
    imageDataUri: string,
    analysisData: AnalysisResult,
    options: RestoreOptions
  ): Promise<string> => {
    setIsProcessing(true);
    setError(null);
    setStatus({ step: 'Đang khởi tạo phục hồi…', progress: 10 });

    try {
      const ai = getAI();
      const { base64Data, mimeType } = extractImagePayload(imageDataUri);
      const userPrompt = buildUserPrompt(analysisData, options);

      // ── GLOBAL RESTORE ────────────────────────────────────────────
      setStatus({ step: 'Đang phục hồi tổng thể… (có thể mất 1-2 phút)', progress: 30 });

      const fallbackModels = restoreModelFallbacks(options.model);

      let restoreResponse: any = null;
      let lastRestoreError: any = null;

      for (const model of fallbackModels) {
        try {
          if (model !== options.model) {
            setStatus({ step: `Model ${options.model} không nhận ảnh, đang thử ${model}…`, progress: 35 });
          }

restoreResponse = await generateWithRetry(
              ai,
              {
                model,
                contents: {
                  parts: [
                    { inlineData: { data: base64Data, mimeType } },
                    { text: userPrompt },
                  ],
                },
                config: {
                  temperature: 0.1,
                  responseModalities: ["IMAGE", "TEXT"],
                  imageConfig: {
                    imageSize: options.resolution,
                  },
                },
              },
              `GlobalRestore:${model}`
            );

          break;
        } catch (err: any) {
          lastRestoreError = err;
          const isLastModel = model === fallbackModels[fallbackModels.length - 1];
          const shouldFallbackToNextModel =
            supportsImageInputError(err) ||
            (isTimeoutError(err) && model === 'gemini-3.1-flash-image-preview');

          if (isTimeoutError(err) && model === 'gemini-3.1-flash-image-preview' && !isLastModel) {
            setStatus({ step: 'Gemini 3.1 Flash bị timeout, đang chuyển sang Gemini 3 Pro…', progress: 35 });
          }

          if (!shouldFallbackToNextModel || isLastModel) {
            throw err;
          }
        }
      }

      if (!restoreResponse && lastRestoreError) {
        throw lastRestoreError;
      }

      let restoredImage = extractImageFromResponse(restoreResponse);
      if (!restoredImage) {
        throw new Error('Model không trả về ảnh. Vui lòng thử lại hoặc chọn model khác.');
      }

      setStatus({ step: 'Hoàn tất! ✓', progress: 100 });
      setIsProcessing(false);
      return restoredImage;
    } catch (err: any) {
      console.error('[RestoreImage] Error:', err?.message ?? err);
      const msg = supportsImageInputError(err)
        ? 'Model hiện tại không hỗ trợ nhập ảnh ở endpoint này. Hãy thử lại, hoặc đổi sang model ảnh khác.'
        : isTimeoutError(err)
        ? `${err.message}. Vui lòng thử lại hoặc chọn ảnh nhỏ hơn.`
        : err?.message ?? 'Đã xảy ra lỗi không xác định.';
      setError(msg);
      setIsProcessing(false);
      throw err;
    }
  }, []);

  const resetState = useCallback(() => {
    setAnalysis(null);
    setError(null);
    setStatus({ step: '', progress: 0 });
    setIsProcessing(false);
  }, []);

  return {
    // State
    isProcessing,
    status,
    setStatus,
    error,
    setError,
    analysis,

    // Actions
    setManualAnalysis,
    restoreImage,
    resetState,
  };
};
