#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'

const repoRoot = process.cwd()

function abs(rel: string): string {
  return path.join(repoRoot, rel)
}

function read(rel: string): string {
  return fs.readFileSync(abs(rel), 'utf8')
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function listTsFiles(rootDir: string): string[] {
  const result: string[] = []
  function walk(currentDir: string): void {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const next = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        walk(next)
        continue
      }
      if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        result.push(next)
      }
    }
  }
  walk(abs(rootDir))
  return result
}

function assertFileMissing(rel: string): void {
  assert(!fs.existsSync(abs(rel)), `${rel} 应已删除`) 
}

function assertNoStringInSrc(value: string): void {
  for (const file of listTsFiles('src')) {
    const source = fs.readFileSync(file, 'utf8')
    assert(!source.includes(value), `${path.relative(repoRoot, file)} 仍残留旧字符串：${value}`)
  }
}

function assertDomainBoundary(): void {
  for (const file of listTsFiles('src/domain')) {
    const source = fs.readFileSync(file, 'utf8')
    assert(!source.includes('/pages/'), `${path.relative(repoRoot, file)} 不应 import src/pages/**`)
    assert(!source.includes('../pages/'), `${path.relative(repoRoot, file)} 不应反向依赖 src/pages/**`)
    assert(!source.includes('../../pages/'), `${path.relative(repoRoot, file)} 不应反向依赖 src/pages/**`)
    assert(!source.includes('../../../pages/'), `${path.relative(repoRoot, file)} 不应反向依赖 src/pages/**`)
    assert(!source.includes('localStorage'), `${path.relative(repoRoot, file)} 不应直读 localStorage`)
    assert(!source.includes('sessionStorage'), `${path.relative(repoRoot, file)} 不应直读 sessionStorage`)
  }
}

function assertLegacyAnchorsRetired(): void {
  assert(!read('src/pages/pda-cutting-nav-context.ts').includes("params.set('cutPieceOrderNo'"), 'pda-cutting-nav-context.ts 不应继续写出 legacy cutPieceOrderNo')
  assert(!read('src/pages/pda-cutting-nav-context.ts').includes("params.set('focusCutPieceOrderNo'"), 'pda-cutting-nav-context.ts 不应继续写出 legacy focusCutPieceOrderNo')
  assert(!read('src/data/fcs/pda-cutting-execution-source.ts').includes("params.set('cutPieceOrderNo'"), 'pda-cutting-execution-source.ts 不应继续写出 legacy cutPieceOrderNo')

  const mainPages = [
    'src/pages/process-factory/cutting/production-progress.ts',
    'src/pages/process-factory/cutting/original-orders.ts',
    'src/pages/process-factory/cutting/cuttable-pool.ts',
    'src/pages/process-factory/cutting/merge-batches.ts',
    'src/pages/process-factory/cutting/fei-tickets.ts',
    'src/pages/process-factory/cutting/transfer-bags.ts',
  ]
  mainPages.forEach((file) => {
    const source = read(file)
    assert(!source.includes('data-row-index'), `${file} 不应继续使用旧 row index 作为正式锚点`)
  })
}

function assertLegacySourcesRetired(): void {
  const srcFiles = listTsFiles('src')
  const forbiddenImports = [
    'pda-cutting-special',
    'pda-execution-writeback-model',
    'pda-writeback-model',
    'fcs-cutting-runtime/sources',
    'cutting-identity',
  ]
  for (const file of srcFiles) {
    const source = fs.readFileSync(file, 'utf8')
    for (const value of forbiddenImports) {
      assert(!source.includes(value), `${path.relative(repoRoot, file)} 仍残留旧实现引用：${value}`)
    }
  }
}

function assertSpreadingAndPdaFormalCutover(): void {
  const appShell = read('src/data/app-shell-config.ts')
  const meta = read('src/pages/process-factory/cutting/meta.ts')
  const routes = read('src/router/routes.ts')
  const pdaSource = read('src/data/fcs/pda-cutting-execution-source.ts')
  const pdaTaskHelpers = read('src/pages/pda-cutting-task-detail-helpers.ts')

  assert(appShell.includes("title: '铺布列表'"), 'app-shell-config.ts 缺少铺布列表菜单')
  assert(appShell.includes("title: '补料管理'"), 'app-shell-config.ts 缺少补料管理菜单')
  assert(appShell.includes("title: '裁后处理'"), 'app-shell-config.ts 缺少裁后处理组')
  assert(meta.includes("canonicalPath: '/fcs/craft/cutting/spreading-list'"), 'meta.ts 缺少 canonical spreading-list')
  assert(meta.includes("canonicalPath: '/fcs/craft/cutting/spreading-create'"), 'meta.ts 缺少 canonical spreading-create')
  assert(routes.includes("'/fcs/craft/cutting/spreading-list': () => renderCraftCuttingSpreadingListPage()"), 'routes.ts 未接 canonical spreading-list renderer')
  assert(routes.includes("'/fcs/craft/cutting/spreading-create': () => renderCraftCuttingSpreadingCreatePage()"), 'routes.ts 未接 canonical spreading-create renderer')
  assert(!pdaSource.includes("targetType: 'context'"), 'pda-cutting-execution-source.ts 不应残留 context 型铺布目标')
  assert(pdaSource.includes('primaryExecutionRouteKey'), 'pda-cutting-execution-source.ts 缺少 primaryExecutionRouteKey')
  assert(pdaSource.includes('FOLD_NORMAL') && pdaSource.includes('FOLD_HIGH_LOW'), 'pda-cutting-execution-source.ts 缺少 4 模式铺布 token')
  assert(!pdaTaskHelpers.includes('resolveRouteFromNextAction'), 'pda-cutting-task-detail-helpers.ts 不应再按 nextActionLabel 猜主动作路由')
}

