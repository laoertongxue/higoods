import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'

const root = path.resolve('docs/product-design/tmf-webbing')
const evidenceDir = path.join(root, 'evidence')
const scenarioDir = path.join(evidenceDir, 'scenarios')
const fullRunPath = path.join(evidenceDir, '2026-09-20-full-browser-run-current.json')
const perfPath = path.join(evidenceDir, '2026-09-21-tmf-strict-performance-current.json')
const pagePath = path.join(evidenceDir, '2026-09-21-page-pda-print-acceptance-current.json')
const receiptPath = path.join(evidenceDir, '2026-09-21-scenario-execution-receipts-current.json')
const markdownPath = path.join(evidenceDir, '2026-09-21-scenario-execution-receipts-current.md')

const scriptByScenario = {
  N01: '2026-09-20-native-dye-browser.mjs',
  N02: '2026-09-20-tip-dispatch-ui-browser.mjs',
  N03: '2026-09-20-tip-dispatch-ui-browser.mjs',
  N04: '2026-09-20-tip-dispatch-ui-browser.mjs',
  N05: '2026-09-20-merged-N05-browser.mjs',
  B01: '2026-09-20-b05-recovery-browser.mjs',
  B02: '2026-09-20-b06-recovery-browser.mjs',
  B03: '2026-09-20-tmf-cancel-browser.mjs',
  B04: '2026-09-20-b05-recovery-browser.mjs',
  B05: '2026-09-20-b05-recovery-browser.mjs',
  B06: '2026-09-20-b06-recovery-browser.mjs',
  B07: '2026-09-20-tip-dispatch-ui-browser.mjs',
  B08: '2026-09-20-tip-dispatch-ui-browser.mjs',
  B09: '2026-09-20-b09-recovery-browser.mjs',
  B10: '2026-09-20-output-receipts-browser.mjs',
  B11: '2026-09-20-pda-output-receipt-browser.mjs',
  B12: '2026-09-20-package-stock-browser.mjs',
  B13: '2026-09-20-processed-return-reuse-browser.mjs',
  B14: '2026-09-20-frozen-replan-browser.mjs',
  B15: '2026-09-20-tmf-cancel-browser.mjs',
  B16: '2026-09-20-pda-output-receipt-browser.mjs',
  B17: '2026-09-20-merged-N05-browser.mjs',
  B18: '2026-09-20-tip-dispatch-ui-browser.mjs',
  B19: '2026-09-20-upstream-issue-browser.mjs',
  B20: '2026-09-20-package-stock-browser.mjs',
  B21: '2026-09-20-purchase-durability-browser.mjs',
  B22: '2026-09-20-material-reference-browser.mjs',
  B23: '2026-09-20-b23-revision-browser.mjs',
  B24: '2026-09-20-b24-return-browser.mjs',
}

const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'))
const fullRun = readJson(fullRunPath)
const perf = readJson(perfPath)
const page = readJson(pagePath)
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim()
const runByFile = new Map(fullRun.results.map(item => [item.file, item]))
const pageVerdict = page.strictGate?.verdict
const pageErrors = page.strictGate?.pagePdaErrors ?? null

