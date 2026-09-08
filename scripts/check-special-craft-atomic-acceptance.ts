import assert from 'node:assert/strict'
import { productionOrders } from '../src/data/fcs/production-orders.ts'
import { getProductionOrderTechPackSnapshot } from '../src/data/fcs/production-order-tech-pack-runtime.ts'
import { listEnabledSpecialCraftOperationDefinitions } from '../src/data/fcs/special-craft-operations.ts'
import { generateSpecialCraftTaskOrdersFromProductionOrder } from '../src/data/fcs/special-craft-task-generation.ts'

// PROD-007 / PROD-009：复用已有 route-occurrence 专项的正式生产单快照夹具方法，
// 但明确指定压褶、打褶和花朵；不能用任意第一种工艺代替这两个原子需求。
const operations = listEnabledSpecialCraftOperationDefinitions()
const operationFor = (name: string) => {
  const operation = operations.find((item) => item.craftName === name)
  assert(operation, `正式字典缺少 ${name}`)
  return operation
}
const baseOrder = productionOrders.find((order) => getProductionOrderTechPackSnapshot(order.productionOrderId)?.patternFiles.some((file) => file.recordKind !== 'MATERIAL_ASSOCIATION' && file.pieceRows.some((piece) => piece.specialCrafts?.length)))
assert(baseOrder, '缺少有实体纸样的正式生产单夹具')
const baseSnapshot = getProductionOrderTechPackSnapshot(baseOrder.productionOrderId)
assert(baseSnapshot)
const baseBefore = JSON.stringify({ baseOrder, baseSnapshot })

