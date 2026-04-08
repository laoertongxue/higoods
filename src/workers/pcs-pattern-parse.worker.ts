/// <reference lib="webworker" />

import type { PatternParsedFileResult } from '../data/pcs-pattern-library-types.ts'
import {
  buildParseSummary,
  buildDownsamplePlan,
  buildPerceptualHashFromRgba,
  decodeTiffToSampledRgba,
  detectHasAlphaFromRgba,
  downsampleRgba,
  getDominantColors,
  getPatternMimeTypeFromExt,
  guessColorModeFromPixels,
  parseJpegMetadata,
  parsePngMetadata,
  parseTiffMetadata,
  sha256Hex,
  tokenizePatternFilename,
} from '../utils/pcs-pattern-library-core.ts'

interface ParseWorkerRequest {
  id: string
  fileName: string
  fileType?: string
  buffer: ArrayBuffer
}

interface ParseWorkerResponse {
  id: string
  result: PatternParsedFileResult
}

function toResultBase(fileName: string, ext: string, mimeType: string, fileSize: number): Omit<PatternParsedFileResult, 'parseStatus' | 'parseSummary' | 'dominantColors' | 'parseWarnings' | 'parseResultJson' | 'filenameTokens'> {
  return {
    originalFilename: fileName,
    fileExt: ext,
    mimeType,
    fileSize,
  }
}

async function decodeBlobToRgba(blob: Blob): Promise<{ width: number; height: number; rgba: Uint8ClampedArray }> {
  if (typeof createImageBitmap !== 'function') {
    throw new Error('当前浏览器环境不支持图片位图解码')
  }
  const bitmap = await createImageBitmap(blob)
  const width = bitmap.width
  const height = bitmap.height
  const canvas = new OffscreenCanvas(width, height)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    bitmap.close()
    throw new Error('当前浏览器环境无法生成预览画布')
  }
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const imageData = context.getImageData(0, 0, width, height)
  return { width, height, rgba: imageData.data }
}

async function buildPreviewBlobFromRgba(
  rgba: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  maxDimension: number,
): Promise<Blob> {
  const sourceCanvas = new OffscreenCanvas(sourceWidth, sourceHeight)
  const sourceContext = sourceCanvas.getContext('2d')
  if (!sourceContext) throw new Error('当前浏览器环境无法生成预览画布')
  sourceContext.putImageData(new ImageData(rgba, sourceWidth, sourceHeight), 0, 0)

  const ratio = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight))
  const targetWidth = Math.max(1, Math.round(sourceWidth * ratio))
  const targetHeight = Math.max(1, Math.round(sourceHeight * ratio))
  const targetCanvas = new OffscreenCanvas(targetWidth, targetHeight)
  const targetContext = targetCanvas.getContext('2d')
  if (!targetContext) throw new Error('当前浏览器环境无法生成预览画布')
  targetContext.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight)
  return targetCanvas.convertToBlob({ type: 'image/png' })
}

