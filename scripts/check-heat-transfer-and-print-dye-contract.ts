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
  buildSpecialCraftTaskWorkOrders,
  getEnabledSpecialCraftOperations,
  listSpecialCraftTaskOrders,
  listSpecialCraftTaskWorkOrders,
} from '../src/data/fcs/special-craft-task-orders.ts'
import {
  buildSpecialCraftTaskListStorageKey,
  readSpecialCraftTaskListPreference,
  renderSpecialCraftTaskOrdersPage,
  writeSpecialCraftTaskListPreference,
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
assert.equal(new Set(workOrders.map((item) => item.workOrderNo)).size, workOrders.length, '所有辅助或特种工艺加工单号必须全局唯一')
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

// 任务 5 起点 adc95810 的直喷加工单身份基线；新增烫画不得重编号既有直喷。
const directIdentityBaseline = [
  {
    workOrderId: 'AUX-TASK-PO2026030002-RINT-34bb1b-04-WO-001-',
    workOrderNo: 'AUX-202603-0002-6384-04-部位01',
  },
  {
    workOrderId: 'AUX-TASK-PO2026030004-RINT-1a0949-03-WO-001-',
    workOrderNo: 'AUX-202603-0004-6384-03-部位01',
  },
]
assert.deepEqual(
  directOrders
    .map(({ workOrderId, workOrderNo }) => ({ workOrderId, workOrderNo }))
    .sort((left, right) => left.workOrderId.localeCompare(right.workOrderId)),
  directIdentityBaseline.sort((left, right) => left.workOrderId.localeCompare(right.workOrderId)),
  '直喷既有加工单 ID 与加工单号不得因新增烫画而变化',
)

for (const [operationId, renamedCraftName, expectedBusinessType] of [
  ['AUX-OP-HEAT-TRANSFER', '热转印展示名', 'HEAT_TRANSFER'],
  ['AUX-OP-DIRECT-PRINT', '数码直喷展示名', 'DIRECT_PRINT'],
  ['AUX-OP-UNKNOWN', '未知工艺展示名', 'OTHER_SPECIAL_CRAFT'],
] as const) {
  const sourceTask = listSpecialCraftTaskOrders().find((item) => item.operationId === operationId)
    || listSpecialCraftTaskOrders()[0]
  assert(sourceTask, '缺少业务类型映射测试任务')
  const [renamedWorkOrder] = buildSpecialCraftTaskWorkOrders([{
    ...sourceTask,
    operationId,
    craftName: renamedCraftName,
  }]).workOrders
  assert.equal(renamedWorkOrder.businessType, expectedBusinessType, `${operationId} 业务类型不得依赖中文展示名`)
}

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

const preferenceValues = new Map<string, string>()
const preferenceStorage = {
  getItem: (key: string) => preferenceValues.get(key) ?? null,
  setItem: (key: string, value: string) => {
    preferenceValues.set(key, value)
  },
}
writeSpecialCraftTaskListPreference(preferenceStorage, heatSlug, {
  keyword: 'heat-only',
  factoryId: 'FAC-AUX-HEAT-TRANSFER',
  status: '加工中',
  abnormalStatus: '无异常',
  timeRange: '7D',
  page: 8,
  pageSize: 50,
})
writeSpecialCraftTaskListPreference(preferenceStorage, directSlug, {
  keyword: 'direct-only',
  factoryId: 'FAC-AUX-DIRECT-PRINT',
  status: '待领料',
  abnormalStatus: '全部',
  timeRange: '30D',
  page: 6,
  pageSize: 10,
})
assert(!Object.hasOwn(JSON.parse(preferenceValues.get(heatStorageKey) || '{}'), 'page'), '当前页不得写入偏好')
assert.deepEqual(
  readSpecialCraftTaskListPreference(preferenceStorage, heatSlug, ['FAC-AUX-HEAT-TRANSFER']),
  {
    keyword: 'heat-only',
    factoryId: 'FAC-AUX-HEAT-TRANSFER',
    status: '加工中',
    abnormalStatus: '无异常',
    timeRange: '7D',
    page: 1,
    pageSize: 50,
  },
  '烫画偏好必须独立读回且当前页重置为 1',
)
assert.equal(
  readSpecialCraftTaskListPreference(preferenceStorage, directSlug, ['FAC-AUX-DIRECT-PRINT']).keyword,
  'direct-only',
  '直喷偏好不得被烫画覆盖',
)

preferenceValues.set(heatStorageKey, JSON.stringify({
  keyword: 12,
  factoryId: 'FAC-REMOVED',
  status: '非法状态',
  abnormalStatus: '非法异常',
  timeRange: 'OLD_RANGE',
  page: 99,
  pageSize: 999,
}))
assert.deepEqual(
  readSpecialCraftTaskListPreference(preferenceStorage, heatSlug, ['FAC-AUX-HEAT-TRANSFER']),
  {
    keyword: '',
    factoryId: '全部',
    status: '全部',
    abnormalStatus: '全部',
    timeRange: 'ALL',
    page: 1,
    pageSize: 20,
  },
  '非法或已失效偏好必须回退稳定默认值',
)
preferenceValues.set(heatStorageKey, JSON.stringify({ keyword: '旧偏好', factoryId: 'ALL', status: '', abnormalStatus: 'ALL' }))
assert.deepEqual(
  readSpecialCraftTaskListPreference(preferenceStorage, heatSlug, ['FAC-AUX-HEAT-TRANSFER']),
  {
    keyword: '旧偏好',
    factoryId: '全部',
    status: '全部',
    abnormalStatus: '全部',
    timeRange: 'ALL',
    page: 1,
    pageSize: 20,
  },
  '旧版 ALL、空值和残缺偏好必须兼容并补齐默认值',
)
preferenceValues.set(heatStorageKey, '{invalid-json')
assert.equal(
  readSpecialCraftTaskListPreference(preferenceStorage, heatSlug, ['FAC-AUX-HEAT-TRANSFER']).page,
  1,
  '损坏偏好不得导致页面崩溃',
)
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

const invalidListHtml = renderSpecialCraftTaskOrdersPage('invalid-operation')
assert(invalidListHtml.includes('未找到对应特殊工艺'), '无效 operation slug 的列表必须展示明确缺失态')
assert(!invalidListHtml.includes('烫画加工单') && !invalidListHtml.includes('直喷加工单'), '无效列表不得串到烫画或直喷')
const invalidDetailHtml = renderSpecialCraftWorkOrderDetailPage('invalid-operation', directOrders[0].workOrderId)
assert(invalidDetailHtml.includes('未找到对应加工单'), '无效 operation slug 的详情必须安全展示空态')
assert(!invalidDetailHtml.includes(directOrders[0].workOrderNo), '无效详情不得泄漏其他工艺加工单')

const routeSource = read('src/router/routes-fcs.ts')
const rendererSource = read('src/router/route-renderers-fcs.ts')
const taskOrdersSource = read('src/pages/process-factory/special-craft/task-orders.ts')
assert(routeSource.includes('buildSpecialCraftTaskOrdersPath(operation)'), '动态路由必须按 operation 生成独立列表入口')
assert(rendererSource.includes('renderSpecialCraftTaskOrdersPage'), '动态路由缺少公共加工单列表渲染器')
assert(taskOrdersSource.includes('buildSpecialCraftTaskListStorageKey'), '筛选持久化键必须按 operation slug 独立')

console.log('[check-heat-transfer-and-print-dye-contract] 独立烫画与直喷加工单契约通过')
