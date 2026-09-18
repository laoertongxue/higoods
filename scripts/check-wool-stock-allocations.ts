import assert from 'node:assert/strict'

// Private storage and document surfaces: no user browser data is opened or reset.
const values = new Map<string, string>(), fields = new Map<string, string>()
const storage = { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) }
const location = { pathname: '/fcs/craft/wool/pending-receipts', search: '?view=stock', origin: 'http://localhost:5186' }
const overlay = { innerHTML: '' }, error = { textContent: '' }, feedback = { textContent: '' }
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage, sessionStorage: storage, location, addEventListener() {}, dispatchEvent() {} } })
Object.defineProperty(globalThis, 'document', { configurable: true, value: { addEventListener() {}, querySelector(selector: string) {
  if (selector === '[data-wool-stock-overlay]') return overlay
  if (selector === '[data-wool-stock-error]') return error
  if (selector === '[data-wool-stock-feedback]') return feedback
  const field = selector.match(/^\[data-wool-stock-field="([^"]+)"\]$/)?.[1]
  return field ? { value: fields.get(field) || '' } : null
}, querySelectorAll() { return [] } } })
const core = await import('../src/data/fcs/factory-receiving.ts')
const links = await import('../src/data/fcs/factory-receiving-links.ts')
const wool = await import('../src/data/fcs/wool-domain/store.ts')
const queries = await import('../src/data/fcs/wool-domain/queries.ts')
const stock = await import('../src/pages/process-factory/wool/stock-allocations.ts')
const pending = await import('../src/pages/process-factory/wool/pending-receipts.ts')
const display = await import('../src/pages/process-factory/wool/stage-display.ts')
const pda = await import('../src/data/fcs/store-domain-pda.ts')
const store = wool.readWoolStore(), order = store.workOrders['WOOL-STAGE-001:KNITTING']
const source = structuredClone(core.getFactoryReceivingSource('WDEMO-YARN:WOOL-STAGE-001')!)
source.id = source.documentNo = 'STOCK-UI-SOURCE'; source.lines[0].id = 'STOCK-UI-SOURCE-LINE'
delete source.lines[0].woolOrderId; delete source.lines[0].productionOrderNo; delete source.lines[0].taskNo
core.registerFactoryReceivingSource(source)
const receipt = links.confirmFactoryMaterialReceipt({ id: 'STOCK-UI-RECEIPT', factoryId: order.factoryId, operatorId: 'WAREHOUSE', operatorName: '本厂仓管', receivedAt: '2026-09-18 18:00:00', remark: '隔离备料分配验证', lines: [{ sourceId: source.id, sourceLineId: source.lines[0].id, ...core.getDefaultFactoryReceiptPosition(order.factoryId), grossKg: 10.062, pcs: 1, tubes: { PAPER: 1, CONICAL: 0, PAGODA: 0 } }] })
const lineId = receipt.lines[0].id
let checks = 0
const check = (label: string, fn: () => void) => { fn(); checks++; console.log(`✓ ${label}`) }
const run = (action: string, id = '') => {
  const button = { dataset: { woolStockAction: action, id } }, root = {}
  const target = { closest: (selector: string) => ['[data-wool-stock-page]', '[data-wool-receiving-page]'].includes(selector) ? root : selector === '[data-wool-stock-action]' ? button : null } as unknown as HTMLElement
  error.textContent = ''; assert(pending.handleWoolPendingReceiptsClick(target))
}
check('view=stock进入备料库存，真实图片与实际余量可读', () => {
  const html = pending.renderWoolPendingReceiptsPage()
  assert.match(html, /毛织纱线备料 \/ 关联横机单/); assert.match(html, /data-wool-stock-page data-skip-page-rerender="true"/)
  assert.match(html, /data-pda-image-preview-url=/); assert.match(html, /STOCK-UI-RECEIPT/)
  assert.equal(stock.listWoolStockAllocationRows().find(row => row.line.id === lineId)?.remainingQty, 10)
})
check('库存视图只包含YARN备料实际接收，不包含片或已直接绑定来纱', () => {
  const rows = stock.listWoolStockAllocationRows()
  assert(rows.every(row => row.line.material.kind === 'YARN' && !row.line.woolOrderId && !row.line.woolCraftOrderId))
  assert(!rows.some(row => row.receipt.id === 'WDEMO-RECEIPT:YARN:WOOL-STAGE-002'))
})
check('候选仅本厂需要该SKU且未完单的横机单', () => {
  const targets = stock.listWoolStockAllocationTargets(lineId)
  assert(targets.some(target => target.id === order.woolOrderId))
  assert(!targets.some(target => target.id.endsWith(':LINKING') || target.id === 'WOOL-STAGE-005:KNITTING'))
  assert(targets.every(target => store.workOrders[target.id].factoryId === receipt.factoryId && store.workOrders[target.id].outputPlanLines.some(line => line.requiredYarnSkus.includes(receipt.lines[0].material.sku))))
})
const initialReceipts = core.listFactoryReceipts().length, initialAllocations = core.listReceivingAllocations().length
check('分配前未收纱线不能填报', () => assert.equal(queries.getWoolOutputReadiness(order.woolOrderId, order.outputPlanLines[0].outputSkuCode).isReady, false))
run('allocate', lineId)
check('打开分配仅展示选择和复核，未写入接收或分配事实', () => { assert.match(overlay.innerHTML, /复核分配/); assert.equal(core.listFactoryReceipts().length, initialReceipts); assert.equal(core.listReceivingAllocations().length, initialAllocations) })
fields.set('target', order.woolOrderId); fields.set('qty', '11'); run('review')
check('超过实收备料余量阻断', () => { assert.match(error.textContent, /不超过余量 10 kg/); assert.equal(core.listReceivingAllocations().length, initialAllocations) })
fields.set('target', 'WOOL-STAGE-001:LINKING'); fields.set('qty', '4'); run('review')
check('缝盘单不可接受任意备料分配', () => assert.match(error.textContent, /未完单横机加工单/))
fields.set('target', order.woolOrderId); run('review')
check('二次确认明确目标和数量，确认前事实不变', () => { assert.match(overlay.innerHTML, /复核备料分配/); assert.match(overlay.innerHTML, /4 kg/); assert.equal(core.listReceivingAllocations().length, initialAllocations) })
run('save')
check('确认分配复用共享命令，减少备料而不重复实际接收', () => {
  assert.equal(error.textContent, '')
  assert.equal(links.remainingReceivingAllocationQty(lineId), 6)
  assert.equal(core.listReceivingAllocations().length, initialAllocations + 1)
  assert.equal(core.listFactoryReceipts().length, initialReceipts)
  assert.equal(core.listFactoryReceipts().find(item => item.id === receipt.id)!.lines[0].qty, 10)
  assert.match(feedback.textContent, /已分配 4 kg.*剩余 6 kg/)
  const current = wool.readWoolStore()
  assert.equal(queries.getWoolOutputReadiness(order.woolOrderId, order.outputPlanLines[0].outputSkuCode).isReady, true)
  const movements = current.warehouseFlows.filter(flow => flow.receivingAllocationId === core.listReceivingAllocations().at(-1)!.id)
  assert.equal(movements.length, 2)
  assert.equal(movements.reduce((sum, flow) => sum + flow.qty, 0), 0)
  assert.equal(movements.find(flow => flow.woolOrderId === order.woolOrderId)!.qty, 4)
  assert.equal(current.yarnReceipts.filter(item => item.factoryReceiptId === receipt.id).length, 1)
})
check('横机投入栏与接收时间读取相同分配事实', () => {
  const html = display.renderWoolStageInputs(order).replace(/<[^>]+>/g, '')
  assert.match(html, /实收：4 kg/); assert.match(html, /其中备料分配：4 kg/); assert.match(html, /STOCK-UI-SOURCE/)
  assert.match(display.renderWoolStageTimes(order, true), /2026-09-18 18:00:00/)
})
run('save')
check('重复点击保存不会重复分配', () => assert.equal(core.listReceivingAllocations().length, initialAllocations + 1))
check('缓存重读保留既有分配，独立10kg演示备料不重复接收', () => {
  wool.clearWoolStoreMemoryCache(); wool.readWoolStore()
  assert.equal(core.listFactoryReceipts().filter(item => item.id === 'WDEMO-YARN-STOCK-R:20260918').length, 1)
  assert.equal(core.listFactoryReceipts().find(item => item.id === 'WDEMO-YARN-STOCK-R:20260918')!.lines[0].qty, 10)
  assert.equal(core.listReceivingAllocations().length, initialAllocations + 1)
  assert.equal(links.remainingReceivingAllocationQty(lineId), 6)
})
fields.set('keyword', 'NO-MATCH'); fields.set('availability', 'available'); run('query')
check('查询实际缩小范围', () => assert.doesNotMatch(pending.renderWoolPendingReceiptsPage(), /STOCK-UI-RECEIPT/))
run('reset')
check('重置恢复全部备料结果', () => assert.match(pending.renderWoolPendingReceiptsPage(), /STOCK-UI-RECEIPT/))
const own = pda.listAllFactoryPdaUsers().find(user => user.factoryId === order.factoryId)!
pda.setPdaSession(pda.createPdaSessionFromUser(own)); location.pathname = '/fcs/pda/wool/pending-receipts'
check('PDA库存只显示会话工厂并保留图片与分配动作', () => { const html = pending.renderWoolPendingReceiptsPage(); assert.match(html, /本厂纱线备料分配/); assert(stock.listWoolStockAllocationRows().every(row => row.receipt.factoryId === own.factoryId)); assert.match(html, /分配到横机单/) })
check('PDA已分配单跳转本单执行页，不跳桌面详情', () => {
  const html = pending.renderWoolPendingReceiptsPage(), href = `/fcs/pda/exec/${encodeURIComponent(order.taskId)}`
  assert(html.includes(`href="${href}" data-nav="${href}"`))
  assert(!html.includes(`href="${display.woolStageDetailPath(order)}"`))
})
const { dispatchPdaPageEvent } = await import('../src/main-handlers/pda-handlers.ts')
const pdaAction = { dataset: { woolStockAction: 'allocate', id: lineId } }
const pdaTarget = { closest: (selector: string) => ['[data-wool-stock-page]', '[data-wool-receiving-page]'].includes(selector) ? {} : selector === '[data-wool-stock-action]' ? pdaAction : null } as unknown as HTMLElement
const clickHandled = await dispatchPdaPageEvent(pdaTarget, new Event('click'))
const inputHandled = await dispatchPdaPageEvent({ dataset: { woolStockField: 'qty' }, value: '1', closest: (selector: string) => ['[data-wool-stock-page]', '[data-wool-receiving-page]'].includes(selector) ? {} : null } as unknown as HTMLElement, new Event('input'))
check('实际PDA事件分发可打开分配并处理输入，未提前写分配', () => { assert(clickHandled); assert(inputHandled); assert.match(overlay.innerHTML, /复核分配/); assert.equal(core.listReceivingAllocations().length, initialAllocations + 1) })
const foreign = pda.listAllFactoryPdaUsers().find(user => user.factoryId !== order.factoryId)!
pda.setPdaSession(pda.createPdaSessionFromUser(foreign))
check('切换其他厂会话后原备料和候选不可见，不可分配', () => { assert(!stock.listWoolStockAllocationRows().some(row => row.line.id === lineId)); assert.equal(stock.listWoolStockAllocationTargets(lineId).length, 0); run('allocate', lineId); assert.match(error.textContent, /已无可分配余量/); assert.equal(core.listReceivingAllocations().length, initialAllocations + 1) })
pda.setPdaSession(null)
check('PDA无身份时不显示库存', () => { assert.match(pending.renderWoolPendingReceiptsPage(), /请先登录本厂 PDA/); assert.equal(stock.listWoolStockAllocationRows().length, 0) })

