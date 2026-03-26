import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(process.cwd(), 'src', 'pages')
const TARGET_FILE_PATTERNS = [
  `${path.sep}process-factory${path.sep}`,
  `${path.sep}progress-cutting-`,
  `${path.sep}progress-handover`,
  `${path.sep}progress-urge.ts`,
  `${path.sep}settlement-cutting-input.ts`,
  `${path.sep}pda-cutting-`,
  `${path.sep}pda-cutting-shared.ts`,
  `${path.sep}pda-shell.ts`,
  `${path.sep}placeholder.ts`,
  `${path.sep}trace.ts`,
]

const BANNED_COPY_PATTERN = /收口|二维码|扫码|同一码|去处理|去建议页面|去对应页面|查看收口/
const ENGLISH_LITERAL_PATTERN = /\b(?:usageNo|usage|bagCode|bagType|dispatchAt|ticketNo|scope|execution|followup)\b/

const IGNORE_LINE_PATTERNS = [
  /^\s*import /,
  /^\s*export type /,
  /^\s*type /,
  /^\s*interface /,
  /^\s*export interface /,
  /^\s*\/\/ /,
  /replaceAll\(/,
  /if \(value ===/,
  /dataset\./,
]

const IGNORE_LITERALS = new Set(['待扫码回写', '待扫码领取', '扫码领取成功'])

function walk(dir) {
  const result = []
  for (const entry of readdirSync(dir)) {
    const filePath = path.join(dir, entry)
    const stat = statSync(filePath)
    if (stat.isDirectory()) {
      result.push(...walk(filePath))
      continue
    }
    if (filePath.endsWith('.ts') && TARGET_FILE_PATTERNS.some((pattern) => filePath.includes(pattern))) {
      result.push(filePath)
    }
  }
  return result
}

function extractStringLiterals(line) {
  return [...line.matchAll(/'([^'\n]+)'|"([^"\n]+)"/g)]
    .map((item) => item[1] || item[2] || '')
    .filter(Boolean)
}

const findings = []

for (const file of walk(ROOT)) {
  const source = readFileSync(file, 'utf8')
  const lines = source.split('\n')

  lines.forEach((line, index) => {
    if (IGNORE_LINE_PATTERNS.some((pattern) => pattern.test(line))) return

    const literals = extractStringLiterals(line)
    literals.forEach((literal) => {
      if (IGNORE_LITERALS.has(literal)) return
      if (/^[a-z][a-zA-Z0-9.-]*$/.test(literal)) return
      if (literal.includes('${') || literal.includes('data-')) return
      if (BANNED_COPY_PATTERN.test(literal)) {
        findings.push({
          file: path.relative(process.cwd(), file),
          line: index + 1,
          kind: '旧词残留',
          text: literal,
        })
        return
      }
      if (ENGLISH_LITERAL_PATTERN.test(literal) && !/^[A-Z0-9_:-]+$/.test(literal)) {
        findings.push({
          file: path.relative(process.cwd(), file),
          line: index + 1,
          kind: '英文可见字面量',
          text: literal,
        })
      }
    })
  })
}

if (!findings.length) {
  console.log('FCS copy check passed: no suspicious visible-copy literals found.')
  process.exit(0)
}

console.log('FCS copy check found suspicious visible-copy literals:')
for (const item of findings) {
  console.log(`${item.file}:${item.line} [${item.kind}] ${item.text}`)
}
process.exit(1)
