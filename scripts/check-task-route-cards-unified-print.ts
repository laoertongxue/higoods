import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { listDyeWorkOrders } from '../src/data/fcs/dyeing-task-domain.ts'
import { listCuttingMergeBatchTaskPrintSources } from '../src/data/fcs/cutting-task-print-source.ts'
import { listPrintWorkOrders } from '../src/data/fcs/printing-task-domain.ts'
import { listRuntimeExecutionTasks } from '../src/data/fcs/runtime-process-tasks.ts'
import { listPostFinishingWorkOrders } from '../src/data/fcs/post-finishing-domain.ts'
import { listSpecialCraftTaskOrders } from '../src/data/fcs/special-craft-task-orders.ts'
import { listOriginalCutOrderSourceRecords } from '../src/data/fcs/cutting/original-cut-order-source.ts'
import {
  buildPrintDocument,
  getPrintTemplateForRequest,
} from '../src/data/fcs/print-template-registry.ts'
import type { PrintSourceType } from '../src/data/fcs/print-service.ts'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function assertFile(path: string, message: string): void {
  assert(existsSync(join(root, path)), message)
}

function assertIncludes(source: string, needle: string, message: string): void {
  assert(source.includes(needle), message)
}

function assertNotIncludes(source: string, needle: string, message: string): void {
  assert(!source.includes(needle), message)
}

function docText(sourceType: PrintSourceType, sourceId: string): string {
  const doc = buildPrintDocument({ documentType: 'TASK_ROUTE_CARD', sourceType, sourceId })
  return JSON.stringify(doc)
}

const printService = read('src/data/fcs/print-service.ts')
const registry = read('src/data/fcs/print-template-registry.ts')
const taskTemplate = read('src/pages/print/templates/task-route-card-template.ts')
const postTemplate = read('src/pages/print/templates/post-finishing-route-card-template.ts')
const previewPage = read('src/pages/print/print-preview.ts')
const routePage = read('src/pages/print/task-route-card.ts')
const routes = read('src/router/routes-fcs.ts')
const routeLinks = read('src/data/fcs/fcs-route-links.ts')
const workOrderPages = [
  'src/pages/progress-board/task-domain.ts',
  'src/pages/progress-board/events.ts',
  'src/pages/process-factory/printing/work-orders.ts',
  'src/pages/process-factory/dyeing/work-orders.ts',
  'src/pages/process-factory/special-craft/task-orders.ts',
  'src/pages/process-factory/special-craft/task-detail.ts',
  'src/pages/process-factory/post-finishing/work-orders.ts',
  'src/pages/process-factory/post-finishing/work-order-detail.ts',
  'src/pages/process-factory/cutting/original-orders.ts',
  'src/pages/process-factory/cutting/merge-batches.ts',
].filter((path) => existsSync(join(root, path))).map(read).join('\n')

;[
  'src/data/fcs/print-service.ts',
  'src/data/fcs/print-template-registry.ts',
  'src/pages/print/print-preview.ts',
  'src/pages/print/templates/task-route-card-template.ts',
  'src/pages/print/templates/post-finishing-route-card-template.ts',
  'src/pages/print/task-route-card.ts',
].forEach((path) => assertFile(path, `缺少统一任务流转卡打印文件：${path}`))

assertIncludes(printService, 'export interface PrintDocument', '第 1 步统一 PrintDocument 不存在')
assertIncludes(registry, 'printTemplateRegistry', '第 1 步模板注册表不存在')
assertIncludes(registry, 'POST_FINISHING_ROUTE_CARD', '后道任务流转卡模板注册丢失')
assertIncludes(postTemplate, 'buildPostFinishingRouteCardPrintDocument', '后道任务流转卡 adapter 丢失')
assertIncludes(postTemplate, '接收领料', '后道任务流转卡必须保留接收领料')
assertIncludes(postTemplate, 'flowText', '后道任务流转卡必须从后道事实源读取当前流程')
assertIncludes(postTemplate, 'isPostDoneBySewingFactory', '车缝厂已做后道流程必须保留')

