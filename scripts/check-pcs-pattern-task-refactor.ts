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

function assertNotIncludes(source: string, pattern: string, message: string): void {
  assert.ok(!source.includes(pattern), message)
}

const patternTypes = read('src/data/pcs-pattern-task-types.ts')
const teamConfig = read('src/data/pcs-pattern-task-team-config.ts')
const flowService = read('src/data/pcs-pattern-task-flow-service.ts')
const policy = read('src/data/pcs-engineering-task-field-policy.ts')
const page = read('src/pages/pcs-engineering-tasks.ts')
const libraryTypes = read('src/data/pcs-pattern-library-types.ts')
const techPackGeneration = read('src/data/pcs-tech-pack-task-generation.ts')

;[
  'demandSourceType',
  'processType',
  'requestQty',
  'fabricSku',
  'fabricName',
  'demandImageIds',
  'patternSpuCode',
  'colorDepthOption',
  'difficultyGrade',
  'assignedTeamCode',
  'assignedMemberId',
  'buyerReviewStatus',
  'completionImageIds',
  'transferToTeamCode',
].forEach((field) => {
  assertIncludes(patternTypes, field, `花型任务类型缺少字段：${field}`)
})

;[
  '中国团队',
  '万隆团队',
  '雅加达团队',
  'bing bing',
  '单单',
  '关浩',
  'ramzi adli',
  'micin',
  'Irfan',
  'Usman',
  'zaenal Abidin',
  'Bandung',
].forEach((value) => {
  assertIncludes(teamConfig, value, `团队或成员配置缺少：${value}`)
})

;[
  '待买手确认',
  '买手已通过',
  '买手已驳回',
  'buyerReviewStatus',
  'buyerReviewerName',
].forEach((value) => {
  assertIncludes(patternTypes + flowService + page, value, `买手审核流缺少：${value}`)
})

;[
  'patternCategoryCode',
  'patternStyleTags',
  'hotSellerFlag',
].forEach((field) => {
  assertIncludes(patternTypes + page + libraryTypes, field, `花型库串联缺少字段：${field}`)
})

;[
  '需求来源',
  '工艺与面料',
  '需求图片',
  '团队与成员分配',
  '难易程度',
  '买手确认',
  '完成确认图片',
  '花型库沉淀',
  '技术包写入',
].forEach((label) => {
  assertIncludes(page, label, `花型任务页面缺少区块：${label}`)
})

assertIncludes(policy, '买手已通过', '完成校验必须要求买手通过')
assertIncludes(policy, 'completionImageIds', '完成校验必须要求完成确认图片')
assertIncludes(techPackGeneration, 'completionImageIds', '技术包花型写入应优先使用完成确认图片')
assertNotIncludes(page, '温度设置', '花型任务页面不得把温度设置作为主字段')
assertNotIncludes(page, 'temperatureSetting', '花型任务页面不得保留 temperatureSetting 主字段')

console.log('check-pcs-pattern-task-refactor PASS')
