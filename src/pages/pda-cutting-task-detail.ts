import { escapeHtml } from '../utils'
import {
  buildPdaCuttingRoute,
  getPdaCuttingTaskSnapshot,
  type PdaCuttingRouteKey,
  type PdaCuttingTaskCutOrderGroup,
  type PdaCuttingTaskDetailData,
  type PdaCuttingTaskOrderLine,
} from '../data/fcs/pda-cutting-execution-source.ts'
import {
  readSelectedExecutionOrderIdFromLocation,
  readSelectedExecutionOrderNoFromLocation,
  resolveSelectedExecutionOrderLine,
} from './pda-cutting-context'
import {
  resolvePdaCuttingRuntimeIdentity,
  resolvePdaCuttingRuntimeOperator,
} from '../data/fcs/pda-cutting-runtime-action-inputs.ts'
import { appendCuttingRuntimeEvent } from '../data/fcs/cutting/cutting-runtime-event-ledger.ts'
import {
  renderPdaCuttingEmptyState,
  renderPdaCuttingStatusChip,
} from './pda-cutting-shared'
import { renderPdaFrame } from './pda-shell'

interface PdaCuttingTaskDetailOptions {
  backHref?: string
}

type ActionRouteKey = Exclude<PdaCuttingRouteKey, 'task' | 'unit'>

function buildPickupHref(taskId: string, backHref: string, line?: PdaCuttingTaskOrderLine): string {
  const params = new URLSearchParams()
  params.set('tab', 'pickup')
  params.set('focusTaskId', taskId)
  if (line?.executionOrderId) params.set('executionOrderId', line.executionOrderId)
  if (line?.executionOrderNo) params.set('executionOrderNo', line.executionOrderNo)
  if (backHref) params.set('returnTo', backHref)
  return `/fcs/pda/handover?${params.toString()}`
}

function buildActionHref(taskId: string, line: PdaCuttingTaskOrderLine, backHref: string): string {
  if (line.currentStepCode === 'START') return backHref || '/fcs/pda/exec?tab=NOT_STARTED'
  if (line.currentStepCode === 'PICKUP') return buildPickupHref(taskId, backHref, line)

  const routeKey = line.primaryExecutionRouteKey as ActionRouteKey
  return buildPdaCuttingRoute(taskId, routeKey, {
    executionOrderId: line.executionOrderId,
    executionOrderNo: line.executionOrderNo,
    cutOrderId: line.cutOrderId,
    cutOrderNo: line.cutOrderNo,
    markerPlanId: line.markerPlanId,
    markerPlanNo: line.markerPlanNo,
    materialSku: line.materialSku,
    returnTo: backHref,
  })
}

function renderMiniField(label: string, value: string): string {
  return `
    <div class="rounded-xl bg-muted/30 px-2.5 py-2">
      <div class="text-[11px] text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-1 break-words text-sm font-medium text-foreground">${escapeHtml(value || '-')}</div>
    </div>
  `
}

function renderMetric(label: string, value: string, tone: 'default' | 'green' | 'amber' | 'red' = 'default'): string {
  const valueClass =
    tone === 'green'
      ? 'text-emerald-700'
      : tone === 'amber'
        ? 'text-amber-700'
        : tone === 'red'
          ? 'text-red-700'
          : 'text-foreground'
  return `
    <article class="rounded-xl border bg-card px-3 py-2 shadow-sm">
      <div class="text-[11px] text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-1 text-base font-semibold ${valueClass}">${escapeHtml(value)}</div>
    </article>
  `
}

function renderActionButton(taskId: string, line: PdaCuttingTaskOrderLine, backHref: string, extraClass = ''): string {
  const actionHref = buildActionHref(taskId, line, backHref)
  const isStartAction = line.nextActionLabel === '开工'
  const className = `inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground ${extraClass}`.trim()
  return isStartAction
    ? `<button class="${className}" data-pda-cutting-task-action="start-work" data-task-id="${escapeHtml(taskId)}" data-execution-order-id="${escapeHtml(line.executionOrderId)}" data-execution-order-no="${escapeHtml(line.executionOrderNo)}">开工</button>`
    : `<button class="${className}" data-nav="${escapeHtml(actionHref)}">${escapeHtml(line.nextActionLabel)}</button>`
}

