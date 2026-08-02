// @page-pattern: detail

// 工程主单详情：全宽泳道工作台。
// 横向按逻辑阶段排列，纵向按专业任务类型分泳道；任务卡点击后只局部更新右侧抽屉，不整页重绘。

import {
  ENGINEERING_LANES,
  ENGINEERING_PHASES,
  buildEngineeringMasterDetailModel,
  type EngineeringMasterDetailModel,
  type EngineeringTaskCardModel,
} from '../data/pcs-engineering-master-view-model.ts'
import {
  getEngineeringMasterOrderById,
  submitEngineeringTaskResult,
} from '../data/pcs-engineering-master-repository.ts'
import {
  closeEngineeringMasterOrder,
  validateEngineeringMasterOrderClose,
} from '../data/pcs-engineering-master-close-service.ts'
import type {
  EngineeringMasterStatus,
  EngineeringTaskStatus,
} from '../data/pcs-engineering-master-types.ts'
import { escapeHtml } from '../utils.ts'

const DETAIL_EVENT_PREFIX = 'pcs-engineering-master'

// 原型尚无统一登录态；详情页把当前主单跟单解析为当前演示操作者。
// 渲染权限与事件提交必须始终经由同一解析函数，避免身份文案与领域入参漂移。
export function resolveEngineeringMasterDemoOperatorName(
  model: Pick<EngineeringMasterDetailModel, 'merchandiserName'>,
): string {
  return model.merchandiserName.trim()
}

const MASTER_STATUS_TONES: Record<EngineeringMasterStatus, string> = {
  草稿: 'bg-slate-100 text-slate-700',
  已发布: 'bg-blue-100 text-blue-700',
  进行中: 'bg-amber-100 text-amber-700',
  技术包审核中: 'bg-purple-100 text-purple-700',
  待关闭: 'bg-orange-100 text-orange-700',
  已关闭: 'bg-emerald-100 text-emerald-700',
  已终止: 'bg-red-100 text-red-700',
}

const TASK_STATUS_TONES: Record<EngineeringTaskStatus, string> = {
  未启用: 'bg-slate-100 text-slate-500',
  待前置: 'bg-slate-100 text-slate-600',
  待开始: 'bg-white text-slate-700 border border-slate-200',
  进行中: 'bg-blue-100 text-blue-700',
  待审核: 'bg-purple-100 text-purple-700',
  返工中: 'bg-amber-100 text-amber-700',
  已完成: 'bg-emerald-100 text-emerald-700',
  因需求变更结束: 'bg-slate-200 text-slate-600',
}

const TASK_CARD_TONES: Record<EngineeringTaskStatus, string> = {
  未启用: 'border-dashed border-slate-200 bg-slate-50 opacity-70',
  待前置: 'border-slate-200 bg-slate-50',
  待开始: 'border-slate-200 bg-white',
  进行中: 'border-blue-200 bg-blue-50',
  待审核: 'border-purple-200 bg-purple-50',
  返工中: 'border-amber-200 bg-amber-50',
  已完成: 'border-emerald-200 bg-emerald-50',
  因需求变更结束: 'border-slate-200 bg-slate-100',
}

interface DetailUiState {
  selectedTaskId: string
  drawerOpen: boolean
}

const detailUiState: DetailUiState = {
  selectedTaskId: '',
  drawerOpen: false,
}

// 可提交成果的任务状态：待开始、进行中；待前置任务在依赖全部完成后也可提交。
const SUBMITTABLE_STATUSES: EngineeringTaskStatus[] = ['待开始', '进行中', '待前置']

function renderStatusBadge(status: EngineeringMasterStatus): string {
  const tone = MASTER_STATUS_TONES[status] ?? 'bg-slate-100 text-slate-700'
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tone}">${escapeHtml(status)}</span>`
}

function renderTaskStatusBadge(status: EngineeringTaskStatus): string {
  const tone = TASK_STATUS_TONES[status] ?? 'bg-slate-100 text-slate-600'
  return `<span class="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${tone}">${escapeHtml(status)}</span>`
}

