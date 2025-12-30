/**
 * 多智能体协调器 (Orchestrator)
 * 核心编排逻辑，串联所有智能体和服务
 * 
 * @file src/orchestrator.ts
 */

import { IntentAgent } from "./agents/intent.agent.js";
import { ContextAgent } from "./agents/context.agent.js";
import { PlannerAgent } from "./agents/planner.agent.js";
import { LLMService } from "./services/llm.js";
import { HomeAssistantService } from "./services/homeassistant.js";
import { CacheService } from "./services/cache.js";
import { 
  UserInput, 
  Intent, 
  ContextState, 
  Plan, 
  ExecutionResult,
  ExecutionStatus,
  DeviceState,
  CacheStrategy
} from "./types/index.js";
import { getLLMService, setLLMService } from "./services/llm.js";
import { getHAService, setHAService } from "./services/homeassistant.js";
import { getCacheService, setCacheService } from "./services/cache.js";

export interface SystemStatus {
  components: {
    llm: boolean;
    ha: boolean;
    cache: boolean;
  };
  stats: {
    totalRequests: number;
    successRate: number;
    cacheHits: number;
  };
  timestamp: string;
}

/**
 * 协调器 - 多智能体系统的大脑
 * 
 * 设计模式: 单例模式
 * 职责: 编排所有智能体和服务，执行完整流程
 */
export class Orchestrator {
  private static instance: Orchestrator | null = null;

  // 智能体
  private intentAgent: IntentAgent | null = null;
  private contextAgent: ContextAgent | null = null;
  private plannerAgent: PlannerAgent | null = null;

  // 服务
  private llmService: LLMService | null = null;
  private haService: HomeAssistantService | null = null;
  private cacheService: CacheService | null = null;

