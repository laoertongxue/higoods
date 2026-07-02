import {
  getPlatformQcDetailViewModelByRouteKey,
  listPlatformQcListItems,
  type PlatformQcDetailViewModel,
  type PlatformQcListItem,
} from '../../data/fcs/quality-deduction-selectors.ts'
import {
  listPostFinishingQcOrders,
  type PostFinishingActionRecord,
  type PostFinishingEvidenceAsset,
  type PostFinishingQcSkuResult,
} from '../../data/fcs/post-finishing-domain.ts'

export type QcFactSourceKind = 'QUALITY_CHAIN' | 'POST_FINISHING_QC'
export type QcSettlementTraceStatus = '未进入对账' | '待对账引用' | '已进入对账'

export interface QcSettlementTrace {
  statementNo?: string
  deductionLineNo?: string
  statusLabel: QcSettlementTraceStatus
}

export interface QcFactSkuResult {
  skuCode: string
  colorName: string
  sizeName: string
  imageUrl?: string
  inspectedQty: number
  qualifiedQty: number
  reworkQty: number
  defectQty: number
  reworkReceiveFactoryName: string
  reworkChargebackAmountText: string
  defectReasonSummary: string
  postProjectSummary: string
  qtyUnit: string
}

export interface QcFactRow {
  id: string
  displayNo: string
  sourceKind: QcFactSourceKind
  sourceTypeLabel: string
  productionOrderNo: string
  skuSummary: string
  sourceFactoryName: string
  receiverName: string
  inspectedQty: number
  qualifiedQty: number
  reworkQty: number
  defectQty: number
  reworkReceivers: string
  reworkChargebackAmountText: string
  resultLabel: string
  inspectedAt: string
  inspectorName: string
  settlementTrace: QcSettlementTrace
}

export interface QcFactDetail extends QcFactRow {
  qcStationName: string
  skuResults: QcFactSkuResult[]
  evidenceAssets: Array<{ assetId: string; name: string; assetType: 'IMAGE' | 'VIDEO' | 'DOCUMENT'; url?: string }>
  rawFacts: Array<{ label: string; value: string }>
}

function numberValue(value: number | undefined): number {
  return Number(value) || 0
}

function uniqueText(values: Array<string | undefined>): string {
  const text = Array.from(new Set(values.map((item) => item?.trim()).filter(Boolean) as string[])).join('、')
  return text || '—'
}

function sumSku(results: PostFinishingQcSkuResult[], key: 'reworkQty' | 'defectAcceptedQty'): number {
  return results.reduce((sum, item) => sum + numberValue(item[key]), 0)
}

function sumDefectReasonQty(result: PostFinishingQcSkuResult): number {
  return (result.defectReasonItems ?? []).reduce((sum, item) => sum + numberValue(item.qty), 0)
}

function displayDefectQty(result: PostFinishingQcSkuResult): number {
  return numberValue(result.defectAcceptedQty) || sumDefectReasonQty(result)
}

function getExternalReworkChargebackAmount(result: PostFinishingQcSkuResult, sourceFactoryName: string | undefined): number {
  const reworkReceiver = result.reworkReceiveFactoryName?.trim()
  const sourceFactory = sourceFactoryName?.trim()
  const isExternalRework =
    numberValue(result.reworkQty) > 0 &&
    Boolean(reworkReceiver) &&
    Boolean(sourceFactory) &&
    reworkReceiver !== sourceFactory
  if (!isExternalRework) return 0
  return numberValue(result.sourceChargeback?.amount ?? result.reworkDeductionAmountIdr)
}

function formatIdrAmount(amount: number): string {
  return amount > 0 ? `IDR ${amount.toLocaleString('en-US')}` : '—'
}

function summarizeDefectReasons(result: PostFinishingQcSkuResult): string {
  const summary = (result.defectReasonItems ?? [])
    .filter((item) => numberValue(item.qty) > 0)
    .map((item) => `${item.reasonName}${item.qty}`)
    .join('、')
  return summary || '—'
}

function summarizePostProjects(result: PostFinishingQcSkuResult): string {
  const summary = (result.postProjectJudgements ?? [])
    .filter((item) => item.needed)
    .map((item) =>
      item.projectName === '装扣子' && item.buttonAttachMode
        ? `${item.projectName}（${item.buttonAttachMode}）`
        : item.projectName,
    )
    .join('、')
  return summary || '—'
}

function hasSourceChargeback(record: PostFinishingActionRecord): boolean {
  return (record.qcSkuResults ?? []).some(
    (item) => item.sourceChargeback || numberValue(item.reworkDeductionAmountIdr) > 0,
  )
}

