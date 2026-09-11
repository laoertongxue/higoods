import {renderStandardListPage,renderStandardListStats} from '../../../components/ui/list-page.ts'
import {createProcessOrderListController,type ProcessOrderListControllerState} from '../../../components/ui/process-order-list-controller.ts'
import type {StandardListColumn} from '../../../components/ui/list-table.ts'
// @page-pattern: list
import {
  buildDyeingWorkOrderDetailLink,
  buildHandoverQrLabelPrintLink,
  buildHandoverOrderLink,
  buildTaskDeliveryCardPrintLink,
  buildTaskDetailLink,
} from '../../../data/fcs/fcs-route-links.ts'
import {
  getDyeingWarehouseView,
  type DyeingWarehouseView,
  type DyeingWarehouseViewFilters,
} from '../../../data/fcs/dyeing-warehouse-view.ts'
import { escapeHtml } from '../../../utils.ts'
import {dyeFactoryTabLabel} from '../../../data/fcs/dye-work-order-demo-details.ts'
import { formatFactoryDisplayName } from '../../../data/fcs/factory-display-data.ts'
import {
  renderBadge,
} from './shared.ts'
import {
  renderFactoryWarehouseStandardTabs,
  renderWarehouseFlowButton,
  renderWarehouseLocationActions,
  renderWarehouseLocationToolbar,
  type FactoryWarehouseFlowLine,
  type FactoryWarehouseStandardTab,
} from '../shared/warehouse-standard.ts'

type DyeingWarehouseMode = 'wait-process' | 'wait-handover'

function materialCell(item:{itemName:string;materialSku?:string;photoList?:string[]}):string {
 const url=item.photoList?.[0],title=`${item.itemName} ${item.materialSku||''}`
 return `<div class="flex items-start gap-2">${url?`<button type="button" class="relative h-10 w-10 shrink-0 overflow-hidden rounded border" data-pda-image-preview-url="${escapeHtml(url)}" data-pda-image-preview-title="${escapeHtml(title)}" data-skip-page-rerender="true" aria-label="查看${escapeHtml(title)}大图"><img class="h-full w-full object-cover" src="${escapeHtml(url)}" alt="${escapeHtml(title)}" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false"><span class="absolute inset-0 bg-white text-[10px]">图片加载中</span></button>`:'<span>物料图片未维护</span>'}<div><div>${escapeHtml(item.itemName)}</div><div class="text-xs text-muted-foreground">${escapeHtml(item.materialSku||'按原单物料')}</div></div></div>`
}

function formatQty(value: number | undefined, unit = ''): string {
  const qty = Number.isFinite(value) ? Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 3 }) : '0'
  return unit ? `${qty} ${escapeHtml(unit)}` : qty
}

function formatFactoryCell(factoryName?: string, factoryId?: string): string {
  return escapeHtml(dyeFactoryTabLabel(factoryId||'',factoryName||''))
}

function buildWaitProcessFlowLines(item: DyeingWarehouseView['waitProcessItems'][number]): FactoryWarehouseFlowLine[] {
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
  if ((item.issuedQty ?? 0) > 0) {
    lines.push({
      flowType: '加工用料',
      qtyText: `-${formatQty(item.issuedQty ?? 0, item.unit)}`,
      sourceNo: item.taskNo || item.sourceRecordNo,
      operatedAt: item.receivedAt,
      operatorName: item.factoryName,
      statusText: '染色领用',
    })
  }
  return lines
}

