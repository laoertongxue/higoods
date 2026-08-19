import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import type { BrowserStorageLike } from '../src/data/browser-storage.ts'
import {
  appendCuttingRuntimeEvent,
  type FeiTicketBagSnapshotItem,
} from '../src/data/fcs/cutting/cutting-runtime-event-ledger.ts'
import {
  buildTransferBagGoodsLabelPages,
  resolveTransferBagGoodsLabelSource,
} from '../src/data/fcs/cutting/transfer-bag-goods-label.ts'
import { buildTransferBagGoodsLabelPrintLink } from '../src/data/fcs/fcs-route-links.ts'
import { buildPrintDocument, renderPrintDocument } from '../src/data/fcs/print-template-registry.ts'

function createMemoryStorage(): BrowserStorageLike {
  const records = new Map<string, string>()
  return {
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => { records.set(key, value) },
    removeItem: (key) => { records.delete(key) },
  }
}

function ticket(input: Partial<FeiTicketBagSnapshotItem> & { feiTicketId: string; color: string; size: string; pieceQty: number }): FeiTicketBagSnapshotItem {
  return {
    feiTicketId: input.feiTicketId,
    feiTicketNo: input.feiTicketNo || `FT-${input.feiTicketId}`,
    productionOrderId: input.productionOrderId || 'po-goods-label',
    productionOrderNo: input.productionOrderNo || 'PO-GOODS-001',
    spreadingOrderId: input.spreadingOrderId || 'spreading-goods-label',
    spreadingOrderNo: input.spreadingOrderNo || 'PB-GOODS-001',
    cutOrderId: input.cutOrderId || 'cut-goods-label',
    cutOrderNo: input.cutOrderNo || 'CUT-GOODS-001',
    spuCode: input.spuCode || 'SPU-GOODS-001',
    color: input.color,
    size: input.size,
    partCode: input.partCode ?? 'FRONT',
    partName: input.partName ?? '前片',
    pieceQty: input.pieceQty,
    unit: '片',
    pieceSequenceLabel: input.pieceSequenceLabel || '按菲票追踪',
    hasSpecialCraft: Boolean(input.hasSpecialCraft),
    specialCraftCategory: input.specialCraftCategory || '无',
    specialCraftDisplay: input.specialCraftDisplay || '无',
    receiverFactoryDisplay: input.receiverFactoryDisplay || '无',
    printStatus: input.printStatus || '已打印',
    voidStatus: input.voidStatus || '有效',
  }
}

const matrixSource = {
  usageCycleId: 'cycle:BAG-A-00033:matrix',
  bagCode: 'BAG-A-00033',
  baggingAt: '2026-08-19 09:00',
  tickets: [
    ticket({ feiTicketId: '1', color: 'BLUE', size: 'XL', pieceQty: 20, partCode: 'FRONT', partName: '绝不可打印的超长前侧部位名称-版本一' }),
    ticket({ feiTicketId: '2', color: 'BLUE', size: 'M', pieceQty: 10, partCode: 'BACK', partName: '绝不可打印的超长后侧部位名称' }),
    ticket({ feiTicketId: '3', color: 'BLUE', size: 'XL', pieceQty: 5, partCode: 'BACK', partName: '绝不可打印的超长后侧部位名称' }),
    ticket({ feiTicketId: '4', color: 'PINK', size: 'L', pieceQty: 12, partCode: 'FRONT', partName: '绝不可打印的超长前侧部位名称-版本二' }),
    ticket({ feiTicketId: '5', color: 'PINK', size: '2XL', pieceQty: 8, partCode: 'BACK', partName: '绝不可打印的超长后侧部位名称' }),
  ],
}
const matrixPages = buildTransferBagGoodsLabelPages(matrixSource)
assert.equal(matrixPages.length, 1, '2 色 × 4 码应使用单张标签')
assert.deepEqual(matrixPages[0]?.sizes, ['M', 'L', 'XL', '2XL'], '尺码必须按服装尺码顺序展示')
assert.equal(matrixPages[0]?.partCount, 2, '部位数量必须优先按部位编码去重，同编码名称变化不能重复计数')
assert.equal('partNames' in (matrixPages[0] || {}), false, '打印投影不得继续携带具体部位名称')
assert.equal(matrixPages[0]?.rows.find((row) => row.color === 'BLUE')?.quantities[2], 25, '同颜色尺码的多个部位／菲票必须累加')
assert.equal(matrixPages[0]?.totalPieceQty, 55)
assert.equal(matrixPages[0]?.pagePieceQty, 55)
assert.equal(matrixPages[0]?.ticketCount, 5)

