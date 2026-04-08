import type {
  PatternAsset,
  PatternDuplicateStatus,
  PatternFilenameToken,
  PatternLibraryConfig,
  PatternLicenseStatus,
  PatternParsedFileResult,
  PatternSimilarityHit,
  PatternTagRecord,
} from '../data/pcs-pattern-library-types.ts'

const COLOR_DICTIONARY = [
  { label: '红色', hueMin: 345, hueMax: 360, saturationMin: 0.18, lightnessMin: 0.14, lightnessMax: 0.86 },
  { label: '红色', hueMin: 0, hueMax: 20, saturationMin: 0.18, lightnessMin: 0.14, lightnessMax: 0.86 },
  { label: '橙色', hueMin: 20, hueMax: 42, saturationMin: 0.18, lightnessMin: 0.18, lightnessMax: 0.88 },
  { label: '黄色', hueMin: 42, hueMax: 72, saturationMin: 0.15, lightnessMin: 0.22, lightnessMax: 0.92 },
  { label: '绿色', hueMin: 72, hueMax: 165, saturationMin: 0.12, lightnessMin: 0.12, lightnessMax: 0.88 },
  { label: '蓝色', hueMin: 165, hueMax: 255, saturationMin: 0.12, lightnessMin: 0.1, lightnessMax: 0.88 },
  { label: '紫色', hueMin: 255, hueMax: 320, saturationMin: 0.16, lightnessMin: 0.14, lightnessMax: 0.84 },
  { label: '粉色', hueMin: 320, hueMax: 345, saturationMin: 0.12, lightnessMin: 0.55, lightnessMax: 0.92 },
]

const TOKEN_CATEGORY_RULES: Array<{ pattern: RegExp; category: PatternFilenameToken['category'] }> = [
  { pattern: /^(pink|rose|red|blue|green|yellow|white|black|grey|gray|beige|purple|brown)$/i, category: 'color' },
  { pattern: /^[a-z]{1,6}\d{2,}$/i, category: 'code' },
  { pattern: /^\d+$/, category: 'number' },
]

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  花卉: ['flower', 'floral', 'rose', 'bloom', 'tulip', 'peony', '花', '花卉'],
  条纹: ['stripe', 'stripes', '条纹'],
  格纹: ['check', 'plaid', 'grid', 'gingham', '格纹', '格子'],
  动物: ['animal', 'tiger', 'leopard', 'zebra', 'bird', '动物'],
  几何: ['geo', 'geometric', 'diamond', 'dot', 'circle', '几何'],
  字母: ['letter', 'alpha', 'logo', 'text', '字母'],
  卡通: ['cartoon', 'cute', 'bear', 'bunny', '卡通'],
  抽象: ['abstract', 'brush', 'watercolor', '抽象'],
  纯色: ['solid', 'texture', 'plain', '肌理', '纯色'],
}

const STYLE_KEYWORDS: Record<string, string[]> = {
  法式: ['french', 'romance', 'romantic', 'rose'],
  复古: ['retro', 'vintage', 'nostalgia'],
  度假: ['tropical', 'vacation', 'beach'],
  甜美: ['sweet', 'cute', 'bow', 'pink'],
  通勤: ['office', 'minimal', 'stripe', 'check'],
  民族: ['ethnic', 'tribal', 'boho', 'paisley'],
  运动: ['sport', 'active', 'logo'],
}

const USAGE_KEYWORDS: Record<string, string[]> = {
  重复花: ['repeat', 'tile', 'allover', 'repeatable'],
  定位花: ['placement', 'panel', 'position', 'front', 'back'],
  边条花: ['border', 'hem', 'side', 'lace'],
  满印: ['full', 'allover', '全幅', '满印'],
  纯色肌理: ['solid', 'texture', 'grain', 'wash'],
}

const TIFF_TYPE_SIZES: Record<number, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 4,
  5: 8,
}

export interface PatternBinaryImageMetadata {
  width?: number
  height?: number
  dpiX?: number
  dpiY?: number
  frameCount?: number
  colorMode?: string
  hasAlpha?: boolean
  compression?: number
  predictor?: number
  bitsPerSample?: number[]
  samplesPerPixel?: number
  planarConfiguration?: number
}

export interface PatternDecodedRgbaImage extends PatternBinaryImageMetadata {
  width: number
  height: number
  rgba: Uint8ClampedArray
}

export interface PatternTiffDecodeOptions {
  allowUnsupported?: boolean
}

export interface PatternTiffSampledDecodeOptions extends PatternTiffDecodeOptions {
  maxDimension: number
}

export interface PatternDownsamplePlan {
  width: number
  height: number
  scale: number
}

export interface PatternSampledRgbaImage extends PatternBinaryImageMetadata {
  width: number
  height: number
  originalWidth: number
  originalHeight: number
  rgba: Uint8ClampedArray
  warnings: string[]
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
}

function parseRational(view: DataView, offset: number, littleEndian: boolean): number | undefined {
  if (offset + 8 > view.byteLength) return undefined
  const numerator = view.getUint32(offset, littleEndian)
  const denominator = view.getUint32(offset + 4, littleEndian)
  if (!denominator) return undefined
  return numerator / denominator
}

function normalizeToken(token: string): string {
  return token.trim().toLowerCase()
}

export function getPatternMimeTypeFromExt(ext: string): string {
  const normalized = ext.toLowerCase()
  if (normalized === 'png') return 'image/png'
  if (normalized === 'jpg' || normalized === 'jpeg') return 'image/jpeg'
  if (normalized === 'tif' || normalized === 'tiff') return 'image/tiff'
  return 'application/octet-stream'
}

