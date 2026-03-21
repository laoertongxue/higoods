import { appStore } from '../state/store'
import { type ProcessTask } from '../data/fcs/process-tasks'
import { applyQualitySeedBootstrap } from '../data/fcs/store-domain-quality-bootstrap'
import {
  initialDeductionBasisItems,
  initialQualityInspections,
  initialReturnInboundBatches,
} from '../data/fcs/store-domain-quality-seeds'
import {
  defaultResponsibility,
  type DeductionDecision,
  type DefectItem,
  type DeductionBasisItem,
  type LiabilityStatus,
  type ReturnInboundProcessType,
  type ReturnInboundQcPolicy,
  type QualityInspection,
  type SettlementPartyType,
} from '../data/fcs/store-domain-quality-types'
import {
  blockTaskForReturnInboundQc,
  findReturnInboundBatchForQc,
  isReturnInboundInspection,
  isSewReturnInboundQc,
  requiresFinalLiabilityDecision,
  resolveReturnInboundTaskId,
  upsertDeductionBasisFromReturnInboundQc,
} from '../data/fcs/return-inbound-workflow'
import {
  normalizeQcForView,
  RETURN_INBOUND_PROCESS_LABEL,
  RETURN_INBOUND_QC_POLICY_LABEL,
  SEW_POST_PROCESS_MODE_LABEL,
} from '../data/fcs/return-inbound-qc-view'
import { listExecutionTaskFacts } from '../data/fcs/page-adapters/task-execution-adapter'
import { escapeHtml, formatDateTime, toClassName } from '../utils'

applyQualitySeedBootstrap()

const processTasks: ProcessTask[] = listExecutionTaskFacts()

type QcResult = 'PASS' | 'FAIL'
type QcStatus = 'DRAFT' | 'SUBMITTED' | 'CLOSED'
type QcDisposition = 'ACCEPT_AS_DEFECT' | 'SCRAP' | 'ACCEPT'
type RootCauseType = 'PROCESS' | 'MATERIAL' | 'DYE_PRINT' | 'CUTTING' | 'PATTERN_TECH' | 'UNKNOWN'
type RefType = 'TASK' | 'HANDOVER' | 'RETURN_BATCH'

type ResultFilter = 'ALL' | QcResult
type StatusFilter = 'ALL' | QcStatus
type DispositionFilter = 'ALL' | QcDisposition

interface QcRecordsListState {
  keyword: string
  filterProcessType: 'ALL' | ReturnInboundProcessType
  filterPolicy: 'ALL' | ReturnInboundQcPolicy
  filterResult: ResultFilter
  filterStatus: StatusFilter
  filterDisposition: DispositionFilter
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
}

const NEEDS_AFFECTED_QTY: QcDisposition[] = ['ACCEPT_AS_DEFECT']

const RESULT_LABEL: Record<QcResult, string> = {
  PASS: '合格',
  FAIL: '不合格',
}

