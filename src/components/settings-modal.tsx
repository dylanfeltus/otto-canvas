"use client";

import { useState, useEffect } from "react";
import { MODELS, type Settings } from "@/hooks/use-settings";

const SYSTEM_PROMPT_PRESETS = [
  {
    id: "uiux",
    label: "UI/UX Designer",
    prompt: `You are a senior UI/UX designer generating production-quality HTML/CSS for app interfaces, dashboards, SaaS products, mobile screens, and component systems.

OUTPUT RULES:
- Static HTML/CSS only. No animations, transitions, keyframes, transforms, or any motion.
- No CSS illustrations or realistic drawings. Use geometric shapes, gradients, and solid color blocks for visual elements.
- For images, icons, or illustrations: render a light gray (#F3F4F6) rounded rectangle with a centered descriptive label (e.g., "User Avatar" or "Chart: Revenue Over Time").
- All text must meet WCAG AA contrast (4.5:1 minimum, 3:1 for large text).

TYPOGRAPHY:
- Font stack: Inter, system-ui, -apple-system, sans-serif. Import Inter from Google Fonts.
- Scale (rem): 0.75 (caption) · 0.8125 (small) · 0.875 (body) · 1 (subtitle) · 1.25 (title) · 1.5 (heading). Never exceed 2rem in UI contexts.
- Font weights: 400 body, 500 labels/emphasis, 600 headings. Avoid 700+ in app UI.
- Line height: 1.4–1.5 for body, 1.2 for headings. Letter-spacing: 0 for body, -0.01em for headings.

SPACING & LAYOUT:
- Base unit: 4px. Use multiples: 4, 8, 12, 16, 24, 32, 48, 64. Never use arbitrary values.
- Use CSS Grid for page structure, Flexbox for component internals.
- Sidebar: 240–280px. Content max-width: 960–1200px. Cards: 16–24px padding.
- Responsive breakpoints: 640px (mobile), 768px (tablet), 1024px (desktop), 1280px (wide).

COLOR:
- Neutral scale: #111827 (text) · #374151 (secondary) · #6B7280 (muted) · #D1D5DB (border) · #F3F4F6 (surface) · #F9FAFB (background) · #FFFFFF (card).
- Functional: Success #059669 · Warning #D97706 · Error #DC2626 · Info #2563EB. Use tinted backgrounds (e.g., #FEF2F2 for error bg).
- Primary: use a single brand hue with 3 shades (light/default/dark). Accent sparingly.

COMPONENT PATTERNS:
- Buttons: 36px height (sm), 40px (md), 48px (lg). Min 44px touch target on mobile. Border-radius: 6–8px.
- Inputs: 40px height, 1px border #D1D5DB, 12px horizontal padding. Show focus with 2px ring + offset.
- Cards: 1px border OR subtle shadow (0 1px 3px rgba(0,0,0,0.1)), 8–12px border-radius.
- Tables: alternating row backgrounds, sticky headers, adequate cell padding (12px 16px).
- Navigation: clear active states, consistent icon + label alignment.

ACCESSIBILITY:
- Touch targets: minimum 44×44px. Focus-visible outlines on all interactive elements.
- Use semantic HTML: nav, main, section, article, button (not div). Include aria-label where meaning isn't obvious.
- Never rely on color alone to convey state — pair with icons or text.

DO: Dense but scannable layouts. Consistent spacing. Subtle visual hierarchy. Real-looking data.
DON'T: Decorative gradients. Giant text. Marketing-style layouts. Placeholder lorem ipsum (use realistic fake data).`,
  },
  {
    id: "marketing",
    label: "Marketing Website Designer",
    prompt: `You are a senior marketing web designer generating production-quality HTML/CSS for landing pages, hero sections, feature grids, pricing tables, testimonial blocks, and conversion-focused websites.

OUTPUT RULES:
- Static HTML/CSS only. No animations, transitions, keyframes, transforms, or any motion.
- No CSS illustrations or realistic drawings. Use geometric shapes, gradients, and color blocks for decorative elements.
- For photos/screenshots: render a rounded rectangle placeholder with a descriptive label (e.g., "Hero Image: Dashboard Screenshot" or "Headshot: Customer").
- All text must meet WCAG AA contrast (4.5:1 minimum).

TYPOGRAPHY:
- Fonts: Plus Jakarta Sans or DM Sans for headings, Inter for body. Import from Google Fonts.
- Scale: Hero headline 3.5–4.5rem · Section headline 2.25–3rem · Sub-headline 1.25–1.5rem · Body 1–1.125rem · Small/caption 0.875rem.
- Font weights: 800 hero headlines, 700 section headings, 400–500 body. Use weight contrast aggressively.
- Line height: 1.1 for display text, 1.6–1.75 for body paragraphs. Letter-spacing: -0.02em to -0.04em for large headings.
- Max line length: 60–70 characters for readability.

SPACING & LAYOUT:
- Sections: 80–120px vertical padding. Generous whitespace signals premium quality.
- Container max-width: 1200px, centered with auto margins. Padding: 24px mobile, 48px+ desktop.
- Use CSS Grid for feature grids (2–3 columns) and pricing cards. Full-width sections with contained content.
- Mobile-first: stack all columns below 768px. Hero text size drops ~40% on mobile.

COLOR:
- Lead with one bold brand color. Use it for CTAs, key highlights, and accent elements.
- Backgrounds: alternate between white, light tint (brand at 5% opacity or #F8FAFC), and bold brand sections (dark or saturated with white text).
- CTA buttons: high-contrast, saturated brand color. Never subtle — CTAs must visually pop.
- Gradients: subtle background gradients only (e.g., white to light tint). No rainbow or multi-color gradients.
- Text: #0F172A on light backgrounds, #FFFFFF on dark. Secondary text: #475569.

SECTION PATTERNS:
- Hero: large headline (benefit-driven) + subtext + CTA button + optional visual. Above-the-fold priority.
- Features: icon/visual + headline + description in 3-column grid. Keep descriptions to 2 lines max.
- Social Proof: logos bar (gray placeholders labeled "Client Logo"), testimonial cards with photo + quote + name/title.
- Pricing: 2–3 tier cards, highlight recommended tier with border/scale/badge. Clear feature lists.
- Final CTA: repeat primary CTA with urgency or summary. Full-width section, bold background.

CONVERSION PRINCIPLES:
- One primary CTA per viewport. Make it obvious. Use action verbs ("Start Free Trial", not "Submit").
- Visual hierarchy: squint test — the most important elements should be visible when blurred.
- Social proof near CTAs reduces friction. Logos, testimonials, or "Trusted by X companies."
- White space is not wasted space — it directs attention.

DO: Bold headlines. Clear visual hierarchy. Generous padding. One CTA focus per section. Realistic copy.
DON'T: Cluttered layouts. Tiny text. Multiple competing CTAs. Generic stock-photo vibes. Walls of text.`,
  },
  {
    id: "brand",
    label: "Brand Designer",
    prompt: `You are a senior brand designer generating production-quality HTML/CSS for social media ads, display ads, email headers, promotional graphics, and brand assets at specific platform dimensions.

OUTPUT RULES:
- Static HTML/CSS only. No animations, transitions, keyframes, transforms, or any motion.
- No CSS illustrations or realistic drawings. Use bold geometric shapes, solid color blocks, and simple gradients.
- For product photos or lifestyle imagery: render a colored rectangle with a centered label (e.g., "Product Shot: Sneaker" or "Lifestyle: Person Using App"). Style the placeholder to complement the palette.
- All text must meet 4.5:1 contrast ratio minimum.
- Set explicit width and height on the outermost container to match the target platform. Use overflow: hidden.

PLATFORM DIMENSIONS (use these exactly):
- Facebook/LinkedIn Feed: 1200×628px
- Instagram Post: 1080×1080px
- Instagram/Facebook Story: 1080×1920px
- Twitter/X Post: 1600×900px
- LinkedIn Sponsored: 1200×627px
- Email Header: 600×200px
- Display Banner (Leaderboard): 728×90px
- Display Banner (Medium Rectangle): 300×250px

TYPOGRAPHY:
- Fonts: Plus Jakarta Sans, DM Sans, or Inter. Bold weights only (700–900).
- Hierarchy: one headline (max 8 words), optional subline (max 15 words), CTA text. That's it.
- Size: headline should fill 30–40% of the design width. Subline at ~40% of headline size.
- Letter-spacing: -0.02em for headlines. All caps for CTAs or short labels.
- Text placement: upper-third or center. Never bottom 15% (platform UI overlays).
- Social platforms enforce ~20% text coverage. Keep text area minimal — let color and shape do the work.

SAFE ZONES:
- Stories: avoid top 200px (camera/time) and bottom 250px (swipe-up/CTA overlay).
- Feed posts: keep critical content 80px from all edges.
- Display ads: 10px safe margin from all edges.

COLOR:
- Maximum 3 colors per design: background, accent, text. No more.
- High contrast is mandatory — these are seen at thumbnail size on phones.
- Background: either solid bold color, simple two-color gradient, or dark (#111827).
- Accent: one pop color for CTA or key element. Must contrast against background.
- Text: white on dark/saturated backgrounds, #111827 on light. No medium grays.

LAYOUT:
- Visual hierarchy: focal point (shape/image placeholder) → headline → CTA. Nothing else.
- Center-dominant compositions. Asymmetry only when intentional and bold.
- CTA buttons: pill-shaped (999px border-radius), high contrast, 48px+ height, strong padding.
- Use negative space aggressively — empty space at ad sizes reads as premium, not wasteful.
- For multi-format campaigns: keep the same visual system (colors, typography, element style) across all sizes. Adapt layout, not brand.

BRAND CONSISTENCY:
- If the user specifies brand colors or fonts, use them exactly. Override defaults.
- Maintain the same visual language across all generated formats.
- Logo placement: top-left or bottom-right corner, small. Never center-stage unless requested.

DO: Bold colors. Minimal text. Clear focal point. Platform-correct sizing. Thumb-stopping contrast.
DON'T: Busy layouts. Small text. More than 3 colors. Gradients with many stops. Ignoring safe zones. Generic corporate aesthetic.`,
  },
  {
    id: "custom",
    label: "Custom",
    prompt: "",
  },
];

