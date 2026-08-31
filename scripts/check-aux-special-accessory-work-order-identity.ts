#!/usr/bin/env node

import assert from 'node:assert/strict'

import {
  getSpecialCraftTaskOrderById,
  listSpecialCraftTaskOrders,
} from '../src/data/fcs/special-craft-task-orders.ts'
import { getSpecialCraftPdaCandidateByWorkOrderId } from '../src/data/fcs/special-craft-pda-scan.ts'
import { renderPdaWorkOrderExecDetailPage } from '../src/pages/pda-exec-detail.ts'
import {
  buildSpecialCraftOperationSlug,
  buildSpecialCraftTaskDetailPath,
} from '../src/data/fcs/special-craft-operations.ts'
import { renderSpecialCraftWorkOrderDetailPage } from '../src/pages/process-factory/special-craft/work-order-detail.ts'
import {
  buildBindingProcessOrders,
  getBindingProcessOrderById,
} from '../src/pages/process-factory/cutting/binding-strip-orders.ts'
import { renderCraftCuttingSpecialProcessDetailPage } from '../src/pages/process-factory/cutting/special-processes.ts'
import { getBindingProcessPdaCandidateByWorkOrderId } from '../src/data/fcs/binding-process-pda-scan.ts'
import {
  listLaceProductionOrders,
  resetLaceFactoryRuntime,
  syncLaceProductionOrders,
} from '../src/data/fcs/lace-factory-domain.ts'
import { renderLaceWorkOrderDetailPage } from '../src/pages/process-factory/accessory/lace/work-order-detail.ts'
import {
  AUX_SPECIAL_ACCESSORY_CHAINS,
  VerificationRecorder,
  getChainByOperationId,
} from './aux-special-accessory-test-catalog.ts'

const recorder = new VerificationRecorder('work-order-identity')
const specialOrders = listSpecialCraftTaskOrders()
const bindingOrders = buildBindingProcessOrders()
resetLaceFactoryRuntime()
syncLaceProductionOrders()
const laceOrders = listLaceProductionOrders()

function assertUnique(values: string[], label: string): void {
  assert.equal(new Set(values).size, values.length, `${label}存在重复值`)
  assert(values.every((value) => value.trim().length > 0), `${label}存在空值`)
}

assertUnique(specialOrders.map((order) => order.taskOrderId), '辅助/特殊工艺加工单 ID')
assertUnique(specialOrders.map((order) => order.taskOrderNo), '辅助/特殊工艺加工单号')
assertUnique(bindingOrders.map((order) => order.bindingOrderId), '捆条加工单 ID')
assertUnique(bindingOrders.map((order) => order.bindingOrderNo), '捆条加工单号')
assertUnique(laceOrders.map((order) => order.workOrderId), '花边生产单 ID')
assertUnique(laceOrders.map((order) => order.workOrderNo), '花边生产单号')

