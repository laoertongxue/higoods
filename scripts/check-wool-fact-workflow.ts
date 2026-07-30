import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { alignWoolColorMaterialMappingsForDemand } from '../src/data/fcs/production-tech-pack-snapshot-builder.ts'
import {
  buildWoolPanelOutputSku,
  buildWoolOrderFromRuntimeTask,
  buildWoolOrderSourceSnapshot,
  buildWoolOrderSourceSnapshotFromRuntimeTask,
  setWoolRuntimeOrderCommitConflictForTest,
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
  WoolCommandReceiptValue,
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
  listRuntimeExecutionTasks,
  listRuntimeTaskAllocatableGroups,
  restoreRuntimeDirectDispatchState,
} from '../src/data/fcs/runtime-process-tasks.ts'
import {
  getWoolProcessingStatus,
  getWoolWorkOrderTab,
} from '../src/data/fcs/wool-domain/queries.ts'
import { readWoolStore } from '../src/data/fcs/wool-domain/store.ts'

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
  completionId: 'WCOMP-TYPE-CHECK',
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
    {
      id: 'BOM-YARN-A',
      materialCode: 'YARN-A',
      usageProcessCodes: ['WOOL'],
      applicableSkuCodes: ['GARMENT-BLACK-M'],
    },
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

const emptyYarnSkuSnapshot = buildWoolOrderSourceSnapshot({
  ...sourceBuildInput,
  bomItems: [{
    id: 'BOM-YARN-EMPTY',
    materialCode: '   ',
    usageProcessCodes: ['PROC_WOOL'],
    applicableSkuCodes: ['GARMENT-BLACK-M'],
  }],
  colorMaterialMappings: [{
    ...sourceBuildInput.colorMaterialMappings[0],
    lines: [{
      id: 'MAP-LINE-YARN-EMPTY',
      bomItemId: 'BOM-YARN-EMPTY',
      materialCode: '   ',
      applicableSkuCodes: ['GARMENT-BLACK-M'],
    }],
  }],
})
assert.deepEqual(emptyYarnSkuSnapshot.outputPlanLines[0].requiredYarnSkus, [])
assert.deepEqual(emptyYarnSkuSnapshot.outputPlanLines[0].sourceBomItemIds, [])

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

const unmatchedBomSkuSnapshot = buildWoolOrderSourceSnapshot({
  ...sourceBuildInput,
  bomItems: sourceBuildInput.bomItems.map((item) =>
    item.id === 'BOM-YARN-A'
      ? { ...item, applicableSkuCodes: ['GARMENT-WHITE-M'] }
      : item,
  ),
})
assert.deepEqual(unmatchedBomSkuSnapshot.outputPlanLines[0].requiredYarnSkus, [])
assert.deepEqual(unmatchedBomSkuSnapshot.outputPlanLines[0].sourceBomItemIds, [])
assert.match(unmatchedBomSkuSnapshot.generationIssues.join('；'), /PROC_WOOL 纱线 BOM/)

const perSkuBomIntersectionSnapshot = buildWoolOrderSourceSnapshot({
  ...sourceBuildInput,
  skuLines: [
    sourceBuildInput.skuLines[0],
    {
      skuCode: 'GARMENT-BLACK-L',
      colorCode: 'BLACK',
      colorName: '黑色',
      sizeCode: 'L',
      plannedQty: 80,
    },
  ],
  bomItems: [
    {
      id: 'BOM-YARN-M',
      materialCode: 'YARN-M',
      usageProcessCodes: ['PROC_WOOL'],
      applicableSkuCodes: ['GARMENT-BLACK-M'],
    },
    {
      id: 'BOM-YARN-L',
      materialCode: 'YARN-L',
      usageProcessCodes: ['PROC_WOOL'],
      applicableSkuCodes: ['GARMENT-BLACK-L'],
    },
  ],
  colorMaterialMappings: [{
    ...sourceBuildInput.colorMaterialMappings[0],
    lines: [
      {
        id: 'MAP-LINE-YARN-M',
        bomItemId: 'BOM-YARN-M',
        materialCode: 'YARN-M',
        applicableSkuCodes: ['GARMENT-BLACK-M', 'GARMENT-BLACK-L'],
      },
      {
        id: 'MAP-LINE-YARN-L',
        bomItemId: 'BOM-YARN-L',
        materialCode: 'YARN-L',
        applicableSkuCodes: ['GARMENT-BLACK-L'],
      },
    ],
  }],
})
assert.deepEqual(
  perSkuBomIntersectionSnapshot.outputPlanLines.map((line) => ({
    outputSkuCode: line.outputSkuCode,
    requiredYarnSkus: line.requiredYarnSkus,
    sourceBomItemIds: line.sourceBomItemIds,
  })),
  [
    {
      outputSkuCode: 'GARMENT-BLACK-M',
      requiredYarnSkus: ['YARN-M'],
      sourceBomItemIds: ['BOM-YARN-M'],
    },
    {
      outputSkuCode: 'GARMENT-BLACK-L',
      requiredYarnSkus: ['YARN-L'],
      sourceBomItemIds: ['BOM-YARN-L'],
    },
  ],
)

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

