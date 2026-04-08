import assert from 'node:assert/strict'
import {
  decodeTiffToRgba,
  getPatternSimilarityStatusText,
  parseJpegMetadata,
  parsePngMetadata,
  parseTiffMetadata,
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

function buildRgbTiffBuffer(): ArrayBuffer {
  const bytes = new Uint8Array(200)
  const view = new DataView(bytes.buffer)

  bytes[0] = 0x49
  bytes[1] = 0x49
  view.setUint16(2, 42, true)
  view.setUint32(4, 8, true)
  view.setUint16(8, 12, true)

  const entriesOffset = 10
  const bitsOffset = 8 + 2 + 12 * 12 + 4
  const xResOffset = bitsOffset + 6
  const yResOffset = xResOffset + 8
  const pixelOffset = yResOffset + 8

  const entries = [
    [256, 4, 1, 2],
    [257, 4, 1, 2],
    [258, 3, 3, bitsOffset],
    [259, 3, 1, 1],
    [262, 3, 1, 2],
    [273, 4, 1, pixelOffset],
    [277, 3, 1, 3],
    [278, 4, 1, 2],
    [279, 4, 1, 12],
    [282, 5, 1, xResOffset],
    [283, 5, 1, yResOffset],
    [296, 3, 1, 2],
  ] as const

  entries.forEach((entry, index) => {
    const offset = entriesOffset + index * 12
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

  view.setUint32(entriesOffset + entries.length * 12, 0, true)
  view.setUint16(bitsOffset, 8, true)
  view.setUint16(bitsOffset + 2, 8, true)
  view.setUint16(bitsOffset + 4, 8, true)
  view.setUint32(xResOffset, 300, true)
  view.setUint32(xResOffset + 4, 1, true)
  view.setUint32(yResOffset, 300, true)
  view.setUint32(yResOffset + 4, 1, true)

  bytes.set([
    255, 0, 0,
    0, 255, 0,
    0, 0, 255,
    255, 255, 0,
  ], pixelOffset)

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

const tiffBuffer = buildRgbTiffBuffer()
const tiffMeta = parseTiffMetadata(tiffBuffer)
assert.equal(tiffMeta.width, 2, 'TIFF 应解析宽度')
assert.equal(tiffMeta.height, 2, 'TIFF 应解析高度')
assert.equal(tiffMeta.frameCount, 1, 'TIFF 应解析页数')
assert.equal(tiffMeta.colorMode, 'RGB', 'TIFF 应解析颜色模式')

const decodedTiff = decodeTiffToRgba(tiffBuffer)
assert.equal(decodedTiff.width, 2, 'TIFF 解码后应保留宽度')
assert.equal(decodedTiff.height, 2, 'TIFF 解码后应保留高度')
assert.deepEqual(
  Array.from(decodedTiff.rgba.slice(0, 8)),
  [255, 0, 0, 255, 0, 255, 0, 255],
  'TIFF 解码后应能生成预览所需 RGBA 数据',
)

assert.equal(getPatternSimilarityStatusText(undefined, 0), '视觉相似检测未完成', 'pHash 缺失时文案应真实')
assert.equal(
  validatePatternSubmitEligibility({ patternName: '测试花型', parseStatus: 'failed' }).valid,
  false,
  '解析未成功时应禁止提交审核',
)

console.log('pattern-library-core.spec.ts PASS')