export function tokenizePatternFilename(fileName: string): PatternFilenameToken[] {
  const base = fileName.replace(/\.[^.]+$/, '')
  const segments = base
    .split(/[\s._-]+/)
    .map((segment) => segment.trim())
    .filter(Boolean)

  const tokens: PatternFilenameToken[] = []
  for (const segment of segments) {
    const normalizedSegment = normalizeToken(segment)
    tokens.push({
      token: segment,
      normalized: normalizedSegment,
      category: TOKEN_CATEGORY_RULES.find((rule) => rule.pattern.test(segment))?.category ?? 'segment',
      score: 0.72,
    })

    const subTokens = segment.match(/[A-Za-z]+|\d+|[\u4e00-\u9fa5]+/g) ?? []
    for (const subToken of subTokens) {
      if (subToken === segment) continue
      const normalized = normalizeToken(subToken)
      tokens.push({
        token: subToken,
        normalized,
        category: TOKEN_CATEGORY_RULES.find((rule) => rule.pattern.test(subToken))?.category ?? 'word',
        score: 0.58,
      })
    }
  }

  const unique = new Map<string, PatternFilenameToken>()
  for (const token of tokens) {
    unique.set(`${token.normalized}-${token.category}`, token)
  }
  return Array.from(unique.values())
}

export function hammingDistance(left?: string, right?: string): number {
  if (!left || !right || left.length !== right.length) return Number.POSITIVE_INFINITY
  let distance = 0
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) distance += 1
  }
  return distance
}

export function isPatternLicenseUsable(status: PatternLicenseStatus): boolean {
  return status === 'authorized' || status === 'restricted'
}

export function canPatternBeReferenced(asset: Pick<PatternAsset, 'parse_status' | 'review_status' | 'lifecycle_status' | 'license_status'>): {
  allowed: boolean
  reason?: string
} {
  if (asset.parse_status !== 'success') return { allowed: false, reason: '解析成功后才允许正式引用' }
  if (asset.review_status !== 'approved') return { allowed: false, reason: '审核通过后才允许正式引用' }
  if (asset.lifecycle_status !== 'active') return { allowed: false, reason: '仅启用中的花型可正式引用' }
  if (!isPatternLicenseUsable(asset.license_status)) {
    return { allowed: false, reason: '授权状态不可用，禁止新增引用' }
  }
  return { allowed: true }
}

function rgbToHsl(red: number, green: number, blue: number): { h: number; s: number; l: number } {
  const r = red / 255
  const g = green / 255
  const b = blue / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 2

  if (max === min) {
    return { h: 0, s: 0, l: lightness }
  }

  const delta = max - min
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)

  let hue = 0
  switch (max) {
    case r:
      hue = (g - b) / delta + (g < b ? 6 : 0)
      break
    case g:
      hue = (b - r) / delta + 2
      break
    default:
      hue = (r - g) / delta + 4
      break
  }

  return { h: hue * 60, s: saturation, l: lightness }
}

function mapRgbToColorLabel(red: number, green: number, blue: number): string {
  const { h, s, l } = rgbToHsl(red, green, blue)
  if (l <= 0.14) return '黑色'
  if (l >= 0.9 && s <= 0.08) return '白色'
  if (s <= 0.1) return '灰色'

  const matched = COLOR_DICTIONARY.find((item) => {
    const inHueRange =
      item.hueMin <= item.hueMax
        ? h >= item.hueMin && h < item.hueMax
        : h >= item.hueMin || h < item.hueMax
    return inHueRange && s >= item.saturationMin && l >= item.lightnessMin && l <= item.lightnessMax
  })
  return matched?.label ?? '综合色'
}

export function detectHasAlphaFromRgba(rgba: Uint8ClampedArray): boolean {
  for (let index = 3; index < rgba.length; index += 4) {
    if (rgba[index] < 250) return true
  }
  return false
}

export function guessColorModeFromPixels(rgba: Uint8ClampedArray, hasAlpha: boolean): string {
  let grayLikePixels = 0
  const sampleCount = Math.max(1, Math.floor(rgba.length / 4))
  for (let index = 0; index < rgba.length; index += 4) {
    const red = rgba[index]
    const green = rgba[index + 1]
    const blue = rgba[index + 2]
    if (Math.abs(red - green) < 4 && Math.abs(green - blue) < 4) {
      grayLikePixels += 1
    }
  }
  if (grayLikePixels / sampleCount > 0.88) return hasAlpha ? 'Gray + Alpha' : 'Gray'
  return hasAlpha ? 'RGBA' : 'RGB'
}

export function getDominantColors(rgba: Uint8ClampedArray): string[] {
  const buckets = new Map<string, number>()
  const step = Math.max(16, Math.floor(rgba.length / (4 * 800)))
  for (let index = 0; index < rgba.length; index += 4 * step) {
    if (rgba[index + 3] < 24) continue
    const label = mapRgbToColorLabel(rgba[index], rgba[index + 1], rgba[index + 2])
    buckets.set(label, (buckets.get(label) ?? 0) + 1)
  }
  return Array.from(buckets.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([label]) => label)
}

function downsampleToGray(rgba: Uint8ClampedArray, width: number, height: number, targetSize: number): number[] {
  const values: number[] = []
  const safeWidth = Math.max(width, 1)
  const safeHeight = Math.max(height, 1)

  for (let y = 0; y < targetSize; y += 1) {
    const sourceY = Math.floor((y / targetSize) * safeHeight)
    for (let x = 0; x < targetSize; x += 1) {
      const sourceX = Math.floor((x / targetSize) * safeWidth)
      const pixelOffset = (clamp(sourceY, 0, safeHeight - 1) * safeWidth + clamp(sourceX, 0, safeWidth - 1)) * 4
      const red = rgba[pixelOffset]
      const green = rgba[pixelOffset + 1]
      const blue = rgba[pixelOffset + 2]
      values.push(red * 0.299 + green * 0.587 + blue * 0.114)
    }
  }
  return values
}

