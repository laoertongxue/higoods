import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const repo = process.cwd()
const root = path.join(repo, 'docs/product-design/tmf-webbing')
const matrixPath = path.join(root, '需求追踪矩阵.md')
const mockPath = path.join(root, 'mock-full-flow.json')
const coveragePath = path.join(root, '规范场景验收覆盖.json')
const planPath = path.join(root, '织带厂管理产品方案.md')

const read = file => fs.readFileSync(file, 'utf8')
const rel = file => path.relative(repo, file)
const failures = []
const warnings = []
const checks = []
const check = (name, ok, detail) => {
  checks.push({ name, ok, detail })
  if (!ok) failures.push({ name, detail })
  return ok
}

const matrix = read(matrixPath)
const mock = JSON.parse(read(mockPath))
const coverage = JSON.parse(read(coveragePath))
const plan = read(planPath)

function parseRows() {
  return matrix.split('\n').filter(line => /^\| [A-Z][A-Z0-9-]+ \|/.test(line)).map(line => {
    const cells = line.split('|').slice(1, -1).map(x => x.trim())
    return { id: cells[0], text: line, status: cells[7], evidence: cells[8], implementation: cells[4] }
  })
}

const rows = parseRows()
const scenarios = [...mock.normalScenarios, ...mock.boundaryScenarios]

