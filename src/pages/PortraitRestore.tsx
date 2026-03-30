import React, { useState, useCallback, useEffect } from 'react';
import { 
  Upload, 
  Image as ImageIcon, 
  Sparkles, 
  Download, 
  RefreshCw, 
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Settings2,
  Zap,
  ShieldCheck,
  Key,
  ChevronDown,
  ChevronUp,
  User,
  Palette,
  Shirt,
  ArrowLeft
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';
import { ImageSlider } from '../components/ImageSlider';
import { Link } from 'react-router-dom';

type ModelType = 'gemini-3-pro-image-preview' | 'gemini-3.1-flash-image-preview';
type ResolutionType = '1K' | '2K' | '4K';
type BackgroundType = 'original' | 'blue' | 'white' | 'gradient';
type AspectRatioType = 'original' | '1:1' | '3:4' | '4:3' | '16:9' | '9:16' | '2:3' | '3:2' | '5:7' | '7:5';

interface ProcessingStatus {
  step: string;
  progress: number;
}

import { useHybridPipeline, PipelineOptions } from '../hooks/useHybridPipeline';

export default function PortraitRestore() {
  const { runPipeline, isProcessing, status, setStatus, error, setError } = useHybridPipeline();
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [restoredImage, setRestoredImage] = useState<string | null>(null);
  
  const [selectedModel, setSelectedModel] = useState<ModelType>('gemini-3-pro-image-preview');
  const [selectedResolution, setSelectedResolution] = useState<ResolutionType>('1K');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatioType>('original');
  const [colorMode, setColorMode] = useState<'original' | 'colorize'>('original');
  const [hasApiKey, setHasApiKey] = useState(false);

  // --- Advanced Options State ---
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [backgroundType, setBackgroundType] = useState<BackgroundType>('original');
  const [clothingOption, setClothingOption] = useState<string>('Vest Nam (Truyền thống)');
  const [clothingText, setClothingText] = useState('');
  const [replaceClothing, setReplaceClothing] = useState(false);
  const [enhanceClothing, setEnhanceClothing] = useState(false);

  // --- API Key Check ---
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

  // --- Handlers ---
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

  const restorePhoto = async () => {
    if (!originalImage) return;

    const clothingMapping: Record<string, string> = {
      "Vest Nam (Truyền thống)": "A professional black business suit, crisp white button-down dress shirt, and a neatly tied classic silk necktie.",
      "Vest Nam (Lịch lãm)": "A professional navy blue business suit, crisp white button-down dress shirt, worn without a necktie.",
      "Áo dài (Nữ)": "Traditional Vietnamese Ao Dai with a high standing collar, elegant silk fabric.",
      "Sơ mi trắng": "A clean, crisp white button-down dress shirt with a classic pointed collar.",
      "Áo thun polo": "A modern well-fitted polo shirt with a neat collar.",
      "Tùy chỉnh": clothingText || "formal attire"
    };

    const selectedClothingPrompt = replaceClothing 
      ? (clothingOption === "Tùy chỉnh" ? clothingText : clothingMapping[clothingOption])
      : "";

    let backgroundInstruction = "";
    switch (backgroundType) {
      case 'blue': backgroundInstruction = "Replace background with solid ID photo blue."; break;
      case 'white': backgroundInstruction = "Replace background with solid pure white."; break;
      case 'gradient': backgroundInstruction = "Replace background with a soft white-to-blue radial gradient."; break;
      default: backgroundInstruction = "Preserve and clean up the original background."; break;
    }

    const options: PipelineOptions = {
      selectedModel,
      selectedResolution,
      colorization: colorMode === 'colorize',
      faceEnhancement: true,
      maxFaces: '1',
      detectionSensitivity: 50,
      blendingSmoothness: 40,
      prompts: {
        analysis: `Analyze this portrait. Describe facial features, age, gender, lighting, and current clothing in detail.`,
        enhancement: `Instruction: You are a master of photo restoration and inpainting. Your primary mission for this base image is to HEAL all physical damages:
1. HEAL & CLEAN:
- Identify and completely REMOVE all white scratches, tears, and dust spots. 
- Fill in (Inpaint) the missing data in damaged areas by blending with the surrounding textures.
- Clean the background and clothing. Remove all aging stains and color splotches while maintaining the natural depth of the scene.
${colorMode === 'colorize' ? '- Colorize the image naturally with realistic skin tones and clothing colors.' : '- Keep the original tones but clean them up.'}
${backgroundInstruction}
${replaceClothing ? `Change clothing to: ${selectedClothingPrompt}.` : 'Preserve original clothing.'}
${enhanceClothing ? 'Sharpen fabric textures and details.' : ''}

2. EDGE RESTORATION:
- Pay special attention to the edges of the photo. If there are black bars, scanning artifacts, or messy crop lines at the top/bottom/sides, you must RECONSTRUCT those edges. Extend the background naturally to fill the entire frame cleanly. No messy borders allowed.

3. LIGHTING BALANCE:
- Uniformly balance the lighting. Ensure the background light doesn't look hazy or washed out compared to the restored subjects.

The result must be a clean, vibrant base image for face stitching.`,
        face: `Enhance this face. Sharpen eyes, skin, and hair while strictly preserving the person's original identity and expression. Output high-definition face.`
      }
    };

    try {
      const result = await runPipeline(originalImage, options);
      setRestoredImage(result);
    } catch (err) {
      // Error is handled by hook
    }
  };

  const downloadImage = () => {
    if (!restoredImage) return;
    const link = document.createElement('a');
    link.href = restoredImage;
    link.download = `QUANGTHOAI_RESTORE_${selectedResolution}_${Date.now()}.png`;
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
        link.download = `QUANGTHOAI_COMPARISON_${Date.now()}.jpg`;
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
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-[#050505] text-white font-sans selection:bg-blue-500/30">
      {/* Left: Main Workspace */}
      <main className="w-full h-[45vh] md:h-full md:flex-1 relative bg-gray-950 flex flex-col items-center justify-center overflow-hidden border-b md:border-b-0 md:border-r border-white/10">
        {/* Logo Overlay */}
        <div className="absolute top-4 left-4 md:top-6 md:left-6 z-20 flex items-center gap-3">
          <Link to="/" className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors pointer-events-auto">
            <ArrowLeft className="w-4 h-4 text-white" />
          </Link>
          <div className="flex items-center gap-3 pointer-events-none">
            <div className="w-6 h-6 md:w-8 md:h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm md:text-lg font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                QUANGTHOAI RESTORE
              </h1>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {!originalImage ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="group relative w-full max-w-lg aspect-video bg-white/[0.02] border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-4 md:gap-6 hover:border-blue-500/50 hover:bg-blue-500/[0.02] transition-all duration-500 mx-4"
            >
              <div className="w-12 h-12 md:w-20 md:h-20 bg-white/5 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                <Upload className="w-5 h-5 md:w-8 md:h-8 text-white/40 group-hover:text-blue-400 transition-colors" />
              </div>
              <div className="text-center px-4">
                <p className="text-sm md:text-lg font-medium text-white/80">Kéo thả ảnh vào đây</p>
                <p className="text-[10px] md:text-sm text-white/40 mt-1">JPG, PNG, WEBP (Tối đa 10MB)</p>
              </div>
              <label className="px-6 py-2 md:px-8 md:py-3 bg-white text-black rounded-full text-xs md:text-sm font-semibold cursor-pointer hover:bg-blue-50 transition-colors">
                Chọn từ máy tính
                <input type="file" className="hidden" accept="image/*" onChange={onFileChange} />
              </label>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full h-full p-4 md:p-12 flex flex-col items-center justify-center gap-4 md:gap-6"
            >
              <div className="relative flex-1 w-full flex items-center justify-center overflow-hidden rounded-xl md:rounded-2xl border border-white/10 bg-black/40">
                {restoredImage ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageSlider before={originalImage} after={restoredImage} />
                  </div>
                ) : (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <img 
                      src={originalImage} 
                      alt="Original Preview" 
                      className="max-w-full max-h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                    {isProcessing && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4 md:gap-6 z-10">
                        <div className="relative w-16 h-16 md:w-24 md:h-24">
                          <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full" />
                          <motion.div 
                            className="absolute inset-0 border-4 border-t-blue-500 rounded-full"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-blue-400" />
                          </div>
                        </div>
                        <div className="text-center space-y-1 md:space-y-2 px-6 md:px-8">
                          <p className="text-sm md:text-xl font-bold text-white tracking-wide">{status.step}</p>
                          <div className="w-full max-w-[150px] md:max-w-xs mx-auto h-1 md:h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <motion.div 
                              className="h-full bg-blue-500"
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

              <div className="flex items-center gap-4 md:gap-6">
                <button 
                  onClick={() => { setOriginalImage(null); setRestoredImage(null); }}
                  className="flex items-center gap-2 text-[10px] md:text-sm text-white/40 hover:text-white transition-colors"
                >
                  <RefreshCw className="w-3 h-3 md:w-4 md:h-4" />
                  Chọn ảnh khác
                </button>

                {restoredImage && (
                  <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4">
                    <button 
                      onClick={downloadImage}
                      className="flex items-center gap-2 px-4 py-2 md:px-6 md:py-2.5 bg-white text-black hover:bg-blue-50 border border-white/10 rounded-full text-[10px] md:text-sm font-bold transition-all"
                    >
                      <Download className="w-3 h-3 md:w-4 md:h-4" />
                      Tải xuống ({selectedResolution})
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
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 p-3 md:p-4 bg-red-500/10 border border-red-500/20 rounded-xl md:rounded-2xl flex items-start gap-2 md:gap-3 z-30 w-[90%] md:max-w-md"
          >
            <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-[10px] md:text-sm text-red-200/80">{error}</p>
          </motion.div>
        )}
      </main>

      {/* Right: Settings Sidebar */}
      <aside className="w-full h-[55vh] md:h-full md:w-[400px] lg:w-[450px] bg-[#0a0a0a] flex flex-col relative z-30 shadow-2xl">
        {/* Sidebar Header */}
        <div className="p-4 md:p-6 border-b border-white/5 flex items-center justify-between bg-[#0a0a0a] z-20">
          <div className="flex items-center gap-3">
            <Settings2 className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
            <h2 className="font-bold text-sm md:text-lg">Cấu hình AI</h2>
          </div>
          <button 
            onClick={handleSelectKey}
            className={`p-1.5 md:p-2 rounded-lg border transition-all flex items-center gap-2 ${
              hasApiKey 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20' 
              : 'bg-amber-500/10 border-amber-500/20 text-amber-500 hover:bg-amber-500/20'
            }`}
            title={hasApiKey ? "Thay đổi API Key (Đã kết nối)" : "Cấu hình API Key (Chưa kết nối)"}
          >
            <Key className="w-3 h-3 md:w-4 md:h-4" />
            <span className="text-[10px] font-bold uppercase hidden sm:inline">
              {hasApiKey ? 'Đã kết nối' : 'Kết nối API'}
            </span>
          </button>
        </div>

        {/* Sidebar Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 md:space-y-8 custom-scrollbar pb-32 md:pb-40">
          {/* Model Selection */}
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">AI Model</label>
            <div className="grid gap-2">
              <button 
                onClick={() => setSelectedModel('gemini-3-pro-image-preview')}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all text-left ${
                  selectedModel === 'gemini-3-pro-image-preview' 
                  ? 'bg-blue-500/10 border-blue-500/50' 
                  : 'bg-white/5 border-transparent hover:bg-white/10'
                }`}
              >
                <ShieldCheck className={`w-4 h-4 mt-0.5 ${selectedModel === 'gemini-3-pro-image-preview' ? 'text-blue-400' : 'text-white/20'}`} />
                <div>
                  <p className="font-bold text-xs">Gemini 3 Pro</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Chất lượng cao nhất, tái tạo khuôn mặt.</p>
                </div>
              </button>
              <button 
                onClick={() => setSelectedModel('gemini-3.1-flash-image-preview')}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all text-left ${
                  selectedModel === 'gemini-3.1-flash-image-preview' 
                  ? 'bg-blue-500/10 border-blue-500/50' 
                  : 'bg-white/5 border-transparent hover:bg-white/10'
                }`}
              >
                <Zap className={`w-4 h-4 mt-0.5 ${selectedModel === 'gemini-3.1-flash-image-preview' ? 'text-blue-400' : 'text-white/20'}`} />
                <div>
                  <p className="font-bold text-xs">Gemini 3.1 Flash</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Tốc độ nhanh, phục hồi cơ bản.</p>
                </div>
              </button>
            </div>
          </div>

          {/* Resolution Selection */}
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Độ phân giải</label>
            <div className="grid grid-cols-3 gap-2">
              {(['1K', '2K', '4K'] as ResolutionType[]).map((res) => (
                <button 
                  key={res}
                  onClick={() => setSelectedResolution(res)}
                  className={`py-2 rounded-lg border text-xs font-bold transition-all ${
                    selectedResolution === res 
                    ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' 
                    : 'bg-white/5 border-transparent text-white/40 hover:bg-white/10'
                  }`}
                >
                  {res}
                </button>
              ))}
            </div>
          </div>

          {/* Aspect Ratio Selection */}
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Tỷ lệ khung hình</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'original', label: 'Gốc' },
                { id: '1:1', label: '1:1' },
                { id: '3:4', label: '3:4' },
                { id: '4:3', label: '4:3' },
                { id: '2:3', label: '2:3' },
                { id: '3:2', label: '3:2' },
                { id: '5:7', label: '5:7' },
                { id: '7:5', label: '7:5' },
                { id: '16:9', label: '16:9' },
                { id: '9:16', label: '9:16' }
              ].map((ratio) => (
                <button 
                  key={ratio.id}
                  onClick={() => setSelectedAspectRatio(ratio.id as AspectRatioType)}
                  className={`py-2 rounded-lg border text-[10px] font-bold transition-all ${
                    selectedAspectRatio === ratio.id 
                    ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' 
                    : 'bg-white/5 border-transparent text-white/40 hover:bg-white/10'
                  }`}
                >
                  {ratio.label}
                </button>
              ))}
            </div>
          </div>

          {/* Advanced Options Accordion */}
          <div className="border-t border-white/5 pt-6">
            <button 
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between text-xs font-bold text-white/60 hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4" />
                TÙY CHỌN NÂNG CAO
              </div>
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            <AnimatePresence>
              {showAdvanced && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-4 space-y-6">
                    {/* Color Mode Selection */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                        <Palette className="w-3 h-3" /> Chế độ màu sắc
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'original', label: 'Giữ màu gốc' },
                          { id: 'colorize', label: 'Lên màu AI' }
                        ].map((mode) => (
                          <button 
                            key={mode.id}
                            onClick={() => setColorMode(mode.id as 'original' | 'colorize')}
                            className={`py-2 px-3 rounded-lg border text-[10px] font-bold transition-all ${
                              colorMode === mode.id 
                              ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' 
                              : 'bg-white/5 border-transparent text-white/40 hover:bg-white/10'
                            }`}
                          >
                            {mode.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Background Selection */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                        <ImageIcon className="w-3 h-3" /> Thay nền
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'original', label: 'Gốc' },
                          { id: 'blue', label: 'Xanh (ID)' },
                          { id: 'white', label: 'Trắng (Passport)' },
                          { id: 'gradient', label: 'Gradient' }
                        ].map((bg) => (
                          <button 
                            key={bg.id}
                            onClick={() => setBackgroundType(bg.id as BackgroundType)}
                            className={`py-2 px-3 rounded-lg border text-[10px] font-bold transition-all ${
                              backgroundType === bg.id 
                              ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' 
                              : 'bg-white/5 border-transparent text-white/40 hover:bg-white/10'
                            }`}
                          >
                            {bg.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Replace Clothing Toggle */}
                    <div className="pt-2">
                      <button 
                        onClick={() => {
                          const newValue = !replaceClothing;
                          setReplaceClothing(newValue);
                          if (newValue) setEnhanceClothing(false);
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                          replaceClothing 
                          ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' 
                          : 'bg-white/5 border-transparent text-white/40 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Shirt className={`w-4 h-4 ${replaceClothing ? 'text-blue-400' : 'text-white/20'}`} />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Thay trang phục</span>
                        </div>
                        <div className={`w-8 h-4 rounded-full relative transition-colors ${replaceClothing ? 'bg-blue-500' : 'bg-white/10'}`}>
                          <motion.div 
                            className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full"
                            animate={{ x: replaceClothing ? 16 : 0 }}
                          />
                        </div>
                      </button>
                    </div>

                    {/* Clothing Selection (only if replaceClothing is true) */}
                    <AnimatePresence>
                      {replaceClothing && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden space-y-4"
                        >
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              "Vest Nam (Truyền thống)",
                              "Vest Nam (Lịch lãm)",
                              "Áo dài (Nữ)",
                              "Sơ mi trắng",
                              "Áo thun polo",
                              "Tùy chỉnh"
                            ].map((option) => (
                              <button
                                key={option}
                                onClick={() => setClothingOption(option)}
                                className={`py-2 px-3 rounded-lg border text-[10px] font-bold transition-all text-left ${
                                  clothingOption === option
                                  ? 'bg-blue-500/10 border-blue-500/50 text-blue-400'
                                  : 'bg-white/5 border-transparent text-white/40 hover:bg-white/10'
                                }`}
                              >
                                {option}
                              </button>
                            ))}
                          </div>

                          {clothingOption === "Tùy chỉnh" && (
                            <div className="relative">
                              <input 
                                type="text"
                                value={clothingText}
                                onChange={(e) => setClothingText(e.target.value)}
                                placeholder="Ví dụ: Áo vest đen, Áo dài..."
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500/50 transition-all"
                              />
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Enhance Clothing Details Toggle */}
                    <div className="pt-2">
                      <button 
                        onClick={() => {
                          const newValue = !enhanceClothing;
                          setEnhanceClothing(newValue);
                          if (newValue) setReplaceClothing(false);
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                          enhanceClothing 
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                          : 'bg-white/5 border-transparent text-white/40 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Sparkles className={`w-4 h-4 ${enhanceClothing ? 'text-emerald-400' : 'text-white/20'}`} />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Tăng nét & Tái tạo trang phục</span>
                        </div>
                        <div className={`w-8 h-4 rounded-full relative transition-colors ${enhanceClothing ? 'bg-emerald-500' : 'bg-white/10'}`}>
                          <motion.div 
                            className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full"
                            animate={{ x: enhanceClothing ? 16 : 0 }}
                          />
                        </div>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Features List */}
          <div className="pt-6 border-t border-white/5 space-y-3">
            <div className="flex items-center gap-3 text-white/40">
              <User className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-[10px] font-medium">Bảo toàn 100% nét mặt gốc</span>
            </div>
            <div className="flex items-center gap-3 text-white/40">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[10px] font-medium">Khử xước & bụi bẩn tự động</span>
            </div>
            <div className="flex items-center gap-3 text-white/40">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[10px] font-medium">Phục hồi màu sắc tự nhiên</span>
            </div>
          </div>
        </div>

        {/* Sidebar Footer - Sticky/Absolute Bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gray-900/90 backdrop-blur-md border-t border-white/5 z-40">
          {!hasApiKey ? (
            <button 
              onClick={handleSelectKey}
              className="w-full py-3.5 md:py-4 bg-blue-600 hover:bg-blue-700 rounded-xl md:rounded-2xl font-bold text-white shadow-xl shadow-blue-600/20 transition-all flex items-center justify-center gap-3"
            >
              <Key className="w-4 h-4 md:w-5 md:h-5" />
              Chọn API Key để tiếp tục
            </button>
          ) : (
            <button 
              disabled={!originalImage || isProcessing}
              onClick={restorePhoto}
              className="w-full py-3.5 md:py-4 bg-gradient-to-r from-blue-600 to-purple-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl md:rounded-2xl font-bold text-white shadow-xl shadow-blue-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 md:w-5 md:h-5" />
                  Bắt đầu phục hồi
                </>
              )}
            </button>
          )}
          <p className="text-[8px] md:text-[10px] text-center text-white/20 mt-3 md:mt-4">© 2026 QUANGTHOAI RESTORE. Powered by Google Gemini AI.</p>
        </div>
      </aside>
    </div>
  );
}
