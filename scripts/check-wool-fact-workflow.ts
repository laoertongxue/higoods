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

const storageValues = new Map<string, string>()
const storageWrites: string[] = []
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem(key: string) {
      return storageValues.get(key) ?? null
    },
    setItem(key: string, value: string) {
      storageWrites.push(key)
      storageValues.set(key, value)
    },
    removeItem(key: string) {
      storageValues.delete(key)
    },
    clear() {
      storageValues.clear()
    },
  },
})

const {
  WOOL_DOMAIN_STORE_KEY,
  clearWoolStoreMemoryCache,
  commitWoolStore,
  readWoolStore,
  validateWoolStore,
} = await import('../src/data/fcs/wool-domain/store.ts')
const {
  getWoolOutputReadiness,
  getWoolOutputHandedOverQty,
  getWoolOutputReportedQty,
  getWoolProcessingStatus,
  getWoolAllowedActions,
  getWoolWarehouseStock,
  getWoolWorkOrderBlockReason,
  getWoolWorkOrderTab,
  getWoolWorkOrderTabCounts,
  listWoolFactRecords,
  listWoolWorkOrders,
} = await import('../src/data/fcs/wool-domain/queries.ts')
const {
  WOOL_MOCK_SCENARIO_CODES,
  resetWoolFactWorkflowMock,
} = await import('../src/data/fcs/wool-domain/mock-data.ts')

resetWoolFactWorkflowMock('CHECK_WOOL_FACT_WORKFLOW')
assert.equal(WOOL_DOMAIN_STORE_KEY, 'higood-fcs-wool-domain-store-v2')
assert.equal(WOOL_MOCK_SCENARIO_CODES.length, 26)
assert.equal(new Set(WOOL_MOCK_SCENARIO_CODES).size, 26)

const allOrders = listWoolWorkOrders()
assert(allOrders.length >= 26)
for (const scenarioCode of WOOL_MOCK_SCENARIO_CODES) {
  assert(allOrders.some((item) => item.mockScenarioCode === scenarioCode), `缺少 Mock 场景 ${scenarioCode}`)
}
assert(allOrders.some((item) => item.mockScenarioCode === 'NO_YARN_RECEIPT'))
assert(allOrders.some((item) => item.mockScenarioCode === 'ONE_COLOR_READY'))
assert(allOrders.some((item) => item.mockScenarioCode === 'ALL_READY_SKUS_AT_LIMIT'))
assert(allOrders.some((item) => item.mockScenarioCode === 'COMPLETED_WITH_STOCK'))
assert(allOrders.some((item) => item.mockScenarioCode === 'TECH_PACK_FALLBACK_REJECTED'))
assert(allOrders.some((item) => item.mockScenarioCode === 'NO_TECH_PACK_MAPPING'))
assert(allOrders.some((item) => item.mockScenarioCode === 'INVALID_MAPPING_REJECTED'))
assert(allOrders.some((item) => item.kind === 'PART_PANEL'))

const noReceiptOrder = allOrders.find((item) => item.mockScenarioCode === 'NO_YARN_RECEIPT')!
const noReceiptLine = noReceiptOrder.outputPlanLines[0]
assert.equal(getWoolOutputReadiness(noReceiptOrder.woolOrderId, noReceiptLine.outputSkuCode).isReady, false)
assert.equal(
  readWoolStore().yarnReceipts.some((item) => item.woolOrderId === noReceiptOrder.woolOrderId),
  false,
)

const fallbackOrder = allOrders.find((item) => item.mockScenarioCode === 'TECH_PACK_FALLBACK_REJECTED')!
const fallbackLine = fallbackOrder.outputPlanLines[0]
assert.equal(fallbackLine.requiredYarnSkus.length, 0)
assert.equal(getWoolOutputReadiness(fallbackOrder.woolOrderId, fallbackLine.outputSkuCode).isReady, false)

const noMappingOrder = allOrders.find((item) => item.mockScenarioCode === 'NO_TECH_PACK_MAPPING')!
const invalidMappingOrder = allOrders.find((item) => item.mockScenarioCode === 'INVALID_MAPPING_REJECTED')!
assert.equal(noMappingOrder.outputPlanLines[0].sourceColorMappingIds.length, 0)
assert.equal(fallbackOrder.outputPlanLines[0].sourceColorMappingIds.length, 0)
assert(invalidMappingOrder.outputPlanLines[0].sourceColorMappingIds.length > 0)
assert.equal(invalidMappingOrder.outputPlanLines[0].sourceBomItemIds.length, 0)
assert.notEqual(noMappingOrder.sourceTechPackVersionCode, fallbackOrder.sourceTechPackVersionCode)
assert.notEqual(fallbackOrder.sourceTechPackVersionCode, invalidMappingOrder.sourceTechPackVersionCode)

const readyOrder = allOrders.find((item) => item.mockScenarioCode === 'ONE_COLOR_READY')!
assert.equal(getWoolWorkOrderTab(readyOrder.woolOrderId), 'READY')
assert.equal(getWoolProcessingStatus(readyOrder.woolOrderId), 'UNPROCESSED')

const partialOrder = allOrders.find((item) => item.mockScenarioCode === 'PARTIAL_YARN_RECEIPT')!
assert.deepEqual(
  getWoolOutputReadiness(partialOrder.woolOrderId, partialOrder.outputPlanLines[0].outputSkuCode).missingYarnSkus,
  ['YARN-B'],
)
assert.deepEqual(
  getWoolOutputReadiness(partialOrder.woolOrderId, partialOrder.outputPlanLines[1].outputSkuCode).missingYarnSkus,
  ['YARN-C'],
)

const multiYarnOrder = allOrders.find((item) => item.mockScenarioCode === 'MULTI_YARN_SINGLE_RECEIPT')!
const multiYarnReceipts = readWoolStore().yarnReceipts.filter((item) => item.woolOrderId === multiYarnOrder.woolOrderId)
assert.equal(multiYarnReceipts.length, 1)
assert.deepEqual(
  new Set(multiYarnReceipts[0].lines.map((item) => item.yarnSkuCode)),
  new Set(['YARN-A', 'YARN-B', 'YARN-C']),
)

const splitBatchOrder = allOrders.find((item) => item.mockScenarioCode === 'SPLIT_BATCH_RECEIPTS')!
const splitBatchReceipts = readWoolStore().yarnReceipts.filter((item) => item.woolOrderId === splitBatchOrder.woolOrderId)
assert.equal(splitBatchReceipts.filter((item) => item.lines.some((line) => line.yarnSkuCode === 'YARN-A')).length, 2)
assert.equal(new Set(splitBatchReceipts.map((item) => item.batchNo)).size, splitBatchReceipts.length)

