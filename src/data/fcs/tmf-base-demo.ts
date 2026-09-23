import { tmfReferenceMaterials, tmfReferenceSkus } from '../pcs-tmf-material-reference-seeds.ts'
import { getProductionOrderTechPackSnapshot, productionOrders } from './production-orders.ts'
import type { WebbingSpecification } from './webbing-specifications.ts'
import {
  acceptTmfBaseOrder, createTmfMaterialPurchase, dispatchTmfBaseProduction, dispatchTmfOutputPackage,
  generateTmfBaseOrder, getTmfPurchaseState, issueTmfContinuousMaterial, packTmfOutput,
  receiveTmfBaseProduction, receiveTmfProcessingMaterial, registerTmfProductionOrder,
  releaseTmfMaterialPurchase, reportTmfBaseProduction, reportTmfCutOutput, reserveTmfContinuousMaterial,
  type TmfPurchaseActor,
} from '../pms/tmf-material-purchases.ts'

export const TMF_DEMO_SUPERVISOR: TmfPurchaseActor = { id: 'TMF-DEMO-SUPERVISOR', name: '织带厂主管（演示）', role: '织带厂主管' }
const buyer: TmfPurchaseActor = { id: 'TMF-DEMO-BUYER', name: '采购员（演示）', role: '采购员' }
const warehouse: TmfPurchaseActor = { id: 'TMF-DEMO-WAREHOUSE', name: '辅料仓管（演示）', role: '仓管' }
const planner: TmfPurchaseActor = { id: 'TMF-DEMO-PLANNER', name: '生产计划（演示）', role: '生产计划' }

function hasOperation(operationId: string): boolean {
  return getTmfPurchaseState().operations.some((item) => item.id === operationId)
}

function once(operationId: string, action: () => void): void {
  if (!hasOperation(operationId)) action()
}

function mockProductionOrder(id: string, materialSkuId: string, pieces: number) {
  const template = productionOrders.find((order) => order.techPackSnapshot)
  if (!template) throw new Error('缺少可用的生产单技术包模板。')
  const pack = getProductionOrderTechPackSnapshot(template.productionOrderId)
  if (!pack) throw new Error('生产单技术包快照不存在。')
  const specification: WebbingSpecification = {
    id: `${id}-SPEC`, bomItemId: `${id}-BOM`, usage: '腰带', garmentSize: 'S', piecesPerGarment: 1,
    cutLengthMm: 500, finishedLengthMm: 500, lengthBasis: 'EXCLUDING_ENDS', toleranceMm: 2,
    measurementCondition: '自然平放', cuttingMethod: '热切', acceptanceRequirement: '长度与切口符合技术包快照',
    tippingRequired: false, endA: { method: 'NONE', specification: '' }, endB: { method: 'NONE', specification: '' },
  }
  pack.productionOrderId = id
  pack.snapshotId = `${id}-SNAPSHOT-V1`
  pack.sourceTechPackVersionId = `${id}-TECH-V1`
  pack.bomItems = [{ ...pack.bomItems[0], id: `${id}-BOM`, name: '白色织带半成品', type: '辅料', materialSkuId, applicableSkuCodes: [] }]
  pack.processEntries = [{
    id: `${id}-CUT`, entryType: 'PROCESS_BASELINE', stageCode: 'PREP', stageName: '准备阶段', processCode: 'WEBBING_CUT', processName: '织带／绳子截断',
    assignmentGranularity: 'DETAIL', defaultDocType: 'PREPARATION_ORDER', taskTypeMode: 'PROCESS', isSpecialCraft: false,
    routeObjectKey: `BOM:${id}-BOM`, linkedBomItemIds: [`${id}-BOM`], inputObjectType: 'ACCESSORY', outputObjectType: 'ACCESSORY',
    inputInventoryForm: 'CONTINUOUS', outputInventoryForm: 'FINISHED_PIECES', inputMaterialSkuId: materialSkuId, outputMaterialSkuId: materialSkuId,
    predecessorEntryIds: [], webbingSpecifications: [specification],
  }]
  return {
    productionOrderId: id, productionOrderNo: id, status: 'EXECUTING' as const, techPackSnapshot: pack,
    demandSnapshot: { ...structuredClone(template.demandSnapshot), requiredDeliveryDate: '2026-10-05', skuLines: [{ skuCode: `${id}-S`, size: 'S', color: '白色', qty: pieces }] },
  }
}