const woolCommandsSource = readFileSync(
  new URL('../src/data/fcs/wool-domain/commands.ts', import.meta.url),
  'utf8',
)
assert.equal(
  woolCommandsSource.includes("from '../factory-internal-warehouse-locations.ts'"),
  true,
)
assert.equal(
  woolCommandsSource.includes("from '../factory-internal-warehouse.ts'"),
  false,
)
const warehouseLocationRegistrySource = readFileSync(
  new URL('../src/data/fcs/factory-internal-warehouse-locations.ts', import.meta.url),
  'utf8',
)
assert.equal(warehouseLocationRegistrySource.includes('pda-handover-events'), false)
assert.equal(warehouseLocationRegistrySource.includes('wool-task-domain'), false)

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
  getWoolCompletion,
  getWoolOutputReadiness,
  getWoolOutputHandedOverQty,
  getWoolOutputReportedQty,
  getWoolOutputStockQty,
  resolveWoolEffectiveQty,
  getWoolProcessingStatus,
  getWoolAllowedActions,
  getWoolWarehouseStock,
  getWoolWorkOrderBlockReason,
  getWoolWorkOrderTab,
  getWoolWorkOrderTabCounts,
  listWoolFactRecords,
  listWoolMachineAssociations,
  listWoolWarehouseFlows,
  listWoolWorkOrders,
} = await import('../src/data/fcs/wool-domain/queries.ts')
const {
  addWoolHandover,
  addWoolProcessReport,
  addWoolYarnReceipt,
  adjustWoolWarehouseStock,
  changeWoolFactQty,
  completeWoolWorkOrder,
  confirmWoolDownstreamReceipt,
  issueWoolYarn,
  returnWoolYarn,
  transferWoolWarehouseStock,
} = await import('../src/data/fcs/wool-domain/commands.ts')
const {
  changeWoolMachineAvailability,
  getWoolMachineById,
  replaceWoolMachineAssociations,
} = await import('../src/data/fcs/wool-domain/machine-associations.ts')
const {
  getExecutionTaskFactById,
  listExecutionTaskFacts,
} = await import('../src/data/fcs/page-adapters/task-execution-adapter.ts')
const {
  WOOL_MOCK_SCENARIO_CODES,
  resetWoolFactWorkflowMock,
} = await import('../src/data/fcs/wool-domain/mock-data.ts')
const {
  createFactoryWarehouseLocationRegistrySnapshot,
  createFactoryWarehouseLocation,
  listFactoryInternalWarehouses,
  resolveEnabledFactoryWarehouseLocation,
  restoreFactoryWarehouseLocationRegistrySnapshot,
  toggleFactoryWarehouseNodeStatus,
} = await import('../src/data/fcs/factory-internal-warehouse-locations.ts')

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
assert.equal(
  getWoolOutputReportedQty(qtyChangeOrder.woolOrderId, qtyChangeLine.outputSkuCode),
  12,
  '填报累计必须使用修改链的当前有效数量',
)
assert.equal(
  getWoolOutputHandedOverQty(qtyChangeOrder.woolOrderId, qtyChangeLine.outputSkuCode),
  5,
  '交出累计必须使用修改链的当前有效数量',
)
assert.equal(
  getWoolOutputReadiness(qtyChangeOrder.woolOrderId, qtyChangeLine.outputSkuCode).reportedQty,
  12,
)
const qtyChangeCompletion = readWoolStore().completions.find((item) =>
  item.woolOrderId === qtyChangeOrder.woolOrderId,
)!
assert(qtyChangeCompletion, '数量修改场景必须生成使用当前有效数量的完成快照')
assert.equal(qtyChangeCompletion.confirmationSnapshot.processReportSummary[0].reportedQty, 12)
assert.equal(qtyChangeCompletion.confirmationSnapshot.handoverSummary[0].handoverQty, 5)
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
  getWoolMachineById(transferLog.machineId)?.status,
  'PRODUCING',
)
for (const association of transferStore.machineAssociations) {
  assert.equal(
    getWoolMachineById(association.machineId)?.status,
    'PRODUCING',
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
  const machine = getWoolMachineById(machineId)!
  if (!currentAssociation) {
    assert.equal(machine.status, 'IDLE')
    continue
  }
  assert(currentAssociation.associatedAt > releasedCompletion.completedAt)
  assert.equal(machine.status, 'PRODUCING')
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
  for (const line of receipt.lines) {
    draft.warehouseFlows.find((flow) => flow.flowId === line.warehouseInboundFlowId)!.operatedBy =
      receipt.receivedBy
  }
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
const invalidReportChainStore = structuredClone(validStore)
const existingReportChange = invalidReportChainStore.qtyChangeLogs.find((item) =>
  item.recordType === 'PROCESS_REPORT',
)!
const existingReportChangeFlow = invalidReportChainStore.warehouseFlows.find((item) =>
  item.sourceRecordType === 'QTY_CHANGE' && item.sourceRecordId === existingReportChange.changeId,
)!
invalidReportChainStore.qtyChangeLogs.push({
  ...structuredClone(existingReportChange),
  changeId: 'WQC-Z-INVALID-REPORT-CHAIN',
  beforeQty: 20,
  afterQty: 21,
})
invalidReportChainStore.warehouseFlows.push({
  ...structuredClone(existingReportChangeFlow),
  flowId: 'WF-WQC-Z-INVALID-REPORT-CHAIN',
  qty: 1,
  sourceRecordId: 'WQC-Z-INVALID-REPORT-CHAIN',
})
assert.throws(
  () => validateWoolStore(invalidReportChainStore),
  /数量修改链.*不连续/,
  '10→12 后追加 20→21 必须被拒绝',
)

const validReportChainStore = structuredClone(validStore)
const validReportBaseChange = validReportChainStore.qtyChangeLogs.find((item) =>
  item.recordType === 'PROCESS_REPORT',
)!
const validReportBaseFlow = validReportChainStore.warehouseFlows.find((item) =>
  item.sourceRecordType === 'QTY_CHANGE' && item.sourceRecordId === validReportBaseChange.changeId,
)!
validReportChainStore.qtyChangeLogs.push({
  ...structuredClone(validReportBaseChange),
  changeId: 'WQC-Z-VALID-REPORT-CHAIN',
  beforeQty: 12,
  afterQty: 13,
})
validReportChainStore.warehouseFlows.push({
  ...structuredClone(validReportBaseFlow),
  flowId: 'WF-WQC-Z-VALID-REPORT-CHAIN',
  qty: 1,
  sourceRecordId: 'WQC-Z-VALID-REPORT-CHAIN',
})
assert.doesNotThrow(() => validateWoolStore(validReportChainStore))
assert.equal(resolveWoolEffectiveQty(validReportChainStore.qtyChangeLogs, {
  recordType: 'PROCESS_REPORT',
  recordId: validReportBaseChange.recordId,
  baseQty: 10,
}), 13)

const sameTimeAppendOrderStore = structuredClone(validStore)
const sameTimeBaseChange = sameTimeAppendOrderStore.qtyChangeLogs.find((item) =>
  item.recordType === 'PROCESS_REPORT',
)!
const sameTimeBaseFlow = sameTimeAppendOrderStore.warehouseFlows.find((item) =>
  item.sourceRecordType === 'QTY_CHANGE' && item.sourceRecordId === sameTimeBaseChange.changeId,
)!
for (const [changeId, beforeQty, afterQty] of [
  ['WQC-Z-SAME-TIME-APPEND', 12, 13],
  ['WQC-A-SAME-TIME-APPEND', 13, 14],
] as const) {
  sameTimeAppendOrderStore.qtyChangeLogs.push({
    ...structuredClone(sameTimeBaseChange),
    changeId,
    beforeQty,
    afterQty,
  })
  sameTimeAppendOrderStore.warehouseFlows.push({
    ...structuredClone(sameTimeBaseFlow),
    flowId: `WF-${changeId}`,
    qty: 1,
    sourceRecordId: changeId,
  })
}
assert.doesNotThrow(
  () => validateWoolStore(sameTimeAppendOrderStore),
  '同一时间必须保留 Z 后 A 的事实追加顺序',
)
assert.equal(resolveWoolEffectiveQty(sameTimeAppendOrderStore.qtyChangeLogs, {
  recordType: 'PROCESS_REPORT',
  recordId: sameTimeBaseChange.recordId,
  baseQty: 10,
}), 14)

const backwardChangedAtStore = structuredClone(validStore)
const backwardBaseChange = backwardChangedAtStore.qtyChangeLogs.find((item) =>
  item.recordType === 'PROCESS_REPORT',
)!
const backwardBaseFlow = backwardChangedAtStore.warehouseFlows.find((item) =>
  item.sourceRecordType === 'QTY_CHANGE' && item.sourceRecordId === backwardBaseChange.changeId,
)!
backwardChangedAtStore.qtyChangeLogs.push({
  ...structuredClone(backwardBaseChange),
  changeId: 'WQC-BACKWARD-CHANGED-AT',
  beforeQty: 12,
  afterQty: 13,
  changedAt: '2026-07-30 07:59:59',
})
backwardChangedAtStore.warehouseFlows.push({
  ...structuredClone(backwardBaseFlow),
  flowId: 'WF-WQC-BACKWARD-CHANGED-AT',
  qty: 1,
  sourceRecordId: 'WQC-BACKWARD-CHANGED-AT',
  operatedAt: '2026-07-30 07:59:59',
})
assert.throws(
  () => validateWoolStore(backwardChangedAtStore),
  /数量修改链.*追加时间倒退/,
  '数组尾部不得追加更早的 changedAt',
)

const validHandoverChainStore = structuredClone(validStore)
const validHandoverBaseChange = validHandoverChainStore.qtyChangeLogs.find((item) =>
  item.recordType === 'HANDOVER',
)!
const validHandoverBaseFlow = validHandoverChainStore.warehouseFlows.find((item) =>
  item.sourceRecordType === 'QTY_CHANGE' && item.sourceRecordId === validHandoverBaseChange.changeId,
)!
validHandoverChainStore.qtyChangeLogs.push({
  ...structuredClone(validHandoverBaseChange),
  changeId: 'WQC-Z-VALID-HANDOVER-CHAIN',
  beforeQty: 5,
  afterQty: 6,
})
validHandoverChainStore.warehouseFlows.push({
  ...structuredClone(validHandoverBaseFlow),
  flowId: 'WF-WQC-Z-VALID-HANDOVER-CHAIN',
  qty: -1,
  sourceRecordId: 'WQC-Z-VALID-HANDOVER-CHAIN',
})
assert.doesNotThrow(() => validateWoolStore(validHandoverChainStore))
assert.equal(resolveWoolEffectiveQty(validHandoverChainStore.qtyChangeLogs, {
  recordType: 'HANDOVER',
  recordId: validHandoverBaseChange.recordId,
  baseQty: 4,
}), 6)

const validReceiptChainStore = structuredClone(validStore)
const chainReceipt = validReceiptChainStore.yarnReceipts.find((item) => item.lines.length > 0)!
const chainReceiptLine = chainReceipt.lines[0]
const chainReceiptBaseFlow = validReceiptChainStore.warehouseFlows.find((item) =>
  item.flowId === chainReceiptLine.warehouseInboundFlowId,
)!
for (const [changeId, beforeQty, afterQty] of [
  ['WQC-A-VALID-RECEIPT-CHAIN', 1, 2],
  ['WQC-B-VALID-RECEIPT-CHAIN', 2, 3],
] as const) {
  validReceiptChainStore.qtyChangeLogs.push({
    changeId,
    recordType: 'YARN_RECEIPT',
    recordId: chainReceipt.receiptId,
    recordLineId: chainReceiptLine.lineId,
    objectSkuCode: chainReceiptLine.yarnSkuCode,
    beforeQty,
    afterQty,
    qtyUnit: chainReceiptLine.qtyUnit,
    reason: '连续复核纱线接收数量',
    changedAt: '2026-07-30 21:00:00',
    changedBy: '毛织仓管',
  })
  validReceiptChainStore.warehouseFlows.push({
    ...structuredClone(chainReceiptBaseFlow),
    flowId: `WF-${changeId}`,
    flowType: 'ADJUSTMENT',
    businessType: 'STOCK_ADJUSTMENT',
    qty: afterQty - beforeQty,
    sourceRecordType: 'QTY_CHANGE',
    sourceRecordId: changeId,
    operatedAt: '2026-07-30 21:00:00',
  })
}
assert.doesNotThrow(() => validateWoolStore(validReceiptChainStore))
assert.equal(resolveWoolEffectiveQty(validReceiptChainStore.qtyChangeLogs, {
  recordType: 'YARN_RECEIPT',
  recordId: chainReceipt.receiptId,
  recordLineId: chainReceiptLine.lineId,
  baseQty: chainReceiptLine.receivedQty,
}), 3)

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

const factFlowSourceTypeCases = [
  {
    label: '纱线接收',
    expectedType: 'YARN_RECEIPT',
    wrongType: 'PROCESS_REPORT',
    resolveFlow(store: typeof validStore) {
      const receipt = store.yarnReceipts.find((item) => item.lines.length > 0)!
      return store.warehouseFlows.find((item) =>
        item.flowId === receipt.lines[0].warehouseInboundFlowId,
      )!
    },
  },
  {
    label: '纱线领用',
    expectedType: 'YARN_ISSUE',
    wrongType: 'YARN_RETURN',
    resolveFlow(store: typeof validStore) {
      return store.warehouseFlows.find((item) =>
        item.flowId === store.yarnIssues[0].warehouseOutboundFlowId,
      )!
    },
  },
  {
    label: '纱线退回',
    expectedType: 'YARN_RETURN',
    wrongType: 'YARN_ISSUE',
    resolveFlow(store: typeof validStore) {
      return store.warehouseFlows.find((item) =>
        item.flowId === store.yarnReturns[0].warehouseInboundFlowId,
      )!
    },
  },
  {
    label: '加工填报',
    expectedType: 'PROCESS_REPORT',
    wrongType: 'HANDOVER',
    resolveFlow(store: typeof validStore) {
      return store.warehouseFlows.find((item) =>
        item.flowId === store.processReports[0].warehouseInboundFlowId,
      )!
    },
  },
  {
    label: '成品交出',
    expectedType: 'HANDOVER',
    wrongType: 'PROCESS_REPORT',
    resolveFlow(store: typeof validStore) {
      return store.warehouseFlows.find((item) =>
        item.flowId === store.handovers[0].warehouseOutboundFlowId,
      )!
    },
  },
] as const
for (const sourceTypeCase of factFlowSourceTypeCases) {
  const wrongSourceTypeStore = structuredClone(validStore)
  const flow = sourceTypeCase.resolveFlow(wrongSourceTypeStore)
  assert.equal(flow.sourceRecordType, sourceTypeCase.expectedType)
  flow.sourceRecordType = sourceTypeCase.wrongType
  assert.throws(
    () => validateWoolStore(wrongSourceTypeStore),
    /事实与仓库流水.*来源类型.*不一致/,
    `${sourceTypeCase.label}流水必须精确镜像 ${sourceTypeCase.expectedType}`,
  )
}

const crossTypeSameIdStore = structuredClone(validStore)
const crossTypeReceipt = crossTypeSameIdStore.yarnReceipts.find((item) => item.lines.length > 0)!
const crossTypeReceiptLine = crossTypeReceipt.lines[0]
const crossTypeReceiptFlow = crossTypeSameIdStore.warehouseFlows.find((item) =>
  item.flowId === crossTypeReceiptLine.warehouseInboundFlowId,
)!
const crossTypeReport = crossTypeSameIdStore.processReports.find((report) =>
  !crossTypeSameIdStore.qtyChangeLogs.some((change) =>
    change.recordType === 'PROCESS_REPORT' && change.recordId === report.reportId,
  ),
)!
const crossTypeReportFlow = crossTypeSameIdStore.warehouseFlows.find((item) =>
  item.flowId === crossTypeReport.warehouseInboundFlowId,
)!
const crossTypeSharedId = 'WOOL-CROSS-TYPE-SAME-ID'
crossTypeReceiptLine.lineId = crossTypeSharedId
crossTypeReceiptFlow.sourceRecordId = crossTypeSharedId
crossTypeReport.reportId = crossTypeSharedId
crossTypeReportFlow.sourceRecordId = crossTypeSharedId
crossTypeReceiptFlow.sourceRecordType = 'PROCESS_REPORT'
crossTypeReportFlow.sourceRecordType = 'YARN_RECEIPT'
assert.throws(
  () => validateWoolStore(crossTypeSameIdStore),
  /事实与仓库流水.*来源类型.*不一致/,
  '接收与填报使用相同来源 ID 时，交换 sourceRecordType 仍必须被拒绝',
)

const woolStoreSource = readFileSync(
  new URL('../src/data/fcs/wool-domain/store.ts', import.meta.url),
  'utf8',
)
for (const sourceTypeCase of factFlowSourceTypeCases) {
  assert.equal(
    woolStoreSource.includes(`flow.sourceRecordType !== '${sourceTypeCase.expectedType}'`),
    true,
    `${sourceTypeCase.label}缺少 sourceRecordType 源码镜像校验`,
  )
}

const factFlowAuditCases = [
  {
    label: '纱线接收',
    resolve(store: typeof validStore) {
      const receipt = store.yarnReceipts.find((item) => item.lines.length > 0)!
      const flow = store.warehouseFlows.find((item) =>
        item.flowId === receipt.lines[0].warehouseInboundFlowId,
      )!
      return {
        flow,
        expectedAt: receipt.receivedAt,
        expectedBy: receipt.receivedBy,
      }
    },
  },
  {
    label: '纱线领用',
    resolve(store: typeof validStore) {
      const issue = store.yarnIssues[0]
      const flow = store.warehouseFlows.find((item) => item.flowId === issue.warehouseOutboundFlowId)!
      return {
        flow,
        expectedAt: issue.issuedAt,
        expectedBy: issue.issuedBy,
      }
    },
  },
  {
    label: '纱线退回',
    resolve(store: typeof validStore) {
      const returned = store.yarnReturns[0]
      const flow = store.warehouseFlows.find((item) => item.flowId === returned.warehouseInboundFlowId)!
      return {
        flow,
        expectedAt: returned.returnedAt,
        expectedBy: returned.returnedBy,
      }
    },
  },
  {
    label: '加工填报',
    resolve(store: typeof validStore) {
      const report = store.processReports[0]
      const flow = store.warehouseFlows.find((item) => item.flowId === report.warehouseInboundFlowId)!
      return {
        flow,
        expectedAt: report.reportedAt,
        expectedBy: report.reportedBy,
      }
    },
  },
  {
    label: '成品交出',
    resolve(store: typeof validStore) {
      const handover = store.handovers[0]
      const flow = store.warehouseFlows.find((item) => item.flowId === handover.warehouseOutboundFlowId)!
      return {
        flow,
        expectedAt: handover.handedOverAt,
        expectedBy: handover.handedOverBy,
      }
    },
  },
]
for (const auditCase of factFlowAuditCases) {
  const fakeTimeStore = structuredClone(validStore)
  const fakeTimeAudit = auditCase.resolve(fakeTimeStore)
  assert.equal(fakeTimeAudit.flow.operatedAt, fakeTimeAudit.expectedAt)
  fakeTimeAudit.flow.operatedAt = '1999-01-01 00:00:00'
  assert.throws(
    () => validateWoolStore(fakeTimeStore),
    /事实与仓库流水.*操作时间.*不一致/,
    `${auditCase.label}流水不得伪造 1999 操作时间`,
  )

  const fakeOperatorStore = structuredClone(validStore)
  const fakeOperatorAudit = auditCase.resolve(fakeOperatorStore)
  assert.equal(fakeOperatorAudit.flow.operatedBy, fakeOperatorAudit.expectedBy)
  fakeOperatorAudit.flow.operatedBy = '伪造操作人'
  assert.throws(
    () => validateWoolStore(fakeOperatorStore),
    /事实与仓库流水.*操作人.*不一致/,
    `${auditCase.label}流水不得伪造操作人`,
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

const garmentQtyChangeUnitStore = structuredClone(validStore)
const garmentQtyChange = garmentQtyChangeUnitStore.qtyChangeLogs.find((change) =>
  change.recordType === 'PROCESS_REPORT'
  && garmentQtyChangeUnitStore.workOrders[
    garmentQtyChangeUnitStore.processReports.find((report) => report.reportId === change.recordId)!.woolOrderId
  ]?.kind === 'WHOLE_GARMENT',
)!
garmentQtyChange.qtyUnit = 'kg'
assert.throws(
  () => validateWoolStore(garmentQtyChangeUnitStore),
  /数量修改.*单位.*目标事实.*不一致/,
  '成衣件数修改不得伪装为 kg',
)

for (const [label, mutate] of [
  ['操作时间', (flow: WoolWarehouseFlow) => { flow.operatedAt = '1999-01-01 00:00:00' }],
  ['操作人', (flow: WoolWarehouseFlow) => { flow.operatedBy = '伪造操作人' }],
] as const) {
  const fakeQtyChangeAuditStore = structuredClone(validStore)
  const change = fakeQtyChangeAuditStore.qtyChangeLogs[0]
  const flow = fakeQtyChangeAuditStore.warehouseFlows.find((item) =>
    item.sourceRecordType === 'QTY_CHANGE' && item.sourceRecordId === change.changeId,
  )!
  mutate(flow)
  assert.throws(
    () => validateWoolStore(fakeQtyChangeAuditStore),
    new RegExp(`数量修改.*流水${label}.*不一致`),
    `数量修改差额流水不得伪造${label}`,
  )
}

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

const mismatchedWorkOrderKeyStore = structuredClone(validStore)
const mismatchedWorkOrderKey = Object.keys(mismatchedWorkOrderKeyStore.workOrders)[0]
const mismatchedWorkOrder = mismatchedWorkOrderKeyStore.workOrders[mismatchedWorkOrderKey]
delete mismatchedWorkOrderKeyStore.workOrders[mismatchedWorkOrderKey]
mismatchedWorkOrderKeyStore.workOrders['WOOL-ORDER-WRONG-KEY'] = mismatchedWorkOrder
assert.throws(
  () => validateWoolStore(mismatchedWorkOrderKeyStore),
  /加工单.*身份无效/,
  'workOrders key 必须等于加工单 woolOrderId',
)

const duplicateTaskIdentityStore = structuredClone(validStore)
const duplicateTaskSourceOrder = Object.values(duplicateTaskIdentityStore.workOrders)[0]
duplicateTaskIdentityStore.workOrders['WOOL-ORDER-DUPLICATE-TASK'] = {
  ...structuredClone(duplicateTaskSourceOrder),
  woolOrderId: 'WOOL-ORDER-DUPLICATE-TASK',
  woolOrderNo: 'WMO-DUPLICATE-TASK',
}
assert.throws(
  () => validateWoolStore(duplicateTaskIdentityStore),
  /加工单任务.*重复/,
  '同一 taskId 不得伪装成两张毛织加工单',
)

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

resetWoolFactWorkflowMock('CHECK_WOOL_FACT_COMMANDS')
const reportOrder = listWoolWorkOrders().find((item) => item.mockScenarioCode === 'ONE_COLOR_READY')!
const reportLine = reportOrder.outputPlanLines.find(
  (item) => getWoolOutputReadiness(reportOrder.woolOrderId, item.outputSkuCode).isReady,
)!

const atomicCommandInput = {
  commandId: 'CMD-RECEIPT-STORAGE-RETRY',
  receivedAt: '2026-07-30 09:20:00',
  receivedBy: '毛织仓管',
  lines: [{ yarnSkuCode: 'YARN-A', receivedQty: 1 }],
}
const beforeFailedCommandCommit = readWoolStore()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem(key: string) {
      return storageValues.get(key) ?? null
    },
    setItem() {
      throw new Error('模拟命令收据持久化失败')
    },
  },
})
assert.throws(
  () => addWoolYarnReceipt(reportOrder.woolOrderId, atomicCommandInput),
  /模拟命令收据持久化失败/,
)
assert.deepEqual(readWoolStore(), beforeFailedCommandCommit)
assert.equal(
  readWoolStore().operationLogs.some((log) =>
    log.operationLogId === 'WOOL-COMMAND-RECEIPT-CMD-RECEIPT-STORAGE-RETRY',
  ),
  false,
)
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
addWoolYarnReceipt(reportOrder.woolOrderId, atomicCommandInput)
assert(
  readWoolStore().operationLogs.some((log) =>
    log.operationLogId === 'WOOL-COMMAND-RECEIPT-CMD-RECEIPT-STORAGE-RETRY',
  ),
)

const receipt = addWoolYarnReceipt(reportOrder.woolOrderId, {
  commandId: 'CMD-RECEIPT-CHECK-001',
  deliveryNo: 'DN-CHECK-001',
  batchNo: 'BATCH-CHECK-001',
  receivedAt: '2026-07-30 09:30:00',
  receivedBy: '毛织仓管',
  lines: [
    { yarnSkuCode: 'YARN-A', yarnName: 'A 纱线', receivedQty: 5 },
    { yarnSkuCode: 'YARN-B', yarnName: 'B 纱线', receivedQty: 5 },
  ],
})
const receiptRetry = addWoolYarnReceipt(reportOrder.woolOrderId, {
  lines: [
    { receivedQty: 5, yarnName: 'A 纱线', yarnSkuCode: 'YARN-A' },
    { receivedQty: 5, yarnName: 'B 纱线', yarnSkuCode: 'YARN-B' },
  ],
  receivedBy: '毛织仓管',
  receivedAt: '2026-07-30 09:30:00',
  batchNo: 'BATCH-CHECK-001',
  deliveryNo: 'DN-CHECK-001',
  commandId: 'CMD-RECEIPT-CHECK-001',
})
assert.deepEqual(receiptRetry, receipt)
assert.throws(
  () => addWoolYarnReceipt(reportOrder.woolOrderId, {
    commandId: 'CMD-RECEIPT-CHECK-001',
    deliveryNo: 'DN-RETRY-MUST-NOT-OVERWRITE',
    batchNo: 'BATCH-CHECK-001',
    receivedAt: '2026-07-30 09:31:00',
    receivedBy: '另一个入口',
    lines: [{ yarnSkuCode: 'YARN-A', receivedQty: 99 }],
  }),
  /commandId 已被其他请求占用|幂等冲突/,
)
const otherWoolOrder = listWoolWorkOrders().find((item) =>
  item.woolOrderId !== reportOrder.woolOrderId,
)!
assert.throws(
  () => addWoolYarnReceipt(otherWoolOrder.woolOrderId, {
    commandId: 'CMD-RECEIPT-CHECK-001',
    deliveryNo: 'DN-CHECK-001',
    batchNo: 'BATCH-CHECK-001',
    receivedAt: '2026-07-30 09:30:00',
    receivedBy: '毛织仓管',
    lines: [
      { yarnSkuCode: 'YARN-A', yarnName: 'A 纱线', receivedQty: 5 },
      { yarnSkuCode: 'YARN-B', yarnName: 'B 纱线', receivedQty: 5 },
    ],
  }),
  /commandId 已被其他请求占用|幂等冲突/,
)
assert.throws(
  () => addWoolProcessReport(reportOrder.woolOrderId, {
    commandId: 'CMD-RECEIPT-CHECK-001',
    outputSkuCode: reportLine.outputSkuCode,
    reportedQty: 1,
    reportedAt: '2026-07-30 09:35:00',
    reportedBy: '毛织主管',
  }),
  /commandId 已被其他请求占用|幂等冲突/,
)
assert.equal(listWoolWarehouseFlows({ sourceRecordType: 'YARN_RECEIPT' })
  .filter((item) => receipt.lines.some((line) => line.lineId === item.sourceRecordId)).length, 2)
assert(listWoolWarehouseFlows({ sourceRecordType: 'YARN_RECEIPT' })
  .filter((item) => receipt.lines.some((line) => line.lineId === item.sourceRecordId))
  .every((item) => item.defaultLocationId === 'WOOL-WP-YARN-DEFAULT'))
assert.throws(
  () => addWoolYarnReceipt(reportOrder.woolOrderId, {
    commandId: 'CMD-RECEIPT-EMPTY',
    receivedAt: '2026-07-30 09:32:00',
    receivedBy: '毛织仓管',
    lines: [],
  }),
  /至少一条纱线明细/,
)
assert.throws(
  () => addWoolYarnReceipt(reportOrder.woolOrderId, {
    commandId: 'CMD-RECEIPT-FOREIGN',
    receivedAt: '2026-07-30 09:33:00',
    receivedBy: '毛织仓管',
    lines: [{ yarnSkuCode: 'YARN-OUTSIDE', receivedQty: 1 }],
  }),
  /不属于加工单冻结必需纱线/,
)

const report = addWoolProcessReport(reportOrder.woolOrderId, {
  commandId: 'CMD-REPORT-CHECK-001',
  outputSkuCode: reportLine.outputSkuCode,
  reportedQty: 10,
  reportedAt: '2026-07-30 10:00:00',
  reportedBy: '毛织主管',
})
assert.throws(
  () => addWoolProcessReport(reportOrder.woolOrderId, {
    commandId: 'CMD-REPORT-CHECK-001',
    outputSkuCode: reportLine.outputSkuCode,
    reportedQty: 99,
    reportedAt: '2026-07-30 10:01:00',
    reportedBy: '另一个入口',
  }),
  /commandId 已被其他请求占用|幂等冲突/,
)
assert.equal(listWoolWarehouseFlows({ sourceRecordId: report.reportId }).length, 1)
assert.equal(
  listWoolWarehouseFlows({ sourceRecordId: report.reportId })[0].defaultLocationId,
  reportLine.outputObjectType === 'GARMENT' ? 'WOOL-WH-GARMENT-DEFAULT' : 'WOOL-WH-CUT-DEFAULT',
)
assert.throws(
  () => addWoolProcessReport(reportOrder.woolOrderId, {
    commandId: 'CMD-REPORT-DECIMAL',
    outputSkuCode: reportLine.outputSkuCode,
    reportedQty: 1.5,
    reportedAt: '2026-07-30 10:02:00',
    reportedBy: '毛织主管',
  }),
  /正整数/,
)
assert.throws(
  () => addWoolProcessReport(reportOrder.woolOrderId, {
    commandId: 'CMD-REPORT-OVER-LIMIT',
    outputSkuCode: reportLine.outputSkuCode,
    reportedQty: Math.floor(reportLine.plannedQty * 1.5),
    reportedAt: '2026-07-30 10:03:00',
    reportedBy: '毛织主管',
  }),
  /150%/,
)

const handover = addWoolHandover(reportOrder.woolOrderId, {
  commandId: 'CMD-HANDOVER-CHECK-001',
  outputSkuCode: reportLine.outputSkuCode,
  handoverQty: 6,
  handedOverAt: '2026-07-30 11:00:00',
  handedOverBy: '毛织主管',
})
assert.deepEqual(
  {
    receiverType: handover.receiverType,
    receiverId: handover.receiverId,
    receiverName: handover.receiverName,
  },
  reportOrder.downstreamTarget,
)
assert.equal(handover.downstreamReceipt?.status, 'PENDING')
assert.equal(getWoolOutputStockQty(reportOrder.woolOrderId, reportLine.outputSkuCode), 4)
assert.throws(
  () => addWoolHandover(reportOrder.woolOrderId, {
    commandId: 'CMD-HANDOVER-CHECK-001',
    outputSkuCode: reportLine.outputSkuCode,
    handoverQty: 1,
    handedOverAt: '2026-07-30 11:01:00',
    handedOverBy: '另一个入口',
  }),
  /commandId 已被其他请求占用|幂等冲突/,
)

changeWoolFactQty({
  commandId: 'CMD-CHANGE-REPORT-001',
  recordType: 'PROCESS_REPORT',
  recordId: report.reportId,
  afterQty: 12,
  reason: '复核生产记录',
  changedAt: '2026-07-30 11:10:00',
  changedBy: '毛织主管',
})
assert.equal(getWoolOutputStockQty(reportOrder.woolOrderId, reportLine.outputSkuCode), 6)
const secondReportChange = changeWoolFactQty({
  commandId: 'CMD-CHANGE-REPORT-002',
  recordType: 'PROCESS_REPORT',
  recordId: report.reportId,
  afterQty: 14,
  reason: '再次复核生产记录',
  changedAt: '2026-07-30 11:20:00',
  changedBy: '毛织主管',
})
assert.equal(secondReportChange.beforeQty, 12)
assert.equal(listWoolWarehouseFlows({ sourceRecordId: secondReportChange.changeId })[0].qty, 2)
assert.throws(
  () => changeWoolFactQty({
    commandId: 'CMD-CHANGE-REPORT-002',
    recordType: 'PROCESS_REPORT',
    recordId: report.reportId,
    afterQty: 15,
    reason: '同一命令尝试写入其他数量',
    changedAt: '2026-07-30 11:21:00',
    changedBy: '另一个入口',
  }),
  /commandId 已被其他请求占用|幂等冲突/,
)

confirmWoolDownstreamReceipt(handover.handoverId, {
  commandId: 'CMD-DOWNSTREAM-CONFIRM-001',
  actualReceivedQty: 5,
  receivedAt: '2026-07-30 12:00:00',
  receivedBy: '下游仓管',
})
assert.equal(getWoolOutputStockQty(reportOrder.woolOrderId, reportLine.outputSkuCode), 8)
assert.throws(
  () => confirmWoolDownstreamReceipt(handover.handoverId, {
    commandId: 'CMD-DOWNSTREAM-CONFIRM-001',
    actualReceivedQty: 99,
    receivedAt: '2026-07-30 12:01:00',
    receivedBy: '另一个入口',
  }),
  /commandId 已被其他请求占用|幂等冲突/,
)
const anotherPendingHandover = readWoolStore().handovers.find((item) =>
  item.handoverId !== handover.handoverId && item.downstreamReceipt?.status !== 'CONFIRMED',
)!
assert.throws(
  () => confirmWoolDownstreamReceipt(anotherPendingHandover.handoverId, {
    commandId: 'CMD-DOWNSTREAM-CONFIRM-001',
    actualReceivedQty: 5,
    receivedAt: '2026-07-30 12:00:00',
    receivedBy: '下游仓管',
  }),
  /commandId 已被其他请求占用|幂等冲突/,
)
assert.throws(
  () => changeWoolFactQty({
    commandId: 'CMD-CHANGE-HANDOVER-LOCKED',
    recordType: 'HANDOVER',
    recordId: handover.handoverId,
    afterQty: 7,
    reason: '下游已确认后尝试修改',
    changedAt: '2026-07-30 12:10:00',
    changedBy: '毛织主管',
  }),
  /下游已确认，交出数量不可修改/,
)

const yarnLine = reportOrder.outputPlanLines.flatMap((item) => item.requiredYarnSkus)[0]
const issue = issueWoolYarn(reportOrder.woolOrderId, {
  commandId: 'CMD-YARN-ISSUE-CHECK-001',
  yarnSkuCode: yarnLine,
  batchNo: 'BATCH-CHECK-001',
  issuedQty: 2,
  issuedAt: '2026-07-30 12:20:00',
  issuedBy: '毛织仓管',
})
assert.throws(
  () => issueWoolYarn(reportOrder.woolOrderId, {
    commandId: 'CMD-YARN-ISSUE-CHECK-001',
    yarnSkuCode: yarnLine,
    batchNo: 'BATCH-CHECK-001',
    issuedQty: 4,
    issuedAt: '2026-07-30 12:21:00',
    issuedBy: '另一个入口',
  }),
  /commandId 已被其他请求占用|幂等冲突/,
)
const yarnReturn = returnWoolYarn(reportOrder.woolOrderId, {
  commandId: 'CMD-YARN-RETURN-CHECK-001',
  yarnSkuCode: yarnLine,
  batchNo: 'BATCH-CHECK-001',
  returnedQty: 1,
  returnedAt: '2026-07-30 12:30:00',
  returnedBy: '毛织仓管',
})
assert.throws(
  () => returnWoolYarn(reportOrder.woolOrderId, {
    commandId: 'CMD-YARN-RETURN-CHECK-001',
    yarnSkuCode: yarnLine,
    batchNo: 'BATCH-CHECK-001',
    returnedQty: 2,
    returnedAt: '2026-07-30 12:31:00',
    returnedBy: '另一个入口',
  }),
  /commandId 已被其他请求占用|幂等冲突/,
)
assert.equal(yarnReturn.returnedQty, 1)
assert.throws(
  () => returnWoolYarn(reportOrder.woolOrderId, {
    commandId: 'CMD-YARN-RETURN-CHECK-OVER',
    yarnSkuCode: yarnLine,
    batchNo: 'BATCH-CHECK-001',
    returnedQty: 2,
    returnedAt: '2026-07-30 12:40:00',
    returnedBy: '毛织仓管',
  }),
  /累计退回不能超过累计领用/,
)

const stockBeforeAdjustment = getWoolOutputStockQty(reportOrder.woolOrderId, reportLine.outputSkuCode)
const adjustment = adjustWoolWarehouseStock({
  commandId: 'CMD-STOCK-ADJUST-001',
  woolOrderId: reportOrder.woolOrderId,
  objectSkuCode: reportLine.outputSkuCode,
  defaultLocationId: 'WOOL-WH-GARMENT-DEFAULT',
  afterQty: stockBeforeAdjustment + 3,
  reason: '盘点复核',
  operatedAt: '2026-07-30 12:45:00',
  operatedBy: '毛织仓管',
})
assert.equal(adjustment.qty, 3)
assert.equal(getWoolOutputStockQty(reportOrder.woolOrderId, reportLine.outputSkuCode), stockBeforeAdjustment + 3)
assert.throws(
  () => adjustWoolWarehouseStock({
    commandId: 'CMD-STOCK-ADJUST-001',
    woolOrderId: reportOrder.woolOrderId,
    objectSkuCode: reportLine.outputSkuCode,
    defaultLocationId: 'WOOL-WH-GARMENT-DEFAULT',
    afterQty: stockBeforeAdjustment + 4,
    reason: '同一命令尝试写入其他盘点数',
    operatedAt: '2026-07-30 12:45:01',
    operatedBy: '另一个入口',
  }),
  /commandId 已被其他请求占用|幂等冲突/,
)
const publicWarehouse = listFactoryInternalWarehouses().find((warehouse) =>
  warehouse.isEnabled
  && warehouse.areaList.some((area) =>
    area.status === 'AVAILABLE'
    && area.shelfList.some((shelf) =>
      shelf.status === 'AVAILABLE'
      && shelf.locationList.some((location) => location.status === 'AVAILABLE'),
    ),
  ),
)!
const publicArea = publicWarehouse.areaList.find((area) =>
  area.status === 'AVAILABLE'
  && area.shelfList.some((shelf) =>
    shelf.status === 'AVAILABLE'
    && shelf.locationList.some((location) => location.status === 'AVAILABLE'),
  ),
)!
const publicShelf = publicArea.shelfList.find((shelf) =>
  shelf.status === 'AVAILABLE'
  && shelf.locationList.some((location) => location.status === 'AVAILABLE'),
)!
const publicEnabledLocation = publicShelf.locationList.find((location) =>
  location.status === 'AVAILABLE',
)!
const sameLocationIdWarehouse = listFactoryInternalWarehouses().find((warehouse) =>
  warehouse.warehouseId !== publicWarehouse.warehouseId
  && resolveEnabledFactoryWarehouseLocation(
    warehouse.warehouseId,
    publicEnabledLocation.locationId,
  ),
)!
const warehouseLocationSnapshot = createFactoryWarehouseLocationRegistrySnapshot()
try {
  transferWoolWarehouseStock({
    commandId: 'CMD-STOCK-TRANSFER-PUBLIC-ENABLED',
    woolOrderId: reportOrder.woolOrderId,
    objectSkuCode: reportLine.outputSkuCode,
    defaultLocationId: 'WOOL-WH-GARMENT-DEFAULT',
    toWarehouseId: publicWarehouse.warehouseId,
    toLocationId: publicEnabledLocation.locationId,
    qty: 1,
    reason: '转移至公共仓库启用位置',
    operatedAt: '2026-07-30 12:46:00',
    operatedBy: '毛织仓管',
  })
  assert.throws(
    () => transferWoolWarehouseStock({
      commandId: 'CMD-STOCK-TRANSFER-PUBLIC-ENABLED',
      woolOrderId: reportOrder.woolOrderId,
      objectSkuCode: reportLine.outputSkuCode,
      defaultLocationId: 'WOOL-WH-GARMENT-DEFAULT',
      toWarehouseId: publicWarehouse.warehouseId,
      toLocationId: publicEnabledLocation.locationId,
      qty: 2,
      reason: '同一命令尝试转移其他数量',
      operatedAt: '2026-07-30 12:46:01',
      operatedBy: '另一个入口',
    }),
    /commandId 已被其他请求占用|幂等冲突/,
  )
  assert.equal(
    toggleFactoryWarehouseNodeStatus('LOCATION', {
      warehouseId: publicWarehouse.warehouseId,
      areaId: publicArea.areaId,
      shelfId: publicShelf.shelfId,
      locationId: publicEnabledLocation.locationId,
    }),
    true,
  )
  assert.equal(
    resolveEnabledFactoryWarehouseLocation(
      publicWarehouse.warehouseId,
      publicEnabledLocation.locationId,
    ),
    undefined,
  )
  assert(
    resolveEnabledFactoryWarehouseLocation(
      sameLocationIdWarehouse.warehouseId,
      publicEnabledLocation.locationId,
    ),
  )
  assert.throws(
    () => transferWoolWarehouseStock({
      commandId: 'CMD-STOCK-TRANSFER-STOPPED',
      woolOrderId: reportOrder.woolOrderId,
      objectSkuCode: reportLine.outputSkuCode,
      defaultLocationId: 'WOOL-WH-GARMENT-DEFAULT',
      toWarehouseId: publicWarehouse.warehouseId,
      toLocationId: publicEnabledLocation.locationId,
      qty: 1,
      reason: '测试停用位置',
      operatedAt: '2026-07-30 12:47:00',
      operatedBy: '毛织仓管',
    }),
    /启用位置/,
  )
  const dynamicallyAddedLocation = createFactoryWarehouseLocation(
    publicWarehouse.warehouseId,
    publicArea.areaId,
    publicShelf.shelfId,
  )!
  transferWoolWarehouseStock({
    commandId: 'CMD-STOCK-TRANSFER-DYNAMIC-ENABLED',
    woolOrderId: reportOrder.woolOrderId,
    objectSkuCode: reportLine.outputSkuCode,
    defaultLocationId: 'WOOL-WH-GARMENT-DEFAULT',
    toWarehouseId: publicWarehouse.warehouseId,
    toLocationId: dynamicallyAddedLocation.locationId,
    qty: 1,
    reason: '转移至运行时新增的公共仓库启用位置',
    operatedAt: '2026-07-30 12:48:00',
    operatedBy: '毛织仓管',
  })
} finally {
  restoreFactoryWarehouseLocationRegistrySnapshot(warehouseLocationSnapshot)
}
assert.equal(getWoolOutputStockQty(reportOrder.woolOrderId, reportLine.outputSkuCode), stockBeforeAdjustment + 1)

const completionOrder = listWoolWorkOrders().find((item) => item.mockScenarioCode === 'READY_TO_COMPLETE')!
const completionStockBefore = completionOrder.outputPlanLines.reduce(
  (sum, item) => sum + getWoolOutputStockQty(completionOrder.woolOrderId, item.outputSkuCode),
  0,
)
assert.throws(
  () => completeWoolWorkOrder(completionOrder.woolOrderId, {
    commandId: 'CMD-RECEIPT-CHECK-001',
    completedAt: '2026-07-30 12:59:00',
    completedBy: '毛织主管',
    remark: '验证先存在其他命令收据时完成命令冲突',
  }),
  /commandId 已被其他请求占用|幂等冲突/,
)
const completionInput = {
  commandId: 'CMD-COMPLETE-CHECK-001',
  completedAt: '2026-07-30 13:00:00',
  completedBy: '毛织主管',
  remark: '业务核对后确认完成',
}
const beforeFailedCompletionCommit = readWoolStore()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem(key: string) {
      return storageValues.get(key) ?? null
    },
    setItem() {
      throw new Error('模拟完成命令持久化失败')
    },
  },
})
assert.throws(
  () => completeWoolWorkOrder(completionOrder.woolOrderId, completionInput),
  /模拟完成命令持久化失败/,
)
assert.deepEqual(readWoolStore(), beforeFailedCompletionCommit)
assert.equal(
  readWoolStore().operationLogs.some((log) =>
    log.operationLogId === 'WOOL-COMMAND-RECEIPT-CMD-COMPLETE-CHECK-001'
    || log.operationLogId === 'WOOP-COMPLETE-CMD-COMPLETE-CHECK-001',
  ),
  false,
)
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
const completion = completeWoolWorkOrder(completionOrder.woolOrderId, completionInput)
assert.equal(
  (completion as WoolCompletionRecord & { completionId?: string }).completionId,
  'WCOMP-CMD-COMPLETE-CHECK-001',
)
assert.equal(getWoolCompletion(completionOrder.woolOrderId)?.completedAt, completion.completedAt)
assert.equal(listWoolMachineAssociations(completionOrder.woolOrderId).length, 0)
assert.equal(
  completionOrder.outputPlanLines.reduce(
    (sum, item) => sum + getWoolOutputStockQty(completionOrder.woolOrderId, item.outputSkuCode),
    0,
  ),
  completionStockBefore,
)
assert.deepEqual(
  completeWoolWorkOrder(completionOrder.woolOrderId, {
    commandId: 'CMD-COMPLETE-CHECK-001',
    completedAt: '2026-07-30 13:00:00',
    completedBy: '毛织主管',
    remark: '业务核对后确认完成',
  }),
  completion,
)
assert.throws(
  () => completeWoolWorkOrder(completionOrder.woolOrderId, {
    commandId: 'CMD-COMPLETE-CHECK-001',
    completedAt: '2026-07-30 13:01:00',
    completedBy: '另一个入口',
    remark: '不同业务载荷不得复用首次完成结果',
  }),
  /commandId 已被其他请求占用|幂等冲突/,
)
assert.throws(
  () => addWoolYarnReceipt(reportOrder.woolOrderId, {
    commandId: 'CMD-COMPLETE-CHECK-001',
    receivedAt: '2026-07-30 13:02:00',
    receivedBy: '毛织仓管',
    lines: [{ yarnSkuCode: 'YARN-A', receivedQty: 1 }],
  }),
  /commandId 已被其他请求占用|幂等冲突/,
)
assert.equal(readWoolStore().operationLogs.filter((item) =>
  item.woolOrderId === completionOrder.woolOrderId && item.action === 'COMPLETE_WOOL_WORK_ORDER',
).length, 1)
const completionBusinessLog = readWoolStore().operationLogs.find((item) =>
  item.operationLogId === 'WOOP-COMPLETE-CMD-COMPLETE-CHECK-001'
)!
const completionCommandReceipt = readWoolStore().operationLogs.find((item) =>
  item.operationLogId === 'WOOL-COMMAND-RECEIPT-CMD-COMPLETE-CHECK-001'
)!
assert.equal(completionBusinessLog.action, 'COMPLETE_WOOL_WORK_ORDER')
assert.equal(completionCommandReceipt.action, 'COMMAND_RECEIPT')
assert.notEqual(completionBusinessLog.operationLogId, completionCommandReceipt.operationLogId)
assert.deepEqual(
  (completionCommandReceipt.afterValue as WoolCommandReceiptValue).canonicalPayload,
  {
    completedAt: '2026-07-30 13:00:00',
    completedBy: '毛织主管',
    remark: '业务核对后确认完成',
  },
)

