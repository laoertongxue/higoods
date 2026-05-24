import { escapeHtml } from '../../../utils';
import { buildWoolPartPanelFeiTicketSourceId, listWoolWorkOrders, } from '../../../data/fcs/wool-task-domain.ts';
import { buildFeiTicketLabelPrintLink, buildWoolWaitHandoverWarehouseLink, buildWoolWorkOrderDetailLink, } from '../../../data/fcs/fcs-route-links.ts';
import { formatNumber, formatQty, paginateWoolItems, renderBadge, renderKindBadge, renderMetricCard, renderPageHeader, renderPaginationControls, renderSection, renderTable, } from './shared';
function listRows() {
    return listWoolWorkOrders()
        .filter((order) => order.kind === 'PART_PANEL')
        .flatMap((order) => order.partPanels.map((panel) => ({ order, panel })));
}
function renderSummary(rows) {
    const printed = rows.filter((row) => row.panel.feiTicketStatus === '已打印').length;
    const waitPrint = rows.filter((row) => row.panel.feiTicketStatus === '待打印').length;
    const totalPieces = rows.reduce((sum, row) => sum + row.panel.plannedPieces, 0);
    const completedPieces = rows.reduce((sum, row) => sum + row.panel.completedPieces, 0);
    return `
    <section class="grid gap-3 md:grid-cols-4">
      ${renderMetricCard('毛织菲票行', String(rows.length), '仅部位毛织')}
      ${renderMetricCard('待打印', String(waitPrint), '待生成或待打印菲票')}
      ${renderMetricCard('已打印', String(printed), '可交裁床待交出仓')}
      ${renderMetricCard('计划片数', `${formatNumber(totalPieces)} 片`, '按部位、颜色、尺码')}
    </section>
    <section class="grid gap-3 md:grid-cols-2">
      ${renderMetricCard('完成片数', `${formatNumber(completedPieces)} 片`, '来自横机成片结果')}
      ${renderMetricCard('打印模板', '毛织菲票标签', '复用统一菲票打印预览')}
      ${renderMetricCard('后续去向', '裁床待交出仓', '部位毛织不进缝盘、熨烫、包装')}
    </section>
  `;
}
function renderRows(rows) {
    return rows
        .map(({ order, panel }) => {
        const statusTone = panel.feiTicketStatus === '已打印' ? 'success' : 'warning';
        const detailHref = buildWoolWorkOrderDetailLink(order.woolOrderId, 'fei');
        const printSourceId = buildWoolPartPanelFeiTicketSourceId(order, panel);
        return `
        <tr class="border-b align-top last:border-b-0">
          <td class="px-3 py-3">${escapeHtml(order.woolOrderNo)}</td>
          <td class="px-3 py-3">${renderKindBadge(order.kind)}</td>
          <td class="px-3 py-3 text-sm">
            <div>${escapeHtml(order.styleName)}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(order.styleNo)} / ${escapeHtml(order.productionOrderNo)}</div>
          </td>
          <td class="px-3 py-3 text-sm">${escapeHtml(panel.partName)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(panel.colorName)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(panel.sizeCode)}</td>
          <td class="px-3 py-3 text-sm">${formatQty(panel.plannedPieces, '片')}</td>
          <td class="px-3 py-3 text-sm">${formatQty(panel.completedPieces, '片')}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(panel.feiTicketNo || '待生成')}</td>
          <td class="px-3 py-3">${renderBadge(panel.feiTicketStatus, statusTone)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(order.downstreamTarget)}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildFeiTicketLabelPrintLink(printSourceId, 'first'))}">${panel.feiTicketStatus === '已打印' ? '打印预览' : '打印菲票'}</button>
              ${panel.feiTicketStatus === '已打印'
            ? `<button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildFeiTicketLabelPrintLink(printSourceId, 'reprint'))}">补打</button>`
            : ''}
              <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(detailHref)}">查看加工单</button>
              <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildWoolWaitHandoverWarehouseLink(order.woolOrderId))}">查看交出仓</button>
            </div>
          </td>
        </tr>
      `;
    })
        .join('');
}
export function renderCraftWoolFeiTicketsPage() {
    const rows = listRows();
    const paging = paginateWoolItems(rows, 'feiTicketsPage', 10);
    return `
    <div class="space-y-4 p-4">
      ${renderPageHeader('毛织菲票', '仅服务部位毛织；整件毛织不打印毛织菲票。')}
      ${renderSummary(rows)}
      ${renderSection('部位毛织菲票列表', `
          <div class="mb-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
            部位毛织完成横机成片后，按部位、颜色、尺码打印菲票；打印预览使用统一菲票标签模板，后续交到裁床待交出仓继续流转。
          </div>
          ${renderTable(['毛织单号', '任务类型', '款式', '部位', '颜色', '尺码', '计划片数', '完成片数', '菲票号', '打印状态', '后续去向', '操作'], renderRows(paging.rows), 'min-w-[1600px]')}
          ${renderPaginationControls(paging, '行菲票')}
        `)}
    </div>
  `;
}
