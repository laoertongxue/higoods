import { appStore } from '../../state/store'
import { type ProcessTask } from '../../data/fcs/process-tasks'
import { applyQualitySeedBootstrap } from '../../data/fcs/store-domain-quality-bootstrap'
import {
  getQcById as getQcByIdFromChain,
  resolveQcIdFromRouteKey,
} from '../../data/fcs/quality-chain-adapter'
import {
  getPlatformQcDetailViewModelByRouteKey,
  getPlatformQcWorkbenchStats,
  getPlatformQcWorkbenchTabCounts,
  listPlatformQcListItems,
  matchesPlatformQcWorkbenchView,
  type PlatformQcWorkbenchStats,
  type PlatformQcWorkbenchViewKey,
} from '../../data/fcs/quality-deduction-selectors'
import type {
  QualityDeductionDisputeAdjudicationResult,
  QualityDeductionDisputeStatus,
  QualityDeductionFactoryResponseStatus,
  QualityDeductionLiabilityStatus,
  QualityDeductionSettlementImpactStatus,
} from '../../data/fcs/quality-deduction-domain'
import {
  initialDeductionBasisItems,
  initialQualityInspections,
  initialReturnInboundBatches,
} from '../../data/fcs/store-domain-quality-seeds'
import {
  defaultResponsibility,
  type DeductionDecision,
  type DefectItem,
  type DeductionBasisItem,
  type LiabilityStatus,
  type QcResult as DomainQcResult,
  type ReturnInboundProcessType,
  type ReturnInboundQcPolicy,
  type QualityInspection,
  type SettlementPartyType,
} from '../../data/fcs/store-domain-quality-types'
import {
  blockTaskForReturnInboundQc,
  findReturnInboundBatchForQc,
  isReturnInboundInspection,
  isSewReturnInboundQc,
  requiresFinalLiabilityDecision,
  resolveReturnInboundTaskId,
  upsertDeductionBasisFromReturnInboundQc,
} from '../../data/fcs/return-inbound-workflow'
import {
  normalizeQcForView,
  RETURN_INBOUND_PROCESS_LABEL,
  RETURN_INBOUND_QC_POLICY_LABEL,
  SEW_POST_PROCESS_MODE_LABEL,
  type ReturnInboundQcDisplayResult,
} from '../../data/fcs/return-inbound-qc-view'
import { listExecutionTaskFacts } from '../../data/fcs/page-adapters/task-execution-adapter'
import { escapeHtml, formatDateTime, toClassName } from '../../utils'

applyQualitySeedBootstrap()

const processTasks: ProcessTask[] = listExecutionTaskFacts()

type QcResult = DomainQcResult
type QcDisplayResult = ReturnInboundQcDisplayResult
type QcStatus = 'DRAFT' | 'SUBMITTED' | 'CLOSED'
type QcDisposition = 'ACCEPT_AS_DEFECT' | 'SCRAP' | 'ACCEPT'
type RootCauseType = 'PROCESS' | 'MATERIAL' | 'DYE_PRINT' | 'CUTTING' | 'PATTERN_TECH' | 'UNKNOWN'
type RefType = 'TASK' | 'HANDOVER' | 'RETURN_BATCH'

type ResultFilter = 'ALL' | QcDisplayResult
type StatusFilter = 'ALL' | QcStatus
type DispositionFilter = 'ALL' | QcDisposition
type LiabilityFilter = 'ALL' | QualityDeductionLiabilityStatus
type FactoryResponseFilter = 'ALL' | QualityDeductionFactoryResponseStatus
type DisputeFilter = 'ALL' | QualityDeductionDisputeStatus
type SettlementImpactFilter = 'ALL' | QualityDeductionSettlementImpactStatus
type InspectorFilter = 'ALL' | string

