import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { alignWoolColorMaterialMappingsForDemand } from '../src/data/fcs/production-tech-pack-snapshot-builder.ts'
import {
  buildWoolOrderSourceSnapshot,
  type WoolOrderSourceBuildInput,
} from '../src/data/fcs/wool-domain/tech-pack-source.ts'
import {
  isWoolProcessCode,
  resolveTaskDetailMaterialCode,
} from '../src/data/fcs/task-detail-rows.ts'
import type {
  WoolCompletionRecord,
  WoolHandoverRecord,
} from '../src/data/fcs/wool-domain/types.ts'

const handoverTypeFixture: WoolHandoverRecord = {
  handoverId: 'WH-TYPE-CHECK',
  woolOrderId: 'WO-TYPE-CHECK',
  outputSkuCode: 'GARMENT-BLACK-M',
  handoverQty: 10,
  qtyUnit: '件',
  receiverType: 'DOWNSTREAM_FACTORY',
  receiverId: 'FACTORY-DOWNSTREAM',
  receiverName: '后道工厂',
  handedOverAt: '2026-07-30 12:00:00',
  handedOverBy: '毛织仓管',
  warehouseOutboundFlowId: 'WF-TYPE-CHECK',
  downstreamReceipt: {
    receiptConfirmationId: 'DRC-TYPE-CHECK',
    status: 'CONFIRMED',
    actualReceivedQty: 9,
    differenceQty: -1,
    receivedAt: '2026-07-30 13:00:00',
    receivedBy: '后道收货员',
  },
  createdAt: '2026-07-30 12:00:00',
  updatedAt: '2026-07-30 13:00:00',
}
void handoverTypeFixture

const completionTypeFixture: WoolCompletionRecord = {
  completionId: 'WC-TYPE-CHECK',
  woolOrderId: 'WO-TYPE-CHECK',
  completedAt: '2026-07-30 18:00:00',
  completedBy: '毛织主管',
  confirmationSnapshot: {
    yarnReceiptSummary: [{ yarnSkuCode: 'YARN-A', receivedQty: 20, qtyUnit: 'kg' }],
    outputReadinessSummary: [{
      outputSkuCode: 'GARMENT-BLACK-M',
      requiredYarnSkus: ['YARN-A'],
      confirmedYarnSkus: ['YARN-A'],
      missingYarnSkus: [],
    }],
    processReportSummary: [{ outputSkuCode: 'GARMENT-BLACK-M', reportedQty: 100, qtyUnit: '件' }],
    handoverSummary: [{
      handoverId: 'WH-TYPE-CHECK',
      outputSkuCode: 'GARMENT-BLACK-M',
      handoverQty: 100,
      qtyUnit: '件',
      downstreamActualReceivedQty: 100,
      downstreamDifferenceQty: 0,
      downstreamReceivedAt: '2026-07-30 17:00:00',
    }],
    waitProcessStockSummary: [{ yarnSkuCode: 'YARN-A', stockQty: 0, qtyUnit: 'kg' }],
    waitHandoverStockSummary: [{ outputSkuCode: 'GARMENT-BLACK-M', stockQty: 0, qtyUnit: '件' }],
    releasedMachineIds: ['WM-001'],
  },
}
void completionTypeFixture

assert.equal(isWoolProcessCode('WOOL'), true)
assert.equal(isWoolProcessCode('PROC_WOOL'), true)
assert.equal(isWoolProcessCode('CUT'), false)
assert.equal(resolveTaskDetailMaterialCode({ id: 'BOM-YARN', processCode: 'WOOL' }), '')
assert.equal(resolveTaskDetailMaterialCode({ id: 'BOM-YARN', processCode: 'PROC_WOOL' }), '')
assert.equal(resolveTaskDetailMaterialCode({ id: 'BOM-FABRIC', processCode: 'CUT' }), 'BOM-FABRIC')
assert.equal(resolveTaskDetailMaterialCode({
  id: 'BOM-YARN',
  materialCode: 'YARN-A',
  processCode: 'PROC_WOOL',
}), 'YARN-A')

