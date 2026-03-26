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

function walk(dir) {
  const result = []
  for (const entry of readdirSync(dir)) {
    const filePath = path.join(dir, entry)
    const stat = statSync(filePath)
    if (stat.isDirectory()) {
      result.push(...walk(filePath))
      continue
    }
    if (filePath.endsWith('.ts')) result.push(filePath)
  }
  return result
}

const files = walk(ROOT).filter((filePath) => TARGET_FILE_PATTERNS.some((pattern) => filePath.includes(pattern)))

const findings = []

for (const file of files) {
  const source = readFileSync(file, 'utf8')
  const lines = source.split('\n')

  const closeActions = [...source.matchAll(/closeAction:\s*'([a-z0-9-]+)'/g)].map((item) => item[1])
  const handledActions = new Set([
    ...[...source.matchAll(/action === '([a-z0-9-]+)'/g)].map((item) => item[1]),
    ...[...source.matchAll(/case '([a-z0-9-]+)'/g)].map((item) => item[1]),
  ])

  for (const actionName of new Set(closeActions)) {
    if (!handledActions.has(actionName)) {
      findings.push({
        file: path.relative(process.cwd(), file),
        kind: 'missing-handler',
        text: `未发现关闭动作处理分支：${actionName}`,
      })
    }
  }

  lines.forEach((line, index) => {
    if (!/data-[a-z0-9-]+-action=/.test(line)) return
    if (line.includes('disabled') || line.includes('pointer-events-none') || line.includes('opacity-50')) {
      findings.push({
        file: path.relative(process.cwd(), file),
        line: index + 1,
        kind: 'suspicious-disabled-action',
        text: line.trim(),
      })
    }
  })
}

if (!findings.length) {
  console.log('FCS action check passed: no suspicious unhandled or disabled action hotspots found.')
  process.exit(0)
}

console.log('FCS action check found suspicious hotspots:')
for (const item of findings) {
  const location = item.line ? `${item.file}:${item.line}` : item.file
  console.log(`${location} [${item.kind}] ${item.text}`)
}
process.exit(1)
