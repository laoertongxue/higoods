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

const plateTypes = read('src/data/pcs-plate-making-types.ts')
const plateRepository = read('src/data/pcs-plate-making-repository.ts')
const fieldPolicy = read('src/data/pcs-engineering-task-field-policy.ts')
const domainContract = read('src/data/pcs-project-domain-contract.ts')
const techPackGeneration = read('src/data/pcs-tech-pack-task-generation.ts')
const archiveCollector = read('src/data/pcs-project-archive-collector.ts')
const page = read('src/pages/pcs-engineering-tasks.ts')

;[
  'productHistoryType',
  'patternMakerId',
  'patternMakerName',
  'sampleConfirmedAt',
  'urgentFlag',
  'patternArea',
  'colorRequirementText',
  'newPatternSpuCode',
  'flowerImageIds',
  'materialRequirementLines',
  'patternImageLineItems',
  'patternPdfFileIds',
  'patternDxfFileIds',
  'patternRulFileIds',
  'supportImageIds',
  'supportVideoIds',
  'partTemplateLinks',
].forEach((field) => {
  assertIncludes(plateTypes + plateRepository + page, field, `制版任务缺少正式字段：${field}`)
})

;[
  '制版执行',
  '面辅料与花色',
  '纸样图片',
  '纸样文件',
  '模板关联',
  '版师',
  '打版区域',
  '是否紧急',
  '样板确认时间',
].forEach((label) => {
  assertIncludes(page, label, `制版任务详情页缺少区块或字段：${label}`)
})

;[
  'PATTERN_TASK',
  '产品历史属性',
  '版师',
  '打版区域',
  '面辅料明细',
  '花色需求',
  'DXF 文件',
  'RUL 文件',
  '部位模板关联',
  '关联技术包版本',
].forEach((label) => {
  assertIncludes(domainContract, label, `工作项库制版字段定义缺少：${label}`)
})

;[
  'PATTERN_ARTWORK_TASK',
  '需求来源',
  '工艺类型',
  '数量',
  '面料',
  '需求图片',
  '分配团队',
  '分配成员',
  '买手确认状态',
  '完成确认图片',
  '中国团队',
].forEach((label) => {
  assertIncludes(domainContract, label, `工作项库花型字段定义缺少：${label}`)
})

;[
  'primaryPlateTaskId',
  'primaryPlateTaskCode',
  'primaryPlateTaskVersion',
  'primaryTechPackGeneratedFlag',
].forEach((field) => {
  assertIncludes(techPackGeneration + plateTypes, field, `技术包主挂载串联缺少：${field}`)
})

;[
  'materialRequirementLines',
  'patternImageLineItems',
  'patternPdfFileIds',
  'patternDxfFileIds',
  'patternRulFileIds',
  'supportImageIds',
  'supportVideoIds',
].forEach((field) => {
  assertIncludes(archiveCollector, field, `项目资料归档采集缺少：${field}`)
})

assertIncludes(fieldPolicy, '纸样资料', '制版任务完成校验必须要求纸样资料')
assertIncludes(fieldPolicy, 'patternMakerName', '制版任务完成校验必须要求版师')

console.log('check-pcs-plate-making-refactor PASS')
