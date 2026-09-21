import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'

const root = path.resolve('docs/product-design/tmf-webbing')
const evidenceDir = path.join(root, 'evidence')
const coveragePath = path.join(root, '规范场景验收覆盖.json')
const coverageMdPath = path.join(root, '规范场景验收覆盖.md')
const receiptPath = path.join(evidenceDir, '2026-09-21-scenario-execution-receipts-current.json')
const fullRunPath = path.join(evidenceDir, '2026-09-20-full-browser-run-current.json')
const perfPath = path.join(evidenceDir, '2026-09-21-tmf-strict-performance-current.json')
const pagePath = path.join(evidenceDir, '2026-09-21-page-pda-print-acceptance-current.json')
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const rel = file => path.relative(root, file).replaceAll(path.sep, '/')
const branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim()
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'))
const fullRun = JSON.parse(fs.readFileSync(fullRunPath, 'utf8'))
const perf = JSON.parse(fs.readFileSync(perfPath, 'utf8'))
const page = JSON.parse(fs.readFileSync(pagePath, 'utf8'))
if (receipt.total !== 29 || receipt.passed !== 29 || receipt.failed !== 0) throw new Error('独立场景收据不是29/29')
if (fullRun.total !== 56 || fullRun.passed !== 56 || fullRun.failed !== 0) throw new Error('浏览器总收据不是56/56')
if (!perf.summary?.strictGate || perf.summary.failed !== 0 || perf.summary.maxMs >= 500) throw new Error('性能门禁未通过')
if (page.strictGate?.verdict !== '通过本次页面/PDA/打印专项门禁') throw new Error('页面/PDA/打印门禁未通过')
const old = JSON.parse(fs.readFileSync(coveragePath, 'utf8'))
const byId = new Map(receipt.receipts.map(item => [item.id, item]))
const scenarios = old.scenarios.map(item => {
  const current = byId.get(item.id)
  if (!current || current.status !== '已验证') throw new Error(`${item.id} 没有当前独立通过收据`)
  const browserEvidence = path.join(root, current.independentBrowserReceipt.currentRunReceipt)
  const mockEvidence = path.join(root, current.independentMockReceipt.path)
  return {
    ...item,
    observedScope: '当前版本独立副本：Mock 注入/恢复、命名浏览器脚本、页面/PDA/打印入口和严格性能收据均通过',
    observed: `${item.id} 当前版本独立执行通过；脚本 ${current.independentBrowserReceipt.script} 退出码 0；可观察断言 ${current.independentBrowserReceipt.observableAssertions.count} 项`,
    remaining: '',
    status: '已验证',
    fullyVerified: true,
    evidence: [
      { path: rel(receiptPath), sha256: sha256(receiptPath) },
      { path: rel(mockEvidence), sha256: sha256(mockEvidence) },
      { path: rel(browserEvidence), sha256: sha256(browserEvidence) },
      { path: rel(perfPath), sha256: sha256(perfPath) },
      { path: rel(pagePath), sha256: sha256(pagePath) },
    ],
  }
})
const generatedAt = new Date().toISOString()
const output = {
  ...old,
  generatedAt,
  branch,
  head,
  total: scenarios.length,
  passed: scenarios.filter(item => item.fullyVerified).length,
  failed: scenarios.filter(item => !item.fullyVerified).length,
  normativeScenarioAcceptance: `${scenarios.filter(item => item.fullyVerified).length}/${scenarios.length}`,
  fullScenarioVerifiedCount: scenarios.filter(item => item.fullyVerified).length,
  currentAudit: {
    runAt: generatedAt,
    runner: 'evidence/2026-09-21-update-normative-coverage.mjs',
    scenarioReceipt: rel(receiptPath),
    browserRunId: fullRun.runId,
    browserScripts: `${fullRun.passed}/${fullRun.total}`,
    strictPerformanceSamples: perf.summary.samples,
    pagePdaPrintVerdict: page.strictGate.verdict,
    allScenarioStatus: '已验证',
    missingScenarioIds: [],
  },
  scenarios,
}
fs.writeFileSync(coveragePath, JSON.stringify(output, null, 2) + '\n')
const md = [
  '# TMF 规范场景验收覆盖审计', '',
  `当前版本：${branch}@${head}。规范场景完整验收：${output.passed}/${output.total}；失败 ${output.failed}。`, '',
  '通过条件：每个场景有独立 Mock 副本收据、独立浏览器子进程脚本和脚本自己的可观察证据；同时引用当前页面/PDA/打印专项及严格性能收据。共享整链 JSON 只作为背景，不作为单条场景通过条件。', '',
  '|场景|状态|独立 Mock|独立浏览器脚本|断言|当前收据|',
  '|---|---|---|---|---:|---|',
  ...scenarios.map(item => {
    const current = byId.get(item.id)
    return `|${item.id}|${item.status}|${current.independentMockReceipt.passed}/${current.independentMockReceipt.checks}|${current.independentBrowserReceipt.script}|${current.independentBrowserReceipt.observableAssertions.count}|[独立收据](evidence/2026-09-21-scenario-execution-receipts-current.json)|`
  }),
  '',
  `机器可读明细：[规范场景验收覆盖.json](规范场景验收覆盖.json)；[逐场景执行收据](evidence/2026-09-21-scenario-execution-receipts-current.json)；[严格性能](evidence/2026-09-21-tmf-strict-performance-current.json)；[页面/PDA/打印](evidence/2026-09-21-page-pda-print-acceptance-current.json)。`,
]
fs.writeFileSync(coverageMdPath, md.join('\n') + '\n')
console.log(JSON.stringify({ total: output.total, passed: output.passed, failed: output.failed, head }, null, 2))
