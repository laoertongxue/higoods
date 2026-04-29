import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import { formatFactoryDisplayName } from '../data/fcs/factory-mock-data.ts'
import {
  getPdaCuttingTaskSnapshot,
  type PdaCuttingTaskDetailData,
  type PdaCuttingTaskOrderLine,
} from '../data/fcs/pda-cutting-execution-source.ts'
import { getClaimDisputeStatusMeta } from '../helpers/fcs-claim-dispute'
import { getLatestClaimDisputeByTaskId } from '../state/fcs-claim-dispute-store'
import {
  readSelectedExecutionOrderIdFromLocation,
  readSelectedExecutionOrderNoFromLocation,
} from './pda-cutting-context'
import {
  buildPdaCuttingExecutionUnitNavHref,
  buildPdaCuttingTaskDetailFocusHref,
  getPdaCuttingCompletedActionLabel,
  readPdaCuttingNavContext,
  resolvePdaCuttingBackHref,
  type PdaCuttingNavContext,
} from './pda-cutting-nav-context'
import {
  buildPdaCuttingTaskOrderActions,
  resolvePdaCuttingTaskOrderCurrentStepLabel,
  resolvePdaCuttingTaskOverviewStatusLabel,
} from './pda-cutting-task-detail-helpers'
import {
  renderPdaCuttingEmptyState,
  renderPdaCuttingPageLayout,
  renderPdaCuttingSection,
} from './pda-cutting-shared'

interface PdaCuttingTaskDetailPageState {
  qrExpanded: boolean
  expandedExecutionOrderIds: string[]
  hasMultipleCutPieceOrders: boolean
  lastFocusToken: string
}

interface PdaCuttingTaskDetailRenderOptions {
  backHref?: string
}

const pageStateStore = new Map<string, PdaCuttingTaskDetailPageState>()
let lastFocusedOrderToken = ''

function getPageState(taskId: string): PdaCuttingTaskDetailPageState {
  const existing = pageStateStore.get(taskId)
  if (existing) return existing

  const initial: PdaCuttingTaskDetailPageState = {
    qrExpanded: false,
    expandedExecutionOrderIds: [],
    hasMultipleCutPieceOrders: false,
    lastFocusToken: '',
  }
  pageStateStore.set(taskId, initial)
  return initial
}

function resolveSafeBackHref(explicitBackHref?: string): string {
  if (explicitBackHref) return explicitBackHref
  return resolvePdaCuttingBackHref(readPdaCuttingNavContext(), '/fcs/pda/task-receive')
}

function resolveCurrentTaskDetailHref(): string {
  return appStore.getState().pathname
}

function scheduleOrderFocus(executionOrderId: string | null, autoFocus: boolean): void {
  if (!executionOrderId || !autoFocus || typeof document === 'undefined' || typeof window === 'undefined') return
  const focusToken = `${appStore.getState().pathname}::${executionOrderId}`
  if (lastFocusedOrderToken === focusToken) return
  lastFocusedOrderToken = focusToken
  window.requestAnimationFrame(() => {
    const card = document.querySelector<HTMLElement>(`[data-pda-cutting-order-card-id="${executionOrderId}"]`)
    card?.scrollIntoView({ block: 'center' })
  })
}

function syncFocusDrivenState(
  state: PdaCuttingTaskDetailPageState,
  navContext: PdaCuttingNavContext,
  focusExecutionOrderId: string | null,
): void {
  const focusToken = `${focusExecutionOrderId || ''}|${navContext.autoExpandActions ? '1' : '0'}|${navContext.justCompletedAction || ''}|${navContext.justSaved ? '1' : '0'}`
  if (state.lastFocusToken === focusToken) return
  state.lastFocusToken = focusToken

  if (
    navContext.autoExpandActions &&
    focusExecutionOrderId &&
    !state.expandedExecutionOrderIds.includes(focusExecutionOrderId)
  ) {
    state.expandedExecutionOrderIds = [...state.expandedExecutionOrderIds, focusExecutionOrderId]
  }
}

function renderStatusChip(label: string, tone: 'slate' | 'green' | 'amber' | 'red' | 'blue'): string {
  const className =
    tone === 'green'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : tone === 'red'
          ? 'border-red-200 bg-red-50 text-red-700'
          : tone === 'blue'
            ? 'border-blue-200 bg-blue-50 text-blue-700'
            : 'border-slate-200 bg-slate-50 text-slate-700'

  return `<span class="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${className}">${escapeHtml(label)}</span>`
}

