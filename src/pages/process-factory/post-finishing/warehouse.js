import { listPostFinishingWarehouseAreas, listPostFinishingWarehouseLocations, listPostFinishingWaitHandoverWarehouseRecords, listPostFinishingWaitProcessWarehouseRecords, } from '../../../data/fcs/post-finishing-domain.ts';
import { escapeHtml } from '../../../utils.ts';
import { formatGarmentQty, getPostListFilters, paginatePostRows, postFilterTextMatches, renderPostPagination, } from './shared.ts';
const TABS = [
    { key: 'inventory', label: '库存' },
    { key: 'flow', label: '流水记录' },
    { key: 'locations', label: '库区库位' },
];
function basePath(mode) {
    return mode === 'wait-process' ? '/fcs/craft/post-finishing/wait-process-warehouse' : '/fcs/craft/post-finishing/wait-handover-warehouse';
}
function title(mode) {
    return mode === 'wait-process' ? '后道待加工仓' : '后道待交出仓';
}
function params() {
    return typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
}
function activeTab() {
    const value = params().get('tab');
    return value && TABS.some((tab) => tab.key === value) ? value : 'inventory';
}
function buildLink(mode, overrides) {
    const next = params();
    Object.entries(overrides).forEach(([key, value]) => {
        if (value === undefined || value === '' || value === '全部')
            next.delete(key);
        else
            next.set(key, String(value));
    });
    const query = next.toString();
    return `${basePath(mode)}${query ? `?${query}` : ''}`;
}
function closeTaskSkuDialogLink(mode) {
    return buildLink(mode, { taskSku: undefined });
}
function closeInventoryDetailDialogLink(mode) {
    return buildLink(mode, { inventoryDetail: undefined });
}
function records(mode) {
    return mode === 'wait-process' ? listPostFinishingWaitProcessWarehouseRecords() : listPostFinishingWaitHandoverWarehouseRecords();
}
function qty(record) {
    return 'availableGarmentQty' in record
        ? record.availableGarmentQty
        : Math.max(record.waitHandoverGarmentQty - record.submittedHandoverGarmentQty, 0);
}
function filterRows(input, mode) {
    const filters = getPostListFilters();
    return input.filter((record) => {
        if (filters.factory !== '全部' && record.managedPostFactoryName !== filters.factory)
            return false;
        const upstreamNo = 'upstreamHandoverRecordNo' in record ? record.upstreamHandoverRecordNo : '';
        return postFilterTextMatches(filters.keyword, [record.warehouseRecordNo, record.postOrderNo, upstreamNo || '', record.sourceProductionOrderNo, record.sourceTaskNo, record.managedPostFactoryName, record.spuCode, record.spuName, record.skuCode, record.colorName, record.sizeName, title(mode)]);
    });
}
function renderHeader(mode) {
    return `
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold text-foreground">${escapeHtml(title(mode))}</h1>
      </div>
      ${mode === 'wait-process' ? '<button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-post-finishing-action="open-receipt-dialog">扫码收货</button>' : ''}
    </header>
  `;
}
function metric(label, value, helper = '') {
    return `
    <article class="rounded-lg border bg-card px-4 py-3">
      <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-2 text-2xl font-semibold text-foreground">${escapeHtml(value)}</div>
      ${helper ? `<div class="mt-1 text-xs text-muted-foreground">${escapeHtml(helper)}</div>` : ''}
    </article>
  `;
}
function renderMetrics(input, mode) {
    const totalQty = input.reduce((sum, item) => sum + qty(item), 0);
    const activeCount = input.filter((item) => qty(item) > 0).length;
    const flowCount = input.reduce((sum, item) => sum + item.flowRecords.length, 0);
    const locationCount = listPostFinishingWarehouseLocations(mode).length;
    return `
    <section class="grid gap-3 md:grid-cols-4">
      ${metric(mode === 'wait-process' ? '待加工库存' : '待交出库存', formatGarmentQty(totalQty), '当前可用库存')}
      ${metric('库存项目', `${input.length} 条`, `${activeCount} 条有库存`)}
      ${metric('库区库位', `${locationCount} 个`, '支持新增、编辑、删除')}
      ${metric('流水记录', `${flowCount} 条`, mode === 'wait-process' ? '收货 + 质检 + 后道' : '复检入仓 + 交出出仓 + 接收回写')}
    </section>
  `;
}
function renderTabs(mode, current) {
    return `
    <nav class="inline-flex flex-wrap gap-1 rounded-md bg-muted p-1">
      ${TABS.map((tab) => `<button type="button" class="rounded px-3 py-1.5 text-sm ${tab.key === current ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'}" data-nav="${escapeHtml(buildLink(mode, { tab: tab.key, page: 1 }))}">${escapeHtml(tab.label)}</button>`).join('')}
    </nav>
  `;
}
function renderFilters(mode, input) {
    const filters = getPostListFilters();
    const factoryOptions = ['全部', ...Array.from(new Set(input.map((item) => item.managedPostFactoryName))).filter(Boolean)];
    return `
    <form class="rounded-lg border bg-card p-4" method="get" action="${escapeHtml(basePath(mode))}">
      <input type="hidden" name="tab" value="${escapeHtml(activeTab())}" />
      <input type="hidden" name="page" value="1" />
      <div class="grid gap-3 md:grid-cols-4">
        <label class="space-y-1 text-sm"><span class="text-xs text-muted-foreground">关键词</span><input class="h-9 w-full rounded-md border px-3 text-sm" name="keyword" value="${escapeHtml(filters.keyword)}" placeholder="SKU / 生产单 / 单号" /></label>
        <label class="space-y-1 text-sm"><span class="text-xs text-muted-foreground">工厂</span><select class="h-9 w-full rounded-md border px-3 text-sm" name="factory">${factoryOptions.map((value) => `<option value="${escapeHtml(value)}" ${filters.factory === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></label>
        <div class="flex items-end justify-end gap-2"><button type="button" class="h-9 rounded-md border px-3 text-sm" data-nav="${escapeHtml(basePath(mode))}">重置</button><button type="submit" class="h-9 rounded-md bg-blue-600 px-3 text-sm font-medium text-white">查询</button></div>
      </div>
    </form>
  `;
}
function table(headers, rows, minWidth = 'min-w-[1180px]') {
    return `
    <div class="overflow-x-auto">
      <table class="${minWidth} w-full text-left text-sm">
        <thead class="bg-slate-50 text-xs text-muted-foreground"><tr>${headers.map((header) => `<th class="px-3 py-2 font-medium">${escapeHtml(header)}</th>`).join('')}</tr></thead>
        <tbody>${rows || `<tr><td colspan="${headers.length}" class="px-3 py-8 text-center text-muted-foreground">暂无数据</td></tr>`}</tbody>
      </table>
    </div>
  `;
}
function listTaskSkuRows(record, records) {
    return records.filter((item) => (item.sourceProductionOrderNo === record.sourceProductionOrderNo
        && item.sourceTaskNo === record.sourceTaskNo));
}
function renderTaskSkuDialog(mode, records) {
    const taskKey = params().get('taskSku') || '';
    if (!taskKey)
        return '';
    const selected = records.find((record) => `${record.sourceProductionOrderNo}__${record.sourceTaskNo}` === taskKey);
    if (!selected)
        return '';
    const closeHref = escapeHtml(closeTaskSkuDialogLink(mode));
    const related = listTaskSkuRows(selected, records);
    const rows = related.map((record) => `
    <tr>
      <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.skuCode)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(record.spuName)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(record.colorName)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(record.sizeName)}</td>
      <td class="px-3 py-3 text-sm font-medium">${formatGarmentQty(qty(record), record.qtyUnit)}</td>
    </tr>
  `).join('');
    return `
    <div class="fixed inset-0 z-[120]">
      <button class="absolute inset-0 bg-black/45" data-nav="${closeHref}" aria-label="关闭弹窗"></button>
      <section class="absolute left-1/2 top-1/2 max-h-[82vh] w-[min(760px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border bg-card shadow-2xl">
        <header class="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 class="text-base font-semibold text-foreground">任务SKU明细</h2>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(selected.sourceProductionOrderNo)} / ${escapeHtml(selected.sourceTaskNo)}</div>
          </div>
          <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-nav="${closeHref}">关闭</button>
        </header>
        <div class="p-4">
          ${table(['SKU', '款式', '颜色', '尺码', mode === 'wait-process' ? '当前库存' : '待交出数量'], rows, 'min-w-[720px]')}
        </div>
      </section>
    </div>
  `;
}
function renderTaskButton(mode, record) {
    const taskKey = `${record.sourceProductionOrderNo}__${record.sourceTaskNo}`;
    return `<button type="button" class="font-mono text-xs text-blue-600 hover:underline" data-nav="${escapeHtml(buildLink(mode, { taskSku: taskKey }))}">${escapeHtml(record.sourceTaskNo)}</button>`;
}
function buildInventoryDetailRows(record, mode) {
    if ('areaName' in record && record.areaName) {
        return [{
                areaName: record.areaName,
                locationCode: record.locationCode || '仅库区',
                detailQty: qty(record),
            }];
    }
    const locations = listPostFinishingWarehouseLocations(mode);
    const fallbackLocations = locations.length > 0 ? locations : listPostFinishingWarehouseLocations(mode);
    const totalQty = qty(record);
    const rowCount = totalQty > 0
        ? Math.min(fallbackLocations.length || 1, Math.max(1, Math.min(3, totalQty)))
        : 1;
    const selectedLocations = fallbackLocations.slice(0, rowCount);
    if (selectedLocations.length === 0) {
        return [{
                areaName: '未分配',
                locationCode: '未分配库位',
                detailQty: totalQty,
            }];
    }
    let remainingQty = totalQty;
    const baseQty = rowCount > 0 ? Math.floor(totalQty / rowCount) : totalQty;
    const remainder = rowCount > 0 ? totalQty % rowCount : 0;
    return selectedLocations.map((location, index) => {
        const detailQty = index === selectedLocations.length - 1
            ? remainingQty
            : baseQty + (index < remainder ? 1 : 0);
        remainingQty -= detailQty;
        return {
            areaName: location.areaName,
            locationCode: location.locationCode,
            detailQty,
        };
    });
}
function renderInventoryDetailDialog(mode, allRecords) {
    const recordId = params().get('inventoryDetail') || '';
    if (!recordId)
        return '';
    const selected = allRecords.find((record) => record.warehouseRecordId === recordId);
    if (!selected)
        return '';
    const closeHref = escapeHtml(closeInventoryDetailDialogLink(mode));
    const detailRows = buildInventoryDetailRows(selected, mode);
    const detailTotal = detailRows.reduce((sum, row) => sum + row.detailQty, 0);
    const rows = detailRows.map((row) => `
    <tr>
      <td class="px-3 py-3 text-sm">${escapeHtml(row.areaName)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(row.locationCode)}</td>
      <td class="px-3 py-3 text-sm font-medium">${formatGarmentQty(row.detailQty, selected.qtyUnit)}</td>
    </tr>
  `).join('');
    return `
    <div class="fixed inset-0 z-[120]">
      <button class="absolute inset-0 bg-black/45" data-nav="${closeHref}" aria-label="关闭弹窗"></button>
      <section class="absolute left-1/2 top-1/2 max-h-[82vh] w-[min(820px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border bg-card shadow-2xl">
        <header class="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 class="text-base font-semibold text-foreground">库存明细</h2>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(selected.skuCode)} / ${escapeHtml(selected.spuName)} / ${escapeHtml(selected.colorName)} / ${escapeHtml(selected.sizeName)}</div>
          </div>
          <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-nav="${closeHref}">关闭</button>
        </header>
        <div class="space-y-3 p-4">
          <div class="grid gap-3 md:grid-cols-2">
            ${metric(mode === 'wait-process' ? '列表库存' : '列表待交出库存', formatGarmentQty(qty(selected), selected.qtyUnit))}
            ${metric('明细合计', formatGarmentQty(detailTotal, selected.qtyUnit))}
          </div>
          ${table(['库区', '库位', '库存数量'], rows, 'min-w-[680px]')}
        </div>
      </section>
    </div>
  `;
}
function renderInventoryRows(input, mode) {
    return input.map((record) => `
    <tr class="align-top">
      <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.skuCode)}</td>
      <td class="px-3 py-3 text-sm"><div class="font-medium">${escapeHtml(record.spuName)}</div><div class="text-xs text-muted-foreground">${escapeHtml(record.colorName)} / ${escapeHtml(record.sizeName)}</div></td>
      <td class="px-3 py-3 text-sm font-medium">${formatGarmentQty(qty(record), record.qtyUnit)}</td>
      <td class="px-3 py-3">
        <div class="flex flex-wrap gap-2">
          <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildLink(mode, { tab: 'inventory', inventoryDetail: record.warehouseRecordId }))}">库存明细</button>
          <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildLink(mode, { tab: 'flow', keyword: record.skuCode, page: 1 }))}">查看库存流水</button>
        </div>
      </td>
    </tr>
  `).join('');
}
function renderFlowRows(input, mode) {
    return input.flatMap((record) => record.flowRecords.map((flow) => `
    <tr class="align-top">
      <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.skuCode)}</td>
      <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.sourceProductionOrderNo)}</td>
      <td class="px-3 py-3">${renderTaskButton(mode, record)}</td>
      <td class="px-3 py-3 font-mono text-xs">${escapeHtml(flow.flowRecordNo)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(flow.flowType)}</td>
      <td class="px-3 py-3 font-mono text-xs">${escapeHtml(flow.sourceActionRecordNo)}</td>
      <td class="px-3 py-3 text-sm">${formatGarmentQty(flow.qty, flow.qtyUnit)}</td>
      <td class="px-3 py-3 text-sm">${formatGarmentQty(flow.beforeQty, flow.qtyUnit)} -> ${formatGarmentQty(flow.afterQty, flow.qtyUnit)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(flow.operatedAt)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(flow.operatorName)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(flow.remark || '—')}</td>
    </tr>
  `)).join('');
}
function renderWarehouseAreaRows(areas) {
    return areas.map((area) => `
    <tr class="align-top">
      <td class="px-3 py-3 font-mono text-xs">${escapeHtml(area.areaCode)}</td>
      <td class="px-3 py-3 font-medium">${escapeHtml(area.areaName)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(area.managerName)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(area.updatedAt)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(area.remark || '—')}</td>
      <td class="px-3 py-3">
        <button
          type="button"
          class="rounded-md border px-2 py-1 text-xs hover:bg-muted"
          data-post-finishing-action="edit-area"
          data-warehouse-mode="${escapeHtml(area.warehouseMode)}"
          data-area-id="${escapeHtml(area.areaId)}"
          data-area-code="${escapeHtml(area.areaCode)}"
          data-area-name="${escapeHtml(area.areaName)}"
          data-manager-name="${escapeHtml(area.managerName)}"
          data-remark="${escapeHtml(area.remark)}"
        >编辑</button>
      </td>
    </tr>
  `).join('');
}
function renderWarehouseLocationRows(locations) {
    return locations.map((location) => `
    <tr class="align-top">
      <td class="px-3 py-3 text-sm">${escapeHtml(location.areaName)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(location.locationCode)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(location.managerName)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(location.updatedAt)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(location.remark || '—')}</td>
      <td class="px-3 py-3">
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-md border px-2 py-1 text-xs hover:bg-muted"
            data-post-finishing-action="edit-location"
            data-warehouse-mode="${escapeHtml(location.warehouseMode)}"
            data-location-id="${escapeHtml(location.locationId)}"
            data-area-id="${escapeHtml(location.areaId)}"
            data-area-name="${escapeHtml(location.areaName)}"
            data-location-code="${escapeHtml(location.locationCode)}"
            data-manager-name="${escapeHtml(location.managerName)}"
            data-remark="${escapeHtml(location.remark)}"
          >编辑</button>
          <button type="button" class="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50" data-post-finishing-action="delete-location" data-location-id="${escapeHtml(location.locationId)}">删除</button>
        </div>
      </td>
    </tr>
  `).join('');
}
function renderLocationsTab(mode) {
    const areas = listPostFinishingWarehouseAreas(mode);
    const locations = listPostFinishingWarehouseLocations(mode);
    const areaSection = renderSection('库区管理', table(['库区编号', '库区名称', '负责人', '更新时间', '备注', '操作'], renderWarehouseAreaRows(areas), 'min-w-[980px]'), `<button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-post-finishing-action="add-area" data-warehouse-mode="${escapeHtml(mode)}">新增库区</button>`);
    const locationSection = renderSection('库位管理', table(['库区', '库位', '负责人', '更新时间', '备注', '操作'], renderWarehouseLocationRows(locations), 'min-w-[980px]'), `<button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-post-finishing-action="add-location" data-warehouse-mode="${escapeHtml(mode)}">新增库位</button>`);
    return `<div class="space-y-4">${areaSection}${locationSection}</div>`;
}
function renderSection(titleText, body, actionHtml = '') {
    return `
    <section class="rounded-lg border bg-card">
      <header class="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <h2 class="text-sm font-semibold">${escapeHtml(titleText)}</h2>
        ${actionHtml}
      </header>
      <div class="p-4">${body}</div>
    </section>
  `;
}
function renderPage(mode) {
    const all = records(mode);
    const filtered = filterRows(all, mode);
    const pagination = paginatePostRows(filtered, getPostListFilters());
    const tab = activeTab();
    const body = tab === 'flow'
        ? table(['SKU', '生产单', '任务单', '流水号', '类型', '来源记录', '数量', '前后库存', '操作时间', '操作人', '备注'], renderFlowRows(pagination.rows, mode), 'min-w-[1560px]')
        : tab === 'locations'
            ? renderLocationsTab(mode)
            : table(['SKU', '款式名称 / 颜色', '当前库存', '操作'], renderInventoryRows(pagination.rows, mode), 'min-w-[1100px]');
    return `
    <div class="space-y-4 p-4">
      ${renderHeader(mode)}
      ${renderMetrics(all, mode)}
      ${renderTabs(mode, tab)}
      ${renderFilters(mode, all)}
      ${tab === 'locations'
        ? body
        : renderSection(tab === 'flow' ? '流水记录' : '库存', `${body}<div class="mt-4">${renderPostPagination(pagination)}</div>`)}
      ${renderTaskSkuDialog(mode, all)}
      ${renderInventoryDetailDialog(mode, all)}
    </div>
  `;
}
export function renderPostFinishingWaitProcessWarehousePage() {
    return renderPage('wait-process');
}
export function renderPostFinishingWaitHandoverWarehousePage() {
    return renderPage('wait-handover');
}
