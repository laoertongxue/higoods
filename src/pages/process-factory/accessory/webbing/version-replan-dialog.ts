import { renderDialog } from '../../../../components/ui/dialog.ts'
import { hydrateIcons } from '../../../../components/shell.ts'
import { escapeHtml as e } from '../../../../utils.ts'
import { resolveTmfTipReference, TMF_REFERENCE_IMAGES } from '../../../../data/fcs/tmf-reference-images.ts'
import { getTmfVersionReplanReview, replanTmfUnstartedVersion, replanTmfVersionWithFrozenOutputs } from '../../../../data/pms/tmf-material-purchases.ts'

/** 换版前核对旧实物；冻结及新需求一次确认，旧规格不覆盖。 */
export function openTmfVersionReplanDialog(surface: HTMLElement, productionOrderId: string, onSaved: (frozen: boolean) => void) {
 const review=getTmfVersionReplanReview(productionOrderId),expectedReview=JSON.stringify(review),operationId=`tmf-version:${crypto.randomUUID()}`
 const physical=review.physical,blocked=review.blockedByProductionIssue
 const physicalSummary=review.executed?`<section class="border rounded p-3 mt-3"><h3 class="font-medium">旧实物核对 · 冻结后仍按原规格保留</h3>
 ${physical.issues.filter(i=>i.targetFactoryId==='FAC-TMF').map(i=>`<p class="text-xs mt-2 break-all">投入 ${e(i.id)} · ${e(i.materialSkuId)}：实收 ${i.actualReceivedMeters} 米，未截断 ${i.balance.remainingMeters} 米，退仓在途 ${i.balance.returnTransitMeters} 米。余料仍需按原来源退回，未转给新版。</p>`).join('')}
 ${physical.outputs.map(o=>`<p class="mt-2">产出 ${e(o.id)}：${o.actualCutLengthMm}mm × ${o.cutPieces} ${o.unit}；合格 ${o.goodPieces}，待打头 ${o.pendingTipPieces}，历史不良 ${o.defectivePieces}；已报废 ${physical.scraps.filter(s=>s.cutOutputId===o.id).reduce((n,s)=>n+s.pieces,0)}。</p>`).join('')}
 ${physical.packages.filter(p=>!p.splitAt).map(p=>`<p class="text-xs mt-2 break-all">包号 ${e(p.id)} · ${p.pieces} ${p.unit} · ${e(p.warehouseId||'尚未回仓')} / ${e(p.location||'未登记库位')}</p>`).join('')}
 ${physical.handovers.map(h=>`<p class="text-xs mt-2">交出 ${e(h.id)}：已交 ${h.dispatchedPieces}，仓库实收 ${h.receivedPieces}，在途 ${h.dispatchedPieces-h.receivedPieces} 条/根。已交实物继续按原单接收。</p>`).join('')}
 <p class="text-sm mt-2">释放未发分配 ${physical.allocations.reduce((n,a)=>n+a.allocatedPieces-a.releasedPieces-physical.productionIssues.filter(i=>i.allocationId===a.id).reduce((k,i)=>k+i.dispatchedPieces,0),0)} 条/根。旧实物不计入新版可用数，不会自动改变长度或端头。</p>
 ${physical.tipIssues.length?'<p class="text-xs text-amber-700 mt-2">旧端头辅材及耗用记录保留；未用辅材须按原来源另行退回。</p>':''}
 </section>`:''
 const prefix='tmf-version',button=(action:string,label:string)=>`<button type="button" class="border rounded px-3 py-2 text-sm" data-${prefix}-action="${action}" data-skip-page-rerender="true">${label}</button>`
 const end=(method:string)=>({NONE:'无端头',METAL:'金属头',PLASTIC_WRAP:'塑料包头',SILICONE_DIP:'硅胶浸头'}[method]??method)
 const demands=(rows:typeof review.next)=>rows.map(d=>`<article class="border rounded p-3 mt-2"><p>${e(d.specification.usage)} · ${e(d.garmentSize)} · ${d.requiredPieces} 条/根</p><p class="text-xs break-all">${e(d.materialSkuId)} · ${e(d.techPackVersionId)}</p><p>下料 ${d.specification.cutLengthMm}mm；成品 ${d.specification.finishedLengthMm}mm；公差 ±${d.specification.toleranceMm}mm</p><p class="text-xs">A端 ${e(end(d.specification.endA.method))} ${e(d.specification.endA.specification)}；B端 ${e(end(d.specification.endB.method))} ${e(d.specification.endB.specification)}</p><p class="text-xs">${e(d.specification.measurementCondition)}；${d.specification.lengthBasis==='INCLUDING_ENDS'?'含端头':'不含端头'}</p><figure class="mt-2 flex items-center gap-2"><img src="${e([d.specification.endA,d.specification.endB].map(x=>resolveTmfTipReference(x.method)).find(Boolean)||TMF_REFERENCE_IMAGES.webbingRealRoll)}" alt="加工规格参考图" class="h-12 w-12 rounded border object-cover" loading="lazy"><figcaption class="text-xs text-slate-500">加工规格参考图（端头/半成品）；实物以技术包与产出记录为准</figcaption></figure></article>`).join('')
 surface.innerHTML=renderDialog({title:'采用版本变更核对',width:'lg',closeAction:{prefix,action:'close',skipPageRerender:true}},`<div class="max-h-[60vh] overflow-y-auto" data-tmf-version-review><p>${e(productionOrderId)} · 操作身份：生产计划（演示）</p><div class="grid sm:grid-cols-2 gap-3 mt-3"><section><h3 class="font-medium">旧需求（保留追溯）</h3>${demands(review.previous)}</section><section><h3 class="font-medium">当前采用需求</h3>${demands(review.next)}</section></div><p class="mt-3">旧需求未发占用 ${review.reservedMeters} 米。确认后释放占用，新需求需重新备料，不增加实存或新SKU。</p>${physicalSummary}${blocked?'<p class="mt-3 text-red-700">旧版本已有生产发料或实收，须先核对生产端已用数量，不能按全部重做生成需求。</p>':'<label class="block mt-3">处理原因<input name="reason" class="block border rounded p-2 w-full"></label><label class="flex gap-2 mt-3"><input type="checkbox" name="confirmed">已核对新旧要求及上述实物；保留旧规格并冻结旧产出，释放未发占用/分配，生成当前版本需求</label>'}</div><p role="alert" class="text-red-700 mt-2" data-tmf-version-error></p>`,button('close','关闭')+(blocked?'':button('confirm',review.executed?'确认冻结旧实物并重算':'确认换版重算')))
 hydrateIcons(surface)
 surface.onclick=event=>{
  const target=(event.target as HTMLElement).closest<HTMLElement>(`[data-${prefix}-action]`);if(!target)return;event.stopPropagation()
  if(target.dataset.tmfVersionAction==='close'){surface.replaceChildren();return}
  if(target.dataset.tmfVersionAction!=='confirm')return
  try{
   const save=review.executed?replanTmfVersionWithFrozenOutputs:replanTmfUnstartedVersion
   save({productionOrderId,expectedReview,reason:surface.querySelector<HTMLInputElement>('[name="reason"]')!.value,confirmed:surface.querySelector<HTMLInputElement>('[name="confirmed"]')!.checked},{id:'TMF-DEMO-PLAN',name:'生产计划（演示）',role:'生产计划'},operationId)
   surface.replaceChildren();onSaved(review.executed)
  }catch(error){surface.querySelector('[data-tmf-version-error]')!.textContent=error instanceof Error?error.message:'未保存，请重新核对。'}
 }
}
