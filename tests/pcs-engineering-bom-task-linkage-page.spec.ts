import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  applyBomRequirementsToEngineeringTasks,
  createEngineeringMasterOrder,
  getEngineeringMasterOrderStoreSnapshot,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
  updateEngineeringTaskRecord,
} from '../src/data/pcs-engineering-master-repository.ts'
import {
  applyEngineeringTaskLinkageFromBomForTechnicalVersion,
  saveTechnicalDataVersionContentWithEngineeringLinkage,
  type BomItemRow,
} from '../src/pages/tech-pack/context.ts'
import {
  createTechnicalDataVersionDraft,
  getTechnicalDataVersionStoreSnapshot,
  listTechnicalDataVersions,
  resetTechnicalDataVersionRepository,
} from '../src/data/pcs-technical-data-version-repository.ts'
import type { TechnicalDataVersionContent } from '../src/data/pcs-technical-data-version-types.ts'

resetStyleArchiveRepository()
resetEngineeringMasterRepository()
resetTechnicalDataVersionRepository()
const style = listStyleArchives()[0]
assert.ok(style)
const master = publishEngineeringMasterOrder(createEngineeringMasterOrder({
  styleId: style.styleId,
  styleCode: style.styleCode,
  merchandiserName: '跟单A',
}).masterOrderId)

const baseVersion = listTechnicalDataVersions()[0]
assert.ok(baseVersion)
const linkedTechnicalVersionId = `TDV-BOM-LINK-${Date.now()}`
const content: TechnicalDataVersionContent = {
  technicalVersionId: linkedTechnicalVersionId,
  patternFiles: [],
  patternDesc: '',
  processEntries: [],
  sizeTable: [],
  bomItems: [],
  bomCustomCosts: [],
  qualityRules: [],
  colorMaterialMappings: [],
  patternDesigns: [],
  attachments: [],
  legacyCompatibleCostPayload: {},
}
createTechnicalDataVersionDraft({
  ...baseVersion,
  technicalVersionId: linkedTechnicalVersionId,
  technicalVersionCode: `TP-${linkedTechnicalVersionId}`,
  styleId: style.styleId,
  styleCode: style.styleCode,
  sourceProjectId: master.masterOrderId,
  createdFromTaskId: `${master.masterOrderId}-TECH_PACK_CONFIRMATION`,
  versionStatus: 'DRAFT',
  publishedAt: '',
  publishedBy: '',
}, content)

const bomRows = [{
  id: 'BOM-PAGE-PRINT',
  type: '面料',
  colorLabel: '黑色',
  materialCode: 'MAT-001',
  materialSkuId: 'MAT-SKU-001',
  materialName: '黑色面料',
  spec: '150cm',
  unit: '码',
  patternPieces: [],
  linkedPatternIds: [],
  applicableSkuCodes: [],
  usageProcessCodes: [],
  usage: 1,
  lossRate: 0,
  printRequirement: '数码印花',
  waterSolubleRequirement: '否',
  dyeRequirement: '无',
  shrinkRequirement: '否',
  washRequirement: '否',
  printSideMode: 'SINGLE',
  frontPatternDesignId: '',
  frontPatternDesignIds: [],
  insidePatternDesignId: '',
  insidePatternDesignIds: [],
}] satisfies BomItemRow[]
const linked = applyEngineeringTaskLinkageFromBomForTechnicalVersion(linkedTechnicalVersionId, bomRows)

assert.equal(linked?.masterOrder.masterOrderId, master.masterOrderId)
assert.equal(
  linked?.masterOrder.tasks.find((task) => task.taskType === 'PATTERN_ARTWORK')?.materialLines[0]?.bomItemId,
  'BOM-PAGE-PRINT',
  '技术包 BOM 适配层必须把真实 BOM 行写入工程主单任务',
)

