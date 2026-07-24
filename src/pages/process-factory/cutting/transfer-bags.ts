import { appStore } from '../../../state/store.ts'
import { renderRealQrPlaceholder } from '../../../components/real-qr.ts'
import { escapeHtml, formatDateTime } from '../../../utils.ts'
import {
  PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE,
  renderProductionOrderIdentityCell,
} from '../../../data/fcs/production-order-identity.ts'
import {
  CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY,
} from '../../../data/fcs/cutting/storage/fei-tickets-storage.ts'
import {
  paginateItems,
  renderCompactKpiCard,
  renderCompactKpiGroup,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchFilterChip,
  renderWorkbenchPagination,
  renderWorkbenchSecondaryPanel,
  renderWorkbenchStateBar,
} from './layout.helpers.ts'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, renderCuttingPageHeader } from './meta.ts'
import {
  getWarehouseSearchParams,
} from './warehouse-shared.ts'
import {
  buildCuttingTraceabilityId,
  encodeCarrierQr,
  parseCuttingTraceQr,
} from '../../../data/fcs/cutting/qr-codes.ts'
import { parseCarrierQrValue } from '../../../data/fcs/cutting/transfer-bag-runtime.ts'
import { buildTransferBagLabelPrintLink } from '../../../data/fcs/fcs-route-links.ts'
import { formatFactoryDisplayName } from '../../../data/fcs/factory-mock-data.ts'
import { listBusinessFactoryMasterRecords } from '../../../data/fcs/factory-master-store.ts'
import {
  buildCuttingDrillChipLabels,
  buildCuttingDrillSummary,
  buildCuttingRouteWithContext,
  buildReturnToSummaryContext,
  getCuttingSourcePageLabel,
  hasSummaryReturnContext,
  buildCuttingDrillContext,
  readCuttingDrillContextFromLocation,
  type CuttingDrillContext,
  type CuttingNavigationTarget,
} from './navigation-context.ts'
import {
  buildTransferBagsProjection,
} from './transfer-bags-projection.ts'
import {
  buildBagUsageAuditTrail,
  buildTransferBagCarrierManagementProjection,
  buildTransferBagParentChildSummary,
  createTransferBagUsageDraft,
  CUTTING_TRANSFER_BAG_LEDGER_STORAGE_KEY,
  CUTTING_TRANSFER_BAG_SELECTED_TICKET_IDS_STORAGE_KEY,
  deriveTransferBagMasterStatus,
  deriveTransferBagUsageStatus,
  deserializeTransferBagSelectedTicketIds,
  ensureUsageContextLockedByTicket,
  serializeTransferBagSelectedTicketIds,
  serializeTransferBagStorage,
  validateTicketBindingEligibility,
  type TransferBagBindingItem,
  type TransferBagCarrierCurrentStatus,
  type TransferBagCarrierUseStage,
  type TransferBagItemBinding,
  type TransferBagMaster,
  type TransferBagMasterItem,
  type TransferBagPrefilter,
  type TransferBagCycleContextResolution,
  type TransferBagStore,
  type TransferBagTicketCandidate,
  type TransferBagUsage,
  type TransferBagUsageItem,
  type TransferBagUsageStatusKey,
  type TransferBagVisibleStatusKey,
} from './transfer-bags-model.ts'
import {
  buildBagReturnAuditTrail,
  buildReuseCycleSummary,
  buildReturnDiscrepancyMeta,
  buildTransferBagReturnViewModel,
  closeTransferBagUsageCycle,
  createReturnReceiptDraft,
  deriveBagConditionDecision,
  deriveReturnEligibility,
  validateReturnReceiptPayload,
  type TransferBagConditionRecord,
  type TransferBagConditionStatus,
  type TransferBagDiscrepancyType,
  type TransferBagReusableDecision,
  type TransferBagReturnReceipt,
} from './transfer-bag-return-model.ts'
import { renderMaterialIdentityBlock } from './material-identity.ts'
import {
  state,
  nowText,
  uniqueStrings,
  serializeTransferBagTicketRecordsStorage,
  sanitizeIdFragment,
  invalidateTransferBagProjectionCache,
  getProjection,
  hydrateStore,
  getViewModel,
  getReturnViewModel,
  getCarrierManagementProjection,
  persistStore,
  persistSelectedTicketIds,
  setFeedback,
  closeActiveDialog,
  getFactoryOptions,
  getFactoryNameById,
  type MasterStatusFilter,
  type MasterUseStageFilter,
  type UsageStatusFilter,
  type ReturnStatusFilter,
  type TransferBagDetailTab,
  type TransferBagBaggingStepId,
  type TransferBagBaggingStepState,
  type TransferBagDialog,
  type TransferBagsProjection,
  type TransferBagCarrierManagementProjection,
  type TransferBagCarrierMasterRecord,
  type FeedbackTone,
  type FeedbackState,
  type TransferBagLandingResolution,
  type TransferBagLandingBanner,
  type TransferBagBaggingStepView,
  type TransferBagsPageState,
  type MasterFilterField,
  type UsageFilterField,
  type WorkbenchField,
  type ReturnFilterField,
  type ReturnDraftField,
  type ConditionDraftField,
  type MasterDraftField,
  type PackDraftField,
} from './transfer-bags/state.ts'
import {
  completeInboundStorage,
  confirmHandoverPacking,
  ensureUsageAutoCreatedForTicket,
  getActiveMaster,
  getActiveUsage,
  getCandidateTickets,
  getCarrierMasterRecordMap,
  getDialogTitle,
  getFilteredBindings,
  getFilteredUsages,
  getPagedMasters,
  getSelectedBag,
  getSelectedSewingTask,
  getSelectedSewingTaskByNo,
  getSelectedTicketRecord,
  getSourceMaster,
  getSourceUsage,
  parseTicketInputs,
  refreshDerivedState,
  releaseInboundBag,
  resetMasterDraft,
  resetMasterPagination,
  resetPackDraft,
  resetReturnDraft,
  resolveCarrierScanInput,
  resolveLockedUsageContext,
  resolvePackBag,
  resolvePackTickets,
  saveMasterDraft,
  savePackDraft,
  saveReturnDraft,
  syncPrefilterFromQuery,
  syncReusableDecisionSuggestion,
} from './transfer-bags/handlers.ts'
import {
  renderActiveDialog,
} from './transfer-bags/dialogs.ts'
import {
  isTransferBagDetailTab,
  readTransferBagDetailTab,
  getDetailFocusedUsage,
  renderDetailEmptyState,
  renderTransferBagDetailHeader,
  renderTransferBagDetailTabs,
  renderTransferBagDetailTabPanel,
  renderDetailPage,
} from './transfer-bags/detail.ts'
import {
  renderListPage,
} from './transfer-bags/list.ts'


function renderTag(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

function getCarrierCurrentStatusClass(status: string): string {
  if (status === '可用') return 'bg-emerald-100 text-emerald-700 border border-emerald-200'
  if (status === '入仓装袋中' || status === '交出装袋中') return 'bg-blue-100 text-blue-700 border border-blue-200'
  if (status === '入仓暂存中') return 'bg-cyan-100 text-cyan-700 border border-cyan-200'
  if (status === '待交出') return 'bg-violet-100 text-violet-700 border border-violet-200'
  if (status === '已交出待回收') return 'bg-orange-100 text-orange-700 border border-orange-200'
  if (status === '报废') return 'bg-slate-200 text-slate-700 border border-slate-300'
  return 'bg-slate-100 text-slate-700 border border-slate-200'
}

function getCurrentTransferBagPathname(): string {
  return appStore.getState().pathname.split('?')[0] || getCanonicalCuttingPath('transfer-bags')
}

function isTransferBagDetailPage(): boolean {
  return getCurrentTransferBagPathname() === getCanonicalCuttingPath('transfer-bag-detail')
}

function buildTransferBagDetailRoute(options: {
  bagId?: string | null
  bagCode?: string | null
  usageId?: string | null
  usageNo?: string | null
  detailTab?: TransferBagDetailTab | null
  focusSection?: string | null
}): string {
  return buildCuttingRouteWithContext('transferBags', {
    ...(state.drillContext || {}),
    sourcePageKey: state.drillContext?.sourcePageKey || 'transfer-bags',
    bagId: options.bagId || undefined,
    bagCode: options.bagCode || undefined,
    usageId: options.usageId || undefined,
    usageNo: options.usageNo || undefined,
    autoOpenDetail: true,
    detailTab: options.detailTab || undefined,
    focusSection: options.focusSection || undefined,
  })
}

function buildTransferBagListRoute(): string {
  if (!state.drillContext) return getCanonicalCuttingPath('transfer-bags')
  return buildCuttingRouteWithContext('transferBags', {
    ...state.drillContext,
    bagId: undefined,
    bagCode: undefined,
    usageId: undefined,
    usageNo: undefined,
    detailTab: undefined,
    focusSection: undefined,
  })
}

function resolveSourceReturnAction(): { label: string; href: string } | null {
  const sourcePageKey = state.drillContext?.sourcePageKey
  if (!sourcePageKey || sourcePageKey === 'transfer-bags') return null

  if (sourcePageKey === 'cutting-summary') {
    const context = buildReturnToSummaryContext(state.drillContext)
    return context
      ? {
          label: '返回裁剪结果核查',
          href: buildCuttingRouteWithContext('summary', context),
        }
      : null
  }

  const sourceTargetMap: Partial<Record<NonNullable<CuttingDrillContext['sourcePageKey']>, CuttingNavigationTarget>> = {
    'special-processes': 'specialProcesses',
    'material-prep': 'materialPrep',
    'marker-spreading': 'markerSpreading',
    'fei-tickets': 'feiTickets',
    'cut-orders': 'cutOrders',
    'production-progress': 'productionProgress',
    'cut-piece-warehouse': 'cutPieceWarehouse',
    'fabric-warehouse': 'fabricWarehouse',
     'marker-list': 'markerPlanSources',
  }

  const target = sourceTargetMap[sourcePageKey]
  if (!target || !state.drillContext) return null

  return {
    label: `返回${getCuttingSourcePageLabel(sourcePageKey)}`,
    href: buildCuttingRouteWithContext(target, {
      ...state.drillContext,
      bagId: undefined,
      bagCode: undefined,
      usageId: undefined,
      usageNo: undefined,
      focusSection: undefined,
    }),
  }
}

function resolveFormalBagQrValue(item: TransferBagMasterItem | null): string {
  if (!item) return ''
  return buildTransferBagArchiveQrValue(item) || buildTransferBagArchiveQrValue(getSourceMaster(item.bagId))
}

function resolveUsageBagQrValue(usage: TransferBagUsageItem): string {
  return buildTransferBagArchiveQrValue(usage.bagMaster)
    || buildTransferBagArchiveQrValue(getViewModel().mastersById[usage.bagId])
    || buildTransferBagArchiveQrValue(getSourceMaster(usage.bagId))
}

function getTransferBagQrValueByBagCode(bagCode: string): string {
  const normalizedBagCode = bagCode.trim()
  if (!normalizedBagCode) return ''
  const masterItem = getViewModel().masters.find((item) => item.bagCode === normalizedBagCode || item.carrierCode === normalizedBagCode) || null
  const sourceMaster = state.store.masters.find((item) => item.bagCode === normalizedBagCode || item.carrierCode === normalizedBagCode) || null
  return buildTransferBagArchiveQrValue(masterItem) || buildTransferBagArchiveQrValue(sourceMaster)
}

function buildTransferBagArchiveQrValue(master: (Partial<TransferBagMaster> & Partial<TransferBagMasterItem>) | null | undefined): string {
  if (!master) return ''
  const carrierId = master.carrierId || master.bagId || ''
  const carrierCode = master.carrierCode || master.bagCode || ''
  if (!carrierId || !carrierCode) return ''
  const carrierType = master.carrierType === 'box' || master.bagType === 'box' || master.bagType === '周转箱' ? 'box' : 'bag'
  return encodeCarrierQr({
    carrierId,
    carrierCode,
    carrierType,
    issuedAt: master.createdAt || '2026-03-24 08:00',
    ownershipFactoryId: master.ownershipFactoryId || '',
    ownershipFactoryName: master.ownershipFactoryName || '',
  }).qrValue
}

function renderTransferBagQrCell(bagCode: string, size = 64): string {
  const qrValue = getTransferBagQrValueByBagCode(bagCode)
  if (!qrValue) {
    return '<div class="text-xs text-muted-foreground">暂无二维码</div>'
  }
  return `
    <div class="flex flex-col items-start gap-1">
      <div class="inline-flex rounded-md border bg-white p-1 shadow-sm">
        ${renderRealQrPlaceholder({
          value: qrValue,
          size,
          title: `中转袋码 ${bagCode}`,
          label: `中转袋 ${bagCode} 二维码`,
        })}
      </div>
      <div class="text-[11px] text-muted-foreground">已生成</div>
    </div>
  `
}

function renderMasterStatusActions(options: {
  item: TransferBagMasterItem
  currentStatus: string
  detailHref: string
  historyHref: string
}): string {
  const { item, currentStatus, detailHref, historyHref } = options
  void currentStatus
  const actionButtons: string[] = [
    `<button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(detailHref)}">查看详情</button>`,
    `<button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(historyHref)}">查看使用周期</button>`,
    `<button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(buildTransferBagLabelPrintLink(item.bagId))}">打印中转袋二维码</button>`,
  ]

  return actionButtons.join('')
}


function renderDetailMetric(label: string, value: string, valueClassName = 'text-foreground'): string {
  return `
    <div class="rounded-lg border bg-muted/10 px-3 py-2">
      <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-1 text-sm font-semibold ${valueClassName}">${escapeHtml(value)}</div>
    </div>
  `
}

function renderTransferBagTraceabilityBlock(focusedUsage: TransferBagUsageItem | null): string {
  if (!focusedUsage) return ''
  const sourceMarkerSummary = focusedUsage.sourceMarkerNos.join(' / ') || '当前尚未绑定正式来源唛架'
  const sourceOrderSummary = focusedUsage.cutOrderNos.join(' / ') || '暂无'
  const sourceMarkerPlanSummary = focusedUsage.markerPlanNos.join(' / ') || '暂无'
  const isInboundTempUsage = focusedUsage.usageStage === 'INBOUND_TEMP'
  return `
    <section class="rounded-lg border ${focusedUsage.bagFirstSatisfied ? 'border-emerald-200 bg-emerald-50/30' : 'border-rose-200 bg-rose-50/40'} p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold text-foreground">${isInboundTempUsage ? '铺布 / 入仓暂存追溯' : '铺布 / 装袋追溯'}</h3>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(focusedUsage.bagFirstRuleLabel)}</p>
        </div>
        ${renderTag(isInboundTempUsage ? '入仓暂存已记录' : focusedUsage.bagFirstSatisfied ? '交出装袋已记录' : '交出装袋待补', focusedUsage.bagFirstSatisfied ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-rose-100 text-rose-700 border border-rose-200')}
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${renderDetailMetric('来源铺布', focusedUsage.spreadingSessionNo || focusedUsage.spreadingSessionId || '当前尚未绑定正式铺布')}
        ${renderDetailMetric('来源唛架', sourceMarkerSummary)}
        ${renderDetailMetric('来源裁片单', sourceOrderSummary)}
        ${renderDetailMetric('来源唛架方案', sourceMarkerPlanSummary)}
      </div>
      <details class="mt-3 rounded-lg border bg-background/70 p-3" data-testid="transfer-bags-traceability-fold" data-default-open="collapsed">
        <summary class="cursor-pointer text-sm font-medium text-foreground">追溯信息</summary>
        <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          ${renderDetailMetric('来源铺布记录', focusedUsage.spreadingSessionNo || focusedUsage.spreadingSessionId || '当前尚无来源铺布记录')}
          ${renderDetailMetric('铺布颜色摘要', focusedUsage.spreadingColorSummary || focusedUsage.colorSummary || '待补')}
          ${renderDetailMetric(isInboundTempUsage ? '入仓暂存规则' : '交出装袋规则', focusedUsage.bagFirstRuleLabel, focusedUsage.bagFirstSatisfied ? 'text-emerald-700' : 'text-rose-700')}
        </div>
      </details>
    </section>
  `
}

function getMasterTodoMeta(item: TransferBagMasterItem): { label: string; href: string } {
  if (item.visibleStatusKey === 'IDLE') {
    return {
      label: '开始装袋',
      href: buildTransferBagDetailRoute({ bagId: item.bagId, bagCode: item.bagCode, focusSection: 'usage-workbench' }),
    }
  }

  if (item.visibleStatusKey === 'IN_PROGRESS') {
    return {
      label: '继续装袋',
      href: buildTransferBagDetailRoute({
        bagId: item.bagId,
        bagCode: item.bagCode,
        usageId: item.currentUsage?.usageId || undefined,
        usageNo: item.currentUsage?.usageNo || undefined,
        focusSection: 'usage-workbench',
      }),
    }
  }

  if (item.visibleStatusKey === 'READY_HANDOVER') {
    return {
      label: '交出',
      href: buildTransferBagDetailRoute({
        bagId: item.bagId,
        bagCode: item.bagCode,
        usageId: item.currentUsage?.usageId || undefined,
        usageNo: item.currentUsage?.usageNo || undefined,
        focusSection: 'usage-workbench',
      }),
    }
  }

  if (item.visibleStatusKey === 'HANDED_OVER') {
    return {
      label: '回收',
      href: buildTransferBagDetailRoute({
        bagId: item.bagId,
        bagCode: item.bagCode,
        usageId: item.currentUsage?.usageId || undefined,
        usageNo: item.currentUsage?.usageNo || undefined,
        focusSection: 'return-workbench',
      }),
    }
  }

  return {
    label: '查看详情',
    href: buildTransferBagDetailRoute({
      bagId: item.bagId,
      bagCode: item.bagCode,
      usageId: item.currentUsage?.usageId || undefined,
      usageNo: item.currentUsage?.usageNo || undefined,
    }),
  }
}

function renderHeaderActions(): string {
  const sourceReturnAction = resolveSourceReturnAction()
  const sourceReturnButton = sourceReturnAction
    ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(sourceReturnAction.href)}">${escapeHtml(sourceReturnAction.label)}</button>`
    : ''
  const fallbackWarehouseButton = sourceReturnAction
    ? ''
    : '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="go-cut-piece-warehouse-index">返回裁片仓</button>'

  if (isTransferBagDetailPage()) {
    return `
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildTransferBagListRoute())}">返回中转袋管理</button>
        ${sourceReturnButton}
        ${hasSummaryReturnContext(state.drillContext) ? '' : '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="go-summary-index">查看裁剪结果核查</button>'}
      </div>
    `
  }

  return `
    <div class="flex flex-wrap items-center gap-2">
      ${sourceReturnButton || fallbackWarehouseButton}
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="go-fei-tickets-index">去打印菲票</button>
      ${hasSummaryReturnContext(state.drillContext) ? '' : '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="go-summary-index">查看裁剪结果核查</button>'}
    </div>
  `
}