interface QcRecordsListState {
  activeView: PlatformQcWorkbenchViewKey
  keyword: string
  filterProcessType: 'ALL' | ReturnInboundProcessType
  filterPolicy: 'ALL' | ReturnInboundQcPolicy
  filterResult: ResultFilter
  filterStatus: StatusFilter
  filterDisposition: DispositionFilter
  filterLiabilityStatus: LiabilityFilter
  filterFactoryResponseStatus: FactoryResponseFilter
  filterDisputeStatus: DisputeFilter
  filterSettlementImpactStatus: SettlementImpactFilter
  filterInspector: InspectorFilter
  filterFactory: string
  filterWarehouse: string
  showLegacy: boolean
}

interface QcRecordFormState {
  refType: RefType
  refId: string
  productionOrderId: string
  inspector: string
  inspectedAt: string
  result: QcResult
  defectItems: DefectItem[]
  disposition: QcDisposition | ''
  affectedQty: number | ''
  rootCauseType: RootCauseType
  responsiblePartyType: SettlementPartyType | ''
  responsiblePartyId: string
  responsiblePartyName: string
  liabilityStatus: LiabilityStatus
  deductionDecision: DeductionDecision | ''
  deductionAmount: number | ''
  deductionDecisionRemark: string
  dispositionRemark: string
  remark: string
}

interface QcRecordDetailState {
  routeQcId: string
  queryKey: string
  currentQcId: string | null
  syncedUpdatedAt: string | null
  form: QcRecordFormState
  bdAcceptDefect: number | ''
  bdScrap: number | ''
  bdNoDeduct: number | ''
  adjudication: {
    result: '' | QualityDeductionDisputeAdjudicationResult
    comment: string
    adjustedLiableQty: number | ''
    adjustedBlockedProcessingFeeAmount: number | ''
    adjustedEffectiveQualityDeductionAmount: number | ''
    adjustmentReasonSummary: string
    errorText: string
  }
}

const NEEDS_AFFECTED_QTY: QcDisposition[] = ['ACCEPT_AS_DEFECT']

const RESULT_LABEL: Record<QcDisplayResult, string> = {
  PASS: '合格',
  PARTIAL_PASS: '部分合格',
  FAIL: '不合格',
}

const RESULT_CLASS: Record<QcDisplayResult, string> = {
  PASS: 'bg-green-100 text-green-700 border-green-300',
  PARTIAL_PASS: 'bg-amber-100 text-amber-700 border-amber-300',
  FAIL: 'bg-red-100 text-red-700 border-red-300',
}

const STATUS_LABEL: Record<QcStatus, string> = {
  DRAFT: '草稿',
  SUBMITTED: '已提交',
  CLOSED: '已结案',
}

const STATUS_CLASS: Record<QcStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground border',
  SUBMITTED: 'bg-green-100 text-green-700 border-green-300',
  CLOSED: 'bg-blue-100 text-blue-700 border-blue-300',
}

const DISPOSITION_LABEL: Record<QcDisposition, string> = {
  ACCEPT_AS_DEFECT: '接受（瑕疵品）',
  SCRAP: '报废',
  ACCEPT: '接受（不合格品免扣）',
}

const DEDUCTION_DECISION_LABEL: Record<DeductionDecision, string> = {
  DEDUCT: '扣款',
  NO_DEDUCT: '不扣款',
}

const DISPOSITION_CLASS: Record<QcDisposition, string> = {
  ACCEPT_AS_DEFECT: 'bg-blue-100 text-blue-700 border-blue-300',
  SCRAP: 'bg-red-100 text-red-700 border-red-300',
  ACCEPT: 'bg-green-100 text-green-700 border-green-300',
}

const ROOT_CAUSE_LABEL: Record<RootCauseType, string> = {
  PROCESS: '工艺问题',
  MATERIAL: '面辅料问题',
  DYE_PRINT: '染整/印花问题',
  CUTTING: '裁剪问题',
  PATTERN_TECH: '版型/技术问题',
  UNKNOWN: '未知',
}

