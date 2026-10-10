import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium, type Page } from '@playwright/test'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const dev = process.env.SIMPLE_DEV_URL || 'http://127.0.0.1:43219'
const production = process.env.SIMPLE_PROD_URL || 'http://127.0.0.1:43220'
const out = 'output/playwright/pcs-simple-materials/downstream'
const samples: Array<{ name: string; ms: number; repeat: number }> = []
const errors: string[] = []
const results: Array<{ repeat: number; checks: string[]; purchases: string[] }> = []
const init = () => { (globalThis as any).__name = (v: unknown) => v; (globalThis as any).__downstreamStart = 0 }
async function settled(page: Page) {
  await page.waitForSelector('main')
  await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('main img')].filter(image => {
    const box = image.getBoundingClientRect(); return box.top < innerHeight && box.bottom > 0 && box.left < innerWidth && box.right > 0
  }).every(image => image.complete))
  await page.evaluate(async () => {
    await document.fonts.ready
    const frames = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    await frames()
    const animations = document.getAnimations().filter(animation => animation.playState !== 'finished' && Number.isFinite(animation.effect?.getComputedTiming().iterations))
    await Promise.all(animations.map(animation => animation.finished.catch(() => undefined)))
    await frames()
  })
}
async function finish(page: Page, name: string, repeat: number, navigation = false) {
  await settled(page)
  const ms = await page.evaluate(nav => performance.now() - (nav ? 0 : (globalThis as any).__downstreamStart), navigation)
  samples.push({ name, ms, repeat })
}
async function action(page: Page, name: string, repeat: number, operation: () => Promise<unknown>, wait?: () => Promise<unknown>) {
  await page.evaluate(() => (globalThis as any).__downstreamStart = performance.now()); await operation(); if (wait) await wait(); await finish(page, name, repeat)
}
async function ready(page: Page, selector: string) { await page.waitForSelector(selector); await settled(page) }
const purchaseAction = (page: Page, name: string) => page.locator(`[data-pms-mpo-action="${name}"]`).first()
const purchaseField = (page: Page, name: string) => page.locator(`[data-pms-mpo-field="pcs-${name}"]`)

