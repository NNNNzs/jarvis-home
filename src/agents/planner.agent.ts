/**
 * 行为规划智能体 (Planner Agent)
 * 负责根据意图和状态生成具体执行计划
 * 
 * @file src/agents/planner.agent.ts
 */

import { LLMService } from "../services/llm.js";
import { CacheService } from "../services/cache.js";
import { Intent, ContextState, Plan, ActionStep } from "../types/index.js";

export interface PlannerAgentConfig {
  llm: LLMService;
  cache?: CacheService;
}

/**
 * 行为规划智能体
 * 
 * 职责:
 * 1. 理解意图 + 状态 → 生成行为计划
 * 2. 尝试从缓存中获取相似计划
 * 3. 验证计划的可行性
 * 4. 不直接执行，只规划
 */
export class PlannerAgent {
  private llm: LLMService;
  private cache?: CacheService;

  constructor(config: PlannerAgentConfig) {
    this.llm = config.llm;
    this.cache = config.cache;
  }

  /**
   * 执行计划生成
   * 核心工作流程
   */
  async execute(intent: Intent, context: ContextState): Promise<{ plan: Plan; cacheHit: boolean }> {
    // 步骤1: 尝试缓存命中
    if (this.cache) {
      const cached = this.cache.query(intent, context);
      if (cached.hit && cached.entry) {
        // 校验缓存计划是否仍然适用
        const isValid = await this.validatePlan(cached.entry.plan, context);
        if (isValid) {
          return {
            plan: this.simplifyPlan(cached.entry.plan), // 可能需要简化
            cacheHit: true
          };
        }
      }
    }

    // 步骤2: 尝试查找相似历史计划
    let similarPlans: Plan[] | undefined;
    if (this.cache) {
      similarPlans = this.findSimilarPlans(intent, context);
    }

    // 步骤3: 生成新计划
    const plan = await this.generateNewPlan(intent, context, similarPlans);

    // 步骤4: 验证计划
    const validatedPlan = await this.validateAndRefinePlan(plan, context);

    // 步骤5: 存入缓存
    if (this.cache && validatedPlan.cacheable) {
      this.cache.store(intent, validatedPlan, context);
    }

    return {
      plan: validatedPlan,
      cacheHit: false
    };
  }

  /**
   * 生成新计划
   * 根据LLM生成
   */
  private async generateNewPlan(
    intent: Intent, 
    context: ContextState, 
    similarPlans?: Plan[]
  ): Promise<Plan> {
    try {
      if (similarPlans && similarPlans.length > 0) {
        // 使用上下文感知的计划生成
        return await this.llm.generateContextualPlan(intent, context, similarPlans);
      } else {
        // 普通计划生成
        return await this.llm.generatePlan(intent, context);
      }
    } catch (error) {
      // LLM失败时使用规则生成兜底计划
      return this.fallbackPlan(intent, context);
    }
  }

  /**
   * 查找相似计划
   * 从缓存中搜索相似意图和上下文
   */
  private findSimilarPlans(intent: Intent, context: ContextState): Plan[] | undefined {
    if (!this.cache) return undefined;

    // 简单的相似度计算
    const candidates: { plan: Plan; score: number }[] = [];

    for (const [key, entry] of this.cache["cache"]) { // 注意: 访问私有属性
      if (entry.intent === intent.intent) {
        // 时间相似性
        let score = 0;
        if (entry.contextHash.includes(context.timeOfDay)) score += 0.3;
        
        // 设备状态相似性
        score += entry.successRate * 0.4;
        
        // 置信度匹配
        score += (intent.confidence || 0.5) * 0.3;

        if (score > 0.5) {
          candidates.push({ plan: entry.plan, score });
        }
      }
    }

    return candidates
      .sort((a, b) => b.score - a.score)
      .map(c => c.plan)
      .slice(0, 3); // 取Top3
  }

  /**
   * 验证计划
   * 检查计划是否仍然适用
   */
  private async validatePlan(plan: Plan, context: ContextState): Promise<boolean> {
    // 检查计划涉及的设备是否还存在
    const deviceIds = plan.steps.map(s => s.entityId);
    const existingDevices = context.devices.map(d => d.entityId);
    
    return deviceIds.every(id => existingDevices.includes(id));
  }

