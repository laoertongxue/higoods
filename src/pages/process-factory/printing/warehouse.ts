import {
  buildHandoverQrLabelPrintLink,
  buildHandoverOrderLink,
  buildPrintingWorkOrderDetailLink,
  buildTaskDeliveryCardPrintLink,
  buildTaskDetailLink,
} from '../../../data/fcs/fcs-route-links.ts'
import {
  getPrintingWarehouseView,
  type PrintingWarehouseView,
} from '../../../data/fcs/printing-warehouse-view.ts'
import { escapeHtml } from '../../../utils.ts'
import { formatFactoryDisplayName } from '../../../data/fcs/factory-mock-data.ts'
import {
  renderBadge,
  renderMetricCard,
  renderPageHeader,
} from './shared.ts'
import {
  renderWarehouseFlowButton,
  renderWarehouseLocationActions,
  renderWarehouseLocationToolbar,
  type FactoryWarehouseFlowLine,
} from '../shared/warehouse-standard.ts'

type PrintingWarehouseMode = 'wait-process' | 'wait-handover'

type WarehouseTab = {
  key: string
  label: string
  count: number
  table: string
}

function formatQty(value: number | undefined, unit = ''): string {
  const qty = Number.isFinite(value) ? Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 }) : '0'
  return unit ? `${qty} ${escapeHtml(unit)}` : qty
}

function formatFactoryCell(factoryName?: string, factoryId?: string): string {
  return escapeHtml(formatFactoryDisplayName(factoryName, factoryId))
}

function buildWaitProcessFlowLines(item: PrintingWarehouseView['waitProcessItems'][number]): FactoryWarehouseFlowLine[] {
  const lines: FactoryWarehouseFlowLine[] = [
    {
      flowType: '领料入仓',
      qtyText: formatQty(item.receivedQty, item.unit),
      sourceNo: item.sourceRecordNo,
      operatedAt: item.receivedAt,
      operatorName: item.receiverName,
      statusText: item.status,
    },
  ]
  if (item.receivedQty > 0) {
    lines.push({
      flowType: '加工用料',
      qtyText: `-${formatQty(Math.max(item.receivedQty - item.differenceQty, 0), item.unit)}`,
      sourceNo: item.taskNo || item.sourceRecordNo,
      operatedAt: item.receivedAt,
      operatorName: item.factoryName,
      statusText: '加工领用',
    })
  }
  return lines
}