function renderReturnStatsCards(): string {
  const summary = getReturnViewModel().summary
  const scrapRecordCount = getCarrierManagementProjection().scrapRecords.filter(isTransferBagScrapRecord).length
  return renderCompactKpiGroup(`
      ${renderCompactKpiCard('已交出待回收', summary.waitingReturnUsageCount, '', 'text-orange-600')}
      ${renderCompactKpiCard('回收确认中', summary.inspectingUsageCount, '', 'text-cyan-600')}
      ${renderCompactKpiCard('已关闭使用周期数', summary.closedUsageCount, '', 'text-emerald-600')}
      ${renderCompactKpiCard('可用袋数', summary.reusableBagCount + summary.waitingCleaningBagCount + summary.waitingRepairBagCount, '', 'text-emerald-600')}
      ${renderCompactKpiCard('报废袋数', getViewModel().masters.filter((item) => item.currentStatus === 'DISABLED').length, '', 'text-slate-600')}
      ${renderCompactKpiCard('报废记录数', scrapRecordCount, '', 'text-rose-600')}
  `)
}

function renderPrefilterBar(): string {
  const chips = Array.from(
    new Set([
      ...buildCuttingDrillChipLabels(state.drillContext),
      state.prefilter?.sewingTaskNo ? `车缝任务：${state.prefilter.sewingTaskNo}` : '',
      state.prefilter?.returnStatus ? `回货状态：${state.prefilter.returnStatus}` : '',
      state.preselectedTicketRecordIds.length ? `预选菲票：${state.preselectedTicketRecordIds.length} 张` : '',
    ].filter(Boolean)),
  )
  if (!chips.length) return ''

  return renderWorkbenchStateBar({
    summary: buildCuttingDrillSummary(state.drillContext) || '当前按外部上下文预填中转袋流转工作区',
    chips: chips.map((label) => renderWorkbenchFilterChip(label, 'data-transfer-bags-action="clear-prefill"', 'amber')),
    clearAttrs: 'data-transfer-bags-action="clear-prefill"',
  })
}

function renderFeedbackBar(): string {
  if (!state.feedback) return ''
  const toneClass =
    state.feedback.tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-amber-200 bg-amber-50 text-amber-700'

  return `
    <section class="rounded-lg border px-3 py-2 text-sm ${toneClass}">
      ${escapeHtml(state.feedback.message)}
    </section>
  `
}

function renderLandingBanner(): string {
  if (!state.landingBanner) return ''

  return renderWorkbenchStateBar({
    summary: state.landingBanner.summary,
    chips: state.landingBanner.chips.map((label) => renderWorkbenchFilterChip(label, 'data-transfer-bags-action="clear-prefill"', 'amber')),
    clearAttrs: 'data-transfer-bags-action="clear-prefill"',
  })
}


function renderListHeaderActions(): string {
  return `
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-fast-page-render="true" data-transfer-bags-action="new-master">新增中转袋</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-fast-page-render="true" data-transfer-bags-action="focus-scan-query">扫码查询</button>
    </div>
  `
}

function renderMasterQuickFilterBar(): string {
  const statusOptions: TransferBagCarrierCurrentStatus[] = ['可用', '入仓装袋中', '入仓暂存中', '交出装袋中', '待交出', '已交出待回收', '报废']
  return renderStickyFilterShell(`
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.4fr,1fr,1fr]">
      <label class="space-y-2">
        <span class="text-sm font-medium text-foreground">袋码</span>
        <input
          type="text"
          value="${escapeHtml(state.masterKeyword)}"
          placeholder="袋码 / 规格 / 当前装载"
          class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          data-fast-page-render="true"
          data-transfer-bags-master-field="keyword"
        />
      </label>
      <label class="space-y-2">
        <span class="text-sm font-medium text-foreground">当前状态</span>
        <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-fast-page-render="true" data-transfer-bags-master-field="status">
          <option value="ALL" ${state.masterStatus === 'ALL' ? 'selected' : ''}>全部状态</option>
          ${statusOptions
            .map((status) => `<option value="${escapeHtml(status)}" ${state.masterStatus === status ? 'selected' : ''}>${escapeHtml(status)}</option>`)
            .join('')}
        </select>
      </label>
      <label class="space-y-2">
        <span class="text-sm font-medium text-foreground">当前位置</span>
        <input
          type="text"
          value="${escapeHtml(state.masterLocationKeyword)}"
          placeholder="工厂 / 仓库 / 库位"
          class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          data-fast-page-render="true"
          data-transfer-bags-master-field="location"
        />
      </label>
    </div>
  `)
}

function renderUsageRecordQuickFilterBar(): string {
  return renderStickyFilterShell(`
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.4fr,1fr,1fr]">
      <label class="space-y-2">
        <span class="text-sm font-medium text-foreground">关键词</span>
        <input
          type="text"
          value="${escapeHtml(state.usageKeyword)}"
          placeholder="使用记录号 / 袋码 / 菲票 / 裁片单"
          class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          data-transfer-bags-usage-field="keyword"
        />
      </label>
      <label class="space-y-2">
        <span class="text-sm font-medium text-foreground">使用周期状态</span>
        <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-usage-field="status">
          <option value="ALL" ${state.usageStatus === 'ALL' ? 'selected' : ''}>全部</option>
          <option value="DRAFT" ${state.usageStatus === 'DRAFT' ? 'selected' : ''}>草稿</option>
          <option value="PACKING" ${state.usageStatus === 'PACKING' ? 'selected' : ''}>装袋中</option>
          <option value="READY_TO_DISPATCH" ${state.usageStatus === 'READY_TO_DISPATCH' ? 'selected' : ''}>待交出</option>
          <option value="DISPATCHED" ${state.usageStatus === 'DISPATCHED' ? 'selected' : ''}>已交出待回收</option>
          <option value="CLOSED" ${state.usageStatus === 'CLOSED' ? 'selected' : ''}>已关闭</option>
          <option value="SCRAP_CLOSED" ${state.usageStatus === 'SCRAP_CLOSED' ? 'selected' : ''}>报废关闭</option>
        </select>
      </label>
      <label class="space-y-2">
        <span class="text-sm font-medium text-foreground">车缝任务</span>
        <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-usage-field="sewingTask">
          <option value="ALL" ${state.usageSewingTaskId === 'ALL' ? 'selected' : ''}>全部</option>
          ${getViewModel().sewingTasks
            .map(
              (item) => `<option value="${escapeHtml(item.sewingTaskId)}" ${state.usageSewingTaskId === item.sewingTaskId ? 'selected' : ''}>${escapeHtml(item.sewingTaskNo)}</option>`,
            )
            .join('')}
        </select>
      </label>
    </div>
  `)
}

function renderActiveListFilterBar(): string {
  return renderMasterQuickFilterBar()
}

function renderActiveListStats(): string {
  const { filteredItems, carrierRecordsByBagCode } = getPagedMasters()
  const statusOf = (item: TransferBagMasterItem) => carrierRecordsByBagCode[item.bagCode]?.currentStatus || item.currentStatus
  const inUseCount = filteredItems.filter((item) => statusOf(item) === 'IN_USE').length
  const dispatchedCount = filteredItems.filter((item) => statusOf(item) === 'DISPATCHED').length
  const disabledCount = filteredItems.filter((item) => statusOf(item) === 'DISABLED').length
  const packedTicketCount = filteredItems.reduce((sum, item) => sum + (item.packedTicketCount || 0), 0)

  return renderCompactKpiGroup(`
    ${renderCompactKpiCard('中转袋', filteredItems.length, '当前筛选范围', 'text-slate-900')}
    ${renderCompactKpiCard('使用中', inUseCount, '当前绑定业务对象', 'text-blue-600')}
    ${renderCompactKpiCard('已交出', dispatchedCount, '等待接收方回收', 'text-orange-600')}
    ${renderCompactKpiCard('已报废', disabledCount, '不可继续流转', 'text-slate-600')}
    ${renderCompactKpiCard('装载菲票', packedTicketCount, '当前筛选袋内菲票数', 'text-violet-600')}
  `)
}

function renderUsageRecordQuerySection(): string {
  const usages = getFilteredUsages()
  return `
    <section class="rounded-lg border bg-card" role="tabpanel" aria-label="中转袋使用记录">
      ${!usages.length
        ? '<div class="px-6 py-10 text-center text-sm text-muted-foreground">暂无匹配的中转袋使用记录。</div>'
        : renderStickyTableScroller(`
            <table class="min-w-[1220px] w-full text-sm">
              <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left">使用记录</th>
                  <th class="px-4 py-3 text-left">中转袋</th>
                  <th class="px-4 py-3 text-left">中转袋二维码</th>
                  <th class="px-4 py-3 text-left">使用阶段</th>
                  <th class="px-4 py-3 text-left">绑定 / 接收对象</th>
                  <th class="px-4 py-3 text-left">装载内容</th>
                  <th class="px-4 py-3 text-left">时间节点</th>
                  <th class="px-4 py-3 text-left">状态</th>
                  <th class="px-4 py-3 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                ${usages
                  .map((item) => {
                    const detailHref = buildTransferBagDetailRoute({
                      bagId: item.bagId,
                      bagCode: item.bagCode,
                      usageId: item.usageId,
                      usageNo: item.usageNo,
                      detailTab: 'history',
                    })
                    const itemsHref = buildTransferBagDetailRoute({
                      bagId: item.bagId,
                      bagCode: item.bagCode,
                      usageId: item.usageId,
                      usageNo: item.usageNo,
                      detailTab: 'items',
                    })
                    const locationText = [
                      item.sourceWarehouseName,
                      item.warehouseArea,
                      item.locationCode,
                    ].filter(Boolean).join(' / ') || item.bagMaster?.currentLocation || '待补位置'
                    const receiverText = [
                      item.receiverName || formatFactoryDisplayName(item.sewingFactoryName),
                      item.receiverType,
                    ].filter(Boolean).join(' / ') || '待指定'
                    return `
                      <tr class="border-b bg-card">
                        <td class="px-4 py-3">
                          <button type="button" class="font-medium text-blue-700 hover:underline" data-nav="${escapeHtml(detailHref)}">${escapeHtml(item.usageNo)}</button>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.note || '无备注')}</div>
                        </td>
                        <td class="px-4 py-3">
                          <div class="font-medium text-foreground">${escapeHtml(item.bagCode)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(locationText)}</div>
                        </td>
                        <td class="px-4 py-3">${renderTransferBagQrCell(item.bagCode)}</td>
                        <td class="px-4 py-3">
                          <div class="font-medium text-foreground">${escapeHtml(item.usageStageLabel || '交出装袋')}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.bagFirstRuleLabel)}</div>
                        </td>
                        <td class="px-4 py-3">
                          <div class="font-medium text-foreground">${escapeHtml(item.boundObjectNo || item.sewingTaskNo || '无')}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.boundObjectType || (item.usageStage === 'INBOUND_TEMP' ? '入仓暂存记录' : '车缝任务'))}</div>
                          <div class="mt-1 text-xs text-muted-foreground">接收：${escapeHtml(receiverText)}</div>
                        </td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">
                          <div><span class="font-medium text-foreground">${escapeHtml(String(item.summary.ticketCount))}</span> 张菲票</div>
                          <div class="mt-1"><span class="font-medium text-foreground">${escapeHtml(String(item.summary.quantityTotal))}</span> 片裁片</div>
                          <div class="mt-1">${escapeHtml(`${item.summary.productionOrderCount} 个生产单 / ${item.summary.cutOrderCount} 张裁片单`)}</div>
                        </td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">
                          <div>开始：${escapeHtml(item.startedAt || '待补')}</div>
                          <div class="mt-1">装袋：${escapeHtml(item.finishedPackingAt || '待补')}</div>
                          <div class="mt-1">交出：${escapeHtml(item.dispatchAt || '待交出')}</div>
                          <div class="mt-1">回收：${escapeHtml(item.returnedAt || '待回收')}</div>
                        </td>
                        <td class="px-4 py-3">${renderTag(item.statusMeta.label, item.statusMeta.className)}</td>
                        <td class="px-4 py-3">
                          <div class="flex flex-wrap gap-2">
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(detailHref)}">查看使用记录</button>
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(itemsHref)}">查看装载明细</button>
                          </div>
                        </td>
                      </tr>
                    `
                  })
                  .join('')}
              </tbody>
            </table>
          `)}
    </section>
  `
}

function renderDemoFixturePanel(): string {
  return ''
}

function renderInboundTempUseSection(): string {
  const projection = getCarrierManagementProjection()
  const items = projection.inboundTempUses
  return `
    <section class="rounded-lg border bg-card" role="tabpanel" aria-label="入仓暂存使用">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 class="text-sm font-semibold text-foreground">入仓暂存使用</h2>
        </div>
        <button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="open-inbound-pack">开始入仓暂存装袋</button>
      </div>
      ${items.length
        ? renderStickyTableScroller(`
            <table class="min-w-[1200px] w-full text-sm">
              <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left">中转袋</th>
                  <th class="px-4 py-3 text-left">中转袋二维码</th>
                  <th class="px-4 py-3 text-left">入仓信息</th>
                  <th class="px-4 py-3 text-left">装入内容</th>
                  <th class="px-4 py-3 text-left">混装情况</th>
                  <th class="px-4 py-3 text-left">后续状态</th>
                  <th class="px-4 py-3 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                ${items
                  .map((item) => {
                    const detailHref = buildTransferBagDetailRoute({
                      bagId: item.bagMasterId,
                      bagCode: item.bagCode,
                      usageId: item.bagUseId,
                      usageNo: item.bagUseNo,
                      detailTab: 'current',
                    })
                    const itemsHref = buildTransferBagDetailRoute({
                      bagId: item.bagMasterId,
                      bagCode: item.bagCode,
                      usageId: item.bagUseId,
                      usageNo: item.bagUseNo,
                      detailTab: 'items',
                    })
                    return `
                      <tr class="border-b bg-card">
                        <td class="px-4 py-3">
                          <div class="font-medium text-blue-700">${escapeHtml(item.bagCode)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.bagUseNo)}</div>
                          <div class="mt-2">${renderTag(item.currentStatus, getCarrierCurrentStatusClass(item.currentStatus))}</div>
                        </td>
                        <td class="px-4 py-3">${renderTransferBagQrCell(item.bagCode)}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">
                          <div><span class="font-medium text-foreground">${escapeHtml(item.inboundAt || item.startedAt || '待入仓')}</span></div>
                          <div class="mt-1">${escapeHtml(item.inboundBy || '裁床仓管')}</div>
                          <div class="mt-1">${escapeHtml(`${item.sourceWarehouseName} / ${item.warehouseArea} / ${item.locationCode}`)}</div>
                        </td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">
                          <div><span class="font-medium text-foreground">${escapeHtml(String(item.containedFeiTickets.length))}</span> 张菲票</div>
                          <div class="mt-1"><span class="font-medium text-foreground">${escapeHtml(String(item.containedPieceQty))}</span> 片裁片</div>
                          <div class="mt-1">${escapeHtml(`${item.containedProductionOrderCount} 个生产单 / ${item.containedCutOrderCount} 张裁片单`)}</div>
                        </td>
                        <td class="px-4 py-3">
                          ${renderTag(item.mixedFlag ? '混装' : '单一来源', item.mixedFlag ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-700 border border-slate-200')}
                          <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(item.mixedSummary)}</div>
                        </td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.currentStatus === '入仓暂存中' ? '暂存中，等待二次分拣或转出' : item.currentStatus === '入仓装袋中' ? '装袋中，待确认暂存' : '已转出或已清空')}</td>
                        <td class="px-4 py-3">
                          <div class="flex flex-wrap gap-2">
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(detailHref)}">查看使用详情</button>
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(itemsHref)}">查看菲票</button>
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(getCanonicalCuttingPath('cut-piece-warehouse'))}">查看库存流水</button>
                            ${item.currentStatus === '入仓装袋中' ? `<button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="complete-inbound-storage" data-usage-id="${escapeHtml(item.bagUseId)}">确认暂存</button>` : ''}
                            ${item.currentStatus === '入仓暂存中' ? `<button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="release-inbound-bag" data-usage-id="${escapeHtml(item.bagUseId)}">清空袋</button>` : ''}
                          </div>
                        </td>
                      </tr>
                    `
                  })
                  .join('')}
              </tbody>
            </table>
          `)
        : '<div class="px-6 py-10 text-center text-sm text-muted-foreground">暂无入仓暂存使用记录</div>'}
    </section>
  `
}

