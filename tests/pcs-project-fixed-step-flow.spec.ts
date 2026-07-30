import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  PROJECT_FLOW_STAGE_CONTRACTS,
  listProjectFlowStageContracts,
} from '../src/data/pcs-project-domain-contract.ts'
import { buildProjectNodes } from '../src/data/pcs-project-node-factory.ts'
import {
  createEmptyProjectDraft,
  createProject,
  getProjectCreateCatalog,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import {
  findStyleArchiveByProjectId,
  resetStyleArchiveRepository,
} from '../src/data/pcs-style-archive-repository.ts'

const expectedSteps = [
  { stepCode: 'PROJECT_ARCHIVE', stepName: '项目与档案建立', sequence: 1 },
  { stepCode: 'SAMPLE_PREPARATION', stepName: '样衣准备', sequence: 2 },
  { stepCode: 'PRE_TEST_PREPARATION', stepName: '测款前准备', sequence: 3 },
  { stepCode: 'MARKET_TESTING', stepName: '市场测款', sequence: 4 },
  { stepCode: 'TEST_DECISION_CLOSURE', stepName: '测款判断与收尾', sequence: 5 },
]

assert.deepEqual(
  listProjectFlowStageContracts().map(({ stepCode, stepName, sequence }) => ({ stepCode, stepName, sequence })),
  expectedSteps,
  '商品项目必须按固定五步业务契约依次推进',
)
assert.deepEqual(
  PROJECT_FLOW_STAGE_CONTRACTS.map(({ stepCode, stepName, sequence }) => ({ stepCode, stepName, sequence })),
  expectedSteps,
  '导出的固定五步契约必须与查询结果一致',
)

const builtNodes = buildProjectNodes({
  projectId: 'prj_fixed_step_test',
  ownerId: 'owner-test',
  ownerName: '测试负责人',
  createdAt: '2026-07-30 10:00',
})
assert.ok(builtNodes.length > 5, '固定五步应承接现有业务表单节点，而不是丢弃业务办理入口')
const requiredDetailedNodeCodes = [
  'SAMPLE_SHOOT_FIT',
  'SAMPLE_CONFIRM',
  'SAMPLE_COST_REVIEW',
  'SAMPLE_PRICING',
  'FEASIBILITY_REVIEW',
  'CHANNEL_PRODUCT_LISTING',
]
assert.deepEqual(
  requiredDetailedNodeCodes.filter(
    (stepCode) => !builtNodes.some((node) => node.stepCode === stepCode),
  ),
  [],
  '测款前准备必须保留现有关键业务表单入口',
)
assert.deepEqual(
  Array.from(new Set(builtNodes.map((node) => node.phaseName))),
  expectedSteps.map((step) => step.stepName),
  '节点工厂只能按固定五步契约组织业务节点',
)
assert.equal(
  builtNodes.filter((node) => node.stepCode === 'PROJECT_INIT').length,
  1,
  '项目与档案建立必须由唯一固定步骤承接，并在创建项目时同步建档',
)

resetProjectRepository()
resetStyleArchiveRepository()

const catalog = getProjectCreateCatalog()
const category = catalog.categories[0]
const subCategory = category?.children[0]
const brand = catalog.brands[0]
const styleCode = catalog.styleCodes[0] || catalog.styles[0]
const owner = catalog.owners[0]
const team = catalog.teams[0]
const draftWithoutTemplate = createEmptyProjectDraft()

const created = createProject(
  {
    ...draftWithoutTemplate,
    projectName: '固定五步商品测款项目',
    projectType: '商品开发',
    projectSourceType: '企划提案',
    categoryId: category?.id || 'cat-top',
    categoryName: category?.name || '上衣',
    subCategoryId: subCategory?.id || '',
    subCategoryName: subCategory?.name || '',
    brandId: brand?.id || 'brand-test',
    brandName: brand?.name || '测试品牌',
    styleCodeId: styleCode?.id || 'style-test',
    styleCodeName: styleCode?.name || '测试款式',
    styleNumber: 'TEST-STYLE-001',
    yearTag: '2026',
    priceRangeLabel: '10美元~20美元',
    targetChannelCodes: [catalog.channelOptions[0]?.code || 'TIKTOK_ID'],
    ownerId: owner?.id || 'owner-test',
    ownerName: owner?.name || '测试负责人',
    teamId: team?.id || 'team-test',
    teamName: team?.name || '商品企划组',
  },
  '测试用户',
)

assert.equal(created.phases.length, 5, '新建项目必须生成且只生成五个固定步骤')
assert.deepEqual(
  created.phases.map((phase) => phase.phaseName),
  expectedSteps.map((step) => step.stepName),
)
assert.ok(created.project.linkedStyleId, '创建商品项目时必须同步关联商品／款式档案')
const styleArchive = findStyleArchiveByProjectId(created.project.projectId)
assert.ok(styleArchive, '创建商品项目时必须同步创建商品／款式档案')
assert.equal(styleArchive?.baseInfoStatus, '商品测款', '新建商品／款式档案状态必须为“商品测款”')
assert.equal(styleArchive?.styleId, created.project.linkedStyleId, '项目与商品／款式档案必须双向保持同一关联')

const pageSource = readFileSync(new URL('../src/pages/pcs-projects.ts', import.meta.url), 'utf8')
assert.doesNotMatch(pageSource, new RegExp(['getPcs', 'StepDefinition'].join('')), '商品项目页面不得再读取已删除定义')
assert.doesNotMatch(
  pageSource,
  new RegExp(['listActiveProject', 'Templates|getProject', 'TemplateById|countTemplateStages|countTemplateSteps'].join('')),
  '商品项目页面不得再读取已删除运行时',
)
assert.match(pageSource, /ProjectFlowStageCode/, '商品项目页面应由固定步骤编码分派')

console.log('pcs-project-fixed-step-flow.spec.ts PASS')
