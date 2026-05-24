import { renderDetailDrawer as uiDetailDrawer } from '../../../components/ui/index.ts';
import { normalizeSampleWarehouseWritebackInput } from '../../../data/fcs/cutting/warehouse-writeback-inputs.ts';
import { submitSampleWarehouseWriteback } from '../../../domain/cutting-warehouse-writeback/bridge.ts';
import { appStore } from '../../../state/store.ts';
import { escapeHtml, formatDateTime } from '../../../utils.ts';
import { filterSampleWarehouseItems, findSampleWarehouseByPrefilter, sampleLocationTypeLabel, sampleWarehouseStatusMeta, } from './sample-warehouse-model.ts';
import { buildSampleWarehouseProjection } from './sample-warehouse-projection.ts';
import { renderCompactKpiCard, renderStickyFilterShell, renderStickyTableScroller, renderWorkbenchFilterChip, renderWorkbenchStateBar, } from './layout.helpers.ts';
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, isCuttingAliasPath, renderCuttingPageHeader } from './meta.ts';
import { buildWarehouseRouteWithQuery, getWarehouseSearchParams, } from './warehouse-shared.ts';
import { renderMaterialIdentityBlock } from './material-identity.ts';
const initialFilters = {
    keyword: '',
    status: 'ALL',
    locationType: 'ALL',
    holder: '',
};
const FIELD_TO_FILTER_KEY = {
    keyword: 'keyword',
    status: 'status',
    locationType: 'locationType',
    holder: 'holder',
};
const state = {
    filters: { ...initialFilters },
    activeItemId: null,
    prefilter: null,
    querySignature: '',
    detailDraft: {
        locationType: 'production-center',
        holder: '',
        note: '',
    },
};
function getProjection() {
    return buildSampleWarehouseProjection();
}
function getViewModel() {
    return getProjection().viewModel;
}
function getFilteredItems() {
    return filterSampleWarehouseItems(getViewModel().items, state.filters, state.prefilter);
}
function getActiveTab() {
    const raw = getWarehouseSearchParams().get('tab');
    if (raw === 'circulation' || raw === 'exception')
        return raw;
    return 'inventory';
}
function buildSampleWarehouseTabPath(tab) {
    const basePath = getCanonicalCuttingPath('sample-warehouse');
    return tab === 'inventory' ? basePath : `${basePath}?tab=${encodeURIComponent(tab)}`;
}
function filterItemsByTab(items, tab) {
    if (tab === 'circulation') {
        return items.filter((item) => ['BORROWED', 'IN_FACTORY', 'INSPECTION', 'PENDING_RETURN'].includes(item.status.key));
    }
    if (tab === 'exception') {
        return items.filter((item) => ['INSPECTION', 'PENDING_RETURN'].includes(item.status.key));
    }
    return items.filter((item) => ['AVAILABLE', 'IN_FACTORY'].includes(item.status.key));
}
function renderTabButton(tab, label, count) {
    const isActive = getActiveTab() === tab;
    return `
    <button
      type="button"
      class="flex min-w-40 flex-col rounded-lg px-3 py-2 text-left ${isActive ? 'bg-slate-900 text-white' : 'border bg-card text-slate-700 hover:bg-muted'}"
      data-nav="${escapeHtml(buildSampleWarehouseTabPath(tab))}"
    >
      <span class="text-sm font-semibold">${escapeHtml(label)}</span>
      <span class="mt-1 text-xs ${isActive ? 'text-slate-200' : 'text-muted-foreground'}">当前 ${escapeHtml(String(count))} 条</span>
    </button>
  `;
}
function renderTabSection(items) {
    const inventoryCount = items.filter((item) => ['AVAILABLE', 'IN_FACTORY'].includes(item.status.key)).length;
    const circulationCount = items.filter((item) => ['BORROWED', 'IN_FACTORY', 'INSPECTION', 'PENDING_RETURN'].includes(item.status.key)).length;
    const exceptionCount = items.filter((item) => ['INSPECTION', 'PENDING_RETURN'].includes(item.status.key)).length;
    return `
    <section class="rounded-xl border bg-card p-4">
      <div class="flex flex-wrap gap-2">
        ${renderTabButton('inventory', '样衣库存', inventoryCount)}
        ${renderTabButton('circulation', '样衣流转', circulationCount)}
        ${renderTabButton('exception', '样衣异常 / 待归还', exceptionCount)}
      </div>
      <div class="mt-4 rounded-lg border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
        ${getActiveTab() === 'inventory'
        ? '聚焦在仓样衣与在工厂样衣，借出、归还和样衣详情继续通过列表行操作或详情抽屉处理。'
        : getActiveTab() === 'circulation'
            ? '聚焦样衣借出、工厂流转和抽检记录，调用记录、归还操作和样衣详情继续通过列表行操作或详情抽屉处理。'
            : '聚焦待归还与抽检中的样衣，差异说明、归还确认和盘点记录继续通过列表行操作或详情抽屉处理。'}
      </div>
    </section>
  `;
}
function getPrefilterFromQuery() {
    const params = getWarehouseSearchParams();
    const prefilter = {
        cutOrderId: params.get('cutOrderId') || undefined,
        productionOrderId: params.get('productionOrderId') || undefined,
        materialSku: params.get('materialSku') || undefined,
        styleCode: params.get('styleCode') || undefined,
        sampleNo: params.get('sampleNo') || undefined,
        holder: params.get('holder') || undefined,
        status: params.get('status') || undefined,
    };
    return Object.values(prefilter).some(Boolean) ? prefilter : null;
}
function syncPrefilterFromQuery() {
    const pathname = appStore.getState().pathname;
    if (pathname === state.querySignature)
        return;
    state.querySignature = pathname;
    state.prefilter = getPrefilterFromQuery();
    const matched = findSampleWarehouseByPrefilter(getViewModel().items, state.prefilter);
    state.activeItemId = matched?.sampleItemId ?? null;
    syncDetailDraft();
}
function getActiveItem() {
    if (!state.activeItemId)
        return null;
    return getViewModel().itemsById[state.activeItemId] ?? null;
}
function syncDetailDraft() {
    const item = getActiveItem();
    if (!item)
        return;
    state.detailDraft = {
        locationType: item.currentLocationType,
        holder: item.currentHolder,
        note: item.note,
    };
}
function renderTag(label, className) {
    return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`;
}
function renderHeaderActions() {
    return `
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-sample-warehouse-action="go-cut-orders-index">查看相关裁片单 / 款号</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-sample-warehouse-action="go-summary-index">查看裁剪结果核查</button>
    </div>
  `;
}
function renderFilterSelect(label, field, value, options, attrName) {
    return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <select
        class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        ${attrName}="${field}"
      >
        ${options
        .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
        .join('')}
      </select>
    </label>
  `;
}
function renderStatsCards() {
    const summary = getViewModel().summary;
    return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      ${renderCompactKpiCard('样衣总数', summary.totalSampleCount, '当前样衣主档数量', 'text-slate-900')}
      ${renderCompactKpiCard('在仓数', summary.availableCount, '可再次调用的样衣', 'text-emerald-600')}
      ${renderCompactKpiCard('借出中数', summary.borrowedCount, '在裁床 / 工厂流转中', 'text-sky-600')}
      ${renderCompactKpiCard('抽检中数', summary.inInspectionCount, '等待抽检或回流确认', 'text-amber-600')}
      ${renderCompactKpiCard('流转记录数', summary.flowRecordCount, '所有样衣流转留痕', 'text-violet-600')}
    </section>
  `;
}
function renderPrefilterBar() {
    if (!state.prefilter)
        return '';
    const labels = [
        state.prefilter.styleCode ? `款号：${state.prefilter.styleCode}` : '',
        state.prefilter.sampleNo ? `样衣号：${state.prefilter.sampleNo}` : '',
        state.prefilter.holder ? `持有人：${state.prefilter.holder}` : '',
        state.prefilter.status ? `状态：${sampleWarehouseStatusMeta[state.prefilter.status].label}` : '',
    ].filter(Boolean);
    return renderWorkbenchStateBar({
        summary: '当前按外部上下文预筛样衣仓记录',
        chips: labels.map((label) => renderWorkbenchFilterChip(label, 'data-sample-warehouse-action="clear-prefilter"', 'amber')),
        clearAttrs: 'data-sample-warehouse-action="clear-prefilter"',
    });
}
function renderFilterStateBar() {
    const labels = [];
    if (state.filters.keyword.trim())
        labels.push(`关键词：${state.filters.keyword.trim()}`);
    if (state.filters.status !== 'ALL')
        labels.push(`状态：${sampleWarehouseStatusMeta[state.filters.status].label}`);
    if (state.filters.locationType !== 'ALL')
        labels.push(`位置类型：${sampleLocationTypeLabel[state.filters.locationType]}`);
    if (state.filters.holder.trim())
        labels.push(`持有人：${state.filters.holder.trim()}`);
    if (!labels.length)
        return '';
    return renderWorkbenchStateBar({
        summary: '当前样衣仓视图条件',
        chips: labels.map((label) => renderWorkbenchFilterChip(label, 'data-sample-warehouse-action="clear-filters"', 'blue')),
        clearAttrs: 'data-sample-warehouse-action="clear-filters"',
    });
}
function renderFilterArea() {
    return renderStickyFilterShell(`
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <label class="space-y-2 xl:col-span-2">
        <span class="text-sm font-medium text-foreground">关键词</span>
        <input
          type="text"
          value="${escapeHtml(state.filters.keyword)}"
          placeholder="支持样衣号 / 款号 / 持有人"
          class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          data-sample-warehouse-field="keyword"
        />
      </label>
      ${renderFilterSelect('状态筛选', 'status', state.filters.status, [
        { value: 'ALL', label: '全部' },
        { value: 'AVAILABLE', label: '在仓' },
        { value: 'BORROWED', label: '借出中' },
        { value: 'IN_FACTORY', label: '在工厂' },
        { value: 'INSPECTION', label: '抽检中' },
        { value: 'PENDING_RETURN', label: '待归还' },
    ], 'data-sample-warehouse-field')}
      ${renderFilterSelect('位置类型', 'locationType', state.filters.locationType, [
        { value: 'ALL', label: '全部' },
        { value: 'cutting-room', label: '裁床现场' },
        { value: 'production-center', label: '生产管理中心' },
        { value: 'factory', label: '工厂' },
        { value: 'inspection', label: '抽检' },
    ], 'data-sample-warehouse-field')}
      <label class="space-y-2">
        <span class="text-sm font-medium text-foreground">持有人</span>
        <input
          type="text"
          value="${escapeHtml(state.filters.holder)}"
          placeholder="支持人员或部门"
          class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          data-sample-warehouse-field="holder"
        />
      </label>
    </div>
  `);
}
function renderTable(items) {
    if (!items.length) {
        const emptyText = getActiveTab() === 'inventory'
            ? '当前筛选条件下暂无样衣库存记录。'
            : getActiveTab() === 'circulation'
                ? '当前筛选条件下暂无样衣流转记录。'
                : '当前筛选条件下暂无样衣异常 / 待归还记录。';
        return `<section class="rounded-lg border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">${escapeHtml(emptyText)}</section>`;
    }
    return renderStickyTableScroller(`
    <table class="min-w-full text-sm">
      <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
        <tr>
          <th class="px-4 py-3 text-left">样衣编号</th>
          <th class="px-4 py-3 text-left">面料 / 款号</th>
          <th class="px-4 py-3 text-left">颜色 / 尺码</th>
          <th class="px-4 py-3 text-left">当前状态</th>
          <th class="px-4 py-3 text-left">当前位置</th>
          <th class="px-4 py-3 text-left">当前持有人</th>
          <th class="px-4 py-3 text-left">最近流转时间</th>
          <th class="px-4 py-3 text-left">操作</th>
        </tr>
      </thead>
      <tbody>
        ${items
        .map((item) => `
              <tr class="border-b align-top ${state.activeItemId === item.sampleItemId ? 'bg-blue-50/60' : 'bg-card'}">
                <td class="px-4 py-3">
                  <button type="button" class="font-medium text-blue-700 hover:underline" data-sample-warehouse-action="open-detail" data-item-id="${escapeHtml(item.sampleItemId)}">${escapeHtml(item.sampleNo)}</button>
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.sampleName)}</div>
                </td>
                <td class="px-4 py-3">
                  ${renderMaterialIdentityBlock(item, { compact: true })}
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.styleCode || item.spuCode || '待补款号')}</div>
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.relatedProductionOrderNo)}</div>
                </td>
                <td class="px-4 py-3">${escapeHtml(`${item.color} / ${item.size}`)}</td>
                <td class="px-4 py-3">${renderTag(item.status.label, item.status.className)}</td>
                <td class="px-4 py-3">${escapeHtml(item.currentLocationName)}</td>
                <td class="px-4 py-3">${escapeHtml(item.currentHolder)}</td>
                <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(formatDateTime(item.lastMovedAt))}</td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-2">
                    <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-sample-warehouse-action="open-detail" data-item-id="${escapeHtml(item.sampleItemId)}">查看详情</button>
                    <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-sample-warehouse-action="borrow" data-item-id="${escapeHtml(item.sampleItemId)}">借出</button>
                    <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-sample-warehouse-action="return" data-item-id="${escapeHtml(item.sampleItemId)}">归还</button>
                  </div>
                </td>
              </tr>
            `)
        .join('')}
      </tbody>
    </table>
  `);
}
function renderDetailDrawer() {
    const item = getActiveItem();
    if (!item)
        return '';
    return uiDetailDrawer({
        title: `样衣详情 · ${item.sampleNo}`,
        subtitle: '',
        closeAction: { prefix: 'sample-warehouse', action: 'close-detail' },
        width: 'lg',
    }, `
      <div class="space-y-6 text-sm">
        <section class="grid gap-3 md:grid-cols-2">
          <div class="rounded-lg border bg-muted/20 p-3">
            <div class="text-xs text-muted-foreground">相关裁片单</div>
            <div class="mt-1 font-medium text-foreground">${escapeHtml(item.relatedCutOrderNo)}</div>
          </div>
          <div class="rounded-lg border bg-muted/20 p-3">
            <div class="text-xs text-muted-foreground">面料</div>
            <div class="mt-2">${renderMaterialIdentityBlock(item)}</div>
          </div>
          <div class="rounded-lg border bg-muted/20 p-3">
            <div class="text-xs text-muted-foreground">来源生产单号</div>
            <div class="mt-1 font-medium text-foreground">${escapeHtml(item.relatedProductionOrderNo)}</div>
          </div>
          <div class="rounded-lg border bg-muted/20 p-3">
            <div class="text-xs text-muted-foreground">当前状态</div>
            <div class="mt-1">${renderTag(item.status.label, item.status.className)}</div>
          </div>
          <div class="rounded-lg border bg-muted/20 p-3">
            <div class="text-xs text-muted-foreground">当前位置 / 持有人</div>
            <div class="mt-1 font-medium text-foreground">${escapeHtml(`${item.currentLocationName} / ${item.currentHolder}`)}</div>
          </div>
        </section>

        <section class="rounded-lg border bg-card p-4">
          <h3 class="text-sm font-semibold text-foreground">位置与动作</h3>
          <div class="mt-4 grid gap-3 md:grid-cols-2">
            ${renderFilterSelect('位置类型', 'locationType', state.detailDraft.locationType, [
        { value: 'production-center', label: '生产管理中心' },
        { value: 'cutting-room', label: '裁床现场' },
        { value: 'factory', label: '工厂' },
        { value: 'inspection', label: '抽检' },
    ], 'data-sample-warehouse-detail-field')}
            <label class="space-y-2">
              <span class="text-sm font-medium text-foreground">当前持有人</span>
              <input
                type="text"
                value="${escapeHtml(state.detailDraft.holder)}"
                placeholder="例如 样衣管理员 / 裁床组 / 抽检员"
                class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                data-sample-warehouse-detail-field="holder"
              />
            </label>
            <label class="space-y-2 md:col-span-2">
              <span class="text-sm font-medium text-foreground">备注</span>
              <textarea
                class="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                data-sample-warehouse-detail-field="note"
              >${escapeHtml(state.detailDraft.note)}</textarea>
            </label>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-sample-warehouse-action="borrow" data-item-id="${escapeHtml(item.sampleItemId)}">借出</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-sample-warehouse-action="return" data-item-id="${escapeHtml(item.sampleItemId)}">归还</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-sample-warehouse-action="transfer" data-item-id="${escapeHtml(item.sampleItemId)}">调拨位置</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-sample-warehouse-action="mark-inspection" data-item-id="${escapeHtml(item.sampleItemId)}">标记抽检中</button>
          </div>
        </section>

        <section class="rounded-lg border bg-card">
          <div class="border-b px-4 py-3">
            <h3 class="text-sm font-semibold text-foreground">流转记录</h3>
          </div>
          <div class="overflow-auto">
            <table class="min-w-full text-sm">
              <thead class="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th class="px-3 py-2 text-left">时间</th>
                  <th class="px-3 py-2 text-left">动作</th>
                  <th class="px-3 py-2 text-left">流转路径</th>
                  <th class="px-3 py-2 text-left">操作人</th>
                  <th class="px-3 py-2 text-left">备注</th>
                </tr>
              </thead>
              <tbody>
                ${item.flowRecords
        .map((flow) => `
                      <tr class="border-t align-top">
                        <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(formatDateTime(flow.actionAt))}</td>
                        <td class="px-3 py-2 font-medium text-foreground">${escapeHtml(flow.actionType)}</td>
                        <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(`${flow.fromLocationName} → ${flow.toLocationName}`)}</td>
                        <td class="px-3 py-2">${escapeHtml(flow.operatorName)}</td>
                        <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(flow.note || '-')}</td>
                      </tr>
                    `)
        .join('')}
              </tbody>
            </table>
          </div>
        </section>

        <section class="rounded-lg border border-dashed bg-blue-50/60 p-4">
          <h3 class="text-sm font-semibold text-foreground">关联信息</h3>
          <div class="mt-2 grid gap-3 md:grid-cols-2">
            <div>
              <div class="text-xs text-muted-foreground">款号 / SPU</div>
              <div class="mt-1 font-medium text-foreground">${escapeHtml(item.styleCode || item.spuCode || '待补款号')}</div>
            </div>
            <div>
              <div class="text-xs text-muted-foreground">最近动作人</div>
              <div class="mt-1 font-medium text-foreground">${escapeHtml(item.latestActionBy)}</div>
            </div>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-white" data-sample-warehouse-action="go-cut-orders" data-item-id="${escapeHtml(item.sampleItemId)}">查看相关裁片单</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-white" data-sample-warehouse-action="go-summary" data-item-id="${escapeHtml(item.sampleItemId)}">去裁剪结果核查</button>
          </div>
        </section>
      </div>
    `);
}
function renderPage() {
    syncPrefilterFromQuery();
    const pathname = appStore.getState().pathname;
    const meta = getCanonicalCuttingMeta(pathname, 'sample-warehouse');
    const items = filterItemsByTab(getFilteredItems(), getActiveTab());
    return `
    <div class="space-y-3 p-4">
      ${renderCuttingPageHeader(meta, {
        showAliasBadge: isCuttingAliasPath(pathname),
        actionsHtml: renderHeaderActions(),
    })}
      ${renderStatsCards()}
      ${renderTabSection(getViewModel().items)}
      ${renderPrefilterBar()}
      ${renderFilterArea()}
      ${renderFilterStateBar()}
      ${renderTable(items)}
      ${renderDetailDrawer()}
    </div>
  `;
}
function navigateByPayload(itemId, target) {
    if (!itemId)
        return false;
    const item = getViewModel().itemsById[itemId];
    if (!item)
        return false;
    const pathMap = {
        cutOrders: getCanonicalCuttingPath('cut-orders'),
        materialPrep: getCanonicalCuttingPath('warehouse-management-wait-process'),
        summary: getCanonicalCuttingPath('summary'),
        transferBags: getCanonicalCuttingPath('transfer-bags'),
    };
    appStore.navigate(buildWarehouseRouteWithQuery(pathMap[target], item.navigationPayload[target]));
    return true;
}
function submitWarehouseAction(itemId, actionType) {
    if (!itemId)
        return false;
    const item = getViewModel().itemsById[itemId];
    if (!item)
        return false;
    const payload = normalizeSampleWarehouseWritebackInput({
        actionType,
        identity: {
            sampleRecordId: item.sampleItemId,
            cutOrderId: item.relatedCutOrderId,
            cutOrderNo: item.relatedCutOrderNo,
            productionOrderId: item.relatedProductionOrderId,
            productionOrderNo: item.relatedProductionOrderNo,
            materialSku: item.materialSku,
        },
        locationType: state.detailDraft.locationType,
        holder: actionType === 'SAMPLE_WAREHOUSE_RETURN'
            ? 'PMC 样衣仓'
            : state.detailDraft.holder.trim() || item.currentHolder,
        note: state.detailDraft.note.trim() || item.note,
    });
    const result = submitSampleWarehouseWriteback(payload);
    if (!result.success)
        return false;
    state.activeItemId = itemId;
    syncDetailDraft();
    return true;
}
export function renderCraftCuttingSampleWarehousePage() {
    return renderPage();
}
export function handleCraftCuttingSampleWarehouseEvent(target) {
    const fieldNode = target.closest('[data-sample-warehouse-field]');
    if (fieldNode) {
        const field = fieldNode.dataset.sampleWarehouseField;
        if (!field)
            return false;
        const input = fieldNode;
        const filterKey = FIELD_TO_FILTER_KEY[field];
        state.filters = {
            ...state.filters,
            [filterKey]: input.value,
        };
        return true;
    }
    const detailFieldNode = target.closest('[data-sample-warehouse-detail-field]');
    if (detailFieldNode) {
        const field = detailFieldNode.dataset.sampleWarehouseDetailField;
        if (!field)
            return false;
        const input = detailFieldNode;
        state.detailDraft = {
            ...state.detailDraft,
            [field]: input.value,
        };
        return true;
    }
    const actionNode = target.closest('[data-sample-warehouse-action]');
    const action = actionNode?.dataset.sampleWarehouseAction;
    if (!action)
        return false;
    if (action === 'clear-filters') {
        state.filters = { ...initialFilters };
        return true;
    }
    if (action === 'clear-prefilter') {
        state.prefilter = null;
        state.activeItemId = null;
        state.querySignature = buildSampleWarehouseTabPath(getActiveTab());
        appStore.navigate(buildSampleWarehouseTabPath(getActiveTab()));
        return true;
    }
    if (action === 'open-detail') {
        state.activeItemId = actionNode.dataset.itemId ?? null;
        syncDetailDraft();
        return true;
    }
    if (action === 'close-detail') {
        state.activeItemId = null;
        return true;
    }
    if (action === 'borrow')
        return submitWarehouseAction(actionNode.dataset.itemId || state.activeItemId || undefined, 'SAMPLE_WAREHOUSE_BORROW');
    if (action === 'return')
        return submitWarehouseAction(actionNode.dataset.itemId || state.activeItemId || undefined, 'SAMPLE_WAREHOUSE_RETURN');
    if (action === 'transfer')
        return submitWarehouseAction(actionNode.dataset.itemId || state.activeItemId || undefined, 'SAMPLE_WAREHOUSE_TRANSFER');
    if (action === 'mark-inspection')
        return submitWarehouseAction(actionNode.dataset.itemId || state.activeItemId || undefined, 'SAMPLE_WAREHOUSE_MARK_INSPECTION');
    if (action === 'go-cut-orders')
        return navigateByPayload(actionNode.dataset.itemId || state.activeItemId || undefined, 'cutOrders');
    if (action === 'go-summary')
        return navigateByPayload(actionNode.dataset.itemId || state.activeItemId || undefined, 'summary');
    if (action === 'go-cut-orders-index') {
        appStore.navigate(getCanonicalCuttingPath('cut-orders'));
        return true;
    }
    if (action === 'go-summary-index') {
        appStore.navigate(getCanonicalCuttingPath('summary'));
        return true;
    }
    return false;
}
export function isCraftCuttingSampleWarehouseDialogOpen() {
    return state.activeItemId !== null;
}
