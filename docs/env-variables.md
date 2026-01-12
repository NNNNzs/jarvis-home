# 环境变量配置说明

本文档详细说明 JARVIS Home 系统所需的所有环境变量。

## 📋 快速参考

### 最小配置（仅测试）
```bash
# LLM 服务（必需，二选一）
OPENAI_API_KEY=sk-your-key-here
# 或
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### 完整配置（生产环境）
```bash
# LLM 服务
ANTHROPIC_API_KEY=sk-ant-your-key-here
ANTHROPIC_BASE_URL=  # 可选，自定义接口地址

# 向量模型服务（独立接口）
EMBEDDING_API_KEY=your-embedding-key-here
EMBEDDING_BASE_URL=https://api.siliconflow.cn/v1
EMBEDDING_MODEL=BAAI/bge-large-zh-v1.5

# Home Assistant
HOME_ASSISTANT_URL=http://homeassistant.local:8123
HOME_ASSISTANT_TOKEN=your-ha-token-here
```

---

## 🔧 详细配置

### 1. 服务器配置

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `PORT` | number | `3000` | 服务监听端口 |
| `NODE_ENV` | string | `development` | 运行环境：`development` 或 `production` |
| `ALLOWED_ORIGINS` | string | `*` | CORS 允许的来源，多个用逗号分隔 |

**示例**:
```bash
PORT=3000
NODE_ENV=production
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

---

### 2. LLM 服务配置

LLM 服务用于**意图识别**和**行为规划**。支持两种提供商，**可以同时配置，通过 `LLM_PROVIDER` 环境变量明确指定使用哪个**。

| 变量名 | 类型 | 必需 | 说明 |
|--------|------|------|------|
| `LLM_PROVIDER` | string | ❌ | 明确指定使用的提供商：`anthropic` 或 `openai`。如果未指定，按优先级自动选择 |
| `ANTHROPIC_API_KEY` | string | 条件 | Anthropic API 密钥（使用 Anthropic 时必需） |
| `ANTHROPIC_BASE_URL` | string | ❌ | Anthropic 自定义接口地址（如使用代理或兼容 API） |
| `OPENAI_API_KEY` | string | 条件 | OpenAI API 密钥（使用 OpenAI 时必需） |
| `OPENAI_BASE_URL` | string | ❌ | OpenAI 自定义接口地址（如使用代理或兼容 API） |
| `LLM_MODEL` | string | ❌ | 模型名称。未设置时使用默认值：Anthropic 为 `claude-3-5-sonnet-20241022`，OpenAI 为 `gpt-4o-mini` |

#### 选项 A: Anthropic Claude

**默认模型**: 如果未设置 `LLM_MODEL`，将使用 `claude-3-5-sonnet-20241022`

**示例**:
```bash
# 明确指定使用 Anthropic
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-your-key-here
ANTHROPIC_BASE_URL=https://api.anthropic.com  # 可选，支持自定义接口
LLM_MODEL=claude-3-5-sonnet-20241022  # 可选，未设置时使用默认值
```

#### 选项 B: OpenAI

**默认模型**: 如果未设置 `LLM_MODEL`，将使用 `gpt-4o-mini`

**示例**:
```bash
# 明确指定使用 OpenAI
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
OPENAI_BASE_URL=https://api.openai.com/v1  # 可选，支持自定义接口
LLM_MODEL=gpt-4o-mini  # 可选，未设置时使用默认值
```

#### 同时配置两个提供商

如果同时配置了两个 API Key，**必须通过 `LLM_PROVIDER` 明确指定使用哪个**：

```bash
# 同时配置两个，明确指定使用 OpenAI
LLM_PROVIDER=openai
ANTHROPIC_API_KEY=sk-ant-your-key-here
ANTHROPIC_BASE_URL=https://proxy.example.com/v1  # 自定义代理
OPENAI_API_KEY=sk-your-key-here
OPENAI_BASE_URL=https://api.openai.com/v1
```

