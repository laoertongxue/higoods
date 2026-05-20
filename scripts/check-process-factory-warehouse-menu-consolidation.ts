#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { menusBySystem } from '../src/data/app-shell-config.ts'
import {
  buildSpecialCraftDomainWaitHandoverWarehousePath,
  buildSpecialCraftDomainWaitProcessWarehousePath,
  listEnabledAuxiliaryCraftOperationDefinitions,
  listEnabledSpecialTypeCraftOperationDefinitions,
} from '../src/data/fcs/special-craft-operations.ts'
import { getDyeingWarehouseView } from '../src/data/fcs/dyeing-warehouse-view.ts'
import { getPrintingWarehouseView } from '../src/data/fcs/printing-warehouse-view.ts'
import {
  renderCraftDyeingWaitHandoverWarehousePage,
  renderCraftDyeingWaitProcessWarehousePage,
} from '../src/pages/process-factory/dyeing/warehouse.ts'
import {
  renderCraftPrintingWaitHandoverWarehousePage,
  renderCraftPrintingWaitProcessWarehousePage,
} from '../src/pages/process-factory/printing/warehouse.ts'
import {
  renderSpecialCraftDomainWaitHandoverWarehousePage,
  renderSpecialCraftDomainWaitProcessWarehousePage,
} from '../src/pages/process-factory/special-craft/warehouse.ts'
import { routes } from '../src/router/routes-fcs.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function assertIncludes(source: string, token: string, message: string): void {
  assert(source.includes(token), message)
}

function assertNotIncludes(source: string, token: string, message: string): void {
  assert(!source.includes(token), message)
}

function flattenMenuItems(groups: typeof menusBySystem.pfos) {
  return groups.flatMap((group) => group.items)
}

function findMenuSection(menuTitle: string) {
  const group = menusBySystem.pfos.find((entry) => entry.title === menuTitle)
  if (group) {
    if (group.items.length === 1 && group.items[0]?.title === menuTitle && group.items[0]?.children?.length) {
      return group.items[0].children
    }
    return group.items
  }
  const item = flattenMenuItems(menusBySystem.pfos).find((entry) => entry.title === menuTitle)
  assert(item, `缺少 PFOS 菜单：${menuTitle}`)
  return item.children || []
}

function childTitles(menuTitle: string): string[] {
  return findMenuSection(menuTitle).map((child) => child.title)
}

function childHrefs(menuTitle: string): string[] {
  return findMenuSection(menuTitle).map((child) => child.href || '')
}

const routeSource = read('src/router/routes-fcs.ts')
const rendererSource = read('src/router/route-renderers-fcs.ts')
const specialOperationSource = read('src/data/fcs/special-craft-operations.ts')
const specialWarehouseSource = read('src/pages/process-factory/special-craft/warehouse.ts')
const specialSharedSource = read('src/pages/process-factory/special-craft/shared.ts')
const printingWarehouseSource = read('src/pages/process-factory/printing/warehouse.ts')
const dyeingWarehouseSource = read('src/pages/process-factory/dyeing/warehouse.ts')
const printingAdapterSource = read('src/data/fcs/printing-warehouse-view.ts')
const dyeingAdapterSource = read('src/data/fcs/dyeing-warehouse-view.ts')
const taskPrintSource = read('src/data/fcs/task-print-cards.ts') + read('src/pages/print/task-delivery-card.ts')
const oldWaitProcessPathBuilder = ['buildSpecialCraft', 'WaitProcessWarehousePath'].join('')
const oldWaitHandoverPathBuilder = ['buildSpecialCraft', 'WaitHandoverWarehousePath'].join('')
const oldWarehousePathBuilder = ['buildSpecialCraft', 'WarehousePath'].join('')
const removedStatisticsFlag = ['requires', 'Statistics'].join('')
const removedOldCopyA = ['旧能力', '继续'].join('')
const removedOldCopyB = ['层级', '说明'].join('')

assertIncludes(taskPrintSource, 'buildTaskDeliveryCardPrintDocByRecordId', '缺少任务交货卡 builder')
assertIncludes(read('src/data/fcs/fcs-route-links.ts'), 'buildTaskDeliveryCardPrintLink', '缺少任务交货卡 link builder')
assertIncludes(routeSource, '/fcs/print/task-delivery-card', '缺少任务交货卡预览路由')

assert.deepEqual(childTitles('印花管理'), ['印花加工单', '印花待加工仓', '印花待交出仓', '印花统计', '印花大屏'], '印花厂管理菜单顺序不正确')
assert.deepEqual(childHrefs('印花管理'), [
  '/fcs/craft/printing/work-orders',
  '/fcs/craft/printing/wait-process-warehouse',
  '/fcs/craft/printing/wait-handover-warehouse',
  '/fcs/craft/printing/statistics',
  '/fcs/craft/printing/dashboards',
], '印花厂管理菜单 href 不正确')

