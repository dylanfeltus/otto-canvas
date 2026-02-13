"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type ExportFormat = "svg" | "tailwind" | "react" | "png" | "jpg" | "copy-image";

interface ExportMenuProps {
  html: string;
  label: string;
  width?: number;
  apiKey?: string;
  model?: string;
}

const CODE_FORMATS: { id: ExportFormat; label: string; icon: string; ext: string }[] = [
  { id: "tailwind", label: "Tailwind", icon: "⊞", ext: "html" },
  { id: "react", label: "React", icon: "⚛", ext: "tsx" },
];

const IMAGE_FORMATS: { id: ExportFormat; label: string; icon: string; ext?: string }[] = [
  { id: "svg", label: "SVG", icon: "◇", ext: "svg" },
  { id: "png", label: "PNG", icon: "🖼" },
  { id: "jpg", label: "JPG", icon: "📷" },
  { id: "copy-image", label: "Copy as Image", icon: "📋" },
];

const ALL_FORMATS = [...CODE_FORMATS, ...IMAGE_FORMATS];

async function htmlToImageBlob(html: string, width: number, type: "image/png" | "image/jpeg"): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.style.cssText = `position:fixed;left:-9999px;top:0;width:${width}px;height:2000px;border:none;`;
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    if (!doc) { document.body.removeChild(iframe); reject(new Error("No iframe doc")); return; }

    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:white;width:${width}px;}</style></head><body>${html}</body></html>`);
    doc.close();

    // Wait for render
    setTimeout(async () => {
      try {
        const body = doc.body;
        const h = body.scrollHeight;
        iframe.style.height = h + "px";

        // Use html-to-image via dynamic import
        const { toPng, toJpeg } = await import("html-to-image");
        const fn = type === "image/jpeg" ? toJpeg : toPng;
        const dataUrl = await fn(body, { width, height: h, quality: 0.95, pixelRatio: 2 });

        const res = await fetch(dataUrl);
        const blob = await res.blob();
        resolve(blob);
      } catch (err) {
        reject(err);
      } finally {
        document.body.removeChild(iframe);
      }
    }, 500);
  });
}

export function ExportMenu({ html, label, width = 480, apiKey, model }: ExportMenuProps) {
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
        // Image exports — client-side
        if (format === "png" || format === "jpg" || format === "copy-image") {
          const mimeType = format === "jpg" ? "image/jpeg" : "image/png";
          const blob = await htmlToImageBlob(html, width, mimeType as "image/png" | "image/jpeg");

          if (format === "copy-image") {
            await navigator.clipboard.write([
              new ClipboardItem({ [blob.type]: blob }),
            ]);
            // Brief success indicator
            setExporting(null);
            return;
          }

          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${label.toLowerCase().replace(/\s+/g, "-")}.${format}`;
          a.click();
          URL.revokeObjectURL(url);
          setExporting(null);
          return;
        }

        // Code exports — API call
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
        if (format === "png" || format === "jpg" || format === "copy-image") {
          // Can't show preview for image failures
          console.error("Image export failed");
        } else {
          setPreview({ format, code: "// Export failed. Check API key and try again." });
        }
      } finally {
        setExporting(null);
      }
    },
    [html, width, label]
  );

  const handleCopy = useCallback(() => {
    if (!preview) return;
    navigator.clipboard.writeText(preview.code);
  }, [preview]);

  const handleDownload = useCallback(() => {
    if (!preview) return;
    const fmt = ALL_FORMATS.find((f) => f.id === preview.format);
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
        <div className="absolute top-full left-0 mt-1 bg-white/60 backdrop-blur-2xl rounded-xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.7)] p-1 min-w-[180px] z-30">
          <div className="px-2.5 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Image</div>
          {IMAGE_FORMATS.map((fmt) => (
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
          <div className="my-1 border-t border-gray-200/30" />
          <div className="px-2.5 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Code</div>
          {CODE_FORMATS.map((fmt) => (
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
              {ALL_FORMATS.find((f) => f.id === preview.format)?.label} Export
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