const LIABILITY_LABEL: Record<string, string> = {
  DRAFT: '草稿',
  CONFIRMED: '已确认',
  DISPUTED: '争议中',
  VOID: '已作废',
  PENDING: '待判定',
  FACTORY: '工厂责任',
  NON_FACTORY: '非工厂责任',
  MIXED: '混合责任',
}

const PARTY_TYPE_LABEL: Record<SettlementPartyType, string> = {
  FACTORY: '工厂',
  SUPPLIER: '供应商',
  PROCESSOR: '外发商',
  GROUP_INTERNAL: '集团内部',
  OTHER: '其他',
}

const listState: QcRecordsListState = {
  activeView: 'ALL',
  keyword: '',
  filterProcessType: 'ALL',
  filterPolicy: 'ALL',
  filterResult: 'ALL',
  filterStatus: 'ALL',
  filterDisposition: 'ALL',
  filterLiabilityStatus: 'ALL',
  filterFactoryResponseStatus: 'ALL',
  filterDisputeStatus: 'ALL',
  filterSettlementImpactStatus: 'ALL',
  filterInspector: 'ALL',
  filterFactory: 'ALL',
  filterWarehouse: 'ALL',
  showLegacy: false,
}

let detailState: QcRecordDetailState | null = null

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

let qcLocalIdSeq = 0

function randomSuffix(length = 4): string {
  qcLocalIdSeq += 1
  return qcLocalIdSeq.toString(36).toUpperCase().padStart(length, '0').slice(-length)
}

function showQcRecordsToast(message: string, tone: 'success' | 'error' = 'success'): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'qc-records-toast-root'
  let root = document.getElementById(rootId)

  if (!root) {
    root = document.createElement('div')
    root.id = rootId
    root.className = 'pointer-events-none fixed right-6 top-20 z-[120] flex max-w-sm flex-col gap-2'
    document.body.appendChild(root)
  }

  const toast = document.createElement('div')
  toast.className =
    tone === 'error'
      ? 'pointer-events-auto rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-md transition-all duration-200'
      : 'pointer-events-auto rounded-md border bg-background px-4 py-3 text-sm text-foreground shadow-md transition-all duration-200'

  toast.textContent = message
  toast.style.opacity = '0'
  toast.style.transform = 'translateY(-6px)'

  root.appendChild(toast)

  window.requestAnimationFrame(() => {
    toast.style.opacity = '1'
    toast.style.transform = 'translateY(0)'
  })

  window.setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transform = 'translateY(-6px)'
    window.setTimeout(() => {
      toast.remove()
      if (root && root.childElementCount === 0) {
        root.remove()
      }
    }, 180)
  }, 2300)
}

function getCurrentQueryString(): string {
  const pathname = appStore.getState().pathname
  const [_, query] = pathname.split('?')
  return query ?? ''
}

function getCurrentSearchParams(): URLSearchParams {
  return new URLSearchParams(getCurrentQueryString())
}

function syncListViewFromRouteQuery(): void {
  const routeView = getCurrentSearchParams().get('view')
  const allowedViews: PlatformQcWorkbenchViewKey[] = [
    'ALL',
    'WAIT_FACTORY_RESPONSE',
    'AUTO_CONFIRMED',
    'DISPUTING',
    'WAIT_PLATFORM_REVIEW',
    'CLOSED',
  ]
  if (routeView && allowedViews.includes(routeView as PlatformQcWorkbenchViewKey)) {
    listState.activeView = routeView as PlatformQcWorkbenchViewKey
  }
}

function getCurrentDetailRouteId(): string | null {
  const pathname = appStore.getState().pathname
  const normalized = pathname.split('#')[0]
  const match = /^\/fcs\/(?:quality|pda)\/qc-records\/([^/?]+)/.exec(normalized)
  if (!match) return null
  return decodeURIComponent(match[1])
}

