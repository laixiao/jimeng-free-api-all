#!/usr/bin/env node
/**
 * MCP CLI Entry Point
 * Supports two modes:
 * - stdio: Run as MCP server (for MCP clients like Claude Desktop)
 * - server: Run as HTTP API server (original Koa server)
 */

import JimengMCPServer from "./server.ts";
import environment from "../lib/environment.ts";
import config from "../lib/config.ts";
import "../lib/initialize.ts";
import server from "../lib/server.ts";
import routes from "../api/routes/index.ts";
import logger from "../lib/logger.ts";

const USAGE = `
jimeng-mcp - Jimeng AI Free API MCP Server

Usage:
  jimeng-mcp stdio              Run as MCP server (stdio mode)
  jimeng-mcp server [options]   Run as HTTP API server

Options for server mode:
  --port <number>               HTTP server port (default: 8000 or from config)

Environment Variables:
  JIMENG_SESSION_ID             Session ID(s) for API access (comma-separated for multiple)
  JIMENG_TOKEN                  Alias for JIMENG_SESSION_ID
  SERVER_PORT                   HTTP server port

Examples:
  # Run MCP server
  JIMENG_SESSION_ID=your_session_id npx jimeng-mcp stdio

  # Run HTTP API server
  JIMENG_SESSION_ID=your_session_id npx jimeng-mcp server --port 8000

  # Run with multiple accounts
  JIMENG_SESSION_ID=id1,id2,id3 npx jimeng-mcp stdio
`;

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(USAGE);
    process.exit(0);
  }

  const mode = args[0];

  if (mode === "stdio") {
    // Run as MCP server
    logger.info("Starting MCP server in stdio mode...");
    const mcpServer = new JimengMCPServer();
    await mcpServer.run();
  } else if (mode === "server") {
    // Run as HTTP API server
    const portArg = args.find((_, i) => args[i - 1] === "--port");
    if (portArg) {
      process.env.SERVER_PORT = portArg;
    }

    logger.header();
    logger.info("<<<< jimeng free server >>>>");
    logger.info("Version:", environment.package.version);
    logger.info("Process id:", process.pid);
    logger.info("Environment:", environment.env);
    logger.info("Service name:", config.service.name);

    server.attachRoutes(routes);
    await server.listen();

    config.service.bindAddress &&
      logger.success("Service bind address:", config.service.bindAddress);

    logger.success(
      `Service startup completed`
    );
  } else {
    console.error(`Unknown command: ${mode}`);
    console.log(USAGE);
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});