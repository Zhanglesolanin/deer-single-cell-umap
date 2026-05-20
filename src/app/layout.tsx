import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "scRNA UMAP Explorer",
  description: "Single-cell RNA-seq interactive visualization",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
