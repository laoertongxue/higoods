import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
import { validatePrototypeReviewCoverage, type ReviewRecordSource } from './workflow-governance/prototype-review.ts'
import { isPrototypePath, isReviewRecordPath, resolveGovernanceScope, reportGovernanceScope, type GovernanceScope } from './workflow-governance/governance-scope.ts'

function assertAgentsContract(source: string | null): void {
  assert(source, '所选版本缺少 AGENTS.md')
  for (const token of ['docs/prototype-review-record-template.md', 'REVIEW-01', 'PERF-01', 'IMAGE-01', '轻量可见变更', '无用户可见影响']) {
    assert(source.includes(token), 'AGENTS.md 缺少治理契约：' + token)
  }
}

export function checkPrototypeGovernance(scope: GovernanceScope): void {
  const prototypeChanges = scope.paths.filter(isPrototypePath)
  if (prototypeChanges.length === 0) {
    console.log('prototype design governance: no governed product changes in selected ' + scope.kind + ' scope (not product acceptance)')
    return
  }
  assertAgentsContract(scope.readText('AGENTS.md'))
  assert(scope.readText('docs/prototype-review-record-template.md'), '所选版本缺少审查记录模板')
  const records: ReviewRecordSource[] = scope.paths.filter(isReviewRecordPath).flatMap((path) => {
    const source = scope.readText(path)
    return source === null ? [] : [{ path, source }]
  })
  const result = validatePrototypeReviewCoverage(prototypeChanges, records)
  console.log('prototype design governance passed: ' + JSON.stringify(result))
}

function main(): void {
  const args = process.argv.slice(2)
  if (args.length === 1 && args[0] === '--self-test') {
    for (const path of ['src/main.ts', 'src/state/example.ts', 'src/domain/example.ts', 'src/styles.css', 'src/utils/example.ts', 'index.html']) assert(isPrototypePath(path))
    assert(!isPrototypePath('docs/example.md'))
    assert(isReviewRecordPath('docs/prototype-review-records/example.md'))
    assertAgentsContract(readFileSync('AGENTS.md', 'utf8'))
    console.log('prototype design governance self-test passed')
    return
  }
  const scope = resolveGovernanceScope(args)
  reportGovernanceScope(scope)
  checkPrototypeGovernance(scope)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
