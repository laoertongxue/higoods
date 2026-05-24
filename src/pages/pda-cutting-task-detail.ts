import { escapeHtml } from '../utils'
import {
  buildPdaCuttingRoute,
  getPdaCuttingTaskSnapshot,
  type PdaCuttingRouteKey,
  type PdaCuttingTaskDetailData,
  type PdaCuttingTaskOrderLine,
} from '../data/fcs/pda-cutting-execution-source.ts'
import { listSpreadingResultGeneratedFeiTicketsByCutOrderId } from '../data/fcs/cutting/generated-fei-tickets.ts'
import {
  readSelectedExecutionOrderIdFromLocation,
  readSelectedExecutionOrderNoFromLocation,
  resolveSelectedExecutionOrderLine,
} from './pda-cutting-context'
import {
  resolvePdaCuttingWritebackIdentity,
  resolvePdaCuttingWritebackOperator,
} from '../data/fcs/pda-cutting-writeback-inputs.ts'
import { appendPdaCuttingStageWritebackRecord } from '../data/fcs/cutting/pda-cutting-stage-writeback.ts'
import {
  renderPdaCuttingEmptyState,
  renderPdaCuttingStatusChip,
} from './pda-cutting-shared'
import { renderMaterialIdentityBlock } from './process-factory/cutting/material-identity'
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

