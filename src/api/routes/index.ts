import fs from 'fs-extra';
import path from "path";
import mime from "mime";

import Response from '@/lib/response/Response.ts';
import config from "@/lib/config.ts";
import Request from "@/lib/request/Request.ts";
import images from "./images.ts";
import chat from "./chat.ts";
import ping from "./ping.ts";
import token from './token.js';
import models from './models.ts';
import videos from './videos.ts';
import video from './video.ts';

export default [
    {
        get: {
            '/': async () => {
                const content = await fs.readFile('public/welcome.html');
                return new Response(content, {
                    type: 'html',
                    headers: {
                        Expires: '-1'
                    }
                });
            },
            '/public/(.*)': async (request: Request) => {
                const rawPath = decodeURIComponent(request.params[0] || "").replace(/^[/\\]+/, "");
                if (!rawPath) throw new Error("文件路径不能为空");

                const root = path.resolve(config.system.publicDirPath);
                const filePath = path.resolve(root, rawPath);
                const relative = path.relative(root, filePath);
                if (relative.startsWith("..") || path.isAbsolute(relative)) {
                    throw new Error("非法文件路径");
                }
                if (!await fs.pathExists(filePath)) {
                    throw new Error("文件不存在");
                }

                return new Response(fs.createReadStream(filePath), {
                    type: mime.getType(filePath) || "application/octet-stream",
                    headers: {
                        "Cache-Control": "public, max-age=31536000, immutable",
                    },
                });
            }
        }
    },
    images,
    chat,
    ping,
    token,
    models,
    videos,
    video
];
