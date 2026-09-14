// @page-pattern: list
import { listPrintingFactoryOptions } from '../../../data/fcs/printing-factories.ts'
import { renderStandardListStats, renderStandardListPage } from '../../../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../../components/ui/process-order-list-controller.ts'
import { renderPrintingObjectImage } from './presentation.ts'
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
  const qty = Number.isFinite(value) ? Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 }) : '未记录'
  return unit ? `${qty} ${escapeHtml(unit)}` : qty
}

function formatFactoryCell(factoryName?: string, factoryId?: string): string {
  return escapeHtml(formatFactoryDisplayName(factoryName, factoryId))
}

function buildWaitProcessFlowLines(item: PrintingWarehouseView['waitProcessItems'][number]): FactoryWarehouseFlowLine[] { return item.flows }
function buildWaitHandoverFlowLines(item: PrintingWarehouseView['waitHandoverItems'][number]): FactoryWarehouseFlowLine[] { return item.flows }

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
function inputIdentity(item:{imageUrl:string;materialSku?:string;itemName?:string;materialName?:string}):string {
 const name=item.itemName||item.materialName||''
 return `<div class="flex items-center gap-2">${renderPrintingObjectImage({imageUrl:item.imageUrl,imageAlt:`${name} ${item.materialSku||''}`},'h-10 w-10')}<div><p>${escapeHtml(name)}</p><p class="text-xs text-slate-500">${escapeHtml(item.materialSku||'')}</p></div></div>`
}
function orderLinks(ids:string[]):string { return ids.length?ids.map(id=>`<a class="text-blue-600" href="${buildPrintingWorkOrderDetailLink(id)}" data-nav="${buildPrintingWorkOrderDetailLink(id)}">${escapeHtml(id)}</a>`).join('<br>'):'备货（尚未关联）' }

function renderFilters(view: PrintingWarehouseView): string {
  const all=getPrintingWarehouseView({timeRange:'ALL'})
  return `<section class="rounded-lg border bg-card p-4" data-skip-page-rerender="true"><div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><label class="text-xs text-muted-foreground">工厂<select class="mt-1 block h-9 w-full rounded border px-3 text-sm" data-printing-warehouse-filter="factoryId"><option value="">全部印花工厂</option>${listPrintingFactoryOptions(all.warehouses.map(w=>({printFactoryId:w.factoryId,printFactoryName:w.factoryName}))).map(w=>`<option value="${escapeHtml(w.id)}" ${warehouseFilters.factoryId===w.id?'selected':''}>${escapeHtml(w.name)}</option>`).join('')}</select></label><label class="text-xs text-muted-foreground">状态<select class="mt-1 block h-9 w-full rounded border px-3 text-sm" data-printing-warehouse-filter="status"><option value="">全部状态</option>${[...new Set([...all.waitProcessItems,...all.waitHandoverItems].map(i=>i.status))].map(status=>`<option ${warehouseFilters.status===status?'selected':''}>${escapeHtml(status)}</option>`).join('')}</select></label><label class="text-xs text-muted-foreground">关键字<input class="mt-1 block h-9 w-full rounded border px-3 text-sm" placeholder="任务 / 物料 / 卷号" value="${escapeHtml(warehouseFilters.keyword)}" data-printing-warehouse-filter="keyword"></label><label class="text-xs text-muted-foreground">时间范围<select class="mt-1 block h-9 w-full rounded border px-3 text-sm" data-printing-warehouse-filter="timeRange">${[['7D','近7天'],['30D','近30天'],['ALL','全部时间']].map(([value,label])=>`<option value="${value}" ${warehouseFilters.timeRange===value?'selected':''}>${label}</option>`).join('')}</select></label></div><div class="mt-3 flex gap-2"><button class="rounded bg-blue-600 px-4 py-2 text-sm text-white" data-printing-warehouse-action="query">查询</button><button class="rounded border px-4 py-2 text-sm" data-printing-warehouse-action="reset">重置</button><button class="rounded border px-4 py-2 text-sm" data-printing-warehouse-action="export">导出</button><button class="rounded border px-4 py-2 text-sm" data-printing-action="open-dispatch-pending">待交出列表</button><button class="rounded border px-4 py-2 text-sm" data-printing-action="open-dispatch-documents">交出单据</button></div></section>`
}