function renderHandoverPackingUseSection(): string {
  const projection = getCarrierManagementProjection()
  const items = projection.handoverPackingUses
  return `
    <section class="rounded-lg border bg-card" role="tabpanel" aria-label="交出装袋使用">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 class="text-sm font-semibold text-foreground">交出装袋使用</h2>
        </div>
        <button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="open-handover-pack">开始交出装袋</button>
      </div>
      ${items.length
        ? renderStickyTableScroller(`
            <table class="min-w-[1260px] w-full text-sm">
              <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left">中转袋</th>
                  <th class="px-4 py-3 text-left">中转袋二维码</th>
                  <th class="px-4 py-3 text-left">绑定对象</th>
                  <th class="px-4 py-3 text-left">接收对象</th>
                  <th class="px-4 py-3 text-left">装入内容</th>
                  <th class="px-4 py-3 text-left">交出信息</th>
                  <th class="px-4 py-3 text-left">交出状态</th>
                  <th class="px-4 py-3 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                ${items
                  .map((item) => {
                    const detailHref = buildTransferBagDetailRoute({
                      bagId: item.bagMasterId,
                      bagCode: item.bagCode,
                      usageId: item.bagUseId,
                      usageNo: item.bagUseNo,
                      detailTab: 'items',
                    })
                    const canConfirmHandover = item.currentStatus === '交出装袋中' || item.currentStatus === '待交出'
                    const canReturn = item.currentStatus === '已交出待回收' && !item.returnedAt
                    return `
                      <tr class="border-b bg-card">
                        <td class="px-4 py-3">
                          <div class="font-medium text-blue-700">${escapeHtml(item.bagCode)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.bagUseNo)}</div>
                          <div class="mt-2">${renderTag(item.currentStatus, getCarrierCurrentStatusClass(item.currentStatus))}</div>
                        </td>
                        <td class="px-4 py-3">${renderTransferBagQrCell(item.bagCode)}</td>
                        <td class="px-4 py-3">
                          <div class="font-medium text-foreground">${escapeHtml(item.targetObjectNo || '待绑定')}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.targetObjectType || '绑定对象待补')}</div>
                        </td>
                        <td class="px-4 py-3">
                          <div class="font-medium text-foreground">${escapeHtml(formatFactoryDisplayName(item.receiverName || item.receiverFactoryName) || '待指定')}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.receiverType || '接收对象')}</div>
                        </td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">
                          <div><span class="font-medium text-foreground">${escapeHtml(String(item.containedFeiTickets.length))}</span> 张菲票</div>
                          <div class="mt-1"><span class="font-medium text-foreground">${escapeHtml(String(item.containedPieceQty))}</span> 片裁片</div>
                          <div class="mt-1">${escapeHtml(item.mixedSummary)}</div>
                        </td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">
                          <div>交出单：${escapeHtml(item.targetObjectNo || '待生成')}</div>
                          <div class="mt-1">交出记录：${escapeHtml(item.handedOverAt ? item.bagUseNo : '待交出')}</div>
                          <div class="mt-1">交出时间：${escapeHtml(item.handedOverAt || '待交出')}</div>
                        </td>
                        <td class="px-4 py-3">${renderTag(item.currentStatus, getCarrierCurrentStatusClass(item.currentStatus))}</td>
                        <td class="px-4 py-3">
                          <div class="flex flex-wrap gap-2">
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(getCanonicalCuttingPath('handover-record-detail'))}">查看交出记录</button>
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(detailHref)}">查看装袋明细</button>
                            ${canConfirmHandover ? `<button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="confirm-handover" data-usage-id="${escapeHtml(item.bagUseId)}">交出确认</button>` : ''}
                            ${canReturn ? `<button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="open-return" data-usage-id="${escapeHtml(item.bagUseId)}">回收确认</button>` : ''}
                          </div>
                        </td>
                      </tr>
                    `
                  })
                  .join('')}
              </tbody>
            </table>
          `)
        : '<div class="px-6 py-10 text-center text-sm text-muted-foreground">暂无交出装袋使用记录</div>'}
    </section>
  `
}

function renderSignAndReturnUseSection(): string {
  const projection = getCarrierManagementProjection()
  const items = projection.signedAndReturnUses
  return `
    <section class="rounded-lg border bg-card" role="tabpanel" aria-label="已交出待回收">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <h2 class="text-sm font-semibold text-foreground">已交出待回收</h2>
        <button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="open-return">回收确认</button>
      </div>
      ${items.length
        ? renderStickyTableScroller(`
            <table class="min-w-[1040px] w-full text-sm">
              <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left">中转袋</th>
                  <th class="px-4 py-3 text-left">中转袋二维码</th>
                  <th class="px-4 py-3 text-left">交出对象</th>
                  <th class="px-4 py-3 text-left">交出</th>
                  <th class="px-4 py-3 text-left">回收</th>
                  <th class="px-4 py-3 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                ${items
                  .map((item) => {
                    return `
                      <tr class="border-b bg-card">
                        <td class="px-4 py-3">
                          <div class="font-medium text-blue-700">${escapeHtml(item.bagCode)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.bagUseNo)}</div>
                        </td>
                        <td class="px-4 py-3">${renderTransferBagQrCell(item.bagCode)}</td>
                        <td class="px-4 py-3">
                          <div class="font-medium text-foreground">${escapeHtml(formatFactoryDisplayName(item.receiverName || item.receiverFactoryName) || '待补接收方')}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.targetObjectNo || '交出记录待补')}</div>
                        </td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">
                          <div><span class="font-medium text-foreground">${escapeHtml(item.handedOverAt || '待交出')}</span></div>
                          <div class="mt-1">交出记录：${escapeHtml(item.targetObjectNo || item.bagUseNo)}</div>
                          <div class="mt-1">装载数量：${escapeHtml(String(item.containedPieceQty))} 片</div>
                        </td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">
                          <div><span class="font-medium text-foreground">${escapeHtml(item.returnedAt || '待回收')}</span></div>
                          <div class="mt-1">回收人：${escapeHtml(item.returnedBy || '待确认')}</div>
                          <div class="mt-1">回收库位：${escapeHtml(item.returnedAt ? item.returnWarehouseName || item.locationCode : '待确认')}</div>
                        </td>
                        <td class="px-4 py-3">
                          <div class="flex flex-wrap gap-2">
                            ${!item.returnedAt ? `<button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="open-return" data-usage-id="${escapeHtml(item.bagUseId)}">回收确认</button>` : ''}
                          </div>
                        </td>
                      </tr>
                    `
                  })
                  .join('')}
              </tbody>
            </table>
          `)
        : '<div class="px-6 py-10 text-center text-sm text-muted-foreground">暂无已交出待回收记录</div>'}
    </section>
  `
}

function isTransferBagScrapRecord(record: { scrapType?: string; description?: string }): boolean {
  return [record.scrapType, record.description].filter(Boolean).join(' / ').includes('报废')
}

function renderCarrierScrapSection(): string {
  const projection = getCarrierManagementProjection()
  const items = projection.scrapRecords.filter(isTransferBagScrapRecord)
  const carrierRecordsByBagCode = getCarrierMasterRecordMap()
  return `
    <section class="rounded-lg border bg-card" role="tabpanel" aria-label="报废记录">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <h2 class="text-sm font-semibold text-foreground">报废记录</h2>
      </div>
      ${items.length
        ? renderStickyTableScroller(`
            <table class="min-w-[1160px] w-full text-sm">
              <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left">报废</th>
                  <th class="px-4 py-3 text-left">中转袋</th>
                  <th class="px-4 py-3 text-left">中转袋二维码</th>
                  <th class="px-4 py-3 text-left">关联对象</th>
                  <th class="px-4 py-3 text-left">报废说明</th>
                  <th class="px-4 py-3 text-left">处理</th>
                  <th class="px-4 py-3 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                ${items
                  .map((item) => {
                    const carrierRecord = carrierRecordsByBagCode[item.bagCode]
                    const detailHref = buildTransferBagDetailRoute({
                      bagCode: item.bagCode,
                      usageId: item.relatedUseId,
                      usageNo: item.relatedObjectId,
                      detailTab: 'logs',
                    })
                    return `
                      <tr class="border-b bg-card">
                        <td class="px-4 py-3">
                          ${renderTag(item.scrapType, 'bg-rose-100 text-rose-700 border border-rose-200')}
                          <div class="mt-1 text-xs text-muted-foreground">等级：高</div>
                          <div class="mt-1 text-xs text-muted-foreground">状态：${escapeHtml(item.handlingStatus)}</div>
                        </td>
                        <td class="px-4 py-3">
                          <div class="font-medium text-blue-700">${escapeHtml(item.bagCode)}</div>
                          <div class="mt-1">${renderTag(carrierRecord?.currentStatus || '报废', getCarrierCurrentStatusClass(carrierRecord?.currentStatus || '报废'))}</div>
                        </td>
                        <td class="px-4 py-3">${renderTransferBagQrCell(item.bagCode)}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">
                          <div>${escapeHtml(item.relatedObjectType || '使用记录')}</div>
                          <div class="mt-1">${escapeHtml(item.relatedObjectId || '业务对象待补')}</div>
                        </td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">
                          <div class="text-sm text-foreground">${escapeHtml(item.description)}</div>
                          <div class="mt-1">照片：${escapeHtml(String(item.evidencePhotos.length))} 张</div>
                        </td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">
                          <div>${escapeHtml(item.handlingStatus)}</div>
                          <div class="mt-1">${escapeHtml(item.handledBy || '待处理')}</div>
                          <div class="mt-1">${escapeHtml(item.handledAt || '待确认')}</div>
                        </td>
                        <td class="px-4 py-3">
                          <div class="flex flex-wrap gap-2">
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(detailHref)}">查看报废</button>
                          </div>
                        </td>
                      </tr>
                    `
                  })
                  .join('')}
              </tbody>
            </table>
          `)
        : '<div class="px-6 py-10 text-center text-sm text-muted-foreground">暂无报废记录</div>'}
    </section>
  `
}

