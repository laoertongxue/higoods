import { existsSync, readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import {
  validatePrototypeReviewCoverage,
  type ReviewRecordSource,
} from './workflow-governance/prototype-review.ts'
import {
  getChangedPaths,
  getStagedChangedPaths,
} from './workflow-governance/changed-paths.ts'

const LEGACY_DESIGN_GUIDELINES = 'docs/higood-indonesia-factory-product-design-guidelines.md'
const LEGACY_REVIEW_CHECKLIST = 'docs/higood-indonesia-factory-prototype-review-checklist.md'
const REVIEW_TEMPLATE = 'docs/prototype-review-record-template.md'
const REVIEW_RECORD_DIR = 'docs/prototype-review-records/'
const AGENTS = 'AGENTS.md'

const PROTOTYPE_PREFIXES = [
  'src/pages/',
  'src/components/',
  'src/data/',
  'src/router/',
  'src/main-handlers/',
]

const GOVERNANCE_PATHS = new Set([
  AGENTS,
  LEGACY_DESIGN_GUIDELINES,
  LEGACY_REVIEW_CHECKLIST,
  REVIEW_TEMPLATE,
  'scripts/check-prototype-design-governance.ts',
  'scripts/workflow-governance/prototype-review.ts',
  'tests/workflow-governance/prototype-review.test.ts',
  '.agents/skills/higood-indonesia-factory-design/SKILL.md',
  'package.json',
])

function normalizePath(path: string): string {
  return path.replace(/^\.\//, '').trim()
}

function isPrototypePath(path: string): boolean {
  const normalized = normalizePath(path)
  if (GOVERNANCE_PATHS.has(normalized)) return false
  if (normalized.startsWith(REVIEW_RECORD_DIR)) return false
  return PROTOTYPE_PREFIXES.some((prefix) => normalized.startsWith(prefix))
}

function isReviewRecordPath(path: string): boolean {
  const normalized = normalizePath(path)
  return normalized.startsWith(REVIEW_RECORD_DIR) && normalized.endsWith('.md')
}

function getGovernanceChangedPaths(mode: 'staged' | 'all', base?: string): string[] {
  if (mode === 'all') return getChangedPaths({ base })
  return getStagedChangedPaths()
}

function assertFileExists(path: string): void {
  assert(existsSync(path), `缺少必要治理文件：${path}`)
}

function assertAgentsContract(): void {
  const source = readFileSync(AGENTS, 'utf8')
  for (const token of [
    REVIEW_TEMPLATE,
    '用户可见影响',
    '无用户可见影响',
    'npm run check:prototype-design-governance',
    '款式与物料真实图片硬门禁',
  ]) {
    assert(source.includes(token), `AGENTS.md 缺少治理契约：${token}`)
  }
}

function runSelfTest(): void {
  assert.equal(isPrototypePath('src/pages/pda-exec.ts'), true)
  assert.equal(isPrototypePath('src/components/ui/button.ts'), true)
  assert.equal(isPrototypePath('src/data/fcs/store-domain-pda.ts'), true)
  assert.equal(isPrototypePath('docs/higood-indonesia-factory-product-design-guidelines.md'), false)
  assert.equal(isPrototypePath('docs/prototype-review-records/2026-07-03-pda.md'), false)
  assert.equal(isReviewRecordPath('docs/prototype-review-records/2026-07-03-pda.md'), true)
  assert.equal(isReviewRecordPath('docs/prototype-review-records/.gitkeep'), false)
  assertAgentsContract()
}

function main(): void {
  const args = new Set(process.argv.slice(2))
  if (args.has('--self-test')) {
    runSelfTest()
    console.log('prototype design governance self-test passed')
    return
  }

  for (const path of [REVIEW_TEMPLATE, AGENTS]) assertFileExists(path)
  assertAgentsContract()

  const mode = args.has('--all') ? 'all' : 'staged'
  const baseIndex = process.argv.indexOf('--base')
  const base = baseIndex >= 0 ? process.argv[baseIndex + 1] : process.env.GOVERNANCE_BASE_SHA
  const changedPaths = getGovernanceChangedPaths(mode, base)
  const prototypeChanges = changedPaths.filter(isPrototypePath)
  if (prototypeChanges.length === 0) {
    console.log(`prototype design governance passed (${mode}): no governed prototype changes`)
    return
  }

  const recordSources = changedPaths
    .filter(isReviewRecordPath)
    .filter((path) => existsSync(path))
    .map<ReviewRecordSource>((path) => ({ path, source: readFileSync(path, 'utf8') }))
  const result = validatePrototypeReviewCoverage(prototypeChanges, recordSources)

  console.log(
    `prototype design governance passed (${mode}): `
    + `${result.userVisiblePaths.length} user-visible file(s), `
    + `${result.technicalOnlyPaths.length} technical-only file(s), `
    + `${result.recordPaths.length} linked governance record(s)`,
  )
}

main()
