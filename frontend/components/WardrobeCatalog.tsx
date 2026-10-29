"use client";

import { useState } from "react";
import { Heart, Search, Filter, Trash2, Edit3, Sparkles, Tag, Plus } from "lucide-react";
import { Garment, getImageUrl, updateGarment, deleteGarment } from "@/lib/api";

const CATEGORIES = [
  { id: "all", label: "All Items" },
  { id: "tops", label: "Tops" },
  { id: "bottoms", label: "Bottoms" },
  { id: "outerwear", label: "Outerwear" },
  { id: "shoes", label: "Footwear" },
  { id: "bags", label: "Bags" },
  { id: "accessories", label: "Accessories" },
  { id: "one-piece", label: "Dresses & Jumpsuits" },
];

const SEASONS = ["all", "spring", "summer", "fall", "winter"];

interface WardrobeCatalogProps {
  garments: Garment[];
  onGarmentUpdated: (garment: Garment) => void;
  onGarmentDeleted: (id: number) => void;
  onOpenUpload: () => void;
  onAddToOutfit?: (garment: Garment) => void;
}

export function WardrobeCatalog({
  garments,
  onGarmentUpdated,
  onGarmentDeleted,
  onOpenUpload,
  onAddToOutfit,
}: WardrobeCatalogProps) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSeason, setSelectedSeason] = useState("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingGarment, setEditingGarment] = useState<Garment | null>(null);

  // Filter garments locally for instant responsive UI
  const filteredGarments = garments.filter((g) => {
    if (selectedCategory !== "all" && g.category !== selectedCategory) return false;
    if (selectedSeason !== "all" && g.season !== selectedSeason && g.season !== "all") return false;
    if (favoritesOnly && !g.is_favorite) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = g.name.toLowerCase().includes(q);
      const matchBrand = g.brand?.toLowerCase().includes(q);
      const matchColor = g.color?.toLowerCase().includes(q);
      const matchSub = g.subcategory?.toLowerCase().includes(q);
      if (!matchName && !matchBrand && !matchColor && !matchSub) return false;
    }
    return true;
  });

  const handleToggleFavorite = async (garment: Garment) => {
    try {
      const updated = await updateGarment(garment.id, { is_favorite: !garment.is_favorite });
      onGarmentUpdated(updated);
    } catch (err) {
      console.error("Favorite toggle failed:", err);
    }
  };

  const handleDelete = async (garmentId: number) => {
    if (!confirm("Are you sure you want to remove this garment from your wardrobe?")) return;
    try {
      await deleteGarment(garmentId);
      onGarmentDeleted(garmentId);
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGarment) return;
    try {
      const updated = await updateGarment(editingGarment.id, {
        name: editingGarment.name,
        category: editingGarment.category,
        subcategory: editingGarment.subcategory,
        color: editingGarment.color,
        season: editingGarment.season,
        brand: editingGarment.brand,
      });
      onGarmentUpdated(updated);
      setEditingGarment(null);
    } catch (err) {
      console.error("Edit failed:", err);
    }
  };

  return (
    <div className="space-y-8">
      {/* Search and Filters Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-stone-200/90 shadow-xs">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, color, brand, or style..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-stone-200 bg-stone-50 text-sm focus:border-stone-900 focus:bg-white transition-colors"
          />
        </div>

        {/* Season & Favorite Filters */}
        <div className="flex items-center gap-3">
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            className="px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 text-xs font-mono uppercase tracking-wider text-stone-700 focus:border-stone-900"
          >
            <option value="all">All Seasons</option>
            <option value="spring">Spring</option>
            <option value="summer">Summer</option>
            <option value="fall">Fall</option>
            <option value="winter">Winter</option>
          </select>

          <button
            onClick={() => setFavoritesOnly(!favoritesOnly)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${
              favoritesOnly
                ? "bg-rose-50 text-rose-800 border-rose-300"
                : "bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100"
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${favoritesOnly ? "fill-rose-500 text-rose-500" : ""}`} />
            <span>Favorites</span>
          </button>
        </div>
      </div>

      {/* Category Pills Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {CATEGORIES.map((cat) => {
          const count =
            cat.id === "all"
              ? garments.length
              : garments.filter((g) => g.category === cat.id).length;
          const active = selectedCategory === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`shrink-0 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                active
                  ? "bg-stone-950 text-stone-50 shadow-xs"
                  : "bg-white text-stone-700 border border-stone-200 hover:border-stone-400"
              }`}
            >
              <span>{cat.label}</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  active ? "bg-stone-800 text-stone-200" : "bg-stone-100 text-stone-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Grid of Garments */}
      {filteredGarments.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
          {filteredGarments.map((garment) => (
            <div
              key={garment.id}
              className="group relative flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-3 hover:border-stone-900 hover:shadow-md transition-all duration-200"
            >
              {/* Garment Image Surface */}
              <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-stone-50 border border-stone-100 flex items-center justify-center p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getImageUrl(garment.image_url)}
                  alt={garment.name}
                  className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-200"
                />

                {/* Favorite Heart Button */}
                <button
                  type="button"
                  onClick={() => handleToggleFavorite(garment)}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 backdrop-blur-xs text-stone-400 hover:text-rose-500 shadow-xs transition-colors"
                  title={garment.is_favorite ? "Remove from favorites" : "Add to favorites"}
                >
                  <Heart
                    className={`w-4 h-4 ${
                      garment.is_favorite ? "fill-rose-500 text-rose-500" : ""
                    }`}
                  />
                </button>

                {/* AI Extraction Badge */}
                {garment.source_type === "extracted_outfit" && (
                  <span className="absolute top-2 left-2 text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-stone-900/80 text-amber-300 backdrop-blur-xs">
                    AI Cut
                  </span>
                )}
              </div>

              {/* Garment Details */}
              <div className="mt-3 space-y-1">
                <div className="flex items-center justify-between gap-1 text-[10px] font-mono uppercase tracking-wider text-stone-500">
                  <span>{garment.category}</span>
                  {garment.season && garment.season !== "all" && (
                    <span className="px-1.5 rounded bg-stone-100">{garment.season}</span>
                  )}
                </div>

                <h4 className="text-sm font-semibold text-stone-900 truncate font-serif">
                  {garment.name}
                </h4>

                <div className="flex items-center justify-between text-xs text-stone-500">
                  <span className="truncate">{garment.brand || garment.color || "—"}</span>
                </div>
              </div>

              {/* Card Actions */}
              <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between gap-1">
                {onAddToOutfit && (
                  <button
                    type="button"
                    onClick={() => onAddToOutfit(garment)}
                    className="flex-1 inline-flex items-center justify-center gap-1 py-1 px-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-[11px] font-medium transition-colors"
                    title="Add garment to Outfit Canvas"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Style</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setEditingGarment(garment)}
                  className="p-1 rounded-lg text-stone-400 hover:text-stone-700 transition-colors"
                  title="Edit Details"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(garment.id)}
                  className="p-1 rounded-lg text-stone-400 hover:text-rose-600 transition-colors"
                  title="Delete Garment"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 px-4 rounded-3xl border border-stone-200 bg-white space-y-4">
          <p className="text-base font-semibold text-stone-800 font-serif">
            No clothing items match your current filter
          </p>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            Try adjusting your search query, season, or category filter to view other garments.
          </p>
          <button
            onClick={onOpenUpload}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 text-stone-50 text-xs font-medium hover:bg-stone-800"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Item</span>
          </button>
        </div>
      )}

      {/* Edit Garment Metadata Modal */}
      {editingGarment && (
        <div
          role="dialog"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs"
        >
          <div className="bg-[#faf8f5] w-full max-w-md rounded-3xl border border-stone-200 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <h3 className="text-lg font-semibold text-stone-950 font-serif">
                Edit Garment Details
              </h3>
              <button
                onClick={() => setEditingGarment(null)}
                className="text-stone-400 hover:text-stone-900"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={editingGarment.name}
                  onChange={(e) =>
                    setEditingGarment({ ...editingGarment, name: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Category</label>
                  <select
                    value={editingGarment.category}
                    onChange={(e) =>
                      setEditingGarment({ ...editingGarment, category: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm"
                  >
                    {CATEGORIES.filter((c) => c.id !== "all").map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Color</label>
                  <input
                    type="text"
                    value={editingGarment.color || ""}
                    onChange={(e) =>
                      setEditingGarment({ ...editingGarment, color: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Season</label>
                  <select
                    value={editingGarment.season || "all"}
                    onChange={(e) =>
                      setEditingGarment({ ...editingGarment, season: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm"
                  >
                    {SEASONS.map((s) => (
                      <option key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Brand</label>
                  <input
                    type="text"
                    value={editingGarment.brand || ""}
                    onChange={(e) =>
                      setEditingGarment({ ...editingGarment, brand: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setEditingGarment(null)}
                  className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-stone-900 text-stone-50 text-xs font-medium hover:bg-stone-800"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