function renderPrimaryAction(taskId: string, detail: PdaCuttingTaskDetailData, line: PdaCuttingTaskOrderLine | null, backHref: string): string {
  if (!line) return renderPdaCuttingEmptyState('暂无可操作铺布单', '')
  const materialText = joinDisplayText([line.materialAlias || line.materialSku, line.colorLabel])
  return `
    <section class="rounded-2xl border border-blue-200 bg-blue-50 p-3 shadow-sm" data-pda-cutting-order-line="${escapeHtml(line.executionOrderId)}">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-xs font-medium text-blue-700">下一步</div>
          <div class="mt-1 text-xl font-semibold text-blue-950">${escapeHtml(detail.nextRecommendedAction)}</div>
          <div class="mt-1 text-xs text-blue-800">铺布单 ${escapeHtml(line.executionOrderNo)} / 裁片单 ${escapeHtml(line.cutOrderNo || '待绑定')}</div>
        </div>
        ${renderPdaCuttingStatusChip(line.currentStepLabel, line.hasException ? 'red' : line.isDone ? 'green' : 'blue')}
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2 text-xs text-blue-950">
        <div class="rounded-xl bg-white/70 px-2.5 py-2">
          <div class="text-blue-700">面料</div>
          <div class="mt-1 truncate font-semibold">${escapeHtml(materialText || '待确认')}</div>
        </div>
        <div class="rounded-xl bg-white/70 px-2.5 py-2">
          <div class="text-blue-700">计划数量</div>
          <div class="mt-1 font-semibold">${escapeHtml(`${line.plannedQty.toLocaleString('zh-CN')} 件`)}</div>
        </div>
      </div>
      ${renderActionButton(taskId, line, backHref, 'mt-3')}
      <div class="mt-2 hidden rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-800" data-pda-cutting-task-feedback></div>
    </section>
  `
}

function joinDisplayText(parts: Array<string | undefined | null>): string {
  return parts.map((part) => String(part || '').trim()).filter(Boolean).join(' / ')
}

function renderOrderLine(taskId: string, line: PdaCuttingTaskOrderLine, backHref: string, selected: boolean): string {
  const tone = line.isDone ? 'green' : line.hasException ? 'red' : line.currentStepCode === 'PICKUP' ? 'amber' : 'blue'
  return `
    <article class="rounded-2xl border bg-card p-3 shadow-sm ${selected ? 'border-blue-300 ring-2 ring-blue-100' : ''}" data-pda-cutting-order-line="${escapeHtml(line.executionOrderId)}">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="text-[11px] text-muted-foreground">铺布单</div>
          <div class="mt-0.5 break-words text-base font-semibold text-foreground">${escapeHtml(line.executionOrderNo)}</div>
          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(joinDisplayText([line.materialAlias || line.materialSku, line.colorLabel]) || '面料待确认')}</div>
        </div>
        ${renderPdaCuttingStatusChip(line.currentStepLabel, tone)}
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
        ${renderMiniField('计划数量', `${line.plannedQty.toLocaleString('zh-CN')} 件`)}
        ${renderMiniField('当前状态', line.currentStateLabel)}
      </div>
      ${renderActionButton(taskId, line, backHref, 'mt-3')}
      <div class="mt-2 hidden rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-800" data-pda-cutting-task-feedback></div>
    </article>
  `
}

