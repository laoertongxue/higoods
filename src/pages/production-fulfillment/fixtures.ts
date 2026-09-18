import data from './mock-data.json'
import type { PFStage, PFTask, ShipmentOrderFact } from './model'
export { catalog } from './catalog'

/** One frozen mock snapshot for every view. These are demonstration facts, never live business records. */
export const snapshot: string = data.clock
export const tasks: PFTask[] = (data.tasks as PFTask[]).map(source=>{ const merged=data.mergedProductionOrders as Record<string,{follower:string;sourceTaskIds:string[]}>;const task={...source,baselineRuleVersion:source.ruleVersion,baselineStandardDays:source.standardDays,mergedProductionFollower:source.productionOrderNos.map(id=>merged[id]?.follower).find(Boolean)}; const lines=task.quantityLines??[]; if(!lines.length)return task; const effectiveQty=lines.reduce((s,l)=>s+l.effectiveQty,0), shippedQty=lines.reduce((s,l)=>s+Math.min(l.effectiveQty,l.shippedQty),0); return {...task,effectiveQty,shippedQty,remainingQty:lines.reduce((s,l)=>s+Math.max(0,l.effectiveQty-l.shippedQty),0),progressPct:effectiveQty?Math.round(shippedQty/effectiveQty*10000)/100:null} })
export const orders: ShipmentOrderFact[] = data.shipmentOrderFacts
export const stages: PFStage[] = data.stages
