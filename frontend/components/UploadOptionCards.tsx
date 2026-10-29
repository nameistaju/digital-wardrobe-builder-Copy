"use client";

import { useState } from "react";
import { Camera, Layers, Sparkles, ArrowRight, Info, Check } from "lucide-react";

interface UploadOptionCardsProps {
  onSelectOption?: (optionId: "full-outfit" | "individual") => void;
}

export function UploadOptionCards({ onSelectOption }: UploadOptionCardsProps) {
  const [selectedNotice, setSelectedNotice] = useState<string | null>(null);

  const handleCardClick = (type: "full-outfit" | "individual") => {
    if (onSelectOption) {
      onSelectOption(type);
    }
    if (type === "full-outfit") {
      setSelectedNotice(
        "Full Outfit AI Segmentation: This feature will be introduced in Phase 2 using open-source vision models to isolate individual garments from full-body photos."
      );
    } else {
      setSelectedNotice(
        "Individual Item Cataloging: Manual photo capture and categorized uploading (tops, bottoms, footwear, bags) will be introduced in Phase 2."
      );
    }
  };

  return (
    <div className="w-full space-y-4">
      {selectedNotice && (
        <div
          role="status"
          aria-live="polite"
          className="p-4 rounded-xl border border-stone-300 bg-stone-100/90 text-stone-800 text-sm flex items-start gap-3 transition-all animate-in fade-in slide-in-from-top-1"
        >
          <Info className="w-5 h-5 text-stone-700 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-stone-900 mb-0.5">Coming in Phase 2</p>
            <p className="text-stone-600 leading-relaxed">{selectedNotice}</p>
          </div>
          <button
            onClick={() => setSelectedNotice(null)}
            className="text-stone-400 hover:text-stone-700 text-xs font-mono uppercase tracking-wider px-1.5 py-0.5 rounded hover:bg-stone-200"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Option 1: Full Outfit Photo */}
        <div className="relative group flex flex-col justify-between p-6 sm:p-7 rounded-2xl border border-stone-200/90 bg-white shadow-xs hover:border-stone-400 hover:shadow-md transition-all duration-200">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-stone-100 text-stone-900 flex items-center justify-center border border-stone-200 group-hover:bg-stone-900 group-hover:text-stone-50 transition-colors">
                <Camera className="w-6 h-6" />
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-wide px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
                <Sparkles className="w-3 h-3 text-stone-500" />
                Phase 2 AI
              </span>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-semibold tracking-tight text-stone-900 font-serif">
                Full Outfit Photo
              </h3>
              <p className="text-xs font-mono text-stone-500 uppercase tracking-wider">
                Automated AI Garment Extraction
              </p>
            </div>

            <p className="text-sm text-stone-600 leading-relaxed">
              Upload a single full-body picture of yourself wearing an outfit. AI vision models will isolate garments, remove background noise, and categorize items automatically.
            </p>

            <ul className="text-xs text-stone-500 space-y-1.5 pt-1">
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-stone-400" />
                Detects tops, bottoms, outerwear & shoes
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-stone-400" />
                Automated zero-budget background extraction
              </li>
            </ul>
          </div>

          <div className="pt-6 mt-6 border-t border-stone-100">
            <button
              type="button"
              onClick={() => handleCardClick("full-outfit")}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-stone-900 text-stone-50 text-sm font-medium hover:bg-stone-800 active:scale-[0.99] transition-all group-hover:shadow-sm"
            >
              <span>Select Full Outfit</span>
              <ArrowRight className="w-4 h-4 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <p className="text-center text-[11px] text-stone-600 mt-2 font-mono">
              Controlled mock — Phase 2 feature
            </p>
          </div>
        </div>

        {/* Option 2: Individual Items */}
        <div className="relative group flex flex-col justify-between p-6 sm:p-7 rounded-2xl border border-stone-200/90 bg-white shadow-xs hover:border-stone-400 hover:shadow-md transition-all duration-200">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-stone-100 text-stone-900 flex items-center justify-center border border-stone-200 group-hover:bg-stone-900 group-hover:text-stone-50 transition-colors">
                <Layers className="w-6 h-6" />
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-wide px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
                Phase 2 Manual
              </span>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-semibold tracking-tight text-stone-900 font-serif">
                Individual Items
              </h3>
              <p className="text-xs font-mono text-stone-500 uppercase tracking-wider">
                Direct Category Upload
              </p>
            </div>

            <p className="text-sm text-stone-600 leading-relaxed">
              Upload standalone photos or flat-lays of specific garments. Categorize directly into tops, bottoms, shoes, bags, and accessories with custom tags and colors.
            </p>

            <ul className="text-xs text-stone-500 space-y-1.5 pt-1">
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-stone-400" />
                Upload isolated pieces and retail captures
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-stone-400" />
                Explicit category and attribute tagging
              </li>
            </ul>
          </div>

          <div className="pt-6 mt-6 border-t border-stone-100">
            <button
              type="button"
              onClick={() => handleCardClick("individual")}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm font-medium hover:bg-stone-50 active:scale-[0.99] transition-all group-hover:border-stone-400"
            >
              <span>Upload Individual Items</span>
              <ArrowRight className="w-4 h-4 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <p className="text-center text-[11px] text-stone-600 mt-2 font-mono">
              Controlled mock — Phase 2 feature
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
