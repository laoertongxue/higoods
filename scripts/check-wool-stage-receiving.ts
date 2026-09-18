import assert from 'node:assert/strict'
import type { FactoryReceiptInput } from '../src/data/fcs/factory-receiving-types.ts'

const values = new Map<string, string>()
const storage = { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) }
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage, sessionStorage: storage, addEventListener() {}, dispatchEvent() {}, location: { pathname: '/fcs/craft/wool/pending-receipts', search: '' } } })
Object.defineProperty(globalThis, 'document', { configurable: true, value: { addEventListener() {} } })
const core = await import('../src/data/fcs/factory-receiving.ts')
const { confirmFactoryMaterialReceipt } = await import('../src/data/fcs/factory-receiving-links.ts')
const wool = await import('../src/data/fcs/wool-domain/store.ts')
const { buildWoolFactWorkflowMockStore } = await import('../src/data/fcs/wool-domain/mock-data.ts')
const { addWoolHandover } = await import('../src/data/fcs/wool-domain/commands.ts')
const { executeWoolCraftAction } = await import('../src/data/fcs/wool-domain/craft-flow.ts')
const { setPdaSession, listAllFactoryPdaUsers, createPdaSessionFromUser } = await import('../src/data/fcs/store-domain-pda.ts')

// A private pair avoids relying on changing demo completion/receipt scenarios.
const seed = buildWoolFactWorkflowMockStore(), oldPair = 'WOOL-STAGE-009', pair = 'WOOL-RECEIVE-TEST'
const isolated = structuredClone(seed)
isolated.workOrders = Object.fromEntries(Object.entries(seed.workOrders).filter(([id]) => id.startsWith(oldPair)))
for (const key of ['yarnReceipts', 'yarnIssues', 'yarnReturns', 'processReports', 'handovers', 'warehouseFlows', 'internalReceipts', 'pieceReceipts', 'craftRecords', 'completions', 'operationLogs', 'machineAssociations', 'machineAssociationLogs'] as const) {
  ;(isolated[key] as unknown[]) = (seed[key] as Array<{ woolOrderId?: string }>).filter(record => record.woolOrderId?.startsWith(oldPair))
}
isolated.craftRecords = []; isolated.pieceReceipts = []; isolated.completions = []
isolated.handovers = isolated.handovers.filter(record => record.automatic)
isolated.warehouseFlows = isolated.warehouseFlows.filter(flow => flow.sourceRecordType !== 'PIECE_RECEIPT' && (flow.sourceRecordType !== 'HANDOVER' || isolated.handovers.some(handover => handover.handoverId === flow.sourceRecordId)))
const testStore = JSON.parse(JSON.stringify(isolated).replaceAll(oldPair, pair)) as typeof isolated
wool.replaceWoolStore(testStore)
const knitting = testStore.workOrders[`${pair}:KNITTING`], linking = testStore.workOrders[`${pair}:LINKING`]
const piece = knitting.externalPieces[0], [first, second] = piece.routeNodes
const at = '2026-09-18 11:00:00'
let checks = 0
const check = (label: string, fn: () => void) => { fn(); checks++; console.log(`✓ ${label}`) }
const receive = (sourceId: string, id: string, qty: number): FactoryReceiptInput => {
  const source = core.getFactoryReceivingSource(sourceId)!
  return { id, factoryId: source.targetFactoryId, operatorName: '本厂仓管', operatorId: 'TEST-RECEIVER', receivedAt: at, remark: '专项实收',
    lines: [{ sourceId, sourceLineId: source.lines[0].id, ...core.getDefaultFactoryReceiptPosition(source.targetFactoryId), businessQty: qty, businessUnit: '片' }] }
}

