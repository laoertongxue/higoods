import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

function shiftWallClockHours(value: string, hours: number): string {
  const date = new Date(`${value.replace(' ', 'T')}Z`)
  date.setUTCHours(date.getUTCHours() + hours)
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

const isolatedHmrResult = execFileSync(process.execPath, [
  '--experimental-strip-types',
  '--input-type=module',
  '--eval',
  `
    const bridge = await import('./src/data/fcs/runtime-task-read-bridge.ts?isolated=' + Date.now())
    if (bridge.readRuntimeTaskById('X') !== null) throw new Error('bridge initial state must be null')
    const ownerA = 'file:///app/runtime-process-tasks.ts?hmr=A'
    const disposeA = bridge.installRuntimeTaskReadResolver(() => ({ source: 'A' }), ownerA)
    if (bridge.readRuntimeTaskById('X').source !== 'A') throw new Error('bridge reader A failed')
    const disposeB = bridge.installRuntimeTaskReadResolver(() => ({ source: 'B' }), 'file:///app/runtime-process-tasks.ts?hmr=B')
    if (bridge.readRuntimeTaskById('X').source !== 'B') throw new Error('bridge reader B failed')
    disposeA()
    if (bridge.readRuntimeTaskById('X').source !== 'B') throw new Error('stale bridge disposer cleared latest reader')
    let foreignBridgeRejected = false
    try { bridge.installRuntimeTaskReadResolver(() => ({ source: 'FOREIGN' }), 'file:///app/foreign-module.ts') } catch { foreignBridgeRejected = true }
    if (!foreignBridgeRejected) throw new Error('foreign bridge owner must be rejected')
    disposeB()
    if (bridge.readRuntimeTaskById('X') !== null) throw new Error('latest bridge disposer failed')
    const registry = await import('./src/data/fcs/pda-handover-handout-registry.ts?isolated=' + Date.now())
    const disposeRegistryA = registry.installCompleteHandoutReaders(() => [{ handoverId: 'HEAD-A', headType: 'HANDOUT' }], () => [{ recordId: 'REC-A' }], 'file:///app/pda-handover-events.ts?hmr=A')
    if (registry.listRegisteredHandoutHeads()[0]?.handoverId !== 'HEAD-A') throw new Error('registry head reader A failed')
    if (registry.listRegisteredHandoutRecords('HEAD')[0]?.recordId !== 'REC-A') throw new Error('registry record reader A failed')
    const disposeRegistryB = registry.installCompleteHandoutReaders(() => [{ handoverId: 'HEAD-B', headType: 'HANDOUT' }], () => [{ recordId: 'REC-B' }], 'file:///app/pda-handover-events.ts?hmr=B')
    if (registry.listRegisteredHandoutHeads()[0]?.handoverId !== 'HEAD-B') throw new Error('registry head reader B failed')
    if (registry.listRegisteredHandoutRecords('HEAD')[0]?.recordId !== 'REC-B') throw new Error('registry record reader B failed')
    disposeRegistryA()
    if (registry.listRegisteredHandoutHeads()[0]?.handoverId !== 'HEAD-B') throw new Error('stale registry disposer cleared latest readers')
    let foreignRegistryRejected = false
    try { registry.installCompleteHandoutReaders(() => [], () => [], 'file:///app/foreign-module.ts') } catch { foreignRegistryRejected = true }
    if (!foreignRegistryRejected) throw new Error('foreign registry owner must be rejected')
    disposeRegistryB()
    if (registry.listRegisteredHandoutHeads().length !== 0 || registry.listRegisteredHandoutRecords('HEAD').length !== 0) throw new Error('latest registry disposer failed')
    process.stdout.write('latest-readers-ok')
  `,
], { cwd: process.cwd(), encoding: 'utf8' })
assert.equal(isolatedHmrResult, 'latest-readers-ok', '隔离子进程必须证明 bridge/registry 委托最新 reader')
const isolatedQueryReloadResult = execFileSync(process.execPath, [
  '--experimental-strip-types',
  '--input-type=module',
  '--eval',
  `
    await import('./src/data/fcs/runtime-process-tasks.ts?hmr=A')
    await import('./src/data/fcs/runtime-process-tasks.ts?hmr=B')
    await import('./src/data/fcs/pda-handover-events.ts?hmr=A')
    await import('./src/data/fcs/pda-handover-events.ts?hmr=B')
    process.stdout.write('query-reload-ok')
  `,
], { cwd: process.cwd(), encoding: 'utf8' })
assert.equal(isolatedQueryReloadResult, 'query-reload-ok', '隔离子进程 query 动态重载不得因新函数引用抛错')

// HMR: the stable bridge/registry must accept fresh function identities from the same reloaded module.
const bridge = await import('../src/data/fcs/runtime-task-read-bridge.ts')
assert.equal(bridge.readRuntimeTaskById('NOT-INSTALLED'), null, '未安装 resolver 时必须安全返回 null')
const runtime = await import('../src/data/fcs/runtime-process-tasks.ts')
const latestRuntimeTask = runtime.listRuntimeProcessTasks()[0]
assert.equal(
  bridge.readRuntimeTaskById<{ taskId: string }>(latestRuntimeTask.taskId)?.taskId,
  latestRuntimeTask.taskId,
  '安装后只读桥必须读取当前 runtime 模块',
)

// PDA focus: special ids must never be interpolated into a raw CSS selector.
const pdaReceiveSource = readFileSync(new URL('../src/pages/pda-task-receive.ts', import.meta.url), 'utf8')
assert.match(pdaReceiveSource, /escapeCssSelectorValue/, 'PDA 聚焦必须复用安全 CSS selector escape helper')
assert.doesNotMatch(
  pdaReceiveSource,
  /querySelector<HTMLElement>\(`\[data-pda-cutting-task-card-id="\$\{taskId\}"\]`\)/,
  'PDA 聚焦不得直接把 taskId 拼入 selector',
)
const { escapeCssSelectorValue } = await import('../src/utils.ts')
assert.equal(escapeCssSelectorValue('TASK-001'), 'TASK-001', '普通任务号不得被改变')
const specialTaskId = 'TASK-"quote"]'
assert.doesNotThrow(() => {
  const escaped = escapeCssSelectorValue(specialTaskId)
  assert.ok(!escaped.includes('"') && !escaped.includes(']'), '特殊引号和右方括号必须被转义')
})
const { chromium } = await import('playwright')
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  await page.setContent(`<div data-pda-cutting-task-card-id="TASK-001"></div><div id="special"></div>`)
  await page.locator('#special').evaluate((element, taskId) => element.setAttribute('data-pda-cutting-task-card-id', taskId), specialTaskId)
  for (const taskId of ['TASK-001', specialTaskId]) {
    const escaped = escapeCssSelectorValue(taskId)
    const focusedId = await page.evaluate(({ selector }) => {
      const card = document.querySelector<HTMLElement>(selector)
      if (!card) return null
      card.scrollIntoView = () => card.setAttribute('data-scrolled', 'true')
      card.scrollIntoView({ block: 'center' })
      return card.getAttribute('data-pda-cutting-task-card-id')
    }, { selector: `[data-pda-cutting-task-card-id="${escaped}"]` })
    assert.equal(focusedId, taskId, `真实 DOM 必须安全定位并滚动任务 ${taskId}`)
  }
} finally {
  await browser.close()
}

