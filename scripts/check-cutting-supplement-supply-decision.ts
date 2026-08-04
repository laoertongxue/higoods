import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildSupplementSupplyDecision,
  resetSupplementSupplyFactsForTesting,
  setSupplementSupplyFactsForTesting,
  SUPPLEMENT_WAREHOUSE_SCOPE,
} from '../src/data/fcs/cutting/supplement-supply-domain.ts'
import {
  listSupplementPurchaseOrders,
  registerSupplementPurchaseOrder,
  resetSupplementPurchaseOrderRegistryForTesting,
} from '../src/data/fcs/cutting/supplement-purchase-order-registry.ts'
import { listWarehouseInternalTransferOrders } from '../src/data/fcs/warehouse-material-execution.ts'
import { registerSupplementMaterialPrepDemand, listSupplementMaterialPrepDemands, resetSupplementMaterialPrepDemandRegistryForTesting, updateSupplementMaterialPrepDemand, SUPPLEMENT_MATERIAL_PREP_STATUSES } from '../src/data/fcs/cutting/supplement-material-prep-demand-registry.ts'
import type { SupplementMaterialDemand } from '../src/data/fcs/cutting/supplement-order-registry.ts'

const checkedAt = '2026-08-04 10:00'
const build = (sku: string, unit = '米', confirmUncovered = false) => buildSupplementSupplyDecision({
  materialDemandId: `D:${sku}`,
  materialSku: sku,
  requiredQty: 100,
  unit,
  checkedAt,
  confirmUncovered,
})

resetSupplementSupplyFactsForTesting()
resetSupplementPurchaseOrderRegistryForTesting()
resetSupplementMaterialPrepDemandRegistryForTesting()
const transferBefore = listWarehouseInternalTransferOrders().map((order) => order.id)

setSupplementSupplyFactsForTesting('STOCK', {
  inventoryRows: SUPPLEMENT_WAREHOUSE_SCOPE.map((warehouseName, index) => ({ warehouseName, location: `A-${index + 1}`, totalQty: index < 2 ? 60 : 0, availableQty: index < 2 ? 60 : 0, unavailableQty: 0, unit: '米', status: '可用', updatedAt: checkedAt })),
})
const stock = build('STOCK')
assert.equal(stock.availableInventoryCoverageQty, 100)
assert.equal(stock.uncoveredQty, 0)
assert.equal(stock.newPurchaseRequired, false)
assert.equal(stock.inventoryRows.length, SUPPLEMENT_WAREHOUSE_SCOPE.length)

setSupplementSupplyFactsForTesting('TRANSIT', {
  inventoryRows: [],
  transitRows: [{ purchaseQty: 120, arrivedQty: 20, pendingQty: 100, unit: '米', status: '采购在途', estimatedArrivalAt: '2026-08-08' }],
})
const transit = build('TRANSIT')
assert.equal(transit.existingTransitCoverageQty, 100)
assert.equal(transit.uncoveredQty, 0)
assert(transit.existingTransitSummary)
assert(!JSON.stringify(transit.existingTransitSummary).includes('purchaseOrder'), '已有采购在途不得保存具体采购单身份')

setSupplementSupplyFactsForTesting('PARTIAL', {
  inventoryRows: [{ warehouseName: '染色待加工仓', location: 'DY-01', totalQty: 30, availableQty: 30, unavailableQty: 0, unit: '米', status: '可用', updatedAt: checkedAt }],
  transitRows: [{ purchaseQty: 40, arrivedQty: 0, pendingQty: 40, unit: '米', status: '采购在途', estimatedArrivalAt: '2026-08-09' }],
})
const partial = build('PARTIAL', '米', true)
assert.equal(partial.availableInventoryCoverageQty, 30)
assert.equal(partial.existingTransitCoverageQty, 40)
assert.equal(partial.uncoveredQty, 30)
assert.equal(partial.businessDecision, '确认继续')
assert.equal(partial.newPurchaseRequired, true)

setSupplementSupplyFactsForTesting('NONE', { inventoryRows: [], transitRows: [] })
const cancelled = build('NONE')
assert.equal(cancelled.recommendation, '不建议创建')
assert.equal(cancelled.businessDecision, '取消')
assert.equal(cancelled.newPurchaseRequired, false)
const confirmed = build('NONE', '米', true)
assert.equal(confirmed.uncoveredQty, 100)
assert.equal(confirmed.newPurchaseRequired, true)

setSupplementSupplyFactsForTesting('UNIT', {
  inventoryRows: [{ warehouseName: '总仓面料仓', location: 'M-01', totalQty: 100, availableQty: 100, unavailableQty: 0, unit: '公斤', status: '可用', updatedAt: checkedAt }],
  transitRows: [{ purchaseQty: 100, arrivedQty: 0, pendingQty: 100, unit: '卷', status: '采购在途', estimatedArrivalAt: '未记录' }],
})
const mismatched = build('UNIT', '米', true)
assert.equal(mismatched.availableInventoryCoverageQty, 0)
assert.equal(mismatched.existingTransitCoverageQty, 0)
assert(mismatched.warnings.some((warning) => warning.includes('单位')))

