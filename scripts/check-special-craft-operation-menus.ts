#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildSpecialCraftMenuGroups, menusBySystem } from '../src/data/app-shell-config.ts'
import {
  buildSpecialCraftDomainWaitHandoverWarehousePath,
  buildSpecialCraftDomainWaitProcessWarehousePath,
  buildSpecialCraftTaskOrdersPath,
  listEnabledAuxiliaryCraftOperationDefinitions,
  listEnabledSpecialTypeCraftOperationDefinitions,
} from '../src/data/fcs/special-craft-operations.ts'
import { getSpecialCraftTaskOrders } from '../src/data/fcs/special-craft-task-orders.ts'
import {
  renderSpecialCraftDomainWaitHandoverWarehousePage,
  renderSpecialCraftDomainWaitProcessWarehousePage,
} from '../src/pages/process-factory/special-craft/warehouse.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function flattenMenuItems(groups: typeof menusBySystem.pfos) {
  return groups.flatMap((group) => group.items)
}

function assertIncludes(source: string, token: string, message: string): void {
  assert(source.includes(token), message)
}

function assertNotIncludes(source: string, token: string, message: string): void {
  assert(!source.includes(token), message)
}

const packageSource = read('package.json')
const appShellSource = read('src/data/app-shell-config.ts')
const routeSource = read('src/router/routes-fcs.ts')
const rendererSource = read('src/router/route-renderers-fcs.ts')
const operationSource = read('src/data/fcs/special-craft-operations.ts')
const taskOrdersPageSource = read('src/pages/process-factory/special-craft/task-orders.ts')
const taskDetailPageSource = read('src/pages/process-factory/special-craft/task-detail.ts')
const warehouseSource = read('src/pages/process-factory/special-craft/warehouse.ts')
const sharedSource = read('src/pages/process-factory/special-craft/shared.ts')
const oldWaitProcessPathBuilder = ['buildSpecialCraft', 'WaitProcessWarehousePath'].join('')
const oldWaitHandoverPathBuilder = ['buildSpecialCraft', 'WaitHandoverWarehousePath'].join('')
const oldWarehousePathBuilder = ['buildSpecialCraft', 'WarehousePath'].join('')
const removedStatisticsFlag = ['requires', 'Statistics'].join('')
const removedOldCopyA = ['旧能力', '继续'].join('')
const removedOldCopyB = ['层级', '说明'].join('')

assertIncludes(packageSource, 'check:special-craft-operation-menus', 'package.json 缺少特殊工艺菜单检查命令')

const auxiliaryOperations = listEnabledAuxiliaryCraftOperationDefinitions()
const specialTypeOperations = listEnabledSpecialTypeCraftOperationDefinitions()
assert(auxiliaryOperations.length >= 9, '辅助工艺工厂管理启用工艺不足')
assert(specialTypeOperations.length >= 4, '特种工艺工厂管理启用工艺不足')
assert(![...auxiliaryOperations, ...specialTypeOperations].some((operation) => operation.operationName === '捆条'), '捆条不得留在辅助工艺或特种工艺菜单')

const groups = menusBySystem.pfos
const auxiliaryGroup = groups.find((group) => group.title === '辅助工艺工厂管理')
const specialTypeGroup = groups.find((group) => group.title === '特种工艺工厂管理')
assert(auxiliaryGroup, 'PFOS 缺少辅助工艺工厂管理菜单组')
assert(specialTypeGroup, 'PFOS 缺少特种工艺工厂管理菜单组')
assert(!groups.some((group) => group.title === '特殊工艺'), 'PFOS 不应保留旧特殊工艺统一菜单组')

const auxiliaryChildTitles = auxiliaryGroup!.items.map((item) => item.title)
const specialTypeChildTitles = specialTypeGroup!.items.map((item) => item.title)
const auxiliaryChildHrefs = auxiliaryGroup!.items.map((item) => item.href || '')
const specialTypeChildHrefs = specialTypeGroup!.items.map((item) => item.href || '')
auxiliaryOperations.forEach((operation) => {
  const taskPath = buildSpecialCraftTaskOrdersPath(operation)
  assert(auxiliaryChildTitles.includes(`${operation.operationName}加工单`), `${operation.operationName} 缺少辅助工艺加工单菜单`)
  assert(auxiliaryChildHrefs.includes(taskPath), `${operation.operationName} 加工单菜单 href 缺失`)
})
specialTypeOperations.forEach((operation) => {
  const taskPath = buildSpecialCraftTaskOrdersPath(operation)
  assert(specialTypeChildTitles.includes(`${operation.operationName}加工单`), `${operation.operationName} 缺少特种工艺加工单菜单`)
  assert(specialTypeChildHrefs.includes(taskPath), `${operation.operationName} 加工单菜单 href 缺失`)
})
assertIncludes(routeSource, 'buildSpecialCraftTaskOrdersPath(operation)', '特殊工艺加工单动态路由缺失')