function platformTrace(row: PlatformQcListItem): QcSettlementTrace {
  if (row.includedSettlementStatementId) {
    return {
      statementNo: row.includedSettlementStatementId,
      deductionLineNo: row.basisId,
      statusLabel: '已进入对账',
    }
  }
  if (row.basisId) return { deductionLineNo: row.basisId, statusLabel: '待对账引用' }
  return { statusLabel: '未进入对账' }
}

function postTrace(record: PostFinishingActionRecord): QcSettlementTrace {
  if (record.qualityDeductionSnapshot?.qcId) {
    return {
      deductionLineNo: record.qualityDeductionSnapshot.qcNo || record.qualityDeductionSnapshot.qcId,
      statusLabel: '待对账引用',
    }
  }
  return { statusLabel: hasSourceChargeback(record) ? '待对账引用' : '未进入对账' }
}

function mapPlatformRow(row: PlatformQcListItem): QcFactRow {
  return {
    id: row.qcId,
    displayNo: row.qcNo,
    sourceKind: 'QUALITY_CHAIN',
    sourceTypeLabel: row.processLabel || '回货质检',
    productionOrderNo: row.productionOrderId || '—',
    skuSummary: row.batchId || row.sourceTaskId || '—',
    sourceFactoryName: row.returnFactoryName || '—',
    receiverName: row.warehouseName || '—',
    inspectedQty: row.inspectedQty,
    qualifiedQty: row.qualifiedQty,
    reworkQty: 0,
    defectQty: row.unqualifiedQty,
    reworkReceivers: '—',
    reworkChargebackAmountText: '—',
    resultLabel: row.qcResultLabel,
    inspectedAt: row.inspectedAt,
    inspectorName: row.inspector || '—',
    settlementTrace: platformTrace(row),
  }
}

function mapPostSku(result: PostFinishingQcSkuResult, sourceFactoryName: string | undefined): QcFactSkuResult {
  const reworkChargebackAmount = getExternalReworkChargebackAmount(result, sourceFactoryName)
  return {
    skuCode: result.skuCode,
    colorName: result.colorName,
    sizeName: result.sizeName,
    imageUrl: result.skuImageUrl,
    inspectedQty: numberValue(result.inspectedQty),
    qualifiedQty: numberValue(result.qualifiedQty),
    reworkQty: numberValue(result.reworkQty),
    defectQty: displayDefectQty(result),
    reworkReceiveFactoryName: result.reworkReceiveFactoryName || '—',
    reworkChargebackAmountText: formatIdrAmount(reworkChargebackAmount),
    defectReasonSummary: summarizeDefectReasons(result),
    postProjectSummary: summarizePostProjects(result),
    qtyUnit: result.qtyUnit || '件',
  }
}

function mapPostRow(record: PostFinishingActionRecord): QcFactRow {
  const skuResults = record.qcSkuResults ?? []
  const reworkQty = numberValue(record.reworkGarmentQty) || sumSku(skuResults, 'reworkQty')
  const defectQty = numberValue(record.defectAcceptedGarmentQty) || skuResults.reduce((sum, item) => sum + displayDefectQty(item), 0)
  const reworkChargebackAmount = skuResults.reduce(
    (sum, item) => sum + getExternalReworkChargebackAmount(item, record.sourceFactoryName),
    0,
  )
  return {
    id: record.actionRecordId,
    displayNo: record.actionRecordNo,
    sourceKind: 'POST_FINISHING_QC',
    sourceTypeLabel: '后道质检单',
    productionOrderNo: record.warehouseAllocations?.[0]?.productionOrderNo || record.qualityDeductionSnapshot?.productionOrderNo || '—',
    skuSummary: uniqueText(record.skuLines.map((item) => item.skuCode)),
    sourceFactoryName: record.sourceFactoryName || '—',
    receiverName: record.targetFactoryName || '—',
    inspectedQty: numberValue(record.inspectedGarmentQty ?? record.submittedGarmentQty),
    qualifiedQty: numberValue(record.passedGarmentQty ?? record.acceptedGarmentQty),
    reworkQty,
    defectQty,
    reworkReceivers:
      record.reworkReceiveFactoryName ||
      skuResults.find((item) => numberValue(item.reworkQty) > 0 && item.reworkReceiveFactoryName)?.reworkReceiveFactoryName ||
      '—',
    reworkChargebackAmountText: formatIdrAmount(reworkChargebackAmount),
    resultLabel: record.qcResult || record.status,
    inspectedAt: record.finishedAt || record.startedAt || '—',
    inspectorName: record.operatorName || '—',
    settlementTrace: postTrace(record),
  }
}

function normalizePostEvidenceType(assetType: PostFinishingEvidenceAsset['assetType']): 'IMAGE' | 'VIDEO' | 'DOCUMENT' {
  if (assetType === '图片') return 'IMAGE'
  if (assetType === '视频') return 'VIDEO'
  return 'DOCUMENT'
}

