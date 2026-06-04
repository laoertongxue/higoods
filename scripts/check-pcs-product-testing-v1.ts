import assert from 'node:assert/strict'

import {
  DOMESTIC_PURCHASE_SAMPLE_TEMPLATE_ID,
  WANLONG_REVISION_SAMPLE_TEMPLATE_ID,
  getProjectWorkItemContract,
  listProjectTemplateSchemas,
  listProjectWorkItemContracts,
  type PcsProjectWorkItemCode,
} from '../src/data/pcs-project-domain-contract.ts'
import { ensurePcsProjectDemoDataReady } from '../src/data/pcs-project-demo-seed-service.ts'
import {
  createEmptyProjectDraft,
  createProject,
  getProjectCreateCatalog,
  listActiveProjectTemplates,
  listProjectNodes,
  listProjectPhases,
  listProjects,
} from '../src/data/pcs-project-repository.ts'
import { listProjectTemplates } from '../src/data/pcs-templates.ts'

const domesticFlow: PcsProjectWorkItemCode[] = [
  'PROJECT_INIT',
  'SAMPLE_ACQUIRE',
  'SAMPLE_INBOUND_CHECK',
  'CHANNEL_PRODUCT_LISTING',
  'LIVE_TEST',
  'VIDEO_TEST',
  'TEST_DATA_SUMMARY',
  'TEST_CONCLUSION',
  'STYLE_ARCHIVE_CREATE',
  'SAMPLE_RETURN_HANDLE',
]

const wanlongFlow: PcsProjectWorkItemCode[] = [
  'PROJECT_INIT',
  'SAMPLE_ACQUIRE',
  'REVISION_TASK',
  'SAMPLE_INBOUND_CHECK',
  'CHANNEL_PRODUCT_LISTING',
  'LIVE_TEST',
  'VIDEO_TEST',
  'TEST_DATA_SUMMARY',
  'TEST_CONCLUSION',
  'STYLE_ARCHIVE_CREATE',
  'SAMPLE_RETURN_HANDLE',
]

function fieldKeys(workItemTypeCode: PcsProjectWorkItemCode): string[] {
  return getProjectWorkItemContract(workItemTypeCode).fieldDefinitions.map((field) => field.fieldKey)
}

function fieldOptions(workItemTypeCode: PcsProjectWorkItemCode, fieldKey: string): string[] {
  const field = getProjectWorkItemContract(workItemTypeCode).fieldDefinitions.find((item) => item.fieldKey === fieldKey)
  return field?.options?.map((option) => option.value) ?? []
}

function assertIncludesAll(actual: string[], expected: string[], message: string): void {
  const missing = expected.filter((item) => !actual.includes(item))
  assert.deepEqual(missing, [], message)
}

function flattenSchemaNodeCodes(templateId: string): string[] {
  const schema = listProjectTemplateSchemas().find((item) => item.templateId === templateId)
  assert.ok(schema, `缺少模板矩阵：${templateId}`)
  return schema.phaseSchemas.flatMap((phase) => phase.nodeCodes)
}

function buildDraft(templateId: string) {
  const catalog = getProjectCreateCatalog()
  const category = catalog.categories[0]
  const child = category.children[0]
  const brand = catalog.brands[0]
  const owner = catalog.owners[0]
  const team = catalog.teams[0]

  return {
    ...createEmptyProjectDraft(),
    projectName: templateId === WANLONG_REVISION_SAMPLE_TEMPLATE_ID ? '验收-万隆改版出样衣测款项目' : '验收-国内采购样衣测款项目',
    projectSourceType: catalog.projectSourceTypes[0],
    templateId,
    categoryId: category.id,
    categoryName: category.name,
    subCategoryId: child?.id ?? '',
    subCategoryName: child?.name ?? '',
    brandId: brand.id,
    brandName: brand.name,
    yearTag: catalog.yearTags[1] ?? catalog.yearTags[0],
    priceRangeLabel: catalog.priceRanges[1] ?? catalog.priceRanges[0],
    targetChannelCodes: catalog.channelOptions.slice(0, 1).map((item) => item.code),
    ownerId: owner.id,
    ownerName: owner.name,
    teamId: team.id,
    teamName: team.name,
    priorityLevel: '中' as const,
  }
}

const templates = listProjectTemplates()
const activeTemplates = listActiveProjectTemplates()
const schemas = listProjectTemplateSchemas()

assert.equal(templates.length, 2, '项目模板 mock 应收口为 2 套正式业务模板')
assert.equal(activeTemplates.length, 2, '两套正式业务模板都应启用')
assert.deepEqual(
  templates.map((item) => item.name).sort(),
  ['万隆改版出样衣测款项目', '国内采购样衣测款项目'].sort(),
  '模板名称应为两套正式测款项目模板',
)
assert.equal(schemas.length, 2, '正式模板矩阵只应保留两套')
assert.ok(!templates.some((item) => /快时尚款 -|设计款 -|完整测款转档|直播快反|设计验证/.test(item.name)), '模板列表不应保留旧四模板名称')

