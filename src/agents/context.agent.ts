/**
 * 状态感知智能体 (Context Agent)
 * 负责从 Home Assistant 获取当前家庭状态
 * 
 * @file src/agents/context.agent.ts
 */

import { HomeAssistantService } from "../services/homeassistant.js";
import { ContextState, DeviceState } from "../types/index.js";

export interface ContextAgentConfig {
  ha: HomeAssistantService;
}

/**
 * 状态感知智能体
 * 
 * 职责:
 * 1. 获取设备实时状态
 * 2. 理解环境上下文
 * 3. 提供决策所需状态快照
 */
export class ContextAgent {
  private ha: HomeAssistantService;

  constructor(config: ContextAgentConfig) {
    this.ha = config.ha;
  }

  /**
   * 提取完整家庭上下文
   * 用于意图识别和计划生成
   */
  async execute(): Promise<ContextState> {
    const timestamp = new Date().toISOString();
    
    // 获取所有设备状态
    const allDevices = await this.ha.getStates();

    // 提取关键环境信息
    const timeOfDay = this.getTimeOfDay();
    const presence = this.detectPresence(allDevices);
    const temperature = this.extractTemperature(allDevices);
    const humidity = this.extractHumidity(allDevices);

    // 根据时间、天气等条件筛选相关设备
    const relevantDevices = this.filterRelevantDevices(allDevices);

    return {
      timestamp,
      devices: relevantDevices,
      presence,
      timeOfDay,
      temperature,
      humidity
    };
  }

  /**
   * 检测是否有人在家
   * 通过多种传感器进行判断
   */
  private detectPresence(devices: DeviceState[]): boolean {
    // 检查人体传感器
    const motionSensors = devices.filter(d => 
      d.entityId.includes("person.") || 
      d.entityId.includes("binary_sensor.motion") ||
      d.entityId.includes("device_tracker")
    );

    if (motionSensors.length > 0) {
      return motionSensors.some(d => d.state === "on" || d.state === "home");
    }

    // 兜底: 检查是否有设备在活动状态
    const activeDevices = devices.filter(d => 
      ["on", "playing", "active"].includes(d.state)
    );
    
    return activeDevices.length > 3; // 保守判断
  }

  /**
   * 提取温度信息
   */
  private extractTemperature(devices: DeviceState[]): number | undefined {
    const tempSensors = devices.filter(d => 
      d.entityId.includes("temperature") || 
      d.entityId.includes("weather") ||
      d.entityId.includes("climate")
    );

    if (tempSensors.length === 0) return undefined;

    // 取平均值
    const temps = tempSensors
      .map(d => parseFloat(d.state))
      .filter(n => !isNaN(n));

    if (temps.length === 0) return undefined;

    return Math.round((temps.reduce((a, b) => a + b) / temps.length) * 10) / 10;
  }

  /**
   * 提取湿度信息
   */
  private extractHumidity(devices: DeviceState[]): number | undefined {
    const humiditySensors = devices.filter(d => 
      d.entityId.includes("humidity")
    );

    if (humiditySensors.length === 0) return undefined;

    const humidities = humiditySensors
      .map(d => parseFloat(d.state))
      .filter(n => !isNaN(n));

    if (humidities.length === 0) return undefined;

    return Math.round((humidities.reduce((a, b) => a + b) / humidities.length) * 10) / 10;
  }

  /**
   * 判断当前时间段
   */
  private getTimeOfDay(): "morning" | "afternoon" | "evening" | "night" {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 12) return "morning";
    if (hour >= 12 && hour < 18) return "afternoon";
    if (hour >= 18 && hour < 22) return "evening";
    return "night";
  }

  /**
   * 过滤相关设备
   * 减少LLM上下文长度
   */
  private filterRelevantDevices(devices: DeviceState[]): DeviceState[] {
    return devices.filter(d => {
      // 只保留开关类、温控类、照明类设备
      const relevantDomains = [
        "switch", "light", "climate", 
        "fan", "cover", "lock",
        "sensor" // 传感器也保留
      ];

      const domain = d.entityId.split(".")[0];
      return relevantDomains.includes(domain);
    });
  }

  /**
   * 获取特定类型设备状态
   */
  async getDeviceTypeState(domain: string): Promise<DeviceState[]> {
    const allDevices = await this.ha.getStates();
    return allDevices.filter(d => d.entityId.startsWith(`${domain}.`));
  }

  /**
   * 获取指定实体的状态
   */
  async getSpecificEntities(entityIds: string[]): Promise<Record<string, DeviceState | null>> {
    return await this.ha.getMultipleEntitiesState(entityIds);
  }

  /**
   * 生成上下文摘要
   * 用于日志和可解释性
   */
  getContextSummary(context: ContextState): string {
    const parts: string[] = [];

    // 时间
    const timeMap = {
      morning: "早晨",
      afternoon: "下午",
      evening: "晚上",
      night: "深夜"
    };
    parts.push(`时间: ${timeMap[context.timeOfDay]}`);

    // 人在状态
    parts.push(`人在: ${context.presence ? "在家" : "不在家"}`);

    // 环境
    if (context.temperature !== undefined) {
      parts.push(`温度: ${context.temperature}°C`);
    }
    if (context.humidity !== undefined) {
      parts.push(`湿度: ${context.humidity}%`);
    }

    // 设备概览
    if (context.devices.length > 0) {
      const onCount = context.devices.filter(d => d.state === "on").length;
      parts.push(`活动设备: ${onCount}/${context.devices.length}`);
    }

    return parts.join(" | ");
  }

  /**
   * 检查特定设备状态
   */
  async checkDeviceStatus(entityId: string): Promise<boolean> {
    const state = await this.ha.getEntityState(entityId);
    if (!state) return false;
    return state.state === "on" || state.state === "playing" || state.state === "open";
  }

  /**
   * 检查多个设备状态
   */
  async checkMultipleDeviceStatuses(entityIds: string[]): Promise<Record<string, boolean>> {
    const result: Record<string, boolean> = {};
    for (const id of entityIds) {
      result[id] = await this.checkDeviceStatus(id);
    }
    return result;
  }
}

// 工厂函数
export function createContextAgent(ha: HomeAssistantService): ContextAgent {
  return new ContextAgent({ ha });
}
