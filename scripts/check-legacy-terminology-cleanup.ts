#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

type MatchRecord = {
  file: string
  line: number
  term: string
  content: string
}

type ScanMode = 'source' | 'guardrail' | 'page-visible'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

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
  ['领料', '头'].join(''),
  ['交出', '头'].join(''),
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

const TASK_PRINT_VISIBLE_FILES = [
  'src/pages/print/task-route-card.ts',
  'src/pages/print/task-delivery-card.ts',
  'src/pages/progress-board/task-domain.ts',
  'src/pages/progress-board/events.ts',
  'src/pages/progress-handover.ts',
  'src/pages/process-factory/printing/work-orders.ts',
  'src/pages/process-factory/dyeing/work-orders.ts',
  'src/pages/process-factory/special-craft/task-orders.ts',
  'src/pages/process-factory/special-craft/task-detail.ts',
  'src/pages/process-factory/special-craft/warehouse.ts',
  'src/pages/process-factory/cutting/original-orders.ts',
  'src/pages/process-factory/cutting/merge-batches.ts',
]

const TASK_PRINT_VISIBLE_BANNED_TERMS = [
  ['随货', '交接标签'].join(''),
  ['随', '货单'].join(''),
  ['交接', '唛'].join(''),
  ['箱', '唛'].join(''),
  ['工艺', '流转卡'].join(''),
  ['生产', '流程卡'].join(''),
  ['作业', '流转卡'].join(''),
  'QR payload',
]

const SOURCE_ALLOWED_PATTERNS: Array<{ file: string; allow: RegExp }> = [
  { file: 'src/state/store.ts', allow: /'\S+':\s*'预结算流水'|'\S+':\s*'预付款批次'|^[^']*应付调整:\s*'预结算流水'|^[^']*结算批次:\s*'预付款批次'/ },
  { file: 'src/data/fcs/quality-deduction-domain.ts', allow: /兼容保留|当前主链不再/ },
]

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function resolveRepoPath(file: string): string {
  return path.join(ROOT, file)
}

function normalizeRepoRelative(file: string): string {
  return file.split(path.sep).join('/')
}

function existingPaths(paths: string[]): string[] {
  return paths.filter((item) => fs.existsSync(resolveRepoPath(item)))
}

function listDirectoryFiles(relativeDir: string, predicate: (name: string) => boolean): string[] {
  const absoluteDir = resolveRepoPath(relativeDir)
  if (!fs.existsSync(absoluteDir)) return []
  return fs
    .readdirSync(absoluteDir)
    .filter((name) => predicate(name))
    .map((name) => normalizeRepoRelative(path.join(relativeDir, name)))
}

const SCRIPT_AND_TEST_FILES = [
  ...listDirectoryFiles('scripts', (name) => /^check-.*\.(ts|mjs)$/.test(name)),
  ...listDirectoryFiles('tests', (name) => /^fcs-.*\.spec\.ts$/.test(name)),
].filter((file) => file !== 'scripts/check-legacy-terminology-cleanup.ts')

function shouldAllowSourceMatch(file: string, lineText: string): boolean {
  return SOURCE_ALLOWED_PATTERNS.some((item) => item.file === file && item.allow.test(lineText))
}

function isGuardrailAssertion(file: string, lines: string[], index: number): boolean {
  const lineText = lines[index] || ''
  const nearby = lines.slice(Math.max(0, index - 15), Math.min(lines.length, index + 8)).join('\n')
  return (
    (file.startsWith('scripts/check-') && /^\s*['"`][^'"`]+['"`],?\s*$/.test(lineText)) ||
    lineText.includes('assert(!') ||
    lineText.includes('assertNotIncludes(') ||
    lineText.includes('.not.toContain(') ||
    lineText.includes('.not.toContainText(') ||
    lineText.includes('.not.toMatch(') ||
    lineText.includes('BANNED_TERMS') ||
    lineText.includes('PAGE_VISIBLE_BANNED_TERMS') ||
    /\b(banned|legacy|forbidden|deprecated)Terms?\b/i.test(nearby) ||
    /const\s+\w+(Terms|Tokens)\s*=\s*\[/i.test(nearby) ||
    /forEach\(\(token\)/.test(nearby) ||
    (/^\s*['"`][^'"`]+['"`],?\s*$/.test(lineText) &&
      /(assertNotIncludes|assert\(!|\.not\.toContain|\.not\.toContainText|\.not\.toMatch|forEach\(\(token\)|banned|legacy|forbidden|deprecated|const\s+\w+(Terms|Tokens)\s*=\s*\[)/i.test(nearby))
  )
}

function collectMatches(files: string[], terms: string[], mode: ScanMode): MatchRecord[] {
  const matches: MatchRecord[] = []
  for (const file of files) {
    const absolutePath = resolveRepoPath(file)
    if (!fs.existsSync(absolutePath)) continue
    const source = fs.readFileSync(absolutePath, 'utf8')
    const lines = source.split('\n')
    lines.forEach((lineText, index) => {
      for (const term of terms) {
        if (!lineText.includes(term)) continue
        if (mode === 'source' && shouldAllowSourceMatch(file, lineText)) continue
        if (mode === 'guardrail' && isGuardrailAssertion(file, lines, index)) continue
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

function walkFiles(rootDir: string, allowPattern = /\.(ts|tsx|js|jsx|mjs)$/): string[] {
  const absoluteRoot = resolveRepoPath(rootDir)
  if (!fs.existsSync(absoluteRoot)) return []
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
      if (allowPattern.test(entry.name)) {
        results.push(normalizeRepoRelative(path.relative(ROOT, next)))
      }
    }
  }
  return results.sort()
}

function main(): void {
  const pageVisibleFiles = [...walkFiles('src/pages'), ...walkFiles('src/components')]
  const docsFiles = walkFiles('docs', /\.(md|mdx|txt|ts|tsx|js|jsx|mjs)$/)
  const sourceMatches = collectMatches(SOURCE_FILES, BANNED_TERMS, 'source')
  const guardrailMatches = collectMatches(SCRIPT_AND_TEST_FILES, BANNED_TERMS, 'guardrail')
  const guardrailPageVisibleMatches = collectMatches(SCRIPT_AND_TEST_FILES, PAGE_VISIBLE_BANNED_TERMS, 'guardrail')
  const pageVisibleMatches = collectMatches([...pageVisibleFiles, ...docsFiles], PAGE_VISIBLE_BANNED_TERMS, 'page-visible')
  const taskPrintVisibleMatches = collectMatches(TASK_PRINT_VISIBLE_FILES, TASK_PRINT_VISIBLE_BANNED_TERMS, 'page-visible')
  const allMatches = [...sourceMatches, ...guardrailMatches, ...guardrailPageVisibleMatches, ...pageVisibleMatches, ...taskPrintVisibleMatches]

  assert(allMatches.length === 0, `当前结算主链仍残留旧口径：${allMatches[0]?.file}:${allMatches[0]?.line} ${allMatches[0]?.term}`)

  console.log(
    JSON.stringify(
      {
        校验范围文件数: SOURCE_FILES.length + SCRIPT_AND_TEST_FILES.length + pageVisibleFiles.length + docsFiles.length,
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
