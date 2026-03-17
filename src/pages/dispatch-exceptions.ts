import { productionOrders } from '../data/fcs/production-orders'
import { processTasks } from '../data/fcs/process-tasks'
import { initialTenderOrders } from '../data/fcs/store-domain-dispatch-process'
import {
  calculateSlaDue,
  initialExceptions,
  type CaseStatus,
  type ExceptionCase,
  type ExceptionCategory,
  type ReasonCode,
} from '../data/fcs/store-domain-progress'
import { applyQualitySeedBootstrap } from '../data/fcs/store-domain-quality-bootstrap'
import { escapeHtml } from '../utils'

applyQualitySeedBootstrap()

type DispatchExType = 'TENDER_NOT_CREATED' | 'NO_BID_FACTORY' | 'AWARD_CONFLICT' | 'TASK_UNASSIGNED' | 'OTHER'
type DispatchExStatus = 'PENDING' | 'PROCESSING' | 'RESOLVED' | 'CLOSED'
type SourceType = 'TASK' | 'TENDER' | 'AWARD'

interface SummaryRow {
  planStatusZh: string
  lifecycleStatusZh: string
  taskCount: number
  blockedCount: number
  tenderSummary: string
  impactSummary: string
}

interface CreateForm {
  exceptionType: DispatchExType | ''
  sourceType: SourceType | ''
  sourceId: string
  productionOrderId: string
  titleZh: string
  descriptionZh: string
  remark: string
}

interface DispatchExceptionsState {
  keyword: string
  filterType: 'ALL' | DispatchExType
  filterStatus: 'ALL' | DispatchExStatus
  filterSource: 'ALL' | SourceType
  createOpen: boolean
  createForm: CreateForm
  statusCaseId: string | null
  nextStatus: DispatchExStatus | ''
  statusRemark: string
}

const PLAN_STATUS_ZH: Record<string, string> = {
  UNPLANNED: '未计划',
  PLANNED: '已计划',
  RELEASED: '计划已下发',
}

const LIFECYCLE_STATUS_ZH: Record<string, string> = {
  DRAFT: '草稿',
  PLANNED: '已计划',
  RELEASED: '已下发',
  IN_PRODUCTION: '生产中',
  QC_PENDING: '待质检',
  COMPLETED: '已完成',
  CLOSED: '已关闭',
}

const EX_TYPE_LABEL: Record<DispatchExType, string> = {
  TENDER_NOT_CREATED: '招标单未创建',
  NO_BID_FACTORY: '无候选工厂',
  AWARD_CONFLICT: '定标冲突',
  TASK_UNASSIGNED: '任务未分配',
  OTHER: '其他',
}

const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  TASK: '任务',
  TENDER: '招标单',
  AWARD: '定标',
}

const STATUS_LABEL: Record<DispatchExStatus, string> = {
  PENDING: '待处理',
  PROCESSING: '处理中',
  RESOLVED: '已解决',
  CLOSED: '已关闭',
}

const STATUS_BADGE_CLASS: Record<DispatchExStatus, string> = {
  PENDING: 'border bg-secondary text-secondary-foreground',
  PROCESSING: 'border bg-background text-foreground',
  RESOLVED: 'border border-blue-200 bg-blue-100 text-blue-700',
  CLOSED: 'border bg-secondary text-secondary-foreground',
}

const REASON_TO_TYPE: Record<string, DispatchExType> = {
  DISPATCH_REJECTED: 'TENDER_NOT_CREATED',
  NO_BID: 'NO_BID_FACTORY',
  TENDER_OVERDUE: 'AWARD_CONFLICT',
  ACK_TIMEOUT: 'TASK_UNASSIGNED',
  TENDER_NEAR_DEADLINE: 'OTHER',
}

const DISPATCH_EX_REASON: Record<
  DispatchExType,
  { category: ExceptionCategory; reasonCode: ReasonCode; defaultTitle: string }