async function prepareFixture(browser: Awaited<ReturnType<typeof chromium.launch>>) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } }); await context.addInitScript(init)
  const page = await context.newPage(); await page.goto(dev + '/pcs/materials/consumable'); await ready(page, '[data-pcs-material-archive-page="consumable"]')
  const fixture = await page.evaluate(async () => {
    const runtime = await import('/src/data/pcs-record-runtime.ts')
    const material = await import('/src/data/pcs-material-archive-repository.ts')
    const bom = await import('/src/data/pcs-engineering-bom-repository.ts')
    const styles = await import('/src/data/pcs-style-archive-repository.ts')
    const db = await import('/src/data/pcs-record-db.ts')
    const resolver = await import('/src/data/pcs-engineering-bom-material-resolver.ts')
    const technical = await import('/src/data/pcs-technical-data-version-repository.ts')
    await runtime.ensurePcsRecordState(runtime.PCS_LEGACY_KEYS)
    const roots = material.listMaterialArchives(), root = roots.find((item: any) => item.subcategoryId === 'material-category-consumable-20')!
    const sku = material.listMaterialSkuRecordsByMaterialId(root.materialId)[0], parts = roots.find((item: any) => item.kind === 'parts')!
    const partsSku = material.listMaterialSkuRecordsByMaterialId(parts.materialId)[0], ordinary = roots.find((item: any) => item.kind === 'consumable' && item.materialId !== root.materialId)!
    const ordinarySku = material.listMaterialSkuRecordsByMaterialId(ordinary.materialId)[0]
    const style = styles.listStyleArchives()[0]
    const techDraft = technical.listTechnicalDataVersions().find((item: any) => item.versionStatus === 'DRAFT' && item.reviewStage === '未提交审核')!
    const values = await runtime.runPcsRecordCommand(() => {
      const packs = [10, 20].map(contentQty => material.saveMaterialPackageSpec(sku.materialSkuId, { packageTypeId: '包', contentQty, contentUnitId: sku.mainUnit!, grossWeightKg: null, lengthCm: null, widthCm: null, heightCm: null, volumeM3: null, volumeSource: 'UNKNOWN', measurementBasis: `原型验收：每包 ${contentQty} 个`, status: 'ACTIVE' }))
      const relations = packs.map(pack => material.listMaterialUnitRelations(sku.materialSkuId).find((item: any) => item.packageSpecId === pack.packageSpecId)!)
      const actor = { role: '买手' as const, userId: 'buyer-check', userName: '验收买手' }
      const create = (ownerId: string) => bom.createEngineeringBomVersionsForOwner({ ownerStage: 'INDEPENDENT_SAMPLING', ownerId, ownerCode: ownerId, styleId: style.styleId, createdBy: actor.userName, buyerId: actor.userId, buyerName: actor.userName })
      const published = create('SIMPLE-BROWSER-PUBLISHED')[0]
      const initialCost = material.getMaterialStandardCost(sku.materialSkuId).totalStandardCny!
      bom.saveEngineeringBomVersion({ ...actor, versionId: published.bomDraftVersionId, materialLines: [{ bomItemId: 'SIMPLE-FROZEN-BAG', materialSkuId: sku.materialSkuId, materialType: '包装材料', specification: sku.specName, usage: 2, sampleQuantity: 1, usageUnit: sku.mainUnit!, lossRate: 0, printRequirement: '否', dyeRequirement: '否', purchaseRequirement: '是' }] })
      bom.saveEngineeringBomPricingPlan({ ...actor, ownerStage: published.ownerStage, ownerId: published.ownerId, customCostDecision: 'NO_CUSTOM_COST', customCosts: [] })
      bom.confirmEngineeringBomVersion({ ...actor, versionId: published.bomDraftVersionId })
      bom.markEngineeringBomVersionsPublished({ ownerStage: published.ownerStage, ownerId: published.ownerId, publishedSnapshotId: 'SIMPLE-PUBLISHED-TECH', publishedBy: actor.userName })
      const draft = create('SIMPLE-BROWSER-DRAFT')[0]
      bom.saveEngineeringBomVersion({ ...actor, versionId: draft.bomDraftVersionId, materialLines: [] })
      material.saveMaterialStandardCost(sku.materialSkuId, { purchaseStandardCny: 8, transportStandardCny: 1, pricingUnit: sku.mainUnit!, changeReason: '原型验收：当前标准调整，正式成本保持原采用值' })
      const historicalState = bom.captureEngineeringBomRepositoryState(), publishedRecord = historicalState.records.find((item: any) => item.bomDraftVersionId === published.bomDraftVersionId)!
      const historicalPartsId = 'simple-browser-parts-history', historicalOwnerId = 'SIMPLE-BROWSER-PARTS-HISTORY'
      historicalState.records.push({ ...publishedRecord, bomDraftVersionId: historicalPartsId, ownerId: historicalOwnerId, ownerCode: historicalOwnerId, materialLines: [resolver.captureEngineeringBomMaterialReference({ bomItemId: 'simple-historical-parts-line', materialSkuId: partsSku.materialSkuId, materialType: '其他', specification: partsSku.specName, usage: 1, sampleQuantity: 1, usageUnit: partsSku.mainUnit!, lossRate: 0, printRequirement: '否', dyeRequirement: '否' }, 'FROZEN')] })
      const publishedPlan = historicalState.plans.find((item: any) => item.ownerId === published.ownerId)!
      historicalState.plans.push({ ...publishedPlan, pricingPlanId: 'simple-browser-parts-history-plan', ownerId: historicalOwnerId, ownerCode: historicalOwnerId })
      bom.restoreEngineeringBomRepositoryState(historicalState)
      return { historicalPartsId, partsSkuCode: partsSku.materialSkuCode, techDraftId: techDraft.technicalVersionId, techStyleId: techDraft.styleId, rootId: root.materialId, skuId: sku.materialSkuId, skuCode: sku.materialSkuCode, spec: sku.specName, partsRootId: parts.materialId, partsSkuId: partsSku.materialSkuId, ordinarySkuId: ordinarySku.materialSkuId, packages: packs, relations, publishedId: published.bomDraftVersionId, draftId: draft.bomDraftVersionId, initialCost }
    })
    return { ...values, records: (await db.readPcsRecords()).records }
  })
  await context.close(); return fixture
}
async function installFixture(page: Page, records: any[]) {
  await page.evaluate(async records => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('higood-pcs-records', 2); request.onupgradeneeded = () => { for (const key of ['records', 'files', 'operations', 'meta']) if (!request.result.objectStoreNames.contains(key)) request.result.createObjectStore(key, { keyPath: 'id' }) }; request.onerror = () => reject(request.error); request.onsuccess = () => resolve(request.result) })
    await new Promise<void>((resolve, reject) => { const tx = db.transaction('records', 'readwrite'); records.forEach(row => tx.objectStore('records').put(row)); tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error) }); db.close()
  }, records)
}
async function readPurchases(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('higood-pms'); request.onerror = () => reject(request.error); request.onsuccess = () => resolve(request.result) })
    const orders = await new Promise<any[]>((resolve, reject) => { const tx = db.transaction('pmsMaterialPurchaseOrderDeltas', 'readonly'); const request = tx.objectStore('pmsMaterialPurchaseOrderDeltas').getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) }); db.close(); return orders
  })
}

