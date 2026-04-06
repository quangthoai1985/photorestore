# Tài liệu Kỹ thuật: Pipeline Phục Hồi Ảnh Cũ — Phiên bản 3.0
**Cập nhật:** 2025  
**Stack:** Vite · Cloud Run · Gemini 3.1 Flash Image / Gemini 3 Pro Image · Google Cloud Services  
**Thay đổi chính so v2.0:** Loại bỏ hoàn toàn Real-ESRGAN · Gemini native output 1K/2K/4K · Pipeline đơn giản hơn · Latency giảm 30–60s · Không phụ thuộc Replicate

---

## Mục lục

1. [Triết lý thiết kế v3.0](#1-triết-lý-thiết-kế-v30)
2. [So sánh v2.0 vs v3.0](#2-so-sánh-v20-vs-v30)
3. [SYSTEM PROMPT — Core Restoration Directive](#3-system-prompt--core-restoration-directive)
4. [Tổng quan pipeline](#4-tổng-quan-pipeline)
5. [Bước 1 — Phân tích ảnh thông minh](#5-bước-1--phân-tích-ảnh-thông-minh)
6. [Bước 2 — Xây dựng Prompt động](#6-bước-2--xây-dựng-prompt-động)
7. [Bước 3 — Global Restore với native resolution](#7-bước-3--global-restore-với-native-resolution)
8. [Bước 4 — GroupRestore cho ảnh nhiều người](#8-bước-4--grouprestore-cho-ảnh-nhiều-người)
9. [Bước 5 — Final Composite & Delivery](#9-bước-5--final-composite--delivery)
10. [Luồng dữ liệu đầy đủ](#10-luồng-dữ-liệu-đầy-đủ)
11. [Model Gemini — Lựa chọn và tham số](#11-model-gemini--lựa-chọn-và-tham-số)
12. [Cấu hình Google Cloud](#12-cấu-hình-google-cloud)
13. [Cấu trúc Firestore](#13-cấu-trúc-firestore)
14. [Xử lý lỗi và Fallback](#14-xử-lý-lỗi-và-fallback)
15. [Ước tính chi phí](#15-ước-tính-chi-phí)
16. [Thứ tự triển khai](#16-thứ-tự-triển-khai)

---

## 1. Triết lý thiết kế v3.0

### Nguyên tắc cốt lõi

> **"Một hệ sinh thái duy nhất. Gemini làm tất cả — phân tích, phục hồi, và xuất ảnh độ phân giải cao."**

Phiên bản 3.0 loại bỏ hoàn toàn sự phụ thuộc vào Replicate và Real-ESRGAN. Gemini Image API hỗ trợ native output tối đa 4K (4096×4096px) thông qua tham số `image_size` trong `ImageConfig`. Điều này có nghĩa là:

- Ảnh phục hồi và ảnh độ phân giải cao **là một** — không qua bước upscale cơ học
- Không có bước chuyển đổi giữa pipeline → không mất chất lượng khi chuyển dữ liệu
- Latency giảm 30–60s (thời gian chờ Replicate)
- Không cần webhook Replicate → kiến trúc đơn giản hơn đáng kể

### Bảng trách nhiệm rõ ràng

| Nhiệm vụ | v2.0 | v3.0 |
|---|---|---|
| Phân tích ảnh | Gemini Flash (512px) | Gemini Flash (512px) ✓ |
| Xây dựng prompt | JS logic | JS logic ✓ |
| Global restore | Gemini Flash/Pro (1024px) | Gemini Flash/Pro **(1K/2K/4K native)** ✓ |
| GroupRestore per-face | Gemini Flash (crop) | Gemini Flash **(crop + 1K native)** ✓ |
| Upscale 4K | ~~Real-ESRGAN (Replicate)~~ | **Không cần — native từ Gemini** ✓ |
| Webhook Replicate | ~~Cần~~ | **Không cần** ✓ |

---

## 2. So sánh v2.0 vs v3.0

```
v2.0 Pipeline:
  Upload → Analyze → Build Prompt → Gemini Restore (1024px)
  → GroupRestore? → Sharp composite → Real-ESRGAN 4K (Replicate)
  → Webhook → Download → GCS → Firestore → Frontend
  Tổng: ~90–120s · 2 services (Gemini + Replicate) · phức tạp

v3.0 Pipeline:
  Upload → Analyze → Build Prompt → Gemini Restore (native 1K/2K/4K)
  → GroupRestore? → Sharp composite → GCS → Firestore → Frontend
  Tổng: ~30–60s · 1 service (Gemini) · đơn giản
```

### Điều kiện để v3.0 hoạt động tốt

Gemini Image API phải được gọi với:
- `image_size: "4K"` để nhận output 4096×4096px native
- Chữ K **viết hoa bắt buộc** — `"4k"` bị reject không báo lỗi, fallback về 1K
- Model phải là `gemini-3.1-flash-image-preview` (Nano Banana 2) hoặc `gemini-3-pro-image-preview` (Nano Banana Pro)
- `response_modalities: ['IMAGE']` — bắt buộc để nhận ảnh output

---

## 3. SYSTEM PROMPT — Core Restoration Directive

**Đây là System Prompt bất biến — inject vào MỌI Gemini call trong toàn bộ pipeline.**  
Không bao giờ thay đổi, không bao giờ override, không bao giờ rút gọn.  
Áp dụng cho: Analysis call · Global Restore call · Per-face GroupRestore call.

```
===============================================================
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
===============================================================
```

---

## 4. Tổng quan pipeline

```
┌──────────────────────────────────────────────────────────────────────┐
│  BROWSER (Vite)                                                      │
│                                                                      │
│  1. User chọn ảnh                                                    │
│  2. User chọn output quality: Standard (1K) · High (2K) · Ultra (4K)│
│  3. POST /api/get-upload-url → nhận { signedUploadUrl, jobId }      │
│  4. PUT ảnh thẳng lên GCS — không qua Cloud Run                     │
│  5. onSnapshot Firestore jobs/{jobId} → progress realtime           │
│  6. Nhận resultUrl → before/after slider + download                 │
└───────────────────────────┬──────────────────────────────────────────┘
                            │ GCS Object Finalize
                            ▼
                        Pub/Sub
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│  CLOUD RUN WORKER (2GB RAM · 2 CPU · timeout 300s)                  │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ BƯỚC 1 — ANALYZE                          progress: 10→15  │    │
│  │ Model: Gemini Flash                                         │    │
│  │ Input: ảnh compress 512px                                   │    │
│  │ Output: JSON metadata                                       │    │
│  │ → photo_type, subject_count, face_sizes, damage_types,      │    │
│  │   damage_severity, is_black_white, era_estimate,            │    │
│  │   requires_group_restore, recommended_model                 │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                            ↓                                         │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ BƯỚC 2 — BUILD PROMPT                     progress: 15→20  │    │
│  │ Model: Không có (JS logic thuần)                            │    │
│  │ Input: JSON từ Bước 1 + outputSize của user                 │    │
│  │ Output: User Prompt động + image_size + aspect_ratio        │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                            ↓                                         │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ BƯỚC 3 — GLOBAL RESTORE                   progress: 20→65  │    │
│  │ Model: Gemini Flash Image / Gemini Pro Image                │    │
│  │ Input: ảnh gốc (compress vừa) + SYSTEM PROMPT + User Prompt │    │
│  │ Config: image_size = "1K" | "2K" | "4K" (native output)    │    │
│  │         aspect_ratio = tỉ lệ ảnh gốc                       │    │
│  │ Output: ảnh đã restore ở resolution người dùng chọn        │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                            ↓                                         │
│              requires_group_restore?                                 │
│               /                    \                                 │
│             YES                     NO                               │
│              │                       │                               │
│  ┌───────────────────────┐           │                               │
│  │ BƯỚC 4 — GROUP RESTORE│           │       progress: 65→85        │
│  │ face-api detect faces │           │                               │
│  │ Promise.all:          │           │                               │
│  │  per-face Gemini call │           │                               │
│  │  + thumbnail context  │           │                               │
│  │ image_size: "1K"      │           │                               │
│  │ Histogram match       │           │                               │
│  │ Sharp composite       │           │                               │
│  └───────────────────────┘           │                               │
│               \                     /                                │
│                └──────────┬─────────┘                                │
│                           ↓                                          │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ BƯỚC 5 — DELIVERY                         progress: 85→100 │    │
│  │ Upload final image → GCS output bucket                      │    │
│  │ Sinh Signed Download URL (7 ngày)                           │    │
│  │ Xóa file temp/input                                         │    │
│  │ Firestore update: status=completed, resultUrl               │    │
│  └─────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
                            ↓
                    Firestore onSnapshot
                            ↓
                    Browser hiển thị kết quả
```

---

## 5. Bước 1 — Phân tích ảnh thông minh

**Model:** Gemini 3.1 Flash (text output — rẻ nhất, nhanh nhất)  
**Input:** Ảnh compress 512px  
**Output:** JSON metadata điều khiển toàn bộ pipeline

```javascript
// worker/steps/step1-analyze.js

const ANALYSIS_SYSTEM = `
${CORE_SYSTEM_PROMPT}

YOUR ROLE IN THIS CALL: ANALYST ONLY — do not restore anything.
Examine the photograph carefully and return a precise JSON object.
This analysis determines the entire restoration strategy.
Return ONLY valid JSON — no explanation, no markdown fences, no commentary.
Invalid JSON or non-JSON output will crash the pipeline.
`;

const ANALYSIS_PROMPT = `
Analyze this photograph and return ONLY this JSON structure:

{
  "photo_type": <one of:
    "portrait_single"        // 1 người, background đơn giản
    "portrait_group"         // 2–5 người, focus vào người
    "portrait_crowd"         // 6+ người
    "outdoor_scene"          // ngoài trời, hậu cảnh quan trọng
    "indoor_scene"           // trong nhà, nội thất quan trọng
    "event_photo"            // sự kiện: đám cưới, lễ tốt nghiệp...
    "landscape_with_people"  // phong cảnh + người
    "child_portrait"         // chân dung trẻ em
    "elderly_portrait"       // chân dung người cao tuổi
  >,

  "subject_count": <số người nhìn thấy rõ mặt, integer 0–20>,

  "face_sizes": <one of:
    "large"   // mặt chiếm >20% chiều cao ảnh — chân dung cận
    "medium"  // mặt chiếm 8–20% — chân dung thường
    "small"   // mặt chiếm <8% — ảnh nhóm đông, ảnh xa
  >,

  "is_black_white": <true nếu ảnh đen trắng>,
  "is_sepia": <true nếu ảnh có tông nâu vàng sepia>,

  "damage_types": <array — chọn tất cả áp dụng:
    "scratch"       // vết xước dọc/ngang
    "tear"          // rách, mất góc
    "mold"          // đốm mốc, hư hóa học
    "crease"        // nếp gấp, nhăn
    "water_damage"  // hư do nước, ố vàng từng vùng
    "blur_motion"   // mờ do chuyển động khi chụp
    "blur_focus"    // mờ do lấy nét sai
    "fade"          // phai màu toàn ảnh
    "color_shift"   // lệch màu: vàng, cyan, magenta
    "grain_heavy"   // hạt film nặng, nhiễu cao
    "overexposed"   // cháy sáng từng vùng
    "underexposed"  // tối quá, mất chi tiết bóng tối
  >,

  "damage_severity": <one of: "light" | "moderate" | "heavy" | "extreme">,

  "clothing_visible": <true nếu trang phục nhìn thấy rõ>,
  "clothing_detail_needed": <true nếu trang phục bị hư hại cần phục hồi>,

  "background_complexity": <one of: "simple" | "moderate" | "complex">,
  "background_importance": <one of: "low" | "medium" | "high">,

  "era_estimate": <thập kỷ ước tính: "1920s"/"1940s"/"1960s"/"1980s"/"unknown">,

  "lighting_condition": <one of:
    "natural_outdoor"
    "natural_indoor_window"
    "studio_flash"
    "available_light_dim"
    "mixed"
  >,

  "aspect_ratio_detected": <tỉ lệ ảnh gần nhất: "1:1"|"4:3"|"3:4"|"3:2"|"2:3"|"16:9"|"9:16">,

  "requires_group_restore": <true nếu subject_count >= 2 VÀ face_sizes là "medium" hoặc "small">,

  "recommended_model": <one of:
    "gemini_flash"   // ảnh hư hại nhẹ đến trung bình
    "gemini_pro"     // ảnh hư hại nặng/extreme, ảnh nhóm phức tạp, ảnh có nhiều mặt nhỏ
  >,

  "special_challenges": <mô tả thách thức đặc biệt dưới 120 ký tự, hoặc null>
}
`;

async function analyzePhoto(imageBuffer, jobId) {
  await updateJob(jobId, { step: 'analyze', progress: 10 });

  // Compress nhỏ — chỉ cần đủ để Gemini nhận ra nội dung
  const compressed = await sharp(imageBuffer)
    .resize({ width: 512, withoutEnlargement: true })
    .jpeg({ quality: 75 })
    .toBuffer();

  const base64 = compressed.toString('base64');

  const response = await callGeminiText({
    model: 'gemini-2.0-flash',
    systemPrompt: ANALYSIS_SYSTEM,
    userPrompt: ANALYSIS_PROMPT,
    imageBase64: base64,
  });

  // Làm sạch và parse JSON
  const raw = response
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();

  let analysis;
  try {
    analysis = JSON.parse(raw);
  } catch (e) {
    // Fallback analysis nếu parse thất bại
    analysis = getDefaultAnalysis();
    console.warn(`[${jobId}] Analysis JSON parse failed — using default`);
  }

  await updateJob(jobId, {
    analysis,
    progress: 15,
    recommendedModel: analysis.recommended_model,
  });

  return analysis;
}

function getDefaultAnalysis() {
  return {
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
    lighting_condition: 'natural_outdoor',
    aspect_ratio_detected: '4:3',
    requires_group_restore: false,
    recommended_model: 'gemini_flash',
    special_challenges: null,
  };
}
```

---

## 6. Bước 2 — Xây dựng Prompt động

**Không tốn API call** — Logic thuần JavaScript.  
Output: User Prompt đầy đủ + `image_size` + `aspect_ratio` cho Gemini Restore call.

```javascript
// worker/steps/step2-build-prompt.js

function buildRestoreConfig(analysis, outputSize) {

  // ── Map output size của user sang image_size của Gemini API ──────
  const imageSizeMap = {
    'Standard': '1K',   // 1024×1024px — nhanh, rẻ
    'High':     '2K',   // 2048×2048px — cân bằng
    'Ultra':    '4K',   // 4096×4096px — tốt nhất, đắt nhất
  };
  const imageSize = imageSizeMap[outputSize] || '2K';

  // ── Aspect ratio từ analysis ────────────────────────────────────
  const aspectRatio = analysis.aspect_ratio_detected || '4:3';

  // ── Build User Prompt ───────────────────────────────────────────
  const userPrompt = buildUserPrompt(analysis, imageSize);

  return { imageSize, aspectRatio, userPrompt };
}

function buildUserPrompt(analysis, imageSize) {

  // PHẦN 1 — Context block
  const contextBlock = `
=== CONFIRMED PHOTO ANALYSIS ===
Photo type       : ${getPhotoTypeLabel(analysis.photo_type)}
Subjects         : ${analysis.subject_count} person(s) · face size: ${analysis.face_sizes}
Color mode       : ${getColorModeLabel(analysis)}
Estimated era    : ${analysis.era_estimate}
Damage types     : ${analysis.damage_types.length > 0 ? analysis.damage_types.join(', ') : 'general aging'}
Damage severity  : ${analysis.damage_severity}
Lighting         : ${analysis.lighting_condition}
Background       : ${analysis.background_complexity} complexity · importance: ${analysis.background_importance}
Output resolution: ${imageSize} — maximize detail for this resolution
${analysis.special_challenges ? `Special challenge: ${analysis.special_challenges}` : ''}
`;

  // PHẦN 2 — Damage repair
  let damageBlock = '\n=== DAMAGE REPAIR (first priority) ===\n';
  damageBlock += 'Address ALL damage types before any enhancement.\n';

  if (analysis.damage_types.includes('scratch') || analysis.damage_types.includes('crease')) {
    damageBlock += `
SCRATCHES & CREASES:
- Remove all visible scratch lines and fold marks completely
- Reconstruct image data beneath each scratch using surrounding pixel context
- Repaired areas must be completely invisible in the final output
- Maintain underlying image structure and texture through repair
`;
  }

  if (analysis.damage_types.includes('tear')) {
    damageBlock += `
TEARS & MISSING AREAS:
- Fill torn or missing regions using spatial inference from intact adjacent areas
- Maintain structural perspective and lighting consistency in filled areas
- Edge of repairs must blend seamlessly with undamaged regions
`;
  }

  if (analysis.damage_types.includes('mold') || analysis.damage_types.includes('water_damage')) {
    damageBlock += `
CHEMICAL & WATER DAMAGE:
- Remove all mold spots, water tide marks, and chemical discoloration
- Recover underlying image beneath stained areas
- Neutralize uneven yellowing caused by water or chemical aging
`;
  }

  if (analysis.damage_types.includes('grain_heavy')) {
    damageBlock += `
HEAVY GRAIN & NOISE:
- Reduce film grain and noise while preserving genuine image texture
- Do NOT over-smooth — retain natural photographic texture beneath grain
- Fine detail must emerge from under grain, not be smoothed away
`;
  }

  if (analysis.damage_types.includes('overexposed')) {
    damageBlock += `
HIGHLIGHT RECOVERY:
- Recover detail in blown-out highlight regions where possible
- Restore gradation in bright areas (sky, faces in direct light)
`;
  }

  if (analysis.damage_types.includes('underexposed')) {
    damageBlock += `
SHADOW RECOVERY:
- Lift shadow detail without introducing noise or color cast
- Reveal subject information hidden in dark areas
- Maintain natural shadow gradation — avoid flat or crushed blacks
`;
  }

  if (analysis.damage_severity === 'heavy' || analysis.damage_severity === 'extreme') {
    damageBlock += `
SEVERE DAMAGE NOTE:
Severity: ${analysis.damage_severity.toUpperCase()}
- Prioritize structural reconstruction before fine detail work
- Where original data is partially recoverable, enhance cautiously
- Where truly unrecoverable, use contextual inference consistent with
  the era (${analysis.era_estimate}) and visible scene — never invent anachronistic content
`;
  }

  // PHẦN 3 — Color restoration
  let colorBlock = '\n=== COLOR & TONAL RESTORATION ===\n';

  if (analysis.is_black_white) {
    colorBlock += `
BLACK & WHITE RESTORATION:
- Restore full tonal range: rich blacks → clean whites → nuanced mid-tones
- Remove yellowing, brownish aging artifacts, and uneven toning
- Recover fine gradations in skin tones, fabric, and environmental surfaces
- Output MUST remain black & white — do NOT colorize
- Final result: clean, full-contrast B&W with complete tonal richness
`;
  } else if (analysis.is_sepia) {
    colorBlock += `
SEPIA TONE RESTORATION:
- Restore the characteristic warm sepia tone appropriate to this era
- Remove uneven discoloration and mold spots while preserving sepia character
- Restore tonal separation: clear distinction between highlight, midtone, shadow
- Do NOT convert to full color — maintain the sepia aesthetic
`;
  } else {
    colorBlock += `
COLOR RESTORATION:
- Remove global color cast: yellowing, cyan drift, magenta shift, or general fade
- Restore all colors to era-accurate, natural appearance
- Skin tones: natural and ethnically accurate for each individual subject
- Clothing colors: restore original hue, saturation, and value faithfully
- Lighting color temperature target: ${getLightingTemp(analysis.lighting_condition)}
- Do NOT over-saturate — photographic naturalism is the goal
- Do NOT apply warming or cooling filters as stylistic choices
- Color uniformity: no region should have noticeably different color balance
`;
  }

  // PHẦN 4 — Subject directive
  let subjectBlock = '\n=== SUBJECT RESTORATION ===\n';

  switch (analysis.photo_type) {
    case 'portrait_single':
      subjectBlock += `
SINGLE PORTRAIT — Maximum face detail recovery:
- Eyes: iris texture, eyelashes, natural catchlights — fully recovered
- Skin: natural pores, texture, and character — NO smoothing
- Hair: individual strands, hairline, natural volume
- All facial features sharpened faithfully — no structure alteration
`;
      break;

    case 'portrait_group':
    case 'event_photo':
      subjectBlock += `
GROUP PORTRAIT — Equal attention to every individual:
- CRITICAL: Each person's face must retain their completely distinct identity
- Do NOT average, merge, or homogenize any facial features across subjects
- Every individual receives identical restoration quality regardless of position
- Subjects at the edge, back, or partially obscured still deserve full care
- Natural interpersonal spacing and grouping must be preserved exactly
- Group expressions and interactions remain authentic to the moment
`;
      break;

    case 'portrait_crowd':
      subjectBlock += `
CROWD PHOTO — Consistent restoration across all visible faces:
- Apply uniform restoration quality to every identifiable face
- Even small, distant faces deserve accurate restoration — not blurred approximations
- Crowd density and natural spacing must be preserved
- Foreground and background subjects receive equal sharpness treatment
`;
      break;

    case 'child_portrait':
      subjectBlock += `
CHILD PORTRAIT — Preserve natural youthfulness:
- Children's features are naturally softer — restore clarity without artificial sharpening
- Preserve the natural roundness and youthfulness of the child's features exactly
- DO NOT mature the child's appearance — age must remain unchanged
- Natural, unposed expressiveness must be maintained
- Eyes are especially important — restore their natural brightness fully
`;
      break;

    case 'elderly_portrait':
      subjectBlock += `
ELDERLY PORTRAIT — Aging is identity, not a flaw:
- Wrinkles, deep expression lines, and age spots are DEFINING FEATURES — preserve completely
- DO NOT smooth skin or reduce visible aging in any way
- White and gray hair must be restored with full textural detail
- Deep expression lines around eyes and mouth are part of this person's identity
- Restore the dignity and character that comes with age — never minimize it
`;
      break;

    case 'outdoor_scene':
    case 'landscape_with_people':
      subjectBlock += `
OUTDOOR SCENE — People and environment with equal priority:
- Sky: restore cloud detail, light quality, and atmospheric depth fully
- Vegetation: individual leaf clusters, tree silhouettes, grass texture
- Ground surfaces: path texture, soil character, wet/dry surface quality
- Atmospheric perspective: natural depth haze for distant elements
- People in scene receive full facial identity restoration as detailed in CORE RULES
`;
      break;

    case 'indoor_scene':
      subjectBlock += `
INDOOR SCENE — Interior environment with full detail:
- Furniture: wood grain, fabric texture, material character
- Walls, floors, ceilings: surface texture and material authenticity
- Lighting: restore the quality and direction of the original interior light
- Objects and décor: era-accurate detail recovery
- People receive full facial identity restoration as detailed in CORE RULES
`;
      break;
  }

  // PHẦN 5 — Clothing
  let clothingBlock = '';
  if (analysis.clothing_visible) {
    clothingBlock = `
=== CLOTHING & FABRIC DETAIL ===
Era: ${analysis.era_estimate} — clothing must reflect period-accurate style and materials
${analysis.clothing_detail_needed ? 'Status: DAMAGED — requires active restoration' : 'Status: Recover detail from aging/fading'}
- Fabric weave and texture: restore the material's tactile quality
- Structural elements: collar shape, cuff detail, button presence and type
- Decorative elements: embroidery, patterns, badges, lace, pins — restore if visible
- Natural drape: how the fabric falls and folds on the body
- Seams and garment construction where visible
- Garment layers: jacket/coat over shirt/blouse, dress over undergarments
- Every subject's clothing receives equal restoration attention
`;
  }

  // PHẦN 6 — Background
  let backgroundBlock = '';
  if (analysis.background_importance !== 'low') {
    const priorityLabel = analysis.background_importance === 'high' ? 'HIGH PRIORITY' : 'STANDARD PRIORITY';
    backgroundBlock = `
=== BACKGROUND & ENVIRONMENT [${priorityLabel}] ===
Complexity: ${analysis.background_complexity}
- Restore ALL visible environmental elements with full detail
- Architectural: walls, windows, doors, columns, decorative elements
- Natural: trees, grass, sky, water, ground — species-accurate where identifiable
- Interior: furniture, objects, flooring, wall coverings
- Spatial depth: foreground-midground-background layering must feel natural
- Historical accuracy: all elements consistent with ${analysis.era_estimate} era
- Do NOT blur or soft-focus any background region — full sharpness throughout
`;
  }

  // PHẦN 7 — Output requirement
  const outputBlock = `
=== OUTPUT REQUIREMENTS ===
Target resolution: ${imageSize} — deliver maximum detail at this pixel count
Quality standard: professional archival restoration — not consumer enhancement
Region uniformity: every region of the image at identical quality level
Style: documentary photographic realism — the output must look like a
       carefully preserved original print, not an AI-processed image
No artifacts: zero halos, zero ringing, zero plastic texture, zero AI glow
Final check: if any single region looks more or less restored than another,
             the output does not meet the required standard
`;

  return [
    contextBlock,
    damageBlock,
    colorBlock,
    subjectBlock,
    clothingBlock,
    backgroundBlock,
    outputBlock,
  ].join('\n');
}

// ── Helpers ────────────────────────────────────────────────────────

function getPhotoTypeLabel(type) {
  const map = {
    portrait_single: 'Single person portrait',
    portrait_group: 'Group portrait (2–5 people)',
    portrait_crowd: 'Crowd photograph (6+ people)',
    outdoor_scene: 'Outdoor scene with people',
    indoor_scene: 'Indoor scene with people',
    event_photo: 'Event photograph',
    landscape_with_people: 'Landscape with people',
    child_portrait: 'Child portrait',
    elderly_portrait: 'Elderly person portrait',
  };
  return map[type] || type;
}

function getColorModeLabel(analysis) {
  if (analysis.is_black_white) return 'Black & White — maintain, do not colorize';
  if (analysis.is_sepia) return 'Sepia tone — restore sepia character';
  return 'Color photograph (faded/degraded) — restore original colors';
}

function getLightingTemp(condition) {
  const map = {
    natural_outdoor: 'neutral daylight (5500–6500K)',
    natural_indoor_window: 'cool window light (4500–5500K)',
    studio_flash: 'neutral studio white (5000–5500K)',
    available_light_dim: 'warm ambient indoor (2800–3500K) — warm tones are correct',
    mixed: 'identify dominant light source and normalize to it',
  };
  return map[condition] || 'neutral daylight';
}
```

---

## 7. Bước 3 — Global Restore với native resolution

**Model:** Gemini 3.1 Flash Image hoặc Gemini 3 Pro Image  
**Input:** Ảnh gốc + SYSTEM PROMPT (bất biến) + User Prompt động  
**Config:** `image_size` theo lựa chọn user · `temperature: 0.1`  
**Output:** Ảnh đã restore ở resolution native (1K / 2K / 4K)

```javascript
// worker/steps/step3-global-restore.js

async function globalRestore(imageBuffer, analysis, restoreConfig, jobId) {
  await updateJob(jobId, { step: 'restore', progress: 20 });

  const { imageSize, aspectRatio, userPrompt } = restoreConfig;

  // Chọn model dựa trên analysis
  const model = selectRestoreModel(analysis);

  // Compress input vừa đủ — không cần 4K input vì Gemini xử lý nội tại
  // Input 1024–1500px là tối ưu cho chất lượng vs token cost
  const inputMaxWidth = 1200;
  const compressed = await sharp(imageBuffer)
    .resize({ width: inputMaxWidth, withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();

  const base64Input = compressed.toString('base64');

  await updateJob(jobId, { progress: 25, activeModel: model });

  const restoredBuffer = await callGeminiForImage({
    model,
    systemPrompt: CORE_SYSTEM_PROMPT,    // Bất biến — không thay đổi
    userPrompt,                           // Động — từ Bước 2
    imageBase64: base64Input,
    imageSize,                            // "1K" | "2K" | "4K"
    aspectRatio,                          // Từ analysis
    temperature: 0.1,                     // Thấp = ít sáng tạo = trung thực hơn
  });

  await updateJob(jobId, { progress: 65 });
  return restoredBuffer;
}

function selectRestoreModel(analysis) {
  const needsPro =
    analysis.recommended_model === 'gemini_pro'  ||
    analysis.damage_severity    === 'extreme'     ||
    analysis.damage_types.includes('tear')        ||
    analysis.damage_types.includes('mold')        ||
    (analysis.subject_count >= 4 && analysis.face_sizes === 'small');

  // Model identifiers hiện tại — cập nhật khi Google release model mới
  return needsPro
    ? 'gemini-3-pro-image-preview'       // Gemini 3 Pro Image (Nano Banana Pro)
    : 'gemini-3.1-flash-image-preview';  // Gemini 3.1 Flash Image (Nano Banana 2)
}

async function callGeminiForImage({
  model, systemPrompt, userPrompt,
  imageBase64, imageSize, aspectRatio, temperature
}) {
  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: [{
      parts: [
        {
          inline_data: {
            mime_type: 'image/jpeg',
            data: imageBase64,
          }
        },
        { text: userPrompt }
      ]
    }],
    generationConfig: {
      response_modalities: ['IMAGE'],     // Chỉ nhận ảnh output
      image_config: {
        image_size: imageSize,            // "1K" | "2K" | "4K" — PHẢI viết hoa
        aspect_ratio: aspectRatio,        // Giữ tỉ lệ ảnh gốc
      },
      temperature,
      top_k: 10,
      top_p: 0.85,
    }
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Gemini API error ${response.status}: ${JSON.stringify(err)}`);
  }

  const data = await response.json();

  const imagePart = data.candidates?.[0]?.content?.parts
    ?.find(p => p.inline_data?.mime_type?.startsWith('image/'));

  if (!imagePart) {
    throw new Error(`Gemini returned no image. Response: ${JSON.stringify(data).slice(0, 300)}`);
  }

  return Buffer.from(imagePart.inline_data.data, 'base64');
}
```

---

## 8. Bước 4 — GroupRestore cho ảnh nhiều người

**Điều kiện:** `analysis.requires_group_restore === true`  
**Mục đích:** Tăng chi tiết mặt từng người khi mặt quá nhỏ trong ảnh nhóm  
**Cải tiến so v2.0:** Context thumbnail + Histogram match xóa color seam

```javascript
// worker/steps/step4-group-restore.js

const FACE_SYSTEM_PROMPT = `
${CORE_SYSTEM_PROMPT}

ADDITIONAL DIRECTIVE — FACE CROP ENHANCEMENT CALL:
You receive TWO images in this call:
  Image 1: Reference scene — the full restored photograph (thumbnail)
  Image 2: A face crop extracted from Image 1

YOUR ONLY TASK:
- Sharpen and recover fine detail in the face crop (Image 2)
- Match color temperature, white balance, and skin tone EXACTLY to Image 1
- Preserve this person's complete identity as visible in Image 1
- Output dimensions must match the face crop input exactly
- Do NOT alter facial structure, expression, or any features
- Do NOT add details not present in Image 1 or Image 2

temperature: minimum — this is a precision recovery task, not creative generation
`;

async function groupRestore(restoredBuffer, analysis, jobId) {
  if (!analysis.requires_group_restore) return restoredBuffer;

  await updateJob(jobId, { step: 'group_restore', progress: 67 });

  // 1. Detect tất cả mặt
  const faces = await detectFaces(restoredBuffer);
  if (faces.length === 0) {
    console.log(`[${jobId}] GroupRestore: no faces detected — skipping`);
    return restoredBuffer;
  }

  // 2. Thumbnail toàn ảnh làm context reference
  const contextThumb = await sharp(restoredBuffer)
    .resize({ width: 400 })
    .jpeg({ quality: 82 })
    .toBuffer();
  const contextBase64 = contextThumb.toString('base64');

  // 3. Enhance tất cả mặt song song
  const PADDING = 35; // px — đủ context viền mặt
  const enhancedFaces = await Promise.all(
    faces.map((face, idx) =>
      enhanceFace(restoredBuffer, face, contextBase64, analysis, PADDING, idx, jobId)
    )
  );

  // 4. Composite từng mặt về đúng vị trí
  let result = restoredBuffer;
  for (const { face, buffer } of enhancedFaces) {
    if (buffer) {
      result = await compositeFaceBack(result, buffer, face, PADDING);
    }
  }

  await updateJob(jobId, { progress: 83 });
  return result;
}

async function enhanceFace(baseBuffer, face, contextBase64, analysis, padding, idx, jobId) {
  try {
    const left   = Math.max(0, face.x - padding);
    const top    = Math.max(0, face.y - padding);
    const width  = Math.min(face.width  + padding * 2, baseBuffer.width  - left);
    const height = Math.min(face.height + padding * 2, baseBuffer.height - top);

    const faceCrop = await sharp(baseBuffer)
      .extract({ left, top, width, height })
      .jpeg({ quality: 93 })
      .toBuffer();
    const faceBase64 = faceCrop.toString('base64');

    const facePrompt = `
Image 1 is the reference scene. Image 2 is a face crop from that scene.

Subject: Person ${idx + 1} of ${analysis.subject_count} in this ${analysis.era_estimate} photograph.
Task: Sharpen this face — recover eye detail, skin texture, hair strands.
Constraint: Match lighting and color of Image 1 EXACTLY.
Constraint: Preserve this individual's EXACT identity — zero alteration to features.
`;

    const buffer = await callGeminiForImage({
      model: 'gemini-3.1-flash-image-preview',
      systemPrompt: FACE_SYSTEM_PROMPT,
      userPrompt: facePrompt,
      imageBase64: `[CONTEXT]${contextBase64}[FACE]${faceBase64}`, // Truyền 2 ảnh
      imageSize: '1K',       // Mặt không cần 4K — 1K đủ chi tiết
      aspectRatio: '1:1',
      temperature: 0.05,     // Cực thấp — precision task
    });

    return { face, buffer };
  } catch (err) {
    console.warn(`[${jobId}] Face ${idx + 1} enhance failed: ${err.message} — skipping`);
    return { face, buffer: null }; // Skip mặt này, giữ nguyên từ Bước 3
  }
}

async function compositeFaceBack(baseBuffer, faceBuffer, face, padding) {
  const targetX = Math.max(0, face.x - padding);
  const targetY = Math.max(0, face.y - padding);

  // Histogram match — normalize màu face theo vùng tương ứng trên base
  const baseStats = await sharp(baseBuffer)
    .extract({
      left: targetX, top: targetY,
      width: faceBuffer.width || face.width + padding * 2,
      height: faceBuffer.height || face.height + padding * 2,
    })
    .stats();

  const faceStats = await sharp(faceBuffer).stats();

  const brightnessAdj = 1 + (
    (baseStats.channels[0].mean - faceStats.channels[0].mean) +
    (baseStats.channels[1].mean - faceStats.channels[1].mean) +
    (baseStats.channels[2].mean - faceStats.channels[2].mean)
  ) / (3 * 255) * 0.25;

  const matchedFace = await sharp(faceBuffer)
    .modulate({ brightness: Math.max(0.8, Math.min(1.2, brightnessAdj)) })
    .toBuffer();

  return await sharp(baseBuffer)
    .composite([{ input: matchedFace, left: targetX, top: targetY, blend: 'over' }])
    .toBuffer();
}
```

---

## 9. Bước 5 — Final Composite & Delivery

Không còn Replicate — không còn webhook. Upload thẳng lên GCS và notify frontend.

```javascript
// worker/steps/step5-delivery.js

async function deliverResult(finalBuffer, jobId, outputSize) {
  await updateJob(jobId, { step: 'delivery', progress: 87 });

  // Upload kết quả lên GCS output bucket
  const outputPath = `output/${jobId}/restored_${outputSize.toLowerCase()}.jpg`;
  await uploadToGCS(finalBuffer, outputPath, OUTPUT_BUCKET);

  // Signed Download URL — tồn tại 7 ngày
  const resultUrl = await getSignedReadUrl(outputPath, '7d', OUTPUT_BUCKET);

  // Dọn dẹp file input và temp
  await deleteGCSPrefix(`input/${jobId}/`);
  await deleteGCSPrefix(`temp/${jobId}/`);

  // Notify frontend qua Firestore
  await updateJob(jobId, {
    status: 'completed',
    progress: 100,
    step: null,
    resultUrl,
    completedAt: Date.now(),
    error: null,
  });
}
```

---

## 10. Luồng dữ liệu đầy đủ

```
Browser
  │ POST /api/get-upload-url
  ├──────────────────────► Cloud Run API (256MB)
  │ ◄─ { signedUploadUrl, jobId }
  │
  │ PUT image (direct)
  ├──────────────────────► GCS: photos-input/{jobId}/
  │
  │ onSnapshot jobs/{jobId}
  ├──────────────────────► Firestore (realtime listener)

GCS photos-input
  │ Object Finalize
  ├──────────────────────► Pub/Sub: photo-uploaded
                                  │
                                  ▼
                           Cloud Run Worker (2GB RAM)
                                  │
                     ┌────────────┴─────────────┐
                     │                          │
               Firestore update           BƯỚC 1: ANALYZE
               status: processing         Gemini Flash text
               progress: 10              512px → JSON
                                         progress: 10→15
                                          │
                                    BƯỚC 2: BUILD PROMPT
                                    JS logic (0 API call)
                                    → userPrompt
                                    → imageSize ("1K"/"2K"/"4K")
                                    → aspectRatio
                                    progress: 15→20
                                          │
                                    BƯỚC 3: GLOBAL RESTORE
                                    Gemini Flash/Pro Image
                                    SYSTEM PROMPT + userPrompt
                                    imageSize = native output
                                    → ảnh restored ở 1K/2K/4K
                                    progress: 20→65
                                          │
                               requires_group_restore?
                                  /              \
                                YES               NO
                                 │                │
                          BƯỚC 4: GROUP           │
                          RESTORE                 │
                          face-api detect         │   progress: 65→83
                          Promise.all             │
                          per-face Gemini         │
                          histogram match         │
                          composite               │
                                 \               /
                                  └──────┬──────┘
                                         │
                                  BƯỚC 5: DELIVERY
                                  Upload → GCS output
                                  Signed URL (7 ngày)
                                  Delete temp/input
                                  Firestore: completed
                                  progress: 87→100
                                         │
                                  Firestore onSnapshot
                                         │
                                  Browser receives resultUrl
                                  Before/after slider
                                  Download button
```

---

## 11. Model Gemini — Lựa chọn và tham số

### Model identifiers

| Model | API Identifier | Độ phân giải | Dùng cho |
|---|---|---|---|
| Gemini 3.1 Flash Image | `gemini-3.1-flash-image-preview` | 512 / 1K / 2K / 4K | Ảnh hư hại nhẹ-trung bình |
| Gemini 3 Pro Image | `gemini-3-pro-image-preview` | 1K / 2K / 4K | Ảnh hư hại nặng, ảnh nhóm phức tạp |

### Resolution mapping

| User chọn | `image_size` | Pixel output | Dùng cho |
|---|---|---|---|
| Standard | `"1K"` | 1024×1024px | Preview nhanh, test |
| High | `"2K"` | 2048×2048px | Mặc định đề xuất |
| Ultra | `"4K"` | 4096×4096px | In ấn, lưu trữ lâu dài |

### Tham số quan trọng

```javascript
generationConfig: {
  response_modalities: ['IMAGE'], // Bắt buộc để nhận ảnh output
  image_config: {
    image_size: imageSize,        // PHẢI viết hoa: "1K", "2K", "4K"
    aspect_ratio: aspectRatio,    // Giữ tỉ lệ ảnh gốc
  },
  temperature: 0.1,              // Global restore — thấp để giữ trung thực
  // Per-face restore: 0.05      // Cực thấp — precision task
}

// LƯU Ý QUAN TRỌNG:
// "4k" (chữ thường) → API KHÔNG báo lỗi → silently fallback về 1K
// Luôn kiểm tra size thực tế của buffer nhận về để detect vấn đề này
```

---

## 12. Cấu hình Google Cloud

### Cloud Run Worker

```yaml
# cloud-run-worker.yaml
resources:
  limits:
    cpu: "2"
    memory: "2Gi"         # Sharp + base64 4K buffer tốn RAM
timeoutSeconds: 300
maxInstances: 3
minInstances: 0
containerConcurrency: 1   # 1 ảnh/instance — tránh memory contention
```

### Cloud Run API

```yaml
# cloud-run-api.yaml
resources:
  limits:
    cpu: "1"
    memory: "256Mi"
timeoutSeconds: 30
maxInstances: 10
minInstances: 0
```

### GCS Buckets

```bash
# Input bucket — xóa sau 1 ngày
gcloud storage buckets create gs://photos-input \
  --location=asia-southeast1

# Output bucket — xóa sau 7 ngày
gcloud storage buckets create gs://photos-output \
  --location=asia-southeast1

# Lifecycle rules
gcloud storage buckets update gs://photos-input \
  --lifecycle-file=lifecycle-1day.json

gcloud storage buckets update gs://photos-output \
  --lifecycle-file=lifecycle-7day.json
```

### Pub/Sub

```bash
gcloud pubsub topics create photo-uploaded

gcloud storage buckets notifications create gs://photos-input \
  --topic=photo-uploaded \
  --event-types=OBJECT_FINALIZE

gcloud pubsub subscriptions create photo-worker-sub \
  --topic=photo-uploaded \
  --push-endpoint=https://WORKER_URL/pubsub \
  --ack-deadline=300 \
  --min-retry-delay=10s \
  --max-retry-delay=60s
```

---

## 13. Cấu trúc Firestore

```typescript
// Collection: jobs/{jobId}
interface Job {
  // Identity
  jobId: string;
  createdAt: number;
  completedAt: number | null;

  // Status
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;         // 0–100
  step: 'analyze'
      | 'restore'
      | 'group_restore'
      | 'delivery'
      | null;

  // Config
  outputSize: 'Standard' | 'High' | 'Ultra';
  imageSize: '1K' | '2K' | '4K';
  gcsPath: string;

  // Analysis result (từ Bước 1)
  analysis: {
    photo_type: string;
    subject_count: number;
    face_sizes: 'large' | 'medium' | 'small';
    damage_severity: 'light' | 'moderate' | 'heavy' | 'extreme';
    requires_group_restore: boolean;
    recommended_model: 'gemini_flash' | 'gemini_pro';
    era_estimate: string;
  } | null;

  // Runtime
  activeModel: string | null;   // Model đang chạy
  recommendedModel: string | null;

  // Result
  resultUrl: string | null;     // Signed URL 7 ngày
  error: string | null;
}
```

---

## 14. Xử lý lỗi và Fallback

### Gemini Analysis thất bại

```
→ Parse JSON thất bại hoặc API lỗi
→ Dùng default analysis (portrait_single, moderate, gemini_flash)
→ Tiếp tục pipeline với prompt mặc định
→ Log warning để monitor
```

### Gemini Restore thất bại lần 1

```
→ Retry với model khác (Flash ↔ Pro)
→ Giảm image_size xuống 1 bậc (4K→2K→1K) để giảm tải
→ Nếu thành công: note "retry_model_change" trong Firestore
```

### Gemini Restore thất bại lần 2

```
→ Sharp fallback:
  - normalise() — histogram equalization
  - modulate({ saturation: 1.1, brightness: 1.05 })
  - sharpen({ sigma: 0.8 })
  - jpeg({ quality: 88 })
→ Upload kết quả fallback
→ Firestore: status=completed, note="sharp_fallback_quality"
→ Vẫn trả kết quả cho user — không hiển thị lỗi
```

### Per-face GroupRestore thất bại

```
→ Log warning cho mặt cụ thể đó
→ Skip mặt đó — giữ nguyên từ Global Restore
→ Tiếp tục với các mặt khác
→ Pipeline không dừng lại
```

### Idempotency — Pub/Sub retry

```javascript
app.post('/pubsub', async (req, res) => {
  const jobId = extractJobId(req.body);
  const job = await db.collection('jobs').doc(jobId).get();

  // Nếu đã đang xử lý hoặc xong — ack và bỏ qua
  if (['processing', 'finalizing', 'completed'].includes(job.data()?.status)) {
    return res.sendStatus(200);
  }

  await updateJob(jobId, { status: 'processing' });
  res.sendStatus(200); // Ack ngay

  // Xử lý bất đồng bộ
  runPipeline(jobId).catch(err => handlePipelineError(jobId, err));
});
```

---

## 15. Ước tính chi phí

### Chi phí per ảnh — v3.0

| Bước | Model | 1K Standard | 2K High | 4K Ultra |
|---|---|---|---|---|
| Analyze | Gemini Flash (text) | ~$0.0001 | ~$0.0001 | ~$0.0001 |
| Global Restore | Gemini 3.1 Flash Image | ~$0.067 | ~$0.101 | ~$0.151 |
| Global Restore | Gemini 3 Pro Image | ~$0.134 | ~$0.134 | ~$0.240 |
| GroupRestore (4 mặt) | Gemini Flash 1K | +$0.027 | +$0.027 | +$0.027 |
| GCS + Cloud Run | Infra | ~$0.001 | ~$0.001 | ~$0.001 |

### Tổng per ảnh (phổ biến nhất — Flash + 2K)

| Loại ảnh | Chi phí |
|---|---|
| Ảnh 1 người, 2K | ~$0.101 |
| Ảnh nhóm 4 người, 2K + GroupRestore | ~$0.129 |
| Ảnh 1 người, 4K Ultra | ~$0.152 |
| Ảnh nhóm 4K Ultra + GroupRestore | ~$0.179 |

### So sánh v2.0 vs v3.0

| | v2.0 (Flash + Real-ESRGAN) | v3.0 (Flash native 2K) |
|---|---|---|
| Chi phí/ảnh | ~$0.071 | ~$0.101 |
| Latency | ~90–120s | ~30–60s |
| Services | Gemini + Replicate | Gemini only |
| Chất lượng | Restore 1K → upscale 4K | Native 2K từ Gemini |
| Phụ thuộc | 2 vendors | 1 vendor |

v3.0 đắt hơn ~$0.03/ảnh nhưng đổi lại: latency giảm một nửa, kiến trúc đơn giản hơn, và chất lượng native cao hơn upscale cơ học.

### Khả năng với $300 Google Cloud Trial

> Lưu ý: Gemini Image API tính phí riêng, không thuộc $300 GCP trial.  
> $300 trial dùng cho GCS, Cloud Run, Pub/Sub, Firestore.

| Resolution | Chi phí Gemini/ảnh | Số ảnh nếu budget $500 Gemini |
|---|---|---|
| 1K Standard | ~$0.067 | ~7,400 ảnh |
| 2K High | ~$0.101 | ~4,900 ảnh |
| 4K Ultra | ~$0.151 | ~3,300 ảnh |

---

## 16. Thứ tự triển khai

### Sprint 1 — Core Pipeline không GroupRestore (Tuần 1–2)

- [ ] GCS buckets + lifecycle rules
- [ ] Pub/Sub topic + subscription + push endpoint
- [ ] Cloud Run API: Signed URL + Firestore job creation
- [ ] Cloud Run Worker: Pub/Sub handler + idempotency
- [ ] Bước 1: Gemini Analysis + JSON parse + fallback default
- [ ] Bước 2: Build Prompt JS logic đầy đủ
- [ ] Bước 3: Gemini Global Restore với `image_size` parameter
- [ ] Bước 5: GCS upload + Signed URL + Firestore update
- [ ] Frontend: upload flow + onSnapshot + progress bar

**Test:** 20 ảnh thực tế các loại — so sánh 1K/2K/4K output  
**Verify:** `image_size: "4K"` trả về đúng 4096px (kiểm tra buffer size)

### Sprint 2 — GroupRestore (Tuần 3)

- [ ] face-api.js server-side setup + model loading
- [ ] Per-face crop + context thumbnail
- [ ] Gemini per-face call với `temperature: 0.05`
- [ ] Histogram match + Sharp composite
- [ ] Promise.all parallel processing
- [ ] Test với ảnh gia đình 3–8 người

**Test:** So sánh chất lượng mặt before/after GroupRestore  
**Threshold:** Chỉ bật GroupRestore nếu improvement rõ rệt

### Sprint 3 — Quality & Hardening (Tuần 4)

- [ ] Fallback chain đầy đủ (retry + sharp fallback)
- [ ] Frontend: before/after slider + download by size
- [ ] Model selection logic tinh chỉnh dựa trên test thực tế
- [ ] Rate limit + error monitoring
- [ ] Load test: 10 ảnh đồng thời

### Sprint 4 — Production (Tuần 5)

- [ ] Gemini model upgrade khi Google release phiên bản mới
- [ ] A/B test: 2K vs 4K — user satisfaction vs cost
- [ ] GCS auto-delete verification
- [ ] Cloud Monitoring alerts cho failure rate > 5%
- [ ] Documentation nội bộ cho team support

---

## Phụ lục — Quyết định kỹ thuật

| Quyết định | Lý do |
|---|---|
| Bỏ Real-ESRGAN | Gemini native resolution tốt hơn upscale cơ học; loại bỏ 1 vendor dependency |
| `temperature: 0.1` Global Restore | Cân bằng giữa trung thực và khả năng suy luận của model |
| `temperature: 0.05` Per-face | Precision task — minimize sáng tạo, maximize fidelity |
| 2K là default đề xuất | Tốt nhất về cost/quality ratio; 4K dành cho in ấn thật sự |
| Compress input 1200px | Input cao hơn không cải thiện output nhưng tăng cost đáng kể |
| face-api server-side | Không phụ thuộc thiết bị client; kết quả nhất quán |
| Thumbnail 400px cho context | Đủ để Gemini nhận biết ánh sáng và màu sắc tổng thể |
| SYSTEM PROMPT bất biến | Đảm bảo RULE 1 (identity preservation) luôn được áp dụng |

---

*Pipeline v3.0 — Một hệ sinh thái duy nhất. Gemini phân tích, phục hồi, và xuất ảnh resolution cao native.*  
*Không Real-ESRGAN. Không Replicate. Không upscale cơ học.*