for (const order of specialOrders) {
  const chain = getChainByOperationId(order.operationId)
  assert(chain, `未登记工艺 ${order.operationId}`)
  const base = {
    chainId: chain.id,
    workOrderId: order.taskOrderId,
    workOrderNo: order.taskOrderNo,
  }
  recorder.check({
    ...base,
    caseId: `WO-ID-SPECIAL-${order.taskOrderId}`,
    assertion: '数据 1/3：具体加工单 ID 精确唯一，错误 ID 不得按任务或列表第一张兜底',
    evidence: { sourceTaskId: order.sourceTaskId, sourceTaskNo: order.sourceTaskNo },
  }, () => {
    const exact = getSpecialCraftTaskOrderById(order.taskOrderId)
    assert.equal(exact?.taskOrderId, order.taskOrderId)
    assert.equal(exact?.taskOrderNo, order.taskOrderNo)
    assert.equal(getSpecialCraftTaskOrderById(`${order.taskOrderId}:INVALID`), undefined)
    assert(order.sourceTaskId && order.sourceTaskNo, '加工单必须保留来源任务身份')
    assert.notEqual(order.sourceTaskId, order.taskOrderId, '任务 ID 与加工单 ID 不得混用')
  })

  recorder.check({
    ...base,
    caseId: `WO-PDA-SPECIAL-${order.taskOrderId}`,
    assertion: '数据 2/3：Web/PDA 候选、路由、DOM 与详情始终保留具体 workOrderId，并展示来源任务',
    evidence: {
      webRoute: buildSpecialCraftTaskDetailPath(order.operationId, order.taskOrderId),
      pdaRoute: `/fcs/pda/exec/SPECIAL_CRAFT/${order.taskOrderId}`,
    },
  }, () => {
    const candidate = getSpecialCraftPdaCandidateByWorkOrderId(order.taskOrderId)
    assert.equal(candidate?.workOrderId, order.taskOrderId)
    assert.equal(candidate?.workOrderNo, order.taskOrderNo)
    assert.equal(candidate?.sourceTaskId, order.sourceTaskId)
    const html = renderPdaWorkOrderExecDetailPage('SPECIAL_CRAFT', order.taskOrderId)
    assert(html.includes(order.taskOrderNo), 'PDA 详情必须显示加工单号')
    assert(html.includes(order.sourceTaskNo || order.sourceTaskId || ''), 'PDA 详情必须显示来源任务')
    assert(!renderPdaWorkOrderExecDetailPage('SPECIAL_CRAFT', `${order.taskOrderId}:INVALID`).includes(order.taskOrderNo))
    const webRoute = buildSpecialCraftTaskDetailPath(order.operationId, order.taskOrderId)
    assert(webRoute.includes('/work-orders/'), 'Web 加工单必须使用 work-orders 执行路由')
    assert(webRoute.endsWith(encodeURIComponent(order.taskOrderId)), 'Web 路由必须保留完整 workOrderId')
    const webHtml = renderSpecialCraftWorkOrderDetailPage(buildSpecialCraftOperationSlug(order.operationId), order.taskOrderId)
    assert(webHtml.includes(order.taskOrderNo), 'Web 详情必须显示加工单号')
    assert(webHtml.includes(order.taskOrderId), 'Web 详情 DOM 必须保留加工单 ID')
    assert(webHtml.includes(order.sourceTaskId || ''), 'Web 基本信息必须显示来源任务 ID')
    if (order.status !== '已完结') {
      assert(webHtml.includes(`data-source-id="${order.taskOrderId}"`), 'Web 可执行动作载荷必须使用具体 workOrderId')
    }
    assert(!renderSpecialCraftWorkOrderDetailPage(buildSpecialCraftOperationSlug(order.operationId), `${order.taskOrderId}:INVALID`).includes(order.taskOrderNo))
  })

  recorder.check({
    ...base,
    caseId: `WO-OBJECT-SPECIAL-${order.taskOrderId}`,
    assertion: '数据 3/3：加工对象、输入输出单位、工厂、需求与去向均符合该工艺合同',
    evidence: {
      operationId: order.operationId,
      targetObject: order.targetObject,
      inputUnit: order.inputUnit,
      outputUnit: order.outputUnit || order.unit,
      factoryId: order.factoryId,
      receiverWarehouseName: order.receiverWarehouseName,
    },
  }, () => {
    assert.equal(order.targetObject, chain.expectedTargetObject)
    assert.equal(order.factoryId, chain.factoryId)
    assert.equal(order.outputUnit || order.unit, chain.outputUnit)
    if (chain.inputUnit === 'BOM单位') {
      assert(order.inputUnit && order.inputUnit !== '片', '橡筋投入必须使用辅料 BOM 单位，不能投影为裁片')
    } else {
      assert.equal(order.inputUnit || order.unit, chain.inputUnit)
    }
    assert(order.planQty > 0, '计划数量必须大于 0')
    assert((order.demandLines?.length || 0) > 0 || order.operationId === 'AUX-OP-BUTTON-LOOP', '必须有正式需求明细')
    assert(order.productionOrderId && order.productionOrderNo, '必须保留来源生产单')
    assert(order.receiverWarehouseName, '必须明确加工后去向仓库')
  })
}