;[
  'RUNTIME_TASK',
  'PRINTING_WORK_ORDER',
  'DYEING_WORK_ORDER',
  'SPECIAL_CRAFT_TASK_ORDER',
  'POST_FINISHING_WORK_ORDER',
  'CUTTING_ORIGINAL_ORDER',
  'CUTTING_MERGE_BATCH',
].forEach((sourceType) => {
  assertIncludes(registry + printService + taskTemplate + postTemplate, sourceType, `缺少 sourceType 接入：${sourceType}`)
})

;[
  'buildRuntimeTaskRouteCardPrintDocument',
  'buildPrintingWorkOrderRouteCardPrintDocument',
  'buildDyeingWorkOrderRouteCardPrintDocument',
  'buildSpecialCraftTaskOrderRouteCardPrintDocument',
  'buildPostFinishingRouteCardPrintDocument',
  'buildCuttingOriginalOrderRouteCardPrintDocument',
  'buildCuttingMergeBatchRouteCardPrintDocument',
].forEach((adapterName) => {
  assertIncludes(taskTemplate + postTemplate, adapterName, `缺少任务流转卡 adapter：${adapterName}`)
})

assertIncludes(taskTemplate, '差异记录区', '通用任务流转卡模板必须渲染差异记录区')
assertIncludes(taskTemplate, '签字区', '通用任务流转卡模板必须渲染签字区')
assertIncludes(taskTemplate, '暂无商品图', '无图时必须使用紧凑“暂无商品图”')
assertIncludes(taskTemplate, 'size: 112', '二维码区不得占据整页主体')
assertNotIncludes(taskTemplate + postTemplate, '系统占位图', '任务流转卡不得显示大块系统占位图')
assertNotIncludes(previewPage + taskTemplate + postTemplate, 'renderAppShell', '打印页不得渲染系统顶部导航')
assertNotIncludes(previewPage + taskTemplate + postTemplate, 'renderSidebar', '打印页不得渲染左侧菜单')
assertNotIncludes(previewPage + taskTemplate + postTemplate, 'data-shell-tab', '打印页不得渲染业务 Tab')

assertIncludes(routeLinks, 'buildTaskRouteCardPrintLink', '旧 buildTaskRouteCardPrintLink 必须保留')
assertIncludes(routeLinks, 'buildUnifiedPrintPreviewLink', 'buildTaskRouteCardPrintLink 必须进入统一打印预览')
assertIncludes(routes, "'/fcs/print/task-route-card'", '旧 /fcs/print/task-route-card 路由必须保留')
assertIncludes(routePage, 'renderUnifiedPrintPreviewPage', '旧任务流转卡路由必须接入统一打印壳')
assertIncludes(workOrderPages, '打印任务流转卡', '页面必须保留打印任务流转卡入口')
assertIncludes(workOrderPages, 'buildTaskRouteCardPrintLink', '业务打印按钮必须继续通过统一 helper 或兼容 helper')

const runtimeTask = listRuntimeExecutionTasks()[0]
const printOrder = listPrintWorkOrders()[0]
const dyeOrder = listDyeWorkOrders()[0]
const specialOrder = listSpecialCraftTaskOrders()[0]
const postOrder = listPostFinishingWorkOrders()[0]
const originalOrder = listOriginalCutOrderSourceRecords()[0]
const mergeBatch = listCuttingMergeBatchTaskPrintSources()[0]

assert(runtimeTask, '缺少运行时任务 mock 数据')
assert(printOrder, '缺少印花加工单 mock 数据')
assert(dyeOrder, '缺少染色加工单 mock 数据')
assert(specialOrder, '缺少特殊工艺任务单 mock 数据')
assert(postOrder, '缺少后道单 mock 数据')
assert(originalOrder, '缺少原始裁片单 mock 数据')
assert(mergeBatch, '缺少裁片批次 mock 数据')