> = {
  TENDER_NOT_CREATED: { category: 'ASSIGNMENT', reasonCode: 'DISPATCH_REJECTED', defaultTitle: '招标单未创建' },
  NO_BID_FACTORY: { category: 'ASSIGNMENT', reasonCode: 'NO_BID', defaultTitle: '无候选工厂' },
  AWARD_CONFLICT: { category: 'ASSIGNMENT', reasonCode: 'TENDER_OVERDUE', defaultTitle: '定标冲突' },
  TASK_UNASSIGNED: { category: 'ASSIGNMENT', reasonCode: 'ACK_TIMEOUT', defaultTitle: '任务未分配' },
  OTHER: { category: 'ASSIGNMENT', reasonCode: 'TENDER_NEAR_DEADLINE', defaultTitle: '派单异常' },
}

const ALLOWED_NEXT_STATUS: Record<DispatchExStatus, DispatchExStatus[]> = {
  PENDING: ['PROCESSING', 'CLOSED'],
  PROCESSING: ['RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
}

const state: DispatchExceptionsState = {
  keyword: '',
  filterType: 'ALL',
  filterStatus: 'ALL',
  filterSource: 'ALL',
  createOpen: false,
  createForm: emptyCreateForm(),
  statusCaseId: null,
  nextStatus: '',
  statusRemark: '',
}

function emptyCreateForm(): CreateForm {
  return {
    exceptionType: '',
    sourceType: '',
    sourceId: '',
    productionOrderId: '',
    titleZh: '',
    descriptionZh: '',
    remark: '',
  }
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function showDispatchExceptionsToast(message: string, tone: 'success' | 'error' = 'success'): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'dispatch-exceptions-toast-root'
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
  }, 2400)
}

function toDexStatus(caseStatus: ExceptionCase['caseStatus']): DispatchExStatus {
  if (caseStatus === 'OPEN') return 'PENDING'
  if (caseStatus === 'IN_PROGRESS') return 'PROCESSING'
  if (caseStatus === 'RESOLVED') return 'RESOLVED'
  return 'CLOSED'
}

function toCaseStatus(status: DispatchExStatus): CaseStatus {
  if (status === 'PENDING') return 'OPEN'
  if (status === 'PROCESSING') return 'IN_PROGRESS'
  if (status === 'RESOLVED') return 'RESOLVED'
  return 'CLOSED'
}

function isDispatchException(row: ExceptionCase): boolean {
  return (row.tags ?? []).includes('DISPATCH') || row.category === 'ASSIGNMENT'
}

function deriveSourceType(row: ExceptionCase): SourceType {
  if (row.sourceType === 'TASK') return 'TASK'
  if (row.sourceType === 'ORDER') return 'TASK'
  if ((row.tags ?? []).includes('AWARD')) return 'AWARD'
  return 'TENDER'
}

function getAllExceptions(): ExceptionCase[] {
  return initialExceptions.filter(isDispatchException)
}

function getSummaryMap(rows: ExceptionCase[]): Map<string, SummaryRow> {
  const map = new Map<string, SummaryRow>()

  for (const row of rows) {
    const srcType = deriveSourceType(row)

    const orderId = row.relatedOrderIds?.[0]
    const order = orderId ? productionOrders.find((item) => item.productionOrderId === orderId) : undefined

    const planStatusZh = order?.planStatus ? PLAN_STATUS_ZH[order.planStatus] ?? '—' : '—'
    const lifecycleStatusZh = order?.lifecycleStatus
      ? LIFECYCLE_STATUS_ZH[order.lifecycleStatus] ?? '—'
      : '—'

    let taskCount = 0
    let blockedCount = 0

    if (srcType === 'TASK') {
      taskCount = 1
      const task = processTasks.find((item) => item.taskId === row.sourceId)
      blockedCount = task?.status === 'BLOCKED' ? 1 : 0
    } else if (orderId) {
      const tasks = processTasks.filter((item) => item.productionOrderId === orderId)
      taskCount = tasks.length
      blockedCount = tasks.filter((item) => item.status === 'BLOCKED').length
    }

    let tenderSummary = '—'

    if (srcType === 'TENDER' || srcType === 'AWARD') {
      const tender = initialTenderOrders.find((item) => item.tenderId === row.sourceId)

      if (tender) {
        if (tender.status === 'VOID' || tender.awardStatus === 'VOID') {
          tenderSummary = '已作废'
        } else if (tender.awardStatus === 'AWARDED') {
          tenderSummary = '已定标'
        } else if (tender.status === 'OPEN') {
          tenderSummary = '招标中待定标'
        } else if (tender.status === 'DRAFT') {
          tenderSummary = '招标单草稿'
        } else if (tender.status === 'CLOSED') {
          tenderSummary = '已截止待定标'
        } else {
          tenderSummary = '待定标'
        }
      } else {
        tenderSummary = srcType === 'AWARD' ? '待定标' : '—'
      }
    } else {
      const tenderId = row.relatedTenderIds?.[0]

      if (tenderId) {
        const tender = initialTenderOrders.find((item) => item.tenderId === tenderId)

        if (tender) {
          if (tender.awardStatus === 'AWARDED') {
            tenderSummary = '已定标'
          } else if (tender.status === 'OPEN') {
            tenderSummary = '招标中待定标'
          } else {
            tenderSummary = '待定标'
          }
        } else {
          tenderSummary = '未进入招标'
        }
      } else {
        tenderSummary = '未进入招标'
      }
    }

    const base =
      srcType === 'TASK' ? '影响任务执行' : srcType === 'TENDER' ? '影响招标与定标' : '影响定标与后续分配'

    const impactSummary = blockedCount > 0 ? `${base}（生产暂停任务 ${blockedCount} 条）` : base

    map.set(row.caseId, {
      planStatusZh,
      lifecycleStatusZh,
      taskCount,
      blockedCount,
      tenderSummary,
      impactSummary,
    })
  }

  return map
}

