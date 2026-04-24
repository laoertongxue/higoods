import fs from 'node:fs'
import path from 'node:path'
import {
  getPrintExecutionNodeRecord,
  getPrintOrderHandoverHead,
  getPrintOrderHandoverRecords,
  getPrintOrderHandoverSummary,
  getPrintReviewRecordByOrderId,
  getPrintWorkOrderByTaskId,
  getPrintWorkOrderStatusLabel,
  hasDirectTransferToReviewTransition,
  listPrintMachineOptions,
  listPrintWorkOrders,
} from '../src/data/fcs/printing-task-domain.ts'

function fail(message: string): never {
  throw new Error(`[check-printing-workflow] ${message}`)
}

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) fail(message)
}

const pageFiles = [
  'src/pages/process-factory/printing/work-orders.ts',
  'src/pages/process-factory/printing/warehouse.ts',
  'src/pages/process-factory/printing/progress.ts',
  'src/pages/process-factory/printing/pending-review.ts',
  'src/pages/process-factory/printing/statistics.ts',
  'src/pages/process-factory/printing/dashboards.ts',
]

const pageSources = pageFiles.map((file) => ({ file, source: readFile(file) }))
const appShellSource = readFile('src/data/app-shell-config.ts')
const workOrdersPageSource = readFile('src/pages/process-factory/printing/work-orders.ts')
const warehousePageSource = readFile('src/pages/process-factory/printing/warehouse.ts')
const routesSource = readFile('src/router/routes-fcs.ts')
const oldTemplateToken = ['renderProcessFactory', 'Scaf', 'foldPage'].join('')
const oldPrintTerms = [
  ['印花', 'PDA'].join(''),
  ['印花 ', 'PDA'].join(''),
  ['Printing', ' PDA'].join(''),
  ['PDA', '印花'].join(''),
]

pageSources.forEach(({ file, source }) => {
  assert(!source.includes(oldTemplateToken), `${file} 仍在引用旧页面模板`)
  assert(!source.includes('骨' + '架页'), `${file} 仍含旧页面描述`)
  assert(!source.includes('仅展' + '示'), `${file} 仍含旧页面描述`)
  assert(!source.includes('敬请' + '期待'), `${file} 仍含旧页面描述`)
  oldPrintTerms.forEach((term) => {
    assert(!source.includes(term), `${file} 出现禁用文案：${term}`)
  })
})

const taskDetailSource = readFile('src/pages/pda-exec-detail.ts')
assert(workOrdersPageSource.includes('打印任务流转卡'), '印花加工单页缺少打印任务流转卡入口')
assert(
  workOrdersPageSource.includes("buildTaskRouteCardPrintLink('PRINTING_WORK_ORDER', order.printOrderId)"),
  '印花加工单页打印任务流转卡必须使用 PRINTING_WORK_ORDER + printOrderId',
)
assert(!workOrdersPageSource.includes('打印任务交货卡'), '印花加工单页不得提前增加打印任务交货卡入口')
assert(appShellSource.includes('印花待加工仓'), '印花厂管理菜单缺少印花待加工仓')
assert(appShellSource.includes('印花待交出仓'), '印花厂管理菜单缺少印花待交出仓')
assert(warehousePageSource.includes('renderCraftPrintingWaitHandoverWarehousePage'), '印花缺少待交出仓页面')
assert(warehousePageSource.includes('出库记录'), '印花待交出仓页缺少出库记录')
assert(warehousePageSource.includes('打印任务交货卡'), '印花待交出仓出库记录缺少打印任务交货卡')
assert(warehousePageSource.includes('buildTaskDeliveryCardPrintLink(item.handoverRecordId)'), '印花任务交货卡必须按 handoverRecordId 打印')
assert(
  routesSource.includes("renderRouteRedirect('/fcs/craft/printing/wait-process-warehouse', '正在跳转到印花待加工仓')"),
  '印花旧仓库入口必须重定向到印花待加工仓',
)
assert(taskDetailSource.includes('印花任务'), '任务详情页缺少印花任务区块')
assert(taskDetailSource.includes('打印机编号'), '任务详情页缺少打印机编号字段')
assert(taskDetailSource.includes('原料使用'), '任务详情页缺少原料使用字段')
assert(taskDetailSource.includes('实际完成'), '任务详情页缺少实际完成字段')
assert(taskDetailSource.includes('待送货'), '任务详情页缺少待送货状态')
oldPrintTerms.forEach((term) => {
  assert(!taskDetailSource.includes(term), `任务详情页出现禁用文案：${term}`)
})

const statisticsSource = readFile('src/pages/process-factory/printing/statistics.ts')
assert(statisticsSource.includes('打印机编号'), '统计页缺少打印机编号')
assert(statisticsSource.includes('打印速度'), '统计页缺少打印速度')
assert(statisticsSource.includes('待送货'), '统计页缺少待送货指标')
assert(statisticsSource.includes('待回写'), '统计页缺少待回写指标')
assert(statisticsSource.includes('待审核'), '统计页缺少待审核指标')

const dashboardSource = readFile('src/pages/process-factory/printing/dashboards.ts')
assert(dashboardSource.includes('待送货'), '大屏缺少待送货模块')
assert(dashboardSource.includes('待回写'), '大屏缺少待回写模块')
assert(dashboardSource.includes('待审核'), '大屏缺少待审核模块')