// Exercise the actual stage-list event contract, not a duplicate filter implementation.
location.pathname = '/fcs/craft/wool/knitting-orders'; location.search = ''
Object.defineProperty(globalThis, 'HTMLInputElement', { configurable: true, value: class {} })
const stage = await import('../src/pages/process-factory/wool/stage-orders.ts')
stage.renderCraftWoolStageOrdersPage('KNITTING')
const setStageFilter = async (name: string, value: string) => {
  const field = { dataset: { woolWorkOrdersField: name }, value }
  const target = { closest: (selector: string) => selector === '[data-wool-work-orders-root]' ? {} : selector === '[data-wool-work-orders-field]' ? field : null } as unknown as HTMLElement
  assert(await stage.handleCraftWoolStageOrdersEvent(target))
}
const hasTarget = () => stage.renderCraftWoolStageOrdersPage('KNITTING').includes(`href="${display.woolStageDetailPath(order)}"`)
await setStageFilter('woolOrderNo', order.woolOrderNo)
await setStageFilter('receiptState', 'RECEIVED')
check('仅备料分配的横机单归入已具备接收条件', () => assert(hasTarget()))
await setStageFilter('receiptState', 'NONE')
check('已分配实收纱线的横机单不再归入尚未接收', () => assert(!hasTarget()))
await setStageFilter('receiptState', '')
await setStageFilter('timeField', 'RECEIVED')
await setStageFilter('plannedFrom', '2026-09-18'); await setStageFilter('plannedTo', '2026-09-18')
check('接收时间筛选包含备料原实际接收日期', () => assert(hasTarget()))

