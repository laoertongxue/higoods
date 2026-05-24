import { buildPostFinishingRecheckOrderDetailLink } from '../../../data/fcs/fcs-route-links.ts';
import { completePostFinishingRecheckOrder, getPostFinishingRecheckOrderById, listPostFinishingRecheckOrderEntities, } from '../../../data/fcs/post-finishing-domain.ts';
import { appStore } from '../../../state/store.ts';
import { escapeHtml } from '../../../utils.ts';
import { formatGarmentQty, getPostListFilters, paginatePostRows, postFilterTextMatches, renderPostAction, renderPostFilterPanel, renderPostFinishingPageHeader, renderPostPagination, renderPostSection, renderPostStatusBadge, renderPostTable, } from './shared.ts';
function filterRows(records, filters) {
    return records.filter((record) => {
        if (filters.status !== '全部' && record.recheckStatus !== filters.status)
            return false;
        if (filters.factory !== '全部' && record.managedPostFactoryName !== filters.factory)
            return false;
        if (filters.source !== '全部' && record.sourceType !== filters.source)
            return false;
        return postFilterTextMatches(filters.keyword, [
            record.recheckOrderId,
            record.recheckOrderNo,
            record.qcOrderId,
            record.qcOrderNo,
            record.postOrderId,
            record.postOrderNo,
            record.productionOrderNo,
            record.sourceTaskNo,
            record.managedPostFactoryName,
            record.spuCode,
            record.spuName,
            record.skuSummary,
            record.recheckStatus,
        ]);
    });
}
function registerPostRecheckActions() {
    if (typeof window === 'undefined')
        return;
    const win = window;
    win.__postCompleteRecheck = (recheckOrderId) => {
        const updated = completePostFinishingRecheckOrder({ recheckOrderId, operatorName: '复检员' });
        appStore.navigate(buildPostFinishingRecheckOrderDetailLink(updated.recheckOrderId));
    };
}
function renderSkuRows(record) {
    return record.skuLines.map((line) => `
    <tr>
      <td class="px-3 py-3 font-mono text-xs">${escapeHtml(line.skuCode)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(line.spuName)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(line.colorName)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(line.sizeName)}</td>
      <td class="px-3 py-3 text-sm font-medium">${formatGarmentQty(line.plannedQty, line.qtyUnit)}</td>
    </tr>
  `).join('');
}
function renderDetailField(label, value) {
    return `<div class="rounded-lg border bg-slate-50 px-3 py-2"><div class="text-xs text-muted-foreground">${escapeHtml(label)}</div><div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(value || '—')}</div></div>`;
}
export function renderPostFinishingRecheckOrderDetailPage(recheckOrderId) {
    registerPostRecheckActions();
    const record = getPostFinishingRecheckOrderById(recheckOrderId);
    if (!record) {
        return `<div class="p-4">${renderPostFinishingPageHeader('复检单详情')} ${renderPostSection('未找到复检单', '<div class="text-sm text-muted-foreground">请返回复检单列表重新选择。</div>')}</div>`;
    }
    const actionHtml = `
    <div class="flex flex-wrap gap-2">
      ${renderPostAction('返回复检单列表', '/fcs/craft/post-finishing/recheck-orders')}
      ${record.recheckStatus !== '复检完成' ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-slate-50" onclick="window.__postCompleteRecheck('${escapeHtml(record.recheckOrderId)}')">完成复检</button>` : ''}
    </div>
  `;
    return `
    <div class="space-y-4 p-4">
      ${renderPostFinishingPageHeader('复检单详情', `${record.recheckOrderNo} / ${record.managedPostFactoryName}`, actionHtml)}
      ${renderPostSection('复检结果', `
        <div class="grid gap-3 md:grid-cols-4">
          ${renderDetailField('复检单号', record.recheckOrderNo)}
          ${renderDetailField('来源', record.sourceType)}
          ${renderDetailField('关联质检单', record.qcOrderNo)}
          ${renderDetailField('关联后道单', record.postOrderNo || '无后道单')}
          ${renderDetailField('生产单', record.productionOrderNo)}
          ${renderDetailField('来源任务', record.sourceTaskNo)}
          ${renderDetailField('后道工厂', record.managedPostFactoryName)}
          ${renderDetailField('款式衣服', `${record.spuCode} / ${record.spuName}`)}
          ${renderDetailField('复检数量', formatGarmentQty(record.recheckedGarmentQty))}
          ${renderDetailField('合格数量', formatGarmentQty(record.passedGarmentQty))}
          ${renderDetailField('不合格数量', formatGarmentQty(record.defectiveGarmentQty))}
          ${renderDetailField('复检状态', record.recheckStatus)}
          ${renderDetailField('复检员', record.recheckerName)}
          ${renderDetailField('复检时间', record.recheckedAt || '未完成')}
        </div>
      `)}
      ${renderPostSection('SKU 明细', renderPostTable(['SKU', '款式', '颜色', '尺码', '复检数量'], renderSkuRows(record), 'min-w-[760px]'))}
    </div>
  `;
}
export function renderPostFinishingRecheckOrdersPage() {
    registerPostRecheckActions();
    const allRecords = listPostFinishingRecheckOrderEntities();
    const filters = getPostListFilters();
    const filteredRecords = filterRows(allRecords, filters);
    const pagination = paginatePostRows(filteredRecords, filters);
    const rows = pagination.rows.map((record) => `
    <tr class="align-top">
      <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.recheckOrderNo)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(record.sourceType)}</td>
      <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.qcOrderNo)}</td>
      <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.postOrderNo || '—')}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(record.productionOrderNo)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(record.managedPostFactoryName)}</td>
      <td class="px-3 py-3 text-sm"><div class="font-semibold">${escapeHtml(record.spuCode)}</div><div class="text-xs text-muted-foreground">${escapeHtml(record.spuName)}</div></td>
      <td class="px-3 py-3 text-sm">${escapeHtml(record.skuSummary)}</td>
      <td class="px-3 py-3 text-sm">${formatGarmentQty(record.recheckedGarmentQty)}</td>
      <td class="px-3 py-3 text-sm">${formatGarmentQty(record.passedGarmentQty)}</td>
      <td class="px-3 py-3 text-sm">${formatGarmentQty(record.defectiveGarmentQty)}</td>
      <td class="px-3 py-3">${renderPostStatusBadge(record.recheckStatus)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(record.recheckedAt || '—')}</td>
      <td class="px-3 py-3"><div class="flex flex-wrap gap-2">${renderPostAction('查看复检单详情', buildPostFinishingRecheckOrderDetailLink(record.recheckOrderId))}${record.recheckStatus !== '复检完成' ? `<button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-slate-50" onclick="window.__postCompleteRecheck('${escapeHtml(record.recheckOrderId)}')">完成复检</button>` : ''}</div></td>
    </tr>
  `).join('');
    return `
    <div class="space-y-4 p-4">
      ${renderPostFinishingPageHeader('复检单')}
      ${renderPostFilterPanel({
        filters,
        statusOptions: allRecords.map((record) => record.recheckStatus),
        sourceOptions: allRecords.map((record) => record.sourceType),
        factoryOptions: allRecords.map((record) => record.managedPostFactoryName),
        keywordPlaceholder: '复检单 / 质检单 / 后道单 / 生产单 / SKU',
    })}
      ${renderPostSection('复检单列表', `${renderPostTable(['复检单号', '来源', '关联质检单', '关联后道单', '生产单', '后道工厂', '款式衣服', 'SKU 明细', '复检数量', '合格数量', '不合格数量', '复检状态', '复检时间', '操作'], rows || '<tr><td colspan="14" class="px-3 py-8 text-center text-sm text-muted-foreground">暂无复检单</td></tr>', 'min-w-[1500px]')}<div class="mt-4">${renderPostPagination(pagination)}</div>`)}
    </div>
  `;
}
