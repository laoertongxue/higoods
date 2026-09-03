#!/usr/bin/env node

import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import {
  POST_FINISHING_ACCEPTANCE_ACTORS,
  POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS,
  POST_FINISHING_PROCESS_ITEMS,
  POST_FINISHING_RETURN_DIFFERENCE_POLICY,
  PostFinishingFlowGateError,
  claimPostFinishingQcTask,
  claimPostFinishingRecheckOrder,
  completePostFinishingPostTask,
  completePostFinishingQcTask,
  completePostFinishingRecheckOrderFullFlow,
  confirmPostFinishingFactoryReturn,
  discardPostFinishingFactoryReturn,
  getPostFinishingFactoryReturn,
  getPostFinishingMaterialReadiness,
  getPostFinishingReturnSourceScanValue,
  getPostFinishingReturnToleranceRate,
  listPostFinishingDefectRecords,
  listPostFinishingFactoryReturns,
  listPostFinishingFullFlowOutboundOrders,
  listPostFinishingFullFlowPostTasks,
  listPostFinishingFullFlowQcTasks,
  listPostFinishingFullFlowRecheckOrders,
  listPostFinishingMaterialStocks,
  listPostFinishingMaterialTransferOrders,
  listPostFinishingPostReturnReceiverOptions,
  listPostFinishingReturnRegistrationSources,
  listPostFinishingWarehouseReceipts,
  listPostFinishingWaitProcessWarehouseMovements,
  listPostFinishingWaitProcessWarehouseRecords,
  listPostFinishingWaitHandoverWarehouseMovements,
  listPostFinishingWaitHandoverWarehouseRecords,
  markPostFinishingRecheckSkuRelabeled,
  isMaterialRequiringCutting,
  isPostFinishingDedicatedMaterial,
  receivePostFinishingOutboundOrder,
  receivePostFinishingMaterialTransfer,
  registerPostFinishingFactoryReturn,
  releasePostFinishingQcTask,
  releasePostFinishingRecheckOrder,
  resetPostFinishingFullFlow,
  resolvePostFinishingReturnRegistrationSource,
  resolvePostFinishingResponsibility,
  scanPostFinishingRecheckSkuBarcode,
  sendPostFinishingFactoryReturnToQc,
  startPostFinishingPostTask,
  tracePostFinishingFullFlow,
  type PostFinishingAuthorizationInput,
  type PostFinishingFactoryReturnDelivery,
} from '../src/data/fcs/post-finishing-full-flow.ts'
import {
  POST_FINISHING_AUTHORIZATION_WINDOW_MS,
  PostFinishingAuthorizationError,
  buildPostFinishingDifferenceFingerprint,
  consumePostFinishingAuthorization,
  getPostFinishingAuthorizationDisplay,
  listPostFinishingAuthorizationConsumptions,
  listPostFinishingAuthorizedPeople,
} from '../src/data/fcs/post-finishing-authorization.ts'
import {
  issuePostFinishingDocumentNumber,
  listPostFinishingDocumentNumberRecords,
  resetPostFinishingDocumentNumbering,
} from '../src/data/fcs/post-finishing-document-numbering.ts'
import { listPostFinishingOperationLogs } from '../src/data/fcs/post-finishing-operation-log.ts'

type ErrorCode = PostFinishingFlowGateError['code'] | PostFinishingAuthorizationError['code']

const passLabel = process.env.VERIFICATION_PASS || 'manual'
let clockMs = Date.UTC(2026, 7, 31, 8, 0, 0)

function nextTime(stepMs = 1_000): number {
  clockMs += stepMs
  return clockMs
}

function authorization(authorizerId: string, differenceReason: string): PostFinishingAuthorizationInput {
  const nowMs = nextTime(POST_FINISHING_AUTHORIZATION_WINDOW_MS + 1_000)
  return {
    scanValue: getPostFinishingAuthorizationDisplay(authorizerId, nowMs).scanPayload,
    differenceReason,
    nowMs,
  }
}

function expectCode(label: string, expectedCode: ErrorCode, run: () => unknown): Error {
  try {
    run()
  } catch (error) {
    assert(error instanceof Error, `${label} 应抛出 Error`)
    const actualCode = error instanceof PostFinishingFlowGateError || error instanceof PostFinishingAuthorizationError
      ? error.code
      : undefined
    assert.equal(actualCode, expectedCode, `${label} 错误码`)
    return error
  }
  assert.fail(`${label} 应被阻断`)
}

function counts(delivery: PostFinishingFactoryReturnDelivery, returnIndex: number): Array<{ skuId: string; actualQty: number }> {
  return delivery.lines.map((line, skuIndex) => ({
    skuId: line.sku.skuId,
    actualQty:
      returnIndex === 2 ? 19
        : returnIndex === 3 ? (skuIndex === 0 ? 22 : 18)
          : returnIndex === 4 ? (skuIndex === 0 ? 21 : skuIndex === 1 ? 19 : 20)
            : 20,
  }))
}

function confirmReturn(delivery: PostFinishingFactoryReturnDelivery, returnIndex: number): PostFinishingFactoryReturnDelivery {
  const actualCounts = counts(delivery, returnIndex)
  if (returnIndex !== 3) {
    return confirmPostFinishingFactoryReturn({
      deliveryId: delivery.deliveryId,
      firstCounts: actualCounts,
      actor: POST_FINISHING_ACCEPTANCE_ACTORS.returnConfirmer,
      nowMs: nextTime(),
    })
  }

  expectCode(`第 ${returnIndex} 次回货首次逐 SKU 差异超过 5% 必须二次点数`, 'SECOND_COUNT_REQUIRED', () => {
    confirmPostFinishingFactoryReturn({
      deliveryId: delivery.deliveryId,
      firstCounts: actualCounts,
      actor: POST_FINISHING_ACCEPTANCE_ACTORS.returnConfirmer,
      nowMs: nextTime(),
    })
  })

  expectCode('回货超过 5% 且无授权不得确认', 'AUTHORIZATION_REQUIRED', () => {
    confirmPostFinishingFactoryReturn({
      deliveryId: delivery.deliveryId,
      firstCounts: actualCounts,
      secondCounts: actualCounts,
      actor: POST_FINISHING_ACCEPTANCE_ACTORS.returnConfirmer,
      nowMs: nextTime(),
    })
  })
  const expiredIssuedAt = nextTime()
  const expiredDisplay = getPostFinishingAuthorizationDisplay('AUTH-QC-001', expiredIssuedAt)
  clockMs = expiredDisplay.validUntilMs
  expectCode('回货超过 5% 使用跨窗旧授权码必须失败并留痕', 'EXPIRED', () => {
    confirmPostFinishingFactoryReturn({
      deliveryId: delivery.deliveryId,
      firstCounts: actualCounts,
      secondCounts: actualCounts,
      actor: POST_FINISHING_ACCEPTANCE_ACTORS.returnConfirmer,
      authorization: {
        scanValue: expiredDisplay.scanPayload,
        differenceReason: '验证回货旧授权码过期留痕',
        nowMs: clockMs,
      },
      nowMs: clockMs,
    })
  })
  return confirmPostFinishingFactoryReturn({
    deliveryId: delivery.deliveryId,
    firstCounts: actualCounts,
    secondCounts: actualCounts,
    actor: POST_FINISHING_ACCEPTANCE_ACTORS.returnConfirmer,
    authorization: authorization('AUTH-QC-001', '工厂回货复点后仍存在超过 5% 的逐 SKU 差异'),
    nowMs: clockMs,
  })
}

const chainEvidence: Array<Record<string, string | number | boolean>> = []

resetPostFinishingFullFlow()

