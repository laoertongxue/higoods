import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { alignWoolColorMaterialMappingsForDemand } from '../src/data/fcs/production-tech-pack-snapshot-builder.ts'
import {
  buildWoolPanelOutputSku,
  buildWoolOrderSourceSnapshot,
  buildWoolOrderSourceSnapshotFromRuntimeTask,
  type WoolOrderSourceBuildInput,
} from '../src/data/fcs/wool-domain/tech-pack-source.ts'
import {
  generateTaskDetailRowsForArtifact,
  isWoolProcessCode,
  resolveTaskDetailMaterialCode,
} from '../src/data/fcs/task-detail-rows.ts'
import { generateTaskArtifactsForOrder } from '../src/data/fcs/production-artifact-generation.ts'
import { productionOrders } from '../src/data/fcs/production-orders.ts'
import type {
  WoolCompletionRecord,
  WoolHandoverRecord,
  WoolMachineAssociation,
  WoolMachineAssociationLog,
  WoolProcessReportRecord,
  WoolQtyChangeLog,
  WoolWarehouseFlow,
  WoolYarnIssueRecord,
  WoolYarnReceiptRecord,
  WoolYarnReturnRecord,
} from '../src/data/fcs/wool-domain/types.ts'
import {
  captureRuntimeDirectDispatchState,
  dispatchRuntimeTaskByDetailGroups,
  getRuntimeTaskById,
  listRuntimeTaskAllocatableGroups,
  restoreRuntimeDirectDispatchState,
} from '../src/data/fcs/runtime-process-tasks.ts'

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

const yarnReceiptTypeFixture: WoolYarnReceiptRecord = {
  receiptId: 'WR-TYPE-CHECK',
  receiptNo: 'WR-NO-TYPE-CHECK',
  woolOrderId: 'WO-TYPE-CHECK',
  receivedAt: '2026-07-30 08:00:00',
  receivedBy: '毛织仓管',
  lines: [{
    lineId: 'WRL-TYPE-CHECK',
    yarnSkuCode: 'YARN-A',
    yarnName: '黑色纱线 A',
    receivedQty: 20,
    qtyUnit: 'kg',
    warehouseInboundFlowId: 'WF-IN-TYPE-CHECK',
  }],
  createdAt: '2026-07-30 08:00:00',
  updatedAt: '2026-07-30 08:00:00',
}
void yarnReceiptTypeFixture

const yarnIssueTypeFixture: WoolYarnIssueRecord = {
  issueId: 'WI-TYPE-CHECK',
  issueNo: 'WI-NO-TYPE-CHECK',
  woolOrderId: 'WO-TYPE-CHECK',
  yarnSkuCode: 'YARN-A',
  issuedQty: 5,
  qtyUnit: 'kg',
  warehouseOutboundFlowId: 'WF-OUT-TYPE-CHECK',
  issuedAt: '2026-07-30 09:00:00',
  issuedBy: '毛织仓管',
}
void yarnIssueTypeFixture

const yarnReturnTypeFixture: WoolYarnReturnRecord = {
  returnId: 'WRT-TYPE-CHECK',
  returnNo: 'WRT-NO-TYPE-CHECK',
  woolOrderId: 'WO-TYPE-CHECK',
  yarnSkuCode: 'YARN-A',
  returnedQty: 1,
  qtyUnit: 'kg',
  warehouseInboundFlowId: 'WF-RETURN-TYPE-CHECK',
  returnedAt: '2026-07-30 10:00:00',
  returnedBy: '毛织仓管',
}
void yarnReturnTypeFixture

const processReportTypeFixture: WoolProcessReportRecord = {
  reportId: 'WPR-TYPE-CHECK',
  woolOrderId: 'WO-TYPE-CHECK',
  outputSkuCode: 'GARMENT-BLACK-M',
  reportedQty: 100,
  reportedAt: '2026-07-30 11:00:00',
  reportedBy: '毛织主管',
  warehouseInboundFlowId: 'WF-REPORT-TYPE-CHECK',
  createdAt: '2026-07-30 11:00:00',
  updatedAt: '2026-07-30 11:00:00',
}
void processReportTypeFixture

