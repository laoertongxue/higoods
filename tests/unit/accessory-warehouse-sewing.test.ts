import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAccessorySewingHandover } from '../../src/data/wls/accessory-warehouse-sewing.ts'
import { getAccessoryStockId, type AccessoryStock } from '../../src/data/wls/accessory-warehouse-stock.ts'
import { ACCESSORY_HILON_WAREHOUSE as HILON, type AccessoryPickup } from '../../src/data/wls/accessory-warehouse-flow.ts'
import type { AccessorySewingTaskScope } from '../../src/data/wls/accessory-warehouse-task-scope.ts'
import { initializeSewingMaterialHandoverForAssignment, resetSewingMaterialHandoversForTests, type SewingMaterialHandoverContext } from '../../src/data/fcs/sewing-material-handover.ts'
import type { SewingPickupSlipVersion } from '../../src/data/fcs/sewing-pickup-slips.ts'
import { buildAccessoryWarehouseUpstreamFixtures } from '../../src/data/wls/accessory-warehouse-upstream-fixtures.ts'
import { productionOrders } from '../../src/data/fcs/production-orders.ts'

function fixture() {
  const base = { sourceLineId: 'SOURCE', materialSku: 'TAG', materialName: '价格吊牌', imageUrl: '/tag.jpg', color: '白色', spec: '大号', unit: '张', purpose: '价格吊牌' as const, requiresCutting: false, fromLocationId: 'H-A01', handedQty: 0 }
  const pickup: AccessoryPickup = { id: 'PICKUP-A', preparationId: 'PREP', productionOrderId: 'PO', sourceTransferId: 'TR', warehouseCode: HILON, taskId: 'TASK-A', assignmentId: 'ASG-A', taskVersion: 'TASK-V1', factoryId: 'SEW-A', factoryName: '三方车缝A', version: 1, status: '待领料', history: [], lines: [{ ...base, id: 'FRAG-A', qty: 20, requiredQty: 20 }, { ...base, id: 'FRAG-B', qty: 10, requiredQty: 10 }] }
  const context: SewingMaterialHandoverContext = { assignmentId: 'ASG-A', runtimeTaskId: 'TASK-A', productionOrderId: 'PO', productionOrderNo: 'SC-01', taskNo: 'RW-A', factoryId: 'SEW-A', factoryName: '三方车缝A', ppicId: 'PPIC-A', ppicName: '跟单A', dataCompleteness: 'COMPLETE', requirementLines: [{ requirementLineId: 'REQ-A', bomItemId: 'BOM-A', materialType: '辅料', materialCode: 'TAG', materialName: '价格吊牌', materialSpec: '大号', unit: '张', unitConsumption: 1, lossRate: 0, assignedGarmentQty: 30, requiredQty: 30 }] }
  const version: SewingPickupSlipVersion = { slipId: 'PPIC-PICKUP-ASG-A-ACCESSORY', slipNo: 'LL-A', versionId: 'SLIP-A-V2', versionNo: 2, versionLabel: 'V2', status: 'CURRENT', assignmentId: 'ASG-A', runtimeTaskId: 'TASK-A', taskNo: 'RW-A', productionOrderId: 'PO', productionOrderNo: 'SC-01', taskKindLabel: '独立车缝', factoryId: 'SEW-A', factoryName: '三方车缝A', ppicId: 'PPIC-A', ppicName: '跟单A', warehouseName: 'HILON辅料仓', objectKind: 'ACCESSORY', styleCode: 'STYLE', styleName: '款式', styleImageUrl: '/style.jpg', lines: [{ lineId: 'SLIP-LINE-A', sourceLineId: 'REQ-A', objectType: '辅料', objectCode: 'TAG', objectName: '价格吊牌', color: '白', size: '不适用', part: '辅料', unit: '张', requiredQty: 30, previouslyHandedOverQty: 0, availableQty: 30, imageUrl: '/tag.jpg' }], printedAt: '2026-10-19', printedByPpicId: 'PPIC-A', printedByPpicName: '跟单A' }
  const scope: AccessorySewingTaskScope = { taskId: 'TASK-A', taskNo: 'RW-A', assignmentId: 'ASG-A', taskVersion: 'TASK-V1', factoryId: 'SEW-A', factoryName: '三方车缝A', ppicId: 'PPIC-A', ppicName: '跟单A', taskType: 'SEWING', assignedQty: 30, skuLines: [{ skuCode: 'RED-M', color: '红', size: 'M', qty: 30 }], quantitiesByLine: { 'FRAG-A': 20, 'FRAG-B': 10 }, sewingQuantitiesByLine: { 'FRAG-A': 20, 'FRAG-B': 10 }, postQuantitiesByLine: {}, requirementLineIdByLine: { 'FRAG-A': 'REQ-A', 'FRAG-B': 'REQ-A' }, cumulativeHandedQtyByRequirement: {}, handoverContextPresent: true, pickupSlipVersionId: version.versionId, bomQuantities: [] }
  const stocks: AccessoryStock[] = [{ id: getAccessoryStockId(HILON, 'H-A01', 'TAG', '张'), warehouseCode: HILON, locationId: 'H-A01', materialSku: 'TAG', unit: '张', onHandQty: 100, reservedQty: 5, version: 4 }]
  return { pickup, context, version, scope, stocks, actor: { role: '仓管' as const, warehouseCode: HILON, name: '仓管A' }, commandId: 'CONFIRM-A', at: '2026-10-19T10:00:00Z', entries: [{ lineId: 'FRAG-A', qty: 12 }, { lineId: 'FRAG-B', qty: 3 }] }
}