assert.equal(POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.length, 3, '必须固定覆盖 3 个生产单')
assert(POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.every((order) => order.skus.length === 5), '每个生产单必须有 5 个 SKU')
assert(POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.every((order) => order.sewingTaskNo && order.defaultStagingLocation), '每个生产单必须提供车缝任务和默认暂存位置')
assert(POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.every((order) => order.skus.every((sku) => sku.plannedQty > 0 && sku.qtyUnit === '件' && sku.imageUrl)), '每个 SKU 必须提供正数计划量、件单位和真实图片')
assert.equal(listPostFinishingReturnRegistrationSources().length, 15, '必须覆盖 3×5 共 15 次回货来源')
assert.equal(getPostFinishingReturnToleranceRate(), 0.05, '回货授权阈值必须为 5%')
assert.deepEqual(POST_FINISHING_RETURN_DIFFERENCE_POLICY, { toleranceRate: 0.05, denominator: '工厂登记数量', frontlineEditable: false }, '5%规则必须只读且分母固定为工厂登记数量')
assert.equal(POST_FINISHING_AUTHORIZATION_WINDOW_MS, 30_000, '授权码刷新时间必须为 30 秒')
assert.equal(listPostFinishingAuthorizedPeople().length, 3, '只有指定的 3 名授权人员持有动态码')
expectCode('非授权人员不能生成授权码', 'NOT_AUTHORIZED_PERSON', () => getPostFinishingAuthorizationDisplay('NOT-AUTHORIZED', clockMs))

const responsibilityCases = POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.map((order) => ({
  taskType: order.sewingTaskType,
  snapshot: resolvePostFinishingResponsibility(order.sewingTaskType),
}))
assert.deepEqual(
  responsibilityCases.map((item) => [item.taskType, item.snapshot.responsibilityMode, item.snapshot.defaultProcessItems, item.snapshot.processItemsEditable]),
  [
    ['INDEPENDENT_SEWING', 'POST_FACTORY', [...POST_FINISHING_PROCESS_ITEMS], false],
    ['SEWING_TO_IRON_PACK', 'THIRD_PARTY_FACTORY', [], true],
    ['CUTTING_TO_IRON_PACK', 'THIRD_PARTY_FACTORY', [], true],
  ],
  '三种 PPIC 任务范围必须映射为已确认的后道责任、默认项目和可编辑性',
)
assert(isPostFinishingDedicatedMaterial({ materialName: '品牌吊牌', materialSpuCode: 'WLID001' }), '标题含吊牌必须进入后道辅料')
assert(isPostFinishingDedicatedMaterial({ materialName: '品牌吊粒', materialSpuCode: 'WLID002' }), '标题含吊粒必须进入后道辅料')
assert(isPostFinishingDedicatedMaterial({ materialName: '金属扣子', materialSpuCode: 'WLID003' }), '标题含扣或扣子必须进入后道辅料')
assert(isPostFinishingDedicatedMaterial({ materialName: '包装辅件', materialSpuCode: 'flbf2609001' }), 'FLBF 前缀必须忽略大小写进入后道辅料')
assert.equal(isPostFinishingDedicatedMaterial({ materialName: '印尼平车线', materialSpuCode: 'IDSZFL001' }), false, '非后道专用辅料不得误入调拨')
assert(isMaterialRequiringCutting({ materialId: 'MAT-001', bomLinkedPatternIds: ['PAT-001'], patternLinkedMaterialIds: [] }), 'BOM 正向关联纸样即必须裁剪')
assert(isMaterialRequiringCutting({ materialId: 'MAT-002', bomLinkedPatternIds: [], patternLinkedMaterialIds: ['MAT-002'] }), '纸样文件反向关联物料即必须裁剪')
assert.equal(isMaterialRequiringCutting({ materialId: 'MAT-003', bomLinkedPatternIds: [], patternLinkedMaterialIds: ['MAT-002'] }), false, '没有任何纸样关联的物料不得误判为裁片')

const transferBeforeFlow = listPostFinishingMaterialTransferOrders()
assert.equal(transferBeforeFlow.length, 1, '仅车缝生产单必须且只能形成一张后道辅料主调拨单')
assert.equal(transferBeforeFlow[0].status, '待入库', '辅料仓整单备妥后后道看到的状态必须为待入库')
assert.equal(new Set(transferBeforeFlow[0].lines.map((line) => line.materialCode)).size, transferBeforeFlow[0].lines.length, '同一物料命中多个规则时不得生成重复调拨明细')
assert.equal(listPostFinishingMaterialStocks().length, 0, '确认入库前不得提前形成后道辅料库存')
assert.equal(getPostFinishingMaterialReadiness(transferBeforeFlow[0].productionOrderNo).status, '待入库', '仅车缝加工前必须能够读取关联调拨状态')
assert.equal(getPostFinishingMaterialReadiness(POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[1].productionOrderNo).applicable, false, '车缝＋烫包不得误读主调拨单')
assert.equal(getPostFinishingMaterialReadiness(POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[2].productionOrderNo).applicable, false, '裁剪＋车缝＋烫包不得误读主调拨单')

const numberingFirst = issuePostFinishingDocumentNumber({
  kind: 'QC', productionOrderNo: 'PO-NUMBERING-CHECK', sourceObjectId: 'NUM-1', idempotencyKey: 'NUM-1', sequence: 7,
}, new Date(nextTime()))
const numberingSecond = issuePostFinishingDocumentNumber({
  kind: 'QC', productionOrderNo: 'PO-NUMBERING-CHECK', sourceObjectId: 'NUM-2', idempotencyKey: 'NUM-2', sequence: 99,
}, new Date(nextTime()))
assert.equal(numberingFirst.documentNo, 'PO-NUMBERING-CHECK-1', '质检任务序号必须从已有最大序号开始')
assert.equal(numberingSecond.documentNo, 'PO-NUMBERING-CHECK-2', '质检任务请求序号不得绕过已有最大序号递增规则')
assert.equal(issuePostFinishingDocumentNumber({
  kind: 'QC', productionOrderNo: 'PO-NUMBERING-CHECK', sourceObjectId: 'NUM-2', idempotencyKey: 'NUM-2', sequence: 100,
}, new Date(nextTime())).documentNo, numberingSecond.documentNo, '同一质检来源重复请求必须返回原任务号')
resetPostFinishingDocumentNumbering()
const numberingAfterLedgerLoss = issuePostFinishingDocumentNumber({
  kind: 'QC',
  productionOrderNo: 'PO-NUMBERING-CHECK',
  sourceObjectId: 'NUM-5',
  idempotencyKey: 'NUM-5',
  sequence: 1,
  existingDocumentNos: ['PO-NUMBERING-CHECK-1', 'PO-NUMBERING-CHECK-4', 'PO-OTHER-99', 'PO-NUMBERING-CHECK-X'],
}, new Date(nextTime()))
assert.equal(numberingAfterLedgerLoss.documentNo, 'PO-NUMBERING-CHECK-5', '编号台账丢失时仍必须从当前生产单已有质检单最大序号递增')
resetPostFinishingDocumentNumbering()

const slotStart = Math.floor(clockMs / POST_FINISHING_AUTHORIZATION_WINDOW_MS) * POST_FINISHING_AUTHORIZATION_WINDOW_MS
const beforeBoundary = getPostFinishingAuthorizationDisplay('AUTH-QC-001', slotStart + 29_999)
const afterBoundary = getPostFinishingAuthorizationDisplay('AUTH-QC-001', slotStart + 30_000)
assert.notEqual(beforeBoundary.scanPayload, afterBoundary.scanPayload, '跨 30 秒边界授权码必须刷新')
assert.equal(getPostFinishingAuthorizationDisplay('AUTH-QC-001', slotStart).remainingSeconds, 30, '时间窗开始应剩余 30 秒')
expectCode('跨 30 秒时间窗的旧授权码必须失效', 'EXPIRED', () => {
  consumePostFinishingAuthorization({
    scanValue: beforeBoundary.scanPayload,
    stage: '质检',
    businessObjectId: 'EXPIRED-AUTH-CHECK',
    businessObjectNo: 'EXPIRED-AUTH-CHECK',
    differenceFingerprint: buildPostFinishingDifferenceFingerprint({
      stage: '质检',
      businessObjectId: 'EXPIRED-AUTH-CHECK',
      quantities: [{ skuId: 'SKU-EXPIRED', expectedQty: 10, actualQty: 9 }],
      reason: '验证旧码过期',
    }),
    differenceReason: '验证旧码过期',
    operatorId: 'TEST-OPERATOR',
    operatorName: '测试操作人',
    nowMs: slotStart + 30_000,
  })
})

