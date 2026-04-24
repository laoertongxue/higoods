import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  listPostFinishingQcOrders,
  listPostFinishingRecheckOrders,
  listPostFinishingWaitHandoverWarehouseRecords,
  listPostFinishingWaitProcessWarehouseRecords,
  listPostFinishingWorkOrders,
} from '../src/data/fcs/post-finishing-domain.ts'
import { startPostFinishingAction } from '../src/data/fcs/process-execution-writeback.ts'

const root = process.cwd()
const FULL_FACTORY_NAME = '全能力测试工厂'
const OLD_FACTORY_NAME = '雅加达后道工厂'

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

const postDomain = read('src/data/fcs/post-finishing-domain.ts')
const workOrdersPage = read('src/pages/process-factory/post-finishing/work-orders.ts')
const detailPage = read('src/pages/process-factory/post-finishing/work-order-detail.ts')
const qcPage = read('src/pages/process-factory/post-finishing/qc-orders.ts')
const recheckPage = read('src/pages/process-factory/post-finishing/recheck-orders.ts')
const warehousePage = read('src/pages/process-factory/post-finishing/warehouse.ts')
const sharedPage = read('src/pages/process-factory/post-finishing/shared.ts')
const pdaExecPage = read('src/pages/pda-exec.ts')
const pdaExecDetailPage = read('src/pages/pda-exec-detail.ts')
const pdaStore = read('src/data/fcs/store-domain-pda.ts')
const routes = read('src/router/routes-fcs.ts')
const renderers = read('src/router/route-renderers-fcs.ts')
const routeLinks = read('src/data/fcs/fcs-route-links.ts')
const taskPrintCards = read('src/data/fcs/task-print-cards.ts')

const postOrders = listPostFinishingWorkOrders()
assert(postOrders.length >= 8, '后道 mock 数据至少应包含 HD-2026-001 到 HD-2026-008 同批后道单')
postOrders.slice(0, 8).forEach((order, index) => {
  assert(order.postOrderNo === `HD-2026-${String(index + 1).padStart(3, '0')}`, `后道单编号缺少同批数据: ${order.postOrderNo}`)
})
postOrders.forEach((order) => {
  assert(order.currentFactoryName === FULL_FACTORY_NAME, `后道单 currentFactoryName 必须为 ${FULL_FACTORY_NAME}: ${order.postOrderNo}`)
  assert(order.managedPostFactoryName === FULL_FACTORY_NAME, `后道单 managedPostFactoryName 必须为 ${FULL_FACTORY_NAME}: ${order.postOrderNo}`)
})
listPostFinishingQcOrders().forEach((record) => {
  assert(record.factoryName === FULL_FACTORY_NAME, `质检单后道工厂必须为 ${FULL_FACTORY_NAME}: ${record.actionId}`)
})
listPostFinishingRecheckOrders().forEach((record) => {
  assert(record.factoryName === FULL_FACTORY_NAME, `复检单后道工厂必须为 ${FULL_FACTORY_NAME}: ${record.actionId}`)
})
listPostFinishingWaitProcessWarehouseRecords().forEach((record) => {
  assert(record.postFactoryName === FULL_FACTORY_NAME, `后道待加工仓后道工厂必须为 ${FULL_FACTORY_NAME}: ${record.warehouseRecordNo}`)
})
listPostFinishingWaitHandoverWarehouseRecords().forEach((record) => {
  assert(record.postFactoryName === FULL_FACTORY_NAME, `后道交出仓后道工厂必须为 ${FULL_FACTORY_NAME}: ${record.handoverWarehouseRecordNo}`)
})

;[postDomain, workOrdersPage, detailPage, qcPage, recheckPage, warehousePage, pdaExecPage, pdaExecDetailPage].forEach((source, index) => {
  const label = ['post-finishing-domain.ts', 'work-orders.ts', 'work-order-detail.ts', 'qc-orders.ts', 'recheck-orders.ts', 'warehouse.ts', 'pda-exec.ts', 'pda-exec-detail.ts'][index]
  assertNotIncludes(source, OLD_FACTORY_NAME, `${label} 不得再出现 ${OLD_FACTORY_NAME}`)
})

assert(existsSync(join(root, 'src/pages/process-factory/post-finishing/work-order-detail.ts')), '必须存在后道详情页')
assertIncludes(renderers, 'renderPostFinishingWorkOrderDetailPage', '必须存在后道详情 renderer')
assertIncludes(routes, 'renderPostFinishingWorkOrderDetailPage', '必须存在后道详情动态路由')
assertIncludes(routeLinks, 'buildPostFinishingWorkOrderDetailLink', '必须存在后道详情链接 helper')
;['基本信息', '后道记录', '质检记录', '复检记录', '待加工仓', '交出记录', '流转记录'].forEach((label) => {
  assertIncludes(detailPage, label, `后道详情页缺少 ${label}`)
})

