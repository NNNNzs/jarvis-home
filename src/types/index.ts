/**
 * 智能家居多智能体系统 - 类型定义
 */

// ==================== 基础类型 ====================

/**
 * 意图枚举
 */
export enum IntentType {
  BATH_PREPARE = "bath_prepare",      // 洗澡准备
  SLEEP = "sleep",                    // 睡觉
  GO_OUT = "go_out",                  // 出门
  GO_HOME = "go_home",                // 回家
  ADJUST_TEMP = "adjust_temperature", // 调节温度
  GET_STATUS = "get_status"          // 获取状态
}

/**
 * 执行状态
 */
export enum ExecutionStatus {
  PENDING = "pending",
  SUCCESS = "success",
  FAILED = "failed",
  PARTIAL = "partial"
}

/**
 * 缓存策略
 */
export enum CacheStrategy {
  NONE = "none",
  SIMPLE = "simple",           // 简单缓存
  CONTEXT_AWARE = "context_aware" // 上下文感知
}

// ==================== 类型定义 ====================

/**
 * 用户输入
 */
export interface UserInput {
  message: string;
  userId?: string;
  context?: Record<string, any>;
}

/**
 * 意图识别输出
 */
export interface Intent {
  intent: IntentType;
  confidence: number;
  timeHint?: string;
  rawInput: string;
}

/**
 * Home Assistant 设备状态
 */
export interface DeviceState {
  entityId: string;
  entityName: string;
  state: string;
  attributes: Record<string, any>;
  lastChanged?: string;
}

/**
 * 家庭上下文状态
 */
export interface ContextState {
  timestamp: string;
  devices: DeviceState[];
  presence?: boolean;
  timeOfDay: "morning" | "afternoon" | "evening" | "night";
  temperature?: number;
  humidity?: number;
}

/**
 * 单个执行步骤
 */
export interface ActionStep {
  service: string;        // e.g., "switch.turn_on"
  entityId: string;       // e.g., "switch.water_heater"
  targetName: string;     // 人类可读名称
  description: string     // 执行说明
}

/**
 * 行为计划
 */
export interface Plan {
  planId: string;
  intent: IntentType;
  steps: ActionStep[];
  estimatedTime?: number;
  confidence: number;
  cacheable: boolean;
}

/**
 * 单步执行结果
 */
export interface StepExecutionResult {
  stepIndex: number;
  success: boolean;
  error?: string;
  timestamp: string;
}

/**
 * 执行结果
 */
export interface ExecutionResult {
  planId: string;
  status: ExecutionStatus;
  steps: StepExecutionResult[];
  totalTime: number;
  timestamp: string;
}

/**
 * 缓存条目
 */
export interface CacheEntry {
  cacheKey: string;
  intent: IntentType;
  plan: Plan;
  contextHash: string;
  lastUsed: string;
  usageCount: number;
  successRate: number;
}

// ==================== Agent 状态 ====================

/**
 * LangGraph 状态
 */
export interface AgentState {
  userInput?: UserInput;
  intent?: Intent;
  context?: ContextState;
  plan?: Plan;
  execution?: ExecutionResult;
  cacheHit?: boolean;
  error?: string;
}

/**
 * Home Assistant 实体配置
 */
export interface HAEntityConfig {
  entityId: string;
  friendlyName: string;
  domain: string;  // switch, light, climate, etc.
  supportedIntents: IntentType[];
}

/**
 * 系统配置
 */
export interface SystemConfig {
  llm: {
    provider: "openai" | "other";
    model: string;
    temperature: number;
    maxRetries: number;
  };
  homeAssistant: {
    url: string;
    token: string;
    timeout: number;
  };
  cache: {
    strategy: CacheStrategy;
    ttl: number; // 秒
    maxSize: number;
  };
  server: {
    port: number;
    enableCors: boolean;
  };
}

// ==================== 其他辅助类型 ====================

/**
 * 意图匹配规则
 */
export interface IntentMatchRule {
  patterns: string[];      // 关键词匹配模式
  intent: IntentType;
  priority: number;        // 优先级
  contextRequired: boolean; // 是否需要上下文
}

/**
 * 设备控制命令
 */
export interface DeviceCommand {
  service: string;
  entityId: string;
  data?: Record<string, any>;
}

/**
 * 缓存查询结果
 */
export interface CacheQueryResult {
  hit: boolean;
  entry?: CacheEntry;
  reason?: string; // 未命中原因
}