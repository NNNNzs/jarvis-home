# 🚀 快速开始指南

## 📋 前置要求

- ✅ **Node.js 18+** (推荐使用 nvm 管理版本)
- ✅ **pnpm** (项目包管理器)
- ✅ **OpenAI API Key** (必需)
- ✅ **Home Assistant** (可选，Demo模式可跳过)

## 1️⃣ 安装项目

```bash
cd JustARatherVeryIntelligentSystem
pnpm install
```

## 2️⃣ 配置环境变量

### 方式 A: 快速测试 (Demo模式)
```bash
# 只需配置 LLM，HA 可选
echo "OPENAI_API_KEY=sk-your-key" > .env
```

### 方式 B: 完整配置
```bash
# 复制模板
cp .env.example .env

# 编辑 .env 填充以下配置:
# - OPENAI_API_KEY (必需)
# - HOME_ASSISTANT_TOKEN (可选，如需真实设备)
# - 其他按需配置
```

### 如何获取 API Key
- 访问 [OpenAI Platform](https://platform.openai.com/api-keys)
- 创建新的 Secret Key
- 复制到 `.env` 文件

### 如何获取 HA Token
1. 登录 Home Assistant
2. 点击左上角头像 → 配置
3. 进入 "安全" 标签页
4. 滚动到 "长生命周期访问令牌"
5. 创建新令牌，复制保存

## 3️⃣ 启动开发服务器

```bash
pnpm dev
```

看到类似输出表示成功:
```
✅ 组件初始化完成
🚀 启动成功
访问: http://localhost:3000
```

## 4️⃣ 测试系统

### 测试 1: 健康检查
```bash
curl http://localhost:3000/api/health
# 期望: {"status":"healthy"...}
```

### 测试 2: Demo 模式 (推荐)
```bash
curl -X POST http://localhost:3000/api/demo \
  -H "Content-Type: application/json" \
  -d '{"message": "我要洗澡了"}'
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "intent": "bath_prepare",
    "context": { ... },
    "plan": {
      "planId": "demo_bath_17236...",
      "steps": [
        {
          "service": "switch.turn_on",
          "entityId": "switch.water_heater",
          "targetName": "燃气热水器",
          "description": "开启燃气热水器预热"
        },
        ...
      ]
    },
    "execution": {
      "planId": "demo_bath_...",
      "status": "success",
      "steps": [ ... ]
    }
  }
}
```

### 测试 3: 真实模式 (配置了 HA)
```bash
curl -X POST http://localhost:3000/api/intent \
  -H "Content-Type: application/json" \
  -d '{"message": "我要洗澡了"}'
```

### 测试 4: 查看系统状态
```bash
curl http://localhost:3000/api/status
```

## 5️⃣ 常用命令

```bash
# 开发模式 (热重载)
pnpm dev

# 构建生产版
pnpm build

# 运行生产版
pnpm start

# 查看所有 API
curl http://localhost:3000/
```

## 6️⃣ 项目结构浏览

```
JustARatherVeryIntelligentSystem/
├── src/
│   ├── agents/          # 三大智能体
│   │   ├── intent.ts    # 意图
│   │   ├── context.ts   # 状态
│   │   └── planner.ts   # 计划
│   ├── services/        # 服务层
│   │   ├── llm.ts       # AI 大脑
│   │   ├── homeassistant.ts  # 设备控制
│   │   └── cache.ts     # 流程缓存
│   ├── api/             # HTTP 接口
│   ├── orchestrator.ts  # 流程编排
│   └── app.ts          # 入口
├── .cursor/rules/       # AI 开发规范
├── docs/                # 文档
└── .env.example         # 配置模板
```

## 🎯 下一步

### 真实设备集成
1. 确保 HA 运行并可访问
2. 创建长生命周期 Token
3. 填充 `.env` 中的 HA 配置
4. 重启服务并测试真实模式

### 小爱音箱接入 (米家)
1. 打开米家 App
2. 创建智能场景
3. 触发条件: 语音"我要洗澡了"
4. 执行动作: Webhook → `http://你的服务/api/intent`

### 开发新意图
1. 在 `src/types/index.ts` 添加 IntentType
2. 在 `src/agents/intent.agent.ts` 增加规则 (可选)
3. 在 `src/orchestrator.ts` 添加生成计划的逻辑
4. 重启服务测试

## 🔧 故障排除

### ❌ 提示: OPENAI_API_KEY 错误
```
原因: 没有配置 API Key
解决: 在 .env 文件中填入 OPENAI_API_KEY
```

### ❌ 提示: Home Assistant 连接失败
```
原因: HA 未启动或 Token 无效
解决:
1. 检查 HA 是否运行: curl http:// homeassistant.local:8123
2. Token 是否有权限 (非临时Token)
3. 在 Demo 模式下运行也可工作
```

### ❌ 端口 3000 被占用
```bash
# 修改 .env
PORT=3001

# 或启动时指定
PORT=3001 pnpm dev
```

### ❌ TypeScript 编译错误
```bash
pnpm build
# 查看具体错误，通常是:
# - 缺少依赖 → pnpm install
# - 类型错误 → 检查类型定义
```

## 📚 更多资源

- **架构设计**: `.cursor/rules/arch-decision.mdc`
- **开发规范**: `.cursor/rules/project-guidelines.mdc`
- **LLM 集成**: `.cursor/rules/llm-integration.mdc`
- **HA 集成**: `.cursor/rules/home-assistant.mdc`

## 💡 提示

1. **从 Demo 开始**: 先用 Demo 模式测试所有意图，再接入真实设备
2. **逐步迭代**: 先跑通一个完整流程，再扩展更多设备
3. **备份配置**: 经常备份 `.env` 文件
4. **查看日志**: 关注控制台输出，有助调试

---

**完成初始化!** 🎉

现在你已经有了一个可运行的多智能体系统，下一步是:
1. 测试不同输入场景
2. 接入真实 Home Assistant
3. 定制你自己的意图和设备

有问题随时回来查看文档，或添加新的 `.cursor/rules` 记录你的经验。
