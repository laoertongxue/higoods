import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const read = (path: string): string => readFileSync(new URL(path, root), 'utf8')

const design = read('docs/product-design/辅料工厂管理总体产品设计文档.md')
const plan = read('docs/product-design/辅料工厂管理实施计划.md')
const matrix = read('docs/product-design/辅料工厂管理需求追踪与交付矩阵.md')

const expectedCounts: Record<string, number> = {
  FRAME: 4,
  ORG: 4,
  SRC: 6,
  AUTO: 8,
  PROD: 17,
  QTY: 10,
  CHANGE: 9,
  CANCEL: 7,
  HAND: 7,
  RECEIPT: 9,
  LOG: 6,
  PERM: 6,
  PAGE: 14,
  IMG: 5,
  UI: 6,
  SCOPE: 6,
}

const v15AffectedIds = new Set([
  'PROD-001',
  'PROD-002',
  'PROD-003',
  'PROD-006',
  'PROD-013',
  'PROD-014',
  'PROD-015',
  'QTY-010',
  'LOG-001',
  'LOG-003',
  'PERM-002',
  'PERM-006',
  'PAGE-002',
  'PAGE-004',
  'PAGE-013',
  'PAGE-014',
  'SCOPE-006',
])

const rows = matrix.split('\n')
  .filter((line) => /^\|\s*[A-Z]+-\d{3}\s*\|/.test(line))
  .map((line) => {
    const columns = line.split('|').slice(1, -1).map((value) => value.trim())
    assert.equal(columns.length, 10, `matrix row must have 10 fields: ${line}`)
    return {
      id: columns[0],
      source: columns[1],
      requirement: columns[2],
      workPackage: columns[3],
      implementation: columns[4],
      automation: columns[5],
      pageEvidence: columns[6],
      status: columns[7],
      evidence: columns[8],
      confirmation: columns[9],
    }
  })

assert.equal(rows.length, 124, 'the delivery matrix must keep all 124 atomic requirements')
assert.equal(new Set(rows.map((row) => row.id)).size, 124, 'atomic requirement ids must be unique')
assert.equal(v15AffectedIds.size, 17, 'V1.5 must keep the exact 17 directly affected requirements in the closure audit')

const actualCounts: Record<string, number> = {}
for (const row of rows) {
  const prefix = row.id.split('-')[0]
  actualCounts[prefix] = (actualCounts[prefix] ?? 0) + 1
  assert.ok(row.source, `${row.id} must map back to a design section`)
  assert.match(row.workPackage, /WP-\d{2}/, `${row.id} must bind an implementation work package`)
  assert.ok(row.implementation, `${row.id} must bind its actual implementation location`)
  assert.ok(row.automation, `${row.id} must name its direct automated verification`)
  assert.ok(row.pageEvidence, `${row.id} must include page/device evidence or an explicit not-applicable reason`)
  assert.equal(row.evidence, v15AffectedIds.has(row.id) ? `EV-${prefix}-V15` : `EV-${prefix}`, `${row.id} must use its current evidence group`)

  if (v15AffectedIds.has(row.id)) {
    assert.equal(row.status, '已验证', `${row.id} must be re-verified after the V1.5 implementation and page evidence exist`)
    assert.ok(!/待绑定|待实施|目标位置：/.test(row.implementation), `${row.id} must bind its actual V1.5 implementation location`)
    assert.match(row.confirmation, /业务规则 V1\.5；实现待验收/, `${row.id} must distinguish verified local evidence from product acceptance`)
  } else {
    assert.equal(row.status, '已验证', `${row.id} is outside the V1.5 correction scope and must keep its verified evidence`)
    assert.ok(!/待绑定|待实施|目标位置：/.test(row.implementation), `${row.id} must keep its actual implementation location`)
    assert.match(row.confirmation, /业务规则 V1\.(?:1|3|4)；实现待验收/, `${row.id} must preserve its earlier rule and implementation evidence version`)
  }
}
assert.deepEqual(actualCounts, expectedCounts)
assert.equal(rows.filter((row) => ['待实施', '实施中', '已实现待验证', '已阻塞'].includes(row.status)).length, 0, 'the V1.5 matrix must not retain open rows')
assert.equal(rows.filter((row) => row.status === '已验证').length, 124)

for (const prefix of Object.keys(expectedCounts)) {
  assert.match(matrix, new RegExp(`\\| EV-${prefix} \\|`), `missing row evidence group EV-${prefix}`)
  assert.match(matrix, new RegExp(`\\| EV-${prefix} \\|[^\n]*实际实现文件与关键事实|EV-${prefix}`), `missing evidence registry entry EV-${prefix}`)
}

