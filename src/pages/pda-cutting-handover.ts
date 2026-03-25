import { escapeHtml } from '../utils'
import { buildPdaCuttingRoute, confirmCuttingHandover, getPdaCuttingTaskDetail } from '../data/fcs/pda-cutting-special'
import {
  renderPdaCuttingEmptyState,
  renderPdaCuttingPageLayout,
  renderPdaCuttingSection,
  renderPdaCuttingSummaryGrid,
  renderPdaCuttingTaskHero,
} from './pda-cutting-shared'

interface HandoverFormState {
  operatorName: string
  targetLabel: string
  note: string
}

const handoverState = new Map<string, HandoverFormState>()

function getState(taskId: string): HandoverFormState {
  const existing = handoverState.get(taskId)
  if (existing) return existing
  const detail = getPdaCuttingTaskDetail(taskId)
  const initial: HandoverFormState = {
    operatorName: '交接操作员',
    targetLabel: detail?.handoverTargetLabel && detail.handoverTargetLabel !== '待确定后道去向' ? detail.handoverTargetLabel : '裁片仓交接位',
    note: '',
  }
  handoverState.set(taskId, initial)
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
        <div class="text-muted-foreground">交接对象摘要</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(detail.materialSku)}</div>
        <div class="mt-1 text-muted-foreground">当前所在：${escapeHtml(detail.inboundZoneLabel)} / ${escapeHtml(detail.inboundLocationLabel)}</div>
        <div class="mt-1 text-muted-foreground">交接去向：${escapeHtml(detail.handoverTargetLabel)}</div>
      </article>
    </div>
  `
}

function renderHandoverHistory(taskId: string): string {
  const detail = getPdaCuttingTaskDetail(taskId)
  if (!detail || !detail.handoverRecords.length) {
    return renderPdaCuttingEmptyState('暂无交接扫码记录', '后续扫码交接完成后，这里会展示交接对象、去向和最近一次交接结果。')
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

function renderHandoverStatus(taskId: string): string {
  const detail = getPdaCuttingTaskDetail(taskId)
  if (!detail) return ''

  return `
    <div class="grid grid-cols-2 gap-3 text-xs">
      <article class="rounded-xl border px-3 py-3">
        <div class="text-muted-foreground">当前交接状态</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(detail.currentHandoverStatus)}</div>
        <div class="mt-1 text-muted-foreground">记录号：${escapeHtml(detail.latestHandoverRecordNo)}</div>
      </article>
      <article class="rounded-xl border px-3 py-3">
        <div class="text-muted-foreground">最近一次交接</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(detail.latestHandoverAt)}</div>
        <div class="mt-1 text-muted-foreground">操作人：${escapeHtml(detail.latestHandoverBy)}</div>
      </article>
    </div>
  `
}

export function renderPdaCuttingHandoverPage(taskId: string): string {
  const detail = getPdaCuttingTaskDetail(taskId)

  if (!detail) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: '交接扫码',
      subtitle: '',
      activeTab: 'handover',
      body: '',
      backHref: buildPdaCuttingRoute(taskId, 'task'),
    })
  }

  const form = getState(taskId)

  const summary = renderPdaCuttingSummaryGrid([
    { label: '当前交接摘要', value: detail.handoverSummary, hint: detail.currentHandoverStatus },
    { label: '当前交接去向', value: detail.handoverTargetLabel },
    { label: '最近交接时间', value: detail.latestHandoverAt, hint: detail.latestHandoverBy },
    { label: '当前入仓位置', value: `${detail.inboundZoneLabel} / ${detail.inboundLocationLabel}` },
  ])

  const handoverSection = `
    <div class="space-y-3 text-xs">
      <div class="rounded-xl border border-dashed px-3 py-4 text-center">
        <div class="text-sm font-medium text-foreground">扫码入口区</div>
        <p class="mt-1 text-muted-foreground">真实扫码交接能力后续补齐，这里先承接交接对象摘要、去向确认和交接结果回写。</p>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div class="rounded-xl border px-3 py-3">
          <div class="text-muted-foreground">当前交接对象摘要</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(detail.cutPieceOrderNo)}</div>
          <div class="mt-1 text-muted-foreground">${escapeHtml(detail.materialSku)}</div>
        </div>
        <div class="rounded-xl border px-3 py-3">
          <div class="text-muted-foreground">当前交接去向</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(detail.handoverTargetLabel)}</div>
          <div class="mt-1 text-muted-foreground">${escapeHtml(detail.handoverSummary)}</div>
        </div>
      </div>
      <div class="rounded-xl bg-blue-50 px-3 py-3 text-xs text-blue-800">
        当前交接页只处理“确认交接去向”和“记录最近一次交接”，不会在这里展开完整后道接收流程。
      </div>
    </div>
  `

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
      <div class="rounded-xl bg-amber-50 px-3 py-3 text-xs text-amber-800">
        交接扫码页只承接裁片专项交接确认，不在这里展开完整后道交接流程。
      </div>
      <div class="rounded-xl border bg-muted/20 px-3 py-3 text-xs">
        <div class="text-muted-foreground">本次交接预览</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(form.targetLabel || '待填写交接去向')}</div>
        <div class="mt-1 text-muted-foreground">当前位置：${escapeHtml(detail.inboundZoneLabel)} / ${escapeHtml(detail.inboundLocationLabel)}</div>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-2 text-xs font-medium hover:bg-muted" data-nav="${escapeHtml(buildPdaCuttingRoute(taskId, 'task'))}">
          返回任务详情
        </button>
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90" data-pda-cut-handover-action="confirm" data-task-id="${escapeHtml(taskId)}">
          确认交接
        </button>
      </div>
    </div>
  `

  const body = `
    ${renderPdaCuttingTaskHero(detail)}
    ${summary}
    ${renderPdaCuttingSection('当前任务 / 裁片单摘要', '先确认交接对象、所在区域和当前交接去向，再执行交接确认。', renderTaskSnapshot(taskId))}
    ${renderPdaCuttingSection('交接对象与去向摘要', '展示当前裁片交接对象、去向和最近一次交接状态。', handoverSection)}
    ${renderPdaCuttingSection('交接确认', '现场操作员可在此确认交接去向，并回写交接结果。', confirmSection)}
    ${renderPdaCuttingSection('交接状态摘要', '这里集中展示最近一次交接记录号、时间和当前交接状态。', renderHandoverStatus(taskId))}
    ${renderPdaCuttingSection('最近交接记录', '用于查看最近一次交接摘要和历史结果。', renderHandoverHistory(taskId))}
  `

  return renderPdaCuttingPageLayout({
    taskId,
    title: '交接扫码',
    subtitle: '',
    activeTab: 'handover',
    body,
    backHref: buildPdaCuttingRoute(taskId, 'task'),
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
    const form = getState(taskId)
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

  if (action === 'confirm') {
    const form = getState(taskId)
    confirmCuttingHandover(taskId, {
      operatorName: form.operatorName.trim() || '交接操作员',
      targetLabel: form.targetLabel.trim() || '裁片仓交接位',
      note: form.note.trim(),
    })
    return true
  }

  return false
}

function appTaskIdFromPath(): string {
  if (typeof window === 'undefined') return ''
  const matched = window.location.pathname.match(/\/fcs\/pda\/cutting\/handover\/([^/]+)/)
  return matched?.[1] ?? ''
}