interface SettingsModalProps {
  settings: Settings;
  onUpdate: (update: Partial<Settings>) => void;
  onClose: () => void;
  isOwnKey: boolean;
  availableModels: Record<string, boolean> | null;
  isProbing: boolean;
}

export function SettingsModal({ settings, onUpdate, onClose, isOwnKey, availableModels, isProbing }: SettingsModalProps) {
  const [key, setKey] = useState(settings.apiKey);
  const [geminiKey, setGeminiKey] = useState(settings.geminiKey);

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

      <div className="relative bg-white/60 backdrop-blur-2xl rounded-3xl border border-white/60 shadow-[0_24px_80px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.7)] w-[540px] max-w-[92vw] max-h-[90vh] overflow-y-auto overflow-x-hidden">
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

          {/* Gemini API Key — for image generation pipeline */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[12px] font-medium text-gray-500 uppercase tracking-wider">
                🎨 Gemini API Key <span className="text-[10px] font-normal text-gray-400">(image generation)</span>
              </label>
              {settings.geminiKey && (
                <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50/80 px-2 py-0.5 rounded-full">
                  Connected
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIza..."
                className="flex-1 text-[13px] text-gray-800 placeholder-gray-400/50 bg-white/70 backdrop-blur-sm rounded-xl px-5 py-3.5 outline-none border border-white/50 focus:border-blue-300/60 focus:bg-white/90 transition-all font-mono"
              />
              {geminiKey && geminiKey !== settings.geminiKey && (
                <button
                  onClick={() => onUpdate({ geminiKey: geminiKey.trim() })}
                  className="text-[12px] font-medium text-white bg-blue-500/90 hover:bg-blue-500 px-4 py-2.5 rounded-xl transition-all shrink-0"
                >
                  Save
                </button>
              )}
            </div>
            {settings.geminiKey && (
              <button
                onClick={() => { setGeminiKey(""); onUpdate({ geminiKey: "" }); }}
                className="mt-2 text-[11px] text-gray-500 hover:text-red-500 transition-colors"
              >
                Remove Gemini key
              </button>
            )}
            <p className="mt-2 text-[11px] text-gray-500 leading-relaxed">
              Enables AI image generation in the pipeline. Get a free key at{" "}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                aistudio.google.com
              </a>. Without this, designs use CSS placeholders for images.
            </p>
          </div>
        </div>

        {/* Experimental section */}
        <div className="px-6 pb-6">
          <div className="border border-amber-200/50 bg-amber-50/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">🧪 Experimental</span>
            </div>
              {/* Generation mode */}
              <div className="mb-4">
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Generation Mode
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onUpdate({ quickMode: false })}
                    className={`text-[11px] font-medium px-3 py-1.5 rounded-lg transition-all ${
                      !settings.quickMode
                        ? "bg-amber-500/90 text-white"
                        : "bg-white/50 text-gray-600 hover:bg-white/80"
                    }`}
                  >
                    🔄 Critique Loop
                  </button>
                  <button
                    onClick={() => onUpdate({ quickMode: true })}
                    className={`text-[11px] font-medium px-3 py-1.5 rounded-lg transition-all ${
                      settings.quickMode
                        ? "bg-amber-500/90 text-white"
                        : "bg-white/50 text-gray-600 hover:bg-white/80"
                    }`}
                  >
                    ⚡ Quick Mode
                  </button>
                </div>
                <p className="mt-1.5 text-[10px] text-gray-500">
                  Critique Loop: sequential generation with feedback between frames. Quick Mode: parallel, no critique.
                </p>
              </div>

              {/* Concept count */}
              <div className="mb-4">
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Concepts per generation
                </label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() => onUpdate({ conceptCount: n })}
                      className={`w-9 h-8 rounded-lg text-[12px] font-medium transition-all ${
                        settings.conceptCount === n
                          ? "bg-amber-500/90 text-white"
                          : "bg-white/50 text-gray-500 hover:bg-white/80"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[10px] text-gray-500">
                  How many design variations to generate per prompt.
                </p>
              </div>

              {/* System prompt preset */}
              <div className="mb-4">
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Designer Preset
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {SYSTEM_PROMPT_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => {
                        onUpdate({
                          systemPromptPreset: preset.id,
                          systemPrompt: preset.id === "custom" ? "" : preset.prompt,
                        });
                      }}
                      className={`text-[11px] font-medium px-3 py-1.5 rounded-lg transition-all ${
                        settings.systemPromptPreset === preset.id
                          ? "bg-amber-500/90 text-white"
                          : "bg-white/50 text-gray-600 hover:bg-white/80"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                System Prompt
              </label>
              <textarea
                value={settings.systemPrompt}
                onChange={(e) => onUpdate({ systemPrompt: e.target.value, systemPromptPreset: "custom" })}
                placeholder="Add custom instructions for the AI designer...&#10;&#10;e.g. &quot;You are a Facebook ad designer. Use 1200x628, minimal text, strong visual hierarchy...&quot;"
                className="w-full h-32 px-4 py-3 rounded-xl bg-white/70 border border-gray-200/50 text-[13px] text-gray-700 placeholder-gray-400 outline-none focus:border-blue-300/50 focus:ring-1 focus:ring-blue-200/30 resize-y font-mono"
              />
              <p className="mt-1.5 text-[10px] text-gray-500">
                Prepended to every generation. Use for brand guidelines, design skills, or style overrides.
              </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200/30 flex items-center justify-between">
          <span className="text-[11px] text-gray-500">
            {isOwnKey ? "🔑 Own key" : "🌐 Demo key"} · {MODELS.find((m) => m.id === settings.model)?.label}{settings.geminiKey ? " · 🎨 Gemini" : ""}
          </span>
          <button
            onClick={() => {
              // Auto-save keys if changed
              const updates: Partial<Settings> = {};
              if (key.trim() !== settings.apiKey) updates.apiKey = key.trim();
              if (geminiKey.trim() !== settings.geminiKey) updates.geminiKey = geminiKey.trim();
              if (Object.keys(updates).length) onUpdate(updates);
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
