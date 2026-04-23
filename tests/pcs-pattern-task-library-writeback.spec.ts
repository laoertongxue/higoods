import assert from 'node:assert/strict'

import { createPatternAsset } from '../src/data/pcs-pattern-library.ts'
import type { PatternParsedFileResult } from '../src/data/pcs-pattern-library-types.ts'

const parsedFile: PatternParsedFileResult = {
  originalFilename: 'pattern-task.png',
  fileExt: 'png',
  mimeType: 'image/png',
  fileSize: 1024,
  imageWidth: 100,
  imageHeight: 100,
  aspectRatio: 1,
  colorMode: 'RGB',
  dpiX: 300,
  dpiY: 300,
  frameCount: 1,
  hasAlpha: false,
  filenameTokens: [
    {
      token: 'pattern-task',
      normalized: 'pattern-task',
      category: 'word',
      score: 0.8,
    },
  ],
  previewUrl: 'mock://pattern-task/preview.png',
  thumbnailUrl: 'mock://pattern-task/thumb.png',
  parseStatus: 'success',
  parseSummary: '解析完成',
  dominantColors: ['综合色'],
  parseWarnings: [],
  parseResultJson: {},
}

const asset = createPatternAsset({
  patternName: '正式花型资产',
  aliases: ['AT-TEST'],
  usageType: '数码印',
  category: '植物与花卉',
  categoryPrimary: '植物与花卉',
  categorySecondary: '写实花卉',
  styleTags: ['热带', '度假'],
  colorTags: ['综合色'],
  hotFlag: true,
  sourceType: '自研',
  sourceNote: '由花型任务沉淀',
  applicableCategories: ['连衣裙'],
  applicableParts: ['前片'],
  relatedPartTemplateIds: [],
  processDirection: '按花型任务输出使用',
  maintenanceStatus: '已维护',
  license: {
    license_status: 'authorized',
    attachment_urls: [],
    copyright_owner: 'HiGood',
    license_scope: '内部研发使用',
  },
  createdBy: '当前用户',
  submitForReview: false,
  parsedFile,
  sourceTaskId: 'pattern_task_test',
  sourceProjectId: 'project_test',
  sourcePatternTaskSnapshot: {
    demand_source_type: '设计师款',
    process_type: '数码印',
    request_qty: 2,
    fabric_name: '雪纺印花坯布',
    assigned_team_name: '中国团队',
    assigned_member_name: '单单',
    buyer_review_status: '买手已通过',
  },
})

assert.equal(asset.category_primary, '植物与花卉')
assert.deepEqual(asset.style_tags, ['热带', '度假'])
assert.equal(asset.hot_flag, true)
assert.equal(asset.source_task_id, 'pattern_task_test')
assert.equal(asset.source_pattern_task_snapshot?.process_type, '数码印')
assert.equal(asset.source_pattern_task_snapshot?.buyer_review_status, '买手已通过')

console.log('pcs-pattern-task-library-writeback.spec.ts PASS')
