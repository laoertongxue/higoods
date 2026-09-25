async page => {
  // Functional acceptance on dev43235; separate disposable contexts, outside strict windows.
  // Imported mixed.higcut and module-created unused/preprinted tickets are explicit
  // Mock prerequisites. Tested scans, bagging, handover, recovery and printing use UI.
  const origin = 'http://127.0.0.1:43235'
  const fixturePath = '/private/tmp/higoods-replacement-fabric-release-20260925/output/playwright/hpb/acceptance-final/mixed.higcut'
  const result = { origin, fixturePath, printing: 'window.print is intercepted as software-only evidence; no physical output claim', scenarios: [] }
  const assert = (value, reason) => { if (!value) throw Error(reason) }
  const readRecords = p => p.evaluate(async () => (await (await import(performance.getEntriesByType('resource').map(entry=>entry.name).find(url=>new URL(url).pathname==='/src/data/fcs/cutting/cutting-record-repository.ts') || '/src/data/fcs/cutting/cutting-record-repository.ts')).readCuttingRecords()).records)
  const savedEvents = records => records.filter(record => record.collection === 'cutting-events').map(record => record.value)
  async function importMixed(p) {
    await p.goto(origin + '/fcs/craft/cutting/replacement-fabric-fei-tickets')
    await p.locator('[data-hpb-action=data-tools]').click()
    await p.locator('[data-hpb-restore-file]').setInputFiles(fixturePath)
    await p.waitForFunction(() => document.querySelector('[data-hpb-data-message]')?.textContent.includes('已恢复'))
  }
  async function login(p) {
    await p.goto(origin + '/fcs/pda/auth/login')
    await p.getByRole('textbox', { name: '登录账号' }).fill('OWN-CUTTING-001_admin')
    await p.getByRole('textbox', { name: '密码', exact: true }).fill('123456')
    await p.getByRole('button', { name: '登录', exact: true }).click(); await p.waitForURL('**/fcs/pda/exec')
  }
  async function bagPage(p, bagCode) {
    await p.setViewportSize({ width: 390, height: 844 })
    await p.goto(origin + '/fcs/pda/warehouse/wait-handover?scope=cutting')
    await p.locator('[data-pda-cutting-wait-handover-entry=fei-ticket-bagging]').click()
    await p.getByPlaceholder('扫描中转袋', { exact: true }).fill(bagCode)
    await p.getByPlaceholder('扫描中转袋', { exact: true }).press('Enter')
    await p.getByPlaceholder('连续扫描菲票', { exact: true }).waitFor()
  }
  async function scan(p, ticketNo) {
    await p.getByPlaceholder('连续扫描菲票', { exact: true }).fill(ticketNo)
    await p.getByPlaceholder('连续扫描菲票', { exact: true }).press('Enter')
  }
  async function waitText(p, text) { await p.waitForFunction(text => document.body.innerText.includes(text), text) }
  async function saveBag(p) {
    await p.getByRole('button', { name: '确认装袋', exact: true }).click(); await waitText(p, '装袋成功')
  }
  async function freshPrintedTicket(p, orderId, commandSuffix) {
    return p.evaluate(async ({ orderId, commandSuffix }) => {
      const source = await import(performance.getEntriesByType('resource').map(entry=>entry.name).find(url=>new URL(url).pathname==='/src/data/fcs/cutting/replacement-fabric-source.ts') || '/src/data/fcs/cutting/replacement-fabric-source.ts'), repo = await import(performance.getEntriesByType('resource').map(entry=>entry.name).find(url=>new URL(url).pathname==='/src/data/fcs/cutting/replacement-fabric-repository.ts') || '/src/data/fcs/cutting/replacement-fabric-repository.ts')
      await repo.loadReplacementFabricState()
      const row = source.listReplacementFabricOrderRows().find(row => row.order.productionOrderId === orderId)
      if (!row || row.issues.length || !row.materials.length) throw Error('No complete eligible Mock order: ' + orderId)
      const scope = row.scopes.find(scope => scope.materials.length && !scope.issues.length)
      const ticket = (await repo.addReplacementFabricTickets(scope, scope.materials[0].key, 1, { id: 'MOCK-BAG-BOUNDARY-ADD-' + commandSuffix, at: '2026-09-25T00:00:00Z', operator: '明确Mock前置' }))[0]
      await repo.saveReplacementFabricPrint([ticket.id], source.listReplacementFabricOrderRows().flatMap(row => row.scopes), { id: 'MOCK-BAG-BOUNDARY-PRINT-' + commandSuffix, at: '2026-09-25T00:00:00Z', operator: '明确Mock预先已打印票' })
      return { id: ticket.id, ticketNo: ticket.ticketNo, productionOrderId: ticket.productionOrderId, sequence: ticket.sequence, unit: ticket.unit, length: ticket.length }
    }, { orderId, commandSuffix })
  }
  async function runScenario(requirements, run) {
    const context = await page.context().browser().newContext({ viewport: { width: 1366, height: 768 } })
    const p = await context.newPage(), out = { requirements, errors: [] }
    await p.addInitScript(()=>performance.setResourceTimingBufferSize(10000)); await p.routeWebSocket('**',socket=>socket.close());p.setDefaultTimeout(10000); p.on('pageerror', error => out.errors.push(String(error)))
    try { await run(p, out); assert(!out.errors.length, 'Uncaught browser error'); out.passed = true }
    catch (error) { out.passed = false; out.error = String(error); out.url = p.url(); out.body = (await p.locator('body').innerText()).slice(-6500) }
    finally { await context.close() }
    result.scenarios.push(out)
  }
  await runScenario(['BAG-009', 'BAG-010', 'BAG-011'], async (p, out) => {
    const bagCode = 'BAG-HPB-MIXED-VERIFY', oldCycle = 'CYCLE-' + bagCode
    await importMixed(p); await login(p)
    out.reuseTicket = await freshPrintedTicket(p, 'PO-202603-0002', 'REUSE')
    await p.goto(origin+'/fcs/craft/cutting/transfer-bags'); await p.locator('[data-transfer-bags-action=new-master]').waitFor();
    out.original = await p.evaluate(async cycle => {
      const label = await import(performance.getEntriesByType('resource').map(entry=>entry.name).find(url=>new URL(url).pathname==='/src/data/fcs/cutting/transfer-bag-goods-label.ts') || '/src/data/fcs/cutting/transfer-bag-goods-label.ts')
      const source = label.resolveTransferBagGoodsLabelSource(cycle)
      if (!source || source.tickets.length !== 3) throw Error('Original mixed Mock must contain three ticket types: '+JSON.stringify({source,events:(await import(performance.getEntriesByType('resource').map(e=>e.name).find(url=>new URL(url).pathname==='/src/data/fcs/cutting/cutting-runtime-event-ledger.ts')||'/src/data/fcs/cutting/cutting-runtime-event-ledger.ts')).listManagedCuttingRuntimeEvents().filter(e=>e.refs.transferBagCode==='BAG-HPB-MIXED-VERIFY'),moduleUrls:performance.getEntriesByType('resource').map(x=>x.name).filter(x=>x.includes('cutting-runtime-event-ledger.ts')||x.includes('transfer-bag-goods-label.ts'))}))
      return source
    }, oldCycle)
    const canonical = tickets => JSON.stringify(tickets.map(ticket => ({ id: ticket.feiTicketId, no: ticket.feiTicketNo, kind: ticket.ticketKind || 'CUT_PIECE', quantity: ticket.quantity ?? ticket.pieceQty, unit: ticket.quantityUnit || '片' })).sort((a, b) => a.id.localeCompare(b.id)))
    const oldIdentity = canonical(out.original.tickets)
    out.oldHpb = out.original.tickets.find(ticket => ticket.ticketKind === 'REPLACEMENT_FABRIC')
    assert(out.oldHpb && out.original.tickets.some(ticket => ticket.ticketKind === 'BINDING_STRIP'), 'Three-kind prerequisite is incomplete')
    // Real archive creation makes the Web identity/cycle/history tabs reachable.
    await p.setViewportSize({ width: 1366, height: 768 }); await p.goto(origin + '/fcs/craft/cutting/transfer-bags')
    await p.locator('[data-transfer-bags-action=new-master]').click()
    await p.locator('[data-transfer-bags-master-draft-field=bagCode]').fill(bagCode)
    await p.locator('[data-transfer-bags-master-draft-field=ownershipFactoryId]').selectOption('OWN-CUTTING-001')
    await p.locator('[data-transfer-bags-action=save-master]').click()
    await p.waitForFunction(() => !document.querySelector('[data-transfer-bags-action=save-master]'))
    await p.locator('tr').filter({ hasText: bagCode }).getByRole('button', { name: '查看袋内菲票明细和差异类型' }).click()
    await p.locator('#transfer-bag-tab-cycle').click()
    const detailUrl = p.url()
    async function verifyGoodsPrint(label) {
      const print = p.locator('[data-cycle-goods-print="' + oldCycle + '"]')
      await print.waitFor()
      const href = await print.getAttribute('data-nav')
      assert(href?.includes('TRANSFER_BAG_GOODS_LABEL'), 'Cycle button points to archive QR rather than goods label')
      const before = JSON.stringify(await readRecords(p))
      await print.click() // Actual business-page navigation; never construct a print URL as fallback.
      await p.locator('[data-testid=transfer-bag-goods-label]').first().waitFor()
      await p.waitForFunction(() => [...document.querySelectorAll('[data-testid=transfer-bag-goods-label] img')].every(img => img.complete && img.naturalWidth))
      const cards = await p.locator('[data-testid=transfer-bag-goods-label]').allTextContents()
      const cycles = await p.locator('[data-testid=transfer-bag-goods-label]').evaluateAll(nodes => nodes.map(node => node.dataset.usageCycleId))
      const text = cards.join('\n')
      assert(cards.length === 3 && cycles.every(cycle => cycle === oldCycle), 'Expected three label pages belonging to the selected old cycle')
      assert(text.includes('货物标识 · 换片布') && text.includes('5 Yard') && text.includes(out.oldHpb.feiTicketNo), 'HPB identity or 5 Yard missing from print')
      assert(text.includes('货物标识 · 捆条') && text.includes('8 米') && text.includes('BND-MIX-2'), 'Binding strip identity or 8 metres missing from print')
      assert(text.includes('20 片') && await p.locator('.transfer-bag-goods-matrix').count() === 1, 'Cut pieces must remain their own 20-piece matrix')
      const source = await p.evaluate(async cycle => (await import(performance.getEntriesByType('resource').map(entry=>entry.name).find(url=>new URL(url).pathname==='/src/data/fcs/cutting/transfer-bag-goods-label.ts') || '/src/data/fcs/cutting/transfer-bag-goods-label.ts')).resolveTransferBagGoodsLabelSource(cycle), oldCycle)
      assert(canonical(source.tickets) === oldIdentity, 'Selected cycle goods source changed identity or quantity')
      await p.evaluate(() => { window.__boundaryPrintCount = 0; window.print = () => { window.__boundaryPrintCount++ } })
      await p.locator('[data-print-preview-action=print]').click(); await p.waitForFunction(() => window.__boundaryPrintCount === 1)
      assert(before === JSON.stringify(await readRecords(p)), 'Goods-label printing rewrote business contents')
      await p.screenshot({ path: '/private/tmp/higoods-replacement-fabric-release-20260925/output/playwright/hpb/acceptance-final/boundary-goods-' + label + '.png', fullPage: true })
      return { label, href, previewUrl: p.url(), cards, cycles, sourceTicketIds: source.tickets.map(ticket => ticket.feiTicketId), sameOldIdentitiesAndUnits: true, softwarePrintInvocations: 1 }
    }
    out.currentPrint = await verifyGoodsPrint('current')
    out.beforeHandover=await p.evaluate(async bag=>({state:(await import(performance.getEntriesByType('resource').map(e=>e.name).find(url=>new URL(url).pathname==='/src/data/fcs/cutting/transfer-bag-operations.ts')||'/src/data/fcs/cutting/transfer-bag-operations.ts')).resolveTransferBagCurrentUse(bag),events:(await (await import(performance.getEntriesByType('resource').map(e=>e.name).find(url=>new URL(url).pathname==='/src/data/fcs/cutting/cutting-record-repository.ts')||'/src/data/fcs/cutting/cutting-record-repository.ts')).readCuttingRecords()).records.filter(r=>r.collection==='cutting-events')}),bagCode)
    // The imported mixed bag is PACKED, so perform the real warehouse receipt first.
    await p.setViewportSize({width:390,height:844}); await p.goto(origin+'/fcs/pda/warehouse/wait-handover?scope=cutting');
    await p.locator('[data-pda-cutting-wait-handover-entry=transfer-bag-inbound]').click();
    await p.getByPlaceholder('扫描中转袋',{exact:true}).fill(bagCode);await p.getByPlaceholder('扫描中转袋',{exact:true}).press('Enter');
    const freeLocation=p.locator('[data-warehouse-map-action=toggle-location][data-location-no]').first();await freeLocation.waitFor();
    out.actualInboundLocation=await freeLocation.getAttribute('data-location-no');await freeLocation.click();
    await p.getByRole('button',{name:'确认入仓',exact:true}).click();await waitText(p,'入仓成功');out.actualInbound=await p.locator('body').innerText();
    // Actually hand over the whole mixed bag, then physically recover through PDA.
    await p.setViewportSize({ width: 390, height: 844 }); await p.goto(origin + '/fcs/pda/cutting/transfer-bag/repack')
    await p.getByPlaceholder('扫描或填写车缝任务编号').fill('TASKGEN-202603-0002-002')
    await p.getByPlaceholder('扫描或填写接收 PPIC 编号').fill('PPIC-ACTIVE-004')
    await p.locator('[data-pda-repack-action=resolve-task]').click(); await p.locator('[data-pda-repack-action=bags-reviewed]').waitFor()
    out.classification = await p.locator('body').innerText(); assert(out.classification.includes(bagCode) && out.classification.includes('整袋直接交出'), 'Expected original mixed bag as direct handover')
    await p.locator('[data-pda-repack-action=bags-reviewed]').click(); await p.locator('[data-pda-repack-action=returns-done]').click(); await p.locator('[data-pda-repack-action=confirm]').click(); await waitText(p, '本次中转袋交出成功')
    out.handover = await p.locator('body').innerText()
    out.afterHandoverEvents=savedEvents(await readRecords(p)).filter(e=>e.refs.transferBagCode===bagCode);
    out.afterHandoverState=await p.evaluate(async bag=>(await import(performance.getEntriesByType('resource').map(e=>e.name).find(url=>new URL(url).pathname==='/src/data/fcs/cutting/transfer-bag-operations.ts')||'/src/data/fcs/cutting/transfer-bag-operations.ts')).resolveTransferBagCurrentUse(bag),bagCode);
    assert(out.afterHandoverState.flowStage==='HANDED_OVER_WAITING_RETURN','Actual persisted handover must project HANDED_OVER_WAITING_RETURN; actual='+out.afterHandoverState.flowStage);
    await p.goto(origin + '/fcs/pda/cutting/transfer-bag/recovery')
    await p.getByPlaceholder('扫描或填写中转袋编号').fill(bagCode); await p.getByPlaceholder('扫描或填写中转袋编号').press('Enter')
    await p.getByLabel('我已收到实物中转袋').check(); await p.getByLabel('我已确认实物袋内没有菲票或裁片').check()
    await p.getByRole('button', { name: '确认回收', exact: true }).click(); await waitText(p, '回收成功，中转袋已变为空闲')
    out.recovered = await p.locator('body').innerText()
    await bagPage(p, bagCode)
    const beforeRejected = JSON.stringify(await readRecords(p))
    await scan(p, out.oldHpb.feiTicketNo); await waitText(p, '这张换片布票已交出，不能重复使用')
    out.oldTicketRejected = await p.locator('[data-pda-cut-inbound-live]').innerText()
    assert(out.oldTicketRejected.includes('已扫菲票 0 张'), 'Recovered physical bag revived an already-handed HPB ticket')
    assert(beforeRejected === JSON.stringify(await readRecords(p)), 'Rejected old ticket changed persisted facts')
    // Real reuse with a fresh independent ticket makes current contents differ from old cycle.
    await scan(p, out.reuseTicket.ticketNo); await waitText(p, '已扫菲票 1 张'); await saveBag(p)
    const afterReuse = await readRecords(p)
    out.savedEvents = savedEvents(afterReuse).filter(event => event.refs.transferBagCode === bagCode || event.refs.transferBagCodes?.includes(bagCode)).map(event => ({ id: event.eventId, type: event.eventType, cycle: event.refs.usageCycleId }))
    assert(out.savedEvents.filter(event => event.type === '中转袋回收').length === 1, 'Actual recovery event was not uniquely saved')
    const baggingCycles = out.savedEvents.filter(event => event.type === '菲票装袋').map(event => event.cycle)
    assert(baggingCycles.includes(oldCycle) && new Set(baggingCycles).size === 2, 'Reused physical bag did not receive a distinct new usage cycle')
    await p.setViewportSize({ width: 1366, height: 768 }); await p.goto(origin + detailUrl.replace(origin, ''))
    await p.locator('#transfer-bag-tab-history').click()
    await p.locator('#transfer-bag-tab-history[aria-selected=true]').waitFor()
    out.history = await p.locator('[data-transfer-bag-detail-layer]').innerText()
    // Canonical recorded-cycle history is required; never bypass missing UI with
    // a hand-built usageCycleId print link or a direct domain print call.
    await p.locator('[data-recorded-bag-cycles]').waitFor()
    const oldRow = p.locator('[data-recorded-cycle="' + oldCycle + '"]')
    assert(await oldRow.count() === 1, 'Recovered mixed cycle has no unique actual history selector')
    await oldRow.click()
    const selected = p.locator('[data-selected-cycle="' + oldCycle + '"]')
    await selected.waitFor()
    out.selectedHistory = await selected.innerText()
    const kinds = await selected.locator('[data-mixed-bag-kind]').evaluateAll(nodes => nodes.map(node => node.dataset.mixedBagKind))
    assert(['CUT_PIECE', 'REPLACEMENT_FABRIC', 'BINDING_STRIP'].every(kind => kinds.includes(kind)), 'Selected history did not preserve all three ticket kinds')
    assert(out.selectedHistory.includes('20 片') && out.selectedHistory.includes('5 Yard') && out.selectedHistory.includes('8 米'), 'History mixed quantities lost separate natural units')
    await selected.locator('[data-cycle-goods-print="' + oldCycle + '"]').waitFor()
    out.historicalPrint = await verifyGoodsPrint('historical-after-reuse')
    assert(JSON.stringify(out.historicalPrint.sourceTicketIds.slice().sort()) === JSON.stringify(out.currentPrint.sourceTicketIds.slice().sort()), 'History printed the new cycle instead of old ticket identities')
    assert(!out.historicalPrint.cards.join('\n').includes(out.reuseTicket.ticketNo), 'Historical print substituted fresh current ticket')
  })
  result.failed = result.scenarios.filter(scenario => !scenario.passed)
  return result
}