// ============ 头部 ============

function renderMasterHeader(model: EngineeringMasterDetailModel): string {
  const operatorName = resolveEngineeringMasterDemoOperatorName(model)
  let canClose = operatorName === model.merchandiserName
  if (canClose) {
    try {
      validateEngineeringMasterOrderClose(model.masterOrderId)
    } catch {
      canClose = false
    }
  }
  return `
    <header class="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-lg font-semibold">${escapeHtml(model.masterOrderCode)}</h1>
        ${renderStatusBadge(model.status)}
        <span class="text-sm text-slate-500">${escapeHtml(model.styleName)}（${escapeHtml(model.styleCode)}）</span>
      </div>
      <div class="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span>跟单：${escapeHtml(model.merchandiserName)}</span>
        <span>创建：${escapeHtml(model.createdBy)} · ${escapeHtml(model.createdAt)}</span>
        ${model.publishedAt ? `<span>发布：${escapeHtml(model.publishedAt)}</span>` : ''}
        ${canClose ? `
          <button
            type="button"
            class="inline-flex h-8 items-center justify-center rounded-md bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800"
            data-${DETAIL_EVENT_PREFIX}-action="close-master-order"
          >关闭工程主单</button>
        ` : ''}
      </div>
    </header>
  `
}

// ============ 前期输入区 ============

function renderPriorReuseRegion(model: EngineeringMasterDetailModel): string {
  if (model.priorResultReuseLines.length === 0) return ''
  return `
    <section class="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-4 py-3" data-engineering-master-prior-region>
      <h2 class="mb-2 text-sm font-semibold text-slate-700">前期输入</h2>
      <div class="flex flex-wrap gap-2">
        ${model.priorResultReuseLines.map((line) => `
          <div class="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600" data-prior-reuse-card>
            <p class="font-medium text-slate-800">${escapeHtml(line.resultLabel)}</p>
            <p class="mt-0.5">${escapeHtml(line.sourceTaskLabel)} · ${escapeHtml(line.decision)}</p>
          </div>
        `).join('')}
      </div>
    </section>
  `
}

// ============ 任务卡 ============

function renderTaskCard(task: EngineeringTaskCardModel): string {
  const tone = TASK_CARD_TONES[task.status] ?? 'border-slate-200 bg-white'
  const dependsOnIdsAttr = task.dependsOnTaskIds.length > 0
    ? ` data-depends-on-ids="${escapeHtml(task.dependsOnTaskIds.join(' '))}"`
    : ''
  const requiredByIdsAttr = task.requiredByTaskIds.length > 0
    ? ` data-required-by-ids="${escapeHtml(task.requiredByTaskIds.join(' '))}"`
    : ''
  const riskHtml = task.riskText
    ? `<p class="mt-1.5 text-xs font-medium text-amber-700">${escapeHtml(task.riskText)}</p>`
    : ''
  return `
    <button
      type="button"
      class="block w-full rounded-lg border px-3 py-2 text-left shadow-sm transition-colors hover:shadow ${tone}"
      data-engineering-task-card
      data-task-id="${escapeHtml(task.taskId)}"
      data-${DETAIL_EVENT_PREFIX}-action="open-task-drawer"
      ${dependsOnIdsAttr}
      ${requiredByIdsAttr}
      aria-label="查看任务：${escapeHtml(task.taskName)}"
    >
      <div class="flex items-start justify-between gap-2">
        <span class="min-w-0 truncate text-sm font-semibold text-slate-800">${escapeHtml(task.taskName)}</span>
        ${renderTaskStatusBadge(task.status)}
      </div>
      <p class="mt-1 text-xs text-slate-500">负责人：${escapeHtml(task.ownerTeamName)}</p>
      <p class="mt-0.5 text-xs text-slate-600">当前节点：${escapeHtml(task.currentNodeName)}</p>
      <p class="mt-0.5 text-xs text-slate-500">${escapeHtml(task.plannedTimeText)} · ${escapeHtml(task.actualTimeText)}</p>
      ${riskHtml}
    </button>
  `
}