function discreteCosineTransform(values: number[], size: number): number[] {
  const output = new Array(size * size).fill(0)
  for (let u = 0; u < size; u += 1) {
    for (let v = 0; v < size; v += 1) {
      let sum = 0
      for (let x = 0; x < size; x += 1) {
        for (let y = 0; y < size; y += 1) {
          const value = values[x * size + y]
          sum +=
            value
            * Math.cos(((2 * x + 1) * u * Math.PI) / (2 * size))
            * Math.cos(((2 * y + 1) * v * Math.PI) / (2 * size))
        }
      }
      const alphaU = u === 0 ? Math.sqrt(1 / size) : Math.sqrt(2 / size)
      const alphaV = v === 0 ? Math.sqrt(1 / size) : Math.sqrt(2 / size)
      output[u * size + v] = alphaU * alphaV * sum
    }
  }
  return output
}

export function buildPerceptualHashFromRgba(rgba: Uint8ClampedArray, width: number, height: number): string {
  const grayscale = downsampleToGray(rgba, width, height, 32)
  const dct = discreteCosineTransform(grayscale, 32)
  const lowFrequencies: number[] = []

  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      if (row === 0 && column === 0) continue
      lowFrequencies.push(dct[row * 32 + column])
    }
  }

  const sorted = [...lowFrequencies].sort((left, right) => left - right)
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0
  return lowFrequencies.map((value) => (value >= median ? '1' : '0')).join('')
}

export function parsePngMetadata(buffer: ArrayBuffer): PatternBinaryImageMetadata {
  const bytes = new Uint8Array(buffer)
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  if (!signature.every((value, index) => bytes[index] === value)) return {}

  const view = new DataView(buffer)
  const width = view.byteLength >= 24 ? view.getUint32(16) : undefined
  const height = view.byteLength >= 24 ? view.getUint32(20) : undefined

  let offset = 8
  let dpiX: number | undefined
  let dpiY: number | undefined
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset)
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8))
    if (type === 'pHYs' && offset + 8 + length <= bytes.length) {
      const chunkView = new DataView(buffer, offset + 8, length)
      const pixelsPerUnitX = chunkView.getUint32(0)
      const pixelsPerUnitY = chunkView.getUint32(4)
      const unit = chunkView.getUint8(8)
      if (unit === 1) {
        dpiX = Number((pixelsPerUnitX * 0.0254).toFixed(1))
        dpiY = Number((pixelsPerUnitY * 0.0254).toFixed(1))
      }
      break
    }
    offset += 12 + length
  }

  return {
    width,
    height,
    dpiX,
    dpiY,
    frameCount: 1,
  }
}

export function parseJpegMetadata(buffer: ArrayBuffer): PatternBinaryImageMetadata {
  const bytes = new Uint8Array(buffer)
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return {}

  let offset = 2
  let dpiX: number | undefined
  let dpiY: number | undefined
  let width: number | undefined
  let height: number | undefined

  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1
      continue
    }

    const marker = bytes[offset + 1]
    if (marker === 0xd9 || marker === 0xda) break
    const length = (bytes[offset + 2] << 8) + bytes[offset + 3]
    if (length < 2 || offset + 2 + length > bytes.length) break

    if (marker === 0xe0 && offset + 18 <= bytes.length) {
      const id = String.fromCharCode(...bytes.slice(offset + 4, offset + 9))
      if (id === 'JFIF\0') {
        const unit = bytes[offset + 11]
        const xDensity = (bytes[offset + 12] << 8) + bytes[offset + 13]
        const yDensity = (bytes[offset + 14] << 8) + bytes[offset + 15]
        if (unit === 1) {
          dpiX = xDensity
          dpiY = yDensity
        } else if (unit === 2) {
          dpiX = Number((xDensity * 2.54).toFixed(1))
          dpiY = Number((yDensity * 2.54).toFixed(1))
        }
      }
    }

    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      height = (bytes[offset + 5] << 8) + bytes[offset + 6]
      width = (bytes[offset + 7] << 8) + bytes[offset + 8]
      break
    }

    offset += 2 + length
  }

  return {
    width,
    height,
    dpiX,
    dpiY,
    frameCount: 1,
  }
}

function getTiffValueOffset(entryOffset: number, type: number, count: number, littleEndian: boolean, view: DataView): number {
  const totalSize = (TIFF_TYPE_SIZES[type] ?? 0) * count
  return totalSize <= 4 ? entryOffset + 8 : view.getUint32(entryOffset + 8, littleEndian)
}

function readTiffValues(view: DataView, entryOffset: number, type: number, count: number, littleEndian: boolean): number[] {
  const typeSize = TIFF_TYPE_SIZES[type]
  if (!typeSize || count <= 0) return []
  const valueOffset = getTiffValueOffset(entryOffset, type, count, littleEndian, view)
  const values: number[] = []

  for (let index = 0; index < count; index += 1) {
    const offset = valueOffset + index * typeSize
    if (offset + typeSize > view.byteLength) break
    if (type === 1) values.push(view.getUint8(offset))
    else if (type === 3) values.push(view.getUint16(offset, littleEndian))
    else if (type === 4) values.push(view.getUint32(offset, littleEndian))
    else if (type === 5) {
      const rational = parseRational(view, offset, littleEndian)
      if (typeof rational === 'number') values.push(rational)
    }
  }

  return values
}

interface ParsedTiffIfd {
  width?: number
  height?: number
  bitsPerSample: number[]
  compression: number
  predictor: number
  photometric: number
  stripOffsets: number[]
  stripByteCounts: number[]
  samplesPerPixel: number
  rowsPerStrip: number
  dpiX?: number
  dpiY?: number
  colorMode?: string
  hasAlpha?: boolean
  planarConfiguration: number
  extraSamples: number[]
}

