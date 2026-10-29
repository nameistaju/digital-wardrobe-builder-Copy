"use client";

import { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Download,
  Save,
  Trash2,
  Layers,
  ArrowUp,
  ArrowDown,
  Maximize2,
  RotateCcw,
  Plus,
  Shirt,
  Calendar,
  Check,
  FolderHeart,
} from "lucide-react";
import {
  Garment,
  Outfit,
  CanvasItem,
  createOutfit,
  listOutfits,
  deleteOutfit,
  getImageUrl,
} from "@/lib/api";

interface OutfitBuilderProps {
  garments: Garment[];
  onOutfitSaved?: (outfit: Outfit) => void;
}

interface ActiveCanvasItem extends CanvasItem {
  garment: Garment;
}

export function OutfitBuilder({ garments, onOutfitSaved }: OutfitBuilderProps) {
  const [canvasItems, setCanvasItems] = useState<ActiveCanvasItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [outfitName, setOutfitName] = useState("Minimal Everyday Look");
  const [occasion, setOccasion] = useState("casual");
  const [season, setSeason] = useState("all");
  const [isSaving, setIsSaving] = useState(false);
  const [savedOutfits, setSavedOutfits] = useState<Outfit[]>([]);
  const [activeTab, setActiveTab] = useState<"builder" | "saved">("builder");
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<{ id: number; startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Fetch user's saved outfits
  const loadSavedOutfits = async () => {
    try {
      const data = await listOutfits();
      setSavedOutfits(data);
    } catch (err) {
      console.error("Failed to load saved outfits:", err);
    }
  };

  useEffect(() => {
    loadSavedOutfits();
  }, []);

  // Add garment to canvas
  const handleAddGarmentToCanvas = (garment: Garment) => {
    const defaultWidth = 180;
    const defaultHeight = 220;
    // Position near center with slight offset
    const offset = (canvasItems.length * 30) % 150;
    const newItem: ActiveCanvasItem = {
      garment_id: garment.id,
      x: 120 + offset,
      y: 80 + offset,
      width: defaultWidth,
      height: defaultHeight,
      z_index: canvasItems.length + 1,
      rotation: 0,
      garment,
    };
    setCanvasItems([...canvasItems, newItem]);
    setSelectedItemId(garment.id);
  };

  // Drag handlers for canvas items
  const handlePointerDown = (e: React.PointerEvent, item: ActiveCanvasItem) => {
    e.stopPropagation();
    setSelectedItemId(item.garment_id);
    draggingRef.current = {
      id: item.garment_id,
      startX: e.clientX,
      startY: e.clientY,
      origX: item.x,
      origY: item.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const { id, startX, startY, origX, origY } = draggingRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    setCanvasItems((prev) =>
      prev.map((item) =>
        item.garment_id === id
          ? { ...item, x: Math.max(0, origX + dx), y: Math.max(0, origY + dy) }
          : item
      )
    );
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingRef.current) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      draggingRef.current = null;
    }
  };

  // Layering controls
  const handleBringForward = (id: number) => {
    setCanvasItems((prev) =>
      prev.map((item) =>
        item.garment_id === id ? { ...item, z_index: item.z_index + 1 } : item
      )
    );
  };

  const handleSendBackward = (id: number) => {
    setCanvasItems((prev) =>
      prev.map((item) =>
        item.garment_id === id ? { ...item, z_index: Math.max(1, item.z_index - 1) } : item
      )
    );
  };

  // Scale controls
  const handleResize = (id: number, delta: number) => {
    setCanvasItems((prev) =>
      prev.map((item) => {
        if (item.garment_id !== id) return item;
        const newW = Math.max(80, Math.min(450, item.width + delta));
        const ratio = item.height / item.width;
        return { ...item, width: newW, height: newW * ratio };
      })
    );
  };

  const handleRemoveFromCanvas = (id: number) => {
    setCanvasItems((prev) => prev.filter((item) => item.garment_id !== id));
    if (selectedItemId === id) setSelectedItemId(null);
  };

  // Render canvas to PNG (Client-Side HTML5 Canvas Export)
  const generateCanvasImage = async (): Promise<string> => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 700;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not initialize 2D canvas context.");

    // Background: warm off-white studio background
    ctx.fillStyle = "#FAF8F5";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle studio grid line accent
    ctx.strokeStyle = "#EFECE6";
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Sort items by z_index
    const sorted = [...canvasItems].sort((a, b) => a.z_index - b.z_index);

    // Load and draw each garment image
    for (const item of sorted) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = getImageUrl(item.garment.image_url);
      await new Promise<void>((resolve) => {
        img.onload = () => {
          ctx.drawImage(img, item.x, item.y, item.width, item.height);
          resolve();
        };
        img.onerror = () => resolve(); // continue even if an image fails to load
      });
    }

    // Brand watermark
    ctx.fillStyle = "#141413";
    ctx.font = "bold 16px serif";
    ctx.fillText("Wardrobe", 32, 660);
    ctx.fillStyle = "#78716C";
    ctx.font = "11px monospace";
    ctx.fillText(`LOOK: ${outfitName.toUpperCase()}`, 32, 678);

    return canvas.toDataURL("image/png");
  };

  // Export PNG to user's computer
  const handleExportPNG = async () => {
    try {
      const dataUrl = await generateCanvasImage();
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${outfitName.toLowerCase().replace(/\s+/g, "-")}-look.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("Export PNG failed:", err);
    }
  };

  // Save outfit to database
  const handleSaveOutfit = async () => {
    if (canvasItems.length === 0) return;
    setIsSaving(true);
    try {
      const previewDataUri = await generateCanvasImage();
      const saved = await createOutfit({
        name: outfitName,
        occasion,
        season,
        preview_image_url: previewDataUri,
        layout_data: canvasItems.map((item) => ({
          garment_id: item.garment_id,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          z_index: item.z_index,
          rotation: item.rotation,
        })),
      });

      setSaveSuccessNotice(true);
      setTimeout(() => setSaveSuccessNotice(false), 3000);
      loadSavedOutfits();
      if (onOutfitSaved) onOutfitSaved(saved);
    } catch (err) {
      console.error("Save outfit failed:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Load a saved outfit into canvas
  const handleLoadSavedOutfit = (outfit: Outfit) => {
    const loadedItems: ActiveCanvasItem[] = [];
    for (const item of outfit.layout_data) {
      const garment = garments.find((g) => g.id === item.garment_id);
      if (garment) {
        loadedItems.push({
          ...item,
          garment,
        });
      }
    }
    setCanvasItems(loadedItems);
    setOutfitName(outfit.name);
    if (outfit.occasion) setOccasion(outfit.occasion);
    if (outfit.season) setSeason(outfit.season);
    setActiveTab("builder");
  };

  const handleDeleteSavedOutfit = async (id: number) => {
    if (!confirm("Are you sure you want to delete this saved outfit?")) return;
    try {
      await deleteOutfit(id);
      setSavedOutfits((prev) => prev.filter((o) => o.id !== id));
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const selectedItem = canvasItems.find((i) => i.garment_id === selectedItemId);

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex items-center justify-between border-b border-stone-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("builder")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              activeTab === "builder"
                ? "bg-stone-900 text-stone-50"
                : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50"
            }`}
          >
            Studio Canvas
          </button>
          <button
            onClick={() => setActiveTab("saved")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              activeTab === "saved"
                ? "bg-stone-900 text-stone-50"
                : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50"
            }`}
          >
            <FolderHeart className="w-4 h-4" />
            <span>Saved Looks ({savedOutfits.length})</span>
          </button>
        </div>

        {activeTab === "builder" && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCanvasItems([])}
              disabled={canvasItems.length === 0}
              className="p-2 rounded-xl border border-stone-200 text-stone-500 hover:text-stone-900 disabled:opacity-40"
              title="Clear Canvas"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={handleExportPNG}
              disabled={canvasItems.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-stone-800 text-xs font-medium hover:bg-stone-50 disabled:opacity-40 transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export PNG</span>
            </button>
            <button
              onClick={handleSaveOutfit}
              disabled={canvasItems.length === 0 || isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-900 text-stone-50 text-xs font-medium hover:bg-stone-800 disabled:opacity-40 transition-all shadow-sm"
            >
              {isSaving ? (
                <span className="w-3.5 h-3.5 border-2 border-stone-50 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Save Look</span>
            </button>
          </div>
        )}
      </div>

      {saveSuccessNotice && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>Outfit look saved successfully!</span>
        </div>
      )}

      {activeTab === "saved" ? (
        /* Saved Outfits Gallery */
        <div className="space-y-4">
          {savedOutfits.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {savedOutfits.map((outfit) => (
                <div
                  key={outfit.id}
                  className="group relative flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-4 hover:border-stone-900 hover:shadow-md transition-all"
                >
                  <div className="aspect-[4/3] w-full rounded-xl overflow-hidden bg-stone-50 border border-stone-100 flex items-center justify-center p-2">
                    {outfit.preview_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={getImageUrl(outfit.preview_image_url)}
                        alt={outfit.name}
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <Shirt className="w-10 h-10 text-stone-300" />
                    )}
                  </div>

                  <div className="mt-3 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono uppercase text-stone-500">
                      <span>{outfit.occasion || "Look"}</span>
                      <span>{outfit.layout_data.length} items</span>
                    </div>
                    <h4 className="text-base font-semibold text-stone-900 font-serif truncate">
                      {outfit.name}
                    </h4>
                  </div>

                  <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleLoadSavedOutfit(outfit)}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-stone-900 text-stone-50 text-xs font-medium hover:bg-stone-800 transition-colors"
                    >
                      Load into Studio
                    </button>
                    <button
                      onClick={() => handleDeleteSavedOutfit(outfit.id)}
                      className="p-1.5 text-stone-400 hover:text-rose-600 transition-colors"
                      title="Delete look"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 px-4 rounded-3xl border border-stone-200 bg-white space-y-3">
              <FolderHeart className="w-10 h-10 text-stone-300 mx-auto" />
              <h3 className="text-lg font-semibold text-stone-900 font-serif">
                No saved looks yet
              </h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Use the Studio Canvas to arrange wardrobe items into curated looks and save them here.
              </p>
              <button
                onClick={() => setActiveTab("builder")}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-900 text-stone-50 text-xs font-medium hover:bg-stone-800"
              >
                Open Studio Canvas
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Studio Canvas Builder */
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Canvas Styling Surface (3 Cols) */}
          <div className="lg:col-span-3 space-y-4">
            {/* Metadata Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-white border border-stone-200">
              <div>
                <label className="block text-[11px] font-mono text-stone-500 uppercase">
                  Look Name
                </label>
                <input
                  type="text"
                  value={outfitName}
                  onChange={(e) => setOutfitName(e.target.value)}
                  className="w-full text-sm font-semibold text-stone-900 bg-transparent border-b border-stone-200 focus:border-stone-900 outline-none pb-0.5"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-stone-500 uppercase">
                  Occasion
                </label>
                <select
                  value={occasion}
                  onChange={(e) => setOccasion(e.target.value)}
                  className="w-full text-xs font-medium text-stone-800 bg-transparent border-b border-stone-200 focus:border-stone-900 outline-none py-1"
                >
                  <option value="casual">Casual / Daily</option>
                  <option value="work">Work / Smart Casual</option>
                  <option value="formal">Formal / Evening</option>
                  <option value="date-night">Date Night</option>
                  <option value="travel">Travel / Weekend</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-stone-500 uppercase">
                  Season
                </label>
                <select
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  className="w-full text-xs font-medium text-stone-800 bg-transparent border-b border-stone-200 focus:border-stone-900 outline-none py-1"
                >
                  <option value="all">All Year</option>
                  <option value="spring">Spring</option>
                  <option value="summer">Summer</option>
                  <option value="fall">Fall</option>
                  <option value="winter">Winter</option>
                </select>
              </div>
            </div>

            {/* Interactive Canvas */}
            <div
              ref={canvasRef}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="relative w-full h-[580px] rounded-3xl border border-stone-300 bg-[#faf8f5] shadow-inner overflow-hidden select-none [background-image:radial-gradient(#d6d3d1_1px,transparent_1px)] [background-size:24px_24px]"
            >
              {canvasItems.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 space-y-3 pointer-events-none">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-stone-200 flex items-center justify-center text-stone-400 shadow-xs">
                    <Shirt className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-stone-800 font-serif">
                      Your Canvas is Empty
                    </p>
                    <p className="text-xs text-stone-500 font-mono mt-1 max-w-xs">
                      Click any garment from the drawer on the right to position and style it here.
                    </p>
                  </div>
                </div>
              ) : (
                canvasItems.map((item) => {
                  const isSelected = selectedItemId === item.garment_id;
                  return (
                    <div
                      key={item.garment_id}
                      onPointerDown={(e) => handlePointerDown(e, item)}
                      style={{
                        position: "absolute",
                        left: `${item.x}px`,
                        top: `${item.y}px`,
                        width: `${item.width}px`,
                        height: `${item.height}px`,
                        zIndex: item.z_index,
                        cursor: "grab",
                      }}
                      className={`group transition-shadow touch-none ${
                        isSelected
                          ? "ring-2 ring-stone-900 shadow-xl rounded-xl"
                          : "hover:ring-1 hover:ring-stone-400"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getImageUrl(item.garment.image_url)}
                        alt={item.garment.name}
                        draggable={false}
                        className="w-full h-full object-contain pointer-events-none drop-shadow-md"
                      />

                      {/* Controls on selected item */}
                      {isSelected && (
                        <div className="absolute -top-9 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-stone-900/90 text-stone-50 px-2 py-1 rounded-lg backdrop-blur-xs text-[10px] font-mono shadow-md whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBringForward(item.garment_id);
                            }}
                            className="p-1 hover:text-stone-300"
                            title="Bring Forward"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSendBackward(item.garment_id);
                            }}
                            className="p-1 hover:text-stone-300"
                            title="Send Backward"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                          <div className="w-px h-3 bg-stone-700 mx-0.5" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResize(item.garment_id, -20);
                            }}
                            className="px-1 hover:text-stone-300"
                            title="Shrink"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResize(item.garment_id, 20);
                            }}
                            className="px-1 hover:text-stone-300"
                            title="Enlarge"
                          >
                            +
                          </button>
                          <div className="w-px h-3 bg-stone-700 mx-0.5" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFromCanvas(item.garment_id);
                            }}
                            className="p-1 hover:text-rose-400"
                            title="Remove"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <p className="text-[11px] text-stone-500 font-mono text-center">
              Drag items to move • Click an item to adjust layering and scale • Export crisp PNG anytime
            </p>
          </div>

          {/* Wardrobe Drawer (1 Col) */}
          <div className="lg:col-span-1 space-y-4">
            <div className="p-4 rounded-2xl bg-white border border-stone-200">
              <h3 className="text-sm font-semibold text-stone-900 font-serif">
                Wardrobe Drawer
              </h3>
              <p className="text-xs text-stone-500 font-mono mt-0.5">
                Click an item to place on canvas
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
              {garments.map((garment) => {
                const isAlreadyOnCanvas = canvasItems.some((i) => i.garment_id === garment.id);
                return (
                  <button
                    key={garment.id}
                    type="button"
                    onClick={() => handleAddGarmentToCanvas(garment)}
                    className={`relative flex flex-col items-center p-2.5 rounded-xl border text-left transition-all ${
                      isAlreadyOnCanvas
                        ? "border-stone-900 bg-stone-50 ring-1 ring-stone-900"
                        : "border-stone-200 bg-white hover:border-stone-400"
                    }`}
                  >
                    <div className="aspect-square w-full rounded-lg overflow-hidden bg-stone-50 flex items-center justify-center p-1.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getImageUrl(garment.image_url)}
                        alt={garment.name}
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                    <span className="text-[11px] font-medium text-stone-900 truncate w-full mt-1.5 font-serif">
                      {garment.name}
                    </span>
                    <span className="text-[9px] font-mono text-stone-500 uppercase tracking-wider">
                      {garment.category}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
