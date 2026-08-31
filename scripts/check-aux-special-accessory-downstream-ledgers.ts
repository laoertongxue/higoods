#!/usr/bin/env node

import assert from 'node:assert/strict'

import {
  captureProcessWarehouseMutationState,
  createProcessHandoverRecord,
  createWaitHandoverWarehouseRecord,
  getHandoverRecordsByWorkOrderId,
  getReviewRecordsByWorkOrderId,
  getWarehouseRecordsByWorkOrderId,
  restoreProcessWarehouseMutationState,
  writeBackProcessHandoverRecord,
  type ProcessWarehouseObjectType,
} from '../src/data/fcs/process-warehouse-domain.ts'
import {
  captureProcessWorkOrderQualityState,
  createProcessWorkOrderQcRecord,
  listProcessWorkOrderQcRecords,
  listProcessWorkOrderSettlementLedgers,
  resetProcessWorkOrderQualityState,
  restoreProcessWorkOrderQualityState,
  submitProcessWorkOrderQcResult,
} from '../src/data/fcs/process-work-order-quality-settlement.ts'
import { listPreSettlementLedgers } from '../src/data/fcs/pre-settlement-ledger-repository.ts'
import { listStatementSourceItems } from '../src/data/fcs/store-domain-statement-source-adapter.ts'
import { buildTaskRouteCardPrintDoc } from '../src/data/fcs/task-print-cards.ts'
import { buildWorkOrderQrValue } from '../src/data/fcs/task-qr.ts'
import {
  buildBindingProcessOrderRouteCardPrintDocument,
  buildSpecialCraftTaskOrderRouteCardPrintDocument,
} from '../src/pages/print/templates/task-route-card-template.ts'
import {
  getSpecialCraftTaskOrderById,
  listSpecialCraftTaskOrders,
  type SpecialCraftTaskOrder,
} from '../src/data/fcs/special-craft-task-orders.ts'
import {
  buildBindingProcessOrders,
  type BindingProcessOrder,
} from '../src/pages/process-factory/cutting/binding-strip-orders.ts'
import {
  completeLaceProduction,
  confirmLaceProductionReceipt,
  confirmLaceReceipt,
  createLaceCompletionReport,
  createLaceHandover,
  getLaceProductionOrderView,
  getPurchaseSkuReceivedQty,
  listLaceHandovers,
  listLaceProductionOrders,
  listLaceReceipts,
  resetLaceFactoryRuntime,
  syncLaceProductionOrders,
  WLS_ACCESSORY_CLERK,
} from '../src/data/fcs/lace-factory-domain.ts'
import {
  AUX_SPECIAL_ACCESSORY_CHAINS,
  VerificationRecorder,
} from './aux-special-accessory-test-catalog.ts'

const recorder = new VerificationRecorder('downstream-ledgers')

