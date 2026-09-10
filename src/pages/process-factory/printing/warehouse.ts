// @page-pattern: list
import { renderStandardListPage } from '../../../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../../components/ui/process-order-list-controller.ts'
import { renderPrintingBusinessImage } from './work-orders.ts'
import { printingInputIdentity } from './relations.ts'
import { getPrintingWorkOrderById } from '../../../data/fcs/printing-task-domain.ts'
import { renderCode128Barcode } from '../../../components/real-barcode.ts'

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
      flowType: '接收入仓',
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

let warehouseMode: PrintingWarehouseMode = 'wait-process'
let warehouseFilters = {factoryId:'',status:'',keyword:'',timeRange:'ALL' as '7D'|'30D'|'ALL'}
let tableIndex = 0
const tableControllers = new Map<string, {rows:string[][];controller:ReturnType<typeof createProcessOrderListController<string[]>>;state:ProcessOrderListControllerState}>()
function renderTable(headers: string[], rows: string[][], _minWidthClass = ''): string {
  const key = `${warehouseMode}-${tableIndex++}`
  const prefix = `printing-warehouse-${key}`
  let entry=tableControllers.get(key)
  if(!entry) {
    const state:ProcessOrderListControllerState={currentPage:1,sort:null,preferences:{order:[],visibleKeys:[],frozenKeys:[],pageSize:20},preferencesLoaded:false,showColumnSettings:false}
    const controller=createProcessOrderListController({state,columns:headers.map((title,index)=>({key:String(index),title,width:title==='操作'?260:150,required:index===0 || /SKU|卷号|加工单号/.test(title),actionColumn:title==='操作',freezeable:title!=='操作',sortable:title!=='操作',render:(row:string[])=>row[index]||'—',sortValue:(row:string[])=>(row[index]||'').replace(/<[^>]*>/g,'')})),preferenceKey:`/fcs/craft/printing/${warehouseMode}-warehouse:${key}`,pageSizeOptions:[20,30,50],eventPrefix:prefix,rootSelector:`[data-wh-table="${key}"]`,tableSurfaceSelector:'[data-wh-table-body]',paginationSurfaceSelector:'[data-wh-pagination]',overlaysSurfaceSelector:'[data-wh-overlays]',defaultFrozenKeys:[],columnSettingsTitle:'仓库列设置',emptyText:'暂无符合条件的库存记录',getRows:()=>tableControllers.get(key)?.rows||[],locallyManagedEvents:true})
    entry={rows,controller,state};tableControllers.set(key,entry)
  }
  entry.rows=rows
  entry.controller.installColumnDragEvents()
  const view=entry.controller.getView()
  return `<div data-wh-table="${key}" data-skip-page-rerender="true"><div class="flex justify-end border-b p-2"><button class="rounded border px-3 py-1 text-sm" data-wh-table-action="columns">列设置</button></div><div data-wh-table-body>${view.tableHtml}</div><div class="border-t p-3" data-wh-pagination>${view.paginationHtml}</div><div data-wh-overlays>${entry.controller.renderColumnSettings()}</div></div>`
}
function inputIdentity(sourceId:string,sku:string):string {
  const order=getPrintingWorkOrderById(sourceId)
  const material=order?printingInputIdentity(order):undefined
  return `<div class="flex items-center gap-2">${material && material.sku===sku?renderPrintingBusinessImage(material,'h-10 w-10'):'<span class="text-xs text-amber-700">对应物料图待补齐</span>'}<span>${escapeHtml(sku)}</span></div>`
}
function renderFilters(view: PrintingWarehouseView): string {
  const all=getPrintingWarehouseView({timeRange:'ALL'})
  return `<section class="rounded-lg border bg-card p-4" data-skip-page-rerender="true"><div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><label class="text-xs text-muted-foreground">工厂<select class="mt-1 block h-9 w-full rounded border px-3 text-sm" data-printing-warehouse-filter="factoryId"><option value="">全部印花工厂</option>${all.warehouses.filter((w,i,a)=>a.findIndex(x=>x.factoryId===w.factoryId)===i).map(w=>`<option value="${escapeHtml(w.factoryId)}" ${warehouseFilters.factoryId===w.factoryId?'selected':''}>${escapeHtml(w.factoryName)}</option>`).join('')}</select></label><label class="text-xs text-muted-foreground">状态<select class="mt-1 block h-9 w-full rounded border px-3 text-sm" data-printing-warehouse-filter="status"><option value="">全部状态</option>${[...new Set([...all.waitProcessItems,...all.waitHandoverItems].map(i=>i.status))].map(status=>`<option ${warehouseFilters.status===status?'selected':''}>${escapeHtml(status)}</option>`).join('')}</select></label><label class="text-xs text-muted-foreground">关键字<input class="mt-1 block h-9 w-full rounded border px-3 text-sm" placeholder="任务 / 物料 / 卷号" value="${escapeHtml(warehouseFilters.keyword)}" data-printing-warehouse-filter="keyword"></label><label class="text-xs text-muted-foreground">时间范围<select class="mt-1 block h-9 w-full rounded border px-3 text-sm" data-printing-warehouse-filter="timeRange">${[['7D','近7天'],['30D','近30天'],['ALL','全部时间']].map(([value,label])=>`<option value="${value}" ${warehouseFilters.timeRange===value?'selected':''}>${label}</option>`).join('')}</select></label></div><div class="mt-3 flex gap-2"><button class="rounded bg-blue-600 px-4 py-2 text-sm text-white" data-printing-warehouse-action="query">查询</button><button class="rounded border px-4 py-2 text-sm" data-printing-warehouse-action="reset">重置</button><button class="rounded border px-4 py-2 text-sm" data-printing-warehouse-action="export">导出</button><button class="rounded border px-4 py-2 text-sm" data-printing-action="open-dispatch-pending">待交出列表</button><button class="rounded border px-4 py-2 text-sm" data-printing-action="open-dispatch-documents">交出单据</button></div></section>`
}

