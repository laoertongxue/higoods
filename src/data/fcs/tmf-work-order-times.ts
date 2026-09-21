import type { TmfPurchaseState } from '../pms/tmf-material-purchases.ts'
import { readCurrentPreparationHandoverRecord } from './pda-handover-events.ts'

const zoned = (value: string) => /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))
export function formatTmfWorkTime(value?: string): string {
  if (!value) return '未记录'
  if (!zoned(value)) return `${value}（原记录未标时区）`
  return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(value))
}
export function tmfJakartaInput(value?: string): string {
  return value && zoned(value) ? formatTmfWorkTime(value).slice(0,16).replace(' ','T') : ''
}

/** 只投影已有事实；不从计划、产出数量或接收时间倒推开完工。 */
export function projectTmfWorkTimes(data: TmfPurchaseState, workOrderId: string, now = new Date().toISOString()) {
  const demands=data.demands.filter(d=>JSON.stringify([d.productionOrderId,d.techPackSnapshotId,d.routeEntryId])===workOrderId)
  if(!demands.length)throw new Error('加工单不存在。')
  const ids=new Set(demands.map(d=>d.id)),inputs=data.processingIssues.filter(i=>ids.has(i.demandId)&&!i.upstream),outputs=data.cutOutputs.filter(o=>ids.has(o.demandId))
  const packages=data.packages.filter(p=>ids.has(p.demandId)),packageIds=new Set(packages.map(p=>p.id))
  const objects=new Set([workOrderId,...ids,...inputs.map(i=>i.id),...inputs.flatMap(i=>i.mergedBatchId?[i.mergedBatchId]:[]),...outputs.map(o=>o.id),...packageIds])
  const events=data.operations.filter(op=>objects.has(op.objectId)).map(op=>({id:op.id,action:op.action,at:op.occurredAt,actor:op.actor.name,source:op.objectId===workOrderId?demands[0].productionOrderNo+' / '+demands[0].routeEntryId:op.objectId,reason:op.reason}))
  for(const input of inputs.filter(i=>i.printHandover)){
    const record=readCurrentPreparationHandoverRecord(input.printHandover!.recordId)
    for(const receipt of record?.taskReceipts?.filter(r=>r.targetTaskOrderId===input.id)??[]){
      // TMF接续实收由接收动作按Asia/Jakarta写入，转换时明确附加该时区。
      const at=zoned(receipt.receivedAt)?receipt.receivedAt:receipt.receivedAt.replace(' ','T')+'+07:00'
      events.push({id:receipt.receiptId,action:'印花回料实际接收',at,actor:receipt.receiverName,source:input.id,reason:`${receipt.qty} 米；原交出 ${input.printHandover!.recordId}`})
    }
  }
  events.sort((a,b)=>zoned(a.at)&&zoned(b.at)?Date.parse(a.at)-Date.parse(b.at):zoned(a.at)?-1:zoned(b.at)?1:a.at.localeCompare(b.at))
  const received=events.filter(e=>['织带厂加工投入实收','合并加工投入实收','印花回料实际接收'].includes(e.action)&&zoned(e.at)).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))
  const reported=[...outputs.map(o=>o.reportedAt),...data.tipResults.filter(t=>outputs.some(o=>o.id===t.cutOutputId)).map(t=>t.reportedAt)].filter(zoned).sort((a,b)=>Date.parse(a)-Date.parse(b))
  const execution=data.workExecutions.find(w=>w.workOrderId===workOrderId)
  const plan=data.workPlans.find(p=>p.workOrderId===workOrderId)
  const cost=data.workCosts.find(c=>c.workOrderId===workOrderId)
  const elapsedHours=received.length&&reported.length&&Date.parse(reported.at(-1)!)>=Date.parse(received[0].at)?(Date.parse(reported.at(-1)!)-Date.parse(received[0].at))/3600000:null
  return {plan,cost,execution,hasOutputs:outputs.length>0,actualDurationHours:execution?.startedAt?(Date.parse(execution.finishedAt??now)-Date.parse(execution.startedAt))/3600000:null,requiredDates:[...new Set(demands.map(d=>d.requiredDeliveryDate).filter((v):v is string=>!!v))],events,
    firstReceivedAt:received[0]?.at,firstReportedAt:reported[0],lastReportedAt:reported.at(-1),
    lastHandoverAt:events.filter(e=>e.action==='加工产出交回辅料仓').at(-1)?.at,
    lastWarehouseReceiptAt:events.filter(e=>e.action==='加工产出回仓实收').at(-1)?.at,
    elapsedHours,planFinishPassed:!!plan&&zoned(now)&&Date.parse(now)>Date.parse(plan.plannedFinishAt),
    plannedDurationHours:plan?(Date.parse(plan.plannedFinishAt)-Date.parse(plan.plannedStartAt))/3600000:null}
}
