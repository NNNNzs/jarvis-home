# 📋 项目初始化完成

**Just A Rather Very Intelligent System** - 多智能体智能家居控制系统  
**技术栈**: Node.js + TypeScript + LangGraph + Express

---

## ✅ 已完成的任务

### 1️⃣ 基础架构
- ✅ Node.js 项目初始化 (pnpm)
- ✅ TypeScript 配置 (ES2022, strict)
- ✅ 核心依赖安装

### 2️⃣ 代码结构
```
📁 JustARatherVeryIntelligentSystem
├── 📁 .cursor/rules/          (4个开发规范文件)
├── 📁 docs/                   (QUICKSTART.md)
├── 📁 src/
│   ├── 📁 agents/            (3大智能体)
│   │   ├── intent.agent.ts   (意图识别)
│   │   ├── context.agent.ts  (状态感知)
│   │   └── planner.agent.ts  (行为规划)
│   ├── 📁 services/          (外部服务)
│   │   ├── llm.ts            (LangChain)
│   │   ├── homeassistant.ts  (HA API)
│   │   └── cache.ts          (流程缓存)
│   ├── 📁 api/               (HTTP接口)
│   │   ├── routes.ts         (路由)
│   │   └── middleware.ts     (中间件)
│   ├── 📁 types/             (类型定义)
│   │   └── index.ts          (全系统类型)
│   ├── orchestrator.ts       (核心协调器)
│   └── app.ts                (应用入口)
├── .env.example              (环境变量模板)
├── package.json              (依赖配置)
├── tsconfig.json             (TypeScript配置)
└── README.md                 (项目文档)
```

### 3️⃣ 核心组件

#### 🔧 服务层 (Services)
- `LLMService` - 封装 LangChain/LangGraph 调用
- `HomeAssistantService` - HA API 客户端
- `CacheService` - 智能流程缓存

#### 🧠 智能体 (Agents)
- **IntentAgent** - 自然语言 → 意图
- **ContextAgent** - 设备状态 → 环境理解
- **PlannerAgent** - 意图+状态 → 执行计划

#### 🎛️ 编排 (Orchestrator)
- 协调所有智能体
- 处理错误和兜底
- 管理执行流程

#### 🌐 API (Express)
- `/api/intent` - 主入口
- `/api/demo` - 演示模式
- `/api/status` - 系统状态
- `/api/health` - 健康检查

### 4️⃣ Cursor 开发规范
`.cursor/rules/` 包含:
1. **project-guidelines.mdc** - 整体规范
2. **arch-decision.mdc** - 架构决策
3. **llm-integration.mdc** - LLM 实践
4. **home-assistant.mdc** - HA 最佳实践

---

## 🚀 快速开始 (3步)

### 1. 配置环境变量
```bash
# 创建 .env 文件
cat > .env << EOF
# LLM 服务（必需，二选一）
OPENAI_API_KEY=sk-your-key
# 或
# ANTHROPIC_API_KEY=sk-ant-your-key

# 向量模型服务（可选，独立接口）
# EMBEDDING_API_KEY=your-embedding-key
# EMBEDDING_BASE_URL=https://api.siliconflow.cn/v1
# EMBEDDING_MODEL=BAAI/bge-large-zh-v1.5

# Home Assistant（可选）
# HOME_ASSISTANT_URL=http://homeassistant.local:8123
# HOME_ASSISTANT_TOKEN=your_token
EOF
```

**详细配置说明**: 查看 [docs/env-variables.md](./docs/env-variables.md)

### 2. 启动服务
```bash
# 开发模式 (推荐)
pnpm dev

# 或构建后运行
pnpm build && pnpm start
```

### 3. 测试 Demo
```bash
# 意图测试 (无需 HA)
curl -X POST http://localhost:3000/api/demo \
  -H "Content-Type: application/json" \
  -d '{"message": "我要洗澡了"}'
```

---

## 📚 详细文档

| 文档 | 说明 |
|------|------|
| **README.md** | 项目概述和架构 |
| **docs/QUICKSTART.md** | 完整上手指南 |
| **.cursor/rules/** | 开发规范和最佳实践 |

---

## 🎯 工作流程

```
用户: "我要洗澡了"
    ↓
[Intent Agent] → 识别意图: bath_prepare
    ↓
[Context Agent] → 获取状态: 晚上、在家、温度22°
    ↓  
[Planner Agent] → 生成计划: 开启热水器→浴霸→浴室灯
    ↓
[Orchestrator] → 执行计划 (或 Demo)
    ↓
返回结果 (支持缓存复用)
```

---

## 🔑 关键配置

### 必需环境变量
- `OPENAI_API_KEY` 或 `ANTHROPIC_API_KEY` - LLM API 密钥（二选一）

### 可选配置
- **向量模型** (独立接口):
  - `EMBEDDING_API_KEY` - 向量模型 API 密钥
  - `EMBEDDING_BASE_URL` - 向量模型接口地址
  - `EMBEDDING_MODEL` - 向量模型名称
- **Home Assistant**:
  - `HOME_ASSISTANT_URL` - HA 实例地址
  - `HOME_ASSISTANT_TOKEN` - HA 访问令牌
- **缓存**:
  - `CACHE_STRATEGY` - 缓存策略 (context_aware 推荐)

**注意**: LLM 和向量模型可以使用不同的接口地址，详见 [docs/env-variables.md](./docs/env-variables.md)

---

## 💡 开发建议

### 从 Demo 开始
```bash
# 不需要 HA，测试所有场景
pnpm dev
curl -X POST http://localhost:3000/api/demo \
  -d '{"message": "我要洗澡了"}'
```

### 逐步集成
1. 测试 Demo 模式验证逻辑
2. 配置 OpenAI API Key
3. 接入 Home Assistant
4. 添加小爱音箱 Webhook

### 扩展新意图
1. 在 `types/index.ts` 添加 `IntentType`
2. 在 `intent.agent.ts` 增加规则/提示
3. 在 `planner.agent.ts` 添加生成逻辑
4. 重启服务测试

---

## 📞 下一步

1. **配置你的 API Key** → `.env`
2. **阅读开发规范** → `.cursor/rules/`
3. **运行第一个请求** → 查看 `docs/QUICKSTART.md`
4. **接入真实环境** → 配置 HA Token

---

*项目已就绪，祝使用愉快！* 🚀

**创建于**: 2025-12-30  
**状态**: ✅ MVP 完成  
**架构**: Node.js + TypeScript + LangGraph
