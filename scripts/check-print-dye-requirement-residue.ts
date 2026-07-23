import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { listPrepProcessOrders } from '../src/data/fcs/page-adapters/process-prep-pages-adapter.ts'

const read = (path: string) => readFileSync(resolve(path), 'utf8')
const legacyTerms = [
  'PrepRequirement',
  'listPrepRequirementDemands',
  'sourceDemandId',
  'sourceDemandNo',
  'PRD-PRINT',
  'DM-DYE',
  'YHXQ',
  'RSXQ',
]

const scopedFiles = [
  'src/data/fcs/page-adapters/process-prep-pages-adapter.ts',
  'src/data/fcs/process-warehouse-domain.ts',
  'src/data/fcs/process-warehouse-linkage-service.ts',
]

for (const file of scopedFiles) {
  const source = read(file)
  for (const term of legacyTerms) {
    assert.ok(!source.includes(term), `${file} 不得保留旧印染需求单残留：${term}`)
  }
}

const artifactSource = read('src/data/fcs/production-artifact-generation.ts')
assert.ok(!artifactSource.includes('STABLE_DEMAND_SEQUENCE_BY_ARTIFACT_ID'), '生产产物不得保留印染 DEMART 编号映射')
assert.ok(!artifactSource.includes("definition.processCode === 'PRINT'"), '生产产物不得保留印花需求产物特判')
assert.ok(!artifactSource.includes("definition.processCode === 'DYE'"), '生产产物不得保留染色需求产物特判')

for (const processCode of ['PRINT', 'DYE'] as const) {
  const orders = listPrepProcessOrders(processCode)
  assert.ok(orders.length > 0, `${processCode} 准备页必须从实际加工单读取数据`)
  assert.ok(orders.every((order) => Boolean(order.workOrderId) && Boolean(order.workOrderNo)), `${processCode} 准备页必须保留真实加工单标识`)
}

console.log('check-print-dye-requirement-residue.ts PASS')
