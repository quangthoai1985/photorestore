import React, { useState } from 'react';
import {
  Upload,
  Sparkles,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  ShieldCheck,
  Key,
  ChevronRight,
  Shirt,
  Image as ImageIcon,
  ScanFace,
  Crop,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { ImageSlider } from '../components/ImageSlider';
import {
  useGeminiPipeline,
  IdPhotoOptions,
  ModelType,
  IdPhotoAspectRatio,
  IdPhotoBackgroundMode,
  IdPhotoCrop,
  IdPhotoExpression,
  IdPhotoGaze,
  IdPhotoPose,
} from '../hooks/useGeminiPipeline';
import { useApiKeyStatus } from '../hooks/useApiKeyStatus';
import { ApiKeyDialog } from '../components/ApiKeyDialog';
import { shouldPromptApiKeyReset } from '../lib/api';

type Step = 'none' | 'format' | 'subject' | 'style' | 'processing';

type ClothingPresetGroup = 'Nam' | 'Nữ' | 'Trung tính';
type PosePresetGroup = 'Chuẩn ảnh thẻ' | 'Nam' | 'Nữ' | 'Trung tính';

type ClothingPreset = {
  id: string;
  group: ClothingPresetGroup;
  label: string;
  description: string;
  prompt: string;
};

const CLOTHING_PRESETS: ClothingPreset[] = [
  {
    id: 'male-white-shirt',
    group: 'Nam',
    label: 'Sơ mi trắng',
    description: 'Trắng cơ bản, sạch, dễ dùng cho hồ sơ',
    prompt: 'A crisp white long-sleeve dress shirt with a structured collar, formal Vietnamese office portrait style.',
  },
  {
    id: 'male-white-office-shirt',
    group: 'Nam',
    label: 'Sơ mi trắng công sở',
    description: 'Cổ cứng, cài gọn, chuẩn công sở',
    prompt: 'A clean white long-sleeve office dress shirt with a stiff pointed collar, buttoned neatly, realistic Vietnamese office portrait style.',
  },
  {
    id: 'male-office-suit-tie',
    group: 'Nam',
    label: 'Vest nam công sở (có cà vạt)',
    description: 'Vest đen, sơ mi trắng, cà vạt navy',
    prompt: 'A formal black business suit jacket, crisp white dress shirt, and a neatly centered dark navy silk necktie, realistic Vietnamese office ID portrait style.',
  },
  {
    id: 'male-office-suit-no-tie',
    group: 'Nam',
    label: 'Vest nam công sở (không cà vạt)',
    description: 'Vest đen formal, không thắt cà vạt',
    prompt: 'A formal black office suit jacket over a crisp white dress shirt with the top button open or neatly closed, no tie, realistic Vietnamese professional portrait style.',
  },
  {
    id: 'male-black-suit',
    group: 'Nam',
    label: 'Vest đen',
    description: 'Vest tối màu cổ điển',
    prompt: 'A formal black suit jacket over a crisp white dress shirt, professional Vietnamese ID photo style.',
  },
  {
    id: 'male-navy-suit',
    group: 'Nam',
    label: 'Vest xanh navy',
    description: 'Lịch sự, hiện đại, công sở',
    prompt: 'A formal navy suit jacket over a clean white dress shirt, realistic studio ID portrait style.',
  },
  {
    id: 'male-light-blue-shirt',
    group: 'Nam',
    label: 'Sơ mi xanh nhạt',
    description: 'Nhẹ nhàng, công sở phổ biến',
    prompt: 'A light blue long-sleeve business dress shirt with a clean structured collar, realistic formal Vietnamese office portrait style.',
  },
  {
    id: 'male-white-shirt-tie',
    group: 'Nam',
    label: 'Sơ mi trắng + cà vạt',
    description: 'Không vest, vẫn đủ formal',
    prompt: 'A crisp white dress shirt with a neatly tied dark solid-color necktie, no jacket, formal professional Vietnamese portrait style.',
  },
  {
    id: 'female-white-blouse',
    group: 'Nữ',
    label: 'Sơ mi trắng',
    description: 'Gọn gàng, sạch, phù hợp hồ sơ',
    prompt: 'A clean white blouse with a formal collar, professional Vietnamese ID portrait style.',
  },
  {
    id: 'female-white-office-blouse',
    group: 'Nữ',
    label: 'Sơ mi trắng công sở',
    description: 'Form công sở chỉn chu',
    prompt: 'A formal white office blouse with a clean collar and tailored fit, realistic Vietnamese professional portrait style.',
  },
  {
    id: 'female-black-blazer',
    group: 'Nữ',
    label: 'Vest đen',
    description: 'Blazer đen + áo trắng formal',
    prompt: 'A tailored black blazer over a formal white blouse, suitable for a professional Vietnamese profile portrait.',
  },
  {
    id: 'female-navy-blazer',
    group: 'Nữ',
    label: 'Vest xanh navy',
    description: 'Blazer navy lịch sự hiện đại',
    prompt: 'A tailored navy blazer over a clean white blouse, realistic Vietnamese office ID portrait style.',
  },
  {
    id: 'female-beige-blazer',
    group: 'Nữ',
    label: 'Vest be công sở',
    description: 'Tông sáng, chuyên nghiệp',
    prompt: 'A tailored beige office blazer layered over a white formal blouse, clean and realistic Vietnamese corporate portrait style.',
  },
  {
    id: 'female-pastel-blue-blouse',
    group: 'Nữ',
    label: 'Sơ mi xanh pastel',
    description: 'Nhẹ nhàng, chuyên nghiệp',
    prompt: 'A light pastel blue formal blouse with a clean collar and professional office styling, realistic Vietnamese portrait look.',
  },
  {
    id: 'female-white-aodai',
    group: 'Nữ',
    label: 'Áo dài trắng',
    description: 'Trang trọng, thanh lịch',
    prompt: 'A formal white Vietnamese Ao Dai with elegant clean lines, suitable for a realistic identification portrait.',
  },
  {
    id: 'female-blue-aodai',
    group: 'Nữ',
    label: 'Áo dài xanh',
    description: 'Áo dài xanh lịch sự',
    prompt: 'A formal blue Vietnamese Ao Dai with elegant clean lines, suitable for a realistic identification portrait.',
  },
  {
    id: 'female-ivory-aodai',
    group: 'Nữ',
    label: 'Áo dài kem',
    description: 'Tông kem nhã, mềm và sang',
    prompt: 'A formal ivory Vietnamese Ao Dai with elegant clean lines and realistic silk-like fabric behavior, suitable for a professional identification portrait.',
  },
  {
    id: 'neutral-formal-white-shirt',
    group: 'Trung tính',
    label: 'Sơ mi trắng formal',
    description: 'Trung tính, dùng cho nhiều trường hợp',
    prompt: 'A clean white formal collared shirt with professional neutral styling, realistic studio portrait suitable for Vietnamese ID or profile use.',
  },
  {
    id: 'neutral-dark-blazer',
    group: 'Trung tính',
    label: 'Blazer tối màu',
    description: 'Tối giản, chuyên nghiệp, trung tính',
    prompt: 'A dark charcoal formal blazer over a crisp light shirt, neutral professional styling, realistic Vietnamese office portrait look.',
  },
];

const CLOTHING_PRESET_GROUPS: ClothingPresetGroup[] = ['Nam', 'Nữ', 'Trung tính'];

const ASPECT_RATIO_OPTIONS: Array<{ id: IdPhotoAspectRatio; label: string; desc: string }> = [
  { id: '3:4', label: '3:4', desc: 'Ảnh thẻ dọc phổ biến' },
  { id: '4:3', label: '4:3', desc: 'Khung ngang cân đối' },
  { id: '4:6', label: '4:6', desc: 'Khung dọc dài' },
  { id: '6:4', label: '6:4', desc: 'Khung ngang dài' },
  { id: '2:3', label: '2:3', desc: 'Dáng dọc cổ điển' },
  { id: '3:2', label: '3:2', desc: 'Dáng ngang cổ điển' },
  { id: '1:1', label: '1:1', desc: 'Khung vuông' },
];

const BACKGROUND_OPTIONS: Array<{ id: IdPhotoBackgroundMode; label: string; desc: string }> = [
  { id: 'white', label: 'Trắng', desc: 'Chuẩn ảnh hồ sơ sáng sạch' },
  { id: 'blue', label: 'Xanh', desc: 'Nền xanh ảnh thẻ phổ biến' },
  { id: 'gray', label: 'Xám nhạt', desc: 'Studio trung tính' },
  { id: 'custom', label: 'Tùy chỉnh', desc: 'Tự mô tả nền mong muốn' },
];

const GAZE_OPTIONS: Array<{ id: IdPhotoGaze; label: string; desc: string }> = [
  { id: 'look_straight', label: 'Nhìn thẳng camera', desc: 'Ưu tiên cho ảnh hồ sơ' },
  { id: 'slight_frontal_adjust', label: 'Xoay nhẹ chính diện', desc: 'Sửa góc mặt nhẹ' },
  { id: 'keep', label: 'Giữ nguyên', desc: 'Không ép chỉnh góc nhìn' },
];

const EXPRESSION_OPTIONS: Array<{ id: IdPhotoExpression; label: string; desc: string }> = [
  { id: 'neutral', label: 'Trung tính', desc: 'Chuẩn ảnh hồ sơ' },
  { id: 'soft_smile', label: 'Mỉm nhẹ', desc: 'Lịch sự tự nhiên' },
  { id: 'serious', label: 'Nghiêm túc', desc: 'Trang trọng hơn' },
  { id: 'keep', label: 'Giữ nguyên', desc: 'Không ép đổi biểu cảm' },
];

const POSE_OPTIONS: Array<{ id: IdPhotoPose; label: string; desc: string; group: PosePresetGroup }> = [
  { id: 'standard_id', label: 'Chuẩn ảnh thẻ', desc: 'Cân vai, đầu thẳng', group: 'Chuẩn ảnh thẻ' as PosePresetGroup },
  { id: 'straighten_head', label: 'Chỉnh đầu thẳng', desc: 'Sửa nghiêng đầu nhẹ', group: 'Chuẩn ảnh thẻ' as PosePresetGroup },
  { id: 'level_shoulders', label: 'Cân vai', desc: 'Sửa vai lệch', group: 'Chuẩn ảnh thẻ' as PosePresetGroup },
  { id: 'male_formal_angle_15', label: 'Nghiêng 10-15° lịch sự', desc: 'Dáng nam công sở, hơi xoay nhẹ', group: 'Nam' as PosePresetGroup },
  { id: 'male_three_quarter_soft', label: '3/4 nhẹ trang trọng', desc: 'Góc nghiêng nam nhẹ, chuyên nghiệp', group: 'Nam' as PosePresetGroup },
  { id: 'female_formal_angle_15', label: 'Nghiêng 10-15° thanh lịch', desc: 'Dáng nữ lịch thiệp, rất nhẹ', group: 'Nữ' as PosePresetGroup },
  { id: 'female_three_quarter_soft', label: '3/4 nhẹ thanh lịch', desc: 'Nghiêng nữ nhẹ, studio chuyên nghiệp', group: 'Nữ' as PosePresetGroup },
  { id: 'female_soft_shoulder_angle', label: 'Vai nghiêng mềm', desc: 'Vai nghiêng nhẹ, đầu vẫn trang trọng', group: 'Nữ' as PosePresetGroup },
  { id: 'neutral_formal_angle_15', label: 'Nghiêng nhẹ chuyên nghiệp', desc: 'Góc nghiêng trung tính 10-15°', group: 'Trung tính' as PosePresetGroup },
  { id: 'neutral_three_quarter_soft', label: '3/4 nhẹ trung tính', desc: 'Trang trọng, không thiên nam/nữ', group: 'Trung tính' as PosePresetGroup },
  { id: 'keep', label: 'Giữ nguyên', desc: 'Không ép chỉnh tư thế', group: 'Chuẩn ảnh thẻ' as PosePresetGroup },
];

const POSE_GROUPS: PosePresetGroup[] = ['Chuẩn ảnh thẻ', 'Nam', 'Nữ', 'Trung tính'];

const CROP_OPTIONS: Array<{ id: IdPhotoCrop; label: string; desc: string }> = [
  { id: 'auto_id', label: 'Tự động ảnh thẻ', desc: 'Canh đầu vai chuẩn ID' },
  { id: 'head_shoulders', label: 'Đầu vai', desc: 'Cận hơn, tập trung khuôn mặt' },
  { id: 'half_body', label: 'Nửa người', desc: 'Thoáng hơn nếu cần hồ sơ' },
];

const DEFAULT_ID_OPTIONS: IdPhotoOptions = {
  model: 'gemini-3-pro-image-preview',
  aspectRatio: '3:4',
  cropStyle: 'auto_id',
  backgroundMode: 'white',
  backgroundCustomPrompt: null,
  replaceClothing: false,
  clothingPrompt: null,
  gazeDirection: 'look_straight',
  expressionPreset: 'neutral',
  poseCorrection: 'standard_id',
  additionalInstructions: null,
};

export default function IdPhoto() {
  const {
    isProcessing,
    status,
    error,
    setError,
    restoreIdPhoto,
    resetState,
  } = useGeminiPipeline();

  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('none');
  const [options, setOptions] = useState<IdPhotoOptions>(DEFAULT_ID_OPTIONS);
  const [clothingPreset, setClothingPreset] = useState('male-white-shirt');
  const [customClothing, setCustomClothing] = useState('');
  const [isApiDialogOpen, setIsApiDialogOpen] = useState(false);
  const { hasApiKey, refresh } = useApiKeyStatus();

  const updateOptions = (patch: Partial<IdPhotoOptions>) => {
    setOptions((current) => ({ ...current, ...patch }));
  };

  const resetWorkspace = () => {
    setOriginalImage(null);
    setResultImage(null);
    setStep('none');
    setOptions(DEFAULT_ID_OPTIONS);
    setClothingPreset('male-white-shirt');
    setCustomClothing('');
    resetState();
  };

  const handleFile = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setError('Dung lượng ảnh tối đa là 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUri = event.target?.result as string;
      setOriginalImage(dataUri);
      setResultImage(null);
      setError(null);
      resetState();
      setOptions(DEFAULT_ID_OPTIONS);
      setClothingPreset('male-white-shirt');
      setCustomClothing('');
      setStep('format');
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

  const startGenerate = async () => {
    if (!originalImage) return;
    setStep('processing');

    const selectedClothingPreset = CLOTHING_PRESETS.find((item) => item.id === clothingPreset);
    const clothingPrompt = options.replaceClothing
      ? (clothingPreset === 'custom' ? customClothing : selectedClothingPreset?.prompt || '')
      : null;

    try {
      const result = await restoreIdPhoto(originalImage, {
        ...options,
        clothingPrompt,
      });
      setResultImage(result);
      setStep('style');
    } catch (err) {
      if (shouldPromptApiKeyReset(err)) {
        setIsApiDialogOpen(true);
        void refresh();
      }
      setStep('style');
    }
  };

  const downloadImage = () => {
    if (!resultImage) return;
    const link = document.createElement('a');
    link.href = resultImage;
    link.download = `QUANGTHOAI_ID_PHOTO_2K_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeStep = step === 'processing' ? 'style' : step;
  const stepOrder: Step[] = ['format', 'subject', 'style'];
  const activeStepIndex = Math.max(stepOrder.indexOf(activeStep), 0);

  const renderStepSection = (
    sectionStep: Step,
    sectionNumber: string,
    title: string,
    description: string,
    content: React.ReactNode,
    isLocked = false,
  ) => {
    const isOpen = activeStep === sectionStep;
    const isCompleted = activeStepIndex > stepOrder.indexOf(sectionStep);

    return (
      <div className={`rounded-2xl border transition-all ${isOpen ? 'border-fuchsia-500/40 bg-fuchsia-500/[0.06]' : 'border-white/10 bg-white/[0.03]'}`}>
        <button
          type="button"
          disabled={isLocked}
          onClick={() => !isLocked && setStep(sectionStep)}
          className={`flex w-full items-start gap-3 px-4 py-4 text-left ${isLocked ? 'cursor-not-allowed opacity-45' : ''}`}
        >
          <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl border text-xs font-black ${isCompleted ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300' : isOpen ? 'border-fuchsia-500/30 bg-fuchsia-500/15 text-fuchsia-300' : 'border-white/10 bg-white/[0.03] text-white/55'}`}>
            {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : sectionNumber}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">{title}</p>
                <p className="mt-1 text-[11px] text-white/40">{description}</p>
              </div>
              <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? 'rotate-90 text-fuchsia-300' : 'text-white/25'}`} />
            </div>
          </div>
        </button>

        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="border-t border-white/10 px-4 pb-4 pt-2">{content}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden overflow-y-auto bg-[#050505] font-sans text-white selection:bg-fuchsia-500/30 lg:h-screen lg:w-screen lg:overflow-hidden">
      <div className="pointer-events-none fixed left-[-10%] top-[-20%] h-[50%] w-[50%] rounded-full bg-fuchsia-600/5 blur-[150px]" />
      <div className="pointer-events-none fixed bottom-[-20%] right-[-10%] h-[50%] w-[50%] rounded-full bg-cyan-600/5 blur-[150px]" />

      <header className="absolute left-0 right-0 top-0 z-30 flex items-center justify-between p-4 md:p-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="rounded-xl border border-white/10 bg-white/5 p-2 transition-colors hover:bg-white/10">
            <ArrowLeft className="h-4 w-4 text-white" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-cyan-600 shadow-lg shadow-fuchsia-500/20">
              <ScanFace className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight md:text-base">QUANGTHOAI RESTORE</h1>
              <p className="text-[9px] uppercase tracking-widest text-white/30">ID Photo Workspace</p>
            </div>
          </div>
        </div>

        <button onClick={() => setIsApiDialogOpen(true)} className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${hasApiKey ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'animate-pulse border-amber-500/20 bg-amber-500/10 text-amber-400'}`}>
          {hasApiKey ? <ShieldCheck className="h-3.5 w-3.5" /> : <Key className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{hasApiKey ? 'API Connected' : 'Chọn API Key'}</span>
        </button>
      </header>

      <main className="w-full lg:h-full" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
        <AnimatePresence mode="wait">
          {!originalImage ? (
            <motion.div key="upload" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="flex h-full items-center justify-center p-4 pt-20 md:pt-24">
              <div className="group relative mx-4 flex aspect-video w-full max-w-xl cursor-pointer flex-col items-center justify-center gap-6 rounded-3xl border-2 border-dashed border-white/10 bg-white/[0.02] transition-all duration-500 hover:border-fuchsia-500/40 hover:bg-fuchsia-500/[0.02]" onClick={() => document.getElementById('id-photo-file-input')?.click()}>
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/5 transition-all duration-500 group-hover:scale-110 group-hover:bg-fuchsia-500/10"><Upload className="h-8 w-8 text-white/30 transition-colors group-hover:text-fuchsia-400" /></div>
                <div className="px-4 text-center"><p className="text-lg font-medium text-white/80">Tải ảnh để tạo ID Photo</p><p className="mt-1 text-sm text-white/30">Ảnh chân dung rõ mặt, JPG/PNG/WEBP (Tối đa 10MB)</p></div>
                <label className="cursor-pointer rounded-full bg-white px-8 py-3 text-sm font-semibold text-black shadow-lg transition-colors hover:bg-fuchsia-50" onClick={(e) => e.stopPropagation()}>
                  Chọn từ máy tính
                  <input id="id-photo-file-input" type="file" className="hidden" accept="image/*" onChange={onFileChange} />
                </label>
              </div>
            </motion.div>
          ) : (
            <motion.div key="workspace" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full p-4 pb-24 pt-20 md:p-8 md:pb-10 md:pt-24 lg:h-full">
              <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 lg:h-full lg:flex-row">
                <div className="relative h-[350px] flex-1 overflow-hidden rounded-2xl border border-white/10 bg-black/40 lg:h-full lg:min-h-0">
                  {resultImage ? (
                    <div className="absolute inset-0"><ImageSlider before={originalImage} after={resultImage} beforeLabel="GOC" afterLabel="ID PHOTO" /></div>
                  ) : (
                    <div className="relative flex h-full w-full items-center justify-center">
                      <img src={originalImage} alt="ID Preview" className="max-h-full max-w-full object-contain" referrerPolicy="no-referrer" />
                      {isProcessing && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-black/60 backdrop-blur-sm">
                          <div className="relative h-20 w-20">
                            <div className="absolute inset-0 rounded-full border-4 border-fuchsia-500/20" />
                            <motion.div className="absolute inset-0 rounded-full border-4 border-t-fuchsia-500" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
                            <div className="absolute inset-0 flex items-center justify-center"><Sparkles className="h-8 w-8 text-fuchsia-400" /></div>
                          </div>
                          <div className="space-y-3 px-8 text-center"><p className="text-lg font-bold tracking-wide text-white">{status.step}</p><div className="h-1.5 w-64 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full bg-gradient-to-r from-fuchsia-500 to-cyan-500" initial={{ width: 0 }} animate={{ width: `${status.progress}%` }} /></div></div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <aside className="w-full shrink-0 lg:w-[420px]">
                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl lg:h-full lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
                    <div className="sticky top-0 z-10 border-b border-white/10 bg-[#050505]/90 px-4 py-4 backdrop-blur-xl">
                      <p className="text-xs font-black uppercase tracking-[0.25em] text-fuchsia-300/80">ID Photo Flow</p>
                      <h2 className="mt-2 text-lg font-bold text-white">Thiết lập ảnh thẻ</h2>
                      <p className="mt-1 text-xs text-white/40">Ưu tiên giữ đúng khuôn mặt, chỉ chỉnh nhẹ để đạt bố cục ảnh hồ sơ chuẩn.</p>
                    </div>

                    <div className="space-y-3 p-4">
                      {renderStepSection('format', '1', 'Khung hình & nền', 'Chọn tỷ lệ ảnh, kiểu crop và nền đầu ra.', (
                        <div className="space-y-5">
                          <div>
                            <p className="mb-2 text-[10px] uppercase tracking-wider text-white/30">Tỷ lệ ảnh xuất</p>
                            <div className="grid grid-cols-3 gap-2">
                              {ASPECT_RATIO_OPTIONS.map((item) => (
                                <button key={item.id} onClick={() => updateOptions({ aspectRatio: item.id })} className={`rounded-2xl border p-3 text-left transition-all ${options.aspectRatio === item.id ? 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300' : 'border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]'}`}><span className="block text-sm font-black">{item.label}</span><span className="mt-1 block text-[10px] text-white/35">{item.desc}</span></button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="mb-2 text-[10px] uppercase tracking-wider text-white/30">Kiểu crop</p>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                              {CROP_OPTIONS.map((item) => (
                                <button key={item.id} onClick={() => updateOptions({ cropStyle: item.id })} className={`rounded-2xl border p-3 text-left transition-all ${options.cropStyle === item.id ? 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300' : 'border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]'}`}><div className="flex items-start gap-3"><Crop className={`mt-0.5 h-4 w-4 ${options.cropStyle === item.id ? 'text-fuchsia-300' : 'text-white/30'}`} /><div><p className="text-xs font-bold">{item.label}</p><p className="mt-1 text-[10px] text-white/35">{item.desc}</p></div></div></button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="mb-2 text-[10px] uppercase tracking-wider text-white/30">Nền background</p>
                            <div className="grid grid-cols-2 gap-2">
                              {BACKGROUND_OPTIONS.map((item) => (
                                <button key={item.id} onClick={() => updateOptions({ backgroundMode: item.id })} className={`rounded-2xl border p-3 text-left transition-all ${options.backgroundMode === item.id ? 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300' : 'border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]'}`}><div className="flex items-start gap-3"><ImageIcon className={`mt-0.5 h-4 w-4 ${options.backgroundMode === item.id ? 'text-fuchsia-300' : 'text-white/30'}`} /><div><p className="text-xs font-bold">{item.label}</p><p className="mt-1 text-[10px] text-white/35">{item.desc}</p></div></div></button>
                              ))}
                            </div>
                            {options.backgroundMode === 'custom' && <textarea value={options.backgroundCustomPrompt ?? ''} onChange={(e) => updateOptions({ backgroundCustomPrompt: e.target.value.trim() ? e.target.value : null })} rows={3} placeholder="Ví dụ: Nền trắng ngà sạch, studio mềm, không đổ bóng..." className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none" />}
                          </div>

                          <button onClick={() => setStep('subject')} className="w-full rounded-2xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 py-3 text-sm font-bold text-white transition-all hover:from-fuchsia-500 hover:to-cyan-500">Tiếp tục sang bước 2</button>
                        </div>
                      ))}

                      {renderStepSection('subject', '2', 'Khuôn mặt & tư thế', 'Chuẩn hóa nhẹ hướng nhìn, biểu cảm và tư thế chụp.', (
                        <div className="space-y-5">
                          <div>
                            <p className="mb-2 text-[10px] uppercase tracking-wider text-white/30">Hướng nhìn</p>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                              {GAZE_OPTIONS.map((item) => (
                                <button key={item.id} onClick={() => updateOptions({ gazeDirection: item.id })} className={`rounded-2xl border p-3 text-left transition-all ${options.gazeDirection === item.id ? 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300' : 'border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]'}`}><p className="text-xs font-bold">{item.label}</p><p className="mt-1 text-[10px] text-white/35">{item.desc}</p></button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="mb-2 text-[10px] uppercase tracking-wider text-white/30">Biểu cảm</p>
                            <div className="grid grid-cols-2 gap-2">
                              {EXPRESSION_OPTIONS.map((item) => (
                                <button key={item.id} onClick={() => updateOptions({ expressionPreset: item.id })} className={`rounded-2xl border p-3 text-left transition-all ${options.expressionPreset === item.id ? 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300' : 'border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]'}`}><p className="text-xs font-bold">{item.label}</p><p className="mt-1 text-[10px] text-white/35">{item.desc}</p></button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="mb-2 text-[10px] uppercase tracking-wider text-white/30">Tư thế</p>
                            <div className="space-y-3">
                              {POSE_GROUPS.map((group) => {
                                const items = POSE_OPTIONS.filter((item) => item.group === group);
                                return (
                                  <div key={group} className="space-y-2">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">{group}</p>
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                      {items.map((item) => (
                                        <button key={item.id} onClick={() => updateOptions({ poseCorrection: item.id })} className={`rounded-2xl border p-3 text-left transition-all ${options.poseCorrection === item.id ? 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300' : 'border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]'}`}><p className="text-xs font-bold">{item.label}</p><p className="mt-1 text-[10px] text-white/35">{item.desc}</p></button>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.05] p-4 text-xs text-amber-100/75">Hệ thống chỉ nên chỉnh nhẹ hướng nhìn, biểu cảm và tư thế. Ưu tiên lớn nhất luôn là giữ lại khuôn mặt gốc để không thành người khác.</div>

                          <button onClick={() => setStep('style')} className="w-full rounded-2xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 py-3 text-sm font-bold text-white transition-all hover:from-fuchsia-500 hover:to-cyan-500">Tiếp tục sang bước 3</button>
                        </div>
                      ), activeStepIndex < 1)}

                      {renderStepSection('style', '3', 'Trang phục & tạo ảnh', 'Chọn model, thay trang phục và thêm ghi chú bổ sung.', (
                        <div className="space-y-5">
                          <div>
                            <p className="mb-2 text-[10px] uppercase tracking-wider text-white/30">Model</p>
                            <div className="space-y-2">
                              <button onClick={() => updateOptions({ model: 'gemini-3.1-flash-image-preview' })} className={`w-full rounded-2xl border p-4 text-left transition-all ${options.model === 'gemini-3.1-flash-image-preview' ? 'border-fuchsia-500/40 bg-fuchsia-500/10 ring-1 ring-fuchsia-500/20' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'}`}><p className="text-sm font-bold">Gemini 3.1 Flash Image</p><p className="mt-1 text-xs text-white/40">Nhanh hơn, phù hợp khi cần thao tác nhiều lần.</p></button>
                              <button onClick={() => updateOptions({ model: 'gemini-3-pro-image-preview' })} className={`w-full rounded-2xl border p-4 text-left transition-all ${options.model === 'gemini-3-pro-image-preview' ? 'border-cyan-500/40 bg-cyan-500/10 ring-1 ring-cyan-500/20' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'}`}><p className="text-sm font-bold">Gemini 3 Pro Image</p><p className="mt-1 text-xs text-white/40">Ổn định hơn cho ảnh khó và chỉnh sửa khuôn mặt tinh tế.</p></button>
                            </div>
                          </div>

                          <button onClick={() => updateOptions({ replaceClothing: !options.replaceClothing })} className={`w-full rounded-2xl border p-4 transition-all ${options.replaceClothing ? 'border-fuchsia-500/30 bg-fuchsia-500/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'}`}><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3 text-left"><Shirt className={`h-5 w-5 ${options.replaceClothing ? 'text-fuchsia-400' : 'text-white/30'}`} /><div><p className="text-sm font-bold">Thay trang phục</p><p className="text-[10px] text-white/40">Preset phù hợp ảnh hồ sơ người Việt</p></div></div><div className={`relative h-5 w-10 rounded-full ${options.replaceClothing ? 'bg-fuchsia-500' : 'bg-white/10'}`}><motion.div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white" animate={{ x: options.replaceClothing ? 20 : 0 }} /></div></div></button>

                          <AnimatePresence>
                            {options.replaceClothing && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                <div className="space-y-2 rounded-2xl border border-fuchsia-500/15 bg-fuchsia-500/[0.04] p-3">
                                  {CLOTHING_PRESET_GROUPS.map((group) => {
                                    const items = CLOTHING_PRESETS.filter((item) => item.group === group);
                                    return (
                                      <div key={group} className="space-y-2">
                                        <p className="px-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/35">{group}</p>
                                        <div className="grid grid-cols-1 gap-2">
                                          {items.map((item) => (
                                            <button key={item.id} onClick={() => setClothingPreset(item.id)} className={`rounded-xl border px-3 py-3 text-left transition-all ${clothingPreset === item.id ? 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300' : 'border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/[0.06]'}`}>
                                              <p className="text-xs font-semibold">{item.label}</p>
                                              <p className="mt-1 text-[10px] text-white/35">{item.description}</p>
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}
                                  <div className="space-y-2 pt-1">
                                    <p className="px-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/35">Tùy chỉnh</p>
                                    <button onClick={() => setClothingPreset('custom')} className={`w-full rounded-xl border px-3 py-3 text-left transition-all ${clothingPreset === 'custom' ? 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300' : 'border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/[0.06]'}`}><p className="text-xs font-semibold">Tự mô tả trang phục</p><p className="mt-1 text-[10px] text-white/35">Dùng khi preset chưa đủ đúng nhu cầu</p></button>
                                    {clothingPreset === 'custom' && <input type="text" value={customClothing} onChange={(e) => setCustomClothing(e.target.value)} placeholder="Ví dụ: Sơ mi trắng có cổ đứng, vest xanh navy lịch sự..." className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white placeholder:text-white/20 focus:outline-none" />}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <label className="block text-xs text-white/60">
                            Ghi chú bổ sung
                            <textarea value={options.additionalInstructions ?? ''} onChange={(e) => updateOptions({ additionalInstructions: e.target.value.trim() ? e.target.value : null })} rows={4} placeholder="Ví dụ: Giữ đường nét khuôn mặt thật tối đa, chỉ chỉnh nhẹ để đầu thẳng hơn và ánh mắt nhìn chính diện..." className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none" />
                            <p className="mt-2 text-[11px] text-white/35">Prompt sẽ ưu tiên lớn nhất là giữ khuôn mặt giống người thật, tránh đổi nét mặt thành người khác.</p>
                          </label>

                          <button onClick={startGenerate} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 py-3.5 text-sm font-bold text-white transition-all hover:from-fuchsia-500 hover:to-cyan-500"><Sparkles className="h-4 w-4" />{isProcessing ? 'Đang tạo ID Photo...' : 'Bắt đầu tạo ID Photo'}</button>
                        </div>
                      ), activeStepIndex < 2)}

                      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 lg:sticky lg:bottom-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/35">Quick Actions</p>
                        <div className="mt-3 space-y-3">
                          <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-white/60">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2"><CheckCircle2 className={`h-4 w-4 ${resultImage ? 'text-fuchsia-300' : 'text-white/25'}`} /><span>{resultImage ? 'Đã có ảnh ID để tải xuống' : 'Chưa có ảnh ID'}</span></div>
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${resultImage ? 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300' : 'border-white/10 bg-white/[0.03] text-white/35'}`}>2K {resultImage ? 'Ready' : 'Pending'}</span>
                            </div>
                          </div>

                          <button onClick={resetWorkspace} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-bold text-white/80 transition-all hover:bg-white/[0.06] hover:text-white"><RefreshCw className="h-4 w-4" />Chọn ảnh khác</button>

                          {resultImage && <button onClick={downloadImage} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-black shadow-lg transition-all hover:bg-fuchsia-50"><Download className="h-4 w-4 text-fuchsia-600" />Tải ảnh ID Photo (2K)</button>}
                        </div>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed bottom-6 left-1/2 z-50 flex max-w-md -translate-x-1/2 items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 backdrop-blur-xl"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" /><p className="text-sm text-red-200/80">{error}</p></motion.div>
        )}
      </AnimatePresence>
      <ApiKeyDialog
        isOpen={isApiDialogOpen}
        hasApiKey={hasApiKey}
        onClose={() => setIsApiDialogOpen(false)}
        onSaved={refresh}
      />
    </div>
  );
}
