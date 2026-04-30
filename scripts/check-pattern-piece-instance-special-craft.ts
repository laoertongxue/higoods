import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { techPacks } from '../src/data/fcs/tech-packs.ts'
import {
  listCutPiecePartCrafts,
} from '../src/data/fcs/process-craft-dict.ts'
import {
  buildPatternItemsFromTechPack,
  findConfiguredPieceInstancesRemoved,
  generatePieceInstancesFromColorQuantities,
  getPatternPieceInstanceSpecialCraftOptions,
  PATTERN_CRAFT_POSITION_OPTIONS,
  summarizePieceInstances,
} from '../src/pages/tech-pack/context.ts'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`逐片特殊工艺配置检查失败：${message}`)
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
  'scripts/check-pattern-piece-color-quantity.ts',
]) {
  assert(existsSync(resolve(root, scriptPath)), `前置检查脚本不存在：${scriptPath}`)
}

const techPacksSource = read('src/data/fcs/tech-packs.ts')
const versionTypesSource = read('src/data/pcs-technical-data-version-types.ts')
const contextSource = read('src/pages/tech-pack/context.ts')
const patternSource = read('src/pages/tech-pack/pattern-domain.ts')
const eventsSource = read('src/pages/tech-pack/events.ts')
const adapterSource = read('src/data/pcs-technical-data-fcs-adapter.ts')
const bootstrapSource = read('src/data/pcs-technical-data-version-bootstrap.ts')
const repositorySource = read('src/data/pcs-technical-data-version-repository.ts')

for (const expected of [
  'export interface TechPackPatternPieceInstance',
  'pieceInstanceId: string',
  'sourcePieceId: string',
  'pieceName: string',
  'colorId: string',
  'colorName: string',
  'sequenceNo: number',
  'displayName: string',
  'specialCraftAssignments: TechPackPatternPieceSpecialCraftAssignment[]',
  'pieceInstances?: TechPackPatternPieceInstance[]',
  'pieceInstanceTotal?: number',
  'specialCraftConfiguredPieceTotal?: number',
  'specialCraftUnconfiguredPieceTotal?: number',
]) {
  assertIncludes(techPacksSource, expected, '技术包纸样模型必须包含裁片实例字段')
}

for (const expected of [
  'export interface TechPackPatternPieceSpecialCraftAssignment',
  'assignmentId: string',
  'craftCode: string',
  'craftName: string',
  'craftPosition: TechPackPatternPieceCraftPosition',
  'craftPositionName: TechPackPatternPieceCraftPositionName',
  "export type TechPackPatternPieceCraftPosition = 'LEFT' | 'RIGHT' | 'BOTTOM' | 'FACE'",
  "export type TechPackPatternPieceCraftPositionName = '左' | '右' | '底' | '面'",
]) {
  assertIncludes(techPacksSource, expected, '技术包纸样模型必须包含逐片特殊工艺配置字段')
}

for (const expected of [
  'export interface TechnicalPatternPieceInstance',
  'export interface TechnicalPatternPieceSpecialCraftAssignment',
  'pieceInstances?: TechnicalPatternPieceInstance[]',
  'specialCraftAssignments: TechnicalPatternPieceSpecialCraftAssignment[]',
  'craftPosition: TechnicalPatternPieceCraftPosition',
  'craftPositionName: TechnicalPatternPieceCraftPositionName',
]) {
  assertIncludes(versionTypesSource, expected, '技术包版本快照必须包含裁片实例和逐片特殊工艺')
}

for (const expected of [
  'getPatternPieceInstanceSpecialCraftOptions',
  'listCutPiecePartCrafts()',
  'generatePieceInstancesFromColorQuantities',
  'findConfiguredPieceInstancesRemoved',
  'summarizePieceInstances',
  'PATTERN_CRAFT_POSITION_OPTIONS',
  'forbiddenPieceInstanceCraftNames',
  '捆条',
  '橡筋定长切割',
  '缩水',
  '洗水',
]) {
  assertIncludes(contextSource, expected, '纸样运行上下文必须支持裁片实例生成和可选工艺过滤')
}

