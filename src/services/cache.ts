/**
 * 缓存服务
 * 实现流程缓存，避免重复推理
 * 
 * @file src/services/cache.ts
 */

import { CacheEntry, CacheStrategy, Intent, ContextState, Plan } from "../types/index.js";
import crypto from "crypto";

export interface CacheConfig {
  strategy: CacheStrategy;
  ttl: number; // 秒
  maxSize: number;
}

export class CacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig;

  constructor(config: CacheConfig) {
    this.config = config;
  }

  /**
   * 计算上下文哈希
   */
  private computeContextHash(context: ContextState): string {
    const normalized = JSON.stringify({
      timeOfDay: context.timeOfDay,
      presence: context.presence,
      temperature: Math.round((context.temperature || 0) * 10) / 10,
      humidity: Math.round((context.humidity || 0) * 10) / 10,
      devices: context.devices.map(d => ({
        id: d.entityId,
        state: d.state
      })).sort((a, b) => a.id.localeCompare(b.id))
    });
    
    return crypto.createHash("md5").update(normalized).digest("hex");
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(intent: Intent, context?: ContextState): string {
    if (!context || this.config.strategy === CacheStrategy.SIMPLE) {
      return `simple:${intent.intent}`;
    }
    
    if (this.config.strategy === CacheStrategy.CONTEXT_AWARE) {
      const hash = this.computeContextHash(context);
      return `context:${intent.intent}:${hash}`;
    }

    return `default:${intent.intent}`;
  }

  /**
   * 执行缓存查询
   */
  query(intent: Intent, context?: ContextState): { hit: boolean; entry?: CacheEntry; reason?: string } {
    if (this.config.strategy === CacheStrategy.NONE) {
      return { hit: false, reason: "缓存未启用" };
    }

    const key = this.generateCacheKey(intent, context);
    
    // 尝试直连命中
    let entry = this.cache.get(key);

    // 如果未命中且是上下文感知，尝试模糊匹配
    if (!entry && this.config.strategy === CacheStrategy.CONTEXT_AWARE && context) {
      entry = this.findFuzzyMatch(intent, context);
    }

    if (!entry) {
      return { hit: false, reason: "未找到匹配缓存" };
    }

    // 检查是否过期
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return { hit: false, reason: "缓存已过期" };
    }

    // 更新使用统计
    entry.usageCount++;
    entry.lastUsed = new Date().toISOString();

    return { hit: true, entry };
  }

  /**
   * 模糊匹配（上下文微差时使用）
   */
  private findFuzzyMatch(intent: Intent, context: ContextState): CacheEntry | undefined {
    const contextHash = this.computeContextHash(context);
    const targetTimeOfDay = context.timeOfDay;

    // 查找相同意图、相似时间段的缓存
    for (const [key, entry] of this.cache) {
      if (entry.intent !== intent.intent) continue;
      
      // 解析缓存中的时间上下文
      const cacheContext = JSON.parse(entry.contextHash);
      
      // 相时间段或低使用频率时可复用
      if (key.includes(targetTimeOfDay) || entry.successRate > 0.8) {
        return entry;
      }
    }

    return undefined;
  }

  /**
   * 存储缓存
   */
  store(intent: Intent, plan: Plan, context?: ContextState): void {
    if (this.config.strategy === CacheStrategy.NONE || !plan.cacheable) {
      return;
    }

    if (this.cache.size >= this.config.maxSize) {
      this.evictLeastUseful();
    }

    const key = this.generateCacheKey(intent, context);
    const contextHash = context ? this.computeContextHash(context) : "simple";

    const entry: CacheEntry = {
      cacheKey: key,
      intent: intent.intent,
      plan,
      contextHash,
      lastUsed: new Date().toISOString(),
      usageCount: 1,
      successRate: 1.0
    };

    this.cache.set(key, entry);
  }

  /**
   * 更新缓存成功率
   */
  updateSuccessRate(cacheKey: string, success: boolean): void {
    const entry = this.cache.get(cacheKey);
    if (!entry) return;

    // 使用滑动平均更新成功率
    const currentRate = entry.successRate;
    const newRate = success ? 
      Math.min(1, currentRate + 0.1) : 
      Math.max(0, currentRate - 0.2);
    
    entry.successRate = newRate;

    // 如果成功率过低，删除缓存
    if (newRate < 0.3) {
      this.cache.delete(cacheKey);
    }
  }

  /**
   * 检查是否过期
   */
  private isExpired(entry: CacheEntry): boolean {
    const lastUsed = new Date(entry.lastUsed).getTime();
    const now = Date.now();
    return (now - lastUsed) > this.config.ttl * 1000;
  }

  /**
   * 清理最不有用的缓存
   */
  private evictLeastUseful(): void {
    if (this.cache.size === 0) return;

    // 找到使用率最低的条目
    let leastUseful: string | null = null;
    let minScore = Infinity;

    for (const [key, entry] of this.cache) {
      const score = (entry.usageCount * entry.successRate) / 
                    (1 + (Date.now() - new Date(entry.lastUsed).getTime()));
      
      if (score < minScore) {
        minScore = score;
        leastUseful = key;
      }
    }

    if (leastUseful) {
      this.cache.delete(leastUseful);
    }
  }

  /**
   * 获取缓存统计
   */
  getStats() {
    const entries = Array.from(this.cache.values());
    
    return {
      total: this.cache.size,
      averageSuccessRate: entries.length > 0 
        ? entries.reduce((sum, e) => sum + e.successRate, 0) / entries.length 
        : 0,
      topIntent: this.getTopIntent(),
      byIntent: this.getCountByIntent()
    };
  }

  private getTopIntent(): string | null {
    const counts = this.getCountByIntent();
    if (Object.keys(counts).length === 0) return null;
    
    return Object.entries(counts).sort(([,a], [,b]) => b - a)[0][0];
  }

  private getCountByIntent(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const entry of this.cache.values()) {
      counts[entry.intent] = (counts[entry.intent] || 0) + 1;
    }
    return counts;
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取特定条目
   */
  get(key: string): CacheEntry | undefined {
    const entry = this.cache.get(key);
    if (entry && !this.isExpired(entry)) {
      return entry;
    }
    return undefined;
  }

  /**
   * 删除指定缓存
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }
}

// 简单的内存缓存单例
let cacheInstance: CacheService | null = null;

export function getCacheService(config?: CacheConfig): CacheService {
  if (!cacheInstance && config) {
    cacheInstance = new CacheService(config);
  }
  if (!cacheInstance) {
    throw new Error("缓存服务未初始化");
  }
  return cacheInstance;
}

export function setCacheService(service: CacheService): void {
  cacheInstance = service;
}
