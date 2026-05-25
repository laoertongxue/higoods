import { escapeHtml } from '../utils'
import { buildPdaCuttingReplenishmentProjection } from './pda-cutting-replenishment-projection'
import {
  resolvePdaCuttingRuntimeIdentity,
  resolvePdaCuttingRuntimeOperator,
} from '../data/fcs/pda-cutting-runtime-action-inputs.ts'
import { appendCuttingRuntimeEvent } from '../data/fcs/cutting/cutting-runtime-event-ledger.ts'
import {
  buildPdaCuttingExecutionStateKey,
  renderPdaCuttingEmptyState,
  renderPdaCuttingExecutionHero,
  renderPdaCuttingFeedbackNotice,
  renderPdaCuttingOrderSelectionPrompt,
  renderPdaCuttingPageLayout,
  renderPdaCuttingSection,
  renderPdaCuttingSummaryGrid,
} from './pda-cutting-shared'
import {
  buildPdaCuttingExecutionContext,
  readSelectedExecutionOrderIdFromLocation,
  readSelectedExecutionOrderNoFromLocation,
} from './pda-cutting-context'
import { buildPdaCuttingCompletedReturnHref } from './pda-cutting-nav-context'

interface ReplenishmentFormState {
  operatorName: string
  differenceType: string
  differenceQty: string
  unit: string
  note: string
  photoProofCount: string
  feedbackMessage: string
  syncStatus: string
  backHrefOverride: string
}

const feedbackState = new Map<string, ReplenishmentFormState>()

function getReplenishmentDetail(taskId: string, executionKey?: string | null) {
  return buildPdaCuttingReplenishmentProjection(taskId, executionKey ?? undefined)
}

function getState(taskId: string, executionOrderId?: string | null, executionOrderNo?: string | null): ReplenishmentFormState {
  const stateKey = buildPdaCuttingExecutionStateKey(taskId, executionOrderId, executionOrderNo)
  const existing = feedbackState.get(stateKey)
  if (existing) return existing
  const detail = getReplenishmentDetail(taskId, executionOrderId ?? executionOrderNo ?? undefined)
  const initial: ReplenishmentFormState = {
    operatorName: detail?.latestFeedbackBy && detail.latestFeedbackBy !== '-' ? detail.latestFeedbackBy : '现场反馈人',
    differenceType: detail?.latestFeedbackReason && detail.latestFeedbackReason !== '-' ? detail.latestFeedbackReason : '面料余额不足',
    differenceQty: '0',
    unit: '米',
    note: detail?.latestFeedbackNote && detail.latestFeedbackNote !== '-' ? detail.latestFeedbackNote : '',
    photoProofCount: String(detail?.photoProofCount ?? 0),
    feedbackMessage: '',
    syncStatus: '待提交',
    backHrefOverride: '',
  }
  feedbackState.set(stateKey, initial)
  return initial
}

function resolveFeedbackSelection(taskId: string) {
  const selectedExecutionOrderId = readSelectedExecutionOrderIdFromLocation()
  const selectedExecutionOrderNo = readSelectedExecutionOrderNoFromLocation()
  if (selectedExecutionOrderId || selectedExecutionOrderNo) {
    return { selectedExecutionOrderId, selectedExecutionOrderNo }
  }
  const context = buildPdaCuttingExecutionContext(taskId, 'replenishment-feedback')
  return {
    selectedExecutionOrderId: context.selectedExecutionOrderId,
    selectedExecutionOrderNo: context.selectedExecutionOrderNo,
  }
}

