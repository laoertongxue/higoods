import assert from 'node:assert/strict'
import {
  createPatternAsset,
  getPatternAssetById,
  persistPatternParsedFile,
  resetPatternLibraryStore,
  submitPatternAssetReview,
  waitForPatternLibraryPersistence,
} from '../src/data/pcs-pattern-library.ts'
import { tokenizePatternFilename } from '../src/utils/pcs-pattern-library-services.ts'
import type { PatternParsedFileResult } from '../src/data/pcs-pattern-library-types.ts'

function buildParsedFile(parseStatus: PatternParsedFileResult['parseStatus'] = 'success'): PatternParsedFileResult {
  return {
    originalFilename: parseStatus === 'success' ? 'flow-pattern-lzw.tif' : 'broken-pattern.tif',
    fileExt: 'tif',
    mimeType: 'image/tiff',
    fileSize: 4096,
    imageWidth: 1200,
    imageHeight: 1600,
    aspectRatio: 0.75,
    colorMode: 'RGB',
    dpiX: 300,
    dpiY: 300,
    frameCount: 1,
    hasAlpha: false,
    sha256: `sha-${parseStatus}`,
    phash: parseStatus === 'success' ? '101010101010101010101010101010101010101010101010101010101010101' : undefined,
    filenameTokens: tokenizePatternFilename(parseStatus === 'success' ? 'flow-pattern.png' : 'broken-pattern.tif'),
    originalBlob: new Blob(['original']),
    previewBlob: parseStatus === 'success' ? new Blob(['preview']) : undefined,
    thumbnailBlob: parseStatus === 'success' ? new Blob(['thumbnail']) : undefined,
    parseStatus,
    parseErrorMessage: parseStatus === 'success' ? undefined : 'TIFF 解析失败',
    parseSummary: parseStatus === 'success' ? 'TIF 文件，1200 x 1600，300/300 DPI' : 'TIFF 解析失败，请重试',
    dominantColors: parseStatus === 'success' ? ['蓝色'] : [],
    parseWarnings: parseStatus === 'success' ? [] : ['TIFF 解析失败'],
    parseResultJson: parseStatus === 'success'
      ? {
          decoder: 'worker:tiff',
          compression: 5,
          predictor: 2,
          originalWidth: 1200,
          originalHeight: 1600,
          previewWidth: 900,
          previewHeight: 1200,
        }
      : {},
  }
}

resetPatternLibraryStore()

const persistedParsed = await persistPatternParsedFile(buildParsedFile('success'))
assert.ok(persistedParsed.originalBlobKey, '应为原文件生成 Blob key')
assert.ok(persistedParsed.previewBlobKey, '应为预览生成 Blob key')

const asset = createPatternAsset({
  patternName: '流程测试花型',
  aliases: [],
  usageType: '重复花',
  category: '植物与花卉',
  categoryPrimary: '植物与花卉',
  categorySecondary: '写实花卉',
  styleTags: [],
  colorTags: ['蓝色'],
  hotFlag: false,
  sourceType: '自研',
  applicableCategories: [],
  applicableParts: [],
  relatedPartTemplateIds: [],
  processDirection: '印花',
  maintenanceStatus: '待补录',
  createdBy: '测试用户',
  submitForReview: false,
  parsedFile: persistedParsed,
  license: {
    license_status: 'authorized',
    attachment_urls: [],
  },
})

await waitForPatternLibraryPersistence()
assert.equal(asset.review_status, 'draft', '保存草稿后应保持 draft')
assert.equal(asset.category_primary, '植物与花卉', '新建花型应写入一级分类')
assert.equal(asset.category_secondary, '写实花卉', '新建花型应写入二级分类')
assert.ok(getPatternAssetById(asset.id)?.currentVersion?.preview_blob_key, '版本应保存 preview blob key')
assert.equal(getPatternAssetById(asset.id)?.currentVersion?.parse_result_json?.compression, 5, 'LZW TIFF 解析结果应随版本一并保存')

const pending = submitPatternAssetReview(asset.id, '测试审核员')
assert.equal(pending.review_status, 'pending', '提交审核后应转为 pending')

const failedAsset = createPatternAsset({
  patternName: '失败花型',
  aliases: [],
  usageType: '重复花',
  category: '花卉',
  styleTags: [],
  colorTags: [],
  hotFlag: false,
  sourceType: '自研',
  applicableCategories: [],
  applicableParts: [],
  relatedPartTemplateIds: [],
  processDirection: '印花',
  maintenanceStatus: '待补录',
  createdBy: '测试用户',
  submitForReview: false,
  parsedFile: await persistPatternParsedFile(buildParsedFile('failed')),
  license: {
    license_status: 'authorized',
    attachment_urls: [],
  },
})

assert.throws(
  () => submitPatternAssetReview(failedAsset.id, '测试审核员'),
  /解析成功后才允许提交审核/,
  '解析失败记录不应允许提交审核',
)

const legacyAsset = createPatternAsset({
  patternName: '旧数据兼容花型',
  aliases: [],
  usageType: '重复花',
  category: '条纹',
  styleTags: [],
  colorTags: [],
  hotFlag: false,
  sourceType: '自研',
  applicableCategories: [],
  applicableParts: [],
  relatedPartTemplateIds: [],
  processDirection: '印花',
  maintenanceStatus: '待补录',
  createdBy: '测试用户',
  submitForReview: false,
  parsedFile: await persistPatternParsedFile(buildParsedFile('success')),
  license: {
    license_status: 'authorized',
    attachment_urls: [],
  },
})

assert.equal(legacyAsset.category_primary, '几何与抽象', '旧 category 应兼容迁移到一级分类')
assert.equal(legacyAsset.category_secondary, '几何图形', '旧 category 应兼容迁移到二级分类')

console.log('pattern-library-flow.spec.ts PASS')
