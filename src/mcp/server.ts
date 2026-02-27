/**
 * MCP Server Implementation
 * Provides tools for jimeng AI image and video generation
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { pathToFileURL } from "url";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { generateImages, generateImageComposition, DEFAULT_MODEL as IMAGE_DEFAULT_MODEL } from "../api/controllers/images.ts";
import { generateVideo, generateSeedanceVideo, DEFAULT_MODEL as VIDEO_DEFAULT_MODEL } from "../api/controllers/videos.ts";
import { getCredit, checkResult } from "../api/controllers/core.ts";
import { getModelConfig, MODEL_CONFIGS } from "../lib/configs/model-config.ts";
import { saveRemoteAssetToLocalPath, saveRemoteAssetsToLocalPaths } from "../lib/local-assets.ts";
import logger from "../lib/logger.ts";

// Token from environment
let sessionIds: string[] = [];

/**
 * Initialize session IDs from environment variable
 */
function initSessionIds() {
  const envToken = process.env.JIMENG_SESSION_ID || process.env.JIMENG_TOKEN;
  if (envToken) {
    sessionIds = envToken.split(",").map(t => t.trim()).filter(t => t);
    logger.info(`MCP: Loaded ${sessionIds.length} session ID(s) from environment`);
  }
}

/**
 * Get a random session ID for requests
 */
function getSessionId(): string {
  if (sessionIds.length === 0) {
    throw new Error("No session ID configured. Set JIMENG_SESSION_ID environment variable.");
  }
  return sessionIds[Math.floor(Math.random() * sessionIds.length)];
}