const commandReceiptStore = readWoolStore()
const commandReceiptLogs = commandReceiptStore.operationLogs.filter((item) =>
  item.action === 'COMMAND_RECEIPT',
)
assert(commandReceiptLogs.length >= 10)
assert(commandReceiptLogs.every((item) =>
  item.objectType === 'WOOL_COMMAND'
  && item.operationLogId.startsWith('WOOL-COMMAND-RECEIPT-'),
))
assert.deepEqual(
  new Set(commandReceiptLogs.map((item) =>
    (item.afterValue as { commandType: string }).commandType,
  )),
  new Set([
    'ADD_WOOL_YARN_RECEIPT',
    'ADD_WOOL_PROCESS_REPORT',
    'ADD_WOOL_HANDOVER',
    'CONFIRM_WOOL_DOWNSTREAM_RECEIPT',
    'ISSUE_WOOL_YARN',
    'RETURN_WOOL_YARN',
    'ADJUST_WOOL_WAREHOUSE_STOCK',
    'TRANSFER_WOOL_WAREHOUSE_STOCK',
    'CHANGE_WOOL_FACT_QTY',
    'COMPLETE_WOOL_WORK_ORDER',
  ]),
)
function expectedCommandReceiptResultId(value: WoolCommandReceiptValue): string {
  const commandToken = encodeURIComponent(value.commandId)
  if (value.commandType === 'ADD_WOOL_YARN_RECEIPT') return `WR-${commandToken}`
  if (value.commandType === 'ADD_WOOL_PROCESS_REPORT') return `WPR-${commandToken}`
  if (value.commandType === 'ADD_WOOL_HANDOVER') return `WHO-${commandToken}`
  if (value.commandType === 'CONFIRM_WOOL_DOWNSTREAM_RECEIPT') return value.targetId
  if (value.commandType === 'ISSUE_WOOL_YARN') return `WI-${commandToken}`
  if (value.commandType === 'RETURN_WOOL_YARN') return `WRT-${commandToken}`
  if (value.commandType === 'ADJUST_WOOL_WAREHOUSE_STOCK') {
    return `WF-STOCK-ADJUSTMENT-${commandToken}`
  }
  if (value.commandType === 'TRANSFER_WOOL_WAREHOUSE_STOCK') {
    return `WF-STOCK-TRANSFER-${commandToken}`
  }
  if (value.commandType === 'COMPLETE_WOOL_WORK_ORDER') return `WCOMP-${commandToken}`
  return `WQC-${commandToken}`
}
for (const log of commandReceiptLogs) {
  const value = log.afterValue as WoolCommandReceiptValue
  assert.equal(typeof value.commandId, 'string')
  assert(value.commandId.length > 0)
  assert.equal(
    log.operationLogId,
    `WOOL-COMMAND-RECEIPT-${encodeURIComponent(value.commandId)}`,
  )
  assert.equal(value.resultId, expectedCommandReceiptResultId(value))
}
const fakeCommandIdReceiptStore = structuredClone(commandReceiptStore)
const fakeCommandIdReceipt = fakeCommandIdReceiptStore.operationLogs.find((item) =>
  item.action === 'COMMAND_RECEIPT',
)!
fakeCommandIdReceipt.afterValue = {
  ...(fakeCommandIdReceipt.afterValue as Record<string, unknown>),
  commandId: 'CMD-FAKE-REBOUND',
}
assert.throws(
  () => validateWoolStore(fakeCommandIdReceiptStore),
  /命令收据/,
)
const fakeOperationLogIdReceiptStore = structuredClone(commandReceiptStore)
const fakeOperationLogIdReceipt = fakeOperationLogIdReceiptStore.operationLogs.find((item) =>
  item.action === 'COMMAND_RECEIPT',
)!
fakeOperationLogIdReceipt.operationLogId = 'WOOL-COMMAND-RECEIPT-CMD-FAKE-REBOUND'
assert.throws(
  () => validateWoolStore(fakeOperationLogIdReceiptStore),
  /命令收据/,
)
const reboundCommandReceiptStore = structuredClone(commandReceiptStore)
const reboundReceiptA = reboundCommandReceiptStore.operationLogs.find((item) =>
  item.operationLogId === 'WOOL-COMMAND-RECEIPT-CMD-RECEIPT-STORAGE-RETRY',
)!
const reboundReceiptB = reboundCommandReceiptStore.operationLogs.find((item) =>
  item.operationLogId === 'WOOL-COMMAND-RECEIPT-CMD-RECEIPT-CHECK-001',
)!
reboundReceiptA.afterValue = {
  ...(reboundReceiptA.afterValue as Record<string, unknown>),
  resultId: (reboundReceiptB.afterValue as WoolCommandReceiptValue).resultId,
}
assert.throws(
  () => validateWoolStore(reboundCommandReceiptStore),
  /命令收据/,
)
const reboundCompletionReceiptStore = structuredClone(commandReceiptStore)
const reboundCompletionReceipt = reboundCompletionReceiptStore.operationLogs.find((item) =>
  item.operationLogId === 'WOOL-COMMAND-RECEIPT-CMD-COMPLETE-CHECK-001',
)!
const anotherCompletion = reboundCompletionReceiptStore.completions.find((item) =>
  item.woolOrderId !== completionOrder.woolOrderId
)!
reboundCompletionReceipt.afterValue = {
  ...(reboundCompletionReceipt.afterValue as Record<string, unknown>),
  resultId: (anotherCompletion as WoolCompletionRecord & { completionId?: string }).completionId,
}
assert.throws(
  () => validateWoolStore(reboundCompletionReceiptStore),
  /命令收据/,
)
const forgedCompletionReceiptStore = structuredClone(commandReceiptStore)
const forgedCompletionReceipt = forgedCompletionReceiptStore.operationLogs.find((item) =>
  item.operationLogId === 'WOOL-COMMAND-RECEIPT-CMD-COMPLETE-CHECK-001',
)!
forgedCompletionReceipt.afterValue = {
  ...(forgedCompletionReceipt.afterValue as Record<string, unknown>),
  resultId: 'WCOMP-CMD-FORGED',
}
assert.throws(
  () => validateWoolStore(forgedCompletionReceiptStore),
  /命令收据/,
)
const malformedCommandReceiptStore = structuredClone(commandReceiptStore)
malformedCommandReceiptStore.operationLogs.find((item) =>
  item.action === 'COMMAND_RECEIPT',
)!.afterValue = { version: 1 }
assert.throws(
  () => validateWoolStore(malformedCommandReceiptStore),
  /命令收据/,
)
const disguisedCommandReceiptStore = structuredClone(commandReceiptStore)
const disguisedCommandReceipt = disguisedCommandReceiptStore.operationLogs.find((item) =>
  item.action === 'COMMAND_RECEIPT',
)!
disguisedCommandReceipt.action = 'STORE_CHECK'
assert.throws(
  () => validateWoolStore(disguisedCommandReceiptStore),
  /命令收据/,
)
const orphanCommandReceiptStore = structuredClone(commandReceiptStore)
const orphanCommandReceipt = orphanCommandReceiptStore.operationLogs.find((item) =>
  item.action === 'COMMAND_RECEIPT',
)!
orphanCommandReceipt.afterValue = {
  ...(orphanCommandReceipt.afterValue as Record<string, unknown>),
  resultId: 'WOOL-COMMAND-RESULT-NOT-FOUND',
}
assert.throws(
  () => validateWoolStore(orphanCommandReceiptStore),
  /命令收据/,
)