const receiveAndAllocate = (suffix: string, receivedAt: string) => {
  const extra = structuredClone(source)
  extra.id = extra.documentNo = `STOCK-${suffix}`; extra.lines[0].id = `STOCK-${suffix}-LINE`
  core.registerFactoryReceivingSource(extra)
  const actual = links.confirmFactoryMaterialReceipt({ id: `STOCK-${suffix}-RECEIPT`, factoryId: order.factoryId, operatorId: 'WAREHOUSE', operatorName: '仓管', receivedAt, remark: '接收时间专项', lines: [{ sourceId: extra.id, sourceLineId: extra.lines[0].id, ...core.getDefaultFactoryReceiptPosition(order.factoryId), grossKg: 1.062, pcs: 1, tubes: { PAPER: 1, CONICAL: 0, PAGODA: 0 } }] })
  links.allocateReceivedMaterialToOrder({ id: `STOCK-${suffix}-ALLOCATION`, receiptLineId: actual.lines[0].id, woolOrderId: order.woolOrderId, qty: 1, operatorName: '仓管', at: '2026-09-20 12:00:00' })
}
receiveAndAllocate('LATER', '2026-09-19 19:00:00')
receiveAndAllocate('EARLIER', '2026-09-17 17:00:00')
check('先新后旧分配仍取最晚实收时间，数量不会重复', () => {
  const aggregate = queries.getWoolWorkOrderReadinessProjection(order.woolOrderId).yarnReceiptsBySku.get(receipt.lines[0].material.sku)!
  assert.equal(aggregate.receivedQty, 6); assert.equal(aggregate.effectiveRecordCount, 3)
  assert.equal(aggregate.latestReceivedAt, '2026-09-19 19:00:00')
  assert.match(display.renderWoolStageTimes(order).replace(/<[^>]+>/g, ''), /上游接收：最近 2026-09-19 19:00:00 · 3 笔/)
})
check('接收筛选随新增事实失效重算，不继续命中旧日期', () => assert(!hasTarget()))
await setStageFilter('plannedFrom', '2026-09-19'); await setStageFilter('plannedTo', '2026-09-19')
check('接收筛选与列表最近实收日期一致', () => assert(hasTarget()))
const boundSource = core.getFactoryReceivingSource('WDEMO-YARN:WOOL-STAGE-001')!
links.confirmFactoryMaterialReceipt({ id: 'STOCK-BOUND-LATEST', factoryId: order.factoryId, operatorId: 'WAREHOUSE', operatorName: '仓管', receivedAt: '2026-09-20 20:00:00', remark: '直接实收与备料汇总', lines: [{ sourceId: boundSource.id, sourceLineId: boundSource.lines[0].id, ...core.getDefaultFactoryReceiptPosition(order.factoryId), grossKg: 1.062, pcs: 1, tubes: { PAPER: 1, CONICAL: 0, PAGODA: 0 } }] })
links.allocateReceivedMaterialToOrder({ id: 'STOCK-OLD-AFTER-BOUND', receiptLineId: lineId, woolOrderId: order.woolOrderId, qty: 0.5, operatorName: '仓管', at: '2026-09-21 12:00:00' })
check('直接实收与备料分配共同汇总，旧分配不覆盖最新日期', () => {
  const projection = queries.getWoolWorkOrderReadinessProjection(order.woolOrderId)
  const aggregate = projection.yarnReceiptsBySku.get(receipt.lines[0].material.sku)!
  assert.equal(aggregate.receivedQty, 7.5); assert.equal(aggregate.effectiveRecordCount, 4)
  assert.equal(aggregate.latestReceivedAt, '2026-09-20 20:00:00')
  projection.yarnReceiptsBySku.clear(); projection.outputsBySku.clear()
  assert.equal(queries.getWoolWorkOrderReadinessProjection(order.woolOrderId).yarnReceiptsBySku.get(receipt.lines[0].material.sku)!.receivedQty, 7.5)
})
check('同一可变草稿连续修改数量仍即时重算，不命中只读缓存', () => {
  const draft = wool.readWoolStore(), sample = structuredClone(draft.processReports[0])
  sample.reportId = 'DRAFT-ONLY'; sample.woolOrderId = order.woolOrderId; sample.outputSkuCode = order.outputPlanLines[0].outputSkuCode; sample.reportedQty = 2
  draft.processReports.push(sample)
  const projected = () => queries.getWoolWorkOrderReadinessProjectionFromStore(draft, order.woolOrderId).outputsBySku.get(sample.outputSkuCode)!.readiness
  assert.equal(projected().reportedQty, 2)
  sample.reportedQty = 7
  assert.equal(projected().reportedQty, 7)
  assert.equal(queries.getWoolOutputReadiness(order.woolOrderId, sample.outputSkuCode).reportedQty, 0)
})
receiveAndAllocate('SAME-DAY-ISO', '2026-09-20T21:00:00')
receiveAndAllocate('SAME-DAY-SPACE', '2026-09-20 22:00:00')
check('同日T与空格时间格式的汇总和列表排序一致', () => {
  assert.equal(queries.getWoolWorkOrderReadinessProjection(order.woolOrderId).yarnReceiptsBySku.get(receipt.lines[0].material.sku)!.latestReceivedAt, '2026-09-20 22:00:00')
  assert.match(display.renderWoolStageTimes(order).replace(/<[^>]+>/g, ''), /上游接收：最近 2026-09-20 22:00:00/)
})
const automatic = wool.readWoolStore().handovers.find(item => item.automatic && wool.readWoolStore().workOrders[item.woolOrderId]?.stage === 'KNITTING')!
const automaticOrder = wool.readWoolStore().workOrders[automatic.woolOrderId]
await setStageFilter('woolOrderNo', automaticOrder.woolOrderNo); await setStageFilter('timeField', 'HANDOVER')
await setStageFilter('plannedFrom', automatic.handedOverAt.slice(0, 10)); await setStageFilter('plannedTo', automatic.handedOverAt.slice(0, 10))
check('自动内部交出与列表时间一致，可按最近交出筛选', () => {
  assert(stage.renderCraftWoolStageOrdersPage('KNITTING').includes(`href="${display.woolStageDetailPath(automaticOrder)}"`))
  assert.match(display.renderWoolStageTimes(automaticOrder).replace(/<[^>]+>/g, ''), /下游交出：最近/)
})
console.log(`毛织备料分配：${checks} 项通过；不替代真实浏览器及性能验收。`)
