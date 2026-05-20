"use client";

import { useDataStore, CellMeta } from "@/store/useDataStore";
import { useMemo, useCallback, useEffect, useRef } from "react";
import Plot from "@/components/PlotWrapper";
import type { Data } from "plotly.js";

const CELL_TYPE_ORDER = [
  "THY1+ cells", "Progenitor cells", "Osteochondroblasts",
  "Mural cells", "Endothelial cells", "Monocyte/Macrophage",
  "Mast cells", "Natural killer/T cells",
];

const DISCRETE_COLORS: Record<string, string> = {
  "THY1+ cells": "#c0392b", "Progenitor cells": "#e67e22",
  "Osteochondroblasts": "#27ae60", "Mural cells": "#3498db",
  "Endothelial cells": "#9b59b6", "Monocyte/Macrophage": "#f1c40f",
  "Mast cells": "#fd79a8", "Natural killer/T cells": "#1abc9c",
};

const SAMPLE_NAME_MAP: Record<string, string> = {
    "0": "FP",
    "1": "RM", 
    "2": "DAP",
    "3": "PP",
    "4": "AAP"
};

const SAMPLE_COLOR_LIST = [
    "#58a6ff", "#3fb950", "#a371f7", "#f78166", "#f0883e", "#ffa657",
    "#7ce38b", "#939aff", "#f6c445", "#a8b1ff", "#ff7b72", "#986ee2",
];

function getSampleName(sample: string): string {
    return SAMPLE_NAME_MAP[sample] || sample;
}

function getSampleColor(sample: string, index: number): string {
    return SAMPLE_COLOR_LIST[index % SAMPLE_COLOR_LIST.length];
}

const GENE_COLORSCALE: [number, string][] = [
  [0,"#fff"],[0.2,"#fee0d2"],[0.4,"#fc9272"],[0.6,"#de2d26"],[0.8,"#b2182b"],[1,"#67000d"],
];

function unLogVal(logVal: number, maxExp: number): number {
  return Math.expm1(logVal * Math.log1p(maxExp));
}

function buildColorbarTicks(maxExp: number): { tickvals: number[]; ticktext: string[] } {
  const tvs: number[] = [], tts: string[] = [];
  for (let f = 0; f <= 1; f += 0.2) {
    tvs.push(f);
    const raw = unLogVal(f, maxExp);
    tts.push(raw < 1 ? raw.toFixed(2) : raw < 10 ? raw.toFixed(1) : Math.round(raw).toString());
  }
  return { tickvals: tvs, ticktext: tts };
}

function buildCellTypeTraces(meta: CellMeta[], mSize: number, op: number, dim?: boolean): Data[] {
  const ctSet = new Set(meta.map(c => c.ct));
  return CELL_TYPE_ORDER.filter(ct => ctSet.has(ct)).map(ct => {
    const idxs = meta.map((c, k) => (c.ct === ct ? k : -1)).filter(k => k >= 0);
    return {
      x: idxs.map(k => meta[k].x), y: idxs.map(k => meta[k].y),
      mode: "markers", type: "scattergl",
      marker: { color: DISCRETE_COLORS[ct] ?? "#999", size: dim ? mSize * 0.5 : mSize, opacity: dim ? 0.18 : op, line: { width: 0 } },
      text: idxs.map(k => `${meta[k].b}<br>${meta[k].ct}`),
      hoverinfo: (dim ? "skip" : "text"),
      name: ct, showlegend: true,
    } as Data;
  });
}

function buildSampleTraces(meta: CellMeta[], mSize: number, op: number, dim?: boolean): Data[] {
  const sampleSet = new Set(meta.map(c => c.sample));
  const uniqueSamples = Array.from(sampleSet).sort();
  return uniqueSamples.map((sample, index) => {
    const idxs = meta.map((c, k) => (c.sample === sample ? k : -1)).filter(k => k >= 0);
    return {
      x: idxs.map(k => meta[k].x), y: idxs.map(k => meta[k].y),
      mode: "markers", type: "scattergl",
      marker: { color: getSampleColor(sample, index), size: dim ? mSize * 0.5 : mSize, opacity: dim ? 0.18 : op, line: { width: 0 } },
      text: idxs.map(k => `${meta[k].b}<br>${getSampleName(meta[k].sample)}`),
      hoverinfo: (dim ? "skip" : "text"),
      name: getSampleName(sample), showlegend: true,
    } as Data;
  });
}

