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
  Users,
  Palette,
  ArrowLeft,
  Layers,
  Focus
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';
import { ImageSlider } from '../components/ImageSlider';
import { Link } from 'react-router-dom';

// --- Constants ---
const GROUP_ANALYSIS_PROMPT = `Analyze this old group photograph in microscopic detail.
1. Identify all people in the group. Describe their facial features, age, gender, facial expression, and head pose.
2. Clothing details: Describe the clothing styles of the individuals.
3. Color Prediction: If black and white, predict realistic colors for skin tones, hair, and clothing.
4. Damage Assessment: Identify specific areas of damage: scratches, dust, noise, fading, or paper texture (e.g., hexagonal dots).
Your output must serve as a strict, factual reference to completely recreate this exact group scene without losing anyone's original identity.`;

type ModelType = 'gemini-3-pro-image-preview' | 'gemini-3.1-flash-image-preview';
type ResolutionType = '1K' | '2K' | '4K';
type ColorizationType = 'original' | 'colorize';
type FaceEnhancementLevel = 'balanced' | 'maximum';

interface ProcessingStatus {
  step: string;
  progress: number;
}

import { useHybridPipeline, PipelineOptions } from '../hooks/useHybridPipeline';

export default function GroupRestore() {
  const { runPipeline, isProcessing, status, setStatus, error, setError } = useHybridPipeline();
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [restoredImage, setRestoredImage] = useState<string | null>(null);
  
  const [selectedModel, setSelectedModel] = useState<ModelType>('gemini-3-pro-image-preview');
  const [selectedResolution, setSelectedResolution] = useState<ResolutionType>('1K');
  const [hasApiKey, setHasApiKey] = useState(false);

  // --- Group Specific Options ---
  const [colorization, setColorization] = useState<ColorizationType>('original');
  const [faceEnhancement, setFaceEnhancement] = useState<FaceEnhancementLevel>('balanced');
  const [clothingEnhancement, setClothingEnhancement] = useState(false);
  
  // --- Advanced Options ---
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [maxFaces, setMaxFaces] = useState<'all' | '5' | '15'>('all');
  const [detectionSensitivity, setDetectionSensitivity] = useState(50);
  const [blendingSmoothness, setBlendingSmoothness] = useState(40);

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

    const options: PipelineOptions = {
      selectedModel,
      selectedResolution,
      colorization: colorization === 'colorize',
      faceEnhancement: true,
      clothingEnhancement,
      maxFaces,
      detectionSensitivity,
      blendingSmoothness,
      prompts: {
        analysis: `Analyze this photograph with scientific precision. For each person identified, provide a strict report on:
- Person 1 (e.g., Male): Hair style/color, skin tone, exact clothing (Top color/style, Bottom color/style). 
- Person 2 (e.g., Female): Hair style/color, skin tone, exact clothing (Top color/style, Bottom color/style).
- AGE PRESERVATION: Meticulously note the level of skin laxity and wrinkles. 
- HAIR FIDELITY: If the original hair is grey-black or salt-and-pepper, DO NOT render it pure white. Maintain the exact ratio of dark/light hair.
- IDENTITY ANCHOR: Focus on the bone structure and the "soul" of the expression. Do not exaggerate facial lines that are only visible due to original photo noise.
- COLOR CORRECTION RULE: If a garment looks yellowish or brownish but appears to be a formal shirt or traditional dress (Ao Dai), assume its original color was PURE WHITE. Differentiate between actual black fabric and shadows.
- TEXTURE RULE: Identify the woman's trousers - confirm if they are white or dark based on the highlights.
Instruction: Specifically analyze the clothing textures. 
- Identify the fabric type (e.g., silk Ao Dai with subtle floral patterns, cotton shirt). 
- Note the positions of buttons, seams, embroidery, and natural fabric folds/shadows. 
Instruction: Meticulously catalog the background elements. 
- Identify the purple wedding ornaments (likely paper or fabric pleated decorations). 
- Describe the specific shape of the floral arrangements and the wooden/brick textures of the floor and pots. 
- Describe the exact folding patterns of the background curtains. 
- This description must act as a 'STRICT ANCHOR' to prevent AI from changing the style of these objects.
Output this as a structured 'IDENTITY PRESERVATION LOG', 'CLOTHING_TEXTURE_MAP', and 'STRICT ANCHOR MAP'.`,
        enhancement: `You are a technical photo restorer. Your goal is to CLEAN the existing image, NOT to redesign it. Use the provided IDENTITY PRESERVATION LOG and STRICT ANCHOR MAP as your absolute guide.
CRITICAL CONSTRAINTS:
1. NO ARTIFACTS: DO NOT add any picture frames, borders, wooden textures, or backgrounds not present in the original. The output must be a FLAT image.
2. FIDELITY OVER BEAUTIFICATION: Maintain the subjects' exact age as seen in the original. DO NOT deepen wrinkles or add age spots. If a face looks "too sharp" or "too old," reduce the detail level to match the original persona.
3. EDGE RESTORATION: Reconstruct the edges by extending the EXISTING background (the teal/green color), NOT by adding a frame.
CRITICAL INSTRUCTIONS:
- STRICT ADHERENCE: Maintain the exact shapes, textures, and styles of all background decorations (purple arches, flower pots, curtains). 
- DO NOT add fluffy or stylized AI effects. If an object is a pleated paper ornament, it must remain a pleated paper ornament, only sharper and cleaner.
- NO HALLUCINATION: Do not invent new background details. Keep the floor tiles and doorway exactly as they appear in the original.
- NOISE REDUCTION: Only remove physical damage (scratches, dust, stains). Preserve the underlying photographic grain and realistic lighting.
- COLOR FIDELITY: If the log says a garment is PURE WHITE, you must render it as clean, crisp white, removing all yellow aging stains. 
- NO HALLUCINATION (CLOTHING): Do NOT change the color of trousers or shirts. If the woman is wearing white trousers, they MUST remain white. Do NOT turn them black.
- IDENTITY: Maintain the exact facial structure and expressions based on the analysis.
${colorization === 'colorize' ? '- Colorize the image naturally with realistic skin tones and clothing colors.' : '- Keep the original tones but clean them up.'}
OUTPUT REQUIREMENT: Generate the restored image with the highest possible pixel density and structural clarity. Ensure that fine details like skin pores and fabric weaves are preserved for high-resolution upscaling (up to 4K).
The result must be a clean, high-fidelity base image for face stitching.`,
        face: `Enhance this face from a group photo. 
          ${faceEnhancement === 'maximum' ? 'Apply maximum sharpening.' : 'Apply balanced enhancement.'}
          CRITICAL: Maintain the exact skin tone as described in the IDENTITY PRESERVATION LOG to ensure it matches the body. Strictly preserve original identity and expression.
          - SKIN TEXTURE: Restore natural skin pores, but DO NOT add artificial wrinkles. 
          - EYES & EXPRESSION: Keep the eye shape and gaze exactly as the original. 
          - LIMIT CREATIVITY: Treat this as a restoration project, not a portrait creation.`,
        clothing: `Focus EXCLUSIVELY on the clothing. 
- Denoise and globally sharpen the edges of fabric folds, collars, and buttons.
- Enhance the depth of fabric folds using realistic shadowing.
- CRITICAL: For complex or repetitive patterns (like florals, polka dots, intricate prints), DO NOT over-render or attempt to micro-manage every single detail. Focus on global clarity, contrast, and realistic fabric flow to optimize processing time.
- Ensure the white garments (Ao Dai and shirt) maintain natural shading and textural fidelity, avoiding flat white shapes or muddy colors.
- Return the image with clean, enhanced textiles without excessive micro-detailing.`
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
    link.download = `QUANGTHOAI_GROUP_RESTORE_${selectedResolution}_${Date.now()}.png`;
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
        link.download = `QUANGTHOAI_GROUP_COMPARISON_${Date.now()}.jpg`;
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
            <div className="w-6 h-6 md:w-8 md:h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Users className="w-4 h-4 md:w-5 md:h-5 text-white" />
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
              className="group relative w-full max-w-lg aspect-video bg-white/[0.02] border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-4 md:gap-6 hover:border-purple-500/50 hover:bg-purple-500/[0.02] transition-all duration-500 mx-4"
            >
              <div className="w-12 h-12 md:w-20 md:h-20 bg-white/5 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                <Upload className="w-5 h-5 md:w-8 md:h-8 text-white/40 group-hover:text-purple-400 transition-colors" />
              </div>
              <div className="text-center px-4">
                <p className="text-sm md:text-lg font-medium text-white/80">Kéo thả ảnh tập thể vào đây</p>
                <p className="text-[10px] md:text-sm text-white/40 mt-1">JPG, PNG, WEBP (Tối đa 10MB)</p>
              </div>
              <label className="px-6 py-2 md:px-8 md:py-3 bg-white text-black rounded-full text-xs md:text-sm font-semibold cursor-pointer hover:bg-purple-50 transition-colors">
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
                          <div className="absolute inset-0 border-4 border-purple-500/20 rounded-full" />
                          <motion.div 
                            className="absolute inset-0 border-4 border-t-purple-500 rounded-full"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-purple-400" />
                          </div>
                        </div>
                        <div className="text-center space-y-1 md:space-y-2 px-6 md:px-8">
                          <p className="text-sm md:text-xl font-bold text-white tracking-wide">{status.step}</p>
                          <div className="w-full max-w-[150px] md:max-w-xs mx-auto h-1 md:h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <motion.div 
                              className="h-full bg-purple-500"
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
                      className="flex items-center gap-2 px-4 py-2 md:px-6 md:py-2.5 bg-white text-black hover:bg-purple-50 border border-white/10 rounded-full text-[10px] md:text-sm font-bold transition-all"
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
            <Settings2 className="w-4 h-4 md:w-5 md:h-5 text-purple-400" />
            <h2 className="font-bold text-sm md:text-lg">Cấu hình Tập thể</h2>
          </div>
          <button 
            onClick={handleSelectKey}
            className={`p-1.5 md:p-2 rounded-lg border transition-all flex items-center gap-2 ${
              hasApiKey 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20' 
              : 'bg-amber-500/10 border-amber-500/20 text-amber-500 hover:bg-amber-500/20'
            }`}
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
                  ? 'bg-purple-500/10 border-purple-500/50' 
                  : 'bg-white/5 border-transparent hover:bg-white/10'
                }`}
              >
                <ShieldCheck className={`w-4 h-4 mt-0.5 ${selectedModel === 'gemini-3-pro-image-preview' ? 'text-purple-400' : 'text-white/20'}`} />
                <div>
                  <p className="font-bold text-xs">Gemini 3 Pro</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Tốt nhất cho phục hồi đa khuôn mặt.</p>
                </div>
              </button>
              <button 
                onClick={() => setSelectedModel('gemini-3.1-flash-image-preview')}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all text-left ${
                  selectedModel === 'gemini-3.1-flash-image-preview' 
                  ? 'bg-purple-500/10 border-purple-500/50' 
                  : 'bg-white/5 border-transparent hover:bg-white/10'
                }`}
              >
                <Zap className={`w-4 h-4 mt-0.5 ${selectedModel === 'gemini-3.1-flash-image-preview' ? 'text-purple-400' : 'text-white/20'}`} />
                <div>
                  <p className="font-bold text-xs">Gemini 3.1 Flash</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Xử lý nhanh cho ảnh tập thể lớn.</p>
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
                    ? 'bg-purple-500/10 border-purple-500/50 text-purple-400' 
                    : 'bg-white/5 border-transparent text-white/40 hover:bg-white/10'
                  }`}
                >
                  {res}
                </button>
              ))}
            </div>
          </div>

          {/* Colorization Options */}
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
              <Palette className="w-3 h-3" /> Tùy chọn Màu sắc
            </label>
            <div className="grid gap-2">
              {[
                { id: 'original', label: 'Giữ nguyên màu gốc', desc: 'Duy trì tông màu của ảnh hiện tại.' },
                { id: 'colorize', label: 'AI Tự động lên màu', desc: 'Tô màu tự nhiên cho ảnh đen trắng.' }
              ].map((opt) => (
                <button 
                  key={opt.id}
                  onClick={() => setColorization(opt.id as ColorizationType)}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-all text-left ${
                    colorization === opt.id 
                    ? 'bg-purple-500/10 border-purple-500/50' 
                    : 'bg-white/5 border-transparent hover:bg-white/10'
                  }`}
                >
                  <div className={`w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center ${colorization === opt.id ? 'border-purple-500' : 'border-white/20'}`}>
                    {colorization === opt.id && <div className="w-2 h-2 bg-purple-500 rounded-full" />}
                  </div>
                  <div>
                    <p className="font-bold text-xs">{opt.label}</p>
                    <p className="text-[10px] text-white/40 mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Face Enhancement Level */}
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
              <Focus className="w-3 h-3" /> Mức độ Tăng nét khuôn mặt
            </label>
            <div className="grid gap-2">
              {[
                { id: 'balanced', label: 'Cân bằng', desc: 'Phục hồi tổng thể, khuôn mặt hài hòa với cảnh.' },
                { id: 'maximum', label: 'Ưu tiên tối đa Khuôn mặt', desc: 'Làm nét tối đa mọi khuôn mặt trong ảnh.' }
              ].map((opt) => (
                <button 
                  key={opt.id}
                  onClick={() => setFaceEnhancement(opt.id as FaceEnhancementLevel)}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-all text-left ${
                    faceEnhancement === opt.id 
                    ? 'bg-purple-500/10 border-purple-500/50' 
                    : 'bg-white/5 border-transparent hover:bg-white/10'
                  }`}
                >
                  <div className={`w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center ${faceEnhancement === opt.id ? 'border-purple-500' : 'border-white/20'}`}>
                    {faceEnhancement === opt.id && <div className="w-2 h-2 bg-purple-500 rounded-full" />}
                  </div>
                  <div>
                    <p className="font-bold text-xs">{opt.label}</p>
                    <p className="text-[10px] text-white/40 mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            
            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              <div className="flex flex-col">
                <label htmlFor="clothing-enhancement" className="text-xs font-bold text-white">
                  Tăng nét & Tái tạo trang phục
                </label>
                <span className="text-[10px] text-white/40">Phục hồi chi tiết vân vải, nếp nhăn (Tốn thêm thời gian)</span>
              </div>
              <button
                id="clothing-enhancement"
                role="switch"
                aria-checked={clothingEnhancement}
                onClick={() => setClothingEnhancement(!clothingEnhancement)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                  clothingEnhancement ? 'bg-purple-500' : 'bg-white/20'
                }`}
              >
                <span className="sr-only">Tăng nét & Tái tạo trang phục</span>
                <span
                  className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                    clothingEnhancement ? 'translate-x-2' : '-translate-x-2'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Features List */}
          <div className="pt-6 border-t border-white/5 space-y-3">
            <div className="flex items-center gap-3 text-white/40">
              <Layers className="w-3.5 h-3.5 text-purple-500" />
              <span className="text-[10px] font-medium">Bảo toàn danh tính đa nhân vật</span>
            </div>
            <div className="flex items-center gap-3 text-white/40">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[10px] font-medium">Cân bằng ánh sáng tổng thể</span>
            </div>
            <div className="flex items-center gap-3 text-white/40">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[10px] font-medium">Khử nhiễu & Phục hồi bối cảnh</span>
            </div>
          </div>

          {/* Advanced Options Accordion */}
          <div className="border border-white/10 rounded-xl overflow-hidden bg-white/[0.02]">
            <button
              onClick={() => setAdvancedOpen(!advancedOpen)}
              className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold">⚙️ Tùy chọn xử lý khuôn mặt (Nâng cao)</span>
              </div>
              {advancedOpen ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
            </button>
            
            <AnimatePresence>
              {advancedOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 pt-0 space-y-6 border-t border-white/5 mt-2">
                    
                    {/* Max Faces */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Giới hạn số lượng khuôn mặt</label>
                      <p className="text-[10px] text-white/40 mb-2">Giúp giảm thời gian chờ nếu ảnh có quá nhiều người.</p>
                      <div className="grid grid-cols-1 gap-2">
                        {[
                          { id: 'all', label: 'Tất cả (Mặc định)' },
                          { id: '5', label: 'Chỉ nhân vật chính (Tối đa 5 người)' },
                          { id: '15', label: 'Nhóm vừa (Tối đa 15 người)' }
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => setMaxFaces(opt.id as any)}
                            className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all text-left ${
                              maxFaces === opt.id
                              ? 'bg-purple-500/10 border-purple-500/50 text-purple-400'
                              : 'bg-white/5 border-transparent text-white/60 hover:bg-white/10'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Detection Sensitivity */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Độ nhạy nhận diện</label>
                        <span className="text-[10px] text-purple-400 font-mono">{detectionSensitivity}%</span>
                      </div>
                      <p className="text-[10px] text-white/40 mb-2">
                        {detectionSensitivity < 30 ? 'Khắt khe: Chỉ nhận diện khuôn mặt rất rõ ràng.' : 
                         detectionSensitivity > 70 ? 'Nhạy cảm: Nhận diện cả khuôn mặt mờ, góc nghiêng.' : 
                         'Cân bằng: Nhận diện khuôn mặt tiêu chuẩn.'}
                      </p>
                      <input 
                        type="range" 
                        min="10" 
                        max="90" 
                        value={detectionSensitivity}
                        onChange={(e) => setDetectionSensitivity(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                      />
                      <div className="flex justify-between text-[8px] text-white/30 px-1">
                        <span>10% (Khắt khe)</span>
                        <span>90% (Nhạy cảm)</span>
                      </div>
                    </div>

                    {/* Blending Smoothness */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Độ mượt viền ghép (Blending)</label>
                        <span className="text-[10px] text-purple-400 font-mono">{blendingSmoothness}%</span>
                      </div>
                      <p className="text-[10px] text-white/40 mb-2">Điều chỉnh độ mờ ở viền khuôn mặt để ghép tự nhiên hơn vào ảnh gốc.</p>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={blendingSmoothness}
                        onChange={(e) => setBlendingSmoothness(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                      />
                      <div className="flex justify-between text-[8px] text-white/30 px-1">
                        <span>0% (Sắc nét)</span>
                        <span>100% (Mờ viền nhiều)</span>
                      </div>
                    </div>

                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Sidebar Footer */}
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
              className="w-full py-3.5 md:py-4 bg-gradient-to-r from-purple-600 to-pink-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl md:rounded-2xl font-bold text-white shadow-xl shadow-purple-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 md:w-5 md:h-5" />
                  Bắt đầu phục hồi tập thể
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
