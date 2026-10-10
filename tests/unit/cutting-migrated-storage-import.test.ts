import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

test('初始演示订单正常新增装袋手动票进入当前正式放行，保留原目标与放行且不混入PDA变体物料', () => {
  const script = `
    const assert = (await import('node:assert/strict')).default
    const values = new Map(), writes = []
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem(key) { return values.get(key) ?? null }, setItem(key, value) { writes.push(key); values.set(key, value) }, removeItem(key) { writes.push(key); values.delete(key) },
    } })
    const source = await import('./src/data/fcs/cutting/generated-cut-orders.ts')
    const fei = await import('./src/data/fcs/cutting/generated-fei-tickets.ts')
    const ledger = await import('./src/data/fcs/cutting/cutting-runtime-event-ledger.ts')
    const release = await import('./src/data/fcs/cut-piece-release.ts')
    const po = 'PO-202603-0002'
    const before = release.getCutPieceReleaseSummaryForProductionOrder(po)
    const formal = source.listGeneratedCutOrderSourceRecords().find(s => s.productionOrderId === po && s.materialName === '主面料')
    const part = formal.pieceRows.find(p => p.partName === '后片'), sku = formal.skuScopeLines.find(s => s.size === 'M')
    const ticket = {...formal, partCode: part.partCode, partName: part.partName, skuCode: sku.skuCode, skuSize: sku.size,
      garmentColor: sku.color, fabricColor: formal.materialColor,
      specialCrafts: fei.resolveFeiTicketSpecialCraftsForPart({productionOrderId: po, partCode: part.partCode, partName: part.partName, outputLineId: 'MANUAL-LIVE-PO2', sizeCode: sku.size, actualCutPieceQty: 5, bundleQty: 1}), hasSpecialCraft: true,
      feiTicketId: 'MANUAL-LIVE-PO2', feiTicketNo: 'TM-LIVE-001', sourceBasisType: 'MANUAL_MARKER_PLAN', printStatus: 'PRINTED',
      qty: 5, actualCutPieceQty: 5, spreadingOrderNo: '', pieceSequenceRange: null, issuedAt: '2026-10-10T00:00:00Z'}
    assert.ok(ticket.cutOrderId, '测试必须使用该生产单的正式真实部位来源')
    values.set('cuttingManualFeiTicketSources', JSON.stringify({records: [ticket], operationLogs: []}))
    // 仅衡量下面的普通放行重读，排除此独立 Node 夹具导入时既有后道迁移。
    writes.length = 0
    const pack = {eventId: 'PACK-LIVE-PO2', eventType: '菲票装袋', eventStatus: '已同步', occurredAt: '2026-10-10T00:01:00Z',
      source: 'WEB', operatorName: '仓管', refs: {productionOrderId: po, transferBagCode: 'BAG-LIVE-PO2'},
      payload: {bagCode: 'BAG-LIVE-PO2', feiTicketItems: [{feiTicketId: ticket.feiTicketId, feiTicketNo: ticket.feiTicketNo, pieceQty: 5}]}, inventoryEffects: []}
    ledger.installCuttingCommittedEventReader(() => [pack]); ledger.installManagedCuttingEventScope(true)
    await release.hydrateCutPieceReleaseRecords({revision: 0, records: []})
    const matrix = release.getCutPieceReleaseMatrix(po)
    const details = matrix.colorGroups.flatMap(g => g.materialRows.flatMap(r => r.cells.flatMap(c => c.partCalculations.flatMap(p => p.ticketDetails))))
    assert.ok(details.some(d => d.ticketId === ticket.feiTicketId), '真实新增已装袋票不能被初始订单过滤排除')
    assert.ok(!matrix.colorGroups.some(g => g.materialRows.some(r => r.materialName.includes('PDA 异常同步'))), '专项变体不是额外必需BOM')
    const grey = matrix.colorGroups.find(g => g.garmentColor === 'Grey')
    assert.equal(grey.completeKitBySize.M, 0, '只有后片，不能漏掉其他必需部位而算齐套')
    const after = release.getCutPieceReleaseSummaryForProductionOrder(po)
    assert.deepEqual(after.targetQtyByColorSize, before.targetQtyByColorSize); assert.equal(after.totalReleaseConfirmQty, before.totalReleaseConfirmQty)
    assert.deepEqual(writes, [], '普通重新读取不写种子或改原决定')
    process.exit(0)
  `
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], { encoding: 'utf8', timeout: 10_000 })
  assert.equal(result.status, 0, result.stderr || String(result.error))
})

test('旧存储 getter 不可读时，后道演示开关不阻断裁床依赖模块导入', () => {
  const moduleUrl = new URL('../../src/data/fcs/post-finishing-full-flow.ts', import.meta.url).href
  // 在独立进程模拟浏览器导入，避免依赖模块的浏览器轮询占用测试进程。
  const script = `
    let accesses = 0
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { addEventListener() {}, removeEventListener() {}, location: new URL('http://127.0.0.1:4190/') } })
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { addEventListener() {} } })
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { accesses += 1; throw new Error('旧存储不可读取') } })
    try {
      await import(${JSON.stringify(moduleUrl)})
      if (!accesses) throw new Error('未执行 getter 反例')
      process.exit(0)
    } catch (error) {
      console.error(error)
      process.exit(1)
    }
  `
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], { encoding: 'utf8', timeout: 10_000 })
  assert.equal(result.status, 0, result.stderr || String(result.error))
})