// Round 1: forward trace from plan/fixture -> matrix -> implementation/evidence.
check('R1-PLAN-EXISTS', fs.existsSync(planPath), rel(planPath))
check('R1-MATRIX-ATOMIC-127', rows.length === 127, `rows=${rows.length}`)
check('R1-MATRIX-UNIQUE', new Set(rows.map(r => r.id)).size === rows.length, 'duplicate atomic ids')
check('R1-MATRIX-STATUSES', rows.every(r => ['待实施','实施中','已实现待验证','已验证','已阻塞','不适用'].includes(r.status)), 'invalid status')
check('R1-MATRIX-EVIDENCE-PATHS', rows.every(r => [...r.evidence.matchAll(/(?:^|[：；，、 ])((?:evidence|src|tests|docs)\/[^；，、。和及 )`]+(?:\.json|\.log|\.mjs|\.ts|\.md))/g)].every(m => fs.existsSync(path.join(root, m[1])) || fs.existsSync(path.join(repo, m[1])))), 'missing referenced evidence')
const staleRows = rows.filter(r => r.status === '已验证' && /未完成|未验证|待验证|尚未|仍需|待绑定|全链.*未|性能.*未|不能标|不能据此/.test(r.evidence))
check('R1-NO-STale-CLAIMS-IN-VERIFIED-ROWS', staleRows.length === 0, `${staleRows.length} verified rows still contain unfinished wording: ${staleRows.slice(0,8).map(r=>r.id).join(',')}`)
check('R1-MOCK-NORMAL-5', mock.normalScenarios.length === 5, String(mock.normalScenarios.length))
check('R1-MOCK-BOUNDARY-24', mock.boundaryScenarios.length === 24, String(mock.boundaryScenarios.length))
check('R1-MOCK-IDS-UNIQUE', new Set(scenarios.map(s => s.id)).size === 29, 'scenario ids')
check('R1-MOCK-NORMAL-FINALS', mock.normalScenarios.every(s => s.steps?.length >= 6 && s.expectedFinal && s.route?.length >= 5), 'normal scenario shape')
check('R1-MOCK-BOUNDARY-ORACLES', mock.boundaryScenarios.every(s => s.expected && s.recoveryAndFinal && s.numericalOracle && s.checkAtEveryStep), 'boundary oracle shape')
const coverageIds = new Set((coverage.scenarios || []).map(s => s.id))
check('R1-COVERAGE-29-IDS', scenarios.every(s => coverageIds.has(s.id)) && coverageIds.size === 29, `coverage=${coverageIds.size}`)
const weakCoverage = (coverage.scenarios || []).filter(s => !s.evidence?.length || s.remaining !== '')
check('R1-COVERAGE-NONEMPTY', weakCoverage.length === 0, `${weakCoverage.length} scenarios lack evidence or have remaining work`)
const fullFlowPath = path.join(root, 'evidence/2026-09-20-upstream-sources-full-flow.json')
const fullFlow = JSON.parse(read(fullFlowPath))
check('R1-FULLFLOW-NO-ERRORS', (fullFlow.errors || []).length === 0, `errors=${(fullFlow.errors || []).length}`)
check('R1-FULLFLOW-STEP-EVIDENCE', (fullFlow.checks || []).length >= 16, `checks=${(fullFlow.checks || []).length}`)
const mockValidatorPath = path.join(root, 'evidence/2026-09-20-full-mock-scenario-validator-current.json')
const mockValidator = JSON.parse(read(mockValidatorPath))
check('R1-MOCK-SCENARIO-ORACLE-EXECUTION', mockValidator.summary?.scenarioCount === 29 && mockValidator.summary?.failed === 0 && mockValidator.summary?.passed === mockValidator.summary?.checks, JSON.stringify(mockValidator.summary))
const scenarioReceiptIndex = JSON.parse(read(path.join(root, 'evidence/2026-09-20-scenario-receipts-index.json')))
check('R1-INDEPENDENT-SCENARIO-RECEIPTS', scenarioReceiptIndex.total === 29 && scenarioReceiptIndex.receipts.every(r => r.failed === 0 && r.path.startsWith('evidence/scenarios/')), `receipts=${scenarioReceiptIndex.total}`)
const fullPerf = JSON.parse(read(path.join(root, 'evidence/2026-09-20-tmf-perf-full-preview-current.json')))
check('R1-FULL-PERFORMANCE-APPLICABLE', fullPerf.summary?.failed === 0 && fullPerf.summary?.errors === 0 && fullPerf.summary?.total >= 100, JSON.stringify(fullPerf.summary))
const evidenceText = fs.readdirSync(path.join(root, 'evidence')).filter(f => fs.statSync(path.join(root,'evidence',f)).isFile()).map(f => read(path.join(root,'evidence',f))).join('\n')
for (const s of scenarios) {
  const occurrences = (evidenceText.match(new RegExp(`\\b${s.id}\\b`, 'g')) || []).length
  check(`R1-SCENARIO-${s.id}-EVIDENCE`, occurrences >= 2, `occurrences=${occurrences}`)
}

// Round 2: reverse trace from governed code/evidence -> matrix and executable checks.
const governed = []
for (const dir of ['src/pages','src/data','src/router','tests/unit']) {
  const base = path.join(repo, dir)
  if (!fs.existsSync(base)) continue
  const walk = d => fs.readdirSync(d, { withFileTypes:true }).flatMap(e => e.isDirectory() ? walk(path.join(d,e.name)) : [path.join(d,e.name)])
  for (const file of walk(base)) {
    const text = read(file)
    if (/TMF|tmf|织带|绳子|webbing|rope/i.test(text)) governed.push(rel(file))
  }
}
const matrixText = matrix
const unbound = governed.filter(f => !matrixText.includes(f))
const reverseManifestPath = path.join(root, 'evidence/2026-09-20-reverse-file-scope-manifest.json')
const reverseManifest = JSON.parse(read(reverseManifestPath))
const manifestMissing = governed.filter(f => !reverseManifest.entries?.some(e => e.path === f && (e.requirementIds?.length || e.reason)))
check('R2-REVERSE-GOVERNED-FILES', manifestMissing.length === 0, `${manifestMissing.length} governed files lack requirement IDs or explicit out-of-scope reason; matrix-only gaps=${unbound.length}`)
const routeTokens = [...plan.matchAll(/`(\/[^`]+)`/g)].map(m => m[1]).filter(x => /tmf|webbing|rope|production|pda|print/i.test(x))
const missingRoutes = routeTokens.filter(r => !matrixText.includes(r) && !plan.includes(r))
check('R2-PLAN-ROUTE-TRACE', missingRoutes.length === 0, `unbound route tokens=${missingRoutes.length}`)
const contractLog = path.join(root, 'evidence/2026-09-20-scenario-audit-contracts.log')
check('R2-CONTRACT-LOG', fs.existsSync(contractLog) && /pass 53/i.test(read(contractLog)), 'scenario contract log missing or not pass')
const mockAuditLog = path.join(root, 'evidence/2026-09-20-tmf-full-flow-mock-audit-current.log')
check('R2-MOCK-AUDIT-LOG', fs.existsSync(mockAuditLog) && /tests: 63/i.test(read(mockAuditLog)) && /fail: 0/i.test(read(mockAuditLog)), 'runtime mock audit log missing')
const browserJsons = fs.readdirSync(path.join(root,'evidence')).filter(f => f.endsWith('-browser.json'))
const badBrowser = browserJsons.filter(f => { try { const j=JSON.parse(read(path.join(root,'evidence',f))); return (j.errors?.length||0)>0 || j.pass===false } catch { return true } })
check('R2-BROWSER-EVIDENCE-ERRORS', badBrowser.length === 0, `${badBrowser.length} browser evidence files have errors: ${badBrowser.slice(0,8).join(',')}`)
const weakScenarioReceipts = (coverage.scenarios || []).filter(s => s.evidence?.every(e => e.path.endsWith('upstream-sources-full-flow.json') || e.path.endsWith('normative-N02-N04-results.json')))
check('R2-SCENARIO-INDEPENDENT-EVIDENCE', weakScenarioReceipts.length === 0, `${weakScenarioReceipts.length} scenarios only point at shared receipts`)

const result = {
  generatedAt: new Date().toISOString(),
  branch: execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),
  head: execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  rounds: [
    { name:'第一轮：正向追踪（方案/Mock→矩阵→实现/证据）', checks: checks.filter(c=>c.name.startsWith('R1-')) },
    { name:'第二轮：反向追踪（代码/证据→矩阵/方案）', checks: checks.filter(c=>c.name.startsWith('R2-')) }
  ],
  summary: { total: checks.length, passed: checks.filter(c=>c.ok).length, failed: failures.length, matrixStatuses: Object.fromEntries([...new Set(rows.map(r=>r.status))].map(status=>[status,rows.filter(r=>r.status===status).length])) },
  failures,
  warnings: [...warnings],
  scenarioCounts: { normal: mock.normalScenarios.length, boundary: mock.boundaryScenarios.length, total: scenarios.length },
  verdict: failures.length ? '未通过：不能宣称产品方案及需求矩阵全部验证通过' : '通过'
}
const out = path.join(root, 'evidence/2026-09-20-adversarial-audit-rounds-current.json')
fs.writeFileSync(out, JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify(result.summary))
for (const f of failures) console.log(`FAIL ${f.name}: ${f.detail}`)
