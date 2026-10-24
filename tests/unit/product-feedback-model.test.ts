import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createFeedbackSeed, FEEDBACK_STORE_CODES } from '../../src/data/product-feedback/mock.ts'
import { applyFeedbackCommand, assessTask, batchCounts, buildDailyTasks, canonicalFeedbackTime, currentClassification, dailyWindow, feedbackMd5, filterComments, ingestFeedbackBatch, jakartaInstant, personnelSummary, reviewIdentity, summarizeComments } from '../../src/data/product-feedback/model.ts'
import { FEEDBACK_OWNER, type FeedbackBatch, type FeedbackCommand, type FeedbackExecution, type FeedbackSnapshot, type FeedbackTask } from '../../src/data/product-feedback/types.ts'

const now = '2026-10-23T12:30:00.000Z'
function fixture(): { snapshot: FeedbackSnapshot; task: FeedbackTask; execution: FeedbackExecution; batch: FeedbackBatch } {
  const snapshot = createFeedbackSeed(), task = snapshot.tasks.find(t => t.storeId === 'ST-FB-002' && t.businessDate === '2026-10-23')!, execution = snapshot.executions.find(e => e.taskId === task.id)!, batch = snapshot.batches.find(b => b.executionId === execution.id)!
  snapshot.tasks = [task]; snapshot.executions = [execution]; snapshot.batches = [batch]
  return { snapshot, task, execution, batch }
}
function command(part: Record<string, unknown>): FeedbackCommand { return { operationId: 'op-unit-1', actor: FEEDBACK_OWNER, at: now, ...part } as FeedbackCommand }
function declaredCollection(original: FeedbackExecution, batches: FeedbackBatch[]): FeedbackExecution {
  const execution = structuredClone(original); execution.id = `fixture-execution-${batches[0].id}`
  for (const batch of batches) batch.executionId = execution.id
  execution.terminalReceipt = { id: `terminal-${execution.id}`, batches: batches.map(b => ({ batchId: b.id, rowIds: b.rows.map(r => r.id) })), rawCount: batches.reduce((n, b) => n + b.rows.length, 0), endedAt: execution.endedAt!, persistedAt: batches[0].receivedAt, evidence: '独立夹具声明完整原始上传清单，收件端不能自行缩减' }
  return execution
}