const fallbackPartPages = buildTransferBagGoodsLabelPages({
  ...matrixSource,
  usageCycleId: 'cycle:BAG-A-PART-FALLBACK:1',
  tickets: [
    ticket({ feiTicketId: 'part-fallback-1', color: 'BLUE', size: 'M', pieceQty: 1, partCode: '', partName: '前片' }),
    ticket({ feiTicketId: 'part-fallback-2', color: 'BLUE', size: 'L', pieceQty: 1, partCode: '', partName: '前片' }),
    ticket({ feiTicketId: 'part-fallback-3', color: 'BLUE', size: 'XL', pieceQty: 1, partCode: '', partName: '后片' }),
  ],
})
assert.equal(fallbackPartPages[0]?.partCount, 2, '缺少部位编码时必须按部位名称去重计数')

const manyPartPages = buildTransferBagGoodsLabelPages({
  ...matrixSource,
  usageCycleId: 'cycle:BAG-A-MANY-PARTS:1',
  tickets: Array.from({ length: 32 }, (_, index) => ticket({
    feiTicketId: `many-parts-${index + 1}`,
    color: 'BLUE',
    size: 'M',
    pieceQty: 1,
    partCode: `PART-${index + 1}`,
    partName: `绝不可打印的第 ${index + 1} 个超长部位名称`,
  })),
})
assert.equal(manyPartPages.length, 1, '部位数量增加不得触发额外分页或挤占颜色尺码矩阵')
assert.equal(manyPartPages[0]?.partCount, 32, '部位数量翻倍场景必须准确计数')

const overflowTickets: FeiTicketBagSnapshotItem[] = []
const overflowColors = ['BLUE', 'PINK', 'BLACK', 'WHITE', 'KHAKI']
const overflowSizes = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL']
overflowColors.forEach((color, colorIndex) => overflowSizes.forEach((size, sizeIndex) => {
  overflowTickets.push(ticket({
    feiTicketId: `overflow-${colorIndex}-${sizeIndex}`,
    color,
    size,
    pieceQty: 1,
  }))
}))
const overflowPages = buildTransferBagGoodsLabelPages({
  usageCycleId: 'cycle:BAG-A-OVERFLOW:1',
  bagCode: 'BAG-A-OVERFLOW',
  baggingAt: '2026-08-19 10:00',
  tickets: overflowTickets,
})
assert.equal(overflowPages.length, 4, '5 色 × 9 码必须按 4×6 容量拆为 4 张续页')
assert(overflowPages.every((page, index) => page.pageIndex === index + 1 && page.pageCount === 4), '续页必须重复正确页码')
assert.equal(overflowPages.reduce((sum, page) => sum + page.pagePieceQty, 0), 45, '全部续页数量必须等于整袋数量且不能重复')
assert(overflowPages.every((page) => page.rows.length <= 4 && page.sizes.length <= 6), '多颜色标签不得超过每页 4 色 × 6 码')

const threeByEight = buildTransferBagGoodsLabelPages({
  usageCycleId: 'cycle:BAG-A-3X8:1',
  bagCode: 'BAG-A-3X8',
  baggingAt: '2026-08-19 10:30',
  tickets: ['BLUE', 'PINK', 'BLACK'].flatMap((color, colorIndex) =>
    ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'].map((size, sizeIndex) =>
      ticket({ feiTicketId: `three-eight-${colorIndex}-${sizeIndex}`, color, size, pieceQty: 2 }))),
})
assert.equal(threeByEight.length, 1, '不超过 3 色时一页应容纳 8 个尺码')

