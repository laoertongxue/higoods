import { buildTaskDeliveryCardPrintLink } from '../../../data/fcs/fcs-route-links.ts'
import {
  getPrintingWarehouseView,
  type PrintingWarehouseView,
} from '../../../data/fcs/printing-warehouse-view.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  renderBadge,
  renderMetricCard,
  renderPageHeader,
  renderSection,
} from './shared.ts'

type PrintingWarehouseMode = 'wait-process' | 'wait-handover'

function formatQty(value: number | undefined, unit = ''): string {
  const qty = Number.isFinite(value) ? Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 }) : '0'
  return unit ? `${qty} ${escapeHtml(unit)}` : qty
}

function renderTable(headers: string[], rows: string, minWidthClass = 'min-w-[1280px]'): string {
  return `
    <div class="overflow-x-auto">
      <table class="${minWidthClass} w-full text-left text-sm">
        <thead class="bg-slate-50 text-xs text-muted-foreground">
          <tr>${headers.map((header) => `<th class="px-3 py-2 font-medium">${escapeHtml(header)}</th>`).join('')}</tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="${headers.length}" class="px-3 py-8 text-center text-muted-foreground">暂无数据</td></tr>`}</tbody>
      </table>
    </div>
  `
}

function renderFilters(view: PrintingWarehouseView): string {
  const factoryText = view.factoryIds.length > 1 ? '全部印花工厂' : view.warehouses[0]?.factoryName || '全部印花工厂'
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${[
          ['工厂', factoryText],
          ['状态', '全部状态'],
          ['关键字', '任务号 / 交出单 / 交出记录 / 卷号'],
          ['时间范围', '近 30 天'],
        ]
          .map(
            ([label, value]) => `
              <div>
                <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
                <div class="mt-1 rounded-md border bg-muted px-3 py-2 text-sm">${escapeHtml(value)}</div>
              </div>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderWaitProcessRows(view: PrintingWarehouseView): string {
  return view.waitProcessItems
    .map(
      (item) => `
        <tr class="border-b align-top last:border-b-0">
          <td class="px-3 py-3">${escapeHtml(item.factoryName)}</td>
          <td class="px-3 py-3">${escapeHtml(item.warehouseName)}</td>
          <td class="px-3 py-3">${escapeHtml(item.sourceRecordNo)}</td>
          <td class="px-3 py-3">${escapeHtml(item.taskNo || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.itemKind)}</td>
          <td class="px-3 py-3">${escapeHtml(item.materialSku || item.partName || item.itemName || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.fabricColor || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.sizeCode || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.fabricRollNo || '—')}</td>
          <td class="px-3 py-3">${formatQty(item.expectedQty, item.unit)}</td>
          <td class="px-3 py-3">${formatQty(item.receivedQty, item.unit)}</td>
          <td class="px-3 py-3">${formatQty(item.differenceQty, item.unit)}</td>
          <td class="px-3 py-3">${escapeHtml(item.areaName)} / ${escapeHtml(item.shelfNo)} / ${escapeHtml(item.locationNo)}</td>
          <td class="px-3 py-3">${renderBadge(item.status, item.status.includes('差异') ? 'danger' : 'warning')}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-2">
              <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="/fcs/pda/exec/${escapeHtml(item.taskId || '')}">查看任务</button>
              <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="/fcs/factory/warehouse">调整位置</button>
            </div>
          </td>
        </tr>
      `,
    )
    .join('')
}

function renderWaitHandoverRows(view: PrintingWarehouseView): string {
  return view.waitHandoverItems
    .map(
      (item) => `
        <tr class="border-b align-top last:border-b-0">
          <td class="px-3 py-3">${escapeHtml(item.factoryName)}</td>
          <td class="px-3 py-3">${escapeHtml(item.warehouseName)}</td>
          <td class="px-3 py-3">${escapeHtml(item.taskNo || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.itemKind)}</td>
          <td class="px-3 py-3">${escapeHtml(item.materialSku || item.partName || item.itemName || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.fabricColor || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.fabricRollNo || '—')}</td>
          <td class="px-3 py-3">${formatQty(item.completedQty, item.unit)}</td>
          <td class="px-3 py-3">${formatQty(item.lossQty, item.unit)}</td>
          <td class="px-3 py-3">${formatQty(item.waitHandoverQty, item.unit)}</td>
          <td class="px-3 py-3">${escapeHtml(item.receiverName)}</td>
          <td class="px-3 py-3">${escapeHtml(item.handoverOrderNo || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.handoverRecordNo || '—')}</td>
          <td class="px-3 py-3">${typeof item.receiverWrittenQty === 'number' ? formatQty(item.receiverWrittenQty, item.unit) : '—'}</td>
          <td class="px-3 py-3">${renderBadge(item.status, item.status.includes('差异') || item.status.includes('异议') ? 'danger' : 'warning')}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-2">
              <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="/fcs/pda/handover">查看交出</button>
              <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="/fcs/factory/warehouse">调整位置</button>
            </div>
          </td>
        </tr>
      `,
    )
    .join('')
}

