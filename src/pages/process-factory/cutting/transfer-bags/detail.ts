import { appStore } from '../../../../state/store.ts'
import { renderRealQrPlaceholder } from '../../../../components/real-qr.ts'
import { escapeHtml, formatDateTime } from '../../../../utils.ts'
import {
  PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE,
  renderProductionOrderIdentityCell,
} from '../../../../data/fcs/production-order-identity.ts'
import { buildTransferBagLabelPrintLink } from '../../../../data/fcs/fcs-route-links.ts'
import { formatFactoryDisplayName } from '../../../../data/fcs/factory-mock-data.ts'
import {
  buildCuttingDrillChipLabels,
  buildCuttingDrillSummary,
  buildCuttingRouteWithContext,
  buildReturnToSummaryContext,
  getCuttingSourcePageLabel,
  hasSummaryReturnContext,
  buildCuttingDrillContext,
  readCuttingDrillContextFromLocation,
} from '../navigation-context.ts'
import {
  buildBagUsageAuditTrail,
  buildTransferBagCarrierManagementProjection,
  buildTransferBagParentChildSummary,
  createTransferBagUsageDraft,
  deriveTransferBagMasterStatus,
  deriveTransferBagUsageStatus,
  validateTicketBindingEligibility,
  type TransferBagBindingItem,
  type TransferBagMaster,
  type TransferBagMasterItem,
  type TransferBagPrefilter,
  type TransferBagTicketCandidate,
  type TransferBagUsage,
  type TransferBagUsageItem,
} from '../transfer-bags-model.ts'
import {
  buildBagReturnAuditTrail,
  buildReuseCycleSummary,
  buildReturnDiscrepancyMeta,
  buildTransferBagReturnViewModel,
  closeTransferBagUsageCycle,
  deriveBagConditionDecision,
  deriveReturnEligibility,
  type TransferBagConditionRecord,
  type TransferBagConditionStatus,
  type TransferBagDiscrepancyType,
  type TransferBagReusableDecision,
  type TransferBagReturnReceipt,
} from '../transfer-bag-return-model.ts'
import {
  state,
  nowText,
  getViewModel,
  getReturnViewModel,
  getCarrierManagementProjection,
  persistStore,
  setFeedback,
  closeActiveDialog,
  getFactoryOptions,
  getFactoryNameById,
  type TransferBagsPageState,
  type TransferBagsProjection,
  type TransferBagCarrierManagementProjection,
  type TransferBagCarrierMasterRecord,
  type TransferBagLandingResolution,
  type TransferBagLandingBanner,
  type TransferBagBaggingStepView,
} from './state.ts'
import {
  getActiveMaster,
  getActiveUsage,
  getCandidateTickets,
  getCarrierMasterRecordMap,
  getFilteredBindings,
  getFilteredUsages,
  getPagedMasters,
  getSelectedBag,
  getSelectedSewingTask,
  getSelectedTicketRecord,
  getSourceMaster,
  getSourceUsage,
  parseTicketInputs,
  refreshDerivedState,
  resolveCarrierScanInput,
  saveReturnDraft,
  syncPrefilterFromQuery,
} from './handlers.ts'
import {
  renderActiveDialog,
} from './dialogs.ts'

export function isTransferBagDetailTab(value: string | null | undefined): value is TransferBagDetailTab {
  return value === 'basic' || value === 'current' || value === 'history' || value === 'items' || value === 'logs'
}

export function readTransferBagDetailTab(): TransferBagDetailTab {
  const detailTab = state.drillContext?.detailTab || getWarehouseSearchParams().get('detailTab')
  return isTransferBagDetailTab(detailTab) ? detailTab : 'basic'
}

export function getDetailFocusedUsage(activeMaster: TransferBagMasterItem | null): TransferBagUsageItem | null {
  if (state.activeUsageId) {
    const usage = getViewModel().usagesById[state.activeUsageId] ?? null
    if (usage && (!activeMaster || usage.bagId === activeMaster.bagId)) return usage
  }
  return activeMaster?.currentUsage || null
}

export function getDetailBagUsages(activeMaster: TransferBagMasterItem | null): TransferBagUsageItem[] {
  if (!activeMaster) return []
  return getViewModel().usages
    .filter((item) => item.bagId === activeMaster.bagId)
    .sort((left, right) => right.usageNo.localeCompare(left.usageNo, 'zh-CN'))
}

export function getDetailReturnUsage(usageId: string | null | undefined) {
  if (!usageId) return null
  return getReturnViewModel().waitingReturnUsages.find((item) => item.usageId === usageId) || null
}

export function getDetailBagRecoveryEntries(activeMaster: TransferBagMasterItem | null) {
  return getDetailBagUsages(activeMaster)
    .map((usage) => {
      const recovery = getDetailReturnUsage(usage.usageId)
      return {
        usage,
        latestReceipt: recovery?.latestReturnReceipt || null,
        latestCondition: recovery?.latestConditionRecord || null,
        latestClosure: recovery?.latestClosureResult || null,
        recovery,
      }
    })
    .filter((item) => item.latestReceipt || item.latestCondition || item.latestClosure)
}

export function formatConditionStatusLabel(status: TransferBagConditionStatus | null | undefined): string {
  if (status === 'GOOD') return '完好'
  if (status === 'MINOR_DAMAGE') return '轻微损坏'
  if (status === 'SEVERE_DAMAGE') return '严重损坏'
  return '待评估'
}

export function formatCleanlinessStatusLabel(status: 'CLEAN' | 'DIRTY' | null | undefined): string {
  if (status === 'CLEAN') return '干净'
  if (status === 'DIRTY') return '已记录袋况'
  return '待评估'
}

export function formatReusableDecisionLabel(decision: TransferBagReusableDecision | null | undefined): string {
  if (decision === 'REUSABLE' || decision === 'WAITING_CLEANING' || decision === 'WAITING_REPAIR') return '可继续使用'
  if (decision === 'DISABLED') return '报废'
  return '待评估'
}

export function formatRecoveryEntryNextStepLabel(entry: ReturnType<typeof getDetailBagRecoveryEntries>[number]): string {
  if (entry.latestCondition?.reusableDecision) return formatReusableDecisionLabel(entry.latestCondition.reusableDecision)
  if (entry.latestClosure?.nextBagStatus) {
    return ['IDLE', 'REUSABLE'].includes(entry.latestClosure.nextBagStatus) ? '可以' : '不能继续使用'
  }
  return '待评估'
}


