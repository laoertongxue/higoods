import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const warehouseSource = readFileSync(`${ROOT}/src/pages/process-factory/cutting/warehouse-hub.ts`, 'utf8')
const rendererSource = readFileSync(`${ROOT}/src/router/route-renderers-fcs.ts`, 'utf8')
const routesSource = readFileSync(`${ROOT}/src/router/routes-fcs.ts`, 'utf8')
const handlersSource = readFileSync(`${ROOT}/src/main-handlers/fcs-handlers.ts`, 'utf8')

assert.equal(
  createHash('sha256').update(warehouseSource).digest('hex'),
  '46d59b0a5bb204b4cd1f5179c361a40d236e6bb2083729f16b4d354dff687602',
  '历史仓库列表页必须与 00a3a036 基线完全一致',
)
assert(
  rendererSource.includes("() => import('../pages/process-factory/cutting/wait-handover-web-actions')"),
  '待交出仓路由必须改为独立 Web 操作页',
)
assert(
  routesSource.includes("'/fcs/craft/cutting/warehouse-management/wait-handover': () => renderCraftCuttingWarehouseManagementWaitHandoverPage()"),
  '独立 Web 操作页必须保持既有菜单路由可达',
)
assert(
  handlersSource.includes('handleCraftCuttingWaitHandoverWebActionsEvent'),
  '全局事件入口必须接入独立 Web 操作页处理器',
)

const pageModule = await import('../src/pages/process-factory/cutting/wait-handover-web-actions.ts')
type Workflow = typeof pageModule
const workflow: Workflow = pageModule

for (const exportName of [
  'createWaitHandoverWebFormState',
  'addWaitHandoverWebTicket',
  'resolveWaitHandoverWebHandoverContext',
  'submitWaitHandoverWebActionState',
  'handleWaitHandoverWebCommand',
  'renderCraftCuttingWarehouseManagementWaitHandoverPage',
]) {
  assert.equal(typeof pageModule[exportName as keyof Workflow], 'function', `独立 Web 操作页必须导出 ${exportName}`)
}

const candidates: Parameters<typeof workflow.addWaitHandoverWebTicket>[2] = {
  bags: [
    { bagCode: 'WEB-BAG-NEW', productionOrderNo: '', ticketCodes: [], status: '待装袋' },
    { bagCode: 'WEB-BAG-IN', productionOrderNo: 'PO-001', ticketCodes: ['WEB-FEI-IN-001'], status: '已装袋待入仓' },
    { bagCode: 'WEB-BAG-OUT', productionOrderNo: 'PO-001', ticketCodes: ['WEB-FEI-OUT-001'], status: '已入待交出仓' },
    { bagCode: 'WEB-BAG-CROSS', productionOrderNo: 'PO-002', ticketCodes: ['WEB-FEI-CROSS-001'], status: '已入待交出仓' },
    { bagCode: 'WEB-BAG-DONE', productionOrderNo: 'PO-001', ticketCodes: ['WEB-FEI-DONE-001'], status: '已交出', boundSewingTaskCode: 'SEW-001' },
  ],
  tickets: [
    { ticketCode: 'WEB-FEI-001', productionOrderNo: 'PO-001', status: '可装袋' },
    { ticketCode: 'WEB-FEI-002', productionOrderNo: 'PO-001', status: '可装袋' },
    { ticketCode: 'WEB-FEI-003', productionOrderNo: 'PO-002', status: '可装袋' },
    { ticketCode: 'WEB-FEI-IN-001', productionOrderNo: 'PO-001', status: '已装袋' },
    { ticketCode: 'WEB-FEI-OUT-001', productionOrderNo: 'PO-001', status: '已装袋' },
    { ticketCode: 'WEB-FEI-CROSS-001', productionOrderNo: 'PO-002', status: '已装袋' },
    { ticketCode: 'WEB-FEI-DONE-001', productionOrderNo: 'PO-001', status: '已装袋' },
  ],
  sewingTasks: [
    { sewingTaskCode: 'SEW-001', productionOrderNo: 'PO-001', receiverFactoryName: '印尼一厂', receivable: true },
    { sewingTaskCode: 'SEW-002', productionOrderNo: 'PO-002', receiverFactoryName: '印尼二厂', receivable: true },
    { sewingTaskCode: 'SEW-CLOSED', productionOrderNo: 'PO-001', receiverFactoryName: '印尼一厂', receivable: false },
  ],
}

const baggingBase = { ...workflow.createWaitHandoverWebFormState(), bagCode: 'WEB-BAG-NEW' }
const firstTicket = workflow.handleWaitHandoverWebCommand(
  { type: 'add-ticket', ticketCode: 'WEB-FEI-001' },
  baggingBase,
  candidates,
)
assert.equal(firstTicket.ok, true, '处理器必须允许有效菲票逐个录入')
const secondTicket = workflow.handleWaitHandoverWebCommand(
  { type: 'add-ticket', ticketCode: 'WEB-FEI-002' },
  firstTicket.state,
  firstTicket.candidates,
)
assert.deepEqual(secondTicket.state.ticketCodes, ['WEB-FEI-001', 'WEB-FEI-002'], '处理器必须形成紧凑已录入明细')
const crossTicket = workflow.handleWaitHandoverWebCommand(
  { type: 'add-ticket', ticketCode: 'WEB-FEI-003' },
  secondTicket.state,
  secondTicket.candidates,
)
assert.equal(crossTicket.ok, false, '处理器必须阻断跨生产单菲票')
assert.deepEqual(crossTicket.state.ticketCodes, ['WEB-FEI-001', 'WEB-FEI-002'], '操作失败必须保留已录入菲票')