function buildWaitHandoverFlowLines(item: DyeingWarehouseView['waitHandoverItems'][number]): FactoryWarehouseFlowLine[] {
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

type WarehouseTable = {rows:string[][];controller:ReturnType<typeof createProcessOrderListController<string[]>>;state:ProcessOrderListControllerState}
const tables=new Map<string,WarehouseTable>()
let tableEventsInstalled=false
let warehouseFilters:DyeingWarehouseViewFilters={timeRange:'ALL'}
let warehouseMode:DyeingWarehouseMode='wait-process'
function installTableEvents(){
 if(tableEventsInstalled||typeof document==='undefined')return
 tableEventsInstalled=true
 const handle=(event:Event)=>{
  const target=event.target instanceof Element?event.target:null
  const filterAction=target?.closest<HTMLElement>('[data-dye-wh-filter-action]')?.dataset.dyeWhFilterAction
  if(event.type==='click'&&filterAction){event.preventDefault();const scope=document.querySelector<HTMLElement>('[data-dye-wh-page]')!;const value=(key:string)=>(scope.querySelector(`[data-dye-wh-filter="${key}"]`) as HTMLInputElement).value;warehouseFilters=filterAction==='reset'?{timeRange:'ALL'}:{factoryId:value('factory'),status:value('status'),keyword:value('keyword'),timeRange:value('time') as 'ALL'|'7D'|'30D'};scope.outerHTML=renderDyeingWarehousePage(warehouseMode);return}
  const root=target?.closest<HTMLElement>('[data-dye-warehouse-table]'),entry=root?tables.get(root.dataset.dyeWarehouseTable||''):undefined
  if(!entry)return
  const action=target?.closest<HTMLElement>('[data-dye-warehouse-action]')?.dataset.dyeWarehouseAction
  const field=target?.closest<HTMLElement>('[data-dye-warehouse-field]')?.dataset.dyeWarehouseField
  if(event.type==='change'&&field==='pageSize'&&target instanceof HTMLSelectElement)entry.controller.setPageSize(Number(target.value))
  else if(event.type==='click'&&action){
   const node=target!.closest<HTMLElement>('[data-dye-warehouse-action]')!,key=node.dataset.columnKey||node.dataset.dyeWarehouseColumnKey||''
   if(action==='prev-page')entry.controller.stepPage(-1)
   else if(action==='next-page')entry.controller.stepPage(1)
   else if(action==='sort-column')entry.controller.cycleSort(key)
   else if(action==='open-column-settings')entry.state.showColumnSettings=true
   else if(action==='close-column-settings')entry.state.showColumnSettings=false
   else if(action==='restore-column-settings')entry.controller.restorePreferences()
   else if(action==='toggle-column-visibility'||action==='toggle-column-freeze')entry.controller.updateColumnPreference(action,key,node instanceof HTMLInputElement?node.checked:undefined)
   else return
  }else return
  if(!(target instanceof HTMLInputElement))event.preventDefault();entry.controller.refresh({overlays:true})
 }
 document.addEventListener('click',handle);document.addEventListener('change',handle)
}
function renderTable(headers:string[],rows:string[][],_width=''):string {
 const key=(typeof window==='undefined'?'warehouse':window.location.pathname.split('/').at(-1))+'-'+headers.join('|')
 const id='dye-wh-'+Array.from(key).reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0)
 let entry=tables.get(id)
 if(!entry){
  const columns:StandardListColumn<string[]>[]=headers.map((title,i)=>({key:`col-${i}`,title,width:title==='操作'?280:/SKU|物料/.test(title)?260:150,required:i===0||/SKU|物料/.test(title),freezeable:title!=='操作',sortable:title!=='操作',actionColumn:title==='操作',render:row=>row[i]||'',sortValue:row=>row[i]?.replace(/<[^>]*>/g,'')}))
  const state:ProcessOrderListControllerState={currentPage:1,sort:null,preferences:{order:[],visibleKeys:[],frozenKeys:[],pageSize:10},preferencesLoaded:false,showColumnSettings:false}
  const controller=createProcessOrderListController({state,columns,preferenceKey:`higood.${id}.columns`,pageSizeOptions:[10,20,50],eventPrefix:'dye-warehouse',rootSelector:`[data-dye-warehouse-table="${id}"]`,tableSurfaceSelector:'[data-dye-warehouse-table-surface]',paginationSurfaceSelector:'[data-dye-warehouse-pagination]',overlaysSurfaceSelector:'[data-dye-warehouse-overlays]',defaultFrozenKeys:[],columnSettingsTitle:'仓库列设置',emptyText:'暂无相应记录',getRows:()=>tables.get(id)?.rows??[],locallyManagedEvents:true})
  entry={rows,controller,state};tables.set(id,entry);controller.installColumnDragEvents()
 }
 entry.rows=rows;installTableEvents()
 const view=entry.controller.getView()
 return `<div data-dye-warehouse-table="${id}">${renderStandardListPage({title:'仓库明细',showHeader:false,filtersHtml:'',listTitle:`共 ${rows.length} 条`,listActionsHtml:'<button type="button" class="h-9 rounded border px-3 text-sm" data-dye-warehouse-action="open-column-settings" data-skip-page-rerender="true">列设置</button>',tableHtml:`<div data-dye-warehouse-table-surface>${view.tableHtml}</div>`,paginationHtml:`<div data-dye-warehouse-pagination>${view.paginationHtml}</div>`,overlaysHtml:`<div data-dye-warehouse-overlays>${entry.controller.renderColumnSettings()}</div>`})}</div>`
}
function renderMetricCard(label:string,value:string,_description:string):string{return renderStandardListStats([{label,value}])}

