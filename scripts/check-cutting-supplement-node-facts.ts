import assert from 'node:assert/strict'
import {
  registerSupplementOrder,
  resetSupplementOrderRegistryForTesting,
  type SupplementMaterialDemand,
} from '../src/data/fcs/cutting/supplement-order-registry.ts'
import {
  registerSupplementPurchaseOrder,
  resetSupplementPurchaseOrderRegistryForTesting,
} from '../src/data/fcs/cutting/supplement-purchase-order-registry.ts'
import {
  registerSupplementMaterialPrepDemand,
  resetSupplementMaterialPrepDemandRegistryForTesting,
  updateSupplementMaterialPrepDemand,
} from '../src/data/fcs/cutting/supplement-material-prep-demand-registry.ts'
import {
  getSupplementCompletionEligibility,
  getSupplementMaterialNodeFacts,
  getSupplementNodeOverview,
} from '../src/data/fcs/cutting/supplement-node-facts.ts'

resetSupplementOrderRegistryForTesting()
resetSupplementPurchaseOrderRegistryForTesting()
resetSupplementMaterialPrepDemandRegistryForTesting()

const demand: SupplementMaterialDemand = {
  key: 'DEMAND-1', materialPatternMappingId: 'MAP-1', sourceBomItemId: 'BOM-1', techPackVersionId: 'TP-1',
  materialSku: 'FAB-NODE-1', materialName: '节点测试面料', materialTypeLabel: '面料',
  materialImageUrl: '/materials/fabric-main.jpg', materialImageAlt: '节点测试面料实物图', materialAlias: 'A',
  materialRole: '面料A', roleSource: '物料关系', roleConfirmStatus: '已确认', patternId: 'PAT-1', patternName: '前片',
  requiredQty: 100, unit: '米', printRequired: false, dyeRequired: false, processNote: '无需印染',
  originalCutOrderId: 'CUT-ID-1', originalCutOrderNo: 'CUT-1', color: '黑色', spec: '150cm', patternPart: '前片',
}
const supply = {
  materialDemandId: demand.key, materialSku: demand.materialSku, requiredQty: 100, unit: '米',
  inventoryRows: [
    { warehouseName: '中转仓', location: 'A-01', totalQty: 30, availableQty: 30, unavailableQty: 0, unit: '米', status: '可用', updatedAt: '2026-08-04 10:00', unitMatched: true },
  ],
  availableInventoryCoverageQty: 30, existingTransitSummary: null, existingTransitRows: [], existingTransitCoverageQty: 0,
  uncoveredQty: 70, recommendation: '可继续' as const, businessDecision: '确认继续' as const,
  newPurchaseRequired: true, checkedAt: '2026-08-04 10:00', warnings: [],
}
const purchaseA = registerSupplementPurchaseOrder({ supplementOrderId: 'SUP-NODE-1', materialDemandId: demand.key, materialSku: demand.materialSku, purchaseQty: 40, unit: '米', createdAt: '2026-08-04 10:01' })
const purchaseB = registerSupplementPurchaseOrder({ supplementOrderId: 'SUP-NODE-1', materialDemandId: demand.key, materialSku: demand.materialSku, purchaseQty: 30, unit: '米', createdAt: '2026-08-04 10:02', purchaseLineKey: '2' })
const order = registerSupplementOrder({
  id: 'SUP-NODE-1', recordNo: 'SUP-NODE-1', cutOrderId: 'CUT-ID-1', cutOrderNo: 'CUT-1',
  productionOrderId: 'PO-1', productionOrderNo: 'PO-1', reason: '验片破损', reasonDetail: '节点一致性检查',
  totalQty: 10, lineSummary: '黑色/M/10件', lines: [{ color: '黑色', size: 'M', supplementQty: 10 }],
  materialDemands: [demand], processWorkOrderRefs: [], supplyDecisionSnapshots: [supply],
  createdPurchaseOrderRefs: [purchaseA, purchaseB], materialPrepDemandId: 'SUP-PREP:SUP-NODE-1',
  confirmationKey: 'node-fact-check', requestFingerprint: 'node-fact-check-fingerprint',
  draftMeta: { candidateId: 'CUT-1', sourceType: 'cut-order', sourceNo: 'CUT-1', styleName: '测试款', spuCode: 'SPU-1', styleImageUrl: '/pants-sample.jpg', styleImageAlt: '测试款款式图' },
  createdAt: '2026-08-04 10:00', createdBy: '裁床主管',
})
const prep = registerSupplementMaterialPrepDemand({ supplementOrderId: order.id, supplementOrderNo: order.recordNo, productionOrderId: order.productionOrderId, productionOrderNo: order.productionOrderNo, cutOrderId: order.cutOrderId, cutOrderNo: order.cutOrderNo, sequenceNo: order.sequenceNo, reason: order.reason, materialDemands: order.materialDemands, supplyDecisionSnapshots: order.supplyDecisionSnapshots, createdPurchaseOrderRefs: order.createdPurchaseOrderRefs, createdAt: order.createdAt })
let rows = getSupplementMaterialNodeFacts(order)
assert.equal(rows.length, 1)
assert.equal(rows[0].purchase.documents.length, 2)
assert.equal(rows[0].purchase.documents.reduce((sum, document) => sum + document.plannedQty, 0), 70, '采购汇总必须等于展开明细')
assert.equal(rows[0].dye.status, '不需要')
assert.equal(rows[0].print.status, '不需要')
assert.equal(rows[0].materialPrep.approvedRequiredQty, 100)
assert.equal(getSupplementNodeOverview(order).inventory, '有可用库存')

updateSupplementMaterialPrepDemand({ demandId: prep.demandId, status: '存在差异', lines: [{ materialDemandId: demand.key, unresolvedDifferenceQty: 2 }] })
rows = getSupplementMaterialNodeFacts(order)
assert.equal(rows[0].hasUnresolvedDifference, true)
assert.match(getSupplementCompletionEligibility(order).reasons.join('；'), /中转仓配料存在未处理数量差异/)
updateSupplementMaterialPrepDemand({ demandId: prep.demandId, status: '采购中', lines: [{ materialDemandId: demand.key, unresolvedDifferenceQty: 0 }] })
assert.equal(getSupplementCompletionEligibility(order).allowed, true, '节点进行中但没有差异时不得自动阻断业务完成')

console.log('PASS: 补料库存、采购、染色、印花、中转仓配料节点事实与完成准入一致')