  // 状态统计
  private stats = {
    totalRequests: 0,
    successCount: 0,
    cacheHits: 0,
    errorCount: 0
  };

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): Orchestrator {
    if (!Orchestrator.instance) {
      Orchestrator.instance = new Orchestrator();
    }
    return Orchestrator.instance;
  }

  /**
   * 初始化所有组件
   */
  async initialize(): Promise<void> {
    // 1. 初始化 LLM 服务
    if (process.env.OPENAI_API_KEY) {
      this.llmService = new LLMService({
        provider: "openai",
        model: process.env.LLM_MODEL || "gpt-4o-mini",
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: process.env.OPENAI_BASE_URL,
        temperature: 0.3,
        maxRetries: 3
      });
      setLLMService(this.llmService);
    }

    // 2. 初始化 HA 服务 (可选)
    if (process.env.HOME_ASSISTANT_URL && process.env.HOME_ASSISTANT_TOKEN) {
      this.haService = new HomeAssistantService({
        url: process.env.HOME_ASSISTANT_URL,
        token: process.env.HOME_ASSISTANT_TOKEN,
        timeout: 10000
      });
      setHAService(this.haService);

      // 健康检查
      try {
        const isHealthy = await this.haService.healthCheck();
        if (!isHealthy) {
          console.warn("⚠️ Home Assistant 连接异常，请检查配置");
        }
      } catch (error) {
        console.warn("⚠️ 无法连接 Home Assistant:", (error as Error).message);
      }
    }

    // 3. 初始化缓存服务
    this.cacheService = new CacheService({
      strategy: (process.env.CACHE_STRATEGY as CacheStrategy) || CacheStrategy.CONTEXT_AWARE,
      ttl: parseInt(process.env.CACHE_TTL || "3600"), // 1小时
      maxSize: parseInt(process.env.CACHE_MAX_SIZE || "50")
    });
    setCacheService(this.cacheService);

    // 4. 创建智能体
    if (this.llmService) {
      this.intentAgent = new IntentAgent({ llm: this.llmService });
      this.plannerAgent = new PlannerAgent({ 
        llm: this.llmService, 
        cache: this.cacheService 
      });
    }

    if (this.haService) {
      this.contextAgent = new ContextAgent({ ha: this.haService });
    }
  }

  /**
   * 完整处理流程
   * 用户输入 → 意图 → 状态 → 计划 → 执行
   */
  async processUserIntent(input: UserInput): Promise<{
    intent: Intent;
    context: ContextState;
    plan: Plan;
    execution: ExecutionResult;
    cacheHit: boolean;
  }> {
    this.stats.totalRequests++;

    // 步骤1: 意图识别
    if (!this.intentAgent) {
      throw new Error("意图智能体未初始化");
    }

    const intent = await this.intentAgent.execute(input);
    console.log(`[Orchestrator] 识别意图: ${intent.intent} (置信度: ${intent.confidence})`);

    // 步骤2: 获取上下文
    if (!this.contextAgent) {
      throw new Error("上下文智能体未初始化");
    }

    const context = await this.contextAgent.execute();
    console.log(`[Orchestrator] 当前状态: ${this.contextAgent.getContextSummary(context)}`);

    // 步骤3: 生成计划
    if (!this.plannerAgent) {
      throw new Error("计划智能体未初始化");
    }

    const { plan, cacheHit } = await this.plannerAgent.execute(intent, context);
    
    if (cacheHit) {
      this.stats.cacheHits++;
      console.log(`[Orchestrator] 缓存命中: ${plan.planId}`);
    } else {
      console.log(`[Orchestrator] 生成计划: ${this.plannerAgent.getPlanSummary(plan)}`);
    }

    // 步骤4: 执行计划
    const execution = await this.executePlan(plan);
    
    // 更新统计
    if (execution.status === ExecutionStatus.SUCCESS) {
      this.stats.successCount++;
    } else {
      this.stats.errorCount++;
    }

    // 更新缓存成功率
    if (this.cacheService && cacheHit && execution.status) {
      const success = execution.status === ExecutionStatus.SUCCESS;
      this.cacheService.updateSuccessRate(plan.planId, success);
    }

    return {
      intent,
      context,
      plan,
      execution,
      cacheHit
    };
  }

  /**
   * 执行计划
   * 将计划转换为实际操作
   */
  private async executePlan(plan: Plan): Promise<ExecutionResult> {
    const startTime = Date.now();
    const results: any[] = [];
    
    // 如果没有HA服务，进入演示模式
    if (!this.haService) {
      return {
        planId: plan.planId,
        status: ExecutionStatus.PARTIAL,
        steps: plan.steps.map((_, index) => ({
          stepIndex: index,
          success: true,
          timestamp: new Date().toISOString(),
          note: "演示模式：仅模拟执行"
        })),
        totalTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }

    // 实际执行
    try {
      // 过滤掉描述中包含"跳过"或"警告"的步骤
      const executableSteps = plan.steps.filter(s => 
        !s.description.includes("跳过") && !s.description.includes("警告")
      );

      if (executableSteps.length === 0) {
        return {
          planId: plan.planId,
          status: ExecutionStatus.SUCCESS,
          steps: [],
          totalTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        };
      }

      const execution = await this.haService.executeCommands(
        executableSteps.map(s => ({
          service: s.service,
          entityId: s.entityId
        }))
      );

      execution.results.forEach((result, index) => {
        results.push({
          stepIndex: index,
          success: true,
          entityId: executableSteps[index].entityId,
          description: executableSteps[index].description,
          timestamp: new Date().toISOString()
        });
      });

      execution.errors.forEach((error, index) => {
        results.push({
          stepIndex: index,
          success: false,
          error: error.error,
          entityId: error.entity,
          timestamp: new Date().toISOString()
        });
      });

      return {
        planId: plan.planId,
        status: execution.success ? ExecutionStatus.SUCCESS : ExecutionStatus.PARTIAL,
        steps: results,
        totalTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error("执行失败:", error);
      
      return {
        planId: plan.planId,
        status: ExecutionStatus.FAILED,
        steps: plan.steps.map((_, index) => ({
          stepIndex: index,
          success: false,
          error: (error as Error).message,
          timestamp: new Date().toISOString()
        })),
        totalTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 演示处理 (无真实环境)
   */
  async demoProcess(input: UserInput): Promise<{
    intent: Intent;
    context: ContextState;
    plan: Plan;
    execution: ExecutionResult;
    cacheHit: boolean;
  }> {
    // 模拟上下文
    const mockContext: ContextState = {
      timestamp: new Date().toISOString(),
      devices: [
        { entityId: "switch.water_heater", entityName: "燃气热水器", state: "off", attributes: {} },
        { entityId: "switch.bathroom_heater", entityName: "浴霸", state: "off", attributes: {} },
        { entityId: "light.bathroom", entityName: "浴室灯", state: "off", attributes: {} }
      ],
      presence: true,
      timeOfDay: "evening",
      temperature: 22,
      humidity: 60
    };

    // 意图识别
    if (!this.intentAgent && this.llmService) {
      this.intentAgent = new IntentAgent({ llm: this.llmService });
    }

    let intent: Intent;
    if (this.intentAgent) {
      intent = await this.intentAgent.execute(input);
    } else {
      // 无LLM时的简单规则匹配
      const message = input.message.toLowerCase();
      if (message.includes("洗澡")) {
        intent = { intent: "bath_prepare" as any, confidence: 0.95, rawInput: input.message };
      } else if (message.includes("睡觉")) {
        intent = { intent: "sleep" as any, confidence: 0.9, rawInput: input.message };
      } else if (message.includes("出门")) {
        intent = { intent: "go_out" as any, confidence: 0.9, rawInput: input.message };
      } else {
        intent = { intent: "get_status" as any, confidence: 0.5, rawInput: input.message };
      }
    }

    // 演示计划
    let plan: Plan;
    if (intent.intent === "bath_prepare") {
      plan = {
        planId: `demo_bath_${Date.now()}`,
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
        confidence: 0.95,
        cacheable: true
      };
    } else if (intent.intent === "sleep") {
      plan = {
        planId: `demo_sleep_${Date.now()}`,
        intent: "sleep" as any,
        steps: [
          {
            service: "light.turn_off",
            entityId: "light.all",
            targetName: "所有灯光",
            description: "关闭所有灯光"
          }
        ],
        estimatedTime: 1,
        confidence: 0.9,
        cacheable: true
      };
    } else {
      plan = {
        planId: `demo_status_${Date.now()}`,
        intent: "get_status" as any,
        steps: [],
        estimatedTime: 0,
        confidence: 0.5,
        cacheable: false
      };
    }

    // 模拟执行
    const execution: ExecutionResult = {
      planId: plan.planId,
      status: ExecutionStatus.SUCCESS,
      steps: plan.steps.map((step, index) => ({
        stepIndex: index,
        success: true,
        timestamp: new Date().toISOString()
      })),
      totalTime: 500,
      timestamp: new Date().toISOString()
    };

    return {
      intent,
      context: mockContext,
      plan,
      execution,
      cacheHit: false
    };
  }

  /**
   * 获取系统状态
   */
  async getSystemStatus(): Promise<SystemStatus> {
    const llmOk = this.llmService ? await this.llmService.healthCheck().catch(() => false) : false;
    const haOk = this.haService ? await this.haService.healthCheck().catch(() => false) : false;
    const cacheOk = this.cacheService !== null;

    const total = this.stats.totalRequests || 1;
    const successRate = (this.stats.successCount / total) * 100;

    return {
      components: {
        llm: llmOk,
        ha: haOk,
        cache: cacheOk
      },
      stats: {
        totalRequests: this.stats.totalRequests,
        successRate: parseFloat(successRate.toFixed(2)),
        cacheHits: this.stats.cacheHits
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      // 检查LLM
      if (this.llmService && !await this.llmService.healthCheck()) {
        return false;
      }

      // 检查HA (如果配置了)
      if (this.haService && !await this.haService.healthCheck()) {
        return false;
      }

      // 检查缓存
      if (!this.cacheService) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    if (!this.cacheService) {
      return { message: "缓存服务未启用" };
    }
    return this.cacheService.getStats();
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    if (this.cacheService) {
      this.cacheService.clear();
      console.log("[Orchestrator] 缓存已清空");
    }
  }

  /**
   * 获取设备列表
   */
  async getDeviceList(): Promise<DeviceState[] | { message: string }> {
    if (!this.haService) {
      return { message: "Home Assistant 未配置，在演示模式下" };
    }
    return await this.haService.getStates();
  }

  /**
   * 生成智能建议
   * 基于当前时间和状态给出主动建议
   */
  async generateSuggestions(): Promise<string[]> {
    if (!this.contextAgent) {
      return ["请先配置 Home Assistant"];
    }

    const context = await this.contextAgent.execute();
    const suggestions: string[] = [];

    // 基于时间的建议
    if (context.timeOfDay === "morning" && !context.presence) {
      suggestions.push("看起来您还没起床，需要我为您准备起床模式吗？");
    }

    if (context.timeOfDay === "night" && context.presence) {
      suggestions.push("时间不早了，需要我帮您准备睡觉模式吗？");
    }

    // 基于温度的建议
    if (context.temperature !== undefined) {
      if (context.temperature < 20) {
        suggestions.push("室内温度较低，要考虑开启暖气吗？");
      } else if (context.temperature > 26) {
        suggestions.push("天气较热，是否需要开启空调？");
      }
    }

    // 基于设备状态的建议
    const activeDevices = context.devices.filter(d => d.state === "on").length;
    if (activeDevices > 5 && !context.presence) {
      suggestions.push("家里好像没人，但有多台设备仍在运行，要出门模式吗？");
    }

    return suggestions.length > 0 ? suggestions : ["当前一切正常，有什么可以帮您的吗？"];
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      successCount: 0,
      cacheHits: 0,
      errorCount: 0
    };
  }
}