resetWoolFactWorkflowMock('CHECK_WOOL_COMPLETION_MACHINE_RELEASE')
const associatedOrder = listWoolWorkOrders()
  .find((item) => item.mockScenarioCode === 'MACHINE_ASSOCIATION_A')!
const associatedLine = associatedOrder.outputPlanLines[0]
const associatedMachineIds = listWoolMachineAssociations(associatedOrder.woolOrderId)
  .map((item) => item.machineId)
assert(associatedMachineIds.length > 0)
addWoolYarnReceipt(associatedOrder.woolOrderId, {
  commandId: 'CMD-ASSOCIATED-RECEIPT',
  batchNo: 'BATCH-ASSOCIATED',
  receivedAt: '2026-07-30 14:00:00',
  receivedBy: '毛织仓管',
  lines: [
    { yarnSkuCode: 'YARN-A', receivedQty: 2 },
    { yarnSkuCode: 'YARN-B', receivedQty: 2 },
  ],
})
addWoolProcessReport(associatedOrder.woolOrderId, {
  commandId: 'CMD-ASSOCIATED-REPORT',
  outputSkuCode: associatedLine.outputSkuCode,
  reportedQty: 10,
  reportedAt: '2026-07-30 14:10:00',
  reportedBy: '毛织主管',
})
addWoolHandover(associatedOrder.woolOrderId, {
  commandId: 'CMD-ASSOCIATED-HANDOVER',
  outputSkuCode: associatedLine.outputSkuCode,
  handoverQty: 4,
  handedOverAt: '2026-07-30 14:20:00',
  handedOverBy: '毛织主管',
})
const associatedCompletionInput = {
  commandId: 'CMD-ASSOCIATED-COMPLETE',
  completedAt: '2026-07-30 14:30:00',
  completedBy: '毛织主管',
}
const beforeFailedAssociatedCompletion = readWoolStore()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem(key: string) {
      return storageValues.get(key) ?? null
    },
    setItem() {
      throw new Error('模拟设备释放完成命令持久化失败')
    },
  },
})
assert.throws(
  () => completeWoolWorkOrder(associatedOrder.woolOrderId, associatedCompletionInput),
  /模拟设备释放完成命令持久化失败/,
)
assert.deepEqual(readWoolStore(), beforeFailedAssociatedCompletion)
assert.equal(listWoolMachineAssociations(associatedOrder.woolOrderId).length, associatedMachineIds.length)
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
const associatedCompletion = completeWoolWorkOrder(
  associatedOrder.woolOrderId,
  associatedCompletionInput,
)
assert.deepEqual(
  new Set(associatedCompletion.confirmationSnapshot.releasedMachineIds),
  new Set(associatedMachineIds),
)
assert.equal(listWoolMachineAssociations(associatedOrder.woolOrderId).length, 0)
const associatedCompletionStore = readWoolStore()
assert(associatedMachineIds.every((machineId) =>
  associatedCompletionStore.machines.find((item) => item.machineId === machineId)?.status === 'IDLE',
))
assert(associatedMachineIds.every((machineId) =>
  associatedCompletionStore.machineAssociationLogs.some((item) =>
    item.machineId === machineId
    && item.fromWoolOrderId === associatedOrder.woolOrderId
    && item.reason === 'ORDER_COMPLETED',
  ),
))
assert(associatedCompletionStore.operationLogs.some((item) =>
  item.woolOrderId === associatedOrder.woolOrderId
  && item.action === 'RELEASE_WOOL_MACHINES_FOR_COMPLETION',
))
assert(associatedCompletionStore.operationLogs.some((item) =>
  item.operationLogId === 'WOOP-COMPLETE-CMD-ASSOCIATED-COMPLETE'
  && item.action === 'COMPLETE_WOOL_WORK_ORDER',
))
assert(associatedCompletionStore.operationLogs.some((item) =>
  item.operationLogId === 'WOOL-COMMAND-RECEIPT-CMD-ASSOCIATED-COMPLETE'
  && item.action === 'COMMAND_RECEIPT',
))