const cappedOrder = allOrders.find((item) => item.mockScenarioCode === 'ALL_READY_SKUS_AT_LIMIT')!
assert.equal(getWoolWorkOrderTab(cappedOrder.woolOrderId), 'NOT_READY')
assert.match(getWoolWorkOrderBlockReason(cappedOrder.woolOrderId), /全部加工后 SKU 已达到填报上限/)

const reportsAtLimitOrder = allOrders.find((item) => item.mockScenarioCode === 'REPORTS_AT_LIMIT')!
assert.equal(
  getWoolOutputReportedQty(reportsAtLimitOrder.woolOrderId, reportsAtLimitOrder.outputPlanLines[0].outputSkuCode),
  Math.floor(reportsAtLimitOrder.outputPlanLines[0].plannedQty * 1.5),
)
assert.equal(
  listWoolFactRecords({
    woolOrderId: reportsAtLimitOrder.woolOrderId,
    recordType: 'PROCESS_REPORT',
  }).length,
  2,
)

const readyToCompleteOrder = allOrders.find((item) => item.mockScenarioCode === 'READY_TO_COMPLETE')!
assert(getWoolAllowedActions(readyToCompleteOrder.woolOrderId).includes('COMPLETE'))
assert.equal(getWoolProcessingStatus(readyToCompleteOrder.woolOrderId), 'PROCESSING')
assert(
  getWoolOutputHandedOverQty(
    readyToCompleteOrder.woolOrderId,
    readyToCompleteOrder.outputPlanLines[0].outputSkuCode,
  ) < readyToCompleteOrder.outputPlanLines[0].plannedQty,
)
assert.equal(
  readWoolStore().completions.some((item) => item.woolOrderId === readyToCompleteOrder.woolOrderId),
  false,
)

const associationAOrder = allOrders.find((item) => item.mockScenarioCode === 'MACHINE_ASSOCIATION_A')!
assert(readWoolStore().machineAssociations.some((item) => item.woolOrderId === associationAOrder.woolOrderId))

const partCapacityOrder = allOrders.find((item) => item.mockScenarioCode === 'PART_PANEL_CAPACITY')!
const partCapacityLine = partCapacityOrder.outputPlanLines[0]
assert.equal(partCapacityOrder.kind, 'PART_PANEL')
assert.equal(partCapacityLine.outputObjectType, 'WOOL_PANEL')
assert.equal(partCapacityLine.qtyUnit, '片')
assert.equal(
  getWoolOutputReadiness(partCapacityOrder.woolOrderId, partCapacityLine.outputSkuCode).reportLimitQty,
  Math.floor(partCapacityLine.plannedQty * 1.5),
)

const defaultLocationOrder = allOrders.find((item) => item.mockScenarioCode === 'REPORT_DEFAULT_LOCATION')!
const defaultLocationReport = readWoolStore().processReports.find((item) =>
  item.woolOrderId === defaultLocationOrder.woolOrderId,
)!
assert(readWoolStore().warehouseFlows.some((item) =>
  item.flowId === defaultLocationReport.warehouseInboundFlowId
  && item.defaultLocationId === 'WOOL-WH-GARMENT-DEFAULT',
))

const downstreamLockedOrder = allOrders.find((item) => item.mockScenarioCode === 'DOWNSTREAM_CONFIRMED_LOCKED')!
const downstreamLockedHandover = readWoolStore().handovers.find((item) =>
  item.woolOrderId === downstreamLockedOrder.woolOrderId,
)!
assert.equal(downstreamLockedHandover.downstreamReceipt?.status, 'CONFIRMED')
assert.equal(downstreamLockedHandover.downstreamReceipt?.actualReceivedQty, 7)
assert.equal(downstreamLockedHandover.downstreamReceipt?.differenceQty, -1)

const missingTargetOrder = allOrders.find((item) => item.mockScenarioCode === 'MISSING_DOWNSTREAM_TARGET')!
assert.equal(missingTargetOrder.downstreamTarget.receiverId, '')
assert.equal(missingTargetOrder.downstreamTarget.receiverName, '')
assert.equal(getWoolAllowedActions(missingTargetOrder.woolOrderId).includes('HANDOVER'), false)

const filteredOrders = listWoolWorkOrders({ keyword: readyOrder.productionOrderNo })
assert.equal(filteredOrders.length, 1)
assert.equal(filteredOrders.filter((item) => getWoolWorkOrderTab(item.woolOrderId) === 'READY').length, 1)
assert.equal(filteredOrders.filter((item) => getWoolWorkOrderTab(item.woolOrderId) === 'NOT_READY').length, 0)
assert.equal(filteredOrders.filter((item) => getWoolWorkOrderTab(item.woolOrderId) === 'COMPLETED').length, 0)
assert(listWoolFactRecords({ woolOrderId: readyOrder.woolOrderId }).length > 0)
assert.deepEqual(
  getWoolWorkOrderTabCounts({ keyword: readyOrder.productionOrderNo }),
  { READY: 1, NOT_READY: 0, COMPLETED: 0 },
)
assert(getWoolAllowedActions(readyOrder.woolOrderId).includes('REPORT_PROCESS'))

const stockOrder = allOrders.find((item) => item.mockScenarioCode === 'MULTIPLE_HANDOVERS_WITH_STOCK')!
const stockLine = stockOrder.outputPlanLines[0]
assert.equal(getWoolOutputReportedQty(stockOrder.woolOrderId, stockLine.outputSkuCode), 100)
assert.equal(getWoolOutputHandedOverQty(stockOrder.woolOrderId, stockLine.outputSkuCode), 50)
assert.equal(getWoolWarehouseStock({
  woolOrderId: stockOrder.woolOrderId,
  objectSkuCode: stockLine.outputSkuCode,
  defaultLocationId: 'WOOL-WH-GARMENT-DEFAULT',
}), 50)
assert(getWoolAllowedActions(stockOrder.woolOrderId).includes('HANDOVER'))
assert(listWoolFactRecords({
  woolOrderId: stockOrder.woolOrderId,
  recordType: 'HANDOVER',
}).length === 2)
assert.deepEqual(
  new Set(listWoolFactRecords({
    woolOrderId: stockOrder.woolOrderId,
    objectSkuCode: stockLine.outputSkuCode,
  }).map((item) => item.recordType)),
  new Set(['PROCESS_REPORT', 'HANDOVER', 'WAREHOUSE_FLOW']),
)

