import test from 'node:test'
import assert from 'node:assert/strict'
import { centralSpecialWarehouseHistory, renderCentralSpecialWarehouseHistory } from '../../src/pages/central-pda/special-warehouse-history.ts'
import { centralWoolCraftContexts, centralWoolCraftReceiptRequest, centralWoolCraftActionRequest } from '../../src/pages/central-pda/wool-craft-model.ts'
import { centralWoolIncoming, centralWoolReceiptRequest } from '../../src/pages/central-pda/wool-model.ts'
import { centralUnit, centralSpecialQuantityRows, listCentralSpecialOrders } from '../../src/pages/central-pda/special-model.ts'
import { addWoolHandover, addWoolProcessReport } from '../../src/data/fcs/wool-domain/commands.ts'
import { executeWoolCraftAction } from '../../src/data/fcs/wool-domain/craft-flow.ts'
import { readWoolStore, replaceWoolStore } from '../../src/data/fcs/wool-domain/store.ts'
import { captureFactoryReceivingData, restoreFactoryReceivingData, getDefaultFactoryReceiptPosition } from '../../src/data/fcs/factory-receiving.ts'
import { confirmFactoryMaterialReceipt } from '../../src/data/fcs/factory-receiving-links.ts'
import { readFactoryPdaExecutionUsers } from '../../src/data/fcs/store-domain-pda.ts'
import { executeProcessAction, captureProcessActionRuntime, restoreProcessActionRuntime } from '../../src/data/fcs/process-action-writeback-service.ts'
import { captureSpecialCraftTaskStore, restoreSpecialCraftTaskStore } from '../../src/data/fcs/special-craft-task-orders.ts'
import { captureProcessWarehouseMutationState, restoreProcessWarehouseMutationState } from '../../src/data/fcs/process-warehouse-domain.ts'
const owner='OWN_WOOL_FACTORY',factory='FAC-APF',id='WOOL-STAGE-006:KNITTING',sku='CARDIGAN-CREAM-M',at='2026-10-22T10:00:00Z'
const actor=(f=factory)=>readFactoryPdaExecutionUsers(f).find(u=>u.roleId==='ROLE_ADMIN')!
function isolated(run:()=>void){const wool=readWoolStore(),receiving=captureFactoryReceivingData(),ordinary=captureSpecialCraftTaskStore(),actions=captureProcessActionRuntime(),warehouse=captureProcessWarehouseMutationState();try{run()}finally{restoreProcessWarehouseMutationState(warehouse);restoreProcessActionRuntime(actions);restoreSpecialCraftTaskStore(ordinary);restoreFactoryReceivingData(receiving);replaceWoolStore(wool)}}
function ready(){
 const row=centralWoolIncoming(owner).find(r=>r.line.woolOrderId===id)!
 confirmFactoryMaterialReceipt(centralWoolReceiptRequest(row,{kind:'YARN',grossKg:1.062,tubes:{PAPER:1,CONICAL:0,PAGODA:0},...getDefaultFactoryReceiptPosition(owner)},actor(owner),'WHH-YARN',at).input,actor(owner))
 addWoolProcessReport(id,{commandId:'WHH-REPORT',outputSkuCode:sku,reportedQty:5,reportedAt:at,reportedBy:actor(owner).name})
 const piece=readWoolStore().workOrders[id].externalPieces[0],h=addWoolHandover(id,{commandId:'WHH-HANDOUT',outputSkuCode:sku,pieceKey:piece.pieceKey,handoverQty:3,handedOverAt:at,handedOverBy:actor(owner).name})
 return centralWoolCraftContexts(factory).find(c=>c.task.taskOrderId===h.targetWorkOrderId)!
}
test('C02.06 factory craft warehouse joins actual ordinary and wool batch receipts, no double count or other craft',()=>isolated(()=>{
 const c=ready(),fresh=()=>centralWoolCraftContexts(factory).find(x=>x.task.taskOrderId===c.task.taskOrderId)!
 for(const [i,qty] of [1,2].entries()){const current=fresh(),r=centralWoolCraftReceiptRequest(current,current.incoming[0],qty,actor(),'WHH-RECEIVE-'+i,'2026-10-22 23:00:00');confirmFactoryMaterialReceipt(r.input,actor())}
 const ordinary=listCentralSpecialOrders(factory,c.task.operationId).find(o=>o.status==='待接收')!,q=centralSpecialQuantityRows(ordinary,'receive','zh')[0]
 executeProcessAction({sourceType:'SPECIAL_CRAFT',sourceId:ordinary.taskOrderId,taskId:ordinary.sourceTaskId,actionCode:'SPECIAL_CRAFT_CONFIRM_RECEIVE',sourceChannel:'Web 端',objectQty:2,qtyUnit:q.unit,objectType:ordinary.targetObject,confirmationKey:'WHH-ORDINARY',operatorName:actor().name,operatorUserId:actor().userId,operatedAt:at})
 const before=JSON.stringify([readWoolStore(),captureFactoryReceivingData(),captureProcessActionRuntime()])
 const rows=centralSpecialWarehouseHistory(factory,c.task.operationId,'receiveRecords','id')
 assert.equal(rows.filter(r=>r.orderNo===ordinary.taskOrderNo&&r.qty===2).length,1)
 assert.equal(rows[0].orderNo,c.task.taskOrderNo,'latest local-time wool receipt must precede earlier ISO ordinary receipt')
 const wool=rows.filter(r=>r.orderNo===c.task.taskOrderNo)
 assert.deepEqual(wool.map(r=>r.qty).sort(),[1,2]);assert.ok(wool.every(r=>r.unit==='片'&&r.actorId===actor().userId&&r.source))
 assert.equal(centralSpecialWarehouseHistory(factory,'WRONG','receiveRecords','id').length,0)
 assert.equal(centralSpecialWarehouseHistory('ID-F021',c.task.operationId,'receiveRecords','id').length,0)
 assert.equal(JSON.stringify([readWoolStore(),captureFactoryReceivingData(),captureProcessActionRuntime()]),before)
 const html=renderCentralSpecialWarehouseHistory(rows,factory,'receiveRecords','id',100)
 assert.match(html,/potong/);assert.match(html,/FAC-APF_admin/);assert.ok(!/[\u3400-\u9fff]/.test(html));assert.ok(!html.includes('data-central-action="save"'))
}))
test('C02.06 craft outgoing warehouse keeps unknown receipt distinct from zero, original target and batch responsibility',()=>isolated(()=>{
 const c=ready(),r=centralWoolCraftReceiptRequest(c,c.incoming[0],3,actor(),'WHH-ALL-RECEIVED',at);confirmFactoryMaterialReceipt(r.input,actor())
 let current=centralWoolCraftContexts(factory).find(x=>x.task.taskOrderId===c.task.taskOrderId)!
 executeWoolCraftAction(centralWoolCraftActionRequest(current,'work',3,actor(),'WHH-WORK',at).input)
 current=centralWoolCraftContexts(factory).find(x=>x.task.taskOrderId===c.task.taskOrderId)!
 executeWoolCraftAction(centralWoolCraftActionRequest(current,'handoff',2,actor(),'WHH-SEND',at).input)
 const rows=centralSpecialWarehouseHistory(factory,c.task.operationId,'handoffRecords','id'),sent=rows.find(r=>r.orderNo===c.task.taskOrderNo)!
 assert.equal(sent.qty,2);assert.equal(sent.actualQty,undefined);assert.equal(sent.actorName,actor().name);assert.ok(sent.target)
 const html=renderCentralSpecialWarehouseHistory([sent],factory,'handoffRecords','id',15)
 assert.match(html,/Menunggu penerima/);assert.ok(!html.includes('Diterima tujuan · 0'));assert.match(html,/2 potong/)
}))

test('C02.06 ordinary and wool history use the same Indonesian physical piece unit, keeping garments and yarn distinct',()=>{assert.equal(centralUnit('片','id'),'potong');assert.equal(centralUnit('件','id'),'pcs');assert.equal(centralUnit('kg','id'),'kg')})
