import test from 'node:test'
import assert from 'node:assert/strict'
import { buildGtpPreparationSheets, emptyGtpPreparationFilters, filterGtpPreparationSheets, gtpLineProgress } from '../../src/pages/wls/accessory-warehouses/gtp-preparation-model.ts'
import type { AccessoryPreparation, AccessoryTransfer, AccessoryPickup } from '../../src/data/wls/accessory-warehouse-flow.ts'

const preparation: AccessoryPreparation = { id: 'PREP-1', productionOrderId: 'PO-1', productionOrderNo: 'PO-1', styleName: '衬衫', styleImageUrl: '/shirt.jpg',
  techPackVersion: 'V1', cuttingFactoryId: null, cuttingFactoryName: null, version: 0, status: '配料中', remark: '', history: [],
  lines: [{ id: 'LINE-1', materialSku: 'ZIP-1', materialName: '拉链', imageUrl: '/zip.jpg', color: '黑', spec: '30cm', unit: '条', requiredQty: 100,
    preparedQty: 40, availableQty: 60, locationId: '', purpose: '其他', requiresCutting: false },
  { id: 'LINE-2', materialSku: 'THREAD-1', materialName: '车缝线', imageUrl: '/thread.jpg', color: '黑', spec: '', unit: '公斤', requiredQty: 1,
    preparedQty: 0.4, availableQty: 0.2, locationId: '', purpose: '车缝线', requiresCutting: false }] }
const build = (preparations = [preparation]) => buildGtpPreparationSheets({ preparations, projections: [], orders: [], demands: [], tasks: [], transfers: [], pickups: [] })

test('GTP查询以本单剩余需求判断齐全，缺少日期不伪造为范围内', () => {
  const rows = build(), filter = emptyGtpPreparationFilters()
  assert.equal(rows[0].stockFull, false)
  assert.equal(filterGtpPreparationSheets(rows, { ...filter, stockFull: 'no', factory: '待分配' }).length, 1)
  assert.equal(filterGtpPreparationSheets(rows, { ...filter, stockFull: 'yes' }).length, 0)
  assert.equal(filterGtpPreparationSheets(rows, { ...filter, from: '2026-10-01' }).length, 0)
})
test('GTP查询明确区分物料、生产单和全部，不把款名套入指定单号条件', () => {
  const rows = build(), filter = emptyGtpPreparationFilters()
  assert.equal(filterGtpPreparationSheets(rows, { ...filter, keyword: 'ZIP-1', searchField: 'material' }).length, 1)
  assert.equal(filterGtpPreparationSheets(rows, { ...filter, keyword: 'ZIP-1', searchField: 'order' }).length, 0)
  assert.equal(filterGtpPreparationSheets(rows, { ...filter, keyword: '衬衫' }).length, 1)
})
test('GTP调出与三方实领分别投影，未出库调拨不算已发，失效领料不重复计数', () => {
  const row = build()[0]
  const line = { id: 'T-L1', sourceLineId: 'LINE-1', materialSku: 'ZIP-1', unit: '条', qty: 40, handedQty: 15 }
  row.transfers = [
    { kind: 'GTP_TO_SITE', status: '待出库', lines: [line] } as unknown as AccessoryTransfer,
    { kind: 'GTP_TO_SITE', status: '已收货', lines: [line] } as unknown as AccessoryTransfer,
    { kind: 'SITE_REASSIGN', status: '已收货', lines: [line] } as unknown as AccessoryTransfer,
  ]
  row.pickups = [{ status: '领料中', lines: [line] }, { status: '已失效', lines: [line] }] as unknown as AccessoryPickup[]
  assert.deepEqual(gtpLineProgress(row, preparation.lines[0]), { required: 100, prepared: 40, remaining: 60, dispatched: 40, picked: 15 })
  assert.deepEqual(gtpLineProgress(row, preparation.lines[1]), { required: 1, prepared: 0.4, remaining: 0.6, dispatched: 0, picked: 0 })
})

test('独立车缝领料状态按领料单应领判断，后道辅料不造成永远领料中，建单时间不冒充实领时间', () => {
  const pickup = { preparationId: preparation.id, status: '已领料', lines: [{ sourceLineId: 'LINE-2', materialSku: 'THREAD-1', unit: '公斤', requiredQty: 1, handedQty: 1 }],
    history: [{ action: '建立车缝领料单', at: '2026-10-19T01:00:00Z' }, { action: '车缝领料实交', at: '2026-10-20T01:00:00Z' }] } as unknown as AccessoryPickup
  const [sheet] = buildGtpPreparationSheets({ preparations: [preparation], projections: [], orders: [], demands: [], tasks: [], transfers: [], pickups: [pickup] })
  assert.equal(sheet.pickupStatus, '已领料')
  assert.equal(sheet.firstPickedAt, '2026-10-20T01:00:00Z')
})