resetWoolFactWorkflowMock('CHECK_WOOL_SINGLE_MACHINE_AVAILABILITY')
const singleReleaseOrder = listWoolWorkOrders()
  .find((item) => item.mockScenarioCode === 'MACHINE_ASSOCIATION_A')!
const singleReleaseActor = {
  operatedAt: '2026-07-30 19:30:00',
  operatedBy: '设备主管',
}
replaceWoolMachineAssociations(singleReleaseOrder.woolOrderId, ['WM-001', 'WM-002'], singleReleaseActor)
const beforeSingleMachineFailure = readWoolStore()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem(key: string) {
      return storageValues.get(key) ?? null
    },
    setItem() {
      throw new Error('模拟单设备可用性变更持久化失败')
    },
  },
})
assert.throws(
  () => changeWoolMachineAvailability('WM-001', {
    nextStatus: 'REPAIR',
    reason: '针板故障',
    operatedAt: '2026-07-30 19:40:00',
    operatedBy: '设备主管',
    confirmedImpact: true,
  }),
  /模拟单设备可用性变更持久化失败/,
)
assert.deepEqual(
  readWoolStore(),
  beforeSingleMachineFailure,
  '单设备可用性提交失败时，同单两台设备、关联和日志必须全部回滚',
)
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
assert.throws(
  () => changeWoolMachineAvailability('WM-001', {
    nextStatus: 'REPAIR',
    reason: '针板故障',
    operatedAt: '2026-07-30 19:40:00',
    operatedBy: '设备主管',
    confirmedImpact: false,
  }),
  /确认影响/,
)
assert.deepEqual(readWoolStore(), beforeSingleMachineFailure)
const untouchedMachineAssociation = structuredClone(
  listWoolMachineAssociations(singleReleaseOrder.woolOrderId)
    .find((item) => item.machineId === 'WM-002')!,
)
const untouchedMachineArchive = structuredClone(
  readWoolStore().machines.find((item) => item.machineId === 'WM-002')!,
)
const untouchedMachineAssociationLogs = structuredClone(
  readWoolStore().machineAssociationLogs.filter((item) => item.machineId === 'WM-002'),
)
const untouchedMachineOperationLogs = structuredClone(
  readWoolStore().operationLogs.filter((item) =>
    item.objectType === 'WOOL_MACHINE' && item.objectId === 'WM-002',
  ),
)
changeWoolMachineAvailability('WM-001', {
  nextStatus: 'REPAIR',
  reason: '针板故障',
  operatedAt: '2026-07-30 19:40:00',
  operatedBy: '设备主管',
  confirmedImpact: true,
})
assert.deepEqual(
  listWoolMachineAssociations(singleReleaseOrder.woolOrderId),
  [untouchedMachineAssociation],
  '单设备维修只能解除目标设备，不能批量解除同单其他横机',
)
assert.equal(getWoolMachineById('WM-001')?.status, 'REPAIR')
assert.equal(getWoolMachineById('WM-002')?.status, 'PRODUCING')
assert.deepEqual(
  readWoolStore().machines.find((item) => item.machineId === 'WM-002'),
  untouchedMachineArchive,
  '同单其他横机档案及 updatedAt 必须保持不变',
)
assert.deepEqual(
  readWoolStore().machineAssociationLogs.filter((item) => item.machineId === 'WM-002'),
  untouchedMachineAssociationLogs,
)
assert.deepEqual(
  readWoolStore().operationLogs.filter((item) =>
    item.objectType === 'WOOL_MACHINE' && item.objectId === 'WM-002',
  ),
  untouchedMachineOperationLogs,
)

