import { escapeHtml } from '../utils'
import { buildPdaCuttingInboundProjection } from './pda-cutting-inbound-projection'
import {
  buildPdaCuttingWritebackSource,
  resolvePdaCuttingWritebackIdentity,
  resolvePdaCuttingWritebackOperator,
} from '../data/fcs/pda-cutting-writeback-inputs.ts'
import { writePdaInboundToFcs } from '../domain/cutting-pda-writeback/bridge.ts'
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

interface InboundFormState {
  operatorName: string
  zoneCode: 'A' | 'B' | 'C'
  locationLabel: string
  carrierCode: string
  scanCode: string
  inboundQty: string
  note: string
  feedbackMessage: string
  backHrefOverride: string
}

const inboundState = new Map<string, InboundFormState>()

function getInboundDetail(taskId: string, executionKey?: string | null) {
  return buildPdaCuttingInboundProjection(taskId, executionKey ?? undefined)
}

function getState(taskId: string, executionOrderId?: string | null, executionOrderNo?: string | null): InboundFormState {
  const stateKey = buildPdaCuttingExecutionStateKey(taskId, executionOrderId, executionOrderNo)
  const existing = inboundState.get(stateKey)
  if (existing) return existing
  const initial: InboundFormState = {
    operatorName: '仓务操作员',
    zoneCode: 'B',
    locationLabel: 'B-02 临时位',
    carrierCode: '',
    scanCode: '',
    inboundQty: '',
    note: '',
    feedbackMessage: '',
    backHrefOverride: '',
  }
  inboundState.set(stateKey, initial)
  return initial
}

function renderInboundHistory(detail: NonNullable<ReturnType<typeof getInboundDetail>>): string {
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
              <div class="mt-2 grid grid-cols-2 gap-1 text-muted-foreground">
                <div>操作人：${escapeHtml(record.operatorName)}</div>
                <div>暂存方式：可混装</div>
              </div>
              <div class="mt-1 text-muted-foreground">记录：${escapeHtml(record.note || '无')}</div>
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

function renderInboundStatus(detail: NonNullable<ReturnType<typeof getInboundDetail>>): string {
  return renderPdaCuttingSummaryGrid([
    { label: '当前入仓状态', value: detail.currentInboundStatus },
    { label: '暂存阶段', value: '入仓暂存，可混装' },
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

  const form = getState(taskId, context.selectedExecutionOrderId, context.selectedExecutionOrderNo)
  const pageBackHref = form.backHrefOverride || context.backHref

  const confirmSection = `
    <div class="space-y-3 text-xs" data-task-id="${escapeHtml(taskId)}">
      <label class="block space-y-1">
        <span class="text-muted-foreground">暂存袋 / 周转箱码</span>
        <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-inbound-field="carrierCode" value="${escapeHtml(form.carrierCode)}" placeholder="扫描或输入暂存袋码" />
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">菲票 / 裁片码</span>
        <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-inbound-field="scanCode" value="${escapeHtml(form.scanCode)}" placeholder="扫描菲票或裁片码" />
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">数量（片）</span>
        <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" type="number" min="0" step="1" data-pda-cut-inbound-field="inboundQty" value="${escapeHtml(form.inboundQty)}" placeholder="输入本次入仓数量" />
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">区域</span>
        <select class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-inbound-field="zoneCode">
          ${['A', 'B', 'C'].map((item) => `<option value="${item}" ${form.zoneCode === item ? 'selected' : ''}>${item} 区</option>`).join('')}
        </select>
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">库位</span>
        <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-inbound-field="locationLabel" value="${escapeHtml(form.locationLabel)}" placeholder="例如：A-01 临时位" />
      </label>
      <div class="rounded-xl border bg-muted/20 px-3 py-3 text-xs">
        <div class="text-muted-foreground">本次入仓预览</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(form.carrierCode || '待扫码')} / ${escapeHtml(form.inboundQty || '0')} 片</div>
        <div class="mt-1 text-muted-foreground">${escapeHtml(form.zoneCode)} 区 / ${escapeHtml(form.locationLabel || '待填写位置')} / 可混装暂存</div>
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
    const selectedExecutionOrderId = readSelectedExecutionOrderIdFromLocation()
    const selectedExecutionOrderNo = readSelectedExecutionOrderNoFromLocation()
    const form = getState(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
    const field = fieldNode.dataset.pdaCutInboundField
    if (!field) return true

    if (field === 'operatorName') form.operatorName = fieldNode.value
    if (field === 'zoneCode' && fieldNode instanceof HTMLSelectElement) form.zoneCode = fieldNode.value as 'A' | 'B' | 'C'
    if (field === 'locationLabel') form.locationLabel = fieldNode.value
    if (field === 'carrierCode') form.carrierCode = fieldNode.value
    if (field === 'scanCode') form.scanCode = fieldNode.value
    if (field === 'inboundQty') form.inboundQty = fieldNode.value
    if (field === 'note') form.note = fieldNode.value
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-cut-inbound-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pdaCutInboundAction
  const taskId = actionNode.dataset.taskId
  if (!action || !taskId) return false
  const selectedExecutionOrderId = readSelectedExecutionOrderIdFromLocation()
  const selectedExecutionOrderNo = readSelectedExecutionOrderNoFromLocation()

  if (action === 'confirm') {
    const form = getState(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
    const context = buildPdaCuttingExecutionContext(taskId, 'inbound')
    const identity = resolvePdaCuttingWritebackIdentity(taskId, {
      executionOrderId: context.selectedExecutionOrderId || undefined,
      executionOrderNo: context.selectedExecutionOrderNo || undefined,
      cutOrderId: context.selectedExecutionOrder?.cutOrderId || undefined,
      cutOrderNo: context.selectedExecutionOrder?.cutOrderNo || undefined,
      markerPlanId: context.selectedExecutionOrder?.markerPlanId || undefined,
      markerPlanNo: context.selectedExecutionOrder?.markerPlanNo || undefined,
      materialSku: context.selectedExecutionOrder?.materialSku || undefined,
    })
    const operator = resolvePdaCuttingWritebackOperator(taskId, form.operatorName.trim() || '仓务操作员')
    if (!identity || !operator) {
      form.feedbackMessage = '当前执行对象或操作人无法识别，不能确认入仓。'
      return true
    }
    if (!form.carrierCode.trim() || !form.scanCode.trim()) {
      form.feedbackMessage = '请先扫描暂存袋和菲票。'
      return true
    }
    const inboundQty = Number(form.inboundQty)
    if (!Number.isFinite(inboundQty) || inboundQty <= 0) {
      form.feedbackMessage = '请先输入有效入仓数量。'
      return true
    }
    const result = writePdaInboundToFcs({
      identity,
      operator,
      source: buildPdaCuttingWritebackSource('inbound', identity.executionOrderId),
      zoneCode: form.zoneCode,
      locationLabel: form.locationLabel.trim() || `${form.zoneCode}-01 临时位`,
      note: [
        `暂存袋：${form.carrierCode.trim()}`,
        `扫码：${form.scanCode.trim()}`,
        `数量：${inboundQty} 片`,
        '入仓暂存袋允许混装',
        form.note.trim(),
      ].filter(Boolean).join('；'),
    })
    if (!result.success) {
      form.feedbackMessage = result.issues.join('；')
      return true
    }
    form.scanCode = ''
    form.inboundQty = ''
    form.feedbackMessage = '入仓已确认。'
    form.backHrefOverride = buildPdaCuttingCompletedReturnHref(
      taskId,
      context.selectedExecutionOrderId,
      context.selectedExecutionOrderNo,
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