const firstOrder = POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[0]
const zeroScan = getPostFinishingReturnSourceScanValue(firstOrder.productionOrderNo, 1)
const zeroSource = resolvePostFinishingReturnRegistrationSource(zeroScan)
assert.equal(zeroSource.returnIndex, 1, '回货来源码必须解析精确回货序号')
expectCode('回货登记数量为 0 必须明确阻断', 'INVALID_QUANTITY', () => {
  registerPostFinishingFactoryReturn({
    productionOrderNo: firstOrder.productionOrderNo,
    returnIndex: 1,
    triggerSource: '公共PDA自助回货',
    idempotencyKey: 'ZERO-QUANTITY-GATE',
    quantities: zeroSource.productionOrder.skus.map((sku, index) => ({ skuId: sku.skuId, registeredQty: index === 0 ? 0 : 20 })),
    deliveryPersonName: '零数量校验人员',
    deliveryPersonPhone: '0800000000',
    evidenceImageUrls: ['/materials/fabric-main.jpg'],
    actor: POST_FINISHING_ACCEPTANCE_ACTORS.factoryCourier,
    nowMs: nextTime(),
  })
})
expectCode('回货登记数量为负数必须明确阻断', 'INVALID_QUANTITY', () => {
  registerPostFinishingFactoryReturn({
    productionOrderNo: firstOrder.productionOrderNo,
    returnIndex: 1,
    triggerSource: '管理端补登记',
    idempotencyKey: 'NEGATIVE-QUANTITY-GATE',
    quantities: zeroSource.productionOrder.skus.map((sku, index) => ({ skuId: sku.skuId, registeredQty: index === 0 ? -1 : 20 })),
    deliveryPersonName: '负数校验人员',
    deliveryPersonPhone: '0800000001',
    evidenceImageUrls: ['/materials/fabric-main.jpg'],
    actor: POST_FINISHING_ACCEPTANCE_ACTORS.factoryCourier,
    nowMs: nextTime(),
  })
})
expectCode('回货登记数量为小数必须明确阻断', 'INVALID_QUANTITY', () => {
  registerPostFinishingFactoryReturn({
    productionOrderNo: firstOrder.productionOrderNo,
    returnIndex: 1,
    triggerSource: '管理端补登记',
    idempotencyKey: 'DECIMAL-QUANTITY-GATE',
    quantities: zeroSource.productionOrder.skus.map((sku, index) => ({ skuId: sku.skuId, registeredQty: index === 0 ? 1.5 : 20 })),
    deliveryPersonName: '小数校验人员',
    deliveryPersonPhone: '0800000002',
    evidenceImageUrls: ['/materials/fabric-main.jpg'],
    actor: POST_FINISHING_ACCEPTANCE_ACTORS.factoryCourier,
    nowMs: nextTime(),
  })
})

const discardableReturn = registerPostFinishingFactoryReturn({
  productionOrderNo: firstOrder.productionOrderNo,
  returnIndex: 1,
  triggerSource: '公共PDA自助回货',
  idempotencyKey: 'DISCARD-PENDING-RETURN',
  quantities: firstOrder.skus.map((sku) => ({ skuId: sku.skuId, registeredQty: 20 })),
  deliveryPersonName: POST_FINISHING_ACCEPTANCE_ACTORS.factoryCourier.actorName,
  deliveryPersonPhone: '0812000099',
  evidenceImageUrls: ['/materials/fabric-main.jpg'],
  actor: POST_FINISHING_ACCEPTANCE_ACTORS.factoryCourier,
  nowMs: nextTime(),
})
const discardedReturn = discardPostFinishingFactoryReturn({
  deliveryId: discardableReturn.deliveryId,
  reason: '送货单登记错误，废弃后重新按正确批次登记',
  actor: POST_FINISHING_ACCEPTANCE_ACTORS.factoryCourier,
  nowMs: nextTime(),
})
assert.equal(discardedReturn.status, '已废弃', '未完成最终接收的回货记录必须允许废弃并保留记录')
assert.equal(discardedReturn.discardReason, '送货单登记错误，废弃后重新按正确批次登记', '废弃必须保留原因')
assert.equal(listPostFinishingWaitProcessWarehouseRecords()[0]?.status, '已废弃', '废弃回货不得继续停留在待确认仓')
assert.equal(listPostFinishingFullFlowQcTasks().length, 0, '废弃回货不得生成质检单')
expectCode('已废弃回货不得继续确认', 'INVALID_STATUS', () => {
  confirmPostFinishingFactoryReturn({
    deliveryId: discardedReturn.deliveryId,
    firstCounts: discardedReturn.lines.map((line) => ({ skuId: line.sku.skuId, actualQty: line.registeredQty })),
    actor: POST_FINISHING_ACCEPTANCE_ACTORS.returnConfirmer,
    nowMs: nextTime(),
  })
})
resetPostFinishingFullFlow()