resetWoolFactWorkflowMock('CHECK_WOOL_MACHINE_ASSOCIATIONS')
const machineOrderA = listWoolWorkOrders()
  .find((item) => item.mockScenarioCode === 'MACHINE_ASSOCIATION_A')!
const machineOrderB = listWoolWorkOrders()
  .find((item) => item.mockScenarioCode === 'MACHINE_ASSOCIATION_B')!
const machineActor = {
  operatedAt: '2026-07-30 20:00:00',
  operatedBy: '设备主管',
}

function assertMachineAssociationResult(
  result: unknown,
  woolOrderId: string,
  expectedMachineIds: string[],
  pathLabel: string,
): void {
  assert(Array.isArray(result), `${pathLabel}必须返回当前关联数组`)
  const associations = result as WoolMachineAssociation[]
  assert(
    associations.every((item) => item.woolOrderId === woolOrderId),
    `${pathLabel}只能返回目标加工单的当前关联`,
  )
  assert.deepEqual(
    associations.map((item) => item.machineId),
    expectedMachineIds,
    `${pathLabel}必须按设备 ID 稳定排序返回目标设备集合`,
  )
  const storeBeforeReturnMutation = readWoolStore()
  associations[0]!.associatedBy = `${pathLabel}返回值篡改`
  associations.reverse()
  assert.deepEqual(
    readWoolStore(),
    storeBeforeReturnMutation,
    `${pathLabel}返回对象和数组都不得暴露内部 store 引用`,
  )
}

const addedAssociationResult = replaceWoolMachineAssociations(
  machineOrderA.woolOrderId,
  ['WM-001', 'WM-002'],
  machineActor,
)
assertMachineAssociationResult(
  addedAssociationResult,
  machineOrderA.woolOrderId,
  ['WM-001', 'WM-002'],
  '新增路径',
)
assert.equal(getWoolMachineById('WM-001')?.status, 'PRODUCING')
assert.equal(getWoolMachineById('WM-002')?.status, 'PRODUCING')
const unchangedAssociationStore = readWoolStore()
const unchangedAssociationResult = listWoolMachineAssociations(machineOrderA.woolOrderId)
let unchangedAssociationStorageWrites = 0
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem(key: string) {
      return storageValues.get(key) ?? null
    },
    setItem() {
      unchangedAssociationStorageWrites += 1
      throw new Error('无变化整组保存不得进入持久化')
    },
  },
})
const noChangeAssociationResult = replaceWoolMachineAssociations(
  machineOrderA.woolOrderId,
  ['WM-002', 'WM-001', 'WM-001'],
  {
    operatedAt: '2026-07-30 20:05:00',
    operatedBy: '另一位设备主管',
  },
)
assert.deepEqual(noChangeAssociationResult, unchangedAssociationResult)
assertMachineAssociationResult(
  noChangeAssociationResult,
  machineOrderA.woolOrderId,
  ['WM-001', 'WM-002'],
  '无变化路径',
)
assert.equal(unchangedAssociationStorageWrites, 0, '无变化整组保存不得调用 setItem')
assert.deepEqual(
  readWoolStore(),
  unchangedAssociationStore,
  'actor 不同但最终集合相同时，不得更新时间、日志或任何存储事实',
)
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

const removedAssociationResult = replaceWoolMachineAssociations(machineOrderA.woolOrderId, ['WM-002'], {
  ...machineActor,
  operatedAt: '2026-07-30 20:10:00',
})
assertMachineAssociationResult(
  removedAssociationResult,
  machineOrderA.woolOrderId,
  ['WM-002'],
  '移除路径',
)
assert.equal(getWoolMachineById('WM-001')?.status, 'IDLE')
const transferredAssociationResult = replaceWoolMachineAssociations(machineOrderB.woolOrderId, ['WM-002'], {
  ...machineActor,
  operatedAt: '2026-07-30 20:20:00',
})
assertMachineAssociationResult(
  transferredAssociationResult,
  machineOrderB.woolOrderId,
  ['WM-002'],
  '跨单转移路径',
)
assert.equal(listWoolMachineAssociations(machineOrderA.woolOrderId).length, 0)
assert.deepEqual(
  listWoolMachineAssociations(machineOrderB.woolOrderId).map((item) => item.machineId),
  ['WM-002'],
)
assert(readWoolStore().machineAssociationLogs.some((item) =>
  item.machineId === 'WM-002'
  && item.action === 'TRANSFER'
  && item.fromWoolOrderId === machineOrderA.woolOrderId
  && item.toWoolOrderId === machineOrderB.woolOrderId,
))

assert.throws(
  () => replaceWoolMachineAssociations(machineOrderB.woolOrderId, ['WM-006'], machineActor),
  /维修或停用设备不可关联/,
)
const noAssociationOrder = listWoolWorkOrders()
  .find((item) => item.mockScenarioCode === 'NO_YARN_RECEIPT')!
assert.throws(
  () => replaceWoolMachineAssociations(noAssociationOrder.woolOrderId, ['WM-001'], machineActor),
  /暂不可关联横机/,
)
const completedMachineOrder = listWoolWorkOrders()
  .find((item) => item.mockScenarioCode === 'COMPLETED_RELEASED_MACHINES')!
const completedAssociationStore = structuredClone(readWoolStore())
completedAssociationStore.machineAssociations.push({
  machineId: 'WM-003',
  woolOrderId: completedMachineOrder.woolOrderId,
  associatedAt: machineActor.operatedAt,
  associatedBy: machineActor.operatedBy,
})
assert.throws(
  () => validateWoolStore(completedAssociationStore),
  /已完成加工单不可存在当前横机关联/,
)
for (const [field, value, message] of [
  ['associatedAt', '', /当前横机关联的关联时间不能为空/],
  ['associatedBy', '   ', /当前横机关联的关联人不能为空/],
  ['machineId', '', /当前横机关联的设备 ID 不能为空/],
  ['woolOrderId', '   ', /当前横机关联的加工单 ID 不能为空/],
] as const) {
  const invalidAssociationStore = structuredClone(readWoolStore())
  assert(invalidAssociationStore.machineAssociations.length > 0)
  invalidAssociationStore.machineAssociations[0][field] = value
  assert.throws(
    () => validateWoolStore(invalidAssociationStore),
    message,
  )
}
assert.throws(
  () => replaceWoolMachineAssociations(completedMachineOrder.woolOrderId, [], machineActor),
  /已完成/,
)