const handover = addWoolHandover(knitting.woolOrderId, { commandId: 'TEST-HANDOVER', outputSkuCode: piece.skuCode, pieceKey: piece.pieceKey, handoverQty: 40, handedOverAt: at, handedOverBy: '横机主管' })
const firstSource = core.getFactoryReceivingSourceByOriginalRecordId(handover.handoverId)!
check('横机实际外发片进入首工艺厂，收货不误用纱线称重也不提前入缝盘', () => {
  const input = receive(firstSource.id, 'FIRST-RECEIPT', 40)
  const receipt = confirmFactoryMaterialReceipt(input)
  assert.equal(receipt.lines[0].unit, '片')
  assert.equal(receipt.lines[0].woolCraftOrderId, first.taskOrderId)
  assert.equal(receipt.lines[0].yarn, undefined)
  assert.equal(wool.readWoolStore().pieceReceipts.length, 0)
  assert.equal(wool.readWoolStore().handovers.find(record => record.handoverId === handover.handoverId)!.downstreamReceipt!.actualReceivedQty, 40)
  assert.deepEqual(confirmFactoryMaterialReceipt(input), receipt)
  assert.equal(core.listFactoryReceipts().filter(receipt => receipt.id === input.id).length, 1)
})

executeWoolCraftAction({ taskOrderId: first.taskOrderId!, actionCode: 'SPECIAL_CRAFT_PROCESS_REPORT', qty: 40, commandId: 'FIRST-PROCESS', operatorName: '工艺员', operatedAt: at })
executeWoolCraftAction({ taskOrderId: first.taskOrderId!, actionCode: 'SPECIAL_CRAFT_SUBMIT_HANDOVER', qty: 40, commandId: 'FIRST-HANDOUT', operatorName: '工艺员', operatedAt: at })
const secondSource = core.getFactoryReceivingSourceByOriginalRecordId('WCF:FIRST-HANDOUT')!
check('不同工艺厂分两次接收，数量依据实际交出且不能重复或超收', () => {
  core.registerFactoryReceivingSource({ ...secondSource, lines: secondSource.lines.map(line => ({ ...line, plannedQty: 10 })) })
  confirmFactoryMaterialReceipt(receive(secondSource.id, 'SECOND-RECEIPT-1', 15))
  assert.throws(() => confirmFactoryMaterialReceipt(receive(secondSource.id, 'SECOND-OVER', 26)), /尚未接收/)
  assert.throws(() => confirmFactoryMaterialReceipt(receive(secondSource.id, 'SECOND-FRACTION', 1.5)), /整数/)
  confirmFactoryMaterialReceipt(receive(secondSource.id, 'SECOND-RECEIPT-2', 25))
  assert.equal(core.getSourceActualReceipts(secondSource.id).reduce((sum, line) => sum + line.qty, 0), 40)
  assert.equal(wool.readWoolStore().pieceReceipts.length, 0)
  assert.throws(() => core.registerFactoryReceivingSource({ ...secondSource, id: 'DUPLICATED-SOURCE' }), /不能换单号/)
})

executeWoolCraftAction({ taskOrderId: second.taskOrderId!, actionCode: 'SPECIAL_CRAFT_PROCESS_REPORT', qty: 40, commandId: 'SECOND-PROCESS', operatorName: '工艺员', operatedAt: at })
executeWoolCraftAction({ taskOrderId: second.taskOrderId!, actionCode: 'SPECIAL_CRAFT_SUBMIT_HANDOVER', qty: 40, commandId: 'SECOND-HANDOUT', operatorName: '工艺员', operatedAt: at })
const finalSource = core.getFactoryReceivingSourceByOriginalRecordId('WCF:SECOND-HANDOUT')!
check('末工艺分批回货形成唯一缝盘片实收和库存，重读与重启不重复', () => {
  confirmFactoryMaterialReceipt(receive(finalSource.id, 'FINAL-RECEIPT-1', 15))
  confirmFactoryMaterialReceipt(receive(finalSource.id, 'FINAL-RECEIPT-2', 25))
  const current = wool.readWoolStore()
  assert.equal(current.pieceReceipts.filter(record => record.woolOrderId === linking.woolOrderId).reduce((sum, record) => sum + record.qty, 0), 40)
  assert.equal(current.warehouseFlows.filter(flow => flow.sourceRecordType === 'PIECE_RECEIPT').reduce((sum, flow) => sum + flow.qty, 0), 40)
  wool.validateWoolStore(current)
  core.clearFactoryReceivingCache(); wool.clearWoolStoreMemoryCache()
  const reloaded = wool.readWoolStore()
  assert.equal(reloaded.pieceReceipts.length, 2)
  assert.equal(reloaded.warehouseFlows.filter(flow => flow.sourceRecordType === 'PIECE_RECEIPT').length, 2)
})

