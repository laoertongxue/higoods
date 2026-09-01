import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  listPostFinishingQcOrders,
  listPostFinishingRecheckOrders,
  listPostFinishingWaitHandoverWarehouseRecords,
  listPostFinishingWaitProcessWarehouseRecords,
  listPostFinishingWorkOrders,
} from '../src/data/fcs/post-finishing-domain.ts'

const workOrders = listPostFinishingWorkOrders()
assert.ok(workOrders.length >= 5, '后道任务记录不足')
assert.ok(workOrders.every((order) => order.currentFactoryName && order.managedPostFactoryName), '处理记录必须绑定后道工厂')
assert.ok(workOrders.every((order) => order.skuLines.every((line) => Boolean(line.imageUrl))), '每个后道阶段 SKU 必须带真实款式图')
assert.ok(workOrders.every((order) => order.postProjectLines.every((line) => ['开扣眼', '装扣子', '烫包'].includes(line.projectName))), '实际工序只能是开扣眼、装扣子、烫包')

const qcOrders = listPostFinishingQcOrders()
const recheckOrders = listPostFinishingRecheckOrders()
assert.ok(qcOrders.length > 0, '必须存在质检记录')
assert.ok(recheckOrders.length > 0, '必须存在复检记录')
assert.ok(listPostFinishingWaitProcessWarehouseRecords().length > 0, '必须存在待加工仓记录')
assert.ok(listPostFinishingWaitHandoverWarehouseRecords().length > 0, '必须存在待交出仓记录')

const detailSource = readFileSync(new URL('../src/pages/process-factory/post-finishing/work-order-detail.ts', import.meta.url), 'utf8')
const workOrdersSource = readFileSync(new URL('../src/pages/process-factory/post-finishing/work-orders.ts', import.meta.url), 'utf8')
const qcOrdersSource = readFileSync(new URL('../src/pages/process-factory/post-finishing/qc-orders.ts', import.meta.url), 'utf8')
const qcWorkbenchSource = readFileSync(new URL('../src/pages/process-factory/post-finishing/qc-workbench.ts', import.meta.url), 'utf8')
const pdaSource = readFileSync(new URL('../src/pages/pda-exec-detail.ts', import.meta.url), 'utf8')
const printSource = readFileSync(new URL('../src/pages/print/templates/post-finishing-route-card-template.ts', import.meta.url), 'utf8')

;['SKU 明细', '实际工序', '开始${escapeHtml(line.projectName)}', '完成${escapeHtml(line.projectName)}'].forEach((text) => {
  assert.ok((detailSource + workOrdersSource).includes(text), `Web 缺少 ${text}`)
})
;['确认接收', '开始实际工序', '完成实际工序', '开始复检', '完成复检', '发起交出'].forEach((text) => {
  assert.ok(pdaSource.includes(text), `PDA 缺少动作 ${text}`)
})
;['输入质检任务号', '领取并开始质检', '一任务一质检员'].forEach((text) => {
  assert.ok((qcOrdersSource + qcWorkbenchSource).includes(text), `Web 统一质检页缺少 ${text}`)
})
assert.ok(pdaSource.includes('质检已经收口为 Web 专属操作'), 'PDA 必须明确引导到 Web 质检任务')
assert.ok(!pdaSource.includes('>开始质检<') && !pdaSource.includes('>完成质检<'), 'PDA 不得保留质检执行动作')
;['开扣眼', '装扣子', '烫包'].forEach((text) => assert.ok(pdaSource.includes(text), `PDA 缺少实际工序 ${text}`))
;['阶段任务', '实际工序单', '车缝+后道', '>开始后道<', '>完成后道<'].forEach((text) => {
  assert.ok(!(detailSource + workOrdersSource + pdaSource + printSource).includes(text), `Web/PDA/打印不得展示 ${text}`)
})
assert.ok(printSource.includes('后道任务流转卡'), '打印标题必须使用后道任务口径')

console.log(JSON.stringify({
  后道任务记录: workOrders.length,
  质检记录: qcOrders.length,
  复检记录: recheckOrders.length,
  Web质检_PDA后道复检_打印实际工序动作: '通过',
}, null, 2))