function renderInboundRows(view: PrintingWarehouseView): string {
  return view.inboundRecords
    .map(
      (item) => `
        <tr class="border-b align-top last:border-b-0">
          <td class="px-3 py-3">${escapeHtml(item.inboundRecordNo)}</td>
          <td class="px-3 py-3">${escapeHtml(item.factoryName)}</td>
          <td class="px-3 py-3">${escapeHtml(item.warehouseName)}</td>
          <td class="px-3 py-3">${escapeHtml(item.sourceRecordNo)}</td>
          <td class="px-3 py-3">${escapeHtml(item.taskNo || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.materialSku || item.partName || item.itemName || '—')}</td>
          <td class="px-3 py-3">${formatQty(item.expectedQty, item.unit)}</td>
          <td class="px-3 py-3">${formatQty(item.receivedQty, item.unit)}</td>
          <td class="px-3 py-3">${formatQty(item.differenceQty, item.unit)}</td>
          <td class="px-3 py-3">${escapeHtml(item.areaName)} / ${escapeHtml(item.shelfNo)} / ${escapeHtml(item.locationNo)}</td>
          <td class="px-3 py-3">${escapeHtml(item.receiverName)}</td>
          <td class="px-3 py-3">${escapeHtml(item.receivedAt)}</td>
          <td class="px-3 py-3">${renderBadge(item.status, item.status.includes('差异') ? 'danger' : 'success')}</td>
          <td class="px-3 py-3"><button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="/fcs/pda/handover">查看来源</button></td>
        </tr>
      `,
    )
    .join('')
}

