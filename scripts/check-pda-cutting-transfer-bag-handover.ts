import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { BrowserStorageLike } from '../src/data/browser-storage.ts'
import {
  appendCuttingRuntimeEvent,
  listCuttingRuntimeEvents,
  type TransferBagTicketFactSnapshot,
} from '../src/data/fcs/cutting/cutting-runtime-event-ledger.ts'
import { resolveTransferBagCurrentUse } from '../src/data/fcs/cutting/transfer-bag-operations.ts'
import { appendWaitHandoverInboundEvent } from '../src/pages/process-factory/cutting/wait-handover-runtime.ts'
import {
  createPdaTransferBagHandoverFormState,
  createPdaTransferBagHandoverScanTimerController,
  PDA_CUTTING_TRANSFER_BAG_SCAN_DEBOUNCE_MS,
  renderPdaTransferBagHandoverWorkflow,
  normalizePdaCuttingHandoverAction,
  resolvePdaTransferBagHandoverScanTrigger,
  scanPdaTransferBagForHandover,
  submitPdaTransferBagHandover,
} from '../src/pages/pda-cutting-handover.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const pageSource = readFileSync(`${ROOT}/src/pages/pda-cutting-handover.ts`, 'utf8')
const keydownSource = readFileSync(`${ROOT}/src/main-handlers/pda-cutting-keydown-routing.ts`, 'utf8')

for (const removedSingleTaskPath of [
  'PdaTransferBagHandoverCandidates',
  'boundSewingTaskNo',
  'sewingTaskCode',
  'completePdaTransferBagHandoverScan',
  'submitPdaTransferBagHandoverRound',
  'appendPdaTransferBagHandoverRuntimeEvent',
]) {
  assert(!pageSource.includes(removedSingleTaskPath), `PDA 交出源码不得保留旧单任务写路径：${removedSingleTaskPath}`)
}

function memoryStorage(): BrowserStorageLike {
  const records = new Map<string, string>()
  return {
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
    removeItem: (key) => records.delete(key),
  }
}

function ticket(
  id: string,
  sewingTaskNo: string,
  receiverFactoryId = 'FACTORY-SAME',
  receiverFactoryName = '车缝工厂甲',
): TransferBagTicketFactSnapshot {
  return {
    feiTicketId: id,
    feiTicketNo: `FT-${id}`,
    productionOrderId: 'PO-ID-HANDOVER',
    productionOrderNo: 'PO-HANDOVER',
    cutOrderId: `CUT-${id}`,
    cutOrderNo: `CUT-${id}`,
    color: '黑色',
    size: 'M',
    partCode: id.endsWith('1') ? 'FRONT' : 'BACK',
    partName: id.endsWith('1') ? '前幅' : '后幅',
    pieceQty: id.endsWith('1') ? 12 : 8,
    sewingTaskId: `ID-${sewingTaskNo}`,
    sewingTaskNo,
    receiverFactoryId,
    receiverFactoryName,
  }
}

function addBag(
  storage: BrowserStorageLike,
  bagCode: string,
  tickets: TransferBagTicketFactSnapshot[],
  inbound = true,
): void {
  appendCuttingRuntimeEvent({
    eventType: '菲票装袋',
    eventSource: 'PDA',
    eventStatus: '已同步',
    occurredAt: '2026-08-03 10:00',
    operatorName: '专项检查装袋员',
    refs: {
      transferBagCode: bagCode,
      usageCycleId: `usage:${bagCode}:1`,
      productionOrderId: tickets[0].productionOrderId,
      productionOrderNo: tickets[0].productionOrderNo,
      feiTicketIds: tickets.map((item) => item.feiTicketId),
      feiTicketNos: tickets.map((item) => item.feiTicketNo),
    },
    payload: {
      baggingRecordId: `bagging:${bagCode}`,
      bagCode,
      feiTicketItems: tickets,
      totalPieceQty: tickets.reduce((sum, item) => sum + item.pieceQty, 0),
      mixedFlag: false,
      baggingBy: '专项检查装袋员',
      baggingAt: '2026-08-03 10:00',
    },
  }, storage)
  if (!inbound) return
  appendWaitHandoverInboundEvent({
    source: 'PDA',
    operator: { operatorName: '专项检查入仓员' },
    bagCode,
    warehouseArea: '裁床待交出仓',
    locationCode: 'CUT-A-01',
    occurredAt: '2026-08-03 10:10',
    storage,
  })
}

assert.equal(PDA_CUTTING_TRANSFER_BAG_SCAN_DEBOUNCE_MS, 150)
assert.equal(resolvePdaTransferBagHandoverScanTrigger({ type: 'keydown', key: 'Enter' }), 'immediate')
assert.equal(resolvePdaTransferBagHandoverScanTrigger({ type: 'input' }), 'debounced')
assert.equal(resolvePdaTransferBagHandoverScanTrigger({ type: 'keydown', key: 'A' }), 'none')
assert.equal(normalizePdaCuttingHandoverAction('handover-bagging-confirm'), 'transfer-bag-handover')

