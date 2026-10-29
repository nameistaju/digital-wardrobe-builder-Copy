"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  Sparkles,
  Upload,
  User,
  Shirt,
  Download,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Sliders,
  History,
  X,
  ExternalLink,
  ChevronRight,
  Info,
} from "lucide-react";
import {
  Garment,
  TryOnRecord,
  TryOnStatusResponse,
  getTryOnStatus,
  generateVirtualTryOn,
  getTryOnHistory,
  getImageUrl,
} from "@/lib/api";

interface TryOnStudioProps {
  garments: Garment[];
  initialSelectedGarment?: Garment | null;
  onOpenUpload?: () => void;
}

const PRESET_PROMPTS = [
  "Photorealistic natural fit with subtle fabric folds",
  "Tuck in neatly at the waist with belt visible",
  "Wear unbuttoned as an open layering piece",
  "Tailored silhouette with crisp shoulders and seams",
  "Relaxed oversized street-style drape",
];

export function TryOnStudio({ garments, initialSelectedGarment, onOpenUpload }: TryOnStudioProps) {
  // Config state
  const [status, setStatus] = useState<TryOnStatusResponse | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Input states
  const [personFile, setPersonFile] = useState<File | null>(null);
  const [personPreview, setPersonPreview] = useState<string | null>(null);

  const [garmentMode, setGarmentMode] = useState<"wardrobe" | "upload">(
    initialSelectedGarment ? "wardrobe" : garments.length > 0 ? "wardrobe" : "upload"
  );
  const [selectedGarmentId, setSelectedGarmentId] = useState<number | null>(
    initialSelectedGarment?.id || null
  );
  const [garmentFile, setGarmentFile] = useState<File | null>(null);
  const [garmentPreview, setGarmentPreview] = useState<string | null>(null);

  // Qwen Model Choice
  const [selectedQwenModel, setSelectedQwenModel] = useState<"qwen-image-edit" | "qwen-image">("qwen-image-edit");

  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Result state
  const [currentResult, setCurrentResult] = useState<TryOnRecord | null>(null);
  const [history, setHistory] = useState<TryOnRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const personInputRef = useRef<HTMLInputElement>(null);
  const garmentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkServiceStatus();
    loadHistory();
  }, []);

  useEffect(() => {
    if (initialSelectedGarment) {
      setSelectedGarmentId(initialSelectedGarment.id);
      setGarmentMode("wardrobe");
    }
  }, [initialSelectedGarment]);

  const checkServiceStatus = async () => {
    setCheckingStatus(true);
    try {
      const res = await getTryOnStatus();
      setStatus(res);
    } catch (err) {
      console.error("Failed to fetch try-on status:", err);
    } finally {
      setCheckingStatus(false);
    }
  };

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await getTryOnHistory(10);
      setHistory(res.items);
    } catch (err) {
      console.error("Failed to load try-on history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handlePersonFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPersonFile(file);
      setPersonPreview(URL.createObjectURL(file));
      setError(null);
    }
  };

  const handleGarmentFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setGarmentFile(file);
      setGarmentPreview(URL.createObjectURL(file));
      setSelectedGarmentId(null);
      setError(null);
    }
  };

  const selectedWardrobeGarment = garments.find((g) => g.id === selectedGarmentId);

  const handleGenerate = async () => {
    if (!personFile) {
      setError("Please upload your photo to try on clothes.");
      return;
    }

    if (garmentMode === "upload" && !garmentFile) {
      setError("Please upload a garment image or select one from your wardrobe.");
      return;
    }

    if (garmentMode === "wardrobe" && !selectedGarmentId) {
      setError("Please select a clothing item from your wardrobe.");
      return;
    }

    setError(null);
    setIsGenerating(true);
    const modelName = selectedQwenModel === "qwen-image-edit" ? "Qwen-Image-Edit" : "Qwen-Image";
    setGeneratingStep(`Preparing images for NVIDIA ${modelName}...`);

    try {
      const formData = new FormData();
      formData.append("person_image", personFile);
      formData.append("model", selectedQwenModel);

      if (garmentMode === "upload" && garmentFile) {
        formData.append("garment_image", garmentFile);
      } else if (garmentMode === "wardrobe" && selectedGarmentId) {
        formData.append("garment_id", selectedGarmentId.toString());
      }

      if (customPrompt.trim()) {
        formData.append("prompt", customPrompt.trim());
      }

      setGeneratingStep(`Generating realistic try-on via NVIDIA ${modelName}...`);

      const record = await generateVirtualTryOn(formData);
      setCurrentResult(record);
      setHistory((prev) => [record, ...prev]);
    } catch (err: any) {
      console.error("Virtual Try-On error:", err);
      setError(
        err?.message ||
          "Virtual Try-On generation failed. Please check your backend connection."
      );
    } finally {
      setIsGenerating(false);
      setGeneratingStep("");
    }
  };

  const downloadImage = async (url: string, filename: string = "tryon-look.png") => {
    try {
      const fullUrl = getImageUrl(url);
      const res = await fetch(fullUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Download failed:", err);
      window.open(getImageUrl(url), "_blank");
    }
  };

  return (
    <div className="space-y-8">
      {/* Studio Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-amber-50 text-amber-900 border border-amber-200 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>
              {selectedQwenModel === "qwen-image-edit"
                ? "NVIDIA NIM: Qwen-Image-Edit"
                : "NVIDIA NIM: Qwen-Image Foundation"}
            </span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-950 font-serif">
            AI Virtual Try-On Studio
          </h1>
          <p className="text-sm text-stone-600 mt-1 max-w-2xl">
            See yourself in any garment from your wardrobe or an uploaded clothing item using Alibaba Cloud &amp; NVIDIA Qwen AI models.
          </p>
        </div>

        {/* Model Status Badge */}
        <div className="flex items-center gap-3">
          {status?.is_configured ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>NVIDIA Qwen Key Active</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 font-medium">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>NVIDIA API Key Required</span>
            </div>
          )}
        </div>
      </div>

      {/* Qwen Models Selector (Choose Between Two Qwen Models) */}
      <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-200 space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-mono uppercase tracking-wider text-stone-600 font-medium flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            Choose Qwen Model Engine
          </label>
          <span className="text-[11px] text-stone-400 font-mono">2 Models Configured</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setSelectedQwenModel("qwen-image-edit")}
            className={`p-3.5 rounded-xl text-left border transition-all flex flex-col justify-between gap-1.5 ${
              selectedQwenModel === "qwen-image-edit"
                ? "bg-white border-stone-900 shadow-xs ring-1 ring-stone-900 font-semibold text-stone-950"
                : "bg-stone-100/60 border-stone-200 text-stone-600 hover:bg-stone-100"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-semibold text-stone-900 flex items-center gap-1.5">
                Qwen-Image-Edit
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-medium font-mono">
                Recommended
              </span>
            </div>
            <p className="text-[11px] text-stone-500 font-normal leading-relaxed">
              Image-to-image foundation editing NIM. Performs contextual garment fitting, fabric drape, seams, and shadows directly onto your photo.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedQwenModel("qwen-image")}
            className={`p-3.5 rounded-xl text-left border transition-all flex flex-col justify-between gap-1.5 ${
              selectedQwenModel === "qwen-image"
                ? "bg-white border-stone-900 shadow-xs ring-1 ring-stone-900 font-semibold text-stone-950"
                : "bg-stone-100/60 border-stone-200 text-stone-600 hover:bg-stone-100"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-semibold text-stone-900 flex items-center gap-1.5">
                Qwen-Image
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 font-medium font-mono">
                New Foundation
              </span>
            </div>
            <p className="text-[11px] text-stone-500 font-normal leading-relaxed">
              Diffusion-based vision-language foundation model. Supports precise multilingual text rendering and multimodal visual synthesis.
            </p>
          </button>
        </div>
      </div>

      {/* NVIDIA NIM Setup / Endpoint Notice */}
      {!status?.is_configured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5 text-amber-950">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <div className="font-semibold text-amber-900">
                Setup NVIDIA Qwen NIM Containers
              </div>
              <p className="text-amber-800/90 leading-relaxed">
                Qwen models are distributed as NVIDIA NIM containers (<code className="px-1.5 py-0.5 rounded bg-amber-100 font-mono text-xs">nvcr.io/nim/qwen/qwen-image-edit:latest</code> and <code className="px-1.5 py-0.5 rounded bg-amber-100 font-mono text-xs">nvcr.io/nim/qwen/qwen-image:latest</code>).
                To enable AI try-on, configure <code className="px-1.5 py-0.5 rounded bg-amber-100 font-mono text-xs">NVIDIA_API_KEY</code> in <code className="px-1.5 py-0.5 rounded bg-amber-100 font-mono text-xs">backend/.env</code>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Studio Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Input Configuration (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Slot 1: Your Photo */}
            <div className="flex flex-col rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono uppercase tracking-wider text-stone-500 font-medium flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-stone-700" />
                  1. Your Photo
                </span>
                {personPreview && (
                  <button
                    onClick={() => {
                      setPersonFile(null);
                      setPersonPreview(null);
                    }}
                    className="text-xs text-stone-400 hover:text-stone-700"
                  >
                    Clear
                  </button>
                )}
              </div>

              {personPreview ? (
                <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden bg-stone-100 border border-stone-200 group">
                  <Image
                    src={personPreview}
                    alt="Person preview"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-stone-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => personInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg bg-white/90 text-xs font-medium text-stone-900 shadow-sm"
                    >
                      Change Photo
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => personInputRef.current?.click()}
                  className="flex-1 min-h-[220px] rounded-xl border-2 border-dashed border-stone-200 hover:border-stone-400 bg-stone-50/50 hover:bg-stone-50 flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 mb-2">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-stone-800">
                    Upload your photo
                  </span>
                  <span className="text-[11px] text-stone-500 mt-1 max-w-[160px]">
                    Full-body or torso shot, facing forward
                  </span>
                </div>
              )}

              <input
                ref={personInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePersonFileSelect}
              />
            </div>

            {/* Slot 2: Garment Selection */}
            <div className="flex flex-col rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono uppercase tracking-wider text-stone-500 font-medium flex items-center gap-1.5">
                  <Shirt className="w-3.5 h-3.5 text-stone-700" />
                  2. Garment to Try On
                </span>
              </div>

              {/* Garment Source Mode Tabs */}
              <div className="grid grid-cols-2 p-0.5 rounded-lg bg-stone-100 mb-3 text-xs font-medium text-stone-600">
                <button
                  type="button"
                  onClick={() => setGarmentMode("wardrobe")}
                  className={`py-1.5 rounded-md transition-all ${
                    garmentMode === "wardrobe"
                      ? "bg-white text-stone-900 shadow-xs"
                      : "hover:text-stone-900"
                  }`}
                >
                  My Wardrobe ({garments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setGarmentMode("upload")}
                  className={`py-1.5 rounded-md transition-all ${
                    garmentMode === "upload"
                      ? "bg-white text-stone-900 shadow-xs"
                      : "hover:text-stone-900"
                  }`}
                >
                  Upload New
                </button>
              </div>

              {garmentMode === "wardrobe" ? (
                selectedWardrobeGarment ? (
                  <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden bg-stone-100 border border-stone-200 group">
                    <Image
                      src={getImageUrl(selectedWardrobeGarment.image_url)}
                      alt={selectedWardrobeGarment.name}
                      fill
                      className="object-contain p-2"
                      unoptimized
                    />
                    <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-stone-900/80 to-transparent text-white">
                      <div className="text-xs font-semibold truncate">
                        {selectedWardrobeGarment.name}
                      </div>
                      <div className="text-[10px] text-stone-300 capitalize">
                        {selectedWardrobeGarment.category}
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedGarmentId(null)}
                      className="absolute top-2 right-2 p-1 rounded-full bg-stone-900/60 text-white hover:bg-stone-900"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 min-h-[220px] overflow-y-auto max-h-[260px] pr-1 space-y-2">
                    {garments.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center p-4 text-center">
                        <p className="text-xs text-stone-500 mb-2">No wardrobe items yet.</p>
                        <button
                          onClick={onOpenUpload}
                          className="text-xs font-medium text-stone-900 underline"
                        >
                          Add clothing first
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {garments.map((g) => (
                          <div
                            key={g.id}
                            onClick={() => setSelectedGarmentId(g.id)}
                            className={`p-2 rounded-xl border text-left cursor-pointer transition-all flex flex-col items-center ${
                              selectedGarmentId === g.id
                                ? "border-stone-900 bg-stone-50 ring-1 ring-stone-900"
                                : "border-stone-200 hover:border-stone-300 bg-white"
                            }`}
                          >
                            <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-stone-50 mb-1.5">
                              <Image
                                src={getImageUrl(g.image_url)}
                                alt={g.name}
                                fill
                                className="object-contain p-1"
                                unoptimized
                              />
                            </div>
                            <span className="text-[11px] font-medium text-stone-900 truncate w-full text-center">
                              {g.name}
                            </span>
                            <span className="text-[10px] text-stone-400 capitalize">
                              {g.category}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              ) : garmentPreview ? (
                <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden bg-stone-100 border border-stone-200 group">
                  <Image
                    src={garmentPreview}
                    alt="Garment preview"
                    fill
                    className="object-contain p-2"
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-stone-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => garmentInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg bg-white/90 text-xs font-medium text-stone-900 shadow-sm"
                    >
                      Change Photo
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => garmentInputRef.current?.click()}
                  className="flex-1 min-h-[220px] rounded-xl border-2 border-dashed border-stone-200 hover:border-stone-400 bg-stone-50/50 hover:bg-stone-50 flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 mb-2">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-stone-800">
                    Upload product photo
                  </span>
                  <span className="text-[11px] text-stone-500 mt-1 max-w-[160px]">
                    Isolated clothing item or flat-lay photo
                  </span>
                </div>
              )}

              <input
                ref={garmentInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleGarmentFileSelect}
              />
            </div>
          </div>

          {/* Styling & Drape Customization */}
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-stone-500 font-medium flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-stone-700" />
                Styling & Fit Instructions (Optional)
              </span>
            </div>

            {/* Preset chips */}
            <div className="flex flex-wrap gap-1.5">
              {PRESET_PROMPTS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCustomPrompt(preset)}
                  className={`text-[11px] px-2.5 py-1 rounded-full transition-colors border ${
                    customPrompt === preset
                      ? "bg-stone-900 text-stone-50 border-stone-900"
                      : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            <textarea
              rows={2}
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g. Fit this garment naturally, tuck in at the waist, preserve original hairstyle and jewelry..."
              className="w-full text-xs p-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-stone-900 transition-all resize-none text-stone-800"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className={`w-full py-3.5 px-6 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${
              isGenerating
                ? "bg-stone-200 text-stone-500 cursor-not-allowed"
                : "bg-stone-900 text-stone-50 hover:bg-stone-800 active:scale-[0.99]"
            }`}
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                <span>{generatingStep || "Generating AI Try-On..."}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Generate Real AI Try-On</span>
              </>
            )}
          </button>
        </div>

        {/* Right Column: AI Try-On Showcase & Results (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <span className="text-xs font-mono uppercase tracking-wider text-stone-500 font-medium">
                AI Generation Result
              </span>
              {currentResult && (
                <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Ready
                </span>
              )}
            </div>

            {currentResult ? (
              <div className="space-y-4">
                <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden bg-stone-900/5 border border-stone-200 shadow-inner group">
                  <Image
                    src={getImageUrl(currentResult.result_image_url)}
                    alt="AI Try-On Result"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>

                {currentResult.prompt && (
                  <p className="text-xs text-stone-500 italic bg-stone-50 p-2.5 rounded-lg border border-stone-100">
                    &ldquo;{currentResult.prompt}&rdquo;
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      downloadImage(
                        currentResult.result_image_url,
                        `wardrobe-tryon-${currentResult.id}.png`
                      )
                    }
                    className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-stone-900 text-stone-50 text-xs font-medium hover:bg-stone-800 transition-colors shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download High-Res Look</span>
                  </button>

                  <button
                    onClick={() => {
                      setCurrentResult(null);
                    }}
                    className="py-2.5 px-4 rounded-xl border border-stone-200 text-stone-700 text-xs font-medium hover:bg-stone-50 transition-colors"
                  >
                    Try Another
                  </button>
                </div>
              </div>
            ) : isGenerating ? (
              <div className="aspect-[3/4] w-full rounded-xl border border-stone-200 bg-stone-50/50 flex flex-col items-center justify-center p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-white border border-stone-200 shadow-sm flex items-center justify-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-stone-900" />
                </div>
                <div className="text-xs font-medium text-stone-900">
                  {generatingStep || "AI Processing..."}
                </div>
                <p className="text-[11px] text-stone-500 max-w-[220px]">
                  NVIDIA Qwen-Image-Edit is applying photorealistic cloth simulation.
                </p>
              </div>
            ) : (
              <div className="aspect-[3/4] w-full rounded-xl border-2 border-dashed border-stone-200 bg-stone-50/30 flex flex-col items-center justify-center p-6 text-center text-stone-400 space-y-2">
                <Sparkles className="w-8 h-8 text-stone-300" />
                <span className="text-xs font-medium text-stone-600">
                  Your generated look will appear here
                </span>
                <span className="text-[11px] text-stone-400 max-w-[200px]">
                  Select your photo and a garment to preview the realistic AI try-on.
                </span>
              </div>
            )}
          </div>

          {/* Past History Drawer / Card */}
          {history.length > 0 && (
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-stone-500 font-medium flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-stone-700" />
                  Recent Looks ({history.length})
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setCurrentResult(item)}
                    className="relative aspect-[3/4] rounded-lg overflow-hidden border border-stone-200 hover:border-stone-900 cursor-pointer group bg-stone-100"
                  >
                    <Image
                      src={getImageUrl(item.result_image_url)}
                      alt={`Look #${item.id}`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                    <div className="absolute inset-0 bg-stone-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <ChevronRight className="w-4 h-4 text-white" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