function renderWaitProcessRows(view: PrintingWarehouseView): string[][] {
  return view.waitProcessItems
    .map(
      (item) => [
          `${formatFactoryCell(item.factoryName, item.factoryId)}`,
          `${escapeHtml(item.warehouseName)}`,
          `${escapeHtml(item.sourceRecordNo)}`,
          `${escapeHtml(item.taskNo || '—')}`,
          `${escapeHtml(item.itemKind)}`,
          `${inputIdentity(item.sourceRecordId || '',item.materialSku || item.partName || item.itemName || '—')}`,
          `${escapeHtml(item.fabricColor || '—')}`,
          `${escapeHtml(item.sizeCode || '—')}`,
          `${escapeHtml(item.fabricRollNo || '—')}`,
          `${formatQty(item.expectedQty, item.unit)}`,
          `${formatQty(item.receivedQty, item.unit)}`,
          `${formatQty(item.differenceQty, item.unit)}`,
          `${escapeHtml(item.areaName)} / ${escapeHtml(item.shelfNo)} / ${escapeHtml(item.locationNo)}`,
          `${renderBadge(item.status, item.status.includes('差异') ? 'danger' : 'warning')}`,
          `
            <div class="flex flex-wrap gap-2">
              <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${buildPrintingWorkOrderDetailLink(item.sourceRecordId)}">查看印花加工单</button>
              ${renderWarehouseFlowButton(`${item.sourceRecordNo} 库存流水`, buildWaitProcessFlowLines(item))}<button class="rounded border px-2 py-1 text-xs" data-printing-warehouse-action="print-input-roll" data-stock-id="${escapeHtml(item.stockItemId)}" ${item.fabricRollNo ? '' : 'disabled title="未记录原投入卷码，不能生成替代条码"'}>打印条码</button>
              <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${item.taskId ? buildTaskDetailLink(item.taskId) : ''}" ${item.taskId ? '' : 'disabled'}>打开移动端执行页</button>
            </div>
          `,
        ],
    )
}

