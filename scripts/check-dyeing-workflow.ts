import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import assert from 'node:assert/strict'

import {
  getDyeOrderHandoverSummary,
  getDyeWorkOrderByTaskId,
  hasDirectPackingToReviewOrCompleteTransition,
  listDyeFormulaRecords,
  listDyeReportRows,
  listDyeReviewRecords,
  listDyeVatSchedules,
  listDyeWorkOrders,
  validateDyeStartPayload,
} from '../src/data/fcs/dyeing-task-domain.ts'

const repoRoot = process.cwd()
const dyePages = [
  'src/pages/process-factory/dyeing/work-orders.ts',
  'src/pages/process-factory/dyeing/warehouse.ts',
  'src/pages/process-factory/dyeing/dye-orders.ts',
  'src/pages/process-factory/dyeing/reports.ts',
]

function readFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

function assertIncludes(source: string, expected: string, label: string): void {
  assert(source.includes(expected), `${label} 缺少：${expected}`)
}

function assertNotIncludes(source: string, disallowed: string, label: string): void {
  assert(!source.includes(disallowed), `${label} 不应包含：${disallowed}`)
}

function makeText(parts: string[]): string {
  return parts.join('')
}

function main(): void {
  const dyePdaTerms = [
    makeText(['染色', 'PDA']),
    makeText(['染色', ' ', 'PDA']),
    makeText(['Dyeing', ' ', 'PDA']),
    makeText(['PDA', '染色']),
  ]
  const placeholderTerms = [
    makeText(['sca', 'ffold']),
    makeText(['Sca', 'ffold']),
    makeText(['占', '位']),
    makeText(['TO', 'DO']),
    makeText(['coming', ' soon']),
    makeText(['敬', '请', '期待']),
    makeText(['骨', '架']),
    makeText(['仅', '展示']),
    makeText(['mo', 'ck']),
  ]
  const printTerms = [
    makeText(['print', 'Order']),
    makeText(['print', 'OrderNo']),
    makeText(['pattern', 'No']),
    makeText(['印', '花']),
    makeText(['花', '型']),
    makeText(['打', '印', '机']),
    makeText(['转', '印']),
    makeText(['printer', 'No']),
    makeText(['trans', 'fer']),
  ]

  for (const file of dyePages) {
    const source = readFile(file)
    placeholderTerms.forEach((term) => assertNotIncludes(source, term, file))
    dyePdaTerms.forEach((term) => assertNotIncludes(source, term, file))
  }

  const workOrdersSource = readFile('src/pages/process-factory/dyeing/work-orders.ts')
  const appShellSource = readFile('src/data/app-shell-config.ts')
  const warehouseSource = readFile('src/pages/process-factory/dyeing/warehouse.ts')
  const routesSource = readFile('src/router/routes-fcs.ts')
  const formulaSource = readFile('src/pages/process-factory/dyeing/dye-orders.ts')
  const reportsSource = readFile('src/pages/process-factory/dyeing/reports.ts')
  const taskDetailSource = readFile('src/pages/pda-exec-detail.ts')
  const handoverSource = readFile('src/pages/pda-handover.ts')
  const handoverDetailSource = readFile('src/pages/pda-handover-detail.ts')

  assertIncludes(workOrdersSource, '染色加工单', '染色加工单页面')
  assertIncludes(workOrdersSource, '打印任务流转卡', '染色加工单页面')
  assertIncludes(workOrdersSource, "buildTaskRouteCardPrintLink('DYEING_WORK_ORDER', order.dyeOrderId)", '染色加工单打印任务流转卡必须使用 DYEING_WORK_ORDER + dyeOrderId')
  assertNotIncludes(workOrdersSource, '打印任务交货卡', '染色加工单页面不得提前增加打印任务交货卡入口')
  assertIncludes(appShellSource, '染色待加工仓', '染厂管理菜单')
  assertIncludes(appShellSource, '染色待交出仓', '染厂管理菜单')
  assertIncludes(warehouseSource, 'renderCraftDyeingWaitHandoverWarehousePage', '染色待交出仓页面')
  assertIncludes(warehouseSource, '出库记录', '染色待交出仓页面')
  assertIncludes(warehouseSource, '打印任务交货卡', '染色待交出仓出库记录')
  assertIncludes(warehouseSource, 'buildTaskDeliveryCardPrintLink(item.handoverRecordId)', '染色任务交货卡必须使用 handoverRecordId')
  assertIncludes(
    routesSource,
    "renderRouteRedirect('/fcs/craft/dyeing/wait-process-warehouse', '正在跳转到染色待加工仓')",
    '染色旧仓库入口',
  )
  assertIncludes(formulaSource, '染色配方', '染色配方页面')
  assertIncludes(reportsSource, '等待原因', '染色统计页面')
  assertIncludes(reportsSource, '节点耗时', '染色统计页面')
  assertIncludes(reportsSource, '染缸利用', '染色统计页面')
  assertIncludes(reportsSource, '差异面料米数', '染色统计页面')
  assertIncludes(reportsSource, '染色有差异交出记录数', '染色统计页面')
  assertIncludes(taskDetailSource, '染色任务', '任务详情页面')
  assertIncludes(taskDetailSource, '染缸编号', '任务详情页面')
  assertIncludes(taskDetailSource, '待送货', '任务详情页面')

  const orders = listDyeWorkOrders()
  assert(orders.length >= 6, '染色加工单数据不足')
  assert(orders.every((order) => Boolean(order.taskId && order.taskNo)), '染色加工单必须关联染色任务')
  assert(orders.every((order) => order.taskQrValue.startsWith('FCS:TASK:v1:')), '染色任务必须有任务二维码')
  assert(orders.some((order) => order.status === 'WAIT_HANDOVER'), '染色任务必须包含待送货状态')
  assert(orders.some((order) => order.status === 'WAIT_REVIEW'), '染色任务必须包含待审核状态')
  assert(orders.every((order) => order.receiverName === '中转区域' || order.receiverName === '仓库'), '接收方必须是中转区域或仓库')
  assert(orders.every((order) => !order.targetTransferWarehouseName.includes('裁床仓') && !order.targetTransferWarehouseName.includes('裁片仓')), '染色完成后不能直接进入裁床仓')
  assert(orders.some((order) => Boolean(order.handoverOrderId)), '开工后的染色任务必须有交出单')

  const waitReviewOrder = orders.find((order) => order.status === 'WAIT_REVIEW')
  assert(waitReviewOrder, '需要至少一条待审核染色加工单')
  assert(getDyeOrderHandoverSummary(waitReviewOrder.dyeOrderId).writtenBackQty > 0, '接收方回写后才能进入待审核')

  const startValidation = validateDyeStartPayload({})
  assert(!startValidation.ok, '没有染缸编号时不能进入染色中')

  const vatSchedules = listDyeVatSchedules()
  assert(vatSchedules.length > 0, '需要染缸排期数据')
  assert(vatSchedules.every((item) => Boolean(item.dyeVatNo && item.capacityQty > 0)), '染缸排期必须包含染缸编号和容量')

  const formulas = listDyeFormulaRecords()
  assert(formulas.length > 0, '需要染色配方数据')
  assert(formulas.every((item) => Boolean(item.dyeOrderId || item.taskId)), '染色配方必须关联染色加工单或染色任务')
  assert(formulas.every((item) => !('handoverOrderId' in item) && !('taskQrValue' in item)), '染色配方不能创建交出单或任务二维码')

  const reportRows = listDyeReportRows()
  assert(reportRows.length === orders.length, '染色统计需要覆盖所有加工单')
  assert(reportRows.some((row) => row.waitingReason.length > 0), '报表必须展示等待原因')
  assert(reportRows.some((row) => row.durationHours >= 0), '报表必须展示节点耗时')
  assert(reportRows.some((row) => row.dyeVatNo), '报表必须展示染缸利用')

  const reviews = listDyeReviewRecords()
  assert(reviews.some((review) => review.reviewStatus === 'REJECTED' && Boolean(review.rejectReason)), '审核驳回必须有驳回原因')
  assert(!hasDirectPackingToReviewOrCompleteTransition(), '包装后必须先进入待送货')

  const handoverLinkedOrders = orders.filter((order) => getDyeOrderHandoverSummary(order.dyeOrderId).recordCount > 0)
  assert(handoverLinkedOrders.length > 0, '染色交出必须使用通用交出单和交出记录')
  assert(handoverLinkedOrders.every((order) => getDyeOrderHandoverSummary(order.dyeOrderId).recordCount >= 1), '每条染色交出记录都要存在')

  const packingOrder = orders.find((order) => order.status === 'WAIT_HANDOVER')
  assert(packingOrder, '包装完成后必须进入待送货')
  assert(getDyeWorkOrderByTaskId(packingOrder.taskId)?.status === 'WAIT_HANDOVER', '包装后待送货节点缺失')

  printTerms.forEach((term) => {
    assertNotIncludes(workOrdersSource, term, '染色加工单页面')
    assertNotIncludes(formulaSource, term, '染色配方页面')
    assertNotIncludes(reportsSource, term, '染色统计页面')
    const dyeDataSource = readFile('src/data/fcs/dyeing-task-domain.ts')
    assertNotIncludes(dyeDataSource, term, '染色数据域')
  })

  assertNotIncludes(handoverSource, ['交出', '头'].join(''), '交出单列表页面')
  assertNotIncludes(handoverDetailSource, ['交出', '头'].join(''), '交出单详情页面')

  console.log('[check-dyeing-workflow] PASS')
  console.log(`  染色加工单: ${orders.length}`)
  console.log(`  染色配方: ${formulas.length}`)
  console.log(`  染缸排期: ${vatSchedules.length}`)
  console.log(`  待审核: ${reviews.filter((review) => review.reviewStatus === 'WAIT_REVIEW').length}`)
}

main()
