// E2E-005/013: same draft additions, actual closure actor and local operation time.
import assert from 'node:assert/strict'
import * as prep from '../src/data/fcs/cutting/production-material-prep.ts'
import {handleFcsCuttingPrepEvent} from '../src/pages/fcs/material-prep/cutting.ts'
import {handleFcsSewingPrepEvent} from '../src/pages/fcs/material-prep/sewing.ts'
import {handleFcsOtherPrepEvent} from '../src/pages/fcs/material-prep/other.ts'
import {handleFcsDyeingPrepEvent} from '../src/pages/fcs/material-prep/dyeing.ts'
import {handleFcsPrintingPrepEvent} from '../src/pages/fcs/material-prep/printing.ts'
const memory=new Map<string,string>();const storage={getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v),removeItem:(k:string)=>memory.delete(k)}
const alerts:string[]=[];let prompts:(string|null)[]=[]
;(globalThis as any).window={localStorage:storage,alert:(s:string)=>alerts.push(s),prompt:()=>prompts.shift()??null,history:{replaceState(){}},location:{pathname:'/fcs/material-prep/cutting',search:''},dispatchEvent(){}}
;(globalThis as any).PopStateEvent=class {constructor(public type:string){}}
const cases=[['裁片配料',handleFcsCuttingPrepEvent],['车缝配料',handleFcsSewingPrepEvent],['其他配料',handleFcsOtherPrepEvent],['染色配料',handleFcsDyeingPrepEvent],['印花配料',handleFcsPrintingPrepEvent]] as const

const projection=prep.listMaterialPrepOrderProjections(storage).find(p=>!p.order.isClosed&&p.lines.some(l=>prep.classifyPrepLineType(l)==='裁片配料'&&l.maxPrepQty>5))!
const line=projection.lines.find(l=>prep.classifyPrepLineType(l)==='裁片配料'&&l.maxPrepQty>5)!
const base={prepOrderId:projection.order.prepOrderId,prepLineId:line.prepLineId,preparedQty:1,rollCount:0,operatorName:'原配料人',preparedAt:'2026-09-07 10:00',remark:'原备注',warehouseArea:'',locationCode:''}
const original=prep.appendManualPrepRecord(base,storage);let qty='0'
const fields:any={'[data-fcs-prep-operator]':{value:'Budi'},'[data-fcs-prep-time]':{value:'2026-09-07 15:53'},'[data-fcs-prep-remark]':{value:'第二次补充'}}
const row={dataset:{prepLineId:line.prepLineId},querySelector:(s:string)=>({value:s.includes('-qty')?qty:'0'})}
const form={querySelector:(s:string)=>fields[s],querySelectorAll:()=>[row]}
const button:any={dataset:{fcsMaterialPrepAction:'create-prep-record',prepOrderId:projection.order.prepOrderId,appendPrepRecordId:original.prepRecordId},closest:(s:string)=>s==='[data-fcs-prep-form]'?form:button}
const state=()=>JSON.stringify(prep.hydrateProductionMaterialPrepStore(storage).prepRecords);const before=state();handleFcsCuttingPrepEvent(button);assert.equal(state(),before)
qty=String(line.maxPrepQty+100);handleFcsCuttingPrepEvent(button);assert.equal(state(),before)
qty='2';handleFcsCuttingPrepEvent(button)
const rows=prep.hydrateProductionMaterialPrepStore(storage).prepRecords;assert.equal(rows.length,JSON.parse(before).length,'append same record, no new batch');const updated=rows.find(r=>r.prepRecordId===original.prepRecordId)!
assert.equal(updated.items?.length,1);assert.equal(updated.items?.[0].preparedQty,3);assert.equal(updated.items?.[0].prepRecordItemId,original.items?.[0].prepRecordItemId);assert.equal(updated.operatorName,'原配料人');assert.equal(updated.preparedAt,'2026-09-07 10:00');assert.match(updated.remark,/Budi/);assert.match(updated.remark,/第二次补充/);assert.match(updated.items![0].remark,/新增数量 2/)
prep.pickMaterialPrepRecord(original.prepRecordId,'Agus',storage);let snap=state();handleFcsCuttingPrepEvent(button);assert.equal(state(),snap,'picked cannot append');prep.stageMaterialPrepRecord(original.prepRecordId,'实际备料区','Siti',storage);prep.confirmMaterialPrepRecord(original.prepRecordId,'Dewi',storage);snap=state();handleFcsCuttingPrepEvent(button);assert.equal(state(),snap,'confirmed cannot append')
console.log('PASS current cutting handler same draftID/itemID 1+2=3; original person/time kept; additive audit;zero/excess/picked/confirmed no writes')
let reason='';(globalThis as any).document={querySelector:()=>({value:reason})}
for(const [category,handler] of cases){const p=prep.listMaterialPrepOrderProjections(storage).find(p=>!p.order.isClosed)!;const btn:any={dataset:{fcsMaterialPrepAction:'close-order',prepOrderId:p.order.prepOrderId},closest:(s:string)=>s==='[data-fcs-close-modal]'?{querySelector:()=>({value:reason})}:btn};const all=()=>JSON.stringify(prep.hydrateProductionMaterialPrepStore(storage));const before=all();reason='';handler(btn);assert.equal(all(),before);reason='实领结束，余量不再配';prompts=[null];handler(btn);assert.equal(all(),before,'cancel operator no close');prompts=[''];handler(btn);assert.equal(all(),before);prompts=['主管 Budi'];handler(btn);const closed=prep.hydrateProductionMaterialPrepStore(storage).closedOrders.find(r=>r.prepOrderId===p.order.prepOrderId)!;assert.equal(closed.closedBy,'主管 Budi');assert.equal(closed.closeReason,reason);assert(closed.closedAt);console.log(category,'close current handler reason/person/cancel PASS')}
const timeOrder=prep.listMaterialPrepOrderProjections(storage).find(p=>!p.order.isClosed&&p.lines.some(l=>l.maxPrepQty>2))!;const timeLine=timeOrder.lines.find(l=>l.maxPrepQty>2)!;const stamp=()=>{const d=new Date(),pad=(n:number)=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`};const start=stamp()
const timed=prep.appendManualPrepRecord({...base,prepOrderId:timeOrder.order.prepOrderId,prepLineId:timeLine.prepLineId,preparedAt:undefined},storage)
prep.pickMaterialPrepRecord(timed.prepRecordId,'Agus',storage);prep.stageMaterialPrepRecord(timed.prepRecordId,'实际暂存区','Siti',storage);prep.confirmMaterialPrepRecord(timed.prepRecordId,'Dewi',storage)
const actual=prep.hydrateProductionMaterialPrepStore(storage).prepRecords.find(r=>r.prepRecordId===timed.prepRecordId)!;const end=stamp();for(const time of [actual.preparedAt,actual.pickedAt,actual.stagedAt,actual.confirmedAt]) assert([start,end].includes(time!.slice(0,16)),`local current action timestamp ${time} must match ${start}/${end}`)
console.log('PASS local timezone',Intl.DateTimeFormat().resolvedOptions().timeZone,'create/pick/stage/confirm timestamps',actual.preparedAt,actual.confirmedAt)
