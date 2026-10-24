import { getChannelListing } from '../pcs-channel-catalog.ts'
import { listSkuArchivesByStyleId, getSkuArchiveById } from '../pcs-sku-archive-repository.ts'
import { currentClassification, dateShift, feedbackMd5, jakartaInstant, summarizeComments, executionRanges, usableCoverage, executionDeliveryTime, batchCounts } from './model.ts'
import { FEEDBACK_OWNER, FEEDBACK_THEMES, type FeedbackCommand, type FeedbackTag, type FeedbackSourceRow, type FeedbackComment, type FeedbackSnapshot } from './types.ts'
import type { FeedbackIssue, FeedbackIssueScope, FeedbackIssueEvidence, FeedbackIssueAction, FeedbackIssuePlan, FeedbackIssueJudgment, FeedbackIssueReview, FeedbackReviewPeriod, FeedbackTranslation, FeedbackSuggestion } from './phase2-types.ts'
export const issueStatuses = ['草稿', '待处理', '处理中', '待复盘', '已关闭', '已作废'] as const
export const activeIssue = (issue: FeedbackIssue) => ['待处理', '处理中', '待复盘'].includes(issue.status)
export function phase2(snapshot: FeedbackSnapshot) {
  snapshot.translations ||= []; snapshot.suggestions ||= []; snapshot.issues ||= []; snapshot.issueActions ||= []
  snapshot.issuePlans ||= []; snapshot.issueJudgments ||= []; snapshot.issueReviews ||= []; snapshot.actionAttachments ||= []
  // IndexedDB reads records by key; committed business order must survive UUID/key order and refresh.
  for(const values of [snapshot.translations,snapshot.suggestions,snapshot.issuePlans,snapshot.issueJudgments,snapshot.issueReviews,snapshot.logs,snapshot.notes]) values.sort((a,b)=>(a.order||0)-(b.order||0)||a.at.localeCompare(b.at)||a.id.localeCompare(b.id))
  return snapshot as FeedbackSnapshot & Required<Pick<FeedbackSnapshot, 'translations' | 'suggestions' | 'issues' | 'issueActions' | 'issuePlans' | 'issueJudgments' | 'issueReviews' | 'actionAttachments'>>
}
export const businessDay = (at: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at))
export function translationFor(s: FeedbackSnapshot, c: FeedbackComment): FeedbackTranslation | undefined { return (s.translations||[]).filter(t=>t.commentId===c.id&&t.contentVersion===c.contentVersion).sort((a,b)=>a.revision-b.revision).at(-1) }
export function suggestionValid(s: FeedbackSnapshot, c: FeedbackComment, suggestion: FeedbackSuggestion): boolean { return suggestion.contentVersion === c.contentVersion && (!suggestion.translationId || translationFor(s, c)?.id === suggestion.translationId) }
export function commentStamp(c: FeedbackComment, classificationId = '', translationId = ''): string { return feedbackMd5(JSON.stringify([c.id, c.contentVersion, c.raw, c.association, classificationId, translationId])) }
export function scopeContains(scope: FeedbackIssueScope, c: FeedbackComment): boolean { return c.association.styleId === scope.styleId && scope.storeIds.includes(c.raw.storeId) && scope.listingIds.includes(c.association.listingId) && (c.association.skuId ? scope.skuIds.includes(c.association.skuId) : scope.mode === 'SPU固定范围' && scope.includeUnknown) }
export function scopeForComments(comments: FeedbackComment[], styleId: string): FeedbackIssueScope {
  const rows = comments.filter(c => c.association.styleId === styleId)
  return { styleId, mode: 'SPU固定范围', skuIds: [...new Set([...listSkuArchivesByStyleId(styleId).map(s=>s.skuId),...rows.flatMap(c => c.association.skuId ? [c.association.skuId] : [])])], storeIds: [...new Set(rows.map(c => c.raw.storeId))], listingIds: [...new Set(rows.map(c => c.association.listingId))], includeUnknown: true }
}
export function issueEvidenceValid(s: FeedbackSnapshot, issue: FeedbackIssue, evidence: FeedbackIssueEvidence): boolean {
  const c = s.comments.find(c => c.id === evidence.commentId), classification = c && currentClassification(c)
  return !!c && !evidence.released && scopeContains(issue.scope, c) && !!classification?.tags.some(t => t.theme === issue.theme && t.sentiment === '问题') && evidence.stamp === commentStamp(c, classification.id, evidence.translationId) && (!evidence.translationId || translationFor(s, c)?.id === evidence.translationId)
}
export function eligibleEvidence(issue: Pick<FeedbackIssue, 'scope' | 'theme'>, c: FeedbackComment): boolean { return scopeContains(issue.scope, c) && !!currentClassification(c)?.tags.some(t => t.theme === issue.theme && t.sentiment === '问题') }
function evidenceFor(c: FeedbackComment, reason: string, actor: string, at: string, translationId = ''): FeedbackIssueEvidence { const classification = currentClassification(c); return { commentId: c.id, reason, stamp: commentStamp(c, classification?.id || '', translationId), raw: c.raw.content, rating: c.raw.rating, association: JSON.stringify(c.association), classification: JSON.stringify(classification || null), translationId, actor, at, released: false, history: [] } }
export function issueActions(s: FeedbackSnapshot, issue: FeedbackIssue): FeedbackIssueAction[] { return (s.issueActions || []).filter(a => a.issueId === issue.id && a.round === issue.round) }
export function issueProgress(s: FeedbackSnapshot, issue: FeedbackIssue) { const rows = issueActions(s, issue).filter(a => a.status !== '已取消'); return { total: rows.length, done: rows.filter(a => a.status === '已完成').length } }
export function issueBasis(s: FeedbackSnapshot, issue: FeedbackIssue): string { return feedbackMd5(JSON.stringify([issue.round, issue.scope, issue.definition, issue.definitionVersion, issueActions(s, issue).map(a => [a.id, a.version, a.status, a.result, a.effect, a.effectiveAt, a.effectEvidence, a.attachmentIds]).sort((a,b) => String(a[0]).localeCompare(String(b[0])))])) }
export function currentPlan(s: FeedbackSnapshot, issue: FeedbackIssue): FeedbackIssuePlan | undefined { return (s.issuePlans || []).find(p => p.issueId === issue.id && p.round === issue.round && p.state === '待观察') }
export function issueDue(s: FeedbackSnapshot, issue: FeedbackIssue) {
  const today = businessDay(s.asOf), actions = issueActions(s, issue), plan = currentPlan(s, issue)
  return { overdueActions: activeIssue(issue) ? actions.filter(a => !['已完成', '已取消'].includes(a.status) && a.dueDate < today).length : 0,
    processingOverdue: ['待处理', '处理中'].includes(issue.status) && issue.targetDate < today,
    reviewDue: issue.status === '待复盘' && !!plan && plan.dueDate <= today,
    changedEvidence: issue.evidence.filter(e => !e.released && !issueEvidenceValid(s, issue, e)).length }
}
export function planWindows(effectiveAt: string, days = 14, lag = 0) {
  const d = businessDay(effectiveAt)
  return { before: { start: jakartaInstant(dateShift(d, -days)), end: jakartaInstant(d) }, after: { start: jakartaInstant(dateShift(d, 1 + lag)), end: jakartaInstant(dateShift(d, days + lag + 1)) } }
}
function intervalCovers(intervals: Array<{ start: string; end: string }>, start: string, end: string): boolean {
  let reached = start
  for (const range of intervals.sort((a,b) => a.start.localeCompare(b.start))) { if (range.start > reached) break; if (range.end > reached) reached = range.end; if (reached >= end) return true }
  return reached >= end
}
function unresolvedRowAffects(s:FeedbackSnapshot,row:FeedbackSourceRow,storeId:string,link:string,range:{start:string;end:string}):boolean {
  if(!['F','P'].includes(row.outcome)||row.repairedBy&&row.repairedBy.at<=s.asOf)return false
  const raw=row.raw;if(!raw)return true
  const listing=raw.listingId&&getChannelListing(raw.listingId)
  const reliableListing=!!raw.listingId&&(listing?listing.storeId===storeId:s.comments.some(c=>c.association.listingId===raw.listingId&&c.raw.storeId===storeId))
  if(reliableListing&&raw.listingId!==link)return false
  if(raw.timeQuality==='可信'&&raw.commentAt&&Number.isFinite(Date.parse(raw.commentAt))){const at=new Date(raw.commentAt).toISOString();if(at<range.start||at>=range.end)return false}
  return true
}
export function coverageGaps(s: FeedbackSnapshot, scope: FeedbackIssueScope, range: { start: string; end: string }): string[] {
  const gaps: string[] = []
  for (const storeId of scope.storeIds) {
    const links = scope.listingIds.filter(id => s.comments.some(c => c.association.listingId === id && c.raw.storeId === storeId))
    if (!links.length) { gaps.push(`${storeId}：链接归属待核查`); continue }
    for (const link of links) {
      const knownMissing=s.batches.some(b=>b.storeId===storeId&&b.receivedAt<=s.asOf&&b.rows.some(r=>unresolvedRowAffects(s,r,storeId,link,range)))
      if(knownMissing){gaps.push(`${storeId} / ${link}：评论保存缺口未解决`);continue}
      const executions = s.executions.filter(e => e.storeId===storeId && usableCoverage(e) && !!e.endedAt && e.endedAt<=s.asOf && e.coverage.persistedAt<=s.asOf && s.tasks.some(t=>t.id===e.taskId&&t.storeId===storeId) && (e.coverage.scope==='全店评价入口'||e.coverage.listingIds.includes(link)) && !e.coverage.missingListingIds.includes(link))
        .filter(e=> {const delivered=executionDeliveryTime(e,s.batches);if(!delivered||delivered>s.asOf)return false;return s.batches.filter(b=>b.executionId===e.id).every(b=>JSON.stringify(b.receipts.at(-1)?.counts)===JSON.stringify(batchCounts(b)) && b.rows.every(r=>{if(!['F','P'].includes(r.outcome))return !!r.processedAt&&r.processedAt<=s.asOf;return !unresolvedRowAffects(s,r,storeId,link,range)}))})
      const intervals=executions.flatMap(executionRanges)
      if (!intervalCovers(intervals, range.start, range.end)) gaps.push(`${storeId} / ${link}：覆盖未齐`)
    }
  }
  return gaps
}
export function judgmentFor(s: FeedbackSnapshot, issue: FeedbackIssue, plan: FeedbackIssuePlan, c: FeedbackComment): FeedbackIssueJudgment | undefined {
  return [...(s.issueJudgments || [])].reverse().find(j => j.issueId === issue.id && j.round === issue.round && j.planId === plan.id && j.commentId === c.id && j.definition === plan.definition && j.stamp === commentStamp(c, j.classificationId, j.translationId) && (!j.classificationId || currentClassification(c)?.id === j.classificationId) && (!j.translationId || translationFor(s,c)?.id === j.translationId))
}
export function planComments(s: FeedbackSnapshot, plan: FeedbackIssuePlan, range: {start:string;end:string}): FeedbackComment[] { return s.comments.filter(c => scopeContains(plan.scope,c) && c.raw.timeQuality === '可信' && c.raw.commentAt && c.raw.commentAt >= range.start && c.raw.commentAt < range.end) }
function period(s: FeedbackSnapshot, issue: FeedbackIssue, plan: FeedbackIssuePlan, range: {start:string;end:string}): FeedbackReviewPeriod {
  const rows = planComments(s,plan,range), summary = summarizeComments(rows), result: FeedbackReviewPeriod = { total: rows.length, rated: summary.rated, negative: summary.negative, average: summary.average, problem: summary.problemComments, classified: summary.classified, Y: 0, N: 0, U: 0, R: 0, commentIds: rows.map(c => c.id), coverage: coverageGaps(s,plan.scope,range), composition: {} }
  for (const c of rows) { const j = judgmentFor(s,issue,plan,c); result[j?.result || 'R']++; const key = `${c.raw.storeId} / ${c.association.listingId} / ${c.association.skuId || 'SKU未确定'}`; result.composition[key] = (result.composition[key] || 0) + 1 }
  return result
}
export function reviewPreview(s: FeedbackSnapshot, issue: FeedbackIssue, plan: FeedbackIssuePlan) {
  const before = plan.kind === '反馈变化' ? period(s,issue,plan,plan.before) : null, after = plan.kind === '反馈变化' ? period(s,issue,plan,plan.after) : null
  const rows = plan.kind === '反馈变化' ? [...planComments(s,plan,plan.before),...planComments(s,plan,plan.after)] : issue.evidence.filter(e => issueEvidenceValid(s,issue,e)).map(e => s.comments.find(c => c.id === e.commentId)!)
  const samples = rows.map(c => { const j = judgmentFor(s,issue,plan,c); return { id:c.id, raw:c.raw.content,rating:c.raw.rating,commentAt:c.raw.commentAt,association:JSON.stringify(c.association),classification:JSON.stringify(currentClassification(c)),judgment:JSON.stringify(j || null),translation:JSON.stringify(j?.translationId ? s.translations?.find(t=>t.id === j.translationId) : null) } }).sort((a,b)=>a.id.localeCompare(b.id))
  const basis = issueBasis(s,issue), token = feedbackMd5(JSON.stringify([basis,plan,samples,before,after]))
  const ended = plan.kind === '核查结论' || !!plan.after.end && plan.after.end <= s.asOf
  const sufficient = !!before && !!after && before.total > 0 && after.total > 0 && !before.coverage.length && !after.coverage.length && !before.R && !after.R
  return { before, after, samples, basis, token, ended, sufficient }
}
export function latestFormalPlan(s: FeedbackSnapshot, issue: FeedbackIssue): FeedbackIssuePlan | undefined { return (s.issuePlans||[]).filter(p=>p.issueId===issue.id&&p.round===issue.round&&p.publishedAt).at(-1) }
export function reviewStillCurrent(s: FeedbackSnapshot, issue: FeedbackIssue, review: FeedbackIssueReview): boolean { const plan=latestFormalPlan(s,issue), latest=(s.issueReviews||[]).filter(r=>r.issueId===issue.id&&r.round===issue.round&&!r.draft).at(-1); return !review.draft && latest?.id===review.id && plan?.id===review.planId && plan.state==='已记录' && review.round === issue.round && review.basis === issueBasis(s,issue) && review.previewToken === reviewPreview(s,issue,review.plan).token }
function requireText(value: string, label: string): void { if (!value?.trim()) throw new Error(`请填写${label}`) }
function requireDate(value: string, label: string): void { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`请选择${label}`) }
function validScope(s: FeedbackSnapshot, scope: FeedbackIssueScope): void {
  if (!scope.styleId || !scope.listingIds.length || !scope.storeIds.length || (scope.mode === '指定SKU' && (!scope.skuIds.length || scope.includeUnknown))) throw new Error('请选择一个款式及明确的规格、店铺和链接范围')
  const all = s.comments
  if (scope.listingIds.some(id => !all.some(c => c.association.listingId === id && c.association.styleId === scope.styleId && scope.storeIds.includes(c.raw.storeId))) || scope.skuIds.some(id => getSkuArchiveById(id)?.styleId!==scope.styleId && !all.some(c=>c.association.skuId === id && c.association.styleId === scope.styleId))) throw new Error('所选规格或链接不属于当前款式，请重新核对范围')
}
function mutable(issue: FeedbackIssue): void { if (['已关闭','已作废'].includes(issue.status) || issue.cancelledDraft) throw new Error(issue.status === '已关闭' ? '需先重开本次跟进' : '该记录已结束，不可修改') }
function allDone(s: FeedbackSnapshot, issue: FeedbackIssue): boolean { const p=issueProgress(s,issue); return p.total > 0 && p.total === p.done }
function cancelPlans(s: FeedbackSnapshot, issue: FeedbackIssue): void { for (const p of s.issuePlans || []) if (p.issueId === issue.id && p.round === issue.round && ['待观察','草稿'].includes(p.state)) { p.state='已取消'; p.version++ } }
function touch(issue: FeedbackIssue, at: string): void { issue.version++; issue.updatedAt=at }
function reopenProcessing(s: FeedbackSnapshot, issue: FeedbackIssue, target: string): void { requireDate(target,'本轮计划处理日'); issue.targetDate=target; issue.status='处理中'; cancelPlans(s,issue) }
export function fixedAssistance(c: FeedbackComment): {text:string;value:FeedbackSuggestion['value'];tags:FeedbackSuggestion['tags']} | null {
  const t=c.raw.content.trim(); if(!t) return {text:'',value:'仅评分',tags:[]}
  const dictionary: Array<[RegExp,string,FeedbackTag[]]> = [
    [/cantik.*menyusut/i,'很好看，但洗后缩水。',[{theme:'颜色与外观',sentiment:'正向',evidence:t.match(/cantik/i)?.[0] || 'cantik'},{theme:'面料与穿着',sentiment:'问题',evidence:'menyusut'}]],
    [/tipis|transparan/i,'面料太薄，有些透。',[{theme:'面料与穿着',sentiment:'问题',evidence:t}]],
    [/tebal/i,'面料较厚，穿着偏热。',[{theme:'面料与穿着',sentiment:'问题',evidence:t}]],
    [/resleting/i,'拉链卡顿，缝线有脱线。',[{theme:'做工与质量',sentiment:'问题',evidence:t}]],
    [/pinggang.*kecil/i,'腰围偏小。',[{theme:'尺码与版型',sentiment:'问题',evidence:t}]],
    [/lembut/i,'面料柔软，穿着舒服。',[{theme:'面料与穿着',sentiment:'正向',evidence:t}]],
  ]
  for(const [match,text,tags] of dictionary) if(match.test(t)) return {text:/tipis/i.test(t)&&/foto/i.test(t)?'面料太薄，有些透，与照片不太一致。':/tipis/i.test(t)&&!/transparan/i.test(t)?(/kurang cocok/i.test(t)?'面料偏薄，不太适合我。':'面料偏薄。'):text,value:'具体反馈',tags:/tipis/i.test(t)&&/foto/i.test(t)?[...tags,{theme:'展示与预期',sentiment:'问题',evidence:'tidak seperti foto'}]:tags}
  if(c.raw.language==='zh') return {text:t,value:currentClassification(c)?.value || '待判断',tags:structuredClone(currentClassification(c)?.tags || [])}
  return null
}
export function applyPhase2Command(s0: FeedbackSnapshot, command: FeedbackCommand, actor: string, at: string): {objectId:string;detail:string} {
  const s=phase2(s0); if(!command.type.startsWith('p2-')) throw new Error('未知反馈动作')
  const cmd=command as Extract<FeedbackCommand,{type:`p2-${string}`}>
  const getComment=(id:string,version?:number)=> {const c=s.comments.find(c=>c.id===id);if(!c || version!==undefined && c.version!==version) throw new Error('评论内容已更新，请重新读取后核对');return c}
  if(cmd.type==='p2-translation') {
    const c=getComment(cmd.commentId,cmd.expectedVersion), old=translationFor(s,c)
    if(!c.raw.content.trim()) throw new Error('仅评分，无需翻译')
    requireText(cmd.text,'中文译文');requireText(cmd.source,'译文来源');if(old && old.text !== cmd.text) requireText(cmd.reason,'修订原因')
    s.translations.push({order:s.version+1,id:cmd.operationId,commentId:c.id,contentVersion:c.contentVersion,text:cmd.text.trim(),source:cmd.source,language:c.raw.language,checked:cmd.checked,actor,at,reason:cmd.reason,revision:(s.translations.filter(t=>t.commentId===c.id).length)+1}); c.version++
    return {objectId:c.id,detail:cmd.checked?'已核对译文':'已保存译文'}
  }
  if(cmd.type==='p2-suggest') {
    if(!cmd.commentIds.length) throw new Error('请选择评论')
    for(const id of new Set(cmd.commentIds)) { const c=getComment(id,cmd.expectedVersions[id]), assistance=fixedAssistance(c);if(!assistance) continue; const tid=cmd.translationIds?.[id] || '';if(tid && translationFor(s,c)?.id!==tid) throw new Error('译文已变化，请重新核对');s.suggestions.push({order:s.version+1,id:`${cmd.operationId}-${id}`,commentId:id,contentVersion:c.contentVersion,translationId:tid,value:assistance.value,tags:structuredClone(assistance.tags),state:'待核对',actor,at});c.version++ }
    return {objectId:cmd.operationId,detail:'已取得可用辅助建议，仍需逐条核对'}
  }
  if(cmd.type==='p2-suggestion-use') {
    if(!cmd.suggestionIds.length) throw new Error('请选择建议')
    for(const id of new Set(cmd.suggestionIds)) { const suggestion=s.suggestions.find(x=>x.id===id);if(!suggestion) throw new Error('建议不存在');const c=getComment(suggestion.commentId,cmd.expectedVersions[suggestion.commentId]);if(!suggestionValid(s,c,suggestion)) throw new Error('原文或译文已变化，请重新核对'); if(suggestion.tags.some(t=>t.theme!=='原因不明'&&!t.evidence.trim())) throw new Error('具体主题必须提供原句依据'); suggestion.state=cmd.ignore?'已忽略':'已选入草稿';if(!cmd.ignore) c.classifications.push({id:`${cmd.operationId}-${c.id}`,contentVersion:c.contentVersion,value:suggestion.value,tags:structuredClone(cmd.selectedTags?.[suggestion.id] ? suggestion.tags.filter((_,index)=>cmd.selectedTags![suggestion.id].includes(index)) : suggestion.tags),note:'选入辅助建议，尚未人工确认',state:'草稿',actor,at,reviewer:'',reviewedAt:null,ruleVersion:'V1.3',version:c.classifications.length+1,bulk:cmd.suggestionIds.length>1});c.version++ }
    return {objectId:cmd.operationId,detail:cmd.ignore?'已忽略建议':'已选入分类草稿'}
  }
  if(cmd.type==='p2-save-issue') {
    const input=structuredClone(cmd.issue), old=s.issues.find(i=>i.id===input.id)
    if(old && old.version!==cmd.expectedVersion || !old && cmd.expectedVersion!==0) throw new Error('跟进已更新，请重新读取后核对')
    if(old) {mutable(old);if(old.status!=='草稿'&&cmd.draft)throw new Error('正式跟进请使用保存修改，不可保存为草稿');if(old.status!=='草稿' && (old.scope.styleId!==input.scope.styleId || old.theme!==input.theme)) throw new Error('正式跟进的商品和主主题不可更换，请作废后另建');requireText(cmd.reason,'修改原因')}
    if(!cmd.draft || old && old.status!=='草稿') {
      requireText(input.title,'问题标题');requireText(input.description,'问题描述');requireText(input.definition,'本次问题判定说明');requireText(input.owner,'负责人');if(input.owner!==FEEDBACK_OWNER) throw new Error('请选择现有人员');requireDate(input.targetDate,'本轮计划处理日');validScope(s,input.scope)
      if(!FEEDBACK_THEMES.includes(input.theme) || !input.discovery.start || !input.discovery.end || input.discovery.start>input.discovery.end) throw new Error('请核对主题及发现期间')
      if(!old || old.status==='草稿') for(const e of input.evidence.filter(e=>!e.released)){const c=getComment(e.commentId);if(cmd.expectedCommentStamps?.[c.id]!==commentStamp(c,currentClassification(c)?.id||'', ''))throw new Error('建单证据已变化，请重新读取并核对原文与分类')}
      const valid=input.evidence.filter(e=>{const c=s.comments.find(c=>c.id===e.commentId);return !!c && !e.released && eligibleEvidence(input,c)})
      if(!valid.length && (!old || old.status==='草稿')) throw new Error('正式创建至少需要1条本主题已人工确认的问题评论')
      const similar=s.issues.filter(i=>i.id!==input.id && activeIssue(i) && i.scope.styleId===input.scope.styleId && i.theme===input.theme && i.scope.listingIds.some(id=>input.scope.listingIds.includes(id)) && (i.scope.skuIds.some(id=>input.scope.skuIds.includes(id)) || i.scope.includeUnknown && input.scope.includeUnknown))
      if(similar.length && (!old || old.status==='草稿')) requireText(cmd.distinction,'与已有跟进的区别')
    }
    if(old) {
      const changed=JSON.stringify(old.scope)!==JSON.stringify(input.scope)||old.definition!==input.definition
      if(changed) {cancelPlans(s,old);input.definitionVersion=old.definitionVersion+1;if(old.status==='待复盘') input.status='处理中'}
      input.status=changed && old.status==='待复盘'?'处理中':old.status;input.round=old.round;input.evidence=old.status==='草稿'?input.evidence.map(e=>evidenceFor(getComment(e.commentId),e.reason||input.description,actor,at)):old.evidence;input.createdAt=old.createdAt;input.number=old.number
      if(old.status==='草稿'&&!cmd.draft) input.status='待处理'
      Object.assign(old,input,{version:old.version+1,updatedAt:at})
    } else { input.version=1;input.round=1;input.definitionVersion=1;input.status=cmd.draft?'草稿':'待处理';input.createdAt=at;input.updatedAt=at;input.actor=actor;input.number=cmd.draft?'':`FB-${businessDay(at).replaceAll('-','')}-${String(s.issues.filter(i=>i.number).length+1).padStart(3,'0')}`;input.evidence=input.evidence.map(e=>evidenceFor(getComment(e.commentId),e.reason||input.description,actor,at));s.issues.push(input) }
    if(old && !old.number && old.status==='待处理') old.number=`FB-${businessDay(at).replaceAll('-','')}-${String(s.issues.filter(i=>i.number).length+1).padStart(3,'0')}`
    return {objectId:input.id,detail:old?`修改跟进：${cmd.reason}`:cmd.draft?'保存跟进草稿':`创建跟进${cmd.distinction?`；区别：${cmd.distinction}`:''}`}
  }
  const issue=s.issues.find(i=>i.id===cmd.issueId)
  if(!issue || issue.version!==cmd.expectedVersion) throw new Error('跟进内容已更新，请重新读取后核对')
  if(cmd.type==='p2-issue-state') {
    requireText(cmd.reason,'操作说明')
    if(cmd.action==='重开') {if(issue.status!=='已关闭') throw new Error('仅已关闭跟进可以重开');requireText(cmd.goal||'','本轮处理目标');requireDate(cmd.targetDate||'','本轮计划处理日');if(cmd.owner!==FEEDBACK_OWNER) throw new Error('请选择本轮负责人');issue.round++;issue.status='处理中';issue.targetDate=cmd.targetDate!;issue.owner=cmd.owner!;issue.description+=`\n第${issue.round}轮：${cmd.goal}`}
    else {mutable(issue)
      if(cmd.action==='取消草稿') {if(issue.status!=='草稿') throw new Error('仅草稿可取消');issue.cancelledDraft=true}
      else if(cmd.action==='开始处理') {if(issue.status!=='待处理') throw new Error('当前状态不能开始处理');issue.status='处理中'}
      else if(cmd.action==='继续处理') {if(issue.status!=='待复盘') throw new Error('当前状态不能继续处理');reopenProcessing(s,issue,cmd.targetDate||'')}
      else if(cmd.action==='进入复盘') {if(issue.status!=='处理中' || !allDone(s,issue)) throw new Error('本轮至少1项有效行动且全部完成后才能进入复盘');const plan=currentPlan(s,issue);if(!plan || plan.basis!==issueBasis(s,issue)) throw new Error('请先保存依据当前行动的正式复盘计划');issue.status='待复盘'}
      else if(cmd.action==='关闭') {if(issue.status!=='待复盘'||!allDone(s,issue)) throw new Error('请先完成本轮有效行动并进入复盘');const review=[...s.issueReviews].reverse().find(r=>r.issueId===issue.id && r.decision==='结束本次跟进' && reviewStillCurrent(s,issue,r));if(!review) throw new Error('请先基于当前轮次与行动保存结束本次跟进的正式复盘');issue.status='已关闭';issue.closedAt=at;issue.closeReason=cmd.reason}
      else if(cmd.action==='作废') {if(!activeIssue(issue)) throw new Error('当前状态不能作废');issue.status='已作废';for(const a of issueActions(s,issue)) if(['未开始','进行中'].includes(a.status)){a.status='已取消';a.progress.push(`${at} 作废取消：${cmd.reason}`);a.version++}cancelPlans(s,issue)}
    }
  } else {
    mutable(issue);if(issue.status==='草稿') throw new Error('请先正式创建跟进')
    if(cmd.type==='p2-evidence') {
      requireText(cmd.reason,'引用或核对说明');if(!cmd.commentIds.length) throw new Error('请选择评论')
      for(const id of new Set(cmd.commentIds)) { const c=getComment(id), old=issue.evidence.find(e=>e.commentId===id),translationId=cmd.translationIds?.[id]??cmd.translationId??''
        if(cmd.action==='解除') {if(!old || old.released) throw new Error('当前没有该引用');old.history.push({stamp:old.stamp,raw:old.raw,translationId:old.translationId,association:old.association,classification:old.classification,rating:old.rating,reason:cmd.reason,at,actor});old.released=true;continue}
        if(!eligibleEvidence(issue,c)) throw new Error('评论须在本问题范围内，且当前已确认本主主题的问题分类')
        if(cmd.expectedCommentStamps?.[id]!==commentStamp(c,currentClassification(c)?.id||'',translationId))throw new Error('评论证据已变化，请重新读取后核对原文与分类')
        if(translationId && translationFor(s,c)?.id!==translationId) throw new Error('译文已更新')
        if(cmd.action==='添加' && old && !old.released) throw new Error('评论已引用，请核对原引用')
        const next=evidenceFor(c,cmd.reason,actor,at,translationId)
        if(old) {next.history=[...old.history,{stamp:old.stamp,raw:old.raw,translationId:old.translationId,association:old.association,classification:old.classification,rating:old.rating,reason:old.reason,at:old.at,actor:old.actor}];Object.assign(old,next)} else issue.evidence.push(next)
      }
    } else if(cmd.type==='p2-action') {
      const input=structuredClone(cmd.action), old=s.issueActions.find(a=>a.id===input.id)
      if(old && (old.issueId!==issue.id||old.round!==issue.round)) throw new Error('历史轮次的行动只读')
      if(old && old.version!==input.version) throw new Error('行动已更新，请重新读取')
      const a=old || {...input,issueId:issue.id,round:issue.round,version:0,status:'未开始' as const,startedAt:'',completedAt:'',result:'',effect:'' as const,effectiveAt:'',effectEvidence:'',progress:[],attachmentIds:[]}
      if(cmd.intent==='保存') {requireText(input.content,'行动内容');requireText(input.owner,'负责人');if(input.owner!==FEEDBACK_OWNER) throw new Error('请选择现有人员');requireDate(input.dueDate,'计划完成日');if(old && !['未开始','进行中'].includes(old.status)) throw new Error('请使用修正或恢复处理');if(old)requireText(cmd.reason,'修改原因');Object.assign(a,{content:input.content,type:input.type,owner:input.owner,dueDate:input.dueDate})}
      else if(!old) throw new Error('请先保存行动')
      else if(cmd.intent==='开始') {if(a.status!=='未开始')throw new Error('该行动不能开始');a.status='进行中';a.startedAt=at;if(issue.status==='待处理')issue.status='处理中'}
      else if(cmd.intent==='进展') {if(a.status!=='进行中')throw new Error('请先开始行动');requireText(cmd.reason,'进展');a.progress.push(`${at} ${cmd.reason}`)}
      else if(cmd.intent==='完成'||cmd.intent==='修正') {
        if(cmd.intent==='完成'&&!['未开始','进行中'].includes(a.status)||cmd.intent==='修正'&&a.status!=='已完成')throw new Error('行动状态已变化')
        if(cmd.intent==='修正')requireText(cmd.reason,'修正原因');requireText(input.result,'实际结果');if(!input.completedAt || !Number.isFinite(Date.parse(input.completedAt)) || input.completedAt>at || input.completedAt<issue.createdAt || a.startedAt && input.completedAt<a.startedAt) throw new Error('请核对实际完成时间，不可晚于当前或早于执行开始')
        if(!['无需观察','已生效','生效时间未确认'].includes(input.effect)) throw new Error('请选择生效情况')
        if(input.effect==='已生效' && (!input.effectiveAt||!Number.isFinite(Date.parse(input.effectiveAt))||input.effectiveAt>at||!input.effectEvidence.trim()))throw new Error('请填写实际生效时间与依据，不可晚于当前')
        if(input.effect==='无需观察')requireText(input.effectEvidence,'核查结论')
        if(cmd.intent==='修正')a.progress.push(`${at} 修正前：${a.result}；${a.effect}；${a.effectiveAt}；原因：${cmd.reason}`)
        Object.assign(a,{status:'已完成',completedAt:input.completedAt,result:input.result,effect:input.effect,effectiveAt:input.effect==='已生效'?input.effectiveAt:'',effectEvidence:input.effectEvidence});a.startedAt ||= input.completedAt;if(issue.status==='待处理')issue.status='处理中'
        cancelPlans(s,issue)
      } else if(cmd.intent==='取消') {if(!['未开始','进行中'].includes(a.status))throw new Error('已完成行动不能取消');requireText(cmd.reason,'取消原因');a.status='已取消';a.progress.push(`${at} 取消：${cmd.reason}`);cancelPlans(s,issue)}
      else if(cmd.intent==='恢复') {if(!['已完成','已取消'].includes(a.status))throw new Error('当前行动无需恢复');requireText(cmd.reason,'恢复原因');a.progress.push(`${at} 恢复前：${a.status}；${a.result}；${cmd.reason}`);a.status=a.status==='已完成'?'进行中':'未开始';reopenProcessing(s,issue,cmd.targetDate)}
      if(issue.status==='待复盘' && (!old || cmd.intent==='保存' || cmd.intent==='恢复')) reopenProcessing(s,issue,cmd.targetDate)
      if(old && ['保存','修正'].includes(cmd.intent)){const retained=input.attachmentIds.filter(id=>a.attachmentIds.includes(id));for(const removed of a.attachmentIds.filter(id=>!retained.includes(id)))a.progress.push(`${at} 移除附件引用：${removed}；${s.actionAttachments.find(f=>f.id===removed)?.name||''}`);a.attachmentIds=retained}
      a.version++;if(!old)s.issueActions.push(a)
      if(cmd.attachments) {if(cmd.attachments.length+a.attachmentIds.length>5)throw new Error('每项行动最多5个附件');for(const f of cmd.attachments){if(f.actionId!==a.id||f.size>10*1024*1024||!['image/png','image/jpeg','image/webp','application/pdf'].includes(f.type))throw new Error('附件须为PNG、JPEG、WebP或PDF，单个不超过10MB');if(!s.actionAttachments.some(x=>x.id===f.id)){s.actionAttachments.push(f);a.attachmentIds.push(f.id)}}}
    } else if(cmd.type==='p2-plan') {
      const p=structuredClone(cmd.plan);if(!allDone(s,issue))throw new Error('请先完成本轮有效行动');p.issueId=issue.id;p.round=issue.round;p.basis=issueBasis(s,issue);p.at=at;p.order=s.version+1;p.definition=issue.definition
      const actions=issueActions(s,issue).filter(a=>a.status!=='已取消');if(!p.actionIds.length || p.actionIds.some(id=>!actions.some(a=>a.id===id)))throw new Error('请选择本轮已完成行动')
      validScope(s,p.scope);if(p.scope.styleId!==issue.scope.styleId||p.scope.listingIds.some(id=>!issue.scope.listingIds.includes(id))||p.scope.storeIds.some(id=>!issue.scope.storeIds.includes(id))||p.scope.skuIds.some(id=>!issue.scope.skuIds.includes(id))||p.scope.includeUnknown&&!issue.scope.includeUnknown)throw new Error('观察范围必须在问题范围内')
      if(p.kind==='核查结论') {if(actions.some(a=>a.effect!=='无需观察')) throw new Error('本轮全部有效行动均无需观察，才可使用核查结论复盘');p.before={start:'',end:''};p.after={start:'',end:''};p.anchorActionId='';p.days=0;p.lag=0;const last=actions.map(a=>businessDay(a.completedAt)).sort().at(-1)!;if(p.dueDate<last)throw new Error('复盘日不可早于本轮核查完成日')}
      else {const anchor=actions.find(a=>a.id===p.anchorActionId && p.actionIds.includes(a.id));if(!anchor || anchor.effect!=='已生效'||!anchor.effectiveAt)throw new Error('请选择已确认生效的本轮行动');if(!Number.isInteger(p.days)||p.days<1||!Number.isInteger(p.lag)||p.lag<0)throw new Error('观察天数须为正整数，滞后天数不可为负');Object.assign(p,planWindows(anchor.effectiveAt,p.days,p.lag));if(p.dueDate<businessDay(p.after.end))throw new Error('计划复盘日不可早于完整后窗结束')}
      requireDate(p.dueDate,'计划复盘日');requireText(p.target,'本次观察或核查目标')
      const prior=s.issuePlans.find(x=>x.id===p.id);if(prior && (prior.state!=='草稿'||prior.version!==p.version))throw new Error('正式计划保留历史，请新建修订')
      if(!cmd.draft) {if(currentPlan(s,issue))requireText(cmd.reason,'替换原因');for(const old of s.issuePlans)if(old.issueId===issue.id&&old.round===issue.round&&old.state==='待观察'){old.state='已替换';old.version++}}
      for(const old of s.issuePlans)if(old.issueId===issue.id&&old.round===issue.round&&old.state==='草稿'&&old.id!==p.id){old.state='已替换';old.version++}
      p.publishedAt=cmd.draft?'':at;p.state=cmd.draft?'草稿':'待观察';p.reason=cmd.reason;p.version=(prior?.version||0)+1;if(prior)Object.assign(prior,p);else s.issuePlans.push(p)
    } else if(cmd.type==='p2-judge') {
      const p=s.issuePlans.find(p=>p.id===cmd.planId && p.issueId===issue.id && p.round===issue.round);if(!p||!['待观察','草稿','已记录'].includes(p.state))throw new Error('计划已变化');const c=getComment(cmd.commentId)
      if(p.kind!=='反馈变化'||![...planComments(s,p,p.before),...planComments(s,p,p.after)].some(x=>x.id===c.id))throw new Error('评论不在本次观察范围内')
      if(cmd.classificationId && currentClassification(c)?.id!==cmd.classificationId || cmd.expectedStamp!==commentStamp(c,cmd.classificationId,cmd.translationId))throw new Error('评论或分类已变化，请重新核对')
      if(cmd.basis==='中文译文' && (!cmd.translationId||translationFor(s,c)?.id!==cmd.translationId))throw new Error('请选择当前译文')
      if(cmd.basis!=='中文译文'&&cmd.translationId)throw new Error('原文或图片判断不应依赖译文');if(cmd.basis==='图片'&&!c.raw.images.length)throw new Error('该评论没有来源图片');requireText(cmd.evidence,'判断片段或说明')
      s.issueJudgments.push({order:s.version+1,id:cmd.operationId,issueId:issue.id,round:issue.round,planId:p.id,commentId:c.id,stamp:cmd.expectedStamp,definition:p.definition,result:cmd.result,basis:cmd.basis,translationId:cmd.translationId,classificationId:cmd.classificationId,evidence:cmd.evidence,actor,at})
    } else if(cmd.type==='p2-review') {
      const p=s.issuePlans.find(p=>p.id===cmd.planId && p.issueId===issue.id && p.round===issue.round);if(!p||!['待观察','已记录'].includes(p.state))throw new Error('请先保存正式计划');if(latestFormalPlan(s,issue)?.id!==p.id)throw new Error('已有更新的正式计划，请按当前计划复盘');if(p.basis!==issueBasis(s,issue)||!allDone(s,issue))throw new Error('行动或范围已变化，请重新制定计划')
      const preview=reviewPreview(s,issue,p);if(preview.token!==cmd.previewToken)throw new Error('预览后资料已变化，请重新预览，输入已保留')
      if(!cmd.draft && !preview.ended)throw new Error('后期尚未完整结束，仅可保存草稿')
      requireText(cmd.observation,p.kind==='核查结论'?'核查结论':'观察记录');requireText(cmd.factors,'影响因素或局限')
      if(!cmd.draft && cmd.decision==='结束本次跟进'){requireText(cmd.endingReason,'结束原因');requireText(cmd.nextStep,'后续安排')}
      if(!cmd.draft && cmd.decision==='继续观察'){requireDate(cmd.nextDueDate,'下次复盘日');requireText(cmd.nextStep,'下次观察目标');if(cmd.nextDueDate<=businessDay(at))throw new Error('下次复盘日应晚于今日')}
      const review:FeedbackIssueReview={order:s.version+1,id:cmd.operationId,issueId:issue.id,round:issue.round,planId:p.id,kind:p.kind,at,actor,plan:structuredClone(p),before:preview.before,after:preview.after,samples:preview.samples,basis:preview.basis,previewToken:preview.token,observation:cmd.observation,factors:cmd.factors,conclusion:p.kind==='核查结论'?'核查结论':!preview.sufficient?'数据条件不足':cmd.factors.trim()==='无'?'基础范围一致':'存在影响因素',decision:cmd.decision,endingReason:cmd.endingReason,nextStep:cmd.nextStep,nextDueDate:cmd.nextDueDate,targetDate:cmd.targetDate,draft:cmd.draft,supersedes:cmd.supersedes}
      // Token is based on the immutable pre-save plan; status changes do not invalidate this saved comparison.
      s.issueReviews.push(review)
      if(cmd.draft) { for(const old of s.issueReviews)if(old.id!==review.id&&old.issueId===issue.id&&old.round===issue.round&&old.draft)old.supersedes=review.id }
      else {p.state='已记录';p.version++;if(cmd.decision==='调整措施')reopenProcessing(s,issue,cmd.targetDate);if(cmd.decision==='继续观察'){const next=structuredClone(p);next.id=`${cmd.operationId}-next`;next.version=1;next.state='待观察';next.publishedAt=at;next.dueDate=cmd.nextDueDate;next.target=cmd.nextStep;next.reason='继续观察';next.at=at;next.order=s.version+1;s.issuePlans.push(next)}}
    }
  }
  touch(issue,at)
  return {objectId:issue.id,detail:cmd.type==='p2-issue-state'?`${cmd.action}：${cmd.reason}`:cmd.type==='p2-evidence'?`${cmd.action}评论证据：${cmd.reason}`:cmd.type==='p2-action'?`${cmd.intent}行动：${cmd.reason||cmd.action.content}`:cmd.type==='p2-plan'?'保存复盘计划':cmd.type==='p2-judge'?'完成本次问题证据核对':'保存复盘记录'}
}

