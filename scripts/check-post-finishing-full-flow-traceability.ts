#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

const matrix = read('../docs/requirement-traceability/2026-08-31-qc-post-finishing-full-flow-matrix.md')
const design = read('../docs/product-design/QC后道全流程系统完整调整方案.md')
const plan = read('../docs/implementation-plans/2026-08-31-qc-post-finishing-full-flow-adjustment.md')
const review = read('../docs/prototype-review-records/2026-08-31-qc-post-finishing-full-flow.md')
const crossTerminalSpec = read('../tests/post-finishing-full-flow-cross-terminal.spec.ts')
const crossTerminalStaticCheck = read('./check-post-finishing-cross-terminal-ui.ts')
const crossTerminalEvidenceCheck = read('./check-post-finishing-cross-terminal-evidence.ts')

const expectedIds = `
GLOBAL-001 GLOBAL-002 GLOBAL-003
AUTH-001 AUTH-002 AUTH-003 AUTH-004 AUTH-005
LOG-001 LOG-002 LOG-003 CHAIN-001 CHAIN-002 TERM-001 IDENTITY-001
DELIVERY-001 DELIVERY-002 DELIVERY-003
RETURN-001 RETURN-002 RETURN-003 RETURN-004 RETURN-005 RETURN-006 RETURN-007 RETURN-008
QCNO-001 QCNO-002 QCNO-003 QCNO-004 QCNO-005
SEND-001 SEND-002 SEND-003 SENDPRINT-001 SENDPRINT-002
QC-001 QC-002 QC-003 QC-004 QC-005 QC-006 QC-007 QC-008 QCINFO-001
QCREF-001 QCREF-002 QCREF-003 QCREF-004 QCREF-005
QCQTY-001 QCQTY-002 QCQTY-003 QCQTY-004
QCROUTE-001 QCROUTE-002 QCROUTE-003
POSTPRINT-001 POSTPRINT-002 POST-001 POST-002 POST-003 POST-004 POST-005
POSTDEF-001 POSTDEF-002 POSTDEF-003 POSTDEF-004 POSTQTY-001 POSTQTY-002 POST-006
RECHECK-001 RECHECK-002 RECHECK-003 RECHECK-004
RECHECKQTY-001 RECHECKQTY-002 RECHECKBAR-001 RECHECKAUTH-001 RECHECKAUTH-002
BARCODE-001 BARCODE-002 BARCODE-003
OUTBOUND-001 OUTBOUND-002 OUTBOUND-003 OUTBOUND-004 OUTBOUND-005 OUTBOUND-006
WAREHOUSE-001 WAREHOUSE-002 WAREHOUSE-003 WAREHOUSE-004 WAREHOUSE-005
WAREHOUSE-006 WAREHOUSE-007 WAREHOUSE-008 WAREHOUSE-009 WAREHOUSE-010
IMAGE-001 IMAGE-002 PDA-001 PDA-002 PDA-003 PRINT-001 PRINT-002
MIGRATION-001 MIGRATION-002 MIGRATION-003 MIGRATION-004
TEST-001 TEST-002 TEST-003 TEST-004 TEST-005
`.trim().split(/\s+/)

type AtomicRow = {
  id: string
  source: string
  implementation: string
  automated: string
  surface: string
  status: string
  evidence: string
  confirmation: string
}

const atomicRows: AtomicRow[] = matrix
  .split('\n')
  .filter((line) => /^\| [A-Z][A-Z0-9-]+-\d{3} \|/.test(line))
  .map((line) => {
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim())
    assert.equal(cells.length, 10, `原子需求行必须有 10 个字段：${line}`)
    return {
      id: cells[0],
      source: cells[1],
      implementation: cells[4],
      automated: cells[5],
      surface: cells[6],
      status: cells[7],
      evidence: cells[8],
      confirmation: cells[9],
    }
  })

const actualIds = atomicRows.map((row) => row.id)
assert.equal(new Set(actualIds).size, actualIds.length, '原子需求编号必须唯一')
assert.deepEqual([...actualIds].sort(), [...expectedIds].sort(), '原子需求不得缺失、增加或更名')

const allowedStatuses = new Set(['待实施', '实施中', '已实现待验证', '已验证', '已阻塞', '不适用'])
for (const row of atomicRows) {
  assert(allowedStatuses.has(row.status), `${row.id} 使用了非法状态 ${row.status}`)
  assert.equal(row.status, '已验证', `${row.id} 尚未达到已验证`)
  assert(row.implementation && row.automated && row.surface, `${row.id} 缺少实现或验证字段`)
  assert(row.evidence.includes('§3.2'), `${row.id} 未关联最终交付证据表`)
  assert(row.confirmation.includes('用户规则确认') && row.confirmation.includes('实现验收待用户'), `${row.id} 未区分规则确认与实现接受`)
}

