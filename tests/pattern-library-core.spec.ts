import assert from 'node:assert/strict'
import {
  buildDownsamplePlan,
  DEFAULT_PATTERN_CATEGORY_TREE,
  decodeTiffToRgba,
  decodeTiffToSampledRgba,
  formatPatternCategoryTreeText,
  getPatternCategorySuggestions,
  getPatternSimilarityStatusText,
  parsePatternCategoryTreeText,
  parseJpegMetadata,
  parsePngMetadata,
  parseTiffMetadata,
  tokenizePatternFilename,
  validatePatternSubmitEligibility,
} from '../src/utils/pcs-pattern-library-core.ts'

function buildPngBuffer(): ArrayBuffer {
  return Uint8Array.from([
    137, 80, 78, 71, 13, 10, 26, 10,
    0, 0, 0, 13, 73, 72, 68, 82,
    0, 0, 0, 2, 0, 0, 0, 3, 8, 2, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 9, 112, 72, 89, 115,
    0, 0, 46, 35, 0, 0, 46, 35, 1,
    0, 0, 0, 0,
  ]).buffer
}

function buildJpegBuffer(): ArrayBuffer {
  return Uint8Array.from([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x10,
    0x4a, 0x46, 0x49, 0x46, 0x00,
    0x01, 0x01,
    0x01,
    0x01, 0x2c,
    0x01, 0x2c,
    0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11,
    0x08,
    0x00, 0x20,
    0x00, 0x10,
    0x03,
    0x01, 0x11, 0x00,
    0x02, 0x11, 0x00,
    0x03, 0x11, 0x00,
    0xff, 0xd9,
  ]).buffer
}

function applyHorizontalPredictorForEncoding(bytes: Uint8Array, width: number, bytesPerPixel: number): Uint8Array {
  const output = bytes.slice()
  const rowLength = width * bytesPerPixel
  for (let rowOffset = 0; rowOffset < output.length; rowOffset += rowLength) {
    for (let offset = rowOffset + rowLength - 1; offset >= rowOffset + bytesPerPixel; offset -= 1) {
      output[offset] = (bytes[offset] - bytes[offset - bytesPerPixel] + 256) & 0xff
    }
  }
  return output
}

function encodeTiffLzw(bytes: Uint8Array): Uint8Array {
  const clearCode = 256
  const eoiCode = 257
  const output: number[] = []
  const dictionary = new Map<string, number>()
  for (let index = 0; index < 256; index += 1) {
    dictionary.set(String(index), index)
  }

  let codeSize = 9
  let nextCode = 258
  let bitBuffer = 0
  let bitsInBuffer = 0

  const writeCode = (code: number) => {
    bitBuffer = (bitBuffer << codeSize) | code
    bitsInBuffer += codeSize
    while (bitsInBuffer >= 8) {
      output.push((bitBuffer >> (bitsInBuffer - 8)) & 0xff)
      bitsInBuffer -= 8
      bitBuffer = bitsInBuffer > 0 ? bitBuffer & ((1 << bitsInBuffer) - 1) : 0
    }
  }

  writeCode(clearCode)
  let prefix = String(bytes[0] ?? 0)
  for (let index = 1; index < bytes.length; index += 1) {
    const value = bytes[index] ?? 0
    const candidate = `${prefix},${value}`
    if (dictionary.has(candidate)) {
      prefix = candidate
      continue
    }

    writeCode(dictionary.get(prefix) ?? 0)
    if (nextCode < 4096) {
      dictionary.set(candidate, nextCode)
      nextCode += 1
      if (nextCode === (1 << codeSize) - 1 && codeSize < 12) {
        codeSize += 1
      }
    }
    prefix = String(value)
  }

  writeCode(dictionary.get(prefix) ?? 0)
  writeCode(eoiCode)
  if (bitsInBuffer > 0) {
    output.push((bitBuffer << (8 - bitsInBuffer)) & 0xff)
  }
  return Uint8Array.from(output)
}