/** 内建串联 Mock：五类页面都从同一批采购、加工、收发事实投影，且重复调用不会重置已执行记录。 */
export function ensureTmfConnectedMockData(): void {
  for (let i = 0; i < 12; i++) {
    const no = `TMF-MOCK-PO-${String(i + 1).padStart(3, '0')}`
    const material = tmfReferenceMaterials[i % 2]
    const sku = tmfReferenceSkus[i % 2]
    const quantity = 100 + i * 10
    once(`${no}:create`, () => createTmfMaterialPurchase({
      purchaseOrderNo: no, purchaseLineId: `${no}-L1`, version: 1, supplierId: 'TMF-DEMO-SUPPLIER', supplierName: 'TMF 半成品供应方',
      factoryOrgId: 'FAC-TMF', materialSkuId: sku.materialSkuId, materialSpuId: material.materialId, accessoryType: i % 2 ? '绳子' : '织带',
      targetWarehouseId: 'TMF-DEMO-ACCESSORY-WH', productionStandard: `${i % 2 ? '绳径' : '幅宽'}按采购行与技术包快照核对`,
      requirementNo: `MR-TMF-${String(i + 1).padStart(3, '0')}`, sourceRequirementLineNo: `MR-TMF-${String(i + 1).padStart(3, '0')}-L1`, sourceProductPurchaseOrderNo: `CG-TMF-${String(i + 1).padStart(3, '0')}`,
      materialCode: sku.materialSkuCode, materialName: material.materialName, materialType: '辅料', materialImageUrl: sku.skuImageUrl, unit: '米',
      styleCode: `ST-TMF-${String((i % 4) + 1).padStart(3, '0')}`, styleName: `TMF 关联款式 ${(i % 4) + 1}`, styleImageUrl: sku.skuImageUrl,
      warehouse: '中央辅料仓', orderedQty: quantity, receivedQty: 0, unitPrice: 1.8 + i * 0.1, currency: 'RMB', status: '待采购',
      orderDate: '2026-09-23', expectedArrivalDate: `2026-10-${String(1 + (i % 9)).padStart(2, '0')}`, buyerName: buyer.name,
      supplierConfirmed: i % 3 !== 0, supplierConfirmedAt: i % 3 !== 0 ? '2026-09-23T02:00:00.000Z' : '', remark: '原型内建串联 Mock，用于验证页面与数量链路。',
    }, buyer, `${no}:create`))
    once(`${no}:release`, () => releaseTmfMaterialPurchase(no, buyer, `${no}:release`))
    once(`${no}:generate`, () => generateTmfBaseOrder(no, TMF_DEMO_SUPERVISOR, `${no}:generate`))
    const base = getTmfPurchaseState().baseOrders.find((item) => item.purchaseOrderNo === no)!
    if (i >= 2) once(`${no}:receive-order`, () => acceptTmfBaseOrder(base.id, TMF_DEMO_SUPERVISOR, `${no}:receive-order`))
    if (i >= 4) once(`${no}:produce`, () => reportTmfBaseProduction(base.id, i < 7 ? quantity / 2 : quantity, TMF_DEMO_SUPERVISOR, `${no}:produce`))
    if (i >= 7) once(`${no}:dispatch`, () => dispatchTmfBaseProduction({ baseOrderId: base.id, handoverId: `${no}:handover`, batchId: `${no}:batch`, dispatchedMeters: quantity }, TMF_DEMO_SUPERVISOR, `${no}:dispatch`))
    if (i >= 8) once(`${no}:warehouse-receive`, () => receiveTmfBaseProduction({ handoverId: `${no}:handover`, materialSkuId: sku.materialSkuId, warehouseId: 'TMF-DEMO-ACCESSORY-WH', location: `WB-${i + 1}`, receivedMeters: quantity }, warehouse, `${no}:warehouse-receive`))
  }

  const sourcePurchase = getTmfPurchaseState().orders.find((item) => item.purchaseOrderNo === 'TMF-MOCK-PO-009')!
  for (const scenario of [
    { id: 'TMF-WO-MOCK-001', pieces: 40, receive: 0, report: false, handover: false },
    { id: 'TMF-WO-MOCK-002', pieces: 50, receive: 12.5, report: false, handover: false },
    { id: 'TMF-WO-MOCK-003', pieces: 60, receive: 30, report: true, handover: true },
  ]) {
    const order = mockProductionOrder(scenario.id, sourcePurchase.materialSkuId, scenario.pieces)
    once(`${scenario.id}:demand`, () => registerTmfProductionOrder(order, planner, `${scenario.id}:demand`))
    const demand = getTmfPurchaseState().demands.find((item) => item.productionOrderId === scenario.id)!
    const meters = demand.theoreticalCutMeters
    once(`${scenario.id}:reserve`, () => reserveTmfContinuousMaterial({ reservationId: `${scenario.id}:reservation`, demandId: demand.id, lotId: 'TMF-MOCK-PO-009:batch', reservedMeters: meters, reason: '串联 Mock 按技术包理论下料量备料' }, planner, `${scenario.id}:reserve`))
    once(`${scenario.id}:issue`, () => issueTmfContinuousMaterial({ issueId: `${scenario.id}:issue`, reservationId: `${scenario.id}:reservation`, targetFactoryId: 'FAC-TMF', dispatchedMeters: meters }, warehouse, `${scenario.id}:issue`))
    if (scenario.receive > 0) once(`${scenario.id}:receive`, () => receiveTmfProcessingMaterial({ issueId: `${scenario.id}:issue`, factoryId: 'FAC-TMF', materialSkuId: sourcePurchase.materialSkuId, receivedMeters: scenario.receive }, TMF_DEMO_SUPERVISOR, `${scenario.id}:receive`))
    if (scenario.report) {
      once(`${scenario.id}:report`, () => reportTmfCutOutput({ outputId: `${scenario.id}:output`, issueId: `${scenario.id}:issue`, cutPieces: scenario.pieces, defectivePieces: 0, actualCutLengthMm: 500, actualFinishedLengthMm: 500, lossMeters: 0, reason: '串联 Mock 合格产出' }, TMF_DEMO_SUPERVISOR, `${scenario.id}:report`))
      once(`${scenario.id}:pack`, () => packTmfOutput({ packageId: `${scenario.id}:package`, cutOutputId: `${scenario.id}:output`, pieces: scenario.pieces }, TMF_DEMO_SUPERVISOR, `${scenario.id}:pack`))
      if (scenario.handover) once(`${scenario.id}:handover`, () => dispatchTmfOutputPackage({ handoverId: `${scenario.id}:handover`, packageId: `${scenario.id}:package`, warehouseId: sourcePurchase.targetWarehouseId }, TMF_DEMO_SUPERVISOR, `${scenario.id}:handover`))
    }
  }
}
