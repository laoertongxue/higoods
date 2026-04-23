#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { menusBySystem } from '../src/data/app-shell-config.ts'
import {
  buildSpecialCraftStatisticsPath,
  buildSpecialCraftTaskOrdersPath,
  buildSpecialCraftWarehousePath,
  listEnabledSpecialCraftOperationDefinitions,
} from '../src/data/fcs/special-craft-operations.ts'
import {
  getSpecialCraftTaskOrderById,
  getSpecialCraftTaskOrders,
  getSpecialCraftWarehouseView,
  getSpecialCraftStatistics,
} from '../src/data/fcs/special-craft-task-orders.ts'
import { getProcessDefinitionByCode, listSelectableSpecialCraftDefinitions } from '../src/data/fcs/process-craft-dict.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function resolveRepoPath(relativePath: string): string {
  return path.join(ROOT, relativePath)
}

function read(relativePath: string): string {
  return fs.readFileSync(resolveRepoPath(relativePath), 'utf8')
}

function ensureExists(relativePath: string): void {
  assert(fs.existsSync(resolveRepoPath(relativePath)), `缺少文件：${relativePath}`)
}

function flattenMenuItems(groups: typeof menusBySystem.pfos) {
  return groups.flatMap((group) => group.items)
}

function assertContains(source: string, token: string, message: string): void {
  assert(source.includes(token), message)
}

function assertNoToken(source: string, token: string, message: string): void {
  assert(!source.includes(token), message)
}

function buildToken(...parts: string[]): string {
  return parts.join('')
}

const packageSource = read('package.json')
const routeSource = read('src/router/routes-fcs.ts')
const rendererSource = read('src/router/route-renderers-fcs.ts')
const taskOrderSource = read('src/data/fcs/special-craft-task-orders.ts')
const taskOrdersPageSource = read('src/pages/process-factory/special-craft/task-orders.ts')
const taskDetailPageSource = read('src/pages/process-factory/special-craft/task-detail.ts')
const warehouseSource = read('src/pages/process-factory/special-craft/warehouse.ts')
const statisticsSource = read('src/pages/process-factory/special-craft/statistics.ts')
const cuttingSpecialSource = read('src/pages/process-factory/cutting/special-processes.ts')
const productionArtifactSource = read('src/data/fcs/production-artifact-generation.ts')

;[
  'src/data/fcs/special-craft-task-orders.ts',
  'src/pages/process-factory/special-craft/shared.ts',
  'src/pages/process-factory/special-craft/task-orders.ts',
  'src/pages/process-factory/special-craft/task-detail.ts',
  'src/pages/process-factory/special-craft/warehouse.ts',
  'src/pages/process-factory/special-craft/statistics.ts',
  'scripts/check-special-craft-operation-menus.ts',
].forEach(ensureExists)

assertContains(packageSource, 'check:special-craft-operation-menus', 'package.json 缺少特殊工艺一级菜单检查命令')

const enabledOperations = listEnabledSpecialCraftOperationDefinitions()
const selectableSpecialCrafts = listSelectableSpecialCraftDefinitions()
const selectableCraftCodeSet = new Set(selectableSpecialCrafts.map((item) => item.craftCode))

assert(enabledOperations.length > 0, '缺少启用中的特殊工艺运营分类')
enabledOperations.forEach((operation) => {
  assert(selectableCraftCodeSet.has(operation.craftCode), `${operation.operationName} 未在工序工艺字典中启用`)
  assert(getProcessDefinitionByCode(operation.processCode), `${operation.operationName} 缺少工序定义`)
  assert(operation.isEnabled, `${operation.operationName} 不应以停用状态生成菜单`)
})

const pfosMenus = flattenMenuItems(menusBySystem.pfos)
const specialCraftGroup = menusBySystem.pfos.find((group) => group.title === '特殊工艺')
assert(specialCraftGroup, '工艺工厂运营系统缺少特殊工艺菜单组')

enabledOperations.forEach((operation) => {
  const menuItem = specialCraftGroup!.items.find((item) => item.title === operation.operationName)
  assert(menuItem, `${operation.operationName} 缺少一级菜单`)
  assert(menuItem!.children?.some((child) => child.title === `${operation.operationName}任务单`), `${operation.operationName} 缺少任务单子菜单`)
  assert(menuItem!.children?.some((child) => child.title === `${operation.operationName}仓库管理`), `${operation.operationName} 缺少仓库管理子菜单`)
  assert(menuItem!.children?.some((child) => child.title === `${operation.operationName}统计`), `${operation.operationName} 缺少统计子菜单`)
  assert(menuItem!.children?.some((child) => child.href === buildSpecialCraftTaskOrdersPath(operation)), `${operation.operationName} 任务单菜单 href 不正确`)
  assert(menuItem!.children?.some((child) => child.href === buildSpecialCraftWarehousePath(operation)), `${operation.operationName} 仓库管理菜单 href 不正确`)
  assert(menuItem!.children?.some((child) => child.href === buildSpecialCraftStatisticsPath(operation)), `${operation.operationName} 统计菜单 href 不正确`)
})