const sourceBuildInput: WoolOrderSourceBuildInput = {
  taskId: 'TASK-WOOL-SOURCE-CHECK',
  productionOrderId: 'PO-WOOL-SOURCE-CHECK',
  productionOrderNo: 'PO-WOOL-SOURCE-CHECK',
  kind: 'WHOLE_GARMENT',
  sourceTechPackVersionId: 'TPV-WOOL-SOURCE-CHECK',
  sourceTechPackVersionCode: 'TP-WOOL-V1',
  skuLines: [{
    skuCode: 'GARMENT-BLACK-M',
    colorCode: 'BLACK',
    colorName: '黑色',
    sizeCode: 'M',
    plannedQty: 100,
  }],
  bomItems: [
    { id: 'BOM-YARN-A', materialCode: 'YARN-A', usageProcessCodes: ['WOOL'] },
    { id: 'BOM-BAG', materialCode: 'BAG-01', usageProcessCodes: ['PACKAGING'] },
  ],
  colorMaterialMappings: [{
    id: 'MAP-BLACK',
    mappingOrigin: 'TECH_PACK',
    colorCode: 'BLACK',
    lines: [
      { id: 'MAP-LINE-YARN', bomItemId: 'BOM-YARN-A', materialCode: 'YARN-A', applicableSkuCodes: [] },
      { id: 'MAP-LINE-BAG', bomItemId: 'BOM-BAG', materialCode: 'BAG-01', applicableSkuCodes: [] },
    ],
  }],
  woolParts: [{
    woolPartCode: 'SLEEVE',
    woolPartName: '袖片',
    pieceCountPerGarment: 2,
    applicableSkuCodes: [],
  }],
}

const wholeSourceSnapshot = buildWoolOrderSourceSnapshot(sourceBuildInput)
assert.deepEqual(wholeSourceSnapshot.outputPlanLines, [{
  outputSkuCode: 'GARMENT-BLACK-M',
  outputObjectType: 'GARMENT',
  garmentSkuCode: 'GARMENT-BLACK-M',
  colorCode: 'BLACK',
  colorName: '黑色',
  sizeCode: 'M',
  plannedQty: 100,
  qtyUnit: '件',
  requiredYarnSkus: ['YARN-A'],
  sourceTechPackVersionId: 'TPV-WOOL-SOURCE-CHECK',
  sourceTechPackVersionCode: 'TP-WOOL-V1',
  sourceColorMappingIds: ['MAP-BLACK'],
  sourceBomItemIds: ['BOM-YARN-A'],
}])

const partSourceSnapshot = buildWoolOrderSourceSnapshot({
  ...sourceBuildInput,
  kind: 'PART_PANEL',
})
assert.deepEqual(partSourceSnapshot.outputPlanLines, [{
  outputSkuCode: 'WP-SLEEVE-GARMENT-BLACK-M',
  outputObjectType: 'WOOL_PANEL',
  garmentSkuCode: 'GARMENT-BLACK-M',
  woolPartCode: 'SLEEVE',
  woolPartName: '袖片',
  colorCode: 'BLACK',
  colorName: '黑色',
  sizeCode: 'M',
  plannedQty: 200,
  qtyUnit: '片',
  requiredYarnSkus: ['YARN-A'],
  sourceTechPackVersionId: 'TPV-WOOL-SOURCE-CHECK',
  sourceTechPackVersionCode: 'TP-WOOL-V1',
  sourceColorMappingIds: ['MAP-BLACK'],
  sourceBomItemIds: ['BOM-YARN-A'],
}])

const fallbackSourceSnapshot = buildWoolOrderSourceSnapshot({
  ...sourceBuildInput,
  colorMaterialMappings: sourceBuildInput.colorMaterialMappings.map((mapping) => ({
    ...mapping,
    mappingOrigin: 'DEMAND_FALLBACK',
  })),
})
assert.deepEqual(fallbackSourceSnapshot.outputPlanLines[0].requiredYarnSkus, [])
assert.deepEqual(fallbackSourceSnapshot.outputPlanLines[0].sourceColorMappingIds, [])

