export interface Point {
  x: number;
  y: number;
}

export interface DesignIteration {
  id: string;
  html: string;
  label: string;
  position: Point;
  width: number;
  height: number;
  prompt: string;
  comments: Comment[];
  isLoading?: boolean;
  isRegenerating?: boolean;
}

export type CommentStatus = "waiting" | "working" | "done";

export interface Comment {
  id: string;
  position: Point; // relative to the iteration
  text: string;
  number: number;
  resolved?: boolean;
  createdAt: number;
  status?: CommentStatus;
  aiResponse?: string;
}

export interface GenerationGroup {
  id: string;
  prompt: string;
  iterations: DesignIteration[];
  position: Point;
  createdAt: number;
}

export type ToolMode = "select" | "comment";