**自动选择逻辑**（当未设置 `LLM_PROVIDER` 时）:
- 如果只配置了 `ANTHROPIC_API_KEY`，使用 Anthropic
- 如果只配置了 `OPENAI_API_KEY`，使用 OpenAI
- 如果两个都配置了，优先使用 Anthropic（**建议明确指定 `LLM_PROVIDER`**）

**重要提示**:
- ✅ 两个提供商都**支持自定义 baseURL**（通过代理或兼容 API）
- ✅ 可以同时配置两个 API Key，通过 `LLM_PROVIDER` 切换
- ⚠️ 如果同时配置但未指定 `LLM_PROVIDER`，会按优先级自动选择

---

### 3. 向量模型配置（Embeddings）

向量模型用于**文本嵌入**和**相似度搜索**。**可以与 LLM 使用不同的接口地址**。

| 变量名 | 类型 | 必需 | 说明 |
|--------|------|------|------|
| `EMBEDDING_API_KEY` | string | ✅ | 向量模型 API 密钥 |
| `EMBEDDING_BASE_URL` | string | ✅ | 向量模型接口地址 |
| `EMBEDDING_MODEL` | string | ✅ | 向量模型名称 |
| `EMBEDDING_PROVIDER` | string | ❌ | 提供商：`openai` 或 `siliconflow`，默认根据 baseURL 推断 |
| `EMBEDDING_DIMENSIONS` | number | ❌ | 向量维度（某些模型支持） |

**示例 - SiliconFlow**:
```bash
EMBEDDING_API_KEY=your-siliconflow-key-here
EMBEDDING_BASE_URL=https://api.siliconflow.cn/v1
EMBEDDING_MODEL=BAAI/bge-large-zh-v1.5
EMBEDDING_PROVIDER=siliconflow
EMBEDDING_DIMENSIONS=1024  # 可选
```

**示例 - OpenAI**:
```bash
EMBEDDING_API_KEY=sk-your-openai-key-here
EMBEDDING_BASE_URL=https://api.openai.com/v1
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_PROVIDER=openai
```

**注意**: 
- Embeddings 服务是**可选的**，如果未配置，相关功能将不可用
- 可以与 LLM 使用完全不同的接口和 API Key

---

### 4. Home Assistant 配置

Home Assistant 用于**设备状态获取**和**设备控制**。

| 变量名 | 类型 | 必需 | 说明 |
|--------|------|------|------|
| `HOME_ASSISTANT_URL` | string | ✅ | Home Assistant 实例地址 |
| `HOME_ASSISTANT_TOKEN` | string | ✅ | 长生命周期访问令牌 |

**示例**:
```bash
HOME_ASSISTANT_URL=http://homeassistant.local:8123
HOME_ASSISTANT_TOKEN=your-long-lived-access-token-here
```

**获取 Token**:
1. 登录 Home Assistant
2. 进入 "用户配置" → "安全"
3. 创建 "长生命周期访问令牌"
4. 复制到 `.env` 文件

**注意**: 如果未配置，系统将运行在**演示模式**（不控制真实设备）。

---

### 5. 缓存配置

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `CACHE_STRATEGY` | string | `context_aware` | 缓存策略：`simple` 或 `context_aware` |
| `CACHE_TTL` | number | `3600` | 缓存过期时间（秒），默认 1 小时 |
| `CACHE_MAX_SIZE` | number | `50` | 缓存最大条目数 |

**示例**:
```bash
CACHE_STRATEGY=context_aware
CACHE_TTL=3600
CACHE_MAX_SIZE=50
```

---

## 🎯 配置场景示例

### 场景 1: 最小测试配置
```bash
# 仅 LLM，演示模式
OPENAI_API_KEY=sk-your-key-here
```

