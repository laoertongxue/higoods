import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const repo = process.cwd()
const designRoot = path.join(repo, 'docs/product-design/tmf-webbing')
const evidenceRoot = path.join(designRoot, 'evidence')
const files = {
  unit: path.join(evidenceRoot, '2026-09-23-tmf-unit-current.log'),
  build: path.join(evidenceRoot, '2026-09-23-tmf-build.log'),
  connectedLists: path.join(evidenceRoot, '2026-09-23-tmf-connected-lists.log'),
  connectedPerformance: path.join(evidenceRoot, '2026-09-23-tmf-connected-performance.log'),
  completePerformance: path.join(evidenceRoot, '2026-09-23-tmf-complete-performance.json'),
  performanceFailureHistory: path.join(evidenceRoot, '2026-09-23-tmf-complete-performance-failure.json'),
  independentScenarios: path.join(evidenceRoot, '2026-09-23-scenario-independent-current.json'),
}
const text = file => fs.readFileSync(file, 'utf8')
const json = file => JSON.parse(text(file))
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const rel = file => path.relative(designRoot, file).replaceAll(path.sep, '/')

for (const file of Object.values(files)) assert.ok(fs.existsSync(file), `缺少当前验收证据：${rel(file)}`)
assert.match(text(files.unit), /tests 418/)
assert.match(text(files.unit), /pass 418/)
assert.match(text(files.unit), /fail 0/)
assert.match(text(files.build), /✓ built in/)
assert.match(text(files.connectedLists), /7 passed/)
assert.match(text(files.connectedPerformance), /1 passed/)
const performance = json(files.completePerformance)
assert.equal(performance.passed, true)
assert.equal(performance.failed, 0)
assert.equal(performance.sampleCount, 350)
assert.ok(performance.maxMilliseconds < 500)
const scenarios = json(files.independentScenarios)
assert.deepEqual({ total: scenarios.total, passed: scenarios.passed, failed: scenarios.failed }, { total: 29, passed: 29, failed: 0 })
assert.equal(new Set(scenarios.receipts.map(item => item.file)).size, 29)
assert.ok(scenarios.receipts.every(item => item.pass && item.steps >= 7 && item.assertions >= 9))

const output = {
  generatedAt: new Date().toISOString(),
  branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(),
  head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  workingTreeDiffSha256: crypto.createHash('sha256').update(execFileSync('git', ['diff', '--binary'], { encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 })).digest('hex'),
  verdict: '通过',
  gates: {
    unit: { passed: 418, failed: 0, path: rel(files.unit), sha256: sha256(files.unit) },
    build: { passed: true, path: rel(files.build), sha256: sha256(files.build) },
    connectedBusinessBrowser: { passed: 7, failed: 0, path: rel(files.connectedLists), sha256: sha256(files.connectedLists) },
    connectedPerformanceBrowser: { passed: 1, failed: 0, path: rel(files.connectedPerformance), sha256: sha256(files.connectedPerformance) },
    completePerformance: { samples: performance.sampleCount, maxMilliseconds: performance.maxMilliseconds, failed: performance.failed, threshold: performance.threshold, service: performance.service, viewports: performance.viewports, path: rel(files.completePerformance), sha256: sha256(files.completePerformance), priorFailurePreservedAt: rel(files.performanceFailureHistory), priorFailureSha256: sha256(files.performanceFailureHistory) },
    normativeScenarios: { total: scenarios.total, passed: scenarios.passed, failed: scenarios.failed, distinctReceipts: new Set(scenarios.receipts.map(item => item.file)).size, path: rel(files.independentScenarios), sha256: sha256(files.independentScenarios) },
  },
  coverage: {
    web: ['采购需求', '半成品加工单', '织带加工单', '待接收', '交出记录', '织带加工单详情及全部页签'],
    pda: ['织带厂执行首次进入', '进入任务', '投入接收', '超量接收阻断'],
    print: ['加工明细预览', '对象对应物料图', '二维码', '条码', '打印准备与 window.print 调用'],
    business: ['PMS采购来源', '半成品原料投入', '连续料批次', '技术包路线', '同SKU多长度', '金属/塑料/硅胶端头', '交出', '仓收', '分配发料', '生产实收'],
  },
}
fs.writeFileSync(path.join(evidenceRoot, '2026-09-23-current-acceptance.json'), `${JSON.stringify(output, null, 2)}\n`)
console.log(JSON.stringify({ verdict: output.verdict, gates: output.gates }, null, 2))
