"use client";

import { useEffect, useState } from "react";
import { useDataStore, ViewMode } from "@/store/useDataStore";
import { Sidebar } from "@/components/Sidebar";
import { UMAPView } from "@/components/UMAPView";
import { DotPlotView } from "@/components/DotPlotView";
import { ViolinView } from "@/components/ViolinView";
import { HeatmapView } from "@/components/HeatmapView";
import { Dna } from "lucide-react";

const TAB_LABELS: Record<ViewMode, string> = {
  umap: "UMAP Clustering", dotplot: "ACT", violin: "Violin Plot", heatmap: "Dot Plot",
};
const TAB_ORDER: ViewMode[] = ["umap", "dotplot", "violin", "heatmap"];

function Spinner() {
  return (
    <div
      className="w-8 h-8 border-[3px] border-[#30363d] border-t-[#58a6ff] rounded-full animate-spin"
      aria-hidden="true"
    />
  );
}

function LoadingScreen() {
  return (
    <div className="h-screen flex flex-col items-center justify-center gap-4 bg-[#0d1117]">
      <Spinner />
      <p className="text-[#8b949e] text-sm">Loading single‑cell data…</p>
    </div>
  );
}

export default function Home() {
  const { loadData, loading, viewMode, setViewMode, sampleInfo, loadError } = useDataStore();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    loadData();
  }, [loadData]);

  if (!isClient) {
    return <LoadingScreen />;
  }

  if (loading) {
    return <LoadingScreen />;
  }

  if (loadError) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 bg-[#0d1117]">
        <p className="text-red-400 text-sm font-semibold">Failed to load data</p>
        <p className="text-[#8b949e] text-xs max-w-lg text-center">{loadError}</p>
        <button 
          onClick={() => loadData()}
          className="px-4 py-2 bg-[#58a6ff] text-white rounded-lg text-sm font-medium hover:bg-[#79b8ff] transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden bg-[#0d1117]">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-13 border-b border-[#30363d] flex items-center px-5 shrink-0 bg-[#161b22]">
          <div className="w-7 h-7 rounded-md bg-[#58a6ff] flex items-center justify-center mr-2.5">
            <Dna className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold text-[#e6edf3] tracking-tight">scRNA‑seq Explorer for deer antler stem cells</span>
          {sampleInfo && (
            <span className="ml-auto text-[11px] text-[#8b949e] font-medium tabular-nums">
              {sampleInfo.total_cells.toLocaleString()} cells &middot; {Object.keys(sampleInfo.cell_types).length} cell types
            </span>
          )}
          <div className="ml-5 flex rounded-lg bg-[#21262d] p-0.5">
            {TAB_ORDER.map((tab) => (
              <button key={tab} onClick={() => setViewMode(tab)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  viewMode === tab ? "bg-[#0d1117] text-[#e6edf3] shadow-sm" : "text-[#8b949e] hover:text-[#e6edf3]"
                }`}>
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>
        </header>
        <div className="flex-1 min-h-0">
          {viewMode === "umap" && <UMAPView />}
          {viewMode === "dotplot" && <DotPlotView />}
          {viewMode === "violin" && <ViolinView />}
          {viewMode === "heatmap" && <HeatmapView />}
        </div>
      </main>
    </div>
  );
}
