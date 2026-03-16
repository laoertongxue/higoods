import { appStore } from '../state/store'
import { escapeHtml, toClassName } from '../utils'
import { processTasks, type BlockReason, type ProcessTask } from '../data/fcs/process-tasks'
import { indonesiaFactories } from '../data/fcs/indonesia-factories'
import { renderPdaFrame } from './pda-shell'

interface PdaExecDetailState {
  showBlockDialog: boolean
  showUnblockDialog: boolean
  blockReason: BlockReason
  blockRemark: string
  unblockRemark: string
  initializedPathKey: string
  proofTaskId: string
  proofFiles: ProofFile[]
}

const detailState: PdaExecDetailState = {
  showBlockDialog: false,
  showUnblockDialog: false,
  blockReason: 'OTHER',
  blockRemark: '',
  unblockRemark: '',
  initializedPathKey: '',
  proofTaskId: '',
  proofFiles: [],
}

interface ProofFile {
  id: string
  type: 'IMAGE' | 'VIDEO'
  name: string
  uploadedAt: string
}

const BLOCK_REASON_OPTIONS: Array<{ value: BlockReason; label: string }> = [
  { value: 'MATERIAL', label: '物料' },
  { value: 'CAPACITY', label: '产能/排期' },
  { value: 'QUALITY', label: '质量处理' },
  { value: 'TECH', label: '工艺/技术资料' },
  { value: 'EQUIPMENT', label: '设备' },
  { value: 'OTHER', label: '其他' },
]

