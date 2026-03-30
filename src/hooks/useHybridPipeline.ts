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
        model: 'gemini-3-pro-image-preview', // Force Pro for best background detail
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
        setStatus({ 
          step: `Bước 4: Đang xử lý mặt ${i + 1}/${faces.length}...`, 
          progress: 60 + Math.floor((i / faces.length) * 20) 
        });

        try {
          const faceResponse = await ai.models.generateContent({
            model: options.selectedModel,
            contents: {
              parts: [
                { text: `${options.prompts.face}\n\nIDENTITY PRESERVATION LOG:\n${identityLog}` },
                { inlineData: { data: face.imageBase64, mimeType: 'image/jpeg' } }
              ]
            },
            config: { temperature: 0.1 }
          });

          let enhancedFaceBase64 = "";
          const candidate = faceResponse.candidates?.[0];
          
          if (candidate?.content?.parts) {
            for (const part of candidate.content.parts) {
              if (part.inlineData) {
                enhancedFaceBase64 = part.inlineData.data;
                break;
              }
            }
          }

          if (!enhancedFaceBase64) {
            console.warn(`Face ${i + 1} enhancement returned no image. Reason: ${candidate?.finishReason}`);
          }

          enhancedFaces.push({
            ...face,
            imageBase64: enhancedFaceBase64 || face.imageBase64
          });
        } catch (faceErr) {
          console.error(`Error enhancing face ${i + 1}:`, faceErr);
          // Push original face if enhancement fails to avoid losing it
          enhancedFaces.push(face);
        }

        if (i < faces.length - 1) {
          console.log("Waiting for rate limit...");
          await delay(4000); // Increased delay for safety
        }
      }
      console.log("Face enhancement loop completed.");
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
      setStatus({ step: 'Bước 5: Hoàn thiện & Đóng gói...', progress: 90 });
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
