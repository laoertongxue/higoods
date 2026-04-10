import assert from 'node:assert/strict'
import {
  approveSampleApplicationRequest,
  checkoutSampleApplicationRequest,
  confirmSampleApplicationReturn,
  requestSampleApplicationReturn,
} from '../src/pages/pcs-sample-application.ts'
import { listSampleLedgerEvents } from '../src/data/pcs-sample-ledger-repository.ts'
import { clearProjectRelationStore } from '../src/data/pcs-project-relation-repository.ts'
import { listProjectNodes, listProjects } from '../src/data/pcs-project-repository.ts'

clearProjectRelationStore()

assert.equal(approveSampleApplicationRequest('app_seed_002'), true, '样衣使用申请审批通过应成功')
const reserveEvent = listSampleLedgerEvents().find(
  (item) => item.sourceDocId === 'app_seed_002' && item.eventType === 'RESERVE_LOCK',
)
assert.ok(reserveEvent, '样衣使用申请审批通过后应生成预占锁定事件')

assert.equal(checkoutSampleApplicationRequest('app_seed_003'), true, '样衣使用申请完成领用应成功')
const checkoutEvent = listSampleLedgerEvents().find(
  (item) => item.sourceDocId === 'app_seed_003' && item.eventType === 'CHECKOUT_BORROW',
)
assert.ok(checkoutEvent, '样衣使用申请完成领用后应生成领用出库事件')

const liveTestProject = listProjects()[0]
const liveTestNodeBeforeReturn = listProjectNodes(liveTestProject.projectId).find((item) => item.workItemTypeCode === 'LIVE_TEST')
assert.ok(liveTestNodeBeforeReturn, '样衣使用申请种子应绑定正式 LIVE_TEST 节点')

assert.equal(requestSampleApplicationReturn('app_seed_001'), true, '使用中的样衣申请应允许发起归还')
assert.equal(confirmSampleApplicationReturn('app_seed_001'), true, '归还中的样衣申请应允许确认归还入库')
const returnEvent = listSampleLedgerEvents().find(
  (item) => item.sourceDocId === 'app_seed_001' && item.eventType === 'RETURN_CHECKIN',
)
assert.ok(returnEvent, '样衣使用申请完成归还后应生成归还入库事件')

const liveTestNode = listProjectNodes(returnEvent!.projectId).find((item) => item.projectNodeId === returnEvent!.projectNodeId)
assert.ok(liveTestNode, '归还入库事件应能定位到正式项目节点')
assert.equal(
  liveTestNode!.currentStatus,
  liveTestNodeBeforeReturn!.currentStatus,
  'LIVE_TEST、VIDEO_TEST、SAMPLE_SHOOT_FIT、PATTERN_TASK 不会因为样衣归还自动变更节点完成状态',
)
assert.equal(liveTestNode!.latestResultType, '样衣已归还入库', '归还入库后应回写最近结果类型')

console.log('pcs-sample-application-writeback.spec.ts PASS')