### 场景 2: LLM 和 Embeddings 使用不同接口
```bash
# 明确指定使用 OpenAI
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-openai-key-here
OPENAI_BASE_URL=https://api.openai.com/v1

# Embeddings 使用 SiliconFlow（不同接口）
EMBEDDING_API_KEY=sk-siliconflow-key-here
EMBEDDING_BASE_URL=https://api.siliconflow.cn/v1
EMBEDDING_MODEL=BAAI/bge-large-zh-v1.5
```

### 场景 2.1: 同时配置两个 LLM 提供商，通过环境变量切换
```bash
# 明确指定使用 Anthropic（通过自定义代理）
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-key-here
ANTHROPIC_BASE_URL=https://proxy.example.com/v1  # 自定义代理地址

# 也配置了 OpenAI（备用）
OPENAI_API_KEY=sk-openai-key-here
OPENAI_BASE_URL=https://api.openai.com/v1
```

### 场景 3: 完整生产配置
```bash
# 服务器
PORT=3000
NODE_ENV=production
ALLOWED_ORIGINS=https://yourdomain.com

# LLM (明确指定使用 Anthropic)
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-key-here
ANTHROPIC_BASE_URL=https://api.anthropic.com  # 可选，自定义接口
LLM_MODEL=claude-3-5-sonnet-20241022

# Embeddings (SiliconFlow)
EMBEDDING_API_KEY=sk-sf-key-here
EMBEDDING_BASE_URL=https://api.siliconflow.cn/v1
EMBEDDING_MODEL=BAAI/bge-large-zh-v1.5

# Home Assistant
HOME_ASSISTANT_URL=http://192.168.1.100:8123
HOME_ASSISTANT_TOKEN=your-ha-token-here

# 缓存
CACHE_STRATEGY=context_aware
CACHE_TTL=3600
CACHE_MAX_SIZE=100
```

---

## ⚠️ 重要提示

1. **LLM 和 Embeddings 可以独立配置**
   - 可以使用不同的 API Key
   - 可以使用不同的接口地址（baseURL）
   - 可以使用不同的提供商

2. **必需 vs 可选**
   - **必需**: LLM 服务（`OPENAI_API_KEY` 或 `ANTHROPIC_API_KEY`）
   - **可选**: Embeddings 服务、Home Assistant

3. **环境变量优先级**
   - 如果设置了 `LLM_PROVIDER`，严格按照指定值使用
   - 如果未设置 `LLM_PROVIDER`，自动选择：`ANTHROPIC_API_KEY` > `OPENAI_API_KEY`
   - 如果未配置任何 LLM API Key，系统无法启动

4. **安全建议**
   - 不要将 `.env` 文件提交到版本控制
   - 生产环境使用环境变量或密钥管理服务
   - 定期轮换 API Key

---

## 📝 创建 .env 文件

1. 在项目根目录创建 `.env` 文件：
   ```bash
   touch .env
   ```

2. 复制上述配置示例，填入实际值

3. 验证配置：
   ```bash
   # 启动服务，查看初始化日志
   pnpm dev
   ```

---

## 🔍 故障排查

### 问题: LLM 服务未初始化
- 检查是否配置了 `OPENAI_API_KEY` 或 `ANTHROPIC_API_KEY`
- 检查 API Key 是否有效

### 问题: Embeddings 服务未初始化
- 检查是否配置了 `EMBEDDING_API_KEY`、`EMBEDDING_BASE_URL` 和 `EMBEDDING_MODEL`
- 注意：Embeddings 服务是可选的，未配置不影响基本功能

### 问题: Home Assistant 连接失败
- 检查 `HOME_ASSISTANT_URL` 是否正确
- 检查 `HOME_ASSISTANT_TOKEN` 是否有效
- 检查网络连接

### 问题: 接口地址错误
- 确保 `BASE_URL` 包含协议（`http://` 或 `https://`）
- 确保 `BASE_URL` 包含路径（如 `/v1`）
- 检查代理或防火墙设置

---

**最后更新**: 2025-12-30
