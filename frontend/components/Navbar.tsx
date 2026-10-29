"use client";

import { useState } from "react";
import { Sparkles, Menu, X, ShieldCheck, User as UserIcon, LogOut, Shirt, Palette } from "lucide-react";
import { BackendStatusBadge } from "./BackendStatusBadge";
import { User, removeAuthToken } from "@/lib/api";

interface NavbarProps {
  currentUser: User | null;
  activeView: "wardrobe" | "outfits" | "tryon";
  onSelectView: (view: "wardrobe" | "outfits" | "tryon") => void;
  onOpenUpload: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
}

export function Navbar({
  currentUser,
  activeView,
  onSelectView,
  onOpenUpload,
  onOpenAuth,
  onLogout,
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-stone-200/80 bg-[#faf8f5]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onSelectView("wardrobe")}
              className="flex items-center gap-2 group focus:outline-none"
            >
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-stone-900 text-stone-50 font-serif text-lg font-bold shadow-sm transition-transform group-hover:scale-105">
                W
              </span>
              <span className="text-xl font-semibold tracking-tight text-stone-950 font-serif">
                Wardrobe
              </span>
            </button>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono tracking-wider uppercase px-2 py-0.5 rounded border border-stone-200 bg-stone-100/80 text-stone-600">
              <ShieldCheck className="w-3 h-3 text-stone-500" />
              Autonomous
            </span>
          </div>

          {/* Desktop Navigation & Actions */}
          <div className="hidden md:flex items-center gap-6">
            <nav className="flex items-center gap-2 text-sm font-medium text-stone-600">
              <button
                onClick={() => onSelectView("wardrobe")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                  activeView === "wardrobe"
                    ? "bg-stone-200/70 text-stone-950 font-semibold"
                    : "text-stone-600 hover:text-stone-950"
                }`}
              >
                <Shirt className="w-4 h-4" />
                <span>Wardrobe</span>
              </button>

              <button
                onClick={() => onSelectView("outfits")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                  activeView === "outfits"
                    ? "bg-stone-200/70 text-stone-950 font-semibold"
                    : "text-stone-600 hover:text-stone-950"
                }`}
              >
                <Palette className="w-4 h-4" />
                <span>Outfit Studio</span>
              </button>

              <button
                onClick={() => onSelectView("tryon")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                  activeView === "tryon"
                    ? "bg-amber-100/80 text-amber-950 font-semibold border border-amber-200/60"
                    : "text-stone-600 hover:text-amber-800"
                }`}
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Virtual Try-On</span>
              </button>
            </nav>

            <div className="h-4 w-px bg-stone-200" />

            {/* Live Backend Connection Indicator */}
            <BackendStatusBadge />

            {/* User Profile / Auth State */}
            {currentUser ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-stone-600 px-2 py-1 rounded bg-stone-100 border border-stone-200 truncate max-w-[140px]">
                  {currentUser.email.split("@")[0]}
                </span>
                <button
                  onClick={onLogout}
                  className="p-1.5 text-stone-400 hover:text-stone-900 transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-700 hover:text-stone-950 border border-stone-300 px-3 py-1.5 rounded-lg hover:bg-stone-100 transition-colors"
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}

            {/* Primary Action Button */}
            <button
              onClick={onOpenUpload}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-stone-900 text-stone-50 text-sm font-medium hover:bg-stone-800 active:scale-[0.98] transition-all shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Add Clothes</span>
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <BackendStatusBadge />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-stone-700 hover:bg-stone-100 focus:outline-none"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-stone-200 bg-[#faf8f5] px-4 pt-3 pb-5 space-y-3">
          <div className="flex flex-col space-y-2 text-sm font-medium text-stone-700">
            <button
              onClick={() => {
                onSelectView("wardrobe");
                setMobileMenuOpen(false);
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-left ${
                activeView === "wardrobe" ? "bg-stone-200 text-stone-950 font-semibold" : ""
              }`}
            >
              <Shirt className="w-4 h-4" />
              <span>Wardrobe</span>
            </button>

            <button
              onClick={() => {
                onSelectView("outfits");
                setMobileMenuOpen(false);
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-left ${
                activeView === "outfits" ? "bg-stone-200 text-stone-950 font-semibold" : ""
              }`}
            >
              <Palette className="w-4 h-4" />
              <span>Outfit Studio</span>
            </button>

            <button
              onClick={() => {
                onSelectView("tryon");
                setMobileMenuOpen(false);
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-left ${
                activeView === "tryon" ? "bg-amber-100 text-amber-950 font-semibold" : ""
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Virtual Try-On</span>
            </button>
          </div>

          <div className="pt-2 border-t border-stone-200 flex items-center justify-between">
            {currentUser ? (
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-mono text-stone-600 truncate">{currentUser.email}</span>
                <button
                  onClick={() => {
                    onLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="text-xs text-rose-600 font-medium"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  onOpenAuth();
                  setMobileMenuOpen(false);
                }}
                className="text-xs font-medium text-stone-900 underline"
              >
                Sign In or Register
              </button>
            )}
          </div>

          <div className="pt-2">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenUpload();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-stone-900 text-stone-50 text-sm font-medium hover:bg-stone-800"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              Add Clothes
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
