import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import { productionOrders } from '../data/fcs/production-orders'
import { processTasks } from '../data/fcs/process-tasks'
import {
  type HandoverFocus,
  buildHandoverPageLink,
  getHandoverLedgerRows,
  getHandoverOrderTimelineViewById,
  getProductionOrderHandoverSummary,
  type HandoverLedgerRow,
  type HandoverTimelineProcessSection,
} from '../data/fcs/handover-ledger-view'
import {
  buildHandoverOrderLink,
  buildQualityRecordLink,
  buildTaskDetailLink,
} from '../data/fcs/fcs-route-links.ts'
import {
  getPostExecutionModeLabel,
  getPostProcessRouteByProductionOrderId,
  getPostRouteNodeLabel,
} from '../data/fcs/post-process-route'
import { getQcViewRows } from './qc-records/context'

type HandoverOrderDetailTab = 'time' | 'process'

interface ProgressHandoverOrderState {
  orderId: string
  activeTab: HandoverOrderDetailTab
  taskIdHint: string
  focusHint: HandoverFocus | ''
  sourceHint: string
}

const state: ProgressHandoverOrderState = {
  orderId: '',
  activeTab: 'time',
  taskIdHint: '',
  focusHint: '',
  sourceHint: '',
}

function isHandoverFocus(value: string | null): value is HandoverFocus {
  return value === 'pickup' || value === 'handout' || value === 'warehouse-confirm' || value === 'objection'
}

function getCurrentPathname(): string {
  return appStore.getState().pathname || ''
}

function getCurrentSearchParams(): URLSearchParams {
  const pathname = getCurrentPathname()
  const query = pathname.split('?')[1] || ''
  return new URLSearchParams(query)
}

function parseOrderIdFromPath(pathname: string): string {
  const purePath = pathname.split('?')[0].split('#')[0]
  const matched = /^\/fcs\/progress\/handover\/order\/([^/]+)$/.exec(purePath)
  if (!matched) return ''
  return decodeURIComponent(matched[1])
}

function getOrderName(orderId: string): string {
  const order = productionOrders.find((item) => item.productionOrderId === orderId)
  return order?.demandSnapshot.spuName || '未识别 SPU'
}

function getFocusLabel(focus: HandoverFocus): string {
  if (focus === 'pickup') return '待领料'
  if (focus === 'handout') return '待交出'
  if (focus === 'warehouse-confirm') return '待接收方回写'
  return '异议处理'
}

function parseDateMs(value: string | undefined): number {
  if (!value) return Number.NaN
  return new Date(value.replace(' ', 'T')).getTime()
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded border px-2 py-0.5 text-xs ${className}">${escapeHtml(label)}</span>`
}

function getReceivingQcHref(productionOrderId: string): string {
  const row = getQcViewRows().find(
    (item) => item.productionOrderId === productionOrderId && item.qc.inspectionScene !== 'POST_FINAL_RECHECK',
  )
  return row ? buildQualityRecordLink(row.qcId) : ''
}

function getFinalRecheckHref(productionOrderId: string): string {
  const row = getQcViewRows().find(
    (item) => item.productionOrderId === productionOrderId && item.qc.inspectionScene === 'POST_FINAL_RECHECK',
  )
  return row ? buildQualityRecordLink(row.qcId) : ''
}

function renderStatusBadge(row: HandoverLedgerRow): string {
  const toneClass =
    row.statusTone === 'success'
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
      : row.statusTone === 'warning'
        ? 'bg-amber-100 text-amber-700 border-amber-200'
        : row.statusTone === 'danger'
          ? 'bg-red-100 text-red-700 border-red-200'
          : row.statusTone === 'info'
            ? 'bg-blue-100 text-blue-700 border-blue-200'
            : 'bg-zinc-100 text-zinc-700 border-zinc-200'

  return renderBadge(row.statusLabel, toneClass)
}

