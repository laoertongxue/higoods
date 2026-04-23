import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  getSpecialCraftSupportedTargetObjectLabels,
  listSelectableSpecialCraftDefinitions,
  type SpecialCraftTargetObjectLabel,
} from '../src/data/fcs/process-craft-dict.ts'
import {
  listEnabledSpecialCraftOperationDefinitions,
  isSpecialCraftTargetObjectSupported,
} from '../src/data/fcs/special-craft-operations.ts'
import {
  createDraftTechPackForSpu,
  getDraftTechPackBySpuCode,
  getEnabledTechPackBySpuCode,
  publishTechPackDraft,
  techPacks,
  validateTechPackForPublish,
  type TechPack,
} from '../src/data/fcs/tech-packs.ts'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const allowedTargetLabels: SpecialCraftTargetObjectLabel[] = ['已裁部位', '完整面料']

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8')
}

function assertIncludes(source: string, token: string, message: string): void {
  assert(source.includes(token), message)
}

function assertNotIncludes(source: string, token: string, message: string): void {
  assert(!source.includes(token), message)
}

function cloneTechPack<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function buildToken(...parts: string[]): string {
  return parts.join('')
}

function buildProcessEntry(craftName: string, selectedTargetObject: SpecialCraftTargetObjectLabel) {
  const craft = listSelectableSpecialCraftDefinitions().find((item) => item.craftName === craftName)
  assert(craft, `工序工艺字典缺少特殊工艺：${craftName}`)
  return {
    id: `check-${craft.craftCode}-${selectedTargetObject}`,
    seq: 999,
    entryType: 'CRAFT',
    stageCode: craft.stageCode,
    stageName: craft.stageName,
    processCode: craft.processCode,
    processName: craft.processName,
    craftCode: craft.craftCode,
    craftName: craft.craftName,
    isSpecialCraft: true,
    selectedTargetObject,
    supportedTargetObjects: [...craft.supportedTargetObjects],
    supportedTargetObjectLabels: [...craft.supportedTargetObjectLabels],
    detailSplitDimensions: [],
    assignmentGranularity: 'ORDER',
    standardTimeMinutes: 1,
    difficulty: 'MEDIUM',
    qcPoint: '',
    remark: '',
  }
}

function buildPatternCraft(craftName: string) {
  const craft = listSelectableSpecialCraftDefinitions().find((item) => item.craftName === craftName)
  assert(craft, `工序工艺字典缺少特殊工艺：${craftName}`)
  return {
    processCode: craft.processCode,
    processName: craft.processName,
    craftCode: craft.craftCode,
    craftName: craft.craftName,
    displayName: craft.craftName,
    selectedTargetObject: '已裁部位' as const,
    supportedTargetObjects: [...craft.supportedTargetObjects],
    supportedTargetObjectLabels: [...craft.supportedTargetObjectLabels],
  }
}

function buildValidationBasePack(): TechPack {
  const source = techPacks.find((item) => item.status === 'ENABLED') || techPacks[0]
  assert(source, '缺少技术包演示数据')
  return {
    ...cloneTechPack(source),
    spuCode: 'SPU-CHECK-TARGET',
    spuName: '作用对象校验款',
    status: 'DRAFT',
    versionLabel: '',
    officialVersionNo: undefined,
    processEntries: [],
    patternFiles: [],
  }
}

const processCraftSource = read('src/data/fcs/process-craft-dict.ts')
const operationSource = read('src/data/fcs/special-craft-operations.ts')
const techPackSource = read('src/data/fcs/tech-packs.ts')
const contextSource = read('src/pages/tech-pack/context.ts')
const eventsSource = read('src/pages/tech-pack/events.ts')
const processDomainSource = read('src/pages/tech-pack/process-domain.ts')
const patternDomainSource = read('src/pages/tech-pack/pattern-domain.ts')
const snapshotTypesSource = read('src/data/fcs/production-tech-pack-snapshot-types.ts')
const snapshotBuilderSource = read('src/data/fcs/production-tech-pack-snapshot-builder.ts')
const snapshotRuntimeSource = read('src/data/fcs/production-order-tech-pack-runtime.ts')
const generationSource = read('src/data/fcs/special-craft-task-generation.ts')
const packageSource = read('package.json')