function fixture(id: string, pieces: Array<{ suffix: string; name: string; count: number; crafts: string[] }>) {
  const productionOrder = structuredClone(baseOrder!)
  const snapshot = structuredClone(baseSnapshot!)
  productionOrder.productionOrderId += `-${id}`
  productionOrder.productionOrderNo += `-${id}`
  snapshot.productionOrderId = productionOrder.productionOrderId
  snapshot.productionOrderNo = productionOrder.productionOrderNo
  snapshot.snapshotId += `-${id}`
  const pattern = snapshot.patternFiles.find((file) => file.recordKind !== 'MATERIAL_ASSOCIATION' && file.pieceRows.some((piece) => piece.specialCrafts?.length))!
  const sourcePiece = pattern.pieceRows.find((piece) => piece.specialCrafts?.length)!
  const craftTemplate = sourcePiece.specialCrafts![0]
  const entryTemplate = snapshot.processEntries.find((entry) => entry.processCode === 'SPECIAL_CRAFT')!
  assert(entryTemplate, '缺少正式辅助工艺路线条目模板')
  const sku = productionOrder.demandSnapshot.skuLines[0]
  assert(sku)
  productionOrder.demandSnapshot.skuLines = [8, 13].map((qty, index) => ({ ...sku, skuCode: `${sku.skuCode}-${id}-${index}`, color: '验收色', size: `S${index}`, qty }))
  snapshot.patternFiles.forEach((file) => { file.pieceRows = [] })
  pattern.selectedSizeCodes = ['S0', 'S1']
  const skuCodes = productionOrder.demandSnapshot.skuLines.map((item) => item.skuCode)
  pattern.pieceRows = pieces.map((piece) => ({
    ...sourcePiece,
    id: `${id}-${piece.suffix}`,
    name: piece.name,
    specialCrafts: piece.crafts.map((name) => {
      const operation = operationFor(name)
      return { ...craftTemplate, craftCode: operation.craftCode, craftName: operation.craftName, processCode: operation.processCode, selectedTargetObject: '已裁部位' as const }
    }),
    colorAllocations: [{ colorName: '验收色', colorCode: 'ATOMIC', skuCodes, pieceCount: piece.count }],
  }))
  snapshot.processEntries = pieces.flatMap((piece) => piece.crafts.map((name) => {
    const operation = operationFor(name)
    return {
      ...entryTemplate,
      id: `${id}-${piece.suffix}-${operation.craftCode}`,
      craftCode: operation.craftCode,
      craftName: operation.craftName,
      selectedTargetObject: '已裁部位' as const,
      linkedPatternIds: [pattern.id],
      routeObjectKey: `PATTERN:${pattern.id}:PIECE:${id}-${piece.suffix}`,
      predecessorEntryIds: [`PRE-${id}-${piece.suffix}-${operation.craftCode}`],
      inputObjectType: 'CUT_PIECE' as const,
      outputObjectType: name === '花朵' ? 'ACCESSORY' as const : 'CUT_PIECE' as const,
    }
  }))
  const requestedOperations = [...new Set(pieces.flatMap((piece) => piece.crafts))].map(operationFor)
  const input = { productionOrder, techPackSnapshot: snapshot, specialCraftOperations: requestedOperations }
  const result = generateSpecialCraftTaskOrdersFromProductionOrder(input)
  assert.deepEqual(result.errors, [], `${id} 不应产生生成阻断`)
  const tasks = result.taskOrders
  const expectedCount = pieces.reduce((sum, piece) => sum + piece.crafts.length, 0)
  assert.equal(tasks.length, expectedCount, `${id} 不同工艺/部位 occurrence 不得互相吞并或重复生成`)
  assert.equal(new Set(tasks.map((task) => task.generationKey)).size, expectedCount)
  for (const piece of pieces) for (const name of piece.crafts) {
    const operation = operationFor(name)
    const entryId = `${id}-${piece.suffix}-${operation.craftCode}`
    const task = tasks.find((item) => item.sourceEntryId === entryId)
    assert(task, `${entryId} 未生成独立加工单`)
    assert.equal(task.operationId, operation.operationId)
    assert.equal(task.craftName, name)
    assert.equal(task.routeObjectKey, `PATTERN:${pattern.id}:PIECE:${id}-${piece.suffix}`)
    assert.deepEqual(task.predecessorEntryIds, [`PRE-${id}-${piece.suffix}-${operation.craftCode}`])
    assert.equal(task.demandLines?.length, 2, '同一 occurrence 保留两个 SKU 明细')
    assert.deepEqual(task.demandLines?.map((line) => line.planPieceQty).sort((a, b) => a - b), [8 * piece.count, 13 * piece.count])
    assert(task.demandLines?.every((line) => line.pieceRowId === `${id}-${piece.suffix}` && line.partName === piece.name && line.craftCode === operation.craftCode && line.sourceEntryId === entryId && line.routeObjectKey === task.routeObjectKey), `${entryId} 混入了其他部位或工艺明细`)
    assert.equal(task.inputObjectType, 'CUT_PIECE')
    assert.equal(task.outputObjectType, name === '花朵' ? 'ACCESSORY' : 'CUT_PIECE')
  }
  const repeated = generateSpecialCraftTaskOrdersFromProductionOrder({ ...input, existingGeneratedTasks: tasks })
  assert.deepEqual(repeated.errors, [])
  assert.deepEqual(repeated.taskOrders.map((task) => task.generationKey).sort(), tasks.map((task) => task.generationKey).sort(), '重复生成不能多造或漏掉 occurrence')
  return tasks.map((task) => ({ id: task.taskOrderId, craft: task.craftName, sourceEntryId: task.sourceEntryId, part: task.demandLines?.[0]?.partName, skuQuantities: task.demandLines?.map((line) => line.planPieceQty), input: task.inputObjectType, output: task.outputObjectType }))
}

const pleats = fixture('PROD-007', [{ suffix: 'FRONT', name: '同款前片', count: 1, crafts: ['压褶', '打褶'] }])
const flowers = fixture('PROD-009', [
  { suffix: 'FRONT', name: '花朵指定前片', count: 1, crafts: ['花朵'] },
  { suffix: 'BACK', name: '花朵指定后片', count: 2, crafts: ['花朵'] },
])
assert.equal(JSON.stringify({ baseOrder, baseSnapshot }), baseBefore, '专项不得修改原生产单或冻结快照')
console.log(JSON.stringify({ requirements: ['PROD-007', 'PROD-009'], pleats, flowers, result: '通过' }, null, 2))