const qtyChangeOrder = allOrders.find((item) => item.mockScenarioCode === 'QTY_CHANGE_STOCK_SYNC')!
const qtyChangeLine = qtyChangeOrder.outputPlanLines[0]
const qtyChangeFacts = listWoolFactRecords({
  woolOrderId: qtyChangeOrder.woolOrderId,
  recordType: 'QTY_CHANGE',
})
assert.equal(qtyChangeFacts.length, 2, '加工单数量修改历史必须反查到接收、填报或交出事实')
assert.deepEqual(
  new Set(qtyChangeFacts.map((item) => item.record).map((record) =>
    'recordType' in record ? record.recordType : '',
  )),
  new Set(['PROCESS_REPORT', 'HANDOVER']),
)
const qtyChangeFlows = listWoolFactRecords({
  woolOrderId: qtyChangeOrder.woolOrderId,
  recordType: 'WAREHOUSE_FLOW',
}).filter((item) =>
  'businessType' in item.record
  && item.record.businessType === 'STOCK_ADJUSTMENT',
)
assert.equal(qtyChangeFlows.length, 2, '加工填报和交出修改都必须有差额仓库流水')
assert.equal(getWoolWarehouseStock({
  woolOrderId: qtyChangeOrder.woolOrderId,
  objectSkuCode: qtyChangeLine.outputSkuCode,
  defaultLocationId: 'WOOL-WH-GARMENT-DEFAULT',
}), 7)

const mixedKindOrder = allOrders.find((item) => item.mockScenarioCode === 'MIXED_ORDER_KINDS')!
const sameProductionOrders = allOrders.filter((item) =>
  item.productionOrderId === mixedKindOrder.productionOrderId,
)
assert.equal(sameProductionOrders.length, 2, '同一生产单必须存在两张具体毛织加工单')
assert.deepEqual(
  new Set(sameProductionOrders.map((item) => item.kind)),
  new Set(['WHOLE_GARMENT', 'PART_PANEL']),
)
const mixedWholeOrder = sameProductionOrders.find((item) => item.kind === 'WHOLE_GARMENT')!
const mixedPanelOrder = sameProductionOrders.find((item) => item.kind === 'PART_PANEL')!
assert.notEqual(mixedWholeOrder.woolOrderId, mixedPanelOrder.woolOrderId)
assert.deepEqual(
  [...new Set(mixedWholeOrder.outputPlanLines.map((item) => item.garmentSkuCode))].sort(),
  [...new Set(mixedPanelOrder.outputPlanLines.map((item) => item.garmentSkuCode))].sort(),
  '同生产单的整件与部位毛织单必须复用完全相同的成衣 SKU 范围',
)
assert.equal(mixedWholeOrder.sourceTechPackVersionId, mixedPanelOrder.sourceTechPackVersionId)
assert.equal(mixedWholeOrder.sourceTechPackVersionCode, mixedPanelOrder.sourceTechPackVersionCode)
assert.deepEqual(
  new Set(mixedWholeOrder.outputPlanLines.map((item) => item.sourceTechPackVersionId)),
  new Set([mixedPanelOrder.sourceTechPackVersionId]),
)
assert.deepEqual(
  new Set(mixedWholeOrder.outputPlanLines.map((item) => item.sourceTechPackVersionCode)),
  new Set([mixedPanelOrder.sourceTechPackVersionCode]),
)
assert.equal(mixedWholeOrder.outputPlanLines.every((item) => item.outputObjectType === 'GARMENT'), true)
assert.equal(mixedPanelOrder.outputPlanLines.every((item) => item.outputObjectType === 'WOOL_PANEL'), true)
assert.equal(
  mixedWholeOrder.outputPlanLines.some((wholeLine) =>
    mixedPanelOrder.outputPlanLines.some((panelLine) =>
      panelLine.outputSkuCode === wholeLine.outputSkuCode,
    ),
  ),
  false,
)

const issueReturnOrder = allOrders.find((item) => item.mockScenarioCode === 'YARN_ISSUE_RETURN')!
const issueReturnStore = readWoolStore()
const issueRecords = issueReturnStore.yarnIssues.filter((item) => item.woolOrderId === issueReturnOrder.woolOrderId)
const returnRecords = issueReturnStore.yarnReturns.filter((item) => item.woolOrderId === issueReturnOrder.woolOrderId)
assert.equal(issueRecords.length, 2)
assert.equal(returnRecords.length, 2)
for (const issue of issueRecords) {
  assert(issueReturnStore.warehouseFlows.some((flow) =>
    flow.flowId === issue.warehouseOutboundFlowId
    && flow.businessType === 'YARN_ISSUE'
    && flow.sourceRecordId === issue.issueId,
  ))
}
for (const returned of returnRecords) {
  assert(issueReturnStore.warehouseFlows.some((flow) =>
    flow.flowId === returned.warehouseInboundFlowId
    && flow.businessType === 'YARN_RETURN'
    && flow.sourceRecordId === returned.returnId,
  ))
}
assert(
  returnRecords.reduce((sum, item) => sum + item.returnedQty, 0)
  <= issueRecords.reduce((sum, item) => sum + item.issuedQty, 0),
)
assert.equal(getWoolWarehouseStock({
  woolOrderId: issueReturnOrder.woolOrderId,
  objectSkuCode: 'YARN-A',
  batchNo: 'BATCH-AB',
  defaultLocationId: 'WOOL-WP-YARN-DEFAULT',
}), 0.5)

const autoReleaseOrder = allOrders.find((item) => item.mockScenarioCode === 'MACHINE_STATUS_AUTO_RELEASE')!
const autoReleaseStore = readWoolStore()
const autoReleaseLogs = autoReleaseStore.machineAssociationLogs.filter((item) =>
  item.fromWoolOrderId === autoReleaseOrder.woolOrderId
  && item.action === 'UNASSOCIATE'
  && (item.reason === 'MACHINE_REPAIR' || item.reason === 'MACHINE_DISABLED'),
)
assert.deepEqual(
  new Set(autoReleaseLogs.map((item) => item.reason)),
  new Set(['MACHINE_REPAIR', 'MACHINE_DISABLED']),
)
for (const autoReleaseLog of autoReleaseLogs) {
  assert(autoReleaseStore.machineAssociationLogs.some((item) =>
    item.machineId === autoReleaseLog.machineId
    && item.action === 'ASSOCIATE'
    && item.toWoolOrderId === autoReleaseOrder.woolOrderId
    && item.operatedAt < autoReleaseLog.operatedAt,
  ), `${autoReleaseLog.machineId} 自动解除前必须存在更早的生产关联事实`)
  assert.equal(
    autoReleaseStore.machines.find((item) => item.machineId === autoReleaseLog.machineId)?.status,
    autoReleaseLog.reason === 'MACHINE_REPAIR' ? 'REPAIR' : 'DISABLED',
  )
  assert.equal(
    autoReleaseStore.machineAssociations.some((item) => item.machineId === autoReleaseLog.machineId),
    false,
  )
}