assertIncludes(packageSource, 'check:tech-pack-special-craft-target-object-and-versioning', 'package.json 缺少本轮检查命令')
assertIncludes(processCraftSource, 'supportedTargetObjects', '特殊工艺字典缺少 supportedTargetObjects')
assertIncludes(processCraftSource, 'CUT_PIECE', '特殊工艺字典缺少已裁部位内部值')
assertIncludes(processCraftSource, 'FULL_FABRIC', '特殊工艺字典缺少完整面料内部值')
assertIncludes(operationSource, 'supportedTargetObjects', '特殊工艺运营分类缺少多选作用对象')
assertIncludes(operationSource, 'defaultTargetObject', '特殊工艺运营分类缺少默认作用对象兼容字段')
assertIncludes(operationSource, 'visibleFactoryTypes', '特殊工艺运营分类缺少工厂可见性预留字段')

const selectableSpecialCrafts = listSelectableSpecialCraftDefinitions()
assert(selectableSpecialCrafts.length > 0, '缺少可选特殊工艺字典项')
selectableSpecialCrafts.forEach((craft) => {
  assert(Array.isArray(craft.supportedTargetObjects), `${craft.craftName} 缺少作用对象数组`)
  assert(craft.supportedTargetObjects.length > 0, `${craft.craftName} 作用对象数组不能为空`)
  assert(
    getSpecialCraftSupportedTargetObjectLabels(craft.supportedTargetObjects).every((label) => allowedTargetLabels.includes(label)),
    `${craft.craftName} 出现不允许的作用对象`,
  )
})
assert.deepEqual(
  getSpecialCraftSupportedTargetObjectLabels(selectableSpecialCrafts.find((item) => item.craftName === '捆条')?.supportedTargetObjects ?? []),
  ['已裁部位'],
  '捆条只能支持已裁部位',
)
assert(
  getSpecialCraftSupportedTargetObjectLabels(selectableSpecialCrafts.find((item) => item.craftName === '洗水')?.supportedTargetObjects ?? []).includes('完整面料'),
  '洗水必须支持完整面料',
)
assert(
  selectableSpecialCrafts.some((craft) => getSpecialCraftSupportedTargetObjectLabels(craft.supportedTargetObjects).length > 1),
  '必须存在支持两个作用对象的特殊工艺',
)

const enabledOperations = listEnabledSpecialCraftOperationDefinitions()
assert.equal(enabledOperations.length, 7, 'PFOS 当前启用特殊工艺菜单数量必须保持 7 个')
enabledOperations.forEach((operation) => {
  assert(operation.supportedTargetObjects.length > 0, `${operation.operationName} 缺少 supportedTargetObjects`)
  assert(operation.supportedTargetObjectLabels.every((label) => allowedTargetLabels.includes(label)), `${operation.operationName} 作用对象标签越界`)
  assert(isSpecialCraftTargetObjectSupported(operation, operation.defaultTargetObject), `${operation.operationName} 默认作用对象不在支持范围内`)
})

assertIncludes(contextSource, 'selectedTargetObject', '技术包新增特殊工艺缺少 selectedTargetObject')
assertIncludes(processDomainSource, 'data-tech-field="new-technique-target-object"', '技术包特殊工艺弹窗缺少作用对象选择')
assertIncludes(processDomainSource, '作用对象：', '技术包工序工艺列表缺少作用对象展示')
assertIncludes(eventsSource, 'item.selectedTargetObject === effectiveMeta.selectedTargetObject', '技术包特殊工艺去重必须包含作用对象')
assertIncludes(eventsSource, '该特殊工艺和作用对象已存在', '重复特殊工艺提示必须按作用对象区分')
assertIncludes(contextSource, "selectedTargetObject !== '已裁部位'", '纸样特殊工艺来源必须过滤为已裁部位')
assertIncludes(contextSource, 'getPatternPieceSpecialCraftOptionsFromCurrentTechPack', '纸样特殊工艺必须来自当前技术包')
assertIncludes(patternDomainSource, 'data-target-object', '纸样部位特殊工艺切换必须携带作用对象')
assertIncludes(patternDomainSource, '捆条长度（厘米）', '纸样管理缺少捆条长度字段')
assertIncludes(patternDomainSource, '捆条宽度（厘米）', '纸样管理缺少捆条宽度字段')
assertIncludes(eventsSource, 'new-pattern-piece-bundle-length-cm', '纸样事件缺少捆条长度维护')
assertIncludes(eventsSource, 'new-pattern-piece-bundle-width-cm', '纸样事件缺少捆条宽度维护')
assertIncludes(eventsSource, 'validateTechPackForPublish', '发布草稿必须调用发布校验')

