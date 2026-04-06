import React, { useState, useEffect } from 'react';
import {
  Upload,
  Sparkles,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Zap,
  ShieldCheck,
  Key,
  ChevronRight,
  Palette,
  Shirt,
  Eye,
  Camera,
  Layers,
  Users,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageSlider } from '../components/ImageSlider';
import { FloatingPopup } from '../components/FloatingPopup';
import { Link } from 'react-router-dom';
import {
  useGeminiPipeline,
  ModelType,
  ResolutionType,
  AnalysisResult,
  RestoreOptions,
} from '../hooks/useGeminiPipeline';

type PopupStep = 'none' | 'analyzing' | 'analysis-result' | 'model' | 'resolution' | 'options' | 'processing' | 'upscale';
type CompareMode = 'original-vs-current' | 'gemini-vs-upscaled';

const CLOTHING_PRESETS: Record<string, string> = {
  "Vest Nam (Truyền thống)": "A professional black business suit, crisp white button-down dress shirt, and a neatly tied classic silk necktie.",
  "Vest Nam (Lịch lãm)": "A professional navy blue business suit, crisp white button-down dress shirt, worn without a necktie.",
  "Áo dài (Nữ)": "Traditional Vietnamese Ao Dai with a high standing collar, elegant silk fabric.",
  "Sơ mi trắng": "A clean, crisp white button-down dress shirt with a classic pointed collar.",
};

