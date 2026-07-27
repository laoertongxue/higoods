import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const source = readFileSync(`${ROOT}/src/pages/pda-cutting-inbound.ts`, 'utf8')
const pageModule = await import('../src/pages/pda-cutting-inbound.ts') as Record<string, unknown>

assert.equal(
  typeof pageModule.createPdaCuttingInboundFormState,
  'function',
  'PDA 裁片入仓页必须导出可测试的新一轮状态创建函数',
)
assert.equal(
  typeof pageModule.applyPdaCuttingInboundTicketScan,
  'function',
  'PDA 裁片入仓页必须导出扫码即加入菲票的纯函数',
)
assert.equal(
  typeof pageModule.completePdaCuttingInboundRound,
  'function',
  'PDA 裁片入仓页必须导出成功清空、失败保留的纯函数',
)
assert.equal(
  typeof pageModule.renderPdaCuttingInboundWorkflow,
  'function',
  'PDA 裁片入仓页必须导出两种模式的工作区渲染函数',
)
assert.equal(
  typeof pageModule.resolvePdaCuttingInboundScanTrigger,
  'function',
  'PDA 裁片入仓页必须导出扫码完成触发判定函数',
)
assert.equal(
  typeof pageModule.completePdaCuttingInboundTicketScan,
  'function',
  'PDA 裁片入仓页必须导出统一扫码校验与状态转换函数',
)

type WorkflowModule = {
  createPdaCuttingInboundFormState: () => any
  applyPdaCuttingInboundTicketScan: (
    state: any,
    ticket: { ticketNo: string; pieceQty: number; productionOrderNo: string },
  ) => {
    ok: boolean
    state: any
  }
  completePdaCuttingInboundRound: (
    state: any,
    mode: 'bagging' | 'inbound-location',
    result: { ok: boolean; message?: string },
  ) => any
  renderPdaCuttingInboundWorkflow: (mode: 'bagging' | 'inbound-location', state: any) => string
  resolvePdaCuttingInboundScanTrigger: (event: { type: string; key?: string }) => 'immediate' | 'debounced' | 'none'
  completePdaCuttingInboundTicketScan: (
    state: any,
    scanCode: string,
    candidates: Array<Record<string, any>>,
  ) => { ok: boolean; state: any }
  PDA_CUTTING_INBOUND_SCAN_DEBOUNCE_MS: number
}

const workflow = pageModule as unknown as WorkflowModule
assert.equal(workflow.PDA_CUTTING_INBOUND_SCAN_DEBOUNCE_MS, 150, '扫码枪输入 debounce 必须为约 150ms')
assert.equal(
  workflow.resolvePdaCuttingInboundScanTrigger({ type: 'keydown', key: 'Enter' }),
  'immediate',
  'Enter 必须优先立即完成扫描',
)
assert.equal(
  workflow.resolvePdaCuttingInboundScanTrigger({ type: 'input' }),
  'debounced',
  '普通扫码枪输入必须走 debounce',
)
assert.equal(
  workflow.resolvePdaCuttingInboundScanTrigger({ type: 'keydown', key: 'A' }),
  'none',
  '非 Enter 按键不得触发扫描校验',
)

const initial = workflow.createPdaCuttingInboundFormState()
const outOfOrderScan = workflow.applyPdaCuttingInboundTicketScan(initial, {
  ticketNo: 'FT-000',
  pieceQty: 5,
  productionOrderNo: 'PO-001',
})
assert.equal(outOfOrderScan.ok, false, '未扫中转袋时不得提前加入菲票')
assert.deepEqual(outOfOrderScan.state.scannedTicketNos, [], '顺序错误时不得改变已扫菲票')

initial.carrierCode = 'BAG-001'
initial.scanCode = 'FT-001'

