import { getChannelListing, listChannelVariants } from '../pcs-channel-catalog.ts'
import { applyFeedbackCommand, currentClassification, dateShift, feedbackMd5, filterComments, summarizeComments } from './model.ts'
import { businessDay, commentStamp, coverageGaps, issueBasis, issueEvidenceValid, reviewPreview, reviewStillCurrent, scopeContains, scopeForComments, translationFor } from './phase2-model.ts'
import { FEEDBACK_OWNER, type FeedbackCommand, type FeedbackComment, type FeedbackCommentFilter, type FeedbackSnapshot } from './types.ts'
import type { FeedbackIssue, FeedbackIssueScope } from './phase2-types.ts'
import { detailRule, FEEDBACK_DETAIL_RULES, FEEDBACK_DETAIL_RULE_VERSION } from './phase3-rules.ts'
import type { FeedbackCommonTopic, FeedbackComparisonMetric, FeedbackDetailAnnotation, FeedbackDetailItem, FeedbackExperience, FeedbackExperienceSource, FeedbackProcessingQueue, FeedbackProductComparison, FeedbackTopicIssueLink, FeedbackTopicMember, FeedbackTopicTuple } from './phase3-types.ts'

export function phase3(s: FeedbackSnapshot) {
  s.detailAnnotations ||= []; s.processingQueues ||= []; s.qualityReviews ||= []; s.commonTopics ||= []; s.experiences ||= []; s.experienceUsages ||= []; s.comparisons ||= []
  for (const rows of [s.detailAnnotations, s.qualityReviews, s.experienceUsages]) rows.sort((a,b) => a.order-b.order || a.at.localeCompare(b.at) || a.id.localeCompare(b.id))
  return s as FeedbackSnapshot & Required<Pick<FeedbackSnapshot,'detailAnnotations'|'processingQueues'|'qualityReviews'|'commonTopics'|'experiences'|'experienceUsages'|'comparisons'>>
}
const unique = <T>(xs: T[]) => [...new Set(xs)]
const text = (value: string, label: string) => { if (!value?.trim()) throw new Error(`请填写${label}`) }
const date = (value: string, label: string) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(value).toISOString().slice(0,10)!==value) throw new Error(`请选择有效的${label}`) }
export function detailStamp(s: FeedbackSnapshot, c: FeedbackComment, items: FeedbackDetailItem[] = []): string {
  return feedbackMd5(JSON.stringify([commentStamp(c,currentClassification(c)?.id||''),FEEDBACK_DETAIL_RULE_VERSION,unique(items.map(i=>i.translationId).filter(Boolean)).sort().map(id=>[id,translationFor(s,c)?.id===id])]))
}
export function detailValid(s: FeedbackSnapshot, c: FeedbackComment, a: FeedbackDetailAnnotation): boolean {
  const cls=currentClassification(c)
  return !!cls && a.state==='已确认' && a.ruleVersion===FEEDBACK_DETAIL_RULE_VERSION && a.classificationId===cls.id && a.contentVersion===c.contentVersion && a.stamp===detailStamp(s,c,a.items)
    && a.items.every(i=>{const r=detailRule(i.ruleId);return !!r&&cls.tags.some(t=>t.theme===r.theme&&t.sentiment===r.sentiment)&&(!i.translationId||translationFor(s,c)?.id===i.translationId)})
}
export function currentDetail(s: FeedbackSnapshot, c: FeedbackComment): FeedbackDetailAnnotation | undefined {
  const last=[...(s.detailAnnotations||[])].reverse().find(a=>a.commentId===c.id&&['已确认','已撤回'].includes(a.state))
  return last&&detailValid(s,c,last)?last:undefined
}
export const detailRevision=(s:FeedbackSnapshot,c:FeedbackComment)=>Math.max(0,...(s.detailAnnotations||[]).filter(a=>a.commentId===c.id).map(a=>a.revision))
export function detailDraft(s: FeedbackSnapshot, c: FeedbackComment): FeedbackDetailAnnotation | undefined { for(const a of [...(s.detailAnnotations||[])].reverse().filter(a=>a.commentId===c.id)){if(['已确认','已撤回'].includes(a.state))return undefined;if(['草稿','待复核'].includes(a.state))return a}return undefined }
export function detailStats(s: FeedbackSnapshot, rows: FeedbackComment[]) {
  rows=[...new Map(rows.map(c=>[c.id,c])).values()]
  const summary=summarizeComments(rows), confirmed=rows.filter(c=>currentDetail(s,c)), counts=FEEDBACK_DETAIL_RULES.map(rule=>{const ids=rows.filter(c=>currentDetail(s,c)?.items.some(i=>i.ruleId===rule.id)).map(c=>c.id);return {rule,count:ids.length,rate:rows.length?ids.length/rows.length:null,commentIds:ids,styleIds:unique(rows.filter(c=>ids.includes(c.id)).map(c=>c.association.styleId)),storeIds:unique(rows.filter(c=>ids.includes(c.id)).map(c=>c.raw.storeId))}})
  return { ...summary,detailed:confirmed.length,detailRate:rows.length?confirmed.length/rows.length:null,detailPending:rows.length-confirmed.length,counts,detailProblems:rows.filter(c=>currentDetail(s,c)?.items.some(i=>detailRule(i.ruleId)?.sentiment==='问题')).length }
}
export function qualityNeedsRepair(s:FeedbackSnapshot,c:FeedbackComment):boolean { const last=[...(s.detailAnnotations||[])].reverse().find(a=>a.commentId===c.id&&['已确认','已撤回'].includes(a.state));return !currentClassification(c)||!!last&&last.state==='已确认'&&!currentDetail(s,c) }
export const qualityReviewStamp=(s:FeedbackSnapshot,c:FeedbackComment)=>feedbackMd5(JSON.stringify([detailStamp(s,c),[...(s.detailAnnotations||[])].reverse().find(a=>a.commentId===c.id&&['已确认','已撤回'].includes(a.state))?.id||'',currentDetail(s,c)?.stamp||'']))
export const processingStamp = (s: FeedbackSnapshot,c: FeedbackComment) => feedbackMd5(JSON.stringify([detailStamp(s,c),currentDetail(s,c)?.id||'',(s.qualityReviews||[]).filter(r=>r.commentId===c.id&&r.stamp===qualityReviewStamp(s,c)).at(-1)?.id||'']))
export function queueBuckets(s: FeedbackSnapshot,q: FeedbackProcessingQueue) {
  const result={completed:0,draft:0,skipped:0,changed:0,pending:0}
  for(const item of q.items){const c=s.comments.find(c=>c.id===item.commentId);if(!c||item.stamp!==processingStamp(s,c)){result.changed++;continue} if(item.outcome==='已完成'&&item.accepted&&queuePurposeDone(s,q,c)){result.completed++;continue}if(item.outcome==='草稿')result.draft++;else if(item.outcome==='跳过')result.skipped++;else result.pending++}
  return result
}
export function queuePurposeDone(s: FeedbackSnapshot,q: FeedbackProcessingQueue,c: FeedbackComment): boolean {return q.purpose==='分类'?!!currentClassification(c):q.purpose==='补细分'?!!currentDetail(s,c):!!(s.qualityReviews||[]).find(r=>r.commentId===c.id&&r.stamp===qualityReviewStamp(s,c))}
export function qualityReasons(s: FeedbackSnapshot,c: FeedbackComment): string[] {
  const reasons:string[]=[];const all=(s.detailAnnotations||[]).filter(a=>a.commentId===c.id)
  if([...all].reverse().find(a=>['已确认','已撤回'].includes(a.state))?.state==='已确认'&&!currentDetail(s,c))reasons.push('细分依据变化')
  if(c.history.length&&!currentClassification(c))reasons.push('原文更新待复核')
  if(c.classifications.filter(a=>a.state==='已确认').length>1||c.classifications.some(a=>a.state==='已撤回'))reasons.push('人工修订记录')
  if(currentDetail(s,c)?.result==='信息不足')reasons.push('细分信息不足')
  return reasons
}
export function defaultDetailQuery(s:FeedbackSnapshot):FeedbackCommentFilter {const today=businessDay(s.asOf);return {dateType:'comment',start:dateShift(today,-30),end:dateShift(today,-1)}}
export function detailBaseRows(s:FeedbackSnapshot,q:FeedbackCommentFilter):FeedbackComment[]{return filterComments(s.comments,{...q,rating:'',theme:'',sentiment:'',classification:'',value:''})}
export function commonDetailCandidates(s:FeedbackSnapshot,q:FeedbackCommentFilter){return detailStats(s,detailBaseRows(s,q)).counts.filter(c=>c.rule.sentiment==='问题'&&c.count>=3&&c.styleIds.length>=2)}

