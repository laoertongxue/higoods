import assert from 'node:assert/strict'
import test from 'node:test'
import { indonesiaFactories } from '../../src/data/fcs/indonesia-factories.ts'
import { mockFactories } from '../../src/data/fcs/factory-mock-data.ts'
import { APF_FACTORY_ID, SPF_FACTORY_ID, TMF_FACTORY_ID } from '../../src/data/fcs/central-craft-factories.ts'
import { specialCraftDedicatedFactorySeeds } from '../../src/data/fcs/special-craft-dedicated-factories.ts'
import { DYE_PARTNERS } from '../../src/data/fcs/dye-work-order-demo-details.ts'
import { ACCESSORY_FACTORY_MAPPINGS } from '../../src/data/fcs/lace-factory-purchase-projection.ts'
import { LACE_FACTORY_OPERATOR, LACE_FACTORY_SUPERVISOR } from '../../src/data/fcs/lace-factory-domain.ts'

test('三个中央工厂在组织目录与执行工厂中身份一致且仅出现一次', () => {
  for (const id of [APF_FACTORY_ID, SPF_FACTORY_ID, TMF_FACTORY_ID]) {
    const directory = indonesiaFactories.filter((item) => item.id === id)
    const execution = mockFactories.filter((item) => item.id === id)
    assert.equal(directory.length, 1)
    assert.equal(execution.length, 1)
    assert.equal(directory[0].name, execution[0].name)
    assert.equal(directory[0].code, execution[0].code)
    assert.equal(directory[0].tier, 'CENTRAL')
    assert.equal(execution[0].factoryTier, 'CENTRAL')
  }
  assert.equal(new Set(mockFactories.map((item) => item.id)).size, mockFactories.length)
  assert.equal(DYE_PARTNERS.special.id, SPF_FACTORY_ID)
  assert.equal(DYE_PARTNERS.trims.id, TMF_FACTORY_ID)
})

test('花边角色与采购映射归属TMF但供应方仍保留独立身份', () => {
  assert.equal(LACE_FACTORY_OPERATOR.factoryOrgId, TMF_FACTORY_ID)
  assert.equal(LACE_FACTORY_SUPERVISOR.factoryOrgId, TMF_FACTORY_ID)
  for (const mapping of ACCESSORY_FACTORY_MAPPINGS) {
    assert.equal(mapping.factoryOrgId, TMF_FACTORY_ID)
    assert.equal(mapping.factoryName, 'TMF - 辅料厂')
    assert.equal(mapping.supplierId, 'SUP-RJ-001')
    assert.equal(mapping.supplierName, 'Renda Jaya')
  }
})

test('橡筋定长切割仍归SPF，不成为TMF织带截断任务', () => {
  const rows = specialCraftDedicatedFactorySeeds.filter((row) => row.craftCode === 'CRAFT_3000009')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].factoryId, SPF_FACTORY_ID)
  assert.equal(rows[0].craftName, '橡筋定长切割')
  assert.ok(!specialCraftDedicatedFactorySeeds.some((row) => row.factoryId === TMF_FACTORY_ID))
})

test('旧浏览器组织记录迁移后不与权威TMF并存且保留已有联系人', async () => {
  const tmf = mockFactories.find((row) => row.id === TMF_FACTORY_ID)!
  const old = { ...tmf, id: 'ID-F010', name: 'PT Trim Supply Indo', code: 'ID-FAC-0010', contact: '原联系人' }
  const canonical = { ...tmf, contact: '已更新联系人' }
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    localStorage: { getItem: (key: string) => key === 'fcs_factory_master_store_v1' ? JSON.stringify([canonical, old]) : null },
  } })
  try {
    const { listFactoryMasterRecords } = await import('../../src/data/fcs/factory-master-store.ts')
    const records = listFactoryMasterRecords()
    assert.equal(records.filter((row) => row.id === TMF_FACTORY_ID).length, 1)
    assert.equal(records.find((row) => row.id === TMF_FACTORY_ID)?.contact, '已更新联系人')
    assert.ok(!records.some((row) => row.id === 'ID-F010'))
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
    else Reflect.deleteProperty(globalThis, 'window')
  }
})
