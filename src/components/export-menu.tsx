"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type ExportFormat = "svg" | "tailwind" | "react";

interface ExportMenuProps {
  html: string;
  label: string;
  apiKey?: string;
  model?: string;
}

const FORMATS: { id: ExportFormat; label: string; icon: string; ext: string }[] = [
  { id: "svg", label: "SVG (Figma)", icon: "◇", ext: "svg" },
  { id: "tailwind", label: "Tailwind", icon: "⊞", ext: "html" },
  { id: "react", label: "React", icon: "⚛", ext: "tsx" },
];

export function ExportMenu({ html, label, apiKey, model }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [preview, setPreview] = useState<{ format: ExportFormat; code: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open && !preview) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setPreview(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, preview]);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setExporting(format);
      setOpen(false);

      try {
        const res = await fetch("/api/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html, format, apiKey, model }),
        });

        if (!res.ok) throw new Error("Export failed");

        const data = await res.json();
        setPreview({ format, code: data.result });
      } catch (err) {
        console.error("Export failed:", err);
        setPreview({ format, code: "// Export failed. Check API key and try again." });
      } finally {
        setExporting(null);
      }
    },
    [html]
  );

  const handleCopy = useCallback(() => {
    if (!preview) return;
    navigator.clipboard.writeText(preview.code);
  }, [preview]);

  const handleDownload = useCallback(() => {
    if (!preview) return;
    const fmt = FORMATS.find((f) => f.id === preview.format);
    const mime = preview.format === "svg" ? "image/svg+xml" : "text/plain";
    const blob = new Blob([preview.code], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${label.toLowerCase().replace(/\s+/g, "-")}.${fmt?.ext || "txt"}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [preview, label]);

  return (
    <div ref={menuRef} className="relative" onClick={(e) => e.stopPropagation()}>
      {/* Export button */}
      <button
        onClick={() => { setOpen(!open); setPreview(null); }}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-gray-400 hover:text-gray-600 hover:bg-black/5 transition-all"
        title="Export design"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Export
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white/60 backdrop-blur-2xl rounded-xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.7)] p-1 min-w-[160px] z-30">
          {FORMATS.map((fmt) => (
            <button
              key={fmt.id}
              onClick={() => handleExport(fmt.id)}
              disabled={exporting !== null}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-gray-700 hover:bg-black/5 disabled:opacity-40 transition-colors text-left"
            >
              <span className="text-sm w-4 text-center">{fmt.icon}</span>
              <span>{fmt.label}</span>
              {exporting === fmt.id && (
                <svg className="w-3 h-3 animate-spin ml-auto text-blue-500" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" strokeLinecap="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Loading indicator (when dropdown is closed) */}
      {exporting && !open && (
        <div className="absolute top-full left-0 mt-1 bg-white/60 backdrop-blur-2xl rounded-xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.12)] px-3 py-2 z-30 flex items-center gap-2">
          <svg className="w-3.5 h-3.5 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" strokeLinecap="round" />
          </svg>
          <span className="text-[12px] text-gray-500">Converting...</span>
        </div>
      )}

      {/* Preview panel */}
      {preview && (
        <div className="absolute top-full left-0 mt-1 bg-white/70 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-[0_12px_40px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.7)] z-30 w-[420px] max-w-[80vw]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/40">
            <span className="text-[12px] font-medium text-gray-500 uppercase tracking-wider">
              {FORMATS.find((f) => f.id === preview.format)?.label} Export
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopy}
                className="text-[11px] font-medium text-gray-500 hover:text-gray-700 px-2.5 py-1 rounded-lg hover:bg-black/5 transition-all"
              >
                Copy
              </button>
              <button
                onClick={handleDownload}
                className="text-[11px] font-medium text-white bg-blue-500/90 hover:bg-blue-500 px-2.5 py-1 rounded-lg transition-all"
              >
                Download
              </button>
              <button
                onClick={() => setPreview(null)}
                className="text-gray-400 hover:text-gray-600 px-1.5 py-1 rounded-lg hover:bg-black/5 ml-1 transition-all"
              >
                ✕
              </button>
            </div>
          </div>
          <pre className="p-4 text-[12px] leading-relaxed text-gray-700 font-mono overflow-auto max-h-[320px] whitespace-pre-wrap break-all">
            {preview.code}
          </pre>
        </div>
      )}
    </div>
  );
}
