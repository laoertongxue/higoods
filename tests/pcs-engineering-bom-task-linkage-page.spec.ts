import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  createEngineeringMasterOrder,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
} from '../src/data/pcs-engineering-master-repository.ts'
import {
  applyEngineeringTaskLinkageFromBomForTechnicalVersion,
  type BomItemRow,
} from '../src/pages/tech-pack/context.ts'
import {
  createTechnicalDataVersionDraft,
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
assert.match(persistBlock, /applyEngineeringTaskLinkageFromBomForTechnicalVersion\(state\.currentTechnicalVersionId, state\.bomItems\)/)
assert.match(persistBlock, /saveTechnicalDataVersionContent/)
assert.ok(
  persistBlock.indexOf('applyEngineeringTaskLinkageFromBomForTechnicalVersion') < persistBlock.indexOf('saveTechnicalDataVersionContent'),
  'BOM 保存时必须先通过工程骨架门禁，再保存技术包内容',
)

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

console.log('pcs-engineering-bom-task-linkage-page.spec.ts PASS')