const transferTargetOrder = allOrders.find((item) => item.mockScenarioCode === 'MACHINE_ASSOCIATION_B')!
const transferStore = readWoolStore()
const transferLog = transferStore.machineAssociationLogs.find((item) =>
  item.action === 'TRANSFER'
  && item.toWoolOrderId === transferTargetOrder.woolOrderId,
)
assert(transferLog?.fromWoolOrderId)
assert(transferStore.machineAssociationLogs.some((item) =>
  item.machineId === transferLog.machineId
  && item.action === 'ASSOCIATE'
  && item.toWoolOrderId === transferLog.fromWoolOrderId,
))
assert.equal(
  transferStore.machineAssociations.some((item) =>
    item.machineId === transferLog.machineId
    && item.woolOrderId === transferTargetOrder.woolOrderId,
  ),
  true,
)
assert.equal(
  transferStore.machines.find((item) => item.machineId === transferLog.machineId)?.status,
  'IN_PRODUCTION',
)
for (const association of transferStore.machineAssociations) {
  assert.equal(
    transferStore.machines.find((item) => item.machineId === association.machineId)?.status,
    'IN_PRODUCTION',
  )
}

const unavailableOrder = allOrders.find((item) => item.mockScenarioCode === 'MACHINE_UNAVAILABLE')!
const unavailableStore = readWoolStore()
const unavailableMachines = unavailableStore.machines.filter((item) =>
  item.status === 'REPAIR' || item.status === 'DISABLED',
)
assert(unavailableMachines.some((item) => item.status === 'REPAIR'))
assert(unavailableMachines.some((item) => item.status === 'DISABLED'))
assert.equal(
  unavailableStore.machineAssociations.some((association) =>
    unavailableMachines.some((machine) => machine.machineId === association.machineId)
    && association.woolOrderId === unavailableOrder.woolOrderId,
  ),
  false,
)

const completedWithStockOrder = allOrders.find((item) => item.mockScenarioCode === 'COMPLETED_WITH_STOCK')!
const completedWithStockLine = completedWithStockOrder.outputPlanLines[0]
const completedWithStockStore = readWoolStore()
const completedWithStock = completedWithStockStore.completions.find((item) =>
  item.woolOrderId === completedWithStockOrder.woolOrderId,
)!
const completedStockTransfer = completedWithStockStore.warehouseFlows.find((item) =>
  item.woolOrderId === completedWithStockOrder.woolOrderId
  && item.businessType === 'STOCK_TRANSFER',
)!
assert(completedStockTransfer, '完成快照场景必须包含转出 5 件的库存事实')
assert.equal(completedStockTransfer.qty, 5)
assert.equal(completedStockTransfer.fromLocationId, 'WOOL-WH-GARMENT-DEFAULT')
assert.deepEqual(completedWithStock.confirmationSnapshot.processReportSummary, [{
  outputSkuCode: completedWithStockLine.outputSkuCode,
  reportedQty: 30,
  qtyUnit: completedWithStockLine.qtyUnit,
}])
assert.equal(completedWithStock.confirmationSnapshot.handoverSummary[0].handoverQty, 10)
assert.deepEqual(completedWithStock.confirmationSnapshot.waitHandoverStockSummary, [{
  outputSkuCode: completedWithStockLine.outputSkuCode,
  stockQty: 15,
  qtyUnit: completedWithStockLine.qtyUnit,
}])
assert.equal(getWoolWarehouseStock({
  woolOrderId: completedWithStockOrder.woolOrderId,
  objectSkuCode: completedWithStockLine.outputSkuCode,
  defaultLocationId: 'WOOL-WH-GARMENT-DEFAULT',
}), 15)
assert.deepEqual(
  new Set(completedWithStock.confirmationSnapshot.yarnReceiptSummary.map((item) => item.yarnSkuCode)),
  new Set(['YARN-A', 'YARN-B', 'YARN-C']),
)

const releasedOrder = allOrders.find((item) => item.mockScenarioCode === 'COMPLETED_RELEASED_MACHINES')!
const releasedStore = readWoolStore()
const releasedCompletion = releasedStore.completions.find((item) => item.woolOrderId === releasedOrder.woolOrderId)!
const releasedLogMachineIds = releasedStore.machineAssociationLogs
  .filter((item) => item.fromWoolOrderId === releasedOrder.woolOrderId && item.reason === 'ORDER_COMPLETED')
  .map((item) => item.machineId)
  .sort()
assert.deepEqual([...releasedCompletion.confirmationSnapshot.releasedMachineIds].sort(), releasedLogMachineIds)
for (const machineId of releasedCompletion.confirmationSnapshot.releasedMachineIds) {
  const releaseLog = releasedStore.machineAssociationLogs.find((item) =>
    item.machineId === machineId
    && item.fromWoolOrderId === releasedOrder.woolOrderId
    && item.reason === 'ORDER_COMPLETED',
  )!
  assert.equal(releaseLog.operatedAt, releasedCompletion.completedAt)
  const currentAssociation = releasedStore.machineAssociations.find((item) => item.machineId === machineId)
  const machine = releasedStore.machines.find((item) => item.machineId === machineId)!
  if (!currentAssociation) {
    assert.equal(machine.status, 'FREE')
    continue
  }
  assert(currentAssociation.associatedAt > releasedCompletion.completedAt)
  assert.equal(machine.status, 'IN_PRODUCTION')
  assert(releasedStore.machineAssociationLogs.some((item) =>
    item.machineId === machineId
    && item.action === 'ASSOCIATE'
    && item.toWoolOrderId === currentAssociation.woolOrderId
    && item.operatedAt === currentAssociation.associatedAt
    && item.operatedAt > releasedCompletion.completedAt,
  ))
}
assert(releasedCompletion.confirmationSnapshot.processReportSummary[0].reportedQty >= 1)
assert(releasedCompletion.confirmationSnapshot.handoverSummary[0].handoverQty === 1)
assert(releasedCompletion.confirmationSnapshot.waitHandoverStockSummary.every((item) => item.stockQty >= 0))
assert.equal(
  getWoolWarehouseStock({
    woolOrderId: releasedOrder.woolOrderId,
    objectSkuCode: releasedOrder.outputPlanLines[0].outputSkuCode,
    defaultLocationId: 'WOOL-WH-GARMENT-DEFAULT',
  }),
  9,
)