const qtyChangeTypeFixture: WoolQtyChangeLog = {
  changeId: 'WQC-TYPE-CHECK',
  recordType: 'YARN_RECEIPT',
  recordId: 'WR-TYPE-CHECK',
  recordLineId: 'WRL-TYPE-CHECK',
  objectSkuCode: 'YARN-A',
  beforeQty: 20,
  afterQty: 18,
  qtyUnit: 'kg',
  reason: '修正实收数量',
  changedAt: '2026-07-30 12:00:00',
  changedBy: '毛织仓管',
}
void qtyChangeTypeFixture

const warehouseFlowTypeFixture: WoolWarehouseFlow = {
  flowId: 'WF-TYPE-CHECK',
  woolOrderId: 'WO-TYPE-CHECK',
  flowType: 'ADJUSTMENT',
  businessType: 'STOCK_ADJUSTMENT',
  warehouseMode: 'WAIT_PROCESS',
  defaultLocationType: 'YARN',
  defaultLocationId: 'WOOL-WP-YARN-DEFAULT',
  objectSkuCode: 'YARN-A',
  qty: 2,
  unit: 'kg',
  sourceRecordType: 'STOCK_ADJUSTMENT',
  sourceRecordId: 'SA-TYPE-CHECK',
  reason: '盘点修正',
  operatedAt: '2026-07-30 12:30:00',
  operatedBy: '毛织仓管',
}
void warehouseFlowTypeFixture

const machineAssociationTypeFixture: WoolMachineAssociation = {
  machineId: 'WM-001',
  woolOrderId: 'WO-TYPE-CHECK',
  associatedAt: '2026-07-30 13:00:00',
  associatedBy: '毛织主管',
}
void machineAssociationTypeFixture

const machineAssociationLogTypeFixture: WoolMachineAssociationLog = {
  logId: 'WMAL-TYPE-CHECK',
  machineId: 'WM-001',
  fromWoolOrderId: 'WO-OLD',
  toWoolOrderId: 'WO-TYPE-CHECK',
  action: 'TRANSFER',
  reason: 'MANUAL_SAVE',
  operatedAt: '2026-07-30 13:00:00',
  operatedBy: '毛织主管',
}
void machineAssociationLogTypeFixture

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
    status: 'CONFIRMED',
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

const draftMappingSourceSnapshot = buildWoolOrderSourceSnapshot({
  ...sourceBuildInput,
  colorMaterialMappings: sourceBuildInput.colorMaterialMappings.map((mapping) => ({
    ...mapping,
    status: 'AUTO_DRAFT',
  })),
})
assert.deepEqual(draftMappingSourceSnapshot.outputPlanLines[0].requiredYarnSkus, [])
assert.deepEqual(draftMappingSourceSnapshot.outputPlanLines[0].sourceColorMappingIds, [])

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
function readWoolInterfaceSource(interfaceName: string): string {
  const start = woolTypesSource.indexOf(`export interface ${interfaceName} {`)
  assert.notEqual(start, -1, `缺少 ${interfaceName}`)
  const next = woolTypesSource.indexOf('\nexport ', start + 1)
  return woolTypesSource.slice(start, next === -1 ? undefined : next)
}
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

const yarnReceiptSource = readWoolInterfaceSource('WoolYarnReceiptRecord')
assert.equal(yarnReceiptSource.includes('createdAt: string'), true)
assert.equal(yarnReceiptSource.includes('updatedAt: string'), true)
assert.equal(yarnReceiptSource.includes('objectSku:'), false)
assert.equal(yarnReceiptSource.includes('warehouseFlowId:'), false)
assert.equal(yarnReceiptSource.includes('batchNo: string'), false)

const yarnReceiptLineSource = readWoolInterfaceSource('WoolYarnReceiptLine')
assert.equal(yarnReceiptLineSource.includes('yarnSkuCode: string'), true)
assert.equal(yarnReceiptLineSource.includes('yarnName: string'), true)
assert.equal(yarnReceiptLineSource.includes('warehouseInboundFlowId: string'), true)
assert.equal(yarnReceiptLineSource.includes('objectSku:'), false)

