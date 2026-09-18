import assert from 'node:assert/strict'
import { productionOrders } from '../src/data/fcs/production-orders.ts'
import { getProductionOrderTechPackSnapshot } from '../src/data/fcs/production-order-tech-pack-runtime.ts'
import { getSpecialCraftOperationByCraftCode, listEnabledSpecialCraftOperationDefinitions } from '../src/data/fcs/special-craft-operations.ts'
import { generateSpecialCraftTaskOrdersFromProductionOrder } from '../src/data/fcs/special-craft-task-generation.ts'
import { extractWoolPieceSources } from '../src/data/fcs/wool-domain/piece-source.ts'
const order=structuredClone(productionOrders.find(o=>getProductionOrderTechPackSnapshot(o.productionOrderId)?.patternFiles.some(p=>p.recordKind!=='MATERIAL_ASSOCIATION'&&p.pieceRows.some(r=>r.specialCrafts?.some(c=>getSpecialCraftOperationByCraftCode(c.craftCode))))))!
const snapshot=structuredClone(getProductionOrderTechPackSnapshot(order.productionOrderId))!
const pattern=snapshot.patternFiles.find(p=>p.recordKind!=='MATERIAL_ASSOCIATION'&&p.pieceRows.some(r=>r.specialCrafts?.some(c=>getSpecialCraftOperationByCraftCode(c.craftCode))))!
const row=pattern.pieceRows.find(r=>r.specialCrafts?.some(c=>getSpecialCraftOperationByCraftCode(c.craftCode)))!,craft=row.specialCrafts!.find(c=>getSpecialCraftOperationByCraftCode(c.craftCode))!,op=getSpecialCraftOperationByCraftCode(craft.craftCode)!
const sku=order.demandSnapshot.skuLines[0];sku.qty=10;order.demandSnapshot.skuLines=[sku]
pattern.patternMaterialType='WOOL';pattern.patternMaterialTypeLabel='毛织';pattern.linkedBomItemId='AUDIT-YARN';pattern.selectedSizeCodes=[sku.size];pattern.pieceRows=[{...row,specialCrafts:[{...craft,selectedTargetObject:'已裁部位'}],colorAllocations:[{colorName:sku.color,skuCodes:[sku.skuCode],pieceCount:1}]}]
pattern.pieceInstances=[{pieceInstanceId:'AUDIT-Q1',sourcePieceId:row.id,pieceName:row.name,sizeName:sku.size,colorId:sku.color,colorName:sku.color,sequenceNo:1,displayName:'审查第1片',status:'已配置',specialCraftAssignments:[{assignmentId:'AUDIT-ASSIGN',craftCode:craft.craftCode,craftName:craft.craftName,craftCategory:'SPECIAL',targetObject:'CUT_PIECE_PART',craftPosition:'FACE',craftPositionName:'面',remark:''}]}]
snapshot.patternFiles=[pattern]
snapshot.bomItems=[{...snapshot.bomItems[0],id:'AUDIT-YARN',type:'纱线',usageProcessCodes:['PROC_WOOL'],linkedPatternIds:[pattern.id]}]
snapshot.colorMaterialMappings=[{id:'AUDIT-MAP',colorCode:sku.color,colorName:sku.color,mappingOrigin:'TECH_PACK',status:'CONFIRMED',lines:[{id:'AUDIT-MAP-L',bomItemId:'AUDIT-YARN',patternId:pattern.id,applicableSkuCodes:[sku.skuCode]}]}] as any
snapshot.processEntries=[{...snapshot.processEntries.find(e=>e.processCode==='SPECIAL_CRAFT')!,id:'AUDIT-WOOL-CRAFT',craftCode:craft.craftCode,craftName:craft.craftName,processCode:'SPECIAL_CRAFT',selectedTargetObject:'已裁部位',linkedPatternIds:[pattern.id],routeObjectKey:`PATTERN:${pattern.id}:PIECE:${row.id}`,predecessorEntryIds:[],inputObjectType:'KNITTED_PANEL',outputObjectType:'KNITTED_PANEL',routeSourceKind:'PIECE_CRAFT',targetObject:'CUT_PIECE_PART'}]

