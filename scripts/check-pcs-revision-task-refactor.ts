import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function assertIncludes(source: string, pattern: string, message: string): void {
  assert.ok(source.includes(pattern), message)
}

const revisionTypes = read('src/data/pcs-revision-task-types.ts')
const revisionRepository = read('src/data/pcs-revision-task-repository.ts')
const writeback = read('src/data/pcs-task-project-relation-writeback.ts')
const policy = read('src/data/pcs-engineering-task-field-policy.ts')
const domainContract = read('src/data/pcs-project-domain-contract.ts')
const techPackGeneration = read('src/data/pcs-tech-pack-task-generation.ts')
const archiveCollector = read('src/data/pcs-project-archive-collector.ts')
const engineeringPage = read('src/pages/pcs-engineering-tasks.ts')
const projectPage = read('src/pages/pcs-projects.ts')

;[
  'baseStyleId',
  'baseStyleCode',
  'baseStyleName',
  'baseStyleImageIds',
  'targetStyleCodeCandidate',
  'targetStyleNameCandidate',
  'targetStyleImageIds',
  'sampleQty',
  'stylePreference',
  'patternMakerId',
  'patternMakerName',
  'revisionSuggestionRichText',
  'paperPrintAt',
  'deliveryAddress',
  'patternArea',
  'materialAdjustmentLines',
  'newPatternImageIds',
  'newPatternSpuCode',
  'patternChangeNote',
  'patternPieceImageIds',
  'patternFileIds',
  'mainImageIds',
  'designDraftImageIds',
  'liveRetestRequired',
  'liveRetestStatus',
  'liveRetestRelationIds',
  'liveRetestSummary',
  'generatedNewTechPackVersionFlag',
  'generatedNewTechPackVersionAt',
].forEach((field) => {
  assertIncludes(revisionTypes + revisionRepository + writeback + engineeringPage, field, `改版任务缺少正式字段：${field}`)
})

;[
  '旧款 / 新款对比',
  '改版说明',
  '面辅料变化',
  '花型变化',
  '纸样与设计稿',
  '回直播验证',
  '技术包',
  '操作记录',
].forEach((label) => {
  assertIncludes(engineeringPage, label, `改版任务页面缺少执行区块：${label}`)
})

;[
  'REVISION_TASK',
  '旧款编码',
  '新款候选编码',
  '样衣数量',
  '风格偏好',
  '修改建议',
  '面辅料变化明细',
  '新花型图片',
  '新花型 SPU',
  '纸样图片',
  '纸样文件',
  '主图图片',
  '新图设计稿',
  '纸样打印时间',
  '寄送地址',
  '打版区域',
  '打版人',
  '回直播验证',
  '关联技术包版本',
].forEach((label) => {
  assertIncludes(domainContract, label, `工作项库改版字段定义缺少：${label}`)
})

;[
  '待回直播验证',
  '已回直播验证',
  '验证通过',
  '验证未通过',
].forEach((status) => {
  assertIncludes(revisionTypes + engineeringPage + projectPage, status, `回直播验证状态缺少：${status}`)
})

assertIncludes(techPackGeneration, 'generateTechPackVersionFromRevisionTask', '改版任务技术包生成方法缺失')
assertIncludes(techPackGeneration, 'generatedNewTechPackVersionFlag', '改版任务生成新技术包版本后必须回写标记')
assertIncludes(policy, '新技术包版本', '改版任务完成校验必须要求新技术包版本')
assertIncludes(archiveCollector, 'materialAdjustmentLines', '归档采集缺少面辅料变化')
assertIncludes(archiveCollector, 'patternFileIds', '归档采集缺少纸样文件')
assertIncludes(archiveCollector, 'designDraftImageIds', '归档采集缺少新图设计稿')
assertIncludes(archiveCollector, 'mainImageIds', '归档采集缺少主图图片')

console.log('check-pcs-revision-task-refactor PASS')