function renderWaitHandoverRows(view: PrintingWarehouseView): string[][] {
  return view.waitHandoverItems
    .map(
      (item) => [
          `${formatFactoryCell(item.factoryName, item.factoryId)}`,
          `${escapeHtml(item.warehouseName)}`,
          `${escapeHtml(item.taskNo || '—')}`,
          `${escapeHtml(item.itemKind)}`,
          `${inputIdentity('',item.materialSku || item.partName || item.itemName || '—')}`,
          `${escapeHtml(item.fabricColor || '—')}`,
          `${escapeHtml(item.fabricRollNo || '—')}`,
          `${formatQty(item.completedQty, item.unit)}`,
          `${formatQty(item.lossQty, item.unit)}`,
          `${formatQty(item.waitHandoverQty, item.unit)}`,
          `${escapeHtml(item.receiverName)}`,
          `${escapeHtml(item.handoverOrderNo || '—')}`,
          `${escapeHtml(item.handoverRecordNo || '—')}`,
          `${typeof item.receiverWrittenQty === 'number' ? formatQty(item.receiverWrittenQty, item.unit) : '—'}`,
          `${renderBadge(item.status, item.status.includes('差异') || item.status.includes('异议') ? 'danger' : 'warning')}`,
          `
            <div class="flex flex-wrap gap-2">
              <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${item.handoverOrderId ? buildHandoverOrderLink(item.handoverOrderId) : ''}" ${item.handoverOrderId ? '' : 'disabled'}>打开移动端交出页</button>
              ${renderWarehouseFlowButton(`${item.taskNo || item.stockItemId} 库存流水`, buildWaitHandoverFlowLines(item))}
            </div>
          `,
        ],
    )
}

function renderInboundRows(view: PrintingWarehouseView): string[][] {
  return view.inboundRecords
    .map(
      (item) => [
          `${escapeHtml(item.inboundRecordNo)}`,
          `${formatFactoryCell(item.factoryName, item.factoryId)}`,
          `${escapeHtml(item.warehouseName)}`,
          `${escapeHtml(item.sourceRecordNo)}`,
          `${escapeHtml(item.taskNo || '—')}`,
          `${inputIdentity(item.sourceRecordId || '',item.materialSku || item.partName || item.itemName || '—')}`,
          `${formatQty(item.expectedQty, item.unit)}`,
          `${formatQty(item.receivedQty, item.unit)}`,
          `${formatQty(item.differenceQty, item.unit)}`,
          `${escapeHtml(item.areaName)} / ${escapeHtml(item.shelfNo)} / ${escapeHtml(item.locationNo)}`,
          `${escapeHtml(item.receiverName)}`,
          `${escapeHtml(item.receivedAt)}`,
          `${renderBadge(item.status, item.status.includes('差异') ? 'danger' : 'success')}`,
          `<button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${buildPrintingWorkOrderDetailLink(item.sourceRecordId)}">查看印花加工单</button>`,
        ],
    )
}

