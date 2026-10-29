"use client";

import { useState, useRef, useEffect } from "react";
import {
  UploadCloud,
  Sparkles,
  Check,
  X,
  Sliders,
  RefreshCw,
  AlertCircle,
  Eye,
  ZoomIn,
  Crop,
  Layers,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import {
  uploadFullBodyPhoto,
  getExtractionJob,
  approveCandidate,
  rejectCandidate,
  refineCandidate,
  ExtractionJob,
  CandidateGarment,
  Garment,
  getImageUrl,
} from "@/lib/api";

interface FullOutfitExtractionFlowProps {
  onGarmentAdded: (garment: Garment) => void;
  onClose: () => void;
}

const CATEGORY_OPTIONS = [
  { value: "tops", label: "Tops / Jackets / Shirts" },
  { value: "bottoms", label: "Bottoms / Pants / Skirts" },
  { value: "shoes", label: "Shoes / Footwear" },
  { value: "outerwear", label: "Outerwear / Overcoats" },
  { value: "dresses", label: "Dresses / One-Pieces" },
  { value: "accessories", label: "Accessories / Bags" },
];

export function FullOutfitExtractionFlow({ onGarmentAdded, onClose }: FullOutfitExtractionFlowProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [job, setJob] = useState<ExtractionJob | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Per-candidate category edits
  const [candCategories, setCandCategories] = useState<Record<string, string>>({});

  // Full-size Zoom Modal state
  const [zoomCandidate, setZoomCandidate] = useState<CandidateGarment | null>(null);

  // Manual Crop Refinement Modal state
  const [refineCandidateItem, setRefineCandidateItem] = useState<CandidateGarment | null>(null);
  const [refineBox, setRefineBox] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 0.15,
    y: 0.20,
    width: 0.70,
    height: 0.35,
  });
  const [isRefining, setIsRefining] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Poll job status when job is pending or processing
  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed") return;

    const interval = setInterval(async () => {
      try {
        const updated = await getExtractionJob(job.id);
        setJob(updated);
      } catch (err) {
        console.error("Job status check error:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [job]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      setJob(null);
      setError(null);
    }
  };

  const handleStartExtraction = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    try {
      const initialJob = await uploadFullBodyPhoto(file);
      setJob(initialJob);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start extraction job.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleApprove = async (cand: CandidateGarment) => {
    if (!job) return;
    const chosenCategory = candCategories[cand.id] || cand.category;
    try {
      const garment = await approveCandidate(job.id, cand.id, {
        category: chosenCategory,
        name: `Extracted ${chosenCategory.charAt(0).toUpperCase() + chosenCategory.slice(1)}`,
      });
      // Update local candidate state
      setJob({
        ...job,
        candidate_garments: job.candidate_garments.map((c) =>
          c.id === cand.id ? { ...c, status: "approved", category: chosenCategory } : c
        ),
      });
      onGarmentAdded(garment);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Approval failed.");
    }
  };

  const handleReject = async (cand: CandidateGarment) => {
    if (!job) return;
    try {
      await rejectCandidate(job.id, cand.id);
      setJob({
        ...job,
        candidate_garments: job.candidate_garments.map((c) =>
          c.id === cand.id ? { ...c, status: "rejected" } : c
        ),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Rejection failed.");
    }
  };

  const openRefineModal = (cand: CandidateGarment) => {
    setRefineCandidateItem(cand);
    setRefineBox(
      cand.bounding_box || {
        x: 0.15,
        y: 0.20,
        width: 0.70,
        height: 0.35,
      }
    );
  };

  const handleSaveRefinement = async () => {
    if (!job || !refineCandidateItem) return;
    setIsRefining(true);
    try {
      const res = await refineCandidate(job.id, refineCandidateItem.id, refineBox);
      const updatedCand = res.candidate;
      setJob({
        ...job,
        candidate_garments: job.candidate_garments.map((c) =>
          c.id === refineCandidateItem.id ? { ...c, ...updatedCand } : c
        ),
      });
      setRefineCandidateItem(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to re-extract refined candidate.");
    } finally {
      setIsRefining(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Upload Phase */}
      {!job && (
        <div className="space-y-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-stone-300 rounded-2xl bg-stone-50 hover:bg-stone-100/80 cursor-pointer transition-colors text-center"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />

            {previewUrl ? (
              <div className="relative w-48 h-64 rounded-xl overflow-hidden bg-white border border-stone-200 flex items-center justify-center shadow-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Full body outfit preview"
                  className="max-w-full max-h-full object-contain"
                />
                <span className="absolute bottom-2 right-2 text-[10px] font-mono px-2 py-0.5 rounded bg-stone-900/80 text-white">
                  Change Photo
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-stone-200/90 text-stone-800 flex items-center justify-center mx-auto">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-900">
                    Upload a Full-Body Outfit Photograph
                  </p>
                  <p className="text-xs text-stone-500 font-mono mt-1">
                    Standing front-facing photograph • Neural human foreground isolation
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 text-sm font-medium hover:bg-stone-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!file || isUploading}
              onClick={handleStartExtraction}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-stone-900 text-stone-50 text-sm font-medium hover:bg-stone-800 disabled:opacity-50 shadow-sm transition-all"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Submitting Image...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Run Garment Extraction</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Processing Phase */}
      {job && (job.status === "pending" || job.status === "processing") && (
        <div className="p-10 text-center space-y-4 rounded-2xl border border-stone-200 bg-white">
          <div className="w-14 h-14 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center mx-auto text-stone-800 animate-pulse">
            <Sparkles className="w-7 h-7 text-amber-500" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-stone-900 font-serif">
              Neural Foreground & Garment Extraction
            </h3>
            <p className="text-xs text-stone-500 font-mono">
              Removing environment background • Isolating tops, bottoms, and footwear regions
            </p>
          </div>
          <div className="w-full max-w-xs mx-auto bg-stone-200 rounded-full h-2 overflow-hidden">
            <div className="bg-stone-900 h-2 rounded-full animate-progress" style={{ width: "75%" }} />
          </div>
        </div>
      )}

      {/* Candidates Review Phase */}
      {job && job.status === "completed" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-stone-200">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 mb-1">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Garment Cutouts Ready</span>
              </div>
              <h3 className="text-lg font-semibold text-stone-950 font-serif">
                Review Extracted Garment Candidates
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Review each candidate cutout. You can edit categories, zoom in, refine crop boundaries, or approve items directly to your wardrobe.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-stone-100 border border-stone-200 text-stone-700 font-medium">
                {job.candidate_garments.filter((c) => c.status === "approved").length} of {job.candidate_garments.length} Approved
              </span>
            </div>
          </div>

          {/* Candidate Garment Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {job.candidate_garments.map((cand) => {
              const currentCat = candCategories[cand.id] || cand.category;
              const isApproved = cand.status === "approved";
              const isRejected = cand.status === "rejected";
              const isNeedsCorrection = cand.requires_correction;

              return (
                <div
                  key={cand.id}
                  className={`flex flex-col justify-between rounded-2xl border transition-all ${
                    isApproved
                      ? "bg-emerald-50/40 border-emerald-300 shadow-xs"
                      : isRejected
                      ? "opacity-50 border-stone-200 bg-stone-100/60"
                      : isNeedsCorrection
                      ? "bg-amber-50/30 border-amber-300 shadow-xs"
                      : "bg-white border-stone-200 hover:border-stone-400 shadow-xs"
                  }`}
                >
                  <div className="p-4 space-y-3">
                    {/* Header Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-stone-900 text-white font-medium">
                        {currentCat}
                      </span>

                      {/* Status Badges */}
                      {isApproved ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold">
                          <Check className="w-3 h-3" /> Approved
                        </span>
                      ) : isRejected ? (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-stone-200 text-stone-600">
                          Discarded
                        </span>
                      ) : isNeedsCorrection ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 font-medium">
                          <AlertCircle className="w-3 h-3 text-amber-600" /> Needs Adjust
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200">
                          Needs Review
                        </span>
                      )}
                    </div>

                    {/* Large Centered Preview with Checkerboard Transparency */}
                    <div className="relative w-full h-56 rounded-xl overflow-hidden border border-stone-200 flex items-center justify-center p-3 group bg-white">
                      {/* Checkerboard Backdrop */}
                      <div
                        className="absolute inset-0 opacity-60"
                        style={{
                          backgroundImage: `
                            linear-gradient(45deg, #e5e7eb 25%, transparent 25%),
                            linear-gradient(-45deg, #e5e7eb 25%, transparent 25%),
                            linear-gradient(45deg, transparent 75%, #e5e7eb 75%),
                            linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)
                          `,
                          backgroundSize: "16px 16px",
                          backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
                        }}
                      />

                      {/* Cutout Image (object-contain preserves proportions without stretch) */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getImageUrl(cand.image_url)}
                        alt={cand.category}
                        className="relative z-10 max-w-full max-h-full object-contain drop-shadow-sm transition-transform duration-200 group-hover:scale-105"
                      />

                      {/* Quick Action Overlay: Zoom & Refine */}
                      <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => setZoomCandidate(cand)}
                          title="Full-size inspection"
                          aria-label="Inspect cutout in full size"
                          className="p-1.5 rounded-lg bg-white/90 hover:bg-white text-stone-700 hover:text-stone-900 border border-stone-200 shadow-xs transition-colors"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                        </button>
                        {!isApproved && (
                          <button
                            type="button"
                            onClick={() => openRefineModal(cand)}
                            title="Adjust crop bounds"
                            aria-label="Adjust crop bounds"
                            className="p-1.5 rounded-lg bg-white/90 hover:bg-white text-stone-700 hover:text-stone-900 border border-stone-200 shadow-xs transition-colors"
                          >
                            <Crop className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Review Note if sparse */}
                    {cand.review_reason && !isApproved && (
                      <div className="p-2 rounded-lg bg-amber-50/80 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span>{cand.review_reason}</span>
                      </div>
                    )}

                    {/* Category Selector (allows user editing before approval) */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-mono text-stone-500 uppercase tracking-wider block">
                        Category
                      </label>
                      <select
                        disabled={isApproved}
                        value={currentCat}
                        onChange={(e) =>
                          setCandCategories({ ...candCategories, [cand.id]: e.target.value })
                        }
                        className="w-full text-xs font-medium py-1.5 px-2.5 rounded-lg border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-900 disabled:opacity-60 transition-colors"
                      >
                        {CATEGORY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="p-4 pt-0">
                    <div className="pt-3 border-t border-stone-100 flex items-center gap-2">
                      {isApproved ? (
                        <div className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 rounded-lg border border-emerald-200">
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span>Saved to Wardrobe</span>
                        </div>
                      ) : isRejected ? (
                        <button
                          type="button"
                          onClick={() =>
                            setJob({
                              ...job,
                              candidate_garments: job.candidate_garments.map((c) =>
                                c.id === cand.id ? { ...c, status: "needs_review" } : c
                              ),
                            })
                          }
                          className="w-full py-2 text-xs text-stone-600 hover:text-stone-900 font-mono underline"
                        >
                          Restore Candidate
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleReject(cand)}
                            aria-label={`Reject ${cand.category}`}
                            className="flex-1 py-2 px-3 rounded-lg border border-stone-300 text-stone-600 hover:text-rose-700 hover:border-rose-300 text-xs font-medium transition-colors"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApprove(cand)}
                            aria-label={`Approve ${cand.category} to wardrobe`}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-stone-900 text-stone-50 hover:bg-stone-800 text-xs font-medium shadow-xs transition-colors"
                          >
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Approve</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sticky Modal Review Footer */}
          <div className="sticky bottom-0 z-20 flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 pb-2 border-t border-stone-200 bg-[#faf8f5]/95 backdrop-blur-xs">
            <button
              type="button"
              onClick={() => {
                setJob(null);
                setFile(null);
                setPreviewUrl(null);
              }}
              className="text-xs text-stone-600 hover:text-stone-900 font-mono underline underline-offset-4"
            >
              Upload another outfit photo
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-stone-900 text-stone-50 text-sm font-medium hover:bg-stone-800 shadow-sm transition-all"
            >
              Done Reviewing
            </button>
          </div>
        </div>
      )}

      {/* Full-size Zoom Inspection Modal */}
      {zoomCandidate && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-sm animate-fadeIn"
          onClick={() => setZoomCandidate(null)}
        >
          <div
            className="relative max-w-2xl w-full bg-white rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-3 border-b border-stone-200">
              <span className="text-xs font-mono uppercase tracking-wider text-stone-500 font-semibold">
                High-Resolution Cutout Preview • {zoomCandidate.category}
              </span>
              <button
                onClick={() => setZoomCandidate(null)}
                aria-label="Close zoom preview"
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Large Preview Canvas */}
            <div
              className="w-full h-80 sm:h-96 rounded-2xl border border-stone-200 flex items-center justify-center p-4 relative"
              style={{
                backgroundImage: `
                  linear-gradient(45deg, #f3f4f6 25%, transparent 25%),
                  linear-gradient(-45deg, #f3f4f6 25%, transparent 25%),
                  linear-gradient(45deg, transparent 75%, #f3f4f6 75%),
                  linear-gradient(-45deg, transparent 75%, #f3f4f6 75%)
                `,
                backgroundSize: "20px 20px",
                backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
                backgroundColor: "#ffffff",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getImageUrl(zoomCandidate.image_url)}
                alt="Zoom preview"
                className="max-w-full max-h-full object-contain drop-shadow-md"
              />
            </div>

            <p className="text-xs font-mono text-stone-500 text-center">
              Clean transparent PNG cutout • Background and floor remnants removed
            </p>
          </div>
        </div>
      )}

      {/* Interactive Crop Bounds Refinement Modal */}
      {refineCandidateItem && job && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-sm"
          onClick={() => setRefineCandidateItem(null)}
        >
          <div
            className="relative max-w-xl w-full bg-[#faf8f5] rounded-3xl p-6 shadow-2xl space-y-4 border border-stone-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-stone-500 font-medium">
                  Refine Crop Boundary
                </span>
                <h4 className="text-base font-semibold text-stone-950 font-serif">
                  Adjust {refineCandidateItem.category} Bounds
                </h4>
              </div>
              <button
                onClick={() => setRefineCandidateItem(null)}
                aria-label="Close refine dialog"
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Adjust the vertical and horizontal boundaries below. The system will re-extract the garment from the outfit photo and regenerate a clean transparent cutout.
            </p>

            {/* Slider Controls */}
            <div className="space-y-3 bg-white p-4 rounded-2xl border border-stone-200 text-xs">
              <div className="space-y-1">
                <div className="flex justify-between font-mono text-stone-600">
                  <span>Top Boundary (y):</span>
                  <span>{Math.round(refineBox.y * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.80"
                  step="0.01"
                  value={refineBox.y}
                  onChange={(e) =>
                    setRefineBox({ ...refineBox, y: parseFloat(e.target.value) })
                  }
                  className="w-full accent-stone-900 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between font-mono text-stone-600">
                  <span>Height:</span>
                  <span>{Math.round(refineBox.height * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.80"
                  step="0.01"
                  value={refineBox.height}
                  onChange={(e) =>
                    setRefineBox({ ...refineBox, height: parseFloat(e.target.value) })
                  }
                  className="w-full accent-stone-900 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between font-mono text-stone-600">
                  <span>Horizontal Width:</span>
                  <span>{Math.round(refineBox.width * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.20"
                  max="0.95"
                  step="0.01"
                  value={refineBox.width}
                  onChange={(e) =>
                    setRefineBox({ ...refineBox, width: parseFloat(e.target.value) })
                  }
                  className="w-full accent-stone-900 cursor-pointer"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRefineCandidateItem(null)}
                className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 text-xs font-medium hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRefining}
                onClick={handleSaveRefinement}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-stone-900 text-stone-50 text-xs font-medium hover:bg-stone-800 disabled:opacity-50 transition-colors shadow-xs"
              >
                {isRefining ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Re-extracting...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Re-extract Garment</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
