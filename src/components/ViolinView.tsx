"use client";
import { useDataStore } from "@/store/useDataStore";
import { useMemo } from "react";
import Plot from "@/components/PlotWrapper";

export function ViolinView() {
  const { cellMeta, selectedGenes, sampleInfo, getGeneExpression } = useDataStore();
  const traces = useMemo(() => {
    if (!cellMeta || selectedGenes.length === 0) return [];
    const cellTypes = Object.keys(sampleInfo?.cell_types || {});
    const gene = selectedGenes[0]; 
    const exprResult = getGeneExpression(gene);
    if (!exprResult) return [];
    
    const { idx, exp } = {
      idx: [] as number[],
      exp: [] as number[]
    };
    
    const expFull = new Float32Array(cellMeta.length);
    for (let i = 0; i < exprResult.values.length; i++) {
      if (exprResult.values[i] > 0) {
        expFull[i] = Math.expm1(exprResult.values[i] * Math.log1p(exprResult.maxExp));
      }
    }
    
    const ctMap: Record<string, number[]> = {};
    for (const ct of cellTypes) ctMap[ct] = [];
    for (let i = 0; i < expFull.length; i++) {
      if (expFull[i] > 0) {
        const ct = cellMeta[i]?.ct;
        if (ct && ctMap[ct]) ctMap[ct].push(expFull[i]);
      }
    }
    return cellTypes.map(ct => {
      const v = ctMap[ct] || [];
      return v.length === 0
        ? { type: "violin" as const, y: [0], name: ct, visible: false }
        : { type: "violin" as const, y: v, name: ct, box: { visible: true }, meanline: { visible: true }, line: { color: "rgba(88,166,255,0.7)" }, fillcolor: "rgba(88,166,255,0.12)" };
    });
  }, [cellMeta, selectedGenes, sampleInfo, getGeneExpression]);
  if (!selectedGenes.length) return <div className="h-full flex items-center justify-center text-[#8b949e] text-sm bg-[#0d1117]">Select a gene from sidebar</div>;

  return (
    <div className="h-full bg-[#0d1117] p-3">
      <div className="h-full bg-[#161b22] rounded-xl border border-[#30363d] overflow-hidden flex flex-col shadow-lg">
        <div className="px-4 py-2.5 border-b border-[#21262d] text-xs font-semibold text-[#e6edf3] shrink-0">Violin Plot (Only shows the first selected gene)</div>
        <div className="flex-1 min-h-0 p-1">
          <Plot data={traces} layout={{ 
            autosize: true, 
            margin: { l: 50, r: 50, t: 50, b: 100 },
            paper_bgcolor: "#0d1117", 
            plot_bgcolor: "#161b22", 
            font: { color: "#8b949e", size: 11 },
            showlegend: false,
            title: { text: `<b>${selectedGenes[0]}</b>`, font: { size: 14, color: "#e6edf3" }, y: 0.95 },
            xaxis: { tickangle: -45, tickfont: { size: 10 } }, 
            yaxis: { title: { text: "Expression", standoff: 10 } } 
          }}
            config={{ displayModeBar: false, displaylogo: false }} style={{ width: "100%", height: "100%" }} useResizeHandler />
        </div>
      </div>
    </div>
  );
}
