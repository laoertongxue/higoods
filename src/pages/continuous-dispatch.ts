import {
  applyRuntimeDirectDispatchMeta,
  getRuntimeTaskById,
  listRuntimeProcessTasks,
  setRuntimeTaskAssignMode,
  upsertRuntimeTaskTender,
  type RuntimeProcessTask,
} from '../data/fcs/runtime-process-tasks.ts'
import { productionOrders } from '../data/fcs/production-orders.ts'
import { listBusinessFactoryMasterRecords } from '../data/fcs/factory-master-store.ts'
import {
  classifySewingDeliverySla,
  createSewingDeliverySlaSnapshot,
  dateTimeLocalToOperationWallClock,
  formatOperationLocalWallClock,
  operationWallClockToDateTimeLocal,
} from '../data/fcs/sewing-delivery-sla.ts'
import {
  PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE,
  renderProductionOrderIdentityCell,
} from '../data/fcs/production-order-identity.ts'
import { renderTablePagination } from '../components/ui/pagination.ts'
import { escapeHtml, toClassName } from '../utils.ts'

type ContinuousDispatchTab = 'SEWING_POST' | 'OTHER'
type ContinuousDispatchDialogMode = 'DIRECT' | 'BIDDING'
type ContinuousDispatchMainFactoryChoice = 'CURRENT' | 'SELECTED'

interface ContinuousDispatchDialogDraft {
  mode: ContinuousDispatchDialogMode
  taskId: string
  factoryId: string
  businessAssignedAt: string
  operatedAt: string
  biddingDeadline: string
  mainFactoryChoice: ContinuousDispatchMainFactoryChoice
  error: string
}

export interface ContinuousDispatchState {
  tab: ContinuousDispatchTab
  keyword: string
  feedback: string
  currentPage: number
  pageSize: number
  dialog: ContinuousDispatchDialogDraft | null
}

const state: ContinuousDispatchState = {
  tab: 'SEWING_POST',
  keyword: '',
  feedback: '',
  currentPage: 1,
  pageSize: 10,
  dialog: null,
}

export function captureContinuousDispatchPageState(): ContinuousDispatchState {
  return structuredClone(state)
}

export function restoreContinuousDispatchPageState(snapshot: ContinuousDispatchState): void {
  Object.assign(state, structuredClone(snapshot))
}

export function closeContinuousDispatchDialog(): void {
  state.dialog = null
  refreshDialogHost()
}

const CONTINUOUS_DISPATCH_PAGE_SIZE_OPTIONS = [10, 20, 50] as const

const assignmentStatusLabel: Record<RuntimeProcessTask['assignmentStatus'], string> = {
  UNASSIGNED: '待分配',
  ASSIGNING: '分配中',
  ASSIGNED: '已分配',
  BIDDING: '招标中',
  AWARDED: '已中标',
}

const executionStatusLabel: Record<RuntimeProcessTask['status'], string> = {
  NOT_STARTED: '未开工',
  IN_PROGRESS: '执行中',
  DONE: '已完工',
  BLOCKED: '暂停',
  CANCELLED: '已取消',
}

function getAssignableFactories() {
  return listBusinessFactoryMasterRecords({ includeTestFactories: false })
}

function getDialogTask(): RuntimeProcessTask | null {
  return state.dialog ? getRuntimeTaskById(state.dialog.taskId) : null
}

function containsSewing(task: RuntimeProcessTask): boolean {
  return task.processCode === 'SEW'
    || task.processNameZh === '车缝'
    || (task.coveredProcesses ?? []).some((process) => process.processCode === 'SEW' || process.processName === '车缝')
}

function isAssignableContinuousTask(task: RuntimeProcessTask): boolean {
  return task.taskUnitType === 'COMBINED_PROCESS_TASK'
    && task.acceptanceMode === 'CONTINUOUS_PROCESS'
    && task.assignmentStatus === 'UNASSIGNED'
}

