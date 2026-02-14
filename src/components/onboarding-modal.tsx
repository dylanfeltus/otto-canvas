"use client";

import { useState } from "react";

interface OnboardingModalProps {
  onComplete: (keys: { anthropicKey: string; geminiKey: string; unsplashKey: string; openaiKey: string }) => void;
  onDismiss: () => void;
}

export function OnboardingModal({ onComplete, onDismiss }: OnboardingModalProps) {
  const [anthropicKey, setAnthropicKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [unsplashKey, setUnsplashKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showImageKeys, setShowImageKeys] = useState(false);

  const canSubmit = anthropicKey.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-md" />
      <div className="relative bg-white/70 backdrop-blur-2xl rounded-3xl border border-white/60 shadow-[0_24px_80px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.7)] p-8 w-[440px] max-w-[92vw] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <img src="/otto-icon.jpg" alt="Otto" className="w-16 h-16 mx-auto mb-4 rounded-2xl shadow-lg shadow-violet-500/20 object-cover" />
          <h2 className="text-xl font-bold text-gray-900 mb-1">Welcome to Otto Canvas</h2>
          <p className="text-[13px] text-gray-600 leading-relaxed">
            AI-powered design tool. Describe any design and Otto generates polished HTML/CSS variations.
          </p>
        </div>

        {/* Anthropic Key (required) */}
        <div className="mb-5">
          <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
            Anthropic API Key <span className="text-red-400">*</span>
          </label>
          <p className="text-[11px] text-gray-500 mb-2">
            Powers design generation with Claude.
          </p>
          <div className="relative">
            <input
              type={showAnthropicKey ? "text" : "password"}
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full bg-white/60 border border-gray-200/60 rounded-xl px-4 py-2.5 text-[13px] text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-300/50 pr-10"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowAnthropicKey(!showAnthropicKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-600 text-xs"
            >
              {showAnthropicKey ? "Hide" : "Show"}
            </button>
          </div>
          <a
            href="https://console.anthropic.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-1.5 text-[10px] text-violet-500 hover:text-violet-600 underline underline-offset-2"
          >
            Get a key at console.anthropic.com →
          </a>
        </div>

        {/* Image Sources (optional, collapsible) */}
        <div className="mb-6">
          <button
            onClick={() => setShowImageKeys(!showImageKeys)}
            className="flex items-center gap-2 text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-2"
          >
            <span className={`transition-transform ${showImageKeys ? "rotate-90" : ""}`}>▶</span>
            Image Sources <span className="text-gray-500 font-normal normal-case">(optional — enables real images in designs)</span>
          </button>

          {showImageKeys && (
            <div className="space-y-3 mt-2">
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Add any of these keys to enable real images. Claude picks the best source for each image automatically.
              </p>

              {/* Gemini */}
              <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-200/40">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-gray-600">✨ Gemini — design assets & patterns</span>
                  <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline">Get key →</a>
                </div>
                <input
                  type={showGeminiKey ? "text" : "password"}
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIza..."
                  className="w-full bg-white/60 border border-gray-200/60 rounded-lg px-3 py-2 text-[12px] text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400/20"
                />
              </div>

              {/* DALL-E */}
              <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-200/40">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-gray-600">🎨 DALL·E — custom illustrations</span>
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline">Get key →</a>
                </div>
                <input
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full bg-white/60 border border-gray-200/60 rounded-lg px-3 py-2 text-[12px] text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400/20"
                />
              </div>

              {/* Unsplash */}
              <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-200/40">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-gray-600">📷 Unsplash — real photos</span>
                  <a href="https://unsplash.com/developers" target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline">Get key →</a>
                </div>
                <input
                  type="password"
                  value={unsplashKey}
                  onChange={(e) => setUnsplashKey(e.target.value)}
                  placeholder="Access key..."
                  className="w-full bg-white/60 border border-gray-200/60 rounded-lg px-3 py-2 text-[12px] text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400/20"
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={onDismiss}
            className="text-[12px] text-gray-500 hover:text-gray-600 transition-colors"
          >
            Skip for now
          </button>
          <button
            onClick={() => canSubmit && onComplete({ anthropicKey: anthropicKey.trim(), geminiKey: geminiKey.trim(), unsplashKey: unsplashKey.trim(), openaiKey: openaiKey.trim() })}
            disabled={!canSubmit}
            className={`text-[13px] font-semibold px-6 py-2.5 rounded-xl transition-all ${
              canSubmit
                ? "bg-gradient-to-r from-violet-500 to-blue-500 text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30"
                : "bg-gray-200/50 text-gray-400 cursor-not-allowed"
            }`}
          >
            Get Started →
          </button>
        </div>

        {/* Privacy note */}
        <p className="mt-4 text-[10px] text-gray-500 text-center leading-relaxed">
          Keys are stored locally in your browser. They are never sent to our servers — API calls go directly to Anthropic and Google.
        </p>
      </div>
    </div>
  );
}
