import { applyPhase2Command } from './phase2-model.ts'
import { FEEDBACK_RULE_VERSION, FEEDBACK_THEMES, FEEDBACK_VALUES, type FeedbackBatch, type FeedbackClassification, type FeedbackCommand, type FeedbackComment, type FeedbackCommentFilter, type FeedbackCounts, type FeedbackExecution, type FeedbackPersonnel, type FeedbackRange, type FeedbackRawReview, type FeedbackSchedule, type FeedbackSnapshot, type FeedbackSourceRow, type FeedbackSummary, type FeedbackTask, type FeedbackTaskAssessment } from './types.ts'

export function canonicalFeedbackTime(value: string): string { if (!validDate(value.slice(0, 10)) || !/(Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error('时间必须包含有效日期、时间与时区。'); return new Date(value).toISOString() }
function validDate(value: string): boolean { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value }
function normalizedRange(range: FeedbackRange): FeedbackRange { const result = { start: canonicalFeedbackTime(range.start), end: canonicalFeedbackTime(range.end) }; if (result.start >= result.end) throw new Error('范围开始必须早于结束，结束时间不包含在内。'); return result }
function normalizeExecution(source: FeedbackExecution): FeedbackExecution {
  const e = structuredClone(source); e.startedAt = canonicalFeedbackTime(e.startedAt)
  if (e.endedAt) { e.endedAt = canonicalFeedbackTime(e.endedAt); if (e.startedAt > e.endedAt) throw new Error('采集结束时间不能早于开始。') }
  e.coverage.range = normalizedRange(e.coverage.range); e.coverage.persistedAt = canonicalFeedbackTime(e.coverage.persistedAt); e.coverage.missingRanges = e.coverage.missingRanges.map(r => ({ ...r, ...normalizedRange(r) }))
  if (e.terminalReceipt) {
    const terminal = e.terminalReceipt; terminal.endedAt = canonicalFeedbackTime(terminal.endedAt); terminal.persistedAt = canonicalFeedbackTime(terminal.persistedAt)
    if (!validTerminal(e)) throw new Error('执行终结回执须明确唯一批次、原始行清单、合计行数、结束时间与持久凭据。')
  }
  return e
}
function validTerminal(execution: FeedbackExecution): boolean {
  const terminal = execution.terminalReceipt
  return !!terminal && !!terminal.id.trim() && !!terminal.evidence.trim() && terminal.endedAt === execution.endedAt && terminal.persistedAt >= terminal.endedAt && execution.status !== '进行中'
    && terminal.batches.length > 0 && new Set(terminal.batches.map(b => b.batchId)).size === terminal.batches.length
    && terminal.batches.every(b => !!b.batchId.trim() && b.rowIds.every(id => !!id.trim()) && new Set(b.rowIds).size === b.rowIds.length)
    && Number.isInteger(terminal.rawCount) && terminal.rawCount === terminal.batches.reduce((n, b) => n + b.rowIds.length, 0)
}
function matchesDeclaredBatch(execution: FeedbackExecution, batch: FeedbackBatch): boolean {
  const declared = execution.terminalReceipt?.batches.find(b => b.batchId === batch.id)
  return !!declared && batch.executionId === execution.id && batch.taskId === execution.taskId && batch.storeId === execution.storeId
    && JSON.stringify([...declared.rowIds].sort()) === JSON.stringify(batch.rows.map(r => r.id).sort())
}
/** A sealed source manifest, rather than the batches currently visible, defines complete delivery. */
export function executionDeliveryTime(execution: FeedbackExecution, batches: FeedbackBatch[]): string | null {
  if (!validTerminal(execution)) return null
  const own = batches.filter(b => b.executionId === execution.id), terminal = execution.terminalReceipt!
  if (own.length !== terminal.batches.length || own.some(b => !matchesDeclaredBatch(execution, b) || !b.durable || !b.receipts.length)) return null
  return maxTime([execution.endedAt, execution.coverage.persistedAt, terminal.persistedAt, ...own.map(b => b.receivedAt)])
}
export function jakartaDate(at: string = new Date().toISOString()): string { return new Date(Date.parse(at) + 7 * 3600000).toISOString().slice(0, 10) }
export function dateShift(date: string, days: number): string { return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10) }
export function jakartaInstant(date: string, time = '00:00'): string { return new Date(`${date}T${time}:00+07:00`).toISOString() }
export function dailyWindow(date: string): { target: FeedbackRange; core: FeedbackRange; deadline: string } { return { target: { start: jakartaInstant(dateShift(date, -7)), end: jakartaInstant(date) }, core: { start: jakartaInstant(dateShift(date, -1)), end: jakartaInstant(date) }, deadline: jakartaInstant(date, '18:00') } }
export function buildDailyTasks(schedules: FeedbackSchedule[], start: string, end: string): FeedbackTask[] {
  const result: FeedbackTask[] = []
  for (let date = start; date <= end; date = dateShift(date, 1)) for (const storeId of new Set(schedules.map(x => x.storeId))) {
    const schedule = schedules.filter(x => x.storeId === storeId && x.status === '已启用' && x.effectiveDate <= date).sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0]
    if (!schedule) continue
    result.push({ id: `feedback-task-${storeId}-${date}`, storeId, owner: schedule.owner, type: '日常采集', businessDate: date, ...dailyWindow(date), scheduleId: schedule.id, scheduleVersion: schedule.version, scope: '全店评价入口', listingIds: [], createdAt: jakartaInstant(date), reason: '每日固定七日范围，全部评分', version: 1 })
  }
  return result
}
export function emptyCounts(): FeedbackCounts { return { U: 0, N: 0, M: 0, D: 0, X: 0, F: 0, P: 0 } }
export function batchCounts(batch: Pick<FeedbackBatch, 'rows'>): FeedbackCounts { const counts = emptyCounts(); for (const row of batch.rows) { counts.U++; counts[row.outcome]++ } return counts }
export function batchStatus(batch: FeedbackBatch): string { const counts = batchCounts(batch); return counts.F ? '有失败异常' : counts.P === counts.U && counts.P > 0 ? '待处理' : counts.P ? '处理中' : '处理完成' }
function maxTime(values: Array<string | null | undefined>): string | null { const sorted = values.filter((x): x is string => Boolean(x)).sort(); return sorted.at(-1) || null }
function overlap(a: FeedbackRange, b: FeedbackRange): boolean { return a.start < b.end && b.start < a.end }
function covers(target: FeedbackRange, ranges: FeedbackRange[]): boolean {
  let cursor = target.start
  for (const range of [...ranges].sort((a, b) => a.start.localeCompare(b.start))) { if (range.start > cursor) break; if (range.end > cursor) cursor = range.end; if (cursor >= target.end) return true }
  return false
}
export function executionRanges(execution: FeedbackExecution): FeedbackRange[] {
  let ranges = [execution.coverage.range]
  for (const gap of execution.coverage.missingRanges) ranges = ranges.flatMap(range => !overlap(range, gap) ? [range] : [range.start < gap.start ? { start: range.start, end: gap.start } : null, gap.end < range.end ? { start: gap.end, end: range.end } : null].filter((x): x is FeedbackRange => !!x))
  return ranges
}
function validExecution(execution: FeedbackExecution): boolean { const c = execution.coverage; return execution.status === '结束' && !!execution.endedAt && execution.startedAt <= execution.endedAt && c.range.start < c.range.end && c.verified && c.allRatings && c.includesRatingOnly && c.includesWithoutImages && !!c.endReason.trim() && !!c.evidence.trim() }
export function usableCoverage(execution: FeedbackExecution): boolean { return validExecution(execution) || execution.status === '失败' && execution.coverage.missingRanges.length > 0 && validExecution({ ...execution, status: '结束' }) }
function coverageSatisfied(task: FeedbackTask, executions: FeedbackExecution[]): boolean {
  const fullStore = executions.filter(e => e.coverage.scope === '全店评价入口' && e.coverage.missingListingIds.length === 0)
  if (covers(task.target, fullStore.flatMap(executionRanges))) return true
  if (task.scope === '全店评价入口' || !task.listingIds.length) return false
  return task.listingIds.every(id => covers(task.target, executions.filter(e => !e.coverage.missingListingIds.includes(id) && (e.coverage.scope === '全店评价入口' || e.coverage.listingIds.includes(id))).flatMap(executionRanges)))
}
export function assessTask(task: FeedbackTask, snapshot: FeedbackSnapshot, now = new Date().toISOString()): FeedbackTaskAssessment {
  now = canonicalFeedbackTime(now)
  const executions = snapshot.executions.filter(e => snapshot.tasks.some(t => t.id === e.taskId && t.storeId === e.storeId) && e.storeId === task.storeId && (e.taskId === task.id || overlap(e.coverage.range, task.target)) && (task.type === '历史补采' || e.startedAt >= jakartaInstant(task.businessDate)))
  let visible = executions.filter(e => e.startedAt <= now)
  let batches = snapshot.batches.filter(b => visible.some(e => e.id === b.executionId) && b.receivedAt <= now)
  const valid = visible.filter(e => usableCoverage(e) && e.coverage.persistedAt <= now && !!e.endedAt && e.endedAt <= now)
  const received = valid.filter(e => { const time = executionDeliveryTime(e, batches); return !!time && time <= now })
  const coverageComplete = coverageSatisfied(task, valid)
  const receiptTime = (e: FeedbackExecution) => executionDeliveryTime(e, batches)!
  const deliveryPoints = [...new Set(received.map(receiptTime))].sort()
  const deliveredAt = deliveryPoints.find(at => coverageSatisfied(task, received.filter(e => receiptTime(e) <= at))) || null
  // The source manifest fixes required payloads; unrelated later executions cannot rewrite first completion.
  const completionPoints = [...new Set([...deliveryPoints, ...batches.flatMap(b => [b.processingEndedAt, ...b.rows.flatMap(r => [r.processedAt, r.repairedBy?.at])])].filter((x): x is string => !!x && x <= now))].sort()
  const completedAt = completionPoints.find(point => {
    if (!deliveredAt || point < deliveredAt || !coverageSatisfied(task, received.filter(e => receiptTime(e) <= point))) return false
    const atBatches = batches.filter(b => b.receivedAt <= point)
    return atBatches.every(b => b.durable && b.receipts.length > 0 && JSON.stringify(b.receipts.at(-1)!.counts) === JSON.stringify(batchCounts(b)) && b.rows.every(r => r.repairedBy ? r.repairedBy.at <= point : !['F', 'P'].includes(r.outcome) && !!r.processedAt && r.processedAt <= point) && (b.rows.length > 0 || !!b.processingEndedAt && b.processingEndedAt <= point))
  }) || null
  if (completedAt) { visible = visible.filter(e => e.startedAt <= completedAt); batches = batches.filter(b => b.receivedAt <= completedAt) }
  const counts = emptyCounts(); for (const batch of batches) { const c = batchCounts(batch); for (const key of Object.keys(counts) as Array<keyof FeedbackCounts>) counts[key] += c[key] }
  const unresolved = batches.reduce((n, b) => n + b.rows.filter(r => ['F', 'P'].includes(r.outcome) && !r.repairedBy).length, 0)
  const repaired = batches.reduce((n, b) => n + b.rows.filter(r => !!r.repairedBy).length, 0)
  const hasUndurable = batches.some(b => !b.durable)
  const receiptMismatch = batches.some(b => { const last = b.receipts.at(-1); return last && JSON.stringify(last.counts) !== JSON.stringify(batchCounts(b)) })
  const complete = !!completedAt
  const gaps: string[] = []
  if (!visible.length) gaps.push('尚无符合本任务日期要求的新鲜执行；旧文件重传不替代当日采集。')
  else if (!coverageComplete) { gaps.push(valid.length ? '规定时间窗口或链接范围未全部覆盖。' : '覆盖证据、全部评分条件或正常结束依据尚未核验。'); for (const e of visible) for (const gap of e.coverage.missingRanges) gaps.push(`${gap.start} ～ ${gap.end}：${gap.reason}`); for (const e of visible) if (e.failure) gaps.push(e.failure) }
  if (hasUndurable) gaps.push('原始数据尚未可靠保存，不能认定完成交付。')
  if (unresolved) gaps.push(`${unresolved} 条来源记录仍有处理或保存缺口。`)
  if (receiptMismatch) gaps.push('批次回执数量与当前处理去向不一致。')
  if (coverageComplete && !deliveredAt) gaps.push('范围已覆盖，执行终结清单、全部声明批次及原始数据的持久接收回执尚未齐备。')
  const failedOnly = visible.length > 0 && visible.every(e => e.status === '失败') && valid.length === 0
  const status = complete ? '已完成' : !visible.length ? '未开始' : failedOnly ? '失败' : visible.some(e => !e.endedAt) ? '进行中' : '部分完成'
  const executionStatus = coverageComplete ? '范围完成' : !visible.length ? '未开始' : failedOnly ? '失败' : visible.some(e => !e.endedAt) ? '进行中' : visible.some(e => !e.coverage.verified) ? '覆盖待核验' : '部分完成'
  const processingStatus = !batches.length ? '未接收' : batches.some(b => b.rows.some(r => r.outcome === 'F' && !r.repairedBy)) ? '存在失败异常' : batches.some(b => b.rows.some(r => r.outcome === 'P' && !r.repairedBy)) ? counts.P === counts.U ? '已接收待处理' : '处理中' : '处理完成'
  return { status, executionStatus, processingStatus, coverageComplete, deliveredAt, completedAt, due: task.deadline <= now, overdue: task.deadline < now && (!completedAt || completedAt > task.deadline), onTimeDelivery: !!deliveredAt && deliveredAt <= task.deadline, onTimeCompletion: !!completedAt && completedAt <= task.deadline, gaps, counts, unresolved, repaired, batchIds: batches.map(b => b.id), executionIds: visible.map(e => e.id), lastActivityAt: maxTime([task.createdAt, ...visible.map(e => e.endedAt || e.startedAt), ...batches.map(b => b.processingEndedAt || b.receivedAt)])! }
}
export function currentClassification(comment: FeedbackComment): FeedbackClassification | null { return [...comment.classifications].reverse().find(c => c.state === '已确认' && c.contentVersion === comment.contentVersion) || null }
export function classificationStatus(comment: FeedbackComment): string { const current = currentClassification(comment), last = comment.classifications.at(-1); if (current) return last && last.id !== current.id && ['草稿', '待复核'].includes(last.state) ? '已确认，另有待复核修改' : '已确认'; if (last && last.contentVersion !== comment.contentVersion) return '内容已更新，待复核'; return last?.state === '已撤回' ? '待复核' : last?.state || '未分类' }
export function filterComments(comments: FeedbackComment[], filter: FeedbackCommentFilter): FeedbackComment[] {
  return comments.filter(comment => {
    const c = comment.raw, a = comment.association, cls = currentClassification(comment)
    if (filter.storeId && c.storeId !== filter.storeId || filter.channel && c.channel !== filter.channel || filter.styleId && a.styleId !== filter.styleId || filter.skuId && a.skuId !== filter.skuId || filter.listingId && a.listingId !== filter.listingId || filter.platformProductId && !c.platformProductId.includes(filter.platformProductId)) return false
    if (filter.search && ![c.content, c.author, c.orderNo, c.sellerSku, c.platformProductId, comment.id, a.styleId, a.skuId].join(' ').toLowerCase().includes(filter.search.toLowerCase())) return false
    if (filter.rating && (filter.rating === '差评' ? !(c.rating === 1 || c.rating === 2) : filter.rating === '中评' ? c.rating !== 3 : filter.rating === '好评' ? !(c.rating === 4 || c.rating === 5) : filter.rating === '未评分' ? c.rating !== null : String(c.rating) !== filter.rating)) return false
    if (filter.classification && (filter.classification === '未确认' ? !!cls : !classificationStatus(comment).includes(filter.classification))) return false
    if (filter.value && cls?.value !== filter.value || (filter.theme || filter.sentiment) && !cls?.tags.some(t => (!filter.theme || t.theme === filter.theme) && (!filter.sentiment || t.sentiment === filter.sentiment))) return false
    if (filter.association && a.status !== filter.association || filter.hasImages && !c.images.length) return false
    if (filter.batchId && !comment.observations.some(o => o.batchId === filter.batchId) || filter.taskId && comment.firstTaskId !== filter.taskId) return false
    const unknown = !c.commentAt || c.timeQuality !== '可信'
    if (filter.unknownTimeOnly) return unknown
    const time = filter.dateType === 'stored' ? comment.firstStoredAt : filter.dateType === 'collected' ? comment.collectedAt : c.commentAt
    if ((filter.start || filter.end) && (filter.dateType === 'comment' || !filter.dateType) && unknown) return false
    if (filter.start && (!time || time < (filter.start.length === 10 ? jakartaInstant(filter.start) : filter.start))) return false
    if (filter.end && (!time || time >= (filter.end.length === 10 ? jakartaInstant(dateShift(filter.end, 1)) : filter.end))) return false
    return true
  })
}
export function summarizeComments(comments: FeedbackComment[]): FeedbackSummary {
  const unique = [...new Map(comments.map(c => [c.id, c])).values()], rated = unique.filter(c => Number.isInteger(c.raw.rating) && c.raw.rating! >= 1 && c.raw.rating! <= 5)
  const negative = rated.filter(c => c.raw.rating! <= 2).length, classified = unique.filter(c => currentClassification(c)), themes = FEEDBACK_THEMES.map(theme => {
    const matched = unique.filter(c => currentClassification(c)?.tags.some(t => t.theme === theme))
    return { theme, total: matched.length, problem: matched.filter(c => currentClassification(c)?.tags.some(t => t.theme === theme && t.sentiment === '问题')).length, positive: matched.filter(c => currentClassification(c)?.tags.some(t => t.theme === theme && t.sentiment === '正向')).length, rate: unique.length ? matched.length / unique.length : null, commentIds: matched.map(c => c.id) }
  })
  return { total: unique.length, rated: rated.length, average: rated.length ? rated.reduce((n, c) => n + c.raw.rating!, 0) / rated.length : null, negative, neutral: rated.filter(c => c.raw.rating === 3).length, positive: rated.filter(c => c.raw.rating! >= 4).length, negativeRate: rated.length ? negative / rated.length : null, ratingOnly: unique.filter(c => !c.raw.content.trim()).length, withContent: unique.filter(c => c.raw.content.trim()).length, withImages: unique.filter(c => c.raw.images.length).length, unclassified: unique.length - classified.length, classified: classified.length, unknownSku: unique.filter(c => !c.association.skuId).length, unknownTime: unique.filter(c => !c.raw.commentAt || c.raw.timeQuality !== '可信').length, smallSample: rated.length > 0 && rated.length < 20, problemComments: unique.filter(c => currentClassification(c)?.tags.some(t => t.sentiment === '问题')).length, positiveFeedback: unique.filter(c => currentClassification(c)?.tags.some(t => t.sentiment === '正向')).length, stars: [1, 2, 3, 4, 5].map(star => rated.filter(c => c.raw.rating === star).length), themes }
}
export function personnelSummary(snapshot: FeedbackSnapshot, tasks = snapshot.tasks, now = new Date().toISOString()): FeedbackPersonnel[] {
  const daily = tasks.filter(t => t.type === '日常采集')
  return [...new Set([...daily.map(t => t.owner), ...snapshot.executions.filter(e => tasks.some(t => t.id === e.taskId)).map(e => e.collector)])].map(owner => {
    const own = daily.filter(t => t.owner === owner), due = own.filter(t => t.deadline <= now), states = due.map(t => assessTask(t, snapshot, now)), ids = new Set(tasks.map(t => t.id))
    const executions = snapshot.executions.filter(e => e.collector === owner && ids.has(e.taskId)), batches = snapshot.batches.filter(b => executions.some(e => e.id === b.executionId)), sums = emptyCounts()
    for (const b of batches) for (const key of Object.keys(sums) as Array<keyof FeedbackCounts>) sums[key] += batchCounts(b)[key]
    const onTimeDelivery = states.filter(s => s.onTimeDelivery).length, completed = states.filter(s => s.status === '已完成').length, onTimeCompletion = states.filter(s => s.onTimeCompletion).length
    return { owner, due: due.length, onTimeDelivery, completed, onTimeCompletion, lateCompletion: completed - onTimeCompletion, incomplete: due.length - completed, upcoming: own.length - due.length, deliveryRate: due.length ? onTimeDelivery / due.length : null, completionRate: due.length ? completed / due.length : null, executions: executions.length, newComments: snapshot.comments.filter(c => c.firstCollector === owner && ids.has(c.firstTaskId)).length, updated: sums.M, duplicates: sums.D, excluded: sums.X, unresolved: batches.reduce((n, b) => n + b.rows.filter(r => ['F', 'P'].includes(r.outcome) && !r.repairedBy).length, 0), collaboration: new Set(executions.filter(e => snapshot.tasks.find(t => t.id === e.taskId)?.owner !== owner).map(e => e.taskId)).size }
  })
}

