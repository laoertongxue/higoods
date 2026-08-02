import {
  getTechnicalDataVersionById,
  getTechnicalDataVersionContent,
  listTechnicalDataVersions,
  updateTechnicalDataVersionRecord,
} from './pcs-technical-data-version-repository.ts'
import type {
  TechnicalDataVersionRecord,
  TechnicalReviewNode,
} from './pcs-technical-data-version-types.ts'
import {
  appendReviewLog,
  sendReviewNotificationSafely,
  withReviewDiffSnapshot,
} from './pcs-tech-pack-review-lifecycle.ts'

export type BomPriceReviewChangeSource =
  | 'STANDARD_MATERIAL_PRICE_CNY'
  | 'CUSTOM_COST_IDR'
  | 'EXCHANGE_RATE_IDR_PER_CNY'
  | 'BOM_UNIT_CONSUMPTION'
  | 'BOM_LOSS_RATE'
  | 'MATERIAL_SKU_CHANGE'
  | 'BOM_SAMPLE_QUANTITY'
  | 'BOM_USAGE_UNIT'

type TextBomPriceReviewChangeSource = 'MATERIAL_SKU_CHANGE' | 'BOM_USAGE_UNIT'
type NumericBomPriceReviewChangeSource = Exclude<BomPriceReviewChangeSource, TextBomPriceReviewChangeSource>

export type BomPriceReviewChange =
  | {
      changeSource: NumericBomPriceReviewChangeSource
      targetId: string
      beforeValue: number
      afterValue: number
    }
  | {
      changeSource: TextBomPriceReviewChangeSource
      targetId: string
      beforeValue: string
      afterValue: string
    }

export interface InvalidateReviewForBomPriceChangeInput {
  changes?: BomPriceReviewChange[]
  changedBomItemIds?: string[]
  beforePriceCny?: number
  afterPriceCny?: number
  operator?: string | { id?: string; name: string }
}

let failureTechnicalVersionIdForTesting: string | null = null

export function setBomPriceReviewInvalidationFailureForTesting(
  technicalVersionId: string | null,
): void {
  failureTechnicalVersionIdForTesting = technicalVersionId
}

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function resetBuyerReview(record: TechnicalDataVersionRecord, changedAt: string, operatorName: string): TechnicalReviewNode {
  const current = record.buyerReview
  return withReviewDiffSnapshot(record, {
    nodeKey: 'BUYER',
    nodeName: '买手审核',
    status: '待审核',
    reviewerRole: '买手',
    assignedReviewerId: current?.assignedReviewerId || '',
    assignedReviewerName: current?.assignedReviewerName || '',
    assignedReviewerRole: '买手',
    assignedReviewerFeishuOpenId: current?.assignedReviewerFeishuOpenId || '',
    assignedAt: current?.assignedAt || changedAt,
    assignedBy: current?.assignedBy || operatorName,
    reviewedBy: '',
    reviewedAt: '',
    startedOpinion: '',
    opinion: '',
    diffSnapshotId: '',
    diffStatus: '无基线',
    diffSummaryText: '',
    lastFeishuNotifyAt: current?.lastFeishuNotifyAt || '',
    lastFeishuNotifyStatus: current?.lastFeishuNotifyStatus || '未发送',
    lastFeishuNotifyRecordId: current?.lastFeishuNotifyRecordId || '',
    todayFeishuNotifiedFlag: current?.todayFeishuNotifiedFlag || false,
    todayFeishuNotifyAt: current?.todayFeishuNotifyAt || '',
    feishuNotifyCount: current?.feishuNotifyCount || 0,
  }, {
    diffStatus: '有差异',
    summaryText: 'BOM 与价格变化，需买手重新审核。',
  })
}