for (const order of POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS) {
  for (let returnIndex = 1; returnIndex <= 5; returnIndex += 1) {
    const scanValue = getPostFinishingReturnSourceScanValue(order.productionOrderNo, returnIndex)
    const source = resolvePostFinishingReturnRegistrationSource(scanValue)
    assert.equal(source.productionOrder.productionOrderNo, order.productionOrderNo, '来源码必须保持具体生产单身份')
    assert.equal(source.productionOrder.skus.length, 5, '每次回货必须完整显示 5 个 SKU')

    const idempotencyKey = `ACCEPT:${order.productionOrderNo}:${returnIndex}`
    const registered = registerPostFinishingFactoryReturn({
      productionOrderNo: order.productionOrderNo,
      returnIndex,
      triggerSource: returnIndex % 3 === 1 ? '公共PDA自助回货' : returnIndex % 3 === 2 ? '车缝正常交出' : '管理端补登记',
      idempotencyKey,
      quantities: order.skus.map((sku) => ({ skuId: sku.skuId, registeredQty: 20 })),
      deliveryPersonName: POST_FINISHING_ACCEPTANCE_ACTORS.factoryCourier.actorName,
      deliveryPersonPhone: `0812${order.productionOrderId.slice(-1)}${returnIndex}00000`,
      evidenceImageUrls: ['/materials/fabric-main.jpg'],
      actor: POST_FINISHING_ACCEPTANCE_ACTORS.factoryCourier,
      nowMs: nextTime(),
    })
    const duplicate = registerPostFinishingFactoryReturn({
      productionOrderNo: order.productionOrderNo,
      returnIndex,
      triggerSource: '公共PDA自助回货',
      idempotencyKey,
      quantities: order.skus.map((sku) => ({ skuId: sku.skuId, registeredQty: 20 })),
      deliveryPersonName: POST_FINISHING_ACCEPTANCE_ACTORS.factoryCourier.actorName,
      deliveryPersonPhone: '0812000000',
      evidenceImageUrls: ['/materials/fabric-main.jpg'],
      actor: POST_FINISHING_ACCEPTANCE_ACTORS.factoryCourier,
      nowMs: nextTime(),
    })
    assert.equal(duplicate.deliveryOrderNo, registered.deliveryOrderNo, '重复回货提交必须返回原送货单号')

    if (order === firstOrder && returnIndex === 1) {
      expectCode('未确认回货不得送检', 'INVALID_STATUS', () => {
        sendPostFinishingFactoryReturnToQc({
          deliveryId: registered.deliveryId,
          actor: POST_FINISHING_ACCEPTANCE_ACTORS.sender,
          nowMs: nextTime(),
        })
      })
    }

    const qcTaskCountBeforeConfirmation = listPostFinishingFullFlowQcTasks().length
    const confirmed = confirmReturn(registered, returnIndex)
    assert.equal(confirmed.status, '已确认待送检', '回货确认后应待送检')
    assert(confirmed.lines.every((line) => Number.isInteger(line.confirmedQty) && (line.confirmedQty || 0) >= 0), '最终确认数量必须逐 SKU 保存')
    const qcTasksAfterConfirmation = listPostFinishingFullFlowQcTasks()
    assert.equal(qcTasksAfterConfirmation.length, qcTaskCountBeforeConfirmation + 1, '每次回货最终确认时必须立即自动生成且只生成一张质检单')
    const autoCreatedQcTask = qcTasksAfterConfirmation.find((task) => task.deliveryId === confirmed.deliveryId)
    assert(autoCreatedQcTask, '回货确认结果必须立即关联自动生成的质检单')
    assert.equal(confirmed.qcTaskId, autoCreatedQcTask.qcTaskId, '送货单必须在回货确认时写入质检单主键')
    assert.equal(confirmed.qcTaskNo, autoCreatedQcTask.qcTaskNo, '送货单必须在回货确认时写入质检单号')
    assert.equal(autoCreatedQcTask.qcTaskNo, `${order.productionOrderNo}-${returnIndex}`, '确认时生成的质检单号必须为生产单号-最大序号加一')
    assert.equal(autoCreatedQcTask.status, '待送检', '确认时生成的质检单必须等待后道待加工仓完成送检交接')
    if (returnIndex === 1 && order === firstOrder) {
      expectCode('尚未从后道待加工仓送检的质检单不得领取', 'INVALID_STATUS', () => {
        claimPostFinishingQcTask({ qcTaskNo: autoCreatedQcTask.qcTaskNo, actor: POST_FINISHING_ACCEPTANCE_ACTORS.qcA, nowMs: nextTime() })
      })
    }
    if (returnIndex === 2 || returnIndex === 4) {
      assert.equal(confirmed.returnAuthorizationId, undefined, '±5% 边界不得要求授权')
    }

    const qcTask = sendPostFinishingFactoryReturnToQc({
      deliveryId: confirmed.deliveryId,
      actor: POST_FINISHING_ACCEPTANCE_ACTORS.sender,
      nowMs: nextTime(),
    })
    assert.equal(listPostFinishingFullFlowQcTasks().length, qcTasksAfterConfirmation.length, '待加工仓送检只改变交接状态，不得再次创建质检单')
    assert.equal(qcTask.qcTaskId, autoCreatedQcTask.qcTaskId, '送检必须沿用回货确认时自动生成的同一质检单')
    assert.equal(qcTask.qcTaskNo, autoCreatedQcTask.qcTaskNo, '送检不得重编或替换质检单号')
    assert.equal(qcTask.status, '待质检', '完成送检交接后质检单才进入待质检')
    assert.equal(qcTask.responsibility.sewingTaskType, order.sewingTaskType, '每次回货生成的质检单必须继承该生产单的任务范围快照')
    assert.equal(qcTask.responsibility.source, 'PPIC任务分配', '质检责任快照必须保留 PPIC 来源')
    assert.equal(qcTask.responsibility.frozenAt, registered.registeredAt, '质检责任必须冻结在本次回货登记时间，不随上游后续变化')
    const duplicateQcTask = sendPostFinishingFactoryReturnToQc({
      deliveryId: confirmed.deliveryId,
      actor: POST_FINISHING_ACCEPTANCE_ACTORS.sender,
      nowMs: nextTime(),
    })
    assert.equal(duplicateQcTask.qcTaskId, qcTask.qcTaskId, '一张送货单只能生成一张质检任务')
    assert.equal(qcTask.qcTaskNo, `${order.productionOrderNo}-${returnIndex}`, '质检任务号必须为生产单号-序号')
    assert.deepEqual(qcTask.lines.map((line) => line.expectedQty), confirmed.lines.map((line) => line.confirmedQty), '送检数必须取确认入库数')

    expectCode('质检任务必须精确匹配完整任务号', 'NOT_FOUND', () => {
      claimPostFinishingQcTask({ qcTaskNo: qcTask.qcTaskNo.slice(0, -1), actor: POST_FINISHING_ACCEPTANCE_ACTORS.qcA, nowMs: nextTime() })
    })
    expectCode('非 QC 账号不得领取质检任务', 'NOT_CLAIM_OWNER', () => {
      claimPostFinishingQcTask({ qcTaskNo: qcTask.qcTaskNo, actor: POST_FINISHING_ACCEPTANCE_ACTORS.factoryCourier, nowMs: nextTime() })
    })

    let qcActor = POST_FINISHING_ACCEPTANCE_ACTORS.qcA
    claimPostFinishingQcTask({ qcTaskNo: qcTask.qcTaskNo, actor: qcActor, nowMs: nextTime() })
    if (returnIndex === 4) {
      expectCode('他人扫描已领取质检任务必须提示占用', 'CLAIM_CONFLICT', () => {
        claimPostFinishingQcTask({ qcTaskNo: qcTask.qcTaskNo, actor: POST_FINISHING_ACCEPTANCE_ACTORS.qcB, nowMs: nextTime() })
      })
      const released = releasePostFinishingQcTask({
        qcTaskId: qcTask.qcTaskId,
        actor: qcActor,
        reason: '错误领取',
        nowMs: nextTime(),
      })
      assert.equal(released.status, '待质检', '退领后必须回到待质检')
      qcActor = POST_FINISHING_ACCEPTANCE_ACTORS.qcB
      claimPostFinishingQcTask({ qcTaskNo: qcTask.qcTaskNo, actor: qcActor, nowMs: nextTime() })
    }

    const qcResults = qcTask.lines.map((line, skuIndex) => {
      if (returnIndex === 3 && skuIndex === 0) return { skuId: line.sku.skuId, passedQty: line.expectedQty - 1, defectQty: 0, returnQty: 0 }
      if (returnIndex === 3 && skuIndex === 1) return { skuId: line.sku.skuId, passedQty: line.expectedQty + 1, defectQty: 0, returnQty: 0 }
      if (returnIndex === 4 && skuIndex === 0) return { skuId: line.sku.skuId, passedQty: line.expectedQty - 1, defectQty: 1, returnQty: 0, defectReasonQuantities: [{ reason: '脏污', quantity: 1 }] }
      if (returnIndex === 5 && skuIndex === 0) return { skuId: line.sku.skuId, passedQty: line.expectedQty - 2, defectQty: 1, returnQty: 1, defectReasonQuantities: [{ reason: '色差', quantity: 1 }], returnReason: '质检返工', returnReceiver: order.sewingFactoryName }
      return { skuId: line.sku.skuId, passedQty: line.expectedQty, defectQty: 0, returnQty: 0 }
    })
    const selectedProcessItems = order.sewingTaskType === 'INDEPENDENT_SEWING'
      ? []
      : order.sewingTaskType === 'CUTTING_TO_IRON_PACK'
        ? ['熨烫和包装']
        : []
    const expectedProcessItems = order.sewingTaskType === 'INDEPENDENT_SEWING'
      ? [...POST_FINISHING_PROCESS_ITEMS]
      : selectedProcessItems
    const needPostFinishing = expectedProcessItems.length > 0
    let qcAuthorization: PostFinishingAuthorizationInput | undefined
    if (returnIndex === 3) {
      expectCode('质检逐 SKU 差异即使整单抵消也必须授权', 'AUTHORIZATION_REQUIRED', () => {
        completePostFinishingQcTask({ qcTaskId: qcTask.qcTaskId, actor: qcActor, results: qcResults, needPostFinishing, processItems: selectedProcessItems, nowMs: nextTime() })
      })
      const reusedReturnAuthorization = listPostFinishingAuthorizationConsumptions().find((item) => item.businessObjectId === confirmed.deliveryId)
      assert(reusedReturnAuthorization, '回货超阈值应有授权消费记录')
      const priorDisplay = getPostFinishingAuthorizationDisplay(reusedReturnAuthorization.authorizerId, new Date(reusedReturnAuthorization.consumedAt).getTime())
      expectCode('已消费授权码不得在质检环节复用', 'ALREADY_USED', () => {
        completePostFinishingQcTask({
          qcTaskId: qcTask.qcTaskId,
          actor: qcActor,
          results: qcResults,
          needPostFinishing,
          processItems: selectedProcessItems,
          authorization: { scanValue: priorDisplay.scanPayload, differenceReason: '尝试复用回货授权码', nowMs: new Date(reusedReturnAuthorization.consumedAt).getTime() },
          nowMs: new Date(reusedReturnAuthorization.consumedAt).getTime(),
        })
      })
      qcAuthorization = authorization('AUTH-QC-001', '质检逐 SKU 一多一少，整单总量相等仍授权')
    }
    const completedQc = completePostFinishingQcTask({
      qcTaskId: qcTask.qcTaskId,
      actor: qcActor,
      results: qcResults,
      needPostFinishing,
      processItems: selectedProcessItems,
      authorization: qcAuthorization,
      nowMs: qcAuthorization?.nowMs || nextTime(),
    })
    assert.equal(completedQc.status, '质检完成', '质检完成状态')
    assert.deepEqual(completedQc.frozenProcessItems, expectedProcessItems, '质检完成时必须按任务责任冻结最终后道项目')
    assert.deepEqual(completedQc.results?.map((line) => [line.passedQty, line.defectQty, line.returnQty]), qcResults.map((line) => [line.passedQty, line.defectQty, line.returnQty]), '授权后必须保存真实分类数量，不得自动补数')
    assert(completedQc.results?.every((line) => line.defectQty === (line.defectReasonQuantities || []).reduce((sum, item) => sum + item.quantity, 0)), '质检瑕疵数量必须始终等于各瑕疵原因数量之和')
    const postCountAfterQc = listPostFinishingFullFlowPostTasks().length
    const recheckCountAfterQc = listPostFinishingFullFlowRecheckOrders().length
    const repeatedQc = completePostFinishingQcTask({
      qcTaskId: qcTask.qcTaskId,
      actor: qcActor,
      results: qcResults,
      needPostFinishing: !needPostFinishing,
      nowMs: nextTime(),
    })
    assert.equal(repeatedQc.needPostFinishing, needPostFinishing, '质检完成后重复提交必须保持原责任分支')
    assert.deepEqual(repeatedQc.frozenProcessItems, expectedProcessItems, '质检完成后重复提交不得改变冻结的后道项目')
    assert.equal(listPostFinishingFullFlowPostTasks().length, postCountAfterQc, '重复质检不得生成第二张后道加工单')
    assert.equal(listPostFinishingFullFlowRecheckOrders().length, recheckCountAfterQc, '重复质检不得生成第二条复检分支')
    let recheckNo = completedQc.recheckOrderNo
    if (needPostFinishing) {
      assert(completedQc.postTaskNo, '选择需要后道时必须生成后道加工单')
      const startedPost = startPostFinishingPostTask({
        postTaskNo: completedQc.postTaskNo!,
        actor: POST_FINISHING_ACCEPTANCE_ACTORS.postOperator,
        nowMs: nextTime(),
      })
      expectCode('后道加工单只接受完整单号', 'NOT_FOUND', () => {
        startPostFinishingPostTask({ postTaskNo: completedQc.postTaskNo!.slice(0, -1), actor: POST_FINISHING_ACCEPTANCE_ACTORS.postOperator, nowMs: nextTime() })
      })
      if (returnIndex === 4) {
        expectCode('后道加工单已开始后其他账号不得接管', 'CLAIM_CONFLICT', () => {
          startPostFinishingPostTask({ postTaskNo: completedQc.postTaskNo!, actor: POST_FINISHING_ACCEPTANCE_ACTORS.recheckerA, nowMs: nextTime() })
        })
      }
      assert.deepEqual(startedPost.lines.map((line) => line.expectedQty), completedQc.results?.map((line) => line.passedQty), '只有质检合格数量进入后道')
      const postReturnReceiver = listPostFinishingPostReturnReceiverOptions(startedPost.postTaskId)[0].value
      const postResults = startedPost.lines.map((line, skuIndex) => {
        if (returnIndex === 3 && skuIndex === 0) return { skuId: line.sku.skuId, passedQty: line.expectedQty - 1, defectQty: 0, returnQty: 0 }
        if (returnIndex === 5 && skuIndex === 0) return { skuId: line.sku.skuId, passedQty: line.expectedQty - 2, defectQty: 1, returnQty: 1, defectReasonQuantities: [{ reason: '压痕', quantity: 1 }], returnReason: '返后道返修', returnReceiver: postReturnReceiver }
        return { skuId: line.sku.skuId, passedQty: line.expectedQty, defectQty: 0, returnQty: 0 }
      })
      let postAuthorization: PostFinishingAuthorizationInput | undefined
      if (returnIndex === 3) {
        const stageBalancedResults = startedPost.lines.map((line) => ({
          skuId: line.sku.skuId,
          passedQty: line.expectedQty,
          defectQty: 0,
          returnQty: 0,
        }))
        expectCode('后道本环节守恒但继承的全链逐 SKU 不守恒仍必须授权', 'AUTHORIZATION_REQUIRED', () => {
          completePostFinishingPostTask({ postTaskId: startedPost.postTaskId, actor: POST_FINISHING_ACCEPTANCE_ACTORS.postOperator, results: stageBalancedResults, nowMs: nextTime() })
        })
        expectCode('后道一件差异必须授权', 'AUTHORIZATION_REQUIRED', () => {
          completePostFinishingPostTask({ postTaskId: startedPost.postTaskId, actor: POST_FINISHING_ACCEPTANCE_ACTORS.postOperator, results: postResults, nowMs: nextTime() })
        })
        postAuthorization = authorization('AUTH-POST-001', '后道逐 SKU 少一件，完成数量差异必须授权')
      }
      const completedPost = completePostFinishingPostTask({
        postTaskId: startedPost.postTaskId,
        actor: POST_FINISHING_ACCEPTANCE_ACTORS.postOperator,
        results: postResults,
        authorization: postAuthorization,
        nowMs: postAuthorization?.nowMs || nextTime(),
      })
      assert.equal(completedPost.status, '后道完成', '后道完成状态')
      assert.equal(getPostFinishingFactoryReturn(registered.deliveryId)?.status, '已送检', '后道加工不得提前写入库存或完成收货状态')
      recheckNo = completedPost.recheckOrderNo
    } else {
      assert.equal(completedQc.postTaskNo, undefined, '三方工厂已承接烫包且未发现漏做时不得生成后道加工单')
      assert(completedQc.recheckOrderNo, '三方工厂已承接烫包且未发现漏做时必须直接生成复检单')
    }

    assert(recheckNo, '每条链必须生成复检单')
    let recheckActor = POST_FINISHING_ACCEPTANCE_ACTORS.recheckerA
    let recheck = claimPostFinishingRecheckOrder({ recheckOrderNo: recheckNo!, actor: recheckActor, nowMs: nextTime() })
    expectCode('复检单必须精确匹配完整单号', 'NOT_FOUND', () => {
      claimPostFinishingRecheckOrder({ recheckOrderNo: recheckNo!.slice(0, -1), actor: recheckActor, nowMs: nextTime() })
    })
    if (returnIndex === 5) {
      expectCode('他人扫描已领取复检单必须阻断', 'CLAIM_CONFLICT', () => {
        claimPostFinishingRecheckOrder({ recheckOrderNo: recheckNo!, actor: POST_FINISHING_ACCEPTANCE_ACTORS.recheckerB, nowMs: nextTime() })
      })
      recheck = releasePostFinishingRecheckOrder({ recheckOrderId: recheck.recheckOrderId, actor: recheckActor, reason: '错误领取', nowMs: nextTime() })
      assert.equal(recheck.status, '待复检', '复检退领后必须回到待复检')
      recheckActor = POST_FINISHING_ACCEPTANCE_ACTORS.recheckerB
      recheck = claimPostFinishingRecheckOrder({ recheckOrderNo: recheckNo!, actor: recheckActor, nowMs: nextTime() })
    }

    let barcodeGateAuthorization: PostFinishingAuthorizationInput | undefined
    for (let skuIndex = 0; skuIndex < recheck.lines.length; skuIndex += 1) {
      const line = recheck.lines[skuIndex]
      if (returnIndex === 4 && skuIndex === 0) {
        scanPostFinishingRecheckSkuBarcode({ recheckOrderId: recheck.recheckOrderId, skuId: line.sku.skuId, scannedBarcode: 'WRONG-SKU-BARCODE', actor: recheckActor, nowMs: nextTime() })
        barcodeGateAuthorization = authorization('AUTH-QC-001', '复检数量差异授权不能绕过条码错误')
      } else {
        scanPostFinishingRecheckSkuBarcode({ recheckOrderId: recheck.recheckOrderId, skuId: line.sku.skuId, scannedBarcode: line.sku.barcode, actor: recheckActor, nowMs: nextTime() })
      }
    }
    const recheckResults = recheck.lines.map((line, skuIndex) => {
      if (returnIndex === 4 && skuIndex === 0) return { skuId: line.sku.skuId, passedQty: line.expectedQty - 1, defectQty: 0 }
      if (returnIndex === 4 && skuIndex === 1) return { skuId: line.sku.skuId, passedQty: line.expectedQty + 1, defectQty: 0 }
      return { skuId: line.sku.skuId, passedQty: line.expectedQty, defectQty: 0 }
    })
    if (returnIndex === 4) {
      expectCode('条码错误时数量授权也不能出货', 'BARCODE_BLOCKED', () => {
        completePostFinishingRecheckOrderFullFlow({ recheckOrderId: recheck.recheckOrderId, actor: recheckActor, results: recheckResults, authorization: barcodeGateAuthorization, nowMs: barcodeGateAuthorization!.nowMs })
      })
      markPostFinishingRecheckSkuRelabeled({ recheckOrderId: recheck.recheckOrderId, skuId: recheck.lines[0].sku.skuId, actor: recheckActor, nowMs: nextTime() })
      expectCode('重贴后未复扫仍必须阻断出货', 'BARCODE_BLOCKED', () => {
        completePostFinishingRecheckOrderFullFlow({ recheckOrderId: recheck.recheckOrderId, actor: recheckActor, results: recheckResults, authorization: barcodeGateAuthorization, nowMs: barcodeGateAuthorization!.nowMs })
      })
      scanPostFinishingRecheckSkuBarcode({ recheckOrderId: recheck.recheckOrderId, skuId: recheck.lines[0].sku.skuId, scannedBarcode: recheck.lines[0].sku.barcode, actor: recheckActor, nowMs: barcodeGateAuthorization!.nowMs })
    }
    const completedRecheck = completePostFinishingRecheckOrderFullFlow({
      recheckOrderId: recheck.recheckOrderId,
      actor: recheckActor,
      results: recheckResults,
      authorization: returnIndex === 4 ? barcodeGateAuthorization : undefined,
      nowMs: returnIndex === 4 ? barcodeGateAuthorization!.nowMs : nextTime(),
    })
    assert.equal(completedRecheck.status, '复检完成', '复检完成状态')
    assert(completedRecheck.outboundOrderNo?.startsWith('FCK-'), '复检完成必须生成 FCK 后道出货单')
    const outboundCountBeforeRepeat = listPostFinishingFullFlowOutboundOrders().length
    const repeatedRecheck = completePostFinishingRecheckOrderFullFlow({ recheckOrderId: recheck.recheckOrderId, actor: recheckActor, results: recheckResults, nowMs: nextTime() })
    assert.equal(repeatedRecheck.outboundOrderNo, completedRecheck.outboundOrderNo, '重复完成复检必须返回同一出货单')
    assert.equal(listPostFinishingFullFlowOutboundOrders().length, outboundCountBeforeRepeat, '一张复检单不得生成第二张出货单')

    const outbound = listPostFinishingFullFlowOutboundOrders().find((item) => item.outboundOrderNo === completedRecheck.outboundOrderNo)!
    assert.deepEqual(outbound.lines.map((line) => line.outboundQty), recheckResults.map((line) => line.passedQty), '出货数量必须逐 SKU 等于复检合格数量')
    const readyWarehouseRecord = listPostFinishingWaitHandoverWarehouseRecords().find((item) => item.outboundOrderId === outbound.outboundOrderId)
    assert(readyWarehouseRecord, '复检完成必须先形成后道待交出仓记录')
    assert.equal(readyWarehouseRecord.status, '待交出', '仓库收货前必须为待交出')
    assert.deepEqual(readyWarehouseRecord.lines.map((line) => line.availableQty), outbound.lines.map((line) => line.outboundQty), '待交出仓可用量必须逐 SKU 等于复检合格出货量')
    expectCode('仓库不能用内部交接号或复检单号代替 FCK 出货单', 'NOT_FOUND', () => {
      receivePostFinishingOutboundOrder({ outboundOrderNo: completedRecheck.recheckOrderNo, actor: POST_FINISHING_ACCEPTANCE_ACTORS.warehouseReceiver, receivedQuantities: outbound.lines.map((line) => ({ skuId: line.sku.skuId, receivedQty: line.outboundQty })), nowMs: nextTime() })
    })
    const receivedQuantities = outbound.lines.map((line, skuIndex) => ({
      skuId: line.sku.skuId,
      receivedQty: returnIndex === 5 && skuIndex === 0 ? Math.max(0, line.outboundQty - 1) : returnIndex === 5 && skuIndex === 1 ? line.outboundQty + 1 : line.outboundQty,
    }))
    let warehouseAuthorization: PostFinishingAuthorizationInput | undefined
    if (returnIndex === 5) {
      expectCode('仓库逐 SKU 差异即使整单抵消也必须授权', 'AUTHORIZATION_REQUIRED', () => {
        receivePostFinishingOutboundOrder({ outboundOrderNo: outbound.outboundOrderNo, actor: POST_FINISHING_ACCEPTANCE_ACTORS.warehouseReceiver, receivedQuantities, nowMs: nextTime() })
      })
      assert.equal(listPostFinishingWarehouseReceipts().some((item) => item.outboundOrderId === outbound.outboundOrderId), false, '授权前不得写入收货记录')
      warehouseAuthorization = authorization('AUTH-WH-001', '仓库逐 SKU 实收一多一少，整单总量相等仍授权')
    }
    const received = receivePostFinishingOutboundOrder({
      outboundOrderNo: outbound.outboundOrderNo,
      actor: POST_FINISHING_ACCEPTANCE_ACTORS.warehouseReceiver,
      receivedQuantities,
      authorization: warehouseAuthorization,
      nowMs: warehouseAuthorization?.nowMs || nextTime(),
    })
    assert.equal(received.alreadyReceived, false, '首次收货必须写入')
    assert.deepEqual(received.receipt.lines.map((line) => line.receivedQty), receivedQuantities.map((line) => line.receivedQty), '授权后必须按真实逐 SKU 实收数量入库')
    const handedWarehouseRecord = listPostFinishingWaitHandoverWarehouseRecords().find((item) => item.outboundOrderId === outbound.outboundOrderId)
    assert.equal(handedWarehouseRecord?.status, '已交出', '仓库确认收货后待交出仓必须完成交出')
    assert(handedWarehouseRecord?.lines.every((line) => line.availableQty === 0 && line.handedOverQty === line.inboundQty), '待交出仓按应出数量扣减，实收差异不得反改库存')
    const repeatedReceipt = receivePostFinishingOutboundOrder({
      outboundOrderNo: outbound.outboundOrderNo,
      actor: POST_FINISHING_ACCEPTANCE_ACTORS.warehouseReceiver,
      receivedQuantities,
      nowMs: nextTime(),
    })
    assert.equal(repeatedReceipt.alreadyReceived, true, '重复扫描已接收出货单只能只读返回原记录')
    assert.equal(repeatedReceipt.receipt.receiptId, received.receipt.receiptId, '重复扫描不得生成第二条入库记录')

    for (const number of [registered.deliveryOrderNo, qcTask.qcTaskNo, completedQc.postTaskNo, recheckNo, outbound.outboundOrderNo].filter(Boolean) as string[]) {
      const trace = tracePostFinishingFullFlow(number)
      assert.equal(trace.delivery?.deliveryId, registered.deliveryId, `从 ${number} 必须回溯到具体送货单`)
      assert.equal(trace.qcTask?.qcTaskId, qcTask.qcTaskId, `从 ${number} 必须回溯到质检任务`)
      assert.equal(trace.recheckOrder?.recheckOrderNo, recheckNo, `从 ${number} 必须回溯到复检单`)
      assert.equal(trace.outboundOrder?.outboundOrderNo, outbound.outboundOrderNo, `从 ${number} 必须回溯到出货单`)
      assert.equal(trace.waitHandoverRecord?.warehouseRecordId, handedWarehouseRecord?.warehouseRecordId, `从 ${number} 必须回溯到待交出仓记录`)
    }

    chainEvidence.push({
      productionOrderNo: order.productionOrderNo,
      returnIndex,
      skuCount: order.skus.length,
      deliveryOrderNo: registered.deliveryOrderNo,
      qcTaskNo: qcTask.qcTaskNo,
      branch: needPostFinishing ? '质检-后道-复检' : '质检-直接复检',
      recheckOrderNo: recheckNo!,
      outboundOrderNo: outbound.outboundOrderNo,
      waitHandoverStatus: handedWarehouseRecord?.status || '',
      warehouseReceived: true,
    })
  }
}