function renderFilters(view: DyeingWarehouseView): string {
  const factories=new Map(getDyeingWarehouseView().waitProcessItems.concat(getDyeingWarehouseView().waitHandoverItems as never[]).map(r=>[r.factoryId,dyeFactoryTabLabel(r.factoryId,r.factoryName)]))
  const select=(key:string,options:[string,string][],value='')=>`<select class="mt-1 w-full rounded border bg-white p-2" data-dye-wh-filter="${key}">${options.map(([v,l])=>`<option value="${escapeHtml(v)}" ${v===value?'selected':''}>${escapeHtml(l)}</option>`).join('')}</select>`
  return `<section class="rounded-lg border bg-card p-4"><div class="grid gap-3 md:grid-cols-4"><label>工厂${select('factory',[['','全部染色工厂'],...factories],warehouseFilters.factoryId)}</label><label>状态${select('status',[['','全部状态'],['已入待加工仓','已入待加工仓'],['待交出','待交出'],['已交出','已交出']],warehouseFilters.status)}</label><label>关键字<input class="mt-1 w-full rounded border p-2" data-dye-wh-filter="keyword" placeholder="任务号 / 单号 / 卷号" value="${escapeHtml(warehouseFilters.keyword||'')}"></label><label>流水时间${select('time',[['ALL','全部记录'],['7D','近7天'],['30D','近30天']],warehouseFilters.timeRange)}</label></div><div class="mt-3 flex gap-2"><button class="rounded bg-blue-600 px-4 py-2 text-white" data-dye-wh-filter-action="query" data-skip-page-rerender="true">查询</button><button class="rounded border px-4 py-2" data-dye-wh-filter-action="reset" data-skip-page-rerender="true">重置</button><span class="self-center text-xs text-slate-500">时间仅筛选流水，库存展示当前结存</span></div></section>`
}

function renderWaitProcessRows(view: DyeingWarehouseView): string[][] {
  return view.waitProcessItems
    .map((item) => [
      `${formatFactoryCell(item.factoryName, item.factoryId)}`,
      `${escapeHtml(item.warehouseName)}`,
      `${escapeHtml(item.sourceRecordNo)}`,
      `${escapeHtml(item.taskNo || '—')}`,
      `${escapeHtml(item.itemKind)}`,
      `${materialCell(item)}`,
      `${escapeHtml(item.fabricColor || '—')}`,
      `${escapeHtml(item.sizeCode || '物料无成衣尺码')}`,
      `${escapeHtml(item.fabricRollNo || (item.itemKind==='面料'?'按接收批次汇总':'按重量接收，无卷号'))}`,
      `${formatQty(item.receivedQty, item.unit)}`,
      `${formatQty(item.availableQty, item.unit)}`,
      `${formatQty(item.issuedQty ?? 0, item.unit)}`,
      `${escapeHtml(item.areaName)} / ${escapeHtml(item.shelfNo)} / ${escapeHtml(item.locationNo)}`,
      `${renderBadge(item.status, item.status.includes('差异') ? 'danger' : 'warning')}`,
      `
            <div class="flex flex-wrap gap-2">
              <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${view.dyeOrderIds.includes(item.sourceRecordId)?buildDyeingWorkOrderDetailLink(item.sourceRecordId):'/fcs/craft/dyeing/pending-receipts?sourceId='+encodeURIComponent(item.sourceRecordId)}">${view.dyeOrderIds.includes(item.sourceRecordId)?'查看染色加工单':'查看接收来源'}</button>
              ${renderWarehouseFlowButton(`${item.sourceRecordNo} 库存流水`, buildWaitProcessFlowLines(item))}
              <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${item.taskId ? buildTaskDetailLink(item.taskId) : ''}" ${item.taskId ? '' : 'disabled'}>打开移动端执行页</button>
            </div>
          `
    ])
}

