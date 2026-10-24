import assert from 'node:assert/strict'
import test from 'node:test'
import { installPmsMemoryIdb } from '../helpers/pms-memory-idb.ts'
import {
  createManualAccessoryPostTransfer,
  isManualTransferExcludedBomItem,
  listManualTransferMaterialCatalog,
  readManualTransferProductionPreview,
} from '../../src/data/wls/accessory-warehouse-manual-transfer.ts'
import { ensureAccessoryWarehouseRecords, listAccessoryRecords } from '../../src/data/wls/accessory-warehouse-records.ts'
import type { AccessoryTransfer } from '../../src/data/wls/accessory-warehouse-flow.ts'

let memory: ReturnType<typeof installPmsMemoryIdb>
const originalRange = Object.getOwnPropertyDescriptor(globalThis, 'IDBKeyRange')
let originalOpen: typeof indexedDB.open

test.before(async () => {
  memory = installPmsMemoryIdb()
  originalOpen = indexedDB.open.bind(indexedDB)
  Object.defineProperty(globalThis, 'IDBKeyRange', {
    configurable: true,
    value: { bound: (lower: string, upper: string) => ({ lower, upper }) },
  })
  const adapted = new WeakSet<object>()
  indexedDB.open = ((...args: Parameters<IDBFactory['open']>) => {
    const request = originalOpen(...args), database = request.result
    if (!adapted.has(database)) {
      adapted.add(database)
      const transaction = database.transaction.bind(database)
      database.transaction = ((...transactionArgs: Parameters<IDBDatabase['transaction']>) => {
        const tx = transaction(...transactionArgs), objectStore = tx.objectStore.bind(tx)
        tx.objectStore = (name: string) => { const store = objectStore(name); if (!store.add) store.add = store.put.bind(store); return store }
        return tx
      }) as IDBDatabase['transaction']
    }
    return request
  }) as IDBFactory['open']
  await ensureAccessoryWarehouseRecords()
})
test.after(() => {
  memory?.restore()
  if (originalRange) Object.defineProperty(globalThis, 'IDBKeyRange', originalRange)
  else Reflect.deleteProperty(globalThis, 'IDBKeyRange')
})

test('技术包 BOM 预览排除面料、吊牌/吊粒和车缝线，数量单位来自 BOM', () => {
  const result = readManualTransferProductionPreview('PO-AW-202610-H04')
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.preview.techPackVersionLabel, 'V1')
  assert.deepEqual(result.preview.rows.map(row => [row.materialName, row.unit]), [['拉链', '条'], ['纽扣', '粒']])
  assert.match(result.preview.excludedSummary, /面料 1 项/)
  assert.match(result.preview.excludedSummary, /品牌\/价格吊牌、吊粒 3 项/)
  assert.match(result.preview.excludedSummary, /车缝线 1 项/)
  assert.equal(isManualTransferExcludedBomItem({ type: '面料', name: '主身面料' }).excluded, true)
  for (const name of ['价格吊牌', '品牌吊牌', '吊粒', '车缝线']) {
    assert.equal(isManualTransferExcludedBomItem({ type: '包装材料', name }).excluded, true, name)
  }
  assert.equal(isManualTransferExcludedBomItem({ type: '辅料', name: '拉链' }).excluded, false)
})

test('通用物料目录按编码一行、有正式物料图，并排除不可后道调拨的 BOM 行', () => {
  const catalog = listManualTransferMaterialCatalog()
  assert.ok(catalog.length > 0)
  assert.equal(new Set(catalog.map(row => row.key)).size, catalog.length)
  assert.ok(catalog.every(row => !row.imageMissing && row.materialSku && row.unit))
  for (const name of ['价格吊牌', '品牌吊牌', '吊粒', '车缝线']) {
    assert.equal(catalog.some(row => row.materialName.includes(name)), false, name)
  }
  const button = catalog.find(row => row.key === 'AW-SCENE-H04-BUTTON')
  assert.deepEqual(button && [button.unit, button.imageUrl], ['粒', '/materials/accessory-button.jpg'])
})

