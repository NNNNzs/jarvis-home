/**
 * Home Assistant 服务
 * 负责与 Home Assistant 的 API 交互
 * 
 * @file src/services/homeassistant.ts
 */

import axios, { AxiosInstance, AxiosError } from "axios";
import { DeviceState, DeviceCommand, HAEntityConfig } from "../types/index.js";

export interface HAConfig {
  url: string;
  token: string;
  timeout?: number;
}

export class HomeAssistantService {
  private client: AxiosInstance;
  private config: HAConfig;

  constructor(config: HAConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.url,
      timeout: config.timeout || 10000,
      headers: {
        "Authorization": `Bearer ${config.token}`,
        "Content-Type": "application/json"
      }
    });
  }

  /**
   * 获取所有设备状态
   */
  async getStates(): Promise<DeviceState[]> {
    try {
      const response = await this.client.get("/api/states");
      
      return response.data.map((entity: any) => ({
        entityId: entity.entity_id,
        entityName: entity.attributes.friendly_name || entity.entity_id,
        state: entity.state,
        attributes: entity.attributes,
        lastChanged: entity.last_changed
      }));
    } catch (error) {
      const axiosError = error as AxiosError;
      throw new Error(`获取HA状态失败: ${axiosError.message}`);
    }
  }

  /**
   * 根据实体ID获取状态
   */
  async getEntityState(entityId: string): Promise<DeviceState | null> {
    try {
      const response = await this.client.get(`/api/states/${entityId}`);
      
      return {
        entityId: response.data.entity_id,
        entityName: response.data.attributes.friendly_name || entityId,
        state: response.data.state,
        attributes: response.data.attributes,
        lastChanged: response.data.last_changed
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) {
        return null;
      }
      throw new Error(`获取实体 ${entityId} 状态失败: ${axiosError.message}`);
    }
  }

  /**
   * 调用服务控制设备
   */
  async callService(service: string, entityId: string, data?: Record<string, any>): Promise<any> {
    // 服务格式: "domain.service" -> "/api/services/domain/service"
    const [domain, serviceName] = service.split(".");
    
    try {
      const response = await this.client.post(`/api/services/${domain}/${serviceName}`, {
        entity_id: entityId,
        ...data
      });
      
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      throw new Error(`调用服务 ${service} 失败: ${axiosError.message}`);
    }
  }

  /**
   * 批量执行设备命令
   */
  async executeCommands(commands: DeviceCommand[]): Promise<{ success: boolean; results: any[]; errors: any[] }> {
    const results: any[] = [];
    const errors: any[] = [];

    for (const cmd of commands) {
      try {
        const result = await this.callService(cmd.service, cmd.entityId, cmd.data);
        results.push({
          entity: cmd.entityId,
          service: cmd.service,
          success: true,
          result
        });
      } catch (error) {
        errors.push({
          entity: cmd.entityId,
          service: cmd.service,
          success: false,
          error: (error as Error).message
        });
      }
    }

    return {
      success: errors.length === 0,
      results,
      errors
    };
  }

  /**
   * 批量获取多个实体状态
   */
  async getMultipleEntitiesState(entityIds: string[]): Promise<Record<string, DeviceState | null>> {
    const states = await this.getStates();
    const stateMap: Record<string, DeviceState | null> = {};

    entityIds.forEach(id => {
      const found = states.find(s => s.entityId === id);
      stateMap[id] = found || null;
    });

    return stateMap;
  }

  /**
   * 搜索实体（支持模糊匹配）
   */
  async searchEntities(keyword: string): Promise<DeviceState[]> {
    const states = await this.getStates();
      const lowerKeyword = keyword?.toLowerCase() || "";
    
    return states.filter(state => 
      state.entityId.toLowerCase().includes(lowerKeyword) ||
      state.entityName.toLowerCase().includes(lowerKeyword) ||
      (state.attributes.friendly_name && state.attributes.friendly_name.toLowerCase().includes(lowerKeyword))
    );
  }

  /**
   * 检查连接健康状态
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get("/api/");
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * 获取系统信息
   */
  async getSystemInfo(): Promise<any> {
    try {
      const response = await this.client.get("/api/config");
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      throw new Error(`获取系统信息失败: ${axiosError.message}`);
    }
  }
}

// 单例导出
let instance: HomeAssistantService | null = null;

export function getHAService(config?: HAConfig): HomeAssistantService {
  if (!instance && config) {
    instance = new HomeAssistantService(config);
  }
  if (!instance) {
    throw new Error("HA服务未初始化");
  }
  return instance;
}

export function setHAService(service: HomeAssistantService): void {
  instance = service;
}