function roundQty(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function isDiscreteUnit(unit: string): boolean {
  return ['片', '件', '个', '条', '张'].includes(unit)
}

function toWarehouseObject(order: SpecialCraftTaskOrder): ProcessWarehouseObjectType {
  if (order.operationId === 'AUX-OP-BUTTON-LOOP') return '盘扣'
  if (order.targetObject === '已裁部位') return '裁片'
  return order.targetObject
}

type DownstreamSource = {
  chainId: string
  craftName: string
  workOrderId: string
  workOrderNo: string
  sourceTaskId: string
  sourceTaskNo: string
  productionOrderId: string
  productionOrderNo: string
  factoryId: string
  factoryName: string
  objectType: ProcessWarehouseObjectType
  qtyUnit: string
  plannedQty: number
  receiverWarehouseName: string
  materialSku: string
  materialName: string
  feiTicketIds: string[]
  printSourceType: 'SPECIAL_CRAFT_TASK_ORDER' | 'BINDING_PROCESS_ORDER'
}

function verifyDownstream(source: DownstreamSource): void {
  const warehouseSnapshot = captureProcessWarehouseMutationState()
  const qcSnapshot = captureProcessWorkOrderQualityState()
  try {
    resetProcessWorkOrderQualityState()
    const discrete = isDiscreteUnit(source.qtyUnit)
    const receivedQty = discrete
      ? Math.max(1, Math.min(Math.floor(source.plannedQty), 3))
      : Math.max(0.5, Math.min(source.plannedQty, 3.5))
    const warehouse = createWaitHandoverWarehouseRecord({
      craftType: source.printSourceType === 'BINDING_PROCESS_ORDER' ? 'BINDING' : 'SPECIAL_CRAFT',
      craftName: source.craftName,
      sourceTaskOrderId: source.workOrderId,
      sourceWorkOrderNo: source.workOrderNo,
      workOrderId: source.workOrderId,
      workOrderNo: source.workOrderNo,
      sourceTaskId: source.sourceTaskId,
      sourceTaskNo: source.sourceTaskNo,
      sourceProductionOrderId: source.productionOrderId,
      sourceProductionOrderNo: source.productionOrderNo,
      sourceFactoryId: source.factoryId,
      sourceFactoryName: source.factoryName,
      targetFactoryId: `RECEIVER-${source.chainId}`,
      targetFactoryName: source.receiverWarehouseName,
      targetWarehouseName: source.receiverWarehouseName,
      warehouseLocation: `${source.chainId}-A01`,
      skuSummary: source.materialSku,
      styleNo: source.productionOrderNo,
      materialSku: source.materialSku,
      materialName: source.materialName,
      batchNo: `BATCH-${source.chainId}`,
      objectType: source.objectType,
      plannedObjectQty: source.plannedQty,
      receivedObjectQty: receivedQty,
      availableObjectQty: receivedQty,
      handedOverObjectQty: 0,
      writtenBackObjectQty: 0,
      diffObjectQty: 0,
      qtyUnit: source.qtyUnit,
      currentActionName: `${source.chainId} 下游账测试待交出`,
      status: '待交出',
      inboundAt: '2026-08-31 13:00:00',
      relatedFeiTicketIds: source.feiTicketIds,
      remark: '逐工艺仓库、质检、结算、打印下游测试',
    })
    const handover = createProcessHandoverRecord({
      warehouseRecordId: warehouse.warehouseRecordId,
      handoverRecordId: `PHR-${source.chainId}-DOWNSTREAM`,
      handoverRecordNo: `JH-${source.chainId}-DOWNSTREAM`,
      craftType: source.printSourceType === 'BINDING_PROCESS_ORDER' ? 'BINDING' : 'SPECIAL_CRAFT',
      craftName: source.craftName,
      sourceTaskOrderId: source.workOrderId,
      sourceWorkOrderNo: source.workOrderNo,
      workOrderId: source.workOrderId,
      workOrderNo: source.workOrderNo,
      sourceTaskId: source.sourceTaskId,
      sourceTaskNo: source.sourceTaskNo,
      sourceProductionOrderId: source.productionOrderId,
      sourceProductionOrderNo: source.productionOrderNo,
      handoverFactoryId: source.factoryId,
      handoverFactoryName: source.factoryName,
      receiveFactoryId: `RECEIVER-${source.chainId}`,
      receiveFactoryName: source.receiverWarehouseName,
      receiveWarehouseName: source.receiverWarehouseName,
      objectType: source.objectType,
      handoverObjectQty: receivedQty,
      qtyUnit: source.qtyUnit,
      packageQty: 1,
      packageUnit: source.objectType === '捆条' ? '卷' : '包',
      handoverPerson: '逐工艺交出测试员',
      handoverAt: '2026-08-31 13:10:00',
      relatedFeiTicketIds: source.feiTicketIds,
    })
    assert.throws(() => writeBackProcessHandoverRecord(handover.handoverRecordId, {
      receiveObjectQty: -1,
      receivePerson: '下游仓管',
    }), /大于或等于 0/)
    const received = writeBackProcessHandoverRecord(handover.handoverRecordId, {
      receiveObjectQty: receivedQty,
      receivePerson: '下游仓管',
      receiveAt: '2026-08-31 13:20:00',
      evidenceUrls: [`evidence://${source.chainId}/warehouse-receipt`],
      remark: '加工单批次实收一致',
    })
    assert(received)
    assert.equal(received.workOrderId, source.workOrderId)
    assert.equal(received.sourceTaskId, source.sourceTaskId)
    assert.throws(() => writeBackProcessHandoverRecord(handover.handoverRecordId, {
      receiveObjectQty: receivedQty,
      receivePerson: '重复收货人',
    }), /已经完成收货确认/)

    const qc = createProcessWorkOrderQcRecord({
      handoverRecordId: handover.handoverRecordId,
      unitPrice: 2.5,
      currency: 'CNY',
      createdBy: '逐工艺质检建单员',
    })
    assert.equal(createProcessWorkOrderQcRecord({
      handoverRecordId: handover.handoverRecordId,
      unitPrice: 99,
      createdBy: '幂等重放',
    }).qcRecordId, qc.qcRecordId)
    assert.throws(() => submitProcessWorkOrderQcResult({
      qcRecordId: qc.qcRecordId,
      inspectedQty: roundQty(receivedQty + 1),
      qualifiedQty: receivedQty,
      unqualifiedQty: 1,
      inspectorName: '质检员',
      inspectedAt: '2026-08-31 13:30:00',
    }), /不能超过/)
    const unqualifiedQty = receivedQty > 1 ? (discrete ? 1 : 0.5) : 0
    const qualifiedQty = roundQty(receivedQty - unqualifiedQty)
    const qcDone = submitProcessWorkOrderQcResult({
      qcRecordId: qc.qcRecordId,
      inspectedQty: receivedQty,
      qualifiedQty,
      unqualifiedQty,
      inspectorName: '逐工艺质检员',
      inspectedAt: '2026-08-31 13:30:00',
      evidenceUrls: unqualifiedQty > 0 ? [`evidence://${source.chainId}/qc`] : [],
      remark: unqualifiedQty > 0 ? '发现不合格，已留证' : '全数合格',
    })
    const settlement = listProcessWorkOrderSettlementLedgers().find((item) => item.qcRecordId === qc.qcRecordId)
    const repositoryLedger = listPreSettlementLedgers({ keyword: source.workOrderId })
      .find((item) => item.ledgerId === settlement?.ledgerId)
    const statementSource = listStatementSourceItems().find((item) => item.sourceItemId === settlement?.ledgerId)
    const routeCard = buildTaskRouteCardPrintDoc({
      sourceType: source.printSourceType,
      sourceId: source.workOrderId,
    })
    const printDocument = source.printSourceType === 'BINDING_PROCESS_ORDER'
      ? buildBindingProcessOrderRouteCardPrintDocument(source.workOrderId)
      : buildSpecialCraftTaskOrderRouteCardPrintDocument(source.workOrderId)

    assert.equal(qcDone.workOrderId, source.workOrderId)
    assert.equal(qcDone.sourceTaskId, source.sourceTaskId)
    assert.equal(qcDone.receivedQty, receivedQty)
    assert.equal(qcDone.inspectedQty, receivedQty)
    assert.equal(qcDone.qualifiedQty, qualifiedQty)
    assert(settlement)
    assert.equal(settlement.workOrderId, source.workOrderId)
    assert.equal(settlement.taskId, source.sourceTaskId)
    assert.equal(settlement.priceSourceTaskId, source.sourceTaskId)
    assert.equal(settlement.qty, qualifiedQty)
    assert.equal(settlement.settlementAmount, roundQty(qualifiedQty * 2.5))
    assert.equal(repositoryLedger?.workOrderId, source.workOrderId)
    assert.equal(statementSource?.workOrderId, source.workOrderId)
    assert(statementSource?.routeToSource.includes(encodeURIComponent(source.workOrderId)))
    assert(!statementSource?.routeToSource.includes(`/task-receive/${encodeURIComponent(source.sourceTaskId)}`))
    assert.equal(routeCard.sourceId, source.workOrderId)
    assert.equal(routeCard.taskId, source.sourceTaskId)
    assert.equal(routeCard.qrLabel, '加工单二维码')
    assert.equal(routeCard.qrValue, buildWorkOrderQrValue(source.workOrderId))
    assert.equal(routeCard.qtyUnit, source.qtyUnit)
    assert.equal(printDocument.sourceId, source.workOrderId)
    assert.equal(printDocument.qrCodes[0]?.value, buildWorkOrderQrValue(source.workOrderId))
    assert.throws(() => buildTaskRouteCardPrintDoc({
      sourceType: source.printSourceType,
      sourceId: `${source.workOrderId}:INVALID`,
    }), /未找到/)

    recorder.check({
      caseId: `DOWNSTREAM-${source.chainId}`,
      chainId: source.chainId,
      workOrderId: source.workOrderId,
      workOrderNo: source.workOrderNo,
      assertion: '交出、实收、仓库复核、质检、预结算、对账来源和加工单打印均精确归属具体加工单',
      evidence: {
        warehouseRecordIds: getWarehouseRecordsByWorkOrderId(source.workOrderId).map((item) => item.warehouseRecordId),
        handoverRecordIds: getHandoverRecordsByWorkOrderId(source.workOrderId).map((item) => item.handoverRecordId),
        reviewRecordIds: getReviewRecordsByWorkOrderId(source.workOrderId).map((item) => item.reviewRecordId),
        qcRecordIds: listProcessWorkOrderQcRecords({ workOrderId: source.workOrderId }).map((item) => item.qcRecordId),
        settlementLedgerId: settlement.ledgerId,
        statementSourceRoute: statementSource?.routeToSource,
        printQr: printDocument.qrCodes[0]?.value,
        receivedQty,
        qualifiedQty,
        unqualifiedQty,
      },
    }, () => {
      assert.equal(getHandoverRecordsByWorkOrderId(source.workOrderId).length, 1)
      assert.equal(getReviewRecordsByWorkOrderId(source.workOrderId).length, 1)
      assert.equal(listProcessWorkOrderQcRecords({ workOrderId: source.workOrderId }).length, 1)
    })
  } finally {
    restoreProcessWorkOrderQualityState(qcSnapshot)
    restoreProcessWarehouseMutationState(warehouseSnapshot)
  }
}

for (const chain of AUX_SPECIAL_ACCESSORY_CHAINS.filter((item) => item.kind === 'SPECIAL_CRAFT')) {
  try {
    const order = listSpecialCraftTaskOrders().find((item) => item.operationId === chain.operationId)
    assert(order, `${chain.id} 缺少可测试加工单`)
    assert.equal(getSpecialCraftTaskOrderById(order.taskOrderId)?.taskOrderId, order.taskOrderId)
    verifyDownstream({
      chainId: chain.id,
      craftName: order.operationName,
      workOrderId: order.taskOrderId,
      workOrderNo: order.taskOrderNo,
      sourceTaskId: order.sourceTaskId,
      sourceTaskNo: order.sourceTaskNo,
      productionOrderId: order.productionOrderId,
      productionOrderNo: order.productionOrderNo,
      factoryId: order.factoryId,
      factoryName: order.factoryName,
      objectType: toWarehouseObject(order),
      qtyUnit: order.outputUnit || order.unit,
      plannedQty: order.planQty,
      receiverWarehouseName: order.receiverWarehouseName,
      materialSku: order.materialSku || order.operationId,
      materialName: order.partName || order.operationName,
      feiTicketIds: order.feiTicketNos,
      printSourceType: 'SPECIAL_CRAFT_TASK_ORDER',
    })
  } catch (error) {
    recorder.check({ caseId: `DOWNSTREAM-${chain.id}`, chainId: chain.id, assertion: '逐工艺下游账与打印必须通过' }, () => { throw error })
  }
}

try {
  const order: BindingProcessOrder | undefined = buildBindingProcessOrders()[0]
  assert(order, '缺少捆条加工单')
  verifyDownstream({
    chainId: 'BIND-01',
    craftName: '捆条',
    workOrderId: order.bindingOrderId,
    workOrderNo: order.bindingOrderNo,
    sourceTaskId: order.sourceTaskId,
    sourceTaskNo: order.sourceTaskNo,
    productionOrderId: order.sourceProductionOrderId,
    productionOrderNo: order.sourceProductionOrderNo,
    factoryId: order.factoryId,
    factoryName: order.factoryName,
    objectType: '捆条',
    qtyUnit: order.unit,
    plannedQty: order.plannedOutputQty,
    receiverWarehouseName: '中央辅料仓',
    materialSku: order.materialIdentity.materialSku,
    materialName: order.materialIdentity.materialName,
    feiTicketIds: order.sourceFeiTicketIds,
    printSourceType: 'BINDING_PROCESS_ORDER',
  })
} catch (error) {
  recorder.check({ caseId: 'DOWNSTREAM-BIND-01', chainId: 'BIND-01', assertion: '捆条下游账与打印必须通过' }, () => { throw error })
}

try {
  resetLaceFactoryRuntime()
  syncLaceProductionOrders()
  const order = listLaceProductionOrders().find((item) => item.status === '待接收' && item.planQty >= 3)
  assert(order, '缺少花边生产单')
  confirmLaceProductionReceipt(order.workOrderId)
  const reportQtys = [roundQty(order.planQty * 0.3), roundQty(order.planQty * 0.3)]
  reportQtys.push(roundQty(order.planQty - reportQtys[0] - reportQtys[1]))
  reportQtys.forEach((qty, index) => createLaceCompletionReport({
    workOrderId: order.workOrderId,
    qty,
    reportedAt: `2026-08-21T0${index + 1}:00:00+07:00`,
    note: `下游账测试第 ${index + 1} 次填报`,
    clientActionId: `LACE-DOWNSTREAM-REPORT-${index + 1}`,
  }))
  completeLaceProduction(order.workOrderId, '下游账测试完成')
  const firstQty = roundQty(order.planQty * 0.4)
  const secondQty = roundQty(order.planQty - firstQty)
  const handover1 = createLaceHandover({
    workOrderId: order.workOrderId,
    qty: firstQty,
    deliveryNo: 'DEL-LACE-DOWNSTREAM-01',
    packageCount: 1,
    packageNote: '第一批',
    expectedReceiverName: '中央辅料仓',
    handedOverAt: '2026-08-21T08:00:00+07:00',
    clientActionId: 'LACE-DOWNSTREAM-HANDOVER-1',
  })
  const handover2 = createLaceHandover({
    workOrderId: order.workOrderId,
    qty: secondQty,
    deliveryNo: 'DEL-LACE-DOWNSTREAM-02',
    packageCount: 2,
    packageNote: '第二批',
    expectedReceiverName: '中央辅料仓',
    handedOverAt: '2026-08-21T09:00:00+07:00',
    clientActionId: 'LACE-DOWNSTREAM-HANDOVER-2',
  })
  const firstReceived = roundQty(Math.max(firstQty - 1, 0))
  confirmLaceReceipt({
    handoverId: handover1.handoverId,
    actualQty: firstReceived,
    differenceReason: '第一批短收 1',
    evidence: 'evidence://lace/downstream-short',
    warehouseLocation: '中央辅料仓-LACE-A01',
    receivedAt: '2026-08-21T10:00:00+07:00',
    clientActionId: 'LACE-DOWNSTREAM-RECEIVE-1',
    actor: WLS_ACCESSORY_CLERK,
  })
  confirmLaceReceipt({
    handoverId: handover2.handoverId,
    actualQty: secondQty,
    differenceReason: '',
    evidence: 'evidence://lace/downstream-exact',
    warehouseLocation: '中央辅料仓-LACE-A01',
    receivedAt: '2026-08-21T11:00:00+07:00',
    clientActionId: 'LACE-DOWNSTREAM-RECEIVE-2',
    actor: WLS_ACCESSORY_CLERK,
  })
  const receivedTotal = roundQty(firstReceived + secondQty)
  const final = getLaceProductionOrderView(order.workOrderId)
  recorder.check({
    caseId: 'DOWNSTREAM-ACC-LACE-01',
    chainId: 'ACC-LACE-01',
    workOrderId: order.workOrderId,
    workOrderNo: order.workOrderNo,
    assertion: '花边按具体生产单完成分批交出、WLS 差异实收和 PMS 采购实收回写；不生成通用打印/QC账',
    evidence: {
      handoverIds: listLaceHandovers(order.workOrderId).map((item) => item.handoverId),
      receiptIds: listLaceReceipts(order.workOrderId).map((item) => item.receiptId),
      receivedTotal,
      pmsPurchaseReceivedQty: getPurchaseSkuReceivedQty(order.purchaseOrderId, order.skuId),
    },
  }, () => {
    assert.equal(final?.workOrderId, order.workOrderId)
    assert.equal(final?.receivedQty, receivedTotal)
    assert.equal(getPurchaseSkuReceivedQty(order.purchaseOrderId, order.skuId), receivedTotal)
    assert.equal(listLaceHandovers(order.workOrderId).length, 2)
    assert.equal(listLaceReceipts(order.workOrderId).length, 2)
  })
} catch (error) {
  recorder.check({ caseId: 'DOWNSTREAM-ACC-LACE-01', chainId: 'ACC-LACE-01', assertion: '花边 WLS/PMS 下游链必须通过' }, () => { throw error })
}

recorder.finish({
  chainCount: AUX_SPECIAL_ACCESSORY_CHAINS.length,
  downstreamRule: '17 种工艺 + 捆条逐项验证交出/实收/QC/结算/打印；花边验证 Web/WLS/PMS 下游',
})
