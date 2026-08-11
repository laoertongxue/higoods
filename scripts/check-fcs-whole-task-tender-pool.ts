import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { getFactoryMobileTodoActionRoute, getFactoryMobileTodos } from '../src/data/fcs/factory-mobile-todos.ts'
import {
  listPdaAwardedTenderNoticesByFactoryId,
  listPdaBiddingTendersByFactoryId,
  listPdaQuotedTendersByFactoryId,
} from '../src/data/fcs/pda-mobile-mock.ts'
import {
  cancelRuntimeTaskTenderRecord,
  captureRuntimeTaskTenderRecordStore,
  getRuntimeTaskTenderRecord,
  getRuntimeTaskTenderRecordByTenderId,
  listRuntimeTaskTenderRecords,
  markRuntimeTaskTenderAwarded,
  recordRuntimeTaskTenderQuote,
  resolveRuntimeTaskTenderStatus,
  restoreRuntimeTaskTenderRecordStore,
  upsertRuntimeTaskTenderRecord,
  type RuntimeTaskTenderRecord,
} from '../src/data/fcs/runtime-task-tenders.ts'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const storeSnapshot = captureRuntimeTaskTenderRecordStore()

function makeRecord(overrides: Partial<RuntimeTaskTenderRecord> = {}): RuntimeTaskTenderRecord {
  return {
    tenderId: 'TD-CHECK-WHOLE-TASK-001',
    taskId: 'TASK-CHECK-WHOLE-TASK-001',
    businessAssignedAt: '2099-08-11 09:00:00',
    assignmentOperatedAt: '2099-08-11 09:01:00',
    biddingDeadline: '2099-08-12 18:00:00',
    taskDeadline: '2099-08-20 18:00:00',
    poolMode: 'ALL_ELIGIBLE',
    taskSnapshot: {
      taskNo: 'TASKGEN-CHECK-WHOLE-TASK-001',
      productionOrderId: 'PO-CHECK-WHOLE-TASK-001',
      productionOrderNo: 'PO-CHECK-WHOLE-TASK-001',
      processName: '车缝',
      taskTypeLabel: '独立车缝任务',
      qty: 500,
      qtyUnit: '件',
      skuLines: [
        { skuCode: 'SKU-CHECK-BLACK-M', color: 'Black', size: 'M', qty: 220 },
        { skuCode: 'SKU-CHECK-BLACK-L', color: 'Black', size: 'L', qty: 280 },
      ],
    },
    factoryPool: [
      {
        factoryId: 'FAC-CHECK-POOL-A',
        factoryName: '验收竞价工厂 A',
        factoryCode: 'CHECK-A',
        factoryType: '车缝工厂',
        capabilitySummary: '车缝',
      },
      {
        factoryId: 'FAC-CHECK-POOL-B',
        factoryName: '验收竞价工厂 B',
        factoryCode: 'CHECK-B',
        factoryType: '综合工厂',
        capabilitySummary: '车缝、烫包',
      },
    ],
    standardPrice: 1500,
    minPrice: 1200,
    currency: 'IDR',
    unit: '件',
    remark: '整任务竞价候选工厂池专项验收',
    quotes: [],
    createdBy: '专项检查',
    ...overrides,
  }
}