function parseTiffIfds(buffer: ArrayBuffer): { ifds: ParsedTiffIfd[]; littleEndian: boolean } {
  const view = new DataView(buffer)
  if (view.byteLength < 8) throw new Error('TIFF 文件头长度不足')

  const byteOrder = String.fromCharCode(view.getUint8(0), view.getUint8(1))
  const littleEndian = byteOrder === 'II'
  if (!littleEndian && byteOrder !== 'MM') throw new Error('当前文件不是有效 TIFF')
  const magic = view.getUint16(2, littleEndian)
  if (magic !== 42) throw new Error('当前文件不是标准 TIFF')

  const ifds: ParsedTiffIfd[] = []
  let ifdOffset = view.getUint32(4, littleEndian)
  while (ifdOffset > 0 && ifdOffset + 2 <= view.byteLength) {
    const entryCount = view.getUint16(ifdOffset, littleEndian)
    const parsed: ParsedTiffIfd = {
      bitsPerSample: [],
      compression: 1,
      predictor: 1,
      photometric: 2,
      stripOffsets: [],
      stripByteCounts: [],
      samplesPerPixel: 3,
      rowsPerStrip: 0,
      planarConfiguration: 1,
      extraSamples: [],
    }
    let resolutionUnit = 2

    for (let index = 0; index < entryCount; index += 1) {
      const entryOffset = ifdOffset + 2 + index * 12
      if (entryOffset + 12 > view.byteLength) break
      const tag = view.getUint16(entryOffset, littleEndian)
      const type = view.getUint16(entryOffset + 2, littleEndian)
      const count = view.getUint32(entryOffset + 4, littleEndian)
      const values = readTiffValues(view, entryOffset, type, count, littleEndian)
      const first = values[0]

      if (tag === 256) parsed.width = first
      else if (tag === 257) parsed.height = first
      else if (tag === 258) parsed.bitsPerSample = values
      else if (tag === 259) parsed.compression = first ?? 1
      else if (tag === 262) parsed.photometric = first ?? 2
      else if (tag === 273) parsed.stripOffsets = values
      else if (tag === 277) parsed.samplesPerPixel = first ?? parsed.samplesPerPixel
      else if (tag === 278) parsed.rowsPerStrip = first ?? parsed.rowsPerStrip
      else if (tag === 279) parsed.stripByteCounts = values
      else if (tag === 282) parsed.dpiX = first
      else if (tag === 283) parsed.dpiY = first
      else if (tag === 284) parsed.planarConfiguration = first ?? 1
      else if (tag === 317) parsed.predictor = first ?? 1
      else if (tag === 296) resolutionUnit = first ?? 2
      else if (tag === 338) parsed.extraSamples = values
    }

    const resolutionFactor = resolutionUnit === 3 ? 2.54 : 1
    parsed.dpiX = parsed.dpiX ? Number((parsed.dpiX * resolutionFactor).toFixed(1)) : undefined
    parsed.dpiY = parsed.dpiY ? Number((parsed.dpiY * resolutionFactor).toFixed(1)) : undefined
    parsed.rowsPerStrip = parsed.rowsPerStrip || parsed.height || 0
    parsed.hasAlpha =
      parsed.extraSamples.length > 0
      || (parsed.photometric === 0 || parsed.photometric === 1
        ? parsed.samplesPerPixel > 1
        : parsed.photometric === 5
          ? parsed.samplesPerPixel > 4
          : parsed.samplesPerPixel > 3)
    parsed.colorMode =
      parsed.photometric === 5
        ? 'CMYK'
        : parsed.photometric === 0 || parsed.photometric === 1
          ? parsed.hasAlpha ? 'Gray + Alpha' : 'Gray'
          : parsed.samplesPerPixel >= 4 || parsed.hasAlpha
            ? 'RGBA'
            : parsed.samplesPerPixel === 1
              ? 'Gray'
              : 'RGB'

    ifds.push(parsed)
    const nextOffsetPosition = ifdOffset + 2 + entryCount * 12
    if (nextOffsetPosition + 4 > view.byteLength) break
    ifdOffset = view.getUint32(nextOffsetPosition, littleEndian)
  }

  return { ifds, littleEndian }
}

export function parseTiffMetadata(buffer: ArrayBuffer): PatternBinaryImageMetadata {
  try {
    const { ifds } = parseTiffIfds(buffer)
    const primary = ifds[0]
    if (!primary) return {}
    return {
      width: primary.width,
      height: primary.height,
      dpiX: primary.dpiX,
      dpiY: primary.dpiY,
      frameCount: ifds.length || 1,
      colorMode: primary.colorMode,
      hasAlpha: primary.hasAlpha,
      compression: primary.compression,
      predictor: primary.predictor,
      bitsPerSample: primary.bitsPerSample,
      samplesPerPixel: primary.samplesPerPixel,
      planarConfiguration: primary.planarConfiguration,
    }
  } catch {
    return {}
  }
}

function decodePackBits(bytes: Uint8Array, expectedLength: number): Uint8Array {
  const output = new Uint8Array(expectedLength)
  let inputIndex = 0
  let outputIndex = 0

  while (inputIndex < bytes.length && outputIndex < output.length) {
    let header = bytes[inputIndex]
    inputIndex += 1
    if (header > 127) header -= 256

    if (header >= 0 && header <= 127) {
      const count = header + 1
      output.set(bytes.subarray(inputIndex, inputIndex + count), outputIndex)
      inputIndex += count
      outputIndex += count
      continue
    }

    if (header >= -127 && header <= -1) {
      const count = 1 - header
      const value = bytes[inputIndex] ?? 0
      inputIndex += 1
      output.fill(value, outputIndex, outputIndex + count)
      outputIndex += count
    }
  }

  return output
}

interface TiffByteReader {
  readByte: () => number | null
}

