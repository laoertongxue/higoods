import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { menusBySystem } from '../src/data/app-shell-config.ts'
import { routes } from '../src/router/routes-pms.ts'
import { shellIcons } from '../src/icons/shell-icons.ts'
import { listPurchaseMaterialReferences, listPurchaseWarehouses, getPurchaseMaterialReference } from '../src/data/pms/canonical-purchase-references.ts'
import { listPmsMaterialRequirements } from '../src/data/pms/material-requirements.ts'
import { listPmsProductPurchaseOrders } from '../src/data/pms/product-purchase-orders.ts'

// Scope: current procurement navigation and canonical source contracts.
// Business writes and their persistence are covered by the applicable PMS unit/browser contracts.
const groups = menusBySystem.pms
const expectedOrder = ['采购建议', '商品采购', '面辅料采购', '面辅料供应商确认', '头程物流', '库存查询', '采购对账', 'KOL样衣申请', '基础资料']
assert.deepEqual(groups.map(group => group.title), expectedOrder)
const items = groups.flatMap(group => group.items)
assert.equal(items.length, 21)
for (const group of groups) {
  assert.ok(group.icon, `${group.title} 缺少图标`)
  assert.ok(group.icon && Object.hasOwn(shellIcons, group.icon), `${group.title} 图标没有注册`)
  for (const item of group.items) {
    assert.ok(item.icon, `${item.title} 缺少图标`)
    assert.ok(item.icon && Object.hasOwn(shellIcons, item.icon), `${item.title} 图标没有注册`)
    assert.ok(item.href && (routes.exactRoutes[item.href] || routes.dynamicRoutes.some(route => route.pattern.test(item.href!))), `${item.title} 缺少路由`)
  }
}
assert.deepEqual(groups.at(-1)?.items.map(item => item.title), ['商品供应商管理', '供应商供货档案', '头程物流商管理'])
const references = listPurchaseMaterialReferences()
assert.ok(references.length > 0)
assert.ok(references.every(item => item.materialCode && item.unit && item.imageUrl))
for (const reference of references.slice(0, 5)) assert.equal(getPurchaseMaterialReference(reference.materialCode)?.materialCode, reference.materialCode)
assert.ok(listPurchaseWarehouses().every(item => item.code && item.name))
assert.ok(listPmsProductPurchaseOrders().every(order => order.purchaseOrderNo && order.lines.length > 0))
assert.ok(listPmsMaterialRequirements().every(requirement => requirement.requirementNo && requirement.lines.length > 0))

const retiredFiles = ['materials', 'product-skus', 'warehouses', 'units', 'bom-templates', 'bom-detail']
for (const file of retiredFiles) assert.equal(existsSync(`src/data/pms/${file}.ts`), false, `退休数据文件仍存在：${file}`)
const retiredPageFiles = ['material-archives', ...retiredFiles.slice(1)]
for (const file of retiredPageFiles) assert.equal(existsSync(`src/pages/pms/${file}.ts`), false, `退休页面文件仍存在：${file}`)
for (const registration of ['src/router/routes-pms.ts', 'src/router/route-renderers-pms.ts', 'src/main-handlers/pms-handlers.ts']) {
  const text = readFileSync(registration, 'utf8')
  for (const file of retiredPageFiles) assert.ok(!text.includes(`pages/pms/${file}`), `${registration} 仍导入退休页面 ${file}`)
}
console.log('采购导航与来源合同通过：9 组、21 页；独立基础资料对象已退役。')