function buildRgbTiffBuffer(options: {
  width?: number
  height?: number
  compression?: number
  predictor?: number
  pixels?: number[]
} = {}): ArrayBuffer {
  const width = options.width ?? 2
  const height = options.height ?? 2
  const compression = options.compression ?? 1
  const predictor = options.predictor ?? 1
  const rawPixels = Uint8Array.from(
    options.pixels ?? [
      255, 0, 0,
      0, 255, 0,
      0, 0, 255,
      255, 255, 0,
    ],
  )
  const predictedPixels = predictor === 2 ? applyHorizontalPredictorForEncoding(rawPixels, width, 3) : rawPixels
  const stripBytes = compression === 5 ? encodeTiffLzw(predictedPixels) : predictedPixels

  const entryCount = 14
  const bitsOffset = 8 + 2 + entryCount * 12 + 4
  const xResOffset = bitsOffset + 6
  const yResOffset = xResOffset + 8
  const pixelOffset = yResOffset + 8
  const bytes = new Uint8Array(pixelOffset + stripBytes.length)
  const view = new DataView(bytes.buffer)

  bytes[0] = 0x49
  bytes[1] = 0x49
  view.setUint16(2, 42, true)
  view.setUint32(4, 8, true)
  view.setUint16(8, entryCount, true)

  const entries = [
    [256, 4, 1, width],
    [257, 4, 1, height],
    [258, 3, 3, bitsOffset],
    [259, 3, 1, compression],
    [262, 3, 1, 2],
    [273, 4, 1, pixelOffset],
    [277, 3, 1, 3],
    [278, 4, 1, height],
    [279, 4, 1, stripBytes.length],
    [282, 5, 1, xResOffset],
    [283, 5, 1, yResOffset],
    [284, 3, 1, 1],
    [296, 3, 1, 2],
    [317, 3, 1, predictor],
  ] as const

  entries.forEach((entry, index) => {
    const offset = 10 + index * 12
    view.setUint16(offset, entry[0], true)
    view.setUint16(offset + 2, entry[1], true)
    view.setUint32(offset + 4, entry[2], true)
    if (entry[1] === 3 && entry[2] === 1) {
      view.setUint16(offset + 8, entry[3], true)
      view.setUint16(offset + 10, 0, true)
    } else {
      view.setUint32(offset + 8, entry[3], true)
    }
  })

  view.setUint32(10 + entryCount * 12, 0, true)
  view.setUint16(bitsOffset, 8, true)
  view.setUint16(bitsOffset + 2, 8, true)
  view.setUint16(bitsOffset + 4, 8, true)
  view.setUint32(xResOffset, 300, true)
  view.setUint32(xResOffset + 4, 1, true)
  view.setUint32(yResOffset, 300, true)
  view.setUint32(yResOffset + 4, 1, true)
  bytes.set(stripBytes, pixelOffset)

  return bytes.buffer
}

const pngMeta = parsePngMetadata(buildPngBuffer())
assert.equal(pngMeta.width, 2, 'PNG 应解析宽度')
assert.equal(pngMeta.height, 3, 'PNG 应解析高度')
assert.equal(Math.round(pngMeta.dpiX ?? 0), 300, 'PNG 应解析 DPI X')

const jpegMeta = parseJpegMetadata(buildJpegBuffer())
assert.equal(jpegMeta.width, 16, 'JPEG 应解析宽度')
assert.equal(jpegMeta.height, 32, 'JPEG 应解析高度')
assert.equal(jpegMeta.dpiY, 300, 'JPEG 应解析 DPI Y')

const lzwTiffBuffer = buildRgbTiffBuffer({ compression: 5, predictor: 1 })
const lzwMeta = parseTiffMetadata(lzwTiffBuffer)
assert.equal(lzwMeta.width, 2, 'LZW TIFF 应解析宽度')
assert.equal(lzwMeta.height, 2, 'LZW TIFF 应解析高度')
assert.equal(lzwMeta.compression, 5, 'LZW TIFF 应解析压缩类型')
assert.equal(lzwMeta.predictor, 1, 'LZW TIFF 应解析 Predictor')
assert.equal(lzwMeta.frameCount, 1, 'LZW TIFF 应解析页数')

