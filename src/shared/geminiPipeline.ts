import type { AnalysisResult, IdPhotoOptions, ModelType, RestoreOptions } from './types';

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

const ID_PHOTO_CORE_PROMPT = `===============================================================
SYSTEM DIRECTIVE - ID PHOTO STUDIO RULES v1.0
===============================================================

You are an expert biometric-safe ID photo editor.
Your mission: transform the uploaded portrait into a clean, realistic, formal ID photo while preserving the exact same person.

HIGHEST PRIORITY:
1. IDENTITY PRESERVATION ABOVE ALL ELSE.
2. The face must remain the same person.
3. Any correction to pose, gaze, expression, clothing, or background must NEVER turn the subject into a different person.

STRICTLY FORBIDDEN:
✗ Changing facial identity.
✗ Beautifying the face into a different look.
✗ Reshaping jaw, eyes, nose, lips, or cheek structure beyond subtle normalization.
✗ Plastic skin, glamour retouching, fashion-editorial styling, or AI beauty filter look.
✗ Introducing fantasy wardrobe, dramatic lighting, or artistic background.

ALLOWED ONLY WHEN REQUESTED:
✓ Subtle head straightening.
✓ Subtle gaze correction toward camera.
✓ Mild expression normalization for formal ID usage.
✓ Clothing replacement with realistic formal attire.
✓ Background replacement with clean studio-style solid background.

OUTPUT GOAL:
A realistic Vietnamese-friendly formal ID photo with exact identity retention, studio cleanliness, and natural skin texture.
===============================================================`;

export const DEFAULT_OUTPUT_RESOLUTION = '2K';
export const API_TIMEOUT_MS = 120_000;
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

export function supportsImageInputError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? '');
  return /does not support image input|Cannot read\s+"image\.[^"]+"/i.test(message);
}

export function isTimeoutError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? '');
  return message.startsWith('Timeout');
}

export function restoreModelFallbacks(model: ModelType): ModelType[] {
  if (model === 'gemini-3.1-flash-image-preview') {
    return ['gemini-3.1-flash-image-preview', 'gemini-3-pro-image-preview'];
  }

  return ['gemini-3-pro-image-preview'];
}

export function extractImagePayload(imageDataUri: string): { base64Data: string; mimeType: string } {
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
}

export function extractImageFromResponse(response: any): string {
  const parts = response?.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return `data:${part.inlineData.mimeType ?? 'image/jpeg'};base64,${part.inlineData.data}`;
    }
  }
  return '';
}