assert.throws(() => buildTransferBagGoodsLabelPages({ ...matrixSource, tickets: [ticket({ feiTicketId: 'void', color: 'BLUE', size: 'M', pieceQty: 1, voidStatus: '已作废' })] }), /已作废菲票/)
assert.throws(() => buildTransferBagGoodsLabelPages({ ...matrixSource, tickets: [ticket({ feiTicketId: 'zero', color: 'BLUE', size: 'M', pieceQty: 0 })] }), /非正整数裁片数量/)
assert.throws(() => buildTransferBagGoodsLabelPages({ ...matrixSource, tickets: [
  ticket({ feiTicketId: 'po-1', color: 'BLUE', size: 'M', pieceQty: 1, productionOrderNo: 'PO-1' }),
  ticket({ feiTicketId: 'po-2', color: 'BLUE', size: 'L', pieceQty: 1, productionOrderNo: 'PO-2' }),
] }), /只包含一个生产单/)

const storage = createMemoryStorage()
for (const [usageCycleId, occurredAt, qty] of [
  ['cycle:BAG-CYCLE:OLD', '2026-08-19 08:00', 11],
  ['cycle:BAG-CYCLE:NEW', '2026-08-19 11:00', 29],
] as const) {
  const snapshotTicket = ticket({
    feiTicketId: usageCycleId,
    color: 'BLUE',
    size: 'M',
    pieceQty: qty,
    partName: `绝不可打印的周期部位名称-${usageCycleId}`,
  })
  appendCuttingRuntimeEvent({
    eventType: '菲票装袋',
    eventSource: 'WEB',
    eventStatus: '已同步',
    occurredAt,
    operatorName: '验收装袋员',
    refs: { transferBagCode: 'BAG-CYCLE', usageCycleId, productionOrderNo: 'PO-GOODS-001', feiTicketIds: [snapshotTicket.feiTicketId] },
    payload: {
      baggingRecordId: `bagging-${usageCycleId}`,
      bagCode: 'BAG-CYCLE',
      feiTicketItems: [snapshotTicket],
      totalPieceQty: qty,
      mixedFlag: false,
      baggingBy: '验收装袋员',
      baggingAt: occurredAt,
    },
  }, storage)
}
assert.equal(resolveTransferBagGoodsLabelSource('cycle:BAG-CYCLE:OLD', storage)?.tickets[0]?.pieceQty, 11, '旧周期补打必须读取旧快照')
assert.equal(resolveTransferBagGoodsLabelSource('cycle:BAG-CYCLE:NEW', storage)?.tickets[0]?.pieceQty, 29, '新周期必须读取新快照')
assert.equal(resolveTransferBagGoodsLabelSource('cycle:missing', storage), null)

Object.defineProperty(globalThis, 'window', { value: { localStorage: storage }, configurable: true })
const printDocument = buildPrintDocument({
  documentType: 'TRANSFER_BAG_GOODS_LABEL',
  sourceType: 'TRANSFER_BAG_USAGE_RECORD',
  sourceId: 'cycle:BAG-CYCLE:OLD,cycle:BAG-CYCLE:NEW',
})
const printHtml = renderPrintDocument(printDocument)
assert.equal(printDocument.paperType, 'LABEL_100_100')
assert.equal(printDocument.totalCopies, 2, '批量打印每个单页袋应各生成一张独立标签')
assert.equal(printDocument.thermalPaperColor, 'WHITE')
assert.match(printHtml, /@page \{ size: 100mm 100mm; margin: 0; \}/)
assert.match(printHtml, /data-testid="transfer-bag-goods-label"/)
assert.match(printHtml, /颜色＼尺码/)
assert.match(printHtml, /部位数量<\/span><strong>1 个<\/strong>/, '票面必须只显示去重后的部位数量')
assert.doesNotMatch(printHtml, /绝不可打印的/, '具体部位名称不得进入货物标识 HTML')
assert.match(printHtml, /按袋号插入对应中转袋/)
assert.doesNotMatch(printHtml, /<img\b/i, '黑白热敏货物标识不得包含图片')
assert.throws(() => buildPrintDocument({
  documentType: 'TRANSFER_BAG_GOODS_LABEL',
  sourceType: 'TRANSFER_BAG_USAGE_RECORD',
  sourceId: 'cycle:BAG-CYCLE:OLD,cycle:missing',
}), /整批未生成/, '批量中任一周期无快照时必须整批阻断')
assert.throws(() => buildPrintDocument({
  documentType: 'TRANSFER_BAG_GOODS_LABEL',
  sourceType: 'TRANSFER_BAG_USAGE_RECORD',
  sourceId: '',
}), /至少选择一个中转袋使用周期/, '空选择不得生成空白标签')
delete (globalThis as { window?: unknown }).window