function resolveRouteStageLabel(params: {
  currentNode: string
  requiresPostExecution: boolean
  stage: 'receivingQc' | 'postExecution' | 'finalRecheck' | 'warehouseHandover'
}): string {
  const { currentNode, requiresPostExecution, stage } = params

  if (stage === 'receivingQc') {
    if (currentNode === 'WAIT_RECEIVING_QC') return '待回货质检'
    if (currentNode === 'WAIT_SEW_HANDOVER' || currentNode === 'WAIT_RECEIVER_WRITEBACK') return '未开始'
    return '已完成'
  }

  if (stage === 'postExecution') {
    if (!requiresPostExecution) return '车缝厂已含后道'
    if (currentNode === 'WAIT_POST_EXECUTION') return '待后道'
    if (currentNode === 'WAIT_SEW_HANDOVER' || currentNode === 'WAIT_RECEIVER_WRITEBACK' || currentNode === 'WAIT_RECEIVING_QC') {
      return '未开始'
    }
    return '已完成'
  }

  if (stage === 'finalRecheck') {
    if (currentNode === 'WAIT_FINAL_RECHECK') return '待复检'
    if (currentNode === 'WAIT_WAREHOUSE_HANDOVER' || currentNode === 'CLOSED') return '已完成'
    return '未开始'
  }

  if (currentNode === 'WAIT_WAREHOUSE_HANDOVER') return '待交成衣仓'
  if (currentNode === 'CLOSED') return '已关闭'
  return '未开始'
}