function renderInfoGrid(items: Array<{ label: string; value: string; hint?: string }>): string {
  return `
    <div class="grid grid-cols-2 gap-3 text-xs">
      ${items
        .map(
          (item) => `
            <article class="rounded-xl border bg-muted/20 px-3 py-3">
              <div class="text-muted-foreground">${escapeHtml(item.label)}</div>
              <div class="mt-1 text-sm font-medium text-foreground">${escapeHtml(item.value)}</div>
              ${item.hint ? `<div class="mt-1 text-[11px] leading-5 text-muted-foreground">${escapeHtml(item.hint)}</div>` : ''}
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

function includesAny(value: string | undefined, keywords: string[]): boolean {
  if (!value) return false
  return keywords.some((keyword) => value.includes(keyword))
}

function hasMeaningfulReplenishmentRisk(label: string): boolean {
  return !includesAny(label, ['当前无', '暂无', '无需'])
}

function resolveStatusTone(label: string): 'slate' | 'green' | 'amber' | 'red' | 'blue' {
  if (includesAny(label, ['异常', '驳回', '风险', '待补料'])) return 'red'
  if (includesAny(label, ['已完成', '已交接', '已入仓', '领取成功', '已领取', '已回执'])) return 'green'
  if (includesAny(label, ['处理中', '执行中', '当前查看'])) return 'blue'
  if (includesAny(label, ['待', '未'])) return 'amber'
  return 'slate'
}

function renderTaskOverviewCard(detail: PdaCuttingTaskDetailData): string {
  const overallStatus = resolvePdaCuttingTaskOverviewStatusLabel({
    cutPieceOrderCount: detail.cutPieceOrderCount,
    completedCutPieceOrderCount: detail.completedCutPieceOrderCount,
    pendingCutPieceOrderCount: detail.pendingCutPieceOrderCount,
    exceptionCutPieceOrderCount: detail.exceptionCutPieceOrderCount,
  })

  return `
    <section class="rounded-2xl border bg-card px-3 py-3 shadow-sm">
      <div class="flex items-start justify-between gap-2.5">
        <div class="space-y-1">
          <div class="text-xs text-muted-foreground">裁片任务号</div>
          <div class="text-lg font-semibold text-foreground">${escapeHtml(detail.taskNo)}</div>
          <div class="text-xs text-muted-foreground">生产单 ${escapeHtml(detail.productionOrderNo)}</div>
        </div>
        ${renderStatusChip(overallStatus, resolveStatusTone(overallStatus))}
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
        <article class="rounded-xl border bg-muted/20 px-2.5 py-2.5">
          <div class="text-muted-foreground">关联执行单</div>
          <div class="mt-1 text-lg font-semibold text-foreground">${escapeHtml(String(detail.cutPieceOrderCount))}</div>
        </article>
        <article class="rounded-xl border bg-muted/20 px-2.5 py-2.5">
          <div class="text-muted-foreground">已完成</div>
          <div class="mt-1 text-lg font-semibold text-foreground">${escapeHtml(String(detail.completedCutPieceOrderCount))}</div>
        </article>
        <article class="rounded-xl border bg-muted/20 px-2.5 py-2.5">
          <div class="text-muted-foreground">未完成</div>
          <div class="mt-1 text-lg font-semibold text-foreground">${escapeHtml(String(detail.pendingCutPieceOrderCount))}</div>
        </article>
        <article class="rounded-xl border bg-muted/20 px-2.5 py-2.5">
          <div class="text-muted-foreground">异常执行单</div>
          <div class="mt-1 text-lg font-semibold text-foreground">${escapeHtml(String(detail.exceptionCutPieceOrderCount))}</div>
        </article>
      </div>
      <div class="mt-3 rounded-xl border bg-muted/20 px-2.5 py-2.5 text-xs">
        <div class="text-muted-foreground">当前步骤</div>
        <div class="mt-1 text-sm font-semibold text-foreground">进入当前任务</div>
        <div class="mt-1 text-muted-foreground">${escapeHtml(detail.taskProgressLabel)}</div>
        <div class="mt-1 text-muted-foreground">分配工厂：${escapeHtml(formatFactoryDisplayName(detail.assigneeFactoryName, detail.assigneeFactoryId))}</div>
      </div>
      ${
        detail.exceptionCutPieceOrderCount > 0
          ? `<div class="mt-2.5 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-2.5 text-xs text-amber-800">有 ${escapeHtml(String(detail.exceptionCutPieceOrderCount))} 张裁片单待先处理。</div>`
          : ''
      }
      ${
        detail.cutPieceOrderCount > 1
          ? `<div class="mt-2.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2.5 text-xs text-slate-700">先选裁片单，再进入当前任务。</div>`
          : ''
      }
    </section>
  `
}

function renderTaskOrderCard(
  taskId: string,
  line: PdaCuttingTaskOrderLine,
  detail: PdaCuttingTaskDetailData,
  state: PdaCuttingTaskDetailPageState,
  returnTo: string,
  focusExecutionOrderNo: string | null,
  completedActionLabel: string | null,
): string {
  const actions = buildPdaCuttingTaskOrderActions(taskId, line, returnTo)
  const expanded = state.expandedExecutionOrderIds.includes(line.executionOrderId)
  const isCurrentSelected = detail.currentSelectedExecutionOrderId === line.executionOrderId
  const isFocusTarget = focusExecutionOrderNo === line.executionOrderNo
  const isStableDone = line.isDone && !line.hasException && !hasMeaningfulReplenishmentRisk(line.replenishmentRiskLabel)
  const navContext = readPdaCuttingNavContext()
  const primaryActionHref = buildPdaCuttingExecutionUnitNavHref(taskId, line.executionOrderId, {
    executionOrderNo: line.executionOrderNo,
    originalCutOrderId: line.originalCutOrderId,
    originalCutOrderNo: line.originalCutOrderNo,
    mergeBatchId: line.mergeBatchId,
    mergeBatchNo: line.mergeBatchNo,
    materialSku: line.materialSku,
    returnTo: navContext.returnTo,
    focusTaskId: taskId,
    focusExecutionOrderId: line.executionOrderId,
    focusExecutionOrderNo: line.executionOrderNo,
    highlightCutPieceOrder: true,
    autoFocus: true,
  })
  const currentStepLabel = isStableDone ? '已完成' : resolvePdaCuttingTaskOrderCurrentStepLabel(line)
  const replenishmentNote = hasMeaningfulReplenishmentRisk(line.replenishmentRiskLabel)
    ? `<div class="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-[11px] text-amber-800">补料情况：${escapeHtml(line.replenishmentRiskLabel)}</div>`
    : ''
  const completionNotice =
    isFocusTarget && completedActionLabel
      ? `<div class="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-[11px] text-emerald-800">${escapeHtml(completedActionLabel)}</div>`
      : ''

  return `
    <article class="rounded-2xl border px-4 py-4 shadow-sm ${isFocusTarget ? 'border-blue-300 bg-blue-50/40 ring-2 ring-blue-100' : isCurrentSelected ? 'border-blue-200 bg-blue-50/30' : 'bg-card'}" data-pda-cutting-order-card-id="${escapeHtml(line.executionOrderId)}">
      <div class="flex items-start justify-between gap-3">
        <div class="space-y-1">
          <div class="text-xs text-muted-foreground">当前任务号</div>
          <div class="text-base font-semibold text-foreground">${escapeHtml(line.executionOrderNo)}</div>
          <div class="text-[11px] text-muted-foreground">${
            line.bindingState === 'UNBOUND'
              ? '待绑定原始裁片单'
              : `裁片单 ${escapeHtml(line.originalCutOrderNo)}`
          }</div>
          ${
            line.mergeBatchNo
              ? `<div class="text-[11px] text-muted-foreground">关联合并裁剪批次 ${escapeHtml(line.mergeBatchNo)}</div>`
              : ''
          }
          <div class="text-xs text-muted-foreground">面料 SKU ${escapeHtml(line.materialSku)}</div>
        </div>
        <div class="flex flex-wrap justify-end gap-2">
          ${renderStatusChip(line.currentStateLabel, resolveStatusTone(line.currentStateLabel))}
          ${line.bindingState === 'UNBOUND' ? renderStatusChip('未绑定', 'red') : ''}
          ${line.isDone ? renderStatusChip('已完成', 'green') : ''}
          ${line.hasException ? renderStatusChip('有异常', 'red') : ''}
          ${isCurrentSelected ? renderStatusChip('当前查看', 'blue') : ''}
          ${isFocusTarget && !isCurrentSelected ? renderStatusChip('刚处理', 'blue') : ''}
        </div>
      </div>
      ${completionNotice}
      <div class="mt-4 grid grid-cols-2 gap-3 text-xs">
        <article class="rounded-xl border bg-muted/20 px-3 py-3">
          <div class="text-muted-foreground">面料类型</div>
          <div class="mt-1 text-sm font-medium text-foreground">${escapeHtml(line.materialTypeLabel)}</div>
        </article>
        <article class="rounded-xl border bg-muted/20 px-3 py-3">
          <div class="text-muted-foreground">颜色</div>
          <div class="mt-1 text-sm font-medium text-foreground">${escapeHtml(line.colorLabel || '待补')}</div>
        </article>
        <article class="rounded-xl border bg-muted/20 px-3 py-3">
          <div class="text-muted-foreground">领料状态</div>
          <div class="mt-1 text-sm font-medium text-foreground">${escapeHtml(line.currentReceiveStatus)}</div>
        </article>
        <article class="rounded-xl border bg-muted/20 px-3 py-3">
          <div class="text-muted-foreground">执行状态</div>
          <div class="mt-1 text-sm font-medium text-foreground">${escapeHtml(line.currentExecutionStatus)}</div>
        </article>
        <article class="rounded-xl border bg-muted/20 px-3 py-3">
          <div class="text-muted-foreground">入仓状态</div>
          <div class="mt-1 text-sm font-medium text-foreground">${escapeHtml(line.currentInboundStatus)}</div>
        </article>
        <article class="rounded-xl border bg-muted/20 px-3 py-3">
          <div class="text-muted-foreground">交接状态</div>
          <div class="mt-1 text-sm font-medium text-foreground">${escapeHtml(line.currentHandoverStatus)}</div>
        </article>
      </div>
      <div class="mt-3 rounded-xl border bg-muted/20 px-3 py-3 text-xs">
        <div class="text-muted-foreground">当前步骤</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(currentStepLabel)}</div>
        <div class="mt-1 text-muted-foreground">本单成衣件数（件）：${escapeHtml(String(line.plannedQty))}</div>
      </div>
      ${replenishmentNote}
      <div class="mt-3 flex gap-2">
        <button class="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90" data-nav="${escapeHtml(primaryActionHref)}" data-pda-cutting-primary-entry="execution-unit">
          进入当前任务
        </button>
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium hover:bg-muted" data-pda-cut-task-action="toggle-order-actions" data-task-id="${escapeHtml(taskId)}" data-execution-order-id="${escapeHtml(line.executionOrderId)}">
          ${expanded ? '收起操作' : '更多操作'}
        </button>
      </div>
      ${
        expanded
          ? `
              <div class="mt-3 grid grid-cols-2 gap-2">
                ${actions
                  .map(
                    (action) => `
                      <button class="inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-2 text-xs font-medium text-foreground hover:bg-muted" data-nav="${escapeHtml(action.href)}">
                        ${escapeHtml(action.label)}
                      </button>
                    `,
                  )
                  .join('')}
              </div>
            `
          : ''
      }
    </article>
  `
}

function renderTaskOrderList(taskId: string, detail: PdaCuttingTaskDetailData, state: PdaCuttingTaskDetailPageState): string {
  if (!detail.cutPieceOrders.length) {
    return renderPdaCuttingEmptyState('当前任务还没有关联裁片单', '')
  }

  const returnTo = resolveCurrentTaskDetailHref()
  const navContext = readPdaCuttingNavContext()
  const focusExecutionOrderNo = navContext.focusExecutionOrderNo || detail.executionOrderNo || null
  const completedActionLabel = navContext.justSaved ? getPdaCuttingCompletedActionLabel(navContext.justCompletedAction) : null

  return `
    <div class="space-y-3">
      ${detail.cutPieceOrders
        .map((line) => renderTaskOrderCard(taskId, line, detail, state, returnTo, focusExecutionOrderNo, completedActionLabel))
        .join('')}
    </div>
  `
}

function renderFocusedQrSummary(detail: PdaCuttingTaskDetailData, state: PdaCuttingTaskDetailPageState): string {
  const isBound = Boolean(detail.originalCutOrderNo)
  const explainBlock = state.qrExpanded
    ? `
        <div class="rounded-xl border bg-muted/20 px-3 py-3 text-xs leading-5 text-muted-foreground">
          ${
            isBound
              ? `当前任务 <span class="font-medium text-foreground">${escapeHtml(detail.executionOrderNo)}</span> 已绑定原始裁片单
          <span class="font-medium text-foreground">${escapeHtml(detail.originalCutOrderNo)}</span>，后续领料、铺布、入仓和交接都沿正式对象链回写。`
              : `当前任务 <span class="font-medium text-foreground">${escapeHtml(detail.executionOrderNo)}</span> 仍处于待绑定状态，当前仅可查看执行对象与异常说明。`
          }
        </div>
      `
    : ''

  return `
    <div class="space-y-3 text-xs">
      <div class="rounded-xl border bg-muted/20 px-3 py-3">
        <div class="flex items-center justify-between gap-2">
          <div>
            <div class="text-muted-foreground">当前任务</div>
            <div class="mt-1 text-sm font-medium text-foreground">${escapeHtml(detail.executionOrderNo)}</div>
            <div class="mt-1 text-[11px] text-muted-foreground">${
              isBound ? `原始裁片单 ${escapeHtml(detail.originalCutOrderNo)}` : '原始裁片单待绑定'
            }</div>
          </div>
          ${renderStatusChip(detail.hasQrCode && isBound ? '已生成主码' : '待绑定主码', detail.hasQrCode && isBound ? 'green' : 'amber')}
        </div>
        <div class="mt-3 rounded-xl border border-dashed bg-background px-3 py-4 text-center">
          <div class="text-[11px] text-muted-foreground">${isBound ? '原始裁片单二维码' : '当前绑定状态'}</div>
          <div class="mt-1 text-sm font-semibold text-foreground">${isBound ? '已绑定二维码' : '待绑定二维码'}</div>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-3">
          <div>
            <div class="text-muted-foreground">领料单号</div>
            <div class="mt-1 font-medium text-foreground">${escapeHtml(detail.pickupSlipNo)}</div>
          </div>
          <div>
            <div class="text-muted-foreground">当前主码说明</div>
            <div class="mt-1 font-medium text-foreground">${escapeHtml(detail.qrVersionNote)}</div>
          </div>
        </div>
      </div>
      ${explainBlock}
      <button class="inline-flex min-h-10 w-full items-center justify-center rounded-xl border px-3 py-2 text-xs font-medium hover:bg-muted" data-pda-cut-task-action="toggle-qr-detail" data-task-id="${escapeHtml(detail.taskId)}">
        ${state.qrExpanded ? '收起主码说明' : '查看主码说明'}
      </button>
    </div>
  `
}

function renderRecentActions(detail: PdaCuttingTaskDetailData): string {
  if (!detail.recentActions.length) {
    return renderPdaCuttingEmptyState('暂无最近动作', '')
  }

  return `
    <div class="space-y-2">
      ${detail.recentActions
        .slice(0, 4)
        .map(
          (action) => `
            <article class="rounded-xl border px-3 py-3 text-xs">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  ${renderStatusChip(action.actionTypeLabel, 'blue')}
                  <span class="font-medium text-foreground">${escapeHtml(action.summary)}</span>
                </div>
                <span class="text-[11px] text-muted-foreground">${escapeHtml(action.operatedAt)}</span>
              </div>
              <div class="mt-2 text-muted-foreground">操作人：${escapeHtml(action.operatedBy)}</div>
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

function renderClaimDisputeSummary(taskId: string): string {
  const dispute = getLatestClaimDisputeByTaskId(taskId)
  if (!dispute) {
    return renderPdaCuttingEmptyState('当前无领料长度异议', '')
  }

  const meta = getClaimDisputeStatusMeta(dispute.status)
  return `
    <div class="space-y-3">
      <div class="rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-xs">
        <div class="flex items-center justify-between gap-2">
          <div>
            <div class="text-blue-700">异议编号</div>
            <div class="mt-1 text-sm font-semibold text-blue-900">${escapeHtml(dispute.disputeNo)}</div>
          </div>
          <span class="inline-flex items-center rounded-full border px-2.5 py-1 ${meta.className}">${escapeHtml(meta.label)}</span>
        </div>
      </div>
      ${renderInfoGrid([
        { label: '默认应领长度（m）', value: `${dispute.defaultClaimQty} 米` },
        { label: '实际领取长度（m）', value: `${dispute.actualClaimQty} 米`, hint: `差异 ${dispute.discrepancyQty} 米` },
        { label: '异议原因', value: dispute.disputeReason },
        { label: '证据份数（个）', value: `${dispute.evidenceCount} 个`, hint: dispute.hasEvidence ? '已上传图片或视频' : '待补录' },
        { label: '提交时间', value: dispute.submittedAt, hint: `提交人：${dispute.submittedBy}` },
        { label: '平台处理结论', value: dispute.handleConclusion || '待平台处理', hint: dispute.handleNote || '当前暂无处理说明' },
      ])}
      <div class="grid grid-cols-2 gap-3 text-xs">
        <div class="rounded-xl border px-3 py-3">
          <div class="text-muted-foreground">工艺端回写</div>
          <div class="mt-1 text-sm font-medium text-foreground">${escapeHtml(dispute.writtenBackToCraft ? '已回写工艺工厂运营系统' : '待回写工艺工厂运营系统')}</div>
        </div>
        <div class="rounded-xl border px-3 py-3">
          <div class="text-muted-foreground">移动端回写</div>
          <div class="mt-1 text-sm font-medium text-foreground">${escapeHtml(dispute.writtenBackToPda ? '已回写移动端' : '待回写移动端')}</div>
        </div>
      </div>
      <div class="rounded-xl border px-3 py-3 text-xs">
        <div class="text-muted-foreground">异议说明</div>
        <div class="mt-1 text-sm text-foreground">${escapeHtml(dispute.disputeNote || '无')}</div>
      </div>
    </div>
  `
}

export function renderPdaCuttingTaskDetailPage(taskId: string, options?: PdaCuttingTaskDetailRenderOptions): string {
  const selectedExecutionOrderId = readSelectedExecutionOrderIdFromLocation()
  const selectedExecutionOrderNo = readSelectedExecutionOrderNoFromLocation()
  const navContext = readPdaCuttingNavContext()
  const detail = getPdaCuttingTaskSnapshot(taskId, selectedExecutionOrderId ?? selectedExecutionOrderNo ?? undefined)
  const backHref = resolveSafeBackHref(options?.backHref)

  if (!detail) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: '裁片任务',
      subtitle: '',
      activeTab: 'exec',
      body: '',
      backHref,
    })
  }

  const state = getPageState(taskId)
  state.hasMultipleCutPieceOrders = detail.cutPieceOrderCount > 1

  const focusedExecutionOrderId =
    navContext.focusExecutionOrderId ||
    detail.currentSelectedExecutionOrderId ||
    (detail.cutPieceOrderCount === 1 ? detail.defaultExecutionOrderId : null)
  syncFocusDrivenState(state, navContext, focusedExecutionOrderId)
  scheduleOrderFocus(focusedExecutionOrderId, Boolean(navContext.autoFocus))
  const focusedOrderDetail = focusedExecutionOrderId
    ? getPdaCuttingTaskSnapshot(taskId, focusedExecutionOrderId) ?? detail
    : null

  const body = `
    ${renderTaskOverviewCard(detail)}
    ${renderPdaCuttingSection('当前任务', '', renderTaskOrderList(taskId, detail, state))}
    ${
      focusedOrderDetail
        ? renderPdaCuttingSection('当前原始裁片单二维码', '', renderFocusedQrSummary(focusedOrderDetail, state))
        : ''
    }
    ${renderPdaCuttingSection('领料长度异议', '', renderClaimDisputeSummary(taskId))}
    ${renderPdaCuttingSection('最近动作', '', renderRecentActions(detail))}
  `

  return renderPdaCuttingPageLayout({
    taskId,
    title: '裁片任务',
    subtitle: '',
    activeTab: 'exec',
    body,
    backHref,
  })
}

export function handlePdaCuttingTaskDetailEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pda-cut-task-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pdaCutTaskAction
  const taskId = actionNode.dataset.taskId || appTaskIdFromPath()
  if (!action || !taskId) return false

  const state = getPageState(taskId)

  if (action === 'toggle-qr-detail') {
    state.qrExpanded = !state.qrExpanded
    return true
  }

  if (action === 'toggle-order-actions') {
    const executionOrderId = actionNode.dataset.executionOrderId
    if (!executionOrderId) return false
    state.expandedExecutionOrderIds = state.expandedExecutionOrderIds.includes(executionOrderId)
      ? state.expandedExecutionOrderIds.filter((item) => item !== executionOrderId)
      : [...state.expandedExecutionOrderIds, executionOrderId]
    return true
  }

  return false
}

function appTaskIdFromPath(): string {
  if (typeof window === 'undefined') return ''
  const matched = window.location.pathname.match(/\/fcs\/pda\/cutting\/task\/([^/]+)/)
  return matched?.[1] ?? ''
}
