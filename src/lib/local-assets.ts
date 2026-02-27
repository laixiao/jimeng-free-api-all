import path from "path";

import axios from "axios";
import fs from "fs-extra";

import config from "@/lib/config.ts";
import util from "@/lib/util.ts";
import logger from "@/lib/logger.ts";

function resolveExtension(sourceUrl: string, contentType?: string, fallback = "bin") {
  if (contentType) {
    const ext = util.mimeToExtension(contentType.split(";")[0].trim());
    if (ext) return ext;
  }
  const urlExt = util.extractURLExtension(sourceUrl);
  if (urlExt) return urlExt;
  return fallback;
}

function normalizePrefix(prefix = "") {
  if (!prefix) return "";
  return prefix.startsWith("/") ? prefix : `/${prefix}`;
}

export function buildPublicBaseUrl(headers: any = {}) {
  const forwardedProto = headers["x-forwarded-proto"];
  const forwardedHost = headers["x-forwarded-host"];
  const host = forwardedHost || headers.host;
  if (!host) return null;
  const protocol = forwardedProto || "http";
  return `${protocol}://${host}${normalizePrefix(config.service.urlPrefix)}`;
}

export async function saveRemoteAssetToLocalUrl(
  remoteUrl: string,
  assetType: "images" | "videos" = "images",
  publicBaseUrl?: string | null
) {
  const { relativePath } = await saveRemoteAssetToLocalPath(remoteUrl, assetType);

  const baseUrl = publicBaseUrl || `${config.service.publicDirUrl.replace(/\/public$/, "")}${normalizePrefix(config.service.urlPrefix)}`;
  const localUrl = `${baseUrl}/public/${relativePath}`;

  logger.info(`asset localized: ${remoteUrl} -> ${localUrl}`);
  return localUrl;
}

export async function saveRemoteAssetToLocalPath(
  remoteUrl: string,
  assetType: "images" | "videos" = "images"
) {
  const response = await axios.get(remoteUrl, {
    responseType: "arraybuffer",
    timeout: 120000,
  });

  const ext = resolveExtension(
    remoteUrl,
    response.headers["content-type"],
    assetType === "videos" ? "mp4" : "png"
  );
  const dateDir = util.getDateString("yyyyMMdd");
  const relativePath = path.posix.join("generated", assetType, dateDir, `${util.uuid(false)}.${ext}`);
  const outputPath = path.join(config.system.publicDirPath, ...relativePath.split("/"));

  await fs.ensureDir(path.dirname(outputPath));
  await fs.writeFile(outputPath, response.data);

  return { outputPath, relativePath };
}

export async function saveRemoteAssetsToLocalUrls(
  remoteUrls: string[],
  assetType: "images" | "videos" = "images",
  publicBaseUrl?: string | null
) {
  return Promise.all(remoteUrls.map((url) => saveRemoteAssetToLocalUrl(url, assetType, publicBaseUrl)));
}

export async function saveRemoteAssetsToLocalPaths(
  remoteUrls: string[],
  assetType: "images" | "videos" = "images"
) {
  return Promise.all(remoteUrls.map((url) => saveRemoteAssetToLocalPath(url, assetType)));
}