function renderLaneCell(laneIndex: number, phaseIndex: number, model: EngineeringMasterDetailModel): string {
  const lane = ENGINEERING_LANES[laneIndex]
  const phase = ENGINEERING_PHASES[phaseIndex]
  const laneTaskTypes = new Set(lane.taskTypes)
  const tasks = model.lanes
    .find((item) => item.laneKey === lane.laneKey)
    ?.tasks.filter((task) => phase.taskTypes.includes(task.taskType)) ?? []
  const cards = tasks.map(renderTaskCard).join('')
  return `<div class="min-h-24 space-y-2 p-2">${cards || '<span class="text-xs text-slate-300">—</span>'}</div>`
}

function renderLaneGrid(model: EngineeringMasterDetailModel): string {
  const columnWidths = ENGINEERING_PHASES.map((phase) =>
    Math.max(230, 80 + phase.taskTypes.length * 60),
  ).join('px minmax(230px, 1fr) ')
  const gridTemplate = `150px minmax(230px, 1fr) ${columnWidths}px`

  const headerCells = [
    `<div class="sticky left-0 z-20 flex items-center border-b border-r bg-slate-50 px-3 text-xs font-semibold text-slate-500">泳道 / 阶段</div>`,
    ...ENGINEERING_PHASES.map(
      (phase, phaseIndex) => `
        <div class="flex items-center justify-center border-b border-r bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600" data-engineering-phase-head="${escapeHtml(phase.phaseKey)}">
          ${escapeHtml(phase.phaseName)}
        </div>
      `,
    ),
  ].join('')

  const laneRows = ENGINEERING_LANES.map((lane, laneIndex) => {
    const laneCell = `
      <div class="sticky left-0 z-10 flex items-center border-b border-r bg-card px-3 text-sm font-semibold text-slate-700" data-engineering-lane-head="${escapeHtml(lane.laneKey)}">
        ${escapeHtml(lane.laneName)}
      </div>
    `
    const cells = ENGINEERING_PHASES.map((_phase, phaseIndex) =>
      renderLaneCell(laneIndex, phaseIndex, model),
    ).join('')
    return `<div class="contents">${laneCell}${cells}</div>`
  }).join('')

  return `
    <div class="overflow-x-auto rounded-lg border bg-card">
      <div class="grid min-w-[1180px]" style="grid-template-columns: ${gridTemplate}">
        ${headerCells}
        ${laneRows}
      </div>
    </div>
  `
}

// ============ 任务抽屉 ============

