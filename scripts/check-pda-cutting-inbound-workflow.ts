// @ts-expect-error 本脚本由 Node + tsx 运行，仓库未安装 @types/node。
import assert from 'node:assert/strict'
// @ts-expect-error 本脚本由 Node + tsx 运行，仓库未安装 @types/node。
import { readFileSync } from 'node:fs'
// @ts-expect-error 本脚本由 Node + tsx 运行，仓库未安装 @types/node。
import { fileURLToPath } from 'node:url'
import * as workflow from '../src/pages/pda-cutting-inbound.ts'
import { buildTransferBagsProjection } from '../src/pages/process-factory/cutting/transfer-bags-projection.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const source = readFileSync(`${ROOT}/src/pages/pda-cutting-inbound.ts`, 'utf8')
const mainSource = readFileSync(`${ROOT}/src/main.ts`, 'utf8')

assert.equal(
  typeof workflow.createPdaCuttingInboundFormState,
  'function',
  'PDA 裁片入仓页必须导出可测试的新一轮状态创建函数',
)
assert.equal(
  typeof workflow.applyPdaCuttingInboundTicketScan,
  'function',
  'PDA 裁片入仓页必须导出扫码即加入菲票的纯函数',
)
assert.equal(
  typeof workflow.completePdaCuttingInboundRound,
  'function',
  'PDA 裁片入仓页必须导出成功清空、失败保留的纯函数',
)
assert.equal(
  typeof workflow.renderPdaCuttingInboundWorkflow,
  'function',
  'PDA 裁片入仓页必须导出两种模式的工作区渲染函数',
)
assert.equal(
  typeof workflow.resolvePdaCuttingInboundScanTrigger,
  'function',
  'PDA 裁片入仓页必须导出扫码完成触发判定函数',
)
assert.equal(
  typeof workflow.completePdaCuttingInboundTicketScan,
  'function',
  'PDA 裁片入仓页必须导出统一扫码校验与状态转换函数',
)
assert.equal(
  typeof workflow.createPdaCuttingInboundScanTimerController,
  'function',
  'PDA 裁片入仓页必须导出按状态键和轮次管理扫码 timer 的控制器',
)
assert.equal(
  typeof workflow.createPdaCuttingInboundMockLedger,
  'function',
  'PDA 裁片入仓页必须导出最小本地袋、菲票、库位台账创建函数',
)
assert.equal(
  typeof workflow.applyPdaCuttingInboundBusinessTransition,
  'function',
  'PDA 裁片入仓页必须导出确认装袋、确认入仓的纯状态迁移函数',
)
assert.equal(
  typeof workflow.resolvePdaCuttingInboundFormContainer,
  'function',
  'PDA 裁片入仓页必须导出可执行测试的工作区容器解析函数',
)
assert.equal(
  typeof workflow.syncPdaCuttingInboundFormFromControls,
  'function',
  'PDA 裁片入仓页必须导出确认前同步最新输入值的函数',
)
assert.equal(
  typeof workflow.confirmPdaCuttingInboundRound,
  'function',
  'PDA 裁片入仓页必须导出保留 pending 扫码结果的可执行确认编排',
)
assert.equal(
  typeof workflow.updatePdaCuttingInboundWorkflow,
  'function',
  'PDA 裁片入仓页必须导出确认后的局部工作区刷新函数',
)

const latestControlValues: Record<string, string> = {
  carrierCode: 'BAG-002',
  locationLabel: 'CUT-A-01',
  scanCode: 'FT-CUT-LATEST-001',
}
const fakeWorkflowContainer: HTMLElement = Object.assign(Object.create(null), {
  querySelector(selector: string) {
    const field = Object.keys(latestControlValues).find((key) => selector.includes(`="${key}"`))
    return field ? { value: latestControlValues[field] } : null
  },
})
const fakeConfirmButton: HTMLElement = Object.assign(Object.create(null), {
  dataset: { taskId: 'TASK-1' },
  closest(selector: string) {
    if (selector === '[data-pda-cutting-inbound-workflow]') return fakeWorkflowContainer
    if (selector === '[data-task-id]') return this
    return null
  },
})
const resolvedWorkflowContainer = workflow.resolvePdaCuttingInboundFormContainer(fakeConfirmButton)
assert.equal(
  resolvedWorkflowContainer,
  fakeWorkflowContainer,
  '确认按钮自身带 data-task-id 时，仍必须解析到包含输入的外层工作区',
)
const latestFormState = workflow.createPdaCuttingInboundFormState()
workflow.syncPdaCuttingInboundFormFromControls(latestFormState, resolvedWorkflowContainer)
assert.equal(latestFormState.carrierCode, latestControlValues.carrierCode, '确认前必须同步输入框中的最新袋码')
assert.equal(latestFormState.locationLabel, latestControlValues.locationLabel, '确认前必须同步输入框中的最新库位')
assert.equal(latestFormState.scanCode, latestControlValues.scanCode, '确认前必须同步输入框中的最新菲票扫码值')

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