assertIncludes(workOrdersPage, 'buildPostFinishingWorkOrderDetailLink(order.postOrderId)', '后道列表查看详情必须跳后道详情页')
assertIncludes(workOrdersPage, "buildTaskRouteCardPrintLink('POST_FINISHING_WORK_ORDER', order.postOrderId)", '后道列表打印任务流转卡必须使用后道单打印来源')
assertIncludes(taskPrintCards, 'POST_FINISHING_WORK_ORDER', '任务流转卡底座必须支持后道单来源')
assertIncludes(workOrdersPage, 'buildPostFinishingWaitProcessWarehouseLink(order.postOrderId)', '后道列表查看待加工仓必须带 postOrderId 定位')
assertIncludes(workOrdersPage, 'buildPostFinishingWaitHandoverWarehouseLink(order.postOrderId)', '后道列表查看交出记录必须带 postOrderId 定位')
assertIncludes(workOrdersPage, '暂无交出记录', '无交出记录时必须明确禁用文案')

assertIncludes(warehousePage, "get('postOrderId')", '后道仓页必须读取 postOrderId 查询参数')
assertIncludes(warehousePage, '已按后道单定位', '后道仓页必须展示定位提示')
assertIncludes(warehousePage, 'sourceWorkOrderId', '后道仓页必须按后道单 ID 定位记录')
assertIncludes(warehousePage, '待处理成衣件数', '后道待加工仓数量字段必须带成衣件数')
assertIncludes(warehousePage, '待交出成衣件数', '后道交出仓数量字段必须带成衣件数')
assertIncludes(warehousePage, '实收成衣件数', '后道交出仓必须展示实收成衣件数')

assertIncludes(pdaStore, "createFactoryPdaUsersForFactory(TEST_FACTORY_ID, '全能力测试工厂')", '工厂端移动应用必须补齐全能力测试工厂账号')
assertIncludes(pdaExecPage, 'listPostFinishingWorkOrders', 'PDA 执行列表必须读取同一批后道单')
assertIncludes(pdaExecPage, 'mapPostFinishingOrderToTask', 'PDA 执行列表必须把后道单映射为移动端任务')
assertIncludes(pdaExecDetailPage, 'getPostFinishingWorkOrderForMobile', 'PDA 后道详情必须读取后道事实源')
;['开始后道', '完成后道', '开始质检', '完成质检', '开始复检', '完成复检', '发起交出'].forEach((label) => {
  assertIncludes(pdaExecDetailPage, label, `PDA 后道详情缺少动作 ${label}`)
})
;['计划成衣件数', '已完成后道成衣件数', '复检确认成衣件数', '交出成衣件数'].forEach((label) => {
  assertIncludes(pdaExecDetailPage + detailPage + workOrdersPage + warehousePage, label, `后道数量字段缺少 ${label}`)
})

const earlyNonDedicated = postOrders.find((order) => order.routeMode === '非专门工厂含后道' && order.currentStatus.includes('待交给后道工厂'))
assert(earlyNonDedicated, '必须存在非专门工厂含后道的早期任务')
let blockedQc = false
try {
  startPostFinishingAction(earlyNonDedicated!.postOrderId, '质检', {
    operatorName: '检查脚本',
    operatedAt: '2026-04-25 10:00:00',
  })
} catch {
  blockedQc = true
}
assert(blockedQc, '非专门后道工厂不能执行质检或复检')

;[workOrdersPage, detailPage, qcPage, recheckPage, warehousePage, pdaExecPage, postDomain].forEach((source, index) => {
  const label = ['work-orders.ts', 'work-order-detail.ts', 'qc-orders.ts', 'recheck-orders.ts', 'warehouse.ts', 'pda-exec.ts', 'post-finishing-domain.ts'][index]
  ;['开扣眼', '装扣子', '熨烫', '包装'].forEach((term) => {
    assertNotIncludes(source, term, `${label} 的后道任务动作不得出现 ${term}`)
  })
})
;['开扣眼', '装扣子', '熨烫'].forEach((term) => {
  assertNotIncludes(pdaExecDetailPage, term, `pda-exec-detail.ts 的后道任务动作不得出现 ${term}`)
})
assertNotIncludes(workOrdersPage + detailPage + qcPage + recheckPage + warehousePage, '数量：', '后道 Web 页面不得只显示“数量：”')
assertIncludes(sharedPage, 'data-nav', '后道操作按钮必须使用真实导航机制')

console.log('post finishing factory/detail/actions checks passed')
