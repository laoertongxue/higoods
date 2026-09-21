import { getTmfWorkOrder } from '../../../../data/fcs/tmf-work-order-view.ts'
import { hydrateIcons } from '../../../../components/shell.ts'
import { escapeHtml as e } from '../../../../utils.ts'
import { renderDialog } from '../../../../components/ui/dialog.ts'
import { getTmfPurchaseState, saveTmfWorkPlan, getTmfWorkExecutionReview, recordTmfWorkExecution, getTmfWorkCostReview, saveTmfWorkCost } from '../../../../data/pms/tmf-material-purchases.ts'
import { projectTmfWorkTimes, formatTmfWorkTime, tmfJakartaInput } from '../../../../data/fcs/tmf-work-order-times.ts'
const actor={id:'TMF-DEMO-SUPERVISOR',name:'织带厂主管（演示）',role:'织带厂主管' as const}
let activeCostSummary=''
const button=(action:string,label:string)=>`<button type="button" class="rounded border px-3 py-2 text-sm" data-tmf-work-time-action="${action}" data-skip-page-rerender="true">${label}</button>${action==='edit'?button('cost','登记加工费用'):''}${action==='cost'?`<span class="text-xs text-slate-600">${activeCostSummary}</span>`:''}`
const hours=(value:number|null)=>value===null?'未具备计算条件':`${value.toFixed(3)} 小时`
export function renderTmfWorkTimes(id:string):string{
 const t=projectTmfWorkTimes(getTmfPurchaseState(),id)
 const cost=t.cost
 activeCostSummary=cost?`${cost.unitPrice} ${e(cost.currency)} / ${e(cost.pricingUnit)} · 计价量 ${cost.pricingQuantity} · 预计 ${cost.estimatedAmount} ${e(cost.currency)}`:'费用待登记'
 const executionAction=t.execution?.finishedAt?'':t.execution?.startedAt?'FINISH':t.execution?.acceptedAt?'START':!t.hasOutputs?'ACCEPT':''
 const labels={ACCEPT:'确认当前接单',START:'确认实际开工',FINISH:'核对正常完工'}
 const executionButton=executionAction?button('execution',labels[executionAction as keyof typeof labels]).replace('<button',`<button data-stage="${executionAction}"`):''
 return `<section data-tmf-work-times data-work-id="${e(id)}" class="space-y-3"><div class="rounded border bg-white p-4"><div class="flex justify-between items-center gap-3"><h3 class="font-medium">时间与进度</h3><div class="flex gap-2">${executionButton}${button('edit','登记加工计划')}</div></div><p class="text-xs text-slate-500 mt-2">现场时间：Asia/Jakarta（UTC+07:00）。生产交期、加工计划与实际记录分别核对。</p><div class="grid grid-cols-2 gap-4 mt-3"><div><p>生产单要求交期：${e(t.requiredDates.join('、')||'未提供')}</p><p>加工负责人：${e(t.plan?.responsibleName||'待登记')}</p><p>计划开始：${e(formatTmfWorkTime(t.plan?.plannedStartAt))}</p><p>计划完成：${e(formatTmfWorkTime(t.plan?.plannedFinishAt))}</p><p>计划时长：${hours(t.plannedDurationHours)}</p></div><div><p>管理最长时效：未设定（待批准）</p><p>实际首批投入接收：${e(formatTmfWorkTime(t.firstReceivedAt))}</p><p>首笔产出填报：${e(formatTmfWorkTime(t.firstReportedAt))}</p><p>末笔产出填报：${e(formatTmfWorkTime(t.lastReportedAt))}</p><p>首收至末次填报间隔：${hours(t.elapsedHours)}</p></div></div>${t.execution?`<div class="border-t mt-3 pt-3 text-sm"><p>实际接单：${e(formatTmfWorkTime(t.execution.acceptedAt))} · ${e(t.execution.acceptedBy)}</p><p>实际开工：${e(formatTmfWorkTime(t.execution.startedAt))} · ${e(t.execution.startedBy??'')}</p><p>实际完工：${e(formatTmfWorkTime(t.execution.finishedAt))} · ${e(t.execution.finishedBy??'')}</p><p>开工至${t.execution.finishedAt?'完工':'当前'}历时：${hours(t.actualDurationHours)}（含等待）</p><p class="text-xs text-slate-500">正常完工不代表仓库已收齐、生产已满足或业务已结案。</p></div>`:'<p class="text-xs text-amber-700 mt-3">实际开工／加工完成：未单独登记；产出填报时间不能代替开完工，间隔包含等待，不是净加工工时。</p>'}${t.planFinishPassed?'<p class="text-amber-700 text-sm mt-2">计划完成时间已过，请核对实际进度；本提示不代表已批准SLA超时。</p>':''}<p class="mt-2 text-sm">当前等待说明：${e(t.plan?.waitingReason||'未登记')}</p>${t.plan?`<p class="text-xs text-slate-500">计划版本 ${t.plan.revision} · ${e(t.plan.updatedBy)} · ${e(formatTmfWorkTime(t.plan.updatedAt))}</p>`:''}</div><div class="rounded border bg-white p-4"><h3 class="font-medium">交接实际时间</h3><p>最近交回辅料仓：${e(formatTmfWorkTime(t.lastHandoverAt))}</p><p>辅料仓最近实收：${e(formatTmfWorkTime(t.lastWarehouseReceiptAt))}</p><p class="text-xs text-slate-500">最近一次记录不等于整单已交齐或已收齐。</p></div><details class="rounded border bg-white p-4"><summary class="cursor-pointer">查看最近时间记录（${t.events.length} 条）</summary><div class="mt-3 space-y-2">${t.events.slice(-20).reverse().map(v=>`<p class="text-sm">${e(formatTmfWorkTime(v.at))} · ${e(v.action)} · ${e(v.actor)}<span class="block text-xs break-all">来源 ${e(v.source)}；${e(v.reason)}</span></p>`).join('')||'<p>尚无实际记录。</p>'}${t.events.length>20?'<p class="text-xs">这里显示最近20条，完整记录请查看“操作记录”。</p>':''}</div></details><p data-tmf-work-time-feedback role="status" class="text-sm text-blue-700"></p><div data-tmf-work-time-dialog></div></section>`
}
export function handleTmfWorkTimeEvent(target:HTMLElement):boolean{
 const b=target.closest<HTMLElement>('[data-tmf-work-time-action]');if(!b)return false
 const root=b.closest<HTMLElement>('[data-tmf-work-times]');if(!root)return false
 const id=root.dataset.workId!,host=root.querySelector<HTMLElement>('[data-tmf-work-time-dialog]')!,action=b.dataset.tmfWorkTimeAction
 if(action==='close'){host.innerHTML='';return true}
 try{
  if(action==='execution'){
   const stage=b.dataset.stage!,review=getTmfWorkExecutionReview(id)
   host.innerHTML=renderDialog({title:({ACCEPT:'确认当前接单',START:'确认实际开工',FINISH:'核对正常完工'} as Record<string,string>)[stage],width:'md',closeAction:{prefix:'tmf-work-time',action:'close',skipPageRerender:true}},`<form class="max-h-[55vh] overflow-y-auto" data-tmf-execution-form data-stage="${e(stage)}" data-review="${e(JSON.stringify(review))}" data-operation-id="${crypto.randomUUID()}" onsubmit="return false"><p class="text-sm">记录本次现场动作的当前时间，不补造历史记录。</p>${review.demands.map(d=>`<p class="text-sm mt-2">${e(d.size)} ${d.lengthMm}mm：合格 ${d.goodPieces} / 需求 ${d.requiredPieces} 条/根</p>`).join('')}<p class="mt-2 text-sm">待打头 ${review.pendingTipPieces} 条/根；厂内连续余料 ${review.inputs.reduce((n,i)=>n+i.remainingMeters,0).toFixed(3)} 米；投入未收 ${review.inputs.reduce((n,i)=>n+i.unreceivedMeters,0).toFixed(3)} 米</p><label class="block mt-3 text-sm">现场说明<input name="reason" class="mt-1 w-full border rounded p-2"></label><label class="flex gap-2 mt-3 text-sm"><input name="confirmed" type="checkbox">已核对当前实物与数量，确认执行本次动作</label><p data-tmf-plan-error role="alert" class="mt-2 text-sm text-red-700"></p></form>`,button('close','取消')+button('confirm-execution','确认登记'))
   hydrateIcons(host);host.setAttribute('tabindex','-1');host.focus({preventScroll:true})
  }else if(action==='confirm-execution'){
   const form=host.querySelector<HTMLElement>('[data-tmf-execution-form]')!
   recordTmfWorkExecution({workOrderId:id,action:form.dataset.stage as 'ACCEPT'|'START'|'FINISH',expectedReview:form.dataset.review!,reason:form.querySelector<HTMLInputElement>('[name="reason"]')!.value.trim(),confirmed:form.querySelector<HTMLInputElement>('[name="confirmed"]')!.checked},actor,form.dataset.operationId!)
   const order=getTmfWorkOrder(id),status=root.closest('[data-tmf-work-detail]')?.querySelector('[data-tmf-detail-status]');if(order&&status)status.textContent=`${order.receiptStatus} / ${order.processingStatus} / ${order.handoverStatus}`
   root.outerHTML=renderTmfWorkTimes(id)
   const feedback=document.querySelector('[data-tmf-work-time-feedback]');if(feedback)feedback.textContent='现场动作时间已保存；交出、实收和生产满足仍分别核对。'
  }else if(action==='edit'){
   const plan=projectTmfWorkTimes(getTmfPurchaseState(),id).plan
   const field=(name:string,label:string,value:string,type='text')=>`<label class="block text-sm mt-3">${label}<input name="${name}" type="${type}" value="${e(value)}" class="w-full border rounded p-2 mt-1"></label>`
   host.innerHTML=renderDialog({title:'登记织带加工计划',width:'md',closeAction:{prefix:'tmf-work-time',action:'close',skipPageRerender:true}},`<form class="max-h-[55vh] overflow-y-auto" data-tmf-plan-form data-revision="${plan?.revision??0}" data-operation-id="${crypto.randomUUID()}" onsubmit="return false"><p class="text-sm">按印尼现场 Asia/Jakarta（UTC+07:00）填写，不改变实际加工与库存记录。</p>${field('responsible','负责人',plan?.responsibleName??'')}${field('start','计划开始',tmfJakartaInput(plan?.plannedStartAt),'datetime-local')}${field('finish','计划完成',tmfJakartaInput(plan?.plannedFinishAt),'datetime-local')}${field('waiting','当前等待说明（可留空）',plan?.waitingReason??'')}${field('reason','登记或变更原因','')}<p role="alert" data-tmf-plan-error class="text-sm text-red-700 mt-2"></p></form>`,button('close','取消')+button('save','保存计划'))
   hydrateIcons(host);host.setAttribute('tabindex','-1');host.focus({preventScroll:true})
  }else if(action==='cost'){
   const review=getTmfWorkCostReview(id),cost=review.cost,order=getTmfWorkOrder(id),defaultUnit=cost?.pricingUnit??(order?.material?.accessoryType==='绳子'?'根':'条')
   const select=(name:string,label:string,values:string[],selected:string)=>`<label class="block text-sm mt-3">${label}<select name="${name}" class="w-full border rounded p-2 mt-1">${values.map(value=>`<option ${value===selected?'selected':''}>${value}</option>`).join('')}</select></label>`
   host.innerHTML=renderDialog({title:'登记加工单费用',width:'md',closeAction:{prefix:'tmf-work-time',action:'close',skipPageRerender:true}},`<form class="max-h-[55vh] overflow-y-auto" data-tmf-cost-form data-revision="${review.revision}" data-operation-id="${crypto.randomUUID()}" onsubmit="return false"><p class="text-sm">计价数量来自当前采用技术包需求，不使用染色 Yard，也不从仓库实收倒推。</p><p class="text-sm mt-2">当前参考数量：${review.quantities.meters} 米 / ${review.quantities.pieces} 条或根；切换计价单位后由系统重算。</p><label class="block text-sm mt-3">单价<input name="price" type="number" min="0" step="0.0001" value="${e(String(cost?.unitPrice??''))}" class="w-full border rounded p-2 mt-1"></label>${select('currency','币种',['CNY','IDR','USD'],cost?.currency??'CNY')}${select('unit','计价单位',['米','条','根','单'],defaultUnit)}<label class="block text-sm mt-3">登记原因<input name="reason" class="w-full border rounded p-2 mt-1" value="${e(cost?.reason??'')}" placeholder="例如：确认本批加工报价"></label><label class="flex gap-2 mt-3 text-sm"><input name="confirmed" type="checkbox">已核对单价、币种和计价单位，确认保存</label><p role="alert" data-tmf-plan-error class="text-sm text-red-700 mt-2"></p></form>`,button('close','取消')+button('save-cost','保存费用'))
   hydrateIcons(host);host.setAttribute('tabindex','-1');host.focus({preventScroll:true})
  }else if(action==='save'){
   const form=host.querySelector<HTMLElement>('[data-tmf-plan-form]')!;const value=(key:string)=>form.querySelector<HTMLInputElement>(`[name="${key}"]`)!.value.trim()
   saveTmfWorkPlan({workOrderId:id,responsibleName:value('responsible'),plannedStartAt:value('start')+'+07:00',plannedFinishAt:value('finish')+'+07:00',waitingReason:value('waiting'),reason:value('reason'),expectedRevision:Number(form.dataset.revision)},actor,form.dataset.operationId!)
   root.outerHTML=renderTmfWorkTimes(id)
   const feedback=document.querySelector('[data-tmf-work-time-feedback]');if(feedback)feedback.textContent='计划已保存，实际加工和库存数量保持不变。'
  }else if(action==='save-cost'){
   const form=host.querySelector<HTMLElement>('[data-tmf-cost-form]')!,value=(key:string)=>form.querySelector<HTMLInputElement|HTMLSelectElement>(`[name="${key}"]`)!.value.trim()
   saveTmfWorkCost({workOrderId:id,unitPrice:Number(value('price')),currency:value('currency') as 'CNY'|'IDR'|'USD',pricingUnit:value('unit') as '米'|'条'|'根'|'单',reason:value('reason'),confirmed:form.querySelector<HTMLInputElement>('[name="confirmed"]')!.checked,expectedRevision:Number(form.dataset.revision)},actor,form.dataset.operationId!)
   root.outerHTML=renderTmfWorkTimes(id)
   const feedback=document.querySelector('[data-tmf-work-time-feedback]');if(feedback)feedback.textContent='加工费用已保存；计价数量按当前技术包需求计算，库存账未改变。'
  }
 }catch(error){const feedback=host.querySelector('[data-tmf-plan-error]')??root.querySelector('[data-tmf-work-time-feedback]');if(feedback)feedback.textContent=error instanceof Error?error.message:'本次计划未保存，请重试。'}
 return true
}
