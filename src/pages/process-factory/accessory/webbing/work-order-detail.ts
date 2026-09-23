import { renderTmfWorkTimes, handleTmfWorkTimeEvent } from './work-times.ts'
import { appStore } from '../../../../state/store.ts'
import { buildUnifiedPrintPreviewLink } from '../../../../data/fcs/print-service.ts'
// @page-pattern: detail
import { renderTmfTippingForm, readTmfTippingForm } from './tipping-form.ts'
import { resolveProcessRouteLaneOrder } from '../../../../data/tech-pack-process-route.ts'
import { resolveTmfDyeOutputReference, resolveTmfPrintOutputReference, resolveTmfTipReference } from '../../../../data/fcs/tmf-reference-images.ts'
import { readTmfUpstreamProcessOrders } from '../../../../data/fcs/tmf-upstream-process-orders.ts'
import { escapeHtml as e } from '../../../../utils.ts'
import { renderDialog } from '../../../../components/ui/dialog.ts'
import { hydrateIcons } from '../../../../components/shell.ts'
import { getTmfWorkOrder, getTmfProcessingInputBalance } from '../../../../data/fcs/tmf-work-order-view.ts'
import { getTmfDefectiveBalance, scrapTmfDefectiveOutput, allocateTmfPrintHandover, receiveTmfPrintMaterial, allocateTmfDyeHandover, receiveTmfDyeMaterial, getTmfPurchaseState, reloadTmfPurchaseRuntime, receiveTmfMergedProcessingMaterial, reportTmfMergedCutOutput, receiveTmfProcessingMaterial, reportTmfCutOutput, packTmfOutput, dispatchTmfOutputPackage, receiveTmfTipMaterial, reportTmfTipping, dispatchTmfContinuousReturn, getTmfTipMaterialBalance, dispatchTmfTipMaterialReturn } from '../../../../data/pms/tmf-material-purchases.ts'