function renderTransferBagStageLedgerPanel(): string {
  const viewModel = getViewModel()
  const stageItems = viewModel.stageLedgerItems
  if (!stageItems.length) return ''
  const stageSummary = viewModel.stageSummary

  return `
    <section class="rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 class="text-sm font-semibold text-foreground">中转袋业务阶段</h2>
        </div>
        <button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-nav="${escapeHtml(getCanonicalCuttingPath('sewing-dispatch'))}">查看交出单</button>
      </div>
      <div class="grid gap-3 border-b p-4 md:grid-cols-4">
        ${renderCompactKpiCard('入仓暂存', stageSummary.inboundTempCount, '允许混装', 'text-blue-600')}
        ${renderCompactKpiCard('交出装袋', stageSummary.handoverPackingCount, '绑定交出关系', 'text-emerald-600')}
        ${renderCompactKpiCard('已绑定交出关系', stageSummary.handoverRelationOkCount, '交出单或交出记录', 'text-emerald-600')}
        ${renderCompactKpiCard('关系待补', stageSummary.handoverRelationMissingCount, '交出装袋阶段', 'text-amber-600')}
      </div>
      ${renderStickyTableScroller(`
        <table class="min-w-[1080px] w-full text-sm">
          <thead class="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th class="px-4 py-3 text-left">阶段</th>
              <th class="px-4 py-3 text-left">中转袋</th>
              <th class="px-4 py-3 text-left">业务关系</th>
              <th class="px-4 py-3 text-left">${PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE}</th>
              <th class="px-4 py-3 text-left">裁片单</th>
              <th class="px-4 py-3 text-left">菲票</th>
              <th class="px-4 py-3 text-left">状态</th>
              <th class="px-4 py-3 text-left">规则</th>
            </tr>
          </thead>
          <tbody>
            ${stageItems
              .map(
                (item) => `
                  <tr class="border-t">
                    <td class="px-4 py-3">${renderTag(item.stageLabel, item.stage === 'INBOUND_TEMP' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200')}</td>
                    <td class="px-4 py-3">
                      <div class="font-medium text-blue-700">${escapeHtml(item.carrierCode)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.cycleNo || '暂无周期')}</div>
                    </td>
                    <td class="px-4 py-3">
                      <div class="${item.relationOk ? 'text-foreground' : 'text-amber-700'}">${escapeHtml(item.relationLabel)}</div>
                      ${item.stage === 'HANDOVER_PACKING' ? `<div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.dispatchBatchNo || '交出记录待新增')}</div>` : ''}
                    </td>
                    <td class="px-4 py-3">${renderProductionOrderIdentityCell(item.productionOrderNos.join(' / ') || '暂无')}</td>
                    <td class="px-4 py-3">${escapeHtml(item.cutOrderNos.join(' / ') || '暂无')}</td>
                    <td class="px-4 py-3">${escapeHtml(`${item.ticketCount} 张`)}</td>
                    <td class="px-4 py-3">${escapeHtml(item.statusLabel)}</td>
                    <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.ruleLabel)}</td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      `)}
    </section>
  `
}

function renderSortingTaskStatusTag(status: string): string {
  const className =
    status === '待分拣'
      ? 'bg-amber-100 text-amber-700 border border-amber-200'
      : status === '分拣中'
        ? 'bg-blue-100 text-blue-700 border border-blue-200'
        : status === '已装袋'
          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
          : status === '已交出' || status === '已回写'
            ? 'bg-slate-900 text-white border border-slate-900'
            : 'bg-rose-100 text-rose-700 border border-rose-200'
  return renderTag(status, className)
}

function renderCutPieceSortingTaskPanel(): string {
  return ''
}

function renderMasterSection(): string {
  const { filteredItems, pageSlice, carrierRecordsByBagCode } = getPagedMasters()
  const items = pageSlice.items
  return `
    <div class="space-y-3" role="tabpanel" aria-label="中转袋档案">
      <section class="rounded-lg border bg-card">
        <div class="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 class="text-sm font-semibold text-foreground">中转袋档案</h2>
          </div>
          <div class="text-xs text-muted-foreground">共 ${filteredItems.length} 条中转袋</div>
        </div>
        ${!items.length
          ? '<div class="px-6 py-10 text-center text-sm text-muted-foreground">暂无匹配结果</div>'
          : `${renderStickyTableScroller(`
            <table class="min-w-[1260px] w-full text-sm">
              <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left">中转袋</th>
                  <th class="px-4 py-3 text-left">中转袋二维码</th>
                  <th class="px-4 py-3 text-left">当前状态</th>
                  <th class="px-4 py-3 text-left">当前使用</th>
                  <th class="px-4 py-3 text-left">当前所在</th>
                  <th class="px-4 py-3 text-left">当前装载</th>
                  <th class="px-4 py-3 text-left">最近记录</th>
                  <th class="px-4 py-3 text-left">报废记录</th>
                  <th class="px-4 py-3 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                ${items
                  .map(
                    (item) => {
                      const detailHref = buildTransferBagDetailRoute({
                        bagId: item.bagId,
                        bagCode: item.bagCode,
                        usageId: item.currentUsage?.usageId || undefined,
                        usageNo: item.currentUsage?.usageNo || undefined,
                      })
                      const historyHref = buildTransferBagDetailRoute({
                        bagId: item.bagId,
                        bagCode: item.bagCode,
                        usageId: item.currentUsage?.usageId || undefined,
                        usageNo: item.currentUsage?.usageNo || undefined,
                        detailTab: 'history',
                      })
                      const carrierRecord = carrierRecordsByBagCode[item.bagCode]
                      const currentStatus = carrierRecord?.currentStatus || item.visibleStatusMeta.label
                      const scrapCount = carrierRecord?.scrapCount || 0
                      return `
                      <tr class="border-b ${state.activeMasterId === item.bagId ? 'bg-blue-50/60' : 'bg-card'}">
                        <td class="px-4 py-3">
                          <button type="button" class="font-medium text-blue-700 hover:underline" data-nav="${escapeHtml(detailHref)}">${escapeHtml(item.bagCode)}</button>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(carrierRecord?.bagSpec || `${item.bagType} / 容量 ${item.capacity} 张`)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(`载具类型：${item.carrierType === 'box' ? '箱' : '袋'} / ${(carrierRecord?.bagMaterial || '循环载具').split('可' + '复' + '用').join('循环')}`)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(`归属：${carrierRecord?.ownershipFactoryName || item.ownershipFactoryName || '待补货权工厂'}`)}</div>
                        </td>
                        <td class="px-4 py-3">${renderTransferBagQrCell(item.bagCode)}</td>
                        <td class="px-4 py-3">
                          ${renderTag(currentStatus, getCarrierCurrentStatusClass(currentStatus))}
                        </td>
                        <td class="px-4 py-3">
                          <div class="font-medium text-foreground">${escapeHtml(carrierRecord?.currentUseStage || '无')}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml([carrierRecord?.currentBoundObjectType, carrierRecord?.currentBoundObjectNo].filter(Boolean).join('：') || '未绑定业务对象')}</div>
                        </td>
                        <td class="px-4 py-3">
                          <div class="font-medium text-foreground">${escapeHtml(carrierRecord?.currentLocation || item.currentLocation || '待命位')}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(carrierRecord?.enabled === false ? '已报废' : '可流转')}</div>
                        </td>
                        <td class="px-4 py-3">
                          <div class="font-medium text-foreground">${escapeHtml(`${carrierRecord?.currentFeiTicketCount || item.packedTicketCount || 0} 张菲票`)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(`${carrierRecord?.currentPieceQty || item.currentTotalPieceCount || 0} 片裁片`)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">物料：按装载明细追溯</div>
                        </td>
                        <td class="px-4 py-3">
                          <div class="font-medium text-foreground">${escapeHtml(carrierRecord?.lastUsedAt || item.currentUsage?.startedAt || '暂无使用记录')}</div>
                          <div class="mt-1 text-xs text-muted-foreground">最近交出：${escapeHtml(item.currentUsage?.dispatchAt || '暂无')}</div>
                          <div class="mt-1 text-xs text-muted-foreground">最近回收：${escapeHtml(carrierRecord?.lastReturnedAt || '暂无')}</div>
                          <div class="mt-1 text-xs text-muted-foreground">累计使用：${escapeHtml(String(carrierRecord?.totalUseCount || 0))} 次</div>
                        </td>
                        <td class="px-4 py-3">
                          <div class="font-medium ${scrapCount ? 'text-rose-700' : 'text-muted-foreground'}">${escapeHtml(String(scrapCount))} 条</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(scrapCount ? '查看报废记录确认处置结果' : '无报废记录')}</div>
                        </td>
                        <td class="px-4 py-3">
                          <div class="flex flex-wrap gap-2">
                            ${renderMasterStatusActions({ item, currentStatus, detailHref, historyHref })}
                          </div>
                        </td>
                      </tr>
                    `
                    },
                  )
                  .join('')}
              </tbody>
            </table>
          `)}
          ${renderWorkbenchPagination({
            page: pageSlice.page,
            pageSize: pageSlice.pageSize,
            total: filteredItems.length,
            actionAttr: 'data-transfer-bags-action',
            pageAction: 'set-master-page',
            pageSizeAttr: 'data-transfer-bags-master-page-size',
            extraAttrs: 'data-fast-page-render="true"',
            pageSizeOptions: [10, 20, 50],
          })}`}
      </section>
    </div>
  `
}

function renderMasterDetail(item: TransferBagMasterItem | null): string {
  if (!item) return ''
  const currentUsage = item.currentUsage
  const currentBindings = currentUsage?.bindingItems || []
  const transferBagQrValue = resolveFormalBagQrValue(item)
  const historyUsages = getViewModel().usages
    .filter((usage) => usage.bagId === item.bagId)
    .sort((left, right) => right.usageNo.localeCompare(left.usageNo, 'zh-CN'))
  return renderWorkbenchSecondaryPanel({
    title: `中转袋详情：${item.bagCode}`,
    hint: '',
    defaultOpen: true,
    body: `
      <div class="grid gap-3 xl:grid-cols-[0.88fr,1.12fr]">
        <div class="space-y-3">
          <div class="space-y-3 rounded-lg border bg-muted/15 p-3 text-sm">
            <div><span class="text-muted-foreground">中转袋码：</span><span class="font-medium text-foreground">${escapeHtml(item.bagCode)}</span></div>
            <div><span class="text-muted-foreground">口袋状态：</span>${renderTag(item.pocketStatusMeta.label, item.pocketStatusMeta.className)}</div>
            <div><span class="text-muted-foreground">当前使用周期号：</span><span class="font-medium text-foreground">${escapeHtml(currentUsage?.usageNo || '暂无')}</span></div>
            <div><span class="text-muted-foreground">开始时间：</span><span class="font-medium text-foreground">${escapeHtml(currentUsage?.startedAt || '待开始')}</span></div>
            <div><span class="text-muted-foreground">交出时间：</span><span class="font-medium text-foreground">${escapeHtml(item.currentDispatchedAt || '待交出')}</span></div>
            <div><span class="text-muted-foreground">回收时间：</span><span class="font-medium text-foreground">${escapeHtml(item.currentReturnedAt || '待回收')}</span></div>
            <div><span class="text-muted-foreground">当前位置：</span><span class="font-medium text-foreground">${escapeHtml(item.currentLocation || '待命位')}</span></div>
          </div>
          <div class="space-y-3 rounded-lg border bg-muted/15 p-3 text-sm">
            <div><span class="text-muted-foreground">容量 / 当前绑定数：</span><span class="font-medium text-foreground">${escapeHtml(`${item.capacity} 张 / ${item.packedTicketCount} 张菲票`)}</span></div>
            <div><span class="text-muted-foreground">当前袋内成衣件数（件）：</span><span class="font-medium text-foreground">${escapeHtml(String(item.currentTotalPieceCount))}</span></div>
            <div><span class="text-muted-foreground">当前款号：</span><span class="font-medium text-foreground">${escapeHtml(item.currentStyleCode || '待锁定')}</span></div>
            <div><span class="text-muted-foreground">来源铺布：</span><span class="font-medium text-foreground">${escapeHtml(currentUsage?.spreadingSessionNo || currentUsage?.spreadingSessionId || '暂无')}</span></div>
            <div><span class="text-muted-foreground">来源唛架：</span><span class="font-medium text-foreground">${escapeHtml(currentUsage?.sourceMarkerNos.join(' / ') || '暂无')}</span></div>
            <div><span class="text-muted-foreground">来源生产单集合：</span><span class="font-medium text-foreground">${escapeHtml(currentUsage?.productionOrderNos.join(' / ') || '暂无')}</span></div>
            <div><span class="text-muted-foreground">来源裁片单：</span><span class="font-medium text-foreground">${escapeHtml(currentUsage?.cutOrderNos.join(' / ') || '暂无')}</span></div>
            <div><span class="text-muted-foreground">来源唛架方案：</span><span class="font-medium text-foreground">${escapeHtml(currentUsage?.markerPlanNos.join(' / ') || '暂无')}</span></div>
          </div>
          <div class="rounded-lg border bg-card p-4">
            <div class="text-sm font-semibold text-foreground">正式二维码</div>
            ${
              transferBagQrValue
                ? `
                  <div class="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
                    <div class="inline-flex w-fit rounded-xl border bg-white p-3 shadow-sm">
                      ${renderRealQrPlaceholder({
                        value: transferBagQrValue,
                        size: 168,
                        title: `中转袋码 ${item.bagCode}`,
                        label: `中转袋 ${item.bagCode} 正式二维码`,
                      })}
                    </div>
                    <div class="space-y-2 text-sm">
                      <div><span class="text-muted-foreground">中转袋码：</span><span class="font-medium text-foreground">${escapeHtml(item.bagCode)}</span></div>
                      <div><span class="text-muted-foreground">当前使用周期：</span><span class="font-medium text-foreground">${escapeHtml(currentUsage?.usageNo || '暂无')}</span></div>
                      <div><span class="text-muted-foreground">二维码：</span><span class="font-medium text-foreground">已生成</span></div>
                    </div>
                  </div>
                `
                : '<div class="mt-3 rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">暂无二维码</div>'
            }
          </div>
          <div class="flex flex-wrap gap-2">
            ${item.pocketStatusKey === 'IDLE' ? `<button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="use-master" data-bag-id="${escapeHtml(item.bagId)}">开始装袋</button>` : ''}
            ${item.pocketStatusKey === 'PACKING' ? `<button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="use-master" data-bag-id="${escapeHtml(item.bagId)}">继续装袋</button>` : ''}
            ${item.pocketStatusKey === 'READY_TO_DISPATCH' && currentUsage ? `<button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="print-manifest" data-usage-id="${escapeHtml(currentUsage.usageId)}">打印中转袋二维码</button><button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="mark-dispatched" data-usage-id="${escapeHtml(currentUsage.usageId)}">交出</button>` : ''}
            ${item.pocketStatusKey === 'DISPATCHED' && currentUsage ? `<button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="prepare-return" data-usage-id="${escapeHtml(currentUsage.usageId)}">回收确认</button>` : ''}
            ${item.pocketStatusKey === 'RETURNED' && currentUsage ? `<button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="close-usage-cycle" data-usage-id="${escapeHtml(currentUsage.usageId)}">关闭本次使用周期</button>` : ''}
          </div>
        </div>
        <div class="space-y-3">
          <div class="rounded-lg border">
            <div class="border-b px-3 py-2 text-xs font-medium text-muted-foreground">袋内菲票明细</div>
            ${
              currentBindings.length
                ? renderStickyTableScroller(`
                    <table class="min-w-full text-sm">
                      <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th class="px-3 py-2 text-left">菲票码</th>
                          <th class="px-3 py-2 text-left">款号</th>
                          <th class="px-3 py-2 text-left">面料</th>
                          <th class="px-3 py-2 text-left">部位</th>
                          <th class="px-3 py-2 text-right">菲票件数（件）</th>
                          <th class="px-3 py-2 text-left">${PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE}</th>
                          <th class="px-3 py-2 text-left">来源裁片单号</th>
                          <th class="px-3 py-2 text-left">所属唛架方案号</th>
                          <th class="px-3 py-2 text-left">菲票状态</th>
                          <th class="px-3 py-2 text-left">是否允许移除</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${currentBindings
                          .map(
                            (binding) => `
                              <tr class="border-b bg-card">
                                <td class="px-3 py-2 font-medium text-foreground">${escapeHtml(binding.ticketNo)}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.ticket?.styleCode || currentUsage?.styleCode || '待补')}</td>
                                <td class="px-3 py-2">
                                  ${renderMaterialIdentityBlock({
                                    materialSku: binding.ticket?.materialSku || '待补',
                                    materialLabel: binding.ticket?.materialSku || '待补',
                                    materialAlias: binding.ticket?.materialAlias || '',
                                    materialImageUrl: binding.ticket?.materialImageUrl || '',
                                  }, { compact: true })}
                                  <div class="text-xs text-muted-foreground">${escapeHtml(binding.ticket ? `${binding.ticket.color || '待补颜色'} / ${binding.ticket.size || '待补尺码'}` : '待补')}</div>
                                </td>
                                <td class="px-3 py-2">${escapeHtml(binding.ticket?.partName || '待补部位')}</td>
                                <td class="px-3 py-2 text-right tabular-nums">${escapeHtml(String(binding.qty))}</td>
                                <td class="px-3 py-2">${renderProductionOrderIdentityCell(binding.productionOrderNo)}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.cutOrderNo)}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.markerPlanNo || binding.唛架方案No || '—')}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.ticket?.ticketStatus === 'VOIDED' ? '已作废' : '有效')}</td>
                                <td class="px-3 py-2">
                                  ${
                                    binding.removable
                                      ? `<button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-transfer-bags-action="remove-binding" data-binding-id="${escapeHtml(binding.bindingId)}">可移除</button>`
                                      : '<span class="text-xs text-muted-foreground">当前阶段不可移除</span>'
                                  }
                                </td>
                              </tr>
                            `,
                          )
                          .join('')}
                      </tbody>
                    </table>
                  `, 'max-h-[24vh]')
                : '<div class="px-3 py-8 text-center text-sm text-muted-foreground">当前口袋暂无已绑定菲票。</div>'
            }
          </div>
          <div class="rounded-lg border">
            <div class="border-b px-3 py-2 text-xs font-medium text-muted-foreground">历史使用周期</div>
            ${
              historyUsages.length
                ? renderStickyTableScroller(`
                    <table class="min-w-full text-sm">
                      <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th class="px-3 py-2 text-left">使用周期号</th>
                          <th class="px-3 py-2 text-left">状态</th>
                          <th class="px-3 py-2 text-left">时间</th>
                          <th class="px-3 py-2 text-right">绑定菲票数量</th>
                          <th class="px-3 py-2 text-left">交出 / 回收</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${historyUsages
                          .map(
                            (usage) => `
                              <tr class="border-b bg-card">
                                <td class="px-3 py-2">
                                  <button type="button" class="font-medium text-blue-700 hover:underline" data-nav="${escapeHtml(buildTransferBagDetailRoute({
                                    bagId: usage.bagId,
                                    bagCode: usage.bagCode,
                                    usageId: usage.usageId,
                                    usageNo: usage.usageNo,
                                  }))}">${escapeHtml(usage.usageNo)}</button>
                                </td>
                                <td class="px-3 py-2">${renderTag(usage.pocketStatusMeta.label, usage.pocketStatusMeta.className)}</td>
                                <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(usage.startedAt || usage.dispatchAt || '待补')}</td>
                                <td class="px-3 py-2 text-right tabular-nums">${escapeHtml(String(usage.summary.ticketCount))}</td>
                                <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml([usage.dispatchAt || '待交出', usage.returnedAt || '待回收'].join(' / '))}</td>
                              </tr>
                            `,
                          )
                          .join('')}
                      </tbody>
                    </table>
                  `, 'max-h-[20vh]')
                : '<div class="px-3 py-8 text-center text-sm text-muted-foreground">当前还没有历史使用周期记录。</div>'
            }
          </div>
        </div>
      </div>
    `,
  })
}

function renderWorkbenchSection(): string {
  const activeUsage = getActiveUsage()
  const selectedBag = getSelectedBag()
  const selectedTask = getSelectedSewingTask()
  const candidateTickets = getCandidateTickets()
  const currentBindings = activeUsage ? getViewModel().bindingsByUsageId[activeUsage.usageId] || [] : []
  const currentSummary = activeUsage ? buildTransferBagParentChildSummary(currentBindings) : null
  const capacityExceeded = Boolean(activeUsage && selectedBag && currentSummary && currentSummary.ticketCount > selectedBag.capacity)

  return `
    <section class="grid gap-3 xl:grid-cols-[1.1fr,0.9fr]">
      <article class="space-y-3 rounded-lg border bg-card p-3">
        <div>
          <h2 class="text-sm font-semibold text-foreground">当前使用周期工作区</h2>
        </div>
        <div class="grid gap-3 md:grid-cols-2">
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">步骤 1：选择口袋</span>
            <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-workbench-field="bagId">
              <option value="">请选择口袋</option>
              ${getViewModel().masters
                .map(
                  (item) => `<option value="${escapeHtml(item.bagId)}" ${state.draft.bagId === item.bagId ? 'selected' : ''}>${escapeHtml(`${item.bagCode} / ${item.statusMeta.label}`)}</option>`,
                )
                .join('')}
            </select>
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">步骤 1：扫中转袋码</span>
            <div class="flex gap-2">
              <input
                type="text"
                value="${escapeHtml(state.draft.bagCodeInput)}"
                placeholder="输入或扫描中转袋码"
                class="h-10 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                data-transfer-bags-workbench-field="bagCodeInput"
              />
              <button type="button" class="rounded-md border px-3 text-xs hover:bg-muted" data-transfer-bags-action="match-bag-code">匹配</button>
            </div>
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">绑定车缝任务</span>
            <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-workbench-field="sewingTaskId">
              <option value="">请选择车缝任务</option>
              ${getViewModel().sewingTasks
                .map(
                  (item) => `<option value="${escapeHtml(item.sewingTaskId)}" ${state.draft.sewingTaskId === item.sewingTaskId ? 'selected' : ''}>${escapeHtml(`${item.sewingTaskNo} / ${formatFactoryDisplayName(item.sewingFactoryName)} / ${item.styleCode || item.spuCode}`)}</option>`,
                )
                .join('')}
            </select>
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">备注</span>
            <input
              type="text"
                value="${escapeHtml(state.draft.note)}"
                placeholder="填写本次装袋备注"
              class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              data-transfer-bags-workbench-field="note"
            />
          </label>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="create-usage">开始装袋</button>
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="clear-draft">清空工作台</button>
          ${candidateTickets.length ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="import-prefill">导入候选菲票（${candidateTickets.length}）</button>` : ''}
        </div>
        ${renderCandidatePanel(candidateTickets)}
        <div class="grid gap-3 lg:grid-cols-[1fr,auto]">
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">步骤 2：扫菲票码</span>
            <input
              type="text"
              value="${escapeHtml(state.draft.ticketInput)}"
              placeholder="输入或扫描菲票码"
              class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              data-transfer-bags-workbench-field="ticketInput"
            />
          </label>
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted lg:self-end" data-transfer-bags-action="bind-ticket">绑定父子码</button>
        </div>
      </article>
      <article class="space-y-3 rounded-lg border bg-card p-3">
        <div>
          <h2 class="text-sm font-semibold text-foreground">当前口袋使用周期摘要</h2>
        </div>
        ${activeUsage
          ? `
            <div class="grid gap-3 md:grid-cols-2">
              <div class="space-y-2 rounded-lg border bg-muted/15 p-3 text-sm">
                <div><span class="text-muted-foreground">使用周期号：</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.usageNo)}</span></div>
                <div><span class="text-muted-foreground">中转袋码：</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.bagCode)}</span></div>
                <div><span class="text-muted-foreground">当前锁定款号：</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.styleCode || '待锁定')}</span></div>
                <div><span class="text-muted-foreground">车缝任务：</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.sewingTaskNo)}</span></div>
                <div><span class="text-muted-foreground">车缝工厂：</span><span class="font-medium text-foreground">${escapeHtml(formatFactoryDisplayName(activeUsage.sewingFactoryName))}</span></div>
                <div><span class="text-muted-foreground">状态：</span>${renderTag(activeUsage.statusMeta.label, activeUsage.statusMeta.className)}</div>
              </div>
              <div class="space-y-2 rounded-lg border bg-muted/15 p-3 text-sm">
                <div><span class="text-muted-foreground">已绑定菲票数量：</span><span class="font-medium text-foreground">${escapeHtml(String(currentSummary?.ticketCount || 0))}</span></div>
                <div><span class="text-muted-foreground">当前袋内成衣件数（件）：</span><span class="font-medium text-foreground">${escapeHtml(String(currentSummary?.quantityTotal || 0))}</span></div>
                <div><span class="text-muted-foreground">裁片单数：</span><span class="font-medium text-foreground">${escapeHtml(String(currentSummary?.cutOrderCount || 0))}</span></div>
                <div><span class="text-muted-foreground">生产单数：</span><span class="font-medium text-foreground">${escapeHtml(String(currentSummary?.productionOrderCount || 0))}</span></div>
                <div><span class="text-muted-foreground">唛架方案汇总：</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.markerPlanNos.join(' / ') || '无')}</span></div>
                <div><span class="text-muted-foreground">容量状态：</span><span class="font-medium ${capacityExceeded ? 'text-amber-700' : 'text-foreground'}">${capacityExceeded ? '已超容量' : '未超容量'}</span></div>
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="print-manifest" data-usage-id="${escapeHtml(activeUsage.usageId)}">打印中转袋二维码</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="mark-ready" data-usage-id="${escapeHtml(activeUsage.usageId)}">完成装袋</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="mark-dispatched" data-usage-id="${escapeHtml(activeUsage.usageId)}">交出</button>
            </div>
            <div class="rounded-lg border">
              <div class="border-b px-3 py-2 text-xs font-medium text-muted-foreground">袋内菲票明细</div>
              ${currentBindings.length
                ? renderStickyTableScroller(`
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
                          <th class="px-3 py-2 text-left">${PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE}</th>
                          <th class="px-3 py-2 text-left">唛架方案</th>
                          <th class="px-3 py-2 text-left">菲票状态</th>
                          <th class="px-3 py-2 text-left">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${currentBindings
                          .map(
                            (binding) => `
                              <tr class="border-b bg-card">
                                <td class="px-3 py-2">${escapeHtml(binding.ticketNo)}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.fabricRollNo || binding.ticket?.fabricRollNo || '暂无数据')}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.fabricColor || binding.ticket?.fabricColor || '暂无数据')}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.size || binding.ticket?.size || '暂无数据')}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.partName || binding.ticket?.partName || '待补部位')}</td>
                                <td class="px-3 py-2 text-right tabular-nums">${escapeHtml(String(binding.qty))}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.bundleNo || binding.ticket?.bundleNo || '暂无数据')}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.cutOrderNo)}</td>
                                <td class="px-3 py-2">${renderProductionOrderIdentityCell(binding.productionOrderNo)}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.markerPlanNo || binding.唛架方案No || '无')}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.ticket?.ticketStatus === 'VOIDED' ? '已作废' : '有效')}</td>
                                <td class="px-3 py-2">
                                  ${
                                    binding.removable
                                      ? `<button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-transfer-bags-action="remove-binding" data-binding-id="${escapeHtml(binding.bindingId)}">移除未锁定菲票</button>`
                                      : '<span class="text-xs text-muted-foreground">当前阶段不可移除</span>'
                                  }
                                </td>
                              </tr>
                            `,
                          )
                          .join('')}
                      </tbody>
                    </table>
                  `, 'max-h-[28vh]')
                : '<div class="px-3 py-8 text-center text-sm text-muted-foreground">当前使用周期暂无已绑定菲票。</div>'}
            </div>
          `
          : '<div class="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">当前尚未选中使用周期。请先创建或从交出台账中选择一个使用周期。</div>'}
      </article>
    </section>
  `
}