const runtimeTemplate = getPrintTemplateForRequest({ documentType: 'TASK_ROUTE_CARD', sourceType: 'RUNTIME_TASK', sourceId: runtimeTask.taskId })
const printingTemplate = getPrintTemplateForRequest({ documentType: 'TASK_ROUTE_CARD', sourceType: 'PRINTING_WORK_ORDER', sourceId: printOrder.printOrderId })
const dyeingTemplate = getPrintTemplateForRequest({ documentType: 'TASK_ROUTE_CARD', sourceType: 'DYEING_WORK_ORDER', sourceId: dyeOrder.dyeOrderId })
const specialTemplate = getPrintTemplateForRequest({ documentType: 'TASK_ROUTE_CARD', sourceType: 'SPECIAL_CRAFT_TASK_ORDER', sourceId: specialOrder.taskOrderId })
const postFinishingTemplate = getPrintTemplateForRequest({ documentType: 'TASK_ROUTE_CARD', sourceType: 'POST_FINISHING_WORK_ORDER', sourceId: postOrder.postOrderId })
const originalTemplate = getPrintTemplateForRequest({ documentType: 'TASK_ROUTE_CARD', sourceType: 'CUTTING_ORIGINAL_ORDER', sourceId: originalOrder.originalCutOrderId })
const mergeTemplate = getPrintTemplateForRequest({ documentType: 'TASK_ROUTE_CARD', sourceType: 'CUTTING_MERGE_BATCH', sourceId: mergeBatch.mergeBatchId })

assert(runtimeTemplate?.templateCode === 'RUNTIME_TASK_ROUTE_CARD', 'RUNTIME_TASK 未接入专用统一模板注册')
assert(printingTemplate?.templateCode === 'PRINTING_WORK_ORDER_ROUTE_CARD', 'PRINTING_WORK_ORDER 未接入专用统一模板注册')
assert(dyeingTemplate?.templateCode === 'DYEING_WORK_ORDER_ROUTE_CARD', 'DYEING_WORK_ORDER 未接入专用统一模板注册')
assert(specialTemplate?.templateCode === 'SPECIAL_CRAFT_TASK_ORDER_ROUTE_CARD', 'SPECIAL_CRAFT_TASK_ORDER 未接入专用统一模板注册')
assert(postFinishingTemplate?.templateCode === 'POST_FINISHING_ROUTE_CARD', 'POST_FINISHING_WORK_ORDER 后道模板注册回退')
assert(originalTemplate?.templateCode === 'CUTTING_ORIGINAL_ORDER_ROUTE_CARD', 'CUTTING_ORIGINAL_ORDER 未接入专用统一模板注册')
assert(mergeTemplate?.templateCode === 'CUTTING_MERGE_BATCH_ROUTE_CARD', 'CUTTING_MERGE_BATCH 未接入专用统一模板注册')

const runtimeDoc = docText('RUNTIME_TASK', runtimeTask.taskId)
const printDoc = docText('PRINTING_WORK_ORDER', printOrder.printOrderId)
const dyeDoc = docText('DYEING_WORK_ORDER', dyeOrder.dyeOrderId)
const specialDoc = docText('SPECIAL_CRAFT_TASK_ORDER', specialOrder.taskOrderId)
const postDoc = docText('POST_FINISHING_WORK_ORDER', postOrder.postOrderId)
const originalDoc = docText('CUTTING_ORIGINAL_ORDER', originalOrder.originalCutOrderId)
const mergeDoc = docText('CUTTING_MERGE_BATCH', mergeBatch.mergeBatchId)