assert.equal(chainEvidence.length, 15, '验收结果必须包含 15 条独立回货全链')
assert.equal(listPostFinishingFactoryReturns().length, 15, '必须产生 15 张独立送货单')
assert.equal(listPostFinishingFullFlowQcTasks().length, 15, '必须产生 15 个独立质检任务')
assert.equal(listPostFinishingFullFlowPostTasks().length, 10, '仅车缝 5 次和裁剪＋车缝＋烫包漏做补加工 5 次应生成 10 张后道加工单')
assert.equal(listPostFinishingFullFlowRecheckOrders().length, 15, '必须产生 15 张独立复检单')
assert.equal(listPostFinishingFullFlowOutboundOrders().length, 15, '必须产生且仅产生 15 张出货单')
assert.equal(listPostFinishingWarehouseReceipts().length, 15, '必须产生且仅产生 15 条仓库收货记录')
assert.equal(listPostFinishingWaitProcessWarehouseRecords().length, 15, '每次回货必须形成 1 条后道待加工仓记录')
assert.equal(listPostFinishingWaitProcessWarehouseMovements().filter((item) => item.movementType === '确认入库').length, 15, '每次 Web/PDA 回货确认必须形成 1 条确认入库流水')
assert.equal(listPostFinishingWaitProcessWarehouseMovements().filter((item) => item.movementType === '送检出库').length, 15, '每次送检必须形成 1 条送检出库流水')
assert(listPostFinishingWaitProcessWarehouseRecords().every((item) => item.status === '已送检' && item.lines.every((line) => line.availableQty === 0)), '全流程结束后待加工仓记录必须显示已送检且可用数量归零')
assert.equal(listPostFinishingWaitHandoverWarehouseRecords().length, 15, '每次复检完成必须形成 1 条后道待交出仓记录')
assert.equal(listPostFinishingWaitHandoverWarehouseMovements().filter((item) => item.movementType === '复检完成入仓').length, 15, '每次复检完成必须形成 1 条待交出仓入仓流水')
assert.equal(listPostFinishingWaitHandoverWarehouseMovements().filter((item) => item.movementType === '后道出货交出').length, 15, '每次仓库确认收货必须形成 1 条待交出仓交出流水')
assert(listPostFinishingWaitHandoverWarehouseRecords().every((item) => item.status === '已交出' && item.lines.every((line) => line.availableQty === 0)), '全流程结束后待交出仓记录必须显示已交出且可用数量归零')
assert.equal(new Set(listPostFinishingFullFlowQcTasks().map((item) => item.qcTaskNo)).size, 15, '质检任务号不得重复')
for (const order of POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS) {
  const orderQcNumbers = listPostFinishingFullFlowQcTasks()
    .filter((item) => item.productionOrderNo === order.productionOrderNo)
    .sort((a, b) => a.returnIndex - b.returnIndex)
    .map((item) => item.qcTaskNo)
  assert.deepEqual(orderQcNumbers, [1, 2, 3, 4, 5].map((sequence) => `${order.productionOrderNo}-${sequence}`), `${order.productionOrderNo} 的 5 次回货必须严格生成生产单号-1 至生产单号-5`)
}
assert.equal(new Set(listPostFinishingFullFlowRecheckOrders().map((item) => item.recheckOrderNo)).size, 15, '复检单号不得重复')
assert.equal(new Set(listPostFinishingFullFlowOutboundOrders().map((item) => item.outboundOrderNo)).size, 15, '出货单号不得重复')