export default function GroupRestore() {
  const {
    isProcessing,
    isAnalyzing,
    status,
    setStatus,
    error,
    setError,
    analysis,
    analyzeImage,
    restoreImage,
    resetState,
  } = useGeminiPipeline();

  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [restoredImage, setRestoredImage] = useState<string | null>(null);
  const [geminiRestoredImage, setGeminiRestoredImage] = useState<string | null>(null);
  const [upscaledImage, setUpscaledImage] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState<CompareMode>('original-vs-current');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [popupStep, setPopupStep] = useState<PopupStep>('none');

  const [selectedModel, setSelectedModel] = useState<ModelType>('gemini-3-pro-image-preview');
  const [selectedResolution, setSelectedResolution] = useState<ResolutionType>('2K');
  const [colorize, setColorize] = useState(false);
  const [replaceClothing, setReplaceClothing] = useState(false);
  const [clothingOption, setClothingOption] = useState('Vest Nam (Truyền thống)');
  const [clothingText, setClothingText] = useState('');
  const [upscaleScaleFactor, setUpscaleScaleFactor] = useState(2);
  const [upscaleCreativity, setUpscaleCreativity] = useState(0.3);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [upscaleProgress, setUpscaleProgress] = useState(0);
  const [upscaleStatusText, setUpscaleStatusText] = useState('Sẵn sàng upscale');
  const [upscalePredictionId, setUpscalePredictionId] = useState<string | null>(null);

  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      } else {
        setHasApiKey(true);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const handleFile = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setError("Dung lượng ảnh tối đa là 10MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUri = event.target?.result as string;
      setOriginalImage(dataUri);
      setRestoredImage(null);
      setGeminiRestoredImage(null);
      setUpscaledImage(null);
      setCompareMode('original-vs-current');
      setError(null);
      resetState();
      setPopupStep('analyzing');
      analyzeImage(dataUri).then((result) => {
        setPopupStep('analysis-result');
        if (result.is_black_white || result.is_sepia) setColorize(true);
        if (result.recommended_model === 'gemini_pro') {
          setSelectedModel('gemini-3-pro-image-preview');
        } else {
          setSelectedModel('gemini-3.1-flash-image-preview');
        }
      });
    };
    reader.readAsDataURL(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const startRestore = async () => {
    if (!originalImage || !analysis) return;
    setPopupStep('processing');

    const selectedClothingPrompt = replaceClothing
      ? (clothingOption === 'Tùy chỉnh' ? clothingText : CLOTHING_PRESETS[clothingOption] || '')
      : '';

    const options: RestoreOptions = {
      model: selectedModel,
      resolution: selectedResolution,
      colorize,
      replaceClothing,
      clothingPrompt: selectedClothingPrompt,
    };

    try {
      const result = await restoreImage(originalImage, analysis, options);
      setGeminiRestoredImage(result);
      setUpscaledImage(null);
      setRestoredImage(result);
      setCompareMode('original-vs-current');
      setUpscaleProgress(0);
      setUpscaleStatusText('Sẵn sàng upscale');
      setUpscalePredictionId(null);
      // Removed auto-show upscale popup - now shows button instead
    } catch {
      setPopupStep('none');
    }
  };

  const startUpscale = async () => {
    if (!restoredImage || isUpscaling) return;
    setIsUpscaling(true);
    setError(null);
    setUpscaleProgress(5);
    setUpscaleStatusText('Đang gửi yêu cầu upscale...');
    setUpscalePredictionId(null);

    try {
      const startResponse = await fetch('/api/upscale-image/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUri: restoredImage,
          scaleFactor: upscaleScaleFactor,
          creativity: upscaleCreativity,
        }),
      });

      if (!startResponse.ok) {
        const payload = await startResponse.json().catch(() => ({}));
        throw new Error(payload?.error || 'Upscale thất bại.');
      }

      const startData = await startResponse.json();
      if (!startData?.predictionId) {
        throw new Error('Không nhận được predictionId từ Replicate.');
      }

      setUpscalePredictionId(startData.predictionId);
      setUpscaleProgress(Number(startData.progress ?? 10));
      setUpscaleStatusText(startData.message || 'Replicate đang xử lý...');

      let done = false;
      while (!done) {
        await wait(1400);
        const statusResponse = await fetch(`/api/upscale-image/status/${encodeURIComponent(startData.predictionId)}`);
        if (!statusResponse.ok) {
          const payload = await statusResponse.json().catch(() => ({}));
          throw new Error(payload?.error || 'Không lấy được tiến trình upscale.');
        }
        const statusData = await statusResponse.json();
        setUpscaleProgress(Number(statusData.progress ?? 0));
        setUpscaleStatusText(statusData.message || 'Replicate đang xử lý...');

        if (statusData.status === 'succeeded') {
          if (!statusData?.upscaledImage) {
            throw new Error('Upscale không trả về ảnh hợp lệ.');
          }
          setUpscaledImage(statusData.upscaledImage);
          setRestoredImage(statusData.upscaledImage);
          setCompareMode('gemini-vs-upscaled');
          setUpscaleProgress(100);
          setUpscaleStatusText('Upscale hoàn tất');
          setPopupStep('none');
          done = true;
        } else if (statusData.status === 'failed' || statusData.status === 'canceled') {
          throw new Error(statusData.error || 'Upscale thất bại.');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Không thể upscale ảnh.');
    } finally {
      setIsUpscaling(false);
    }
  };

  const downloadGeminiImage = () => {
    if (!geminiRestoredImage) return;
    const link = document.createElement('a');
    link.href = geminiRestoredImage;
    link.download = `QUANGTHOAI_GROUP_${selectedResolution}_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadUpscaledImage = () => {
    if (!upscaledImage) return;
    const link = document.createElement('a');
    link.href = upscaledImage;
    link.download = `QUANGTHOAI_GROUP_${selectedResolution}_${upscaleScaleFactor}x_UPSCALE_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetAll = () => {
    setOriginalImage(null);
    setRestoredImage(null);
    setGeminiRestoredImage(null);
    setUpscaledImage(null);
    setCompareMode('original-vs-current');
    setPopupStep('none');
    setUpscaleScaleFactor(2);
    setUpscaleCreativity(0.3);
    setIsUpscaling(false);
    setUpscaleProgress(0);
    setUpscaleStatusText('Sẵn sàng upscale');
    setUpscalePredictionId(null);
    resetState();
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'light': return 'text-green-400 bg-green-500/10 border-green-500/20';
      case 'moderate': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      case 'heavy': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
      case 'extreme': return 'text-red-400 bg-red-500/10 border-red-500/20';
      default: return 'text-white/60 bg-white/5 border-white/10';
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'light': return 'Nhẹ';
      case 'moderate': return 'Trung bình';
      case 'heavy': return 'Nặng';
      case 'extreme': return 'Rất nặng';
      default: return severity;
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#050505] text-white font-sans selection:bg-emerald-500/30 relative">
      {/* Background Glows */}
      <div className="fixed top-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-600/5 blur-[150px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-teal-600/5 blur-[150px] rounded-full pointer-events-none" />

      {/* Top Bar */}
      <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-4 md:p-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-colors">
            <ArrowLeft className="w-4 h-4 text-white" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Users className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm md:text-base font-bold tracking-tight">QUANGTHOAI RESTORE</h1>
              <p className="text-[9px] text-white/30 uppercase tracking-widest">Phục hồi Ảnh Nhóm / Gia Đình</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleSelectKey}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
            hasApiKey
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse'
          }`}
        >
          {hasApiKey ? <ShieldCheck className="w-3.5 h-3.5" /> : <Key className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{hasApiKey ? 'API Connected' : 'Chọn API Key'}</span>
        </button>
      </header>

      {/* Main Workspace */}
      <main
        className="w-full h-full flex items-center justify-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <AnimatePresence mode="wait">
          {!originalImage ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="group relative w-full max-w-xl aspect-video bg-white/[0.02] border-2 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center gap-6 hover:border-emerald-500/40 hover:bg-emerald-500/[0.02] transition-all duration-500 mx-4 cursor-pointer"
              onClick={() => document.getElementById('group-file-input')?.click()}
            >
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-500/10 transition-all duration-500">
                <Upload className="w-8 h-8 text-white/30 group-hover:text-emerald-400 transition-colors" />
              </div>
              <div className="text-center px-4">
                <p className="text-lg font-medium text-white/80">Kéo thả ảnh nhóm vào đây</p>
                <p className="text-sm text-white/30 mt-1">Ảnh gia đình, nhóm bạn, tập thể (Tối đa 10MB)</p>
              </div>
              <label
                className="px-8 py-3 bg-white text-black rounded-full text-sm font-semibold cursor-pointer hover:bg-emerald-50 transition-colors shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                Chọn từ máy tính
                <input id="group-file-input" type="file" className="hidden" accept="image/*" onChange={onFileChange} />
              </label>
            </motion.div>
          ) : (
            <motion.div
              key="workspace"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full h-full flex flex-col items-center justify-center p-4 pt-20 pb-24 md:p-12 md:pt-24 md:pb-28"
            >
              <div className="relative flex-1 w-full max-w-6xl flex items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                {restoredImage ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageSlider
                      before={
                        compareMode === 'gemini-vs-upscaled' && geminiRestoredImage && upscaledImage
                          ? geminiRestoredImage
                          : originalImage
                      }
                      after={
                        compareMode === 'gemini-vs-upscaled' && geminiRestoredImage && upscaledImage
                          ? upscaledImage
                          : restoredImage
                      }
                      beforeLabel={compareMode === 'gemini-vs-upscaled' ? 'GEMINI' : 'GOC'}
                      afterLabel={compareMode === 'gemini-vs-upscaled' ? 'UPSCALE' : upscaledImage ? 'UPSCALED' : 'PHUC HOI'}
                    />
                  </div>
                ) : (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <img src={originalImage} alt="Original" className="max-w-full max-h-full object-contain" />
                    {isProcessing && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-6 z-10">
                        <div className="relative w-20 h-20">
                          <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full" />
                          <motion.div
                            className="absolute inset-0 border-4 border-t-emerald-500 rounded-full"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          />
                          <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-emerald-400" />
                        </div>
                        <div className="text-center space-y-3 px-8">
                          <p className="text-lg font-bold">{status.step}</p>
                          <div className="w-64 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500"
                              initial={{ width: 0 }}
                              animate={{ width: `${status.progress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4 mt-4">
                <button onClick={resetAll} className="flex items-center gap-2 text-sm text-white/40 hover:text-white">
                  <RefreshCw className="w-4 h-4" />
                  Chọn ảnh khác
                </button>

                {geminiRestoredImage && upscaledImage && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCompareMode('original-vs-current')}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                        compareMode === 'original-vs-current'
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : 'bg-white/[0.03] border-white/10 text-white/55 hover:bg-white/[0.06]'
                      }`}
                    >
                      Gốc / Hiện tại
                    </button>
                    <button
                      onClick={() => setCompareMode('gemini-vs-upscaled')}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                        compareMode === 'gemini-vs-upscaled'
                          ? 'bg-teal-500/15 border-teal-500/40 text-teal-300'
                          : 'bg-white/[0.03] border-white/10 text-white/55 hover:bg-white/[0.06]'
                      }`}
                    >
                      Gemini / Upscale
                    </button>
                  </div>
                )}

