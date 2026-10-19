import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { ACCESSORY_GTP_WAREHOUSE as GTP, ACCESSORY_HILON_WAREHOUSE as HILON, type AccessoryPreparation } from '../../src/data/wls/accessory-warehouse-flow.ts'
import { listAccessoryWarehouseLocations } from '../../src/data/wls/accessory-warehouse-master.ts'
import { getAccessoryStockId, reserveAccessoryPreparationStock, type AccessoryStock } from '../../src/data/wls/accessory-warehouse-stock.ts'
import {
  listAccessoryStaticStockSources, listAccessoryStockSources, readAccessoryStockSource,
  projectAccessoryPreparationAvailability, getAccessoryStockMaterialMetadata,
} from '../../src/data/wls/accessory-warehouse-stock-sources.ts'

function location(code: string): string {
  const row = listAccessoryWarehouseLocations(GTP).find(item => item.locationCode === code)
  assert.ok(row)
  return row.id
}
function preparation(id = 'PREP-1'): AccessoryPreparation {
  return { id, productionOrderId: 'PO-1', productionOrderNo: 'PO-1', styleName: '演示款', styleImageUrl: '/shirt-sample.jpg',
    techPackVersion: 'TP-1', cuttingFactoryId: null, cuttingFactoryName: null, version: 0, status: '待配料', remark: '', history: [],
    lines: [{ id: 'ZIP', materialSku: 'AW-DEMO-ZIPPER', materialName: '拉链', imageUrl: '/materials/accessory-zipper.jpg',
      color: '标准色', spec: '演示', unit: '条', requiredQty: 500, preparedQty: 0, availableQty: 99999,
      locationId: 'ACC-B-001', purpose: '其他', requiresCutting: false }] }
}

test('静态库存底稿固定且隔离复制，不依赖订单需求、不生成站点实物库存', () => {
  const first = listAccessoryStaticStockSources(), before = structuredClone(first)
  assert.ok(first.length > 50)
  assert.equal(first.every(stock => stock.warehouseCode === GTP && stock.version === 0 && stock.reservedQty === 0), true)
  assert.equal(new Set(first.map(stock => stock.id)).size, first.length)
  assert.equal(first.find(stock => stock.materialSku === 'AW-DEMO-ZIPPER')?.onHandQty, 600)
  assert.equal(first.find(stock => stock.materialSku === 'tdv_demand_SPU_2024_014-bom-accessory-zipper')?.onHandQty, 2400)
  assert.equal(first.find(stock => stock.materialSku === 'tdv_demand_SPU_2024_021-bom-accessory-zipper')?.onHandQty, 0)
  first[0].onHandQty = 999
  assert.deepEqual(listAccessoryStaticStockSources(), before)
})

test('保存的 0 余额完整覆盖底稿且预留不丢失，未知历史库位不自动映射', () => {
  const stocks = listAccessoryStaticStockSources(), seed = stocks.find(stock => stock.materialSku === 'AW-DEMO-ZIPPER')!
  const changed = { ...seed, onHandQty: 0, version: 1 }, original = structuredClone(changed)
  const read = readAccessoryStockSource(changed, [changed])
  assert.equal(read?.onHandQty, 0)
  assert.equal(read?.version, 1)
  read!.onHandQty = 5
  assert.deepEqual(changed, original)
  assert.equal(readAccessoryStockSource({ ...seed, locationId: 'ACC-B-001' }), null)
  assert.equal(readAccessoryStockSource({ ...seed, unit: '米' }), null)
  assert.equal(readAccessoryStockSource({ ...seed, warehouseCode: HILON }), null)
})

test('实物余额由多个生产单共享，第二单不能重建底稿借用已预留数量', () => {
  const stocks = listAccessoryStockSources(), row = stocks.find(stock => stock.materialSku === 'AW-DEMO-ZIPPER')!
  const reserved = reserveAccessoryPreparationStock(stocks, preparation(), [{ lineId: 'ZIP', qty: 400, locationId: row.locationId }], {
    operationId: 'RESERVE-1', expectedVersions: { [row.id]: row.version },
  }).changed
  const merged = listAccessoryStockSources(reserved), projected = projectAccessoryPreparationAvailability(preparation('PREP-2'), merged)
  assert.equal(projected.lines[0].availableQty, 200)
  assert.throws(() => reserveAccessoryPreparationStock(merged, projected, [{ lineId: 'ZIP', qty: 201, locationId: row.locationId }], {
    operationId: 'RESERVE-2', expectedVersions: { [row.id]: 1 },
  }), /库存不足/)
  assert.equal(listAccessoryStockSources(reserved).find(stock => stock.id === row.id)?.onHandQty, 600)
  assert.equal(listAccessoryStockSources(reserved).find(stock => stock.id === row.id)?.reservedQty, 400)
})

