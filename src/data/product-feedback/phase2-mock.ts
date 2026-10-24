import { applyFeedbackCommand, batchCounts, currentClassification, jakartaInstant, reviewIdentity } from './model.ts'
import { phase2, scopeForComments, fixedAssistance, issueBasis, reviewPreview, commentStamp, planWindows, planComments } from './phase2-model.ts'
import { FEEDBACK_OWNER, type FeedbackSnapshot, type FeedbackCommand } from './types.ts'
import type { FeedbackIssue, FeedbackIssueAction, FeedbackIssuePlan } from './phase2-types.ts'

/** Fixed, directly usable cases. Every finished state is produced by the same business commands as the UI. */
export function addPhase2Seed(snapshot: FeedbackSnapshot): void {
  const s=phase2(snapshot)
  const changes:Record<number,string>={1:'Cantik sekali, tapi menyusut setelah dicuci.',3:'Resleting macet dan jahitan lepas.',4:'Pinggang terlalu kecil.',5:'Bahannya terlalu tipis dan agak transparan, tidak seperti foto.',9:'Kainnya tipis dan transparan.',13:'Bahan tipis, kurang cocok untuk saya.',17:'Kain lembut dan nyaman dipakai.',21:'Bahannya terlalu tebal dan panas.',22:'Kain terlalu tipis untuk saya.'}
  for(const [key,content] of Object.entries(changes)) {const c=s.comments.find(c=>c.id===`feedback-comment-mock-${key}`);if(!c)continue;c.raw.content=content;c.raw.language='id';c.raw.images=[];c.identityKey=reviewIdentity(c.raw);const assistance=fixedAssistance(c);if(assistance&&[1,3,4,5,9,13].includes(Number(key))) c.classifications=[{id:`p2-fixed-class-${key}`,contentVersion:c.contentVersion,value:assistance.value,tags:assistance.tags,state:'已确认',note:'固定样例人工核对',actor:FEEDBACK_OWNER,at:c.firstStoredAt,reviewer:FEEDBACK_OWNER,reviewedAt:c.firstStoredAt,ruleVersion:'V1.3',version:1,bulk:false}]
    if(Number(key)===1) c.raw.rating=5
    for(const b of s.batches)for(const row of b.rows)if(row.commentId===c.id&&row.raw){row.raw=structuredClone(c.raw)}
  }
  // Preserve source receipts, identity and current raw facts in the rebuilt static data.
  for(const b of s.batches) for(const receipt of b.receipts){receipt.rows=structuredClone(b.rows);receipt.counts=batchCounts(b)}
  const run=(payload:Record<string,unknown>,id:string,at='2026-10-23T08:10:00.000Z')=>Object.assign(s,applyFeedbackCommand(s,{...payload,...(payload.type==='p2-save-issue'?{expectedCommentStamps:Object.fromEntries((payload.issue as FeedbackIssue).evidence.map(e=>{const c=s.comments.find(c=>c.id===e.commentId)!;return [e.commentId,commentStamp(c,currentClassification(c)?.id||'','')]}))}:{}),operationId:id,actor:FEEDBACK_OWNER,at} as FeedbackCommand))
  const c1=s.comments.find(c=>c.id==='feedback-comment-mock-1')!,thin=s.comments.find(c=>c.id==='feedback-comment-mock-5')!,zip=s.comments.find(c=>c.id==='feedback-comment-mock-3')!,waist=s.comments.find(c=>c.id==='feedback-comment-mock-4')!
  for(const c of [c1,thin,zip]){const a=fixedAssistance(c)!;run({type:'p2-translation',commentId:c.id,expectedVersion:c.version,text:a.text,source:'固定对应译文',reason:'',checked:c.id!==thin.id},`p2-translation-${c.id}`)}
  run({type:'p2-suggest',commentIds:[c1.id,thin.id],expectedVersions:{[c1.id]:s.comments.find(c=>c.id===c1.id)!.version,[thin.id]:s.comments.find(c=>c.id===thin.id)!.version}},'p2-suggestion-seed')
  const changed=s.comments.find(c=>c.contentVersion>1&&c.history.length)!;if(changed)s.translations.push({id:'p2-old-translation',commentId:changed.id,contentVersion:1,text:'收到后觉得很好。',source:'人工录入',language:'zh',checked:true,actor:FEEDBACK_OWNER,at:changed.firstStoredAt,reason:'旧原文译文',revision:1})
  const names=['待核对：低星评论原因','核对面料偏薄反馈','核对拉链卡顿','规格描述核查','图片调整生效待确认','面料反馈观察','核查记录已完成','原始主题建错','关闭后重新跟进','长期观察计划','需重新核对的评论证据','核查中行动逾期']
  for(let i=0;i<12;i++) {
    const c=[thin,thin,zip,waist,thin,thin,waist,waist,thin,thin,zip,waist][i],cls=currentClassification(c)!,theme=cls.tags.find(t=>t.sentiment==='问题')!.theme,scope=scopeForComments(s.comments,c.association.styleId), id=`feedback-issue-${i+1}`
    const issue:FeedbackIssue={id,number:'',title:names[i],description:`核对买家反馈：${c.raw.content}`,definition:c.id===zip.id?'买家明确提及拉链卡顿或缝线脱开':c.id===waist.id?'买家明确提及腰围偏小':'买家明确提及面料偏薄或透',theme,scope,discovery:{start:'2026-10-01',end:'2026-10-22'},owner:FEEDBACK_OWNER,priority:i===11?'优先':'普通',targetDate:i===11?'2026-10-22':'2026-10-24',status:'草稿',round:1,version:0,definitionVersion:1,evidence:i===0?[]:[{commentId:c.id,reason:'核对具体问题反馈'} as any],createdAt:'',updatedAt:'',actor:FEEDBACK_OWNER,closedAt:'',closeReason:'',relatedIssueId:''}
    run({type:'p2-save-issue',issue,expectedVersion:0,draft:i===0,reason:'',distinction:`独立核查目标：${names[i]}`},`${id}-create`)
    if(i<=1)continue
    const current=()=>s.issues.find(x=>x.id===id)!
    run({type:'p2-issue-state',issueId:id,expectedVersion:current().version,action:'开始处理',reason:'开展本轮核查'},`${id}-start`)
    const action:FeedbackIssueAction={id:`${id}-action`,issueId:id,round:1,version:0,type:i===2?'商品核查':'图片/描述调整',content:`${names[i]}：核对购买规格、原文和商品描述`,owner:FEEDBACK_OWNER,dueDate:i===11?'2026-10-22':'2026-10-24',status:'未开始',startedAt:'',completedAt:'',result:'',effect:'',effectiveAt:'',effectEvidence:'',progress:[],attachmentIds:[]}
    run({type:'p2-action',issueId:id,expectedVersion:current().version,action,intent:'保存',reason:'',targetDate:current().targetDate},`${id}-action-create`)
    if(i===2){const extra={...action,id:action.id+'-cancelled',content:'备用核查：已由本轮主要行动承接'};run({type:'p2-action',issueId:id,expectedVersion:current().version,action:extra,intent:'保存',reason:'',targetDate:current().targetDate},id+'-extra-create');const saved=s.issueActions.find(a=>a.id===extra.id)!;run({type:'p2-action',issueId:id,expectedVersion:current().version,action:saved,intent:'取消',reason:'由主要核查行动承接，取消重复安排',targetDate:current().targetDate},id+'-extra-cancel')}
    if(i===2||i===11)continue
    const a=()=>s.issueActions.find(x=>x.id===action.id)!
    const check=[3,6,7,8,10].includes(i)
    run({type:'p2-action',issueId:id,expectedVersion:current().version,action:{...a(),completedAt:'2026-10-23T08:20:00.000Z',result:check?'已核对描述和规格，记录本次发现':'已核对图片调整结果',effect:check?'无需观察':i===4?'生效时间未确认':'已生效',effectiveAt:check?'':jakartaInstant(i===5?'2026-10-19':'2026-10-15','14:00'),effectEvidence:check?'原文与购买规格核对记录，暂无需新增调整':`已核对现有上架记录，${i===5?'10月19':'10月15'}日14:00开始展示`},intent:'完成',reason:'',targetDate:current().targetDate},`${id}-action-complete`,'2026-10-23T08:25:00.000Z')
    if(i===4)continue
    const plan:FeedbackIssuePlan={id:`${id}-plan`,issueId:id,round:1,version:0,kind:check?'核查结论':'反馈变化',actionIds:[action.id],anchorActionId:check?'':action.id,days:i===9?14:i===5?2:7,lag:0,before:{start:'',end:''},after:{start:'',end:''},scope:structuredClone(current().scope),definition:current().definition,dueDate:i===9?'2026-10-30':'2026-10-23',state:'草稿',reason:'',target:check?'核对本次实际处理结论':'观察买家对本次问题的后续反馈',basis:'',at:''}
    if(i===5){plan.scope.storeIds=[c.raw.storeId];plan.scope.listingIds=[c.association.listingId];plan.target='按同范围两日前后窗核对买家具体反馈'}
    run({type:'p2-plan',issueId:id,expectedVersion:current().version,plan,draft:false,reason:''},`${id}-plan-save`,'2026-10-23T08:30:00.000Z')
    run({type:'p2-issue-state',issueId:id,expectedVersion:current().version,action:'进入复盘',reason:'本轮有效行动全部完成，已保存计划'},`${id}-review-enter`,'2026-10-23T08:35:00.000Z')
    if(i===5){const p=s.issuePlans.find(p=>p.id===plan.id)!;for(const comment of [...planComments(s,p,p.before),...planComments(s,p,p.after)]){const cls=currentClassification(comment),result=/tipis|偏薄|transparan/.test(comment.raw.content)?'Y':comment.raw.content.trim()?'N':'U';run({type:'p2-judge',issueId:id,expectedVersion:current().version,planId:p.id,commentId:comment.id,expectedStamp:commentStamp(comment,cls?.id||'',''),result,basis:'原文',translationId:'',classificationId:cls?.id||'',evidence:comment.raw.content||'仅评分，无法判断具体原因'},`${id}-judge-${comment.id}`,'2026-10-23T08:38:00.000Z')}}
    if([6,8].includes(i)) {
      const p=s.issuePlans.find(x=>x.id===plan.id)!,preview=reviewPreview(s,current(),p)
      run({type:'p2-review',issueId:id,expectedVersion:current().version,planId:p.id,previewToken:preview.token,draft:false,observation:'已完成人工原文和商品描述核查，结束本轮核查',factors:'仅核查结论，未判断商品已改善',decision:'结束本次跟进',endingReason:'本次核查已完成',nextStep:'后续如有具体新证据再跟进',nextDueDate:'',targetDate:'',supersedes:''},`${id}-review-save`,'2026-10-23T08:40:00.000Z')
      run({type:'p2-issue-state',issueId:id,expectedVersion:current().version,action:'关闭',reason:'核查完成，结束本次跟进'},`${id}-close`,'2026-10-23T08:45:00.000Z')
      if(i===8)run({type:'p2-issue-state',issueId:id,expectedVersion:current().version,action:'重开',reason:'需追加核查具体规格',goal:'核查新范围内的持续反馈',owner:FEEDBACK_OWNER,targetDate:'2026-10-26'},`${id}-reopen`,'2026-10-23T09:00:00.000Z')
    }
    if(i===7)run({type:'p2-issue-state',issueId:id,expectedVersion:current().version,action:'作废',reason:'与原核查目标重复，保留已发生记录'},`${id}-void`,'2026-10-23T08:50:00.000Z')
    if(i===10) { const updated=s.comments.find(x=>x.id===c.id)!;const cls=currentClassification(updated)!;run({type:'save-classification',commentId:c.id,expectedVersion:updated.version,expectedContentVersion:updated.contentVersion,value:cls.value,tags:cls.tags,note:'补充人工核对说明，已有引用须重新核对',state:'已确认'},'p2-seed-source-reconfirmed','2026-10-23T09:10:00.000Z') }
  }
}
