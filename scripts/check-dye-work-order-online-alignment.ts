import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { listDyeWorkOrders } from '../src/data/fcs/dyeing-task-domain.ts'
import {
  advanceDyeWorkOrderOnlineStatus,
  getDyeWorkOrderOnlineRecord,
  isDyeWorkOrderHighRiskStatusChange,
  listDyeWorkOrderOnlineLogs,
  updateDyeWorkOrderFromPfos,
} from '../src/data/fcs/dye-work-order-online-domain.ts'
import {
  buildDyeWorkOrderCsv,
  filterDyeWorkOrderOnlineRows,
  getDyeWorkOrderOnlineSummary,
  listDyeWorkOrderOnlineRows,
} from '../src/data/fcs/dye-work-order-online-view.ts'
import { buildDyeingWorkOrderDetailLink } from '../src/data/fcs/fcs-route-links.ts'
import { renderDyeWorkOrderOverlay } from '../src/pages/process-factory/dyeing/work-order-overlays.ts'
import { buildDyeWorkOrderFlowCardPrintDocument } from '../src/pages/print/templates/dye-work-order-flow-card-template.ts'

const order = listDyeWorkOrders().find((item) => getDyeWorkOrderOnlineRecord(item.dyeOrderId).status === '等待处理')
assert(order, '至少需要一张等待处理的染色加工单')

const initial = getDyeWorkOrderOnlineRecord(order.dyeOrderId)
assert.equal(initial.status, '等待处理')

advanceDyeWorkOrderOnlineStatus(order.dyeOrderId, {
  action: '接单',
  operatorName: '染厂操作员',
  operatedAt: '2026-07-16 08:00:00',
  source: 'PDA',
})
assert.equal(getDyeWorkOrderOnlineRecord(order.dyeOrderId).status, '等待处理')

advanceDyeWorkOrderOnlineStatus(order.dyeOrderId, {
  action: '开工',
  operatorName: '染厂操作员',
  operatedAt: '2026-07-16 08:10:00',
  source: 'PDA',
})
assert.equal(getDyeWorkOrderOnlineRecord(order.dyeOrderId).status, '染色中')

advanceDyeWorkOrderOnlineStatus(order.dyeOrderId, {
  action: '完工',
  operatorName: '染厂操作员',
  operatedAt: '2026-07-16 12:00:00',
  source: 'PDA',
  completedQty: 80,
  lossQty: 3,
})
const completed = getDyeWorkOrderOnlineRecord(order.dyeOrderId)
assert.equal(completed.status, '染色完成')
assert.equal(completed.completedQty, 80)
assert.equal(completed.lossQty, 3)

assert.equal(isDyeWorkOrderHighRiskStatusChange('染色完成', '等待处理'), true)
updateDyeWorkOrderFromPfos(order.dyeOrderId, {
  expectedVersion: completed.version,
  operatorName: '染厂主管',
  operatedAt: '2026-07-16 12:10:00',
  status: '等待处理',
  plannedFinishAt: '2026-07-20 18:00:00',
  factoryId: order.dyeFactoryId,
  factoryName: order.dyeFactoryName,
  receiverName: order.receiverName,
  shade: '深色',
  temperature: 205,
  rawMaterialQty: 83,
  rawMaterialRollCount: 2,
  completedQty: 80,
  lossQty: 3,
  remark: '主管回退复核',
})
assert.equal(getDyeWorkOrderOnlineRecord(order.dyeOrderId).status, '等待处理')
assert.throws(
  () => updateDyeWorkOrderFromPfos(order.dyeOrderId, {
    expectedVersion: completed.version,
    operatorName: '染厂主管',
    operatedAt: '2026-07-16 12:11:00',
    status: '取消',
    plannedFinishAt: '2026-07-20 18:00:00',
    factoryId: order.dyeFactoryId,
    factoryName: order.dyeFactoryName,
    receiverName: order.receiverName,
    shade: '深色',
    temperature: 205,
    rawMaterialQty: 83,
    rawMaterialRollCount: 2,
    completedQty: 80,
    lossQty: 3,
    remark: '过期版本',
  }),
  /已被其他操作更新/,
)

const logs = listDyeWorkOrderOnlineLogs(order.dyeOrderId)
assert(logs.some((log) => log.action === 'PFOS人工编辑'))
assert(logs.some((log) => log.action === '开工'))
assert(logs.every((log) => log.workOrderNo === order.dyeOrderNo))

const pdaOrder = listDyeWorkOrders().find((item) => item.dyeOrderId !== order.dyeOrderId && getDyeWorkOrderOnlineRecord(item.dyeOrderId).status === '等待处理')
assert(pdaOrder, '至少需要第二张等待处理的染色加工单验证 PDA 顺序')
assert.throws(
  () => advanceDyeWorkOrderOnlineStatus(pdaOrder.dyeOrderId, {
    action: '开工', operatorName: '操作员', operatedAt: '2026-07-16 08:00:00', source: 'PDA',
  }),
  /请先接单/,
)
advanceDyeWorkOrderOnlineStatus(pdaOrder.dyeOrderId, {
  action: '接单', operatorName: '操作员', operatedAt: '2026-07-16 08:01:00', source: 'PDA',
})
advanceDyeWorkOrderOnlineStatus(pdaOrder.dyeOrderId, {
  action: '开工', operatorName: '操作员', operatedAt: '2026-07-16 08:02:00', source: 'PDA',
})
assert.throws(
  () => advanceDyeWorkOrderOnlineStatus(pdaOrder.dyeOrderId, {
    action: '交出', operatorName: '操作员', operatedAt: '2026-07-16 08:03:00', source: 'PDA',
  }),
  /请先完工/,
)

