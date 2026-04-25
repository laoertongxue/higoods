import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  getPostFinishingFlowText,
  getPostFinishingSourceLabel,
  listPostFinishingWaitHandoverWarehouseRecords,
  listPostFinishingWaitProcessWarehouseRecords,
  listPostFinishingWorkOrders,
  listSewingFactoryPostTasks,
} from '../src/data/fcs/post-finishing-domain.ts'
import { startPostFinishingAction } from '../src/data/fcs/process-execution-writeback.ts'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function assertIncludes(source: string, needle: string, message: string): void {
  assert(source.includes(needle), message)
}

function assertNotIncludes(source: string, needle: string, message: string): void {
  assert(!source.includes(needle), message)
}

const postDomain = read('src/data/fcs/post-finishing-domain.ts')
const workOrdersPage = read('src/pages/process-factory/post-finishing/work-orders.ts')
const detailPage = read('src/pages/process-factory/post-finishing/work-order-detail.ts')
const qcPage = read('src/pages/process-factory/post-finishing/qc-orders.ts')
const recheckPage = read('src/pages/process-factory/post-finishing/recheck-orders.ts')
const warehousePage = read('src/pages/process-factory/post-finishing/warehouse.ts')
const statisticsPage = read('src/pages/process-factory/post-finishing/statistics.ts')
const pdaExecPage = read('src/pages/pda-exec.ts')
const pdaExecDetailPage = read('src/pages/pda-exec-detail.ts')
const routes = read('src/router/routes-fcs.ts')
const renderers = read('src/router/route-renderers-fcs.ts')
const docPath = 'docs/fcs-post-finishing-flow-correction.md'

assert(existsSync(join(root, docPath)), '缺少后道流程纠偏文档')
const flowDoc = read(docPath)

;[
  'isPostDoneBySewingFactory',
  'receiveAction',
  'requiresReceive',
  'requiresQc',
  'requiresPostFinishing',
  'requiresRecheck',
  'requiresHandover',
].forEach((field) => assertIncludes(postDomain, field, `后道模型缺少字段：${field}`))

const orders = listPostFinishingWorkOrders()
const dedicatedOrders = orders.filter((order) => order.routeMode === '专门后道工厂完整流程')
const sewingDoneOrders = orders.filter((order) => order.routeMode === '车缝厂已做后道')
assert(dedicatedOrders.length >= 6, '专门后道工厂完整流程后道单不足 6 条')
assert(sewingDoneOrders.length >= 6, '车缝厂已做后道流程后道单不足 6 条')

dedicatedOrders.forEach((order) => {
  assert(order.isDedicatedPostFactory, `专门后道工厂完整流程必须标记专门后道工厂：${order.postOrderNo}`)
  assert(!order.isPostDoneBySewingFactory, `专门后道工厂完整流程不得标记车缝厂已做后道：${order.postOrderNo}`)
  assert(order.requiresReceive && order.requiresQc && order.requiresPostFinishing && order.requiresRecheck && order.requiresHandover, `专门后道工厂完整流程布尔规则不完整：${order.postOrderNo}`)
  assert(getPostFinishingSourceLabel(order) === '后道工厂执行', `专门流程后道来源错误：${order.postOrderNo}`)
  assert(getPostFinishingFlowText(order) === '接收领料 -> 质检 -> 后道 -> 复检 -> 交出', `专门流程顺序错误：${order.postOrderNo}`)
})

sewingDoneOrders.forEach((order) => {
  assert(order.isDedicatedPostFactory, `车缝厂已做后道后仍应由专门后道工厂接收：${order.postOrderNo}`)
  assert(order.isPostDoneBySewingFactory, `车缝厂已做后道流程缺少来源标记：${order.postOrderNo}`)
  assert(order.requiresReceive && order.requiresQc && !order.requiresPostFinishing && order.requiresRecheck && order.requiresHandover, `车缝厂已做后道布尔规则不正确：${order.postOrderNo}`)
  assert(order.postAction.status === '跳过后道', `车缝厂已做后道时后道工厂不得待执行后道：${order.postOrderNo}`)
  assert(order.postAction.skipReason === '后道已由车缝厂完成', `车缝厂已做后道缺少跳过说明：${order.postOrderNo}`)
  assert(getPostFinishingSourceLabel(order) === '车缝厂已完成后道', `车缝厂已做后道来源错误：${order.postOrderNo}`)
  assert(getPostFinishingFlowText(order) === '接收领料 -> 质检 -> 复检 -> 交出', `车缝厂已做后道流程顺序错误：${order.postOrderNo}`)
  let blockedPost = false
  try {
    startPostFinishingAction(order.postOrderId, '后道', { operatorName: '检查脚本' })
  } catch (error) {
    blockedPost = error instanceof Error && error.message.includes('后道已由车缝厂完成')
  }
  assert(blockedPost, `车缝厂已做后道时后道工厂不能再次开始后道：${order.postOrderNo}`)
})