function renderMiniMaterialField(line: PdaCuttingTaskOrderLine): string {
  return `
    <div class="col-span-2 rounded-xl bg-muted/30 px-2.5 py-2">
      <div class="mb-1 text-[11px] text-muted-foreground">面料信息</div>
      ${renderMaterialIdentityBlock(
        {
          materialSku: line.materialSku,
          materialLabel: line.materialTypeLabel,
          materialAlias: line.materialAlias,
          materialImageUrl: line.materialImageUrl,
        },
        { compact: true, showCategory: false },
      )}
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

function renderFeiTicketIds(cutOrderId: string): string {
  const tickets = cutOrderId ? listSpreadingResultGeneratedFeiTicketsByCutOrderId(cutOrderId) : []
  if (!tickets.length) return '待生成菲票'
  const firstNos = tickets.slice(0, 3).map((ticket) => ticket.feiTicketNo).join(' / ')
  return tickets.length > 3 ? `${firstNos} 等 ${tickets.length} 张` : firstNos
}

function renderTraceIdentity(detail: PdaCuttingTaskDetailData): string {
  return `
    <section class="rounded-2xl border bg-card p-3 shadow-sm">
      <div class="flex items-center justify-between gap-2">
        <h2 class="text-sm font-semibold text-foreground">统一追踪 ID</h2>
        <span class="text-[11px] text-muted-foreground">任务 / 裁片单 / 菲票 / 交出共用</span>
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
        ${renderMiniField('裁片单号', detail.cutOrderNo)}
        ${renderMiniField('裁片单 ID', detail.cutOrderId)}
        ${renderMiniField('PDA 执行单号', detail.executionOrderNo)}
        ${renderMiniField('PDA 执行单 ID', detail.executionOrderId)}
        ${renderMiniField('菲票', renderFeiTicketIds(detail.cutOrderId))}
        ${renderMiniField('交出记录', detail.latestHandoverRecordNo || '待发起交出')}
      </div>
    </section>
  `
}

function renderCurrentReceiveBlock(detail: PdaCuttingTaskDetailData, backHref: string): string {
  return `
    <section class="rounded-2xl border bg-card p-3 shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold text-foreground">裁床领料</h2>
          <div class="mt-1 text-xs text-muted-foreground">领料确认统一在交接模块处理，任务详情只展示状态和入口。</div>
        </div>
        ${renderPdaCuttingStatusChip(detail.currentReceiveStatus, detail.currentReceiveStatus.includes('异议') ? 'red' : detail.currentReceiveStatus.includes('已') ? 'green' : 'amber')}
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
        ${renderMiniField('领料单', detail.pickupSlipNo)}
        ${renderMiniField('计划领料', detail.configuredQtyText)}
        ${renderMiniField('实领数量', detail.actualReceivedQtyText)}
        ${renderMiniField('差异说明', detail.discrepancyNote)}
      </div>
    </section>
  `
}

function renderOrderLine(taskId: string, line: PdaCuttingTaskOrderLine, backHref: string, selected: boolean): string {
  const actionHref = buildActionHref(taskId, line, backHref)
  const tone = line.isDone ? 'green' : line.hasException ? 'red' : line.currentStepCode === 'PICKUP' ? 'amber' : 'blue'
  const isStartAction = line.nextActionLabel === '开工'
  const primaryAction = isStartAction
    ? `<button class="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground" data-pda-cutting-task-action="start-work" data-task-id="${escapeHtml(taskId)}" data-execution-order-id="${escapeHtml(line.executionOrderId)}" data-execution-order-no="${escapeHtml(line.executionOrderNo)}">开工</button>`
    : `<button class="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground" data-nav="${escapeHtml(actionHref)}">${escapeHtml(line.nextActionLabel)}</button>`
  const exceptionLabel = line.currentStepCode === 'PICKUP' ? '领料差异' : '现场差异反馈'
  return `
    <article class="rounded-2xl border bg-card p-3 shadow-sm ${selected ? 'border-blue-300 ring-2 ring-blue-100' : ''}" data-pda-cutting-order-line="${escapeHtml(line.executionOrderId)}">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="text-[11px] text-muted-foreground">执行对象</div>
          <div class="mt-0.5 break-words text-base font-semibold text-foreground">${escapeHtml(line.executionOrderNo)}</div>
          <div class="mt-1 text-xs text-muted-foreground">裁片单 ${escapeHtml(line.cutOrderNo || '-')}</div>
        </div>
        ${renderPdaCuttingStatusChip(line.currentStepLabel, tone)}
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
        ${renderMiniField('生产单', line.productionOrderNo)}
        ${renderMiniMaterialField(line)}
        ${renderMiniField('计划数量', `${line.plannedQty.toLocaleString('zh-CN')} 件`)}
        ${renderMiniField('当前状态', line.currentStateLabel)}
        ${renderMiniField('现场步骤', line.currentStepLabel)}
        ${renderMiniField('同步状态', line.latestSyncStatus)}
      </div>
      ${primaryAction}
      <button class="mt-2 inline-flex min-h-9 w-full items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700" data-nav="${escapeHtml(buildPdaCuttingRoute(taskId, 'replenishment-feedback', {
        executionOrderId: line.executionOrderId,
        executionOrderNo: line.executionOrderNo,
        cutOrderId: line.cutOrderId,
        cutOrderNo: line.cutOrderNo,
        markerPlanId: line.markerPlanId,
        markerPlanNo: line.markerPlanNo,
        materialSku: line.materialSku,
        returnTo: backHref,
      }))}">${escapeHtml(exceptionLabel)}</button>
      <div class="mt-2 hidden rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-800" data-pda-cutting-task-feedback></div>
    </article>
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
          ${renderMetric('执行对象', `${detail.cutPieceOrderCount} 个`)}
          ${renderMetric('未完成', `${detail.pendingCutPieceOrderCount} 个`, detail.pendingCutPieceOrderCount ? 'amber' : 'green')}
          ${renderMetric('异常', `${detail.exceptionCutPieceOrderCount} 个`, detail.exceptionCutPieceOrderCount ? 'red' : 'default')}
          ${renderMetric('下一步', detail.nextRecommendedAction)}
        </section>

        ${renderCurrentReceiveBlock(detail, backHref)}

        <section class="space-y-2">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold text-foreground">执行对象</h2>
            <span class="text-xs text-muted-foreground">按裁片单追踪</span>
          </div>
          ${detail.cutPieceOrders.map((line) => renderOrderLine(decodedTaskId, line, backHref, selectedLine?.executionOrderId === line.executionOrderId)).join('')}
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
  const identity = resolvePdaCuttingWritebackIdentity(taskId, {
    executionOrderId,
    executionOrderNo,
  })
  const feedback = button.closest<HTMLElement>('[data-pda-cutting-order-line]')?.querySelector<HTMLElement>('[data-pda-cutting-task-feedback]')
  if (!identity) {
    if (feedback) {
      feedback.classList.remove('hidden', 'border-emerald-200', 'bg-emerald-50', 'text-emerald-800')
      feedback.classList.add('border-amber-200', 'bg-amber-50', 'text-amber-800')
      feedback.textContent = '同步失败：当前执行对象无法识别。'
    }
    return true
  }
  const operator = resolvePdaCuttingWritebackOperator(taskId, '裁床组长')
  const record = appendPdaCuttingStageWritebackRecord({
    taskId,
    executionOrderId: identity.executionOrderId,
    executionOrderNo: identity.executionOrderNo,
    cutOrderId: identity.cutOrderId,
    cutOrderNo: identity.cutOrderNo,
    markerPlanId: identity.markerPlanId,
    markerPlanNo: identity.markerPlanNo,
    actionType: 'START_WORK',
    operatorName: operator.operatorName,
    syncStatus: '已同步',
    note: 'PDA 开工写回，裁床任务进入可铺布。',
  })
  if (feedback) {
    feedback.classList.remove('hidden')
    feedback.textContent = `${record.syncStatus}：开工已提交，${record.submittedAt}`
  }
  button.textContent = '已开工'
  button.setAttribute('disabled', 'true')
  button.classList.add('opacity-70')
  return true
}