assert.deepEqual(childTitles('染厂管理'), ['染色加工单', '染色待加工仓', '染色待交出仓', '染色统计'], '染厂管理菜单顺序不正确')
assert.deepEqual(childHrefs('染厂管理'), [
  '/fcs/craft/dyeing/work-orders',
  '/fcs/craft/dyeing/wait-process-warehouse',
  '/fcs/craft/dyeing/wait-handover-warehouse',
  '/fcs/craft/dyeing/reports',
], '染厂管理菜单 href 不正确')

const auxiliaryTitles = childTitles('辅助工艺工厂管理')
const specialTypeTitles = childTitles('特种工艺工厂管理')
listEnabledAuxiliaryCraftOperationDefinitions().forEach((operation) => {
  assert(auxiliaryTitles.includes(`${operation.operationName}加工单`), `${operation.operationName} 未进入辅助工艺菜单`)
})
listEnabledSpecialTypeCraftOperationDefinitions().forEach((operation) => {
  assert(specialTypeTitles.includes(`${operation.operationName}加工单`), `${operation.operationName} 未进入特种工艺菜单`)
})
assert(auxiliaryTitles.includes('辅助工艺待加工仓'), '辅助工艺菜单缺少待加工仓')
assert(auxiliaryTitles.includes('辅助工艺待交出仓'), '辅助工艺菜单缺少待交出仓')
assert(specialTypeTitles.includes('特种工艺待加工仓'), '特种工艺菜单缺少待加工仓')
assert(specialTypeTitles.includes('特种工艺待交出仓'), '特种工艺菜单缺少待交出仓')
;[...auxiliaryTitles, ...specialTypeTitles].forEach((title) => {
  assert(!title.includes('统计'), `特殊工艺菜单不得出现统计：${title}`)
  assert(!title.includes('任务单'), `特殊工艺菜单应使用加工单：${title}`)
})

;[
  buildSpecialCraftDomainWaitProcessWarehousePath('AUXILIARY_CRAFT_FACTORY'),
  buildSpecialCraftDomainWaitHandoverWarehousePath('AUXILIARY_CRAFT_FACTORY'),
  buildSpecialCraftDomainWaitProcessWarehousePath('SPECIAL_CRAFT_FACTORY'),
  buildSpecialCraftDomainWaitHandoverWarehousePath('SPECIAL_CRAFT_FACTORY'),
].forEach((route) => assert(routes.exactRoutes[route], `缺少特殊工艺管理域仓库路由：${route}`))

assertIncludes(routeSource, '/fcs/craft/printing/wait-process-warehouse', '印花 wait-process route 缺失')
assertIncludes(routeSource, '/fcs/craft/dyeing/wait-process-warehouse', '染色 wait-process route 缺失')
assertIncludes(routeSource, 'buildSpecialCraftDomainWaitProcessWarehousePath', '特殊工艺缺少管理域 wait-process route')
assertIncludes(routeSource, 'buildSpecialCraftDomainWaitHandoverWarehousePath', '特殊工艺缺少管理域 wait-handover route')
assertIncludes(rendererSource, 'renderSpecialCraftDomainWaitProcessWarehousePage', '缺少特殊工艺管理域待加工仓 renderer')
assertIncludes(rendererSource, 'renderSpecialCraftDomainWaitHandoverWarehousePage', '缺少特殊工艺管理域待交出仓 renderer')
assertNotIncludes(specialOperationSource + routeSource + rendererSource, oldWaitProcessPathBuilder, '不得保留旧单工艺待加工仓路径')
assertNotIncludes(specialOperationSource + routeSource + rendererSource, oldWaitHandoverPathBuilder, '不得保留旧单工艺待交出仓路径')
assertNotIncludes(specialOperationSource + routeSource + rendererSource, oldWarehousePathBuilder, '不得保留旧单工艺仓库路径')
assertNotIncludes(specialOperationSource + specialWarehouseSource + specialSharedSource, removedStatisticsFlag, '特殊工艺不得保留统计配置')