function renderOutboundRows(view: PrintingWarehouseView): string[][] {
  return view.outboundRecords
    .map(
      (item) => [
          `${escapeHtml(item.outboundRecordNo)}`,
          `${formatFactoryCell(item.factoryName, item.factoryId)}`,
          `${escapeHtml(item.warehouseName)}`,
          `${escapeHtml(item.sourceTaskNo || '—')}`,
          `${escapeHtml(item.handoverOrderNo || '—')}`,
          `${escapeHtml(item.handoverRecordNo || '—')}`,
          `${escapeHtml(item.receiverName)}`,
          `${inputIdentity(item.sourceRecordId || '',item.materialSku || item.partName || item.itemName || '—')}`,
          `${formatQty(item.outboundQty, item.unit)}`,
          `${typeof item.receiverWrittenQty === 'number' ? formatQty(item.receiverWrittenQty, item.unit) : '—'}`,
          `${typeof item.differenceQty === 'number' ? formatQty(item.differenceQty, item.unit) : '—'}`,
          `${escapeHtml(item.operatorName)}`,
          `${escapeHtml(item.outboundAt)}`,
          `${renderBadge(item.status, item.status.includes('差异') || item.status.includes('异议') ? 'danger' : 'success')}`,
          `
            <div class="flex flex-wrap gap-2">
              <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${item.handoverOrderId ? buildHandoverOrderLink(item.handoverOrderId) : ''}" ${item.handoverOrderId ? '' : 'disabled'}>查看交出</button>
              ${
                item.handoverRecordId
                  ? `<button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${buildTaskDeliveryCardPrintLink(item.handoverRecordId)}">打印任务交货卡</button><button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${buildHandoverQrLabelPrintLink(item.handoverRecordId)}">打印交出二维码</button>`
                  : '<button type="button" class="inline-flex cursor-not-allowed items-center rounded-md border px-2 py-1 text-xs opacity-50" disabled>打印任务交货卡</button>'
              }
              <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${item.handoverOrderId ? buildHandoverOrderLink(item.handoverOrderId) : ''}" ${item.handoverOrderId ? '' : 'disabled'}>查看收货</button>
            </div>
          `,
        ],
    )
}

function renderNodeRows(view: PrintingWarehouseView): string[][] {
  return view.nodeRows
    .map(
      (row) => [
          `${formatFactoryCell(row.factoryName, row.factoryId)}`,
          `${escapeHtml(row.warehouseName)}`,
          `${escapeHtml(row.areaName)}`,
          `${escapeHtml(row.shelfNo || '—')}`,
          `${escapeHtml(row.locationNo || '—')}`,
          `${renderBadge(row.status === 'AVAILABLE' ? '可用' : '停用', row.status === 'AVAILABLE' ? 'success' : 'warning')}`,
          `${escapeHtml(row.remark || '—')}`,
          `${renderWarehouseLocationActions('印花仓库库区库位', `${row.areaName}/${row.shelfNo || '—'}/${row.locationNo || '—'}`)}`,
        ],
    )
}

function renderUsageRows(view: PrintingWarehouseView): string[][] {
  return view.waitProcessItems
    .map(
      (item) => [
          `${escapeHtml(item.taskNo || item.sourceRecordNo)}`,
          `${formatFactoryCell(item.factoryName, item.factoryId)}`,
          `${escapeHtml(item.itemKind)}`,
          `${inputIdentity(item.sourceRecordId || '',item.materialSku || item.partName || item.itemName || '—')}`,
          `${formatQty(Math.max(item.receivedQty - item.differenceQty, 0), item.unit)}`,
          `${escapeHtml(item.sourceRecordNo)}`,
          `${escapeHtml(item.receivedAt)}`,
          `${renderBadge(item.status === '差异待处理' ? '差异待处理' : '已领用', item.status === '差异待处理' ? 'danger' : 'success')}`,
        ],
    )
}

function renderProcessInboundRows(view: PrintingWarehouseView): string[][] {
  return view.waitHandoverItems
    .map(
      (item) => [
          `${escapeHtml(item.stockItemId)}`,
          `${formatFactoryCell(item.factoryName, item.factoryId)}`,
          `${escapeHtml(item.taskNo || '—')}`,
          `${escapeHtml(item.itemKind)}`,
          `${inputIdentity('',item.materialSku || item.partName || item.itemName || '—')}`,
          `${formatQty(item.completedQty, item.unit)}`,
          `${formatQty(item.lossQty, item.unit)}`,
          `${escapeHtml(item.areaName)} / ${escapeHtml(item.shelfNo)} / ${escapeHtml(item.locationNo)}`,
          `${renderBadge(item.status, item.status.includes('差异') ? 'danger' : 'success')}`,
        ],
    )
}