export interface FeedbackAttention { id:string; type:string; styleId:string; theme:string; commentIds:string[]; issueId:string; basis:string; start:string;end:string }
export function attentionCandidates(s:FeedbackSnapshot):FeedbackAttention[] {
 const today=businessDay(s.asOf),end=jakartaInstant(today),start=jakartaInstant(dateShift(today,-7)),previous=jakartaInstant(dateShift(today,-14)),recent=s.comments.filter(c=>c.raw.timeQuality==='可信'&&c.raw.commentAt&&c.raw.commentAt>=start&&c.raw.commentAt<end),result:FeedbackAttention[]=[]
 const push=(type:string,styleId:string,theme:string,rows:FeedbackComment[],basis:string,issueId='')=>result.push({id:`${type}-${styleId}-${theme}-${issueId}`,type,styleId,theme,commentIds:[...new Set(rows.map(c=>c.id))],issueId,basis,start:dateShift(today,-7),end:dateShift(today,-1)})
 for(const styleId of new Set(recent.map(c=>c.association.styleId))){const rows=recent.filter(c=>c.association.styleId===styleId),low=rows.filter(c=>c.raw.rating!=null&&c.raw.rating<=2&&!currentClassification(c));if(low.length)push('低星待复核',styleId,'',low,`${low.length}条低星评论待复核`)
 for(const theme of FEEDBACK_THEMES){const matches=rows.filter(c=>currentClassification(c)?.tags.some(t=>t.theme===theme&&t.sentiment==='问题'));if(matches.length>=3)push('同类问题集中',styleId,theme,matches,`${theme}问题评论${matches.length}条`)}
 const objectKeys=(items:FeedbackComment[])=>[...new Set(items.map(c=>[c.raw.storeId,c.association.listingId,c.association.skuId||'SKU未确定'].join('/')))].sort().join('|')
 const old=s.comments.filter(c=>c.association.styleId===styleId&&c.raw.timeQuality==='可信'&&c.raw.commentAt&&c.raw.commentAt>=previous&&c.raw.commentAt<start),a=summarizeComments(old),b=summarizeComments(rows),scope=scopeForComments(s.comments,styleId)
 if(objectKeys(old)===objectKeys(rows)&&a.rated>=20&&b.rated>=20&&b.negative-a.negative>=3&&(b.negativeRate!-a.negativeRate!)>=.05-1e-12&&!coverageGaps(s,scope,{start:previous,end}).length)push('差评比例变化',styleId,'',rows,`${a.negative}/${a.rated} → ${b.negative}/${b.rated}，增加${((b.negativeRate!-a.negativeRate!)*100).toFixed(1)}个百分点`)
 }
 for(const i of s.issues||[])if(activeIssue(i)||i.status==='已关闭'){const rows=recent.filter(c=>eligibleEvidence(i,c)&&!i.evidence.some(e=>e.commentId===c.id&&!e.released)&&(i.status!=='已关闭'||!!i.closedAt&&c.raw.commentAt!>i.closedAt));if(rows.length)push(i.status==='已关闭'?'关闭后新评论':'已有跟进新证据',i.scope.styleId,i.theme,rows,`可核对${rows.length}条新证据`,i.id)}
 return result.sort((a,b)=>a.type.localeCompare(b.type)||a.styleId.localeCompare(b.styleId)||a.id.localeCompare(b.id))
}
