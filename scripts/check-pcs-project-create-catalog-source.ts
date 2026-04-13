import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildProjectWorkspaceCategoryOptions,
  getProjectWorkspaceSourceHintText,
  listProjectWorkspaceAges,
  listProjectWorkspaceBrands,
  listProjectWorkspaceCrowdPositioning,
  listProjectWorkspaceCrowds,
  listProjectWorkspaceProductPositioning,
  listProjectWorkspaceSourceMappings,
  listProjectWorkspaceSourceSummaries,
  listProjectWorkspaceStyleCodes,
  listProjectWorkspaceStyles,
} from '../src/data/pcs-project-config-workspace-adapter.ts'
import { listProjectWorkItemContracts } from '../src/data/pcs-project-domain-contract.ts'
import { getProjectCreateCatalog } from '../src/data/pcs-project-repository.ts'

function read(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

const catalog = getProjectCreateCatalog()
const sourceMappings = listProjectWorkspaceSourceMappings()
const sourceMap = new Map(sourceMappings.map((item) => [item.fieldKey, item]))
const configDimensionRefs = new Set([
  'brands',
  'categories',
  'styles',
  'styleCodes',
  'crowdPositioning',
  'ages',
  'crowds',
  'productPositioning',
])
const requiredMappedFields = [
  'categoryId',
  'brandId',
  'styleCodeId',
  'styleIds',
  'styleNames',
  'styleTagIds',
  'crowdPositioningIds',
  'ageIds',
  'crowdIds',
  'productPositioningIds',
  'targetChannelCodes',
  'ownerId',
  'teamId',
  'sampleSourceType',
  'sampleSupplierId',
  'targetChannelCode',
  'targetStoreId',
  'videoChannel',
  'liveSessionId',
  'liveLineId',
  'factoryId',
  'targetSite',
] as const

assert.deepEqual(
  catalog.brands.map((item) => item.name),
  listProjectWorkspaceBrands().map((item) => item.name),
  '品牌目录必须来自配置工作台 brands',
)
assert.deepEqual(
  catalog.categories.map((item) => item.name),
  buildProjectWorkspaceCategoryOptions().map((item) => item.name),
  '品类目录必须来自配置工作台 categories',
)
assert.ok(
  catalog.categories.every((item) => item.children.length === 0),
  '当前品类目录只允许使用一级品类，二级分类仅作兼容字段',
)
assert.deepEqual(
  catalog.styles.map((item) => item.name),
  listProjectWorkspaceStyles().map((item) => item.name),
  '风格标签目录必须来自配置工作台 styles',
)
assert.deepEqual(
  catalog.styleCodes.map((item) => item.name),
  listProjectWorkspaceStyleCodes().map((item) => item.name),
  '风格编号目录必须来自配置工作台 styleCodes',
)
assert.deepEqual(
  catalog.crowdPositioning.map((item) => item.name),
  listProjectWorkspaceCrowdPositioning().map((item) => item.name),
  '人群定位目录必须来自配置工作台 crowdPositioning',
)
assert.deepEqual(
  catalog.ages.map((item) => item.name),
  listProjectWorkspaceAges().map((item) => item.name),
  '年龄带目录必须来自配置工作台 ages',
)
assert.deepEqual(
  catalog.crowds.map((item) => item.name),
  listProjectWorkspaceCrowds().map((item) => item.name),
  '人群目录必须来自配置工作台 crowds',
)
assert.deepEqual(
  catalog.productPositioning.map((item) => item.name),
  listProjectWorkspaceProductPositioning().map((item) => item.name),
  '商品定位目录必须来自配置工作台 productPositioning',
)

requiredMappedFields.forEach((fieldKey) => {
  assert.ok(sourceMap.has(fieldKey), `字段 ${fieldKey} 必须存在正式来源映射`)
})

sourceMappings
  .filter((item) => item.sourceKind === '配置工作台')
  .forEach((item) => {
    assert.ok(
      configDimensionRefs.has(item.sourceRef),
      `字段 ${item.fieldKey} 被标记为配置工作台时，sourceRef 必须是正式配置维度：${item.sourceRef}`,
    )
  })

const contractConfigFields = listProjectWorkItemContracts()
  .flatMap((contract) => contract.fieldDefinitions)
  .filter((field) => field.sourceKind === '配置工作台')

contractConfigFields.forEach((field) => {
  const mapping = sourceMap.get(field.fieldKey)
  assert.ok(mapping, `字段 ${field.fieldKey} 在契约中标记为配置工作台时，必须存在正式来源映射`)
  assert.equal(mapping?.sourceKind, '配置工作台', `字段 ${field.fieldKey} 的来源映射必须保持为配置工作台`)
})

assert.equal(
  getProjectWorkspaceSourceHintText('sampleSupplierId'),
  '当前来源：样衣供应商主数据 / 样衣供应商主数据',
  '样衣来源方必须明确标注为样衣供应商主数据',
)

const projectCreateSource = read('src/pages/pcs-project-create.ts')
assert.ok(projectCreateSource.includes("'styleCodeId'"), '项目创建页必须使用 styleCodeId')
assert.ok(!projectCreateSource.includes('data-pcs-project-create-field=\"styleNumber\"'), '项目创建页不应继续渲染手填 styleNumber')
assert.ok(projectCreateSource.includes("'styleTagIds'"), '项目创建页必须使用 styleTagIds')
assert.ok(projectCreateSource.includes("'crowdPositioningIds'"), '项目创建页必须使用 crowdPositioningIds')
assert.ok(projectCreateSource.includes("'ageIds'"), '项目创建页必须使用 ageIds')
assert.ok(projectCreateSource.includes("'crowdIds'"), '项目创建页必须使用 crowdIds')
assert.ok(projectCreateSource.includes("'productPositioningIds'"), '项目创建页必须使用 productPositioningIds')
assert.ok(projectCreateSource.includes('getProjectWorkspaceSourceHintText'), '项目创建页必须通过统一来源提示函数渲染字段来源')

const repositorySource = read('src/data/pcs-project-repository.ts')
assert.ok(!repositorySource.includes('const CATEGORY_OPTIONS ='), '项目仓储不应继续维护硬编码 CATEGORY_OPTIONS')
assert.ok(!repositorySource.includes('const BRAND_OPTIONS ='), '项目仓储不应继续维护硬编码 BRAND_OPTIONS')
assert.ok(!repositorySource.includes('CHANNEL_PRODUCT_PREP'), '项目仓储不应继续保留 CHANNEL_PRODUCT_PREP')

const templateDetailSource = read('src/pages/pcs-template-detail.ts')
assert.ok(templateDetailSource.includes('listProjectWorkspaceSourceMappings'), '模板详情页必须通过适配器展示字段来源')

const nodeDetailViewModelSource = read('src/data/pcs-project-node-detail-contract-view-model.ts')
assert.ok(
  nodeDetailViewModelSource.includes('`${field.sourceKind} / ${field.sourceRef}`'),
  '节点详情字段清单必须逐字段展示 sourceKind 和 sourceRef',
)

console.log('字段来源汇总：')
listProjectWorkspaceSourceSummaries().forEach((item) => {
  console.log(`- ${item.sourceKind}: ${item.fieldCount} 个字段`)
})

console.log('check-pcs-project-create-catalog-source.ts PASS')