function createFixedLengthByteSink(expectedLength?: number): {
  push: (value: number) => void
  toUint8Array: () => Uint8Array
} {
  if (expectedLength && expectedLength > 0) {
    const output = new Uint8Array(expectedLength)
    let index = 0
    return {
      push(value: number) {
        if (index >= output.length) return
        output[index] = value & 0xff
        index += 1
      },
      toUint8Array() {
        return index >= output.length ? output : output.slice(0, index)
      },
    }
  }

  const values: number[] = []
  return {
    push(value: number) {
      values.push(value & 0xff)
    },
    toUint8Array() {
      return Uint8Array.from(values)
    },
  }
}

function createRawByteReader(bytes: Uint8Array): TiffByteReader {
  let offset = 0
  return {
    readByte() {
      if (offset >= bytes.length) return null
      const value = bytes[offset]
      offset += 1
      return value
    },
  }
}

function createPackBitsByteReader(bytes: Uint8Array): TiffByteReader {
  let offset = 0
  let literalRemaining = 0
  let repeatRemaining = 0
  let repeatValue = 0

  return {
    readByte() {
      while (true) {
        if (literalRemaining > 0) {
          literalRemaining -= 1
          const value = bytes[offset] ?? 0
          offset += 1
          return value
        }
        if (repeatRemaining > 0) {
          repeatRemaining -= 1
          return repeatValue
        }
        if (offset >= bytes.length) return null

        let header = bytes[offset] ?? 0
        offset += 1
        if (header > 127) header -= 256
        if (header >= 0 && header <= 127) {
          literalRemaining = header + 1
          continue
        }
        if (header >= -127 && header <= -1) {
          repeatRemaining = 1 - header
          repeatValue = bytes[offset] ?? 0
          offset += 1
          continue
        }
      }
    },
  }
}

function createTiffLzwByteReader(bytes: Uint8Array): TiffByteReader {
  const prefix = new Int32Array(4096)
  const suffix = new Uint8Array(4096)
  const stack = new Uint8Array(4096)

  let nextByteOffset = 0
  let bitBuffer = 0
  let bitsInBuffer = 0
  let codeSize = 9
  let nextCode = 258
  let previousCode = -1
  let firstByte = 0
  let stackLength = 0
  let finished = false

  const resetDictionary = () => {
    codeSize = 9
    nextCode = 258
    previousCode = -1
  }

  const readCode = (): number | null => {
    while (bitsInBuffer < codeSize) {
      if (nextByteOffset >= bytes.length) return null
      bitBuffer = (bitBuffer << 8) | bytes[nextByteOffset]
      nextByteOffset += 1
      bitsInBuffer += 8
    }

    const code = (bitBuffer >> (bitsInBuffer - codeSize)) & ((1 << codeSize) - 1)
    bitsInBuffer -= codeSize
    bitBuffer = bitsInBuffer > 0 ? bitBuffer & ((1 << bitsInBuffer) - 1) : 0
    return code
  }

  return {
    readByte() {
      if (stackLength > 0) {
        stackLength -= 1
        return stack[stackLength]
      }
      if (finished) return null

      while (!finished) {
        const clearCode = 256
        const eoiCode = 257
        const code = readCode()
        if (code == null) {
          finished = true
          return null
        }
        if (code === clearCode) {
          resetDictionary()
          continue
        }
        if (code === eoiCode) {
          finished = true
          return null
        }

        if (previousCode === -1) {
          firstByte = code & 0xff
          previousCode = code
          return firstByte
        }

        let currentCode = code
        const inputCode = code
        if (currentCode > nextCode) {
          throw new Error('TIFF LZW 数据异常，无法完成解码')
        }
        if (currentCode === nextCode) {
          stack[stackLength] = firstByte
          stackLength += 1
          currentCode = previousCode
        }

        while (currentCode >= 258) {
          stack[stackLength] = suffix[currentCode]
          stackLength += 1
          currentCode = prefix[currentCode]
        }

        firstByte = currentCode & 0xff
        stack[stackLength] = firstByte
        stackLength += 1

        if (nextCode < 4096) {
          prefix[nextCode] = previousCode
          suffix[nextCode] = firstByte
          nextCode += 1
          if (nextCode === (1 << codeSize) - 1 && codeSize < 12) {
            codeSize += 1
          }
        }

        previousCode = inputCode

        if (stackLength > 0) {
          stackLength -= 1
          return stack[stackLength]
        }
      }

      return null
    },
  }
}

export function decodeTiffLzw(bytes: Uint8Array, expectedLength?: number): Uint8Array {
  const reader = createTiffLzwByteReader(bytes)
  const sink = createFixedLengthByteSink(expectedLength)
  while (true) {
    const value = reader.readByte()
    if (value == null) break
    sink.push(value)
  }
  return sink.toUint8Array()
}

function getTiffUnsupportedCompressionMessage(compression: number): string {
  return `当前原型暂仅支持未压缩 / LZW / PackBits TIFF，当前压缩类型为 ${compression}`
}

function getNormalizedBitsPerSample(primary: ParsedTiffIfd): number[] {
  if (primary.bitsPerSample.length > 0) return primary.bitsPerSample
  return new Array(primary.samplesPerPixel).fill(8)
}

function getTiffBytesPerPixel(primary: ParsedTiffIfd, bitsPerSample: number[]): number {
  return Math.max(
    1,
    Math.round(bitsPerSample.reduce((sum, value) => sum + value, 0) / 8) || primary.samplesPerPixel || 1,
  )
}

