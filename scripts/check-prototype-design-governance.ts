import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const DESIGN_GUIDELINES = 'docs/higood-indonesia-factory-product-design-guidelines.md'
const REVIEW_CHECKLIST = 'docs/higood-indonesia-factory-prototype-review-checklist.md'
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
  DESIGN_GUIDELINES,
  REVIEW_CHECKLIST,
  REVIEW_TEMPLATE,
  'scripts/check-prototype-design-governance.ts',
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

function getChangedPaths(mode: 'staged' | 'all'): string[] {
  const args =
    mode === 'staged'
      ? ['diff', '--cached', '--name-only', '--diff-filter=ACMRTUXB']
      : ['status', '--porcelain']
  const output = execFileSync('git', args, { encoding: 'utf8' })
  if (mode === 'staged') {
    return output.split('\n').map(normalizePath).filter(Boolean)
  }
  return output
    .split('\n')
    .map((line) => normalizePath(line.slice(3)))
    .filter(Boolean)
}

function assertFileExists(path: string): void {
  assert(existsSync(path), `缺少必要治理文件：${path}`)
}

function assertAgentsReferences(): void {
  const source = readFileSync(AGENTS, 'utf8')
  for (const path of [DESIGN_GUIDELINES, REVIEW_CHECKLIST, REVIEW_TEMPLATE]) {
    assert(source.includes(path), `AGENTS.md 未引用：${path}`)
  }
  assert(
    source.includes('npm run check:prototype-design-governance'),
    'AGENTS.md 未要求运行 check:prototype-design-governance',
  )
}

function runSelfTest(): void {
  assert.equal(isPrototypePath('src/pages/pda-exec.ts'), true)
  assert.equal(isPrototypePath('src/components/ui/button.ts'), true)
  assert.equal(isPrototypePath('src/data/fcs/store-domain-pda.ts'), true)
  assert.equal(isPrototypePath('docs/higood-indonesia-factory-product-design-guidelines.md'), false)
  assert.equal(isPrototypePath('docs/prototype-review-records/2026-07-03-pda.md'), false)
  assert.equal(isReviewRecordPath('docs/prototype-review-records/2026-07-03-pda.md'), true)
  assert.equal(isReviewRecordPath('docs/prototype-review-records/.gitkeep'), false)
}

function main(): void {
  const args = new Set(process.argv.slice(2))
  if (args.has('--self-test')) {
    runSelfTest()
    console.log('prototype design governance self-test passed')
    return
  }

  for (const path of [DESIGN_GUIDELINES, REVIEW_CHECKLIST, REVIEW_TEMPLATE, AGENTS]) {
    assertFileExists(path)
  }
  assertAgentsReferences()

  const mode = args.has('--all') ? 'all' : 'staged'
  const changedPaths = getChangedPaths(mode)
  const prototypeChanges = changedPaths.filter(isPrototypePath)
  if (prototypeChanges.length === 0) {
    console.log(`prototype design governance passed (${mode}): no prototype changes`)
    return
  }

  const hasReviewRecord = changedPaths.some(isReviewRecordPath)
  assert(
    hasReviewRecord,
    [
      `检测到原型相关改动，但未发现 ${REVIEW_RECORD_DIR} 下的审查记录。`,
      '请复制 docs/prototype-review-record-template.md 填写审查记录后再提交。',
      '涉及文件：',
      ...prototypeChanges.map((path) => `- ${path}`),
    ].join('\n'),
  )

  console.log(`prototype design governance passed (${mode}): review record found`)
}

main()