const prefix='tmf-work-detail',selector='[data-tmf-work-detail]'
const actor={id:'TMF-DEMO-SUPERVISOR',name:'织带厂主管（演示）',role:'织带厂主管' as const}
let scrapAvailable=0
let activeId='',tab='requirements',selected='',currentAction='',operationId='',tracePackageId=''
const root=()=>document.querySelector<HTMLElement>(selector)
const action=(name:string,label:string,id='')=>`<button type="button" class="rounded border px-3 py-2 text-xs ${['confirm','receive','cut'].includes(name)?'bg-blue-600 text-white':''}" data-${prefix}-action="${name}" data-id="${e(id)}" data-skip-page-rerender="true">${label}</button>`
const tip=(method:string)=>({NONE:'无端头',METAL:'金属头',PLASTIC_WRAP:'塑料包头',SILICONE_DIP:'硅胶浸头'}[method]??method)
function photo(){const order=getTmfWorkOrder(activeId);return order?.material?.materialImageUrl?`<button data-${prefix}-action="image" data-skip-page-rerender="true"><img class="h-14 w-14 rounded border object-cover" src="${e(order.material.materialImageUrl)}" alt="${e(order.material.materialName)}半成品参考图"></button>`:'<span class="text-amber-700">缺物料实图</span>'}
function body(){
 const order=getTmfWorkOrder(activeId);if(!order)return '<p>加工单不存在或来源需求已变化。</p>'
 const data=getTmfPurchaseState()
 if(tab==='times')return renderTmfWorkTimes(activeId)
 if(tab==='upstream')return '<div data-tmf-upstream-content class="space-y-3" role="status">正在核对当前印染加工单…</div>'
 if(tab==='requirements')return `<div class="space-y-3">${order.demands.map(d=>`<article class="border rounded bg-white p-4"><h3 class="font-medium">${e(d.specification.usage)} · ${e(d.garmentSize)} · ${e(d.garmentColor)}</h3><p>需求 ${d.requiredPieces} ${order.material?.accessoryType==='绳子'?'根':'条'}；理论下料 ${d.theoreticalCutMeters} 米</p><p>下料 ${d.specification.cutLengthMm}mm；成品 ${d.specification.finishedLengthMm}mm；公差 ±${d.specification.toleranceMm}mm</p><p>测量 ${e(d.specification.measurementCondition)}；${d.specification.lengthBasis==='INCLUDING_ENDS'?'长度含端头':'长度不含端头'}</p><p>A端 ${e(tip(d.specification.endA.method))} ${e(d.specification.endA.specification)}；B端 ${e(tip(d.specification.endB.method))} ${e(d.specification.endB.specification)}</p><p>截断：${e(d.specification.cuttingMethod)}；验收：${e(d.specification.acceptanceRequirement)}</p><p class="text-xs mt-2 break-all text-slate-500">BOM ${e(d.bomItemId)}；需求 ${e(d.id)}；采用快照 ${e(d.techPackSnapshotId)}</p><p class="text-xs">路线 ${resolveProcessRouteLaneOrder(d.routeSnapshot).entries.map(r=>e(r.processName)).join(' → ')}</p></article>`).join('')}</div>`
 if(tab==='merged'){
  const batches=[...new Set(order.inputs.map(i=>i.mergedBatchId).filter((id):id is string=>!!id))]
  return batches.map(id=>{const lines=mergedInputs(id);return `<article class="border rounded bg-white p-4"><h3 class="font-medium">合并批 ${e(id)}</h3><p class="text-sm mt-2">本批涉及 ${new Set(lines.map(i=>data.demands.find(d=>d.id===i.demandId)!.productionOrderId)).size} 张生产单，以下为整批数量，不能作为本单数量重复相加。</p>${lines.map(i=>{const d=data.demands.find(d=>d.id===i.demandId)!,balance=getTmfProcessingInputBalance(i.id);return `<div class="border-t mt-3 pt-2"><strong>${e(d.productionOrderNo)}</strong> · ${e(d.specification.usage)} / ${e(d.garmentSize)} · ${d.specification.cutLengthMm}mm<p class="text-sm">发出 ${i.dispatchedMeters} 米 / 实收 ${i.receivedMeters} 米 / 可加工 ${balance.remainingMeters} 米</p><p class="text-xs break-all">来源批次 ${e(i.lotId)}</p></div>`}).join('')}<div class="flex gap-2 mt-3">${lines.some(i=>i.receivedMeters<i.dispatchedMeters)?action('merged-receive','登记整批投入实收',id):''}${lines.some(i=>getTmfProcessingInputBalance(i.id).remainingMeters>0)?action('merged-cut','填报整批截断产出',id):''}</div></article>`}).join('')||'<p class="border rounded bg-white p-4">当前加工单没有合并批；请先由仓库完成同规格合并发料。</p>'
 }
 if(tab==='inputs')return order.inputs.length?`<div class="space-y-3">${order.inputs.map(i=>{const balance=getTmfProcessingInputBalance(i.id);const d=order.demands.find(d=>d.id===i.demandId)!;return `<article class="border rounded bg-white p-4"><h3 class="font-medium">${e(d.garmentSize)} · ${d.specification.cutLengthMm}mm · ${e(d.specification.usage)}</h3><p class="text-xs break-all">上游发料 ${e(i.id)}；批次 ${e(i.lotId)}</p><div class="flex gap-2 items-center mt-2">${photo()}<span>${e(i.materialSkuId)}</span></div><p class="mt-2">上游发出 ${i.dispatchedMeters} 米；本厂实收 ${i.receivedMeters} 米；未收 ${Math.round((i.dispatchedMeters-i.receivedMeters)*1000)/1000} 米</p><p>已转条料 ${balance.cutEquivalentMeters} 米；损耗 ${balance.lossMeters} 米；余料交回 ${balance.returnedMeters} 米；厂内可加工 ${balance.remainingMeters} 米</p><div class="flex gap-2 mt-3">${i.receivedMeters<i.dispatchedMeters?action('receive','确认投入实收',i.id):''}${balance.remainingMeters>0?action('cut','填报截断产出',i.id)+action('return','交回连续余料',i.id):''}</div></article>`}).join('')}</div>`:'<p class="rounded border bg-white p-5">尚无上游实际交出。请由辅料仓按需求占用并发料；采购在途不能直接加工。</p>'
 if(tab==='returns')return `<div class="space-y-3"><p class="text-sm">只接收未截断连续料，按米回原辅料仓；工厂交出不代表仓库已实收。</p>${data.continuousReturns.filter(r=>order.inputs.some(i=>i.id===r.sourceIssueId)).map(r=>`<article class="border rounded bg-white p-4"><h3 class="font-medium">退料 ${e(r.id)}</h3><p class="break-all text-xs">来源投入 ${e(r.sourceIssueId)}；回仓批次 ${e(r.batchId)}</p><p>${e(r.materialSkuId)} · ${e(r.warehouseId)}</p><p>交回 ${r.dispatchedMeters} 米；仓库实收 ${r.receivedMeters} 米；在途 ${Math.round((r.dispatchedMeters-r.receivedMeters)*1000)/1000} 米</p><p>${e(r.reason)}</p></article>`).join('')||'<p>尚无连续余料交回记录。请从投入明细选择实际剩余米料。</p>'}</div>`
 if(tab==='tipping'){
  const demands=new Set(order.demands.map(d=>d.id));const materials=data.tipMaterialIssues.filter(m=>demands.has(m.demandId))
  return `<div class="space-y-3"><h3 class="font-medium">端头辅材来料</h3>${materials.map(m=>`<article class="border rounded bg-white p-4"><p>${e(m.materialSkuId)} · 来源发料 ${e(m.sourceDocumentNo)}</p><p class="text-xs">${m.stockLotId?`来源实收批次 ${e(m.stockLotId)} · ${e(data.tipMaterialLots.find(l=>l.id===m.stockLotId)?.warehouseId??'来源仓缺失')}`:'历史发料缺来源批次，未补造库存'}</p><p class="text-xs">对应 ${e(order.demands.find(d=>d.id===m.demandId)!.garmentSize)} · ${e(m.materialBomItemId)}</p><p>交出 ${m.dispatchedQty}，实收 ${m.receivedQty}，已用 ${m.usedQty}，损坏 ${m.scrapQty} ${m.unit}</p><p>厂内可用 ${getTmfTipMaterialBalance(m.id).availableQty}；已交回 ${getTmfTipMaterialBalance(m.id).returnedQty}；仓库实收 ${getTmfTipMaterialBalance(m.id).returnReceivedQty} ${m.unit}</p>${m.stockLotId&&getTmfTipMaterialBalance(m.id).availableQty>0?action('return-tip','交回未用辅材',m.id):''}${(()=>{const d=data.demands.find(x=>x.id===m.demandId);const ref=d?[d.specification.endA,d.specification.endB].map(x=>resolveTmfTipReference(x.method)).find(Boolean)||'':'';return ref?`<figure class="mt-2 flex items-center gap-2"><img src="${e(ref)}" alt="端头参考图" class="h-14 w-14 rounded border object-cover" loading="lazy"><figcaption class="text-xs text-slate-500">端头参考图（厂商/公共来源）</figcaption></figure>`:''})()}${m.receivedQty<m.dispatchedQty?`<div class="mt-2">${action('receive-tip','登记辅材实收',m.id)}</div>`:''}</article>`).join('')||'<p class="text-sm">尚无辅材交出，不能虚构耗材余额。</p>'}<h3 class="font-medium">待打头条料及结果</h3>${order.outputs.filter(o=>o.specification.tippingRequired).map(o=>`<article class="border rounded bg-white p-4"><p>${e(o.specification.garmentSize)} · 下料 ${o.actualCutLengthMm}mm · 待打头 ${o.pendingTipPieces} ${o.unit}</p><p class="text-xs">要求 A：${e(tip(o.specification.endA.method))} ${e(o.specification.endA.specification)}；B：${e(tip(o.specification.endB.method))} ${e(o.specification.endB.specification)}</p>${o.pendingTipPieces>0?`<div class="mt-2">${action('tip','填报实际打头',o.id)}</div>`:''}${data.tipResults.filter(t=>t.cutOutputId===o.id).map(t=>`<p class="mt-3 text-sm">批次 ${e(t.id)}：实际成品 ${t.actualFinishedLengthMm}mm，A ${e(tip(t.endA.method))} / B ${e(tip(t.endB.method))}；合格 ${t.goodPieces}、不良 ${t.defectivePieces} ${o.unit}<span class="block text-xs">${e(t.reason)}</span></p>`).join('')}</article>`).join('')||'<p class="text-sm">暂无需打头的截断条料。</p>'}</div>`
 }
 if(tab==='outputs')return order.outputs.length?`<div class="space-y-3">${order.outputs.map(o=>`<article class="border rounded bg-white p-4"><h3 class="font-medium">${e(o.specification.garmentSize)} · 实际下料 ${o.actualCutLengthMm}mm</h3><p class="text-xs break-all">产出 ${e(o.id)}</p><p>截断 ${o.cutPieces} ${o.unit}；合格 ${o.goodPieces}；待打头 ${o.pendingTipPieces}；不良 ${o.defectivePieces}</p><p>下料当量 ${o.cutEquivalentMeters} 米；切割损耗 ${o.lossMeters} 米</p>${[undefined,...data.tipResults.filter(t=>t.cutOutputId===o.id).map(t=>t.id)].map(tipId=>{const b=getTmfDefectiveBalance(o.id,tipId);return b.defectivePieces?`<p class="text-sm mt-2">${tipId?'打头批次 '+e(tipId):'截断不良'}：已报废 ${b.scrappedPieces}，待处置 ${b.availablePieces} ${o.unit} ${b.availablePieces>0?action('scrap','核对不良报废',JSON.stringify([o.id,tipId??null])):''}</p>`:''}).join('')}${o.pendingTipPieces?'<p class="text-amber-700 text-sm">必需打头尚未完成，不能作为最终合格产出装包。</p>':''}<div class="mt-3">${o.goodPieces>0?action('pack','按合格产出装包',o.id):''}</div></article>`).join('')}</div>`:'<p class="rounded border bg-white p-5">尚未填报截断产出。</p>'
 if(tab==='packages'){
  const traced=data.packages.find(p=>p.id===tracePackageId&&order.demands.some(d=>d.id===p.demandId))
  const trace=tracePackageId?`<p class="border rounded p-3 ${!traced||traced.splitAt?'text-red-700':'text-blue-700'}" data-tmf-package-trace>${!traced?'所扫包不存在或不属于当前加工单。':traced.splitAt?`原包 ${e(traced.id)} 已拆分失效，请使用子包：${data.packages.filter(p=>p.parentPackageId===traced.id).map(p=>e(p.id)).join('、')}`:`当前扫码包 ${e(traced.id)}；请核对下方实际规格及当前收发记录。`}</p>`:''
  const past=order.handovers.filter(h=>data.packages.find(p=>p.id===h.packageId)?.splitAt).map(h=>`<article class="border rounded p-3 bg-slate-50"><h3>原包交出记录 · ${e(h.packageId)}</h3><p class="text-sm">原包已拆分，交出 ${h.dispatchedPieces} ${e(data.packages.find(p=>p.id===h.packageId)?.unit??'条/根')}、仓库实收 ${h.receivedPieces} ${e(data.packages.find(p=>p.id===h.packageId)?.unit??'条/根')}；不重复计入子包库存。</p><button class="border rounded px-3 py-2 text-sm" data-nav="${e(buildUnifiedPrintPreviewLink({documentType:'TMF_HANDOVER_SHEET',sourceType:'TMF_OUTPUT_HANDOVER',sourceId:h.id}))}">原包交出单打印预览</button></article>`).join('')
  return trace+past+(order.packages.length?`<div class="space-y-3"><div>${action('print-packages','打印所选包标签')}<span class="text-xs ml-2">一包一张；已生产发料的包仅供追溯，不重印整包标签。</span></div>${order.packages.map(p=>{
   const h=order.handovers.find(h=>h.packageId===p.id),issued=data.productionIssues.filter(i=>i.packageId===p.id),canLabel=!issued.length
   return `<article class="border rounded bg-white p-4" data-tmf-package-id="${e(p.id)}"><h3 class="font-medium break-all">${canLabel?`<input type="checkbox" aria-label="选择包 ${e(p.id)}" data-tmf-print-package="${e(p.id)}" data-skip-page-rerender="true"> `:''}包 ${e(p.id)}</h3><p>下料 ${p.actualCutLengthMm}mm；成品 ${p.actualFinishedLengthMm}mm；装包 ${p.pieces} ${p.unit}</p><p>A端 ${e(tip(p.endA.method))} ${e(p.endA.specification)}；B端 ${e(tip(p.endB.method))} ${e(p.endB.specification)}</p><p class="text-xs">包装时间 ${e(p.createdAt)}${p.parentPackageId?`；来源父包 ${e(p.parentPackageId)}`:''}</p>${h?`<p>已交出 ${h.dispatchedPieces}；辅料仓实收 ${h.receivedPieces} ${p.unit}</p><p class="text-xs break-all">交出单 ${e(h.id)}</p><button class="border rounded px-3 py-2 text-sm" data-nav="${e(buildUnifiedPrintPreviewLink({documentType:'TMF_HANDOVER_SHEET',sourceType:'TMF_OUTPUT_HANDOVER',sourceId:h.id}))}">交出单打印预览</button>`:p.warehouseId?`<p>仓库 ${e(p.warehouseId)} · ${e(p.location)}；拆包承接实收 ${p.receivedPieces??0} ${p.unit}</p>`:`<div class="mt-3">${action('dispatch','交回辅料仓',p.id)}</div>`}${issued.length?`<p>生产已发 ${issued.reduce((n,i)=>n+i.dispatchedPieces,0)}；生产实收 ${issued.reduce((n,i)=>n+i.receivedPieces,0)} ${p.unit}，请按实际去向核对。</p>`:''}</article>`
  }).join('')}</div>`:'<p class="rounded border bg-white p-5">尚未包装；不同实际规格分别装包。</p>')
 }

 const ids=new Set([activeId,...order.demands.map(d=>d.id),...order.inputs.map(i=>i.id),...order.inputs.map(i=>i.mergedBatchId).filter(Boolean),...order.outputs.map(o=>o.id),...order.packages.map(p=>p.id),...data.continuousReturns.filter(r=>order.inputs.some(i=>i.id===r.sourceIssueId)).map(r=>r.id),order.productionOrderId])
 return `<div class="border rounded bg-white p-4 space-y-3">${data.operations.filter(op=>ids.has(op.objectId)).map(op=>`<p class="text-sm">${e(op.occurredAt)} · ${e(op.action)}${order.inputs.some(i=>i.mergedBatchId===op.objectId)?'（整批，含其他生产单）':''} · ${e(op.actor.name)} · ${op.quantity??''} ${e(op.unit??'')}<span class="block text-xs break-all">${e(op.reason??'')}</span></p>`).join('')||'暂无加工操作记录。'}</div>`
}
let upstreamRequest=0
async function loadUpstream(){
 const request=++upstreamRequest,order=getTmfWorkOrder(activeId),surface=root()?.querySelector('[data-tmf-upstream-content]');if(!order||!surface)return
 try{
  const rows=await readTmfUpstreamProcessOrders(order.demands)
  const printing=await import('../../../../data/fcs/printing-task-domain.ts')
  if(request!==upstreamRequest||!surface.isConnected||tab!=='upstream')return
  const dye=rows.find(r=>order.demands[0].routeSnapshot.find(e=>e.id===r.entryId)?.processCode==='DYE')
  const print=rows.find(r=>order.demands[0].routeSnapshot.find(e=>e.id===r.entryId)?.processCode==='PRINT'&&order.demands[0].routeSnapshot.find(e=>e.id===r.entryId)?.predecessorEntryIds?.includes(dye?.entryId??''))
  const printToCut=rows.find(r=>r.matchedOrderId&&order.demands[0].routeSnapshot.find(e=>e.id===r.entryId)?.processCode==='PRINT'&&order.demands[0].routeSnapshot.find(e=>e.id===order.routeEntryId)?.predecessorEntryIds?.includes(r.entryId))
  const dyeToCut=rows.find(r=>r.matchedOrderId&&order.demands[0].routeSnapshot.find(e=>e.id===r.entryId)?.processCode==='DYE'&&order.demands[0].routeSnapshot.find(e=>e.id===order.routeEntryId)?.predecessorEntryIds?.includes(r.entryId))
  const continuation=(dye?.matchedOrderId&&print?.matchedOrderId?action('link-print','按路线确认染色→印花接收',JSON.stringify([dye.matchedOrderId,print.matchedOrderId])):'')+(printToCut?action('link-tmf','按路线确认印花→织带厂接收',JSON.stringify([printToCut.matchedOrderId,order.routeEntryId])):'')+(dyeToCut?action('link-dye-tmf','按路线确认染色→织带厂接收',JSON.stringify([dyeToCut.matchedOrderId,order.routeEntryId])):'')
  surface.innerHTML=rows.length?`<p class="text-sm">按采用版本、BOM和路线核对既有加工单。计划量不是实际产出；来源关联不代表已交出或本厂已收到。</p>${continuation}${rows.map(r=>`<article class="rounded border bg-white p-4"><h3 class="font-medium">${e(r.processName)} · ${e(r.state)}</h3><p class="text-sm break-all">${e(r.inputSku)} → ${e(r.outputSku)}</p><figure class="mt-2 flex items-center gap-2"><img src="${e(r.processName.includes('染')?resolveTmfDyeOutputReference(r.outputSku):resolveTmfPrintOutputReference(r.outputSku))}" alt="印染产出参考图" class="h-14 w-14 rounded border object-cover" loading="lazy"><figcaption class="text-xs text-slate-500">印染产出参考图（厂商/公共来源）；颜色与花型以技术包确认为准</figcaption></figure>${r.rows.map(o=>`<div class="mt-3 border-t pt-2"><p>${e(o.no)} · ${e(o.factoryName||'待分配工厂')} · 计划 ${o.plannedQty} ${e(o.unit)}</p><p class="text-amber-700 text-sm">${e(o.problems.join('；'))}</p>${o.downstreamFactoryName?`<p class="text-sm">后续接收：${e(o.downstreamFactoryName)}${o.downstreamEntryId?` · 截断节点 ${e(o.downstreamEntryId)}`:''}；实收另行核对</p>`:''}<button data-nav="${e(o.route)}" class="border rounded px-3 py-2 text-sm">查看${e(r.processName)}加工单</button></div>`).join('')||'<p class="mt-2 text-sm text-amber-700">未找到对应来源，请核对生产单的印染加工单生成结果。</p>'}</article>`).join('')}`:'<p class="border rounded bg-white p-4">本单采用路线无需染色或印花，可按截断要求备料。</p>'
  const data=getTmfPurchaseState()
  const dyeing=await import('../../../../data/fcs/dyeing-task-domain.ts')
  const returns=rows.flatMap(r=>r.rows).filter(o=>o.downstreamEntryId===order.routeEntryId).flatMap(o=>{
   const isDye=!!dyeToCut&&o.id===dyeToCut.matchedOrderId
   const records=isDye?dyeing.getDyeOrderHandoverRecords(o.id):printing.getPrintOrderHandoverRecords(o.id)
   return records.filter(h=>h.handoverRecordStatus!=='VOIDED'&&h.factorySubmittedAt&&(h.submittedQty??0)>0).map(h=>({orderId:o.id,no:o.no,h,id:h.handoverRecordId||h.recordId,kind:isDye?'DYE' as const:'PRINT' as const}))
  })
  surface.insertAdjacentHTML('beforeend',returns.map(r=>{const allocated=data.processingIssues.filter(i=>(r.kind==='DYE'?i.dyeHandover?.recordId:i.printHandover?.recordId)===r.id).reduce((n,i)=>n+i.dispatchedMeters,0);const available=Math.round(((r.h.submittedQty??0)-allocated)*1000)/1000;return `<article class="border rounded bg-white p-4 mt-3"><h3 class="font-medium">${r.kind==='DYE'?'染色':'印花'}实际交出 · ${e(r.id)}</h3><p>${e(r.no)} · ${e(r.h.skuCode||'')} · 交出 ${r.h.submittedQty??0} 米；已分配 ${allocated} 米；剩余可分配 ${available} 米</p><p>原单实收 ${r.h.receiverWrittenQty??r.h.warehouseWrittenQty??0} 米；按需求实收后才可截断。</p>${available>0?action(r.kind==='DYE'?'allocate-dye':'allocate-print','按需求分配投入',JSON.stringify([r.orderId,r.id])):''}</article>`}).join(''))
 }catch(error){if(request===upstreamRequest&&surface.isConnected)surface.textContent=error instanceof Error?error.message:'来源读取失败，请重新进入此页签核对。'}
}
function refresh(){const el=root();if(!el)return;const order=getTmfWorkOrder(activeId);el.querySelector('[data-tmf-detail-content]')!.innerHTML=body();if(tab==='upstream')void loadUpstream();el.querySelector('[data-tmf-detail-status]')!.textContent=order?`${order.receiptStatus} / ${order.processingStatus} / ${order.handoverStatus}`:''}
function close(){const el=root()?.querySelector('[data-tmf-detail-dialog]');if(el)el.innerHTML='';selected=currentAction=operationId=''}
function mergedInputs(batchId:string){
 const order=getTmfWorkOrder(activeId)
 if(!batchId||!order?.inputs.some(i=>i.mergedBatchId===batchId))throw new Error('合并批不属于当前加工单。')
 return getTmfPurchaseState().processingIssues.filter(i=>i.mergedBatchId===batchId)
}
function open(name:string,id:string){
 selected=id;currentAction=name;operationId=`tmf-work-ui:${crypto.randomUUID()}`
 const data=getTmfPurchaseState(),order=getTmfWorkOrder(activeId)!
 const input=(field:string,label:string,type='text',value='')=>`<label class="block text-sm mt-3">${label}<input name="${field}" type="${type}" value="${e(value)}" class="mt-1 w-full rounded border p-2" ${type==='number'?'step="any" min="0"':''}></label>`
 let content=`<div class="flex gap-2 items-center">${photo()}<span>${e(order.material?.materialName??order.demands[0].materialSkuId)}</span></div>`
 if(name==='scrap'){
  const [outputId,tipId]=JSON.parse(id),output=order.outputs.find(o=>o.id===outputId)
  if(!output)throw new Error('不良来源不属于当前加工单。')
  const balance=getTmfDefectiveBalance(outputId,tipId??undefined);scrapAvailable=balance.availablePieces
  const actual=tipId?data.tipResults.find(t=>t.id===tipId):undefined
  content+=`<p class="mt-3 break-all">来源 ${e(outputId)}${tipId?' / '+e(tipId):' / 截断不良'}</p><p>实际下料 ${output.actualCutLengthMm}mm；${actual?`A端 ${e(tip(actual.endA.method))} / B端 ${e(tip(actual.endB.method))}；`:''}待处置 ${balance.availablePieces} ${output.unit}。</p><p class="text-amber-700">实际报废后不可用于生产；不再扣一次米料或端头，不退回连续料库存。</p>`+input('quantity','本次实际报废（'+output.unit+'）','number')+input('reason','报废原因')+'<label class="flex gap-2 mt-3"><input type="checkbox" name="confirmed">已核对来源及实物，确认本次数量实际报废</label>'
 }
 if(name==='allocate-print'||name==='allocate-dye'){
  const [sourceOrderId,recordId]=JSON.parse(id),origins=data.processingIssues.filter(i=>i.upstream&&order.demands.some(d=>d.id===i.demandId))
  content+=`<p class="mt-3 break-all">原${name==='allocate-dye'?'染色':'印花'}单 ${e(sourceOrderId)} / 交出记录 ${e(recordId)}</p><p>按实际来料来源分配到各需求；分配不会增加实收或扣第二次仓库料。</p>`+order.demands.map((d,index)=>`<article class="border rounded p-3 mt-3"><p>${e(d.specification.usage)} · ${e(d.garmentSize)} · 下料 ${d.specification.cutLengthMm}mm · ${d.requiredPieces} 条/根</p>${input('meters-'+index,'分配投入（米，不分配留空）','number')}<label class="block mt-3 text-sm">首次印染发料来源<select name="origin-${index}" class="w-full border rounded p-2"><option value="">请选择原发料批次</option>${origins.map(i=>`<option value="${e(i.id)}">${e(i.id)} · ${e(i.lotId)} · ${i.dispatchedMeters} 米</option>`).join('')}</select></label></article>`).join('')
 }
 if(name==='merged-receive'||name==='merged-cut'){
  const lines=mergedInputs(id),spec=data.demands.find(d=>d.id===lines[0].demandId)!.specification
  content+=`<p class="font-medium mt-3">合并批 ${e(id)}</p><p class="text-sm">会同时更新所选生产单来源行；每行填实际数量，未处理行不勾选。任一行不符合要求时整批不保存。</p><p class="text-sm mt-2">要求下料 ${spec.cutLengthMm}mm，成品 ${spec.finishedLengthMm}mm，公差 ±${spec.toleranceMm}mm；${e(spec.measurementCondition)}；${spec.lengthBasis==='INCLUDING_ENDS'?'含端头':'不含端头'}。</p><p class="text-sm">A端 ${e(tip(spec.endA.method))} ${e(spec.endA.specification)}；B端 ${e(tip(spec.endB.method))} ${e(spec.endB.specification)}</p>`+input('batchScan','扫描合并批号')
  if(name==='merged-receive')content+=input('sku','扫描半成品SKU')
  else content+=input('length','本次共同实际下料长度（mm）','number')+(spec.tippingRequired?'<p class="text-amber-700 text-sm">截断后为待打头，不能直接装包。</p>':input('finished','本次共同实际成品长度（mm）','number'))+input('reason','本批损耗、不良或超需求原因')
  content+=lines.filter(i=>name==='merged-receive'?i.receivedMeters<i.dispatchedMeters:getTmfProcessingInputBalance(i.id).remainingMeters>0).map(i=>{const d=data.demands.find(d=>d.id===i.demandId)!;return `<article class="border rounded mt-3 p-3" data-merged-input="${e(i.id)}"><label class="flex gap-2"><input type="checkbox" name="selectedLine">${e(d.productionOrderNo)} · ${e(d.specification.usage)} / ${e(d.garmentSize)}</label><p class="text-xs mt-2">批次 ${e(i.lotId)} · 上游已发 ${i.dispatchedMeters} 米，本厂已收 ${i.receivedMeters} 米；厂内可加工 ${getTmfProcessingInputBalance(i.id).remainingMeters} 米</p>${input('lineQuantity',name==='merged-receive'?'本行本次实际收到（米）':'本行本次截断（条/根）','number')}${name==='merged-cut'?input('lineDefective','其中不良（条/根）','number','0')+input('lineLoss','本行实际损耗（米）','number','0'):''}</article>`}).join('')
  content+='<label class="flex gap-2 mt-3 text-sm"><input name="confirmed" type="checkbox">确认所选来源行、实物与本次实际数量一致</label>'
 }
 if(name==='receive'||name==='cut'||name==='return'){
  const i=order.inputs.find(i=>i.id===id);if(!i)throw new Error('投入不属于当前加工单。');const d=order.demands.find(d=>d.id===i.demandId)!
  content+=`<p class="mt-3">${e(d.garmentSize)} / ${e(d.specification.usage)}；要求下料 ${d.specification.cutLengthMm}mm</p><p class="text-xs break-all">来源 ${e(i.id)}；SKU ${e(i.materialSkuId)}</p>`
  if(name==='receive')content+=input('sku','扫描或输入投入 SKU')+input('quantity','本次实际收到（米）','number')
  else if(name==='return')content+=`<p>厂内可退 ${getTmfProcessingInputBalance(i.id).remainingMeters} 米；目标为原辅料仓。</p>`+input('returnId','退料交出单号')+input('batch','回仓批次号')+input('quantity','本次实际交回（米）','number')+input('reason','退料原因')+'<label class="flex gap-2 mt-3 text-sm"><input name="continuous" type="checkbox">确认是未截断连续料，已核对实物和米数</label>'
  else content+=input('quantity','本次实际截断（条/根）','number')+input('length','实际下料长度（mm）','number')+(d.specification.tippingRequired?'<p class="text-sm mt-2">本规格需打头；本次截断后保持待打头。</p>':input('finished','实际成品长度（mm）','number'))+input('defective','本次不良（条/根）','number','0')+input('loss','本次切割损耗（米）','number','0')+input('reason','不良、损耗或超需求原因')
 }
 if(name==='receive-tip'||name==='return-tip'){
  const m=data.tipMaterialIssues.find(m=>m.id===id&&order.demands.some(d=>d.id===m.demandId));if(!m)throw new Error('辅材不属于当前加工单。')
  content=`<p>${e(m.materialSkuId)} · 来源发料 ${e(m.sourceDocumentNo)}</p><p class="text-xs">${m.stockLotId?`来源实收批次 ${e(m.stockLotId)} · ${e(data.tipMaterialLots.find(l=>l.id===m.stockLotId)?.warehouseId??'来源仓缺失')}`:'历史发料缺来源批次，未补造库存'}</p><p>上游已发 ${m.dispatchedQty}，本厂已收 ${m.receivedQty} ${m.unit}</p><p class="text-xs text-slate-500">端头参考图见技术包端头要求；实物以技术包与实收批次为准</p>`+input('sku','扫描或输入实际辅材 SKU')+input('quantity',`本次实际${name==='return-tip'?'交回':'收到'}（${m.unit}）`,'number')
  if(name==='return-tip')content+=`<p class="mt-2">可退 ${getTmfTipMaterialBalance(m.id).availableQty} ${m.unit}；退回来源批次仓库。</p>`+input('returnId','辅材退料单号')+input('reason','未用辅材退回原因')+'<label class="flex gap-2 mt-3 text-sm"><input name="confirmed" type="checkbox">确认未使用且可回仓，已核对SKU、数量和来源</label>'
 }
 if(name==='tip'){
  const o=order.outputs.find(o=>o.id===id);if(!o)throw new Error('条料不属于当前加工单。')
  content+=renderTmfTippingForm(o,data.tipMaterialIssues.filter(m=>m.demandId===o.demandId))
 }
 if(name==='pack'){
  const o=order.outputs.find(o=>o.id===id);if(!o)throw new Error('产出不属于当前加工单。')
  content+=`<p class="mt-3">实际下料 ${o.actualCutLengthMm}mm；合格 ${o.goodPieces} ${o.unit}</p>`+input('package','实际包号')+input('quantity',`本包装入（${o.unit}）`,'number')
  if(o.specification.tippingRequired)content+=`<label class="block text-sm mt-3">已完成打头批次<select name="tip" class="w-full border p-2">${data.tipResults.filter(t=>t.cutOutputId===o.id&&t.goodPieces>0).map(t=>`<option value="${e(t.id)}">${e(t.id)} · ${t.actualFinishedLengthMm}mm · 合格${t.goodPieces}</option>`).join('')}</select></label>`
 }
 if(name==='dispatch'){
  const p=order.packages.find(p=>p.id===id);if(!p)throw new Error('包不属于当前加工单。')
  content+=`<p class="mt-3">包 ${e(p.id)}；${p.pieces} ${p.unit}；成品 ${p.actualFinishedLengthMm}mm</p>`+input('handover','本次交出单号')+input('package','扫描或输入实物包号')+'<label class="flex gap-2 mt-3 text-sm"><input name="confirmed" type="checkbox">确认实物数量、规格和包号一致，交回来源辅料仓</label>'
 }
 const surface=root()!.querySelector('[data-tmf-detail-dialog]')!;surface.innerHTML=renderDialog({title:({scrap:'不良产出报废确认','allocate-print':'印花交出分配加工投入','allocate-dye':'染色交出分配加工投入','merged-receive':'合并批投入实收','merged-cut':'合并批截断填报','return-tip':'未用辅材交回',return:'连续余料交回','receive-tip':'端头辅材实收',tip:'实际打头填报',receive:'投入实收',cut:'截断产出填报',pack:'合格产出装包',dispatch:'交回辅料仓'} as Record<string,string>)[name],width:'lg',closeAction:{prefix,action:'close',skipPageRerender:true}},`<div class="max-h-[60vh] overflow-y-auto">${content}</div><p role="alert" data-tmf-detail-error class="text-red-700 text-sm mt-2"></p>`,action('close','关闭')+action('confirm','确认'));hydrateIcons(surface);surface.setAttribute('tabindex','-1');(surface as HTMLElement).focus({preventScroll:true})
}
function bind(){const el=root();if(!el||el.dataset.bound)return;el.dataset.bound='true'
 el.addEventListener('error',event=>{if(event.target instanceof HTMLImageElement){const span=document.createElement('span');span.textContent='图片加载失败';event.target.replaceWith(span)}},true)
 el.addEventListener('keydown',event=>{if(event.key==='Escape'){const timeDialog=el.querySelector('[data-tmf-work-time-dialog]');if(timeDialog?.innerHTML){timeDialog.innerHTML='';return}const image=el.querySelector('[data-tmf-detail-image]')!;if(image.innerHTML)image.innerHTML='';else close()}})
 el.addEventListener('click',async event=>{
  if(handleTmfWorkTimeEvent(event.target as HTMLElement)){event.stopPropagation();return}
  const button=(event.target as HTMLElement).closest<HTMLElement>(`[data-${prefix}-action]`);if(!button)return;event.stopPropagation();const name=button.getAttribute(`data-${prefix}-action`)
  try{
   if(name==='tab'){tab=button.dataset.id!;el.querySelectorAll(`[data-${prefix}-action="tab"]`).forEach(b=>b.classList.toggle('bg-blue-50',b===button));refresh()}
   else if(name==='print-packages'){
    const ids=Array.from(el.querySelectorAll<HTMLInputElement>('[data-tmf-print-package]:checked')).map(input=>input.dataset.tmfPrintPackage!)
    if(!ids.length)throw new Error('请先选择需要打印的有效包。')
    appStore.navigate(buildUnifiedPrintPreviewLink({documentType:'TMF_PACKAGE_LABEL',sourceType:'TMF_OUTPUT_PACKAGE',sourceId:JSON.stringify(ids)}))
   }
   else if(name==='link-print'){
    const [dyeId,printId]=JSON.parse(button.dataset.id!)
    const dye=await import('../../../../data/fcs/dyeing-task-domain.ts')
    await dye.linkTmfDyePrintContinuation(dyeId,printId)
    const surface=el.querySelector('[data-tmf-upstream-content]')
    if(surface?.isConnected){const result=document.createElement('p');result.setAttribute('role','status');result.textContent='已按采用路线确认印花接收方。实际交出及实收仍须分别登记。';surface.prepend(result)}
   }
   else if(name==='link-tmf'){
    const [printId,cutId]=JSON.parse(button.dataset.id!)
    const printing=await import('../../../../data/fcs/printing-task-domain.ts')
    printing.linkTmfPrintCutContinuation(printId,cutId)
    const surface=el.querySelector('[data-tmf-upstream-content]')
    if(surface?.isConnected){const result=document.createElement('p');result.setAttribute('role','status');result.textContent='已按路线确认交给 TMF 辅料厂。实际交出及投入实收仍须分别登记。';surface.prepend(result)}
   }
   else if(name==='link-dye-tmf'){
    const [dyeId,cutId]=JSON.parse(button.dataset.id!)
    const dyeing=await import('../../../../data/fcs/dyeing-task-domain.ts')
    dyeing.linkTmfDyeCutContinuation(dyeId,cutId)
    const surface=el.querySelector('[data-tmf-upstream-content]')
    if(surface?.isConnected){const result=document.createElement('p');result.setAttribute('role','status');result.textContent='已按路线确认染色直接交给 TMF 辅料厂截断。实际交出及投入实收仍须分别登记。';surface.prepend(result)}
   }
   else if(name==='close')close()
   else if(name==='close-image')el.querySelector('[data-tmf-detail-image]')!.innerHTML=''
   else if(name==='image'){const order=getTmfWorkOrder(activeId);if(order?.material?.materialImageUrl)el.querySelector('[data-tmf-detail-image]')!.innerHTML=`<div class="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4"><button class="absolute inset-0" data-${prefix}-action="close-image" data-skip-page-rerender="true" aria-label="关闭大图"></button><div class="relative bg-white p-3 rounded"><p>半成品参考图；真实实拍替代图 ${action('close-image','关闭')}</p><img class="max-h-[70vh] max-w-[85vw] object-contain" src="${e(order.material.materialImageUrl)}" alt="${e(order.material.materialName)}半成品参考图"></div></div>`}
   else if(name==='confirm'){
    const order=getTmfWorkOrder(activeId);if(!order)throw new Error('加工单来源不存在。')
    const data=getTmfPurchaseState(),value=(field:string)=>el.querySelector<HTMLInputElement>(`[data-tmf-detail-dialog] [name="${field}"]`)!.value.trim(),number=(field:string)=>Number(value(field))
    if(currentAction==='merged-receive'||currentAction==='merged-cut'){
     const inputs=mergedInputs(selected)
     if(value('batchScan')!==selected||!el.querySelector<HTMLInputElement>('[name="confirmed"]')?.checked)throw new Error('请核对合并批号及所选各生产单实物数量后确认。')
     const lines=Array.from(el.querySelectorAll<HTMLElement>('[data-merged-input]')).filter(line=>line.querySelector<HTMLInputElement>('[name="selectedLine"]')!.checked)
     const read=(line:HTMLElement,name:string)=>Number(line.querySelector<HTMLInputElement>(`[name="${name}"]`)!.value)
     if(currentAction==='merged-receive')receiveTmfMergedProcessingMaterial({batchId:selected,materialSkuId:value('sku')===order.material?.materialCode?order.material.materialSkuId:value('sku'),lines:lines.map(line=>({issueId:line.dataset.mergedInput!,receivedMeters:read(line,'lineQuantity')}))},actor,operationId)
     else{
      const spec=data.demands.find(d=>d.id===inputs[0].demandId)!.specification
      reportTmfMergedCutOutput({batchId:selected,actualCutLengthMm:number('length'),actualFinishedLengthMm:spec.tippingRequired?null:number('finished'),reason:value('reason'),lines:lines.map(line=>({issueId:line.dataset.mergedInput!,outputId:`${operationId}:${line.dataset.mergedInput}`,cutPieces:read(line,'lineQuantity'),defectivePieces:read(line,'lineDefective'),lossMeters:read(line,'lineLoss')}))},actor,operationId)
     }
    }
    if(currentAction==='scrap'){const [cutOutputId,tipResultId]=JSON.parse(selected);scrapTmfDefectiveOutput({id:operationId,cutOutputId,tipResultId:tipResultId??undefined,pieces:number('quantity'),expectedAvailablePieces:scrapAvailable,reason:value('reason'),confirmed:!!el.querySelector<HTMLInputElement>('[name="confirmed"]')?.checked},actor,operationId)}
    if(currentAction==='allocate-print'||currentAction==='allocate-dye'){
     const [orderId,recordId]=JSON.parse(selected)
     const lines=order.demands.map((d,index)=>({issueId:`${operationId}:${index}`,demandId:d.id,sourceIssueId:value('origin-'+index),meters:number('meters-'+index)}))
     if(lines.some(l=>!Number.isFinite(l.meters)||l.meters<0))throw new Error('请填写有效的非负米数。')
     const payload={orderId,recordId,lines:lines.filter(l=>l.meters>0)}
     await (currentAction==='allocate-dye'?allocateTmfDyeHandover(payload,actor,operationId):allocateTmfPrintHandover(payload,actor,operationId))
    }
    if(currentAction==='receive'){const i=order.inputs.find(i=>i.id===selected)!;const scanned=value('sku'),materialSkuId=scanned===order.material?.materialCode?order.material.materialSkuId:scanned;if(i.printHandover)await receiveTmfPrintMaterial({issueId:i.id,materialSkuId,receivedMeters:number('quantity')},actor,operationId);else if(i.dyeHandover)await receiveTmfDyeMaterial({issueId:i.id,materialSkuId,receivedMeters:number('quantity')},actor,operationId);else receiveTmfProcessingMaterial({issueId:i.id,factoryId:'FAC-TMF',materialSkuId,receivedMeters:number('quantity')},actor,operationId)}
    if(currentAction==='cut'){const i=order.inputs.find(i=>i.id===selected)!;const d=order.demands.find(d=>d.id===i.demandId)!;reportTmfCutOutput({outputId:`${operationId}:output`,issueId:i.id,cutPieces:number('quantity'),defectivePieces:number('defective'),actualCutLengthMm:number('length'),actualFinishedLengthMm:d.specification.tippingRequired?null:number('finished'),lossMeters:number('loss'),reason:value('reason')},actor,operationId)}
    if(currentAction==='return'){const i=order.inputs.find(i=>i.id===selected);if(!i||!el.querySelector<HTMLInputElement>('[name="continuous"]')?.checked)throw new Error('请核对未截断连续料和实际米数后确认。');dispatchTmfContinuousReturn({returnId:value('returnId'),issueId:i.id,batchId:value('batch'),returnedMeters:number('quantity'),reason:value('reason')},actor,operationId)}
    if(currentAction==='return-tip'){const m=data.tipMaterialIssues.find(m=>m.id===selected&&order.demands.some(d=>d.id===m.demandId));if(!m||value('sku')!==m.materialSkuId||!el.querySelector<HTMLInputElement>('[name="confirmed"]')?.checked)throw new Error('请核对未用辅材SKU和数量后确认。');dispatchTmfTipMaterialReturn({id:value('returnId'),sourceIssueId:m.id,quantity:number('quantity'),reason:value('reason')},actor,operationId)}
    if(currentAction==='receive-tip'){const m=data.tipMaterialIssues.find(m=>m.id===selected&&order.demands.some(d=>d.id===m.demandId));if(!m||value('sku')!==m.materialSkuId)throw new Error('所扫辅材SKU不符，请核对本次来料。');receiveTmfTipMaterial(m.id,number('quantity'),actor,operationId)}
    if(currentAction==='tip'){const o=order.outputs.find(o=>o.id===selected)!;const actual=readTmfTippingForm(el.querySelector('[data-tmf-detail-dialog]')!,data.tipMaterialIssues.filter(m=>m.demandId===o.demandId));reportTmfTipping({id:`${operationId}:tip`,cutOutputId:o.id,...actual},actor,operationId)}
    if(currentAction==='pack'){const o=order.outputs.find(o=>o.id===selected)!;packTmfOutput({packageId:value('package'),cutOutputId:o.id,pieces:number('quantity'),...(o.specification.tippingRequired?{tipResultId:value('tip')}:{})},actor,operationId)}
    if(currentAction==='dispatch'){const p=order.packages.find(p=>p.id===selected)!;if(value('package')!==p.id||!el.querySelector<HTMLInputElement>('[name="confirmed"]')!.checked)throw new Error('请核对实物包号及数量后确认交出。');const o=data.cutOutputs.find(o=>o.id===p.cutOutputId)!;const i=data.processingIssues.find(i=>i.id===o.sourceIssueId)!;const lot=data.lots.find(l=>l.id===i.lotId)!;dispatchTmfOutputPackage({handoverId:value('handover'),packageId:p.id,warehouseId:lot.warehouseId},actor,operationId)}
    close();refresh();el.querySelector('[data-tmf-detail-feedback]')!.textContent='已保存本次实际记录；产出交出与辅料仓实收分别核对。'
   }else if(name&&['scrap','allocate-print','allocate-dye','merged-receive','merged-cut','receive','cut','pack','dispatch','receive-tip','tip','return','return-tip'].includes(name))open(name,button.dataset.id||'')
  }catch(error){const target=el.querySelector('[data-tmf-detail-error]')??el.querySelector('[data-tmf-detail-feedback]');if(target)target.textContent=error instanceof Error?error.message:'未保存，请重试。'}
 })
}
export function renderTmfWorkOrderDetailPage(id:string){if(typeof window!=='undefined')reloadTmfPurchaseRuntime();activeId=id;const params=new URLSearchParams(appStore.getState().pathname.split('?')[1]||'');tracePackageId=params.get('packageId')||'';const requestedTab=params.get('tab')||'';tab=tracePackageId?'packages':['requirements','upstream','inputs','merged','tipping','outputs','packages','returns','times','history'].includes(requestedTab)?requestedTab:'requirements';selected=currentAction=operationId='';const order=getTmfWorkOrder(id);if(!order)return '<div class="p-6">加工单不存在，请从加工单列表重新进入。</div>';if(typeof window!=='undefined')requestAnimationFrame(bind);return `<div data-tmf-work-detail class="p-4 space-y-4"><div class="flex justify-between gap-3"><div><h1 class="text-xl font-semibold">织带加工单 · ${e(order.productionOrderNo)}</h1><p class="text-xs break-all text-slate-500">技术包 ${e(order.versionId)} · 工艺节点 ${e(order.routeEntryId)}</p></div><button class="border rounded px-3 py-2 text-sm" data-nav="${e(buildUnifiedPrintPreviewLink({documentType:'TMF_PROCESS_SHEET',sourceType:'TMF_WORK_ORDER',sourceId:id}))}">加工明细打印预览</button><button data-nav="/fcs/craft/accessory/webbing/work-orders" class="border rounded px-3 py-2 text-sm">返回织带加工单</button></div><div class="bg-white border rounded p-3 flex gap-3 items-center">${photo()}<div>${e(order.material?.materialName??order.demands[0].materialSkuId)}<p class="text-xs text-amber-700">半成品参考；真实实拍替代图</p><p class="text-sm" data-tmf-detail-status>${order.receiptStatus} / ${order.processingStatus} / ${order.handoverStatus}</p></div></div>${order.control&&order.control.status!=='ACTIVE'?`<p class="text-amber-700">生产单受限：${e(order.control.reason)}</p>`:''}<p class="text-xs text-slate-500">操作身份：${e(actor.name)}；现场操作只有确认接收、加工填报、发起交出。</p><div class="flex flex-wrap gap-2">${[['requirements','需求与工艺'],['upstream','印染来源'],['inputs','投入／接收／截断'],['merged','合并加工批'],['tipping','打头／辅材'],['outputs','加工产出'],['packages','包装与交出'],['returns','连续余料退仓'],['times','时间与计划'],['history','操作记录']].map(([id,title])=>action('tab',title,id)).join('')}</div><p role="status" data-tmf-detail-feedback class="text-sm text-blue-700"></p><div data-tmf-detail-content>${body()}</div><div data-tmf-detail-dialog></div><div data-tmf-detail-image></div></div>`}