function renderStocktakeRows(view: PrintingWarehouseView): string[][] {
  return view.stocktakeOrders
    .map(
      (order) => [
          `${escapeHtml(order.stocktakeOrderNo)}`,
          `${formatFactoryCell(order.factoryName, order.factoryId)}`,
          `${escapeHtml(order.warehouseName)}`,
          `${escapeHtml(order.stocktakeScope)}`,
          `${escapeHtml(order.createdBy)}`,
          `${escapeHtml(order.createdAt)}`,
          `${String(order.lineList.length)}`,
          `${String(order.lineList.filter((line) => line.status === '差异').length)}`,
          `${renderBadge(order.status, order.status === '已完成' ? 'success' : 'warning')}`,
        ],
    )
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
  warehouseMode=mode;tableIndex=0
  const view = getPrintingWarehouseView(warehouseFilters)
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
          renderMetricCard('接收记录', String(view.inboundRecords.length), '筛选范围内'),
          renderMetricCard('加工用料记录', String(view.waitProcessItems.length), '按库存推演'),
          renderMetricCard('库区库位', String(view.nodeRows.length), '支持新增、编辑、删除'),
          renderMetricCard('接收差异记录数', String(inboundDifferenceCount), '接收差异'),
        ].join('')
      : [
          renderMetricCard('待交出仓记录数', String(view.waitHandoverItems.length), '待交出仓记录'),
          renderMetricCard('交出记录', String(view.outboundRecords.length), '筛选范围内'),
          renderMetricCard('加工入仓记录', String(view.waitHandoverItems.length), '按完工入仓'),
          renderMetricCard('已收货记录数', String(view.outboundRecords.filter((item) => String(item.status) === '已收货').length), '接收方确认收货'),
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
            label: '接收记录',
            count: view.inboundRecords.length,
            table: renderTable(['接收单号', '工厂', '待加工仓', '印花加工单号', '所属任务', '面料 SKU', '计划数量', '确认入仓数量', '差异数量', '库位', '操作人', '操作时间', '状态', '操作'], renderInboundRows(view), 'min-w-[1680px]'),
          },
          {
            key: 'usage',
            label: '加工用料记录',
            count: view.waitProcessItems.length,
            table: renderTable(['所属任务', '工厂', '类型', '物料 / 裁片', '用料数量', '来源接收单', '用料时间', '状态'], renderUsageRows(view), 'min-w-[1120px]'),
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

  return `<div data-printing-warehouse-root data-mode="${mode}" data-skip-page-rerender="true">${renderStandardListPage({title,feedbackHtml:`<p class="text-sm text-muted-foreground">${description}</p>`,filtersHtml:renderFilters(view),statsHtml:`<section class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">${metrics}</section>`,tableHtml:renderWarehouseTabs(tabs,mode==='wait-process'?'printing-wait-process-tabs':'printing-wait-handover-tabs'),paginationHtml:'',className:'space-y-4 p-4 min-w-0'})}</div>`
}

export function renderCraftPrintingWaitProcessWarehousePage(): string {
  return renderPrintingWarehousePage('wait-process')
}

export function renderCraftPrintingWaitHandoverWarehousePage(): string {
  return renderPrintingWarehousePage('wait-handover')
}


