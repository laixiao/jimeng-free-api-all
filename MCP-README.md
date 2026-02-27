# Jimeng Free API - MCP 服务器

即梦 AI 免费 API 服务的 MCP 服务器版本，支持本地运行和公网发布。

**版本：** v0.8.6

## 功能特性

- **MCP 协议支持** - 通过 stdio 模式，本地 MCP 客户端可直接调用
- **传统 HTTP API** - 保留完整的 HTTP API 服务
- **双模式并存** - 同时支持 MCP 和 HTTP 两种访问方式
- **多账号轮询** - 支持多个 sessionid 轮询使用

## 快速开始

### 安装

```bash
# 方式1: 从 npm 安装（公网发布）
npm install -g @2515097216/jimeng-free-api

# 方式2: 本地构建使用
git clone https://github.com/your-repo/jimeng-free-api-all.git
cd jimeng-free-api-all
npm install
npm run build
```

### 环境配置

设置即梦网站的 session_id 作为认证令牌：

```bash
# 单账号
export JIMENG_SESSION_ID="your_session_id"

# 多账号轮询（逗号分隔）
export JIMENG_SESSION_ID="session_id_1,session_id_2,session_id_3"
```

### 运行模式

#### 1. MCP stdio 模式

用于 Claude Desktop、Cursor、Windsurf 等支持 MCP 的 AI 客户端：

```bash
# 使用 npx
JIMENG_SESSION_ID=your_session_id npx jimeng-free-api stdio

# 使用编译后的命令
JIMENG_SESSION_ID=your_session_id ./dist/mcp/index.cjs stdio
```

Windows PowerShell:
```powershell
$env:JIMENG_SESSION_ID = "your_session_id"
./dist/mcp/index.cjs stdio
```

#### 2. HTTP API 服务器模式

启动传统的 HTTP API 服务器：

```bash
# 使用 npx
JIMENG_SESSION_ID=your_session_id npx jimeng-free-api server --port 8000

# 使用编译后的命令
JIMENG_SESSION_ID=your_session_id ./dist/mcp/index.cjs server --port 8000

# 指定端口
./dist/mcp/index.cjs server --port 8080
```

## MCP 客户端配置

### Claude Desktop

在 `~/AppData/Local/Claude/claude_desktop_config.json` 中添加：

```json
{
  "mcpServers": {
    "jimeng": {
      "command": "npx",
      "args": ["-y", "jimeng-free-api", "stdio"],
      "env": {
        "JIMENG_SESSION_ID": "your_session_id"
      }
    }
  }
}
```

或使用本地构建版本：

```json
{
  "mcpServers": {
    "jimeng": {
      "command": "node",
      "args": ["path/to/jimeng-free-api-all/dist/mcp/index.cjs", "stdio"],
      "env": {
        "JIMENG_SESSION_ID": "your_session_id"
      }
    }
  }
}
```

### Cursor / Windsurf

在设置中添加 MCP 服务器配置，格式同上。

## MCP 工具

| 工具名 | 功能 | 参数 |
|--------|------|------|
| `generate_image` | 文生图 | model, prompt, ratio, resolution, negative_prompt, sample_strength |
| `compose_images` | 图生图 | model, prompt, images[], ratio, resolution, sample_strength |
| `generate_video` | 视频生成 | model, prompt, ratio, resolution, duration |
| `generate_seedance` | Seedance 2.0 | model, prompt, ratio, duration, file_urls[] |
| `check_token` | 检查 Token | token |
| `get_points` | 查询积分 | token |

### 使用示例

```
请帮我生成一张"赛博朋克城市夜景"的图片，使用 16:9 比例，2k 分辨率
```

```
生成一段"一只小猫在草地上玩耍"的视频，使用 16:9 分辨率
```

```
查询我的账户积分
```

## MCP 资源

| URI | 说明 |
|-----|------|
| `models://image` | 可用图像模型列表 |
| `models://video` | 可用视频模型列表 |
| `models://all` | 所有可用模型 |

## 支持的模型

### 图像模型
- `jimeng-5.0` - 最新 5.0 正式版（推荐）
- `jimeng-4.6` - 4.6 版本
- `jimeng-4.5` - 4.5 版本
- `jimeng-4.1` - 4.1 版本
- `jimeng-4.0` - 4.0 版本
- `jimeng-3.1` - 艺术风格
- `jimeng-3.0` - 通用模型

### 视频模型
- `jimeng-video-3.5-pro` - 最新视频模型
- `jimeng-video-3.0` - 视频生成 3.0
- `jimeng-video-seedance-2.0` - Seedance 2.0 智能视频
- `jimeng-video-seedance-2.0-fast` - Seedance 2.0 快速版

## 参数说明

### 图像生成参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| model | string | jimeng-4.5 | 模型名称 |
| prompt | string | - | 提示词（必填） |
| ratio | string | 1:1 | 宽高比：1:1, 4:3, 3:4, 16:9, 9:16, 3:2, 2:3, 21:9 |
| resolution | string | 2k | 分辨率：1k, 2k, 4k |
| negative_prompt | string | "" | 反向提示词 |
| sample_strength | number | 0.5 | 精细度 0.0-1.0 |

### 视频生成参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| model | string | jimeng-video-3.0 | 模型名称 |
| prompt | string | - | 视频描述 |
| ratio | string | 1:1 | 宽高比：1:1, 4:3, 3:4, 16:9, 9:16 |
| resolution | string | 720p | 分辨率：480p, 720p, 1080p |
| duration | number | 5 | 时长：5-10秒（普通视频），4-15秒（Seedance） |

## 环境变量

| 变量名 | 说明 |
|--------|------|
| `JIMENG_SESSION_ID` | 即梦 session_id（必填） |
| `JIMENG_TOKEN` | JIMENG_SESSION_ID 的别名 |
| `SERVER_PORT` | HTTP 服务器端口（仅 server 模式） |

## 构建命令

```bash
# 构建所有模块（包括 MCP）
npm run build

# 仅构建 MCP 模块
npm run build:mcp

# 开发模式（热重载）
npm run dev
```

## 注意事项

1. 首次使用需设置有效的 `JIMENG_SESSION_ID`
2. MCP 模式下通过环境变量传递 session_id
3. 支持多账号轮询（环境变量中逗号分隔）
4. BrowserService (Playwright) 在 MCP 模式下正常工作

## 获取 session_id

1. 访问 https://jimeng.jianying.com
2. 登录账号
3. 打开浏览器开发者工具 (F12)
4. 切换到 Application/Application 选项卡
5. 找到 Cookies > https://jimeng.jianying.com
6. 复制 sid_guard 或 sessionid 的值