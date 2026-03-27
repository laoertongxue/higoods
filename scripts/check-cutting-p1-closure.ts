#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const repoRoot = process.cwd()

function abs(rel: string): string {
  return path.join(repoRoot, rel)
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function read(rel: string): string {
  return fs.readFileSync(abs(rel), 'utf8')
}

function assertFileExists(rel: string): void {
  assert(fs.existsSync(abs(rel)), `${rel} 缺失`)
}

function assertNoMatch(rel: string, pattern: RegExp, message: string): void {
  const source = read(rel)
  assert(!pattern.test(source), `${rel} ${message}`)
}

function assertIncludes(rel: string, text: string, message: string): void {
  const source = read(rel)
  assert(source.includes(text), `${rel} ${message}`)
}

function assertCuttingRuntimeInputsDetachedFromPages(): void {
  const file = 'src/data/fcs/cutting/runtime-inputs.ts'
  assertNoMatch(
    file,
    /from ['"].*src\/pages\/process-factory\/cutting\/.*-model\.ts['"]|from ['"].*\.\.\/\.\.\/\.\.\/pages\/process-factory\/cutting\/.*-model\.ts['"]/,
    '仍在依赖 pages model 的 schema / deserialize',
  )
}

function assertInternalSemanticResidueRetired(): void {
  const files = [
    'src/pages/process-factory/cutting/meta.ts',
    'src/router/routes.ts',
    'src/state/store.ts',
  ]
  const banned = [
    '裁片后续管理',
    '旧仓库入口兼容页',
    'CUTTING_COMPAT_TAB_REDIRECTS',
    'migrateCuttingCompatTabs',
    'LEGACY_CUTTING_TAB_REDIRECTS',
    'migrateLegacyCuttingTabs',
    '旧仓务入口',
  ]
  files.forEach((file) => {
    const source = read(file)
    banned.forEach((token) => {
      assert(!source.includes(token), `${file} 仍残留已废弃旧语义：${token}`)
    })
  })
}

function assertTraceabilityCanonicalized(): void {
  assertFileExists('src/data/fcs/cutting/transfer-bag-legacy-normalizer.ts')

  const canonicalFiles = [
    'src/data/fcs/cutting/transfer-bag-runtime.ts',
    'src/pages/process-factory/cutting/transfer-bags-model.ts',
    'src/pages/process-factory/cutting/transfer-bag-return-model.ts',
    'src/pages/process-factory/cutting/traceability-projection-helpers.ts',
    'src/pages/process-factory/cutting/transfer-bags-projection.ts',
  ]

  const bannedSnippets = [
    'carrierId ||',
    'cycleId ||',
    'feiTicketId ||',
    '|| item.bagId',
    '|| item.usageId',
    '|| binding.ticketRecordId',
    '|| binding.bagId',
    '|| usage.bagId',
    '|| usage.usageId',
  ]

  canonicalFiles.forEach((file) => {
    const source = read(file)
    bannedSnippets.forEach((snippet) => {
      assert(!source.includes(snippet), `${file} 仍残留 dual-field fallback：${snippet}`)
    })
  })

  assertIncludes(
    'src/pages/process-factory/cutting/transfer-bags-model.ts',
    "normalizeTransferCarrierRecord",
    '未接 traceability legacy normalizer',
  )
  assertIncludes(
    'src/pages/process-factory/cutting/transfer-bag-return-model.ts',
    'cycleId',
    '未体现 canonical cycleId 字段',
  )
}

function assertPdaFormalSourceSlimmed(): void {
  assertFileExists('src/data/fcs/pda-cutting-legacy-compat.ts')

  const sourceFile = 'src/data/fcs/pda-cutting-execution-source.ts'
  const source = read(sourceFile)
  const cutPieceOrderNoMatches = source.match(/cutPieceOrderNo/g) || []
  assert(
    cutPieceOrderNoMatches.length <= 2,
    `${sourceFile} 中 legacy cutPieceOrderNo 仍在正式 source 里扩散（当前 ${cutPieceOrderNoMatches.length} 处）`,
  )

  ;[
    'legacyCutPieceOrderNo',
    'defaultCutPieceOrderNo',
    'currentSelectedCutPieceOrderNo',
    'defaultExecCutPieceOrderNo',
  ].forEach((token) => {
    assert(!source.includes(token), `${sourceFile} 仍残留旧 generic task shell 字段：${token}`)
  })

  const pageFiles = [
    'src/pages/pda-cutting-task-detail.ts',
    'src/pages/pda-cutting-pickup.ts',
    'src/pages/pda-cutting-spreading.ts',
    'src/pages/pda-cutting-inbound.ts',
    'src/pages/pda-cutting-handover.ts',
    'src/pages/pda-cutting-replenishment-feedback.ts',
    'src/pages/pda-cutting-context.ts',
  ]

  pageFiles.forEach((file) => {
    const pageSource = read(file)
    assert(!pageSource.includes('selectedCutPieceOrder'), `${file} 仍保留正式页面 context alias：selectedCutPieceOrder*`)
  })
}

function main(): void {
  assertCuttingRuntimeInputsDetachedFromPages()
  assertInternalSemanticResidueRetired()
  assertTraceabilityCanonicalized()
  assertPdaFormalSourceSlimmed()

  console.log(
    JSON.stringify(
      {
        dataAdapter分层收口: '通过',
        内部旧语义残留清理: '通过',
        traceability正式字段收口: '通过',
        PDAformalSource再压薄: '通过',
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