const decodedLzw = decodeTiffToRgba(lzwTiffBuffer)
assert.equal(decodedLzw.width, 2, 'LZW TIFF 解码后应保留宽度')
assert.equal(decodedLzw.height, 2, 'LZW TIFF 解码后应保留高度')
assert.deepEqual(
  Array.from(decodedLzw.rgba.slice(0, 8)),
  [255, 0, 0, 255, 0, 255, 0, 255],
  'LZW TIFF 应解码出正确 RGBA 数据',
)

const predictorTiffBuffer = buildRgbTiffBuffer({
  width: 2,
  height: 1,
  compression: 5,
  predictor: 2,
  pixels: [10, 20, 30, 15, 30, 45],
})
const predictorMeta = parseTiffMetadata(predictorTiffBuffer)
assert.equal(predictorMeta.predictor, 2, 'Predictor=2 TIFF 应解析 Predictor')

const decodedPredictor = decodeTiffToRgba(predictorTiffBuffer)
assert.deepEqual(
  Array.from(decodedPredictor.rgba.slice(0, 8)),
  [10, 20, 30, 255, 15, 30, 45, 255],
  'Predictor=2 的 LZW TIFF 应还原正确像素',
)

const sampledLzw = decodeTiffToSampledRgba(lzwTiffBuffer, { maxDimension: 1 })
assert.equal(sampledLzw.width, 1, 'sampled decode 应遵守预览尺寸限制')
assert.equal(sampledLzw.height, 1, 'sampled decode 应遵守预览尺寸限制')
assert.equal(sampledLzw.originalWidth, 2, 'sampled decode 应保留原始宽度')
assert.equal(sampledLzw.originalHeight, 2, 'sampled decode 应保留原始高度')

const previewPlan = buildDownsamplePlan(17008, 22205, 1600)
assert.equal(Math.max(previewPlan.width, previewPlan.height), 1600, '预览计划长边应限制在 1600')

const analysisPlan = buildDownsamplePlan(17008, 22205, 256)
assert.equal(Math.max(analysisPlan.width, analysisPlan.height), 256, '分析计划长边应限制在 256')

assert.throws(
  () => decodeTiffToRgba(buildRgbTiffBuffer({ compression: 8 })),
  /当前原型暂仅支持未压缩 \/ LZW \/ PackBits TIFF，当前压缩类型为 8/,
  '仍不支持的压缩类型应给出明确错误',
)

assert.equal(getPatternSimilarityStatusText(undefined, 0), '视觉相似检测未完成', 'pHash 缺失时文案应真实')
assert.equal(
  getPatternSimilarityStatusText('10101010', 0),
  '未命中当前库中的完全重复 / 视觉相似候选',
  '未命中候选时文案不应误导为业务唯一',
)
assert.equal(
  getPatternSimilarityStatusText('10101010', 2),
  '已命中 2 条疑似重复候选',
  '命中候选时应准确表述为疑似重复候选',
)

const categorySuggestions = getPatternCategorySuggestions({
  tokens: tokenizePatternFilename('Tropical-Flower-Stripe.png'),
})
assert.equal(categorySuggestions[0]?.primary, '植物与花卉', '应能命中一级分类建议')
assert.equal(categorySuggestions[0]?.secondary, '写实花卉', '应能命中二级分类建议')

const categoryTreeText = formatPatternCategoryTreeText(DEFAULT_PATTERN_CATEGORY_TREE)
const parsedTree = parsePatternCategoryTreeText(categoryTreeText)
assert.equal(parsedTree[0]?.value, '动物纹理', '分类树格式化后应可再解析为一级分类')
assert.equal(parsedTree[0]?.children[0]?.value, '写实动物', '分类树格式化后应可再解析为二级分类')

assert.equal(
  validatePatternSubmitEligibility({ patternName: '测试花型', parseStatus: 'failed' }).valid,
  false,
  '解析未成功时应禁止提交审核',
)

console.log('pattern-library-core.spec.ts PASS')
