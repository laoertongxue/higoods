import assert from 'node:assert/strict'

import { getProjectWorkItemContract } from '../src/data/pcs-project-domain-contract.ts'
import { resetProjectArchiveRepository } from '../src/data/pcs-project-archive-repository.ts'
import { resetProjectChannelProductRepository } from '../src/data/pcs-channel-product-project-repository.ts'
import { resetFirstSampleTaskRepository, updateFirstSampleTask } from '../src/data/pcs-first-sample-repository.ts'
import { resetProjectInlineNodeRecordRepository } from '../src/data/pcs-project-inline-node-record-repository.ts'
import { resetPatternTaskRepository, updatePatternTask } from '../src/data/pcs-pattern-task-repository.ts'
import { resetPlateMakingTaskRepository, updatePlateMakingTask } from '../src/data/pcs-plate-making-repository.ts'
import { resetPreProductionSampleTaskRepository, updatePreProductionSampleTask } from '../src/data/pcs-pre-production-sample-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import {
  getProjectNodeRecordByWorkItemTypeCode,
  listProjects,
  resetProjectRepository,
  updateProjectNodeRecord,
} from '../src/data/pcs-project-repository.ts'
import { upsertSampleAsset, resetSampleAssetRepository } from '../src/data/pcs-sample-asset-repository.ts'
import { resetSampleLedgerRepository } from '../src/data/pcs-sample-ledger-repository.ts'
import type { SampleAssetRecord } from '../src/data/pcs-sample-types.ts'
import { resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import { getTechnicalDataVersionById, resetTechnicalDataVersionRepository } from '../src/data/pcs-technical-data-version-repository.ts'
import { renderPcsProjectWorkItemDetailPage } from '../src/pages/pcs-projects.ts'

function resetAllRepositories(): void {
  resetProjectRepository()
  resetProjectRelationRepository()
  resetProjectInlineNodeRecordRepository()
  resetProjectChannelProductRepository()
  resetProjectArchiveRepository()
  resetStyleArchiveRepository()
  resetTechnicalDataVersionRepository()
  resetPlateMakingTaskRepository()
  resetPatternTaskRepository()
  resetFirstSampleTaskRepository()
  resetPreProductionSampleTaskRepository()
  resetSampleAssetRepository()
  resetSampleLedgerRepository()
}

function assertContractHasFields(workItemTypeCode: string, expectedKeys: string[]): void {
  const contract = getProjectWorkItemContract(workItemTypeCode)
  const fieldKeys = contract.fieldDefinitions.map((field) => field.fieldKey)
  expectedKeys.forEach((key) => {
    assert.ok(fieldKeys.includes(key), `${workItemTypeCode} 应定义正式字段 ${key}`)
  })
}

function createSampleAsset(input: {
  sampleAssetId: string
  sampleCode: string
  sampleName: string
  sampleType: string
  sourceDocType: '首版样衣打样任务' | '产前版样衣任务'
  sourceDocId: string
  sourceDocCode: string
  projectId: string
  projectCode: string
  projectName: string
  projectNodeId: string
  workItemTypeCode: string
  workItemTypeName: string
  lastEventTime: string
}): SampleAssetRecord {
  return {
    sampleAssetId: input.sampleAssetId,
    sampleCode: input.sampleCode,
    sampleName: input.sampleName,
    sampleType: input.sampleType,
    responsibleSite: '深圳',
    inventoryStatus: '在库可用',
    availabilityStatus: '可用',
    locationType: '仓库',
    locationCode: 'SZ-SAMPLE',
    locationDisplay: '深圳样衣仓',
    custodianType: '仓管',
    custodianName: '样衣管理员',
    projectId: input.projectId,
    projectCode: input.projectCode,
    projectName: input.projectName,
    projectNodeId: input.projectNodeId,
    workItemTypeCode: input.workItemTypeCode,
    workItemTypeName: input.workItemTypeName,
    sourceDocType: input.sourceDocType,
    sourceDocId: input.sourceDocId,
    sourceDocCode: input.sourceDocCode,
    lastEventId: `${input.sampleAssetId}_last`,
    lastEventType: 'CHECKIN_VERIFY',
    lastEventTime: input.lastEventTime,
    createdAt: input.lastEventTime,
    createdBy: '测试用户',
    updatedAt: input.lastEventTime,
    updatedBy: '测试用户',
    legacyProjectRef: input.projectCode,
    legacyWorkItemInstanceId: input.sourceDocId,
  }
}

resetAllRepositories()

assertContractHasFields('PATTERN_TASK', [
  'sourceType',
  'upstreamModule',
  'upstreamObjectId',
  'upstreamObjectCode',
  'linkedTechPackVersionId',
  'taskStatus',
  'acceptedAt',
  'confirmedAt',
])

assertContractHasFields('PATTERN_ARTWORK_TASK', [
  'sourceType',
  'upstreamModule',
  'upstreamObjectId',
  'upstreamObjectCode',
  'linkedTechPackVersionId',
  'taskStatus',
  'acceptedAt',
  'confirmedAt',
])

assertContractHasFields('FIRST_SAMPLE', [
  'sourceType',
  'upstreamModule',
  'upstreamObjectId',
  'upstreamObjectCode',
  'taskStatus',
  'acceptedAt',
  'confirmedAt',
  'sampleAssetId',
])

assertContractHasFields('PRE_PRODUCTION_SAMPLE', [
  'sourceType',
  'upstreamModule',
  'upstreamObjectId',
  'upstreamObjectCode',
  'taskStatus',
  'acceptedAt',
  'confirmedAt',
  'sampleAssetId',
])

const project013 = listProjects().find((item) => item.projectCode === 'PRJ-20251216-013')
const project014 = listProjects().find((item) => item.projectCode === 'PRJ-20251216-014')
assert.ok(project013, '应存在 PRJ-20251216-013 演示项目')
assert.ok(project014, '应存在 PRJ-20251216-014 演示项目')

const plateVersion = getTechnicalDataVersionById('tdv_seed_022')
const artworkVersion = getTechnicalDataVersionById('tdv_seed_021')
assert.ok(plateVersion, '应存在 tdv_seed_022 技术包版本')
assert.ok(artworkVersion, '应存在 tdv_seed_021 技术包版本')

updatePlateMakingTask('PT-20260404-014', {
  linkedTechPackVersionId: plateVersion!.technicalVersionId,
  linkedTechPackVersionCode: plateVersion!.technicalVersionCode,
  linkedTechPackVersionLabel: plateVersion!.versionLabel,
  linkedTechPackVersionStatus: plateVersion!.versionStatus,
  acceptedAt: '2026-04-04 09:10:00',
  confirmedAt: '2026-04-04 17:00:00',
  status: '已完成',
  updatedAt: '2026-04-04 17:00:00',
  updatedBy: '测试用户',
})

updatePatternTask('AT-20260404-013', {
  linkedTechPackVersionId: artworkVersion!.technicalVersionId,
  linkedTechPackVersionCode: artworkVersion!.technicalVersionCode,
  linkedTechPackVersionLabel: artworkVersion!.versionLabel,
  linkedTechPackVersionStatus: artworkVersion!.versionStatus,
  acceptedAt: '2026-04-04 10:00:00',
  confirmedAt: '2026-04-04 15:40:00',
  status: '已确认',
  updatedAt: '2026-04-04 15:40:00',
  updatedBy: '测试用户',
})

const firstSampleNode = getProjectNodeRecordByWorkItemTypeCode(project013!.projectId, 'FIRST_SAMPLE')
const preProductionNode = getProjectNodeRecordByWorkItemTypeCode(project013!.projectId, 'PRE_PRODUCTION_SAMPLE')
const plateNode = getProjectNodeRecordByWorkItemTypeCode(project014!.projectId, 'PATTERN_TASK')
const artworkNode = getProjectNodeRecordByWorkItemTypeCode(project013!.projectId, 'PATTERN_ARTWORK_TASK')

assert.ok(firstSampleNode, 'PRJ-20251216-013 应存在首版样衣节点')
assert.ok(preProductionNode, 'PRJ-20251216-013 应存在产前版样衣节点')
assert.ok(plateNode, 'PRJ-20251216-014 应存在制版任务节点')
assert.ok(artworkNode, 'PRJ-20251216-013 应存在花型任务节点')

updateProjectNodeRecord(project014!.projectId, plateNode!.projectNodeId, { currentStatus: '已完成' }, '测试用户')
updateProjectNodeRecord(project013!.projectId, artworkNode!.projectNodeId, { currentStatus: '已完成' }, '测试用户')
updateProjectNodeRecord(project013!.projectId, firstSampleNode!.projectNodeId, { currentStatus: '已完成' }, '测试用户')
updateProjectNodeRecord(project013!.projectId, preProductionNode!.projectNodeId, { currentStatus: '已完成' }, '测试用户')

upsertSampleAsset(
  createSampleAsset({
    sampleAssetId: 'sample_asset_fs_013',
    sampleCode: 'SY-SZ-00113',
    sampleName: '设计款户外轻量夹克首版样衣',
    sampleType: '首版样衣',
    sourceDocType: '首版样衣打样任务',
    sourceDocId: 'FS-20260404-013',
    sourceDocCode: 'FS-20260404-013',
    projectId: project013!.projectId,
    projectCode: project013!.projectCode,
    projectName: project013!.projectName,
    projectNodeId: firstSampleNode!.projectNodeId,
    workItemTypeCode: 'FIRST_SAMPLE',
    workItemTypeName: '首版样衣打样',
    lastEventTime: '2026-04-08 20:00:00',
  }),
)

upsertSampleAsset(
  createSampleAsset({
    sampleAssetId: 'sample_asset_pp_013',
    sampleCode: 'SY-SZ-00133',
    sampleName: '设计款户外轻量夹克产前样衣',
    sampleType: '产前样衣',
    sourceDocType: '产前版样衣任务',
    sourceDocId: 'PP-20260406-013',
    sourceDocCode: 'PP-20260406-013',
    projectId: project013!.projectId,
    projectCode: project013!.projectCode,
    projectName: project013!.projectName,
    projectNodeId: preProductionNode!.projectNodeId,
    workItemTypeCode: 'PRE_PRODUCTION_SAMPLE',
    workItemTypeName: '产前版样衣',
    lastEventTime: '2026-04-12 15:20:00',
  }),
)

updateFirstSampleTask('FS-20260404-013', {
  sampleAssetId: 'sample_asset_fs_013',
  sampleCode: 'SY-SZ-00113',
  acceptedAt: '2026-04-08 18:20:00',
  confirmedAt: '2026-04-08 20:00:00',
  status: '已完成',
  updatedAt: '2026-04-08 20:00:00',
  updatedBy: '测试用户',
})

updatePreProductionSampleTask('PP-20260406-013', {
  sampleAssetId: 'sample_asset_pp_013',
  sampleCode: 'SY-SZ-00133',
  acceptedAt: '2026-04-11 19:10:00',
  confirmedAt: '2026-04-12 15:20:00',
  status: '已完成',
  updatedAt: '2026-04-12 15:20:00',
  updatedBy: '测试用户',
})

const plateHtml = await renderPcsProjectWorkItemDetailPage(project014!.projectId, plateNode!.projectNodeId)
assert.match(plateHtml, /任务来源类型/, '制版任务节点详情应展示任务来源类型')
assert.match(plateHtml, /上游模块/, '制版任务节点详情应展示上游模块')
assert.match(plateHtml, /上游对象ID/, '制版任务节点详情应展示上游对象 ID')
assert.match(plateHtml, /上游对象编码/, '制版任务节点详情应展示上游对象编码')
assert.match(plateHtml, /关联技术包版本ID/, '制版任务节点详情应展示关联技术包版本 ID')
assert.match(plateHtml, /任务状态/, '制版任务节点详情应展示任务状态')
assert.match(plateHtml, /受理时间/, '制版任务节点详情应展示受理时间')
assert.match(plateHtml, /确认时间/, '制版任务节点详情应展示确认时间')
assert.match(plateHtml, /TPL-002/, '制版任务节点详情应展示模板来源编码')
assert.match(plateHtml, /tdv_seed_022/, '制版任务节点详情应展示技术包版本 ID')
assert.match(plateHtml, /2026-04-04 09:10:00/, '制版任务节点详情应展示受理时间值')
assert.match(plateHtml, /2026-04-04 17:00:00/, '制版任务节点详情应展示确认时间值')

const artworkHtml = await renderPcsProjectWorkItemDetailPage(project013!.projectId, artworkNode!.projectNodeId)
assert.match(artworkHtml, /任务来源类型/, '花型任务节点详情应展示任务来源类型')
assert.match(artworkHtml, /关联技术包版本ID/, '花型任务节点详情应展示关联技术包版本 ID')
assert.match(artworkHtml, /tdv_seed_021/, '花型任务节点详情应展示技术包版本 ID')
assert.match(artworkHtml, /TPL-004/, '花型任务节点详情应展示上游模板对象 ID')
assert.match(artworkHtml, /2026-04-04 15:40:00/, '花型任务节点详情应展示确认时间值')

const firstSampleHtml = await renderPcsProjectWorkItemDetailPage(project013!.projectId, firstSampleNode!.projectNodeId)
assert.match(firstSampleHtml, /样衣资产ID/, '首版样衣节点详情应展示样衣资产 ID')
assert.match(firstSampleHtml, /签收时间/, '首版样衣节点详情应展示签收时间')
assert.match(firstSampleHtml, /验收确认时间/, '首版样衣节点详情应展示验收确认时间')
assert.match(firstSampleHtml, /sample_asset_fs_013/, '首版样衣节点详情应展示样衣资产值')
assert.match(firstSampleHtml, /SY-SZ-00113/, '首版样衣节点详情应展示样衣编号')
assert.match(firstSampleHtml, /2026-04-08 18:20:00/, '首版样衣节点详情应展示签收时间值')
assert.match(firstSampleHtml, /2026-04-08 20:00:00/, '首版样衣节点详情应展示验收确认时间值')

const preProductionHtml = await renderPcsProjectWorkItemDetailPage(project013!.projectId, preProductionNode!.projectNodeId)
assert.match(preProductionHtml, /样衣资产ID/, '产前版样衣节点详情应展示样衣资产 ID')
assert.match(preProductionHtml, /签收时间/, '产前版样衣节点详情应展示签收时间')
assert.match(preProductionHtml, /产前确认时间/, '产前版样衣节点详情应展示产前确认时间')
assert.match(preProductionHtml, /sample_asset_pp_013/, '产前版样衣节点详情应展示样衣资产值')
assert.match(preProductionHtml, /SY-SZ-00133/, '产前版样衣节点详情应展示样衣编号')
assert.match(preProductionHtml, /2026-04-11 19:10:00/, '产前版样衣节点详情应展示签收时间值')
assert.match(preProductionHtml, /2026-04-12 15:20:00/, '产前版样衣节点详情应展示产前确认时间值')

console.log('pcs-engineering-sample-node-fields.spec.ts PASS')
