// @page-pattern: list
import { openDyeBarcodeDialog, handleDyeBarcodeEvent } from './barcode-dialog.ts'
import { escapeHtml as e } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { DYE_FACTORY_TABS, dyePartnerFields } from '../../../data/fcs/dye-work-order-demo-details.ts'
import { listDyeWorkOrderOnlineRows, type DyeWorkOrderOnlineRow } from '../../../data/fcs/dye-work-order-online-view.ts'
import { getSourceActualReceipts } from '../../../data/fcs/factory-receiving.ts'
import { getDyeOutputRolls, listDyeDispatchDocuments, createDyeDispatchDocument, finishDyeDispatchDocument, getDyeDispatchAvailableQty, getDyeDispatchStatus, scanDyeDispatchRoll, saveDyeDispatchTransport, isDyeRollAvailable, type DyeDispatchDocument } from '../../../data/fcs/dyeing-task-domain.ts'
import { renderDyeDispatchPrint, dyeDispatchQuantities } from './dispatch-print.ts'

type Mode = 'pending' | 'documents'
type Item = { id: string; order?: DyeWorkOrderOnlineRow; doc?: DyeDispatchDocument }
const prefix = 'dye-output', sizes = [10, 15, 20, 50]
let mode: Mode = 'pending', keyword = '', factory = '', receiver = '', status = '', ready = '', dateFrom = '', dateTo = ''
let page = 1, showMore = false, showColumns = false, sort: StandardListSortState | null = null
let preferences: StandardListColumnPreferences = { order: [], visibleKeys: [], frozenKeys: [], pageSize: 15 }
let overlay: 'detail' | 'create' | 'join' | 'print' | '' = '', docId = '', feedback = '', lastMode: Mode | '' = ''
const selected = new Set<string>()
let rows: DyeWorkOrderOnlineRow[] = []
const btn = (label: string, action: string, id = '', primary = false, disabled = false) => (primary ? renderPrimaryButton : renderSecondaryButton)(label, {prefix, action}).replace('<button', `<button data-skip-page-rerender="true" data-id="${e(id)}" ${disabled ? 'disabled' : ''}`)
const field = (name: string, label: string, value = '', type = 'text', placeholder = '') => `<label class="block min-w-0 text-xs text-muted-foreground">${e(label)}<input class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground" data-dye-output-field="${name}" type="${type}" value="${e(value)}" placeholder="${e(placeholder)}"></label>`
const select = (name: string, label: string, value: string, options: string[]) => `<label class="block min-w-0 text-xs text-muted-foreground">${e(label)}<select class="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground" data-dye-output-field="${name}"><option value="">全部</option>${options.map(option => `<option value="${e(option)}" ${value===option?'selected':''}>${e(option)}</option>`).join('')}</select></label>`
const line = (label: string, value: string | number) => `<div class="leading-6"><span class="text-muted-foreground">${e(label)}：</span><span>${e(value)}</span></div>`
const badge = (label: string, good = false) => `<span class="inline-flex rounded-full border px-2 py-0.5 text-xs ${good?'border-emerald-200 bg-emerald-50 text-emerald-700':'border-amber-200 bg-amber-50 text-amber-800'}">${e(label)}</span>`
const link = (label: string, href: string) => `<a class="text-blue-600 hover:underline" href="${e(href)}">${e(label)}</a>`
const table = (headers: string[], values: string[][]) => `<div class="overflow-auto rounded border"><table class="w-full text-left text-xs"><thead><tr>${headers.map(h=>`<th class="whitespace-nowrap border-b bg-slate-50 p-3">${e(h)}</th>`).join('')}</tr></thead><tbody>${values.map(row=>`<tr>${row.map(cell=>`<td class="border-b p-3 align-top">${cell}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${headers.length}" class="p-6 text-center text-muted-foreground">暂无符合条件的记录</td></tr>`}</tbody></table></div>`
function objectImage(url: string, name: string, code: string): string {
  return `<div class="flex items-start gap-2"><button type="button" class="relative h-11 w-11 shrink-0 overflow-hidden rounded border bg-white" data-skip-page-rerender="true" data-pda-image-preview-url="${e(url)}" data-pda-image-preview-title="${e(name)}"><img class="h-full w-full object-contain" src="${e(url)}" alt="${e(name)}" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='加载失败';this.nextElementSibling.hidden=false"><span class="absolute inset-0 bg-white text-[10px]">加载中</span></button><div class="min-w-0 break-words"><div class="font-medium">${e(name)}</div><div class="mt-1 text-xs text-muted-foreground">${e(code)}</div></div></div>`
}
function info(id: string): DyeWorkOrderOnlineRow { const row = rows.find(row=>row.dyeOrderId===id); if (!row) throw new Error('原加工单不存在，请重新查询。'); return row }
function stateOf(row: DyeWorkOrderOnlineRow): string {
  const rolls = getDyeOutputRolls(row.dyeOrderId).filter(roll=>!roll.dispatchId)
  if (rolls.some(roll=>roll.qty<=0)) return '卷长未维护'
  if (rolls.some(roll=>!roll.printedAt)) return '条码未全部打印'
  if (rolls.some(roll=>isDyeRollAvailable(row.dyeOrderId,roll))) return '已维护并打印'
  return rolls.length ? '已加入交出单' : '已全部交出'
}
function allItems(): Item[] {
  return mode==='documents' ? listDyeDispatchDocuments().map(doc=>({id:doc.id,doc})) : rows.filter(row=>!row.isYarn && row.completedQty>0 && getDyeDispatchAvailableQty(row.dyeOrderId)>0).map(order=>({id:order.dyeOrderId,order}))
}
function filtered(): Item[] {
  return allItems().filter(item=>{
    if(item.order){const r=item.order, available=getDyeOutputRolls(r.dyeOrderId).some(roll=>isDyeRollAvailable(r.dyeOrderId,roll)); const inDoc=listDyeDispatchDocuments().some(doc=>doc.status==='草稿'&&doc.lines.some(l=>l.orderId===r.dyeOrderId));
      return (!factory||r.factoryId===factory)&&(!receiver||r.receiverName===receiver)&&(!status||(status==='已建单据'?inDoc:!inDoc))&&(!ready||(ready==='可创建'?available:!available))&&(!keyword||`${r.workOrderNo} ${r.taskNo} ${r.productCode} ${r.productionOrderNo} ${r.purchaseOrderNo} ${r.colorSku}`.toLowerCase().includes(keyword.toLowerCase()))&&(!dateFrom||r.orderedAt.slice(0,10)>=dateFrom)&&(!dateTo||r.orderedAt.slice(0,10)<=dateTo)
    }
    const d=item.doc!;return (!factory||d.lines[0]?.factoryId===factory)&&(!receiver||d.lines.some(l=>l.receiver===receiver))&&(!status||getDyeDispatchStatus(d)===status)&&(!keyword||`${d.id} ${d.lines.map(l=>`${l.orderNo} ${l.taskNo} ${l.sku}`).join(' ')}`.toLowerCase().includes(keyword.toLowerCase()))&&(!dateFrom||d.createdAt.slice(0,10)>=dateFrom)&&(!dateTo||d.createdAt.slice(0,10)<=dateTo)
  })
}
function filters(): string {
  return `<div class="rounded-lg border bg-card p-3"><div class="grid grid-cols-3 gap-3">${field('keyword',mode==='pending'?'加工单 / 任务单 / SPU / 生产单':'交出单 / 加工单 / 任务单',keyword,'text','输入编号或物料 SKU')}${select('receiver','接收方',receiver,[...new Set(rows.map(r=>r.receiverName))])}${select('status','单据状态',status,mode==='pending'?['待建单据','已建单据']:['待扫卷','部分扫卷','厂已扫卷待司机','已交出','已作废'])}</div><div class="mt-3 grid grid-cols-3 gap-3" data-dye-output-more ${showMore?'':'hidden'}>${mode==='pending'?select('ready','可创建',ready,['可创建','暂不可创建']):'<div class="text-xs text-muted-foreground self-center">以建单日期查询交出单据</div>'}${field('dateFrom','开始日期',dateFrom,'date')}${field('dateTo','结束日期',dateTo,'date')}</div><div class="mt-3 flex flex-wrap items-center gap-2">${btn('查询','query','',true)}${btn('重置','reset')}<button type="button" data-skip-page-rerender="true" data-dye-output-action="toggle-more" class="h-9 px-3 text-sm font-medium text-blue-600" aria-expanded="${showMore}">${showMore?'收起更多':'更多筛选'}</button></div></div>`
}
function columns(): StandardListColumn<Item>[] {
  if(mode==='pending')return [
    {key:'select',title:'选择',width:46,required:true,leadingControlColumn:true,renderHeader:visible=>`<input data-preserve-native-click="true" type="checkbox" aria-label="选择本页可交卷" data-dye-output-action="select-page" ${visible.some(i=>getDyeOutputRolls(i.id).some(r=>isDyeRollAvailable(i.id,r)))?'':'disabled'}>`,render:item=>`<input data-preserve-native-click="true" aria-label="选择 ${e(item.order!.workOrderNo)} 的可交卷" type="checkbox" data-dye-output-select-order="${e(item.id)}" ${getDyeOutputRolls(item.id).some(r=>isDyeRollAvailable(item.id,r))?'':'disabled'} ${getDyeOutputRolls(item.id).filter(r=>isDyeRollAvailable(item.id,r)).length>0&&getDyeOutputRolls(item.id).filter(r=>isDyeRollAvailable(item.id,r)).every(r=>selected.has(`${item.id}|${r.id}`))?'checked':''}>`},
    {key:'order',title:'加工单 / 商品',width:245,required:true,freezeable:true,sortable:true,sortValue:i=>i.order!.workOrderNo,render:i=>{const r=i.order!;return line('工厂',r.factoryName)+link(r.workOrderNo,`/fcs/craft/dyeing/work-orders?dyeOrderId=${encodeURIComponent(r.dyeOrderId)}`)+line('任务单',r.taskNo)+`<div class="mt-2 border-t pt-2">${objectImage(r.productImageUrl,r.productName,r.productCode)}</div>`}},
    {key:'source',title:'需求 / 生产单 / 接收方',width:240,freezeable:true,sortable:true,sortValue:i=>i.order!.receiverName,render:i=>{const r=i.order!;return line('需求单',r.purchaseOrderNo)+line('生产单',r.productionOrderNo||'备料，未关联生产单')+`<div class="mt-2 border-t pt-2">${r.downstreamPartner?dyePartnerFields(r.downstreamPartner).map(([a,b])=>line(a,b)).join(''):line('接收方',r.receiverName)}</div>`}},
    {key:'material',title:'产出物料',width:255,freezeable:true,render:i=>{const r=i.order!;return objectImage(r.outputImageUrl,r.materialName,r.colorSku)+`<div class="mt-2 text-xs">${line('类型',r.isYarn?'纱线':r.materialName.includes('花边')?'辅料':'面料')}${line('成分',r.composition)}${line('幅宽 / 克重',`${r.width} / ${r.weightGsm} g/m²`)}</div>`}},
    {key:'quantity',title:'数量',width:170,sortable:true,sortValue:i=>getDyeDispatchAvailableQty(i.id),render:i=>{const r=i.order!;return line('使用',`${r.rawMaterialQty.toFixed(2)} ${r.qtyUnit}`)+line('完成',`${r.completedQty.toFixed(2)} ${r.qtyUnit}`)+line('未交出',`${getDyeDispatchAvailableQty(i.id).toFixed(2)} ${r.qtyUnit}`)+line('产出卷数',`${getDyeOutputRolls(i.id).length} 卷`)}},
    {key:'rolls',title:'待交卷 / 条码状态',width:270,render:i=>{const r=i.order!,rolls=getDyeOutputRolls(i.id).filter(r=>!r.dispatchId);return badge(stateOf(r),stateOf(r)==='已维护并打印')+`<div class="mt-2 space-y-2">${rolls.map(roll=>`<label class="flex items-start gap-2 text-xs"><input data-preserve-native-click="true" type="checkbox" class="mt-1" aria-label="选择卷 ${e(roll.barcode)}" data-dye-output-select="${e(i.id+'|'+roll.id)}" ${selected.has(i.id+'|'+roll.id)?'checked':''} ${isDyeRollAvailable(i.id,roll)?'':'disabled'}><span>${e(roll.rollNo)} · ${roll.qty.toFixed(2)} ${e(r.qtyUnit)}<span class="block text-muted-foreground">${roll.qty<=0?'待维护卷长':!roll.printedAt?'待打印':isDyeRollAvailable(i.id,roll)?'可建单':'单据占用'}</span></span></label>`).join('')}</div>`}},
    {key:'actions',title:'操作',width:145,required:true,actionColumn:true,render:i=>`<div class="space-y-2">${btn('维护条码','barcodes',i.id)}${btn('合入已有单','join-row',i.id,false,!getDyeOutputRolls(i.id).some(r=>isDyeRollAvailable(i.id,r)))}</div>`},
  ]
  return [
    {key:'document',title:'交出单编号',width:260,required:true,freezeable:true,sortable:true,sortValue:i=>i.id,render:i=>`${btn(i.id,'detail',i.id)}<div class="mt-2">${line('工厂',i.doc!.lines[0].factoryName)}${line('建单人',i.doc!.operator)}</div>`},
    {key:'orders',title:'加工单 / 任务 / 接收方',width:290,freezeable:true,render:i=>i.doc!.lines.map(l=>`<div class="mb-2 border-b pb-2 last:border-0">${link(l.orderNo,`/fcs/craft/dyeing/work-orders?dyeOrderId=${encodeURIComponent(l.orderId)}`)}${line('任务',l.taskNo)}${line('接收方',l.receiver)}</div>`).join('')},
    {key:'quantity',title:'交出数量',width:210,sortable:true,sortValue:i=>dyeDispatchQuantities(i.doc!).rolls,render:i=>{const q=dyeDispatchQuantities(i.doc!);return line('总卷数',`${q.rolls} 卷`)+line('原单数量',q.text)+line('SKU 数量',q.skus)+line('长度换算',`${q.meters.toFixed(2)} 米`)}},
    {key:'time',title:'时间 / 运输',width:230,sortable:true,sortValue:i=>i.doc!.createdAt,render:i=>{const d=i.doc!;return line('建单',d.createdAt)+line('交出',d.handedOverAt||'尚未交出')+line('司机',d.transport.driver||'尚未登记')+line('车牌',d.transport.plate||'尚未登记')}},
    {key:'status',title:'状态 / 扫卷进度',width:160,sortable:true,sortValue:i=>getDyeDispatchStatus(i.doc!),render:i=>badge(getDyeDispatchStatus(i.doc!),i.doc!.status==='已交出')+`<div class="mt-2">${line('已扫码',`${i.doc!.scans.length} / ${dyeDispatchQuantities(i.doc!).rolls} 卷`)}</div>`},
    {key:'actions',title:'操作',width:160,required:true,actionColumn:true,render:i=>`<div class="space-y-2">${btn('详情','detail',i.id)}${btn('打印','print-doc',i.id)}${i.doc!.status==='草稿'?btn('扫码交出','detail',i.id,true):''}</div>`},
  ]
}
const preferenceKey = () => `higood-list:/fcs/craft/dyeing/${mode==='pending'?'pending-handover':'handover-documents'}`
function defaults(): StandardListColumnPreferences {const cols=columns();return {order:cols.map(c=>c.key),visibleKeys:cols.map(c=>c.key),frozenKeys:[mode==='pending'?'order':'document'],pageSize:15}}
function persist(){preferences=normalizeListColumnPreferences(columns(),preferences,sizes);saveListColumnPreferences(window.localStorage,preferenceKey(),preferences)}
function listBody(): string {
  const cols=columns(), items=sortStandardListRows(filtered(),sort,(item,key)=>cols.find(c=>c.key===key)?.sortValue?.(item)), paging=paginateStandardListRows(items,page,preferences.pageSize)
  page=paging.currentPage
  const tabs=`<nav aria-label="加工厂" class="flex overflow-x-auto border-b bg-slate-50 px-2 pt-2">${DYE_FACTORY_TABS.filter(t=>t.id!=='unassigned').map(t=>`<button type="button" data-dye-output-action="factory" data-id="${e(t.id)}" class="shrink-0 rounded-t-md border px-5 py-2 text-sm font-semibold ${factory===t.id?'border-b-white border-t-2 border-t-sky-500 bg-white text-sky-700':'mx-1 text-slate-500'}">${e(t.label)}</button>`).join('')}</nav>`
  return renderStandardListPage({title:mode==='pending'?'染色待交出列表':'染色交出单据',primaryActionsHtml:`<div class="flex gap-4 text-sm">${link(mode==='pending'?'交出单据':'待交出列表',`/fcs/craft/dyeing/${mode==='pending'?'handover-documents':'pending-handover'}`)}${link('纱线整单交出','/fcs/craft/dyeing/yarn-shipments')}</div>`,statusTabsHtml:tabs,filtersHtml:filters(),statsHtml:renderStandardListStats(mode==='pending'?[{label:'待交加工单',value:items.length},{label:'可建单加工单',value:items.filter(i=>getDyeOutputRolls(i.id).some(r=>isDyeRollAvailable(i.id,r))).length},{label:'已选卷数',value:selected.size}]:[{label:'交出单据',value:items.length},{label:'等待交出',value:items.filter(i=>i.doc!.status==='草稿').length},{label:'已交出',value:items.filter(i=>i.doc!.status==='已交出').length}],{compact:true}),listTitle:`共 ${items.length} 条${mode==='pending'?` · 已选 ${selected.size} 卷`:''}`,listActionsHtml:`<div class="flex flex-wrap gap-2">${mode==='pending'?btn('批量生成交出单','create','',true,!selected.size)+btn('合入已有交出单','join','',false,!selected.size):''}${btn('列设置','open-column-settings')}</div>`,tableHtml:renderStandardListTable({columns:cols,rows:paging.rows,preferences,sort,eventPrefix:prefix,skipPageRerender:true,emptyText:'暂无符合条件的记录'}),paginationHtml:renderTablePagination({total:paging.total,from:paging.from,to:paging.to,currentPage:paging.currentPage,totalPages:paging.totalPages,pageSize:paging.pageSize,actionPrefix:prefix,fieldPrefix:prefix,pageSizeOptions:sizes,skipPageRerender:true}),overlaysHtml:showColumns?renderStandardListColumnSettings({title:'列表列设置',columns:cols,preferences,eventPrefix:prefix,maxFrozenWidth:550,skipPageRerender:true}):''})
}
function detail(doc: DyeDispatchDocument): string {
  const q=dyeDispatchQuantities(doc)
  return `<div class="grid grid-cols-3 gap-3 rounded-lg border bg-slate-50 p-3 text-sm">${line('工厂 / 接收方',`${doc.lines[0].factoryName} → ${[...new Set(doc.lines.map(l=>l.receiver))].join(' / ')}`)}${line('总数',`${q.rolls} 卷 · ${q.text}`)}${line('扫卷进度',`${doc.scans.length} / ${q.rolls}`)}${line('状态',getDyeDispatchStatus(doc))}${line('建单',`${doc.operator} / ${doc.createdAt}`)}${line('交出',doc.handedOverAt||'尚未交出')}</div>
    ${doc.status==='草稿'?`<section class="my-4 rounded-lg border p-3"><h3 class="mb-3 font-semibold">扫码核对实物</h3><div class="grid grid-cols-[1fr_2fr_auto] items-end gap-3">${field('scanner','操作人',doc.operator)}${field('scan','卷码','','text','扫描卷码后按 Enter')}${btn('核对卷码','scan',doc.id,true)}</div></section>`:''}
    <div class="my-4">${table(['加工单 / 商品','任务 / 面料 SKU','卷码 / 缸号','数量','扫码核对'],doc.lines.flatMap(l=>l.rolls.map(r=>{const row=info(l.orderId),scan=doc.scans.find(s=>s.barcode===r.barcode);return [e(l.orderNo)+`<div class="mt-2">${objectImage(row.productImageUrl,row.productName,row.productCode)}</div>`,line('任务',l.taskNo)+objectImage(row.outputImageUrl,row.materialName,l.sku),`<span class="select-all break-all">${e(r.barcode)}</span>${line('缸号',r.vatNo||'未分缸')}`,`${r.qty.toFixed(2)} ${e(l.unit)}`,scan?badge('已扫码',true)+line('操作人',scan.operator)+line('时间',scan.at):badge('待扫码')]})))}</div>
    <section class="rounded-lg border p-3"><h3 class="mb-3 font-semibold">运输信息</h3>${doc.status==='草稿'?`<div class="grid grid-cols-3 gap-3">${field('driver','司机',doc.transport.driver)}${field('vehicle','车型',doc.transport.vehicle)}${field('plate','车牌',doc.transport.plate)}</div><div class="my-3">${field('note','送货备注',doc.transport.note)}</div>${btn('保存运输信息','save-transport',doc.id)}`:`<div class="grid grid-cols-3 gap-3">${line('司机',doc.transport.driver)}${line('车型',doc.transport.vehicle)}${line('车牌',doc.transport.plate)}</div>${line('备注',doc.transport.note||'无特殊交接要求')}`}</section>
    ${doc.status==='已交出'?`<section class="mt-4 rounded-lg border p-3"><h3 class="mb-2 font-semibold">下游实际接收</h3>${doc.lines.map(l=>{const row=info(l.orderId),actual=l.receivingSourceId?getSourceActualReceipts(l.receivingSourceId):[];const records=row.handoverRecords.filter(r=>(r.handoverRecordId||r.recordId)===l.handoverRecordId);const qty=actual.length?actual.reduce((n,r)=>n+r.qty,0):records.reduce((n,r)=>n+(r.receiverWrittenQty||0),0);return `<div class="mb-2">${e(l.orderNo)} → ${e(l.receiver)} · 实收 ${qty.toFixed(2)} ${e(actual.length?actual[0].unit:l.unit)} ${l.receivingSourceId?link('查看待接收单',`/fcs/craft/dyeing/pending-receipts?sourceId=${encodeURIComponent(l.receivingSourceId)}`):link('查看原交接记录',`/fcs/craft/dyeing/work-orders?dyeOrderId=${encodeURIComponent(l.orderId)}`)}</div>`}).join('')}</section>`:''}
    <div class="mt-4 flex flex-wrap gap-2">${btn('打印预览','print-doc',doc.id)}${doc.status==='草稿'?btn('确认实物交出','confirm',doc.id,true,getDyeDispatchStatus(doc)!=='厂已扫卷待司机')+btn('作废单据','void',doc.id):''}${btn('关闭','close-overlay')}</div>`
}
function selections(){const map=new Map<string,string[]>();selected.forEach(key=>{const [id,roll]=key.split('|');map.set(id,[...(map.get(id)||[]),roll])});return [...map].map(([orderId,rollIds])=>({orderId,rollIds}))}
function selectedSummary(){return table(['加工单','工厂','所选卷数','本次数量'],selections().map(s=>{const r=info(s.orderId);return [e(r.workOrderNo),e(r.factoryName),String(s.rollIds.length),`${getDyeOutputRolls(s.orderId).filter(r=>s.rollIds.includes(r.id)).reduce((n,r)=>n+r.qty,0).toFixed(2)} ${e(r.qtyUnit)}`]}))}
function overlayBody(): string {
  if(overlay==='create'||overlay==='join'){
    const selectedFactory=selections()[0]?info(selections()[0].orderId).factoryId:''
    const docs=listDyeDispatchDocuments().filter(d=>d.status==='草稿'&&d.lines[0]?.factoryId===selectedFactory)
    return `<p class="mb-3 text-sm text-muted-foreground">按所选实物卷建单，同一加工厂可包含多张加工单和多个 SKU。</p>${selectedSummary()}<div class="my-3">${field('operator','建单操作人','hilon')}</div>${overlay==='join'?`<label class="mb-3 block text-sm">选择尚未交出的单据<select class="mt-2 h-9 w-full rounded border px-2" data-dye-output-field="merge"><option value="">请选择交出单</option>${docs.map(d=>`<option value="${e(d.id)}">${e(d.id)} · ${e(getDyeDispatchStatus(d))} · ${dyeDispatchQuantities(d).rolls} 卷</option>`).join('')}</select></label>${docs.length?'':'<p class="my-3 text-amber-700">当前工厂没有可合入的单据，请返回新建交出单。</p>'}`:''}${btn(overlay==='join'?'确认合入':'生成交出单','save-document','',true)}${btn('取消','close-overlay')}`
  }
  const doc=listDyeDispatchDocuments().find(d=>d.id===docId);if(!doc)return '单据不存在'
  return overlay==='print'?`${btn('打印','print-frame','',true)}${btn('返回详情','detail',docId)}<iframe class="mt-3 h-[65vh] w-full rounded border bg-slate-200" title="染色交出单打印预览" data-dye-output-print></iframe>`:detail(doc)
}
function refreshOverlay(){
  const host=document.querySelector('[data-dye-output-overlays]');if(!host)return
  host.innerHTML=overlay?`<div class="fixed inset-0 z-[105] flex items-center justify-center bg-black/40 p-4" data-dye-output-shade><section role="dialog" aria-modal="true" aria-label="${overlay==='detail'?'交出单详情':overlay==='print'?'交出单打印预览':overlay==='join'?'合入已有交出单':'生成交出单'}" class="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"><header class="flex items-center justify-between border-b p-3"><h2 class="font-semibold">${overlay==='create'?'生成交出单':overlay==='join'?'合入已有交出单':e(docId)}</h2>${btn('关闭','close-overlay')}</header><p role="alert" data-dye-output-modal-feedback class="px-4 text-sm text-blue-700"></p><div class="overflow-auto p-4">${overlayBody()}</div></section></div>`:''
  hydrateIcons(host as HTMLElement)
  if(overlay==='print'){const frame=host.querySelector<HTMLIFrameElement>('iframe')!;frame.srcdoc=renderDyeDispatchPrint(listDyeDispatchDocuments().find(d=>d.id===docId)!,rows)}
  host.querySelector<HTMLInputElement>('[data-dye-output-field="scan"]')?.focus()
}
function refreshList(){rows=listDyeWorkOrderOnlineRows();const root=document.querySelector('[data-dye-output-list]');if(root){root.innerHTML=listBody();hydrateIcons(root as HTMLElement)}syncSelection()}
function syncSelection(){const root=document.querySelector('[data-dye-output-list]');if(!root)return;root.querySelectorAll<HTMLInputElement>('[data-dye-output-select]').forEach(el=>el.checked=selected.has(el.dataset.dyeOutputSelect!));root.querySelectorAll<HTMLInputElement>('[data-dye-output-select-order]').forEach(el=>{const rolls=getDyeOutputRolls(el.dataset.dyeOutputSelectOrder!).filter(r=>isDyeRollAvailable(el.dataset.dyeOutputSelectOrder!,r));const count=rolls.filter(r=>selected.has(`${el.dataset.dyeOutputSelectOrder}|${r.id}`)).length;el.checked=rolls.length>0&&count===rolls.length;el.indeterminate=count>0&&count<rolls.length});root.querySelectorAll<HTMLButtonElement>('[data-dye-output-action="create"],[data-dye-output-action="join"]').forEach(el=>el.disabled=!selected.size);const title=root.querySelector('[data-standard-list-table-section] > header h2');if(mode==='pending'&&title)title.textContent=`共 ${filtered().length} 条 · 已选 ${selected.size} 卷`;const head=root.querySelector<HTMLInputElement>('[data-dye-output-action="select-page"]');if(head){const checks=[...root.querySelectorAll<HTMLInputElement>('[data-dye-output-select]:not(:disabled)')];head.checked=checks.length>0&&checks.every(el=>el.checked);head.indeterminate=!head.checked&&checks.some(el=>el.checked)}const stats=root.querySelectorAll('[data-standard-list-stats] strong');if(mode==='pending'&&stats[2])stats[2].textContent=String(selected.size)}
function read(name:string){return (document.querySelector(`[data-dye-output-field="${name}"]`) as HTMLInputElement|null)?.value.trim()||''}
function message(value:string,error=false){feedback=value;const target=document.querySelector(overlay?'[data-dye-output-modal-feedback]':'[data-dye-output-feedback]');if(target){target.textContent=value;target.classList.toggle('text-red-700',error);target.classList.toggle('text-blue-700',!error)}}
function renderPage(next:Mode):string{
  mode=next;rows=listDyeWorkOrderOnlineRows();if(lastMode!==mode||typeof document==='undefined'||!document.querySelector('[data-dye-output-page]')){page=1;sort=null;overlay='';showColumns=false;selected.clear();keyword=receiver=status=ready=dateFrom=dateTo='';factory='';showMore=false}
  lastMode=mode;preferences=typeof window==='undefined'?defaults():loadListColumnPreferences(window.localStorage,preferenceKey(),columns(),defaults(),sizes)
  return `<div data-dye-output-page data-skip-page-rerender="true" class="min-w-0"><p role="alert" data-dye-output-feedback class="px-4 text-sm text-blue-700">${e(feedback)}</p><main data-dye-output-list class="min-w-0">${listBody()}</main><div data-dye-output-overlays></div></div>`
}
export function renderCraftDyeingPendingHandoverPage(){return renderPage('pending')}
export function renderCraftDyeingHandoverDocumentsPage(){return renderPage('documents')}
export function openDyeOutput(next:'barcodes'|Mode,id='',snapshot?:DyeWorkOrderOnlineRow){if(next==='barcodes'){openDyeBarcodeDialog(id,snapshot);return}window.location.href=`/fcs/craft/dyeing/${next==='pending'?'pending-handover':'handover-documents'}`}
export function handleDyeOutputEvent(target:HTMLElement,event?:Event):boolean{
  if(target.closest('[data-dye-barcode-root]')){if(event&&event.type!=='click'&&!target.matches('input,select,textarea'))return true;const done=handleDyeBarcodeEvent(target);return done}
  if(!target.closest('[data-dye-output-page]'))return false
  const actionNode=target.closest<HTMLElement>('[data-dye-output-action]'),action=actionNode?.dataset.dyeOutputAction,id=actionNode?.dataset.id||''
  if(event&&event.type!=='click'&&actionNode&&!target.matches('input,select'))return true
  if(target.matches('[data-dye-output-select],[data-dye-output-select-order]')){if(event?.type==='click')return true;const input=target as HTMLInputElement;const keys=input.dataset.dyeOutputSelect?[input.dataset.dyeOutputSelect]:getDyeOutputRolls(input.dataset.dyeOutputSelectOrder!).filter(r=>isDyeRollAvailable(input.dataset.dyeOutputSelectOrder!,r)).map(r=>`${input.dataset.dyeOutputSelectOrder}|${r.id}`);keys.forEach(k=>input.checked?selected.add(k):selected.delete(k));syncSelection();return true}
  if(target.matches('[data-dye-output-field="pageSize"]')){if(event?.type==='click')return true;preferences.pageSize=Number((target as HTMLSelectElement).value);page=1;persist();refreshList();return true}
  if(!action)return Boolean(target.closest('[data-dye-output-field]'))
  if(event?.type==='change'&&action!=='toggle-column-visibility'&&action!=='toggle-column-freeze')return true
  if(!target.matches('input[type=checkbox]'))event?.preventDefault();message('')
  try{
    if(action==='toggle-more'){showMore=!showMore;document.querySelector<HTMLElement>('[data-dye-output-more]')!.hidden=!showMore;actionNode!.textContent=showMore?'收起更多':'更多筛选';actionNode!.setAttribute('aria-expanded',String(showMore));return true}
    if(action==='close-overlay'){overlay='';refreshOverlay();return true}
    if(action==='barcodes'){openDyeBarcodeDialog(id,info(id),refreshList);return true}
    if(action==='detail'||action==='print-doc'){docId=id;overlay=action==='detail'?'detail':'print';refreshOverlay();return true}
    if(action==='print-frame'){document.querySelector<HTMLIFrameElement>('[data-dye-output-print]')?.contentWindow?.print();return true}
    if(action==='create'||action==='join'||action==='join-row'){if(action==='join-row'){selected.clear();getDyeOutputRolls(id).filter(r=>isDyeRollAvailable(id,r)).forEach(r=>selected.add(`${id}|${r.id}`));syncSelection()}if(!selected.size)throw new Error('请先选择可交出的卷。');if(new Set(selections().map(s=>info(s.orderId).factoryId)).size!==1)throw new Error('不同加工厂请分别建单。');overlay=action==='create'?'create':'join';refreshOverlay();return true}
    if(action==='save-document'){const merge=read('merge');if(overlay==='join'&&!merge)throw new Error('请选择尚未交出的单据。');const doc=createDyeDispatchDocument(selections(),read('operator'),overlay==='join'?merge:undefined);docId=doc.id;selected.clear();overlay='detail';refreshList();refreshOverlay();message('单据已保存，可逐卷扫码核对。');return true}
    if(action==='scan'){const scanner=read('scanner');scanDyeDispatchRoll(id,read('scan'),scanner);refreshList();refreshOverlay();const input=document.querySelector<HTMLInputElement>('[data-dye-output-field="scanner"]');if(input)input.value=scanner;message('本卷核对成功。');return true}
    if(action==='save-transport'){saveDyeDispatchTransport(id,{driver:read('driver'),vehicle:read('vehicle'),plate:read('plate'),note:read('note')});refreshList();message('运输信息已保存。');return true}
    if(action==='confirm'||action==='void'){if(!window.confirm(action==='confirm'?'确认实物已按本单交给司机？下游将依据实际到货单独接收。':'确认作废此单并释放占用的卷？'))return true;finishDyeDispatchDocument(id,action);refreshList();refreshOverlay();message(action==='confirm'?'交出已保存，等待下游登记实收。':'单据已作废，所选卷已释放。');return true}
    if(action==='factory'){factory=id;page=1;selected.clear()}
    else if(action==='query'){keyword=read('keyword');receiver=read('receiver');status=read('status');ready=read('ready');dateFrom=read('dateFrom');dateTo=read('dateTo');if(dateFrom&&dateTo&&dateFrom>dateTo)throw new Error('开始日期不能晚于结束日期。');page=1;selected.clear()}
    else if(action==='reset'){keyword=receiver=status=ready=dateFrom=dateTo='';page=1;selected.clear()}
    else if(action==='prev-page'||action==='next-page')page=Math.max(1,page+(action==='next-page'?1:-1))
    else if(action==='select-page'){if(event?.type==='click')return true;const checked=(actionNode as HTMLInputElement).checked;const cols=columns(),items=paginateStandardListRows(sortStandardListRows(filtered(),sort,(i,k)=>cols.find(c=>c.key===k)?.sortValue?.(i)),page,preferences.pageSize).rows;items.forEach(i=>getDyeOutputRolls(i.id).filter(r=>isDyeRollAvailable(i.id,r)).forEach(r=>checked?selected.add(`${i.id}|${r.id}`):selected.delete(`${i.id}|${r.id}`)));syncSelection();return true}
    else if(action==='sort-column'){const key=actionNode!.dataset.columnKey!;sort=sort?.key===key?(sort.direction==='asc'?{key,direction:'desc'}:null):{key,direction:'asc'};page=1}
    else if(action==='open-column-settings')showColumns=true
    else if(action==='close-column-settings')showColumns=false
    else if(action==='restore-column-settings'){preferences=defaults();persist()}
    else if(action==='toggle-column-visibility'||action==='toggle-column-freeze'){if(event?.type==='change')return true;const key=actionNode!.dataset.dyeOutputColumnKey!,col=columns().find(c=>c.key===key);if(!col||col.actionColumn||(col.required&&action==='toggle-column-visibility'))return true;const prop=action==='toggle-column-freeze'?'frozenKeys':'visibleKeys';preferences[prop]=preferences[prop].includes(key)?preferences[prop].filter(k=>k!==key):[...preferences[prop],key];persist()}
    else if(action==='move-column-up'||action==='move-column-down'){const key=actionNode!.dataset.dyeOutputColumnKey!,a=preferences.order.indexOf(key),b=a+(action==='move-column-up'?-1:1);if(a>=0&&b>=0&&b<preferences.order.length){[preferences.order[a],preferences.order[b]]=[preferences.order[b],preferences.order[a]];persist()}}
    else return false
    refreshList()
  }catch(error){message(error instanceof Error?error.message:'操作未保存，请核对输入后重试。',true)}
  return true
}
if(typeof document!=='undefined'){
  document.addEventListener('keydown',event=>{if(!document.querySelector('[data-dye-output-page]')||(event.target as HTMLElement)?.closest('[data-pda-image-preview-root]'))return;if(event.key==='Escape'&&overlay&&!document.querySelector('[data-dye-barcode-root]')){overlay='';refreshOverlay()}if(event.key==='Enter'&&(event.target as HTMLElement)?.matches('[data-dye-output-field="scan"]')){event.preventDefault();document.querySelector<HTMLButtonElement>('[data-dye-output-action="scan"]')?.click()}})
  document.addEventListener('click',event=>{if((event.target as HTMLElement)?.matches('[data-dye-output-shade]')){overlay='';refreshOverlay()}})
  let dragging=''
  document.addEventListener('dragstart',event=>{const node=(event.target as HTMLElement)?.closest<HTMLElement>('[data-dye-output-column-key][draggable="true"]');if(node)dragging=node.dataset.dyeOutputColumnKey||''})
  document.addEventListener('dragover',event=>{if(dragging&&(event.target as HTMLElement)?.closest('[data-dye-output-column-key]'))event.preventDefault()})
  document.addEventListener('drop',event=>{const node=(event.target as HTMLElement)?.closest<HTMLElement>('[data-dye-output-column-key]'),to=node?.dataset.dyeOutputColumnKey;if(!dragging||!to||to==='actions')return;event.preventDefault();const next=preferences.order.filter(k=>k!==dragging),index=next.indexOf(to);if(index>=0){next.splice(index,0,dragging);preferences.order=next;persist();refreshList()}dragging=''})
}