export function renderDetailEmptyState(): string {
  return `
    <section class="rounded-lg border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">
      未找到对应中转袋，请返回列表重新选择。
    </section>
  `
}

export function renderTransferBagDetailHeader(
  activeMaster: TransferBagMasterItem,
  focusedUsage: TransferBagUsageItem | null,
): string {
  const transferBagQrValue = resolveFormalBagQrValue(activeMaster)
  const summary = focusedUsage ? buildTransferBagParentChildSummary(focusedUsage.bindingItems || []) : null
  const carrierRecord = getCarrierMasterRecordMap()[activeMaster.bagCode]
  const currentStatus = carrierRecord?.currentStatus || focusedUsage?.visibleStatusMeta.label || activeMaster.visibleStatusMeta.label
  const summaryItems = [
    {
      label: '中转袋码',
      valueHtml: `<span class="text-sm font-semibold text-foreground">${escapeHtml(activeMaster.bagCode)}</span>`,
    },
    {
      label: '当前状态',
      valueHtml: renderTag(currentStatus, getCarrierCurrentStatusClass(currentStatus)),
    },
    {
      label: '当前所在位置',
      valueHtml: `<span class="text-sm font-semibold text-foreground">${escapeHtml(carrierRecord?.currentLocation || activeMaster.currentLocation || '待命位')}</span>`,
    },
    {
      label: '当前使用阶段',
      valueHtml: `<span class="text-sm font-semibold text-foreground">${escapeHtml(carrierRecord?.currentUseStage || '无')}</span>`,
    },
    {
      label: '绑定对象',
      valueHtml: `<span class="text-sm font-semibold text-foreground">${escapeHtml(carrierRecord?.currentBoundObjectNo || focusedUsage?.boundObjectNo || '未绑定')}</span>`,
    },
    {
      label: '当前装载',
      valueHtml: `<span class="text-sm font-semibold text-foreground">${escapeHtml(`${summary?.ticketCount || 0} 张 / ${activeMaster.capacity} 张`)}</span>`,
    },
  ]

  return `
    <section data-transfer-bag-summary-strip class="rounded-xl border bg-card px-4 py-3">
      <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
        ${summaryItems
          .map(
            (item) => `
              <div class="min-w-[128px]">
                <div class="text-[11px] text-muted-foreground">${escapeHtml(item.label)}</div>
                <div class="mt-1">${item.valueHtml}</div>
              </div>
            `,
          )
          .join('')}
        <div data-transfer-bag-summary-qr class="flex items-center gap-3">
          ${
            transferBagQrValue
              ? `
                <div class="inline-flex shrink-0 rounded-lg border bg-white p-2">
                  ${renderRealQrPlaceholder({
                    value: transferBagQrValue,
                    size: 72,
                    title: `中转袋码 ${activeMaster.bagCode}`,
                    label: `中转袋二维码 ${activeMaster.bagCode}`,
                  })}
                </div>
              `
              : '<div class="inline-flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-lg border border-dashed text-[11px] text-muted-foreground">暂无二维码</div>'
          }
          <div class="min-w-0">
            <div class="text-[11px] text-muted-foreground">中转袋二维码</div>
            <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(activeMaster.bagCode)}</div>
          </div>
        </div>
      </div>
    </section>
  `
}

export function renderTransferBagDetailTabs(
  activeMaster: TransferBagMasterItem,
  focusedUsage: TransferBagUsageItem | null,
  activeTab: TransferBagDetailTab,
): string {
  const tabs: Array<{ key: TransferBagDetailTab; label: string }> = [
    { key: 'basic', label: '基本信息' },
    { key: 'current', label: '当前使用' },
    { key: 'history', label: '使用周期' },
    { key: 'items', label: '装载明细' },
    { key: 'logs', label: '报废记录' },
  ]

  return `
    <nav class="rounded-xl border bg-card p-2" aria-label="中转袋详情页签">
      <div class="flex flex-wrap gap-2" role="tablist" aria-label="中转袋详情页签">
        ${tabs
          .map((tab) => {
            const selected = tab.key === activeTab
            return `
              <button
                type="button"
                id="transfer-bag-tab-${tab.key}"
                role="tab"
                aria-selected="${selected ? 'true' : 'false'}"
                aria-controls="transfer-bag-tabpanel-${tab.key}"
                class="rounded-lg px-3 py-2 text-sm font-medium ${selected ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'}"
                data-nav="${escapeHtml(buildTransferBagDetailRoute({
                  bagId: activeMaster.bagId,
                  bagCode: activeMaster.bagCode,
                  usageId: focusedUsage?.usageId || undefined,
                  usageNo: focusedUsage?.usageNo || undefined,
                  detailTab: tab.key,
                }))}"
              >${escapeHtml(tab.label)}</button>
            `
          })
          .join('')}
      </div>
    </nav>
  `
}

const transferBagBaggingStepMeta: Array<{ id: TransferBagBaggingStepId; index: number; label: string }> = [
  { id: 'scan', index: 1, label: '扫码装袋' },
  { id: 'review', index: 2, label: '核对完成' },
  { id: 'handover', index: 3, label: '交出' },
]

export function getBaggingActiveStepId(
  focusedUsage: TransferBagUsageItem | null,
  currentSummary: ReturnType<typeof buildTransferBagParentChildSummary> | null,
): TransferBagBaggingStepId | null {
  void currentSummary
  if (!focusedUsage) return 'scan'
  if (['DISPATCHED', 'PENDING_SIGNOFF', 'WAITING_RETURN', 'RETURN_INSPECTING', 'CLOSED', 'SCRAP_CLOSED'].includes(focusedUsage.usageStatus)) return null
  if (focusedUsage.usageStatus === 'READY_TO_DISPATCH') return 'handover'
  return 'scan'
}

export function getBaggingStepState(
  stepId: TransferBagBaggingStepId,
  activeStepId: TransferBagBaggingStepId | null,
  focusedUsage: TransferBagUsageItem | null,
): TransferBagBaggingStepState {
  if (!focusedUsage) return stepId === 'scan' ? 'active' : 'locked'
  if (!activeStepId) return 'done'

  const stepIndex = transferBagBaggingStepMeta.find((item) => item.id === stepId)?.index || 0
  const activeIndex = transferBagBaggingStepMeta.find((item) => item.id === activeStepId)?.index || 0
  if (stepIndex < activeIndex) return 'done'
  if (stepIndex === activeIndex) return 'active'
  return 'pending'
}

