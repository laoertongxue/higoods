import assert from 'node:assert/strict'
import test from 'node:test'
import { PMS_SUPPLIER_TYPES, PMS_SUPPLIER_COUNTRIES, PMS_SUPPLIER_DELIVERY_METHODS, PMS_SUPPLIER_CURRENCIES, listPmsSuppliers } from '../../src/data/pms/suppliers.ts'
import { renderPmsSuppliersPage } from '../../src/pages/pms/suppliers.ts'

test('供应商候选覆盖测试表单类型、国家和交货方式，并保留旧记录可读', () => {
  assert.ok((PMS_SUPPLIER_TYPES as readonly string[]).includes('耗材供应商'))
  assert.ok((PMS_SUPPLIER_COUNTRIES as readonly string[]).includes('印尼'))
  for (const value of ['供应商直发海外仓','发国内仓','自提']) assert.ok((PMS_SUPPLIER_DELIVERY_METHODS as readonly string[]).includes(value))
  assert.deepEqual([...PMS_SUPPLIER_CURRENCIES],['RMB','USD','IDR'])
  assert.ok(listPmsSuppliers().every(item => PMS_SUPPLIER_TYPES.includes(item.category)))
  assert.ok(listPmsSuppliers().every(item => !item.country || (PMS_SUPPLIER_COUNTRIES as readonly string[]).includes(item.country)))
  assert.equal(listPmsSuppliers().length,13)
})

test('无法读取用户存储时页面显示固定资料与明确错误', async () => {
  const html = await renderPmsSuppliersPage()
  assert.match(html,/用户资料未读取/)
  assert.match(html,/固定演示资料/)
  assert.match(html,/data-standard-list-page/)
  assert.match(html,/data-pms-sup-table-surface/)
  assert.match(html,/data-pms-sup-pagination-surface/)
})
