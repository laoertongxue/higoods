import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

import { techPacks } from '../src/data/fcs/tech-packs.ts'
import { buildPatternItemsFromTechPack } from '../src/pages/tech-pack/context.ts'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`纸样两步维护检查失败：${message}`)
  }
}

function assertIncludes(path: string, expected: string, message: string): void {
  assert(read(path).includes(expected), `${message}：${path} 缺少 ${expected}`)
}

function collectFiles(paths: string[], exts = ['.ts', '.tsx', '.js', '.md']): string[] {
  const files: string[] = []
  const visit = (absolutePath: string): void => {
    if (!existsSync(absolutePath)) return
    const stat = statSync(absolutePath)
    if (stat.isDirectory()) {
      readdirSync(absolutePath).forEach((entry) => visit(resolve(absolutePath, entry)))
      return
    }
    if (exts.some((ext) => absolutePath.endsWith(ext))) files.push(absolutePath)
  }
  paths.forEach((item) => visit(resolve(root, item)))
  return files
}

function extractBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start)
  assert(startIndex >= 0, `缺少片段起点 ${start}`)
  const endIndex = source.indexOf(end, startIndex + start.length)
  assert(endIndex > startIndex, `缺少片段终点 ${end}`)
  return source.slice(startIndex, endIndex)
}

const contextSource = read('src/pages/tech-pack/context.ts')
const patternSource = read('src/pages/tech-pack/pattern-domain.ts')
const eventsSource = read('src/pages/tech-pack/events.ts')
const techPacksSource = read('src/data/fcs/tech-packs.ts')
const versionTypesSource = read('src/data/pcs-technical-data-version-types.ts')
const adapterSource = read('src/data/pcs-technical-data-fcs-adapter.ts')

for (const scriptPath of [
  'scripts/check-process-craft-dictionary-rebuild.ts',
  'scripts/check-bom-shrink-wash-process-linkage.ts',
]) {
  assert(existsSync(resolve(root, scriptPath)), `前置检查脚本不存在：${scriptPath}`)
}

for (const expected of [
  'type PatternItem',
  'name: string',
  'type: TechPackPatternCategory',
  "isKnitted: '是' | '否'",
  'widthCm: number',
  'linkedMaterialId: string',
  'linkedMaterialName: string',
  'linkedMaterialSku: string',
  'markerLengthM: number',
  'prjFile: TechPackPatternManagedFile | null',
  'markerImage: TechPackPatternManagedFile | null',
  'dxfFile: TechPackPatternManagedFile | null',
  'rulFile: TechPackPatternManagedFile | null',
  'merchandiserInfoStatus',
  'patternMakerInfoStatus',
  'maintainerStepStatus',
]) {
  assert(contextSource.includes(expected), `纸样页面模型缺少字段或等价类型：${expected}`)
}

for (const expected of [
  'TechPackPatternMaintainerStepStatus',
  'TechPackPatternInfoStatus',
  'TechPackPatternManagedFile',
  'isKnitted?:',
  'linkedMaterialId?:',
  'linkedMaterialName?:',
  'linkedMaterialSku?:',
  'prjFile?:',
  'markerImage?:',
  'dxfFile?:',
  'rulFile?:',
  'maintainerStepStatus?:',
  'merchandiserInfoStatus?:',
  'patternMakerInfoStatus?:',
]) {
  assert(techPacksSource.includes(expected), `技术包纸样模型缺少字段：${expected}`)
  assert(versionTypesSource.includes(expected.replace('TechPack', 'Technical')) || versionTypesSource.includes(expected), `版本快照纸样模型缺少字段：${expected}`)
}

assert(adapterSource.includes('patternFiles') && adapterSource.includes('...item'), '版本快照适配必须保留纸样扩展字段')

for (const expected of [
  '跟单基础信息',
  '版师技术信息',
  'data-testid="pattern-two-step-dialog"',
  'data-testid="pattern-step-merchandiser-panel"',
  'data-testid="pattern-step-maker-panel"',
]) {
  assert(patternSource.includes(expected), `纸样页面缺少两步维护结构：${expected}`)
}

const merchandiserPanel = extractBetween(patternSource, 'const merchandiserPanel = `', 'const makerPanel = `')
const makerPanel = extractBetween(patternSource, 'const makerPanel = `', 'return `')

for (const expected of ['纸样名称', '纸样类型', '是否针织', '门幅（cm）', '关联物料']) {
  assert(merchandiserPanel.includes(expected), `跟单基础信息缺少字段：${expected}`)
}
for (const forbidden of ['纸样 PRJ 文件', '唛架图片', 'DXF 文件', 'RUL 文件', 'new-pattern-prj-file', 'new-pattern-dxf-file', 'new-pattern-rul-file']) {
  assert(!merchandiserPanel.includes(forbidden), `跟单基础信息不应出现版师字段：${forbidden}`)
}

