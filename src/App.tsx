import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Portal from './pages/Portal';
import PortraitRestore from './pages/PortraitRestore';
import GroupRestore from './pages/GroupRestore';

import { Key } from 'lucide-react';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function App() {
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      console.log("Checking API Key status...");
      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        const selected = await window.aistudio.hasSelectedApiKey();
        console.log("AI Studio Key Selected:", selected);
        setHasKey(selected);
      } else {
        console.log("Not in AI Studio environment or hasSelectedApiKey missing.");
        // If not running in AI Studio, assume key is provided via env
        setHasKey(true);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
      // Assume success to mitigate race condition
      setHasKey(true);
    }
  };

  if (hasKey === null) {
    return <div className="w-screen h-screen bg-gray-950 flex items-center justify-center text-white">Loading...</div>;
  }

  if (!hasKey) {
    return (
      <div className="w-screen h-screen bg-gray-950 flex flex-col items-center justify-center text-white p-6">
        <div className="max-w-md text-center space-y-6 bg-white/5 p-8 rounded-3xl border border-white/10">
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Key className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold">API Key Required</h1>
          <p className="text-white/60">
            This application uses advanced Gemini 3.1 Pro and Flash Image models. 
            You must select your own paid Google Cloud API key to continue.
          </p>
          <button 
            onClick={handleSelectKey}
            className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
          >
            Select API Key
          </button>
          <p className="text-xs text-white/40 mt-4">
            For billing details, visit <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Gemini API Billing</a>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Portal />} />
        <Route path="/portrait-restore" element={<PortraitRestore />} />
        <Route path="/group-restore" element={<GroupRestore />} />

      </Routes>
    </BrowserRouter>
  );
}