function renderWaitHandoverRows(view: DyeingWarehouseView): string[][] {
  return view.waitHandoverItems
    .map((item) => [
      `${formatFactoryCell(item.factoryName, item.factoryId)}`,
      `${escapeHtml(item.warehouseName)}`,
      `${escapeHtml(item.taskNo || '—')}`,
      `${escapeHtml(item.itemKind)}`,
      `${materialCell(item)}`,
      `${escapeHtml(item.fabricColor || '—')}`,
      `${escapeHtml(item.fabricRollNo || (item.itemKind==='面料'?'按接收批次汇总':'按重量接收，无卷号'))}`,
      `${formatQty(item.completedQty, item.unit)}`,
      `${formatQty(item.lossQty, item.unit)}`,
      `${formatQty(item.waitHandoverQty, item.unit)}`,
      `${escapeHtml(item.receiverName)}`,
      `${escapeHtml(item.handoverOrderNo || '—')}`,
      `${escapeHtml(item.handoverRecordNo || '—')}`,
      `${item.receiverWrittenQty === undefined ? '待登记实收' : formatQty(item.receiverWrittenQty, item.unit)}`,
      `${renderBadge(item.status, item.status.includes('差异') || item.status.includes('异议') ? 'danger' : 'warning')}`,
      `
            <div class="flex flex-wrap gap-2">
              <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${item.handoverOrderId ? buildHandoverOrderLink(item.handoverOrderId) : ''}" ${item.handoverOrderId ? '' : 'disabled'}>打开移动端交出页</button>
              ${renderWarehouseFlowButton(`${item.taskNo || item.stockItemId} 库存流水`, buildWaitHandoverFlowLines(item))}
            </div>
          `
    ])
}

function renderInboundRows(view: DyeingWarehouseView): string[][] {
  return view.inboundRecords
    .map((item) => [
      `${escapeHtml(item.inboundRecordNo)}`,
      `${formatFactoryCell(item.factoryName, item.factoryId)}`,
      `${escapeHtml(item.warehouseName)}`,
      `${escapeHtml(item.sourceRecordNo)}`,
      `${escapeHtml(item.taskNo || '—')}`,
      `${materialCell(item)}`,
      `${formatQty(item.expectedQty, item.unit)}`,
      `${formatQty(item.receivedQty, item.unit)}`,
      `${item.differenceQty === undefined ? '待登记实收' : formatQty(item.differenceQty, item.unit)}`,
      `${escapeHtml(item.areaName)} / ${escapeHtml(item.shelfNo)} / ${escapeHtml(item.locationNo)}`,
      `${escapeHtml(item.receiverName)}`,
      `${escapeHtml(item.receivedAt)}`,
      `${renderBadge(item.status, item.status.includes('差异') ? 'danger' : 'success')}`,
      `<button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${view.dyeOrderIds.includes(item.sourceRecordId)?buildDyeingWorkOrderDetailLink(item.sourceRecordId):'/fcs/craft/dyeing/pending-receipts?sourceId='+encodeURIComponent(item.sourceRecordId)}">${view.dyeOrderIds.includes(item.sourceRecordId)?'查看染色加工单':'查看接收来源'}</button>`
    ])
}

