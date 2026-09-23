import type { WebbingSpecification } from './webbing-specifications.ts'
import type { TechnicalProcessEntry } from '../pcs-technical-data-version-types.ts'
import { PMS_STYLE_IMAGES } from '../pms/images.ts'
import { registerPmsMaterialRequirementPrototype } from '../pms/material-requirements.ts'
import { registerPmsMaterialPurchaseOrderPrototype } from '../pms/material-purchase-orders.ts'
import {
  acceptTmfBaseOrder, createTmfMaterialPurchase, dispatchTmfBaseProduction, dispatchTmfOutputPackage,
  dispatchTmfBaseMaterial, generateTmfBaseOrder, getTmfPurchaseState, issueTmfContinuousMaterial, packTmfOutput,
  consumeTmfBaseMaterial, receiveTmfBaseMaterial, receiveTmfBaseMaterialStock,
  receiveTmfBaseProduction, receiveTmfProcessingMaterial, registerTmfProductionOrder,
  releaseTmfMaterialPurchase, reportTmfBaseProduction, reportTmfCutOutput, reserveTmfContinuousMaterial,
  receiveTmfOutputPackage, allocateTmfOutputPackage, issueTmfProductionPackage, receiveTmfProductionPackage,
  type TmfPurchaseActor,
} from '../pms/tmf-material-purchases.ts'

export const TMF_DEMO_SUPERVISOR: TmfPurchaseActor = { id: 'TMF-DEMO-SUPERVISOR', name: '织带厂主管（演示）', role: '织带厂主管' }
const buyer: TmfPurchaseActor = { id: 'TMF-DEMO-BUYER', name: '采购员（演示）', role: '采购员' }
const warehouse: TmfPurchaseActor = { id: 'TMF-DEMO-WAREHOUSE', name: '辅料仓管（演示）', role: '仓管' }
const planner: TmfPurchaseActor = { id: 'TMF-DEMO-PLANNER', name: '生产计划（演示）', role: '生产计划' }
const productionReceiver: TmfPurchaseActor = { id: 'TMF-DEMO-PRODUCTION-RECEIVER', name: '成衣生产领料人（演示）', role: '生产领料人' }
const prototypeMaterials = [
  { spu: 'WB20', sku: 'WB20-WHT', code: 'WB20-WHT', name: '白色织带 20mm 半成品', type: '织带' as const, image: '/materials/tmf/webbing-real-roll.jpg' },
  { spu: 'WB30', sku: 'WB30-WHT', code: 'WB30-WHT', name: '白色织带 30mm 半成品', type: '织带' as const, image: '/materials/tmf/webbing-real-roll.jpg' },
  { spu: 'WB40', sku: 'WB40-WHT', code: 'WB40-WHT', name: '白色织带 40mm 半成品', type: '织带' as const, image: '/materials/tmf/webbing-real-roll.jpg' },
  { spu: 'CORD-R5', sku: 'CORD-WHT', code: 'CORD-WHT', name: '白色绳子 5mm 半成品', type: '绳子' as const, image: '/materials/tmf/rope-real-bundle.jpg' },
]

function hasOperation(operationId: string): boolean {
  return getTmfPurchaseState().operations.some((item) => item.id === operationId)
}

function once(operationId: string, action: () => void): void {
  if (!hasOperation(operationId)) action()
}

