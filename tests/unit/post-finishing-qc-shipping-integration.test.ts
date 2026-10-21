import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test, { after } from 'node:test'
import ts from 'typescript'
import type { FinishedOutboundOrder } from '../../src/data/wls/finished-outbound-orders.ts'
import type { GarmentReplacementStoreSnapshot } from '../../src/data/fcs/garment-spu-replacement-records.ts'

// Inject only read boundaries, keeping the real prepare/version guards and all
// formal-source/print adapters. No database, browser data or product source is written.
const readerKey = '__qcShippingIntegrationReaders'
type Readers = { outbound?: () => FinishedOutboundOrder[]; pcs?: () => { records: unknown[]; files: never[]; migrations: never[] }; identity?: () => GarmentReplacementStoreSnapshot }
const readers: Readers = {}
Reflect.set(globalThis, readerKey, readers)
const instrumented = new Set<string>()
const hooks = registerHooks({
  load(url, context, nextLoad) {
    const result = nextLoad(url, context)
    const target = url.endsWith('/finished-outbound-orders.ts') ? ['loadFinishedOutboundOrders', 'outbound']
      : url.endsWith('/pcs-record-db.ts') ? ['readPcsRecords', 'pcs']
        : url.endsWith('/garment-spu-replacement-records.ts') ? ['readGarmentReplacementSnapshotForPriority', 'identity'] : undefined
    if (!target) return result
    const source = typeof result.source === 'string' ? result.source : Buffer.from(result.source as Uint8Array).toString('utf8')
    const tree = ts.createSourceFile(url, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const declaration = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === target[0])
    assert.ok(declaration?.body, `read boundary ${target[0]} exists`)
    const offset = declaration.body.getStart(tree) + 1
    const injection = `const __qcuReader = globalThis.${readerKey}?.${target[1]}; if (__qcuReader) return __qcuReader();`
    instrumented.add(target[0]!)
    return { ...result, source: source.slice(0, offset) + injection + source.slice(offset) }
  },
})

const flow = await import('../../src/data/fcs/post-finishing-full-flow.ts')
await import('../../src/data/fcs/runtime-process-tasks.ts')
const runtime = await import('../../src/data/fcs/post-finishing-qc-shipping-priority-runtime.ts')
const outbound = await import('../../src/data/wls/finished-outbound-orders.ts')
const seeds = await import('../../src/data/fcs/post-finishing-qc-shipping-seeds.ts')
const identitySource = await import('../../src/data/fcs/garment-spu-replacement-records.ts')
const readModel = await import('../../src/data/fcs/post-finishing-current-read-model.ts')
const pagePrint = await import('../../src/pages/process-factory/post-finishing/full-flow-print.ts')
const printRegistry = await import('../../src/data/fcs/print-template-registry.ts')
const priorityBlock = await import('../../src/pages/print/templates/post-finishing-qc-priority-block.ts')
const namespace = 'higood-fcs-post-finishing-records'

function temporaryGlobals(values: Record<string, unknown>): () => void {
  const previous = new Map(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  return () => { for (const [key, descriptor] of previous) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key) }
}

after(() => {
  hooks.deregister()
  Reflect.deleteProperty(globalThis, readerKey)
})

