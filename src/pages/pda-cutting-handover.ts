import { escapeHtml } from '../utils'
import {
  buildHandoverPickingTaskProjectionFromAllocationProjection,
  buildSewingTaskAllocationProjectionFromInventory,
  type HandoverPickingTaskProjection,
} from '../data/fcs/cutting/sewing-dispatch.ts'
import { buildPdaUniversalHandoverRecordDraft } from '../data/fcs/cutting/handover-orders.ts'
import { buildPdaCuttingHandoverProjection } from './pda-cutting-handover-projection'
import {
  buildInboundTempBagInventoryRecords,
  buildInboundTempBagsFromTransferBagViewModel,
} from './process-factory/cutting/transfer-bags-model.ts'
import { buildTransferBagsProjection } from './process-factory/cutting/transfer-bags-projection.ts'
import {
  buildPdaCuttingWritebackSource,
  resolvePdaCuttingWritebackIdentity,
  resolvePdaCuttingWritebackOperator,
} from '../data/fcs/pda-cutting-writeback-inputs.ts'
import { writePdaHandoverToFcs } from '../domain/cutting-pda-writeback/bridge.ts'
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

interface HandoverFormState {
  operatorName: string
  targetLabel: string
  note: string
  feedbackMessage: string
  backHrefOverride: string
}

const handoverState = new Map<string, HandoverFormState>()

function getHandoverDetail(taskId: string, executionKey?: string | null) {
  return buildPdaCuttingHandoverProjection(taskId, executionKey ?? undefined)
}

function getState(taskId: string, executionOrderId?: string | null, executionOrderNo?: string | null): HandoverFormState {
  const stateKey = buildPdaCuttingExecutionStateKey(taskId, executionOrderId, executionOrderNo)
  const existing = handoverState.get(stateKey)
  if (existing) return existing
  const detail = getHandoverDetail(taskId, executionOrderId ?? executionOrderNo ?? undefined)
  const initial: HandoverFormState = {
    operatorName: '交出操作员',
    targetLabel: detail?.handoverTargetLabel && detail.handoverTargetLabel !== '待确定后道去向' ? detail.handoverTargetLabel : '裁片仓交出位',
    note: '',
    feedbackMessage: '',
    backHrefOverride: '',
  }
  handoverState.set(stateKey, initial)
  return initial
}

