#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { readWoolStore } from '../src/data/fcs/wool-domain/store.ts'
import { listProcessActionDefinitions } from '../src/data/fcs/process-action-writeback-service.ts'
import { listSpecialCraftTaskOrders } from '../src/data/fcs/special-craft-task-orders.ts'
import { buildSpecialCraftOperationSlug } from '../src/data/fcs/special-craft-operations.ts'
import { renderPdaWorkOrderExecDetailPage } from '../src/pages/pda-exec-detail.ts'
import { renderSpecialCraftTaskDetailPage } from '../src/pages/process-factory/special-craft/task-detail.ts'
import { buildBindingProcessOrders } from '../src/pages/process-factory/cutting/binding-strip-orders.ts'
import { renderCraftCuttingSpecialProcessDetailPage } from '../src/pages/process-factory/cutting/special-processes.ts'
import { listLaceProductionOrders, resetLaceFactoryRuntime, syncLaceProductionOrders } from '../src/data/fcs/lace-factory-domain.ts'
import { renderLaceWorkOrderDetailPage } from '../src/pages/process-factory/accessory/lace/work-order-detail.ts'
import { AUX_SPECIAL_ACCESSORY_CHAINS, VerificationRecorder } from './aux-special-accessory-test-catalog.ts'

const recorder = new VerificationRecorder('scope-boundary')
const forbiddenVisibleTerms = ['开工凭证', '关键节点上报', '补报关键节点', '查看开工和节点', '节点记录', '完成任务']
const allowedActionCodes = new Set([
  'SPECIAL_CRAFT_CONFIRM_RECEIVE',
  'SPECIAL_CRAFT_PROCESS_REPORT',
  'SPECIAL_CRAFT_SUBMIT_HANDOVER',
  'SPECIAL_CRAFT_COMPLETE_ORDER',
])

recorder.check({ caseId: 'SCOPE-CATALOG-001', chainId: 'ALL', assertion: '范围目录必须包含16类工艺及捆条／花边，共18条链' }, () => {
  assert.equal(AUX_SPECIAL_ACCESSORY_CHAINS.length, 18)
  assert.equal(new Set(AUX_SPECIAL_ACCESSORY_CHAINS.map((chain) => chain.id)).size, 18)
  assert.equal(AUX_SPECIAL_ACCESSORY_CHAINS.filter((chain) => chain.kind === 'SPECIAL_CRAFT').length, 16)
})

const actionDefinitions = listProcessActionDefinitions('SPECIAL_CRAFT')
recorder.check({ caseId: 'SCOPE-ACTIONS-001', chainId: 'ALL-SPECIAL', assertion: '辅助/特殊工艺只能注册四个加工单动作' }, () => {
  assert.deepEqual(new Set(actionDefinitions.map((action) => action.actionCode)), allowedActionCodes)
  assert.deepEqual(new Set(actionDefinitions.map((action) => action.actionLabel)), new Set(['确认接收', '加工填报', '发起交出', '完成加工单']))
})

for (const order of listSpecialCraftTaskOrders()) {
  const chain = AUX_SPECIAL_ACCESSORY_CHAINS.find((item) => item.operationId === order.operationId)
  const web = renderSpecialCraftTaskDetailPage(buildSpecialCraftOperationSlug(order.operationId), order.taskOrderId)
  const pda = renderPdaWorkOrderExecDetailPage('SPECIAL_CRAFT', order.taskOrderId)
  recorder.check({
    caseId: `SCOPE-WO-${order.taskOrderId}`,
    chainId: chain?.id || order.operationId,
    workOrderId: order.taskOrderId,
    workOrderNo: order.taskOrderNo,
    assertion: 'Web/PDA 可展示通用关系卡片的任务明细，但不出现任务开工、关键节点或手工完成任务',
  }, () => {
    for (const token of forbiddenVisibleTerms) {
      assert(!web.includes(token), `Web 出现禁用文案：${token}`)
      assert(!pda.includes(token), `PDA 出现禁用文案：${token}`)
    }
    assert(pda.includes(order.taskOrderNo), 'PDA 必须以具体加工单号为主信息')
    assert(pda.includes(order.sourceTaskNo || order.sourceTaskId || ''), 'PDA 基本信息必须保留来源任务号')
    assert(web.includes(order.taskOrderNo), 'Web 必须以具体加工单号为主信息')
    assert(order.sourceTaskNo, '加工单必须有可识别的业务来源任务号')
    assert(web.includes(order.sourceTaskNo), 'Web 基本信息必须保留业务来源任务号')
    assert.equal(order.factoryId, chain?.factoryId, '工艺执行厂必须是固定专属厂')
    if (order.woolPieceKey) {
      const sourceOrder = readWoolStore().workOrders[order.woolOrderId || '']
      const piece = sourceOrder?.externalPieces.find((item) => item.pieceKey === order.woolPieceKey)
      const node = piece?.routeNodes.find((item) => item.sourceEntryId === order.woolRouteNodeId)
      assert(sourceOrder && piece && node, '毛织片必须回到实际毛织单、物理片与工艺路线节点')
      assert.equal(order.sourceTaskId, sourceOrder.sourceTaskId)
      assert.equal(order.sourceTaskNo, sourceOrder.taskNo)
      assert.equal(order.craftCode, node.craftCode)
      assert.equal(order.factoryId, node.factoryId)
      assert.notEqual(order.generationSource, 'PRODUCTION_ORDER', '毛织路线投影不能伪造普通生产单生成来源')
      assert.equal(order.feiTicketNos.length, 0, '毛织片不能伪造裁片菲票')
    } else {
      assert.equal(order.generationSource, 'PRODUCTION_ORDER')
      assert(order.assignmentStatus, '普通生产单加工单必须有真实派工状态')
    }
  })
}