const inconsistentCandidates = structuredClone(candidates)
inconsistentCandidates.tickets.find((ticket) => ticket.ticketCode === 'WEB-FEI-IN-001')!.status = '可装袋'
const duplicateTicket = workflow.addWaitHandoverWebTicket(
  baggingBase,
  'WEB-FEI-IN-001',
  inconsistentCandidates,
)
assert.equal(duplicateTicket.ok, false, '即使菲票状态脏污，跨袋重复归属也必须阻断')
assert.match(duplicateTicket.state.errorMessage, /其他中转袋/, '跨袋重复归属必须给出明确错误')

const baggingSuccess = workflow.handleWaitHandoverWebCommand(
  { type: 'submit', action: 'bagging' },
  secondTicket.state,
  secondTicket.candidates,
)
assert.equal(baggingSuccess.ok, true, '处理器必须完成有效装袋')
assert.equal(baggingSuccess.state.resultMessage, '装袋成功')
assert.equal(baggingSuccess.state.bagCode, '', '成功后必须清空袋码')
assert.deepEqual(baggingSuccess.state.ticketCodes, [], '成功后必须清空菲票')
assert.equal(
  baggingSuccess.candidates.tickets.find((ticket) => ticket.ticketCode === 'WEB-FEI-001')?.status,
  '已装袋',
  '装袋处理必须更新候选菲票状态',
)

const inboundState = { ...workflow.createWaitHandoverWebFormState(), bagCode: 'WEB-BAG-IN', locationCode: 'CUT-A-01' }
const inboundSuccess = workflow.handleWaitHandoverWebCommand(
  { type: 'submit', action: 'inbound' },
  inboundState,
  candidates,
)
assert.equal(inboundSuccess.ok, true, '处理器必须完成有效入仓')
assert.equal(inboundSuccess.state.resultMessage, '入仓成功')
assert.equal(inboundSuccess.state.locationCode, '', '入仓成功必须清空库区库位')
const inboundFailure = workflow.handleWaitHandoverWebCommand(
  { type: 'submit', action: 'inbound' },
  { ...inboundState, locationCode: '' },
  candidates,
)
assert.equal(inboundFailure.ok, false, '缺少库区库位必须阻断')
assert.equal(inboundFailure.state.bagCode, 'WEB-BAG-IN', '失败后必须保留袋码')

const handoverState = {
  ...workflow.createWaitHandoverWebFormState(),
  bagCode: 'WEB-BAG-OUT',
  sewingTaskCode: 'SEW-001',
}
const resolvedHandover = workflow.handleWaitHandoverWebCommand(
  { type: 'resolve-handover' },
  handoverState,
  candidates,
)
assert.equal(resolvedHandover.ok, true, '处理器必须识别有效车缝任务')
assert.equal(resolvedHandover.state.productionOrderNo, 'PO-001', '生产单必须由任务自动带出')
assert.equal(resolvedHandover.state.receiverFactoryName, '印尼一厂', '接收工厂必须由任务自动带出')
const handoverSuccess = workflow.handleWaitHandoverWebCommand(
  { type: 'submit', action: 'handover' },
  resolvedHandover.state,
  resolvedHandover.candidates,
)
assert.equal(handoverSuccess.ok, true, '同生产单且可接收任务必须整袋交出')
assert.equal(handoverSuccess.state.resultMessage, '交出成功')

const crossHandover = workflow.handleWaitHandoverWebCommand(
  { type: 'resolve-handover' },
  { ...handoverState, bagCode: 'WEB-BAG-CROSS' },
  candidates,
)
assert.equal(crossHandover.ok, false, '跨生产单任务必须阻断')
assert.equal(crossHandover.state.bagCode, 'WEB-BAG-CROSS', '失败后必须保留袋码')
const closedHandover = workflow.handleWaitHandoverWebCommand(
  { type: 'resolve-handover' },
  { ...handoverState, sewingTaskCode: 'SEW-CLOSED' },
  candidates,
)
assert.equal(closedHandover.ok, false, '不可接收任务必须阻断')
const duplicateHandover = workflow.handleWaitHandoverWebCommand(
  { type: 'submit', action: 'handover' },
  { ...handoverState, bagCode: 'WEB-BAG-DONE' },
  candidates,
)
assert.equal(duplicateHandover.ok, false, '已交出袋必须阻断重复交出')

const pageHtml = workflow.renderCraftCuttingWarehouseManagementWaitHandoverPage()
for (const text of ['菲票装袋', '中转袋入仓', '中转袋交出', '确认装袋']) {
  assert(pageHtml.includes(text), `独立 Web 操作页缺少：${text}`)
}
assert(pageHtml.includes('data-skip-page-rerender="true"'), '高频输入必须跳过整页重绘')
assert(!pageHtml.includes('confirmSelection='), '独立操作页不得接收历史列表选择值')
assert(!pageHtml.includes('<table'), '独立操作页不得伪装为列表页')

console.log('✅ Web 裁床中转袋独立操作页检查通过')
