"use client";

import { Sparkles, Plus, Shirt, Compass } from "lucide-react";
import { UploadOptionCards } from "./UploadOptionCards";

interface EmptyStateProps {
  onOpenUpload: () => void;
}

export function EmptyState({ onOpenUpload }: EmptyStateProps) {
  return (
    <div className="space-y-12 sm:space-y-16">
      {/* Hero / Welcoming Dashboard Header */}
      <section className="space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-stone-200 bg-white text-stone-700 text-xs font-mono tracking-wide">
          <Sparkles className="w-3.5 h-3.5 text-stone-500" />
          <span>Local Development Environment Active</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-stone-200">
          <div className="space-y-2 max-w-2xl">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-stone-950 font-serif leading-[1.15]">
              Curate, organize, and style your everyday wardrobe.
            </h1>
            <p className="text-base sm:text-lg text-stone-600 leading-relaxed font-sans">
              A private, zero-budget digital wardrobe builder designed to digitize garments, isolate clothing pieces with AI, and curate effortless outfits.
            </p>
          </div>

          <div className="shrink-0">
            <button
              onClick={onOpenUpload}
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-stone-950 text-stone-50 text-sm font-medium hover:bg-stone-800 active:scale-[0.98] transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-stone-950 focus:ring-offset-2"
            >
              <Plus className="w-4 h-4 text-stone-300" />
              <span>Add Clothes</span>
            </button>
          </div>
        </div>
      </section>

      {/* Empty Wardrobe State Showcase */}
      <section
        id="wardrobe"
        className="relative overflow-hidden rounded-3xl border border-stone-200/90 bg-white p-8 sm:p-12 lg:p-16 text-center shadow-xs"
      >
        <div className="max-w-md mx-auto space-y-6">
          {/* Subtle Icon Badge */}
          <div className="relative mx-auto w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-stone-50 border border-stone-200/80 flex items-center justify-center text-stone-800 shadow-inner">
            <Shirt className="w-10 h-10 sm:w-12 sm:h-12 text-stone-700 stroke-[1.25]" />
            <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-stone-900 text-stone-50 flex items-center justify-center text-[10px] font-mono">
              0
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-stone-900 font-serif">
              Your wardrobe is currently empty
            </h2>
            <p className="text-sm sm:text-base text-stone-600 leading-relaxed">
              You haven&apos;t added any clothing items yet. Once digitized, your garments will be cataloged by category (tops, bottoms, outerwear, footwear, accessories) ready for outfit generation.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onOpenUpload}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-stone-900 text-stone-50 text-sm font-medium hover:bg-stone-800 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4 text-stone-300" />
              Add Clothes Now
            </button>
            <a
              href="#upload-methods"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-stone-200 bg-stone-50 text-stone-700 text-sm font-medium hover:bg-stone-100 transition-colors"
            >
              <Compass className="w-4 h-4 text-stone-500" />
              View Ingestion Methods
            </a>
          </div>

          <p className="text-xs font-mono text-stone-600 pt-2">
            Phase 1 Foundation • Zero mock items injected
          </p>
        </div>
      </section>

      {/* Upload Methods Section (Desktop & Mobile Responsive) */}
      <section id="upload-methods" className="space-y-6 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-stone-200 pb-3">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-stone-500">
              Ingestion Architecture
            </span>
            <h2 className="text-2xl font-semibold tracking-tight text-stone-950 font-serif">
              Planned Ingestion Pathways
            </h2>
          </div>
          <p className="text-xs text-stone-500 font-mono">
            Two distinct ingestion modes for flexibility
          </p>
        </div>

        <UploadOptionCards />
      </section>
    </div>
  );
}
