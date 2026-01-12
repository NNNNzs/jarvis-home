/**
 * LLM 服务
 * 封装 LangChain 和 LangGraph 的调用
 * 
 * @file src/services/llm.ts
 */

import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { AIMessage, HumanMessage, BaseMessage } from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { z } from "zod";
import { Intent, ContextState, Plan, ActionStep, IntentType } from "../types/index.js";

export interface LLMConfig {
  provider: "openai" | "anthropic";
  model: string;
  temperature?: number;
  maxRetries?: number;
  apiKey?: string;
  baseURL?: string;
}

/**
 * LLM 服务类
 * 处理所有与 LLM 的交互
 */
export class LLMService {
  private model: BaseChatModel;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;

    if (!config.apiKey) {
      throw new Error("API key 必须提供");
    }

    // 根据 provider 创建相应的模型实例
    if (config.provider === "anthropic") {
      this.model = new ChatAnthropic({
        modelName: config.model || "claude-3-5-sonnet-20241022",
        temperature: config.temperature ?? 0.3,
        maxRetries: config.maxRetries ?? 3,
        apiKey: config.apiKey,
        // 支持自定义 baseURL（如通过代理或兼容 API）
        ...(config.baseURL && {
          configuration: {
            baseURL: config.baseURL
          }
        })
      });
    } else {
      // 默认使用 OpenAI
      this.model = new ChatOpenAI({
        modelName: config.model || "gpt-4o-mini",
        temperature: config.temperature ?? 0.3,
        maxRetries: config.maxRetries ?? 3,
        apiKey: config.apiKey,
        // 支持自定义 baseURL
        ...(config.baseURL && {
          configuration: {
            baseURL: config.baseURL
          }
        })
      });
    }
  }

  /**
   * 意图识别 Prompt
   */
  private readonly INTENT_PROMPT = ChatPromptTemplate.fromMessages([
    ["system", `你是一个智能家居意图识别专家。请从用户输入中提取意图。

可用意图:
- bath_prepare: 洗澡准备 (开启热水器、浴霸、浴室灯等)
- sleep: 睡觉 (关闭灯光、调节温度等)
- go_out: 出门 (关闭设备、安防布防等)
- go_home: 回家 (开启必要设备、调节环境)
- adjust_temperature: 调节温度
- get_status: 获取设备状态信息

规则:
1. 精确匹配用户意图，输出JSON格式
2. confidence 0-1之间，表达你的把握程度
3. 只输出JSON，不要其他内容
4. 未识别的意图使用 get_status

示例:
用户: "我要洗澡了"
输出: {{"intent": "bath_prepare", "confidence": 0.95, "rawInput": "我要洗澡了"}}

用户: "家里有点冷"
输出: {{"intent": "adjust_temperature", "confidence": 0.85, "rawInput": "家里有点冷"}}`],
    new MessagesPlaceholder("messages")
  ]);

  /**
   * 行为规划 Prompt
   */
  private readonly PLANNER_PROMPT = ChatPromptTemplate.fromMessages([
    ["system", `你是一个智能家居行为规划专家。根据用户意图和当前家庭状态，生成设备控制计划。

当前状态:
{context}

规则:
1. 只操作声明过的设备，不要凭空想象
2. 所有步骤必须可执行
3. 输出严格的JSON格式
4. 估计时间单位：分钟

输出格式:
{{
  "planId": "意图_时间戳",
  "intent": "意图类型",
  "steps": [
    {{"service": "switch.turn_on", "entityId": "switch.xxx", "targetName": "设备名", "description": "说明"}}
  ],
  "estimatedTime": 5,
  "confidence": 0.9,
  "cacheable": true
}}`],
    new MessagesPlaceholder("messages")
  ]);

  /**
   * 识别用户意图
   */
  async recognizeIntent(message: string): Promise<Intent> {
    try {
      const prompt = await this.INTENT_PROMPT.formatMessages({
        messages: [new HumanMessage(message)]
      });

      const response = await this.model.invoke(prompt);
      const content = response.content as string;

      // 清理响应，确保是纯JSON
      const jsonStr = this.cleanJsonResponse(content);
      const parsed = JSON.parse(jsonStr);

      // 验证并返回
      return {
        intent: parsed.intent as IntentType,
        confidence: parsed.confidence,
        timeHint: parsed.timeHint,
        rawInput: message
      };
    } catch (error) {
      // 默认兜底
      return {
        intent: IntentType.GET_STATUS,
        confidence: 0.5,
        rawInput: message
      };
    }
  }

  /**
   * 生成行为计划
   */
  async generatePlan(intent: Intent, context: ContextState): Promise<Plan> {
    try {
      const contextStr = JSON.stringify({
        time: context.timeOfDay,
        presence: context.presence,
        temperature: context.temperature,
        devices: context.devices.map(d => ({
          id: d.entityId,
          name: d.entityName,
          state: d.state
        }))
      });

      const prompt = await this.PLANNER_PROMPT.formatMessages({
        messages: [
          new HumanMessage(`用户说: ${intent.rawInput}`),
          new AIMessage(`提取到的意图: ${intent.intent}`)
        ],
        context: contextStr
      });

      const response = await this.model.invoke(prompt);
      const content = response.content as string;

      const jsonStr = this.cleanJsonResponse(content);
      const parsed = JSON.parse(jsonStr);

      // 验证步骤
      const steps: ActionStep[] = parsed.steps.map((s: any) => ({
        service: s.service,
        entityId: s.entityId,
        targetName: s.targetName,
        description: s.description
      }));

      return {
        planId: parsed.planId || `${intent.intent}_${Date.now()}`,
        intent: intent.intent,
        steps,
        estimatedTime: parsed.estimatedTime || 5,
        confidence: parsed.confidence || 0.8,
        cacheable: parsed.cacheable ?? true
      };
    } catch (error) {
      throw new Error(`计划生成失败: ${(error as Error).message}`);
    }
  }

  /**
   * 生成上下文感知的计划
   * 结合历史经验进行优化
   */
  async generateContextualPlan(
    intent: Intent,
    context: ContextState,
    similarPlans?: Plan[]
  ): Promise<Plan> {
    if (!similarPlans || similarPlans.length === 0) {
      return this.generatePlan(intent, context);
    }

    // 使用相似计划作为few-shot示例
    const examples = similarPlans.map(plan =>
      `示例计划（${plan.intent}）:\n${JSON.stringify(plan, null, 2)}`
    ).join("\n\n");

    const enhancedPrompt = ChatPromptTemplate.fromMessages([
      ["system", `你是一个智能家居行为规划专家。

你有类似的历史计划供参考，但必须根据当前实际情况调整。

${examples}

当前状态:
${JSON.stringify({
        time: context.timeOfDay,
        presence: context.presence,
        temperature: context.temperature,
        devices: context.devices.map(d => ({
          id: d.entityId,
          name: d.entityName,
          state: d.state
        }))
      })}

请生成优化后的计划，输出JSON格式。`],
      ["human", `用户意图: ${intent.intent}, 原始输入: ${intent.rawInput}`]
    ]);

    const prompt = await enhancedPrompt.formatMessages({});
    const response = await this.model.invoke(prompt);
    const content = response.content as string;
    const jsonStr = this.cleanJsonResponse(content);
    const parsed = JSON.parse(jsonStr);

    return {
      planId: parsed.planId || `${intent.intent}_${Date.now()}`,
      intent: intent.intent,
      steps: parsed.steps,
      estimatedTime: parsed.estimatedTime || 5,
      confidence: parsed.confidence || 0.85, // 上下文感知下置信度略高
      cacheable: parsed.cacheable ?? true
    };
  }

  /**
   * 清理响应为可用JSON
   */
  private cleanJsonResponse(content: string): string {
    // 移除Markdown代码块标记
    let cleaned = content
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    // 确保是JSON对象
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }

    return cleaned;
  }

  /**
   * 测试连接状态
   */
  async healthCheck(): Promise<boolean> {
    try {
      const prompt = await this.INTENT_PROMPT.formatMessages({
        messages: [new HumanMessage("测试")]
      });
      await this.model.invoke(prompt);
      return true;
    } catch {
      return false;
    }
  }
}

// 单例
let llmInstance: LLMService | null = null;

export function getLLMService(config?: LLMConfig): LLMService {
  if (!llmInstance && config) {
    llmInstance = new LLMService(config);
  }
  if (!llmInstance) {
    throw new Error("LLM服务未初始化");
  }
  return llmInstance;
}

export function setLLMService(service: LLMService): void {
  llmInstance = service;
}
