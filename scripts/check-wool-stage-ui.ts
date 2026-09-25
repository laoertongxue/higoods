import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

// Isolated in-memory browser storage; this check never opens or clears user browser data.
const values = new Map<string, string>()
const storage = { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) }
const location = { pathname: '/fcs/craft/wool/pending-receipts', search: '?workOrderId=WOOL-STAGE-010%3ALINKING', origin: 'http://localhost:5186' }
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage, sessionStorage: storage, addEventListener() {}, dispatchEvent() {}, location } })
Object.defineProperty(globalThis, 'document', { configurable: true, value: { addEventListener() {}, querySelector() { return null }, querySelectorAll() { return [] } } })
// Explicit empty isolated record snapshot replaces the browser bootstrap normally run by main.
await (await import('../src/data/fcs/cutting/part-ticket-records.ts')).hydratePartTicketRecords({ revision: 0, records: [] })
await (await import('../src/data/fcs/production-context-records.ts')).hydrateProductionContextRecords({ revision: 0, records: [] })
let checks = 0
const failures: string[] = []
const check = (name: string, fn: () => void) => {
  try { fn(); checks++; console.log(`✓ ${name}`) }
  catch (error) { failures.push(name); console.error(`✗ ${name}`, error) }
}
const wool = await import('../src/data/fcs/wool-domain/store.ts')
const { renderWoolStageQuantities, renderWoolStageProgress } = await import('../src/pages/process-factory/wool/stage-display.ts')
const { renderCraftWoolStageOrderDetailPage } = await import('../src/pages/process-factory/wool/stage-order-detail.ts')
const { renderCraftWoolHandoverPrintPage } = await import('../src/pages/process-factory/wool/handover-print.ts')
const { renderWoolPendingReceiptsPage } = await import('../src/pages/process-factory/wool/pending-receipts.ts')
const { resolveWoolPdaScan } = await import('../src/data/fcs/wool-pda-scan.ts')
const { buildWoolMobileTaskProjection } = await import('../src/data/fcs/wool-domain/mobile.ts')
const pda = await import('../src/pages/pda-wool-fact-execution.ts')
const session = await import('../src/data/fcs/store-domain-pda.ts')
const receiving = await import('../src/data/fcs/factory-receiving.ts')
const { confirmFactoryMaterialReceipt } = await import('../src/data/fcs/factory-receiving-links.ts')
const store = wool.readWoolStore(), closed = store.workOrders['WOOL-STAGE-013:LINKING'], closedKnit = store.workOrders['WOOL-STAGE-005:KNITTING']
const linking = store.workOrders['WOOL-STAGE-010:LINKING'], knitting = store.workOrders['WOOL-STAGE-008:KNITTING']
const text = (html: string) => html.replace(/<[^>]+>/g, '')
check('缝盘数量展示指定下游实际接收件数', () => assert.match(text(renderWoolStageQuantities(closed)), /下游实际接收：100 件/))
check('已完单数量与处理进度的可填报数量均为零', () => {
  assert.match(text(renderWoolStageQuantities(closedKnit)), /当前可填报：0 件/)
  assert.match(text(renderWoolStageProgress(closedKnit)), /还可填报 0 件/)
  assert.match(text(renderWoolStageProgress(closedKnit)), /纱线种类具备开工条件：1\/1 个 SKU/)
})
check('详情拒绝错误阶段，正常阶段仍可渲染', () => {
  assert.match(renderCraftWoolStageOrderDetailPage(linking.woolOrderId, 'KNITTING'), /data-wool-stage-mismatch/)
  assert.doesNotMatch(renderCraftWoolStageOrderDetailPage(linking.woolOrderId, 'LINKING'), /data-wool-stage-mismatch/)
})
check('打印拒绝错误阶段且不暴露打印按钮', () => {
  const html = renderCraftWoolHandoverPrintPage(closed.woolOrderId, undefined, 'KNITTING')
  assert.match(html, /data-wool-stage-mismatch/); assert.doesNotMatch(html, /data-wool-print-button/)
  assert.match(renderCraftWoolHandoverPrintPage(closed.woolOrderId, undefined, 'LINKING'), /缝盘加工交出单/)
})
check('阶段页面完成文件迁移，路由捕获并传入阶段', () => {
  assert(!existsSync('src/pages/process-factory/wool/work-orders.ts'))
  assert(!existsSync('src/pages/process-factory/wool/work-order-detail.ts'))
  const source = readFileSync('src/router/routes-fcs.ts', 'utf8')
  assert.match(source, /renderCraftWoolStageOrderDetailPage\(decodeURIComponent\(match\[2\]\), match\[1\] === 'knitting-orders'/)
  assert.match(source, /decodeURIComponent\(match\[3\]\),\s*match\[1\] === 'knitting-orders'/)
})
check('待接收毛织片明确显示款式参考图及非片实拍', () => assert.match(text(renderWoolPendingReceiptsPage()), /款式参考图非片实拍/))
check('缝盘回货扫码匹配新接收动作', () => assert.equal(resolveWoolPdaScan(linking.woolOrderNo, linking.factoryId, 'RECEIVE').status, 'MATCH'))
check('缝盘PDA不再索要纱线，并保留实际片接收记录', () => {
  const projection = buildWoolMobileTaskProjection(linking.woolOrderId)
  assert.equal(projection.missingYarnSkus.length, 0)
  assert.equal(projection.factRecords.filter(record => record.recordType === 'PIECE_RECEIPT').length, 2)
  const html = pda.renderPdaWoolExecutionContent(linking.taskId, { canAccess: true, reasonCode: 'OK', reasonLabel: '', order: linking, task: null })
  assert.doesNotMatch(html, /缺少任一必需纱线|已达到计划数量的 150%/)
})
const user = session.listAllFactoryPdaUsers().find(user => user.factoryId === knitting.factoryId)!
assert(user, '本厂PDA用户必须存在')
session.setPdaSession(session.createPdaSessionFromUser(user))
check('横机PDA存在可用外发片时能够提交交出', () => {
  pda.renderPdaWoolHandoverContent(knitting.taskId, 'HANDOVER')
  const overlay = { innerHTML: '' }
  const root = { dataset: { taskId: knitting.taskId, woolOrderId: knitting.woolOrderId, woolSurface: 'HANDOVER_HANDOUT' }, querySelector: () => overlay }
  const action = { dataset: { pdaWoolAction: 'open-fact', woolFactAction: 'HANDOVER' } }
  const target = { closest: (selector: string) => selector === '[data-pda-wool-root]' ? root : selector === '[data-pda-wool-action]' ? action : null } as unknown as HTMLElement
  assert(pda.handlePdaWoolExecutionEvent(target))
  const saveButton = overlay.innerHTML.match(/<button[^>]*data-pda-wool-action="save-fact"[^>]*>/)?.[0]
  assert(saveButton, '应渲染保存交出按钮'); assert.doesNotMatch(saveButton, /\sdisabled(?:\s|=|>)/)
})
check('演示待收纱线通过正常统一接收入口', () => {
  const source = receiving.getFactoryReceivingSource('WDEMO-YARN:WOOL-STAGE-001')!
  const receipt = confirmFactoryMaterialReceipt({ id: 'STAGE-UI-REVIEW-YARN', factoryId: source.targetFactoryId, operatorId: user.userId, operatorName: user.name,
    receivedAt: '2026-09-18 17:00:00', remark: '隔离验证', lines: [{ sourceId: source.id, sourceLineId: source.lines[0].id, ...receiving.getDefaultFactoryReceiptPosition(source.targetFactoryId), grossKg: 1.062, pcs: 1, tubes: { PAPER: 1, CONICAL: 0, PAGODA: 0 } }] })
  assert.equal(receipt.lines[0].qty, 1)
})
check('PDA接收使用独立PDA路由并有返回入口', () => {
  assert(readFileSync('src/router/routes-pda.ts', 'utf8').includes('/fcs/pda/wool/pending-receipts'))
  assert(readFileSync('src/pages/pda-wool-fact-execution.ts', 'utf8').includes('/fcs/pda/wool/pending-receipts'))
  location.pathname = '/fcs/pda/wool/pending-receipts'; location.search = '?workOrderId=WOOL-STAGE-010%3ALINKING'
  const html = renderWoolPendingReceiptsPage()
  assert.match(html, /返回/); assert.match(text(html), /款式参考图非片实拍/)
  assert.match(html, /data-wool-receiving-page data-skip-page-rerender="true"/)
})
const { dispatchPdaPageEvent } = await import('../src/main-handlers/pda-handlers.ts')
const { listWoolPendingReceiptRows } = await import('../src/pages/process-factory/wool/pending-receipts.ts')
const pending = listWoolPendingReceiptRows().find(row => row.line.woolOrderId === linking.woolOrderId && row.remainingQty > 0)!
assert(pending, '缝盘待收片场景存在')
const receiptCount = receiving.listFactoryReceipts().length
const overlay = { innerHTML: '' }, root = {}
const action = { dataset: { woolReceivingAction: 'receive', id: pending.key } }
const clickTarget = { closest: (selector: string) => selector === '[data-wool-receiving-page]' ? root : selector === '[data-wool-receiving-action]' ? action : null } as unknown as HTMLElement
const originalQuery = document.querySelector
document.querySelector = ((selector: string) => selector === '[data-wool-receiving-overlay]' ? overlay : null) as typeof document.querySelector
const dispatchedClick = await dispatchPdaPageEvent(clickTarget, new Event('click'))
check('PDA真实分发器打开片接收弹窗且未提前保存', () => {
  assert(dispatchedClick)
  assert.match(overlay.innerHTML, /缝盘外加工片接收/)
  assert.equal(receiving.listFactoryReceipts().length, receiptCount)
})
const inputTarget = { dataset: { woolReceivingField: 'pieceQty' }, value: '1', closest: (selector: string) => selector === '[data-wool-receiving-page]' ? root : null } as unknown as HTMLElement
const dispatchedInput = await dispatchPdaPageEvent(inputTarget, new Event('input'))
check('PDA真实分发器处理输入且接收事实未改变', () => {
  assert(dispatchedInput)
  assert.equal(receiving.listFactoryReceipts().length, receiptCount)
})
document.querySelector = originalQuery
assert.equal(failures.length, 0, `失败项：${failures.join('；')}`)
console.log(`毛织阶段页面对抗审查修复：${checks} 项通过；此检查不替代浏览器与性能验收。`)