function renderOutboundRows(view: DyeingWarehouseView): string[][] {
  return view.outboundRecords
    .map((item) => [
      `${escapeHtml(item.outboundRecordNo)}`,
      `${formatFactoryCell(item.factoryName, item.factoryId)}`,
      `${escapeHtml(item.warehouseName)}`,
      `${escapeHtml(item.sourceTaskNo || '—')}`,
      `${escapeHtml(item.handoverOrderNo || '—')}`,
      `${escapeHtml(item.handoverRecordNo || '—')}`,
      `${escapeHtml(item.receiverName)}`,
      `${materialCell(item)}`,
      `${formatQty(item.outboundQty, item.unit)}`,
      `${item.receiverWrittenQty === undefined ? '待登记实收' : formatQty(item.receiverWrittenQty, item.unit)}`,
      `${item.differenceQty === undefined ? '待登记实收' : formatQty(item.differenceQty, item.unit)}`,
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
          `
    ])
}

function renderNodeRows(view: DyeingWarehouseView): string[][] {
  return view.nodeRows
    .map((row) => [
      `${formatFactoryCell(row.factoryName, row.factoryId)}`,
      `${escapeHtml(row.warehouseName)}`,
      `${escapeHtml(row.areaName)}`,
      `${escapeHtml(row.shelfNo || '—')}`,
      `${escapeHtml(row.locationNo || '—')}`,
      `${renderBadge(row.status === 'AVAILABLE' ? '可用' : '停用', row.status === 'AVAILABLE' ? 'success' : 'warning')}`,
      `${escapeHtml(row.remark || '—')}`,
      `${renderWarehouseLocationActions('染色仓库库区库位', `${row.areaName}/${row.shelfNo || '—'}/${row.locationNo || '—'}`)}`
    ])
}

function renderUsageRows(view: DyeingWarehouseView): string[][] {
  return view.usageRecords
    .map((item) => [
      `${escapeHtml(item.taskNo || item.sourceRecordNo)}`,
      `${formatFactoryCell(item.factoryName, item.factoryId)}`,
      `${escapeHtml(item.itemKind)}`,
      `${materialCell(item)}`,
      `${formatQty(item.issuedQty, item.unit)}`,
      `${escapeHtml(item.sourceRecordNo)}`,
      `${escapeHtml(item.usedAt)}`,
      `${renderBadge(item.status === '差异待处理' ? '差异待处理' : '已领用', item.status === '差异待处理' ? 'danger' : 'success')}`
    ])
}

function renderProcessInboundRows(view: DyeingWarehouseView): string[][] {
  return view.waitHandoverItems
    .map((item) => [
      `${escapeHtml(item.stockItemId)}`,
      `${formatFactoryCell(item.factoryName, item.factoryId)}`,
      `${escapeHtml(item.taskNo || '—')}`,
      `${escapeHtml(item.itemKind)}`,
      `${materialCell(item)}`,
      `${formatQty(item.completedQty, item.unit)}`,
      `${formatQty(item.lossQty, item.unit)}`,
      `${escapeHtml(item.areaName)} / ${escapeHtml(item.shelfNo)} / ${escapeHtml(item.locationNo)}`,
      `${renderBadge(item.status, item.status.includes('差异') ? 'danger' : 'success')}`
    ])
}

function renderStocktakeRows(view: DyeingWarehouseView): string[][] {
  return view.stocktakeOrders
    .map((order) => [
      `${escapeHtml(order.stocktakeOrderNo)}`,
      `${formatFactoryCell(order.factoryName, order.factoryId)}`,
      `${escapeHtml(order.warehouseName)}`,
      `${escapeHtml(order.stocktakeScope)}`,
      `${escapeHtml(order.createdBy)}`,
      `${escapeHtml(order.createdAt)}`,
      `${String(order.lineList.length)}`,
      `${String(order.lineList.filter((line) => line.status === '差异').length)}`,
      `${renderBadge(order.status, order.status === '已完成' ? 'success' : 'warning')}`
    ])
}

function renderDyeingWarehousePage(mode: DyeingWarehouseMode): string {
  warehouseMode=mode
  const view = getDyeingWarehouseView(warehouseFilters)
  const inboundDifferenceCount = view.inboundRecords.filter((item) => item.status.includes('差异')).length
  const outboundDifferenceCount = view.outboundRecords.filter((item) => item.status.includes('差异') || item.status.includes('异议')).length
  const title = mode === 'wait-process' ? '染色待加工仓' : '染色待交出仓'
  const description =
    mode === 'wait-process'
      ? '查看染色任务接收后的待加工库存、入库记录与仓内位置。'
      : '查看染色任务完工后的待交出库存、出库记录与收货差异。'
  const metrics =
    mode === 'wait-process'
      ? [
          renderMetricCard('待加工仓记录数', String(view.waitProcessItems.length), '待加工仓记录'),
          renderMetricCard('接收记录', String(view.inboundRecords.length), '全部记录'),
          renderMetricCard('加工用料记录', String(view.usageRecords.length), '实际开工用料'),
          renderMetricCard('库区库位', String(view.nodeRows.length), '支持新增、编辑、删除'),
          renderMetricCard('接收差异记录数', String(inboundDifferenceCount), '接收差异'),
        ].join('')
      : [
          renderMetricCard('待交出仓记录数', String(view.waitHandoverItems.length), '待交出仓记录'),
          renderMetricCard('交出记录', String(view.outboundRecords.length), '全部记录'),
          renderMetricCard('加工入仓记录', String(view.waitHandoverItems.length), '按完工入仓'),
          renderMetricCard('已收货记录数', String(view.outboundRecords.filter((item) => item.receiverWrittenQty !== undefined).length), '接收方确认收货'),
          renderMetricCard('出库差异记录数', String(outboundDifferenceCount), '出库差异'),
        ].join('')

  const tabs: FactoryWarehouseStandardTab[] =
    mode === 'wait-process'
      ? [
          {
            key: 'inventory',
            label: '库存',
            count: view.waitProcessItems.length,
            content: renderTable(['工厂', '仓库', '来源单据', '所属任务', '类型', '原料面料 SKU', '颜色', '尺码', '卷号', '累计入库数量', '当前库存', '累计用料数量', '库位', '状态', '操作'], renderWaitProcessRows(view), 'min-w-[1680px]'),
          },
          {
            key: 'receipts',
            label: '接收记录',
            count: view.inboundRecords.length,
            content: renderTable(['接收单号', '工厂', '待加工仓', '来源单据', '所属任务', '原料面料 SKU', '本次实收数量', '确认入仓数量', '入库差异', '库位', '操作人', '操作时间', '状态', '操作'], renderInboundRows(view), 'min-w-[1680px]'),
          },
          {
            key: 'usage',
            label: '加工用料记录',
            count: view.usageRecords.length,
            content: renderTable(['所属任务', '工厂', '类型', '物料', '用料数量', '来源接收单', '用料时间', '状态'], renderUsageRows(view), 'min-w-[1120px]'),
          },
          {
            key: 'locations',
            label: '库区库位',
            count: view.nodeRows.length,
            content: `<div class="border-b px-4 py-3">${renderWarehouseLocationToolbar('染色待加工仓')}</div>${renderTable(['工厂', '仓库', '库区', '货架', '库位', '状态', '备注', '操作'], renderNodeRows(view), 'min-w-[1080px]')}`,
          },
        ]
      : [
          {
            key: 'inventory',
            label: '库存',
            count: view.waitHandoverItems.length,
            content: renderTable(['工厂', '仓库', '来源任务', '类型', '原料面料 SKU', '颜色', '卷号', '加工完成数量', '损耗数量', '当前库存', '接收方', '交出单', '交出记录', '收货确认数量', '状态', '操作'], renderWaitHandoverRows(view), 'min-w-[1740px]'),
          },
          {
            key: 'handouts',
            label: '交出记录',
            count: view.outboundRecords.length,
            content: renderTable(['交出记录号', '工厂', '待交出仓', '来源任务', '交出单', '交出记录', '接收方', '原料面料 SKU', '已交出数量', '收货确认数量', '差异数量', '操作人', '交出时间', '状态', '操作'], renderOutboundRows(view), 'min-w-[1720px]'),
          },
          {
            key: 'inbounds',
            label: '加工入仓记录',
            count: view.waitHandoverItems.length,
            content: renderTable(['入仓记录号', '工厂', '来源任务', '类型', '物料', '加工入仓数量', '损耗数量', '库位', '状态'], renderProcessInboundRows(view), 'min-w-[1280px]'),
          },
          {
            key: 'locations',
            label: '库区库位',
            count: view.nodeRows.length,
            content: `<div class="border-b px-4 py-3">${renderWarehouseLocationToolbar('染色待交出仓')}</div>${renderTable(['工厂', '仓库', '库区', '货架', '库位', '状态', '备注', '操作'], renderNodeRows(view), 'min-w-[1080px]')}`,
          },
        ]

  return `
    <div class="space-y-4 p-4" data-dye-wh-page>
      <header><h1 class="text-xl font-semibold">${title}</h1><p class="text-sm text-muted-foreground">${description}</p></header>
      ${renderFilters(view)}
      <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">${metrics}</section>
      ${renderFactoryWarehouseStandardTabs(tabs, mode === 'wait-process' ? 'dyeing-wait-process-tabs' : 'dyeing-wait-handover-tabs')}
    </div>
  `
}

export function renderCraftDyeingWaitProcessWarehousePage(): string {
  return renderDyeingWarehousePage('wait-process')
}

export function renderCraftDyeingWaitHandoverWarehousePage(): string {
  return renderDyeingWarehousePage('wait-handover')
}
