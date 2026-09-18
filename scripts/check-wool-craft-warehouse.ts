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
const seed = buildWoolFactWorkflowMockStore(), oldPair = 'WOOL-STAGE-009', pair = 'WOOL-CRAFT-WAREHOUSE-TEST'
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
const factoryWarehouse = await import('../src/data/fcs/factory-internal-warehouse.ts')
const processWarehouse = await import('../src/data/fcs/process-warehouse-domain.ts')
const { buildWoolCraftWarehouseProjection } = await import('../src/data/fcs/wool-domain/craft-warehouse.ts')
const pieceKeys = new Set(knitting.externalPieces.map(item => item.pieceKey))
const nonWool = () => ({
  waitProcess: factoryWarehouse.listFactoryWaitProcessStockItems().filter(row => !pieceKeys.has(row.materialSku ?? '')),
  waitHandover: factoryWarehouse.listFactoryWaitHandoverStockItems().filter(row => !pieceKeys.has(row.materialSku ?? '')),
  process: processWarehouse.listProcessWarehouseRecords().filter(row => !pieceKeys.has(row.materialSku)),
})
const baseline = nonWool()
const receive = (sourceId: string, id: string, qty: number) => {
  const source = core.getFactoryReceivingSource(sourceId)!
  return confirmFactoryMaterialReceipt({ id, factoryId: source.targetFactoryId, operatorName: '仓管', operatorId: 'TEST', receivedAt: at, remark: '', lines: [{ sourceId, sourceLineId: source.lines[0].id, ...core.getDefaultFactoryReceiptPosition(source.targetFactoryId), businessQty: qty, businessUnit: '片' }] })
}
const action = (taskOrderId: string, actionCode: string, qty: number, commandId: string) => executeWoolCraftAction({ taskOrderId, actionCode, qty, commandId, operatorName: '工艺员', operatedAt: at })
const sum = <T>(rows: T[], value: (row: T) => number) => rows.reduce((total, row) => total + value(row), 0)
const nodeFacts = (id: string) => {
  const projection = buildWoolCraftWarehouseProjection()
  const wp = projection.waitProcessStockItems.filter(row => row.taskId === id)
  const wh = projection.waitHandoverStockItems.filter(row => row.taskId === id)
  return { received: sum(wp, row => row.receivedQty), wp: sum(wp, row => row.availableQty ?? 0), used: sum(wp, row => row.issuedQty ?? 0), processed: sum(wh, row => row.completedQty), wh: sum(wh, row => row.waitHandoverQty), transit: sum(wh, row => row.inTransitQty ?? 0), accepted: sum(wh, row => row.receiverWrittenQty ?? 0) }
}
let checks = 0
const check = (label: string, fn: () => void) => { fn(); checks++; console.log(`✓ ${label}`) }
const handover = addWoolHandover(knitting.woolOrderId, { commandId: 'WH-HANDOVER', outputSkuCode: piece.skuCode, pieceKey: piece.pieceKey, handoverQty: 40, handedOverAt: at, handedOverBy: '横机主管' })
const firstSource = core.getFactoryReceivingSourceByOriginalRecordId(handover.handoverId)!
check('已计划、已交出但未实收不能生成工艺库存或伪造交出记录', () => {
  assert.equal(buildWoolCraftWarehouseProjection().waitProcessStockItems.length, 0)
  assert.equal(processWarehouse.listProcessWarehouseRecords({ workOrderId: first.taskOrderId }).length, 0)
  assert.equal(processWarehouse.listProcessHandoverRecords({ workOrderId: first.taskOrderId }).length, 0)
})
receive(firstSource.id, 'WH-RECEIVE-FIRST', 40)
action(first.taskOrderId!, 'SPECIAL_CRAFT_PROCESS_REPORT', 25, 'WH-PROCESS-FIRST')
check('加工填报以片消耗待加工库存并等量形成待交出；跨仓守恒', () => {
  assert.deepEqual(nodeFacts(first.taskOrderId!), { received: 40, wp: 15, used: 25, processed: 25, wh: 25, transit: 0, accepted: 0 })
  const inbound = factoryWarehouse.listFactoryWarehouseInboundRecords().filter(row => row.taskId === first.taskOrderId)
  const outbound = factoryWarehouse.listFactoryWarehouseOutboundRecords().filter(row => row.sourceTaskId === first.taskOrderId)
  assert.equal(sum(inbound, row => row.receivedQty) - sum(outbound, row => row.outboundQty), 40)
  assert(inbound.every(row => row.unit === '片' && row.itemKind === '裁片'))
  assert.equal(inbound.filter(row => row.sourceRecordType === 'PROCESS_REPORT').length, 1)
  assert.equal(factoryWarehouse.listFactoryWaitProcessStockItems().filter(row => row.materialSku === piece.pieceKey).length, 1)
})
action(first.taskOrderId!, 'SPECIAL_CRAFT_SUBMIT_HANDOVER', 20, 'WH-HANDOUT-FIRST')
const nextSource = core.getFactoryReceivingSourceByOriginalRecordId('WCF:WH-HANDOUT-FIRST')!
receive(nextSource.id, 'WH-RECEIVE-SECOND', 8)
check('在途按下游分批实收递减；下道工艺使用真实路线工厂，不返裁厂', () => {
  assert.deepEqual(nodeFacts(first.taskOrderId!), { received: 40, wp: 15, used: 25, processed: 25, wh: 5, transit: 12, accepted: 8 })
  assert.deepEqual(nodeFacts(second.taskOrderId!), { received: 8, wp: 8, used: 0, processed: 0, wh: 0, transit: 0, accepted: 0 })
  const record = processWarehouse.listProcessHandoverRecords({ workOrderId: first.taskOrderId })[0]
  assert.equal(record.receiveFactoryId, second.factoryId)
  assert.equal(record.receiveObjectQty, 8)
  assert.equal(record.diffObjectQty, 0)
  assert.equal(processWarehouse.getProcessHandoverRecordById(record.handoverRecordId)!.receiveObjectQty, 8)
  const wh = processWarehouse.listWaitHandoverWarehouseRecords({ workOrderId: first.taskOrderId })[0]
  assert.equal(wh.inTransitObjectQty, 12)
  assert.equal(wh.targetFactoryId, second.factoryId)
  assert(!wh.receiveWarehouseName!.includes('裁床'))
  assert.equal(processWarehouse.getProcessWarehouseRecordById(wh.warehouseRecordId)!.availableObjectQty, 5)
  assert.throws(() => processWarehouse.updateWarehouseRecordQty(wh.warehouseRecordId, { availableObjectQty: 999 }), /不能直接/)
})
action(second.taskOrderId!, 'SPECIAL_CRAFT_PROCESS_REPORT', 6, 'WH-PROCESS-SECOND')
action(second.taskOrderId!, 'SPECIAL_CRAFT_SUBMIT_HANDOVER', 6, 'WH-HANDOUT-SECOND')
const finalSource = core.getFactoryReceivingSourceByOriginalRecordId('WCF:WH-HANDOUT-SECOND')!
receive(finalSource.id, 'WH-RECEIVE-LINKING', 4)
check('末道工艺回缝盘，最终片实收只进缝盘事实，不重复计入工艺待加工仓', () => {
  assert.deepEqual(nodeFacts(second.taskOrderId!), { received: 8, wp: 2, used: 6, processed: 6, wh: 0, transit: 2, accepted: 4 })
  const record = processWarehouse.listProcessHandoverRecords({ workOrderId: second.taskOrderId })[0]
  assert.equal(record.receiveFactoryId, linking.factoryId)
  assert(record.receiveWarehouseName.includes('缝盘'))
  assert.equal(wool.readWoolStore().pieceReceipts.reduce((total, row) => total + row.qty, 0), 4)
  assert.equal(factoryWarehouse.listFactoryWaitProcessStockItems().filter(row => row.materialSku === piece.pieceKey).reduce((total, row) => total + (row.availableQty ?? 0), 0), 17)
  assert.equal(factoryWarehouse.listFactoryWarehouseInboundRecords().filter(row => row.materialSku === piece.pieceKey && row.inboundRecordId.startsWith('FIN-')).length, 0)
})
check('刷新、重复读取不重复库存；非毛织仓储和工艺记录不变', () => {
  const before = buildWoolCraftWarehouseProjection()
  core.clearFactoryReceivingCache(); wool.clearWoolStoreMemoryCache()
  const after = buildWoolCraftWarehouseProjection()
  assert.deepEqual(after, before)
  assert.deepEqual(nonWool(), baseline)
  const stock = factoryWarehouse.listFactoryWaitProcessStockItems().filter(row => row.materialSku === piece.pieceKey)
  assert.equal(new Set(stock.map(row => row.stockItemId)).size, stock.length)
})
check('修改查询副本的记录、图片、关联数组及集合不能污染下次仓储读取', () => {
  const before = buildWoolCraftWarehouseProjection()
  const returned = buildWoolCraftWarehouseProjection()
  assert.deepEqual(returned, before)
  const mutate = (value: unknown): void => {
    if (!value || typeof value !== 'object') return
    if (value instanceof Set) { value.clear(); value.add('伪造ID'); return }
    if (Array.isArray(value)) { value.forEach(mutate); value.push('伪造元素'); return }
    for (const [key, child] of Object.entries(value)) {
      if (child && typeof child === 'object') mutate(child)
      else (value as Record<string, unknown>)[key] = typeof child === 'number' ? 999999 : '伪造字段'
    }
  }
  mutate(returned)
  assert.deepEqual(buildWoolCraftWarehouseProjection(), before)
  const warehouseSnapshot = factoryWarehouse.createFactoryInternalWarehouseMutationSnapshot()
  const row = warehouseSnapshot.waitProcessStockItems.find(item => item.materialSku === piece.pieceKey)!
  row.availableQty = 999999
  row.photoList.push('伪造图片')
  factoryWarehouse.restoreFactoryInternalWarehouseMutationSnapshot(warehouseSnapshot)
  // Reinstalling the authoritative projection after a generic mutation must remain intact.
  assert.deepEqual(factoryWarehouse.listFactoryWaitProcessStockItems().filter(item => pieceKeys.has(item.materialSku ?? '')), before.waitProcessStockItems)
})
const warehousePage = await import('../src/pages/process-factory/special-craft/warehouse.ts')
const operations = (await import('../src/data/fcs/special-craft-operations.ts')).listEnabledSpecialCraftOperationDefinitions()
check('仓储页面显示实际0库存、片单位、真实库位和真实流水，毛织片配图可放大', () => {
  const operation = operations.find(item => item.craftCode === second.craftCode)!
  const slug = operation.managementDomain === 'AUXILIARY_CRAFT_FACTORY' ? 'auxiliary' : 'special-type'
  for (const mode of ['wait-process', 'wait-handover'] as const) {
    for (const [field, value] of [['keyword', piece.pieceKey], ['factoryId', second.factoryId], ['operationName', operation.operationName]]) {
      warehousePage.handleSpecialCraftWarehouseEvent({ closest: (selector: string) => selector === '[data-special-craft-warehouse-field]' ? { dataset: { domainSlug: slug, warehouseMode: mode, specialCraftWarehouseField: field }, value } : null } as unknown as Element)
    }
  }
  const wpHtml = warehousePage.renderSpecialCraftDomainWaitProcessWarehousePage(slug)
  const whHtml = warehousePage.renderSpecialCraftDomainWaitHandoverWarehousePage(slug)
  assert(wpHtml.includes('>2 片</td>'))
  assert(whHtml.includes('>0 片</td>'))
  assert(whHtml.includes('data-pda-image-preview-url='))
  const flowData = [...whHtml.matchAll(/data-flow-json="([^"]+)"/g)].map(match => JSON.parse(decodeURIComponent(match[1])))
  const actualFlows = flowData.flat()
  assert(actualFlows.some(flow => flow.sourceNo === 'WCF:WH-PROCESS-SECOND' && flow.qtyText === '6 片'))
  assert(actualFlows.some(flow => flow.sourceNo === 'WCF:WH-HANDOUT-SECOND' && flow.qtyText === '-6 片'))
  const row = buildWoolCraftWarehouseProjection().waitHandoverStockItems.find(item => item.taskId === second.taskOrderId)!
  assert(whHtml.includes(row.locationNo))
})
console.log(`PASS ${checks} wool craft warehouse checks`)
