import { addPhase2Seed } from './phase2-mock.ts'
import { listChannelStores } from '../pcs-channel-store-repository.ts'
import { getPcsChannelCatalogSnapshot } from '../pcs-channel-catalog.ts'
import { getStyleArchiveById } from '../pcs-style-archive-repository.ts'
import { getSkuArchiveById } from '../pcs-sku-archive-repository.ts'
import { withPcsDemoData } from '../pcs-record-runtime.ts'
import { batchCounts, buildDailyTasks, dailyWindow, dateShift, feedbackMd5, ingestFeedbackBatch, jakartaInstant, reviewIdentity } from './model.ts'
import { FEEDBACK_OWNER, type FeedbackBatch, type FeedbackComment, type FeedbackExecution, type FeedbackRawReview, type FeedbackSnapshot, type FeedbackTag } from './types.ts'

export const FEEDBACK_SEED_VERSION = 'feedback-phase2-v1.1-20261024-3'
export const FEEDBACK_MOCK_DATE = '2026-10-23'
export const FEEDBACK_STORE_CODES = ['IDLCD3W8X6', 'IDLC2XWXEM', 'IDLCNHWLC3', 'IDLCEXWXE6', 'IDLCLGLL62', 'IDLCWNWW6Q', 'IDLC7U2LWUA', 'IDLC6EW72S', 'IDLCHVWXRR']

