import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const pageSource = readFileSync(`${ROOT}/src/pages/process-factory/cutting/warehouse-hub.ts`, 'utf8')
const pageModule = await import('../src/pages/process-factory/cutting/warehouse-hub.ts') as Record<string, unknown>

type WebAction = 'bagging' | 'inbound' | 'handover'
type WebState = {
  bagCode: string
  ticketCodes: string[]
  locationCode: string
  sewingTaskCode: string
  productionOrderNo: string
  receiverFactoryName: string
  resultMessage: string
  errorMessage: string
}
type WebCandidates = {
  bags: Array<{
    bagCode: string
    productionOrderNo: string
    ticketCodes: string[]
    status: '待装袋' | '已装袋待入仓' | '已入待交出仓' | '已交出' | '已作废'
    boundSewingTaskCode?: string
  }>
  tickets: Array<{
    ticketCode: string
    productionOrderNo: string
    status: '可装袋' | '已装袋' | '已作废'
  }>
  sewingTasks: Array<{
    sewingTaskCode: string
    productionOrderNo: string
    receiverFactoryName: string
    receivable: boolean
  }>
}
type WebWorkflow = {
  createWaitHandoverWebFormState: () => WebState
  addWaitHandoverWebTicket: (
    state: WebState,
    ticketCode: string,
    candidates: WebCandidates,
  ) => { ok: boolean; state: WebState }
  resolveWaitHandoverWebHandoverContext: (
    state: WebState,
    candidates: WebCandidates,
  ) => { ok: boolean; state: WebState }
  submitWaitHandoverWebActionState: (
    action: WebAction,
    state: WebState,
    candidates: WebCandidates,
  ) => { ok: boolean; state: WebState; candidates: WebCandidates }
  renderWaitHandoverWebActionDialog: (action: WebAction, selectedValue?: string) => string
}

for (const exportName of [
  'createWaitHandoverWebFormState',
  'addWaitHandoverWebTicket',
  'resolveWaitHandoverWebHandoverContext',
  'submitWaitHandoverWebActionState',
  'renderWaitHandoverWebActionDialog',
]) {
  assert.equal(typeof pageModule[exportName], 'function', `Web 中转袋操作必须导出 ${exportName}`)
}

const workflow = pageModule as unknown as WebWorkflow
const candidates: WebCandidates = {
  bags: [
    { bagCode: 'WEB-BAG-NEW', productionOrderNo: '', ticketCodes: [], status: '待装袋' },
    { bagCode: 'WEB-BAG-IN', productionOrderNo: 'PO-001', ticketCodes: ['WEB-FEI-001'], status: '已装袋待入仓' },
    { bagCode: 'WEB-BAG-OUT', productionOrderNo: 'PO-001', ticketCodes: ['WEB-FEI-001'], status: '已入待交出仓' },
    { bagCode: 'WEB-BAG-CROSS', productionOrderNo: 'PO-002', ticketCodes: ['WEB-FEI-003'], status: '已入待交出仓' },
    { bagCode: 'WEB-BAG-DONE', productionOrderNo: 'PO-001', ticketCodes: ['WEB-FEI-001'], status: '已交出', boundSewingTaskCode: 'SEW-001' },
  ],
  tickets: [
    { ticketCode: 'WEB-FEI-001', productionOrderNo: 'PO-001', status: '可装袋' },
    { ticketCode: 'WEB-FEI-002', productionOrderNo: 'PO-001', status: '可装袋' },
    { ticketCode: 'WEB-FEI-003', productionOrderNo: 'PO-002', status: '可装袋' },
  ],
  sewingTasks: [
    { sewingTaskCode: 'SEW-001', productionOrderNo: 'PO-001', receiverFactoryName: '印尼一厂', receivable: true },
    { sewingTaskCode: 'SEW-002', productionOrderNo: 'PO-002', receiverFactoryName: '印尼二厂', receivable: true },
    { sewingTaskCode: 'SEW-CLOSED', productionOrderNo: 'PO-001', receiverFactoryName: '印尼一厂', receivable: false },
  ],
}

const baggingBase = { ...workflow.createWaitHandoverWebFormState(), bagCode: 'WEB-BAG-NEW' }
const firstTicket = workflow.addWaitHandoverWebTicket(baggingBase, 'WEB-FEI-001', candidates)
assert.equal(firstTicket.ok, true, '有效菲票必须可逐个录入')
const secondTicket = workflow.addWaitHandoverWebTicket(firstTicket.state, 'WEB-FEI-002', candidates)
assert.deepEqual(secondTicket.state.ticketCodes, ['WEB-FEI-001', 'WEB-FEI-002'], '同生产单菲票必须形成紧凑已录入明细')
const crossTicket = workflow.addWaitHandoverWebTicket(secondTicket.state, 'WEB-FEI-003', candidates)
assert.equal(crossTicket.ok, false, '跨生产单菲票必须阻断')
assert.deepEqual(crossTicket.state.ticketCodes, ['WEB-FEI-001', 'WEB-FEI-002'], '装袋失败必须保留已录入菲票')

const baggingSuccess = workflow.submitWaitHandoverWebActionState('bagging', secondTicket.state, candidates)
assert.equal(baggingSuccess.ok, true, '有效装袋必须成功')
assert.equal(baggingSuccess.state.resultMessage, '装袋成功', '装袋成功反馈必须准确')
assert.equal(baggingSuccess.state.bagCode, '', '装袋成功必须清空袋码进入新一轮')
assert.deepEqual(baggingSuccess.state.ticketCodes, [], '装袋成功必须清空菲票')