const tupleKey = (styleId:string,skuId:string|null,storeId:string,listingId:string) => JSON.stringify([styleId,skuId,storeId,listingId])
export function captureTopicTuples(s:FeedbackSnapshot,scope:FeedbackIssueScope):FeedbackTopicTuple[]{
  const tuples=new Map<string,FeedbackTopicTuple>()
  for(const listingId of scope.listingIds){const listing=getChannelListing(listingId);if(!listing||listing.styleId!==scope.styleId||!scope.storeIds.includes(listing.storeId))continue
    for(const v of listChannelVariants(listingId).filter(v=>scope.skuIds.includes(v.internalSkuId))){const key=tupleKey(scope.styleId,v.internalSkuId,listing.storeId,listingId);const versions=listChannelVariants(listingId).filter(x=>x.internalSkuId===v.internalSkuId).map(x=>[x.platformVariantId,x.mappingVersion]).sort();tuples.set(key,{key,styleId:scope.styleId,skuId:v.internalSkuId,storeId:listing.storeId,listingId,mappingStamp:feedbackMd5(JSON.stringify(versions))})}
    if(scope.includeUnknown){const key=tupleKey(scope.styleId,null,listing.storeId,listingId);tuples.set(key,{key,styleId:scope.styleId,skuId:null,storeId:listing.storeId,listingId,mappingStamp:'未知规格桶'})}
  }
  // Purchase-history mappings remain valid source tuples even after the current catalog mapping changes.
  for(const c of s.comments.filter(c=>scopeContains(scope,c))){const key=tupleKey(scope.styleId,c.association.skuId,c.raw.storeId,c.association.listingId);if(!tuples.has(key))tuples.set(key,{key,styleId:scope.styleId,skuId:c.association.skuId,storeId:c.raw.storeId,listingId:c.association.listingId,mappingStamp:c.association.skuId?`历史:${c.association.mappingVersion}:${c.association.evidence}`:'未知规格桶'})}
  return [...tuples.values()].sort((a,b)=>a.key.localeCompare(b.key))
}
export function topicEvidenceStamp(s:FeedbackSnapshot,c:FeedbackComment):string{return feedbackMd5(JSON.stringify([detailStamp(s,c,currentDetail(s,c)?.items||[]),currentDetail(s,c)?.id||'']))}
export function topicEvidenceValid(s:FeedbackSnapshot,t:FeedbackCommonTopic,m:FeedbackTopicMember,e:FeedbackTopicMember['evidence'][number]):boolean {const c=s.comments.find(c=>c.id===e.commentId),a=c&&currentDetail(s,c);return !!c&&!!a&&!e.released&&e.definitionVersion===t.definitionVersion&&scopeContains(m.scope,c)&&a.id===e.detailId&&a.items.some(i=>i.ruleId===t.ruleId)&&e.stamp===topicEvidenceStamp(s,c)}
export function topicIssueBasis(i:FeedbackIssue):string{return feedbackMd5(JSON.stringify([i.scope,i.theme,i.definition,i.definitionVersion,i.cancelledDraft]))}
export function issueTupleIntersection(issue:FeedbackIssue,m:FeedbackTopicMember):FeedbackTopicTuple[]{return m.tuples.filter(t=>t.styleId===issue.scope.styleId&&issue.scope.storeIds.includes(t.storeId)&&issue.scope.listingIds.includes(t.listingId)&&(t.skuId?issue.scope.skuIds.includes(t.skuId):issue.scope.includeUnknown))}
export function topicLinkValid(s:FeedbackSnapshot,t:FeedbackCommonTopic,m:FeedbackTopicMember,l:FeedbackTopicIssueLink):boolean {
 const issue=s.issues?.find(i=>i.id===l.issueId),c=s.comments.find(c=>c.id===l.commentId),e=m.evidence.find(e=>e.commentId===l.commentId&&topicEvidenceValid(s,t,m,e))
 if(!issue||issue.status==='草稿'||issue.status==='已作废'||!c||!e||l.released||l.definitionVersion!==t.definitionVersion||l.issueBasis!==topicIssueBasis(issue)||l.stamp!==topicEvidenceStamp(s,c)||!topicEvidenceValid(s,t,m,e)||!issue.evidence.some(e=>e.commentId===c.id&&issueEvidenceValid(s,issue,e)))return false
 const actual=captureTopicTuples(s,m.scope),allowed=issueTupleIntersection(issue,m);if(l.tupleStamp!==feedbackMd5(JSON.stringify(m.tuples.filter(x=>l.tupleKeys.includes(x.key)))))return false
 return l.tupleKeys.length>0&&l.tupleKeys.every(key=>allowed.some(x=>x.key===key)&&m.tuples.some(x=>x.key===key&&actual.some(y=>y.key===key&&y.mappingStamp===x.mappingStamp)))
}
export function topicMemberProgress(s:FeedbackSnapshot,t:FeedbackCommonTopic,m:FeedbackTopicMember){
 const validEvidence=[...new Map(m.evidence.filter(e=>topicEvidenceValid(s,t,m,e)).map(e=>[e.commentId,e])).values()],changed=m.evidence.filter(e=>!e.released&&!topicEvidenceValid(s,t,m,e)).length
 const links=m.links.filter(l=>!l.released),valid=links.filter(l=>topicLinkValid(s,t,m,l)),covered=new Set(valid.flatMap(l=>l.tupleKeys)),missing=m.tuples.filter(x=>!covered.has(x.key)),issues=unique(valid.map(l=>l.issueId)).map(id=>s.issues!.find(i=>i.id===id)!)
 const state=changed||links.length!==valid.length?'证据或范围待核对':!issues.length?'待建跟进':missing.length?'部分范围已跟进':issues.every(i=>i.status==='已关闭')?'已结束':issues.every(i=>['已关闭','待复盘'].includes(i.status))?'待复盘':'跟进中'
 return {state,validEvidence:validEvidence.length,changed,links:valid,missing,issues,ended:state==='已结束'}
}
export function blankTopic(s:FeedbackSnapshot,styleIds:string[],ruleId:string,discovery?:FeedbackCommentFilter,evidenceIds?:string[]):FeedbackCommonTopic{const sourceIds=(discovery as any)?.commentIds as string|undefined,source=discovery?filterComments(s.comments,{...discovery,...sourceIds?{search:''}:{}}).filter(c=>!sourceIds||sourceIds.split(',').includes(c.id)):s.comments;return {id:crypto.randomUUID(),number:'',title:`${detailRule(ruleId)?.label||'共性反馈'}专题`,ruleId,definition:detailRule(ruleId)?.definition||'',definitionVersion:1,owner:FEEDBACK_OWNER,dueDate:dateShift(businessDay(s.asOf),7),discovery:discovery?structuredClone(discovery):defaultDetailQuery(s),members:unique(styleIds).map(styleId=>{const scope=scopeForComments(source,styleId);return {styleId,scope,tuples:captureTopicTuples(s,scope),evidence:source.filter(c=>(!evidenceIds||evidenceIds.includes(c.id))&&scopeContains(scope,c)&&currentDetail(s,c)?.items.some(i=>i.ruleId===ruleId)).map(c=>({commentId:c.id,stamp:topicEvidenceStamp(s,c),detailId:currentDetail(s,c)!.id,definitionVersion:1,reason:c.raw.content,released:false})),links:[]}}),status:'草稿',round:1,version:0,createdAt:'',updatedAt:'',archiveKind:'',summary:'',arrangements:{},history:[]}}