function getFilteredRows(rows: ExceptionCase[]): ExceptionCase[] {
  const keyword = state.keyword.trim().toLowerCase()

  return rows.filter((row) => {
    if (keyword) {
      const hit =
        row.caseId.toLowerCase().includes(keyword) ||
        row.relatedOrderIds.join(' ').toLowerCase().includes(keyword) ||
        row.summary.toLowerCase().includes(keyword)
      if (!hit) return false
    }

    if (state.filterType !== 'ALL') {
      const mapped = REASON_TO_TYPE[row.reasonCode] ?? 'OTHER'
      if (mapped !== state.filterType) return false
    }

    if (state.filterStatus !== 'ALL' && toDexStatus(row.caseStatus) !== state.filterStatus) {
      return false
    }

    if (state.filterSource !== 'ALL' && deriveSourceType(row) !== state.filterSource) {
      return false
    }

    return true
  })
}

function getStats(rows: ExceptionCase[], summaryMap: Map<string, SummaryRow>): {
  pending: number
  processing: number
  resolved: number
  closed: number
  impactTask: number
  impactTender: number
  hasBlocked: number
  released: number
} {
  return {
    pending: rows.filter((row) => toDexStatus(row.caseStatus) === 'PENDING').length,
    processing: rows.filter((row) => toDexStatus(row.caseStatus) === 'PROCESSING').length,
    resolved: rows.filter((row) => toDexStatus(row.caseStatus) === 'RESOLVED').length,
    closed: rows.filter((row) => toDexStatus(row.caseStatus) === 'CLOSED').length,
    impactTask: rows.filter((row) => deriveSourceType(row) === 'TASK').length,
    impactTender: rows.filter((row) => {
      const sourceType = deriveSourceType(row)
      return sourceType === 'TENDER' || sourceType === 'AWARD'
    }).length,
    hasBlocked: rows.filter((row) => (summaryMap.get(row.caseId)?.blockedCount ?? 0) > 0).length,
    released: rows.filter((row) => summaryMap.get(row.caseId)?.planStatusZh === '计划已下发').length,
  }
}

