import assert from 'node:assert/strict'
import { productionOrders } from '../src/data/fcs/production-orders.ts'
import { deriveFormalProductionOrderProcessSnapshots } from '../src/data/fcs/production-process-snapshot-derivation.ts'
import { ensureProcessWorkOrdersForFormalProductionOrder } from '../src/data/fcs/production-process-work-order-service.ts'
import { getDyeDispatchMaterial, getDyeWorkOrderById } from '../src/data/fcs/dyeing-task-domain.ts'
import { listDyeWorkOrderOnlineRows } from '../src/data/fcs/dye-work-order-online-view.ts'
import { getPrintWorkOrderById } from '../src/data/fcs/printing-task-domain.ts'
import { validateProcessRouteGraph } from '../src/data/tech-pack-process-route.ts'
import { renderCraftDyeingWorkOrderDetailPage } from '../src/pages/process-factory/dyeing/work-order-detail.ts'
import { renderCraftPrintingWorkOrderDetailPage } from '../src/pages/process-factory/printing/work-order-detail.ts'
import { syncTechPackProcessesFromBom } from '../src/pages/tech-pack/bom-process-linkage.ts'

const combined = syncTechPackProcessesFromBom([], [{
  id: 'BOM-WATER-DYE-COMBINED',
  type: '面料',
  materialCode: 'FAB-RAW-COMBINED',
  materialSkuId: 'MSKU-RAW-COMBINED',
  materialName: '待水溶染色面料',
  waterSolubleRequirement: '是',
  dyeRequirement: '是',
}]).techniques.filter((item) => item.stageCode === 'PREP')
assert.equal(combined.length, 1, '同一物料的水溶和染色必须合并为一道准备工序')
assert.equal(combined[0]?.processCode, 'DYE')
assert.equal(combined[0]?.technique, '水溶＋染色')
assert.equal(combined[0]?.outputMaterialSkuId, undefined, '含染色的合并工序必须等待选择新的产出 SKU')

const waterOnly = syncTechPackProcessesFromBom([], [{
  id: 'BOM-WATER-ONLY',
  type: '辅料',
  materialCode: 'LACE-WHITE',
  materialSkuId: 'MSKU-LACE-WHITE',
  materialName: '本白水溶花边',
  waterSolubleRequirement: '是',
}]).techniques.find((item) => item.processCode === 'WATER_SOLUBLE')!
assert.equal(waterOnly.inputMaterialSkuId, waterOnly.outputMaterialSkuId, '单独水溶必须保持 SKU 不变')
assert.equal(waterOnly.outputMaterialSkuMode, 'UNCHANGED')

const generated = syncTechPackProcessesFromBom([], [{
  id: 'BOM-SKU-PERSIST',
  type: '面料',
  materialCode: 'FAB-RAW-WHITE',
  materialSkuId: 'MSKU-RAW-WHITE',
  materialName: '白坯布',
  dyeRequirement: '是',
}]).techniques
const changed = generated.map((item) => item.processCode === 'DYE' ? {
  ...item,
  outputMaterialSkuId: 'MSKU-DYED-BLUE',
  outputMaterialSkuCode: 'FAB-DYED-BLUE',
  outputMaterialName: '蓝色染色布',
  outputMaterialSkuMode: 'CHANGED' as const,
} : item)
const resynced = syncTechPackProcessesFromBom(changed, [{
  id: 'BOM-SKU-PERSIST',
  type: '面料',
  materialCode: 'FAB-RAW-WHITE',
  materialSkuId: 'MSKU-RAW-WHITE',
  materialName: '白坯布',
  dyeRequirement: '是',
}]).techniques.find((item) => item.processCode === 'DYE')!
assert.equal(resynced.outputMaterialSkuCode, 'FAB-DYED-BLUE', 'BOM 再同步不能覆盖人工维护的标准产出 SKU')
assert.equal(resynced.outputMaterialSkuMode, 'CHANGED')

const invalidDyeUnchanged = { ...resynced, outputMaterialSkuId: resynced.inputMaterialSkuId }
assert(validateProcessRouteGraph([invalidDyeUnchanged], { requireComplete: true })
  .some((issue) => issue.code === 'MATERIAL_SKU_CHANGE_REQUIRED'), '染色沿用投入 SKU 必须被确认门禁阻断')
assert(validateProcessRouteGraph([{ ...waterOnly, outputMaterialSkuId: 'MSKU-LACE-BLUE' }], { requireComplete: true })
  .some((issue) => issue.code === 'MATERIAL_SKU_MUST_REMAIN'), '单独水溶更换 SKU 必须被确认门禁阻断')