function validateTiffDecodeInput(primary: ParsedTiffIfd | undefined, options: PatternTiffDecodeOptions = {}): {
  primary: ParsedTiffIfd
  bitsPerSample: number[]
  bytesPerPixel: number
} {
  if (!primary?.width || !primary?.height) {
    throw new Error('TIFF 缺少宽高信息，无法生成预览')
  }
  if (!primary.stripOffsets.length || !primary.stripByteCounts.length) {
    throw new Error('TIFF 缺少图像数据条带信息')
  }
  if (primary.planarConfiguration !== 1 && !options.allowUnsupported) {
    throw new Error('当前原型暂不支持分平面 TIFF（PlanarConfiguration=2）')
  }

  const bitsPerSample = getNormalizedBitsPerSample(primary)
  if (!bitsPerSample.every((value) => value === 8) && !options.allowUnsupported) {
    throw new Error('当前原型仅支持 8-bit TIFF 预览生成')
  }
  if (![1, 5, 32773].includes(primary.compression)) {
    throw new Error(getTiffUnsupportedCompressionMessage(primary.compression))
  }
  if (![1, 2].includes(primary.predictor) && !options.allowUnsupported) {
    throw new Error(`当前原型暂仅支持 Predictor 1/2，当前 Predictor 为 ${primary.predictor}`)
  }

  return {
    primary,
    bitsPerSample,
    bytesPerPixel: getTiffBytesPerPixel(primary, bitsPerSample),
  }
}

function createTiffStripByteReader(source: Uint8Array, compression: number): TiffByteReader {
  if (compression === 1) return createRawByteReader(source)
  if (compression === 5) return createTiffLzwByteReader(source)
  if (compression === 32773) return createPackBitsByteReader(source)
  throw new Error(getTiffUnsupportedCompressionMessage(compression))
}

function reverseHorizontalPredictorInPlace(rowBytes: Uint8Array, bytesPerPixel: number): void {
  for (let offset = bytesPerPixel; offset < rowBytes.length; offset += 1) {
    rowBytes[offset] = (rowBytes[offset] + rowBytes[offset - bytesPerPixel]) & 0xff
  }
}

export function reverseTiffHorizontalPredictor(
  bytes: Uint8Array,
  width: number,
  rows: number,
  bytesPerPixel: number,
): Uint8Array {
  const output = bytes.slice()
  const rowLength = Math.max(1, width * bytesPerPixel)
  for (let row = 0; row < rows; row += 1) {
    const rowOffset = row * rowLength
    const rowEnd = Math.min(output.length, rowOffset + rowLength)
    reverseHorizontalPredictorInPlace(output.subarray(rowOffset, rowEnd), bytesPerPixel)
  }
  return output
}

function fillRowFromReader(reader: TiffByteReader, rowBuffer: Uint8Array): void {
  rowBuffer.fill(0)
  for (let offset = 0; offset < rowBuffer.length; offset += 1) {
    const value = reader.readByte()
    if (value == null) break
    rowBuffer[offset] = value
  }
}

function forEachDecodedTiffRow(
  buffer: ArrayBuffer,
  primary: ParsedTiffIfd,
  bytesPerPixel: number,
  onRow: (sourceY: number, rowBytes: Uint8Array) => void,
): void {
  const bytes = new Uint8Array(buffer)
  const rowByteLength = Math.max(1, primary.width! * bytesPerPixel)
  const rowBuffer = new Uint8Array(rowByteLength)
  let currentRow = 0

  for (let stripIndex = 0; stripIndex < primary.stripOffsets.length && currentRow < primary.height!; stripIndex += 1) {
    const stripOffset = primary.stripOffsets[stripIndex] ?? 0
    const stripLength = primary.stripByteCounts[stripIndex] ?? 0
    if (!stripOffset || !stripLength || stripOffset + stripLength > bytes.length) continue

    const source = bytes.subarray(stripOffset, stripOffset + stripLength)
    const reader = createTiffStripByteReader(source, primary.compression)
    const expectedRows = Math.min(primary.rowsPerStrip || primary.height!, primary.height! - currentRow)

    for (let rowIndex = 0; rowIndex < expectedRows && currentRow < primary.height!; rowIndex += 1) {
      fillRowFromReader(reader, rowBuffer)
      if (primary.predictor === 2) {
        reverseHorizontalPredictorInPlace(rowBuffer, bytesPerPixel)
      }
      onRow(currentRow, rowBuffer)
      currentRow += 1
    }
  }
}

function writeTiffPixelToRgba(source: Uint8Array, sourceOffset: number, primary: ParsedTiffIfd, target: Uint8ClampedArray, targetOffset: number): void {
  if (primary.photometric === 5) {
    const [red, green, blue] = cmykToRgb(
      source[sourceOffset] ?? 0,
      source[sourceOffset + 1] ?? 0,
      source[sourceOffset + 2] ?? 0,
      source[sourceOffset + 3] ?? 0,
    )
    target[targetOffset] = red
    target[targetOffset + 1] = green
    target[targetOffset + 2] = blue
    target[targetOffset + 3] = 255
    return
  }

  if (primary.photometric === 0 || primary.photometric === 1) {
    const gray = source[sourceOffset] ?? 0
    const normalizedGray = primary.photometric === 0 ? 255 - gray : gray
    target[targetOffset] = normalizedGray
    target[targetOffset + 1] = normalizedGray
    target[targetOffset + 2] = normalizedGray
    target[targetOffset + 3] = primary.hasAlpha ? (source[sourceOffset + 1] ?? 255) : 255
    return
  }

  target[targetOffset] = source[sourceOffset] ?? 0
  target[targetOffset + 1] = source[sourceOffset + 1] ?? source[sourceOffset] ?? 0
  target[targetOffset + 2] = source[sourceOffset + 2] ?? source[sourceOffset] ?? 0
  target[targetOffset + 3] = primary.hasAlpha ? (source[sourceOffset + 3] ?? 255) : 255
}

