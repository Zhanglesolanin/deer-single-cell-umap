# 鹿单细胞UMAP可视化工具 - 项目实施总结文档

## 目录

1. [项目概述](#项目概述)
2. [完整数据处理流程](#完整数据处理流程)
3. [技术架构](#技术架构)
4. [前端实现](#前端实现)
5. [遇到的问题与解决方案](#遇到的问题与解决方案)
6. [部署指南](#部署指南)
7. [项目文件结构](#项目文件结构)
8. [使用说明](#使用说明)

---

## 1. 项目概述

### 1.1 项目背景

本项目是一个基于 Next.js 的单细胞RNA测序数据可视化工具，主要用于展示鹿鹿角干细胞的单细胞转录组数据。

### 1.2 核心功能

| 功能 | 描述 | 状态 |
|------|------|------|
| UMAP聚类可视化 | 展示细胞的UMAP降维结果，支持按细胞类型或组织着色 | ✅ 完成 |
| 基因选择与表达展示 | 支持选择基因查看其在UMAP上的表达分布 | ✅ 完成 |
| Marker基因列表 | 22个标记基因快速选择 | ✅ 完成 |
| 全基因搜索 | 支持搜索所有25,048个表达基因 | ✅ 完成 |
| ACT (Annotation of cell types) | 细胞类型注释点图 | ✅ 完成 |
| Dot Plot | 基因表达点图 | ✅ 完成 |
| Violin Plot | 小提琴图（仅展示第一个选中基因） | ✅ 完成 |
| 数据来源标注 | 引用文献信息 | ✅ 完成 |

### 1.3 数据规模

- **细胞数**: 37,854 个细胞
- **基因数**: 25,048 个表达基因
- **细胞类型**: 8 种
- **组织样本**: 5 种 (AAP, DAP, FP, PP, RM)

---

## 2. 完整数据处理流程

### 2.1 流程概览

```
原始10x Genomics数据 (MTX格式)
    ↓
[Step 1] 数据预处理与聚类 (1_process_and_cluster.py)
    - 加载5个样本
    - QC过滤
    - Combat批次校正
    - PCA降维
    - UMAP降维
    - Leiden聚类
    ↓
[Step 2] 细胞类型注释 (2_annotate_cells.py)
    - Marker基因定义
    - 基于表达自动注释
    - 手动微调
    ↓
[Step 3] 数据导出 (3_export_for_web.py)
    - 细胞元数据
    - Marker基因表达
    - 聚类统计数据
    ↓
[Step 4] 全基因数据导出 (export_all_genes_fixed.py)
    - 导出25,048个基因的表达数据
    - 稀疏格式存储
    ↓
[Step 5] 基因列表导出 (export_gene_list.py)
    - 提取有表达的基因列表
    ↓
[Step 6] 数据分块优化 (optimize_gene_data.py)
    - 将大文件分割成176个chunk
    - 每个chunk约100-150个基因
    - 生成chunk索引
    ↓
网页端可视化
```

### 2.2 Step 1: 数据预处理与聚类

**脚本**: `scripts_python/1_process_and_cluster.py`

#### 2.2.1 样本加载

```python
def load_samples():
    """加载5个样本的10x Genomics数据"""
    samples = ['AAP', 'DAP', 'FP', 'PP', 'RM']
    adatas = []
    
    for sample in samples:
        adata = sc.read_10x_mtx(
            BASE_DIR / "data_raw" / sample,
            var_names='gene_symbols',
            cache=True
        )
        adata.obs['sample'] = sample
        adatas.append(adata)
    
    adata = sc.concat(adatas, join='outer', index_unique='-')
    return adata
```

#### 2.2.2 QC过滤

```python
def quality_control_per_sample(adata):
    """每个样本独立进行QC过滤"""
    
    # 线粒体基因比例
    adata.var['mt'] = adata.var_names.str.startswith('mt-')
    
    # 计算QC指标
    sc.pp.calculate_qc_metrics(
        adata, 
        qc_vars=['mt'], 
        percent_top=None, 
        log1p=False, 
        inplace=True
    )
    
    # 过滤标准
    min_genes = 200
    min_cells = 3
    max_mt_pct = 20
    
    # 过滤低质量细胞
    sc.pp.filter_cells(adata, min_genes=min_genes)
    # 过滤低表达基因
    sc.pp.filter_genes(adata, min_cells=min_cells)
    # 过滤高线粒体比例细胞
    adata = adata[adata.obs['pct_counts_mt'] < max_mt_pct, :]
    
    return adata
```

#### 2.2.3 预处理与批次校正

```python
def preprocess_and_integrate(adata):
    """标准化、对数转换、ComBat批次校正"""
    
    # 保存原始数据
    adata.raw = adata
    
    # 标准化
    sc.pp.normalize_total(adata, target_sum=1e4)
    sc.pp.log1p(adata)
    
    # 高变基因筛选
    sc.pp.highly_variable_genes(
        adata,
        min_mean=0.0125,
        max_mean=3,
        min_disp=0.5
    )
    
    # 只保留高变基因
    adata = adata[:, adata.var['highly_variable']]
    
    # Combat批次校正
    sc.pp.combat(adata, key='sample')
    
    return adata
```

#### 2.2.4 降维与聚类

```python
def dimensionality_reduction(adata):
    """PCA, UMAP, Leiden聚类"""
    
    # PCA
    sc.pp.pca(adata, n_comps=50)
    
    # 邻居图
    sc.pp.neighbors(adata, n_neighbors=10, n_pcs=50)
    
    # UMAP降维
    sc.tl.umap(adata)
    
    # Leiden聚类
    sc.tl.leiden(adata, resolution=1.0, key_added='leiden_clusters')
    
    return adata
```

### 2.3 Step 2: 细胞类型注释

**脚本**: `scripts_python/2_annotate_cells.py`

#### 2.3.1 Marker基因定义

```python
MARKER_GENES = {
    'THY1+ cells': ['THY1', 'ITM2B', 'ITGBL1', 'CST3', 'PI16'],
    'Progenitor cells': ['PTN', 'THBS4', 'SOX9', 'TNN', 'TNC', 
                         'SFRP4', 'RUNX2', 'DLX5'],
    'Osteochondroblasts': ['ALPL', 'PTH1R', 'ACAN', 'SPP1', 'COL11A1'],
    'Mural cells': ['ACTA2', 'MYH11', 'MYLK', 'MYL9', 'COL4A1', 'ITGBL1'],
    'Endothelial cells': ['PECAM1', 'VWF', 'ENG', 'CD93'],
    'Monocyte/Macrophage': ['CD74', 'CSF1R', 'C1QA', 'MRC1', 
                            'CD163', 'MPEG1', 'CD14', 'CCL3'],
    'Mast cells': ['TPSB2', 'SRGN', 'FCER1A', 'KIT'],
    'Natural killer/T cells': ['CTSW', 'CD3E', 'CD3D']
}

CELL_TYPE_COLORS = {
    'THY1+ cells': '#E41A1C',
    'Progenitor cells': '#377EB8',
    'Osteochondroblasts': '#4DAF4A',
    'Mural cells': '#984EA3',
    'Endothelial cells': '#FF7F00',
    'Monocyte/Macrophage': '#FFFF33',
    'Mast cells': '#A65628',
    'Natural killer/T cells': '#F781BF'
}
```

#### 2.3.2 自动注释算法

```python
def auto_annotate_clusters(adata):
    """基于Marker基因的自动注释"""
    
    cell_type_scores = {}
    
    for cluster in adata.obs['leiden_clusters'].unique():
        cluster_mask = (adata.obs['leiden_clusters'] == cluster)
        cluster_adata = adata[cluster_mask]
        
        scores = {}
        for ct, genes in MARKER_GENES.items():
            available_genes = [g for g in genes if g in adata.raw.var_names]
            
            if available_genes:
                # 计算该细胞类型的平均表达
                gene_exprs = []
                for gene in available_genes:
                    gene_idx = adata.raw.var_names.get_loc(gene)
                    expr = adata.raw.X[cluster_mask, gene_idx].toarray().flatten()
                    gene_exprs.append(expr.mean())
                
                scores[ct] = np.mean(gene_exprs)
        
        # 选择得分最高的细胞类型
        if scores:
            best_ct = max(scores.keys(), key=lambda k: scores[k])
            cell_type_scores[cluster] = best_ct
    
    return cell_type_scores
```

### 2.4 Step 3: 数据导出 (Web端JSON)

**脚本**: `scripts_python/3_export_for_web.py`

#### 2.4.1 细胞元数据导出

```python
def export_cell_meta(adata):
    """导出细胞元数据（UMAP坐标、细胞类型、样本信息）"""
    
    records = []
    for i in range(adata.n_obs):
        records.append({
            'b': adata.obs_names[i],           # barcode
            'x': float(adata.obsm['X_umap'][i, 0]),   # UMAP X坐标
            'y': float(adata.obsm['X_umap'][i, 1]),   # UMAP Y坐标
            'ct': adata.obs['CellType'].iloc[i],      # 细胞类型
            'sample': str(adata.obs['sample'].iloc[i]),  # 样本
            'leiden': str(adata.obs['leiden_clusters'].iloc[i])  # 聚类编号
        })
    
    with open(OUTPUT_DIR / 'cell_meta.json', 'w') as f:
        json.dump(records, f)
    
    return records
```

#### 2.4.2 聚类统计数据导出

```python
def export_cluster_stats(adata):
    """导出每个基因在各细胞类型中的平均表达和表达比例"""
    
    stats = {}
    for gene in available_genes:
        gene_idx = adata.raw.var_names.get_loc(gene)
        gene_expr = adata.raw.X[:, gene_idx].toarray().flatten()
        
        stats[gene] = {}
        for ct in adata.obs['CellType'].unique():
            ct_mask = (adata.obs['CellType'] == ct).values
            ct_expr = gene_expr[ct_mask]
            
            stats[gene][ct] = {
                'avg': float(np.mean(ct_expr)),      # 平均表达量
                'pct': float(np.sum(ct_expr > 0) / len(ct_expr))  # 表达比例
            }
    
    with open(OUTPUT_DIR / 'cluster_stats.json', 'w') as f:
        json.dump(stats, f)
    
    return stats
```

### 2.5 Step 4: 全基因数据导出

**脚本**: `scripts_python/export_all_genes_fixed.py`

#### 2.5.1 稀疏格式存储

```python
def export_all_gene_expr_fixed(adata):
    """导出所有25,048个基因的表达数据（稀疏格式）"""
    
    sparse_data = {}
    
    for gene_idx in range(adata.raw.n_vars):
        gene_name = str(adata.raw.var_names[gene_idx])
        
        # 提取基因表达向量
        gene_expr = adata.raw.X[:, gene_idx].toarray().flatten()
        
        # 只存储非零值
        nonzero = np.where(gene_expr > 0)[0]
        
        if len(nonzero) > 0:
            sparse_data[gene_name] = {
                'idx': nonzero.tolist(),    # 非零值的细胞索引
                'exp': gene_expr[nonzero].tolist()  # 对应的表达值
            }
    
    # 保存为单个大文件 (约700MB)
    with open(OUTPUT_DIR / 'gene_expr_sparse.json', 'w') as f:
        json.dump(sparse_data, f)
    
    return sparse_data
```

### 2.6 Step 5: 基因列表导出

**脚本**: `scripts_python/export_gene_list.py`

```python
def export_gene_list():
    """导出有表达数据的基因列表"""
    
    with open(SPARSE_FILE, 'r') as f:
        sparse_data = json.load(f)
    
    genes_with_expression = sorted(sparse_data.keys())
    
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(genes_with_expression, f)
    
    return genes_with_expression  # 共25,048个基因
```

### 2.7 Step 6: 数据分块优化 (关键策略！)

**脚本**: `scripts_python/optimize_gene_data.py`

#### 2.7.1 分块原因

- **原始问题**: 单个 `gene_expr_sparse.json` 文件约 **700MB**
  - 一次性加载太慢
  - 内存占用大
  - 页面加载时间过长

- **解决方案**: 分成多个小chunk，按需加载

#### 2.7.2 分块策略

```python
def optimize_data():
    """将大数据分割成多个小chunk"""
    
    # 加载原始稀疏数据
    with open(INPUT_FILE, 'r') as f:
        data = json.load(f)
    
    genes = sorted(data.keys())
    total_genes = len(genes)  # 25,048
    
    # 分块参数
    CHUNK_SIZE = 150  # 每chunk约150个基因
    num_chunks = (total_genes + CHUNK_SIZE - 1) // CHUNK_SIZE  # 176个chunk
    
    # 分割并保存
    chunks = {}
    for i in range(num_chunks):
        start = i * CHUNK_SIZE
        end = min(start + CHUNK_SIZE, total_genes)
        chunk_genes = genes[start:end]
        
        chunk_data = {}
        for gene in chunk_genes:
            chunk_data[gene] = data[gene]
        
        # 保存chunk文件
        chunk_file = OUTPUT_DIR / f"chunk_{i:03d}.json"
        with open(chunk_file, 'w') as f:
            json.dump(chunk_data, f)
        
        # 记录基因→chunk的映射
        chunks[f"chunk_{i:03d}.json"] = chunk_genes
    
    # 保存索引文件
    index_file = OUTPUT_DIR / "index.json"
    with open(index_file, 'w') as f:
        json.dump(chunks, f)
    
    return chunks
```

#### 2.7.3 分块结果

| 指标 | 数值 |
|------|------|
| 总基因数 | 25,048 |
| Chunk数量 | 176 |
| 每个Chunk基因数 | ~142 |
| 每个Chunk文件大小 | ~2-3 MB |
| 总数据大小 | ~450 MB |

#### 2.7.4 索引文件结构

**gene_chunks/index.json**:
```json
{
  "chunk_000.json": ["A1BG", "A1CF", "A2M", ...],
  "chunk_001.json": ["A4GALT", "A4GNT", "AAAS", ...],
  ...
  "chunk_175.json": ["ZZEF1", "ZZZ3"]
}
```

### 2.8 最终数据结构

```
public/data_json/
├── cell_meta.json          # 37,854个细胞的元数据 (UMAP坐标、细胞类型、样本)
├── cluster_stats.json      # Marker基因在各细胞类型中的统计
├── gene_list.json          # 25,048个基因列表
├── marker_genes.json       # 22个Marker基因定义
├── sample_info.json        # 样本信息和细胞类型统计
└── gene_chunks/            # 基因表达分块数据
    ├── index.json          # 基因→chunk映射索引
    ├── chunk_000.json      # 第1个chunk (约150个基因)
    ├── chunk_001.json      # 第2个chunk
    ├── ...
    └── chunk_175.json      # 最后1个chunk
```

---

## 3. 技术架构

### 3.1 技术栈

| 层次 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 框架 | Next.js | 16.x | React服务端渲染框架 |
| 语言 | TypeScript | 5.x | 类型安全的JavaScript |
| 状态管理 | Zustand | 4.x | 轻量级状态管理 |
| 可视化 | Plotly.js | 2.x | 交互式图表库 |
| 样式 | Tailwind CSS | 3.x | 原子化CSS框架 |
| 部署 | Vercel | - | Next.js官方托管平台 |
| 生信分析 | Scanpy | 1.9.x | 单细胞数据分析 |
| 数据处理 | Python | 3.9+ | 后端数据处理 |

### 3.2 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                   生信数据处理层 (Python)                     │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐                  │
│  │1_process_and_    │  │2_annotate_cells  │                  │
│  │cluster.py        │  │.py               │                  │
│  └────────┬─────────┘  └────────┬─────────┘                  │
│           │                     │                            │
│           └──────────┬──────────┘                            │
│                      ▼                                       │
│           ┌──────────────────┐                              │
│           │adata_final_final │                              │
│           │.h5ad             │                              │
│           └────────┬─────────┘                              │
│                    ▼                                       │
│  ┌────────────────────────────────────────────────────┐    │
│  │3_export_for_web.py → export_all_genes_fixed.py    │    │
│  │→ export_gene_list.py → optimize_gene_data.py      │    │
│  └────────────────────────────────────────────────────┘    │
└────────────────────────┬────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      静态数据文件                            │
│  public/data_json/                                          │
│    ├── cell_meta.json        # 细胞元数据                    │
│    ├── cluster_stats.json    # 聚类统计数据                  │
│    ├── gene_list.json        # 基因列表                      │
│    ├── marker_genes.json     # 标记基因列表                  │
│    ├── sample_info.json      # 样本信息                      │
│    └── gene_chunks/          # 基因表达分块数据(176个chunk)  │
│        ├── index.json        # chunk索引                    │
│        ├── chunk_000.json                                 │
│        └── ... (共176个)                                   │
└────────────────────────┬────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      前端应用 (Next.js)                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────┐   │
│  │  UMAPView   │  │ DotPlotView │  │   ViolinView      │   │
│  │  (主视图)   │  │  (点图)     │  │   (小提琴图)      │   │
│  └──────┬──────┘  └──────┬──────┘  └─────────┬─────────┘   │
│         │                │                    │             │
│         └────────────────┼────────────────────┘             │
│                          ▼                                 │
│              ┌─────────────────────┐                       │
│              │    Zustand Store    │                       │
│              │   (状态管理)         │                       │
│              └──────────┬──────────┘                       │
│                         ▼                                  │
│              ┌─────────────────────┐                       │
│              │   数据加载模块       │                       │
│              │  (分块加载机制)       │                       │
│              └─────────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. 前端实现

### 4.1 状态管理 (Zustand)

**核心状态:**
- `cellMeta`: 细胞元数据
- `geneExprData`: 已加载的基因表达数据
- `selectedGenes`: 用户选中的基因列表
- `activeGene`: 当前激活的基因（主视图显示）
- `loadingGenes`: 正在加载的基因列表
- `loadedChunks`: 已加载的数据块
- `chunkIndex`: Chunk索引（基因→chunk映射）
- `umapColorBy`: UMAP着色方式（cell_type / tissue）

**关键函数:**
- `loadData()`: 初始化加载元数据和chunk索引
- `loadChunk(chunkFile)`: 按需加载基因表达数据块
- `toggleGene(gene)`: 切换基因选择状态
- `setActiveGene(gene)`: 设置激活基因

#### 4.1.1 Chunk加载机制

```typescript
loadChunk: async (chunkFile: string) => {
  const { loadedChunks, chunkLoadingPromises, chunkIndex } = get();
  
  // 如果已经加载过，直接返回
  if (loadedChunks.has(chunkFile)) return;
  
  // 如果正在加载，返回已有promise
  if (chunkLoadingPromises.has(chunkFile)) {
    return chunkLoadingPromises.get(chunkFile);
  }
  
  const chunkGenes = chunkIndex ? chunkIndex[chunkFile] : [];
  
  const loadPromise = (async () => {
    try {
      const response = await fetch(`/data_json/gene_chunks/${chunkFile}`);
      const chunkData = await response.json();
      
      set((state) => ({
        geneExprData: {
          ...state.geneExprData,
          ...chunkData
        },
        loadedChunks: new Set([...state.loadedChunks, chunkFile]),
        loadingGenes: state.loadingGenes.filter(
          (gene) => !(chunkData[gene] && chunkGenes?.includes(gene))
        )
      }));
    } catch (error) {
      console.error(`Failed to load chunk ${chunkFile}:`, error);
    } finally {
      set((state) => {
        const newPromises = new Map(state.chunkLoadingPromises);
        newPromises.delete(chunkFile);
        return { chunkLoadingPromises: newPromises };
      });
    }
  })();
  
  set((state) => {
    const newPromises = new Map(state.chunkLoadingPromises);
    newPromises.set(chunkFile, loadPromise);
    return { chunkLoadingPromises: newPromises };
  });
  
  return loadPromise;
}
```

#### 4.1.2 基因选择流程

```typescript
toggleGene: (gene: string) => {
  set((state) => {
    const isSelected = state.selectedGenes.includes(gene);
    
    if (isSelected) {
      // 取消选择
      const newSelected = state.selectedGenes.filter((g) => g !== gene);
      const newActive = newSelected.length > 0 ? newSelected[newSelected.length - 1] : null;
      return {
        selectedGenes: newSelected,
        activeGene: newActive
      };
    } else {
      // 选择基因
      const newSelected = [...state.selectedGenes, gene].slice(-20); // 最多20个
      
      // 检查是否需要加载chunk
      if (!state.geneExprData[gene] && state.chunkIndex) {
        const chunkFile = Object.keys(state.chunkIndex).find((chunk) =>
          state.chunkIndex![chunk].includes(gene)
        );
        
        if (chunkFile) {
          // 添加到loading列表
          const newLoading = [...state.loadingGenes, gene];
          
          // 异步加载chunk
          state.loadChunk(chunkFile);
          
          return {
            selectedGenes: newSelected,
            activeGene: gene,
            loadingGenes: newLoading
          };
        }
      }
      
      return {
        selectedGenes: newSelected,
        activeGene: gene
      };
    }
  });
}
```

### 4.2 组件结构

```
src/
├── components/
│   ├── UMAPView.tsx      # UMAP主视图
│   ├── DotPlotView.tsx   # ACT点图
│   ├── HeatmapView.tsx   # 基因表达点图（原Heatmap改为DotPlot）
│   ├── ViolinView.tsx    # 小提琴图
│   ├── Sidebar.tsx       # 侧边栏（基因选择）
│   └── PlotWrapper.tsx   # Plotly图表封装
├── store/
│   └── useDataStore.ts   # Zustand状态管理
├── app/
│   ├── page.tsx          # 主页
│   ├── layout.tsx        # 布局
│   └── globals.css       # 全局样式
└── types/
    └── index.ts          # TypeScript类型定义
```

### 4.3 数据加载机制

```
用户点击基因
    ↓
检查基因是否在已加载数据中？
    ↓
   ┌─────┴─────┐
   ↓           ↓
 是            否
   ↓           ↓
显示图表    查找基因所在chunk (通过chunkIndex)
               ↓
          检查chunk是否在加载中？
               ↓
              ┌┴┐
              ↓ ↓
             是 否
             ↓   ↓
        等待    开始加载chunk
             ↓   ↓
              └─┬─┘
                ↓
           加载chunk完成
                ↓
           更新geneExprData
                ↓
           从loadingGenes移除
                ↓
           触发UI重渲染
```

---

## 5. 遇到的问题与解决方案

### 5.1 问题列表

| 序号 | 问题描述 | 严重程度 | 解决方案 | 效果 |
|------|----------|----------|----------|------|
| 1 | 页面加载后一直显示"Loading single-cell data..." | 🔴 严重 | 修复 hydration mismatch | ✅ 有效 |
| 2 | 选择基因后显示"No data"，点击其他基因后才显示 | 🔴 严重 | 添加2秒超时自动刷新机制 | ✅ 有效 |
| 3 | 基因数据加载状态管理混乱 | 🔴 严重 | 修复 `loadingGenes` 过滤逻辑 | ✅ 有效 |
| 4 | DotPlot点大小无差异 | 🟡 中等 | 调整点大小计算方式（与fraction成正比） | ✅ 有效 |
| 5 | UMAP按组织着色显示为灰色数字 | 🟡 中等 | 添加样本名称映射（0→FP, 1→RM等） | ✅ 有效 |
| 6 | Vercel部署TypeScript类型错误 | 🟡 中等 | 修复多处类型定义 | ✅ 有效 |
| 7 | 热图无用 | 🟢 轻微 | 将Heatmap改为Gene DotPlot | ✅ 有效 |

### 5.2 详细问题分析

#### 问题1: Hydration Mismatch

**现象:**
```
Error: Hydration failed because the initial UI does not match what was rendered on the server.
```

**原因:**
- 服务端渲染时 `isClient` 为 `false`，显示 LoadingScreen
- 客户端水合时 `isClient` 立即变为 `true`，导致HTML不匹配

**解决方案:**
```typescript
const [isClient, setIsClient] = useState(false);

useEffect(() => {
  setIsClient(true);
  loadData();
}, [loadData]);

if (!isClient) return <LoadingScreen />;
```

---

#### 问题2: 基因选择后显示"No data"

**现象:**
- 点击基因后显示"Expression data not available"
- 点击其他基因后，上一个基因突然显示

**原因:**
- 基因数据加载完成后没有触发UI更新
- `geneExprData` 更新了，但组件没有重新渲染

**解决方案:**
```typescript
useEffect(() => {
  if (loadingGenes.length === 0) return;
  
  const timeoutId = setTimeout(() => {
    for (const gene of loadingGenes) {
      toggleGene(gene);
      setTimeout(() => toggleGene(gene), 100);
    }
  }, 2000);
  
  return () => clearTimeout(timeoutId);
}, [loadingGenes, toggleGene]);
```

**原理:**
2秒后自动重新选择基因，强制触发UI刷新

---

#### 问题3: loadingGenes状态管理错误

**现象:**
- 基因数据加载完成后仍显示loading状态
- `loadingGenes` 列表无法正确清空

**原代码（错误）:**
```typescript
const newLoadingGenes = state.loadingGenes.filter(
  (gene) => !newGeneExprData[gene] || !chunkGenes.includes(gene)
);
```

**问题分析:**
逻辑错误，应该是 `&&` 而不是 `||`

**修复后:**
```typescript
const newLoadingGenes = state.loadingGenes.filter(
  (gene) => !(newGeneExprData[gene] && chunkGenes.includes(gene))
);
```

---

#### 问题4: DotPlot点大小无差异

**现象:**
- 所有点看起来大小差不多
- 90%和10%的fraction视觉上区别不明显

**原代码:**
```typescript
size: Math.sqrt(fraction * 100) * 2
```

**修复后:**
```typescript
const size = Math.pow(fraction * 100, 2); // 平方关系
// 10% → 100, 90% → 8100
```

---

#### 问题5: UMAP按组织着色显示灰色数字

**现象:**
- 着色后所有点都是灰色
- 图例显示 0、1、2、3、4 而不是组织名称

**原因:**
- `cellMeta` 中的 `sample` 字段是数字字符串
- 需要映射到实际组织名称

**解决方案:**
```typescript
const SAMPLE_NAME_MAP: Record<string, string> = {
  "0": "FP",
  "1": "RM",
  "2": "DAP",
  "3": "PP",
  "4": "AAP"
};
```

---

#### 问题6: Vercel部署TypeScript错误

**现象:**
```
Failed to type check.
./src/components/DotPlotView.tsx:29:11
Type error: Variable 'data' implicitly has type 'any[]'
```

**解决方案:**
- 为变量添加明确类型
- 使用 `as const` 断言字面量类型
- 对配置对象使用 `any` 类型绕过严格检查

---

### 5.3 数据分块相关问题（重要！）

#### 问题A: 单个JSON文件太大

**现象:**
- `gene_expr_sparse.json` 约 700MB
- 一次性加载需要很长时间
- 浏览器内存占用高

**解决方案:**
- 分成176个chunk
- 每个chunk约2-3MB
- 按需加载，不需要一次性加载所有数据

**效果:**
- 首屏加载时间大幅降低
- 内存占用显著减少

#### 问题B: 如何知道基因在哪个chunk？

**解决方案:**
- 生成 `index.json` 索引文件
- 前端加载时先获取索引
- 通过索引快速查找基因所在的chunk

---

## 6. 部署指南

### 6.1 本地开发

**环境要求:**
- Node.js >= 20.x
- npm >= 10.x

**步骤:**

```bash
# 进入项目目录
cd scRNA-Web-Project/web_app

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 访问
open http://localhost:3000
```

### 6.2 构建测试

```bash
# 构建生产版本
npm run build

# 启动生产服务器
npm run start
```

### 6.3 GitHub + Vercel 部署

**前置条件:**
1. GitHub账号
2. Vercel账号

**步骤:**

```bash
# 1. 初始化Git仓库
cd web_app
git init

# 2. 添加文件
git add .
git commit -m "Initial commit"

# 3. 创建GitHub仓库（浏览器操作）
# 访问 https://github.com/new 创建空仓库

# 4. 连接远程仓库
git remote add origin git@github.com:<username>/<repo-name>.git
git branch -M main
git push -u origin main

# 5. Vercel部署（浏览器操作）
# 访问 https://vercel.com
# 点击 "New Project" → 选择GitHub仓库 → 点击 "Deploy"
```

**注意事项:**

| 文件/目录 | 是否上传 | 说明 |
|-----------|----------|------|
| `node_modules/` | ❌ | 依赖会自动安装 |
| `.next/` | ❌ | 构建产物 |
| `.git/` | ✅ | Git仓库 |
| `public/data_json/` | ✅ | **必须上传！** |
| `src/` | ✅ | 源代码 |
| 配置文件 | ✅ | package.json, tsconfig.json等 |

### 6.4 `.gitignore` 配置

```gitignore
# dependencies
/node_modules
/.pnp
.pnp.js

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.env*.local
.vercel
*.tsbuildinfo
next-env.d.ts
```

---

## 7. 项目文件结构

```
scRNA-Web-Project/
├── scripts_python/               # 生信分析脚本
│   ├── 1_process_and_cluster.py  # Step 1: 数据预处理与聚类
│   ├── 2_annotate_cells.py       # Step 2: 细胞类型注释
│   ├── 3_export_for_web.py       # Step 3: 数据导出
│   ├── export_all_genes_fixed.py # Step 4: 全基因数据导出
│   ├── export_gene_list.py       # Step 5: 基因列表导出
│   ├── optimize_gene_data.py     # Step 6: 数据分块优化
│   ├── adata_final_final.h5ad    # 最终AnnData文件
│   ├── cache/                    # 缓存文件
│   └── figures/                  # 分析图表
└── web_app/                      # 前端应用
    ├── .gitignore                # Git忽略配置
    ├── .git                      # Git仓库目录
    ├── package.json              # 项目依赖配置
    ├── package-lock.json         # 依赖版本锁定
    ├── next.config.js            # Next.js配置
    ├── tsconfig.json             # TypeScript配置
    ├── tailwind.config.js        # Tailwind配置
    ├── postcss.config.mjs        # PostCSS配置
    ├── PROJECT_DOCUMENTATION.md  # 本文档
    ├── public/                   # 静态资源
    │   └── data_json/            # 数据文件
    │       ├── cell_meta.json    # 细胞元数据
    │       ├── cluster_stats.json# 聚类统计
    │       ├── gene_list.json    # 基因列表
    │       ├── marker_genes.json # 标记基因
    │       ├── sample_info.json  # 样本信息
    │       └── gene_chunks/      # 基因表达分块
    │           ├── index.json    # chunk索引
    │           ├── chunk_000.json
    │           └── ... (共176个)
    └── src/                      # 源代码
        ├── app/                  # Next.js App Router
        │   ├── page.tsx          # 主页
        │   ├── layout.tsx        # 布局组件
        │   └── globals.css       # 全局样式
        ├── components/           # React组件
        │   ├── UMAPView.tsx      # UMAP主视图
        │   ├── DotPlotView.tsx   # ACT点图
        │   ├── HeatmapView.tsx   # 基因表达点图
        │   ├── ViolinView.tsx    # 小提琴图
        │   ├── Sidebar.tsx       # 侧边栏
        │   └── PlotWrapper.tsx   # Plotly封装
        ├── store/                # 状态管理
        │   └── useDataStore.ts   # Zustand store
        ├── lib/                  # 工具函数
        │   └── utils.ts          # 通用工具
        └── types/                # 类型定义
            └── index.ts          # TypeScript类型
```

---

## 8. 使用说明

### 8.1 基本操作

**1. 查看UMAP聚类**
- 默认显示按细胞类型着色的UMAP图
- 可切换为按组织（Tissue）着色

**2. 选择基因**
- 点击侧边栏的Marker基因按钮
- 或在搜索框输入基因名称搜索
- 最多选择20个基因

**3. 查看基因表达**
- 选中基因后，UMAP主视图会显示该基因的表达分布
- 右侧缩略图显示所有选中基因
- 点击缩略图可切换主视图显示

**4. 清除选择**
- 点击基因名称旁的关闭按钮
- 或使用"Clear All"按钮

### 8.2 视图切换

| 标签 | 功能 |
|------|------|
| UMAP Clustering | 主视图，显示细胞聚类和基因表达 |
| ACT | 细胞类型注释点图（Annotation of cell types） |
| Violin Plot | 小提琴图（仅展示第一个选中基因） |
| Dot Plot | 基因表达点图（展示所有选中基因） |

### 8.3 数据来源

> Ba, Hengxing, et al. "Single-cell transcriptome reveals core cell populations and androgen-RXFP2 axis involved in deer antler full regeneration." Cell Regeneration 11.1 (2022): 43.

---

## 附录: 无效解决方案记录

| 问题 | 尝试的无效方案 | 原因 |
|------|---------------|------|
| 基因显示No data | 增加loading状态显示时间 | 无法解决根本的状态更新问题 |
| 数据加载缓慢 | 一次性加载所有chunk | 内存溢出，页面崩溃 |
| TypeScript错误 | 禁用严格模式 | 不符合最佳实践 |
| DotPlot颜色过浅 | 使用固定颜色范围 | 没有考虑数据分布 |
| 大数据问题 | 不做分块，直接加载700MB文件 | 加载太慢，用户体验差 |

---

## 关键技术总结

### 生信分析层
- **Scanpy**: 单细胞数据分析标准库
- **ComBat**: 批次校正算法
- **Leiden**: 图聚类算法
- **UMAP**: 非线性降维可视化

### 数据处理层
- **稀疏格式**: 只存储非零值，大幅减小文件大小
- **分块策略**: 176个chunk，按需加载
- **索引机制**: 快速定位基因所在chunk

### 前端层
- **Next.js 16**: 现代React框架
- **Zustand**: 轻量级状态管理
- **Plotly.js**: 交互式图表
- **TypeScript**: 类型安全

---

**文档版本**: v2.0  
**更新日期**: 2026-05-20  
**作者**: Zhang Le  
**项目地址**: https://github.com/Zhanglesolanin/deer-single-cell-umap