for (const order of bindingOrders) {
  const base = {
    chainId: 'BIND-01',
    workOrderId: order.bindingOrderId,
    workOrderNo: order.bindingOrderNo,
  }
  recorder.check({
    ...base,
    caseId: `WO-ID-BIND-${order.bindingOrderId}`,
    assertion: '数据 1/3：捆条加工单 ID 精确唯一，错误 ID 不得返回同任务下其他加工单',
    evidence: { sourceTaskId: order.sourceTaskId, sourceCutOrderId: order.sourceCutOrderId },
  }, () => {
    const exact = getBindingProcessOrderById(order.bindingOrderId)
    assert.equal(exact?.bindingOrderId, order.bindingOrderId)
    assert.equal(exact?.bindingOrderNo, order.bindingOrderNo)
    assert.equal(getBindingProcessOrderById(`${order.bindingOrderId}:INVALID`), null)
    assert(order.sourceTaskId && order.sourceTaskNo, '捆条加工单必须明确来源任务')
    assert.notEqual(order.sourceTaskId, order.bindingOrderId)
  })

  recorder.check({
    ...base,
    caseId: `WO-PDA-BIND-${order.bindingOrderId}`,
    assertion: '数据 2/3：捆条 Web/PDA 候选、路由和详情精确保留当前加工单',
    evidence: {
      webRoute: `/fcs/craft/cutting/special-processes/${order.bindingOrderId}`,
      pdaRoute: `/fcs/pda/exec/BINDING_PROCESS_ORDER/${order.bindingOrderId}`,
    },
  }, () => {
    const candidate = getBindingProcessPdaCandidateByWorkOrderId(order.bindingOrderId)
    assert.equal(candidate?.workOrderId, order.bindingOrderId)
    assert.equal(candidate?.workOrderNo, order.bindingOrderNo)
    assert.equal(candidate?.sourceTaskId, order.sourceTaskId)
    const html = renderPdaWorkOrderExecDetailPage('BINDING_PROCESS_ORDER', order.bindingOrderId)
    assert(html.includes(order.bindingOrderNo), '捆条 PDA 详情必须显示加工单号')
    assert(html.includes(order.sourceTaskNo), '捆条 PDA 详情必须显示来源任务')
    assert(!renderPdaWorkOrderExecDetailPage('BINDING_PROCESS_ORDER', `${order.bindingOrderId}:INVALID`).includes(order.bindingOrderNo))
    const webHtml = renderCraftCuttingSpecialProcessDetailPage(order.bindingOrderId)
    assert(webHtml.includes(order.bindingOrderNo), '捆条 Web 详情必须显示加工单号')
    assert(webHtml.includes(order.sourceTaskId), '捆条 Web 基本信息必须显示来源任务 ID')
    assert(!renderCraftCuttingSpecialProcessDetailPage(`${order.bindingOrderId}:INVALID`).includes(order.bindingOrderNo))
  })

  recorder.check({
    ...base,
    caseId: `WO-OBJECT-BIND-${order.bindingOrderId}`,
    assertion: '数据 3/3：捆条投入、产出、规格菲票、工厂与来源对象保持加工单级事实',
    evidence: {
      sourceTaskId: order.sourceTaskId,
      sourceCutOrderId: order.sourceCutOrderId,
      specificationCount: order.bindingDetails.length,
      unit: order.unit,
      factoryId: order.factoryId,
    },
  }, () => {
    assert.equal(order.unit, '米')
    assert(order.factoryId && order.factoryName)
    assert(order.sourceCutOrderId && order.sourceCutOrderNo)
    assert(order.sourceProductionOrderId && order.sourceProductionOrderNo)
    assert(order.plannedOutputQty > 0 && order.requiredMaterialLength > 0)
    assert(order.bindingDetails.length > 0)
    assertUnique(order.bindingDetails.map((detail) => detail.detailId), `捆条明细 ${order.bindingOrderNo}`)
    assertUnique(order.sourceFeiTicketNos, `捆条菲票 ${order.bindingOrderNo}`)
    assert(order.bindingDetails.every((detail) => detail.plannedBindingLength > 0 && detail.feiTicketNo))
  })
}

