/**
 * HTTP API 路由
 * 
 * @file src/api/routes.ts
 */

import { Request, Response } from "express";
import { Router } from "express";
import { UserInput } from "../types/index.js";
import { Orchestrator } from "../orchestrator.js";

const router: Router = Router();

/**
 * POST /api/intent
 * 处理用户意图输入
 * 
 * 请求示例:
 * {
 *   "message": "我要洗澡了"
 * }
 * 
 * 响应示例:
 * {
 *   "success": true,
 *   "data": {
 *     "intent": "bath_prepare",
 *     "plan": {...},
 *     "execution": {...}
 *   }
 * }
 */
router.post("/intent", async (req: Request, res: Response) => {
  try {
    // 验证输入
    const body = req.body as any;
    if (!body.message || typeof body.message !== "string" || body.message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "输入验证失败",
        details: "message 字段必填且不能为空"
      });
    }

    const input: UserInput = {
      message: body.message,
      userId: body.userId,
      context: body.context
    };

    // 获取协调器实例
    const orchestrator = Orchestrator.getInstance();

    // 执行处理流程
    const result = await orchestrator.processUserIntent(input);

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("处理意图失败:", error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || "内部服务器错误"
    });
  }
});

/**
 * GET /api/status
 * 系统状态检查
 */
router.get("/status", async (req: Request, res: Response) => {
  try {
    const orchestrator = Orchestrator.getInstance();
    const status = await orchestrator.getSystemStatus();

    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * GET /api/health
 * 健康检查
 */
router.get("/health", async (req: Request, res: Response) => {
  try {
    const orchestrator = Orchestrator.getInstance();
    const healthy = await orchestrator.healthCheck();

    if (healthy) {
      res.json({ status: "healthy", timestamp: new Date().toISOString() });
    } else {
      res.status(503).json({ status: "unhealthy", timestamp: new Date().toISOString() });
    }
  } catch (error) {
    res.status(500).json({ status: "error", error: (error as Error).message });
  }
});

/**
 * GET /api/cache/stats
 * 缓存统计
 */
router.get("/cache/stats", (req: Request, res: Response) => {
  try {
    const orchestrator = Orchestrator.getInstance();
    const stats = orchestrator.getCacheStats();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * POST /api/cache/clear
 * 清空缓存
 */
router.post("/cache/clear", (req: Request, res: Response) => {
  try {
    const orchestrator = Orchestrator.getInstance();
    orchestrator.clearCache();

    res.json({
      success: true,
      message: "缓存已清空",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * POST /api/demo
 * 演示模式 - 不需要真实环境
 * 用于测试和演示
 */
router.post("/demo", async (req: Request, res: Response) => {
  try {
    const body = req.body as any;
    if (!body.message || typeof body.message !== "string" || body.message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "输入验证失败",
        details: "message 字段必填且不能为空"
      });
    }

    const input: UserInput = {
      message: body.message,
      userId: body.userId,
      context: body.context
    };

    const orchestrator = Orchestrator.getInstance();
    const result = await orchestrator.demoProcess(input);

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * GET /api/intent/suggest
 * 智能建议 - 基于时间和状态的主动建议
 */
router.get("/intent/suggest", async (req: Request, res: Response) => {
  try {
    const orchestrator = Orchestrator.getInstance();
    const suggestions = await orchestrator.generateSuggestions();

    res.json({
      success: true,
      data: suggestions,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * GET /api/devices
 * 获取所有设备列表
 */
router.get("/devices", async (req: Request, res: Response) => {
  try {
    const orchestrator = Orchestrator.getInstance();
    const devices = await orchestrator.getDeviceList();

    res.json({
      success: true,
      data: devices,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

router.get('/test', async (req: Request, res: Response) => {
  let interval: NodeJS.Timeout;
  const stream = new ReadableStream({
    start(controller) {
      interval = setInterval(() => {
        controller.enqueue('Hello, world!');
      }, 1000);
      setTimeout(() => {
        clearInterval(interval);
        controller.close();
      }, 10000);
    },
    cancel() {
      clearInterval(interval);
    },
  });
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  res.flushHeaders();

});

export default router;
