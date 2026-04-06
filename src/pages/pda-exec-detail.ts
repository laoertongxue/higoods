import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import { type ExecProofFile, type PauseReasonCode, type ProcessTask, type StartProofFile } from '../data/fcs/process-tasks'
import { indonesiaFactories } from '../data/fcs/indonesia-factories'
import {
  getTaskProcessDisplayName,
} from '../data/fcs/page-adapters/task-execution-adapter'
import {
  getPdaTaskFlowTaskById,
  isCuttingSpecialTask,
  listPdaTaskFlowTasks,
} from '../data/fcs/pda-cutting-execution-source.ts'
import {
  formatRemainingHours,
  formatStartDueSourceText,
  getStartPrerequisite,
  getTaskStartDueInfo,
  syncPdaStartRiskAndExceptions,
} from '../data/fcs/pda-start-link'
import {
  PAUSE_REASON_OPTIONS,
  getPauseHandleStatus,
  getTaskMilestoneProofHint,
  getTaskMilestoneState,
  isTaskMilestoneProofSatisfied,
  isTaskMilestoneReported,
  reportTaskMilestone,
  reportTaskPause,
  syncMilestoneOverdueExceptions,
} from '../data/fcs/pda-exec-link'
import { renderPdaCuttingTaskDetailPage } from './pda-cutting-task-detail'
import { renderPdaFrame } from './pda-shell'

interface PdaExecDetailState {
  initializedPathKey: string
  proofTaskId: string
  startProofFiles: StartProofFile[]
  milestoneProofFiles: ExecProofFile[]
  pauseProofFiles: ExecProofFile[]
  startTime: string
  startHeadcount: string
  milestoneTime: string
  pauseReasonCode: PauseReasonCode
  pauseRemark: string
  pauseTime: string
  fromPauseAction: boolean
}

const detailState: PdaExecDetailState = {
  initializedPathKey: '',
  proofTaskId: '',
  startProofFiles: [],
  milestoneProofFiles: [],
  pauseProofFiles: [],
  startTime: '',
  startHeadcount: '',
  milestoneTime: '',
  pauseReasonCode: 'CUTTING_ISSUE',
  pauseRemark: '',
  pauseTime: '',
  fromPauseAction: false,
}

function listTaskFacts(): ProcessTask[] {
  return listPdaTaskFlowTasks()
}

function getTaskFactById(taskId: string): ProcessTask | null {
  return getPdaTaskFlowTaskById(taskId) ?? null
}

function getTaskDisplayNo(task: ProcessTask): string {
  return task.taskNo || task.taskId
}

function getRootTaskDisplayNo(task: ProcessTask): string {
  return task.rootTaskNo || task.taskNo || task.taskId
}

function getQtyUnitLabel(unit: string | undefined): string {
  if (!unit) return '件'
  if (unit === 'PIECE' || unit === '件') return '件'
  if (unit === '片') return '片'
  if (unit === 'ROLL' || unit === '卷') return '卷'
  if (unit === 'LAYER' || unit === '层') return '层'
  return unit
}

function resolveTaskQtyDisplayMeta(task: ProcessTask, displayProcessName = getTaskProcessDisplayName(task)): { label: string; valueText: string } {
  const unitLabel = getQtyUnitLabel(task.qtyUnit)
  if (unitLabel === '卷') {
    return {
      label: '本单布卷数（卷）',
      valueText: `本单布卷数：${task.qty} 卷`,
    }
  }
  if (unitLabel === '层') {
    return {
      label: '本单铺布层数（层）',
      valueText: `本单铺布层数：${task.qty} 层`,
    }
  }

  const shouldUsePieceSemantics =
    unitLabel === '片'
    || (unitLabel === '件' && (isCuttingSpecialTask(task) || /裁片|入仓|交接/.test(displayProcessName)))

  if (shouldUsePieceSemantics) {
    return {
      label: '本单裁片片数（片）',
      valueText: `本单裁片片数：${task.qty} 片`,
    }
  }

  return {
    label: '本单成衣件数（件）',
    valueText: `本单成衣件数：${task.qty} 件`,
  }
}

function getReportedQtyLabel(unitLabel: string | undefined): string {
  if (unitLabel === '卷') return '上报布卷数（卷）'
  if (unitLabel === '层') return '上报铺布层数（层）'
  return '上报成衣件数（件）'
}

const MOCK_START_PROOF: Record<string, StartProofFile[]> = {
  'PDA-EXEC-007': [
    { id: 'sp-001', type: 'IMAGE', name: '开工现场_01.jpg', uploadedAt: '2026-03-10 08:05:22' },
    { id: 'sp-002', type: 'IMAGE', name: '物料到位_01.jpg', uploadedAt: '2026-03-10 08:06:10' },
  ],
  'PDA-EXEC-008': [
    { id: 'sp-003', type: 'IMAGE', name: '车缝开工现场.jpg', uploadedAt: '2026-03-09 14:11:00' },
    { id: 'sp-004', type: 'VIDEO', name: '设备状态检查.mp4', uploadedAt: '2026-03-09 14:12:30' },
  ],
  'PDA-EXEC-009': [
    { id: 'sp-005', type: 'IMAGE', name: '整烫区就位.jpg', uploadedAt: '2026-03-08 09:06:00' },
  ],
  'PDA-EXEC-010': [],
}

function getCurrentQueryString(): string {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  return query || ''
}

function getCurrentSearchParams(): URLSearchParams {
  return new URLSearchParams(getCurrentQueryString())
}

function toInputDateTime(value: string | undefined): string {
  if (!value) return ''
  return value.replace(' ', 'T').slice(0, 16)
}

function toStoreDateTime(value: string): string {
  if (!value) return ''
  const normalized = value.replace('T', ' ')
  return normalized.length === 16 ? `${normalized}:00` : normalized
}