assert(techPacks.every((item) => ['DRAFT', 'ENABLED', 'DISABLED'].includes(item.status)), '技术包状态只能是三态')
assert(techPacks.every((item) => item.status !== 'DRAFT' || !item.versionLabel), '草稿不得有正式版本号')
assert(techPacks.every((item) => item.status === 'DRAFT' || Boolean(item.versionLabel)), '已启用 / 未启用必须有正式版本号')
const draftCountBySpu = new Map<string, number>()
techPacks.forEach((item) => {
  if (item.status === 'DRAFT') draftCountBySpu.set(item.spuCode, (draftCountBySpu.get(item.spuCode) || 0) + 1)
})
draftCountBySpu.forEach((count, spuCode) => assert(count <= 1, `${spuCode} 存在多个草稿`))
assertIncludes(techPackSource, '当前有草稿版本的技术包', '已有草稿时缺少阻止提示')
assertIncludes(techPackSource, 'draftSourceVersionLabel', '新增草稿必须记录来源正式版本')
assertIncludes(techPackSource, 'publishTechPackDraft', '缺少发布草稿 helper')
assertIncludes(techPackSource, "item.status = 'DISABLED'", '发布新版本必须停用旧启用版本')

const invalidCutPiecePack = buildValidationBasePack()
invalidCutPiecePack.processEntries = [buildProcessEntry('捆条', '已裁部位')]
assert(
  validateTechPackForPublish(invalidCutPiecePack).includes('特殊工艺「捆条」选择了已裁部位，但纸样管理中没有关联裁片部位'),
  '已裁部位特殊工艺未落到纸样部位时必须阻止发布',
)

const invalidBundlePack = buildValidationBasePack()
invalidBundlePack.processEntries = [buildProcessEntry('捆条', '已裁部位')]
invalidBundlePack.patternFiles = [
  {
    id: 'check-pattern',
    fileName: '检查纸样.pdf',
    fileUrl: '#',
    uploadedAt: '2026-04-23',
    uploadedBy: '系统',
    pieceRows: [
      {
        id: 'check-piece-front',
        name: '前片',
        count: 1,
        specialCrafts: [buildPatternCraft('捆条')],
      },
    ],
  },
]
const bundleErrors = validateTechPackForPublish(invalidBundlePack)
assert(bundleErrors.includes('裁片部位「前片」已关联捆条，但未填写捆条长度'), '捆条长度缺失必须阻止发布')
assert(bundleErrors.includes('裁片部位「前片」已关联捆条，但未填写捆条宽度'), '捆条宽度缺失必须阻止发布')

assertIncludes(snapshotTypesSource, 'selectedTargetObject', '快照类型缺少 selectedTargetObject')
assertIncludes(snapshotTypesSource, 'supportedTargetObjects', '快照类型缺少 supportedTargetObjects')
assertIncludes(snapshotTypesSource, 'bundleLengthCm', '快照类型缺少 bundleLengthCm')
assertIncludes(snapshotTypesSource, 'bundleWidthCm', '快照类型缺少 bundleWidthCm')
assertIncludes(snapshotBuilderSource, 'bundleLengthCm', '快照构建缺少捆条长度承接')
assertIncludes(snapshotBuilderSource, 'bundleWidthCm', '快照构建缺少捆条宽度承接')
assertIncludes(snapshotRuntimeSource, 'selectedTargetObject', '运行时快照缺少作用对象克隆')
assertIncludes(snapshotRuntimeSource, 'supportedTargetObjects', '运行时快照缺少支持作用对象克隆')
assertIncludes(snapshotRuntimeSource, 'bundleLengthCm', '运行时快照缺少捆条长度克隆')
assertIncludes(snapshotRuntimeSource, 'bundleWidthCm', '运行时快照缺少捆条宽度克隆')
assertIncludes(generationSource, 'craft.selectedTargetObject', '特殊工艺任务生成必须读取技术包选择的作用对象')
assertIncludes(generationSource, 'resolveSelectedTargetObject', '特殊工艺任务生成缺少作用对象解析')
assertIncludes(generationSource, 'isSpecialCraftTargetObjectSupported', '特殊工艺任务生成必须校验作用对象支持范围')
assertIncludes(generationSource, 'getDemandLineUnit(selectedTargetObject)', '特殊工艺任务生成必须按作用对象选择单位')