test('QCU-053：正式分配来源经公开回货送检后，页内及统一主明细打印读取同一紧急DTO', async () => {
  flow.resetPostFinishingFullFlow()
  const registrationSource = flow.listPostFinishingReturnRegistrationSources().find(row => row.executionTaskId)
  assert.ok(registrationSource, '存在正式有效分配来源')
  const formal = flow.resolvePostFinishingReturnRegistrationSource(registrationSource.scanValue).productionOrder
  assert.ok(!flow.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.some(row => row.productionOrderId === formal.productionOrderId), '不能借用验收 fixture 冒充正式来源')
  const actors = flow.POST_FINISHING_ACCEPTANCE_ACTORS
  const delivery = flow.registerPostFinishingFactoryReturn({
    productionOrderNo: formal.productionOrderNo, executionTaskId: formal.executionTaskId,
    returnIndex: registrationSource.returnIndex, triggerSource: '车缝正常交出', idempotencyKey: 'QCU-053-FORMAL',
    quantities: [{ skuId: formal.skus[0]!.skuId, registeredQty: 12 }], deliveryPersonName: '正式来源契约送货人',
    deliveryPersonPhone: '', evidenceImageUrls: [formal.skus[0]!.imageUrl], actor: actors.factoryCourier,
  })
  flow.confirmPostFinishingFactoryReturn({ deliveryId: delivery.deliveryId, actor: actors.returnConfirmer,
    firstCounts: delivery.lines.map(line => ({ skuId: line.sku.skuId, actualQty: line.registeredQty })) })
  const qc = flow.sendPostFinishingFactoryReturnToQc({ deliveryId: delivery.deliveryId, actor: actors.sender })
  assert.equal(qc.status, '待质检')
  assert.equal(flow.getPostFinishingQcPrintProductionSource(qc.qcTaskId).productionOrderId, formal.productionOrderId)
  await runtime.saveQcShippingDestination({ sourceId: qc.qcTaskId, warehouseId: 'WH-AC', expectedVersion: 0, operator: '正式来源计划员', reason: '明确本契约供货范围' })
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date())
  const sku = qc.lines[0]!.sku
  const stock = { id: 'QCU-053-FORMAL-STOCK', sku: sku.skuCode, warehouseId: 'WH-AC', quantity: 0, reservations: [] }
  const demand: FinishedOutboundOrder = {
    ...structuredClone(outbound.FINISHED_OUTBOUND_SEED[0]!), id: 'QCU-053-FORMAL-DEMAND', outboundOrderNo: 'QCU-053-FORMAL-DN',
    warehouse: 'A&C WH', status: '待处理', deadline: `${today} 23:59:59`, deadlineTimeZone: 'Asia/Jakarta',
    products: [{ lineId: 'QCU-053-FORMAL-LINE', spu: sku.spuCode, sku: sku.skuCode, imageUrl: sku.imageUrl, quantity: 20, pendingQuantity: 999, locations: [], inventoryUpdatedAt: '' }],
  }
  outbound.FINISHED_OUTBOUND_SEED.push(demand)
  seeds.QC_SHIPPING_STOCK_SEEDS.push(stock)
  let restoreWindow: (() => void) | undefined
  try {
    await runtime.preparePostFinishingQcShippingPriority()
    const dto = runtime.getQcShippingPriorityForQc(qc.qcTaskId)!
    assert.equal(dto.ready, true, dto.issues.join(';'))
    assert.equal(dto.todayTotal, 20, '正式 SKU 按订单明细量计算，不累加待发参考量')
    assert.equal(dto.stars, 2)
    assert.deepEqual(runtime.getQcShippingPriorityForProduction(formal.productionOrderNo), dto)
    const expected = priorityBlock.renderPostFinishingQcPriorityBlock(dto)
    const task = readModel.getPostFinishingTaskByProductionOrder(formal.productionOrderId)
    assert.ok(task)
    for (const input of [
      { documentType: 'PRODUCTION_QC_MASTER' as const, sourceType: 'POST_FINISHING_TASK' as const, sourceId: task.postTaskId },
      { documentType: 'POST_FINISHING_QC_ORDER' as const, sourceType: 'POST_FINISHING_QC_ORDER' as const, sourceId: qc.qcTaskId },
    ]) {
      const html = printRegistry.renderPrintDocument(printRegistry.buildPrintDocument(input))
      assert.ok(html.includes(expected), `${input.documentType} 正式来源统一打印包含相同完整紧急区`)
      assert.ok(html.includes(formal.productionOrderNo))
    }
    const location = { search: '' }
    restoreWindow = temporaryGlobals({ window: { location } })
    for (const type of ['QC_ORDER', 'QC_DETAIL']) {
      location.search = `?type=${type}&id=${encodeURIComponent(qc.qcTaskNo)}`
      const html = pagePrint.renderPostFinishingFullFlowPrintPage()
      assert.ok(html.includes(expected), `${type} 正式来源页内打印包含相同完整紧急区`)
      assert.ok(html.includes(formal.productionOrderNo))
    }
  } finally {
    restoreWindow?.()
    outbound.FINISHED_OUTBOUND_SEED.splice(outbound.FINISHED_OUTBOUND_SEED.indexOf(demand), 1)
    seeds.QC_SHIPPING_STOCK_SEEDS.splice(seeds.QC_SHIPPING_STOCK_SEEDS.indexOf(stock), 1)
    flow.loadPostFinishingDemoData({ persist: false })
  }
})

