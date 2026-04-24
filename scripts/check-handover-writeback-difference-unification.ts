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
  listWaitHandoverWarehouseRecords,
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
  'getHandoverRecordsByWorkOrderId',
  'getReviewRecordsByWorkOrderId',
  'getDifferenceRecordsByWorkOrderId',
  'handleProcessHandoverDifference',
  '交出面料米数',
  '实收面料米数',
  '差异面料米数',
])

includes('src/pages/process-factory/dyeing/work-order-detail.ts', [
  'getHandoverRecordsByWorkOrderId',
  'getReviewRecordsByWorkOrderId',
  'getDifferenceRecordsByWorkOrderId',
  'handleProcessHandoverDifference',
  '染色统计',
  '交出面料米数',
  '实收面料米数',
  '差异面料米数',
])

includes('src/pages/process-factory/special-craft/work-order-detail.ts', [
  'getDifferenceRecordsByWorkOrderId',
  'applySpecialCraftDifferenceToFeiTickets',
  '同步菲票数量',
  '交出裁片数量',
  '实收裁片数量',
  '差异裁片数量',
])

includes('src/pages/process-factory/post-finishing/warehouse.ts', [
  'getHandoverRecordsByWarehouseRecordId',
  '统一交出记录',
  '交出成衣件数',
  '实收成衣件数',
  '差异成衣件数',
])

includes('src/pages/process-factory/post-finishing/statistics.ts', [
  'getPostFinishingExecutionStatistics',
  '交出成衣件数',
  '实收成衣件数',
  '差异成衣件数',
])
includes('src/data/fcs/process-statistics-domain.ts', ['listProcessHandoverRecords', 'listProcessHandoverDifferenceRecords'])

includes('src/pages/process-factory/printing/statistics.ts', ['有差异交出记录数', '待回写交出记录数', '已回写交出记录数'])
includes('src/pages/process-factory/dyeing/reports.ts', ['有差异交出记录数', '待回写交出记录数', '已回写交出记录数'])
includes('src/pages/process-factory/special-craft/statistics.ts', ['报废裁片数量', '货损裁片数量', '有差异交出记录数'])

const requiredCrafts = [
  ['PRINT', '印花'],
  ['DYE', '染色'],
  ['SPECIAL_CRAFT', '特殊工艺'],
  ['POST_FINISHING', '后道'],
] as const

for (const [craftType, label] of requiredCrafts) {
  const handovers = listProcessHandoverRecords({ craftType })
  const differences = listProcessHandoverDifferenceRecords({ craftType })
  const reviews = listProcessWarehouseReviewRecords({ craftType })
  assert(handovers.filter((record) => record.status === '待回写').length >= 3, `${label} 待回写交出记录少于 3 条`)
  assert(handovers.filter((record) => record.status === '已回写').length >= 3, `${label} 已回写交出记录少于 3 条`)
  assert(handovers.filter((record) => record.status === '有差异').length >= 3, `${label} 有差异交出记录少于 3 条`)
  assert(differences.length >= 3, `${label} 差异记录少于 3 条`)
  assert(reviews.length >= 3, `${label} 审核记录少于 3 条`)
}

const printCandidate = listProcessHandoverRecords({ craftType: 'PRINT' }).find((record) => record.status === '待回写')
assert(printCandidate, '缺少可用于回写校验的印花待回写交出记录')
const printWrittenBack = writeBackProcessHandoverRecord(printCandidate!.handoverRecordId, {
  receiveObjectQty: Math.max(printCandidate!.handoverObjectQty - 1, 0),
  receivePerson: '平台验收员',
  receiveAt: '2026-04-25 10:30',
  remark: '专项检查模拟少收',
})
assert(printWrittenBack?.status === '有差异', '印花回写数量不一致时必须进入有差异')
assert(getDifferenceRecordsByWorkOrderId(printCandidate!.sourceWorkOrderId).some((record) => record.handoverRecordId === printCandidate!.handoverRecordId), '印花数量不一致后未生成统一差异记录')
assert(getReviewRecordsByWorkOrderId(printCandidate!.sourceWorkOrderId).some((record) => record.reviewStatus === '数量差异'), '印花数量不一致后未生成数量差异审核记录')

const handledDifference = getDifferenceRecordsByWorkOrderId(printCandidate!.sourceWorkOrderId).find((record) => record.handoverRecordId === printCandidate!.handoverRecordId)
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
  listProcessHandoverDifferenceRecords({ sourceWorkOrderId: printCandidate!.sourceWorkOrderId }).some((record) => record.status === '需重新交出'),
  '平台处理差异后未进入需重新交出状态',
)

const dyeWorkOrderId = listProcessHandoverRecords({ craftType: 'DYE' })[0]?.sourceWorkOrderId
assert(dyeWorkOrderId && getHandoverRecordsByWorkOrderId(dyeWorkOrderId).length > 0, '染色详情无法通过统一交出记录追溯')

const specialDifference = listProcessHandoverDifferenceRecords({ craftType: 'SPECIAL_CRAFT' }).find((record) => record.relatedFeiTicketIds.length > 0)
assert(specialDifference, '特殊工艺差异记录缺少关联菲票')
const appliedSpecialDifference = applySpecialCraftDifferenceToFeiTickets(specialDifference!.differenceRecordId, {
  operatorName: '平台处理员',
  operatedAt: '2026-04-25 11:00',
})
assert(appliedSpecialDifference?.status === '已确认差异', '特殊工艺差异同步菲票后应标记已确认差异')

const postWaitHandover = listWaitHandoverWarehouseRecords({ craftType: 'POST_FINISHING' })
assert(postWaitHandover.length >= 3, '后道交出仓记录少于 3 条')
assert(postWaitHandover.every((record) => record.currentActionName === '后道待交出'), '后道交出仓只能来自复检完成后的后道待交出记录')
assert(listProcessHandoverRecords({ craftType: 'POST_FINISHING' }).every((record) => record.warehouseRecordId), '后道交出记录必须关联后道交出仓记录')

const postSource = [
  'src/pages/process-factory/post-finishing/work-orders.ts',
  'src/pages/process-factory/post-finishing/qc-orders.ts',
  'src/pages/process-factory/post-finishing/recheck-orders.ts',
  'src/pages/process-factory/post-finishing/warehouse.ts',
  'src/pages/process-factory/post-finishing/statistics.ts',
  'src/data/fcs/post-finishing-domain.ts',
  domainPath,
].map(read).join('\n')
for (const word of ['开扣眼', '装扣子', '熨烫']) {
  assert(!postSource.includes(word), `后道任务动作不应出现 ${word}`)
}

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
  'src/pages/process-factory/special-craft/work-order-detail.ts',
  'src/pages/process-factory/post-finishing/warehouse.ts',
].map(read).join('\n')
assert(!/>\s*数量：/.test(modifiedPages), '页面不得只显示“数量：”，必须带对象和单位')

const settlementForbiddenSource = read(domainPath)
for (const forbidden of ['质量扣款流水', '对账流水', '结算流水']) {
  assert(!settlementForbiddenSource.includes(forbidden), `差异处理不得直接生成${forbidden}`)
}

assert(existsSync(join(root, 'docs/fcs-handover-writeback-and-difference-unification.md')), '缺少交出回写与差异记录统一文档')

console.log('交出回写与差异记录统一检查通过')