function mapPostEvidence(asset: PostFinishingEvidenceAsset): QcFactDetail['evidenceAssets'][number] {
  return {
    assetId: asset.assetId,
    name: asset.assetName,
    url: asset.url,
    assetType: normalizePostEvidenceType(asset.assetType),
  }
}

function mapPlatformDetail(vm: PlatformQcDetailViewModel): QcFactDetail {
  const row: QcFactRow = {
    id: vm.qcId,
    displayNo: vm.qcNo,
    sourceKind: 'QUALITY_CHAIN',
    sourceTypeLabel: vm.qcRecord.processLabel || vm.sourceTypeLabel,
    productionOrderNo: vm.qcRecord.productionOrderNo || '—',
    skuSummary: vm.qcRecord.returnInboundBatchNo || vm.qcRecord.taskId || '—',
    sourceFactoryName: vm.qcRecord.returnFactoryName ?? '—',
    receiverName: vm.qcRecord.receiverName ?? vm.qcRecord.warehouseName ?? '—',
    inspectedQty: vm.qcRecord.inspectedQty,
    qualifiedQty: vm.qcRecord.qualifiedQty,
    reworkQty: 0,
    defectQty: vm.qcRecord.unqualifiedQty,
    reworkReceivers: '—',
    reworkChargebackAmountText: '—',
    resultLabel: vm.qcResultLabel,
    inspectedAt: vm.qcRecord.inspectedAt,
    inspectorName: vm.qcRecord.inspectorUserName || '—',
    settlementTrace: vm.settlementImpact.includedSettlementStatementId
      ? {
          statementNo: vm.settlementImpact.includedSettlementStatementId,
          deductionLineNo: vm.deductionBasis?.basisId,
          statusLabel: '已进入对账',
        }
      : vm.deductionBasis?.basisId
        ? { deductionLineNo: vm.deductionBasis.basisId, statusLabel: '待对账引用' }
        : { statusLabel: '未进入对账' },
  }

  return {
    ...row,
    qcStationName: vm.qcRecord.receiverName ?? vm.qcRecord.warehouseName ?? '—',
    skuResults: vm.qcRecord.defectItems.map((item) => ({
      skuCode: vm.qcRecord.productionOrderNo,
      colorName: '—',
      sizeName: '—',
      inspectedQty: vm.qcRecord.inspectedQty,
      qualifiedQty: vm.qcRecord.qualifiedQty,
      reworkQty: 0,
      defectQty: item.qty,
      reworkReceiveFactoryName: '—',
      reworkChargebackAmountText: '—',
      defectReasonSummary: `${item.defectName}${item.qty}`,
      postProjectSummary: '—',
      qtyUnit: '件',
    })),
    evidenceAssets: vm.qcRecord.evidenceAssets,
    rawFacts: [
      { label: '来源批次', value: vm.qcRecord.returnInboundBatchNo || '—' },
      { label: '来源任务', value: vm.qcRecord.taskId || '—' },
      { label: '接收方', value: vm.qcRecord.receiverName ?? vm.qcRecord.warehouseName ?? '—' },
    ],
  }
}

function mapPostDetail(record: PostFinishingActionRecord): QcFactDetail {
  return {
    ...mapPostRow(record),
    qcStationName: record.qcStationName || '—',
    skuResults: (record.qcSkuResults ?? []).map((item) => mapPostSku(item, record.sourceFactoryName)),
    evidenceAssets: (record.evidenceAssets ?? []).map(mapPostEvidence),
    rawFacts: [
      { label: '来源后道单', value: record.postOrderNo || '—' },
      { label: '上游工厂', value: record.sourceFactoryName || '—' },
      { label: '后道工厂', value: record.targetFactoryName || '—' },
    ],
  }
}

export function listQcFactRows(options: { includeLegacy?: boolean } = {}): QcFactRow[] {
  const postRows = listPostFinishingQcOrders().map(mapPostRow)
  const qualityRows = listPlatformQcListItems({ includeLegacy: options.includeLegacy }).map(mapPlatformRow)
  return [...postRows, ...qualityRows].sort((left, right) => right.inspectedAt.localeCompare(left.inspectedAt))
}

export function getQcFactDetail(id: string): QcFactDetail | null {
  const postRecord = listPostFinishingQcOrders().find(
    (record) => record.actionRecordId === id || record.actionRecordNo === id || record.linkedQcOrderId === id,
  )
  if (postRecord) return mapPostDetail(postRecord)

  const platformVm = getPlatformQcDetailViewModelByRouteKey(id)
  return platformVm ? mapPlatformDetail(platformVm) : null
}
