import { useState } from 'react';
import { GoogleGenAI } from "@google/genai";

export interface PipelineOptions {
  selectedModel: string;
  selectedResolution: string;
  colorization: boolean;
  faceEnhancement: boolean;
  clothingEnhancement: boolean;
  maxFaces: string;
  detectionSensitivity: number;
  blendingSmoothness: number;
  prompts: {
    analysis: string;
    enhancement: string;
    face: string;
    clothing: string;
  };
}

export interface PipelineStatus {
  step: string;
  progress: number;
}

export const useHybridPipeline = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<PipelineStatus>({ step: '', progress: 0 });
  const [error, setError] = useState<string | null>(null);

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  const runPipeline = async (originalImage: string, options: PipelineOptions) => {
    setIsProcessing(true);
    setError(null);
    setStatus({ step: 'Khởi tạo hệ thống...', progress: 5 });

    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("API Key không khả dụng. Vui lòng chọn API Key từ menu.");
      const ai = new GoogleGenAI({ apiKey });
      
      const base64Data = originalImage.split(',')[1];
      const mimeType = originalImage.split(';')[0].split(':')[1];

      // --- STEP 1: Analysis (Frontend AI) ---
      setStatus({ step: 'Bước 1: Phân tích hình ảnh...', progress: 10 });
      const analysisResponse = await ai.models.generateContent({
        model: options.selectedModel,
        contents: {
          parts: [
            { text: options.prompts.analysis },
            { inlineData: { data: base64Data, mimeType } }
          ]
        },
        config: { temperature: 0.1 }
      });
      const identityLog = analysisResponse.text;
      console.log("Identity Preservation Log:", identityLog);

      // --- STEP 2: Base Enhancement (Frontend AI) ---
      setStatus({ step: 'Bước 2: Phục hồi tổng thể...', progress: 30 });
      const enhancementResponse = await ai.models.generateContent({
        model: options.selectedModel,
        contents: {
          parts: [
            { text: `${options.prompts.enhancement}\n\nIDENTITY PRESERVATION LOG:\n${identityLog}` },
            { inlineData: { data: base64Data, mimeType } }
          ]
        },
        config: {
          temperature: 0.1
        }
      });

      let enhancedBase64 = "";
      for (const part of enhancementResponse.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) enhancedBase64 = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
      if (!enhancedBase64) throw new Error("AI không trả về ảnh phục hồi nền.");

      // --- STEP 3: Extract Faces (Backend Tool) ---
      setStatus({ step: 'Bước 3: Tách diện mạo...', progress: 50 });
      const extractRes = await fetch('/api/process-hybrid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: enhancedBase64,
          detectionSensitivity: options.detectionSensitivity,
          maxFaces: options.maxFaces
        })
      });
      
      const extractData = await extractRes.json();
      if (!extractRes.ok) throw new Error(extractData.error || "Lỗi tách mặt.");
      const faces = extractData.faces || [];

    // --- STEP 4: Face Enhancement (Frontend AI) ---
    const enhancedFaces = [];
    if (faces.length > 0 && options.faceEnhancement) {
      console.log(`Starting enhancement for ${faces.length} faces...`);
      setStatus({ step: `Bước 4: Nâng cấp ${faces.length} khuôn mặt...`, progress: 60 });
      
      for (let i = 0; i < faces.length; i++) {
        const face = faces[i];
        console.log(`Processing face ${i + 1}/${faces.length}...`);
        const faceProgress = 60 + Math.floor(((i + 0.5) / faces.length) * 20);
        const estimatedSecondsLeft = (faces.length - i) * 12;
        const timeLabel = estimatedSecondsLeft > 60
          ? `~${Math.ceil(estimatedSecondsLeft / 60)} phút còn lại`
          : `~${estimatedSecondsLeft}s còn lại`;
        setStatus({ 
          step: `Bước 4: Khuôn mặt ${i + 1}/${faces.length} — ${timeLabel}`, 
          progress: faceProgress 
        });

        const MAX_RETRIES = 2;
        let enhancedFaceBase64 = "";
        let lastError: any = null;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            if (attempt > 0) {
              const retryDelay = attempt * 3000;
              console.log(`Retry ${attempt}/${MAX_RETRIES} for face ${i + 1}, waiting ${retryDelay}ms...`);
              await delay(retryDelay);
            }
            const faceResponse = await ai.models.generateContent({
              model: options.selectedModel,
              contents: {
                parts: [
                  { text: `${options.prompts.face}\n\nIDENTITY PRESERVATION LOG:\n${identityLog}` },
                  { inlineData: { data: face.imageBase64, mimeType: 'image/png' } }
                ]
              },
              config: { temperature: 0.1 }
            });

            const candidate = faceResponse.candidates?.[0];

            if (candidate?.content?.parts) {
              for (const part of candidate.content.parts) {
                if (part.inlineData) {
                  enhancedFaceBase64 = part.inlineData.data;
                  break;
                }
              }
            }

            if (enhancedFaceBase64) {
              console.log(`Face ${i + 1} enhanced successfully on attempt ${attempt + 1}.`);
              break; // Thành công, thoát khỏi vòng retry
            } else {
              console.warn(`Face ${i + 1} attempt ${attempt + 1}: no image returned. Reason: ${candidate?.finishReason}`);
              lastError = new Error(`No image returned: ${candidate?.finishReason}`);
            }
          } catch (faceErr) {
            lastError = faceErr;
            console.error(`Face ${i + 1} attempt ${attempt + 1} error:`, faceErr);
          }
        }
        if (!enhancedFaceBase64) {
          console.warn(`Face ${i + 1} failed after ${MAX_RETRIES + 1} attempts. Using original.`);
        }
        enhancedFaces.push({
          ...face,
          imageBase64: enhancedFaceBase64 || face.imageBase64
        });

        if (i < faces.length - 1) {
          console.log("Waiting for rate limit...");
          await delay(4000); // Increased delay for safety
        }
      }
      console.log("Face enhancement loop completed.");
      setStatus({ step: `Bước 4: Hoàn tất ${enhancedFaces.length} khuôn mặt ✓`, progress: 80 });
      await delay(400);
    } else {
      enhancedFaces.push(...faces);
    }

      // --- STEP 4B: Clothing Enhancement (Frontend AI) ---
      let clothingEnhancedBase64 = null;
      if (options.clothingEnhancement) {
        setStatus({ step: 'Bước 4B: Tái tạo chi tiết trang phục...', progress: 80 });
        try {
          const clothingResponse = await ai.models.generateContent({
            model: options.selectedModel,
            contents: {
              parts: [
                { text: `${options.prompts.clothing}\n\nIDENTITY PRESERVATION LOG & CLOTHING TEXTURE MAP:\n${identityLog}` },
                { inlineData: { data: enhancedBase64.split(',')[1], mimeType: 'image/jpeg' } }
              ]
            },
            config: { temperature: 0.1 }
          });
          
          for (const part of clothingResponse.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
              clothingEnhancedBase64 = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
              break;
            }
          }
          if (!clothingEnhancedBase64) {
            console.warn("Clothing enhancement returned no image.");
          }
        } catch (err) {
          console.error("Clothing enhancement failed, skipping:", err);
        }
      }

      // --- STEP 5: Finalize (Backend Tool) ---
      setStatus({ step: `Bước 5: Ghép ảnh & Upscale ${options.selectedResolution}...`, progress: 90 });
      const finalizeRes = await fetch('/api/finalize-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseImageBase64: enhancedBase64,
          clothingImageBase64: clothingEnhancedBase64,
          faces: enhancedFaces,
          blendingSmoothness: options.blendingSmoothness,
          selectedResolution: options.selectedResolution
        })
      });

      const finalizeData = await finalizeRes.json();
      if (!finalizeRes.ok) throw new Error(finalizeData.error || "Lỗi hoàn thiện ảnh.");

      setStatus({ step: 'Hoàn tất!', progress: 100 });
      setIsProcessing(false);
      return finalizeData.image;

    } catch (err: any) {
      console.error("Pipeline Error:", err);
      setError(err.message || "Đã xảy ra lỗi không xác định.");
      setIsProcessing(false);
      throw err;
    }
  };

  return {
    runPipeline,
    isProcessing,
    status,
    setStatus,
    error,
    setError
  };
};