/** UTF-8 MD5 of the versioned, length-safe JSON tuple; translations and labels never enter identity. */
export function feedbackMd5(value: string): string {
  const bytes = new TextEncoder().encode(value), size = Math.ceil((bytes.length + 9) / 64) * 64, data = new Uint8Array(size); data.set(bytes); data[bytes.length] = 128
  const view = new DataView(data.buffer); view.setUint32(size - 8, bytes.length * 8, true); view.setUint32(size - 4, Math.floor(bytes.length / 536870912), true)
  const shifts = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21], constants = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0)
  let a0 = 0x67452301, b0 = 0xefcdab89 | 0, c0 = 0x98badcfe | 0, d0 = 0x10325476
  for (let offset = 0; offset < size; offset += 64) { let a = a0, b = b0, c = c0, d = d0
    for (let i = 0; i < 64; i++) { const phase = Math.floor(i / 16), f = phase === 0 ? (b & c) | (~b & d) : phase === 1 ? (d & b) | (~d & c) : phase === 2 ? b ^ c ^ d : c ^ (b | ~d), g = phase === 0 ? i : phase === 1 ? (5 * i + 1) % 16 : phase === 2 ? (3 * i + 5) % 16 : 7 * i % 16, shift = shifts[phase * 4 + i % 4], sum = (a + f + constants[i] + view.getInt32(offset + g * 4, true)) | 0; a = d; d = c; c = b; b = (b + ((sum << shift) | (sum >>> (32 - shift)))) | 0 }
    a0 = (a0 + a) | 0; b0 = (b0 + b) | 0; c0 = (c0 + c) | 0; d0 = (d0 + d) | 0
  }
  return [a0, b0, c0, d0].map(x => [0, 8, 16, 24].map(s => ((x >>> s) & 255).toString(16).padStart(2, '0')).join('')).join('')
}
export function reviewIdentity(raw: FeedbackRawReview): string { const scope = [raw.channel, raw.market, raw.storeId, raw.platformProductId]; return raw.nativeReviewId ? JSON.stringify([...scope, 'native-v1', raw.nativeReviewId]) : JSON.stringify([...scope, 'md5-json-utf8-v1', feedbackMd5(JSON.stringify([raw.platformProductId, raw.author, raw.content, raw.rating, raw.commentAt, raw.timePrecision]))]) }
function assertReview(raw: FeedbackRawReview): void { if (!raw.author.trim()) throw new Error('来源评论者为必填字段，不能以默认姓名补齐。'); if (!raw.storeId || !raw.platformProductId || typeof raw.platformProductId !== 'string') throw new Error('来源店铺和文本格式平台商品 ID 必填。'); if (raw.rating !== null && (!Number.isInteger(raw.rating) || raw.rating < 1 || raw.rating > 5)) throw new Error('评分须为 1～5，未取得评分请保留为空。') }
function processSourceRow(snapshot: FeedbackSnapshot, batch: FeedbackBatch, execution: FeedbackExecution, row: FeedbackSourceRow, at: string): void {
  if (!row.raw) throw new Error('新增、更新或重复评论必须具有完整原始评论，不能将空原始记录计为成功。')
  assertReview(row.raw)
  if (row.raw.storeId !== batch.storeId) throw new Error('评论来源店铺与批次不一致。')
  const identityKey = reviewIdentity(row.raw), existing = snapshot.comments.find(c => c.identityKey === identityKey)
  if (existing) {
    row.commentId = existing.id
    const bodyChanged = row.raw.content !== existing.raw.content || row.raw.rating !== existing.raw.rating || JSON.stringify(row.raw.images) !== JSON.stringify(existing.raw.images)
    const sourceChanged = JSON.stringify(row.raw) !== JSON.stringify(existing.raw)
    const newer = row.raw.sourceVersion !== null && existing.raw.sourceVersion !== null ? row.raw.sourceVersion > existing.raw.sourceVersion : !!row.raw.platformModifiedAt && !!existing.raw.platformModifiedAt && row.raw.platformModifiedAt > existing.raw.platformModifiedAt
    row.outcome = sourceChanged && newer ? 'M' : 'D'
    if (row.outcome === 'M') {
      existing.history.push({ version: existing.contentVersion, raw: structuredClone(existing.raw), batchId: batch.id, observedAt: at, reason: bodyChanged ? '来源可比较版本更新，正文／评分／媒体需重新复核' : '来源回复或其他字段更新，正文分类继续有效' })
      existing.raw = structuredClone(row.raw); if (bodyChanged) existing.contentVersion++; existing.updatedAt = at
    }
    existing.lastObservedAt = at; existing.version++; existing.observations.push({ batchId: batch.id, rowId: row.id, at, result: sourceChanged && !newer ? '来源版本不可比较或迟到，仅保留观察' : row.outcome })
  } else {
    row.outcome = 'N'; row.commentId = `feedback-comment-${feedbackMd5(identityKey)}`
    snapshot.comments.push({ id: row.commentId, identityKey, identityMethod: row.raw.nativeReviewId ? '平台原生 ID' : '组合指纹', fingerprintVersion: 'md5-json-utf8-v1', raw: structuredClone(row.raw), contentVersion: 1, version: 1, firstBatchId: batch.id, firstExecutionId: execution.id, firstTaskId: batch.taskId, firstCollector: execution.collector, collectedAt: execution.startedAt, firstStoredAt: at, lastObservedAt: at, updatedAt: at, association: { listingId: row.raw.listingId, styleId: '', skuId: null, mappingVersion: null, evidence: '来源链接已记录，内部规格未确定', sourceEventAt: null, status: 'SKU 未确定', version: 1, actor: '采集来源', at }, associationHistory: [], classifications: [], history: [], observations: [{ batchId: batch.id, rowId: row.id, at, result: 'N' }] })
  }
  row.processedAt = at
}
function assertBatchAssociation(snapshot: FeedbackSnapshot, batch: FeedbackBatch, execution: FeedbackExecution): void {
  const task = snapshot.tasks.find(t => t.id === execution.taskId)
  if (!task || task.storeId !== execution.storeId || batch.taskId !== task.id || batch.storeId !== execution.storeId || batch.executionId !== execution.id || batch.collector !== execution.collector) throw new Error('批次、执行和任务的身份、店铺及采集人必须一致，任务须存在。')
}
function sourcePayload(batch: FeedbackBatch): string { return JSON.stringify([batch.storeId, batch.executionId, batch.taskId, batch.collector, batch.rows.map(r => [r.id, r.raw, r.rawNote])]) }
export function ingestFeedbackBatch(snapshot: FeedbackSnapshot, incoming: FeedbackBatch, execution: FeedbackExecution, at: string): void {
  // Public callers, like the IndexedDB command path, receive all-or-nothing changes.
  const next = structuredClone(snapshot); ingestBatchInPlace(next, incoming, execution, at); Object.assign(snapshot, next)
}
function ingestBatchInPlace(snapshot: FeedbackSnapshot, incoming: FeedbackBatch, execution: FeedbackExecution, at: string): void {
  at = canonicalFeedbackTime(at); execution = normalizeExecution(execution); incoming = structuredClone(incoming); incoming.receivedAt = canonicalFeedbackTime(incoming.receivedAt)
  if (incoming.processingStartedAt) incoming.processingStartedAt = canonicalFeedbackTime(incoming.processingStartedAt)
  if (incoming.processingEndedAt) incoming.processingEndedAt = canonicalFeedbackTime(incoming.processingEndedAt)
  for (const row of incoming.rows) {
    if (!['N', 'M', 'D', 'X', 'F', 'P'].includes(row.outcome)) throw new Error('原始行处理去向无效。')
    if (['N', 'M', 'D'].includes(row.outcome) && !row.raw) throw new Error('新增、更新或重复评论必须具有完整原始评论，不能将空原始记录计为成功。')
    if (row.raw) { assertReview(row.raw); if (row.raw.storeId !== incoming.storeId) throw new Error('评论来源店铺与批次不一致。'); for (const field of ['commentAt', 'platformModifiedAt', 'replyAt'] as const) if (row.raw[field]) row.raw[field] = canonicalFeedbackTime(row.raw[field]) }
  }
  assertBatchAssociation(snapshot, incoming, execution)
  if (new Set(incoming.rows.map(r => r.id)).size !== incoming.rows.length || incoming.rows.some(r => !r.id.trim())) throw new Error('同一批次的原始行编号必须非空且唯一。')
  const previous = snapshot.batches.find(b => b.id === incoming.id)
  if (previous) {
    if (sourcePayload(previous) !== sourcePayload(incoming)) throw new Error('批次身份或载荷已改变，请使用新批次并关联原来源。')
    previous.attempts.push({ at, result: '同载荷重试，返回既有回执；待处理行由后处理动作推进' }); previous.version++; return
  }
  const priorExecution = snapshot.executions.find(e => e.id === execution.id)
  if (priorExecution && (JSON.stringify([priorExecution.storeId, priorExecution.taskId, priorExecution.collector, priorExecution.startedAt, priorExecution.toolVersion, priorExecution.terminalReceipt]) !== JSON.stringify([execution.storeId, execution.taskId, execution.collector, execution.startedAt, execution.toolVersion, execution.terminalReceipt]))) throw new Error('既有采集执行及终结清单不能改写；新增采集须创建新执行，首次终结请使用结束动作。')
  if (execution.terminalReceipt && !matchesDeclaredBatch(execution, incoming)) throw new Error('批次或原始行不在已封存的执行终结清单中，不能追加到已结束执行。')
  const batch = structuredClone(incoming); batch.payloadDigest = feedbackMd5(sourcePayload(batch)); batch.receipts = []; batch.version = 1
  for (const row of batch.rows) {
    if (['F', 'P', 'X'].includes(row.outcome)) { if (row.outcome !== 'P' && !row.reason.trim()) throw new Error('失败或确定排除必须说明来源原因。'); row.commentId = null; row.processedAt = row.outcome === 'P' ? null : at; continue }
    processSourceRow(snapshot, batch, execution, row, at)
  }
  if (batch.rows.some(r => r.outcome === 'P')) batch.processingEndedAt = null
  else batch.processingEndedAt = at
  for (const repair of batch.repairReferences || []) {
    const originalBatch = snapshot.batches.find(b => b.id === repair.originalBatchId), original = originalBatch?.rows.find(r => r.id === repair.originalRowId), saved = batch.rows.find(r => r.id === repair.repairedRowId)
    if (!original || !['F', 'P'].includes(original.outcome) || !original.raw || !saved?.raw || !saved.commentId || !['N', 'M', 'D'].includes(saved.outcome) || reviewIdentity(original.raw) !== reviewIdentity(saved.raw) || !repair.evidence.trim()) throw new Error('修复引用必须逐条证明同一来源评论已可靠保存，不能笼统关闭失败。')
    original.repairedBy = { batchId: batch.id, rowId: saved.id, at, actor: repair.actor, evidence: repair.evidence }; originalBatch!.version++
    const comment = snapshot.comments.find(c => c.id === saved.commentId)!
    if (saved.outcome === 'N') { const originalExecution = snapshot.executions.find(e => e.id === originalBatch!.executionId)!; comment.firstCollector = originalExecution.collector; comment.firstExecutionId = originalExecution.id; comment.firstTaskId = originalBatch!.taskId; comment.collectedAt = originalExecution.startedAt }
  }
  batch.receipts.push({ version: batch.version, at, counts: batchCounts(batch), rows: structuredClone(batch.rows) }); snapshot.batches.push(batch)
  if (!priorExecution) snapshot.executions.push(structuredClone(execution))
}
function processFeedbackBatch(snapshot: FeedbackSnapshot, command: Extract<FeedbackCommand, { type: 'process-batch' }>, at: string): void {
  const batch = snapshot.batches.find(b => b.id === command.batchId), execution = batch && snapshot.executions.find(e => e.id === batch.executionId)
  if (!batch || !execution || batch.version !== command.expectedVersion) throw new Error('批次已变化，请重新读取当前待处理回执。')
  assertBatchAssociation(snapshot, batch, execution)
  if (!batch.durable || !command.cleaningVersion.trim() || !command.results.length || new Set(command.results.map(r => r.rowId)).size !== command.results.length) throw new Error('后处理须指定已持久接收的批次、清洗版本和互不重复的原始行。')
  for (const result of command.results) {
    const row = batch.rows.find(r => r.id === result.rowId)
    if (!row || row.outcome !== 'P' || row.repairedBy) throw new Error('只可推进仍待处理的原始行；已有终态须保留原回执。')
    if (result.outcome === '处理') processSourceRow(snapshot, batch, execution, row, at)
    else { if (!['F', 'X'].includes(result.outcome) || !result.reason.trim()) throw new Error('失败或排除必须逐条填写依据。'); row.outcome = result.outcome; row.commentId = null; row.reason = result.reason; row.processedAt = at }
  }
  batch.processingStartedAt ||= at; batch.processingEndedAt = batch.rows.some(r => r.outcome === 'P') ? null : at; batch.cleaningVersion = command.cleaningVersion; batch.version++
  batch.receipts.push({ version: batch.version, at, counts: batchCounts(batch), rows: structuredClone(batch.rows) })
}

