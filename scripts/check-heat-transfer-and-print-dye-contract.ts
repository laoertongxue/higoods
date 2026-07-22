#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildSpecialCraftMenuGroups } from '../src/data/app-shell-config.ts'
import {
  buildSpecialCraftOperationSlug,
  buildSpecialCraftTaskDetailPath,
  buildSpecialCraftTaskOrdersPath,
} from '../src/data/fcs/special-craft-operations.ts'
import {
  getEnabledSpecialCraftOperations,
  listSpecialCraftTaskWorkOrders,
} from '../src/data/fcs/special-craft-task-orders.ts'
import {
  buildSpecialCraftTaskListStorageKey,
  renderSpecialCraftTaskOrdersPage,
} from '../src/pages/process-factory/special-craft/task-orders.ts'
import { renderSpecialCraftWorkOrderDetailPage } from '../src/pages/process-factory/special-craft/work-order-detail.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

const operations = getEnabledSpecialCraftOperations()
const heat = operations.find((item) => item.operationId === 'AUX-OP-HEAT-TRANSFER')
const direct = operations.find((item) => item.operationId === 'AUX-OP-DIRECT-PRINT')
assert(heat, '缺少烫画工艺操作')
assert(direct, '缺少直喷工艺操作')

const workOrders = listSpecialCraftTaskWorkOrders()
const heatOrders = workOrders.filter((item) => item.operationId === heat.operationId)
const directOrders = workOrders.filter((item) => item.operationId === direct.operationId)
assert(heatOrders.length > 0, '必须存在独立烫画加工单')
assert(directOrders.length > 0, '必须保留直喷加工单')
assert(heatOrders.every((item) => item.craftName === '烫画'))
assert(directOrders.every((item) => item.craftName === '直喷'))
assert(heatOrders.every((item) => item.businessType === 'HEAT_TRANSFER'), '烫画加工单必须使用 HEAT_TRANSFER 业务类型')
assert(directOrders.every((item) => item.businessType === 'DIRECT_PRINT'), '直喷加工单必须保留 DIRECT_PRINT 业务类型')
assert(
  workOrders
    .filter((item) => !['烫画', '直喷'].includes(item.craftName))
    .every((item) => item.businessType === 'OTHER_SPECIAL_CRAFT'),
  '其他辅助或特种工艺加工单必须使用 OTHER_SPECIAL_CRAFT 兜底业务类型',
)
assert.equal(
  new Set([...heatOrders, ...directOrders].map((item) => item.workOrderNo)).size,
  heatOrders.length + directOrders.length,
  '烫画与直喷加工单号不得重复',
)

for (const [craftName, orders] of [['烫画', heatOrders], ['直喷', directOrders]] as const) {
  assert(orders.some((item) => item.targetObject === '已裁部位'), `${craftName}必须包含裁片部位加工单`)
  assert(orders.some((item) => item.targetObject === '成衣'), `${craftName}必须包含成衣加工单`)
}

const menuItems = buildSpecialCraftMenuGroups().flatMap((group) => group.items)
const heatPath = buildSpecialCraftTaskOrdersPath(heat)
const directPath = buildSpecialCraftTaskOrdersPath(direct)
assert.notEqual(heatPath, directPath, '烫画与直喷必须使用独立列表路径')
assert(menuItems.some((item) => item.title === '烫画加工单' && item.href === heatPath), '缺少独立烫画加工单菜单')
assert(menuItems.some((item) => item.title === '直喷加工单' && item.href === directPath), '缺少独立直喷加工单菜单')

const heatSlug = buildSpecialCraftOperationSlug(heat)
const directSlug = buildSpecialCraftOperationSlug(direct)
const heatStorageKey = buildSpecialCraftTaskListStorageKey(heatSlug)
const directStorageKey = buildSpecialCraftTaskListStorageKey(directSlug)
assert.notEqual(heatStorageKey, directStorageKey, '烫画与直喷筛选持久化键不得共用')
assert(heatStorageKey.includes(heatSlug), '烫画筛选持久化键必须包含当前 operation slug')
assert(directStorageKey.includes(directSlug), '直喷筛选持久化键必须包含当前 operation slug')
const heatListHtml = renderSpecialCraftTaskOrdersPage(heatSlug)
const directListHtml = renderSpecialCraftTaskOrdersPage(directSlug)
assert(heatListHtml.includes('烫画加工单'), '烫画列表 H1 或面包屑缺少烫画加工单')
assert(directListHtml.includes('直喷加工单'), '直喷列表 H1 或面包屑缺少直喷加工单')
assert(heatListHtml.includes('aria-label="面包屑"') && heatListHtml.includes('烫画'), '烫画列表必须展示当前工艺面包屑')
assert(directListHtml.includes('aria-label="面包屑"') && directListHtml.includes('直喷'), '直喷列表必须展示当前工艺面包屑')

for (const [operation, order, slug] of [[heat, heatOrders[0], heatSlug], [direct, directOrders[0], directSlug]] as const) {
  const detailHtml = renderSpecialCraftWorkOrderDetailPage(slug, order.workOrderId)
  const returnPath = buildSpecialCraftTaskDetailPath(operation, order.taskOrderId)
  assert(detailHtml.includes(returnPath), `${operation.craftName}加工单详情返回路径必须保留当前 operation slug`)
}

const routeSource = read('src/router/routes-fcs.ts')
const rendererSource = read('src/router/route-renderers-fcs.ts')
const taskOrdersSource = read('src/pages/process-factory/special-craft/task-orders.ts')
assert(routeSource.includes('buildSpecialCraftTaskOrdersPath(operation)'), '动态路由必须按 operation 生成独立列表入口')
assert(rendererSource.includes('renderSpecialCraftTaskOrdersPage'), '动态路由缺少公共加工单列表渲染器')
assert(taskOrdersSource.includes('buildSpecialCraftTaskListStorageKey'), '筛选持久化键必须按 operation slug 独立')

console.log('[check-heat-transfer-and-print-dye-contract] 独立烫画与直喷加工单契约通过')
