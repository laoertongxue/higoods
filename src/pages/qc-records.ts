import { appStore } from '../state/store'
import { processTasks, type ProcessTask } from '../data/fcs/process-tasks'
import { applyQualitySeedBootstrap } from '../data/fcs/store-domain-quality-bootstrap'
import {
  initialDeductionBasisItems,
  initialQualityInspections,
} from '../data/fcs/store-domain-quality-seeds'
import {
  defaultResponsibility,
  type DefectItem,
  type DeductionBasisItem,
  type LiabilityStatus,
  type QualityInspection,
  type SettlementPartyType,
} from '../data/fcs/store-domain-quality-types'
import { escapeHtml, formatDateTime, toClassName } from '../utils'

applyQualitySeedBootstrap()

type QcResult = 'PASS' | 'FAIL'
type QcStatus = 'DRAFT' | 'SUBMITTED' | 'CLOSED'
type QcDisposition = 'REWORK' | 'REMAKE' | 'ACCEPT_AS_DEFECT' | 'SCRAP' | 'ACCEPT'
type RootCauseType = 'PROCESS' | 'MATERIAL' | 'DYE_PRINT' | 'CUTTING' | 'PATTERN_TECH' | 'UNKNOWN'
type RefType = 'TASK' | 'HANDOVER'

type ResultFilter = 'ALL' | QcResult
type StatusFilter = 'ALL' | QcStatus
type DispositionFilter = 'ALL' | QcDisposition

interface QcRecordsListState {
  keyword: string
  filterResult: ResultFilter
  filterStatus: StatusFilter
  filterDisposition: DispositionFilter
  filterFactory: string
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
  liabilityStatus: LiabilityStatus
  remark: string
}

interface QcRecordDetailState {
  routeQcId: string
  queryKey: string
  currentQcId: string | null
  syncedUpdatedAt: string | null
  form: QcRecordFormState
  bdRework: number | ''
  bdRemake: number | ''
  bdAcceptDefect: number | ''
  bdScrap: number | ''
  bdNoDeduct: number | ''
}

const NEEDS_AFFECTED_QTY: QcDisposition[] = ['REWORK', 'REMAKE', 'ACCEPT_AS_DEFECT']

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
  REWORK: '返工',
  REMAKE: '重做',
  ACCEPT_AS_DEFECT: '接受（瑕疵品）',
  SCRAP: '报废',
  ACCEPT: '接受（无扣款）',
}

const DISPOSITION_CLASS: Record<QcDisposition, string> = {
  REWORK: 'bg-amber-100 text-amber-700 border-amber-300',
  REMAKE: 'bg-orange-100 text-orange-700 border-orange-300',
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
  filterResult: 'ALL',
  filterStatus: 'ALL',
  filterDisposition: 'ALL',
  filterFactory: 'ALL',
}

let detailState: QcRecordDetailState | null = null

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function randomSuffix(length = 4): string {
  return Math.random().toString(36).slice(2, 2 + length).toUpperCase()
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
    refType: 'TASK',
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
    liabilityStatus: 'DRAFT',
    remark: '',
    ...overrides,
  }
}

function qcToForm(qc: QualityInspection): QcRecordFormState {
  return {
    refType: qc.refType === 'HANDOVER' ? 'HANDOVER' : 'TASK',
    refId: qc.refId,
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
    liabilityStatus: qc.liabilityStatus,
    remark: qc.remark ?? '',
  }
}