async function readPcsRows(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('higood-pcs-records'); request.onerror = () => reject(request.error); request.onsuccess = () => resolve(request.result) })
    const rows = await new Promise<any[]>((resolve, reject) => { const tx = db.transaction('records', 'readonly'), request = tx.objectStore('records').getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) }); db.close(); return rows.sort((a,b) => a.id.localeCompare(b.id))
  })
}
async function archiveReferenced(page: Page, route: string, orderNo: string, kind: string, repeat: number) {
  await page.goto(production + route); await ready(page, '[data-pcs-material-sku-detail]'); await finish(page, `${kind}:independent-direct`, repeat, true)
  await action(page, `${kind}:independent-usage`, repeat, () => page.locator('[data-pcs-material-archive-action="simple-popup"][data-popup="usage"]').click(), () => page.waitForSelector('[aria-label="使用情况"]'))
  assert.ok((await page.locator('[aria-label="使用情况"]').innerText()).includes(orderNo), '全新页面直达使用情况必须显示真实采购引用，无需先访问 PMS')
  await action(page, `${kind}:independent-usage-close`, repeat, () => page.locator('[aria-label="使用情况"] [data-pcs-material-archive-action="close-simple-popup"]').click(), () => page.waitForSelector('[aria-label="使用情况"]', { state: 'detached' }))
  const before = JSON.stringify(await readPcsRows(page))
  await action(page, `${kind}:archive-more`, repeat, () => page.locator('[data-pcs-material-archive-action="simple-actions"]').click(), () => page.waitForSelector('[aria-label="更多操作"]'))
  await action(page, `${kind}:archive-begin`, repeat, () => page.locator('[aria-label="更多操作"] [data-pcs-material-archive-action="use-status"][data-status="ARCHIVED"]').click(), () => page.waitForSelector('[data-pcs-action-dialog][open]'))
  await action(page, `${kind}:archive-confirm`, repeat, () => page.locator('[data-pcs-action-dialog] [data-dialog-confirm]').click(), () => page.waitForSelector('dialog[open] textarea'))
  await action(page, `${kind}:archive-reason`, repeat, () => page.locator('dialog[open] textarea').fill('真实采购引用归档阻断验收'))
  await action(page, `${kind}:archive-blocked-save`, repeat, () => page.locator('dialog[open] button[type="submit"]').click(), () => page.waitForFunction(() => document.querySelector('main')?.textContent?.includes('已有采购草稿或采购记录引用')))
  assert.ok((await page.locator('main').innerText()).includes('本次未保存'))
  assert.equal(JSON.stringify(await readPcsRows(page)), before, '归档失败必须保持所有 PCS 持久记录不变')
  if (repeat === 0 || repeat === 4) await page.screenshot({ path: `${out}/${kind}-archive-blocked-${repeat === 4 ? '1280' : '1366'}.png`, fullPage: true })
  await page.reload({ waitUntil: 'domcontentloaded' }); await ready(page, '[data-pcs-material-sku-detail]'); await finish(page, `${kind}:archive-blocked-refresh`, repeat, true)
  assert.ok((await page.locator('main').innerText()).includes('可选用')); assert.equal(JSON.stringify(await readPcsRows(page)), before)
}

