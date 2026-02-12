"use client";

import { useState, useEffect } from "react";
import { MODELS, type Settings } from "@/hooks/use-settings";

interface SettingsModalProps {
  settings: Settings;
  onUpdate: (update: Partial<Settings>) => void;
  onClose: () => void;
  isOwnKey: boolean;
}

export function SettingsModal({ settings, onUpdate, onClose, isOwnKey }: SettingsModalProps) {
  const [key, setKey] = useState(settings.apiKey);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSaveKey = () => {
    onUpdate({ apiKey: key.trim() });
  };

  const handleClearKey = () => {
    setKey("");
    onUpdate({ apiKey: "" });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white/60 backdrop-blur-2xl rounded-3xl border border-white/60 shadow-[0_24px_80px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.7)] w-[480px] max-w-[90vw] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-gray-200/30">
          <h2 className="text-[17px] font-semibold text-gray-800">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-black/5 transition-all"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="px-8 py-6 space-y-8">
          {/* API Key */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[12px] font-medium text-gray-500 uppercase tracking-wider">
                Anthropic API Key
              </label>
              {isOwnKey && (
                <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50/80 px-2 py-0.5 rounded-full">
                  Using your key
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="sk-ant-..."
                className="flex-1 text-[14px] text-gray-800 placeholder-gray-400/50 bg-white/70 backdrop-blur-sm rounded-xl px-4 py-3 outline-none border border-white/50 focus:border-blue-300/60 focus:bg-white/90 transition-all font-mono"
              />
              {key && key !== settings.apiKey && (
                <button
                  onClick={handleSaveKey}
                  className="text-[12px] font-medium text-white bg-blue-500/90 hover:bg-blue-500 px-4 py-2.5 rounded-xl transition-all shrink-0"
                >
                  Save
                </button>
              )}
            </div>
            {isOwnKey && (
              <button
                onClick={handleClearKey}
                className="mt-2 text-[11px] text-gray-400 hover:text-red-500 transition-colors"
              >
                Remove key & use demo
              </button>
            )}
            <p className="mt-2 text-[11px] text-gray-400 leading-relaxed">
              Your key is stored in localStorage and sent directly to Anthropic. Never stored on our servers.
            </p>
          </div>

          {/* Model Selector */}
          <div>
            <label className="text-[12px] font-medium text-gray-500 uppercase tracking-wider mb-2 block">
              Model
            </label>
            <div className="space-y-2">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onUpdate({ model: m.id })}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-left transition-all ${
                    settings.model === m.id
                      ? "bg-blue-500/10 border border-blue-300/40 text-gray-800"
                      : "bg-white/40 border border-transparent hover:bg-white/60 text-gray-600"
                  }`}
                >
                  <div>
                    <span className="text-[13px] font-medium">{m.label}</span>
                    <span className="text-[11px] text-gray-400 ml-2">{m.desc}</span>
                  </div>
                  {settings.model === m.id && (
                    <svg className="w-4 h-4 text-blue-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-gray-200/30 flex items-center justify-between">
          <span className="text-[11px] text-gray-400">
            {isOwnKey ? "🔑 Own key" : "🌐 Demo key"} · {MODELS.find((m) => m.id === settings.model)?.label}
          </span>
          <button
            onClick={onClose}
            className="text-[13px] font-medium text-gray-600 hover:text-gray-800 px-4 py-2 rounded-xl hover:bg-black/5 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