for (const expected of [
  '维护逐片工艺',
  '维护逐片特殊工艺',
  '添加特殊工艺',
  '应用到同颜色全部片',
  '已配置特殊工艺裁片',
  '未配置特殊工艺裁片',
  'data-testid="piece-instance-special-craft-dialog"',
  'data-testid="piece-instance-special-craft-select"',
  'data-testid="piece-instance-position-select"',
]) {
  assertIncludes(patternSource, expected, '纸样页面必须提供逐片特殊工艺配置入口和统计')
}

for (const expected of [
  '请选择特殊工艺。',
  '请选择工艺位置。',
  '该裁片已配置该特殊工艺，请勿重复添加。',
  '当前减少片数会删除已配置特殊工艺的裁片实例，是否继续？',
  '是否将当前片的特殊工艺应用到同颜色全部片？',
  'add-piece-instance-special-craft',
  'apply-piece-instance-craft-to-same-color',
  'open-piece-instance-special-craft-dialog',
]) {
  assertIncludes(eventsSource, expected, '逐片特殊工艺交互必须有校验、保护和批量能力')
}

for (const expected of ['pieceInstances', 'specialCraftAssignments']) {
  assertIncludes(adapterSource, expected, '技术包版本适配必须保留逐片特殊工艺')
  assertIncludes(bootstrapSource, expected, '版本初始化必须保留逐片特殊工艺')
  assertIncludes(repositorySource, expected, '版本仓库克隆必须保留逐片特殊工艺')
}

const craftOptions = getPatternPieceInstanceSpecialCraftOptions()
const craftNames = craftOptions.map((item) => item.craftName)
const dictCutPieceCrafts = listCutPiecePartCrafts().map((item) => item.craftName)

for (const expected of [
  '绣花',
  '打条',
  '压褶',
  '打揽',
  '烫画',
  '直喷',
  '贝壳绣',
  '曲牙绣',
  '一字贝绣花',
  '模板工序',
  '激光开袋',
  '特种车缝（花样机）',
]) {
  assert(dictCutPieceCrafts.includes(expected), `裁片部位工艺字典必须包含 ${expected}`)
  assert(craftNames.includes(expected), `逐片特殊工艺选择器必须包含 ${expected}`)
}

for (const forbidden of ['捆条', '橡筋定长切割', '缩水', '洗水']) {
  assert(!craftNames.includes(forbidden), `逐片特殊工艺选择器不得包含 ${forbidden}`)
}

assert(PATTERN_CRAFT_POSITION_OPTIONS.length === 4, '工艺位置必须只有 4 个选项')
assert(PATTERN_CRAFT_POSITION_OPTIONS.map((item) => item.code).join(',') === 'LEFT,RIGHT,BOTTOM,FACE', 'craftPosition 只允许 LEFT / RIGHT / BOTTOM / FACE')
assert(PATTERN_CRAFT_POSITION_OPTIONS.map((item) => item.name).join(',') === '左,右,底,面', 'craftPositionName 只允许 左 / 右 / 底 / 面')

const allPatterns = techPacks.flatMap((techPack) => buildPatternItemsFromTechPack(techPack))
const allInstances = allPatterns.flatMap((pattern) => pattern.pieceInstances)
assert(allInstances.length > 0, 'mock 数据必须包含裁片实例')
assert(
  allPatterns.every((pattern) => pattern.pieceInstances.length === pattern.patternTotalPieceQty),
  '每个纸样 pieceInstances 数量必须等于 patternTotalPieceQty',
)
assert(
  allPatterns.every((pattern) => {
    const generated = generatePieceInstancesFromColorQuantities(pattern)
    return generated.length === pattern.patternTotalPieceQty
  }),
  '生成实例数量必须等于所有启用颜色 pieceQty 合计',
)
assert(
  allPatterns.every((pattern) => {
    const summary = summarizePieceInstances(pattern.pieceInstances)
    return summary.pieceInstanceTotal === pattern.pieceInstanceTotal
      && summary.specialCraftConfiguredPieceTotal === pattern.specialCraftConfiguredPieceTotal
      && summary.specialCraftUnconfiguredPieceTotal === pattern.specialCraftUnconfiguredPieceTotal
  }),
  '裁片实例统计字段必须与实例配置状态一致',
)

