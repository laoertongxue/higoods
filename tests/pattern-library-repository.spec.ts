import assert from 'node:assert/strict'
import {
  approvePatternAsset,
  createPatternAsset,
  getPatternReferenceAvailability,
  listPatternDuplicateCandidates,
  resetPatternLibraryStore,
  submitPatternAssetReview,
  updatePatternAsset,
} from '../src/data/pcs-pattern-library.ts'
import { tokenizePatternFilename } from '../src/utils/pcs-pattern-library-services.ts'
import type { PatternParsedFileResult } from '../src/data/pcs-pattern-library-types.ts'

function buildParsedFile(seed: { fileName: string; sha256: string; phash: string }): PatternParsedFileResult {
  const ext = seed.fileName.split('.').pop()?.toLowerCase() ?? 'tif'
  return {
    originalFilename: seed.fileName,
    fileExt: ext,
    mimeType: ext === 'tif' || ext === 'tiff' ? 'image/tiff' : 'image/png',
    fileSize: 102400,
    imageWidth: 1800,
    imageHeight: 2400,
    aspectRatio: 0.75,
    colorMode: 'RGB',
    dpiX: 300,
    dpiY: 300,
    frameCount: 1,
    hasAlpha: false,
    sha256: seed.sha256,
    phash: seed.phash,
    filenameTokens: tokenizePatternFilename(seed.fileName),
    previewUrl: 'data:image/png;base64,seed',
    thumbnailUrl: 'data:image/png;base64,seed',
    parseStatus: 'success',
    parseSummary: 'TIFF 文件，1800 x 2400，300/300 DPI',
    dominantColors: ['红色', '绿色'],
    parseWarnings: [],
    parseResultJson: { decoder: 'worker:tiff', compression: 5, predictor: 2 },
  }
}

resetPatternLibraryStore()

const draft = createPatternAsset({
  patternName: '测试花型 A',
  aliases: ['测试别名'],
  usageType: '定位花',
  category: '花卉',
  styleTags: ['法式'],
  colorTags: ['红色', '绿色'],
  hotFlag: false,
  sourceType: '自研',
  sourceNote: '自动化测试',
  applicableCategories: ['连衣裙'],
  applicableParts: ['前片'],
  relatedPartTemplateIds: [],
  processDirection: '印花',
  maintenanceStatus: '待补录',
  sourceTaskId: 'AT-20260109-001',
  sourceProjectId: 'PRJ-20251216-001',
  createdBy: '测试用户',
  submitForReview: false,
  parsedFile: buildParsedFile({
    fileName: 'Test-Pattern-A.tif',
    sha256: 'test-sha-001',
    phash: '101010101010101010101010101010101010101010101010101010101010101',
  }),
  license: {
    license_status: 'authorized',
    copyright_owner: 'HiGood',
    license_owner: 'HiGood',
    license_scope: '测试范围',
    attachment_urls: [],
  },
})

assert.equal(draft.review_status, 'draft', '默认保存草稿时应为 draft')

const duplicateHits = listPatternDuplicateCandidates(
  buildParsedFile({
    fileName: 'Test-Pattern-A-Copy.tif',
    sha256: 'test-sha-001',
    phash: '101010101010101010101010101010101010101010101010101010101010101',
  }),
)
assert.ok(duplicateHits.some((item) => item.asset.id === draft.id), '完全重复文件应命中疑似重复')

const pending = submitPatternAssetReview(draft.id, '测试审核员')
assert.equal(pending.review_status, 'pending', '提交审核后应为 pending')

const approved = approvePatternAsset(draft.id, '测试审核员', '审核通过')
assert.equal(approved.review_status, 'approved', '审核通过后应为 approved')
assert.equal(getPatternReferenceAvailability(draft.id).allowed, true, '审核通过且授权可用时应允许引用')

updatePatternAsset(draft.id, {
  updatedBy: '测试审核员',
  license: {
    license_status: 'expired',
  },
})
assert.equal(getPatternReferenceAvailability(draft.id).allowed, false, '授权过期后应禁止新增引用')

const failedDraft = createPatternAsset({
  patternName: '解析失败花型',
  aliases: [],
  usageType: '定位花',
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
  parsedFile: {
    ...buildParsedFile({
      fileName: 'Broken-Pattern.tif',
      sha256: 'test-sha-failed',
      phash: '',
    }),
    phash: undefined,
    parseStatus: 'failed',
    parseErrorMessage: 'TIFF 解析失败',
    parseSummary: 'TIFF 解析失败，请重试',
  },
  license: {
    license_status: 'authorized',
    attachment_urls: [],
  },
})

assert.throws(
  () => submitPatternAssetReview(failedDraft.id, '测试审核员'),
  /解析成功后才允许提交审核/,
  '解析失败的花型不应允许提交审核',
)

console.log('pattern-library-repository.spec.ts PASS')