for (const changedSource of ['保持一致', '出库需求', '后道revision', '换码身份'] as const) test(`QCU-056：跨来源读取${changedSource}时按真实版本决定能否发布`, async () => {
  const identity = identitySource.readGarmentReplacementSnapshotForPriority()
  let outboundReads = 0, pcsReads = 0, identityReads = 0
  readers.outbound = () => {
    const rows = structuredClone(outbound.FINISHED_OUTBOUND_SEED)
    if (++outboundReads > 1 && changedSource === '出库需求') { rows[0]!.version++; rows[0]!.status = '已取消' }
    return rows
  }
  readers.pcs = () => ({ records: ++pcsReads > 1 && changedSource === '后道revision'
    ? [{ id: `${namespace}/revision`, collection: 'revision', value: { format: 1 }, version: 1 }] : [], files: [], migrations: [] })
  readers.identity = () => {
    const snapshot = structuredClone(identity)
    if (++identityReads > 1 && changedSource === '换码身份') {
      const line = snapshot.records[0]?.lines[0]
      assert.ok(line, '已发布有效替换样本存在可变的目标商品身份')
      line.target.skuCode += '-CHANGED'
    }
    return snapshot
  }
  const restore = temporaryGlobals({ window: {}, localStorage: { getItem: () => null } })
  try {
    await runtime.preparePostFinishingQcShippingPriority()
    const qc = flow.listPostFinishingFullFlowQcTasks().find(row => row.status === '待质检')!
    assert.ok(qc)
    const result = runtime.getQcShippingPriorityForQc(qc.qcTaskId)!
    assert.equal(result.ready, changedSource === '保持一致', '稳定读取可正常发布，混合版本不能发布正常星级或零缺口')
    if (changedSource !== '保持一致') {
      const expectedIssue = changedSource === '出库需求' ? '出库需求已变化' : changedSource === '后道revision' ? '后道资料已变化' : '成衣换码身份已变化'
      assert.ok(result.issues.some(issue => issue.includes(expectedIssue)), result.issues.join(';'))
    } else assert.deepEqual(result.issues, [], '正向对照没有人为注入读取错误')
    assert.ok(outboundReads >= (changedSource === '出库需求' ? 2 : 1), '确实经过真实 prepare 的两次需求读取边界')
    if (changedSource === '后道revision') assert.ok(pcsReads >= 2, '真实 revision guard 重新读取了后道版本')
    if (changedSource === '换码身份') assert.ok(identityReads >= 2, '真实 prepare 对比了换码快照')
  } finally {
    restore()
    delete readers.outbound; delete readers.pcs; delete readers.identity
    await runtime.preparePostFinishingQcShippingPriority()
  }
})

test('QCU-056：三类读取探针均绑定到真实源入口而非替代计算函数', () => {
  assert.deepEqual([...instrumented].sort(), ['loadFinishedOutboundOrders', 'readGarmentReplacementSnapshotForPriority', 'readPcsRecords'].sort())
})
