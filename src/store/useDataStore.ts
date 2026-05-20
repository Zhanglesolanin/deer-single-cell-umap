import { create } from "zustand";

export interface CellMeta {
  b: string; x: number; y: number; ct: string; sample: string; leiden: string;
}

export interface GeneStats {
  [gene: string]: { [cellType: string]: { avg: number; pct: number } };
}

export interface GeneExprData {
  idx: number[];
  exp: number[];
}

export interface SampleInfo {
  total_cells: number; total_genes: number;
  samples: { [key: string]: number }; cell_types: { [key: string]: number };
  cell_type_colors: { [key: string]: string };
}

export type ViewMode = "umap" | "dotplot" | "violin" | "heatmap";

interface ChunkIndex {
  [chunkFile: string]: string[];
}

interface DataState {
  cellMeta: CellMeta[] | null;
  clusterStats: GeneStats | null;
  geneExprData: { [gene: string]: GeneExprData };
  loadedChunks: Set<string>;
  chunkLoadingPromises: Map<string, Promise<void>>;
  chunkIndex: ChunkIndex | null;
  geneList: string[] | null;
  sampleInfo: SampleInfo | null;
  markerGenes: { [key: string]: string[] } | null;
  selectedGenes: string[];
  activeGene: string | null;
  markerSize: number;
  opacity: number;
  viewMode: ViewMode;
  geneQuery: string;
  loading: boolean;
  loadError: string | null;
  loadingGenes: string[];
  umapColorBy: 'ct' | 'sample'; // cell type or sample

  loadData: () => Promise<void>;
  loadChunk: (chunkFile: string) => Promise<void>;
  toggleGene: (gene: string) => void;
  removeGene: (gene: string) => void;
  clearAllGenes: () => void;
  setActiveGene: (gene: string | null) => void;
  setMarkerSize: (size: number) => void;
  setOpacity: (opacity: number) => void;
  setViewMode: (mode: ViewMode) => void;
  setGeneQuery: (query: string) => void;
  getGeneExpression: (gene: string) => { values: number[]; sizes: number[]; labels: string[]; maxExp: number } | null;
  removeGeneFromLoading: (gene: string) => void;
  setUmapColorBy: (colorBy: 'ct' | 'sample') => void;
}

