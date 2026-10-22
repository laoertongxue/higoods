import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import {
  loadPostFinishingDemoData,
  listPostFinishingFullFlowOutboundOrders,
  listPostFinishingFullFlowPostTasks,
  listPostFinishingFullFlowQcTasks,
  listPostFinishingFullFlowRecheckOrders,
  listPostFinishingWaitHandoverWarehouseRecords,
  listPostFinishingWaitProcessWarehouseRecords,
} from '../src/data/fcs/post-finishing-full-flow.ts'

// 继承2026-10-22已确认的“QC→可选逐项加工→直接出货”；
// 原复检要求由正式需求替代，历史只读/显式迁移另有原生契约。
loadPostFinishingDemoData()
const postTasks = listPostFinishingFullFlowPostTasks()
const qcTasks = listPostFinishingFullFlowQcTasks()
const recheckOrders = listPostFinishingFullFlowRecheckOrders()
const outboundOrders = listPostFinishingFullFlowOutboundOrders()
const allowedProjects = new Set(['开扣眼', '装扣子', '熨烫', '包装'])
assert(postTasks.length > 0, '必须有后道加工演示记录')
assert(postTasks.every(task => task.lines.length > 0 && task.lines.every(line => Boolean(line.sku.imageUrl))), '每张加工单有真实对应图片及SKU明细')
assert(postTasks.every(task => task.processItems.length > 0 && task.processItems.every(project => allowedProjects.has(project))), '加工项目保持已确认的逐项加工口径')
assert(qcTasks.length > 0, '必须存在当前质检记录')
assert.equal(recheckOrders.length, 0, '当前演示流程不能再生成复检；旧用户历史不由本检查删除')
assert(listPostFinishingWaitProcessWarehouseRecords().length > 0, '保留后道待加工仓')
assert(listPostFinishingWaitHandoverWarehouseRecords().length > 0, '实际出货仍有待交出仓事实')
for (const sourceType of ['质检直达', '后道加工后'] as const) {
  assert(outboundOrders.some(order => order.sourceType === sourceType), `${sourceType}必须有直接后道出货单`)
}
for (const order of outboundOrders) {
  assert(!order.recheckOrderId, '新流程出货不依赖复检单')
  if (order.sourceType === '质检直达') assert(!postTasks.some(task => task.deliveryId === order.deliveryId), '无加工的QC不得并行生成加工单')
  if (order.status === '待出货') assert(!order.dispatchedAt && !order.receivedAt, '准备单不能冒充实际发出或仓库接收')
}
const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const detail = read('src/pages/process-factory/post-finishing/work-order-detail.ts')
const list = read('src/pages/process-factory/post-finishing/work-orders.ts')
const qc = read('src/pages/process-factory/post-finishing/qc-orders.ts') + read('src/pages/process-factory/post-finishing/qc-workbench.ts')
const outbound = read('src/pages/process-factory/post-finishing/outbound-orders.ts')
const pda = read('src/pages/pda-post-finishing-flow.ts')
const print = read('src/pages/print/templates/post-finishing-route-card-template.ts')
assert(!existsSync(new URL('../src/pages/process-factory/post-finishing/recheck-orders.ts', import.meta.url)), '退役复检执行页面须实际删除')
for (const text of ['SKU 明细', '后道加工单', '准备出货']) assert((detail + list).includes(text), `后道原Web缺少${text}`)
for (const text of ['full-flow-claim-qc', 'full-flow-submit-qc-round', '处理本轮稽查']) assert(qc.includes(text), `原QC入口缺少${text}`)
for (const text of ['data-post-process', 'data-post-outbound-form', '实际加工顺序', '实际发出仍需另行确认']) assert(pda.includes(text), `PDA缺少${text}`)
assert(outbound.includes('data-post-outbound-dispatch'), '后道出货页须有实际发出动作')
for (const retired of ['领取复检单', '完成后道并生成处理后交出复核单', 'data-recheck-result-field', 'full-flow-supervisor-release-recheck']) assert(!(detail + list + pda + qc + outbound).includes(retired), `当前页面仍残留${retired}`)
assert(!pda.includes('>开始质检<') && !pda.includes('>完成质检<'), 'PDA不能恢复质检执行入口')
assert(pda.includes('task.processItems.map(escapeHtml)'), 'PDA只读当前单加工顺序')
assert(print.includes('后道加工单流转卡'), '保留原加工单流转卡')
console.log(JSON.stringify({加工单:postTasks.length,质检单:qcTasks.length,当前复检单:recheckOrders.length,直接出货单:outboundOrders.length,Web_PDA_直接出货_打印:'通过'}, null, 2))