function emptyForm(overrides: Partial<QcRecordFormState> = {}): QcRecordFormState {
  return {
    refType: 'RETURN_BATCH',
    refId: '',
    productionOrderId: '',
    inspector: '质检员A',
    inspectedAt: nowTimestamp(),
    result: 'PASS',
    defectItems: [],
    disposition: '',
    affectedQty: '',
    rootCauseType: 'UNKNOWN',
    responsiblePartyType: '',
    responsiblePartyId: '',
    responsiblePartyName: '',
    liabilityStatus: 'DRAFT',
    deductionDecision: '',
    deductionAmount: '',
    deductionDecisionRemark: '',
    dispositionRemark: '',
    remark: '',
    ...overrides,
  }
}

function emptyAdjudicationDraft(
  overrides: Partial<QcRecordDetailState['adjudication']> = {},
): QcRecordDetailState['adjudication'] {
  return {
    result: '',
    comment: '',
    adjustedLiableQty: '',
    adjustedBlockedProcessingFeeAmount: '',
    adjustedEffectiveQualityDeductionAmount: '',
    adjustmentReasonSummary: '',
    errorText: '',
    ...overrides,
  }
}

function qcToForm(qc: QualityInspection): QcRecordFormState {
  const isReturnInbound =
    qc.inspectionScene === 'RETURN_INBOUND' ||
    qc.inspectionScene === 'SEW_RETURN_RECEIVING_QC' ||
    qc.inspectionScene === 'PRINT_RECEIVING_QC' ||
    qc.inspectionScene === 'DYE_RECEIVING_QC' ||
    qc.inspectionScene === 'CUT_PIECE_RECEIVING_QC' ||
    Boolean(qc.returnBatchId) ||
    qc.refType === 'RETURN_BATCH'
  const refType: RefType = isReturnInbound ? 'RETURN_BATCH' : qc.refType === 'HANDOVER' ? 'HANDOVER' : 'TASK'
  const refId = isReturnInbound ? qc.returnBatchId ?? qc.refId : qc.refId

  return {
    refType,
    refId,
    productionOrderId: qc.productionOrderId,
    inspector: qc.inspector,
    inspectedAt: qc.inspectedAt,
    result: qc.result as QcResult,
    defectItems: qc.defectItems.map((item) => ({ ...item })),
    disposition: (qc.disposition as QcDisposition | undefined) ?? '',
    affectedQty: qc.affectedQty ?? '',
    rootCauseType: (qc.rootCauseType as RootCauseType) ?? 'UNKNOWN',
    responsiblePartyType: qc.responsiblePartyType ?? '',
    responsiblePartyId: qc.responsiblePartyId ?? '',
    responsiblePartyName: qc.responsiblePartyName ?? '',
    liabilityStatus: qc.liabilityStatus,
    deductionDecision: qc.deductionDecision ?? '',
    deductionAmount: qc.deductionAmount ?? '',
    deductionDecisionRemark: qc.deductionDecisionRemark ?? '',
    dispositionRemark: qc.dispositionRemark ?? '',
    remark: qc.remark ?? '',
  }
}

function getQcById(qcId: string): QualityInspection | null {
  return getQcByIdFromChain(qcId)
}

function getReturnInboundBatchById(batchId: string): (typeof initialReturnInboundBatches)[number] | null {
  return initialReturnInboundBatches.find((item) => item.batchId === batchId) ?? null
}

function applyReturnInboundBatchToForm(form: QcRecordFormState, batchId: string): void {
  const batch = getReturnInboundBatchById(batchId)
  if (!batch) return
  form.refId = batch.batchId
  form.productionOrderId = batch.productionOrderId
}

function isSewReturnInboundFromForm(
  form: QcRecordFormState,
  existing?: QualityInspection | null,
): boolean {
  const batch = form.refType === 'RETURN_BATCH' ? getReturnInboundBatchById(form.refId.trim()) : null
  if (batch) return batch.processType === 'SEW'
  if (existing) return isSewReturnInboundQc(existing, initialReturnInboundBatches)
  return false
}