function renderCandidatePanel(candidates: TransferBagTicketCandidate[]): string {
  if (!candidates.length) return ''
  return renderWorkbenchSecondaryPanel({
    title: '候选菲票预填',
    hint: '',
    countText: `${candidates.length} 张`,
    defaultOpen: true,
    body: `
      <div class="flex flex-wrap gap-2">
        ${candidates
          .map((item) => renderWorkbenchFilterChip(`${item.ticketNo} / ${item.cutOrderNo}`, 'data-transfer-bags-action="set-ticket-input" data-ticket-no="' + escapeHtml(item.ticketNo) + '"', 'blue'))
          .join('')}
      </div>
    `,
  })
}

function renderUsageLedgerSection(): string {
  const usages = getFilteredUsages()
  const activeUsage = getActiveUsage()
  return `
    <section class="space-y-3 rounded-lg border bg-card p-3">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold text-foreground">交出台账</h2>
        </div>
      </div>
      ${renderStickyFilterShell(`
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label class="space-y-2 xl:col-span-2">
            <span class="text-sm font-medium text-foreground">关键词</span>
            <input
              type="text"
              value="${escapeHtml(state.usageKeyword)}"
              placeholder="支持使用周期号 / 中转袋码 / 车缝任务号 / 裁片单"
              class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              data-transfer-bags-usage-field="keyword"
            />
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">使用周期状态</span>
            <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-usage-field="status">
              <option value="ALL" ${state.usageStatus === 'ALL' ? 'selected' : ''}>全部</option>
              <option value="DRAFT" ${state.usageStatus === 'DRAFT' ? 'selected' : ''}>草稿</option>
              <option value="PACKING" ${state.usageStatus === 'PACKING' ? 'selected' : ''}>装袋中</option>
              <option value="READY_TO_DISPATCH" ${state.usageStatus === 'READY_TO_DISPATCH' ? 'selected' : ''}>待交出</option>
              <option value="DISPATCHED" ${state.usageStatus === 'DISPATCHED' ? 'selected' : ''}>已交出待回收</option>
              <option value="CLOSED" ${state.usageStatus === 'CLOSED' ? 'selected' : ''}>已关闭</option>
              <option value="SCRAP_CLOSED" ${state.usageStatus === 'SCRAP_CLOSED' ? 'selected' : ''}>报废关闭</option>
            </select>
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">车缝任务</span>
            <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-usage-field="sewingTask">
              <option value="ALL" ${state.usageSewingTaskId === 'ALL' ? 'selected' : ''}>全部</option>
              ${getViewModel().sewingTasks
                .map(
                  (item) => `<option value="${escapeHtml(item.sewingTaskId)}" ${state.usageSewingTaskId === item.sewingTaskId ? 'selected' : ''}>${escapeHtml(item.sewingTaskNo)}</option>`,
                )
                .join('')}
            </select>
          </label>
        </div>
      `)}
      ${!usages.length
        ? '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">暂无使用周期台账</div>'
        : renderStickyTableScroller(`
            <table class="min-w-full text-sm">
              <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left">使用周期号</th>
                  <th class="px-4 py-3 text-left">中转袋码</th>
                  <th class="px-4 py-3 text-left">阶段 / 车缝任务</th>
                  <th class="px-4 py-3 text-left">车缝工厂</th>
                  <th class="px-4 py-3 text-right">菲票数量</th>
                  <th class="px-4 py-3 text-right">裁片单数</th>
                  <th class="px-4 py-3 text-left">使用周期状态</th>
                  <th class="px-4 py-3 text-left">交出时间</th>
                  <th class="px-4 py-3 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                ${usages
                  .map(
                    (item) => `
                      <tr class="border-b ${state.activeUsageId === item.usageId ? 'bg-blue-50/60' : 'bg-card'}">
                        <td class="px-4 py-3">
                          <button type="button" class="font-medium text-blue-700 hover:underline" data-transfer-bags-action="select-usage" data-usage-id="${escapeHtml(item.usageId)}">${escapeHtml(item.usageNo)}</button>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.note || '无备注')}</div>
                        </td>
                        <td class="px-4 py-3">${escapeHtml(item.bagCode)}</td>
                        <td class="px-4 py-3">
                          <div class="font-medium text-foreground">${escapeHtml(item.usageStageLabel || '交出装袋')}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.sewingTaskNo || (item.usageStage === 'INBOUND_TEMP' ? '待分配' : '未绑定'))}</div>
                        </td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(formatFactoryDisplayName(item.sewingFactoryName))}</td>
                        <td class="px-4 py-3 text-right tabular-nums">${escapeHtml(String(item.summary.ticketCount))}</td>
                        <td class="px-4 py-3 text-right tabular-nums">${escapeHtml(String(item.summary.cutOrderCount))}</td>
                        <td class="px-4 py-3">${renderTag(item.statusMeta.label, item.statusMeta.className)}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.dispatchAt || '待交出')}</td>
                        <td class="px-4 py-3">
                          <div class="flex flex-wrap gap-2">
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="select-usage" data-usage-id="${escapeHtml(item.usageId)}">查看详情</button>
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="print-manifest" data-usage-id="${escapeHtml(item.usageId)}">打印中转袋二维码</button>
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="mark-dispatched" data-usage-id="${escapeHtml(item.usageId)}">标记交出</button>
                          </div>
                        </td>
                      </tr>
                    `,
                  )
                  .join('')}
              </tbody>
            </table>
          `)}
      ${renderUsageDetail(activeUsage)}
    </section>
  `
}

function renderUsageDetail(item: TransferBagUsageItem | null): string {
  if (!item) return ''
  const auditTrail = (getViewModel().auditTrailByUsageId[item.usageId] || []).slice().sort((left, right) => right.actionAt.localeCompare(left.actionAt, 'zh-CN'))
  return renderWorkbenchSecondaryPanel({
    title: `使用周期详情：${item.usageNo}`,
    hint: '',
    countText: `${item.summary.ticketCount} 张票 / ${item.summary.cutOrderCount} 个裁片单`,
    defaultOpen: true,
    body: `
      <div class="grid gap-3 xl:grid-cols-[0.9fr,1.1fr]">
        <div class="space-y-3 rounded-lg border bg-muted/15 p-3 text-sm">
          <div><span class="text-muted-foreground">中转袋码：</span><span class="font-medium text-foreground">${escapeHtml(item.bagCode)}</span></div>
          <div><span class="text-muted-foreground">车缝任务：</span><span class="font-medium text-foreground">${escapeHtml(item.sewingTaskNo)}</span></div>
          <div><span class="text-muted-foreground">车缝工厂：</span><span class="font-medium text-foreground">${escapeHtml(formatFactoryDisplayName(item.sewingFactoryName))}</span></div>
          <div><span class="text-muted-foreground">菲票数量：</span><span class="font-medium text-foreground">${escapeHtml(String(item.summary.ticketCount))}</span></div>
          <div><span class="text-muted-foreground">生产单数：</span><span class="font-medium text-foreground">${escapeHtml(String(item.summary.productionOrderCount))}</span></div>
          <div><span class="text-muted-foreground">最新清单：</span><span class="font-medium text-foreground">${escapeHtml(item.latestManifest?.manifestId || '尚未打印')}</span></div>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="go-cut-orders" data-usage-id="${escapeHtml(item.usageId)}">去来源裁片单</button>
            <button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="go-summary" data-usage-id="${escapeHtml(item.usageId)}">去裁剪结果核查</button>
          </div>
        </div>
        <div class="space-y-3 rounded-lg border bg-muted/15 p-3">
          <div>
            <h3 class="text-sm font-semibold text-foreground">动作审计</h3>
          </div>
          ${auditTrail.length
            ? `<div class="space-y-2">${auditTrail
                .map(
                  (audit) => `
                    <article class="rounded-md border bg-card px-3 py-2 text-sm">
                      <div class="flex items-center justify-between gap-3">
                        <p class="font-medium text-foreground">${escapeHtml(audit.action)}</p>
                        <p class="text-xs text-muted-foreground">${escapeHtml(formatDateTime(audit.actionAt))}</p>
                      </div>
                      <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(audit.actionBy)}</p>
                      <p class="mt-1 text-sm text-foreground">${escapeHtml(audit.note)}</p>
                    </article>
                  `,
                )
                .join('')}</div>`
            : '<div class="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">暂无审计记录</div>'}
        </div>
      </div>
    `,
  })
}

function renderReturnLedgerSection(): string {
  const items = getFilteredReturnUsages()
  return `
    <section class="space-y-3 rounded-lg border bg-card p-3">
      <div>
        <h2 class="text-sm font-semibold text-foreground">已交出待回收使用周期列表</h2>
      </div>
      ${renderStickyFilterShell(`
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label class="space-y-2 xl:col-span-3">
            <span class="text-sm font-medium text-foreground">关键词</span>
            <input
              type="text"
              value="${escapeHtml(state.returnKeyword)}"
              placeholder="支持使用周期号 / 中转袋码 / 车缝任务号 / 裁片单号"
              class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              data-transfer-bags-return-field="keyword"
            />
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">回收状态</span>
            <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-field="status">
              <option value="ALL" ${state.returnStatus === 'ALL' ? 'selected' : ''}>全部</option>
              <option value="WAITING_RETURN" ${state.returnStatus === 'WAITING_RETURN' ? 'selected' : ''}>已交出待回收</option>
              <option value="RETURN_INSPECTING" ${state.returnStatus === 'RETURN_INSPECTING' ? 'selected' : ''}>回收确认中</option>
              <option value="CLOSED" ${state.returnStatus === 'CLOSED' ? 'selected' : ''}>已关闭</option>
              <option value="SCRAP_CLOSED" ${state.returnStatus === 'SCRAP_CLOSED' ? 'selected' : ''}>报废关闭</option>
            </select>
          </label>
        </div>
      `)}
      ${!items.length
        ? '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">暂无已交出待回收使用周期</div>'
        : renderStickyTableScroller(`
            <table class="min-w-full text-sm">
              <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left">使用周期号</th>
                  <th class="px-4 py-3 text-left">中转袋码</th>
                  <th class="px-4 py-3 text-left">车缝任务号</th>
                  <th class="px-4 py-3 text-left">车缝工厂</th>
                  <th class="px-4 py-3 text-left">交出时间</th>
                  <th class="px-4 py-3 text-left">使用周期状态</th>
                  <th class="px-4 py-3 text-left">口袋状态</th>
                  <th class="px-4 py-3 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                ${items
                  .map(
                    (item) => `
                      <tr class="border-b ${state.activeUsageId === item.usageId ? 'bg-orange-50/60' : 'bg-card'}">
                        <td class="px-4 py-3">
                          <button type="button" class="font-medium text-blue-700 hover:underline" data-transfer-bags-action="prepare-return" data-usage-id="${escapeHtml(item.usageId)}">${escapeHtml(item.usageNo)}</button>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.latestReturnReceipt?.returnAt || '尚未创建回收草稿')}</div>
                        </td>
                        <td class="px-4 py-3">${escapeHtml(item.bagCode)}</td>
                        <td class="px-4 py-3">${escapeHtml(item.sewingTaskNo)}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(formatFactoryDisplayName(item.sewingFactoryName))}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.dispatchAt || '待交出')}</td>
                        <td class="px-4 py-3">${renderTag(item.statusMeta.label, item.statusMeta.className)}</td>
                        <td class="px-4 py-3">${item.bagStatusMeta ? renderTag(item.bagStatusMeta.label, item.bagStatusMeta.className) : '<span class="text-xs text-muted-foreground">待补</span>'}</td>
                        <td class="px-4 py-3">
                          <div class="flex flex-wrap gap-2">
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="prepare-return" data-usage-id="${escapeHtml(item.usageId)}">回收确认</button>
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="select-usage" data-usage-id="${escapeHtml(item.usageId)}">查看详情</button>
                          </div>
                        </td>
                      </tr>
                    `,
                  )
                  .join('')}
              </tbody>
            </table>
          `)}
    </section>
  `
}