const inboundState = {
  ...workflow.createWaitHandoverWebFormState(),
  bagCode: 'WEB-BAG-IN',
  locationCode: 'CUT-A-01',
}
const inboundSuccess = workflow.submitWaitHandoverWebActionState('inbound', inboundState, candidates)
assert.equal(inboundSuccess.ok, true, '有效中转袋必须可入仓')
assert.equal(inboundSuccess.state.resultMessage, '入仓成功', '入仓成功反馈必须准确')
assert.equal(inboundSuccess.state.bagCode, '', '入仓成功必须清空袋码')
assert.equal(inboundSuccess.state.locationCode, '', '入仓成功必须清空库区库位')
const inboundFailure = workflow.submitWaitHandoverWebActionState(
  'inbound',
  { ...inboundState, locationCode: '' },
  candidates,
)
assert.equal(inboundFailure.ok, false, '缺少库区库位必须阻断')
assert.equal(inboundFailure.state.bagCode, 'WEB-BAG-IN', '入仓失败必须保留袋码')

const handoverState = {
  ...workflow.createWaitHandoverWebFormState(),
  bagCode: 'WEB-BAG-OUT',
  sewingTaskCode: 'SEW-001',
}
const resolvedHandover = workflow.resolveWaitHandoverWebHandoverContext(handoverState, candidates)
assert.equal(resolvedHandover.ok, true, '有效车缝任务必须可识别')
assert.equal(resolvedHandover.state.productionOrderNo, 'PO-001', '生产单必须由任务自动带出')
assert.equal(resolvedHandover.state.receiverFactoryName, '印尼一厂', '接收工厂必须由任务自动带出')
const handoverSuccess = workflow.submitWaitHandoverWebActionState('handover', resolvedHandover.state, candidates)
assert.equal(handoverSuccess.ok, true, '同生产单且可接收任务必须整袋交出')
assert.equal(handoverSuccess.state.resultMessage, '交出成功', '交出成功反馈必须准确')
assert.equal(handoverSuccess.state.bagCode, '', '交出成功必须清空袋码')
assert.equal(handoverSuccess.state.sewingTaskCode, '', '交出成功必须清空任务号')

const crossHandover = workflow.resolveWaitHandoverWebHandoverContext(
  { ...handoverState, bagCode: 'WEB-BAG-CROSS' },
  candidates,
)
assert.equal(crossHandover.ok, false, '跨生产单任务必须阻断')
assert.equal(crossHandover.state.bagCode, 'WEB-BAG-CROSS', '交出失败必须保留袋码')
assert.equal(crossHandover.state.sewingTaskCode, 'SEW-001', '交出失败必须保留任务号')
const closedHandover = workflow.resolveWaitHandoverWebHandoverContext(
  { ...handoverState, sewingTaskCode: 'SEW-CLOSED' },
  candidates,
)
assert.equal(closedHandover.ok, false, '不可接收任务必须阻断')
const duplicateHandover = workflow.submitWaitHandoverWebActionState(
  'handover',
  { ...handoverState, bagCode: 'WEB-BAG-DONE' },
  candidates,
)
assert.equal(duplicateHandover.ok, false, '已交出袋必须阻断重复交出')

const baggingHtml = workflow.renderWaitHandoverWebActionDialog('bagging')
for (const text of ['菲票装袋', '中转袋编号', '菲票编号', '确认装袋']) {
  assert(baggingHtml.includes(text), `Web 菲票装袋缺少：${text}`)
}
assert(baggingHtml.includes('data-wait-handover-ticket-list'), 'Web 菲票装袋必须形成紧凑已录入明细')
for (const forbidden of ['待入仓菲票', '铺布', '面料', '扫码']) {
  assert(!baggingHtml.includes(forbidden), `Web 菲票装袋不得展示：${forbidden}`)
}

const inboundHtml = workflow.renderWaitHandoverWebActionDialog('inbound')
for (const text of ['中转袋入仓', '中转袋编号', '库区库位', '确认入仓']) {
  assert(inboundHtml.includes(text), `Web 中转袋入仓缺少：${text}`)
}
for (const forbidden of ['菲票编号', '待入仓菲票', '扫码']) {
  assert(!inboundHtml.includes(forbidden), `Web 中转袋入仓不得展示：${forbidden}`)
}

const handoverHtml = workflow.renderWaitHandoverWebActionDialog('handover')
for (const text of ['中转袋交出', '中转袋编号', '车缝任务号', '生产单号', '接收工厂', '确认整袋交出']) {
  assert(handoverHtml.includes(text), `Web 中转袋交出缺少：${text}`)
}
for (const forbidden of ['工厂选择', '菲票编号', '数量输入', '部分交出', '扫码', '交出装袋确认']) {
  assert(!handoverHtml.includes(forbidden), `Web 中转袋交出不得展示：${forbidden}`)
}

assert(pageSource.includes('data-skip-page-rerender="true"'), 'Web 高频输入必须声明跳过整页重绘')
assert(!pageSource.includes('data-wait-handover-action="open-handover-bagging-confirm"'), 'Web 页面不得保留旧交出装袋确认入口')

console.log('✅ Web 裁床中转袋三操作聚焦检查通过')