const authorizationCountBeforeMaterialInbound = listPostFinishingAuthorizationConsumptions().length
const materialTransfer = listPostFinishingMaterialTransferOrders()[0]
expectCode('辅料调拨必须精确匹配完整单号', 'NOT_FOUND', () => {
  receivePostFinishingMaterialTransfer({
    transferOrderNo: materialTransfer.transferOrderNo.slice(0, -1),
    actor: POST_FINISHING_ACCEPTANCE_ACTORS.warehouseReceiver,
    nowMs: nextTime(),
  })
})
const firstMaterialInbound = receivePostFinishingMaterialTransfer({
  transferOrderNo: materialTransfer.transferOrderNo,
  actor: POST_FINISHING_ACCEPTANCE_ACTORS.warehouseReceiver,
  nowMs: nextTime(),
})
assert.equal(firstMaterialInbound.alreadyInbound, false, '待入库辅料调拨单必须整单一次确认入库')
assert.equal(firstMaterialInbound.transfer.status, '已入库', '整单确认后调拨状态必须变为已入库')
const materialStocks = listPostFinishingMaterialStocks()
assert.equal(materialStocks.length, materialTransfer.lines.length, '整单入库必须为每条调拨明细形成且只形成一条辅料库存')
assert(materialStocks.every((stock) => stock.currentQty === stock.material.preparedQty && stock.inboundQty === stock.material.preparedQty), '辅料应收和入库数量必须以调出方实际配料数量为准')
assert(materialStocks.every((stock) => stock.material.unit && stock.areaName === '后道辅料暂存区'), '辅料库存必须保留各自单位并进入后道待加工仓辅料区')
const repeatedMaterialInbound = receivePostFinishingMaterialTransfer({
  transferOrderNo: materialTransfer.transferOrderNo,
  actor: POST_FINISHING_ACCEPTANCE_ACTORS.warehouseReceiver,
  nowMs: nextTime(),
})
assert.equal(repeatedMaterialInbound.alreadyInbound, true, '重复确认已入库调拨单必须幂等返回原单')
assert.equal(listPostFinishingMaterialStocks().length, materialStocks.length, '重复确认不得重复增加辅料库存')
assert.equal(listPostFinishingAuthorizationConsumptions().length, authorizationCountBeforeMaterialInbound, '辅料整单入库不得调用成衣差异授权')

