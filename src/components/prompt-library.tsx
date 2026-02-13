"use client";

import { useState } from "react";

interface PromptLibraryProps {
  open: boolean;
  onClose: () => void;
  onUsePrompt: (prompt: string) => void;
}

interface PromptItem {
  text: string;
  label: string;
}

const CATEGORIES: { name: string; icon: string; prompts: PromptItem[] }[] = [
  {
    name: "UI Components",
    icon: "◻",
    prompts: [
      { label: "Toast Notifications", text: "A set of toast notification components — success, error, warning, and info variants. Stacked layout with icons, message text, and dismiss buttons. Rounded corners, subtle shadows." },
      { label: "Pricing Cards", text: "Three pricing tier cards side by side — Starter, Pro, Enterprise. Each with feature list, price, and CTA button. The middle card should be highlighted as the recommended option." },
      { label: "Login Form", text: "A modern login form with email and password fields, 'Remember me' checkbox, forgot password link, and a primary sign-in button. Include social login options (Google, GitHub)." },
      { label: "Settings Panel", text: "An account settings panel with profile section (avatar, name, email), notification toggles, theme selector (light/dark), and a danger zone with delete account button." },
      { label: "Navigation Bar", text: "A responsive top navigation bar with logo, nav links (Home, Features, Pricing, Docs), search input, and a user avatar dropdown. Clean and minimal." },
      { label: "Modal Dialog", text: "A confirmation modal dialog with a warning icon, title, description text, and two action buttons (Cancel and Confirm). Semi-transparent backdrop overlay." },
    ],
  },
  {
    name: "Full Pages",
    icon: "▣",
    prompts: [
      { label: "SaaS Hero Section", text: "A SaaS landing page hero section with a large headline, subheadline, email capture input with CTA button, and a product screenshot or abstract illustration area below. Trust badges at the bottom." },
      { label: "Dashboard Layout", text: "An analytics dashboard with a sidebar nav, top stats row (4 metric cards), a large area chart, and a recent activity table below. Dark or light theme, clean data visualization." },
      { label: "Pricing Page", text: "A full pricing page with a toggle for monthly/annual billing, three plan cards with feature comparison lists, an FAQ section below, and an enterprise CTA banner." },
      { label: "Blog Post Layout", text: "A blog post page with article title, author avatar and byline, publish date, featured image, body text with headings and paragraphs, and a related posts section at the bottom." },
    ],
  },
  {
    name: "Marketing",
    icon: "◈",
    prompts: [
      { label: "Social Media Card", text: "A social media announcement card (1200x630 ratio) for a product launch. Bold headline, product name, a brief tagline, and a gradient or solid color background. Eye-catching and shareable." },
      { label: "Email Header", text: "An email header/hero section for a product newsletter. Company logo, bold announcement headline, short description, and a prominent CTA button. Works at 600px width." },
      { label: "Banner Ad", text: "A web banner ad (728x90 leaderboard format) for a SaaS product. Product name, value proposition in one line, and a 'Try Free' CTA button. Clean, not cluttered." },
      { label: "Feature Section", text: "A product feature section with three columns. Each column has an icon, feature title, and short description. Clean grid layout with consistent spacing. Include a section headline above." },
    ],
  },
];

export function PromptLibrary({ open, onClose, onUsePrompt }: PromptLibraryProps) {
  const [copied, setCopied] = useState<string | null>(null);

  if (!open) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleUse = (text: string) => {
    onUsePrompt(text);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Slide-out panel */}
      <div className="fixed top-3 right-3 bottom-3 z-50 w-[400px] max-w-[85vw] bg-white/70 backdrop-blur-2xl border border-white/50 rounded-2xl shadow-[-8px_0_40px_rgba(0,0,0,0.1)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200/30 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base">💡</span>
            <h2 className="text-[15px] font-semibold text-gray-800">Prompt Library</h2>
          </div>
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {CATEGORIES.map((cat) => (
            <div key={cat.name}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm opacity-60">{cat.icon}</span>
                <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wider">
                  {cat.name}
                </h3>
              </div>
              <div className="space-y-2">
                {cat.prompts.map((p) => (
                  <div
                    key={p.label}
                    className="group/item bg-white/50 hover:bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200/40 hover:border-gray-200/60 px-4 py-3 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-gray-700 mb-1">
                          {p.label}
                        </div>
                        <div className="text-[11px] text-gray-400 leading-relaxed line-clamp-2">
                          {p.text}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleUse(p.text)}
                        className="text-[11px] font-medium text-white bg-blue-500/90 hover:bg-blue-500 px-3 py-1.5 rounded-lg transition-all"
                      >
                        Use prompt →
                      </button>
                      <button
                        onClick={() => handleCopy(p.text)}
                        className="text-[11px] font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-black/5 transition-all"
                      >
                        {copied === p.text ? "Copied ✓" : "Copy"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
