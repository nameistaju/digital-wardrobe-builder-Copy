"use client";

import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { EmptyState } from "@/components/EmptyState";
import { UploadModal } from "@/components/UploadModal";
import { Footer } from "@/components/Footer";

export default function HomePage() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[#faf8f5] text-stone-900 selection:bg-stone-900 selection:text-stone-50">
      <Navbar onOpenUpload={() => setIsUploadModalOpen(true)} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        <EmptyState onOpenUpload={() => setIsUploadModalOpen(true)} />
      </main>

      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />

      <Footer />
    </div>
  );
}