export function buildUserPrompt(analysisData: AnalysisResult, options: RestoreOptions): string {
  const colorLabel = analysisData.is_black_white ? 'B&W' : analysisData.is_sepia ? 'Sepia' : 'Color';
  const isPortraitPhoto =
    analysisData.photo_type.includes('portrait_single') ||
    analysisData.photo_type.includes('child_portrait') ||
    analysisData.photo_type.includes('elderly_portrait');

  const specializedModule = isPortraitPhoto ? PORTRAIT_SPECIALIST_MODULE : GROUP_SPECIALIST_MODULE;

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
Output resolution: ${DEFAULT_OUTPUT_RESOLUTION} — maximize detail for this resolution
Colorize option : ${options.colorize ? 'enabled by user (Lên màu)' : 'disabled by user'}
${analysisData.special_challenges ? `Special challenge: ${analysisData.special_challenges}` : ''}`;

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

  if (isPortraitPhoto && options.replaceClothing && options.clothingPrompt) {
    prompt += `

=== CLOTHING REPLACEMENT ===
- Replace current clothing with: ${options.clothingPrompt}
- Keep exact body proportions, pose, and realism. Match the era and lighting.`;
  }

  prompt += `

CRITICAL: Output ONE complete restored image at the highest possible quality.
Every area must be equally sharp. No region should be blurry or soft.`;

  return prompt;
}

export function buildIdPhotoPrompt(options: IdPhotoOptions): string {
  const backgroundInstruction = options.backgroundMode === 'custom'
    ? (options.backgroundCustomPrompt?.trim() || 'Clean solid studio background, uniform and distraction-free.')
    : options.backgroundMode === 'white'
    ? 'Pure white studio background, clean, uniform, and shadow-free.'
    : options.backgroundMode === 'blue'
    ? 'Solid light blue ID photo background, clean, uniform, and shadow-free.'
    : 'Soft light gray studio background, neutral, clean, and uniform.';

  const cropInstruction = options.cropStyle === 'auto_id'
    ? 'Use standard ID photo framing with the head centered, balanced shoulders, and appropriate headroom.'
    : options.cropStyle === 'head_shoulders'
    ? 'Frame as a head-and-shoulders portrait with formal ID photo composition.'
    : 'Frame as a half-body formal portrait while preserving ID-photo cleanliness and symmetry.';

  const gazeInstruction = options.gazeDirection === 'keep'
    ? 'Keep the original gaze direction only if already suitable for formal ID use.'
    : options.gazeDirection === 'look_straight'
    ? 'Adjust the eyes and face to look straight toward the camera in a natural way.'
    : 'Subtly rotate the face toward a frontal camera-facing direction without altering identity.';

  const expressionInstruction = options.expressionPreset === 'keep'
    ? 'Keep the current expression if it is already suitable for a formal ID photo.'
    : options.expressionPreset === 'neutral'
    ? 'Set a natural neutral professional expression.'
    : options.expressionPreset === 'soft_smile'
    ? 'Apply only a very subtle polite smile suitable for a formal profile photo.'
    : 'Set a calm serious formal expression without making the face harsher.';

  const poseInstruction = options.poseCorrection === 'keep'
    ? 'Keep the current pose only if it already looks appropriate for a formal ID portrait.'
    : options.poseCorrection === 'standard_id'
    ? 'Normalize the pose into a standard upright ID-photo pose with squared shoulders.'
    : options.poseCorrection === 'straighten_head'
    ? 'Straighten head tilt subtly while preserving facial proportions.'
    : options.poseCorrection === 'level_shoulders'
    ? 'Level the shoulders and make posture look balanced and formal.'
    : options.poseCorrection === 'neutral_formal_angle_15'
    ? 'Adjust the subject into a respectful neutral professional portrait pose with the body turned slightly about 10 to 15 degrees, upright posture, balanced shoulders, and a natural head position. Use only subtle rotation and preserve exact identity.'
    : options.poseCorrection === 'neutral_three_quarter_soft'
    ? 'Create a subtle neutral three-quarter professional portrait pose with a slight body angle, realistic studio posture, and conservative presentation. Do not stylize or alter identity.'
    : options.poseCorrection === 'male_formal_angle_15'
    ? 'Adjust the subject into a formal professional male portrait pose with the body turned slightly about 10 to 15 degrees, upright posture, balanced shoulders, and a confident but natural presentation suitable for office or profile use. Preserve exact identity.'
    : options.poseCorrection === 'male_three_quarter_soft'
    ? 'Create a subtle three-quarter formal male portrait pose with a slight body angle and clean professional posture. Keep the look respectful, natural, and realistic without altering identity.'
    : options.poseCorrection === 'female_formal_angle_15'
    ? 'Adjust the subject into a formal elegant female portrait pose with the body turned slightly about 10 to 15 degrees, natural upright posture, balanced shoulders, and realistic studio professionalism. Preserve exact identity.'
    : options.poseCorrection === 'female_three_quarter_soft'
    ? 'Create a subtle three-quarter formal female portrait pose with a gentle professional angle, realistic neck line, balanced shoulders, and natural studio posture. Preserve exact identity.'
    : 'Adjust to a refined female professional portrait pose with a slight shoulder angle, elegant upright posture, calm studio presence, and conservative presentation. Keep it realistic and preserve exact identity.';

  let prompt = `${ID_PHOTO_CORE_PROMPT}

=== OUTPUT FORMAT ===
- Final aspect ratio: ${options.aspectRatio}
- Output resolution: ${DEFAULT_OUTPUT_RESOLUTION}
- ${cropInstruction}
- Maintain a clean studio composition suitable for official or semi-official ID use.

=== BACKGROUND ===
- ${backgroundInstruction}

=== FACE AND IDENTITY SAFETY ===
- Preserve exact facial identity, age, ethnicity, skin texture, and recognizable facial proportions.
- If any adjustment is needed, keep it subtle and realistic.
- The output must still be unmistakably the same person from the uploaded image.
- Do not over-symmetrize or beautify the face.

=== GAZE, EXPRESSION, AND POSE ===
- ${gazeInstruction}
- ${expressionInstruction}
- ${poseInstruction}
- Keep the result natural and believable as a real camera capture.
- Use only subtle pose rotation or correction. Never redesign facial structure.
- Do not create a fashion-editorial pose, glamour pose, or overly dramatic body angle.
`;

  if (options.replaceClothing && options.clothingPrompt) {
    prompt += `

=== CLOTHING ===
- Replace clothing with: ${options.clothingPrompt}
- Keep body proportions realistic and preserve neck, shoulder width, and posture naturally.
- Clothing must look formal, realistic, and appropriate for Vietnamese ID/profile use.`;
  } else {
    prompt += `

=== CLOTHING ===
- Keep existing clothing unless it conflicts with the requested formal presentation.`;
  }

  if (options.additionalInstructions?.trim()) {
    prompt += `

=== USER EXTRA NOTES ===
- ${options.additionalInstructions.trim()}`;
  }

  prompt += `

=== FINAL QUALITY RULES ===
- Output exactly one realistic ID-style portrait.
- Keep edges of hair, ears, jawline, collar, and shoulders clean and believable.
- Avoid AI artifacts, warped facial structure, extra teeth, incorrect eye alignment, or plastic smoothing.
- Identity preservation is more important than aggressive beautification or aggressive correction.`;

  return prompt;
}
