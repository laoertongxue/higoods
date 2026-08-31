#!/usr/bin/env node

import assert from 'node:assert/strict'

import {
  captureProcessActionRuntime,
  executeProcessAction,
  getProcessActionOperationRecordsBySource,
  restoreProcessActionRuntime,
  type ProcessActionPayload,
  type ProcessActionWritebackResult,
} from '../src/data/fcs/process-action-writeback-service.ts'
import {
  captureSpecialCraftTaskStore,
  getSpecialCraftTaskOrderById,
  listSpecialCraftTaskOrders,
  restoreSpecialCraftTaskStore,
  type SpecialCraftTaskOrder,
} from '../src/data/fcs/special-craft-task-orders.ts'
import {
  captureProcessTaskStore,
  restoreProcessTaskStore,
} from '../src/data/fcs/process-tasks.ts'
import {
  captureProcessWarehouseMutationState,
  getWarehouseRecordsByWorkOrderId,
  listProcessHandoverRecords,
  restoreProcessWarehouseMutationState,
} from '../src/data/fcs/process-warehouse-domain.ts'
import {
  capturePdaHandoverState,
  restorePdaHandoverState,
} from '../src/data/fcs/pda-handover-events.ts'
import {
  buildBindingProcessOrders,
  captureBindingProcessOrderStore,
  getBindingProcessOrderById,
  restoreBindingProcessOrderStore,
} from '../src/pages/process-factory/cutting/binding-strip-orders.ts'
import { executeBindingProcessActionWithWarehouse } from '../src/data/fcs/binding-process-warehouse-linkage-service.ts'
import {
  LACE_FACTORY_OPERATOR,
  LACE_FACTORY_SUPERVISOR,
  WLS_ACCESSORY_CLERK,
  captureLaceFactoryRuntime,
  completeLaceProduction,
  confirmLaceProductionReceipt,
  confirmLaceReceipt,
  createLaceCompletionReport,
  createLaceHandover,
  getLaceProductionOrderView,
  getPurchaseSkuReceivedQty,
  listLaceCompletionReports,
  listLaceHandovers,
  listLaceOperationLogs,
  listLaceProductionOrders,
  listLaceReceipts,
  resetLaceFactoryRuntime,
  restoreLaceFactoryRuntime,
  syncLaceProductionOrders,
  undoLaceProductionCompletion,
  type LaceFactoryRuntimeState,
} from '../src/data/fcs/lace-factory-domain.ts'
import {
  AUX_SPECIAL_ACCESSORY_CHAINS,
  VerificationRecorder,
} from './aux-special-accessory-test-catalog.ts'

const recorder = new VerificationRecorder('per-craft-full-flow')

