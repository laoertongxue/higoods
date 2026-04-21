#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

type MatchRecord = {
  file: string
  line: number
  term: string
  content: string
}

type ScanMode = 'source' | 'guardrail' | 'page-visible'

const SOURCE_FILES = [
  'src/data/app-shell-config.ts',
  'src/router/routes.ts',
  'src/state/store.ts',
  'src/pages/adjustments.ts',
  'src/pages/statements.ts',
  'src/pages/batches.ts',
  'src/pages/payment-sync.ts',
  'src/pages/history.ts',
  'src/pages/qc-records.ts',
  'src/pages/qc-records/detail-domain.ts',
  'src/pages/deduction-analysis.ts',
  'src/pages/pda-quality.ts',
  'src/pages/pda-settlement.ts',
  'src/data/fcs/quality-deduction-domain.ts',
  'src/data/fcs/quality-deduction-repository.ts',
  'src/data/fcs/quality-deduction-selectors.ts',
  'src/data/fcs/quality-deduction-analysis.ts',
  'src/data/fcs/quality-deduction-shared-facts.ts',
  'src/data/fcs/return-inbound-quality-chain-facts.ts',
  'src/data/fcs/pre-settlement-ledger-repository.ts',
  'src/data/fcs/store-domain-settlement-types.ts',
  'src/data/fcs/store-domain-statement-source-adapter.ts',
  'src/data/fcs/store-domain-settlement-seeds.ts',
  'src/data/fcs/settlement-linked-mock-factory.ts',
  'src/data/fcs/settlement-flow-boundaries.ts',
  'src/data/fcs/settlement-change-requests.ts',
  'src/data/fcs/settlement-types.ts',
  'src/data/fcs/settlement-mock-data.ts',
  'src/data/fcs/store-domain-quality-seeds.ts',
]

const SCRIPT_AND_TEST_FILES = [
  ...fs.readdirSync(new URL('../scripts', import.meta.url)).filter((name) => /^check-.*\.(ts|mjs)$/.test(name)).map((name) => `scripts/${name}`),
  ...fs.readdirSync(new URL('../tests', import.meta.url)).filter((name) => /^fcs-.*\.spec\.ts$/.test(name)).map((name) => `tests/${name}`),
].filter((file) => file !== 'scripts/check-legacy-terminology-cleanup.ts')

const BANNED_TERMS = [
  '应付调整',
  '下周期调整',
  '冲回',
  '回货净额行',
  '其它调整',
  '其它扣款',
  '结算批次',
  '摘要',
  'settlement adjustment',
  'net line',
  'reversal',
]

const PAGE_VISIBLE_BANNED_TERMS = [
  '去交接（待交出）',
  '去交接',
  '交出头',
  '仓库自动回写',
  '工厂只查看',
  '仓库确认',
  '后道仓一体',
  '车缝直接回成衣仓',
  '印花 PDA',
  '染色 PDA',
  '印花PDA',
  '染色PDA',
  'PDA质检',
  'PDA裁床',
  'PDA领料',
  'PDA配料',
  'PDA 质检',
  'PDA 裁床',
  'PDA 领料',
  'PDA 配料',
  'PDA 执行',
  '查看 PDA',
  'PDA任务号',
]

const SOURCE_ALLOWED_PATTERNS: Array<{ file: string; allow: RegExp }> = [
  { file: 'src/state/store.ts', allow: /'\S+':\s*'预结算流水'|'\S+':\s*'预付款批次'|^[^']*应付调整:\s*'预结算流水'|^[^']*结算批次:\s*'预付款批次'/ },
  { file: 'src/data/fcs/quality-deduction-domain.ts', allow: /兼容保留|当前主链不再/ },
]

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function shouldAllowSourceMatch(file: string, lineText: string): boolean {
  return SOURCE_ALLOWED_PATTERNS.some((item) => item.file === file && item.allow.test(lineText))
}

function isGuardrailAssertion(lineText: string): boolean {
  return (
    lineText.includes('assert(!') ||
    lineText.includes('.not.toContain(') ||
    lineText.includes('.not.toContainText(') ||
    lineText.includes('.not.toMatch(') ||
    lineText.includes('BANNED_TERMS') ||
    lineText.includes('PAGE_VISIBLE_BANNED_TERMS')
  )
}

function collectMatches(files: string[], terms: string[], mode: ScanMode): MatchRecord[] {
  const matches: MatchRecord[] = []
  for (const file of files) {
    const absolutePath = path.resolve(file)
    const source = fs.readFileSync(absolutePath, 'utf8')
    const lines = source.split('\n')
    lines.forEach((lineText, index) => {
      for (const term of terms) {
        if (!lineText.includes(term)) continue
        if (mode === 'source' && shouldAllowSourceMatch(file, lineText)) continue
        if (mode === 'guardrail' && isGuardrailAssertion(lineText)) continue
        matches.push({
          file,
          line: index + 1,
          term,
          content: lineText.trim(),
        })
      }
    })
  }
  return matches
}

function walkFiles(rootDir: string): string[] {
  const absoluteRoot = path.resolve(rootDir)
  const results: string[] = []
  const queue = [absoluteRoot]
  while (queue.length > 0) {
    const current = queue.pop()
    if (!current) continue
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const next = path.join(current, entry.name)
      if (entry.isDirectory()) {
        queue.push(next)
        continue
      }
      if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) {
        results.push(path.relative(path.resolve('.'), next))
      }
    }
  }
  return results.sort()
}

function main(): void {
  const pageVisibleFiles = [...walkFiles('src/pages'), ...walkFiles('src/components')]
  const sourceMatches = collectMatches(SOURCE_FILES, BANNED_TERMS, 'source')
  const guardrailMatches = collectMatches(SCRIPT_AND_TEST_FILES, BANNED_TERMS, 'guardrail')
  const pageVisibleMatches = collectMatches(pageVisibleFiles, PAGE_VISIBLE_BANNED_TERMS, 'page-visible')
  const allMatches = [...sourceMatches, ...guardrailMatches, ...pageVisibleMatches]

  assert(allMatches.length === 0, `当前结算主链仍残留旧口径：${allMatches[0]?.file}:${allMatches[0]?.line} ${allMatches[0]?.term}`)

  console.log(
    JSON.stringify(
      {
        校验范围文件数: SOURCE_FILES.length + SCRIPT_AND_TEST_FILES.length + pageVisibleFiles.length,
        旧口径命中数: 0,
        说明: '当前结算主链、FCS 页面和检查脚本仅通过负向断言保留旧词守卫。',
      },
      null,
      2,
    ),
  )
}

try {
  main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
}
