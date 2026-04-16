import { useCallback, useState } from 'react';
import { apiRequest } from '../lib/api';
import {
  DEFAULT_ANALYSIS,
  toUserFacingPipelineError,
} from '../shared/geminiPipeline';
import type {
  AnalysisResult,
  IdPhotoOptions,
  ModelType,
  PipelineStatus,
  RestoreOptions,
} from '../shared/types';

interface ProcessImageResponse {
  image: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  };
}

export type { AnalysisResult, IdPhotoOptions, ModelType, RestoreOptions } from '../shared/types';
export type {
  IdPhotoAspectRatio,
  IdPhotoBackgroundMode,
  IdPhotoClothingMode,
  IdPhotoCrop,
  IdPhotoExpression,
  IdPhotoGaze,
  IdPhotoPose,
} from '../shared/types';
export { DEFAULT_ANALYSIS } from '../shared/geminiPipeline';

export const useGeminiPipeline = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<PipelineStatus>({ step: '', progress: 0 });
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  const setManualAnalysis = useCallback((analysisData: AnalysisResult) => {
    setError(null);
    setAnalysis(analysisData);
  }, []);

  const restoreImage = useCallback(async (
    imageDataUri: string,
    analysisData: AnalysisResult,
    options: RestoreOptions,
  ): Promise<string> => {
    setIsProcessing(true);
    setError(null);
    setStatus({ step: 'Đang khởi tạo phục hồi…', progress: 10 });

    try {
      setStatus({ step: 'Đang gửi ảnh lên Cloudflare Functions…', progress: 20 });
      setStatus({ step: 'Đang phục hồi tổng thể… (có thể mất 1-2 phút)', progress: 35 });

      const response = await apiRequest<ProcessImageResponse>('/api/process/restore', {
        method: 'POST',
        body: JSON.stringify({
          imageDataUri,
          analysis: analysisData,
          options,
        }),
      });

      if (!response.image) {
        throw new Error('Model không trả về ảnh. Vui lòng thử lại hoặc chọn model khác.');
      }

      setStatus({ step: 'Hoàn tất! ✓', progress: 100 });
      setIsProcessing(false);
      return response.image;
    } catch (err: any) {
      const msg = toUserFacingPipelineError(err);
      setError(msg);
      setIsProcessing(false);
      throw err;
    }
  }, []);

  const restoreIdPhoto = useCallback(async (
    imageDataUri: string,
    options: IdPhotoOptions,
  ): Promise<string> => {
    setIsProcessing(true);
    setError(null);
    setStatus({ step: 'Đang chuẩn hóa ảnh ID…', progress: 10 });

    try {
      setStatus({ step: 'Đang gửi yêu cầu lên Cloudflare Functions…', progress: 20 });
      setStatus({ step: 'Đang tạo ảnh ID photo… (có thể mất 1-2 phút)', progress: 35 });

      const response = await apiRequest<ProcessImageResponse>('/api/process/id-photo', {
        method: 'POST',
        body: JSON.stringify({
          imageDataUri,
          options,
        }),
      });

      if (!response.image) {
        throw new Error('Model không trả về ảnh ID. Vui lòng thử lại hoặc đổi model khác.');
      }

      setStatus({ step: 'Hoàn tất ảnh ID! ✓', progress: 100 });
      setIsProcessing(false);
      return response.image;
    } catch (err: any) {
      const msg = toUserFacingPipelineError(err);
      setError(msg);
      setIsProcessing(false);
      throw err;
    }
  }, []);

  const upscaleImage = useCallback(async (
    imageDataUri: string,
    upscaleFactor: 'x2' | 'x4',
  ): Promise<string> => {
    setIsProcessing(true);
    setError(null);
    setStatus({ step: `Đang upscale ảnh (${upscaleFactor})…`, progress: 10 });

    try {
      setStatus({ step: 'Đang gửi ảnh lên Imagen 4.0 Upscale…', progress: 30 });

      const response = await apiRequest<{ image: string }>('/api/process/upscale', {
        method: 'POST',
        body: JSON.stringify({ imageDataUri, upscaleFactor }),
      });

      if (!response.image) {
        throw new Error('Imagen Upscale không trả về ảnh. Vui lòng thử lại.');
      }

      setStatus({ step: 'Upscale hoàn tất! ✓', progress: 100 });
      setIsProcessing(false);
      return response.image;
    } catch (err: any) {
      const msg = toUserFacingPipelineError(err);
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
    isProcessing,
    status,
    setStatus,
    error,
    setError,
    analysis,
    setManualAnalysis,
    restoreImage,
    restoreIdPhoto,
    upscaleImage,
    resetState,
  };
};
