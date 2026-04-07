import React, { useEffect, useState } from 'react';
import { KeyRound, LoaderCircle, ShieldCheck, Trash2, X } from 'lucide-react';
import { apiRequest } from '../lib/api';

interface ApiKeyDialogProps {
  isOpen: boolean;
  hasApiKey: boolean;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

export function ApiKeyDialog({ isOpen, hasApiKey, onClose, onSaved }: ApiKeyDialogProps) {
  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setApiKey('');
      setError(null);
      setIsSaving(false);
      setIsDeleting(false);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const saveApiKey = async () => {
    if (!apiKey.trim()) {
      setError('Vui lòng nhập Gemini API key.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await apiRequest('/api/user-settings/api-key', {
        method: 'POST',
        body: JSON.stringify({ apiKey }),
      });
      await onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Không thể lưu API key.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteApiKey = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      await apiRequest('/api/user-settings/api-key', {
        method: 'DELETE',
      });
      await onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Không thể xóa API key.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b0b0b] p-6 text-white shadow-2xl shadow-black/40">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-300">
              <KeyRound className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-xl font-bold">Cấu hình Gemini API key</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              API key sẽ được gửi lên backend Cloudflare, mã hóa bằng MASTER_SECRET, và lưu riêng theo guest session của trình duyệt này.
            </p>
          </div>
          <button onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <label className="block text-sm text-white/70">
            Gemini API key
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="AIza..."
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none"
            />
          </label>

          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.05] p-4 text-sm text-emerald-100/80">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
              <p>
                Frontend sẽ không còn giữ GEMINI_API_KEY trong bundle. Key chỉ được dùng ở backend cho các request Gemini.
              </p>
            </div>
          </div>

          {error && <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
          <button
            onClick={deleteApiKey}
            disabled={!hasApiKey || isDeleting || isSaving}
            className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white/75 transition-all hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isDeleting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Xóa key hiện tại
          </button>

          <button
            onClick={saveApiKey}
            disabled={isSaving || isDeleting}
            className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Lưu API key
          </button>
        </div>
      </div>
    </div>
  );
}