const materialCodeOnlySnapshot = buildWoolOrderSourceSnapshot({
  ...sourceBuildInput,
  colorMaterialMappings: [{
    ...sourceBuildInput.colorMaterialMappings[0],
    lines: [{ id: 'MAP-LINE-CODE-ONLY', materialCode: 'YARN-A', applicableSkuCodes: [] }],
  }],
})
assert.deepEqual(materialCodeOnlySnapshot.outputPlanLines[0].requiredYarnSkus, ['YARN-A'])
assert.deepEqual(materialCodeOnlySnapshot.outputPlanLines[0].sourceBomItemIds, ['BOM-YARN-A'])

const ambiguousMaterialSnapshot = buildWoolOrderSourceSnapshot({
  ...sourceBuildInput,
  bomItems: [
    ...sourceBuildInput.bomItems,
    { id: 'BOM-YARN-A-DUPLICATE', materialCode: 'YARN-A', usageProcessCodes: ['PROC_WOOL'] },
  ],
  colorMaterialMappings: [{
    ...sourceBuildInput.colorMaterialMappings[0],
    lines: [{ id: 'MAP-LINE-AMBIGUOUS', materialCode: 'YARN-A', applicableSkuCodes: [] }],
  }],
})
assert.deepEqual(ambiguousMaterialSnapshot.outputPlanLines[0].requiredYarnSkus, [])

const nonWoolBomSnapshot = buildWoolOrderSourceSnapshot({
  ...sourceBuildInput,
  colorMaterialMappings: [{
    ...sourceBuildInput.colorMaterialMappings[0],
    lines: [{ id: 'MAP-LINE-BAG', bomItemId: 'BOM-BAG', materialCode: 'BAG-01', applicableSkuCodes: [] }],
  }],
})
assert.deepEqual(nonWoolBomSnapshot.outputPlanLines[0].requiredYarnSkus, [])

const unmatchedSkuSnapshot = buildWoolOrderSourceSnapshot({
  ...sourceBuildInput,
  colorMaterialMappings: [{
    ...sourceBuildInput.colorMaterialMappings[0],
    lines: [{
      id: 'MAP-LINE-OTHER-SKU',
      bomItemId: 'BOM-YARN-A',
      materialCode: 'YARN-A',
      applicableSkuCodes: ['GARMENT-WHITE-M'],
    }],
  }],
})
assert.deepEqual(unmatchedSkuSnapshot.outputPlanLines[0].requiredYarnSkus, [])
assert.deepEqual(unmatchedSkuSnapshot.outputPlanLines[0].sourceColorMappingIds, ['MAP-BLACK'])

const missingMappingSnapshot = buildWoolOrderSourceSnapshot({
  ...sourceBuildInput,
  colorMaterialMappings: [],
})
assert.equal(missingMappingSnapshot.outputPlanLines.length, 1)
assert.equal(missingMappingSnapshot.outputPlanLines[0].plannedQty, 100)
assert.deepEqual(missingMappingSnapshot.outputPlanLines[0].requiredYarnSkus, [])
assert.deepEqual(missingMappingSnapshot.outputPlanLines[0].sourceColorMappingIds, [])

const alignedMappings = alignWoolColorMaterialMappingsForDemand({
  mappings: [{
    id: 'MAP-BLACK',
    mappingOrigin: 'TECH_PACK',
    spuCode: 'GARMENT',
    colorCode: 'BLACK',
    colorName: '黑色',
    status: 'CONFIRMED',
    generatedMode: 'MANUAL',
    lines: [],
  }],
  demandSkuLines: [
    { skuCode: 'GARMENT-BLACK-M', colorCode: 'BLACK', colorName: '黑色' },
    { skuCode: 'GARMENT-WHITE-M', colorCode: 'WHITE', colorName: '白色' },
  ],
})
const mappingOrigins = alignedMappings.map((item) => item.mappingOrigin)
assert(mappingOrigins.includes('TECH_PACK'))
assert(mappingOrigins.includes('DEMAND_FALLBACK'))
assert.equal(mappingOrigins.filter((origin) => origin === 'DEMAND_FALLBACK').every((origin) => origin !== 'TECH_PACK'), true)