test('可用数量投影保留历史实配和片段；按选中位置核对而非假定旧位属于新位', () => {
  const input = preparation(), firstLocation = location('GTP-A-01'), secondLocation = location('GTP-A-02')
  input.lines[0].preparedQty = 20
  input.lines[0].allocations = [{ locationId: 'ACC-B-001', qty: 20 }]
  const before = structuredClone(input), sources = listAccessoryStockSources()
  const projected = projectAccessoryPreparationAvailability(input, sources, { locationByLine: { ZIP: firstLocation } })
  assert.equal(projected.lines[0].availableQty, 600)
  assert.equal(projected.lines[0].locationId, 'ACC-B-001')
  assert.deepEqual(projected.lines[0].allocations, [{ locationId: 'ACC-B-001', qty: 20 }])
  assert.equal(projectAccessoryPreparationAvailability(input, sources, { locationByLine: { ZIP: secondLocation } }).lines[0].availableQty, 0)
  assert.equal(projectAccessoryPreparationAvailability(input, sources, { locationByLine: { ZIP: 'ACC-B-001' } }).lines[0].availableQty, 0)
  assert.deepEqual(input, before)
  projected.lines[0].allocations![0].qty = 1
  assert.deepEqual(input, before)
})

test('损坏或重复保存库存阻断，不能回退静态余额或把同一库存累计两次', () => {
  const stock = listAccessoryStaticStockSources()[0]
  assert.throws(() => listAccessoryStockSources([stock, stock]), /重复/)
  assert.throws(() => listAccessoryStockSources([{ ...stock, onHandQty: -1 }]), /库存数量/)
  assert.throws(() => projectAccessoryPreparationAvailability(preparation(), [stock, stock]), /重复累计/)
  assert.throws(() => listAccessoryStockSources([{ ...stock, id: 'WRONG' }]), /身份/)
})

test('实际站点收货库存作为保存记录读回，原型不会预先给 HILON/Mahameru 分配种子', () => {
  const stock: AccessoryStock = { warehouseCode: HILON, locationId: 'HILON-REAL-1', materialSku: 'AW-DEMO-ZIPPER', unit: '条',
    id: getAccessoryStockId(HILON, 'HILON-REAL-1', 'AW-DEMO-ZIPPER', '条'), onHandQty: 100, reservedQty: 0, version: 1,
    sourceRefs: [{ kind: 'TRANSFER_IN', sourceId: 'TRANSFER-1', qty: 100, operationId: 'RECEIVE-1' }] }
  assert.deepEqual(readAccessoryStockSource(stock, [stock]), stock)
  assert.equal(listAccessoryStockSources([stock]).filter(row => row.warehouseCode === HILON).length, 1)
})

test('库存目录每个固定 SKU 都有精确名称及存在的图片，不依赖已保存配料才显示识别资料', () => {
  for (const stock of listAccessoryStaticStockSources()) {
    const metadata = getAccessoryStockMaterialMetadata(stock.materialSku)
    assert.ok(metadata, stock.materialSku)
    assert.ok(metadata.materialName && metadata.color && metadata.spec)
    assert.ok(existsSync(resolve('public', metadata.imageUrl.slice(1))), metadata.imageUrl)
  }
  assert.equal(getAccessoryStockMaterialMetadata('UNKNOWN-AW-MATERIAL'), null)
  const first = getAccessoryStockMaterialMetadata('AW-DEMO-PRICE-TAG')!
  first.materialName = '错误名称'
  assert.equal(getAccessoryStockMaterialMetadata('AW-DEMO-PRICE-TAG')?.materialName, '价格吊牌')
})

test('新增物料图来源、许可和文件字节一致；生成吊粒保留效果图身份', () => {
  const sources = JSON.parse(readFileSync(resolve('public/materials/accessory-flow/sources.json'), 'utf8'))
  assert.equal(sources.assets.length, 3)
  for (const asset of sources.assets) {
    const payload = readFileSync(resolve('public', asset.path.slice(1)))
    assert.equal(payload.length, asset.bytes)
    assert.equal(createHash('sha256').update(payload).digest('hex'), asset.sha256)
    assert.equal(getAccessoryStockMaterialMetadata(asset.materialSku)?.imageUrl, asset.path)
  }
  assert.equal(sources.assets[0].author, 'GeoTrinity')
  assert.equal(sources.assets[0].license, 'CC BY-SA 3.0')
  assert.equal(sources.assets[1].author, 'Silar')
  assert.equal(sources.assets[1].license, 'CC BY-SA 4.0')
  assert.equal(sources.assets[2].kind, 'AI 生成演示物料效果图')
  assert.match(sources.assets[2].prompt, /演示物料效果图/)
})
