import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { alignWoolColorMaterialMappingsForDemand } from '../src/data/fcs/production-tech-pack-snapshot-builder.ts'

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
