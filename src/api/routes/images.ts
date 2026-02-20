import fs from "fs";
import _ from "lodash";

import Request from "@/lib/request/Request.ts";
import { generateImages, generateImageComposition } from "@/api/controllers/images.ts";
import { tokenSplit } from "@/api/controllers/core.ts";
import util from "@/lib/util.ts";

export default {
  prefix: "/v1/images",

  post: {
    "/generations": async (request: Request) => {
      // 检查是否使用了不支持的参数
      const unsupportedParams = ['size', 'width', 'height'];
      const bodyKeys = Object.keys(request.body);
      const foundUnsupported = unsupportedParams.filter(param => bodyKeys.includes(param));

      if (foundUnsupported.length > 0) {
        throw new Error(`不支持的参数: ${foundUnsupported.join(', ')}。请使用 ratio 和 resolution 参数控制图像尺寸。`);
      }

      const contentType = request.headers['content-type'] || '';
      const isMultiPart = contentType.startsWith('multipart/form-data');

      // 根据请求类型进行不同的参数验证
      if (isMultiPart) {
        request
          .validate("body.model", v => _.isUndefined(v) || _.isString(v))
          .validate("body.prompt", _.isString)
          .validate("body.negative_prompt", v => _.isUndefined(v) || _.isString(v))
          .validate("body.ratio", v => _.isUndefined(v) || _.isString(v))
          .validate("body.resolution", v => _.isUndefined(v) || _.isString(v))
          .validate("body.intelligent_ratio", v => _.isUndefined(v) || (typeof v === 'string' && (v === 'true' || v === 'false')) || _.isBoolean(v))
          .validate("body.sample_strength", v => _.isUndefined(v) || (typeof v === 'string' && !isNaN(parseFloat(v))) || _.isFinite(v))
          .validate("body.response_format", v => _.isUndefined(v) || _.isString(v))
          .validate("headers.authorization", _.isString);
      } else {
        request
          .validate("body.model", v => _.isUndefined(v) || _.isString(v))
          .validate("body.prompt", _.isString)
          .validate("body.images", v => _.isUndefined(v) || _.isArray(v))
          .validate("body.negative_prompt", v => _.isUndefined(v) || _.isString(v))
          .validate("body.ratio", v => _.isUndefined(v) || _.isString(v))
          .validate("body.resolution", v => _.isUndefined(v) || _.isString(v))
          .validate("body.intelligent_ratio", v => _.isUndefined(v) || _.isBoolean(v))
          .validate("body.sample_strength", v => _.isUndefined(v) || _.isFinite(v))
          .validate("body.response_format", v => _.isUndefined(v) || _.isString(v))
          .validate("headers.authorization", _.isString);
      }

      // 处理图片数据（如果提供）
      let images: (string | Buffer)[] | null = null;
      if (isMultiPart) {
        const files = (request.files as any)?.images;
        if (files) {
          const imageFiles = Array.isArray(files) ? files : [files];
          if (imageFiles.length > 0) {
            if (imageFiles.length > 10) {
              throw new Error("最多支持10张输入图片");
            }
            images = imageFiles.map((file: any) => fs.readFileSync(file.filepath));
          }
        }
      } else {
        const bodyImages = request.body.images;
        if (bodyImages && Array.isArray(bodyImages) && bodyImages.length > 0) {
          if (bodyImages.length > 10) {
            throw new Error("最多支持10张输入图片");
          }
          bodyImages.forEach((image: any, index: number) => {
            if (!_.isString(image) && !_.isObject(image)) {
              throw new Error(`图片 ${index + 1} 格式不正确：应为URL字符串或包含url字段的对象`);
            }
            if (_.isObject(image) && !(image as any).url) {
              throw new Error(`图片 ${index + 1} 缺少url字段`);
            }
          });
          images = bodyImages.map((image: any) => _.isString(image) ? image : (image as any).url);
        }
      }

      // refresh_token切分
      const tokens = tokenSplit(request.headers.authorization);
      // 随机挑选一个refresh_token
      const token = _.sample(tokens);

      const {
        model,
        prompt,
        negative_prompt: negativePrompt,
        ratio,
        resolution,
        intelligent_ratio: intelligentRatio,
        sample_strength: sampleStrength,
        response_format,
      } = request.body;

      // 如果是 multipart/form-data，需要将字符串转换为数字和布尔值
      const finalSampleStrength = isMultiPart && typeof sampleStrength === 'string'
        ? parseFloat(sampleStrength)
        : sampleStrength;

      const finalIntelligentRatio = isMultiPart && typeof intelligentRatio === 'string'
        ? intelligentRatio === 'true'
        : intelligentRatio;

      const responseFormat = _.defaultTo(response_format, "url");

      // 根据是否有图片数据决定调用文生图还是图生图
      let imageUrls: string[];
      let resultData: any = {
        created: util.unixTimestamp(),
      };

      if (images && images.length > 0) {
        // 图生图模式
        imageUrls = await generateImageComposition(model, prompt, images, {
          ratio,
          resolution,
          sampleStrength: finalSampleStrength,
          negativePrompt,
          intelligentRatio: finalIntelligentRatio,
        }, token);
        resultData.input_images = images.length;
        resultData.composition_type = "multi_image_synthesis";
      } else {
        // 文生图模式
        imageUrls = await generateImages(model, prompt, {
          ratio,
          resolution,
          sampleStrength: finalSampleStrength,
          negativePrompt,
          intelligentRatio: finalIntelligentRatio,
        }, token);
      }

      let data = [];
      if (responseFormat == "b64_json") {
        data = (
          await Promise.all(imageUrls.map((url) => util.fetchFileBASE64(url)))
        ).map((b64) => ({ b64_json: b64 }));
      } else {
        data = imageUrls.map((url) => ({
          url,
        }));
      }

      resultData.data = data;
      return resultData;
    },

    // 图片合成路由（图生图）
    "/compositions": async (request: Request) => {
      // 检查是否使用了不支持的参数
      const unsupportedParams = ['size', 'width', 'height'];
      const bodyKeys = Object.keys(request.body);
      const foundUnsupported = unsupportedParams.filter(param => bodyKeys.includes(param));

      if (foundUnsupported.length > 0) {
        throw new Error(`不支持的参数: ${foundUnsupported.join(', ')}。请使用 ratio 和 resolution 参数控制图像尺寸。`);
      }

      const contentType = request.headers['content-type'] || '';
      const isMultiPart = contentType.startsWith('multipart/form-data');

      if (isMultiPart) {
        request
          .validate("body.model", v => _.isUndefined(v) || _.isString(v))
          .validate("body.prompt", _.isString)
          .validate("body.negative_prompt", v => _.isUndefined(v) || _.isString(v))
          .validate("body.ratio", v => _.isUndefined(v) || _.isString(v))
          .validate("body.resolution", v => _.isUndefined(v) || _.isString(v))
          .validate("body.intelligent_ratio", v => _.isUndefined(v) || (typeof v === 'string' && (v === 'true' || v === 'false')) || _.isBoolean(v))
          .validate("body.sample_strength", v => _.isUndefined(v) || (typeof v === 'string' && !isNaN(parseFloat(v))) || _.isFinite(v))
          .validate("body.response_format", v => _.isUndefined(v) || _.isString(v))
          .validate("headers.authorization", _.isString);
      } else {
        request
          .validate("body.model", v => _.isUndefined(v) || _.isString(v))
          .validate("body.prompt", _.isString)
          .validate("body.images", _.isArray)
          .validate("body.negative_prompt", v => _.isUndefined(v) || _.isString(v))
          .validate("body.ratio", v => _.isUndefined(v) || _.isString(v))
          .validate("body.resolution", v => _.isUndefined(v) || _.isString(v))
          .validate("body.intelligent_ratio", v => _.isUndefined(v) || _.isBoolean(v))
          .validate("body.sample_strength", v => _.isUndefined(v) || _.isFinite(v))
          .validate("body.response_format", v => _.isUndefined(v) || _.isString(v))
          .validate("headers.authorization", _.isString);
      }

      let images: (string | Buffer)[] = [];
      if (isMultiPart) {
        const files = (request.files as any)?.images;
        if (!files) {
          throw new Error("在form-data中缺少 'images' 字段");
        }
        const imageFiles = Array.isArray(files) ? files : [files];
        if (imageFiles.length === 0) {
          throw new Error("至少需要提供1张输入图片");
        }
        if (imageFiles.length > 10) {
          throw new Error("最多支持10张输入图片");
        }
        images = imageFiles.map((file: any) => fs.readFileSync(file.filepath));
      } else {
        const bodyImages = request.body.images;
        if (!bodyImages || bodyImages.length === 0) {
          throw new Error("至少需要提供1张输入图片");
        }
        if (bodyImages.length > 10) {
          throw new Error("最多支持10张输入图片");
        }
        bodyImages.forEach((image: any, index: number) => {
          if (!_.isString(image) && !_.isObject(image)) {
            throw new Error(`图片 ${index + 1} 格式不正确：应为URL字符串或包含url字段的对象`);
          }
          if (_.isObject(image) && !(image as any).url) {
            throw new Error(`图片 ${index + 1} 缺少url字段`);
          }
        });
        images = bodyImages.map((image: any) => _.isString(image) ? image : (image as any).url);
      }

      // refresh_token切分
      const tokens = tokenSplit(request.headers.authorization);
      // 随机挑选一个refresh_token
      const token = _.sample(tokens);

      const {
        model,
        prompt,
        negative_prompt: negativePrompt,
        ratio,
        resolution,
        intelligent_ratio: intelligentRatio,
        sample_strength: sampleStrength,
        response_format,
      } = request.body;

      // 如果是 multipart/form-data，需要将字符串转换为数字和布尔值
      const finalSampleStrength = isMultiPart && typeof sampleStrength === 'string'
        ? parseFloat(sampleStrength)
        : sampleStrength;

      const finalIntelligentRatio = isMultiPart && typeof intelligentRatio === 'string'
        ? intelligentRatio === 'true'
        : intelligentRatio;

      const responseFormat = _.defaultTo(response_format, "url");
      const resultUrls = await generateImageComposition(model, prompt, images, {
        ratio,
        resolution,
        sampleStrength: finalSampleStrength,
        negativePrompt,
        intelligentRatio: finalIntelligentRatio,
      }, token);

      let data = [];
      if (responseFormat == "b64_json") {
        data = (
          await Promise.all(resultUrls.map((url) => util.fetchFileBASE64(url)))
        ).map((b64) => ({ b64_json: b64 }));
      } else {
        data = resultUrls.map((url) => ({
          url,
        }));
      }

      return {
        created: util.unixTimestamp(),
        data,
        input_images: images.length,
        composition_type: "multi_image_synthesis",
      };
    },
  },
};
