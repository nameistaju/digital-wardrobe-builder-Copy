"use client";

import { useEffect, useRef } from "react";
import { X, Sparkles } from "lucide-react";
import { UploadOptionCards } from "./UploadOptionCards";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UploadModal({ isOpen, onClose }: UploadModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Content */}
      <div
        ref={modalRef}
        className="relative z-10 w-full max-w-2xl bg-[#faf8f5] rounded-3xl border border-stone-200 p-6 sm:p-8 shadow-2xl transition-all"
      >
        <div className="flex items-start justify-between pb-5 border-b border-stone-200">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-stone-500 mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              Digitize Your Wardrobe
            </div>
            <h2 id="modal-title" className="text-xl sm:text-2xl font-semibold tracking-tight text-stone-950 font-serif">
              Select an Ingestion Method
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-2 rounded-xl text-stone-400 hover:text-stone-900 hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-6">
          <UploadOptionCards />
        </div>

        <div className="pt-4 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500 font-mono">
          <span>Zero-budget open-source architecture</span>
          <button
            onClick={onClose}
            className="text-stone-700 hover:text-stone-950 underline underline-offset-4"
          >
            Close window
          </button>
        </div>
      </div>
    </div>
  );
}
