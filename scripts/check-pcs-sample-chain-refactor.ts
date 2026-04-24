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

const firstSampleTypes = read('src/data/pcs-first-sample-types.ts')
const firstOrderTypes = read('src/data/pcs-first-order-sample-types.ts')
const sampleChainTypes = read('src/data/pcs-sample-chain-types.ts')
const sampleChainService = read('src/data/pcs-sample-chain-service.ts')
const domainContract = read('src/data/pcs-project-domain-contract.ts')
const engineeringPage = read('src/pages/pcs-engineering-tasks.ts')
const archiveCollector = read('src/data/pcs-project-archive-collector.ts')

;[
  'sourceTechPackVersionId',
  'reuseAsFirstOrderBasisFlag',
  'reuseAsFirstOrderBasisConfirmedAt',
  'sampleImageIds',
].forEach((field) => {
  assertIncludes(firstSampleTypes, field, `首版样衣缺少字段：${field}`)
})

;[
  'sourceFirstSampleTaskId',
  'sampleChainMode',
  'specialSceneReasonCodes',
  'productionReferenceRequiredFlag',
  'chinaReviewRequiredFlag',
  'correctFabricRequiredFlag',
  'samplePlanLines',
].forEach((field) => {
  assertIncludes(firstOrderTypes + sampleChainService, field, `首单样衣打样缺少字段：${field}`)
})

;[
  'SamplePlanLine',
  '复用首版结论',
  '替代布确认样',
  '正确布确认样',
  '工厂参照确认',
  '新增首单样衣确认',
  '替代布与正确布双确认',
].forEach((label) => {
  assertIncludes(sampleChainTypes + sampleChainService + engineeringPage, label, `样衣链路缺少：${label}`)
})

;[
  'FIRST_SAMPLE',
  'FIRST_ORDER_SAMPLE',
  '是否可复用为首单',
  '首单确认方式',
  '特殊场景原因',
  '工厂参照样',
  '最终参照样衣',
].forEach((label) => {
  assertIncludes(domainContract, label, `工作项库字段定义缺少：${label}`)
})

assertIncludes(engineeringPage, '样衣计划', '页面缺少样衣计划')
assertIncludes(engineeringPage, '最终参照说明', '页面缺少最终参照说明')
assertIncludes(engineeringPage, 'getFirstOrderSampleChainMissingFields', '首单完成前缺少链路校验')
assertIncludes(archiveCollector, 'samplePlanLines', '项目资料归档缺少样衣计划采集')
assertIncludes(archiveCollector, '工厂参照样', '项目资料归档缺少工厂参照样采集')

;[
  'sampleAsset',
  'SampleAsset',
  'sourceFirstSampleAssetId',
  'finalReferenceSampleAssetIds',
  'expectedArrival',
  'trackingNo',
  'linkedSampleAssetId',
].forEach((field) => {
  assertNotIncludes(firstSampleTypes + firstOrderTypes + sampleChainTypes + sampleChainService + engineeringPage + domainContract + archiveCollector, field, `PCS 样衣方案不应保留旧资产/流转字段：${field}`)
})

console.log('check-pcs-sample-chain-refactor PASS')