export function buildBaggingStepSummary(
  stepId: TransferBagBaggingStepId,
  activeMaster: TransferBagMasterItem,
  focusedUsage: TransferBagUsageItem | null,
  currentSummary: ReturnType<typeof buildTransferBagParentChildSummary> | null,
  capacityExceeded: boolean,
): string {
  const isInboundTempUsage = focusedUsage?.usageStage === 'INBOUND_TEMP'
  if (stepId === 'scan') {
    if (!focusedUsage) return `扫描首张菲票后，自动开始 ${activeMaster.bagCode} 本次周转`
    return isInboundTempUsage ? `已暂存 ${currentSummary?.ticketCount || 0} 张菲票` : `已装 ${currentSummary?.ticketCount || 0} 张菲票`
  }
  if (stepId === 'review') {
    if (!focusedUsage) return '装袋后再核对袋内内容'
    if (!currentSummary?.ticketCount) return '当前还没有菲票，请先扫码装袋'
    if (isInboundTempUsage) return '入仓暂存袋内容可混装，交出前再按车缝任务分拣装袋'
    return capacityExceeded ? '当前容量已超出，请先核对后再完成装袋' : '袋内内容待核对，可打印清单后完成装袋'
  }
  if (!focusedUsage) return '完成装袋后才可交出'
  if (isInboundTempUsage) return '车缝任务分配后进入交出装袋阶段'
  return focusedUsage.dispatchAt ? `已于 ${focusedUsage.dispatchAt} 交出` : '完成核对后即可交出'
}

export function buildBaggingStepHelperText(step: TransferBagBaggingStepView): string {
  if (step.id === 'scan') {
    return step.state === 'locked' ? '本次周转完成后才能再次扫码装袋' : '入仓暂存可混装；交出装袋按交出单或交出记录核对'
  }
  if (step.id === 'review') {
    return step.state === 'locked' ? '请先扫码装袋，再核对袋内内容' : '核对袋内内容，确认后完成装袋'
  }
  return step.state === 'locked' ? '完成装袋后才能进入下一阶段' : '交出装袋阶段必须绑定交出单或交出记录'
}

export function getBaggingStepViews(
  activeMaster: TransferBagMasterItem,
  focusedUsage: TransferBagUsageItem | null,
  currentSummary: ReturnType<typeof buildTransferBagParentChildSummary> | null,
  capacityExceeded: boolean,
): TransferBagBaggingStepView[] {
  const activeStepId = getBaggingActiveStepId(focusedUsage, currentSummary)
  return transferBagBaggingStepMeta
    .map((meta) => {
      const state = getBaggingStepState(meta.id, activeStepId, focusedUsage)
      return {
        ...meta,
        state,
        summary: buildBaggingStepSummary(meta.id, activeMaster, focusedUsage, currentSummary, capacityExceeded),
        helperText: '',
        open: state === 'active',
      }
    })
    .map((item) => ({
      ...item,
      helperText: buildBaggingStepHelperText(item),
    }))
}

export function getBaggingStepTone(stepState: TransferBagBaggingStepState): {
  railClass: string
  badgeClass: string
  cardClass: string
  stateLabel: string
} {
  if (stepState === 'done') {
    return {
      railClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      cardClass: 'border-emerald-200 bg-emerald-50/40',
      stateLabel: '已完成',
    }
  }
  if (stepState === 'active') {
    return {
      railClass: 'border-amber-200 bg-amber-50 text-amber-700',
      badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
      cardClass: 'border-amber-200 bg-amber-50/30 shadow-sm',
      stateLabel: '进行中',
    }
  }
  if (stepState === 'pending') {
    return {
      railClass: 'border-slate-200 bg-slate-50 text-slate-600',
      badgeClass: 'border-slate-200 bg-slate-50 text-slate-600',
      cardClass: 'border-slate-200 bg-card',
      stateLabel: '未开始',
    }
  }
  return {
    railClass: 'border-dashed border-slate-200 bg-slate-50/70 text-slate-400',
    badgeClass: 'border-dashed border-slate-200 bg-slate-50 text-slate-400',
    cardClass: 'border-dashed border-slate-200 bg-slate-50/70',
    stateLabel: '暂不可操作',
  }
}

export function renderBaggingStepRail(steps: TransferBagBaggingStepView[]): string {
  return `
    <section class="rounded-xl border bg-card p-3">
      <div class="flex flex-wrap gap-2" aria-label="本次装袋步骤">
        ${steps
          .map((step) => {
            const tone = getBaggingStepTone(step.state)
            return `
              <div class="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${tone.railClass}">
                <span class="inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold ${tone.badgeClass}">${step.index}</span>
                <span class="font-medium">${escapeHtml(step.label)}</span>
              </div>
            `
          })
          .join('')}
      </div>
    </section>
  `
}

export function renderCollapsedBaggingStepSummary(step: TransferBagBaggingStepView): string {
  const tone = getBaggingStepTone(step.state)
  return `
    <summary class="cursor-pointer list-none px-4 py-3 [&::-webkit-details-marker]:hidden">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex min-w-0 items-start gap-3">
          <span class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${tone.badgeClass}">${step.index}</span>
          <div class="min-w-0">
            <div class="text-sm font-semibold text-foreground">${escapeHtml(step.label)}</div>
            <div class="mt-1 text-sm text-muted-foreground">${escapeHtml(step.summary)}</div>
          </div>
        </div>
        <span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${tone.badgeClass}">${tone.stateLabel}</span>
      </div>
    </summary>
  `
}

export function renderBaggingStepCard(step: TransferBagBaggingStepView, body: string): string {
  const tone = getBaggingStepTone(step.state)
  return `
    <details data-bagging-step="${step.id}" data-step-state="${step.state}" class="rounded-xl border ${tone.cardClass}" ${step.open ? 'open' : ''}>
      ${renderCollapsedBaggingStepSummary(step)}
      <div class="border-t px-4 py-4">
        <p class="mb-3 text-sm text-muted-foreground">${escapeHtml(step.helperText)}</p>
        ${body}
      </div>
    </details>
  `
}

export function renderBaggingInlineField(label: string, value: string, valueClassName = 'text-foreground'): string {
  return `
    <div class="text-sm">
      <span class="text-muted-foreground">${escapeHtml(label)}：</span>
      <span class="font-medium ${valueClassName}">${escapeHtml(value)}</span>
    </div>
  `
}

