"use client";

import { useState, useRef, useEffect } from "react";
import type { Comment, CommentMessage } from "@/lib/types";

interface CommentThreadProps {
  comment: Comment;
  onClose: () => void;
  onReply: (text: string) => void;
}

export function CommentThread({ comment, onClose, onReply }: CommentThreadProps) {
  const [replyText, setReplyText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  // Build thread from either the thread array or legacy text/aiResponse fields
  const thread: CommentMessage[] = comment.thread && comment.thread.length > 0
    ? comment.thread
    : [
        { id: "msg-0", role: "user" as const, text: comment.text, createdAt: comment.createdAt },
        ...(comment.aiResponse
          ? [{ id: "msg-1", role: "otto" as const, text: comment.aiResponse, createdAt: comment.createdAt + 1 }]
          : []),
      ];

  // Scroll to bottom when thread updates
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [thread.length]);

  const handleSubmit = () => {
    const trimmed = replyText.trim();
    if (!trimmed) return;
    setReplyText("");
    onReply(trimmed);
  };

  const isWorking = comment.status === "working";

  return (
    <div className="fixed top-4 right-4 z-50 bg-white/50 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.7)] w-[300px] flex flex-col max-h-[480px]">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 pb-2.5">
        <span className="w-6 h-6 rounded-full bg-blue-500/90 text-white text-[11px] font-bold flex items-center justify-center shadow-sm">
          {comment.number}
        </span>
        <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
          Comment #{comment.number}
        </span>
        <button
          onClick={onClose}
          className="ml-auto text-gray-400 hover:text-gray-600 text-sm leading-none p-1 rounded-lg hover:bg-black/5 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Thread messages */}
      <div ref={threadRef} className="flex-1 overflow-y-auto px-4 pb-2 space-y-2.5 min-h-0">
        {thread.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "otto" ? "justify-start" : "justify-end"}`}>
            <div
              className={`rounded-xl px-3 py-2 max-w-[85%] ${
                msg.role === "otto"
                  ? "bg-gray-100/80 text-gray-700"
                  : "bg-blue-500/90 text-white"
              }`}
            >
              {msg.role === "otto" && (
                <div className="text-[10px] font-semibold text-gray-400 mb-0.5">Otto</div>
              )}
              <p className="text-[13px] leading-relaxed">{msg.text}</p>
            </div>
          </div>
        ))}

        {/* Working indicator */}
        {isWorking && (
          <div className="flex justify-start">
            <div className="bg-gray-100/80 rounded-xl px-3 py-2">
              <div className="text-[10px] font-semibold text-gray-400 mb-0.5">Otto</div>
              <div className="flex items-center gap-1.5">
                <div className="flex gap-0.5">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-[11px] text-gray-400">Revising...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reply input */}
      <div className="p-3 pt-1.5 border-t border-gray-200/30">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Reply with another revision..."
            disabled={isWorking}
            className="flex-1 text-[13px] text-gray-800 placeholder-gray-400/60 bg-white/60 backdrop-blur-sm rounded-xl px-3 py-2 outline-none resize-none border border-white/40 focus:border-blue-300/60 focus:bg-white/80 transition-all disabled:opacity-50"
            rows={1}
          />
          <button
            onClick={handleSubmit}
            disabled={!replyText.trim() || isWorking}
            className="text-[12px] font-medium text-white bg-blue-500/90 hover:bg-blue-500 disabled:opacity-30 px-3 py-2 rounded-xl transition-all shadow-sm shrink-0"
          >
            ↵
          </button>
        </div>
      </div>
    </div>
  );
}