function assertReadinessGatesExpanded(): void {
  const releaseAcceptance = read('tests/cutting-release-acceptance.spec.ts')
  const releaseReadiness = read('scripts/check-cutting-release-readiness.ts')

  assert(releaseAcceptance.includes('裁后处理'), 'release acceptance 应显式覆盖裁后处理 IA')
  assert(releaseAcceptance.includes("countViewportRows(page, 'marker-plan-list-table')"), 'release acceptance 应覆盖唛架列表低分辨率')
  assert(releaseAcceptance.includes("countViewportRows(page, 'cutting-spreading-list-table')"), 'release acceptance 应覆盖铺布列表低分辨率')
  assert(releaseAcceptance.includes("expectVisibleInViewport(page, page.getByRole('button', { name: '保存铺布记录' }))"), 'release acceptance 应覆盖 PDA 保存按钮首屏')
  assert(releaseReadiness.includes('scripts/check-cutting-low-res-density.ts'), 'release readiness 总入口未纳入低分辨率检查')
  assert(releaseReadiness.includes('scripts/check-cutting-flow-matrix.ts'), 'release readiness 总入口未纳入流程矩阵检查')
}

function assertUnifiedScriptEntrypoints(): void {
  const packageJson = read('package.json')
  assert(packageJson.includes('"check:cutting:cleanup"'), 'package.json 缺少统一最终清理检查入口')
  assert(packageJson.includes('"test:cutting-final-cleanup:e2e"'), 'package.json 缺少最终 Playwright 收口验收入口')
}

function runScript(rel: string): void {
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--experimental-specifier-resolution=node', rel], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error(`${rel} 执行失败\n${result.stdout || ''}${result.stderr || ''}`.trim())
  }
}

function main(): void {
  const deletedFiles = [
    'src/pages/process-factory/cutting/order-progress.ts',
    'src/pages/process-factory/cutting/order-progress.helpers.ts',
    'src/pages/process-factory/cutting/cut-piece-orders.ts',
    'src/pages/process-factory/cutting/cut-piece-orders.helpers.ts',
    'src/pages/process-factory/cutting/warehouse-management.ts',
    'src/pages/process-factory/cutting/warehouse-management.helpers.ts',
    'src/domain/cutting-identity/index.ts',
    'src/domain/fcs-cutting-runtime/sources.ts',
    'src/data/fcs/pda-cutting-special.ts',
    'src/pages/process-factory/cutting/pda-execution-writeback-model.ts',
    'src/pages/process-factory/cutting/pda-writeback-model.ts',
  ]
  deletedFiles.forEach(assertFileMissing)

  ;[
    'PRODUCTION_ORDER_NO_ALIASES',
    'PDA_CUTTING_TASK_IDENTITY_SEEDS',
    'forceReleased',
    'go-order-progress',
    'go-cut-piece-orders',
    'go-warehouse-management',
    'operatorAccountId = operatorName',
    'buildFcsCuttingRuntimeSources',
    'buildFcsCuttingRuntimeSummaryResult',
    'buildFcsCuttingRuntimeDetailData',
  ].forEach(assertNoStringInSrc)

  assertDomainBoundary()
  assertLegacyAnchorsRetired()
  assertLegacySourcesRetired()
  assertSpreadingAndPdaFormalCutover()
  assertReadinessGatesExpanded()
  assertUnifiedScriptEntrypoints()

  const scripts = [
    'scripts/check-cutting-entry-cleanup.ts',
    'scripts/check-cutting-core-identity.ts',
    'scripts/check-fcs-upstream-cutting-chain.ts',
    'scripts/check-cutting-runtime-boundary.ts',
    'scripts/check-cutting-main-pages-cutover.ts',
    'scripts/check-cutting-execution-prep-chain.ts',
    'scripts/check-cutting-pda-projection-writeback.ts',
    'scripts/check-cutting-traceability-chain.ts',
    'scripts/check-cutting-low-res-density.ts',
    'scripts/check-cutting-flow-matrix.ts',
  ]
  scripts.forEach(runScript)

  console.log(JSON.stringify({
    旧文件退场: '通过',
    旧关键字符串退场: '通过',
    domain边界收口: '通过',
    legacy主锚点退场: '通过',
    旧平行宇宙退场: '通过',
    铺布与PDA正式入口收口: '通过',
    统一脚本入口存在: '通过',
    分步检查脚本联跑: '通过',
  }, null, 2))
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
