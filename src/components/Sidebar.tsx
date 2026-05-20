"use client";

import { useDataStore } from "@/store/useDataStore";
import { Search, X, ChevronRight } from "lucide-react";
import { useState, useMemo } from "react";

export function Sidebar() {
  const { geneList, markerGenes, selectedGenes, toggleGene, geneQuery, setGeneQuery, markerSize, setMarkerSize, opacity, setOpacity, sampleInfo, umapColorBy, setUmapColorBy } = useDataStore();
  const [collapsed, setCollapsed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const MAX_SELECTED = 20;

  const markerSet = useMemo(() => {
    if (!markerGenes) return new Set<string>();
    const s = new Set<string>();
    for (const genes of Object.values(markerGenes)) for (const g of genes) s.add(g);
    return s;
  }, [markerGenes]);

  const displayGenes = useMemo(() => (geneList ?? []), [geneList]);
  const filtered = useMemo(() => {
    if (!geneQuery) return showAll ? displayGenes : displayGenes.filter(g => markerSet.has(g));
    const q = geneQuery.toLowerCase();
    return displayGenes.filter(g => g.toLowerCase().includes(q));
  }, [displayGenes, geneQuery, showAll, markerSet]);

  if (collapsed) return (
    <button onClick={() => setCollapsed(false)}
      className="h-full w-9 border-r border-[#30363d] bg-[#161b22] flex items-start pt-4 justify-center shrink-0 hover:bg-[#21262d] transition-colors">
      <ChevronRight className="w-4 h-4 text-[#8b949e]" />
    </button>
  );

  return (
    <aside className="w-72 border-r border-[#30363d] bg-[#161b22] flex flex-col shrink-0 overflow-y-auto">
      <div className="px-5 py-3.5 border-b border-[#21262d] flex items-center justify-between">
        <h2 className="text-sm font-bold text-[#e6edf3] tracking-tight">Controls</h2>
        <button onClick={() => setCollapsed(true)} className="text-[#484f58] hover:text-[#8b949e] transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-5 py-3.5 border-b border-[#21262d] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-[#8b949e] uppercase tracking-wider">Marker Size</span>
          <span className="text-xs font-bold text-[#e6edf3] tabular-nums">{markerSize}</span>
        </div>
        <input type="range" min="1" max="10" step="0.5" value={markerSize} onChange={(e) => setMarkerSize(parseFloat(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none bg-[#30363d] cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#58a6ff] [&::-webkit-slider-thumb]:shadow-sm" />
      </div>

      <div className="px-5 py-3.5 border-b border-[#21262d] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-[#8b949e] uppercase tracking-wider">Opacity</span>
          <span className="text-xs font-bold text-[#e6edf3] tabular-nums">{opacity.toFixed(1)}</span>
        </div>
        <input type="range" min="0.1" max="1" step="0.05" value={opacity} onChange={(e) => setOpacity(parseFloat(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none bg-[#30363d] cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#58a6ff] [&::-webkit-slider-thumb]:shadow-sm" />
      </div>
      
      <div className="px-5 py-3.5 border-b border-[#21262d] space-y-2">
        <span className="text-[11px] font-semibold text-[#8b949e] uppercase tracking-wider">UMAP Color By</span>
        <div className="flex rounded-lg bg-[#21262d] p-0.5">
          <button onClick={() => setUmapColorBy('ct')}
            className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              umapColorBy === 'ct' ? "bg-[#0d1117] text-[#e6edf3] shadow-sm" : "text-[#8b949e] hover:text-[#e6edf3]"
            }`}>
            Cell Type
          </button>
          <button onClick={() => setUmapColorBy('sample')}
            className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              umapColorBy === 'sample' ? "bg-[#0d1117] text-[#e6edf3] shadow-sm" : "text-[#8b949e] hover:text-[#e6edf3]"
            }`}>
            Tissue (AAP/DAP/FP/PP/RM)
          </button>
        </div>
      </div>

      <div className="px-5 py-3.5 border-b border-[#21262d]">
        <label className="text-[11px] font-semibold text-[#8b949e] uppercase tracking-wider block mb-2">Gene Search</label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#484f58]" />
          <input type="text" value={geneQuery} onChange={(e) => setGeneQuery(e.target.value)} placeholder={`Search ${(geneList?.length ?? 0).toLocaleString()} genes…`}
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg pl-8 pr-3 py-2 text-xs text-[#e6edf3] placeholder:text-[#484f58] focus:outline-none focus:ring-2 focus:ring-[#58a6ff]/20 focus:border-[#58a6ff] transition-shadow" />
        </div>
        {!geneQuery && (
          <button onClick={() => setShowAll(!showAll)}
            className="mt-2 text-[11px] font-medium text-[#58a6ff] hover:text-[#79b8ff] transition-colors">
            {showAll ? "Show marker genes only" : `Show all ${(geneList?.length ?? 0).toLocaleString()} genes`}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3.5">
        <label className="text-[11px] font-semibold text-[#8b949e] uppercase tracking-wider block mb-2">
          Marker Genes ({filtered.length.toLocaleString()})
        </label>
        <div className="space-y-0.5">
          {selectedGenes.length >= MAX_SELECTED && (
            <div className="mb-2 px-2.5 py-2 rounded-lg bg-[#f85149]/10 border border-[#f85149]/25 text-[11px] text-[#f85149]">
              Limit reached: {MAX_SELECTED} genes maximum. Remove some genes first.
            </div>
          )}
          {filtered.slice(0, 200).map((gene) => {
            const isSelected = selectedGenes.includes(gene);
            const isMarker = markerSet.has(gene);
            const isDisabled = !isSelected && selectedGenes.length >= MAX_SELECTED;
            return (
              <button key={gene} onClick={() => toggleGene(gene)} disabled={isDisabled}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isDisabled ? "opacity-50 cursor-not-allowed text-[#484f58] border border-transparent"
                  : isSelected ? "bg-[#58a6ff]/12 text-[#58a6ff] border border-[#58a6ff]/25"
                  : isMarker ? "text-[#e6edf3] hover:bg-[#21262d] border border-transparent"
                  : "text-[#8b949e] hover:bg-[#21262d] border border-transparent"
                }`}>
                {gene}{isMarker ? " *" : ""}
              </button>
            );
          })}
          {filtered.length > 200 && (
            <p className="text-xs text-[#484f58] py-2">Showing first 200 of {filtered.length.toLocaleString()} matches. Refine your search.</p>
          )}
          {filtered.length === 0 && (
            <p className="text-xs text-[#484f58] py-2">No genes match "{geneQuery}"</p>
          )}
        </div>
      </div>

      {sampleInfo && (
        <div className="px-5 py-3 border-t border-[#21262d]">
          <p className="text-[11px] text-[#484f58] font-medium tabular-nums">
            {Object.keys(sampleInfo.cell_types).length} cell types &middot; {sampleInfo.total_cells.toLocaleString()} cells
          </p>
        </div>
      )}
      <div className="px-5 py-3 border-t border-[#21262d]">
        <p className="text-[10px] text-[#8b949e] leading-relaxed">
          Data Source:<br/>
          Ba, Hengxing, et al. "Single-cell transcriptome reveals core cell populations and androgen-RXFP2 axis involved in deer antler full regeneration." Cell Regeneration 11.1 (2022): 43.
        </p>
      </div>
    </aside>
  );
}