const yarnIssueSource = readWoolInterfaceSource('WoolYarnIssueRecord')
assert.equal(yarnIssueSource.includes('yarnSkuCode: string'), true)
assert.equal(yarnIssueSource.includes('warehouseOutboundFlowId: string'), true)

const yarnReturnSource = readWoolInterfaceSource('WoolYarnReturnRecord')
assert.equal(yarnReturnSource.includes('yarnSkuCode: string'), true)
assert.equal(yarnReturnSource.includes('warehouseInboundFlowId: string'), true)

const processReportSource = readWoolInterfaceSource('WoolProcessReportRecord')
assert.equal(processReportSource.includes('outputSkuCode: string'), true)
assert.equal(processReportSource.includes('warehouseInboundFlowId: string'), true)
assert.equal(processReportSource.includes('createdAt: string'), true)
assert.equal(processReportSource.includes('updatedAt: string'), true)

const qtyChangeSource = readWoolInterfaceSource('WoolQtyChangeLog')
for (const field of [
  'changeId: string',
  'recordLineId?: string',
  'objectSkuCode: string',
  'beforeQty: number',
  'afterQty: number',
  'qtyUnit: WoolQtyUnit',
  'changedBy: string',
]) {
  assert.equal(qtyChangeSource.includes(field), true, `WoolQtyChangeLog 缺少 ${field}`)
}

const warehouseFlowSource = readWoolInterfaceSource('WoolWarehouseFlow')
for (const field of [
  'flowId: string',
  'flowType: WoolWarehouseFlowType',
  'warehouseMode: WoolWarehouseMode',
  'defaultLocationType: WoolDefaultLocationType',
  'objectSkuCode: string',
]) {
  assert.equal(warehouseFlowSource.includes(field), true, `WoolWarehouseFlow 缺少 ${field}`)
}
assert.equal(woolTypesSource.includes("'STOCK_ADJUSTMENT'"), true)
assert.equal(woolTypesSource.includes("'STOCK_TRANSFER'"), true)
assert.equal(woolTypesSource.includes("'WOOL-WP-YARN-DEFAULT'"), true)
assert.equal(woolTypesSource.includes("'WOOL-WH-CUT-DEFAULT'"), true)
assert.equal(woolTypesSource.includes("'WOOL-WH-GARMENT-DEFAULT'"), true)

const sameNamePartOrder = productionOrders.find((order) => order.productionOrderId === 'PO-202603-084')
assert(sameNamePartOrder?.techPackSnapshot, '缺少同名毛织部位检查生产单快照')
const sameNamePartArtifact = generateTaskArtifactsForOrder(sameNamePartOrder.productionOrderId)
  .find((artifact) => artifact.woolTaskType === 'PART_PANEL')
assert(sameNamePartArtifact, '缺少同名毛织部位检查加工任务')
const sameNameBasePattern = sameNamePartOrder.techPackSnapshot.patternFiles
  .find((pattern) => pattern.patternMaterialType === 'WOOL' && pattern.pieceRows?.length)
