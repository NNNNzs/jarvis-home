# 嵌入服务使用示例

## SiliconFlow 嵌入 API 集成

SiliconFlow 提供 OpenAI 兼容的嵌入 API，可以直接使用 LangChain 的 `OpenAIEmbeddings` 类调用。

### 1. 环境变量配置

在 `.env` 文件中添加：

```bash
# SiliconFlow 配置
SILICONFLOW_API_KEY=your-api-key-here
EMBEDDING_MODEL=BAAI/bge-large-zh-v1.5
EMBEDDING_DIMENSIONS=1024  # 可选，某些模型支持自定义维度
```

### 2. 基本使用

```typescript
import { EmbeddingService } from "./services/embeddings.js";

// 初始化嵌入服务
const embeddingService = new EmbeddingService({
  provider: "siliconflow",
  model: "BAAI/bge-large-zh-v1.5",
  apiKey: process.env.SILICONFLOW_API_KEY!,
  baseURL: "https://api.siliconflow.cn/v1", // 可选，默认已设置
  dimensions: 1024 // 可选，如果模型支持
});

// 生成单个文本的嵌入
const embedding = await embeddingService.embedQuery(
  "Silicon flow embedding online: fast, affordable, and high-quality embedding services."
);

console.log(`嵌入向量维度: ${embedding.length}`);
console.log(`前5个值: ${embedding.slice(0, 5)}`);

// 批量生成嵌入
const texts = [
  "我要洗澡了",
  "家里有点冷",
  "准备睡觉"
];
const embeddings = await embeddingService.embedDocuments(texts);
console.log(`生成了 ${embeddings.length} 个嵌入向量`);
```

### 3. 相似度计算

```typescript
// 计算两个文本的相似度
const text1 = "我要洗澡了";
const text2 = "准备洗澡";

const vec1 = await embeddingService.embedQuery(text1);
const vec2 = await embeddingService.embedQuery(text2);

const similarity = embeddingService.cosineSimilarity(vec1, vec2);
console.log(`"${text1}" 和 "${text2}" 的相似度: ${similarity.toFixed(4)}`);
```

### 4. 在 Orchestrator 中集成

可以在 `orchestrator.ts` 中初始化嵌入服务：

```typescript
import { EmbeddingService } from "./services/embeddings.js";

export class Orchestrator {
  private embeddingService?: EmbeddingService;

  async initialize(): Promise<void> {
    // ... 其他初始化代码 ...

    // 初始化嵌入服务（可选）
    if (process.env.SILICONFLOW_API_KEY) {
      this.embeddingService = new EmbeddingService({
        provider: "siliconflow",
        model: process.env.EMBEDDING_MODEL || "BAAI/bge-large-zh-v1.5",
        apiKey: process.env.SILICONFLOW_API_KEY,
        dimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || "1024")
      });
    }
  }

  // 使用嵌入进行语义搜索
  async findSimilarIntents(query: string, history: string[]): Promise<string[]> {
    if (!this.embeddingService) {
      return [];
    }

    const queryEmbedding = await this.embeddingService.embedQuery(query);
    const historyEmbeddings = await this.embeddingService.embedDocuments(history);

    // 计算相似度并排序
    const similarities = historyEmbeddings.map((emb, idx) => ({
      text: history[idx],
      similarity: this.embeddingService!.cosineSimilarity(queryEmbedding, emb)
    }));

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .filter(item => item.similarity > 0.7) // 相似度阈值
      .map(item => item.text);
  }
}
```

## 技术说明

### OpenAI 兼容性

SiliconFlow 的 API 完全兼容 OpenAI 的嵌入 API 格式：

- **端点**: `https://api.siliconflow.cn/v1/embeddings`
- **请求格式**: 与 OpenAI 相同
- **响应格式**: 与 OpenAI 相同

因此可以直接使用 LangChain 的 `OpenAIEmbeddings` 类，只需要设置 `baseURL` 即可。

### 支持的模型

SiliconFlow 支持多种嵌入模型，包括：

- `BAAI/bge-large-zh-v1.5` - 中文大模型（推荐）
- `BAAI/bge-base-zh-v1.5` - 中文基础模型
- `text-embedding-ada-002` - OpenAI 兼容模型
- 更多模型请查看 [SiliconFlow 文档](https://siliconflow.cn)

### 注意事项

1. **API Key**: 需要在 SiliconFlow 平台获取 API Key
2. **Rate Limits**: 注意 API 调用频率限制
3. **Dimensions**: 某些模型支持自定义维度（如 `dimensions: 1024`），但 LangChain 的 `OpenAIEmbeddings` 可能不直接支持此参数，需要查看具体实现
4. **成本**: SiliconFlow 提供更经济的嵌入服务，适合中文场景

## 与 OpenAI 对比

| 特性 | SiliconFlow | OpenAI |
|------|-------------|--------|
| 中文支持 | ✅ 优秀 | ⚠️ 一般 |
| 价格 | 💰 更经济 | 💰💰 较贵 |
| API 兼容性 | ✅ 完全兼容 | ✅ 原生 |
| 自定义维度 | ✅ 支持 | ⚠️ 部分支持 |

对于中文智能家居场景，**推荐使用 SiliconFlow**。
