import assert from 'node:assert/strict'
import { PRINTING_BUSINESS_PAGE_ORDER_IDS, getPrintWorkOrderById, getPrintingWorkOrderById } from '../src/data/fcs/printing-task-domain.ts'
import { productionOrders } from '../src/data/fcs/production-orders.ts'
// EXEC-004 / PREP-001：页面必须读取同一正式印花单来源，不能被演示状态配置改写。
const evidence = PRINTING_BUSINESS_PAGE_ORDER_IDS.map((id) => {
  const order = getPrintWorkOrderById(id)!
  const view = getPrintingWorkOrderById(id)!
  const production = productionOrders.find((item) => item.productionOrderId === order.sourceProductionOrderId)
  assert.equal(view.demandSource.type, order.sourceType === 'PRODUCTION_ORDER' ? 'PRODUCTION' : order.sourceType === 'STOCK' ? 'STOCK' : 'SUPPLEMENT', id)
  if (order.sourceType === 'PRODUCTION_ORDER') {
    assert.equal(view.demandSource.productionOrderNo, order.sourceProductionOrderNo, id)
    assert.equal(view.product.spu, production?.demandSnapshot.spuCode, id)
    assert.equal(view.product.productName, production?.demandSnapshot.spuName, id)
  }
  assert(view.plannedInput.supplySource.includes(view.demandSource.sourceLabel), id)
  for (const image of [view.product, view.plannedInput, view.output, view.requirement.frontPattern, view.requirement.insidePattern].filter(Boolean)) {
    assert(!image!.imageUrl.startsWith('data:image/svg') && !/placeholder|fabric-main\.jpg|fabric-contrast\.jpg|fabric-lining\.jpg/.test(image!.imageUrl), `${id}不得用占位/通用面料图冒充准确图片`)
  }
  return { id, source: view.demandSource, product: view.product.spu, missingImages: [view.product,view.plannedInput,view.output,view.requirement.frontPattern,view.requirement.insidePattern].filter((image)=>image&&!image.imageUrl).map((image)=>image!.imageAlt) }
})
console.log(JSON.stringify({passed:true,evidence},null,2))

// 三来源都经正式生成器建单，零现场量进入同一列表/详情/动作入口。
const { ensureProcessWorkOrders } = await import('../src/data/fcs/process-work-order-generation-service.ts')
const { listPrintingWorkOrders, receivePrintingInput, assignPrintingWorkOrder } = await import('../src/data/fcs/printing-task-domain.ts')
const base = productionOrders.find((item) => item.techPackSnapshot)!
const bom = base.techPackSnapshot!.bomItems[0]!
const common = {
  processCodes: ['PRINT'] as Array<'PRINT'>, orderedAt: '2026-09-07 12:30:00',
  materialId: bom.materialCode || bom.id, materialName: bom.name,
  materialItems: [{ sourceBomItemId: bom.id, materialId: bom.materialCode || bom.id, materialName: bom.name, materialType: '面料' }],
  targetColor: '白色', plannedQty: 20, qtyUnit: '米', printProcessName: '数码印花',
  spuCode: base.demandSnapshot.spuCode, spuName: base.demandSnapshot.spuName, requiredDeliveryDate: '2026-09-30',
}
const sourceBase = { productionOrderId: base.productionOrderId, productionOrderNo: base.productionOrderNo, techPackVersionId: base.techPackSnapshot!.sourceTechPackVersionId, techPackVersionLabel: base.techPackSnapshot!.sourceTechPackVersionLabel, processEntryId: 'PRINT-SOURCE-ACCEPTANCE', routeObjectKey: `BOM:${bom.id}`, bomItemId: bom.id, bomItemIds: [bom.id] }
for (const sourceType of ['PRODUCTION_ORDER', 'STOCK', 'CUT_PIECE_SUPPLEMENT'] as const) {
  const source = sourceType === 'STOCK' ? { sourceType, stockMaterialId: 'STOCK-PRINT-SOURCE-ACCEPTANCE', stockMaterialName: bom.name } : { ...sourceBase, sourceType, ...(sourceType === 'CUT_PIECE_SUPPLEMENT' ? { supplementRecordId: 'SUP-PRINT-SOURCE-ACCEPTANCE', supplementRecordNo: 'BL-PRINT-SOURCE-ACCEPTANCE', originalCutOrderId: 'CUT-PRINT-SOURCE-ACCEPTANCE', originalCutOrderNo: 'CP-PRINT-SOURCE-ACCEPTANCE' } : {}) }
  const result = ensureProcessWorkOrders({ ...common, source })
  const id = result.printWorkOrderId!
  const view = getPrintingWorkOrderById(id)!
  assert(view, `${sourceType}正式新单必须进入详情`)
  assert(listPrintingWorkOrders().some((row) => row.workOrderId === id), `${sourceType}正式新单必须进入列表`)
  assert.equal(view.actualInput.receivedQty, 0)
  assert.equal(view.output.completedQty, 0)
  assert.equal(view.manuallyCompletedAt, undefined)
  assert.equal(view.demandSource.type, sourceType === 'PRODUCTION_ORDER' ? 'PRODUCTION' : sourceType === 'STOCK' ? 'STOCK' : 'SUPPLEMENT')
  assignPrintingWorkOrder(id, { factoryId: 'F090', factoryName: 'FLOWER 印花厂', operatorName: '验收计划员' })
  if (sourceType !== 'CUT_PIECE_SUPPLEMENT') {
    receivePrintingInput(id, { actualSku: view.plannedInput.sku, receivedQty: 1, receivedRollCount: 1, receiverName: '验收接收员' })
    assert.equal(getPrintingWorkOrderById(id)!.actualInput.receivedQty, 1, `${sourceType}正式新单动作入口可接收`)
  }
  console.log(JSON.stringify({sourceType,id,demandSource:view.demandSource,initialReceived:0,initialCompleted:0,listed:true,detail:true}))
}