export function closingReview(s:FeedbackSnapshot,issueId:string){const i=s.issues?.find(i=>i.id===issueId);if(!i||i.status!=='已关闭')return undefined;return [...(s.issueReviews||[])].reverse().find(r=>r.issueId===i.id&&r.round===i.round&&r.decision==='结束本次跟进'&&r.at<=i.closedAt&&reviewStillCurrent(s,i,r))}
export function experienceSource(s:FeedbackSnapshot,issueId:string):FeedbackExperienceSource|undefined{const i=s.issues?.find(i=>i.id===issueId),r=closingReview(s,issueId);if(!i||!r)return undefined;const current=reviewPreview(s,i,r.plan);return {issueId,reviewId:r.id,stamp:feedbackMd5(JSON.stringify([i.id,i.round,i.closedAt,r.id,r.previewToken,current.token])),snapshot:JSON.stringify({issue:i,review:r,actions:s.issueActions?.filter(a=>a.issueId===i.id&&a.round===i.round)}),outcome:r.kind==='核查结论'?'已完成核查':r.conclusion==='数据条件不足'?'效果待验证':r.before&&r.after&&r.before.total&&r.after.total&&r.after.Y/r.after.total<r.before.Y/r.before.total?'观察到问题占比下降':'未观察到一致下降'}}
export function experienceAvailable(s:FeedbackSnapshot,e:FeedbackExperience):boolean{return e.state==='已启用'&&!e.cancelled&&e.sources.length>0&&e.sources.every(src=>{const current=experienceSource(s,src.issueId);return current?.reviewId===src.reviewId&&current.stamp===src.stamp})}
export const experienceStamp=(s:FeedbackSnapshot,e:FeedbackExperience)=>feedbackMd5(JSON.stringify([e.id,e.revision,e.state,e.title,e.measures,e.conditions,e.limitations,e.sources.map(src=>[src.issueId,experienceSource(s,src.issueId)?.stamp||'来源有更新'])]))
export function comparisonPreview(s:FeedbackSnapshot,input:Pick<FeedbackProductComparison,'styleIds'|'query'|'scopes'>){
 const styles=unique(input.styleIds),query={...input.query,dateType:'comment' as const,rating:'',theme:'',sentiment:'',classification:'',value:''},all=detailBaseRows(s,query).filter(c=>!(query as any).storeIds||(query as any).storeIds.includes(c.raw.storeId)),samples:unknown[]=[]
 const metrics:FeedbackComparisonMetric[]=styles.map(styleId=>{const originalScope=input.scopes.find(x=>x.styleId===styleId)||scopeForComments(s.comments,styleId),storeIds=(query as any).storeIds as string[]|undefined,scope={...originalScope,storeIds:originalScope.storeIds.filter(id=>(!query.storeId||query.storeId===id)&&(!storeIds||storeIds.includes(id))),listingIds:originalScope.listingIds.filter(id=>{const store=getChannelListing(id)?.storeId;return !!store&&(!query.storeId||query.storeId===store)&&(!storeIds||storeIds.includes(store))})},rows=all.filter(c=>scopeContains(scope,c)),m=detailStats(s,rows),composition:Record<string,number>={}
  for(const c of rows){const key=JSON.stringify([c.raw.storeId,c.association.listingId,c.association.skuId]);composition[key]=(composition[key]||0)+1;samples.push({id:c.id,raw:c.raw,association:c.association,classification:currentClassification(c),detail:currentDetail(s,c),translation:currentDetail(s,c)?.items.filter(i=>i.translationId).map(i=>translationFor(s,c))})}
  const coverage=input.query.start&&input.query.end?coverageGaps(s,scope,{start:new Date(`${query.start}T00:00:00+07:00`).toISOString(),end:new Date(`${dateShift(query.end!,1)}T00:00:00+07:00`).toISOString()}):['未限定完整观察期间']
  return {styleId,scope,commentIds:rows.map(c=>c.id),total:m.total,rated:m.rated,negative:m.negative,ratingSum:rows.reduce((n,c)=>n+(c.raw.rating||0),0),classified:m.classified,detailed:m.detailed,unknownTime:s.comments.filter(c=>scopeContains(scope,c)&&(!c.raw.commentAt||c.raw.timeQuality!=='可信')).length,unknownSku:m.unknownSku,coverage,details:m.counts.filter(x=>x.count).map(x=>({ruleId:x.rule.id,count:x.count,commentIds:x.commentIds})),positive:rows.filter(c=>currentClassification(c)?.tags.some(t=>t.sentiment==='正向')).map(c=>c.id),problem:rows.filter(c=>currentClassification(c)?.tags.some(t=>t.sentiment==='问题')).map(c=>c.id),composition}
 })
 samples.sort((a:any,b:any)=>a.id.localeCompare(b.id))
 return {metrics,samples:JSON.stringify(samples),token:feedbackMd5(JSON.stringify([styles,query,metrics,samples]))}
}
export function comparisonChanged(s:FeedbackSnapshot,c:FeedbackProductComparison):boolean{return c.state==='已保存'&&c.token!==comparisonPreview(s,c).token}
export function blankExperience(s:FeedbackSnapshot,issueIds:string[]=[]):FeedbackExperience {return {id:crypto.randomUUID(),number:'',title:'',kind:'措施参考',ruleId:'',description:'',measures:'',conditions:'',limitations:'',sources:issueIds.map(id=>experienceSource(s,id)).filter((x):x is FeedbackExperienceSource=>!!x),state:'草稿',revision:1,version:0,actor:FEEDBACK_OWNER,at:s.asOf,reason:'',cancelled:false,history:[]}}
export function blankComparison(s:FeedbackSnapshot,styleIds:string[]=[]):FeedbackProductComparison{return {id:crypto.randomUUID(),title:'商品反馈对比',styleIds:unique(styleIds),query:defaultDetailQuery(s),scopes:unique(styleIds).map(id=>scopeForComments(s.comments,id)),notes:'',limitations:'',experienceIds:[],state:'草稿',revision:1,version:0,actor:FEEDBACK_OWNER,at:s.asOf,token:'',metrics:[],samples:'',cancelled:false,history:[]}}