test('人工按生产单创建：中央仓待出库、自动审核历史、同一命令幂等且不写第二份调拨', async () => {
  const input = {
    source: 'PRODUCTION_ORDER' as const,
    productionOrderNo: 'PO-AW-202610-H04',
    actorName: '单元验收计划员',
    lines: [
      { materialKey: 'AW-SCENE-H04-ZIPPER', qty: 10 },
      { materialKey: 'AW-SCENE-H04-BUTTON', qty: 20 },
    ],
    commandId: 'UNIT-MANUAL-PRODUCTION-1',
    at: '2026-10-23T10:00:00.000Z',
  }
  const created = await createManualAccessoryPostTransfer(input)
  assert.equal(created.kind, 'GTP_TO_POST')
  assert.equal(created.status, '待出库')
  assert.equal(created.creationMode, 'MANUAL')
  assert.equal(created.manualSource, 'PRODUCTION_ORDER')
  assert.match(created.manualTransferNo || '', /^HD-PO-AW-202610-H04-M\d{2}$/)
  assert.deepEqual(created.lines.map(line => [line.materialSku, line.unit, line.qty, line.purpose]), [
    ['AW-SCENE-H04-ZIPPER', '条', 10, '其他'],
    ['AW-SCENE-H04-BUTTON', '粒', 20, '其他'],
  ])
  assert.ok(created.lines.every(line => line.fromLocationId.startsWith('WH-FITTING-001-LOCATION-')))
  assert.deepEqual(created.history.map(item => item.action), ['人工创建调拨单', '自动审核通过'])
  assert.equal(created.history[1].by, '辅料中央仓系统')
  const receipt = listAccessoryRecords<any>('receipt').find(row => row.transferId === created.id)
  assert.equal(receipt?.warehouseCode, 'DLN')
  assert.equal(receipt?.status, '待收货')
  const repeated = await createManualAccessoryPostTransfer(input)
  assert.deepEqual(repeated, created)
  assert.equal(listAccessoryRecords<AccessoryTransfer>('transfer').filter(row => row.id === created.id).length, 1)
})

test('人工通用物料创建：不关联生产单、按物料编码去重，数量/库存不合法时中央仓不建单', async () => {
  const button = listManualTransferMaterialCatalog().find(row => row.key === 'AW-SCENE-H04-BUTTON')
  assert.ok(button)
  const created = await createManualAccessoryPostTransfer({
    source: 'GENERAL', actorName: '单元通用计划员',
    lines: [{ materialKey: button!.key, qty: 8 }],
    commandId: 'UNIT-MANUAL-GENERAL-1', at: '2026-10-23T10:10:00.000Z',
  })
  assert.equal(created.manualSource, 'GENERAL')
  assert.equal(created.productionOrderId, 'MANUAL-GENERAL')
  assert.equal(created.manualProductionOrderNo, undefined)
  assert.match(created.manualTransferNo || '', /^HD-GEN-\d{4}$/)

  await assert.rejects(createManualAccessoryPostTransfer({
    source: 'GENERAL', actorName: '单元通用计划员',
    lines: [{ materialKey: button!.key, qty: 1 }, { materialKey: button!.key, qty: 2 }],
    commandId: 'UNIT-MANUAL-DUPLICATE', at: '2026-10-23T10:11:00.000Z',
  }), /同一物料只能添加一行/)
  assert.equal(listAccessoryRecords<AccessoryTransfer>('transfer').some(row => row.id === 'ACCESSORY-MANUAL:UNIT-MANUAL-DUPLICATE'), false)

  await assert.rejects(createManualAccessoryPostTransfer({
    source: 'GENERAL', actorName: '单元通用计划员',
    lines: [{ materialKey: button!.key, qty: 999999 }],
    commandId: 'UNIT-MANUAL-OVER-STOCK', at: '2026-10-23T10:12:00.000Z',
  }), /可用库存不足/)
  assert.equal(listAccessoryRecords<AccessoryTransfer>('transfer').some(row => row.id === 'ACCESSORY-MANUAL:UNIT-MANUAL-OVER-STOCK'), false)
})
