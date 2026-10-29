"use client";

import { useState, useRef } from "react";
import { UploadCloud, Check, AlertCircle, Sparkles, Image as ImageIcon } from "lucide-react";
import { uploadGarment, Garment } from "@/lib/api";

const CATEGORIES = [
  { id: "tops", label: "Tops" },
  { id: "bottoms", label: "Bottoms" },
  { id: "outerwear", label: "Outerwear" },
  { id: "shoes", label: "Shoes" },
  { id: "bags", label: "Bags" },
  { id: "accessories", label: "Accessories" },
  { id: "one-piece", label: "Dresses & Jumpsuits" },
  { id: "other", label: "Other" },
];

const SEASONS = [
  { id: "all", label: "All Seasons" },
  { id: "spring", label: "Spring" },
  { id: "summer", label: "Summer" },
  { id: "fall", label: "Fall" },
  { id: "winter", label: "Winter" },
];

interface IndividualUploadFormProps {
  onSuccess: (garment: Garment) => void;
  onCancel: () => void;
}

export function IndividualUploadForm({ onSuccess, onCancel }: IndividualUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("tops");
  const [subcategory, setSubcategory] = useState("");
  const [color, setColor] = useState("");
  const [season, setSeason] = useState("all");
  const [brand, setBrand] = useState("");
  const [notes, setNotes] = useState("");
  const [removeBg, setRemoveBg] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      if (!name) {
        // Auto-fill a clean default name from the filename
        const baseName = selected.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        setName(baseName.charAt(0).toUpperCase() + baseName.slice(1));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please choose a garment image to upload.");
      return;
    }
    if (!name.trim()) {
      setError("Please provide a name for this garment.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", name);
      formData.append("category", category);
      if (subcategory) formData.append("subcategory", subcategory);
      if (color) formData.append("color", color);
      formData.append("season", season);
      if (brand) formData.append("brand", brand);
      if (notes) formData.append("notes", notes);
      formData.append("remove_background", String(removeBg));

      const garment = await uploadGarment(formData);
      onSuccess(garment);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Image Upload Area */}
      <div className="space-y-2">
        <label className="block text-xs font-mono uppercase tracking-wider text-stone-600">
          Garment Photo
        </label>
        <div
          onClick={() => fileInputRef.current?.click()}
          className="relative flex flex-col items-center justify-center p-6 border-2 border-dashed border-stone-300 rounded-2xl bg-stone-50 hover:bg-stone-100/80 cursor-pointer transition-colors group"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />

          {previewUrl ? (
            <div className="relative w-40 h-40 rounded-xl overflow-hidden bg-white border border-stone-200 flex items-center justify-center shadow-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Upload preview"
                className="max-w-full max-h-full object-contain p-2"
              />
              <span className="absolute bottom-1 right-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-900/80 text-stone-100">
                Change
              </span>
            </div>
          ) : (
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-xl bg-stone-200/80 text-stone-700 flex items-center justify-center mx-auto group-hover:scale-105 transition-transform">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-stone-800">
                  Click to select or drop a clothing photo
                </p>
                <p className="text-xs text-stone-500 font-mono mt-0.5">
                  PNG, JPG, or WEBP up to 15MB
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Remove Background Option */}
      <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/80 flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-900">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Remove Background</span>
          </div>
          <p className="text-[11px] text-stone-500">
            Isolates the clothing item on a transparent background for clean outfit styling.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRemoveBg(!removeBg)}
          className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
            removeBg ? "bg-stone-900" : "bg-stone-300"
          }`}
        >
          <div
            className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
              removeBg ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Metadata Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-stone-700 mb-1">
            Item Name *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Linen Camp Collar Shirt"
            className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-700 mb-1">
            Category *
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-700 mb-1">
            Subcategory / Style
          </label>
          <input
            type="text"
            value={subcategory}
            onChange={(e) => setSubcategory(e.target.value)}
            placeholder="e.g. T-Shirt, Chinos, Boots"
            className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-700 mb-1">
            Color
          </label>
          <input
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="e.g. Navy, Beige, Olive"
            className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-700 mb-1">
            Season
          </label>
          <select
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
          >
            {SEASONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-700 mb-1">
            Brand (Optional)
          </label>
          <input
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="e.g. Uniqlo, COS, Zara"
            className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 text-sm font-medium hover:bg-stone-100 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading || !file}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-stone-900 text-stone-50 text-sm font-medium hover:bg-stone-800 disabled:opacity-50 transition-all shadow-sm"
        >
          {isLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-stone-50 border-t-transparent rounded-full animate-spin" />
              <span>Saving Item...</span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              <span>Add to Wardrobe</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