function validateItems(s:FeedbackSnapshot,c:FeedbackComment,items:FeedbackDetailItem[],formal:boolean){
 if(formal)for(const [a,b]of [['fabric-thin','fabric-thick'],['waist-small','waist-large'],['chest-small','chest-large'],['length-short','length-long'],['trouser-short','trouser-long']]){const x=items.find(i=>i.ruleId===a),y=items.find(i=>i.ruleId===b);if(x&&y&&(!x.note.trim()||!y.note.trim()||x.evidence===y.evidence))throw new Error('相反表现需分别填写不同依据及语境说明')}
 if(new Set(items.map(i=>i.ruleId)).size!==items.length)throw new Error('同一具体表现不可重复选择')
 for(const item of items){const rule=detailRule(item.ruleId);if(!rule)throw new Error('具体表现已变更，请重新选择');if(!formal)continue
  if(!currentClassification(c)?.tags.some(t=>t.theme===rule.theme&&t.sentiment===rule.sentiment))throw new Error(`请先确认一级分类“${rule.theme}·${rule.sentiment}”，再确认${rule.label}`)
  text(item.evidence,'每项表现的原句或图片依据')
  if(item.basis==='原文'&&(!c.raw.content.includes(item.evidence)||item.translationId))throw new Error('原句依据须来自本条原文，且不能隐含依赖译文')
  if(item.basis==='图片'&&(!c.raw.images.includes(item.evidence)||item.translationId))throw new Error('图片依据须选择本条评论的真实图片')
  if(item.basis==='中文译文'&&(!item.translationId||translationFor(s,c)?.id!==item.translationId||!translationFor(s,c)?.text.includes(item.evidence)))throw new Error('译文依据已变化，请核对当前译文')
 }
}
function queueUpdate(s:ReturnType<typeof phase3>,id:string|undefined,version:number|undefined,c:FeedbackComment,outcome:'已完成'|'草稿',at:string,advance=false){if(!id)return;const q=s.processingQueues.find(q=>q.id===id);if(!q||q.version!==version||q.status!=='处理中')throw new Error('处理队列已更新，请重新读取');const item=q.items[q.currentIndex];if(item?.commentId!==c.id)throw new Error('当前评论与队列位置不一致');item.stamp=processingStamp(s,c);item.outcome=outcome;item.accepted=outcome==='已完成';if(advance&&q.currentIndex<q.items.length-1)q.currentIndex++;q.version++;q.updatedAt=at}
function getTopic(s:ReturnType<typeof phase3>,id:string,version:number){const t=s.commonTopics.find(t=>t.id===id);if(!t||t.version!==version)throw new Error('专题已更新，请重新读取');return t}
function mutableTopic(t:FeedbackCommonTopic){if(t.status!=='跟进中')throw new Error('请先正式创建或重开专题')}
function validTopicEvidence(s:FeedbackSnapshot,t:FeedbackCommonTopic,m:FeedbackTopicMember,id:string,stamp:string){const c=s.comments.find(c=>c.id===id),a=c&&currentDetail(s,c);if(!c||!a||!scopeContains(m.scope,c)||!a.items.some(i=>i.ruleId===t.ruleId)||detailRule(t.ruleId)?.sentiment!=='问题'||topicEvidenceStamp(s,c)!==stamp)throw new Error('专题证据须为当前范围内已确认的同表现问题评论，请重新核对');return {commentId:id,stamp,detailId:a.id,definitionVersion:t.definitionVersion,reason:c.raw.content,released:false}}
function topicHistory(t:FeedbackCommonTopic,actor:string,at:string,action:string,reason:string){t.history.push({at,actor,action,reason,snapshot:JSON.stringify({...t,history:undefined})});t.version++;t.updatedAt=at}

