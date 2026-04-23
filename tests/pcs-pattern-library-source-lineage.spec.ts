import assert from 'node:assert/strict'

import { createPatternAsset } from '../src/data/pcs-pattern-library.ts'
import type { PatternParsedFileResult } from '../src/data/pcs-pattern-library-types.ts'

const parsedFile: PatternParsedFileResult = {
  originalFilename: 'closure-lineage.png',
  fileExt: 'png',
  mimeType: 'image/png',
  fileSize: 2048,
  imageWidth: 120,
  imageHeight: 120,
  aspectRatio: 1,
  colorMode: 'RGB',
  dpiX: 300,
  dpiY: 300,
  frameCount: 1,
  hasAlpha: false,
  filenameTokens: [{ token: 'closure', normalized: 'closure', category: 'word', score: 0.8 }],
  previewUrl: 'mock://pattern-library/closure-preview.png',
  thumbnailUrl: 'mock://pattern-library/closure-thumb.png',
  parseStatus: 'success',
  parseSummary: '解析完成',
  dominantColors: ['综合色'],
  parseWarnings: [],
  parseResultJson: {},
}

const asset = createPatternAsset({
  patternName: '闭环来源花型',
  aliases: ['CLOSURE-LINEAGE'],
  usageType: '数码印',
  category: '植物与花卉',
  categoryPrimary: '植物与花卉',
  categorySecondary: '写实花卉',
  styleTags: ['热带', '复古'],
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
  createdBy: '测试用户',
  submitForReview: false,
  parsedFile,
  sourceTaskId: 'pattern_task_lineage_test',
  sourceTaskCode: 'PTN-LINEAGE-TEST',
  sourceTaskType: 'PATTERN_ARTWORK_TASK',
  sourceTaskName: '花型任务来源验证',
  sourceProjectId: 'project_lineage_test',
  sourceTechPackVersionId: 'tdv_lineage_test',
  sourceTechPackVersionCode: 'TDV-LINEAGE-TEST',
  buyerReviewStatus: '买手已通过',
  difficultyGrade: 'A',
  assignedTeamCode: 'CN_TEAM',
  assignedTeamName: '中国团队',
  assignedMemberId: 'cn_dandan',
  assignedMemberName: '单单',
})

assert.equal(asset.source_task_code, 'PTN-LINEAGE-TEST')
assert.equal(asset.source_task_type, 'PATTERN_ARTWORK_TASK')
assert.equal(asset.source_task_name, '花型任务来源验证')
assert.equal(asset.source_tech_pack_version_id, 'tdv_lineage_test')
assert.equal(asset.source_tech_pack_version_code, 'TDV-LINEAGE-TEST')
assert.equal(asset.buyer_review_status, '买手已通过')
assert.equal(asset.difficulty_grade, 'A')
assert.equal(asset.assigned_team_code, 'CN_TEAM')
assert.equal(asset.assigned_member_id, 'cn_dandan')
assert.equal(asset.hot_flag, true)
assert.deepEqual(asset.style_tags, ['热带', '复古'])
assert.equal(asset.category_primary, '植物与花卉')
assert.equal(asset.category_secondary, '写实花卉')

console.log('pcs-pattern-library-source-lineage.spec.ts PASS')
