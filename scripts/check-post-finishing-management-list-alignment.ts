import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

function read(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8')
}

const tasks = read('src/pages/process-factory/post-finishing/tasks.ts')
const qcOrders = read('src/pages/process-factory/post-finishing/qc-orders.ts')
const workOrders = read('src/pages/process-factory/post-finishing/work-orders.ts')
const recheckOrders = read('src/pages/process-factory/post-finishing/recheck-orders.ts')
const printPage = read('src/pages/process-factory/post-finishing/full-flow-print.ts')
const menu = read('src/data/app-shell-config.ts')
const outboundOrders = read('src/pages/process-factory/post-finishing/outbound-orders.ts')

for (const [name, source] of Object.entries({ tasks, qcOrders, workOrders, recheckOrders })) {
  assert(source.includes('// @page-pattern: list'), `${name} 必须按管理端标准列表页实现`)
  assert(source.includes('renderStandardListPage'), `${name} 必须复用标准列表页`)
  assert(source.includes('renderStandardListTable'), `${name} 必须复用标准表格`)
  assert(source.includes('renderTablePagination'), `${name} 必须保留分页`)
}

for (const text of ['计划数量', '已入待加工仓', '未质检', '已质检', '待交出', '上游来源', '分配状态', 'SKU 重量']) {
  assert(tasks.includes(text), `后道任务缺少线上字段：${text}`)
}
for (const text of ['出库状态', '后道来源', '售卖类型', '设置 SKU 重量', '查看质检单', '打印质检单', '打印质检详情单']) {
  assert(tasks.includes(text), `后道任务缺少线上筛选或动作：${text}`)
}
assert(tasks.includes('/wait-process-warehouse?tab=returns') && !tasks.includes('sendPostFinishingFactoryReturnToQc'), '后道任务“生成质检单”必须回到待加工仓送检，不得绕过现有流程')

assert(menu.includes("title: '质检单'") && !menu.includes("title: '质检任务'"), '菜单必须将质检任务更名为质检单')
assert(!outboundOrders.includes('质检任务'), '后道出货单用户文案也必须统一为质检单')
for (const text of ['质检单号', '来源工厂', '质检台', 'SKU 明细', '质检数量', '合格数量', '不合格数量', '质检结果', '质检人']) {
  assert(qcOrders.includes(text), `质检单缺少线上字段：${text}`)
}
for (const text of ['输入质检单号领取', '查看质检单', '打印质检单', '打印质检详情单', '主管释放']) {
  assert(qcOrders.includes(text), `质检单缺少现有流程或线上动作：${text}`)
}
assert(!qcOrders.includes('创建质检单'), '质检单不得增加绕过待加工仓送检的手工创建入口')

for (const text of ['单据', '工厂', 'SKU 明细', '后道项目', '总数量', '后道不合格', '后道状态', '时间']) {
  assert(workOrders.includes(text), `后道单缺少线上字段：${text}`)
}
for (const text of ['查看详情', 'PDA 执行（优先）', 'Web 应急处理', '打印任务流转卡']) {
  assert(workOrders.includes(text), `后道单缺少保留动作：${text}`)
}

for (const text of ['复检单号', '来源', '关联质检单', '关联后道单', '生产单号', '加工工厂', '款式名称', 'SKU 明细', '复检数量', '合格数量', '不合格数量', '复检状态', '复检时间']) {
  assert(recheckOrders.includes(text), `复检单缺少线上字段：${text}`)
}
assert(recheckOrders.includes('查看复检详情') && recheckOrders.includes('full-flow-supervisor-release-recheck'), '复检单必须保留详情和主管释放兜底')

for (const text of ["'QC_ORDER'", "'QC_DETAIL'", '质检详情单', '后道任务流转卡']) {
  assert(printPage.includes(text), `打印入口缺少：${text}`)
}

console.log(JSON.stringify({
  suite: 'QC 后道四张管理列表线上基线对齐检查',
  pages: ['后道任务', '质检单', '后道单', '复检单'],
  flow: '待加工仓送检生成质检单 -> 质检 -> 可选后道 -> 复检',
  result: '通过',
}, null, 2))