function renderPostRouteCard(orderId: string): string {
  const route = getPostProcessRouteByProductionOrderId(orderId)
  if (!route) return ''
  const receivingQcHref = getReceivingQcHref(orderId)
  const finalRecheckHref = getFinalRecheckHref(orderId)

  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex flex-wrap items-center gap-2">
        <h2 class="text-sm font-semibold">后道路由</h2>
        <span class="inline-flex rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">${escapeHtml(
          getPostExecutionModeLabel(route.postExecutionMode),
        )}</span>
        <span class="text-xs text-muted-foreground">接收方：${escapeHtml(route.managedPostFactoryName)}</span>
        <span class="text-xs text-muted-foreground">当前节点：${escapeHtml(getPostRouteNodeLabel(route.currentNode))}</span>
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-4">
        <div class="rounded-md border bg-background px-3 py-2 text-xs">
          <p class="text-muted-foreground">回货质检</p>
          <p class="mt-1 font-medium text-foreground">${escapeHtml(resolveRouteStageLabel({ currentNode: route.currentNode, requiresPostExecution: route.requiresPostExecution, stage: 'receivingQc' }))}</p>
          ${
            receivingQcHref
              ? `<button type="button" class="mt-2 inline-flex rounded-md border px-2 py-1 text-[11px] hover:bg-muted" data-handover-order-action="open-quality-record" data-title="质检记录" data-href="${escapeHtml(receivingQcHref)}">质检记录</button>`
              : ''
          }
        </div>
        <div class="rounded-md border bg-background px-3 py-2 text-xs">
          <p class="text-muted-foreground">后道状态</p>
          <p class="mt-1 font-medium text-foreground">${escapeHtml(resolveRouteStageLabel({ currentNode: route.currentNode, requiresPostExecution: route.requiresPostExecution, stage: 'postExecution' }))}</p>
        </div>
        <div class="rounded-md border bg-background px-3 py-2 text-xs">
          <p class="text-muted-foreground">后道复检</p>
          <p class="mt-1 font-medium text-foreground">${escapeHtml(resolveRouteStageLabel({ currentNode: route.currentNode, requiresPostExecution: route.requiresPostExecution, stage: 'finalRecheck' }))}</p>
          ${
            finalRecheckHref
              ? `<button type="button" class="mt-2 inline-flex rounded-md border px-2 py-1 text-[11px] hover:bg-muted" data-handover-order-action="open-quality-record" data-title="复检记录" data-href="${escapeHtml(finalRecheckHref)}">复检记录</button>`
              : ''
          }
        </div>
        <div class="rounded-md border bg-background px-3 py-2 text-xs">
          <p class="text-muted-foreground">成衣仓交接</p>
          <p class="mt-1 font-medium text-foreground">${escapeHtml(resolveRouteStageLabel({ currentNode: route.currentNode, requiresPostExecution: route.requiresPostExecution, stage: 'warehouseHandover' }))}</p>
        </div>
      </div>
    </section>
  `
}

function isRowFocused(row: HandoverLedgerRow): boolean {
  if (state.taskIdHint && row.taskId === state.taskIdHint) return true
  if (!state.focusHint) return false

  if (state.focusHint === 'pickup') {
    return row.eventTypeCode === 'PICKUP_HEAD' || row.eventTypeCode === 'PICKUP_RECORD'
  }
  if (state.focusHint === 'handout') {
    return row.eventTypeCode === 'HANDOUT_HEAD' || row.eventTypeCode === 'HANDOUT_RECORD'
  }
  if (state.focusHint === 'warehouse-confirm') {
    return row.eventTypeCode === 'WAREHOUSE_CONFIRMED' || row.statusCode === 'HANDOUT_RECORD_PENDING_WRITEBACK'
  }
  return row.eventTypeCode === 'HANDOUT_OBJECTION' || row.eventTypeCode === 'HANDOUT_OBJECTION_PROCESSING' || row.eventTypeCode === 'HANDOUT_OBJECTION_RESOLVED'
}

function isSectionFocused(section: HandoverTimelineProcessSection): boolean {
  if (state.taskIdHint && section.taskId === state.taskIdHint) return true
  if (!state.focusHint) return false

  if (state.focusHint === 'pickup') return section.processStatusLabel === '待领料'
  if (state.focusHint === 'handout') return section.processStatusLabel === '待交出' || section.processStatusLabel === '已领料待交出'
  if (state.focusHint === 'warehouse-confirm') return section.processStatusLabel === '已交出待接收方回写'
  if (state.focusHint === 'objection') return section.processStatusLabel === '有异议' || section.processStatusLabel === '异议处理中'
  return false
}

function resolveSectionTone(section: HandoverTimelineProcessSection): string {
  if (section.processStatusTone === 'success') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  if (section.processStatusTone === 'warning') return 'bg-amber-100 text-amber-700 border-amber-200'
  if (section.processStatusTone === 'danger') return 'bg-red-100 text-red-700 border-red-200'
  if (section.processStatusTone === 'info') return 'bg-blue-100 text-blue-700 border-blue-200'
  return 'bg-zinc-100 text-zinc-700 border-zinc-200'
}

function openLinkedPage(title: string, href: string): void {
  appStore.openTab({
    key: href,
    title,
    href,
    closable: true,
  })
}

function syncStateFromPath(pathname: string): void {
  const previousOrderId = state.orderId
  state.orderId = parseOrderIdFromPath(pathname)
  const params = getCurrentSearchParams()
  const tab = params.get('tab')
  const taskId = params.get('taskId') || ''
  const focus = params.get('focus')
  const source = params.get('source') || ''

  if (tab === 'process' || tab === 'time') {
    state.activeTab = tab
  } else if (state.orderId !== previousOrderId) {
    state.activeTab = 'time'
  }
  state.taskIdHint = taskId
  state.focusHint = isHandoverFocus(focus) ? focus : ''
  state.sourceHint = source
}

function syncDetailTabToUrl(tab: HandoverOrderDetailTab): void {
  if (!state.orderId) return
  const params = getCurrentSearchParams()
  params.set('tab', tab)
  const query = params.toString()
  const href = `/fcs/progress/handover/order/${encodeURIComponent(state.orderId)}${query ? `?${query}` : ''}`
  appStore.navigate(href)
}

function renderHeader(summary: ReturnType<typeof getProductionOrderHandoverSummary>): string {
  return `
    <header class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-xl font-semibold">${escapeHtml(summary.productionOrderNo || state.orderId)}</h1>
      <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-handover-order-action="back-list">
        <i data-lucide="arrow-left" class="mr-1.5 h-4 w-4"></i>返回生产单列表
      </button>
    </header>
  `
}

function renderTabs(): string {
  return `
    <div class="inline-flex rounded-lg border bg-card p-1 text-sm">
      <button class="rounded px-3 py-1.5 ${state.activeTab === 'time' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-handover-order-action="switch-tab" data-tab="time">按时间</button>
      <button class="rounded px-3 py-1.5 ${state.activeTab === 'process' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-handover-order-action="switch-tab" data-tab="process">按工序工艺</button>
    </div>
  `
}

function createEmptyProcessSection(
  taskId: string,
  taskNo: string,
  seq: number,
  processName: string,
): HandoverTimelineProcessSection {
  return {
    taskId,
    taskNo,
    seq,
    processName,
    processStatusLabel: '暂无事件',
    processStatusTone: 'muted',
    nextActionHint: '当前工序暂无领料或交出事件',
    latestOccurredAt: '',
    eventCount: 0,
    events: [],
  }
}

function getTaskDisplayNo(task: { taskId: string }): string {
  // 当前 ProcessTask 无 taskNo 字段，统一展示为 taskId，避免散落的不存在字段依赖。
  return task.taskId
}

function getCompleteProcessSections(
  orderId: string,
  view: ReturnType<typeof getHandoverOrderTimelineViewById>,
): HandoverTimelineProcessSection[] {
  const orderTasks = processTasks
    .filter((task) => task.productionOrderId === orderId)
    .sort((a, b) => a.seq - b.seq)

  if (orderTasks.length === 0) return view?.processSections ?? []

  const sectionByTaskId = new Map((view?.processSections ?? []).map((section) => [section.taskId, section]))

  // PDA 演示数据里，部分生产单仅配置了单任务；这里补齐最小工序骨架，保证完整工序链可读。
  const shouldUsePdaTemplate = orderTasks.length === 1 && orderTasks[0].taskId.startsWith('PDA-EXEC-')
  const processSkeleton = shouldUsePdaTemplate
    ? [
        { seq: 1, processName: '裁片' },
        { seq: 2, processName: '车缝' },
        { seq: 3, processName: '后道' },
      ]
    : orderTasks.map((task) => ({ seq: task.seq, processName: task.processNameZh }))

  const sections = processSkeleton.map((node) => {
    const matchedTask =
      orderTasks.find((task) => task.seq === node.seq) ||
      orderTasks.find((task) => task.processNameZh === node.processName)

    if (!matchedTask) {
      return createEmptyProcessSection(
        `${orderId}-SEQ-${node.seq}`,
        `${orderId}-T${node.seq}`,
        node.seq,
        node.processName,
      )
    }

    const existed = sectionByTaskId.get(matchedTask.taskId)
    if (!existed) {
      return createEmptyProcessSection(
        matchedTask.taskId,
        getTaskDisplayNo(matchedTask),
        matchedTask.seq,
        matchedTask.processNameZh,
      )
    }

    return {
      ...existed,
      taskId: matchedTask.taskId,
      taskNo: getTaskDisplayNo(matchedTask),
      seq: matchedTask.seq,
      processName: matchedTask.processNameZh,
    }
  })

  const includedTaskIds = new Set(sections.map((section) => section.taskId))
  const extraSections = (view?.processSections ?? []).filter((section) => !includedTaskIds.has(section.taskId))

  return [...sections, ...extraSections].sort((a, b) => a.seq - b.seq)
}

function renderTimeTab(rows: HandoverLedgerRow[]): string {
  const sorted = [...rows].sort((a, b) => parseDateMs(a.occurredAt) - parseDateMs(b.occurredAt))

  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="space-y-3">
        ${
          sorted.length === 0
            ? '<div class="rounded-md border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">当前生产单暂无交接事件</div>'
            : sorted
                .map(
                  (row) => `
                    <article class="rounded-md border bg-background p-3 ${isRowFocused(row) ? 'ring-1 ring-blue-400 bg-blue-50/30' : ''}">
                      <div class="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p class="inline-flex items-center gap-1.5 text-sm font-medium">
                            <i data-lucide="workflow" class="h-3.5 w-3.5 text-muted-foreground"></i>
                            ${escapeHtml(row.eventTypeLabel)}
                            ${renderStatusBadge(row)}
                          </p>
                          <p class="mt-1 text-xs text-muted-foreground">任务：${escapeHtml(row.taskNo)} · 工序：${escapeHtml(row.processName)}</p>
                          <p class="mt-1 text-sm">${escapeHtml(row.qtySummary)}</p>
                          <p class="mt-1 text-xs text-muted-foreground">来源：${escapeHtml(row.sourceModuleLabel)} · 下一步：${escapeHtml(row.nextActionHint)}</p>
                        </div>
                        <div class="shrink-0 text-right text-xs text-muted-foreground">${escapeHtml(row.occurredAt || '-')}</div>
                      </div>
                      <div class="mt-3 flex flex-wrap gap-2">
                        <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-handover-order-action="goto-task" data-task-id="${escapeHtml(row.taskId)}">去任务</button>
                        <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-handover-order-action="goto-exception" data-po="${escapeHtml(row.productionOrderId)}" data-task-id="${escapeHtml(row.taskId)}">去异常定位与处理</button>
                        <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-handover-order-action="open-pda" data-handover-id="${escapeHtml(row.handoverId)}">查看交出详情</button>
                      </div>
                    </article>
                  `,
                )
                .join('')
        }
      </div>
    </section>
  `
}