const lifecycleCandidate = techPacks.find(
  (item) => item.status === 'ENABLED' && !getDraftTechPackBySpuCode(item.spuCode) && validateTechPackForPublish(item).length === 0,
)
assert(lifecycleCandidate, '缺少可验证草稿生命周期的已启用技术包')
const oldVersionLabel = lifecycleCandidate.versionLabel
const draftResult = createDraftTechPackForSpu(lifecycleCandidate.spuCode)
assert.equal(draftResult.ok, true, '无草稿时必须允许复制已启用版本创建草稿')
assert.equal(draftResult.techPack.status, 'DRAFT', '新增技术包必须进入草稿')
assert.equal(draftResult.techPack.versionLabel, '', '新增草稿不得带正式版本号')
assert.equal(draftResult.techPack.draftSourceVersionLabel, oldVersionLabel, '新增草稿必须复制当前已启用版本')
const duplicateDraftResult = createDraftTechPackForSpu(lifecycleCandidate.spuCode)
assert.equal(duplicateDraftResult.ok, false, '已有草稿时不得再次新增')
assert.equal(duplicateDraftResult.message, '当前有草稿版本的技术包', '已有草稿提示不正确')
assert.equal(duplicateDraftResult.techPack, draftResult.techPack, '已有草稿时必须进入当前草稿')
const publishResult = publishTechPackDraft(lifecycleCandidate.spuCode)
assert.equal(publishResult.ok, true, '发布草稿必须成功')
assert.equal(publishResult.techPack?.status, 'ENABLED', '发布后新版本必须已启用')
assert(publishResult.techPack?.versionLabel, '发布后必须生成正式版本号')
assert.equal(lifecycleCandidate.status, 'DISABLED', '发布后原启用版本必须未启用')
assert.equal(getEnabledTechPackBySpuCode(lifecycleCandidate.spuCode), publishResult.techPack, '同一技术包只能保留新启用版本')

;[
  buildToken('axi', 'os'),
  buildToken('fet', 'ch('),
  buildToken('api', 'Client'),
  buildToken('/', 'api', '/'),
  buildToken('i1', '8n'),
  buildToken('use', 'Translation'),
  buildToken('loc', 'ales'),
  buildToken('trans', 'lations'),
  buildToken('e', 'charts'),
  buildToken('chart', '.', 'js'),
  buildToken('re', 'charts'),
].forEach((token) => {
  assertNotIncludes(contextSource + eventsSource + patternDomainSource + generationSource, token, `本轮不得新增越界能力：${token}`)
})
;[
  buildToken('五', '金'),
  buildToken('盘', '口'),
  buildToken('盘', '扣'),
  buildToken('盘', '抠'),
  buildToken('鸡', '眼', '扣'),
  buildToken('手工', '盘', '扣'),
  buildToken('印', '花', '工艺'),
  buildToken('染', '色', '工艺'),
  buildToken('PRINTING', '_CRAFT'),
  buildToken('DYEING', '_CRAFT'),
  buildToken('HARD', 'WARE'),
  buildToken('FROG', '_BUTTON'),
].forEach((token) => {
  assertNotIncludes(processCraftSource + operationSource + techPackSource, token, `不得恢复已删除旧工艺：${token}`)
})

console.log('check-tech-pack-special-craft-target-object-and-versioning.ts PASS')