export function applyFeedbackCommand(previous: FeedbackSnapshot, command: FeedbackCommand): FeedbackSnapshot {
  command = structuredClone(command)
  const snapshot = structuredClone(previous), at = canonicalFeedbackTime(command.at || new Date().toISOString()), actor = command.actor.trim()
  if (!actor || !command.operationId.trim()) throw new Error('请填写操作人，操作编号不可为空。')
  const commandDigest = feedbackMd5(JSON.stringify({ ...command, at: undefined })), previousOperation = snapshot.logs.find(l => l.id === command.operationId)
  if (previousOperation) { if (previousOperation.payloadDigest && previousOperation.payloadDigest !== commandDigest) throw new Error('同一操作编号不能提交不同内容，请重新发起操作。'); return snapshot }
  let objectId = '', detail = ''
  const commentFor = (id: string, version: number) => { const c = snapshot.comments.find(c => c.id === id); if (!c) throw new Error('评论不存在，请重新读取。'); if (c.version !== version) throw new Error('评论已被其他操作更新，输入已保留，请重新读取。'); return c }
  if (command.type.startsWith('p2-')) { const result = applyPhase2Command(snapshot, command, actor, at); objectId = result.objectId; detail = result.detail }
  else if (command.type === 'save-review-draft') {
    const d = command.draft, prior = snapshot.reviewDrafts.find(x => x.id === d.id)
    if ((prior?.version || 0) !== command.expectedVersion) throw new Error('核查工作草稿已变化，请重新读取。')
    if (d.kind === 'coverage' ? !snapshot.executions.some(e => e.id === d.objectId) : !snapshot.tasks.some(t => t.id === d.objectId)) throw new Error('工作草稿对应任务或执行不存在。')
    snapshot.reviewDrafts = [...snapshot.reviewDrafts.filter(x => x.id !== d.id), { ...d, resolved: false, version: (prior?.version || 0) + 1, updatedAt: at, actor }]; objectId = d.objectId; detail = '仅保存工作输入，任务状态保持不变'
  } else if (command.type === 'save-history-draft') {
    const d = command.draft, prior = snapshot.historyDrafts.find(x => x.id === d.id)
    if (!d.storeId || !d.owner.trim()) throw new Error('草稿仍须指定店铺及负责人。')
    if ((prior?.version || 0) !== command.expectedVersion) throw new Error('历史计划草稿已更新，请重新读取。')
    if (prior?.resolved) throw new Error('该草稿已生成任务，修改范围请建立新的计划。')
    snapshot.historyDrafts = [...snapshot.historyDrafts.filter(x => x.id !== d.id), { ...d, version: (prior?.version || 0) + 1, updatedAt: at, actor }]; objectId = d.id; detail = '历史计划草稿，未生成可考核任务'
  } else if (command.type === 'create-history-plan') {
    if (!command.tasks.length) throw new Error('请先预览至少一个历史补采分段。')
    if (command.draftId && snapshot.historyDrafts.find(d => d.id === command.draftId)?.resolved) throw new Error('该草稿已经生成任务，请查看原计划。')
    for (const [index, task] of command.tasks.entries()) Object.assign(snapshot, applyFeedbackCommand(snapshot, { ...command, type: 'create-history', task, operationId: `${command.operationId}-segment-${index}`, at }))
    if (command.draftId) { const draft = snapshot.historyDrafts.find(d => d.id === command.draftId); if (draft) { draft.resolved = true; draft.generatedTaskIds = command.tasks.map(t => t.id); draft.version++; draft.updatedAt = at } }
    objectId = command.tasks.map(t => t.id).join(','); detail = `${command.tasks.length} 段历史任务共同保存`
  } else if (command.type === 'save-schedule') {
    const value = command.schedule, prior = snapshot.schedules.find(s => s.id === value.id)
    if (!value.storeId) throw new Error('请选择店铺。')
    if (value.status === '已启用' && (!value.owner.trim() || !validDate(value.effectiveDate))) throw new Error('启用时店铺、负责人和有效日期必须填写。')
    if (value.effectiveDate && !validDate(value.effectiveDate)) throw new Error('生效日期格式无效。')
    if ((prior?.version || 0) !== command.expectedVersion) throw new Error('采集安排已变更，请重新读取。')
    if (prior?.status === '已启用') throw new Error('已启用安排保留历史，请新建未来生效版本。')
    const existing = snapshot.schedules.filter(s => s.storeId === value.storeId && s.status === '已启用')
    if (value.status === '已启用' && (snapshot.tasks.some(t => t.storeId === value.storeId && t.businessDate >= value.effectiveDate) || existing.length && value.effectiveDate <= jakartaDate(at))) throw new Error('新安排只能从未来尚未生成任务的日期生效。')
    if (value.status === '已启用' && existing.some(s => s.effectiveDate === value.effectiveDate)) throw new Error('同店同日已有生效安排，请调整生效日期。')
    if (value.status === '已启用' && existing.length && !value.reason.trim()) throw new Error('未来长期安排变更请填写原因。')
    const next = { ...value, version: (prior?.version || 0) + 1, createdAt: prior?.createdAt || at, updatedAt: at, actor }
    snapshot.schedules = [...snapshot.schedules.filter(s => s.id !== value.id), next]; objectId = value.id; detail = `${value.owner}；${value.effectiveDate} 生效；不变更已生成任务`
    if (value.status === '已启用') {
      const firstTask = buildDailyTasks(snapshot.schedules, value.effectiveDate, value.effectiveDate).find(task => task.storeId === value.storeId)
      if (firstTask && !snapshot.tasks.some(task => task.id === firstTask.id)) snapshot.tasks.push({ ...firstTask, createdAt: at, reason: '启用安排时生成首个生效日任务；后续定时调度尚未接通' })
    }
  } else if (command.type === 'create-history') {
    const t = command.task
    t.target = normalizedRange(t.target); t.deadline = canonicalFeedbackTime(t.deadline)
    if (!t.storeId || !t.owner.trim() || !t.reason.trim() || !t.stockCheck?.trim() || !t.target.start || t.target.start >= t.target.end || !t.deadline || t.deadline <= at) throw new Error('请填写店铺、负责人、有效历史范围、未来截止、存量核对和补采原因。')
    if (t.target.end > jakartaInstant(jakartaDate(at))) throw new Error('历史补采范围不能包含尚未结束的自然日。')
    if (t.scope === '指定链接' && !t.listingIds.length) throw new Error('指定链接范围至少选择一个商品链接。')
    const overlapTasks = snapshot.tasks.filter(old => old.storeId === t.storeId && overlap(old.target, t.target))
    if (overlapTasks.some(old => old.type === '历史补采' && old.target.start === t.target.start && old.target.end === t.target.end && old.scope === t.scope && JSON.stringify([...old.listingIds].sort()) === JSON.stringify([...t.listingIds].sort()))) throw new Error('已有相同历史补采任务，请复用原任务。')
    if (overlapTasks.length && !command.allowOverlap) throw new Error('补采范围与已有任务重叠，请核对并明确本次用途。')
    snapshot.tasks.push({ ...t, type: '历史补采', core: t.target, scheduleVersion: 1, version: 1, createdAt: at }); objectId = t.id; detail = `${t.target.start} 至 ${t.target.end}；历史进度不进入每日考核`
  } else if (command.type === 'save-classification') {
    const comment = commentFor(command.commentId, command.expectedVersion)
    if (comment.contentVersion !== command.expectedContentVersion) throw new Error('原文或评分已更新，请重新核对当前内容后分类。')
    if (!FEEDBACK_VALUES.includes(command.value)) throw new Error('请选择有效信息量。')
    if (command.tags.some(t => !FEEDBACK_THEMES.includes(t.theme))) throw new Error('主题必须来自已确认字典。')
    if (command.state === '已确认') {
      if (command.value === '待判断') throw new Error('待判断不能作为确认终态。')
      if (command.value === '仅评分' && comment.raw.content.trim()) throw new Error('该评论有正文，不能归为仅评分。')
      if (command.value === '信息不足（已复核）' && !command.note.trim()) throw new Error('请说明复核后信息仍不足的原因。')
      if (command.tags.some(t => !t.evidence.trim() || !comment.raw.content.includes(t.evidence) && !comment.raw.images.includes(t.evidence))) throw new Error('每个主题须提供原文片段或来源图片作为依据。')
    }
    const current = currentClassification(comment)
    if (current && command.state === '已确认') current.state = '已撤回'
    comment.classifications.push({ id: command.operationId, contentVersion: comment.contentVersion, value: command.value, tags: structuredClone(command.tags), note: command.note, state: command.state, actor, at, reviewer: command.state === '已确认' ? actor : '', reviewedAt: command.state === '已确认' ? at : null, ruleVersion: FEEDBACK_RULE_VERSION, version: comment.classifications.length + 1, bulk: false }); comment.version++; objectId = comment.id; detail = `${command.state}：${command.value}`
  } else if (command.type === 'withdraw-classification') {
    const c = commentFor(command.commentId, command.expectedVersion), cls = c.classifications.find(x => x.id === command.classificationId)
    if (!cls || cls.state !== '已确认' || !command.reason.trim()) throw new Error('请选择有效确认分类并填写撤回原因。')
    cls.state = '已撤回'; c.version++; objectId = c.id; detail = command.reason
  } else if (command.type === 'bulk-submit-review') {
    if (!command.commentIds.length) throw new Error('请选择需要提交复核的评论。')
    for (const id of new Set(command.commentIds)) { const c = commentFor(id, command.expectedVersions[id]); if (c.contentVersion !== command.expectedContentVersions[id]) throw new Error('评论内容已更新，批量提交前请逐条重新核对。'); const prior = [...c.classifications].reverse().find(x => x.contentVersion === c.contentVersion && ['草稿', '待复核'].includes(x.state)) || currentClassification(c); c.classifications.push({ id: `${command.operationId}-${id}`, contentVersion: c.contentVersion, value: prior?.value || (c.raw.content.trim() ? '待判断' : '仅评分'), tags: structuredClone(prior?.tags || []), note: prior?.note || '', state: '待复核', actor, at, reviewer: '', reviewedAt: null, ruleVersion: FEEDBACK_RULE_VERSION, version: c.classifications.length + 1, bulk: true }); c.version++ }
    objectId = command.commentIds.join(','); detail = '逐条保留原分类输入，整批原子提交复核；尚未自动确认'
  } else if (command.type === 'bulk-classification') {
    if (!command.commentIds.length || !command.tags.length || command.tags.some(t => !FEEDBACK_THEMES.includes(t.theme))) throw new Error('请选择评论及有效主题。')
    for (const id of new Set(command.commentIds)) { const c = commentFor(id, command.expectedVersions[id]), current = currentClassification(c); c.classifications.push({ id: `${command.operationId}-${id}`, contentVersion: c.contentVersion, value: current?.value || '待判断', tags: [...(current?.tags || []), ...command.tags.filter(t => !current?.tags.some(x => x.theme === t.theme && x.sentiment === t.sentiment))], note: command.note, state: '待复核', actor, at, reviewer: '', reviewedAt: null, ruleVersion: FEEDBACK_RULE_VERSION, version: c.classifications.length + 1, bulk: true }); c.version++ }
    objectId = command.commentIds.join(','); detail = '批量建议已提交，须逐条核对证据后确认，当前有效分类保持原值。'
  } else if (command.type === 'correct-association') {
    const c = commentFor(command.commentId, command.expectedVersion), a = command.association
    if (a.sourceEventAt) a.sourceEventAt = canonicalFeedbackTime(a.sourceEventAt)
    if (!command.reason.trim() || !a.evidence.trim() || !a.sourceEventAt || !a.styleId || a.skuId && !a.mappingVersion) throw new Error('关联纠正必须有来源购买／订单事件时间、映射版本、依据和原因。')
    c.associationHistory.push(structuredClone(c.association)); c.association = { ...a, version: c.association.version + 1, actor, at }; c.version++; objectId = c.id; detail = command.reason
  } else if (command.type === 'review-coverage') {
    const e = snapshot.executions.find(e => e.id === command.executionId)
    if (!e || e.version !== command.expectedVersion) throw new Error('执行证据已变化，请重新读取。')
    if (!command.reason.trim() || !command.evidence.trim()) throw new Error('请提供核查证据与结论说明。')
    if (command.supplemental) e.coverage = { ...structuredClone(command.supplemental), range: normalizedRange(command.supplemental.range), missingRanges: command.supplemental.missingRanges.map(r => ({ ...r, ...normalizedRange(r) })), persistedAt: at }
    if (command.conclusion === '通过' && (!e.coverage.evidence.trim() || !e.coverage.endReason.trim() || !e.endedAt || !e.coverage.allRatings || !e.coverage.includesRatingOnly || !e.coverage.includesWithoutImages)) throw new Error('原始执行范围、全部评分和正常结束证据尚不完整，不能确认通过。')
    e.coverage.verified = command.conclusion === '通过'; e.coverage.verifiedAt = at; e.coverage.verifiedBy = actor; e.version++; objectId = e.id; detail = `${command.conclusion}：${command.reason}；核验依据：${command.evidence}`
  } else if (command.type === 'rejudge-task') {
    const t = snapshot.tasks.find(t => t.id === command.taskId), e = snapshot.executions.find(e => e.id === command.executionId)
    if (!t || t.version !== command.expectedVersion || !e || e.storeId !== t.storeId || !command.reason.trim()) throw new Error('请核对任务版本、关联执行并说明新发现的证据缺口。')
    e.coverage.verified = false; e.version++; t.version++; objectId = t.id; detail = `新证据要求重新核查：${command.reason}`
  } else if (command.type === 'save-note') {
    if (!command.scope.trim() || !command.content.trim() || !command.commentIds.length || command.commentIds.some(id => !snapshot.comments.some(c => c.id === id))) throw new Error('观察备注须引用当前筛选范围和至少一条存在的评论。')
    snapshot.notes.push({ order: snapshot.version+1, id: command.operationId, scope: command.scope, commentIds: [...new Set(command.commentIds)], content: command.content, actor, at }); objectId = command.operationId; detail = command.content
  } else if (command.type === 'ingest-batch') { ingestFeedbackBatch(snapshot, command.batch, command.execution, at); objectId = command.batch.id; detail = '批次持久保存；实际平台采集在现有工具完成' }
  else if (command.type === 'process-batch') { processFeedbackBatch(snapshot, command, at); objectId = command.batchId; detail = '按原始行推进后处理，原接收事实及历版回执保留' }
  else if (command.type === 'finish-execution') {
    const execution = snapshot.executions.find(e => e.id === command.executionId)
    if (!execution || execution.version !== command.expectedVersion || execution.terminalReceipt) throw new Error('执行已变化或已有封存终结回执，不能重复改写。')
    const ended = normalizeExecution({ ...execution, endedAt: command.endedAt, status: command.status, terminalReceipt: { ...command.terminalReceipt, persistedAt: at } })
    if (snapshot.batches.filter(b => b.executionId === execution.id).some(b => !matchesDeclaredBatch(ended, b))) throw new Error('终结清单必须包含已经接收的全部原始行。')
    Object.assign(execution, ended, { version: execution.version + 1 }); objectId = execution.id; detail = '来源终结清单已封存；全部声明批次持久接收后才能认定完整交付'
  }
  if (command.draftId && ['review-coverage', 'rejudge-task'].includes(command.type)) { const draft = snapshot.reviewDrafts.find(d => d.id === command.draftId); if (draft) { draft.resolved = true; draft.version++; draft.updatedAt = at } }
  snapshot.logs.push({ order: snapshot.version+1, id: command.operationId, objectId, action: command.type, detail, actor, at, payloadDigest: commandDigest }); snapshot.version++; snapshot.asOf = maxTime([previous.asOf, snapshot.asOf, at])!
  return snapshot
}