function renderProcessTab(view: ReturnType<typeof getHandoverOrderTimelineViewById>): string {
  const sections = getCompleteProcessSections(state.orderId, view)

  return `
    <section class="space-y-4">
      ${
        sections.length === 0
          ? '<div class="rounded-lg border bg-card px-3 py-8 text-center text-sm text-muted-foreground">当前生产单暂无工序数据</div>'
          : sections
              .map((section) => {
                const focused = isSectionFocused(section)
                return `
                  <article class="rounded-lg border bg-card p-4 ${focused ? 'ring-1 ring-blue-400' : ''}">
                    <div class="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p class="text-sm font-medium">${section.seq}. ${escapeHtml(section.processName || '未识别工序')}</p>
                        <p class="mt-0.5 text-xs text-muted-foreground">${escapeHtml(section.taskNo)}</p>
                      </div>
                      ${renderBadge(section.processStatusLabel, resolveSectionTone(section))}
                    </div>
                    <p class="mt-2 text-xs text-muted-foreground">下一步：${escapeHtml(section.nextActionHint)}</p>
                    ${
                      section.events.length === 0
                        ? '<div class="mt-3 rounded-md border border-dashed px-3 py-3 text-xs text-muted-foreground">当前工序暂无领料或交出事件</div>'
                        : `<div class="mt-3 space-y-2">
                            ${section.events
                              .map(
                                (event) => `
                                  <button class="w-full rounded-md border bg-muted/20 p-2 text-left transition hover:bg-muted/40" data-handover-order-action="open-pda" data-handover-id="${escapeHtml(event.handoverId)}">
                                    <div class="flex items-start justify-between gap-2">
                                      <div>
                                        <p class="inline-flex items-center gap-1.5 text-xs font-medium">
                                          <i data-lucide="workflow" class="h-3.5 w-3.5 text-muted-foreground"></i>
                                          ${escapeHtml(event.eventTypeLabel)}
                                          ${renderStatusBadge(event)}
                                        </p>
                                        <p class="mt-1 text-xs">${escapeHtml(event.qtySummary)}</p>
                                        <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(event.sourceModuleLabel)} · ${escapeHtml(event.nextActionHint)}</p>
                                      </div>
                                      <div class="shrink-0 text-right text-xs text-muted-foreground">${escapeHtml(event.occurredAt || '-')}</div>
                                    </div>
                                  </button>
                                `,
                              )
                              .join('')}
                          </div>`
                    }
                  </article>
                `
              })
              .join('')
      }
    </section>
  `
}

