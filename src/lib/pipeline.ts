/** Pipeline stages for multi-model generation */

export type PipelineStage =
  | "queued"
  | "layout"
  | "images"
  | "compositing"
  | "review"
  | "refining"
  | "done"
  | "error";

export interface PipelineStatus {
  stage: PipelineStage;
  progress: number; // 0-1
  skipped?: boolean;
  reason?: string;
}

export const STAGE_CONFIG: Record<PipelineStage, { label: string; progress: number; icon: string }> = {
  queued:       { label: "Queued",                progress: 0,    icon: "⏳" },
  layout:       { label: "Designing layout...",   progress: 0.2,  icon: "🏗️" },
  images:       { label: "Creating images...",    progress: 0.45, icon: "🎨" },
  compositing:  { label: "Compositing...",        progress: 0.65, icon: "🔧" },
  review:       { label: "Visual review...",      progress: 0.8,  icon: "👁️" },
  refining:     { label: "Refining from feedback...", progress: 0.9, icon: "✨" },
  done:         { label: "Complete",              progress: 1,    icon: "✅" },
  error:        { label: "Error",                 progress: 0,    icon: "❌" },
};