function renderCutOrderGroup(
  taskId: string,
  group: PdaCuttingTaskCutOrderGroup,
  backHref: string,
  selectedLine: PdaCuttingTaskOrderLine | null,
  showGroupCount: boolean,
): string {
  const tone = group.exceptionSpreadingOrderCount ? 'red' : group.pendingSpreadingOrderCount ? 'blue' : 'green'
  const materialText = joinDisplayText([group.materialAlias || group.materialSku, group.colorLabel, group.materialTypeLabel])
  return `
    <section class="space-y-2 rounded-2xl border bg-card p-3 shadow-sm ${group.isSelected ? 'border-blue-300 ring-2 ring-blue-100' : ''}">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-[11px] text-muted-foreground">${showGroupCount ? '裁片单' : '当前裁片单'}</div>
          <h2 class="mt-0.5 break-words text-base font-semibold text-foreground">${escapeHtml(group.cutOrderNo || '待绑定裁片单')}</h2>
          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(materialText || '面料待确认')}</div>
        </div>
        ${renderPdaCuttingStatusChip(group.currentStateLabel, tone)}
      </div>
      <div class="grid grid-cols-3 gap-2 text-xs">
        ${renderMiniField('铺布单', `${group.spreadingOrderCount} 张`)}
        ${renderMiniField('未完成', `${group.pendingSpreadingOrderCount} 张`)}
        ${renderMiniField('下一步', group.nextActionLabel)}
      </div>
      <div class="space-y-2">
        ${group.spreadingOrders.map((line) => renderOrderLine(taskId, line, backHref, selectedLine?.executionOrderId === line.executionOrderId)).join('')}
      </div>
    </section>
  `
}

function renderRecentActions(detail: PdaCuttingTaskDetailData): string {
  if (!detail.recentActions.length) return renderPdaCuttingEmptyState('暂无操作记录', '')
  return `
    <section class="rounded-2xl border bg-card p-3 shadow-sm">
      <h2 class="text-sm font-semibold text-foreground">最近操作</h2>
      <div class="mt-3 space-y-2">
        ${detail.recentActions.slice(0, 4).map((action) => `
          <div class="rounded-xl border bg-muted/20 px-2.5 py-2 text-xs">
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium text-foreground">${escapeHtml(action.actionTypeLabel)}</span>
              <span class="text-muted-foreground">${escapeHtml(action.operatedAt)}</span>
            </div>
            <div class="mt-1 text-muted-foreground">${escapeHtml(action.operatedBy)} / ${escapeHtml(action.summary)}</div>
          </div>
        `).join('')}
      </div>
    </section>
  `
}

export function renderPdaCuttingTaskDetailPage(taskId: string, options: PdaCuttingTaskDetailOptions = {}): string {
  const decodedTaskId = decodeURIComponent(taskId)
  const selectedExecutionKey = readSelectedExecutionOrderIdFromLocation() || readSelectedExecutionOrderNoFromLocation() || undefined
  const detail = getPdaCuttingTaskSnapshot(decodedTaskId, selectedExecutionKey)
  const backHref = options.backHref || '/fcs/pda/exec'

  if (!detail) {
    return renderPdaFrame(
      `<section class="space-y-3 px-3 py-4">
        <button class="inline-flex items-center rounded-lg border px-2.5 py-1.5 text-sm" data-nav="${escapeHtml(backHref)}">返回</button>
        ${renderPdaCuttingEmptyState('未找到裁片任务', '')}
      </section>`,
      'exec',
      { disableTodoAutoOpen: true },
    )
  }

  const selectedLine = resolveSelectedExecutionOrderLine(
    detail,
    readSelectedExecutionOrderIdFromLocation(),
    readSelectedExecutionOrderNoFromLocation(),
  ) || detail.cutPieceOrders.find((line) => line.executionOrderId === detail.currentSelectedExecutionOrderId) || detail.cutPieceOrders[0] || null

  return renderPdaFrame(
    `
      <section class="space-y-3 px-3 py-3">
        <header class="space-y-2">
          <button class="inline-flex items-center rounded-lg border px-2.5 py-1.5 text-sm" data-nav="${escapeHtml(backHref)}">返回</button>
          <section class="rounded-2xl border bg-card p-3 shadow-sm">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-xs text-muted-foreground">裁片任务</div>
                <h1 class="mt-1 break-words text-lg font-semibold text-foreground">${escapeHtml(detail.taskNo)}</h1>
                <div class="mt-1 text-xs text-muted-foreground">生产单 ${escapeHtml(detail.productionOrderNo)} / 当前 ${escapeHtml(detail.currentStage)}</div>
              </div>
              ${renderPdaCuttingStatusChip(detail.taskStatusLabel, detail.taskStatusLabel === '已完成' ? 'green' : detail.taskStatusLabel === '有异常' ? 'red' : 'blue')}
            </div>
          </section>
        </header>

        <section class="grid grid-cols-2 gap-2">
          ${renderMetric('裁片单', `${detail.cutOrderGroups.length} 张`)}
          ${renderMetric('铺布单', `${detail.cutPieceOrderCount} 张`)}
          ${renderMetric('未完成', `${detail.pendingCutPieceOrderCount} 张`, detail.pendingCutPieceOrderCount ? 'amber' : 'green')}
          ${renderMetric('异常', `${detail.exceptionCutPieceOrderCount} 张`, detail.exceptionCutPieceOrderCount ? 'red' : 'default')}
        </section>

        ${renderPrimaryAction(decodedTaskId, detail, selectedLine, backHref)}

        <section class="space-y-2">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold text-foreground">裁片单与铺布单</h2>
            <span class="text-xs text-muted-foreground">${escapeHtml(detail.cutOrderGroups.length > 1 ? '按裁片单分组，避免选错' : '直接进入铺布操作')}</span>
          </div>
          ${detail.cutOrderGroups.map((group) => renderCutOrderGroup(decodedTaskId, group, backHref, selectedLine, detail.cutOrderGroups.length > 1)).join('')}
        </section>

        ${renderRecentActions(detail)}
      </section>
    `,
    'exec',
    { disableTodoAutoOpen: true },
  )
}

