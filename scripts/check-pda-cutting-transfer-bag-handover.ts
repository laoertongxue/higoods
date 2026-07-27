import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const pageSource = readFileSync(`${ROOT}/src/pages/pda-cutting-handover.ts`, 'utf8')
const handlerSource = readFileSync(`${ROOT}/src/main-handlers/pda-handlers.ts`, 'utf8')
const pageModule = await import('../src/pages/pda-cutting-handover.ts') as Record<string, unknown>

type TransferBagState = {
  bagCode: string
  sewingTaskCode: string
  sewingTaskNo: string
  productionOrderNo: string
  receiverFactoryName: string
  ticketCount: number | null
  scanFeedbackMessage: string
  resultMessage: string
}

type TransferBagCandidate = {
  bagCode: string
  ticketCount: number
  boundSewingTaskNo?: string
}

type SewingTaskCandidate = {
  sewingTaskNo: string
  productionOrderNo: string
  receiverFactoryName: string
}

type WorkflowModule = {
  PDA_CUTTING_TRANSFER_BAG_SCAN_DEBOUNCE_MS: number
  createPdaTransferBagHandoverFormState: () => TransferBagState
  resolvePdaTransferBagHandoverScanTrigger: (
    event: { type: string; key?: string },
  ) => 'immediate' | 'debounced' | 'none'
  completePdaTransferBagHandoverScan: (
    state: TransferBagState,
    field: 'bagCode' | 'sewingTaskCode',
    scanCode: string,
    candidates: {
      bags: TransferBagCandidate[]
      sewingTasks: SewingTaskCandidate[]
    },
  ) => { ok: boolean; state: TransferBagState }
  completePdaTransferBagHandoverRound: (
    state: TransferBagState,
    result: { ok: boolean; message?: string },
  ) => TransferBagState
  renderPdaTransferBagHandoverWorkflow: (state: TransferBagState, taskId?: string) => string
  createPdaTransferBagHandoverScanTimerController: (
    scheduleTimer: (callback: () => void, delayMs: number) => unknown,
    cancelTimer: (timer: unknown) => void,
  ) => {
    schedule: (stateKey: string, callback: () => void) => void
    flush: (stateKey: string) => boolean
    cancel: (stateKey: string) => void
    cancelAll: () => void
    hasPending: (stateKey: string) => boolean
  }
}

for (const exportName of [
  'createPdaTransferBagHandoverFormState',
  'resolvePdaTransferBagHandoverScanTrigger',
  'completePdaTransferBagHandoverScan',
  'completePdaTransferBagHandoverRound',
  'renderPdaTransferBagHandoverWorkflow',
  'createPdaTransferBagHandoverScanTimerController',
]) {
  assert.equal(typeof pageModule[exportName], 'function', `中转袋交出页必须导出 ${exportName}`)
}

const workflow = pageModule as unknown as WorkflowModule
assert.equal(workflow.PDA_CUTTING_TRANSFER_BAG_SCAN_DEBOUNCE_MS, 150, '扫码停顿应为约 150ms')
assert.equal(
  workflow.resolvePdaTransferBagHandoverScanTrigger({ type: 'keydown', key: 'Enter' }),
  'immediate',
  'Enter 必须立即完成扫描',
)
assert.equal(
  workflow.resolvePdaTransferBagHandoverScanTrigger({ type: 'input' }),
  'debounced',
  '普通输入必须在停顿后完成扫描',
)
assert.equal(
  workflow.resolvePdaTransferBagHandoverScanTrigger({ type: 'keydown', key: 'A' }),
  'none',
  '非 Enter 按键不得完成扫描',
)

const candidates = {
  bags: [
    { bagCode: 'TB-CUT-001', ticketCount: 12 },
    { bagCode: 'TB-CUT-BOUND', ticketCount: 8, boundSewingTaskNo: 'SEW-002' },
  ],
  sewingTasks: [
    { sewingTaskNo: 'SEW-001', productionOrderNo: 'PO-001', receiverFactoryName: '印尼一厂' },
    { sewingTaskNo: 'SEW-002', productionOrderNo: 'PO-002', receiverFactoryName: '印尼二厂' },
  ],
}