/** Static scenario facts reference the shared catalog; reads never copy seed records to IndexedDB. */
let staticSeed: FeedbackSnapshot | null = null
export function createFeedbackSeed(): FeedbackSnapshot { staticSeed ||= withPcsDemoData(buildFeedbackSeed); return structuredClone(staticSeed) }
function buildFeedbackSeed(): FeedbackSnapshot {
  const at = '2026-10-23T12:30:00.000Z', date = FEEDBACK_MOCK_DATE, stores = listChannelStores(true), catalog = getPcsChannelCatalogSnapshot()
  const targetStores = FEEDBACK_STORE_CODES.map(code => stores.find(s => s.channelCode === 'tiktok' && s.externalStoreId === code)).filter((s): s is NonNullable<typeof s> => !!s)
  const snapshot: FeedbackSnapshot = { version: 1, seedVersion: FEEDBACK_SEED_VERSION, asOf: at, schedules: [], tasks: [], executions: [], batches: [], comments: [], metrics: [], logs: [], notes: [], historyDrafts: [], reviewDrafts: [] }
  for (const store of targetStores) snapshot.schedules.push({ id: `feedback-schedule-${store.id}-1`, storeId: store.id, owner: FEEDBACK_OWNER, effectiveDate: '2026-10-22', status: '已启用', version: 1, reason: '用户确认九店每天执行；原型日期仅为固定演示', createdAt: '2026-10-21T08:00:00.000Z', updatedAt: '2026-10-21T08:00:00.000Z', actor: FEEDBACK_OWNER })
  snapshot.tasks = buildDailyTasks(snapshot.schedules, '2026-10-22', '2026-10-24')
  const listingFor = (storeId: string, second = false) => { const listings = catalog.listings.filter(l => l.storeId === storeId && l.platformProductId); return listings[second ? 1 : 0] || listings[0] }
  const rawFor = (index: number, storeIndex = 0, second = false): FeedbackRawReview | null => {
    const store = targetStores[storeIndex], listing = store && listingFor(store.id, second); if (!store || !listing) return null
    const variants = catalog.variants.filter(v => v.listingId === listing.id), variant = variants[index % Math.min(variants.length || 1, 2)]
    const messages = ['面料柔软，穿着舒服。', '', '拉链卡顿，缝线有脱线。', '腰围偏小，衣长合适。', '面料偏薄，与照片不太一致。', '颜色好看，适合通勤。', '商品很好看。', '物流等待较久，衣服本身合身。']
    return { storeId: store.id, channel: store.channelCode, market: store.marketCode, listingId: listing.id, platformProductId: listing.platformProductId, nativeReviewId: index % 7 === 0 ? null : `mock-review-${storeIndex}-${index}`, author: `体验买家 ${String(index + 1).padStart(2, '0')}`, platformUserId: `mock-buyer-${index + 1}`, content: messages[index % messages.length], rating: index === 30 ? null : [5, 4, 1, 2, 4, 5, 3, 5][index % 8], commentAt: index === 29 ? null : jakartaInstant(dateShift(date, -(index % 6 + 1)), '10:30'), timeQuality: index === 29 ? '未知' : '可信', timePrecision: index === 29 ? '未知' : '秒', platformModifiedAt: index === 25 ? jakartaInstant('2026-10-22', '16:30') : jakartaInstant(dateShift(date, -(index % 6 + 1)), '10:30'), sourceVersion: index === 25 ? 2 : 1, orderNo: `MOCK-ORDER-${String(index + 1).padStart(3, '0')}`, orderLineId: `mock-order-line-${index + 1}`, platformVariantId: variant?.platformVariantId || '', sellerSku: variant?.sellerSku || '', color: variant?.displayColor || '', size: variant?.displaySize || '', language: 'zh', images: index === 4 && variant?.imageUrl ? [variant.imageUrl] : [], reply: index === 2 ? '感谢反馈，我们已记录质量问题。（Mock 来源回复）' : '', replyAt: index === 2 ? jakartaInstant('2026-10-22', '17:00') : null }
  }
  // The 18 daily facts include absence, zero, duplicates, stale upload, late delivery and processing failure.
  for (const [index, task] of snapshot.tasks.entries()) {
    if (task.businessDate > date) continue
    const storeIndex = targetStores.findIndex(s => s.id === task.storeId), today = task.businessDate === date
    if (storeIndex === 6 || !today && storeIndex > 4) continue
    const execDate = today && storeIndex === 7 ? dateShift(date, -1) : task.businessDate
    const start = jakartaInstant(execDate, storeIndex === 5 ? '18:10' : '14:00'), end = jakartaInstant(execDate, storeIndex === 5 ? '18:20' : '14:10'), received = jakartaInstant(task.businessDate, storeIndex === 5 ? '18:30' : '14:20')
    const execution: FeedbackExecution = { terminalReceipt: null, id: `feedback-execution-${index + 1}`, storeId: task.storeId, taskId: task.id, collector: FEEDBACK_OWNER, startedAt: start, endedAt: storeIndex === 8 && today ? null : end, toolVersion: '现有拓展／本地应用 · Mock 执行凭据 v1', status: storeIndex === 3 ? '失败' : storeIndex === 8 && today ? '进行中' : '结束', failure: storeIndex === 3 ? '平台第 3 页读取中断，2026-10-18 至 20 日仍有缺口。' : '', coverage: { range: today && storeIndex === 7 ? dailyWindow(execDate).target : task.target, allRatings: true, includesRatingOnly: true, includesWithoutImages: true, scope: '全店评价入口', listingIds: [], endReason: storeIndex === 8 ? '' : storeIndex === 3 ? '中断，已保留前两页' : storeIndex === 1 ? '全店范围结束，空结果已确认' : '平台日期筛选范围遍历结束，已达末页', evidence: `原型静态证据 ${index + 1}：店铺 code、日期筛选、全部评分和末页游标；不是实时平台回执`, verified: storeIndex !== 8, persistedAt: received, missingRanges: storeIndex === 3 ? [{ start: task.target.start, end: task.core.start, reason: '平台翻页中断' }] : [], missingListingIds: [] }, version: 1 }
    const batch: FeedbackBatch = { id: `feedback-batch-${index + 1}`, executionId: execution.id, taskId: task.id, storeId: task.storeId, collector: FEEDBACK_OWNER, submitter: storeIndex === 4 ? '数据支持（处理责任）' : FEEDBACK_OWNER, payloadDigest: feedbackMd5(`static-${index}`), receivedAt: received, durable: true, processingStartedAt: received, processingEndedAt: storeIndex === 4 ? null : storeIndex === 0 && !today ? jakartaInstant(task.businessDate, '19:10') : received, cleaningVersion: 'comment-clean-v1', rows: [], receipts: [], version: 1, attempts: [{ at: received, result: '原始载荷和范围证据持久接收（Mock）' }] }
    if (storeIndex === 3 || storeIndex === 4) { const raw = rawFor(35 + index, storeIndex); if (raw) batch.rows.push({ id: `${batch.id}-failure`, raw, rawNote: '来源原文及评论者已保存；此行模拟解析／处理故障，不是身份问题', outcome: storeIndex === 3 ? 'F' : 'P', commentId: null, reason: storeIndex === 3 ? '媒体字段解析失败，原始字段已保留' : '已持久接收，等待服务处理', processedAt: storeIndex === 3 ? received : null }) }
    snapshot.executions.push(execution); snapshot.batches.push(batch)
  }
  for (let index = 0; index < 32; index++) {
    const storeIndex = index < 25 ? 0 : index < 28 ? 2 : index < 30 ? 5 : 8, raw = rawFor(index, storeIndex, index >= 20 && index < 25); if (!raw) continue
    const store = targetStores[storeIndex], batch = storeIndex === 2 ? snapshot.batches.find(b => b.storeId === store.id) : snapshot.batches.find(b => b.storeId === store.id && b.taskId.endsWith(date)) || snapshot.batches.find(b => b.storeId === store.id)
    if (!batch) continue
    const execution = snapshot.executions.find(e => e.id === batch.executionId)!, listing = catalog.listings.find(l => l.id === raw.listingId)!, variant = catalog.variants.find(v => v.listingId === raw.listingId && v.platformVariantId === raw.platformVariantId), sku = variant && getSkuArchiveById(variant.internalSkuId)
    const id = `feedback-comment-mock-${index + 1}`, contentVersion = index === 25 ? 2 : 1, storedAt = batch.processingEndedAt || batch.receivedAt
    const comment: FeedbackComment = { id, identityKey: reviewIdentity(raw), identityMethod: raw.nativeReviewId ? '平台原生 ID' : '组合指纹', fingerprintVersion: 'md5-json-utf8-v1', raw, contentVersion, version: 1, firstBatchId: batch.id, firstExecutionId: execution.id, firstTaskId: batch.taskId, firstCollector: execution.collector, collectedAt: execution.startedAt, firstStoredAt: storedAt, lastObservedAt: storedAt, updatedAt: storedAt, association: { listingId: listing.id, styleId: listing.styleId, skuId: index === 28 ? null : sku?.skuId || null, mappingVersion: index === 28 ? null : variant?.mappingVersion || null, evidence: index === 28 ? '来源规格原文存在，但购买时点的历史映射尚未确认' : `Mock 订单购买规格 ${raw.orderLineId} 与渠道映射第 ${variant?.mappingVersion || 1} 版对应`, sourceEventAt: jakartaInstant('2026-10-10', '10:00'), status: index === 28 || !sku ? 'SKU 未确定' : '已确认', version: 1, actor: '原型来源资料', at: storedAt }, associationHistory: [], classifications: [], history: [], observations: [{ batchId: batch.id, rowId: `${batch.id}-${id}`, at: storedAt, result: 'N' }] }
    if (index < 12 || index === 25) {
      const tags: FeedbackTag[] = index % 8 === 0 ? [{ theme: '面料与穿着', sentiment: '正向', evidence: '面料柔软' }] : index % 8 === 2 ? [{ theme: '做工与质量', sentiment: '问题', evidence: '拉链卡顿' }] : index % 8 === 3 ? [{ theme: '尺码与版型', sentiment: '问题', evidence: '腰围偏小' }] : index % 8 === 4 ? [{ theme: '面料与穿着', sentiment: '问题', evidence: '面料偏薄' }, { theme: '展示与预期', sentiment: '问题', evidence: '与照片不太一致' }] : index % 8 === 5 ? [{ theme: '颜色与外观', sentiment: '正向', evidence: '颜色好看' }, { theme: '使用与价值', sentiment: '正向', evidence: '适合通勤' }] : []
      comment.classifications.push({ id: `feedback-classification-${index + 1}`, contentVersion: index === 25 ? 1 : contentVersion, value: !raw.content ? '仅评分' : tags.length ? '具体反馈' : '一般反馈', tags, note: '固定 Mock 人工确认场景', state: '已确认', actor: FEEDBACK_OWNER, at: storedAt, reviewer: FEEDBACK_OWNER, reviewedAt: storedAt, ruleVersion: 'V1.3', version: 1, bulk: false })
    }
    if (index === 25) { const old = { ...structuredClone(raw), content: '收到后觉得很好。', rating: 5, sourceVersion: 1 }; comment.history.push({ version: 1, raw: old, batchId: batch.id, observedAt: storedAt, reason: '同平台评论 ID 后续改文；旧分类不自动应用新内容' }); raw.content = '穿着后发现缝线脱开。'; raw.rating = 2 }
    if (index === 27) comment.classifications.push({ id: 'feedback-classification-insufficient', contentVersion: 1, value: '信息不足（已复核）', tags: [], note: '已复核，但无法从原文明确具体原因。', state: '已确认', actor: FEEDBACK_OWNER, at: storedAt, reviewer: FEEDBACK_OWNER, reviewedAt: storedAt, ruleVersion: 'V1.3', version: 1, bulk: false })
    if (index === 26) comment.classifications.push({ id: 'feedback-classification-pending', contentVersion: 1, value: '待判断', tags: [], note: '批量追加后待逐条复核', state: '待复核', actor: FEEDBACK_OWNER, at: storedAt, reviewer: '', reviewedAt: null, ruleVersion: 'V1.3', version: 1, bulk: true })
    snapshot.comments.push(comment); batch.rows.push({ id: `${batch.id}-${id}`, raw: structuredClone(raw), rawNote: '固定演示评论；产品与规格引用既有主档，不代表真实消费者评价。', outcome: 'N', commentId: id, reason: '首次新增', processedAt: storedAt })
  }
  // All-duplicate execution is independently valid; no new collection contribution is fabricated.
  for (const batch of snapshot.batches.filter(b => targetStores[2] && b.storeId === targetStores[2].id)) {
    const existing = snapshot.comments.find(c => c.raw.storeId === batch.storeId)
    if (existing) { batch.rows.push({ id: `${batch.id}-duplicate`, raw: structuredClone(existing.raw), rawNote: '同一平台身份再次观察', outcome: 'D', commentId: existing.id, reason: '确定规则命中既有评论', processedAt: batch.receivedAt }); existing.observations.push({ batchId: batch.id, rowId: `${batch.id}-duplicate`, at: batch.receivedAt, result: 'D' }) }
  }
  if (snapshot.comments[0]) { const c = snapshot.comments[0], b = snapshot.batches.find(b => b.id === c.firstBatchId)!; b.rows.push({ id: `${b.id}-same-batch-repeat`, raw: structuredClone(c.raw), rawNote: '同批次第二次出现', outcome: 'D', commentId: c.id, reason: '同批次重复，唯一评论不增加', processedAt: b.receivedAt }); b.attempts.push({ at, result: '客户端丢回执后原样重传；仅返回既有逻辑批次结果' }); b.rows.push({ id: `${b.id}-excluded`, raw: null, rawNote: '平台列表分页标题行', outcome: 'X', commentId: null, reason: '确定非评论：分页标题', processedAt: b.receivedAt }) }
  for (const batch of snapshot.batches) {
    batch.receipts.push({ version: 1, at: batch.processingEndedAt || batch.receivedAt, counts: batchCounts(batch), rows: structuredClone(batch.rows) })
    const execution = snapshot.executions.find(e => e.id === batch.executionId)!
    // Fixed source fixtures issue their declared manifest once, before any receiving / assessment flow.
    if (execution.endedAt) execution.terminalReceipt = { id: `terminal-${execution.id}`, batches: [{ batchId: batch.id, rowIds: batch.rows.map(r => r.id) }], rawCount: batch.rows.length, endedAt: execution.endedAt, persistedAt: batch.receivedAt, evidence: 'Mock 来源最终上传清单：已声明完整批次和原始行；零条亦明确声明。' }
  }
  const failed = snapshot.batches.find(b => b.taskId.endsWith('2026-10-22') && b.rows.some(r => r.outcome === 'F'))
  if (failed) {
    const original = snapshot.executions.find(e => e.id === failed.executionId)!, fixedAt = jakartaInstant('2026-10-22', '16:20'), execution = structuredClone(original), sourceRow = failed.rows.find(r => r.outcome === 'F')!, batch = structuredClone(failed)
    execution.id = 'feedback-execution-repair'; execution.startedAt = jakartaInstant('2026-10-22', '16:00'); execution.endedAt = jakartaInstant('2026-10-22', '16:10'); execution.status = '结束'; execution.failure = ''; execution.coverage.missingRanges = []; execution.coverage.endReason = '新执行完整遍历结束'; execution.coverage.persistedAt = fixedAt
    batch.id = 'feedback-batch-repair'; batch.executionId = execution.id; batch.receivedAt = fixedAt; batch.processingStartedAt = fixedAt; batch.processingEndedAt = fixedAt; batch.version = 1; batch.originBatchId = failed.id; batch.submitter = '数据支持（处理责任）'; batch.rows = [{ ...structuredClone(sourceRow), id: 'feedback-row-repair', outcome: 'N', processedAt: fixedAt }]; batch.receipts = []; batch.attempts = [{ at: fixedAt, result: '同源记录修复后回读成功；原失败回执保留' }]; batch.repairReferences = [{ originalBatchId: failed.id, originalRowId: sourceRow.id, repairedRowId: 'feedback-row-repair', evidence: '对应原媒体解析失败来源，已校验并持久回读', actor: '数据支持（处理责任）' }]
    execution.terminalReceipt = { id: 'terminal-feedback-execution-repair', batches: [{ batchId: batch.id, rowIds: ['feedback-row-repair'] }], rawCount: 1, endedAt: execution.endedAt!, persistedAt: fixedAt, evidence: 'Mock 修复来源终结：仅声明这一条原始记录，完整范围已独立遍历。' }
    ingestFeedbackBatch(snapshot, batch, execution, fixedAt)
    const saved = snapshot.comments.at(-1)!, listing = catalog.listings.find(l => l.id === saved.raw.listingId)
    if (listing) saved.association.styleId = listing.styleId
  }
  for (const [index, store] of targetStores.slice(0, 3).entries()) {
    const startDate = index === 2 ? '2026-01-01' : '2026-07-25', endDate = index === 2 ? '2026-07-25' : '2026-10-16', target = { start: jakartaInstant(startDate), end: jakartaInstant(endDate) }
    snapshot.tasks.push({ id: `feedback-history-${index + 1}`, storeId: store.id, owner: FEEDBACK_OWNER, type: '历史补采', businessDate: date, target, core: target, deadline: jakartaInstant('2026-10-30', '18:00'), scheduleId: snapshot.schedules.find(s => s.storeId === store.id)!.id, scheduleVersion: 1, scope: '全店评价入口', listingIds: [], createdAt: jakartaInstant('2026-10-22', '10:00'), reason: index === 2 ? '更早可访问历史分段，保留不可访问区间' : '核对存量后优先近 90 天缺口', version: 1, historyBaselineDate: date, stockCheck: '静态场景：现有评论记录存在但完整覆盖未核实，按固定区间补齐。', inaccessibleRanges: index === 2 ? [{ start: target.start, end: jakartaInstant('2026-03-01'), reason: '平台该历史区间暂不可访问，缺口明确保留' }] : [] })
  }
  const firstListing = targetStores[0] && listingFor(targetStores[0].id)
  if (firstListing) for (const [i, asOf] of [jakartaInstant('2026-10-21', '18:00'), jakartaInstant('2026-10-22', '18:00')].entries()) snapshot.metrics.push({ id: `feedback-metric-${i + 1}`, listingId: firstListing.id, name: '平台累计评论数', value: 100 + i * 5, unit: '条', basis: '累计', range: null, asOf, source: '固定 Mock 平台快照；仅演示最新快照选择，非实际平台数据' })
  // The second product metric deliberately distinguishes a real zero in the scenario from unavailable data.
  const secondListing = targetStores[0] && listingFor(targetStores[0].id, true)
  if (secondListing) snapshot.metrics.push({ id: 'feedback-metric-zero', listingId: secondListing.id, name: '销量', value: 0, unit: '件', basis: '区间', range: dailyWindow(date).target, asOf: at, source: '固定 Mock 区间销量快照，非实际销量' })
  addPhase2Seed(snapshot)
  return snapshot
}

export function feedbackProductLabel(comment: FeedbackComment): { styleCode: string; styleName: string; skuCode: string; imageUrl: string } {
  const style = getStyleArchiveById(comment.association.styleId), sku = comment.association.skuId ? getSkuArchiveById(comment.association.skuId) : null
  return { styleCode: style?.styleCode || comment.association.styleId, styleName: style?.styleName || '款式待核对', skuCode: sku?.skuCode || 'SKU 未确定', imageUrl: sku?.skuImageUrl || style?.mainImageUrl || '' }
}
