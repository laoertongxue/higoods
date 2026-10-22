import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

function read(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8')
}

const tasks = read('src/pages/process-factory/post-finishing/tasks.ts')
const qcOrders = read('src/pages/process-factory/post-finishing/qc-orders.ts')
const workOrders = read('src/pages/process-factory/post-finishing/work-orders.ts')
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

for (const [name, source] of Object.entries({ tasks, qcOrders, workOrders })) {
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
assert(totalColumnWidth(qcOrders) <= 2025, '新增真实实检/未检/正常放行列后仍需控制总宽并在表格内部滚动')

assert(columnWidth(workOrders, 'documents') <= 200, '后道加工单单据列仍过宽')
assert(columnWidth(workOrders, 'sku') <= 230, '后道加工单 SKU 列仍过宽')
assert(columnWidth(workOrders, 'actions') <= 260, '后道加工单操作列仍过宽')
assert(totalColumnWidth(workOrders) <= 2000, '分项完成、待实际发出和仓库实收列仍须控制总宽，在表格内部滚动')

for (const text of ['计划数量', '已入待加工仓', '待完成质检', '实际检查', '待交出', '上游来源', '分配状态', 'SKU 重量']) {
  assert(tasks.includes(text), `后道生产任务缺少线上字段：${text}`)
}
for (const text of ['出库状态', '后道来源', '售卖类型', '设置 SKU 重量', '回货记录', '查看回货详情', '质检单', '查看质检单']) {
  assert(tasks.includes(text), `后道生产任务缺少线上筛选、关联记录或动作：${text}`)
}
assert(tasks.includes("title: '后道生产任务'") && tasks.includes('一张后道生产任务对应一个生产单'), '生产单级总任务必须统一命名为后道生产任务')
assert(tasks.includes('view-return-records') && tasks.includes('post-production-task-return-dialog'), '后道生产任务必须能打开多次回货记录弹窗')
assert(tasks.includes('view-qc-orders') && tasks.includes('post-production-task-qc-dialog'), '后道生产任务必须能打开多张质检单弹窗')
assert(tasks.includes('回货单号-ZJ') && tasks.includes('不允许人工修改'), '质检单弹窗必须明确严格编号规则与不可编辑性')
assert(tasks.includes('每次回货最终确认时自动生成且只生成一张质检单') && tasks.includes('待加工仓送检只完成库存交接'), '后道生产任务必须明确回货确认建单、待加工仓只送检的分工')
assert(tasks.includes('/fcs/dispatch/workbench?search_field=task&keyword=') && tasks.includes('&source=post-finishing'), '后道生产任务“查看来源任务”必须按任务号进入任务分配工作台')
assert(!tasks.includes('>生成质检单<'), '每次回货会形成质检单，后道生产任务列表不得再提供“生成质检单”操作')
assert(dispatchWorkbench.includes("params.get('keyword')") && dispatchWorkbench.includes("get('source') === 'post-finishing'"), '任务分配工作台必须读取任务号查询并识别后道生产任务来源')
assert(dispatchWorkbench.includes('buildPostFinishingWorkbenchTask') && dispatchWorkbench.includes('resolveWorkbenchTask'), '任务分配工作台必须展示并可查看命中的后道生产任务')

assert(menu.includes("title: '质检清单'") && menu.includes('/fcs/craft/post-finishing/qc-orders'), '菜单必须使用已确认的质检清单入口')
assert(!outboundOrders.includes('质检任务'), '后道出货单用户文案也必须统一为质检单')
for (const text of ['质检单号', '来源工厂', '质检员', 'SKU 明细', '实际检查', '实检合格', '不合格数量', '质检结果']) {
  assert(qcOrders.includes(text), `质检单缺少线上字段：${text}`)
}
for (const text of ['执行质检', '查看质检单', '打印质检单', '打印质检详情单']) {
  assert(qcOrders.includes(text), `质检单缺少现有流程或线上动作：${text}`)
}
assert(!qcOrders.includes('主管释放') && !qcOrders.includes('full-flow-supervisor-release-qc'), '质检不允许主管退领或接替')
assert(!qcOrders.includes('创建质检单'), '质检单不得增加绕过待加工仓送检的手工创建入口')
assert(qcOrders.includes("['待送检','待质检','质检中','质检完成']") && qcOrders.includes('去待加工仓送检'), '质检单页必须区分待送检与可领取状态，并保留待加工仓送检入口')
assert(warehouse.includes('确认送检出库') && !warehouse.includes('送检并生成质检单'), '待加工仓只能执行送检出库，不得在送检时再次建单')
assert(fullFlow.includes("status: '待送检'") && fullFlow.includes("action: '自动生成质检单'") && fullFlow.includes("task.status = '待质检'"), '领域流程必须在回货确认时建待送检质检单，并在送检时激活为待质检')

for (const text of ['单据', '工厂', 'SKU 明细', '后道项目', '总数量', '尚未完成后道', '后道状态', '时间']) {
  assert(workOrders.includes(text), `后道加工单缺少线上字段：${text}`)
}
for (const obsoleteQualityField of ['后道不合格', '合格数量', '不合格数量', '返厂数量']) {
  assert(!workOrders.includes(obsoleteQualityField), `后道加工单不得产生第二质量事实：${obsoleteQualityField}`)
}
for (const text of ['查看加工单', '登记加工', '准备出货', '打印加工单']) {
  assert(workOrders.includes(text), `后道加工单缺少保留动作：${text}`)
}
assert(workOrders.includes("title: '后道加工单'") && workOrders.includes('后道加工单'), '质检后实际执行对象必须统一命名为后道加工单')

assert(!existsSync(new URL('../src/pages/process-factory/post-finishing/recheck-orders.ts', import.meta.url)), '退役复检执行页面必须删除；已完成历史由原只读审计保留')

for (const text of ['// @page-pattern: list', 'renderStandardListPage', 'renderStandardListTable', 'renderTablePagination', '后道出货单列表', '出货单号', '工厂', '生产单号', '任务单号', '本单出货数量', '仓库实收数量', '状态', '创建时间', '操作人']) {
  assert(outboundOrders.includes(text), `后道出货单列表缺少线上基线或标准列表能力：${text}`)
}
for (const action of ['详情', '打印整单', '打印条码', '打印吊牌']) {
  assert(outboundOrders.includes(action), `后道出货单缺少动作：${action}`)
}
assert(!outboundOrders.includes('打印质检单') && !outboundOrders.includes('type=QC_ORDER') && !outboundOrders.includes('type=QC_DETAIL'), '后道出货单不得继续提供质检单打印入口')
for (const field of ['单头信息', '出货明细', '交出位置', '接收仓', '来源动作', '来源对象', '来源单号', '库区', '库位', '应交数量', '成衣仓实收', '备注']) {
  assert(outboundOrders.includes(field), `后道出货单详情缺少线上字段：${field}`)
}

for (const text of ["'QC_ORDER'", "'QC_DETAIL'", 'renderPostFinishingQcTaskMaster', 'renderPostFinishingQcTaskDetail', '后道加工单流转卡']) {
  assert(printPage.includes(text), `打印入口缺少：${text}`)
}
assert(qcOrders.includes('type=QC_ORDER') && qcOrders.includes('type=QC_DETAIL'), '质检单列表必须保留质检主单和详情单打印入口')
assert(!tasks.includes('type=QC_ORDER') && !tasks.includes('type=QC_DETAIL'), '后道生产任务只负责关联查看，不得越权提供质检打印动作')
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
  suite: 'QC 后道当前管理列表与退役入口检查',
  pages: ['后道生产任务', '质检单', '后道加工单', '后道出货单'],
  density: '移除重复列表标题；关键列压缩；操作列双列网格且最多 3 行',
  flow: '回货最终确认自动生成待送检质检单；待加工仓送检只激活同一单；QC 空项目直达成衣仓，有项目进入后道加工；加工完成量可分次生成出货单，准备和实际发出分别记录',
  result: '通过',
}, null, 2))