export function renderBaggedTicketCompactList(
  currentBindings: TransferBagBindingItem[],
  focusedUsage: TransferBagUsageItem | null,
): string {
  if (!currentBindings.length || !focusedUsage) {
    return '<div class="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">当前还没有已装袋菲票，请先扫码加入本袋。</div>'
  }

  return `
    <div class="rounded-lg border bg-card">
      <div class="border-b px-3 py-2 text-sm font-medium text-foreground">已装袋菲票</div>
      ${renderStickyTableScroller(
        `
          <table class="min-w-full text-sm">
            <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th class="px-3 py-2 text-left">菲票码</th>
                <th class="px-3 py-2 text-left">裁片单</th>
                <th class="px-3 py-2 text-left">款号</th>
                <th class="px-3 py-2 text-left">车缝工厂</th>
                <th class="px-3 py-2 text-left">任务单号</th>
              </tr>
            </thead>
            <tbody>
              ${currentBindings
                .map(
                  (binding) => `
                    <tr class="border-b bg-card">
                      <td class="px-3 py-2 font-medium text-foreground">${escapeHtml(binding.ticketNo)}</td>
                      <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(binding.cutOrderNo || '—')}</td>
                      <td class="px-3 py-2">${escapeHtml(binding.ticket?.styleCode || focusedUsage.styleCode || '待补')}</td>
                      <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(formatFactoryDisplayName(focusedUsage.sewingFactoryName) || '待锁定')}</td>
                      <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(focusedUsage.sewingTaskNo || '待锁定')}</td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        `,
        'max-h-[18vh]',
      )}
    </div>
  `
}

export function renderBaggingScanStepCard(
  step: TransferBagBaggingStepView,
  focusedUsage: TransferBagUsageItem | null,
  currentBindings: TransferBagBindingItem[],
  currentSummary: ReturnType<typeof buildTransferBagParentChildSummary>,
  candidateTickets: TransferBagTicketCandidate[],
  capacityExceeded: boolean,
): string {
  const canEditBindings = !focusedUsage
    ? true
    : !['DISPATCHED', 'PENDING_SIGNOFF', 'WAITING_RETURN', 'RETURN_INSPECTING', 'CLOSED', 'SCRAP_CLOSED'].includes(focusedUsage.usageStatus)

  return renderBaggingStepCard(
    step,
    `
      <div class="space-y-3">
        <div class="grid gap-3 md:grid-cols-[1fr,auto]">
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">扫菲票加入本袋</span>
            <input
              type="text"
              value="${escapeHtml(state.draft.ticketInput)}"
              placeholder="输入或扫描菲票码"
              class="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              data-transfer-bags-workbench-field="ticketInput"
              ${canEditBindings ? '' : 'disabled'}
            />
          </label>
          <button type="button" class="rounded-md border px-4 py-2 text-sm hover:bg-muted md:self-end" data-transfer-bags-action="bind-ticket" ${canEditBindings ? '' : 'disabled'}>加入本袋</button>
        </div>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          ${renderBaggingInlineField('已装菲票数量', `${currentSummary.ticketCount} 张`)}
          ${renderBaggingInlineField('容量状态', capacityExceeded ? '已超容量' : '容量正常', capacityExceeded ? 'text-amber-700' : 'text-foreground')}
          ${
            focusedUsage
              ? `
                ${renderBaggingInlineField('车缝工厂', formatFactoryDisplayName(focusedUsage.sewingFactoryName) || '待锁定')}
                ${renderBaggingInlineField('车缝任务', focusedUsage.sewingTaskNo || '待锁定')}
                ${renderBaggingInlineField('当前款号', focusedUsage.styleCode || '待锁定')}
              `
              : ''
          }
        </div>
        ${focusedUsage
          ? ''
          : '<div class="rounded-lg border border-dashed px-4 py-4 text-sm text-muted-foreground">扫描首张菲票后，会自动开始本次周转并锁定车缝工厂 / 款号上下文。</div>'}
        ${
          candidateTickets.length
            ? `
              <div class="space-y-2 rounded-lg border bg-muted/15 p-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="text-sm font-medium text-foreground">候选菲票</div>
                  <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="import-prefill" ${canEditBindings ? '' : 'disabled'}>导入候选菲票（${candidateTickets.length}）</button>
                </div>
                <div class="flex flex-wrap gap-2">
                  ${candidateTickets
                    .map((item) =>
                      renderWorkbenchFilterChip(
                        `${item.ticketNo} / ${item.cutOrderNo}`,
                        `data-transfer-bags-action="set-ticket-input" data-ticket-no="${escapeHtml(item.ticketNo)}"`,
                        'blue',
                      ),
                    )
                    .join('')}
                </div>
              </div>
            `
            : ''
        }
        ${renderBaggedTicketCompactList(currentBindings, focusedUsage)}
        ${capacityExceeded ? '<div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">当前装袋数量已超容量，请先核对袋内内容再继续操作。</div>' : ''}
        ${canEditBindings ? '' : '<div class="rounded-lg border border-dashed px-4 py-5 text-sm text-muted-foreground">当前状态下不可继续扫码装袋，请在回收页签处理后续回收。</div>'}
      </div>
    `,
  )
}

export function renderBaggingReviewStepCard(
  step: TransferBagBaggingStepView,
  focusedUsage: TransferBagUsageItem | null,
  currentBindings: TransferBagBindingItem[],
  currentSummary: ReturnType<typeof buildTransferBagParentChildSummary>,
  capacityExceeded: boolean,
): string {
  return renderBaggingStepCard(
    step,
    !focusedUsage
      ? '<div class="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">请先开始本次周转，再核对袋内内容。</div>'
      : `
        <div class="space-y-3">
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            ${renderDetailMetric('已绑菲票数量', String(currentSummary.ticketCount))}
            ${renderDetailMetric('来源裁片单数', String(currentSummary.cutOrderCount))}
            ${renderDetailMetric('来源生产单数', String(currentSummary.productionOrderCount))}
            ${renderDetailMetric('当前款号', focusedUsage.styleCode || '待锁定')}
            ${renderDetailMetric('容量状态', capacityExceeded ? '已超容量' : '容量正常', capacityExceeded ? 'text-amber-700' : 'text-foreground')}
          </div>
          ${
            currentBindings.length
              ? renderStickyTableScroller(
                  `
                    <table class="min-w-full text-sm">
                      <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th class="px-3 py-2 text-left">菲票码</th>
                          <th class="px-3 py-2 text-left">面料卷号</th>
                          <th class="px-3 py-2 text-left">布料颜色</th>
                          <th class="px-3 py-2 text-left">尺码</th>
                          <th class="px-3 py-2 text-left">部位</th>
                          <th class="px-3 py-2 text-right">数量</th>
                          <th class="px-3 py-2 text-left">扎号</th>
                          <th class="px-3 py-2 text-left">裁片单</th>
                          <th class="px-3 py-2 text-left">状态</th>
                          <th class="px-3 py-2 text-left">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${currentBindings
                          .map(
                            (binding) => `
                              <tr class="border-b bg-card">
                                <td class="px-3 py-2 font-medium text-foreground">${escapeHtml(binding.ticketNo)}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.fabricRollNo || binding.ticket?.fabricRollNo || '暂无数据')}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.fabricColor || binding.ticket?.fabricColor || '暂无数据')}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.size || binding.ticket?.size || '暂无数据')}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.partName || binding.ticket?.partName || '暂无数据')}</td>
                                <td class="px-3 py-2 text-right tabular-nums">${escapeHtml(String(binding.qty))}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.bundleNo || binding.ticket?.bundleNo || '暂无数据')}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.cutOrderNo || '—')}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.ticket?.ticketStatus === 'VOIDED' ? '已作废' : '有效')}</td>
                                <td class="px-3 py-2">
                                  ${
                                    binding.removable
                                      ? `<button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-transfer-bags-action="remove-binding" data-binding-id="${escapeHtml(binding.bindingId)}">移除</button>`
                                      : '<span class="text-xs text-muted-foreground">不可移除</span>'
                                  }
                                </td>
                              </tr>
                            `,
                          )
                          .join('')}
                      </tbody>
                    </table>
                  `,
                  'max-h-[24vh]',
                )
              : '<div class="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">当前还没有菲票，请先完成步骤 2 的装袋绑定。</div>'
          }
          <div class="flex flex-wrap gap-2">
            ${currentBindings.length ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="print-manifest" data-usage-id="${escapeHtml(focusedUsage.usageId)}">打印中转袋二维码</button>` : ''}
            ${currentBindings.length && ['DRAFT', 'PACKING'].includes(focusedUsage.usageStatus) ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="mark-ready" data-usage-id="${escapeHtml(focusedUsage.usageId)}">完成装袋</button>` : ''}
          </div>
          ${currentBindings.length
            ? ''
            : '<div class="text-sm text-muted-foreground">当前还没有装入菲票，暂不能完成装袋。</div>'}
          ${(focusedUsage.productionOrderNos.length || focusedUsage.cutOrderNos.length || focusedUsage.markerPlanNos.length)
            ? `
              <details class="rounded-lg border bg-muted/10 p-3" data-testid="transfer-bags-source-trace-fold" data-default-open="collapsed">
                <summary class="cursor-pointer text-sm font-medium text-foreground">追溯信息</summary>
                <div class="mt-3 grid gap-3 md:grid-cols-3 text-sm">
                  <div><span class="text-muted-foreground">来源生产单：</span><span class="font-medium text-foreground">${escapeHtml(focusedUsage.productionOrderNos.join(' / ') || '暂无')}</span></div>
                  <div><span class="text-muted-foreground">来源裁片单：</span><span class="font-medium text-foreground">${escapeHtml(focusedUsage.cutOrderNos.join(' / ') || '暂无')}</span></div>
                  <div><span class="text-muted-foreground">来源唛架方案：</span><span class="font-medium text-foreground">${escapeHtml(focusedUsage.markerPlanNos.join(' / ') || '暂无')}</span></div>
                </div>
              </details>
            `
            : ''}
        </div>
      `,
  )
}

export function renderBaggingHandoverStepCard(
  step: TransferBagBaggingStepView,
  focusedUsage: TransferBagUsageItem | null,
  currentSummary: ReturnType<typeof buildTransferBagParentChildSummary>,
): string {
  return renderBaggingStepCard(
    step,
    !focusedUsage
      ? '<div class="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">完成装袋后，才会进入交出步骤。</div>'
      : `
        <div class="space-y-3">
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            ${renderDetailMetric('本次周转号', focusedUsage.usageNo)}
            ${renderDetailMetric('中转袋码', focusedUsage.bagCode)}
            ${renderDetailMetric('车缝工厂', formatFactoryDisplayName(focusedUsage.sewingFactoryName) || '待锁定')}
            ${renderDetailMetric('已装菲票数量', `${currentSummary.ticketCount}`)}
            ${renderDetailMetric('当前状态', focusedUsage.visibleStatusMeta.label)}
          </div>
          <div class="flex flex-wrap gap-2">
            ${focusedUsage.usageStatus === 'READY_TO_DISPATCH' ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="mark-dispatched" data-usage-id="${escapeHtml(focusedUsage.usageId)}">交出</button>` : ''}
          </div>
          ${focusedUsage.usageStatus === 'READY_TO_DISPATCH' ? '<div class="text-sm text-muted-foreground">核对无误后交出即可，裁片仓侧主流程至此完成。</div>' : '<div class="text-sm text-muted-foreground">当前步骤仅保留交出结果摘要。</div>'}
        </div>
      `,
  )
}

