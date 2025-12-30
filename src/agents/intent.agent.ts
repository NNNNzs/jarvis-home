/**
 * 意图识别智能体 (Intent Agent)
 * 负责从自然语言中提取用户意图
 * 
 * @file src/agents/intent.agent.ts
 */

import { LLMService } from "../services/llm.js";
import { UserInput, Intent, IntentType } from "../types/index.js";

export interface IntentAgentConfig {
  llm: LLMService;
}

/**
 * 意图识别智能体
 * 
 * 职责:
 * 1. 从自然语言中识别用户意图
 * 2. 不涉及设备操作判断
 * 3. 输出结构化意图数据
 */
export class IntentAgent {
  private llm: LLMService;
  private intentPatterns: Map<IntentType, string[]>;

  constructor(config: IntentAgentConfig) {
    this.llm = config.llm;

    // 预定义意图匹配规则 (用于快速兜底)
    this.intentPatterns = new Map([
      [IntentType.BATH_PREPARE, ["洗澡", "沐浴", "准备洗澡", "我要洗澡"]],
      [IntentType.SLEEP, ["睡觉", "休息", "晚安", "睡眠"]],
      [IntentType.GO_OUT, ["出门", "离开", "走了", "上班"]],
      [IntentType.GO_HOME, ["回家", "回来了", "到家", "回来"]],
      [IntentType.ADJUST_TEMP, ["冷", "热", "温度", "空调", "暖气", "调温"]],
      [IntentType.GET_STATUS, ["状态", "看看", "怎么样", "现在"]]
    ]);
  }

  /**
   * 执行意图识别
   * 采用混合策略：先规则匹配，再LLM精确识别
   */
  async execute(input: UserInput): Promise<Intent> {
    // 规则快速匹配 (优化响应速度)
    const ruleBased = this.ruleMatch(input.message);
    if (ruleBased && ruleBased.confidence > 0.8) {
      return ruleBased;
    }

    // LLM 精确识别
    try {
      return await this.llm.recognizeIntent(input.message);
    } catch (error) {
      // LLM失败时使用规则匹配兜底
      return ruleBased || {
        intent: IntentType.GET_STATUS,
        confidence: 0.5,
        rawInput: input.message
      };
    }
  }

  /**
   * 规则匹配
   * 简单快速的意图判断
   */
  private ruleMatch(message: string): Intent | null {
    const lowerMsg = message.toLowerCase();

    for (const [intent, patterns] of this.intentPatterns) {
      for (const pattern of patterns) {
        if (lowerMsg.includes(pattern)) {
          return {
            intent,
            confidence: 0.9, // 规则匹配置信度较高
            rawInput: message
          };
        }
      }
    }

    return null;
  }

  /**
   * 批量识别候选意图
   * 用于复杂场景下的多意图判断
   */
  async getCandidates(message: string, topK: number = 3): Promise<Intent[]> {
    const intent = await this.execute({ message });
    
    // 返回主意图和接近的候选
    const candidates: Intent[] = [intent];
    
    // 基于规则补充候选
    const ruleMatch = this.ruleMatch(message);
    if (ruleMatch && ruleMatch.intent !== intent.intent) {
      candidates.push(ruleMatch);
    }

    // 如果场景复杂，调用LLM获取更多候选
    if (candidates.length === 1) {
      // 简单实现: 再次调用LLM不同参数获取近似结果
      // 在完整实现中可能需要特殊的Prompt
      const secondary = await this.llm.recognizeIntent(`另一种理解: ${message}`);
      if (secondary.confidence > 0.6) {
        candidates.push(secondary);
      }
    }

    return candidates.slice(0, topK);
  }

  /**
   * 验证意图是否可覆盖
   * 判断当前意图是否包含指定设备的控制
   */
  canHandle(intent: Intent, availableDevices: string[]): boolean {
    // 基础意图检查
    if (intent.intent === IntentType.GET_STATUS) {
      return true; // 总是可执行
    }

    // 复杂意图需要设备支持
    // 可根据业务规则扩展
    return true;
  }

  /**
   * 意图置信度解释
   * 用于可解释性
   */
  explainConfidence(intent: Intent): string {
    if (intent.confidence > 0.9) {
      return "高置信度: 直接匹配明确指令";
    }
    if (intent.confidence > 0.7) {
      return "中置信度: 模糊匹配时间或上下文";
    }
    return "低置信度: 需要进一步确认或人工干预";
  }
}

// 工厂函数
export function createIntentAgent(llm: LLMService): IntentAgent {
  return new IntentAgent({ llm });
}