check('错误工厂、错误末节点、伪造交出均阻断', () => {
  const wrongFactory = receive(finalSource.id, 'WRONG-FACTORY', 1)
  wrongFactory.factoryId = first.factoryId
  assert.throws(() => confirmFactoryMaterialReceipt(wrongFactory), /不属于本厂/)
  const forged = { ...structuredClone(finalSource), id: 'FORGED', documentNo: 'FORGED', originalRecordId: 'NO-ACTUAL-HANDOVER', lines: finalSource.lines.map(line => ({ ...line, id: 'FORGED-LINE' })) }
  core.registerFactoryReceivingSource(forged)
  assert.throws(() => confirmFactoryMaterialReceipt(receive(forged.id, 'FORGED-RECEIPT', 1)), /实际工艺交出/)
  const wrongNode = { ...structuredClone(forged), id: 'WRONG-NODE', originalRecordId: 'WRONG-NODE-ORIGIN', lines: forged.lines.map(line => ({ ...line, id: 'WRONG-NODE-LINE', woolRouteNodeId: first.sourceEntryId })) }
  core.registerFactoryReceivingSource(wrongNode)
  assert.throws(() => confirmFactoryMaterialReceipt(receive(wrongNode.id, 'WRONG-NODE-RECEIPT', 1)), /末道工艺/)
})

check('横机纱线保留毛重、管型、筒数、净重，和片收货分开投影', () => {
  const source = { ...structuredClone(firstSource), id: 'TEST-YARN', documentNo: 'TEST-YARN', type: 'TRANSFER' as const, originalRecordId: undefined,
    targetFactoryId: knitting.factoryId, targetFactoryName: knitting.factoryName, approvedAt: at, lines: [{ ...firstSource.lines[0], id: 'TEST-YARN-LINE', woolCraftOrderId: undefined,
      woolPieceKey: undefined, woolRouteNodeId: undefined, woolOrderId: knitting.woolOrderId, unit: 'kg', plannedQty: 1, sentQty: 2,
      material: { ...firstSource.lines[0].material, sku: 'YARN-COTTON-MIXED', name: '纱线', kind: 'YARN' as const } }] }
  core.registerFactoryReceivingSource(source)
  const input: FactoryReceiptInput = { id: 'YARN-RECEIPT', factoryId: knitting.factoryId, operatorName: '仓管', operatorId: 'TEST', receivedAt: at, remark: '',
    lines: [{ sourceId: source.id, sourceLineId: source.lines[0].id, ...core.getDefaultFactoryReceiptPosition(knitting.factoryId), grossKg: 1.062, pcs: 1, tubes: { PAPER: 1, CONICAL: 0, PAGODA: 0 } }] }
  const receipt = confirmFactoryMaterialReceipt(input)
  assert.equal(receipt.lines[0].qty, 1)
  assert.equal(receipt.lines[0].yarn!.tareGrams, 62)
  assert.equal(wool.readWoolStore().yarnReceipts.filter(record => record.factoryReceiptId === input.id).length, 1)
  assert.throws(() => confirmFactoryMaterialReceipt({ ...input, id: 'YARN-OVER', lines: [{ ...input.lines[0], grossKg: 1.063 }] }), /超过来源/)
})

check('接收命令核验当前 PDA 工厂，不能改请求参数越厂收货', () => {
  const user = listAllFactoryPdaUsers().find(user => user.factoryId !== knitting.factoryId && user.status !== 'LOCKED')!
  setPdaSession(createPdaSessionFromUser(user))
  assert.throws(() => confirmFactoryMaterialReceipt(receive(finalSource.id, 'WRONG-IDENTITY', 1)), /当前操作人/)
  setPdaSession(null)
})

console.log(`毛织两阶段统一接收检查通过：${checks} 个场景`)