;['后道来源', '当前流程', '接收领料状态', '质检状态', '后道状态', '复检状态', '交出状态'].forEach((label) => {
  assertIncludes(workOrdersPage, label, `Web 后道列表缺少字段：${label}`)
})
assertIncludes(workOrdersPage, 'getPostFinishingFlowText(order)', 'Web 后道列表必须展示当前流程')
assertIncludes(workOrdersPage, 'getPostFinishingSourceLabel(order)', 'Web 后道列表必须展示后道来源')

;['基本信息', '接收领料', '质检记录', '后道记录', '复检记录', '交出记录', '流转记录'].forEach((label) => {
  assertIncludes(detailPage, label, `Web 后道详情缺少分区：${label}`)
})
;['来源车缝任务', '后道来源', '当前流程', '后道是否已由车缝厂完成', '接收成衣件数', '后道已由车缝厂完成'].forEach((label) => {
  assertIncludes(detailPage, label, `Web 后道详情缺少纠偏字段：${label}`)
})

;['来源车缝任务', '后道来源', '待质检成衣件数', '质检通过成衣件数', '质检不合格成衣件数'].forEach((label) => {
  assertIncludes(qcPage, label, `质检单缺少字段：${label}`)
})
;['来源车缝任务', '后道来源', '质检通过成衣件数', '复检确认成衣件数', '差异成衣件数'].forEach((label) => {
  assertIncludes(recheckPage, label, `复检单缺少字段：${label}`)
})

const waitProcess = listPostFinishingWaitProcessWarehouseRecords()
;['接收领料', '质检', '后道', '复检'].forEach((waitAction) => {
  assert(waitProcess.some((record) => record.waitAction === waitAction), `后道待加工仓缺少 ${waitAction} 记录`)
})
sewingDoneOrders.forEach((order) => {
  const records = waitProcess.filter((record) => record.postOrderId === order.postOrderId)
  assert(records.every((record) => record.waitAction !== '后道'), `车缝厂已做后道流程不得进入待后道：${order.postOrderNo}`)
})
;['待接收领料', '待质检', '待后道', '待复检', '待处理成衣件数'].forEach((label) => {
  assertIncludes(warehousePage + JSON.stringify(waitProcess), label, `后道待加工仓缺少：${label}`)
})

const waitHandover = listPostFinishingWaitHandoverWarehouseRecords()
waitHandover.forEach((record) => {
  const order = orders.find((item) => item.postOrderId === record.postOrderId)
  assert(order, `后道交出仓记录无法追溯后道单：${record.handoverWarehouseRecordNo}`)
  assert(order!.recheckAction.status === '复检完成' || ['待交出', '已交出', '已回写', '已完成', '有差异', '平台处理中'].includes(order!.currentStatus), `后道交出仓必须由复检完成后生成：${record.handoverWarehouseRecordNo}`)
})
;['复检确认成衣件数', '待交出成衣件数', '已交出成衣件数', '实收成衣件数', '差异成衣件数'].forEach((label) => {
  assertIncludes(warehousePage, label, `后道交出仓缺少字段：${label}`)
})

