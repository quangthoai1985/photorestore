import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  Image as ImageIcon, 
  Sparkles, 
  Download, 
  RefreshCw, 
  AlertCircle,
  CheckCircle2,
  Zap,
  ShieldCheck,
  Key,
  Users,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageSlider } from '../components/ImageSlider';
import { Link } from 'react-router-dom';
import { useHybridPipeline, PipelineOptions } from '../hooks/useHybridPipeline';

// --- Constants ---
const GROUP_ANALYSIS_PROMPT = [
  'You are a professional photo analyst.',
  'Analyze this photograph with forensic precision. Output a structured report:',
  '',
  'PHOTO TYPE: [portrait/group/wedding/family/event/document]',
  'PRINT MEDIUM: [glossy print / matte print / newspaper / digital / unknown]',
  'ERA: [decade estimate based on clothing, hairstyle, print quality]',
  'COLOR MODE: [color / black-and-white / sepia / faded-color]',
  '',
  'DAMAGE INVENTORY (list each issue):',
  '- Physical damage: scratches, tears, holes — location and severity',
  '- Chemical damage: yellowing, fading, stains — location',
  '- Optical artifacts: light bands, reflections, scan lines — location',
  '- Compression: JPEG artifacts, noise, blur — severity 1-10',
  '',
  'SUBJECTS:',
  '- Count: number of people',
  '- Face quality: sharp / soft / damaged — per person if different',
  '- Dominant skin tone: warm / neutral / cool',
  '',
  'CLOTHING COLORS (critical for restoration):',
  'List each major garment with actual color',
  '',
  'BACKGROUND: describe fully',
  '',
  'RESTORATION PRIORITY: which areas need most work'
].join('\n');

const GROUP_ENHANCEMENT_PROMPT = [
  'You are a master photo restorer with 30 years experience.',
  'Your task: produce a SINGLE complete high-quality restored image.',
  '',
  'RESTORATION RULES — follow strictly in this order:',
  '',
  'STEP 1 — DAMAGE REMOVAL (inpaint first, sharpen last):',
  '- REMOVE all white scratches, tears, dust spots by inpainting surrounding texture.',
  '- Remove horizontal light bands and reflection artifacts from re-photographing a print.',
  '- Remove paper texture, hexagonal dot patterns, film grain.',
  '- Remove yellowing and chemical stains while preserving original tones.',
  '',
  'STEP 2 — TONE AND COLOR RESTORATION:',
  '- Establish a single unified global white balance across the ENTIRE image.',
  '- If black-and-white: add natural color. Vietnamese/Asian skin = warm #C8A882.',
  '- If color but faded: restore saturation naturally. Do NOT oversaturate.',
  '- White garments: pure #F5F5F0. Dark suits: #2A2A2A, NOT flat black.',
  '- Hair: preserve exact original grey/dark ratio. Do NOT whiten dark hair.',
  '',
  'STEP 3 — FACE ENHANCEMENT within the global image not isolated:',
  '- Sharpen ALL faces simultaneously while maintaining their relationship',
  '  to each other and to the ambient lighting of the scene.',
  '- Eyes must be sharp, bright, natural — not glassy.',
  '- Skin: smooth but with natural pore texture. No plastic skin effect.',
  '- Preserve each persons exact age, bone structure, expression.',
  '',
  'STEP 4 — CLOTHING AND BACKGROUND:',
  '- Restore fabric texture: weaves, lace patterns, embroidery details.',
  '- Background must be fully restored — no soft blurry or hallucinated zones.',
  '- Every centimeter of the image must be sharp and detailed.',
  '',
  'STEP 5 — EDGE RECONSTRUCTION:',
  '- If photo has black bars or messy crop edges, extend background naturally.',
  '- No frame borders, no vignette, no artificial borders.',
  '',
  'CRITICAL: Output ONE complete image. Every area must be equally sharp.',
  'No region should be blurry or soft.',
  'Treat the image as if taken today with a modern high-resolution camera.'
].join('\n');

const GROUP_FACE_PROMPT = [
  'You are a portrait retouching specialist.',
  'Enhance this face crop from a group photo restoration.',
  '',
  'ABSOLUTE RULES:',
  '1. IDENTITY LOCK: Preserve exact bone structure, eye shape, nose, mouth.',
  '   Do NOT morph or idealize. This is a real person.',
  '2. AGE PRESERVATION: Keep exact age visible in original. No de-aging.',
  '3. SKIN TONE MATCH: Output skin tone MUST match the color temperature',
  '   of the original photo scene warm/cool/neutral as established globally.',
  '4. HAIR FIDELITY: Dark hair stays dark. Grey ratio stays exact.',
  '',
  'ENHANCEMENT GOALS:',
  '- Eyes: iris clarity, catchlight restoration, lash definition',
  '- Skin: remove noise and damage artifacts only. Preserve natural texture.',
  '- Lips: natural color, not over-saturated',
  '- Hair: strand definition, natural sheen',
  '',
  'OUTPUT: High-resolution face suitable for compositing into a restored photo.',
  'The color temperature must NOT shift from the input.'
].join('\n');