function syncDialogStateWithQuery(task: ProcessTask): void {
  const taskId = task.taskId
  const pathname = appStore.getState().pathname
  const key = `${taskId}|${pathname}`

  if (detailState.initializedPathKey === key) return
  detailState.initializedPathKey = key

  const action = getCurrentSearchParams().get('action')
  detailState.fromPauseAction = action === 'pause'

  if (detailState.proofTaskId !== taskId) {
    const taskWithStart = task as ProcessTask & {
      startProofFiles?: StartProofFile[]
      startHeadcount?: number
    }

    detailState.proofTaskId = taskId
    detailState.startProofFiles = taskWithStart.startProofFiles
      ? [...taskWithStart.startProofFiles]
      : [...(MOCK_START_PROOF[taskId] || [])]
    detailState.milestoneProofFiles = task.milestoneProofFiles ? [...task.milestoneProofFiles] : []
    detailState.pauseProofFiles = task.pauseProofFiles ? [...task.pauseProofFiles] : []
    detailState.startTime = toInputDateTime(task.startedAt) || toInputDateTime(nowTimestamp())
    detailState.startHeadcount = taskWithStart.startHeadcount ? String(taskWithStart.startHeadcount) : ''
    detailState.milestoneTime = toInputDateTime(task.milestoneReportedAt || nowTimestamp())
    detailState.pauseReasonCode = task.pauseReasonCode || 'CUTTING_ISSUE'
    detailState.pauseRemark = task.pauseRemark || ''
    detailState.pauseTime = toInputDateTime(task.pauseReportedAt || nowTimestamp())
  }
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function parseDateMs(value: string): number {
  return new Date(value.replace(' ', 'T')).getTime()
}

function blockReasonLabel(reason: string | undefined): string {
  if (!reason) return '未知原因'
  const map: Record<string, string> = {
    MATERIAL: '物料',
    CAPACITY: '产能/排期',
    QUALITY: '质量处理',
    TECH: '工艺/技术资料',
    EQUIPMENT: '设备',
    OTHER: '其他',
    ALLOCATION_GATE: '分配开始条件',
  }
  return map[reason] ?? reason
}

function getDeadlineStatus(taskDeadline?: string, finishedAt?: string): { label: string; badgeClass: string } | null {
  if (!taskDeadline || finishedAt) return null
  const diff = parseDateMs(taskDeadline) - Date.now()

  if (diff < 0) {
    return { label: '执行逾期', badgeClass: 'bg-red-100 text-red-700' }
  }

  if (diff < 24 * 3600 * 1000) {
    return { label: '即将逾期', badgeClass: 'bg-amber-100 text-amber-700' }
  }

  return { label: '正常', badgeClass: 'bg-green-100 text-green-700' }
}

function showPdaExecDetailToast(message: string): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'pda-exec-detail-toast-root'
  let root = document.getElementById(rootId)

  if (!root) {
    root = document.createElement('div')
    root.id = rootId
    root.className = 'pointer-events-none fixed right-6 top-20 z-[130] flex max-w-sm flex-col gap-2'
    document.body.appendChild(root)
  }

  const toast = document.createElement('div')
  toast.className =
    'pointer-events-auto rounded-md border bg-background px-4 py-3 text-sm text-foreground shadow-md transition-all duration-200'
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
  }, 2200)
}

function nowDisplayTimestamp(date: Date = new Date()): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
}

function addProofFile(scope: 'start' | 'milestone' | 'pause', type: 'IMAGE' | 'VIDEO'): void {
  const ext = type === 'IMAGE' ? 'jpg' : 'mp4'
  const label = type === 'IMAGE' ? '图片' : '视频'
  const scopeTitle = scope === 'start' ? '开工' : scope === 'milestone' ? '关键节点' : '暂停上报'
  const currentFiles =
    scope === 'start'
      ? detailState.startProofFiles
      : scope === 'milestone'
        ? detailState.milestoneProofFiles
        : detailState.pauseProofFiles
  const index = currentFiles.length + 1
  const next = [
    ...currentFiles,
    {
      id: `${scope}-proof-${Date.now()}`,
      type,
      name: `${scopeTitle}${label}_${String(index).padStart(2, '0')}.${ext}`,
      uploadedAt: nowDisplayTimestamp(),
    },
  ]

  if (scope === 'start') detailState.startProofFiles = next
  else if (scope === 'milestone') detailState.milestoneProofFiles = next
  else detailState.pauseProofFiles = next
}

function removeProofFile(scope: 'start' | 'milestone' | 'pause', id: string): void {
  const next =
    scope === 'start'
      ? detailState.startProofFiles.filter((item) => item.id !== id)
      : scope === 'milestone'
        ? detailState.milestoneProofFiles.filter((item) => item.id !== id)
        : detailState.pauseProofFiles.filter((item) => item.id !== id)
  if (scope === 'start') detailState.startProofFiles = next
  else if (scope === 'milestone') detailState.milestoneProofFiles = next
  else detailState.pauseProofFiles = next
}

