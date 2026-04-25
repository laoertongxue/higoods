import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { listPostFinishingWorkOrders } from '../src/data/fcs/post-finishing-domain.ts'
import {
  buildPrintDocument,
  getPrintTemplateForRequest,
} from '../src/data/fcs/print-template-registry.ts'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

function assertIncludes(source: string, needle: string, message: string): void {
  assert(source.includes(needle), message)
}

function assertNotIncludes(source: string, needle: string, message: string): void {
  assert(!source.includes(needle), message)
}

function assertFile(path: string, message: string): void {
  assert(existsSync(join(root, path)), message)
}

const printService = read('src/data/fcs/print-service.ts')
const registry = read('src/data/fcs/print-template-registry.ts')
const previewPage = read('src/pages/print/print-preview.ts')
const printStyles = read('src/pages/print/print-styles.ts')
const postTemplate = read('src/pages/print/templates/post-finishing-route-card-template.ts')
const taskRouteTemplate = read('src/pages/print/templates/task-route-card-template.ts')
const taskRoutePage = read('src/pages/print/task-route-card.ts')
const workOrdersPage = read('src/pages/process-factory/post-finishing/work-orders.ts')
const routes = read('src/router/routes-fcs.ts')
const renderers = read('src/router/route-renderers-fcs.ts')
const routeLinks = read('src/data/fcs/fcs-route-links.ts')
const shell = read('src/components/shell.ts')
const deliveryPage = read('src/pages/print/task-delivery-card.ts')
const productionConfirmation = read('src/pages/production/confirmation-print.ts')
const taskPrintCards = read('src/data/fcs/task-print-cards.ts')

;[
  ['src/data/fcs/print-service.ts', '缺少统一打印服务文件'],
  ['src/data/fcs/print-template-registry.ts', '缺少统一模板注册表'],
  ['src/pages/print/print-preview.ts', '缺少统一打印预览页'],
  ['src/pages/print/print-styles.ts', '缺少统一打印样式'],
  ['src/pages/print/templates/post-finishing-route-card-template.ts', '缺少后道任务流转卡模板'],
  ['src/pages/print/templates/task-route-card-template.ts', '缺少旧任务流转卡兼容模板'],
].forEach(([path, message]) => assertFile(path, message))

assertIncludes(printService, 'export interface PrintDocument', '缺少统一 PrintDocument 模型')
assertIncludes(printService, 'documentType', 'PrintDocument 缺少 documentType')
assertIncludes(printService, 'imageBlocks', 'PrintDocument 缺少 imageBlocks')
assertIncludes(printService, 'signatureBlocks', 'PrintDocument 缺少 signatureBlocks')
assertIncludes(printService, 'differenceBlocks', 'PrintDocument 缺少 differenceBlocks')
assertIncludes(registry, 'printTemplateRegistry', '缺少 printTemplateRegistry')
assertIncludes(registry, 'TASK_ROUTE_CARD', '模板注册表缺少 TASK_ROUTE_CARD')
assertIncludes(registry, 'POST_FINISHING_ROUTE_CARD', '模板注册表缺少 POST_FINISHING_ROUTE_CARD')
assertIncludes(registry, 'POST_FINISHING_WORK_ORDER', '模板注册表缺少 POST_FINISHING_WORK_ORDER')
assertIncludes(postTemplate, 'buildPostFinishingRouteCardPrintDocument', '缺少后道任务流转卡文档构建函数')
assertIncludes(previewPage, 'renderUnifiedPrintPreviewPage', '缺少统一打印预览渲染函数')
assertIncludes(routes, "'/fcs/print/preview'", '缺少统一打印预览路由')
assertIncludes(renderers, 'renderPrintPreviewPage', '缺少统一打印预览 renderer')
assertIncludes(taskRoutePage, 'renderUnifiedPrintPreviewPage', '旧任务流转卡页面必须接入统一打印壳')
assertIncludes(routes, "'/fcs/print/task-route-card'", '旧任务流转卡路由必须保留')
assertIncludes(routes, '^\\/fcs\\/task-print\\/route-card\\/', '旧动态任务流转卡路由必须保留')
assertIncludes(routeLinks, 'buildTaskRouteCardPrintLink', '旧任务流转卡链接 helper 必须保留')
assertIncludes(routeLinks, 'buildUnifiedPrintPreviewRouteLink', '缺少统一打印预览链接 helper')

assertIncludes(workOrdersPage, 'buildUnifiedPrintPreviewRouteLink', '后道列表打印入口必须进入统一打印预览')
assertIncludes(workOrdersPage, "documentType: 'TASK_ROUTE_CARD'", '后道列表打印入口缺少任务流转卡 documentType')
assertIncludes(workOrdersPage, "sourceType: 'POST_FINISHING_WORK_ORDER'", '后道列表打印入口缺少后道单 sourceType')