function renderFeedbackHistory(detail: NonNullable<ReturnType<typeof getReplenishmentDetail>>): string {
  if (!detail || !detail.replenishmentFeedbacks.length) {
    return renderPdaCuttingEmptyState('当前裁片单暂无现场差异反馈记录', '')
  }

  return `
    <div class="space-y-2">
      ${detail.replenishmentFeedbacks
        .map(
          (item) => `
            <article class="rounded-xl border px-3 py-3 text-xs">
              <div class="flex items-center justify-between gap-2">
                <div class="font-medium text-foreground">${escapeHtml(item.id)} / ${escapeHtml(item.reasonLabel)}</div>
                <div class="text-muted-foreground">${escapeHtml(item.feedbackAt)}</div>
              </div>
              <div class="mt-2 text-muted-foreground">反馈人：${escapeHtml(item.operatorName)}</div>
              <div class="mt-1 text-muted-foreground">反馈记录：${escapeHtml(item.note || '无')}</div>
              <div class="mt-1 text-muted-foreground">照片 / 凭证：${escapeHtml(String(item.photoProofCount))} 个</div>
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

function renderFeedbackStatus(detail: NonNullable<ReturnType<typeof getReplenishmentDetail>>): string {
  return renderPdaCuttingSummaryGrid([
    { label: '当前差异情况', value: detail.replenishmentRiskSummary },
    { label: '最近反馈时间', value: detail.latestFeedbackAt, hint: detail.latestFeedbackBy },
    { label: '最近反馈原因', value: detail.latestFeedbackReason || '暂无反馈' },
    { label: '凭证数量', value: `${detail.photoProofCount} 个` },
  ])
}

export function renderPdaCuttingReplenishmentFeedbackPage(taskId: string): string {
  const context = buildPdaCuttingExecutionContext(taskId, 'replenishment-feedback')
  const detail = context.detail

  if (!detail) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: '现场差异反馈',
      subtitle: '',
      activeTab: 'exec',
      body: '',
      backHref: context.backHref,
    })
  }

  if (context.requiresCutPieceOrderSelection) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: '现场差异反馈',
      subtitle: '',
      activeTab: 'exec',
      body: renderPdaCuttingOrderSelectionPrompt(detail, context.backHref, context.selectionNotice || undefined),
      backHref: context.backHref,
    })
  }

  const form = getState(taskId, context.selectedExecutionOrderId, context.selectedExecutionOrderNo)
  const pageBackHref = form.backHrefOverride || context.backHref

  const formSection = `
    <div class="space-y-3 text-xs" data-task-id="${escapeHtml(taskId)}">
      <div class="rounded-xl border border-dashed px-3 py-4 text-center">
        <div class="text-sm font-medium text-foreground">当前差异摘要</div>
        <p class="mt-1 text-muted-foreground">${escapeHtml(detail.replenishmentRiskSummary)}</p>
      </div>
      <label class="block space-y-1">
        <span class="text-muted-foreground">反馈人</span>
        <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-replenishment-field="operatorName" value="${escapeHtml(form.operatorName)}" />
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">差异类型</span>
        <select class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-replenishment-field="reasonLabel">
          ${['领料差异', '实铺小于计划', '实裁小于计划', '实际用量异常', '面料余额不足', '卷记录异常', '布头布尾异常', '现场反馈'].map((item) => `<option value="${escapeHtml(item)}" ${form.differenceType === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
        </select>
      </label>
      <div class="grid grid-cols-2 gap-2">
        <label class="block space-y-1">
          <span class="text-muted-foreground">差异数量</span>
          <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-replenishment-field="differenceQty" value="${escapeHtml(form.differenceQty)}" />
        </label>
        <label class="block space-y-1">
          <span class="text-muted-foreground">单位</span>
          <select class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-replenishment-field="unit">
            ${['米', '层', '件', '卷', '项'].map((item) => `<option value="${escapeHtml(item)}" ${form.unit === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
          </select>
        </label>
      </div>
      <label class="block space-y-1">
        <span class="text-muted-foreground">现场说明</span>
        <textarea class="min-h-24 w-full rounded-xl border bg-background px-3 py-2 text-sm" data-pda-cut-replenishment-field="note" placeholder="请填写现场差异、证据和建议处理方式">${escapeHtml(form.note)}</textarea>
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">照片 / 凭证数量</span>
        <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-replenishment-field="photoProofCount" value="${escapeHtml(form.photoProofCount)}" />
      </label>
      <div class="rounded-xl border bg-muted/20 px-3 py-3 text-xs">
        <div class="text-muted-foreground">本次反馈预览</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(form.differenceType)}</div>
        <div class="mt-1 text-muted-foreground">差异数量：${escapeHtml(form.differenceQty || '0')} ${escapeHtml(form.unit)}</div>
        <div class="mt-1 text-muted-foreground">现场说明：${escapeHtml(form.note || '待填写')}</div>
        <div class="mt-1 text-muted-foreground">照片 / 凭证：${escapeHtml(form.photoProofCount || '0')} 个</div>
        <div class="mt-1 text-muted-foreground">同步状态：${escapeHtml(form.syncStatus)}</div>
      </div>
      ${form.feedbackMessage ? renderPdaCuttingFeedbackNotice(form.feedbackMessage, 'success') : ''}
      <div class="grid grid-cols-2 gap-2">
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-2 text-xs font-medium hover:bg-muted" data-nav="${escapeHtml(pageBackHref)}">
          返回裁片任务
        </button>
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90" data-pda-cut-replenishment-action="submit" data-task-id="${escapeHtml(taskId)}">
          提交现场差异反馈
        </button>
      </div>
    </div>
  `

  const body = `
    ${renderPdaCuttingExecutionHero('现场差异反馈', detail)}
    ${renderPdaCuttingSection('当前情况', '', renderFeedbackStatus(detail))}
    ${renderPdaCuttingSection('现场差异反馈', '', formSection)}
    ${renderPdaCuttingSection('最近反馈记录', '', renderFeedbackHistory(detail))}
  `

  return renderPdaCuttingPageLayout({
    taskId,
    title: '现场差异反馈',
    subtitle: '',
    activeTab: 'exec',
    body,
    backHref: pageBackHref,
  })
}

export function handlePdaCuttingReplenishmentFeedbackEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pda-cut-replenishment-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLSelectElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    const taskId = fieldNode.closest<HTMLElement>('[data-task-id]')?.dataset.taskId || appTaskIdFromPath()
    if (!taskId) return true
    const { selectedExecutionOrderId, selectedExecutionOrderNo } = resolveFeedbackSelection(taskId)
    const form = getState(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
    const field = fieldNode.dataset.pdaCutReplenishmentField
    if (!field) return true

    if (field === 'operatorName') form.operatorName = fieldNode.value
    if (field === 'reasonLabel') form.differenceType = fieldNode.value
    if (field === 'differenceQty') form.differenceQty = fieldNode.value
    if (field === 'unit') form.unit = fieldNode.value
    if (field === 'note') form.note = fieldNode.value
    if (field === 'photoProofCount') form.photoProofCount = fieldNode.value
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-cut-replenishment-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pdaCutReplenishmentAction
  const taskId = actionNode.dataset.taskId
  if (!action || !taskId) return false
  const { selectedExecutionOrderId, selectedExecutionOrderNo } = resolveFeedbackSelection(taskId)

  if (action === 'submit') {
    const form = getState(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
    const context = buildPdaCuttingExecutionContext(taskId, 'replenishment-feedback')
    const identity = resolvePdaCuttingRuntimeIdentity(taskId, {
      executionOrderId: context.selectedExecutionOrderId || undefined,
      executionOrderNo: context.selectedExecutionOrderNo || undefined,
      cutOrderId: context.selectedExecutionOrder?.cutOrderId || undefined,
      cutOrderNo: context.selectedExecutionOrder?.cutOrderNo || undefined,
      markerPlanId: context.selectedExecutionOrder?.markerPlanId || undefined,
      markerPlanNo: context.selectedExecutionOrder?.markerPlanNo || undefined,
      materialSku: context.selectedExecutionOrder?.materialSku || undefined,
    })
    const operator = resolvePdaCuttingRuntimeOperator(taskId, form.operatorName.trim() || '现场反馈人')
    if (!identity || !operator) {
      form.feedbackMessage = '当前执行对象或操作人无法识别，不能提交现场差异反馈。'
      return true
    }
    const submittedAt = new Date().toISOString().slice(0, 16).replace('T', ' ')
    appendCuttingRuntimeEvent({
      eventType: '补料反馈',
      eventSource: 'PDA',
      eventStatus: '已同步',
      occurredAt: submittedAt,
      operatorId: operator.operatorAccountId,
      operatorName: operator.operatorName,
      operatorRole: operator.operatorRole || '现场反馈人',
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
      material: {
        materialSku: identity.materialSku,
        materialName: identity.materialSku,
        materialColor: '待补',
        materialAlias: '现场反馈',
        unit: form.unit === '件' ? '件' : form.unit === '片' ? '片' : '米',
      },
      payload: {
        feedbackId: `replenishment:${identity.executionOrderId}:${submittedAt.replace(/[^0-9]/g, '')}`,
        taskId,
        taskNo: context.detail?.taskNo || taskId,
        executionOrderId: identity.executionOrderId,
        executionOrderNo: identity.executionOrderNo,
        reasonLabel: form.differenceType,
        differenceQty: Number(form.differenceQty || '0') || 0,
        unit: form.unit === '件' ? '件' : form.unit === '片' ? '片' : '米',
        note: `${form.note.trim() || '现场已记录差异，待补料管理审核'}；差异数量 ${form.differenceQty || '0'} ${form.unit}`,
        photoProofCount: Number(form.photoProofCount || '0') || 0,
      },
    })
    form.feedbackMessage = '现场差异反馈已提交，已进入补料管理。'
    form.syncStatus = '已同步'
    form.backHrefOverride = buildPdaCuttingCompletedReturnHref(
      taskId,
      context.selectedExecutionOrderId,
      context.selectedExecutionOrderNo,
      context.navContext,
      'replenishment-feedback',
    )
    return true
  }

  return false
}

function appTaskIdFromPath(): string {
  if (typeof window === 'undefined') return ''
  const matched = window.location.pathname.match(/\/fcs\/pda\/cutting\/replenishment-feedback\/([^/]+)/)
  return matched?.[1] ?? ''
}