test('裁床工艺来源读取不初始化未迁移的全厂接收需求，原工艺厂读取仍保护旧源', () => {
  const moduleUrl = new URL('../../src/data/fcs/special-craft-task-orders.ts', import.meta.url).href
  const script = `
    let unrelatedReads = 0
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem(key) { if (key === 'higood.formal-material-requests.v1') { unrelatedReads += 1; throw new Error('原接收需求不可读取') } return null },
      setItem() {}, removeItem() {},
    } })
    try {
      const source = await import(${JSON.stringify(moduleUrl)})
      const rows = source.listCutPieceSpecialCraftTaskOrderSources()
      if (!rows.length || rows.some(row => row.targetObject !== '已裁部位') || unrelatedReads) throw new Error('裁床来源错误读取了全厂接收需求')
      let protectedOriginal = false
      try { source.listSpecialCraftTaskOrders() } catch (error) { protectedOriginal = String(error).includes('原接收需求不可读取') }
      if (!protectedOriginal || !unrelatedReads) throw new Error('原工艺厂接收需求读取被错误绕过')
      process.exit(0)
    } catch (error) { console.error(error); process.exit(1) }
  `
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], { encoding: 'utf8', timeout: 10_000 })
  assert.equal(result.status, 0, result.stderr || String(result.error))
})

test('先读裁床来源再进入工艺厂，任务身份与需求数量一致且仓库记录可正常生成', () => {
  const moduleUrl = new URL('../../src/data/fcs/special-craft-task-orders.ts', import.meta.url).href
  const warehouseUrl = new URL('../../src/data/fcs/factory-internal-warehouse.ts', import.meta.url).href
  const script = `
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem() { return null }, setItem() {}, removeItem() {} } })
    try {
      const source = await import(${JSON.stringify(moduleUrl)})
      const identity = row => JSON.stringify({ id: row.taskOrderId, sourceTaskId: row.sourceTaskId, operationId: row.operationId, productionOrderId: row.productionOrderId, targetObject: row.targetObject, planQty: row.planQty, demandLines: row.demandLines })
      const before = source.listCutPieceSpecialCraftTaskOrderSources().map(row => ({ id: row.taskOrderId, identity: identity(row) }))
      const full = source.listSpecialCraftTaskOrders()
      if (!before.length || before.some(row => !full.some(candidate => candidate.taskOrderId === row.id && identity(candidate) === row.identity))) throw new Error('工艺厂读取改变了裁床任务身份或需求数量')
      const warehouse = await import(${JSON.stringify(warehouseUrl)})
      const inboundIds = new Set(warehouse.listFactoryWarehouseInboundRecords().map(row => row.inboundRecordId))
      const required = full.filter(row => before.some(candidate => candidate.id === row.taskOrderId)).flatMap(row => row.inboundRecordIds || [])
      if (!required.length || required.some(id => !inboundIds.has(id))) throw new Error('延后进入工艺厂未生成关联仓库记录')
      process.exit(0)
    } catch (error) { console.error(error); process.exit(1) }
  `
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], { encoding: 'utf8', timeout: 10_000 })
  assert.equal(result.status, 0, result.stderr || String(result.error))
})

test('已准备任务来源后，任务单预览不加载无关工艺厂接收来源', () => {
  const dataUrl = new URL('../../src/data/fcs/dispatch-task-sheet.ts', import.meta.url).href
  const previewUrl = new URL('../../src/pages/print/print-preview.ts', import.meta.url).href
  const script = `
    let unrelatedReads = 0
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem(key) { if (key === 'higood.formal-material-requests.v1') { unrelatedReads += 1; throw new Error('无关接收来源不可读取') } return null },
      setItem() {}, removeItem() {},
    } })
    try {
      const data = await import(${JSON.stringify(dataUrl)})
      const assignment = data.listDispatchTaskSheetAssignments().find(row => row.processCodes.some(code => /SEW/.test(code)))
      if (!assignment) throw new Error('缺少原有已分配车缝任务')
      const preview = await import(${JSON.stringify(previewUrl)})
      const html = await preview.renderUnifiedPrintPreviewPage({ documentType: 'DISPATCH_TASK_SHEET', sourceType: 'EFFECTIVE_TASK_ASSIGNMENT', sourceId: assignment.assignmentId })
      if (unrelatedReads || !html.includes('data-dispatch-task-sheet') || !html.includes(assignment.factoryName) || html.includes('打印预览无法生成')) throw new Error('任务单预览未能按原来源生成：'+JSON.stringify({ unrelatedReads, hasSheet: html.includes('data-dispatch-task-sheet'), hasFactory: html.includes(assignment.factoryName), failed: html.includes('打印预览无法生成') }))
      process.exit(0)
    } catch (error) { console.error(error); process.exit(1) }
  `
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], { encoding: 'utf8', timeout: 10_000 })
  assert.equal(result.status, 0, result.stderr || String(result.error))
})