function requiresFinalDecisionForForm(
  form: QcRecordFormState,
  existing?: QualityInspection | null,
): boolean {
  return form.result === 'FAIL' && isSewReturnInboundFromForm(form, existing)
}

function replaceQc(updated: QualityInspection): void {
  const index = initialQualityInspections.findIndex((item) => item.qcId === updated.qcId)
  if (index >= 0) {
    initialQualityInspections[index] = updated
  }
}

function syncDetailFromQc(state: QcRecordDetailState, qc: QualityInspection): void {
  state.form = qcToForm(qc)
  state.syncedUpdatedAt = qc.updatedAt
  state.bdAcceptDefect = qc.dispositionQtyBreakdown?.acceptAsDefectQty ?? ''
  state.bdScrap = qc.dispositionQtyBreakdown?.scrapQty ?? ''
  state.bdNoDeduct = qc.dispositionQtyBreakdown?.acceptNoDeductQty ?? ''
}

function ensureDetailState(routeQcId: string): QcRecordDetailState {
  const queryKey = getCurrentQueryString()

  if (!detailState || detailState.routeQcId !== routeQcId || detailState.queryKey !== queryKey) {
    const isNew = routeQcId === 'new'
    const currentQcId = isNew ? null : resolveQcIdFromRouteKey(routeQcId) ?? routeQcId
    const existingQc = currentQcId ? getQcById(currentQcId) : null

    const params = getCurrentSearchParams()
    const taskId = params.get('taskId') ?? ''
    const handoverId = params.get('handoverId') ?? ''
    const returnBatchId = params.get('returnBatchId') ?? params.get('batchId') ?? ''
    const prefTask = taskId ? processTasks.find((item) => item.taskId === taskId) : undefined

    const initOverrides: Partial<QcRecordFormState> = {}
    if (returnBatchId) {
      initOverrides.refType = 'RETURN_BATCH'
      initOverrides.refId = returnBatchId
      const inboundBatch = getReturnInboundBatchById(returnBatchId)
      if (inboundBatch?.productionOrderId) {
        initOverrides.productionOrderId = inboundBatch.productionOrderId
      }
    } else if (taskId) {
      initOverrides.refType = 'TASK'
      initOverrides.refId = taskId
      if (prefTask?.productionOrderId) {
        initOverrides.productionOrderId = prefTask.productionOrderId
      }
    } else if (handoverId) {
      initOverrides.refType = 'HANDOVER'
      initOverrides.refId = handoverId
    } else {
      const firstBatch = initialReturnInboundBatches[0]
      if (firstBatch) {
        initOverrides.refType = 'RETURN_BATCH'
        initOverrides.refId = firstBatch.batchId
        initOverrides.productionOrderId = firstBatch.productionOrderId
      }
    }

    detailState = {
      routeQcId,
      queryKey,
      currentQcId,
      syncedUpdatedAt: existingQc?.updatedAt ?? null,
      form: existingQc ? qcToForm(existingQc) : emptyForm(initOverrides),
      bdAcceptDefect: existingQc?.dispositionQtyBreakdown?.acceptAsDefectQty ?? '',
      bdScrap: existingQc?.dispositionQtyBreakdown?.scrapQty ?? '',
      bdNoDeduct: existingQc?.dispositionQtyBreakdown?.acceptNoDeductQty ?? '',
      adjudication: emptyAdjudicationDraft(
        currentQcId
          ? (() => {
              const detailVm = getPlatformQcDetailViewModelByRouteKey(routeQcId)
              return detailVm
                ? {
                    adjustedLiableQty:
                      detailVm.deductionBasis?.deductionQty ?? detailVm.qcRecord.factoryLiabilityQty,
                    adjustedBlockedProcessingFeeAmount:
                      detailVm.settlementImpact.blockedProcessingFeeAmount,
                    adjustedEffectiveQualityDeductionAmount:
                      detailVm.settlementImpact.effectiveQualityDeductionAmount,
                  }
                : {}
            })()
          : {},
      ),
    }
  }

  if (detailState.currentQcId) {
    const latest = getQcById(detailState.currentQcId)
    if (latest && latest.updatedAt !== detailState.syncedUpdatedAt) {
      syncDetailFromQc(detailState, latest)
    }
  }

  return detailState
}

