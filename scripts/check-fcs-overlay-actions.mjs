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
]

const ACTION_DISABLE_PATTERN = /\sdisabled(?:\s|>|=)|pointer-events-none|opacity-50|cursor-not-allowed/
const PAGINATION_ACTIONS = new Set(['prev-page', 'next-page', 'orders-prev-page', 'orders-next-page'])

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

function collectHandledActions(source) {
  return new Set([
    ...[...source.matchAll(/action === '([a-z0-9-]+)'/g)].map((item) => item[1]),
    ...[...source.matchAll(/case '([a-z0-9-]+)'/g)].map((item) => item[1]),
  ])
}

function collectCloseActions(source) {
  const results = []
  for (const match of source.matchAll(/closeAction:\s*\{[^}]*action:\s*'([a-z0-9-]+)'/g)) {
    results.push(match[1])
  }
  return results
}

function collectSuspiciousDisabledActions(lines) {
  const findings = []
  for (let index = 0; index < lines.length; index += 1) {
    if (!/data-[a-z0-9-]+-action=/.test(lines[index])) continue
    const windowText = lines.slice(index, index + 4).join('\n')
    const actionMatch = windowText.match(/data-[a-z0-9-]+-action="([a-z0-9-]+)"/)
    const actionName = actionMatch?.[1]
    if (actionName && PAGINATION_ACTIONS.has(actionName)) continue
    if (windowText.includes('aria-disabled=')) continue
    if (ACTION_DISABLE_PATTERN.test(windowText)) {
      findings.push({ line: index + 1, text: windowText.trim() })
    }
  }
  return findings
}

const findings = []

for (const file of walk(ROOT)) {
  const source = readFileSync(file, 'utf8')
  const lines = source.split('\n')
  const handledActions = collectHandledActions(source)

  for (const actionName of new Set(collectCloseActions(source))) {
    if (!handledActions.has(actionName)) {
      findings.push({
        file: path.relative(process.cwd(), file),
        kind: 'missing-close-handler',
        text: `未发现关闭动作处理分支：${actionName}`,
      })
    }
  }

  for (const item of collectSuspiciousDisabledActions(lines)) {
    findings.push({
      file: path.relative(process.cwd(), file),
      line: item.line,
      kind: 'disabled-action-hotspot',
      text: item.text,
    })
  }
}

if (!findings.length) {
  console.log('FCS overlay/action check passed: no suspicious close-action or dead-button hotspots found.')
  process.exit(0)
}

console.log('FCS overlay/action check found suspicious hotspots:')
for (const item of findings) {
  const location = item.line ? `${item.file}:${item.line}` : item.file
  console.log(`${location} [${item.kind}] ${item.text}`)
}
process.exit(1)