for (const unit of ['米', '码', '卷', '公斤', '条', '粒', '套']) {
  setSupplementSupplyFactsForTesting(`UNIT-${unit}`, { inventoryRows: [], transitRows: [] })
  assert.equal(build(`UNIT-${unit}`, unit, true).unit, unit)
}

const purchase = registerSupplementPurchaseOrder({ supplementOrderId: 'SUP-1', materialDemandId: 'D-1', materialSku: 'NONE', purchaseQty: confirmed.uncoveredQty, unit: confirmed.unit, createdAt: checkedAt })
assert.equal(purchase.purchaseQty, 100)
assert.equal(registerSupplementPurchaseOrder({ supplementOrderId: 'SUP-1', materialDemandId: 'D-1', materialSku: 'NONE', purchaseQty: 100, unit: '米', createdAt: checkedAt }).purchaseOrderId, purchase.purchaseOrderId)
assert.equal(listSupplementPurchaseOrders('SUP-1').length, 1)
registerSupplementPurchaseOrder({ supplementOrderId: 'SUP-1', materialDemandId: 'D-1', materialSku: 'NONE', purchaseQty: 40, unit: '米', createdAt: checkedAt, purchaseLineKey: '2' })
assert.equal(listSupplementPurchaseOrders('SUP-1').length, 2, '采购读模型必须支持同一物料缺口后续拆成多张采购单')

const demand = (key: string): SupplementMaterialDemand => ({ key, materialPatternMappingId: key, sourceBomItemId: key, techPackVersionId: 'TP-1', materialSku: `SKU-${key}`, materialName: `物料${key}`, materialTypeLabel: '面料', materialImageUrl: '/materials/fabric-main.jpg', materialImageAlt: `物料${key}实物图`, materialAlias: '', materialRole: '面料A', roleSource: '物料关系', roleConfirmStatus: '已确认', patternId: 'P-1', patternName: '前片', requiredQty: 10, unit: '米', printRequired: false, dyeRequired: false, processNote: '无需印染', originalCutOrderId: 'CUT-ID', originalCutOrderNo: 'CUT-1' })
const prep1 = registerSupplementMaterialPrepDemand({ supplementOrderId: 'SUP-A', supplementOrderNo: 'SUP-A', productionOrderId: 'PO-1', productionOrderNo: 'PO-1', cutOrderId: 'CUT-ID', cutOrderNo: 'CUT-1', sequenceNo: 1, reason: '测试', materialDemands: [demand('A'), demand('B')], createdAt: checkedAt })
assert.equal(prep1.lines.length, 2, '一张补料单多物料必须保持一个需求组、多条明细')
assert.equal(prep1.lines[0].approvedRequiredQty, 10)
assert.equal(prep1.lines[0].currentAvailableQty, 0, '批准需求形成时不得伪造当前可配数量')
assert.equal(registerSupplementMaterialPrepDemand({ supplementOrderId: 'SUP-A', supplementOrderNo: 'SUP-A', productionOrderId: 'PO-1', productionOrderNo: 'PO-1', cutOrderId: 'CUT-ID', cutOrderNo: 'CUT-1', sequenceNo: 1, reason: '测试', materialDemands: [demand('A')], createdAt: checkedAt }).demandId, prep1.demandId)
registerSupplementMaterialPrepDemand({ supplementOrderId: 'SUP-B', supplementOrderNo: 'SUP-B', productionOrderId: 'PO-1', productionOrderNo: 'PO-1', cutOrderId: 'CUT-ID', cutOrderNo: 'CUT-1', sequenceNo: 2, reason: '测试', materialDemands: [demand('A')], createdAt: checkedAt })
assert.equal(listSupplementMaterialPrepDemands().length, 2, '多张补料单必须形成多个独立需求组')
for (const status of SUPPLEMENT_MATERIAL_PREP_STATUSES) {
  assert.equal(updateSupplementMaterialPrepDemand({ demandId: prep1.demandId, status }).status, status)
}
assert.equal(new Set(SUPPLEMENT_MATERIAL_PREP_STATUSES).size, 15, '补料配料状态全集不得缺失或重复')

const source = readFileSync(new URL('../src/pages/process-factory/cutting/supplement-management.ts', import.meta.url), 'utf8')
assert(!source.includes('createIssueOrTransferFromRequest'))
assert(!source.includes('fabricDemandBoardNextActions'))
assert(!source.includes('INTERNAL_TRANSFER'))
assert.deepEqual(listWarehouseInternalTransferOrders().map((order) => order.id), transferBefore, '补料供应判断前后不得新增调拨单')

console.log('PASS: 补料全仓库存、采购在途、缺口采购、单位隔离、确认幂等和不创建调拨单符合预期')