const fixedLocationStore = readWoolStore()
const fixedLocationOrders = allOrders.filter((item) => item.mockScenarioCode === 'FIXED_LOCATION_UI')
assert.deepEqual(
  new Set(fixedLocationOrders.map((item) => item.kind)),
  new Set(['WHOLE_GARMENT', 'PART_PANEL']),
  '固定库位场景必须用整件单和部位单分别承载两类加工后对象',
)
const fixedLocationOrderIds = new Set(fixedLocationOrders.map((item) => item.woolOrderId))
const fixedLocationFlows = fixedLocationStore.warehouseFlows.filter((item) =>
  fixedLocationOrderIds.has(item.woolOrderId),
)
assert.deepEqual(
  new Set(fixedLocationFlows.map((item) => item.defaultLocationId)),
  new Set(['WOOL-WP-YARN-DEFAULT', 'WOOL-WH-CUT-DEFAULT', 'WOOL-WH-GARMENT-DEFAULT']),
)
assert(fixedLocationFlows.every((item) => item.qty > 0))
assert(fixedLocationFlows.every((item) => fixedLocationOrderIds.has(item.woolOrderId)))
assert(fixedLocationStore.warehouseFlows
  .filter((item) => item.sourceRecordId.includes('FIXED-LOCATION-'))
  .every((item) => fixedLocationOrderIds.has(item.woolOrderId)))
for (const flow of fixedLocationFlows.filter((item) =>
  item.businessType === 'PROCESS_REPORT',
)) {
  const owner = fixedLocationStore.workOrders[flow.woolOrderId]
  assert.equal(
    flow.defaultLocationType,
    owner.kind === 'WHOLE_GARMENT' ? 'GARMENT' : 'CUT_PIECE',
  )
}

const mixedBlockOrder = allOrders.find((item) => item.mockScenarioCode === 'REPORTS_AT_LIMIT')!
commitWoolStore((draft) => {
  for (const receipt of draft.yarnReceipts.filter((item) => item.woolOrderId === mixedBlockOrder.woolOrderId)) {
    const removedFlowIds = new Set(
      receipt.lines
        .filter((line) => line.yarnSkuCode === 'YARN-C')
        .map((line) => line.warehouseInboundFlowId),
    )
    receipt.lines = receipt.lines.filter((line) => line.yarnSkuCode !== 'YARN-C')
    draft.warehouseFlows = draft.warehouseFlows.filter((flow) => !removedFlowIds.has(flow.flowId))
  }
})
assert.match(getWoolWorkOrderBlockReason(mixedBlockOrder.woolOrderId), /YARN-C/)
assert.doesNotMatch(
  getWoolWorkOrderBlockReason(mixedBlockOrder.woolOrderId),
  /全部加工后 SKU 已达到填报上限/,
)
resetWoolFactWorkflowMock('CHECK_WOOL_FACT_WORKFLOW_AFTER_MIXED_BLOCK')

commitWoolStore((draft) => {
  const receipt = draft.yarnReceipts.find((item) => item.woolOrderId === readyOrder.woolOrderId)!
  receipt.receivedBy = 'FAKE-SKU-IN-TEXT'
  draft.operationLogs.push({
    operationLogId: 'WOOL-EXACT-SKU-CHECK',
    woolOrderId: readyOrder.woolOrderId,
    action: 'EXACT_SKU_CHECK',
    objectType: 'WORK_ORDER',
    objectId: readyOrder.woolOrderId,
    operatedBy: 'FAKE-SKU-IN-TEXT',
    operatedAt: '2026-07-30 13:30:00',
    remark: '备注提到 FAKE-SKU-IN-TEXT 但不是对象 SKU',
  })
})
assert.equal(listWoolFactRecords({
  woolOrderId: readyOrder.woolOrderId,
  objectSkuCode: 'FAKE-SKU-IN-TEXT',
}).length, 0)
resetWoolFactWorkflowMock('CHECK_WOOL_FACT_WORKFLOW_AFTER_EXACT_SKU')

const reportReadinessStore = readWoolStore()
for (const report of reportReadinessStore.processReports) {
  const order = reportReadinessStore.workOrders[report.woolOrderId]
  const outputLine = order.outputPlanLines.find((item) => item.outputSkuCode === report.outputSkuCode)!
  const requiredYarnSkus = [...new Set(outputLine.requiredYarnSkus)]
  assert(requiredYarnSkus.length > 0, `加工填报 ${report.reportId} 的加工后对象必须有必需纱线`)
  for (const yarnSkuCode of requiredYarnSkus) {
    const receiptLines = reportReadinessStore.yarnReceipts
      .filter((item) => item.woolOrderId === report.woolOrderId)
      .flatMap((item) => item.lines)
      .filter((line) => line.yarnSkuCode === yarnSkuCode && line.receivedQty > 0)
    assert(receiptLines.length > 0, `加工填报 ${report.reportId} 前必须已接收 ${yarnSkuCode}`)
    assert(receiptLines.some((line) =>
      reportReadinessStore.warehouseFlows.some((flow) =>
        flow.flowId === line.warehouseInboundFlowId
        && flow.businessType === 'YARN_RECEIPT'
        && flow.objectSkuCode === yarnSkuCode
        && flow.qty > 0,
      ),
    ), `加工填报 ${report.reportId} 前 ${yarnSkuCode} 必须有正数接收入库流水`)
  }
}

const validStore = readWoolStore()
const factFlowMismatchCases = [
  {
    label: '接收明细数量',
    mutate(store: typeof validStore) {
      const receipt = store.yarnReceipts.find((item) => item.lines.length > 0)!
      const line = receipt.lines[0]
      store.warehouseFlows.find((item) => item.flowId === line.warehouseInboundFlowId)!.qty += 7
    },
  },
  {
    label: '接收批次',
    mutate(store: typeof validStore) {
      const receipt = store.yarnReceipts.find((item) => item.lines.length > 0)!
      const line = receipt.lines[0]
      store.warehouseFlows.find((item) => item.flowId === line.warehouseInboundFlowId)!.batchNo = 'BATCH-WRONG'
    },
  },
  {
    label: '领用数量与单位',
    mutate(store: typeof validStore) {
      const issue = store.yarnIssues[0]
      const flow = store.warehouseFlows.find((item) => item.flowId === issue.warehouseOutboundFlowId)!
      flow.qty += 7
      flow.unit = '件'
    },
  },
  {
    label: '退回数量与批次',
    mutate(store: typeof validStore) {
      const returned = store.yarnReturns[0]
      const flow = store.warehouseFlows.find((item) => item.flowId === returned.warehouseInboundFlowId)!
      flow.qty += 7
      flow.batchNo = 'BATCH-WRONG'
    },
  },
  {
    label: '加工填报数量',
    mutate(store: typeof validStore) {
      const report = store.processReports[0]
      store.warehouseFlows.find((item) => item.flowId === report.warehouseInboundFlowId)!.qty += 7
    },
  },
  {
    label: '加工填报成衣单位',
    mutate(store: typeof validStore) {
      const report = store.processReports.find((item) =>
        store.workOrders[item.woolOrderId]?.kind === 'WHOLE_GARMENT',
      )!
      store.warehouseFlows.find((item) => item.flowId === report.warehouseInboundFlowId)!.unit = 'kg'
    },
  },
  {
    label: '交出数量与单位',
    mutate(store: typeof validStore) {
      const handover = store.handovers[0]
      const flow = store.warehouseFlows.find((item) => item.flowId === handover.warehouseOutboundFlowId)!
      flow.qty += 7
      flow.unit = 'kg'
    },
  },
]
for (const mismatchCase of factFlowMismatchCases) {
  const mismatchStore = structuredClone(validStore)
  mismatchCase.mutate(mismatchStore)
  assert.throws(
    () => validateWoolStore(mismatchStore),
    /事实与仓库流水内容不一致/,
    `${mismatchCase.label}不一致必须被拒绝`,
  )
}