function renderReturnWorkbenchSection(): string {
  const activeUsage = state.activeUsageId ? getReturnViewModel().waitingReturnUsages.find((item) => item.usageId === state.activeUsageId) || null : null
  const decisionMeta = deriveBagConditionDecision({
    conditionStatus: state.conditionDraft.conditionStatus,
    cleanlinessStatus: state.conditionDraft.cleanlinessStatus,
    damageType: state.conditionDraft.damageType,
    repairNeeded: state.conditionDraft.repairNeeded,
  })
  const discrepancyMeta = buildReturnDiscrepancyMeta(state.returnDraft.discrepancyType)

  return `
    <section class="grid gap-3 xl:grid-cols-[1.15fr,0.85fr]">
      <article class="space-y-3 rounded-lg border bg-card p-3">
        <div>
          <h2 class="text-sm font-semibold text-foreground">回收确认工作区</h2>
        </div>
        ${activeUsage
          ? `
            <div class="grid gap-3 md:grid-cols-2">
              <div class="space-y-2 rounded-lg border bg-muted/15 p-3 text-sm">
                <div><span class="text-muted-foreground">使用周期号：</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.usageNo)}</span></div>
                <div><span class="text-muted-foreground">中转袋码：</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.bagCode)}</span></div>
                <div><span class="text-muted-foreground">车缝任务：</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.sewingTaskNo)}</span></div>
                <div><span class="text-muted-foreground">当前状态：</span>${renderTag(activeUsage.statusMeta.label, activeUsage.statusMeta.className)}</div>
                <div><span class="text-muted-foreground">口袋状态：</span>${activeUsage.bagStatusMeta ? renderTag(activeUsage.bagStatusMeta.label, activeUsage.bagStatusMeta.className) : '<span class="text-xs text-muted-foreground">待补</span>'}</div>
              </div>
              <div class="space-y-2 rounded-lg border bg-muted/15 p-3 text-sm">
                <div><span class="text-muted-foreground">菲票数量：</span><span class="font-medium text-foreground">${escapeHtml(String(activeUsage.summary.ticketCount))}</span></div>
                <div><span class="text-muted-foreground">裁片单数：</span><span class="font-medium text-foreground">${escapeHtml(String(activeUsage.summary.cutOrderCount))}</span></div>
                <div><span class="text-muted-foreground">生产单数：</span><span class="font-medium text-foreground">${escapeHtml(String(activeUsage.summary.productionOrderCount))}</span></div>
                <div><span class="text-muted-foreground">回收资格：</span><span class="font-medium ${activeUsage.returnEligibility.ok ? 'text-emerald-700' : 'text-amber-700'}">${escapeHtml(activeUsage.returnEligibility.ok ? '可进入回收确认' : activeUsage.returnEligibility.reason)}</span></div>
              </div>
            </div>
            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">回收仓 / 回收点</span>
                <input type="text" value="${escapeHtml(state.returnDraft.returnWarehouseName)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="returnWarehouseName" />
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">回收时间</span>
                <input type="text" value="${escapeHtml(state.returnDraft.returnAt)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="returnAt" />
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">回收人</span>
                <input type="text" value="${escapeHtml(state.returnDraft.returnedBy)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="returnedBy" />
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">回收确认人</span>
                <input type="text" value="${escapeHtml(state.returnDraft.receivedBy)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="receivedBy" />
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">回收成衣件数摘要（件）</span>
                <input type="number" value="${escapeHtml(state.returnDraft.returnedFinishedQty)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="returnedFinishedQty" />
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">回收菲票数量摘要</span>
                <input type="number" value="${escapeHtml(state.returnDraft.returnedTicketCountSummary)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="returnedTicketCountSummary" />
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">差异类型</span>
                <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="discrepancyType">
                  <option value="NONE" ${state.returnDraft.discrepancyType === 'NONE' ? 'selected' : ''}>无差异</option>
                  <option value="QTY_MISMATCH" ${state.returnDraft.discrepancyType === 'QTY_MISMATCH' ? 'selected' : ''}>件数差异</option>
                  <option value="DAMAGED_BAG" ${state.returnDraft.discrepancyType === 'DAMAGED_BAG' ? 'selected' : ''}>口袋损坏</option>
                  <option value="LATE_RETURN" ${state.returnDraft.discrepancyType === 'LATE_RETURN' ? 'selected' : ''}>迟归还</option>
                  <option value="MISSING_RECORD" ${state.returnDraft.discrepancyType === 'MISSING_RECORD' ? 'selected' : ''}>缺记录</option>
                </select>
              </label>
              <label class="space-y-2 xl:col-span-1">
                <span class="text-sm font-medium text-foreground">差异说明</span>
                <input type="text" value="${escapeHtml(state.returnDraft.discrepancyNote)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="discrepancyNote" />
              </label>
            </div>
            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">袋况</span>
                <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-condition-field="conditionStatus">
                  <option value="GOOD" ${state.conditionDraft.conditionStatus === 'GOOD' ? 'selected' : ''}>完好</option>
                  <option value="MINOR_DAMAGE" ${state.conditionDraft.conditionStatus === 'MINOR_DAMAGE' ? 'selected' : ''}>轻微损坏</option>
                  <option value="SEVERE_DAMAGE" ${state.conditionDraft.conditionStatus === 'SEVERE_DAMAGE' ? 'selected' : ''}>严重损坏</option>
                </select>
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">洁净情况</span>
                <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-condition-field="cleanlinessStatus">
                  <option value="CLEAN" ${state.conditionDraft.cleanlinessStatus === 'CLEAN' ? 'selected' : ''}>干净</option>
                  <option value="DIRTY" ${state.conditionDraft.cleanlinessStatus === 'DIRTY' ? 'selected' : ''}>已记录袋况</option>
                </select>
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">损坏说明</span>
                <input type="text" value="${escapeHtml(state.conditionDraft.damageType)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-condition-field="damageType" />
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">回收结果</span>
                <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-condition-field="reusableDecision">
                  <option value="REUSABLE" ${state.conditionDraft.reusableDecision === 'REUSABLE' ? 'selected' : ''}>可继续使用</option>
                  <option value="WAITING_CLEANING" ${state.conditionDraft.reusableDecision === 'WAITING_CLEANING' ? 'selected' : ''}>可继续使用</option>
                  <option value="WAITING_REPAIR" ${state.conditionDraft.reusableDecision === 'WAITING_REPAIR' ? 'selected' : ''}>可继续使用</option>
                  <option value="DISABLED" ${state.conditionDraft.reusableDecision === 'DISABLED' ? 'selected' : ''}>报废</option>
                </select>
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">维修需求</span>
                <label class="flex h-10 items-center gap-2 rounded-md border bg-background px-3 text-sm">
                  <input type="checkbox" ${state.conditionDraft.repairNeeded ? 'checked' : ''} data-transfer-bags-condition-toggle="repairNeeded" />
                <span>记录袋况</span>
                </label>
              </label>
              <label class="space-y-2 md:col-span-2 xl:col-span-5">
                <span class="text-sm font-medium text-foreground">袋况备注</span>
                <input type="text" value="${escapeHtml(state.conditionDraft.note)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-condition-field="note" />
              </label>
            </div>
            <div class="rounded-lg border bg-muted/15 p-3 text-sm">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-muted-foreground">自动建议：</span>
                ${renderTag(decisionMeta.label, decisionMeta.className)}
                ${discrepancyMeta ? renderTag(discrepancyMeta.label, discrepancyMeta.className) : ''}
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="prepare-return" data-usage-id="${escapeHtml(activeUsage.usageId)}">创建回收草稿</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="complete-return-inspection" data-usage-id="${escapeHtml(activeUsage.usageId)}">完成回收</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="close-usage-cycle" data-usage-id="${escapeHtml(activeUsage.usageId)}">关闭使用周期</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="clear-return-draft">重置回收草稿</button>
            </div>
          `
          : '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">请先选择一个已交出待回收使用周期</div>'}
      </article>
      <article class="space-y-3 rounded-lg border bg-card p-3">
        <div>
          <h2 class="text-sm font-semibold text-foreground">袋况与报废处理</h2>
        </div>
        ${renderConditionSection()}
      </article>
    </section>
  `
}

function renderReuseCycleSection(): string {
  const cycles = getReturnViewModel().reuseCycles
  return `
    <section class="space-y-3 rounded-lg border bg-card p-3">
      <div>
        <h2 class="text-sm font-semibold text-foreground">使用周期台账</h2>
      </div>
      ${!cycles.length
        ? '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">当前尚无使用周期台账。</div>'
        : renderStickyTableScroller(`
            <table class="min-w-full text-sm">
              <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left">中转袋码</th>
                  <th class="px-4 py-3 text-right">总使用次数</th>
                  <th class="px-4 py-3 text-right">总交出次数</th>
                  <th class="px-4 py-3 text-right">总回收次数</th>
                  <th class="px-4 py-3 text-left">最近交出</th>
                  <th class="px-4 py-3 text-left">最近回收</th>
                  <th class="px-4 py-3 text-left">当前状态</th>
                  <th class="px-4 py-3 text-left">当前位置</th>
                  <th class="px-4 py-3 text-left">最新使用周期号</th>
                </tr>
              </thead>
              <tbody>
                ${cycles
                  .map(
                    (item) => `
                      <tr class="border-b bg-card">
                        <td class="px-4 py-3 font-medium text-foreground">${escapeHtml(item.bagCode)}</td>
                        <td class="px-4 py-3 text-right tabular-nums">${escapeHtml(String(item.totalUsageCount))}</td>
                        <td class="px-4 py-3 text-right tabular-nums">${escapeHtml(String(item.totalDispatchCount))}</td>
                        <td class="px-4 py-3 text-right tabular-nums">${escapeHtml(String(item.totalReturnCount))}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.lastDispatchedAt || '暂无')}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.lastReturnedAt || '暂无')}</td>
                        <td class="px-4 py-3">${renderTag(item.bagStatusMeta.label, item.bagStatusMeta.className)}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.currentLocation || '待补')}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.latestUsageNo || '暂无')}</td>
                      </tr>
                    `,
                  )
                  .join('')}
              </tbody>
            </table>
          `)}
    </section>
  `
}

function renderConditionSection(): string {
  const items = getReturnViewModel().conditionItems.slice(0, 8)
  if (!items.length) {
    return '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">暂无袋况记录</div>'
  }

  return renderStickyTableScroller(`
    <table class="min-w-full text-sm">
      <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
        <tr>
          <th class="px-4 py-3 text-left">中转袋码</th>
          <th class="px-4 py-3 text-left">最新使用周期号</th>
          <th class="px-4 py-3 text-left">袋况</th>
          <th class="px-4 py-3 text-left">报废记录</th>
          <th class="px-4 py-3 text-left">报废说明</th>
          <th class="px-4 py-3 text-left">回收结果</th>
          <th class="px-4 py-3 text-left">处理建议</th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map(
            (item) => `
              <tr class="border-b bg-card">
                <td class="px-4 py-3">${escapeHtml(item.bagCode)}</td>
                <td class="px-4 py-3">${escapeHtml(item.latestUsage?.usageNo || '待补')}</td>
                <td class="px-4 py-3">${escapeHtml(item.conditionStatus === 'GOOD' ? '完好' : item.conditionStatus === 'MINOR_DAMAGE' ? '轻微破损' : '报废')}</td>
                <td class="px-4 py-3">${escapeHtml(item.cleanlinessStatus === 'CLEAN' ? '无' : '已记录')}</td>
                <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.损坏说明 || '无')}</td>
                <td class="px-4 py-3">${renderTag(item.decisionMeta.label, item.decisionMeta.className)}</td>
                <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.returnDiscrepancyMeta?.label || item.decisionMeta.detailText)}</td>
              </tr>
            `,
          )
          .join('')}
      </tbody>
    </table>
  `, 'max-h-[28vh]')
}

function renderReturnAuditSection(): string {
  const currentUsageId = state.activeUsageId
  const allAudits = Object.values(getReturnViewModel().returnAuditTrailByUsageId)
    .flat()
    .sort((left, right) => right.actionAt.localeCompare(left.actionAt, 'zh-CN'))
  const audits = currentUsageId ? (getReturnViewModel().returnAuditTrailByUsageId[currentUsageId] || []).slice().sort((left, right) => right.actionAt.localeCompare(left.actionAt, 'zh-CN')) : allAudits

  return `
    <section class="space-y-3 rounded-lg border bg-card p-3">
      <div>
        <h2 class="text-sm font-semibold text-foreground">回货审计记录</h2>
      </div>
      ${audits.length
        ? `<div class="space-y-2">${audits
            .slice(0, 10)
            .map(
              (audit) => `
                <article class="rounded-lg border bg-muted/15 px-3 py-2 text-sm">
                  <div class="flex items-center justify-between gap-3">
                    <p class="font-medium text-foreground">${escapeHtml(audit.action)}</p>
                    <p class="text-xs text-muted-foreground">${escapeHtml(formatDateTime(audit.actionAt))}</p>
                  </div>
                  <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(audit.actionBy)}</p>
                  <p class="mt-1 text-sm text-foreground">${escapeHtml(audit.payloadSummary)}</p>
                  <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(audit.note)}</p>
                </article>
              `,
            )
            .join('')}</div>`
        : '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">暂无回货审计记录</div>'}
    </section>
  `
}

function renderBindingSection(): string {
  const bindings = getFilteredBindings()
  return `
    <section class="space-y-3 rounded-lg border bg-card p-3">
        <div>
          <h2 class="text-sm font-semibold text-foreground">父子码映射明细</h2>
        </div>
      ${renderStickyFilterShell(`
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">关键词</span>
          <input
            type="text"
            value="${escapeHtml(state.bindingKeyword)}"
            placeholder="支持中转袋码 / 菲票码 / 裁片单号 / 唛架方案号"
            class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            data-transfer-bags-binding-field="keyword"
          />
        </label>
      `)}
      ${!bindings.length
        ? '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">暂无父子码映射</div>'
        : renderStickyTableScroller(`
            <table class="min-w-full text-sm">
              <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left">中转袋码</th>
                  <th class="px-4 py-3 text-left">使用周期号</th>
                  <th class="px-4 py-3 text-left">菲票码</th>
                  <th class="px-4 py-3 text-left">面料卷号</th>
                  <th class="px-4 py-3 text-left">布料颜色</th>
                  <th class="px-4 py-3 text-left">尺码</th>
                  <th class="px-4 py-3 text-left">裁片部位</th>
                  <th class="px-4 py-3 text-left">数量</th>
                  <th class="px-4 py-3 text-left">扎号</th>
                  <th class="px-4 py-3 text-left">裁片单号</th>
                  <th class="px-4 py-3 text-left">${PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE}</th>
                  <th class="px-4 py-3 text-left">唛架方案号</th>
                  <th class="px-4 py-3 text-left">绑定时间</th>
                  <th class="px-4 py-3 text-left">绑定人</th>
                  <th class="px-4 py-3 text-left">备注</th>
                </tr>
              </thead>
              <tbody>
                ${bindings
                  .map(
                    (item) => `
                      <tr class="border-b bg-card">
                        <td class="px-4 py-3">${escapeHtml(item.bagCode)}</td>
                        <td class="px-4 py-3">${escapeHtml(item.usage?.usageNo || '待补')}</td>
                        <td class="px-4 py-3">${escapeHtml(item.ticketNo)}</td>
                        <td class="px-4 py-3">${escapeHtml(item.fabricRollNo || item.ticket?.fabricRollNo || '暂无数据')}</td>
                        <td class="px-4 py-3">${escapeHtml(item.fabricColor || item.ticket?.fabricColor || '暂无数据')}</td>
                        <td class="px-4 py-3">${escapeHtml(item.size || item.ticket?.size || '暂无数据')}</td>
                        <td class="px-4 py-3">${escapeHtml(item.partName || item.ticket?.partName || '暂无数据')}</td>
                        <td class="px-4 py-3">${escapeHtml(String(item.garmentQty || item.qty || 0))}</td>
                        <td class="px-4 py-3">${escapeHtml(item.bundleNo || item.ticket?.bundleNo || '暂无数据')}</td>
                        <td class="px-4 py-3">${escapeHtml(item.cutOrderNo)}</td>
                        <td class="px-4 py-3">${renderProductionOrderIdentityCell(item.productionOrderNo)}</td>
                        <td class="px-4 py-3">${escapeHtml(item.markerPlanNo || item.唛架方案No || '无')}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(formatDateTime(item.boundAt))}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.boundBy)}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.note || '无')}</td>
                      </tr>
                    `,
                  )
                  .join('')}
              </tbody>
            </table>
          `)}
    </section>
  `
}

function renderListPage(): string {
  syncPrefilterFromQuery()
  if (isTransferBagDetailPage()) return renderDetailPage()
  const meta = getCanonicalCuttingMeta(getCurrentTransferBagPathname(), 'transfer-bags')
  return `
    <div class="space-y-3 p-4">
      ${renderCuttingPageHeader(meta, { actionsHtml: renderListHeaderActions() })}
      ${renderPrefilterBar()}
      ${renderLandingBanner()}
      ${renderFeedbackBar()}
      ${renderActiveListFilterBar()}
      ${renderActiveListStats()}
      ${renderMasterSection()}
      ${renderActiveDialog()}
    </div>
  `
}


function syncMasterSelection(masterId: string): void {
  const master = getViewModel().mastersById[masterId]
  if (!master) return
  state.activeMasterId = masterId
  state.draft.bagId = master.bagId
  state.draft.bagCodeInput = master.bagCode
  if (master.currentUsage) {
    syncUsageSelection(master.currentUsage.usageId)
  }
}

function syncUsageSelection(usageId: string): void {
  const usage = getViewModel().usagesById[usageId]
  if (!usage) return
  state.activeUsageId = usageId
  state.activeMasterId = usage.bagId
  state.draft.bagId = usage.bagId
  state.draft.bagCodeInput = usage.bagCode
  state.draft.sewingTaskId = usage.sewingTaskId
  state.draft.note = usage.note
  resetReturnDraft(usageId)
}

function buildReturnReceiptFromState(usage: TransferBagUsage, bag: TransferBagMaster): TransferBagReturnReceipt {
  const bindings = getViewModel().bindingsByUsageId[usage.usageId] || []
  const summary = buildTransferBagParentChildSummary(bindings)
  return {
    returnReceiptId: `return-${usage.usageId}`,
    cycleId: usage.cycleId,
    cycleNo: usage.cycleNo,
    carrierId: bag.carrierId,
    carrierCode: bag.carrierCode,
    usageId: usage.usageId,
    usageNo: usage.usageNo,
    bagId: bag.bagId,
    bagCode: bag.bagCode,
    sewingTaskId: usage.sewingTaskId,
    sewingTaskNo: usage.sewingTaskNo,
    returnWarehouseName: state.returnDraft.returnWarehouseName.trim(),
    returnAt: state.returnDraft.returnAt.trim(),
    returnedBy: state.returnDraft.returnedBy.trim(),
    receivedBy: state.returnDraft.receivedBy.trim(),
    returnedFinishedQty: summary.quantityTotal,
    returnedTicketCountSummary: bindings.length,
    returnedCutOrderCount: uniqueStrings(bindings.map((item) => item.cutOrderNo)).length,
    discrepancyType: state.returnDraft.discrepancyType,
    discrepancyNote: state.returnDraft.discrepancyNote.trim(),
    note: state.returnDraft.note.trim(),
  }
}

