/**
 * 应用入口
 * 
 * @file src/app.ts
 */

import express, { Express } from "express";
import dotenv from "dotenv";
import routes from "./api/routes.js";
import { 
  requestLogger, 
  jsonErrorHandler, 
  corsMiddleware, 
  errorHandler,
  performanceMonitor,
  rateLimitMiddleware
} from "./api/middleware.js";
import { Orchestrator } from "./orchestrator.js";

// 加载环境变量
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

// 基础中间件
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 自定义中间件
app.use(corsMiddleware);
app.use(requestLogger);
app.use(performanceMonitor);
app.use(jsonErrorHandler);

// API 速率限制 - 生产环境启用
if (process.env.NODE_ENV !== "development") {
  app.use(rateLimitMiddleware(10, 60000)); // 1分钟内最多10个请求
}

// 路由
app.use("/api", routes);

// 健康检查根路由
app.get("/", (req, res) => {
  res.json({
    name: "Just A Rather Very Intelligent System",
    version: "1.0.0",
    description: "基于LLM的多智能体智能家居控制系统",
    api: "/api",
    status: "/api/status",
    health: "/api/health"
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "未找到",
    path: req.path
  });
});

// 错误处理 (必须放最后)
app.use(errorHandler);

/**
 * 启动函数
 */
async function startServer() {
  try {
    console.log("🚀 正在初始化系统组件...");

    // 初始化协调器 (单例)
    const orchestrator = Orchestrator.getInstance();
    await orchestrator.initialize();

    console.log("✅ 组件初始化完成");

    // 检查环境配置
    const llmProvider = process.env.LLM_PROVIDER?.toLowerCase();
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;

    if (!hasAnthropic && !hasOpenAI) {
      console.warn("⚠️  警告: 未检测到 LLM API Key (OPENAI_API_KEY 或 ANTHROPIC_API_KEY)");
      console.warn("   系统需要至少配置一个 LLM 服务才能正常运行");
    } else if (llmProvider === "anthropic" && !hasAnthropic) {
      console.warn("⚠️  警告: LLM_PROVIDER=anthropic 但未配置 ANTHROPIC_API_KEY");
    } else if (llmProvider === "openai" && !hasOpenAI) {
      console.warn("⚠️  警告: LLM_PROVIDER=openai 但未配置 OPENAI_API_KEY");
    } else if (hasAnthropic && hasOpenAI && !llmProvider) {
      console.log("ℹ️  检测到两个 LLM API Key，建议设置 LLM_PROVIDER 明确指定使用哪个");
    }

    if (!process.env.EMBEDDING_API_KEY || !process.env.EMBEDDING_BASE_URL || !process.env.EMBEDDING_MODEL) {
      console.log("ℹ️  Embeddings 服务未配置（可选功能）");
    }

    if (!process.env.HOME_ASSISTANT_TOKEN) {
      console.warn("⚠️  警告: 未检测到 HOME_ASSISTANT_TOKEN (demo模式仍可用)");
    }

    // 启动服务器
    app.listen(PORT, () => {
      console.log(`
┌──────────────────────────────────────────────┐
│                                              │
│   JARVIS System API Server                   │
│   🚀 启动成功                                │
│                                              │
│   本地: http://localhost:${PORT}             │
│   API:  http://localhost:${PORT}/api         │
│                                              │
└──────────────────────────────────────────────┘

📝 测试命令:
   curl -X POST http://localhost:${PORT}/api/demo \\
     -H "Content-Type: application/json" \\
     -d '{"message": "我要洗澡了"}'

   curl http://localhost:${PORT}/api/status

💡 提示: 使用 demo 接口无需配置真实 HA 环境
      `);
    });
  } catch (error) {
    console.error("💥 系统启动失败:", error);
    process.exit(1);
  }
}

// 优雅关闭
process.on("SIGTERM", () => {
  console.log("received SIGTERM, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("\nreceived SIGINT, shutting down gracefully");
  process.exit(0);
});

// 主入口 (ES Modules 兼容)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  startServer();
}

// 导出供测试使用
export { app };