assert(sameNameBasePattern?.pieceRows?.[0], '缺少同名毛织部位检查纸样')
const sameNameBasePiece = sameNameBasePattern.pieceRows[0]
const originalSameNamePatternFiles = sameNamePartOrder.techPackSnapshot.patternFiles
try {
  sameNamePartOrder.techPackSnapshot.patternFiles = [{
    ...sameNameBasePattern,
    pieceRows: [
      {
        ...sameNameBasePiece,
        id: 'WOOL-SAME-NAME-PIECE-A',
        partTemplateId: 'WOOL-SAME-NAME-PART-A',
        name: '同名罗纹',
        count: 1,
        colorAllocations: [],
      },
      {
        ...sameNameBasePiece,
        id: 'WOOL-SAME-NAME-PIECE-B',
        partTemplateId: 'WOOL-SAME-NAME-PART-B',
        name: '同名罗纹',
        count: 3,
        colorAllocations: [],
      },
    ],
  }]
  const sameNameRows = generateTaskDetailRowsForArtifact({
    taskId: 'TASK-WOOL-SAME-NAME-PARTS',
    artifact: sameNamePartArtifact,
  })
  const checkedSku = sameNamePartOrder.demandSnapshot.skuLines[0]
  const checkedRows = sameNameRows.filter((row) => row.sourceRefs.garmentSku === checkedSku.skuCode)
  assert.equal(checkedRows.length, 2, '同名但身份不同的毛织部位必须生成两条独立明细')
  assert.deepEqual(
    checkedRows.map((row) => row.sourceRefs.outputSkuCode).sort(),
    [
      buildWoolPanelOutputSku('WOOL-SAME-NAME-PART-A', checkedSku.skuCode),
      buildWoolPanelOutputSku('WOOL-SAME-NAME-PART-B', checkedSku.skuCode),
    ].sort(),
  )
  assert.deepEqual(
    checkedRows.map((row) => row.qty).sort((left, right) => left - right),
    [checkedSku.qty, checkedSku.qty * 3],
    '同名毛织部位数量不得互相合并或串写',
  )
} finally {
  sameNamePartOrder.techPackSnapshot.patternFiles = originalSameNamePatternFiles
}

const splitRuntimeState = captureRuntimeDirectDispatchState()
try {
  const sourcePartTaskId = 'TASKGEN-202603-084-002__ORDER'
  const sourcePartTask = getRuntimeTaskById(sourcePartTaskId)
  assert(sourcePartTask, '缺少部位毛织多工厂拆分检查任务')
  const allocatableGroups = listRuntimeTaskAllocatableGroups(sourcePartTaskId)
  assert(allocatableGroups.length > 1, '部位毛织检查任务必须有多个可分配明细')

  const dispatchResult = dispatchRuntimeTaskByDetailGroups({
    taskId: sourcePartTaskId,
    assignments: allocatableGroups.map((group, index) => ({
      groupKey: group.groupKey,
      factoryId: index === 0 ? 'WOOL-FACTORY-A' : 'WOOL-FACTORY-B',
      factoryName: index === 0 ? '毛织工厂 A' : '毛织工厂 B',
    })),
    by: '毛织拆分检查',
  })
  assert.equal(dispatchResult.ok, true)
  assert.equal(dispatchResult.mode, 'MULTI_FACTORY')
  assert.equal(dispatchResult.createdTaskIds?.length, 2)

  for (const splitTaskId of dispatchResult.createdTaskIds ?? []) {
    const splitTask = getRuntimeTaskById(splitTaskId)
    assert(splitTask, `缺少拆分结果任务 ${splitTaskId}`)
    assert(splitTask.scopeDetailRows.length > 0, `${splitTaskId} 缺少自己的部位明细`)
    assert(splitTask.scopeSkuLines.length > 0, `${splitTaskId} 不得以空 SKU 范围回退整单`)
    assert.equal(
      splitTask.scopeDetailRows.every((row) =>
        row.dimensions.GARMENT_SKU === row.sourceRefs.garmentSku
        && Boolean(row.sourceRefs.outputSkuCode),
      ),
      true,
      `${splitTaskId} 必须同时保留成衣 SKU 语义与部位输出 SKU`,
    )

    const expectedOutputSkuCodes = [...new Set(
      splitTask.scopeDetailRows
        .map((row) => row.sourceRefs.outputSkuCode)
        .filter((value): value is string => Boolean(value)),
    )].sort()
    const splitSourceSnapshot = buildWoolOrderSourceSnapshotFromRuntimeTask(splitTaskId)
    assert.deepEqual(
      splitSourceSnapshot.outputPlanLines.map((line) => line.outputSkuCode).sort(),
      expectedOutputSkuCodes,
      `${splitTaskId} 只能生成分给自己的 SKU/部位`,
    )
  }
} finally {
  restoreRuntimeDirectDispatchState(splitRuntimeState)
}

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