ensurePcsProjectDemoDataReady()
assert.equal(listProjects().length, 0, '清洁状态下不应自动注入商品项目 mock')

assert.deepEqual(flattenSchemaNodeCodes(DOMESTIC_PURCHASE_SAMPLE_TEMPLATE_ID), domesticFlow, '国内采购样衣测款模板节点顺序不符合 v1.0')
assert.deepEqual(flattenSchemaNodeCodes(WANLONG_REVISION_SAMPLE_TEMPLATE_ID), wanlongFlow, '万隆改版出样衣测款模板节点顺序不符合 v1.0')

const workItemCodes = listProjectWorkItemContracts().map((item) => item.workItemTypeCode)
assertIncludesAll(workItemCodes, Array.from(new Set([...domesticFlow, ...wanlongFlow])), '工作项库缺少 v1.0 模板所需工作项')

assertIncludesAll(
  fieldKeys('SAMPLE_ACQUIRE'),
  ['purchaseSupplierName', 'sampleLink', 'freightAmount', 'receiverName', 'saleType', 'targetRegionCodes', 'needTransitFlag', 'skuPurchaseQty'],
  '样衣获取字段未覆盖样衣来源和采购样衣要素',
)
assert.deepEqual(
  fieldOptions('SAMPLE_ACQUIRE', 'sampleSourceType'),
  ['外采', '委托打样'],
  '样衣获取来源方式只能保留业务模板允许的外采/委托打样',
)
assert.deepEqual(
  getProjectCreateCatalog().sampleSourceTypes,
  ['外采', '委托打样'],
  '创建目录不得再提供业务模板外的样衣来源方式',
)
assertIncludesAll(
  fieldKeys('REVISION_TASK'),
  ['baseStyleCode', 'targetStyleCodeCandidate', 'revisionScopeNames', 'sampleQty', 'stylePreference', 'revisionSuggestionRichText', 'materialAdjustmentLines', 'newPatternSpuCode', 'patternChangeNote', 'patternFileIds', 'designDraftImageIds', 'ownerName', 'dueAt'],
  '改版任务字段未覆盖工程开发与打样承接信息',
)
assertIncludesAll(
  fieldKeys('SAMPLE_INBOUND_CHECK'),
  ['sampleCode', 'receivedQty', 'receivedAt', 'sampleImageIds', 'qualityCheckResult', 'testableFlag', 'checkResult'],
  '样衣结果核对字段未覆盖到样核对和可测判断',
)
assertIncludesAll(
  fieldKeys('SAMPLE_RETURN_HANDLE'),
  ['handleType', 'destination', 'handledQty', 'handledBy', 'handledAt', 'returnResult'],
  '样衣退回处理字段未覆盖退样、入库、清仓、寄回等处理信息',
)

const conclusionField = getProjectWorkItemContract('TEST_CONCLUSION').fieldDefinitions.find((field) => field.fieldKey === 'conclusion')
assert.deepEqual(
  conclusionField?.options?.map((option) => option.value),
  ['通过', '不通过', '继续测试'],
  '测款结论必须为通过、不通过、继续测试',
)
assertIncludesAll(
  fieldKeys('TEST_CONCLUSION'),
  ['productPositioningConclusion', 'stockGrade', 'continueTestFlag', 'downShelfFlag', 'returnDestination', 'nextTestPlan'],
  '测款结论字段未覆盖产品定位、备货等级、继续测试、下架和退回去向',
)

const domesticProject = createProject(buildDraft(DOMESTIC_PURCHASE_SAMPLE_TEMPLATE_ID), '验收脚本').project
assert.equal(domesticProject.projectType, '商品开发', '国内采购样衣测款项目应生成商品开发项目类型')
assert.ok(!(('style' + 'Type') in domesticProject), '商品项目主记录不应再包含旧属性字段')
assert.deepEqual(
  listProjectNodes(domesticProject.projectId).map((node) => node.workItemTypeCode),
  domesticFlow,
  '国内采购样衣测款项目创建后的节点顺序不正确',
)
assert.deepEqual(
  listProjectPhases(domesticProject.projectId).map((phase) => phase.phaseCode),
  ['PHASE_01', 'PHASE_02', 'PHASE_03', 'PHASE_04', 'PHASE_05'],
  '国内采购样衣测款项目应生成五个阶段',
)

const wanlongProject = createProject(buildDraft(WANLONG_REVISION_SAMPLE_TEMPLATE_ID), '验收脚本').project
assert.equal(wanlongProject.projectType, '改版开发', '万隆改版出样衣测款项目应生成改版开发项目类型')
assert.ok(!(('style' + 'Type') in wanlongProject), '万隆改版项目主记录不应再包含旧属性字段')
assert.deepEqual(
  listProjectNodes(wanlongProject.projectId).map((node) => node.workItemTypeCode),
  wanlongFlow,
  '万隆改版出样衣测款项目创建后的节点顺序不正确',
)

console.log('check-pcs-product-testing-v1 passed')
