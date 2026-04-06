import { useState, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';

// ─────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT BẤT BIẾN — từ photo-restoration-pipeline-v3.md
// ─────────────────────────────────────────────────────────────────────────
const CORE_SYSTEM_PROMPT = `===============================================================
SYSTEM DIRECTIVE — PHOTO RESTORATION CORE RULES v3.0
===============================================================

You are an expert forensic photograph restoration specialist
with decades of experience in archival photo recovery.
Your mission: restore degraded photographs with maximum fidelity
to the original subjects and scene — never alter, never improve,
never beautify beyond what existed in the original.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULE 1 — FACE & IDENTITY PRESERVATION [ABSOLUTE PRIORITY]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Every person's facial identity MUST be preserved with 100% accuracy.

STRICTLY FORBIDDEN:
✗ Altering, idealizing, beautifying, or reconstructing facial structure
✗ Making faces look younger, smoother, or more symmetrical
✗ Replacing or approximating a face with a statistically similar one
✗ Removing wrinkles, scars, moles, asymmetry, or unique skin features
✗ Changing eye shape, nose structure, lip form, or jaw line
✗ Modifying facial expressions or emotional states
✗ Any form of AI "enhancement" that deviates from the original face

REQUIRED:
✓ Preserve ALL unique facial features exactly as they appear
✓ Treat each face as a legal forensic document
✓ Recover sharpness and detail without altering structure
✓ Maintain the subject's apparent age, ethnicity, and gender exactly
✓ Zero tolerance for identity drift — even subtle changes are unacceptable

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULE 2 — FACIAL EXPRESSION & EMOTION INTEGRITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✗ NEVER alter the emotional tone of any subject's expression
✗ NEVER add smiles, soften frowns, or change eye direction
✓ Preserve the exact expression: subtle tension, natural asymmetry,
  squinting from sun, mid-speech moments, natural blinking
✓ Micro-expressions and natural human imperfections are features,
  not errors — restore them faithfully

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULE 3 — COLOR TRUTH & BALANCE [GLOBAL UNIFORMITY]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Restore white balance to accurate and neutral
✓ Remove color casts: yellowing, cyan shift, magenta drift, sepia aging
✓ Restore faded colors to original vibrancy — natural, not artificial
✓ Skin tones: natural and ethnically accurate to each subject
✓ Color must be consistent and uniform across the ENTIRE image
✗ NEVER over-saturate, apply stylistic grading, or add vignetting
✗ NEVER apply selective color enhancement to specific regions
✗ NEVER use HDR-style processing — aim for natural photographic look

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULE 4 — SHARPNESS & FINE DETAIL RECOVERY [ALL REGIONS EQUAL]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Recover maximum fine detail from ALL degraded or blurred regions
✓ Apply sharpening GLOBALLY and UNIFORMLY — no region neglected
✓ Remove film grain, dust spots, scratches, and compression artifacts
✓ Recover shadow detail and highlight detail without clipping
✗ NEVER produce halos, ringing artifacts, or unnatural edge sharpening
✗ NEVER apply stronger sharpening to faces vs clothing vs background
✗ NEVER produce "plastic skin" — smooth, featureless skin is a failure

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULE 5 — CLOTHING & FABRIC DETAIL [EQUAL TO FACE PRIORITY]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Fabric texture: weave patterns, natural folds, draping behavior
✓ Structural elements: collars, cuffs, buttons, lapels, pockets, belts
✓ Decorative elements: embroidery, lace, patterns, pins, badges
✓ Layer relationships: jacket over shirt, dress layers, undergarments
✓ Seams, stitching, garment construction details where visible
✓ Era-accurate materials: fabric types and clothing styles of the period
✗ NEVER invent patterns, textures, or details not present in the original
✗ NEVER deprioritize clothing restoration relative to face restoration

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULE 6 — BACKGROUND & ENVIRONMENT [EQUAL TO FACE PRIORITY]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Background deserves IDENTICAL restoration quality as foreground
✓ Recover: architectural details, furniture, plants, sky, flooring,
  walls, objects, signage, vehicles — everything visible
✓ Maintain realistic depth, perspective, and spatial relationships
✓ Preserve historical and cultural context of the environment
✓ Era-accurate environment: elements consistent with photo period
✗ NEVER blur, simplify, or soft-focus background regions
✗ NEVER generate background content not present in the original

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULE 7 — PHOTOGRAPHIC AUTHENTICITY [NO AI ARTIFACTS]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Output must look like a naturally well-preserved historical photograph
✓ Respect original depth of field and optical character
✓ Preserve photographic era aesthetics appropriate to the period
✗ NEVER modernize: no HDR, no AI enhancement look, no digital artifacts
✗ NEVER produce output that looks AI-generated or digitally painted
✗ The final result must be indistinguishable from a carefully preserved
  original print — not a digital reconstruction

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT STANDARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Every region of the output image — faces, expressions, clothing,
background, objects — must receive identical care and quality.
No region should appear more restored than any other.
Uniformity of restoration quality across the entire image is mandatory.

VIOLATION OF ANY RULE ABOVE = RESTORATION FAILURE.
DO NOT PROCEED if you cannot comply with all rules simultaneously.
===============================================================`;

// ─────────────────────────────────────────────────────────────────────────
// ANALYSIS PROMPT — trả về JSON metadata
// ─────────────────────────────────────────────────────────────────────────
const ANALYSIS_SYSTEM = `${CORE_SYSTEM_PROMPT}

YOUR ROLE IN THIS CALL: ANALYST ONLY — do not restore anything.
Examine the photograph carefully and return a precise JSON object.
This analysis determines the entire restoration strategy.
Return ONLY valid JSON — no explanation, no markdown fences, no commentary.
Invalid JSON or non-JSON output will crash the pipeline.`;

const ANALYSIS_PROMPT = `Analyze this photograph and return ONLY this JSON structure:

{
  "photo_type": <one of: "portrait_single" | "portrait_group" | "portrait_crowd" | "outdoor_scene" | "indoor_scene" | "event_photo" | "landscape_with_people" | "child_portrait" | "elderly_portrait">,
  "subject_count": <integer 0–20>,
  "face_sizes": <one of: "large" | "medium" | "small">,
  "is_black_white": <boolean>,
  "is_sepia": <boolean>,
  "damage_types": <array of: "scratch" | "tear" | "mold" | "crease" | "water_damage" | "blur_motion" | "blur_focus" | "fade" | "color_shift" | "grain_heavy" | "overexposed" | "underexposed">,
  "damage_severity": <one of: "light" | "moderate" | "heavy" | "extreme">,
  "clothing_visible": <boolean>,
  "clothing_detail_needed": <boolean>,
  "background_complexity": <one of: "simple" | "moderate" | "complex">,
  "background_importance": <one of: "low" | "medium" | "high">,
  "era_estimate": <string like "1920s" | "1940s" | "1960s" | "1980s" | "unknown">,
  "requires_group_restore": <boolean>,
  "recommended_model": <one of: "gemini_flash" | "gemini_pro">,
  "special_challenges": <string or null>
}`;

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

const DEFAULT_ANALYSIS: AnalysisResult = {
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
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
    maxRetries = 3,
    onRetry?: (attempt: number, maxRetries: number) => void
  ) => {
    let lastError: any = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const retryDelay = attempt * 8000; // 8s, 16s, 24s
          console.log(`[${label}] Retry ${attempt}/${maxRetries}, waiting ${retryDelay}ms…`);
          if (onRetry) onRetry(attempt, maxRetries);
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
        
        // Don't retry on 400 errors unless it's a known glitch
        if (err?.status === 400 || err?.message?.includes('400')) {
          const isImageCapabilityGlitch = supportsImageInputError(err);
          if (!isImageCapabilityGlitch || attempt === maxRetries) {
            throw err;
          }
        }
        // Don't retry on timeout
        if (err?.message?.startsWith('Timeout')) throw err;
        
        // For 503 or other errors, we will continue the loop to retry
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

  // ─────────────────────────────────────────────────────────────────────
  // BƯỚC 1: PHÂN TÍCH ẢNH
  // Model: gemini-3.1-flash-lite-preview
  // ─────────────────────────────────────────────────────────────────────
  const analyzeImage = useCallback(async (imageDataUri: string): Promise<AnalysisResult> => {
    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);

    try {
      const ai = getAI();
      const { base64Data, mimeType } = extractImagePayload(imageDataUri);

const response = await generateWithRetry(
      ai,
      {
        model: 'gemini-3.1-flash-lite-preview',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType } },
            { text: `${ANALYSIS_SYSTEM}\n\n${ANALYSIS_PROMPT}` },
          ],
        },
        config: { temperature: 0.1 },
      },
      'Analysis',
      3,
      (attempt, maxRetries) => {
        setStatus({ step: `Đang phân tích ảnh... (Thử lại ${attempt}/${maxRetries} do máy chủ bận)`, progress: 10 + (attempt * 5) });
      }
    );

      const rawText = response.text ?? '';
      const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

      let parsed: AnalysisResult;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        console.warn('[Analysis] JSON parse failed, using default analysis');
        parsed = { ...DEFAULT_ANALYSIS };
      }

      setAnalysis(parsed);
      setIsAnalyzing(false);
      return parsed;
    } catch (err: any) {
      console.error('[Analysis] Error:', err?.message ?? err);
      const fallback = { ...DEFAULT_ANALYSIS };
      setAnalysis(fallback);
      setIsAnalyzing(false);
      return fallback;
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────
  // BUILD USER PROMPT — dựa trên metadata analysis
  // ─────────────────────────────────────────────────────────────────────
  const buildUserPrompt = (analysisData: AnalysisResult, options: RestoreOptions): string => {
    const colorLabel = analysisData.is_black_white ? 'B&W' : analysisData.is_sepia ? 'Sepia' : 'Color';

    let prompt = `${CORE_SYSTEM_PROMPT}

Apply the restoration rules to this specific image.

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
${analysisData.special_challenges ? `Special challenge: ${analysisData.special_challenges}` : ''}

=== RESTORATION GOALS ===
- Repair visible damage globally: scratches, tears, dust, creases, stains, banding, grain, print texture, and scanning artifacts.
- Restore sharpness and recover fine detail across faces, clothing, and background with equal quality.
- Preserve exact identity, expression, age, proportions, and scene layout.
- Remove damage without hallucinating new features, textures, or background content.
- Clothing restoration is mandatory in every image: recover fabric weave, folds, seams, collars, cuffs, buttons, and natural garment depth.
- Keep clothing faithful to the original outfit (style, cut, pattern, color relationship, and fit) unless replacement is explicitly requested.`;

    if (options.colorize) {
      prompt += `
- Colorize naturally and historically accurately.
- Keep skin tones natural, clothing colors believable, and remove yellow aging stains without oversaturation.`;
    } else if (analysisData.is_black_white) {
      prompt += `
- Preserve authentic black-and-white output.
- Do NOT colorize when user colorize option is disabled.`;
    } else if (analysisData.is_sepia) {
      prompt += `
- Preserve authentic sepia tone.
- Do NOT convert to full color when user colorize option is disabled.`;
    } else {
      prompt += `
- Keep the original palette, correcting only fading, white balance, and color shift.`;
    }

    prompt += `
- Keep facial features and eye direction exact; no beautification, no plastic skin, no expression change.
- Recover clothing texture and construction details naturally from the original clothing, not synthetic redesign.
- Restore the full background clearly; no soft or neglected regions.`;

    if (options.replaceClothing && options.clothingPrompt) {
      prompt += `

- Replace current clothing with: ${options.clothingPrompt}
- Keep exact body proportions, pose, and realism. Match the era and lighting.`;
    }

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
              `GlobalRestore:${model}`,
              3,
              (attempt, maxRetries) => {
                setStatus({ step: `Đang phục hồi tổng thể… (Thử lại ${attempt}/${maxRetries} do máy chủ bận)`, progress: 30 + (attempt * 5) });
              }
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
    setIsAnalyzing(false);
  }, []);

  return {
    // State
    isProcessing,
    isAnalyzing,
    status,
    setStatus,
    error,
    setError,
    analysis,

    // Actions
    analyzeImage,
    restoreImage,
    resetState,
  };
};