const initial = workflow.createPdaTransferBagHandoverFormState()
const taskBeforeBag = workflow.completePdaTransferBagHandoverScan(
  initial,
  'sewingTaskCode',
  'SEW-001',
  candidates,
)
assert.equal(taskBeforeBag.ok, false, '必须先扫中转袋再扫车缝任务')
assert.equal(taskBeforeBag.state.bagCode, '', '顺序错误不得改变有效状态')

const bagScan = workflow.completePdaTransferBagHandoverScan(
  initial,
  'bagCode',
  'TB-CUT-001',
  candidates,
)
assert.equal(bagScan.ok, true, '有效中转袋必须扫码成功')
assert.equal(bagScan.state.bagCode, 'TB-CUT-001', '袋码必须保留')
assert.equal(bagScan.state.ticketCount, 12, '袋内菲票数量必须只读带出')

const taskScan = workflow.completePdaTransferBagHandoverScan(
  bagScan.state,
  'sewingTaskCode',
  'SEW-001',
  candidates,
)
assert.equal(taskScan.ok, true, '有效车缝任务必须扫码成功')
assert.equal(taskScan.state.sewingTaskNo, 'SEW-001', '车缝任务号必须带出')
assert.equal(taskScan.state.productionOrderNo, 'PO-001', '生产单号必须由车缝任务带出')
assert.equal(taskScan.state.receiverFactoryName, '印尼一厂', '接收工厂必须由车缝任务带出')

const otherTaskScan = workflow.completePdaTransferBagHandoverScan(
  taskScan.state,
  'sewingTaskCode',
  'SEW-002',
  candidates,
)
assert.equal(otherTaskScan.ok, false, '一个袋不得绑定多个车缝任务')
assert.equal(otherTaskScan.state.sewingTaskNo, 'SEW-001', '换绑失败必须保留已扫有效任务')
assert.equal(otherTaskScan.state.receiverFactoryName, '印尼一厂', '换绑失败必须保留派生工厂')

const preBoundBag = workflow.completePdaTransferBagHandoverScan(
  initial,
  'bagCode',
  'TB-CUT-BOUND',
  candidates,
)
const wrongBoundTask = workflow.completePdaTransferBagHandoverScan(
  preBoundBag.state,
  'sewingTaskCode',
  'SEW-001',
  candidates,
)
assert.equal(wrongBoundTask.ok, false, '已绑定袋不得交给其他车缝任务')
assert.equal(wrongBoundTask.state.bagCode, 'TB-CUT-BOUND', '失败必须保留有效袋码')

const unknownTask = workflow.completePdaTransferBagHandoverScan(
  bagScan.state,
  'sewingTaskCode',
  'UNKNOWN',
  candidates,
)
assert.equal(unknownTask.ok, false, '未知任务必须立即失败')
assert.equal(unknownTask.state.bagCode, 'TB-CUT-001', '扫码失败必须保留已扫袋码')
assert.equal(unknownTask.state.sewingTaskNo, '', '未知任务不得生成派生信息')

const failedRound = workflow.completePdaTransferBagHandoverRound(taskScan.state, {
  ok: false,
  message: '交出失败，请重试。',
})
assert.equal(failedRound.bagCode, 'TB-CUT-001', '交出失败必须保留袋码')
assert.equal(failedRound.sewingTaskNo, 'SEW-001', '交出失败必须保留任务码')
assert.equal(failedRound.productionOrderNo, 'PO-001', '交出失败必须保留派生信息')
assert.equal(failedRound.resultMessage, '交出失败，请重试。', '交出失败必须即时提示')

const successfulRound = workflow.completePdaTransferBagHandoverRound(taskScan.state, { ok: true })
assert.equal(successfulRound.resultMessage, '交出成功', '成功提示必须精确为“交出成功”')
assert.equal(successfulRound.bagCode, '', '交出成功必须清空袋码')
assert.equal(successfulRound.sewingTaskCode, '', '交出成功必须清空任务码')
assert.equal(successfulRound.productionOrderNo, '', '交出成功必须清空派生信息')
assert.equal(successfulRound.receiverFactoryName, '', '交出成功必须清空接收工厂')

