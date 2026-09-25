/** Isolated browser acceptance fixture only. Never called by normal application startup.
 * Uses the existing created-production-order persistence so refresh exercises normal regeneration.
 */
import { productionOrders, persistCreatedProductionOrders } from '../../src/data/fcs/production-orders.ts'
import { getProductionOrderTechPackSnapshot } from '../../src/data/fcs/production-order-tech-pack-runtime.ts'
import { shouldGenerateInternalCraftOrderForProductionOrder } from '../../src/data/fcs/task-generation-boundaries.ts'
import { listEnabledSpecialCraftOperationDefinitions, buildSpecialCraftTaskDetailPath } from '../../src/data/fcs/special-craft-operations.ts'
import { generateSpecialCraftTaskOrdersFromProductionOrder } from '../../src/data/fcs/special-craft-task-generation.ts'
import { resetSpecialCraftTaskStore, getSpecialCraftTaskOrderById } from '../../src/data/fcs/special-craft-task-orders.ts'
import { readWoolStore, replaceWoolStore } from '../../src/data/fcs/wool-domain/store.ts'
import { addWoolHandover } from '../../src/data/fcs/wool-domain/commands.ts'

export async function prepareWoolFinalDownstreamReviewScenario() {
  const source = productionOrders.find(order => {
    const snapshot = getProductionOrderTechPackSnapshot(order.productionOrderId)
    return shouldGenerateInternalCraftOrderForProductionOrder(order) && snapshot?.bomItems.length
      && [...snapshot.imageSnapshot.styleImages, ...snapshot.imageSnapshot.productImages, ...snapshot.imageSnapshot.sampleImages].some(Boolean)
  })!
  const snapshot = structuredClone(getProductionOrderTechPackSnapshot(source.productionOrderId))!
  const sku = source.demandSnapshot.skuLines[0]
  const order = structuredClone(source)
  order.productionOrderId = 'PO-WOOL-FINAL-REVIEW'
  order.productionOrderNo = 'PO-WOOL-FINAL-REVIEW'
  order.demandId = 'DEMAND-WOOL-FINAL-REVIEW'
  order.demandSnapshot = { ...order.demandSnapshot, demandId: order.demandId, skuLines: [{ ...sku, qty: 10 }] }
  order.selectedTechPackVersionId = snapshot.sourceTechPackVersionId
  snapshot.productionOrderId = order.productionOrderId
  snapshot.productionOrderNo = order.productionOrderNo
  const operation = listEnabledSpecialCraftOperationDefinitions().find(operation => operation.craftName === '烫画')!
  const woolEntry = { ...snapshot.processEntries[0], id:'REVIEW-FINAL-WOOL', processCode:'PROC_WOOL', craftCode:undefined, predecessorEntryIds:[] }
  const garmentEntry = { ...snapshot.processEntries[0], id:'REVIEW-FINAL-GARMENT', processCode:'SPECIAL_CRAFT', craftCode:operation.craftCode, craftName:operation.craftName, selectedTargetObject:'成衣', targetObject:'GARMENT_SEMI', inputObjectType:'GARMENT', outputObjectType:'GARMENT', linkedPatternIds:[], linkedBomItemIds:['REVIEW-FINAL-BOM'], routeObjectKey:'BOM:REVIEW-FINAL-BOM', predecessorEntryIds:[woolEntry.id] }
  snapshot.patternFiles = []
  snapshot.bomItems = [{ ...snapshot.bomItems[0], id:'REVIEW-FINAL-BOM', type:'成衣', applicableSkuCodes:[sku.skuCode] }]
  snapshot.processEntries = [woolEntry,garmentEntry] as typeof snapshot.processEntries
  order.techPackSnapshot = snapshot
  const generated = generateSpecialCraftTaskOrdersFromProductionOrder({productionOrder:order,techPackSnapshot:snapshot})
  if (generated.errors.length || generated.taskOrders.length !== 1) throw Error('最终成衣工艺验收场景生成失败')
  if (productionOrders.some(existing => existing.productionOrderId === order.productionOrderId)) throw Error('请在全新隔离浏览器准备此验收场景')
  const saveSource = () => { productionOrders.push(order); persistCreatedProductionOrders([order.productionOrderId]) }
  if (typeof document !== 'undefined') {
    const { saveProductionSourceAction } = await import('../../src/data/fcs/production-context-actions.ts')
    await saveProductionSourceAction({ id: 'mock-wool-final-review-source', intent: 'explicit-wool-final-review-production-source', action: saveSource })
  } else saveSource()
  // This isolated fixture only creates source data. Normal generation chooses the task identity/factory.
  resetSpecialCraftTaskStore()
  const task = getSpecialCraftTaskOrderById(generated.taskOrders[0].taskOrderId)!
  if (!task) throw Error('最终成衣工艺验收任务未从生产单正常生成')
  const wool = readWoolStore(), knit = wool.workOrders['WOOL-STAGE-003:KNITTING'], link = wool.workOrders['WOOL-STAGE-003:LINKING'], oldSku = link.outputPlanLines[0].outputSkuCode
  if (wool.handovers.some(h => !h.automatic && h.woolOrderId === link.woolOrderId)) throw Error('请在全新隔离浏览器准备此验收场景')
  const styleImageUrl = [...snapshot.imageSnapshot.styleImages, ...snapshot.imageSnapshot.productImages, ...snapshot.imageSnapshot.sampleImages].find(Boolean)!
  for (const workOrder of [knit,link]) {
    workOrder.productionOrderId = order.productionOrderId; workOrder.productionOrderNo = order.productionOrderNo
    workOrder.sourceEntryId = woolEntry.id
    workOrder.styleNo = snapshot.styleCode || order.demandSnapshot.spuCode
    workOrder.styleName = snapshot.styleName || order.demandSnapshot.spuName
    workOrder.styleImageUrl = styleImageUrl
    workOrder.internalStyleCode = snapshot.internalStyleCode
    Object.assign(workOrder.outputPlanLines[0], {outputSkuCode:sku.skuCode,garmentSkuCode:sku.skuCode,colorCode:sku.color,colorName:sku.color,sizeCode:sku.size})
    workOrder.downstreamTarget = {receiverType:'DOWNSTREAM_FACTORY',receiverId:task.factoryId,receiverName:task.factoryName}
  }
  for (const key of ['processReports','handovers','internalReceipts','warehouseFlows'] as const) for (const row of wool[key] as Array<{woolOrderId:string;outputSkuCode?:string;objectSkuCode?:string}>) {
    if (![knit.woolOrderId,link.woolOrderId].includes(row.woolOrderId)) continue
    if (row.outputSkuCode === oldSku) row.outputSkuCode = sku.skuCode
    if (row.objectSkuCode === oldSku) row.objectSkuCode = sku.skuCode
  }
  replaceWoolStore(wool)
  const at = '2026-09-18 09:10:00'
  const handovers = [12,8].map((qty,index) => addWoolHandover(link.woolOrderId,{commandId:`review-final-${index}`,outputSkuCode:sku.skuCode,handoverQty:qty,handedOverAt:at,handedOverBy:'毛织组长（隔离验收）'}))
  getSpecialCraftTaskOrderById(task.taskOrderId)
  return {route:buildSpecialCraftTaskDetailPath(operation,task.taskOrderId),taskId:task.taskOrderId,skuCode:sku.skuCode,styleNo:link.styleNo,styleImageUrl,woolOrderId:link.woolOrderId,handovers:handovers.map(h=>({handoverId:h.handoverId,qty:h.handoverQty})),factoryId:task.factoryId}
}