// Historical reassignment facts must be independently queryable without entering active KPI/execution scope.
const runtimeState = runtime.captureRuntimeDirectDispatchState()
const sla = await import('../src/data/fcs/sewing-delivery-sla.ts')
const slaState = sla.captureSewingDeliverySlaSnapshotStore()
const handover = await import('../src/data/fcs/pda-handover-events.ts')
const handoverState = handover.capturePdaHandoverState()
try {
  const source = runtime.listRuntimeExecutionTasks().find((task) =>
    sla.classifySewingDeliverySla(task) !== null
      && task.assignmentStatus === 'UNASSIGNED'
      && !task.assignedFactoryId,
  )
  assert.ok(source, '测试夹具需要一条未分配的含车缝运行时任务')
  runtime.applyRuntimeDirectDispatchMeta({
    taskId: source.taskId,
    factoryId: 'ID-F001',
    factoryName: '历史原工厂',
    acceptDeadline: '',
    taskDeadline: '',
    remark: '对抗测试首次派单',
    by: '审核员',
    dispatchPrice: 100,
    dispatchPriceCurrency: 'IDR',
    dispatchPriceUnit: '件',
    priceDiffReason: '',
    writeBackMainFactory: true,
    businessAssignedAt: '2026-07-01 08:00:00',
    operatedAt: '2026-07-01 08:00:00',
  })
  const reassigned = runtime.reassignRuntimeSewingTask({
    sourceTaskId: source.taskId,
    targetFactoryId: 'ID-F003',
    targetFactoryName: '改派新工厂',
    businessAssignedAt: '2026-07-02 09:00:00',
    operatedAt: '2026-07-02 09:00:00',
    reason: '产能调整',
    by: '审核员',
    mainFactoryId: 'ID-F003',
  })
  assert.equal(reassigned.ok, true, reassigned.message)

  const progress = await import('../src/data/fcs/store-domain-progress.ts')
  const historical = progress.listHistoricalSewingAssignmentProgressFacts()
    .find((fact: { runtimeTaskId: string }) => fact.runtimeTaskId === source.taskId)
  assert.ok(historical, '真实改派后必须产生旧分配历史事实')
  assert.equal(historical.historical, true)
  assert.equal(historical.factoryName, '历史原工厂')
  assert.equal(historical.replacedByRuntimeTaskId, reassigned.taskId)

  const beforeLateReceipt = historical.sewingDeliverySla.confirmedReceivedQty
  const oldSnapshot = sla.listSewingDeliverySlaSnapshotHistory(source.taskId).at(-1)!
  const firstMilestone = oldSnapshot.milestones[0]
  const headId = `HEAD-HISTORY-${source.taskId}`
  const recordId = `REC-HISTORY-${source.taskId}`
  handover.upsertPdaHandoverHeadMock({
    handoverId: headId,
    handoverOrderId: headId,
    handoverOrderNo: headId,
    headType: 'HANDOUT',
    qrCodeValue: `QR-${headId}`,
    taskId: source.taskId,
    runtimeTaskId: source.taskId,
    taskNo: source.taskNo || source.taskId,
    productionOrderNo: source.productionOrderId,
    processName: source.processNameZh,
    sourceFactoryName: '历史原工厂',
    sourceFactoryId: 'ID-F001',
    targetName: '成衣仓',
    targetKind: 'WAREHOUSE',
    receiverKind: 'WAREHOUSE',
    receiverId: 'WH-HISTORY',
    receiverName: '历史实收仓',
    qtyUnit: '件',
    factoryId: 'ID-F001',
    taskStatus: 'IN_PROGRESS',
    summaryStatus: 'SUBMITTED',
    recordCount: 1,
    pendingWritebackCount: 1,
    submittedQtyTotal: firstMilestone.targetQty,
    writtenBackQtyTotal: 0,
    objectionCount: 0,
    plannedQty: oldSnapshot.assignedQty,
    completionStatus: 'OPEN',
    qtyExpectedTotal: oldSnapshot.assignedQty,
    qtyActualTotal: firstMilestone.targetQty,
    qtyDiffTotal: firstMilestone.targetQty - oldSnapshot.assignedQty,
  })
  const submittedAt = shiftWallClockHours(firstMilestone.deadlineAt, -1)
  const receivedAt = shiftWallClockHours(firstMilestone.deadlineAt, 1)
  handover.upsertPdaHandoutRecordMock({
    recordId,
    handoverRecordId: recordId,
    handoverId: headId,
    handoverOrderId: headId,
    taskId: source.taskId,
    sourceTaskId: source.taskId,
    sequenceNo: 1,
    submittedQty: firstMilestone.targetQty,
    plannedQty: firstMilestone.targetQty,
    qtyUnit: '件',
    factorySubmittedAt: submittedAt,
    factorySubmittedBy: '历史原工厂',
    factoryProofFiles: [],
    status: 'PENDING_WRITEBACK',
    handoverRecordStatus: 'SUBMITTED_WAIT_WRITEBACK',
    lifecycleUpdatedAt: submittedAt,
  })
  handover.writeBackHandoverRecord({
    handoverRecordId: recordId,
    receiverWrittenQty: firstMilestone.targetQty,
    receiverWrittenAt: receivedAt,
    receiverWrittenBy: '历史实收仓',
  })
  assert.equal(
    handover.findPdaHandoverRecord(recordId)?.lifecycleUpdatedAt,
    receivedAt,
    '真实实收回写必须把 lifecycleUpdatedAt 推进到 receiverWrittenAt',
  )
  const refreshedHistorical = progress.listHistoricalSewingAssignmentProgressFacts()
    .find((fact: { runtimeTaskId: string }) => fact.runtimeTaskId === source.taskId)!
  assert.equal(
    refreshedHistorical.sewingDeliverySla.confirmedReceivedQty,
    beforeLateReceipt + firstMilestone.targetQty,
    '改派后旧 task 新增实收必须即时刷新历史事实',
  )
  assert.equal(
    refreshedHistorical.sewingDeliverySla.projection.milestones[0].firstReachedAt,
    receivedAt,
    '历史 30% 节点必须按旧 task 后续实收即时达标',
  )

  const context = await import('../src/pages/progress-board/context.ts')
  const kpiBeforeSearch = context.getTaskKpiStats()
  context.state.keyword = '历史原工厂'
  const found = context.getFilteredTasks().find((task: { taskId: string }) => task.taskId === source.taskId)
  assert.equal(found?.historicalAssignment, true, '必须能按旧工厂搜索历史行')
  assert.deepEqual(context.getTaskKpiStats(), kpiBeforeSearch, '历史行不得改变进行中/逾期等 KPI')

  const taskDomain = await import('../src/pages/progress-board/task-domain.ts')
  assert.equal(
    taskDomain.renderTaskFollowUpAction({ historicalAssignment: true }, '跟进工厂开工'),
    '',
    '明确带当前跟进文案的历史 fact 也必须渲染为纯只读',
  )
  const pagedFixtures = Array.from({ length: 45 }, (_, index) => ({ ...found!, taskId: `HIST-PAGE-${index + 1}` }))
  context.state.page = 2
  context.state.pageSize = 20
  const pageTwoHtml = taskDomain.renderTaskDimension(pagedFixtures)
  assert.equal((pageTwoHtml.match(/<tr class="cursor-pointer[^>]+data-nav="\/fcs\/progress\/board\/tasks\/HIST-PAGE-/g) ?? []).length, 20, '任务列表第二页必须只渲染20条')
  assert.match(pageTwoHtml, /第 2 \/ 3 页[\s\S]*每页 20 条/, '分页必须展示页码、总页数和每页条数')
  assert.doesNotMatch(pageTwoHtml, /继续加载|show-more-tasks/, '任务列表不得保留继续加载伪分页')
  assert.doesNotMatch(
    taskDomain.renderProgressTaskDetailTabs({ ...found!, status: 'BLOCKED', historicalAssignment: true }, 'basic'),
    /生产暂停信息/,
    '历史详情不得渲染暂停死 Tab',
  )
  const listHtml = taskDomain.renderTaskDimension(context.getFilteredTasks())
  assert.match(listHtml, /已改派（历史）/)
  assert.doesNotMatch(listHtml, /跟进工厂开工/, '历史行不得展示为当前执行状态')
  assert.match(listHtml, /不参与当前风险判断/, '历史行必须明确不参与当前风险判断')
  assert.doesNotMatch(listHtml, new RegExp(`data-task-id="${source.taskId}"[^>]*>更新进度`), '历史行不得提供执行动作')
  const detailHtml = taskDomain.renderProgressTaskDetailPage(source.taskId)
  assert.match(detailHtml, /已改派（历史）/)
  assert.doesNotMatch(detailHtml, /跟进工厂开工/, '历史详情不得给出当前执行动作')
  assert.match(detailHtml, /30% 节点[\s\S]*70% 节点[\s\S]*100% 节点/)
  assert.match(detailHtml, /data-progress-action="review-sewing-sla-responsibility"/, '历史详情的延迟节点必须保留真实责任复核入口')
  taskDomain.openSewingDeliveryResponsibilityReview(source.taskId, 0.3)
  assert.equal(taskDomain.captureSewingDeliveryResponsibilityReviewDraft()?.taskId, source.taskId, '历史责任复核入口必须真实打开旧任务草稿')
  assert.match(taskDomain.renderSewingDeliveryResponsibilityReviewDialog(), /role="dialog"[\s\S]*30% 节点/, '历史责任复核弹窗必须真实可见')
} finally {
  runtime.restoreRuntimeDirectDispatchState(runtimeState)
  sla.restoreSewingDeliverySlaSnapshotStore(slaState)
  handover.restorePdaHandoverState(handoverState)
}

// lifecycleUpdatedAt is the lifecycle version clock for every existing receiver writeback mutation.
const handoverSource = readFileSync(new URL('../src/data/fcs/pda-handover-events.ts', import.meta.url), 'utf8')
assert.match(handoverSource, /生命周期版本时间[^\n]*\n\s*lifecycleUpdatedAt\?: string/, '字段契约必须有最小注释')

console.log('sewing delivery SLA adversarial UI checks passed')
