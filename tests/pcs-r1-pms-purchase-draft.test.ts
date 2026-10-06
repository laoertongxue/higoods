import assert from 'node:assert/strict'
import { test, mock } from 'node:test'
import * as material from '../src/data/pcs-material-archive-repository.ts'
import { pcsRecordStore } from '../src/data/pcs-record-runtime.ts'
import type { PmsMaterialPurchaseOrder, PmsPcsMaterialPurchaseDraftInput } from '../src/data/pms/material-purchase-orders.ts'

// Controlled transaction contract, not a replacement for the real IndexedDB/browser gate.
test('R1 PCS material purchase draft is owned and atomically saved by PMS', async t => {
  const realIdb = await import('../src/data/pms/idb-storage.ts')
  const saved = new Map<string, Map<string, any>>()
  const table = (name: string) => { if (!saved.has(name)) saved.set(name, new Map()); return saved.get(name)! }
  let failCommit = false, holdCommit = false, unavailable = false, pendingCompletion: (() => void) | undefined
  let transactions = 0, commits = 0, localWrites = 0, active = false
  const waiting: Array<() => void> = []
  const release = () => { active = false; const next = waiting.shift(); if (next) { active = true; queueMicrotask(next) } }
  const db = {
    transaction(names: string[]) {
      transactions++
      const staged = new Map<string, Map<string, any>>(), requests: Array<() => void> = []
      let started = false, aborted = false, scheduled = false
      const tx: any = {
        oncomplete: null, onabort: null, onerror: null,
        abort() { aborted = true; queueMicrotask(() => { tx.onabort?.(); release() }) },
        objectStore(name: string) {
          assert.ok(names.includes(name))
          return {
            get(key: string) { const req: any = {}; requests.push(() => { req.result = structuredClone(staged.get(name)?.get(key)); req.onsuccess?.() }); drain(); return req },
            add(value: any) { const req: any = {}; requests.push(() => {
              if (staged.get(name)!.has(value.purchaseOrderNo)) { tx.error = new Error('duplicate purchase number'); tx.onerror?.(); tx.abort(); return }
              staged.get(name)!.set(value.purchaseOrderNo, structuredClone(value)); req.onsuccess?.()
            }); drain(); return req },
            put(value: any) { const req: any = {}; requests.push(() => {
              const key = name === realIdb.PMS_STORES.pmsMaterialPurchaseOrderDeltas ? value.purchaseOrderNo : name === realIdb.PMS_STORES.pmsOperationLogs ? value.id : value.snapshotKey
              assert.ok(key); staged.get(name)!.set(key, structuredClone(value)); req.onsuccess?.()
            }); drain(); return req },
          }
        },
      }
      function drain() {
        if (!started || scheduled || aborted) return
        scheduled = true
        queueMicrotask(() => {
          scheduled = false
          if (aborted) return
          const next = requests.shift()
          if (next) { next(); drain(); return }
          const complete = () => {
            if (aborted) return
            if (failCommit) { failCommit = false; tx.abort(); return }
            for (const [name, rows] of staged) saved.set(name, rows)
            commits++; tx.oncomplete?.(); release()
          }
          if (holdCommit) pendingCompletion = complete
          else complete()
        })
      }
      const start = () => { names.forEach(name => staged.set(name, new Map(structuredClone([...table(name)])))); started = true; drain() }
      if (active) waiting.push(start)
      else { active = true; queueMicrotask(start) }
      return tx
    },
  }
  mock.module(new URL('../src/data/pms/idb-storage.ts', import.meta.url).href, { namedExports: {
    ...realIdb,
    getPmsDb: async () => { if (unavailable) throw new Error('IDB unavailable'); return db },
    pmsAll: async (name: string) => { if (unavailable) throw new Error('IDB unavailable'); return structuredClone([...table(name).values()]) },
    broadcastPmsDataChanged: () => {},
  } })
  const api = await import('../src/data/pms/material-purchase-orders.ts')
  const references = await import('../src/data/pms/material-purchase-references.ts')
  const actor = { id: 'buyer-r1', name: '采购测试', role: '采购员' as const }
  const baseline = structuredClone(material.getMaterialArchiveBaseline())
  const skuId = 'material-r1-MAT-FB-00000001-B01'
  const sku = baseline.skuRecords.find(item => item.materialSkuId === skuId)!
  sku.approvalStatus = 'APPROVED'; sku.status = 'ACTIVE'; sku.mainUnit = 'M'; sku.mainUnitVersion = 1
  baseline.unitRelations = [{ relationId: 'purchase-pack-v1', materialSkuId: skuId, auxUnitId: 'Roll', mainQtyPerAux: 50,
    basisType: 'PACKAGE', basisReference: '一卷 50 米', uses: ['PURCHASE'], isDefaultForUse: ['PURCHASE'], version: 1, status: 'ACTIVE', changeReason: '', createdAt: '2026-10-05T00:00:00Z' },
    { relationId: 'issue-only', materialSkuId: skuId, auxUnitId: 'KG', mainQtyPerAux: 3, basisType: 'SPECIFICATION', basisReference: '发料称重', uses: ['ISSUE'], isDefaultForUse: [], version: 1, status: 'ACTIVE', changeReason: '', createdAt: '' }]
  pcsRecordStore.setItem(material.MATERIAL_ARCHIVE_STORAGE_KEY, JSON.stringify(baseline)); material.resetMaterialArchiveCache()
  const originalMaterial = pcsRecordStore.getItem(material.MATERIAL_ARCHIVE_STORAGE_KEY)
  const input: PmsPcsMaterialPurchaseDraftInput = { materialSkuId: skuId, unitRelationId: 'purchase-pack-v1', quantity: 2,
    supplierCode: 'SUP-2026-0001', purchaseRegion: '印度尼西亚', unitPrice: 300000, currency: 'IDR',
    warehouse: '印尼面辅料仓', expectedArrivalDate: '2026-10-20', buyerName: '王采购', remark: '补充布料' }
  let order: PmsMaterialPurchaseOrder

  await t.test('reading choices and hydrating does not copy seeds or write business records', async () => {
    await api.hydratePmsMaterialPurchaseOrdersFromIdb()
    assert.equal(await references.hasMaterialPurchaseReference(skuId), false)
    assert.equal(transactions, 0); assert.equal(commits, 0)
    assert.deepEqual(api.getPmsPcsPurchaseUnitOptions(skuId).map(unit => unit.purchaseUnit), ['M', 'Roll'])
  })
  await t.test('no success before transaction completion; source/units/prices/log are one atomic action', async () => {
    holdCommit = true
    let settled = false
    const pending = api.savePmsPcsMaterialPurchaseDraft(input, actor, 'create-one').then(value => { settled = true; return value })
    while (!pendingCompletion) await new Promise(resolve => setImmediate(resolve))
    assert.equal(settled, false); assert.equal(table(realIdb.PMS_STORES.pmsMaterialPurchaseOrderDeltas).size, 0)
    holdCommit = false; pendingCompletion(); pendingCompletion = undefined
    order = await pending
    assert.match(order.purchaseOrderNo, /^CGF-\d{4}-P\d{5}$/)
    assert.equal(order.status, '草稿'); assert.equal(order.currency, 'IDR'); assert.equal(order.taxIncluded, true)
    assert.equal(order.mainUnitQuantity, 100); assert.equal(order.pcsSource?.relationId, 'purchase-pack-v1')
    assert.equal(order.pcsSource?.relationVersion, 1); assert.equal(order.pcsSource?.mainQtyPerPurchaseUnit, 50)
    assert.equal(order.supplierCode, input.supplierCode); assert.equal(order.warehouse, input.warehouse)
    assert.equal(order.requirementNo, ''); assert.equal(order.sourceProductPurchaseOrderNo, ''); assert.equal(order.styleCode, '')
    assert.equal(table(realIdb.PMS_STORES.pmsOperationLogs).size, 1)
    const writeCount = transactions
    assert.equal(await references.hasMaterialPurchaseReference(skuId), true)
    assert.equal(transactions, writeCount)
    assert.equal(pcsRecordStore.getItem(material.MATERIAL_ARCHIVE_STORAGE_KEY), originalMaterial)
  })
  await t.test('same operation is idempotent; changed payload and stale edits fail without overwrite', async () => {
    const again = await api.savePmsPcsMaterialPurchaseDraft(input, actor, 'create-one')
    assert.equal(again.purchaseOrderNo, order.purchaseOrderNo)
    assert.equal(table(realIdb.PMS_STORES.pmsMaterialPurchaseOrderDeltas).size, 1)
    assert.equal(table(realIdb.PMS_STORES.pmsOperationLogs).size, 1)
    await assert.rejects(api.savePmsPcsMaterialPurchaseDraft({ ...input, quantity: 3 }, actor, 'create-one'), /内容已变化/)
    await assert.rejects(api.savePmsPcsMaterialPurchaseDraft({ ...input, purchaseOrderNo: order.purchaseOrderNo, expectedVersion: 0 }, actor, 'stale-edit'), /其他页面修改/)
    assert.equal(table(realIdb.PMS_STORES.pmsMaterialPurchaseOrderDeltas).get(order.purchaseOrderNo).orderedQty, 2)
  })
  await t.test('transaction failure rolls back draft, log and receipt; retry preserves the intended action', async () => {
    const before = structuredClone([...saved].map(([name, rows]) => [name, [...rows]]))
    failCommit = true
    const changed = { ...input, purchaseOrderNo: order.purchaseOrderNo, expectedVersion: 1, quantity: 4 }
    await assert.rejects(api.savePmsPcsMaterialPurchaseDraft(changed, actor, 'change-one'), /未保存/)
    assert.deepEqual([...saved].map(([name, rows]) => [name, [...rows]]), before)
    assert.equal(api.getPmsMaterialPurchaseOrder(order.purchaseOrderNo)?.orderedQty, 2)
    order = await api.savePmsPcsMaterialPurchaseDraft(changed, actor, 'change-one')
    assert.equal(order.orderedQty, 4); assert.equal(order.draftVersion, 2)
  })
  await t.test('refresh hydration restores draft and unit snapshot; current unit edits do not rewrite it', async () => {
    const next = structuredClone(baseline)
    next.unitRelations![0].status = 'INACTIVE'
    next.unitRelations!.push({ ...next.unitRelations![0], relationId: 'purchase-pack-v2', mainQtyPerAux: 60, version: 2, status: 'ACTIVE' })
    pcsRecordStore.setItem(material.MATERIAL_ARCHIVE_STORAGE_KEY, JSON.stringify(next)); material.resetMaterialArchiveCache()
    api.resetPmsMaterialPurchaseRuntimeForTest(); await api.hydratePmsMaterialPurchaseOrdersFromIdb()
    assert.equal(api.getPmsMaterialPurchaseOrder(order.purchaseOrderNo)?.pcsSource?.mainQtyPerPurchaseUnit, 50)
    assert.equal(api.listPmsMaterialPurchaseOrders().filter(row => row.purchaseOrderNo === order.purchaseOrderNo).length, 1)
    order = await api.savePmsPcsMaterialPurchaseDraft({ ...input, purchaseOrderNo: order.purchaseOrderNo, expectedVersion: 2, quantity: 5, unitPrice: 0, currency: 'USD' }, actor, 'change-price')
    assert.equal(order.unitPrice, 0); assert.equal(order.mainUnitQuantity, 250); assert.equal(order.pcsSource?.relationVersion, 1)
    order = await api.savePmsPcsMaterialPurchaseDraft({ ...input, purchaseOrderNo: order.purchaseOrderNo, expectedVersion: 3, quantity: 5, unitRelationId: 'purchase-pack-v2' }, actor, 'change-unit')
    assert.equal(order.mainUnitQuantity, 300); assert.equal(order.pcsSource?.relationVersion, 2)
  })
  await t.test('disabled localStorage is never a fallback; unavailable IDB is an explicit unsaved failure', async () => {
    const previousWindow = globalThis.window
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem() { throw new Error('localStorage blocked') }, setItem() { localWrites++; throw new Error('localStorage blocked') } } } })
    try {
      const draft = await api.savePmsPcsMaterialPurchaseDraft({ ...input, unitRelationId: null, currency: 'RMB' }, actor, 'main-unit')
      assert.equal(draft.mainUnitQuantity, 2); assert.equal(draft.pcsSource?.relationId, null); assert.equal(localWrites, 0)
      unavailable = true
      await assert.rejects(api.savePmsPcsMaterialPurchaseDraft({ ...input, unitRelationId: null }, actor, 'not-saved'), /IDB unavailable/)
      await assert.rejects(references.hasMaterialPurchaseReference(skuId), /IDB unavailable/)
      assert.equal(localWrites, 0)
    } finally { unavailable = false; Object.defineProperty(globalThis, 'window', { configurable: true, value: previousWindow }) }
  })
  await t.test('required purchase conditions and purchase unit purpose are enforced without any inventory dependency', async () => {
    for (const patch of [{ quantity: 0 }, { unitPrice: -1 }, { supplierCode: '' }, { purchaseRegion: '' }, { warehouse: '' }, { buyerName: '' }, { expectedArrivalDate: '2026-02-30' }, { unitRelationId: 'issue-only' }]) {
      await assert.rejects(api.savePmsPcsMaterialPurchaseDraft({ ...input, unitRelationId: null, ...patch }, actor, `invalid-${JSON.stringify(patch)}`))
    }
    assert.deepEqual(api.pmsAllowedMaterialOrderNextStatuses('草稿'), [])
    assert.throws(() => api.advancePmsMaterialPurchaseOrderStatus(order.purchaseOrderNo, '已采购', actor), /不能直接流转/)
    assert.equal(localWrites, 0)
  })
  await t.test('GOV-006 an inactive parent blocks a new purchase but keeps the existing purchase and unit snapshot usable', async () => {
    const stopped = material.getMaterialArchiveStoreSnapshot()
    stopped.records.find(item => item.materialId === sku.materialId)!.status = 'INACTIVE'
    pcsRecordStore.setItem(material.MATERIAL_ARCHIVE_STORAGE_KEY, JSON.stringify(stopped)); material.resetMaterialArchiveCache()
    const before = transactions
    await assert.rejects(api.savePmsPcsMaterialPurchaseDraft({ ...input, unitRelationId: null }, actor, 'new-after-stop'), /审核并启用/)
    assert.equal(transactions, before)
    assert.equal(api.getPmsMaterialPurchaseOrder(order.purchaseOrderNo)?.purchaseOrderNo, order.purchaseOrderNo)
    const continued = await api.savePmsPcsMaterialPurchaseDraft({ ...input, purchaseOrderNo: order.purchaseOrderNo, expectedVersion: order.draftVersion, quantity: 6, unitRelationId: 'purchase-pack-v2' }, actor, 'existing-after-stop')
    assert.equal(continued.mainUnitQuantity, 360)
    assert.deepEqual(continued.pcsSource, order.pcsSource)
  })
})