function openDispatchDialog(mode: ContinuousDispatchDialogMode, taskId: string): void {
  const task = getRuntimeTaskById(taskId)
  if (!task || !isAssignableContinuousTask(task)) return
  const operatedAt = formatOperationLocalWallClock()
  const order = getTaskOrder(task)
  const hasValidCurrentMainFactory = Boolean(
    order?.sewingFactorySnapshots?.some((factory) => factory.id === order.mainFactoryId),
  )
  state.dialog = {
    mode,
    taskId,
    factoryId: '',
    businessAssignedAt: operationWallClockToDateTimeLocal(operatedAt),
    operatedAt,
    biddingDeadline: '',
    mainFactoryChoice: hasValidCurrentMainFactory ? 'CURRENT' : 'SELECTED',
    error: '',
  }
}

function refreshDialogHost(): void {
  if (typeof document === 'undefined') return
  const host = document.querySelector<HTMLElement>('[data-continuous-dispatch-dialog-host]')
  if (!host) return
  host.innerHTML = renderDispatchDialog()
}

function renderMilestonePreview(task: RuntimeProcessTask, businessAssignedAt: string): string {
  const slaKind = classifySewingDeliverySla(task)
  if (!slaKind) {
    return `
      <div class="grid gap-2 sm:grid-cols-3">
        ${['30% 节点', '70% 节点', '100% 节点'].map((label) => `
          <div class="rounded-md border bg-muted/20 p-2 text-xs">
            <div class="text-muted-foreground">${label}</div>
            <div class="mt-1 font-medium">不适用含车缝交付时效</div>
          </div>
        `).join('')}
      </div>
    `
  }

  try {
    const snapshot = createSewingDeliverySlaSnapshot({
      assignmentId: 'CONTINUOUS-DISPATCH-PREVIEW',
      runtimeTaskId: task.taskId,
      productionOrderId: task.productionOrderId,
      factoryId: state.dialog?.factoryId || 'PREVIEW-FACTORY',
      factoryName: '预览工厂',
      assignedQty: task.scopeQty,
      acceptedAt: dateTimeLocalToOperationWallClock(businessAssignedAt),
      slaKind,
    })
    return `
      <div class="grid gap-2 sm:grid-cols-3">
        ${snapshot.milestones.map((milestone) => `
          <div class="rounded-md border bg-blue-50/40 p-2 text-xs">
            <div class="text-muted-foreground">${Math.round(milestone.ratio * 100)}% 节点</div>
            <div class="mt-1 font-medium">${escapeHtml(milestone.deadlineAt)}</div>
            <div class="mt-1 text-muted-foreground">应累计实收 ${milestone.targetQty.toLocaleString()} 件</div>
          </div>
        `).join('')}
      </div>
    `
  } catch {
    return '<div class="text-xs text-amber-700">请先填写有效的业务分配时间，再查看 30% / 70% / 100% 节点。</div>'
  }
}

