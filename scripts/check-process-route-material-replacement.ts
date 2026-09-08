import assert from 'node:assert/strict'
import { productionOrders } from '../src/data/fcs/production-orders.ts'
import { listMaterialArchives } from '../src/data/pcs-material-archive-repository.ts'
import { getProductionOrderChangeCurrentFacts, getProductionOrderTechPackRelation } from '../src/data/fcs/production-tech-pack-change-domain.ts'
import { buildProductionChangePreview, listAffectedDocumentNosForOrder } from '../src/data/fcs/production-order-change-workflow.ts'
import { createInitializedProductionChangeForm, executeProductionChangeForForm } from '../src/pages/production/events.ts'
import { buildFormalProductionOrderProcessSnapshots, ensureProcessWorkOrdersForFormalProductionOrder } from '../src/data/fcs/production-process-work-order-service.ts'
import { getDyeWorkOrderById } from '../src/data/fcs/dyeing-task-domain.ts'
import { getPrintWorkOrderById } from '../src/data/fcs/printing-task-domain.ts'
import { createProcessHandoverRecord, getProcessHandoverRecordById } from '../src/data/fcs/process-warehouse-domain.ts'

// GOV-007 / EXEC-013：夹具仅补染色→印花路线；替换执行使用页面正式命令，不直接改执行事实。
const order = productionOrders.find((item) => item.productionOrderId === 'PO-202603-0004')!
assert(order?.techPackSnapshot)
const originalSnapshot = structuredClone(order.techPackSnapshot)
const fact = getProductionOrderChangeCurrentFacts(order.productionOrderId)!.materialFacts.find((item) => item.sourceBomItemId)!
const bom = order.techPackSnapshot.bomItems.find((item) => item.id === fact.sourceBomItemId)!
assert(bom)
bom.materialCode = fact.snapshotMaterialId!
bom.unit = '米'
bom.unitConsumption = 1
bom.lossRate = 0
const entryTemplate = order.techPackSnapshot.processEntries[0]
assert(entryTemplate)
const branch = `BOM:${bom.id}`
order.techPackSnapshot.processEntries.push(...(['DYE', 'PRINT'] as const).map((code, index) => ({
  ...entryTemplate, id: `REPLACEMENT-${code}`, stageCode: 'PREP' as const, stageName: '准备阶段',
  processCode: code, processName: code === 'DYE' ? '染色' : '印花',
  linkedBomItemIds: [bom.id], routeObjectKey: branch,
  inputObjectType: 'FABRIC' as const, outputObjectType: 'FABRIC' as const,
  predecessorEntryIds: index ? ['REPLACEMENT-DYE'] : [],
})))
const frozenBefore = structuredClone(order.techPackSnapshot)
const relationBefore = getProductionOrderTechPackRelation(order.productionOrderId)!
const beforeSnapshots = buildFormalProductionOrderProcessSnapshots(order)
const dyeSnapshot = beforeSnapshots.find((item) => item.processEntryId === 'REPLACEMENT-DYE')!
assert(dyeSnapshot)
const dye = ensureProcessWorkOrdersForFormalProductionOrder(dyeSnapshot)
assert(dye.dyeWorkOrderId)
// 已交接事实通过共享交出命令登记，保留其当时物料，而不是复制变量冒充历史记录。
const oldHandover = createProcessHandoverRecord({
  craftType: 'DYE', craftName: '染色', sourceWorkOrderNo: getDyeWorkOrderById(dye.dyeWorkOrderId)!.dyeOrderNo,
  sourceTaskOrderId: dye.dyeWorkOrderId, sourceType: 'PRODUCTION_ORDER',
  sourceProductionOrderId: order.productionOrderId, sourceProductionOrderNo: order.productionOrderNo,
  stockMaterialId: dyeSnapshot.materialId, stockMaterialName: dyeSnapshot.materialName,
  objectType: '面料', handoverObjectQty: 10, qtyUnit: '米',
  handoverFactoryId: 'F090', handoverFactoryName: '染色工厂', receiveFactoryName: '印花工厂',
})
const replacement = listMaterialArchives('fabric').find((item) => item.materialCode !== dyeSnapshot.materialId)!
assert(replacement)
const form = createInitializedProductionChangeForm(order.productionOrderId, 'MATERIAL_REPLACEMENT')
form.reason = '路线物料替换专项：剩余数量使用新料，历史交接保留原料'
Object.assign(form.materialReplacement, {
  originalMaterialId: fact.id, replacementMaterialId: replacement.materialId,
  replacementMode: 'REMAINING', scope: 'CURRENT_ONLY', followingOrders: [],
})
const draft = () => ({
  productionOrderId: form.productionOrderId, changeType: form.changeType, reason: form.reason,
  quantityLines: form.quantityLines, materialReplacement: form.materialReplacement,
  decisionValues: form.decisionValues, affectedDocumentNos: listAffectedDocumentNosForOrder(form.productionOrderId),
})
form.decisionValues = Object.fromEntries(buildProductionChangePreview(draft()).decisionItems.map((item) => [
  item.id, { value: item.options[0].value, reason: '按当前事实采用建议方案' },
]))
form.confirmedFactsFingerprint = buildProductionChangePreview(draft()).factsFingerprint
const execution = executeProductionChangeForForm(form, { executedAt: '2026-09-07 12:00:00' })
assert.equal(execution.error, '')
assert.equal(form.execution.status, 'DONE', JSON.stringify(form.execution))
assert.equal(form.execution.result, 'PRODUCTION_PATCH')
const relationAfter = getProductionOrderTechPackRelation(order.productionOrderId)!
assert.equal(relationAfter.currentTechPackVersionId, relationBefore.currentTechPackVersionId)
assert.equal(relationAfter.frozenSnapshotId, relationBefore.frozenSnapshotId)
assert.deepEqual(order.techPackSnapshot, frozenBefore, '替换不能改写冻结 BOM、路线 occurrence 或显式边')
assert.equal(getDyeWorkOrderById(dye.dyeWorkOrderId)!.materialId, replacement.materialCode, '已有未开工单读取新料')
assert.deepEqual(getProcessHandoverRecordById(oldHandover.handoverRecordId), oldHandover, '已交接记录必须保留原料及全部现场事实')
console.log('PASS: 正式替换命令完成，技术包/冻结快照/occurrence稳定，已有未开工单读新料，历史交接未变')
const afterSnapshots = buildFormalProductionOrderProcessSnapshots(order)
assert.deepEqual(afterSnapshots.map(({ processEntryId, routeObjectKey, plannedQty, qtyUnit, techPackVersionId }) => ({
  processEntryId, routeObjectKey, plannedQty, qtyUnit, techPackVersionId,
})), beforeSnapshots.map(({ processEntryId, routeObjectKey, plannedQty, qtyUnit, techPackVersionId }) => ({
  processEntryId, routeObjectKey, plannedQty, qtyUnit, techPackVersionId,
})), '替换只改变执行物料，不改节点身份、技术包版本或数量单位')
const nextPrint = afterSnapshots.find((item) => item.processEntryId === 'REPLACEMENT-PRINT')!
assert(nextPrint)
assert.equal(nextPrint.routeObjectKey, branch)
assert.equal(nextPrint.techPackVersionId, dyeSnapshot.techPackVersionId)
assert.equal(nextPrint.materialId, replacement.materialCode, '替换后才派生的下游印花必须读取当前执行新料，不能回退冻结 BOM 原料')
assert.equal(nextPrint.materialName, replacement.materialName)
const anotherVersion = structuredClone(order)
anotherVersion.techPackSnapshot!.sourceTechPackVersionId = 'OTHER-FROZEN-VERSION'
assert.equal(buildFormalProductionOrderProcessSnapshots(anotherVersion).find((item) => item.processEntryId === nextPrint.processEntryId)!.materialId,
  dyeSnapshot.materialId, '当前版本的物料替换不能串入其他冻结版本')
const created = ensureProcessWorkOrdersForFormalProductionOrder(nextPrint)
assert(created.printWorkOrderId)
assert.equal(getPrintWorkOrderById(created.printWorkOrderId)!.materialSku, replacement.materialCode)
assert.deepEqual(order.techPackSnapshot, frozenBefore)
order.techPackSnapshot = originalSnapshot
console.log('PASS: 新生成下游印花单使用替换物料，完整物料替换链路通过')
