import assert from 'node:assert/strict'
import { test } from 'node:test'
import { shouldGenerateInternalCraftOrderForProductionOrder } from '../src/data/fcs/task-generation-boundaries.ts'
import { productionOrders } from '../src/data/fcs/production-orders.ts'
import { getProductionOrderTechPackSnapshot } from '../src/data/fcs/production-order-tech-pack-runtime.ts'
import { getSpecialCraftOperationByCraftCode } from '../src/data/fcs/special-craft-operations.ts'
import { generateSpecialCraftTaskOrdersFromProductionOrder } from '../src/data/fcs/special-craft-task-generation.ts'
import { getMaterialSkuRecordById, MATERIAL_ARCHIVE_STORAGE_KEY } from '../src/data/pcs-material-archive-repository.ts'
import { pcsRecordStore } from '../src/data/pcs-record-runtime.ts'

test('MAT-011 / BRIDGE-004 printed fabric can feed a separate cut-piece printing operation without another material identity', () => {
  const printed = getMaterialSkuRecordById('material-r1-process-print')
  assert(printed, '需要已印花的物料演示 SKU')
  const baseOrder = productionOrders.find(order => shouldGenerateInternalCraftOrderForProductionOrder(order) && getProductionOrderTechPackSnapshot(order.productionOrderId)?.patternFiles.some(file => file.recordKind !== 'MATERIAL_ASSOCIATION' && file.pieceRows.length))!
  const order = structuredClone(baseOrder), snapshot = structuredClone(getProductionOrderTechPackSnapshot(baseOrder.productionOrderId)!)
  const operation = getSpecialCraftOperationByCraftCode('CRAFT_016384')!
  assert(operation, '裁片直喷使用现有生产工艺')
  const file = snapshot.patternFiles.find(file => file.recordKind !== 'MATERIAL_ASSOCIATION' && file.pieceRows.length)!
  const piece = structuredClone(file.pieceRows[0])
  const sku = order.demandSnapshot.skuLines[0]
  order.productionOrderId = 'R1-CUT-PRINT'; order.productionOrderNo = 'R1-CUT-PRINT'
  order.demandSnapshot.skuLines = [{ ...sku, qty: 12 }]
  snapshot.productionOrderId = order.productionOrderId; snapshot.snapshotId = 'R1-CUT-PRINT-TECH'
  snapshot.patternFiles.forEach(item => { item.pieceRows = [] })
  file.selectedSizeCodes = [sku.size]
  file.pieceRows = [{ ...piece, id: 'R1-FRONT', name: '前片', specialCrafts: [{ ...(piece.specialCrafts?.[0] || {}), processCode: operation.processCode, processName: operation.processName, craftCode: operation.craftCode, craftName: operation.operationName, selectedTargetObject: '已裁部位' }], colorAllocations: [{ colorName: sku.color, colorCode: 'R1', skuCodes: [sku.skuCode], pieceCount: 1 }] }]
  snapshot.bomItems = [{ ...snapshot.bomItems[0], id: 'R1-PRINTED-FABRIC', materialCode: printed.materialSkuCode, name: printed.materialName, unit: printed.mainUnit }]
  const entry = snapshot.processEntries.find(item => item.processCode === 'SPECIAL_CRAFT')!
  snapshot.processEntries = [{ ...entry, id: 'R1-CUT-PIECE-PRINT', processCode: 'SPECIAL_CRAFT', craftCode: operation.craftCode, craftName: operation.operationName, selectedTargetObject: '已裁部位', linkedPatternIds: [file.id], routeObjectKey: `PATTERN:${file.id}:PIECE:R1-FRONT`, predecessorEntryIds: ['R1-CUTTING'], inputObjectType: 'CUT_PIECE', outputObjectType: 'CUT_PIECE' }]
  const before = pcsRecordStore.getItem(MATERIAL_ARCHIVE_STORAGE_KEY)
  const result = generateSpecialCraftTaskOrdersFromProductionOrder({ productionOrder: order, techPackSnapshot: snapshot, specialCraftOperations: [operation] })
  assert.deepEqual(result.errors, [])
  assert.equal(result.taskOrders.length, 1, JSON.stringify(result.warnings))
  const task = result.taskOrders[0]
  assert.equal(task.inputObjectType, 'CUT_PIECE'); assert.equal(task.outputObjectType, 'CUT_PIECE')
  assert.equal(task.unit, '片'); assert.equal(task.planQty, 12)
  assert.equal(task.sourceEntryId, 'R1-CUT-PIECE-PRINT')
  assert.deepEqual(task.predecessorEntryIds, ['R1-CUTTING'])
  assert.equal(snapshot.bomItems[0].materialCode, printed.materialSkuCode)
  assert.equal(pcsRecordStore.getItem(MATERIAL_ARCHIVE_STORAGE_KEY), before)
  const repeated = generateSpecialCraftTaskOrdersFromProductionOrder({ productionOrder: order, techPackSnapshot: snapshot, specialCraftOperations: [operation], existingGeneratedTasks: result.taskOrders })
  assert.equal(new Set([...result.taskOrders, ...repeated.taskOrders].map(task => task.generationKey)).size, 1)
})