function roundQty(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function splitQty(total: number, integer: boolean): [number, number] {
  const first = integer ? Math.max(1, Math.floor(total * 0.4)) : Math.max(0.01, roundQty(total * 0.4))
  return [first, roundQty(total - first)]
}

function splitMap(values: Record<string, number>, integer: boolean): [Record<string, number>, Record<string, number>] {
  const first: Record<string, number> = {}
  const second: Record<string, number> = {}
  Object.entries(values).forEach(([key, total], index) => {
    if (integer && total === 1) {
      first[key] = index % 2 === 0 ? 1 : 0
      second[key] = index % 2 === 0 ? 0 : 1
      return
    }
    const [left, right] = splitQty(total, integer)
    first[key] = left
    second[key] = right
  })
  if (sumMap(first) <= 0 || sumMap(second) <= 0) {
    const donor = Object.keys(values).find((key) => Number(first[key] || 0) >= 1)
    assert(donor, '业务明细总量不足以拆成两个正数批次')
    first[donor] = roundQty(first[donor] - 1)
    second[donor] = roundQty(second[donor] + 1)
  }
  return [first, second]
}

function sumMap(values?: Record<string, number>): number {
  return roundQty(Object.values(values || {}).reduce((sum, value) => sum + Number(value || 0), 0))
}

function buildLineTotals(order: SpecialCraftTaskOrder): {
  skuQtyBySkuCode?: Record<string, number>
  feiQtyByTicketNo?: Record<string, number>
} {
  if (order.targetObject === '成衣') {
    const skuQtyBySkuCode: Record<string, number> = {}
    for (const line of order.demandLines || []) {
      const skuCode = line.skuCode || `${line.colorName || '成衣'}-${line.sizeCode || '均码'}`
      assert(!Object.hasOwn(skuQtyBySkuCode, skuCode), `成衣 SKU 重复：${skuCode}`)
      skuQtyBySkuCode[skuCode] = line.planPieceQty
    }
    assert(Object.keys(skuQtyBySkuCode).length > 0, '成衣加工单缺少 SKU 明细')
    return { skuQtyBySkuCode }
  }
  if (order.targetObject === '已裁部位') {
    const feiQtyByTicketNo: Record<string, number> = {}
    for (const line of order.lineProgress || []) {
      assert(line.feiTicketNo, `裁片加工单 ${order.taskOrderNo} 缺少菲票`)
      assert(!Object.hasOwn(feiQtyByTicketNo, line.feiTicketNo), `菲票重复：${line.feiTicketNo}`)
      feiQtyByTicketNo[line.feiTicketNo] = line.planQty
    }
    assert(Object.keys(feiQtyByTicketNo).length > 0, '裁片加工单缺少菲票明细')
    return { feiQtyByTicketNo }
  }
  return {}
}

function installCleanSpecialCraftFixture(workOrderId: string, snapshot: ReturnType<typeof captureSpecialCraftTaskStore>): void {
  const scenarioStore = structuredClone(snapshot)
  const order = scenarioStore.taskOrders.find((item) => item.taskOrderId === workOrderId)
  assert(order, `缺少待测试加工单 ${workOrderId}`)
  order.status = '待接收'
  order.executionStatus = 'WAIT_PICKUP'
  order.executionStatusLabel = '待接收'
  order.receivedQty = 0
  order.inputReceivedQty = 0
  order.completedQty = 0
  order.lossQty = 0
  order.damageQty = 0
  order.currentQty = 0
  order.returnedQty = 0
  order.writebackQty = 0
  order.waitHandoverQty = 0
  order.receivedTicketCount = 0
  order.outputQty = 0
  order.handedOverQty = 0
  order.nodeRecords = []
  order.warehouseLinks = []
  order.waitProcessStockItemIds = []
  order.waitHandoverStockItemIds = []
  order.inboundRecordIds = []
  order.outboundRecordIds = []
  if (order.targetObject === '已裁部位' && order.lineProgress?.length === 1) {
    const sourceLine = order.lineProgress[0]
    assert(sourceLine.feiTicketNo, `${order.taskOrderNo} 缺少来源菲票`)
    const firstQty = Math.max(1, Math.floor(sourceLine.planQty * 0.4))
    const secondQty = sourceLine.planQty - firstQty
    assert(secondQty > 0, `${order.taskOrderNo} 数量不足以构造双菲票业务数据`)
    const secondTicketNo = `${sourceLine.feiTicketNo}-B`
    sourceLine.planQty = firstQty
    order.lineProgress = [
      sourceLine,
      {
        ...structuredClone(sourceLine),
        lineProgressKey: `${sourceLine.lineProgressKey}-B`,
        feiTicketNo: secondTicketNo,
        partName: `${sourceLine.partName}-第二部位`,
        planQty: secondQty,
      },
    ]
    const sourceDemand = order.demandLines?.[0]
    if (sourceDemand) {
      sourceDemand.planPieceQty = firstQty
      order.demandLines = [
        sourceDemand,
        {
          ...structuredClone(sourceDemand),
          demandLineId: `${sourceDemand.demandLineId}-B`,
          pieceRowId: `${sourceDemand.pieceRowId || sourceDemand.demandLineId}-B`,
          partName: `${sourceDemand.partName}-第二部位`,
          planPieceQty: secondQty,
          feiTicketNos: [secondTicketNo],
        },
      ]
    }
    order.feiTicketNos = [sourceLine.feiTicketNo, secondTicketNo]
    order.sourcePieceRowIds = [...new Set((order.demandLines || []).map((line) => line.pieceRowId).filter(Boolean))]
  }
  order.lineProgress = (order.lineProgress || []).map((line) => ({
    ...line,
    receivedQty: 0,
    completedQty: 0,
    returnedQty: 0,
  }))
  order.buttonLoopInputLines = (order.buttonLoopInputLines || []).map((line) => ({
    ...line,
    received: false,
    receivedAt: undefined,
    receivedBy: undefined,
  }))
  order.buttonLoopEvents = []
  restoreSpecialCraftTaskStore(scenarioStore)
}

function runSpecialCraftFullFlow(chainId: string, workOrderId: string, sequence: number): void {
  const specialSnapshot = captureSpecialCraftTaskStore()
  const taskSnapshot = captureProcessTaskStore()
  const actionSnapshot = captureProcessActionRuntime()
  const warehouseSnapshot = captureProcessWarehouseMutationState()
  const handoverSnapshot = capturePdaHandoverState()
  try {
    const beforeHandoverIds = new Set(warehouseSnapshot.handoverRecords
      .filter((record) => record.workOrderId === workOrderId)
      .map((record) => record.handoverRecordId))
    installCleanSpecialCraftFixture(workOrderId, specialSnapshot)
    restoreProcessActionRuntime({ operationRecords: [], idempotentResults: [] })
    const seed = getSpecialCraftTaskOrderById(workOrderId)
    assert(seed, `重置后找不到加工单 ${workOrderId}`)
    const orderId = seed.taskOrderId
    const originalOrder = specialSnapshot.taskOrders.find((item) => item.taskOrderId === workOrderId)
    assert(originalOrder, `基线缺少加工单 ${workOrderId}`)
    const isButtonLoop = seed.targetObject === '捆条'
    const isAccessory = seed.targetObject === '辅料'
    const integerOutput = seed.outputUnit !== '米' && seed.outputUnit !== 'Yard'
    const totals = buildLineTotals(seed)
    const [skuFirst, skuSecond] = totals.skuQtyBySkuCode ? splitMap(totals.skuQtyBySkuCode, true) : [undefined, undefined]
    const [feiFirst, feiSecond] = totals.feiQtyByTicketNo ? splitMap(totals.feiQtyByTicketNo, true) : [undefined, undefined]
    const inputTotal = isButtonLoop
      ? seed.inputTicketCount || 0
      : isAccessory
        ? seed.inputPlannedQty || 0
        : sumMap(totals.skuQtyBySkuCode || totals.feiQtyByTicketNo) || seed.planQty
    const outputTotal = isButtonLoop ? 100 : seed.planQty
    const [inputFirst, inputSecond] = isButtonLoop
      ? [1, Math.max((seed.inputTicketCount || 0) - 1, 0)]
      : isAccessory
        ? splitQty(inputTotal, false)
        : [sumMap(skuFirst || feiFirst), sumMap(skuSecond || feiSecond)]
    const [outputFirst, outputSecond] = isButtonLoop
      ? [40, 60]
      : isAccessory
        ? splitQty(outputTotal, integerOutput)
        : [sumMap(skuFirst || feiFirst), sumMap(skuSecond || feiSecond)]
    const [handoverFirst, handoverSecond] = isButtonLoop
      ? [30, 70]
      : isAccessory
        ? splitQty(outputTotal, integerOutput)
        : [sumMap(skuFirst || feiFirst), sumMap(skuSecond || feiSecond)]
    const inputTickets = seed.buttonLoopInputLines?.map((line) => line.feiTicketNo) || []

    const payload = (
      actionCode: string,
      batch: 1 | 2,
      objectQty: number,
      confirmationKey: string,
      overrides: Partial<ProcessActionPayload> = {},
    ): ProcessActionPayload => ({
      sourceChannel: batch === 1 ? 'Web 端' : '移动端',
      sourceType: 'SPECIAL_CRAFT',
      sourceId: orderId,
      taskId: seed.sourceTaskId,
      actionCode,
      operatorName: batch === 1 ? 'Web 全链测试员' : 'PDA 全链测试员',
      operatorFactoryId: seed.factoryId,
      operatedAt: `2026-08-31 ${String(8 + (sequence % 10)).padStart(2, '0')}:${String(batch * 10).padStart(2, '0')}:${String(sequence % 60).padStart(2, '0')}`,
      objectType: seed.targetObject,
      objectQty,
      qtyUnit: actionCode === 'SPECIAL_CRAFT_CONFIRM_RECEIVE' ? seed.inputUnit || seed.unit : seed.outputUnit || seed.unit,
      skuQtyBySkuCode: batch === 1 ? skuFirst : skuSecond,
      feiQtyByTicketNo: isButtonLoop
        ? { [inputTickets[batch - 1] || '']: 1 }
        : batch === 1 ? feiFirst : feiSecond,
      confirmationKey,
      remark: `${chainId} 第 ${batch} 批 ${actionCode}`,
      ...overrides,
    })

    assert.throws(() => executeProcessAction({
      ...payload('SPECIAL_CRAFT_CONFIRM_RECEIVE', 1, inputFirst, `${chainId}-NO-KEY`),
      confirmationKey: undefined,
    }), /确认号/)
    assert.throws(() => executeProcessAction({
      ...payload('SPECIAL_CRAFT_CONFIRM_RECEIVE', 1, inputFirst, `${chainId}-WRONG-FACTORY`),
      operatorFactoryId: 'FAC-WRONG',
    }), /不属于当前登录工厂|工厂/)
    assert.equal(getSpecialCraftTaskOrderById(orderId)?.status, '待接收', '非法动作不得改变加工单状态')

    const receive1 = executeProcessAction(payload(
      'SPECIAL_CRAFT_CONFIRM_RECEIVE',
      1,
      inputFirst,
      `${chainId}-RECEIVE-1`,
    ))
    const receive2 = executeProcessAction(payload(
      'SPECIAL_CRAFT_CONFIRM_RECEIVE',
      2,
      inputSecond,
      `${chainId}-RECEIVE-2`,
    ))
    assert.equal(receive1.updatedWorkOrderId, orderId)
    assert.equal(receive2.updatedWorkOrderId, orderId)
    assert.equal(getSpecialCraftTaskOrderById(orderId)?.status, '加工中')

    const processPayload1 = payload(
      'SPECIAL_CRAFT_PROCESS_REPORT',
      1,
      outputFirst,
      `${chainId}-PROCESS-1`,
      isAccessory || isButtonLoop ? { skuQtyBySkuCode: undefined, feiQtyByTicketNo: undefined } : {},
    )
    const processPayload2 = payload(
      'SPECIAL_CRAFT_PROCESS_REPORT',
      2,
      outputSecond,
      `${chainId}-PROCESS-2`,
      isAccessory || isButtonLoop ? { skuQtyBySkuCode: undefined, feiQtyByTicketNo: undefined } : {},
    )
    const process1 = executeProcessAction(processPayload1)
    const completedAfterFirst = getSpecialCraftTaskOrderById(orderId)?.completedQty
    const replay = executeProcessAction(processPayload1)
    assert.equal(replay.operationRecordId, process1.operationRecordId, '相同确认号必须返回同一写回结果')
    assert.equal(getSpecialCraftTaskOrderById(orderId)?.completedQty, completedAfterFirst, '幂等重放不得重复累计')
    executeProcessAction(processPayload2)
    assert.equal(getSpecialCraftTaskOrderById(orderId)?.completedQty, outputTotal)

    const overSkuQty = totals.skuQtyBySkuCode ? { ...totals.skuQtyBySkuCode } : undefined
    const overFeiQty = totals.feiQtyByTicketNo ? { ...totals.feiQtyByTicketNo } : undefined
    if (overSkuQty) {
      const firstKey = Object.keys(overSkuQty)[0]
      overSkuQty[firstKey] = Number(overSkuQty[firstKey] || 0) + 1
    }
    if (overFeiQty) {
      const firstKey = Object.keys(overFeiQty)[0]
      overFeiQty[firstKey] = Number(overFeiQty[firstKey] || 0) + 1
    }
    assert.throws(() => executeProcessAction(payload(
      'SPECIAL_CRAFT_SUBMIT_HANDOVER',
      1,
      outputTotal + 1,
      `${chainId}-HANDOVER-OVER`,
      isAccessory || isButtonLoop
        ? { skuQtyBySkuCode: undefined, feiQtyByTicketNo: undefined }
        : { skuQtyBySkuCode: overSkuQty, feiQtyByTicketNo: overFeiQty },
    )), /不能超过|交出数量/)

    const handoverPayload1 = payload(
      'SPECIAL_CRAFT_SUBMIT_HANDOVER',
      1,
      handoverFirst,
      `${chainId}-HANDOVER-1`,
      isAccessory || isButtonLoop ? { skuQtyBySkuCode: undefined, feiQtyByTicketNo: undefined } : {},
    )
    const handoverPayload2 = payload(
      'SPECIAL_CRAFT_SUBMIT_HANDOVER',
      2,
      handoverSecond,
      `${chainId}-HANDOVER-2`,
      isAccessory || isButtonLoop ? { skuQtyBySkuCode: undefined, feiQtyByTicketNo: undefined } : {},
    )
    executeProcessAction(handoverPayload1)
    executeProcessAction(handoverPayload2)
    assert.equal(getSpecialCraftTaskOrderById(orderId)?.returnedQty, outputTotal)

    const complete = executeProcessAction(payload(
      'SPECIAL_CRAFT_COMPLETE_ORDER',
      2,
      outputTotal,
      `${chainId}-COMPLETE`,
      { skuQtyBySkuCode: undefined, feiQtyByTicketNo: undefined },
    ))
    const finalOrder = getSpecialCraftTaskOrderById(orderId)
    assert.equal(complete.updatedWorkOrderId, orderId)
    assert.equal(complete.taskId, seed.sourceTaskId)
    assert.equal(finalOrder?.status, '已完结')
    assert.equal(finalOrder?.completedQty, outputTotal)
    assert.equal(finalOrder?.returnedQty, outputTotal)

    const operationRecords = getProcessActionOperationRecordsBySource('SPECIAL_CRAFT', orderId)
    assert.equal(operationRecords.length, 7, '两次接收、两次填报、两次交出和一次完成应形成 7 条动作事实')
    assert(operationRecords.every((record) => record.sourceId === orderId && record.taskId === seed.sourceTaskId))
    assert(!operationRecords.some((record) => /开工|关键节点|完成任务/.test(record.actionLabel)))
    const warehouseRows = getWarehouseRecordsByWorkOrderId(orderId)
    assert(warehouseRows.length > 0, '四动作必须生成或更新加工单级仓库事实')
    assert(warehouseRows.every((record) => record.workOrderId === orderId))
    const handovers = listProcessHandoverRecords().filter((record) => record.workOrderId === orderId)
    const newHandovers = handovers.filter((record) => !beforeHandoverIds.has(record.handoverRecordId))
    assert.equal(newHandovers.length, 2, '两批发起交出必须形成两条新的加工单级交出事实')
    assert.equal(roundQty(newHandovers.reduce((sum, record) => sum + record.handoverObjectQty, 0)), outputTotal)

    recorder.check({
      caseId: `FLOW-${chainId}-${orderId}`,
      chainId,
      workOrderId: orderId,
      workOrderNo: seed.taskOrderNo,
      assertion: '两批确认接收、两批加工填报、两批交出、幂等重放、超量阻断和完成加工单全链通过',
      evidence: {
        originalStatus: originalOrder.status,
        testStartStatus: '待接收',
        sourceTaskId: seed.sourceTaskId,
        businessLineCount: seed.targetObject === '辅料'
          ? seed.demandLines?.length || 1
          : seed.lineProgress?.length || seed.demandLines?.length || seed.buttonLoopInputLines?.length || 1,
        businessLineKeys: seed.targetObject === '辅料'
          ? (seed.demandLines || []).map((line) => `${line.materialSku || line.skuCode}:${line.sizeCode}`)
          : Object.keys(totals.skuQtyBySkuCode || totals.feiQtyByTicketNo || {}),
        accessoryInputLines: seed.targetObject === '辅料'
          ? (seed.demandLines || []).map((line) => ({
              materialSku: line.materialSku,
              sizeCode: line.sizeCode,
              inputPlannedQty: line.inputPlannedQty,
              inputUnit: line.inputUnit,
              outputPlannedQty: line.planPieceQty,
              outputUnit: line.outputUnit || line.unit,
            }))
          : [],
        inputBatches: [inputFirst, inputSecond],
        outputBatches: [outputFirst, outputSecond],
        handoverBatches: [handoverFirst, handoverSecond],
        outputTotal,
        operationRecordCount: operationRecords.length,
        operationRecords,
        finalState: {
          status: finalOrder?.status,
          receivedQty: finalOrder?.receivedQty,
          inputReceivedQty: finalOrder?.inputReceivedQty,
          completedQty: finalOrder?.completedQty,
          returnedQty: finalOrder?.returnedQty,
        },
        warehouseRecordIds: warehouseRows.map((record) => record.warehouseRecordId),
        warehouseRecords: warehouseRows,
        handoverRecordIds: newHandovers.map((record) => record.handoverRecordId),
        handoverRecords: newHandovers,
      },
    }, () => assert.equal(finalOrder?.status, '已完结'))
  } finally {
    restorePdaHandoverState(handoverSnapshot)
    restoreProcessWarehouseMutationState(warehouseSnapshot)
    restoreProcessActionRuntime(actionSnapshot)
    restoreSpecialCraftTaskStore(specialSnapshot)
    restoreProcessTaskStore(taskSnapshot)
  }
}

const specialWorkOrders = listSpecialCraftTaskOrders().map((order) => ({
  workOrderId: order.taskOrderId,
  operationId: order.operationId,
}))
for (const [index, workOrder] of specialWorkOrders.entries()) {
  const chain = AUX_SPECIAL_ACCESSORY_CHAINS.find((item) => item.operationId === workOrder.operationId)
  assert(chain, `加工单 ${workOrder.workOrderId} 的工艺 ${workOrder.operationId} 未登记`)
  try {
    runSpecialCraftFullFlow(chain.id, workOrder.workOrderId, index)
  } catch (error) {
    recorder.check({
      caseId: `FLOW-${chain.id}-${workOrder.workOrderId}`,
      chainId: chain.id,
      workOrderId: workOrder.workOrderId,
      assertion: '该工艺四动作真实全链必须通过',
    }, () => { throw error })
  }
}

function runBindingFullFlow(workOrderId: string, sequence: number): void {
  const bindingSnapshot = captureBindingProcessOrderStore()
  const bindingWarehouseSnapshot = captureProcessWarehouseMutationState()
  try {
    const originalOrder = bindingSnapshot.find((item) => item.bindingOrderId === workOrderId)
    assert(originalOrder, `基线缺少捆条加工单 ${workOrderId}`)
    const order = buildBindingProcessOrders().find((item) => item.bindingOrderId === workOrderId)
    assert(order, `缺少捆条加工单 ${workOrderId}`)
    const originalStatus = order.status
    const beforeHandoverIds = new Set(listProcessHandoverRecords()
      .filter((record) => record.workOrderId === order.bindingOrderId)
      .map((record) => record.handoverRecordId))
    order.status = '待加工'
    order.receivedAt = ''
    order.completedAt = ''
    order.actualOutputQty = 0
    order.handedOverQty = 0
    order.actionRecords = []
    order.bindingDetails.forEach((detail) => {
      detail.receivedMaterialLength = 0
      detail.actualLength = 0
      detail.straightCutLength = 0
      detail.crossCutLength = 0
      detail.biasCutLength = 0
      detail.rollLength = 0
      detail.actualRollCount = 0
      detail.latestRecordedAt = ''
      detail.cuttingRecords = []
      detail.differenceRecords = []
    })
    const action = (actionCode: Parameters<typeof executeBindingProcessActionWithWarehouse>[0]['actionCode'], key: string, qty?: number, detailId?: string) =>
      executeBindingProcessActionWithWarehouse({
        bindingOrderId: order.bindingOrderId,
        actionCode,
        qty,
        detailId,
        confirmationKey: `${sequence}-${key}`,
        operatorName: '捆条全链测试员',
        operatedAt: `2026-08-31 ${String(12 + (sequence % 8)).padStart(2, '0')}:${String(order.actionRecords?.length || 0).padStart(2, '0')}:${String(sequence % 60).padStart(2, '0')}`,
        remark: actionCode === 'BINDING_COMPLETE_ORDER' ? '全量完成，无短裁' : `${actionCode} 分批测试`,
      })
    for (const detail of order.bindingDetails) {
      const [receiveFirst, receiveSecond] = splitQty(detail.requiredLength, false)
      action('BINDING_CONFIRM_RECEIVE', `BIND-RECEIVE-${detail.detailId}-1`, receiveFirst, detail.detailId)
      action('BINDING_CONFIRM_RECEIVE', `BIND-RECEIVE-${detail.detailId}-2`, receiveSecond, detail.detailId)
      const [processFirst, processSecond] = splitQty(detail.plannedBindingLength, false)
      const firstResult = action('BINDING_PROCESS_REPORT', `BIND-PROCESS-${detail.detailId}-1`, processFirst, detail.detailId)
      const beforeReplay = order.actualOutputQty
      const replay = action('BINDING_PROCESS_REPORT', `BIND-PROCESS-${detail.detailId}-1`, processFirst, detail.detailId)
      assert.equal(replay.actualOutputQty, firstResult.actualOutputQty)
      assert.equal(order.actualOutputQty, beforeReplay)
      action('BINDING_PROCESS_REPORT', `BIND-PROCESS-${detail.detailId}-2`, processSecond, detail.detailId)
    }
    assert.throws(() => action('BINDING_SUBMIT_HANDOVER', 'BIND-HANDOVER-OVER', order.actualOutputQty + 1), /不能超过/)
    const [bindingHandoverFirst, bindingHandoverSecond] = splitQty(order.actualOutputQty, false)
    action('BINDING_SUBMIT_HANDOVER', 'BIND-HANDOVER-1', bindingHandoverFirst)
    assert.throws(() => action('BINDING_COMPLETE_ORDER', 'BIND-COMPLETE-EARLY'), /未交出/)
    action('BINDING_SUBMIT_HANDOVER', 'BIND-HANDOVER-2', bindingHandoverSecond)
    action('BINDING_COMPLETE_ORDER', 'BIND-COMPLETE')
    const finalBindingOrder = getBindingProcessOrderById(order.bindingOrderId)
    assert(finalBindingOrder)
    const expectedActionCount = order.bindingDetails.length * 4 + 3
    const bindingWarehouseRows = getWarehouseRecordsByWorkOrderId(order.bindingOrderId)
    const bindingHandovers = listProcessHandoverRecords().filter((record) => (
      record.workOrderId === order.bindingOrderId && !beforeHandoverIds.has(record.handoverRecordId)
    ))
    recorder.check({
      caseId: `FLOW-BIND-01-${order.bindingOrderId}`,
      chainId: 'BIND-01',
      workOrderId: order.bindingOrderId,
      workOrderNo: order.bindingOrderNo,
      assertion: '该捆条加工单全部规格均执行两批接收、两批加工、幂等、超量阻断、两批交出和完成',
      evidence: {
        originalStatus,
        testStartStatus: '待加工',
        sourceTaskId: order.sourceTaskId,
        detailCount: order.bindingDetails.length,
        actualOutputQty: finalBindingOrder.actualOutputQty,
        handedOverQty: finalBindingOrder.handedOverQty,
        actionRecordCount: finalBindingOrder.actionRecords?.length,
        actionRecords: finalBindingOrder.actionRecords,
        detailStates: finalBindingOrder.bindingDetails.map((detail) => ({
          detailId: detail.detailId,
          receivedMaterialLength: detail.receivedMaterialLength,
          actualLength: detail.actualLength,
          cuttingRecordCount: detail.cuttingRecords.length,
        })),
        warehouseRecordIds: bindingWarehouseRows.map((record) => record.warehouseRecordId),
        warehouseRecords: bindingWarehouseRows,
        handoverRecordIds: bindingHandovers.map((record) => record.handoverRecordId),
        handoverRecords: bindingHandovers,
      },
    }, () => {
      assert.equal(finalBindingOrder.status, '已完成')
      assert.equal(finalBindingOrder.handedOverQty, finalBindingOrder.actualOutputQty)
      assert.equal(finalBindingOrder.actionRecords?.length, expectedActionCount)
      assert(finalBindingOrder.bindingDetails.every((detail) => detail.actualLength === detail.plannedBindingLength))
      assert(finalBindingOrder.bindingDetails.every((detail) => detail.cuttingRecords.length === 2))
      assert(bindingWarehouseRows.every((record) => record.workOrderId === order.bindingOrderId))
      assert.equal(bindingHandovers.length, 2)
    })
  } finally {
    restoreProcessWarehouseMutationState(bindingWarehouseSnapshot)
    restoreBindingProcessOrderStore(bindingSnapshot)
  }
}

const bindingWorkOrderIds = buildBindingProcessOrders().map((order) => order.bindingOrderId)
for (const [index, workOrderId] of bindingWorkOrderIds.entries()) {
  try {
    runBindingFullFlow(workOrderId, index)
  } catch (error) {
    recorder.check({
      caseId: `FLOW-BIND-01-${workOrderId}`,
      chainId: 'BIND-01',
      workOrderId,
      assertion: '该捆条加工单真实全链必须通过',
    }, () => { throw error })
  }
}

function installCleanLaceFixture(workOrderId: string, snapshot: LaceFactoryRuntimeState): void {
  const scenario = structuredClone(snapshot)
  const order = scenario.workOrders.find((item) => item.workOrderId === workOrderId)
  assert(order, `缺少待测试花边生产单 ${workOrderId}`)
  const reports = scenario.completionReports.filter((item) => item.workOrderId === workOrderId)
  const handovers = scenario.handovers.filter((item) => item.workOrderId === workOrderId)
  const receipts = scenario.receipts.filter((item) => item.workOrderId === workOrderId)
  const relatedIds = new Set([
    workOrderId,
    ...reports.map((item) => item.reportId),
    ...handovers.map((item) => item.handoverId),
    ...receipts.map((item) => item.receiptId),
  ])
  for (const actionId of [
    ...reports.map((item) => item.clientActionId),
    ...handovers.map((item) => item.clientActionId),
    ...receipts.map((item) => item.clientActionId),
  ]) scenario.actionIds.delete(actionId)
  scenario.completionReports = scenario.completionReports.filter((item) => item.workOrderId !== workOrderId)
  scenario.handovers = scenario.handovers.filter((item) => item.workOrderId !== workOrderId)
  scenario.receipts = scenario.receipts.filter((item) => item.workOrderId !== workOrderId)
  scenario.logs = scenario.logs.filter((log) => !relatedIds.has(log.objectId) && !relatedIds.has(log.relatedObjectId))
  order.status = '待接收'
  order.statusBeforeCancellation = undefined
  order.receivedAt = undefined
  order.completedAt = undefined
  order.cancelledAt = undefined
  restoreLaceFactoryRuntime(scenario)
}

function runLaceFullFlow(workOrderId: string, sequence: number): void {
  const laceSnapshot = captureLaceFactoryRuntime()
  try {
    const originalOrder = laceSnapshot.workOrders.find((item) => item.workOrderId === workOrderId)
    assert(originalOrder, `基线缺少花边生产单 ${workOrderId}`)
    installCleanLaceFixture(workOrderId, laceSnapshot)
    const order = getLaceProductionOrderView(workOrderId)
    assert(order, `重置后找不到花边生产单 ${workOrderId}`)
    const keyPrefix = `LACE-FLOW-${sequence}-${workOrderId}`
    confirmLaceProductionReceipt(order.workOrderId)
    assert.equal(getLaceProductionOrderView(order.workOrderId)?.status, '加工中')
    assert.throws(() => confirmLaceProductionReceipt(order.workOrderId), /不能确认接收/)
    const reportQtys = [roundQty(order.planQty * 0.25), roundQty(order.planQty * 0.35)]
    reportQtys.push(roundQty(order.planQty - reportQtys[0] - reportQtys[1]))
    const reports = reportQtys.map((qty, index) => createLaceCompletionReport({
      workOrderId: order.workOrderId,
      qty,
      reportedAt: `2026-08-${String(20 + sequence).padStart(2, '0')}T0${index + 1}:00:00+07:00`,
      note: `第 ${index + 1} 次加工填报`,
      clientActionId: `${keyPrefix}-REPORT-${index + 1}`,
    }))
    const replay = createLaceCompletionReport({
      workOrderId: order.workOrderId,
      qty: reportQtys[0],
      reportedAt: `2026-08-${String(20 + sequence).padStart(2, '0')}T01:00:00+07:00`,
      note: '幂等重放',
      clientActionId: `${keyPrefix}-REPORT-1`,
    })
    assert.equal(replay.reportId, reports[0].reportId)
    assert.equal(listLaceCompletionReports(order.workOrderId).length, 3)
    completeLaceProduction(order.workOrderId, '三批加工填报合计达到计划')
    undoLaceProductionCompletion(order.workOrderId, '验证撤销完成后保留三批填报', LACE_FACTORY_SUPERVISOR)
    assert.equal(listLaceCompletionReports(order.workOrderId).length, 3)
    completeLaceProduction(order.workOrderId, '撤销验证后重新完成')

    const [handoverQty1, handoverQty2] = splitQty(order.planQty, false)
    const handover1 = createLaceHandover({
      workOrderId: order.workOrderId,
      qty: handoverQty1,
      deliveryNo: `DEL-LACE-${sequence}-01`,
      packageCount: 2,
      packageNote: '第一批花边',
      expectedReceiverName: '中央辅料仓管',
      handedOverAt: `2026-08-${String(20 + sequence).padStart(2, '0')}T08:00:00+07:00`,
      clientActionId: `${keyPrefix}-HANDOVER-1`,
    })
    const handover2 = createLaceHandover({
      workOrderId: order.workOrderId,
      qty: handoverQty2,
      deliveryNo: `DEL-LACE-${sequence}-02`,
      packageCount: 3,
      packageNote: '第二批花边',
      expectedReceiverName: '中央辅料仓管',
      handedOverAt: `2026-08-${String(20 + sequence).padStart(2, '0')}T09:00:00+07:00`,
      clientActionId: `${keyPrefix}-HANDOVER-2`,
    })
    const firstActual = roundQty(Math.max(handoverQty1 - 1, 0))
    confirmLaceReceipt({
      handoverId: handover1.handoverId,
      actualQty: firstActual,
      differenceReason: `第一批短收 1 ${order.unit}`,
      evidence: `${keyPrefix}-PHOTO-01`,
      warehouseLocation: '中央辅料仓-LACE-A01',
      receivedAt: `2026-08-${String(20 + sequence).padStart(2, '0')}T10:00:00+07:00`,
      clientActionId: `${keyPrefix}-RECEIPT-1`,
      actor: WLS_ACCESSORY_CLERK,
    })
    confirmLaceReceipt({
      handoverId: handover2.handoverId,
      actualQty: handoverQty2,
      differenceReason: '',
      evidence: `${keyPrefix}-PHOTO-02`,
      warehouseLocation: '中央辅料仓-LACE-A01',
      receivedAt: `2026-08-${String(20 + sequence).padStart(2, '0')}T11:00:00+07:00`,
      clientActionId: `${keyPrefix}-RECEIPT-2`,
      actor: WLS_ACCESSORY_CLERK,
    })
    const final = getLaceProductionOrderView(order.workOrderId)
    const finalReports = listLaceCompletionReports(order.workOrderId)
    const finalHandovers = listLaceHandovers(order.workOrderId)
    const finalReceipts = listLaceReceipts(order.workOrderId)
    const operationLogs = listLaceOperationLogs({ workOrderId: order.workOrderId })
    const receivedTotal = roundQty(firstActual + handoverQty2)
    recorder.check({
      caseId: `FLOW-ACC-LACE-01-${order.workOrderId}`,
      chainId: 'ACC-LACE-01',
      workOrderId: order.workOrderId,
      workOrderNo: order.workOrderNo,
      assertion: '该花边生产单执行确认接收、三次填报、完成/撤销、两批交出、两批 WLS 实收与 PMS 回写',
      evidence: {
        originalStatus: originalOrder.status,
        testStartStatus: '待接收',
        reports: finalReports,
        handovers: finalHandovers,
        receipts: finalReceipts,
        operationLogs,
        finalState: final,
        purchaseReceivedQty: getPurchaseSkuReceivedQty(order.purchaseOrderId, order.skuId),
      },
    }, () => {
      assert.equal(final?.status, '已完结')
      assert.equal(final?.completedQty, order.planQty)
      assert.equal(final?.handedOverQty, order.planQty)
      assert.equal(final?.receivedQty, receivedTotal)
      assert.equal(getPurchaseSkuReceivedQty(order.purchaseOrderId, order.skuId), receivedTotal)
      assert.equal(finalReports.length, 3)
      assert.equal(finalHandovers.length, 2)
      assert.equal(finalReceipts.length, 2)
      assert.equal(operationLogs.filter((log) => log.action === '确认接收').length, 1)
      assert(operationLogs.some((log) => log.action === '撤销完成'))
    })
  } finally {
    restoreLaceFactoryRuntime(laceSnapshot)
  }
}

resetLaceFactoryRuntime()
syncLaceProductionOrders()
const laceWorkOrderIds = listLaceProductionOrders().map((order) => order.workOrderId)
for (const [index, workOrderId] of laceWorkOrderIds.entries()) {
  try {
    runLaceFullFlow(workOrderId, index)
  } catch (error) {
    recorder.check({
      caseId: `FLOW-ACC-LACE-01-${workOrderId}`,
      chainId: 'ACC-LACE-01',
      workOrderId,
      assertion: '该花边生产单 Web/WLS/PMS 真实全链必须通过',
    }, () => { throw error })
  }
}

recorder.finish({
  chainCount: AUX_SPECIAL_ACCESSORY_CHAINS.length,
  workOrderCount: specialWorkOrders.length + bindingWorkOrderIds.length + laceWorkOrderIds.length,
  specialCraftWorkOrderCount: specialWorkOrders.length,
  bindingWorkOrderCount: bindingWorkOrderIds.length,
  laceWorkOrderCount: laceWorkOrderIds.length,
  flowRule: '范围内每张加工单逐单调用真实领域动作；辅助/特殊工艺与捆条执行多批接收、多批填报、多批交出和完成，花边执行接收、三批填报、两批交出、完成及 WLS/PMS 回写',
})