export function renderTransferBagBasicTab(
  activeMaster: TransferBagMasterItem,
  focusedUsage: TransferBagUsageItem | null,
): string {
  void focusedUsage
  const carrierRecord = getCarrierMasterRecordMap()[activeMaster.bagCode]
  const currentStatus = carrierRecord?.currentStatus || activeMaster.visibleStatusMeta.label

  return `
    <section id="transfer-bag-tabpanel-basic" role="tabpanel" aria-labelledby="transfer-bag-tab-basic" class="rounded-xl border bg-card p-4">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${renderDetailMetric('袋码', activeMaster.bagCode)}
        ${renderDetailMetric('中转袋名称', carrierRecord?.bagName || activeMaster.bagCode)}
        ${renderDetailMetric('规格', carrierRecord?.bagSpec || `${activeMaster.bagType} / 容量 ${activeMaster.capacity} 张菲票`)}
            ${renderDetailMetric('材质', (carrierRecord?.bagMaterial || '循环软袋').split('可' + '复' + '用').join('循环'))}
        ${renderDetailMetric('归属工厂（货权）', carrierRecord?.ownershipFactoryName || activeMaster.ownershipFactoryName || '待补')}
        ${renderDetailMetric('载具类型', activeMaster.carrierType === 'box' ? '箱' : '袋')}
        ${renderDetailMetric('当前状态', currentStatus)}
        ${renderDetailMetric('当前所在位置', carrierRecord?.currentLocation || activeMaster.currentLocation || '待命位')}
        ${renderDetailMetric('是否启用', carrierRecord?.enabled === false ? '报废' : '启用')}
        ${renderDetailMetric('使用次数', `${carrierRecord?.totalUseCount || 0} 次`)}
        ${renderDetailMetric('报废记录', `${carrierRecord?.scrapCount || 0} 条`, carrierRecord?.scrapCount ? 'text-rose-700' : 'text-foreground')}
      </div>
    </section>
  `
}