function buildNearestSourceIndexMap(sourceLength: number, targetLength: number): Uint32Array {
  const safeSource = Math.max(1, sourceLength)
  const safeTarget = Math.max(1, targetLength)
  const ratio = safeSource / safeTarget
  const output = new Uint32Array(safeTarget)
  for (let index = 0; index < safeTarget; index += 1) {
    output[index] = Math.min(safeSource - 1, Math.floor((index + 0.5) * ratio))
  }
  return output
}

function buildSourceRowTargets(sourceHeight: number, targetHeight: number): Map<number, number[]> {
  const sourceRows = buildNearestSourceIndexMap(sourceHeight, targetHeight)
  const targetsBySource = new Map<number, number[]>()
  for (let targetY = 0; targetY < sourceRows.length; targetY += 1) {
    const sourceY = sourceRows[targetY] ?? 0
    const targets = targetsBySource.get(sourceY) ?? []
    targets.push(targetY)
    targetsBySource.set(sourceY, targets)
  }
  return targetsBySource
}

export function buildDownsamplePlan(width: number, height: number, maxDimension: number): PatternDownsamplePlan {
  const safeWidth = Math.max(1, width)
  const safeHeight = Math.max(1, height)
  const safeMaxDimension = Math.max(1, maxDimension)
  const scale = Math.min(1, safeMaxDimension / Math.max(safeWidth, safeHeight))
  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
    scale,
  }
}

export function downsampleRgba(
  rgba: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): Uint8ClampedArray {
  const safeTargetWidth = Math.max(1, targetWidth)
  const safeTargetHeight = Math.max(1, targetHeight)
  const xMap = buildNearestSourceIndexMap(sourceWidth, safeTargetWidth)
  const yMap = buildNearestSourceIndexMap(sourceHeight, safeTargetHeight)
  const output = new Uint8ClampedArray(safeTargetWidth * safeTargetHeight * 4)

  for (let targetY = 0; targetY < safeTargetHeight; targetY += 1) {
    const sourceY = yMap[targetY] ?? 0
    for (let targetX = 0; targetX < safeTargetWidth; targetX += 1) {
      const sourceX = xMap[targetX] ?? 0
      const sourceOffset = (sourceY * Math.max(1, sourceWidth) + sourceX) * 4
      const targetOffset = (targetY * safeTargetWidth + targetX) * 4
      output[targetOffset] = rgba[sourceOffset] ?? 0
      output[targetOffset + 1] = rgba[sourceOffset + 1] ?? 0
      output[targetOffset + 2] = rgba[sourceOffset + 2] ?? 0
      output[targetOffset + 3] = rgba[sourceOffset + 3] ?? 255
    }
  }

  return output
}

export function decodeTiffToSampledRgba(
  buffer: ArrayBuffer,
  options: PatternTiffSampledDecodeOptions,
): PatternSampledRgbaImage {
  const { ifds } = parseTiffIfds(buffer)
  const validated = validateTiffDecodeInput(ifds[0], options)
  const { primary, bitsPerSample, bytesPerPixel } = validated
  const plan = buildDownsamplePlan(primary.width!, primary.height!, options.maxDimension)
  const rgba = new Uint8ClampedArray(plan.width * plan.height * 4)
  const sourceXMap = buildNearestSourceIndexMap(primary.width!, plan.width)
  const targetRowsBySource = buildSourceRowTargets(primary.height!, plan.height)

  forEachDecodedTiffRow(buffer, primary, bytesPerPixel, (sourceY, rowBytes) => {
    const targetRows = targetRowsBySource.get(sourceY)
    if (!targetRows?.length) return

    for (const targetY of targetRows) {
      const rowTargetOffset = targetY * plan.width * 4
      for (let targetX = 0; targetX < plan.width; targetX += 1) {
        const sourceX = sourceXMap[targetX] ?? 0
        const sourceOffset = sourceX * bytesPerPixel
        const targetOffset = rowTargetOffset + targetX * 4
        writeTiffPixelToRgba(rowBytes, sourceOffset, primary, rgba, targetOffset)
      }
    }
  })

  return {
    width: plan.width,
    height: plan.height,
    originalWidth: primary.width!,
    originalHeight: primary.height!,
    rgba,
    dpiX: primary.dpiX,
    dpiY: primary.dpiY,
    frameCount: ifds.length || 1,
    colorMode: primary.colorMode,
    hasAlpha: primary.hasAlpha,
    compression: primary.compression,
    predictor: primary.predictor,
    bitsPerSample,
    samplesPerPixel: primary.samplesPerPixel,
    planarConfiguration: primary.planarConfiguration,
    warnings: [],
  }
}

function cmykToRgb(cyan: number, magenta: number, yellow: number, key: number): [number, number, number] {
  const c = cyan / 255
  const m = magenta / 255
  const y = yellow / 255
  const k = key / 255
  return [
    Math.round(255 * (1 - c) * (1 - k)),
    Math.round(255 * (1 - m) * (1 - k)),
    Math.round(255 * (1 - y) * (1 - k)),
  ]
}

export function decodeTiffToRgba(buffer: ArrayBuffer, options: PatternTiffDecodeOptions = {}): PatternDecodedRgbaImage {
  const { ifds } = parseTiffIfds(buffer)
  const validated = validateTiffDecodeInput(ifds[0], options)
  const { primary, bitsPerSample, bytesPerPixel } = validated
  const rgba = new Uint8ClampedArray(primary.width! * primary.height! * 4)

  forEachDecodedTiffRow(buffer, primary, bytesPerPixel, (sourceY, rowBytes) => {
    const rowTargetOffset = sourceY * primary.width! * 4
    for (let sourceX = 0; sourceX < primary.width!; sourceX += 1) {
      writeTiffPixelToRgba(rowBytes, sourceX * bytesPerPixel, primary, rgba, rowTargetOffset + sourceX * 4)
    }
  })

  return {
    width: primary.width!,
    height: primary.height!,
    rgba,
    dpiX: primary.dpiX,
    dpiY: primary.dpiY,
    frameCount: ifds.length || 1,
    colorMode: primary.colorMode,
    hasAlpha: primary.hasAlpha,
    compression: primary.compression,
    predictor: primary.predictor,
    bitsPerSample,
    samplesPerPixel: primary.samplesPerPixel,
    planarConfiguration: primary.planarConfiguration,
  }
}