function renderWaitProcessRows(view:PrintingWarehouseView):string[][] {
 return view.waitProcessItems.map(item=>[
  formatFactoryCell(item.factoryName,item.factoryId),escapeHtml(item.warehouseName),`<p>${escapeHtml(item.sourceRecordNo)}</p><p class="text-xs text-slate-500">${escapeHtml(item.receiptLineId)}</p>`,orderLinks(item.workOrderIds),inputIdentity(item),
  item.rolls.length?`<details><summary class="cursor-pointer text-blue-600">${item.rolls.length} 卷 · 查看实际长度</summary>${item.rolls.map(r=>`<p class="mt-1 text-xs">${escapeHtml(r.barcode)}：实收 ${formatQty(r.receivedQty,item.unit)} / 已用 ${formatQty(r.usedQty,item.unit)} / 在仓 ${formatQty(r.remainingQty,item.unit)}<br>${escapeHtml(r.location)}</p>`).join('')}</details>`:'按实收包装',
  formatQty(item.originalReceivedQty,item.unit),formatQty(item.issuedQty,item.unit),formatQty(item.receivedQty,item.unit),formatQty(item.preparedQty,item.unit),formatQty(item.freeQty,item.unit),escapeHtml(item.locationText),renderBadge(item.status,item.status.includes('差异')?'danger':'warning'),
  `${renderWarehouseFlowButton(`${item.sourceRecordNo} 库存流水`,item.flows)}<button class="rounded border px-2 py-1 text-xs" data-printing-warehouse-action="print-input-roll" data-stock-id="${escapeHtml(item.stockItemId)}" ${item.rolls.length?'':'disabled'}>打印投入卷条码</button><a class="text-blue-600" href="/fcs/craft/printing/pending-receipts?view=stock" data-nav="/fcs/craft/printing/pending-receipts?view=stock">查看备料关联</a>`
 ])
}
function renderWaitHandoverRows(view:PrintingWarehouseView):string[][] {
 return view.waitHandoverItems.map(item=>[formatFactoryCell(item.factoryName,item.factoryId),escapeHtml(item.warehouseName),orderLinks(item.workOrderIds),inputIdentity(item),escapeHtml(item.fabricRollNo||'未记录'),formatQty(item.completedQty,item.unit),formatQty(item.waitHandoverQty,item.unit),formatQty(item.reservedQty,item.unit),formatQty(item.availableQty,item.unit),escapeHtml(item.locationText),escapeHtml(item.dispatchIds.join(' / ')||'未占用'),escapeHtml(item.receiverName),renderBadge(item.reservedQty>0?'交出单占用':'可建单',item.reservedQty>0?'warning':'success'),`${renderWarehouseFlowButton(`${item.fabricRollNo} 库存流水`,item.flows)}<a class="text-blue-600" href="/fcs/craft/printing/pending-handover?workOrderId=${encodeURIComponent(item.workOrderIds[0])}" data-nav="/fcs/craft/printing/pending-handover?workOrderId=${encodeURIComponent(item.workOrderIds[0])}">查看交出安排</a>`])
}
function renderInboundRows(view:PrintingWarehouseView):string[][] {
 return view.inboundRecords.map(item=>[escapeHtml(item.inboundRecordNo),formatFactoryCell(item.factoryName,item.factoryId),escapeHtml(item.warehouseName),escapeHtml(item.sourceRecordNo),orderLinks(item.workOrderIds),inputIdentity(item),formatQty(item.receivedQty,item.unit),escapeHtml(item.locationNo),escapeHtml(item.receiverName),escapeHtml(item.receivedAt),renderBadge(item.status,item.status.includes('差异')?'danger':'success')])
}
function renderOutboundRows(view:PrintingWarehouseView):string[][] {
 return view.outboundRecords.map(item=>[escapeHtml(item.outboundRecordNo),formatFactoryCell(item.factoryName,item.factoryId),orderLinks(item.workOrderIds),inputIdentity(item),escapeHtml(item.receiverName),formatQty(item.outboundQty,item.unit),item.receiverWrittenQty===undefined?'尚未登记':formatQty(item.receiverWrittenQty,item.unit),item.differenceQty===undefined?'尚未登记':formatQty(item.differenceQty,item.unit),escapeHtml(item.operatorName),escapeHtml(item.outboundAt),renderBadge(item.status==='已回写'?'下游已实收':item.status==='已出库'?'实际已交出':item.status,item.status==='差异'?'danger':'success'),`<a class="text-blue-600" href="/fcs/craft/printing/handover-documents?workOrderId=${encodeURIComponent(item.workOrderIds[0])}" data-nav="/fcs/craft/printing/handover-documents?workOrderId=${encodeURIComponent(item.workOrderIds[0])}">查看交出与实收</a>`])
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

function renderUsageRows(view:PrintingWarehouseView):string[][] {
 return view.usageRecords.map(item=>[orderLinks(item.workOrderId?[item.workOrderId]:[]),formatFactoryCell(item.factoryName,item.factoryId),inputIdentity(item),escapeHtml(item.barcode||'包装用料'),formatQty(item.qty,item.unit),escapeHtml(item.sourceNo),escapeHtml(item.at),escapeHtml(item.operatorName)])
}
function renderProcessInboundRows(view:PrintingWarehouseView):string[][] {
 return view.outputInboundItems.map(item=>[escapeHtml(item.stockItemId),formatFactoryCell(item.factoryName,item.factoryId),orderLinks(item.workOrderIds),inputIdentity(item),escapeHtml(item.fabricRollNo||'未记录'),formatQty(item.completedQty,item.unit),escapeHtml(item.receivedAt||'入仓时间未记录'),escapeHtml(item.inboundOperator||'历史操作人未记录'),escapeHtml(item.locationText)])
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
  const title = mode === 'wait-process' ? '印花待加工仓' : '印花待交出仓'
  const description =
    mode === 'wait-process'
      ? '查看印花任务接收后的待加工库存、入库记录与仓内位置。'
      : '查看印花任务完工后的待交出库存、出库记录与收货差异。'
  const metrics=renderStandardListStats(mode==='wait-process'?[{label:'在仓接收明细',value:view.waitProcessItems.length},{label:'接收明细',value:view.inboundRecords.length},{label:'实际领用记录',value:view.usageRecords.length},{label:'历史原料明细缺失',value:view.unknownInputOrders}]:[{label:'在厂产出卷',value:view.waitHandoverItems.length},{label:'交出记录',value:view.outboundRecords.length},{label:'已登记产出卷',value:view.outputInboundItems.length},{label:'历史产出明细缺失',value:view.unknownOutputOrders},{label:'待整理产出卷数量',value:Object.entries(view.unlocatedOutputByUnit).map(([unit,qty])=>`${qty.toLocaleString('zh-CN',{maximumFractionDigits:2})} ${unit}`).join(' / ')||'0'}])

  const tabs: WarehouseTab[] =
    mode === 'wait-process'
      ? [
          {
            key: 'wait-process',
            label: '库存',
            count: view.waitProcessItems.length,
            table: renderTable(['工厂','仓库','来源 / 收货批次','加工单归属','物料 / SKU','实际卷明细','实收入仓','实际已用','实物库存','备料剩余占用','未分配可用','库位','状态','操作'], renderWaitProcessRows(view), 'min-w-[1680px]'),
          },
          {
            key: 'inbound',
            label: '接收记录',
            count: view.inboundRecords.length,
            table: renderTable(['接收单号','工厂','待加工仓','来源单','加工单归属','物料 / SKU','实收入仓','库位','接收人','接收时间','状态'], renderInboundRows(view), 'min-w-[1680px]'),
          },
          {
            key: 'usage',
            label: '加工用料记录',
            count: view.usageRecords.length,
            table: renderTable(['加工单归属','工厂','物料 / SKU','卷号 / 包装','实际用料','来源接收单','用料时间','操作人'], renderUsageRows(view), 'min-w-[1120px]'),
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
            table: renderTable(['工厂','仓库','加工单归属','产出物料 / SKU','卷号','实际产出','在厂实物','建单占用','可新建单','库位','占用交出单','下游接收方','状态','操作'], renderWaitHandoverRows(view), 'min-w-[1740px]'),
          },
          {
            key: 'outbound',
            label: '交出记录',
            count: view.outboundRecords.length,
            table: renderTable(['交出记录号','工厂','加工单归属','产出物料 / SKU','接收方','实际交出','下游实收','下游多 / 少','交出人','实际交出时间','状态','操作'], renderOutboundRows(view), 'min-w-[1720px]'),
          },
          {
            key: 'process-inbound',
            label: '加工入仓记录',
            count: view.outputInboundItems.length,
            table: renderTable(['产出卷记录','工厂','加工单归属','产出物料 / SKU','卷号','实际产出数量','实际入仓时间','操作人','库位'], renderProcessInboundRows(view), 'min-w-[1280px]'),
          },
          {
            key: 'nodes',
            label: '库区库位',
            count: view.nodeRows.length,
            table: `<div class="border-b px-4 py-3">${renderWarehouseLocationToolbar('印花待交出仓')}</div>${renderTable(['工厂', '仓库', '库区', '货架', '库位', '状态', '备注', '操作'], renderNodeRows(view), 'min-w-[1080px]')}`,
          },
        ]

  return `<div data-printing-warehouse-root data-mode="${mode}" data-skip-page-rerender="true">${renderStandardListPage({title,feedbackHtml:`<p class="text-sm text-muted-foreground">${description} 历史未记录的卷、库位、领用时间不会按计划数量补造；近 7/30 天仅包含明确发生日期。</p>`,filtersHtml:renderFilters(view),statsHtml:metrics,tableHtml:renderWarehouseTabs(tabs,mode==='wait-process'?'printing-wait-process-tabs':'printing-wait-handover-tabs'),paginationHtml:'',className:'space-y-4 p-4 min-w-0'})}</div>`
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
    if(!item?.rolls.length)return true
    const frame=document.createElement('iframe');frame.title='投入卷条码打印';frame.className='fixed h-0 w-0 border-0';frame.srcdoc=`<!doctype html><html><meta charset="utf-8"><style>@page{size:100mm 70mm;margin:5mm}body{font:12px sans-serif}.label{break-after:page}.label:last-child{break-after:auto}svg{max-width:100%;height:60px}img{width:36px;height:36px;object-fit:cover}</style>${item.rolls.map(roll=>`<section class="label"><h2>印花待加工仓 · 投入卷</h2><p><img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.itemName)}"> ${escapeHtml(item.itemName)} ${escapeHtml(item.materialSku||'')}</p>${renderCode128Barcode(roll.barcode,'投入卷条码')}<p>${escapeHtml(roll.location)}</p><p>实收 ${formatQty(roll.receivedQty,item.unit)} · 在仓 ${formatQty(roll.remainingQty,item.unit)}</p><p>来源 ${escapeHtml(item.sourceRecordNo)}</p></section>`).join('')}</html>`;frame.onload=()=>{frame.contentWindow?.print();setTimeout(()=>frame.remove(),60000)};document.body.appendChild(frame);return true
  }
  return false
}
