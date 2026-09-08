import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  applySpecialCraftDifferenceToFeiTickets,
  getDifferenceRecordsByWorkOrderId,
  getHandoverRecordsByWorkOrderId,
  getReviewRecordsByWorkOrderId,
  handleProcessHandoverDifference,
  listProcessHandoverDifferenceRecords,
  listProcessHandoverRecords,
  listProcessWarehouseReviewRecords,
  writeBackProcessHandoverRecord,
} from '../src/data/fcs/process-warehouse-domain.ts'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`交出回写与差异记录统一检查失败：${message}`)
  }
}

function includes(path: string, needles: string[]): void {
  const source = read(path)
  for (const needle of needles) {
    assert(source.includes(needle), `${path} 缺少 ${needle}`)
  }
}

const domainPath = 'src/data/fcs/process-warehouse-domain.ts'
assert(existsSync(join(root, domainPath)), '缺少统一仓模型文件')

includes(domainPath, [
  'export interface ProcessHandoverRecord',
  'export interface ProcessHandoverDifferenceRecord',
  'export interface ProcessWarehouseReviewRecord',
  'listProcessHandoverRecords',
  'listProcessHandoverDifferenceRecords',
  'listProcessWarehouseReviewRecords',
  'getProcessHandoverRecordById',
  'getProcessHandoverDifferenceRecordById',
  'getProcessWarehouseReviewRecordById',
  'getHandoverRecordsByWorkOrderId',
  'getDifferenceRecordsByWorkOrderId',
  'getReviewRecordsByWorkOrderId',
  'getHandoverRecordsByWarehouseRecordId',
  'getDifferenceRecordsByHandoverRecordId',
  'createProcessHandoverRecord',
  'writeBackProcessHandoverRecord',
  'handleProcessHandoverDifference',
  'applySpecialCraftDifferenceToFeiTickets',
])

includes('src/pages/process-factory/printing/work-order-detail.ts', [
  'order.handover.handedOverQty',
  'order.handover.receivedQty',
  'order.handover.diffQty',
  "actionButton('交出', 'handover'",
  "actionButton('接收', 'receive-handover'",
  '累计交出',
  '累计接收',
  '差异/说明',
])

includes('src/pages/process-factory/dyeing/work-order-detail.ts', [
  'getHandoverRecordsByWorkOrderId',
  'getReviewRecordsByWorkOrderId',
  'getDifferenceRecordsByWorkOrderId',
  'handleProcessHandoverDifference',
  '染色统计',
  "dyeQuantityLabel(order, '已交出', 'DYE_SUBMIT_HANDOVER')",
  "dyeQuantityLabel(order, '实收')",
  'review.diffObjectQty',
])

includes('src/pages/process-factory/special-craft/task-detail.ts', [
  'getSpecialCraftBindingsByTaskOrderId',
  'getSpecialCraftBindingSummaryByTaskOrderId',
  'executeProcessWebAction',
  "actionCode === 'SPECIAL_CRAFT_SUBMIT_HANDOVER'",
  '已接收数量',
  '已交出 / 待交出',
  '交出去向',
])

includes('src/pages/process-factory/post-finishing/warehouse.ts', [
  'listPostFinishingWaitHandoverWarehouseRecords',
  'listPostFinishingWaitHandoverWarehouseMovements',
  '处理后数量与条码复核完成后生成入仓流水',
  '成衣仓收货后生成交出流水',
  'movement.quantities',
])

includes('src/pages/process-factory/post-finishing/statistics.ts', [
  'getPostFinishingExecutionStatistics',
  '交出成衣件数',
  '实收成衣件数',
  '差异成衣件数',
])
includes('src/data/fcs/process-statistics-domain.ts', ['listProcessHandoverRecords', 'listProcessHandoverDifferenceRecords'])

includes('src/pages/process-factory/printing/statistics.ts', ['listPrintingWorkOrders', 'getPrintingWorkOrderSummary', '交出状态分布', '已交出', '已接收'])
includes('src/pages/process-factory/dyeing/reports.ts', ['染色有差异交出记录数', '染色待收货交出记录数', '染色已收货交出记录数'])

const requiredCrafts = [
  ['DYE', '染色'],
  ['SPECIAL_CRAFT', '特殊工艺'],
] as const

for (const [craftType, label] of requiredCrafts) {
  const handovers = listProcessHandoverRecords({ craftType })
  const differences = listProcessHandoverDifferenceRecords({ craftType })
  const reviews = listProcessWarehouseReviewRecords({ craftType })
  assert(handovers.filter((record) => record.status === '交出待收货').length >= 3, `${label} 交出待收货记录少于 3 条`)
  assert(handovers.filter((record) => record.status === '全部交出').length >= 3, `${label} 全部交出记录少于 3 条`)
  assert(handovers.filter((record) => record.status === '收货差异').length >= 3, `${label} 收货差异记录少于 3 条`)
  assert(differences.length >= 3, `${label} 差异记录少于 3 条`)
  assert(reviews.length >= 3, `${label} 审核记录少于 3 条`)
}