const missingQtyChangeFlowStore = structuredClone(validStore)
const missingFlowChange = missingQtyChangeFlowStore.qtyChangeLogs[0]
missingQtyChangeFlowStore.warehouseFlows = missingQtyChangeFlowStore.warehouseFlows.filter((item) =>
  !(item.sourceRecordType === 'QTY_CHANGE' && item.sourceRecordId === missingFlowChange.changeId),
)
assert.throws(
  () => validateWoolStore(missingQtyChangeFlowStore),
  /数量修改.*恰有一条.*仓库流水/,
  '每条数量修改必须反向拥有一条差额仓库流水',
)

const missingReceiptChangeLineStore = structuredClone(validStore)
const missingLineReceipt = missingReceiptChangeLineStore.yarnReceipts.find((item) => item.lines.length > 0)!
const missingLineReceiptFlow = missingReceiptChangeLineStore.warehouseFlows.find((item) =>
  item.flowId === missingLineReceipt.lines[0].warehouseInboundFlowId,
)!
missingReceiptChangeLineStore.qtyChangeLogs.push({
  changeId: 'WQC-MISSING-RECEIPT-LINE',
  recordType: 'YARN_RECEIPT',
  recordId: missingLineReceipt.receiptId,
  objectSkuCode: missingLineReceipt.lines[0].yarnSkuCode,
  beforeQty: 1,
  afterQty: 2,
  qtyUnit: 'kg',
  reason: '缺少接收明细的错误修改',
  changedAt: '2026-07-30 20:10:00',
  changedBy: '毛织仓管',
})
missingReceiptChangeLineStore.warehouseFlows.push({
  ...structuredClone(missingLineReceiptFlow),
  flowId: 'WF-WQC-MISSING-RECEIPT-LINE',
  flowType: 'ADJUSTMENT',
  businessType: 'STOCK_ADJUSTMENT',
  qty: 1,
  sourceRecordType: 'QTY_CHANGE',
  sourceRecordId: 'WQC-MISSING-RECEIPT-LINE',
})
assert.throws(
  () => validateWoolStore(missingReceiptChangeLineStore),
  /纱线接收数量修改.*接收明细/,
  '纱线接收数量修改必须指向具体明细',
)

const invalidNonReceiptChangeLineStore = structuredClone(validStore)
const nonReceiptChange = invalidNonReceiptChangeLineStore.qtyChangeLogs.find((item) =>
  item.recordType === 'PROCESS_REPORT',
)!
nonReceiptChange.recordLineId = 'RECEIPT-LINE-NOT-ALLOWED'
assert.throws(
  () => validateWoolStore(invalidNonReceiptChangeLineStore),
  /非纱线接收数量修改.*接收明细/,
  '填报和交出数量修改不得携带接收明细 ID',
)

const invalidBusinessDirectionStore = structuredClone(validStore)
invalidBusinessDirectionStore.warehouseFlows.find((item) =>
  item.businessType === 'YARN_RECEIPT',
)!.flowType = 'OUTBOUND'
assert.throws(
  () => validateWoolStore(invalidBusinessDirectionStore),
  /业务类型.*流水方向/,
  '纱线接收不得伪装成出库流水',
)

const invalidOutputLocationStore = structuredClone(validStore)
const garmentReportFlow = invalidOutputLocationStore.warehouseFlows.find((item) =>
  item.businessType === 'PROCESS_REPORT'
  && invalidOutputLocationStore.workOrders[item.woolOrderId]?.kind === 'WHOLE_GARMENT',
)!
garmentReportFlow.defaultLocationType = 'CUT_PIECE'
garmentReportFlow.defaultLocationId = 'WOOL-WH-CUT-DEFAULT'
assert.throws(
  () => validateWoolStore(invalidOutputLocationStore),
  /加工后对象.*默认库位/,
  '整件加工填报不得进入裁片默认库位',
)

const invalidQtyChangeDirectionStore = structuredClone(validStore)
const qtyChangeFlow = invalidQtyChangeDirectionStore.warehouseFlows.find((item) =>
  item.sourceRecordType === 'QTY_CHANGE',
)!
qtyChangeFlow.qty = -qtyChangeFlow.qty
assert.throws(
  () => validateWoolStore(invalidQtyChangeDirectionStore),
  /数量修改.*库存差额/,
  '数量修改流水必须与目标事实的库存方向和差额一致',
)

const invalidGarmentQtyChangeLocationStore = structuredClone(validStore)
const garmentQtyChangeFlow = invalidGarmentQtyChangeLocationStore.warehouseFlows.find((item) =>
  item.sourceRecordType === 'QTY_CHANGE'
  && invalidGarmentQtyChangeLocationStore.qtyChangeLogs.find((change) =>
    change.changeId === item.sourceRecordId
    && change.recordType === 'PROCESS_REPORT',
  ),
)!
garmentQtyChangeFlow.defaultLocationType = 'CUT_PIECE'
garmentQtyChangeFlow.defaultLocationId = 'WOOL-WH-CUT-DEFAULT'
assert.throws(
  () => validateWoolStore(invalidGarmentQtyChangeLocationStore),
  /数量修改.*原始仓库流水/,
  '整件数量修改必须继承原加工填报的成衣默认库位',
)

const invalidYarnQtyChangeLocationStore = structuredClone(validStore)
const yarnQtyReceipt = invalidYarnQtyChangeLocationStore.yarnReceipts
  .find((item) => item.lines.length > 0)!
