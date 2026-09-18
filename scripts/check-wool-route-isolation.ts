import assert from 'node:assert/strict'
import { readWoolStore, replaceWoolStore } from '../src/data/fcs/wool-domain/store.ts'
import { addWoolHandover, addWoolProcessReport, completeWoolWorkOrder } from '../src/data/fcs/wool-domain/commands.ts'
import { pieceAvailableQty, linkingCapacity, stageReportedQty } from '../src/data/fcs/wool-domain/stage-rules.ts'
import { getWoolOutputReadiness } from '../src/data/fcs/wool-domain/queries.ts'
import { listWoolCraftTaskOrders } from '../src/data/fcs/wool-domain/craft-flow.ts'
import { buildWoolOrderSourceSnapshot } from '../src/data/fcs/wool-domain/tech-pack-source.ts'
import { captureFactoryReceivingData, restoreFactoryReceivingData } from '../src/data/fcs/factory-receiving.ts'
const before = readWoolStore(), receiving = captureFactoryReceivingData()
const knit = 'WOOL-STAGE-007:KNITTING', linking = 'WOOL-STAGE-007:LINKING', sku = 'CARDIGAN-CREAM-M', other = 'CARDIGAN-CREAM-L', at = '2026-09-18 18:00:00'
const report = (code: string, qty: number, commandId: string) => addWoolProcessReport(knit, { commandId, outputSkuCode: code, reportedQty: qty, reportedAt: at, reportedBy: '验收员' })
try {
  const store = structuredClone(before)
  for (const id of [knit, linking]) {
    const order = store.workOrders[id]
    order.externalPieces[1].issues = ['Q2：该片工艺路线成环，不能确定先后顺序']
    order.outputPlanLines.push({ ...order.outputPlanLines[0], outputSkuCode: other, garmentSkuCode: other, sizeCode: 'L' })
  }
  replaceWoolStore(store)
  report(sku, 10, 'route-local-report')
  let facts = readWoolStore(), order = facts.workOrders[knit]
  assert.equal(pieceAvailableQty(facts, order, order.externalPieces[0].pieceKey), 10)
  assert.equal(pieceAvailableQty(facts, order, order.externalPieces[1].pieceKey), 0)
  const handover = { outputSkuCode: sku, handoverQty: 10, handedOverAt: at, handedOverBy: '验收员' }
  addWoolHandover(knit, { ...handover, commandId: 'good-piece-out', pieceKey: order.externalPieces[0].pieceKey })
  assert.throws(() => addWoolHandover(knit, { ...handover, commandId: 'bad-piece-out', pieceKey: order.externalPieces[1].pieceKey }), /路线|分配|上限|可交出/)
  assert.ok(listWoolCraftTaskOrders().some(task => task.woolPieceKey === order.externalPieces[0].pieceKey))
  assert.ok(!listWoolCraftTaskOrders().some(task => task.woolPieceKey === order.externalPieces[1].pieceKey))
  assert.equal(linkingCapacity(readWoolStore(), readWoolStore().workOrders[linking], sku), 0)
  assert.throws(() => completeWoolWorkOrder(knit, { commandId: 'bad-close', completedAt: at, completedBy: '验收员' }), /路线成环/)
  console.log('✓ Q2 坏路线只阻断 Q2；Q1 可填报和真实交出，工艺单保留；本 SKU 未配齐且整单不能完结')
  report(other, 10, 'other-sku-report')
  facts = readWoolStore()
  assert.equal(stageReportedQty(facts, linking, other), 10)
  assert.equal(facts.internalReceipts.filter(r => r.woolOrderId === linking && r.outputSkuCode === other).reduce((n, r) => n + r.qty, 0), 10)
  console.log('✓ 同单无外加工的另一 SKU 仍自动衔接横机交出、缝盘接收及填报')
  const scoped = readWoolStore()
  for (const id of [knit, linking]) scoped.workOrders[id].generationIssuesBySku = { [sku]: ['当前 SKU 缺逐片实例'] }
  replaceWoolStore(scoped)
  assert.throws(() => report(sku, 1, 'bad-sku-report'), /缺逐片实例/)
  assert.equal(getWoolOutputReadiness(knit, sku).canReport, false)
  assert.equal(getWoolOutputReadiness(knit, other).canReport, true)
  report(other, 1, 'good-sku-report')
  assert.equal(stageReportedQty(readWoolStore(), linking, other), 11)
  console.log('✓ 缺实例按 SKU 阻断，不误走自动链，不影响其他 SKU 的填报和数量')
  const source = buildWoolOrderSourceSnapshot({ taskId: 'T', productionOrderId: 'P', productionOrderNo: 'P', kind: 'WHOLE_GARMENT', sourceTechPackVersionId: 'V', sourceTechPackVersionCode: 'v1', woolParts: [],
    skuLines: [sku, other].map((code, index) => ({ skuCode: code, colorCode: index ? 'L' : 'M', colorName: index ? 'L' : 'M', sizeCode: index ? 'L' : 'M', plannedQty: 10 })),
    bomItems: [{ id: 'Y', materialCode: 'YARN', usageProcessCodes: ['PROC_WOOL'] }], colorMaterialMappings: [{ id: 'MAP', mappingOrigin: 'TECH_PACK', status: 'CONFIRMED', colorCode: 'L', lines: [{ id: 'L', bomItemId: 'Y' }] }] })
  assert.deepEqual(source.generationIssues, [])
  assert.ok(source.generationIssuesBySku[sku].length)
  assert.equal(source.generationIssuesBySku[other], undefined)
  console.log('✓ 缺颜色物料关系同样按 SKU 保留，正常 SKU 的资料不受牵连')
} finally {
  restoreFactoryReceivingData(receiving); replaceWoolStore(before)
}
console.log('PASS 4 route isolation checks')