const dyeCandidate = listProcessHandoverRecords({ craftType: 'DYE' }).find((record) => record.status === '交出待收货')
assert(dyeCandidate, '缺少可用于收货校验的染色交出待收货记录')
const dyeWrittenBack = writeBackProcessHandoverRecord(dyeCandidate!.handoverRecordId, {
  receiveObjectQty: Math.max(dyeCandidate!.handoverObjectQty - 1, 0),
  receivePerson: '平台验收员',
  receiveAt: '2026-04-25 10:30',
  remark: '专项检查模拟少收',
})
assert(dyeWrittenBack?.status === '收货差异', '染色收货数量不一致时必须进入收货差异')
assert(getDifferenceRecordsByWorkOrderId(dyeCandidate!.workOrderId).some((record) => record.handoverRecordId === dyeCandidate!.handoverRecordId), '染色数量不一致后未生成统一差异记录')
assert(getReviewRecordsByWorkOrderId(dyeCandidate!.workOrderId).some((record) => record.reviewStatus === '收货差异'), '染色数量不一致后未生成收货差异审核记录')

const handledDifference = getDifferenceRecordsByWorkOrderId(dyeCandidate!.workOrderId).find((record) => record.handoverRecordId === dyeCandidate!.handoverRecordId)
assert(handledDifference, '缺少可用于平台处理的差异记录')
handleProcessHandoverDifference(handledDifference!.differenceRecordId, {
  handlingResult: '要求交出工厂补交差异面料',
  responsibilitySide: '交出工厂',
  nextAction: '要求重新交出',
  handledBy: '平台处理员',
  handledAt: '2026-04-25 10:45',
  remark: '专项检查模拟重新交出',
})
assert(
  listProcessHandoverDifferenceRecords({ workOrderId: dyeCandidate!.workOrderId }).some((record) => record.status === '需重新交出'),
  '平台处理差异后未进入需重新交出状态',
)

const dyeWorkOrderId = listProcessHandoverRecords({ craftType: 'DYE' })[0]?.workOrderId
assert(dyeWorkOrderId && getHandoverRecordsByWorkOrderId(dyeWorkOrderId).length > 0, '染色详情无法通过统一交出记录追溯')

const specialDifference = listProcessHandoverDifferenceRecords({ craftType: 'SPECIAL_CRAFT' }).find((record) => record.relatedFeiTicketIds.length > 0)
assert(specialDifference, '特殊工艺差异记录缺少关联菲票')
const appliedSpecialDifference = applySpecialCraftDifferenceToFeiTickets(specialDifference!.differenceRecordId, {
  operatorName: '平台处理员',
  operatedAt: '2026-04-25 11:00',
})
assert(appliedSpecialDifference?.status === '已确认差异', '特殊工艺差异同步菲票后应标记已确认差异')

const postSource = [
  'src/pages/process-factory/post-finishing/work-orders.ts',
  'src/pages/process-factory/post-finishing/qc-orders.ts',
  'src/pages/process-factory/post-finishing/recheck-orders.ts',
  'src/pages/process-factory/post-finishing/warehouse.ts',
  'src/pages/process-factory/post-finishing/statistics.ts',
  'src/data/fcs/post-finishing-full-flow.ts',
  domainPath,
].map(read).join('\n')
assert(postSource.includes('listPostFinishingWaitHandoverWarehouseRecords'), '后道交出记录必须读取当前全流程待交出仓事实')
assert(postSource.includes('getOrCreateWaitHandoverWarehouseRecord') && postSource.includes('upsertOutboundFromRecheck'), '处理后复核必须在当前全流程内形成待交出仓与唯一出货事实')
assert(!postSource.includes('post-finishing-domain.ts'), '后道交出链不得继续读取旧后道域')

const dyeReportWord = '染色' + '报表'
const visibleDyeSource = [
  'src/pages/process-factory/dyeing/work-orders.ts',
  'src/pages/process-factory/dyeing/work-order-detail.ts',
  'src/pages/process-factory/dyeing/reports.ts',
  'src/data/app-shell-config.ts',
  'src/router/routes-fcs.ts',
].map(read).join('\n')
assert(!visibleDyeSource.includes(dyeReportWord), '用户可见文案不得出现旧染色报表命名')

const modifiedPages = [
  'src/pages/process-factory/printing/work-order-detail.ts',
  'src/pages/process-factory/dyeing/work-order-detail.ts',
  'src/pages/process-factory/special-craft/task-detail.ts',
  'src/pages/process-factory/post-finishing/warehouse.ts',
].map(read).join('\n')
assert(!/>\s*数量：/.test(modifiedPages), '页面不得只显示“数量：”，必须带对象和单位')

const settlementForbiddenSource = read(domainPath)
for (const forbidden of ['质量扣款流水', '对账流水', '结算流水']) {
  assert(!settlementForbiddenSource.includes(forbidden), `差异处理不得直接生成${forbidden}`)
}

assert(existsSync(join(root, 'docs/fcs-handover-writeback-and-difference-unification.md')), '缺少交出回写与差异记录统一文档')

console.log('交出回写与差异记录统一检查通过')