const batchLink = buildTransferBagGoodsLabelPrintLink(['cycle:old', 'cycle:new'])
assert.match(batchLink, /documentType=TRANSFER_BAG_GOODS_LABEL/)
assert.match(batchLink, /sourceType=TRANSFER_BAG_USAGE_RECORD/)
assert(batchLink.indexOf('cycle%3Aold') < batchLink.indexOf('cycle%3Anew'), '批量来源必须保持勾选顺序')

const projectFiles = {
  warehouseHub: readFileSync(new URL('../src/pages/process-factory/cutting/warehouse-hub.ts', import.meta.url), 'utf8'),
  locationLabel: readFileSync(new URL('../src/pages/process-factory/cutting/warehouse-location-map.ts', import.meta.url), 'utf8'),
  labelTemplate: readFileSync(new URL('../src/pages/print/templates/label-print-template.ts', import.meta.url), 'utf8'),
}
assert.equal((projectFiles.warehouseHub.match(/>打印货物标识<\/button>/g) || []).length >= 1, true, '列表必须存在行级打印货物标识')
assert.match(projectFiles.warehouseHub, />批量打印货物标识<\/button>/)
assert.match(projectFiles.warehouseHub, /const waitHandoverGoodsLabelSelectionState = new Map<WaitHandoverGoodsLabelListKey, WaitHandoverGoodsLabelSelectionState>/, '装袋与入仓批量选择必须按列表键独立保存')
assert.match(projectFiles.warehouseHub, /action === 'toggle-current-page'[\s\S]*closest<HTMLElement>\(`\[data-wait-handover-paged-list="\$\{listKey\}"\]`\)/, '全选必须只读取当前列表当前页的复选框')
assert.match(projectFiles.warehouseHub, /action === 'cancel-batch'[\s\S]*state\.active = false[\s\S]*state\.selectedUsageCycleIds = \[\]/, '取消批量必须退出模式并清空该列表选择')
assert.match(projectFiles.warehouseHub, /请至少勾选一个中转袋后再打印货物标识/, '无选择时必须给出明确恢复动作')
assert.match(projectFiles.warehouseHub, /actualInboundTempUseRows = inboundTempUseRows\.filter\(\(bag\) => bag\.hasInboundRecord\)/, '入仓列表必须过滤真实入仓记录')
assert.match(projectFiles.locationLabel, /@page \{ size: 100mm 100mm; margin: 0; \}/)
assert.match(projectFiles.locationLabel, /data-location-label-line="location"[\s\S]*data-location-label-line="area"[\s\S]*data-location-label-line="guide"[\s\S]*data-location-label-line="qr"[\s\S]*data-location-label-line="barcode"/, '库位标签必须按五段顺序排列')
const identitySegment = projectFiles.labelTemplate.slice(
  projectFiles.labelTemplate.indexOf('export function buildTransferBagLabelPrintDocument'),
  projectFiles.labelTemplate.indexOf('export function buildTransferBagGoodsLabelPrintDocument'),
)
assert.match(identitySegment, /paperType: 'LABEL_100_100'/)
assert.doesNotMatch(identitySegment, /颜色|尺码|库区|库位/, '中转袋身份标签不得混入货物或库位字段')

console.log('transfer-bag goods label, list actions, identity size and location-label layout contracts passed')
