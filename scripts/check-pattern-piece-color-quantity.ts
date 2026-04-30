import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { techPacks } from '../src/data/fcs/tech-packs.ts'
import {
  buildPatternItemsFromTechPack,
  calculatePatternPieceTotalQty,
  calculatePatternTotalPieceQty,
} from '../src/pages/tech-pack/context.ts'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`纸样裁片颜色片数检查失败：${message}`)
  }
}

function assertIncludes(source: string, expected: string, message: string): void {
  assert(source.includes(expected), `${message}：缺少 ${expected}`)
}

for (const scriptPath of [
  'scripts/check-process-craft-dictionary-rebuild.ts',
  'scripts/check-bom-shrink-wash-process-linkage.ts',
  'scripts/check-pattern-two-step-maintenance.ts',
  'scripts/check-pattern-binding-duplicate.ts',
]) {
  assert(existsSync(resolve(root, scriptPath)), `前置检查脚本不存在：${scriptPath}`)
}

const techPacksSource = read('src/data/fcs/tech-packs.ts')
const versionTypesSource = read('src/data/pcs-technical-data-version-types.ts')
const contextSource = read('src/pages/tech-pack/context.ts')
const patternSource = read('src/pages/tech-pack/pattern-domain.ts')
const eventsSource = read('src/pages/tech-pack/events.ts')
const parserSource = read('src/data/fcs/fcs-pattern-file-parser.ts')
const adapterSource = read('src/data/pcs-technical-data-fcs-adapter.ts')
const bootstrapSource = read('src/data/pcs-technical-data-version-bootstrap.ts')
const repositorySource = read('src/data/pcs-technical-data-version-repository.ts')

for (const expected of [
  'export interface TechPackPatternColorPieceQuantity',
  'colorId: string',
  'colorName: string',
  'pieceQty: number',
  'enabled: boolean',
  'parsedQuantity?: number',
  'colorPieceQuantities?: TechPackPatternColorPieceQuantity[]',
  'totalPieceQty?: number',
  'patternTotalPieceQty?: number',
]) {
  assertIncludes(techPacksSource, expected, '技术包纸样裁片模型必须包含颜色片数结构')
}

for (const expected of [
  'export interface TechnicalPatternColorPieceQuantity',
  'colorPieceQuantities?: TechnicalPatternColorPieceQuantity[]',
  'parsedQuantity?: number',
  'totalPieceQty?: number',
  'patternTotalPieceQty?: number',
]) {
  assertIncludes(versionTypesSource, expected, '技术包版本快照模型必须包含颜色片数结构')
}

for (const expected of [
  'colorPieceQuantities',
  'calculatePatternPieceTotalQty',
  'calculatePatternTotalPieceQty',
  'normalizePatternColorPieceQuantities',
  'getPatternColorQuantityOptions',
  '默认颜色',
  'parsedQuantity',
  'totalPieceQty',
  'patternTotalPieceQty',
]) {
  assertIncludes(contextSource, expected, '纸样运行上下文必须支持颜色片数计算')
}

for (const expected of [
  '适用颜色与颜色片数',
  '颜色片数',
  '当前部位总片数',
  '当前总片数',
  '解析参考片数',
  'data-testid="pattern-piece-total"',
  'data-testid="pattern-color-piece-qty"',
  'data-tech-field="new-pattern-piece-color-enabled"',
  'data-tech-field="new-pattern-piece-color-count"',
  '当前总片数为 0，请维护颜色片数',
  '请至少选择一个适用颜色',
  '已选择适用颜色但片数为 0，请确认',
  '解析参考片数与颜色片数合计不一致，请确认',
  '颜色片数必须为非负整数',
]) {
  assertIncludes(patternSource, expected, '纸样裁片明细页面必须展示颜色片数结构与提示')
}

assert(!patternSource.includes('data-tech-field="new-pattern-piece-count"'), '裁片明细主表不得继续渲染可编辑片数列')
assert(!/<th[^>]*>\s*片数\s*<\/th>/.test(patternSource), '裁片明细主表不得继续出现独立“片数”列')

