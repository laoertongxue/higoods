import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTransferBagGoodsLabelPages, type TransferBagGoodsLabelSource } from '../../src/data/fcs/cutting/transfer-bag-goods-label.ts'
import { replacementFabricBagTicket, bagTicketFieldMissing } from '../../src/data/fcs/cutting/mixed-transfer-bag-ticket.ts'
import { createReplacementFabricTickets, replacementFabricMaterialKey } from '../../src/data/fcs/cutting/replacement-fabric-fei-tickets.ts'
import type { FeiTicketBagSnapshotItem } from '../../src/data/fcs/cutting/cutting-runtime-event-ledger.ts'

const material = { key: replacementFabricMaterialKey('FAB-1', '蓝'), code: 'FAB-1', name: '棉布', color: '蓝', imageUrl: '/material.jpg', skuCodes: ['sku1'] }
const scope = { productionOrderId: 'po1', productionOrderNo: 'PO-001', factoryId: 'cut1', assignmentKey: 'cut-assignment', materials: [material], issues: [] }
const ticket = createReplacementFabricTickets({ tickets: [], prints: [], receipts: [] }, scope, material.key, 1, { id: 'c1', at: '2026-09-25T00:00:00Z', operator: '仓管' })[0]
const fabric = { ...replacementFabricBagTicket(ticket), spuCode: '', printStatus: '已打印', voidStatus: '有效', unit: '片' } as FeiTicketBagSnapshotItem
const cut = { ...fabric, ticketKind: 'CUT_PIECE', feiTicketId: 'cut1', feiTicketNo: 'FT-001', partCode: 'front', partName: '前片', size: 'M', pieceQty: 50, quantity: undefined, quantityUnit: undefined } as FeiTicketBagSnapshotItem
const binding = { ...fabric, ticketKind: 'BINDING_STRIP', feiTicketId: 'binding1', feiTicketNo: 'BND-001', quantity: 8, quantityUnit: '米', replacementSequence: undefined } as FeiTicketBagSnapshotItem
const source = (tickets: FeiTicketBagSnapshotItem[]): TransferBagGoodsLabelSource => ({ usageCycleId: 'bag-cycle-1', bagCode: 'BAG-1', baggingAt: '2026-09-25T00:00:00Z', tickets })

test('混装打印保留裁片矩阵，捆条和换片布独立附页，不合并单位', () => {
  const pages = buildTransferBagGoodsLabelPages(source([cut, fabric, binding]))
  assert.equal(pages.length, 3)
  assert.deepEqual(pages[0].sizeTotals, [50])
  assert.equal(pages[0].totalPieceQty, 50)
  assert.deepEqual(pages.map(page => [page.pageIndex, page.pageCount]), [[1, 3], [2, 3], [3, 3]])
  assert.equal(pages[1].fabricItems?.[0].quantity, 5)
  assert.equal(pages[2].fabricItems?.[0].quantity, 8)
  assert.equal(pages[1].fabricItems?.[0].materialImageUrl, '/material.jpg')
  assert.match(pages[0].fabricSummary!, /换片布（Yard） 5；捆条（米） 8/)
})
test('纯换片布袋可生成货物标识，不制造尺码和部位', () => {
  const [page] = buildTransferBagGoodsLabelPages(source([fabric]))
  assert.equal(page.totalPieceQty, 0)
  assert.deepEqual(page.sizes, [])
  assert.equal(page.partCount, 0)
  assert.equal(page.fabricItems?.[0].replacementSequence, 1)
  for (const field of ['size', 'partName', 'cutOrderId'] as const) assert.equal(bagTicketFieldMissing(replacementFabricBagTicket(ticket), field), false)
})
test('混装标签拒绝换片布错误长度、作废票和混生产单', () => {
  assert.throws(() => buildTransferBagGoodsLabelPages(source([{ ...fabric, quantity: 4 }])), /数量/)
  assert.throws(() => buildTransferBagGoodsLabelPages(source([{ ...fabric, quantityUnit: '米' }])), /数量/)
  assert.throws(() => buildTransferBagGoodsLabelPages(source([{ ...fabric, voidStatus: '已作废' }])), /已作废/)
  assert.throws(() => buildTransferBagGoodsLabelPages(source([cut, { ...fabric, productionOrderNo: 'PO-OTHER' }])), /一个生产单/)
})
