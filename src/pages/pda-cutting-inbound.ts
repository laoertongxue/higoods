import { escapeHtml } from '../utils'
import { confirmCuttingInbound, getPdaCuttingTaskDetail } from '../data/fcs/pda-cutting-special'
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
import { buildPdaCuttingExecutionContext, readSelectedCutPieceOrderNoFromLocation } from './pda-cutting-context'
import { buildPdaCuttingCompletedReturnHref } from './pda-cutting-nav-context'

interface InboundFormState {
  operatorName: string
  zoneCode: 'A' | 'B' | 'C'
  locationLabel: string
  note: string
  feedbackMessage: string
  backHrefOverride: string
}

const inboundState = new Map<string, InboundFormState>()

function getState(taskId: string, cutPieceOrderNo?: string | null): InboundFormState {
  const stateKey = buildPdaCuttingExecutionStateKey(taskId, cutPieceOrderNo)
  const existing = inboundState.get(stateKey)
  if (existing) return existing
  const initial: InboundFormState = {
    operatorName: '仓务操作员',
    zoneCode: 'B',
    locationLabel: 'B-02 临时位',
    note: '',
    feedbackMessage: '',
    backHrefOverride: '',
  }
  inboundState.set(stateKey, initial)
  return initial
}

function renderInboundHistory(detail: NonNullable<ReturnType<typeof getPdaCuttingTaskDetail>>): string {
  if (!detail || !detail.inboundRecords.length) {
    return renderPdaCuttingEmptyState('当前裁片单暂无入仓记录', '')
  }

  return `
    <div class="space-y-2">
      ${detail.inboundRecords
        .map(
          (record) => `
            <article class="rounded-xl border px-3 py-3 text-xs">
              <div class="flex items-center justify-between gap-2">
                <div class="font-medium text-foreground">${escapeHtml(record.id)} / ${escapeHtml(record.zoneCode)} 区 / ${escapeHtml(record.locationLabel)}</div>
                <div class="text-muted-foreground">${escapeHtml(record.scannedAt)}</div>
              </div>
              <div class="mt-2 text-muted-foreground">操作人：${escapeHtml(record.operatorName)}</div>
              <div class="mt-1 text-muted-foreground">备注：${escapeHtml(record.note || '无')}</div>
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

function renderInboundStatus(detail: NonNullable<ReturnType<typeof getPdaCuttingTaskDetail>>): string {
  return renderPdaCuttingSummaryGrid([
    { label: '当前入仓状态', value: detail.currentInboundStatus },
    { label: '建议区域', value: detail.inboundZoneLabel },
    { label: '当前库位', value: detail.inboundLocationLabel },
    { label: '最近入仓记录', value: detail.latestInboundRecordNo || '暂无记录', hint: detail.latestInboundAt },
  ])
}

export function renderPdaCuttingInboundPage(taskId: string): string {
  const context = buildPdaCuttingExecutionContext(taskId, 'inbound')
  const detail = context.detail

  if (!detail) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: '入仓扫码',
      subtitle: '',
      activeTab: 'exec',
      body: '',
      backHref: context.backHref,
    })
  }

  if (context.requiresCutPieceOrderSelection) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: '入仓扫码',
      subtitle: '',
      activeTab: 'exec',
      body: renderPdaCuttingOrderSelectionPrompt(detail, context.backHref, context.selectionNotice || undefined),
      backHref: context.backHref,
    })
  }

  const form = getState(taskId, context.selectedCutPieceOrderNo)
  const pageBackHref = form.backHrefOverride || context.backHref

  const confirmSection = `
    <div class="space-y-3 text-xs" data-task-id="${escapeHtml(taskId)}">
      <label class="block space-y-1">
        <span class="text-muted-foreground">操作人</span>
        <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-inbound-field="operatorName" value="${escapeHtml(form.operatorName)}" />
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">区域选择</span>
        <select class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-inbound-field="zoneCode">
          ${['A', 'B', 'C'].map((item) => `<option value="${item}" ${form.zoneCode === item ? 'selected' : ''}>${item} 区</option>`).join('')}
        </select>
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">库位说明</span>
        <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-inbound-field="locationLabel" value="${escapeHtml(form.locationLabel)}" placeholder="例如：A-01 临时位" />
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">入仓备注</span>
        <textarea class="min-h-24 w-full rounded-xl border bg-background px-3 py-2 text-sm" data-pda-cut-inbound-field="note" placeholder="补充当前区域说明、待交接提示或查找提醒">${escapeHtml(form.note)}</textarea>
      </label>
      <div class="rounded-xl border bg-muted/20 px-3 py-3 text-xs">
        <div class="text-muted-foreground">本次入仓预览</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(form.zoneCode)} 区 / ${escapeHtml(form.locationLabel || '待填写位置')}</div>
        <div class="mt-1 text-muted-foreground">交接摘要：${escapeHtml(detail.handoverSummary)}</div>
      </div>
      ${form.feedbackMessage ? renderPdaCuttingFeedbackNotice(form.feedbackMessage, 'success') : ''}
      <div class="grid grid-cols-2 gap-2">
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-2 text-xs font-medium hover:bg-muted" data-nav="${escapeHtml(pageBackHref)}">
          返回裁片任务
        </button>
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90" data-pda-cut-inbound-action="confirm" data-task-id="${escapeHtml(taskId)}">
          确认入仓
        </button>
      </div>
    </div>
  `

  const body = `
    ${renderPdaCuttingExecutionHero('入仓扫码', detail)}
    ${renderPdaCuttingSection('当前情况', '', renderInboundStatus(detail))}
    ${renderPdaCuttingSection('入仓扫码', '', confirmSection)}
    ${renderPdaCuttingSection('最近入仓记录', '', renderInboundHistory(detail))}
  `

  return renderPdaCuttingPageLayout({
    taskId,
    title: '入仓扫码',
    subtitle: '',
    activeTab: 'exec',
    body,
    backHref: pageBackHref,
  })
}

export function handlePdaCuttingInboundEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pda-cut-inbound-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLSelectElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    const taskId = fieldNode.closest<HTMLElement>('[data-task-id]')?.dataset.taskId || appTaskIdFromPath()
    if (!taskId) return true
    const selectedCutPieceOrderNo = readSelectedCutPieceOrderNoFromLocation()
    const form = getState(taskId, selectedCutPieceOrderNo)
    const field = fieldNode.dataset.pdaCutInboundField
    if (!field) return true

    if (field === 'operatorName') form.operatorName = fieldNode.value
    if (field === 'zoneCode' && fieldNode instanceof HTMLSelectElement) form.zoneCode = fieldNode.value as 'A' | 'B' | 'C'
    if (field === 'locationLabel') form.locationLabel = fieldNode.value
    if (field === 'note') form.note = fieldNode.value
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-cut-inbound-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pdaCutInboundAction
  const taskId = actionNode.dataset.taskId
  if (!action || !taskId) return false
  const selectedCutPieceOrderNo = readSelectedCutPieceOrderNoFromLocation()

  if (action === 'confirm') {
    const form = getState(taskId, selectedCutPieceOrderNo)
    const context = buildPdaCuttingExecutionContext(taskId, 'inbound')
    const result = confirmCuttingInbound(taskId, {
      operatorName: form.operatorName.trim() || '仓务操作员',
      zoneCode: form.zoneCode,
      locationLabel: form.locationLabel.trim() || `${form.zoneCode}-01 临时位`,
      note: form.note.trim(),
    }, selectedCutPieceOrderNo ?? undefined)
    if (!result.success) {
      form.feedbackMessage = result.issues.join('；')
      return true
    }
    form.feedbackMessage = '入仓已确认。'
    form.backHrefOverride = buildPdaCuttingCompletedReturnHref(
      taskId,
      selectedCutPieceOrderNo,
      context.navContext,
      'inbound',
    )
    return true
  }

  return false
}

function appTaskIdFromPath(): string {
  if (typeof window === 'undefined') return ''
  const matched = window.location.pathname.match(/\/fcs\/pda\/cutting\/inbound\/([^/]+)/)
  return matched?.[1] ?? ''
}