function renderTaskDrawer(model: EngineeringMasterDetailModel, task: EngineeringTaskCardModel): string {
  // 抽屉需要完整任务记录（时间、物料行、返工轮次），从仓库读取原始数据，不使用卡片视图模型。
  const rawTask = getEngineeringMasterOrderById(model.masterOrderId)?.tasks.find(
    (item) => item.taskId === task.taskId,
  )
  if (!rawTask) return ''

  const dependsOnHtml = task.dependsOnLabels.length > 0
    ? `<p class="text-sm text-slate-700">${escapeHtml(task.dependsOnLabels.join('、'))}</p>`
    : '<p class="text-sm text-slate-400">无前置依赖</p>'
  const requiredByHtml = task.requiredByLabels.length > 0
    ? `<p class="text-sm text-slate-700">${escapeHtml(task.requiredByLabels.join('、'))}</p>`
    : '<p class="text-sm text-slate-400">无下游任务</p>'

  const timingRows = [
    ['开始时间', rawTask.startedAt || '—'],
    ['提交时间', rawTask.submittedAt || '—'],
    ['首次完成', rawTask.firstCompletedAt || '—'],
    ['当前完成', rawTask.effectiveCompletedAt || '—'],
  ]
    .map(([label, value]) => `
      <div class="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-b-0">
        <span class="text-slate-500">${escapeHtml(label)}</span>
        <span class="text-slate-700">${escapeHtml(value)}</span>
      </div>
    `)
    .join('')

  const materialHtml = rawTask.materialLines?.length
    ? rawTask.materialLines.map((line) => `
        <div class="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-b-0">
          <span class="text-slate-700">${escapeHtml(line.materialName)}</span>
          <span class="text-xs text-slate-500">${escapeHtml(line.requirementType)}</span>
        </div>
      `).join('')
    : '<p class="text-sm text-slate-400">暂无物料明细</p>'

  const reworkHtml = rawTask.reworkRounds?.length
    ? rawTask.reworkRounds.map((round) => `
        <div class="border-b py-2 text-sm last:border-b-0">
          <p class="text-slate-700">第 ${round.roundNo} 轮返工</p>
          <p class="mt-0.5 text-xs text-slate-500">${escapeHtml(round.reason)} · 提交 ${escapeHtml(round.submittedAt)}</p>
        </div>
      `).join('')
    : '<p class="text-sm text-slate-400">暂无返工记录</p>'

  const submittable = SUBMITTABLE_STATUSES.includes(rawTask.status) && rawTask.taskType !== 'ACCESSORY_PURCHASE'
  const submitHint = submittable
    ? task.reviewRequired
      ? '提交成果后进入待审核，由买手逐项审核。'
      : '提交成果后任务即完成，无需人工确认。'
    : ''
  const submitHtml = submittable && rawTask.taskType === 'PRE_PRODUCTION_SAMPLE'
    ? `
      <div class="space-y-3" data-pre-production-sample-result-form>
        <label class="block text-sm text-slate-700">
          <span class="mb-1 block font-medium">上传成果图片</span>
          <input
            type="text"
            class="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
            placeholder="输入图片名称，多张用逗号分隔"
            data-${DETAIL_EVENT_PREFIX}-field="sample-result-images"
          />
        </label>
        <div class="grid grid-cols-2 gap-3">
          <label class="block text-sm text-slate-700">
            <span class="mb-1 block font-medium">制作数量</span>
            <input
              type="number"
              min="1"
              step="1"
              class="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
              data-${DETAIL_EVENT_PREFIX}-field="sample-result-quantity"
            />
          </label>
          <label class="block text-sm text-slate-700">
            <span class="mb-1 block font-medium">提交人</span>
            <input
              type="text"
              class="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
              data-${DETAIL_EVENT_PREFIX}-field="sample-result-submitted-by"
            />
          </label>
        </div>
        <button
          type="button"
          class="inline-flex h-9 w-full items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
          data-${DETAIL_EVENT_PREFIX}-action="submit-pre-production-sample-result"
          data-task-id="${escapeHtml(rawTask.taskId)}"
        >提交样衣成果</button>
        <p
          class="hidden rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          data-pre-production-sample-result-error
          role="alert"
        ></p>
        <p class="text-xs text-slate-500">成果完整提交后任务即完成。</p>
      </div>
    `
    : submittable
    ? `
      <button
        type="button"
        class="inline-flex h-9 w-full items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
        data-${DETAIL_EVENT_PREFIX}-action="submit-task-result"
        data-task-id="${escapeHtml(rawTask.taskId)}"
      >提交成果</button>
      <p class="mt-2 text-xs text-slate-500">${escapeHtml(submitHint)}</p>
    `
    : rawTask.taskType === 'ACCESSORY_PURCHASE'
      ? `<button type="button" class="inline-flex h-9 w-full items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-blue-700 hover:bg-slate-50" data-nav="/pcs/engineering/purchase/${escapeHtml(rawTask.taskId)}">绑定采购单</button>`
      : `<p class="text-sm text-slate-500">当前状态：${escapeHtml(rawTask.status)}</p>`

  return `
    <div class="fixed inset-0 z-50 flex justify-end bg-black/30" data-engineering-master-drawer-backdrop>
      <aside class="flex h-full w-full max-w-md flex-col bg-white shadow-xl" role="dialog" aria-label="任务详情">
        <header class="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div class="flex items-center gap-2">
            <h2 class="text-base font-semibold">${escapeHtml(rawTask.taskName)}</h2>
            ${renderTaskStatusBadge(rawTask.status)}
          </div>
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
            data-${DETAIL_EVENT_PREFIX}-action="close-task-drawer"
            aria-label="关闭任务详情"
          ><i data-lucide="x" class="h-4 w-4"></i></button>
        </header>
        <div class="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          <section>
            <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">来源与款式</h3>
            <div class="space-y-1.5 text-sm">
              <p class="text-slate-700">主单：${escapeHtml(model.masterOrderCode)}</p>
              <p class="text-slate-700">款式：${escapeHtml(model.styleName)}（${escapeHtml(model.styleCode)}）</p>
              <p class="text-slate-700">责任团队：${escapeHtml(rawTask.ownerTeamName)}</p>
            </div>
          </section>
          <section>
            <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">当前阶段与依赖</h3>
            <div class="space-y-1.5">
              <p class="text-sm text-slate-700">当前节点：${escapeHtml(task.currentNodeName)}</p>
              <div class="rounded-md bg-slate-50 px-3 py-2">
                <p class="text-xs text-slate-500">前置依赖（只读）</p>
                ${dependsOnHtml}
              </div>
              <div class="rounded-md bg-slate-50 px-3 py-2">
                <p class="text-xs text-slate-500">下游任务</p>
                ${requiredByHtml}
              </div>
            </div>
          </section>
          <section>
            <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">时效节点</h3>
            ${timingRows}
          </section>
          <section>
            <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">物料明细</h3>
            ${materialHtml}
          </section>
          <section>
            <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">返工记录</h3>
            ${reworkHtml}
          </section>
        </div>
        <footer class="border-t px-4 py-3">${submitHtml}</footer>
      </aside>
    </div>
  `
}