// ROUTE-006 / CODE-002: the same wool pattern must have only the WSC execution lane.
const generic=generateSpecialCraftTaskOrdersFromProductionOrder({productionOrder:order,techPackSnapshot:snapshot,specialCraftOperations:[op]})
const pieces=extractWoolPieceSources({snapshot,sourceTaskId:'AUDIT-WOOL-TASK',scopeSkuLines:[sku]})
assert.deepEqual(generic.errors,[]);assert.equal(generic.taskOrders.length,0)
assert.deepEqual(pieces.issues,[]);assert.equal(pieces.pieces.length,1);assert.equal(pieces.pieces[0].routeNodes[0].sourceEntryId,'AUDIT-WOOL-CRAFT')
console.log('✓ 毛织逐片需求只有 WSC 链；旧工艺生成器不再生成同源加工单')
const fabricSnapshot=structuredClone(snapshot);fabricSnapshot.patternFiles[0].patternMaterialType='FABRIC'
const fabric=generateSpecialCraftTaskOrdersFromProductionOrder({productionOrder:order,techPackSnapshot:fabricSnapshot,specialCraftOperations:[op]})
assert.deepEqual(fabric.errors,[]);assert.equal(fabric.taskOrders.length,1)
console.log('✓ 普通布料裁片工艺生成保持')
const garmentOp=listEnabledSpecialCraftOperationDefinitions().find(op=>op.craftName==='烫画')!
const garmentSnapshot=structuredClone(snapshot)
garmentSnapshot.bomItems.push({...snapshot.bomItems[0],id:'AUDIT-GARMENT',type:'成衣',applicableSkuCodes:[sku.skuCode]})
garmentSnapshot.processEntries.push({...snapshot.processEntries[0],id:'AUDIT-LINKING-AFTER',craftCode:garmentOp.craftCode,craftName:garmentOp.craftName,selectedTargetObject:'成衣',targetObject:'GARMENT_SEMI',inputObjectType:'GARMENT',outputObjectType:'GARMENT',linkedBomItemIds:['AUDIT-GARMENT'],routeObjectKey:'BOM:AUDIT-GARMENT'})
const garment=generateSpecialCraftTaskOrdersFromProductionOrder({productionOrder:order,techPackSnapshot:garmentSnapshot})
assert.deepEqual(garment.errors,[]);assert.equal(garment.taskOrders.length,1);assert.equal(garment.taskOrders[0].sourceEntryId,'AUDIT-LINKING-AFTER')
console.log('✓ 缝盘后的成衣工艺仍正常生成')

