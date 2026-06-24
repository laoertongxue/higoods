import assert from 'node:assert/strict'

import { getProjectWorkItemContract } from '../src/data/pcs-project-domain-contract.ts'
import { resetProjectArchiveRepository } from '../src/data/pcs-project-archive-repository.ts'
import { resetProjectChannelProductRepository } from '../src/data/pcs-channel-product-project-repository.ts'
import { resetFirstSampleTaskRepository, updateFirstSampleTask } from '../src/data/pcs-first-sample-repository.ts'
import { resetFirstOrderSampleTaskRepository, updateFirstOrderSampleTask } from '../src/data/pcs-first-order-sample-repository.ts'
import { resetProjectInlineNodeRecordRepository } from '../src/data/pcs-project-inline-node-record-repository.ts'
import { resetPatternTaskRepository, updatePatternTask } from '../src/data/pcs-pattern-task-repository.ts'
import { resetPlateMakingTaskRepository, updatePlateMakingTask } from '../src/data/pcs-plate-making-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import {
  getProjectNodeRecordByWorkItemTypeCode,
  listProjects,
  resetProjectRepository,
  updateProjectNodeRecord,
} from '../src/data/pcs-project-repository.ts'
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
  resetFirstOrderSampleTaskRepository()
}

function assertContractHasFields(workItemTypeCode: string, expectedKeys: string[]): void {
  const contract = getProjectWorkItemContract(workItemTypeCode)
  const fieldKeys = contract.fieldDefinitions.map((field) => field.fieldKey)
  expectedKeys.forEach((key) => {
    assert.ok(fieldKeys.includes(key), `${workItemTypeCode} 应定义正式字段 ${key}`)
  })
}

resetAllRepositories()

assertContractHasFields('PATTERN_TASK', [
  'sourceType',
  'upstreamModule',
  'upstreamObjectId',
  'upstreamObjectCode',
  'linkedTechPackVersionId',
  'taskStatus',
  'confirmedAt',
])

assertContractHasFields('PATTERN_ARTWORK_TASK', [
  'sourceType',
  'upstreamModule',
  'upstreamObjectId',
  'upstreamObjectCode',
  'linkedTechPackVersionId',
  'taskStatus',
  'confirmedAt',
])

assertContractHasFields('FIRST_SAMPLE', [
  'sourceType',
  'upstreamModule',
  'upstreamObjectId',
  'upstreamObjectCode',
  'taskStatus',
  'confirmedAt',
  'sampleCode',
])

assertContractHasFields('FIRST_ORDER_SAMPLE', [
  'sourceFirstSampleTaskId',
  'sourceTechPackVersionId',
  'sampleChainMode',
  'sampleCode',
  'sourceType',
  'upstreamModule',
  'upstreamObjectId',
  'upstreamObjectCode',
  'taskStatus',
  'confirmedAt',
])

const project013 = listProjects().find((item) => item.projectCode === 'PRJ-202604-013')
const project014 = listProjects().find((item) => item.projectCode === 'PRJ-202604-014')
assert.ok(project013, '应存在 PRJ-202604-013 演示项目')
assert.ok(project014, '应存在 PRJ-202604-014 演示项目')

const plateVersion = getTechnicalDataVersionById('tdv_seed_project_018_base')
const artworkVersion = getTechnicalDataVersionById('tdv_demand_SPU_JACKET_085')
assert.ok(plateVersion, '应存在 tdv_seed_project_018_base 技术包版本')
assert.ok(artworkVersion, '应存在 tdv_demand_SPU_JACKET_085 技术包版本')

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
const firstOrderNode = getProjectNodeRecordByWorkItemTypeCode(project013!.projectId, 'FIRST_ORDER_SAMPLE')
const plateNode = getProjectNodeRecordByWorkItemTypeCode(project014!.projectId, 'PATTERN_TASK')
const artworkNode = getProjectNodeRecordByWorkItemTypeCode(project013!.projectId, 'PATTERN_ARTWORK_TASK')

