import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  POST_FINISHING_ACCEPTANCE_ACTORS,
  PostFinishingFlowGateError,
  confirmPostFinishingFactoryReturn,
  getPostFinishingReturnSourceScanValue,
  registerPostFinishingFactoryReturn,
  resetPostFinishingFullFlow,
  resolvePostFinishingReturnRegistrationSource,
} from '../src/data/fcs/post-finishing-full-flow.ts'
import { getPostFinishingAuthorizationDisplay } from '../src/data/fcs/post-finishing-authorization.ts'

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

function expectFlowCode(code: PostFinishingFlowGateError['code'], run: () => unknown): void {
  try {
    run()
  } catch (error) {
    assert(error instanceof PostFinishingFlowGateError, `应抛出后道全流程门禁错误 ${code}`)
    assert.equal(error.code, code, `门禁错误码应为 ${code}`)
    return
  }
  assert.fail(`预期门禁 ${code} 阻断操作`)
}

resetPostFinishingFullFlow()
const actor = POST_FINISHING_ACCEPTANCE_ACTORS.factoryCourier
const confirmer = POST_FINISHING_ACCEPTANCE_ACTORS.returnConfirmer
let source = resolvePostFinishingReturnRegistrationSource(getPostFinishingReturnSourceScanValue('PO-QC-202608-001', 6))
assert.equal(source.productionOrder.skus.length, 5, '公共 PDA 每次回货必须识别完整 5 个 SKU')
assert.equal(source.returnIndex, 6, '回货来源解析不得再限制为第 1 至 5 次')

expectFlowCode('INVALID_QUANTITY', () => registerPostFinishingFactoryReturn({
  productionOrderNo: source.productionOrder.productionOrderNo,
  returnIndex: 6,
  triggerSource: '公共PDA自助回货',
  idempotencyKey: 'SELF-RETURN-ZERO-GATE',
  quantities: source.productionOrder.skus.map((sku) => ({ skuId: sku.skuId, registeredQty: 0 })),
  deliveryPersonName: actor.actorName,
  deliveryPersonPhone: '081200000001',
  evidenceImageUrls: ['/shirt-sample.jpg'],
  actor,
}))

const partial = registerPostFinishingFactoryReturn({
  productionOrderNo: source.productionOrder.productionOrderNo,
  returnIndex: 6,
  triggerSource: '公共PDA自助回货',
  idempotencyKey: 'SELF-RETURN-PARTIAL-SKU',
  quantities: source.productionOrder.skus.map((sku, index) => ({ skuId: sku.skuId, registeredQty: index === 0 ? 20 : 0 })),
  deliveryPersonName: actor.actorName,
  deliveryPersonPhone: '081200000006',
  evidenceImageUrls: ['/shirt-sample.jpg'],
  actor,
})
assert.deepEqual(partial.lines.map((line) => line.registeredQty), [20, 0, 0, 0, 0], '同一次回货允许部分 SKU 为 0，并保留完整 SKU 明细')
const partialConfirmed = confirmPostFinishingFactoryReturn({
  deliveryId: partial.deliveryId,
  firstCounts: partial.lines.map((line) => ({ skuId: line.sku.skuId, actualQty: line.registeredQty })),
  actor: confirmer,
})
assert.equal(partialConfirmed.status, '已确认待送检', '登记为 0 且实收为 0 的 SKU 不应产生除零差异或二次点数')

registerPostFinishingFactoryReturn({
  productionOrderNo: source.productionOrder.productionOrderNo,
  returnIndex: 7,
  triggerSource: '公共PDA自助回货',
  idempotencyKey: 'SELF-RETURN-CONSERVATION-REMAINING',
  quantities: source.productionOrder.skus.map((sku, index) => ({ skuId: sku.skuId, registeredQty: index === 0 ? 80 : 0 })),
  deliveryPersonName: actor.actorName,
  deliveryPersonPhone: '081200000007',
  evidenceImageUrls: ['/shirt-sample.jpg'],
  actor,
})
expectFlowCode('INVALID_QUANTITY', () => registerPostFinishingFactoryReturn({
  productionOrderNo: source.productionOrder.productionOrderNo,
  returnIndex: 8,
  triggerSource: '公共PDA自助回货',
  idempotencyKey: 'SELF-RETURN-CONSERVATION-OVER',
  quantities: source.productionOrder.skus.map((sku, index) => ({ skuId: sku.skuId, registeredQty: index === 0 ? 1 : 0 })),
  deliveryPersonName: actor.actorName,
  deliveryPersonPhone: '081200000008',
  evidenceImageUrls: ['/shirt-sample.jpg'],
  actor,
}))

resetPostFinishingFullFlow()
source = resolvePostFinishingReturnRegistrationSource(getPostFinishingReturnSourceScanValue('PO-QC-202608-001', 1))