function getQcById(qcId: string): QualityInspection | null {
  return initialQualityInspections.find((item) => item.qcId === qcId) ?? null
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
  state.bdRework = qc.dispositionQtyBreakdown?.reworkQty ?? ''
  state.bdRemake = qc.dispositionQtyBreakdown?.remakeQty ?? ''
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
    const prefTask = taskId ? processTasks.find((item) => item.taskId === taskId) : undefined

    const initOverrides: Partial<QcRecordFormState> = {}
    if (taskId) {
      initOverrides.refType = 'TASK'
      initOverrides.refId = taskId
      if (prefTask?.productionOrderId) {
        initOverrides.productionOrderId = prefTask.productionOrderId
      }
    } else if (handoverId) {
      initOverrides.refType = 'HANDOVER'
      initOverrides.refId = handoverId
    }

    detailState = {
      routeQcId,
      queryKey,
      currentQcId,
      syncedUpdatedAt: existingQc?.updatedAt ?? null,
      form: existingQc ? qcToForm(existingQc) : emptyForm(initOverrides),
      bdRework: existingQc?.dispositionQtyBreakdown?.reworkQty ?? '',
      bdRemake: existingQc?.dispositionQtyBreakdown?.remakeQty ?? '',
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
    rootCauseType: 'UNKNOWN',
    liabilityStatus: 'DRAFT',
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
      detail: `质检 ${qcId} 不合格，任务阻塞`,
      at: now,
      by,
    },
  ]
}