const defects = listPostFinishingDefectRecords()
assert(defects.some((item) => item.discoveryStage === '质检'), '统一瑕疵记录必须包含质检阶段')
assert(defects.some((item) => item.discoveryStage === '后道'), '统一瑕疵记录必须包含后道阶段')
assert(defects.every((item) => item.defectReason && item.recordedBy.actorName), '两阶段瑕疵必须共用逐原因数量与记录人结构')
assert(defects.every((item) => item.dispositionStatus === '待处理'), '质检和后道瑕疵必须共用后续处理状态')
assert(defects.filter((item) => item.discoveryStage === '质检').every((item) => !item.evidenceImageUrl && !item.responsibleParty), '质检阶段不得再要求或写入瑕疵证据图片与责任方')
assert(defects.filter((item) => item.discoveryStage === '后道').every((item) => !item.evidenceImageUrl && !item.responsibleParty), '后道调整不得再要求或写入责任方与现场证据图片')
const firstQcDefect = defects.find((item) => item.discoveryStage === '质检')!
const firstPostDefect = defects.find((item) => item.discoveryStage === '后道')!
assert.notEqual(firstQcDefect.defectId, firstPostDefect.defectId, '后道瑕疵必须追加新记录，不得覆盖质检瑕疵')
assert(defects.some((item) => item.defectReason === '色差') && defects.some((item) => item.defectReason === '压痕'), '两阶段必须使用统一瑕疵术语与原因结构')

