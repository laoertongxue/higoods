import assert from 'node:assert/strict'
import { getStyleArchiveById, listStyleArchives, updateStyleArchive } from '../src/data/pcs-style-archive-repository.ts'
import { listSkuArchives } from '../src/data/pcs-sku-archive-repository.ts'
import { createTestingOrder, listTestingOrders } from '../src/data/pcs-testing-order-repository.ts'
import { PRODUCT_INFORMATION_FIELDS, renderProductInformation } from '../src/pages/pcs-product-information.ts'
import { renderPcsTestingOrderDetailPage } from '../src/pages/pcs-testing-order-detail.ts'
import { renderPcsTestingOrderListPage } from '../src/pages/pcs-testing-order-list.ts'
import { renderPcsTestingOrderCreatePage } from '../src/pages/pcs-testing-order-create.ts'

const candidate = listTestingOrders().find((order) => order.status === '已结束')!
const styleId = candidate.styleId
const style = getStyleArchiveById(styleId)!
const styleCount = listStyleArchives().length
const skuCount = listSkuArchives().length
assert.equal(createTestingOrder({ styleId, buyerName: '验收买手', skuCodes: ['错误SKU'] }).ok, false)
assert.equal(createTestingOrder({ styleId, buyerName: '验收买手', skuCodes: [] }).ok, false)
const result = createTestingOrder({ styleId, buyerName: '  验收买手  ' })
assert.equal(result.ok, true)
assert.equal(result.order!.buyerName, '验收买手')
assert.equal(listStyleArchives().length, styleCount)
assert.equal(listSkuArchives().length, skuCount)
assert.equal(createTestingOrder({ styleId, buyerName: '第二买手' }).ok, false)
assert.equal('fabricTags' in result.order!, false, '测款单不能复制商品属性')
updateStyleArchive(styleId, { productType: '常规商品', brandName: '验收品牌', categoryName: '女装', subCategoryName: '上衣', thirdCategoryName: '衬衫', materialType: '非毛织', categoryTags: ['上衣'], styleTags: ['休闲'], popularElementTags: ['印花'], fabricTags: ['涤纶'], targetAudienceTags: ['成熟'], ageTags: ['25-45'], audiencePositionTags: ['非穆斯林'], categoryCode: '10', categoryCodeName: 'print shirt-45-60印花衬衫', productPosition: '设计款' })
const detail = renderPcsTestingOrderDetailPage(result.order!.testingOrderId)
for (const [, label] of PRODUCT_INFORMATION_FIELDS) assert.ok(detail.includes(label), label)
for (const value of ['验收品牌', '衬衫', '非毛织', '25-45', '非穆斯林', '设计款', 'print shirt-45-60印花衬衫', '验收买手']) assert.ok(detail.includes(value), value)
updateStyleArchive(styleId, { fabricTags: ['棉', '麻'] })
assert.ok(renderPcsTestingOrderDetailPage(result.order!.testingOrderId).includes('棉、麻'), '档案更新后详情读取当前档案')
const snapshot = getStyleArchiveById(styleId)!
snapshot.fabricTags!.push('不可污染')
assert.deepEqual(getStyleArchiveById(styleId)!.fabricTags, ['棉', '麻'])
assert.ok(renderPcsTestingOrderListPage().includes('验收买手'))
const create = renderPcsTestingOrderCreatePage()
assert.ok(create.includes('新建测款单'))
assert.ok(!create.includes('新款系统建档'))
assert.ok(!create.includes('data-product-info-field'), '建单没有商品属性编辑控件')
assert.ok(!renderProductInformation(style).includes('data-product-info-field'))
assert.ok(renderProductInformation({ ...style, materialType: '', categoryCode: '' }).includes('待完善'))
updateStyleArchive(styleId, style)
console.log('PCS testing product information: PASS (source, buyer, SKU boundaries, duplicate prevention, read-through, no archive creation)')