const beforeFailedMachineAvailability = readWoolStore()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem(key: string) {
      return storageValues.get(key) ?? null
    },
    setItem() {
      throw new Error('模拟设备可用性变更持久化失败')
    },
  },
})
assert.throws(
  () => changeWoolMachineAvailability('WM-002', {
    nextStatus: 'DISABLED',
    reason: '设备停用复核',
    operatedAt: '2026-07-30 20:25:00',
    operatedBy: '设备主管',
    confirmedImpact: true,
  }),
  /模拟设备可用性变更持久化失败/,
)
assert.deepEqual(
  readWoolStore(),
  beforeFailedMachineAvailability,
  '设备状态、当前关联、关联日志和设备操作日志必须同一次提交回滚',
)
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

assert.throws(
  () => changeWoolMachineAvailability('WM-002', {
    nextStatus: 'REPAIR',
    reason: '机针故障',
    operatedAt: '2026-07-30 20:30:00',
    operatedBy: '设备主管',
    confirmedImpact: false,
  }),
  /确认影响/,
)
assert.equal(listWoolMachineAssociations(machineOrderB.woolOrderId).length, 1)
changeWoolMachineAvailability('WM-002', {
  nextStatus: 'REPAIR',
  reason: '机针故障',
  operatedAt: '2026-07-30 20:30:00',
  operatedBy: '设备主管',
  confirmedImpact: true,
})
assert.equal(listWoolMachineAssociations(machineOrderB.woolOrderId).length, 0)
assert.equal(getWoolMachineById('WM-002')?.status, 'REPAIR')
assert(readWoolStore().machineAssociationLogs.some((item) =>
  item.machineId === 'WM-002'
  && item.fromWoolOrderId === machineOrderB.woolOrderId
  && item.action === 'UNASSOCIATE'
  && item.reason === 'MACHINE_REPAIR',
))
const repairAvailabilityLog = readWoolStore().operationLogs.find((item) =>
  item.woolOrderId === machineOrderB.woolOrderId
  && item.objectType === 'WOOL_MACHINE'
  && item.objectId === 'WM-002'
  && item.action === 'CHANGE_WOOL_MACHINE_AVAILABILITY'
)
assert(repairAvailabilityLog)
assert.deepEqual(repairAvailabilityLog.beforeValue, {
  status: 'PRODUCING',
  woolOrderId: machineOrderB.woolOrderId,
})
assert.deepEqual(repairAvailabilityLog.afterValue, { status: 'REPAIR' })

changeWoolMachineAvailability('WM-002', {
  nextStatus: 'IDLE',
  reason: '维修完成',
  operatedAt: '2026-07-30 21:00:00',
  operatedBy: '设备主管',
})
assert.equal(getWoolMachineById('WM-002')?.status, 'IDLE')
const restoredAvailabilityLog = readWoolStore().operationLogs.find((item) =>
  item.objectType === 'WOOL_MACHINE'
  && item.objectId === 'WM-002'
  && item.action === 'CHANGE_WOOL_MACHINE_AVAILABILITY'
  && item.remark === '维修完成'
)
assert(restoredAvailabilityLog)
assert.deepEqual(restoredAvailabilityLog.beforeValue, { status: 'REPAIR' })
assert.deepEqual(restoredAvailabilityLog.afterValue, { status: 'IDLE' })
assert.equal(
  readWoolStore().machineAssociations.some((item) => item.machineId === 'WM-002'),
  false,
  '维修恢复为空闲不得自动恢复旧关联',
)
assert.throws(
  () => changeWoolMachineAvailability('WM-002', {
    nextStatus: 'PRODUCING' as 'IDLE',
    reason: '非法手工生产中',
    operatedAt: '2026-07-30 21:10:00',
    operatedBy: '设备主管',
  }),
  /只允许改为空闲、维修或停用/,
)
assert(readWoolStore().machines.every((machine) =>
  machine.status === 'IDLE' || machine.status === 'REPAIR' || machine.status === 'DISABLED',
), '设备档案不得持久化生产中')

resetWoolFactWorkflowMock('CHECK_WOOL_MACHINE_DISABLED')
const disabledMachineOrder = listWoolWorkOrders()
  .find((item) => item.mockScenarioCode === 'MACHINE_ASSOCIATION_A')!
changeWoolMachineAvailability('WM-001', {
  nextStatus: 'DISABLED',
  reason: '设备淘汰停用',
  operatedAt: '2026-07-30 22:00:00',
  operatedBy: '设备主管',
  confirmedImpact: true,
})
assert.equal(getWoolMachineById('WM-001')?.status, 'DISABLED')
assert.equal(listWoolMachineAssociations(disabledMachineOrder.woolOrderId).length, 0)
assert(readWoolStore().machineAssociationLogs.some((item) =>
  item.machineId === 'WM-001'
  && item.fromWoolOrderId === disabledMachineOrder.woolOrderId
  && item.reason === 'MACHINE_DISABLED',
))

resetWoolFactWorkflowMock('CHECK_WOOL_MACHINE_AVAILABILITY_MATRIX')
const availabilityActor = {
  reason: '设备档案状态矩阵检查',
  operatedAt: '2026-07-30 22:30:00',
  operatedBy: '设备主管',
}
assert.throws(
  () => changeWoolMachineAvailability('WM-003', {
    ...availabilityActor,
    nextStatus: 'IDLE',
  }),
  /状态未变化/,
)
changeWoolMachineAvailability('WM-003', {
  ...availabilityActor,
  nextStatus: 'REPAIR',
})
assert.equal(getWoolMachineById('WM-003')?.status, 'REPAIR')
assert.throws(
  () => changeWoolMachineAvailability('WM-003', {
    ...availabilityActor,
    nextStatus: 'REPAIR',
  }),
  /状态未变化/,
)
assert.throws(
  () => changeWoolMachineAvailability('WM-003', {
    ...availabilityActor,
    nextStatus: 'DISABLED',
  }),
  /维修或停用设备只能恢复为空闲/,
)
changeWoolMachineAvailability('WM-003', {
  ...availabilityActor,
  nextStatus: 'IDLE',
})
changeWoolMachineAvailability('WM-003', {
  ...availabilityActor,
  nextStatus: 'DISABLED',
})
assert.equal(getWoolMachineById('WM-003')?.status, 'DISABLED')
assert.throws(
  () => changeWoolMachineAvailability('WM-003', {
    ...availabilityActor,
    nextStatus: 'DISABLED',
  }),
  /状态未变化/,
)
assert.throws(
  () => changeWoolMachineAvailability('WM-003', {
    ...availabilityActor,
    nextStatus: 'REPAIR',
  }),
  /维修或停用设备只能恢复为空闲/,
)
changeWoolMachineAvailability('WM-003', {
  ...availabilityActor,
  nextStatus: 'IDLE',
})
assert.equal(getWoolMachineById('WM-003')?.status, 'IDLE')
assert.throws(
  () => changeWoolMachineAvailability('WM-003', {
    ...availabilityActor,
    reason: '   ',
    nextStatus: 'REPAIR',
  }),
  /变更原因不能为空/,
)

const woolMachineSources = [
  readFileSync(new URL('../src/data/fcs/wool-task-domain.ts', import.meta.url), 'utf8'),
  readFileSync(new URL('../src/data/fcs/wool-domain/types.ts', import.meta.url), 'utf8'),
  readFileSync(new URL('../src/data/fcs/wool-domain/machine-associations.ts', import.meta.url), 'utf8'),
].join('\n')
assert(!woolMachineSources.includes('SCHEDULED'))
assert(!woolMachineSources.includes('已排产'))

const woolRuntimeGenerationSources = [
  '../src/data/pcs-technical-data-version-bootstrap.ts',
  '../src/data/fcs/production-tech-pack-snapshot-builder.ts',
  '../src/data/fcs/production-artifact-generation.ts',
  '../src/data/fcs/process-tasks.ts',
  '../src/data/fcs/runtime-process-tasks.ts',
  '../src/data/fcs/page-adapters/task-execution-adapter.ts',
  '../src/data/fcs/process-craft-dict.ts',
  '../src/data/fcs/milestone-configs.ts',
  '../src/data/fcs/wool-domain/tech-pack-source.ts',
].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n')
for (const removedWoolNodeText of [
  '毛织菲票',
  '横机首批',
  '横机完成首批部位片',
  '横机完成首批整件',
  '缝盘',
  '毛织厂包装',
  '整件毛织完成后交后道工厂，熨烫为必有节点，包装按单据要求决定',
  '部位毛织按毛织部位打印菲票',
]) {
  assert.equal(
    woolRuntimeGenerationSources.includes(removedWoolNodeText),
    false,
    `毛织上游、生成与运行时来源不得恢复已删除节点：${removedWoolNodeText}`,
  )
}

resetWoolFactWorkflowMock('CHECK_WOOL_RUNTIME_GENERATION')
const realWoolRuntimeTasks = listRuntimeExecutionTasks().filter(
  (item) => item.processBusinessCode === 'WOOL' || item.processCode === 'WOOL',
)
const woolRuntimeTask = realWoolRuntimeTasks.find((item) => {
  if (item.woolTaskType !== 'WHOLE_GARMENT') return false
  try {
    return buildWoolOrderSourceSnapshotFromRuntimeTask(item.taskId).generationIssues.length === 0
  } catch {
    return false
  }
})
assert(woolRuntimeTask, '缺少可用于运行时生成检查的毛织任务')
assert.equal(woolRuntimeTask.acceptanceStatus, 'ACCEPTED', '毛织运行时任务必须保留上游接单协作')

const runtimeGeneratedWoolOrder = buildWoolOrderFromRuntimeTask(woolRuntimeTask.taskId)
assert.equal(getWoolProcessingStatus(runtimeGeneratedWoolOrder.woolOrderId), 'UNPROCESSED')
assert.equal(getWoolWorkOrderTab(runtimeGeneratedWoolOrder.woolOrderId), 'NOT_READY')
assert.equal(runtimeGeneratedWoolOrder.outputPlanLines.length > 0, true)
const runtimeGenerationStore = readWoolStore()
assert.equal(
  runtimeGenerationStore.yarnReceipts.filter((item) => item.woolOrderId === runtimeGeneratedWoolOrder.woolOrderId).length,
  0,
)
assert.equal(
  runtimeGenerationStore.processReports.filter((item) => item.woolOrderId === runtimeGeneratedWoolOrder.woolOrderId).length,
  0,
)
assert.equal(
  runtimeGenerationStore.handovers.filter((item) => item.woolOrderId === runtimeGeneratedWoolOrder.woolOrderId).length,
  0,
)
assert.equal(
  runtimeGenerationStore.completions.filter((item) => item.woolOrderId === runtimeGeneratedWoolOrder.woolOrderId).length,
  0,
)
for (const forbiddenField of [
  'acceptanceStatus',
  'startedAt',
  'priceInfo',
  'standardPrice',
  'dispatchPrice',
  'nodes',
  'milestones',
]) {
  assert.equal(forbiddenField in runtimeGeneratedWoolOrder, false)
}
const idempotentRuntimeGeneratedWoolOrder = buildWoolOrderFromRuntimeTask(woolRuntimeTask.taskId)
assert.deepEqual(idempotentRuntimeGeneratedWoolOrder, runtimeGeneratedWoolOrder)
assert.equal(
  Object.values(readWoolStore().workOrders)
    .filter((item) => item.taskId === woolRuntimeTask.taskId)
    .length,
  1,
)