const firstScan = workflow.applyPdaCuttingInboundTicketScan(initial, {
  ticketNo: 'FT-001',
  pieceQty: 12,
  productionOrderNo: 'PO-001',
})
assert.equal(firstScan.ok, true, '有效菲票扫码后必须直接加入当前袋')
assert.deepEqual(firstScan.state.scannedTicketNos, ['FT-001'], '扫码后已扫菲票应立即增加')
assert.equal(firstScan.state.inboundQty, '12', '扫码后数量必须自动累计')
assert.equal(firstScan.state.scanCode, '', '扫码加入成功后必须清空扫码框，允许连续扫描')
assert.equal(firstScan.state.bagProductionOrderNo, 'PO-001', '首张菲票必须确定当前袋生产单')

const secondScan = workflow.applyPdaCuttingInboundTicketScan(firstScan.state, {
  ticketNo: 'FT-002',
  pieceQty: 8,
  productionOrderNo: 'PO-001',
})
assert.deepEqual(secondScan.state.scannedTicketNos, ['FT-001', 'FT-002'], '必须支持连续扫描多张菲票')
assert.equal(secondScan.state.inboundQty, '20', '连续扫码数量累计错误')

const mixedOrderScan = workflow.applyPdaCuttingInboundTicketScan(secondScan.state, {
  ticketNo: 'FT-003',
  pieceQty: 7,
  productionOrderNo: 'PO-002',
})
assert.equal(mixedOrderScan.ok, false, '同一袋不得加入不同生产单菲票')
assert.deepEqual(mixedOrderScan.state.scannedTicketNos, ['FT-001', 'FT-002'], '跨生产单失败必须保留已扫菲票')
assert(
  mixedOrderScan.state.scanFeedbackMessage.includes('不属于当前袋生产单'),
  '跨生产单失败必须给出短错误提示',
)

const unknownState = { ...secondScan.state, scanCode: 'UNKNOWN-001' }
const unknownScan = workflow.completePdaCuttingInboundTicketScan(unknownState, 'UNKNOWN-001', [])
assert.equal(unknownScan.ok, false, '未知菲票必须在扫描完成时失败')
assert.equal(unknownScan.state.scanCode, '', '未知菲票失败后应清空输入，便于重扫')
assert.deepEqual(unknownScan.state.scannedTicketNos, ['FT-001', 'FT-002'], '未知菲票失败必须保留已扫数据')
assert.equal(unknownScan.state.scanFeedbackMessage, '没有找到这张菲票，请重新扫描。', '未知菲票短错误不正确')

const waitScan = workflow.completePdaCuttingInboundTicketScan(
  { ...secondScan.state, scanCode: 'WAIT-001' },
  'WAIT-001',
  [],
)
assert.equal(waitScan.ok, false, 'WAIT 菲票必须在扫描完成时失败')
assert.equal(waitScan.state.scanCode, '', 'WAIT 菲票失败后应清空输入')
assert.equal(waitScan.state.scanFeedbackMessage, '这张菲票未打印，请换一张。', 'WAIT 菲票短错误不正确')

const voidScan = workflow.completePdaCuttingInboundTicketScan(
  { ...secondScan.state, scanCode: 'VOID-001' },
  'VOID-001',
  [],
)
assert.equal(voidScan.ok, false, 'VOID 菲票必须在扫描完成时失败')
assert.equal(voidScan.state.scanCode, '', 'VOID 菲票失败后应清空输入')
assert.equal(voidScan.state.scanFeedbackMessage, '这张菲票已作废，请换一张。', 'VOID 菲票短错误不正确')

const failedBagging = workflow.completePdaCuttingInboundRound(secondScan.state, 'bagging', {
  ok: false,
  message: '袋码无效，请重新扫描。',
})
assert.equal(failedBagging.carrierCode, 'BAG-001', '装袋失败必须保留已扫袋码')
assert.deepEqual(failedBagging.scannedTicketNos, ['FT-001', 'FT-002'], '装袋失败必须保留已扫菲票')
assert.equal(failedBagging.inboundQty, '20', '装袋失败必须保留数量')