export function renderTransferBagCurrentTab(
  activeMaster: TransferBagMasterItem,
  focusedUsage: TransferBagUsageItem | null,
): string {
  const carrierRecord = getCarrierMasterRecordMap()[activeMaster.bagCode]
  const currentBindings = focusedUsage ? getViewModel().bindingsByUsageId[focusedUsage.usageId] || [] : []
  const currentSummary = buildTransferBagParentChildSummary(currentBindings)

  return `
    <section id="transfer-bag-tabpanel-current" role="tabpanel" aria-labelledby="transfer-bag-tab-current" class="space-y-3 rounded-xl border bg-card p-4">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${renderDetailMetric('当前使用阶段', carrierRecord?.currentUseStage || '无')}
        ${renderDetailMetric('当前使用记录', focusedUsage?.usageNo || '暂无')}
        ${renderDetailMetric('绑定对象类型', carrierRecord?.currentBoundObjectType || focusedUsage?.boundObjectType || '无')}
        ${renderDetailMetric('绑定对象单号', carrierRecord?.currentBoundObjectNo || focusedUsage?.boundObjectNo || '无')}
        ${renderDetailMetric('接收对象类型', focusedUsage?.receiverType || (focusedUsage?.usageStage === 'INBOUND_TEMP' ? '仓库' : '工厂'))}
        ${renderDetailMetric('接收对象', focusedUsage?.receiverName || formatFactoryDisplayName(focusedUsage?.sewingFactoryName || '') || '待指定')}
        ${renderDetailMetric('当前库区', focusedUsage?.usageStage === 'INBOUND_TEMP' ? '裁片暂存区' : '交出备货区')}
        ${renderDetailMetric('当前库位', carrierRecord?.currentLocation || activeMaster.currentLocation || '待命位')}
        ${renderDetailMetric('当前装载摘要', `${currentSummary.ticketCount} 张菲票 / ${currentSummary.quantityTotal} 片裁片`)}
      </div>
      ${
        focusedUsage
          ? `<div class="rounded-lg border bg-muted/10 p-3 text-sm text-muted-foreground">${escapeHtml(focusedUsage.note || '当前使用记录暂无备注。')}</div>`
          : '<div class="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">当前中转袋暂无打开中的使用记录。</div>'
      }
    </section>
  `
}

export function renderTransferBagItemsTab(
  activeMaster: TransferBagMasterItem,
  focusedUsage: TransferBagUsageItem | null,
): string {
  const usages = getDetailBagUsages(activeMaster)
  const selectedUsage = focusedUsage && focusedUsage.bagId === activeMaster.bagId ? focusedUsage : activeMaster.currentUsage || usages[0] || null
  const bindings = selectedUsage ? getViewModel().bindingsByUsageId[selectedUsage.usageId] || [] : []

  return `
    <section id="transfer-bag-tabpanel-items" role="tabpanel" aria-labelledby="transfer-bag-tab-items" class="space-y-3 rounded-xl border bg-card p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-sm font-semibold text-foreground">装载明细</h2>
        <div class="text-xs text-muted-foreground">${escapeHtml(selectedUsage?.usageNo || '暂无使用记录')}</div>
      </div>
      ${bindings.length
        ? renderStickyTableScroller(`
            <table class="min-w-[1080px] w-full text-sm">
              <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th class="px-3 py-2 text-left">对象</th>
                  <th class="px-3 py-2 text-left">${PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE}</th>
                  <th class="px-3 py-2 text-left">裁片单</th>
                  <th class="px-3 py-2 text-left">SPU</th>
                  <th class="px-3 py-2 text-left">颜色</th>
                  <th class="px-3 py-2 text-left">尺码</th>
                  <th class="px-3 py-2 text-left">部位</th>
                  <th class="px-3 py-2 text-right">裁片数量</th>
                  <th class="px-3 py-2 text-left">来源</th>
                </tr>
              </thead>
              <tbody>
                ${bindings
                  .map(
                    (binding) => `
                      <tr class="border-b bg-card">
                        <td class="px-3 py-2">
                          <div class="font-medium text-foreground">${escapeHtml(binding.ticketNo)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">菲票</div>
                        </td>
                        <td class="px-3 py-2">${renderProductionOrderIdentityCell(binding.productionOrderNo || '待补')}</td>
                        <td class="px-3 py-2">${escapeHtml(binding.cutOrderNo || '待补')}</td>
                        <td class="px-3 py-2">${escapeHtml(binding.ticket?.spuCode || selectedUsage?.spuCode || '待补')}</td>
                        <td class="px-3 py-2">${escapeHtml(binding.fabricColor || binding.ticket?.fabricColor || binding.ticket?.color || '待补')}</td>
                        <td class="px-3 py-2">${escapeHtml(binding.size || binding.ticket?.size || '待补')}</td>
                        <td class="px-3 py-2">${escapeHtml(binding.partName || binding.ticket?.partName || '待补')}</td>
                        <td class="px-3 py-2 text-right tabular-nums">${escapeHtml(String(binding.qty || 0))}</td>
                        <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(binding.bagCode || activeMaster.bagCode)}</td>
                      </tr>
                    `,
                  )
                  .join('')}
              </tbody>
            </table>
          `, 'max-h-[56vh]')
        : '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">当前使用记录暂无装载明细。</div>'}
    </section>
  `
}

