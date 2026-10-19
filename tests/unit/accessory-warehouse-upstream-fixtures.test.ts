import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildAccessoryWarehouseUpstreamFixtures, listAccessoryFixtureMaterials } from '../../src/data/wls/accessory-warehouse-upstream-fixtures.ts'
import { SEA_CUTTING_FACTORY_ID, SEA_CUTTING2_FACTORY_ID } from '../../src/data/fcs/factory-mock-data.ts'
import { isAccessoryWarehouseScopeLine } from '../../src/data/fcs/cutting/production-material-prep.ts'

test('F01/F02/F03 共用真实主线身份；固定 100 件，不修改主工厂或发明自动分配规则', () => {
  const fixtures = buildAccessoryWarehouseUpstreamFixtures(), first = structuredClone(fixtures)
  assert.deepEqual(fixtures.map(row => row.key), ['F01', 'F02', 'F03'])
  for (const fixture of fixtures) {
    const { demand, order, techPack, tasks } = fixture
    assert.equal(demand.productionOrderId, order.productionOrderId)
    assert.equal(order.demandId, demand.demandId)
    assert.equal(order.techPackSnapshot?.snapshotId, techPack.snapshotId)
    assert.equal(techPack.productionOrderId, order.productionOrderId)
    assert.equal(demand.skuLines.reduce((sum, sku) => sum + sku.qty, 0), 100)
    assert.deepEqual(order.demandSnapshot.skuLines, demand.skuLines)
    assert.equal(order.mainFactoryStatus, 'PENDING_SEWING_ASSIGNMENT')
    assert.equal(tasks.length, 2)
    assert.equal(tasks[1].assignmentStatus, 'UNASSIGNED')
    assert.deepEqual(tasks[1].dependsOnTaskIds, [tasks[0].taskId])
    assert.equal(existsSync(resolve('public', demand.imageUrl.slice(1))), true)
  }
  assert.equal(fixtures[0].tasks[0].assignedFactoryId, SEA_CUTTING_FACTORY_ID)
  assert.equal(fixtures[1].tasks[0].assignedFactoryId, SEA_CUTTING2_FACTORY_ID)
  assert.equal(fixtures[1].assignments[0].factoryName, 'sea cutting2')
  assert.equal(fixtures[1].assignments[0].runtimeTaskId, fixtures[1].tasks[0].taskId)
  assert.equal(fixtures[2].tasks[0].assignmentStatus, 'UNASSIGNED')
  assert.equal(fixtures[2].tasks[0].assignedFactoryId, undefined)
  assert.deepEqual(fixtures[2].assignments, [])
  fixtures[0].order.demandSnapshot.skuLines[0].qty = 1
  assert.deepEqual(buildAccessoryWarehouseUpstreamFixtures(), first)
})

test('六种辅料和需裁剪面料分开；四类排除身份明确、单位和 BOM 用量可追溯', () => {
  const materials = listAccessoryFixtureMaterials(), fixture = buildAccessoryWarehouseUpstreamFixtures()[0]
  assert.equal(materials.length, 6)
  assert.equal(materials.filter(material => material.purpose === '其他').length, 2)
  assert.deepEqual(materials.filter(material => material.purpose !== '其他').map(material => material.purpose), ['价格吊牌', '品牌吊牌', '吊粒', '车缝线'])
  for (const bom of fixture.techPack.bomItems) {
    const prepOrderId = `prep-order-${fixture.order.productionOrderId}`
    const inScope = isAccessoryWarehouseScopeLine({
      prepLineId: `${prepOrderId}:${fixture.techPack.sourceTechPackVersionId}:${bom.id}`,
      materialSku: bom.materialCode!, materialName: bom.name,
      materialType: bom.type === '包装材料' ? '包材' : bom.type === '纱线' ? '纱线' : bom.type === '面料' ? '面料' : '辅料',
    }, { prepOrderId, productionOrderId: fixture.order.productionOrderId, spu: fixture.demand.spuCode }, fixture.techPack)
    assert.equal(inScope, bom.materialCode !== 'AW-DEMO-FABRIC')
  }
  assert.equal(fixture.techPack.bomItems.find(bom => bom.materialCode === 'AW-DEMO-SEWING-THREAD')?.unitConsumption, 0.01)
  assert.equal(fixture.techPack.bomItems.find(bom => bom.materialCode === 'AW-DEMO-BUTTON')?.unitConsumption, 2)
})

test('物料缺图显式登记，不把洗护唛借给吊牌/吊粒；补齐素材只改变图片，不改数量身份', () => {
  const base = buildAccessoryWarehouseUpstreamFixtures()[1]
  assert.deepEqual(base.assetIssues.map(issue => issue.materialName), ['价格吊牌', '品牌吊牌', '吊粒'])
  for (const material of listAccessoryFixtureMaterials().filter(material => material.imageUrl)) {
    assert.equal(existsSync(resolve('public', material.imageUrl.slice(1))), true)
    assert.ok(material.imageSource)
  }
  const patched = buildAccessoryWarehouseUpstreamFixtures({ materialAssets: {
    价格吊牌: '/verified/price-tag.jpg', 品牌吊牌: '/verified/brand-tag.jpg', 吊粒: '/verified/fastener.jpg',
  } })[1]
  assert.equal(patched.assetIssues.length, 0)
  assert.deepEqual(patched.demand, base.demand)
  assert.deepEqual(patched.techPack.bomItems.map(bom => [bom.id, bom.materialCode, bom.unit, bom.unitConsumption]),
    base.techPack.bomItems.map(bom => [bom.id, bom.materialCode, bom.unit, bom.unitConsumption]))
})