for (const order of buildBindingProcessOrders()) {
  const web = renderCraftCuttingSpecialProcessDetailPage(order.bindingOrderId)
  const pda = renderPdaWorkOrderExecDetailPage('BINDING_PROCESS_ORDER', order.bindingOrderId)
  recorder.check({
    caseId: `SCOPE-BIND-${order.bindingOrderId}`,
    chainId: 'BIND-01',
    workOrderId: order.bindingOrderId,
    workOrderNo: order.bindingOrderNo,
    assertion: '捆条 Web/PDA 可展示通用关系卡片，只保留加工单四动作且无任务开工概念',
  }, () => {
    for (const token of forbiddenVisibleTerms) {
      assert(!web.includes(token), `捆条 Web 出现禁用文案：${token}`)
      assert(!pda.includes(token), `捆条 PDA 出现禁用文案：${token}`)
    }
    assert(['确认接收', '加工填报', '发起交出', '完成加工单'].some((action) => web.includes(action)))
    assert(pda.includes(order.bindingOrderNo))
  })
}

resetLaceFactoryRuntime()
syncLaceProductionOrders()
for (const order of listLaceProductionOrders()) {
  const web = renderLaceWorkOrderDetailPage(order.workOrderId)
  recorder.check({
    caseId: `SCOPE-LACE-${order.workOrderId}`,
    chainId: 'ACC-LACE-01',
    workOrderId: order.workOrderId,
    workOrderNo: order.workOrderNo,
    assertion: '花边 Web 使用接收语义且无 PDA/打印/任务动作',
  }, () => {
    for (const token of forbiddenVisibleTerms) assert(!web.includes(token), `花边 Web 出现禁用文案：${token}`)
    assert(web.includes('确认接收') || order.status !== '待接收')
  })
}

const pdaExecSource = readFileSync('src/pages/pda-exec-detail.ts', 'utf8')
const routeSource = readFileSync('src/router/routes-pda.ts', 'utf8')
const bindingPageSource = readFileSync('src/pages/process-factory/cutting/special-processes.ts', 'utf8')
const printSource = readFileSync('src/data/fcs/printing-task-domain.ts', 'utf8')
const dyeSource = readFileSync('src/data/fcs/dyeing-task-domain.ts', 'utf8')
recorder.check({ caseId: 'SCOPE-BIND-ACTIONS-001', chainId: 'BIND-01', assertion: '捆条页面完整实现四个状态相关加工单动作' }, () => {
  for (const action of ['确认接收', '加工填报', '发起交出', '完成加工单']) assert(bindingPageSource.includes(action))
})
recorder.check({ caseId: 'SCOPE-REGRESSION-001', chainId: 'TREG-001', assertion: '三方车缝的开工/节点能力仍保留' }, () => {
  assert(pdaExecSource.includes('关键节点上报'))
  assert(pdaExecSource.includes('开工凭证'))
  assert(pdaExecSource.includes("action === 'finish-task'"))
})
recorder.check({ caseId: 'SCOPE-REGRESSION-002', chainId: 'TREG-001', assertion: '印花与染色专用链仍保留自身节点且未并入四动作' }, () => {
  assert(printSource.includes('startedAt'))
  assert(dyeSource.includes('startedAt'))
  assert(listProcessActionDefinitions('PRINT').length > 4)
  assert(listProcessActionDefinitions('DYE').length > 4)
})
recorder.check({ caseId: 'SCOPE-LACE-ROUTE-001', chainId: 'ACC-LACE-01', assertion: '花边保持 Web-only，无 PDA 路由' }, () => {
  assert(!routeSource.includes('LACE_PRODUCTION_ORDER'))
  assert(!routeSource.includes('/lace/'))
})

recorder.finish({ chainCount: AUX_SPECIAL_ACCESSORY_CHAINS.length })
