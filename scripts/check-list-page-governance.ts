import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

export type PagePattern = 'list' | 'detail' | 'form' | 'dashboard' | 'pda'

const ROOT = resolve(new URL('..', import.meta.url).pathname)
const PAGE_ROOT = join(ROOT, 'src/pages')
const BASELINE_PATH = join(ROOT, 'scripts/standard-list-page-baseline.json')
const STANDARD_LIST_CONTRACT = [
  'renderStandardListPage',
  'renderStandardListTable',
  'renderTablePagination',
]
const PAGE_PATTERN = /@page-pattern:\s*(list|detail|form|dashboard|pda)\b/
const LIST_SIGNALS = [/<table\b/i, /render(?:Standard)?List/i, /renderTablePagination/i, /data-[\w-]*(?:list|table)/i]

export function parsePagePattern(source: string): PagePattern | null {
  const match = PAGE_PATTERN.exec(source)
  return match ? match[1] as PagePattern : null
}

export function isListCandidate(source: string): boolean {
  const pattern = parsePagePattern(source)
  if (pattern && pattern !== 'list') return false
  if (pattern === 'list') return true
  return LIST_SIGNALS.filter((signal) => signal.test(source)).length >= 2
}

export function hasStandardListContract(source: string): boolean {
  return STANDARD_LIST_CONTRACT.every((symbol) => source.includes(symbol))
}

export function sha256(source: string): string {
  return createHash('sha256').update(source).digest('hex')
}

export function validateBaselineIntegrity(
  current: Record<string, string>,
  base: Record<string, string> | null,
): void {
  if (base === null) return
  for (const [path, hash] of Object.entries(current)) {
    assert(Object.hasOwn(base, path), `基线不得新增页面：${path}`)
    assert.equal(hash, base[path], `基线哈希不得修改：${path}`)
  }
}

function listFiles(directory: string): string[] {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return listFiles(path)
    return entry.isFile() && entry.name.endsWith('.ts') ? [path] : []
  })
}

function readJson(path: string): Record<string, string> {
  if (!existsSync(path)) return {}
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown
  assert(parsed && typeof parsed === 'object' && !Array.isArray(parsed), `${path} 必须是对象`)
  for (const [key, value] of Object.entries(parsed)) {
    assert(/^src\/pages\/.*\.ts$/.test(key), `基线路径必须位于 src/pages：${key}`)
    assert(typeof value === 'string' && /^[a-f0-9]{64}$/.test(value), `基线哈希格式错误：${key}`)
  }
  return parsed as Record<string, string>
}

function readBaseBaseline(baseSha: string | undefined): Record<string, string> | null {
  if (!baseSha) return null
  try {
    const source = execFileSync('git', ['show', `${baseSha}:scripts/standard-list-page-baseline.json`], { encoding: 'utf8' })
    return JSON.parse(source) as Record<string, string>
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('does not exist in') || message.includes('exists on disk, but not in')) return null
    throw error
  }
}

function changedPagePaths(): { added: Set<string>; changed: Set<string> } {
  let output = ''
  try {
    output = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' })
  } catch {
    return { added: new Set(), changed: new Set() }
  }
  const added = new Set<string>()
  const changed = new Set<string>()
  for (const line of output.split('\n').filter(Boolean)) {
    const path = line.slice(3).trim()
    if (!path.startsWith('src/pages/') || !path.endsWith('.ts')) continue
    changed.add(path)
    if (line[0] === '?' || line[0] === 'A') added.add(path)
  }
  return { added, changed }
}

function assertPage(path: string, source: string, baseline: Record<string, string>, changed: Set<string>, added: Set<string>): void {
  const pattern = parsePagePattern(source)
  const candidate = isListCandidate(source)
  const hash = sha256(source)
  const baselineHash = baseline[path]

  if (added.has(path) && !pattern) {
    throw new Error(`${path} 是新增页面，必须声明 @page-pattern: list|detail|form|dashboard|pda`)
  }
  if (!candidate && pattern !== 'list') return
  if (pattern === 'list' && !hasStandardListContract(source)) {
    throw new Error(`${path} 声明为列表页，但未完整使用标准列表骨架、表格和分页组件`)
  }
  if (pattern !== 'list') {
    if (baselineHash === hash && !changed.has(path)) return
    if (baselineHash === hash) return
    throw new Error(`${path} 是列表候选页，请添加 @page-pattern: list 并迁移到标准列表组件`)
  }
}

