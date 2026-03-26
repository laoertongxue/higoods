import { escapeHtml } from '../utils'
import { confirmCuttingHandover, getPdaCuttingTaskDetail } from '../data/fcs/pda-cutting-special'
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

interface HandoverFormState {
  operatorName: string
  targetLabel: string
  note: string
  feedbackMessage: string
  backHrefOverride: string
}

const handoverState = new Map<string, HandoverFormState>()

function getState(taskId: string, cutPieceOrderNo?: string | null): HandoverFormState {
  const stateKey = buildPdaCuttingExecutionStateKey(taskId, cutPieceOrderNo)
  const existing = handoverState.get(stateKey)
  if (existing) return existing
  const detail = getPdaCuttingTaskDetail(taskId, cutPieceOrderNo ?? undefined)
  const initial: HandoverFormState = {
    operatorName: '交接操作员',
    targetLabel: detail?.handoverTargetLabel && detail.handoverTargetLabel !== '待确定后道去向' ? detail.handoverTargetLabel : '裁片仓交接位',
    note: '',
    feedbackMessage: '',
    backHrefOverride: '',
  }
  handoverState.set(stateKey, initial)
  return initial
}

function renderHandoverHistory(detail: NonNullable<ReturnType<typeof getPdaCuttingTaskDetail>>): string {
  if (!detail || !detail.handoverRecords.length) {
    return renderPdaCuttingEmptyState('当前裁片单暂无交接记录', '')
  }

  return `
    <div class="space-y-2">
      ${detail.handoverRecords
        .map(
          (record) => `
            <article class="rounded-xl border px-3 py-3 text-xs">
              <div class="flex items-center justify-between gap-2">
                <div class="font-medium text-foreground">${escapeHtml(record.id)} / ${escapeHtml(record.resultLabel)}</div>
                <div class="text-muted-foreground">${escapeHtml(record.handoverAt)}</div>
              </div>
              <div class="mt-2 text-muted-foreground">交接去向：${escapeHtml(record.targetLabel)}</div>
              <div class="mt-1 text-muted-foreground">操作人：${escapeHtml(record.operatorName)}</div>
              <div class="mt-1 text-muted-foreground">备注：${escapeHtml(record.note || '无')}</div>
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

function renderHandoverStatus(detail: NonNullable<ReturnType<typeof getPdaCuttingTaskDetail>>): string {
  return renderPdaCuttingSummaryGrid([
    { label: '当前交接状态', value: detail.currentHandoverStatus },
    { label: '当前交接去向', value: detail.handoverTargetLabel },
    { label: '最近交接记录', value: detail.latestHandoverRecordNo || '暂无记录' },
    { label: '最近交接时间', value: detail.latestHandoverAt, hint: detail.latestHandoverBy },
  ])
}

export function renderPdaCuttingHandoverPage(taskId: string): string {
  const context = buildPdaCuttingExecutionContext(taskId, 'handover')
  const detail = context.detail

  if (!detail) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: '交接扫码',
      subtitle: '',
      activeTab: 'handover',
      body: '',
      backHref: context.backHref,
    })
  }

  if (context.requiresCutPieceOrderSelection) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: '交接扫码',
      subtitle: '',
      activeTab: 'handover',
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
        <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-handover-field="operatorName" value="${escapeHtml(form.operatorName)}" />
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">交接去向</span>
        <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-handover-field="targetLabel" value="${escapeHtml(form.targetLabel)}" placeholder="例如：裁片仓交接位 / 后道工位" />
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">交接备注</span>
        <textarea class="min-h-24 w-full rounded-xl border bg-background px-3 py-2 text-sm" data-pda-cut-handover-field="note" placeholder="填写交接提醒、后续去向和异常说明">${escapeHtml(form.note)}</textarea>
      </label>
      <div class="rounded-xl border bg-muted/20 px-3 py-3 text-xs">
        <div class="text-muted-foreground">本次交接预览</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(form.targetLabel || '待填写交接去向')}</div>
        <div class="mt-1 text-muted-foreground">当前位置：${escapeHtml(detail.inboundZoneLabel)} / ${escapeHtml(detail.inboundLocationLabel)}</div>
      </div>
      ${form.feedbackMessage ? renderPdaCuttingFeedbackNotice(form.feedbackMessage, 'success') : ''}
      <div class="grid grid-cols-2 gap-2">
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-2 text-xs font-medium hover:bg-muted" data-nav="${escapeHtml(pageBackHref)}">
          返回裁片任务
        </button>
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90" data-pda-cut-handover-action="confirm" data-task-id="${escapeHtml(taskId)}">
          确认交接
        </button>
      </div>
    </div>
  `

  const body = `
    ${renderPdaCuttingExecutionHero('交接扫码', detail)}
    ${renderPdaCuttingSection('当前情况', '', renderHandoverStatus(detail))}
    ${renderPdaCuttingSection('交接扫码', '', confirmSection)}
    ${renderPdaCuttingSection('最近交接记录', '', renderHandoverHistory(detail))}
  `

  return renderPdaCuttingPageLayout({
    taskId,
    title: '交接扫码',
    subtitle: '',
    activeTab: 'handover',
    body,
    backHref: pageBackHref,
  })
}

export function handlePdaCuttingHandoverEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pda-cut-handover-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    const taskId = fieldNode.closest<HTMLElement>('[data-task-id]')?.dataset.taskId || appTaskIdFromPath()
    if (!taskId) return true
    const selectedCutPieceOrderNo = readSelectedCutPieceOrderNoFromLocation()
    const form = getState(taskId, selectedCutPieceOrderNo)
    const field = fieldNode.dataset.pdaCutHandoverField
    if (!field) return true

    if (field === 'operatorName') form.operatorName = fieldNode.value
    if (field === 'targetLabel') form.targetLabel = fieldNode.value
    if (field === 'note') form.note = fieldNode.value
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-cut-handover-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pdaCutHandoverAction
  const taskId = actionNode.dataset.taskId
  if (!action || !taskId) return false
  const selectedCutPieceOrderNo = readSelectedCutPieceOrderNoFromLocation()

  if (action === 'confirm') {
    const form = getState(taskId, selectedCutPieceOrderNo)
    const context = buildPdaCuttingExecutionContext(taskId, 'handover')
    confirmCuttingHandover(taskId, {
      operatorName: form.operatorName.trim() || '交接操作员',
      targetLabel: form.targetLabel.trim() || '裁片仓交接位',
      note: form.note.trim(),
    }, selectedCutPieceOrderNo ?? undefined)
    form.feedbackMessage = '交接已确认。'
    form.backHrefOverride = buildPdaCuttingCompletedReturnHref(
      taskId,
      selectedCutPieceOrderNo,
      context.navContext,
      'handover',
    )
    return true
  }

  return false
}

function appTaskIdFromPath(): string {
  if (typeof window === 'undefined') return ''
  const matched = window.location.pathname.match(/\/fcs\/pda\/cutting\/handover\/([^/]+)/)
  return matched?.[1] ?? ''
}