assertIncludes(shell, "state.pathname.startsWith('/fcs/print/')", '打印路由必须绕过系统顶部导航和左侧菜单')
assertIncludes(shell, "state.pathname.startsWith('/fcs/task-print/')", '旧任务打印路由必须绕过系统顶部导航和左侧菜单')
;['renderAppShell', 'renderTopBar', 'renderSidebar', 'renderTabs', 'data-shell-tab'].forEach((token) => {
  assertNotIncludes(previewPage + postTemplate, token, `打印预览或后道模板不得渲染业务系统壳：${token}`)
})
assertIncludes(printStyles, '@page', '打印样式必须声明 @page')
assertIncludes(printStyles, 'size: A4 portrait', '打印样式必须设置 A4 纵向')
assertIncludes(printStyles, 'margin: 8mm', '打印样式必须设置 8mm 页边距')
assertIncludes(printStyles, 'print-hidden', '打印按钮和提示必须设置为非打印区域')
assertIncludes(printStyles, '30mm', '二维码尺寸必须控制在 26mm 至 32mm 范围')

;['后道任务流转卡', '接收领料', '质检', '后道区', '复检', '交出', '差异记录区', '签字区', '二维码区', '计划成衣件数', '复检确认成衣件数', '差异成衣件数'].forEach((token) => {
  assertIncludes(postTemplate, token, `后道打印模板缺少 ${token}`)
})
assertIncludes(postTemplate, '后道已由车缝厂完成', '车缝厂已做后道流程必须有说明')
assertIncludes(postTemplate, '扫码进入工厂端后道任务详情', '后道打印模板缺少二维码说明')
assertIncludes(postTemplate, '暂无商品图', '后道打印模板必须使用紧凑无图占位')
assertNotIncludes(postTemplate + taskPrintCards, '系统占位图', '打印底座不得继续使用大块系统占位图文案')

const template = getPrintTemplateForRequest({
  documentType: 'TASK_ROUTE_CARD',
  sourceType: 'POST_FINISHING_WORK_ORDER',
  sourceId: 'POST-WO-001',
})
assert(template?.templateCode === 'POST_FINISHING_ROUTE_CARD', '后道任务流转卡必须命中 POST_FINISHING_ROUTE_CARD 模板')

const dedicatedDoc = buildPrintDocument({
  documentType: 'TASK_ROUTE_CARD',
  sourceType: 'POST_FINISHING_WORK_ORDER',
  sourceId: 'POST-WO-001',
})
assert(dedicatedDoc.printTitle === '后道任务流转卡', '后道任务流转卡标题错误')
assert(dedicatedDoc.printSubtitle.includes('接收领料 -> 质检 -> 后道 -> 复检 -> 交出'), '专门后道工厂流程顺序错误')
assert(dedicatedDoc.qrCodes[0]?.sizeMm >= 26 && dedicatedDoc.qrCodes[0]?.sizeMm <= 32, '后道二维码尺寸必须为 26mm 至 32mm')
assert(dedicatedDoc.differenceBlocks[0]?.minRows === 3, '差异记录区必须保留空白手写行')

const sewingDoneOrder = listPostFinishingWorkOrders().find((order) => order.isPostDoneBySewingFactory)
assert(sewingDoneOrder, '缺少车缝厂已完成后道 mock 数据')
const sewingDoneDoc = buildPrintDocument({
  documentType: 'TASK_ROUTE_CARD',
  sourceType: 'POST_FINISHING_WORK_ORDER',
  sourceId: sewingDoneOrder!.postOrderId,
})
assert(sewingDoneDoc.printSubtitle.includes('接收领料 -> 质检 -> 复检 -> 交出'), '车缝厂已做后道流程必须跳过后道工厂后道节点')
const sewingRouteRows = sewingDoneDoc.tables.find((table) => table.tableId === 'route-nodes')?.rows || []
assert(sewingRouteRows.length === 4, '车缝厂已做后道打印流转节点必须只有接收领料、质检、复检、交出')
assert(!sewingRouteRows.some((row) => row[0] === '后道'), '车缝厂已做后道打印流转节点不得展示后道工厂后道节点')
assert(sewingDoneDoc.sections.some((section) => section.note?.includes('车缝厂已经完成该环节')), '车缝厂已做后道打印模板必须展示说明')

;['HiGood 顶部导航', '商品中心系统', '采购管理系统', '工厂生产协同'].forEach((token) => {
  assertNotIncludes(previewPage + postTemplate + taskRouteTemplate, token, `打印模板不得出现系统导航文案：${token}`)
})
;['开扣眼', '装扣子', '熨烫', '包装'].forEach((term) => {
  assertNotIncludes(postTemplate, term, `后道打印模板不得出现后道错误动作：${term}`)
})
assertNotIncludes(postTemplate, '数量：', '后道打印模板不得只显示“数量：”')

assertIncludes(deliveryPage, '任务交货卡', '任务交货卡打印入口不得被破坏')
assertIncludes(productionConfirmation, '生产确认单', '生产确认单打印页不得被破坏')
assertIncludes(routes, 'task-delivery-card', '任务交货卡打印路由不得被删除')
assertIncludes(routes, 'confirmation-print', '生产确认单打印路由不得被删除')
;['菲票', '配料单', '结算信息变更申请单'].forEach((token) => {
  assertIncludes(read('src/pages/process-factory/cutting/fei-tickets.ts') + read('src/pages/process-factory/cutting/material-prep.ts') + read('src/pages/settlement/request-domain.ts'), token, `不得破坏 ${token} 相关打印入口`)
})

console.log('print service post route card checks passed')