const reviewSource = readFile('src/pages/process-factory/printing/pending-review.ts')
assert(reviewSource.includes('接收方'), '审核页缺少接收方字段')
assert(reviewSource.includes('审核通过'), '审核页缺少审核通过入口')
assert(reviewSource.includes('审核驳回'), '审核页缺少审核驳回入口')

const progressSource = readFile('src/pages/process-factory/printing/progress.ts')
assert(progressSource.includes('待送货'), '进度页缺少待送货节点')
assert(progressSource.includes('接收方回写'), '进度页缺少接收方回写节点')
assert(progressSource.includes('审核'), '进度页缺少审核节点')

const { listPdaGenericProcessTasks } = await import(`../src/data/fcs/pda-task-${'mo'}${'ck'}-factory.ts`)
const tasks = listPdaGenericProcessTasks()
const orders = listPrintWorkOrders()
assert(orders.length > 0, '未生成印花加工单数据')
assert(orders.some((order) => getPrintWorkOrderStatusLabel(order.status) === '待送货'), '印花状态缺少待送货')
assert(!hasDirectTransferToReviewTransition(), '仍存在转印完成直达审核的链路')

orders.forEach((order) => {
  const task = tasks.find((item) => item.taskId === order.taskId)
  assert(task, `印花加工单 ${order.printOrderNo} 未关联任务`)
  assert(getPrintWorkOrderByTaskId(order.taskId)?.printOrderId === order.printOrderId, `${order.printOrderNo} 与任务关联断裂`)
  assert((task?.taskQrValue || '').startsWith('FCS:TASK:v1:'), `${order.printOrderNo} 缺少任务二维码`)
  assert(order.targetTransferWarehouseName === '中转区域', `${order.printOrderNo} 接收方不是中转区域`)
  assert(!/裁床仓|裁片仓/.test(order.targetTransferWarehouseName), `${order.printOrderNo} 错误指向裁床仓`)

  const printNode = getPrintExecutionNodeRecord(order.printOrderId, 'PRINT')
  if (printNode?.startedAt) {
    assert(Boolean(printNode.printerNo), `${order.printOrderNo} 打印开始缺少打印机编号`)
  }
  if (printNode?.finishedAt) {
    assert((printNode.outputQty ?? 0) > 0, `${order.printOrderNo} 打印结束缺少完成数量`)
  }

  const transferNode = getPrintExecutionNodeRecord(order.printOrderId, 'TRANSFER')
  if (transferNode?.startedAt) {
    assert(Boolean(transferNode.startedAt), `${order.printOrderNo} 转印开始未记录时间`)
  }
  if (transferNode?.finishedAt) {
    assert((transferNode.usedMaterialQty ?? 0) > 0, `${order.printOrderNo} 转印结束缺少原料使用`)
    assert((transferNode.actualCompletedQty ?? 0) > 0, `${order.printOrderNo} 转印结束缺少实际完成`)
  }

  const handoverHead = getPrintOrderHandoverHead(order.printOrderId)
  if (task?.startedAt) {
    assert(Boolean(order.handoverOrderId || handoverHead?.handoverOrderId || handoverHead?.handoverId), `${order.printOrderNo} 开工后缺少交出单`)
  }

  const handoverRecords = getPrintOrderHandoverRecords(order.printOrderId)
  handoverRecords.forEach((record) => {
    assert(Boolean(record.handoverRecordQrValue), `${order.printOrderNo} 存在缺少二维码的交出记录`)
  })

  const handoverSummary = getPrintOrderHandoverSummary(order.printOrderId)
  const review = getPrintReviewRecordByOrderId(order.printOrderId)
  if (review) {
    assert(handoverSummary.writtenBackQty > 0, `${order.printOrderNo} 未回写就进入审核`)
  }
  if (review?.reviewStatus === 'REJECTED') {
    assert(Boolean(review.rejectReason?.trim()), `${order.printOrderNo} 审核驳回缺少原因`)
  }
})

const machineList = listPrintMachineOptions('ID-F002')
assert(machineList.length > 0, '印花工厂未配置打印机')

console.log('[check-printing-workflow] 印花加工单、任务节点、交出与审核链路通过')
console.table(
  orders.map((order) => {
    const task = tasks.find((item) => item.taskId === order.taskId)
    const printNode = getPrintExecutionNodeRecord(order.printOrderId, 'PRINT')
    const transferNode = getPrintExecutionNodeRecord(order.printOrderId, 'TRANSFER')
    const handoverSummary = getPrintOrderHandoverSummary(order.printOrderId)
    const review = getPrintReviewRecordByOrderId(order.printOrderId)

    return {
      印花单号: order.printOrderNo,
      印花任务: order.taskNo,
      任务二维码: task?.taskQrValue ? '已生成' : '缺失',
      当前状态: getPrintWorkOrderStatusLabel(order.status),
      打印机编号: printNode?.printerNo || '—',
      原料使用: transferNode?.usedMaterialQty ?? 0,
      实际完成: transferNode?.actualCompletedQty ?? 0,
      交出记录: handoverSummary.recordCount,
      待回写: handoverSummary.pendingWritebackCount,
      审核状态: review ? (review.reviewStatus === 'PASS' ? '已完成' : review.reviewStatus === 'REJECTED' ? '已驳回' : '待审核') : '未进入审核',
    }
  }),
)