export function buildParseSummary(
  ext: string,
  imageWidth?: number,
  imageHeight?: number,
  dpiX?: number,
  dpiY?: number,
  frameCount?: number,
): string {
  const sizeLabel = imageWidth && imageHeight ? `${imageWidth} x ${imageHeight}` : '尺寸待人工确认'
  const dpiLabel = dpiX && dpiY ? `${dpiX}/${dpiY} DPI` : 'DPI 未识别'
  const frameLabel = frameCount && frameCount > 1 ? `，共 ${frameCount} 页` : ''
  return `${ext.toUpperCase()} 文件，${sizeLabel}，${dpiLabel}${frameLabel}`
}

export function getPatternSimilarityStatusText(phash?: string, duplicateCount = 0): string {
  if (!phash) return '视觉相似检测未完成'
  if (duplicateCount > 0) return `已命中 ${duplicateCount} 条相似结果`
  return '未命中视觉相似花型'
}

export function validatePatternSubmitEligibility(input: {
  patternName?: string
  parseStatus?: PatternParsedFileResult['parseStatus'] | PatternAsset['parse_status']
}): { valid: true } | { valid: false; message: string; field?: string } {
  if (!input.patternName?.trim()) {
    return { valid: false, message: '花型名称为必填项。', field: 'patternName' }
  }
  if (input.parseStatus !== 'success') {
    return { valid: false, message: '解析成功后才允许提交审核。' }
  }
  return { valid: true }
}

export function buildPatternTagSuggestions(input: {
  filename: string
  tokens: PatternFilenameToken[]
  dominantColors: string[]
  width?: number
  height?: number
  config: PatternLibraryConfig
}): Array<Omit<PatternTagRecord, 'id' | 'pattern_asset_id'>> {
  const result: Array<Omit<PatternTagRecord, 'id' | 'pattern_asset_id'>> = []
  const normalizedTokens = input.tokens.map((token) => token.normalized)
  const pushSuggestion = (
    tag_name: string,
    tag_type: PatternTagRecord['tag_type'],
    confidence: number,
    source: PatternTagRecord['source'] = 'rule',
  ) => {
    if (!tag_name) return
    if (result.some((item) => item.tag_name === tag_name && item.tag_type === tag_type)) return
    result.push({
      pattern_file_version_id: undefined,
      tag_name,
      tag_type,
      source,
      confidence,
      locked: false,
    })
  }

  if (input.config.ruleToggles.primaryColor) {
    input.dominantColors.slice(0, 2).forEach((color, index) => pushSuggestion(color, '主色系', index === 0 ? 0.96 : 0.82))
  }

  if (input.config.ruleToggles.category) {
    Object.entries(CATEGORY_KEYWORDS).forEach(([label, keywords]) => {
      if (keywords.some((keyword) => normalizedTokens.some((token) => token.includes(keyword)))) {
        pushSuggestion(label, '题材分类', 0.74)
      }
    })
  }

  if (input.config.ruleToggles.usageType) {
    let usageType = ''
    Object.entries(USAGE_KEYWORDS).forEach(([label, keywords]) => {
      if (!usageType && keywords.some((keyword) => normalizedTokens.some((token) => token.includes(keyword)))) {
        usageType = label
      }
    })

    if (!usageType && input.width && input.height) {
      const aspectRatio = input.width / Math.max(input.height, 1)
      usageType = aspectRatio > 1.55 ? '定位花' : aspectRatio < 1.05 ? '重复花' : '满印'
    }
    pushSuggestion(usageType || '重复花', '花型使用方式', usageType ? 0.78 : 0.56)
  }

  Object.entries(STYLE_KEYWORDS).forEach(([label, keywords]) => {
    if (keywords.some((keyword) => normalizedTokens.some((token) => token.includes(keyword)))) {
      pushSuggestion(label, '风格标签', 0.67)
    }
  })

  if (input.config.ruleToggles.filenameTokens) {
    input.tokens.slice(0, 6).forEach((token) => pushSuggestion(token.token, '文件名Token', clamp(token.score, 0.45, 0.88)))
  }

  return result
}

export function getPatternSimilarityHit(input: {
  assetId: string
  versionId: string
  currentSha256?: string
  currentPhash?: string
  candidateSha256?: string
  candidatePhash?: string
  threshold: number
}): PatternSimilarityHit | null {
  if (input.currentSha256 && input.candidateSha256 && input.currentSha256 === input.candidateSha256) {
    return {
      assetId: input.assetId,
      versionId: input.versionId,
      duplicateType: 'sha256',
      similarity: 1,
      distance: 0,
    }
  }
  const distance = hammingDistance(input.currentPhash, input.candidatePhash)
  if (!Number.isFinite(distance) || distance > input.threshold) return null
  return {
    assetId: input.assetId,
    versionId: input.versionId,
    duplicateType: 'phash',
    distance,
    similarity: Number(Math.max(0.5, 1 - distance / 64).toFixed(2)),
  }
}

export function inferDuplicateStatus(hits: PatternSimilarityHit[]): PatternDuplicateStatus {
  if (hits.some((item) => item.duplicateType === 'sha256')) return 'merged'
  if (hits.length > 0) return 'suspected'
  return 'unique'
}

export async function sha256Hex(buffer: ArrayBuffer): Promise<string | undefined> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return undefined
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return bufferToHex(digest)
}
