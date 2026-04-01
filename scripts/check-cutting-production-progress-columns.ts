import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const sourcePath = path.join(
  repoRoot,
  'src/pages/process-factory/cutting/production-progress.ts',
)

const expectedHeaders = [
  '紧急程度',
  '生产单号',
  '款号 / SPU',
  '下单件数',
  '计划发货日期',
  '配料进展',
  '领料进展',
  '原始裁片单数',
  '当前进展',
  '部位差异',
  '风险提示',
  '操作',
] as const

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function extractHeaderConfig(source: string): string[] {
  const match = source.match(/const PRODUCTION_PROGRESS_TABLE_HEADERS = \[([\s\S]*?)\] as const/)
  assert(match, '未找到 PRODUCTION_PROGRESS_TABLE_HEADERS 配置')
  return [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1])
}

function extractRenderTableSection(source: string): string {
  const start = source.indexOf('function renderTable(rows: ProductionProgressRow[]): string {')
  const end = source.indexOf('function renderDetailDrawer(): string {')
  assert(start >= 0 && end > start, '未找到 renderTable 函数边界')
  return source.slice(start, end)
}

function countBodyColumns(renderTableSection: string): number {
  const rowMatch = renderTableSection.match(
    /<tr class="border-b last:border-b-0 align-top hover:bg-muted\/20">([\s\S]*?)<\/tr>/,
  )
  assert(rowMatch, '未找到生产单主表首条数据行模板')
  return [...rowMatch[1].matchAll(/<td\b/g)].length
}

function extractEmptyColspan(renderTableSection: string): number {
  const colspanMatch = renderTableSection.match(/colspan="\$\{columnCount\}"|colspan="(\d+)"/)
  assert(colspanMatch, '未找到生产单主表空状态 colspan')
  if (colspanMatch[0] === 'colspan="${columnCount}"') {
    return expectedHeaders.length
  }
  return Number(colspanMatch[1])
}

function main(): void {
  const source = fs.readFileSync(sourcePath, 'utf8')
  const headers = extractHeaderConfig(source)
  const renderTableSection = extractRenderTableSection(source)
  const bodyColumnCount = countBodyColumns(renderTableSection)
  const emptyColspan = extractEmptyColspan(renderTableSection)

  assert(
    headers.length === expectedHeaders.length,
    `表头列数错误：期望 ${expectedHeaders.length}，实际 ${headers.length}`,
  )
  assert(
    JSON.stringify(headers) === JSON.stringify(expectedHeaders),
    `表头顺序错误：\n期望 ${expectedHeaders.join(' | ')}\n实际 ${headers.join(' | ')}`,
  )
  assert(
    bodyColumnCount === expectedHeaders.length,
    `数据列数错误：期望 ${expectedHeaders.length}，实际 ${bodyColumnCount}`,
  )
  assert(
    emptyColspan === expectedHeaders.length,
    `空状态 colspan 错误：期望 ${expectedHeaders.length}，实际 ${emptyColspan}`,
  )

  console.log(
    [
      '生产单进度主表列结构检查通过',
      `表头列数：${headers.length}`,
      `数据列数：${bodyColumnCount}`,
      `空状态 colspan：${emptyColspan}`,
    ].join('\n'),
  )
}

main()