try {
  restoreRuntimeTaskTenderRecordStore([])

  const wholeTaskRecord = upsertRuntimeTaskTenderRecord(makeRecord())
  assert.equal(wholeTaskRecord.poolMode, 'ALL_ELIGIBLE')
  assert.equal(wholeTaskRecord.taskSnapshot.skuLines.length, 2)
  assert.equal(wholeTaskRecord.taskSnapshot.skuLines.reduce((sum, line) => sum + line.qty, 0), 500)
  assert.equal(wholeTaskRecord.factoryPool.length, 2)
  assert.equal(resolveRuntimeTaskTenderStatus(wholeTaskRecord, '2099-08-11 10:00:00'), 'BIDDING')
  assert.throws(
    () => upsertRuntimeTaskTenderRecord(makeRecord()),
    /任务范围、工厂池和最低允许报价均已冻结/,
  )

  assert.equal(
    listPdaBiddingTendersByFactoryId('FAC-CHECK-POOL-A').some((item) => item.tenderId === wholeTaskRecord.tenderId),
    true,
  )
  assert.equal(
    listPdaBiddingTendersByFactoryId('FAC-NOT-IN-POOL').some((item) => item.tenderId === wholeTaskRecord.tenderId),
    false,
  )
  const quoteTodo = getFactoryMobileTodos('FAC-CHECK-POOL-A')
    .find((item) => item.relatedTenderId === wholeTaskRecord.tenderId)
  assert(quoteTodo)
  assert.equal(quoteTodo.todoType, '待报价')
  assert.equal(quoteTodo.actionLabel, '去报价')
  assert.match(getFactoryMobileTodoActionRoute(quoteTodo), /tab=pending-quote&quoteTenderId=TD-CHECK-WHOLE-TASK-001/)
  assert.equal(
    getFactoryMobileTodos('FAC-NOT-IN-POOL').some((item) => item.relatedTenderId === wholeTaskRecord.tenderId),
    false,
  )

  assert.throws(
    () => recordRuntimeTaskTenderQuote(wholeTaskRecord.taskId, {
      factoryId: 'FAC-NOT-IN-POOL',
      factoryName: '池外工厂',
      quotePrice: 1500,
      quoteTime: '2099-08-11 10:00:00',
    }),
    /不在招标候选工厂池/,
  )
  assert.throws(
    () => recordRuntimeTaskTenderQuote(wholeTaskRecord.taskId, {
      factoryId: 'FAC-CHECK-POOL-A',
      factoryName: '验收竞价工厂 A',
      quotePrice: 1199,
      quoteTime: '2099-08-11 10:00:00',
    }),
    /不能低于最低允许报价/,
  )

  recordRuntimeTaskTenderQuote(wholeTaskRecord.taskId, {
    factoryId: 'FAC-CHECK-POOL-A',
    factoryName: '验收竞价工厂 A',
    factoryCode: 'CHECK-A',
    quotePrice: 1480,
    quoteTime: '2099-08-11 10:00:00',
    deliveryDays: 9,
    remark: '整任务报价',
  })
  assert.throws(
    () => recordRuntimeTaskTenderQuote(wholeTaskRecord.taskId, {
      factoryId: 'FAC-CHECK-POOL-A',
      factoryName: '验收竞价工厂 A',
      quotePrice: 1460,
      quoteTime: '2099-08-11 11:00:00',
    }),
    /不允许修改/,
  )
  assert.equal(
    listPdaBiddingTendersByFactoryId('FAC-CHECK-POOL-A').some((item) => item.tenderId === wholeTaskRecord.tenderId),
    false,
  )
  const quoted = listPdaQuotedTendersByFactoryId('FAC-CHECK-POOL-A')
    .find((item) => item.tenderId === wholeTaskRecord.tenderId)
  assert(quoted)
  assert.equal(quoted.quotedPrice, 1480)
  assert.equal(quoted.qty, 500)
  assert.equal(quoted.skuCount, 2)

  const quotedRecord = getRuntimeTaskTenderRecord(wholeTaskRecord.taskId)
  assert(quotedRecord)
  assert.equal(resolveRuntimeTaskTenderStatus(quotedRecord, '2099-08-12 18:00:00'), 'AWAIT_AWARD')
  assert.throws(
    () => markRuntimeTaskTenderAwarded({
      taskId: wholeTaskRecord.taskId,
      factoryId: 'FAC-CHECK-POOL-B',
      factoryName: '验收竞价工厂 B',
      awardedPrice: 1480,
      awardedAt: '2099-08-12 18:01:00',
    }),
    /未提交报价/,
  )
  recordRuntimeTaskTenderQuote(wholeTaskRecord.taskId, {
    factoryId: 'FAC-CHECK-POOL-B',
    factoryName: '验收竞价工厂 B',
    factoryCode: 'CHECK-B',
    quotePrice: 1450,
    quoteTime: '2099-08-11 11:30:00',
  })
  assert.throws(
    () => markRuntimeTaskTenderAwarded({
      taskId: wholeTaskRecord.taskId,
      factoryId: 'FAC-CHECK-POOL-A',
      factoryName: '验收竞价工厂 A',
      awardedPrice: 1490,
      awardedAt: '2099-08-12 18:01:00',
    }),
    /原始报价完全一致/,
  )
  const awarded = markRuntimeTaskTenderAwarded({
    taskId: wholeTaskRecord.taskId,
    factoryId: 'FAC-CHECK-POOL-A',
    factoryName: '验收竞价工厂 A',
    awardedPrice: 1480,
    awardedAt: '2099-08-12 18:01:00',
  })
  assert.equal(Math.min(...awarded.quotes.map((quote) => quote.quotePrice)), 1450)
  assert.equal(awarded.awardedPrice, 1480, '定标必须由人工选择，不得自动强制最低报价工厂中标')
  assert.equal(resolveRuntimeTaskTenderStatus(awarded, '2099-08-12 18:02:00'), 'AWARDED')
  assert.equal(
    listPdaAwardedTenderNoticesByFactoryId('FAC-CHECK-POOL-A').some((item) => item.tenderId === wholeTaskRecord.tenderId),
    true,
  )
  assert.equal(
    listPdaAwardedTenderNoticesByFactoryId('FAC-CHECK-POOL-B').some((item) => item.tenderId === wholeTaskRecord.tenderId),
    false,
  )

  const aboveStandardRecord = upsertRuntimeTaskTenderRecord(makeRecord({
    tenderId: 'TD-CHECK-ABOVE-STANDARD-001',
    taskId: 'TASK-CHECK-ABOVE-STANDARD-001',
    taskSnapshot: {
      ...makeRecord().taskSnapshot,
      taskNo: 'TASKGEN-CHECK-ABOVE-STANDARD-001',
    },
  }))
  recordRuntimeTaskTenderQuote(aboveStandardRecord.taskId, {
    factoryId: 'FAC-CHECK-POOL-A',
    factoryName: '验收竞价工厂 A',
    quotePrice: 1700,
    quoteTime: '2099-08-11 10:30:00',
  })
  assert.throws(
    () => markRuntimeTaskTenderAwarded({
      taskId: aboveStandardRecord.taskId,
      factoryId: 'FAC-CHECK-POOL-A',
      factoryName: '验收竞价工厂 A',
      awardedPrice: 1700,
      awardedAt: '2099-08-12 18:01:00',
    }),
    /中标价高于工序标准价时必须填写价格差异说明/,
  )
  const aboveStandardAward = markRuntimeTaskTenderAwarded({
    taskId: aboveStandardRecord.taskId,
    factoryId: 'FAC-CHECK-POOL-A',
    factoryName: '验收竞价工厂 A',
    awardedPrice: 1700,
    awardedAt: '2099-08-12 18:01:00',
    awardReason: '交期满足生产单要求，确认接受高于标准价的报价',
  })
  assert.equal(aboveStandardAward.awardReason, '交期满足生产单要求，确认接受高于标准价的报价')

  const noQuoteRecord = upsertRuntimeTaskTenderRecord(makeRecord({
    tenderId: 'TD-CHECK-NO-QUOTE-001',
    taskId: 'TASK-CHECK-NO-QUOTE-001',
    biddingDeadline: '2099-08-11 12:00:00',
    taskSnapshot: {
      ...makeRecord().taskSnapshot,
      taskNo: 'TASKGEN-CHECK-NO-QUOTE-001',
    },
  }))
  assert.equal(resolveRuntimeTaskTenderStatus(noQuoteRecord, '2099-08-11 12:00:00'), 'NO_QUOTE')

  const manualRecord = upsertRuntimeTaskTenderRecord(makeRecord({
    tenderId: 'TD-CHECK-MANUAL-001',
    taskId: 'TASK-CHECK-MANUAL-001',
    poolMode: 'MANUAL',
    taskSnapshot: {
      ...makeRecord().taskSnapshot,
      taskNo: 'TASKGEN-CHECK-MANUAL-001',
    },
    factoryPool: [makeRecord().factoryPool[1]],
  }))
  assert.equal(manualRecord.poolMode, 'MANUAL')
  assert.deepEqual(manualRecord.factoryPool.map((factory) => factory.factoryId), ['FAC-CHECK-POOL-B'])
  assert.equal(
    listPdaBiddingTendersByFactoryId('FAC-CHECK-POOL-A').some((item) => item.tenderId === manualRecord.tenderId),
    false,
  )
  assert.equal(
    listPdaBiddingTendersByFactoryId('FAC-CHECK-POOL-B').some((item) => item.tenderId === manualRecord.tenderId),
    true,
  )
  const cancelled = cancelRuntimeTaskTenderRecord({
    taskId: manualRecord.taskId,
    cancelledAt: '2099-08-11 11:00:00',
    cancelledBy: '专项检查',
    reason: '验证取消状态',
  })
  assert.equal(resolveRuntimeTaskTenderStatus(cancelled, '2099-08-11 11:01:00'), 'CANCELLED')
  assert.equal(
    listPdaBiddingTendersByFactoryId('FAC-CHECK-POOL-B').some((item) => item.tenderId === manualRecord.tenderId),
    false,
  )
  const relaunched = upsertRuntimeTaskTenderRecord(makeRecord({
    tenderId: 'TD-CHECK-MANUAL-002',
    taskId: manualRecord.taskId,
    assignmentOperatedAt: '2099-08-11 11:02:00',
    biddingDeadline: '2099-08-12 18:00:00',
    taskSnapshot: {
      ...makeRecord().taskSnapshot,
      taskNo: 'TASKGEN-CHECK-MANUAL-001',
    },
    factoryPool: [makeRecord().factoryPool[0]],
  }))
  assert.equal(getRuntimeTaskTenderRecord(manualRecord.taskId)?.tenderId, relaunched.tenderId)
  assert.equal(
    listRuntimeTaskTenderRecords().filter((record) => record.taskId === manualRecord.taskId).length,
    2,
  )
  assert.equal(
    resolveRuntimeTaskTenderStatus(getRuntimeTaskTenderRecordByTenderId(manualRecord.tenderId)!, '2099-08-11 11:03:00'),
    'CANCELLED',
  )
  assert.equal(
    listPdaBiddingTendersByFactoryId('FAC-CHECK-POOL-A').some((item) => item.tenderId === relaunched.tenderId),
    true,
  )

  assert.throws(
    () => upsertRuntimeTaskTenderRecord(makeRecord({
      tenderId: 'TD-CHECK-BROKEN-SCOPE-001',
      taskId: 'TASK-CHECK-BROKEN-SCOPE-001',
      taskSnapshot: {
        ...makeRecord().taskSnapshot,
        qty: 501,
      },
    })),
    /完整且数量守恒/,
  )

  const workbenchSource = readFileSync(path.join(projectRoot, 'src/pages/unified-dispatch-workbench.ts'), 'utf8')
  const tenderPageSource = readFileSync(path.join(projectRoot, 'src/pages/dispatch-tenders.ts'), 'utf8')
  const pdaSource = readFileSync(path.join(projectRoot, 'src/pages/pda-task-receive.ts'), 'utf8')
  assert.match(workbenchSource, /renderWholeTaskTenderScope\(task\)/)
  assert.match(workbenchSource, /本次竞价工厂池/)
  assert.match(workbenchSource, /data-unified-tender-transfer/)
  assert.match(workbenchSource, /data-unified-tender-candidates/)
  assert.match(workbenchSource, /data-unified-tender-selected-pool/)
  assert.match(workbenchSource, /data-unified-tender-selection-field="\$\{side\}"/)
  assert.match(workbenchSource, /data-skip-page-rerender="true"/, '穿梭选择器复选框和筛选控件必须避开全页重绘及点击 preventDefault')
  assert.match(workbenchSource, /data-unified-action="add-checked-tender-factories"/)
  assert.match(workbenchSource, /data-unified-action="add-visible-tender-factories"/)
  assert.match(workbenchSource, /data-unified-action="remove-checked-tender-factories"/)
  assert.match(workbenchSource, /右侧工厂是本次提交与二次确认的唯一工厂池/)
  assert.match(workbenchSource, /data-unified-tender-confirmed-factories/)
  assert.doesNotMatch(workbenchSource, /data-unified-tender-factory=/, '候选勾选不得再直接代表正式工厂池成员')
  assert.doesNotMatch(workbenchSource, /select-visible-tender-factories|选择全部筛选结果|清空已选/)
  assert.match(workbenchSource, /二次确认发起竞价/)
  assert.match(workbenchSource, /最低允许报价/)
  assert.match(workbenchSource, /data-nav="\/fcs\/dispatch\/tenders\?tenderId=/, '工作台招标单深链应走 SPA 导航，避免竞价运行事实因整页刷新丢失')
  assert.doesNotMatch(workbenchSource, /最高限价|允许报价范围/)
  assert.match(workbenchSource, /页面完整展示全部工厂，提交时不会截断本次工厂池/)
  assert.doesNotMatch(workbenchSource, /listEligibleTenderFactoriesForTask\(task\)\.slice\(0,\s*20\)/)
  assert.doesNotMatch(tenderPageSource, /新建招标单/)
  assert.match(tenderPageSource, /cancelRuntimeTaskTender/)
  assert.match(tenderPageSource, /二次确认取消竞价/)
  assert.match(tenderPageSource, /全部池内工厂/)
  assert.match(tenderPageSource, /全部报价情况/)
  assert.match(tenderPageSource, /PDA消息已发送/)
  assert.match(tenderPageSource, /最低允许报价/)
  assert.match(tenderPageSource, /initializedQueryTenderId !== queryTenderId/)
  assert.match(tenderPageSource, /queryTenderId && isEnteringTenderPage/)
  assert.match(tenderPageSource, /data-dispatch-tenders-page/)
  assert.match(tenderPageSource, /state\.keyword = queryTenderId/)
  assert.match(tenderPageSource, /else if \(previousQueryTenderId\)/)
  assert.doesNotMatch(tenderPageSource, /最高限价/)
  assert.match(pdaSource, /recordRuntimeTaskTenderQuote/)
  assert.doesNotMatch(pdaSource, /工序标准价|当前最低价|最高限价/)

  console.log('FCS 整任务竞价、候选工厂池、PDA 报价与定标共享事实检查通过')
} finally {
  restoreRuntimeTaskTenderRecordStore(storeSnapshot)
}
