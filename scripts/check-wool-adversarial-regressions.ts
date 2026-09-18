import assert from 'node:assert/strict'

// Isolated in-memory browser surfaces; never accesses a user's browser profile.
const values = new Map<string, string>()
let failedKey: string | undefined
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => {
    if (key === failedKey) throw new Error(`审查模拟存储失败: ${key}`)
    values.set(key, value)
  },
  removeItem: (key: string) => values.delete(key),
}
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
Object.defineProperty(globalThis, 'window', { configurable: true, value: {
  localStorage: storage, sessionStorage: storage, addEventListener() {}, dispatchEvent() {},
  location: { pathname: '/fcs/pda/warehouse/outbound-records', search: '', origin: 'http://localhost:5186' },
  history: { pushState() {}, replaceState() {} },
} })
Object.defineProperty(globalThis, 'document', { configurable: true, value: {
  addEventListener() {}, querySelector() { return null }, querySelectorAll() { return [] },
} })
const receiving = await import('../src/data/fcs/factory-receiving.ts')
const wool = await import('../src/data/fcs/wool-domain/store.ts')
let checks = 0
const check = (name: string, verify: () => void) => { verify(); checks++; console.log(`✓ ${name}`) }

for (const key of [receiving.FACTORY_RECEIVING_KEY, wool.WOOL_DOMAIN_STORE_KEY]) {
  values.clear(); receiving.clearFactoryReceivingCache(); wool.clearWoolStoreMemoryCache()
  const before = receiving.captureFactoryReceivingData()
  failedKey = key
  check(`初始化写入 ${key} 失败不发布任一半成事实，重试仍执行初始化`, () => {
    assert.throws(() => wool.readWoolStore(), /审查模拟存储失败/)
    assert.deepEqual(receiving.captureFactoryReceivingData(), before)
    assert.equal(values.has(wool.WOOL_DOMAIN_STORE_KEY), false)
    // A wrongly published memoryStore would make this second call succeed.
    assert.throws(() => wool.readWoolStore(), /审查模拟存储失败/)
    assert.deepEqual(receiving.captureFactoryReceivingData(), before)
  })
  failedKey = undefined
  check('存储恢复后只初始化一次，共享实收与毛织事实同时可读', () => {
    const saved = wool.readWoolStore(), count = receiving.listFactoryReceipts().length
    assert(count > 0); assert(saved.yarnReceipts.length > 0); assert(saved.pieceReceipts.length > 0)
    assert.equal(saved.operationLogs.filter(log => log.operationLogId === 'WDEMO-RECEIVING-INITIALIZED-20260918').length, 1)
    assert(values.has(wool.WOOL_DOMAIN_STORE_KEY))
    wool.clearWoolStoreMemoryCache(); receiving.clearFactoryReceivingCache()
    wool.readWoolStore()
    assert.equal(receiving.listFactoryReceipts().length, count)
  })
}

const overview = await import('../src/data/fcs/factory-mobile-warehouse.ts')
const links = await import('../src/data/fcs/factory-receiving-links.ts')
const commands = await import('../src/data/fcs/wool-domain/commands.ts')
const queries = await import('../src/data/fcs/wool-domain/queries.ts')
const ledger = await import('../src/data/fcs/wool-domain/warehouse-ledger.ts')
const ownId = 'OWN_WOOL_FACTORY', ownName = '周哥毛织厂'
const now = new Date('2099-01-01T04:00:00Z'), at = '2099-01-01 11:00:00'
const before = wool.readWoolStore()
for (const stage of ['KNITTING', 'LINKING'] as const) {
  const order = structuredClone(before.workOrders[`WOOL-STAGE-001:${stage}`])
  Object.assign(order, { woolOrderId: `REVIEW-FOREIGN:${stage}`, woolOrderNo: `REVIEW-${stage}`,
    taskId: `REVIEW-TASK:${stage}`, sourceTaskId: 'REVIEW-TASK', pairId: 'REVIEW-FOREIGN',
    pairedWorkOrderId: `REVIEW-FOREIGN:${stage === 'KNITTING' ? 'LINKING' : 'KNITTING'}`,
    factoryId: 'ID-F002', factoryName: '另一厂' })
  before.workOrders[order.woolOrderId] = order
}
wool.replaceWoolStore(before)
const base = overview.getFactoryMobileWarehouseOverview(ownId, ownName, now)
const otherSource = structuredClone(receiving.getFactoryReceivingSource('WDEMO-YARN-STOCK:20260918')!)
Object.assign(otherSource, { id: 'REVIEW-OTHER-STOCK', documentNo: 'REVIEW-OTHER-STOCK', targetFactoryId: 'ID-F002', targetFactoryName: '另一厂' })
Object.assign(otherSource.lines[0], { id: 'REVIEW-OTHER-STOCK-L', plannedQty: 123, sentQty: 123 })
otherSource.lines[0].material.batchNo = 'REVIEW-OTHER'
receiving.registerFactoryReceivingSource(otherSource)
receiving.savePreparedFactoryReceipt(receiving.prepareFactoryReceipt({
  id: 'REVIEW-OTHER-R', factoryId: 'ID-F002', operatorId: 'REVIEW', operatorName: '隔离验证', receivedAt: at, remark: '',
  lines: [{ sourceId: otherSource.id, sourceLineId: otherSource.lines[0].id,
    ...receiving.getDefaultFactoryReceiptPosition('ID-F002'), grossKg: 123.062, pcs: 1, tubes: { PAPER: 1, CONICAL: 0, PAGODA: 0 } }],
}))
check('异厂真实未绑定备料123kg不会进入本厂库存、今日流水或接收数量', () => {
  assert.equal(receiving.listFactoryReceipts('ID-F002').find(row => row.id === 'REVIEW-OTHER-R')!.lines[0].qty, 123)
  assert.deepEqual(overview.getFactoryMobileWarehouseOverview(ownId, ownName, now), base)
  assert(!queries.listWoolFactoryWarehouseFlows(wool.readWoolStore(), ownId).some(row => row.sourceRecordId === 'REVIEW-OTHER-R'))
})

