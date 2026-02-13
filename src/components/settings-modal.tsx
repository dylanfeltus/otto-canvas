"use client";

import { useState, useEffect } from "react";
import { MODELS, type Settings } from "@/hooks/use-settings";

interface SettingsModalProps {
  settings: Settings;
  onUpdate: (update: Partial<Settings>) => void;
  onClose: () => void;
  isOwnKey: boolean;
  availableModels: Record<string, boolean> | null;
  isProbing: boolean;
  devMode?: boolean;
}

export function SettingsModal({ settings, onUpdate, onClose, isOwnKey, availableModels, isProbing, devMode }: SettingsModalProps) {
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

  // When using BYOK, filter to available models. When using demo key, show all.
  const isModelAvailable = (modelId: string): boolean => {
    if (!isOwnKey) return true; // demo key — show all
    if (!availableModels) return true; // not probed yet — show all
    return !!availableModels[modelId];
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white/60 backdrop-blur-2xl rounded-3xl border border-white/60 shadow-[0_24px_80px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.7)] w-[540px] max-w-[92vw] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200/30">
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

        <div className="p-6 space-y-8">
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
                className="flex-1 text-[13px] text-gray-800 placeholder-gray-400/50 bg-white/70 backdrop-blur-sm rounded-xl px-5 py-3.5 outline-none border border-white/50 focus:border-blue-300/60 focus:bg-white/90 transition-all font-mono"
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
                className="mt-2 text-[11px] text-gray-500 hover:text-red-500 transition-colors"
              >
                Remove key &amp; use demo
              </button>
            )}
            <p className="mt-2 text-[11px] text-gray-500 leading-relaxed">
              Your key is stored in localStorage. It passes through our server to reach Anthropic but is never logged or persisted.
            </p>
          </div>

          {/* Model Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[12px] font-medium text-gray-500 uppercase tracking-wider">
                Model
              </label>
              {isProbing && (
                <span className="flex items-center gap-1.5 text-[11px] text-blue-500 font-medium">
                  <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" strokeLinecap="round" />
                  </svg>
                  Checking models...
                </span>
              )}
            </div>
            <div className="space-y-1">
              {MODELS.map((m) => {
                const available = isModelAvailable(m.id);
                const isSelected = settings.model === m.id;

                return (
                  <button
                    key={m.id}
                    onClick={() => available && onUpdate({ model: m.id })}
                    disabled={!available}
                    className={`w-full flex items-center justify-between px-5 py-3.5 rounded-xl text-left transition-all ${
                      !available
                        ? "opacity-35 cursor-not-allowed bg-gray-100/30 border border-transparent"
                        : isSelected
                        ? "bg-blue-500/10 border border-blue-300/40 text-gray-800"
                        : "bg-white/40 border border-transparent hover:bg-white/60 text-gray-600"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div>
                        <span className="text-[13px] font-medium">{m.label}</span>
                        <span className="text-[11px] text-gray-500 ml-2">{m.desc}</span>
                      </div>
                      {!available && isOwnKey && (
                        <span className="text-[10px] text-gray-500 bg-gray-200/50 px-1.5 py-0.5 rounded">
                          unavailable
                        </span>
                      )}
                    </div>
                    {isSelected && available && (
                      <svg className="w-4 h-4 text-blue-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
            {isOwnKey && availableModels && (
              <p className="mt-2 text-[10px] text-gray-500">
                {Object.values(availableModels).filter(Boolean).length} of {MODELS.length} models available on your key
              </p>
            )}
          </div>
        </div>

        {/* Advanced / System Prompt — only visible with ?devMode=true */}
        {devMode && (
          <div className="px-6 pb-6">
            <div className="border border-amber-200/50 bg-amber-50/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">🛠 Dev Mode</span>
              </div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                System Prompt
              </label>
              <textarea
                value={settings.systemPrompt}
                onChange={(e) => onUpdate({ systemPrompt: e.target.value })}
                placeholder="Add custom instructions for the AI designer...&#10;&#10;e.g. &quot;You are a Facebook ad designer. Use 1200x628, minimal text, strong visual hierarchy...&quot;"
                className="w-full h-32 px-4 py-3 rounded-xl bg-white/70 border border-gray-200/50 text-[13px] text-gray-700 placeholder-gray-400 outline-none focus:border-blue-300/50 focus:ring-1 focus:ring-blue-200/30 resize-y font-mono"
              />
              <p className="mt-1.5 text-[10px] text-gray-500">
                Prepended to every generation. Use for brand guidelines, design skills, or style overrides.
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-6 border-t border-gray-200/30 flex items-center justify-between">
          <span className="text-[11px] text-gray-500">
            {isOwnKey ? "🔑 Own key" : "🌐 Demo key"} · {MODELS.find((m) => m.id === settings.model)?.label}
          </span>
          <button
            onClick={() => {
              // Auto-save key if changed
              if (key.trim() !== settings.apiKey) {
                onUpdate({ apiKey: key.trim() });
              }
              onClose();
            }}
            className="text-[13px] font-medium text-gray-600 hover:text-gray-800 px-4 py-2 rounded-xl hover:bg-black/5 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