function createReworkOrRemakeTaskFromQc(
  parentTask: ProcessTask,
  qc: QualityInspection,
  by: string,
  now: string,
): { taskId?: string; message?: string } {
  if (!(qc.disposition === 'REWORK' || qc.disposition === 'REMAKE')) {
    return {}
  }

  const existingTask = processTasks.find(
    (task) =>
      task.sourceQcId === qc.qcId &&
      (task.processCode === 'PROC_REWORK' || task.processCode === 'PROC_REMAKE'),
  )
  if (existingTask) {
    return { taskId: existingTask.taskId }
  }

  if (!parentTask.assignedFactoryId) {
    return { message: '父任务未分配工厂，无法生成返工/重做任务' }
  }

  if (!qc.affectedQty || qc.affectedQty <= 0) {
    return { message: '受影响数量为空或为 0，无法生成返工/重做任务' }
  }

  const taskId = `TASK-${qc.qcId}-${Date.now()}`
  const task: ProcessTask = {
    taskId,
    productionOrderId: parentTask.productionOrderId,
    seq: 999,
    processCode: qc.disposition === 'REWORK' ? 'PROC_REWORK' : 'PROC_REMAKE',
    processNameZh: qc.disposition === 'REWORK' ? '返工' : '重做',
    stage: 'POST',
    qty: qc.affectedQty,
    qtyUnit: parentTask.qtyUnit || 'PIECE',
    assignmentMode: 'DIRECT',
    assignmentStatus: 'ASSIGNED',
    ownerSuggestion: { kind: 'MAIN_FACTORY' },
    assignedFactoryId: parentTask.assignedFactoryId,
    qcPoints: [],
    attachments: [],
    status: 'NOT_STARTED',
    acceptanceStatus: 'PENDING',
    parentTaskId: parentTask.taskId,
    sourceQcId: qc.qcId,
    sourceTaskId: parentTask.taskId,
    sourceProductionOrderId: qc.productionOrderId,
    taskKind: qc.disposition === 'REWORK' ? 'REWORK' : 'REMAKE',
    taskCategoryZh: qc.disposition === 'REWORK' ? '返工' : '重做',
    createdAt: now,
    updatedAt: now,
    auditLogs: [
      {
        id: `AL-RW-${Date.now()}-${randomSuffix(4)}`,
        action: 'CREATE_REWORK_TASK',
        detail: `由质检 ${qc.qcId} 生成，处置方式 ${qc.disposition}，数量 ${qc.affectedQty}`,
        at: now,
        by,
      },
    ],
  }

  processTasks.push(task)
  return { taskId }
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

function submitQcRecord(qcId: string, by: string): { ok: boolean; message?: string; generatedTaskIds: string[] } {
  const qc = getQcById(qcId)
  if (!qc) return { ok: false, message: '质检单不存在', generatedTaskIds: [] }

  const now = nowTimestamp()
  const generatedTaskIds = [...(qc.generatedTaskIds ?? [])]
  let auditLogs = [...qc.auditLogs]

  if (qc.result === 'FAIL') {
    const parentTask = processTasks.find((task) => task.taskId === qc.refId)
    if (!parentTask) {
      auditLogs.push({
        id: `QAL-NOTFOUND-${Date.now()}-${randomSuffix(4)}`,
        action: 'PARENT_TASK_NOT_FOUND',
        detail: `父任务 ${qc.refId} 不存在，无法阻塞及生成返工`,
        at: now,
        by,
      })
    } else {
      blockTaskForQuality(parentTask, qc.qcId, by, now)

      if (qc.disposition === 'REWORK' || qc.disposition === 'REMAKE') {
        const taskResult = createReworkOrRemakeTaskFromQc(parentTask, qc, by, now)
        if (taskResult.taskId && !generatedTaskIds.includes(taskResult.taskId)) {
          generatedTaskIds.push(taskResult.taskId)
          auditLogs.push({
            id: `QAL-GENTASK-${Date.now()}-${randomSuffix(4)}`,
            action: 'GENERATE_REWORK_TASK',
            detail: `生成返工/重做任务 ${taskResult.taskId}`,
            at: now,
            by,
          })
        } else if (taskResult.message) {
          auditLogs.push({
            id: `QAL-GENTASK-FAIL-${Date.now()}-${randomSuffix(4)}`,
            action: 'REWORK_GENERATION_FAILED',
            detail: taskResult.message,
            at: now,
            by,
          })
        }
      }

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
    generatedTaskIds,
    updatedAt: now,
    auditLogs,
  }
  replaceQc(updated)

  return { ok: true, generatedTaskIds }
}

function updateQcDispositionBreakdown(
  qcId: string,
  breakdown: {
    reworkQty?: number
    remakeQty?: number
    acceptAsDefectQty?: number
    scrapQty?: number
    acceptNoDeductQty?: number
  },
  by: string,
): { ok: boolean; message?: string } {
  const qc = getQcById(qcId)
  if (!qc) return { ok: false, message: '质检单不存在' }
  if (qc.result !== 'FAIL') return { ok: false, message: '仅 FAIL 质检单可保存处置拆分' }

  const reworkQty = breakdown.reworkQty ?? 0
  const remakeQty = breakdown.remakeQty ?? 0
  const acceptAsDefectQty = breakdown.acceptAsDefectQty ?? 0
  const scrapQty = breakdown.scrapQty ?? 0
  const acceptNoDeductQty = breakdown.acceptNoDeductQty ?? 0

  if (
    reworkQty < 0 ||
    remakeQty < 0 ||
    acceptAsDefectQty < 0 ||
    scrapQty < 0 ||
    acceptNoDeductQty < 0
  ) {
    return { ok: false, message: '拆分数量不能为负数' }
  }

  const sum = reworkQty + remakeQty + acceptAsDefectQty + scrapQty + acceptNoDeductQty
  const target = qc.affectedQty
  if (target !== undefined && target !== null && sum !== target) {
    return { ok: false, message: `合计（${sum}）必须等于不合格数量（${target}）` }
  }

  const now = nowTimestamp()
  const updatedQc: QualityInspection = {
    ...qc,
    dispositionQtyBreakdown: {
      reworkQty,
      remakeQty,
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
        detail: `处置拆分更新：返工${reworkQty}，重做${remakeQty}，瑕疵接收${acceptAsDefectQty}，报废${scrapQty}，无扣款接收${acceptNoDeductQty}`,
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

  const defectItems = isFail
    ? form.defectItems.map((item, index) => ({
        defectCode: item.defectCode?.trim() || `D${String(index + 1).padStart(3, '0')}`,
        defectName: item.defectName.trim(),
        qty: item.qty,
        remark: item.remark?.trim() || undefined,
      }))
    : []

  return {
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
    liabilityStatus: form.liabilityStatus,
    generatedTaskIds: existing?.generatedTaskIds,
  }
}

function validateForm(form: QcRecordFormState, forSubmit: boolean): string | null {
  if (!form.refId.trim()) return '请填写引用 ID（任务 ID 或交接事件 ID）'
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

      const refTask = processTasks.find((task) => task.taskId === form.refId)
      if (refTask && qty > refTask.qty) {
        return `受影响数量（${qty}）不能超过任务总量（${refTask.qty}）`
      }
    }
  }

  return null
}

function saveDraft(detail: QcRecordDetailState): void {
  const error = validateForm(detail.form, false)
  if (error) {
    showQcRecordsToast(error, 'error')
    return
  }

  const existing = detail.currentQcId ? getQcById(detail.currentQcId) : null
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
  const error = validateForm(detail.form, true)
  if (error) {
    showQcRecordsToast(error, 'error')
    return
  }

  let targetId = detail.currentQcId
  let existing = targetId ? getQcById(targetId) : null
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

  if (submitResult.generatedTaskIds.length > 0) {
    showQcRecordsToast(`质检已提交，已生成任务：${submitResult.generatedTaskIds.join('、')}`)
    return
  }

  showQcRecordsToast('质检已提交')
}

function getFactoryOptions(): string[] {
  const options = new Set<string>()
  for (const task of processTasks) {
    if (task.assignedFactoryId) {
      options.add(task.assignedFactoryId)
    }
  }
  return Array.from(options).sort((a, b) => a.localeCompare(b))
}

function getFilteredQcRecords(): QualityInspection[] {
  const keyword = listState.keyword.trim().toLowerCase()

  return initialQualityInspections
    .filter((qc) => {
      if (listState.filterResult !== 'ALL' && qc.result !== listState.filterResult) {
        return false
      }

      if (listState.filterStatus !== 'ALL' && qc.status !== listState.filterStatus) {
        return false
      }

      if (
        listState.filterDisposition !== 'ALL' &&
        (qc.disposition as QcDisposition | undefined) !== listState.filterDisposition
      ) {
        return false
      }

      if (listState.filterFactory !== 'ALL') {
        const task = processTasks.find((item) => item.taskId === qc.refId)
        if (!task || task.assignedFactoryId !== listState.filterFactory) {
          return false
        }
      }

      if (keyword) {
        const match =
          qc.qcId.toLowerCase().includes(keyword) ||
          qc.refId.toLowerCase().includes(keyword) ||
          qc.productionOrderId.toLowerCase().includes(keyword)
        if (!match) return false
      }

      return true
    })
    .sort((left, right) => {
      return new Date(right.inspectedAt || right.updatedAt).getTime() - new Date(left.inspectedAt || left.updatedAt).getTime()
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

function renderBlockBadge(qc: QualityInspection): string {
  const task = processTasks.find((item) => item.taskId === qc.refId)
  if (!task) {
    return '<span class="inline-flex rounded-md border px-2 py-0.5 text-xs text-muted-foreground">未知</span>'
  }

  if (task.status === 'BLOCKED' && task.blockReason === 'QUALITY') {
    return '<span class="inline-flex rounded-md border border-red-200 bg-red-100 px-2 py-0.5 text-xs text-red-700">已阻塞</span>'
  }

  return '<span class="inline-flex rounded-md border border-green-200 bg-green-100 px-2 py-0.5 text-xs text-green-700">正常</span>'
}

export function renderQcRecordsPage(): string {
  const filtered = getFilteredQcRecords()
  const factoryOptions = getFactoryOptions()

  return `
    <div class="flex flex-col gap-6 p-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight">质检记录</h1>
          <p class="mt-1 text-sm text-muted-foreground">共 ${filtered.length} 条</p>
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
              placeholder="质检单号 / 任务ID / 生产单号"
            />
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
              <option value="REWORK" ${listState.filterDisposition === 'REWORK' ? 'selected' : ''}>返工</option>
              <option value="REMAKE" ${listState.filterDisposition === 'REMAKE' ? 'selected' : ''}>重做</option>
              <option value="ACCEPT_AS_DEFECT" ${listState.filterDisposition === 'ACCEPT_AS_DEFECT' ? 'selected' : ''}>接受瑕疵品</option>
              <option value="SCRAP" ${listState.filterDisposition === 'SCRAP' ? 'selected' : ''}>报废</option>
              <option value="ACCEPT" ${listState.filterDisposition === 'ACCEPT' ? 'selected' : ''}>接受无扣款</option>
            </select>
          </div>

          ${
            factoryOptions.length > 0
              ? `
                <div class="w-40">
                  <label class="mb-1 block text-xs text-muted-foreground">工厂</label>
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
              <div class="py-16 text-center text-sm text-muted-foreground">暂无质检记录</div>
            </section>
          `
          : `
            <section class="overflow-x-auto rounded-md border bg-card">
              <table class="w-full min-w-[1200px] text-sm">
                <thead>
                  <tr class="border-b bg-muted/40 text-left">
                    <th class="px-4 py-2 font-medium">质检单号</th>
                    <th class="px-4 py-2 font-medium">任务ID</th>
                    <th class="px-4 py-2 font-medium">生产单号</th>
                    <th class="px-4 py-2 font-medium">工序</th>
                    <th class="px-4 py-2 font-medium">结果</th>
                    <th class="px-4 py-2 font-medium">处置方式</th>
                    <th class="px-4 py-2 text-right font-medium">受影响数量</th>
                    <th class="px-4 py-2 text-right font-medium">返工任务数</th>
                    <th class="px-4 py-2 font-medium">阻塞状态</th>
                    <th class="px-4 py-2 font-medium">质检时间</th>
                    <th class="px-4 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${filtered
                    .map((qc) => {
                      const task = processTasks.find((item) => item.taskId === qc.refId)
                      return `
                        <tr class="cursor-pointer border-b last:border-b-0 hover:bg-muted/50" data-nav="/fcs/quality/qc-records/${escapeHtml(qc.qcId)}">
                          <td class="px-4 py-3 font-mono text-xs font-semibold text-primary">${escapeHtml(qc.qcId)}</td>
                          <td class="px-4 py-3 font-mono text-xs">${escapeHtml(qc.refId)}</td>
                          <td class="px-4 py-3 font-mono text-xs">${escapeHtml(qc.productionOrderId)}</td>
                          <td class="px-4 py-3">${escapeHtml(task?.processNameZh ?? '-')}</td>
                          <td class="px-4 py-3">${renderResultBadge(qc.result as QcResult)}</td>
                          <td class="px-4 py-3">${renderDispositionBadge(qc.disposition as QcDisposition | undefined)}</td>
                          <td class="px-4 py-3 text-right">${qc.affectedQty ?? '-'}</td>
                          <td class="px-4 py-3 text-right">${qc.generatedTaskIds?.length ?? 0}</td>
                          <td class="px-4 py-3">${renderBlockBadge(qc)}</td>
                          <td class="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">${escapeHtml(formatDateTime(qc.inspectedAt || qc.updatedAt))}</td>
                          <td class="px-4 py-3">
                            <button class="inline-flex h-8 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/quality/qc-records/${escapeHtml(qc.qcId)}">
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
    (Number(detail.bdRework) || 0) +
    (Number(detail.bdRemake) || 0) +
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
                <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-qcd-action="quick-fill" data-qcd-fill="rework">全部返工</button>
                <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-qcd-action="quick-fill" data-qcd-fill="remake">全部重做</button>
                <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-qcd-action="quick-fill" data-qcd-fill="defect">全部瑕疵接收</button>
                <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-qcd-action="quick-fill" data-qcd-fill="scrap">全部报废</button>
                <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-qcd-action="quick-fill" data-qcd-fill="nodeduct">全部无扣款接受</button>
              </div>
            `
            : ''
        }

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div class="space-y-1">
            <label class="text-xs text-muted-foreground">返工数量</label>
            <input class="h-8 w-full rounded-md border bg-background px-2 text-sm" type="number" min="0" step="1" data-qcd-breakdown="rework" value="${toInputValue(detail.bdRework)}" />
          </div>
          <div class="space-y-1">
            <label class="text-xs text-muted-foreground">重做数量</label>
            <input class="h-8 w-full rounded-md border bg-background px-2 text-sm" type="number" min="0" step="1" data-qcd-breakdown="remake" value="${toInputValue(detail.bdRemake)}" />
          </div>
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
  const basisItems = detail.currentQcId
    ? initialDeductionBasisItems.filter(
        (item) => item.sourceRefId === detail.currentQcId || item.sourceId === detail.currentQcId,
      )
    : []
  const generatedTaskIds = existingQc?.generatedTaskIds ?? []
  const maxQty = refTask?.qty

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
            ${detail.form.refType === 'TASK' ? '来源类型：生产任务' : '来源类型：交接事件'}
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
                <option value="TASK" ${detail.form.refType === 'TASK' ? 'selected' : ''}>生产任务</option>
                <option value="HANDOVER" ${detail.form.refType === 'HANDOVER' ? 'selected' : ''}>交接事件</option>
              </select>
            </div>
            <div class="space-y-1.5">
              <label class="text-sm">${detail.form.refType === 'TASK' ? '任务 ID' : '交接事件 ID'}</label>
              <input class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70" data-qcd-field="refId" value="${toInputValue(detail.form.refId)}" placeholder="${detail.form.refType === 'TASK' ? 'TASK-xxxx-xxx' : 'HO-xxxx'}" ${readOnly ? 'disabled' : ''} />
            </div>
          </div>

          <div class="space-y-1.5">
            <label class="text-sm">生产工单号</label>
            <input class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70" data-qcd-field="productionOrderId" value="${toInputValue(detail.form.productionOrderId)}" placeholder="PO-xxxx（关联任务时自动带入）" ${readOnly ? 'disabled' : ''} />
          </div>

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
            <div class="rounded-md bg-muted px-4 py-2.5 text-sm text-muted-foreground">已提交，表单只读。</div>
          `
      }

      ${
        existingQc && existingQc.status === 'SUBMITTED'
          ? `
            <section class="space-y-4 pt-2">
              <div class="border-t pt-4">
                <h2 class="text-sm font-semibold">提交串联产物</h2>
              </div>

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
                generatedTaskIds.length > 0
                  ? `
                    <article class="rounded-md border bg-card">
                      <header class="border-b px-4 py-3">
                        <h3 class="text-sm font-medium">返工 / 重做任务 <span class="ml-1 text-xs font-normal text-muted-foreground">${generatedTaskIds.length} 条</span></h3>
                      </header>
                      <div class="space-y-2 px-4 py-4">
                        ${generatedTaskIds
                          .map((taskId) => {
                            const task = processTasks.find((item) => item.taskId === taskId)
                            return `
                              <div class="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                                <div class="flex min-w-0 items-center gap-3">
                                  <span class="shrink-0 font-mono text-xs">${escapeHtml(taskId)}</span>
                                  ${
                                    task
                                      ? `<span class="truncate text-xs text-muted-foreground">${escapeHtml(task.processNameZh)} · ${escapeHtml(task.status)}</span>`
                                      : ''
                                  }
                                </div>
                                <button class="inline-flex items-center gap-1 text-xs text-primary underline" data-nav="/fcs/pda/task-receive/${escapeHtml(taskId)}">
                                  跳转 PDA 任务
                                  <i data-lucide="external-link" class="h-3 w-3"></i>
                                </button>
                              </div>
                            `
                          })
                          .join('')}
                      </div>
                    </article>
                  `
                  : ''
              }

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
    detail.form.refType = value === 'HANDOVER' ? 'HANDOVER' : 'TASK'
    return
  }
  if (field === 'refId') {
    detail.form.refId = value
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

    if (key === 'rework') {
      detail.bdRework = normalized
      return true
    }
    if (key === 'remake') {
      detail.bdRemake = normalized
      return true
    }
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
      listState.filterResult = 'ALL'
      listState.filterStatus = 'ALL'
      listState.filterDisposition = 'ALL'
      listState.filterFactory = 'ALL'
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

    detail.bdRework = fill === 'rework' ? targetQty : 0
    detail.bdRemake = fill === 'remake' ? targetQty : 0
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
        reworkQty: Number(detail.bdRework) || 0,
        remakeQty: Number(detail.bdRemake) || 0,
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