assert(
  !pfosMenus.some((item) => item.title.includes(buildToken('印', '花')) && item.key.includes('pfos-special')),
  `${buildToken('印', '花')}不应挂入特殊工艺菜单`,
)
assert(
  !pfosMenus.some((item) => item.title.includes(buildToken('染', '色')) && item.key.includes('pfos-special')),
  `${buildToken('染', '色')}不应挂入特殊工艺菜单`,
)

enabledOperations.forEach((operation) => {
  assertContains(routeSource, 'buildSpecialCraftTaskOrdersPath', `${operation.operationName} 缺少任务单路由生成逻辑`)
  assertContains(routeSource, 'buildSpecialCraftWarehousePath', `${operation.operationName} 缺少仓库管理路由生成逻辑`)
  assertContains(routeSource, 'buildSpecialCraftStatisticsPath', `${operation.operationName} 缺少统计路由生成逻辑`)
})
assertContains(routeSource, 'special-craft', '路由文件缺少特殊工艺路由前缀')
assertContains(rendererSource, 'renderSpecialCraftTaskOrdersPage', '缺少特殊工艺任务单渲染器')
assertContains(rendererSource, 'renderSpecialCraftTaskDetailPage', '缺少特殊工艺任务详情渲染器')
assertContains(rendererSource, 'renderSpecialCraftWarehousePage', '缺少特殊工艺仓库管理渲染器')
assertContains(rendererSource, 'renderSpecialCraftStatisticsPage', '缺少特殊工艺统计渲染器')

const sampleOperation = enabledOperations.find((operation) => {
  const warehouseView = getSpecialCraftWarehouseView(operation.operationId)
  return warehouseView.waitProcessItems.length > 0
    && warehouseView.waitHandoverItems.length > 0
    && warehouseView.inboundRecords.length > 0
    && warehouseView.outboundRecords.length > 0
}) || enabledOperations[0]
const sampleTask = getSpecialCraftTaskOrders(sampleOperation.operationId)[0]
assert(sampleTask, '缺少可展示的特殊工艺任务样例')
assert(getSpecialCraftTaskOrderById(sampleTask.taskOrderId), '缺少可展示的特殊工艺任务详情样例')
assertContains(taskOrdersPageSource, 'renderSpecialCraftTaskOrdersPage', '缺少特殊工艺任务单页面实现')
assertContains(taskDetailPageSource, 'renderSpecialCraftTaskDetailPage', '缺少特殊工艺任务详情页面实现')
assertContains(warehouseSource, 'renderSpecialCraftWarehousePage', '缺少特殊工艺仓库管理页面实现')
assertContains(statisticsSource, 'renderSpecialCraftStatisticsPage', '缺少特殊工艺统计页面实现')
assertContains(taskOrdersPageSource, '生产单生成', '任务单页面缺少来源展示')
assertContains(taskOrdersPageSource, '明细数', '任务单页面缺少明细数字段')
assertContains(taskOrdersPageSource, '分配状态', '任务单页面缺少分配状态字段')
assertContains(taskOrdersPageSource, '执行状态', '任务单页面缺少执行状态字段')
assertContains(taskDetailPageSource, '任务明细', '任务详情页面缺少任务明细区块')
assertContains(taskDetailPageSource, '来源纸样', '任务详情页面缺少来源纸样字段')
assertContains(taskDetailPageSource, '来源裁片明细', '任务详情页面缺少来源裁片明细字段')
assertContains(productionArtifactSource, 'specialCraftTaskOrders', '生产单生成产物缺少特殊工艺任务接入')

;[
  '任务号',
  '生产单',
  '特殊工艺',
  '工厂',
  '作用对象',
  '裁片部位',
  '菲票号',
  '计划数量',
  '已接收数量',
  '已完成数量',
  '待交出数量',
  '当前状态',
].forEach((token) => {
  assertContains(taskOrdersPageSource, token, `任务单页面缺少字段：${token}`)
})

;['节点记录', '仓库记录', '异常记录'].forEach((token) => {
  assertContains(taskDetailPageSource, token, `任务详情页面缺少：${token}`)
})
;['菲票流转', '发料状态', '回仓状态', '发料交出记录', '回仓交出记录'].forEach((token) => {
  assertContains(taskDetailPageSource, token, `任务详情页面缺少裁床特殊工艺流转展示：${token}`)
})

