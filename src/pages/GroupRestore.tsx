import React, { useState } from 'react';
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
  Users,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageSlider } from '../components/ImageSlider';
import { Link } from 'react-router-dom';
import {
  useGeminiPipeline,
  DEFAULT_ANALYSIS,
  ModelType,
  AnalysisResult,
  RestoreOptions,
} from '../hooks/useGeminiPipeline';
import { useApiKeyStatus } from '../hooks/useApiKeyStatus';
import { ApiKeyDialog } from '../components/ApiKeyDialog';

type Step = 'none' | 'analysis' | 'model' | 'options' | 'processing';

const DAMAGE_TYPE_OPTIONS: AnalysisResult['damage_types'] = [
  'scratch',
  'tear',
  'mold',
  'crease',
  'water_damage',
  'blur_motion',
  'blur_focus',
  'fade',
  'color_shift',
  'grain_heavy',
  'overexposed',
  'underexposed',
];

const DAMAGE_TYPE_LABELS: Record<AnalysisResult['damage_types'][number], string> = {
  scratch: 'Trầy xước',
  tear: 'Rách ảnh',
  mold: 'Mốc / ố nấm',
  crease: 'Nếp gấp',
  water_damage: 'Hư hại do nước',
  blur_motion: 'Nhòe do rung',
  blur_focus: 'Mất nét',
  fade: 'Bạc màu',
  color_shift: 'Lệch màu',
  grain_heavy: 'Nhiễu hạt nặng',
  overexposed: 'Cháy sáng',
  underexposed: 'Thiếu sáng',
};

const DEFAULT_GROUP_ANALYSIS: AnalysisResult = {
  ...DEFAULT_ANALYSIS,
  photo_type: 'portrait_group',
  subject_count: 1,
  face_sizes: 'small',
  background_complexity: 'complex',
  background_importance: 'high',
  requires_group_restore: true,
  recommended_model: 'gemini_pro',
};

