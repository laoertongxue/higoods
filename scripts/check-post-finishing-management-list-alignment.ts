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
const printTemplate = read('src/pages/print/templates/post-finishing-qc-print-template.ts')
const dispatchWorkbench = read('src/pages/unified-dispatch-workbench.ts')
const menu = read('src/data/app-shell-config.ts')
const outboundOrders = read('src/pages/process-factory/post-finishing/outbound-orders.ts')
const listPage = read('src/components/ui/list-page.ts')
const warehouse = read('src/pages/process-factory/post-finishing/warehouse.ts')
const fullFlow = read('src/data/fcs/post-finishing-full-flow.ts')

function columnWidth(source: string, key: string): number {
  const match = source.match(new RegExp(`key: '${key}',[^\\n]*width: (\\d+)`))
  assert(match, `未找到 ${key} 列宽配置`)
  return Number(match[1])
}

function totalColumnWidth(source: string): number {
  return [...source.matchAll(/key: '[^']+', title: '[^']+', width: (\d+)/g)]
    .reduce((sum, match) => sum + Number(match[1]), 0)
}

for (const [name, source] of Object.entries({ tasks, qcOrders, workOrders, recheckOrders })) {
  assert(source.includes('// @page-pattern: list'), `${name} 必须按管理端标准列表页实现`)
  assert(source.includes('renderStandardListPage'), `${name} 必须复用标准列表页`)
  assert(source.includes('renderStandardListTable'), `${name} 必须复用标准表格`)
  assert(source.includes('renderTablePagination'), `${name} 必须保留分页`)
  assert(!source.includes('listTitle:'), `${name} 不应重复显示列表二级标题栏`)
  assert(source.includes('grid grid-cols-2 gap-x-3 gap-y-2'), `${name} 操作入口必须按双列网格紧凑排布`)
}
assert(listPage.includes('listTitle?: string') && listPage.includes('config.listTitle || config.listActionsHtml'), '标准列表必须在无二级标题和列表动作时收起标题栏')

assert(columnWidth(tasks, 'spu') <= 210, '后道生产任务 SPU 列仍过宽')
assert(columnWidth(tasks, 'task') <= 190, '后道生产任务列仍过宽')
assert(columnWidth(tasks, 'actions') <= 220, '后道生产任务操作列仍过宽')
assert(totalColumnWidth(tasks) <= 1622, '后道生产任务默认总列宽仍过宽')

assert(columnWidth(qcOrders, 'qcOrder') <= 160, '质检单号列仍过宽')
assert(columnWidth(qcOrders, 'documents') <= 190, '质检单单号列仍过宽')
assert(columnWidth(qcOrders, 'sku') <= 220, '质检单 SKU 列仍过宽')
assert(columnWidth(qcOrders, 'actions') <= 220, '质检单操作列仍过宽')
assert(totalColumnWidth(qcOrders) <= 1625, '质检单默认总列宽仍过宽')

assert(columnWidth(workOrders, 'documents') <= 200, '后道加工单单据列仍过宽')
assert(columnWidth(workOrders, 'sku') <= 230, '后道加工单 SKU 列仍过宽')
assert(columnWidth(workOrders, 'actions') <= 260, '后道加工单操作列仍过宽')
assert(totalColumnWidth(workOrders) <= 1450, '后道加工单默认总列宽仍过宽')

assert(columnWidth(recheckOrders, 'recheck') <= 160, '复检单号列仍过宽')
assert(columnWidth(recheckOrders, 'style') <= 190, '复检单款式列仍过宽')
assert(columnWidth(recheckOrders, 'sku') <= 220, '复检单 SKU 列仍过宽')
assert(columnWidth(recheckOrders, 'actions') <= 250, '复检单操作列仍过宽')
assert(totalColumnWidth(recheckOrders) <= 2040, '复检单默认总列宽仍过宽')

for (const text of ['计划数量', '已入待加工仓', '未质检', '已质检', '待交出', '上游来源', '分配状态', 'SKU 重量']) {
  assert(tasks.includes(text), `后道生产任务缺少线上字段：${text}`)
}
for (const text of ['出库状态', '后道来源', '售卖类型', '设置 SKU 重量', '回货记录', '查看回货详情', '质检单', '查看质检单', '打印质检单', '打印质检详情单']) {
  assert(tasks.includes(text), `后道生产任务缺少线上筛选、关联记录或动作：${text}`)
}
assert(tasks.includes("title: '后道生产任务'") && tasks.includes('一张后道生产任务对应一个生产单'), '生产单级总任务必须统一命名为后道生产任务')
assert(tasks.includes('view-return-records') && tasks.includes('post-production-task-return-dialog'), '后道生产任务必须能打开多次回货记录弹窗')
assert(tasks.includes('view-qc-orders') && tasks.includes('post-production-task-qc-dialog'), '后道生产任务必须能打开多张质检单弹窗')
assert(tasks.includes('生产单号-最大序号 + 1') && tasks.includes('不允许人工修改'), '质检单弹窗必须明确严格编号规则与不可编辑性')
assert(tasks.includes('每次回货最终确认时自动生成且只生成一张质检单') && tasks.includes('待加工仓送检只完成库存交接'), '后道生产任务必须明确回货确认建单、待加工仓只送检的分工')
assert(tasks.includes('/fcs/dispatch/workbench?search_field=task&keyword=') && tasks.includes('&source=post-finishing'), '后道生产任务“查看来源任务”必须按任务号进入任务分配工作台')
assert(!tasks.includes('>生成质检单<'), '每次回货会形成质检单，后道生产任务列表不得再提供“生成质检单”操作')
assert(dispatchWorkbench.includes("params.get('keyword')") && dispatchWorkbench.includes("get('source') === 'post-finishing'"), '任务分配工作台必须读取任务号查询并识别后道生产任务来源')
assert(dispatchWorkbench.includes('buildPostFinishingWorkbenchTask') && dispatchWorkbench.includes('resolveWorkbenchTask'), '任务分配工作台必须展示并可查看命中的后道生产任务')