for (const order of laceOrders) {
  const base = {
    chainId: 'ACC-LACE-01',
    workOrderId: order.workOrderId,
    workOrderNo: order.workOrderNo,
  }
  recorder.check({
    ...base,
    caseId: `WO-ID-LACE-${order.workOrderId}`,
    assertion: '数据 1/3：花边生产单以采购单 SKU 唯一生成并由 workOrderId 精确定位',
    evidence: { generationKey: order.generationKey, purchaseOrderId: order.purchaseOrderId, skuId: order.skuId },
  }, () => {
    const exact = laceOrders.find((item) => item.workOrderId === order.workOrderId)
    assert.equal(exact?.workOrderNo, order.workOrderNo)
    assert.equal(laceOrders.find((item) => item.workOrderId === `${order.workOrderId}:INVALID`), undefined)
    assert(order.generationKey.includes(order.purchaseOrderId))
    assert(order.generationKey.includes(order.skuId))
  })

  recorder.check({
    ...base,
    caseId: `WO-WEB-LACE-${order.workOrderId}`,
    assertion: '数据 2/3：花边保持 Web-only，详情按具体 workOrderId 展示且不存在错误兜底',
    evidence: { route: `/fcs/craft/accessory/lace/work-orders/${order.workOrderId}`, pda: '不适用' },
  }, () => {
    const html = renderLaceWorkOrderDetailPage(order.workOrderId)
    assert(html.includes(order.workOrderNo))
    assert(html.includes(order.purchaseOrderNo))
    assert(!renderLaceWorkOrderDetailPage(`${order.workOrderId}:INVALID`).includes(order.workOrderNo))
  })

  recorder.check({
    ...base,
    caseId: `WO-OBJECT-LACE-${order.workOrderId}`,
    assertion: '数据 3/3：花边需求来源、加工投入、产出、数量单位和中央辅料仓去向一致',
    evidence: {
      purchaseOrderId: order.purchaseOrderId,
      skuId: order.skuId,
      planQty: order.planQty,
      unit: order.unit,
      targetWarehouseId: order.targetWarehouseId,
    },
  }, () => {
    assert(order.purchaseOrderId && order.purchaseOrderNo)
    assert(order.sourceLineIds.length > 0 && order.sourceLines.length > 0)
    assert(order.inputLines.length > 0)
    assert.equal(order.processingOutput.skuId, order.skuId)
    assert.equal(order.processingOutput.planQty, order.planQty)
    assert.equal(order.processingOutput.unit, order.unit)
    assert(order.planQty > 0 && order.unit)
    assert(order.targetWarehouseId && order.targetWarehouseName.includes('辅料仓'))
  })
}

const expectedWorkOrderCount = specialOrders.length + bindingOrders.length + laceOrders.length
recorder.check({
  caseId: 'WO-COVERAGE-ALL',
  chainId: 'ALL',
  assertion: '19 条链均有业务数据，且每张加工单恰有至少 3 条独立数据验证',
  evidence: {
    specialOrderCount: specialOrders.length,
    bindingOrderCount: bindingOrders.length,
    laceOrderCount: laceOrders.length,
    expectedMinimumDataTests: expectedWorkOrderCount * 3,
  },
}, () => {
  const coveredChains = new Set(recorder.results.filter((result) => result.workOrderId).map((result) => result.chainId))
  assert.deepEqual(coveredChains, new Set(AUX_SPECIAL_ACCESSORY_CHAINS.map((chain) => chain.id)))
  for (const workOrderId of [...specialOrders.map((item) => item.taskOrderId), ...bindingOrders.map((item) => item.bindingOrderId), ...laceOrders.map((item) => item.workOrderId)]) {
    assert(recorder.results.filter((result) => result.workOrderId === workOrderId).length >= 3, `${workOrderId} 少于 3 条数据验证`)
  }
})

recorder.finish({
  chainCount: AUX_SPECIAL_ACCESSORY_CHAINS.length,
  workOrderCount: expectedWorkOrderCount,
  perWorkOrderDataTests: 3,
  minimumRequiredDataTests: expectedWorkOrderCount * 3,
})