// Tool definitions
const TOOLS = [
  {
    name: "generate_image",
    description: "Generate images from text prompt (text-to-image). Supports jimeng-5.0, jimeng-4.6, jimeng-4.5 and other models.",
    inputSchema: {
      type: "object",
      properties: {
        model: {
          type: "string",
          description: "Model name (e.g., jimeng-5.0, jimeng-4.6, jimeng-4.5). Default: jimeng-4.5",
          default: "jimeng-4.5",
        },
        prompt: {
          type: "string",
          description: "Text prompt describing the image to generate",
        },
        ratio: {
          type: "string",
          description: "Aspect ratio: 1:1, 4:3, 3:4, 16:9, 9:16, 3:2, 2:3, 21:9. Default: 1:1",
          default: "1:1",
        },
        resolution: {
          type: "string",
          description: "Resolution: 1k, 2k, 4k. Default: 2k",
          default: "2k",
        },
        negative_prompt: {
          type: "string",
          description: "Negative prompt - things to avoid in the image",
          default: "",
        },
        sample_strength: {
          type: "number",
          description: "Sampling strength (refinement). Range: 0.0-1.0. Default: 0.5",
          default: 0.5,
        },
        n: {
          type: "number",
          description: "Number of images to generate (1-10). Default: 1",
          default: 1,
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "compose_images",
    description: "Compose/generate images from existing images (image-to-image). Supports 1-10 input images for multi-image composition.",
    inputSchema: {
      type: "object",
      properties: {
        model: {
          type: "string",
          description: "Model name (e.g., jimeng-5.0, jimeng-4.6, jimeng-4.5). Default: jimeng-4.5",
          default: "jimeng-4.5",
        },
        prompt: {
          type: "string",
          description: "Text prompt describing how to compose/transform the images",
        },
        images: {
          type: "array",
          items: { type: "string" },
          description: "Array of image URLs (1-10 images)",
        },
        ratio: {
          type: "string",
          description: "Aspect ratio: 1:1, 4:3, 3:4, 16:9, 9:16, 3:2, 2:3, 21:9. Default: 1:1",
          default: "1:1",
        },
        resolution: {
          type: "string",
          description: "Resolution: 1k, 2k, 4k. Default: 2k",
          default: "2k",
        },
        sample_strength: {
          type: "number",
          description: "Sampling strength (transformation intensity). Range: 0.0-1.0. Default: 0.5",
          default: 0.5,
        },
      },
      required: ["prompt", "images"],
    },
  },
  {
    name: "generate_video",
    description: "Generate video from text prompt. Supports jimeng-video-3.5-pro, jimeng-video-3.0 and other video models.",
    inputSchema: {
      type: "object",
      properties: {
        model: {
          type: "string",
          description: "Video model: jimeng-video-3.5-pro, jimeng-video-3.0, jimeng-video-3.0-pro, jimeng-video-2.0, jimeng-video-2.0-pro. Default: jimeng-video-3.0",
          default: "jimeng-video-3.0",
        },
        prompt: {
          type: "string",
          description: "Text prompt describing the video content",
        },
        ratio: {
          type: "string",
          description: "Aspect ratio: 1:1, 4:3, 3:4, 16:9, 9:16. Default: 1:1",
          default: "1:1",
        },
        resolution: {
          type: "string",
          description: "Resolution: 480p, 720p, 1080p. Default: 720p",
          default: "720p",
        },
        duration: {
          type: "number",
          description: "Video duration in seconds: 5 or 10 for regular video, 4-15 for Seedance. Default: 5",
          default: 5,
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "generate_seedance",
    description: "Generate video using Seedance 2.0 model. Supports multi-modal input (images, videos, audio) for intelligent video generation. Use @1, @2 placeholders to reference uploaded files in the prompt.",
    inputSchema: {
      type: "object",
      properties: {
        model: {
          type: "string",
          description: "Seedance model: jimeng-video-seedance-2.0, seedance-2.0, seedance-2.0-pro, jimeng-video-seedance-2.0-fast, seedance-2.0-fast. Default: jimeng-video-seedance-2.0",
          default: "jimeng-video-seedance-2.0",
        },
        prompt: {
          type: "string",
          description: "Text prompt. Use @1, @2 or @图1, @图2 to reference uploaded files. Example: '@1 and @2 start dancing together'",
        },
        ratio: {
          type: "string",
          description: "Aspect ratio: 1:1, 4:3, 3:4, 16:9, 9:16. Default: 4:3",
          default: "4:3",
        },
        duration: {
          type: "number",
          description: "Video duration in seconds: 4-15. Default: 4",
          default: 4,
        },
        file_urls: {
          type: "array",
          items: { type: "string" },
          description: "Array of input file URLs (images/videos/audio). These can be referenced in prompt using @1, @2, etc.",
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "check_token",
    description: "Check if a jimeng session token is valid",
    inputSchema: {
      type: "object",
      properties: {
        token: {
          type: "string",
          description: "The session token to check",
        },
      },
      required: ["token"],
    },
  },
  {
    name: "get_points",
    description: "Get the remaining points/credits for a jimeng account",
    inputSchema: {
      type: "object",
      properties: {
        token: {
          type: "string",
          description: "The session token (optional, uses configured token if not provided)",
        },
      },
    },
  },
];

// Resource definitions
const RESOURCES = [
  {
    uri: "models://image",
    name: "Image Models",
    description: "List of available image generation models",
    mimeType: "application/json",
  },
  {
    uri: "models://video",
    name: "Video Models",
    description: "List of available video generation models",
    mimeType: "application/json",
  },
  {
    uri: "models://all",
    name: "All Models",
    description: "List of all available models",
    mimeType: "application/json",
  },
];

class JimengMCPServer {
  private server: Server;

  constructor() {
    initSessionIds();

    this.server = new Server(
      {
        name: "jimeng-free-api",
        version: "0.8.6",
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: TOOLS };
    });

    // Call tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      return this.handleToolCall(request.params.name, request.params.arguments);
    });

    // List resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return { resources: RESOURCES };
    });

    // Read resource
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      return this.handleResourceRead(request.params.uri);
    });
  }

  private async handleToolCall(toolName: string, args: any) {
    try {
      switch (toolName) {
        case "generate_image": {
          const result = await generateImages(
            args.model || IMAGE_DEFAULT_MODEL,
            args.prompt,
            {
              ratio: args.ratio || "1:1",
              resolution: args.resolution || "2k",
              sampleStrength: args.sample_strength ?? 0.5,
              negativePrompt: args.negative_prompt || "",
              n: args.n ?? 1,
            },
            getSessionId()
          );
          const localFiles = await saveRemoteAssetsToLocalPaths(result, "images");
          const localUrls = localFiles.map((f) => pathToFileURL(f.outputPath).toString());
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  urls: localUrls,
                  local_paths: localFiles.map((f) => f.outputPath),
                }, null, 2),
              },
            ],
          };
        }

        case "compose_images": {
          if (!args.images || !Array.isArray(args.images) || args.images.length === 0) {
            throw new Error("images array is required and must contain at least 1 image URL");
          }
          const result = await generateImageComposition(
            args.model || IMAGE_DEFAULT_MODEL,
            args.prompt,
            args.images,
            {
              ratio: args.ratio || "1:1",
              resolution: args.resolution || "2k",
              sampleStrength: args.sample_strength ?? 0.5,
            },
            getSessionId()
          );
          const localFiles = await saveRemoteAssetsToLocalPaths(result, "images");
          const localUrls = localFiles.map((f) => pathToFileURL(f.outputPath).toString());
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  urls: localUrls,
                  local_paths: localFiles.map((f) => f.outputPath),
                }, null, 2),
              },
            ],
          };
        }

        case "generate_video": {
          const result = await generateVideo(
            args.model || VIDEO_DEFAULT_MODEL,
            args.prompt || "",
            {
              ratio: args.ratio || "1:1",
              resolution: args.resolution || "720p",
              duration: args.duration || 5,
              filePaths: args.file_paths || [],
            },
            getSessionId()
          );
          const localFile = await saveRemoteAssetToLocalPath(result, "videos");
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  url: pathToFileURL(localFile.outputPath).toString(),
                  local_path: localFile.outputPath,
                }, null, 2),
              },
            ],
          };
        }

        case "generate_seedance": {
          const result = await generateSeedanceVideo(
            args.model || "jimeng-video-seedance-2.0",
            args.prompt || "",
            {
              ratio: args.ratio || "4:3",
              duration: args.duration || 4,
              filePaths: args.file_urls || [],
            },
            getSessionId()
          );
          const localFile = await saveRemoteAssetToLocalPath(result, "videos");
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  url: pathToFileURL(localFile.outputPath).toString(),
                  local_path: localFile.outputPath,
                }, null, 2),
              },
            ],
          };
        }

        case "check_token": {
          const token = args.token || getSessionId();
          const result = await checkResult({ data: { code: 0 } } as any);
          const credit = await getCredit(token);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  valid: credit.totalCredit > 0 || credit.rewardCredit > 0,
                  points: credit.totalCredit,
                  rewardPoints: credit.rewardCredit,
                }, null, 2),
              },
            ],
          };
        }

        case "get_points": {
          const token = args.token || getSessionId();
          const credit = await getCredit(token);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  totalPoints: credit.totalCredit,
                  rewardPoints: credit.rewardCredit,
                  total: credit.totalCredit + credit.rewardCredit,
                }, null, 2),
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error: any) {
      logger.error(`MCP Tool Error [${toolName}]:`, error.message);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  private handleResourceRead(uri: string) {
    const imageModels = [
      "jimeng-5.0", "jimeng-4.6", "jimeng-4.5", "jimeng-4.1", "jimeng-4.0",
      "jimeng-3.1", "jimeng-3.0", "jimeng-2.1", "jimeng-2.0-pro", "jimeng-2.0", "jimeng-1.4", "jimeng-xl-pro"
    ];

    const videoModels = [
      "jimeng-video-3.5-pro", "jimeng-video-3.0", "jimeng-video-3.0-pro",
      "jimeng-video-2.0", "jimeng-video-2.0-pro",
      "jimeng-video-seedance-2.0", "seedance-2.0", "seedance-2.0-pro",
      "jimeng-video-seedance-2.0-fast", "seedance-2.0-fast"
    ];

    let data: any;
    if (uri === "models://image") {
      data = imageModels;
    } else if (uri === "models://video") {
      data = videoModels;
    } else if (uri === "models://all") {
      data = {
        image: imageModels,
        video: videoModels,
      };
    } else {
      throw new Error(`Unknown resource: ${uri}`);
    }

    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info("MCP Server started (stdio mode)");
  }
}

export default JimengMCPServer;