// ============ 页面组装 ============

export function renderPcsEngineeringMasterDetailPage(key: string): string {
  const model = buildEngineeringMasterDetailModel(key)
  if (!model) {
    return '<div class="p-6 text-sm text-slate-500">未找到工程主单。</div>'
  }
  detailUiState.drawerOpen = false
  detailUiState.selectedTaskId = ''

  const selectedTask = model.lanes
    .flatMap((lane) => lane.tasks)
    .find((task) => task.taskId === detailUiState.selectedTaskId) ?? null
  const drawerHtml = detailUiState.drawerOpen && selectedTask
    ? renderTaskDrawer(model, selectedTask)
    : ''

  return `
    <div class="min-w-0 max-w-full space-y-3 p-4" data-pcs-engineering-master-detail-page>
      <div data-engineering-master-region="header">${withDetailLocalInteractions(renderMasterHeader(model))}</div>
      <div data-engineering-master-region="feedback"></div>
      ${renderPriorReuseRegion(model)}
      <div data-engineering-master-region="lanes">${withDetailLocalInteractions(renderLaneGrid(model))}</div>
      <div data-engineering-master-region="drawer">${withDetailLocalInteractions(drawerHtml)}</div>
    </div>
  `
}

// ============ 局部交互 ============

function withDetailLocalInteractions(html: string): string {
  const actionPattern = new RegExp(`data-${DETAIL_EVENT_PREFIX}-action="([^"]+)"`, 'g')
  return html.replace(actionPattern, (attribute) =>
    `data-skip-page-rerender="true" ${attribute}`)
}

