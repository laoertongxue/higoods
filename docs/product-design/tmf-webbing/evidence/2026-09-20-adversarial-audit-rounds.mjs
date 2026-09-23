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
check('R1-MATRIX-ATOMIC-165', rows.length === 165, `rows=${rows.length}`)
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
const scenarioReceiptIndex = JSON.parse(read(path.join(root, 'evidence/2026-09-23-scenario-independent-current.json')))
check('R1-MOCK-SCENARIO-ORACLE-EXECUTION', scenarioReceiptIndex.total === 29 && scenarioReceiptIndex.failed === 0 && scenarioReceiptIndex.passed === 29, JSON.stringify({ total: scenarioReceiptIndex.total, passed: scenarioReceiptIndex.passed, failed: scenarioReceiptIndex.failed }))
check('R1-INDEPENDENT-SCENARIO-RECEIPTS', scenarioReceiptIndex.receipts.every(r => r.pass && r.steps >= 7 && r.assertions >= 9 && r.file.startsWith('evidence/scenarios-20260923/')), `receipts=${scenarioReceiptIndex.total}`)
const fullPerf = JSON.parse(read(path.join(root, 'evidence/2026-09-23-tmf-complete-performance.json')))
check('R1-FULL-PERFORMANCE-APPLICABLE', fullPerf.passed === true && fullPerf.failed === 0 && fullPerf.sampleCount >= 350 && fullPerf.maxMilliseconds < 500, JSON.stringify({ samples: fullPerf.sampleCount, failed: fullPerf.failed, maxMs: fullPerf.maxMilliseconds }))
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
const reverseManifestPath = path.join(root, 'evidence/2026-09-20-reverse-file-scope-manifest.json')
const reverseManifest = JSON.parse(read(reverseManifestPath))
const manifestMissing = governed.filter(f => !reverseManifest.entries?.some(e => e.path === f && (e.requirementIds?.length || e.reason)))
const governedSet = new Set(governed)
const manifestPaths = new Set((reverseManifest.entries || []).map(entry => entry.path))
const manifestStale = (reverseManifest.entries || []).filter(entry => !governedSet.has(entry.path))
const mappedFiles = (reverseManifest.entries || []).filter(entry => entry.requirementIds?.length).length
const excludedFiles = (reverseManifest.entries || []).filter(entry => !entry.requirementIds?.length && entry.reason).length
check('R2-REVERSE-GOVERNED-FILES', manifestMissing.length === 0, `${manifestMissing.length} governed files lack requirement IDs or explicit out-of-scope reason; mapped=${mappedFiles}; excluded=${excludedFiles}`)
check('R2-REVERSE-MANIFEST-EXACT', manifestPaths.size === governedSet.size && manifestStale.length === 0, `governed=${governedSet.size}; manifest=${manifestPaths.size}; stale=${manifestStale.length}`)
const routeTokens = [...plan.matchAll(/`(\/[^`]+)`/g)].map(m => m[1]).filter(x => /tmf|webbing|rope|production|pda|print/i.test(x))
const missingRoutes = routeTokens.filter(r => !matrixText.includes(r) && !plan.includes(r))
check('R2-PLAN-ROUTE-TRACE', missingRoutes.length === 0, `unbound route tokens=${missingRoutes.length}`)
const unitLog = path.join(root, 'evidence/2026-09-23-tmf-unit-current.log')
check('R2-CONTRACT-LOG', fs.existsSync(unitLog) && /tests 418/i.test(read(unitLog)) && /pass 418/i.test(read(unitLog)) && /fail 0/i.test(read(unitLog)), 'current 418-test receipt missing or failed')
const connectedListSpec = path.join(repo, 'tests/tmf-webbing-connected-lists.spec.ts')
const completePerfSpec = path.join(repo, 'tests/tmf-webbing-complete-performance.spec.ts')
check('R2-CURRENT-BROWSER-SPECS', fs.existsSync(connectedListSpec) && fs.existsSync(completePerfSpec), 'current connected-list or complete-performance spec missing')
check('R2-CURRENT-PDA-PRINT-COVERAGE', /PDA 织带厂执行/.test(read(completePerfSpec)) && /织带加工明细打印/.test(read(completePerfSpec)), 'current PDA or print acceptance missing')
const receiptFiles = scenarioReceiptIndex.receipts.map(item => item.file)
check('R2-SCENARIO-INDEPENDENT-EVIDENCE', new Set(receiptFiles).size === 29 && receiptFiles.every(file => fs.existsSync(path.join(root, file))), `${new Set(receiptFiles).size}/29 distinct receipt files exist`)

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