test('P30/P31 多片段实交聚合回同一原账明细，库存按实物身份扣一次且不改其他任务', () => {
  const input = fixture(), before = structuredClone(input)
  const result = buildAccessorySewingHandover(input)
  assert.deepEqual(input, before)
  assert.deepEqual(result.pickup.lines.map(row => row.handedQty), [12, 3])
  assert.equal(result.pickup.status, '领料中')
  assert.deepEqual(result.event.lines.map(row => [row.requirementLineId, row.actualQty]), [['REQ-A', 15]])
  assert.deepEqual(result.result.quantities, [{ lineId: 'SLIP-LINE-A', actualQty: 15 }])
  const stock = result.change.puts.find(row => row.collection.endsWith(':stock'))?.value as AccessoryStock
  assert.equal(stock.onHandQty, 85); assert.equal(stock.reservedQty, 5)
  assert.deepEqual(new Set(result.change.puts.map(row => row.collection)), new Set(['accessory-warehouse:pickup', 'accessory-warehouse:stock', 'accessory-warehouse:sewing-handover', 'accessory-warehouse:sewing-result', 'accessory-warehouse:sewing-slip', 'accessory-warehouse:sewing-context']))
  assert.ok(result.change.puts.every(row => !JSON.stringify(row.value).includes('TASK-B')))
})

test('P31 PPIC、错仓、旧版本、错任务、超剩余及共用余额不足均不能生成持久变更', () => {
  const input = fixture()
  assert.throws(() => buildAccessorySewingHandover({ ...input, actor: { ...input.actor, role: 'PPIC' } }), /仓管/)
  assert.throws(() => buildAccessorySewingHandover({ ...input, actor: { ...input.actor, warehouseCode: 'OTHER' } }), /本仓/)
  assert.throws(() => buildAccessorySewingHandover({ ...input, version: { ...input.version, status: 'VOIDED' } }), /凭证/)
  assert.throws(() => buildAccessorySewingHandover({ ...input, version: { ...input.version, assignmentId: 'ASG-B' } }), /凭证/)
  assert.throws(() => buildAccessorySewingHandover({ ...input, entries: [{ lineId: 'FRAG-A', qty: 21 }] }), /超过/)
  assert.throws(() => buildAccessorySewingHandover({ ...input, stocks: [{ ...input.stocks[0], onHandQty: 15, reservedQty: 5 }] }), /可用数量不足|库存不足/)
  assert.throws(() => buildAccessorySewingHandover({ ...input, scope: { ...input.scope, cumulativeHandedQtyByRequirement: { 'REQ-A': 7 } } }), /累计不一致/)
})

test('P31 原账实际数量与领料累计共同续领，不能将旧实交清零后重领', () => {
  const input = fixture(), first = buildAccessorySewingHandover(input)
  const scope = { ...input.scope, cumulativeHandedQtyByRequirement: { 'REQ-A': 15 } }
  const result = buildAccessorySewingHandover({ ...input, pickup: first.pickup, scope, stocks: first.change.puts.filter(row => row.collection.endsWith(':stock')).map(row => row.value as AccessoryStock), commandId: 'CONFIRM-B', entries: [{ lineId: 'FRAG-A', qty: 8 }, { lineId: 'FRAG-B', qty: 7 }] })
  assert.equal(result.pickup.status, '已领料')
  assert.deepEqual(result.pickup.lines.map(row => row.handedQty), [20, 10])
  assert.equal(result.event.lines[0].actualQty, 15)
})

