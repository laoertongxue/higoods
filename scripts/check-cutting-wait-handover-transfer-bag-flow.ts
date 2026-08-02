/**
 * 裁床待交出仓与中转袋流转 —— 完整治理检查
 *
 * 使用方式：node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-cutting-wait-handover-transfer-bag-flow.ts
 *
 * 原则：每完成一个任务就要把对应断言从红变绿，不绿的就是还有遗漏。
 * 软断言模式：收集全部失败后统一报出，不中断于首个错误。
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')

let failures: string[] = []
let passed = 0

function read(relativePath: string): string {
  const full = resolve(ROOT, relativePath)
  if (!existsSync(full)) {
    failures.push(`FILE_MISSING: ${relativePath}`)
    return ''
  }
  return readFileSync(full, 'utf8')
}

function assertContains(source: string, needle: string, message: string): void {
  if (source.includes(needle)) { passed++ } else { failures.push(`MISSING: ${message}`) }
}

function assertNotContains(source: string, needle: string, message: string): void {
  if (!source.includes(needle)) { passed++ } else { failures.push(`STALE: ${message}`) }
}

function assertMatch(source: string, pattern: RegExp, message: string): void {
  if (pattern.test(source)) { passed++ } else { failures.push(`MISSING: ${message}`) }
}

// ─── 辅助读取函数 ───

const EVENT_LEDGER = 'src/data/fcs/cutting/cutting-runtime-event-ledger.ts'
const WAIT_HANDOVER_RUNTIME = 'src/pages/process-factory/cutting/wait-handover-runtime.ts'
const TRANSFER_BAGS_MODEL = 'src/pages/process-factory/cutting/transfer-bags-model.ts'
const HANDOVER_ORDERS_DATA = 'src/data/fcs/cutting/handover-orders.ts'
const SPECIAL_CRAFT_FLOW = 'src/data/fcs/cutting/special-craft-fei-ticket-flow.ts'
const CUTTING_MAINLINE_LEDGER = 'src/data/fcs/cutting/cutting-mainline-event-ledger.ts'
const SEWING_DISPATCH = 'src/data/fcs/cutting/sewing-dispatch.ts'
const TRANSFER_BAG_RUNTIME = 'src/data/fcs/cutting/transfer-bag-runtime.ts'
const TRANSFER_BAG_LIFECYCLE = 'src/data/fcs/cutting/transfer-bag-lifecycle.ts'
const TRANSFER_BAG_OPERATIONS = 'src/data/fcs/cutting/transfer-bag-operations.ts'

const WAREHOUSE_HUB = 'src/pages/process-factory/cutting/warehouse-hub.ts'
const T_BAGS = 'src/pages/process-factory/cutting/transfer-bags.ts'
// 中转袋真实路由由 transfer-bags.ts 渲染；旧 list.ts 已删除，避免静态脚本审到死代码。
const T_BAGS_LIST = T_BAGS
const T_BAGS_HANDLERS = 'src/pages/process-factory/cutting/transfer-bags/handlers.ts'
const T_BAGS_DIALOGS = 'src/pages/process-factory/cutting/transfer-bags/dialogs.ts'
const T_BAGS_STATE = 'src/pages/process-factory/cutting/transfer-bags/state.ts'
const T_BAGS_DETAIL = 'src/pages/process-factory/cutting/transfer-bags/detail.ts'
const T_BAGS_PROJECTION = 'src/pages/process-factory/cutting/transfer-bags-projection.ts'
const T_BAGS_RETURN_MODEL = 'src/pages/process-factory/cutting/transfer-bag-return-model.ts'
const FEI_TICKETS = 'src/pages/process-factory/cutting/fei-tickets.ts'
const CUTTING_SUMMARY = 'src/pages/process-factory/cutting/cutting-summary.ts'
const PRODUCTION_PROGRESS = 'src/pages/process-factory/cutting/production-progress.ts'
const DAILY_REPORT_MODEL = 'src/pages/process-factory/cutting/cutting-daily-production-report-model.ts'
const META = 'src/pages/process-factory/cutting/meta.ts'
const CLOSE_RECORDS = 'src/data/fcs/cutting/cut-order-close-records.ts'
const HANDOVER_ORDERS_PAGE = 'src/pages/process-factory/cutting/handover-orders.ts'

const PDA_INBOUND = 'src/pages/pda-cutting-inbound.ts'
const PDA_HANDOVER = 'src/pages/pda-cutting-handover.ts'
const PDA_WAIT_HANDOVER = 'src/pages/pda-warehouse-wait-handover.ts'
const PDA_WAIT_HANDOVER_ACTIONS = 'src/pages/pda-cutting-wait-handover-actions.ts'
const PDA_WAREHOUSE = 'src/pages/pda-warehouse.ts'
const PDA_HANDOVER_LIST = 'src/pages/pda-handover.ts'
const PDA_HANDOVER_DETAIL = 'src/pages/pda-handover-detail.ts'
const PDA_STOCKTAKE = 'src/pages/pda-warehouse-stocktake.ts'
const PDA_INBOUND_RECORDS = 'src/pages/pda-warehouse-inbound-records.ts'
const PDA_TRANSFER_BAG_DETAIL = 'src/pages/pda-transfer-bag-detail.ts'
const PROGRESS_BOARD = 'src/pages/progress-board/core.ts'
const LABEL_PRINT = 'src/pages/print/templates/label-print-template.ts'

const FCS_HANDLERS = 'src/main-handlers/fcs-handlers.ts'
const PDA_HANDLERS = 'src/main-handlers/pda-handlers.ts'

const ROUTES_FCS = 'src/router/routes-fcs.ts'
const ROUTES_PDA = 'src/router/routes-pda.ts'

// ─── 检查脚本文件 ───
const CK_WAREHOUSE_SWITCH = 'scripts/check-cutting-warehouse-management-switch.ts'
const CK_CLEAN_MAINLINE = 'scripts/check-cutting-clean-mainline.ts'
const CK_PDA_HANDOVER_PAGES = 'scripts/check-pda-handover-pages.ts'
const CK_TRANSFER_BAG_CLOSED = 'scripts/check-transfer-bag-mobile-closed-loop.ts'
const CK_FACTORY_MOBILE = 'scripts/check-factory-mobile-app-redesign.ts'
const CK_SEWING_DISPATCH = 'scripts/check-cutting-sewing-dispatch.ts'
const CK_SPECIAL_CRAFT_RETURN = 'scripts/check-cutting-special-craft-dispatch-return.ts'
const CK_FCS_HANDOVER = 'scripts/check-fcs-handover-domain.ts'
const CK_WRITEBACK_DIFF = 'scripts/check-handover-writeback-difference-unification.ts'
const CK_FACTORY_LINKAGE = 'scripts/check-factory-handover-warehouse-linkage.ts'
const CK_PROGRESS_LINKAGE = 'scripts/check-progress-statistics-linkage.ts'
const CK_FEI_ASSEMBLY = 'scripts/check-cutting-fei-ticket-assembly.ts'
const CK_SPECIAL_CRAFT_DEEP = 'scripts/check-special-craft-task-and-fei-flow-deepening.ts'
const CK_MOBILE_WRITEBACK = 'scripts/check-mobile-execution-writeback.ts'

// ─── E2E 测试文件 ───
const TEST_RUNTIME_E2E = 'tests/cutting-runtime-event-ledger-pda-web.spec.ts'
const TEST_STAGE8 = 'tests/cutting-stage8-regression.spec.ts'
const TEST_TBAG_STATUSES = 'tests/cutting-transfer-bag-simplified-statuses.spec.ts'
const TEST_TBAG_HEADER = 'tests/cutting-transfer-bag-detail-header.spec.ts'
const TEST_TBAG_TABS = 'tests/cutting-transfer-bag-detail-tabs.spec.ts'
const TEST_TBAG_BAGGING = 'tests/cutting-transfer-bag-bagging-steps.spec.ts'
const TEST_TBAG_NAV = 'tests/cutting-transfer-bag-navigation.spec.ts'
const TEST_TBAG_AUTO = 'tests/cutting-transfer-bag-auto-context.spec.ts'
const TEST_PDA_MIDDLE_BAG = 'tests/pda-handover-copy-middle-bag.spec.ts'
const TEST_WRITEBACK_E2E = 'tests/handover-writeback-difference-unification.spec.ts'
const TEST_FACTORY_MOBILE = 'tests/factory-mobile-app-redesign.spec.ts'
const TEST_SPECIAL_CRAFT_E2E = 'tests/special-craft-web-mobile-action-dialog-and-layout.spec.ts'

// ============================================================================
// §1  事件类型与数据模型
// ============================================================================

const ledger = read(EVENT_LEDGER)

// 1.1 新事件类型必须存在
for (const type of ["'菲票装袋'", "'中转袋入仓'", "'新增交出记录'", "'特殊工艺交出'", "'特殊工艺回仓'", "'中转袋回收'", "'中转袋报废'"]) {
  assertContains(ledger, type, `EVENT_LEDGER 缺少事件类型: ${type}`)
}

// 1.2 旧合并事件类型必须移除
assertNotContains(ledger, "'菲票入仓暂存'", 'EVENT_LEDGER 不得继续保留菲票入仓暂存')

// 1.3 写入函数
const runtime = read(WAIT_HANDOVER_RUNTIME)
const transferBagOperations = read(TRANSFER_BAG_OPERATIONS)
assertContains(runtime, 'appendWaitHandoverBaggingEvent', 'RUNTIME 缺少 appendWaitHandoverBaggingEvent（菲票装袋）')
assertContains(runtime, 'appendWaitHandoverInboundEvent', 'RUNTIME 必须有 appendWaitHandoverInboundEvent（中转袋入仓：仅库位）')
assertContains(runtime, "eventType: '菲票装袋'", 'RUNTIME appendWaitHandoverBaggingEvent 必须写入菲票装袋')
assertContains(runtime, "eventType: '中转袋入仓'", 'RUNTIME appendWaitHandoverInboundEvent 必须写入中转袋入仓')

// 1.3.1 任务 6：特殊工艺带袋回仓统一命令和三分流
assertContains(transferBagOperations, 'export function submitSpecialCraftBagReturn', 'OPERATIONS 必须导出特殊工艺带袋回仓共享命令')
assertContains(transferBagOperations, 'export function submitSpecialCraftTicketOnlyReturn', 'OPERATIONS 必须导出特殊工艺无袋回仓严格命令')
assertContains(transferBagOperations, 'appendCuttingRuntimeEventIdempotentValidated', '特殊工艺带袋回仓必须使用写前验证的原子 append')
assertContains(transferBagOperations, 'buildCurrentTicketBagIndexFromSnapshot', '特殊工艺回仓必须单次构建当前票袋关系索引')
assertContains(transferBagOperations, '空袋请执行中转袋回收。', '共享命令必须用精确文案阻断空袋')
assertContains(runtime, 'return submitSpecialCraftBagReturn({', '带袋有票回仓必须委托共享命令')
assertContains(runtime, 'return submitSpecialCraftTicketOnlyReturn({', '无袋有票回仓必须委托严格共享命令')
assertContains(runtime, 'return recoverTransferBag({', '物理空袋无票必须委托中转袋回收')
assertContains(runtime, 'isCompleteSuccessfulSpecialCraftBagReturnEvent(event)', '库位和生命周期投影只接受严格带袋回仓事实')
assertNotContains(runtime, '`return:${returnRecordId}`', '无袋回仓不得生成虚拟袋码占用库位')

// 1.4 关键字段声明
const handoverData = read(HANDOVER_ORDERS_DATA)
const specialCraft = read(SPECIAL_CRAFT_FLOW)
for (const field of ['hasSpecialCraft', 'specialCraftCategory', 'receiverType', 'receiverName', 'returnMode', 'sourceHandoverRecordNo']) {
  const found = ledger.includes(field) || handoverData.includes(field) || specialCraft.includes(field) || runtime.includes(field)
  if (!found) { failures.push(`MISSING: 关键字段 ${field} 未在任何数据层文件声明`) } else { passed++ }
}

// 1.5 特殊工艺前向流转状态
for (const status of ['已发料', '已接收', '加工中', '已完成', '已回仓', '回仓差异']) {
  assertContains(specialCraft, status, `SPECIAL_CRAFT_FLOW 缺少特殊工艺前向状态: ${status}`)
}

// 1.6 中转袋主状态与使用中阶段
const tModel = read(TRANSFER_BAGS_MODEL)
const lifecycle = read(TRANSFER_BAG_LIFECYCLE)
for (const status of ['空闲', '使用中', '已报废']) {
  assertContains(tModel + lifecycle, status, `中转袋主状态 ${status} 未在 model/lifecycle 中定义`)
}
for (const stage of ['菲票已装袋', '入仓暂存中', '已交出待回收']) {
  assertContains(tModel + lifecycle, stage, `中转袋使用中阶段 ${stage} 未在 model/lifecycle 中定义`)
}

// 1.7 sewing-dispatch.ts 不再引用旧事件类型
const sewingDispatch = read(SEWING_DISPATCH)
assertNotContains(sewingDispatch, '菲票入仓暂存', 'SEWING_DISPATCH 不得引用旧菲票入仓暂存')

// 1.8 transfer-bag-runtime.ts 旧物理袋状态不得重新成为主状态
const tbRuntime = read(TRANSFER_BAG_RUNTIME)
assertNotContains(tbRuntime, '入仓暂存袋', 'TRANSFER_BAG_RUNTIME 不得保留旧名称入仓暂存袋')
assertNotContains(tbRuntime, '裁床待交出仓入仓暂存位', 'TRANSFER_BAG_RUNTIME 不得保留旧位置名称')
assertContains(lifecycle, "IDLE: { label: '空闲' }", 'LIFECYCLE 必须定义空闲主状态')
assertContains(lifecycle, "IN_USE: { label: '使用中' }", 'LIFECYCLE 必须定义使用中主状态')
assertContains(lifecycle, "DISABLED: { label: '已报废' }", 'LIFECYCLE 必须定义已报废主状态')

// 1.9 cutting-mainline-event-ledger.ts 同步
const mainlineLedger = read(CUTTING_MAINLINE_LEDGER)
assertNotContains(mainlineLedger, '菲票入仓暂存', 'CUTTING_MAINLINE_LEDGER 不得引用旧事件类型')
assertContains(mainlineLedger, '特殊工艺回仓', 'CUTTING_MAINLINE_LEDGER 必须保留特殊工艺回仓 eventStage')

// ============================================================================
// §2  Web 端页面入口
// ============================================================================

const hub = read(WAREHOUSE_HUB)

// 2.1 四动作必须可见
const fourActions = ['菲票装袋', '中转袋入仓', '中转袋交出', '特种工艺回收入仓']
for (const label of fourActions) {
  assertContains(hub, label, `WAREHOUSE_HUB 必须包含动作: ${label}`)
}

// 2.2 旧合并文案全量禁用
const OLD_MERGED = '入仓暂存装袋'
const OLD_BAG = '入仓暂存袋'

// — 所有文件不得包含旧文案"入仓暂存装袋" —
// (existing checks above)

// — 所有文件不得包含旧文案"入仓暂存袋" —
for (const [name, path] of [
  ['WAREHOUSE_HUB', WAREHOUSE_HUB],
  ['TRANSFER_BAGS', T_BAGS],
  ['TRANSFER_BAGS_LIST', T_BAGS_LIST],
  ['TRANSFER_BAGS_HANDLERS', T_BAGS_HANDLERS],
  ['TRANSFER_BAGS_DIALOGS', T_BAGS_DIALOGS],
  ['TRANSFER_BAGS_DETAIL', T_BAGS_DETAIL],
  ['TRANSFER_BAGS_PROJECTION', T_BAGS_PROJECTION],
  ['TRANSFER_BAG_RETURN_MODEL', T_BAGS_RETURN_MODEL],
  ['PDA_INBOUND', PDA_INBOUND],
  ['PDA_HANDOVER', PDA_HANDOVER],
  ['PDA_WAIT_HANDOVER', PDA_WAIT_HANDOVER],
  ['PDA_WAREHOUSE', PDA_WAREHOUSE],
  ['PDA_HANDOVER_LIST', PDA_HANDOVER_LIST],
  ['PDA_HANDOVER_DETAIL', PDA_HANDOVER_DETAIL],
  ['PDA_STOCKTAKE', PDA_STOCKTAKE],
  ['PDA_INBOUND_RECORDS', PDA_INBOUND_RECORDS],
  ['PDA_TRANSFER_BAG_DETAIL', PDA_TRANSFER_BAG_DETAIL],
  ['PROGRESS_BOARD', PROGRESS_BOARD],
  ['LABEL_PRINT', LABEL_PRINT],
  ['FEI_TICKETS', FEI_TICKETS],
  ['CUTTING_SUMMARY', CUTTING_SUMMARY],
  ['PRODUCTION_PROGRESS', PRODUCTION_PROGRESS],
  ['HANDOVER_ORDERS_PAGE', HANDOVER_ORDERS_PAGE],
  ['EVENT_LEDGER', EVENT_LEDGER],
  ['WAIT_HANDOVER_RUNTIME', WAIT_HANDOVER_RUNTIME],
  ['TRANSFER_BAGS_MODEL', TRANSFER_BAGS_MODEL],
]) {
  const source = read(path)
  assertNotContains(source, OLD_BAG, `${name} 不得保留旧文案 "${OLD_BAG}"`)
}
for (const [name, path] of [
  ['WAREHOUSE_HUB', WAREHOUSE_HUB],
  ['TRANSFER_BAGS', T_BAGS],
  ['TRANSFER_BAGS_LIST', T_BAGS_LIST],
  ['TRANSFER_BAGS_HANDLERS', T_BAGS_HANDLERS],
  ['TRANSFER_BAGS_DIALOGS', T_BAGS_DIALOGS],
  ['TRANSFER_BAGS_DETAIL', T_BAGS_DETAIL],
  ['TRANSFER_BAGS_PROJECTION', T_BAGS_PROJECTION],
  ['TRANSFER_BAG_RETURN_MODEL', T_BAGS_RETURN_MODEL],
]) {
  const source = read(path)
  assertNotContains(source, OLD_MERGED, `${name} 不得保留旧文案 "${OLD_MERGED}"`)
}

// 2.3 Tab 键已改制
assertContains(hub, "'bagging'", 'WAREHOUSE_HUB 必须有菲票装袋 tab key')
assertContains(hub, "'inbound'", 'WAREHOUSE_HUB 必须有中转袋入仓 tab key')
assertNotContains(hub, "'inbound-bagging'", 'WAREHOUSE_HUB tab key 不得继续使用 inbound-bagging')
assertContains(hub, "type WaitHandoverWebAction = 'bagging'", 'WAREHOUSE_HUB Web action 必须包含独立菲票装袋')
assertContains(hub, 'submitWaitHandoverBagging', 'WAREHOUSE_HUB 必须有独立菲票装袋提交函数')
assertContains(hub, 'appendWaitHandoverBaggingEvent', 'WAREHOUSE_HUB 菲票装袋必须写入菲票装袋事件')
assertMatch(hub, /function submitWaitHandoverBagging[\s\S]*appendWaitHandoverBaggingEvent/, 'WAREHOUSE_HUB 菲票装袋提交函数必须调用 appendWaitHandoverBaggingEvent')
assertMatch(hub, /function submitWaitHandoverInbound[\s\S]*appendWaitHandoverInboundEvent/, 'WAREHOUSE_HUB 中转袋入仓提交函数必须调用 appendWaitHandoverInboundEvent')
assertContains(hub, 'renderWaitHandoverBaggingRecordTable', 'WAREHOUSE_HUB 菲票装袋 tab 必须使用独立装袋记录表')
assertContains(hub, 'renderWaitHandoverInboundLocationTable', 'WAREHOUSE_HUB 中转袋入仓 tab 必须使用独立入仓库位表')
assertMatch(hub, /activeTab === 'inbound'[\s\S]*\? inboundContent/, 'WAREHOUSE_HUB 中转袋入仓 tab 不得继续复用菲票装袋内容')
assertNotContains(hub, '混装情况', 'WAREHOUSE_HUB 菲票装袋/中转袋入仓列表不得展示混装情况')
assertNotContains(hub, '后续状态', 'WAREHOUSE_HUB 菲票装袋/中转袋入仓列表不得展示后续状态')
assertContains(hub, 'open-bag-ticket-detail', 'WAREHOUSE_HUB 两个 tab 必须提供中转袋菲票详情弹窗动作')
assertContains(hub, 'renderWaitHandoverBagTicketDetailDialog', 'WAREHOUSE_HUB 必须有中转袋菲票明细弹窗')
assertContains(hub, "{ key: 'handover-bagging', label: '中转袋交出' }", 'WAREHOUSE_HUB 第四个 tab 必须命名为中转袋交出')
assertContains(hub, 'renderWaitHandoverHandoverRecordTable', 'WAREHOUSE_HUB 中转袋交出 tab 必须使用交出后记录表')
assertMatch(hub, /activeTab === 'handover-bagging'[\s\S]*\? handoverRecordContent/, 'WAREHOUSE_HUB 中转袋交出 tab 必须承载交出后记录数据')

// 2.4 中转袋弹窗标题
const tHandlers = read(T_BAGS_HANDLERS)
assertContains(tHandlers, '菲票装袋', 'TRANSFER_BAGS_HANDLERS getDialogTitle 必须有菲票装袋')
assertContains(tHandlers, '中转袋入仓', 'TRANSFER_BAGS_HANDLERS getDialogTitle 必须有中转袋入仓')

// 2.5 中转袋单文件旧入口
const tBags = read(T_BAGS)
assertNotContains(tBags, '开始入仓暂存装袋', 'TRANSFER_BAGS 不得保留旧入口按钮')
assertContains(tBags, '菲票装袋', 'TRANSFER_BAGS 必须有菲票装袋入口')

// 2.6 中转袋列表页
const tBagsList = read(T_BAGS_LIST)
assertNotContains(tBagsList, '开始入仓暂存装袋', 'TRANSFER_BAGS_LIST 不得保留旧入口按钮')

// 2.7 中转袋弹窗确认按钮
const tDialogs = read(T_BAGS_DIALOGS)
assertNotContains(tDialogs, '确认入仓暂存', 'TRANSFER_BAGS_DIALOGS 不得保留旧确认按钮')

// 2.8 核心 KPI 与弹窗字段已在仓库页面中呈现（原型级别不强行逐字匹配）
const cats = ['无特殊工艺', '未做特殊工艺', '特殊工艺加工中', '已做特殊工艺']
for (const cat of cats) {
  assertContains(hub, cat, `WAREHOUSE_HUB 在库分类缺少: ${cat}`)
}

// 2.10-2.11 弹窗字段原型不做逐字匹配

// 2.12 接收对象展示优先级——Web 首屏三核心对象
for (const receiver of ['车缝厂', '辅助工艺厂', '特种工艺厂']) {
  assertContains(hub, receiver, `WAREHOUSE_HUB 必须展示接收对象: ${receiver}`)
}

// 2.13 只读页面复核——不引用旧文案
for (const [name, path] of [
  ['FEI_TICKETS', FEI_TICKETS],
  ['CUTTING_SUMMARY', CUTTING_SUMMARY],
  ['PRODUCTION_PROGRESS', PRODUCTION_PROGRESS],
  ['DAILY_REPORT_MODEL', DAILY_REPORT_MODEL],
  ['META', META],
  ['CLOSE_RECORDS', CLOSE_RECORDS],
  ['HANDOVER_ORDERS_PAGE', HANDOVER_ORDERS_PAGE],
]) {
  const source = read(path)
  assertNotContains(source, OLD_MERGED, `${name} 不得引用旧文案 ${OLD_MERGED}`)
  assertNotContains(source, '菲票入仓暂存', `${name} 不得引用旧事件类型菲票入仓暂存`)
}

// ============================================================================
// §3  PDA 端页面入口
// ============================================================================

// 3.1 PDA 待交出仓首页四动作入口
const pdaWaitHandover = `${read(PDA_WAIT_HANDOVER)}\n${read(PDA_WAIT_HANDOVER_ACTIONS)}`
for (const label of ['菲票装袋', '中转袋入仓', '中转袋交出', '特殊工艺回仓']) {
  assertContains(pdaWaitHandover, label, `PDA_WAIT_HANDOVER 必须包含动作: ${label}`)
}
assertNotContains(pdaWaitHandover, OLD_MERGED, 'PDA_WAIT_HANDOVER 不得保留旧合并入口')

// 3.2 PDA 入仓页拆分
const pdaInbound = read(PDA_INBOUND)
assertContains(pdaInbound, '菲票装袋', 'PDA_INBOUND 必须有菲票装袋')
assertContains(pdaInbound, '中转袋入仓', 'PDA_INBOUND 必须有中转袋入仓')
assertContains(pdaInbound, 'appendWaitHandoverBaggingEvent', 'PDA_INBOUND 必须调用装袋写入')
assertMatch(pdaInbound, /appendWaitHandoverBaggingEvent\(/, 'PDA_INBOUND 确认菲票装袋必须真实调用 appendWaitHandoverBaggingEvent')
assertNotContains(pdaInbound, OLD_MERGED, 'PDA_INBOUND 不得保留旧合并标题')

// 3.3 PDA 交出页只保留整袋交出新入口，旧深链迁移到整袋交出
const pdaHandover = read(PDA_HANDOVER)
assertContains(pdaHandover, "action === 'handover-bagging-confirm' ? 'transfer-bag-handover'", 'PDA_HANDOVER 旧交出装袋确认深链必须迁移到整袋交出')
assertContains(pdaHandover, '中转袋交出', 'PDA_HANDOVER 必须有整袋交出入口')
assertNotContains(pdaHandover, 'data-pda-cut-handover-action="confirm-picking"', 'PDA_HANDOVER 不得继续提供交出装袋确认写入口')

// 3.4 PDA 特殊工艺回仓按是否实际扫描物理袋写事实
assertContains(pdaHandover, '回仓中转袋', 'PDA_HANDOVER 必须支持扫描实际回仓中转袋')
assertContains(pdaHandover, '回仓菲票', 'PDA_HANDOVER 必须支持无袋时只扫回仓菲票')
assertContains(pdaHandover, 'appendWaitHandoverSpecialCraftReturnEvent', 'PDA_HANDOVER 必须调用统一特殊工艺回仓事实写入')

// 3.5 PDA 仓管首页
const pdaWarehouse = read(PDA_WAREHOUSE)
assertNotContains(pdaWarehouse, OLD_MERGED, 'PDA_WAREHOUSE 裁床入口不得保留旧合并入口')
assertContains(pdaWaitHandover, '菲票装袋', 'PDA 裁床待交出仓快捷入口必须有菲票装袋')
assertContains(pdaWaitHandover, '中转袋入仓', 'PDA 裁床待交出仓快捷入口必须有中转袋入仓')

// 3.6 PDA 一页一动作——不得暴露管理统计/状态机
assertNotContains(pdaWaitHandover, '管理统计', 'PDA_WAIT_HANDOVER 不得展示管理统计')
assertNotContains(pdaWaitHandover, '状态流转', 'PDA_WAIT_HANDOVER 不得展示状态流转')

// 3.7 只读 PDA 页面复核
for (const [name, path] of [
  ['PDA_HANDOVER_LIST', PDA_HANDOVER_LIST],
  ['PDA_HANDOVER_DETAIL', PDA_HANDOVER_DETAIL],
  ['PDA_STOCKTAKE', PDA_STOCKTAKE],
  ['PDA_INBOUND_RECORDS', PDA_INBOUND_RECORDS],
  ['PDA_TRANSFER_BAG_DETAIL', PDA_TRANSFER_BAG_DETAIL],
]) {
  const source = read(path)
  assertNotContains(source, OLD_MERGED, `${name} 不得引用旧文案`)
  assertNotContains(source, '菲票入仓暂存', `${name} 不得引用旧事件类型`)
}

// ============================================================================
// §4  路由和 Handler 入口
// ============================================================================

// 4.1 Web 路由可达到性
const routesFcs = read(ROUTES_FCS)
assertContains(routesFcs, 'wait-handover', 'ROUTES_FCS 必须保留 wait-handover 路由')
assertContains(routesFcs, 'renderCraftCuttingWarehouseManagementWaitHandoverPage', 'ROUTES_FCS 必须注册待交出仓渲染函数')

// 4.2 PDA 路由可达到性
const routesPda = read(ROUTES_PDA)
assertContains(routesPda, 'wait-handover', 'ROUTES_PDA 必须保留 PDA wait-handover 路由')
assertContains(routesPda, 'renderPdaCuttingInboundPage', 'ROUTES_PDA 必须保留 PDA 入仓路由')
assertContains(routesPda, 'renderPdaCuttingHandoverPage', 'ROUTES_PDA 必须保留 PDA 交出路由')

// 4.3 main-handlers 注册仍有效
const fcsHandlers = read(FCS_HANDLERS)
assertContains(fcsHandlers, 'handleCraftCuttingWaitHandoverEvent', 'FCS_HANDLERS 必须注册 wait-handover 事件处理')

const pdaHandlers = read(PDA_HANDLERS)
assertContains(pdaHandlers, 'handlePdaCuttingInboundEvent', 'PDA_HANDLERS 必须注册 PDA 入仓事件处理')
assertContains(pdaHandlers, 'handlePdaCuttingHandoverEvent', 'PDA_HANDLERS 必须注册 PDA 交出事件处理')
assertContains(pdaHandlers, 'handlePdaWarehouseWaitHandoverEvent', 'PDA_HANDLERS 必须注册 PDA 待交出仓事件处理')

// ============================================================================
// §5  异常防错
// ============================================================================

const allPdaSources = [read(PDA_INBOUND), read(PDA_HANDOVER), read(PDA_WAIT_HANDOVER), read(PDA_WAREHOUSE)].join('\n')
const allSources = [ledger, runtime, hub, allPdaSources, handoverData, specialCraft].join('\n')

const preventions: Record<string, string> = {
  '未打印': '必须阻断未打印菲票',
  '作废': '必须阻断作废菲票',
  '重复入仓': '必须阻断重复入仓',
  '混装': '必须阻断普通与特殊工艺菲票混装',
  '已占用': '必须阻断目标中转袋已占用',
  '不属于当前任务': '必须提示交出对象不明确',
  '未回仓': '必须阻断特种工艺未回仓却交出',
  '来源记录': '必须提示回仓来源记录不符',
  '数量': '必须有数量校验阻断',
}
for (const [rule, msg] of Object.entries(preventions)) {
  assertContains(allSources, rule, `异常防错缺失: ${msg}`)
}

// ============================================================================
// §6  状态图落点
// ============================================================================

// 6.1 中转袋只保留三个主状态和三个使用中阶段
const bagStates = [
  { product: '空闲', codes: ['IDLE', '空闲'] },
  { product: '使用中', codes: ['IN_USE', '使用中'] },
  { product: '已报废', codes: ['DISABLED', '已报废'] },
  { product: '菲票已装袋', codes: ['PACKED', '菲票已装袋'] },
  { product: '入仓暂存中', codes: ['INBOUND_STORED', '入仓暂存中'] },
  { product: '已交出待回收', codes: ['HANDED_OVER_WAITING_RETURN', '已交出待回收'] },
]
for (const st of bagStates) {
  const found = st.codes.some((code) => tModel.includes(code) || lifecycle.includes(code))
  if (!found) failures.push(`MISSING: 中转袋主状态/阶段 ${st.product} 未在统一生命周期定义（代码值: ${st.codes.join('/')}）`)
  else passed++
}

// 6.2 菲票状态
const ticketStates = [
  { product: '待打印', codes: ['WAIT_PRINT', '待打印'] },
  { product: '已打印待装袋', codes: ['PRINTED', '已打印'] },
  { product: '已装袋', codes: ['已装袋', '菲票装袋'] },
  { product: '已入待交出仓', codes: ['已入待交出仓', '中转袋入仓'] },
  { product: '已交出', codes: ['已交出', '新增交出记录'] },
  { product: '特工加工中', codes: ['加工中', '特殊工艺加工中'] },
  { product: '特工待回仓', codes: ['待回仓', '未回仓'] },
  { product: '已回仓', codes: ['已回仓'] },
  { product: '已接收', codes: ['已接收'] },
]
for (const st of ticketStates) {
  const found = st.codes.some((code) => ledger.includes(code) || runtime.includes(code) || specialCraft.includes(code) || handoverData.includes(code))
  if (!found) failures.push(`MISSING: 菲票状态 ${st.product} 未在数据层定义（代码值: ${st.codes.join('/')}）`)
  else passed++
}

// 6.3 特种工艺回仓状态
const returnStates = [
  { product: '待回仓', codes: ['待回仓'] },
  { product: '回仓中', codes: ['回仓中', '回仓途中', '回仓'] },
  { product: '已回仓', codes: ['已回仓'] },
  { product: '部分回仓', codes: ['部分回仓'] },
  { product: '回仓差异', codes: ['回仓差异', '差异'] },
  { product: '待处理', codes: ['待处理'] },
  { product: '需重回', codes: ['需重回', '需重新交出'] },
]
for (const st of returnStates) {
  const found = st.codes.some((code) => specialCraft.includes(code) || runtime.includes(code) || handoverData.includes(code))
  if (!found) failures.push(`MISSING: 回仓状态 ${st.product} 未在数据层定义（代码值: ${st.codes.join('/')}）`)
  else passed++
}

// 6.4 交出单状态
for (const state of ['草稿', '待交出', '部分交出', '已交出待接收', '部分接收', '已接收', '差异处理中', '已关闭', '已取消']) {
  assertContains(handoverData, state, `交出单状态 ${state} 未在 handover-orders.ts 定义`)
}

// 6.5 交出记录状态
for (const state of ['待提交', '已提交', '待接收回写', '差异处理中']) {
  assertContains(handoverData, state, `交出记录状态 ${state} 未在 handover-orders.ts 定义`)
}

// 6.6 回写与异议状态
for (const state of ['待回写', '已回写', '差异回写', '异议中', '已关闭']) {
  assertContains(handoverData, state, `回写异议状态 ${state} 未在 handover-orders.ts 定义`)
}

// 6.7 接收对象五类完整
for (const receiver of ['车缝厂', '辅助工艺厂', '特种工艺厂', '仓库', '其他对象']) {
  assertContains(handoverData, receiver, `接收对象 ${receiver} 未在 handover-orders.ts 定义`)
}

// ============================================================================
// §7  检查脚本同步
// ============================================================================

// 确保所有被修改的检查脚本也不引用旧文案/旧事件
for (const [name, path] of [
  ['CK_WAREHOUSE_SWITCH', CK_WAREHOUSE_SWITCH],
  ['CK_CLEAN_MAINLINE', CK_CLEAN_MAINLINE],
  ['CK_PDA_HANDOVER_PAGES', CK_PDA_HANDOVER_PAGES],
  ['CK_TRANSFER_BAG_CLOSED', CK_TRANSFER_BAG_CLOSED],
  ['CK_FACTORY_MOBILE', CK_FACTORY_MOBILE],
  ['CK_SEWING_DISPATCH', CK_SEWING_DISPATCH],
  ['CK_SPECIAL_CRAFT_RETURN', CK_SPECIAL_CRAFT_RETURN],
  ['CK_FCS_HANDOVER', CK_FCS_HANDOVER],
  ['CK_WRITEBACK_DIFF', CK_WRITEBACK_DIFF],
  ['CK_FACTORY_LINKAGE', CK_FACTORY_LINKAGE],
  ['CK_PROGRESS_LINKAGE', CK_PROGRESS_LINKAGE],
  ['CK_FEI_ASSEMBLY', CK_FEI_ASSEMBLY],
  ['CK_SPECIAL_CRAFT_DEEP', CK_SPECIAL_CRAFT_DEEP],
  ['CK_MOBILE_WRITEBACK', CK_MOBILE_WRITEBACK],
]) {
  const source = read(path)
  assertNotContains(source, '菲票入仓暂存', `${name} 不得继续断言旧事件类型`)
  assertNotContains(source, '入仓暂存装袋', `${name} 不得继续断言旧合并文案（除非是待清理的禁用断言）`)
}

// ============================================================================
// §8  E2E 测试文件同步
// ============================================================================

for (const [name, path] of [
  ['TEST_RUNTIME_E2E', TEST_RUNTIME_E2E],
  ['TEST_STAGE8', TEST_STAGE8],
]) {
  const source = read(path)
  assertNotContains(source, '菲票入仓暂存', `${name} 不得引用旧事件类型`)
}

// ============================================================================
// §9  进度看板 + 打印模板
// ============================================================================

const progressBoard = read(PROGRESS_BOARD)
assertNotContains(progressBoard, '入仓暂存装袋', 'PROGRESS_BOARD 不得引用旧文案')
assertContains(progressBoard, '特殊工艺回仓', 'PROGRESS_BOARD 必须保留特殊工艺回仓联动')

const labelPrint = read(LABEL_PRINT)
assertNotContains(labelPrint, '入仓暂存装袋', 'LABEL_PRINT 不得引用旧文案')

// ============================================================================
// 汇总报告
// ============================================================================

console.log(`\n===== 裁床待交出仓与中转袋流转治理检查 =====`)
console.log(`通过: ${passed}`)
console.log(`失败: ${failures.length}`)

if (failures.length > 0) {
  console.log(`\n----- 失败明细 -----`)
  for (const f of failures) {
    console.log(`  ❌ ${f}`)
  }
  console.log(`\n----- 被下列任务覆盖 -----`)
  console.log(`  MISSING  → 任务 1（事实账）/ 任务 2（Web）/ 任务 3（PDA）`)
  console.log(`  STALE    → 任务 2（Web 旧文案）/ 任务 3（PDA 旧文案）/ 任务 4（脚本/测试同步）`)
  console.log(`  FILE_MISSING → 任务 4（文件创建或路径修正）`)
  process.exitCode = 1
} else {
  console.log(`\n全部断言通过 ✅`)
  process.exitCode = 0
}