for (let chapter = 2; chapter <= 34; chapter += 1) {
  assert.match(design, new RegExp(`^## ${chapter}\\.`, 'm'), `design chapter ${chapter} is missing`)
}

const workPackageStatuses: Record<string, RegExp> = {
  'WP-01': /实施状态：已验证（V1\.5）/,
  'WP-02': /实施状态：已验证（V1\.5）/,
  'WP-03': /实施状态：已验证（V1\.5 复验，结构沿用）/,
  'WP-04': /实施状态：已验证（V1\.5）/,
  'WP-05': /实施状态：已验证（V1\.5 复验，规则未变）/,
  'WP-06': /实施状态：已验证（V1\.5 复验，规则未变）/,
  'WP-07': /实施状态：已验证/,
  'WP-08': /实施状态：已验证（V1\.5 图片与交互复验）/,
  'WP-09': /实施状态：已验证（V1\.5 任务范围）/,
}
for (const [id, expectedStatus] of Object.entries(workPackageStatuses)) {
  const start = plan.indexOf(`### ${id}`)
  assert.notEqual(start, -1, `${id} is missing from the implementation plan`)
  const next = plan.indexOf('\n### WP-', start + 1)
  const section = plan.slice(start, next === -1 ? undefined : next)
  assert.match(section, expectedStatus, `${id} has the wrong V1.5 implementation status`)
}

for (const requiredText of [
  'V1.5（加工投入最小化纠偏版）',
  '三类独立业务事实',
  'demandSource: LaceDemandSourceSnapshot',
  'inputLines: LaceProcessingInputLine[]',
  'processingOutput: LaceProcessingOutput',
  '待接收 → 加工中 → 已完结',
  '确认接收',
  '加工填报',
  '完成加工单',
  '撤销完成',
  '采购变更待查看 N 单',
  '采购单 ID＋SKU ID',
  '一次性交出全部数量时，只生成一条交出记录',
  '实际收货数量，是回写采购订单到货数量的唯一依据',
  '默认加工投入',
  '单位用量',
  'QTY-010',
  'SCOPE-006',
  '124 条',
  '17 条',
  '4 个 Playwright',
]) assert.ok(`${design}\n${plan}\n${matrix}`.includes(requiredText), `missing confirmed V1.5 product fact: ${requiredText}`)

const detailSection = design.slice(design.indexOf('### 24.3'), design.indexOf('### 24.4'))
assert.ok(detailSection.indexOf('加工投入') < detailSection.indexOf('需求来源'))
assert.ok(detailSection.indexOf('需求来源') < detailSection.indexOf('加工产出'))
assert.match(detailSection, /生产信息[\s\S]*完工与交出[\s\S]*操作日志/)
assert.match(design, /确认接收只表示花边厂接受并开始处理这张生产任务，不生成加工投入的实物交接记录/)
assert.match(design, /完成加工单不以“全部交出”或“全部收货”为前提/)

assert.match(matrix, /权威需求来源[^\n]*V1\.5[^\n]*V1\.4/)
assert.match(matrix, /124 条现均为“已验证”/)
assert.match(plan, /124 条原子需求/)
assert.match(design, /V1\.3 与这两类要求有关的实现、自动化和页面证据只作为历史记录/)
assert.doesNotMatch(matrix, /目标位置：|\| 待实施 \|/)

assert.match(matrix, /## 16\. 正向与反向追踪结果/)
assert.match(matrix, /### 16\.1 正向追踪/)
assert.match(matrix, /### 16\.2 反向追踪/)

for (const path of [
  'src/data/fcs/lace-factory-purchase-projection.ts',
  'src/data/fcs/lace-production-generation-key.ts',
  'src/data/fcs/lace-factory-domain.ts',
  'src/pages/process-factory/accessory/lace/purchase-demands.ts',
  'src/pages/process-factory/accessory/lace/work-orders.ts',
  'src/pages/process-factory/accessory/lace/work-order-detail.ts',
  'src/pages/process-factory/accessory/lace/handover-records.ts',
  'src/pages/wls-accessory-receipts.ts',
  'src/pages/pms-purchase-orders.ts',
  'docs/prototype-review-records/2026-08-08-accessory-factory-management.md',
  'docs/prototype-review-records/2026-08-10-accessory-factory-input-simplification.md',
  'tests/lace-factory-input-v15.spec.ts',
]) assert.ok(existsSync(new URL(path, root)), `missing tracked implementation or historical evidence file: ${path}`)

console.log('辅料工厂产品交付文档检查通过：总体设计 V1.5、9 个工作包、124 条原子需求全部已验证，17 条直接受影响要求均已绑定实现与当前证据，正反向追踪一致。')