test('原实交账初始化按 applicableSkuCodes 取本分配 SKU，不以整任务数套用限定 BOM', () => {
  resetSewingMaterialHandoversForTests()
  const id = 'PO-APPLICABLE-UNIT'
  productionOrders.push({ ...buildAccessoryWarehouseUpstreamFixtures()[0].order, productionOrderId: id, techPackSnapshot: { ...buildAccessoryWarehouseUpstreamFixtures()[0].techPack, snapshotId: 'SNAP-UNIT', versionLabel: 'V1', bomItems: [{ id: 'BOM-RED', type: '辅料', name: '红色价格吊牌', materialCode: 'RED-TAG', spec: '红', unit: '张', unitConsumption: 2, lossRate: 0.1, applicableSkuCodes: ['RED-M'] }] } } as any)
  try {
    const base = { assignmentId: 'ASG-UNIT', runtimeTaskId: 'TASK-UNIT', productionOrderId: id, factoryId: 'FACTORY', factoryName: '工厂', processCodes: ['SEW'], ppicId: 'PPIC', ppicName: '跟单', operatedAt: '2026-10-19', assignedQty: 50 }
    assert.throws(() => initializeSewingMaterialHandoverForAssignment(base), /缺少任务 SKU/)
    const context = initializeSewingMaterialHandoverForAssignment({ ...base, skuLines: [{ skuCode: 'RED-M', qty: 10 }, { skuCode: 'BLUE-L', qty: 40 }] })!
    assert.equal(context.requirementLines[0].assignedGarmentQty, 10)
    assert.equal(context.requirementLines[0].requiredQty, 22)
  } finally { productionOrders.splice(productionOrders.findIndex(row => row.productionOrderId === id), 1); resetSewingMaterialHandoversForTests() }
})

test('已切换后的旧标签凭证及实交不能混入 canonical 读桥或取代当前版本', async () => {
  const slips = await import('../../src/data/fcs/sewing-pickup-slips.ts')
  const hand = await import('../../src/data/fcs/sewing-material-handover.ts')
  const input = fixture(), canonical = buildAccessorySewingHandover(input)
  const lateVersion = { ...input.version, versionId: 'LATE-V99', versionNo: 99, versionLabel: 'V99' }
  const lateResult = { ...canonical.result, commandId: 'LATE-CMD', versionId: lateVersion.versionId, quantities: [{ lineId: 'SLIP-LINE-A', actualQty: 3 }] }
  const oldCut = { ...input.version, slipId: 'PPIC-PICKUP-ASG-A-CUT_PIECE', versionId: 'OLD-CUT-V1', objectKind: 'CUT_PIECE' as const }, oldCutResult = { ...canonical.result, commandId: 'OLD-CUT-CMD', versionId: 'OLD-CUT-V1', objectKind: 'CUT_PIECE' as const }
  const memory = new Map([['higood:ppic:sewing-pickup-slips:v1', JSON.stringify({ version: 1, versions: [lateVersion, oldCut], handoverResults: [lateResult, oldCutResult] })]])
  const previous = (globalThis as any).window
  ;(globalThis as any).window = { localStorage: { getItem: (key: string) => memory.get(key) || null, setItem: (key: string, value: string) => memory.set(key, value), removeItem: (key: string) => memory.delete(key) } }
  hand.installSewingMaterialHandoverBridge({ context: id => id === input.context.assignmentId ? input.context : undefined, contexts: () => [input.context], events: () => [canonical.event], ownsLines: () => true })
  slips.installSewingPickupWarehouseBridge({ ownsAssignment: id => id === input.context.assignmentId, usesCanonical: id => id === input.context.assignmentId, versions: () => [input.version], results: () => [canonical.result], availability: () => ({available:false,reason:'旧写冲突'}), issue: async()=>{throw new Error('旧写冲突')}, record: async()=>{throw new Error('旧写冲突')}, pickupPath:()=>undefined })
  try {
    assert.equal(slips.getCurrentSewingPickupSlip(input.context.assignmentId, 'ACCESSORY')?.versionId, input.version.versionId)
    assert.equal(slips.getSewingPickupSlipVersion(lateVersion.versionId), null)
    assert.equal(slips.getSewingPickupSlipVersion('OLD-CUT-V1')?.objectKind, 'CUT_PIECE')
    assert.equal(slips.listSewingPickupHandoverResults('OLD-CUT-V1')[0].commandId, 'OLD-CUT-CMD')
    assert.throws(() => slips.recordSewingPickupHandover({ ...oldCutResult, commandId: 'NEW-OLD-CUT' }), /仅供历史查看/)
    assert.equal(slips.listSewingPickupHandoverResults(lateVersion.versionId).length, 0)
    assert.equal(hand.getSewingMaterialHandoverProjection(input.context.assignmentId).lines[0].cumulativeHandedOverQty, 15)
    assert.ok(!hand.captureSewingMaterialState().events.some(([, row]) => row.commandId === 'LATE-CMD'))
    assert.ok(memory.get('higood:ppic:sewing-pickup-slips:v1')?.includes('LATE-CMD'))
  } finally {
    ;(globalThis as any).window = previous
    hand.installSewingMaterialHandoverBridge({context:()=>undefined,contexts:()=>[],events:()=>[],ownsLines:()=>false})
    slips.installSewingPickupWarehouseBridge({ownsAssignment:()=>false,usesCanonical:()=>false,versions:()=>[],results:()=>[],availability:()=>({available:false,reason:''}),issue:async()=>{throw new Error('unavailable')},record:async()=>{throw new Error('unavailable')},pickupPath:()=>undefined})
  }
})