const html = workflow.renderPdaTransferBagHandoverWorkflow(taskScan.state, 'CUT-001')
assert.equal((html.match(/<button\b/g) || []).length, 1, '页面只能有一个主要按钮')
assert(html.includes('1 扫中转袋'), '第一步必须是扫中转袋')
assert(html.includes('2 扫车缝任务'), '第二步必须是扫车缝任务')
assert(html.includes('3 确认交出'), '第三步必须是确认交出')
assert(html.includes('data-pda-cut-handover-field="transferBagCode"'), '必须提供袋码扫码输入')
assert(html.includes('data-pda-cut-handover-field="transferBagSewingTaskCode"'), '必须提供车缝任务扫码输入')
assert(html.includes('生产单号'), '必须显示车缝任务派生的生产单号')
assert(html.includes('接收工厂'), '必须显示车缝任务派生的接收工厂')
assert(!html.includes('<select'), '不得让员工选择工厂')
assert(!html.includes('type="number"'), '不得输入交出数量或部分数量')
for (const forbiddenText of ['扫菲票', '来源袋', '目标袋', '交出装袋确认', '当前情况', '最近记录', '说明流程']) {
  assert(!html.includes(forbiddenText), `新模式不得显示“${forbiddenText}”`)
}

type FakeTimer = { callback: () => void; cancelled: boolean }
const fakeTimers: FakeTimer[] = []
const timerController = workflow.createPdaTransferBagHandoverScanTimerController(
  (callback) => {
    const timer = { callback, cancelled: false }
    fakeTimers.push(timer)
    return timer
  },
  (timer) => {
    ;(timer as FakeTimer).cancelled = true
  },
)
const effects: string[] = []
timerController.schedule('CUT-001::transfer', () => effects.push('old'))
const oldTimer = fakeTimers.at(-1)!
timerController.schedule('CUT-001::transfer', () => effects.push('latest'))
assert.equal(oldTimer.cancelled, true, '同一状态键新扫码必须取消旧 timer')
oldTimer.callback()
assert.deepEqual(effects, [], '旧轮次回调不得写入当前状态')
assert.equal(timerController.flush('CUT-001::transfer'), true, '确认前必须能冲刷最新 pending scan')
assert.deepEqual(effects, ['latest'], '确认必须使用最新扫描结果')
fakeTimers.at(-1)!.callback()
assert.deepEqual(effects, ['latest'], '冲刷后的旧异步回调不得重复写入')
timerController.schedule('CUT-001::transfer', () => effects.push('after-reset'))
const resetTimer = fakeTimers.at(-1)!
timerController.cancel('CUT-001::transfer')
resetTimer.callback()
assert.deepEqual(effects, ['latest'], '成功 reset 后旧 timer 不得污染新一轮')

const transferModeStart = pageSource.indexOf("if (isTransferBagHandoverAction)")
assert(transferModeStart >= 0, '新 action 必须使用隔离的 transfer-bag-handover 渲染分支')
const confirmBranchStart = pageSource.indexOf("if (action === 'confirm-transfer-bag-handover')")
const confirmFlushIndex = pageSource.indexOf('transferBagScanTimerController.flush(', confirmBranchStart)
const confirmRoundIndex = pageSource.indexOf('completePdaTransferBagHandoverRound(', confirmBranchStart)
assert(confirmFlushIndex > confirmBranchStart, '确认交出前必须同步冲刷 pending scan')
assert(confirmFlushIndex < confirmRoundIndex, '最新扫描必须先于确认结果计算')
assert(
  pageSource.includes("window.addEventListener('higood:pda-cutting-handover-leave'"),
  '离开模式或路由时必须取消 pending timer',
)
assert(
  handlerSource.includes('handlePdaCuttingHandoverEvent(target, event)'),
  'PDA 事件分发必须把 Enter/input 事件传给中转袋交出 handler',
)

console.log('[check-pda-cutting-transfer-bag-handover] 中转袋整袋交出工作流检查通过')