assertIncludes(pdaExecPage, 'listSewingFactoryPostTasks', 'PDA 任务列表必须包含车缝工厂后道任务')
assertIncludes(pdaExecPage, '车缝工厂同时完成车缝与后道', 'PDA 任务列表必须说明车缝工厂既做车缝又做后道')
;['确认接收领料', '开始质检', '完成质检', '开始后道', '完成后道', '开始复检', '完成复检', '发起交出'].forEach((label) => {
  assertIncludes(pdaExecDetailPage, label, `PDA 后道详情缺少动作：${label}`)
})
assertIncludes(pdaExecDetailPage, '后道已由车缝厂完成', 'PDA 后道详情必须展示车缝厂已完成后道说明')
assertIncludes(pdaExecDetailPage, 'renderPdaSewingPostTaskPage', 'PDA 必须有车缝工厂后道任务详情')
const sewingPostSection = pdaExecDetailPage.slice(
  pdaExecDetailPage.indexOf('function renderPdaSewingPostTaskPage'),
  pdaExecDetailPage.indexOf('export function renderPdaExecDetailPage'),
)
;['开始质检', '完成质检', '开始复检', '完成复检'].forEach((label) => {
  assertNotIncludes(sewingPostSection, label, `车缝工厂移动端不得出现 ${label}`)
})
;['是否需要本厂完成后道', '后道后流向', '交给后道工厂', '开始后道', '完成后道'].forEach((label) => {
  assertIncludes(sewingPostSection, label, `车缝工厂后道任务详情缺少：${label}`)
})
const sewingTasks = listSewingFactoryPostTasks()
assert(sewingTasks.length >= 6, '车缝工厂后道任务数据不足')
assert(sewingTasks.some((task) => task.sewingFactoryName === '全能力测试车缝工厂'), '缺少全能力测试车缝工厂数据')
;['待后道', '后道中', '后道完成', '待交后道工厂', '已交后道工厂'].forEach((status) => {
  assert(sewingTasks.some((task) => task.status === status), `车缝工厂后道任务缺少状态：${status}`)
})

;['待接收领料任务数', '已接收成衣件数', '接收差异成衣件数', '后道工厂执行后道任务数', '车缝厂已完成后道任务数'].forEach((label) => {
  assertIncludes(statisticsPage, label, `后道统计缺少新流程指标：${label}`)
})

;[
  'post-finishing/work-orders',
  'post-finishing/qc-orders',
  'post-finishing/recheck-orders',
  'post-finishing/wait-process-warehouse',
  'post-finishing/wait-handover-warehouse',
].forEach((route) => {
  assertIncludes(routes, route, `后道路由必须可访问：${route}`)
})
;[
  'renderPostFinishingWorkOrdersPage',
  'renderPostFinishingWorkOrderDetailPage',
  'renderPostFinishingQcOrdersPage',
  'renderPostFinishingRecheckOrdersPage',
  'renderPostFinishingWaitProcessWarehousePage',
  'renderPostFinishingWaitHandoverWarehousePage',
].forEach((rendererName) => {
  assertIncludes(renderers, rendererName, `后道 renderer 必须存在：${rendererName}`)
})

;[
  workOrdersPage,
  detailPage,
  qcPage,
  recheckPage,
  warehousePage,
  statisticsPage,
  pdaExecPage,
  postDomain,
].forEach((source, index) => {
  const label = ['后道列表', '后道详情', '质检单', '复检单', '后道仓', '后道统计', 'PDA 列表', '后道模型'][index]
  ;['开扣眼', '装扣子', '熨烫', '包装'].forEach((term) => {
    assertNotIncludes(source, term, `${label} 不得把 ${term} 作为后道任务动作`)
  })
})
;['开扣眼', '装扣子', '熨烫'].forEach((term) => {
  assertNotIncludes(pdaExecDetailPage, term, `PDA 后道任务不得出现 ${term}`)
})

assertNotIncludes(`${postDomain}\n${workOrdersPage}\n${detailPage}\n${flowDoc}`, '后道 -> 质检 -> 复检', '不得保留错误流程顺序')
;[
  '生产单\n-> 后道单\n-> 接收领料\n-> 质检\n-> 后道\n-> 复检\n-> 后道交出仓',
  '车缝任务\n-> 车缝完成\n-> 车缝厂完成后道\n-> 交给后道工厂',
  'Web 端后道单\n-> 工厂端移动应用接收领料',
].forEach((flow) => assertIncludes(flowDoc, flow, `流程文档缺少：${flow}`))

assertNotIncludes(workOrdersPage + detailPage + qcPage + recheckPage + warehousePage + statisticsPage, '数量：', '后道页面不得只显示“数量：”')

console.log('post finishing flow correction checks passed')