  /**
   * 验证并优化计划
   * 添加元数据和优化
   */
  private async validateAndRefinePlan(plan: Plan, context: ContextState): Promise<Plan> {
    const refinedSteps: ActionStep[] = [];

    for (const step of plan.steps) {
      // 检查设备当前状态，避免重复操作
      const device = context.devices.find(d => d.entityId === step.entityId);
      
      if (device) {
        // 如果是开启操作且设备已开启，跳过或标记
        if (step.service.includes("turn_on") && device.state === "on") {
          refinedSteps.push({
            ...step,
            description: `[已开启] ${step.description} (跳过)`
          });
          continue;
        }

        // 如果是关闭操作且设备已关闭，跳过
        if (step.service.includes("turn_off") && device.state === "off") {
          refinedSteps.push({
            ...step,
            description: `[已关闭] ${step.description} (跳过)`
          });
          continue;
        }

        refinedSteps.push(step);
      } else {
        // 设备不存在，标记为Warning
        refinedSteps.push({
          ...step,
          description: `[警告:设备不存在] ${step.description}`
        });
      }
    }

    return {
      ...plan,
      steps: refinedSteps
    };
  }

  /**
   * 简化计划输出
   * 用于返回给用户
   */
  private simplifyPlan(plan: Plan): Plan {
    // 可以根据需要移除某些描述性字段
    return plan;
  }

  /**
   * 兜底计划生成器
 * 当LLM不可用时的规则基础计划
   */
  private fallbackPlan(intent: Intent, context: ContextState): Plan {
    const basePlans: Record<string, Plan> = {
      "bath_prepare": {
        planId: `fallback_bath_${Date.now()}`,
        intent: "bath_prepare" as any,
        steps: [
          {
            service: "switch.turn_on",
            entityId: "switch.water_heater",
            targetName: "燃气热水器",
            description: "开启燃气热水器预热"
          },
          {
            service: "switch.turn_on",
            entityId: "switch.bathroom_heater",
            targetName: "浴霸",
            description: "打开浴霸"
          },
          {
            service: "light.turn_on",
            entityId: "light.bathroom",
            targetName: "浴室灯",
            description: "打开浴室灯"
          }
        ],
        estimatedTime: 5,
        confidence: 0.8,
        cacheable: true
      },
      "sleep": {
        planId: `fallback_sleep_${Date.now()}`,
        intent: "sleep" as any,
        steps: [
          {
            service: "light.turn_off",
            entityId: "light.living_room",
            targetName: "客厅灯",
            description: "关闭客厅灯"
          }
        ],
        estimatedTime: 1,
        confidence: 0.8,
        cacheable: true
      },
      "go_out": {
        planId: `fallback_go_out_${Date.now()}`,
        intent: "go_out" as any,
        steps: [
          {
            service: "switch.turn_off",
            entityId: "switch.all_lights",
            targetName: "所有灯光",
            description: "关闭所有灯光"
          }
        ],
        estimatedTime: 2,
        confidence: 0.8,
        cacheable: true
      }
    };

    return basePlans[intent.intent] || {
      planId: `fallback_status_${Date.now()}`,
      intent: "get_status" as any,
      steps: [],
      estimatedTime: 0,
      confidence: 0.5,
      cacheable: false
    };
  }

  /**
   * 生成计划摘要
   */
  getPlanSummary(plan: Plan): string {
    const stepDesc = plan.steps
      .filter(s => !s.description.includes("跳过") && !s.description.includes("警告"))
      .map(s => s.description)
      .join("、");

    return `计划: ${plan.planId} | 预计 ${plan.estimatedTime}分钟 | 执行: ${stepDesc || "无操作"}`;
  }

  /**
   * 检查计划可行性
   * 预执行检查
   */
  async isFeasible(plan: Plan, context: ContextState): Promise<{ feasible: boolean; reason: string[] }> {
    const reasons: string[] = [];

    // 1. 有步骤吗？
    if (plan.steps.length === 0) {
      reasons.push("计划中没有操作步骤");
    }

    // 2. 设备存在吗？
    const deviceIds = plan.steps.map(s => s.entityId);
    for (const id of deviceIds) {
      if (!context.devices.find(d => d.entityId === id)) {
        reasons.push(`设备 ${id} 不在当前环境中`);
      }
    }

    // 3. 置信度足够吗？
    if (plan.confidence < 0.6) {
      reasons.push(`置信度 ${plan.confidence} 较低`);
    }

    return {
      feasible: reasons.length === 0,
      reason: reasons
    };
  }
}

// 工厂函数
export function createPlannerAgent(llm: LLMService, cache?: CacheService): PlannerAgent {
  return new PlannerAgent({ llm, cache });
}
