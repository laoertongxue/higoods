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
import type {
  EngineeringMasterStatus,
  EngineeringTaskStatus,
} from '../data/pcs-engineering-master-types.ts'
import { escapeHtml } from '../utils.ts'

const DETAIL_EVENT_PREFIX = 'pcs-engineering-master'

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
  return `
    <header class="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-lg font-semibold">${escapeHtml(model.masterOrderCode)}</h1>
        ${renderStatusBadge(model.status)}
        <span class="text-sm text-slate-500">${escapeHtml(model.styleName)}（${escapeHtml(model.styleCode)}）</span>
      </div>
      <div class="flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span>跟单：${escapeHtml(model.merchandiserName)}</span>
        <span>创建：${escapeHtml(model.createdBy)} · ${escapeHtml(model.createdAt)}</span>
        ${model.publishedAt ? `<span>发布：${escapeHtml(model.publishedAt)}</span>` : ''}
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
  const taskRecord = model.lanes
    .flatMap((lane) => lane.tasks)
    .find((item) => item.taskId === task.taskId)
  if (!taskRecord) return ''

  const dependsOnHtml = task.dependsOnLabels.length > 0
    ? `<p class="text-sm text-slate-700">${escapeHtml(task.dependsOnLabels.join('、'))}</p>`
    : '<p class="text-sm text-slate-400">无前置依赖</p>'
  const requiredByHtml = task.requiredByLabels.length > 0
    ? `<p class="text-sm text-slate-700">${escapeHtml(task.requiredByLabels.join('、'))}</p>`
    : '<p class="text-sm text-slate-400">无下游任务</p>'

  const timingRows = [
    ['开始时间', task.startedAt || '—'],
    ['提交时间', task.submittedAt || '—'],
    ['首次完成', task.firstCompletedAt || '—'],
    ['当前完成', task.effectiveCompletedAt || '—'],
  ]
    .map(([label, value]) => `
      <div class="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-b-0">
        <span class="text-slate-500">${escapeHtml(label)}</span>
        <span class="text-slate-700">${escapeHtml(value)}</span>
      </div>
    `)
    .join('')

  const materialHtml = taskRecord.materialLines?.length
    ? taskRecord.materialLines.map((line) => `
        <div class="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-b-0">
          <span class="text-slate-700">${escapeHtml(line.materialName)}</span>
          <span class="text-xs text-slate-500">${escapeHtml(line.requirementType)}</span>
        </div>
      `).join('')
    : '<p class="text-sm text-slate-400">暂无物料明细</p>'

  const reworkHtml = taskRecord.reworkRounds?.length
    ? taskRecord.reworkRounds.map((round) => `
        <div class="border-b py-2 text-sm last:border-b-0">
          <p class="text-slate-700">第 ${round.roundNo} 轮返工</p>
          <p class="mt-0.5 text-xs text-slate-500">${escapeHtml(round.reason)} · 提交 ${escapeHtml(round.submittedAt)}</p>
        </div>
      `).join('')
    : '<p class="text-sm text-slate-400">暂无返工记录</p>'

  return `
    <div class="fixed inset-0 z-50 flex justify-end bg-black/30" data-engineering-master-drawer-backdrop>
      <aside class="flex h-full w-full max-w-md flex-col bg-white shadow-xl" role="dialog" aria-label="任务详情">
        <header class="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div class="flex items-center gap-2">
            <h2 class="text-base font-semibold">${escapeHtml(taskRecord.taskName)}</h2>
            ${renderTaskStatusBadge(taskRecord.status)}
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
              <p class="text-slate-700">责任团队：${escapeHtml(taskRecord.ownerTeamName)}</p>
            </div>
          </section>
          <section>
            <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">当前阶段与依赖</h3>
            <div class="space-y-1.5">
              <p class="text-sm text-slate-700">当前节点：${escapeHtml(taskRecord.currentNodeName)}</p>
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
      ${renderMasterHeader(model)}
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
