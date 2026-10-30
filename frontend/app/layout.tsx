import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "whearing — Virtual Try-On",
  description: "See it on you. Pick a photo, pick a piece, and see how it really looks. Playful, quick and free of guesswork.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-full font-dmsans bg-white text-[#111] antialiased">
        {children}
      </body>
    </html>
  );
}
