import {getPdaSession,setPdaSession,createPdaSessionFromUser,listFactoryPdaUsers} from '../src/data/fcs/store-domain-pda.ts'
import { shouldGenerateInternalCraftOrderForProductionOrder } from '../src/data/fcs/task-generation-boundaries.ts'
import assert from 'node:assert/strict'
import { productionOrders } from '../src/data/fcs/production-orders.ts'
import { getProductionOrderTechPackSnapshot } from '../src/data/fcs/production-order-tech-pack-runtime.ts'
import { listEnabledSpecialCraftOperationDefinitions } from '../src/data/fcs/special-craft-operations.ts'
import { generateSpecialCraftTaskOrdersFromProductionOrder } from '../src/data/fcs/special-craft-task-generation.ts'
import { captureSpecialCraftTaskStore, restoreSpecialCraftTaskStore, getSpecialCraftTaskOrderById, updateSpecialCraftTaskOrderWebStatus, listSpecialCraftTaskOrders } from '../src/data/fcs/special-craft-task-orders.ts'
import { createFactoryInternalWarehouseMutationSnapshot, restoreFactoryInternalWarehouseMutationSnapshot } from '../src/data/fcs/factory-internal-warehouse.ts'
import { captureProcessWarehouseMutationState, restoreProcessWarehouseMutationState, listWaitProcessWarehouseRecords } from '../src/data/fcs/process-warehouse-domain.ts'
import { readWoolStore, replaceWoolStore } from '../src/data/fcs/wool-domain/store.ts'
import { buildWoolFactWorkflowMockStore } from '../src/data/fcs/wool-domain/mock-data.ts'
import { listWoolPanelCuttingReceiptSources } from '../src/data/fcs/wool-domain/cutting-receipts.ts'
import { listAvailableFeiTicketsForSewingDispatch } from '../src/data/fcs/cutting/sewing-dispatch.ts'
import { addWoolHandover, confirmWoolDownstreamReceipt } from '../src/data/fcs/wool-domain/commands.ts'
import { executeProcessWebAction } from '../src/data/fcs/process-web-status-actions.ts'
import { executeSpecialCraftAction } from '../src/data/fcs/process-action-writeback-service.ts'
import { confirmWoolFinalCraftBatches } from '../src/data/fcs/wool-domain/final-craft.ts'
const sessionBefore=getPdaSession();const woolBefore=readWoolStore(),craftBefore=captureSpecialCraftTaskStore(),factoryBefore=createFactoryInternalWarehouseMutationSnapshot(),processBefore=captureProcessWarehouseMutationState()
const order=productionOrders.find(o=>shouldGenerateInternalCraftOrderForProductionOrder(o)&&getProductionOrderTechPackSnapshot(o.productionOrderId)?.bomItems.length)!, priorSnapshot=order.techPackSnapshot
const snapshot=structuredClone(getProductionOrderTechPackSnapshot(order.productionOrderId))!,sku=order.demandSnapshot.skuLines[0],at='2026-09-18 18:00:00'
const op=listEnabledSpecialCraftOperationDefinitions().find(o=>o.craftName==='烫画')!
const woolEntry={...snapshot.processEntries[0],id:'FINAL-WOOL',processCode:'PROC_WOOL',craftCode:undefined,craftName:undefined,predecessorEntryIds:[]}
const garmentEntry={...snapshot.processEntries[0],id:'FINAL-GARMENT',processCode:'SPECIAL_CRAFT',craftCode:op.craftCode,craftName:op.craftName,selectedTargetObject:'成衣',targetObject:'GARMENT_SEMI',inputObjectType:'GARMENT',outputObjectType:'GARMENT',linkedPatternIds:[],linkedBomItemIds:['FINAL-GARMENT-BOM'],routeObjectKey:'BOM:FINAL-GARMENT-BOM',predecessorEntryIds:['FINAL-WOOL']}
snapshot.patternFiles=[];snapshot.bomItems=[{...snapshot.bomItems[0],id:'FINAL-GARMENT-BOM',type:'成衣',applicableSkuCodes:[sku.skuCode]}];snapshot.processEntries=[woolEntry,garmentEntry] as any
const generated=generateSpecialCraftTaskOrdersFromProductionOrder({productionOrder:{...order,demandSnapshot:{...order.demandSnapshot,skuLines:[{...sku,qty:10}]}},techPackSnapshot:snapshot})
assert.deepEqual(generated.errors,[]);assert.equal(generated.taskOrders.length,1)
const task={...generated.taskOrders[0],factoryId:'FAC-APF',factoryName:'APF - 辅助工艺',assignedFactoryId:'FAC-APF',assignmentStatus:'ASSIGNED' as const,sourceTaskId:'AUDIT-FINAL-TASK',sourceTaskNo:'AUDIT-FINAL-TASK',status:'待接收' as const}
let checks=0
try {
 const seed=buildWoolFactWorkflowMockStore();seed.craftRecords=[];seed.pieceReceipts=[];seed.handovers=seed.handovers.filter(h=>h.automatic);seed.warehouseFlows=seed.warehouseFlows.filter(f=>!f.pieceKey && f.unit!=='片')
 // Existing part output: only the enabled actual receiving factory may consume it.
 replaceWoolStore(seed)
 const part=readWoolStore().workOrders['WOOL-STAGE-004:LINKING']
 const hand=addWoolHandover(part.woolOrderId,{commandId:'final-cut',outputSkuCode:part.outputPlanLines[0].outputSkuCode,handoverQty:8,handedOverAt:at,handedOverBy:'验收'})
 confirmWoolDownstreamReceipt(hand.handoverId,{commandId:'final-cut-r',actualReceivedQty:8,receivedAt:at,receivedBy:'裁厂'})
 assert.equal(listWoolPanelCuttingReceiptSources('ID-F004').find(r=>r.sourceOutputLineId===hand.handoverId)?.receivingFactoryId,'ID-F004')
 assert.equal(listWoolPanelCuttingReceiptSources('OWN-CUTTING-001').length,0)
 let current=readWoolStore();current.handovers.find(h=>h.handoverId===hand.handoverId)!.receiverId='FIW-OWN-CUTTING-001-WAIT_HANDOVER';replaceWoolStore(current)
 assert.ok(!listAvailableFeiTicketsForSewingDispatch({productionOrderId:part.productionOrderId}).some(r=>r.sourceOutputLineId===hand.handoverId))
 assert.ok(listAvailableFeiTicketsForSewingDispatch({productionOrderId:part.productionOrderId,cuttingFactoryId:'OWN-CUTTING-001'}).some(r=>r.sourceOutputLineId===hand.handoverId))
 current=readWoolStore();current.handovers.find(h=>h.handoverId===hand.handoverId)!.receiverId='FIW-NOT-EXISTS';replaceWoolStore(current)
 assert.ok(!listWoolPanelCuttingReceiptSources().some(r=>r.sourceOutputLineId===hand.handoverId));checks++;console.log('PASS FLOW005 实际裁厂隔离、未知接收仓阻断、按件来源')
 // Bind an ordinary garment craft to the wool route, not to the piece-return route.
 order.techPackSnapshot=snapshot
 current=readWoolStore(); const knit=current.workOrders['WOOL-STAGE-003:KNITTING'],link=current.workOrders['WOOL-STAGE-003:LINKING'],oldSku=link.outputPlanLines[0].outputSkuCode
 for(const o of [knit,link]) {o.productionOrderId=order.productionOrderId;o.productionOrderNo=order.productionOrderNo;o.sourceEntryId='FINAL-WOOL';o.outputPlanLines[0].outputSkuCode=sku.skuCode;o.outputPlanLines[0].garmentSkuCode=sku.skuCode;o.downstreamTarget={receiverType:'DOWNSTREAM_FACTORY',receiverId:'FAC-APF',receiverName:task.factoryName}}
 for(const key of ['processReports','handovers','internalReceipts','warehouseFlows'] as const) for(const r of current[key] as any[]) if([knit.woolOrderId,link.woolOrderId].includes(r.woolOrderId)) {if(r.outputSkuCode===oldSku)r.outputSkuCode=sku.skuCode;if(r.objectSkuCode===oldSku)r.objectSkuCode=sku.skuCode}
 replaceWoolStore(current);restoreSpecialCraftTaskStore({taskOrders:[task],generationBatches:[],generationErrors:[]})
 let t=getSpecialCraftTaskOrderById(task.taskOrderId)!;assert.ok(t.woolFinalInputOrderIds?.includes(link.woolOrderId));assert.equal(t.receivedQty,0)
 assert.throws(()=>updateSpecialCraftTaskOrderWebStatus(t.taskOrderId,{status:'加工中',receivedQty:10}),/实际交出批次/)
 const h1=addWoolHandover(link.woolOrderId,{commandId:'final-craft-1',outputSkuCode:sku.skuCode,handoverQty:12,handedOverAt:at,handedOverBy:'毛织厂'})
 const h2=addWoolHandover(link.woolOrderId,{commandId:'final-craft-2',outputSkuCode:sku.skuCode,handoverQty:8,handedOverAt:at,handedOverBy:'毛织厂'})
 t=getSpecialCraftTaskOrderById(t.taskOrderId)!;assert.equal(t.receivedQty,0);assert.equal(t.woolFinalReceipts?.length,2)
 const receive={sourceType:'SPECIAL_CRAFT' as const,sourceId:t.taskOrderId,actionCode:'SPECIAL_CRAFT_CONFIRM_RECEIVE',operatorName:'工艺仓管',operatedAt:at,objectQty:12,qtyUnit:'件',woolFinalReceipts:[{handoverId:h1.handoverId,actualReceivedQty:12}],confirmationKey:'final-craft-receive-1'}
 executeProcessWebAction(receive);executeProcessWebAction(receive)
 assert.throws(()=>executeProcessWebAction({...receive,objectQty:1,woolFinalReceipts:[{handoverId:h1.handoverId,actualReceivedQty:1}]}),/不同的接收/)
 t=getSpecialCraftTaskOrderById(t.taskOrderId)!;assert.equal(t.receivedQty,12);assert.equal(t.lineProgress?.[0].receivedQty,12);assert.equal(readWoolStore().handovers.find(h=>h.handoverId===h1.handoverId)?.downstreamReceipt?.actualReceivedQty,12)
 const stock=createFactoryInternalWarehouseMutationSnapshot().waitProcessStockItems.filter(r=>r.stockItemId===`SC-WPS-${t.taskOrderId}`);assert.equal(stock.length,1);assert.equal(stock[0].receivedQty,12)
 assert.equal(t.woolFinalReceipts?.find(h=>h.handoverId===h2.handoverId)?.receivedQty,undefined);checks++;console.log('PASS FLOW006 真实批次可在工艺 Web 接收，超计划但未超交出合法，同一次确认不重复')
 const before=JSON.stringify(readWoolStore())
 assert.throws(()=>confirmWoolDownstreamReceipt(h2.handoverId,{commandId:'direct-over-final',actualReceivedQty:9,receivedAt:at,receivedBy:'PDA收货'}),/实收不能超过交出件数/)
 assert.throws(()=>executeProcessWebAction({...receive,confirmationKey:'tampered-total',objectQty:1,woolFinalReceipts:[{handoverId:h2.handoverId,actualReceivedQty:8}]}),/合计/)
 assert.throws(()=>confirmWoolFinalCraftBatches(t,{receipts:[{handoverId:h2.handoverId,actualReceivedQty:9}],operatorName:'工艺仓管',operatedAt:at,sourceChannel:'Web 端'}),/不得超过/)
 assert.throws(()=>confirmWoolFinalCraftBatches(t,{receipts:[{handoverId:h1.handoverId,actualReceivedQty:11}],operatorName:'工艺仓管',operatedAt:at,sourceChannel:'Web 端'}),/重复/)
 assert.throws(()=>confirmWoolFinalCraftBatches(t,{receipts:[{handoverId:'no-source',actualReceivedQty:1}],operatorName:'工艺仓管',operatedAt:at,sourceChannel:'Web 端'}),/实际交出/)
 assert.equal(JSON.stringify(readWoolStore()),before)
 assert.throws(()=>executeSpecialCraftAction({sourceChannel:'Web 端',sourceType:'SPECIAL_CRAFT',sourceId:t.taskOrderId,actionCode:'SPECIAL_CRAFT_CONFIRM_RECEIVE',objectQty:1,skuQtyBySkuCode:{[sku.skuCode]:1},operatorName:'工艺仓管',operatedAt:at}),/实际交出批次/)
 checks++;console.log('PASS FLOW006 超交出、变更重试、伪来源、旧逐SKU直接接收均阻断且不留半数据')
 executeProcessWebAction({...receive,actionCode:'SPECIAL_CRAFT_PROCESS_REPORT',objectQty:5,woolFinalReceipts:undefined,skuQtyBySkuCode:{[sku.skuCode]:5},confirmationKey:'final-report'})
 t=getSpecialCraftTaskOrderById(t.taskOrderId)!;assert.equal(t.completedQty,5);assert.equal(t.receivedQty,12);const wh=createFactoryInternalWarehouseMutationSnapshot();assert.equal(wh.waitProcessStockItems.find(r=>r.stockItemId===`SC-WPS-${t.taskOrderId}`)?.availableQty,7);assert.equal(wh.waitHandoverStockItems.find(r=>r.stockItemId===`SC-WHS-${t.taskOrderId}`)?.waitHandoverQty,5)
 assert.ok(!wh.outboundRecords.some(r=>r.outboundRecordId===`SC-OUT-${t.taskOrderId}`));assert.equal(listWaitProcessWarehouseRecords({sourceTaskOrderId:t.taskOrderId})[0]?.availableObjectQty,7);checks++;console.log('PASS 实收→加工守恒：12 实收 = 7 待加工 + 5 待交出，未交出不造出库')
 // An actual PDA handover confirmation must update the existing Web and both warehouse views.
 confirmWoolDownstreamReceipt(h2.handoverId,{commandId:'pda-final-receipt',actualReceivedQty:8,receivedAt:at,receivedBy:'PDA工艺仓管'})
 t=getSpecialCraftTaskOrderById(t.taskOrderId)!;assert.equal(t.receivedQty,20);assert.equal(t.completedQty,5)
 assert.equal(createFactoryInternalWarehouseMutationSnapshot().waitProcessStockItems.find(r=>r.stockItemId===`SC-WPS-${t.taskOrderId}`)?.availableQty,15)
 assert.equal(listWaitProcessWarehouseRecords({sourceTaskOrderId:t.taskOrderId})[0]?.availableObjectQty,15)
 checks++;console.log('PASS 同一最终实收事实回读 Web 和两类仓储；20 实收 = 15 待加工 + 5 待交出')
 // Receiver factory, explicit route node, and payload identity are isolated.
 const state=readWoolStore(), pending=state.handovers.find(h=>h.handoverId===h2.handoverId)!
 pending.receiverId='F090';replaceWoolStore(state);assert.ok(!getSpecialCraftTaskOrderById(t.taskOrderId)!.woolFinalReceipts?.some(r=>r.handoverId===h2.handoverId))
 pending.receiverId='FAC-APF';pending.routeNodeId='OTHER-NODE';replaceWoolStore(state);assert.ok(!getSpecialCraftTaskOrderById(t.taskOrderId)!.woolFinalReceipts?.some(r=>r.handoverId===h2.handoverId))
 pending.routeNodeId=undefined;replaceWoolStore(state);t=getSpecialCraftTaskOrderById(t.taskOrderId)!
 setPdaSession(createPdaSessionFromUser(listFactoryPdaUsers('F090')[0]!))
 assert.throws(()=>confirmWoolFinalCraftBatches(t,{receipts:[{handoverId:h2.handoverId,actualReceivedQty:8}],operatorName:'错误厂',operatedAt:at,sourceChannel:'移动端'}),/当前登录工厂/);setPdaSession(sessionBefore)
 checks++;console.log('PASS 错厂会话、错目标厂及错路线节点不能接收本批成衣')
 // Same factory with two next garment nodes must not multiply a receiver-only handover.
 snapshot.processEntries.push({...garmentEntry,id:'FINAL-GARMENT-OTHER'} as any)
 restoreSpecialCraftTaskStore({taskOrders:[t,{...structuredClone(task),taskOrderId:'OTHER-NODE-TASK',sourceEntryId:'FINAL-GARMENT-OTHER'}],generationBatches:[],generationErrors:[]})
 assert.equal(getSpecialCraftTaskOrderById(t.taskOrderId)!.woolFinalReceipts?.length,0)
 assert.equal(getSpecialCraftTaskOrderById('OTHER-NODE-TASK')!.woolFinalReceipts?.length,0)
 const specified=readWoolStore();specified.handovers.find(h=>h.handoverId===h2.handoverId)!.routeNodeId='FINAL-GARMENT';replaceWoolStore(specified)
 assert.ok(getSpecialCraftTaskOrderById(t.taskOrderId)!.woolFinalReceipts?.some(r=>r.handoverId===h2.handoverId));assert.equal(getSpecialCraftTaskOrderById('OTHER-NODE-TASK')!.woolFinalReceipts?.length,0)
 checks++;console.log('PASS 同厂多后继节点不重复认领；明确节点才得到其批次')
 console.log(`${checks} final downstream contracts passed`)
} finally {setPdaSession(sessionBefore);order.techPackSnapshot=priorSnapshot;replaceWoolStore(woolBefore);restoreSpecialCraftTaskStore(craftBefore);restoreFactoryInternalWarehouseMutationSnapshot(factoryBefore);restoreProcessWarehouseMutationState(processBefore)}
