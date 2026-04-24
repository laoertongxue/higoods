#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function listTsFiles(rootDir: string): string[] {
  const result: string[] = []

  function walk(currentDir: string): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const nextPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        walk(nextPath)
        continue
      }
      if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        result.push(nextPath)
      }
    }
  }

  walk(path.resolve(rootDir))
  return result
}

function assertNoPageImports(rootDir: string): void {
  const files = listTsFiles(rootDir)
  files.forEach((filePath) => {
    const source = fs.readFileSync(filePath, 'utf8')
    assert(!source.includes('/pages/'), `${path.relative(repoRoot, filePath)} 不应 import src/pages/**`)
    assert(!source.includes('../pages/'), `${path.relative(repoRoot, filePath)} 不应反向依赖 src/pages/**`)
    assert(!source.includes('../../pages/'), `${path.relative(repoRoot, filePath)} 不应反向依赖 src/pages/**`)
    assert(!source.includes('../../../pages/'), `${path.relative(repoRoot, filePath)} 不应反向依赖 src/pages/**`)
  })
}

function assertDomainDoesNotReadBrowserStorage(): void {
  listTsFiles('src/domain').forEach((filePath) => {
    const source = fs.readFileSync(filePath, 'utf8')
    assert(!source.includes('localStorage'), `${path.relative(repoRoot, filePath)} 不应直读 localStorage`)
    assert(!source.includes('sessionStorage'), `${path.relative(repoRoot, filePath)} 不应直读 sessionStorage`)
  })
}

function assertLegacyRuntimeFunctionsRetired(): void {
  assert(!fs.existsSync(path.resolve('src/domain/fcs-cutting-runtime/sources.ts')), '旧 src/domain/fcs-cutting-runtime/sources.ts 应已退场')

  const runtimeFiles = [
    ...listTsFiles('src/domain/fcs-cutting-runtime'),
    ...listTsFiles('src/domain/cutting-platform'),
  ]

  runtimeFiles.forEach((filePath) => {
    const source = fs.readFileSync(filePath, 'utf8')
    assert(
      !source.includes('buildFcsCuttingRuntimeSources'),
      `${path.relative(repoRoot, filePath)} 仍残留旧 buildFcsCuttingRuntimeSources`,
    )
    assert(
      !source.includes('buildFcsCuttingRuntimeSummaryResult'),
      `${path.relative(repoRoot, filePath)} 仍残留旧 buildFcsCuttingRuntimeSummaryResult`,
    )
    assert(
      !source.includes('buildFcsCuttingRuntimeDetailData'),
      `${path.relative(repoRoot, filePath)} 仍残留旧 buildFcsCuttingRuntimeDetailData`,
    )
    assert(!source.includes('readStorageItem'), `${path.relative(repoRoot, filePath)} 仍残留旧 runtime storage helper`)
  })
}

function assertSnapshotBuilderExists(): void {
  const content = readRepoFile('src/domain/fcs-cutting-runtime/domain-snapshot.ts')
  const barrel = readRepoFile('src/domain/fcs-cutting-runtime/index.ts')
  assert(content.includes('export function buildFcsCuttingDomainSnapshot'), '缺少 buildFcsCuttingDomainSnapshot')
  assert(barrel.includes("export * from './domain-snapshot.ts'"), 'fcs-cutting-runtime/index.ts 应导出 domain-snapshot')
  assert(!content.includes('/pages/'), 'domain-snapshot.ts 不应依赖 src/pages/**')
  assert(!content.includes('localStorage'), 'domain-snapshot.ts 不应直读 localStorage')
  assert(!content.includes('sessionStorage'), 'domain-snapshot.ts 不应直读 sessionStorage')
}

function assertConsumersUseNewChain(): void {
  const summaryPage = readRepoFile('src/pages/process-factory/cutting/cutting-summary.ts')
  const overviewAdapter = readRepoFile('src/domain/cutting-platform/overview.adapter.ts')
  const detailAdapter = readRepoFile('src/domain/cutting-platform/detail.adapter.ts')

  assert(!summaryPage.includes('fcs-cutting-runtime/sources'), 'cutting-summary.ts 不应继续依赖旧 runtime sources')
  assert(
    summaryPage.includes("from './runtime-projections'") || summaryPage.includes("from './runtime-projections.ts'"),
    'cutting-summary.ts 应改为消费 runtime projections',
  )

  assert(!overviewAdapter.includes('fcs-cutting-runtime/sources'), 'overview.adapter.ts 不应继续依赖旧 runtime sources')
  assert(overviewAdapter.includes('buildFcsCuttingDomainSnapshot'), 'overview.adapter.ts 应直接消费 domain snapshot')

  assert(!detailAdapter.includes('fcs-cutting-runtime/sources'), 'detail.adapter.ts 不应继续依赖旧 runtime sources')
  assert(detailAdapter.includes('buildPlatformCuttingRuntimeOverviewData'), 'detail.adapter.ts 应通过新 projection 链获取详情数据')
}

function assertNoObviousDeadHelpers(): void {
  const runtimeProjection = readRepoFile('src/pages/process-factory/cutting/runtime-projections.ts')
  assert(!runtimeProjection.includes('function toGeneratedLineFallback'), 'runtime-projections.ts 仍残留未使用旧 helper')
}

function main(): void {
  assertNoPageImports('src/domain/fcs-cutting-runtime')
  assertNoPageImports('src/domain/cutting-platform')
  assertDomainDoesNotReadBrowserStorage()
  assertLegacyRuntimeFunctionsRetired()
  assertSnapshotBuilderExists()
  assertConsumersUseNewChain()
  assertNoObviousDeadHelpers()

  console.log(
    JSON.stringify(
      {
        runtimeDomain不反向依赖pages: '通过',
        domain不直读storage: '通过',
        旧runtime反向聚合已退场: '通过',
        snapshotBuilder存在且已导出: '通过',
        summary与platform已切新链: '通过',
        旧helper清理: '通过',
      },
      null,
      2,
    ),
  )
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