async function parseTiffBuffer(fileName: string, mimeType: string, buffer: ArrayBuffer): Promise<PatternParsedFileResult> {
  const fileSize = buffer.byteLength
  const ext = fileName.split('.').pop()?.toLowerCase() ?? 'tiff'
  const filenameTokens = tokenizePatternFilename(fileName)
  const sha256 = await sha256Hex(buffer)
  const originalBlob = new Blob([buffer], { type: mimeType })
  const metadata = parseTiffMetadata(buffer)
  const warnings: string[] = []

  try {
    const previewDecoded = decodeTiffToSampledRgba(buffer, { maxDimension: 1600 })
    const previewBlob = await buildPreviewBlobFromRgba(
      previewDecoded.rgba,
      previewDecoded.width,
      previewDecoded.height,
      Math.max(previewDecoded.width, previewDecoded.height),
    )

    const thumbnailPlan = buildDownsamplePlan(previewDecoded.width, previewDecoded.height, 320)
    const thumbnailRgba = downsampleRgba(
      previewDecoded.rgba,
      previewDecoded.width,
      previewDecoded.height,
      thumbnailPlan.width,
      thumbnailPlan.height,
    )
    const thumbnailBlob = await buildPreviewBlobFromRgba(
      thumbnailRgba,
      thumbnailPlan.width,
      thumbnailPlan.height,
      Math.max(thumbnailPlan.width, thumbnailPlan.height),
    )

    let analysisDecoded = previewDecoded
    if (Math.max(previewDecoded.width, previewDecoded.height) > 256) {
      try {
        analysisDecoded = decodeTiffToSampledRgba(buffer, { maxDimension: 256 })
      } catch (error) {
        warnings.push(error instanceof Error ? error.message : '分析采样生成失败，已回退预览采样结果')
      }
    }

    const hasAlpha = typeof metadata.hasAlpha === 'boolean' ? metadata.hasAlpha : detectHasAlphaFromRgba(previewDecoded.rgba)
    const colorMode = metadata.colorMode ?? guessColorModeFromPixels(previewDecoded.rgba, hasAlpha)

    let phash: string | undefined
    try {
      phash = buildPerceptualHashFromRgba(analysisDecoded.rgba, analysisDecoded.width, analysisDecoded.height)
    } catch {
      warnings.push('视觉相似哈希计算失败，待后续补算')
    }

    let dominantColors: string[] = []
    try {
      dominantColors = getDominantColors(analysisDecoded.rgba)
    } catch {
      warnings.push('主色分析失败，待后续补算')
    }

    return {
      ...toResultBase(fileName, ext, mimeType, fileSize),
      imageWidth: metadata.width ?? previewDecoded.originalWidth,
      imageHeight: metadata.height ?? previewDecoded.originalHeight,
      aspectRatio: Number(((metadata.width ?? previewDecoded.originalWidth) / Math.max(metadata.height ?? previewDecoded.originalHeight, 1)).toFixed(4)),
      colorMode,
      dpiX: metadata.dpiX,
      dpiY: metadata.dpiY,
      frameCount: metadata.frameCount ?? previewDecoded.frameCount ?? 1,
      hasAlpha,
      sha256,
      phash,
      filenameTokens,
      originalBlob,
      previewBlob,
      thumbnailBlob,
      parseStatus: 'success',
      parseSummary: buildParseSummary(
        ext,
        metadata.width ?? previewDecoded.originalWidth,
        metadata.height ?? previewDecoded.originalHeight,
        metadata.dpiX,
        metadata.dpiY,
        metadata.frameCount ?? previewDecoded.frameCount ?? 1,
      ),
      dominantColors,
      parseWarnings: warnings,
      parseResultJson: {
        decoder: 'worker:tiff',
        compression: metadata.compression ?? previewDecoded.compression,
        predictor: metadata.predictor ?? previewDecoded.predictor,
        bitsPerSample: metadata.bitsPerSample ?? previewDecoded.bitsPerSample,
        samplesPerPixel: metadata.samplesPerPixel ?? previewDecoded.samplesPerPixel,
        planarConfiguration: metadata.planarConfiguration ?? previewDecoded.planarConfiguration,
        originalWidth: metadata.width ?? previewDecoded.originalWidth,
        originalHeight: metadata.height ?? previewDecoded.originalHeight,
        previewWidth: previewDecoded.width,
        previewHeight: previewDecoded.height,
        analysisWidth: analysisDecoded.width,
        analysisHeight: analysisDecoded.height,
        dpiX: metadata.dpiX,
        dpiY: metadata.dpiY,
        frameCount: metadata.frameCount ?? previewDecoded.frameCount ?? 1,
        colorMode,
        parseWarnings: warnings,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TIFF 解析失败'
    return {
      ...toResultBase(fileName, ext, mimeType, fileSize),
      imageWidth: metadata.width,
      imageHeight: metadata.height,
      aspectRatio:
        metadata.width && metadata.height ? Number((metadata.width / Math.max(metadata.height, 1)).toFixed(4)) : undefined,
      colorMode: metadata.colorMode,
      dpiX: metadata.dpiX,
      dpiY: metadata.dpiY,
      frameCount: metadata.frameCount ?? 1,
      hasAlpha: metadata.hasAlpha,
      sha256,
      filenameTokens,
      originalBlob,
      parseStatus: 'failed',
      parseErrorMessage: message,
      parseSummary: 'TIFF 解析失败，请重试',
      dominantColors: [],
      parseWarnings: [message],
      parseResultJson: {
        decoder: 'worker:tiff',
        parseErrorMessage: message,
        compression: metadata.compression,
        predictor: metadata.predictor,
        bitsPerSample: metadata.bitsPerSample,
        samplesPerPixel: metadata.samplesPerPixel,
        planarConfiguration: metadata.planarConfiguration,
        originalWidth: metadata.width,
        originalHeight: metadata.height,
        frameCount: metadata.frameCount ?? 1,
        dpiX: metadata.dpiX,
        dpiY: metadata.dpiY,
        parseWarnings: [message],
      },
    }
  }
}

async function parseRasterBuffer(fileName: string, mimeType: string, ext: string, buffer: ArrayBuffer): Promise<PatternParsedFileResult> {
  const fileSize = buffer.byteLength
  const filenameTokens = tokenizePatternFilename(fileName)
  const sha256 = await sha256Hex(buffer)
  const originalBlob = new Blob([buffer], { type: mimeType })
  const metadata = ext === 'png' ? parsePngMetadata(buffer) : parseJpegMetadata(buffer)
  const warnings: string[] = []

  try {
    const decoded = await decodeBlobToRgba(originalBlob)
    const hasAlpha = detectHasAlphaFromRgba(decoded.rgba)
    const colorMode = guessColorModeFromPixels(decoded.rgba, hasAlpha)
    const previewBlob = await buildPreviewBlobFromRgba(decoded.rgba, decoded.width, decoded.height, 1600)
    const thumbnailBlob = await buildPreviewBlobFromRgba(decoded.rgba, decoded.width, decoded.height, 320)

    let phash: string | undefined
    try {
      phash = buildPerceptualHashFromRgba(decoded.rgba, decoded.width, decoded.height)
    } catch {
      warnings.push('视觉相似哈希计算失败，待后续补算')
    }

    return {
      ...toResultBase(fileName, ext, mimeType, fileSize),
      imageWidth: decoded.width || metadata.width,
      imageHeight: decoded.height || metadata.height,
      aspectRatio: Number((decoded.width / Math.max(decoded.height, 1)).toFixed(4)),
      colorMode,
      dpiX: metadata.dpiX,
      dpiY: metadata.dpiY,
      frameCount: 1,
      hasAlpha,
      sha256,
      phash,
      filenameTokens,
      originalBlob,
      previewBlob,
      thumbnailBlob,
      parseStatus: 'success',
      parseSummary: buildParseSummary(ext, decoded.width, decoded.height, metadata.dpiX, metadata.dpiY, 1),
      dominantColors: getDominantColors(decoded.rgba),
      parseWarnings: warnings,
      parseResultJson: {
        decoder: 'worker:raster',
        width: decoded.width,
        height: decoded.height,
        dpiX: metadata.dpiX,
        dpiY: metadata.dpiY,
        colorMode,
        parseWarnings: warnings,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '图片解析失败'
    return {
      ...toResultBase(fileName, ext, mimeType, fileSize),
      imageWidth: metadata.width,
      imageHeight: metadata.height,
      aspectRatio: metadata.width && metadata.height ? Number((metadata.width / metadata.height).toFixed(4)) : undefined,
      dpiX: metadata.dpiX,
      dpiY: metadata.dpiY,
      frameCount: 1,
      sha256,
      filenameTokens,
      originalBlob,
      parseStatus: 'failed',
      parseErrorMessage: message,
      parseSummary: '图片解析失败，请重试',
      dominantColors: [],
      parseWarnings: [message],
      parseResultJson: {
        decoder: 'worker:raster',
        parseErrorMessage: message,
        width: metadata.width,
        height: metadata.height,
      },
    }
  }
}

async function parseFileInWorker(request: ParseWorkerRequest): Promise<PatternParsedFileResult> {
  const ext = request.fileName.split('.').pop()?.toLowerCase() ?? ''
  if (!['jpg', 'jpeg', 'png', 'tif', 'tiff'].includes(ext)) {
    throw new Error('当前原型仅支持 JPG / JPEG / PNG / TIF / TIFF 文件')
  }

  const mimeType = request.fileType || getPatternMimeTypeFromExt(ext)
  if (ext === 'tif' || ext === 'tiff') {
    return parseTiffBuffer(request.fileName, mimeType, request.buffer)
  }
  return parseRasterBuffer(request.fileName, mimeType, ext, request.buffer)
}

self.addEventListener('message', (event: MessageEvent<ParseWorkerRequest>) => {
  const request = event.data
  void parseFileInWorker(request)
    .then((result) => {
      const response: ParseWorkerResponse = { id: request.id, result }
      self.postMessage(response)
    })
    .catch((error) => {
      self.postMessage({
        id: request.id,
        error: error instanceof Error ? error.message : '文件解析失败',
      })
    })
})

export {}