const unbound = receiving.listFactoryReceipts(ownId).find(row => row.lines.some(line => line.sourceId === 'WDEMO-YARN-STOCK:20260918'))!
links.allocateReceivedMaterialToOrder({ id: 'REVIEW-ALLOCATION', receiptLineId: unbound.lines[0].id,
  woolOrderId: 'WOOL-STAGE-001:KNITTING', qty: 4, operatorName: '隔离验证', at })
const yarn = receiving.listFactoryReceipts(ownId).flatMap(row => row.lines).find(line => line.woolOrderId === 'WOOL-STAGE-002:KNITTING')!
commands.issueWoolYarn('WOOL-STAGE-002:KNITTING', { commandId: 'REVIEW-ISSUE', yarnSkuCode: yarn.material.sku,
  batchNo: yarn.material.batchNo, issuedQty: 10, issuedAt: at, issuedBy: '隔离验证' })
check('真实领用10kg与备料转出4kg相加为14kg，不被负调整抵消', () => {
  const current = wool.readWoolStore(), today = queries.listWoolFactoryWarehouseFlows(current, ownId)
    .filter(row => row.operatedAt === at && ledger.woolWarehouseFlowSignedQty(row) < 0)
  assert.equal(today.length, 2)
  assert(today.some(row => row.flowType === 'ADJUSTMENT' && row.qty === -4))
  assert(today.some(row => row.flowType === 'OUTBOUND' && row.qty === 10))
  const result = overview.getFactoryMobileWarehouseOverview(ownId, ownName, now)
  assert.equal(result.todayOutboundCount, 2); assert.equal(result.todayOutboundQty, 14)
})

const pda = await import('../src/data/fcs/store-domain-pda.ts')
pda.ensureFactoryPdaSeed(ownId, ownName)
pda.setPdaSession(pda.createPdaSessionFromUser(pda.listFactoryPdaUsers(ownId).find(user => user.status === 'ACTIVE')!))
const flows = await import('../src/pages/pda-wool-warehouse-flows.ts')
check('PDA方向卡片与汇总使用绝对数量，保留原始账本负数', () => {
  const current = wool.readWoolStore(), rows = queries.listWoolFactoryWarehouseFlows(current, ownId).filter(row => ledger.woolWarehouseFlowSignedQty(row) < 0)
  const total = queries.summarizeWoolQuantities(rows.map(row => ({ ...row, qty: Math.abs(ledger.woolWarehouseFlowSignedQty(row)) })))
  const html = flows.renderPdaWoolWarehouseFlows(ownId, ownName, 'OUT')!
  const visibleTotal = html.match(/按单位汇总：([^<]*)/)?.[1]
  assert.deepEqual(visibleTotal?.split(' / ').sort(), total.split(' / ').sort())
  assert(html.includes('<strong>4 kg</strong>')); assert(html.includes('<strong>10 kg</strong>'))
  assert(!html.includes('<strong>-4 kg</strong>')); assert(!html.includes('REVIEW-OTHER-R'))
  assert(current.warehouseFlows.some(row => row.receivingAllocationId === 'REVIEW-ALLOCATION' && row.qty === -4))
})
console.log(`PASS ${checks} adversarial regression checks; no browser/performance claim.`)
