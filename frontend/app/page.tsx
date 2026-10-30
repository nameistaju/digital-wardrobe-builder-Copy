"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import {
  Download,
  RotateCcw,
  AlertCircle,
  X,
  Loader2,
} from "lucide-react";
import {
  TryOnRecord,
  TryOnStatusResponse,
  getTryOnStatus,
  generateVirtualTryOn,
  getTryOnHistory,
  getImageUrl,
} from "@/lib/api";

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

function validateImageFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return "File exceeds the 15MB size limit.";
  }
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return "Unsupported file type. Please upload a JPG, PNG, or WebP image.";
  }
  return null;
}

const CATEGORIES = ["Tops", "Pants", "Dresses", "Full look"] as const;
const FITS = ["Natural", "Tucked in", "Worn open", "Oversized"] as const;

const CATEGORY_MAP: Record<string, string> = {
  "Tops": "upper_body",
  "Pants": "lower_body",
  "Dresses": "dresses",
  "Full look": "full_look",
};

export default function WhearingApp() {
  // Service health
  const [, setServiceStatus] = useState<TryOnStatusResponse | null>(null);

  // Inputs
  const [personFile, setPersonFile] = useState<File | null>(null);
  const [personPreview, setPersonPreview] = useState<string | null>(null);
  const [personError, setPersonError] = useState<string | null>(null);

  const [garmentFile, setGarmentFile] = useState<File | null>(null);
  const [garmentPreview, setGarmentPreview] = useState<string | null>(null);
  const [garmentError, setGarmentError] = useState<string | null>(null);

  // Options
  const [selectedCategory, setSelectedCategory] = useState<string>("Tops");
  const [selectedFit, setSelectedFit] = useState<string>("Natural");
  const [extraNotes, setExtraNotes] = useState<string>("");

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentResult, setCurrentResult] = useState<TryOnRecord | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // History
  const [history, setHistory] = useState<TryOnRecord[]>([]);

  // Refs
  const personInputRef = useRef<HTMLInputElement>(null);
  const garmentInputRef = useRef<HTMLInputElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const mainButtonRef = useRef<HTMLButtonElement>(null);

  // Floating button visibility observer
  const [isMainButtonVisible, setIsMainButtonVisible] = useState(true);

  const isReadyToTryOn = Boolean(personFile && garmentFile);
  const showFloatingButton = !isMainButtonVisible && isReadyToTryOn;

  // Intersection Observer on the main button
  useEffect(() => {
    const target = mainButtonRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsMainButtonVisible(entry.isIntersecting);
      },
      { threshold: 0.3 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  // Load history safely
  const fetchHistory = useCallback(async () => {
    try {
      const res = await getTryOnHistory(12, 0);
      setHistory(res.items);
    } catch {
      // Handled silently
    }
  }, []);

  // Check health and initialize session
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const status = await getTryOnStatus();
        if (isMounted) setServiceStatus(status);
      } catch {
        if (isMounted) {
          setServiceStatus({
            is_configured: false,
            status: "unavailable",
            model_name: "IDM-VTON",
            endpoint: "yisol/IDM-VTON",
            detail: "Could not connect to virtual try-on backend.",
          });
        }
      }

      fetchHistory();
    }

    init();
    return () => {
      isMounted = false;
    };
  }, [fetchHistory]);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (personPreview && personPreview.startsWith("blob:")) URL.revokeObjectURL(personPreview);
      if (garmentPreview && garmentPreview.startsWith("blob:")) URL.revokeObjectURL(garmentPreview);
    };
  }, [personPreview, garmentPreview]);

  // File Handlers
  const handlePersonSelect = (file: File) => {
    const err = validateImageFile(file);
    if (err) {
      setPersonError(err);
      return;
    }
    setPersonError(null);
    setPersonFile(file);
    if (personPreview && personPreview.startsWith("blob:")) URL.revokeObjectURL(personPreview);
    setPersonPreview(URL.createObjectURL(file));
  };

  const handleGarmentSelect = (file: File) => {
    const err = validateImageFile(file);
    if (err) {
      setGarmentError(err);
      return;
    }
    setGarmentError(null);
    setGarmentFile(file);
    if (garmentPreview && garmentPreview.startsWith("blob:")) URL.revokeObjectURL(garmentPreview);
    setGarmentPreview(URL.createObjectURL(file));
  };

  const clearPerson = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (personPreview && personPreview.startsWith("blob:")) URL.revokeObjectURL(personPreview);
    setPersonFile(null);
    setPersonPreview(null);
    setPersonError(null);
    if (personInputRef.current) personInputRef.current.value = "";
  };

  const clearGarment = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (garmentPreview && garmentPreview.startsWith("blob:")) URL.revokeObjectURL(garmentPreview);
    setGarmentFile(null);
    setGarmentPreview(null);
    setGarmentError(null);
    if (garmentInputRef.current) garmentInputRef.current.value = "";
  };

  const handleClearAll = () => {
    clearPerson();
    clearGarment();
    setExtraNotes("");
    setCurrentResult(null);
    setGenerationError(null);
  };

  // Generate Try-On
  const handleGenerate = async () => {
    if (!personFile) {
      setPersonError("Please upload your photo.");
      return;
    }
    if (!garmentFile) {
      setGarmentError("Please upload a garment photo.");
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);

    const formData = new FormData();
    formData.append("person_image", personFile);
    formData.append("garment_image", garmentFile);

    // Send category, fit and notes per requirements
    const catCode = CATEGORY_MAP[selectedCategory] || "upper_body";
    const fitCode = selectedFit.toLowerCase().replace(/\s+/g, "_");
    formData.append("category", catCode);
    formData.append("fit", fitCode);
    if (extraNotes.trim()) {
      formData.append("notes", extraNotes.trim());
    }

    // Build standard prompt for backward compatibility
    const promptParts = [
      `Category: ${selectedCategory}`,
      `Fit: ${selectedFit}`,
    ];
    if (extraNotes.trim()) {
      promptParts.push(extraNotes.trim());
    }
    formData.append("prompt", promptParts.join(", "));

    try {
      const record = await generateVirtualTryOn(formData);
      setCurrentResult(record);
      setHistory((prev) => [record, ...prev]);

      // Scroll mirror smoothly into view on success
      setTimeout(() => {
        mirrorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 100);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Virtual try-on generation failed.";
      setGenerationError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadResult = async (url: string, filename: string = "whearing-tryon.png") => {
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
    } catch {
      window.open(getImageUrl(url), "_blank");
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#111] font-dmsans overflow-x-clip selection:bg-[#111] selection:text-white">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 px-6 sm:px-12 py-5 max-w-[1440px] mx-auto">
        <div className="font-marker text-3xl sm:text-[34px] leading-[0.9] -rotate-2 select-none">
          whearing<span className="text-[#2338E0]">:)</span>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-6 sm:px-12 pt-4 pb-8 max-w-[1344px] mx-auto box-border">
        {/* Lightning Bolt SVG */}
        <svg
          width="46"
          height="64"
          viewBox="0 0 28 40"
          className="absolute left-6 sm:left-10 top-[230px] sm:top-[250px] -rotate-8 hidden md:block"
          aria-hidden="true"
        >
          <path
            d="M16 2 3 24h8l-3 14 17-23h-9L22 2Z"
            fill="#FFC81E"
            stroke="#111"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        </svg>

        {/* Big Heading */}
        <h1 className="m-0 font-marker font-normal text-[56px] sm:text-[80px] lg:text-[104px] leading-[0.92] tracking-[-0.02em]">
          SEE IT<br />
          <span className="text-[#2338E0]">ON YOU.</span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 max-w-[430px] text-lg sm:text-[19px] leading-[1.5] font-medium text-[#111]">
          Pick a photo, pick a piece, and see how it really looks. Playful, quick and free of guesswork.
        </p>

        {/* Speech Bubble: HI! PICK A FIT */}
        <div
          className="absolute right-10 sm:right-36 top-10 sm:top-[50px] bg-[#111] text-[#FFC81E] px-6 sm:px-8 py-5 sm:py-6 rounded-[50%_50%_50%_8%] font-marker text-2xl sm:text-[34px] leading-tight -rotate-6 text-center select-none shadow-[4px_4px_0_#FFC81E]"
        >
          HI!<br />PICK<br />A FIT
        </div>

        {/* Red Spiky Creature SVG */}
        <svg
          width="130"
          height="130"
          viewBox="0 0 100 100"
          className="absolute right-4 sm:right-12 top-[180px] sm:top-[210px] rotate-12 hidden lg:block"
          aria-hidden="true"
        >
          <path
            d="M50 3 61 21 82 12 80 34 98 42 83 56 94 75 72 75 68 97 50 83 32 97 28 75 6 75 17 56 2 42 20 34 18 12 39 21Z"
            fill="#E3290F"
            stroke="#111"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <circle cx="40" cy="47" r="9" fill="#fff" stroke="#111" strokeWidth="2.5" />
          <circle cx="62" cy="47" r="9" fill="#fff" stroke="#111" strokeWidth="2.5" />
          <circle cx="42" cy="49" r="3.5" fill="#111" />
          <circle cx="64" cy="49" r="3.5" fill="#111" />
        </svg>

        {/* Red Squiggle SVG */}
        <svg
          width="170"
          height="40"
          viewBox="0 0 170 40"
          className="absolute right-8 sm:right-16 top-[340px] sm:top-[380px] hidden lg:block"
          aria-hidden="true"
        >
          <path
            d="M4 28c14-30 22 22 36-2s22 22 36-2 22 22 36-2 22 22 36-2"
            fill="none"
            stroke="#E3290F"
            strokeWidth="6"
            strokeLinecap="round"
          />
        </svg>
      </section>

      {/* The Fitting Room Section */}
      <section className="bg-[#2338E0] rounded-[28px] sm:rounded-[36px] mx-4 sm:mx-8 p-6 sm:p-10 text-white relative shadow-[6px_6px_0_#111]">
        {/* Title Header */}
        <div className="flex flex-wrap justify-between items-baseline gap-3 mb-6 sm:mb-8">
          <h2 className="m-0 font-marker font-normal text-3xl sm:text-[44px]">
            THE FITTING ROOM
          </h2>
          <span className="font-caveat text-2xl sm:text-[28px] text-[#FFC81E] -rotate-2 select-none">
            three easy steps ↓
          </span>
        </div>

        {/* 3 Step Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-start">
          {/* Card 1: Your Photo */}
          <div className="md:-rotate-2 transition-transform">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-[34px] h-[34px] rounded-full bg-[#FFC81E] text-[#111] grid place-items-center font-bold">
                1
              </span>
              <b className="text-lg">Your photo</b>
            </div>

            <label className="relative block bg-white text-[#111] p-4 pb-14 rounded-md shadow-[6px_6px_0_#111] border-2 border-[#111] cursor-pointer group">
              {/* Red tape top */}
              <span className="absolute -top-3.5 left-1/2 w-[90px] h-7 -ml-[45px] bg-[#E3290F] opacity-90 rotate-3 z-10 pointer-events-none" />

              <input
                ref={personInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePersonSelect(file);
                }}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
              />

              {/* Preview Slot Capped with clamp to fit one screen */}
              <div
                className="flex flex-col items-center justify-center gap-3 bg-[#E8EEFF] rounded text-center p-4 relative overflow-hidden w-full"
                style={{ height: "clamp(320px, 52vh, 480px)" }}
              >
                {personPreview ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <Image
                      src={personPreview}
                      alt="Your photo"
                      fill
                      className="object-contain rounded"
                      unoptimized
                    />
                    {/* 44x44 Remove Button */}
                    <button
                      type="button"
                      onClick={clearPerson}
                      className="absolute top-2 right-2 w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center bg-white text-[#111] rounded-full hover:bg-stone-100 border-2 border-[#111] shadow-[2px_2px_0_#111] z-20 cursor-pointer"
                      title="Remove image"
                      aria-label="Remove photo"
                    >
                      <X className="w-5 h-5 stroke-[2.5]" />
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Yellow smiley icon */}
                    <svg width="60" height="60" viewBox="0 0 64 64" aria-hidden="true">
                      <circle cx="32" cy="32" r="30" fill="#FFC81E" stroke="#111" strokeWidth="3" />
                      <circle cx="23" cy="26" r="3.5" fill="#111" />
                      <circle cx="41" cy="26" r="3.5" fill="#111" />
                      <path d="M19 38c6 10 20 10 26 0" fill="none" stroke="#111" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    <span className="font-marker text-2xl sm:text-[26px]">ADD YOUR PHOTO</span>
                    <span className="text-sm text-[#3C3C3C] max-w-[210px] leading-snug">
                      Full body, facing forward, good light.
                    </span>
                  </>
                )}
              </div>

              <span className="absolute bottom-3.5 left-5 font-caveat text-2xl font-bold text-[#111] select-none">
                {personPreview ? "looking good!" : "that's you →"}
              </span>
            </label>

            {personError && (
              <p className="mt-2 text-xs text-[#FFC81E] bg-[#111] px-2 py-1 rounded inline-block">
                {personError}
              </p>
            )}
          </div>

          {/* Card 2: The Garment */}
          <div className="md:rotate-[1.5deg] transition-transform">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-[34px] h-[34px] rounded-full bg-[#FFC81E] text-[#111] grid place-items-center font-bold">
                2
              </span>
              <b className="text-lg">The garment</b>
            </div>

            <label className="relative block bg-[#FFC81E] text-[#111] p-5 rounded-[12px] shadow-[6px_6px_0_#111] border-2 border-[#111] cursor-pointer group">
              <input
                ref={garmentInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleGarmentSelect(file);
                }}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
              />

              {/* Preview Slot Capped with clamp to fit one screen */}
              <div
                className="flex flex-col items-center justify-center gap-3 border-[3px] border-dashed border-[#111] rounded-md text-center p-4 relative overflow-hidden bg-[#FFC81E] w-full"
                style={{ height: "clamp(320px, 52vh, 480px)" }}
              >
                {garmentPreview ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <Image
                      src={garmentPreview}
                      alt="The garment"
                      fill
                      className="object-contain rounded"
                      unoptimized
                    />
                    {/* 44x44 Remove Button */}
                    <button
                      type="button"
                      onClick={clearGarment}
                      className="absolute top-2 right-2 w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center bg-white text-[#111] rounded-full hover:bg-stone-100 border-2 border-[#111] shadow-[2px_2px_0_#111] z-20 cursor-pointer"
                      title="Remove image"
                      aria-label="Remove garment"
                    >
                      <X className="w-5 h-5 stroke-[2.5]" />
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Hanger Shirt SVG */}
                    <svg
                      width="68"
                      height="68"
                      viewBox="0 0 24 24"
                      fill="#fff"
                      stroke="#111"
                      strokeWidth="1.4"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M9 3 4 6l1.5 4L8 9v11h8V9l2.5 1L20 6l-5-3c-.5 1.5-1.5 2.2-3 2.2S9.5 4.5 9 3Z" />
                    </svg>
                    <span className="font-marker text-2xl sm:text-[26px]">ADD A PIECE</span>
                    <span className="text-sm max-w-[210px] leading-snug">
                      A flat-lay or clean product shot. Shirt, pants, dress, anything.
                    </span>
                  </>
                )}
              </div>
            </label>

            {garmentError && (
              <p className="mt-2 text-xs text-[#FFC81E] bg-[#111] px-2 py-1 rounded inline-block">
                {garmentError}
              </p>
            )}
          </div>

          {/* Card 3: The Mirror (Never cropped, natural proportions, decorative arch) */}
          <div className="md:-rotate-1 transition-transform">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-[34px] h-[34px] rounded-full bg-[#FFC81E] text-[#111] grid place-items-center font-bold">
                3
              </span>
              <b className="text-lg">The mirror</b>
            </div>

            {/*
              Arch frame CSS per requirement:
              border-radius: 50% 50% 16px 16px / 120px 120px 16px 16px;
              padding: 90px 16px 20px;
              NO overflow-hidden on the arch!
            */}
            <div
              ref={mirrorRef}
              className="bg-white text-[#111] shadow-[6px_6px_0_#111] border-2 border-[#111] relative"
              style={{
                borderRadius: "50% 50% 16px 16px / 120px 120px 16px 16px",
                padding: "90px 16px 20px",
                backgroundImage:
                  "linear-gradient(#E4E9F7 1px, transparent 1px), linear-gradient(90deg, #E4E9F7 1px, transparent 1px)",
                backgroundSize: "22px 22px",
              }}
            >
              {currentResult ? (
                <div className="w-full flex flex-col items-center">
                  {/*
                    Result image: width 100%, height auto, display block,
                    no fixed aspect ratio, NO object-cover. Full natural proportions.
                  */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getImageUrl(currentResult.result_image_url)}
                    alt="Try-on result"
                    className="w-full h-auto block rounded-lg border-2 border-[#111] shadow-[4px_4px_0_#111]"
                    style={{ width: "100%", height: "auto", display: "block" }}
                  />

                  {/* Action buttons below the image in a row — never absolutely positioned */}
                  <div className="flex items-center justify-center gap-3 mt-4 w-full">
                    <button
                      onClick={() => downloadResult(currentResult.result_image_url)}
                      className="inline-flex items-center gap-1.5 bg-[#FFC81E] text-[#111] px-4 py-2 rounded-full font-bold text-xs border-2 border-[#111] shadow-[2px_2px_0_#111] hover:scale-105 transition-transform cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                    <button
                      onClick={handleClearAll}
                      className="inline-flex items-center gap-1.5 bg-white text-[#111] px-4 py-2 rounded-full font-bold text-xs border-2 border-[#111] shadow-[2px_2px_0_#111] hover:scale-105 transition-transform cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      New Look
                    </button>
                  </div>
                </div>
              ) : (
                /* Empty / Loading state with min-height ~360px */
                <div className="flex flex-col items-center justify-center text-center w-full min-h-[360px]">
                  {isGenerating ? (
                    <div className="flex flex-col items-center justify-center p-4 motion-safe:animate-pulse">
                      <Loader2 className="w-10 h-10 text-[#2338E0] animate-spin mb-3" />
                      <span className="font-marker text-2xl sm:text-[28px] leading-tight text-[#111]">
                        CHECKING THE MIRROR…
                      </span>
                      <span className="font-caveat text-xl sm:text-2xl font-bold text-[#2338E0] mt-2">
                        about 20 seconds ✎
                      </span>
                    </div>
                  ) : (
                    <>
                      <span className="font-marker text-2xl sm:text-[30px] leading-[1.1] max-w-[240px]">
                        YOUR LOOK<br />SHOWS UP HERE
                      </span>
                      <span className="font-caveat text-2xl sm:text-[26px] font-bold text-[#2338E0] mt-1">
                        about 20 seconds ✎
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            {generationError && (
              <div className="mt-3 bg-red-100 border-2 border-[#E3290F] text-[#111] p-3 rounded-lg text-xs flex items-start gap-2 shadow-[2px_2px_0_#111]">
                <AlertCircle className="w-4 h-4 text-[#E3290F] shrink-0 mt-0.5" />
                <span>{generationError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Options Bar: Changing, Fit, Extra Notes, & TRY IT ON Button with Hint Line */}
        <div className="mt-8 bg-white text-[#111] rounded-[24px] p-6 flex flex-wrap gap-6 items-center justify-between shadow-[6px_6px_0_#111]">
          <div className="flex-1 min-w-[280px] grid gap-3.5">
            {/* Changing row */}
            <div className="flex flex-wrap items-center gap-2">
              <b className="font-caveat text-[26px] min-w-[84px] select-none">Changing</b>
              {CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    role="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedCategory(cat)}
                    className={`min-h-[44px] px-4.5 rounded-full border-2 border-[#111] font-bold text-sm cursor-pointer transition-colors ${
                      isSelected ? "bg-[#FFC81E]" : "bg-white hover:bg-stone-50"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Fit row */}
            <div className="flex flex-wrap items-center gap-2">
              <b className="font-caveat text-[26px] min-w-[84px] select-none">Fit</b>
              {FITS.map((fit) => {
                const isSelected = selectedFit === fit;
                return (
                  <button
                    key={fit}
                    type="button"
                    role="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedFit(fit)}
                    className={`min-h-[44px] px-4.5 rounded-full border-2 border-[#111] font-bold text-sm cursor-pointer transition-colors ${
                      isSelected ? "bg-[#FFC81E]" : "bg-white hover:bg-stone-50"
                    }`}
                  >
                    {fit}
                  </button>
                );
              })}
            </div>

            {/* Extra notes input */}
            <label htmlFor="n" className="sr-only">
              Extra notes
            </label>
            <input
              id="n"
              type="text"
              value={extraNotes}
              onChange={(e) => setExtraNotes(e.target.value)}
              placeholder="Anything else? Sleeves rolled, keep my watch…"
              className="w-full box-border min-h-[48px] px-4.5 rounded-[14px] border-2 border-[#111] font-inherit text-[15px] outline-none focus:ring-2 focus:ring-[#2338E0]"
            />
          </div>

          {/* Main Action Button with Hint Line */}
          <div className="flex flex-col items-center sm:items-end gap-2 w-full sm:w-auto">
            <button
              ref={mainButtonRef}
              onClick={handleGenerate}
              disabled={!isReadyToTryOn || isGenerating}
              className={`min-h-[76px] sm:min-h-[84px] px-8 sm:px-12 rounded-full font-marker text-2xl sm:text-[32px] select-none transition-all w-full sm:w-auto ${
                isReadyToTryOn && !isGenerating
                  ? "bg-[#E3290F] hover:bg-[#c9240d] active:translate-x-1 active:translate-y-1 text-white border-0 shadow-[4px_4px_0_#111] cursor-pointer"
                  : "bg-[#c9c9c9] text-[#4a4a4a] border-2 border-[#111] shadow-none cursor-not-allowed opacity-90"
              }`}
            >
              {isGenerating ? "FITTING..." : "TRY IT ON →"}
            </button>

            {/* Hint line near main button */}
            <div className="text-xs sm:text-sm font-bold font-dmsans tracking-tight text-center sm:text-right px-2">
              {generationError ? (
                <span className="text-[#E3290F]">
                  THAT DIDN&apos;T WORK. TRY AGAIN. {generationError}
                </span>
              ) : !isReadyToTryOn ? (
                <span className="text-[#555]">
                  Add a photo and a piece to start.
                </span>
              ) : (
                <span className="text-emerald-800">
                  All set. Hit the button!
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Recent Looks Section */}
      <section className="max-w-[1344px] mx-auto mt-14 px-6 sm:px-12 pb-18 box-border">
        <h2 className="m-0 mb-6 font-marker font-normal text-3xl sm:text-[40px]">
          RECENT LOOKS
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
          {history.length > 0 ? (
            history.slice(0, 3).map((item, idx) => {
              const rotations = ["-rotate-2", "rotate-[1.5deg]", "-rotate-1"];
              const rot = rotations[idx % rotations.length];
              return (
                <div
                  key={item.id}
                  onClick={() => setCurrentResult(item)}
                  className={`bg-white p-2.5 pb-9 shadow-[4px_4px_0_#111] border-2 border-[#111] ${rot} cursor-pointer hover:scale-105 transition-transform group`}
                >
                  <div className="aspect-[3/4] relative overflow-hidden bg-stone-100 border border-stone-200">
                    <Image
                      src={getImageUrl(item.result_image_url)}
                      alt={`Look ${idx + 1}`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="font-caveat text-lg font-bold text-center mt-2 text-[#111]">
                    Look 0{idx + 1}
                  </div>
                </div>
              );
            })
          ) : (
            <>
              {/* Default design template placeholders if no looks saved yet */}
              <div className="bg-white p-2.5 pb-9 shadow-[4px_4px_0_#111] border-2 border-[#111] -rotate-2">
                <div className="aspect-[3/4] bg-[#2338E0] grid place-items-center text-white text-[13px] font-bold">
                  [LOOK 01]
                </div>
              </div>
              <div className="bg-white p-2.5 pb-9 shadow-[4px_4px_0_#111] border-2 border-[#111] rotate-[1.5deg]">
                <div className="aspect-[3/4] bg-[#FFC81E] grid place-items-center text-[#111] text-[13px] font-bold">
                  [LOOK 02]
                </div>
              </div>
              <div className="bg-white p-2.5 pb-9 shadow-[4px_4px_0_#111] border-2 border-[#111] -rotate-1">
                <div className="aspect-[3/4] bg-[#E3290F] grid place-items-center text-white text-[13px] font-bold">
                  [LOOK 03]
                </div>
              </div>
            </>
          )}

          {/* save a look + dashed card */}
          <div
            onClick={() => {
              window.scrollTo({ top: 300, behavior: "smooth" });
            }}
            className="grid place-items-center border-[3px] border-dashed border-[#111] rounded-md min-h-[200px] font-caveat text-[28px] font-bold cursor-pointer hover:bg-stone-50 select-none"
          >
            save a look +
          </div>
        </div>
      </section>

      {/*
        Floating button:
        Only show when:
        (a) the main button is OUT of the viewport (IntersectionObserver threshold 0.3)
        (b) both images are added
        Fixed, bottom 16px, horizontally centered, z-index above content.
      */}
      {showFloatingButton && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex justify-center pointer-events-auto">
          <button
            onClick={handleGenerate}
            disabled={!isReadyToTryOn || isGenerating}
            className="min-h-[58px] px-8 border-[3px] border-[#111] rounded-full font-marker text-2xl shadow-[4px_4px_0_#111] select-none bg-[#E3290F] hover:bg-[#c9240d] text-white cursor-pointer active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            {isGenerating ? "FITTING..." : "TRY IT ON →"}
          </button>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-[#2338E0] text-white py-9 px-6 sm:px-12 flex flex-wrap justify-between gap-4 items-center">
        <div className="font-marker text-3xl sm:text-[32px] select-none">whearing:)</div>
        <span className="text-sm font-medium">Made for people who love getting dressed.</span>
      </footer>
    </div>
  );
}
