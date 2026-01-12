/**
 * 嵌入服务
 * 封装 LangChain 的嵌入模型调用，支持 OpenAI 兼容的 API (如 SiliconFlow)
 * 
 * @file src/services/embeddings.ts
 */

import { OpenAIEmbeddings } from "@langchain/openai";

export interface EmbeddingConfig {
  provider: "openai" | "siliconflow";
  model: string;
  apiKey: string;
  baseURL?: string;
  dimensions?: number;
}

/**
 * 嵌入服务类
 * 处理文本向量化，用于相似度搜索、语义匹配等
 */
export class EmbeddingService {
  private embeddings: OpenAIEmbeddings;
  private config: EmbeddingConfig;

  constructor(config: EmbeddingConfig) {
    this.config = config;

    if (!config.apiKey) {
      throw new Error("API key 必须提供");
    }

    // 使用 OpenAIEmbeddings，因为它兼容 OpenAI API 格式
    // SiliconFlow 提供 OpenAI 兼容的 API，可以直接使用
    this.embeddings = new OpenAIEmbeddings({
      modelName: config.model,
      apiKey: config.apiKey,
      configuration: {
        // 对于 SiliconFlow，设置 baseURL 为 https://api.siliconflow.cn/v1
        baseURL: config.baseURL || (config.provider === "siliconflow"
          ? "https://api.siliconflow.cn/v1"
          : undefined)
      },
      // 如果支持 dimensions 参数（如 SiliconFlow），可以通过其他方式传递
      // 注意：OpenAIEmbeddings 可能不直接支持 dimensions，需要查看具体实现
    });
  }

  /**
   * 生成单个文本的嵌入向量
   * @param text 要嵌入的文本
   * @returns 嵌入向量数组
   */
  async embedQuery(text: string): Promise<number[]> {
    try {
      const result = await this.embeddings.embedQuery(text);
      return result;
    } catch (error) {
      throw new Error(`嵌入生成失败: ${(error as Error).message}`);
    }
  }

  /**
   * 批量生成多个文本的嵌入向量
   * @param texts 要嵌入的文本数组
   * @returns 嵌入向量数组的数组
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    try {
      const results = await this.embeddings.embedDocuments(texts);
      return results;
    } catch (error) {
      throw new Error(`批量嵌入生成失败: ${(error as Error).message}`);
    }
  }

  /**
   * 计算两个向量的余弦相似度
   * @param vec1 向量1
   * @param vec2 向量2
   * @returns 相似度分数 (0-1)
   */
  cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error("向量维度不匹配");
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    if (denominator === 0) {
      return 0;
    }

    return dotProduct / denominator;
  }

  /**
   * 测试连接状态
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.embedQuery("test");
      return true;
    } catch {
      return false;
    }
  }
}

// 单例
let embeddingInstance: EmbeddingService | null = null;

export function getEmbeddingService(config?: EmbeddingConfig): EmbeddingService {
  if (!embeddingInstance && config) {
    embeddingInstance = new EmbeddingService(config);
  }
  if (!embeddingInstance) {
    throw new Error("嵌入服务未初始化");
  }
  return embeddingInstance;
}

export function setEmbeddingService(service: EmbeddingService): void {
  embeddingInstance = service;
}
