import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { menusBySystem } from '../src/data/app-shell-config.ts'
import {
  buildSpecialCraftWaitHandoverWarehousePath,
  buildSpecialCraftWaitProcessWarehousePath,
  listEnabledSpecialCraftOperationDefinitions,
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
  renderSpecialCraftWaitHandoverWarehousePage,
  renderSpecialCraftWaitProcessWarehousePage,
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

function token(...parts: string[]): string {
  return parts.join('')
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
const stateStoreSource = read('src/state/store.ts')

assertIncludes(packageSource, 'check:task-card-entry-and-route-closure', 'package.json 缺少任务卡入口与路由收边检查命令')

;['任务交货卡', '任务流转卡'].forEach((name) => {
  assertIncludes(taskPrintSource + taskRoutePageSource + taskDeliveryPageSource + progressTaskSource, name, `正式名称缺少：${name}`)
})
;[
  token('随货', '交接标签'),
  token('随', '货单'),
  token('交接', '唛'),
  token('箱', '唛'),
  token('工艺', '流转卡'),
  token('生产', '流程卡'),
  token('作业', '流转卡'),
].forEach((name) => {
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
;['交出单号', '交货记录号', '第几次交货'].forEach((label) => {
  assertIncludes(taskDeliveryPageSource, label, `任务交货卡页头缺少：${label}`)
})

assertIncludes(progressTaskSource, 'data-progress-task-handover-section', '任务进度看板缺少交出记录区块')
assertIncludes(progressTaskSource, '打印任务交货卡', '任务进度看板详情交出记录缺少打印任务交货卡入口')
assertIncludes(progressTaskSource, 'buildTaskDeliveryCardPrintLink(recordId)', '任务进度看板交出记录必须通过 recordId 构建任务交货卡链接')
assertIncludes(progressTaskSource, 'renderTaskDeliveryCardAction(record.recordId)', '任务进度看板交出记录必须传入 record.recordId')
;[
  'buildTaskDeliveryCardPrintLink(task.taskId)',
  'buildTaskDeliveryCardPrintLink(taskId)',
  'buildTaskDeliveryCardPrintLink(head.handoverId)',
  'buildTaskDeliveryCardPrintLink(record.handoverId)',
  'buildTaskDeliveryCardPrintLink(record.handoverOrderId)',
].forEach((bad) => assertNotIncludes(progressTaskSource, bad, `任务交货卡不得使用非记录级 id：${bad}`))

const operations = listEnabledSpecialCraftOperationDefinitions()
const sampleOperation =
  operations.find((operation) => renderSpecialCraftWaitHandoverWarehousePage(operation.operationId).includes('打印任务交货卡')) ||
  operations[0]
assert(sampleOperation, '缺少特殊工艺样例')
const specialWaitProcessHtml = renderSpecialCraftWaitProcessWarehousePage(sampleOperation.operationId)
const specialWaitHandoverHtml = renderSpecialCraftWaitHandoverWarehousePage(sampleOperation.operationId)
const printingWaitProcessHtml = renderCraftPrintingWaitProcessWarehousePage()
const printingWaitHandoverHtml = renderCraftPrintingWaitHandoverWarehousePage()
const dyeingWaitProcessHtml = renderCraftDyeingWaitProcessWarehousePage()
const dyeingWaitHandoverHtml = renderCraftDyeingWaitHandoverWarehousePage()

;[
  ['特殊工艺待交出仓', specialWarehouseSource, specialWaitHandoverHtml],
  ['印花待交出仓', printingWarehouseSource, printingWaitHandoverHtml],
  ['染色待交出仓', dyeingWarehouseSource, dyeingWaitHandoverHtml],
].forEach(([label, source, html]) => {
  assertIncludes(source, 'buildTaskDeliveryCardPrintLink(item.handoverRecordId)', `${label} 出库记录必须按 handoverRecordId 打印`)
  assertIncludes(html, '出库记录', `${label} 缺少出库记录区块`)
  assertIncludes(html, '查看交出', `${label} 出库记录缺少查看交出`)
  assertIncludes(html, '打印任务交货卡', `${label} 出库记录缺少打印任务交货卡`)
  assertIncludes(html, '查看回写', `${label} 出库记录缺少查看回写`)
})
;[
  ['特殊工艺待加工仓', specialWaitProcessHtml],
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
].forEach((route) => assert(routes.exactRoutes[route], `缺少 canonical route：${route}`))
operations.forEach((operation) => {
  assert(routes.exactRoutes[buildSpecialCraftWaitProcessWarehousePath(operation)], `${operation.operationName} 缺少待加工仓 route`)
  assert(routes.exactRoutes[buildSpecialCraftWaitHandoverWarehousePath(operation)], `${operation.operationName} 缺少待交出仓 route`)
})
;[
  "renderRouteRedirect('/fcs/craft/printing/wait-process-warehouse', '正在跳转到印花待加工仓')",
  "renderRouteRedirect('/fcs/craft/dyeing/wait-process-warehouse', '正在跳转到染色待加工仓')",
  "renderRouteRedirect('/fcs/craft/cutting/warehouse-management/wait-process', '正在跳转到待加工仓')",
  'renderRouteRedirect(buildSpecialCraftWaitProcessWarehousePath(operation)',
].forEach((snippet) => assertIncludes(routesSource, snippet, `旧 alias route 未正确重定向：${snippet}`))
assertIncludes(stateStoreSource, "'/fcs/craft/cutting/warehouse-management/wait-process'", '裁床旧 tab redirect 必须指向待加工仓汇总页')

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
].forEach((title) => assert(menuTitles.includes(title), `PFOS 菜单缺少：${title}`))
;['印花仓库管理', '染色仓库管理', '裁片仓交接'].forEach((title) => {
  assert(!menuTitles.includes(title), `用户可见菜单不得保留旧名称：${title}`)
})
assertNotIncludes(specialSharedSource, '仓库管理', '特殊工艺子导航不得继续展示仓库管理')

assertIncludes(appShellSource + routesSource, '/fcs/craft/printing/wait-process-warehouse', '印花菜单/路由未收口')
assertIncludes(appShellSource + routesSource, '/fcs/craft/dyeing/wait-process-warehouse', '染色菜单/路由未收口')
assertIncludes(appShellSource + routesSource, '/fcs/craft/cutting/warehouse-management/wait-process', '裁床仓库管理菜单/路由未收口')

const productionConfirmationSource = read('src/pages/production/confirmation-print.ts') + read('src/data/fcs/production-confirmation.ts')
assertIncludes(productionConfirmationSource, '生产确认单', '生产确认单打印预览仍需存在')
assertIncludes(productionConfirmationSource, 'window.print', '生产确认单打印能力仍需存在')
assertIncludes(routesSource, 'confirmation-print', '生产确认单打印路由仍需存在')

const materialPrepSource = read('src/pages/process-factory/cutting/material-prep.ts')
assertIncludes(materialPrepSource, '打印配料单', '仓库配料打印入口仍需存在')
assertIncludes(materialPrepSource, 'printIssueList', '仓库配料打印逻辑仍需存在')

const feiTicketSource = read('src/pages/process-factory/cutting/fei-tickets.ts')
assertIncludes(feiTicketSource, '打印菲票', '菲票打印入口仍需存在')
assertIncludes(feiTicketSource, 'performPrintOperation', '菲票打印逻辑仍需存在')

const transferBagSource = read('src/pages/process-factory/cutting/transfer-bags.ts') + read('src/pages/process-factory/cutting/sewing-dispatch.ts')
assertIncludes(transferBagSource, '中转袋', '中转袋链路仍需存在')
assertIncludes(transferBagSource, '打印袋码', '袋码打印入口仍需存在')
assertIncludes(transferBagSource, 'transferBagQrValue', '中转袋二维码值仍需存在')

const taskCardClosureScope = [
  taskPrintSource,
  taskRoutePageSource,
  taskDeliveryPageSource,
  progressTaskSource,
  specialWarehouseSource,
  printingWarehouseSource,
  dyeingWarehouseSource,
  routesSource,
  appShellSource,
].join('\n')
;[
  token('库存', '三态'),
  token('可用', '库存'),
  token('占用', '库存'),
  token('在途', '库存'),
  token('A', 'PI'),
  token('i', '18n'),
  token('use', 'Translation'),
  token('e', 'charts'),
  token('re', 'charts'),
  token('chart', '.js'),
].forEach((name) => {
  assertNotIncludes(taskCardClosureScope, name, `本 step 不得引入越界能力：${name}`)
})

console.log('[check-task-card-entry-and-route-closure] 任务卡入口与路由收边通过')