for (const expected of [
  'new-pattern-piece-color-enabled',
  'new-pattern-piece-color-count',
  'pieceQty',
  'calculatePatternTotalPieceQty',
  'patternTotalPieceQty',
]) {
  assertIncludes(eventsSource, expected, '纸样裁片颜色片数交互必须校验并实时重算')
}
assert(patternSource.includes('Number.isInteger') || eventsSource.includes('Number.isInteger'), '颜色片数必须校验非负整数')
assert(patternSource.includes('Number(item.pieceQty) < 0') || eventsSource.includes('Number(item.pieceQty) < 0'), '颜色片数必须拦截负数')

assertIncludes(parserSource, 'parsedQuantity', 'DXF/RUL 解析结果必须进入 parsedQuantity')
assertIncludes(parserSource, 'quantityText', 'DXF/RUL 解析结果必须保留 Quantity 原始文本')

for (const expected of ['colorPieceQuantities', 'totalPieceQty', 'patternTotalPieceQty']) {
  assertIncludes(contextSource, expected, '纸样保存必须写入颜色片数和总片数')
  assertIncludes(adapterSource, expected, '技术包版本适配必须保留颜色片数和总片数')
  assertIncludes(bootstrapSource, expected === 'patternTotalPieceQty' ? 'patternFiles' : expected, '版本初始化必须保留纸样字段')
  assertIncludes(repositorySource, expected === 'patternTotalPieceQty' ? 'clonePatternFiles' : expected, '版本仓库克隆必须保留纸样字段')
}

const allPatterns = techPacks.flatMap((techPack) => buildPatternItemsFromTechPack(techPack))
const allRows = allPatterns.flatMap((pattern) => pattern.pieceRows)

assert(allRows.length > 0, 'mock 数据必须包含裁片明细')
assert(
  allRows.every((row) => Array.isArray(row.colorPieceQuantities)),
  '每行裁片明细必须包含 colorPieceQuantities',
)
assert(
  allRows.every((row) => row.colorPieceQuantities.every((item) => item.colorId && item.colorName)),
  '每个颜色片数必须保留结构化 colorId / colorName',
)
assert(
  allRows.every((row) => row.colorPieceQuantities.every((item) => Number.isInteger(Number(item.pieceQty)) && Number(item.pieceQty) >= 0)),
  'mock 颜色片数必须为非负整数',
)
assert(
  allRows.every((row) => Number(row.totalPieceQty) === calculatePatternPieceTotalQty(row.colorPieceQuantities)),
  '单行 totalPieceQty 必须等于启用颜色 pieceQty 合计',
)
assert(
  allPatterns.every((pattern) => Number(pattern.patternTotalPieceQty) === calculatePatternTotalPieceQty(pattern.pieceRows)),
  'patternTotalPieceQty 必须等于所有行 totalPieceQty 合计',
)

const enabledColorCounts = allRows.map((row) => row.colorPieceQuantities.filter((item) => item.enabled).length)
assert(enabledColorCounts.some((count) => count === 1), 'mock 数据必须覆盖 1 种颜色片数')
assert(enabledColorCounts.some((count) => count === 2), 'mock 数据必须覆盖 2 种颜色片数')
assert(enabledColorCounts.some((count) => count >= 3), 'mock 数据必须覆盖 3 种以上颜色片数')

const rowsWithParsedQuantity = allRows.filter((row) => Number.isFinite(Number(row.parsedQuantity)))
assert(rowsWithParsedQuantity.length >= 6, 'mock 数据必须覆盖解析参考片数')
assert(
  rowsWithParsedQuantity.filter((row) => Number(row.parsedQuantity) === Number(row.totalPieceQty)).length >= 3,
  'mock 数据必须覆盖解析参考片数与颜色片数合计一致',
)
assert(
  rowsWithParsedQuantity.filter((row) => Number(row.parsedQuantity) !== Number(row.totalPieceQty)).length >= 3,
  'mock 数据必须覆盖解析参考片数与颜色片数合计不一致',
)
assert(allRows.filter((row) => String(row.annotation || row.note || '').trim()).length >= 3, 'mock 数据必须覆盖 annotation 不为空')
assert(allRows.filter((row) => Number(row.totalPieceQty) === 0).length >= 3, 'mock 数据必须覆盖当前部位总片数为 0')

console.log('pattern piece color quantity checks passed')
