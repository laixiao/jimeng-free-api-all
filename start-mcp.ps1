# Jimeng Free API MCP Server 启动脚本

# 设置环境变量（替换为你的 session_id）
$env:JIMENG_SESSION_ID = "d9b32ba40c1f33886b452e2c92bce920"

# 方式1: 使用 npx 启动 MCP 服务器（stdio 模式）
# npx @2515097216/jimeng-free-api stdio

# 方式2: 使用 npx 启动 HTTP API 服务器
# npx @2515097216/jimeng-free-api server --port 8000

# 方式3: 使用编译后的命令启动 MCP 服务器
# ./dist/mcp/index.cjs stdio

# 方式4: 使用编译后的命令启动 HTTP API 服务器
# ./dist/mcp/index.cjs server --port 8000

# 推荐的测试方式：先构建，然后运行
Write-Host "构建项目中..."
npm run build

Write-Host ""
Write-Host "======================================"
Write-Host "MCP stdio 模式启动（用于 Claude Desktop 等 MCP 客户端）"
Write-Host "======================================"
& node dist/mcp/index.cjs stdio