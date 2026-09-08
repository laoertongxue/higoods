import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  loadPostFinishingDemoData,
  listPostFinishingFullFlowOutboundOrders,
  listPostFinishingFullFlowPostTasks,
  listPostFinishingFullFlowQcTasks,
  listPostFinishingFullFlowRecheckOrders,
  listPostFinishingWaitHandoverWarehouseRecords,
  listPostFinishingWaitProcessWarehouseRecords,
} from '../src/data/fcs/post-finishing-full-flow.ts'

loadPostFinishingDemoData()

const postTasks = listPostFinishingFullFlowPostTasks()
const qcTasks = listPostFinishingFullFlowQcTasks()
const recheckOrders = listPostFinishingFullFlowRecheckOrders()
const outboundOrders = listPostFinishingFullFlowOutboundOrders()
const allowedProjects = new Set(['开扣眼', '装扣子', '烫包'])

assert.ok(postTasks.length > 0, '当前全流程必须包含后道加工单记录')
assert.ok(postTasks.every((task) => task.lines.length > 0), '每张后道加工单必须包含 SKU 数量明细')
assert.ok(postTasks.every((task) => task.lines.every((line) => Boolean(line.sku.imageUrl))), '每个后道加工 SKU 必须带款式图片')
assert.ok(postTasks.every((task) => task.processItems.length > 0), '只有 QC 确认了后道项目的批次才生成后道加工单')
assert.ok(postTasks.every((task) => task.processItems.every((project) => allowedProjects.has(project))), '本批后道项目只能是开扣眼、装扣子、烫包')
assert.ok(qcTasks.length > 0, '必须存在当前质检记录')
assert.ok(recheckOrders.length > 0, '有后道加工的批次必须存在处理后交出复核记录')
assert.ok(listPostFinishingWaitProcessWarehouseRecords().length > 0, '必须存在当前后道待加工仓记录')
assert.ok(listPostFinishingWaitHandoverWarehouseRecords().length > 0, '处理后复核完成的批次必须存在当前待交出仓记录')

const directOutbounds = outboundOrders.filter((order) => order.sourceType === '质检直达')
assert.ok(directOutbounds.length > 0, 'QC 最终项目为空时必须生成面向成衣仓的待接收交接事实')
for (const outbound of directOutbounds) {
  assert.ok(!postTasks.some((task) => task.deliveryId === outbound.deliveryId), `${outbound.outboundOrderNo} 不得并行生成后道加工单`)
  assert.ok(!recheckOrders.some((order) => order.deliveryId === outbound.deliveryId), `${outbound.outboundOrderNo} 不得进入处理后交出复核`)
}

const detailSource = readFileSync(new URL('../src/pages/process-factory/post-finishing/work-order-detail.ts', import.meta.url), 'utf8')
const workOrdersSource = readFileSync(new URL('../src/pages/process-factory/post-finishing/work-orders.ts', import.meta.url), 'utf8')
const qcOrdersSource = readFileSync(new URL('../src/pages/process-factory/post-finishing/qc-orders.ts', import.meta.url), 'utf8')
const qcWorkbenchSource = readFileSync(new URL('../src/pages/process-factory/post-finishing/qc-workbench.ts', import.meta.url), 'utf8')
const recheckOrdersSource = readFileSync(new URL('../src/pages/process-factory/post-finishing/recheck-orders.ts', import.meta.url), 'utf8')
const pdaSource = readFileSync(new URL('../src/pages/pda-post-finishing-flow.ts', import.meta.url), 'utf8')
const printSource = readFileSync(new URL('../src/pages/print/templates/post-finishing-route-card-template.ts', import.meta.url), 'utf8')

for (const text of ['SKU 明细', '本批后道项目', '已处理数量', '未处理数量']) {
  assert.ok((detailSource + workOrdersSource).includes(text), `Web 后道加工单缺少 ${text}`)
}
assert.ok(!detailSource.includes('实际工序'), '当前后道加工单详情不得恢复旧“实际工序”口径')
for (const text of ['完整质检单号', '领取质检单', '一单一质检员']) {
  assert.ok((qcOrdersSource + qcWorkbenchSource).includes(text), `Web 统一质检页缺少 ${text}`)
}
for (const text of ['开始后道', '完整后道加工单号', '核对无误，开始后道', '完成后道并生成处理后交出复核单']) {
  assert.ok((detailSource + workOrdersSource).includes(text), `Web 后道加工单缺少 ${text}`)
}
for (const text of ['领取复检单', '完整复检单号', '实际交出数量', 'SKU 条码是否正确', '确认数量条码并生成后道出货单']) {
  assert.ok(recheckOrdersSource.includes(text), `Web 处理后交出复核缺少 ${text}`)
}
for (const field of ['data-recheck-result-field="passedQty"', 'data-recheck-result-field="defectQty"', 'data-recheck-result-field="returnQty"']) {
  assert.ok(!recheckOrdersSource.includes(field), `处理后交出复核不得保留第二质量字段 ${field}`)
}
for (const text of ['核对无误，开始后道', '本批数量归类', '完成并生成处理后交出复核单', '条码错误，已阻断出货']) {
  assert.ok(pdaSource.includes(text), `后道 PDA 缺少当前动作 ${text}`)
}
assert.ok(!pdaSource.includes('>开始质检<') && !pdaSource.includes('>完成质检<'), 'PDA 不得保留质检执行动作')
assert.ok(pdaSource.includes('本批后道项目（质检已确认）：') && pdaSource.includes('task.processItems.map(escapeHtml)'), 'PDA 必须只读展示当前加工单的本批后道项目')
for (const text of ['阶段任务', '实际工序单', '车缝+后道', 'PDA 执行（优先）', 'Web 应急', 'Web应急']) {
  assert.ok(!(detailSource + workOrdersSource + pdaSource + printSource).includes(text), `Web/PDA/打印不得展示 ${text}`)
}
assert.ok(printSource.includes('后道加工单流转卡'), '打印标题必须使用后道加工单口径')

console.log(JSON.stringify({
  后道加工单记录: postTasks.length,
  质检记录: qcTasks.length,
  处理后交出复核记录: recheckOrders.length,
  QC直达成衣仓交接记录: directOutbounds.length,
  Web质检_Web后道_Web处理后复核_PDA兼容_打印后道项目动作: '通过',
}, null, 2))