const storage = memoryStorage()
addBag(storage, 'BAG-MULTI-TASK', [
  ticket('T1', 'SEW-001'),
  ticket('T2', 'SEW-002'),
])
const scanned = scanPdaTransferBagForHandover('bag-multi-task', storage)
assert.equal(scanned.ok, true, `同一工厂的多个车缝任务必须允许整袋交出：${scanned.state.scanFeedbackMessage}`)
assert.deepEqual(scanned.state.sewingTaskNos, ['SEW-001', 'SEW-002'])
assert.equal(scanned.state.receiverFactoryName, '车缝工厂甲')
assert.equal(scanned.state.ticketCount, 2)
assert.equal(scanned.state.pieceQty, 20)

const html = renderPdaTransferBagHandoverWorkflow(scanned.state, 'TASK-HANDOVER')
assert.equal((html.match(/<button\b/g) || []).length, 1, 'PDA 页面只能有一个确认主按钮')
assert(html.includes('扫描或填写中转袋编号'))
assert(html.includes('SEW-001、SEW-002'), '页面必须只读展示袋内全部车缝任务')
assert(html.includes('2 张 / 20 片'))
assert(!html.includes('扫描车缝任务'), 'PDA 不得要求另扫单个车缝任务')
assert(!html.includes('data-pda-cut-handover-field="sewingTaskCode"'))
assert(!html.includes('<select'), '接收工厂必须由袋内逐票分配自动带出')

const submitted = submitPdaTransferBagHandover(scanned.state, 'TASK-HANDOVER', storage)
assert.equal(submitted.resultMessage, '交出成功，等待实物袋回收。')
assert.equal(submitted.resultBagCode, 'BAG-MULTI-TASK')
assert.equal(submitted.resultFactoryName, '车缝工厂甲')
assert(submitted.handoverRecordNo)
const handoverEvents = listCuttingRuntimeEvents(storage).filter((event) =>
  event.eventType === '新增交出记录' && event.refs.transferBagCode === 'BAG-MULTI-TASK')
assert.equal(handoverEvents.length, 1)
assert.equal(
  resolveTransferBagCurrentUse('BAG-MULTI-TASK', storage).flowStage,
  'HANDED_OVER_WAITING_RETURN',
  JSON.stringify(handoverEvents[0]),
)
assert.deepEqual(handoverEvents[0].refs.sewingTaskNos, ['SEW-001', 'SEW-002'])
assert.equal(scanPdaTransferBagForHandover('BAG-MULTI-TASK', storage).ok, false)
assert(scanPdaTransferBagForHandover('BAG-MULTI-TASK', storage).state.scanFeedbackMessage.includes('等待实物袋回收'))

const crossFactoryStorage = memoryStorage()
addBag(crossFactoryStorage, 'BAG-CROSS-FACTORY', [
  ticket('C1', 'SEW-C1', 'FACTORY-A', '车缝工厂甲'),
  ticket('C2', 'SEW-C2', 'FACTORY-B', '车缝工厂乙'),
])
const crossFactory = scanPdaTransferBagForHandover('BAG-CROSS-FACTORY', crossFactoryStorage)
assert.equal(crossFactory.ok, false)
assert(crossFactory.state.scanFeedbackMessage.includes('多个车缝工厂'))
assert(crossFactory.state.scanFeedbackMessage.includes('拆袋重装'))

const packedStorage = memoryStorage()
addBag(packedStorage, 'BAG-PACKED', [ticket('P1', 'SEW-P1')], false)
const packed = scanPdaTransferBagForHandover('BAG-PACKED', packedStorage)
assert.equal(packed.ok, false)
assert(packed.state.scanFeedbackMessage.includes('请先入仓'))

const empty = scanPdaTransferBagForHandover('', storage)
assert.equal(empty.ok, false)
assert.equal(empty.state.scanFeedbackMessage, '请扫描中转袋。')
assert.equal(createPdaTransferBagHandoverFormState().bagCode, '')

type FakeTimer = { callback: () => void; cancelled: boolean }
const timers: FakeTimer[] = []
const effects: string[] = []
const timerController = createPdaTransferBagHandoverScanTimerController(
  (callback) => {
    const timer = { callback, cancelled: false }
    timers.push(timer)
    return timer
  },
  (timer) => { (timer as FakeTimer).cancelled = true },
)
timerController.schedule('handover', () => effects.push('old'))
const old = timers.at(-1)!
timerController.schedule('handover', () => effects.push('latest'))
assert.equal(old.cancelled, true)
old.callback()
assert.deepEqual(effects, [])
assert.equal(timerController.flush('handover'), true)
assert.deepEqual(effects, ['latest'])

assert(pageSource.includes("if (action === 'confirm-transfer-bag-handover')"))
assert(pageSource.includes('submitPdaTransferBagHandover(state, taskId)'))
assert(!keydownSource.includes('sewingTaskCode'), '全局 Enter 路由不得保留已删除的任务扫码框')

console.log('PDA 中转袋整袋交出专项检查通过：同工厂多任务、只扫袋、阶段阻断、跨工厂拆袋提示、不可重复交出和事实快照均已闭环。')