export default function GroupRestore() {
  const {
    isProcessing,
    status,
    error,
    setError,
    analysis,
    setManualAnalysis,
    restoreImage,
    resetState,
  } = useGeminiPipeline();

  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [restoredImage, setRestoredImage] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('none');
  const [manualAnalysis, setManualAnalysisState] = useState<AnalysisResult>(DEFAULT_GROUP_ANALYSIS);
  const [isApiDialogOpen, setIsApiDialogOpen] = useState(false);

  const [selectedModel, setSelectedModel] = useState<ModelType>('gemini-3-pro-image-preview');
  const [colorize, setColorize] = useState(false);
  const [subjectCountInput, setSubjectCountInput] = useState(String(DEFAULT_GROUP_ANALYSIS.subject_count));
  const { hasApiKey, refresh } = useApiKeyStatus();

  const syncAnalysis = (next: AnalysisResult) => {
    setManualAnalysisState(next);
    setManualAnalysis(next);
  };

  const updateAnalysis = (patch: Partial<AnalysisResult>) => {
    syncAnalysis({ ...manualAnalysis, ...patch });
  };

  const toggleDamageType = (damageType: AnalysisResult['damage_types'][number]) => {
    const exists = manualAnalysis.damage_types.includes(damageType);
    updateAnalysis({
      damage_types: exists
        ? manualAnalysis.damage_types.filter((item) => item !== damageType)
        : [...manualAnalysis.damage_types, damageType],
    });
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
      setRestoredImage(null);
      setError(null);
      resetState();
      syncAnalysis(DEFAULT_GROUP_ANALYSIS);
      setSubjectCountInput(String(DEFAULT_GROUP_ANALYSIS.subject_count));
      setColorize(false);
      setSelectedModel('gemini-3-pro-image-preview');
      setStep('analysis');
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
    setStep('processing');

    const options: RestoreOptions = {
      model: selectedModel,
      colorize,
      replaceClothing: false,
      clothingPrompt: '',
    };

    try {
      const result = await restoreImage(originalImage, analysis, options);
      setRestoredImage(result);
      setStep('options');
    } catch {
      setStep('options');
    }
  };

  const downloadGeminiImage = () => {
    if (!restoredImage) return;
    const link = document.createElement('a');
    link.href = restoredImage;
    link.download = `QUANGTHOAI_GROUP_2K_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetAll = () => {
    setOriginalImage(null);
    setRestoredImage(null);
    setStep('none');
    setColorize(false);
    setSubjectCountInput(String(DEFAULT_GROUP_ANALYSIS.subject_count));
    setSelectedModel('gemini-3-pro-image-preview');
    setManualAnalysisState(DEFAULT_GROUP_ANALYSIS);
    resetState();
  };

  const handleSubjectCountChange = (value: string) => {
    const digitsOnly = value.replace(/\D/g, '');
    setSubjectCountInput(digitsOnly);

    if (!digitsOnly) {
      return;
    }

    updateAnalysis({ subject_count: Math.max(1, Math.min(20, Number(digitsOnly))) });
  };

  const commitSubjectCount = () => {
    const normalized = Math.max(1, Math.min(20, Number(subjectCountInput) || 1));
    setSubjectCountInput(String(normalized));
    updateAnalysis({ subject_count: normalized });
  };

  const activeStep = step === 'processing' ? 'options' : step;
  const stepOrder: Step[] = ['analysis', 'model', 'options'];
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
      <div className={`rounded-2xl border transition-all ${isOpen ? 'border-emerald-500/40 bg-emerald-500/[0.06]' : 'border-white/10 bg-white/[0.03]'}`}>
        <button
          type="button"
          disabled={isLocked}
          onClick={() => !isLocked && setStep(sectionStep)}
          className={`flex w-full items-start gap-3 px-4 py-4 text-left ${isLocked ? 'cursor-not-allowed opacity-45' : ''}`}
        >
          <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl border text-xs font-black ${isCompleted ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300' : isOpen ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300' : 'border-white/10 bg-white/[0.03] text-white/55'}`}>
            {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : sectionNumber}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">{title}</p>
                <p className="mt-1 text-[11px] text-white/40">{description}</p>
              </div>
              <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? 'rotate-90 text-emerald-300' : 'text-white/25'}`} />
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
    <div className="relative min-h-screen w-full overflow-x-hidden overflow-y-auto bg-[#050505] font-sans text-white selection:bg-emerald-500/30 lg:h-screen lg:w-screen lg:overflow-hidden">
      <div className="pointer-events-none fixed right-[-10%] top-[-20%] h-[50%] w-[50%] rounded-full bg-emerald-600/5 blur-[150px]" />
      <div className="pointer-events-none fixed bottom-[-20%] left-[-10%] h-[50%] w-[50%] rounded-full bg-teal-600/5 blur-[150px]" />

      <header className="absolute left-0 right-0 top-0 z-30 flex items-center justify-between p-4 md:p-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="rounded-xl border border-white/10 bg-white/5 p-2 transition-colors hover:bg-white/10"><ArrowLeft className="h-4 w-4 text-white" /></Link>
          <div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20"><Users className="h-4 w-4 text-white" /></div><div><h1 className="text-sm font-bold tracking-tight md:text-base">QUANGTHOAI RESTORE</h1><p className="text-[9px] uppercase tracking-widest text-white/30">Phục hồi Ảnh Cảnh Có Người</p></div></div>
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
              <div className="group relative mx-4 flex aspect-video w-full max-w-xl cursor-pointer flex-col items-center justify-center gap-6 rounded-3xl border-2 border-dashed border-white/10 bg-white/[0.02] transition-all duration-500 hover:border-emerald-500/40 hover:bg-emerald-500/[0.02]" onClick={() => document.getElementById('group-file-input')?.click()}>
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/5 transition-all duration-500 group-hover:scale-110 group-hover:bg-emerald-500/10"><Upload className="h-8 w-8 text-white/30 transition-colors group-hover:text-emerald-400" /></div>
                <div className="px-4 text-center"><p className="text-lg font-medium text-white/80">Kéo thả ảnh cảnh có người vào đây</p><p className="mt-1 text-sm text-white/30">Ảnh toàn thân, gia đình, nội thất có người (Tối đa 10MB)</p></div>
                <label className="cursor-pointer rounded-full bg-white px-8 py-3 text-sm font-semibold text-black shadow-lg transition-colors hover:bg-emerald-50" onClick={(e) => e.stopPropagation()}>Chọn từ máy tính<input id="group-file-input" type="file" className="hidden" accept="image/*" onChange={onFileChange} /></label>
              </div>
            </motion.div>
          ) : (
            <motion.div key="workspace" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full p-4 pb-24 pt-20 md:p-8 md:pb-10 md:pt-24 lg:h-full">
              <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 lg:h-full lg:flex-row">
                <div className="relative min-h-[320px] flex-1 overflow-hidden rounded-2xl border border-white/10 bg-black/40 lg:min-h-0">
                  {restoredImage ? (
                    <div className="flex h-full w-full items-center justify-center"><ImageSlider before={originalImage} after={restoredImage} beforeLabel="GOC" afterLabel="PHUC HOI" /></div>
                  ) : (
                    <div className="relative flex h-full w-full items-center justify-center">
                      <img src={originalImage} alt="Original" className="max-h-full max-w-full object-contain" />
                      {isProcessing && <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-black/60 backdrop-blur-sm"><div className="relative h-20 w-20"><div className="absolute inset-0 rounded-full border-4 border-emerald-500/20" /><motion.div className="absolute inset-0 rounded-full border-4 border-t-emerald-500" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} /><Sparkles className="absolute inset-0 m-auto h-8 w-8 text-emerald-400" /></div><div className="space-y-3 px-8 text-center"><p className="text-lg font-bold">{status.step}</p><div className="h-1.5 w-64 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500" initial={{ width: 0 }} animate={{ width: `${status.progress}%` }} /></div></div></div>}
                    </div>
                  )}
                </div>

                <aside className="w-full shrink-0 lg:w-[390px]"><div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl lg:h-full lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto"><div className="sticky top-0 z-10 border-b border-white/10 bg-[#050505]/90 px-4 py-4 backdrop-blur-xl"><p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-300/80">Restore Steps</p><h2 className="mt-2 text-lg font-bold text-white">Thiết lập phục hồi</h2><p className="mt-1 text-xs text-white/40">Chỉ dùng Gemini từ Frontend, đã bỏ hoàn toàn Upscale backend.</p></div><div className="space-y-3 p-4">
                  {renderStepSection('analysis', '1', 'Xác nhận thông tin ảnh', 'Chọn metadata thủ công cho ảnh toàn cảnh có người.', analysis && (
                    <div className="space-y-5">
                      <div className="grid grid-cols-2 gap-3">
                        <label className="text-xs text-white/60">Loại ảnh
                          <select value={analysis.photo_type} onChange={(e) => updateAnalysis({ photo_type: e.target.value, requires_group_restore: true })} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none">
                            <option className="text-black" value="indoor_scene">Một người trong không gian trong nhà</option>
                            <option className="text-black" value="outdoor_scene">Một người trong bối cảnh ngoài trời</option>
                            <option className="text-black" value="portrait_group">Nhóm gia đình</option>
                            <option className="text-black" value="portrait_crowd">Đông người</option>
                            <option className="text-black" value="event_photo">Ảnh sự kiện</option>
                            <option className="text-black" value="landscape_with_people">Ngoại cảnh có người</option>
                          </select>
                        </label>
                        <label className="text-xs text-white/60">Số người
                          <input type="text" inputMode="numeric" pattern="[0-9]*" value={subjectCountInput} onChange={(e) => handleSubjectCountChange(e.target.value)} onBlur={commitSubjectCount} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none" />
                        </label>
                        <label className="text-xs text-white/60">Màu ảnh
                          <select value={analysis.is_black_white ? 'bw' : analysis.is_sepia ? 'sepia' : 'color'} onChange={(e) => {
                            const value = e.target.value;
                            updateAnalysis({ is_black_white: value === 'bw', is_sepia: value === 'sepia' });
                            setColorize(value !== 'color');
                          }} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none"><option className="text-black" value="color">Ảnh màu</option><option className="text-black" value="bw">Đen trắng</option><option className="text-black" value="sepia">Sepia</option></select>
                        </label>
                        <label className="text-xs text-white/60">Kích thước mặt
                          <select value={analysis.face_sizes} onChange={(e) => updateAnalysis({ face_sizes: e.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none"><option className="text-black" value="large">Lớn</option><option className="text-black" value="medium">Vừa</option><option className="text-black" value="small">Nhỏ</option></select>
                        </label>
                        <label className="text-xs text-white/60">Mức hư hại
                          <select value={analysis.damage_severity} onChange={(e) => updateAnalysis({ damage_severity: e.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none"><option className="text-black" value="light">Nhẹ</option><option className="text-black" value="moderate">Trung bình</option><option className="text-black" value="heavy">Nặng</option><option className="text-black" value="extreme">Rất nặng</option></select>
                        </label>
                        <label className="text-xs text-white/60">Niên đại ước lượng
                          <input value={analysis.era_estimate} onChange={(e) => updateAnalysis({ era_estimate: e.target.value || 'unknown' })} placeholder="Ví dụ: 1940s, 1960s" className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none" />
                        </label>
                      </div>
                      <div><p className="mb-2 text-[10px] uppercase tracking-wider text-white/30">Loại hư hại</p><div className="flex flex-wrap gap-2">{DAMAGE_TYPE_OPTIONS.map((type) => { const active = analysis.damage_types.includes(type); return <button key={type} onClick={() => toggleDamageType(type)} className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-all ${active ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]'}`}>{DAMAGE_TYPE_LABELS[type]}</button>; })}</div></div>
                      <label className="block text-xs text-white/60">Ghi chú phục hồi bổ sung<textarea value={analysis.special_challenges ?? ''} onChange={(e) => updateAnalysis({ special_challenges: e.target.value.trim() ? e.target.value : null })} placeholder="Ví dụ: Quần áo nhân vật bị mờ hoặc hư hại nặng, hãy tái tạo chất liệu vải; phục hồi chi tiết nội thất, bàn ghế, bối cảnh phía sau..." rows={4} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none" /><p className="mt-2 text-[11px] text-white/35">Nội dung này sẽ được ghép vào system prompt cùng các metadata phía trên.</p></label>
                      <button onClick={() => setStep('model')} className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-sm font-bold text-white transition-all hover:from-emerald-500 hover:to-teal-500">Tiếp tục sang bước 2</button>
                    </div>
                  ))}

                  {renderStepSection('model', '2', 'Chọn Model', 'Ảnh toàn cảnh có người thường nên ưu tiên Pro.', (
                    <div className="space-y-3"><button onClick={() => setSelectedModel('gemini-3.1-flash-image-preview')} className={`w-full rounded-2xl border p-4 text-left transition-all ${selectedModel === 'gemini-3.1-flash-image-preview' ? 'border-emerald-500/40 bg-emerald-500/10 ring-1 ring-emerald-500/20' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'}`}><div className="flex items-start gap-4"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${selectedModel === 'gemini-3.1-flash-image-preview' ? 'bg-emerald-500/20' : 'bg-white/5'}`}><Zap className={`h-5 w-5 ${selectedModel === 'gemini-3.1-flash-image-preview' ? 'text-emerald-400' : 'text-white/30'}`} /></div><div><p className="text-sm font-bold">Gemini 3.1 Flash Image</p><p className="mt-1 text-xs text-white/40">Nhanh hơn, hợp ảnh ít hư hại.</p></div></div></button><button onClick={() => setSelectedModel('gemini-3-pro-image-preview')} className={`w-full rounded-2xl border p-4 text-left transition-all ${selectedModel === 'gemini-3-pro-image-preview' ? 'border-purple-500/40 bg-purple-500/10 ring-1 ring-purple-500/20' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'}`}><div className="flex items-start gap-4"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${selectedModel === 'gemini-3-pro-image-preview' ? 'bg-purple-500/20' : 'bg-white/5'}`}><ShieldCheck className={`h-5 w-5 ${selectedModel === 'gemini-3-pro-image-preview' ? 'text-purple-400' : 'text-white/30'}`} /></div><div><p className="text-sm font-bold">Gemini 3 Pro Image</p><p className="mt-1 text-xs text-white/40">Tái tạo ảnh nhóm tốt hơn.</p></div></div></button><button onClick={() => setStep('options')} className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-sm font-bold text-white transition-all hover:from-emerald-500 hover:to-teal-500">Tiếp tục sang bước 3</button></div>
                  ), activeStepIndex < 1)}

                  {renderStepSection('options', '3', 'Tùy chọn nâng cao', 'Bật lên màu nếu cần và bắt đầu phục hồi.', (
                    <div className="space-y-4"><button onClick={() => setColorize(!colorize)} className={`w-full rounded-2xl border p-4 transition-all ${colorize ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'}`}><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3 text-left"><Palette className={`h-5 w-5 ${colorize ? 'text-emerald-400' : 'text-white/30'}`} /><div><p className="text-sm font-bold">Lên màu AI</p><p className="text-[10px] text-white/40">Tô màu tự nhiên cho ảnh đen trắng / sepia</p></div></div><div className={`relative h-5 w-10 rounded-full ${colorize ? 'bg-emerald-500' : 'bg-white/10'}`}><motion.div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white" animate={{ x: colorize ? 20 : 0 }} /></div></div></button><button onClick={startRestore} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3.5 text-sm font-bold text-white transition-all hover:from-emerald-500 hover:to-teal-500"><Sparkles className="h-4 w-4" />{isProcessing ? 'Đang phục hồi...' : 'Bắt đầu phục hồi'}</button></div>
                  ), activeStepIndex < 2)}

                  <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 lg:sticky lg:bottom-4"><p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/35">Quick Actions</p><div className="mt-3 space-y-3"><div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-white/60"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><CheckCircle2 className={`h-4 w-4 ${restoredImage ? 'text-emerald-300' : 'text-white/25'}`} /><span>{restoredImage ? 'Đã có ảnh Gemini để tải xuống' : 'Chưa có ảnh Gemini'}</span></div><span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${restoredImage ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-white/10 bg-white/[0.03] text-white/35'}`}>Gemini {restoredImage ? 'Ready' : 'Pending'}</span></div></div><button onClick={resetAll} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-bold text-white/80 transition-all hover:bg-white/[0.06] hover:text-white"><RefreshCw className="h-4 w-4" />Chọn ảnh khác</button>{restoredImage && <button onClick={downloadGeminiImage} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-black shadow-lg transition-all hover:bg-emerald-50"><Download className="h-4 w-4 text-emerald-600" />Tải ảnh Gemini (2K)</button>}</div></div>
                </div></div></aside>
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