const yarnQtyLine = yarnQtyReceipt.lines[0]
invalidYarnQtyChangeLocationStore.qtyChangeLogs.push({
  changeId: 'WQC-INVALID-YARN-LOCATION',
  recordType: 'YARN_RECEIPT',
  recordId: yarnQtyReceipt.receiptId,
  recordLineId: yarnQtyLine.lineId,
  objectSkuCode: yarnQtyLine.yarnSkuCode,
  beforeQty: yarnQtyLine.receivedQty,
  afterQty: yarnQtyLine.receivedQty + 1,
  qtyUnit: yarnQtyLine.qtyUnit,
  reason: '纱线接收复核',
  changedAt: '2026-07-30 20:00:00',
  changedBy: '毛织仓管',
})
invalidYarnQtyChangeLocationStore.warehouseFlows.push({
  flowId: 'WF-WQC-INVALID-YARN-LOCATION',
  woolOrderId: yarnQtyReceipt.woolOrderId,
  flowType: 'ADJUSTMENT',
  businessType: 'STOCK_ADJUSTMENT',
  warehouseMode: 'WAIT_HANDOVER',
  defaultLocationType: 'CUT_PIECE',
  defaultLocationId: 'WOOL-WH-CUT-DEFAULT',
  objectSkuCode: yarnQtyLine.yarnSkuCode,
  batchNo: yarnQtyReceipt.batchNo,
  qty: 1,
  unit: yarnQtyLine.qtyUnit,
  sourceRecordType: 'QTY_CHANGE',
  sourceRecordId: 'WQC-INVALID-YARN-LOCATION',
  operatedAt: '2026-07-30 20:00:00',
  operatedBy: '毛织仓管',
})
assert.throws(
  () => validateWoolStore(invalidYarnQtyChangeLocationStore),
  /数量修改.*原始仓库流水/,
  '纱线数量修改必须留在待加工纱线默认库位',
)

const reusedReceiptFlowStore = structuredClone(validStore)
const reusedFlowReceipt = reusedReceiptFlowStore.yarnReceipts.find((item) => item.lines.length > 0)!
reusedFlowReceipt.lines.push({
  ...structuredClone(reusedFlowReceipt.lines[0]),
  lineId: `${reusedFlowReceipt.lines[0].lineId}-DUPLICATED-REFERENCE`,
})
assert.throws(
  () => validateWoolStore(reusedReceiptFlowStore),
  /接收明细.*仓库流水.*一对一/,
  '两个接收明细不得复用同一仓库流水',
)

const independentStockFactStore = structuredClone(validStore)
const independentStockOrder = Object.values(independentStockFactStore.workOrders)
  .find((item) => item.kind === 'WHOLE_GARMENT')!
const independentStockLine = independentStockOrder.outputPlanLines
  .find((item) => item.outputObjectType === 'GARMENT')!
independentStockFactStore.warehouseFlows.push(
  {
    flowId: 'WF-INDEPENDENT-STOCK-ADJUSTMENT',
    woolOrderId: independentStockOrder.woolOrderId,
    flowType: 'ADJUSTMENT',
    businessType: 'STOCK_ADJUSTMENT',
    warehouseMode: 'WAIT_HANDOVER',
    defaultLocationType: 'GARMENT',
    defaultLocationId: 'WOOL-WH-GARMENT-DEFAULT',
    objectSkuCode: independentStockLine.outputSkuCode,
    qty: 2,
    unit: independentStockLine.qtyUnit,
    sourceRecordType: 'STOCK_ADJUSTMENT',
    sourceRecordId: 'STOCK-ADJUSTMENT-INDEPENDENT-001',
    reason: '完成后盘点调整',
    operatedAt: '2026-07-30 19:30:00',
    operatedBy: '毛织仓管',
  },
  {
    flowId: 'WF-INDEPENDENT-STOCK-TRANSFER',
    woolOrderId: independentStockOrder.woolOrderId,
    flowType: 'TRANSFER',
    businessType: 'STOCK_TRANSFER',
    warehouseMode: 'WAIT_HANDOVER',
    defaultLocationType: 'GARMENT',
    defaultLocationId: 'WOOL-WH-GARMENT-DEFAULT',
    objectSkuCode: independentStockLine.outputSkuCode,
    qty: 1,
    unit: independentStockLine.qtyUnit,
    sourceRecordType: 'STOCK_TRANSFER',
    sourceRecordId: 'STOCK-TRANSFER-INDEPENDENT-001',
    fromLocationId: 'WOOL-WH-GARMENT-DEFAULT',
    toLocationId: 'WOOL-WH-OVERFLOW-TEMP',
    reason: '完成后库存转移',
    operatedAt: '2026-07-30 19:40:00',
    operatedBy: '毛织仓管',
  },
)
assert.doesNotThrow(() => validateWoolStore(independentStockFactStore))

const duplicateReceiptSourceStore = structuredClone(validStore)
const receiptSourceFlow = duplicateReceiptSourceStore.warehouseFlows.find((item) =>
  item.sourceRecordType === 'YARN_RECEIPT',
)!
duplicateReceiptSourceStore.warehouseFlows.push({
  ...structuredClone(receiptSourceFlow),
  flowId: `${receiptSourceFlow.flowId}-DUPLICATE-SOURCE`,
})
assert.throws(
  () => validateWoolStore(duplicateReceiptSourceStore),
  /仓库流水来源事实.*重复/,
  '接收来源事实不得通过更换 flowId 重复计库',
)

const duplicateSelfDescribingSourceStore = structuredClone(independentStockFactStore)
const selfDescribingFlow = duplicateSelfDescribingSourceStore.warehouseFlows.find((item) =>
  item.flowId === 'WF-INDEPENDENT-STOCK-ADJUSTMENT',
)!
duplicateSelfDescribingSourceStore.warehouseFlows.push({
  ...structuredClone(selfDescribingFlow),
  flowId: `${selfDescribingFlow.flowId}-DUPLICATE-SOURCE`,
})
assert.throws(
  () => validateWoolStore(duplicateSelfDescribingSourceStore),
  /仓库流水来源事实.*重复/,
  '自描述库存事实也不得复用来源 ID 重复计库',
)

const invalidTransferStore = structuredClone(independentStockFactStore)
delete invalidTransferStore.warehouseFlows
  .find((item) => item.flowId === 'WF-INDEPENDENT-STOCK-TRANSFER')!.toLocationId
assert.throws(() => validateWoolStore(invalidTransferStore), /转移.*库位/)