const MOCK_START_PROOF: Record<string, ProofFile[]> = {
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

function syncDialogStateWithQuery(taskId: string): void {
  const pathname = appStore.getState().pathname
  const key = `${taskId}|${pathname}`

  if (detailState.initializedPathKey === key) return
  detailState.initializedPathKey = key

  const action = getCurrentSearchParams().get('action')
  detailState.showBlockDialog = action === 'block'
  detailState.showUnblockDialog = action === 'unblock'
  detailState.blockReason = 'OTHER'
  detailState.blockRemark = ''
  detailState.unblockRemark = ''

  if (detailState.proofTaskId !== taskId) {
    detailState.proofTaskId = taskId
    detailState.proofFiles = []
  }
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function parseDateMs(value: string): number {
  return new Date(value.replace(' ', 'T')).getTime()
}

function getCurrentFactoryId(): string {
  if (typeof window === 'undefined') return 'ID-F001'

  try {
    const localFactoryId = window.localStorage.getItem('fcs_pda_factory_id')
    if (localFactoryId) return localFactoryId

    const rawSession = window.localStorage.getItem('fcs_pda_session')
    if (rawSession) {
      const parsed = JSON.parse(rawSession) as { factoryId?: string }
      if (parsed.factoryId) return parsed.factoryId
    }
  } catch {
    // ignore parse errors
  }

  return 'ID-F001'
}

function getFactoryName(factoryId: string): string {
  const factory = indonesiaFactories.find((item) => item.id === factoryId)
  return factory?.name ?? factoryId
}

function blockReasonLabel(reason: BlockReason | string | undefined): string {
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

function getPrerequisite(
  seq: number,
  handoverStatus?: string,
): {
  type: 'PICKUP' | 'RECEIVE'
  isFirst: boolean
  met: boolean
  conditionLabel: string
  statusLabel: string
  blocker: string
  fromLabel: string
  hint: string
} {
  const isFirst = seq === 1

  if (isFirst) {
    const met = handoverStatus === 'PICKED_UP'
    return {
      type: 'PICKUP',
      isFirst,
      met,
      conditionLabel: '领料完成',
      statusLabel: met ? '已领料' : '待领料',
      blocker: '未完成领料，暂不可开工',
      fromLabel: '来源方：仓库',
      hint: '领料完成后才可开工',
    }
  }

  const met = handoverStatus === 'RECEIVED'
  return {
    type: 'RECEIVE',
    isFirst,
    met,
    conditionLabel: '接收完成',
    statusLabel: met ? '已接收' : '待接收',
    blocker: '未完成接收，暂不可开工',
    fromLabel: '来源方：上一道工序工厂',
    hint: '接收完成后才可开工',
  }
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

function addProofFile(type: 'IMAGE' | 'VIDEO'): void {
  const ext = type === 'IMAGE' ? 'jpg' : 'mp4'
  const label = type === 'IMAGE' ? '图片' : '视频'
  const index = detailState.proofFiles.length + 1
  detailState.proofFiles = [
    ...detailState.proofFiles,
    {
      id: `sp-new-${Date.now()}`,
      type,
      name: `开工${label}_${String(index).padStart(2, '0')}.${ext}`,
      uploadedAt: nowDisplayTimestamp(),
    },
  ]
}

function removeProofFile(id: string): void {
  detailState.proofFiles = detailState.proofFiles.filter((item) => item.id !== id)
}

function renderProofUploadSection(files: ProofFile[]): string {
  return `
    <div class="space-y-3">
      <p class="text-xs leading-relaxed text-muted-foreground">可上传开工现场、物料到位、设备状态等证明材料，当前为选填</p>
      <div class="flex gap-2">
        <button
          type="button"
          class="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-dashed text-xs hover:bg-muted"
          data-pda-execd-action="add-proof-image"
        >
          <i data-lucide="image" class="h-3.5 w-3.5 text-blue-500"></i>
          上传图片
        </button>
        <button
          type="button"
          class="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-dashed text-xs hover:bg-muted"
          data-pda-execd-action="add-proof-video"
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
                暂无凭证，可直接提交
              </div>
            `
      }
    </div>
  `
}

function renderProofViewSection(files: ProofFile[]): string {
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

function mutateStartTask(taskId: string, by: string): void {
  const now = nowTimestamp()
  const task = processTasks.find((item) => item.taskId === taskId)
  if (!task) return

  task.status = 'IN_PROGRESS'
  task.startedAt = now
  task.updatedAt = now
  task.auditLogs = [
    ...task.auditLogs,
    {
      id: `AL-START-${Date.now()}`,
      action: 'START_TASK',
      detail: '任务开工',
      at: now,
      by,
    },
  ]
}

function mutateFinishTask(taskId: string, by: string): void {
  const now = nowTimestamp()
  const task = processTasks.find((item) => item.taskId === taskId)
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

function mutateBlockTask(taskId: string, reason: BlockReason, remark: string, by: string): void {
  const now = nowTimestamp()
  const task = processTasks.find((item) => item.taskId === taskId)
  if (!task) return

  task.status = 'BLOCKED'
  task.blockReason = reason
  task.blockRemark = remark
  task.blockedAt = now
  task.updatedAt = now
  task.auditLogs = [
    ...task.auditLogs,
    {
      id: `AL-BLOCK-${Date.now()}`,
      action: 'BLOCK_TASK',
      detail: `标记暂不能继续，原因：${reason}，备注：${remark || '-'}`,
      at: now,
      by,
    },
  ]
}

function mutateUnblockTask(taskId: string, remark: string, by: string): void {
  const now = nowTimestamp()
  const task = processTasks.find((item) => item.taskId === taskId)
  if (!task) return

  task.status = 'IN_PROGRESS'
  task.blockReason = undefined
  task.blockRemark = undefined
  task.blockedAt = undefined
  task.updatedAt = now
  task.auditLogs = [
    ...task.auditLogs,
    {
      id: `AL-UNBLOCK-${Date.now()}`,
      action: 'UNBLOCK_TASK',
      detail: `恢复执行，备注：${remark || '-'}`,
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

  const unit = task.dispatchPriceUnit || task.standardPriceUnit || task.qtyUnit
  const estimatedIncome = unitPrice != null ? unitPrice * task.qty : undefined

  return { unitPrice, currency, unit, estimatedIncome }
}

function renderBlockDialog(taskId: string): string {
  if (!detailState.showBlockDialog) return ''

  return `
    <div class="fixed inset-0 z-[120] bg-black/35" data-pda-execd-action="close-block"></div>
    <div class="fixed inset-0 z-[121] flex items-center justify-center p-4">
      <article class="w-full max-w-sm rounded-lg border bg-background shadow-lg">
        <header class="border-b px-4 py-3">
          <h3 class="text-base font-semibold">标记暂不能继续</h3>
        </header>

        <div class="space-y-4 px-4 py-3">
          <div class="space-y-2">
            <label class="text-sm font-medium">当前无法继续的原因 *</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pda-execd-field="blockReason">
              ${BLOCK_REASON_OPTIONS.map(
                (opt) =>
                  `<option value="${opt.value}" ${detailState.blockReason === opt.value ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`,
              ).join('')}
            </select>
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium">备注</label>
            <textarea
              class="min-h-[88px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="请输入备注（可选）"
              data-pda-execd-field="blockRemark"
            >${escapeHtml(detailState.blockRemark)}</textarea>
          </div>
        </div>

        <footer class="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pda-execd-action="close-block">取消</button>
          <button
            class="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            data-pda-execd-action="confirm-block"
            data-task-id="${escapeHtml(taskId)}"
          >确认</button>
        </footer>
      </article>
    </div>
  `
}

function renderUnblockDialog(taskId: string): string {
  if (!detailState.showUnblockDialog) return ''

  return `
    <div class="fixed inset-0 z-[120] bg-black/35" data-pda-execd-action="close-unblock"></div>
    <div class="fixed inset-0 z-[121] flex items-center justify-center p-4">
      <article class="w-full max-w-sm rounded-lg border bg-background shadow-lg">
        <header class="border-b px-4 py-3">
          <h3 class="text-base font-semibold">恢复执行</h3>
        </header>

        <div class="space-y-2 px-4 py-3">
          <label class="text-sm font-medium">解除备注</label>
          <textarea
            class="min-h-[88px] w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="请输入解除备注（可选）"
            data-pda-execd-field="unblockRemark"
          >${escapeHtml(detailState.unblockRemark)}</textarea>
        </div>

        <footer class="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pda-execd-action="close-unblock">取消</button>
          <button
            class="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            data-pda-execd-action="confirm-unblock"
            data-task-id="${escapeHtml(taskId)}"
          >确认</button>
        </footer>
      </article>
    </div>
  `
}

export function renderPdaExecDetailPage(taskId: string): string {
  syncDialogStateWithQuery(taskId)

  const task = processTasks.find((item) => item.taskId === taskId)

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

  const status = task.status || 'NOT_STARTED'
  const prereq = getPrerequisite(
    task.seq,
    (task as ProcessTask & { handoverStatus?: string }).handoverStatus,
  )
  const deadline = getDeadlineStatus(
    (task as ProcessTask & { taskDeadline?: string }).taskDeadline,
    task.finishedAt,
  )

  const canStart = status === 'NOT_STARTED' && prereq.met
  const canFinish = status === 'IN_PROGRESS'
  const canBlock = status !== 'DONE' && status !== 'CANCELLED'
  const canUnblock = status === 'BLOCKED'

  const statusLabelMap: Record<string, string> = {
    NOT_STARTED: '待开工',
    IN_PROGRESS: '进行中',
    BLOCKED: '暂不能继续',
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
            <span class="font-mono font-semibold">${escapeHtml(task.taskId)}</span>
            <span class="inline-flex items-center rounded px-2 py-0.5 text-xs ${statusColorMap[status] ?? 'bg-muted text-muted-foreground'}">${escapeHtml(statusLabelMap[status] ?? status)}</span>
          </div>
        </header>

        <div class="space-y-3 p-4 text-sm">
          <div class="grid grid-cols-2 gap-x-4 gap-y-1">
            <span class="text-xs text-muted-foreground">生产单号</span>
            <span class="text-xs font-medium">${escapeHtml(task.productionOrderId)}</span>
            <span class="text-xs text-muted-foreground">当前工序</span>
            <span class="text-xs font-medium">${escapeHtml(task.processNameZh)}</span>
            <span class="text-xs text-muted-foreground">工序代码</span>
            <span class="font-mono text-xs">${escapeHtml(task.processCode)}</span>
            <span class="text-xs text-muted-foreground">数量</span>
            <span class="text-xs font-medium">${task.qty} ${escapeHtml(task.qtyUnit)}</span>
            ${
              assignedFactory
                ? `
                    <span class="text-xs text-muted-foreground">当前工厂</span>
                    <span class="text-xs font-medium">${escapeHtml(assignedFactory.name)}</span>
                  `
                : ''
            }
            <span class="text-xs text-muted-foreground">任务来源</span>
            <span class="text-xs">${task.assignmentMode === 'DIRECT' ? '直接派单' : '已中标'}</span>
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

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <i data-lucide="shield-check" class="h-4 w-4"></i>
            执行前置信息
          </h2>
        </header>

        <div class="space-y-3 p-4 text-sm">
          <div class="grid grid-cols-2 gap-x-4 gap-y-1">
            <span class="text-xs text-muted-foreground">工序位置</span>
            <span class="text-xs font-medium">${prereq.isFirst ? '首道工序' : '非首道工序'}</span>
            <span class="text-xs text-muted-foreground">前置条件</span>
            <span class="text-xs font-medium">${escapeHtml(prereq.conditionLabel)}</span>
            <span class="text-xs text-muted-foreground">当前状态</span>
            <span class="text-xs font-medium ${prereq.met ? 'text-green-700' : 'text-amber-700'}">${escapeHtml(prereq.statusLabel)}</span>
            <span class="text-xs text-muted-foreground">来源方</span>
            <span class="text-xs">${escapeHtml(prereq.fromLabel.replace('来源方：', ''))}</span>
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
                  <button class="inline-flex h-8 w-full items-center justify-center rounded-md border border-amber-300 text-sm text-amber-700 hover:bg-amber-50" data-pda-execd-action="go-handover" data-tab="${prereq.isFirst ? 'pickup' : 'receive'}">
                    <i data-lucide="arrow-left-right" class="mr-2 h-3.5 w-3.5"></i>
                    去交接
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
            执行信息
          </h2>
        </header>

        <div class="space-y-3 p-4 text-sm">
          <div class="grid grid-cols-2 gap-x-4 gap-y-1">
            <span class="text-xs text-muted-foreground">当前状态</span>
            <span class="inline-flex w-fit items-center rounded px-2 py-0.5 text-xs ${statusColorMap[status] ?? 'bg-muted text-muted-foreground'}">${escapeHtml(statusLabelMap[status] ?? status)}</span>
            <span class="text-xs text-muted-foreground">开工时间</span>
            <span class="text-xs">${escapeHtml(task.startedAt || '—')}</span>
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
            task.blockReason
              ? `
                  <div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs">
                    <div class="flex items-center gap-1.5 font-medium text-red-700">
                      <i data-lucide="alert-triangle" class="h-3.5 w-3.5"></i>
                      当前无法继续的原因：${escapeHtml(blockReasonLabel(task.blockReason))}
                    </div>
                    ${task.blockRemark ? `<p class="mt-1 pl-5 text-red-600">${escapeHtml(task.blockRemark)}</p>` : ''}
                  </div>
                `
              : ''
          }
        </div>
      </article>

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <i data-lucide="coins" class="h-4 w-4"></i>
            金额摘要
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

      ${
        status === 'NOT_STARTED' && prereq.met
          ? `
              <article class="rounded-lg border bg-card">
                <header class="border-b px-4 py-3">
                  <h2 class="flex items-center justify-between text-sm font-semibold">
                    <span class="flex items-center gap-1.5">
                      <i data-lucide="paperclip" class="h-4 w-4 text-muted-foreground"></i>
                      开工凭证（选填）
                    </span>
                    <span class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">选填</span>
                  </h2>
                </header>
                <div class="p-4 pt-3">
                  ${renderProofUploadSection(detailState.proofFiles)}
                </div>
              </article>
            `
          : ''
      }

      ${
        status === 'IN_PROGRESS' || status === 'DONE' || status === 'BLOCKED'
          ? `
              <article class="rounded-lg border bg-card">
                <header class="border-b px-4 py-3">
                  <h2 class="flex items-center gap-1.5 text-sm font-semibold">
                    <i data-lucide="paperclip" class="h-4 w-4 text-muted-foreground"></i>
                    开工凭证
                  </h2>
                </header>
                <div class="p-4 pt-3">
                  ${renderProofViewSection(MOCK_START_PROOF[taskId] || [])}
                </div>
              </article>
            `
          : ''
      }

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
                      data-pda-execd-action="start-task"
                      data-task-id="${escapeHtml(task.taskId)}"
                      ${canStart ? '' : 'disabled'}
                    >
                      <i data-lucide="play" class="mr-2 h-4 w-4"></i>
                      开工
                    </button>
                  `
                : `
                    <button class="inline-flex h-9 w-full items-center justify-center rounded-md border border-amber-300 text-sm text-amber-700 hover:bg-amber-50" data-pda-execd-action="go-handover" data-tab="${prereq.isFirst ? 'pickup' : 'receive'}">
                      <i data-lucide="arrow-left-right" class="mr-2 h-4 w-4"></i>
                      去交接（完成前置后方可开工）
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
                      data-pda-execd-action="open-block"
                      ${canBlock ? '' : 'disabled'}
                    >
                      <i data-lucide="alert-triangle" class="mr-2 h-4 w-4"></i>
                      标记暂不能继续
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
                  <button
                    class="inline-flex h-9 w-full items-center justify-center rounded-md border text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                    data-pda-execd-action="open-unblock"
                    ${canUnblock ? '' : 'disabled'}
                  >
                    <i data-lucide="check-circle" class="mr-2 h-4 w-4"></i>
                    恢复执行
                  </button>
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

      ${renderBlockDialog(task.taskId)}
      ${renderUnblockDialog(task.taskId)}
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

    if (field === 'blockReason' && fieldNode instanceof HTMLSelectElement) {
      detailState.blockReason = fieldNode.value as BlockReason
      return true
    }

    if (field === 'blockRemark') {
      detailState.blockRemark = fieldNode.value
      return true
    }

    if (field === 'unblockRemark') {
      detailState.unblockRemark = fieldNode.value
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-execd-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pdaExecdAction
  if (!action) return false

  if (action === 'back') {
    detailState.showBlockDialog = false
    detailState.showUnblockDialog = false
    appStore.navigate('/fcs/pda/exec')
    return true
  }

  if (action === 'go-handover') {
    const tab = actionNode.dataset.tab || 'pickup'
    appStore.navigate(`/fcs/pda/handover?tab=${tab}`)
    return true
  }

  if (action === 'add-proof-image') {
    addProofFile('IMAGE')
    showPdaExecDetailToast('图片已添加')
    return true
  }

  if (action === 'add-proof-video') {
    addProofFile('VIDEO')
    showPdaExecDetailToast('视频已添加')
    return true
  }

  if (action === 'remove-proof') {
    const proofId = actionNode.dataset.proofId
    if (proofId) {
      removeProofFile(proofId)
    }
    return true
  }

  if (action === 'start-task') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true

    const task = processTasks.find((item) => item.taskId === taskId)
    if (!task) return true

    const prereq = getPrerequisite(
      task.seq,
      (task as ProcessTask & { handoverStatus?: string }).handoverStatus,
    )

    if (!prereq.met) {
      showPdaExecDetailToast(`无法开工：${prereq.blocker}`)
      return true
    }

    mutateStartTask(taskId, 'PDA')
    showPdaExecDetailToast(
      detailState.proofFiles.length > 0
        ? `开工成功，已上传 ${detailState.proofFiles.length} 个开工凭证`
        : '开工成功',
    )
    return true
  }

  if (action === 'finish-task') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true

    mutateFinishTask(taskId, 'PDA')
    showPdaExecDetailToast('完工成功，请前往交接模块完成交出')
    return true
  }

  if (action === 'open-block') {
    detailState.showBlockDialog = true
    return true
  }

  if (action === 'close-block') {
    detailState.showBlockDialog = false
    return true
  }

  if (action === 'confirm-block') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true

    mutateBlockTask(taskId, detailState.blockReason, detailState.blockRemark, 'PDA')
    detailState.showBlockDialog = false
    detailState.blockRemark = ''
    detailState.blockReason = 'OTHER'
    showPdaExecDetailToast('已标记暂不能继续')
    return true
  }

  if (action === 'open-unblock') {
    detailState.showUnblockDialog = true
    return true
  }

  if (action === 'close-unblock') {
    detailState.showUnblockDialog = false
    return true
  }

  if (action === 'confirm-unblock') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true

    mutateUnblockTask(taskId, detailState.unblockRemark, 'PDA')
    detailState.showUnblockDialog = false
    detailState.unblockRemark = ''
    showPdaExecDetailToast('已恢复执行')
    return true
  }

  return false
}
