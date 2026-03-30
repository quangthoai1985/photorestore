import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  Sparkles, 
  Download, 
  RefreshCw, 
  AlertCircle,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Wand2,
  ArrowLeft,
  Settings2,
  Key,
  ShieldCheck,
  Zap,
  Smile,
  RotateCw,
  User,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageSlider } from '../components/ImageSlider';
import { Link } from 'react-router-dom';
import { GoogleGenAI } from "@google/genai";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

interface ProcessingStatus {
  step: string;
  progress: number;
}

interface RetouchOptions {
  smoothSkin: boolean;
  removeBlemish: boolean;
  reduceWrinkles: boolean;
  brightenEyes: boolean;
  removeDarkCircles: boolean;
  whitenTeeth: boolean;
  naturalLipstick: boolean;
  softBlush: boolean;
  studioLighting: boolean;
  smileLevel: number;
  headRotation: number;
  mouthState: string;
  eyeGaze: string;
  ageProgression: number;
}

type ModelType = 'gemini-3-pro-image-preview' | 'gemini-3.1-flash-image-preview';
type ResolutionType = '1K' | '2K' | '4K';

const AccordionSection = ({ title, isOpen, onToggle, children }: { title: string, isOpen: boolean, onToggle: () => void, children: React.ReactNode }) => (
  <div className="border border-white/10 rounded-xl overflow-hidden bg-white/5">
    <button 
      onClick={onToggle}
      className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
    >
      <span className="text-xs font-bold tracking-wider uppercase text-white/80">{title}</span>
      {isOpen ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
    </button>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
        >
          <div className="p-4 pt-0 space-y-3 border-t border-white/10">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

const Switch = ({ label, checked, onChange }: { label: string, checked: boolean, onChange: (checked: boolean) => void }) => (
  <div className="flex items-center justify-between">
    <span className="text-sm text-white/70">{label}</span>
    <button 
      onClick={() => onChange(!checked)}
      className={`w-10 h-5 rounded-full relative transition-colors ${checked ? 'bg-pink-500' : 'bg-white/10'}`}
    >
      <motion.div 
        className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm"
        animate={{ x: checked ? 20 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  </div>
);

const SliderControl = ({ label, value, min, max, onChange }: { label: string, value: number, min: number, max: number, onChange: (val: number) => void }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <span className="text-sm text-white/70">{label}</span>
      <span className="text-xs font-mono text-pink-400">{value > 0 ? `+${value}` : value}</span>
    </div>
    <input 
      type="range" 
      min={min} 
      max={max} 
      value={value} 
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-pink-500"
    />
  </div>
);

const SelectControl = ({ label, value, options, onChange }: { label: string, value: string, options: {label: string, value: string}[], onChange: (val: string) => void }) => (
  <div className="space-y-2">
    <span className="text-sm text-white/70 block">{label}</span>
    <div className="relative">
      <select 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:border-pink-500/50 transition-colors"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value} className="bg-gray-900 text-white">{opt.label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
    </div>
  </div>
);

import { useHybridPipeline, PipelineOptions } from '../hooks/useHybridPipeline';

export default function ProRetouch() {
  const { runPipeline, isProcessing, status, setStatus, error, setError } = useHybridPipeline();
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [restoredImage, setRestoredImage] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelType>('gemini-3-pro-image-preview');
  const [selectedResolution, setSelectedResolution] = useState<ResolutionType>('1K');

  const [options, setOptions] = useState<RetouchOptions>({
    smoothSkin: false,
    removeBlemish: false,
    reduceWrinkles: false,
    brightenEyes: false,
    removeDarkCircles: false,
    whitenTeeth: false,
    naturalLipstick: false,
    softBlush: false,
    studioLighting: false,
    smileLevel: 0,
    headRotation: 0,
    mouthState: 'keep',
    eyeGaze: 'keep',
    ageProgression: 0,
  });

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    skin: true,
    eyes: false,
    makeup: false,
    lighting: false,
    manipulation: false
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const updateOption = (key: keyof RetouchOptions, value: boolean | number | string) => {
    setOptions(prev => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
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

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError("Dung lượng ảnh tối đa là 10MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setOriginalImage(event.target?.result as string);
        setRestoredImage(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setOriginalImage(event.target?.result as string);
        setRestoredImage(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async () => {
    if (!originalImage) return;

    const instructions = [];
    if (options.smoothSkin) instructions.push("- Smooth skin texture while preserving natural pores.");
    if (options.removeBlemish) instructions.push("- Remove acne and blemishes.");
    if (options.reduceWrinkles) instructions.push("- Soften deep wrinkles.");
    if (options.brightenEyes) instructions.push("- Brighten and sharpen eyes.");
    if (options.removeDarkCircles) instructions.push("- Remove dark circles under eyes.");
    if (options.whitenTeeth) instructions.push("- Whiten teeth naturally.");
    if (options.naturalLipstick) instructions.push("- Apply natural lip tint.");
    if (options.softBlush) instructions.push("- Add soft blush to cheeks.");
    if (options.studioLighting) instructions.push("- Apply professional studio lighting.");

    const manipulation = [];
    if (options.smileLevel > 20) manipulation.push(`- Add a smile (level: ${options.smileLevel}/100).`);
    if (Math.abs(options.headRotation) > 10) manipulation.push(`- Rotate head slightly (${options.headRotation > 0 ? 'right' : 'left'}).`);
    if (options.mouthState !== 'keep') manipulation.push(`- Mouth state: ${options.mouthState}.`);
    if (options.eyeGaze === 'direct') manipulation.push("- Eyes looking directly at camera.");
    if (Math.abs(options.ageProgression) > 10) manipulation.push(`- Age adjustment: ${options.ageProgression > 0 ? 'older' : 'younger'}.`);

    const pipelineOptions: PipelineOptions = {
      selectedModel,
      selectedResolution,
      colorization: false,
      faceEnhancement: true,
      maxFaces: 'all',
      detectionSensitivity: 50,
      blendingSmoothness: 40,
      prompts: {
        analysis: `Analyze this portrait for beauty retouching. Identify skin imperfections, eye clarity, and facial expression.`,
        enhancement: `Instruction: You are a master of photo restoration and inpainting. Your primary mission for this base image is to HEAL all physical damages:
1. HEAL & CLEAN:
- Identify and completely REMOVE all white scratches, tears, and dust spots. 
- Fill in (Inpaint) the missing data in damaged areas by blending with the surrounding textures.
- Clean the background and clothing. Remove all aging stains and color splotches while maintaining the natural depth of the scene.
${options.studioLighting ? '- Apply high-end studio lighting (Rembrandt style).' : '- Clean up background and optimize exposure.'}

2. EDGE RESTORATION:
- Pay special attention to the edges of the photo. If there are black bars, scanning artifacts, or messy crop lines at the top/bottom/sides, you must RECONSTRUCT those edges. Extend the background naturally to fill the entire frame cleanly. No messy borders allowed.

3. LIGHTING BALANCE:
- Uniformly balance the lighting. Ensure the background light doesn't look hazy or washed out compared to the restored subjects.

The result must be a clean, vibrant base image for face stitching.`,
        face: `High-end beauty retoucher. Retouch this face with these specific goals:
          ${instructions.join('\n')}
          ${manipulation.join('\n')}
          CRITICAL: Strictly preserve the original identity and bone structure. Do not morph the person.`
      }
    };

    try {
      const result = await runPipeline(originalImage, pipelineOptions);
      setRestoredImage(result);
    } catch (err) {
      // Error handled by hook
    }
  };

  const downloadImage = () => {
    if (!restoredImage) return;
    const link = document.createElement('a');
    link.href = restoredImage;
    link.download = `QUANGTHOAI_RETOUCH_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadComparison = async () => {
    if (originalImage && restoredImage) {
      try {
        setStatus({ step: 'Đang tạo ảnh so sánh...', progress: 90 });
        
        const response = await fetch('/api/generate-comparison', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            originalImage,
            restoredImage
          })
        });

        if (!response.ok) {
          throw new Error('Failed to generate comparison image');
        }

        const data = await response.json();
        
        const link = document.createElement('a');
        link.href = data.comparisonImage;
        link.download = `QUANGTHOAI_RETOUCH_COMPARISON_${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setStatus({ step: 'Hoàn tất!', progress: 100 });
      } catch (err) {
        console.error('Failed to generate comparison:', err);
        setError('Không thể tạo ảnh so sánh. Vui lòng thử lại.');
      } finally {
        setTimeout(() => setStatus({ step: '', progress: 0 }), 2000);
      }
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-[#050505] text-white font-sans selection:bg-pink-500/30">
      {/* Left: Main Workspace */}
      <main className="flex-1 w-full h-full bg-gray-950 relative overflow-hidden flex items-center justify-center border-b md:border-b-0 md:border-r border-white/10">
        {/* Logo Overlay */}
        <div className="absolute top-4 left-4 md:top-6 md:left-6 z-20 flex items-center gap-3">
          <Link to="/" className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors pointer-events-auto">
            <ArrowLeft className="w-4 h-4 text-white" />
          </Link>
          <div className="flex items-center gap-3 pointer-events-none">
            <div className="w-6 h-6 md:w-8 md:h-8 bg-gradient-to-br from-pink-500 to-rose-600 rounded-lg flex items-center justify-center shadow-lg shadow-pink-500/20">
              <Wand2 className="w-3 h-3 md:w-4 md:h-4 text-white" />
            </div>
            <span className="text-sm md:text-base font-black tracking-widest uppercase">Pro Retouch</span>
          </div>
        </div>

        {/* API Key Status */}
        <div className="absolute top-4 right-4 md:top-6 md:right-6 z-20">
          <button 
            onClick={handleSelectKey}
            className={`flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-[10px] md:text-xs font-bold transition-all border ${
              hasApiKey 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse'
            }`}
          >
            {hasApiKey ? (
              <>
                <ShieldCheck className="w-3 h-3 md:w-4 md:h-4" />
                API Key Active
              </>
            ) : (
              <>
                <Key className="w-3 h-3 md:w-4 md:h-4" />
                Select API Key
              </>
            )}
          </button>
        </div>

        {!hasApiKey ? (
          <div className="w-full max-w-md p-8 border border-amber-500/20 rounded-3xl bg-amber-500/5 flex flex-col items-center justify-center text-center z-10">
            <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-6">
              <Key className="w-8 h-8 text-amber-400" />
            </div>
            <h3 className="text-xl font-bold mb-2 text-amber-400">Yêu cầu API Key</h3>
            <p className="text-sm text-white/60 mb-6">
              Vui lòng chọn API Key của bạn để bắt đầu sử dụng tính năng Pro Retouch. 
              Bạn cần một API Key từ Google AI Studio (Paid Project) để sử dụng model Gemini 3 Pro.
            </p>
            <button 
              onClick={handleSelectKey}
              className="px-8 py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-full font-bold transition-all shadow-lg shadow-amber-500/20"
            >
              Chọn API Key ngay
            </button>
            <a 
              href="https://ai.google.dev/gemini-api/docs/billing" 
              target="_blank" 
              rel="noopener noreferrer"
              className="mt-4 text-xs text-white/40 hover:text-white/60 underline"
            >
              Tìm hiểu về Billing & API Key
            </a>
          </div>
        ) : !originalImage ? (
          <div 
            className="w-full max-w-md p-8 border-2 border-dashed border-white/10 rounded-3xl bg-white/[0.02] flex flex-col items-center justify-center text-center hover:bg-white/[0.04] hover:border-pink-500/30 transition-all cursor-pointer group"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <div className="w-16 h-16 bg-pink-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-pink-500/20 transition-all">
              <Upload className="w-8 h-8 text-pink-400" />
            </div>
            <h3 className="text-xl font-bold mb-2">Tải ảnh chân dung lên</h3>
            <p className="text-sm text-white/40 mb-6">Kéo thả hoặc click để chọn ảnh (Max 10MB)</p>
            <input 
              id="file-upload" 
              type="file" 
              accept="image/jpeg, image/png, image/webp" 
              className="hidden" 
              onChange={onFileChange} 
            />
            <div className="px-6 py-2.5 bg-white/5 border border-white/10 rounded-full text-sm font-medium group-hover:bg-white/10 transition-colors">
              Chọn File
            </div>
          </div>
        ) : (
          <div className="flex-1 w-full h-full relative overflow-hidden">
            <TransformWrapper
              initialScale={1}
              minScale={0.5}
              maxScale={8}
              centerOnInit={true}
              wheel={{ step: 0.1 }}
              panning={{ excluded: ["no-pan"] }}
            >
              <TransformComponent 
                wrapperStyle={{ width: "100%", height: "100%" }} 
                contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <div className="relative w-full h-full flex items-center justify-center p-4 md:p-12">
                  {restoredImage ? (
                    <div className="relative w-full max-w-4xl aspect-[4/3] md:aspect-auto md:h-[70vh] rounded-2xl overflow-hidden bg-black/50 border border-white/10 shadow-2xl">
                      <ImageSlider before={originalImage} after={restoredImage} />
                    </div>
                  ) : (
                    <div className="relative w-full max-w-4xl aspect-[4/3] md:aspect-auto md:h-[70vh] rounded-2xl overflow-hidden bg-black/50 border border-white/10 shadow-2xl">
                      <img 
                        src={originalImage} 
                        alt="Original" 
                        className="w-full h-full object-contain cursor-grab active:cursor-grabbing" 
                      />
                    </div>
                  )}
                </div>
              </TransformComponent>
            </TransformWrapper>

            {/* Action Bar */}
            <div className="absolute bottom-6 md:bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-4 z-20">
              <button 
                onClick={() => { setOriginalImage(null); setRestoredImage(null); }}
                className="px-4 py-2 md:px-6 md:py-2.5 bg-black/50 backdrop-blur-md border border-white/10 text-white rounded-full text-[10px] md:text-sm font-bold hover:bg-white/10 transition-all"
              >
                Đổi ảnh khác
              </button>

              {isProcessing ? (
                <div className="flex items-center gap-3 px-6 py-2.5 bg-pink-600 text-white rounded-full text-sm font-bold shadow-lg shadow-pink-500/20">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  {status.step} {status.progress}%
                </div>
              ) : !restoredImage ? (
                <button 
                  onClick={processImage}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white rounded-full text-sm font-bold transition-all shadow-lg shadow-pink-500/25 hover:shadow-pink-500/40 hover:scale-105"
                >
                  <Sparkles className="w-4 h-4" />
                  Bắt đầu Retouch
                </button>
              ) : (
                <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4">
                  <button 
                    onClick={downloadImage}
                    className="flex items-center gap-2 px-4 py-2 md:px-6 md:py-2.5 bg-white text-black hover:bg-pink-50 border border-white/10 rounded-full text-[10px] md:text-sm font-bold transition-all"
                  >
                    <Download className="w-3 h-3 md:w-4 md:h-4" />
                    Tải xuống
                  </button>
                  
                  <button 
                    onClick={downloadComparison}
                    className="flex items-center gap-2 px-4 py-2 md:px-6 md:py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-full text-[10px] md:text-sm font-bold transition-all"
                  >
                    <RefreshCw className="w-3 h-3 md:w-4 md:h-4" />
                    Tải ảnh so sánh
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Right: Sidebar Settings */}
      <aside className="w-full md:w-[400px] h-[55vh] md:h-full bg-[#0a0a0a] border-l border-white/5 flex flex-col z-30">
        <div className="p-6 border-b border-white/5 bg-white/[0.02]">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-pink-400" />
            Công cụ Retouch
          </h2>
          <p className="text-xs text-white/40 mt-1">Tùy chỉnh các thông số làm đẹp</p>
        </div>

        <div className="p-6 border-b border-white/5 bg-white/[0.01] space-y-4">
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Model xử lý (AI Model)</label>
            <div className="grid grid-cols-1 gap-2">
              <button 
                onClick={() => setSelectedModel('gemini-3-pro-image-preview')}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all text-left ${
                  selectedModel === 'gemini-3-pro-image-preview' 
                  ? 'bg-pink-500/10 border-pink-500/50' 
                  : 'bg-white/5 border-transparent hover:bg-white/10'
                }`}
              >
                <ShieldCheck className={`w-4 h-4 mt-0.5 ${selectedModel === 'gemini-3-pro-image-preview' ? 'text-pink-400' : 'text-white/20'}`} />
                <div>
                  <p className="font-bold text-xs text-white">Gemini 3 Pro</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Chất lượng cao nhất, tái tạo khuôn mặt.</p>
                </div>
              </button>
              <button 
                onClick={() => setSelectedModel('gemini-3.1-flash-image-preview')}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all text-left ${
                  selectedModel === 'gemini-3.1-flash-image-preview' 
                  ? 'bg-pink-500/10 border-pink-500/50' 
                  : 'bg-white/5 border-transparent hover:bg-white/10'
                }`}
              >
                <Zap className={`w-4 h-4 mt-0.5 ${selectedModel === 'gemini-3.1-flash-image-preview' ? 'text-pink-400' : 'text-white/20'}`} />
                <div>
                  <p className="font-bold text-xs text-white">Gemini 3.1 Flash</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Tốc độ nhanh, phục hồi cơ bản.</p>
                </div>
              </button>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Độ phân giải xuất ảnh</label>
            <div className="flex p-1 bg-white/5 rounded-xl border border-white/10">
              {(['1K', '2K', '4K'] as ResolutionType[]).map((res) => (
                <button
                  key={res}
                  onClick={() => setSelectedResolution(res)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    selectedResolution === res
                      ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/20'
                      : 'text-white/40 hover:text-white/60 hover:bg-white/5'
                  }`}
                >
                  {res}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-white/30 italic">
              Lưu ý: Độ phân giải 4K có thể mất nhiều thời gian xử lý hơn.
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400 mb-6">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm leading-relaxed">{error}</p>
            </div>
          )}

          <AccordionSection 
            title="LÀM ĐẸP DA" 
            isOpen={openSections.skin} 
            onToggle={() => toggleSection('skin')}
          >
            <Switch label="Làm mịn da (Smooth Skin)" checked={options.smoothSkin} onChange={(v) => updateOption('smoothSkin', v)} />
            <Switch label="Xóa mụn/vết thâm (Remove Blemish)" checked={options.removeBlemish} onChange={(v) => updateOption('removeBlemish', v)} />
            <Switch label="Giảm nếp nhăn (Reduce Wrinkles)" checked={options.reduceWrinkles} onChange={(v) => updateOption('reduceWrinkles', v)} />
          </AccordionSection>

          <AccordionSection 
            title="ĐÔI MẮT & NỤ CƯỜI" 
            isOpen={openSections.eyes} 
            onToggle={() => toggleSection('eyes')}
          >
            <Switch label="Làm sáng mắt (Brighten Eyes)" checked={options.brightenEyes} onChange={(v) => updateOption('brightenEyes', v)} />
            <Switch label="Xóa quầng thâm (Remove Dark Circles)" checked={options.removeDarkCircles} onChange={(v) => updateOption('removeDarkCircles', v)} />
            <Switch label="Làm trắng răng (Whiten Teeth)" checked={options.whitenTeeth} onChange={(v) => updateOption('whitenTeeth', v)} />
          </AccordionSection>

          <AccordionSection 
            title="TRANG ĐIỂM AI" 
            isOpen={openSections.makeup} 
            onToggle={() => toggleSection('makeup')}
          >
            <Switch label="Son môi tự nhiên (Natural Lipstick)" checked={options.naturalLipstick} onChange={(v) => updateOption('naturalLipstick', v)} />
            <Switch label="Má hồng nhẹ (Soft Blush)" checked={options.softBlush} onChange={(v) => updateOption('softBlush', v)} />
          </AccordionSection>

          <AccordionSection 
            title="ÁNH SÁNG" 
            isOpen={openSections.lighting} 
            onToggle={() => toggleSection('lighting')}
          >
            <Switch label="Ánh sáng Studio (Studio Lighting)" checked={options.studioLighting} onChange={(v) => updateOption('studioLighting', v)} />
          </AccordionSection>

          <AccordionSection 
            title="🎭 Thao tác Khuôn mặt (AI Manipulation)" 
            isOpen={openSections.manipulation} 
            onToggle={() => toggleSection('manipulation')}
          >
            <SliderControl label="Mức độ Cười (Smile Level)" value={options.smileLevel} min={0} max={100} onChange={(v) => updateOption('smileLevel', v)} />
            <SliderControl label="Xoay mặt (Head Rotation)" value={options.headRotation} min={-50} max={50} onChange={(v) => updateOption('headRotation', v)} />
            <SelectControl 
              label="Trạng thái Miệng (Mouth State)" 
              value={options.mouthState} 
              onChange={(v) => updateOption('mouthState', v)}
              options={[
                { label: 'Giữ nguyên', value: 'keep' },
                { label: 'Mở miệng nhẹ', value: 'open' },
                { label: 'Khép chặt môi', value: 'closed' }
              ]} 
            />
            <SelectControl 
              label="Hướng ánh mắt (Eye Gaze)" 
              value={options.eyeGaze} 
              onChange={(v) => updateOption('eyeGaze', v)}
              options={[
                { label: 'Giữ nguyên', value: 'keep' },
                { label: 'Nhìn thẳng ống kính', value: 'direct' }
              ]} 
            />
            <SliderControl label="Trẻ hóa / Lão hóa (Age Progression)" value={options.ageProgression} min={-50} max={50} onChange={(v) => updateOption('ageProgression', v)} />
          </AccordionSection>
        </div>
      </aside>
    </div>
  );
}