function renderProofUploadSection(
  files: StartProofFile[],
  scope: 'start' | 'milestone' | 'pause',
  helperText: string,
): string {
  return `
    <div class="space-y-3">
      <p class="text-xs leading-relaxed text-muted-foreground">${escapeHtml(helperText)}</p>
      <div class="flex gap-2">
        <button
          type="button"
          class="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-dashed text-xs hover:bg-muted"
          data-pda-execd-action="add-proof-image"
          data-proof-scope="${scope}"
        >
          <i data-lucide="image" class="h-3.5 w-3.5 text-blue-500"></i>
          上传图片
        </button>
        <button
          type="button"
          class="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-dashed text-xs hover:bg-muted"
          data-pda-execd-action="add-proof-video"
          data-proof-scope="${scope}"
        >
          <i data-lucide="video" class="h-3.5 w-3.5 text-purple-500"></i>
          上传视频
        </button>
      </div>
      ${
        files.length > 0
          ? `
              <div class="space-y-1.5">
                <p class="text-xs font-medium text-muted-foreground">已上传材料（${files.length} 个文件）</p>
                ${files
                  .map(
                    (file) => `
                      <div class="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                        <i data-lucide="${file.type === 'IMAGE' ? 'image' : 'video'}" class="h-4 w-4 shrink-0 ${file.type === 'IMAGE' ? 'text-blue-500' : 'text-purple-500'}"></i>
                        <div class="min-w-0 flex-1">
                          <p class="truncate text-xs font-medium">${escapeHtml(file.name)}</p>
                          <p class="text-[10px] text-muted-foreground">${file.type === 'IMAGE' ? '图片' : '视频'} · ${escapeHtml(file.uploadedAt)}</p>
                        </div>
                        <button
                          class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-muted"
                          data-pda-execd-action="remove-proof"
                          data-proof-id="${escapeHtml(file.id)}"
                          data-proof-scope="${scope}"
                        >
                          <i data-lucide="trash-2" class="h-3 w-3"></i>
                        </button>
                      </div>
                    `,
                  )
                  .join('')}
              </div>
            `
          : `
              <div class="flex items-center gap-1.5 py-0.5 text-xs text-muted-foreground">
                <i data-lucide="paperclip" class="h-3.5 w-3.5"></i>
                暂无凭证
              </div>
            `
      }
    </div>
  `
}

function renderProofViewSection(files: StartProofFile[]): string {
  if (files.length === 0) {
    return `
      <div class="flex items-center gap-1.5 py-1 text-xs text-muted-foreground">
        <i data-lucide="paperclip" class="h-3.5 w-3.5"></i>
        暂无凭证
      </div>
    `
  }

  return `
    <div class="space-y-1.5">
      <p class="text-xs font-medium text-muted-foreground">共 ${files.length} 个文件</p>
      ${files
        .map(
          (file) => `
            <div class="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
              <i data-lucide="${file.type === 'IMAGE' ? 'image' : 'video'}" class="h-4 w-4 shrink-0 ${file.type === 'IMAGE' ? 'text-blue-500' : 'text-purple-500'}"></i>
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs font-medium">${escapeHtml(file.name)}</p>
                <p class="text-[10px] text-muted-foreground">${file.type === 'IMAGE' ? '图片' : '视频'} · ${escapeHtml(file.uploadedAt)}</p>
              </div>
            </div>
          `,
        )
        .join('')}
    </div>
  `
}

function mutateStartTask(
  taskId: string,
  by: string,
  payload: { startTime: string; headcount: number; proofFiles: StartProofFile[] },
): void {
  const now = nowTimestamp()
  const task = getTaskFactById(taskId)
  if (!task) return

  const writableTask = task as ProcessTask & {
    startHeadcount?: number
    startProofFiles?: StartProofFile[]
  }

  task.status = 'IN_PROGRESS'
  task.startedAt = payload.startTime
  writableTask.startHeadcount = payload.headcount
  writableTask.startProofFiles = [...payload.proofFiles]
  task.updatedAt = now
  task.auditLogs = [
    ...task.auditLogs,
    {
      id: `AL-START-${Date.now()}`,
      action: 'START_TASK',
      detail: `任务开工，开工时间：${payload.startTime}，本次开工人数：${payload.headcount}，开工凭证：${payload.proofFiles.length}个`,
      at: now,
      by,
    },
  ]
}

function mutateFinishTask(taskId: string, by: string): void {
  const now = nowTimestamp()
  const task = getTaskFactById(taskId)
  if (!task) return

  task.status = 'DONE'
  task.finishedAt = now
  task.updatedAt = now
  task.auditLogs = [
    ...task.auditLogs,
    {
      id: `AL-FINISH-${Date.now()}`,
      action: 'FINISH_TASK',
      detail: '任务完工',
      at: now,
      by,
    },
  ]
}

function getTaskPricing(task: ProcessTask): {
  unitPrice?: number
  currency: string
  unit: string
  estimatedIncome?: number
} {
  const unitPrice =
    (task as ProcessTask & { directPrice?: number; awardedPrice?: number }).directPrice ||
    (task as ProcessTask & { directPrice?: number; awardedPrice?: number }).awardedPrice ||
    task.dispatchPrice

  const currency =
    (task as ProcessTask & { currency?: string }).currency ||
    task.dispatchPriceCurrency ||
    task.standardPriceCurrency ||
    'CNY'

  const unit = getQtyUnitLabel(task.dispatchPriceUnit || task.standardPriceUnit || task.qtyUnit)
  const estimatedIncome = unitPrice != null ? unitPrice * task.qty : undefined

  return { unitPrice, currency, unit, estimatedIncome }
}