const rows = listDyeWorkOrderOnlineRows()
assert(rows.length >= 8, '染色加工单线上列表演示数据不足')
assert(rows.every((row) => row.workOrderNo === row.platformWorkOrderNo), '列表只能使用平台加工单号')
assert(rows.some((row) => row.productImageUrl && row.materialImageUrl), '列表需要商品图和面料图')
assert(rows.some((row) => row.status === '部分入库' && row.pendingInboundQty > 0), '列表需要部分入库样本')
assert(rows.some((row) => row.isOverdue && !['取消', '已完成'].includes(row.status)), '列表需要超期未完结样本')

const filtered = filterDyeWorkOrderOnlineRows(rows, { statuses: ['染色中'] })
assert(filtered.length > 0, '列表需要染色中样本')
assert(filtered.every((row) => row.status === '染色中'))
const summary = getDyeWorkOrderOnlineSummary(rows)
assert(summary.plannedQtyByUnit.some((item) => item.unit === 'Yard'))
assert(buildDyeWorkOrderCsv(rows, '备料').startsWith('\uFEFF'))
assert(buildDyeWorkOrderCsv(rows, '超期未完结').includes('平台加工单号'))

const workOrdersSource = fs.readFileSync(path.join(process.cwd(), 'src/pages/process-factory/dyeing/work-orders.ts'), 'utf8')
const pdaReceiveSource = fs.readFileSync(path.join(process.cwd(), 'src/pages/pda-task-receive.ts'), 'utf8')
const pdaExecSource = fs.readFileSync(path.join(process.cwd(), 'src/pages/pda-exec-detail.ts'), 'utf8')
const actionWritebackSource = fs.readFileSync(path.join(process.cwd(), 'src/data/fcs/process-action-writeback-service.ts'), 'utf8')
const dyeDomainSource = fs.readFileSync(path.join(process.cwd(), 'src/data/fcs/dyeing-task-domain.ts'), 'utf8')
assert(pdaReceiveSource.includes('recordDyeWorkOrderPdaAcceptance'), 'PDA 确认接单后必须同步染色加工单接单状态')
assert(pdaExecSource.includes('getDyeWorkOrderOnlineRecord'), 'PDA 必须展示与 PFOS 相同的染色加工单状态')
assert(pdaExecSource.includes("action: '开工'"), '含水溶染色直接开工后必须同步线上状态')
;["action: '开工'", "action: '完工'", "action: '交出'"].forEach((text) => {
  assert(actionWritebackSource.includes(text), `染色动作写回缺少线上状态映射：${text}`)
})
assert(dyeDomainSource.includes('notifyDyeReceiptOnlineStatus'), '染色收货确认必须同步部分入库或已完成')
;[
  '查询项', '状态', '销售类型', '生产工厂', '染色工艺', '面料接收人',
  '是否纱线', '是否补料', 'GTG仓是否有库存', '物料类型', '染色色号',
  '成分', '幅宽', '克重', '导出备料数据', '导出超期未完结',
  '批量打印染整生产流程卡', '商品信息', '采购单信息', '原料/面料',
  '属性信息', '时间/加工厂', '附加信息', '查看', '编辑', '日志', '打印流程卡',
].forEach((text) => assert(workOrdersSource.includes(text), `染色加工单列表缺少：${text}`))
assert(workOrdersSource.includes('renderStandardListTable'), '染色加工单列表必须使用标准列表模板')
;['查看配方', '查看统计'].forEach((text) => assert(!workOrdersSource.includes(text), `单张染色加工单列表不应保留：${text}`))

assert.equal(buildDyeingWorkOrderDetailLink(order.dyeOrderId), `/fcs/craft/dyeing/work-orders?dyeOrderId=${order.dyeOrderId}`)
const editHtml = renderDyeWorkOrderOverlay({ type: 'edit', dyeOrderId: order.dyeOrderId })
;['预计完成时间', '生产工厂', '面料接收人', '深浅', '温度', '计划数量', '原料数量', '原料卷数', '完成数量', '损耗数量', '备注'].forEach((text) => {
  assert(editHtml.includes(text), `编辑弹窗缺少：${text}`)
})
assert(editHtml.includes('readonly'), '计划数量和平台加工单号必须只读')
assert(!editHtml.includes('染缸执行'))
assert(!editHtml.includes('移动端执行任务引用'))

const flowCard = buildDyeWorkOrderFlowCardPrintDocument(order.dyeOrderId)
assert.equal(flowCard.sourceId, order.dyeOrderId)
const flowCardText = JSON.stringify(flowCard)
;[
  '染整生产流程卡', 'Kartu Alur Produksi Pencelupan dan Penyempurnaan',
  order.dyeOrderNo, '下单日期', '是否加急', '生产单号', '色样备注',
  'No. Warna', 'Bahan baku', 'Kuantitas', 'Formula pencelupan',
  'Pencelupan', 'Penghilangan air', 'Pengeringan', 'Finishing', 'Kemasan',
].forEach((text) => assert(flowCardText.includes(text), `染整生产流程卡缺少：${text}`))
assert(!flowCardText.includes('工厂加工单号'))

console.log('dye work order online alignment check passed')
