import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { techPacks } from '../src/data/fcs/tech-packs.ts'
import {
  canSelectCraftInPatternPiece,
  listCutPiecePartCrafts,
  listFabricCrafts,
  listSpecialCrafts,
} from '../src/data/fcs/process-craft-dict.ts'
import {
  buildPatternSignature,
  checkDuplicateDxfFile,
  checkDuplicateLinkedMaterial,
  checkDuplicateMarkerImage,
  checkDuplicatePattern,
  checkDuplicatePatternName,
  checkDuplicatePrjFile,
  checkDuplicateRulFile,
  checkSimilarParsedStructure,
} from '../src/pages/tech-pack/pattern-duplicate-check.ts'
import { buildPatternItemsFromTechPack } from '../src/pages/tech-pack/context.ts'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`纸样捆条与重复校验检查失败：${message}`)
  }
}

function assertIncludes(source: string, expected: string, message: string): void {
  assert(source.includes(expected), `${message}：缺少 ${expected}`)
}

function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

for (const scriptPath of [
  'scripts/check-process-craft-dictionary-rebuild.ts',
  'scripts/check-bom-shrink-wash-process-linkage.ts',
  'scripts/check-pattern-two-step-maintenance.ts',
]) {
  assert(existsSync(resolve(root, scriptPath)), `前置检查脚本不存在：${scriptPath}`)
}

const techPacksSource = read('src/data/fcs/tech-packs.ts')
const versionTypesSource = read('src/data/pcs-technical-data-version-types.ts')
const contextSource = read('src/pages/tech-pack/context.ts')
const patternSource = read('src/pages/tech-pack/pattern-domain.ts')
const eventsSource = read('src/pages/tech-pack/events.ts')
const duplicateSource = read('src/pages/tech-pack/pattern-duplicate-check.ts')
const dictSource = read('src/data/fcs/process-craft-dict.ts')

for (const expected of [
  'export interface TechPackPatternBindingStrip',
  'bindingStripId: string',
  'bindingStripNo: string',
  'bindingStripName: string',
  'lengthCm: number',
  'widthCm: number',
  'bindingStrips?: TechPackPatternBindingStrip[]',
  'patternSignature?: string',
  'duplicateConfirmed?: boolean',
  'duplicateWarningReasons?: string[]',
]) {
  assertIncludes(techPacksSource, expected, `技术包纸样模型必须包含捆条/重复字段`)
}

for (const expected of [
  'export interface TechnicalPatternBindingStrip',
  'bindingStrips?: TechnicalPatternBindingStrip[]',
  'patternSignature?: string',
  'duplicateConfirmed?: boolean',
  'duplicateWarningReasons?: string[]',
]) {
  assertIncludes(versionTypesSource, expected, `技术包版本快照必须包含捆条/重复字段`)
}

for (const expected of [
  'bindingStrips: TechPackPatternBindingStrip[]',
  'createPatternBindingStrip',
  'normalizePatternBindingStrips',
  'patternSignature: string',
  'duplicateConfirmed: boolean',
  'duplicateWarningReasons: string[]',
  'bindingStrips:',
  'patternSignature:',
  'duplicateConfirmed:',
  'duplicateWarningReasons:',
]) {
  assertIncludes(contextSource, expected, `纸样运行模型和快照同步必须保留捆条/重复字段`)
}

for (const expected of [
  '版师技术信息',
  'data-testid="pattern-binding-strip-section"',
  '捆条',
  '添加捆条',
  '暂无捆条，可点击添加捆条',
  '捆条编号',
  '捆条名称',
  '长度（cm）',
  '宽度（cm）',
  'data-tech-field="new-pattern-binding-strip-name"',
  'data-tech-field="new-pattern-binding-strip-length-cm"',
  'data-tech-field="new-pattern-binding-strip-width-cm"',
]) {
  assertIncludes(patternSource, expected, `版师技术信息必须有纸样级捆条维护区域`)
}

for (const expected of [
  '确认删除该捆条？',
  '请填写捆条名称',
  '捆条长度必须大于 0',
  '捆条宽度必须大于 0',
  'add-pattern-binding-strip',
  'delete-pattern-binding-strip',
]) {
  assertIncludes(eventsSource, expected, `捆条交互和校验必须完整`)
}

for (const forbidden of [
  'data-tech-field="new-pattern-piece-bundle-length-cm"',
  'data-tech-field="new-pattern-piece-bundle-width-cm"',
  '捆条长度（厘米）',
  '捆条宽度（厘米）',
]) {
  assert(!patternSource.includes(forbidden), `裁片明细逐片区域不得继续维护捆条字段：${forbidden}`)
}

