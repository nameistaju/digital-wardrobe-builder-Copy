"use client";

import { useState, useEffect, useRef } from "react";
import { X, Sparkles, Camera, Layers, ArrowLeft } from "lucide-react";
import { IndividualUploadForm } from "./IndividualUploadForm";
import { FullOutfitExtractionFlow } from "./FullOutfitExtractionFlow";
import { Garment } from "@/lib/api";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGarmentAdded: (garment: Garment) => void;
}

export function UploadModal({ isOpen, onClose, onGarmentAdded }: UploadModalProps) {
  const [mode, setMode] = useState<"select" | "individual" | "full-outfit">("select");
  const modalRef = useRef<HTMLDivElement>(null);

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

  // Reset mode when closing
  useEffect(() => {
    if (!isOpen) setMode("select");
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      <div
        className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div
        ref={modalRef}
        className="relative z-10 w-full max-w-2xl bg-[#faf8f5] rounded-3xl border border-stone-200 p-6 sm:p-8 shadow-2xl transition-all max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-5 border-b border-stone-200">
          <div className="flex items-center gap-3">
            {mode !== "select" && (
              <button
                type="button"
                onClick={() => setMode("select")}
                className="p-1.5 rounded-lg border border-stone-300 hover:bg-stone-100 text-stone-700 transition-colors"
                title="Back to options"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-stone-500 mb-0.5">
                <Sparkles className="w-3.5 h-3.5" />
                Digitize Your Wardrobe
              </div>
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-stone-950 font-serif">
                {mode === "select" && "Select Ingestion Method"}
                {mode === "individual" && "Add Individual Clothing Item"}
                {mode === "full-outfit" && "Extract from Full Outfit Photo"}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-900 hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="py-6">
          {mode === "select" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {/* Option 1: Full Outfit Photo */}
              <div
                onClick={() => setMode("full-outfit")}
                className="group flex flex-col justify-between p-6 rounded-2xl border border-stone-200 bg-white hover:border-stone-900 hover:shadow-md cursor-pointer transition-all duration-200"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-stone-100 text-stone-900 flex items-center justify-center border border-stone-200 group-hover:bg-stone-900 group-hover:text-stone-50 transition-colors">
                      <Camera className="w-6 h-6" />
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-wide px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
                      <Sparkles className="w-3 h-3 text-stone-500" />
                      AI Vision
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-stone-900 font-serif">
                      Full Outfit Photo
                    </h3>
                    <p className="text-xs font-mono text-stone-500 mt-0.5">
                      Automated AI Garment Extraction
                    </p>
                  </div>
                  <p className="text-sm text-stone-600 leading-relaxed">
                    Upload a single head-to-toe photo. Our vision pipeline isolates each garment (tops, bottoms, footwear) with transparent background cutouts.
                  </p>
                </div>
                <div className="pt-6 mt-4 border-t border-stone-100">
                  <span className="w-full flex items-center justify-center py-2.5 px-4 rounded-xl bg-stone-900 text-stone-50 text-sm font-medium group-hover:bg-stone-800 transition-colors">
                    Upload Outfit Photo
                  </span>
                </div>
              </div>

              {/* Option 2: Individual Item */}
              <div
                onClick={() => setMode("individual")}
                className="group flex flex-col justify-between p-6 rounded-2xl border border-stone-200 bg-white hover:border-stone-900 hover:shadow-md cursor-pointer transition-all duration-200"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-stone-100 text-stone-900 flex items-center justify-center border border-stone-200 group-hover:bg-stone-900 group-hover:text-stone-50 transition-colors">
                      <Layers className="w-6 h-6" />
                    </div>
                    <span className="inline-flex items-center text-[11px] font-mono uppercase tracking-wide px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
                      Direct Upload
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-stone-900 font-serif">
                      Individual Item
                    </h3>
                    <p className="text-xs font-mono text-stone-500 mt-0.5">
                      Single Garment & Attributes
                    </p>
                  </div>
                  <p className="text-sm text-stone-600 leading-relaxed">
                    Upload a photo of a single clothing item with category tags, color, brand, and optional automatic background removal.
                  </p>
                </div>
                <div className="pt-6 mt-4 border-t border-stone-100">
                  <span className="w-full flex items-center justify-center py-2.5 px-4 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm font-medium group-hover:bg-stone-50 transition-colors">
                    Upload Single Item
                  </span>
                </div>
              </div>
            </div>
          )}

          {mode === "individual" && (
            <IndividualUploadForm
              onSuccess={(garment) => {
                onGarmentAdded(garment);
                onClose();
              }}
              onCancel={() => setMode("select")}
            />
          )}

          {mode === "full-outfit" && (
            <FullOutfitExtractionFlow
              onGarmentAdded={onGarmentAdded}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