export function renderPdaExecDetailPage(taskId: string): string {
  syncPdaStartRiskAndExceptions()
  syncMilestoneOverdueExceptions()

  const task = getTaskFactById(taskId)

  if (isCuttingSpecialTask(task)) {
    return renderPdaCuttingTaskDetailPage(taskId, { backHref: '/fcs/pda/exec' })
  }

  if (!task) {
    const content = `
      <div class="flex min-h-[760px] flex-col bg-background">
        <div class="p-4">
          <button class="inline-flex items-center rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted" data-pda-execd-action="back">
            <i data-lucide="arrow-left" class="mr-1 h-4 w-4"></i>
            返回
          </button>
        </div>
        <div class="flex flex-1 items-center justify-center text-sm text-muted-foreground">任务不存在</div>
      </div>
    `

    return renderPdaFrame(content, 'exec')
  }

  syncDialogStateWithQuery(task)

  const status = task.status || 'NOT_STARTED'
  const prereq = getStartPrerequisite(task)
  const deadline = getDeadlineStatus(
    (task as ProcessTask & { taskDeadline?: string }).taskDeadline,
    task.finishedAt,
  )

  const canStart = status === 'NOT_STARTED' && prereq.met
  const canFinish = status === 'IN_PROGRESS'
  const startDueInfo = getTaskStartDueInfo(task)
  const milestone = getTaskMilestoneState(task)
  const pauseHandleStatus = getPauseHandleStatus(task)
  const startDueAt = startDueInfo.startDueAt || '—'
  const startSourceText = formatStartDueSourceText(startDueInfo.startDueSource)
  const milestoneProofTitle =
    milestone.proofRequirement === 'NONE'
      ? '关键节点凭证（当前配置：不要求凭证）'
      : `关键节点凭证（当前配置：${milestone.proofRequirementLabel}）`
  const startRiskText =
    startDueInfo.startRiskStatus === 'OVERDUE'
      ? '开工已逾期'
      : startDueInfo.startRiskStatus === 'DUE_SOON' && typeof startDueInfo.remainingMs === 'number'
        ? `距开工时限不足 ${formatRemainingHours(startDueInfo.remainingMs)} 小时`
        : '开工时限正常'

  const statusLabelMap: Record<string, string> = {
    NOT_STARTED: '待开工',
    IN_PROGRESS: '进行中',
    BLOCKED: '生产暂停',
    DONE: '已完工',
    CANCELLED: '已取消',
  }

  const statusColorMap: Record<string, string> = {
    NOT_STARTED: 'bg-gray-100 text-gray-700',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    BLOCKED: 'bg-red-100 text-red-700',
    DONE: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-gray-100 text-gray-500',
  }

  const assignedFactory = task.assignedFactoryId
    ? indonesiaFactories.find((factory) => factory.id === task.assignedFactoryId)
    : undefined

  const handoutStatus =
    (task as ProcessTask & { handoutStatus?: 'PENDING' | 'HANDED_OUT' }).handoutStatus || 'PENDING'
  const handoutLabel = handoutStatus === 'HANDED_OUT' ? '已交出' : '待交出'
  const pauseReasonLabel = (task as ProcessTask & { pauseReasonLabel?: string | null }).pauseReasonLabel || ''
  const pauseReportedAt = (task as ProcessTask & { pauseReportedAt?: string | null }).pauseReportedAt || ''
  const displayProcessName = getTaskProcessDisplayName(task)
  const qtyDisplayMeta = resolveTaskQtyDisplayMeta(task, displayProcessName)

  const pricing = getTaskPricing(task)

  const content = `
    <div class="space-y-4 bg-background p-4 pb-6">
      <div class="flex items-center gap-2">
        <button class="inline-flex h-8 items-center rounded-md px-2 text-sm hover:bg-muted" data-pda-execd-action="back">
          <i data-lucide="arrow-left" class="mr-1 h-4 w-4"></i>
          返回
        </button>
        <h1 class="text-base font-semibold">执行详情</h1>
      </div>

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <div class="flex items-center justify-between gap-2 text-sm">
            <span class="font-mono font-semibold">${escapeHtml(getTaskDisplayNo(task))}</span>
            <span class="inline-flex items-center rounded px-2 py-0.5 text-xs ${statusColorMap[status] ?? 'bg-muted text-muted-foreground'}">${escapeHtml(statusLabelMap[status] ?? status)}</span>
          </div>
        </header>

        <div class="space-y-3 p-4 text-sm">
          <div class="grid grid-cols-2 gap-x-4 gap-y-1">
            <span class="text-xs text-muted-foreground">生产单号</span>
            <span class="text-xs font-medium">${escapeHtml(task.productionOrderId)}</span>
            <span class="text-xs text-muted-foreground">原始任务</span>
            <span class="text-xs font-medium">${escapeHtml(getRootTaskDisplayNo(task))}</span>
            <span class="text-xs text-muted-foreground">当前工序</span>
            <span class="text-xs font-medium">${escapeHtml(displayProcessName)}</span>
            <span class="text-xs text-muted-foreground">${escapeHtml(qtyDisplayMeta.label)}</span>
            <span class="text-xs font-medium">${escapeHtml(qtyDisplayMeta.valueText)}</span>
            ${
              assignedFactory
                ? `
                    <span class="text-xs text-muted-foreground">当前工厂</span>
                    <span class="text-xs font-medium">${escapeHtml(assignedFactory.name)}</span>
                  `
                : ''
            }
            <span class="text-xs text-muted-foreground">派发方式</span>
            <span class="text-xs">${task.assignmentMode === 'DIRECT' ? '直接派发' : '分配接收'}</span>
            ${
              (task as ProcessTask & { taskDeadline?: string }).taskDeadline
                ? `
                    <span class="text-xs text-muted-foreground">任务截止时间</span>
                    <span class="text-xs font-medium ${
                      deadline?.label === '执行逾期'
                        ? 'text-red-700'
                        : deadline?.label === '即将逾期'
                          ? 'text-amber-700'
                          : ''
                    }">${escapeHtml((task as ProcessTask & { taskDeadline?: string }).taskDeadline || '')}</span>
                  `
                : ''
            }
          </div>

          ${
            deadline
              ? `
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-muted-foreground">时限状态:</span>
                    <span class="inline-flex items-center rounded px-2 py-0.5 text-xs ${deadline.badgeClass}">${escapeHtml(deadline.label)}</span>
                  </div>
                `
              : ''
          }
        </div>
      </article>

      ${
        milestone.required
          ? `
              <article class="rounded-lg border bg-card">
                <header class="border-b px-4 py-3">
                  <h2 class="flex items-center gap-2 text-sm font-semibold">
                    <i data-lucide="flag" class="h-4 w-4"></i>
                    关键节点上报
                  </h2>
                </header>
                <div class="space-y-3 p-4 text-sm">
                  <div class="grid grid-cols-2 gap-x-4 gap-y-1">
                    <span class="text-xs text-muted-foreground">规则名称</span>
                    <span class="text-xs font-medium">${escapeHtml(milestone.ruleLabel)}</span>
                    <span class="text-xs text-muted-foreground">当前状态</span>
                    <span class="text-xs font-medium ${milestone.status === 'REPORTED' ? 'text-green-700' : 'text-amber-700'}">${milestone.status === 'REPORTED' ? '已上报' : '待上报'}</span>
                    <span class="text-xs text-muted-foreground">${escapeHtml(getReportedQtyLabel(milestone.targetUnitLabel))}</span>
                    <span class="text-xs">${escapeHtml(String(milestone.status === 'REPORTED' ? (milestone.reportedQty ?? milestone.targetQty) : milestone.targetQty))} ${escapeHtml(milestone.targetUnitLabel)}</span>
                    <span class="text-xs text-muted-foreground">上报时间</span>
                    <span class="text-xs">${escapeHtml(milestone.reportedAt || toStoreDateTime(detailState.milestoneTime) || '—')}</span>
                  </div>

                  ${
                    milestone.status === 'REPORTED'
                      ? `
                          <div class="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">关键节点已上报，可继续执行后续动作</div>
                          <div class="rounded-lg border">
                            <div class="border-b px-3 py-2 text-sm font-medium">关键节点凭证</div>
                            <div class="p-3">
                              ${renderProofViewSection(task.milestoneProofFiles || detailState.milestoneProofFiles)}
                            </div>
                          </div>
                        `
                      : status === 'IN_PROGRESS'
                        ? `
                            <div class="rounded-md border border-slate-200 bg-slate-50 p-3">
                              <label class="space-y-1">
                                <span class="text-xs text-muted-foreground">上报时间 *</span>
                                <input
                                  type="datetime-local"
                                  class="h-9 w-full rounded-md border bg-background px-3 text-sm"
                                  data-pda-execd-field="milestoneTime"
                                  value="${escapeHtml(detailState.milestoneTime)}"
                                />
                              </label>
                              <p class="mt-2 text-xs text-muted-foreground">上报数量按规则固定为 ${milestone.targetQty} ${escapeHtml(milestone.targetUnitLabel)}</p>
                            </div>
                            <div class="rounded-lg border">
                              <div class="border-b px-3 py-2 text-sm font-medium">${escapeHtml(milestoneProofTitle)}</div>
                              <div class="p-3">
                                ${renderProofUploadSection(detailState.milestoneProofFiles, 'milestone', getTaskMilestoneProofHint(task))}
                              </div>
                            </div>
                            <button
                              class="inline-flex h-9 w-full items-center justify-center rounded-md border bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90"
                              data-pda-execd-action="report-milestone"
                              data-task-id="${escapeHtml(task.taskId)}"
                            >
                              确认上报
                            </button>
                          `
                        : '<div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">任务不在进行中，暂不可上报关键节点</div>'
                  }
                </div>
              </article>
            `
          : ''
      }

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <i data-lucide="pause-circle" class="h-4 w-4"></i>
            上报暂停
          </h2>
        </header>

        <div class="space-y-3 p-4 text-sm">
          ${
            status === 'BLOCKED'
              ? `
                  <div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="font-medium text-red-700">${escapeHtml(pauseReasonLabel || '已上报暂停')}</span>
                      <span class="inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] ${pauseHandleStatus.className}">${pauseHandleStatus.label}</span>
                    </div>
                    ${task.pauseRemark ? `<p class="mt-1 text-red-600">${escapeHtml(task.pauseRemark)}</p>` : ''}
                    ${pauseReportedAt ? `<p class="mt-1 text-muted-foreground">上报时间：${escapeHtml(pauseReportedAt)}</p>` : ''}
                    <p class="mt-1 text-muted-foreground">平台允许继续前，当前任务不可继续操作</p>
                  </div>
                  <div class="rounded-lg border">
                    <div class="border-b px-3 py-2 text-sm font-medium">暂停凭证</div>
                    <div class="p-3">
                      ${renderProofViewSection(task.pauseProofFiles || detailState.pauseProofFiles)}
                    </div>
                  </div>
                `
              : status === 'IN_PROGRESS'
                ? `
                    ${
                      detailState.fromPauseAction
                        ? '<div class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">已定位到上报暂停，请补充信息后提交</div>'
                        : ''
                    }
                    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label class="space-y-1">
                        <span class="text-xs text-muted-foreground">暂停原因 *</span>
                        <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pda-execd-field="pauseReasonCode">
                          ${PAUSE_REASON_OPTIONS.map((item) => `<option value="${item.code}" ${detailState.pauseReasonCode === item.code ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}
                        </select>
                      </label>
                      <label class="space-y-1">
                        <span class="text-xs text-muted-foreground">上报时间 *</span>
                        <input
                          type="datetime-local"
                          class="h-9 w-full rounded-md border bg-background px-3 text-sm"
                          data-pda-execd-field="pauseTime"
                          value="${escapeHtml(detailState.pauseTime)}"
                        />
                      </label>
                    </div>
                    <label class="space-y-1">
                      <span class="text-xs text-muted-foreground">暂停说明</span>
                      <textarea
                        class="min-h-[88px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                        placeholder="建议填写现场情况，便于平台快速跟进"
                        data-pda-execd-field="pauseRemark"
                      >${escapeHtml(detailState.pauseRemark)}</textarea>
                    </label>
                    <div class="rounded-lg border">
                      <div class="border-b px-3 py-2 text-sm font-medium">相关凭证（至少 1 项）</div>
                      <div class="p-3">
                        ${renderProofUploadSection(detailState.pauseProofFiles, 'pause', '请上传现场凭证，图片或视频至少 1 项')}
                      </div>
                    </div>
                    <button
                      class="inline-flex h-9 w-full items-center justify-center rounded-md border bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90"
                      data-pda-execd-action="report-pause"
                      data-task-id="${escapeHtml(task.taskId)}"
                    >
                      确认上报暂停
                    </button>
                  `
                : '<div class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-muted-foreground">当前状态不支持上报暂停</div>'
          }
        </div>
      </article>

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <i data-lucide="shield-check" class="h-4 w-4"></i>
            执行前置信息
          </h2>
        </header>

        <div class="space-y-3 p-4 text-sm">
          <div class="grid grid-cols-2 gap-x-4 gap-y-1">
            <span class="text-xs text-muted-foreground">前置条件</span>
            <span class="text-xs font-medium">${escapeHtml(prereq.conditionLabel)}</span>
            <span class="text-xs text-muted-foreground">当前状态</span>
            <span class="text-xs font-medium ${prereq.met ? 'text-green-700' : 'text-amber-700'}">${escapeHtml(prereq.statusLabel)}</span>
            <span class="text-xs text-muted-foreground">来源方</span>
            <span class="text-xs">领料记录</span>
          </div>

          <div class="rounded-md border px-3 py-2.5 text-xs ${
            prereq.met
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-amber-200 bg-amber-50 text-amber-700'
          }">
            ${
              prereq.met
                ? '<div class="flex items-center gap-1.5 font-medium"><i data-lucide="check-circle" class="h-3.5 w-3.5"></i>已满足开工条件</div>'
                : `<div class="flex items-center gap-1.5 font-medium"><i data-lucide="alert-triangle" class="h-3.5 w-3.5"></i>${escapeHtml(prereq.blocker)}</div><p class="mt-1 pl-5 text-amber-600">${escapeHtml(prereq.hint)}</p>`
            }
          </div>

          ${
            !prereq.met
              ? `
                  <button class="inline-flex h-8 w-full items-center justify-center rounded-md border border-amber-300 text-sm text-amber-700 hover:bg-amber-50" data-pda-execd-action="go-handover" data-tab="pickup">
                    <i data-lucide="arrow-left-right" class="mr-2 h-3.5 w-3.5"></i>
                    去领料
                  </button>
                `
              : ''
          }
        </div>
      </article>

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <i data-lucide="clock" class="h-4 w-4"></i>
            开工信息
          </h2>
        </header>

        <div class="space-y-3 p-4 text-sm">
          <div class="grid grid-cols-2 gap-x-4 gap-y-1">
            <span class="text-xs text-muted-foreground">当前状态</span>
            <span class="inline-flex w-fit items-center rounded px-2 py-0.5 text-xs ${statusColorMap[status] ?? 'bg-muted text-muted-foreground'}">${escapeHtml(statusLabelMap[status] ?? status)}</span>
            <span class="text-xs text-muted-foreground">开工时限</span>
            <span class="text-xs font-medium ${startDueInfo.startRiskStatus === 'OVERDUE' ? 'text-red-700' : startDueInfo.startRiskStatus === 'DUE_SOON' ? 'text-amber-700' : ''}">${escapeHtml(startDueAt)}</span>
            <span class="text-xs text-muted-foreground">起算依据</span>
            <span class="text-xs">${escapeHtml(startSourceText)}</span>
            <span class="text-xs text-muted-foreground">时限状态</span>
            <span class="text-xs font-medium ${startDueInfo.startRiskStatus === 'OVERDUE' ? 'text-red-700' : startDueInfo.startRiskStatus === 'DUE_SOON' ? 'text-amber-700' : 'text-foreground'}">${escapeHtml(startRiskText)}</span>
            <span class="text-xs text-muted-foreground">开工时间</span>
            <span class="text-xs">${escapeHtml(task.startedAt || toStoreDateTime(detailState.startTime) || '—')}</span>
            <span class="text-xs text-muted-foreground">本次开工人数</span>
            <span class="text-xs">${escapeHtml(String((task as ProcessTask & { startHeadcount?: number }).startHeadcount || detailState.startHeadcount || '—'))}</span>
            <span class="text-xs text-muted-foreground">完工时间</span>
            <span class="text-xs">${escapeHtml(task.finishedAt || '—')}</span>
            ${
              status === 'DONE'
                ? `
                    <span class="text-xs text-muted-foreground">交接状态</span>
                    <span class="text-xs font-medium ${handoutStatus === 'HANDED_OUT' ? 'text-green-700' : 'text-amber-700'}">${handoutLabel}</span>
                  `
                : ''
            }
          </div>

          ${
            startDueInfo.startRiskStatus === 'OVERDUE'
              ? '<div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">开工已逾期，请立即补录开工信息</div>'
              : ''
          }

          ${
            task.blockReason
              ? `
                  <div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs">
                    <div class="flex items-center gap-1.5 font-medium text-red-700">
                      <i data-lucide="alert-triangle" class="h-3.5 w-3.5"></i>
                      已上报暂停：${escapeHtml((task as ProcessTask & { pauseReasonLabel?: string | null }).pauseReasonLabel || blockReasonLabel(task.blockReason))}
                    </div>
                    ${task.blockRemark ? `<p class="mt-1 pl-5 text-red-600">${escapeHtml(task.blockRemark)}</p>` : ''}
                    <p class="mt-1 pl-5 text-muted-foreground">平台允许继续前，当前任务不可继续操作</p>
                  </div>
                `
              : ''
          }

          ${
            status === 'NOT_STARTED'
              ? `
                  <div class="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label class="space-y-1">
                        <span class="text-xs text-muted-foreground">开工时间 *</span>
                        <input
                          type="datetime-local"
                          class="h-9 w-full rounded-md border bg-background px-3 text-sm"
                          data-pda-execd-field="startTime"
                          value="${escapeHtml(detailState.startTime)}"
                        />
                      </label>
                      <label class="space-y-1">
                        <span class="text-xs text-muted-foreground">本次开工人数 *</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          class="h-9 w-full rounded-md border bg-background px-3 text-sm"
                          data-pda-execd-field="startHeadcount"
                          value="${escapeHtml(detailState.startHeadcount)}"
                          placeholder="请输入人数"
                        />
                      </label>
                    </div>
                    <p class="mt-2 text-xs text-muted-foreground">车缝可按上车位人数填写；其他工序填写本次实际投入人数</p>
                  </div>
                  <div class="rounded-lg border">
                    <div class="border-b px-3 py-2 text-sm font-medium">开工凭证（选填）</div>
                    <div class="p-3">
                      ${renderProofUploadSection(detailState.startProofFiles, 'start', '可上传开工现场、物料到位、设备状态等证明材料，当前为选填')}
                    </div>
                  </div>
                `
              : `
                  <div class="rounded-lg border">
                    <div class="border-b px-3 py-2 text-sm font-medium">开工凭证</div>
                    <div class="p-3">
                      ${renderProofViewSection(detailState.startProofFiles)}
                    </div>
                  </div>
                `
          }
        </div>
      </article>

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <i data-lucide="coins" class="h-4 w-4"></i>
            金额情况
          </h2>
        </header>

        <div class="p-4 text-sm">
          <div class="grid grid-cols-2 gap-x-4 gap-y-1">
            <span class="text-xs text-muted-foreground">任务单价</span>
            <span class="text-xs font-medium">${
              pricing.unitPrice != null
                ? `${pricing.unitPrice.toLocaleString()} ${escapeHtml(pricing.currency)} / ${escapeHtml(pricing.unit)}`
                : '—'
            }</span>
            <span class="text-xs text-muted-foreground">预计收入</span>
            <span class="text-xs font-medium">${
              pricing.estimatedIncome != null
                ? `${pricing.estimatedIncome.toLocaleString()} ${escapeHtml(pricing.currency)}`
                : '—'
            }</span>
            <span class="text-xs text-muted-foreground">扣款状态</span>
            <span class="text-xs text-muted-foreground">暂无扣款记录</span>
            <span class="text-xs text-muted-foreground">结算状态</span>
            <span class="text-xs text-muted-foreground">待结算</span>
          </div>
        </div>
      </article>

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <h2 class="text-sm font-semibold">操作</h2>
        </header>

        <div class="space-y-2 p-4">
          ${
            status === 'NOT_STARTED'
              ? prereq.met
                ? `
                    <button
                      class="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                      data-pda-execd-action="confirm-start"
                      data-task-id="${escapeHtml(task.taskId)}"
                      ${canStart ? '' : 'disabled'}
                    >
                      <i data-lucide="play" class="mr-2 h-4 w-4"></i>
                      确认开工
                    </button>
                  `
                : `
                    <button class="inline-flex h-9 w-full items-center justify-center rounded-md border border-amber-300 text-sm text-amber-700 hover:bg-amber-50" data-pda-execd-action="go-handover" data-tab="pickup">
                      <i data-lucide="arrow-left-right" class="mr-2 h-4 w-4"></i>
                      去领料（有领料记录后即可开工）
                    </button>
                  `
              : ''
          }

          ${
            status === 'IN_PROGRESS'
              ? `
                  <div class="grid grid-cols-2 gap-2">
                    <button
                      class="inline-flex h-9 items-center justify-center rounded-md border text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                      data-pda-execd-action="report-pause-entry"
                    >
                      <i data-lucide="alert-triangle" class="mr-2 h-4 w-4"></i>
                      上报暂停
                    </button>
                    <button
                      class="inline-flex h-9 items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                      data-pda-execd-action="finish-task"
                      data-task-id="${escapeHtml(task.taskId)}"
                      ${canFinish ? '' : 'disabled'}
                    >
                      <i data-lucide="check-circle" class="mr-2 h-4 w-4"></i>
                      完工
                    </button>
                  </div>
                `
              : ''
          }

          ${
            status === 'BLOCKED'
              ? `
                  <div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">已上报暂停，待平台处理。平台允许继续后任务将自动恢复进行中。</div>
                `
              : ''
          }

          ${
            status === 'DONE'
              ? `
                  ${
                    handoutStatus !== 'HANDED_OUT'
                      ? '<div class="mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">完工不等于结束，还需完成交出交接</div>'
                      : ''
                  }
                  <button class="inline-flex h-9 w-full items-center justify-center rounded-md border text-sm hover:bg-muted" data-pda-execd-action="go-handover" data-tab="handout">
                    <i data-lucide="arrow-left-right" class="mr-2 h-4 w-4"></i>
                    去交接（待交出）
                  </button>
                `
              : ''
          }
        </div>
      </article>

      ${
        task.auditLogs.length > 0
          ? `
              <article class="rounded-lg border bg-card">
                <header class="border-b px-4 py-3">
                  <h2 class="flex items-center gap-2 text-sm font-semibold">
                    <i data-lucide="file-text" class="h-4 w-4"></i>
                    操作日志
                  </h2>
                </header>

                <div class="p-4">
                  <div class="max-h-[160px] space-y-2 overflow-y-auto">
                    ${task.auditLogs
                      .slice(-8)
                      .reverse()
                      .map(
                        (log) => `
                          <article class="border-b pb-1.5 text-xs last:border-b-0">
                            <div class="flex items-center justify-between">
                              <span class="font-medium">${escapeHtml(log.action)}</span>
                              <span class="text-muted-foreground">${escapeHtml(log.at)}</span>
                            </div>
                            ${log.detail ? `<p class="text-muted-foreground">${escapeHtml(log.detail)}</p>` : ''}
                          </article>
                        `,
                      )
                      .join('')}
                  </div>
                </div>
              </article>
            `
          : ''
      }
    </div>
  `

  return renderPdaFrame(content, 'exec')
}

export function handlePdaExecDetailEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pda-execd-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLSelectElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    const field = fieldNode.dataset.pdaExecdField
    if (!field) return true

    if (field === 'startTime' && fieldNode instanceof HTMLInputElement) {
      detailState.startTime = fieldNode.value
      return true
    }

    if (field === 'startHeadcount' && fieldNode instanceof HTMLInputElement) {
      detailState.startHeadcount = fieldNode.value
      return true
    }

    if (field === 'milestoneTime' && fieldNode instanceof HTMLInputElement) {
      detailState.milestoneTime = fieldNode.value
      return true
    }

    if (field === 'pauseReasonCode' && fieldNode instanceof HTMLSelectElement) {
      detailState.pauseReasonCode = fieldNode.value as PauseReasonCode
      return true
    }

    if (field === 'pauseRemark') {
      detailState.pauseRemark = fieldNode.value
      return true
    }

    if (field === 'pauseTime' && fieldNode instanceof HTMLInputElement) {
      detailState.pauseTime = fieldNode.value
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-execd-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pdaExecdAction
  if (!action) return false

  if (action === 'back') {
    appStore.navigate('/fcs/pda/exec')
    return true
  }

  if (action === 'go-handover') {
    const tab = actionNode.dataset.tab || 'pickup'
    appStore.navigate(`/fcs/pda/handover?tab=${tab}`)
    return true
  }

  if (action === 'add-proof-image') {
    const scope = (actionNode.dataset.proofScope as 'start' | 'milestone' | 'pause' | undefined) || 'start'
    addProofFile(scope, 'IMAGE')
    showPdaExecDetailToast('图片已添加')
    return true
  }

  if (action === 'add-proof-video') {
    const scope = (actionNode.dataset.proofScope as 'start' | 'milestone' | 'pause' | undefined) || 'start'
    addProofFile(scope, 'VIDEO')
    showPdaExecDetailToast('视频已添加')
    return true
  }

  if (action === 'remove-proof') {
    const proofId = actionNode.dataset.proofId
    const scope = (actionNode.dataset.proofScope as 'start' | 'milestone' | 'pause' | undefined) || 'start'
    if (proofId) {
      removeProofFile(scope, proofId)
    }
    return true
  }

  if (action === 'confirm-start') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true

    const task = getTaskFactById(taskId)
    if (!task) return true

    const prereq = getStartPrerequisite(task)

    if (!prereq.met) {
      showPdaExecDetailToast(`无法开工：${prereq.blocker}`)
      return true
    }

    if (!detailState.startTime) {
      showPdaExecDetailToast('请填写开工时间')
      return true
    }

    const startTime = toStoreDateTime(detailState.startTime)
    const startMs = parseDateMs(startTime)
    if (Number.isNaN(startMs) || startMs > Date.now()) {
      showPdaExecDetailToast('开工时间不能晚于当前时间')
      return true
    }

    const headcount = Number.parseInt(detailState.startHeadcount, 10)
    if (!Number.isInteger(headcount) || headcount <= 0) {
      showPdaExecDetailToast('请填写有效的本次开工人数')
      return true
    }

    mutateStartTask(taskId, 'PDA', {
      startTime,
      headcount,
      proofFiles: detailState.startProofFiles,
    })
    syncPdaStartRiskAndExceptions()
    syncMilestoneOverdueExceptions()
    showPdaExecDetailToast(
      detailState.startProofFiles.length > 0
        ? `开工成功，已上传 ${detailState.startProofFiles.length} 个开工凭证`
        : '开工成功',
    )
    return true
  }

  if (action === 'report-milestone') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true

    const task = getTaskFactById(taskId)
    if (!task) return true

    if (!detailState.milestoneTime) {
      showPdaExecDetailToast('请填写关键节点上报时间')
      return true
    }

    const reportAt = toStoreDateTime(detailState.milestoneTime)
    const reportMs = parseDateMs(reportAt)
    if (Number.isNaN(reportMs) || reportMs > Date.now()) {
      showPdaExecDetailToast('上报时间不能晚于当前时间')
      return true
    }

    if (!isTaskMilestoneProofSatisfied(task, detailState.milestoneProofFiles)) {
      const milestone = getTaskMilestoneState(task)
      const proofHint =
        milestone.proofRequirement === 'IMAGE'
          ? '请至少上传 1 项关键节点图片凭证'
          : milestone.proofRequirement === 'VIDEO'
            ? '请至少上传 1 项关键节点视频凭证'
            : '请至少上传 1 项关键节点凭证（图片或视频任选其一）'
      showPdaExecDetailToast(proofHint)
      return true
    }

    const result = reportTaskMilestone(taskId, {
      reportedAt: reportAt,
      proofFiles: detailState.milestoneProofFiles,
      by: 'PDA',
    })
    showPdaExecDetailToast(result.message)
    return true
  }

  if (action === 'report-pause-entry') {
    detailState.fromPauseAction = true
    showPdaExecDetailToast('请在“上报暂停”区块补充信息后提交')
    return true
  }

  if (action === 'report-pause') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true

    if (!detailState.pauseTime) {
      showPdaExecDetailToast('请填写暂停上报时间')
      return true
    }

    const reportAt = toStoreDateTime(detailState.pauseTime)
    const reportMs = parseDateMs(reportAt)
    if (Number.isNaN(reportMs) || reportMs > Date.now()) {
      showPdaExecDetailToast('上报时间不能晚于当前时间')
      return true
    }

    if (detailState.pauseProofFiles.length < 1) {
      showPdaExecDetailToast('请至少上传 1 项暂停凭证')
      return true
    }

    const result = reportTaskPause(taskId, {
      reasonCode: detailState.pauseReasonCode,
      remark: detailState.pauseRemark.trim(),
      reportedAt: reportAt,
      proofFiles: detailState.pauseProofFiles,
      by: 'PDA',
    })
    if (result.ok) {
      detailState.fromPauseAction = false
    }
    showPdaExecDetailToast(result.message)
    return true
  }

  if (action === 'finish-task') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true

    const task = getTaskFactById(taskId)
    if (!task) return true

    if (!isTaskMilestoneReported(task)) {
      showPdaExecDetailToast('请先完成关键节点上报')
      return true
    }

    mutateFinishTask(taskId, 'PDA')
    showPdaExecDetailToast('完工成功，请前往交接模块完成交出')
    return true
  }

  return false
}