// Explicitly isolated contexts: never touches the user's existing Chrome/IAB storage.
test('SIMPLE-037/038/040/044–050: real downstream pages, persistent purchase conditions and 1s gate', { timeout: 300000 }, async () => {
  await mkdir(out, { recursive: true }); const browser = await chromium.launch({ headless: true })
  let activePage: Page | undefined, functionalFailure: unknown
  try {
    const fixture = await prepareFixture(browser)
    await writeFile(`${out}/fixture.json`, JSON.stringify({ ...fixture, records: fixture.records.map(row => ({ id: row.id, collection: row.collection, version: row.version })) }, null, 2))
    for (let repeat = 0; repeat < 5; repeat++) {
      const context = await browser.newContext({ viewport: { width: repeat === 4 ? 1280 : 1366, height: repeat === 4 ? 720 : 768 } }); await context.addInitScript(init)
      const page = await context.newPage(); activePage = page; page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept())
      await page.goto(production + '/pcs/materials/consumable'); await ready(page, '[data-pcs-material-archive-page="consumable"]'); await installFixture(page, fixture.records)
      const skuRoute = `/pcs/materials/consumable/${fixture.rootId}/skus/${fixture.skuId}`
      const routes: Array<[string, string, string]> = [
        ['sku', skuRoute, '[data-pcs-material-sku-detail]'],
        ['purchase-new', `/pms/material-purchase-orders?pcsIntent=purchase&materialSkuId=${fixture.skuId}`, '[data-pms-pcs-purchase-workspace]'],
        ['bom-draft', `/pcs/technical-data/bom-pricing/${fixture.draftId}`, '[data-tech-data-action="bom-add-material"]'],
        ['bom-published', `/pcs/technical-data/bom-pricing/${fixture.publishedId}`, '[data-pcs-technical-data-page]'],
        ['bom-parts-history', `/pcs/technical-data/bom-pricing/${fixture.historicalPartsId}`, '[data-bom-line]'],
        ['technical-pack', `/pcs/products/styles/${fixture.techStyleId}/technical-data/${fixture.techDraftId}`, '[data-tech-pack-page-root]'],
      ]
      const cd = await context.newCDPSession(page); await cd.send('Network.enable'); await cd.send('Network.setCacheDisabled', { cacheDisabled: true })
      for (const [name, route, selector] of routes) {
        await cd.send('Network.setCacheDisabled', { cacheDisabled: true })
        await page.goto(production + route, { waitUntil: 'domcontentloaded' }); await ready(page, selector); await finish(page, `${name}:cold`, repeat, true)
        await page.reload({ waitUntil: 'domcontentloaded' }); await ready(page, selector); await finish(page, `${name}:refresh`, repeat, true)
        await cd.send('Network.setCacheDisabled', { cacheDisabled: false })
        await page.goto(production + '/pcs/materials/parts'); await ready(page, '[data-pcs-material-archive-page="parts"]')
        await action(page, `${name}:SPA`, repeat, () => page.evaluate(route => { const a = document.createElement('a'); a.dataset.nav = route; document.querySelector('main')!.append(a); a.click(); a.remove() }, route), () => page.waitForSelector(selector))
      }
      await cd.send('Network.setCacheDisabled', { cacheDisabled: false })
      const checks: string[] = [], purchases: string[] = []
      for (const count of [10, 20]) {
        await page.goto(production + skuRoute); await ready(page, '[data-pcs-material-sku-detail]')
        assert.equal(await page.getByRole('button', { name: '新增加工', exact: true }).count(), 0)
        await action(page, `purchase-${count}:PCS-handoff`, repeat, () => page.locator('[data-pcs-material-archive-action="purchase"]').click(), () => page.waitForSelector('[data-pms-pcs-purchase-workspace]'))
        await action(page, `purchase-${count}:unit-choice`, repeat, () => purchaseField(page, 'unitRelationId').selectOption(fixture.relations[count === 10 ? 0 : 1].relationId))
        assert.ok((await purchaseField(page, 'unitRelationId').locator('option').allTextContents()).some(text => text.includes(`包（${count} PCS）`)))
        for (const [field, value] of Object.entries({ quantity: '3', unitPrice: '123.45', purchaseRegion: '印度尼西亚', warehouse: '雅加达验收仓', buyerName: '验收采购员', expectedArrivalDate: '2026-10-31', remark: `每包${count}个；实际价独立` })) await action(page, `purchase-${count}:field-${field}`, repeat, () => purchaseField(page, field).fill(value))
        await action(page, `purchase-${count}:supplier`, repeat, () => purchaseField(page, 'supplierCode').selectOption({ index: 1 }))
        await action(page, `purchase-${count}:source-tab`, repeat, () => page.locator('[data-pms-mpo-action="pcs-tab"][data-tab="source"]').click())
        assert.ok((await page.locator('[role="tabpanel"]').innerText()).includes(fixture.spec)); assert.ok((await page.locator('[role="tabpanel"]').innerText()).includes(fixture.packages[count === 10 ? 0 : 1].packageSpecId))
        await action(page, `purchase-${count}:purchase-tab`, repeat, () => page.locator('[data-pms-mpo-action="pcs-tab"][data-tab="purchase"]').click())
        await action(page, `purchase-${count}:save`, repeat, () => purchaseAction(page, 'pcs-save').click(), () => page.waitForSelector('[data-pms-mpo-action="pcs-edit"]'))
        const savedUrl = page.url(); const orderNo = new URL(savedUrl).searchParams.get('purchaseOrderNo')!; assert.ok(orderNo); purchases.push(orderNo)
        await page.reload({ waitUntil: 'domcontentloaded' }); await ready(page, '[data-pms-mpo-action="pcs-edit"]'); await finish(page, `purchase-${count}:saved-refresh`, repeat, true)
        assert.ok((await page.locator('[role="tabpanel"]').innerText()).includes('123.4500 RMB'))
        const persisted = (await readPurchases(page)).find(order => order.purchaseOrderNo === orderNo)
        assert.equal(persisted.status, '草稿'); assert.equal(persisted.receivedQty, 0); assert.equal(persisted.pcsSource.relationVersion, fixture.relations[count === 10 ? 0 : 1].version); assert.equal(persisted.pcsSource.packageSnapshot.version, fixture.packages[count === 10 ? 0 : 1].version)
        assert.equal(persisted.unitPrice, 123.45); assert.equal(persisted.mainUnitQuantity, 3 * count); assert.equal(persisted.pcsSource.specName, fixture.spec); assert.equal(persisted.pcsSource.packageSnapshot.contentQty, count); assert.equal(persisted.pcsSource.packageSnapshot.packageSpecId, fixture.packages[count === 10 ? 0 : 1].packageSpecId)
        await action(page, `purchase-${count}:saved-source-tab`, repeat, () => page.locator('[data-pms-mpo-action="pcs-tab"][data-tab="source"]').click())
        if (repeat === 0 || repeat === 4) await page.screenshot({ path: `${out}/purchase-${count}-${repeat === 4 ? '1280' : '1366'}.png`, fullPage: true })
        await page.goto(production + skuRoute); await ready(page, '[data-pcs-material-sku-detail]')
        await action(page, `purchase-${count}:usage`, repeat, () => page.locator('[data-pcs-material-archive-action="simple-popup"][data-popup="usage"]').click(), () => page.waitForSelector('[aria-label="使用情况"]'))
        assert.ok((await page.locator('[aria-label="使用情况"]').innerText()).includes(orderNo), '采购使用情况必须显示真实保存的单号')
        await action(page, `purchase-${count}:usage-close`, repeat, () => page.locator('[aria-label="使用情况"] [data-pcs-material-archive-action="close-simple-popup"]').click(), () => page.waitForSelector('[aria-label="使用情况"]', { state: 'detached' }))
        checks.push(`PCS source → ${count} PCS/package → actual price independent → save/refresh → relation+package versions → true usage`)
      }
      const independentPage = await context.newPage(); independentPage.on('pageerror', error => errors.push(error.message)); activePage = independentPage
      await archiveReferenced(independentPage, skuRoute, purchases[1], 'consumable', repeat); await independentPage.close(); activePage = page
      const partsRoute = `/pcs/materials/parts/${fixture.partsRootId}/skus/${fixture.partsSkuId}`
      await page.goto(production + partsRoute); await ready(page, '[data-pcs-material-sku-detail]')
      await action(page, 'parts-purchase:handoff', repeat, () => page.locator('[data-pcs-material-archive-action="purchase"]').click(), () => page.waitForSelector('[data-pms-pcs-purchase-workspace]'))
      for (const [field, value] of Object.entries({ quantity: '2', unitPrice: '12.34', purchaseRegion: '印度尼西亚', warehouse: '雅加达验收仓', buyerName: '验收采购员', expectedArrivalDate: '2026-10-31', remark: '配件真实采购引用归档阻断' })) await action(page, `parts-purchase:field-${field}`, repeat, () => purchaseField(page, field).fill(value))
      await action(page, 'parts-purchase:supplier', repeat, () => purchaseField(page, 'supplierCode').selectOption({ index: 1 }))
      await action(page, 'parts-purchase:save', repeat, () => purchaseAction(page, 'pcs-save').click(), () => page.waitForSelector('[data-pms-mpo-action="pcs-edit"]'))
      const partsOrderNo = new URL(page.url()).searchParams.get('purchaseOrderNo')!; assert.ok(partsOrderNo); purchases.push(partsOrderNo)
      const partsIndependentPage = await context.newPage(); partsIndependentPage.on('pageerror', error => errors.push(error.message)); activePage = partsIndependentPage
      await archiveReferenced(partsIndependentPage, partsRoute, partsOrderNo, 'parts', repeat); await partsIndependentPage.close(); activePage = page
      checks.push('both kinds: true purchase references from independent fresh page; archive confirm+reason blocked; every PCS row unchanged after failed save and refresh')
      await page.goto(production + `/pcs/technical-data/bom-pricing/${fixture.draftId}`); await ready(page, '[data-tech-data-action="bom-add-material"]')
      const optionValues = await page.locator('[data-tech-data-field="bom-material-sku"] option').evaluateAll(nodes => nodes.map(node => (node as HTMLOptionElement).value))
      assert.ok(optionValues.includes(fixture.skuId)); assert.ok(optionValues.includes(fixture.ordinarySkuId)); assert.ok(!optionValues.includes(fixture.partsSkuId))
      await action(page, 'BOM:select-packaging', repeat, () => page.locator('[data-tech-data-field="bom-material-sku"]').selectOption(fixture.skuId))
      await action(page, 'BOM:add-packaging', repeat, () => page.locator('[data-tech-data-action="bom-add-material"]').click(), () => page.waitForSelector('[data-bom-line]'))
      const row = page.locator('[data-bom-line]').first(); assert.ok((await row.innerText()).includes('包装材料')); assert.ok((await row.innerText()).includes(fixture.spec)); assert.ok((await row.innerText()).includes('¥9.0000'))
      for (const field of ['printRequirement', 'dyeRequirement', 'processCode']) assert.equal(await page.locator(`[data-bom-line-field="${field}"]`).count(), 0)
      await action(page, 'BOM:quantity', repeat, () => page.locator('[data-bom-line-field="usage"]').fill('3'))
      await action(page, 'BOM:save', repeat, () => page.locator('[data-tech-data-action="bom-save"]').click(), () => page.waitForFunction(() => document.querySelector('main')?.textContent?.includes('已保存')))
      await page.reload({ waitUntil: 'domcontentloaded' }); await ready(page, '[data-bom-line]'); await finish(page, 'BOM:saved-refresh', repeat, true); assert.equal(await page.locator('[data-bom-line-field="usage"]').inputValue(), '3')
      if (repeat === 0 || repeat === 4) await page.screenshot({ path: `${out}/bom-draft-${repeat === 4 ? '1280' : '1366'}.png`, fullPage: true })
      await page.goto(production + `/pcs/technical-data/bom-pricing/${fixture.publishedId}`); await ready(page, '[data-bom-line]')
      assert.ok((await page.locator('[data-bom-line]').innerText()).includes(`¥${fixture.initialCost.toFixed(4)}`)); assert.equal(await page.locator('[data-tech-data-action="bom-save"]').count(), 0)
      checks.push('packaging + ordinary candidates; parts excluded; no simple process controls; current standard 9 vs formal frozen initial standard; BOM save/refresh')
      if (repeat === 0) await page.screenshot({ path: `${out}/bom-formal-frozen.png`, fullPage: true })
      await page.goto(production + `/pcs/technical-data/bom-pricing/${fixture.historicalPartsId}`); await ready(page, '[data-bom-line]')
      assert.ok((await page.locator('[data-bom-line]').innerText()).includes(fixture.partsSkuCode)); assert.equal(await page.locator('[data-tech-data-action="bom-save"]').count(), 0)
      if (repeat === 0) await page.screenshot({ path: `${out}/bom-parts-history.png`, fullPage: true })
      await page.goto(production + `/pcs/products/styles/${fixture.techStyleId}/technical-data/${fixture.techDraftId}`); await ready(page, '[data-tech-pack-page-root]')
      await action(page, 'tech-pack:BOM-tab', repeat, () => page.locator('[data-tech-action="switch-tab"][data-tab="bom"]').click(), () => page.waitForSelector('[data-tech-action="open-add-bom"]'))
      await action(page, 'tech-pack:BOM-add-dialog', repeat, () => page.locator('[data-tech-action="open-add-bom"]').first().click(), () => page.waitForSelector('[data-testid="tech-pack-bom-form-dialog"]'))
      await action(page, 'tech-pack:BOM-packaging-type', repeat, () => page.locator('[data-tech-field="new-bom-type"]').selectOption('包装材料'))
      const packagingOptions = await page.locator('[data-tech-field="new-bom-material-sku"] option').evaluateAll(nodes => nodes.map(node => (node as HTMLOptionElement).value))
      assert.ok(packagingOptions.includes(fixture.skuId)); assert.ok(!packagingOptions.includes(fixture.partsSkuId))
      await action(page, 'tech-pack:BOM-packaging-sku', repeat, () => page.locator('[data-tech-field="new-bom-material-sku"]').selectOption(fixture.skuId))
      for (const field of ['new-bom-bound-craft', 'new-bom-print-requirement', 'new-bom-dye-requirement', 'new-bom-embroidery-requirement']) assert.equal(await page.locator(`[data-tech-field="${field}"]`).count(), 0)
      if (repeat === 0 || repeat === 4) await page.screenshot({ path: `${out}/tech-pack-BOM-${repeat === 4 ? '1280' : '1366'}.png`, fullPage: true })
      await action(page, 'tech-pack:BOM-close-dialog', repeat, () => page.locator('[data-tech-action="close-add-bom"]').click(), () => page.waitForSelector('[data-testid="tech-pack-bom-form-dialog"]', { state: 'detached' }))
      checks.push('historical published equipment BOM still visible; tech-pack packaging candidate with no process controls')
      results.push({ repeat, checks, purchases }); await context.close()
    }
  } catch (error) {
    functionalFailure = error
    if (activePage && !activePage.isClosed()) { await activePage.screenshot({ path: `${out}/failed.png`, fullPage: true }).catch(() => {}); await writeFile(`${out}/failed-page.txt`, await activePage.locator('body').innerText().catch(() => '')) }
  } finally {
    const servedHtml = await (await fetch(production)).text()
    const bundlePath = servedHtml.match(/<script[^>]+src="([^"]+\.js)"/)?.[1] || ''
    const servedBytes = bundlePath ? Buffer.from(await (await fetch(production + bundlePath)).arrayBuffer()) : Buffer.alloc(0)
    const servedHash = createHash('sha256').update(servedBytes).digest('hex')
    const localHash = bundlePath ? createHash('sha256').update(await readFile(`dist${bundlePath}`)).digest('hex') : ''
    const groups = [...new Set(samples.map(sample => sample.name))].map(name => { const values = samples.filter(sample => sample.name === name).map(sample => sample.ms); return { name, values, max: Math.max(...values), passed: values.length >= 5 && values.every(ms => ms <= 1000) } })
    assert.ok(servedHash === localHash, 'Production served bundle does not match this worktree dist')
    await writeFile(`${out}/report.json`, JSON.stringify({ passed: !functionalFailure && errors.length === 0 && groups.every(group => group.passed), functionalFailure: functionalFailure ? String(functionalFailure) : '', dev, production, servedBundle: { path: bundlePath, sha256: servedHash, matchesLocalDist: servedHash === localHash }, measurement: 'Navigation start / before interaction through persisted result, visible images complete, fonts ready, finite UI animations finished and final double animation frame; cold+refresh cache disabled, SPA cache enabled; each item five samples; no performance exemptions', branch: execFileSync('git', ['branch', '--show-current']).toString().trim(), head: execFileSync('git', ['rev-parse', 'HEAD']).toString().trim(), worktree: process.cwd(), browser: browser.version(), fixture: 'isolated Mock only; five fresh contexts; IndexedDB per-record fixture; no user storage cleanup', viewports: ['1366x768', '1280x720'], samples, groups, errors, results }, null, 2)); await browser.close()
  }
  assert.ifError(functionalFailure); assert.deepEqual(errors, [])
  const incomplete = [...new Set(samples.map(sample => sample.name))].filter(name => samples.filter(sample => sample.name === name).length < 5); assert.deepEqual(incomplete, [])
  assert.ok(samples.every(sample => sample.ms <= 1000), 'One or more page/action samples exceed 1s; see report.json')
})