const sameNameSourceMappings = [{
  id: 'MAP-BLUE1',
  mappingOrigin: 'TECH_PACK' as const,
  spuCode: 'GARMENT',
  colorCode: 'BLUE1',
  colorName: '蓝色',
  status: 'CONFIRMED' as const,
  generatedMode: 'MANUAL' as const,
  lines: [{
    id: 'LINE-BLUE',
    materialName: '蓝色纱线',
    materialType: '面料' as const,
    unit: 'kg',
    applicableSkuCodes: ['SOURCE-SKU'],
    sourceMode: 'MANUAL' as const,
  }],
}]
const sameNameAlignedMappings = alignWoolColorMaterialMappingsForDemand({
  mappings: sameNameSourceMappings,
  demandSkuLines: [
    { skuCode: 'GARMENT-BLUE1-M', colorCode: 'BLUE1', colorName: '蓝色' },
    { skuCode: 'GARMENT-BLUE2-M', colorCode: 'BLUE2', colorName: '蓝色' },
  ],
})
const blue1Mapping = sameNameAlignedMappings.find((item) => item.colorCode === 'BLUE1')!
const blue2Mapping = sameNameAlignedMappings.find((item) => item.colorCode === 'BLUE2')!
assert.equal(blue1Mapping.mappingOrigin, 'TECH_PACK')
assert.equal(blue2Mapping.mappingOrigin, 'DEMAND_FALLBACK')
assert.deepEqual(blue1Mapping.lines[0].applicableSkuCodes, ['GARMENT-BLUE1-M'])
assert.deepEqual(blue2Mapping.lines[0].applicableSkuCodes, ['GARMENT-BLUE2-M'])
assert.notEqual(blue1Mapping.lines[0].id, blue2Mapping.lines[0].id)
assert.notStrictEqual(sameNameAlignedMappings, sameNameSourceMappings)
assert.notStrictEqual(blue1Mapping.lines, sameNameSourceMappings[0].lines)
assert.notStrictEqual(blue1Mapping.lines[0], sameNameSourceMappings[0].lines[0])
assert.notStrictEqual(blue1Mapping.lines, blue2Mapping.lines)
assert.notStrictEqual(blue1Mapping.lines[0], blue2Mapping.lines[0])
assert.deepEqual(sameNameSourceMappings[0].lines[0].applicableSkuCodes, ['SOURCE-SKU'])

const processDomainSource = readFileSync(
  new URL('../src/pages/tech-pack/process-domain.ts', import.meta.url),
  'utf8',
)
assert.equal(processDomainSource.includes('打印毛织菲票'), false)
assert.equal(processDomainSource.includes('毛织厂包装'), false)

const artifactGenerationSource = readFileSync(
  new URL('../src/data/fcs/production-artifact-generation.ts', import.meta.url),
  'utf8',
)
assert.equal(artifactGenerationSource.includes('context.sourceEntry.requiresFeiTicket'), false)
assert.equal(artifactGenerationSource.includes('context.sourceEntry.packagingRequired'), false)

const taskDetailRowsSource = readFileSync(
  new URL('../src/data/fcs/task-detail-rows.ts', import.meta.url),
  'utf8',
)
assert.equal(taskDetailRowsSource.includes('buildWoolPanelOutputSku(woolPartCode, line.skuCode)'), true)

const woolTypesSource = readFileSync(
  new URL('../src/data/fcs/wool-domain/types.ts', import.meta.url),
  'utf8',
)
assert.equal(
  woolTypesSource.includes("receiverType: 'CUTTING_WAIT_HANDOVER_WAREHOUSE' | 'DOWNSTREAM_FACTORY'"),
  true,
)
assert.equal(woolTypesSource.includes('warehouseOutboundFlowId: string'), true)
assert.equal(woolTypesSource.includes('confirmationSnapshot: WoolCompletionSnapshot'), true)
assert.equal(woolTypesSource.includes('yarnReceiptSummary:'), true)
assert.equal(woolTypesSource.includes('outputReadinessSummary:'), true)
assert.equal(woolTypesSource.includes('processReportSummary:'), true)
assert.equal(woolTypesSource.includes('handoverSummary:'), true)
assert.equal(woolTypesSource.includes('waitProcessStockSummary:'), true)
assert.equal(woolTypesSource.includes('waitHandoverStockSummary:'), true)
assert.equal(woolTypesSource.includes('yarnSkuCode: string'), true)
assert.equal(woolTypesSource.includes('outputSkuCode: string'), true)
assert.equal(woolTypesSource.includes('handoverQty: number'), true)
assert.equal(woolTypesSource.includes('downstreamDifferenceQty?: number'), true)
assert.equal(woolTypesSource.includes('downstreamReceivedAt?: string'), true)
assert.equal(woolTypesSource.includes('stockQty: number'), true)