export function applyPhase3Command(s0:FeedbackSnapshot,command:FeedbackCommand,actor:string,at:string):{objectId:string;detail:string}{
 const s=phase3(s0),cmd=command as Extract<FeedbackCommand,{type:`p3-${string}`}>
 const getComment=(id:string)=>{const c=s.comments.find(c=>c.id===id);if(!c)throw new Error('评论不存在');return c}
 if(cmd.type==='p3-base'){
  let c=getComment(cmd.commentId);if(c.version!==cmd.expectedVersion||detailStamp(s,c)!==cmd.expectedStamp)throw new Error('评论或分类已变化，请重新核对');
  Object.assign(s,applyFeedbackCommand(s,{...cmd,type:'save-classification',expectedContentVersion:c.contentVersion,operationId:cmd.operationId+'-base'}));c=getComment(cmd.commentId);queueUpdate(s,cmd.queueId,cmd.queueVersion,c,cmd.state==='已确认'?'已完成':'草稿',at,!!cmd.advance&&cmd.state==='已确认');return {objectId:c.id,detail:'保存一级分类及处理位置'}
 }
 if(cmd.type==='p3-detail'){
  let c=getComment(cmd.commentId);const hadFormalDetail=s.detailAnnotations.some(a=>a.commentId===c.id&&['已确认','已撤回'].includes(a.state));if(c.version!==cmd.expectedVersion||detailRevision(s,c)!==cmd.expectedDetailRevision||detailStamp(s,c,cmd.items)!==cmd.expectedStamp)throw new Error('评论或分类已变化，请重新核对，输入已保留')
  if(cmd.base){if(cmd.state==='已撤回')throw new Error('撤回细分不能同时修改一级分类');Object.assign(s,applyFeedbackCommand(s,{type:'save-classification',operationId:cmd.operationId+'-base',actor,at,commentId:c.id,expectedVersion:c.version,expectedContentVersion:c.contentVersion,...cmd.base,state:cmd.state==='已确认'?'已确认':'草稿'}));c=getComment(cmd.commentId)}
  const old=currentDetail(s,c);if((hadFormalDetail&&cmd.state==='已确认')||cmd.state==='已撤回')text(cmd.reason,'修订或撤回原因')
  if(cmd.state==='已撤回'){if(!old)throw new Error('当前没有可撤回的细分结果');s.detailAnnotations.push({...structuredClone(old),id:cmd.operationId,state:'已撤回',revision:detailRevision(s,c)+1,actor,at,reason:cmd.reason,order:s.version+1})}else{
   const formal=cmd.state==='已确认';if(formal&&!currentClassification(c))throw new Error('请先人工确认一级分类');if(formal&&cmd.result!=='明确表现')text(cmd.note,'已阅读范围与细分核对说明');if(formal&&!cmd.result)throw new Error('请选择细分核对结果');if(formal&&cmd.result==='明确表现'&&!cmd.items.length)throw new Error('请为明确表现选择至少一项并填写依据');if(formal&&cmd.result!=='明确表现'&&cmd.items.length)throw new Error('非明确表现不能同时保存具体表现项')
   validateItems(s,c,cmd.items,formal)
   s.detailAnnotations.push({id:cmd.operationId,commentId:c.id,stamp:detailStamp(s,c,cmd.items),contentVersion:c.contentVersion,classificationId:currentClassification(c)?.id||'',ruleVersion:FEEDBACK_DETAIL_RULE_VERSION,result:cmd.result,items:structuredClone(cmd.items),note:cmd.note,state:cmd.state,revision:1+Math.max(0,...s.detailAnnotations.filter(a=>a.commentId===c.id).map(a=>a.revision)),order:s.version+1,actor,at,reason:cmd.reason})
  }
  queueUpdate(s,cmd.queueId,cmd.queueVersion,c,cmd.state==='已确认'?'已完成':'草稿',at,!!cmd.advance&&cmd.state==='已确认')
  return {objectId:c.id,detail:cmd.state==='已确认'?'逐条确认具体表现':cmd.state==='已撤回'?'撤回细分确认':'保存细分草稿'}
 }
 if(cmd.type==='p3-bulk-details'){
  if(!cmd.commentIds.length||unique(cmd.commentIds).length!==cmd.commentIds.length)throw new Error('请选择不重复的评论')
  for(const id of cmd.commentIds){const c=getComment(id),items=cmd.items[id]||[];if(cmd.expectedRevisions[id]!==detailRevision(s,c)||cmd.stamps[id]!==detailStamp(s,c,items))throw new Error('所选评论依据有变化，本批草稿未保存');if(detailDraft(s,c)&&!cmd.replaceDrafts)throw new Error('存在已有草稿，请明确是否替换');Object.assign(s,applyFeedbackCommand(s,{...cmd,type:'p3-detail',operationId:`${cmd.operationId}-${id}`,commentId:id,expectedDetailRevision:cmd.expectedRevisions[id],expectedVersion:c.version,expectedStamp:cmd.stamps[id],result:cmd.result,items,note:cmd.note,state:'草稿',reason:'批量候选草稿',actor,at}))}
  return {objectId:cmd.commentIds.join(','),detail:'批量保存候选草稿，未确认分类'}
 }
 if(cmd.type==='p3-queue-create'){
  const q=structuredClone(cmd.queue);if(s.processingQueues.some(x=>x.id===q.id)||!q.items.length||unique(q.items.map(x=>x.commentId)).length!==q.items.length)throw new Error('处理队列须有明确且不重复的评论')
  q.items=q.items.map(item=>{const c=getComment(item.commentId);if(item.stamp!==processingStamp(s,c))throw new Error('队列预览后评论已变化');return {...item,outcome:'未处理',accepted:false}});q.version=1;q.status='处理中';q.currentIndex=0;q.actor=actor;q.at=at;q.updatedAt=at;s.processingQueues.push(q);return {objectId:q.id,detail:'建立固定评论处理队列'}
 }
 if(cmd.type==='p3-queue'){
  const q=s.processingQueues.find(x=>x.id===cmd.queueId);if(!q||q.version!==cmd.expectedVersion)throw new Error('队列已变化，请重新读取')
  if(cmd.intent==='定位'){if(!Number.isInteger(cmd.index)||cmd.index!<0||cmd.index!>=q.items.length)throw new Error('队列位置无效');q.currentIndex=cmd.index!}
  if(cmd.intent==='跳过'){if(q.status!=='处理中')throw new Error('请先继续处理');const item=q.items[q.currentIndex],c=getComment(item.commentId);item.stamp=processingStamp(s,c);item.outcome='跳过';item.reason=cmd.reason;item.accepted=false;if(q.currentIndex<q.items.length-1)q.currentIndex++}
  if(cmd.intent==='采用当前结果'){if(q.status!=='处理中')throw new Error('请先继续处理队列');const item=q.items[q.currentIndex],c=getComment(item.commentId);if(!queuePurposeDone(s,q,c))throw new Error('当前结果尚未满足本队列用途');item.stamp=processingStamp(s,c);item.outcome='已完成';item.accepted=true}
  if(cmd.intent==='结束')q.status='已结束';if(cmd.intent==='继续')q.status='处理中'
  if(cmd.intent==='更新队列'){const ids=unique(cmd.commentIds||[]);if(!ids.length)throw new Error('更新队列不能为空');q.items=ids.map(id=>q.items.find(x=>x.commentId===id)||{commentId:id,stamp:processingStamp(s,getComment(id)),outcome:'未处理',reason:'',accepted:false});q.currentIndex=Math.min(q.currentIndex,q.items.length-1)}
  q.version++;q.updatedAt=at;return {objectId:q.id,detail:cmd.intent+'队列'}
 }
 if(cmd.type==='p3-quality'){
  const c=getComment(cmd.commentId);if(cmd.expectedStamp!==qualityReviewStamp(s,c))throw new Error('回查依据已变化');text(cmd.reason,'回查原因');text(cmd.note,'核对说明');if(qualityNeedsRepair(s,c))throw new Error('请先修复失效的一级或细分结果，不能用说明代替确认')
  s.qualityReviews.push({id:cmd.operationId,commentId:c.id,reason:cmd.reason,stamp:cmd.expectedStamp,result:cmd.result,note:cmd.note,actor,at,order:s.version+1});queueUpdate(s,cmd.queueId,cmd.queueVersion,c,'已完成',at,!!cmd.advance);return {objectId:c.id,detail:'保存分类回查核对'}
 }
 if(cmd.type==='p3-topic-save'){
  const input=structuredClone(cmd.topic),old=s.commonTopics.find(x=>x.id===input.id);if((old?.version||0)!==cmd.expectedVersion)throw new Error('专题已变化');if(old&&['已归档','已作废'].includes(old.status))throw new Error('已归档专题须先重开，作废专题只读');text(input.title,'专题标题');if(cmd.draft&&old&&old.status!=='草稿')throw new Error('正式专题修改请直接保存修订，不能退回草稿')
  if(old&&old.status!=='草稿'&&old.ruleId!==input.ruleId)throw new Error('更换主表现请另建专题');if(old&&old.status!=='草稿')text(cmd.reason,'修改原因')
  if((!old||old.status==='草稿')&&!cmd.draft&&s.commonTopics.some(t=>t.status==='跟进中'&&t.ruleId===input.ruleId&&t.members.some(m=>input.members.some(n=>n.styleId===m.styleId))))text(cmd.reason,'与已有相关专题的区别')
  input.definitionVersion=old?old.definitionVersion+(old.definition!==input.definition?1:0):1;input.members=structuredClone(input.members)
  if(unique(input.members.map(m=>m.styleId)).length!==input.members.length)throw new Error('同一SPU不能重复加入专题')
  if(!cmd.draft){text(input.definition,'共性判定说明');if(input.owner!==FEEDBACK_OWNER)throw new Error('请选择现有负责人');date(input.dueDate,'目标复核日');if(input.members.length<(!old||old.status==='草稿'?2:1)||detailRule(input.ruleId)?.sentiment!=='问题')throw new Error('正式专题至少两款且围绕一个具体问题表现')}
  for(const m of input.members){if(unique(m.evidence.map(e=>e.commentId)).length!==m.evidence.length)throw new Error('同款专题证据不可重复');if(m.styleId!==m.scope.styleId)throw new Error('专题成员与范围不一致');if(!m.tuples.length)m.tuples=captureTopicTuples(s,m.scope);const actual=captureTopicTuples(s,m.scope),prior=old?.members.find(x=>x.styleId===m.styleId);if(m.tuples.some(t=>!actual.some(a=>a.key===t.key&&a.mappingStamp===t.mappingStamp))&&(!prior||JSON.stringify(prior.scope)!==JSON.stringify(m.scope)||JSON.stringify(prior.tuples)!==JSON.stringify(m.tuples)))throw new Error('所选规格与链接映射已有变化，请重新核对')
   m.evidence=m.evidence.map(e=>{if(e.released)return e;if(prior?.evidence.some(p=>p.commentId===e.commentId&&p.stamp===e.stamp&&p.detailId===e.detailId)&&JSON.stringify(prior.scope)===JSON.stringify(m.scope))return e;return {...validTopicEvidence(s,input,m,e.commentId,cmd.expectedStamps[e.commentId]),reason:e.reason}})
   if(!cmd.draft&&(!old||old.status==='草稿')&&!m.evidence.some(e=>topicEvidenceValid(s,input,m,e)))throw new Error('每款至少需要一条当前有效的同表现问题证据')
  }
  input.createdAt=old?.createdAt||at;input.updatedAt=at;input.number=old?.number||`CT-${businessDay(at).replaceAll('-','')}-${String(s.commonTopics.length+1).padStart(3,'0')}`;input.status=cmd.draft?'草稿':'跟进中';input.version=(old?.version||0)+1;input.round=old?.round||1;input.history=old?.history||[];if(old)input.history.push({at,actor,action:'修订专题',reason:cmd.reason,snapshot:JSON.stringify({...old,history:undefined})});if(old)Object.assign(old,input);else s.commonTopics.push(input);return {objectId:input.id,detail:cmd.draft?'保存专题草稿':'保存共性专题'}
 }
 if(cmd.type==='p3-topic-evidence'){
  const t=getTopic(s,cmd.topicId,cmd.expectedVersion);mutableTopic(t);const m=t.members.find(m=>m.styleId===cmd.styleId);if(!m)throw new Error('专题商品不存在');text(cmd.reason,'证据核对说明');topicHistory(t,actor,at,'核对证据',cmd.reason)
  for(const id of unique(cmd.commentIds)){const old=m.evidence.find(e=>e.commentId===id);if(cmd.release){if(!old)throw new Error('引用不存在');old.released=true}else{const next={...validTopicEvidence(s,t,m,id,cmd.expectedStamps[id]),reason:cmd.reason};if(old)Object.assign(old,next);else m.evidence.push(next)}}return {objectId:t.id,detail:cmd.release?'解除专题证据':'确认专题证据'}
 }
 if(cmd.type==='p3-topic-link'){
  let t=getTopic(s,cmd.topicId,cmd.expectedVersion);mutableTopic(t);let m=t.members.find(m=>m.styleId===cmd.styleId);if(!m)throw new Error('专题商品不存在');text(cmd.link.reason,'关联或解除说明')
  if(cmd.issue){Object.assign(s,applyFeedbackCommand(s,{type:'p2-save-issue',operationId:cmd.operationId+'-issue',actor,at,issue:cmd.issue,expectedVersion:cmd.expectedIssueVersion||0,draft:false,reason:'',distinction:cmd.link.reason,expectedCommentStamps:cmd.expectedCommentStamps}));t=getTopic(s,cmd.topicId,cmd.expectedVersion);m=t.members.find(m=>m.styleId===cmd.styleId)!;}
  const next=structuredClone(cmd.link),old=m.links.find(l=>l.issueId===next.issueId);if(cmd.release){if(!old)throw new Error('关联不存在');old.released=true}else{const i=s.issues!.find(i=>i.id===next.issueId);if(!i||i.scope.styleId!==m.styleId||i.theme!==detailRule(t.ruleId)?.theme)throw new Error('请选择同款同主主题的正式跟进');next.issueBasis=topicIssueBasis(i);next.tupleStamp=feedbackMd5(JSON.stringify(m.tuples.filter(x=>next.tupleKeys.includes(x.key))));next.definitionVersion=t.definitionVersion;next.released=false;if(!topicLinkValid(s,t,m,next))throw new Error('关联须有共同有效证据和实际覆盖范围，请核对');if(old)Object.assign(old,next);else m.links.push(next)}topicHistory(t,actor,at,cmd.release?'解除问题关联':'关联单款问题',next.reason);return {objectId:t.id,detail:'保存单款跟进关联'}
 }
 if(cmd.type==='p3-topic-state'){
  const t=getTopic(s,cmd.topicId,cmd.expectedVersion);text(cmd.reason,'操作说明')
  if(cmd.intent==='取消草稿'){if(t.status!=='草稿')throw new Error('仅草稿可取消');t.status='已作废'}
  else if(cmd.intent==='重开'){if(t.status!=='已归档')throw new Error('只有已归档专题可重开');if(cmd.owner!==FEEDBACK_OWNER)throw new Error('请选择现有负责人');date(cmd.dueDate||'','目标复核日');t.status='跟进中';t.round++;t.owner=cmd.owner!;t.dueDate=cmd.dueDate!}
  else{mutableTopic(t);if(cmd.intent==='作废')t.status='已作废';else{if(!cmd.archiveKind)throw new Error('请选择归档方式');const unfinished=t.members.filter(m=>!topicMemberProgress(s,t,m).ended);if(cmd.archiveKind==='各款均已结束'&&(unfinished.length||t.members.length<2))throw new Error('各款范围、证据及实际问题尚未全部结束');if(cmd.archiveKind==='不再继续协调')for(const m of unfinished)text(cmd.arrangements?.[m.styleId]||'','每款未结束事项的安排');t.archiveSnapshot=JSON.stringify({at,members:t.members.map(m=>{const p=topicMemberProgress(s,t,m),ids=p.issues.map(i=>i.id);return {styleId:m.styleId,state:p.state,validEvidence:p.validEvidence,changed:p.changed,missing:p.missing,scope:m.scope,tuples:m.tuples,evidence:m.evidence,issues:p.issues,actions:s.issueActions?.filter(a=>ids.includes(a.issueId)),plans:s.issuePlans?.filter(p=>ids.includes(p.issueId)),reviews:s.issueReviews?.filter(r=>ids.includes(r.issueId)&&!r.draft)}})});t.archiveKind=cmd.archiveKind;t.summary=cmd.reason;t.arrangements=cmd.arrangements||{};t.status='已归档'}}
  topicHistory(t,actor,at,cmd.intent,cmd.reason);return {objectId:t.id,detail:cmd.intent+'专题，单款问题状态保持不变'}
 }
 if(cmd.type==='p3-experience'){
  const input=structuredClone(cmd.experience),old=s.experiences.find(e=>e.id===input.id);if((old?.version||0)!==cmd.expectedVersion)throw new Error('经验已更新，请重新读取');if(old)text(cmd.reason,'修改或停用原因');text(input.title,'经验标题')
  if(cmd.intent==='停用'){if(!old||old.state!=='已启用')throw new Error('只有已启用经验可停用');old.history.push({at,snapshot:JSON.stringify({...old,history:undefined}),reason:cmd.reason});old.state='已停用';old.version++;old.reason=cmd.reason;return {objectId:old.id,detail:'停用经验，旧引用保留'}}
  if(cmd.intent==='取消草稿'){if(!old||old.state!=='草稿'&&!old.draft)throw new Error('只有草稿可取消');if(old.draft)delete old.draft;else old.cancelled=true;old.version++;return {objectId:old.id,detail:'取消经验草稿'}}
  if(cmd.intent==='草稿'&&old&&old.state!=='草稿'){delete input.draft;old.draft=input;old.version++;return {objectId:old.id,detail:'保存经验修订草稿，当前版本继续保留'}}
  if(cmd.intent==='启用'){text(input.description,'问题摘要');text(input.measures,'实际措施摘要');text(input.conditions,'适用条件');text(input.limitations,'限制和待验证事项');if(!input.sources.length)throw new Error('请选择当前关单实际依据的正式复盘');if(unique(input.sources.map(x=>x.issueId)).length!==input.sources.length)throw new Error('同一实际关单来源不可重复引用');input.sources=input.sources.map(src=>{const next=experienceSource(s,src.issueId);if(!next||next.reviewId!==src.reviewId||cmd.sourceStamps[src.issueId]!==next.stamp)throw new Error('来源复盘、评论或覆盖已有变化，请重新核对');return next})}
  if(old){input.history=[...old.history,{at,snapshot:JSON.stringify({...old,history:undefined}),reason:cmd.reason}];input.revision=old.revision+(old.state!=='草稿'?1:0)}delete input.draft;input.state=cmd.intent==='启用'?'已启用':'草稿';input.number=old?.number||`EX-${businessDay(at).replaceAll('-','')}-${String(s.experiences.length+1).padStart(3,'0')}`;input.version=(old?.version||0)+1;input.actor=actor;input.at=at;input.reason=cmd.reason;input.cancelled=false;if(old){delete old.draft;Object.assign(old,input)}else s.experiences.push(input);return {objectId:input.id,detail:cmd.intent==='启用'?'启用经验修订':'保存经验草稿'}
 }
 if(cmd.type==='p3-use-experience'){
  const e=s.experiences.find(e=>e.id===cmd.experienceId);if(!e||e.version!==cmd.expectedVersion||!experienceAvailable(s,e)||cmd.sourceStamp!==experienceStamp(s,e))throw new Error('经验已停用或来源有更新，暂不可新增引用');text(cmd.reason,'适用理由');const target=cmd.targetType==='商品对比'?s.comparisons.find(x=>x.id===cmd.targetId):s.issues?.find(x=>x.id===cmd.targetId);if(!target||'status'in target&&['已关闭','已作废','草稿'].includes(target.status))throw new Error('请选择可处理的正式问题或对比草稿');if('cancelled'in target&&target.cancelled)throw new Error('对比草稿已取消，请选择其他目标');if('state'in target&&target.state!=='草稿')throw new Error('已保存对比只读，请新建修订')
  if(!s.experienceUsages.some(u=>u.experienceId===e.id&&u.revision===e.revision&&u.targetId===cmd.targetId))s.experienceUsages.push({id:cmd.operationId,experienceId:e.id,revision:e.revision,targetType:cmd.targetType,targetId:cmd.targetId,reason:cmd.reason,actor,at,order:s.version+1})
  if(cmd.copyAction&&'status'in target&&!s.notes.some(n=>n.scope===`经验行动草稿:${target.id}:${e.id}:${e.revision}`)){s.notes.push({id:cmd.operationId+'-action-draft',order:s.version+1,scope:`经验行动草稿:${target.id}:${e.id}:${e.revision}`,commentIds:[],content:e.measures,actor,at})}if('experienceIds'in target&&!target.experienceIds.includes(e.id)){target.experienceIds.push(e.id);target.version++}
  return {objectId:cmd.targetId,detail:cmd.copyAction?'引用经验并保存行动文字草稿，未产生完成事实':'引用经验修订'}
 }
 if(cmd.type==='p3-comparison'){
  const input=structuredClone(cmd.comparison),old=s.comparisons.find(c=>c.id===input.id);if((old?.version||0)!==cmd.expectedVersion)throw new Error('对比记录已变化');if(cmd.cancel){if(!old||old.state!=='草稿'&&!old.draft)throw new Error('仅草稿可取消');if(old.draft)delete old.draft;else old.cancelled=true;old.version++;return {objectId:old.id,detail:'取消对比草稿'}}text(input.title,'对比标题');if(unique(input.styleIds).length!==input.styleIds.length||input.styleIds.length>4)throw new Error('请选择最多4个不同SPU');if(!cmd.draft&&input.styleIds.length<2)throw new Error('正式对比至少选择2个不同SPU');if(input.query.dateType!=='comment')throw new Error('商品对比使用可信平台评论时间');if(input.query.start&&input.query.end&&input.query.start>input.query.end)throw new Error('结束日期不能早于开始日期')
  if(cmd.draft&&old?.state==='已保存'){delete input.draft;old.draft=input;old.version++;return {objectId:old.id,detail:'保存对比修订草稿，原记录保持只读'}}
  const preview=comparisonPreview(s,input);if(!cmd.draft&&cmd.expectedToken!==preview.token)throw new Error('预览后样本或分类已变化，请更新预览，输入已保留');if(!cmd.draft){text(input.notes,'人工参考');text(input.limitations,'局限和待核实事项')}
  for(const id of input.experienceIds){const e=s.experiences.find(e=>e.id===id);if(!e||!experienceAvailable(s,e)||cmd.experienceStamps?.[id]!==experienceStamp(s,e))throw new Error('引用经验修订或来源已更新，请先核对')}
  if(old){input.history=[...old.history,{at,snapshot:JSON.stringify({...old,history:undefined})}];input.revision=old.revision+(old.state==='已保存'?1:0)}delete input.draft;input.state=cmd.draft?'草稿':'已保存';if(!cmd.draft)for(const id of input.experienceIds){const e=s.experiences.find(e=>e.id===id)!;if(!s.experienceUsages.some(u=>u.experienceId===e.id&&u.revision===e.revision&&u.targetType==='商品对比'&&u.targetId===input.id))s.experienceUsages.push({id:cmd.operationId+'-'+id,experienceId:id,revision:e.revision,targetType:'商品对比',targetId:input.id,reason:input.notes,actor,at,order:s.version+1})}input.experienceSnapshots=input.experienceIds.map(id=>{const e=s.experiences.find(e=>e.id===id)!;return {id,revision:e.revision,snapshot:JSON.stringify({...e,draft:undefined,history:undefined})}});input.metrics=preview.metrics;input.samples=preview.samples;input.token=preview.token;input.actor=actor;input.at=at;input.version=(old?.version||0)+1;input.cancelled=false;if(old){delete old.draft;Object.assign(old,input)}else s.comparisons.push(input);return {objectId:input.id,detail:cmd.draft?'保存对比草稿':'保存商品对比修订'}
 }
 throw new Error('未知三期业务动作')
}
