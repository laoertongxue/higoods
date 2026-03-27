import { escapeHtml } from '../utils'
import { buildPdaCuttingSpreadingProjection } from './pda-cutting-spreading-projection'
import {
  buildDefaultPdaRollNo,
  buildPdaCuttingWritebackSource,
  resolvePdaCuttingWritebackIdentity,
  resolvePdaCuttingWritebackOperator,
} from '../data/fcs/pda-cutting-writeback-inputs.ts'
import { writePdaSpreadingToFcs } from '../domain/cutting-pda-writeback/bridge.ts'
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

interface SpreadingFormState {
  spreadingMode: 'NORMAL' | 'HIGH_LOW' | 'FOLD'
  fabricRollNo: string
  layerCount: string
  actualLength: string
  headLength: string
  tailLength: string
  enteredBy: string
  note: string
  feedbackMessage: string
  backHrefOverride: string
}

const spreadingState = new Map<string, SpreadingFormState>()

function getSpreadingDetail(taskId: string, executionKey?: string | null) {
  return buildPdaCuttingSpreadingProjection(taskId, executionKey ?? undefined)
}

function getState(taskId: string, executionOrderId?: string | null, executionOrderNo?: string | null): SpreadingFormState {
  const stateKey = buildPdaCuttingExecutionStateKey(taskId, executionOrderId, executionOrderNo)
  const existing = spreadingState.get(stateKey)
  if (existing) return existing
  const initial: SpreadingFormState = {
    spreadingMode: 'NORMAL',
    fabricRollNo: '',
    layerCount: '12',
    actualLength: '48',
    headLength: '0.5',
    tailLength: '0.5',
    enteredBy: '现场铺布员',
    note: '',
    feedbackMessage: '',
    backHrefOverride: '',
  }
  spreadingState.set(stateKey, initial)
  return initial
}

function getSpreadingModeLabel(mode: SpreadingFormState['spreadingMode']): string {
  if (mode === 'HIGH_LOW') return '高低层模式'
  if (mode === 'FOLD') return '对折模式'
  return '正常模式'
}

function getCalculatedLength(form: SpreadingFormState): string {
  const actual = Number(form.actualLength || '0')
  const head = Number(form.headLength || '0')
  const tail = Number(form.tailLength || '0')
  return `${(actual + head + tail).toFixed(1)} 米`
}