function highlightTaskDependencies(selectedTaskId: string): void {
  if (typeof document === 'undefined') return
  const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-engineering-task-card]'))
  cards.forEach((card) => {
    const isSelected = card.dataset.taskId === selectedTaskId
    const dependsOnIds = (card.dataset.dependsOnIds ?? '').split(' ').filter(Boolean)
    const requiredByIds = (card.dataset.requiredByIds ?? '').split(' ').filter(Boolean)
    const isUpstream = dependsOnIds.includes(selectedTaskId)
    const isDownstream = requiredByIds.includes(selectedTaskId)
    card.classList.toggle('ring-2', isSelected)
    card.classList.toggle('ring-blue-400', isSelected)
    card.classList.toggle('ring-1', !isSelected && (isUpstream || isDownstream))
    card.classList.toggle('ring-amber-300', !isSelected && (isUpstream || isDownstream))
  })
}

function clearTaskCardHighlights(): void {
  if (typeof document === 'undefined') return
  document
    .querySelectorAll<HTMLElement>('[data-engineering-task-card]')
    .forEach((card) => {
      card.classList.remove('ring-2', 'ring-blue-400', 'ring-1', 'ring-amber-300')
    })
}

function refreshTaskDrawer(model: EngineeringMasterDetailModel, selectedTaskId: string): void {
  if (typeof document === 'undefined') return
  const drawerHost = document.querySelector<HTMLElement>('[data-engineering-master-region="drawer"]')
  if (!drawerHost) return
  const task = model.lanes
    .flatMap((lane) => lane.tasks)
    .find((item) => item.taskId === selectedTaskId) ?? null
  drawerHost.innerHTML = detailUiState.drawerOpen && task
    ? withDetailLocalInteractions(renderTaskDrawer(model, task))
    : ''
  void import('../components/shell.ts')
    .then(({ hydrateIcons }) => hydrateIcons(drawerHost))
    .catch(() => undefined)
}

function refreshLanesRegion(model: EngineeringMasterDetailModel): void {
  if (typeof document === 'undefined') return
  const lanesHost = document.querySelector<HTMLElement>('[data-engineering-master-region="lanes"]')
  if (!lanesHost) return
  lanesHost.innerHTML = withDetailLocalInteractions(renderLaneGrid(model))
  void import('../components/shell.ts')
    .then(({ hydrateIcons }) => hydrateIcons(lanesHost))
    .catch(() => undefined)
  if (detailUiState.selectedTaskId) highlightTaskDependencies(detailUiState.selectedTaskId)
}

function refreshMasterHeader(model: EngineeringMasterDetailModel): void {
  if (typeof document === 'undefined') return
  const headerHost = document.querySelector<HTMLElement>('[data-engineering-master-region="header"]')
  if (!headerHost) return
  headerHost.innerHTML = withDetailLocalInteractions(renderMasterHeader(model))
}

function showDetailFeedback(message: string, ok: boolean): void {
  if (typeof document === 'undefined') return
  const feedbackHost = document.querySelector<HTMLElement>('[data-engineering-master-region="feedback"]')
  if (!feedbackHost) return
  feedbackHost.innerHTML = `
    <section class="rounded-lg border px-4 py-2.5 text-sm ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}">
      ${escapeHtml(message)}
    </section>
  `
}

function showPreProductionSampleResultError(message: string): void {
  if (typeof document === 'undefined') return
  const drawerHost = document.querySelector<HTMLElement>('[data-engineering-master-region="drawer"]')
  const errorHost = drawerHost?.querySelector<HTMLElement>('[data-pre-production-sample-result-error]')
  if (!errorHost) return
  errorHost.textContent = message
  errorHost.className = 'rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'
}

export function handlePcsEngineeringMasterDetailEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>(`[data-${DETAIL_EVENT_PREFIX}-action]`)
  if (!actionNode) return false
  const action = actionNode.dataset.pcsEngineeringMasterAction
  if (!action) return false

  if (action === 'open-task-drawer') {
    const taskId = actionNode.dataset.taskId || ''
    if (!taskId) return true
    const model = buildEngineeringMasterDetailModel(currentMasterKey())
    if (!model) return true
    detailUiState.selectedTaskId = taskId
    detailUiState.drawerOpen = true
    refreshTaskDrawer(model, taskId)
    highlightTaskDependencies(taskId)
    return true
  }
  if (action === 'close-task-drawer') {
    detailUiState.drawerOpen = false
    detailUiState.selectedTaskId = ''
    const model = buildEngineeringMasterDetailModel(currentMasterKey())
    if (model) refreshTaskDrawer(model, '')
    clearTaskCardHighlights()
    return true
  }
  if (action === 'submit-task-result') {
    const taskId = actionNode.dataset.taskId || ''
    const masterKey = currentMasterKey()
    if (!taskId || !masterKey) return true
    let message = ''
    let ok = false
    try {
      const result = submitEngineeringTaskResult(masterKey, taskId)
      message = `「${result.task.taskName}」已提交成果，当前状态：${result.task.status}。`
      ok = true
    } catch (error) {
      message = error instanceof Error ? error.message : '提交成果失败。'
    }
    const model = buildEngineeringMasterDetailModel(masterKey)
    if (model) {
      refreshLanesRegion(model)
      refreshTaskDrawer(model, detailUiState.selectedTaskId)
    }
    showDetailFeedback(message, ok)
    return true
  }
  if (action === 'submit-pre-production-sample-result') {
    const taskId = actionNode.dataset.taskId || ''
    const masterKey = currentMasterKey()
    if (!taskId || !masterKey) return true
    const imageField = document.querySelector<HTMLInputElement>(`[data-${DETAIL_EVENT_PREFIX}-field="sample-result-images"]`)
    const quantityField = document.querySelector<HTMLInputElement>(`[data-${DETAIL_EVENT_PREFIX}-field="sample-result-quantity"]`)
    const submittedByField = document.querySelector<HTMLInputElement>(`[data-${DETAIL_EVENT_PREFIX}-field="sample-result-submitted-by"]`)
    const resultImageIds = (imageField?.value ?? '')
      .split(/[,，]/)
      .map((item) => item.trim())
      .filter(Boolean)
    const resultQuantity = Number(quantityField?.value ?? 0)
    const submittedBy = submittedByField?.value ?? ''
    let message = ''
    let ok = false
    try {
      const result = submitEngineeringTaskResult(masterKey, taskId, {
        resultImageIds,
        resultQuantity,
        submittedBy,
      })
      message = `「${result.task.taskName}」成果已提交，任务已完成。`
      ok = true
    } catch (error) {
      message = error instanceof Error ? error.message : '提交样衣成果失败。'
    }
    if (!ok) {
      showPreProductionSampleResultError(message)
      return true
    }
    const model = buildEngineeringMasterDetailModel(masterKey)
    if (model) {
      refreshLanesRegion(model)
      refreshTaskDrawer(model, detailUiState.selectedTaskId)
    }
    showDetailFeedback(message, ok)
    return true
  }
  if (action === 'close-master-order') {
    const masterKey = currentMasterKey()
    if (!masterKey) return true
    let message = ''
    let ok = false
    try {
      const currentModel = buildEngineeringMasterDetailModel(masterKey)
      if (!currentModel) throw new Error('未找到工程主单，无法关闭。')
      closeEngineeringMasterOrder(masterKey, resolveEngineeringMasterDemoOperatorName(currentModel))
      message = '工程主单已关闭。'
      ok = true
    } catch (error) {
      message = error instanceof Error ? error.message : '关闭工程主单失败。'
    }
    const model = buildEngineeringMasterDetailModel(masterKey)
    if (model) refreshMasterHeader(model)
    showDetailFeedback(message, ok)
    return true
  }
  return false
}

function currentMasterKey(): string {
  if (typeof window === 'undefined') return ''
  const match = /^\/pcs\/engineering\/masters\/([^/]+)$/.exec(window.location.pathname)
  return match?.[1] ?? ''
}

export function isPcsEngineeringMasterDetailDialogOpen(): boolean {
  return detailUiState.drawerOpen
}