export function renderTransferBagHistoryTab(
  activeMaster: TransferBagMasterItem,
  focusedUsage: TransferBagUsageItem | null,
): string {
  const usages = getDetailBagUsages(activeMaster)
  const selectedUsage = focusedUsage && focusedUsage.bagId === activeMaster.bagId ? focusedUsage : usages[0] || null

  return `
    <section id="transfer-bag-tabpanel-history" role="tabpanel" aria-labelledby="transfer-bag-tab-history" class="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <h2 class="text-sm font-semibold text-foreground">使用周期</h2>
      </div>
      ${!usages.length
        ? '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">当前口袋还没有过往周转记录。</div>'
        : `
          ${renderStickyTableScroller(
            `
              <table class="min-w-full text-sm">
                <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th class="px-3 py-2 text-left">使用周期号</th>
                    <th class="px-3 py-2 text-left">使用阶段</th>
                    <th class="px-3 py-2 text-left">开始 / 装袋</th>
                    <th class="px-3 py-2 text-left">交出</th>
                    <th class="px-3 py-2 text-left">回收 / 关闭</th>
                    <th class="px-3 py-2 text-right">菲票数量</th>
                    <th class="px-3 py-2 text-left">状态</th>
                  </tr>
                </thead>
                <tbody>
                  ${usages
                    .map(
                      (item) => `
                        <tr class="border-b ${selectedUsage?.usageId === item.usageId ? 'bg-orange-50/60' : 'bg-card'}">
                          <td class="px-3 py-2">
                            <button
                              type="button"
                              class="font-medium text-blue-700 hover:underline"
                              data-nav="${escapeHtml(buildTransferBagDetailRoute({
                                bagId: item.bagId,
                                bagCode: item.bagCode,
                                usageId: item.usageId,
                                usageNo: item.usageNo,
                                detailTab: 'history',
                              }))}"
                            >${escapeHtml(item.usageNo)}</button>
                          </td>
                          <td class="px-3 py-2">${escapeHtml(item.usageStageLabel || '交出装袋')}</td>
                          <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml([item.startedAt || '待开始', item.finishedPackingAt || '待装袋完成'].join(' / '))}</td>
                          <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(item.dispatchAt || '待交出')}</td>
                          <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml([item.returnedAt || '待回收', ['CLOSED', 'SCRAP_CLOSED'].includes(item.usageStatus) ? item.returnedAt || item.signedAt || '已关闭' : '待关闭'].join(' / '))}</td>
                          <td class="px-3 py-2 text-right tabular-nums">${escapeHtml(String(item.summary.ticketCount))}</td>
                          <td class="px-3 py-2">${renderTag(item.statusMeta.label, item.statusMeta.className)}</td>
                        </tr>
                      `,
                    )
                    .join('')}
                </tbody>
              </table>
            `,
            'max-h-[26vh]',
          )}
          ${
            selectedUsage
              ? `
                <div class="rounded-xl border bg-muted/15 p-4">
                  <div class="text-sm font-semibold text-foreground">当前摘要</div>
                  <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
                    <div><span class="text-muted-foreground">本次周转号：</span><span class="font-medium text-foreground">${escapeHtml(selectedUsage.usageNo)}</span></div>
                    <div><span class="text-muted-foreground">开始时间：</span><span class="font-medium text-foreground">${escapeHtml(selectedUsage.startedAt || '待补')}</span></div>
                    <div><span class="text-muted-foreground">使用阶段：</span><span class="font-medium text-foreground">${escapeHtml(selectedUsage.usageStageLabel || '交出装袋')}</span></div>
                    <div><span class="text-muted-foreground">绑定对象：</span><span class="font-medium text-foreground">${escapeHtml(selectedUsage.boundObjectNo || '无')}</span></div>
                    <div><span class="text-muted-foreground">菲票数量：</span><span class="font-medium text-foreground">${escapeHtml(String(selectedUsage.summary.ticketCount))}</span></div>
                    <div><span class="text-muted-foreground">交出时间：</span><span class="font-medium text-foreground">${escapeHtml(selectedUsage.dispatchAt || '待交出')}</span></div>
                    <div><span class="text-muted-foreground">回收时间：</span><span class="font-medium text-foreground">${escapeHtml(selectedUsage.returnedAt || '待回收')}</span></div>
                    <div><span class="text-muted-foreground">周期状态：</span><span class="font-medium text-foreground">${escapeHtml(selectedUsage.statusMeta.label)}</span></div>
                  </div>
                </div>
              `
              : ''
          }
        `}
    </section>
  `
}

export function renderTransferBagRecoveryTab(
  activeMaster: TransferBagMasterItem,
  focusedUsage: TransferBagUsageItem | null,
): string {
  const recoveryEntries = getDetailBagRecoveryEntries(activeMaster)
  const selectedRecoveryEntry =
    recoveryEntries.find((item) => item.usage.usageId === focusedUsage?.usageId) ||
    recoveryEntries[0] ||
    null
  const selectedUsage = focusedUsage || selectedRecoveryEntry?.usage || null

  if (!selectedUsage && !recoveryEntries.length) {
    return `
      <section id="transfer-bag-tabpanel-recovery" role="tabpanel" aria-labelledby="transfer-bag-tab-recovery" class="space-y-3 rounded-xl border bg-card p-4">
        <div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">当前还没有可回收的周转记录。</div>
      </section>
    `
  }

  const returnUsage = selectedUsage ? getDetailReturnUsage(selectedUsage.usageId) : null
  const latestReceipt = returnUsage?.latestReturnReceipt || null
  const canShowForm = Boolean(
    selectedUsage &&
      returnUsage &&
      returnUsage.returnEligibility.ok,
  )
  const recoveryNotice = latestReceipt
    ? '当前周转已完成回收登记，下面保留最近历史回收记录。'
    : `当前尚未进入回收阶段，当前状态为：${(selectedUsage || focusedUsage)?.visibleStatusMeta.label || activeMaster.visibleStatusMeta.label}。下面保留最近历史回收记录。`

  return `
    <section id="transfer-bag-tabpanel-recovery" role="tabpanel" aria-labelledby="transfer-bag-tab-recovery" class="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <h2 class="text-sm font-semibold text-foreground">回收确认</h2>
      </div>
      ${
        !canShowForm
          ? `<div class="rounded-lg border border-dashed px-6 py-8 text-sm text-muted-foreground">${escapeHtml(recoveryNotice)}</div>`
          : `
            <article class="space-y-3 rounded-xl border bg-muted/15 p-4">
              <div>
                <h3 class="text-sm font-semibold text-foreground">回收登记</h3>
                <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(`当前处理 ${selectedUsage?.usageNo || activeMaster.latestUsageNo || activeMaster.bagCode}。登记完成后，中转袋会直接回到可用，或按结果报废。`)}</p>
              </div>
              <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label class="space-y-2">
                  <span class="text-sm font-medium text-foreground">回收点 / 回收仓</span>
                  <input type="text" value="${escapeHtml(state.returnDraft.returnWarehouseName)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="returnWarehouseName" />
                </label>
                <label class="space-y-2">
                  <span class="text-sm font-medium text-foreground">回收时间</span>
                  <input type="text" value="${escapeHtml(state.returnDraft.returnAt)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="returnAt" />
                </label>
                <label class="space-y-2">
                  <span class="text-sm font-medium text-foreground">回收确认人</span>
                  <input type="text" value="${escapeHtml(state.returnDraft.receivedBy)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="receivedBy" />
                </label>
                <label class="space-y-2 md:col-span-2 xl:col-span-4">
                  <span class="text-sm font-medium text-foreground">备注</span>
                  <input type="text" value="${escapeHtml(state.returnDraft.note)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="note" />
                </label>
              </div>
              <div class="flex flex-wrap gap-2">
                <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="complete-return-inspection" data-usage-id="${escapeHtml(selectedUsage?.usageId || '')}">完成回收</button>
              </div>
            </article>
          `
      }
      ${
        recoveryEntries.length
          ? `
            <article class="space-y-3 rounded-xl border bg-muted/10 p-4">
              <div>
                <h3 class="text-sm font-semibold text-foreground">最近回收记录</h3>
              </div>
              ${renderStickyTableScroller(
                `
                  <table class="min-w-full text-sm">
                    <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th class="px-3 py-2 text-left">周转号</th>
                        <th class="px-3 py-2 text-left">回收时间</th>
                        <th class="px-3 py-2 text-left">回收点</th>
                        <th class="px-3 py-2 text-left">接收人</th>
                        <th class="px-3 py-2 text-left">备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${recoveryEntries
                        .map(
                          (entry) => `
                            <tr class="border-b ${selectedUsage?.usageId === entry.usage.usageId ? 'bg-orange-50/50' : 'bg-card'}">
                              <td class="px-3 py-2 font-medium text-foreground">${escapeHtml(entry.usage.usageNo)}</td>
                              <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(entry.latestReceipt?.returnAt || entry.latestClosure?.closedAt || '待补')}</td>
                              <td class="px-3 py-2">${escapeHtml(entry.latestReceipt?.returnWarehouseName || '待补')}</td>
                              <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(entry.latestReceipt?.receivedBy || '待补')}</td>
                              <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(entry.latestReceipt?.note || entry.latestClosure?.reason || '无')}</td>
                            </tr>
                          `,
                        )
                        .join('')}
                    </tbody>
                  </table>
                `,
                'max-h-[24vh]',
              )}
            </article>
          `
          : ''
      }
    </section>
  `
}

