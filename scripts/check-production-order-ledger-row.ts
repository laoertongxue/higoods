import assert from 'node:assert/strict'
import { productionOrders } from '../src/data/fcs/production-orders.ts'
import { renderProductionOrderDetailPage } from '../src/pages/production/detail-domain.ts'
import { renderProductionOrdersPage } from '../src/pages/production/orders-domain.ts'

const firstOrder = productionOrders[0]
assert(firstOrder, '必须存在第一条生产单')

const listHtml = renderProductionOrdersPage()
assert(listHtml.includes(firstOrder.productionOrderId), '生产单管理必须正常渲染生产单')
assert(!listHtml.includes('<th class="min-w-[230px] px-3 py-3 text-left font-medium">配料 / 领料</th>'), '生产单管理不得展示配料 / 领料列')
;['生产台账摘要', '展开台账', '收起台账', '正在加载生产台账...', 'data-prod-action="toggle-order-ledger"'].forEach((text) => {
  assert(!listHtml.includes(text), `生产单管理不得保留台账摘要入口：${text}`)
})

const detailHtml = renderProductionOrderDetailPage(firstOrder.productionOrderId)
assert(!detailHtml.includes('生产台账明细'), '生产单详情不得搬入完整台账明细')
;['1）配料 / 领料明细', '2）任务单 / 工厂明细', '3）关键时间明细', '4）数量 / 质量明细'].forEach((title) => {
  assert(!detailHtml.includes(title), `生产单详情不得搬入：${title}`)
})
;['物料 SKU', '计划完成', '来源单据', '差异'].forEach((header) => {
  assert(!detailHtml.includes(header), `生产单详情不得搬入台账表头：${header}`)
})

console.log('production order ledger row check passed')