;['任务编号', '生产单号', '工序', '工艺', '工厂', '计划对象数量'].forEach((token) => assertIncludes(runtimeDoc, token, `通用任务流转卡缺少 ${token}`))
;['印花任务流转卡', '花型号/版本', '面料 SKU', '计划印花面料米数', '打印', '转印', '交出', '审核'].forEach((token) => assertIncludes(printDoc, token, `印花任务流转卡缺少 ${token}`))
;['染色任务流转卡', '原料面料 SKU', '目标颜色', '色号', '染缸', '染色', '脱水', '烘干', '定型', '打卷', '包装', '交出', '审核'].forEach((token) => assertIncludes(dyeDoc, token, `染色任务流转卡缺少 ${token}`))
;['特殊工艺', '菲票号', '裁片数量', '差异', '交出'].forEach((token) => assertIncludes(specialDoc, token, `特殊工艺任务流转卡缺少 ${token}`))
;['后道任务流转卡', '接收领料', '质检', '复检', '交出', '成衣件数'].forEach((token) => assertIncludes(postDoc, token, `后道任务流转卡缺少 ${token}`))
;['原始裁片单任务流转卡', '原始裁片单号', '生产单号', '面料 SKU', '订单成衣件数', '计划裁片数量', '配料', '领料', '唛架', '铺布', '裁剪', '菲票', '入裁片仓', '交出'].forEach((token) => assertIncludes(originalDoc, token, `原始裁片单任务流转卡缺少 ${token}`))
;['裁片批次任务流转卡', '裁片批次号', '来源生产单数', '来源原始裁片单数', '计划裁床组', '计划裁剪日期', '菲票归属仍回落原始裁片单'].forEach((token) => assertIncludes(mergeDoc, token, `裁片批次任务流转卡缺少 ${token}`))
assertNotIncludes(mergeDoc, '合并裁剪批次作为菲票归属主体', '不得把合并裁剪批次作为菲票归属主体')

;[
  runtimeDoc,
  printDoc,
  dyeDoc,
  specialDoc,
  postDoc,
  originalDoc,
  mergeDoc,
].forEach((text, index) => {
  assertIncludes(text, 'TASK_ROUTE_CARD', `第 ${index + 1} 类任务流转卡缺少 documentType`)
  assertIncludes(text, 'sourceType', `第 ${index + 1} 类任务流转卡二维码缺少 sourceType`)
  assertIncludes(text, 'sourceId', `第 ${index + 1} 类任务流转卡二维码缺少 sourceId`)
  assertIncludes(text, 'targetRoute', `第 ${index + 1} 类任务流转卡二维码缺少 targetRoute`)
  assertIncludes(text, '差异记录区', `第 ${index + 1} 类任务流转卡缺少差异记录区`)
  assertIncludes(text, '签字', `第 ${index + 1} 类任务流转卡缺少签字区`)
})

assertNotIncludes(dyeDoc + read('src/pages/process-factory/dyeing/reports.ts'), '染色报表', '用户可见文案不得出现染色报表')
assertNotIncludes(postDoc + postTemplate, '后道 -> 质检 -> 复检', '后道任务流转卡不得回退错误流程')
;['开扣眼', '装扣子', '熨烫'].forEach((term) => {
  assertNotIncludes(postDoc + postTemplate, term, `后道任务流转卡不得出现错误动作：${term}`)
})
assertNotIncludes(postTemplate, '数量：', '后道模板不得只写数量')

assertIncludes(read('src/pages/print/task-delivery-card.ts'), '任务交货卡', '任务交货卡入口被破坏')
assertIncludes(read('src/pages/production/confirmation-print.ts'), '生产确认单', '生产确认单入口被破坏')
assertIncludes(read('src/pages/process-factory/cutting/fei-tickets.ts'), '菲票', '菲票入口被破坏')
assertIncludes(read('src/pages/process-factory/cutting/material-prep.ts'), '配料', '配料单入口被破坏')
assertIncludes(read('src/pages/settlement/request-domain.ts'), '结算信息变更申请单', '结算信息变更申请单入口被破坏')

console.log('task route cards unified print checks passed')