function mockProductionOrder(id: string, materialSkuId: string, pieces: number, specifications?: WebbingSpecification[]) {
  const specification: WebbingSpecification = {
    id: `${id}-SPEC`, bomItemId: `${id}-BOM`, usage: '腰带', garmentSize: 'S', piecesPerGarment: 1,
    cutLengthMm: 500, finishedLengthMm: 500, lengthBasis: 'EXCLUDING_ENDS', toleranceMm: 2,
    measurementCondition: '自然平放', cuttingMethod: '热切', acceptanceRequirement: '长度与切口符合技术包快照',
    tippingRequired: false, endA: { method: 'NONE', specification: '' }, endB: { method: 'NONE', specification: '' },
  }
  const routeSpecifications = specifications ?? [specification]
  const tipped = routeSpecifications.some((item) => item.tippingRequired)
  const tipMaterials = [...new Map(routeSpecifications.flatMap((item) => [item.endA, item.endB])
    .filter((end) => end.method !== 'NONE' && end.materialBomItemId)
    .map((end) => [end.materialBomItemId!, end])).values()]
  const cutEntry: TechnicalProcessEntry = {
    id: `${id}-CUT`, entryType: 'PROCESS_BASELINE', stageCode: 'PREP', stageName: '准备阶段', processCode: 'WEBBING_CUT', processName: '织带／绳子截断',
    assignmentGranularity: 'DETAIL', defaultDocType: 'PREPARATION_ORDER', taskTypeMode: 'PROCESS', isSpecialCraft: false,
    routeObjectKey: `BOM:${id}-BOM`, linkedBomItemIds: [`${id}-BOM`], inputObjectType: 'ACCESSORY', outputObjectType: 'ACCESSORY',
    inputInventoryForm: 'CONTINUOUS', outputInventoryForm: tipped ? 'CUT_PIECES' : 'FINISHED_PIECES', inputMaterialSkuId: materialSkuId, outputMaterialSkuId: materialSkuId,
    predecessorEntryIds: [], webbingSpecifications: routeSpecifications,
  }
  const processEntries: TechnicalProcessEntry[] = [cutEntry]
  if (tipped) processEntries.push({ ...structuredClone(cutEntry), id: `${id}-TIP`, processCode: 'WEBBING_TIP', processName: '绳子打头',
    inputInventoryForm: 'CUT_PIECES', outputInventoryForm: 'FINISHED_PIECES', predecessorEntryIds: [cutEntry.id] })
  const sizes = [...new Set(routeSpecifications.map((item) => item.garmentSize))]
  const pack = {
    snapshotId: `${id}-SNAPSHOT-V1`, productionOrderId: id, productionOrderNo: id, status: 'RELEASED' as const,
    sourceTechPackVersionId: `${id}-TECH-V1`, sourceTechPackVersionCode: `${id}-TECH-V1`, sourceTechPackVersionLabel: 'V1',
    versionLabel: 'V1', styleId: `${id}-STYLE`, styleCode: `${id}-STYLE`, styleName: 'TMF 串联 Mock 款式',
    sourcePublishedAt: '2026-09-23T00:00:00.000Z', snapshotAt: '2026-09-23T00:00:00.000Z', snapshotBy: planner.name,
    patternDesc: '', patternFiles: [], sizeTable: [], sizeMeasurements: [], colorMaterialMappings: [], cutPieceParts: [],
    imageSnapshot: { primaryImageUrl: '', imageUrls: [] }, patternDesigns: [], linkedDesignRevisionTaskIds: [], linkedPatternTaskIds: [], linkedArtworkTaskIds: [], completenessScore: 100,
    bomItems: [
      { id: `${id}-BOM`, name: '白色织带／绳子半成品', type: '辅料', materialSkuId, unit: '米', applicableSkuCodes: [] },
      ...tipMaterials.map((end) => ({ id: end.materialBomItemId!, name: end.specification, type: '辅料' as const,
        materialSkuId: end.method === 'METAL' ? 'METAL-M4' : end.method === 'PLASTIC_WRAP' ? 'PLASTIC-P4' : 'SILICONE-CLEAR',
        unit: end.materialUnit ?? '', applicableSkuCodes: [] })),
    ],
    processEntries,
  }
  return {
    productionOrderId: id, productionOrderNo: id, status: 'EXECUTING' as const,
    techPackSnapshot: pack,
    demandSnapshot: { demandId: `${id}-DEMAND`, spuCode: `${id}-STYLE`, spuName: 'TMF 串联 Mock 款式', buyerName: '演示买手', merchandiserName: '演示跟单',
      saleType: 'NORMAL' as const, priority: '普通', requiredDeliveryDate: '2026-10-05', constraintsNote: '',
      skuLines: sizes.map((size) => ({ skuCode: `${id}-${size}`, size, color: '白色', qty: pieces })) },
  } as unknown as Parameters<typeof registerTmfProductionOrder>[0]
}

function specification(id: string, size: string, lengthMm: number, options?: {
  usage?: string
  endA?: WebbingSpecification['endA']
  endB?: WebbingSpecification['endB']
}): WebbingSpecification {
  const endA = options?.endA ?? { method: 'NONE' as const, specification: '' }
  const endB = options?.endB ?? { method: 'NONE' as const, specification: '' }
  return {
    id: `${id}-SPEC-${size}`, bomItemId: `${id}-BOM`, usage: options?.usage ?? '腰带', garmentSize: size, piecesPerGarment: 1,
    cutLengthMm: lengthMm, finishedLengthMm: lengthMm, lengthBasis: 'EXCLUDING_ENDS', toleranceMm: 2,
    measurementCondition: '自然平放', cuttingMethod: '热切', acceptanceRequirement: '长度、切口和端头符合技术包快照',
    tippingRequired: endA.method !== 'NONE' || endB.method !== 'NONE', endA, endB,
  }
}

