import assert from 'node:assert/strict'

import { findProjectNodeById, getProjectById } from '../src/data/pcs-project-repository.ts'
import {
  listProjectInlineNodeRecords,
  listProjectInlineNodeRecordsByWorkItemType,
} from '../src/data/pcs-project-inline-node-record-repository.ts'

const EARLY_WORK_ITEM_TYPES = [
  'SAMPLE_ACQUIRE',
  'SAMPLE_INBOUND_CHECK',
  'FEASIBILITY_REVIEW',
  'SAMPLE_SHOOT_FIT',
  'SAMPLE_CONFIRM',
  'SAMPLE_COST_REVIEW',
  'SAMPLE_PRICING',
] as const

type EarlyWorkItemType = (typeof EARLY_WORK_ITEM_TYPES)[number]

function expectRecordCountAtLeast(workItemTypeCode: EarlyWorkItemType, minimum: number): void {
  const records = listProjectInlineNodeRecordsByWorkItemType(workItemTypeCode)
  assert.ok(
    records.length >= minimum,
    `${workItemTypeCode} 至少应有 ${minimum} 条正式 inline record，当前仅有 ${records.length} 条`,
  )
}

function expectProjectBinding(): void {
  const earlyRecords = listProjectInlineNodeRecords().filter((record) =>
    (EARLY_WORK_ITEM_TYPES as readonly string[]).includes(record.workItemTypeCode),
  )

  earlyRecords.forEach((record) => {
    assert.ok(record.projectId, `${record.recordCode} 缺少 projectId`)
    assert.ok(record.projectNodeId, `${record.recordCode} 缺少 projectNodeId`)

    const project = getProjectById(record.projectId)
    assert.ok(project, `${record.recordCode} 找不到对应项目 ${record.projectId}`)

    const node = findProjectNodeById(record.projectId, record.projectNodeId)
    assert.ok(node, `${record.recordCode} 找不到对应项目节点 ${record.projectNodeId}`)
    assert.equal(
      node?.workItemTypeCode,
      record.workItemTypeCode,
      `${record.recordCode} 的项目节点类型应与记录类型一致`,
    )
  })
}

function expectSampleCodeChainCount(minimum: number): void {
  const acquireRecords = listProjectInlineNodeRecordsByWorkItemType('SAMPLE_ACQUIRE')
  const inboundRecords = listProjectInlineNodeRecordsByWorkItemType('SAMPLE_INBOUND_CHECK')

  const acquireSampleCodes = new Set(
    acquireRecords
      .map((record) => (record.detailSnapshot as Record<string, unknown>).sampleCode)
      .filter((value): value is string => typeof value === 'string' && value.length > 0),
  )
  const inboundSampleCodes = new Set(
    inboundRecords
      .map((record) => (record.payload as Record<string, unknown>).sampleCode)
      .filter((value): value is string => typeof value === 'string' && value.length > 0),
  )

  const sharedSampleCodes = [...acquireSampleCodes].filter((sampleCode) => inboundSampleCodes.has(sampleCode))
  assert.ok(
    sharedSampleCodes.length >= minimum,
    `SAMPLE_ACQUIRE 与 SAMPLE_INBOUND_CHECK 至少应有 ${minimum} 组 sampleCode 对应链，当前仅有 ${sharedSampleCodes.length} 组`,
  )
}