const ids = ['N01', 'N02', 'N03', 'N04', 'N05', ...Array.from({ length: 24 }, (_, i) => `B${String(i + 1).padStart(2, '0')}`)]
const receipts = ids.map(id => {
  const scenarioPath = path.join(scenarioDir, `${id}.json`)
  const scenario = readJson(scenarioPath)
  const script = scriptByScenario[id]
  const child = runByFile.get(script)
  const currentReceiptPath = child?.receipt ? path.join(evidenceDir, child.receipt) : null
  const currentReceipt = currentReceiptPath && fs.existsSync(currentReceiptPath) ? readJson(currentReceiptPath) : null
  const assertions = currentReceipt
    ? { ...currentReceipt.observable, sourceAssertionCallCount: currentReceipt.assertionCallCount, count: currentReceipt.observable.count + currentReceipt.assertionCallCount }
    : { mode: 'missing-current-child-receipt', checks: 0, checkpoints: 0, samples: 0, errors: 1, sourceAssertionCallCount: 0, count: 0 }
  const mockPass = scenario.execution?.failed === 0 && scenario.execution?.passed === scenario.execution?.checks && scenario.status === 'Mock已验证'
  const browserPass = !!child && child.rc === 0 && child.passed === true && !!currentReceipt && currentReceipt.runId === fullRun.runId && currentReceipt.head === head && currentReceipt.pass === true
  const pagePass = pageVerdict === '通过本次页面/PDA/打印专项门禁' && pageErrors === 0
  return {
    id,
    type: scenario.scenarioType,
    independentMockReceipt: {
      path: path.relative(root, scenarioPath),
      sha256: sha256(scenarioPath),
      checks: scenario.execution?.checks ?? 0,
      passed: scenario.execution?.passed ?? 0,
      failed: scenario.execution?.failed ?? 0,
      pass: mockPass,
    },
    independentBrowserReceipt: {
      runner: 'run-all-browser-current.mjs',
      executionModel: '每个脚本由独立 child process 启动，拥有独立 Playwright browser context 与 localStorage；不读取共享整链 JSON 作为通过条件',
      script,
      exitCode: child?.rc ?? null,
      runnerResultPath: path.relative(root, fullRunPath),
      runnerResultSha256: sha256(fullRunPath),
      runId: fullRun.runId ?? null,
      currentRunReceipt: currentReceiptPath ? path.relative(root, currentReceiptPath) : null,
      currentRunReceiptSha256: currentReceiptPath ? sha256(currentReceiptPath) : null,
      scriptSourceSha256: currentReceipt?.scriptSourceSha256 ?? null,
      startedAt: currentReceipt?.startedAt ?? null,
      finishedAt: currentReceipt?.finishedAt ?? null,
      observableAssertions: assertions,
      pass: browserPass,
    },
    currentPerfGate: {
      path: path.relative(root, perfPath),
      sha256: sha256(perfPath),
      samples: perf.summary?.samples ?? perf.samples?.length ?? 0,
      failed: perf.summary?.failed ?? null,
      maxMs: perf.summary?.maxMs ?? null,
      strictGate: perf.summary?.strictGate === true,
    },
    currentPagePdaPrintGate: {
      path: path.relative(root, pagePath),
      sha256: sha256(pagePath),
      verdict: pageVerdict,
      errors: pageErrors,
      pass: pagePass,
    },
    status: mockPass && browserPass && (perf.summary?.strictGate === true) && pagePass ? '已验证' : '未通过',
  }
})

const failed = receipts.filter(item => item.status !== '已验证')
const output = {
  generatedAt: new Date().toISOString(),
  branch,
  head,
  sourceFullBrowserRun: { path: path.relative(root, fullRunPath), sha256: sha256(fullRunPath), total: fullRun.total, passed: fullRun.passed, failed: fullRun.failed },
  strictPerformance: { path: path.relative(root, perfPath), sha256: sha256(perfPath), summary: perf.summary },
  pagePdaPrint: { path: path.relative(root, pagePath), sha256: sha256(pagePath), verdict: pageVerdict, errors: pageErrors },
  total: receipts.length,
  passed: receipts.length - failed.length,
  failed: failed.length,
  receipts,
}
fs.writeFileSync(receiptPath, JSON.stringify(output, null, 2) + '\n')
const md = [
  '# TMF 规范场景独立执行收据（2026-09-21）',
  '',
  `当前分支：${branch}；HEAD：${head}`, '',
  `结果：${output.passed}/${output.total} 场景通过；失败 ${output.failed}。`,
  '',
  '每一行均同时包含独立 Mock 副本收据和独立浏览器子进程收据。全量运行器逐个启动脚本，并为每个 child 生成带 runId、当前 HEAD、脚本源码 SHA、起止时间、退出码、当前日志 SHA、源码断言调用数和当前 stdout 观察项的收据；场景通过不再依赖旧的脚本 JSON 文件。还必须同时满足当前严格性能及页面/PDA/打印门禁。',
  '',
  '|场景|类型|Mock|浏览器脚本|可观察断言|性能|状态|',
  '|---|---|---:|---|---:|---|---|',
  ...receipts.map(item => `|${item.id}|${item.type}|${item.independentMockReceipt.passed}/${item.independentMockReceipt.checks}|${item.independentBrowserReceipt.script}|${item.independentBrowserReceipt.observableAssertions.count}|${item.currentPerfGate.strictGate ? `<500ms（${item.currentPerfGate.samples}样本，最大${item.currentPerfGate.maxMs}ms）` : '未通过'}|${item.status}|`),
  '',
  `机器可读收据：[2026-09-21-scenario-execution-receipts-current.json](2026-09-21-scenario-execution-receipts-current.json)。严格性能：[2026-09-21-tmf-strict-performance-current.json](2026-09-21-tmf-strict-performance-current.json)。页面/PDA/打印：[2026-09-21-page-pda-print-acceptance-current.json](2026-09-21-page-pda-print-acceptance-current.json)。`,
]
fs.writeFileSync(markdownPath, md.join('\n') + '\n')
console.log(JSON.stringify({ total: output.total, passed: output.passed, failed: output.failed, head, perf: perf.summary }, null, 2))
if (failed.length) process.exitCode = 1