const printingWaitProcessHtml = renderCraftPrintingWaitProcessWarehousePage()
const printingWaitHandoverHtml = renderCraftPrintingWaitHandoverWarehousePage()
const dyeingWaitProcessHtml = renderCraftDyeingWaitProcessWarehousePage()
const dyeingWaitHandoverHtml = renderCraftDyeingWaitHandoverWarehousePage()
const auxiliaryWaitProcessHtml = renderSpecialCraftDomainWaitProcessWarehousePage('auxiliary')
const auxiliaryWaitHandoverHtml = renderSpecialCraftDomainWaitHandoverWarehousePage('auxiliary')
const specialTypeWaitProcessHtml = renderSpecialCraftDomainWaitProcessWarehousePage('special-type')
const specialTypeWaitHandoverHtml = renderSpecialCraftDomainWaitHandoverWarehousePage('special-type')

assertIncludes(printingWaitProcessHtml, '印花待加工仓', '印花待加工仓页标题缺失')
assertIncludes(printingWaitProcessHtml, '入库记录', '印花待加工仓页缺少入库记录')
assertNotIncludes(printingWaitProcessHtml, '打印任务交货卡', '印花待加工仓页不得出现任务交货卡按钮')
assertIncludes(printingWaitHandoverHtml, '印花待交出仓', '印花待交出仓页标题缺失')
assertIncludes(printingWaitHandoverHtml, '出库记录', '印花待交出仓页缺少出库记录')
assertIncludes(printingWarehouseSource, 'buildTaskDeliveryCardPrintLink(item.handoverRecordId)', '印花出库记录必须按 handoverRecordId 打印任务交货卡')

assertIncludes(dyeingWaitProcessHtml, '染色待加工仓', '染色待加工仓页标题缺失')
assertIncludes(dyeingWaitProcessHtml, '入库记录', '染色待加工仓页缺少入库记录')
assertNotIncludes(dyeingWaitProcessHtml, '打印任务交货卡', '染色待加工仓页不得出现任务交货卡按钮')
assertIncludes(dyeingWaitHandoverHtml, '染色待交出仓', '染色待交出仓页标题缺失')
assertIncludes(dyeingWaitHandoverHtml, '出库记录', '染色待交出仓页缺少出库记录')
assertIncludes(dyeingWarehouseSource, 'buildTaskDeliveryCardPrintLink(item.handoverRecordId)', '染色出库记录必须按 handoverRecordId 打印任务交货卡')

;[
  ['辅助工艺待加工仓', auxiliaryWaitProcessHtml],
  ['辅助工艺待交出仓', auxiliaryWaitHandoverHtml],
  ['特种工艺待加工仓', specialTypeWaitProcessHtml],
  ['特种工艺待交出仓', specialTypeWaitHandoverHtml],
].forEach(([title, html]) => {
  assertIncludes(html, title, `${title} 标题缺失`)
  assertIncludes(html, title.includes('待加工') ? '库存' : '交出记录', `${title} 缺少仓库记录区块`)
  assertNotIncludes(html, removedOldCopyA, `${title} 不得出现旧说明文案`)
  assertNotIncludes(html, removedOldCopyB, `${title} 不得出现旧说明文案`)
})
assertNotIncludes(auxiliaryWaitProcessHtml + specialTypeWaitProcessHtml, '打印任务交货卡', '特殊工艺待加工仓不得出现任务交货卡按钮')
assert(
  specialWarehouseSource.includes('buildTaskDeliveryCardPrintLink(item.handoverRecordId)') ||
    specialWarehouseSource.includes('buildTaskDeliveryCardPrintLink(record.handoverRecordId)'),
  '特殊工艺出库记录必须按 handoverRecordId 打印任务交货卡',
)

assertIncludes(specialSharedSource, "'wait-process'", '特殊工艺子导航缺少待加工仓 key')
assertIncludes(specialSharedSource, "'wait-handover'", '特殊工艺子导航缺少待交出仓 key')
assertNotIncludes(specialSharedSource, '仓库管理', '特殊工艺子导航不得继续展示旧仓库口径')
assertIncludes(specialWarehouseSource + specialSharedSource, 'resolveSpecialCraftFactoryContextGuard', '特殊工艺仓库页必须保留工厂可见性拦截')

const printingView = getPrintingWarehouseView()
const dyeingView = getDyeingWarehouseView()
assert(printingView.factoryIds.length > 0, '印花仓库视图缺少工厂集合')
assert(dyeingView.factoryIds.length > 0, '染色仓库视图缺少工厂集合')
;['listWaitProcessWarehouseRecords', 'listWaitHandoverWarehouseRecords', 'listProcessHandoverRecords'].forEach((name) => {
  assertIncludes(printingAdapterSource + dyeingAdapterSource, name, `印花/染色仓库视图必须复用统一工艺仓模型：${name}`)
})

console.log('[check-process-factory-warehouse-menu-consolidation] PFOS 仓库菜单收口通过')