interface GeneData {
  values: number[]; sizes: number[]; labels: string[]; maxExp: number;
}

function buildGeneTrace(meta: CellMeta[], gene: string, values: number[], sizes: number[], labels: string[], op: number, showLegend: boolean, maxExp: number): Data {
  const colorbar = buildColorbarTicks(maxExp);
  return {
    x: meta.map(c => c.x), y: meta.map(c => c.y),
    mode: "markers", type: "scattergl",
    marker: { 
      color: values, colorscale: GENE_COLORSCALE, opacity: op, 
      size: sizes, colorbar: { ...colorbar, title: { text: gene, side: "right" }, len: 0.8, thickness: 12 },
      line: { width: 0 }, 
    },
    text: labels, hoverinfo: "text",
    name: gene, showlegend: showLegend,
  } as Data;
}

function interpolateColor(t: number, colors: [number, string][]): string {
  if (t <= 0) return colors[0][1];
  if (t >= 1) return colors[colors.length - 1][1];
  
  for (let i = 0; i < colors.length - 1; i++) {
    if (t >= colors[i][0] && t <= colors[i + 1][0]) {
      const t2 = (t - colors[i][0]) / (colors[i + 1][0] - colors[i][0]);
      const c1 = hexToRgb(colors[i][1]);
      const c2 = hexToRgb(colors[i + 1][1]);
      if (!c1 || !c2) return colors[i][1];
      const r = Math.round(c1.r + t2 * (c2.r - c1.r));
      const g = Math.round(c1.g + t2 * (c2.g - c1.g));
      const b = Math.round(c1.b + t2 * (c2.b - c1.b));
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  return colors[colors.length - 1][1];
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function CanvasThumbnail({ meta, title, values, cellTypeColors, sampleColors }: {
  meta: CellMeta[];
  title: string;
  values?: number[];
  cellTypeColors?: boolean;
  sampleColors?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !meta.length) return;
    
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = rect.height;
    
    ctx.fillStyle = '#161b22';
    ctx.fillRect(0, 0, width, height);
    
    // 先绘制标题（在顶部）
    ctx.fillStyle = '#e6edf3';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, 12);
    
    const xs = meta.map(c => c.x);
    const ys = meta.map(c => c.y);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const xRange = xMax - xMin;
    const yRange = yMax - yMin;
    
    // 为sample创建颜色映射
    const sampleSet = new Set(meta.map(c => c.sample));
    const uniqueSamples = Array.from(sampleSet).sort();
    const sampleToColor: Record<string, string> = {};
    uniqueSamples.forEach((sample, index) => {
      sampleToColor[sample] = getSampleColor(sample, index);
    });
    
    const padding = 8;
    const topOffset = 18; // 留出标题空间
    const plotWidth = width - padding * 2;
    const plotHeight = height - padding * 2 - topOffset;
    
    const cellSize = Math.max(0.7, Math.min(2, Math.sqrt((plotWidth * plotHeight) / meta.length)));
    
    for (let i = 0; i < meta.length; i++) {
      const x = padding + ((xs[i] - xMin) / xRange) * plotWidth;
      const y = topOffset + padding + (1 - (ys[i] - yMin) / yRange) * plotHeight;
      
      let color: string;
      if (values) {
        color = interpolateColor(values[i], GENE_COLORSCALE);
      } else if (cellTypeColors) {
        color = DISCRETE_COLORS[meta[i].ct] || '#999';
      } else if (sampleColors) {
        color = sampleToColor[meta[i].sample] || '#999';
      } else {
        color = '#666';
      }
      
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, cellSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [meta, title, values, cellTypeColors, sampleColors]);
  
  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}

const LARGE = {
  autosize: true, margin: { l: 30, r: 30, t: 30, b: 60 },
  paper_bgcolor: "#0d1117", plot_bgcolor: "#161b22",
  font: { color: "#8b949e", size: 11 },
  legend: { orientation: "h", y: -0.12, x: 0.5, xanchor: "center", font: { size: 11 }, itemsizing: "constant" as const, itemwidth: 20 },
  dragmode: "pan" as const, hovermode: "closest" as const,
};

const MAIN_CFG = { displayModeBar: true, displaylogo: false, responsive: true };

const SMALL = {
  autosize: true, margin: { l: 10, r: 10, t: 20, b: 10 },
  paper_bgcolor: "#161b22", plot_bgcolor: "#161b22",
  font: { color: "#8b949e", size: 8 },
  showlegend: false,
};

export function UMAPView() {
  const store = useDataStore();
  const { 
    cellMeta, selectedGenes, activeGene, markerSize, opacity, 
    getGeneExpression, loadingGenes, geneExprData, umapColorBy 
  } = store;

  const ctTraces = useMemo(
    () => (cellMeta ? buildCellTypeTraces(cellMeta, markerSize, opacity) : []),
    [cellMeta, markerSize, opacity],
  );
  
  const sampleTraces = useMemo(
    () => (cellMeta ? buildSampleTraces(cellMeta, markerSize, opacity) : []),
    [cellMeta, markerSize, opacity],
  );

  const geneDataMap = useMemo(() => {
    if (!cellMeta) return new Map<string, GeneData>();
    const m = new Map<string, GeneData>();
    for (const g of selectedGenes) { 
      const ed = geneExprData[g];
      if (ed && ed.exp && ed.exp.length > 0) {
        const total = cellMeta.length;
        const maxExp = Math.max(...ed.exp, 1);
        const expFull = new Float32Array(total);
        for (let i = 0; i < ed.idx.length; i++) expFull[ed.idx[i]] = ed.exp[i];

        const logMax = Math.log1p(maxExp);
        const values = new Array(total);
        const sizes = new Array(total);
        const labels = new Array(total);
        for (let i = 0; i < total; i++) {
          const raw = expFull[i];
          const logVal = Math.log1p(raw) / logMax;
          values[i] = Number(logVal.toFixed(4));
          sizes[i] = markerSize + logVal * 8;
          labels[i] = `${cellMeta[i].b}<br>${cellMeta[i].ct}<br>${g}: ${raw.toFixed(2)}`;
        }
        m.set(g, { values, sizes, labels, maxExp });
      }
    }
    return m;
  }, [cellMeta, selectedGenes, markerSize, opacity, geneExprData]);

  const setActive = useCallback((g: string | null) => store.setActiveGene(g), [store]);

  const removeGene = useCallback((gene: string) => {
    store.removeGene(gene);
  }, [store]);

  const clearAll = useCallback(() => {
    store.clearAllGenes();
  }, [store]);

  const toggleGene = useCallback((gene: string) => store.toggleGene(gene), [store]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
      if (loadingGenes.length === 0) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    timerRef.current = setTimeout(() => {
      console.log("[DEBUG] 2s timeout triggered for:", loadingGenes);
      const genesToRefresh = [...loadingGenes];
      genesToRefresh.forEach(gene => {
        console.log("[DEBUG] Refreshing gene:", gene);
        toggleGene(gene);
        setTimeout(() => {
          console.log("[DEBUG] Re-selecting gene:", gene);
          toggleGene(gene);
        }, 100);
      });
    }, 2000);
    
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [loadingGenes, toggleGene]);

  const hasActiveExpr = !!(activeGene && geneDataMap.has(activeGene));
  const isActiveLoading = !!(activeGene && loadingGenes.includes(activeGene));
  
  const mainTitle = isActiveLoading
    ? `<b>${activeGene}</b> — Loading…`
    : hasActiveExpr ? `<b>${activeGene}</b> Expression`
    : umapColorBy === 'ct' ? "<b>Cell Type</b> UMAP" : "<b>Tissue</b> UMAP";

  const currentTraces = umapColorBy === 'ct' ? ctTraces : sampleTraces;
  
  const mainData: Data[] = hasActiveExpr
    ? [...(umapColorBy === 'ct' ? buildCellTypeTraces(cellMeta!, markerSize, opacity, true) : buildSampleTraces(cellMeta!, markerSize, opacity, true)),
       buildGeneTrace(cellMeta!, activeGene!, geneDataMap.get(activeGene!)!.values, geneDataMap.get(activeGene!)!.sizes, geneDataMap.get(activeGene!)!.labels, opacity, true, geneDataMap.get(activeGene!)!.maxExp)]
    : currentTraces;

  if (!cellMeta) {
    return <div className="h-full flex items-center justify-center text-sm text-[#8b949e]">Loading data…</div>;
  }

  return (
    <div className="h-full w-full flex gap-3 p-3 bg-[#0d1117]">
      <div className="flex-1 flex items-center justify-center min-w-0">
        <div className="bg-[#161b22] rounded-xl border border-[#30363d] flex flex-col overflow-hidden shadow-lg h-full max-h-full"
          style={{ width: "min(100%, calc(100vh - 150px) * 1.18)" }}>
          <div className="px-4 py-2 border-b border-[#21262d] text-xs font-semibold text-[#e6edf3] bg-[#161b22] shrink-0 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#58a6ff]" /> Main View
          </div>
          <div className="flex-1 min-h-0">
            {isActiveLoading ? (
              <div className="h-full flex items-center justify-center text-sm text-[#8b949e]">
                <div className="text-center">
                  <div className="w-8 h-8 border-4 border-[#58a6ff] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p>Loading <b className="text-[#58a6ff]">{activeGene}</b>...</p>
                </div>
              </div>
            ) : (
              <Plot data={mainData}
                layout={{ ...LARGE, title: { text: mainTitle, font: { size: 13, color: "#e6edf3" } } }}
                config={MAIN_CFG} style={{ width: "100%", height: "100%" }} useResizeHandler />
            )}
          </div>
        </div>
      </div>

      {selectedGenes.length > 0 && (
        <div className="w-96 shrink-0">
          <div className="bg-[#161b22] rounded-xl border border-[#30363d] flex flex-col h-full shadow-lg">
            <div className="px-4 py-2 border-b border-[#21262d] text-xs font-semibold text-[#e6edf3] bg-[#161b22] shrink-0 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#8b949e]" /> Genes ({selectedGenes.length})
              <button 
                onClick={clearAll}
                className="ml-auto text-[10px] text-[#8b949e] hover:text-[#e6edf3] transition-colors px-2 py-1 rounded bg-[#21262d] hover:bg-[#30363d]"
              >
                Clear All
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-3">
              <div onClick={() => setActive(null)}
                className={`cursor-pointer rounded-lg overflow-hidden transition-all duration-150 ${
                  !activeGene ? "ring-2 ring-[#58a6ff] ring-offset-1 ring-offset-[#161b22]" : "border border-[#21262d] hover:border-[#30363d]"
                }`}>
                <div className="aspect-square">
                  <CanvasThumbnail 
                    meta={cellMeta!} 
                    title={umapColorBy === 'ct' ? "Cell Type" : "Tissue"} 
                    cellTypeColors={umapColorBy === 'ct'} 
                    sampleColors={umapColorBy === 'sample'} 
                  />
                </div>
              </div>
              {selectedGenes.map(gene => {
                const gd = geneDataMap.get(gene);
                const isActive = activeGene === gene;
                const isLoading = loadingGenes.includes(gene);
                
                return (
                  <div key={gene} 
                    className={`relative cursor-pointer rounded-lg overflow-hidden transition-all duration-150 ${
                      isActive ? "ring-2 ring-[#58a6ff] ring-offset-1 ring-offset-[#161b22]" : "border border-[#21262d] hover:border-[#30363d]"
                    }`}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeGene(gene);
                      }}
                      className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-[#f85149] text-white rounded-full text-[10px] opacity-0 hover:opacity-100 transition-opacity z-10"
                    >
                      ×
                    </button>
                    
                    {isLoading || !gd ? (
                      <div className="aspect-square flex items-center justify-center p-2">
                        <div className="text-center">
                          <div className="w-5 h-5 border-2 border-[#58a6ff] border-t-transparent rounded-full animate-spin mx-auto mb-1" />
                          <p className="text-[10px] font-semibold text-[#58a6ff]">{gene}</p>
                          <p className="text-[8px] text-[#484f58] mt-1">Loading...</p>
                        </div>
                      </div>
                    ) : (
                      <div className="aspect-square" onClick={() => setActive(gene)}>
                        <CanvasThumbnail meta={cellMeta!} title={gene} values={gd.values} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