function renderPage(pathname: string): string {
  syncStateFromPath(pathname)
  if (!state.orderId) {
    return '<div class="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">未识别生产单，请返回交接链路列表重试</div>'
  }

  const rows = getHandoverLedgerRows().filter((row) => row.productionOrderId === state.orderId)
  const timelineView = getHandoverOrderTimelineViewById(getHandoverLedgerRows(), state.orderId)
  const summary = getProductionOrderHandoverSummary(state.orderId)

  return `
    <div class="space-y-4">
      ${renderHeader(summary)}
      ${renderPostRouteCard(state.orderId)}
      ${renderTabs()}
      ${state.activeTab === 'time' ? renderTimeTab(rows) : renderProcessTab(timelineView)}
    </div>
  `
}

export function renderProgressHandoverOrderPage(productionOrderId: string): string {
  const pathname = appStore.getState().pathname || `/fcs/progress/handover/order/${productionOrderId}`
  return renderPage(pathname)
}

function handleAction(action: string, actionNode: HTMLElement): boolean {
  if (action === 'switch-tab') {
    const tab = actionNode.dataset.tab
    if (tab === 'time' || tab === 'process') {
      state.activeTab = tab
      syncDetailTabToUrl(tab)
    }
    return true
  }

  if (action === 'back-list') {
    openLinkedPage('交接链路追踪', buildHandoverPageLink({ tab: 'orders', source: '交接详情' }))
    return true
  }

  if (action === 'goto-task') {
    const taskId = actionNode.dataset.taskId
    if (taskId) {
      openLinkedPage('任务详情', buildTaskDetailLink(taskId))
    }
    return true
  }

  if (action === 'open-quality-record') {
    const href = actionNode.dataset.href
    if (href) {
      openLinkedPage(actionNode.dataset.title || '质检记录', href)
    }
    return true
  }

  if (action === 'goto-exception') {
    const po = actionNode.dataset.po || state.orderId
    const taskId = actionNode.dataset.taskId || ''
    const query = taskId ? `?po=${encodeURIComponent(po)}&taskId=${encodeURIComponent(taskId)}` : `?po=${encodeURIComponent(po)}`
    openLinkedPage('异常定位与处理', `/fcs/progress/exceptions${query}`)
    return true
  }

  if (action === 'open-pda') {
    const handoverId = actionNode.dataset.handoverId
    if (handoverId) {
      openLinkedPage(`交出单详情 ${handoverId}`, buildHandoverOrderLink(handoverId))
    }
    return true
  }

  return false
}

export function handleProgressHandoverOrderEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-handover-order-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.handoverOrderAction
  if (!action) return false
  return handleAction(action, actionNode)
}

export function isProgressHandoverOrderDialogOpen(): boolean {
  return false
}
