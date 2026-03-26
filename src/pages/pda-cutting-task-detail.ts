import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import {
  getPdaCuttingTaskDetail,
  type PdaCuttingTaskDetailData,
  type PdaCuttingTaskOrderLine,
} from '../data/fcs/pda-cutting-special'
import { getClaimDisputeStatusMeta } from '../helpers/fcs-claim-dispute'
import { getLatestClaimDisputeByTaskId } from '../state/fcs-claim-dispute-store'
import { readSelectedCutPieceOrderNoFromLocation } from './pda-cutting-context'
import {
  buildPdaCuttingTaskDetailFocusHref,
  getPdaCuttingCompletedActionLabel,
  readPdaCuttingNavContext,
  resolvePdaCuttingBackHref,
  type PdaCuttingNavContext,
} from './pda-cutting-nav-context'
import {
  buildPdaCuttingTaskOrderActions,
  resolvePdaCuttingTaskOrderPrimaryRouteKey,
  resolvePdaCuttingTaskOverviewStatusLabel,
} from './pda-cutting-task-detail-helpers'
import {
  renderPdaCuttingEmptyState,
  renderPdaCuttingPageLayout,
  renderPdaCuttingSection,
} from './pda-cutting-shared'

interface PdaCuttingTaskDetailPageState {
  qrExpanded: boolean
  expandedCutPieceOrderNos: string[]
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
    expandedCutPieceOrderNos: [],
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

function scheduleOrderFocus(cutPieceOrderNo: string | null, autoFocus: boolean): void {
  if (!cutPieceOrderNo || !autoFocus || typeof document === 'undefined' || typeof window === 'undefined') return
  const focusToken = `${appStore.getState().pathname}::${cutPieceOrderNo}`
  if (lastFocusedOrderToken === focusToken) return
  lastFocusedOrderToken = focusToken
  window.requestAnimationFrame(() => {
    const card = document.querySelector<HTMLElement>(`[data-pda-cutting-order-card-id="${cutPieceOrderNo}"]`)
    card?.scrollIntoView({ block: 'center' })
  })
}

function syncFocusDrivenState(
  state: PdaCuttingTaskDetailPageState,
  navContext: PdaCuttingNavContext,
  focusCutPieceOrderNo: string | null,
): void {
  const focusToken = `${focusCutPieceOrderNo || ''}|${navContext.autoExpandActions ? '1' : '0'}|${navContext.justCompletedAction || ''}|${navContext.justSaved ? '1' : '0'}`
  if (state.lastFocusToken === focusToken) return
  state.lastFocusToken = focusToken

  if (
    navContext.autoExpandActions &&
    focusCutPieceOrderNo &&
    !state.expandedCutPieceOrderNos.includes(focusCutPieceOrderNo)
  ) {
    state.expandedCutPieceOrderNos = [...state.expandedCutPieceOrderNos, focusCutPieceOrderNo]
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
    <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <div class="space-y-1">
          <div class="text-xs text-muted-foreground">裁片任务号</div>
          <div class="text-lg font-semibold text-foreground">${escapeHtml(detail.taskNo)}</div>
          <div class="text-xs text-muted-foreground">生产单 ${escapeHtml(detail.productionOrderNo)}</div>
        </div>
        ${renderStatusChip(overallStatus, resolveStatusTone(overallStatus))}
      </div>
      <div class="mt-4 grid grid-cols-2 gap-3 text-xs">
        <article class="rounded-xl border bg-muted/20 px-3 py-3">
          <div class="text-muted-foreground">关联裁片单</div>
          <div class="mt-1 text-lg font-semibold text-foreground">${escapeHtml(String(detail.cutPieceOrderCount))}</div>
        </article>
        <article class="rounded-xl border bg-muted/20 px-3 py-3">
          <div class="text-muted-foreground">已完成</div>
          <div class="mt-1 text-lg font-semibold text-foreground">${escapeHtml(String(detail.completedCutPieceOrderCount))}</div>
        </article>
        <article class="rounded-xl border bg-muted/20 px-3 py-3">
          <div class="text-muted-foreground">未完成</div>
          <div class="mt-1 text-lg font-semibold text-foreground">${escapeHtml(String(detail.pendingCutPieceOrderCount))}</div>
        </article>
        <article class="rounded-xl border bg-muted/20 px-3 py-3">
          <div class="text-muted-foreground">异常裁片单</div>
          <div class="mt-1 text-lg font-semibold text-foreground">${escapeHtml(String(detail.exceptionCutPieceOrderCount))}</div>
        </article>
      </div>
      <div class="mt-4 rounded-xl border bg-muted/20 px-3 py-3 text-xs">
        <div class="text-muted-foreground">当前建议动作</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(detail.taskNextActionLabel || '查看关联裁片单')}</div>
        <div class="mt-1 text-muted-foreground">${escapeHtml(detail.taskProgressLabel)}</div>
        <div class="mt-1 text-muted-foreground">分配工厂：${escapeHtml(detail.assigneeFactoryName)}</div>
      </div>
      ${
        detail.exceptionCutPieceOrderCount > 0
          ? `<div class="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">当前有 ${escapeHtml(String(detail.exceptionCutPieceOrderCount))} 张裁片单需要优先处理异常或补料问题。</div>`
          : ''
      }
      ${
        detail.cutPieceOrderCount > 1
          ? `<div class="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-700">当前任务下有多张裁片单，请先在下面选择具体裁片单，再进入执行。</div>`
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
  focusCutPieceOrderNo: string | null,
  completedActionLabel: string | null,
): string {
  const actions = buildPdaCuttingTaskOrderActions(taskId, line, returnTo)
  const primaryRouteKey = resolvePdaCuttingTaskOrderPrimaryRouteKey(line)
  const routedPrimaryAction = actions.find((item) => item.key === primaryRouteKey) ?? actions[0]
  const expanded = state.expandedCutPieceOrderNos.includes(line.cutPieceOrderNo)
  const isCurrentSelected = detail.currentSelectedCutPieceOrderNo === line.cutPieceOrderNo
  const isFocusTarget = focusCutPieceOrderNo === line.cutPieceOrderNo
  const isStableDone = line.isDone && !line.hasException && !hasMeaningfulReplenishmentRisk(line.replenishmentRiskLabel)
  const navContext = readPdaCuttingNavContext()
  const primaryActionHref = isStableDone
    ? buildPdaCuttingTaskDetailFocusHref(taskId, {
        cutPieceOrderNo: line.cutPieceOrderNo,
        returnTo: navContext.returnTo,
        focusTaskId: taskId,
        focusCutPieceOrderNo: line.cutPieceOrderNo,
        highlightCutPieceOrder: true,
        autoFocus: true,
      })
    : routedPrimaryAction.href
  const nextActionLabel = isStableDone ? '查看当前情况' : line.nextActionLabel || routedPrimaryAction.label
  const replenishmentNote = hasMeaningfulReplenishmentRisk(line.replenishmentRiskLabel)
    ? `<div class="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-[11px] text-amber-800">补料情况：${escapeHtml(line.replenishmentRiskLabel)}</div>`
    : ''
  const completionNotice =
    isFocusTarget && completedActionLabel
      ? `<div class="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-[11px] text-emerald-800">${escapeHtml(completedActionLabel)}</div>`
      : ''

  return `
    <article class="rounded-2xl border px-4 py-4 shadow-sm ${isFocusTarget ? 'border-blue-300 bg-blue-50/40 ring-2 ring-blue-100' : isCurrentSelected ? 'border-blue-200 bg-blue-50/30' : 'bg-card'}" data-pda-cutting-order-card-id="${escapeHtml(line.cutPieceOrderNo)}">
      <div class="flex items-start justify-between gap-3">
        <div class="space-y-1">
          <div class="text-xs text-muted-foreground">裁片单号</div>
          <div class="text-base font-semibold text-foreground">${escapeHtml(line.cutPieceOrderNo)}</div>
          <div class="text-xs text-muted-foreground">${escapeHtml(line.materialSku)}</div>
        </div>
        <div class="flex flex-wrap justify-end gap-2">
          ${renderStatusChip(line.currentStateLabel, resolveStatusTone(line.currentStateLabel))}
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
        <div class="text-muted-foreground">下一步建议动作</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(nextActionLabel)}</div>
        <div class="mt-1 text-muted-foreground">计划数量：${escapeHtml(String(line.plannedQty))} 件</div>
      </div>
      ${replenishmentNote}
      <div class="mt-3 flex gap-2">
        <button class="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90" data-nav="${escapeHtml(primaryActionHref)}">
          继续处理
        </button>
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium hover:bg-muted" data-pda-cut-task-action="toggle-order-actions" data-task-id="${escapeHtml(taskId)}" data-cut-piece-order-no="${escapeHtml(line.cutPieceOrderNo)}">
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
  const focusCutPieceOrderNo = navContext.focusCutPieceOrderNo || detail.currentSelectedCutPieceOrderNo || null
  const completedActionLabel = navContext.justSaved ? getPdaCuttingCompletedActionLabel(navContext.justCompletedAction) : null

  return `
    <div class="space-y-3">
      ${detail.cutPieceOrders
        .map((line) => renderTaskOrderCard(taskId, line, detail, state, returnTo, focusCutPieceOrderNo, completedActionLabel))
        .join('')}
    </div>
  `
}

function renderFocusedQrSummary(detail: PdaCuttingTaskDetailData, state: PdaCuttingTaskDetailPageState): string {
  const explainBlock = state.qrExpanded
    ? `
        <div class="rounded-xl border bg-muted/20 px-3 py-3 text-xs leading-5 text-muted-foreground">
          当前裁片单主码对应裁片单 <span class="font-medium text-foreground">${escapeHtml(detail.cutPieceOrderNo)}</span>，
          后续领料、铺布、入仓和交接都继续使用这张裁片单的主码。
        </div>
      `
    : ''

  return `
    <div class="space-y-3 text-xs">
      <div class="rounded-xl border bg-muted/20 px-3 py-3">
        <div class="flex items-center justify-between gap-2">
          <div>
            <div class="text-muted-foreground">当前裁片单</div>
            <div class="mt-1 text-sm font-medium text-foreground">${escapeHtml(detail.cutPieceOrderNo)}</div>
          </div>
          ${renderStatusChip(detail.hasQrCode ? '已生成主码' : '未生成主码', detail.hasQrCode ? 'green' : 'amber')}
        </div>
        <div class="mt-3 rounded-xl border border-dashed bg-background px-3 py-4 text-center">
          <div class="text-[11px] text-muted-foreground">裁片单主码</div>
          <div class="mt-1 font-mono text-sm font-semibold tracking-wide text-foreground">${escapeHtml(detail.qrCodeValue)}</div>
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
    return renderPdaCuttingEmptyState('当前无领料数量异议', '')
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
        { label: '默认应领数量', value: `${dispute.defaultClaimQty} 米` },
        { label: '实际领取数量', value: `${dispute.actualClaimQty} 米`, hint: `差异 ${dispute.discrepancyQty} 米` },
        { label: '异议原因', value: dispute.disputeReason },
        { label: '证据数量', value: `${dispute.evidenceCount} 个`, hint: dispute.hasEvidence ? '已上传图片或视频' : '待补录' },
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
  const selectedCutPieceOrderNo = readSelectedCutPieceOrderNoFromLocation()
  const navContext = readPdaCuttingNavContext()
  const detail = getPdaCuttingTaskDetail(taskId, selectedCutPieceOrderNo ?? undefined)
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

  const focusedCutPieceOrderNo =
    navContext.focusCutPieceOrderNo ||
    detail.currentSelectedCutPieceOrderNo ||
    (detail.cutPieceOrderCount === 1 ? detail.defaultCutPieceOrderNo : null)
  syncFocusDrivenState(state, navContext, focusedCutPieceOrderNo)
  scheduleOrderFocus(focusedCutPieceOrderNo, Boolean(navContext.autoFocus))
  const focusedOrderDetail = focusedCutPieceOrderNo
    ? getPdaCuttingTaskDetail(taskId, focusedCutPieceOrderNo) ?? detail
    : null

  const body = `
    ${renderTaskOverviewCard(detail)}
    ${renderPdaCuttingSection('关联裁片单', '', renderTaskOrderList(taskId, detail, state))}
    ${
      focusedOrderDetail
        ? renderPdaCuttingSection('当前裁片单主码', '', renderFocusedQrSummary(focusedOrderDetail, state))
        : ''
    }
    ${renderPdaCuttingSection('领料数量异议', '', renderClaimDisputeSummary(taskId))}
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
    const cutPieceOrderNo = actionNode.dataset.cutPieceOrderNo
    if (!cutPieceOrderNo) return false
    state.expandedCutPieceOrderNos = state.expandedCutPieceOrderNos.includes(cutPieceOrderNo)
      ? state.expandedCutPieceOrderNos.filter((item) => item !== cutPieceOrderNo)
      : [...state.expandedCutPieceOrderNos, cutPieceOrderNo]
    return true
  }

  return false
}

function appTaskIdFromPath(): string {
  if (typeof window === 'undefined') return ''
  const matched = window.location.pathname.match(/\/fcs\/pda\/cutting\/task\/([^/]+)/)
  return matched?.[1] ?? ''
}
