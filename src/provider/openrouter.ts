import { Anthropic } from '@anthropic-ai/sdk'
import dotenv from 'dotenv'
dotenv.config()

/**
 * 获取 Anthropic 客户端实例
 * 使用函数延迟初始化，避免构建时访问环境变量
 */
export const getAnthropicClient = (): Anthropic => {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_AUTH_TOKEN,
    baseURL: process.env.ANTHROPIC_BASE_URL,
  });
};

/**
 * Anthropic 模型配置
 */
export interface AnthropicModelConfig {
  /** 模型名称 */
  model?: string;
  /** 温度参数 */
  temperature?: number;
  /** 最大 token 数 */
  maxTokens?: number;
}

/**
 * 默认模型配置
 */
export const DEFAULT_ANTHROPIC_CONFIG: AnthropicModelConfig = {
  model: 'claude-haiku-4-5-20251001',
  temperature: 0.7,
  maxTokens: 2000,
};

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
})

export default anthropic


type MessageStream = Awaited<
  ReturnType<ReturnType<typeof getAnthropicClient>['messages']['stream']>
>;
export const processAnthropicStream = async (
  stream: MessageStream,
  onTextDelta: (text: string) => void
): Promise<void> => {
  try {
    let eventCount = 0;
    let deltaCount = 0;

    for await (const event of stream) {
      eventCount++;

      // 处理 content_block_delta 事件
      if (event.type === 'content_block_delta') {
        const delta = event.delta;
        if (delta.type === 'text_delta' && delta.text) {
          deltaCount++;
          onTextDelta(delta.text);

          // 前几个和每 10 个输出一次日志
          if (deltaCount <= 3 || deltaCount % 10 === 0) {
            console.log(`📤 Anthropic 流式响应第 ${deltaCount} 个增量，长度: ${delta.text.length}`);
          }
        }
      }

      // message_stop 事件表示流结束
      if (event.type === 'message_stop') {
        console.log(`✅ Anthropic 流式响应完成，共处理 ${eventCount} 个事件，${deltaCount} 个文本增量`);
        break;
      }
    }

    if (deltaCount === 0) {
      console.warn('⚠️ 警告：Anthropic 流式响应没有返回任何文本增量');
    }
  } catch (error) {
    console.error('❌ 处理 Anthropic 流式响应错误:', error);
    if (error instanceof Error) {
      console.error('错误堆栈:', error.stack);
    }
    throw error;
  }
};