assertIncludes(contextSource, "if (definition.craftName === '捆条') return null", '裁片明细逐片特殊工艺选项必须排除捆条')

for (const expected of [
  'buildPatternSignature',
  'checkDuplicatePattern',
  'checkDuplicatePatternName',
  'checkDuplicateLinkedMaterial',
  'checkDuplicatePrjFile',
  'checkDuplicateDxfFile',
  'checkDuplicateRulFile',
  'checkDuplicateMarkerImage',
  'checkSimilarParsedStructure',
]) {
  assertIncludes(duplicateSource, `export function ${expected}`, `重复纸样校验模块必须导出 ${expected}`)
}

for (const expected of [
  '疑似重复纸样',
  '返回修改',
  '继续保存为新纸样',
  'cancel-pattern-duplicate-warning',
  'confirm-pattern-duplicate-warning',
]) {
  assert(patternSource.includes(expected) || eventsSource.includes(expected), `疑似重复必须有确认路径：${expected}`)
}

assertIncludes(eventsSource, 'checkDuplicatePattern(', '保存纸样前必须执行重复校验')
assertIncludes(eventsSource, 'hasBlockingDuplicate', '明确重复必须阻止保存')
assertIncludes(eventsSource, 'hasWarningDuplicate', '疑似重复必须先提示确认')

const bindingCraft = listSpecialCrafts().find((item) => item.craftName === '捆条')
assert(bindingCraft, '工序工艺字典中必须存在捆条')
assert(bindingCraft?.craftCategoryName === '辅助工艺', '捆条必须属于辅助工艺')
assert(bindingCraft?.targetObjectName === '面料', '捆条适用对象必须为面料')
assert(bindingCraft?.canSelectInBindingArea === true, '捆条必须允许在纸样捆条区域维护')
assert(bindingCraft?.canSelectInPatternPiece === false, '捆条不得进入裁片逐片特殊工艺选择')
assert(canSelectCraftInPatternPiece('捆条') === false, 'canSelectCraftInPatternPiece 对捆条必须返回 false')
assert(listFabricCrafts().some((item) => item.craftName === '捆条'), '面料级工艺必须包含捆条')
assert(!listCutPiecePartCrafts().some((item) => item.craftName === '捆条'), '裁片部位可选工艺不得包含捆条')
assert(dictSource.includes('canSelectInBindingArea: true') && dictSource.includes('canSelectInPatternPiece: false'), '字典源码必须保留捆条纸样层口径')

const allPatterns = techPacks.flatMap((techPack) => buildPatternItemsFromTechPack(techPack))
const bindingCounts = allPatterns.reduce<Record<string, number>>((counts, item) => {
  const count = item.bindingStrips.length >= 2 ? '2+' : String(item.bindingStrips.length)
  counts[count] = (counts[count] ?? 0) + 1
  return counts
}, {})

assert((bindingCounts['0'] ?? 0) >= 3, 'mock 数据必须覆盖 0 个捆条的纸样不少于 3 条')
assert((bindingCounts['1'] ?? 0) >= 3, 'mock 数据必须覆盖 1 个捆条的纸样不少于 3 条')
assert((bindingCounts['2+'] ?? 0) >= 3, 'mock 数据必须覆盖 2 个以上捆条的纸样不少于 3 条')
assert(allPatterns.every((item) => item.bindingStrips.every((strip) => (
  strip.bindingStripId
  && strip.bindingStripNo
  && strip.bindingStripName
  && Number(strip.lengthCm) > 0
  && Number(strip.widthCm) > 0
))), '每个 mock 捆条必须有编号、名称、长度（cm）、宽度（cm）')
assert(allPatterns.every((item) => item.patternSignature), 'mock 纸样必须生成 patternSignature')

const duplicateSourcePattern = allPatterns.find(
  (item) => item.prjFile?.fileName && item.prjFile.fileSize > 0 && item.dxfFileName && item.dxfFileSize > 0 && item.rulFileName && item.rulFileSize > 0 && item.markerImage?.fileName && item.markerImage.fileSize > 0,
)
assert(duplicateSourcePattern, 'mock 数据必须有可用于重复文件校验的完整纸样')

const base = duplicateSourcePattern!
const nonDuplicateFiles = {
  prjFile: { fileName: `${uniqueName('新纸样')}.prj`, fileSize: 99101 },
  dxfFileName: `${uniqueName('新纸样')}.dxf`,
  dxfFileSize: 99102,
  rulFileName: `${uniqueName('新纸样')}.rul`,
  rulFileSize: 99103,
  markerImage: { fileName: `${uniqueName('新唛架')}.png`, fileSize: 99104 },
}