function renderHandoverHistory(detail: NonNullable<ReturnType<typeof getHandoverDetail>>): string {
  if (!detail || !detail.handoverRecords.length) {
    return renderPdaCuttingEmptyState('当前裁片单暂无交出记录', '')
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
              <div class="mt-2 text-muted-foreground">交出对象：${escapeHtml(record.targetLabel)}</div>
              <div class="mt-1 text-muted-foreground">操作人：${escapeHtml(record.operatorName)}</div>
              <div class="mt-1 text-muted-foreground">备注：${escapeHtml(record.note || '无')}</div>
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

function renderHandoverStatus(detail: NonNullable<ReturnType<typeof getHandoverDetail>>): string {
  return renderPdaCuttingSummaryGrid([
    { label: '当前交出状态', value: detail.currentHandoverStatus },
    { label: '当前交出对象', value: detail.handoverTargetLabel },
    { label: '最近交出记录', value: detail.latestHandoverRecordNo || '暂无记录' },
    { label: '最近交出时间', value: detail.latestHandoverAt, hint: detail.latestHandoverBy },
  ])
}

function buildPdaHandoverPickingProjection(): HandoverPickingTaskProjection {
  const transferBagViewModel = buildTransferBagsProjection().viewModel
  const inboundTempBags = buildInboundTempBagsFromTransferBagViewModel(transferBagViewModel)
  const inboundInventoryRecords = buildInboundTempBagInventoryRecords(inboundTempBags)
  const allocationProjection = buildSewingTaskAllocationProjectionFromInventory(inboundInventoryRecords)
  return buildHandoverPickingTaskProjectionFromAllocationProjection(allocationProjection)
}

function renderPdaPickingFlow(projection: HandoverPickingTaskProjection): string {
  const task = projection.tasks[0]
  if (!task) return renderPdaCuttingEmptyState('暂无待交出仓裁片配料任务', '')
  const pickedQty = task.pickedItems.reduce((total, item) => total + item.pickedQty, 0)
  const shortageLabel = task.shortageItems
    .slice(0, 2)
    .map((item) => `${item.size}/${item.partName}缺${item.shortageQty}片`)
    .join('；') || '暂无缺口'
  const failedSync = projection.scanChecks.find((check) => check.syncStatus === '同步失败')
  const scanChecks = projection.scanChecks
    .filter((check) => check.pickingTaskNo === task.pickingTaskNo)
    .slice(0, 5)

  return `
    <div class="space-y-3 text-xs">
      <div class="rounded-xl border bg-muted/20 px-3 py-3">
        <div class="text-muted-foreground">当前任务</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(task.pickingTaskNo)}</div>
        <div class="mt-1 text-muted-foreground">车缝任务：${escapeHtml(task.sewingTaskNo)}</div>
        <div class="mt-1 text-muted-foreground">来源袋：${escapeHtml(task.tempBagSources.map((item) => item.tempBagCode).join('、') || '待扫描')}</div>
        <div class="mt-1 text-muted-foreground">目标袋：${escapeHtml(task.targetTransferBags.map((bag) => bag.bagCode).join('、') || '待扫描')}</div>
      </div>
      ${renderPdaCuttingSummaryGrid([
        { label: '已扫菲票', value: `${task.pickedItems.length}/${task.allocatedInventoryItems.length} 张` },
        { label: '已扫数量', value: `${pickedQty} 片` },
        { label: '缺口提示', value: shortageLabel },
        { label: '同步状态', value: failedSync ? '同步失败' : '已同步', hint: failedSync?.reason || '最近提交已同步' },
      ])}
      <div class="rounded-xl border px-3 py-3">
        <div class="font-medium text-foreground">扫码顺序</div>
        <div class="mt-2 grid grid-cols-2 gap-2 text-muted-foreground">
          <div>1. 扫配料任务码</div>
          <div>2. 扫来源入仓暂存袋</div>
          <div>3. 扫菲票</div>
          <div>4. 扫目标中转袋</div>
        </div>
      </div>
      <div class="space-y-1">
        ${scanChecks
          .map((check) => `
            <div class="rounded-xl border px-3 py-2">
              <div class="font-medium text-foreground">${escapeHtml(check.scanObject)}：${escapeHtml(check.scannedValue)}</div>
              <div class="mt-1 text-muted-foreground">${escapeHtml(check.checkResult)} / ${escapeHtml(check.reason)} / 同步：${escapeHtml(check.syncStatus)}</div>
            </div>
          `)
          .join('')}
      </div>
      <button class="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
        确认装袋
      </button>
      <button class="inline-flex min-h-9 w-full items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
        上报异常
      </button>
    </div>
  `
}

export function renderPdaCuttingHandoverPage(taskId: string): string {
  const context = buildPdaCuttingExecutionContext(taskId, 'handover')
  const detail = context.detail

  if (!detail) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: '交出记录扫码',
      subtitle: '',
      activeTab: 'handover',
      body: '',
      backHref: context.backHref,
    })
  }

  if (context.requiresCutPieceOrderSelection) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: '交出记录扫码',
      subtitle: '',
      activeTab: 'handover',
      body: renderPdaCuttingOrderSelectionPrompt(detail, context.backHref, context.selectionNotice || undefined),
      backHref: context.backHref,
    })
  }

  const form = getState(taskId, context.selectedExecutionOrderId, context.selectedExecutionOrderNo)
  const pageBackHref = form.backHrefOverride || context.backHref
  const universalDraft = buildPdaUniversalHandoverRecordDraft()
  const specialCraftDraft = buildPdaUniversalHandoverRecordDraft('HO-CUT-AUX-260324-001')

  const confirmSection = `
    <div class="space-y-3 text-xs" data-task-id="${escapeHtml(taskId)}">
      <div class="rounded-xl border bg-muted/20 px-3 py-3">
        <div class="text-muted-foreground">通用交出记录</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(universalDraft.handoverOrderNo)} / 第 ${universalDraft.nextRecordSequence} 次交出</div>
        <div class="mt-1 text-muted-foreground">接收对象：${escapeHtml(universalDraft.receiverType)} ${escapeHtml(universalDraft.receiverName)}</div>
        <div class="mt-1 text-muted-foreground">${escapeHtml(universalDraft.modelHint)}</div>
        <div class="mt-1 text-muted-foreground">${escapeHtml(universalDraft.submitConditionText)}</div>
      </div>
      <label class="block space-y-1">
        <span class="text-muted-foreground">操作人</span>
        <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-handover-field="operatorName" value="${escapeHtml(form.operatorName)}" />
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">交出对象</span>
        <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-handover-field="targetLabel" value="${escapeHtml(form.targetLabel)}" placeholder="例如：裁片仓交出位 / 后道工位" />
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">交出备注</span>
        <textarea class="min-h-24 w-full rounded-xl border bg-background px-3 py-2 text-sm" data-pda-cut-handover-field="note" placeholder="填写交出提醒、后续去向和异常记录">${escapeHtml(form.note)}</textarea>
      </label>
      <div class="rounded-xl border bg-muted/20 px-3 py-3 text-xs">
        <div class="text-muted-foreground">本次交出预览</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(form.targetLabel || '待填写交出对象')}</div>
        <div class="mt-1 text-muted-foreground">当前位置：${escapeHtml(detail.inboundZoneLabel)} / ${escapeHtml(detail.inboundLocationLabel)}</div>
        <div class="mt-1 text-muted-foreground">${escapeHtml(universalDraft.riskTips[0]?.tipText || '提交后按交出记录展示累计交出、交出后是否齐套和缺口。')}</div>
      </div>
      ${form.feedbackMessage ? renderPdaCuttingFeedbackNotice(form.feedbackMessage, 'success') : ''}
      <div class="grid grid-cols-2 gap-2">
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-2 text-xs font-medium hover:bg-muted" data-nav="${escapeHtml(pageBackHref)}">
          返回裁片任务
        </button>
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90" data-pda-cut-handover-action="confirm" data-task-id="${escapeHtml(taskId)}">
          新增交出记录
        </button>
      </div>
    </div>
  `

  const specialCraftSection = `
    <div class="space-y-3 text-xs">
      <div class="rounded-xl border bg-violet-50 px-3 py-3 text-violet-900">
        <div class="font-medium">特殊工艺交出扫码</div>
        <div class="mt-1 text-sm font-semibold">${escapeHtml(specialCraftDraft.handoverOrderNo)} / 第 ${specialCraftDraft.nextRecordSequence} 次交出</div>
        <div class="mt-1">接收对象：${escapeHtml(specialCraftDraft.receiverType)} ${escapeHtml(specialCraftDraft.receiverName)}</div>
        <div class="mt-1">扫特殊工艺交出单 → 扫中转袋 → 扫菲票 → 确认交出</div>
      </div>
      ${renderPdaCuttingSummaryGrid([
        { label: '本次工艺', value: '绣花' },
        { label: '承接工厂', value: specialCraftDraft.receiverName },
        { label: '同步状态', value: '已同步', hint: '提交后生成通用交出记录' },
        { label: '后续回仓', value: '待回仓' },
      ])}
      <button class="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
        确认交出
      </button>
      <button class="inline-flex min-h-9 w-full items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
        上报异常
      </button>
    </div>
  `

  const body = `
    ${renderPdaCuttingExecutionHero('新增交出记录', detail)}
    ${renderPdaCuttingSection('当前情况', '', renderHandoverStatus(detail))}
    ${renderPdaCuttingSection('待交出仓裁片配料', '', renderPdaPickingFlow(buildPdaHandoverPickingProjection()))}
    ${renderPdaCuttingSection('特殊工艺交出', '', specialCraftSection)}
    ${renderPdaCuttingSection('新增交出记录', '', confirmSection)}
    ${renderPdaCuttingSection('最近交出记录', '', renderHandoverHistory(detail))}
  `

  return renderPdaCuttingPageLayout({
    taskId,
    title: '交出记录扫码',
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
    const selectedExecutionOrderId = readSelectedExecutionOrderIdFromLocation()
    const selectedExecutionOrderNo = readSelectedExecutionOrderNoFromLocation()
    const form = getState(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
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
  const selectedExecutionOrderId = readSelectedExecutionOrderIdFromLocation()
  const selectedExecutionOrderNo = readSelectedExecutionOrderNoFromLocation()

  if (action === 'confirm') {
    const form = getState(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
    const context = buildPdaCuttingExecutionContext(taskId, 'handover')
    const identity = resolvePdaCuttingWritebackIdentity(taskId, {
      executionOrderId: context.selectedExecutionOrderId || undefined,
      executionOrderNo: context.selectedExecutionOrderNo || undefined,
      cutOrderId: context.selectedExecutionOrder?.cutOrderId || undefined,
      cutOrderNo: context.selectedExecutionOrder?.cutOrderNo || undefined,
      markerPlanId: context.selectedExecutionOrder?.markerPlanId || undefined,
      markerPlanNo: context.selectedExecutionOrder?.markerPlanNo || undefined,
      materialSku: context.selectedExecutionOrder?.materialSku || undefined,
    })
    const operator = resolvePdaCuttingWritebackOperator(taskId, form.operatorName.trim() || '交出操作员')
    if (!identity || !operator) {
      form.feedbackMessage = '当前执行对象或操作人无法识别，不能新增交出记录。'
      return true
    }
    const result = writePdaHandoverToFcs({
      identity,
      operator,
      source: buildPdaCuttingWritebackSource('handover', identity.executionOrderId),
      targetLabel: form.targetLabel.trim() || '裁片仓交出位',
      note: form.note.trim(),
    })
    if (!result.success) {
      form.feedbackMessage = result.issues.join('；')
      return true
    }
    form.feedbackMessage = '交出记录已提交。'
    form.backHrefOverride = buildPdaCuttingCompletedReturnHref(
      taskId,
      context.selectedExecutionOrderId,
      context.selectedExecutionOrderNo,
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
