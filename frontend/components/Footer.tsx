export function Footer() {
  return (
    <footer className="mt-auto border-t border-stone-200 bg-[#faf8f5] py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-stone-500 font-mono">
          <div className="flex items-center gap-2">
            <span className="font-serif font-bold text-stone-900 text-sm">Wardrobe</span>
            <span className="text-stone-300">/</span>
            <span>Phase 1 — Project Foundation</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-stone-600">
            <span>Next.js 16 (React 19)</span>
            <span>•</span>
            <span>Tailwind CSS</span>
            <span>•</span>
            <span>FastAPI Backend</span>
            <span>•</span>
            <span>₹0 Budget Architecture</span>
          </div>

          <div className="text-stone-400 text-center md:text-right">
            Local Dev: 127.0.0.1:3000 & 127.0.0.1:8000
          </div>
        </div>
      </div>
    </footer>
  );
}