type FakeTimer = { callback: () => void; cancelled: boolean }
const fakeTimers: FakeTimer[] = []
const timerController = workflow.createPdaCuttingInboundScanTimerController(
  (callback) => {
    const timer = { callback, cancelled: false }
    fakeTimers.push(timer)
    return timer
  },
  (timer) => {
    ;(timer as FakeTimer).cancelled = true
  },
)
const timerEffects: string[] = []
timerController.schedule('TASK-1::bagging', () => {
  timerEffects.push('old-round')
})
const oldRoundTimer = fakeTimers.at(-1)!
timerController.schedule('TASK-1::bagging', () => {
  timerEffects.push('latest-round')
})
assert.equal(oldRoundTimer.cancelled, true, '同一状态键新扫码必须取消旧 timer')
oldRoundTimer.callback()
assert.deepEqual(timerEffects, [], '即使旧 timer 已进入队列，旧轮次回调也不得写入状态')
assert.equal(timerController.flush('TASK-1::bagging'), true, '确认前必须能同步冲刷 pending scan')
assert.deepEqual(timerEffects, ['latest-round'], '确认前必须同步完成最新一轮扫描')
fakeTimers.at(-1)!.callback()
assert.deepEqual(timerEffects, ['latest-round'], '同步冲刷后旧异步回调不得重复写入')
assert.equal(timerController.hasPending('TASK-1::bagging'), false, '同步冲刷后必须删除 pending timer')

timerController.schedule('TASK-1::bagging', () => {
  timerEffects.push('after-reset')
})
const resetTimer = fakeTimers.at(-1)!
timerController.cancel('TASK-1::bagging')
resetTimer.callback()
assert.deepEqual(timerEffects, ['latest-round'], '成功 reset 后的旧 timer 不得写回新一轮状态')

timerController.schedule('TASK-1::bagging', () => {
  timerEffects.push('after-route-leave')
})
const routeLeaveTimer = fakeTimers.at(-1)!
timerController.cancelAll()
routeLeaveTimer.callback()
assert.deepEqual(timerEffects, ['latest-round'], '模式或路由离开后的旧 timer 不得写回状态')

assert(
  source.includes("window.addEventListener('higood:pda-cutting-inbound-leave'"),
  '模式或路由离开时必须同步取消全部扫码 timer',
)

const initial = workflow.createPdaCuttingInboundFormState()
assert.equal(initial.lastTicketScanStatus, 'idle', '新一轮装袋必须从无扫码结果状态开始')
const outOfOrderScan = workflow.applyPdaCuttingInboundTicketScan(initial, {
  ticketNo: 'FT-000',
  pieceQty: 5,
  productionOrderNo: 'PO-001',
})
assert.equal(outOfOrderScan.ok, false, '未扫中转袋时不得提前加入菲票')
assert.equal(outOfOrderScan.state.lastTicketScanStatus, 'invalid', '扫码失败必须写入表单失败状态')
assert.deepEqual(outOfOrderScan.state.scannedTicketNos, [], '顺序错误时不得改变已扫菲票')

initial.carrierCode = 'BAG-001'
initial.scanCode = 'FT-001'

