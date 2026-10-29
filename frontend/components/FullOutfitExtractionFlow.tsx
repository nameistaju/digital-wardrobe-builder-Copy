"use client";

import { useState, useRef, useEffect } from "react";
import { UploadCloud, Sparkles, Check, X, Sliders, ArrowRight, RefreshCw, AlertCircle, Eye } from "lucide-react";
import { uploadFullBodyPhoto, getExtractionJob, approveCandidate, rejectCandidate, refineCandidate, ExtractionJob, CandidateGarment, Garment, getImageUrl } from "@/lib/api";

interface FullOutfitExtractionFlowProps {
  onGarmentAdded: (garment: Garment) => void;
  onClose: () => void;
}

export function FullOutfitExtractionFlow({ onGarmentAdded, onClose }: FullOutfitExtractionFlowProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [job, setJob] = useState<ExtractionJob | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRefineCandidate, setActiveRefineCandidate] = useState<CandidateGarment | null>(null);

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
    try {
      const garment = await approveCandidate(job.id, cand.id, {
        category: cand.category,
        name: `AI ${cand.category.charAt(0).toUpperCase() + cand.category.slice(1)}`,
      });
      // Update local candidate state
      setJob({
        ...job,
        candidate_garments: job.candidate_garments.map((c) =>
          c.id === cand.id ? { ...c, status: "approved" } : c
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
                  alt="Full body preview"
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
                    Front-facing standing photo recommended
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 text-sm font-medium hover:bg-stone-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!file || isUploading}
              onClick={handleStartExtraction}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-stone-900 text-stone-50 text-sm font-medium hover:bg-stone-800 disabled:opacity-50 shadow-sm"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Submitting Image...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Run AI Garment Extraction</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Processing Phase */}
      {job && (job.status === "pending" || job.status === "processing") && (
        <div className="p-8 text-center space-y-4 rounded-2xl border border-stone-200 bg-white">
          <div className="w-12 h-12 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center mx-auto text-stone-800 animate-pulse">
            <Sparkles className="w-6 h-6 text-amber-500" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-stone-900 font-serif">
              Analyzing & Extracting Garments
            </h3>
            <p className="text-xs text-stone-500 font-mono">
              Running vision parsing • Isolating tops, bottoms, and footwear
            </p>
          </div>
          <div className="w-full max-w-xs mx-auto bg-stone-200 rounded-full h-2 overflow-hidden">
            <div className="bg-stone-900 h-2 rounded-full animate-progress" style={{ width: "70%" }} />
          </div>
        </div>
      )}

      {/* Completed Candidates Review Phase */}
      {job && job.status === "completed" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-stone-200">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Extraction Complete
              </span>
              <h3 className="text-lg font-semibold text-stone-950 font-serif mt-1">
                Candidate Garments Review
              </h3>
            </div>
            <p className="text-xs font-mono text-stone-500">
              {job.candidate_garments.filter((c) => c.status === "approved").length} of {job.candidate_garments.length} approved
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {job.candidate_garments.map((cand) => (
              <div
                key={cand.id}
                className={`relative flex flex-col justify-between p-4 rounded-2xl border transition-all ${
                  cand.status === "approved"
                    ? "bg-emerald-50/50 border-emerald-300"
                    : cand.status === "rejected"
                    ? "opacity-40 border-stone-200 bg-stone-100"
                    : "bg-white border-stone-200 hover:border-stone-400 shadow-xs"
                }`}
              >
                <div>
                  {/* Candidate Isolated Cutout */}
                  <div className="relative w-full h-44 rounded-xl overflow-hidden bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:12px_12px] bg-stone-50 border border-stone-200 flex items-center justify-center p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getImageUrl(cand.image_url)}
                      alt={cand.category}
                      className="max-w-full max-h-full object-contain"
                    />
                    <span className="absolute top-2 left-2 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-stone-900/80 text-white">
                      {cand.category}
                    </span>
                    <span className="absolute top-2 right-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/90 text-stone-700 border border-stone-200">
                      {Math.round(cand.confidence * 100)}% Match
                    </span>
                  </div>

                  <div className="mt-3 space-y-1">
                    <p className="text-sm font-semibold text-stone-900 capitalize font-serif">
                      {cand.category} Item
                    </p>
                    <p className="text-xs text-stone-500 font-mono">
                      Isolated transparent crop
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-stone-100 flex items-center gap-2">
                  {cand.status === "approved" ? (
                    <div className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-emerald-800">
                      <Check className="w-4 h-4" />
                      <span>Added to Wardrobe</span>
                    </div>
                  ) : cand.status === "rejected" ? (
                    <div className="w-full text-center py-2 text-xs text-stone-400 font-mono">
                      Discarded
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleReject(cand)}
                        className="flex-1 py-2 px-2.5 rounded-lg border border-stone-300 text-stone-600 hover:text-rose-700 hover:border-rose-300 text-xs font-medium transition-colors"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApprove(cand)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-stone-900 text-stone-50 hover:bg-stone-800 text-xs font-medium shadow-xs transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-stone-200">
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
              className="px-5 py-2.5 rounded-xl bg-stone-900 text-stone-50 text-sm font-medium hover:bg-stone-800 shadow-sm"
            >
              Done Reviewing
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