export function handlePdaCuttingTaskDetailEvent(target: HTMLElement): boolean {
  const button = target.closest<HTMLElement>('[data-pda-cutting-task-action="start-work"]')
  if (!button) return false
  const taskId = button.dataset.taskId || ''
  const executionOrderId = button.dataset.executionOrderId || ''
  const executionOrderNo = button.dataset.executionOrderNo || ''
  const identity = resolvePdaCuttingRuntimeIdentity(taskId, {
    executionOrderId,
    executionOrderNo,
  })
  const feedback = button.closest<HTMLElement>('[data-pda-cutting-order-line]')?.querySelector<HTMLElement>('[data-pda-cutting-task-feedback]')
  if (!identity) {
    if (feedback) {
      feedback.classList.remove('hidden', 'border-emerald-200', 'bg-emerald-50', 'text-emerald-800')
      feedback.classList.add('border-amber-200', 'bg-amber-50', 'text-amber-800')
      feedback.textContent = '同步失败：当前铺布单无法识别。'
    }
    return true
  }
  const operator = resolvePdaCuttingRuntimeOperator(taskId, '裁床组长')
  const startedAt = new Date().toISOString().slice(0, 16).replace('T', ' ')
  const event = appendCuttingRuntimeEvent({
    eventType: '裁片单开工',
    eventSource: 'PDA',
    eventStatus: '已同步',
    occurredAt: startedAt,
    operatorId: operator.operatorAccountId,
    operatorName: operator.operatorName,
    operatorRole: operator.operatorRole || '裁床组长',
    refs: {
      productionOrderId: identity.productionOrderId,
      productionOrderNo: identity.productionOrderNo,
      cutOrderId: identity.cutOrderId,
      cutOrderNo: identity.cutOrderNo,
      markerPlanId: identity.markerPlanId,
      markerPlanNo: identity.markerPlanNo,
      spreadingOrderId: identity.executionOrderId,
      spreadingOrderNo: identity.executionOrderNo,
    },
    payload: {
      cutOrderId: identity.cutOrderId,
      cutOrderNo: identity.cutOrderNo,
      startedAt,
      startedBy: operator.operatorName,
      startSource: 'PDA',
    },
  })
  if (feedback) {
    feedback.classList.remove('hidden')
    feedback.textContent = `已同步：开工已提交，${event.occurredAt}`
  }
  button.textContent = '已开工'
  button.setAttribute('disabled', 'true')
  button.classList.add('opacity-70')
  return true
}