const source = productionOrders.find((order) => order.techPackSnapshot?.bomItems.some((item) => item.type !== '成衣'))
assert(source?.techPackSnapshot, '需要一张带物料 BOM 的正式生产单夹具')
const order = structuredClone(source)
order.productionOrderId = 'PO-PREP-SKU-ROUTE-CHECK'
order.productionOrderNo = 'PO-PREP-SKU-ROUTE-CHECK'
order.createdAt = '2026-09-16 10:30:00'
order.processWorkOrderDefinitions = []
const bom = order.techPackSnapshot.bomItems.find((item) => item.type !== '成衣')!
bom.materialCode = 'FAB-RAW-WHITE'
bom.materialSkuId = 'MSKU-RAW-WHITE'
bom.materialImageUrl ||= '/assets/products/materials/fabric-white.jpg'
bom.unit = bom.unit || '米'
bom.unitConsumption = bom.unitConsumption > 0 ? bom.unitConsumption : 1
bom.lossRate = 0
bom.waterSolubleRequirement = '是'
bom.dyeRequirement = '是'
const template = order.techPackSnapshot.processEntries[0]
assert(template, '技术包快照需要至少一个工艺条目模板')
const routeObjectKey = `BOM:${bom.id}`
const dye = {
  ...template,
  id: 'PREP-SKU-DYE',
  stageCode: 'PREP' as const,
  stageName: '准备阶段',
  processCode: 'DYE',
  processName: '染色',
  linkedBomItemIds: [bom.id],
  routeObjectKey,
  inputObjectType: 'FABRIC' as const,
  outputObjectType: 'FABRIC' as const,
  inputMaterialSkuId: 'MSKU-RAW-WHITE',
  inputMaterialSkuCode: 'FAB-RAW-WHITE',
  inputMaterialName: '白坯布',
  inputMaterialImageUrl: bom.materialImageUrl,
  outputMaterialSkuId: 'MSKU-DYED-BLUE',
  outputMaterialSkuCode: 'FAB-DYED-BLUE',
  outputMaterialName: '蓝色染色布',
  outputMaterialImageUrl: bom.materialImageUrl,
  outputMaterialSkuMode: 'CHANGED' as const,
  predecessorEntryIds: [],
}
const print = {
  ...template,
  id: 'PREP-SKU-PRINT',
  stageCode: 'PREP' as const,
  stageName: '准备阶段',
  processCode: 'PRINT',
  processName: '印花',
  linkedBomItemIds: [bom.id],
  routeObjectKey,
  inputObjectType: 'FABRIC' as const,
  outputObjectType: 'FABRIC' as const,
  inputMaterialSkuId: 'MSKU-DYED-BLUE',
  inputMaterialSkuCode: 'FAB-DYED-BLUE',
  inputMaterialName: '蓝色染色布',
  inputMaterialImageUrl: bom.materialImageUrl,
  outputMaterialSkuId: 'MSKU-PRINTED-BLUE',
  outputMaterialSkuCode: 'FAB-PRINTED-BLUE',
  outputMaterialName: '蓝色印花布',
  outputMaterialImageUrl: bom.materialImageUrl,
  outputMaterialSkuMode: 'CHANGED' as const,
  predecessorEntryIds: ['PREP-SKU-DYE'],
}
assert.deepEqual(validateProcessRouteGraph([dye, print], { requireComplete: true }), [])
order.techPackSnapshot.processEntries = [dye, print]
productionOrders.push(order)

const snapshots = deriveFormalProductionOrderProcessSnapshots(order)
const dyeSnapshot = snapshots.find((item) => item.processEntryId === dye.id)!
const printSnapshot = snapshots.find((item) => item.processEntryId === print.id)!
assert.equal(dyeSnapshot.inputMaterialSkuCode, 'FAB-RAW-WHITE')
assert.equal(dyeSnapshot.outputMaterialSkuCode, 'FAB-DYED-BLUE')
assert.equal(dyeSnapshot.requiresWaterSoluble, true, '水溶＋染色必须进入同一张染色加工单')
assert.equal(printSnapshot.inputMaterialSkuCode, 'FAB-DYED-BLUE')
assert.equal(printSnapshot.outputMaterialSkuCode, 'FAB-PRINTED-BLUE')
assert.equal(printSnapshot.materialId, 'FAB-DYED-BLUE', '下游加工单的主物料必须是上游产出 SKU')

const dyeCreated = ensureProcessWorkOrdersForFormalProductionOrder(dyeSnapshot)
const printCreated = ensureProcessWorkOrdersForFormalProductionOrder(printSnapshot)
assert(dyeCreated.dyeWorkOrderId)
assert.equal(dyeCreated.printWorkOrderId, undefined, '水溶＋染色工序不能额外创建其他加工单')
assert(printCreated.printWorkOrderId)
const dyeOrder = getDyeWorkOrderById(dyeCreated.dyeWorkOrderId)!
const printOrder = getPrintWorkOrderById(printCreated.printWorkOrderId)!
assert.equal(dyeOrder.rawMaterialSku, 'FAB-RAW-WHITE')
assert.equal(dyeOrder.requiresWaterSoluble, true)
assert.equal(getDyeDispatchMaterial(dyeOrder.dyeOrderId).sku, 'FAB-DYED-BLUE')
const dyePageRow = listDyeWorkOrderOnlineRows().find((item) => item.dyeOrderId === dyeOrder.dyeOrderId)
assert.equal(dyePageRow?.rawMaterialSku, 'FAB-RAW-WHITE')
assert.equal(dyePageRow?.colorSku, 'FAB-DYED-BLUE', '染色加工单页面必须展示路线定义的产出 SKU')
const dyeDetailHtml = renderCraftDyeingWorkOrderDetailPage(dyeOrder.dyeOrderId)
assert.match(dyeDetailHtml, /FAB-RAW-WHITE/)
assert.match(dyeDetailHtml, /FAB-DYED-BLUE/)
assert.equal(printOrder.materialSku, 'FAB-DYED-BLUE')
assert.equal(printOrder.outputMaterialSku, 'FAB-PRINTED-BLUE')
assert.equal(printOrder.businessView?.plannedInput.sku, 'FAB-DYED-BLUE')
assert.equal(printOrder.businessView?.output.sku, 'FAB-PRINTED-BLUE')
const printDetailHtml = renderCraftPrintingWorkOrderDetailPage(printOrder.printOrderId)
assert.match(printDetailHtml, /FAB-DYED-BLUE/)
assert.match(printDetailHtml, /FAB-PRINTED-BLUE/)

productionOrders.splice(productionOrders.findIndex((item) => item.productionOrderId === order.productionOrderId), 1)
console.log('PASS: 技术包准备工序 SKU 转换链已投影到染色/印花加工单的投入与产出物料')
process.exit(0)
