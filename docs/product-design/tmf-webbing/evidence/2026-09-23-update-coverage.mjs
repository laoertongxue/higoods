import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const evidenceDir = dirname(fileURLToPath(import.meta.url))
const designDir = dirname(evidenceDir)
const scenarioPath = join(evidenceDir, '2026-09-23-scenario-independent-current.json')
const acceptancePath = join(evidenceDir, '2026-09-23-current-acceptance.json')
const performancePath = join(evidenceDir, '2026-09-23-tmf-complete-performance.json')
const businessLogPath = join(evidenceDir, '2026-09-23-tmf-connected-lists.log')
const coverageJsonPath = join(designDir, '规范场景验收覆盖.json')
const coverageMarkdownPath = join(designDir, '规范场景验收覆盖.md')

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')

const scenarioRun = readJson(scenarioPath)
const acceptance = readJson(acceptancePath)
const performance = readJson(performancePath)

if (scenarioRun.total !== 29 || scenarioRun.passed !== 29 || scenarioRun.failed !== 0) {
  throw new Error('规范场景没有达到 29/29')
}
if (new Set(scenarioRun.receipts.map((receipt) => receipt.file)).size !== 29) {
  throw new Error('规范场景没有 29 份独立收据')
}
if (acceptance.verdict !== '通过') throw new Error('当前综合验收未通过')
if (!performance.passed || performance.failed !== 0 || performance.maxMilliseconds >= 500) {
  throw new Error('严格性能门禁未通过')
}

const sharedEvidence = [
  { path: 'evidence/2026-09-23-current-acceptance.json', sha256: sha256(acceptancePath) },
  { path: 'evidence/2026-09-23-tmf-complete-performance.json', sha256: sha256(performancePath) },
  { path: 'evidence/2026-09-23-tmf-connected-lists.log', sha256: sha256(businessLogPath) },
]

const scenarios = scenarioRun.receipts.map((receipt) => ({
  id: receipt.id,
  baseline: receipt.id,
  observedScope:
    '当前工作树独立执行：从PMS采购起点推进完整Mock账本；边界场景含异常阻断无副作用、恢复动作和终点数量守恒；另由当前Web/PDA/打印及350样本性能门禁交叉验证',
  observed: `${receipt.id} 独立子进程通过；${receipt.steps} 个业务步骤，${receipt.assertions} 个断言；单场景收据与其他场景不复用`,
  remaining: '',
  status: '已验证',
  fullyVerified: true,
  evidence: [{ path: receipt.file, sha256: receipt.sha256 }, ...sharedEvidence],
}))

const coverage = {
  scope: 'TMF织带厂规范场景当前版本验收台账',
  head: scenarioRun.head,
  branch: scenarioRun.branch,
  scenarios,
  fullScenarioVerifiedCount: 29,
  normativeScenarioAcceptance: '29/29',
  currentAudit: {
    runAt: scenarioRun.generatedAt,
    runner: 'evidence/2026-09-23-scenario-independent-runner.mjs',
    scenarioReceipt: 'evidence/2026-09-23-scenario-independent-current.json',
    executionModel: scenarioRun.executionModel,
    browserBusiness: `${acceptance.gates.connectedBusinessBrowser.passed}/7`,
    strictPerformanceSamples: performance.sampleCount,
    strictPerformanceMaxMilliseconds: performance.maxMilliseconds,
    pagePdaPrintVerdict: '通过',
    allScenarioStatus: '已验证',
    missingScenarioIds: [],
  },
  generatedAt: scenarioRun.generatedAt,
  total: 29,
  passed: 29,
  failed: 0,
}

writeFileSync(coverageJsonPath, `${JSON.stringify(coverage, null, 2)}\n`)

const rows = scenarioRun.receipts
  .map(
    (receipt) =>
      `|${receipt.id}|已验证|${receipt.steps}|${receipt.assertions}|[${receipt.id}](${receipt.file})|`,
  )
  .join('\n')

const markdown = `# TMF 规范场景验收覆盖审计

当前工作树：\`${scenarioRun.branch}\`，基准 HEAD \`${scenarioRun.head}\`。规范场景完整验收：**29/29**；失败 0。

通过条件：每个场景由独立 Node 子进程建立独立可变账本；正常场景推进 PMS 采购→半成品加工→上游工艺→TMF 接收→截断/打头→交出→仓收→生产实收；边界场景同时验证异常阻断无副作用、恢复动作及终点数量守恒。页面、PDA、打印和性能由当前 Playwright 门禁交叉验证。

|场景|状态|独立步骤|独立断言|单场景收据|
|---|---|---:|---:|---|
${rows}

总收据：[29 场景独立执行](evidence/2026-09-23-scenario-independent-current.json)；综合门禁：[当前验收摘要](evidence/2026-09-23-current-acceptance.json)；性能：[${performance.sampleCount} 个原始样本](evidence/2026-09-23-tmf-complete-performance.json)，最大 ${performance.maxMilliseconds}ms，失败 0。
`

writeFileSync(coverageMarkdownPath, markdown)
console.log(`覆盖台账已更新：${coverage.passed}/${coverage.total}，性能最大 ${performance.maxMilliseconds}ms`)