const boundary = registerPostFinishingFactoryReturn({
  productionOrderNo: source.productionOrder.productionOrderNo,
  returnIndex: 1,
  triggerSource: '公共PDA自助回货',
  idempotencyKey: 'SELF-RETURN-BOUNDARY',
  quantities: source.productionOrder.skus.map((sku) => ({ skuId: sku.skuId, registeredQty: 20 })),
  deliveryPersonName: actor.actorName,
  deliveryPersonPhone: '081200000001',
  evidenceImageUrls: ['/shirt-sample.jpg'],
  actor,
})
const boundaryConfirmed = confirmPostFinishingFactoryReturn({
  deliveryId: boundary.deliveryId,
  firstCounts: boundary.lines.map((line) => ({ skuId: line.sku.skuId, actualQty: 19 })),
  actor: confirmer,
})
assert.equal(boundaryConfirmed.status, '已确认待送检', '逐 SKU -5%边界无需授权即可确认')

const over = registerPostFinishingFactoryReturn({
  productionOrderNo: source.productionOrder.productionOrderNo,
  returnIndex: 2,
  triggerSource: '车缝正常交出',
  idempotencyKey: 'SELF-RETURN-OVER-FIVE',
  quantities: source.productionOrder.skus.map((sku) => ({ skuId: sku.skuId, registeredQty: 20 })),
  deliveryPersonName: actor.actorName,
  deliveryPersonPhone: '081200000002',
  evidenceImageUrls: ['/shirt-sample.jpg'],
  actor,
})
const overCounts = over.lines.map((line) => ({ skuId: line.sku.skuId, actualQty: 18 }))
expectFlowCode('SECOND_COUNT_REQUIRED', () => confirmPostFinishingFactoryReturn({ deliveryId: over.deliveryId, firstCounts: overCounts, actor: confirmer }))
expectFlowCode('AUTHORIZATION_REQUIRED', () => confirmPostFinishingFactoryReturn({ deliveryId: over.deliveryId, firstCounts: overCounts, secondCounts: overCounts, actor: confirmer }))
const nowMs = Date.UTC(2026, 7, 31, 16, 0, 0)
const authorized = confirmPostFinishingFactoryReturn({
  deliveryId: over.deliveryId,
  firstCounts: overCounts,
  secondCounts: overCounts,
  actor: confirmer,
  authorization: {
    scanValue: getPostFinishingAuthorizationDisplay('AUTH-QC-001', nowMs).scanPayload,
    differenceReason: '复点后逐 SKU 仍超过 5%',
    nowMs,
  },
  nowMs,
})
assert.equal(authorized.status, '已确认待送检', '超过 5%必须完成二次点数和有效授权后才能确认')

const lockedPage = read('src/pages/pda-sewing-self-return.ts')
const handoverPage = read('src/pages/pda-handover.ts')
const handoverDetail = read('src/pages/pda-handover-detail.ts')
const handoverEvents = read('src/data/fcs/pda-handover-events.ts')
const waitProcessPage = read('src/pages/pda-warehouse-wait-process.ts')
const webEvents = read('src/pages/process-factory/post-finishing/events.ts')

assert(lockedPage.includes('registerPostFinishingFactoryReturn'), '公共 PDA 必须写入新的送货/回货全流程事实')
assert(lockedPage.includes('min="0"') && lockedPage.includes('本次至少一个 SKU 大于 0'), '公共 PDA 必须允许单个 SKU 为 0，并说明本批至少一个 SKU 大于 0')
assert(lockedPage.includes('来源任务') && lockedPage.includes('本来源可登记') && lockedPage.includes('管理员退出'), '公共 PDA 必须展示来源任务、可登记数量和管理员退出')
assert(!lockedPage.includes('createPostFinishingSewingSelfReturnAndSyncHandover'), '公共 PDA 不得再写入旧自助回货事实')
assert(handoverPage.includes('/fcs/pda/post-finishing/return-confirm'), '通用交接页必须保留当前专用回货确认入口')
for (const legacy of ['pickupSourceType', 'ensurePostFinishingSewingSelfReturnMockRecords', 'syncAllPostFinishingSewingSelfReturnHandoverRecords']) {
  assert(!handoverPage.includes(legacy), `通用交接页不得保留旧自助回货投影：${legacy}`)
  assert(!handoverEvents.includes(legacy), `通用交接事实不得保留旧自助回货投影：${legacy}`)
}
assert(!handoverDetail.includes('旧回货接收入口已关闭') && !handoverDetail.includes('confirmPostFinishingSewingSelfReturnWarehouseRecord'), '通用交接详情不得保留旧回货兼容页面或直接入库动作')
assert(waitProcessPage.includes("from '../data/fcs/post-finishing-full-flow.ts'") && waitProcessPage.includes('/fcs/pda/post-finishing/return-confirm') && !waitProcessPage.includes('confirmPostFinishingSewingSelfReturnWarehouseRecord'), '待加工仓必须只读当前全流程并引导到专用回货确认页')
assert(!webEvents.includes("if (action === 'open-self-return-confirm')") && !webEvents.includes("if (action === 'open-self-return-edit')"), 'Web 旧回货确认与修改处理器必须退出事件链')

console.log('post-finishing sewing self-return acceptance passed: 任意回货序号、部分 SKU 为 0、累计守恒、±5%边界和旧入口收口均通过')