const craftStore=await import('../src/data/fcs/special-craft-task-orders.ts')
const warehouse=await import('../src/data/fcs/factory-internal-warehouse.ts')
const processWarehouse=await import('../src/data/fcs/process-warehouse-domain.ts')
const original=craftStore.captureSpecialCraftTaskStore(),factoryBefore=warehouse.createFactoryInternalWarehouseMutationSnapshot(),processBefore=processWarehouse.captureProcessWarehouseMutationState()
const actualOrder=productionOrders.find(o=>o.productionOrderId===order.productionOrderId)!,originalSnapshot=actualOrder.techPackSnapshot
const oldTask={...structuredClone(fabric.taskOrders[0]),taskOrderId:'AUDIT-RETIRED-WOOL',taskOrderNo:'AUDIT-RETIRED-WOOL',generationBatchId:'AUDIT-BATCH'}
const retained=structuredClone(original.taskOrders.find(t=>t.productionOrderId!==order.productionOrderId)!)
assert.ok(retained)
const marker=(id:string)=>`${id}-${oldTask.taskOrderId}`
try {
 actualOrder.techPackSnapshot=garmentSnapshot
 const f=structuredClone(factoryBefore)
 f.inboundRecords.push({...f.inboundRecords[0],inboundRecordId:marker('SC-INB')})
 f.outboundRecords.push({...f.outboundRecords[0],outboundRecordId:marker('SC-OUT')})
 f.waitProcessStockItems.push({...f.waitProcessStockItems[0],stockItemId:marker('SC-WPS')})
 f.waitHandoverStockItems.push({...f.waitHandoverStockItems[0],stockItemId:marker('SC-WHS')})
 warehouse.restoreFactoryInternalWarehouseMutationSnapshot(f)
 const p=structuredClone(processBefore)
 for(const key of ['warehouseRecords','handoverRecords','differenceRecords','reviewRecords'] as const){
  assert.ok(p[key].length);(p[key] as Array<any>).push({...p[key][0],sourceTaskOrderId:oldTask.taskOrderId})
 }
 processWarehouse.restoreProcessWarehouseMutationState(p)
 craftStore.restoreSpecialCraftTaskStore({taskOrders:[oldTask,retained,garment.taskOrders[0]],generationBatches:[{...fabric.generationBatch,generationBatchId:'AUDIT-BATCH',generatedTaskOrderIds:[oldTask.taskOrderId]}],generationErrors:[]})
 const current=craftStore.captureSpecialCraftTaskStore()
 assert.ok(!current.taskOrders.some(t=>t.taskOrderId===oldTask.taskOrderId));assert.ok(!current.generationBatches.some(b=>b.generatedTaskOrderIds.includes(oldTask.taskOrderId)))
 assert.equal(craftStore.getSpecialCraftTaskOrderById(oldTask.taskOrderId),undefined)
 assert.ok(current.taskOrders.some(t=>t.taskOrderId===retained.taskOrderId));assert.ok(current.taskOrders.some(t=>t.sourceEntryId==='AUDIT-LINKING-AFTER'))
 const cleaned=warehouse.createFactoryInternalWarehouseMutationSnapshot()
 assert.ok(!cleaned.inboundRecords.some(r=>r.inboundRecordId===marker('SC-INB')));assert.ok(!cleaned.outboundRecords.some(r=>r.outboundRecordId===marker('SC-OUT')))
 assert.ok(!cleaned.waitProcessStockItems.some(r=>r.stockItemId===marker('SC-WPS')));assert.ok(!cleaned.waitHandoverStockItems.some(r=>r.stockItemId===marker('SC-WHS')))
 for(const rows of Object.values(processWarehouse.captureProcessWarehouseMutationState()))assert.ok(!rows.some(r=>r.sourceTaskOrderId===oldTask.taskOrderId))
 console.log('✓ 旧同源工艺单、批次引用、两套仓储及差异复核实际移除；非毛织与成衣单保留')
 processWarehouse.restoreProcessWarehouseMutationState(p)
 for(const rows of Object.values(processWarehouse.captureProcessWarehouseMutationState()))assert.ok(!rows.some(r=>r.sourceTaskOrderId===oldTask.taskOrderId))
 assert.throws(()=>processWarehouse.createWaitProcessWarehouseRecord({sourceTaskOrderId:oldTask.taskOrderId} as any),/旧毛织/)
 assert.throws(()=>processWarehouse.createProcessHandoverRecord({sourceTaskOrderId:oldTask.taskOrderId} as any),/旧毛织/)
 console.log('✓ 恢复旧快照及旧写入口不能复活旧工艺库存或交出')
} finally {
 actualOrder.techPackSnapshot=originalSnapshot
 craftStore.resetSpecialCraftTaskStore();craftStore.restoreSpecialCraftTaskStore(original)
 warehouse.restoreFactoryInternalWarehouseMutationSnapshot(factoryBefore);processWarehouse.restoreProcessWarehouseMutationState(processBefore)
}
console.log('PASS 5 wool craft generation boundary checks')
