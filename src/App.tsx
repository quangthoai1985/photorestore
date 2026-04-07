import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Portal from './pages/Portal';
import PortraitRestore from './pages/PortraitRestore';
import GroupRestore from './pages/GroupRestore';
import IdPhoto from './pages/IdPhoto';
import { Key } from 'lucide-react';
import { ApiKeyDialog } from './components/ApiKeyDialog';
import { useApiKeyStatus } from './hooks/useApiKeyStatus';

export default function App() {
  const { hasApiKey, isLoading, refresh } = useApiKeyStatus();
  const [isApiDialogOpen, setIsApiDialogOpen] = useState(false);

  if (isLoading) {
    return <div className="w-screen h-screen bg-gray-950 flex items-center justify-center text-white">Loading...</div>;
  }

  if (!hasApiKey) {
    return (
      <>
        <div className="w-screen h-screen bg-gray-950 flex flex-col items-center justify-center text-white p-6">
        <div className="max-w-md text-center space-y-6 bg-white/5 p-8 rounded-3xl border border-white/10">
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Key className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold">API Key Required</h1>
          <p className="text-white/60">
            Ứng dụng này dùng Gemini 3.1 Flash Image và Gemini 3 Pro Image. Bạn cần lưu Gemini API key của riêng mình vào backend trước khi tiếp tục.
          </p>
          <button 
            onClick={() => setIsApiDialogOpen(true)}
            className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
          >
            Cấu hình API key
          </button>
          <p className="text-xs text-white/40 mt-4">
            Billing vẫn được tính vào Gemini API key của bạn. Xem <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Gemini API Billing</a>.
          </p>
        </div>
      </div>
        <ApiKeyDialog
          isOpen={isApiDialogOpen}
          hasApiKey={hasApiKey}
          onClose={() => setIsApiDialogOpen(false)}
          onSaved={refresh}
        />
      </>
    );
  }

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Portal />} />
          <Route path="/portrait-restore" element={<PortraitRestore />} />
          <Route path="/group-restore" element={<GroupRestore />} />
          <Route path="/id-photo" element={<IdPhoto />} />
        </Routes>
      </BrowserRouter>
      <ApiKeyDialog
        isOpen={isApiDialogOpen}
        hasApiKey={hasApiKey}
        onClose={() => setIsApiDialogOpen(false)}
        onSaved={refresh}
      />
    </>
  );
}