assert.ok(firstSampleNode, 'PRJ-202604-013 应存在首版样衣节点')
assert.ok(firstOrderNode, 'PRJ-202604-013 应存在首单样衣节点')
assert.ok(plateNode, 'PRJ-202604-014 应存在制版任务节点')
assert.ok(artworkNode, 'PRJ-202604-013 应存在花型任务节点')

updateProjectNodeRecord(project014!.projectId, plateNode!.projectNodeId, { currentStatus: '已完成' }, '测试用户')
updateProjectNodeRecord(project013!.projectId, artworkNode!.projectNodeId, { currentStatus: '已完成' }, '测试用户')
updateProjectNodeRecord(project013!.projectId, firstSampleNode!.projectNodeId, { currentStatus: '已完成' }, '测试用户')
updateProjectNodeRecord(project013!.projectId, firstOrderNode!.projectNodeId, { currentStatus: '已完成' }, '测试用户')

updateFirstSampleTask('FS-20260404-013', {
  sampleCode: 'SY-SZ-00113',
  confirmedAt: '2026-04-08 20:00:00',
  status: '已通过',
  updatedAt: '2026-04-08 20:00:00',
  updatedBy: '测试用户',
})

updateFirstOrderSampleTask('PP-20260406-013', {
  sampleCode: 'SY-SZ-00133',
  confirmedAt: '2026-04-12 15:20:00',
  status: '已通过',
  updatedAt: '2026-04-12 15:20:00',
  updatedBy: '测试用户',
})

const plateHtml = await renderPcsProjectWorkItemDetailPage(project014!.projectId, plateNode!.projectNodeId)
assert.match(plateHtml, /制版任务/, '制版任务节点详情应展示任务模块')
assert.match(plateHtml, /查看制版任务/, '制版任务节点详情应展示正式任务入口')
assert.match(plateHtml, /PT-20260407-018/, '制版任务节点详情应展示正式任务编码')
assert.match(plateHtml, /制版-设计款印花阔腿连体裤/, '制版任务节点详情应展示任务标题')
assert.match(plateHtml, /林版师/, '制版任务节点详情应展示版师')

const artworkHtml = await renderPcsProjectWorkItemDetailPage(project013!.projectId, artworkNode!.projectNodeId)
assert.match(artworkHtml, /花型任务/, '花型任务节点详情应展示任务模块')
assert.match(artworkHtml, /查看花型任务/, '花型任务节点详情应展示正式任务入口')
assert.match(artworkHtml, /AT-20260404-013/, '花型任务节点详情应展示正式任务编码')
assert.match(artworkHtml, /花型-户外轻量夹克/, '花型任务节点详情应展示任务标题')
assert.match(artworkHtml, /需求来源/, '花型任务节点详情应展示需求来源')
assert.match(artworkHtml, /改版任务/, '花型任务节点详情应展示改版任务来源')
assert.match(artworkHtml, /烫画/, '花型任务节点详情应展示工艺')
assert.match(artworkHtml, /bing bing/, '花型任务节点详情应展示花型师')

const firstSampleHtml = await renderPcsProjectWorkItemDetailPage(project013!.projectId, firstSampleNode!.projectNodeId)
assert.match(firstSampleHtml, /首版样衣打样/, '首版样衣节点详情应展示任务模块')
assert.match(firstSampleHtml, /请先填写首版样衣必要信息并创建任务/, '首版样衣节点详情应展示创建前置提示')
assert.match(firstSampleHtml, /创建首版任务/, '首版样衣节点详情应展示创建任务入口')

const firstOrderHtml = await renderPcsProjectWorkItemDetailPage(project013!.projectId, firstOrderNode!.projectNodeId)
assert.match(firstOrderHtml, /首单样衣打样/, '首单样衣节点详情应展示任务模块')
assert.match(firstOrderHtml, /请先填写首单样衣必要信息并创建任务/, '首单样衣节点详情应展示创建前置提示')
assert.match(firstOrderHtml, /创建首单任务/, '首单样衣节点详情应展示创建任务入口')

console.log('pcs-engineering-sample-node-fields.spec.ts PASS')
