"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { EmptyState } from "@/components/EmptyState";
import { WardrobeCatalog } from "@/components/WardrobeCatalog";
import { OutfitBuilder } from "@/components/OutfitBuilder";
import { UploadModal } from "@/components/UploadModal";
import { AuthModal } from "@/components/AuthModal";
import { Footer } from "@/components/Footer";
import {
  User,
  Garment,
  getCurrentUser,
  demoLogin,
  listGarments,
  getAuthToken,
  removeAuthToken,
} from "@/lib/api";

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [garments, setGarments] = useState<Garment[]>([]);
  const [activeView, setActiveView] = useState<"wardrobe" | "outfits">("wardrobe");
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isLoadingGarments, setIsLoadingGarments] = useState(true);

  // Initialize session: check token or auto-login to demo account for instant evaluation
  useEffect(() => {
    const initSession = async () => {
      try {
        const token = getAuthToken();
        if (token) {
          try {
            const user = await getCurrentUser();
            setCurrentUser(user);
            await fetchGarments();
            return;
          } catch {
            removeAuthToken();
          }
        }
        // Auto-login to demo account for seamless first-time experience
        const demoAuth = await demoLogin();
        setCurrentUser(demoAuth.user);
        await fetchGarments();
      } catch (err) {
        console.error("Session initialization:", err);
      } finally {
        setIsLoadingGarments(false);
      }
    };

    initSession();
  }, []);

  const fetchGarments = async () => {
    setIsLoadingGarments(true);
    try {
      const res = await listGarments({ limit: 100 });
      setGarments(res.items);
    } catch (err) {
      console.error("Failed to load garments:", err);
    } finally {
      setIsLoadingGarments(false);
    }
  };

  const handleGarmentAdded = (newGarment: Garment) => {
    setGarments((prev) => [newGarment, ...prev]);
  };

  const handleGarmentUpdated = (updated: Garment) => {
    setGarments((prev) =>
      prev.map((g) => (g.id === updated.id ? updated : g))
    );
  };

  const handleGarmentDeleted = (deletedId: number) => {
    setGarments((prev) => prev.filter((g) => g.id !== deletedId));
  };

  const handleLogout = () => {
    removeAuthToken();
    setCurrentUser(null);
    setGarments([]);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#faf8f5] text-stone-900 selection:bg-stone-900 selection:text-stone-50">
      <Navbar
        currentUser={currentUser}
        activeView={activeView}
        onSelectView={(view) => setActiveView(view)}
        onOpenUpload={() => setIsUploadModalOpen(true)}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {activeView === "wardrobe" ? (
          garments.length === 0 && !isLoadingGarments ? (
            <EmptyState onOpenUpload={() => setIsUploadModalOpen(true)} />
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-stone-200">
                <div>
                  <span className="text-xs font-mono uppercase tracking-widest text-stone-500">
                    Collection ({garments.length} pieces)
                  </span>
                  <h1 className="text-3xl font-semibold tracking-tight text-stone-950 font-serif">
                    Your Digital Wardrobe
                  </h1>
                </div>
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 text-stone-50 text-sm font-medium hover:bg-stone-800 transition-all shadow-sm"
                >
                  <span>Add Clothes</span>
                </button>
              </div>

              <WardrobeCatalog
                garments={garments}
                onGarmentUpdated={handleGarmentUpdated}
                onGarmentDeleted={handleGarmentDeleted}
                onOpenUpload={() => setIsUploadModalOpen(true)}
                onAddToOutfit={(garment) => {
                  setActiveView("outfits");
                }}
              />
            </div>
          )
        ) : (
          <div className="space-y-6">
            <div className="pb-4 border-b border-stone-200">
              <span className="text-xs font-mono uppercase tracking-widest text-stone-500">
                Styling Studio
              </span>
              <h1 className="text-3xl font-semibold tracking-tight text-stone-950 font-serif">
                Outfit Canvas & Visualizer
              </h1>
            </div>

            <OutfitBuilder garments={garments} />
          </div>
        )}
      </main>

      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onGarmentAdded={handleGarmentAdded}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(user) => {
          setCurrentUser(user);
          fetchGarments();
        }}
      />

      <Footer />
    </div>
  );
}
