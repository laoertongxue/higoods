// @page-pattern: list
import { renderStandardListPage } from '../../../../components/ui/list-page.ts'
import { renderStandardListTable } from '../../../../components/ui/list-table.ts'
import { renderTablePagination } from '../../../../components/ui/pagination.ts'
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
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, renderCuttingPageHeader } from '../meta.ts'
import {
  buildTransferBagParentChildSummary,
  deriveTransferBagMasterStatus,
  deriveTransferBagUsageStatus,
  type TransferBagBindingItem,
  type TransferBagMaster,
  type TransferBagMasterItem,
  type TransferBagTicketCandidate,
  type TransferBagUsageItem,
} from '../transfer-bags-model.ts'
import {
  buildReuseCycleSummary,
  buildTransferBagReturnViewModel,
  closeTransferBagUsageCycle,
  deriveReturnEligibility,
  type TransferBagConditionRecord,
  type TransferBagConditionStatus,
  type TransferBagReusableDecision,
  type TransferBagReturnReceipt,
} from '../transfer-bag-return-model.ts'
import {
  state,
  getViewModel,
  getCarrierManagementProjection,
  persistStore,
  setFeedback,
  closeActiveDialog,
  getFactoryOptions,
  getFactoryNameById,
  type TransferBagCarrierManagementProjection,
  type TransferBagCarrierMasterRecord,
} from './state.ts'
import {
  getActiveMaster,
  getActiveUsage,
  getCandidateTickets,
  getCarrierMasterRecordMap,
  getFilteredBindings,
  getFilteredMasters,
  getFilteredUsages,
  getPagedMasters,
  getSelectedBag,
  getSelectedSewingTask,
  getSelectedTicketRecord,
  getSourceMaster,
  getSourceUsage,
  refreshDerivedState,
  resolveCarrierScanInput,
  resolvePackBag,
  parseTicketInputs,
  resolvePackTickets,
  syncPrefilterFromQuery,
  getSelectedSewingTaskByNo,
  resetMasterPagination,
} from './handlers.ts'
import {
  renderActiveDialog,
} from './dialogs.ts'

export function renderListHeaderActions(): string {
  return `
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-fast-page-render="true" data-transfer-bags-action="new-master">新增中转袋</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-fast-page-render="true" data-transfer-bags-action="focus-scan-query">扫码查询</button>
    </div>
  `
}

export function renderMasterQuickFilterBar(): string {
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

export function renderUsageRecordQuickFilterBar(): string {
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

export function renderActiveListFilterBar(): string {
  return renderMasterQuickFilterBar()
}

export function renderActiveListStats(): string {
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

export function renderUsageRecordQuerySection(): string {
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

export function renderDemoFixturePanel(): string {
  return ''
}

export function renderInboundTempUseSection(): string {
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

export function renderHandoverPackingUseSection(): string {
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

export function renderSignAndReturnUseSection(): string {
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

export function isTransferBagScrapRecord(record: { scrapType?: string; description?: string }): boolean {
  return [record.scrapType, record.description].filter(Boolean).join(' / ').includes('报废')
}

export function renderCarrierScrapSection(): string {
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

export function renderTransferBagStageLedgerPanel(): string {
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

export function renderSortingTaskStatusTag(status: string): string {
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

export function renderCutPieceSortingTaskPanel(): string {
  return ''
}

export function renderMasterSection(): string {
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

export function renderMasterDetail(item: TransferBagMasterItem | null): string {
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

export function renderWorkbenchSection(): string {
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

export function renderCandidatePanel(candidates: TransferBagTicketCandidate[]): string {
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

export function renderUsageLedgerSection(): string {
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

export function renderUsageDetail(item: TransferBagUsageItem | null): string {
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

export function renderReturnLedgerSection(): string {
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

export function renderReturnWorkbenchSection(): string {
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

export function renderReuseCycleSection(): string {
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

export function renderConditionSection(): string {
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

export function renderReturnAuditSection(): string {
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

export function renderBindingSection(): string {
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

export function renderListPage(): string {
  syncPrefilterFromQuery()
  if (isTransferBagDetailPage()) return renderDetailPage()
  const meta = getCanonicalCuttingMeta(getCurrentTransferBagPathname(), 'transfer-bags')
  // renderStandardListPage / renderStandardListTable / renderTablePagination
  // 已导入标准列表页契约组件；当前列表主体仍使用裁床自定义渲染，
  // 标准表格与分页嵌入在 renderMasterSection 内部以保持交互一致性。
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
