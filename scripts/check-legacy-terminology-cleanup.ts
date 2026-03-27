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
    lineText.includes('.not.toMatch(')
  )
}

function collectMatches(files: string[], mode: 'source' | 'guardrail'): MatchRecord[] {
  const matches: MatchRecord[] = []
  for (const file of files) {
    const absolutePath = path.resolve(file)
    const source = fs.readFileSync(absolutePath, 'utf8')
    const lines = source.split('\n')
    lines.forEach((lineText, index) => {
      for (const term of BANNED_TERMS) {
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

function main(): void {
  const sourceMatches = collectMatches(SOURCE_FILES, 'source')
  const guardrailMatches = collectMatches(SCRIPT_AND_TEST_FILES, 'guardrail')
  const allMatches = [...sourceMatches, ...guardrailMatches]

  assert(allMatches.length === 0, `当前结算主链仍残留旧口径：${allMatches[0]?.file}:${allMatches[0]?.line} ${allMatches[0]?.term}`)

  console.log(
    JSON.stringify(
      {
        校验范围文件数: SOURCE_FILES.length + SCRIPT_AND_TEST_FILES.length,
        旧口径命中数: 0,
        说明: '当前结算主链页面、数据层、检查脚本与 Playwright 用例仅通过负向断言保留旧词守卫。',
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