function writeBaseline(): void {
  assert(!existsSync(BASELINE_PATH), '已有历史基线，禁止覆盖生成；页面迁移后只能删除对应项')
  const baseline: Record<string, string> = {}
  for (const absolutePath of listFiles(PAGE_ROOT)) {
    const path = relative(ROOT, absolutePath)
    const source = readFileSync(absolutePath, 'utf8')
    if (isListCandidate(source) && parsePagePattern(source) !== 'list') baseline[path] = sha256(source)
  }
  writeFileSync(BASELINE_PATH, `${JSON.stringify(Object.fromEntries(Object.entries(baseline).sort()), null, 2)}\n`)
  console.log(`standard list page baseline written: ${Object.keys(baseline).length} pages`)
}

function runSelfTest(): void {
  assert.equal(parsePagePattern('// @page-pattern: list'), 'list')
  assert.equal(parsePagePattern('// @page-pattern: detail'), 'detail')
  assert.equal(parsePagePattern('// @page-pattern: unknown'), null)
  assert.equal(isListCandidate('<table><tbody></tbody></table> renderTablePagination'), true)
  assert.equal(hasStandardListContract('renderStandardListPage renderStandardListTable renderTablePagination'), true)
  assert.equal(hasStandardListContract('renderTable(<tbody>)'), false)
  assert.throws(() => validateBaselineIntegrity({ 'src/pages/old.ts': 'a'.repeat(64) }, { 'src/pages/old.ts': 'b'.repeat(64) }))
  assert.throws(() => validateBaselineIntegrity({ 'src/pages/new.ts': 'a'.repeat(64) }, {}))
  assert.doesNotThrow(() => validateBaselineIntegrity({}, { 'src/pages/migrated.ts': 'a'.repeat(64) }))
  assert.throws(
    () => assertPage('src/pages/new-list.ts', '<table></table> renderTablePagination', {}, new Set(['src/pages/new-list.ts']), new Set(['src/pages/new-list.ts'])),
    /必须声明 @page-pattern/,
  )
  assert.throws(
    () => assertPage('src/pages/marked-list.ts', '// @page-pattern: list', {}, new Set(['src/pages/marked-list.ts']), new Set(['src/pages/marked-list.ts'])),
    /未完整使用标准列表骨架/,
  )
  assert.doesNotThrow(
    () => assertPage('src/pages/detail.ts', '// @page-pattern: detail <table></table>', {}, new Set(['src/pages/detail.ts']), new Set(['src/pages/detail.ts'])),
  )
  const workflow = readFileSync(join(ROOT, '.github/workflows/list-page-governance.yml'), 'utf8')
  assert.match(workflow, /name:\s+list-page-governance/)
  assert.match(workflow, /pull_request:/)
  assert.match(workflow, /branches:\s*\n\s*- main/)
  assert.match(workflow, /GOVERNANCE_BASE_SHA:/)
  assert.match(workflow, /npm run check:list-page-governance/)
  console.log('list page governance self-test passed')
}

function main(): void {
  const args = new Set(process.argv.slice(2))
  if (args.has('--self-test')) return runSelfTest()
  if (args.has('--write-baseline')) return writeBaseline()

  const baseline = readJson(BASELINE_PATH)
  validateBaselineIntegrity(baseline, readBaseBaseline(process.env.GOVERNANCE_BASE_SHA))
  const paths = listFiles(PAGE_ROOT)
  const { added, changed } = changedPagePaths()
  for (const absolutePath of paths) {
    const path = relative(ROOT, absolutePath)
    assertPage(path, readFileSync(absolutePath, 'utf8'), baseline, changed, added)
  }
  for (const path of Object.keys(baseline)) {
    assert(existsSync(join(ROOT, path)), `基线页面不存在：${path}`)
  }
  console.log(`list page governance passed: scanned ${paths.length} pages, baseline ${Object.keys(baseline).length}`)
}

main()
