#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { menusBySystem } from '../src/data/app-shell-config.ts'
import {
  buildSpecialCraftDomainWaitHandoverWarehousePath,
  buildSpecialCraftDomainWaitProcessWarehousePath,
} from '../src/data/fcs/special-craft-operations.ts'
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

function repoPath(relativePath: string): string {
  return path.resolve(ROOT, relativePath)
}

function read(relativePath: string): string {
  return fs.readFileSync(repoPath(relativePath), 'utf8')
}

function assertIncludes(source: string, token: string, message: string): void {
  assert(source.includes(token), message)
}

function assertNotIncludes(source: string, token: string, message: string): void {
  assert(!source.includes(token), message)
}

function flattenMenuTitles(): string[] {
  return (menusBySystem.pfos || []).flatMap((group) =>
    group.items.flatMap((item) => [item.title, ...(item.children || []).map((child) => child.title)]),
  )
}

const packageSource = read('package.json')
const routeLinksSource = read('src/data/fcs/fcs-route-links.ts')
const routesSource = read('src/router/routes-fcs.ts')
const rendererSource = read('src/router/route-renderers-fcs.ts')
const taskPrintSource = read('src/data/fcs/task-print-cards.ts')
const taskRoutePageSource = read('src/pages/print/task-route-card.ts')
const taskDeliveryPageSource = read('src/pages/print/task-delivery-card.ts')
const progressTaskSource = read('src/pages/progress-board/task-domain.ts')
const specialWarehouseSource = read('src/pages/process-factory/special-craft/warehouse.ts')
const printingWarehouseSource = read('src/pages/process-factory/printing/warehouse.ts')
const dyeingWarehouseSource = read('src/pages/process-factory/dyeing/warehouse.ts')
const appShellSource = read('src/data/app-shell-config.ts')
const specialSharedSource = read('src/pages/process-factory/special-craft/shared.ts')
const specialOperationSource = read('src/data/fcs/special-craft-operations.ts')
const oldWaitProcessPathBuilder = ['buildSpecialCraft', 'WaitProcessWarehousePath'].join('')
const oldWaitHandoverPathBuilder = ['buildSpecialCraft', 'WaitHandoverWarehousePath'].join('')
const oldWarehousePathBuilder = ['buildSpecialCraft', 'WarehousePath'].join('')

assertIncludes(packageSource, 'check:task-card-entry-and-route-closure', 'package.json 缺少任务卡入口与路由收边检查命令')

;['任务交货卡', '任务流转卡'].forEach((name) => {
  assertIncludes(taskPrintSource + taskRoutePageSource + taskDeliveryPageSource + progressTaskSource, name, `正式名称缺少：${name}`)
})
;['随货交接标签', '随货单', '交接唛', '箱唛', '工艺流转卡', '生产流程卡', '作业流转卡'].forEach((name) => {
  assertNotIncludes(taskPrintSource + taskRoutePageSource + taskDeliveryPageSource + progressTaskSource, name, `任务卡用户可见文案不得出现：${name}`)
})

;[
  'src/pages/print/task-delivery-card.ts',
  'src/pages/print/task-route-card.ts',
  'src/data/fcs/task-print-cards.ts',
].forEach((file) => assert(fs.existsSync(repoPath(file)), `缺少打印底座文件：${file}`))
assertIncludes(routeLinksSource, 'buildTaskDeliveryCardPrintLink', '缺少任务交货卡 link builder')
assertIncludes(routeLinksSource, 'buildTaskRouteCardPrintLink', '缺少任务流转卡 link builder')
assert(routes.exactRoutes['/fcs/print/task-delivery-card'], '缺少任务交货卡预览 route')
assert(routes.exactRoutes['/fcs/print/task-route-card'], '缺少任务流转卡预览 route')
assertIncludes(rendererSource, 'renderTaskDeliveryCardPrintPage', '缺少任务交货卡预览 renderer')
assertIncludes(rendererSource, 'renderTaskRouteCardPrintPage', '缺少任务流转卡预览 renderer')

assertIncludes(progressTaskSource, '打印任务交货卡', '任务进度跟踪详情交出记录缺少打印任务交货卡入口')
assertIncludes(progressTaskSource, 'buildTaskDeliveryCardPrintLink(recordId)', '任务进度跟踪交出记录必须通过 recordId 构建任务交货卡链接')
assertIncludes(progressTaskSource, 'renderTaskDeliveryCardAction(record.recordId)', '任务进度跟踪交出记录必须传入 record.recordId')

const specialWaitProcessHtml = renderSpecialCraftDomainWaitProcessWarehousePage('auxiliary')
const specialWaitHandoverHtml = renderSpecialCraftDomainWaitHandoverWarehousePage('auxiliary')
const printingWaitProcessHtml = renderCraftPrintingWaitProcessWarehousePage()
const printingWaitHandoverHtml = renderCraftPrintingWaitHandoverWarehousePage()
const dyeingWaitProcessHtml = renderCraftDyeingWaitProcessWarehousePage()
const dyeingWaitHandoverHtml = renderCraftDyeingWaitHandoverWarehousePage()

