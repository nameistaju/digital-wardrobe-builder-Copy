"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import {
  Upload,
  Sparkles,
  Download,
  RefreshCw,
  AlertCircle,
  X,
  User as UserIcon,
  Shirt,
  LogIn,
  LogOut,
  ChevronRight,
  Sliders,
} from "lucide-react";
import {
  User,
  TryOnRecord,
  TryOnStatusResponse,
  getTryOnStatus,
  generateVirtualTryOn,
  getTryOnHistory,
  getImageUrl,
  getCurrentUser,
  loginUser,
  registerUser,
  demoLogin,
  getAuthToken,
  removeAuthToken,
} from "@/lib/api";

const PRESET_INSTRUCTIONS = [
  "Natural fit with realistic fabric drape",
  "Oversized fit with relaxed shoulders",
  "Tuck in neatly at the waist",
  "Preserve exact garment graphics and colors",
];

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

export default function WhearingApp() {
  // Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authFullName, setAuthFullName] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  // Service health
  const [serviceStatus, setServiceStatus] = useState<TryOnStatusResponse | null>(null);

  // Inputs
  const [personFile, setPersonFile] = useState<File | null>(null);
  const [personPreview, setPersonPreview] = useState<string | null>(null);
  const [personError, setPersonError] = useState<string | null>(null);

  const [garmentFile, setGarmentFile] = useState<File | null>(null);
  const [garmentPreview, setGarmentPreview] = useState<string | null>(null);
  const [garmentError, setGarmentError] = useState<string | null>(null);

  const [instructions, setInstructions] = useState<string>("");
  const [showInstructions, setShowInstructions] = useState(false);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentResult, setCurrentResult] = useState<TryOnRecord | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // History
  const [history, setHistory] = useState<TryOnRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Refs for file uploads
  const personInputRef = useRef<HTMLInputElement>(null);
  const garmentInputRef = useRef<HTMLInputElement>(null);

  // Drag states
  const [personDragging, setPersonDragging] = useState(false);
  const [garmentDragging, setGarmentDragging] = useState(false);

  // Load history safely
  const fetchHistory = useCallback(async () => {
    if (!getAuthToken()) return;
    setIsLoadingHistory(true);
    try {
      const res = await getTryOnHistory(12, 0);
      setHistory(res.items);
    } catch {
      // Silently handle if unauthenticated or offline
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Check health and initialize session
  useEffect(() => {
    let isMounted = true;

    async function init() {
      // 1. Health check
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

      // 2. Auth verification: check stored token
      const token = getAuthToken();
      if (token) {
        try {
          const user = await getCurrentUser();
          if (isMounted) {
            setCurrentUser(user);
            fetchHistory();
          }
        } catch {
          removeAuthToken();
          if (isMounted) setCurrentUser(null);
        }
      }
    }

    init();
    return () => {
      isMounted = false;
    };
  }, [fetchHistory]);

  // Clean up object URLs to avoid memory leaks
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

  const clearPerson = () => {
    if (personPreview && personPreview.startsWith("blob:")) URL.revokeObjectURL(personPreview);
    setPersonFile(null);
    setPersonPreview(null);
    setPersonError(null);
    if (personInputRef.current) personInputRef.current.value = "";
  };

  const clearGarment = () => {
    if (garmentPreview && garmentPreview.startsWith("blob:")) URL.revokeObjectURL(garmentPreview);
    setGarmentFile(null);
    setGarmentPreview(null);
    setGarmentError(null);
    if (garmentInputRef.current) garmentInputRef.current.value = "";
  };

  const handleClearAll = () => {
    clearPerson();
    clearGarment();
    setInstructions("");
    setCurrentResult(null);
    setGenerationError(null);
  };

  // Auth form submissions
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingAuth(true);
    setAuthError(null);

    try {
      if (authMode === "register") {
        const res = await registerUser(authEmail, authPassword, authFullName || undefined);
        setCurrentUser(res.user);
        setIsAuthModalOpen(false);
        fetchHistory();
      } else {
        const res = await loginUser(authEmail, authPassword);
        setCurrentUser(res.user);
        setIsAuthModalOpen(false);
        fetchHistory();
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleDemoSignIn = async () => {
    setIsSubmittingAuth(true);
    setAuthError(null);
    try {
      const res = await demoLogin();
      setCurrentUser(res.user);
      setIsAuthModalOpen(false);
      fetchHistory();
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Demo sign in failed.");
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleLogout = () => {
    removeAuthToken();
    setCurrentUser(null);
    setHistory([]);
    setCurrentResult(null);
  };

  // Generate Try-On
  const handleGenerate = async () => {
    if (!personFile) {
      setPersonError("Please upload your photo.");
      return;
    }
    if (!garmentFile) {
      setGarmentError("Please upload a clothing item.");
      return;
    }

    // Require sign-in if no active token
    if (!getAuthToken() || !currentUser) {
      setIsAuthModalOpen(true);
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);

    const formData = new FormData();
    formData.append("person_image", personFile);
    formData.append("garment_image", garmentFile);
    if (instructions.trim()) {
      formData.append("prompt", instructions.trim());
    }

    try {
      const record = await generateVirtualTryOn(formData);
      setCurrentResult(record);
      setHistory((prev) => [record, ...prev]);
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
    <div className="min-h-screen bg-[#faf8f5] text-[#121211] flex flex-col selection:bg-[#121211] selection:text-[#faf8f5]">
      {/* Brand Header */}
      <header className="w-full border-b border-[#e8e5df] bg-[#faf8f5]/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl sm:text-2xl font-serif tracking-tight font-medium text-[#121211]">
              Whearing
            </span>
            <span className="text-[10px] tracking-widest uppercase font-mono px-2 py-0.5 rounded-full border border-[#dedad2] text-stone-500 bg-[#f4f2ee]">
              Try-On Studio
            </span>
          </div>

          <div className="flex items-center gap-3">
            {serviceStatus?.status === "quota_exceeded" && (
              <span className="text-[11px] font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 hidden sm:inline-block">
                Quota limited
              </span>
            )}
            {currentUser ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-stone-600 bg-[#f4f2ee] px-2.5 py-1 rounded-md border border-[#e4e0d7] hidden sm:inline-block">
                  {currentUser.email.split("@")[0]}
                </span>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 text-xs text-stone-600 hover:text-stone-950 p-1.5 rounded-md hover:bg-[#ede9e1] transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setAuthMode("login");
                  setIsAuthModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-full border border-[#cfcac0] text-[#121211] hover:bg-[#ede9e1] transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Studio Viewport */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex flex-col">
        {/* Editorial Title */}
        <div className="max-w-xl mb-8 sm:mb-10">
          <h1 className="text-4xl sm:text-5xl font-serif tracking-tight text-[#121211] font-normal leading-[1.1]">
            See it on you.
          </h1>
          <p className="mt-2.5 text-stone-600 text-sm sm:text-base font-sans font-light">
            Upload a photo, choose a piece, and preview how it looks on you.
          </p>
        </div>

        {/* Primary Studio Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left Column: Uploads & Controls (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Photo Input Area */}
              <div className="flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono tracking-wider uppercase text-stone-600 flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-stone-700" />
                    <span>Your Photo</span>
                  </label>
                  {personPreview && (
                    <button
                      type="button"
                      onClick={clearPerson}
                      className="text-[11px] text-stone-400 hover:text-stone-800 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setPersonDragging(true);
                  }}
                  onDragLeave={() => setPersonDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setPersonDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handlePersonSelect(file);
                  }}
                  onClick={() => personInputRef.current?.click()}
                  className={`relative aspect-[3/4] w-full rounded-2xl border transition-all cursor-pointer overflow-hidden flex flex-col items-center justify-center p-4 bg-white shadow-xs ${
                    personDragging
                      ? "border-stone-900 ring-2 ring-stone-900/10 bg-[#f4f2ee]"
                      : personError
                      ? "border-rose-300 bg-rose-50/20"
                      : "border-[#dedad2] hover:border-stone-400"
                  }`}
                >
                  <input
                    ref={personInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handlePersonSelect(f);
                    }}
                  />

                  {personPreview ? (
                    <div className="relative w-full h-full">
                      <Image
                        src={personPreview}
                        alt="Your Photo"
                        fill
                        className="object-cover rounded-xl"
                        unoptimized
                      />
                      <div className="absolute inset-0 bg-stone-900/30 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium rounded-xl">
                        Click or drop to replace
                      </div>
                    </div>
                  ) : (
                    <div className="text-center space-y-2 p-2">
                      <div className="w-10 h-10 rounded-full bg-[#f4f2ee] text-stone-600 flex items-center justify-center mx-auto border border-[#dedad2]">
                        <Upload className="w-4 h-4" />
                      </div>
                      <div className="text-xs font-medium text-stone-900">
                        Upload your photo
                      </div>
                      <p className="text-[11px] text-stone-500 max-w-[160px] mx-auto leading-relaxed">
                        Full-body or torso with good lighting
                      </p>
                    </div>
                  )}
                </div>

                {personError && (
                  <p className="text-[11px] text-rose-600 font-sans">{personError}</p>
                )}
              </div>

              {/* Garment Input Area */}
              <div className="flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono tracking-wider uppercase text-stone-600 flex items-center gap-1.5">
                    <Shirt className="w-3.5 h-3.5 text-stone-700" />
                    <span>Clothing Item</span>
                  </label>
                  {garmentPreview && (
                    <button
                      type="button"
                      onClick={clearGarment}
                      className="text-[11px] text-stone-400 hover:text-stone-800 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setGarmentDragging(true);
                  }}
                  onDragLeave={() => setGarmentDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setGarmentDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleGarmentSelect(file);
                  }}
                  onClick={() => garmentInputRef.current?.click()}
                  className={`relative aspect-[3/4] w-full rounded-2xl border transition-all cursor-pointer overflow-hidden flex flex-col items-center justify-center p-4 bg-white shadow-xs ${
                    garmentDragging
                      ? "border-stone-900 ring-2 ring-stone-900/10 bg-[#f4f2ee]"
                      : garmentError
                      ? "border-rose-300 bg-rose-50/20"
                      : "border-[#dedad2] hover:border-stone-400"
                  }`}
                >
                  <input
                    ref={garmentInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleGarmentSelect(f);
                    }}
                  />

                  {garmentPreview ? (
                    <div className="relative w-full h-full">
                      <Image
                        src={garmentPreview}
                        alt="Clothing Item"
                        fill
                        className="object-contain rounded-xl p-1"
                        unoptimized
                      />
                      <div className="absolute inset-0 bg-stone-900/30 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium rounded-xl">
                        Click or drop to replace
                      </div>
                    </div>
                  ) : (
                    <div className="text-center space-y-2 p-2">
                      <div className="w-10 h-10 rounded-full bg-[#f4f2ee] text-stone-600 flex items-center justify-center mx-auto border border-[#dedad2]">
                        <Upload className="w-4 h-4" />
                      </div>
                      <div className="text-xs font-medium text-stone-900">
                        Upload clothing item
                      </div>
                      <p className="text-[11px] text-stone-500 max-w-[160px] mx-auto leading-relaxed">
                        Product shot or isolated flat garment
                      </p>
                    </div>
                  )}
                </div>

                {garmentError && (
                  <p className="text-[11px] text-rose-600 font-sans">{garmentError}</p>
                )}
              </div>
            </div>

            {/* Discreet Optional Fit Instructions */}
            <div className="rounded-2xl border border-[#dedad2] bg-white p-4 shadow-xs">
              <button
                type="button"
                onClick={() => setShowInstructions(!showInstructions)}
                className="w-full flex items-center justify-between text-xs font-mono uppercase tracking-wider text-stone-700 hover:text-stone-950 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-stone-500" />
                  <span>Fit & Styling Instructions (Optional)</span>
                </span>
                <span className="text-[11px] text-stone-400 lowercase font-sans">
                  {showInstructions ? "hide" : "add details"}
                </span>
              </button>

              {showInstructions && (
                <div className="mt-3 pt-3 border-t border-[#ede9e1] space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_INSTRUCTIONS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setInstructions(preset)}
                        className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                          instructions === preset
                            ? "bg-stone-900 text-stone-50 border-stone-900"
                            : "border-[#dedad2] text-stone-600 hover:border-stone-400 bg-[#faf8f5]"
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="e.g. Natural fit, oversized silhouette, tuck in at the waist..."
                    className="w-full px-3.5 py-2 rounded-xl border border-[#dedad2] text-xs text-stone-900 bg-white placeholder:text-stone-400 focus:outline-none focus:border-stone-900 transition-colors"
                  />
                  <p className="text-[11px] text-stone-400 italic">
                    IDM-VTON adapts the garment to your body pose while preserving design and original identity.
                  </p>
                </div>
              )}
            </div>

            {/* Error Message */}
            {generationError && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-semibold">Try-On Generation Notice</span>
                  <p className="text-rose-800 leading-relaxed">{generationError}</p>
                </div>
              </div>
            )}

            {/* Generate Action Button */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating || !personFile || !garmentFile}
                className={`flex-1 py-3.5 px-6 rounded-2xl text-sm font-medium transition-all flex items-center justify-center gap-2 shadow-sm ${
                  isGenerating || !personFile || !garmentFile
                    ? "bg-[#e8e5df] text-stone-400 cursor-not-allowed"
                    : "bg-[#121211] text-[#faf8f5] hover:bg-stone-800 active:scale-[0.99]"
                }`}
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-stone-300" />
                    <span>Synthesizing Realistic Fit (IDM-VTON)...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Generate try-on</span>
                  </>
                )}
              </button>

              {(personFile || garmentFile || currentResult) && !isGenerating && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="py-3.5 px-4 rounded-2xl border border-[#dedad2] text-stone-600 hover:text-stone-950 hover:bg-white text-xs font-medium transition-colors"
                  title="Clear all inputs"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Result Preview & History (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-2xl border border-[#dedad2] bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#ede9e1]">
                <span className="text-xs font-mono uppercase tracking-wider text-stone-600 font-medium">
                  Generated Look
                </span>
                {currentResult && (
                  <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Neural Render
                  </span>
                )}
              </div>

              {currentResult ? (
                <div className="space-y-4">
                  <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden bg-[#faf8f5] border border-[#ede9e1] shadow-inner">
                    <Image
                      src={getImageUrl(currentResult.result_image_url)}
                      alt="AI Virtual Try-On Result"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        downloadResult(
                          currentResult.result_image_url,
                          `whearing-tryon-${currentResult.id}.png`
                        )
                      }
                      className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#121211] text-[#faf8f5] text-xs font-medium hover:bg-stone-800 transition-colors shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download look</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentResult(null)}
                      className="py-2.5 px-3.5 rounded-xl border border-[#dedad2] text-stone-700 text-xs font-medium hover:bg-[#faf8f5] transition-colors"
                    >
                      New Look
                    </button>
                  </div>
                </div>
              ) : isGenerating ? (
                <div className="aspect-[3/4] w-full rounded-xl border border-[#dedad2] bg-[#faf8f5] flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-[#dedad2] shadow-xs flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 animate-spin text-stone-800" />
                  </div>
                  <div className="text-xs font-medium text-stone-900">
                    Warping Garment & Draping...
                  </div>
                  <p className="text-[11px] text-stone-500 max-w-[200px] leading-relaxed">
                    IDM-VTON is calculating 3D pose alignment and synthesizing photorealistic cloth texture.
                  </p>
                </div>
              ) : (
                <div className="aspect-[3/4] w-full rounded-xl border-2 border-dashed border-[#e4e0d7] bg-[#faf8f5]/60 flex flex-col items-center justify-center p-6 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-white text-stone-400 flex items-center justify-center border border-[#dedad2]">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-medium text-stone-700">
                    Your generated look appears here
                  </span>
                  <p className="text-[11px] text-stone-400 max-w-[190px] leading-relaxed">
                    Upload your photograph and a clothing piece, then select generate.
                  </p>
                </div>
              )}
            </div>

            {/* Compact History Section */}
            {history.length > 0 && (
              <div className="rounded-2xl border border-[#dedad2] bg-white p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-stone-600 font-medium">
                    Recent Looks ({history.length})
                  </span>
                  {isLoadingHistory && (
                    <RefreshCw className="w-3 h-3 animate-spin text-stone-400" />
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setCurrentResult(item)}
                      className={`relative aspect-[3/4] rounded-xl overflow-hidden border cursor-pointer group bg-[#faf8f5] transition-all ${
                        currentResult?.id === item.id
                          ? "border-[#121211] ring-2 ring-[#121211]/10"
                          : "border-[#dedad2] hover:border-stone-500"
                      }`}
                    >
                      <Image
                        src={getImageUrl(item.result_image_url)}
                        alt={`Look #${item.id}`}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                      <div className="absolute inset-0 bg-stone-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <ChevronRight className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Auth Modal */}
      {isAuthModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs"
        >
          <div className="relative w-full max-w-sm bg-[#faf8f5] rounded-3xl border border-[#dedad2] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#ede9e1]">
              <span className="text-lg font-serif font-medium text-[#121211]">
                {authMode === "register" ? "Create Account" : "Sign In to Whearing"}
              </span>
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-900 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-3">
              {authMode === "register" && (
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-stone-600 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={authFullName}
                    onChange={(e) => setAuthFullName(e.target.value)}
                    placeholder="Elena Vance"
                    className="w-full px-3 py-2 rounded-xl border border-[#dedad2] bg-white text-xs text-stone-900 focus:outline-none focus:border-stone-900"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-stone-600 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="curator@whearing.com"
                  className="w-full px-3 py-2 rounded-xl border border-[#dedad2] bg-white text-xs text-stone-900 focus:outline-none focus:border-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-stone-600 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 rounded-xl border border-[#dedad2] bg-white text-xs text-stone-900 focus:outline-none focus:border-stone-900"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingAuth}
                className="w-full py-2.5 px-4 rounded-xl bg-[#121211] text-[#faf8f5] text-xs font-medium hover:bg-stone-800 transition-colors mt-2"
              >
                {isSubmittingAuth
                  ? "Please wait..."
                  : authMode === "register"
                  ? "Create Account"
                  : "Sign In"}
              </button>
            </form>

            <div className="pt-2 border-t border-[#ede9e1] space-y-2 text-center">
              <button
                type="button"
                onClick={handleDemoSignIn}
                disabled={isSubmittingAuth}
                className="w-full py-2 px-3 rounded-xl border border-[#dedad2] bg-white hover:bg-[#ede9e1] text-xs text-stone-700 transition-colors font-mono"
              >
                Sign in with Demo Account
              </button>

              <button
                type="button"
                onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
                className="text-xs text-stone-500 hover:text-stone-900 underline"
              >
                {authMode === "login"
                  ? "Don't have an account? Sign up"
                  : "Already have an account? Sign in"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