for (const expected of ['排料长度（m）', '纸样 PRJ 文件', '唛架图片', 'DXF 文件', 'RUL 文件', '裁片明细']) {
  assert(makerPanel.includes(expected), `版师技术信息缺少字段：${expected}`)
}
for (const forbidden of ['data-tech-field="new-pattern-name"', 'data-tech-field="new-pattern-material-type"', 'data-tech-field="new-pattern-is-knitted"', 'data-tech-field="new-pattern-width-cm"', 'data-tech-field="new-pattern-linked-bom-item"']) {
  assert(!makerPanel.includes(forbidden), `版师技术信息不应重复编辑跟单字段：${forbidden}`)
}

for (const expected of [
  "accept=\".prj,.PRJ\"",
  "accept=\".png,.jpg,.jpeg,.webp\"",
  "accept=\".dxf,.DXF\"",
  "accept=\".rul,.RUL\"",
  '请填写纸样名称',
  '门幅必须大于 0',
  '请选择关联物料',
  '请上传纸样 PRJ 文件',
  '请上传唛架图片',
  '请上传 DXF 文件',
  '请上传 RUL 文件',
  '文件格式不正确，请上传 PRJ 文件',
]) {
  assert(patternSource.includes(expected) || eventsSource.includes(expected), `缺少两步维护校验或文件限制：${expected}`)
}

assert(eventsSource.includes("hasFileExtension(file.name, ['.prj'])"), 'PRJ 文件必须限制 .prj / .PRJ')
assert(eventsSource.includes("hasFileExtension(file.name, ['.png', '.jpg', '.jpeg', '.webp'])"), '唛架图片必须限制图片格式')
assert(eventsSource.includes("linkedBom?.materialName") && eventsSource.includes("linkedBom?.materialCode"), '关联物料必须来自 BOM 行')
assert(patternSource.includes('请先维护物料清单'), '物料清单为空时必须给出中文提示')

for (const expected of [
  'prjFile:',
  'markerImage:',
  'dxfFile:',
  'rulFile:',
  'maintainerStepStatus: item.maintainerStepStatus',
  'merchandiserInfoStatus: item.merchandiserInfoStatus',
  'patternMakerInfoStatus: item.patternMakerInfoStatus',
]) {
  assert(contextSource.includes(expected), `技术包保存/快照同步缺少字段：${expected}`)
}

const allPatterns = techPacks.flatMap((techPack) => buildPatternItemsFromTechPack(techPack))
for (const status of ['待跟单维护', '待版师维护', '待解析', '已解析待确认', '已完成']) {
  const rows = allPatterns.filter((item) => item.maintainerStepStatus === status)
  assert(rows.length >= 3, `mock 数据状态 ${status} 少于 3 行`)
  assert(rows.every((item) => item.name && item.type && item.isKnitted && item.widthCm > 0 && item.linkedMaterialName && item.linkedMaterialSku), `mock 数据状态 ${status} 存在空壳基础字段`)
}

const makerStagePatterns = allPatterns.filter((item) => ['待解析', '已解析待确认', '已完成'].includes(item.maintainerStepStatus))
assert(makerStagePatterns.every((item) => item.markerLengthM > 0), '已进入版师阶段的 mock 数据必须有排料长度')
assert(makerStagePatterns.every((item) => item.prjFile?.fileName && item.markerImage?.fileName && item.dxfFile?.fileName && item.rulFile?.fileName), '已进入版师阶段的 mock 数据必须有 PRJ、唛架图片、DXF、RUL')

for (const file of collectFiles(['src/pages', 'src/data', 'docs', 'tests'])) {
  const relativePath = file.slice(root.length + 1)
  assert(!readFileSync(file, 'utf8').includes('纸样图片'), `用户可见旧文案仍存在：${relativePath}`)
}

for (const expected of ['PREP_SHRINKING', 'PREP_WASHING', 'shrinkRequirement', 'washRequirement']) {
  assert(contextSource.includes(expected) || read('src/pages/tech-pack/bom-process-linkage.ts').includes(expected), `不得破坏前置 BOM/工序联动：${expected}`)
}

assertIncludes('src/data/fcs/process-craft-dict.ts', 'listPreparationProcesses', '第 1 步工序工艺字典能力必须保留')
assertIncludes('src/pages/tech-pack/bom-process-linkage.ts', 'syncPreparationProcessesFromBom', '第 2 步 BOM 联动能力必须保留')

console.log('pattern two step maintenance checks passed')