;[
  ['辅助工艺待交出仓', specialWarehouseSource, specialWaitHandoverHtml],
  ['印花待交出仓', printingWarehouseSource, printingWaitHandoverHtml],
  ['染色待交出仓', dyeingWarehouseSource, dyeingWaitHandoverHtml],
].forEach(([label, source, html]) => {
  const recordTitle = label.includes('工艺') ? '交出记录' : '出库记录'
  assert(
    source.includes('buildTaskDeliveryCardPrintLink(item.handoverRecordId)') ||
      source.includes('buildTaskDeliveryCardPrintLink(record.handoverRecordId)'),
    `${label} 出库记录必须按 handoverRecordId 打印`,
  )
  assertIncludes(html, recordTitle, `${label} 缺少${recordTitle}区块`)
  if (!label.includes('工艺')) {
    assertIncludes(html, '查看交出', `${label} 出库记录缺少查看交出`)
    assertIncludes(html, '打印任务交货卡', `${label} 出库记录缺少打印任务交货卡`)
  }
})
;[
  ['辅助工艺待加工仓', specialWaitProcessHtml],
  ['印花待加工仓', printingWaitProcessHtml],
  ['染色待加工仓', dyeingWaitProcessHtml],
].forEach(([label, html]) => {
  assertNotIncludes(html, '打印任务交货卡', `${label} 不得出现任务交货卡入口`)
})

;[
  '/fcs/craft/printing/wait-process-warehouse',
  '/fcs/craft/printing/wait-handover-warehouse',
  '/fcs/craft/dyeing/wait-process-warehouse',
  '/fcs/craft/dyeing/wait-handover-warehouse',
  '/fcs/craft/cutting/warehouse-management/wait-process',
  '/fcs/craft/cutting/warehouse-management/wait-handover',
  buildSpecialCraftDomainWaitProcessWarehousePath('AUXILIARY_CRAFT_FACTORY'),
  buildSpecialCraftDomainWaitHandoverWarehousePath('AUXILIARY_CRAFT_FACTORY'),
  buildSpecialCraftDomainWaitProcessWarehousePath('SPECIAL_CRAFT_FACTORY'),
  buildSpecialCraftDomainWaitHandoverWarehousePath('SPECIAL_CRAFT_FACTORY'),
].forEach((route) => assert(routes.exactRoutes[route], `缺少 canonical route：${route}`))

assertNotIncludes(specialOperationSource + routesSource + rendererSource, oldWaitProcessPathBuilder, '不得保留旧特殊工艺单工艺待加工仓路径')
assertNotIncludes(specialOperationSource + routesSource + rendererSource, oldWaitHandoverPathBuilder, '不得保留旧特殊工艺单工艺待交出仓路径')
assertNotIncludes(specialOperationSource + routesSource + rendererSource, oldWarehousePathBuilder, '不得保留旧特殊工艺单工艺仓库路径')

const menuTitles = flattenMenuTitles()
;[
  '印花待加工仓',
  '印花待交出仓',
  '染色待加工仓',
  '染色待交出仓',
  '裁床仓库管理',
  '待加工仓',
  '待交出仓',
  '样衣仓',
  '辅助工艺待加工仓',
  '辅助工艺待交出仓',
  '特种工艺待加工仓',
  '特种工艺待交出仓',
].forEach((title) => assert(menuTitles.includes(title), `PFOS 菜单缺少：${title}`))
;['印花仓库管理', '染色仓库管理', '裁片仓交接', ['特殊工艺', '统计'].join('')].forEach((title) => {
  assert(!menuTitles.includes(title), `用户可见菜单不得保留旧名称：${title}`)
})
assertNotIncludes(specialSharedSource, '仓库管理', '特殊工艺子导航不得继续展示仓库管理')

assertIncludes(appShellSource + routesSource, '/fcs/craft/printing/wait-process-warehouse', '印花菜单/路由未收口')
assertIncludes(appShellSource + routesSource, '/fcs/craft/dyeing/wait-process-warehouse', '染色菜单/路由未收口')
assertIncludes(appShellSource + routesSource, '/fcs/craft/cutting/warehouse-management/wait-process', '裁床仓库管理菜单/路由未收口')
assertIncludes(appShellSource + routesSource, 'buildSpecialCraftDomainWaitProcessWarehousePath', '特殊工艺待加工仓菜单/路由未收口')
assertIncludes(appShellSource + routesSource, 'AUXILIARY_CRAFT_FACTORY', '辅助工艺待加工仓菜单/路由未收口')
assertIncludes(appShellSource + routesSource, 'SPECIAL_CRAFT_FACTORY', '特种工艺待加工仓菜单/路由未收口')

console.log('[check-task-card-entry-and-route-closure] 任务卡入口与路由收边通过')