export function renderTransferBagLogsTab(
  activeMaster: TransferBagMasterItem,
  focusedUsage: TransferBagUsageItem | null,
): string {
  void focusedUsage
  const scrapRecords = getCarrierManagementProjection().scrapRecords
    .filter((item) => item.bagCode === activeMaster.bagCode)
    .filter(isTransferBagScrapRecord)

  return `
    <section id="transfer-bag-tabpanel-logs" role="tabpanel" aria-labelledby="transfer-bag-tab-logs" class="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <h2 class="text-sm font-semibold text-foreground">报废记录</h2>
        <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(`当前查看 ${activeMaster.bagCode} 的报废记录。`)}</p>
      </div>
      ${
        scrapRecords.length
          ? `<div class="grid gap-3 md:grid-cols-2">
              ${scrapRecords
                .map(
                  (item) => `
                    <article class="rounded-xl border bg-rose-50/40 px-4 py-3 text-sm">
                      <div class="flex flex-wrap items-center justify-between gap-3">
                        <p class="font-medium text-foreground">${escapeHtml(item.scrapType)}</p>
                        ${renderTag(item.handlingStatus, 'bg-rose-100 text-rose-700 border border-rose-200')}
                      </div>
                      <p class="mt-2 text-sm text-foreground">${escapeHtml(item.description)}</p>
                      <p class="mt-2 text-xs text-muted-foreground">${escapeHtml([item.relatedObjectType, item.relatedObjectId, item.reportedAt].filter(Boolean).join(' / '))}</p>
                    </article>
                  `,
                )
                .join('')}
            </div>`
          : '<div class="rounded-lg border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">当前中转袋暂无报废记录。</div>'
      }
    </section>
  `
}

export function renderTransferBagDetailTabPanel(
  activeMaster: TransferBagMasterItem,
  focusedUsage: TransferBagUsageItem | null,
  activeTab: TransferBagDetailTab,
): string {
  if (activeTab === 'basic') return renderTransferBagBasicTab(activeMaster, focusedUsage)
  if (activeTab === 'history') return renderTransferBagHistoryTab(activeMaster, focusedUsage)
  if (activeTab === 'items') return renderTransferBagItemsTab(activeMaster, focusedUsage)
  if (activeTab === 'logs') return renderTransferBagLogsTab(activeMaster, focusedUsage)
  return renderTransferBagCurrentTab(activeMaster, focusedUsage)
}

export function renderDetailPage(): string {
  syncPrefilterFromQuery()
  const meta = getCanonicalCuttingMeta(getCurrentTransferBagPathname(), 'transfer-bag-detail')
  const activeMaster = getActiveMaster()
  const activeTab = readTransferBagDetailTab()
  const focusedUsage = getDetailFocusedUsage(activeMaster)

  return `
    <div class="space-y-3 p-4">
      <header data-transfer-bag-page-header class="flex items-center justify-between gap-3">
        <div>
          <h1 class="text-xl font-bold">${escapeHtml(meta.pageTitle)}</h1>
          ${activeMaster ? `<p class="mt-1 text-sm text-muted-foreground">${escapeHtml([activeMaster.bagCode, getCarrierMasterRecordMap()[activeMaster.bagCode]?.currentStatus || activeMaster.visibleStatusMeta.label, getCarrierMasterRecordMap()[activeMaster.bagCode]?.currentLocation || activeMaster.currentLocation || '待命位'].join(' / '))}</p>` : ''}
        </div>
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildTransferBagListRoute())}">返回中转袋管理</button>
      </header>
      ${renderFeedbackBar()}
      ${activeMaster ? renderTransferBagDetailHeader(activeMaster, focusedUsage) : renderDetailEmptyState()}
      ${activeMaster ? renderTransferBagDetailTabs(activeMaster, focusedUsage, activeTab) : ''}
      ${activeMaster ? renderTransferBagDetailTabPanel(activeMaster, focusedUsage, activeTab) : ''}
      ${renderActiveDialog()}
    </div>
  `
}