export const useDataStore = create<DataState>((set, get) => ({
  cellMeta: null, clusterStats: null, geneExprData: {}, loadedChunks: new Set(), chunkLoadingPromises: new Map(), chunkIndex: null,
  geneList: null, sampleInfo: null, markerGenes: null,
  selectedGenes: [], activeGene: null, markerSize: 2, opacity: 0.9,
  viewMode: "umap", geneQuery: "", loading: true, loadError: null, loadingGenes: [],
  umapColorBy: 'ct',

  loadData: async () => {
    set({ loading: true, loadError: null });
    try {
      const files = [
        { name: "cell_meta", url: "/data_json/cell_meta.json" },
        { name: "cluster_stats", url: "/data_json/cluster_stats.json" },
        { name: "gene_list", url: "/data_json/gene_list.json" },
        { name: "marker_genes", url: "/data_json/marker_genes.json" },
        { name: "sample_info", url: "/data_json/sample_info.json" },
        { name: "chunk_index", url: "/data_json/gene_chunks/index.json" },
      ];
      
      const results = await Promise.all(
        files.map(async ({ name, url }) => {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`${name}: HTTP ${response.status} - ${response.statusText}`);
          }
          const data = await response.json();
          return { name, data };
        })
      );
      
      const state: any = {};
      results.forEach(({ name, data }) => {
        switch (name) {
          case "cell_meta": state.cellMeta = data; break;
          case "cluster_stats": state.clusterStats = data; break;
          case "gene_list": state.geneList = data; break;
          case "marker_genes": state.markerGenes = data; break;
          case "sample_info": state.sampleInfo = data; break;
          case "chunk_index": state.chunkIndex = data; break;
        }
      });
      
      set({ ...state, loading: false, loadError: null });
    } catch (e: unknown) { 
      console.error("Failed to load data:", e); 
      const errorMessage = e instanceof Error ? e.message : "Unknown error occurred";
      set({ loading: false, loadError: errorMessage }); 
    }
  },

  loadChunk: async (chunkFile: string) => {
    const { loadedChunks, chunkLoadingPromises, chunkIndex } = get();
    
    if (loadedChunks.has(chunkFile)) {
      return;
    }
    
    if (chunkLoadingPromises.has(chunkFile)) {
      return chunkLoadingPromises.get(chunkFile);
    }
    
    const chunkGenes = chunkIndex ? chunkIndex[chunkFile] : [];
    
    const loadPromise = (async () => {
      try {
        const response = await fetch(`/data_json/gene_chunks/${chunkFile}`);
        if (!response.ok) {
          throw new Error(`Failed to load chunk ${chunkFile}`);
        }
        
        const chunkData = await response.json();
          
          set((state) => {
            const newLoadedChunks = new Set(state.loadedChunks);
            newLoadedChunks.add(chunkFile);
            
            const newChunkLoadingPromises = new Map(state.chunkLoadingPromises);
            newChunkLoadingPromises.delete(chunkFile);
            
            const newGeneExprData = { ...state.geneExprData, ...chunkData };
            
            const newLoadingGenes = state.loadingGenes.filter(
              (gene) => !(newGeneExprData[gene] && chunkGenes.includes(gene))
            );
            
            return {
              geneExprData: newGeneExprData,
              loadedChunks: newLoadedChunks,
              chunkLoadingPromises: newChunkLoadingPromises,
              loadingGenes: newLoadingGenes,
            };
          });
      } catch (e) {
        console.error(`Error loading chunk ${chunkFile}:`, e);
        set((state) => {
          const newChunkLoadingPromises = new Map(state.chunkLoadingPromises);
          newChunkLoadingPromises.delete(chunkFile);
          const newLoadingGenes = state.loadingGenes.filter(
            (gene) => !chunkGenes.includes(gene)
          );
          return { chunkLoadingPromises: newChunkLoadingPromises, loadingGenes: newLoadingGenes };
        });
      }
    })();
    
    set((state) => {
      const newChunkLoadingPromises = new Map(state.chunkLoadingPromises);
      newChunkLoadingPromises.set(chunkFile, loadPromise);
      return { chunkLoadingPromises: newChunkLoadingPromises };
    });
    
    return loadPromise;
  },

  toggleGene: (gene: string) => {
    const { selectedGenes, geneExprData, chunkIndex, loadChunk, loadingGenes } = get();
    const MAX_SELECTED = 20;
    
    if (selectedGenes.includes(gene)) {
      const next = selectedGenes.filter(g => g !== gene);
      const newLoading = loadingGenes.filter(g => g !== gene);
      set({ 
        selectedGenes: next, 
        activeGene: get().activeGene === gene ? (next.length > 0 ? next[next.length-1] : null) : get().activeGene,
        loadingGenes: newLoading,
      });
    } else if (selectedGenes.length >= MAX_SELECTED) {
      return;
    } else {
      const isInChunk = chunkIndex && Object.values(chunkIndex).some(genes => genes.includes(gene));
      const dataExists = geneExprData[gene];
      
      if (isInChunk && !dataExists) {
        set((state) => {
          const newLoading = state.loadingGenes.includes(gene) ? state.loadingGenes : [...state.loadingGenes, gene];
          return { selectedGenes: [...selectedGenes, gene], activeGene: gene, loadingGenes: newLoading };
        });
        
        for (const [chunkFile, genes] of Object.entries(chunkIndex!)) {
          if (genes.includes(gene)) {
            loadChunk(chunkFile);
            break;
          }
        }
      } else {
        const newLoading = loadingGenes.filter(g => g !== gene);
        set({ selectedGenes: [...selectedGenes, gene], activeGene: gene, loadingGenes: newLoading });
      }
    }
  },

  removeGene: (gene: string) => {
    const { selectedGenes, activeGene, loadingGenes } = get();
    const newGenes = selectedGenes.filter(g => g !== gene);
    const newLoading = loadingGenes.filter(g => g !== gene);
    
    set({ 
      selectedGenes: newGenes, 
      activeGene: activeGene === gene ? (newGenes.length > 0 ? newGenes[newGenes.length - 1] : null) : activeGene,
      loadingGenes: newLoading,
    });
  },

  clearAllGenes: () => {
    set({ selectedGenes: [], activeGene: null, loadingGenes: [] });
  },

  removeGeneFromLoading: (gene: string) => {
    set((state) => ({
      loadingGenes: state.loadingGenes.filter(g => g !== gene),
    }));
  },

  setActiveGene: (gene) => set({ activeGene: gene }),
  setMarkerSize: (size) => set({ markerSize: size }),
  setOpacity: (opacity) => set({ opacity: opacity }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setGeneQuery: (query) => set({ geneQuery: query }),
  setUmapColorBy: (colorBy) => set({ umapColorBy: colorBy }),

  getGeneExpression: (gene: string) => {
    const s = get();
    const ed = s.geneExprData[gene];
    if (!ed) return null;
    
    const total = s.cellMeta?.length ?? 0;
    if (!ed.exp.length) return null;
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
      sizes[i] = s.markerSize + logVal * 8;
      labels[i] = `${s.cellMeta![i].b}<br>${s.cellMeta![i].ct}<br>${gene}: ${raw.toFixed(2)}`;
    }
    return { values, sizes, labels, maxExp };
  },
}));