test('mock references all nine agreed stores and every review has a real source display name within two pages', () => {
  const s = createFeedbackSeed(); assert.equal(s.schedules.length, 9); assert.equal(s.tasks.length, 30); assert.equal(s.comments.length, 36); assert.equal(FEEDBACK_STORE_CODES.length, 9)
  for (const key of ['schedules', 'tasks', 'comments', 'executions', 'batches'] as const) assert.ok(s[key].length <= 40)
  assert.ok(s.comments.every(c => c.raw.author.trim() && c.association.styleId)); assert.ok(s.tasks.every(t => t.owner === FEEDBACK_OWNER))
  assert.equal(s.tasks.filter(t => t.type === '日常采集' && t.businessDate === '2026-10-23').length, 9)
})
test('A44 daily window is exactly previous seven complete Jakarta days with yesterday core and 18:00 deadline', () => {
  const w = dailyWindow('2026-10-23'); assert.deepEqual(w, { target: { start: '2026-10-15T17:00:00.000Z', end: '2026-10-22T17:00:00.000Z' }, core: { start: '2026-10-21T17:00:00.000Z', end: '2026-10-22T17:00:00.000Z' }, deadline: '2026-10-23T11:00:00.000Z' })
  const { snapshot, task, execution } = fixture(); execution.coverage.range = task.core; assert.equal(assessTask(task, snapshot, now).status, '部分完成')
})
test('A04 zero rows with full durable evidence complete; absence of receipt cannot', () => {
  const { snapshot, task } = fixture(); assert.equal(assessTask(task, snapshot, now).status, '已完成'); snapshot.batches = []; assert.equal(assessTask(task, snapshot, now).deliveredAt, null)
})
test('A31 HTTP-style receipt without durable raw storage cannot complete delivery', () => {
  const { snapshot, task, batch } = fixture(); batch.durable = false; const result = assessTask(task, snapshot, now); assert.equal(result.deliveredAt, null); assert.notEqual(result.status, '已完成')
})
test('A06 yesterday execution uploaded today does not satisfy fresh daily execution', () => {
  const { snapshot, task, execution } = fixture(); execution.startedAt = jakartaInstant('2026-10-22', '14:00'); execution.endedAt = jakartaInstant('2026-10-22', '14:10'); assert.equal(assessTask(task, snapshot, now).status, '未开始')
})
test('execution cannot prove coverage with reversed times or unfinished status', () => {
  const { snapshot, task, execution } = fixture(); execution.endedAt = jakartaInstant('2026-10-23', '13:00'); assert.equal(assessTask(task, snapshot, now).coverageComplete, false); execution.endedAt = jakartaInstant('2026-10-23', '14:10'); execution.status = '进行中'; assert.equal(assessTask(task, snapshot, now).coverageComplete, false)
})
test('A17 durable delivery before deadline and processing after deadline are separate', () => {
  const { snapshot, task, batch } = fixture(); batch.processingEndedAt = jakartaInstant('2026-10-23', '19:00'); const early = assessTask(task, snapshot, jakartaInstant('2026-10-23', '18:30')); assert.equal(early.onTimeDelivery, true); assert.equal(early.completedAt, null); const result = assessTask(task, snapshot, now); assert.equal(result.onTimeCompletion, false); assert.equal(result.status, '已完成')
})
test('A40 late verification uses original persisted proof, newly supplemented proof uses its receipt time', () => {
  const { snapshot, task, execution } = fixture(); execution.coverage.verified = false
  const reviewed = applyFeedbackCommand(snapshot, command({ type: 'review-coverage', executionId: execution.id, expectedVersion: 1, conclusion: '通过', evidence: '核对既有原始范围、末页证据', reason: '原始证据完整，晚复核' })); assert.equal(assessTask(task, reviewed, now).onTimeDelivery, true)
  const supplemented = applyFeedbackCommand(snapshot, command({ type: 'review-coverage', executionId: execution.id, expectedVersion: 1, conclusion: '通过', evidence: '新补末页凭据', reason: '此前缺必要证据', supplemental: execution.coverage })); assert.equal(assessTask(task, supplemented, now).onTimeDelivery, false)
})
test('completed task retains first completion when next day overlapping execution fails', () => {
  const { snapshot, task, batch, execution } = fixture(), before = assessTask(task, snapshot, now), later = structuredClone(execution), laterBatch = structuredClone(batch)
  later.id = 'later-execution'; later.taskId = 'another-task'; later.startedAt = jakartaInstant('2026-10-24', '14:00'); later.endedAt = jakartaInstant('2026-10-24', '14:10'); later.status = '失败'; later.coverage.verified = false
  laterBatch.id = 'later-batch'; laterBatch.executionId = later.id; laterBatch.receivedAt = jakartaInstant('2026-10-24', '14:20'); laterBatch.rows = [{ id: 'later-failure', raw: null, rawNote: '解析失败', outcome: 'F', commentId: null, reason: '未解决', processedAt: laterBatch.receivedAt }]
  snapshot.executions.push(later); snapshot.batches.push(laterBatch); const after = assessTask(task, snapshot, jakartaInstant('2026-10-24', '19:00')); assert.equal(after.completedAt, before.completedAt); assert.equal(after.status, '已完成'); assert.equal(after.onTimeCompletion, true)
})
test('A35 seven days nine stores gives 63 due tasks independent of uploads and no exemptions', () => {
  const s = createFeedbackSeed(), schedules = s.schedules.map(x => ({ ...x, effectiveDate: '2026-10-16' })); s.tasks = buildDailyTasks(schedules, '2026-10-16', '2026-10-22'); s.executions = []; s.batches = []
  const p = personnelSummary(s, s.tasks, now)[0]; assert.equal(p.due, 63); assert.equal(p.incomplete, 63); assert.equal(p.completed, 0)
})
test('A19 no due tasks gives not-applicable rates, never 100%', () => {
  const { snapshot, task } = fixture(); const p = personnelSummary(snapshot, [task], jakartaInstant('2026-10-23', '10:00'))[0]; assert.equal(p.due, 0); assert.equal(p.upcoming, 1); assert.equal(p.deliveryRate, null); assert.equal(p.completionRate, null)
})
test('history uses fixed independent target and deadline without daily denominator', () => {
  const { snapshot, task, execution } = fixture(); task.type = '历史补采'; task.target = { start: jakartaInstant('2026-07-25'), end: jakartaInstant('2026-10-16') }; execution.coverage.range = task.target; assert.equal(assessTask(task, snapshot, now).status, '已完成'); assert.equal(personnelSummary(snapshot, [task], now)[0]?.due || 0, 0)
})
test('A47 historical inaccessible range remains visible and cannot claim full coverage', () => {
  const { snapshot, task, execution } = fixture(); task.type = '历史补采'; task.target = { start: jakartaInstant('2026-01-01'), end: jakartaInstant('2026-07-25') }; task.inaccessibleRanges = [{ start: task.target.start, end: jakartaInstant('2026-03-01'), reason: '平台不可访问' }]; execution.coverage.range = { start: jakartaInstant('2026-03-01'), end: task.target.end }; assert.equal(assessTask(task, snapshot, now).status, '部分完成')
})
test('MD5 canonical UTF-8 implementation matches standard vectors including emoji', () => { for (const input of ['', 'abc', '评论😀']) assert.equal(feedbackMd5(input), createHash('md5').update(input).digest('hex')) })
test('A14 native-less fingerprint scopes by store/link and changes when original body changes', () => {
  const raw = structuredClone(createFeedbackSeed().comments[0].raw); raw.nativeReviewId = null
  const key = reviewIdentity(raw); assert.equal(key, reviewIdentity(structuredClone(raw))); raw.content += '补充'; assert.notEqual(key, reviewIdentity(raw)); raw.content = createFeedbackSeed().comments[0].raw.content; raw.platformProductId += 'other'; assert.notEqual(key, reviewIdentity(raw))
})
test('A33 same batch repeated review adds one unique row and conserves all outcomes', () => {
  const { snapshot, execution, batch } = fixture(), raw = structuredClone(createFeedbackSeed().comments[0].raw); raw.storeId = batch.storeId; raw.nativeReviewId = 'unit-native'
  snapshot.comments = []; snapshot.batches = []; batch.id = 'ingest-batch'; batch.rows = [0, 1].map(i => ({ id: `source-${i}`, raw: structuredClone(raw), rawNote: '', outcome: 'N' as const, commentId: null, reason: '', processedAt: null })); batch.receipts = []
  ingestFeedbackBatch(snapshot, batch, declaredCollection(execution, [batch]), now); assert.equal(snapshot.comments.length, 1); assert.deepEqual(batchCounts(snapshot.batches[0]), { U: 2, N: 1, M: 0, D: 1, X: 0, F: 0, P: 0 })
})
test('A36 same batch ID with changed body is rejected even when claimed digest is unchanged', () => {
  const { snapshot, execution, batch } = fixture(); const changed = structuredClone(batch); changed.rows.push({ id: 'new-row', raw: null, rawNote: 'changed body', outcome: 'X', commentId: null, reason: 'header', processedAt: now }); assert.throws(() => ingestFeedbackBatch(snapshot, changed, execution, now), /载荷已改变/)
})
test('same native identity newer version changes body, preserves identity and invalidates old classification', () => {
  const s = createFeedbackSeed(), original = s.comments.find(c => c.raw.nativeReviewId && c.classifications.length)!, batch = structuredClone(s.batches.find(b => b.id === original.firstBatchId)!), execution = s.executions.find(e => e.id === batch.executionId)!, raw = structuredClone(original.raw)
  raw.content = '更新后缝线问题'; raw.sourceVersion = (raw.sourceVersion || 0) + 1; batch.id = 'new-version-batch'; batch.rows = [{ id: 'changed', raw, rawNote: '', outcome: 'N', commentId: null, reason: '', processedAt: null }]; batch.receipts = []
  const total = s.comments.length; ingestFeedbackBatch(s, batch, declaredCollection(execution, [batch]), now); assert.equal(s.comments.length, total); assert.equal(s.batches.at(-1)!.rows[0].outcome, 'M'); assert.equal(currentClassification(s.comments.find(c => c.id === original.id)!), null)
})
test('stale or incomparable native source version never overwrites current review', () => {
  const s = createFeedbackSeed(), original = s.comments.find(c => c.raw.nativeReviewId)!, batch = structuredClone(s.batches.find(b => b.id === original.firstBatchId)!), execution = s.executions.find(e => e.id === batch.executionId)!, raw = structuredClone(original.raw); raw.content = '迟到缓存旧文'; raw.sourceVersion = 0; batch.id = 'stale-version'; batch.rows = [{ id: 'stale', raw, rawNote: '', outcome: 'N', commentId: null, reason: '', processedAt: null }]; batch.receipts = []; ingestFeedbackBatch(s, batch, declaredCollection(execution, [batch]), now); assert.notEqual(original.raw.content, '迟到缓存旧文'); assert.equal(s.batches.at(-1)!.rows[0].outcome, 'D')
})
test('A42 a traceable new repair batch closes original F while retaining original receipt and contribution', () => {
  const { snapshot, task, execution, batch } = fixture(), raw = structuredClone(createFeedbackSeed().comments[0].raw); raw.storeId = batch.storeId; raw.nativeReviewId = 'failed-native'; batch.rows = [{ id: 'failed-row', raw, rawNote: 'source', outcome: 'F', commentId: null, reason: '保存失败', processedAt: batch.receivedAt }]; batch.receipts = [{ version: 1, at: batch.receivedAt, rows: structuredClone(batch.rows), counts: batchCounts(batch) }]; execution.terminalReceipt!.batches[0].rowIds = ['failed-row']; execution.terminalReceipt!.rawCount = 1; snapshot.comments = []
  assert.equal(assessTask(task, snapshot, now).status, '部分完成')
  const repair = structuredClone(batch); repair.id = 'repair-batch'; repair.submitter = '修复处理人'; repair.receivedAt = now; repair.rows = [{ ...structuredClone(batch.rows[0]), id: 'saved-row', outcome: 'N', commentId: null }]; repair.receipts = []; repair.repairReferences = [{ originalBatchId: batch.id, originalRowId: 'failed-row', repairedRowId: 'saved-row', evidence: '同来源内容已持久保存并回读', actor: '修复处理人' }]
  ingestFeedbackBatch(snapshot, repair, declaredCollection(execution, [repair]), now); const originalBatch = snapshot.batches.find(b => b.id === batch.id)!; assert.equal(originalBatch.rows[0].outcome, 'F'); assert.ok(originalBatch.rows[0].repairedBy); assert.equal(originalBatch.receipts[0].rows[0].repairedBy, undefined); assert.equal(assessTask(task, snapshot, now).status, '已完成'); assert.equal(snapshot.comments[0].firstCollector, FEEDBACK_OWNER); assert.equal(snapshot.comments[0].firstStoredAt, now); assert.equal(snapshot.comments[0].collectedAt, execution.startedAt)
})
test('comments missing mandatory source author are rejected without an identity workflow', () => {
  const { snapshot, batch, execution } = fixture(); snapshot.batches = []; const raw = structuredClone(createFeedbackSeed().comments[0].raw); raw.author = ''; raw.storeId = batch.storeId; batch.rows = [{ id: 'invalid-contract-input', raw, rawNote: '', outcome: 'N', commentId: null, reason: '', processedAt: null }]; assert.throws(() => ingestFeedbackBatch(snapshot, batch, execution, now), /来源评论者/)
})
test('A38 batch classification is a proposal; previous confirmed themes stay until individual review', () => {
  const s = createFeedbackSeed(), c = s.comments[0], original = currentClassification(c)!, next = applyFeedbackCommand(s, command({ type: 'bulk-classification', commentIds: [c.id], expectedVersions: { [c.id]: c.version }, tags: [{ theme: '做工与质量', sentiment: '问题', evidence: '' }], note: '逐条复核' })), n = next.comments.find(x => x.id === c.id)!
  assert.equal(currentClassification(n)!.id, original.id); assert.equal(n.classifications.at(-1)!.state, '待复核'); assert.equal(currentClassification(n)!.tags.some(t => t.theme === '做工与质量'), false)
})
test('A24 optimistic content and record versions reject stale saves', () => {
  const s = createFeedbackSeed(), c = s.comments[0], base = { type: 'save-classification', commentId: c.id, expectedVersion: c.version, expectedContentVersion: c.contentVersion, value: '一般反馈', tags: [], note: '', state: '已确认' }
  assert.throws(() => applyFeedbackCommand(s, command({ ...base, expectedVersion: 0 })), /其他操作更新/); assert.throws(() => applyFeedbackCommand(s, command({ ...base, expectedContentVersion: 0 })), /原文或评分已更新/)
})
test('A43 待判断 cannot confirm; information insufficient confirmed counts without invented labels', () => {
  const s = createFeedbackSeed(), c = s.comments[15], base = { type: 'save-classification', commentId: c.id, expectedVersion: c.version, expectedContentVersion: c.contentVersion, tags: [], state: '已确认' }
  assert.throws(() => applyFeedbackCommand(s, command({ ...base, value: '待判断', note: '' })), /终态/)
  const next = applyFeedbackCommand(s, command({ ...base, value: '信息不足（已复核）', note: '原文尚不足以确定具体主题' })); assert.equal(currentClassification(next.comments[15])!.tags.length, 0); assert.equal(summarizeComments([next.comments[15]]).classified, 1)
})
test('withdrawing current classification removes confirmed contribution without deleting historical facts', () => {
  const s = createFeedbackSeed(), c = s.comments[0], cls = currentClassification(c)!, next = applyFeedbackCommand(s, command({ type: 'withdraw-classification', commentId: c.id, classificationId: cls.id, expectedVersion: c.version, reason: '证据误判' })); assert.equal(currentClassification(next.comments[0]), null); assert.equal(next.comments[0].classifications[0].state, '已撤回'); assert.equal(s.comments[0].classifications[0].state, '已确认')
})
test('future schedule preserves all existing task owners and blocks overwriting active versions', () => {
  const s = createFeedbackSeed(), existing = s.schedules[0], next = { ...existing, id: 'future-schedule', previousId: existing.id, owner: '未来负责人', effectiveDate: '2026-10-25', reason: '长期责任变更' }
  const changed = applyFeedbackCommand(s, command({ type: 'save-schedule', schedule: next, expectedVersion: 0 })); assert.deepEqual(changed.tasks.filter(t => s.tasks.some(old => old.id === t.id)), s.tasks); assert.equal(changed.tasks.length, s.tasks.length + 1); const generated = changed.tasks.find(t => t.storeId === existing.storeId && t.businessDate === '2026-10-25')!; assert.equal(generated.owner, '未来负责人'); assert.equal(generated.createdAt, now); assert.equal(generated.scheduleId, next.id); assert.equal(generated.scheduleVersion, 1); assert.equal(generated.deadline, jakartaInstant('2026-10-25', '18:00')); assert.throws(() => applyFeedbackCommand(s, command({ type: 'save-schedule', schedule: existing, expectedVersion: 1 })), /保留历史/)
})
test('A15 high star comments may have problem labels and multi-label totals are not unique review total', () => {
  const s = createFeedbackSeed(), c = s.comments[4], result = summarizeComments([c]); assert.equal(c.raw.rating, 4); assert.equal(result.negative, 0); assert.equal(result.problemComments, 1); assert.equal(result.themes.reduce((n, t) => n + t.total, 0), 2)
})
test('A46 valid ratings 0/19/20 have distinct unavailable and small-sample states', () => {
  const comments = createFeedbackSeed().comments; assert.equal(summarizeComments([]).average, null); assert.equal(summarizeComments([]).negativeRate, null); assert.equal(summarizeComments(comments.slice(0, 19)).smallSample, true); assert.equal(summarizeComments(comments.slice(0, 20)).smallSample, false)
})
test('A39 unknown review-time stock ignores period only in explicitly unknown-time view', () => {
  const comments = createFeedbackSeed().comments, period = { start: '2026-10-01', end: '2026-10-23', dateType: 'comment' as const }; assert.equal(filterComments(comments, period).some(c => c.raw.commentAt === null), false); assert.equal(filterComments(comments, { ...period, unknownTimeOnly: true }).length, 1)
})
test('theme and sentiment filters must match the same tag', () => {
  const c = structuredClone(createFeedbackSeed().comments[0]); c.classifications[0].tags = [{ theme: '面料与穿着', sentiment: '正向', evidence: '面料柔软' }, { theme: '发货与物流', sentiment: '问题', evidence: '穿着舒服' }]; assert.equal(filterComments([c], { theme: '面料与穿着', sentiment: '问题' }).length, 0)
})
test('repeating same operation is idempotent and cannot create a second note', () => {
  const s = createFeedbackSeed(), input = command({ type: 'save-note', scope: '2026-10-23／全部店铺', commentIds: [s.comments[0].id], content: '原文有面料柔软的反馈' }), next = applyFeedbackCommand(s, input), repeat = applyFeedbackCommand(next, input); assert.deepEqual(repeat, next); assert.equal(next.notes.length, 1)
})
test('ISO timezone offsets canonicalize to the same instant and invalid dates are rejected', () => {
  assert.equal(canonicalFeedbackTime('2026-10-23T18:00:00+07:00'), canonicalFeedbackTime('2026-10-23T11:00:00Z'))
  assert.throws(() => canonicalFeedbackTime('2026-02-31T18:00:00Z'), /有效日期/)
  assert.throws(() => canonicalFeedbackTime('2026-10-23T18:00:00'), /时区/)
})
test('inverted supplementary coverage cannot be approved', () => {
  const { snapshot, execution } = fixture(); assert.throws(() => applyFeedbackCommand(snapshot, command({ type: 'review-coverage', executionId: execution.id, expectedVersion: execution.version, conclusion: '通过', evidence: '原始凭据', reason: '补充范围', supplemental: { ...execution.coverage, range: { start: execution.coverage.range.end, end: execution.coverage.range.start } } })), /开始必须早于结束/)
})
test('history plan is atomic when a later segment conflicts, leaving source unchanged', () => {
  const s = createFeedbackSeed(), before = JSON.stringify(s), t = structuredClone(s.tasks.find(t => t.type === '历史补采')!)
  const first = { ...t, id: 'plan-first', target: { start: jakartaInstant('2026-07-01'), end: jakartaInstant('2026-07-10') }, deadline: jakartaInstant('2026-10-30', '18:00') }, second = { ...first, id: 'plan-second' }
  assert.throws(() => applyFeedbackCommand(s, command({ type: 'create-history-plan', tasks: [first, second], allowOverlap: true })), /已有相同/); assert.equal(JSON.stringify(s), before)
})
test('history and investigation drafts persist input without creating tasks or changing assessments', () => {
  const { snapshot, execution, task } = fixture(), original = assessTask(task, snapshot, now)
  const next = applyFeedbackCommand(snapshot, command({ type: 'save-history-draft', draft: { id: 'draft-history', storeId: task.storeId, owner: FEEDBACK_OWNER, startDate: '', endDate: '', deadline: '', reason: '等待平台最早可访问时间', stockCheck: '', scope: '全店评价入口', listingIds: [], values: { segment: '30', inaccessible: '待核实' } }, expectedVersion: 0 }))
  assert.equal(next.tasks.length, snapshot.tasks.length); assert.equal(next.historyDrafts[0].values!.segment, '30')
  const reviewed = applyFeedbackCommand(next, command({ operationId: 'draft-review-op', type: 'save-review-draft', draft: { id: 'draft-review', kind: 'coverage', objectId: execution.id, values: { evidence: '尚在核查', reason: '未确认' } }, expectedVersion: 0 })); assert.deepEqual(assessTask(task, reviewed, now), original)
})
test('bulk submit-review is all-or-nothing and preserves each review own fields', () => {
  const s = createFeedbackSeed(), first = s.comments[0], second = s.comments[1], input = { type: 'bulk-submit-review', commentIds: [first.id, second.id], expectedVersions: { [first.id]: first.version, [second.id]: second.version }, expectedContentVersions: { [first.id]: first.contentVersion, [second.id]: second.contentVersion } }
  const next = applyFeedbackCommand(s, command(input)); assert.equal(next.comments[0].classifications.at(-1)!.value, currentClassification(first)!.value); assert.equal(next.comments[1].classifications.at(-1)!.value, '仅评分'); assert.throws(() => applyFeedbackCommand(s, command({ ...input, expectedVersions: { ...input.expectedVersions, [second.id]: 0 } })), /其他操作更新/); assert.equal(s.comments[0].classifications.length, first.classifications.length)
})
test('reusing operation ID with a different payload is rejected', () => {
  const s = createFeedbackSeed(), input = command({ type: 'save-note', scope: '全部', commentIds: [s.comments[0].id], content: '第一段观察' }), next = applyFeedbackCommand(s, input)
  assert.throws(() => applyFeedbackCommand(next, { ...input, content: '另一段内容' } as FeedbackCommand), /操作编号不能/)
})
test('incomplete schedule saves as draft but cannot enable or create tasks', () => {
  const s = createFeedbackSeed(), schedule = { id: 'draft-schedule', storeId: s.schedules[0].storeId, owner: '', effectiveDate: '', status: '草稿', reason: '' }
  const next = applyFeedbackCommand(s, command({ type: 'save-schedule', schedule, expectedVersion: 0 })); assert.equal(next.schedules.at(-1)!.status, '草稿'); assert.equal(next.tasks.length, s.tasks.length)
  assert.throws(() => applyFeedbackCommand(s, command({ type: 'save-schedule', schedule: { ...schedule, status: '已启用' }, expectedVersion: 0 })), /启用时/)
})
test('partial failed execution preserves its explicit coverage chunks without claiming completion', () => {
  const { snapshot, task, execution } = fixture(); execution.status = '失败'; execution.coverage.missingRanges = [{ start: task.target.start, end: task.core.start, reason: '翻页中断' }]; assert.equal(assessTask(task, snapshot, now).status, '部分完成'); assert.equal(assessTask(task, snapshot, now).coverageComplete, false)
})
test('activating a future schedule generates only its first task atomically and repeating the action does not duplicate it', () => {
  const s = createFeedbackSeed(), existing = s.schedules[0], input = command({ type: 'save-schedule', schedule: { id: 'schedule-first-task', previousId: existing.id, storeId: existing.storeId, owner: '未来负责人', effectiveDate: '2026-10-25', status: '已启用', reason: '长期责任调整' }, expectedVersion: 0 })
  const next = applyFeedbackCommand(s, input), repeat = applyFeedbackCommand(next, input)
  assert.equal(next.tasks.filter(t => t.scheduleId === 'schedule-first-task').length, 1); assert.deepEqual(repeat, next); assert.equal(next.tasks.some(t => t.businessDate === '2026-10-26'), false)
  assert.equal(s.tasks.some(t => t.scheduleId === 'schedule-first-task'), false)
})
test('report snapshot time is monotonic while earlier actual operation time remains unchanged', () => {
  const s = createFeedbackSeed(), earlier = '2026-10-23T10:00:00.000Z', input = command({ type: 'save-note', operationId: 'early-operation', at: earlier, scope: '固定 Mock 场景', commentIds: [s.comments[0].id], content: '保留浏览器动作时间' })
  const next = applyFeedbackCommand(s, input); assert.equal(next.asOf, s.asOf); assert.equal(next.logs.at(-1)!.at, earlier); assert.equal(next.notes.at(-1)!.at, earlier)
  const later = '2026-10-23T15:00:00.000Z', advanced = applyFeedbackCommand(next, { ...input, operationId: 'later-operation', at: later } as FeedbackCommand); assert.equal(advanced.asOf, later); assert.equal(advanced.logs.at(-1)!.at, later)
})