const {
  addWoolProcessReport,
  addWoolYarnReceipt,
  completeWoolWorkOrder,
  getWoolOutputReadiness,
  getWoolWorkOrderById,
  listWoolMachineAssociations,
  listWoolWorkOrders,
  replaceWoolMachineAssociations,
  resetWoolFactWorkflowMock,
} = await import('../src/data/fcs/wool-task-domain.ts')

resetWoolFactWorkflowMock('CHECK_WOOL_FACT_WORKFLOW')
const order = listWoolWorkOrders().find((item) => item.woolOrderNo === 'WMO-CHECK-READY')!
const black = order.outputPlanLines.find((item) => item.colorCode === 'BLACK')!

assert.deepEqual(black.requiredYarnSkus, ['YARN-A', 'YARN-B'])
assert.deepEqual(getWoolOutputReadiness(order.woolOrderId, black.outputSkuCode).missingYarnSkus, ['YARN-A', 'YARN-B'])

addWoolYarnReceipt(order.woolOrderId, {
  commandId: 'CMD-WR-CHECK-001',
  receiptNo: 'WR-CHECK-001',
  deliveryNo: 'DN-CHECK-001',
  batchNo: 'BATCH-A',
  receivedAt: '2026-07-30 08:00:00',
  receivedBy: '毛织仓管',
  lines: [{ yarnSkuCode: 'YARN-A', receivedQty: 20, qtyUnit: 'kg' }],
})
assert.deepEqual(getWoolOutputReadiness(order.woolOrderId, black.outputSkuCode).missingYarnSkus, ['YARN-B'])

addWoolYarnReceipt(order.woolOrderId, {
  commandId: 'CMD-WR-CHECK-002',
  receiptNo: 'WR-CHECK-002',
  receivedAt: '2026-07-30 09:00:00',
  receivedBy: '毛织仓管',
  lines: [{ yarnSkuCode: 'YARN-B', receivedQty: 1, qtyUnit: 'kg' }],
})
assert.equal(getWoolOutputReadiness(order.woolOrderId, black.outputSkuCode).isReady, true)

addWoolProcessReport(order.woolOrderId, {
  commandId: 'CMD-REPORT-CHECK-LIMIT',
  outputSkuCode: black.outputSkuCode,
  reportedQty: Math.floor(black.plannedQty * 1.5),
  reportedAt: '2026-07-30 10:00:00',
  reportedBy: '毛织主管',
})
assert.throws(
  () => addWoolProcessReport(order.woolOrderId, {
    commandId: 'CMD-REPORT-CHECK-OVER-LIMIT',
    outputSkuCode: black.outputSkuCode,
    reportedQty: 1,
    reportedAt: '2026-07-30 10:01:00',
    reportedBy: '毛织主管',
  }),
  /累计加工填报不能超过计划数量的 150%/,
)

replaceWoolMachineAssociations(order.woolOrderId, ['WM-001', 'WM-002'], {
  operatedAt: '2026-07-30 11:00:00',
  operatedBy: '毛织主管',
})
assert.equal(listWoolMachineAssociations(order.woolOrderId).length, 2)
assert.throws(
  () => completeWoolWorkOrder(order.woolOrderId, {
    completedAt: '2026-07-30 12:00:00',
    completedBy: '毛织主管',
    remark: '没有交出记录不能完成',
  }),
  /至少有一次发起交出后才能完成加工单/,
)
assert.equal(getWoolWorkOrderById(order.woolOrderId)?.processingStatus, 'UNPROCESSED')
