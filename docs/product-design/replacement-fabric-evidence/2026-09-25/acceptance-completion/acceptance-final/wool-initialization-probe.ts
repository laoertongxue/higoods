import assert from 'node:assert/strict'
import type { FactoryReceiptInput } from '/private/tmp/higoods-replacement-fabric-release-20260925/src/data/fcs/factory-receiving-types.ts'

const values = new Map<string, string>()
const storage = { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) }
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage, sessionStorage: storage, addEventListener() {}, dispatchEvent() {}, location: { pathname: '/fcs/craft/wool/pending-receipts', search: '' } } })
Object.defineProperty(globalThis, 'document', { configurable: true, value: { addEventListener() {} } })
// Explicit isolated source snapshots normally hydrated by the browser bootstrap.
await (await import('/private/tmp/higoods-replacement-fabric-release-20260925/src/data/fcs/cutting/part-ticket-records.ts')).hydratePartTicketRecords({ revision: 0, records: [] })
await (await import('/private/tmp/higoods-replacement-fabric-release-20260925/src/data/fcs/production-context-records.ts')).hydrateProductionContextRecords({ revision: 0, records: [] })
const core = await import('/private/tmp/higoods-replacement-fabric-release-20260925/src/data/fcs/factory-receiving.ts')
const { confirmFactoryMaterialReceipt } = await import('/private/tmp/higoods-replacement-fabric-release-20260925/src/data/fcs/factory-receiving-links.ts')
const wool = await import('/private/tmp/higoods-replacement-fabric-release-20260925/src/data/fcs/wool-domain/store.ts')
const { buildWoolFactWorkflowMockStore } = await import('/private/tmp/higoods-replacement-fabric-release-20260925/src/data/fcs/wool-domain/mock-data.ts')
const { addWoolHandover } = await import('/private/tmp/higoods-replacement-fabric-release-20260925/src/data/fcs/wool-domain/commands.ts')
const { executeWoolCraftAction } = await import('/private/tmp/higoods-replacement-fabric-release-20260925/src/data/fcs/wool-domain/craft-flow.ts')
const { setPdaSession, listAllFactoryPdaUsers, createPdaSessionFromUser } = await import('/private/tmp/higoods-replacement-fabric-release-20260925/src/data/fcs/store-domain-pda.ts')

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
const factoryWarehouse = await import('/private/tmp/higoods-replacement-fabric-release-20260925/src/data/fcs/factory-internal-warehouse.ts')
const processWarehouse = await import('/private/tmp/higoods-replacement-fabric-release-20260925/src/data/fcs/process-warehouse-domain.ts')
const { buildWoolCraftWarehouseProjection } = await import('/private/tmp/higoods-replacement-fabric-release-20260925/src/data/fcs/wool-domain/craft-warehouse.ts')
const pieceKeys = new Set(knitting.externalPieces.map(item => item.pieceKey))
const nonWool = () => ({
  waitProcess: factoryWarehouse.listFactoryWaitProcessStockItems().filter(row => !pieceKeys.has(row.materialSku ?? '')),
  waitHandover: factoryWarehouse.listFactoryWaitHandoverStockItems().filter(row => !pieceKeys.has(row.materialSku ?? '')),
  process: processWarehouse.listProcessWarehouseRecords().filter(row => !pieceKeys.has(row.materialSku)),
})
const baseline = nonWool()

const secondRead = nonWool(), thirdRead = nonWool()
const changes = Object.fromEntries(Object.keys(baseline).map(key => {
 const first = baseline[key as keyof typeof baseline] as unknown as Array<Record<string, unknown>>
 const second = secondRead[key as keyof typeof baseline] as unknown as Array<Record<string, unknown>>
 const id = (row: Record<string, unknown>) => String(row.stockItemId || row.warehouseRecordId)
 const old = new Map(first.map(row=>[id(row),row]))
 return [key,{before:first.length,after:second.length,added:second.filter(row=>!old.has(id(row))).map(row=>({id:id(row),source:row.taskId,craft:row.craftCode})),changed:second.filter(row=>old.has(id(row))&&JSON.stringify(old.get(id(row)))!==JSON.stringify(row)).map(id),removed:first.filter(row=>!second.some(item=>id(item)===id(row))).map(id)}]
}))
assert.deepEqual(secondRead, thirdRead)
console.log(JSON.stringify({businessActionsPerformed:0,changes,secondAndThirdReadEqual:true},null,2))