const contextSource = readFileSync(new URL('../src/pages/tech-pack/context.ts', import.meta.url), 'utf8')
const persistBlock = contextSource.slice(
  contextSource.indexOf("if (options.persist !== false && state.currentTechnicalVersionId && !state.compatibilityMode)"),
  contextSource.indexOf('return true', contextSource.indexOf("if (options.persist !== false && state.currentTechnicalVersionId && !state.compatibilityMode)")),
)
assert.match(
  persistBlock,
  /saveTechnicalDataVersionContentWithEngineeringLinkage\([\s\S]*state\.currentTechnicalVersionId,[\s\S]*state\.bomItems/,
  '真实技术包保存链必须通过跨仓原子联动入口',
)
assert.doesNotMatch(persistBlock, /applyEngineeringTaskLinkageFromBomForTechnicalVersion\(/, '页面保存链不得分别写两个仓库')

const unrelatedVersionId = `TDV-BOM-UNRELATED-${Date.now()}`
createTechnicalDataVersionDraft({
  ...baseVersion,
  technicalVersionId: unrelatedVersionId,
  technicalVersionCode: `TP-${unrelatedVersionId}`,
  styleId: style.styleId,
  styleCode: style.styleCode,
  sourceProjectId: 'PRODUCT-PROJECT-NOT-MASTER',
  createdFromTaskId: '',
  versionStatus: 'DRAFT',
  publishedAt: '',
  publishedBy: '',
}, { ...content, technicalVersionId: unrelatedVersionId })
assert.equal(
  applyEngineeringTaskLinkageFromBomForTechnicalVersion(unrelatedVersionId, bomRows),
  null,
  '同款式但无工程主单权威来源的技术包版本不得隐式联动',
)

const secondStyle = listStyleArchives().find((item) => item.styleId !== style.styleId)
assert.ok(secondStyle)
const secondMaster = publishEngineeringMasterOrder(createEngineeringMasterOrder({
  styleId: secondStyle.styleId,
  styleCode: secondStyle.styleCode,
  merchandiserName: '跟单B',
}).masterOrderId)

function createSourceVersion(
  suffix: string,
  sourceProjectId: string,
  createdFromTaskId: string,
) {
  const technicalVersionId = `TDV-BOM-SOURCE-${suffix}-${Date.now()}`
  createTechnicalDataVersionDraft({
    ...baseVersion,
    technicalVersionId,
    technicalVersionCode: `TP-${technicalVersionId}`,
    styleId: style.styleId,
    styleCode: style.styleCode,
    sourceProjectId,
    createdFromTaskId,
    versionStatus: 'DRAFT',
    publishedAt: '',
    publishedBy: '',
  }, { ...content, technicalVersionId })
  return technicalVersionId
}

const projectOnlyVersionId = createSourceVersion('PROJECT', master.masterOrderId, '')
assert.equal(
  applyEngineeringTaskLinkageFromBomForTechnicalVersion(projectOnlyVersionId, bomRows)?.masterOrder.masterOrderId,
  master.masterOrderId,
  '仅 sourceProjectId 时应关联对应工程主单',
)
const taskOnlyVersionId = createSourceVersion('TASK', '', `${secondMaster.masterOrderId}-TECH_PACK_CONFIRMATION`)
assert.equal(
  applyEngineeringTaskLinkageFromBomForTechnicalVersion(taskOnlyVersionId, bomRows)?.masterOrder.masterOrderId,
  secondMaster.masterOrderId,
  '仅 createdFromTaskId 时应关联任务所属工程主单',
)
const noSourceVersionId = createSourceVersion('NONE', '', '')
assert.equal(applyEngineeringTaskLinkageFromBomForTechnicalVersion(noSourceVersionId, bomRows), null, '无权威来源时不得联动')
const conflictVersionId = createSourceVersion(
  'CONFLICT',
  master.masterOrderId,
  `${secondMaster.masterOrderId}-TECH_PACK_CONFIRMATION`,
)
assert.throws(
  () => applyEngineeringTaskLinkageFromBomForTechnicalVersion(conflictVersionId, bomRows),
  /技术包工程来源不一致，无法同步 BOM 工艺任务。/,
  '双权威来源指向不同主单时必须明确阻断',
)

const atomicVersionId = createSourceVersion('ATOMIC', master.masterOrderId, '')
const engineeringSnapshotBeforeSaveFailure = getEngineeringMasterOrderStoreSnapshot()
const technicalSnapshotBeforeSaveFailure = getTechnicalDataVersionStoreSnapshot()
assert.throws(
  () => saveTechnicalDataVersionContentWithEngineeringLinkage(
    atomicVersionId,
    bomRows,
    { patternDesc: '不应保存' },
    '买手A',
    {
      saveTechnicalContent: () => {
        throw new Error('模拟技术包保存失败')
      },
    },
  ),
  /模拟技术包保存失败/,
)
assert.deepEqual(getEngineeringMasterOrderStoreSnapshot(), engineeringSnapshotBeforeSaveFailure, '技术包保存失败必须恢复工程仓')
assert.deepEqual(getTechnicalDataVersionStoreSnapshot(), technicalSnapshotBeforeSaveFailure, '技术包保存失败必须恢复技术版本仓')

const engineeringSnapshotBeforeApplyFailure = getEngineeringMasterOrderStoreSnapshot()
const technicalSnapshotBeforeApplyFailure = getTechnicalDataVersionStoreSnapshot()
assert.throws(
  () => saveTechnicalDataVersionContentWithEngineeringLinkage(
    atomicVersionId,
    bomRows,
    { patternDesc: '也不应保存' },
    '买手A',
    {
      applyEngineeringTasks: (masterOrderId, rows) => {
        applyBomRequirementsToEngineeringTasks(masterOrderId, rows)
        throw new Error('模拟工程同步失败')
      },
    },
  ),
  /模拟工程同步失败/,
)
assert.deepEqual(getEngineeringMasterOrderStoreSnapshot(), engineeringSnapshotBeforeApplyFailure, '工程同步失败必须恢复工程仓')
assert.deepEqual(getTechnicalDataVersionStoreSnapshot(), technicalSnapshotBeforeApplyFailure, '工程同步失败必须恢复技术版本仓')

const prevalidationVersionId = createSourceVersion('PREVALIDATE', secondMaster.masterOrderId, '')
const secondPatternTaskId = `${secondMaster.masterOrderId}-PATTERN_ARTWORK`
updateEngineeringTaskRecord(secondMaster.masterOrderId, secondPatternTaskId, (_task, current) => {
  current.tasks = current.tasks.filter((item) => item.taskType !== 'PATTERN_ARTWORK')
})
let technicalSaveCalled = false
assert.throws(
  () => saveTechnicalDataVersionContentWithEngineeringLinkage(
    prevalidationVersionId,
    bomRows,
    { patternDesc: '不应进入保存' },
    '买手A',
    {
      saveTechnicalContent: () => {
        technicalSaveCalled = true
        throw new Error('不应调用技术包保存')
      },
    },
  ),
  /缺少.*花型任务.*骨架/,
  '写入技术包前必须先完成工程骨架预校验',
)
assert.equal(technicalSaveCalled, false, '工程预校验失败不得开始技术包保存')

console.log('pcs-engineering-bom-task-linkage-page.spec.ts PASS')