const completePartRuntimeTask = realWoolRuntimeTasks.find((task) => {
  if (task.woolTaskType !== 'PART_PANEL') return false
  try {
    return buildWoolOrderSourceSnapshotFromRuntimeTask(task.taskId).generationIssues.length === 0
  } catch {
    return false
  }
})
assert(completePartRuntimeTask, '缺少真实完整的部位毛织运行时任务用于来源缺失检查')
const completePartSourceOrder = productionOrders.find(
  (order) => order.productionOrderId === completePartRuntimeTask.productionOrderId,
)
assert(completePartSourceOrder?.techPackSnapshot, '部位毛织运行时任务缺少冻结技术包夹具')
const completePartSnapshot = structuredClone(completePartSourceOrder.techPackSnapshot)
const assertRuntimeSourceFailureDoesNotStore = (
  mutate: (snapshot: NonNullable<typeof completePartSourceOrder.techPackSnapshot>) => void,
  expected: RegExp,
) => {
  const storeBefore = readWoolStore()
  completePartSourceOrder.techPackSnapshot = structuredClone(completePartSnapshot)
  mutate(completePartSourceOrder.techPackSnapshot)
  assert.throws(() => buildWoolOrderFromRuntimeTask(completePartRuntimeTask.taskId), expected)
  assert.deepEqual(readWoolStore(), storeBefore, '来源不完整时毛织存储必须保持不变')
}
try {
  assertRuntimeSourceFailureDoesNotStore(
    (snapshot) => {
      snapshot.patternFiles = []
    },
    /没有纸样部位/,
  )
  assertRuntimeSourceFailureDoesNotStore(
    (snapshot) => {
      snapshot.colorMaterialMappings = []
    },
    /缺少技术包颜色物料关系/,
  )
  assertRuntimeSourceFailureDoesNotStore(
    (snapshot) => {
      snapshot.bomItems = []
    },
    /PROC_WOOL 纱线 BOM/,
  )
  assertRuntimeSourceFailureDoesNotStore(
    (snapshot) => {
      snapshot.bomItems = snapshot.bomItems.map((item) => ({
        ...item,
        applicableSkuCodes: ['SKU-NOT-IN-RUNTIME-TASK'],
      }))
    },
    /PROC_WOOL 纱线 BOM/,
  )
} finally {
  completePartSourceOrder.techPackSnapshot = completePartSnapshot
}

const successfullyGeneratedRealWoolOrders = realWoolRuntimeTasks.flatMap((task) => {
  try {
    return [buildWoolOrderFromRuntimeTask(task.taskId)]
  } catch {
    return []
  }
})
assert(
  successfullyGeneratedRealWoolOrders.some((order) => order.kind === 'WHOLE_GARMENT'),
  '至少一张真实完整的整件毛织运行时任务必须成功生成加工单',
)
for (const order of successfullyGeneratedRealWoolOrders) {
  const sourceSnapshot = buildWoolOrderSourceSnapshotFromRuntimeTask(order.taskId)
  const frozenTechPack = productionOrders.find(
    (item) => item.productionOrderId === order.productionOrderId,
  )?.techPackSnapshot
  assert(frozenTechPack, `${order.productionOrderNo} 缺少冻结技术包`)
  const mappingsById = new Map(frozenTechPack.colorMaterialMappings.map((mapping) => [mapping.id, mapping]))
  assert.equal(sourceSnapshot.generationIssues.length, 0)
  for (const line of order.outputPlanLines) {
    assert(line.requiredYarnSkus.length > 0, `${line.outputSkuCode} 必须冻结必需纱线`)
    assert(line.sourceBomItemIds.length > 0, `${line.outputSkuCode} 必须冻结来源 BOM`)
    assert.equal(
      line.requiredYarnSkus.length,
      line.sourceBomItemIds.length,
      `${line.outputSkuCode} 的纱线与来源 BOM 必须一一对应`,
    )
    assert(line.sourceColorMappingIds.length > 0, `${line.outputSkuCode} 必须冻结技术包颜色物料关系`)
    assert(
      line.sourceColorMappingIds.every((mappingId) => {
        const mapping = mappingsById.get(mappingId)
        return mapping?.mappingOrigin === 'TECH_PACK' && mapping.status !== 'AUTO_DRAFT'
      }),
      `${line.outputSkuCode} 只能引用已确认的 TECH_PACK 颜色物料关系`,
    )
  }
}

const runtimeGenerationStoreBeforeIncompleteTasks = readWoolStore()
for (const incompleteTask of realWoolRuntimeTasks.filter((task) =>
  !successfullyGeneratedRealWoolOrders.some((order) => order.taskId === task.taskId),
)) {
  assert.throws(
    () => buildWoolOrderFromRuntimeTask(incompleteTask.taskId),
    /毛织加工单生成失败|毛织来源生成失败/,
    `不完整运行时任务 ${incompleteTask.taskId} 必须明确失败`,
  )
}
assert.deepEqual(
  readWoolStore(),
  runtimeGenerationStoreBeforeIncompleteTasks,
  '来源缺少部位、技术包映射或毛织 BOM 时不得写入空纱线加工单',
)

const initialWoolExecutionFact = getExecutionTaskFactById(runtimeGeneratedWoolOrder.taskId)
assert(initialWoolExecutionFact)
assert.deepEqual(initialWoolExecutionFact.woolAllowedActions, ['DETAIL', 'RECEIVE_YARN'])
assert(!initialWoolExecutionFact.woolAllowedActions.includes('REPORT_PROCESS'))
assert(!initialWoolExecutionFact.woolAllowedActions.includes('HANDOVER'))
assert(!initialWoolExecutionFact.woolAllowedActions.includes('COMPLETE'))
initialWoolExecutionFact.woolAllowedActions.push('COMPLETE')
assert.deepEqual(
  getExecutionTaskFactById(runtimeGeneratedWoolOrder.taskId)?.woolAllowedActions,
  ['DETAIL', 'RECEIVE_YARN'],
  '适配器必须克隆毛织领域动作，调用方不能污染领域投影',
)
const nonWoolExecutionFact = listExecutionTaskFacts().find((task) =>
  task.processBusinessCode !== 'WOOL' && task.processCode !== 'WOOL',
)
assert(nonWoolExecutionFact, '缺少非毛织运行时任务检查夹具')
assert.equal(nonWoolExecutionFact.woolAllowedActions, undefined)

const requiredRuntimeYarns = [...new Set(
  runtimeGeneratedWoolOrder.outputPlanLines.flatMap((line) => line.requiredYarnSkus),
)]
addWoolYarnReceipt(runtimeGeneratedWoolOrder.woolOrderId, {
  commandId: 'CMD-RUNTIME-ACTIONS-RECEIPT',
  receivedAt: '2026-07-31 09:00:00',
  receivedBy: '毛织仓管',
  lines: requiredRuntimeYarns.map((yarnSkuCode) => ({
    yarnSkuCode,
    receivedQty: 10,
  })),
})
assert(getExecutionTaskFactById(runtimeGeneratedWoolOrder.taskId)?.woolAllowedActions?.includes('REPORT_PROCESS'))

const runtimeActionOutputLine = runtimeGeneratedWoolOrder.outputPlanLines[0]
addWoolProcessReport(runtimeGeneratedWoolOrder.woolOrderId, {
  commandId: 'CMD-RUNTIME-ACTIONS-REPORT',
  outputSkuCode: runtimeActionOutputLine.outputSkuCode,
  reportedQty: 1,
  reportedAt: '2026-07-31 10:00:00',
  reportedBy: '毛织操作员',
})
assert(getExecutionTaskFactById(runtimeGeneratedWoolOrder.taskId)?.woolAllowedActions?.includes('HANDOVER'))

addWoolHandover(runtimeGeneratedWoolOrder.woolOrderId, {
  commandId: 'CMD-RUNTIME-ACTIONS-HANDOVER',
  outputSkuCode: runtimeActionOutputLine.outputSkuCode,
  handoverQty: 1,
  handedOverAt: '2026-07-31 11:00:00',
  handedOverBy: '毛织仓管',
})
assert(getExecutionTaskFactById(runtimeGeneratedWoolOrder.taskId)?.woolAllowedActions?.includes('COMPLETE'))

completeWoolWorkOrder(runtimeGeneratedWoolOrder.woolOrderId, {
  commandId: 'CMD-RUNTIME-ACTIONS-COMPLETE',
  completedAt: '2026-07-31 12:00:00',
  completedBy: '毛织主管',
})
assert.deepEqual(
  getExecutionTaskFactById(runtimeGeneratedWoolOrder.taskId)?.woolAllowedActions,
  ['DETAIL'],
)

resetWoolFactWorkflowMock('CHECK_WOOL_RUNTIME_IDENTITY_CONFLICTS')
const runtimeIdentityBaseOrder = Object.values(readWoolStore().workOrders)[0]
commitWoolStore((draft) => {
  draft.workOrders[woolRuntimeTask.taskId] = {
    ...structuredClone(runtimeIdentityBaseOrder),
    woolOrderId: woolRuntimeTask.taskId,
    woolOrderNo: 'WMO-RUNTIME-KEY-OCCUPIED',
    taskId: 'TASK-OTHER-RUNTIME-OWNER',
    taskNo: 'TASK-OTHER-RUNTIME-OWNER',
  }
})
const occupiedRuntimeIdentityStore = readWoolStore()
const occupiedRuntimeIdentityWrites = storageWrites.length
assert.throws(
  () => buildWoolOrderFromRuntimeTask(woolRuntimeTask.taskId),
  /加工单身份冲突/,
  'taskId 对应 key 被其他任务占用时不得覆盖',
)
assert.deepEqual(readWoolStore(), occupiedRuntimeIdentityStore)
assert.equal(storageWrites.length, occupiedRuntimeIdentityWrites)

resetWoolFactWorkflowMock('CHECK_WOOL_RUNTIME_EXISTING_FACT_PROTECTION')
const alternateRuntimeOrderId = 'WOOL-RUNTIME-ALTERNATE-ORDER'
commitWoolStore((draft) => {
  draft.workOrders[alternateRuntimeOrderId] = {
    ...structuredClone(runtimeIdentityBaseOrder),
    woolOrderId: alternateRuntimeOrderId,
    woolOrderNo: 'WMO-RUNTIME-ALTERNATE',
    taskId: woolRuntimeTask.taskId,
    taskNo: woolRuntimeTask.taskNo || woolRuntimeTask.taskId,
  }
})
addWoolYarnReceipt(alternateRuntimeOrderId, {
  commandId: 'CMD-RUNTIME-ALTERNATE-FACT',
  receivedAt: '2026-07-31 13:00:00',
  receivedBy: '毛织仓管',
  lines: [{
    yarnSkuCode: readWoolStore().workOrders[alternateRuntimeOrderId].outputPlanLines[0].requiredYarnSkus[0],
    receivedQty: 1,
  }],
})
const alternateRuntimeStoreBeforeBuild = readWoolStore()
const protectedAlternateRuntimeOrder = buildWoolOrderFromRuntimeTask(woolRuntimeTask.taskId)
assert.equal(protectedAlternateRuntimeOrder.woolOrderId, alternateRuntimeOrderId)
assert.deepEqual(readWoolStore(), alternateRuntimeStoreBeforeBuild, '同 taskId 既有加工事实不得被重新生成覆盖')

resetWoolFactWorkflowMock('CHECK_WOOL_RUNTIME_COMMIT_CONFLICT')
const runtimeCommitConflict = {
  ...structuredClone(runtimeIdentityBaseOrder),
  woolOrderId: woolRuntimeTask.taskId,
  woolOrderNo: 'WMO-RUNTIME-CONCURRENT-CONFLICT',
  taskId: 'TASK-CONCURRENT-OTHER',
  taskNo: 'TASK-CONCURRENT-OTHER',
}
setWoolRuntimeOrderCommitConflictForTest(runtimeCommitConflict)
const concurrentConflictStoreBefore = readWoolStore()
const concurrentConflictWritesBefore = storageWrites.length
assert.throws(
  () => buildWoolOrderFromRuntimeTask(woolRuntimeTask.taskId),
  /加工单身份冲突/,
  '预检查后 draft 出现身份占用时必须在原子提交内再次拒绝',
)
assert.deepEqual(readWoolStore(), concurrentConflictStoreBefore)
assert.equal(storageWrites.length, concurrentConflictWritesBefore)
setWoolRuntimeOrderCommitConflictForTest(null)

console.log('PASS task 5: global command receipts, atomic stock, downstream lock, and manual completion')
console.log('PASS task 6: current machine associations and derived four-state availability')
console.log('PASS task 7: runtime generation freezes traceable yarn facts and exposes domain actions')