function buildWaitHandoverFlowLines(item: PrintingWarehouseView['waitHandoverItems'][number]): FactoryWarehouseFlowLine[] {
  const lines: FactoryWarehouseFlowLine[] = [
    {
      flowType: '加工入仓',
      qtyText: formatQty(item.completedQty, item.unit),
      sourceNo: item.taskNo || item.stockItemId,
      operatedAt: item.handoverRecordNo || '待交出前',
      operatorName: item.factoryName,
      statusText: item.status,
    },
  ]
  if (item.handoverRecordNo) {
    lines.push({
      flowType: '交出出仓',
      qtyText: `-${formatQty(item.waitHandoverQty, item.unit)}`,
      sourceNo: item.handoverRecordNo,
      operatedAt: item.handoverRecordNo,
      operatorName: item.receiverName,
      statusText: item.status,
    })
  }
  return lines
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
  const factoryText = view.factoryIds.length > 1 ? '全部印花工厂' : formatFactoryDisplayName(view.warehouses[0]?.factoryName, view.factoryIds[0]) || '全部印花工厂'
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
          <td class="px-3 py-3">${formatFactoryCell(item.factoryName, item.factoryId)}</td>
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
              <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${buildPrintingWorkOrderDetailLink(item.sourceRecordId)}">查看印花加工单</button>
              ${renderWarehouseFlowButton(`${item.sourceRecordNo} 库存流水`, buildWaitProcessFlowLines(item))}
              <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${item.taskId ? buildTaskDetailLink(item.taskId) : ''}" ${item.taskId ? '' : 'disabled'}>打开移动端执行页</button>
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
          <td class="px-3 py-3">${formatFactoryCell(item.factoryName, item.factoryId)}</td>
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
              <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${item.handoverOrderId ? buildHandoverOrderLink(item.handoverOrderId) : ''}" ${item.handoverOrderId ? '' : 'disabled'}>打开移动端交出页</button>
              ${renderWarehouseFlowButton(`${item.taskNo || item.stockItemId} 库存流水`, buildWaitHandoverFlowLines(item))}
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
          <td class="px-3 py-3">${formatFactoryCell(item.factoryName, item.factoryId)}</td>
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
          <td class="px-3 py-3"><button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${buildPrintingWorkOrderDetailLink(item.sourceRecordId)}">查看印花加工单</button></td>
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
          <td class="px-3 py-3">${formatFactoryCell(item.factoryName, item.factoryId)}</td>
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
              <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${item.handoverOrderId ? buildHandoverOrderLink(item.handoverOrderId) : ''}" ${item.handoverOrderId ? '' : 'disabled'}>查看交出</button>
              ${
                item.handoverRecordId
                  ? `<button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${buildTaskDeliveryCardPrintLink(item.handoverRecordId)}">打印任务交货卡</button><button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${buildHandoverQrLabelPrintLink(item.handoverRecordId)}">打印交出二维码</button>`
                  : '<button type="button" class="inline-flex cursor-not-allowed items-center rounded-md border px-2 py-1 text-xs opacity-50" disabled>打印任务交货卡</button>'
              }
              <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${item.handoverOrderId ? buildHandoverOrderLink(item.handoverOrderId) : ''}" ${item.handoverOrderId ? '' : 'disabled'}>查看收货</button>
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
          <td class="px-3 py-3">${formatFactoryCell(row.factoryName, row.factoryId)}</td>
          <td class="px-3 py-3">${escapeHtml(row.warehouseName)}</td>
          <td class="px-3 py-3">${escapeHtml(row.areaName)}</td>
          <td class="px-3 py-3">${escapeHtml(row.shelfNo || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(row.locationNo || '—')}</td>
          <td class="px-3 py-3">${renderBadge(row.status === 'AVAILABLE' ? '可用' : '停用', row.status === 'AVAILABLE' ? 'success' : 'warning')}</td>
          <td class="px-3 py-3">${escapeHtml(row.remark || '—')}</td>
          <td class="px-3 py-3">${renderWarehouseLocationActions('印花仓库库区库位', `${row.areaName}/${row.shelfNo || '—'}/${row.locationNo || '—'}`)}</td>
        </tr>
      `,
    )
    .join('')
}

function renderUsageRows(view: PrintingWarehouseView): string {
  return view.waitProcessItems
    .map(
      (item) => `
        <tr class="border-b align-top last:border-b-0">
          <td class="px-3 py-3">${escapeHtml(item.taskNo || item.sourceRecordNo)}</td>
          <td class="px-3 py-3">${formatFactoryCell(item.factoryName, item.factoryId)}</td>
          <td class="px-3 py-3">${escapeHtml(item.itemKind)}</td>
          <td class="px-3 py-3">${escapeHtml(item.materialSku || item.partName || item.itemName || '—')}</td>
          <td class="px-3 py-3">${formatQty(Math.max(item.receivedQty - item.differenceQty, 0), item.unit)}</td>
          <td class="px-3 py-3">${escapeHtml(item.sourceRecordNo)}</td>
          <td class="px-3 py-3">${escapeHtml(item.receivedAt)}</td>
          <td class="px-3 py-3">${renderBadge(item.status === '差异待处理' ? '差异待处理' : '已领用', item.status === '差异待处理' ? 'danger' : 'success')}</td>
        </tr>
      `,
    )
    .join('')
}

function renderProcessInboundRows(view: PrintingWarehouseView): string {
  return view.waitHandoverItems
    .map(
      (item) => `
        <tr class="border-b align-top last:border-b-0">
          <td class="px-3 py-3">${escapeHtml(item.stockItemId)}</td>
          <td class="px-3 py-3">${formatFactoryCell(item.factoryName, item.factoryId)}</td>
          <td class="px-3 py-3">${escapeHtml(item.taskNo || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(item.itemKind)}</td>
          <td class="px-3 py-3">${escapeHtml(item.materialSku || item.partName || item.itemName || '—')}</td>
          <td class="px-3 py-3">${formatQty(item.completedQty, item.unit)}</td>
          <td class="px-3 py-3">${formatQty(item.lossQty, item.unit)}</td>
          <td class="px-3 py-3">${escapeHtml(item.areaName)} / ${escapeHtml(item.shelfNo)} / ${escapeHtml(item.locationNo)}</td>
          <td class="px-3 py-3">${renderBadge(item.status, item.status.includes('差异') ? 'danger' : 'success')}</td>
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
          <td class="px-3 py-3">${formatFactoryCell(order.factoryName, order.factoryId)}</td>
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

function renderWarehouseTabs(tabs: WarehouseTab[], idPrefix: string): string {
  return `
    <section class="rounded-lg border bg-card">
      <style>
        ${tabs
          .map(
            (tab, index) => `
              #${idPrefix}-${tab.key}:checked ~ .warehouse-tab-labels label[for="${idPrefix}-${tab.key}"] {
                background: rgb(15 23 42);
                border-color: rgb(15 23 42);
                color: white;
              }
              #${idPrefix}-${tab.key}:checked ~ .warehouse-tab-panels [data-warehouse-tab-panel="${tab.key}"] {
                display: block;
              }
              ${index === 0 ? '' : ''}
            `,
          )
          .join('')}
      </style>
      ${tabs
        .map(
          (tab, index) => `
            <input
              id="${idPrefix}-${tab.key}"
              class="sr-only"
              type="radio"
              name="${idPrefix}"
              ${index === 0 ? 'checked' : ''}
            />
          `,
        )
        .join('')}
      <div class="warehouse-tab-labels flex flex-wrap gap-2 border-b bg-muted/20 px-4 py-3">
        ${tabs
          .map(
            (tab) => `
              <label
                for="${idPrefix}-${tab.key}"
                class="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                <span>${escapeHtml(tab.label)}</span>
                <span class="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">${String(tab.count)}</span>
              </label>
            `,
          )
          .join('')}
      </div>
      <div class="warehouse-tab-panels">
        ${tabs
          .map(
            (tab) => `
              <div class="hidden" data-warehouse-tab-panel="${tab.key}">
                <div class="flex items-center justify-between border-b px-4 py-3">
                  <h2 class="text-base font-semibold">${escapeHtml(tab.label)}</h2>
                  <span class="text-xs text-muted-foreground">共 ${String(tab.count)} 条</span>
                </div>
                ${tab.table}
              </div>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderPrintingWarehousePage(mode: PrintingWarehouseMode): string {
  const view = getPrintingWarehouseView({ timeRange: '30D' })
  const inboundDifferenceCount = view.inboundRecords.filter((item) => item.status.includes('差异')).length
  const outboundDifferenceCount = view.outboundRecords.filter((item) => item.status.includes('差异') || item.status.includes('异议')).length
  const title = mode === 'wait-process' ? '印花待加工仓' : '印花待交出仓'
  const description =
    mode === 'wait-process'
      ? '查看印花任务接收后的待加工库存、入库记录与仓内位置。'
      : '查看印花任务完工后的待交出库存、出库记录与收货差异。'
  const metrics =
    mode === 'wait-process'
      ? [
          renderMetricCard('待加工仓记录数', String(view.waitProcessItems.length), '待加工仓记录'),
          renderMetricCard('领料记录', String(view.inboundRecords.length), '近 30 天'),
          renderMetricCard('加工用料记录', String(view.waitProcessItems.length), '按库存推演'),
          renderMetricCard('库区库位', String(view.nodeRows.length), '支持新增、编辑、删除'),
          renderMetricCard('领料差异记录数', String(inboundDifferenceCount), '领料差异'),
        ].join('')
      : [
          renderMetricCard('待交出仓记录数', String(view.waitHandoverItems.length), '待交出仓记录'),
          renderMetricCard('交出记录', String(view.outboundRecords.length), '近 30 天'),
          renderMetricCard('加工入仓记录', String(view.waitHandoverItems.length), '按完工入仓'),
          renderMetricCard('已收货记录数', String(view.outboundRecords.filter((item) => item.status === '已收货').length), '接收方确认收货'),
          renderMetricCard('出库差异记录数', String(outboundDifferenceCount), '出库差异'),
        ].join('')

  const tabs: WarehouseTab[] =
    mode === 'wait-process'
      ? [
          {
            key: 'wait-process',
            label: '库存',
            count: view.waitProcessItems.length,
            table: renderTable(['工厂', '仓库', '印花加工单号', '所属任务', '类型', '面料 SKU', '颜色', '尺码', '卷号', '计划数量', '当前库存', '差异数量', '库位', '状态', '操作'], renderWaitProcessRows(view), 'min-w-[1680px]'),
          },
          {
            key: 'inbound',
            label: '领料记录',
            count: view.inboundRecords.length,
            table: renderTable(['领料单号', '工厂', '待加工仓', '印花加工单号', '所属任务', '面料 SKU', '计划数量', '确认入仓数量', '差异数量', '库位', '操作人', '操作时间', '状态', '操作'], renderInboundRows(view), 'min-w-[1680px]'),
          },
          {
            key: 'usage',
            label: '加工用料记录',
            count: view.waitProcessItems.length,
            table: renderTable(['所属任务', '工厂', '类型', '物料 / 裁片', '用料数量', '来源领料单', '用料时间', '状态'], renderUsageRows(view), 'min-w-[1120px]'),
          },
          {
            key: 'nodes',
            label: '库区库位',
            count: view.nodeRows.length,
            table: `<div class="border-b px-4 py-3">${renderWarehouseLocationToolbar('印花待加工仓')}</div>${renderTable(['工厂', '仓库', '库区', '货架', '库位', '状态', '备注', '操作'], renderNodeRows(view), 'min-w-[1080px]')}`,
          },
        ]
      : [
          {
            key: 'wait-handover',
            label: '库存',
            count: view.waitHandoverItems.length,
            table: renderTable(['工厂', '仓库', '来源任务', '类型', '面料 SKU', '颜色', '卷号', '加工完成数量', '损耗数量', '当前库存', '接收方', '交出单', '交出记录', '收货确认数量', '状态', '操作'], renderWaitHandoverRows(view), 'min-w-[1740px]'),
          },
          {
            key: 'outbound',
            label: '交出记录',
            count: view.outboundRecords.length,
            table: renderTable(['交出记录号', '工厂', '待交出仓', '来源任务', '交出单', '交出记录', '接收方', '面料 SKU', '已交出数量', '收货确认数量', '差异数量', '操作人', '交出时间', '状态', '操作'], renderOutboundRows(view), 'min-w-[1720px]'),
          },
          {
            key: 'process-inbound',
            label: '加工入仓记录',
            count: view.waitHandoverItems.length,
            table: renderTable(['入仓记录号', '工厂', '来源任务', '类型', '物料 / 裁片', '加工入仓数量', '损耗数量', '库位', '状态'], renderProcessInboundRows(view), 'min-w-[1280px]'),
          },
          {
            key: 'nodes',
            label: '库区库位',
            count: view.nodeRows.length,
            table: `<div class="border-b px-4 py-3">${renderWarehouseLocationToolbar('印花待交出仓')}</div>${renderTable(['工厂', '仓库', '库区', '货架', '库位', '状态', '备注', '操作'], renderNodeRows(view), 'min-w-[1080px]')}`,
          },
        ]

  return `
    <div class="space-y-4 p-4">
      ${renderPageHeader(title, description)}
      ${renderFilters(view)}
      <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">${metrics}</section>
      ${renderWarehouseTabs(tabs, mode === 'wait-process' ? 'printing-wait-process-tabs' : 'printing-wait-handover-tabs')}
    </div>
  `
}

export function renderCraftPrintingWaitProcessWarehousePage(): string {
  return renderPrintingWarehousePage('wait-process')
}

export function renderCraftPrintingWaitHandoverWarehousePage(): string {
  return renderPrintingWarehousePage('wait-handover')
}