for (const sourceRecordType of [
  'YARN_RECEIPT',
  'YARN_ISSUE',
  'YARN_RETURN',
  'PROCESS_REPORT',
  'HANDOVER',
  'QTY_CHANGE',
]) {
  const danglingSourceStore = structuredClone(validStore)
  const flow = danglingSourceStore.warehouseFlows.find((item) =>
    item.sourceRecordType === sourceRecordType,
  )!
  assert(flow, `缺少 ${sourceRecordType} 强引用检查样本`)
  flow.sourceRecordId = `DANGLING-${sourceRecordType}`
  assert.throws(
    () => validateWoolStore(danglingSourceStore),
    /有效仓库流水|来源记录/,
    `${sourceRecordType} 悬空来源必须被拒绝`,
  )
}

const duplicateIdStore = structuredClone(validStore)
duplicateIdStore.processReports.push(structuredClone(duplicateIdStore.processReports[0]))
assert.throws(() => validateWoolStore(duplicateIdStore), /重复/)

const orphanOrderStore = structuredClone(validStore)
orphanOrderStore.processReports[0].woolOrderId = 'WOOL-ORDER-NOT-FOUND'
assert.throws(() => validateWoolStore(orphanOrderStore), /加工单/)

const invalidOutputStore = structuredClone(validStore)
invalidOutputStore.processReports[0].outputSkuCode = 'OUTPUT-SKU-NOT-IN-ORDER'
assert.throws(() => validateWoolStore(invalidOutputStore), /加工后 SKU/)

const orphanFlowStore = structuredClone(validStore)
orphanFlowStore.warehouseFlows.find((item) =>
  item.sourceRecordType === 'QTY_CHANGE',
)!.sourceRecordId = 'SOURCE-RECORD-NOT-FOUND'
assert.throws(() => validateWoolStore(orphanFlowStore), /来源记录/)

const orphanQtyChangeStore = structuredClone(validStore)
orphanQtyChangeStore.qtyChangeLogs[0].recordId = 'QTY-TARGET-NOT-FOUND'
assert.throws(() => validateWoolStore(orphanQtyChangeStore), /数量修改目标/)

const orphanMachineStore = structuredClone(validStore)
orphanMachineStore.machineAssociations[0].machineId = 'MACHINE-NOT-FOUND'
assert.throws(() => validateWoolStore(orphanMachineStore), /设备/)

const successfulWritesBefore = storageWrites.length
commitWoolStore((draft) => {
  draft.operationLogs.push({
    operationLogId: 'WOOL-STORE-ATOMIC-CHECK',
    woolOrderId: readyOrder.woolOrderId,
    action: 'STORE_CHECK',
    objectType: 'WORK_ORDER',
    objectId: readyOrder.woolOrderId,
    operatedBy: '专项检查',
    operatedAt: '2026-07-30 13:00:00',
  })
})
assert.equal(storageWrites.length, successfulWritesBefore + 1)
assert.equal(storageWrites.at(-1), WOOL_DOMAIN_STORE_KEY)
assert.equal(
  readWoolStore().operationLogs.some((item) => item.operationLogId === 'WOOL-STORE-ATOMIC-CHECK'),
  true,
)

const failedWritesBefore = storageWrites.length
assert.throws(
  () => commitWoolStore((draft) => {
    draft.workOrders[readyOrder.woolOrderId].woolOrderNo = ''
    throw new Error('模拟事务失败')
  }),
  /模拟事务失败/,
)
assert.equal(storageWrites.length, failedWritesBefore)
assert.notEqual(readWoolStore().workOrders[readyOrder.woolOrderId].woolOrderNo, '')

const validationFailedWritesBefore = storageWrites.length
assert.throws(
  () => commitWoolStore((draft) => {
    draft.workOrders[readyOrder.woolOrderId].woolOrderNo = ''
  }),
  /身份无效/,
)
assert.equal(storageWrites.length, validationFailedWritesBefore)

storageValues.set('higood-fcs-wool-domain-store-v1', 'KEEP-OLD-WOOL-STORE')
storageValues.set('higood-other-domain-store', 'KEEP-OTHER-STORE')
resetWoolFactWorkflowMock('CHECK_WOOL_RESET_SCOPE')
assert.equal(storageValues.get('higood-fcs-wool-domain-store-v1'), 'KEEP-OLD-WOOL-STORE')
assert.equal(storageValues.get('higood-other-domain-store'), 'KEEP-OTHER-STORE')
assert(storageValues.has(WOOL_DOMAIN_STORE_KEY))

const beforeFailedStorageCommit = readWoolStore()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem(key: string) {
      return storageValues.get(key) ?? null
    },
    setItem() {
      throw new Error('模拟 localStorage 写入失败')
    },
  },
})
assert.throws(() => commitWoolStore((draft) => {
  draft.operationLogs.push({
    operationLogId: 'SHOULD-NOT-COMMIT',
    woolOrderId: readyOrder.woolOrderId,
    action: 'STORAGE_FAILURE',
    objectType: 'WORK_ORDER',
    objectId: readyOrder.woolOrderId,
    operatedBy: '专项检查',
    operatedAt: '2026-07-30 14:00:00',
  })
}), /模拟 localStorage 写入失败/)
assert.deepEqual(readWoolStore(), beforeFailedStorageCommit)

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  get() {
    throw new Error('模拟 localStorage getter 失败')
  },
})
clearWoolStoreMemoryCache()
assert(listWoolWorkOrders().length >= 26)

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem() {
      throw new Error('模拟 localStorage getItem 失败')
    },
    setItem(key: string, value: string) {
      storageValues.set(key, value)
    },
  },
})
clearWoolStoreMemoryCache()
assert(listWoolWorkOrders().length >= 26)

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem(key: string) {
      return storageValues.get(key) ?? null
    },
    setItem(key: string, value: string) {
      storageValues.set(key, value)
    },
  },
})
resetWoolFactWorkflowMock('CHECK_WOOL_STORAGE_RECOVERY')

const woolFacadeSource = readFileSync(
  new URL('../src/data/fcs/wool-task-domain.ts', import.meta.url),
  'utf8',
)
for (const explicitExport of [
  "export * from './wool-domain/types.ts'",
  "export * from './wool-domain/tech-pack-source.ts'",
  "export * from './wool-domain/store.ts'",
  "export * from './wool-domain/queries.ts'",
  "export * from './wool-domain/commands.ts'",
  "export * from './wool-domain/machine-associations.ts'",
  "export * from './wool-domain/mock-data.ts'",
]) {
  assert.equal(woolFacadeSource.includes(explicitExport), true, `毛织门面缺少 ${explicitExport}`)
}
assert.equal(woolFacadeSource.includes('WAIT_MACHINE_SCHEDULE'), false)

console.log('PASS task 4: v2 store, derived queries, 26 mock scenarios, and explicit facade')
await import('../src/data/fcs/wool-domain/commands.ts')