const expandablePattern = allPatterns.find((pattern) => pattern.pieceRows.some((row) => row.colorPieceQuantities.some((item) => item.enabled)))
assert(expandablePattern, 'mock 数据必须有可用于颜色片数增减的纸样')
const sourcePattern = expandablePattern!
const firstRow = sourcePattern.pieceRows.find((row) => row.colorPieceQuantities.some((item) => item.enabled && item.pieceQty > 0))!
const firstEnabledColor = firstRow.colorPieceQuantities.find((item) => item.enabled && item.pieceQty > 0)!
const increasedRows = sourcePattern.pieceRows.map((row) =>
  row.id === firstRow.id
    ? {
        ...row,
        colorPieceQuantities: row.colorPieceQuantities.map((item) =>
          item.colorId === firstEnabledColor.colorId ? { ...item, pieceQty: item.pieceQty + 1 } : item,
        ),
      }
    : row,
)
assert(
  generatePieceInstancesFromColorQuantities({ ...sourcePattern, pieceRows: increasedRows }).length
    === sourcePattern.pieceInstances.length + 1,
  '颜色片数增加时必须新增裁片实例',
)

const configuredPattern = allPatterns.find((pattern) => pattern.pieceInstances.some((item) => item.specialCraftAssignments.length > 0))
assert(configuredPattern, 'mock 数据必须包含已配置特殊工艺的裁片实例')
const configuredInstance = configuredPattern!.pieceInstances.find((item) => item.specialCraftAssignments.length > 0)!
const reducedRows = configuredPattern!.pieceRows.map((row) =>
  row.id === configuredInstance.sourcePieceId
    ? {
        ...row,
        colorPieceQuantities: row.colorPieceQuantities.map((item) =>
          item.colorId === configuredInstance.colorId
            ? { ...item, pieceQty: Math.max(0, configuredInstance.sequenceNo - 1), enabled: configuredInstance.sequenceNo > 1 }
            : item,
        ),
      }
    : row,
)
const reducedInstances = generatePieceInstancesFromColorQuantities({ ...configuredPattern!, pieceRows: reducedRows })
assert(
  findConfiguredPieceInstancesRemoved(configuredPattern!.pieceInstances, reducedInstances).length > 0,
  '颜色片数减少时必须能识别会删除已配置特殊工艺的实例',
)

assert(
  allInstances.every((instance) => {
    const seen = new Set<string>()
    return instance.specialCraftAssignments.every((assignment) => {
      const unique = !seen.has(assignment.craftCode)
      seen.add(assignment.craftCode)
      return unique
    })
  }),
  '同一裁片实例不能重复配置同一特殊工艺',
)
assert(
  allInstances.every((instance) => instance.specialCraftAssignments.every((assignment) =>
    ['LEFT', 'RIGHT', 'BOTTOM', 'FACE'].includes(assignment.craftPosition)
    && ['左', '右', '底', '面'].includes(assignment.craftPositionName),
  )),
  '所有 mock 特殊工艺配置必须有合法位置',
)

const colorCountByPattern = allPatterns.reduce<Record<string, number>>((counts, pattern) => {
  const colorCount = new Set(pattern.pieceInstances.map((instance) => instance.colorId)).size
  const key = colorCount >= 3 ? '3+' : String(colorCount)
  counts[key] = (counts[key] ?? 0) + 1
  return counts
}, {})
assert((colorCountByPattern['1'] ?? 0) >= 3, 'mock 数据必须覆盖 1 种颜色实例的纸样不少于 3 个')
assert((colorCountByPattern['2'] ?? 0) >= 3, 'mock 数据必须覆盖 2 种颜色实例的纸样不少于 3 个')
assert((colorCountByPattern['3+'] ?? 0) >= 3, 'mock 数据必须覆盖 3 种以上颜色实例的纸样不少于 3 个')

assert(allInstances.filter((instance) => instance.specialCraftAssignments.length === 0).length >= 3, 'mock 数据必须覆盖未配置特殊工艺实例')
assert(allInstances.filter((instance) => instance.specialCraftAssignments.length === 1).length >= 3, 'mock 数据必须覆盖配置 1 个特殊工艺实例')
assert(allInstances.filter((instance) => instance.specialCraftAssignments.length >= 2).length >= 3, 'mock 数据必须覆盖配置 2 个以上特殊工艺实例')
for (const positionName of ['左', '右', '底', '面']) {
  assert(
    allInstances.filter((instance) => instance.specialCraftAssignments.some((assignment) => assignment.craftPositionName === positionName)).length >= 3,
    `mock 数据必须覆盖位置 ${positionName}`,
  )
}

console.log('pattern piece instance special craft checks passed')
