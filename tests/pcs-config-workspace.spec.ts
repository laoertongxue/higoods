import assert from 'node:assert/strict'
import {
  canDeleteProductCategoryNode,
  getConfigDimensionOption,
  listConfigDimensionOptions,
  listConfigWorkspaceSummaries,
  listRootProductCategories,
  resetConfigWorkspaceRepository,
  saveConfigDimensionOption,
} from '../src/data/pcs-config-workspace-repository.ts'
import {
  listProjectWorkspaceBrands,
  listProjectWorkspaceColors,
  listProjectWorkspaceSizes,
} from '../src/data/pcs-project-config-workspace-adapter.ts'
import {
  handlePcsConfigWorkspaceEvent,
  renderPcsConfigWorkspacePage,
  resetPcsConfigWorkspaceState,
} from '../src/pages/pcs-config-workspace.ts'

function makeActionTarget(
  action: string,
  extraDataset: Record<string, string> = {},
): HTMLElement {
  return {
    dataset: {
      pcsConfigWorkspaceAction: action,
      ...extraDataset,
    },
    closest() {
      return this
    },
  } as unknown as HTMLElement
}

resetConfigWorkspaceRepository()
resetPcsConfigWorkspaceState()

const expectedCounts = {
  brands: 7,
  crowdPositioning: 3,
  ages: 3,
  crowds: 3,
  productPositioning: 5,
  specialCrafts: 9,
  sizes: 9,
  trendElements: 31,
  fabrics: 24,
  styles: 13,
  categories: 35,
  colors: 86,
  styleCodes: 116,
} as const

const summaryMap = new Map(listConfigWorkspaceSummaries().map((item) => [item.id, item]))

assert.equal(summaryMap.get('productCategories')?.count, null, '商品类目应按树形维度展示，不显示固定总数')

Object.entries(expectedCounts).forEach(([dimensionId, expected]) => {
  assert.equal(summaryMap.get(dimensionId)?.count, expected, `${dimensionId} 维度数量应与需求一致`)
})

const categoryHtml = renderPcsConfigWorkspacePage()
assert.match(categoryHtml, /配置维度/, '应渲染配置维度导航')
assert.match(categoryHtml, /商品类目/, '默认应打开商品类目')
assert.match(categoryHtml, /删除规则/, '商品类目页应展示删除规则')
assert.match(categoryHtml, /女装/, '商品类目页应展示树形类目')
assert.match(categoryHtml, /日志 3 条/, '商品类目节点应展示日志条数')

handlePcsConfigWorkspaceEvent(makeActionTarget('switch-dimension', { dimensionId: 'brands' }))
const brandHtml = renderPcsConfigWorkspacePage()
assert.match(brandHtml, /品牌/, '切换后应渲染品牌维度')
assert.match(brandHtml, /Chicmore/, '品牌维度应展示预置品牌')
assert.match(brandHtml, /更新时间/, '品牌维度应展示更新时间列')
assert.match(brandHtml, /更新人/, '品牌维度应展示更新人列')
assert.match(brandHtml, /新建配置项/, '品牌维度应展示新增入口')

const firstBrand = listConfigDimensionOptions('brands')[0]
assert.ok(firstBrand.updatedAt, '配置项应记录更新时间')
assert.ok(firstBrand.updatedBy, '配置项应记录更新人')
assert.equal(firstBrand.logs.length, 3, '初始配置项应带操作日志')

handlePcsConfigWorkspaceEvent(
  makeActionTarget('open-flat-logs', {
    dimensionId: 'brands',
    optionId: firstBrand.id,
  }),
)
const brandLogHtml = renderPcsConfigWorkspacePage()
assert.match(brandLogHtml, /品牌日志详情/, '日志弹窗应显示维度名称')
assert.match(brandLogHtml, /审计信息/, '日志弹窗应显示审计信息')
assert.match(brandLogHtml, /操作日志/, '日志弹窗应显示操作日志列表')

const createdBrand = saveConfigDimensionOption(
  'brands',
  null,
  {
    nameZh: 'TEST品牌',
    nameEn: 'TEST BRAND',
    sortOrder: 8,
    status: 'ENABLED',
  },
  '测试用户',
)

assert.equal(createdBrand.updatedBy, '测试用户', '新增配置应记录更新人')
assert.ok(createdBrand.updatedAt, '新增配置应写入更新时间')
assert.equal(createdBrand.logs.at(-1)?.action, '新增配置', '新增配置应写入新增日志')

const createdBrandDetail = getConfigDimensionOption('brands', createdBrand.id)
assert.equal(createdBrandDetail?.name_zh, 'TEST品牌', '新增品牌应写回仓储')
assert.equal(createdBrandDetail?.logs.length, 1, '新增品牌应至少生成一条日志')
assert.ok(
  listProjectWorkspaceBrands().some((item) => item.name === 'TEST品牌'),
  '商品项目配置源应直接读取配置工作台新增的品牌',
)
assert.ok(
  listProjectWorkspaceColors().some((item) => item.name === 'Rose'),
  '颜色维度适配层应直接读取配置工作台',
)
assert.ok(
  listProjectWorkspaceSizes().some((item) => item.name === 'One Size'),
  '尺码维度适配层应直接读取配置工作台',
)

const roots = listRootProductCategories()
assert.ok(roots.some((item) => item.name === '女装'), '应保留商品类目树根节点')
assert.equal(canDeleteProductCategoryNode('product-category-3'), false, '存在商品引用的叶子类目不允许删除')
assert.equal(canDeleteProductCategoryNode('product-category-4'), true, '无商品引用的叶子类目允许删除')

console.log('pcs-config-workspace.spec.ts PASS')
