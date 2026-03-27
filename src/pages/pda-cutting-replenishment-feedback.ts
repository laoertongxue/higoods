import { escapeHtml } from '../utils'
import { getPdaCuttingTaskDetail, submitCuttingReplenishmentFeedback } from '../data/fcs/pda-cutting-special'
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

interface ReplenishmentFormState {
  operatorName: string
  reasonLabel: string
  note: string
  photoProofCount: string
  feedbackMessage: string
  backHrefOverride: string
}

const feedbackState = new Map<string, ReplenishmentFormState>()

function getState(taskId: string, cutPieceOrderNo?: string | null): ReplenishmentFormState {
  const stateKey = buildPdaCuttingExecutionStateKey(taskId, cutPieceOrderNo)
  const existing = feedbackState.get(stateKey)
  if (existing) return existing
  const detail = getPdaCuttingTaskDetail(taskId, cutPieceOrderNo ?? undefined)
  const initial: ReplenishmentFormState = {
    operatorName: detail?.latestFeedbackBy && detail.latestFeedbackBy !== '-' ? detail.latestFeedbackBy : '现场反馈人',
    reasonLabel: detail?.latestFeedbackReason && detail.latestFeedbackReason !== '-' ? detail.latestFeedbackReason : '铺布余量不足预警',
    note: detail?.latestFeedbackNote && detail.latestFeedbackNote !== '-' ? detail.latestFeedbackNote : '',
    photoProofCount: String(detail?.photoProofCount ?? 0),
    feedbackMessage: '',
    backHrefOverride: '',
  }
  feedbackState.set(stateKey, initial)
  return initial
}

function renderFeedbackHistory(detail: NonNullable<ReturnType<typeof getPdaCuttingTaskDetail>>): string {
  if (!detail || !detail.replenishmentFeedbacks.length) {
    return renderPdaCuttingEmptyState('当前裁片单暂无补料反馈记录', '')
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
              <div class="mt-1 text-muted-foreground">反馈说明：${escapeHtml(item.note || '无')}</div>
              <div class="mt-1 text-muted-foreground">照片 / 凭证：${escapeHtml(String(item.photoProofCount))} 个</div>
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

function renderFeedbackStatus(detail: NonNullable<ReturnType<typeof getPdaCuttingTaskDetail>>): string {
  return renderPdaCuttingSummaryGrid([
    { label: '当前风险情况', value: detail.replenishmentRiskSummary },
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
      title: '补料反馈',
      subtitle: '',
      activeTab: 'exec',
      body: '',
      backHref: context.backHref,
    })
  }

  if (context.requiresCutPieceOrderSelection) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: '补料反馈',
      subtitle: '',
      activeTab: 'exec',
      body: renderPdaCuttingOrderSelectionPrompt(detail, context.backHref, context.selectionNotice || undefined),
      backHref: context.backHref,
    })
  }

  const form = getState(taskId, context.selectedCutPieceOrderNo)
  const pageBackHref = form.backHrefOverride || context.backHref

  const formSection = `
    <div class="space-y-3 text-xs" data-task-id="${escapeHtml(taskId)}">
      <div class="rounded-xl border border-dashed px-3 py-4 text-center">
        <div class="text-sm font-medium text-foreground">当前补料风险摘要</div>
        <p class="mt-1 text-muted-foreground">${escapeHtml(detail.replenishmentRiskSummary)}</p>
      </div>
      <label class="block space-y-1">
        <span class="text-muted-foreground">反馈人</span>
        <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-replenishment-field="operatorName" value="${escapeHtml(form.operatorName)}" />
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">补料原因</span>
        <select class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-replenishment-field="reasonLabel">
          ${['铺布余量不足预警', '领料差异导致预计不足', '现场裁剪损耗偏高', '需补充照片后再判断'].map((item) => `<option value="${escapeHtml(item)}" ${form.reasonLabel === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
        </select>
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">反馈说明</span>
        <textarea class="min-h-24 w-full rounded-xl border bg-background px-3 py-2 text-sm" data-pda-cut-replenishment-field="note" placeholder="请填写补料风险、现场判断和建议处理方式">${escapeHtml(form.note)}</textarea>
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">照片 / 凭证数量</span>
        <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-replenishment-field="photoProofCount" value="${escapeHtml(form.photoProofCount)}" />
      </label>
      <div class="rounded-xl border bg-muted/20 px-3 py-3 text-xs">
        <div class="text-muted-foreground">本次反馈预览</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(form.reasonLabel)}</div>
        <div class="mt-1 text-muted-foreground">说明：${escapeHtml(form.note || '待填写')}</div>
        <div class="mt-1 text-muted-foreground">照片 / 凭证：${escapeHtml(form.photoProofCount || '0')} 个</div>
      </div>
      ${form.feedbackMessage ? renderPdaCuttingFeedbackNotice(form.feedbackMessage, 'success') : ''}
      <div class="grid grid-cols-2 gap-2">
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-2 text-xs font-medium hover:bg-muted" data-nav="${escapeHtml(pageBackHref)}">
          返回裁片任务
        </button>
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90" data-pda-cut-replenishment-action="submit" data-task-id="${escapeHtml(taskId)}">
          提交补料反馈
        </button>
      </div>
    </div>
  `

  const body = `
    ${renderPdaCuttingExecutionHero('补料反馈', detail)}
    ${renderPdaCuttingSection('当前情况', '', renderFeedbackStatus(detail))}
    ${renderPdaCuttingSection('补料反馈', '', formSection)}
    ${renderPdaCuttingSection('最近反馈记录', '', renderFeedbackHistory(detail))}
  `

  return renderPdaCuttingPageLayout({
    taskId,
    title: '补料反馈',
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
    const selectedCutPieceOrderNo = readSelectedCutPieceOrderNoFromLocation()
    const form = getState(taskId, selectedCutPieceOrderNo)
    const field = fieldNode.dataset.pdaCutReplenishmentField
    if (!field) return true

    if (field === 'operatorName') form.operatorName = fieldNode.value
    if (field === 'reasonLabel') form.reasonLabel = fieldNode.value
    if (field === 'note') form.note = fieldNode.value
    if (field === 'photoProofCount') form.photoProofCount = fieldNode.value
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-cut-replenishment-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pdaCutReplenishmentAction
  const taskId = actionNode.dataset.taskId
  if (!action || !taskId) return false
  const selectedCutPieceOrderNo = readSelectedCutPieceOrderNoFromLocation()

  if (action === 'submit') {
    const form = getState(taskId, selectedCutPieceOrderNo)
    const context = buildPdaCuttingExecutionContext(taskId, 'replenishment-feedback')
    const result = submitCuttingReplenishmentFeedback(taskId, {
      operatorName: form.operatorName.trim() || '现场反馈人',
      reasonLabel: form.reasonLabel,
      note: form.note.trim() || '现场已记录补料风险，待 PCS 跟进',
      photoProofCount: Number(form.photoProofCount || '0') || 0,
    }, selectedCutPieceOrderNo ?? undefined)
    if (!result.success) {
      form.feedbackMessage = result.issues.join('；')
      return true
    }
    form.feedbackMessage = '补料反馈已提交。'
    form.backHrefOverride = buildPdaCuttingCompletedReturnHref(
      taskId,
      selectedCutPieceOrderNo,
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
