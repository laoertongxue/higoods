import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const pageSource = readFileSync(`${ROOT}/src/pages/pda-cutting-handover.ts`, 'utf8')
const handlerSource = readFileSync(`${ROOT}/src/main-handlers/pda-handlers.ts`, 'utf8')
const mainSource = readFileSync(`${ROOT}/src/main.ts`, 'utf8')
const routeLeaveSource = readFileSync(`${ROOT}/src/state/pda-cutting-navigation-cleanup.ts`, 'utf8')
const storeSource = readFileSync(`${ROOT}/src/state/store.ts`, 'utf8')
const pdaShellSource = readFileSync(`${ROOT}/src/pages/pda-shell.ts`, 'utf8')
const waitHandoverSource = readFileSync(`${ROOT}/src/pages/pda-warehouse-wait-handover.ts`, 'utf8')
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
  productionOrderNo: string
  status: '待交出' | '已交出' | '已作废' | '空袋'
  boundSewingTaskNo?: string
}

type SewingTaskCandidate = {
  sewingTaskNo: string
  productionOrderNo: string
  receiverFactoryName: string
  receivableStatus: '可接收' | '不可接收'
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
  submitPdaTransferBagHandoverRound: (
    state: TransferBagState,
    candidates: {
      bags: TransferBagCandidate[]
      sewingTasks: SewingTaskCandidate[]
    },
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
  'submitPdaTransferBagHandoverRound',
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
    { bagCode: 'TB-CUT-001', ticketCount: 12, productionOrderNo: 'PO-001', status: '待交出' as const },
    { bagCode: 'TB-CUT-CROSS', ticketCount: 9, productionOrderNo: 'PO-002', status: '待交出' as const },
    { bagCode: 'TB-CUT-DONE', ticketCount: 10, productionOrderNo: 'PO-001', status: '已交出' as const, boundSewingTaskNo: 'SEW-001' },
    { bagCode: 'TB-CUT-VOID', ticketCount: 7, productionOrderNo: 'PO-001', status: '已作废' as const },
    { bagCode: 'TB-CUT-BOUND', ticketCount: 8, productionOrderNo: 'PO-002', status: '待交出' as const, boundSewingTaskNo: 'SEW-002' },
  ],
  sewingTasks: [
    { sewingTaskNo: 'SEW-001', productionOrderNo: 'PO-001', receiverFactoryName: '印尼一厂', receivableStatus: '可接收' as const },
    { sewingTaskNo: 'SEW-002', productionOrderNo: 'PO-002', receiverFactoryName: '印尼二厂', receivableStatus: '可接收' as const },
    { sewingTaskNo: 'SEW-CLOSED', productionOrderNo: 'PO-001', receiverFactoryName: '印尼一厂', receivableStatus: '不可接收' as const },
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

const invalidStatusBag = workflow.completePdaTransferBagHandoverScan(
  initial,
  'bagCode',
  'TB-CUT-DONE',
  candidates,
)
assert.equal(invalidStatusBag.ok, false, '已交出袋不得再次进入交出轮次')
assert.equal(invalidStatusBag.state.bagCode, '', '无效袋状态不得写入有效扫码数据')
assert(invalidStatusBag.state.scanFeedbackMessage.includes('已交出'), '袋状态失败必须即时说明原因')

const voidBag = workflow.completePdaTransferBagHandoverScan(
  initial,
  'bagCode',
  'TB-CUT-VOID',
  candidates,
)
assert.equal(voidBag.ok, false, '已作废袋不得交出')

const closedTask = workflow.completePdaTransferBagHandoverScan(
  bagScan.state,
  'sewingTaskCode',
  'SEW-CLOSED',
  candidates,
)
assert.equal(closedTask.ok, false, '不可接收车缝任务必须即时阻断')
assert.equal(closedTask.state.bagCode, 'TB-CUT-001', '任务状态失败必须保留有效袋码')
assert.equal(closedTask.state.sewingTaskNo, '', '不可接收任务不得生成派生信息')

const crossPoBag = workflow.completePdaTransferBagHandoverScan(
  initial,
  'bagCode',
  'TB-CUT-CROSS',
  candidates,
)
const crossPoTask = workflow.completePdaTransferBagHandoverScan(
  crossPoBag.state,
  'sewingTaskCode',
  'SEW-001',
  candidates,
)
assert.equal(crossPoTask.ok, false, '袋与车缝任务生产单不一致必须阻断')
assert.equal(crossPoTask.state.bagCode, 'TB-CUT-CROSS', '跨生产单失败必须保留有效袋码')
assert.equal(crossPoTask.state.sewingTaskNo, '', '跨生产单失败不得写入任务')
assert(crossPoTask.state.scanFeedbackMessage.includes('生产单不一致'), '跨生产单必须即时说明原因')

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

const submissionCandidates = structuredClone(candidates)
const submittedRound = workflow.submitPdaTransferBagHandoverRound(taskScan.state, submissionCandidates)
assert.equal(submittedRound.resultMessage, '交出成功', '本地 Mock 提交成功提示不正确')
const submittedBag = submissionCandidates.bags.find((item) => item.bagCode === 'TB-CUT-001')!
assert.equal(submittedBag.status, '已交出', '成功后必须把本页袋状态置为已交出')
assert.equal(submittedBag.boundSewingTaskNo, 'SEW-001', '成功后必须记录整袋唯一车缝任务')
const duplicateBagScan = workflow.completePdaTransferBagHandoverScan(
  workflow.createPdaTransferBagHandoverFormState(),
  'bagCode',
  'TB-CUT-001',
  submissionCandidates,
)
assert.equal(duplicateBagScan.ok, false, '成功后再次扫描同袋必须阻断重复交出')
assert(duplicateBagScan.state.scanFeedbackMessage.includes('已交出'), '重复交出必须即时提示袋已交出')
const duplicateConfirm = workflow.submitPdaTransferBagHandoverRound(taskScan.state, submissionCandidates)
assert.equal(duplicateConfirm.bagCode, 'TB-CUT-001', '重复确认失败必须保留原袋码')
assert.equal(duplicateConfirm.sewingTaskNo, 'SEW-001', '重复确认失败必须保留原任务')
assert(duplicateConfirm.resultMessage.includes('已交出'), '重复确认必须明确提示已交出')

const html = workflow.renderPdaTransferBagHandoverWorkflow(taskScan.state, 'CUT-001')
assert.equal((html.match(/<button\b/g) || []).length, 1, '页面只能有一个主要按钮')
assert(html.includes('1 扫中转袋'), '第一步必须是扫中转袋')
assert(html.includes('2 扫车缝任务'), '第二步必须是扫车缝任务')
assert(html.includes('3 确认交出'), '第三步必须是确认交出')
assert(html.includes('data-pda-cut-handover-field="bagCode"'), '必须提供袋码扫码输入')
assert(html.includes('data-pda-cut-handover-field="sewingTaskCode"'), '必须提供车缝任务扫码输入')
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
const confirmRoundIndex = pageSource.indexOf('submitPdaTransferBagHandoverRound(', confirmBranchStart)
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
assert(
  mainSource.includes(
    "import { resolvePdaCuttingScanKeydownTarget } from './main-handlers/pda-cutting-keydown-routing'",
  ),
  'main 必须复用可执行测试的扫码 keydown 路由 helper',
)
const keydownRoutingModule = await import('../src/main-handlers/pda-cutting-keydown-routing.ts')
const buildFakeKeydownTarget = (field: string) => {
  const matchedTarget = { field }
  return {
    matchedTarget,
    target: {
      closest(selector: string) {
        return selector.includes(`="${field}"`) ? matchedTarget : null
      },
    },
  }
}
const bagKeydown = buildFakeKeydownTarget('bagCode')
assert.equal(
  keydownRoutingModule.resolvePdaCuttingScanKeydownTarget(bagKeydown.target, 'Enter'),
  bagKeydown.matchedTarget,
  '袋码 Enter 必须实际解析为待派发 target',
)
const taskKeydown = buildFakeKeydownTarget('sewingTaskCode')
assert.equal(
  keydownRoutingModule.resolvePdaCuttingScanKeydownTarget(taskKeydown.target, 'Enter'),
  taskKeydown.matchedTarget,
  '车缝任务 Enter 必须实际解析为待派发 target',
)
assert.equal(
  keydownRoutingModule.resolvePdaCuttingScanKeydownTarget(bagKeydown.target, 'A'),
  null,
  '非 Enter 不得派发交出扫码',
)
const specialCraftKeydown = buildFakeKeydownTarget('specialCraftBagScan')
assert.equal(
  keydownRoutingModule.resolvePdaCuttingScanKeydownTarget(specialCraftKeydown.target, 'Enter'),
  null,
  '特殊工艺字段不得进入整袋交出 Enter 派发',
)
const globalKeydownStart = mainSource.indexOf("document.addEventListener('keydown'")
const globalHandoverScanIndex = mainSource.indexOf('resolvePdaCuttingScanKeydownTarget<HTMLElement>(', globalKeydownStart)
const globalDispatchIndex = mainSource.indexOf('dispatchPageEvent(cuttingScanTarget, event)', globalHandoverScanIndex)
assert(globalHandoverScanIndex > globalKeydownStart, '全局 Enter 必须接入中转袋交出扫码框')
assert(globalDispatchIndex > globalHandoverScanIndex, '全局 Enter 必须实际调用交出 handler')

const handoverLeaveDispatchToken =
  "dispatchEvent(new Event('higood:pda-cutting-handover-leave'))"
assert(routeLeaveSource.includes(handoverLeaveDispatchToken), '导航离开中转袋交出路由时必须实际 dispatch 清理事件')
assert(
  storeSource.includes(
    "import { notifyPdaCuttingHandoverRouteLeave } from './pda-cutting-navigation-cleanup'",
  ),
  '统一 appStore 导航边界必须复用可执行测试的交出路由离开 helper',
)
assert(
  (storeSource.match(/notifyPdaCuttingHandoverRouteLeave\(/g) || []).length >= 2,
  'appStore.navigate 和 syncFromBrowser 都必须触发交出路由离开检查',
)
const routeLeaveModule = await import('../src/state/pda-cutting-navigation-cleanup.ts')
const dispatchedLeaveEvents: string[] = []
for (const [entryName, nextPathname] of [
  ['main 导航', '/fcs/pda/warehouse/wait-handover?scope=cutting'],
  ['PDA 顶部待办', '/fcs/pda/notify'],
  ['PDA 退出登录', '/fcs/pda/auth/login'],
  ['浏览器前进后退', '/fcs/pda/cutting/inbound/CUT-001'],
] as const) {
  assert.equal(
    routeLeaveModule.notifyPdaCuttingHandoverRouteLeave(
      '/fcs/pda/cutting/handover/CUT-001?action=transfer-bag-handover',
      nextPathname,
      (event: Event) => dispatchedLeaveEvents.push(event.type),
    ),
    true,
    `${entryName} 离开交出路由时必须返回已清理`,
  )
}
assert.deepEqual(
  dispatchedLeaveEvents,
  Array.from({ length: 4 }, () => 'higood:pda-cutting-handover-leave'),
  'main、PDA 待办、退出和 popstate 离开时都必须 dispatch timer 清理事件',
)
assert.equal(
  routeLeaveModule.notifyPdaCuttingHandoverRouteLeave(
    '/fcs/pda/cutting/handover/CUT-001?action=transfer-bag-handover',
    '/fcs/pda/cutting/handover/CUT-001?action=transfer-bag-handover',
    (event: Event) => dispatchedLeaveEvents.push(event.type),
  ),
  false,
  '留在同一路由不得误清理当前扫描',
)
assert.equal(dispatchedLeaveEvents.length, 4, '同一路由不得重复 dispatch 清理事件')
assert(mainSource.includes('appStore.navigate(pathname)'), 'main 导航必须经过统一 appStore 边界')
assert(mainSource.includes('appStore.syncFromBrowser(pathname)'), 'popstate 必须经过统一 appStore 边界')
assert(
  pdaShellSource.includes("appStore.navigate('/fcs/pda/auth/login', { historyMode: 'replace' })"),
  'PDA 退出登录必须经过统一 appStore 边界',
)
assert(
  pdaShellSource.includes('appStore.navigate(actionNode.dataset.href)'),
  'PDA 顶部待办跳转必须经过统一 appStore 边界',
)
assert(
  waitHandoverSource.includes('扫描中转袋和车缝任务，确认整袋交出'),
  '待交出仓入口说明必须使用整袋交出口径',
)
assert(
  !waitHandoverSource.includes('按车缝任务扫描中转袋和菲票，确认装袋并形成交出记录。'),
  '待交出仓入口不得保留逐菲票装袋旧说明',
)

console.log('[check-pda-cutting-transfer-bag-handover] 中转袋整袋交出工作流检查通过')
