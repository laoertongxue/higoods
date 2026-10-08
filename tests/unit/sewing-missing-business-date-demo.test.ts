import assert from 'node:assert/strict'
import test from 'node:test'
import { getRuntimeTaskById, isRuntimeIndependentSewingTask } from '../../src/data/fcs/runtime-process-tasks.ts'
import { productionOrders } from '../../src/data/fcs/production-orders.ts'
import { getSewingDeliverySlaView } from '../../src/data/fcs/sewing-delivery-sla-view.ts'
import { listSewingDeliveryReceiptFacts } from '../../src/data/fcs/sewing-delivery-receipt-facts.ts'
import { getMobileTaskAccessResult, getPdaMobileExecutionTaskById } from '../../src/data/fcs/process-mobile-task-binding.ts'
import { createPdaSessionFromUser, listFactoryPdaUsers, setPdaSession } from '../../src/data/fcs/store-domain-pda.ts'
import { renderPdaExecDetailPage } from '../../src/pages/pda-exec-detail.ts'
import { renderProgressBoardPage } from '../../src/pages/progress-board/core.ts'
import { getTaskPickupSummary } from '../../src/pages/progress-board/context.ts'
import { listHandoverOrdersByTaskId } from '../../src/data/fcs/pda-handover-events.ts'
import { appStore } from '../../src/state/store.ts'

const TASK_ID = 'TASKGEN-202603-0007-002__ORDER'
const KNOWN_DATE_TASK_ID = 'TASKGEN-202603-0015-002__ORDER'
const FACTORY_ID = 'ID-F021'
const NOW_AT = '2026-10-08 09:00:00'
const PENDING_MESSAGE = '业务分配日期待核实，回货时效暂不能判定'

test('CONTRACT-005: native legacy task fixture exposes the actual missing allocation date at PDA and progress board entries', () => {
  const task = getRuntimeTaskById(TASK_ID)
  assert.ok(task)
  assert.ok(isRuntimeIndependentSewingTask(task))
  assert.equal(task.productionOrderId, 'PO-202603-0007')
  assert.equal(task.businessAssignedAt, undefined)
  assert.equal(task.taskDeadline, undefined, 'A missing-date demonstration must not inherit a previous assignment deadline')
  assert.equal(task.assignmentOperatedAt, '2026-10-07 10:00:00')
  assert.equal(task.acceptedAt, '2026-10-07 10:15:00')
  assert.equal(task.status, 'NOT_STARTED')
  assert.equal(task.qty, 800, '800 is the allocation quantity, not a synthesized factory pickup')
  assert.match(task.dispatchRemark!, /尚未领料.*不代表工厂实领量/)
  assert.equal(productionOrders.find(order => order.productionOrderId === task.productionOrderId)?.mainFactoryId, FACTORY_ID)
  const mobileTask = getPdaMobileExecutionTaskById(TASK_ID)
  assert.ok(mobileTask, 'Actual native PDA lookup must resolve this fixture without constructing a test-only view')
  assert.equal(mobileTask.taskId, task.taskId)
  assert.equal(getMobileTaskAccessResult(mobileTask, FACTORY_ID).canExecuteInMobile, true)
  assert.equal(getMobileTaskAccessResult(mobileTask, 'ID-F009').canExecuteInMobile, false)
  const pickup = getTaskPickupSummary(TASK_ID)
  assert.equal(pickup.pickupRecords.length, 0, 'The fixture has no factory pickup record')
  assert.deepEqual(listSewingDeliveryReceiptFacts(TASK_ID, NOW_AT), [], 'The fixture has no formal downstream receipt')
  assert.ok(listHandoverOrdersByTaskId(TASK_ID).every(head => head.submittedQtyTotal === 0),
    'An unstarted planned return document must not fabricate an actual factory handout')

  const view = getSewingDeliverySlaView(TASK_ID, NOW_AT)
  assert.ok(view, 'Actual native task must resolve its static contractual snapshot')
  assert.equal(view.projection.snapshot.slaKind, 'INDEPENDENT_SEWING')
  assert.equal(view.projection.snapshot.timingStatus, 'PENDING_BUSINESS_ASSIGNMENT')
  assert.equal(view.projection.snapshot.acceptedAt, task.acceptedAt)
  assert.deepEqual(view.projection.milestones, [])
  assert.equal(view.projection.completed, false)

  const admin = listFactoryPdaUsers(FACTORY_ID).find(user => user.roleId === 'ROLE_ADMIN')
  assert.ok(admin)
  setPdaSession(createPdaSessionFromUser(admin))
  appStore.navigate(`/fcs/pda/exec/${TASK_ID}`)
  const pdaHtml = renderPdaExecDetailPage(TASK_ID)
  assert.match(pdaHtml, /data-pda-sewing-delivery-progress="true"/)
  assert.ok(pdaHtml.includes(PENDING_MESSAGE))
  const deliveryCard = pdaHtml.match(/<article[^>]+data-pda-sewing-delivery-progress="true"[\s\S]*?<\/article>/)?.[0]
  assert.ok(deliveryCard)
  assert.doesNotMatch(deliveryCard, /全部节点已完成|已完成全部节点|0 小时/)
  assert.match(deliveryCard, /下一节点[\s\S]*?待核实[\s\S]*?剩余时间[\s\S]*?待核实/)

  appStore.navigate(`/fcs/progress/board?taskId=${TASK_ID}`)
  const boardHtml = renderProgressBoardPage()
  assert.ok(boardHtml.includes(TASK_ID))
  assert.ok(boardHtml.includes(PENDING_MESSAGE))
  assert.doesNotMatch(boardHtml, /已完成全部节点/)

  const knownDateView = getSewingDeliverySlaView(KNOWN_DATE_TASK_ID, NOW_AT)
  assert.ok(knownDateView)
  assert.equal(knownDateView.projection.snapshot.timingStatus, 'CONFIRMED')
  assert.equal(knownDateView.projection.snapshot.businessAssignedAt, '2026-07-01 09:00:00')
  assert.deepEqual(knownDateView.projection.milestones.map(node => node.deadlineAt), [
    '2026-07-04 23:59:59', '2026-07-08 23:59:59', '2026-07-09 23:59:59',
  ], 'Known allocation dates retain their original day 4 / 8 / 9 contractual deadlines')
})
