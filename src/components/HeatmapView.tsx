"use client";
import { useDataStore } from "@/store/useDataStore";
import { useMemo } from "react";
import Plot from "@/components/PlotWrapper";

export function HeatmapView() {
  const { clusterStats, selectedGenes } = useDataStore();

  const cellTypeOrder = [
    "THY1+ cells",
    "Progenitor cells",
    "Osteochondroblasts",
    "Mural cells",
    "Endothelial cells",
    "Monocyte/Macrophage",
    "Mast cells",
    "Natural killer/T cells",
  ];

  const geneOrder = selectedGenes.length > 0 ? selectedGenes : [];

  const { plotData } = useMemo(() => {
    if (!clusterStats || geneOrder.length === 0) return { plotData: [] };

    const data: Array<{
      x: number;
      y: number;
      avgExp: number;
      normalizedExp: number;
      fraction: number;
      gene: string;
      cellType: string;
      size: number;
    }> = [];

    geneOrder.forEach((gene, geneIdx) => {
      const geneData = cellTypeOrder.map(cellType => clusterStats[gene]?.[cellType]?.avg ?? 0);
      const minExp = Math.min(...geneData);
      const maxExp = Math.max(...geneData);
      const range = maxExp - minExp || 1;

      cellTypeOrder.forEach((cellType, ctIdx) => {
        const stats = clusterStats[gene]?.[cellType];
        if (!stats) return;

        const avgExp = stats.avg ?? 0;
        const fraction = stats.pct ?? 0;

        const normalizedExp = (avgExp - minExp) / range;
        const size = Math.max(10, fraction * 400);

        data.push({
          x: geneIdx,
          y: ctIdx,
          avgExp: avgExp,
          normalizedExp: normalizedExp,
          fraction: fraction * 100,
          gene: gene,
          cellType: cellType,
          size: size,
        });
      });
    });

    return { plotData: data };
  }, [clusterStats, geneOrder]);

  if (geneOrder.length === 0) {
    return <div className="h-full flex items-center justify-center text-[#8b949e] text-sm bg-[#0d1117]">Select genes from sidebar to view Dot Plot</div>;
  }

  if (!plotData.length) {
    return <div className="h-full flex items-center justify-center text-[#8b949e] text-sm bg-[#0d1117]">Loading data...</div>;
  }

  const colorScale = "Reds" as const;

  return (
    <div className="h-full bg-[#0d1117] p-3">
      <div className="h-full bg-[#161b22] rounded-xl border border-[#30363d] overflow-hidden flex flex-col shadow-lg">
        <div className="px-4 py-2.5 border-b border-[#21262d] text-xs font-semibold text-[#e6edf3] shrink-0">Dot Plot (Shows all selected genes)</div>
        <div className="flex-1 min-h-0 p-1">
          <Plot
            data={[{
              x: plotData.map(d => d.x),
              y: plotData.map(d => d.y),
              mode: "markers",
              type: "scatter",
              marker: {
                color: plotData.map(d => d.normalizedExp),
                colorscale: colorScale,
                size: plotData.map(d => d.size),
                sizemode: "area",
                line: { width: 0 },
                showscale: true,
                cmin: 0,
                cmax: 1,
                colorbar: {
                  title: { text: "Normalized expression", side: "right", font: { size: 10, color: "#8b949e" } },
                  tickfont: { color: "#8b949e", size: 9 },
                  ticks: "outside",
                },
              },
              text: plotData.map(d =>
                `Gene: ${d.gene}<br>Cell Type: ${d.cellType}<br>Mean Exp: ${d.avgExp.toFixed(2)}<br>Fraction: ${d.fraction.toFixed(1)}%`
              ),
              hoverinfo: "text",
              hovertext: plotData.map(d =>
                `Gene: ${d.gene}\nCell Type: ${d.cellType}\nMean Exp: ${d.avgExp.toFixed(2)}\nFraction: ${d.fraction.toFixed(1)}%`
              ),
            }]}
            layout={{
              autosize: true,
              margin: { l: 130, r: 100, t: 10, b: 80 },
              paper_bgcolor: "#0d1117",
              plot_bgcolor: "#161b22",
              font: { color: "#8b949e", size: 11 },
              xaxis: {
                tickmode: "array",
                tickvals: Array.from({ length: geneOrder.length }, (_, i) => i),
                ticktext: geneOrder,
                tickangle: -45,
                tickfont: { size: 10, color: "#8b949e" },
                gridcolor: "#21262d",
                linecolor: "#30363d",
              },
              yaxis: {
                tickmode: "array",
                tickvals: Array.from({ length: cellTypeOrder.length }, (_, i) => i),
                ticktext: cellTypeOrder,
                tickfont: { size: 10, color: "#8b949e" },
                gridcolor: "#21262d",
                linecolor: "#30363d",
                autorange: "reversed",
              },
              shapes: [
                ...geneOrder.map((_, i) => ({
                  type: "line" as const,
                  x0: i - 0.5, y0: -0.5, x1: i - 0.5, y1: cellTypeOrder.length - 0.5,
                  line: { color: "#21262d", width: 1 },
                })),
                ...cellTypeOrder.map((_, i) => ({
                  type: "line" as const,
                  x0: -0.5, y0: i - 0.5, x1: geneOrder.length - 0.5, y1: i - 0.5,
                  line: { color: "#21262d", width: 1 },
                })),
              ],
            }}
            config={{ displayModeBar: false, displaylogo: false }}
            style={{ width: "100%", height: "100%" }}
            useResizeHandler
          />
        </div>
      </div>
    </div>
  );
}