test('review regression: N/M/D cannot accept null raw reviews or mutate any prior fact', () => {
  for (const outcome of ['N', 'M', 'D'] as const) {
    const { snapshot, execution, batch } = fixture(), before = JSON.stringify(snapshot)
    const incoming = structuredClone(batch); incoming.id = `null-${outcome}`; incoming.rows = [{ id: 'bad', raw: null, rawNote: '没有原始评论', outcome, commentId: null, reason: '', processedAt: now }]
    assert.throws(() => ingestFeedbackBatch(snapshot, incoming, execution, now), /完整原始评论/); assert.equal(JSON.stringify(snapshot), before)
  }
})
test('review regression: missing or mismatched primary task and store are rejected before receipt creation', () => {
  for (const variant of ['missing-task', 'different-task', 'wrong-store', 'wrong-execution-task'] as const) {
    const { snapshot, execution, batch, task } = fixture(), incoming = structuredClone(batch), e = structuredClone(execution), before = JSON.stringify(snapshot)
    incoming.id = variant
    if (variant === 'missing-task') incoming.taskId = 'task-does-not-exist'
    if (variant === 'different-task') { snapshot.tasks.push({ ...task, id: 'other-existing-task' }); incoming.taskId = 'other-existing-task' }
    if (variant === 'wrong-store') incoming.storeId = 'ST-FB-001'
    if (variant === 'wrong-execution-task') { e.taskId = 'task-does-not-exist'; incoming.taskId = e.taskId }
    const current = JSON.stringify(snapshot)
    assert.throws(() => ingestFeedbackBatch(snapshot, incoming, e, now), /批次、执行和任务/); assert.equal(JSON.stringify(snapshot), current); assert.ok(before)
  }
})
test('review regression: same immutable pending batch progresses through explicit processing with receipt history and late processing attribution', () => {
  const { snapshot, execution, batch, task } = fixture(), raw = structuredClone(snapshot.comments[0].raw), received = jakartaInstant('2026-10-23', '17:50'), processed = jakartaInstant('2026-10-23', '19:00')
  raw.storeId = batch.storeId; raw.nativeReviewId = 'pending-source'; batch.id = 'pending-receipt'; batch.receivedAt = received; batch.rows = [{ id: 'pending-row', raw, rawNote: '完整原始评论已持久保存', outcome: 'P', commentId: null, reason: '等待清洗', processedAt: null }]; batch.receipts = []
  snapshot.executions = []; snapshot.batches = []; snapshot.comments = []; const e = declaredCollection(execution, [batch])
  ingestFeedbackBatch(snapshot, batch, e, received)
  const retry = structuredClone(batch); retry.rows[0].outcome = 'N'; retry.processingEndedAt = processed
  ingestFeedbackBatch(snapshot, retry, e, processed)
  assert.equal(snapshot.batches[0].rows[0].outcome, 'P'); assert.equal(snapshot.comments.length, 0)
  const early = assessTask(task, snapshot, jakartaInstant('2026-10-23', '18:10')); assert.equal(early.onTimeDelivery, true); assert.equal(early.completedAt, null)
  const input = command({ type: 'process-batch', at: processed, batchId: batch.id, expectedVersion: snapshot.batches[0].version, cleaningVersion: 'clean-v2', results: [{ rowId: 'pending-row', outcome: '处理', reason: '' }] })
  const next = applyFeedbackCommand(snapshot, input), saved = next.batches[0], result = assessTask(task, next, now)
  assert.equal(saved.receivedAt, received); assert.equal(saved.executionId, e.id); assert.equal(saved.receipts[0].rows[0].outcome, 'P'); assert.equal(saved.receipts.at(-1)!.rows[0].outcome, 'N'); assert.equal(saved.receipts.length, 2)
  assert.equal(next.comments[0].firstStoredAt, processed); assert.equal(next.comments[0].collectedAt, e.startedAt); assert.equal(result.onTimeDelivery, true); assert.equal(result.onTimeCompletion, false); assert.equal(result.completedAt, processed)
  assert.deepEqual(applyFeedbackCommand(next, input), next)
  const changed = structuredClone(batch); changed.rows[0].raw!.content += '另一个载荷'; assert.throws(() => ingestFeedbackBatch(next, changed, e, now), /载荷已改变/)
})
test('pending processing is atomic across rows and cannot overwrite terminal row outcomes', () => {
  const { snapshot, execution, batch } = fixture(), raw = structuredClone(snapshot.comments[0].raw); raw.storeId = batch.storeId; raw.nativeReviewId = 'pending-atomic'
  batch.id = 'pending-atomic'; batch.rows = [{ id: 'p', raw, rawNote: '', outcome: 'P', commentId: null, reason: '', processedAt: null }]; snapshot.batches = []; snapshot.executions = []; snapshot.comments = []
  ingestFeedbackBatch(snapshot, batch, declaredCollection(execution, [batch]), batch.receivedAt)
  const before = JSON.stringify(snapshot)
  assert.throws(() => applyFeedbackCommand(snapshot, command({ type: 'process-batch', batchId: batch.id, expectedVersion: 1, cleaningVersion: 'v2', results: [{ rowId: 'p', outcome: '处理', reason: '' }, { rowId: 'nonexistent', outcome: '处理', reason: '' }] })), /仍待处理/)
  assert.equal(JSON.stringify(snapshot), before)
})
test('review regression: reliable newer reply updates existing source record while its confirmed body classification remains effective', () => {
  const snapshot = createFeedbackSeed(), original = snapshot.comments.find(c => c.raw.nativeReviewId && currentClassification(c))!, batch = structuredClone(snapshot.batches.find(b => b.id === original.firstBatchId)!), execution = snapshot.executions.find(e => e.id === batch.executionId)!, raw = structuredClone(original.raw)
  const classificationId = currentClassification(original)!.id, total = snapshot.comments.length
  raw.reply = '感谢反馈，已交由商品团队处理。'; raw.replyAt = '2026-10-23T19:00:00+07:00'; raw.sourceVersion = (raw.sourceVersion || 0) + 1
  batch.id = 'reply-only-new-source-version'; batch.rows = [{ id: 'reply-row', raw, rawNote: '', outcome: 'N', commentId: null, reason: '', processedAt: null }]; batch.receipts = []
  ingestFeedbackBatch(snapshot, batch, declaredCollection(execution, [batch]), now)
  const saved = snapshot.comments.find(c => c.id === original.id)!
  assert.equal(snapshot.comments.length, total); assert.equal(snapshot.batches.at(-1)!.rows[0].outcome, 'M'); assert.equal(saved.raw.reply, raw.reply); assert.equal(saved.raw.replyAt, jakartaInstant('2026-10-23', '19:00')); assert.equal(saved.contentVersion, original.contentVersion); assert.equal(currentClassification(saved)!.id, classificationId); assert.equal(saved.history.at(-1)!.raw.reply, original.raw.reply)
})
test('review regression: declared two-batch execution waits for the late second batch and seals delivery against unknown additions', () => {
  const { snapshot, execution, batch, task } = fixture(), early = jakartaInstant('2026-10-23', '14:20'), late = jakartaInstant('2026-10-23', '19:00'), first = structuredClone(batch), second = structuredClone(batch)
  first.id = 'declared-first'; second.id = 'declared-second'; first.receivedAt = early; second.receivedAt = late
  for (const b of [first, second]) { const raw = structuredClone(snapshot.comments[0].raw); raw.storeId = b.storeId; raw.nativeReviewId = `native-${b.id}`; b.rows = [{ id: `row-${b.id}`, raw, rawNote: '', outcome: 'N', commentId: null, reason: '', processedAt: null }]; b.receipts = [] }
  const e = declaredCollection(execution, [first, second]); snapshot.executions = []; snapshot.batches = []; snapshot.comments = []
  ingestFeedbackBatch(snapshot, first, e, early)
  const partial = assessTask(task, snapshot, jakartaInstant('2026-10-23', '17:00')); assert.equal(partial.coverageComplete, true); assert.equal(partial.deliveredAt, null); assert.equal(partial.completedAt, null); assert.notEqual(partial.status, '已完成')
  ingestFeedbackBatch(snapshot, second, e, late)
  const full = assessTask(task, snapshot, now); assert.equal(full.deliveredAt, late); assert.equal(full.completedAt, late); assert.equal(full.onTimeDelivery, false)
  const retransmit = structuredClone(second); retransmit.receivedAt = now; ingestFeedbackBatch(snapshot, retransmit, e, now); assert.equal(assessTask(task, snapshot, now).deliveredAt, late)
  const extra = structuredClone(second); extra.id = 'undeclared-third'; extra.rows[0].id = 'extra-row'; extra.rows[0].raw!.nativeReviewId = 'new-native'; const before = JSON.stringify(snapshot)
  assert.throws(() => ingestFeedbackBatch(snapshot, extra, e, now), /终结清单/); assert.equal(JSON.stringify(snapshot), before); assert.equal(assessTask(task, snapshot, now).deliveredAt, late)
})
test('terminal raw row manifest cannot be shortened, forged with wrong totals, or silently replaced', () => {
  const { snapshot, execution, batch } = fixture(), e = structuredClone(execution); e.terminalReceipt!.rawCount = 1
  assert.throws(() => ingestFeedbackBatch(snapshot, batch, e, now), /终结回执/)
  const replaced = structuredClone(execution); replaced.terminalReceipt!.id = 'different-final-receipt'; const incoming = structuredClone(batch); incoming.id = 'different-batch'
  assert.throws(() => ingestFeedbackBatch(snapshot, incoming, replaced, now), /终结清单不能改写/)
})
test('zero rows need an explicit terminal receipt; finalizing missing receipt is a separate atomic fact', () => {
  const { snapshot, execution, batch, task } = fixture(), terminal = structuredClone(execution.terminalReceipt)!
  execution.terminalReceipt = null; assert.equal(assessTask(task, snapshot, now).deliveredAt, null)
  const next = applyFeedbackCommand(snapshot, command({ type: 'finish-execution', executionId: execution.id, expectedVersion: execution.version, endedAt: execution.endedAt, status: '结束', terminalReceipt: terminal }))
  assert.equal(assessTask(task, next, now).status, '已完成'); assert.equal(assessTask(task, next, now).counts.U, 0); assert.equal(next.batches[0].id, batch.id); assert.equal(assessTask(task, next, now).deliveredAt, now); assert.equal(assessTask(task, next, now).onTimeDelivery, false)
  const different = { ...terminal, batches: [{ batchId: 'missing-original-empty-batch', rowIds: [] }] }
  assert.throws(() => applyFeedbackCommand(snapshot, command({ type: 'finish-execution', executionId: execution.id, expectedVersion: execution.version, endedAt: execution.endedAt, status: '结束', terminalReceipt: different })), /包含已经接收/)
})