function createDispatchException(
  input: {
    exceptionType: DispatchExType
    sourceType: SourceType
    sourceId: string
    productionOrderId?: string
    titleZh?: string
    descriptionZh?: string
    remark?: string
  },
  by: string,
): { ok: boolean; exceptionId?: string; message?: string } {
  const { exceptionType, sourceType, sourceId, productionOrderId, titleZh, descriptionZh, remark } = input

  if (!exceptionType) return { ok: false, message: '异常类型不能为空' }
  if (!sourceType) return { ok: false, message: '来源对象不能为空' }
  if (!sourceId.trim()) return { ok: false, message: '来源ID不能为空' }

  const ts = nowTimestamp()
  const month = ts.slice(0, 7).replace('-', '')
  const exceptionId = `DEX-${month}-${String(Math.floor(Math.random() * 9000) + 1000)}`
  const meta = DISPATCH_EX_REASON[exceptionType]

  const mappedSourceType: 'TASK' | 'ORDER' | 'TENDER' =
    sourceType === 'AWARD' ? 'TENDER' : sourceType === 'TASK' ? 'TASK' : 'TENDER'

  const row: ExceptionCase = {
    caseId: exceptionId,
    caseStatus: 'OPEN',
    severity: 'S3',
    category: meta.category,
    reasonCode: meta.reasonCode,
    sourceType: mappedSourceType,
    sourceId: sourceId.trim(),
    relatedOrderIds: productionOrderId ? [productionOrderId] : [],
    relatedTaskIds: sourceType === 'TASK' ? [sourceId.trim()] : [],
    relatedTenderIds: sourceType !== 'TASK' ? [sourceId.trim()] : [],
    summary: titleZh?.trim() || meta.defaultTitle,
    detail: descriptionZh?.trim() || remark?.trim() || '',
    createdAt: ts,
    updatedAt: ts,
    slaDueAt: calculateSlaDue('S3', ts),
    tags: ['DISPATCH'],
    actions: [],
    auditLogs: [{ id: `AL-${exceptionId}-01`, action: 'CREATE', detail: '登记异常', at: ts, by }],
  }

  initialExceptions.push(row)
  return { ok: true, exceptionId }
}

function updateDispatchExceptionStatus(
  input: { exceptionId: string; nextStatus: DispatchExStatus; remark?: string },
  by: string,
): { ok: boolean; message?: string } {
  const { exceptionId, nextStatus, remark } = input

  const row = initialExceptions.find((item) => item.caseId === exceptionId)
  if (!row) return { ok: false, message: `异常单 ${exceptionId} 不存在` }
  if (!nextStatus) return { ok: false, message: '目标状态不能为空' }

  const currentStatus = row.caseStatus
  const nextCaseStatus = toCaseStatus(nextStatus)

  const allowed: Partial<Record<CaseStatus, CaseStatus[]>> = {
    OPEN: ['IN_PROGRESS', 'CLOSED'],
    IN_PROGRESS: ['RESOLVED', 'CLOSED'],
    RESOLVED: ['CLOSED'],
  }

  if (!allowed[currentStatus]?.includes(nextCaseStatus)) {
    return { ok: false, message: '当前异常状态不允许切换到目标状态' }
  }

  const ts = nowTimestamp()

  row.caseStatus = nextCaseStatus
  row.updatedAt = ts

  if (nextStatus === 'RESOLVED' || nextStatus === 'CLOSED') {
    row.resolvedAt = ts
    row.resolvedBy = by
  }

  row.auditLogs = [
    ...row.auditLogs,
    {
      id: `AL-${exceptionId}-${Date.now()}`,
      action: 'STATUS_CHANGE',
      detail: remark?.trim() || `状态变更为${nextStatus}`,
      at: ts,
      by,
    },
  ]

  return { ok: true }
}

function getStatusTarget(): ExceptionCase | null {
  if (!state.statusCaseId) return null

  return getAllExceptions().find((row) => row.caseId === state.statusCaseId) ?? null
}

function resetCreateForm(): void {
  state.createForm = emptyCreateForm()
}

function openStatusDialog(caseId: string): void {
  state.statusCaseId = caseId
  state.nextStatus = ''
  state.statusRemark = ''
}

function closeStatusDialog(): void {
  state.statusCaseId = null
  state.nextStatus = ''
  state.statusRemark = ''
}

function closeCreateDialog(): void {
  state.createOpen = false
  resetCreateForm()
}

function closeDialogs(): void {
  closeCreateDialog()
  closeStatusDialog()
}

function handleCreate(): void {
  if (!state.createForm.exceptionType) {
    showDispatchExceptionsToast('请选择异常类型', 'error')
    return
  }

  if (!state.createForm.sourceType) {
    showDispatchExceptionsToast('请选择来源对象', 'error')
    return
  }

  if (!state.createForm.sourceId.trim()) {
    showDispatchExceptionsToast('来源ID不能为空', 'error')
    return
  }

  const result = createDispatchException(
    {
      exceptionType: state.createForm.exceptionType,
      sourceType: state.createForm.sourceType,
      sourceId: state.createForm.sourceId.trim(),
      productionOrderId: state.createForm.productionOrderId.trim() || undefined,
      titleZh: state.createForm.titleZh.trim() || undefined,
      descriptionZh: state.createForm.descriptionZh.trim() || undefined,
      remark: state.createForm.remark.trim() || undefined,
    },
    '管理员',
  )

  if (result.ok) {
    showDispatchExceptionsToast('异常已创建')
    closeCreateDialog()
  } else {
    showDispatchExceptionsToast(result.message ?? '创建失败', 'error')
  }
}

