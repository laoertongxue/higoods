import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

test('R1 product archive checks external references without writing either domain', async t => {
  let purchases: any[] = [], storedPurchases: any[] = [], savedProduction: any[] = []
  const productionOrders: any[] = []
  const styleCodes = new Map([['style-one', 'SPU-001'], ['style-prefix', 'SPU-00']])
  const skuCodes = new Map([['sku-one', 'SPU-001-black-M'], ['sku-two', 'SPU-001-black-L'], ['sku-prefix', 'SPU-001-black']])
  let purchaseReads = 0, productionReads = 0, writes = 0
  let purchaseFailure = false, productionFailure = false, holdProduction: Promise<void> | undefined
  const forbiddenWrite = () => { writes++; throw new Error('Reference checks must not write') }
  mock.module(new URL('../src/data/pcs-style-archive-repository.ts', import.meta.url).href, { namedExports: {
    getStyleArchiveById: (id: string) => styleCodes.has(id) ? { styleId: id, styleCode: styleCodes.get(id) } : undefined,
  } })
  mock.module(new URL('../src/data/pcs-sku-archive-repository.ts', import.meta.url).href, { namedExports: {
    getSkuArchiveById: (id: string) => skuCodes.has(id) ? { skuId: id, skuCode: skuCodes.get(id) } : undefined,
  } })
  mock.module(new URL('../src/data/pms/product-purchase-orders.ts', import.meta.url).href, { namedExports: {
    listPmsProductPurchaseOrders: () => purchases,
    hydratePmsProductPurchaseOrdersFromIdb: forbiddenWrite,
    createPmsProductPurchaseOrder: forbiddenWrite,
  } })
  mock.module(new URL('../src/data/pms/idb-storage.ts', import.meta.url).href, { namedExports: {
    PMS_STORES: { pmsProductPurchaseOrders: 'pmsProductPurchaseOrders' },
    pmsAll: async (store: string) => {
      assert.equal(store, 'pmsProductPurchaseOrders'); purchaseReads++
      if (purchaseFailure) throw new Error('IndexedDB request failed')
      return structuredClone(storedPurchases)
    },
    pmsPut: forbiddenWrite, pmsTx: forbiddenWrite,
  } })
  mock.module(new URL('../src/data/fcs/production-orders.ts', import.meta.url).href, { namedExports: {
    productionOrders, persistCreatedProductionOrders: forbiddenWrite,
  } })
  mock.module(new URL('../src/data/fcs/production-context-records.ts', import.meta.url).href, { namedExports: {
    hydrateProductionContextRecords: async () => {
      productionReads++
      await holdProduction
      if (productionFailure) throw new Error('Production context unavailable')
      productionOrders.splice(0, productionOrders.length, ...structuredClone(savedProduction))
    },
    saveProductionContextAction: forbiddenWrite,
  } })
  const { getProductExternalActiveReferences: references } = await import('../src/data/pcs-product-reference-check.ts')
  const purchase = (no: string, status = '待采购', spu = 'SPU-001', sku = 'SPU-001-black-M') => ({ purchaseOrderNo: no, status, spu, lines: [{ sku }] })
  const snapshot = (spuCode = 'SPU-001', skuCode = 'SPU-001-black-M') => ({ spuCode, skuLines: [{ skuCode }] })
  const production = (id: string, status = 'EXECUTING', main = snapshot(), sources: any[] = []) => ({ productionOrderId: id, productionOrderNo: `PO-${id}`, status, demandSnapshot: main, sourceDemandSnapshots: sources })

  await t.test('module import and empty reads never save seeds or call the legacy PMS hydrator', async () => {
    assert.equal(purchaseReads + productionReads + writes, 0)
    assert.deepEqual(await references('style', 'style-one'), [])
    assert.equal(purchaseReads, 1); assert.equal(productionReads, 1); assert.equal(writes, 0)
  })
  await t.test('PMS durable overrides win by order number, including terminal status', async () => {
    purchases = [purchase('A'), purchase('B'), purchase('C', '已完成')]
    storedPurchases = [purchase('A', '已完成'), purchase('B', '已关闭'), purchase('D', '草稿'), purchase('E', '已入库')]
    const before = structuredClone({ purchases, storedPurchases })
    assert.deepEqual(await references('style', 'style-one'), ['商品采购单 D', '商品采购单 E'])
    assert.deepEqual({ purchases, storedPurchases }, before)
  })
  await t.test('style and SKU use exact codes, not prefixes or same-style siblings', async () => {
    purchases = [purchase('A')]; storedPurchases = []
    savedProduction = [production('A')]
    assert.deepEqual(await references('style', 'style-one'), ['商品采购单 A', '生产单 PO-A'])
    assert.deepEqual(await references('sku', 'sku-one'), ['商品采购单 A', '生产单 PO-A'])
    assert.deepEqual(await references('sku', 'sku-two'), [])
    assert.deepEqual(await references('sku', 'sku-prefix'), [])
    assert.deepEqual(await references('style', 'style-prefix'), [])
    purchases = [purchase('lower', '待采购', 'spu-001', 'spu-001-black-M')]
    savedProduction = [production('lower', 'EXECUTING', snapshot('spu-001', 'spu-001-black-M'))]
    assert.deepEqual(await references('style', 'style-one'), [])
    assert.deepEqual(await references('sku', 'sku-one'), [])
  })
  await t.test('all non-terminal statuses remain active and secondary FCS source snapshots count once', async () => {
    purchases = ['草稿', '待采购', '待确认', '已确认', '已发货', '已到货', '已入库', '未知状态', '已完成', '已关闭'].map((status, i) => purchase(String(i), status))
    savedProduction = [
      production('active', 'EXECUTING', snapshot('OTHER', 'OTHER-M'), [snapshot(), snapshot()]),
      production('pending', 'WAITING_TECH_PACK'), production('unknown', 'UNRECOGNIZED'),
      production('done', 'COMPLETED'), production('cancel', 'CANCELLED'),
    ]
    const actual = await references('sku', 'sku-one')
    assert.deepEqual(actual, [...Array.from({ length: 8 }, (_, i) => `商品采购单 ${i}`), '生产单 PO-active', '生产单 PO-pending', '生产单 PO-unknown'])
    assert.equal(actual.filter(text => text === '生产单 PO-active').length, 1)
  })
  await t.test('FCS read must finish before returning; subsequent checks reread persisted state', async () => {
    purchases = []; storedPurchases = []; savedProduction = [production('latest')]
    let release!: () => void, settled = false
    holdProduction = new Promise(resolve => { release = resolve })
    const pending = references('sku', 'sku-one').then(value => { settled = true; return value })
    await new Promise(resolve => setImmediate(resolve)); assert.equal(settled, false)
    release(); assert.deepEqual(await pending, ['生产单 PO-latest']); holdProduction = undefined
    savedProduction = [production('latest', 'COMPLETED')]
    assert.deepEqual(await references('sku', 'sku-one'), [])
    storedPurchases = [purchase('new-after-reload')]
    assert.deepEqual(await references('sku', 'sku-one'), ['商品采购单 new-after-reload'])
  })
  await t.test('read failures reject instead of treating references as empty', async () => {
    purchaseFailure = true
    await assert.rejects(references('style', 'style-one'), /无法核对商品采购引用.*未归档.*重试/)
    purchaseFailure = false; productionFailure = true
    await assert.rejects(references('style', 'style-one'), /无法核对生产单引用.*未归档.*重试/)
    productionFailure = false
    assert.equal(writes, 0)
  })
  await t.test('one failed domain still awaits the other read before allowing a page retry', async () => {
    let release!: () => void, settled = false
    holdProduction = new Promise(resolve => { release = resolve })
    purchaseFailure = true
    const pending = references('style', 'style-one').then(
      () => { throw new Error('Failed read must not resolve') },
      error => { settled = true; assert.match(error.message, /无法核对商品采购引用/) },
    )
    await new Promise(resolve => setImmediate(resolve)); assert.equal(settled, false)
    release(); await pending; holdProduction = undefined; purchaseFailure = false
    assert.equal(settled, true)
  })
  await t.test('missing archive identity and malformed active external records cannot permit archiving', async () => {
    const beforeReads = purchaseReads + productionReads
    await assert.rejects(references('style', 'missing'), /档案或编码无法读取/)
    assert.equal(purchaseReads + productionReads, beforeReads)
    storedPurchases = [{ purchaseOrderNo: 'invalid', status: '草稿', spu: 'SPU-001' }]
    await assert.rejects(references('sku', 'sku-one'), /无法核对商品采购引用/)
    storedPurchases = []; savedProduction = [{ productionOrderId: 'invalid', productionOrderNo: 'PO-invalid', status: 'EXECUTING' }]
    await assert.rejects(references('style', 'style-one'), /无法核对生产单引用/)
    assert.equal(writes, 0)
  })
})