const successfulBagging = workflow.completePdaCuttingInboundRound(secondScan.state, 'bagging', { ok: true })
assert.equal(successfulBagging.resultMessage, '装袋成功', '装袋成功提示必须精确')
assert.equal(successfulBagging.carrierCode, '', '装袋成功后必须清空袋码')
assert.equal(successfulBagging.scanCode, '', '装袋成功后必须清空菲票扫码值')
assert.deepEqual(successfulBagging.scannedTicketNos, [], '装袋成功后必须清空已扫菲票')
assert.equal(successfulBagging.inboundQty, '', '装袋成功后必须清空数量')
assert.equal(successfulBagging.scanFeedbackMessage, '', '装袋成功后必须清空上次扫描结果')
const freshBaggingHtml = workflow.renderPdaCuttingInboundWorkflow('bagging', successfulBagging)
assert(freshBaggingHtml.includes('装袋成功'), '装袋成功后同一路由的新界面必须保留明确成功提示')
assert(freshBaggingHtml.includes('已扫菲票 0 张'), '装袋成功后必须立即呈现全新空白装袋界面')

const inboundState = workflow.createPdaCuttingInboundFormState()
inboundState.carrierCode = 'BAG-002'
inboundState.locationLabel = 'B-02-03'
const failedInbound = workflow.completePdaCuttingInboundRound(inboundState, 'inbound-location', {
  ok: false,
  message: '库位无效，请重新扫描。',
})
assert.equal(failedInbound.carrierCode, 'BAG-002', '入仓失败必须保留袋码')
assert.equal(failedInbound.locationLabel, 'B-02-03', '入仓失败必须保留库位')

const successfulInbound = workflow.completePdaCuttingInboundRound(inboundState, 'inbound-location', { ok: true })
assert.equal(successfulInbound.resultMessage, '入仓成功', '入仓成功提示必须精确')
assert.equal(successfulInbound.carrierCode, '', '入仓成功后必须清空袋码')
assert.equal(successfulInbound.locationLabel, '', '入仓成功后必须清空库位')

const baggingHtml = workflow.renderPdaCuttingInboundWorkflow('bagging', secondScan.state)
for (const text of ['1 扫中转袋', '2 扫菲票', '3 确认装袋', '确认装袋', '已扫菲票 2 张']) {
  assert(baggingHtml.includes(text), `菲票装袋模式缺少：${text}`)
}
assert.equal((baggingHtml.match(/<button\b/g) || []).length, 1, '菲票装袋工作区只能有一个主要按钮')
for (const forbidden of ['加入菲票', '待入仓菲票', '生产单', '铺布单', '面料信息', '当前情况', '当前阶段', '最近记录']) {
  assert(!baggingHtml.includes(forbidden), `菲票装袋模式不得展示：${forbidden}`)
}

const inboundHtml = workflow.renderPdaCuttingInboundWorkflow('inbound-location', inboundState)
for (const text of ['1 扫中转袋', '2 扫库区库位', '3 确认入仓', '确认入仓']) {
  assert(inboundHtml.includes(text), `中转袋入仓模式缺少：${text}`)
}
assert.equal((inboundHtml.match(/<button\b/g) || []).length, 1, '中转袋入仓工作区只能有一个主要按钮')
for (const forbidden of ['菲票', '加入菲票', '待入仓', '生产单', '铺布单', '面料信息', '当前情况', '当前阶段', '最近记录']) {
  assert(!inboundHtml.includes(forbidden), `中转袋入仓模式不得展示：${forbidden}`)
}

assert(!source.includes('appendWaitHandoverBaggingEvent'), '快速原型不得写入菲票装袋事件账')
assert(!source.includes('appendWaitHandoverInboundEvent'), '快速原型不得写入中转袋入仓事件账')
assert(!source.includes('renderPdaCuttingOrderSelectionPrompt'), '不得保留待入仓菲票或裁片单中间选择页')

console.log('[check-pda-cutting-inbound-workflow] 两种 PDA 扫码工作流检查通过')