const GROUP_CLOTHING_PROMPT = [
  'Focus exclusively on clothing and fabric restoration.',
  'Enhance texture sharpness and detail of all garments in this image.',
  '- Lace, embroidery, patterns: restore fine detail without hallucinating new ones',
  '- White fabrics: crisp, clean, no yellow cast',
  '- Dark fabrics: rich depth, visible weave texture',
  '- Natural fabric drape and shadow — do not flatten',
  'Do NOT change any colors. Do NOT touch faces or background.'
].join('\n');

type ModelType = 'gemini-3-pro-image-preview' | 'gemini-3.1-flash-image-preview';
type ResolutionType = '1K' | '2K' | '4K';

export default function GroupRestore() {
  const { runPipeline, isProcessing, status, error, setError } = useHybridPipeline();
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [restoredImage, setRestoredImage] = useState<string | null>(null);
  
  const [selectedModel, setSelectedModel] = useState<ModelType>('gemini-3-pro-image-preview');
  const [selectedResolution, setSelectedResolution] = useState<ResolutionType>('1K');
  const [hasApiKey, setHasApiKey] = useState(false);

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

  const restorePhoto = async () => {
    if (!originalImage) return;

    const options: PipelineOptions = {
      selectedModel,
      selectedResolution,
      colorization: false,
      faceEnhancement: true,
      clothingEnhancement: true,
      maxFaces: 'all',
      detectionSensitivity: 50,
      blendingSmoothness: 40,
      prompts: {
        analysis: GROUP_ANALYSIS_PROMPT,
        enhancement: GROUP_ENHANCEMENT_PROMPT,
        face: GROUP_FACE_PROMPT,
        clothing: GROUP_CLOTHING_PROMPT
      }
    };

    try {
      const result = await runPipeline(originalImage, options);
      setRestoredImage(result);
    } catch (err) {
      // handled by hook
    }
  };

  const handleDownload = () => {
    if (restoredImage) {
      const link = document.createElement('a');
      link.href = restoredImage;
      link.download = `group-restored-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-white/20">
      <div className="max-w-[1600px] mx-auto p-4 md:p-6 lg:p-8">
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Link 
              to="/"
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Phục hồi Ảnh Nhóm</h1>
              <p className="text-white/50 text-sm mt-1">
                Tối ưu hóa cho ảnh có nhiều khuôn mặt và chi tiết phức tạp
              </p>
            </div>
          </div>
          
          {!hasApiKey ? (
            <button
              onClick={handleSelectKey}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 rounded-full transition-colors text-sm font-medium border border-emerald-500/20"
            >
              <Key className="w-4 h-4" />
              Kết nối Gemini API
            </button>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-500 rounded-full text-sm font-medium border border-emerald-500/20">
              <ShieldCheck className="w-4 h-4" />
              Đã kết nối API
            </div>
          )}
        </header>

        <div className="grid lg:grid-cols-[380px_1fr] gap-8">
          {/* Sidebar */}
          <aside className="space-y-6">
            <div className="p-5 bg-white/5 border border-white/10 rounded-2xl space-y-6">
              
              {/* Phần 1 — AI Model */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  Mô hình AI
                </label>
                <div className="grid gap-2">
                  <button
                    onClick={() => setSelectedModel('gemini-3-pro-image-preview')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedModel === 'gemini-3-pro-image-preview'
                        ? 'bg-blue-500/10 border-blue-500/50'
                        : 'bg-black/20 border-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-medium ${selectedModel === 'gemini-3-pro-image-preview' ? 'text-blue-400' : 'text-white/80'}`}>
                        Gemini 3 Pro
                      </span>
                      {selectedModel === 'gemini-3-pro-image-preview' && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
                    </div>
                    <p className="text-xs text-white/50">Tốt nhất — tự động phân tích & phục hồi toàn diện</p>
                  </button>
                  
                  <button
                    onClick={() => setSelectedModel('gemini-3.1-flash-image-preview')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedModel === 'gemini-3.1-flash-image-preview'
                        ? 'bg-blue-500/10 border-blue-500/50'
                        : 'bg-black/20 border-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-medium ${selectedModel === 'gemini-3.1-flash-image-preview' ? 'text-blue-400' : 'text-white/80'}`}>
                        Gemini 3.1 Flash
                      </span>
                      {selectedModel === 'gemini-3.1-flash-image-preview' && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
                    </div>
                    <p className="text-xs text-white/50">Nhanh hơn — phù hợp ảnh ít hư hỏng</p>
                  </button>
                </div>
              </div>

              {/* Phần 2 — Độ phân giải */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                  <ImageIcon className="w-3.5 h-3.5" />
                  Độ phân giải xuất
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['1K', '2K', '4K'] as ResolutionType[]).map((res) => (
                    <button
                      key={res}
                      onClick={() => setSelectedResolution(res)}
                      className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                        selectedResolution === res
                          ? 'bg-white text-black border-white'
                          : 'bg-black/20 border-white/10 text-white/60 hover:bg-white/5'
                      }`}
                    >
                      {res}
                    </button>
                  ))}
                </div>
              </div>

              {/* Phần 3 — Info box */}
              <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-3">
                <p className="text-xs font-bold text-white/40 uppercase tracking-widest">
                  Hệ thống tự động
                </p>
                <div className="space-y-2">
                  {[
                    "Phân tích chất liệu & mức độ hư hỏng",
                    "Phục hồi tổng thể — nền, trang phục, khuôn mặt",
                    "Tự động nhận diện & làm nét mọi khuôn mặt",
                    "Khử xước, bụi, vết ố và dải sáng phản chiếu",
                    "Upscale lên độ phân giải đã chọn"
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span className="text-[11px] text-white/50">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  onClick={restorePhoto}
                  disabled={!originalImage || isProcessing || !hasApiKey}
                  className="w-full py-3.5 px-4 bg-white text-black rounded-xl font-medium hover:bg-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      Bắt đầu Phục hồi
                    </>
                  )}
                </button>
                
                {!hasApiKey && (
                  <p className="text-xs text-red-400 text-center mt-3">
                    Vui lòng kết nối Gemini API để sử dụng
                  </p>
                )}
              </div>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="min-h-[600px] bg-white/5 border border-white/10 rounded-2xl flex flex-col relative overflow-hidden">
            {!originalImage ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                  <Upload className="w-10 h-10 text-white/40" />
                </div>
                <h3 className="text-xl font-medium mb-2">Tải ảnh lên để bắt đầu</h3>
                <p className="text-white/40 max-w-md mb-8">
                  Hỗ trợ JPG, PNG. Dung lượng tối đa 10MB.
                  Hệ thống sẽ tự động nhận diện và phục hồi từng khuôn mặt.
                </p>
                <label className="cursor-pointer group relative">
                  <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative px-6 py-3 bg-white/10 hover:bg-white/15 border border-white/10 rounded-full transition-colors flex items-center gap-2">
                    <ImageIcon className="w-5 h-5" />
                    <span>Chọn ảnh từ máy tính</span>
                  </div>
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/jpeg, image/png, image/webp" 
                    onChange={onFileChange}
                  />
                </label>
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                {/* Toolbar */}
                <div className="h-14 border-b border-white/10 flex items-center justify-between px-4 bg-black/20">
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer p-2 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white" title="Tải ảnh khác">
                      <Upload className="w-4 h-4" />
                      <input type="file" className="hidden" accept="image/*" onChange={onFileChange} />
                    </label>
                  </div>
                  {restoredImage && (
                    <button
                      onClick={handleDownload}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm font-medium"
                    >
                      <Download className="w-4 h-4" />
                      Tải xuống
                    </button>
                  )}
                </div>

                {/* Image Area */}
                <div className="flex-1 relative bg-black/40 p-4 flex items-center justify-center min-h-[500px]">
                  <AnimatePresence mode="wait">
                    {restoredImage ? (
                      <motion.div
                        key="slider"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="w-full h-full"
                      >
                        <ImageSlider 
                          original={originalImage} 
                          restored={restoredImage} 
                        />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="original"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="relative max-w-full max-h-full"
                      >
                        <img 
                          src={originalImage} 
                          alt="Original" 
                          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                        />
                        
                        {/* Processing Overlay */}
                        {isProcessing && (
                          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center p-6">
                            <div className="w-full max-w-md space-y-6">
                              <div className="flex items-center justify-between text-sm font-medium">
                                <span className="text-blue-400 flex items-center gap-2">
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                  {status?.step || 'Đang khởi tạo...'}
                                </span>
                                <span>{status?.progress || 0}%</span>
                              </div>
                              <p className="text-xs text-white/40 mt-1">
                                Hệ thống đang tự động phân tích và tối ưu...
                              </p>
                              
                              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                <motion.div 
                                  className="h-full bg-blue-500 rounded-full"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${status?.progress || 0}%` }}
                                  transition={{ duration: 0.5 }}
                                />
                              </div>
                              
                              <p className="text-xs text-center text-white/40">
                                Quá trình này có thể mất vài phút tùy thuộc vào số lượng khuôn mặt trong ảnh.
                              </p>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}
            
            {/* Error Toast */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl shadow-2xl backdrop-blur-md"
                >
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p className="text-sm">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}