const sourceText = atomicRows.map((row) => row.source).join('、')
const expectedParagraphs = 'P004 P006 P008 P010 P014 P016 P018 P020 P021 P023 P027 P029 P031 P033 P035 P037 P038 P040 P044 P046 P048 P050 P052 P056 P058 P060 P062 P064 P066 P070 P072 P074 P075'.split(' ')
for (const source of expectedParagraphs) assert(sourceText.includes(source), `原文来源 ${source} 未映射到原子需求`)
for (let index = 1; index <= 13; index += 1) {
  const source = `U-${String(index).padStart(2, '0')}`
  assert(sourceText.includes(source), `用户确认 ${source} 未映射到原子需求`)
}

const evidenceStart = matrix.indexOf('### 3.2 最终实现与验证证据表')
const evidenceEnd = matrix.indexOf('\n## 4.', evidenceStart)
assert(evidenceStart >= 0 && evidenceEnd > evidenceStart, '矩阵缺少 §3.2 最终实现与验证证据表')
const evidenceSection = matrix.slice(evidenceStart, evidenceEnd)
const evidenceIds = [...evidenceSection.matchAll(/\b[A-Z][A-Z0-9-]+-\d{3}\b/g)].map((match) => match[0])
assert.deepEqual([...new Set(evidenceIds)].sort(), [...expectedIds].sort(), '最终证据表没有完整覆盖全部原子需求')
for (const id of expectedIds) {
  assert.equal(evidenceIds.filter((candidate) => candidate === id).length, 1, `${id} 在最终证据表中必须且只能出现一次`)
}

for (const required of ['本地原型已验证', '3 个生产单', '每个生产单 5 个 SKU', '每个生产单 5 次回货', '核查第 1 遍', '核查第 2 遍']) {
  assert(matrix.includes(required), `矩阵缺少最终口径：${required}`)
}
assert(design.includes('当前交付状态：本地原型已验证'), '总体设计未更新当前交付状态')
assert(plan.includes('## 19. 实际执行与验证结果'), '实施计划未回填实际执行结果')
assert(review.includes('核查第 1 遍') && review.includes('核查第 2 遍'), '原型审查记录缺少两轮核查证据')
assert(review.includes('3 个生产单 × 5 个 SKU × 5 次回货'), '原型审查记录缺少 3×5×5 场景证据')

for (const [name, content] of [
  ['总体设计', design],
  ['实施计划', plan],
  ['需求矩阵', matrix],
  ['原型审查记录', review],
] as const) {
  assert(content.includes('15 条链逐条跨端连续 UI 操作'), `${name}缺少全量跨端连续 UI 验收口径`)
  assert(content.includes('全部业务写入由 Web/PDA 页面操作产生'), `${name}缺少 UI-only 写入边界`)
}

for (const path of [
  'output/verification/qc-post-finishing-full-flow/pass-1/',
  'output/verification/qc-post-finishing-full-flow/pass-2/',
]) {
  assert(plan.includes(path), `实施计划缺少持久化证据目录：${path}`)
  assert(review.includes(path), `原型审查记录缺少持久化证据目录：${path}`)
}

assert(review.includes('28张截图') && matrix.includes('28张截图'), '审查记录或矩阵缺少每轮28张截图证据')
assert(crossTerminalSpec.includes('全部业务写入由 Web/PDA 页面操作产生'), '连续UI测试缺少写入边界声明')
assert(crossTerminalSpec.includes("toHaveLength(15)"), '连续UI测试缺少15条链断言')
assert(crossTerminalStaticCheck.includes('forbiddenDomainWrites'), '跨端静态门禁缺少领域写入禁用清单')
assert(crossTerminalEvidenceCheck.includes("screenshots.length, 28"), '跨端证据检查缺少28张截图门槛')
assert(crossTerminalEvidenceCheck.includes("traces.length, 1"), '跨端证据检查缺少完整trace门槛')
assert(crossTerminalEvidenceCheck.includes("shape(readEvidence('pass-1').evidence)"), '跨端证据检查缺少两轮结构一致性比较')

for (const hash of [
  '335ffd1a4fbee22755f4af2f94d512c09d47302ecd1e1b2c18a2bca9db386dbe',
  '04dac01b422942f0ac0590dc71fec0b251c4135934906305ce9003106cde3c62',
  'e193f1f9c3a472ec3fc7a19d18f27c38ba66dc53e28e628123b6e2b2f6211e04',
  '7bc67580137b8833b8fd37c180afda9d574be8bc658f00f10141a9f86ca52341',
]) {
  assert(plan.includes(hash), `实施计划缺少最终证据哈希：${hash}`)
  assert(review.includes(hash), `原型审查记录缺少最终证据哈希：${hash}`)
}
assert(review.includes('写入PDA测试登录会话'), '原型审查记录未披露PDA测试会话准备边界')

console.log(JSON.stringify({
  suite: 'QC 后道全流程需求追踪闭环检查',
  atomicRequirements: atomicRows.length,
  sourceParagraphs: expectedParagraphs.length,
  userConfirmations: 13,
  evidenceMappings: evidenceIds.length,
  status: '全部已验证',
}, null, 2))