const firstScan = workflow.applyPdaCuttingInboundTicketScan(initial, {
  ticketNo: 'FT-001',
  pieceQty: 12,
  productionOrderNo: 'PO-001',
})
assert.equal(firstScan.ok, true, '有效菲票扫码后必须直接加入当前袋')
assert.equal(firstScan.state.lastTicketScanStatus, 'valid', '扫码成功必须覆盖表单中的旧失败状态')
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
const mockLedger = workflow.createPdaCuttingInboundMockLedger()
const lowercaseTicketLedger = workflow.createPdaCuttingInboundMockLedger(['ft-custom-001'])
assert.equal(
  lowercaseTicketLedger.tickets['FT-CUSTOM-001']?.ticketNo,
  'FT-CUSTOM-001',
  '自定义小写菲票必须按统一大写键和值进入台账',
)
const unknownScan = workflow.completePdaCuttingInboundTicketScan(unknownState, 'UNKNOWN-001', [], mockLedger)
assert.equal(unknownScan.ok, false, '未知菲票必须在扫描完成时失败')
assert.equal(unknownScan.state.lastTicketScanStatus, 'invalid', '未知菲票失败必须写入表单失败状态')
assert.equal(unknownScan.state.scanCode, '', '未知菲票失败后应清空输入，便于重扫')
assert.deepEqual(unknownScan.state.scannedTicketNos, ['FT-001', 'FT-002'], '未知菲票失败必须保留已扫数据')
assert.equal(unknownScan.state.scanFeedbackMessage, '没有找到这张菲票，请重新扫描。', '未知菲票短错误不正确')

const waitScan = workflow.completePdaCuttingInboundTicketScan(
  { ...secondScan.state, scanCode: 'WAIT-001' },
  'WAIT-001',
  [],
  mockLedger,
)
assert.equal(waitScan.ok, false, 'WAIT 菲票必须在扫描完成时失败')
assert.equal(waitScan.state.scanCode, '', 'WAIT 菲票失败后应清空输入')
assert.equal(waitScan.state.scanFeedbackMessage, '这张菲票未打印，请换一张。', 'WAIT 菲票短错误不正确')

