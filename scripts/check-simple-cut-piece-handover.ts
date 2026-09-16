import assert from 'node:assert/strict'
import { selectSimpleCutPieceTickets, assertSimpleCutPieceWarehouseActor } from '../src/data/fcs/cutting/simple-cut-piece-handover.ts'
import type { DispatchTaskSheetData } from '../src/data/fcs/dispatch-task-sheet.ts'
import type { GeneratedFeiTicketSourceRecord } from '../src/data/fcs/cutting/generated-fei-tickets.ts'
import { DEDICATED_CUTTING_FACTORY_ID } from '../src/data/fcs/factory-mock-data.ts'

const sheet = { assignment: { productionOrderId: 'PO-TEST', assignmentId: 'ASG-A', skuLines: [{ skuCode: 'SKU-M', color: '灰', size: 'M', qty: 100 }] } } as DispatchTaskSheetData
const requirements = ['FRONT','BACK','LEFT','RIGHT'].map(partCode => ({ skuCode: 'SKU-M', color: '灰', size: 'M', partCode, partName:partCode,piecesPerGarment:1,allocatedGarmentQty:100 }))
function ticket(part: string, overrides: Partial<GeneratedFeiTicketSourceRecord> = {}): GeneratedFeiTicketSourceRecord {
  return {feiTicketId:`ID-${part}`,feiTicketNo:`FEI-${part}`,productionOrderId:'PO-TEST',skuCode:'SKU-M',skuColor:'灰',skuSize:'M',partCode:part,partName:part,sourceBasisType:'ACTUAL_CUTTING_OUTPUT',sourceOutputLineId:`OUT-${part}`,actualCutPieceQty:100,printStatus:'WAIT_PRINT',pieceSetNoRange:'1–100',cutOrderId:'CUT',cutOrderNo:'CUT',...overrides} as GeneratedFeiTicketSourceRecord
}
const input = {sheet, requirements, tickets:['FRONT','BACK','LEFT'].map(part=>ticket(part)),handedOver:new Map<string,number>(),consumedIds:new Set<string>(),occupiedIds:new Set<string>(),unavailableReasons:new Map<string,string>(),ambiguousSkuCodes:new Set<string>(),legacyQuantityWithoutTickets:false}
let result = selectSimpleCutPieceTickets(input)
assert.equal(result.tickets.length,3,'首批三部位已裁，缺右袖不能伪造票')
assert.equal(result.tickets.reduce((sum,t)=>sum+t.pieceQty,0),300)
assert.equal(result.excluded.length,0,'未打印的真实已裁菲票可以交出')
result=selectSimpleCutPieceTickets({...input,tickets:[...input.tickets,ticket('OTHER',{skuCode:'SKU-L',skuSize:'L'})]})
assert.equal(result.tickets.length,3,'另一工厂SKU不能混入')
assert.match(result.excluded[0].reason,/不属于/)
assert.equal(selectSimpleCutPieceTickets({...input,consumedIds:new Set(['ID-FRONT'])}).tickets.length,2,'旧新交出已经消费的票不再交出')
assert.equal(selectSimpleCutPieceTickets({...input,occupiedIds:new Set(['ID-BACK'])}).tickets.length,2,'袋占用不重复消耗')
assert.equal(selectSimpleCutPieceTickets({...input,unavailableReasons:new Map([['ID-LEFT','特殊工艺未回仓']])}).tickets.length,2)
assert.equal(selectSimpleCutPieceTickets({...input,ambiguousSkuCodes:new Set(['SKU-M'])}).tickets.length,0,'同SKU多个任务没有范围事实不能猜分配')
assert.equal(selectSimpleCutPieceTickets({...input,legacyQuantityWithoutTickets:true}).tickets.length,0,'旧手填实交不能当作未领')
assert.equal(selectSimpleCutPieceTickets({...input,tickets:[ticket('FRONT',{printStatus:'VOIDED'})]}).tickets.length,0)
assert.equal(selectSimpleCutPieceTickets({...input,tickets:[ticket('FRONT',{sourceBasisType:'MANUAL_MARKER_PLAN'})]}).tickets.length,0,'手工建票不等于实际已裁')
for (const qty of [0,-1,1.5,NaN,120]) assert.equal(selectSimpleCutPieceTickets({...input,tickets:[ticket('FRONT',{actualCutPieceQty:qty})]}).tickets.length,0)
const handedOver=new Map(input.tickets.map(t=>[[t.skuCode,'灰','M',t.partCode].join('::'),100] as [string,number]))
result=selectSimpleCutPieceTickets({...input,handedOver,tickets:[...input.tickets,ticket('RIGHT')],consumedIds:new Set(input.tickets.map(t=>t.feiTicketId))})
assert.deepEqual(result.tickets.map(t=>t.partCode),['RIGHT'],'第二批只能领新增右袖，累计不超400')
assert.equal(selectSimpleCutPieceTickets({...input,handedOver:new Map([['SKU-M::灰::M::FRONT',60]]),tickets:[ticket('FRONT',{actualCutPieceQty:50})]}).tickets.length,0,'不能把50片票静默截成剩余40片')
assert.doesNotThrow(()=>assertSimpleCutPieceWarehouseActor({factoryId:DEDICATED_CUTTING_FACTORY_ID,operatorId:'W1',operatorName:'仓管',operatorRole:'WAREHOUSE',source:'WEB'}))
for (const overrides of [{factoryId:'ID-F021'},{operatorRole:'PPIC'},{operatorName:''}]) assert.throws(()=>assertSimpleCutPieceWarehouseActor({factoryId:DEDICATED_CUTTING_FACTORY_ID,operatorId:'W1',operatorName:'仓管',operatorRole:'WAREHOUSE',source:'PDA',...overrides}))
console.log('simple cut-piece selection: normal, second batch, quantities, provenance, identity, occupancy and actor checks passed')
