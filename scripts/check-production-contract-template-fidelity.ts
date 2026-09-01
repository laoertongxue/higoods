import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createEffectiveTaskAssignment, resetEffectiveTaskAssignmentsForTests } from '../src/data/fcs/effective-task-assignments.ts'
import { SEWING_OUTSOURCING_DEMO_CURRENT_PPIC } from '../src/data/fcs/factory-onboarding-ppic.ts'
import { generateProductionContract, resetProductionContractsForTests } from '../src/data/fcs/production-contracts.ts'
import { createProductionReturnRuleSnapshot, resetProductionReturnSnapshotSequenceForTests } from '../src/data/fcs/production-return-fulfillment.ts'
import { classifyTaskFulfillmentPolicy } from '../src/data/fcs/task-fulfillment-policy.ts'
import { buildProductionContractPrintDocument, renderProductionContractTemplate } from '../src/pages/print/templates/production-contract-template.ts'
import {
  PRODUCTION_CONTRACT_MASTER_ASSETS,
  PRODUCTION_CONTRACT_MASTER_PAGE_COUNT,
  PRODUCTION_CONTRACT_MASTER_SOURCE,
  PRODUCTION_CONTRACT_MASTER_SOURCE_SHA256,
  PRODUCTION_CONTRACT_MASTER_TEMPLATE_CODE,
  formatContractDateIndonesian,
  renderProductionContractMasterTemplate,
} from '../src/pages/print/templates/production-contract-master-template.ts'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