assert(menu.includes("title: '质检单'") && !menu.includes("title: '质检任务'"), '菜单必须将质检任务更名为质检单')
assert(!outboundOrders.includes('质检任务'), '后道出货单用户文案也必须统一为质检单')
for (const text of ['质检单号', '来源工厂', '质检员', 'SKU 明细', '质检数量', '合格数量', '不合格数量', '质检结果']) {
  assert(qcOrders.includes(text), `质检单缺少线上字段：${text}`)
}
for (const text of ['领取质检单', '查看质检单', '打印质检单', '打印质检详情单', '主管释放']) {
  assert(qcOrders.includes(text), `质检单缺少现有流程或线上动作：${text}`)
}
assert(!qcOrders.includes('创建质检单'), '质检单不得增加绕过待加工仓送检的手工创建入口')
assert(qcOrders.includes("['待送检','待质检','质检中','质检完成']") && qcOrders.includes('去待加工仓送检'), '质检单页必须区分待送检与可领取状态，并保留待加工仓送检入口')
assert(warehouse.includes('确认送检出库') && !warehouse.includes('送检并生成质检单'), '待加工仓只能执行送检出库，不得在送检时再次建单')
assert(fullFlow.includes("status: '待送检'") && fullFlow.includes("action: '自动生成质检单'") && fullFlow.includes("task.status = '待质检'"), '领域流程必须在回货确认时建待送检质检单，并在送检时激活为待质检')

for (const text of ['单据', '工厂', 'SKU 明细', '后道项目', '总数量', '后道不合格', '后道状态', '时间']) {
  assert(workOrders.includes(text), `后道加工单缺少线上字段：${text}`)
}
for (const text of ['查看加工单', '开始后道', '打印加工单']) {
  assert(workOrders.includes(text), `后道加工单缺少保留动作：${text}`)
}
assert(workOrders.includes("title: '后道加工单'") && workOrders.includes('后道加工单'), '质检后实际执行对象必须统一命名为后道加工单')

for (const text of ['复检单号', '来源', '关联质检单', '关联后道加工单', '生产单号', '加工工厂', '款式名称', 'SKU 明细', '复检数量', '合格数量', '不合格数量', '复检状态', '复检时间']) {
  assert(recheckOrders.includes(text), `复检单缺少线上字段：${text}`)
}
assert(recheckOrders.includes('查看复检详情') && recheckOrders.includes('full-flow-supervisor-release-recheck'), '复检单必须保留详情和主管释放兜底')

for (const text of ['// @page-pattern: list', 'renderStandardListPage', 'renderStandardListTable', 'renderTablePagination', '后道出货单列表', '出货单号', '工厂', '生产单号', '任务单号', '出库数量', '入库数量', '状态', '创建时间', '操作人']) {
  assert(outboundOrders.includes(text), `后道出货单列表缺少线上基线或标准列表能力：${text}`)
}
for (const action of ['详情', '打印整单', '打印条码', '打印吊牌', '打印质检单', '打印质检单详情']) {
  assert(outboundOrders.includes(action), `后道出货单缺少动作：${action}`)
}
for (const field of ['单头信息', '出货明细', '出库仓', '接收仓', '来源动作', '来源对象', '交接单号', '库区', '库位', '计划数量', '入库数量', '备注']) {
  assert(outboundOrders.includes(field), `后道出货单详情缺少线上字段：${field}`)
}

for (const text of ["'QC_ORDER'", "'QC_DETAIL'", 'renderOnlinePostFinishingQcMaster', 'renderOnlinePostFinishingQcDetail', '后道加工单流转卡']) {
  assert(printPage.includes(text), `打印入口缺少：${text}`)
}
for (const source of [tasks, qcOrders]) {
  assert(source.includes('type=QC_ORDER') && source.includes('type=QC_DETAIL'), '后道生产任务与质检单列表必须共用两类 QC 打印入口')
}
for (const text of [
  '质检单 （Pemeriksaan Kualitas）', '款式评级（Gaya penilaian）', '买手（Pembeli）', '生产单类型（Jenis pesanan）',
  '售卖类型（Jenis penjualan）', '面辅料（pakaian &amp; aksesori）', '单耗(Pemakaian per unit)', '尺码表（Graf ukuran）',
  '质检详情单 （Pemeriksaan Kualitas）', '打印时间（Print Time）', 'SKU列表（Daftar SKU）',
  '待加工数量(Tes kualitas diperlukan)', '待质检数量(Tes kualitas diperlukan)', '质检数量(Kualitas sudah diperiksa)',
]) {
  assert(printTemplate.includes(text), `QC 打印版式缺少线上字段：${text}`)
}
assert(printTemplate.includes('renderCode128Barcode') && printTemplate.includes('图片加载失败'), 'QC 打印必须使用真实条码并提供图片失败态')

console.log(JSON.stringify({
  suite: 'QC 后道四张管理列表线上基线对齐检查',
  pages: ['后道生产任务', '质检单', '后道加工单', '复检单'],
  density: '移除重复列表标题；关键列压缩；操作列双列网格且最多 3 行',
  flow: '回货最终确认自动生成待送检质检单；待加工仓送检只激活同一单；后道生产任务聚合多次回货与多张质检单；每次回货 -> 质检单 -> 后道加工单 -> 复检单 -> 出货单 1:1',
  result: '通过',
}, null, 2))