;['待加工仓', '待交出仓', '入库记录', '出库记录', '库区库位', '盘点'].forEach((token) => {
  assertContains(warehouseSource, token, `仓库管理页面缺少：${token}`)
})
assertContains(warehouseSource, 'getSpecialCraftWarehouseView', '特殊工艺仓库管理未复用仓库视图 helper')
assertContains(taskOrderSource, 'FactoryWaitProcessStockItem', '特殊工艺仓库视图未复用待加工仓模型')
assertContains(taskOrderSource, 'FactoryWaitHandoverStockItem', '特殊工艺仓库视图未复用待交出仓模型')
assertContains(taskOrderSource, 'FactoryWarehouseInboundRecord', '特殊工艺仓库视图未复用入库记录模型')
assertContains(taskOrderSource, 'FactoryWarehouseOutboundRecord', '特殊工艺仓库视图未复用出库记录模型')
assertContains(taskOrderSource, 'FactoryWarehouseStocktakeOrder', '特殊工艺仓库视图未复用盘点模型')
assertContains(warehouseSource, '自动转单', '特殊工艺仓库管理缺少自动转单展示')

const warehouseView = getSpecialCraftWarehouseView(sampleOperation.operationId)
assert(warehouseView.waitProcessItems.length > 0, '特殊工艺仓库管理缺少待加工仓数据')
assert(warehouseView.waitHandoverItems.length > 0, '特殊工艺仓库管理缺少待交出仓数据')
assert(warehouseView.inboundRecords.length > 0, '特殊工艺仓库管理缺少入库记录数据')
assert(warehouseView.outboundRecords.length > 0, '特殊工艺仓库管理缺少出库记录数据')

;[
  '时间周期',
  '任务总数',
  '计划数量',
  '已接收数量',
  '已完成数量',
  '待交出数量',
  '差异数量',
  '异常数量',
  '近 7 天',
  '近 30 天',
].forEach((token) => {
  assertContains(statisticsSource, token, `统计页面缺少：${token}`)
})
assertContains(statisticsSource, '节点状态', '统计页面缺少节点状态区块')
;[
  '待发料菲票',
  '已发料菲票',
  '已接收菲票',
  '待回仓菲票',
  '已回仓菲票',
  '差异菲票',
  '异议中菲票',
  '状态分布',
  'getSpecialCraftProgressSnapshots',
].forEach((token) => {
  assertContains(statisticsSource, token, `特殊工艺统计增强缺少：${token}`)
})
assert(getSpecialCraftStatistics(sampleOperation.operationId).length > 0, '缺少特殊工艺统计数据')

;[
  buildToken('新', '增任务'),
  buildToken('生', '成任务'),
  buildToken('从', '裁片仓', '生成'),
  buildToken('手动', '入库'),
  buildToken('手动', '出库'),
  buildToken('新增', '库存'),
].forEach((token) => {
  assertNoToken(taskOrdersPageSource + warehouseSource, token, `特殊工艺页面不应出现：${token}`)
})
;[
  buildToken('manual', 'SpecialCraftTask'),
  buildToken('create', 'WarehouseSpecialCraftTask'),
  buildToken('from', 'CutWarehouseSpecialCraftTask'),
].forEach((token) => {
  assertNoToken(productionArtifactSource + taskOrderSource, token, `不应新增越界任务入口：${token}`)
})
;[
  'SpecialCraftWarehouseStock',
  'SpecialCraftPickupOrder',
  'SpecialCraftHandoverOrder',
  '特殊工艺领料单',
  '特殊工艺交出单',
].forEach((token) => {
  assertNoToken(taskOrderSource + warehouseSource, token, `不应新增特殊工艺专属主模型：${token}`)
})
;[
  'PDA',
  '来料仓',
  '半成品仓',
  buildToken('库存', '三态'),
  buildToken('上架', '任务'),
  buildToken('拣货', '波次'),
  buildToken('库位', '规则'),
  'WMS',
].forEach((token) => {
  assertNoToken(taskOrdersPageSource + taskDetailPageSource + warehouseSource + statisticsSource, token, `页面用户可见文案不应出现：${token}`)
})
;[
  buildToken('axi', 'os'),
  buildToken('fet', 'ch('),
  buildToken('api', 'Client'),
  buildToken('/', 'api', '/'),
  buildToken('i1', '8n'),
  buildToken('use', 'Translation'),
  buildToken('e', 'charts'),
  buildToken('chart', '.', 'js'),
  buildToken('re', 'charts'),
].forEach((token) => {
  assertNoToken(taskOrderSource + warehouseSource + statisticsSource, token, `本轮越界内容不应出现：${token}`)
})

assertContains(cuttingSpecialSource, '可前往的特殊工艺任务单', '旧裁床特殊工艺入口未改为兼容入口')

console.log('check:special-craft-operation-menus passed')