export function invalidateReviewForBomPriceChange(
  technicalVersionId: string,
  input: InvalidateReviewForBomPriceChangeInput,
): TechnicalDataVersionRecord {
  const changes = Array.isArray(input.changes) && input.changes.length > 0
    ? input.changes
    : Array.isArray(input.changedBomItemIds) && input.changedBomItemIds.length > 0
    ? input.changedBomItemIds.map((targetId) => ({
        changeSource: 'STANDARD_MATERIAL_PRICE_CNY' as const,
        targetId,
        beforeValue: input.beforePriceCny as number,
        afterValue: input.afterPriceCny as number,
      }))
    : []
  if (changes.length === 0) throw new Error('请提供价格变化明细。')
  if (changes.some((change) => {
    if (!change.targetId.trim()) return true
    if (change.changeSource === 'MATERIAL_SKU_CHANGE' || change.changeSource === 'BOM_USAGE_UNIT') {
      return change.beforeValue === change.afterValue
    }
    return !Number.isFinite(change.beforeValue) || !Number.isFinite(change.afterValue)
  })) {
    throw new Error('价格变化数据无效。')
  }
  const record = getTechnicalDataVersionById(technicalVersionId)
  if (!record) throw new Error(`未找到技术包版本：${technicalVersionId}`)
  if (record.versionStatus !== 'DRAFT') throw new Error('仅草稿技术包可以更新审核状态。')
  if (changes.every((change) => change.beforeValue === change.afterValue)) return record
  if (
    !record.buyerReview ||
    (
      record.buyerReview.status !== '审核-已通过' &&
      record.buyerReview.status !== '审核-未通过' &&
      record.buyerReview.status !== '无需审核'
    )
  ) return record
  if (failureTechnicalVersionIdForTesting === technicalVersionId) {
    throw new Error('模拟 BOM 与价格审核失效写入失败')
  }

  const operatorName = typeof input.operator === 'string'
    ? input.operator.trim() || '系统价格联动'
    : input.operator?.name.trim() || '系统价格联动'
  const changedAt = nowText()
  const next = updateTechnicalDataVersionRecord(technicalVersionId, {
    reviewStage: '第一阶段并行审核',
    buyerReview: resetBuyerReview(record, changedAt, operatorName),
    patternMakerReview: record.patternMakerReview,
    merchandiserReview: record.merchandiserReview,
    reviewUnlockedModuleKeys: ['BOM', 'COST'],
    updatedAt: changedAt,
    updatedBy: operatorName,
  })
  if (!next) throw new Error(`未找到技术包版本：${technicalVersionId}`)
  appendReviewLog({
    record: next,
    logType: 'BOM 与价格变化重新审核',
    changeText: `BOM 与价格发生 ${changes.length} 项变化，原买手审核结论失效，需买手重新审核。`,
    operatorName,
    createdAt: changedAt,
    logKey: 'BUYER',
  })
  sendReviewNotificationSafely({
    technicalVersionId,
    nodeKey: 'BUYER',
    notificationType: '打回复审',
    createdBy: operatorName,
    diffSnapshot: next.buyerReview
      ? {
          snapshotId: next.buyerReview.diffSnapshotId,
          diffStatus: next.buyerReview.diffStatus,
          summaryText: next.buyerReview.diffSummaryText,
        }
      : undefined,
  })
  return getTechnicalDataVersionById(technicalVersionId) || next
}

export function invalidateBomPriceReviewsForMaterialStandardPriceChange(input: {
  materialSkuId: string
  beforePriceCny: number
  afterPriceCny: number
  operator?: string | { id?: string; name: string }
}): TechnicalDataVersionRecord[] {
  if (input.beforePriceCny === input.afterPriceCny) return []
  return listTechnicalDataVersions()
    .filter((record) => record.versionStatus === 'DRAFT')
    .filter((record) => getTechnicalDataVersionContent(record.technicalVersionId)
      ?.bomItems.some((item) => item.materialSkuId === input.materialSkuId))
    .map((record) => invalidateReviewForBomPriceChange(record.technicalVersionId, {
      changes: [{
        changeSource: 'STANDARD_MATERIAL_PRICE_CNY',
        targetId: input.materialSkuId,
        beforeValue: input.beforePriceCny,
        afterValue: input.afterPriceCny,
      }],
      operator: input.operator,
    }))
}

export function invalidateBomPriceReviewsForExchangeRateChange(input: {
  beforeIdrPerCny: number
  afterIdrPerCny: number
  operator?: string | { id?: string; name: string }
}): TechnicalDataVersionRecord[] {
  if (input.beforeIdrPerCny === input.afterIdrPerCny) return []
  return listTechnicalDataVersions()
    .filter((record) => record.versionStatus === 'DRAFT')
    .filter((record) => {
      const content = getTechnicalDataVersionContent(record.technicalVersionId)
      return Boolean(
        content?.bomItems.some((item) => Boolean(item.materialSkuId)) ||
        content?.bomCustomCosts?.some((item) => Number.isFinite(item.amountIdr) && item.amountIdr > 0),
      )
    })
    .map((record) => invalidateReviewForBomPriceChange(record.technicalVersionId, {
      changes: [{
        changeSource: 'EXCHANGE_RATE_IDR_PER_CNY',
        targetId: 'CNY_IDR',
        beforeValue: input.beforeIdrPerCny,
        afterValue: input.afterIdrPerCny,
      }],
      operator: input.operator,
    }))
}
