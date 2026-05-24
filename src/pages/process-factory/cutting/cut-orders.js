// cut-orders 是 canonical 页面文件。
import { renderDetailDrawer as uiDetailDrawer } from '../../../components/ui/index.ts';
import { appStore } from '../../../state/store.ts';
import { escapeHtml } from '../../../utils.ts';
import { CUTTING_REPLENISHMENT_PENDING_PREP_STORAGE_KEY, deserializeReplenishmentPendingPrepStorage, } from '../../../data/fcs/cutting/storage/replenishment-storage.ts';
import { buildCuttingOrderQrLabelPrintLink, buildTaskDetailLink, buildTaskRouteCardPrintLink, } from '../../../data/fcs/fcs-route-links.ts';
import { formatFactoryDisplayName, TEST_FACTORY_ID } from '../../../data/fcs/factory-mock-data.ts';
import { buildMobileExecutionListLocatePathForTask, getMobileExecutionTaskById, } from '../../../data/fcs/mobile-execution-task-index.ts';
import { validateCuttingOrderMobileTaskBinding } from '../../../data/fcs/process-mobile-task-binding.ts';
import { executeProcessWebAction, getAvailableCuttingWebActions, getProcessWebOperationRecordsBySource, } from '../../../data/fcs/process-web-status-actions.ts';
import { buildPrintableUnitViewModel, getPrintableUnitStatusMeta, isPrintableSourceRow, } from './fei-tickets-model.ts';
import { FEI_QR_SCHEMA_VERSION, buildFeiQrSchemaMeta, buildFeiQrPayload, buildFeiQrPayloadSummary, } from './fei-qr-model.ts';
import { buildCutOrderStats, filterCutOrderRows, findCutOrderByPrefilter, formatCutOrderCurrency, cutOrderStageMeta, cutOrderVisibleCuttableMeta, } from './cut-orders-model.ts';
import { buildMarkerSpreadingCountsByCutOrder } from './marker-spreading-utils.ts';
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, isCuttingAliasPath, renderCuttingPageHeader } from './meta.ts';
import { getClaimDisputeStatusLabel } from '../../../helpers/fcs-claim-dispute.ts';
import { getLatestClaimDisputeByCutOrderNo } from '../../../state/fcs-claim-dispute-store.ts';
import { paginateItems, renderCompactKpiCard, renderStickyFilterShell, renderStickyTableScroller, renderWorkbenchFilterChip, renderWorkbenchPagination, renderWorkbenchStateBar, } from './layout.helpers.ts';
import { renderMaterialIdentityBlock } from './material-identity.ts';
import { buildCuttingDrillChipLabels, buildCuttingDrillSummary, buildCuttingRouteWithContext, buildReturnToSummaryContext, buildCuttingDrillContext, readCuttingDrillContextFromLocation, } from './navigation-context.ts';
import { buildCutOrdersProjection } from './cut-orders-projection.ts';
const FIELD_TO_FILTER_KEY = {
    keyword: 'keyword',
    productionOrderNo: 'productionOrderNo',
    styleKeyword: 'styleKeyword',
    materialSku: 'materialSku',
    currentStage: 'currentStage',
    cuttableState: 'cuttableState',
    inBatch: 'inBatch',
    hasAvailableBalance: 'hasAvailableBalance',
    hasCloseReason: 'hasCloseReason',
};
const initialFilters = {
    keyword: '',
    productionOrderNo: '',
    styleKeyword: '',
    materialSku: '',
    currentStage: 'ALL',
    cuttableState: 'ALL',
    inBatch: 'ALL',
    hasAvailableBalance: 'ALL',
    hasCloseReason: 'ALL',
    riskOnly: false,
};
const state = {
    filters: { ...initialFilters },
    activeOrderId: null,
    page: 1,
    pageSize: 20,
    querySignature: '',
    prefilter: null,
    drillContext: null,
    feedback: null,
};
const consumedWebActionKeys = new Set();
function getCurrentQueryString() {
    const pathname = appStore.getState().pathname;
    const [, query] = pathname.split('?');
    return query || '';
}
function getCurrentSearchParams() {
    return new URLSearchParams(getCurrentQueryString());
}
function buildRouteWithQuery(pathname, payload) {
    if (!payload)
        return pathname;
    const params = new URLSearchParams();
    Object.entries(payload).forEach(([key, value]) => {
        if (value)
            params.set(key, value);
    });
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
}
function applyWebActionFromUrl() {
    const params = getCurrentSearchParams();
    const sourceId = params.get('cutOrderId') || params.get('cutOrderNo') || '';
    const actionCode = params.get('webAction') || '';
    if (!sourceId || !actionCode)
        return;
    const actionKey = `${sourceId}:${actionCode}`;
    if (consumedWebActionKeys.has(actionKey))
        return;
    consumedWebActionKeys.add(actionKey);
    try {
        const result = executeProcessWebAction({
            sourceType: 'CUTTING_ORDER',
            sourceId,
            actionCode,
            operatorName: 'Web 端裁床操作员',
            operatedAt: '2026-04-28 10:00',
            remark: '裁片 Web 端状态操作，菲票归属仍回落裁片单',
        });
        setFeedback('success', result.message);
    }
    catch (error) {
        setFeedback('warning', error instanceof Error ? error.message : '状态操作失败');
    }
}
function resetPagination() {
    state.page = 1;
}
function getProjection() {
    return buildCutOrdersProjection();
}
function getMarkerPlanRefLedger() {
    return getProjection().sources.markerPlanRefs;
}
function getViewModel() {
    return getProjection().viewModel;
}
function parsePrefilterFromPath() {
    const params = getCurrentSearchParams();
    const drillContext = readCuttingDrillContextFromLocation(params);
    const nextPrefilter = {};
    const productionOrderId = drillContext?.productionOrderId || params.get('productionOrderId') || '';
    const productionOrderNo = drillContext?.productionOrderNo || params.get('productionOrderNo') || '';
    const cutOrderId = drillContext?.cutOrderId || params.get('cutOrderId') || '';
    const cutOrderNo = drillContext?.cutOrderNo || params.get('cutOrderNo') || '';
    const markerPlanId = drillContext?.markerPlanId || params.get('markerPlanId') || '';
    const markerPlanNo = drillContext?.markerPlanNo || params.get('markerPlanNo') || '';
    const styleCode = drillContext?.styleCode || params.get('styleCode') || '';
    const spuCode = drillContext?.spuCode || params.get('spuCode') || '';
    const materialSku = drillContext?.materialSku || params.get('materialSku') || '';
    if (productionOrderId)
        nextPrefilter.productionOrderId = productionOrderId;
    if (productionOrderNo)
        nextPrefilter.productionOrderNo = productionOrderNo;
    if (cutOrderId)
        nextPrefilter.cutOrderId = cutOrderId;
    if (cutOrderNo)
        nextPrefilter.cutOrderNo = cutOrderNo;
    if (markerPlanId)
        nextPrefilter.markerPlanId = markerPlanId;
    if (markerPlanNo)
        nextPrefilter.markerPlanNo = markerPlanNo;
    if (styleCode)
        nextPrefilter.styleCode = styleCode;
    if (spuCode)
        nextPrefilter.spuCode = spuCode;
    if (materialSku)
        nextPrefilter.materialSku = materialSku;
    return Object.keys(nextPrefilter).length ? nextPrefilter : null;
}
function syncStateFromPath(viewModel = getViewModel()) {
    const pathname = appStore.getState().pathname;
    if (state.querySignature === pathname)
        return;
    state.drillContext = readCuttingDrillContextFromLocation(getCurrentSearchParams());
    state.prefilter = parsePrefilterFromPath();
    state.querySignature = pathname;
    resetPagination();
    const matched = findCutOrderByPrefilter(viewModel.rows, state.prefilter);
    state.activeOrderId = matched?.id ?? null;
}
function getDisplayRows(viewModel = getViewModel()) {
    return filterCutOrderRows(viewModel.rows, state.filters, state.prefilter);
}
function getActiveRow(viewModel = getViewModel()) {
    if (!state.activeOrderId)
        return null;
    return viewModel.rowsById[state.activeOrderId] ?? null;
}
function renderBadge(label, className) {
    return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`;
}
function formatDate(value) {
    return value || '待补';
}
function formatCount(value) {
    return new Intl.NumberFormat('zh-CN').format(value);
}
function formatMaterialLedgerQty(value, unit = '米') {
    return `${formatCount(Math.round(value * 10) / 10)} ${unit}`;
}
function renderMaterialLedgerGrid(row) {
    const ledger = row.materialQuantityLedger;
    const items = [
        ['需求用量', ledger.requiredMaterialQty],
        ['中转仓已配数量', ledger.transferWarehouseAllocatedQty],
        ['裁床已领数量', ledger.cuttingClaimedQty],
        ['已锁定数量', ledger.markerLockedQty],
        ['已消耗数量', ledger.spreadingConsumedQty],
        ['可用余额', ledger.availableQty],
    ];
    return `
    <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      ${items
        .map(([label, value]) => `
            <div class="rounded-md border bg-muted/10 px-3 py-2">
              <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
              <div class="mt-1 text-sm font-semibold tabular-nums text-foreground">${escapeHtml(formatMaterialLedgerQty(value, ledger.unit))}</div>
            </div>
          `)
        .join('')}
    </div>
  `;
}
function readPendingPrepFollowups() {
    return deserializeReplenishmentPendingPrepStorage(localStorage.getItem(CUTTING_REPLENISHMENT_PENDING_PREP_STORAGE_KEY));
}
function getPendingPrepFollowupsForCutOrder(row) {
    return readPendingPrepFollowups().filter((item) => item.cutOrderId === row.cutOrderId ||
        item.cutOrderNo === row.cutOrderNo);
}
function renderPendingPrepBadge(row) {
    const pendingPrepItems = getPendingPrepFollowupsForCutOrder(row);
    if (!pendingPrepItems.length)
        return '';
    return renderBadge(`补料配料待处理 ${pendingPrepItems.length} 条`, 'bg-amber-100 text-amber-700');
}
function buildPendingPrepSummaryText(row) {
    const pendingPrepItems = getPendingPrepFollowupsForCutOrder(row);
    if (!pendingPrepItems.length)
        return '当前无补料配料待处理';
    const latest = pendingPrepItems[0];
    return `补料待处理 ${pendingPrepItems.length} 条，有领料记录后进入待加工仓；来源铺布 ${latest?.sourceSpreadingSessionId || '待补'}，来源补料单 ${latest?.sourceReplenishmentRequestId || '待补'}`;
}
function isCutOrderInExecutionStage(row) {
    return row.currentStage.key === 'STARTED' && !row.closeReason;
}
function getFeiTicketRecords() {
    return getProjection().sources.feiViewModel.ticketRecords;
}
function getFeiTicketPrintJobs() {
    return getProjection().sources.feiViewModel.printJobs;
}
function getMarkerStore() {
    return getProjection().sources.markerStore;
}
function buildPrintableUnitSummaryByCutOrder(rows) {
    const projection = getProjection();
    const printableView = buildPrintableUnitViewModel({
        cutOrderRows: rows,
        materialPrepRows: projection.sources.materialPrepRows,
        markerPlanRefs: projection.sources.markerPlanRefs,
        markerStore: projection.sources.markerStore,
        ticketRecords: projection.sources.feiViewModel.ticketRecords,
        printJobs: projection.sources.feiViewModel.printJobs,
        prefilter: null,
    });
    return Object.fromEntries(printableView.units.map((unit) => [unit.cutOrderId, unit]));
}
function buildCutOrderQrSummary(row) {
    const latestRecord = getFeiTicketRecords()
        .filter((record) => record.cutOrderId === row.cutOrderId || record.cutOrderNo === row.cutOrderNo)
        .sort((left, right) => right.printedAt.localeCompare(left.printedAt, 'zh-CN') ||
        right.createdAt.localeCompare(left.createdAt, 'zh-CN') ||
        right.sequenceNo - left.sequenceNo)[0] ?? null;
    if (!latestRecord) {
        return {
            latestTicketNo: '待生成',
            schemaVersion: FEI_QR_SCHEMA_VERSION,
            ownerType: '裁片单',
            qrBaseValue: `QR-${row.cutOrderNo}`,
            sourceContextText: row.latestMarkerPlanNo ? `最近来自唛架方案 ${row.latestMarkerPlanNo}` : '裁片单上下文',
            reservedProcessText: '已预留 4 类工艺扩展槽位',
            schemaText: '当前尚无历史票据记录，裁片单主码按 1.0.0 结构生成。',
        };
    }
    const payload = buildFeiQrPayload({
        ticketRecord: latestRecord,
        owner: {
            cutOrderId: row.cutOrderId,
            cutOrderNo: row.cutOrderNo,
            productionOrderId: row.productionOrderId,
            productionOrderNo: row.productionOrderNo,
            styleCode: row.styleCode,
            spuCode: row.spuCode,
            color: row.color,
            materialSku: row.materialSku,
            sameCodeValue: row.cutOrderNo,
            qrBaseValue: latestRecord.sourceQrBaseValue || `QR-${row.cutOrderNo}`,
        },
    });
    const summary = buildFeiQrPayloadSummary(payload);
    const schema = buildFeiQrSchemaMeta(latestRecord);
    return {
        latestTicketNo: latestRecord.ticketNo,
        schemaVersion: summary.schemaVersion,
        ownerType: summary.ownerType === 'cut-order' ? '裁片单' : summary.ownerType,
        qrBaseValue: summary.qrBaseValue,
        sourceContextText: summary.sourceContextType === 'marker-plan-ref' ? `来源唛架方案 ${latestRecord.sourceMarkerPlanNo || '待补唛架方案号'}` : '裁片单上下文',
        reservedProcessText: summary.hasReservedProcess ? '已预留 4 类工艺扩展槽位' : '待补',
        schemaText: schema.schemaNote.replaceAll('二维码', '裁片单主码'),
    };
}
function buildStatsCards(rows) {
    const stats = buildCutOrderStats(rows);
    return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      ${renderCompactKpiCard('裁片单总数', stats.totalCount, '当前筛选范围', 'text-slate-900')}
      ${renderCompactKpiCard('可排唛架数', stats.cuttableCount, '已开工、有领料记录、有可用余额、未被方案锁定', 'text-emerald-600')}
      ${renderCompactKpiCard('唛架方案占用数', stats.inBatchCount, '草稿或有效唛架方案占用余额', 'text-violet-600')}
      ${renderCompactKpiCard('有可用余额数', stats.availableBalanceCount, '裁床可用面料余额大于 0', 'text-blue-600')}
      ${renderCompactKpiCard('已关闭数', stats.closedCount, '已填写关闭原因', 'text-zinc-600')}
      ${renderCompactKpiCard('未产生领料记录数', stats.noClaimRecordCount, '可排唛架判断原因', 'text-amber-600')}
    </section>
  `;
}
function setFeedback(tone, message) {
    state.feedback = { tone, message };
}
function clearFeedback() {
    state.feedback = null;
}
function renderFeedbackBar() {
    if (!state.feedback)
        return '';
    const className = state.feedback.tone === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-amber-200 bg-amber-50 text-amber-700';
    return `
    <section class="flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${className}">
      <span>${escapeHtml(state.feedback.message)}</span>
      <button type="button" class="rounded-md px-2 py-1 text-xs hover:bg-black/5" data-cutting-piece-action="clear-feedback">关闭</button>
    </section>
  `;
}
function renderFilterSelect(label, field, value, options) {
    return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <select
        class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        data-cutting-piece-field="${field}"
      >
        ${options
        .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
        .join('')}
      </select>
    </label>
  `;
}
function getPrefilterLabels() {
    const labels = [];
    const prefilter = state.prefilter;
    if (!prefilter)
        return labels;
    if (prefilter.productionOrderNo)
        labels.push(`预筛：生产单 ${prefilter.productionOrderNo}`);
    if (prefilter.cutOrderNo)
        labels.push(`预筛：裁片单 ${prefilter.cutOrderNo}`);
    if (prefilter.markerPlanNo)
        labels.push(`预筛：唛架方案 ${prefilter.markerPlanNo}`);
    if (prefilter.styleCode)
        labels.push(`预筛：款号 ${prefilter.styleCode}`);
    if (prefilter.spuCode)
        labels.push(`预筛：SPU ${prefilter.spuCode}`);
    if (prefilter.materialSku)
        labels.push(`预筛：面料 ${prefilter.materialSku}`);
    return labels;
}
function getFilterLabels() {
    const labels = [];
    if (state.filters.keyword)
        labels.push(`关键词：${state.filters.keyword}`);
    if (state.filters.productionOrderNo)
        labels.push(`来源生产单：${state.filters.productionOrderNo}`);
    if (state.filters.styleKeyword)
        labels.push(`款号 / SPU：${state.filters.styleKeyword}`);
    if (state.filters.materialSku)
        labels.push(`面料：${state.filters.materialSku}`);
    if (state.filters.currentStage !== 'ALL')
        labels.push(`裁片单主状态：${cutOrderStageMeta[state.filters.currentStage].label}`);
    if (state.filters.cuttableState !== 'ALL')
        labels.push(`可排唛架判断：${cutOrderVisibleCuttableMeta[state.filters.cuttableState].label}`);
    if (state.filters.inBatch === 'IN_MARKER_PLAN')
        labels.push('仅看有唛架方案占用');
    if (state.filters.inBatch === 'NOT_IN_MARKER_PLAN')
        labels.push('仅看无唛架方案占用');
    if (state.filters.hasAvailableBalance === 'YES')
        labels.push('可用余额：大于 0');
    if (state.filters.hasAvailableBalance === 'NO')
        labels.push('可用余额：等于 0');
    if (state.filters.hasCloseReason === 'YES')
        labels.push('关闭原因：已填写');
    if (state.filters.hasCloseReason === 'NO')
        labels.push('关闭原因：未填写');
    if (state.filters.riskOnly)
        labels.push('仅看异常项');
    return labels;
}
function renderPrefilterBar() {
    const labels = Array.from(new Set([...buildCuttingDrillChipLabels(state.drillContext), ...getPrefilterLabels()]));
    if (!labels.length)
        return '';
    return renderWorkbenchStateBar({
        summary: buildCuttingDrillSummary(state.drillContext) || '当前预筛条件',
        chips: labels.map((label) => renderWorkbenchFilterChip(label, 'data-cutting-piece-action="clear-prefilter"', 'amber')),
        clearAttrs: 'data-cutting-piece-action="clear-prefilter"',
    });
}
function renderFilterStateBar() {
    const labels = getFilterLabels();
    if (!labels.length)
        return '';
    return renderWorkbenchStateBar({
        summary: '当前筛选条件',
        chips: labels.map((label) => renderWorkbenchFilterChip(label, 'data-cutting-piece-action="clear-filters"', 'blue')),
        clearAttrs: 'data-cutting-piece-action="clear-filters"',
    });
}
function renderFilterArea() {
    return renderStickyFilterShell(`
    <div class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="min-w-[240px] flex-1">
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">关键字</span>
            <input
              type="search"
              value="${escapeHtml(state.filters.keyword)}"
              placeholder="搜索裁片单号 / 生产单号 / 款号 / 面料 SKU"
              class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              data-cutting-piece-field="keyword"
            />
          </label>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          ${renderWorkbenchFilterChip(state.filters.riskOnly ? '仅看异常项：已开启' : '仅看异常项', 'data-cutting-piece-action="toggle-risk-only"', state.filters.riskOnly ? 'rose' : 'blue')}
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="clear-filters">重置筛选</button>
        </div>
      </div>

      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">来源生产单</span>
          <input
            type="search"
            value="${escapeHtml(state.filters.productionOrderNo)}"
            placeholder="输入生产单号"
            class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            data-cutting-piece-field="productionOrderNo"
          />
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">款号 / SPU</span>
          <input
            type="search"
            value="${escapeHtml(state.filters.styleKeyword)}"
            placeholder="输入款号、SPU 或款式名称"
            class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            data-cutting-piece-field="styleKeyword"
          />
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">面料 SKU / 类别</span>
          <input
            type="search"
            value="${escapeHtml(state.filters.materialSku)}"
            placeholder="输入面料 SKU 或类别关键词"
            class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            data-cutting-piece-field="materialSku"
          />
        </label>
        ${renderFilterSelect('裁片单主状态', 'currentStage', state.filters.currentStage, [
        { value: 'ALL', label: '全部状态' },
        ...Object.entries(cutOrderStageMeta).map(([value, meta]) => ({ value, label: meta.label })),
    ])}
        ${renderFilterSelect('可排唛架判断', 'cuttableState', state.filters.cuttableState, [
        { value: 'ALL', label: '全部' },
        { value: 'CUTTABLE', label: cutOrderVisibleCuttableMeta.CUTTABLE.label },
        { value: 'NOT_CUTTABLE', label: cutOrderVisibleCuttableMeta.NOT_CUTTABLE.label },
    ])}
        ${renderFilterSelect('唛架方案占用', 'inBatch', state.filters.inBatch, [
        { value: 'ALL', label: '全部' },
        { value: 'IN_MARKER_PLAN', label: '有占用关系' },
        { value: 'NOT_IN_MARKER_PLAN', label: '无占用关系' },
    ])}
        ${renderFilterSelect('是否有可用余额', 'hasAvailableBalance', state.filters.hasAvailableBalance, [
        { value: 'ALL', label: '全部' },
        { value: 'YES', label: '可用余额大于 0' },
        { value: 'NO', label: '可用余额等于 0' },
    ])}
        ${renderFilterSelect('是否有关闭原因', 'hasCloseReason', state.filters.hasCloseReason, [
        { value: 'ALL', label: '全部' },
        { value: 'YES', label: '已填写关闭原因' },
        { value: 'NO', label: '未填写关闭原因' },
    ])}
      </div>
    </div>
  `);
}
function renderRiskTags(tags) {
    if (!tags.length)
        return '<span class="text-xs text-muted-foreground">-</span>';
    return `
    <div class="flex flex-wrap gap-1">
      ${tags
        .slice(0, 3)
        .map((tag) => renderBadge(tag.label, tag.className))
        .join('')}
      ${tags.length > 3 ? `<span class="text-xs text-muted-foreground">+${tags.length - 3}</span>` : ''}
    </div>
  `;
}
function renderBatchSummary(row) {
    if (!row.batchParticipationCount) {
        return '<span class="text-xs text-muted-foreground">未关联唛架方案</span>';
    }
    return `
    <div class="space-y-1">
      <button type="button" class="text-left text-sm font-medium text-blue-600 hover:underline" data-cutting-piece-action="go-marker-plan" data-record-id="${escapeHtml(row.id)}">
        ${escapeHtml(row.latestMarkerPlanNo || row.markerPlanNos[0] || '查看唛架方案')}
      </button>
      <p class="text-xs text-muted-foreground">共参与 ${escapeHtml(String(row.batchParticipationCount))} 个唛架方案</p>
    </div>
  `;
}
function renderProductionStyleCell(row) {
    return `
    <div class="space-y-1">
      <button type="button" class="text-left text-sm font-medium text-slate-900 hover:text-blue-600" data-cutting-piece-action="go-production-progress" data-record-id="${escapeHtml(row.id)}">
        ${escapeHtml(row.productionOrderNo)}
      </button>
      <div class="text-sm font-medium text-foreground">${escapeHtml(row.styleCode || row.spuCode || '待补')}</div>
      <p class="text-xs text-muted-foreground">${escapeHtml(row.styleName || row.spuCode || '款式待补')}</p>
      <span class="${row.urgencyClassName} inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium">${escapeHtml(row.urgencyLabel)}</span>
    </div>
  `;
}
function renderMaterialCell(row) {
    return `
    <div class="space-y-2">
      ${renderMaterialIdentityBlock(row, { compact: true })}
    </div>
  `;
}
function renderPatternCell(row) {
    return `
    <div class="space-y-1.5 text-xs">
      <div class="text-sm font-medium text-foreground">${escapeHtml(row.patternFileName || '待补纸样文件')}</div>
      <div class="text-muted-foreground">版本：${escapeHtml(row.patternVersion || '待补')}</div>
      <div class="text-muted-foreground">类型：${escapeHtml(row.patternKind || '待补')}</div>
      <div class="text-muted-foreground">有效幅宽：<span class="font-medium text-foreground">${escapeHtml(row.effectiveWidthText || '待补')}</span></div>
      <div class="line-clamp-2 text-muted-foreground" title="${escapeHtml(row.piecePartNames.join('、'))}">
        部位：${escapeHtml(row.piecePartNames.length ? row.piecePartNames.join('、') : '待补')}
      </div>
    </div>
  `;
}
function renderQuantityCell(row) {
    const ledger = row.materialQuantityLedger;
    return `
    <div class="space-y-1.5 text-xs">
      <div class="text-sm font-medium text-foreground">${escapeHtml(row.pieceCountText)} 件</div>
      <div class="text-muted-foreground">需求成衣件数</div>
      <div class="pt-1 leading-5 text-muted-foreground">
        <div>需求用量：<span class="font-medium text-foreground">${escapeHtml(formatMaterialLedgerQty(ledger.requiredMaterialQty, ledger.unit))}</span></div>
        <div>中转仓已配数量：<span class="font-medium text-foreground">${escapeHtml(formatMaterialLedgerQty(ledger.transferWarehouseAllocatedQty, ledger.unit))}</span></div>
        <div>裁床已领数量：<span class="font-medium text-foreground">${escapeHtml(formatMaterialLedgerQty(ledger.cuttingClaimedQty, ledger.unit))}</span></div>
        <div>已锁定数量：<span class="font-medium text-foreground">${escapeHtml(formatMaterialLedgerQty(ledger.markerLockedQty, ledger.unit))}</span></div>
        <div>已消耗数量：<span class="font-medium text-foreground">${escapeHtml(formatMaterialLedgerQty(ledger.spreadingConsumedQty, ledger.unit))}</span></div>
        <div>可用余额：<span class="font-medium text-foreground">${escapeHtml(formatMaterialLedgerQty(ledger.availableQty, ledger.unit))}</span></div>
      </div>
    </div>
  `;
}
function renderStatusCell(row) {
    const lockSource = row.activeMarkerPlanNo || row.latestMarkerPlanNo;
    return `
    <div class="space-y-2">
      <div class="space-y-1">
        <div class="text-xs text-muted-foreground">裁片单主状态</div>
        ${renderBadge(row.currentStageLabel, row.currentStage.className)}
        ${row.closeReason ? `<p class="text-xs leading-5 text-muted-foreground">关闭原因：${escapeHtml(row.closeReasonText || row.closeReason)}</p>` : ''}
      </div>
      <div class="space-y-1 text-xs text-muted-foreground">
        <div class="flex flex-wrap gap-1">
          <span class="w-full text-xs text-muted-foreground">可排唛架判断</span>
        ${renderBadge(row.visibleCuttableStatus.label, row.visibleCuttableStatus.className)}
        </div>
        ${row.cuttableState.key === 'CUTTABLE' ? '' : `<p>不满足原因：${escapeHtml(row.cuttableState.reasonText)}</p>`}
        ${lockSource ? `<p>当前锁定来源：${escapeHtml(lockSource)}</p>` : ''}
      </div>
      ${renderBatchSummary(row)}
    </div>
  `;
}
function renderEmptyTableState() {
    return `
    <tr>
      <td colspan="9" class="px-4 py-16 text-center text-sm text-muted-foreground">
        当前条件下暂无裁片单，请调整筛选条件或清除预筛后重试。
      </td>
    </tr>
  `;
}
function renderTable(rows) {
    const pagination = paginateItems(rows, state.page, state.pageSize);
    return `
    <section class="rounded-lg border bg-card" data-testid="cutting-cut-orders-main-table">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 class="text-sm font-semibold">裁片单主表</h2>
        </div>
        <div class="text-xs text-muted-foreground">共 ${pagination.total} 条裁片单</div>
      </div>
      ${renderStickyTableScroller(`
          <table class="w-full min-w-[1260px] text-sm">
            <thead class="sticky top-0 z-10 border-b bg-muted/95 text-muted-foreground backdrop-blur">
              <tr>
                <th class="px-4 py-3 text-left font-medium">裁片单</th>
                <th class="px-4 py-3 text-left font-medium">生产单与款式</th>
                <th class="px-4 py-3 text-left font-medium">面料</th>
                <th class="px-4 py-3 text-left font-medium">纸样</th>
                <th class="px-4 py-3 text-left font-medium">数量</th>
                <th class="px-4 py-3 text-left font-medium">日期</th>
                <th class="px-4 py-3 text-left font-medium">裁片单主状态</th>
                <th class="px-4 py-3 text-left font-medium">风险</th>
                <th class="px-4 py-3 text-left font-medium">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              ${pagination.items.length
        ? pagination.items
            .map((row) => {
            const highlighted = state.activeOrderId === row.id;
            const canEnterExecution = isCutOrderInExecutionStage(row);
            const canEnterFeiTickets = isPrintableSourceRow(row);
            return `
                          <tr class="${highlighted ? 'bg-blue-50/60' : 'hover:bg-muted/20'}">
                            <td class="px-4 py-3 align-top">
                              <button type="button" class="text-left font-medium text-blue-600 hover:underline" data-cutting-piece-action="open-detail" data-record-id="${escapeHtml(row.id)}">
                                ${escapeHtml(row.cutOrderNo)}
                              </button>
                              <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.relationSummary)}</p>
                            </td>
                            <td class="px-4 py-3 align-top">${renderProductionStyleCell(row)}</td>
                            <td class="px-4 py-3 align-top">${renderMaterialCell(row)}</td>
                            <td class="px-4 py-3 align-top">${renderPatternCell(row)}</td>
                            <td class="px-4 py-3 align-top">${renderQuantityCell(row)}</td>
                            <td class="px-4 py-3 align-top">
                              <div class="space-y-1 text-xs text-muted-foreground">
                                ${row.dateInfoLines
                .map((line) => `<p>${escapeHtml(line.label)}：${escapeHtml(line.value)}</p>`)
                .join('')}
                              </div>
                            </td>
                            <td class="px-4 py-3 align-top">
                              ${renderStatusCell(row)}
                            </td>
                            <td class="px-4 py-3 align-top">
                              <div class="space-y-1">
                                ${renderRiskTags(row.riskTags)}
                                ${renderPendingPrepBadge(row)}
                              </div>
                            </td>
                            <td class="px-4 py-3 align-top">
                              <div class="flex flex-wrap gap-2">
                                <button type="button" class="text-xs text-blue-600 hover:underline" data-cutting-piece-action="open-detail" data-record-id="${escapeHtml(row.id)}">查看详情</button>
                                <button type="button" class="text-xs text-blue-600 hover:underline" data-cutting-piece-action="print-task-route-card" data-record-id="${escapeHtml(row.id)}">打印任务流转卡</button>
                                <button type="button" class="text-xs text-blue-600 hover:underline" data-cutting-piece-action="print-cutting-order-qr" data-record-id="${escapeHtml(row.id)}">打印裁片单二维码</button>
                                ${canEnterExecution ? `<button type="button" class="text-xs text-blue-600 hover:underline" data-cutting-piece-action="go-marker-plan" data-record-id="${escapeHtml(row.id)}">去唛架</button>` : ''}
                                ${canEnterFeiTickets ? `<button type="button" class="text-xs text-blue-600 hover:underline" data-cutting-piece-action="go-fei-tickets" data-record-id="${escapeHtml(row.id)}">去打印菲票</button>` : ''}
                              </div>
                            </td>
                          </tr>
                        `;
        })
            .join('')
        : renderEmptyTableState()}
            </tbody>
          </table>
        `)}
      ${renderWorkbenchPagination({
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        actionAttr: 'data-cutting-piece-action',
        pageAction: 'set-page',
        pageSizeAttr: 'data-cutting-piece-page-size',
    })}
    </section>
  `;
}
function renderInfoGrid(items) {
    return `
    <div class="grid gap-x-6 gap-y-3 md:grid-cols-2 xl:grid-cols-3">
      ${items
        .map((item) => `
            <div class="min-w-0 border-b pb-2">
              <p class="text-xs text-muted-foreground">${escapeHtml(item.label)}</p>
              <p class="mt-1 break-words ${item.tone === 'strong' ? 'text-base font-semibold' : 'text-sm'}">${escapeHtml(item.value || '待补')}</p>
              ${item.hint ? `<p class="mt-1 text-[11px] text-muted-foreground">${escapeHtml(item.hint)}</p>` : ''}
            </div>
          `)
        .join('')}
    </div>
  `;
}
function renderDetailSection(title, body) {
    return `
    <section class="border-b px-4 py-4 last:border-b-0">
      <h3 class="mb-3 text-sm font-semibold">${escapeHtml(title)}</h3>
      <div>
        ${body}
      </div>
    </section>
  `;
}
function renderCuttingWebActions(row, actions) {
    const actionable = actions.filter((action) => !action.disabledReason);
    const disabledReason = actions.find((action) => action.disabledReason)?.disabledReason;
    const actionHref = (actionCode) => buildRouteWithQuery(getCanonicalCuttingPath('cut-orders'), {
        cutOrderId: row.cutOrderId,
        webAction: actionCode,
    });
    return renderDetailSection('可执行动作', `
      <div class="space-y-3">
        ${renderInfoGrid([
        { label: '裁片单主状态', value: row.currentStage.label, tone: 'strong' },
        ...(row.closeReason ? [{ label: '关闭原因', value: row.closeReason }] : []),
        ...(row.closedAt ? [{ label: '关闭时间', value: row.closedAt }] : []),
        { label: '操作方式', value: '按当前状态开放' },
        { label: '菲票归属口径', value: '菲票归属裁片单，唛架方案只作为执行上下文' },
    ])}
        ${actionable.length
        ? `<div class="flex flex-wrap gap-2">
                ${actionable
            .map((action) => `
                      <button
                        type="button"
                        class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                        data-nav="${escapeHtml(actionHref(action.actionCode))}"
                      >
                        ${escapeHtml(action.actionLabel)}
                      </button>
                    `)
            .join('')}
              </div>
              </div>`
        : `<div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">${escapeHtml(disabledReason || '当前状态暂无可执行动作')}</div>`}
      </div>
    `);
}
function renderCuttingWebOperationRecords(records) {
    return renderDetailSection('操作记录', `
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 font-medium">操作动作</th>
              <th class="px-3 py-2 font-medium">前状态</th>
              <th class="px-3 py-2 font-medium">后状态</th>
              <th class="px-3 py-2 font-medium">操作人</th>
              <th class="px-3 py-2 font-medium">操作时间</th>
              <th class="px-3 py-2 font-medium">操作对象与数量单位</th>
              <th class="px-3 py-2 font-medium">来源</th>
              <th class="px-3 py-2 font-medium">备注</th>
            </tr>
          </thead>
          <tbody>
            ${records.length
        ? records
            .map((record) => `
                        <tr class="border-b last:border-b-0">
                          <td class="px-3 py-3 text-sm">${escapeHtml(record.actionLabel)}</td>
                          <td class="px-3 py-3 text-sm">${escapeHtml(record.previousStatus)}</td>
                          <td class="px-3 py-3 text-sm">${escapeHtml(record.nextStatus)}</td>
                          <td class="px-3 py-3 text-sm">${escapeHtml(record.operatorName)}</td>
                          <td class="px-3 py-3 text-sm">${escapeHtml(record.operatedAt)}</td>
                          <td class="px-3 py-3 text-sm"><div>${escapeHtml(record.qtyLabel || '操作裁片数量')}</div><div class="text-xs text-muted-foreground">${formatCount(record.objectQty)} ${escapeHtml(record.qtyUnit)}</div></td>
                          <td class="px-3 py-3 text-sm">${escapeHtml(record.sourceChannel)}</td>
                          <td class="px-3 py-3 text-sm">${escapeHtml(record.remark || '—')}</td>
                        </tr>
                      `)
            .join('')
        : '<tr><td class="px-3 py-8 text-center text-sm text-muted-foreground" colspan="8">暂无操作记录</td></tr>'}
          </tbody>
        </table>
      </div>
    `);
}
function renderDetailDrawer(viewModel = getViewModel()) {
    const row = getActiveRow(viewModel);
    if (!row)
        return '';
    const qrSummary = buildCutOrderQrSummary(row);
    const markerSpreadingCounts = buildMarkerSpreadingCountsByCutOrder(row.cutOrderId);
    const latestClaimDispute = getLatestClaimDisputeByCutOrderNo(row.cutOrderNo);
    const printableUnit = buildPrintableUnitSummaryByCutOrder(viewModel.rows)[row.cutOrderId] || null;
    const printableStatusMeta = printableUnit ? getPrintableUnitStatusMeta(printableUnit.printableUnitStatus) : null;
    const canEnterExecution = isCutOrderInExecutionStage(row);
    const canEnterFeiTickets = isPrintableSourceRow(row);
    const mobileBinding = validateCuttingOrderMobileTaskBinding(row.cutOrderId);
    const webActions = getAvailableCuttingWebActions(row.cutOrderId);
    const webOperationRecords = getProcessWebOperationRecordsBySource('CUTTING_ORDER', row.cutOrderId);
    const mobileBindingReasonLabel = mobileBinding.reasonCode === 'TASK_NOT_VISIBLE_IN_MOBILE_LIST'
        ? '移动端执行列表不可见，请检查工厂或任务状态'
        : mobileBinding.reasonLabel;
    const mobileExecutionTask = mobileBinding.actualTaskId ? getMobileExecutionTaskById(mobileBinding.actualTaskId) : null;
    const mobileExecutionLink = mobileBinding.canOpenMobileExecution && mobileExecutionTask
        ? buildTaskDetailLink(mobileBinding.actualTaskId, {
            returnTo: buildMobileExecutionListLocatePathForTask(mobileExecutionTask, {
                currentFactoryId: row.assignedFactoryId || TEST_FACTORY_ID,
                keyword: row.cutOrderNo,
            }),
            sourceType: 'CUTTING_ORDER',
            sourceId: row.cutOrderId || row.cutOrderNo,
            currentFactoryId: row.assignedFactoryId || TEST_FACTORY_ID,
            keyword: row.cutOrderNo,
        })
        : '';
    const siblingRows = viewModel.rows.filter((item) => item.productionOrderId === row.productionOrderId && item.cutOrderId !== row.cutOrderId);
    const batchParticipationText = row.batchParticipationCount
        ? `已参与 ${row.batchParticipationCount} 个唛架方案，最新唛架方案 ${row.latestMarkerPlanNo || '待补'}。`
        : '当前尚未进入任何唛架方案。';
    const extraButtons = `
    <div class="flex flex-wrap items-center gap-2">
      ${canEnterExecution ? `<button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-piece-action="go-spreading" data-record-id="${escapeHtml(row.id)}">去铺布</button>` : ''}
      <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-piece-action="print-task-route-card" data-record-id="${escapeHtml(row.id)}">打印任务流转卡</button>
      <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-piece-action="print-cutting-order-qr" data-record-id="${escapeHtml(row.id)}">打印裁片单二维码</button>
      ${canEnterFeiTickets ? `<button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-piece-action="go-fei-tickets" data-record-id="${escapeHtml(row.id)}">去打印菲票</button>` : ''}
    </div>
  `;
    const content = `
    <div class="space-y-4">
      ${renderDetailSection('基础身份信息', `
          <div class="space-y-3">
            <div class="rounded-lg border bg-muted/20 p-3">
              ${renderMaterialIdentityBlock({
        materialSku: row.materialSku,
        materialName: row.materialName,
        materialLabel: row.materialLabel,
        materialCategory: row.materialCategory,
        materialColor: row.materialColor,
        materialAlias: row.materialAlias,
        materialImageUrl: row.materialImageUrl,
        materialUnit: row.materialUnit,
    }, { imageSizeClass: 'h-14 w-14' })}
            </div>
            ${renderInfoGrid([
        { label: '裁片单号', value: row.cutOrderNo, tone: 'strong' },
        { label: '来源生产单号', value: row.productionOrderNo },
        { label: '款号 / SPU', value: `${row.styleCode || row.spuCode} / ${row.styleName || row.spuCode}` },
        { label: '面料颜色', value: row.materialColor || row.color },
        { label: '纸样文件', value: row.patternFileName },
        { label: '纸样版本', value: row.patternVersion },
        { label: '有效幅宽', value: row.effectiveWidthText },
        { label: '部位集合', value: row.piecePartNames.join('、') },
        { label: '需求成衣件数（件）', value: `${formatCount(row.orderQty)} 件` },
        { label: '计划裁片数量（片）', value: `${formatCount(row.orderQty)} 片` },
        { label: '采购日期', value: formatDate(row.purchaseDate) },
        { label: '实际下单日期', value: formatDate(row.actualOrderDate) },
        { label: '计划发货日期', value: formatDate(row.plannedShipDate) },
        { label: '工厂', value: formatFactoryDisplayName(row.assignedFactoryName, TEST_FACTORY_ID) },
        { label: '卖价', value: formatCutOrderCurrency(row.sellingPrice) },
        { label: '最近执行痕迹', value: row.latestActionText },
    ])}
          </div>
        `)}

      ${renderDetailSection('主状态与判断关系', `
          <div class="space-y-3">
            <div class="flex flex-wrap gap-2">
              <span class="w-full text-xs text-muted-foreground">裁片单主状态</span>
              ${renderBadge(row.currentStage.label, row.currentStage.className)}
              <span class="mt-2 w-full text-xs text-muted-foreground">可排唛架判断</span>
              ${renderBadge(row.visibleCuttableStatus.label, row.visibleCuttableStatus.className)}
            </div>
            ${row.closeReason ? `<p class="text-sm"><span class="text-muted-foreground">关闭原因：</span>${escapeHtml(row.closeReasonText || row.closeReason)}</p>` : ''}
            ${row.closedAt ? `<p class="text-sm"><span class="text-muted-foreground">关闭时间：</span>${escapeHtml(row.closedAt)}</p>` : ''}
            ${row.closedBy ? `<p class="text-sm"><span class="text-muted-foreground">关闭人：</span>${escapeHtml(row.closedBy)}</p>` : ''}
            <div class="space-y-2 text-sm">
              <p><span class="text-muted-foreground">不满足原因：</span>${escapeHtml(row.cuttableState.key === 'CUTTABLE' ? '满足可排唛架条件' : row.cuttableState.reasonText)}</p>
              <p><span class="text-muted-foreground">当前锁定来源：</span>${escapeHtml(row.activeMarkerPlanNo || row.latestMarkerPlanNo || '无')}</p>
              <div class="flex flex-wrap items-center gap-1">
                <span class="text-muted-foreground">风险：</span>
                ${row.riskTags.length
        ? row.riskTags.map((tag) => renderBadge(tag.label, tag.className)).join('')
        : '<span class="text-muted-foreground">无</span>'}
              </div>
            </div>
          </div>
        `)}

      ${renderDetailSection('面料数量账', renderMaterialLedgerGrid(row))}

      ${renderDetailSection('移动端执行绑定', `
          <div class="space-y-3">
            ${renderInfoGrid([
        { label: '移动端任务号', value: mobileBinding.actualTaskNo || mobileBinding.expectedTaskNo || '未绑定', tone: 'strong' },
        { label: '绑定状态', value: mobileBinding.canOpenMobileExecution ? '有效' : '不可执行' },
        { label: '校验结果', value: mobileBinding.canOpenMobileExecution ? '允许打开移动端执行页' : '当前不可执行' },
        { label: '不可执行原因', value: mobileBindingReasonLabel },
    ])}
            <div class="flex flex-wrap gap-2">
              ${mobileBinding.canOpenMobileExecution
        ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(mobileExecutionLink)}">打开移动端执行页</button>`
        : '<button type="button" class="rounded-md border px-3 py-2 text-sm opacity-50" disabled>打开移动端执行页</button>'}
              <span class="inline-flex items-center rounded-md border ${mobileBinding.canOpenMobileExecution ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'} px-3 py-2 text-xs">${escapeHtml(mobileBinding.suggestedAction)}</span>
            </div>
          </div>
        `)}

      ${renderCuttingWebActions(row, webActions)}

      ${renderDetailSection('唛架方案参与记录', `
          <div class="space-y-3">
            ${renderInfoGrid([
        { label: '最新唛架方案号', value: row.latestMarkerPlanNo || '未关联唛架方案' },
        { label: '参与唛架方案数', value: `${row.batchParticipationCount} 次` },
        { label: '当前占用状态', value: row.activeMarkerPlanNo ? `已占用（${row.activeMarkerPlanNo}）` : '未占用' },
    ])}
            ${row.markerPlanNos.length
        ? `
                  <div class="flex flex-wrap gap-2">
                    ${row.markerPlanNos.map((batchNo) => renderBadge(batchNo, 'bg-violet-100 text-violet-700 border border-violet-200')).join('')}
                  </div>
                `
        : ''}
            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-marker-plan" data-record-id="${escapeHtml(row.id)}">
                查看唛架方案
              </button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-same-production-orders" data-record-id="${escapeHtml(row.id)}">
                查看同生产单下其他裁片单${siblingRows.length ? `（${siblingRows.length}）` : ''}
              </button>
            </div>
          </div>
        `)}

      ${renderDetailSection('裁片单主码摘要', `
          <div class="space-y-3">
            ${renderInfoGrid([
        { label: '最新菲票号', value: qrSummary.latestTicketNo, tone: 'strong' },
        { label: '主码版本', value: qrSummary.schemaVersion },
        { label: '归属对象', value: qrSummary.ownerType },
        { label: '主码值', value: qrSummary.qrBaseValue },
        { label: '来源上下文', value: qrSummary.sourceContextText },
        { label: '工艺预留', value: qrSummary.reservedProcessText },
    ])}
            <div class="flex flex-wrap gap-2">
              ${canEnterFeiTickets
        ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-fei-tickets" data-record-id="${escapeHtml(row.id)}">去打印菲票</button>`
        : '<span class="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">当前未完成领料 / 铺布，不生成菲票主码</span>'}
            </div>
          </div>
        `)}

      ${renderDetailSection('打印菲票摘要', `
          <div class="space-y-3">
            ${renderInfoGrid([
        { label: '打印状态', value: printableStatusMeta ? printableStatusMeta.label : '暂无可打印对象', tone: 'strong' },
        { label: '应打菲票数', value: printableUnit ? `${formatCount(printableUnit.requiredTicketCount)} 张` : '0 张' },
        { label: '有效已打印数', value: printableUnit ? `${formatCount(printableUnit.validPrintedTicketCount)} 张` : '0 张' },
        { label: '已作废数', value: printableUnit ? `${formatCount(printableUnit.voidedTicketCount)} 张` : '0 张' },
        { label: '需补打数', value: printableUnit ? `${formatCount(printableUnit.missingTicketCount)} 张` : '0 张' },
        { label: '最近打印时间', value: printableUnit?.lastPrintedAt || '未打印' },
        { label: '最近打印人', value: printableUnit?.lastPrintedBy || '未打印' },
    ])}
            <div class="flex flex-wrap gap-2">
              ${canEnterFeiTickets
        ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-fei-tickets" data-record-id="${escapeHtml(row.id)}">去打印菲票</button>`
        : '<span class="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">当前不允许打印菲票</span>'}
              ${canEnterFeiTickets && printableUnit
        ? `
                    <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildRouteWithQuery(getCanonicalCuttingPath('fei-ticket-printed'), {
            printableUnitId: printableUnit.printableUnitId,
            printableUnitNo: printableUnit.printableUnitNo,
            printableUnitType: printableUnit.printableUnitType,
            cutOrderId: printableUnit.cutOrderId,
            cutOrderNo: printableUnit.cutOrderNo,
        }))}">查看已打印菲票</button>
                    <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildRouteWithQuery(getCanonicalCuttingPath('fei-ticket-records'), {
            printableUnitId: printableUnit.printableUnitId,
            printableUnitNo: printableUnit.printableUnitNo,
            printableUnitType: printableUnit.printableUnitType,
            cutOrderId: printableUnit.cutOrderId,
            cutOrderNo: printableUnit.cutOrderNo,
        }))}">查看打印记录</button>
                  `
        : ''}
            </div>
          </div>
        `)}

      ${renderDetailSection('铺布摘要', `
          <div class="space-y-3">
            ${renderInfoGrid([
        { label: '相关唛架数', value: `${markerSpreadingCounts.markerCount} 条`, tone: 'strong' },
        { label: '铺布 session 数', value: `${markerSpreadingCounts.sessionCount} 条` },
        { label: '卷记录数', value: `${markerSpreadingCounts.rollCount} 条` },
        { label: '人员记录数', value: `${markerSpreadingCounts.operatorCount} 条` },
        { label: '铺布单累计', value: `${markerSpreadingCounts.sessionCount} 张 / ${markerSpreadingCounts.rollCount} 卷` },
        { label: '累计铺布进度', value: markerSpreadingCounts.statusSummary, tone: 'strong' },
        { label: '最近铺布记录', value: markerSpreadingCounts.latestSessionNo },
        { label: '是否已完成人员分摊', value: markerSpreadingCounts.hasOperatorAllocation ? '已形成按人分摊' : '待补录分摊' },
        { label: '人员金额摘要', value: `${formatCutOrderCurrency(markerSpreadingCounts.operatorAmountTotal)}` },
        { label: '人工调价', value: markerSpreadingCounts.hasManualAdjustedAmount ? '存在人工调整金额' : '当前未人工调整' },
        { label: '补料预警', value: markerSpreadingCounts.hasReplenishmentWarning ? `有预警（${markerSpreadingCounts.warningLevelLabel}）` : '当前无明显预警' },
        { label: '建议动作', value: markerSpreadingCounts.suggestedAction },
        { label: '补料配料待处理', value: buildPendingPrepSummaryText(row) },
    ])}
            <div class="flex flex-wrap gap-2">
              ${canEnterExecution ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-marker-plan" data-record-id="${escapeHtml(row.id)}">去唛架</button>` : ''}
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-replenishment" data-record-id="${escapeHtml(row.id)}">去补料管理</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-material-prep" data-record-id="${escapeHtml(row.id)}">去待加工仓</button>
            </div>
          </div>
        `)}

      ${renderDetailSection('来料异议摘要', `
          <div class="space-y-3">
            ${renderInfoGrid([
        { label: '当前是否存在来料异议', value: latestClaimDispute ? '存在' : '暂无' },
        { label: '异议状态', value: latestClaimDispute ? getClaimDisputeStatusLabel(latestClaimDispute.status) : '暂无异议', tone: 'strong' },
        { label: '差异长度（m）', value: latestClaimDispute ? `${latestClaimDispute.discrepancyQty} 米` : '0 米' },
        { label: '处理结论', value: latestClaimDispute?.handleConclusion || '待平台处理' },
        { label: '提交时间', value: latestClaimDispute?.submittedAt || '待补' },
        { label: '证据份数（个）', value: latestClaimDispute ? `${latestClaimDispute.evidenceCount} 个` : '0 个' },
    ])}
            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-material-prep" data-record-id="${escapeHtml(row.id)}">去待加工仓</button>
            </div>
          </div>
        `)}

      ${renderDetailSection('关联单据 / 关联入口', `
          <div class="flex flex-wrap gap-2">
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-material-prep" data-record-id="${escapeHtml(row.id)}">去待加工仓</button>
            ${canEnterExecution ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-marker-plan" data-record-id="${escapeHtml(row.id)}">去唛架</button>` : ''}
            ${canEnterFeiTickets ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-fei-tickets" data-record-id="${escapeHtml(row.id)}">去打印菲票</button>` : ''}
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-replenishment" data-record-id="${escapeHtml(row.id)}">去补料管理</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-production-progress" data-record-id="${escapeHtml(row.id)}">返回裁床生产单总览</button>
          </div>
        `)}

      ${renderDetailSection('轻量执行痕迹', `
          ${renderInfoGrid([
        { label: '最近状态摘要', value: row.statusSummary },
        { label: '最近动作', value: row.latestActionText },
    ])}
        `)}

      ${renderCuttingWebOperationRecords(webOperationRecords)}
    </div>
  `;
    return uiDetailDrawer({
        title: row.cutOrderNo,
        subtitle: '',
        closeAction: { prefix: 'cuttingPiece', action: 'close-overlay' },
        width: 'lg',
    }, content, extraButtons);
}
function renderPage() {
    applyWebActionFromUrl();
    const viewModel = getViewModel();
    syncStateFromPath(viewModel);
    const rows = getDisplayRows(viewModel);
    const pathname = appStore.getState().pathname;
    const meta = getCanonicalCuttingMeta(pathname, 'cut-orders');
    return `
    <div class="space-y-3 p-4" data-testid="cutting-cut-orders-page">
      ${renderCuttingPageHeader(meta, {
        showAliasBadge: isCuttingAliasPath(pathname),
    })}
      ${renderFeedbackBar()}
      ${buildStatsCards(rows)}
      ${renderPrefilterBar()}
      ${renderFilterArea()}
      ${renderFilterStateBar()}
      ${renderTable(rows)}
      ${renderDetailDrawer(viewModel)}
    </div>
  `;
}
function navigateToRecordTarget(recordId, target) {
    if (!recordId)
        return false;
    const row = getViewModel().rowsById[recordId];
    if (!row)
        return false;
    if ((target === 'markerPlan' || target === 'spreadingList') && !isCutOrderInExecutionStage(row)) {
        setFeedback('warning', '当前裁片单尚未完成领料，不能进入唛架或铺布执行。');
        return true;
    }
    if (target === 'feiTickets' && !isPrintableSourceRow(row)) {
        setFeedback('warning', '当前裁片单尚未进入可打印阶段，不能打印菲票。');
        return true;
    }
    const payload = target === 'markerPlan' || target === 'spreadingList'
        ? row.navigationPayload.markerSpreading
        : row.navigationPayload[target];
    const context = buildCuttingDrillContext(payload, 'cut-orders', {
        productionOrderId: row.productionOrderId,
        productionOrderNo: row.productionOrderNo,
        cutOrderId: row.cutOrderId,
        cutOrderNo: row.cutOrderNo,
        markerPlanNo: row.latestMarkerPlanNo || undefined,
        styleCode: row.styleCode,
        spuCode: row.spuCode,
        materialSku: row.materialSku,
        autoOpenDetail: true,
    });
    appStore.navigate(buildCuttingRouteWithContext(target === 'sameProductionOrders'
        ? 'cutOrders'
        : target === 'markerPlan'
            ? 'markerPlan'
            : target === 'spreadingList'
                ? 'spreadingList'
                : target, context));
    return true;
}
export function renderCraftCuttingCutOrdersPage() {
    return renderPage();
}
export function handleCraftCuttingCutOrdersEvent(target) {
    const pageSizeNode = target.closest('[data-cutting-piece-page-size]');
    if (pageSizeNode) {
        const input = pageSizeNode;
        state.pageSize = Number(input.value) || 20;
        state.page = 1;
        return true;
    }
    const fieldNode = target.closest('[data-cutting-piece-field]');
    if (fieldNode) {
        const field = fieldNode.dataset.cuttingPieceField;
        if (!field)
            return false;
        const filterKey = FIELD_TO_FILTER_KEY[field];
        const input = fieldNode;
        state.filters = {
            ...state.filters,
            [filterKey]: input.value,
        };
        resetPagination();
        return true;
    }
    const actionNode = target.closest('[data-cutting-piece-action]');
    const action = actionNode?.dataset.cuttingPieceAction;
    if (!action)
        return false;
    if (action === 'toggle-risk-only') {
        state.filters = {
            ...state.filters,
            riskOnly: !state.filters.riskOnly,
        };
        resetPagination();
        return true;
    }
    if (action === 'clear-filters') {
        state.filters = { ...initialFilters };
        resetPagination();
        return true;
    }
    if (action === 'clear-prefilter') {
        state.prefilter = null;
        state.drillContext = null;
        state.activeOrderId = null;
        state.querySignature = getCanonicalCuttingPath('cut-orders');
        appStore.navigate(getCanonicalCuttingPath('cut-orders'));
        return true;
    }
    if (action === 'open-detail') {
        state.activeOrderId = actionNode.dataset.recordId ?? null;
        return true;
    }
    if (action === 'print-task-route-card') {
        const recordId = actionNode.dataset.recordId;
        const row = recordId ? getViewModel().rowsById[recordId] : null;
        if (!row)
            return false;
        appStore.navigate(buildTaskRouteCardPrintLink('CUTTING_ORDER', row.cutOrderId));
        return true;
    }
    if (action === 'print-cutting-order-qr') {
        const recordId = actionNode.dataset.recordId;
        const row = recordId ? getViewModel().rowsById[recordId] : null;
        if (!row)
            return false;
        appStore.navigate(buildCuttingOrderQrLabelPrintLink(row.cutOrderId));
        return true;
    }
    if (action === 'web-status-action') {
        const sourceId = actionNode.dataset.sourceId;
        const actionCode = actionNode.dataset.actionCode;
        if (!sourceId || !actionCode)
            return true;
        try {
            const result = executeProcessWebAction({
                sourceType: 'CUTTING_ORDER',
                sourceId,
                actionCode,
                operatorName: 'Web 端裁床操作员',
                operatedAt: '2026-04-28 10:00',
                remark: '裁片 Web 端状态操作，菲票归属仍回落裁片单',
            });
            setFeedback('success', result.message);
        }
        catch (error) {
            setFeedback('warning', error instanceof Error ? error.message : '状态操作失败');
        }
        return true;
    }
    if (action === 'close-overlay') {
        state.activeOrderId = null;
        return true;
    }
    if (action === 'set-page') {
        state.page = Number(actionNode.dataset.page) || 1;
        return true;
    }
    if (action === 'go-production-progress') {
        return navigateToRecordTarget(actionNode.dataset.recordId, 'productionProgress');
    }
    if (action === 'go-material-prep') {
        return navigateToRecordTarget(actionNode.dataset.recordId, 'materialPrep');
    }
    if (action === 'go-marker-plan') {
        return navigateToRecordTarget(actionNode.dataset.recordId, 'markerPlan');
    }
    if (action === 'go-marker-spreading') {
        return navigateToRecordTarget(actionNode.dataset.recordId, 'spreadingList');
    }
    if (action === 'go-spreading') {
        return navigateToRecordTarget(actionNode.dataset.recordId, 'spreadingList');
    }
    if (action === 'go-fei-tickets') {
        return navigateToRecordTarget(actionNode.dataset.recordId, 'feiTickets');
    }
    if (action === 'go-replenishment') {
        return navigateToRecordTarget(actionNode.dataset.recordId, 'replenishment');
    }
    if (action === 'go-marker-plan') {
        const row = actionNode.dataset.recordId ? getViewModel().rowsById[actionNode.dataset.recordId] : null;
        if (!row?.batchParticipationCount) {
            setFeedback('warning', '当前没有关联的唛架方案，无法跳转。');
            return true;
        }
        return navigateToRecordTarget(actionNode.dataset.recordId, 'markerPlanRefs');
    }
    if (action === 'clear-feedback') {
        clearFeedback();
        return true;
    }
    if (action === 'go-same-production-orders') {
        state.activeOrderId = null;
        return navigateToRecordTarget(actionNode.dataset.recordId, 'sameProductionOrders');
    }
    if (action === 'go-production-progress-index') {
        appStore.navigate(getCanonicalCuttingPath('production-progress'));
        return true;
    }
    if (action === 'go-marker-plan-index') {
        appStore.navigate(getCanonicalCuttingPath('marker-list'));
        return true;
    }
    if (action === 'go-summary-index') {
        appStore.navigate(getCanonicalCuttingPath('summary'));
        return true;
    }
    if (action === 'return-summary') {
        const context = buildReturnToSummaryContext(state.drillContext);
        if (!context)
            return false;
        appStore.navigate(buildCuttingRouteWithContext('summary', context));
        return true;
    }
    return false;
}
export function isCraftCuttingCutOrdersDialogOpen() {
    return state.activeOrderId !== null;
}