/** 内建串联 Mock：五类页面都从同一批采购、加工、收发事实投影，且重复调用不会重置已执行记录。 */
export function ensureTmfConnectedMockData(): void {
  for (let i = 0; i < 12; i++) {
    const no = `TMF-MOCK-PO-${String(i + 1).padStart(3, '0')}`
    const material = prototypeMaterials[i % prototypeMaterials.length]
    const quantity = 100 + i * 10
    const requirementNo = `MR-TMF-${String(i + 1).padStart(3, '0')}`
    const requirementLineNo = `${requirementNo}-L1`
    const sourceProductPurchaseOrderNo = `CG-TMF-${String(i + 1).padStart(3, '0')}`
    const styleImageUrl = [PMS_STYLE_IMAGES.hoodie, PMS_STYLE_IMAGES.shirt, PMS_STYLE_IMAGES.dress, PMS_STYLE_IMAGES.jacket][i % 4]
    const purchase = {
      purchaseOrderNo: no, purchaseLineId: `${no}-L1`, version: 1, supplierId: 'TMF-DEMO-SUPPLIER', supplierName: 'TMF 半成品供应方',
      factoryOrgId: 'FAC-TMF', materialSkuId: material.sku, materialSpuId: material.spu, accessoryType: material.type,
      targetWarehouseId: 'TMF-DEMO-ACCESSORY-WH', productionStandard: `${material.type === '绳子' ? '绳径' : '幅宽'}由 SPU ${material.spu} 固定；颜色由 SKU ${material.sku} 区分`,
      baseMaterialRecipe: { materialSkuId: 'YARN-DEMO-01', unit: 'kg' as const, quantityPerMeter: 0.02, specification: '每米耗用 0.02kg 演示纱线，以实际领料、实收、耗用校验产出' },
      requirementNo, sourceRequirementLineNo: requirementLineNo, sourceProductPurchaseOrderNo,
      materialCode: material.code, materialName: material.name, materialType: '辅料', materialImageUrl: material.image, unit: '米',
      styleCode: `ST-TMF-${String((i % 4) + 1).padStart(3, '0')}`, styleName: `TMF 关联款式 ${(i % 4) + 1}`, styleImageUrl,
      warehouse: '中央辅料仓', orderedQty: quantity, receivedQty: 0, unitPrice: 1.8 + i * 0.1, currency: 'RMB', status: '待采购',
      orderDate: '2026-09-23', expectedArrivalDate: `2026-10-${String(1 + (i % 9)).padStart(2, '0')}`, buyerName: buyer.name,
      supplierConfirmed: i % 3 !== 0, supplierConfirmedAt: i % 3 !== 0 ? '2026-09-23T02:00:00.000Z' : '', remark: '原型内建串联 Mock，用于验证页面与数量链路。',
    } as const
    registerPmsMaterialRequirementPrototype({ requirementNo, sourcePurchaseOrderNo: sourceProductPurchaseOrderNo, sourceSuggestionNo: '', spu: purchase.styleCode,
      productName: purchase.styleName, styleImageUrl, createdAt: '2026-09-23T01:00:00.000Z', status: '已下推', lines: [{ lineNo: requirementLineNo,
        materialCode: purchase.materialCode, materialName: purchase.materialName, materialType: '辅料', imageUrl: purchase.materialImageUrl, unit: '米',
        styleCode: purchase.styleCode, styleName: purchase.styleName, styleImageUrl, sourceSku: `${purchase.styleCode}-S`, skuQty: quantity,
        usagePerPiece: 1, lossRate: 0, plannedUsage: 1, bomDemand: quantity, stockQty: 0, historicalStockQty: 0, idHistoricalStockQty: 0,
        purchasingQty: 0, suggestedQty: quantity, actualQty: quantity, supplierName: purchase.supplierName, warehouse: purchase.warehouse,
        pushStatus: '已下推', generatedPurchaseOrderNo: no }] })
    registerPmsMaterialPurchaseOrderPrototype(purchase)
    once(`${no}:create`, () => createTmfMaterialPurchase(purchase, buyer, `${no}:create`))
    once(`${no}:release`, () => releaseTmfMaterialPurchase(no, buyer, `${no}:release`))
    once(`${no}:generate`, () => generateTmfBaseOrder(no, TMF_DEMO_SUPERVISOR, `${no}:generate`))
    const base = getTmfPurchaseState().baseOrders.find((item) => item.purchaseOrderNo === no)!
    if (i >= 2) once(`${no}:receive-order`, () => acceptTmfBaseOrder(base.id, TMF_DEMO_SUPERVISOR, `${no}:receive-order`))
    if (i >= 4) {
      const producedMeters = i < 7 ? quantity / 2 : quantity
      const rawQty = producedMeters * purchase.baseMaterialRecipe.quantityPerMeter
      once(`${no}:raw-stock`, () => receiveTmfBaseMaterialStock({ id: `${no}:raw-lot`, materialSkuId: purchase.baseMaterialRecipe.materialSkuId,
        warehouseId: 'TMF-DEMO-ACCESSORY-WH', location: `RAW-${i + 1}`, unit: purchase.baseMaterialRecipe.unit, receivedQty: rawQty,
        sourceReceiptNo: `${no}:raw-receipt`, sourceReceiptLineId: `${no}:raw-receipt-L1` }, warehouse, `${no}:raw-stock`))
      once(`${no}:raw-dispatch`, () => dispatchTmfBaseMaterial({ id: `${no}:raw-issue`, baseOrderId: base.id, lotId: `${no}:raw-lot`, quantity: rawQty }, warehouse, `${no}:raw-dispatch`))
      once(`${no}:raw-receive`, () => receiveTmfBaseMaterial({ issueId: `${no}:raw-issue`, materialSkuId: purchase.baseMaterialRecipe.materialSkuId, unit: purchase.baseMaterialRecipe.unit, quantity: rawQty }, TMF_DEMO_SUPERVISOR, `${no}:raw-receive`))
      once(`${no}:raw-consume`, () => consumeTmfBaseMaterial({ issueId: `${no}:raw-issue`, consumedQty: rawQty, scrapQty: 0, reason: '按原料配方完成本批半成品加工' }, TMF_DEMO_SUPERVISOR, `${no}:raw-consume`))
      once(`${no}:produce`, () => reportTmfBaseProduction(base.id, producedMeters, TMF_DEMO_SUPERVISOR, `${no}:produce`))
    }
    if (i >= 7) once(`${no}:dispatch`, () => dispatchTmfBaseProduction({ baseOrderId: base.id, handoverId: `${no}:handover`, batchId: `${no}:batch`, dispatchedMeters: quantity }, TMF_DEMO_SUPERVISOR, `${no}:dispatch`))
    if (i >= 8) once(`${no}:warehouse-receive`, () => receiveTmfBaseProduction({ handoverId: `${no}:handover`, materialSkuId: material.sku, warehouseId: 'TMF-DEMO-ACCESSORY-WH', location: `WB-${i + 1}`, receivedMeters: quantity }, warehouse, `${no}:warehouse-receive`))
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
      if (scenario.handover) {
        once(`${scenario.id}:handover`, () => dispatchTmfOutputPackage({ handoverId: `${scenario.id}:handover`, packageId: `${scenario.id}:package`, warehouseId: sourcePurchase.targetWarehouseId }, TMF_DEMO_SUPERVISOR, `${scenario.id}:handover`))
        once(`${scenario.id}:output-receive`, () => receiveTmfOutputPackage({ handoverId: `${scenario.id}:handover`, packageId: `${scenario.id}:package`, warehouseId: sourcePurchase.targetWarehouseId, demandId: demand.id, location: 'FIN-A01', receivedPieces: scenario.pieces }, warehouse, `${scenario.id}:output-receive`))
        once(`${scenario.id}:allocate`, () => allocateTmfOutputPackage({ allocationId: `${scenario.id}:allocation`, packageId: `${scenario.id}:package`, demandId: demand.id, pieces: scenario.pieces, receiverId: productionReceiver.id, receiverOrganizationId: `${scenario.id}:production-line` }, planner, `${scenario.id}:allocate`))
        once(`${scenario.id}:production-issue`, () => issueTmfProductionPackage({ issueId: `${scenario.id}:production-issue`, allocationId: `${scenario.id}:allocation`, packageId: `${scenario.id}:package`, demandId: demand.id, warehouseId: sourcePurchase.targetWarehouseId, pieces: scenario.pieces }, warehouse, `${scenario.id}:production-issue`))
        once(`${scenario.id}:production-receive`, () => receiveTmfProductionPackage({ issueId: `${scenario.id}:production-issue`, packageId: `${scenario.id}:package`, demandId: demand.id, receiverOrganizationId: `${scenario.id}:production-line`, pieces: scenario.pieces }, productionReceiver, `${scenario.id}:production-receive`))
      }
    }
  }

  // 可见边界数据仍沿用上述采购、批次和技术包事实：同 SKU 的两种长度不拆 SKU；
  // 绳子三种端头要求只由技术包规格区分，未加工前不虚构端头耗用和产出。
  const visibleBoundaries = [
    {
      id: 'TMF-WO-MOCK-004', sourceOrderNo: 'TMF-MOCK-PO-009', lotId: 'TMF-MOCK-PO-009:batch', materialSkuId: 'WB20-WHT', pieces: 40,
      specifications: [specification('TMF-WO-MOCK-004', 'S', 500), specification('TMF-WO-MOCK-004', 'M', 700)],
    },
    {
      id: 'TMF-WO-MOCK-005', sourceOrderNo: 'TMF-MOCK-PO-012', lotId: 'TMF-MOCK-PO-012:batch', materialSkuId: 'CORD-WHT', pieces: 10,
      specifications: [
        specification('TMF-WO-MOCK-005', 'S', 600, { usage: '帽绳', endA: { method: 'METAL', specification: '银色金属头', materialBomItemId: 'HEAD-METAL-BOM', materialUnit: '个' }, endB: { method: 'METAL', specification: '银色金属头', materialBomItemId: 'HEAD-METAL-BOM', materialUnit: '个' } }),
        specification('TMF-WO-MOCK-005', 'M', 650, { usage: '帽绳', endA: { method: 'PLASTIC_WRAP', specification: '黑色塑料头', materialBomItemId: 'HEAD-PLASTIC-BOM', materialUnit: '个' }, endB: { method: 'PLASTIC_WRAP', specification: '黑色塑料头', materialBomItemId: 'HEAD-PLASTIC-BOM', materialUnit: '个' } }),
        specification('TMF-WO-MOCK-005', 'L', 700, { usage: '帽绳', endA: { method: 'SILICONE_DIP', specification: '透明硅胶浸头', materialBomItemId: 'HEAD-SILICONE-BOM', materialUnit: 'kg', coverageMm: 15 }, endB: { method: 'SILICONE_DIP', specification: '透明硅胶浸头', materialBomItemId: 'HEAD-SILICONE-BOM', materialUnit: 'kg', coverageMm: 15 } }),
      ],
    },
  ]
  for (const scenario of visibleBoundaries) {
    once(`${scenario.id}:register`, () => registerTmfProductionOrder(mockProductionOrder(scenario.id, scenario.materialSkuId, scenario.pieces, scenario.specifications), planner, `${scenario.id}:register`))
    if (!getTmfPurchaseState().lots.some((item) => item.id === scenario.lotId && item.sourcePurchaseOrderNo === scenario.sourceOrderNo)) {
      throw new Error(`串联 Mock 缺少来源采购批次：${scenario.sourceOrderNo}`)
    }
    const demands = getTmfPurchaseState().demands.filter((item) => item.productionOrderId === scenario.id)
    for (const demand of demands) {
      const suffix = demand.specification.garmentSize
      const meters = demand.theoreticalCutMeters
      once(`${scenario.id}:${suffix}:reserve`, () => reserveTmfContinuousMaterial({ reservationId: `${scenario.id}:${suffix}:reservation`, demandId: demand.id, lotId: scenario.lotId, reservedMeters: meters, reason: '串联 Mock 按技术包长度独立备料' }, planner, `${scenario.id}:${suffix}:reserve`))
      once(`${scenario.id}:${suffix}:issue`, () => issueTmfContinuousMaterial({ issueId: `${scenario.id}:${suffix}:issue`, reservationId: `${scenario.id}:${suffix}:reservation`, targetFactoryId: 'FAC-TMF', dispatchedMeters: meters }, warehouse, `${scenario.id}:${suffix}:issue`))
      once(`${scenario.id}:${suffix}:receive`, () => receiveTmfProcessingMaterial({ issueId: `${scenario.id}:${suffix}:issue`, factoryId: 'FAC-TMF', materialSkuId: scenario.materialSkuId, receivedMeters: meters }, TMF_DEMO_SUPERVISOR, `${scenario.id}:${suffix}:receive`))
    }
  }
}