function toInputValue(value: string | number | '' | undefined): string {
  if (value === undefined || value === null) return ''
  return escapeHtml(String(value))
}

function parseNumberField(value: string): number | '' {
  if (!value.trim()) return ''
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return ''
  return Math.floor(parsed)
}

function parseAmountField(value: string): number | '' {
  if (!value.trim()) return ''
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return ''
  const normalized = Math.round(parsed * 100) / 100
  if (normalized < 0) return ''
  return normalized
}

function generateQcId(): string {
  const now = new Date()
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`

  let seq = initialQualityInspections.length + 1
  while (seq < 99999) {
    const id = `QC-${ym}-${String(seq).padStart(4, '0')}`
    if (!initialQualityInspections.some((item) => item.qcId === id)) {
      return id
    }
    seq += 1
  }

  return `QC-${Date.now()}-${randomSuffix(4)}`
}


function getQcViewRows() {
  return listPlatformQcListItems({ includeLegacy: listState.showLegacy })
}

function getFactoryOptions(): string[] {
  const options = new Set<string>()
  for (const row of getQcViewRows()) {
    if (row.returnFactoryName && row.returnFactoryName !== '-') {
      options.add(row.returnFactoryName)
    }
  }
  return Array.from(options).sort((a, b) => a.localeCompare(b))
}

function getWarehouseOptions(): string[] {
  const options = new Set<string>()
  for (const row of getQcViewRows()) {
    if (row.warehouseName && row.warehouseName !== '-') {
      options.add(row.warehouseName)
    }
  }
  return Array.from(options).sort((a, b) => a.localeCompare(b))
}

function getInspectorOptions(): string[] {
  const options = new Set<string>()
  for (const row of getQcViewRows()) {
    if (row.inspector && row.inspector !== '-') {
      options.add(row.inspector)
    }
  }
  return Array.from(options).sort((a, b) => a.localeCompare(b))
}

function getWorkbenchStats(): PlatformQcWorkbenchStats {
  return getPlatformQcWorkbenchStats({ includeLegacy: listState.showLegacy })
}

function getWorkbenchTabCounts(): Record<PlatformQcWorkbenchViewKey, number> {
  return getPlatformQcWorkbenchTabCounts({ includeLegacy: listState.showLegacy })
}

function getFilteredQcRows() {
  syncListViewFromRouteQuery()
  const keyword = listState.keyword.trim().toLowerCase()

  return getQcViewRows()
    .filter((row) => {
      if (!matchesPlatformQcWorkbenchView(row, listState.activeView)) {
        return false
      }

      if (listState.filterProcessType !== 'ALL' && row.processType !== listState.filterProcessType) {
        return false
      }

      if (listState.filterPolicy !== 'ALL' && row.qcPolicy !== listState.filterPolicy) {
        return false
      }

      if (listState.filterResult !== 'ALL' && row.result !== listState.filterResult) {
        return false
      }

      if (listState.filterStatus !== 'ALL' && row.status !== listState.filterStatus) {
        return false
      }

      if (
        listState.filterLiabilityStatus !== 'ALL' &&
        row.liabilityStatus !== listState.filterLiabilityStatus
      ) {
        return false
      }

      if (
        listState.filterFactoryResponseStatus !== 'ALL' &&
        row.factoryResponseStatus !== listState.filterFactoryResponseStatus
      ) {
        return false
      }

      if (
        listState.filterDisputeStatus !== 'ALL' &&
        row.disputeStatus !== listState.filterDisputeStatus
      ) {
        return false
      }

      if (
        listState.filterSettlementImpactStatus !== 'ALL' &&
        row.settlementImpactStatus !== listState.filterSettlementImpactStatus
      ) {
        return false
      }

      if (
        listState.filterDisposition !== 'ALL' &&
        (row.disposition as QcDisposition | undefined) !== listState.filterDisposition
      ) {
        return false
      }

      if (listState.filterInspector !== 'ALL' && row.inspector !== listState.filterInspector) {
        return false
      }

      if (listState.filterFactory !== 'ALL' && row.returnFactoryName !== listState.filterFactory) {
        return false
      }

      if (listState.filterWarehouse !== 'ALL' && row.warehouseName !== listState.filterWarehouse) {
        return false
      }

      if (keyword) {
        const match =
          row.qcId.toLowerCase().includes(keyword) ||
          row.qcNo.toLowerCase().includes(keyword) ||
          row.batchId.toLowerCase().includes(keyword) ||
          row.productionOrderId.toLowerCase().includes(keyword) ||
          row.sourceTaskId.toLowerCase().includes(keyword)
        if (!match) return false
      }

      return true
    })
    .sort((left, right) => {
      return new Date(right.inspectedAt || right.qc.updatedAt).getTime() - new Date(left.inspectedAt || left.qc.updatedAt).getTime()
    })
}

export {
  appStore,
  initialDeductionBasisItems,
  initialQualityInspections,
  initialReturnInboundBatches,
  defaultResponsibility,
  blockTaskForReturnInboundQc,
  findReturnInboundBatchForQc,
  isReturnInboundInspection,
  isSewReturnInboundQc,
  requiresFinalLiabilityDecision,
  resolveReturnInboundTaskId,
  upsertDeductionBasisFromReturnInboundQc,
  normalizeQcForView,
  RETURN_INBOUND_PROCESS_LABEL,
  RETURN_INBOUND_QC_POLICY_LABEL,
  SEW_POST_PROCESS_MODE_LABEL,
  escapeHtml,
  formatDateTime,
  toClassName,
  processTasks,
  NEEDS_AFFECTED_QTY,
  RESULT_LABEL,
  RESULT_CLASS,
  STATUS_LABEL,
  STATUS_CLASS,
  DISPOSITION_LABEL,
  DEDUCTION_DECISION_LABEL,
  DISPOSITION_CLASS,
  ROOT_CAUSE_LABEL,
  LIABILITY_LABEL,
  PARTY_TYPE_LABEL,
  listState,
  nowTimestamp,
  randomSuffix,
  showQcRecordsToast,
  getCurrentQueryString,
  getCurrentSearchParams,
  syncListViewFromRouteQuery,
  getCurrentDetailRouteId,
  emptyForm,
  qcToForm,
  getQcById,
  resolveQcIdFromRouteKey,
  getReturnInboundBatchById,
  applyReturnInboundBatchToForm,
  isSewReturnInboundFromForm,
  requiresFinalDecisionForForm,
  replaceQc,
  syncDetailFromQc,
  ensureDetailState,
  toInputValue,
  parseNumberField,
  parseAmountField,
  getQcViewRows,
  getFactoryOptions,
  getWarehouseOptions,
  getInspectorOptions,
  getWorkbenchStats,
  getWorkbenchTabCounts,
  getFilteredQcRows,
}

export type {
  ProcessTask,
  DeductionDecision,
  DefectItem,
  DeductionBasisItem,
  LiabilityStatus,
  ReturnInboundProcessType,
  ReturnInboundQcPolicy,
  QualityInspection,
  SettlementPartyType,
  QcDisplayResult,
  QcResult,
  QcStatus,
  QcDisposition,
  RootCauseType,
  RefType,
  ResultFilter,
  StatusFilter,
  DispositionFilter,
  LiabilityFilter,
  FactoryResponseFilter,
  DisputeFilter,
  SettlementImpactFilter,
  InspectorFilter,
  QcRecordsListState,
  QcRecordFormState,
  QcRecordDetailState,
}