function renderDispatchDialog(): string {
  const dialog = state.dialog
  const task = getDialogTask()
  if (!dialog || !task) return ''

  const order = getTaskOrder(task)
  const factories = getAssignableFactories()
  const selectedFactory = factories.find((factory) => factory.id === dialog.factoryId)
  const direct = dialog.mode === 'DIRECT'
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button type="button" class="absolute inset-0 bg-slate-900/40" data-skip-page-rerender="true" data-continuous-dispatch-action="close-dialog" aria-label="关闭分配弹窗"></button>
      <section class="relative z-10 max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-lg border bg-background shadow-xl">
        <header class="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 class="text-lg font-semibold">${direct ? '直接派单' : '发起竞价'}</h2>
            <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(task.taskNo || task.taskId)}｜仅按整任务范围分配</p>
          </div>
          <button type="button" class="h-9 rounded-md border px-3 text-sm" data-skip-page-rerender="true" data-continuous-dispatch-action="close-dialog">关闭</button>
        </header>
        <div class="space-y-4 px-5 py-4">
          ${dialog.error ? `<div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">${escapeHtml(dialog.error)}</div>` : ''}
          <div class="inline-flex rounded-md border bg-muted/20 p-1 text-sm">
            <button type="button" class="rounded px-3 py-1.5 ${direct ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground'}" data-skip-page-rerender="true" data-continuous-dispatch-action="switch-dialog-mode" data-mode="DIRECT">直接派单</button>
            <button type="button" class="rounded px-3 py-1.5 ${direct ? 'text-muted-foreground' : 'bg-background font-medium shadow-sm'}" data-skip-page-rerender="true" data-continuous-dispatch-action="switch-dialog-mode" data-mode="BIDDING">发起竞价</button>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="space-y-1 text-sm">
              <span class="text-muted-foreground">业务分配时间</span>
              <input type="datetime-local" class="h-9 w-full rounded-md border px-3" value="${escapeHtml(dialog.businessAssignedAt)}" data-skip-page-rerender="true" data-continuous-dispatch-field="businessAssignedAt" />
              <span class="block text-xs text-muted-foreground">可回填，但不能晚于实际操作时间 ${escapeHtml(dialog.operatedAt)}</span>
            </label>
            <div class="rounded-md border bg-muted/20 px-3 py-2 text-sm">
              <div class="text-muted-foreground">分配数量</div>
              <div class="mt-1 text-lg font-semibold">${task.scopeQty.toLocaleString()} 件</div>
              <div class="text-xs text-muted-foreground">连续工序任务不拆成明细</div>
            </div>
          </div>
          ${direct ? `
            <label class="block space-y-1 text-sm">
              <span class="text-muted-foreground">承接工厂</span>
              <select class="h-9 w-full rounded-md border px-3" data-skip-page-rerender="true" data-continuous-dispatch-field="factoryId">
                <option value="">请选择工厂</option>
                ${factories.map((factory) => `<option value="${escapeHtml(factory.id)}" ${factory.id === dialog.factoryId ? 'selected' : ''}>${escapeHtml(factory.name)}（${escapeHtml(factory.code)}）</option>`).join('')}
              </select>
            </label>
            ${containsSewing(task) ? `
              <div class="rounded-md border p-3 text-sm">
                <div><span class="text-muted-foreground">当前主工厂：</span><span class="font-medium">${escapeHtml(order?.mainFactorySnapshot?.name || '待确认')}</span></div>
                <div class="mt-2 flex flex-wrap gap-4">
                  <label class="inline-flex items-center gap-2"><input type="radio" name="continuous-main-factory" value="CURRENT" ${dialog.mainFactoryChoice === 'CURRENT' ? 'checked' : ''} data-skip-page-rerender="true" data-continuous-dispatch-field="mainFactoryChoice" />保持当前主工厂</label>
                  <label class="inline-flex items-center gap-2"><input type="radio" name="continuous-main-factory" value="SELECTED" ${dialog.mainFactoryChoice === 'SELECTED' ? 'checked' : ''} data-skip-page-rerender="true" data-continuous-dispatch-field="mainFactoryChoice" />选择承接工厂为主工厂${selectedFactory ? `（${escapeHtml(selectedFactory.name)}）` : ''}</label>
                </div>
              </div>
            ` : ''}
            <div>
              <div class="mb-2 text-sm font-medium">回货时效节点预览</div>
              ${renderMilestonePreview(task, dialog.businessAssignedAt)}
            </div>
          ` : `
            <label class="block space-y-1 text-sm">
              <span class="text-muted-foreground">竞价截止时间</span>
              <input type="datetime-local" class="h-9 w-full rounded-md border px-3" value="${escapeHtml(dialog.biddingDeadline)}" data-skip-page-rerender="true" data-continuous-dispatch-field="biddingDeadline" />
            </label>
            <div class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">发起竞价不代表工厂接单；工厂确认接单后启动时效。</div>
          `}
        </div>
        <footer class="flex justify-end gap-2 border-t px-5 py-4">
          <button type="button" class="h-9 rounded-md border px-4 text-sm" data-skip-page-rerender="true" data-continuous-dispatch-action="close-dialog">取消</button>
          <button type="button" class="h-9 rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700" data-continuous-dispatch-action="confirm-dialog" data-task-id="${escapeHtml(task.taskId)}">${direct ? '确认直接派单' : '确认发起竞价'}</button>
        </footer>
      </section>
    </div>
  `
}

function getContinuousTasks(): RuntimeProcessTask[] {
  return listRuntimeProcessTasks()
    .filter((task) =>
      task.taskUnitType === 'COMBINED_PROCESS_TASK'
      && task.acceptanceMode === 'CONTINUOUS_PROCESS'
      && ((task.mergeSourceTaskIds ?? []).length > 0 || task.generationRuleName === '任务清单人工合并')
    )
    .sort((left, right) => left.productionOrderId.localeCompare(right.productionOrderId) || left.seq - right.seq)
}

function getCoveredProcessNames(task: RuntimeProcessTask): string[] {
  const names = (task.coveredProcesses ?? [])
    .map((process) => process.processName)
    .filter(Boolean)
  if (names.length > 0) return Array.from(new Set(names))
  return [task.processNameZh].filter(Boolean)
}

function isSewingPostContinuousTask(task: RuntimeProcessTask): boolean {
  const names = getCoveredProcessNames(task)
  if (names.length !== 2) return false
  return names.includes('车缝') && names.includes('后道')
}

function isCuttingContinuousTask(task: RuntimeProcessTask): boolean {
  return getCoveredProcessNames(task).some((name) => name.includes('裁'))
}

function getTaskOrder(task: RuntimeProcessTask) {
  return productionOrders.find((order) => order.productionOrderId === task.productionOrderId)
}

function getFilteredTasks(): RuntimeProcessTask[] {
  const keyword = state.keyword.trim().toLowerCase()
  return getContinuousTasks()
    .filter((task) => {
      if (state.tab === 'SEWING_POST') return isSewingPostContinuousTask(task)
      return !isSewingPostContinuousTask(task)
    })
    .filter((task) => {
      if (!keyword) return true
      const order = getTaskOrder(task)
      return [
        task.taskNo,
        task.taskId,
        task.productionOrderId,
        task.productionOrderNo,
        task.processNameZh,
        task.assignedFactoryName,
        order?.demandSnapshot.saleType,
        order?.mainFactorySnapshot?.name,
        getCoveredProcessNames(task).join(' '),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    })
}

function renderMetric(label: string, value: number, hint: string, tone = 'text-slate-900'): string {
  return `
    <div class="rounded-md border bg-card px-3 py-2 shadow-sm">
      <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-1 text-xl font-semibold ${tone}">${value}</div>
      <div class="text-[11px] text-muted-foreground">${escapeHtml(hint)}</div>
    </div>
  `
}

function renderTabButton(tab: ContinuousDispatchTab, label: string, count: number): string {
  const active = state.tab === tab
  return `
    <button
      class="${toClassName(
        'h-9 rounded-md border px-3 text-sm',
        active ? 'border-blue-600 bg-blue-50 text-blue-700' : 'bg-background hover:bg-muted',
      )}"
      data-continuous-dispatch-action="switch-tab"
      data-tab="${tab}"
    >${escapeHtml(label)} <span class="ml-1 text-xs">${count}</span></button>
  `
}

function renderReadiness(task: RuntimeProcessTask): string {
  if (isSewingPostContinuousTask(task)) {
    return `
      <div class="space-y-1 text-xs">
        <div><span class="text-muted-foreground">裁片是否可做成衣：</span><span class="font-medium text-emerald-700">按车缝工作台齐套口径校验</span></div>
        <div><span class="text-muted-foreground">辅料是否满足生产：</span><span class="font-medium text-emerald-700">直接派单或发起竞价前必须满足</span></div>
        <div class="text-muted-foreground">仅包含车缝+后道连续任务，采用车缝分配工作台同类齐套判断。</div>
      </div>
    `
  }

  const coveredProcessText = getCoveredProcessNames(task).join('、') || '—'
  const capacityWindowText = [task.startDueAt, task.taskDeadline].filter(Boolean).join(' 至 ') || '待计划确认'
  return `
    <div class="space-y-1 text-xs">
      <div><span class="text-muted-foreground">覆盖工序：</span><span class="font-medium text-slate-700">${escapeHtml(coveredProcessText)}</span></div>
      <div><span class="text-muted-foreground">承接能力：</span><span class="font-medium text-slate-700">按覆盖工序连续承接能力确认</span></div>
      <div><span class="text-muted-foreground">产能窗口：</span><span class="font-medium text-slate-700">${escapeHtml(capacityWindowText)}</span></div>
      <div><span class="text-muted-foreground">接单截止：</span><span class="font-medium text-slate-700">${escapeHtml(task.acceptDeadline || task.biddingDeadline || '待确认')}</span></div>
      <div><span class="text-muted-foreground">任务截止：</span><span class="font-medium text-slate-700">${escapeHtml(task.taskDeadline || '待确认')}</span></div>
      ${
        isCuttingContinuousTask(task)
          ? '<div class="text-muted-foreground">含裁片连续任务：我方裁床提供唛架方案，三方上报裁片完成数量和可做成衣数，不生成我方加工单。</div>'
          : '<div class="text-muted-foreground">任务已由任务清单合并，分配时保持整任务范围。</div>'
      }
    </div>
  `
}

function renderAssignmentCell(task: RuntimeProcessTask): string {
  const tone =
    task.assignmentStatus === 'UNASSIGNED'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : task.assignmentStatus === 'BIDDING' || task.assignmentStatus === 'ASSIGNING'
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
  return `
    <div class="space-y-1">
      <span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${tone}">${escapeHtml(assignmentStatusLabel[task.assignmentStatus])}</span>
      <div class="text-xs text-muted-foreground">${escapeHtml(executionStatusLabel[task.status])}</div>
      <div class="text-xs text-muted-foreground">${escapeHtml(task.assignedFactoryName || '未指定承接工厂')}</div>
    </div>
  `
}

function renderActions(task: RuntimeProcessTask): string {
  const canAssign = task.assignmentStatus === 'UNASSIGNED'
  if (!canAssign) {
    return `<div class="text-xs text-muted-foreground">${task.assignmentStatus === 'BIDDING' ? '竞价已发起，等待定标' : '已有分配结果'}</div>`
  }
  return `
    <div class="flex flex-wrap gap-2">
      <button
        class="${toClassName(
          'h-8 rounded-md border px-2.5 text-xs',
          canAssign ? 'hover:bg-muted' : 'cursor-not-allowed opacity-50',
        )}"
        data-skip-page-rerender="true"
        data-continuous-dispatch-action="open-direct"
        data-task-id="${escapeHtml(task.taskId)}"
        ${canAssign ? '' : 'disabled'}
      >直接派单</button>
      <button
        class="${toClassName(
          'h-8 rounded-md border px-2.5 text-xs',
          canAssign ? 'hover:bg-muted' : 'cursor-not-allowed opacity-50',
        )}"
        data-skip-page-rerender="true"
        data-continuous-dispatch-action="open-bidding"
        data-task-id="${escapeHtml(task.taskId)}"
        ${canAssign ? '' : 'disabled'}
      >发起竞价</button>
      <button
        class="${toClassName(
          'h-8 rounded-md border px-2.5 text-xs',
          canAssign ? 'hover:bg-muted' : 'cursor-not-allowed opacity-50',
        )}"
        data-continuous-dispatch-action="set-hold"
        data-task-id="${escapeHtml(task.taskId)}"
        ${canAssign ? '' : 'disabled'}
      >暂不分配</button>
    </div>
  `
}

function getPagedTasks(tasks: RuntimeProcessTask[]) {
  const total = tasks.length
  const pageSize = CONTINUOUS_DISPATCH_PAGE_SIZE_OPTIONS.includes(state.pageSize as typeof CONTINUOUS_DISPATCH_PAGE_SIZE_OPTIONS[number])
    ? state.pageSize
    : 10
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(Math.max(1, state.currentPage), totalPages)
  const start = (currentPage - 1) * pageSize
  const rows = tasks.slice(start, start + pageSize)
  return {
    rows,
    total,
    pageSize,
    currentPage,
    totalPages,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(total, start + rows.length),
  }
}

function renderTaskTable(tasks: RuntimeProcessTask[]): string {
  const paging = getPagedTasks(tasks)
  const emptyRow = state.tab === 'SEWING_POST'
    ? `
      <tr>
        <td colspan="7" class="px-3 py-8 text-sm">
          <div class="mx-auto max-w-2xl rounded-md border border-dashed bg-muted/20 p-4 text-left">
            <div class="font-medium text-slate-800">当前暂无已由任务清单合并形成的车缝+后道连续任务。</div>
            <div class="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              <div><span class="text-muted-foreground">裁片是否可做成衣：</span><span class="font-medium text-emerald-700">有车缝+后道连续任务后按车缝工作台齐套口径校验</span></div>
              <div><span class="text-muted-foreground">辅料是否满足生产：</span><span class="font-medium text-emerald-700">直接派单或发起竞价前必须满足</span></div>
            </div>
          </div>
        </td>
      </tr>
    `
    : '<tr><td colspan="7" class="px-3 py-10 text-center text-sm text-muted-foreground">当前筛选下暂无连续工序任务。</td></tr>'

  return `
    <section class="rounded-lg border bg-card">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 class="text-base font-semibold">连续工序任务列表</h2>
          <p class="mt-1 text-xs text-muted-foreground">只展示任务清单人工合并形成的连续工序任务，分配时按整任务处理。</p>
        </div>
        <div class="text-xs text-muted-foreground">搜索结果：${paging.total} 个连续工序任务</div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[980px] table-fixed text-sm">
          <thead>
            <tr class="border-b bg-muted/40 text-xs text-muted-foreground">
              <th class="w-[146px] px-3 py-2 text-left font-medium">${PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE} / 售卖类型</th>
              <th class="w-[136px] px-3 py-2 text-left font-medium">连续任务</th>
              <th class="w-[86px] px-3 py-2 text-left font-medium">覆盖工序</th>
              <th class="w-[148px] px-3 py-2 text-left font-medium">整任务范围</th>
              <th class="w-[168px] px-3 py-2 text-left font-medium">分配前判断</th>
              <th class="w-[120px] min-w-[120px] px-3 py-2 text-left font-medium">分配状态</th>
              <th class="w-[176px] min-w-[176px] border-l bg-muted/40 px-3 py-2 text-left font-medium shadow-sm xl:sticky xl:right-0 xl:z-20">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              paging.total === 0
                ? emptyRow
                : paging.rows.map((task) => {
                    const order = getTaskOrder(task)
                    const coveredNames = getCoveredProcessNames(task)
                    return `
                      <tr class="border-b align-top last:border-b-0">
                        <td class="break-words px-3 py-3">
                          ${renderProductionOrderIdentityCell(task.productionOrderId)}
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(order?.demandSnapshot.saleType ?? task.saleTypeSnapshot ?? '—')}</div>
                        </td>
                        <td class="break-words px-3 py-3">
                          <div class="font-medium">${escapeHtml(task.processNameZh)}</div>
                          <div class="mt-1 font-mono text-xs text-muted-foreground">${escapeHtml(task.taskNo || task.taskId)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">来源：${escapeHtml(task.generationRuleName || '任务清单人工合并')}</div>
                        </td>
                        <td class="px-3 py-3">
                          <div class="flex flex-wrap gap-1">
                            ${coveredNames.map((name) => `<span class="rounded-md border bg-muted/40 px-2 py-0.5 text-xs">${escapeHtml(name)}</span>`).join('')}
                          </div>
                        </td>
                        <td class="break-all px-3 py-3 text-xs text-muted-foreground">
                          <div>合并来源：${escapeHtml((task.mergeSourceTaskIds ?? []).join('、') || '任务清单')}</div>
                          <div>计划数量：${Number(task.qty || task.scopeQty || 0).toLocaleString()} 件</div>
                          <div>合并人：${escapeHtml(task.mergeCreatedBy || '生产计划员')}</div>
                        </td>
                        <td class="break-words px-3 py-3">${renderReadiness(task)}</td>
                        <td class="w-[120px] min-w-[120px] px-3 py-3">${renderAssignmentCell(task)}</td>
                        <td class="w-[176px] min-w-[176px] border-l bg-card px-3 py-3 shadow-sm xl:sticky xl:right-0 xl:z-10">${renderActions(task)}</td>
                      </tr>
                    `
                  }).join('')
            }
          </tbody>
        </table>
      </div>
      ${renderTablePagination({
        total: paging.total,
        from: paging.from,
        to: paging.to,
        currentPage: paging.currentPage,
        totalPages: paging.totalPages,
        pageSize: paging.pageSize,
        actionPrefix: 'continuous-dispatch',
        fieldPrefix: 'continuous-dispatch',
        pageSizeOptions: CONTINUOUS_DISPATCH_PAGE_SIZE_OPTIONS,
      })}
    </section>
  `
}

export function renderContinuousDispatchPage(): string {
  const allContinuousTasks = getContinuousTasks()
  const sewingPostCount = allContinuousTasks.filter(isSewingPostContinuousTask).length
  const otherCount = allContinuousTasks.filter((task) => !isSewingPostContinuousTask(task)).length
  const filteredTasks = getFilteredTasks()
  const filteredUnassignedCount = filteredTasks.filter((task) => task.assignmentStatus === 'UNASSIGNED').length
  const filteredPendingCount = filteredTasks.filter((task) => task.assignmentStatus === 'BIDDING' || task.assignmentStatus === 'ASSIGNING').length
  const filteredAssignedCount = filteredTasks.filter((task) => task.assignmentStatus === 'ASSIGNED' || task.assignmentStatus === 'AWARDED').length
  const filteredCuttingCount = filteredTasks.filter(isCuttingContinuousTask).length

  return `
    <div class="space-y-4" data-continuous-dispatch-page>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold">连续工序任务分配</h1>
          <p class="mt-1 text-sm text-muted-foreground">承接任务清单人工合并出的连续工序任务，分配范围固定为整任务，不重新拆分到明细。</p>
        </div>
      </div>

      <section class="rounded-lg border bg-card p-3">
        <div class="flex flex-wrap items-center gap-3">
          <div class="relative min-w-[260px] flex-1">
            <i data-lucide="search" class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i>
            <input
              class="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm"
              placeholder="生产单号 / 任务号 / 工序 / 工厂"
              value="${escapeHtml(state.keyword)}"
              data-continuous-dispatch-field="keyword"
              data-fast-page-render="true"
            />
          </div>
          <div class="flex flex-wrap gap-2">
            ${renderTabButton('SEWING_POST', '车缝+后道连续任务', sewingPostCount)}
            ${renderTabButton('OTHER', '其他连续工序任务', otherCount)}
          </div>
        </div>
        <div class="mt-3 text-xs text-muted-foreground">
          含裁片连续任务归入其他连续工序任务：我方裁床提供唛架方案；三方上报裁片完成数量和可做成衣数；不生成我方加工单。车缝+后道连续任务继续使用车缝齐套判断。
        </div>
        <div class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          ${renderMetric('当前筛选任务', filteredTasks.length, state.tab === 'SEWING_POST' ? '车缝+后道连续任务' : '其他连续工序任务')}
          ${renderMetric('待选择分配方式', filteredUnassignedCount + filteredPendingCount, '待分配/分配中/招标中', 'text-amber-700')}
          ${renderMetric('已指定承接工厂', filteredAssignedCount, '已分配/已中标', 'text-emerald-700')}
          ${renderMetric('含裁片提示', filteredCuttingCount, '我方提供唛架方案，三方上报裁片完成')}
        </div>
      </section>

      ${
        state.feedback
          ? `<section class="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">${escapeHtml(state.feedback)}</section>`
          : ''
      }

      ${renderTaskTable(filteredTasks)}
      <div data-continuous-dispatch-dialog-host>${renderDispatchDialog()}</div>
    </div>
  `
}

export function handleContinuousDispatchEvent(target: HTMLElement, event?: Pick<Event, 'type'>): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-continuous-dispatch-field]')
  if (fieldNode && 'value' in fieldNode) {
    if (fieldNode.dataset.continuousDispatchField === 'keyword') {
      state.keyword = String(fieldNode.value)
      state.currentPage = 1
      return true
    }
    if (fieldNode.dataset.continuousDispatchField === 'pageSize') {
      const nextPageSize = Number(fieldNode.value)
      state.pageSize = CONTINUOUS_DISPATCH_PAGE_SIZE_OPTIONS.includes(nextPageSize as typeof CONTINUOUS_DISPATCH_PAGE_SIZE_OPTIONS[number])
        ? nextPageSize
        : 10
      state.currentPage = 1
      return true
    }
    if (state.dialog) {
      const field = fieldNode.dataset.continuousDispatchField
      const value = String(fieldNode.value)
      if (event?.type && event.type !== 'change') {
        return true
      }
      if (field === 'factoryId') state.dialog.factoryId = value
      if (field === 'businessAssignedAt') state.dialog.businessAssignedAt = value
      if (field === 'biddingDeadline') state.dialog.biddingDeadline = value
      if (field === 'mainFactoryChoice' && (value === 'CURRENT' || value === 'SELECTED')) {
        state.dialog.mainFactoryChoice = value
      }
      state.dialog.error = ''
      refreshDialogHost()
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-continuous-dispatch-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.continuousDispatchAction

  if (action === 'switch-tab') {
    const tab = actionNode.dataset.tab as ContinuousDispatchTab | undefined
    if (tab === 'SEWING_POST' || tab === 'OTHER') {
      state.tab = tab
      state.feedback = ''
      state.currentPage = 1
      return true
    }
    return false
  }

  if (action === 'prev-page' || action === 'next-page') {
    const total = getFilteredTasks().length
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize))
    state.currentPage = action === 'prev-page'
      ? Math.max(1, state.currentPage - 1)
      : Math.min(totalPages, state.currentPage + 1)
    return true
  }

  if (action === 'open-direct' || action === 'open-bidding') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true
    openDispatchDialog(action === 'open-direct' ? 'DIRECT' : 'BIDDING', taskId)
    refreshDialogHost()
    return true
  }

  if (action === 'close-dialog') {
    state.dialog = null
    refreshDialogHost()
    return true
  }

  if (action === 'switch-dialog-mode' && state.dialog) {
    const mode = actionNode.dataset.mode
    if (mode === 'DIRECT' || mode === 'BIDDING') {
      state.dialog.mode = mode
      state.dialog.error = ''
      refreshDialogHost()
    }
    return true
  }

  if (action === 'confirm-dialog') {
    const dialog = state.dialog
    const task = getDialogTask()
    if (!dialog || !task) return true
    try {
      if (!isAssignableContinuousTask(task)) throw new Error('该连续工序任务已有分配结果，请刷新后查看')
      const operatedAt = formatOperationLocalWallClock()
      const businessAssignedAt = dateTimeLocalToOperationWallClock(dialog.businessAssignedAt)
      if (dialog.mode === 'DIRECT') {
        const factory = getAssignableFactories().find((item) => item.id === dialog.factoryId)
        if (!factory) throw new Error('请选择承接工厂')
        const updated = applyRuntimeDirectDispatchMeta({
          taskId: task.taskId,
          factoryId: factory.id,
          factoryName: factory.name,
          acceptDeadline: '',
          taskDeadline: task.taskDeadline ?? '',
          remark: '连续工序任务整任务直接派单',
          by: '生产计划员',
          dispatchPrice: task.standardPrice ?? 0,
          dispatchPriceCurrency: task.standardPriceCurrency ?? 'IDR',
          dispatchPriceUnit: task.standardPriceUnit ?? task.qtyUnit,
          priceDiffReason: '',
          businessAssignedAt,
          operatedAt,
          autoAccept: containsSewing(task),
          writeBackMainFactory: containsSewing(task) && dialog.mainFactoryChoice === 'SELECTED',
        })
        if (!updated) throw new Error('直接派单失败，请刷新后重试')
        state.feedback = `已将连续工序任务直接派给 ${factory.name}，分配数量 ${task.scopeQty.toLocaleString()} 件。`
      } else {
        if (!dialog.biddingDeadline) throw new Error('请填写竞价截止时间')
        const biddingDeadline = dateTimeLocalToOperationWallClock(dialog.biddingDeadline)
        const updated = upsertRuntimeTaskTender(
          task.taskId,
          {
            tenderId: `TENDER-${task.taskId}-${operatedAt.replace(/\D/g, '')}`,
            biddingDeadline,
            taskDeadline: task.taskDeadline || biddingDeadline,
            businessAssignedAt,
            assignmentOperatedAt: operatedAt,
          },
          '生产计划员',
        )
        if (!updated) throw new Error('发起竞价失败，请刷新后重试')
        state.feedback = `已发起连续工序任务竞价，竞价截止 ${biddingDeadline}；工厂确认接单后启动时效。`
      }
      state.dialog = null
      return true
    } catch (error) {
      state.dialog.error = error instanceof Error ? error.message : '分配失败，请检查填写内容'
      refreshDialogHost()
      return true
    }
  }

  if (action === 'set-hold') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true
    const task = getRuntimeTaskById(taskId)
    if (!task || !isAssignableContinuousTask(task)) return true
    setRuntimeTaskAssignMode(taskId, 'HOLD', '生产计划员')
    state.feedback = '已将连续工序任务设为暂不分配。'
    return true
  }

  return false
}

export function isContinuousDispatchDialogOpen(): boolean {
  return state.dialog !== null
}
