import { renderPrintingBusinessImage } from './work-orders.ts'
import { printingMaterialCode } from './relations.ts'
import { createPrintingDispatch, confirmPrintingDispatch, voidPrintingDispatch, listPrintingDispatchDocuments, listPrintingWorkOrders, isPrintablePrintingRoll, getPrintingWorkOrderById, type PrintingDispatchDocument } from '../../../data/fcs/printing-task-domain.ts'
import { escapeHtml as e } from '../../../utils.ts'
import { openPrintingDialog } from './dialogs.ts'

let mode: 'pending' | 'documents' = 'pending'
let keyword = '', factory = '', receiver = '', status = ''
let page = 1
let activeId = ''
let selected = new Set<string>()
const size = 15
const button = (label: string, action: string, id = '') => `<button class="rounded-md border px-3 py-2 text-sm hover:bg-slate-50" data-printing-dispatch="${action}" data-id="${e(id)}">${label}</button>`
const qty = (value: number) => value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
function orderRolls() {
  const reserved = new Set(listPrintingDispatchDocuments().filter(doc => doc.status !== '已作废').flatMap(doc => doc.lines.flatMap(line => line.barcodeIds.map(id => `${line.workOrderId}|${id}`))))
  return listPrintingWorkOrders().filter(order => order.output.completedQty > order.handover.handedOverQty).map(order => ({order, rolls:order.barcodes.filter(roll => !roll.handoverRecordId && roll.status !== '已交出' && roll.status !== '已入库' && !reserved.has(`${order.workOrderId}|${roll.id}`))}))
}
function matches(order: ReturnType<typeof listPrintingWorkOrders>[number]) {
  return (!factory || order.printFactoryName === factory) && (!receiver || order.receivingTargetName === receiver) && (!keyword || [order.printOrderNo,order.taskNo,order.product.spu,order.demandSource.sourceNo,order.output.sku].join(' ').toLowerCase().includes(keyword.toLowerCase()))
}
function documentLines(doc: PrintingDispatchDocument) {
  return doc.lines.flatMap(line => {
    const order = getPrintingWorkOrderById(line.workOrderId)
    return order ? (doc.status==='已作废' && line.rolls ? line.rolls : order.barcodes.filter(roll => line.barcodeIds.includes(roll.id))).map(roll => ({order, roll})) : []
  })
}
function totals(doc: PrintingDispatchDocument) {
  const lines = documentLines(doc)
  const units = new Map<string, number>()
  lines.forEach(({order,roll}) => units.set(order.output.qtyUnit,(units.get(order.output.qtyUnit)||0)+roll.lengthY))
  return `${lines.length} 卷 · ${[...units].map(([unit,total])=> `${qty(total)} ${e(unit)}`).join(' / ')} · ${new Set(lines.map(({roll})=>roll.sku)).size} 个 SKU`
}
function legacyDocs(): PrintingDispatchDocument[] {
  const represented = new Set(listPrintingDispatchDocuments().filter(doc=>doc.status!=='已作废').flatMap(doc=>doc.lines.flatMap(line=>line.barcodeIds.map(id=>`${line.workOrderId}|${id}`))))
  return listPrintingWorkOrders().flatMap(order=> {
    const rolls = order.barcodes.filter(roll=>roll.handoverRecordId && !represented.has(`${order.workOrderId}|${roll.id}`))
    return rolls.length ? [{id:order.handover.handoverNo || `历史-${order.printOrderNo}`,status:'已交出' as const,createdAt:order.handover.handedOverAt || '',createdBy:'历史记录',handedOverAt:order.handover.handedOverAt, lines:[{workOrderId:order.workOrderId,barcodeIds:rolls.map(roll=>roll.id)}]}] : []
  })
}
function allDocs() { return [...listPrintingDispatchDocuments(), ...legacyDocs()] }
function pager(total: number) {
  return `<div class="mt-3 flex items-center justify-between text-sm"><span>共 ${total} 条 · 每页 ${size} 条 · 第 ${page} / ${Math.max(1,Math.ceil(total/size))} 页</span><div>${page>1?button('上一页','prev'):''}${page*size<total?button('下一页','next'):''}</div></div>`
}
function detail(doc: PrintingDispatchDocument): string {
  const lines = documentLines(doc)
  return `<div data-dispatch-print-body><h2 class="text-lg font-semibold">印花交出单 ${e(doc.id)}</h2><p class="my-2 text-sm">${e(doc.status)} · ${totals(doc)}</p><p class="text-sm">建单：${e(doc.createdBy)} ${e(doc.createdAt || '历史时间未记录')} · 交出：${e(doc.handedOverBy || '未记录')} ${e(doc.handedOverAt || '尚未交出')}</p><p class="my-2 text-sm">加工厂：${e(lines[0]?.order.printFactoryName || '')} · 接收方：${e(lines[0]?.order.receivingTargetName || '')} · 接收仓：${e(lines[0]?.order.receivingTargetWarehouseName || '')}</p><div class="overflow-auto"><table class="w-full text-left text-sm"><thead><tr>${['加工单 / 商品','任务单','产出 SKU','卷号 / 条码','数量','重量(KG)','当前卷状态'].map(label=>`<th class="border p-2">${label}</th>`).join('')}</tr></thead><tbody>${lines.map(({order,roll})=>`<tr><td class="border p-2">${e(order.printOrderNo)}<div class="mt-1 flex items-center gap-2">${renderPrintingBusinessImage(order.product,'h-10 w-10')}${e(order.product.spu)}</div></td><td class="border p-2">${e(order.taskNo)}</td><td class="border p-2">${e(printingMaterialCode(roll.sku,true))}<br><span class="text-amber-700">产出实物图待补齐</span></td><td class="border p-2">${e(roll.rollNo)}<br>${e(roll.barcode)}</td><td class="border p-2">${qty(roll.lengthY)} ${e(order.output.qtyUnit)}</td><td class="border p-2">${roll.weightKg.toFixed(3)}</td><td class="border p-2">${e(roll.status)}</td></tr>`).join('')}</tbody></table></div><p class="my-3 text-sm">交出人签字：____________　接收人签字：____________　接收日期：____________</p>${doc.status==='草稿'?'<p class="text-amber-700">草稿仅供核对，尚未交出。</p>':''}</div><div class="mt-4 flex gap-2">${button('返回单据列表','back')}${button('打印','print',doc.id)}${doc.status==='草稿'?button('确认交出','confirm',doc.id)+button('作废草稿','void',doc.id):''}</div>`
}
function renderBody(): string {
  if (activeId) { const doc=allDocs().find(item=>item.id===activeId); if(doc) return detail(doc) }
  const orders=listPrintingWorkOrders()
  const select=(name:string,label:string,value:string,options:string[])=>`<label class="text-xs text-slate-500">${label}<select class="mt-1 block h-9 rounded border px-2 text-sm text-slate-900" data-dispatch-filter="${name}"><option value="">全部</option>${options.map(option=>`<option ${value===option?'selected':''}>${e(option)}</option>`).join('')}</select></label>`
  const filters=`<div class="mb-4 flex flex-wrap items-end gap-3"><label class="text-xs text-slate-500">关键词<input class="mt-1 block h-9 rounded border px-3 text-sm text-slate-900" placeholder="交出单 / 加工单 / 任务 / SKU" data-dispatch-filter="keyword" value="${e(keyword)}"></label>${select('factory','加工厂',factory,[...new Set(orders.map(o=>o.printFactoryName))].filter(Boolean))}${select('receiver','接收方',receiver,[...new Set(orders.map(o=>o.receivingTargetName))].filter(Boolean))}${select('status',mode==='pending'?'可创建':'单据状态',status,mode==='pending'?['可创建','卷码待维护']:['草稿','已交出','已作废'])}${button('查询','search')}${button('重置','reset')}</div>`
  if(mode==='pending') {
    const rows=orderRolls().filter(({order,rolls})=>matches(order) && (status!=='可创建'||rolls.some(roll=>isPrintablePrintingRoll(order,roll))) && (status!=='卷码待维护'||!rolls.some(roll=>isPrintablePrintingRoll(order,roll))))
    page=Math.min(page,Math.max(1,Math.ceil(rows.length/size)))
    return filters+`<div class="mb-3 flex flex-wrap items-center gap-2">${button('全选本页可交卷','select-page')}${button('清空选择','clear')}<span data-dispatch-selected>已选 ${selected.size} 卷</span>${button('批量生成交出单','create')}<select aria-label="合入已有交出单" data-dispatch-merge class="h-9 rounded border text-sm"><option value="">选择已有草稿</option>${listPrintingDispatchDocuments().filter(doc=>doc.status==='草稿').map(doc=>`<option value="${e(doc.id)}">${e(doc.id)}</option>`).join('')}</select>${button('合入已有交出单','merge')}</div><div class="overflow-auto"><table class="w-full text-left text-sm"><thead class="bg-slate-50"><tr>${['加工单 / 商品','任务 / 接收方','使用 / 完成','选择产出卷','操作'].map(label=>`<th class="p-3">${label}</th>`).join('')}</tr></thead><tbody>${rows.slice((page-1)*size,page*size).map(({order,rolls})=>`<tr class="border-t align-top"><td class="p-3">${e(order.printOrderNo)}<div class="mt-1 flex items-center gap-2">${renderPrintingBusinessImage(order.product,'h-10 w-10')}${e(order.product.spu)}</div></td><td class="p-3">${e(order.taskNo)}<br>${e(order.printFactoryName)} → ${e(order.receivingTargetName)}</td><td class="p-3">${qty(order.actualInput.usedQty)} ${e(order.plannedInput.qtyUnit)} / ${qty(order.output.completedQty)} ${e(order.output.qtyUnit)}</td><td class="p-3">${rolls.map(roll=>`<label class="mb-1 block"><input type="checkbox" data-dispatch-roll value="${e(order.workOrderId+'|'+roll.id)}" ${selected.has(order.workOrderId+'|'+roll.id)?'checked':''} ${isPrintablePrintingRoll(order,roll)?'':'disabled'}> ${e(roll.rollNo)} · ${qty(roll.lengthY)} ${e(order.output.qtyUnit)} ${isPrintablePrintingRoll(order,roll)?'':'（卷码待维护）'}</label>`).join('')||'<span class="text-amber-700">无可建单卷；检查已有单据或维护卷码</span>'}</td><td class="p-3">${button('维护条码','barcodes',order.workOrderId)}</td></tr>`).join('')||'<tr><td class="p-4" colspan="5">暂无符合条件的待交出记录</td></tr>'}</tbody></table></div>`+pager(rows.length)
  }
  const docs=allDocs().filter(doc=>(!status||doc.status===status) && (!keyword||doc.id.toLowerCase().includes(keyword.toLowerCase())||doc.lines.some(line=>{const order=getPrintingWorkOrderById(line.workOrderId);return order&&matches(order)})) && doc.lines.some(line=>{const order=getPrintingWorkOrderById(line.workOrderId);return order&&(!factory||order.printFactoryName===factory)&&(!receiver||order.receivingTargetName===receiver)}))
  page=Math.min(page,Math.max(1,Math.ceil(docs.length/size)))
  return filters+`<div class="overflow-auto"><table class="w-full text-left text-sm"><thead class="bg-slate-50"><tr>${['交出单编号','加工单 / 接收方','总卷数 / 数量 / SKU','交出时间','状态','操作'].map(label=>`<th class="p-3">${label}</th>`).join('')}</tr></thead><tbody>${docs.slice((page-1)*size,page*size).map(doc=>`<tr class="border-t"><td class="p-3">${e(doc.id)}</td><td class="p-3">${doc.lines.map(line=>e(getPrintingWorkOrderById(line.workOrderId)?.printOrderNo||line.workOrderId)).join('、')}<br>${e(getPrintingWorkOrderById(doc.lines[0].workOrderId)?.receivingTargetName||'')}</td><td class="p-3">${totals(doc)}</td><td class="p-3">${e(doc.handedOverAt||'尚未交出')}</td><td class="p-3">${e(doc.status)}</td><td class="p-3">${button('详情','detail',doc.id)}${button('打印','print',doc.id)}</td></tr>`).join('')||'<tr><td colspan="6" class="p-4">暂无符合条件的交出单据</td></tr>'}</tbody></table></div>`+pager(docs.length)
}
function refresh() {
  const surface=document.querySelector('[data-printing-dispatch-body]')
  if(surface)surface.innerHTML=renderBody()
}
export function openPrintingDispatch(next:'pending'|'documents') {
  document.querySelector('[data-printing-dispatch-root]')?.remove()
  mode=next; keyword='';factory='';receiver='';status='';page=1;activeId='';selected.clear()
  const root=document.createElement('div')
  root.dataset.printingDispatchRoot='true';root.dataset.skipPageRerender='true'
  root.className='fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4'
  root.innerHTML=`<section role="dialog" aria-modal="true" aria-label="印花交出管理" class="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"><header class="flex flex-wrap justify-between gap-2 border-b p-4"><div class="flex gap-2">${button('待交出列表','pending')}${button('交出单据','documents')}</div>${button('关闭','close')}</header><div role="alert" class="px-4 text-sm text-red-700" data-dispatch-error></div><main class="overflow-auto p-4" data-printing-dispatch-body>${renderBody()}</main></section>`
  root.tabIndex=-1
  root.addEventListener('click',event=>{if(event.target===root)root.remove()})
  root.addEventListener('keydown',event=>{if(event.key==='Escape')root.remove()})
  const host=document.querySelector('[data-printing-work-orders-root]') || document.querySelector('#app')
  host?.appendChild(root)
  root.focus()
}
function printDoc(doc:PrintingDispatchDocument) {
  document.querySelector('[data-dispatch-print-frame]')?.remove()
  const frame=document.createElement('iframe');frame.dataset.dispatchPrintFrame='true';frame.title='交出单打印';frame.className='fixed left-0 top-0 h-0 w-0 border-0'
  const content=detail(doc).split('<div class="mt-4 flex gap-2">')[0]
  frame.srcdoc=`<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>${e(doc.id)}</title><style>@page{size:A4 landscape;margin:12mm}body{font:12px sans-serif}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:6px;text-align:left}thead{display:table-header-group}tr{break-inside:avoid}img{width:40px;height:40px;object-fit:contain}button{border:0;background:white}</style></head><body>${content}</body></html>`
  frame.onload=()=>frame.contentWindow?.print()
  document.body.appendChild(frame)
}
export function handlePrintingDispatchEvent(target:HTMLElement):boolean {
  if(target.matches('[data-dispatch-roll]')) {const input=target as HTMLInputElement;input.checked?selected.add(input.value):selected.delete(input.value);const count=document.querySelector('[data-dispatch-selected]');if(count)count.textContent=`已选 ${selected.size} 卷`;return true}
  if(target.matches('[data-dispatch-filter], [data-dispatch-merge]'))return true
  const node=target.closest<HTMLElement>('[data-printing-dispatch]');if(!node)return false
  const action=node.dataset.printingDispatch,id=node.dataset.id||''
  try {
    if(action==='close'){document.querySelector('[data-printing-dispatch-root]')?.remove();return true}
    if(action==='pending'||action==='documents'){mode=action;page=1;status='';activeId=''}
    else if(action==='search'){const value=(name:string)=>(document.querySelector(`[data-dispatch-filter="${name}"]`) as HTMLInputElement)?.value||'';keyword=value('keyword');factory=value('factory');receiver=value('receiver');status=value('status');page=1;selected.clear()}
    else if(action==='reset'){keyword='';factory='';receiver='';status='';page=1;selected.clear()}
    else if(action==='next')page++
    else if(action==='prev')page--
    else if(action==='clear')selected.clear()
    else if(action==='select-page')document.querySelectorAll<HTMLInputElement>('[data-dispatch-roll]:not(:disabled)').forEach(input=>selected.add(input.value))
    else if(action==='barcodes'){openPrintingDialog({type:'barcodes',workOrderId:id});return true}
    else if(action==='create'||action==='merge'){
      const groups=new Map<string,string[]>();selected.forEach(value=>{const [workOrderId,rollId]=value.split('|');groups.set(workOrderId,[...(groups.get(workOrderId)||[]),rollId])})
      const mergeId=(document.querySelector('[data-dispatch-merge]') as HTMLSelectElement)?.value
      if(action==='merge'&&!mergeId)throw new Error('请选择要合入的草稿')
      activeId=createPrintingDispatch([...groups].map(([workOrderId,barcodeIds])=>({workOrderId,barcodeIds})),'印花交出员',action==='merge'?mergeId:undefined);selected.clear();mode='documents'
    }else if(action==='detail')activeId=id
    else if(action==='back')activeId=''
    else if(action==='confirm'){if(!window.confirm('确认所选产出卷已实物交出？确认后等待下游接收。'))return true;confirmPrintingDispatch(id,'印花交出员');}
    else if(action==='void'){if(!window.confirm('作废此草稿并释放所选卷？'))return true;voidPrintingDispatch(id,'印花交出员')}
    else if(action==='print'){const doc=allDocs().find(item=>item.id===id);if(doc)printDoc(doc);return true}
    const error=document.querySelector('[data-dispatch-error]');if(error)error.textContent=''
    refresh()
  }catch(error){const node=document.querySelector('[data-dispatch-error]');if(node)node.textContent=error instanceof Error?error.message:String(error)}
  return true
}