function fileFromPublicUrl(value: string): string {
  return path.join(repoRoot, 'public', value.replace(/^\//, ''))
}

function sha256(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

function pngSize(filePath: string): { width: number; height: number } {
  const value = fs.readFileSync(filePath)
  assert.equal(value.subarray(1, 4).toString('ascii'), 'PNG')
  return { width: value.readUInt32BE(16), height: value.readUInt32BE(20) }
}

// 母版固定内容以用户提供 PDF 的二进制指纹冻结；两张打印底图只允许由该 PDF 生成。
assert.equal(sha256(fileFromPublicUrl(PRODUCTION_CONTRACT_MASTER_SOURCE)), PRODUCTION_CONTRACT_MASTER_SOURCE_SHA256)
assert.equal(sha256(fileFromPublicUrl(PRODUCTION_CONTRACT_MASTER_ASSETS[0])), 'f56c97571e35091212e55ca2e26b7089d33b135550141c2d46761bcbd2221cad')
assert.equal(sha256(fileFromPublicUrl(PRODUCTION_CONTRACT_MASTER_ASSETS[1])), 'e10df5d5618c8624f4479f6f6a0040b9bb38a360b299b87ad2dd526c87b0434d')
for (const asset of PRODUCTION_CONTRACT_MASTER_ASSETS) assert.deepEqual(pngSize(fileFromPublicUrl(asset)), { width: 2481, height: 3508 })
assert.equal(PRODUCTION_CONTRACT_MASTER_PAGE_COUNT, 2)

resetEffectiveTaskAssignmentsForTests()
resetProductionReturnSnapshotSequenceForTests()
resetProductionContractsForTests()
const policy = classifyTaskFulfillmentPolicy({
  processCode: 'SEWING',
  processBusinessCode: 'SEWING',
  processNameZh: '车缝',
  taskUnitType: 'SINGLE_PROCESS_TASK',
  assignmentGranularity: 'SKU',
})
const assignment = createEffectiveTaskAssignment({
  assignmentId: 'ASG-CONTRACT-TEMPLATE-CHECK',
  runtimeTaskId: 'TASK-CONTRACT-TEMPLATE-CHECK',
  productionOrderId: 'PO-CONTRACT-TEMPLATE-CHECK',
  productionOrderNo: 'PO-CONTRACT-TEMPLATE-CHECK',
  taskNo: 'TASK-CONTRACT-TEMPLATE-CHECK',
  factoryId: 'ID-F021',
  factoryName: 'CV Micro Sewing Jakarta Pusat',
  source: 'DIRECT_DISPATCH',
  assignedQty: 101,
  skuLines: [{ skuCode: 'SKU-WHT-M', color: 'White', size: 'M', qty: 101 }],
  processCodes: ['SEWING'],
  frozenPrice: 1200,
  priceCurrency: 'IDR',
  priceUnit: 'Pcs',
  businessAssignedAt: '2026-08-05 17:04:00',
  operatedAt: '2026-08-05 17:04:00',
  operatedBy: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
  allocationOperatorPpicId: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicId,
  allocationOperatorPpicName: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
})
const returnRuleSnapshot = createProductionReturnRuleSnapshot({
  assignmentId: assignment.assignmentId,
  runtimeTaskId: assignment.runtimeTaskId,
  productionOrderId: assignment.productionOrderId,
  factoryId: assignment.factoryId,
  factoryName: assignment.factoryName,
  assignedQty: assignment.assignedQty,
  businessAssignedAt: assignment.businessAssignedAt,
  policy,
})
assert(returnRuleSnapshot)
const contract = generateProductionContract({
  assignment,
  policy,
  returnRuleSnapshot,
  processNames: ['车缝'],
  generatedAt: '2026-08-05 17:04:00',
  generatedBy: '生产计划员',
})
assert(contract)
assert.equal(contract.templateSnapshot.taskTypeId, 'NON-GABUNGAN')
assert.equal(contract.templateSnapshot.processTypeId, 'JAHIT')
assert.equal(contract.templateSnapshot.dayCalculationId, 'KALENDER')
assert.equal(contract.templateSnapshot.pickupDate, 'Belum diambil')
assert.equal(contract.templateSnapshot.taskDetails[0].purchaseOrderNo, 'Tidak tersedia')

const rendered = renderProductionContractMasterTemplate(contract, {
  printedAt: '2026-08-05 17:04:00',
  printedBy: '生产计划员',
})
assert(rendered.includes(`data-contract-template="${PRODUCTION_CONTRACT_MASTER_TEMPLATE_CODE}"`))
assert.equal((rendered.match(/production-contract-master__page(?: |")/g) || []).length, 2)
for (const asset of PRODUCTION_CONTRACT_MASTER_ASSETS) assert(rendered.includes(asset))
for (const requiredValue of ['CV Micro Sewing Jakarta Pusat', 'NON-GABUNGAN', 'JAHIT', 'KALENDER', 'Belum diambil', 'Tidak tersedia', 'Perencana Produksi', '5 Agustus 2026', '8 Agu 2026']) {
  assert(rendered.includes(requiredValue), `合同动态字段缺少印尼文值：${requiredValue}`)
}
for (const forbiddenText of ['生产加工合同', 'PRODUCTION PROCESSING CONTRACT', '生产履约约定与签署页', 'FULFILLMENT TERMS AND SIGNATURES', 'SKU DETAILS CONTINUED', '[[NO_KONTRAK]]']) {
  assert.equal(rendered.includes(forbiddenText), false, `合同仍包含旧格式或未替换占位符：${forbiddenText}`)
}
assert(rendered.includes('data-contract-adaptive="true"'))
assert(rendered.includes('data-contract-wrap="true"'))
assert(rendered.includes('overflow-wrap:anywhere'))
assert.equal(formatContractDateIndonesian('2026-08-05'), '5 Agustus 2026')

const printDocument = buildProductionContractPrintDocument({
  documentType: 'PRODUCTION_CONTRACT',
  sourceType: 'PRODUCTION_CONTRACT_RECORD',
  sourceId: contract.contractId,
  generatedAt: '2026-08-05 17:04:00',
  generatedBy: '生产计划员',
})
assert.equal(printDocument.templateCode, PRODUCTION_CONTRACT_MASTER_TEMPLATE_CODE)
assert(renderProductionContractTemplate(printDocument).includes(`data-contract-template="${PRODUCTION_CONTRACT_MASTER_TEMPLATE_CODE}"`))

const directPrintSource = fs.readFileSync(path.join(repoRoot, 'src/pages/production-contract-print.ts'), 'utf8')
const registryPrintSource = fs.readFileSync(path.join(repoRoot, 'src/pages/print/templates/production-contract-template.ts'), 'utf8')
assert(directPrintSource.includes('renderProductionContractMasterTemplate'))
assert(registryPrintSource.includes('renderProductionContractMasterTemplate'))
for (const source of [directPrintSource, registryPrintSource]) {
  assert(!source.includes('PRODUCTION PROCESSING CONTRACT'))
  assert(!source.includes('FULFILLMENT TERMS AND SIGNATURES'))
}

console.log('生产合同母版一致性检查通过：原 PDF 与两页打印底图指纹冻结，全部打印入口共用母版，动态字段使用印尼文。')