const firstConsumption = listPostFinishingAuthorizationConsumptions()[0]!
const changedFingerprint = buildPostFinishingDifferenceFingerprint({
  stage: firstConsumption.stage,
  businessObjectId: firstConsumption.businessObjectId,
  quantities: [{ skuId: 'CHANGED-SKU', expectedQty: 20, actualQty: 18 }],
  reason: '提交前修改了数量和原因',
})
assert.notEqual(changedFingerprint, firstConsumption.differenceFingerprint, '数量或原因变化后必须形成新的差异指纹')
expectCode('已绑定旧差异的授权码不得用于修改后的数量或原因', 'ALREADY_USED', () => {
  const consumedAtMs = new Date(firstConsumption.consumedAt).getTime()
  consumePostFinishingAuthorization({
    scanValue: getPostFinishingAuthorizationDisplay(firstConsumption.authorizerId, consumedAtMs).scanPayload,
    stage: firstConsumption.stage,
    businessObjectId: firstConsumption.businessObjectId,
    businessObjectNo: firstConsumption.businessObjectNo,
    differenceFingerprint: changedFingerprint,
    differenceReason: '提交前修改了数量和原因',
    operatorId: 'CHANGED-OPERATOR',
    operatorName: '修改后的操作人',
    nowMs: consumedAtMs,
  })
})
assert(listPostFinishingAuthorizationConsumptions().every((item) => item.authorizerName && item.operatorName), '每次授权必须同时记录授权人与现场操作人')

const logs = listPostFinishingOperationLogs()
assert(logs.some((item) => item.result === '阻断' && item.action.includes('领取冲突')), '操作日志必须保存完整单号领取冲突')
assert(logs.some((item) => item.action === '第一次点数') && logs.some((item) => item.action === '第二次点数') && logs.some((item) => item.action === '最终确认回货'), '回货两次点数和最终确认必须分别留痕')
assert(logs.some((item) => item.action === '重新贴码'), '操作日志必须保存重新贴码动作')
assert(logs.some((item) => item.action === '差异授权' && item.authorizerName), '操作日志必须保存授权人')
assert(logs.every((item) => !('scanValue' in item) && !('code' in item)), '操作日志不得保存可复用明文授权码')
assert(listPostFinishingAuthorizationConsumptions().every((item) => !('scanValue' in item) && !('code' in item)), '授权消费记录不得保存明文授权码')
const firstAuthorizedLog = logs.find((item) => item.action === '差异授权' && item.authorizerName)!
assert(listPostFinishingOperationLogs({ stage: '授权' }).every((item) => item.stage === '授权'), '日志必须按环节筛选')
assert(listPostFinishingOperationLogs({ operatorName: firstAuthorizedLog.operatorName }).every((item) => item.operatorName === firstAuthorizedLog.operatorName), '日志必须按作业人筛选')
assert(listPostFinishingOperationLogs({ authorizerName: firstAuthorizedLog.authorizerName }).every((item) => item.authorizerName === firstAuthorizedLog.authorizerName), '日志必须按授权人筛选')
assert(listPostFinishingOperationLogs({ differenceDirection: '少' }).every((item) => item.differenceDirection === '少'), '日志必须按差异方向筛选')
assert(listPostFinishingOperationLogs({ keyword: firstOrder.productionOrderNo }).length > 0, '日志必须按关联单号回溯')
const firstLogTime = [...logs].sort((a, b) => a.operatedAt.localeCompare(b.operatedAt))[0].operatedAt
const lastLogTime = [...logs].sort((a, b) => b.operatedAt.localeCompare(a.operatedAt))[0].operatedAt
assert.equal(listPostFinishingOperationLogs({ startedAt: firstLogTime, endedAt: lastLogTime }).length, logs.length, '日志必须支持包含边界的时间范围筛选')
assert(logs.some((item) => item.stage === '授权' && item.result === '失败' && item.remark?.includes('过期')), '日志必须记录授权码过期失败')
assert(logs.some((item) => item.stage === '授权' && item.result === '失败' && item.remark?.includes('已使用')), '日志必须记录授权码复用失败')

const documentNumbers = listPostFinishingDocumentNumberRecords()
assert.equal(documentNumbers.filter((item) => item.kind === 'DELIVERY').length, 15, '所有送货入口必须共用统一编号记录')
assert(new Set(documentNumbers.map((item) => `${item.kind}:${item.documentNo}`)).size === documentNumbers.length, '各类业务单号必须唯一')

const evidence = {
  suite: 'QC 后道全流程 3×5×5 验收',
  passLabel,
  generatedAt: new Date().toISOString(),
  totals: {
    productionOrders: 3,
    skuPerProductionOrder: 5,
    returnsPerProductionOrder: 5,
    returnChains: 15,
    skuReturnLines: 75,
    qcTasks: 15,
    postTasks: listPostFinishingFullFlowPostTasks().length,
    recheckOrders: 15,
    outboundOrders: 15,
    warehouseReceipts: 15,
    waitProcessWarehouseRecords: listPostFinishingWaitProcessWarehouseRecords().length,
    waitProcessWarehouseMovements: listPostFinishingWaitProcessWarehouseMovements().length,
    waitHandoverWarehouseRecords: listPostFinishingWaitHandoverWarehouseRecords().length,
    waitHandoverWarehouseMovements: listPostFinishingWaitHandoverWarehouseMovements().length,
    operationLogs: logs.length,
    authorizationConsumptions: listPostFinishingAuthorizationConsumptions().length,
  },
  coveredScenarios: [
    '正常一致', '回货-5%边界', '回货+5%与-5%整单抵消', '回货超过5%二次点数与授权',
    '回货后少1与多1整单抵消仍授权', '质检领取冲突与退领', 'SPU技术参数独立维护与质检使用', '仅车缝固定三项后道',
    '车缝＋烫包无漏做直达复检', '裁剪＋车缝＋烫包漏做补加工', '回货-质检-后道或直达复检-出货一次回货1:1', '后道领取冲突',
    '后道本环节守恒但全链不守恒仍授权', '质检与后道统一瑕疵和返厂', '复检领取冲突与释放', '条码错误阻断', '重贴未复扫阻断',
    '重贴后复扫恢复', '一复检一出货幂等', '仓库只接受FCK单号', '仓库差异授权', '重复收货幂等',
    '后道待交出仓复检入仓与出货交出', '后道辅料识别与纸样关联', '辅料整单一次入库与幂等',
    '辅料实配数量入库且不使用成衣授权', '辅料未入库只提示不阻断加工', '授权码30秒刷新', '过期/复用阻断', '操作日志全链回溯',
  ],
  chains: chainEvidence,
}

const outputPath = process.env.POST_FINISHING_EVIDENCE_OUT
if (outputPath) writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')

console.log(JSON.stringify(evidence, null, 2))
