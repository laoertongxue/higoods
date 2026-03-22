import { escapeHtml } from '../utils'
import { buildPdaCuttingRoute, getPdaCuttingTaskDetail, submitCuttingReplenishmentFeedback } from '../data/fcs/pda-cutting-special'
import {
  renderPdaCuttingEmptyState,
  renderPdaCuttingPageLayout,
  renderPdaCuttingSection,
  renderPdaCuttingSummaryGrid,
  renderPdaCuttingTaskHero,
} from './pda-cutting-shared'

interface ReplenishmentFormState {
  operatorName: string
  reasonLabel: string
  note: string
  photoProofCount: string
}

const feedbackState = new Map<string, ReplenishmentFormState>()

function getState(taskId: string): ReplenishmentFormState {
  const existing = feedbackState.get(taskId)
  if (existing) return existing
  const detail = getPdaCuttingTaskDetail(taskId)
  const initial: ReplenishmentFormState = {
    operatorName: detail?.latestFeedbackBy && detail.latestFeedbackBy !== '-' ? detail.latestFeedbackBy : '现场反馈人',
    reasonLabel: detail?.latestFeedbackReason && detail.latestFeedbackReason !== '-' ? detail.latestFeedbackReason : '铺布余量不足预警',
    note: detail?.latestFeedbackNote && detail.latestFeedbackNote !== '-' ? detail.latestFeedbackNote : '',
    photoProofCount: String(detail?.photoProofCount ?? 0),
  }
  feedbackState.set(taskId, initial)
  return initial
}

function renderTaskSnapshot(taskId: string): string {
  const detail = getPdaCuttingTaskDetail(taskId)
  if (!detail) return ''

  return `
    <div class="grid grid-cols-2 gap-3 text-xs">
      <article class="rounded-xl border bg-muted/20 px-3 py-3">
        <div class="text-muted-foreground">当前任务 / 裁片单</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(detail.taskNo)}</div>
        <div class="mt-1 text-muted-foreground">生产单：${escapeHtml(detail.productionOrderNo)}</div>
        <div class="mt-1 text-muted-foreground">裁片单：${escapeHtml(detail.cutPieceOrderNo)}</div>
      </article>
      <article class="rounded-xl border bg-muted/20 px-3 py-3">
        <div class="text-muted-foreground">风险对象</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(detail.materialSku)}</div>
        <div class="mt-1 text-muted-foreground">${escapeHtml(detail.materialTypeLabel)}</div>
        <div class="mt-1 text-muted-foreground">当前阶段：${escapeHtml(detail.currentStage)}</div>
      </article>
    </div>
  `
}

function renderFeedbackHistory(taskId: string): string {
  const detail = getPdaCuttingTaskDetail(taskId)
  if (!detail || !detail.replenishmentFeedbacks.length) {
    return renderPdaCuttingEmptyState('暂无补料反馈记录', '后续如果现场判断存在补料风险，这里会展示最近一次反馈时间、原因和凭证数量。')
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

function renderFeedbackStatus(taskId: string): string {
  const detail = getPdaCuttingTaskDetail(taskId)
  if (!detail) return ''

  return `
    <div class="grid grid-cols-2 gap-3 text-xs">
      <article class="rounded-xl border px-3 py-3">
        <div class="text-muted-foreground">最近一次反馈</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(detail.latestFeedbackAt)}</div>
        <div class="mt-1 text-muted-foreground">反馈人：${escapeHtml(detail.latestFeedbackBy)}</div>
      </article>
      <article class="rounded-xl border px-3 py-3">
        <div class="text-muted-foreground">回执 / 凭证摘要</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(detail.latestReplenishmentFeedbackRecordNo)}</div>
        <div class="mt-1 text-muted-foreground">照片 / 凭证：${escapeHtml(String(detail.photoProofCount))} 个</div>
      </article>
    </div>
  `
}

export function renderPdaCuttingReplenishmentFeedbackPage(taskId: string): string {
  const detail = getPdaCuttingTaskDetail(taskId)

  if (!detail) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: '补料反馈',
      subtitle: '围绕裁片现场的补料风险、反馈说明和凭证位建立专项页面骨架。',
      activeTab: 'exec',
      body: '',
      backHref: buildPdaCuttingRoute(taskId, 'task'),
    })
  }

  const form = getState(taskId)

  const summary = renderPdaCuttingSummaryGrid([
    { label: '当前补料风险', value: detail.replenishmentRiskSummary },
    { label: '最近反馈时间', value: detail.latestFeedbackAt, hint: detail.latestFeedbackBy },
    { label: '最近反馈原因', value: detail.latestFeedbackReason },
    { label: '照片 / 凭证', value: `${detail.photoProofCount} 个` },
  ])

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
      <div class="rounded-xl bg-amber-50 px-3 py-3 text-xs text-amber-800">
        这里只承接补料风险反馈和凭证位，不会在工厂端新建补料审核或补料配置流程。
      </div>
      <div class="grid grid-cols-2 gap-2">
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-2 text-xs font-medium hover:bg-muted" data-nav="${escapeHtml(buildPdaCuttingRoute(taskId, 'task'))}">
          返回任务详情
        </button>
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90" data-pda-cut-replenishment-action="submit" data-task-id="${escapeHtml(taskId)}">
          提交补料反馈
        </button>
      </div>
    </div>
  `

  const body = `
    ${renderPdaCuttingTaskHero(detail)}
    ${summary}
    ${renderPdaCuttingSection('当前任务 / 裁片单摘要', '先确认当前裁片单、面料对象和执行阶段，再填写现场补料风险反馈。', renderTaskSnapshot(taskId))}
    ${renderPdaCuttingSection('补料风险与反馈录入', '围绕裁片现场缺口、差异和照片凭证位建立补料反馈骨架。', formSection)}
    ${renderPdaCuttingSection('最近一次反馈摘要', '这里集中展示最近一次补料反馈时间、记录号和凭证数量。', renderFeedbackStatus(taskId))}
    ${renderPdaCuttingSection('最近反馈记录', '用于查看最近一次补料风险反馈、原因与凭证数量。', renderFeedbackHistory(taskId))}
  `

  return renderPdaCuttingPageLayout({
    taskId,
    title: '补料反馈',
    subtitle: '围绕裁片现场的补料风险、反馈说明和凭证位建立专项页面骨架。',
    activeTab: 'exec',
    body,
    backHref: buildPdaCuttingRoute(taskId, 'task'),
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
    const form = getState(taskId)
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

  if (action === 'submit') {
    const form = getState(taskId)
    submitCuttingReplenishmentFeedback(taskId, {
      operatorName: form.operatorName.trim() || '现场反馈人',
      reasonLabel: form.reasonLabel,
      note: form.note.trim() || '现场已记录补料风险，待 PCS 跟进',
      photoProofCount: Number(form.photoProofCount || '0') || 0,
    })
    return true
  }

  return false
}

function appTaskIdFromPath(): string {
  if (typeof window === 'undefined') return ''
  const matched = window.location.pathname.match(/\/fcs\/pda\/cutting\/replenishment-feedback\/([^/]+)/)
  return matched?.[1] ?? ''
}