const RESULT_CLASS: Record<QcResult, string> = {
  PASS: 'bg-green-100 text-green-700 border-green-300',
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
  ACCEPT: '接受（无扣款）',
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

const LIABILITY_LABEL: Record<LiabilityStatus, string> = {
  DRAFT: '草稿',
  CONFIRMED: '已确认',
  DISPUTED: '争议中',
  VOID: '已作废',
}

const PARTY_TYPE_LABEL: Record<SettlementPartyType, string> = {
  FACTORY: '工厂',
  SUPPLIER: '供应商',
  PROCESSOR: '外发商',
  GROUP_INTERNAL: '集团内部',
  OTHER: '其他',
}

const listState: QcRecordsListState = {
  keyword: '',
  filterProcessType: 'ALL',
  filterPolicy: 'ALL',
  filterResult: 'ALL',
  filterStatus: 'ALL',
  filterDisposition: 'ALL',
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

function getCurrentDetailRouteId(): string | null {
  const pathname = appStore.getState().pathname
  const normalized = pathname.split('#')[0]
  const match = /^\/fcs\/quality\/qc-records\/([^/?]+)/.exec(normalized)
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

function qcToForm(qc: QualityInspection): QcRecordFormState {
  const isReturnInbound = qc.inspectionScene === 'RETURN_INBOUND' || qc.refType === 'RETURN_BATCH' || Boolean(qc.returnBatchId)
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
  return initialQualityInspections.find((item) => item.qcId === qcId) ?? null
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
    const currentQcId = isNew ? null : routeQcId
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

function createQc(
  payload: Omit<QualityInspection, 'qcId' | 'status' | 'auditLogs' | 'createdAt' | 'updatedAt'>,
): QualityInspection {
  const now = nowTimestamp()
  const qc: QualityInspection = {
    ...payload,
    qcId: generateQcId(),
    status: 'DRAFT',
    auditLogs: [
      {
        id: `QAL-CR-${Date.now()}-${randomSuffix(4)}`,
        action: 'CREATE',
        detail: '创建质检记录',
        at: now,
        by: payload.inspector || '管理员',
      },
    ],
    createdAt: now,
    updatedAt: now,
  }
  initialQualityInspections.push(qc)
  return qc
}

function blockTaskForQuality(task: ProcessTask, qcId: string, by: string, now: string): void {
  if (task.status === 'BLOCKED' && task.blockReason === 'QUALITY') return
  task.status = 'BLOCKED'
  task.blockReason = 'QUALITY'
  task.blockRemark = `质检 ${qcId} 不合格，待处理`
  task.blockedAt = now
  task.updatedAt = now
  task.auditLogs = [
    ...task.auditLogs,
    {
      id: `AL-BLOCK-QC-${Date.now()}-${randomSuffix(4)}`,
      action: 'BLOCK_BY_QC',
      detail: `质检 ${qcId} 不合格，任务生产暂停`,
      at: now,
      by,
    },
  ]
}

function upsertDeductionBasisFromQc(
  qc: QualityInspection,
  parentTask: ProcessTask,
  by: string,
  now: string,
): void {
  const basisQty = qc.affectedQty && qc.affectedQty > 0
    ? qc.affectedQty
    : qc.defectItems.reduce((sum, item) => sum + item.qty, 0)

  if (basisQty <= 0) return

  const existing = initialDeductionBasisItems.find(
    (item) => item.sourceRefId === qc.qcId || item.sourceId === qc.qcId,
  )

  const sourceType = qc.disposition === 'ACCEPT_AS_DEFECT' ? 'QC_DEFECT_ACCEPT' : 'QC_FAIL'

  const mapped = defaultResponsibility(qc.rootCauseType as RootCauseType, parentTask.assignedFactoryId)
  const settlementPartyType = qc.responsiblePartyType ?? mapped.responsiblePartyType
  const settlementPartyId = qc.responsiblePartyId ?? mapped.responsiblePartyId

  const summary =
    qc.defectItems.length > 0
      ? `${qc.defectItems.map((item) => `${item.defectName}×${item.qty}`).join('、')} | disposition=${qc.disposition || '-'}`
      : `质检不合格 | disposition=${qc.disposition || '-'}`

  if (existing) {
    const updated: DeductionBasisItem = {
      ...existing,
      sourceType,
      qty: basisQty,
      disposition: qc.disposition,
      settlementPartyType,
      settlementPartyId,
      rootCauseType: qc.rootCauseType as RootCauseType,
      status: qc.liabilityStatus as DeductionBasisItem['status'],
      summary,
      deepLinks: {
        qcHref: `/fcs/quality/qc-records/${qc.qcId}`,
        taskHref: qc.refType === 'TASK' ? `/fcs/pda/task-receive/${qc.refId}` : undefined,
        handoverHref: qc.refType === 'HANDOVER' ? `/fcs/pda/handover/${qc.refId}` : undefined,
      },
      updatedAt: now,
      updatedBy: by,
      auditLogs: [
        ...existing.auditLogs,
        {
          id: `DBIL-UPD-${Date.now()}-${randomSuffix(4)}`,
          action: 'UPDATE_BASIS_FROM_QC',
          detail: `由质检 ${qc.qcId} 同步更新，qty=${basisQty}`,
          at: now,
          by,
        },
      ],
    }
    const index = initialDeductionBasisItems.findIndex((item) => item.basisId === existing.basisId)
    if (index >= 0) {
      initialDeductionBasisItems[index] = updated
    }
    return
  }

  const basis: DeductionBasisItem = {
    basisId: `DBI-QC-${Date.now()}-${randomSuffix(4)}`,
    sourceType,
    sourceRefId: qc.qcId,
    sourceId: qc.qcId,
    productionOrderId: qc.productionOrderId || parentTask.productionOrderId,
    taskId: parentTask.taskId,
    factoryId: parentTask.assignedFactoryId ?? 'UNKNOWN',
    settlementPartyType,
    settlementPartyId,
    rootCauseType: qc.rootCauseType as RootCauseType,
    reasonCode: 'QUALITY_FAIL',
    qty: basisQty,
    uom: 'PIECE',
    disposition: qc.disposition,
    summary,
    evidenceRefs: qc.defectItems
      .filter((item) => item.remark)
      .map((item) => ({ name: item.defectName, url: item.remark, type: 'DEFECT' })),
    status: qc.liabilityStatus as DeductionBasisItem['status'],
    deepLinks: {
      qcHref: `/fcs/quality/qc-records/${qc.qcId}`,
      taskHref: qc.refType === 'TASK' ? `/fcs/pda/task-receive/${qc.refId}` : undefined,
      handoverHref: qc.refType === 'HANDOVER' ? `/fcs/pda/handover/${qc.refId}` : undefined,
    },
    createdAt: now,
    createdBy: by,
    auditLogs: [
      {
        id: `DBIL-CR-${Date.now()}-${randomSuffix(4)}`,
        action: 'CREATE_BASIS_FROM_QC',
        detail: `由质检 ${qc.qcId} 生成扣款依据，qty=${basisQty}`,
        at: now,
        by,
      },
    ],
  }
  initialDeductionBasisItems.push(basis)
}

function submitQcRecord(qcId: string, by: string): { ok: boolean; message?: string } {
  const qc = getQcById(qcId)
  if (!qc) return { ok: false, message: '质检单不存在' }

  const now = nowTimestamp()
  let auditLogs = [...qc.auditLogs]
  const finalLiabilityRequired = qc.result === 'FAIL' && requiresFinalLiabilityDecision(qc, initialReturnInboundBatches)

  if (finalLiabilityRequired) {
    if (!qc.responsiblePartyType || !qc.responsiblePartyId?.trim()) {
      return { ok: false, message: '车缝回货入仓质检提交前必须填写责任方' }
    }
    if (!qc.disposition) return { ok: false, message: '车缝回货入仓质检提交前必须填写处理方式' }
    if (!qc.deductionDecision) return { ok: false, message: '车缝回货入仓质检提交前必须明确是否扣款' }
    if (qc.deductionDecision === 'DEDUCT') {
      const amount = Number(qc.deductionAmount)
      if (!Number.isFinite(amount) || amount <= 0) {
        return { ok: false, message: '车缝回货入仓质检选择扣款时，金额必须大于 0' }
      }
    } else if (!qc.deductionDecisionRemark?.trim()) {
      return { ok: false, message: '车缝回货入仓质检选择不扣款时，请填写说明' }
    }
  }

  if (qc.result === 'FAIL') {
    if (isReturnInboundInspection(qc)) {
      const inboundBatch = findReturnInboundBatchForQc(qc, initialReturnInboundBatches)
      const resolvedTaskId = resolveReturnInboundTaskId(qc, inboundBatch)
      const parentTask = resolvedTaskId
        ? processTasks.find((task) => task.taskId === resolvedTaskId)
        : null

      if (!inboundBatch) {
        auditLogs.push({
          id: `QAL-RIB-BATCH-MISS-${Date.now()}-${randomSuffix(4)}`,
          action: 'RETURN_INBOUND_BATCH_NOT_FOUND',
          detail: `未找到回货入仓批次（QC=${qc.qcId}）`,
          at: now,
          by,
        })
      }

      if (resolvedTaskId && !parentTask) {
        auditLogs.push({
          id: `QAL-RIB-TASK-MISS-${Date.now()}-${randomSuffix(4)}`,
          action: 'PARENT_TASK_NOT_FOUND',
          detail: `回货入仓质检关联任务 ${resolvedTaskId} 不存在`,
          at: now,
          by,
        })
      }

      if (parentTask) {
        blockTaskForReturnInboundQc({
          task: parentTask,
          qcId: qc.qcId,
          by,
          now,
        })
      }

      if (inboundBatch) {
        upsertDeductionBasisFromReturnInboundQc({
          basisItems: initialDeductionBasisItems,
          qc,
          batch: inboundBatch,
          by,
          now,
          taskId: parentTask?.taskId ?? resolvedTaskId,
          factoryId: parentTask?.assignedFactoryId ?? inboundBatch.returnFactoryId,
          settlementPartyType: inboundBatch.sourceType === 'DYE_PRINT_ORDER' ? 'PROCESSOR' : 'FACTORY',
          settlementPartyId: inboundBatch.returnFactoryId,
        })

        auditLogs.push({
          id: `QAL-RIB-BASIS-${Date.now()}-${randomSuffix(4)}`,
          action: 'GENERATE_DEDUCTION_BASIS',
          detail: '已按回货入仓链路同步生成/更新扣款依据',
          at: now,
          by,
        })
      } else if (parentTask?.assignedFactoryId) {
        upsertDeductionBasisFromQc(qc, parentTask, by, now)
        auditLogs.push({
          id: `QAL-RIB-BASIS-LEGACY-${Date.now()}-${randomSuffix(4)}`,
          action: 'GENERATE_DEDUCTION_BASIS',
          detail: '回货入仓批次缺失，已按任务兼容链路生成/更新扣款依据',
          at: now,
          by,
        })
      }
    } else {
      const parentTask = processTasks.find((task) => task.taskId === qc.refId)
      if (!parentTask) {
        auditLogs.push({
          id: `QAL-NOTFOUND-${Date.now()}-${randomSuffix(4)}`,
          action: 'PARENT_TASK_NOT_FOUND',
          detail: `父任务 ${qc.refId} 不存在，无法标记生产暂停`,
          at: now,
          by,
        })
      } else {
        blockTaskForQuality(parentTask, qc.qcId, by, now)

        if (parentTask.assignedFactoryId) {
          upsertDeductionBasisFromQc(qc, parentTask, by, now)
          auditLogs.push({
            id: `QAL-BASIS-${Date.now()}-${randomSuffix(4)}`,
            action: 'GENERATE_DEDUCTION_BASIS',
            detail: '已同步生成/更新扣款依据',
            at: now,
            by,
          })
        }
      }
    }
  }

  auditLogs.push({
    id: `QAL-SUBMIT-${Date.now()}-${randomSuffix(4)}`,
    action: 'SUBMIT_QC',
    detail: `提交质检结果 ${qc.result}`,
    at: now,
    by,
  })

  const updated: QualityInspection = {
    ...qc,
    status: 'SUBMITTED',
    liabilityDecisionStage: finalLiabilityRequired ? 'SEW_RETURN_INBOUND_FINAL' : qc.liabilityDecisionStage ?? 'GENERAL',
    liabilityDecisionRequired: finalLiabilityRequired ? true : qc.liabilityDecisionRequired ?? false,
    liabilityDecidedAt: finalLiabilityRequired ? now : qc.liabilityDecidedAt,
    liabilityDecidedBy: finalLiabilityRequired ? by : qc.liabilityDecidedBy,
    deductionCurrency:
      finalLiabilityRequired && qc.deductionDecision === 'DEDUCT'
        ? (qc.deductionCurrency ?? 'CNY')
        : qc.deductionCurrency,
    updatedAt: now,
    auditLogs,
  }
  replaceQc(updated)

  return { ok: true }
}

function updateQcDispositionBreakdown(
  qcId: string,
  breakdown: {
    acceptAsDefectQty?: number
    scrapQty?: number
    acceptNoDeductQty?: number
  },
  by: string,
): { ok: boolean; message?: string } {
  const qc = getQcById(qcId)
  if (!qc) return { ok: false, message: '质检单不存在' }
  if (qc.result !== 'FAIL') return { ok: false, message: '仅 FAIL 质检单可保存处置拆分' }

  const acceptAsDefectQty = breakdown.acceptAsDefectQty ?? 0
  const scrapQty = breakdown.scrapQty ?? 0
  const acceptNoDeductQty = breakdown.acceptNoDeductQty ?? 0

  if (
    acceptAsDefectQty < 0 ||
    scrapQty < 0 ||
    acceptNoDeductQty < 0
  ) {
    return { ok: false, message: '拆分数量不能为负数' }
  }

  const sum = acceptAsDefectQty + scrapQty + acceptNoDeductQty
  const target = qc.affectedQty
  if (target !== undefined && target !== null && sum !== target) {
    return { ok: false, message: `合计（${sum}）必须等于不合格数量（${target}）` }
  }

  const now = nowTimestamp()
  const updatedQc: QualityInspection = {
    ...qc,
    dispositionQtyBreakdown: {
      acceptAsDefectQty,
      scrapQty,
      acceptNoDeductQty,
    },
    updatedAt: now,
    auditLogs: [
      ...qc.auditLogs,
      {
        id: `QAL-BD-${Date.now()}-${randomSuffix(4)}`,
        action: 'UPDATE_DISPOSITION_BREAKDOWN',
        detail: `处置拆分更新：瑕疵接收${acceptAsDefectQty}，报废${scrapQty}，无扣款接收${acceptNoDeductQty}`,
        at: now,
        by,
      },
    ],
  }
  replaceQc(updatedQc)

  const deductionQty = sum - acceptNoDeductQty
  for (const basis of initialDeductionBasisItems) {
    if (basis.status === 'VOID') continue
    if (!(basis.sourceRefId === qcId || basis.sourceId === qcId)) continue

    basis.deductionQty = deductionQty
    basis.updatedAt = now
    basis.updatedBy = by
    basis.auditLogs = [
      ...basis.auditLogs,
      {
        id: `DBIL-SYNC-${Date.now()}-${randomSuffix(4)}`,
        action: 'SYNC_DEDUCTION_QTY_FROM_QC',
        detail: `由质检 ${qcId} 拆分同步可扣款数量 ${deductionQty}`,
        at: now,
        by,
      },
    ]
  }

  return { ok: true }
}

function buildPayload(
  form: QcRecordFormState,
  existing: QualityInspection | null,
): Omit<QualityInspection, 'qcId' | 'status' | 'auditLogs' | 'createdAt' | 'updatedAt'> {
  const isFail = form.result === 'FAIL'
  const needsQty = form.disposition ? NEEDS_AFFECTED_QTY.includes(form.disposition) : false
  const finalLiabilityRequired = requiresFinalDecisionForForm(form, existing)

  const defectItems = isFail
    ? form.defectItems.map((item, index) => ({
        defectCode: item.defectCode?.trim() || `D${String(index + 1).padStart(3, '0')}`,
        defectName: item.defectName.trim(),
        qty: item.qty,
        remark: item.remark?.trim() || undefined,
      }))
    : []

  const basePayload: Omit<QualityInspection, 'qcId' | 'status' | 'auditLogs' | 'createdAt' | 'updatedAt'> = {
    refType: form.refType,
    refId: form.refId.trim(),
    productionOrderId: form.productionOrderId.trim(),
    inspector: form.inspector.trim(),
    inspectedAt: form.inspectedAt.trim(),
    result: form.result,
    defectItems,
    remark: form.remark.trim() || undefined,
    disposition: isFail && form.disposition ? form.disposition : undefined,
    affectedQty:
      isFail && needsQty && form.affectedQty !== ''
        ? Number(form.affectedQty)
        : undefined,
    rootCauseType: form.rootCauseType,
    responsiblePartyType: form.responsiblePartyType || undefined,
    responsiblePartyId: form.responsiblePartyId.trim() || undefined,
    responsiblePartyName: form.responsiblePartyName.trim() || undefined,
    liabilityStatus: form.liabilityStatus,
    liabilityDecisionStage: finalLiabilityRequired ? 'SEW_RETURN_INBOUND_FINAL' : 'GENERAL',
    liabilityDecisionRequired: finalLiabilityRequired,
    deductionDecision: isFail && finalLiabilityRequired ? form.deductionDecision || undefined : undefined,
    deductionAmount:
      isFail && finalLiabilityRequired && form.deductionDecision === 'DEDUCT' && form.deductionAmount !== ''
        ? Number(form.deductionAmount)
        : undefined,
    deductionCurrency:
      isFail && finalLiabilityRequired && form.deductionDecision === 'DEDUCT'
        ? 'CNY'
        : undefined,
    deductionDecisionRemark:
      isFail && finalLiabilityRequired ? form.deductionDecisionRemark.trim() || undefined : undefined,
    dispositionRemark: isFail ? form.dispositionRemark.trim() || undefined : undefined,
  }

  if (form.refType === 'RETURN_BATCH') {
    const inboundBatch = getReturnInboundBatchById(form.refId.trim())
    if (inboundBatch) {
      basePayload.productionOrderId = inboundBatch.productionOrderId
      basePayload.refTaskId = inboundBatch.sourceTaskId
      basePayload.sourceProcessType = inboundBatch.processType
      basePayload.sourceOrderId = inboundBatch.sourceType === 'DYE_PRINT_ORDER' ? inboundBatch.sourceId : undefined
      basePayload.sourceReturnId = inboundBatch.batchId
      basePayload.inspectionScene = 'RETURN_INBOUND'
      basePayload.returnBatchId = inboundBatch.batchId
      basePayload.returnProcessType = inboundBatch.processType
      basePayload.qcPolicy = inboundBatch.qcPolicy
      basePayload.returnFactoryId = inboundBatch.returnFactoryId
      basePayload.returnFactoryName = inboundBatch.returnFactoryName
      basePayload.warehouseId = inboundBatch.warehouseId
      basePayload.warehouseName = inboundBatch.warehouseName
      basePayload.sourceBusinessType = inboundBatch.sourceType
      basePayload.sourceBusinessId = inboundBatch.sourceId
      basePayload.sewPostProcessMode = inboundBatch.sewPostProcessMode
    }
  }

  if (existing?.inspectionScene === 'RETURN_INBOUND' && form.refType !== 'RETURN_BATCH') {
    basePayload.inspectionScene = existing.inspectionScene
    basePayload.returnBatchId = existing.returnBatchId
    basePayload.returnProcessType = existing.returnProcessType
    basePayload.qcPolicy = existing.qcPolicy
    basePayload.returnFactoryId = existing.returnFactoryId
    basePayload.returnFactoryName = existing.returnFactoryName
    basePayload.warehouseId = existing.warehouseId
    basePayload.warehouseName = existing.warehouseName
    basePayload.sourceBusinessType = existing.sourceBusinessType
    basePayload.sourceBusinessId = existing.sourceBusinessId
    basePayload.sewPostProcessMode = existing.sewPostProcessMode
    basePayload.sourceProcessType = existing.sourceProcessType
    basePayload.sourceOrderId = existing.sourceOrderId
    basePayload.sourceReturnId = existing.sourceReturnId
  }

  return basePayload
}

function validateForm(form: QcRecordFormState, forSubmit: boolean, existing?: QualityInspection | null): string | null {
  if (!form.refId.trim()) return '请填写引用 ID（回货批次号 / 任务 ID / 交接事件 ID）'
  if (form.refType === 'RETURN_BATCH' && !getReturnInboundBatchById(form.refId.trim())) {
    return '回货批次号不存在，请先选择有效批次。'
  }
  if (!form.inspector.trim()) return '请填写质检员姓名'
  if (!forSubmit) return null

  if (form.result === 'FAIL') {
    if (form.defectItems.length === 0) return '不合格时至少填写一条缺陷明细'

    for (const defect of form.defectItems) {
      if (!defect.defectName.trim()) return '缺陷名称不能为空'
      if (!defect.qty || defect.qty < 1) return '缺陷数量须大于等于 1'
    }

    if (!form.disposition) return '请选择处置方式'

    if (NEEDS_AFFECTED_QTY.includes(form.disposition)) {
      const qty = Number(form.affectedQty)
      if (!qty || qty < 1) return '请填写受影响数量（>= 1）'

      const inboundBatch = form.refType === 'RETURN_BATCH' ? getReturnInboundBatchById(form.refId.trim()) : null
      if (inboundBatch && qty > inboundBatch.returnedQty) {
        return `受影响数量（${qty}）不能超过回货数量（${inboundBatch.returnedQty}）`
      }

      const refTask = processTasks.find((task) => task.taskId === form.refId)
      if (!inboundBatch && refTask && qty > refTask.qty) {
        return `受影响数量（${qty}）不能超过任务总量（${refTask.qty}）`
      }
    }

    if (requiresFinalDecisionForForm(form, existing)) {
      if (!form.responsiblePartyType) return '车缝回货入仓质检提交前必须选择责任方类型'
      if (!form.responsiblePartyId.trim()) return '车缝回货入仓质检提交前必须填写责任方'
      if (!form.disposition) return '车缝回货入仓质检提交前必须填写处理方式'
      if (!form.deductionDecision) return '车缝回货入仓质检提交前必须明确是否扣款'
      if (form.deductionDecision === 'DEDUCT') {
        const amount = Number(form.deductionAmount)
        if (!Number.isFinite(amount) || amount <= 0) {
          return '选择扣款时，扣款金额必须大于 0'
        }
      } else if (!form.deductionDecisionRemark.trim()) {
        return '选择不扣款时，请填写不扣款说明'
      }
    }
  }

  return null
}

function saveDraft(detail: QcRecordDetailState): void {
  const existing = detail.currentQcId ? getQcById(detail.currentQcId) : null
  const error = validateForm(detail.form, false, existing)
  if (error) {
    showQcRecordsToast(error, 'error')
    return
  }
  const payload = buildPayload(detail.form, existing)

  if (!detail.currentQcId || !existing) {
    const created = createQc(payload)
    detail.currentQcId = created.qcId
    syncDetailFromQc(detail, created)
    appStore.navigate(`/fcs/quality/qc-records/${created.qcId}`)
    showQcRecordsToast(`草稿已保存：${created.qcId}`)
    return
  }

  const updated: QualityInspection = {
    ...existing,
    ...payload,
    updatedAt: nowTimestamp(),
  }
  replaceQc(updated)
  syncDetailFromQc(detail, updated)
  showQcRecordsToast('草稿已更新')
}

function submitDetail(detail: QcRecordDetailState): void {
  let targetId = detail.currentQcId
  let existing = targetId ? getQcById(targetId) : null
  const error = validateForm(detail.form, true, existing)
  if (error) {
    showQcRecordsToast(error, 'error')
    return
  }
  const payload = buildPayload(detail.form, existing)

  if (!targetId || !existing) {
    const created = createQc(payload)
    targetId = created.qcId
    detail.currentQcId = created.qcId
    syncDetailFromQc(detail, created)
    appStore.navigate(`/fcs/quality/qc-records/${created.qcId}`)
  } else {
    const updated: QualityInspection = {
      ...existing,
      ...payload,
      updatedAt: nowTimestamp(),
    }
    replaceQc(updated)
    syncDetailFromQc(detail, updated)
  }

  const submitResult = submitQcRecord(targetId, detail.form.inspector || '管理员')
  if (!submitResult.ok) {
    showQcRecordsToast(submitResult.message ?? '提交失败', 'error')
    return
  }

  const latest = getQcById(targetId)
  if (latest) {
    syncDetailFromQc(detail, latest)
  }

  showQcRecordsToast('质检已提交')
}

function getQcViewRows() {
  return initialQualityInspections.map((qc) => normalizeQcForView(qc, initialReturnInboundBatches, processTasks))
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

function getFilteredQcRows() {
  const keyword = listState.keyword.trim().toLowerCase()

  return getQcViewRows()
    .filter((row) => {
      if (!listState.showLegacy && row.isLegacy) {
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
        listState.filterDisposition !== 'ALL' &&
        (row.disposition as QcDisposition | undefined) !== listState.filterDisposition
      ) {
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

function renderResultBadge(result: QcResult): string {
  return `<span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${RESULT_CLASS[result]}">${RESULT_LABEL[result]}</span>`
}

function renderDispositionBadge(disposition?: QcDisposition): string {
  if (!disposition) {
    return '<span class="text-muted-foreground">-</span>'
  }
  return `<span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${DISPOSITION_CLASS[disposition]}">${DISPOSITION_LABEL[disposition]}</span>`
}

function renderPolicyBadge(policy: ReturnInboundQcPolicy): string {
  return `<span class="inline-flex rounded-md border px-2 py-0.5 text-xs">${RETURN_INBOUND_QC_POLICY_LABEL[policy]}</span>`
}

export function renderQcRecordsPage(): string {
  const filtered = getFilteredQcRows()
  const factoryOptions = getFactoryOptions()
  const warehouseOptions = getWarehouseOptions()

  return `
    <div class="flex flex-col gap-6 p-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight">质检记录</h1>
          <p class="mt-1 text-sm text-muted-foreground">默认展示回货入仓质检，共 ${filtered.length} 条</p>
        </div>
      </div>

      <section class="rounded-md border bg-card p-4">
        <div class="flex flex-wrap items-end gap-3">
          <div class="min-w-[220px] flex-1">
            <label class="mb-1 block text-xs text-muted-foreground">关键词</label>
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              data-qcr-filter="keyword"
              value="${toInputValue(listState.keyword)}"
              placeholder="质检单号 / 回货批次号 / 生产单号 / 来源任务ID"
            />
          </div>

          <div class="w-36">
            <label class="mb-1 block text-xs text-muted-foreground">回货环节</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-qcr-filter="processType">
              <option value="ALL" ${listState.filterProcessType === 'ALL' ? 'selected' : ''}>全部</option>
              ${Object.entries(RETURN_INBOUND_PROCESS_LABEL)
                .map(
                  ([key, label]) =>
                    `<option value="${key}" ${listState.filterProcessType === key ? 'selected' : ''}>${label}</option>`,
                )
                .join('')}
            </select>
          </div>

          <div class="w-32">
            <label class="mb-1 block text-xs text-muted-foreground">质检策略</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-qcr-filter="policy">
              <option value="ALL" ${listState.filterPolicy === 'ALL' ? 'selected' : ''}>全部</option>
              ${Object.entries(RETURN_INBOUND_QC_POLICY_LABEL)
                .map(
                  ([key, label]) =>
                    `<option value="${key}" ${listState.filterPolicy === key ? 'selected' : ''}>${label}</option>`,
                )
                .join('')}
            </select>
          </div>

          <div class="w-32">
            <label class="mb-1 block text-xs text-muted-foreground">结果</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-qcr-filter="result">
              <option value="ALL" ${listState.filterResult === 'ALL' ? 'selected' : ''}>全部</option>
              <option value="PASS" ${listState.filterResult === 'PASS' ? 'selected' : ''}>合格</option>
              <option value="FAIL" ${listState.filterResult === 'FAIL' ? 'selected' : ''}>不合格</option>
            </select>
          </div>

          <div class="w-36">
            <label class="mb-1 block text-xs text-muted-foreground">状态</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-qcr-filter="status">
              <option value="ALL" ${listState.filterStatus === 'ALL' ? 'selected' : ''}>全部</option>
              <option value="DRAFT" ${listState.filterStatus === 'DRAFT' ? 'selected' : ''}>草稿</option>
              <option value="SUBMITTED" ${listState.filterStatus === 'SUBMITTED' ? 'selected' : ''}>已提交</option>
              <option value="CLOSED" ${listState.filterStatus === 'CLOSED' ? 'selected' : ''}>已结案</option>
            </select>
          </div>

          <div class="w-40">
            <label class="mb-1 block text-xs text-muted-foreground">处置方式</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-qcr-filter="disposition">
              <option value="ALL" ${listState.filterDisposition === 'ALL' ? 'selected' : ''}>全部</option>
              <option value="ACCEPT_AS_DEFECT" ${listState.filterDisposition === 'ACCEPT_AS_DEFECT' ? 'selected' : ''}>接受瑕疵品</option>
              <option value="SCRAP" ${listState.filterDisposition === 'SCRAP' ? 'selected' : ''}>报废</option>
              <option value="ACCEPT" ${listState.filterDisposition === 'ACCEPT' ? 'selected' : ''}>接受无扣款</option>
            </select>
          </div>

          ${
            factoryOptions.length > 0
              ? `
                <div class="w-40">
                  <label class="mb-1 block text-xs text-muted-foreground">回货工厂</label>
                  <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-qcr-filter="factory">
                    <option value="ALL" ${listState.filterFactory === 'ALL' ? 'selected' : ''}>全部</option>
                    ${factoryOptions
                      .map(
                        (item) => `<option value="${escapeHtml(item)}" ${listState.filterFactory === item ? 'selected' : ''}>${escapeHtml(item)}</option>`,
                      )
                      .join('')}
                  </select>
                </div>
              `
              : ''
          }

          ${
            warehouseOptions.length > 0
              ? `
                <div class="w-40">
                  <label class="mb-1 block text-xs text-muted-foreground">入仓仓库</label>
                  <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-qcr-filter="warehouse">
                    <option value="ALL" ${listState.filterWarehouse === 'ALL' ? 'selected' : ''}>全部</option>
                    ${warehouseOptions
                      .map(
                        (item) => `<option value="${escapeHtml(item)}" ${listState.filterWarehouse === item ? 'selected' : ''}>${escapeHtml(item)}</option>`,
                      )
                      .join('')}
                  </select>
                </div>
              `
              : ''
          }

          <label class="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
            <input type="checkbox" data-qcr-filter="showLegacy" ${listState.showLegacy ? 'checked' : ''} />
            显示旧质检记录
          </label>

          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-qcr-action="reset-filters">
            <i data-lucide="rotate-ccw" class="mr-1 h-4 w-4"></i>
            重置
          </button>
        </div>
      </section>

      ${
        filtered.length === 0
          ? `
            <section class="rounded-md border bg-card">
              <div class="py-16 text-center text-sm text-muted-foreground">当前筛选下暂无回货入仓质检记录</div>
            </section>
          `
          : `
            <section class="overflow-x-auto rounded-md border bg-card">
              <table class="w-full min-w-[1560px] text-sm">
                <thead>
                  <tr class="border-b bg-muted/40 text-left">
                    <th class="px-4 py-2 font-medium">质检单号</th>
                    <th class="px-4 py-2 font-medium">回货批次号</th>
                    <th class="px-4 py-2 font-medium">生产单号</th>
                    <th class="px-4 py-2 font-medium">回货环节</th>
                    <th class="px-4 py-2 font-medium">回货工厂</th>
                    <th class="px-4 py-2 font-medium">入仓仓库</th>
                    <th class="px-4 py-2 font-medium">质检策略</th>
                    <th class="px-4 py-2 font-medium">结果</th>
                    <th class="px-4 py-2 font-medium">质检状态</th>
                    <th class="px-4 py-2 font-medium">处置方式</th>
                    <th class="px-4 py-2 text-right font-medium">受影响数量</th>
                    <th class="px-4 py-2 font-medium">来源任务</th>
                    <th class="px-4 py-2 font-medium">质检时间</th>
                    <th class="px-4 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${filtered
                    .map((row) => {
                      return `
                        <tr class="cursor-pointer border-b last:border-b-0 hover:bg-muted/50" data-nav="/fcs/quality/qc-records/${escapeHtml(row.qcId)}">
                          <td class="px-4 py-3">
                            <div class="font-mono text-xs font-semibold text-primary">${escapeHtml(row.qcId)}</div>
                            ${row.isLegacy ? '<div class="mt-1 inline-flex rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">旧质检记录</div>' : ''}
                          </td>
                          <td class="px-4 py-3 font-mono text-xs">${escapeHtml(row.batchId || '-')}</td>
                          <td class="px-4 py-3 font-mono text-xs">${escapeHtml(row.productionOrderId || '-')}</td>
                          <td class="px-4 py-3">${escapeHtml(row.processLabel)}</td>
                          <td class="px-4 py-3">${escapeHtml(row.returnFactoryName || '-')}</td>
                          <td class="px-4 py-3">${escapeHtml(row.warehouseName || '-')}</td>
                          <td class="px-4 py-3">${renderPolicyBadge(row.qcPolicy)}</td>
                          <td class="px-4 py-3">${renderResultBadge(row.result)}</td>
                          <td class="px-4 py-3"><span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${STATUS_CLASS[row.status]}">${STATUS_LABEL[row.status]}</span></td>
                          <td class="px-4 py-3">${renderDispositionBadge(row.disposition as QcDisposition | undefined)}</td>
                          <td class="px-4 py-3 text-right">${row.affectedQty ?? '-'}</td>
                          <td class="px-4 py-3 font-mono text-xs">${escapeHtml(row.sourceTaskId || '-')}</td>
                          <td class="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">${escapeHtml(formatDateTime(row.inspectedAt || row.qc.updatedAt))}</td>
                          <td class="px-4 py-3">
                            <button class="inline-flex h-8 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/quality/qc-records/${escapeHtml(row.qcId)}">
                              查看
                              <i data-lucide="chevron-right" class="ml-1 h-3.5 w-3.5"></i>
                            </button>
                          </td>
                        </tr>
                      `
                    })
                    .join('')}
                </tbody>
              </table>
            </section>
          `
      }
    </div>
  `
}

function renderDispositionOptions(selected: QcDisposition | ''): string {
  return `
    <option value="" ${selected === '' ? 'selected' : ''}>请选择</option>
    ${Object.keys(DISPOSITION_LABEL)
      .map((key) => {
        const disposition = key as QcDisposition
        return `<option value="${disposition}" ${selected === disposition ? 'selected' : ''}>${DISPOSITION_LABEL[disposition]}</option>`
      })
      .join('')}
  `
}

function renderRootCauseOptions(selected: RootCauseType): string {
  return Object.keys(ROOT_CAUSE_LABEL)
    .map((key) => {
      const cause = key as RootCauseType
      return `<option value="${cause}" ${selected === cause ? 'selected' : ''}>${ROOT_CAUSE_LABEL[cause]}</option>`
    })
    .join('')
}

function renderLiabilityStatusOptions(selected: LiabilityStatus): string {
  return Object.keys(LIABILITY_LABEL)
    .map((key) => {
      const status = key as LiabilityStatus
      return `<option value="${status}" ${selected === status ? 'selected' : ''}>${LIABILITY_LABEL[status]}</option>`
    })
    .join('')
}

function renderPartyTypeOptions(selected: SettlementPartyType | ''): string {
  return `
    <option value="" ${selected === '' ? 'selected' : ''}>留空由系统推导</option>
    ${Object.keys(PARTY_TYPE_LABEL)
      .map((key) => {
        const type = key as SettlementPartyType
        return `<option value="${type}" ${selected === type ? 'selected' : ''}>${PARTY_TYPE_LABEL[type]}</option>`
      })
      .join('')}
  `
}

function renderBreakdownCard(detail: QcRecordDetailState, existingQc: QualityInspection): string {
  const target = existingQc.affectedQty
  const sum =
    (Number(detail.bdAcceptDefect) || 0) +
    (Number(detail.bdScrap) || 0) +
    (Number(detail.bdNoDeduct) || 0)
  const delta = target !== undefined ? target - sum : 0
  const valid = target === undefined || delta === 0

  return `
    <section class="rounded-md border bg-card">
      <header class="border-b px-4 py-3">
        <h2 class="text-sm font-semibold">处置数量拆分</h2>
      </header>
      <div class="space-y-4 px-4 py-4">
        ${
          target !== undefined
            ? `<p class="text-sm text-muted-foreground">不合格数量（目标）：<span class="font-semibold text-foreground">${target}</span></p>`
            : ''
        }

        ${
          target !== undefined
            ? `
              <div class="flex flex-wrap gap-2">
                <span class="self-center text-xs text-muted-foreground">快速填充：</span>
                <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-qcd-action="quick-fill" data-qcd-fill="defect">全部瑕疵接收</button>
                <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-qcd-action="quick-fill" data-qcd-fill="scrap">全部报废</button>
                <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-qcd-action="quick-fill" data-qcd-fill="nodeduct">全部无扣款接受</button>
              </div>
            `
            : ''
        }

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div class="space-y-1">
            <label class="text-xs text-muted-foreground">接受（瑕疵品）</label>
            <input class="h-8 w-full rounded-md border bg-background px-2 text-sm" type="number" min="0" step="1" data-qcd-breakdown="defect" value="${toInputValue(detail.bdAcceptDefect)}" />
          </div>
          <div class="space-y-1">
            <label class="text-xs text-muted-foreground">报废数量</label>
            <input class="h-8 w-full rounded-md border bg-background px-2 text-sm" type="number" min="0" step="1" data-qcd-breakdown="scrap" value="${toInputValue(detail.bdScrap)}" />
          </div>
          <div class="space-y-1">
            <label class="text-xs text-muted-foreground">接受（无扣款）</label>
            <input class="h-8 w-full rounded-md border bg-background px-2 text-sm" type="number" min="0" step="1" data-qcd-breakdown="nodeduct" value="${toInputValue(detail.bdNoDeduct)}" />
          </div>
        </div>

        <div class="${toClassName(
          'flex flex-wrap gap-4 rounded-md border px-3 py-2 text-sm',
          valid ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50',
        )}">
          <span>合计：<span class="font-semibold">${sum}</span></span>
          ${
            target !== undefined
              ? `
                <span>目标：<span class="font-semibold">${target}</span></span>
                <span>差值：<span class="${delta !== 0 ? 'font-semibold text-red-600' : 'font-semibold'}">${delta}</span></span>
                ${
                  !valid
                    ? '<span class="w-full text-xs font-medium text-red-600">合计必须等于不合格数量</span>'
                    : ''
                }
              `
              : ''
          }
        </div>

        <button
          class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          data-qcd-action="save-breakdown"
          ${target !== undefined && !valid ? 'disabled' : ''}
        >
          保存拆分
        </button>
      </div>
    </section>
  `
}

function renderDetailNotFound(qcId: string): string {
  return `
    <div class="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8">
      <button class="inline-flex h-8 w-fit items-center rounded-md border px-3 text-sm hover:bg-muted" data-qcd-action="back-list">
        <i data-lucide="chevron-left" class="mr-1 h-4 w-4"></i>返回质检记录
      </button>
      <section class="rounded-md border bg-card p-6">
        <h1 class="text-lg font-semibold">质检记录不存在</h1>
        <p class="mt-2 text-sm text-muted-foreground">未找到质检单：<span class="font-mono">${escapeHtml(qcId)}</span></p>
      </section>
    </div>
  `
}

export function renderQcRecordDetailPage(qcId: string): string {
  const detail = ensureDetailState(qcId)
  const existingQc = detail.currentQcId ? getQcById(detail.currentQcId) : null

  if (qcId !== 'new' && !existingQc) {
    return renderDetailNotFound(qcId)
  }

  const readOnly = existingQc?.status === 'SUBMITTED' || existingQc?.status === 'CLOSED'
  const isFail = detail.form.result === 'FAIL'
  const needsQty =
    detail.form.disposition !== '' && NEEDS_AFFECTED_QTY.includes(detail.form.disposition)
  const refTask = processTasks.find((item) => item.taskId === detail.form.refId)
  const selectedBatch = detail.form.refType === 'RETURN_BATCH' ? getReturnInboundBatchById(detail.form.refId) : null
  const inboundView = existingQc ? normalizeQcForView(existingQc, initialReturnInboundBatches, processTasks) : null
  const finalLiabilityRequired = requiresFinalDecisionForForm(detail.form, existingQc)
  const sourceTaskForView =
    (inboundView?.sourceTaskId ? processTasks.find((item) => item.taskId === inboundView.sourceTaskId) : null) ??
    refTask
  const maxQty = selectedBatch?.returnedQty ?? refTask?.qty
  const basisItems = detail.currentQcId
    ? initialDeductionBasisItems.filter(
        (item) => item.sourceRefId === detail.currentQcId || item.sourceId === detail.currentQcId,
      )
    : []
  const sourceTypeLabel =
    inboundView?.isReturnInbound || detail.form.refType === 'RETURN_BATCH'
      ? '来源类型：回货入仓批次'
      : detail.form.refType === 'TASK'
        ? '来源类型：生产任务'
        : '来源类型：交接事件'

  return `
    <div class="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
      <div class="flex items-start gap-3">
        <button class="mt-0.5 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" data-qcd-action="back-list">
          <i data-lucide="chevron-left" class="h-5 w-5"></i>
        </button>
        <div class="min-w-0 flex-1">
          <h1 class="text-xl font-semibold leading-tight">
            ${detail.currentQcId ? `质检记录 ${escapeHtml(detail.currentQcId)}` : '新建质检记录'}
          </h1>
          <p class="mt-0.5 text-sm text-muted-foreground">
            ${sourceTypeLabel}
            ${detail.form.refId ? ` · ${escapeHtml(detail.form.refId)}` : ''}
          </p>
        </div>
        ${
          existingQc
            ? `<span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${STATUS_CLASS[existingQc.status as QcStatus]}">${STATUS_LABEL[existingQc.status as QcStatus]}</span>`
            : ''
        }
      </div>

      <section class="rounded-md border bg-card">
        <header class="border-b px-4 py-3">
          <h2 class="text-sm font-semibold">基本信息</h2>
        </header>
        <div class="space-y-4 px-4 py-4">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div class="space-y-1.5">
              <label class="text-sm">引用类型</label>
              <select class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70" data-qcd-field="refType" ${readOnly ? 'disabled' : ''}>
                <option value="RETURN_BATCH" ${detail.form.refType === 'RETURN_BATCH' ? 'selected' : ''}>回货入仓批次</option>
                <option value="TASK" ${detail.form.refType === 'TASK' ? 'selected' : ''}>生产任务</option>
                <option value="HANDOVER" ${detail.form.refType === 'HANDOVER' ? 'selected' : ''}>交接事件</option>
              </select>
            </div>
            <div class="space-y-1.5">
              <label class="text-sm">${
                detail.form.refType === 'RETURN_BATCH'
                  ? '回货批次号'
                  : detail.form.refType === 'TASK'
                    ? '任务 ID'
                    : '交接事件 ID'
              }</label>
              ${
                detail.form.refType === 'RETURN_BATCH'
                  ? `
                    <select class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70" data-qcd-field="refId" ${readOnly ? 'disabled' : ''}>
                      <option value="">请选择回货批次</option>
                      ${initialReturnInboundBatches
                        .map(
                          (batch) =>
                            `<option value="${escapeHtml(batch.batchId)}" ${detail.form.refId === batch.batchId ? 'selected' : ''}>${escapeHtml(batch.batchId)} · ${escapeHtml(batch.processLabel ?? RETURN_INBOUND_PROCESS_LABEL[batch.processType])} · ${escapeHtml(batch.productionOrderId)}</option>`,
                        )
                        .join('')}
                    </select>
                  `
                  : `
                    <input class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70" data-qcd-field="refId" value="${toInputValue(detail.form.refId)}" placeholder="${detail.form.refType === 'TASK' ? 'TASK-xxxx-xxx' : 'HO-xxxx'}" ${readOnly ? 'disabled' : ''} />
                  `
              }
            </div>
          </div>

          <div class="space-y-1.5">
            <label class="text-sm">生产工单号</label>
            <input class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70" data-qcd-field="productionOrderId" value="${toInputValue(detail.form.productionOrderId)}" placeholder="PO-xxxx（关联任务时自动带入）" ${readOnly ? 'disabled' : ''} />
          </div>

          ${
            detail.form.refType === 'RETURN_BATCH' && selectedBatch
              ? `
                <div class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  已带出：回货环节 ${escapeHtml(selectedBatch.processLabel ?? RETURN_INBOUND_PROCESS_LABEL[selectedBatch.processType])}
                  · 质检策略 ${escapeHtml(RETURN_INBOUND_QC_POLICY_LABEL[selectedBatch.qcPolicy])}
                  · 回货工厂 ${escapeHtml(selectedBatch.returnFactoryName ?? '-')}
                  · 入仓仓库 ${escapeHtml(selectedBatch.warehouseName ?? '-')}
                </div>
              `
              : ''
          }

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div class="space-y-1.5">
              <label class="text-sm">质检员</label>
              <input class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70" data-qcd-field="inspector" value="${toInputValue(detail.form.inspector)}" ${readOnly ? 'disabled' : ''} />
            </div>
            <div class="space-y-1.5">
              <label class="text-sm">质检时间</label>
              <input class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70" data-qcd-field="inspectedAt" value="${toInputValue(detail.form.inspectedAt)}" placeholder="YYYY-MM-DD HH:mm:ss" ${readOnly ? 'disabled' : ''} />
            </div>
          </div>
        </div>
      </section>

      <section class="rounded-md border bg-card">
        <header class="border-b px-4 py-3">
          <h2 class="text-sm font-semibold">来源信息</h2>
        </header>
        <div class="grid grid-cols-1 gap-4 px-4 py-4 text-sm md:grid-cols-2">
          <div>
            <p class="text-xs text-muted-foreground">回货批次号</p>
            <p class="font-mono">${escapeHtml(inboundView?.batchId || selectedBatch?.batchId || '-')}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">生产单号</p>
            <p class="font-mono">${escapeHtml(inboundView?.productionOrderId || detail.form.productionOrderId || '-')}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">回货环节</p>
            <p>${escapeHtml(inboundView?.processLabel || (selectedBatch ? selectedBatch.processLabel ?? RETURN_INBOUND_PROCESS_LABEL[selectedBatch.processType] : '-'))}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">来源任务ID</p>
            <p class="font-mono">${escapeHtml(inboundView?.sourceTaskId || selectedBatch?.sourceTaskId || detail.form.refId || '-')}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">回货工厂</p>
            <p>${escapeHtml(inboundView?.returnFactoryName || selectedBatch?.returnFactoryName || sourceTaskForView?.assignedFactoryName || '-')}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">入仓仓库</p>
            <p>${escapeHtml(inboundView?.warehouseName || selectedBatch?.warehouseName || '-')}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">入仓时间</p>
            <p>${escapeHtml(formatDateTime(inboundView?.inboundAt || selectedBatch?.inboundAt || '-'))}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">质检策略</p>
            <p>${
              inboundView
                ? RETURN_INBOUND_QC_POLICY_LABEL[inboundView.qcPolicy]
                : selectedBatch
                  ? RETURN_INBOUND_QC_POLICY_LABEL[selectedBatch.qcPolicy]
                  : '-'
            }</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">车缝后道模式</p>
            <p>${
              inboundView?.sewPostProcessMode
                ? SEW_POST_PROCESS_MODE_LABEL[inboundView.sewPostProcessMode]
                : selectedBatch?.sewPostProcessMode
                  ? SEW_POST_PROCESS_MODE_LABEL[selectedBatch.sewPostProcessMode]
                  : '-'
            }</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">来源业务</p>
            <p>${escapeHtml(inboundView?.sourceBusinessType || selectedBatch?.sourceType || '-')} / ${escapeHtml(inboundView?.sourceBusinessId || selectedBatch?.sourceId || '-')}</p>
          </div>
        </div>
      </section>

      <section class="rounded-md border bg-card">
        <header class="border-b px-4 py-3">
          <h2 class="text-sm font-semibold">质检结果</h2>
        </header>
        <div class="space-y-4 px-4 py-4">
          <div class="space-y-1.5">
            <label class="text-sm">结果</label>
            <div class="flex gap-3">
              ${(['PASS', 'FAIL'] as QcResult[])
                .map(
                  (result) => `
                    <button
                      class="${toClassName(
                        'rounded-md border px-5 py-2 text-sm font-medium transition-colors',
                        detail.form.result === result
                          ? result === 'PASS'
                            ? 'border-green-600 bg-green-600 text-white'
                            : 'border-red-600 bg-red-600 text-white'
                          : 'bg-background text-muted-foreground hover:border-foreground',
                        readOnly && 'cursor-not-allowed opacity-70',
                      )}"
                      data-qcd-action="set-result"
                      data-qcd-result="${result}"
                      ${readOnly ? 'disabled' : ''}
                    >
                      ${RESULT_LABEL[result]}
                    </button>
                  `,
                )
                .join('')}
            </div>
          </div>

          ${
            isFail
              ? `
                <div class="space-y-4 rounded-md border border-red-200 bg-red-50/40 p-4">
                  <div class="space-y-2">
                    <div class="flex items-center justify-between">
                      <label class="text-sm">缺陷明细 <span class="text-red-600">*</span></label>
                      ${
                        !readOnly
                          ? `
                            <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-qcd-action="add-defect">
                              <i data-lucide="plus" class="mr-1 h-3 w-3"></i>添加缺陷
                            </button>
                          `
                          : ''
                      }
                    </div>
                    ${
                      detail.form.defectItems.length === 0
                        ? '<p class="text-xs text-muted-foreground">暂无缺陷条目，请点击“添加缺陷”</p>'
                        : ''
                    }
                    <div class="space-y-2">
                      ${detail.form.defectItems
                        .map(
                          (defect, index) => `
                            <div class="flex items-center gap-2">
                              <input
                                class="h-8 flex-1 rounded-md border bg-background px-2 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                                data-qcd-defect-index="${index}"
                                data-qcd-defect-field="name"
                                value="${toInputValue(defect.defectName)}"
                                placeholder="缺陷名称"
                                ${readOnly ? 'disabled' : ''}
                              />
                              <input
                                class="h-8 w-24 rounded-md border bg-background px-2 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                                type="number"
                                min="1"
                                data-qcd-defect-index="${index}"
                                data-qcd-defect-field="qty"
                                value="${toInputValue(defect.qty || '')}"
                                placeholder="数量"
                                ${readOnly ? 'disabled' : ''}
                              />
                              ${
                                !readOnly
                                  ? `<button class="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-600 hover:bg-red-100" data-qcd-action="remove-defect" data-qcd-index="${index}">
                                      <i data-lucide="trash-2" class="h-3.5 w-3.5"></i>
                                    </button>`
                                  : ''
                              }
                            </div>
                          `,
                        )
                        .join('')}
                    </div>
                  </div>

                  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div class="space-y-1.5">
                      <label class="text-sm">处置方式 <span class="text-red-600">*</span></label>
                      <select class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70" data-qcd-field="disposition" ${readOnly ? 'disabled' : ''}>
                        ${renderDispositionOptions(detail.form.disposition)}
                      </select>
                    </div>

                    ${
                      needsQty
                        ? `
                          <div class="space-y-1.5">
                            <label class="text-sm">
                              受影响数量 <span class="text-red-600">*</span>
                              ${
                                maxQty !== undefined
                                  ? `<span class="ml-1 text-xs font-normal text-muted-foreground">（任务量 ${maxQty}）</span>`
                                  : ''
                              }
                            </label>
                            <input class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70" type="number" min="1" ${maxQty !== undefined ? `max="${maxQty}"` : ''} data-qcd-field="affectedQty" value="${toInputValue(detail.form.affectedQty)}" ${readOnly ? 'disabled' : ''} />
                          </div>
                        `
                        : ''
                    }
                  </div>

                  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div class="space-y-1.5">
                      <label class="text-sm">根因类型</label>
                      <select class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70" data-qcd-field="rootCauseType" ${readOnly ? 'disabled' : ''}>
                        ${renderRootCauseOptions(detail.form.rootCauseType)}
                      </select>
                    </div>
                    <div class="space-y-1.5">
                      <label class="text-sm">责任状态</label>
                      <select class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70" data-qcd-field="liabilityStatus" ${readOnly ? 'disabled' : ''}>
                        ${renderLiabilityStatusOptions(detail.form.liabilityStatus)}
                      </select>
                    </div>
                  </div>

                  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div class="space-y-1.5">
                      <label class="text-sm">责任方类型</label>
                      <select class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70" data-qcd-field="responsiblePartyType" ${readOnly ? 'disabled' : ''}>
                        ${renderPartyTypeOptions(detail.form.responsiblePartyType)}
                      </select>
                    </div>
                    <div class="space-y-1.5">
                      <label class="text-sm">责任方 ID</label>
                      <input class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70" data-qcd-field="responsiblePartyId" value="${toInputValue(detail.form.responsiblePartyId)}" placeholder="留空由系统推导" ${readOnly ? 'disabled' : ''} />
                    </div>
                  </div>

                  <div class="space-y-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-3">
                    <div class="flex items-center justify-between">
                      <p class="text-sm font-medium text-blue-900">责任判定与扣款决定</p>
                      ${
                        finalLiabilityRequired
                          ? '<span class="inline-flex rounded-md border border-blue-300 bg-white px-2 py-0.5 text-xs text-blue-700">车缝回货入仓最终判定（提交必填）</span>'
                          : '<span class="inline-flex rounded-md border border-blue-200 bg-white px-2 py-0.5 text-xs text-blue-600">当前环节可选填写</span>'
                      }
                    </div>

                    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div class="space-y-1.5">
                        <label class="text-sm">责任方名称（可选）</label>
                        <input
                          class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                          data-qcd-field="responsiblePartyName"
                          value="${toInputValue(detail.form.responsiblePartyName)}"
                          placeholder="如：PT Prima Sewing Hub"
                          ${readOnly ? 'disabled' : ''}
                        />
                      </div>
                      <div class="space-y-1.5">
                        <label class="text-sm">是否扣款${finalLiabilityRequired ? ' <span class="text-red-600">*</span>' : ''}</label>
                        <select
                          class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                          data-qcd-field="deductionDecision"
                          ${readOnly ? 'disabled' : ''}
                        >
                          <option value="" ${detail.form.deductionDecision === '' ? 'selected' : ''}>请选择</option>
                          <option value="DEDUCT" ${detail.form.deductionDecision === 'DEDUCT' ? 'selected' : ''}>${DEDUCTION_DECISION_LABEL.DEDUCT}</option>
                          <option value="NO_DEDUCT" ${detail.form.deductionDecision === 'NO_DEDUCT' ? 'selected' : ''}>${DEDUCTION_DECISION_LABEL.NO_DEDUCT}</option>
                        </select>
                      </div>
                    </div>

                    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div class="space-y-1.5">
                        <label class="text-sm">扣款金额（元）${detail.form.deductionDecision === 'DEDUCT' && finalLiabilityRequired ? ' <span class="text-red-600">*</span>' : ''}</label>
                        <input
                          class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                          type="number"
                          min="0"
                          step="0.01"
                          data-qcd-field="deductionAmount"
                          value="${toInputValue(detail.form.deductionAmount)}"
                          placeholder="${detail.form.deductionDecision === 'DEDUCT' ? '请输入扣款金额' : '选择扣款后填写'}"
                          ${readOnly ? 'disabled' : ''}
                        />
                      </div>
                      <div class="space-y-1.5">
                        <label class="text-sm">处置补充说明</label>
                        <input
                          class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                          data-qcd-field="dispositionRemark"
                          value="${toInputValue(detail.form.dispositionRemark)}"
                          placeholder="可补充说明处理方式"
                          ${readOnly ? 'disabled' : ''}
                        />
                      </div>
                    </div>

                    <div class="space-y-1.5">
                      <label class="text-sm">扣款决定说明${detail.form.deductionDecision === 'NO_DEDUCT' && finalLiabilityRequired ? ' <span class="text-red-600">*</span>' : ''}</label>
                      <textarea
                        class="min-h-16 w-full rounded-md border bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                        data-qcd-field="deductionDecisionRemark"
                        placeholder="${detail.form.deductionDecision === 'NO_DEDUCT' ? '请选择不扣款时必须填写说明' : '可填写扣款决定说明'}"
                        ${readOnly ? 'disabled' : ''}
                      >${escapeHtml(detail.form.deductionDecisionRemark)}</textarea>
                    </div>
                  </div>
                </div>
              `
              : ''
          }
        </div>
      </section>

      ${
        existingQc && existingQc.result === 'FAIL' && existingQc.status === 'SUBMITTED'
          ? renderBreakdownCard(detail, existingQc)
          : ''
      }

      <section class="rounded-md border bg-card">
        <header class="border-b px-4 py-3">
          <h2 class="text-sm font-semibold">备注</h2>
        </header>
        <div class="px-4 py-4">
          <textarea
            class="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-70"
            data-qcd-field="remark"
            placeholder="可选备注..."
            ${readOnly ? 'disabled' : ''}
          >${escapeHtml(detail.form.remark)}</textarea>
        </div>
      </section>

      ${
        !readOnly
          ? `
            <div class="flex gap-3">
              <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-qcd-action="save-draft">保存草稿</button>
              <button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-qcd-action="submit">提交质检</button>
            </div>
          `
          : `
            <div class="rounded-md bg-muted px-4 py-2.5 text-sm text-muted-foreground">${existingQc?.status === 'CLOSED' ? '已结案，表单只读。' : '已提交，表单只读。'}</div>
          `
      }

      ${
        existingQc && (existingQc.status === 'SUBMITTED' || existingQc.status === 'CLOSED')
          ? `
            <section class="space-y-4 pt-2">
              <div class="border-t pt-4">
                <h2 class="text-sm font-semibold">提交串联产物</h2>
              </div>

              ${
                existingQc.result === 'FAIL'
                  ? `
                    <article class="rounded-md border bg-card">
                      <header class="border-b px-4 py-3">
                        <h3 class="text-sm font-medium">责任判定与扣款决定（结构化）</h3>
                      </header>
                      <div class="grid grid-cols-1 gap-3 px-4 py-4 text-sm md:grid-cols-2">
                        <div>
                          <p class="text-xs text-muted-foreground">判定阶段</p>
                          <p>${existingQc.liabilityDecisionStage === 'SEW_RETURN_INBOUND_FINAL' ? '车缝回货入仓最终判定' : '一般判定'}</p>
                        </div>
                        <div>
                          <p class="text-xs text-muted-foreground">是否强制判定</p>
                          <p>${existingQc.liabilityDecisionRequired ? '是' : '否'}</p>
                        </div>
                        <div>
                          <p class="text-xs text-muted-foreground">责任方</p>
                          <p>${
                            existingQc.responsiblePartyType
                              ? `${PARTY_TYPE_LABEL[existingQc.responsiblePartyType]} / ${escapeHtml(existingQc.responsiblePartyId ?? '-')}`
                              : '-'
                          }</p>
                        </div>
                        <div>
                          <p class="text-xs text-muted-foreground">责任方名称</p>
                          <p>${escapeHtml(existingQc.responsiblePartyName ?? '-')}</p>
                        </div>
                        <div>
                          <p class="text-xs text-muted-foreground">处理方式</p>
                          <p>${existingQc.disposition ? escapeHtml(DISPOSITION_LABEL[existingQc.disposition] ?? existingQc.disposition) : '-'}</p>
                        </div>
                        <div>
                          <p class="text-xs text-muted-foreground">扣款决定</p>
                          <p>${
                            existingQc.deductionDecision
                              ? escapeHtml(DEDUCTION_DECISION_LABEL[existingQc.deductionDecision] ?? existingQc.deductionDecision)
                              : '-'
                          }</p>
                        </div>
                        <div>
                          <p class="text-xs text-muted-foreground">扣款金额</p>
                          <p>${
                            existingQc.deductionDecision === 'DEDUCT'
                              ? `${existingQc.deductionAmount ?? '-'} ${existingQc.deductionCurrency ?? 'CNY'}`
                              : '-'
                          }</p>
                        </div>
                        <div>
                          <p class="text-xs text-muted-foreground">判定时间</p>
                          <p>${existingQc.liabilityDecidedAt ? escapeHtml(formatDateTime(existingQc.liabilityDecidedAt)) : '-'}</p>
                        </div>
                        <div class="md:col-span-2">
                          <p class="text-xs text-muted-foreground">判定说明</p>
                          <p>${escapeHtml(existingQc.deductionDecisionRemark ?? existingQc.dispositionRemark ?? '-')}</p>
                        </div>
                      </div>
                    </article>
                  `
                  : ''
              }

              <article class="rounded-md border bg-card">
                <header class="border-b px-4 py-3">
                  <h3 class="text-sm font-medium">写回与下游结果</h3>
                </header>
                <div class="grid grid-cols-1 gap-3 px-4 py-4 text-sm md:grid-cols-2">
                  <div>
                    <p class="text-xs text-muted-foreground">可用量写回</p>
                    <p>${existingQc.writebackAvailableQty ?? '-'}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">瑕疵接收量写回</p>
                    <p>${existingQc.writebackAcceptedAsDefectQty ?? '-'}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">报废量写回</p>
                    <p>${existingQc.writebackScrapQty ?? '-'}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">写回完成时间</p>
                    <p>${existingQc.writebackCompletedAt ? escapeHtml(formatDateTime(existingQc.writebackCompletedAt)) : '-'}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">写回执行人</p>
                    <p>${escapeHtml(existingQc.writebackCompletedBy ?? '-')}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">下游是否解锁</p>
                    <p>${existingQc.downstreamUnblocked === undefined ? '-' : existingQc.downstreamUnblocked ? '已解锁' : '未解锁'}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">关联扣款依据</p>
                    <p>${basisItems.length > 0 ? `${basisItems.length} 条` : '-'}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">结算冻结原因</p>
                    <p>${escapeHtml(existingQc.settlementFreezeReason ?? '-')}</p>
                  </div>
                </div>
              </article>

              <article class="rounded-md border bg-card">
                <header class="border-b px-4 py-3">
                  <h3 class="text-sm font-medium">扣款依据条目 <span class="ml-1 text-xs font-normal text-muted-foreground">${basisItems.length} 条</span></h3>
                </header>
                <div class="space-y-2 px-4 py-4">
                  ${
                    basisItems.length === 0
                      ? '<p class="text-sm text-muted-foreground">暂无关联扣款依据</p>'
                      : basisItems
                          .map(
                            (basis) => `
                              <div class="space-y-1.5 rounded-md border bg-background px-3 py-2.5 text-sm">
                                <div class="flex flex-wrap items-center gap-2">
                                  <span class="font-mono text-xs font-medium">${escapeHtml(basis.basisId)}</span>
                                  <span class="inline-flex rounded-md border px-2 py-0.5 text-xs">${basis.sourceType === 'QC_FAIL' ? '质检不合格' : basis.sourceType === 'QC_DEFECT_ACCEPT' ? '瑕疵品接收' : '交接差异'}</span>
                                  <span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${
                                    basis.status === 'CONFIRMED'
                                      ? 'border-green-200 bg-green-100 text-green-800'
                                      : basis.status === 'DISPUTED'
                                        ? 'border-yellow-200 bg-yellow-100 text-yellow-800'
                                        : basis.status === 'VOID'
                                          ? 'bg-muted text-muted-foreground'
                                          : 'bg-muted text-muted-foreground'
                                  }">${basis.status === 'CONFIRMED' ? '已确认' : basis.status === 'DISPUTED' ? '争议中' : basis.status === 'VOID' ? '已作废' : '草稿'}</span>
                                </div>
                                ${
                                  basis.summary
                                    ? `<p class="text-xs text-muted-foreground">${escapeHtml(basis.summary)}</p>`
                                    : ''
                                }
                                <div class="text-xs text-muted-foreground">
                                  责任方：${basis.settlementPartyType ? PARTY_TYPE_LABEL[basis.settlementPartyType] : '-'} / ${escapeHtml(basis.settlementPartyId ?? '-')}
                                  · 数量：${basis.qty} ${basis.uom}
                                  ${
                                    basis.deductionQty !== undefined
                                      ? ` · 可扣款数量：${basis.deductionQty}`
                                      : ''
                                  }
                                </div>
                                <button class="inline-flex items-center gap-1 text-xs text-primary underline" data-nav="/fcs/quality/deduction-calc/${escapeHtml(basis.basisId)}">
                                  去扣款计算查看
                                  <i data-lucide="external-link" class="h-3 w-3"></i>
                                </button>
                              </div>
                            `,
                          )
                          .join('')
                  }
                </div>
              </article>

              ${
                existingQc.auditLogs.length > 0
                  ? `
                    <article class="rounded-md border bg-card">
                      <header class="border-b px-4 py-3">
                        <h3 class="text-sm font-medium">操作日志</h3>
                      </header>
                      <ol class="space-y-2 px-4 py-4">
                        ${existingQc.auditLogs
                          .map(
                            (log) => `
                              <li class="flex gap-3 text-xs text-muted-foreground">
                                <span class="shrink-0 tabular-nums">${escapeHtml(log.at)}</span>
                                <span class="shrink-0 font-medium text-foreground">${escapeHtml(log.by)}</span>
                                <span>${escapeHtml(log.detail)}</span>
                              </li>
                            `,
                          )
                          .join('')}
                      </ol>
                    </article>
                  `
                  : ''
              }
            </section>
          `
          : ''
      }
    </div>
  `
}

function updateFormField(detail: QcRecordDetailState, field: string, value: string): void {
  if (field === 'refType') {
    if (value === 'HANDOVER') {
      detail.form.refType = 'HANDOVER'
    } else if (value === 'RETURN_BATCH') {
      detail.form.refType = 'RETURN_BATCH'
    } else {
      detail.form.refType = 'TASK'
    }
    detail.form.refId = ''
    if (detail.form.refType !== 'RETURN_BATCH') {
      return
    }
    const firstBatch = initialReturnInboundBatches[0]
    if (firstBatch) {
      applyReturnInboundBatchToForm(detail.form, firstBatch.batchId)
    }
    return
  }
  if (field === 'refId') {
    detail.form.refId = value
    if (detail.form.refType === 'RETURN_BATCH') {
      applyReturnInboundBatchToForm(detail.form, value)
    }
    return
  }
  if (field === 'productionOrderId') {
    detail.form.productionOrderId = value
    return
  }
  if (field === 'inspector') {
    detail.form.inspector = value
    return
  }
  if (field === 'inspectedAt') {
    detail.form.inspectedAt = value
    return
  }
  if (field === 'disposition') {
    detail.form.disposition = (value || '') as QcDisposition | ''
    if (!detail.form.disposition || !NEEDS_AFFECTED_QTY.includes(detail.form.disposition)) {
      detail.form.affectedQty = ''
    }
    return
  }
  if (field === 'affectedQty') {
    detail.form.affectedQty = parseNumberField(value)
    return
  }
  if (field === 'rootCauseType') {
    detail.form.rootCauseType = (value as RootCauseType) || 'UNKNOWN'
    return
  }
  if (field === 'liabilityStatus') {
    detail.form.liabilityStatus = (value as LiabilityStatus) || 'DRAFT'
    return
  }
  if (field === 'responsiblePartyType') {
    detail.form.responsiblePartyType = (value || '') as SettlementPartyType | ''
    return
  }
  if (field === 'responsiblePartyId') {
    detail.form.responsiblePartyId = value
    return
  }
  if (field === 'responsiblePartyName') {
    detail.form.responsiblePartyName = value
    return
  }
  if (field === 'deductionDecision') {
    detail.form.deductionDecision = (value || '') as DeductionDecision | ''
    if (detail.form.deductionDecision !== 'DEDUCT') {
      detail.form.deductionAmount = ''
    }
    return
  }
  if (field === 'deductionAmount') {
    detail.form.deductionAmount = parseAmountField(value)
    return
  }
  if (field === 'deductionDecisionRemark') {
    detail.form.deductionDecisionRemark = value
    return
  }
  if (field === 'dispositionRemark') {
    detail.form.dispositionRemark = value
    return
  }
  if (field === 'remark') {
    detail.form.remark = value
  }
}

function setResult(detail: QcRecordDetailState, result: QcResult): void {
  detail.form.result = result
  if (result === 'PASS') {
    detail.form.defectItems = []
    detail.form.disposition = ''
    detail.form.affectedQty = ''
    detail.form.rootCauseType = 'UNKNOWN'
    detail.form.responsiblePartyType = ''
    detail.form.responsiblePartyId = ''
    detail.form.responsiblePartyName = ''
    detail.form.deductionDecision = ''
    detail.form.deductionAmount = ''
    detail.form.deductionDecisionRemark = ''
    detail.form.dispositionRemark = ''
  }
}

function isDetailReadOnly(detail: QcRecordDetailState): boolean {
  if (!detail.currentQcId) return false
  const existing = getQcById(detail.currentQcId)
  return existing?.status === 'SUBMITTED' || existing?.status === 'CLOSED'
}

export function handleQcRecordsEvent(target: HTMLElement): boolean {
  const listFilterNode = target.closest<HTMLElement>('[data-qcr-filter]')
  if (listFilterNode instanceof HTMLInputElement || listFilterNode instanceof HTMLSelectElement) {
    const field = listFilterNode.dataset.qcrFilter
    if (field === 'keyword') {
      listState.keyword = listFilterNode.value
      return true
    }
    if (field === 'showLegacy' && listFilterNode instanceof HTMLInputElement) {
      listState.showLegacy = listFilterNode.checked
      return true
    }
    if (field === 'processType') {
      listState.filterProcessType = listFilterNode.value as QcRecordsListState['filterProcessType']
      return true
    }
    if (field === 'policy') {
      listState.filterPolicy = listFilterNode.value as QcRecordsListState['filterPolicy']
      return true
    }
    if (field === 'result') {
      listState.filterResult = listFilterNode.value as ResultFilter
      return true
    }
    if (field === 'status') {
      listState.filterStatus = listFilterNode.value as StatusFilter
      return true
    }
    if (field === 'disposition') {
      listState.filterDisposition = listFilterNode.value as DispositionFilter
      return true
    }
    if (field === 'factory') {
      listState.filterFactory = listFilterNode.value
      return true
    }
    if (field === 'warehouse') {
      listState.filterWarehouse = listFilterNode.value
      return true
    }
    return true
  }

  const detailFieldNode = target.closest<HTMLElement>('[data-qcd-field]')
  if (
    detailFieldNode instanceof HTMLInputElement ||
    detailFieldNode instanceof HTMLSelectElement ||
    detailFieldNode instanceof HTMLTextAreaElement
  ) {
    const routeQcId = getCurrentDetailRouteId()
    if (!routeQcId) return false

    const detail = ensureDetailState(routeQcId)
    const field = detailFieldNode.dataset.qcdField
    if (!field) return true

    if (!isDetailReadOnly(detail)) {
      updateFormField(detail, field, detailFieldNode.value)
    }
    return true
  }

  const defectNode = target.closest<HTMLElement>('[data-qcd-defect-field]')
  if (defectNode instanceof HTMLInputElement) {
    const routeQcId = getCurrentDetailRouteId()
    if (!routeQcId) return false

    const detail = ensureDetailState(routeQcId)
    if (isDetailReadOnly(detail)) return true

    const field = defectNode.dataset.qcdDefectField
    const index = Number(defectNode.dataset.qcdDefectIndex)
    if (!field || Number.isNaN(index)) return true

    const defect = detail.form.defectItems[index]
    if (!defect) return true

    if (field === 'name') {
      defect.defectName = defectNode.value
      return true
    }
    if (field === 'qty') {
      const value = parseNumberField(defectNode.value)
      defect.qty = value === '' ? 0 : Math.max(0, value)
      return true
    }

    return true
  }

  const breakdownNode = target.closest<HTMLElement>('[data-qcd-breakdown]')
  if (breakdownNode instanceof HTMLInputElement) {
    const routeQcId = getCurrentDetailRouteId()
    if (!routeQcId) return false
    const detail = ensureDetailState(routeQcId)

    const key = breakdownNode.dataset.qcdBreakdown
    const value = parseNumberField(breakdownNode.value)
    const normalized = value === '' ? '' : Math.max(0, value)

    if (key === 'defect') {
      detail.bdAcceptDefect = normalized
      return true
    }
    if (key === 'scrap') {
      detail.bdScrap = normalized
      return true
    }
    if (key === 'nodeduct') {
      detail.bdNoDeduct = normalized
      return true
    }

    return true
  }

  const listActionNode = target.closest<HTMLElement>('[data-qcr-action]')
  if (listActionNode) {
    const action = listActionNode.dataset.qcrAction
    if (!action) return true

    if (action === 'reset-filters') {
      listState.keyword = ''
      listState.filterProcessType = 'ALL'
      listState.filterPolicy = 'ALL'
      listState.filterResult = 'ALL'
      listState.filterStatus = 'ALL'
      listState.filterDisposition = 'ALL'
      listState.filterFactory = 'ALL'
      listState.filterWarehouse = 'ALL'
      listState.showLegacy = false
      return true
    }

    return true
  }

  const detailActionNode = target.closest<HTMLElement>('[data-qcd-action]')
  if (!detailActionNode) return false

  const action = detailActionNode.dataset.qcdAction
  if (!action) return false

  const routeQcId = getCurrentDetailRouteId()
  const detail = routeQcId ? ensureDetailState(routeQcId) : null

  if (action === 'back-list') {
    appStore.navigate('/fcs/quality/qc-records')
    return true
  }

  if (!detail) return true

  if (action === 'set-result') {
    if (isDetailReadOnly(detail)) return true
    const result = detailActionNode.dataset.qcdResult as QcResult | undefined
    if (result === 'PASS' || result === 'FAIL') {
      setResult(detail, result)
    }
    return true
  }

  if (action === 'add-defect') {
    if (isDetailReadOnly(detail)) return true
    detail.form.defectItems.push({ defectCode: '', defectName: '', qty: 1 })
    return true
  }

  if (action === 'remove-defect') {
    if (isDetailReadOnly(detail)) return true
    const index = Number(detailActionNode.dataset.qcdIndex)
    if (!Number.isNaN(index)) {
      detail.form.defectItems = detail.form.defectItems.filter((_, itemIndex) => itemIndex !== index)
    }
    return true
  }

  if (action === 'save-draft') {
    if (isDetailReadOnly(detail)) return true
    saveDraft(detail)
    return true
  }

  if (action === 'submit') {
    if (isDetailReadOnly(detail)) return true
    submitDetail(detail)
    return true
  }

  if (action === 'quick-fill') {
    const existing = detail.currentQcId ? getQcById(detail.currentQcId) : null
    const targetQty = existing?.affectedQty ?? 0
    const fill = detailActionNode.dataset.qcdFill

    detail.bdAcceptDefect = fill === 'defect' ? targetQty : 0
    detail.bdScrap = fill === 'scrap' ? targetQty : 0
    detail.bdNoDeduct = fill === 'nodeduct' ? targetQty : 0
    return true
  }

  if (action === 'save-breakdown') {
    if (!detail.currentQcId) {
      showQcRecordsToast('请先保存草稿再填写处置拆分', 'error')
      return true
    }

    const result = updateQcDispositionBreakdown(
      detail.currentQcId,
      {
        acceptAsDefectQty: Number(detail.bdAcceptDefect) || 0,
        scrapQty: Number(detail.bdScrap) || 0,
        acceptNoDeductQty: Number(detail.bdNoDeduct) || 0,
      },
      '管理员',
    )

    if (!result.ok) {
      showQcRecordsToast(result.message ?? '保存失败', 'error')
      return true
    }

    const latest = getQcById(detail.currentQcId)
    if (latest) {
      syncDetailFromQc(detail, latest)
    }
    showQcRecordsToast('处置数量拆分已保存，可扣款数量已同步')
    return true
  }

  return true
}

export function isQcRecordsDialogOpen(): boolean {
  return false
}