{restoredImage && (
              <div className="flex items-center gap-3">
                {upscaledImage ? (
                  <>
                    <button onClick={downloadGeminiImage} className="flex items-center gap-2 px-5 py-2.5 bg-white text-black hover:bg-emerald-50 rounded-full text-sm font-bold shadow-lg">
                      <Download className="w-4 h-4" />
                      Gemini ({selectedResolution})
                    </button>
                    <button onClick={downloadUpscaledImage} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 rounded-full text-sm font-bold transition-all">
                      <Download className="w-4 h-4" />
                      Upscale ({upscaleScaleFactor}x)
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={downloadGeminiImage} className="flex items-center gap-2 px-6 py-2.5 bg-white text-black hover:bg-emerald-50 rounded-full text-sm font-bold shadow-lg">
                      <Download className="w-4 h-4" />
                      Tải xuống ({selectedResolution})
                    </button>
                    <button onClick={() => setPopupStep('upscale')} className="flex items-center gap-2 px-5 py-2.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 rounded-full text-sm font-bold transition-all">
                      <Sparkles className="w-4 h-4" />
                      Upscale
                    </button>
                  </>
                )}
              </div>
            )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 z-50 max-w-md backdrop-blur-xl"
          >
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-200/80">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── POPUP 1: ANALYZING ──────────────────────────────────── */}
      <FloatingPopup isOpen={popupStep === 'analyzing'}>
        <div className="p-8 flex flex-col items-center text-center gap-6">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full" />
            <motion.div
              className="absolute inset-0 border-4 border-t-emerald-500 border-r-emerald-500/50 rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            />
            <Eye className="absolute inset-0 m-auto w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold mb-2">Đang phân tích ảnh nhóm…</h3>
            <p className="text-sm text-white/40">AI đang đếm số người và đánh giá mức hư hại</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/30">
            <Camera className="w-3.5 h-3.5" />
            Model: gemini-3.1-flash-lite-preview
          </div>
        </div>
      </FloatingPopup>

      {/* ── POPUP 1B: ANALYSIS RESULT ──────────────────────────── */}
      <FloatingPopup isOpen={popupStep === 'analysis-result'}>
        <div className="p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Phân tích hoàn tất</h3>
              <p className="text-xs text-white/40">Kết quả từ AI</p>
            </div>
          </div>

          {analysis && (
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Loại ảnh</p>
                <p className="text-sm font-medium">{analysis.photo_type.replace(/_/g, ' ')}</p>
              </div>
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Số người</p>
                <p className="text-sm font-medium">{analysis.subject_count} người</p>
              </div>
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Kích thước mặt</p>
                <p className="text-sm font-medium">{analysis.face_sizes}</p>
              </div>
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Mức hư hại</p>
                <p className={`text-sm font-bold px-2 py-0.5 rounded-lg inline-block border ${getSeverityColor(analysis.damage_severity)}`}>
                  {getSeverityLabel(analysis.damage_severity)}
                </p>
              </div>
              {analysis.damage_types.length > 0 && (
                <div className="col-span-2 p-3 bg-white/5 rounded-xl border border-white/5">
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Loại hư hại</p>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.damage_types.map((type) => (
                      <span key={type} className="px-2 py-0.5 bg-white/5 text-white/60 rounded-md text-[10px] border border-white/5">{type}</span>
                    ))}
                  </div>
                </div>
              )}
              {(analysis.is_black_white || analysis.is_sepia) && (
                <div className="col-span-2 p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                  <p className="text-xs text-emerald-400 font-medium">
                    📷 Ảnh {analysis.is_black_white ? 'đen trắng' : 'sepia'} — đã bật Lên màu AI tự động
                  </p>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setPopupStep('model')}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-emerald-600/20"
          >
            Tiếp tục
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </FloatingPopup>

      {/* ── POPUP 2: MODEL ─────────────────────────────────────── */}
      <FloatingPopup isOpen={popupStep === 'model'}>
        <div className="p-6 md:p-8">
          <h3 className="text-lg font-bold mb-1">Chọn Model AI</h3>
          <p className="text-sm text-white/40 mb-6">Khuyến nghị dùng Pro cho ảnh nhóm</p>

          <div className="space-y-3 mb-6">
            <button
              onClick={() => setSelectedModel('gemini-3.1-flash-image-preview')}
              className={`w-full flex items-start gap-4 p-4 rounded-2xl border transition-all text-left ${
                selectedModel === 'gemini-3.1-flash-image-preview'
                  ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/20'
                  : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                selectedModel === 'gemini-3.1-flash-image-preview' ? 'bg-emerald-500/20' : 'bg-white/5'
              }`}>
                <Zap className={`w-5 h-5 ${selectedModel === 'gemini-3.1-flash-image-preview' ? 'text-emerald-400' : 'text-white/30'}`} />
              </div>
              <div>
                <p className="font-bold text-sm">Gemini 3.1 Flash Image</p>
                <p className="text-xs text-white/40 mt-1">Nhanh (~30s) • Phù hợp ảnh nhóm ít hư hại</p>
                {analysis?.recommended_model === 'gemini_flash' && (
                  <span className="inline-block mt-2 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded-md border border-emerald-500/20">✦ AI GỢI Ý</span>
                )}
              </div>
            </button>

            <button
              onClick={() => setSelectedModel('gemini-3-pro-image-preview')}
              className={`w-full flex items-start gap-4 p-4 rounded-2xl border transition-all text-left ${
                selectedModel === 'gemini-3-pro-image-preview'
                  ? 'bg-purple-500/10 border-purple-500/40 ring-1 ring-purple-500/20'
                  : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                selectedModel === 'gemini-3-pro-image-preview' ? 'bg-purple-500/20' : 'bg-white/5'
              }`}>
                <ShieldCheck className={`w-5 h-5 ${selectedModel === 'gemini-3-pro-image-preview' ? 'text-purple-400' : 'text-white/30'}`} />
              </div>
              <div>
                <p className="font-bold text-sm">Gemini 3 Pro Image</p>
                <p className="text-xs text-white/40 mt-1">Chất lượng cao nhất • Tái tạo khuôn mặt nhỏ tốt nhất</p>
                {analysis?.recommended_model === 'gemini_pro' && (
                  <span className="inline-block mt-2 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded-md border border-emerald-500/20">✦ AI GỢI Ý</span>
                )}
              </div>
            </button>
          </div>

          <button
            onClick={() => setPopupStep('resolution')}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-emerald-600/20"
          >
            Tiếp tục
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </FloatingPopup>

      {/* ── POPUP 3: RESOLUTION ────────────────────────────────── */}
      <FloatingPopup isOpen={popupStep === 'resolution'}>
        <div className="p-6 md:p-8">
          <h3 className="text-lg font-bold mb-1">Chất lượng đầu ra</h3>
          <p className="text-sm text-white/40 mb-6">Chọn độ phân giải cho ảnh phục hồi</p>

          <div className="grid grid-cols-3 gap-3 mb-6">
            {([
              { id: '1K' as ResolutionType, label: '1K', desc: '1024px', sub: 'Nhanh • Nhẹ' },
              { id: '2K' as ResolutionType, label: '2K', desc: '2048px', sub: 'Cân bằng' },
              { id: '4K' as ResolutionType, label: '4K', desc: '4096px', sub: 'Tốt nhất' },
            ]).map((res) => (
              <button
                key={res.id}
                onClick={() => setSelectedResolution(res.id)}
                className={`p-4 rounded-2xl border flex flex-col items-center gap-1 transition-all ${
                  selectedResolution === res.id
                    ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/20'
                    : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
                }`}
              >
                <span className={`text-2xl font-black ${selectedResolution === res.id ? 'text-emerald-400' : 'text-white/60'}`}>
                  {res.label}
                </span>
                <span className="text-[10px] text-white/30">{res.desc}</span>
                <span className="text-[9px] text-white/20 mt-1">{res.sub}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => setPopupStep('options')}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-emerald-600/20"
          >
            Tiếp tục
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </FloatingPopup>

      {/* ── POPUP 4: OPTIONS ───────────────────────────────────── */}
      <FloatingPopup isOpen={popupStep === 'options'}>
        <div className="p-6 md:p-8">
          <h3 className="text-lg font-bold mb-1">Tùy chọn nâng cao</h3>
          <p className="text-sm text-white/40 mb-6">Bạn có thể bỏ qua nếu không cần</p>

          <div className="space-y-4 mb-6">
            <button
              onClick={() => setColorize(!colorize)}
              className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                colorize ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Palette className={`w-5 h-5 ${colorize ? 'text-emerald-400' : 'text-white/30'}`} />
                <div className="text-left">
                  <p className="text-sm font-bold">Lên màu AI</p>
                  <p className="text-[10px] text-white/40">Tô màu tự nhiên cho ảnh đen trắng</p>
                </div>
              </div>
              <div className={`w-10 h-5 rounded-full relative transition-colors ${colorize ? 'bg-emerald-500' : 'bg-white/10'}`}>
                <motion.div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full" animate={{ x: colorize ? 20 : 0 }} />
              </div>
            </button>

            <button
              onClick={() => { setReplaceClothing(!replaceClothing); }}
              className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                replaceClothing ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Shirt className={`w-5 h-5 ${replaceClothing ? 'text-emerald-400' : 'text-white/30'}`} />
                <div className="text-left">
                  <p className="text-sm font-bold">Thay trang phục</p>
                  <p className="text-[10px] text-white/40">Thay đổi quần áo trong ảnh</p>
                </div>
              </div>
              <div className={`w-10 h-5 rounded-full relative transition-colors ${replaceClothing ? 'bg-emerald-500' : 'bg-white/10'}`}>
                <motion.div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full" animate={{ x: replaceClothing ? 20 : 0 }} />
              </div>
            </button>

            <AnimatePresence>
              {replaceClothing && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="pl-4 border-l-2 border-emerald-500/20 space-y-2">
                    {[...Object.keys(CLOTHING_PRESETS), "Tùy chỉnh"].map((opt) => (
                      <button key={opt} onClick={() => setClothingOption(opt)}
                        className={`w-full py-2 px-3 rounded-xl border text-xs font-medium text-left transition-all ${
                          clothingOption === opt ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-white/[0.03] border-white/5 text-white/50 hover:bg-white/[0.06]'
                        }`}
                      >{opt}</button>
                    ))}
                    {clothingOption === 'Tùy chỉnh' && (
                      <input type="text" value={clothingText} onChange={(e) => setClothingText(e.target.value)}
                        placeholder="Ví dụ: Áo vest đen, Áo dài xanh..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50"
                      />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={startRestore}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-emerald-600/20"
          >
            <Sparkles className="w-4 h-4" />
            Bắt đầu phục hồi
          </button>
        </div>
      </FloatingPopup>

      <FloatingPopup isOpen={popupStep === 'upscale'}>
        <div className="p-6 md:p-8">
          <h3 className="text-lg font-bold mb-1">Upscale ảnh (tùy chọn)</h3>
          <p className="text-sm text-white/40 mb-6">Dùng Crystal Upscaler sau khi Gemini phục hồi xong</p>

          <div className="space-y-5 mb-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">Scale factor</p>
                <span className="text-xs text-emerald-300">{upscaleScaleFactor}x</span>
              </div>
              <input
                type="range"
                min={2}
                max={4}
                step={1}
                value={upscaleScaleFactor}
                onChange={(e) => setUpscaleScaleFactor(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
              <p className="text-[10px] text-white/35 mt-1">2x nhanh hơn, 4x chi tiết cao hơn nhưng lâu hơn</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">Creativity</p>
                <span className="text-xs text-teal-300">{upscaleCreativity.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={upscaleCreativity}
                onChange={(e) => setUpscaleCreativity(Number(e.target.value))}
                className="w-full accent-teal-500"
              />
              <p className="text-[10px] text-white/35 mt-1">Giá trị thấp giữ tự nhiên, giá trị cao thêm chi tiết mạnh hơn</p>
            </div>
          </div>

          <div className="mb-6 p-4 rounded-2xl border border-white/10 bg-white/[0.03]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-white/70">Trạng thái upscale</p>
              <p className="text-xs text-emerald-300 font-semibold">{Math.round(upscaleProgress)}%</p>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500"
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(0, Math.min(100, upscaleProgress))}%` }}
              />
            </div>
            <p className="text-[11px] text-white/55 mt-2">{upscaleStatusText}</p>
            {upscalePredictionId && (
              <p className="text-[10px] text-white/30 mt-1">Prediction ID: {upscalePredictionId}</p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setPopupStep('none')}
              className="flex-1 py-3 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-sm font-bold text-white/80 transition-all"
              disabled={isUpscaling}
            >
              Bỏ qua
            </button>
            <button
              onClick={startUpscale}
              disabled={isUpscaling}
              className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-sm font-bold text-white transition-all disabled:opacity-60"
            >
              {isUpscaling ? 'Đang upscale...' : 'Upscale với Crystal'}
            </button>
          </div>
        </div>
      </FloatingPopup>
    </div>
  );
}