const sameName = checkDuplicatePatternName(
  { ...base, ...nonDuplicateFiles, id: 'DUP-CHECK-NAME', name: base.name, linkedMaterialId: uniqueName('mat') },
  allPatterns,
)
assert(sameName.hasBlockingDuplicate && sameName.blockingReasons.includes('当前技术包已存在同名纸样，请修改纸样名称。'), '同名纸样必须明确阻止保存')

const samePrj = checkDuplicatePrjFile(
  { ...base, ...nonDuplicateFiles, id: 'DUP-CHECK-PRJ', name: uniqueName('纸样'), linkedMaterialId: uniqueName('mat'), prjFile: base.prjFile },
  allPatterns,
)
assert(samePrj.hasBlockingDuplicate && samePrj.blockingReasons.includes('当前技术包已上传相同 PRJ 文件，请勿重复上传同一纸样。'), 'PRJ 文件重复必须明确阻止保存')

const sameDxf = checkDuplicateDxfFile(
  { ...base, ...nonDuplicateFiles, id: 'DUP-CHECK-DXF', name: uniqueName('纸样'), linkedMaterialId: uniqueName('mat'), dxfFileName: base.dxfFileName, dxfFileSize: base.dxfFileSize },
  allPatterns,
)
assert(sameDxf.hasBlockingDuplicate && sameDxf.blockingReasons.includes('当前技术包已上传相同 DXF 文件，请勿重复上传同一纸样。'), 'DXF 文件重复必须明确阻止保存')

const sameRul = checkDuplicateRulFile(
  { ...base, ...nonDuplicateFiles, id: 'DUP-CHECK-RUL', name: uniqueName('纸样'), linkedMaterialId: uniqueName('mat'), rulFileName: base.rulFileName, rulFileSize: base.rulFileSize },
  allPatterns,
)
assert(sameRul.hasBlockingDuplicate && sameRul.blockingReasons.includes('当前技术包已上传相同 RUL 文件，请勿重复上传同一纸样。'), 'RUL 文件重复必须明确阻止保存')

const sameMaterial = checkDuplicateLinkedMaterial(
  { ...base, ...nonDuplicateFiles, id: 'DUP-CHECK-MAT', name: uniqueName('纸样') },
  allPatterns,
)
assert(sameMaterial.hasWarningDuplicate && sameMaterial.warningReasons.includes('当前技术包中该物料已关联相同类型纸样，是否继续保存为新纸样？'), '关联物料重复必须作为疑似重复')

const sameMarker = checkDuplicateMarkerImage(
  { ...base, ...nonDuplicateFiles, id: 'DUP-CHECK-MARKER', name: uniqueName('纸样'), linkedMaterialId: uniqueName('mat'), markerImage: base.markerImage },
  allPatterns,
)
assert(sameMarker.hasWarningDuplicate && sameMarker.warningReasons.includes('当前技术包已存在相同唛架图片，是否继续保存为新纸样？'), '唛架图片重复必须作为疑似重复')

const sameStructure = checkSimilarParsedStructure(
  { ...base, ...nonDuplicateFiles, id: 'DUP-CHECK-STRUCTURE', name: uniqueName('纸样'), linkedMaterialId: base.linkedMaterialId },
  allPatterns,
)
assert(sameStructure.hasWarningDuplicate && sameStructure.warningReasons.includes('当前技术包中存在结构相似的纸样，请确认是否重复上传。'), '解析结构相似必须作为疑似重复')

const combined = checkDuplicatePattern(
  { ...base, id: 'DUP-CHECK-COMBINED', name: uniqueName('纸样') },
  allPatterns,
)
assert(combined.hasBlockingDuplicate || combined.hasWarningDuplicate, '综合重复校验必须识别重复场景')

const selfCheck = checkDuplicatePattern(base, [base])
assert(!selfCheck.hasBlockingDuplicate && !selfCheck.hasWarningDuplicate, '编辑当前纸样时不得把自身识别为重复')

const signature = buildPatternSignature(base)
assert(signature && signature === base.patternSignature, 'patternSignature 必须与当前纸样数据一致')

for (const expected of [
  'PREP_SHRINKING',
  'PREP_WASHING',
  'shrinkRequirement',
  'washRequirement',
  '跟单基础信息',
  '版师技术信息',
  '纸样 PRJ 文件',
  '唛架图片',
]) {
  assert(contextSource.includes(expected) || patternSource.includes(expected) || read('src/pages/tech-pack/bom-process-linkage.ts').includes(expected), `不得破坏前置步骤能力：${expected}`)
}

console.log('pattern binding duplicate checks passed')
