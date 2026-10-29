"use client";

import { useState } from "react";
import { Sparkles, Menu, X, ShieldCheck } from "lucide-react";
import { BackendStatusBadge } from "./BackendStatusBadge";

interface NavbarProps {
  onOpenUpload: () => void;
}

export function Navbar({ onOpenUpload }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-stone-200/80 bg-[#faf8f5]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="flex items-center gap-2 group focus:outline-none"
            >
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-stone-900 text-stone-50 font-serif text-lg font-bold shadow-sm transition-transform group-hover:scale-105">
                W
              </span>
              <span className="text-xl font-semibold tracking-tight text-stone-950 font-serif">
                Wardrobe
              </span>
            </a>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono tracking-wider uppercase px-2 py-0.5 rounded border border-stone-200 bg-stone-100/80 text-stone-600">
              <ShieldCheck className="w-3 h-3 text-stone-500" />
              Phase 1 Foundation
            </span>
          </div>

          {/* Desktop Navigation & Actions */}
          <div className="hidden md:flex items-center gap-6">
            <nav className="flex items-center gap-5 text-sm font-medium text-stone-600">
              <a
                href="#wardrobe"
                className="text-stone-900 hover:text-stone-950 transition-colors"
              >
                Wardrobe
              </a>
              <span
                className="text-stone-400 cursor-not-allowed text-xs flex items-center gap-1"
                title="Available in Phase 3"
              >
                Outfits <span className="text-[10px] uppercase font-mono px-1 rounded bg-stone-100 text-stone-400">Soon</span>
              </span>
              <span
                className="text-stone-400 cursor-not-allowed text-xs flex items-center gap-1"
                title="Available in Phase 4"
              >
                Analytics <span className="text-[10px] uppercase font-mono px-1 rounded bg-stone-100 text-stone-400">Soon</span>
              </span>
            </nav>

            <div className="h-4 w-px bg-stone-200" />

            {/* Live Backend Connection Indicator */}
            <BackendStatusBadge />

            {/* Primary Action Button */}
            <button
              onClick={onOpenUpload}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-stone-900 text-stone-50 text-sm font-medium hover:bg-stone-800 active:scale-[0.98] transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-stone-950 focus:ring-offset-2"
            >
              <Sparkles className="w-3.5 h-3.5 text-stone-300" />
              Add Clothes
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <BackendStatusBadge />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Navigation Menu"
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
            <a
              href="#wardrobe"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-md hover:bg-stone-100 text-stone-900"
            >
              Wardrobe
            </a>
            <div className="px-3 py-1.5 text-xs text-stone-400 flex items-center justify-between">
              <span>Outfits</span>
              <span className="font-mono text-[10px] bg-stone-100 px-1.5 py-0.5 rounded">Phase 3</span>
            </div>
            <div className="px-3 py-1.5 text-xs text-stone-400 flex items-center justify-between">
              <span>Analytics</span>
              <span className="font-mono text-[10px] bg-stone-100 px-1.5 py-0.5 rounded">Phase 4</span>
            </div>
          </div>

          <div className="pt-2 border-t border-stone-200">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenUpload();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-stone-900 text-stone-50 text-sm font-medium hover:bg-stone-800 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-stone-300" />
              Add Clothes
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