function renderRecords(detail: NonNullable<ReturnType<typeof getSpreadingDetail>>): string {
  if (!detail || !detail.spreadingRecords.length) {
    return renderPdaCuttingEmptyState('当前裁片单暂无铺布记录', '')
  }

  const totalLength = detail.spreadingRecords.reduce((sum, item) => sum + item.calculatedLength, 0)

  return `
    <div class="space-y-3">
      <div class="rounded-xl bg-muted/30 px-3 py-3 text-xs">
        <div class="text-muted-foreground">汇总长度</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(totalLength.toFixed(1))} 米</div>
      </div>
      ${detail.spreadingRecords
        .map(
          (item) => `
            <article class="rounded-xl border px-3 py-3 text-xs">
              <div class="flex items-center justify-between gap-2">
                <div class="font-medium text-foreground">${escapeHtml(item.id)} / ${escapeHtml(item.fabricRollNo)}</div>
                <div class="text-muted-foreground">${escapeHtml(item.enteredAt)}</div>
              </div>
              <div class="mt-2 grid grid-cols-2 gap-2 text-muted-foreground">
                <div>铺布层数：${escapeHtml(String(item.layerCount))}</div>
                <div>实际长度：${escapeHtml(String(item.actualLength))} 米</div>
                <div>布头：${escapeHtml(String(item.headLength))} 米</div>
                <div>布尾：${escapeHtml(String(item.tailLength))} 米</div>
              </div>
              <div class="mt-2 text-muted-foreground">自动计算长度：${escapeHtml(String(item.calculatedLength))} 米</div>
              <div class="mt-1 text-muted-foreground">录入人：${escapeHtml(item.enteredBy)} / 来源：${escapeHtml(item.sourceType)}</div>
              <div class="mt-1 text-muted-foreground">备注：${escapeHtml(item.note || '无')}</div>
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

function renderLatestSummary(detail: NonNullable<ReturnType<typeof getSpreadingDetail>>): string {
  return renderPdaCuttingSummaryGrid([
    { label: '当前铺布状态', value: detail.currentExecutionStatus },
    { label: '最近记录号', value: detail.latestSpreadingRecordNo || '暂无记录' },
    { label: '最近录入时间', value: detail.latestSpreadingAt, hint: detail.latestSpreadingBy },
    { label: '当前建议动作', value: detail.nextRecommendedAction },
  ])
}

export function renderPdaCuttingSpreadingPage(taskId: string): string {
  const context = buildPdaCuttingExecutionContext(taskId, 'spreading')
  const detail = context.detail

  if (!detail) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: '铺布录入',
      subtitle: '',
      activeTab: 'exec',
      body: '',
      backHref: context.backHref,
    })
  }

  if (context.requiresCutPieceOrderSelection) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: '铺布录入',
      subtitle: '',
      activeTab: 'exec',
      body: renderPdaCuttingOrderSelectionPrompt(detail, context.backHref, context.selectionNotice || undefined),
      backHref: context.backHref,
    })
  }

  const form = getState(taskId, context.selectedExecutionOrderId, context.selectedExecutionOrderNo)
  const pageBackHref = form.backHrefOverride || context.backHref

  const formSection = `
    <div class="space-y-3" data-task-id="${escapeHtml(taskId)}">
      <div class="grid grid-cols-2 gap-3 text-xs">
        <label class="block space-y-1">
          <span class="text-muted-foreground">铺布模式</span>
          <select class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-spreading-field="spreadingMode">
            <option value="NORMAL" ${form.spreadingMode === 'NORMAL' ? 'selected' : ''}>正常模式</option>
            <option value="HIGH_LOW" ${form.spreadingMode === 'HIGH_LOW' ? 'selected' : ''}>高低层模式</option>
            <option value="FOLD" ${form.spreadingMode === 'FOLD' ? 'selected' : ''}>对折模式</option>
          </select>
        </label>
        <label class="block space-y-1">
          <span class="text-muted-foreground">布料卷号</span>
          <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-spreading-field="fabricRollNo" value="${escapeHtml(form.fabricRollNo)}" />
        </label>
        <label class="block space-y-1">
          <span class="text-muted-foreground">铺布层数</span>
          <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-spreading-field="layerCount" value="${escapeHtml(form.layerCount)}" />
        </label>
        <label class="block space-y-1">
          <span class="text-muted-foreground">实际长度（米）</span>
          <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-spreading-field="actualLength" value="${escapeHtml(form.actualLength)}" />
        </label>
        <label class="block space-y-1">
          <span class="text-muted-foreground">录入人</span>
          <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-spreading-field="enteredBy" value="${escapeHtml(form.enteredBy)}" />
        </label>
        <label class="block space-y-1">
          <span class="text-muted-foreground">布头长度（米）</span>
          <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-spreading-field="headLength" value="${escapeHtml(form.headLength)}" />
        </label>
        <label class="block space-y-1">
          <span class="text-muted-foreground">布尾长度（米）</span>
          <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-spreading-field="tailLength" value="${escapeHtml(form.tailLength)}" />
        </label>
      </div>
      <label class="block space-y-1 text-xs">
        <span class="text-muted-foreground">备注</span>
        <textarea class="min-h-24 w-full rounded-xl border bg-background px-3 py-2 text-sm" data-pda-cut-spreading-field="note" placeholder="填写当前铺布情况、异常或补录说明">${escapeHtml(form.note)}</textarea>
      </label>
      <div class="rounded-xl bg-blue-50 px-3 py-3 text-xs text-blue-800">
        自动计算长度：${escapeHtml(getCalculatedLength(form))}。
      </div>
      ${form.feedbackMessage ? renderPdaCuttingFeedbackNotice(form.feedbackMessage, 'success') : ''}
      <div class="rounded-xl border bg-muted/20 px-3 py-3 text-xs">
        <div class="text-muted-foreground">当前录入预览</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(form.fabricRollNo || '待填写卷号')}</div>
        <div class="mt-1 text-muted-foreground">模式：${escapeHtml(getSpreadingModeLabel(form.spreadingMode))}</div>
        <div class="mt-1 text-muted-foreground">层数：${escapeHtml(form.layerCount || '0')} / 实际长度：${escapeHtml(form.actualLength || '0')} 米</div>
        <div class="mt-1 text-muted-foreground">布头 / 布尾：${escapeHtml(form.headLength || '0')} 米 / ${escapeHtml(form.tailLength || '0')} 米</div>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-2 text-xs font-medium hover:bg-muted" data-nav="${escapeHtml(pageBackHref)}">
          返回裁片任务
        </button>
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90" data-pda-cut-spreading-action="submit" data-task-id="${escapeHtml(taskId)}">
          保存铺布记录
        </button>
      </div>
    </div>
  `

  const body = `
    ${renderPdaCuttingExecutionHero('铺布录入', detail)}
    ${renderPdaCuttingSection('当前情况', '', renderLatestSummary(detail))}
    ${renderPdaCuttingSection('铺布录入', '', formSection)}
    ${renderPdaCuttingSection('最近铺布记录', '', renderRecords(detail))}
  `

  return renderPdaCuttingPageLayout({
    taskId,
    title: '铺布录入',
    subtitle: '',
    activeTab: 'exec',
    body,
    backHref: pageBackHref,
  })
}

export function handlePdaCuttingSpreadingEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pda-cut-spreading-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    const taskId = fieldNode.closest<HTMLElement>('[data-task-id]')?.dataset.taskId || appTaskIdFromPath()
    if (!taskId) return true
    const selectedExecutionOrderId = readSelectedExecutionOrderIdFromLocation()
    const selectedExecutionOrderNo = readSelectedExecutionOrderNoFromLocation()
    const form = getState(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
    const field = fieldNode.dataset.pdaCutSpreadingField
    if (!field) return true

    if (field === 'spreadingMode' && fieldNode instanceof HTMLSelectElement) form.spreadingMode = fieldNode.value as SpreadingFormState['spreadingMode']
    if (field === 'fabricRollNo') form.fabricRollNo = fieldNode.value
    if (field === 'layerCount') form.layerCount = fieldNode.value
    if (field === 'actualLength') form.actualLength = fieldNode.value
    if (field === 'headLength') form.headLength = fieldNode.value
    if (field === 'tailLength') form.tailLength = fieldNode.value
    if (field === 'enteredBy') form.enteredBy = fieldNode.value
    if (field === 'note') form.note = fieldNode.value
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-cut-spreading-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pdaCutSpreadingAction
  const taskId = actionNode.dataset.taskId
  if (!action || !taskId) return false
  const selectedExecutionOrderId = readSelectedExecutionOrderIdFromLocation()
  const selectedExecutionOrderNo = readSelectedExecutionOrderNoFromLocation()

  if (action === 'submit') {
    const form = getState(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
    const context = buildPdaCuttingExecutionContext(taskId, 'spreading')
    const identity = resolvePdaCuttingWritebackIdentity(taskId, {
      executionOrderId: context.selectedExecutionOrderId || undefined,
      executionOrderNo: context.selectedExecutionOrderNo || undefined,
      originalCutOrderId: context.selectedExecutionOrder?.originalCutOrderId || undefined,
      originalCutOrderNo: context.selectedExecutionOrder?.originalCutOrderNo || undefined,
      mergeBatchId: context.selectedExecutionOrder?.mergeBatchId || undefined,
      mergeBatchNo: context.selectedExecutionOrder?.mergeBatchNo || undefined,
      materialSku: context.selectedExecutionOrder?.materialSku || undefined,
    })
    const operator = resolvePdaCuttingWritebackOperator(taskId, form.enteredBy.trim() || '现场铺布员')
    if (!identity || !operator) {
      form.feedbackMessage = '当前执行对象或操作人无法识别，不能提交铺布记录。'
      return true
    }
    const result = writePdaSpreadingToFcs({
      identity,
      operator,
      source: buildPdaCuttingWritebackSource('spreading', identity.executionOrderId),
      fabricRollNo: form.fabricRollNo.trim() || buildDefaultPdaRollNo(identity),
      layerCount: Number(form.layerCount || '0') || 0,
      actualLength: Number(form.actualLength || '0') || 0,
      headLength: Number(form.headLength || '0') || 0,
      tailLength: Number(form.tailLength || '0') || 0,
      note: [`铺布模式：${getSpreadingModeLabel(form.spreadingMode)}`, form.note.trim()].filter(Boolean).join('；'),
    })
    if (!result.success) {
      form.feedbackMessage = result.issues.join('；')
      return true
    }
    form.fabricRollNo = ''
    form.note = ''
    form.feedbackMessage = '铺布记录已保存。'
    form.backHrefOverride = buildPdaCuttingCompletedReturnHref(
      taskId,
      context.selectedExecutionOrderId,
      context.selectedExecutionOrderNo,
      context.navContext,
      'spreading',
    )
    return true
  }

  return false
}

function appTaskIdFromPath(): string {
  if (typeof window === 'undefined') return ''
  const matched = window.location.pathname.match(/\/fcs\/pda\/cutting\/spreading\/([^/]+)/)
  return matched?.[1] ?? ''
}