function expectDetailSnapshotCoverage(): void {
  const sampleAcquire = listProjectInlineNodeRecordsByWorkItemType('SAMPLE_ACQUIRE')[0]
  const sampleInbound = listProjectInlineNodeRecordsByWorkItemType('SAMPLE_INBOUND_CHECK')[0]
  const feasibility = listProjectInlineNodeRecordsByWorkItemType('FEASIBILITY_REVIEW')[0]
  const shootFit = listProjectInlineNodeRecordsByWorkItemType('SAMPLE_SHOOT_FIT')[0]
  const confirm = listProjectInlineNodeRecordsByWorkItemType('SAMPLE_CONFIRM')[0]
  const costReview = listProjectInlineNodeRecordsByWorkItemType('SAMPLE_COST_REVIEW')[0]
  const pricing = listProjectInlineNodeRecordsByWorkItemType('SAMPLE_PRICING')[0]

  assert.ok(sampleAcquire, '应存在 SAMPLE_ACQUIRE 记录')
  assert.ok(sampleInbound, '应存在 SAMPLE_INBOUND_CHECK 记录')
  assert.ok(feasibility, '应存在 FEASIBILITY_REVIEW 记录')
  assert.ok(shootFit, '应存在 SAMPLE_SHOOT_FIT 记录')
  assert.ok(confirm, '应存在 SAMPLE_CONFIRM 记录')
  assert.ok(costReview, '应存在 SAMPLE_COST_REVIEW 记录')
  assert.ok(pricing, '应存在 SAMPLE_PRICING 记录')

  const acquireDetail = sampleAcquire.detailSnapshot as Record<string, unknown>
  const inboundDetail = sampleInbound.detailSnapshot as Record<string, unknown>
  const feasibilityDetail = feasibility.detailSnapshot as Record<string, unknown>
  const shootFitDetail = shootFit.detailSnapshot as Record<string, unknown>
  const confirmDetail = confirm.detailSnapshot as Record<string, unknown>
  const costReviewDetail = costReview.detailSnapshot as Record<string, unknown>
  const pricingDetail = pricing.detailSnapshot as Record<string, unknown>

  assert.ok(acquireDetail.externalPlatform, 'SAMPLE_ACQUIRE.detailSnapshot 应包含 platform')
  assert.ok(acquireDetail.externalShop, 'SAMPLE_ACQUIRE.detailSnapshot 应包含 store')
  assert.ok(acquireDetail.orderTime, 'SAMPLE_ACQUIRE.detailSnapshot 应包含 orderTime')
  assert.ok(acquireDetail.quantity, 'SAMPLE_ACQUIRE.detailSnapshot 应包含 quantity')
  assert.ok(acquireDetail.colors, 'SAMPLE_ACQUIRE.detailSnapshot 应包含 colors')
  assert.ok(acquireDetail.sizes, 'SAMPLE_ACQUIRE.detailSnapshot 应包含 sizes')
  assert.ok(acquireDetail.expectedArrivalDate, 'SAMPLE_ACQUIRE.detailSnapshot 应包含 eta')
  assert.ok(acquireDetail.trackingNumber, 'SAMPLE_ACQUIRE.detailSnapshot 应包含 tracking')
  assert.ok(acquireDetail.sampleCode, 'SAMPLE_ACQUIRE.detailSnapshot 应包含 sampleCode')
  assert.ok(acquireDetail.sampleStatus, 'SAMPLE_ACQUIRE.detailSnapshot 应包含 sampleStatus')

  assert.ok(inboundDetail.receiver, 'SAMPLE_INBOUND_CHECK.detailSnapshot 应包含 receiver')
  assert.ok(inboundDetail.warehouseLocation, 'SAMPLE_INBOUND_CHECK.detailSnapshot 应包含 warehouseLocation')
  assert.ok(inboundDetail.sampleQuantity, 'SAMPLE_INBOUND_CHECK.detailSnapshot 应包含 sampleQuantity')
  assert.ok(inboundDetail.colorCode, 'SAMPLE_INBOUND_CHECK.detailSnapshot 应包含 colorCode')
  assert.ok(inboundDetail.sizeCombination, 'SAMPLE_INBOUND_CHECK.detailSnapshot 应包含 sizeCombination')
  assert.ok(inboundDetail.trackingNumber, 'SAMPLE_INBOUND_CHECK.detailSnapshot 应包含 trackingNumber')

  assert.ok(feasibilityDetail.evaluationDimension, 'FEASIBILITY_REVIEW.detailSnapshot 应包含 evaluationDimension')
  assert.ok(feasibilityDetail.judgmentDescription, 'FEASIBILITY_REVIEW.detailSnapshot 应包含 judgmentDescription')
  assert.ok(feasibilityDetail.evaluationParticipants, 'FEASIBILITY_REVIEW.detailSnapshot 应包含 evaluationParticipants')

  assert.ok(shootFitDetail.shootDate, 'SAMPLE_SHOOT_FIT.detailSnapshot 应包含 shootDate')
  assert.ok(shootFitDetail.shootLocation, 'SAMPLE_SHOOT_FIT.detailSnapshot 应包含 shootLocation')
  assert.ok(shootFitDetail.photographer, 'SAMPLE_SHOOT_FIT.detailSnapshot 应包含 photographer')
  assert.ok(shootFitDetail.modelName, 'SAMPLE_SHOOT_FIT.detailSnapshot 应包含 modelName')
  assert.ok(shootFitDetail.editingDeadline, 'SAMPLE_SHOOT_FIT.detailSnapshot 应包含 editingDeadline')

  assert.ok(confirmDetail.appearanceConfirmation, 'SAMPLE_CONFIRM.detailSnapshot 应包含 appearanceConfirmation')
  assert.ok(confirmDetail.sizeConfirmation, 'SAMPLE_CONFIRM.detailSnapshot 应包含 sizeConfirmation')
  assert.ok(confirmDetail.materialConfirmation, 'SAMPLE_CONFIRM.detailSnapshot 应包含 materialConfirmation')
  assert.ok('revisionRequired' in confirmDetail, 'SAMPLE_CONFIRM.detailSnapshot 应包含 revisionRequired')

  assert.ok(costReviewDetail.actualSampleCost, 'SAMPLE_COST_REVIEW.detailSnapshot 应包含 actualSampleCost')
  assert.ok(costReviewDetail.targetProductionCost, 'SAMPLE_COST_REVIEW.detailSnapshot 应包含 targetProductionCost')
  assert.ok('costVariance' in costReviewDetail, 'SAMPLE_COST_REVIEW.detailSnapshot 应包含 costVariance')
  assert.ok(costReviewDetail.costCompliance, 'SAMPLE_COST_REVIEW.detailSnapshot 应包含 costCompliance')

  assert.ok(pricingDetail.baseCost, 'SAMPLE_PRICING.detailSnapshot 应包含 baseCost')
  assert.ok(pricingDetail.finalPrice, 'SAMPLE_PRICING.detailSnapshot 应包含 finalPrice')
  assert.ok(pricingDetail.pricingStrategy, 'SAMPLE_PRICING.detailSnapshot 应包含 pricingStrategy')
  assert.ok(pricingDetail.approvalStatus, 'SAMPLE_PRICING.detailSnapshot 应包含 approvalStatus')
}

EARLY_WORK_ITEM_TYPES.forEach((workItemTypeCode) => expectRecordCountAtLeast(workItemTypeCode, 4))
expectProjectBinding()
expectSampleCodeChainCount(4)
expectDetailSnapshotCoverage()

console.log('pcs-project-inline-bootstrap-early-phase.spec.ts passed')
