import assert from 'node:assert/strict'
import { createStyleArchiveBootstrapSnapshot } from '../src/data/pcs-style-archive-bootstrap.ts'
import { createStyleArchiveDirect, getStyleArchiveById, listStyleArchives, restoreStyleArchiveRepositoryState, updateStyleArchive } from '../src/data/pcs-style-archive-repository.ts'
import { listConfigDimensionOptions, saveConfigDimensionOption, listProductCategoryNodes, saveProductCategoryNode } from '../src/data/pcs-config-workspace-repository.ts'
import { createTestingOrder, listTestingOrders, resetTestingOrderRepository, bootstrapTestingOrders } from '../src/data/pcs-testing-order-repository.ts'
import { renderProductInformation } from '../src/pages/pcs-product-information.ts'
import { renderPcsTestingOrderCreatePage } from '../src/pages/pcs-testing-order-create.ts'
import { PRODUCT_CONFIG_FIELDS } from '../src/data/pcs-style-product-information.ts'

const legacy = createStyleArchiveBootstrapSnapshot(3, false)
const custom = legacy.records.find((item) => item.styleCode === 'SPU-QC-003')!
custom.fabricTags = ['人工确认面料']; custom.buyerName = '原绑定买手'
const storage = new Map<string, string>()
const localStorage = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) }
Object.assign(globalThis, { window: { localStorage }, localStorage })
restoreStyleArchiveRepositoryState({ memorySnapshot: null, rawSnapshot: JSON.stringify(legacy) })
const records = listStyleArchives()
assert.equal(records.length, legacy.records.length)
const style = records.find((item) => item.styleCode === 'STYLE-PRJ-202603-006')!
assert.equal(style.buyerName, '陈刚')
assert.equal(style.brandName, 'FADFAD')
assert.equal(style.categoryName, '男装')
assert.equal(style.subCategoryName, '男装上衣')
assert.equal(style.thirdCategoryName, '未设三级类目')
assert.deepEqual(getStyleArchiveById(custom.styleId)!.fabricTags, ['人工确认面料'])
assert.equal(getStyleArchiveById(custom.styleId)!.buyerName, '原绑定买手')
for (const record of records) {
  assert.ok(record.buyerName)
  assert.ok(!renderProductInformation(record).includes('待完善'), record.styleCode)
  for (const dimension of Object.values(PRODUCT_CONFIG_FIELDS)) {
    for (const id of record.productConfigRefs?.[dimension] || []) assert.ok(listConfigDimensionOptions(dimension).some((item) => item.id === id))
  }
}
const brand = listConfigDimensionOptions('brands').find((item) => item.id === style.productConfigRefs!.brands![0])!
saveConfigDimensionOption('brands', brand.id, { nameZh: '品牌更名验收', status: brand.status, sortOrder: brand.sortOrder })
assert.equal(getStyleArchiveById(style.styleId)!.brandName, '品牌更名验收')
const category = listProductCategoryNodes().find((node) => node.id === style.productCategoryId)!
saveProductCategoryNode(category.id, category.parentId, { name: '男装上衣更名', status: category.status, sortOrder: category.sortOrder })
assert.equal(getStyleArchiveById(style.styleId)!.subCategoryName, '男装上衣更名')
const available = listStyleArchives().find((item) => !listTestingOrders().some((order) => order.styleId === item.styleId && order.status === '进行中') && item.styleCode.includes('PRJ'))!
updateStyleArchive(available.styleId, { buyerName: '' })
assert.equal(createTestingOrder({ styleId: available.styleId, buyerName: '绕过绑定' }).ok, false)
updateStyleArchive(available.styleId, { buyerName: available.buyerName })
const created = createTestingOrder({ styleId: available.styleId, buyerName: '恶意覆盖' })
assert.equal(created.ok, true, created.message)
assert.equal(created.order!.buyerName, available.buyerName)
updateStyleArchive(available.styleId, { buyerName: '商品重新绑定买手' })
assert.equal(listTestingOrders().find((order) => order.testingOrderId === created.order!.testingOrderId)!.buyerName, '商品重新绑定买手')
const html = renderPcsTestingOrderCreatePage()
assert.ok(!html.includes('max-w-7xl'))
assert.ok(!html.includes('data-testing-create-field="buyer"'))
const editor = renderProductInformation(style, true, true)
assert.ok(editor.includes('data-product-info-config="fabrics"'))
assert.ok(editor.includes('data-product-info-config="styleCodes"'))
console.log('PASS: 51 商品配置绑定、旧存储升级、人工值保留、配置名称联动、商品买手、防覆盖、等宽结构')

updateStyleArchive(style.styleId, { updatedAt: '2099-01-01 00:00:00' })
resetTestingOrderRepository(); bootstrapTestingOrders()
assert.equal(listTestingOrders().find((order) => order.testingOrderId === 'to_seed_normal')!.styleId, 'style_demand_SPU_QC_001', '档案更新不能使演示单换绑商品')
console.log('PASS: 档案更新时间变化不影响测款单商品绑定')

const unknown = createStyleArchiveDirect({ styleName: '用户新建未分类商品' })
assert.equal(unknown.buyerName, undefined)
assert.equal(unknown.productConfigRefs, undefined)
assert.equal(createTestingOrder({styleId:unknown.styleId,buyerName:'不能代填'}).ok,false)
