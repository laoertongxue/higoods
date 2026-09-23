import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildSkuFixture, buildStyleFixture, migrateProductFixtureImage } from '../../src/data/pcs-product-archive-fixtures.ts'
import { migrateMaterialMockGallery, migrateMaterialMockImage, reviewedStyleImage } from '../../src/data/pcs-reviewed-image-catalog.ts'
import { POST_FINISHING_PRODUCTION_SOURCE_FIXTURES, migratePostFinishingMockImages } from '../../src/data/fcs/post-finishing-production-source-fixtures.ts'

test('PCS 图片按款号和颜色固定，尺码不改变照片，未知对象没有随机图片', () => {
  const white = buildSkuFixture('ASYSA26060310', '女式基础圆领短袖', 'White', 'S').skuImageUrl
  assert.equal(white, '/materials/pcs-reviewed/tee-white.jpg')
  assert.equal(white, buildSkuFixture('ASYSA26060310', '女式基础圆领短袖', 'White', 'XL').skuImageUrl)
  assert.notEqual(white, buildSkuFixture('ASYSA26060310', '女式基础圆领短袖', 'Black', 'S').skuImageUrl)
  assert.equal(buildStyleFixture('NEW-UNKNOWN', '新款').mainImageUrl, '')
  assert.equal(buildSkuFixture('ASYSA26060310', '女式基础圆领短袖', '未配色', 'M').skuImageUrl, '')
})

test('历史 Mock 只替换登记的旧图，保留用户图片及未知款式', () => {
  const old = '/materials/archive/291197a6d0717c9d8832fff8b329299e.jpg'
  assert.equal(migrateProductFixtureImage('ASYSA26060310', old, 'White'), reviewedStyleImage('ASYSA26060310', 'White'))
  assert.equal(migrateProductFixtureImage('CUSTOM-STYLE', old), old)
  assert.equal(migrateProductFixtureImage('ASYSA26060310', '/uploads/my-own.jpg', 'White'), '/uploads/my-own.jpg')
  assert.equal(migrateMaterialMockImage('THREAD-40S-002-WHT', old, 'sku'), '/materials/pcs-reviewed/thread-white.jpg')
  assert.equal(migrateMaterialMockImage('THREAD-40S-002-WHT', '/uploads/my-thread.jpg', 'sku'), '/uploads/my-thread.jpg')
  assert.deepEqual(migrateMaterialMockGallery('THREAD-40S-002', [old, '/uploads/packaging.jpg']), ['/materials/pcs-reviewed/thread-white.jpg', '/uploads/packaging.jpg'])
})

test('后道 QC 来源 SKU 保留原身份和数量，五种颜色分别绑定对应实拍', () => {
  for (const source of POST_FINISHING_PRODUCTION_SOURCE_FIXTURES) {
    assert.equal(source.skus.length, 5)
    assert.equal(new Set(source.skus.map((sku) => sku.imageUrl)).size, 5)
    assert.equal(source.skus.reduce((total, sku) => total + sku.plannedQty, 0), 500)
    for (const sku of source.skus) assert.equal(sku.imageUrl, reviewedStyleImage(source.spuCode, sku.colorName))
  }
})

test('后道历史快照只迁移准确 SKU 的旧示意图，质检数量与用户图不变', () => {
  const sku = POST_FINISHING_PRODUCTION_SOURCE_FIXTURES[0].skus[1]
  const data = { qcTasks: [{ status: '质检完成', lines: [{ sku: { ...sku, imageUrl: '/shirt-sample.jpg' }, expectedQty: 80 }], results: [{ sku: { ...sku, imageUrl: '/uploads/customer.jpg' }, passedQty: 75, defectQty: 5 }] }], legacyRaw: '{old snapshot}' }
  const expected = structuredClone(data)
  expected.qcTasks[0].lines[0].sku.imageUrl = sku.imageUrl
  migratePostFinishingMockImages(data)
  assert.deepEqual(data, expected)
  migratePostFinishingMockImages(data)
  assert.deepEqual(data, expected)
})