assert(auxiliaryChildTitles.includes('辅助工艺待加工仓'), '辅助工艺工厂管理缺少待加工仓')
assert(auxiliaryChildTitles.includes('辅助工艺待交出仓'), '辅助工艺工厂管理缺少待交出仓')
assert(specialTypeChildTitles.includes('特种工艺待加工仓'), '特种工艺工厂管理缺少待加工仓')
assert(specialTypeChildTitles.includes('特种工艺待交出仓'), '特种工艺工厂管理缺少待交出仓')
;[...auxiliaryChildTitles, ...specialTypeChildTitles].forEach((title) => {
  assert(!title.includes('统计'), `特殊工艺菜单不得保留统计入口：${title}`)
  assert(!title.includes('任务单'), `特殊工艺菜单用户文案应使用加工单：${title}`)
})

;[
  buildSpecialCraftDomainWaitProcessWarehousePath('AUXILIARY_CRAFT_FACTORY'),
  buildSpecialCraftDomainWaitHandoverWarehousePath('AUXILIARY_CRAFT_FACTORY'),
  buildSpecialCraftDomainWaitProcessWarehousePath('SPECIAL_CRAFT_FACTORY'),
  buildSpecialCraftDomainWaitHandoverWarehousePath('SPECIAL_CRAFT_FACTORY'),
].forEach((route) => assert([...auxiliaryChildHrefs, ...specialTypeChildHrefs].includes(route), `缺少管理域仓库菜单 href：${route}`))

assertIncludes(appShellSource, 'buildSpecialCraftMenuGroups', '菜单配置缺少特殊工艺菜单 helper')
assertIncludes(routeSource, 'buildSpecialCraftDomainWaitProcessWarehousePath', '路由缺少管理域待加工仓 path')
assertIncludes(routeSource, 'buildSpecialCraftDomainWaitHandoverWarehousePath', '路由缺少管理域待交出仓 path')
assertIncludes(rendererSource, 'renderSpecialCraftDomainWaitProcessWarehousePage', '缺少辅助/特种待加工仓渲染器')
assertIncludes(rendererSource, 'renderSpecialCraftDomainWaitHandoverWarehousePage', '缺少辅助/特种待交出仓渲染器')
assertNotIncludes(operationSource + routeSource + rendererSource, oldWaitProcessPathBuilder, '不得保留旧单工艺待加工仓路径')
assertNotIncludes(operationSource + routeSource + rendererSource, oldWaitHandoverPathBuilder, '不得保留旧单工艺待交出仓路径')
assertNotIncludes(operationSource + routeSource + rendererSource, oldWarehousePathBuilder, '不得保留旧单工艺仓库路径')
assertNotIncludes(operationSource + taskOrdersPageSource + warehouseSource + sharedSource, removedStatisticsFlag, '特殊工艺不得保留统计入口配置')

const auxiliaryWaitProcessHtml = renderSpecialCraftDomainWaitProcessWarehousePage('auxiliary')
const auxiliaryWaitHandoverHtml = renderSpecialCraftDomainWaitHandoverWarehousePage('auxiliary')
const specialTypeWaitProcessHtml = renderSpecialCraftDomainWaitProcessWarehousePage('special-type')
const specialTypeWaitHandoverHtml = renderSpecialCraftDomainWaitHandoverWarehousePage('special-type')
;[
  ['辅助工艺待加工仓', auxiliaryWaitProcessHtml],
  ['辅助工艺待交出仓', auxiliaryWaitHandoverHtml],
  ['特种工艺待加工仓', specialTypeWaitProcessHtml],
  ['特种工艺待交出仓', specialTypeWaitHandoverHtml],
].forEach(([title, html]) => {
  assertIncludes(html, title, `仓库页面缺少标题：${title}`)
  assertNotIncludes(html, removedOldCopyA, `${title} 不得出现说明性旧文案`)
  assertNotIncludes(html, removedOldCopyB, `${title} 不得出现说明性旧文案`)
})

assertIncludes(taskOrdersPageSource, '加工单', '加工单列表页面缺少加工单文案')
assertIncludes(taskDetailPageSource, '加工单详情', '加工单详情页面缺少加工单详情文案')
assertIncludes(warehouseSource, '查看加工单', '仓库页面缺少加工单查看入口')
assertIncludes(sharedSource + taskOrdersPageSource + taskDetailPageSource + warehouseSource, 'resolveSpecialCraftFactoryContextGuard', '特殊工艺页面缺少工厂上下文保护')

const allTasks = [...auxiliaryOperations, ...specialTypeOperations].flatMap((operation) => getSpecialCraftTaskOrders(operation.operationId))
assert(allTasks.length > 0, '缺少辅助/特种工艺加工单演示数据')
assert(buildSpecialCraftMenuGroups().length === 2, '特殊工艺菜单 helper 应拆为辅助工艺与特种工艺两个菜单组')
assert(flattenMenuItems(buildSpecialCraftMenuGroups()).some((item) => item.title === '辅助工艺待加工仓'), '菜单 helper 缺少辅助工艺待加工仓')
assert(flattenMenuItems(buildSpecialCraftMenuGroups()).some((item) => item.title === '特种工艺待交出仓'), '菜单 helper 缺少特种工艺待交出仓')

console.log('[check-special-craft-operation-menus] 辅助工艺 / 特种工艺菜单收口通过')