const voidScan = workflow.completePdaCuttingInboundTicketScan(
  { ...secondScan.state, scanCode: 'VOID-001' },
  'VOID-001',
  [],
  mockLedger,
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
assert.equal(successfulBagging.lastTicketScanStatus, 'idle', '装袋成功进入新一轮后必须清空扫码结果状态')
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

const demoTicketNos = [
  'FT-CUT-260307-102-01-001',
  'FT-CUT-260307-102-01-002',
  'FT-CUT-260307-102-02-017',
]
for (const ticketNo of demoTicketNos) {
  assert.equal(mockLedger.tickets[ticketNo]?.status, 'READY_FOR_BAGGING', `当前页面候选菲票必须进入本地台账：${ticketNo}`)
}
assert.equal(mockLedger.bags['BAG-001']?.status, 'EMPTY_READY', '演示台账必须提供第一个空袋')
assert.equal(mockLedger.bags['BAG-002']?.status, 'EMPTY_READY', '演示台账必须提供第二个空袋支持连续装袋')

const knownTicketCandidate = buildTransferBagsProjection().viewModel.ticketCandidates
  .find((ticket) => ticket.ticketNo === demoTicketNos[0])!
assert(knownTicketCandidate, '测试前提：当前页面候选必须包含演示有效菲票')

const originalHtmlInputElement = (
  globalThis as typeof globalThis & { HTMLInputElement?: typeof HTMLInputElement }
).HTMLInputElement
const originalHtmlSelectElement = (
  globalThis as typeof globalThis & { HTMLSelectElement?: typeof HTMLSelectElement }
).HTMLSelectElement
const originalHtmlTextAreaElement = (
  globalThis as typeof globalThis & { HTMLTextAreaElement?: typeof HTMLTextAreaElement }
).HTMLTextAreaElement
class FakeInboundInputElement {
  value = ''
  dataset = {} as DOMStringMap
  closestHandler: (selector: string) => unknown = () => null

  closest(selector: string): unknown {
    return this.closestHandler(selector)
  }
}
;(globalThis as typeof globalThis & { HTMLInputElement: typeof HTMLInputElement }).HTMLInputElement =
  FakeInboundInputElement as unknown as typeof HTMLInputElement
;(globalThis as typeof globalThis & { HTMLSelectElement: typeof HTMLSelectElement }).HTMLSelectElement =
  class {} as typeof HTMLSelectElement
;(globalThis as typeof globalThis & { HTMLTextAreaElement: typeof HTMLTextAreaElement }).HTMLTextAreaElement =
  class {} as typeof HTMLTextAreaElement

const handleInboundEvent = workflow.handlePdaCuttingInboundEvent
const buildInboundConfirmHarness = (taskId: string, carrierCode: string) => {
  const liveRegion = { innerHTML: '' }
  const carrierInput = new FakeInboundInputElement()
  carrierInput.value = carrierCode
  carrierInput.dataset.pdaCutInboundField = 'carrierCode'
  const ticketInput = new FakeInboundInputElement()
  ticketInput.dataset.pdaCutInboundField = 'scanCode'
  const workflowContainer = {
    innerHTML: '',
    scrollTop: 287,
    querySelector(selector: string) {
      if (selector === '[data-pda-cut-inbound-field="carrierCode"]') return carrierInput
      if (selector === '[data-pda-cut-inbound-field="scanCode"]') return ticketInput
      if (selector === '[data-pda-cut-inbound-field="locationLabel"]') return null
      if (selector === '[data-pda-cut-inbound-live]') return liveRegion
      return null
    },
  }
  for (const input of [carrierInput, ticketInput]) {
    input.closestHandler = (selector) => {
      if (selector === '[data-pda-cut-inbound-field]') return input
      if (selector === '[data-pda-cutting-inbound-workflow]') return workflowContainer
      if (selector === '[data-task-id]') return { dataset: { taskId } }
      return null
    }
  }
  const actionNode = {
    dataset: { taskId, pdaCutInboundAction: 'confirm' },
    closest(selector: string) {
      if (selector === '[data-pda-cutting-inbound-workflow]') return workflowContainer
      return null
    },
  }
  const confirmTarget = {
    closest(selector: string) {
      if (selector === '[data-pda-cut-inbound-field]') return null
      if (selector === '[data-pda-cut-inbound-action="confirm"]') return actionNode
      return null
    },
  }
  return { workflowContainer, carrierInput, ticketInput, confirmTarget }
}

const successHarness = buildInboundConfirmHarness('TASK-CUT-PDA-CUT-DONE-0307', 'BAG-001')
assert.equal(
  handleInboundEvent(successHarness.carrierInput as unknown as HTMLElement, { type: 'input' } as Event),
  true,
  '局部刷新测试前必须写入袋码',
)
successHarness.ticketInput.value = demoTicketNos[0]
assert.equal(
  handleInboundEvent(
    successHarness.ticketInput as unknown as HTMLElement,
    { type: 'keydown', key: 'Enter' } as unknown as Event,
  ),
  true,
  '局部刷新测试前必须完成有效菲票扫描',
)
assert.equal(
  handleInboundEvent(successHarness.confirmTarget as unknown as HTMLElement),
  true,
  '确认装袋事件必须被处理',
)
assert(
  successHarness.workflowContainer.innerHTML.includes('装袋成功'),
  '确认装袋成功后必须立即在当前工作区显示结果',
)
assert.match(
  successHarness.workflowContainer.innerHTML,
  /data-pda-cut-inbound-field="carrierCode"[\s\S]*?value=""/,
  '确认装袋成功后局部工作区必须显示已清空的新一轮袋码',
)
assert.equal(successHarness.workflowContainer.scrollTop, 287, '局部刷新不得改变页面工作区滚动位置')

const failedHarness = buildInboundConfirmHarness('TASK-INBOUND-LOCAL-FAIL', 'BAG-002')
assert.equal(
  handleInboundEvent(failedHarness.confirmTarget as unknown as HTMLElement),
  true,
  '确认装袋失败事件必须被处理',
)
assert(
  failedHarness.workflowContainer.innerHTML.includes('请扫描菲票。'),
  '确认装袋失败后必须立即在当前工作区显示具体原因',
)
assert.match(
  failedHarness.workflowContainer.innerHTML,
  /data-pda-cut-inbound-field="carrierCode"[\s\S]*?value="BAG-002"/,
  '确认装袋失败后局部工作区必须保留袋码',
)
assert.equal(failedHarness.workflowContainer.scrollTop, 287, '失败反馈的局部刷新不得改变滚动位置')

if (originalHtmlInputElement) {
  ;(globalThis as typeof globalThis & { HTMLInputElement: typeof HTMLInputElement }).HTMLInputElement =
    originalHtmlInputElement
} else {
  delete (globalThis as typeof globalThis & { HTMLInputElement?: typeof HTMLInputElement }).HTMLInputElement
}
if (originalHtmlSelectElement) {
  ;(globalThis as typeof globalThis & { HTMLSelectElement: typeof HTMLSelectElement }).HTMLSelectElement =
    originalHtmlSelectElement
} else {
  delete (globalThis as typeof globalThis & { HTMLSelectElement?: typeof HTMLSelectElement }).HTMLSelectElement
}
if (originalHtmlTextAreaElement) {
  ;(globalThis as typeof globalThis & { HTMLTextAreaElement: typeof HTMLTextAreaElement }).HTMLTextAreaElement =
    originalHtmlTextAreaElement
} else {
  delete (globalThis as typeof globalThis & { HTMLTextAreaElement?: typeof HTMLTextAreaElement }).HTMLTextAreaElement
}
const existingValidTicketForm = {
  ...workflow.createPdaCuttingInboundFormState(),
  carrierCode: 'BAG-001',
  bagProductionOrderNo: 'PO-202603-0004',
  scannedTicketNos: [demoTicketNos[1]],
  inboundQty: '195',
  scanCode: 'UNKNOWN-PENDING-001',
}
const failedPendingScan = workflow.completePdaCuttingInboundTicketScan(
  existingValidTicketForm,
  existingValidTicketForm.scanCode,
  [],
  mockLedger,
)
assert.equal(failedPendingScan.ok, false, '测试前提：最后一张 pending 未知菲票必须扫码失败')
assert.equal(failedPendingScan.state.lastTicketScanStatus, 'invalid', 'Enter 完成失败扫码后必须写入表单失败状态')
const naturalTimers: FakeTimer[] = []
const naturalTimerController = workflow.createPdaCuttingInboundScanTimerController(
  (callback) => {
    const timer = { callback, cancelled: false }
    naturalTimers.push(timer)
    return timer
  },
  (timer) => {
    ;(timer as FakeTimer).cancelled = true
  },
)
const naturalStateKey = 'TASK-1::natural-timeout'
let naturalTimeoutForm = existingValidTicketForm
naturalTimerController.schedule(naturalStateKey, () => {
  naturalTimeoutForm = workflow.completePdaCuttingInboundTicketScan(
    naturalTimeoutForm,
    naturalTimeoutForm.scanCode,
    [],
    mockLedger,
  ).state
})
naturalTimers.at(-1)!.callback()
assert.equal(naturalTimerController.hasPending(naturalStateKey), false, '自然 timeout 后 pending timer 必须删除')
assert.equal(naturalTimeoutForm.lastTicketScanStatus, 'invalid', '自然 timeout 失败必须写回同一个表单状态')
const blockedNaturalConfirmation = workflow.confirmPdaCuttingInboundRound(
  naturalTimeoutForm,
  'bagging',
  mockLedger,
)
assert.equal(blockedNaturalConfirmation.result.ok, false, '自然 timeout 扫码失败后确认必须失败')
assert.equal(blockedNaturalConfirmation.nextForm.carrierCode, 'BAG-001', '自然 timeout 失败确认必须保留袋码')
assert.deepEqual(
  blockedNaturalConfirmation.nextForm.scannedTicketNos,
  [demoTicketNos[1]],
  '自然 timeout 失败确认必须保留已有有效票',
)
assert.deepEqual(blockedNaturalConfirmation.ledger, mockLedger, '自然 timeout 失败确认不得修改台账')

const confirmationTimer = workflow.createPdaCuttingInboundScanTimerController(
  (callback) => ({ callback }),
  () => undefined,
)
let flushedForm = existingValidTicketForm
confirmationTimer.schedule('TASK-1::confirm-pending', () => {
  flushedForm = workflow.completePdaCuttingInboundTicketScan(
    flushedForm,
    flushedForm.scanCode,
    [],
    mockLedger,
  ).state
})
assert.equal(confirmationTimer.flush('TASK-1::confirm-pending'), true, '确认编排测试必须真实冲刷 pending 扫码')
assert.equal(flushedForm.lastTicketScanStatus, 'invalid', '确认 flush 失败必须写回表单失败状态')
const blockedPendingConfirmation = workflow.confirmPdaCuttingInboundRound(
  flushedForm,
  'bagging',
  mockLedger,
)
assert.equal(blockedPendingConfirmation.result.ok, false, '最后一张 pending 菲票失败时本次确认必须失败')
assert.equal(blockedPendingConfirmation.nextForm.carrierCode, 'BAG-001', 'pending 扫码失败确认必须保留袋码')
assert.deepEqual(
  blockedPendingConfirmation.nextForm.scannedTicketNos,
  [demoTicketNos[1]],
  'pending 扫码失败确认必须保留此前已扫有效票',
)
assert.deepEqual(blockedPendingConfirmation.ledger, mockLedger, 'pending 扫码失败确认不得修改台账')

const successfulPendingScan = workflow.completePdaCuttingInboundTicketScan(
  { ...failedPendingScan.state, scanCode: demoTicketNos[0] },
  demoTicketNos[0],
  [knownTicketCandidate],
  mockLedger,
)
assert.equal(successfulPendingScan.ok, true, '测试前提：最后一张有效 pending 菲票必须扫码成功')
assert.equal(successfulPendingScan.state.lastTicketScanStatus, 'valid', '下一张有效菲票必须覆盖之前的失败状态')
const successfulPendingConfirmation = workflow.confirmPdaCuttingInboundRound(
  successfulPendingScan.state,
  'bagging',
  mockLedger,
)
assert.equal(successfulPendingConfirmation.result.ok, true, '最后一张 pending 菲票成功后必须允许确认装袋')
assert.deepEqual(
  successfulPendingConfirmation.ledger.bags['BAG-001'].ticketNos,
  [demoTicketNos[1], demoTicketNos[0]],
  'pending 成功后确认必须包含最后加入的菲票',
)

const noPendingConfirmation = workflow.confirmPdaCuttingInboundRound(
  { ...existingValidTicketForm, scanCode: '' },
  'bagging',
  mockLedger,
)
assert.equal(noPendingConfirmation.result.ok, true, '无 pending 且已有有效票时必须允许确认装袋')

const unknownLedgerTicket = workflow.completePdaCuttingInboundTicketScan(
  { ...workflow.createPdaCuttingInboundFormState(), carrierCode: 'BAG-001', scanCode: 'FT-BT-UNKNOWN-001' },
  'FT-BT-UNKNOWN-001',
  [{ ...knownTicketCandidate, ticketRecordId: 'FT-BT-UNKNOWN-001', feiTicketId: 'FT-BT-UNKNOWN-001', ticketNo: 'FT-BT-UNKNOWN-001' }],
  mockLedger,
)
assert.equal(unknownLedgerTicket.ok, false, '候选列表存在但本地台账不存在的菲票也必须阻断')
assert(unknownLedgerTicket.state.scanFeedbackMessage.includes('没有找到'), '台账不存在菲票必须提示未找到')

const voidLedger = structuredClone(mockLedger)
voidLedger.tickets[demoTicketNos[0]].status = 'VOIDED'
const voidLedgerTicket = workflow.completePdaCuttingInboundTicketScan(
  { ...workflow.createPdaCuttingInboundFormState(), carrierCode: 'BAG-001', scanCode: demoTicketNos[0] },
  demoTicketNos[0],
  [knownTicketCandidate],
  voidLedger,
)
assert.equal(voidLedgerTicket.ok, false, '本地台账已作废菲票必须阻断')
assert(voidLedgerTicket.state.scanFeedbackMessage.includes('已作废'), '台账已作废菲票提示错误')

const alreadyBaggedLedger = structuredClone(mockLedger)
alreadyBaggedLedger.tickets[demoTicketNos[0]].status = 'BAGGED'
const alreadyBaggedTicket = workflow.completePdaCuttingInboundTicketScan(
  { ...workflow.createPdaCuttingInboundFormState(), carrierCode: 'BAG-002', scanCode: demoTicketNos[0] },
  demoTicketNos[0],
  [knownTicketCandidate],
  alreadyBaggedLedger,
)
assert.equal(alreadyBaggedTicket.ok, false, '本地台账已装袋菲票必须阻断跨轮次重复')
assert(alreadyBaggedTicket.state.scanFeedbackMessage.includes('已装袋'), '跨轮次重复菲票提示错误')

const validBaggingState = {
  ...workflow.createPdaCuttingInboundFormState(),
  carrierCode: 'BAG-001',
  bagProductionOrderNo: 'PO-202603-0004',
  scannedTicketNos: [demoTicketNos[0]],
  inboundQty: '195',
}
const validBagging = workflow.applyPdaCuttingInboundBusinessTransition(validBaggingState, 'bagging', mockLedger)
assert.equal(validBagging.ok, true, '空袋和可装袋菲票必须允许确认装袋')
assert.equal(validBagging.ledger.bags['BAG-001'].status, 'BAGGED_WAIT_INBOUND', '装袋后袋状态必须变为已装袋待入仓')
assert.deepEqual(validBagging.ledger.bags['BAG-001'].ticketNos, [demoTicketNos[0]], '装袋后袋必须记录菲票')
assert.equal(validBagging.ledger.tickets[demoTicketNos[0]].status, 'BAGGED', '装袋后菲票状态必须变为已装袋')
assert.equal(validBagging.ledger.tickets[demoTicketNos[0]].bagCode, 'BAG-001', '装袋后菲票必须记录所属袋')
assert.equal(mockLedger.bags['BAG-001'].status, 'EMPTY_READY', '纯状态迁移不得修改传入台账')

const duplicateTicketBagging = workflow.applyPdaCuttingInboundBusinessTransition(
  {
    ...validBaggingState,
    scannedTicketNos: [demoTicketNos[0], demoTicketNos[0]],
  },
  'bagging',
  mockLedger,
)
assert.equal(duplicateTicketBagging.ok, false, '同一轮 scannedTicketNos 内重复菲票必须阻断装袋')
assert.deepEqual(duplicateTicketBagging.ledger, mockLedger, '同轮重复菲票失败不得修改台账')

const missingBag = workflow.applyPdaCuttingInboundBusinessTransition(
  { ...validBaggingState, carrierCode: 'BAG-NOT-FOUND' },
  'bagging',
  mockLedger,
)
assert.equal(missingBag.ok, false, '不存在的中转袋不得装袋')
assert(missingBag.message?.includes('不存在'), '不存在袋码提示错误')

for (const bagCode of ['BAG-WAIT-001', 'BAG-IN-001', 'BAG-HAND-001', 'BAG-VOID-001']) {
  const invalidBagStatus = workflow.applyPdaCuttingInboundBusinessTransition(
    { ...validBaggingState, carrierCode: bagCode },
    'bagging',
    mockLedger,
  )
  assert.equal(invalidBagStatus.ok, false, `${bagCode} 非空袋可装袋状态，不得再次装袋`)
}

const voidTicketConfirmLedger = structuredClone(mockLedger)
voidTicketConfirmLedger.tickets[demoTicketNos[0]].status = 'VOIDED'
assert.equal(
  workflow.applyPdaCuttingInboundBusinessTransition(validBaggingState, 'bagging', voidTicketConfirmLedger).ok,
  false,
  '确认装袋时必须再次阻断已作废菲票',
)
assert.equal(
  workflow.applyPdaCuttingInboundBusinessTransition(validBaggingState, 'bagging', alreadyBaggedLedger).ok,
  false,
  '确认装袋时必须再次阻断已装袋菲票',
)

const secondRoundState = {
  ...workflow.createPdaCuttingInboundFormState(),
  carrierCode: 'BAG-002',
  bagProductionOrderNo: 'PO-202603-0004',
  scannedTicketNos: [demoTicketNos[1]],
  inboundQty: '195',
}
const secondBagging = workflow.applyPdaCuttingInboundBusinessTransition(
  secondRoundState,
  'bagging',
  validBagging.ledger,
)
assert.equal(secondBagging.ok, true, '首轮成功后必须允许用第二个空袋继续装另一张票')
assert.equal(secondBagging.ledger.bags['BAG-002'].status, 'BAGGED_WAIT_INBOUND', '第二轮有效装袋状态迁移错误')

const crossRoundRepeat = workflow.completePdaCuttingInboundTicketScan(
  { ...workflow.createPdaCuttingInboundFormState(), carrierCode: 'BAG-002', scanCode: demoTicketNos[0] },
  demoTicketNos[0],
  [knownTicketCandidate],
  validBagging.ledger,
)
assert.equal(crossRoundRepeat.ok, false, '首轮已装袋菲票不得在新一轮再次加入')

const emptyBagInbound = workflow.applyPdaCuttingInboundBusinessTransition(
  { ...workflow.createPdaCuttingInboundFormState(), carrierCode: 'BAG-002', locationLabel: 'CUT-A-01' },
  'inbound-location',
  mockLedger,
)
assert.equal(emptyBagInbound.ok, false, '空袋不得入仓')

for (const [locationLabel, message] of [
  ['CUT-NOT-FOUND', '不存在库位'],
  ['CUT-X-99', '停用库位'],
  ['SEW-A-01', '非裁床库位'],
] as const) {
  const invalidLocation = workflow.applyPdaCuttingInboundBusinessTransition(
    { ...workflow.createPdaCuttingInboundFormState(), carrierCode: 'BAG-WAIT-001', locationLabel },
    'inbound-location',
    mockLedger,
  )
  assert.equal(invalidLocation.ok, false, `${message}必须阻断入仓`)
}

const validInboundState = {
  ...workflow.createPdaCuttingInboundFormState(),
  carrierCode: 'BAG-WAIT-001',
  locationLabel: 'CUT-A-01',
}
const validInbound = workflow.applyPdaCuttingInboundBusinessTransition(
  validInboundState,
  'inbound-location',
  mockLedger,
)
assert.equal(validInbound.ok, true, '已装袋待入仓中转袋和有效裁床库位必须允许入仓')
assert.equal(validInbound.ledger.bags['BAG-WAIT-001'].status, 'INBOUNDED', '入仓后袋状态必须变为已入仓')
assert.equal(validInbound.ledger.bags['BAG-WAIT-001'].locationLabel, 'CUT-A-01', '入仓后袋必须记录库位')

const repeatedInbound = workflow.applyPdaCuttingInboundBusinessTransition(
  validInboundState,
  'inbound-location',
  validInbound.ledger,
)
assert.equal(repeatedInbound.ok, false, '同一中转袋不得重复入仓')
assert(repeatedInbound.message?.includes('已入仓'), '重复入仓提示错误')

for (const bagCode of ['BAG-IN-001', 'BAG-HAND-001', 'BAG-VOID-001']) {
  const invalidInboundBag = workflow.applyPdaCuttingInboundBusinessTransition(
    { ...validInboundState, carrierCode: bagCode },
    'inbound-location',
    mockLedger,
  )
  assert.equal(invalidInboundBag.ok, false, `${bagCode} 不得入仓`)
}

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

const inboundMainBranchStart = mainSource.indexOf(
  "const pdaCutInboundActionNode = target.closest<HTMLElement>('[data-pda-cut-inbound-action]')",
)
const inboundMainBranchEnd = mainSource.indexOf(
  "const pdaCutHandoverActionNode = target.closest<HTMLElement>('[data-pda-cut-handover-action]')",
  inboundMainBranchStart,
)
const inboundMainBranch = mainSource.slice(inboundMainBranchStart, inboundMainBranchEnd)
const inboundLocalReturnIndex = inboundMainBranch.indexOf(
  "pdaCutInboundActionNode.dataset.pdaCutInboundAction === 'confirm'",
)
const inboundFullRenderIndex = inboundMainBranch.indexOf('await renderWithFocusRestore(focusSnapshot)')
assert(inboundLocalReturnIndex >= 0, 'main 必须识别确认装袋/入仓专用 action 的局部刷新路径')
assert(
  inboundFullRenderIndex === -1 || inboundLocalReturnIndex < inboundFullRenderIndex,
  '确认装袋/入仓专用 action 必须在整页渲染前直接返回',
)

console.log('[check-pda-cutting-inbound-workflow] 两种 PDA 扫码工作流检查通过')