export function handlePrintingWarehouseEvent(target:HTMLElement):boolean {
  const root=target.closest<HTMLElement>('[data-printing-warehouse-root]')
  if(!root)return false
  if(target.closest('[data-printing-warehouse-filter]'))return true
  const table=target.closest<HTMLElement>('[data-wh-table]')
  if(table && !target.closest('[data-printing-warehouse-action]')) {
    const key=table.dataset.whTable!,entry=tableControllers.get(key),prefix=`printing-warehouse-${key}`
    if(entry) {
      const field=target.closest<HTMLSelectElement>(`[data-${prefix}-field]`)
      const actionNode=target.closest<HTMLElement>(`[data-${prefix}-action], [data-wh-table-action]`)
      const action=actionNode?.getAttribute(`data-${prefix}-action`) || actionNode?.dataset.whTableAction
      if(field?.getAttribute(`data-${prefix}-field`)==='pageSize')entry.controller.setPageSize(Number(field.value))
      else if(action==='columns')entry.state.showColumnSettings=true
      else if(action==='close-column-settings')entry.state.showColumnSettings=false
      else if(action==='sort-column')entry.controller.cycleSort(actionNode?.dataset.columnKey || '')
      else if(action==='prev-page'||action==='next-page')entry.controller.stepPage(action==='next-page'?1:-1)
      else if(action==='restore-column-settings')entry.controller.restorePreferences()
      else if(action==='toggle-column-visibility'||action==='toggle-column-freeze')entry.controller.updateColumnPreference(action,actionNode?.getAttribute(`data-${prefix}-column-key`) || actionNode?.closest(`[data-${prefix}-column-key]`)?.getAttribute(`data-${prefix}-column-key`) || '',target instanceof HTMLInputElement?target.checked:undefined)
      else return false
      entry.controller.refresh({overlays:true});return true
    }
  }
  const actionNode=target.closest<HTMLElement>('[data-printing-warehouse-action]')
  if(!actionNode)return false
  const action=actionNode.dataset.printingWarehouseAction
  if(action==='query'||action==='reset') {
    if(action==='reset')warehouseFilters={factoryId:'',status:'',keyword:'',timeRange:'ALL'}
    else root.querySelectorAll<HTMLInputElement>('[data-printing-warehouse-filter]').forEach(input=>{const key=input.dataset.printingWarehouseFilter as keyof typeof warehouseFilters;(warehouseFilters as Record<string,string>)[key]=input.value})
    tableControllers.forEach(entry=>entry.state.currentPage=1)
    const tab=root.querySelector<HTMLInputElement>('input[type="radio"]:checked')?.id
    const html=renderPrintingWarehousePage(root.dataset.mode as PrintingWarehouseMode)
    const container=document.createElement('div');container.innerHTML=html;root.innerHTML=container.firstElementChild!.innerHTML
    if(tab){const input=root.querySelector<HTMLInputElement>(`#${tab}`);if(input)input.checked=true}
    return true
  }
  if(action==='export') {
    const view=getPrintingWarehouseView(warehouseFilters)
    const rows=warehouseMode==='wait-process'?view.waitProcessItems.map(item=>[item.factoryName,item.warehouseName,item.materialSku,item.fabricRollNo,item.receivedQty,item.unit,item.locationNo]):view.waitHandoverItems.map(item=>[item.factoryName,item.warehouseName,item.materialSku,item.fabricRollNo,item.waitHandoverQty,item.unit,item.locationNo])
    const csv=[['工厂','仓库','物料SKU','卷号','库存数量','单位','库位'],...rows].map(row=>row.map(value=>`"${String(value??'').replaceAll('"','""')}"`).join(',')).join('\n')
    const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='印花仓库库存.csv';link.click();URL.revokeObjectURL(url);return true
  }
  if(action==='print-input-roll') {
    const item=getPrintingWarehouseView({timeRange:'ALL'}).waitProcessItems.find(item=>item.stockItemId===actionNode.dataset.stockId)
    if(!item?.fabricRollNo)return true
    const frame=document.createElement('iframe');frame.title='投入卷条码打印';frame.className='fixed h-0 w-0 border-0';frame.srcdoc=`<!doctype html><html><meta charset="utf-8"><style>@page{size:100mm 70mm;margin:5mm}body{font:12px sans-serif}svg{max-width:100%;height:70px}</style><h2>印花待加工仓 · 投入卷</h2><p>${escapeHtml(item.materialSku || '')}</p>${renderCode128Barcode(item.fabricRollNo,'投入卷条码')}<p>${escapeHtml(item.warehouseName)} · ${escapeHtml(item.locationNo)}</p><p>库存 ${formatQty(item.receivedQty,item.unit)} · 来源 ${escapeHtml(item.sourceRecordNo)}</p></html>`;frame.onload=()=>{frame.contentWindow?.print();setTimeout(()=>frame.remove(),60000)};document.body.appendChild(frame);return true
  }
  return false
}