function renderOutboundRows(view: PrintingWarehouseView): string {
  return view.outboundRecords
    .map(
      (item) => `
        <tr class="border-b align-top last:border-b-0">
          <td class="px-3 py-3">${escapeHtml(item.outboundRecordNo)}</td>
          <td class="px-3 py-3">${escapeHtml(item.factoryName)}</td>
          <td class="px-3 py-3">${escapeHtml(item.warehouseName)}</td>
          <td class="px-3 py-3">${escapeHtml(item.sourceTaskNo || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.handoverOrderNo || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.handoverRecordNo || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.receiverName)}</td>
          <td class="px-3 py-3">${escapeHtml(item.materialSku || item.partName || item.itemName || '—')}</td>
          <td class="px-3 py-3">${formatQty(item.outboundQty, item.unit)}</td>
          <td class="px-3 py-3">${typeof item.receiverWrittenQty === 'number' ? formatQty(item.receiverWrittenQty, item.unit) : '—'}</td>
          <td class="px-3 py-3">${typeof item.differenceQty === 'number' ? formatQty(item.differenceQty, item.unit) : '—'}</td>
          <td class="px-3 py-3">${escapeHtml(item.operatorName)}</td>
          <td class="px-3 py-3">${escapeHtml(item.outboundAt)}</td>
          <td class="px-3 py-3">${renderBadge(item.status, item.status.includes('差异') || item.status.includes('异议') ? 'danger' : 'success')}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-2">
              <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="/fcs/pda/handover">查看交出</button>
              ${
                item.handoverRecordId
                  ? `<button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${buildTaskDeliveryCardPrintLink(item.handoverRecordId)}">打印任务交货卡</button>`
                  : '<button type="button" class="inline-flex cursor-not-allowed items-center rounded-md border px-2 py-1 text-xs opacity-50" disabled>打印任务交货卡</button>'
              }
              <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="/fcs/pda/handover">查看回写</button>
            </div>
          </td>
        </tr>
      `,
    )
    .join('')
}

function renderNodeRows(view: PrintingWarehouseView): string {
  return view.nodeRows
    .map(
      (row) => `
        <tr class="border-b last:border-b-0">
          <td class="px-3 py-3">${escapeHtml(row.factoryName)}</td>
          <td class="px-3 py-3">${escapeHtml(row.warehouseName)}</td>
          <td class="px-3 py-3">${escapeHtml(row.areaName)}</td>
          <td class="px-3 py-3">${escapeHtml(row.shelfNo || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(row.locationNo || '—')}</td>
          <td class="px-3 py-3">${renderBadge(row.status === 'AVAILABLE' ? '可用' : '停用', row.status === 'AVAILABLE' ? 'success' : 'warning')}</td>
          <td class="px-3 py-3">${escapeHtml(row.remark || '—')}</td>
        </tr>
      `,
    )
    .join('')
}

function renderStocktakeRows(view: PrintingWarehouseView): string {
  return view.stocktakeOrders
    .map(
      (order) => `
        <tr class="border-b last:border-b-0">
          <td class="px-3 py-3">${escapeHtml(order.stocktakeOrderNo)}</td>
          <td class="px-3 py-3">${escapeHtml(order.factoryName)}</td>
          <td class="px-3 py-3">${escapeHtml(order.warehouseName)}</td>
          <td class="px-3 py-3">${escapeHtml(order.stocktakeScope)}</td>
          <td class="px-3 py-3">${escapeHtml(order.createdBy)}</td>
          <td class="px-3 py-3">${escapeHtml(order.createdAt)}</td>
          <td class="px-3 py-3">${String(order.lineList.length)}</td>
          <td class="px-3 py-3">${String(order.lineList.filter((line) => line.status === '差异').length)}</td>
          <td class="px-3 py-3">${renderBadge(order.status, order.status === '已完成' ? 'success' : 'warning')}</td>
        </tr>
      `,
    )
    .join('')
}

function renderPrintingWarehousePage(mode: PrintingWarehouseMode): string {
  const view = getPrintingWarehouseView({ timeRange: '30D' })
  const stocktakeDifferenceCount = view.stocktakeOrders.reduce(
    (total, order) => total + order.lineList.filter((line) => line.status === '差异').length,
    0,
  )
  const inboundDifferenceCount = view.inboundRecords.filter((item) => item.status.includes('差异')).length
  const outboundDifferenceCount = view.outboundRecords.filter((item) => item.status.includes('差异') || item.status.includes('异议')).length
  const title = mode === 'wait-process' ? '印花待加工仓' : '印花待交出仓'
  const description =
    mode === 'wait-process'
      ? '查看印花任务接收后的待加工库存、入库记录与仓内位置。'
      : '查看印花任务完工后的待交出库存、出库记录与回写差异。'
  const metrics =
    mode === 'wait-process'
      ? [
          renderMetricCard('待加工数量', String(view.waitProcessItems.length), '待加工仓记录'),
          renderMetricCard('入库记录', String(view.inboundRecords.length), '近 30 天'),
          renderMetricCard('差异数量', String(inboundDifferenceCount), '入库差异'),
          renderMetricCard('盘点差异', String(stocktakeDifferenceCount), '盘点明细'),
        ].join('')
      : [
          renderMetricCard('待交出数量', String(view.waitHandoverItems.length), '待交出仓记录'),
          renderMetricCard('出库记录', String(view.outboundRecords.length), '近 30 天'),
          renderMetricCard('已回写数量', String(view.outboundRecords.filter((item) => item.status === '已回写').length), '接收方回写'),
          renderMetricCard('差异数量', String(outboundDifferenceCount), '出库差异'),
          renderMetricCard('盘点差异', String(stocktakeDifferenceCount), '盘点明细'),
        ].join('')

  const modeSections =
    mode === 'wait-process'
      ? [
          renderSection('待加工仓', renderTable(['工厂', '仓库', '来源单号', '所属任务', '类型', '物料 / 裁片', '颜色', '尺码', '卷号', '应收数量', '实收数量', '差异数量', '库位', '状态', '操作'], renderWaitProcessRows(view), 'min-w-[1680px]')),
          renderSection('入库记录', renderTable(['入库单号', '工厂', '入库仓', '来源单号', '所属任务', '物料 / 裁片', '应收数量', '实收数量', '差异数量', '库位', '操作人', '操作时间', '状态', '操作'], renderInboundRows(view), 'min-w-[1680px]')),
        ].join('')
      : [
          renderSection('待交出仓', renderTable(['工厂', '仓库', '来源任务', '类型', '物料 / 裁片', '颜色', '卷号', '完成数量', '损耗数量', '待交出数量', '接收方', '交出单', '交出记录', '回写数量', '状态', '操作'], renderWaitHandoverRows(view), 'min-w-[1740px]')),
          renderSection('出库记录', renderTable(['出库单号', '工厂', '出库仓', '来源任务', '交出单', '交出记录', '接收方', '物料 / 裁片', '出库数量', '回写数量', '差异数量', '操作人', '出库时间', '状态', '操作'], renderOutboundRows(view), 'min-w-[1720px]')),
        ].join('')

  return `
    <div class="space-y-4 p-4">
      ${renderPageHeader(title, description)}
      ${renderFilters(view)}
      <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">${metrics}</section>
      ${modeSections}
      ${renderSection('库区库位', renderTable(['工厂', '仓库', '库区', '货架', '库位', '状态', '备注'], renderNodeRows(view), 'min-w-[980px]'))}
      ${renderSection('盘点', renderTable(['盘点单号', '工厂', '仓库', '盘点范围', '盘点人', '开始时间', '明细数', '差异数', '状态'], renderStocktakeRows(view), 'min-w-[1120px]'))}
    </div>
  `
}

export function renderCraftPrintingWaitProcessWarehousePage(): string {
  return renderPrintingWarehousePage('wait-process')
}

export function renderCraftPrintingWaitHandoverWarehousePage(): string {
  return renderPrintingWarehousePage('wait-handover')
}