function buildConditionRecordFromState(usage: TransferBagUsage, bag: TransferBagMaster): TransferBagConditionRecord {
  return {
    conditionRecordId: `condition-${usage.usageId}`,
    cycleId: usage.cycleId,
    carrierId: bag.carrierId,
    carrierCode: bag.carrierCode,
    usageId: usage.usageId,
    bagId: bag.bagId,
    bagCode: bag.bagCode,
    conditionStatus: state.conditionDraft.conditionStatus,
    cleanlinessStatus: state.conditionDraft.cleanlinessStatus,
    damageType: state.conditionDraft.damageType.trim(),
    repairNeeded: state.conditionDraft.repairNeeded,
    reusableDecision: state.conditionDraft.reusableDecision,
    inspectedAt: nowText(),
    inspectedBy: state.returnDraft.receivedBy.trim() || '中转袋工作台',
    note: state.conditionDraft.note.trim(),
  }
}

function getFilteredReturnUsages() {
  const keyword = state.returnKeyword.trim().toLowerCase()
  return getReturnViewModel().waitingReturnUsages.filter((item) => {
    const returnStatus = item.latestClosureResult?.closureStatus || item.usageStatus
    if (state.returnStatus !== 'ALL' && returnStatus !== state.returnStatus) return false
    if (state.prefilter?.returnStatus && returnStatus !== state.prefilter.returnStatus) return false
    if (keyword) {
      const haystack = [
        item.usageNo,
        item.bagCode,
        item.sewingTaskNo,
        item.sewingFactoryName,
        item.cutOrderNos.join(' '),
        item.ticketNos.join(' '),
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    return true
  })
}

function prepareReturnDraft(targetUsageId?: string): boolean {
  const usage = getSourceUsage(targetUsageId || state.activeUsageId)
  if (!usage) {
    setFeedback('warning', '请先选择一个已交出待回收使用周期。')
    return true
  }
  const bag = getSourceMaster(usage.bagId)
  const latestClosure = (getReturnViewModel().closureResultsByUsageId[usage.usageId] || []).slice().sort((left, right) => right.closedAt.localeCompare(left.closedAt, 'zh-CN'))[0] || null
  const eligibility = deriveReturnEligibility({ usage, bag, latestClosureResult: latestClosure })
  if (!eligibility.ok) {
    setFeedback('warning', eligibility.reason)
    return true
  }

  syncUsageSelection(usage.usageId)
  resetReturnDraft(usage.usageId)
  state.store.returnAuditTrail.push(
    buildBagReturnAuditTrail({
      cycleId: usage.cycleId,
      action: '回收登记',
      actionAt: nowText(),
      actionBy: '中转袋工作台',
      payloadSummary: `${usage.usageNo} 已进入回收流程`,
      note: '已打开回收登记表单，等待填写回收结果。',
    }),
  )
  refreshDerivedState()
  persistStore()
  setFeedback('success', `${usage.usageNo} 已带入回收确认。`)
  return true
}

function clearReturnDraft(): boolean {
  resetReturnDraft(state.activeUsageId)
  setFeedback('success', '回收确认草稿已重置。')
  return true
}

function completeReturnInspection(targetUsageId?: string): boolean {
  const usage = getSourceUsage(targetUsageId || state.activeUsageId)
  if (!usage) {
    setFeedback('warning', '请先选择一个使用周期，再填写回收确认信息。')
    return true
  }
  const bag = getSourceMaster(usage.bagId)
  if (!bag) {
    setFeedback('warning', '当前使用周期缺少中转袋主档，不能回收。')
    return true
  }

  const receipt = buildReturnReceiptFromState(usage, bag)
  const validation = validateReturnReceiptPayload({
    usage,
    bag,
    receipt,
  })
  if (!validation.ok) {
    setFeedback('warning', validation.reason)
    return true
  }

  const receiptIndex = state.store.returnReceipts.findIndex((item) => item.usageId === usage.usageId)
  if (receiptIndex >= 0) {
    state.store.returnReceipts[receiptIndex] = receipt
  } else {
    state.store.returnReceipts.push(receipt)
  }

  const condition = buildConditionRecordFromState(usage, bag)
  const conditionIndex = state.store.conditionRecords.findIndex((item) => item.usageId === usage.usageId)
  if (conditionIndex >= 0) {
    state.store.conditionRecords[conditionIndex] = condition
  } else {
    state.store.conditionRecords.push(condition)
  }

  const closure = closeTransferBagUsageCycle({
    usage,
    bag,
    receipt,
    condition,
    nowText: receipt.returnAt,
    closedBy: receipt.receivedBy || '中转袋工作台',
  })
  const closureIndex = state.store.closureResults.findIndex((item) => item.usageId === usage.usageId)
  if (closureIndex >= 0) {
    state.store.closureResults[closureIndex] = closure
  } else {
    state.store.closureResults.push(closure)
  }

  usage.usageStatus = closure.closureStatus
  usage.cycleStatus = closure.closureStatus
  usage.signoffStatus = usage.signoffStatus === 'SIGNED' ? usage.signoffStatus : 'SIGNED'
  usage.returnedAt = receipt.returnAt
  usage.returnedBy = receipt.returnedBy
  usage.returnWarehouseName = receipt.returnWarehouseName
  usage.note = closure.reason
  bag.currentStatus = closure.nextBagStatus === 'REUSABLE' ? 'IDLE' : closure.nextBagStatus
  bag.currentLocation = closure.nextBagStatus === 'DISABLED' ? '报废区' : receipt.returnWarehouseName

  state.store.returnAuditTrail.push(
    buildBagReturnAuditTrail({
      cycleId: usage.cycleId,
      action: '完成回收',
      actionAt: receipt.returnAt,
      actionBy: receipt.receivedBy,
      payloadSummary: `${receipt.bagCode} 已完成回收登记`,
      note: receipt.note || closure.reason,
    }),
  )

  refreshDerivedState()
  persistStore()
  closeActiveDialog()
  setFeedback(closure.closureStatus === 'SCRAP_CLOSED' ? 'warning' : 'success', `${usage.usageNo} 已完成回收，${bag.bagCode} 当前状态：${deriveTransferBagMasterStatus(bag.currentStatus).label}。`)
  return true
}

function closeUsageCycleAction(targetUsageId?: string): boolean {
  const usage = getSourceUsage(targetUsageId || state.activeUsageId)
  if (!usage) {
    setFeedback('warning', '请先选择一个使用周期。')
    return true
  }
  const bag = getSourceMaster(usage.bagId)
  if (!bag) {
    setFeedback('warning', '当前使用周期缺少口袋主档，不能关闭。')
    return true
  }
  const receipt = (getReturnViewModel().returnReceiptsByUsageId[usage.usageId] || []).slice().sort((left, right) => right.returnAt.localeCompare(left.returnAt, 'zh-CN'))[0] || null
  const condition = (getReturnViewModel().conditionRecordsByUsageId[usage.usageId] || []).slice().sort((left, right) => right.inspectedAt.localeCompare(left.inspectedAt, 'zh-CN'))[0] || null
  if (!receipt || !condition) {
    setFeedback('warning', '请先完成回货验收，再关闭使用周期。')
    return true
  }

  const closure = closeTransferBagUsageCycle({
    usage,
    bag,
    receipt,
    condition,
    nowText: nowText(),
    closedBy: receipt.receivedBy || '中转袋工作台',
  })
  const closureIndex = state.store.closureResults.findIndex((item) => item.usageId === usage.usageId)
  if (closureIndex >= 0) {
    state.store.closureResults[closureIndex] = closure
  } else {
    state.store.closureResults.push(closure)
  }

  usage.usageStatus = closure.closureStatus
  usage.cycleStatus = closure.closureStatus
  usage.note = closure.reason
  bag.currentStatus = closure.nextBagStatus === 'DISABLED' ? 'DISABLED' : 'IDLE'
  const nextBagVisibleLabel = closure.nextBagStatus === 'DISABLED' ? '报废' : '可用'
  bag.currentLocation = closure.nextBagStatus === 'DISABLED' ? '报废区' : '裁片仓空袋区'

  state.store.returnAuditTrail.push(
    buildBagReturnAuditTrail({
      cycleId: usage.cycleId,
      action: '关闭本次周转',
      actionAt: closure.closedAt,
      actionBy: closure.closedBy,
      payloadSummary: `${usage.usageNo} 已关闭，口袋 -> ${nextBagVisibleLabel}`,
      note: closure.reason,
    }),
  )

  refreshDerivedState()
  persistStore()
  setFeedback(
    closure.warningMessages.length ? 'warning' : 'success',
    closure.warningMessages.length
      ? `${usage.usageNo} 已报废关闭：${closure.warningMessages.join('；')}`
      : `${usage.usageNo} 已关闭，${bag.bagCode} 已返回“${nextBagVisibleLabel}”状态。`,
  )
  return true
}

function createUsage(): boolean {
  setFeedback('warning', '当前无需手动创建周转。请直接扫描首张菲票，系统会自动开始本次周转。')
  return true
}

function bindTicketByInput(): boolean {
  const ticket = getSelectedTicketRecord()
  if (!state.draft.ticketInput.trim()) {
    setFeedback('warning', '请先扫描菲票。')
    return true
  }
  if (!ticket) {
    setFeedback('warning', '当前票号不存在，请先确认菲票记录。')
    return true
  }

  let usage = getSourceUsage(state.activeUsageId)
  if (!usage) {
    usage = ensureUsageAutoCreatedForTicket(ticket)
    if (!usage) return true
  }
  if (usage.usageStatus === 'DISPATCHED' || usage.usageStatus === 'PENDING_SIGNOFF') {
    setFeedback('warning', `${usage.usageNo} 已进入交出阶段，不能继续修改装袋内容。`)
    return true
  }
  const context = resolveLockedUsageContext(usage, ticket)
  if (!context.ok || !context.sewingTask) {
    setFeedback('warning', context.reason || '请确认袋内菲票属于本次交出记录。')
    return true
  }
  const validation = validateTicketBindingEligibility({
    ticket,
    usage,
    sewingTask: context.sewingTask,
    bindings: state.store.bindings,
    usagesById: Object.fromEntries(state.store.usages.map((item) => [item.usageId, item])),
  })
  if (!validation.ok) {
    setFeedback('warning', validation.reason)
    return true
  }

  state.store.bindings.push({
    bindingId: buildCuttingTraceabilityId('carrier-bind', nowText(), usage.usageId, ticket.ticketRecordId),
    usageId: usage.usageId,
    usageNo: usage.usageNo,
    cycleId: usage.cycleId,
    bagId: usage.bagId,
    bagCode: usage.bagCode,
    carrierId: usage.carrierId || usage.bagId,
    carrierCode: usage.carrierCode || usage.bagCode,
    feiTicketId: ticket.feiTicketId || ticket.ticketRecordId,
    ticketRecordId: ticket.ticketRecordId,
    ticketNo: ticket.ticketNo,
    cutOrderId: ticket.cutOrderId,
    cutOrderNo: ticket.cutOrderNo,
    markerPlanNo: ticket.markerPlanNo,
    productionOrderNo: ticket.productionOrderNo,
    唛架方案No: ticket.markerPlanNo,
    qty: ticket.qty,
    garmentQty: ticket.qty,
    boundAt: nowText(),
    boundBy: '中转袋工作台',
    operator: '中转袋工作台',
    status: 'BOUND',
      note: '先扫中转袋父码，再扫菲票子码，已建立正式父子映射。',
  })
  if (usage.usageStatus === 'DRAFT') {
    usage.usageStatus = 'PACKING'
    usage.cycleStatus = 'PACKING'
  }
  state.store.auditTrail.push(
    buildBagUsageAuditTrail({
      usageId: usage.usageId,
      action: '扫码装袋',
      actionAt: nowText(),
      actionBy: '中转袋工作台',
      note: `${usage.bagCode} -> ${ticket.ticketNo} 已装袋，并锁定到 ${usage.sewingFactoryName} / ${usage.sewingTaskNo}。`,
    }),
  )
  state.draft.ticketInput = ''
  refreshDerivedState()
  persistStore()
  setFeedback('success', `${ticket.ticketNo} 已装入 ${usage.bagCode}。`)
  return true
}

function importCandidateTickets(targetUsageId?: string): boolean {
  let usage = getSourceUsage(targetUsageId || state.activeUsageId)
  const candidates = getCandidateTickets()
  if (!usage) {
    const firstCandidate = candidates[0]
    if (!firstCandidate) {
      setFeedback('warning', '当前没有可导入的候选菲票。')
      return true
    }
    usage = ensureUsageAutoCreatedForTicket(firstCandidate)
    if (!usage) return true
  }
  const context = resolveLockedUsageContext(usage, null)
  if (!context.ok || !context.sewingTask) {
    setFeedback('warning', context.reason || '当前周转上下文不完整，不能导入候选菲票。')
    return true
  }
  if (!candidates.length) {
    setFeedback('warning', '当前没有可导入的候选菲票。')
    return true
  }

  let successCount = 0
  const failedIds: string[] = []
  const failedReasons: string[] = []

  candidates.forEach((ticket) => {
    const validation = validateTicketBindingEligibility({
      ticket,
      usage,
      sewingTask: context.sewingTask,
      bindings: state.store.bindings,
      usagesById: Object.fromEntries(state.store.usages.map((item) => [item.usageId, item])),
    })
    if (!validation.ok) {
      failedIds.push(ticket.ticketRecordId)
      failedReasons.push(`${ticket.ticketNo}：${validation.reason}`)
      return
    }

    state.store.bindings.push({
      bindingId: buildCuttingTraceabilityId('carrier-bind', nowText(), usage.usageId, ticket.ticketRecordId, String(successCount + 1)),
      usageId: usage.usageId,
      usageNo: usage.usageNo,
      cycleId: usage.cycleId,
      bagId: usage.bagId,
      bagCode: usage.bagCode,
      carrierId: usage.carrierId || usage.bagId,
      carrierCode: usage.carrierCode || usage.bagCode,
      feiTicketId: ticket.feiTicketId || ticket.ticketRecordId,
      ticketRecordId: ticket.ticketRecordId,
      ticketNo: ticket.ticketNo,
      cutOrderId: ticket.cutOrderId,
      cutOrderNo: ticket.cutOrderNo,
      markerPlanNo: ticket.markerPlanNo,
      productionOrderNo: ticket.productionOrderNo,
      唛架方案No: ticket.markerPlanNo,
      qty: ticket.qty,
      garmentQty: ticket.qty,
      boundAt: nowText(),
      boundBy: '中转袋工作台',
      operator: '中转袋工作台',
      status: 'BOUND',
      note: '通过候选菲票批量建立正式父子映射。',
    })
    if (usage.usageStatus === 'DRAFT') {
      usage.usageStatus = 'PACKING'
      usage.cycleStatus = 'PACKING'
    }
    successCount += 1
  })

  if (successCount) {
    state.store.auditTrail.push(
      buildBagUsageAuditTrail({
        usageId: usage.usageId,
        action: '导入候选菲票',
        actionAt: nowText(),
        actionBy: '中转袋工作台',
        note: `${usage.bagCode} 批量导入 ${successCount} 张菲票。`,
      }),
    )
  }

  state.preselectedTicketRecordIds = failedIds
  persistSelectedTicketIds()
  refreshDerivedState()
  persistStore()

  if (failedReasons.length) {
    setFeedback('warning', `已导入 ${successCount} 张，仍有 ${failedReasons.length} 张待处理：${failedReasons.join('；')}`)
  } else {
    setFeedback('success', `${usage.usageNo} 已导入 ${successCount} 张候选菲票。`)
  }
  return true
}

function removeBinding(bindingId: string | undefined): boolean {
  if (!bindingId) return false
  const binding = state.store.bindings.find((item) => item.bindingId === bindingId)
  if (!binding) return false
  const usage = getSourceUsage(binding.usageId)
  if (usage && (usage.usageStatus === 'DISPATCHED' || usage.usageStatus === 'PENDING_SIGNOFF')) {
    setFeedback('warning', `${usage.usageNo} 已进入交出后阶段，不能移除袋内映射。`)
    return true
  }
  state.store.bindings = state.store.bindings.filter((item) => item.bindingId !== bindingId)
  state.store.auditTrail.push(
    buildBagUsageAuditTrail({
      usageId: binding.usageId,
      action: '移除绑定',
      actionAt: nowText(),
      actionBy: '中转袋工作台',
      note: `${binding.ticketNo} 已从 ${binding.bagCode} 中移除。`,
    }),
  )
  refreshDerivedState()
  persistStore()
  setFeedback('success', `${binding.ticketNo} 已移除。`)
  return true
}

function printManifest(usageId: string | undefined): boolean {
  if (!usageId) return false
  const usage = getViewModel().usagesById[usageId]
  if (!usage) return false
  state.store.auditTrail.push(
    buildBagUsageAuditTrail({
      usageId,
      action: '打印中转袋档案二维码',
      actionAt: nowText(),
      actionBy: '中转袋工作台',
      note: `${usage.bagCode} 已进入中转袋档案二维码打印预览。`,
    }),
  )
  refreshDerivedState()
  persistStore()

  appStore.navigate(buildTransferBagLabelPrintLink(usage.bagId || usage.bagCode))
  setFeedback('success', `${usage.bagCode} 的中转袋档案二维码已进入统一打印预览。`)
  return true
}

function updateUsageStatus(usageId: string | undefined, nextStatus: TransferBagUsageStatusKey): boolean {
  if (!usageId) return false
  const usage = getSourceUsage(usageId)
  if (!usage) return false
  if (!usage.packedTicketCount && nextStatus !== 'DRAFT') {
    setFeedback('warning', `${usage.usageNo} 尚未装入菲票，不能进入后续流转状态。`)
    return true
  }
  if (nextStatus === 'DISPATCHED' && !['READY_TO_DISPATCH', 'DISPATCHED'].includes(usage.usageStatus)) {
    setFeedback('warning', `${usage.usageNo} 需先完成装袋，再交出。`)
    return true
  }
  if (nextStatus === 'WAITING_RETURN' && !['DISPATCHED', 'PENDING_SIGNOFF', 'WAITING_RETURN'].includes(usage.usageStatus)) {
    setFeedback('warning', `${usage.usageNo} 当前还不能回收，请先完成交出。`)
    return true
  }

  const currentSummary = buildTransferBagParentChildSummary(state.store.bindings.filter((item) => item.usageId === usage.usageId))

  usage.usageStatus = nextStatus
  usage.cycleStatus = nextStatus
  if (nextStatus === 'READY_TO_DISPATCH') {
    usage.finishedPackingAt = nowText()
    usage.note = '当前使用周期已完成核对，等待交出。'
  }
  if (nextStatus === 'DISPATCHED') {
    usage.dispatchAt = nowText()
    usage.dispatchBy = '中转袋工作台'
    usage.signoffStatus = 'WAITING'
    usage.note = `当前使用周期已交出，共 ${currentSummary.ticketCount} 张菲票。`
  }
  if (nextStatus === 'WAITING_RETURN') {
    usage.signoffStatus = 'SIGNED'
    usage.note = '当前使用周期已交出，等待回收确认。'
  }
  if (nextStatus === 'PENDING_SIGNOFF') {
    usage.signoffStatus = 'WAITING'
    usage.note = '当前使用周期已交出，等待回收确认。'
  }

  state.store.auditTrail.push(
    buildBagUsageAuditTrail({
      usageId: usage.usageId,
      action:
        nextStatus === 'READY_TO_DISPATCH'
            ? '完成装袋'
            : nextStatus === 'DISPATCHED'
              ? '交出'
            : nextStatus === 'WAITING_RETURN'
              ? '进入回收确认'
              : '更新交出状态',
      actionAt: nowText(),
      actionBy: '中转袋工作台',
      note: `${usage.usageNo} 已更新为 ${nextStatus === 'DISPATCHED' ? '已交出' : deriveTransferBagUsageStatus(nextStatus).label}。`,
    }),
  )
  refreshDerivedState()
  persistStore()
  setFeedback('success', `${usage.usageNo} 已更新为“${nextStatus === 'DISPATCHED' ? '已交出' : deriveTransferBagUsageStatus(nextStatus).label}”。`)
  return true
}

function clearDraft(): boolean {
  state.draft = {
    bagId: '',
    bagCodeInput: '',
    sewingTaskId: '',
    ticketInput: '',
    note: '',
  }
  setFeedback('success', '装袋工作台已清空。')
  return true
}

function clearPrefill(): boolean {
  state.prefilter = null
  state.drillContext = null
  state.landingBanner = null
  state.preselectedTicketRecordIds = []
  state.returnStatus = 'ALL'
  persistSelectedTicketIds()
  state.querySignature = getCanonicalCuttingPath('transfer-bags')
  appStore.navigate(getCanonicalCuttingPath('transfer-bags'))
  return true
}

function navigateByPayload(payload: Record<string, string | undefined>, path: string): boolean {
  const targetMap: Record<string, CuttingNavigationTarget> = {
    [getCanonicalCuttingPath('cut-orders')]: 'cutOrders',
    [getCanonicalCuttingPath('summary')]: 'summary',
    [getCanonicalCuttingPath('fei-tickets')]: 'feiTickets',
    [getCanonicalCuttingPath('cut-piece-warehouse')]: 'cutPieceWarehouse',
  }
  const target = targetMap[path]
  if (target) {
    const context = buildCuttingDrillContext(payload, 'transfer-bags', {
      autoOpenDetail: true,
      bagCode: payload.bagCode,
      usageNo: payload.usageNo,
      cutOrderNo: payload.cutOrderNo,
      markerPlanNo: payload.markerPlanNo || payload['唛架方案No'],
      ticketNo: payload.ticketNo,
      productionOrderNo: payload.productionOrderNo,
    })
    appStore.navigate(buildCuttingRouteWithContext(target, context))
    return true
  }
  appStore.navigate(path)
  return true
}

export function renderCraftCuttingTransferBagsPage(): string {
  return renderListPage()
}

export function renderCraftCuttingTransferBagDetailPage(): string {
  return renderDetailPage()
}

export function handleCraftCuttingTransferBagsEvent(target: Element): boolean {
  const masterFieldNode = target.closest<HTMLElement>('[data-transfer-bags-master-field]')
  if (masterFieldNode) {
    const field = masterFieldNode.dataset.transferBagsMasterField as MasterFilterField | undefined
    if (!field) return false
    const input = masterFieldNode as HTMLInputElement | HTMLSelectElement
    if (field === 'keyword') {
      state.masterKeyword = input.value
      resetMasterPagination()
    }
    if (field === 'status') {
      state.masterStatus = input.value as MasterStatusFilter
      resetMasterPagination()
    }
    if (field === 'useStage') {
      state.masterUseStage = input.value as MasterUseStageFilter
      resetMasterPagination()
    }
    if (field === 'location') {
      state.masterLocationKeyword = input.value
      resetMasterPagination()
    }
    if (field === 'boundObject') {
      state.masterBoundObjectKeyword = input.value
      resetMasterPagination()
    }
    return true
  }

  const masterPageSizeNode = target.closest<HTMLElement>('[data-transfer-bags-master-page-size]')
  if (masterPageSizeNode) {
    const input = masterPageSizeNode as HTMLSelectElement
    const nextPageSize = Number.parseInt(input.value || '10', 10)
    state.masterPageSize = Number.isFinite(nextPageSize) && nextPageSize > 0 ? nextPageSize : 10
    resetMasterPagination()
    return true
  }

  const usageFieldNode = target.closest<HTMLElement>('[data-transfer-bags-usage-field]')
  if (usageFieldNode) {
    const field = usageFieldNode.dataset.transferBagsUsageField as UsageFilterField | undefined
    if (!field) return false
    const input = usageFieldNode as HTMLInputElement | HTMLSelectElement
    if (field === 'keyword') state.usageKeyword = input.value
    if (field === 'status') state.usageStatus = input.value as UsageStatusFilter
    if (field === 'sewingTask') state.usageSewingTaskId = input.value
    return true
  }

  const workbenchFieldNode = target.closest<HTMLElement>('[data-transfer-bags-workbench-field]')
  if (workbenchFieldNode) {
    const field = workbenchFieldNode.dataset.transferBagsWorkbenchField as WorkbenchField | undefined
    if (!field) return false
    const input = workbenchFieldNode as HTMLInputElement | HTMLSelectElement
    state.draft = {
      ...state.draft,
      [field]: input.value,
    }
    return true
  }

  const bindingFieldNode = target.closest<HTMLElement>('[data-transfer-bags-binding-field]')
  if (bindingFieldNode) {
    const input = bindingFieldNode as HTMLInputElement
    state.bindingKeyword = input.value
    return true
  }

  const returnFieldNode = target.closest<HTMLElement>('[data-transfer-bags-return-field]')
  if (returnFieldNode) {
    const field = returnFieldNode.dataset.transferBagsReturnField as ReturnFilterField | undefined
    if (!field) return false
    const input = returnFieldNode as HTMLInputElement | HTMLSelectElement
    if (field === 'keyword') state.returnKeyword = input.value
    if (field === 'status') state.returnStatus = input.value as ReturnStatusFilter
    return true
  }

  const returnDraftFieldNode = target.closest<HTMLElement>('[data-transfer-bags-return-draft-field]')
  if (returnDraftFieldNode) {
    const field = returnDraftFieldNode.dataset.transferBagsReturnDraftField as ReturnDraftField | undefined
    if (!field) return false
    const input = returnDraftFieldNode as HTMLInputElement | HTMLSelectElement
    state.returnDraft = {
      ...state.returnDraft,
      [field]: input.value,
    }
    return true
  }

  const conditionFieldNode = target.closest<HTMLElement>('[data-transfer-bags-condition-field]')
  if (conditionFieldNode) {
    const field = conditionFieldNode.dataset.transferBagsConditionField as ConditionDraftField | undefined
    if (!field) return false
    const input = conditionFieldNode as HTMLInputElement | HTMLSelectElement
    state.conditionDraft = {
      ...state.conditionDraft,
      [field]: input.value,
    }
    if (field !== 'reusableDecision' && field !== 'note') {
      syncReusableDecisionSuggestion()
    }
    return true
  }

  const conditionToggleNode = target.closest<HTMLElement>('[data-transfer-bags-condition-toggle]')
  if (conditionToggleNode) {
    const field = conditionToggleNode.dataset.transferBagsConditionToggle
    if (field === 'repairNeeded') {
      state.conditionDraft = {
        ...state.conditionDraft,
        repairNeeded: (conditionToggleNode as HTMLInputElement).checked,
      }
      syncReusableDecisionSuggestion()
      return true
    }
  }

  const masterDraftFieldNode = target.closest<HTMLElement>('[data-transfer-bags-master-draft-field]')
  if (masterDraftFieldNode) {
    const field = masterDraftFieldNode.dataset.transferBagsMasterDraftField as MasterDraftField | undefined
    if (!field) return false
    const input = masterDraftFieldNode as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    state.masterDraft = {
      ...state.masterDraft,
      [field]: input.value,
    }
    return true
  }

  const packDraftFieldNode = target.closest<HTMLElement>('[data-transfer-bags-pack-draft-field]')
  if (packDraftFieldNode) {
    const field = packDraftFieldNode.dataset.transferBagsPackDraftField as PackDraftField | undefined
    if (!field) return false
    const input = packDraftFieldNode as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    state.packDraft = {
      ...state.packDraft,
      [field]: input.value,
    }
    if (field === 'bagId') {
      const bag = getSourceMaster(input.value)
      state.packDraft.bagCodeInput = bag?.bagCode || state.packDraft.bagCodeInput
    }
    if (field === 'bagCodeInput') {
      const bag = resolveCarrierScanInput(input.value, state.store)
      state.packDraft.bagId = bag?.bagId || ''
    }
    if (field === 'boundObjectNo') {
      const task = getSelectedSewingTaskByNo(input.value)
      if (task) {
        state.packDraft.receiverName = formatFactoryDisplayName(task.sewingFactoryName)
        state.packDraft.receiverType = '工厂'
      }
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-transfer-bags-action]')
  const action = actionNode?.dataset.transferBagsAction
  if (!action) return false

  if (action === 'clear-prefill') return clearPrefill()
  if (action === 'close-dialog') return closeActiveDialog()
  if (action === 'new-master') {
    resetMasterDraft()
    state.activeDialog = 'new-master'
    return true
  }
  if (action === 'save-master') return saveMasterDraft()
  if (action === 'open-inbound-pack') {
    resetPackDraft('INBOUND_TEMP', actionNode.dataset.bagId)
    state.activeDialog = 'inbound-pack'
    return true
  }
  if (action === 'open-handover-pack') {
    resetPackDraft('HANDOVER_PACKING', actionNode.dataset.bagId)
    state.activeDialog = 'handover-pack'
    return true
  }
  if (action === 'save-inbound-pack') return savePackDraft('INBOUND_TEMP')
  if (action === 'save-handover-pack') return savePackDraft('HANDOVER_PACKING')
  if (action === 'complete-inbound-storage') return completeInboundStorage(actionNode.dataset.usageId || state.activeUsageId || undefined)
  if (action === 'release-inbound-bag') return releaseInboundBag(actionNode.dataset.usageId || state.activeUsageId || undefined)
  if (action === 'open-return') {
    const usageId = actionNode.dataset.usageId || state.activeUsageId || ''
    if (usageId) syncUsageSelection(usageId)
    resetReturnDraft(usageId)
    state.activeDialog = 'return'
    return true
  }
  if (action === 'save-return') return saveReturnDraft()
  if (action === 'prepare-return') {
    const usageId = actionNode.dataset.usageId || state.activeUsageId || ''
    if (usageId) syncUsageSelection(usageId)
    resetReturnDraft(usageId)
    state.activeDialog = 'return'
    return true
  }
  if (action === 'clear-return-draft') return clearReturnDraft()
  if (action === 'close-usage-cycle') {
    return closeUsageCycleAction(actionNode.dataset.usageId || state.activeUsageId || undefined)
  }
  if (action === 'focus-scan-query') {
    setFeedback('success', '请在袋码筛选中输入或扫描中转袋码。')
    return true
  }
  if (action === 'set-master-status') {
    state.masterStatus = (actionNode.dataset.status as MasterStatusFilter | undefined) || 'ALL'
    resetMasterPagination()
    return true
  }
  if (action === 'set-master-page') {
    const nextPage = Number.parseInt(actionNode.dataset.page || '1', 10)
    state.masterPage = Number.isFinite(nextPage) && nextPage > 0 ? nextPage : 1
    return true
  }
  if (action === 'clear-draft') return clearDraft()
  if (action === 'match-bag-code') {
    const matched = getSelectedBag()
    if (!matched) {
      setFeedback('warning', '未匹配到该中转袋码，请检查载具编码。')
      return true
    }
    syncMasterSelection(matched.bagId)
    const masterItem = getViewModel().mastersById[matched.bagId]
    if (masterItem?.pocketStatusKey === 'IDLE') {
      setFeedback('success', `${matched.bagCode} 已带入装袋工作台，可开始本次装袋。`)
    } else if (masterItem?.pocketStatusKey === 'PACKING') {
      setFeedback('success', `${matched.bagCode} 已进入当前使用周期，可继续装袋。`)
    } else {
      setFeedback('warning', `${matched.bagCode} 当前状态为“${masterItem?.pocketStatusMeta.label || '待补'}”，已带入详情与当前使用周期。`)
    }
    return true
  }
  if (action === 'set-ticket-input') {
    state.draft.ticketInput = actionNode.dataset.ticketNo ?? ''
    return true
  }
  if (action === 'select-master') {
    const bagId = actionNode.dataset.bagId
    if (!bagId) return false
    syncMasterSelection(bagId)
    return true
  }
  if (action === 'use-master') {
    const bagId = actionNode.dataset.bagId
    if (!bagId) return false
    syncMasterSelection(bagId)
    const masterItem = getViewModel().mastersById[bagId]
    setFeedback('success', `已切换到 ${masterItem?.bagCode || '当前口袋'}，当前状态：${masterItem?.pocketStatusMeta.label || '待补'}。`)
    return true
  }
  if (action === 'select-usage') {
    const usageId = actionNode.dataset.usageId
    if (!usageId) return false
    syncUsageSelection(usageId)
    return true
  }
  if (action === 'create-usage') return createUsage()
  if (action === 'bind-ticket') return bindTicketByInput()
  if (action === 'import-prefill') return importCandidateTickets()
  if (action === 'remove-binding') return removeBinding(actionNode.dataset.bindingId)
  if (action === 'print-manifest') return printManifest(actionNode.dataset.usageId || state.activeUsageId || undefined)
  if (action === 'confirm-handover') return confirmHandoverPacking(actionNode.dataset.usageId || state.activeUsageId || undefined)
  if (action === 'mark-ready') return updateUsageStatus(actionNode.dataset.usageId || state.activeUsageId || undefined, 'READY_TO_DISPATCH')
  if (action === 'mark-dispatched') return updateUsageStatus(actionNode.dataset.usageId || state.activeUsageId || undefined, 'DISPATCHED')
  if (action === 'complete-return-inspection') return completeReturnInspection(actionNode.dataset.usageId || state.activeUsageId || undefined)

  if (action === 'go-cut-piece-warehouse-index') {
    appStore.navigate(getCanonicalCuttingPath('cut-piece-warehouse'))
    return true
  }
  if (action === 'go-fei-tickets-index') {
    appStore.navigate(getCanonicalCuttingPath('fei-tickets'))
    return true
  }
  if (action === 'go-summary-index') {
    appStore.navigate(getCanonicalCuttingPath('summary'))
    return true
  }
  if (action === 'return-summary') {
    const context = buildReturnToSummaryContext(state.drillContext)
    if (!context) return false
    appStore.navigate(buildCuttingRouteWithContext('summary', context))
    return true
  }
  if (action === 'go-cut-orders') {
    const usage = getViewModel().usagesById[actionNode.dataset.usageId || state.activeUsageId || '']
    if (!usage) return false
    return navigateByPayload(usage.navigationPayload.cutOrders, getCanonicalCuttingPath('cut-orders'))
  }
  if (action === 'go-summary') {
    const usage = getViewModel().usagesById[actionNode.dataset.usageId || state.activeUsageId || '']
    if (!usage) return false
    return navigateByPayload(usage.navigationPayload.summary, getCanonicalCuttingPath('summary'))
  }

  return false
}