function getAllowedNextStatuses(statusTarget: ExceptionCase | null): DispatchExStatus[] {
  if (!statusTarget) return []

  const current = toDexStatus(statusTarget.caseStatus)
  return ALLOWED_NEXT_STATUS[current] ?? []
}

function handleStatusChange(): void {
  const statusTarget = getStatusTarget()

  if (!statusTarget || !state.nextStatus) {
    showDispatchExceptionsToast('请选择目标状态', 'error')
    return
  }

  const result = updateDispatchExceptionStatus(
    {
      exceptionId: statusTarget.caseId,
      nextStatus: state.nextStatus,
      remark: state.statusRemark.trim() || undefined,
    },
    '管理员',
  )

  if (result.ok) {
    showDispatchExceptionsToast('异常状态已更新')
    closeStatusDialog()
  } else {
    showDispatchExceptionsToast(result.message ?? '状态变更失败', 'error')
  }
}

function renderCreateDialog(): string {
  if (!state.createOpen) return ''

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-dex-action="close-create" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 max-h-[86vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-background p-6 shadow-2xl" data-dialog-panel="true">
        <button class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100" data-dex-action="close-create" aria-label="关闭">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>

        <h3 class="text-lg font-semibold">新建异常</h3>

        <div class="mt-4 flex flex-col gap-4 py-2">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">异常类型 <span class="text-red-600">*</span></label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-dex-field="create.exceptionType">
              <option value="" ${state.createForm.exceptionType === '' ? 'selected' : ''}>请选择</option>
              ${(Object.entries(EX_TYPE_LABEL) as Array<[DispatchExType, string]>)
                .map(
                  ([value, label]) =>
                    `<option value="${escapeHtml(value)}" ${state.createForm.exceptionType === value ? 'selected' : ''}>${escapeHtml(label)}</option>`,
                )
                .join('')}
            </select>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">来源对象 <span class="text-red-600">*</span></label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-dex-field="create.sourceType">
              <option value="" ${state.createForm.sourceType === '' ? 'selected' : ''}>请选择</option>
              ${(Object.entries(SOURCE_TYPE_LABEL) as Array<[SourceType, string]>)
                .map(
                  ([value, label]) =>
                    `<option value="${escapeHtml(value)}" ${state.createForm.sourceType === value ? 'selected' : ''}>${escapeHtml(label)}</option>`,
                )
                .join('')}
            </select>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">来源ID <span class="text-red-600">*</span></label>
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="如 TD-202603-0001"
              data-dex-field="create.sourceId"
              value="${escapeHtml(state.createForm.sourceId)}"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">生产单号（可选）</label>
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="如 PO-0001"
              data-dex-field="create.productionOrderId"
              value="${escapeHtml(state.createForm.productionOrderId)}"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">标题（可选）</label>
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="留空则使用默认标题"
              data-dex-field="create.titleZh"
              value="${escapeHtml(state.createForm.titleZh)}"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">说明（可选）</label>
            <textarea
              rows="2"
              class="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="描述异常详情"
              data-dex-field="create.descriptionZh"
            >${escapeHtml(state.createForm.descriptionZh)}</textarea>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">备注（可选）</label>
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="备注信息"
              data-dex-field="create.remark"
              value="${escapeHtml(state.createForm.remark)}"
            />
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-dex-action="close-create">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-dex-action="submit-create">保存</button>
        </div>
      </section>
    </div>
  `
}

function renderStatusDialog(statusTarget: ExceptionCase | null): string {
  if (!statusTarget) return ''

  const allowedNextStatuses = getAllowedNextStatuses(statusTarget)

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-dex-action="close-status" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl" data-dialog-panel="true">
        <button class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100" data-dex-action="close-status" aria-label="关闭">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>

        <h3 class="text-lg font-semibold">变更异常状态</h3>

        <div class="mt-4 flex flex-col gap-4 py-2">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">当前状态</label>
            <div>
              <span class="inline-flex rounded-md px-2 py-0.5 text-xs ${STATUS_BADGE_CLASS[toDexStatus(statusTarget.caseStatus)]}">
                ${STATUS_LABEL[toDexStatus(statusTarget.caseStatus)]}
              </span>
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">目标状态 <span class="text-red-600">*</span></label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-dex-field="status.nextStatus">
              <option value="" ${state.nextStatus === '' ? 'selected' : ''}>请选择</option>
              ${allowedNextStatuses
                .map(
                  (status) =>
                    `<option value="${status}" ${state.nextStatus === status ? 'selected' : ''}>${STATUS_LABEL[status]}</option>`,
                )
                .join('')}
            </select>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">备注（可选）</label>
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="说明原因"
              data-dex-field="status.remark"
              value="${escapeHtml(state.statusRemark)}"
            />
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-dex-action="close-status">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            !state.nextStatus ? 'pointer-events-none opacity-50' : ''
          }" data-dex-action="submit-status">保存</button>
        </div>
      </section>
    </div>
  `
}

function renderRow(row: ExceptionCase, summaryMap: Map<string, SummaryRow>): string {
  const dexType = REASON_TO_TYPE[row.reasonCode] ?? 'OTHER'
  const dexStatus = toDexStatus(row.caseStatus)
  const sourceType = deriveSourceType(row)
  const orderId = row.relatedOrderIds[0] ?? '—'
  const summary = summaryMap.get(row.caseId)

  return `
    <tr class="border-b last:border-b-0">
      <td class="px-3 py-3 font-mono text-xs">${escapeHtml(row.caseId)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(EX_TYPE_LABEL[dexType])}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(SOURCE_TYPE_LABEL[sourceType])}</td>
      <td class="px-3 py-3 font-mono text-xs">${escapeHtml(row.sourceId)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(orderId)}</td>
      <td class="px-3 py-3">
        <span class="inline-flex rounded-md border bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">${escapeHtml(
          summary?.planStatusZh ?? '—',
        )}</span>
      </td>
      <td class="px-3 py-3">
        <span class="inline-flex rounded-md border bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">${escapeHtml(
          summary?.lifecycleStatusZh ?? '—',
        )}</span>
      </td>
      <td class="px-3 py-3 text-center text-sm">${summary?.taskCount ?? 0}</td>
      <td class="px-3 py-3 text-center text-sm">
        ${(summary?.blockedCount ?? 0) > 0
          ? `<span class="inline-flex rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">${summary?.blockedCount ?? 0}</span>`
          : '<span class="text-muted-foreground">0</span>'}
      </td>
      <td class="px-3 py-3 text-sm">${escapeHtml(summary?.tenderSummary ?? '—')}</td>
      <td class="max-w-[200px] px-3 py-3 text-sm">${escapeHtml(summary?.impactSummary ?? '—')}</td>
      <td class="max-w-[160px] truncate px-3 py-3 text-sm" title="${escapeHtml(row.summary)}">${escapeHtml(row.summary)}</td>
      <td class="px-3 py-3">
        <span class="inline-flex rounded-md px-2 py-0.5 text-xs ${STATUS_BADGE_CLASS[dexStatus]}">${STATUS_LABEL[dexStatus]}</span>
      </td>
      <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(row.updatedAt ?? '—')}</td>
      <td class="px-3 py-3">
        <div class="flex flex-wrap gap-1">
          <button
            class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted ${
              dexStatus === 'CLOSED' ? 'pointer-events-none opacity-50' : ''
            }"
            data-dex-action="open-status"
            data-case-id="${escapeHtml(row.caseId)}"
          >状态变更</button>

          ${
            sourceType === 'TENDER'
              ? '<button class="inline-flex h-8 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/dispatch/tenders">查看招标单</button>'
              : ''
          }

          ${
            sourceType === 'AWARD'
              ? '<button class="inline-flex h-8 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/dispatch/tenders">招标单管理</button>'
              : ''
          }

          ${
            sourceType === 'TASK'
              ? '<button class="inline-flex h-8 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/process/task-breakdown">查看任务</button>'
              : ''
          }
        </div>
      </td>
    </tr>
  `
}

export function renderDispatchExceptionsPage(): string {
  const allExceptions = getAllExceptions()
  const summaryMap = getSummaryMap(allExceptions)
  const filtered = getFilteredRows(allExceptions)
  const stats = getStats(allExceptions, summaryMap)
  const statusTarget = getStatusTarget()

  return `
    <div class="flex flex-col gap-6 p-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-semibold">异常处理</h1>
          <p class="text-sm text-muted-foreground">共 ${allExceptions.length} 条</p>
        </div>
        <button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700" data-dex-action="open-create">新建异常</button>
      </div>

      <div class="rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground">
        异常处理用于记录派单、竞价、定标过程中的异常事项；本页同步展示生产单计划、任务生产暂停以及招标/定标影响范围摘要
      </div>

      <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
        ${[
          { label: '待处理数', value: stats.pending },
          { label: '处理中数', value: stats.processing },
          { label: '已解决数', value: stats.resolved },
          { label: '已关闭数', value: stats.closed },
        ]
          .map(
            (item) => `
              <article class="rounded-lg border bg-card">
                <header class="px-4 pb-1 pt-4">
                  <h2 class="text-sm font-medium text-muted-foreground">${item.label}</h2>
                </header>
                <div class="px-4 pb-4">
                  <p class="text-2xl font-bold">${item.value}</p>
                </div>
              </article>
            `,
          )
          .join('')}
      </div>

      <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
        ${[
          { label: '影响任务执行异常数', value: stats.impactTask },
          { label: '影响招标/定标异常数', value: stats.impactTender },
          { label: '关联生产暂停任务异常数', value: stats.hasBlocked },
          { label: '已下发生产单关联异常数', value: stats.released },
        ]
          .map(
            (item) => `
              <article class="rounded-lg border bg-card">
                <header class="px-4 pb-1 pt-4">
                  <h2 class="text-sm font-medium text-muted-foreground">${item.label}</h2>
                </header>
                <div class="px-4 pb-4">
                  <p class="text-2xl font-bold">${item.value}</p>
                </div>
              </article>
            `,
          )
          .join('')}
      </div>

      <div class="flex flex-wrap gap-3">
        <input
          class="h-9 w-56 rounded-md border bg-background px-3 text-sm"
          placeholder="关键词（异常单号/生产单号/标题）"
          data-dex-filter="keyword"
          value="${escapeHtml(state.keyword)}"
        />

        <select class="h-9 w-40 rounded-md border bg-background px-3 text-sm" data-dex-filter="type">
          <option value="ALL" ${state.filterType === 'ALL' ? 'selected' : ''}>全部类型</option>
          ${(Object.entries(EX_TYPE_LABEL) as Array<[DispatchExType, string]>)
            .map(
              ([value, label]) =>
                `<option value="${value}" ${state.filterType === value ? 'selected' : ''}>${escapeHtml(label)}</option>`,
            )
            .join('')}
        </select>

        <select class="h-9 w-36 rounded-md border bg-background px-3 text-sm" data-dex-filter="status">
          <option value="ALL" ${state.filterStatus === 'ALL' ? 'selected' : ''}>全部状态</option>
          ${(Object.entries(STATUS_LABEL) as Array<[DispatchExStatus, string]>)
            .map(
              ([value, label]) =>
                `<option value="${value}" ${state.filterStatus === value ? 'selected' : ''}>${escapeHtml(label)}</option>`,
            )
            .join('')}
        </select>

        <select class="h-9 w-36 rounded-md border bg-background px-3 text-sm" data-dex-filter="source">
          <option value="ALL" ${state.filterSource === 'ALL' ? 'selected' : ''}>全部来源</option>
          ${(Object.entries(SOURCE_TYPE_LABEL) as Array<[SourceType, string]>)
            .map(
              ([value, label]) =>
                `<option value="${value}" ${state.filterSource === value ? 'selected' : ''}>${escapeHtml(label)}</option>`,
            )
            .join('')}
        </select>
      </div>

      <div class="overflow-x-auto rounded-md border bg-background">
        <table class="w-full min-w-[1780px] text-sm">
          <thead>
            <tr class="border-b bg-muted/40 text-left">
              <th class="px-3 py-2 font-medium">异常单号</th>
              <th class="px-3 py-2 font-medium">异常类型</th>
              <th class="px-3 py-2 font-medium">来源对象</th>
              <th class="px-3 py-2 font-medium">来源ID</th>
              <th class="px-3 py-2 font-medium">生产单号</th>
              <th class="px-3 py-2 font-medium">生产单计划状态</th>
              <th class="px-3 py-2 font-medium">生产单状态</th>
              <th class="px-3 py-2 font-medium">关联任务数</th>
              <th class="px-3 py-2 font-medium">生产暂停任务数</th>
              <th class="px-3 py-2 font-medium">招标/定标状态摘要</th>
              <th class="px-3 py-2 font-medium">影响范围摘要</th>
              <th class="px-3 py-2 font-medium">标题</th>
              <th class="px-3 py-2 font-medium">状态</th>
              <th class="px-3 py-2 font-medium">更新时间</th>
              <th class="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>

          <tbody>
            ${
              filtered.length === 0
                ? '<tr><td colspan="15" class="py-10 text-center text-sm text-muted-foreground">暂无异常数据</td></tr>'
                : filtered.map((row) => renderRow(row, summaryMap)).join('')
            }
          </tbody>
        </table>
      </div>

      ${renderCreateDialog()}
      ${renderStatusDialog(statusTarget)}
    </div>
  `
}

function updateField(field: string, node: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): void {
  const value = node.value

  if (field === 'filter.keyword') {
    state.keyword = value
    return
  }

  if (field === 'filter.type') {
    state.filterType = value as 'ALL' | DispatchExType
    return
  }

  if (field === 'filter.status') {
    state.filterStatus = value as 'ALL' | DispatchExStatus
    return
  }

  if (field === 'filter.source') {
    state.filterSource = value as 'ALL' | SourceType
    return
  }

  if (field === 'create.exceptionType') {
    state.createForm.exceptionType = value as DispatchExType | ''
    return
  }

  if (field === 'create.sourceType') {
    state.createForm.sourceType = value as SourceType | ''
    return
  }

  if (field === 'create.sourceId') {
    state.createForm.sourceId = value
    return
  }

  if (field === 'create.productionOrderId') {
    state.createForm.productionOrderId = value
    return
  }

  if (field === 'create.titleZh') {
    state.createForm.titleZh = value
    return
  }

  if (field === 'create.descriptionZh') {
    state.createForm.descriptionZh = value
    return
  }

  if (field === 'create.remark') {
    state.createForm.remark = value
    return
  }

  if (field === 'status.nextStatus') {
    state.nextStatus = value as DispatchExStatus | ''
    return
  }

  if (field === 'status.remark') {
    state.statusRemark = value
  }
}

export function handleDispatchExceptionsEvent(target: HTMLElement): boolean {
  const filterNode = target.closest<HTMLElement>('[data-dex-filter]')
  if (filterNode instanceof HTMLInputElement || filterNode instanceof HTMLSelectElement) {
    const filter = filterNode.dataset.dexFilter
    if (!filter) return true

    updateField(`filter.${filter}`, filterNode)
    return true
  }

  const fieldNode = target.closest<HTMLElement>('[data-dex-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLSelectElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    const field = fieldNode.dataset.dexField
    if (!field) return true

    updateField(field, fieldNode)
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-dex-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.dexAction
  if (!action) return false

  if (action === 'open-create') {
    resetCreateForm()
    state.createOpen = true
    return true
  }

  if (action === 'close-create') {
    closeCreateDialog()
    return true
  }

  if (action === 'submit-create') {
    handleCreate()
    return true
  }

  if (action === 'open-status') {
    const caseId = actionNode.dataset.caseId
    if (!caseId) return true

    const row = getAllExceptions().find((item) => item.caseId === caseId)
    if (!row) return true

    openStatusDialog(caseId)
    return true
  }

  if (action === 'close-status') {
    closeStatusDialog()
    return true
  }

  if (action === 'submit-status') {
    handleStatusChange()
    return true
  }

  if (action === 'close-dialog') {
    closeDialogs()
    return true
  }

  return false
}

export function isDispatchExceptionsDialogOpen(): boolean {
  return state.createOpen || state.statusCaseId !== null
}
