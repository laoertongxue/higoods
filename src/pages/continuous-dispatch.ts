import {
  listRuntimeProcessTasks,
  setRuntimeTaskAssignMode,
  type RuntimeProcessTask,
} from '../data/fcs/runtime-process-tasks.ts'
import { productionOrders } from '../data/fcs/production-orders.ts'
import {
  PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE,
  renderProductionOrderIdentityCell,
} from '../data/fcs/production-order-identity.ts'
import { escapeHtml, toClassName } from '../utils.ts'

type ContinuousDispatchTab = 'SEWING_POST' | 'WITH_CUTTING' | 'OTHER'

interface ContinuousDispatchState {
  tab: ContinuousDispatchTab
  keyword: string
  feedback: string
}

const state: ContinuousDispatchState = {
  tab: 'SEWING_POST',
  keyword: '',
  feedback: '',
}

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

function getContinuousTasks(): RuntimeProcessTask[] {
  return listRuntimeProcessTasks()
    .filter((task) => task.taskUnitType === 'COMBINED_PROCESS_TASK')
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
      if (state.tab === 'WITH_CUTTING') return isCuttingContinuousTask(task)
      return !isSewingPostContinuousTask(task) && !isCuttingContinuousTask(task)
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
  if (isCuttingContinuousTask(task)) {
    return `
      <div class="space-y-1 text-xs">
        <div><span class="text-muted-foreground">唛架依据：</span><span class="font-medium text-blue-700">由我方裁床排唛架</span></div>
        <div><span class="text-muted-foreground">裁片完成：</span><span class="font-medium text-emerald-700">三方上报裁片完成数量和可做成衣数</span></div>
        <div class="text-muted-foreground">不生成我方加工单，辅助/特种工艺作为验收关注点。</div>
      </div>
    `
  }

  if (isSewingPostContinuousTask(task)) {
    return `
      <div class="space-y-1 text-xs">
        <div><span class="text-muted-foreground">裁片是否可做成衣：</span><span class="font-medium text-emerald-700">按车缝工作台齐套口径校验</span></div>
        <div><span class="text-muted-foreground">辅料是否满足生产：</span><span class="font-medium text-emerald-700">整任务分配前必须满足</span></div>
        <div class="text-muted-foreground">仅包含车缝+后道连续任务，采用车缝分配工作台同类齐套判断。</div>
      </div>
    `
  }

  return `
    <div class="space-y-1 text-xs">
      <div><span class="text-muted-foreground">连续承接校验：</span><span class="font-medium text-slate-700">按覆盖工序连续承接能力确认</span></div>
      <div class="text-muted-foreground">任务已由任务清单合并，分配时保持整任务范围。</div>
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
  const canAssign = task.assignmentStatus === 'UNASSIGNED' || task.assignmentStatus === 'BIDDING'
  return `
    <div class="flex flex-wrap gap-2">
      <button
        class="${toClassName(
          'h-8 rounded-md border px-2.5 text-xs',
          canAssign ? 'hover:bg-muted' : 'cursor-not-allowed opacity-50',
        )}"
        data-continuous-dispatch-action="set-bidding"
        data-task-id="${escapeHtml(task.taskId)}"
        ${canAssign ? '' : 'disabled'}
      >整任务分配</button>
      <button
        class="h-8 rounded-md border px-2.5 text-xs hover:bg-muted"
        data-continuous-dispatch-action="set-hold"
        data-task-id="${escapeHtml(task.taskId)}"
      >暂不分配</button>
    </div>
  `
}

function renderTaskTable(tasks: RuntimeProcessTask[]): string {
  return `
    <section class="rounded-lg border bg-card">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 class="text-base font-semibold">连续工序任务列表</h2>
          <p class="mt-1 text-xs text-muted-foreground">只展示任务清单人工合并形成的连续工序任务，分配时按整任务处理。</p>
        </div>
        <div class="text-xs text-muted-foreground">搜索结果：${tasks.length} 个连续工序任务</div>
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
              tasks.length === 0
                ? '<tr><td colspan="7" class="px-3 py-10 text-center text-sm text-muted-foreground">当前筛选下暂无连续工序任务。</td></tr>'
                : tasks.map((task) => {
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
    </section>
  `
}

export function renderContinuousDispatchPage(): string {
  const allContinuousTasks = getContinuousTasks()
  const sewingPostCount = allContinuousTasks.filter(isSewingPostContinuousTask).length
  const withCuttingCount = allContinuousTasks.filter(isCuttingContinuousTask).length
  const otherCount = allContinuousTasks.filter((task) => !isSewingPostContinuousTask(task) && !isCuttingContinuousTask(task)).length
  const unassignedCount = allContinuousTasks.filter((task) => task.assignmentStatus === 'UNASSIGNED').length
  const biddingCount = allContinuousTasks.filter((task) => task.assignmentStatus === 'BIDDING' || task.assignmentStatus === 'ASSIGNING').length
  const filteredTasks = getFilteredTasks()

  return `
    <div class="space-y-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold">连续工序任务分配</h1>
          <p class="mt-1 text-sm text-muted-foreground">承接任务清单人工合并出的连续工序任务，只做整任务分配，不重新拆分到明细。</p>
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
            ${renderTabButton('SEWING_POST', '仅车缝+后道', sewingPostCount)}
            ${renderTabButton('WITH_CUTTING', '含裁片连续任务', withCuttingCount)}
            ${renderTabButton('OTHER', '其他连续任务', otherCount)}
          </div>
        </div>
        <div class="mt-3 text-xs text-muted-foreground">
          含裁片连续任务：由我方裁床排唛架；三方上报裁片完成数量和可做成衣数；不生成我方加工单。仅车缝+后道连续任务继续使用车缝齐套判断。
        </div>
        <div class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          ${renderMetric('连续工序任务', allContinuousTasks.length, 'COMBINED_PROCESS_TASK')}
          ${renderMetric('车缝+后道连续任务', sewingPostCount, '使用车缝齐套判断', 'text-blue-700')}
          ${renderMetric('含裁片连续任务', withCuttingCount, '我方裁床排唛架，三方上报裁片完成', 'text-emerald-700')}
          ${renderMetric('其他连续任务', otherCount, '按覆盖工序承接能力确认')}
          ${renderMetric('待整任务分配', unassignedCount + biddingCount, '待分配/招标中', 'text-amber-700')}
        </div>
      </section>

      ${
        state.feedback
          ? `<section class="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">${escapeHtml(state.feedback)}</section>`
          : ''
      }

      ${renderTaskTable(filteredTasks)}
    </div>
  `
}

export function handleContinuousDispatchEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-continuous-dispatch-field]')
  if (fieldNode && 'value' in fieldNode) {
    if (fieldNode.dataset.continuousDispatchField === 'keyword') {
      state.keyword = String(fieldNode.value)
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-continuous-dispatch-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.continuousDispatchAction

  if (action === 'switch-tab') {
    const tab = actionNode.dataset.tab as ContinuousDispatchTab | undefined
    if (tab === 'SEWING_POST' || tab === 'WITH_CUTTING' || tab === 'OTHER') {
      state.tab = tab
      state.feedback = ''
      return true
    }
    return false
  }

  if (action === 'set-bidding' || action === 'set-hold') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true
    setRuntimeTaskAssignMode(taskId, action === 'set-bidding' ? 'BIDDING' : 'HOLD', '生产计划员')
    state.feedback = action === 'set-bidding'
      ? '已将连续工序任务设为整任务竞价分配。'
      : '已将连续工序任务设为暂不分配。'
    return true
  }

  return false
}

export function isContinuousDispatchDialogOpen(): boolean {
  return false
}
