// @page-pattern: form
import type { ViewState } from './ui-state'
import { catalog, stages, tasks } from './fixtures'
import { e, fmt, dt, badge, button, card, renderDataTable, anchor } from './common'
import type { StandardListColumn } from '../../components/ui/list-table'
import { createConfiguration, dependencySpan, matchEventMapping, matchTimingRules, publicationImpact, validateConfiguration,
  type ConfigurationDraft, type ConfigIssue, type RuleSample, type TimingRule, type WorkDefinition, type MappingSample, type EventMapping, type ResponsibilityRule, type DependencyRule, type TaskWorkRuleMapping } from './config-model'
import { applyTaskRuleOverrides, previewTaskRuleRecalculation, saveTaskWorkRuleMapping, type PublishedTaskRuleOverride, type TaskRuleRecalculation } from './rule-recalculation'
import type { PFTask } from './model'

type ConfigTab = '阶段与工作'|'任务规则映射'|'单据与事件'|'时效要求'|'组上限与依赖'|'责任规则'|'风险与数据'|'版本与发布'
interface VersionRecord { version:string; at:string; by:string; scope:string; reason:string; affectedIds:string[]; rules:number; draft:ConfigurationDraft }
interface RecalculationRequest { id:string; at:string; by:string; reason:string; taskIds:string[]; status:'未执行'; draft:ConfigurationDraft }
const tabs:ConfigTab[]=['阶段与工作','任务规则映射','单据与事件','时效要求','组上限与依赖','责任规则','风险与数据','版本与发布']
const storageKey='dds-production-fulfillment-config-mock-v1'
let draft:ConfigurationDraft|null=null
let versions:VersionRecord[]=[]
let recalculationRequests:RecalculationRequest[]=[]
let publishedTaskOverrides:PublishedTaskRuleOverride[]=[]
let currentTaskSource:(()=>PFTask[])|null=null
let configTab:ConfigTab='阶段与工作'
let selectedStage='S03',selectedWork='ACT-S03-12',selectedRule='MOCK-SLA-CN-TRANSFER-01',selectedMapping='MAP-TRANSFER',selectedOwner='OWNER-TRANSFER',selectedDependency='DEP-DYE'
type DialogKind = ''|'preview'|'history'|'stage'|'work'|'mapping'|'mapping-test'|'task-mapping'|'rule'|'rule-test'|'group'|'dependency'|'owner'|'issues'|'pending'
let editable=false,dirty=false,savedAt='',currentUser='',dialog:DialogKind=''
let returnDialog:DialogKind=''
let issues:ConfigIssue[]|null=null
let matchResult:ReturnType<typeof matchTimingRules>|null=null
let mappingCase='完整实收事件',mappingResult:ReturnType<typeof matchEventMapping>|null=null
let historyDetail=''
let pendingRemoval=''
let publishReason='演示规则版本发布：保留原始基线和在途考核截止',publishScope='仅新任务',publishTaskIds=''
let sample:RuleSample={work:'ACT-S03-12',region:'CN',supplyMode:'现货采购',process:'无加工',route:'印尼仓→车缝厂',quantity:1000,unit:'PCS'}
let selectedMappingTask='',mappingTaskQuery='',taskMappingEdit:TaskWorkRuleMapping|null=null,taskMappingResult='',publishInitialBaseline=false

function initialDraft():ConfigurationDraft {
  const uniqueStages=[...new Map(stages.map(stage=>[stage.id,{id:stage.id,name:stage.name}])).values()]
  return createConfiguration(catalog.map(work=>({...work,reuse:'结果版本有效且符合本次需求时可引用；保留来源'})),uniqueStages)
}
function data():ConfigurationDraft {
  if(draft)return draft
  draft=initialDraft()
  if(typeof localStorage!=='undefined'){
    try {
      const saved=JSON.parse(localStorage.getItem(storageKey)||'null') as {draft?:ConfigurationDraft;versions?:VersionRecord[];recalculationRequests?:RecalculationRequest[];publishedTaskOverrides?:PublishedTaskRuleOverride[];savedAt?:string}|null
      if(saved?.draft?.works.length===catalog.length&&saved.draft.rules&&saved.draft.dependencies&&saved.draft.risk){draft=saved.draft;versions=saved.versions??[];recalculationRequests=saved.recalculationRequests??[];publishedTaskOverrides=saved.publishedTaskOverrides??[];savedAt=saved.savedAt??''}
    } catch { /* A corrupt local demonstration draft must not alter the base fixtures. */ }
  }
  return draft
}
function persist():void { if(typeof localStorage!=='undefined')localStorage.setItem(storageKey,JSON.stringify({draft:data(),versions,recalculationRequests,publishedTaskOverrides,savedAt})) }
export function setConfigurationTaskSource(source:()=>PFTask[]):void {currentTaskSource=source}
export function getPublishedInTransitOverrides():PublishedTaskRuleOverride[]{data();return structuredClone(publishedTaskOverrides)}
export function applyPublishedInTransitOverrides(input:PFTask[]):PFTask[]{data();return applyTaskRuleOverrides(input,publishedTaskOverrides)}
function currentTasks():PFTask[]{return currentTaskSource?currentTaskSource():applyPublishedInTransitOverrides(tasks)}
export function getPublishedConfiguration():{version:string;configuration:ConfigurationDraft} {
  data();const version=versions.at(-1)
  return {version:version?.version??'MOCK-RULE-V1',configuration:structuredClone(version?.draft??initialDraft())}
}
function label(workId:string):string{return data().works.find(work=>work.id===workId)?.name??workId}
function input(labelText:string,key:string,value:string|number|null,type='text',always=false):string {
  return `<label class="pf-field"><span>${e(labelText)}</span><input type="${e(type)}" value="${e(value??'')}" data-pf-field="config-${e(key)}" data-skip-page-rerender="true" ${type==='number'?'min="0" step="any"':''} ${!editable&&!always?'disabled':''}></label>`
}
function choice(labelText:string,key:string,value:string,options:(string|{value:string;label:string})[],always=false):string {
  return `<label class="pf-field"><span>${e(labelText)}</span><select data-pf-field="config-${e(key)}" data-skip-page-rerender="true" ${!editable&&!always?'disabled':''}>${options.map(item=>{const option=typeof item==='string'?{value:item,label:item}:item;return `<option value="${e(option.value)}" ${value===option.value?'selected':''}>${e(option.label)}</option>`}).join('')}</select></label>`
}
function note(text:string,tone='blue'):string{return `<div class="pf-config-note pf-config-${e(tone)}">${e(text)}</div>`}
function editButton(labelText:string,action:string,attrs=''):string{return button(labelText,`config-${action}`,`${attrs} ${editable?'':'disabled'}`)}
function grid(html:string):string{return `<div class="pf-config-grid">${html}</div>`}
function summary(text:string,actions=''):string {
  return `<div class="pf-config-summary"><span>${e(text)}</span><div class="pf-config-actions">${actions}</div></div>`
}
function sectionForm(title:string,fields:string):string {return `<section class="pf-config-form-section"><h3>${e(title)}</h3>${grid(fields)}</section>`}
function ensureStageWork():void {
  const config=data()
  if(!config.stages.some(stage=>stage.id===selectedStage))selectedStage=config.stages[0].id
  if(!config.works.some(work=>work.id===selectedWork&&work.stage===selectedStage))selectedWork=config.works.find(work=>work.stage===selectedStage)?.id??''
}
function renderDirectory(state:ViewState):string {
  if(dialog!=='work')ensureStageWork()
  const config=data(),stage=config.stages.find(item=>item.id===selectedStage)!
  const works=config.works.filter(item=>item.stage===stage.id)
  const columns:StandardListColumn<WorkDefinition>[]=[
    {key:'id',title:'动作编号',required:true,freezeable:true,width:145,render:row=>e(row.id),sortValue:row=>row.id},
    {key:'name',title:'工作定义',required:true,width:180,render:row=>`<strong>${e(row.name)}</strong>`,sortValue:row=>row.name},
    {key:'condition',title:'适用条件',width:240,render:row=>e(row.condition)},
    {key:'anchors',title:'起点 → 完成结果',width:250,render:row=>e(row.anchors)},
    {key:'team',title:'默认责任',width:145,render:row=>e(row.team)},
    {key:'rule',title:'规则来源 / 待确认',width:240,render:row=>e(row.rule)},
    {key:'actions',title:'操作',width:100,actionColumn:true,render:row=>button(editable?'查看 / 编辑':'查看','config-select-work',`data-config-id="${e(row.id)}"`)},
  ]
  const navigation=`<aside class="pf-config-stage-nav" aria-label="阶段目录"><header>阶段目录 <span>${config.stages.length}</span></header>${config.stages.slice().sort((a,b)=>a.order-b.order).map(item=>`<button type="button" class="pf-config-stage-item" data-pf-action="config-select-stage" data-config-id="${e(item.id)}" data-skip-page-rerender="true" aria-pressed="${stage.id===item.id}"><span class="pf-config-stage-code">${e(item.id)}</span><span>${e(item.name)}</span><small>${config.works.filter(work=>work.stage===item.id).length}</small></button>`).join('')}</aside>`
  return summary(`${config.stages.length} 类阶段 · ${config.works.length} 种候选动作；选择阶段查看工作，实际先后关系由依赖规则决定。`)
    +`<div class="pf-config-layout">${navigation}<div class="pf-config-main"><div class="pf-config-stage-heading"><div><h2>${e(stage.id)} ${e(stage.name)}</h2><p>${works.length} 种候选工作 · 阶段上限 ${stage.capDays===null?'待配置':`${fmt(stage.capDays)} 自然日`}</p></div>${button(editable?'阶段设置':'查看阶段','config-edit-stage')}</div>${renderDataTable('pf-config-catalog','候选工作目录',columns,works,state)}</div></div>`
}
function renderStageEditor():string {
  const stage=data().stages.find(item=>item.id===selectedStage)!
  return sectionForm('阶段信息',input('阶段名称','stage-name',stage.name)+input('浏览排序','stage-order',stage.order,'number')+input('阶段上限（自然日，可留空）','stage-capDays',stage.capDays,'number'))
    +sectionForm('计时边界',input('起点事件','stage-startEvent',stage.startEvent)+input('终点事件','stage-endEvent',stage.endEvent))
    +note('阶段上限用于检查组跨度，不在工作项预算外重复相加。准备 5 天仍为候选口径。','amber')
}
function renderWorkEditor():string {
  const config=data(),work=config.works.find(item=>item.id===selectedWork)!
  return sectionForm('工作定义',input('名称','work-name',work.name)+choice('归属阶段','work-stage',work.stage,config.stages.map(item=>({value:item.id,label:`${item.id} ${item.name}`})))+input('适用条件','work-condition',work.condition))
    +sectionForm('完成与责任',input('起点 → 终点','work-anchors',work.anchors)+input('默认责任团队','work-team',work.team)+input('标准来源 / 待确认','work-rule',work.rule)+input('结果复用条件','work-reuse',work.reuse))
}
function renderTaskMappings(state:ViewState):string {
  const source=currentTasks(),config=data()
  if(!source.some(task=>task.id===selectedMappingTask))selectedMappingTask=source[0]?.id??''
  const task=source.find(item=>item.id===selectedMappingTask)
  const columns:StandardListColumn<PFTask['nodes'][number]>[]=[
    {key:'work',title:'工作项 / 来源',required:true,width:270,render:node=>`<strong>${e(node.name)}</strong><small class="block">${e(node.id)} · ${e(node.sourceDocumentType)} ${e(node.sourceDocumentId||'待关联')}</small>`},
    {key:'quantity',title:'匹配数量范围',width:220,render:node=>`${node.requiredQuantityKnown===false?'待同步':`${fmt(node.requiredQty)} ${e(node.unit)}`}<small class="block">${e(node.quantityScope||'当前工作来源数量')}</small>`},
    {key:'mapping',title:'已保存映射',width:230,render:node=>{const mapping=config.taskWorkMappings?.find(item=>item.taskId===task?.id&&item.nodeId===node.id);return mapping?`${e(mapping.facts.work)} ${e(label(mapping.facts.work))}<small class="block">${e(mapping.startEvent)} → ${e(mapping.endEvent)}</small>`:'未配置，不按工作名称推断'}},
    {key:'budget',title:'当前单项标准',width:140,render:node=>node.durationDays===null?'待配置':`${fmt(node.durationDays)} 自然日`},
    {key:'actions',title:'操作',width:120,actionColumn:true,render:node=>button('设置明确映射','config-select-task-mapping',`data-config-id="${e(node.id)}"`)},
  ]
  return summary('先选择任务，再逐项确认动作和业务事实；仅保存映射不会改变标准或实际事实。')
    +card('选择当前生产任务',grid(choice('生产任务','mappingTask',mappingTaskQuery||selectedMappingTask,source.map(item=>({value:item.id,label:`${item.id} · 需求 ${item.demandNo}`})),true))+`<div class="pf-config-actions">${button('查看任务工作项','config-load-task-mappings')}${button('试算并查看发布影响','config-preview-mapping-task')}</div>`)
    +(task?renderDataTable('pf-config-task-mappings','当前任务工作项',columns,task.nodes.filter(node=>node.includedInProductionDuration!==false),state):note('当前没有可配置的来源任务。','amber'))
}
function renderTaskMappingEditor():string {
  const mapping=taskMappingEdit,task=currentTasks().find(item=>item.id===mapping?.taskId),node=task?.nodes.find(item=>item.id===mapping?.nodeId)
  if(!mapping||!task||!node)return note('工作项已不存在，请重新选择。','red')
  return note(`${task.id} / ${node.id} · ${node.sourceDocumentType} ${node.sourceDocumentId||'待关联'}；来源数量 ${node.requiredQuantityKnown===false?'待同步':`${fmt(node.requiredQty)} ${node.unit}`}。${node.quantityScope||''}`)
    +sectionForm('动作与计时边界',choice('候选动作定义','taskmap-work',mapping.facts.work,[{value:'',label:'请选择明确对应的动作'},...data().works.map(work=>({value:work.id,label:`${work.id} ${work.name}`}))])+input('起点业务事件','taskmap-startEvent',mapping.startEvent)+input('结束业务事件','taskmap-endEvent',mapping.endEvent)+choice('起点时间取值','taskmap-startAnchor',mapping.startAnchor,[{value:'',label:'请选择事件对应的来源时间'},{value:'actualStartAt',label:`工作实际开始：${dt(node.actualStartAt)}`},{value:'actualReadyAt',label:`输入就绪：${dt(node.actualReadyAt)}`},{value:'taskStartedAt',label:`需求下达：${dt(task.startedAt)}`}])+choice('结束时间取值','taskmap-endAnchor',mapping.endAnchor,[{value:'',label:'请选择来源结束字段'},{value:'actualEndAt',label:`工作实际结束：${dt(node.actualEndAt)}`}]))
    +sectionForm('明确匹配事实',choice('地区事实','taskmap-region',mapping.facts.region,['','CN','ID','不适用'])+choice('供给方式事实','taskmap-supplyMode',mapping.facts.supplyMode,['','现货采购','已有库存','本土制作','原料采购后加工','不适用'])+choice('工艺事实','taskmap-process',mapping.facts.process,['','无加工','梭织','毛织','染色','印花','不适用'])+input('运输 / 生产路线事实','taskmap-route',mapping.facts.route)+input('来源单位（不得自行换算）','taskmap-unit',mapping.facts.unit)+input('映射依据 / 本地确认说明','taskmap-source',mapping.source))
    +note('数量直接读取该工作来源，不代表本需求独占份额。未知事实不填“全部”；单项预算需另配，不默认填天数。本地配置不代表正式业务批准。','amber')
    +`<div class="pf-config-actions">${editButton('保存任务映射','save-task-mapping')}${editButton('按此映射新建时效规则','create-mapped-rule')}${button('试算当前任务','config-try-task-mapping')}</div>`
    +(taskMappingResult?`<div class="pf-config-result" role="status">${e(taskMappingResult)}</div>`:'')
}
function renderMappings(state:ViewState):string {
  const columns:StandardListColumn<EventMapping>[]=[
    {key:'id',title:'来源单据',required:true,freezeable:true,width:200,render:row=>`<strong>${e(row.document)}</strong><small class="block">${e(row.system)} · ${e(row.id)}</small>`},
    {key:'work',title:'对应工作',required:true,width:190,render:row=>e(label(row.work))},
    {key:'anchors',title:'起点 → 终点',width:240,render:row=>`${e(row.startEvent)} → ${e(row.endEvent)}`},
    {key:'keys',title:'关联粒度',width:270,render:row=>`${e(row.relationKey)}<small class="block">${e(row.granularity)}</small>`},
    {key:'quantity',title:'有效数量',width:180,render:row=>`${e(row.quantityField)} / ${e(row.unitField)}`},
    {key:'actions',title:'操作',width:100,actionColumn:true,render:row=>button(editable?'查看 / 编辑':'查看','config-select-mapping',`data-config-id="${e(row.id)}"`)},
  ]
  return summary('按明细、物流批次和实收事件关联；单据总状态不能代替完成事实。',button('事件匹配验证','config-open-mapping-test'))
    +renderDataTable('pf-config-mappings','单据与事件映射',columns,data().mappings,state)
}
function renderMappingEditor():string {
  const config=data(),mapping=config.mappings.find(item=>item.id===selectedMapping)??config.mappings[0]
  return sectionForm('来源与工作',input('来源系统','mapping-system',mapping.system)+input('单据类型','mapping-document',mapping.document)+choice('对应工作','mapping-work',mapping.work,config.works.map(work=>({value:work.id,label:`${work.id} ${work.name}`}))))
    +sectionForm('关联与计时',input('唯一关联键','mapping-relationKey',mapping.relationKey)+input('明细 / 批次粒度','mapping-granularity',mapping.granularity)+input('起点事件','mapping-startEvent',mapping.startEvent)+input('终点事件','mapping-endEvent',mapping.endEvent))
    +sectionForm('数量与事件处理',input('数量字段','mapping-quantityField',mapping.quantityField)+input('单位字段','mapping-unitField',mapping.unitField)+input('状态翻译','mapping-stateTranslation',mapping.stateTranslation)+input('事件去重键','mapping-dedupKey',mapping.dedupKey))
    +`<div class="pf-config-actions">${button('校验当前映射','config-validate-mapping')}${button('用此映射验证样例','config-open-mapping-test')}</div>`
}
function renderMappingTest():string {
  const mapping=data().mappings.find(item=>item.id===selectedMapping)??data().mappings[0]
  return summary(`当前映射：${mapping.document} · ${mapping.id}`)
    +grid(choice('事件样例','mappingCase',mappingCase,['完整实收事件','缺少物流批次关联','重复读取同一事件','只有采购入库事件'],true))
    +`<dl class="pf-config-facts"><div><dt>事件来源</dt><dd>FCS / 工厂接收单 / EVT-RECEIVE-001</dd></div><div><dt>明细与批次</dt><dd>调拨 TR-L01 → 物流 BAT-01 → 接收 REC-L01</dd></div><div><dt>合格实收</dt><dd>1,000 PCS</dd></div></dl>`
    +button('运行事件匹配','config-match-mapping')+(mappingResult?`<div class="pf-config-result" role="status">${badge(mappingResult.state)} ${e(mappingResult.message)}</div>`:'')
    +note('采购入库不等于目标工厂实收；重复事件不累计数量。','amber')
}
function renderRules(state:ViewState):string {
  const columns:StandardListColumn<TimingRule>[]=[
    {key:'id',title:'规则 / 状态',required:true,freezeable:true,width:260,render:row=>`<strong>${e(row.name)}</strong><small class="block">${e(row.id)}</small>${badge(row.state)}`},
    {key:'conditions',title:'匹配条件',width:260,render:row=>`${e(label(row.work))}<br>${e(row.region)} · ${e(row.supplyMode)} · ${e(row.process)}<br>${e(row.route)}`},
    {key:'range',title:'数量档 / 标准',width:150,render:row=>`${fmt(row.minQty)}–${row.maxQty===null?'不限':fmt(row.maxQty)} ${e(row.unit)}<br><strong>${row.days===null?'待配置':`${fmt(row.days)} 自然日`}</strong>`},
    {key:'anchors',title:'起止 / 来源',width:270,render:row=>`${e(row.startEvent)} → ${e(row.endEvent)}<small class="block">${e(row.source)}</small>`},
    {key:'actions',title:'操作',width:100,actionColumn:true,render:row=>button(editable?'查看 / 编辑':'查看','config-select-rule',`data-config-id="${e(row.id)}"`)},
  ]
  return summary('优先级：任务特批 → 完整条件特例 → 类型与路线 → 通用规则；同级多命中阻断。',button('匹配试算','config-open-rule-test'))
    +renderDataTable('pf-config-rules','单项时效规则',columns,data().rules,state)
}
function renderRuleEditor():string {
  const config=data(),rule=config.rules.find(item=>item.id===selectedRule)??config.rules[0]
  return sectionForm('规则信息',input('规则名称','rule-name',rule.name)+choice('工作类型','rule-work',rule.work,config.works.map(work=>({value:work.id,label:`${work.id} ${work.name}`})))+choice('匹配优先级','rule-priority',String(rule.priority),['1','2','3','4']))
    +sectionForm('匹配条件',choice('采购地区','rule-region',rule.region,['CN','ID','不适用','全部'])+choice('供给方式','rule-supplyMode',rule.supplyMode,['现货采购','已有库存','本土制作','原料采购后加工','不适用','全部'])+choice('工艺','rule-process',rule.process,['无加工','梭织','毛织','染色','印花','不适用','全部'])+input('运输 / 生产路线','rule-route',rule.route)+input('最小数量（含）','rule-minQty',rule.minQty,'number')+input('最大数量（含，空=不限）','rule-maxQty',rule.maxQty,'number')+input('单位','rule-unit',rule.unit))
    +sectionForm('时效要求与依据',input('要求自然日','rule-days',rule.days,'number')+input('起点事件','rule-startEvent',rule.startEvent)+input('终点事件','rule-endEvent',rule.endEvent)+input('规则来源 / 特批依据','rule-source',rule.source)+input('待确认字段','rule-pending',rule.pending))
    +`<div class="pf-config-actions">${editButton('复制为新 Mock 规则','duplicate-rule')}${editButton('移除本地复制规则','remove-rule',rule.id.includes('-COPY-')?'':'disabled')}${rule.state==='候选待确认'?'':editButton(rule.state==='停用'?'启用此规则（草稿）':'停用此规则（草稿）','toggle-rule')}${button('匹配试算','config-open-rule-test')}</div>`
    +(pendingRemoval?note(`确认移除复制草稿 ${pendingRemoval}？历史发布快照不会删除。`,'amber')+`<div class="pf-config-actions">${editButton('确认移除复制草稿','confirm-remove-rule')}${button('取消','config-cancel-remove-rule')}</div>`:'')
    +(rule.state==='候选待确认'?note(`候选不参与匹配：${rule.pending}`,'amber'):'')
}
function renderRuleTest():string {
  return grid(choice('工作','sample-work',sample.work,data().works.map(work=>({value:work.id,label:`${work.id} ${work.name}`})),true)+choice('采购地区','sample-region',sample.region,['CN','ID','不适用','待确定'],true)+choice('供给方式','sample-supplyMode',sample.supplyMode,['现货采购','已有库存','本土制作','原料采购后加工','不适用'],true)+choice('工艺','sample-process',sample.process,['无加工','梭织','毛织','染色','印花','不适用'],true)+input('路线','sample-route',sample.route,'text',true)+input('数量','sample-quantity',sample.quantity,'number',true)+input('单位','sample-unit',sample.unit,'text',true))
    +button('运行匹配试算','config-match')+(matchResult?`<div class="pf-config-result" role="status">${badge(matchResult.state)} ${e(matchResult.message)}${matchResult.matches.map(item=>`<div>${e(item.id)}：${e(item.startEvent)} → ${e(item.endEvent)}，${fmt(item.days)} 天</div>`).join('')}</div>`:'')
}
function renderDependencies(state:ViewState):string {
  const config=data(),span=dependencySpan(config.dependencies)
  const columns:StandardListColumn<DependencyRule>[]=[
    {key:'name',title:'工作',required:true,width:180,render:row=>`<strong>${e(row.name)}</strong><small class="block">${e(row.id)}</small>`},
    {key:'days',title:'预算',width:110,render:row=>`${fmt(row.days)} 自然日`},
    {key:'parents',title:'前置工作',width:180,render:row=>e(row.predecessors.map(id=>config.dependencies.find(item=>item.id===id)?.name??id).join('、')||'组起点')},
    {key:'sku',title:'投入 → 产出',width:220,render:row=>`${e(row.inputSku)} → ${e(row.outputSku)}`},
    {key:'release',title:'放行条件',width:200,render:row=>`${e(row.releaseMode)} · ${fmt(row.releaseQty)} ${e(row.unit)}<small class="block">${row.qualifiedOnly?'仅合格数量':'含不合格数量'}</small>`},
    {key:'actions',title:'操作',width:100,actionColumn:true,render:row=>button(editable?'查看 / 编辑':'查看','config-select-dependency',`data-config-id="${e(row.id)}"`)},
  ]
  return summary(`${config.group.name} · ${config.group.mode} · 网络跨度 ${span.days===null?'待判定':fmt(span.days)+' 天'} / 组上限 ${fmt(config.group.capDays)} 天`,button('组设置与公式','config-edit-group')+button('检查依赖与组上限','config-validate'))
    +renderDataTable('pf-config-dependencies','工作依赖与放行',columns,config.dependencies,state)
}
function renderGroupEditor():string {
  const config=data(),span=dependencySpan(config.dependencies)
  return grid(input('组名称','group-name',config.group.name)+input('组上限（自然日）','group-capDays',config.group.capDays,'number')+choice('参与汇总方式','group-mode',config.group.mode,['子项网络','组代理'])+input('组代理预算','group-proxyDays',config.group.proxyDays,'number'))
    +`<div class="pf-config-formula">${config.dependencies.map(node=>`EF(${e(node.name)}) = ${node.predecessors.length?`max(${node.predecessors.map(id=>`EF(${e(config.dependencies.find(item=>item.id===id)?.name??id)})`).join(', ')})`:'0'} + ${fmt(node.days)} = ${span.finishes[node.id]===undefined?'待判定':fmt(span.finishes[node.id])}`).join('<br>')}<br><strong>子项网络跨度 = ${span.days===null?'待判定':fmt(span.days)} 天；组上限 = ${fmt(config.group.capDays)} 天</strong></div>`
    +note('组代理与子项网络只选一种参与汇总。网络超出组上限时阻断发布，不截短预算。','amber')
}
function renderDependencyEditor():string {
  const config=data(),node=config.dependencies.find(item=>item.id===selectedDependency)??config.dependencies[0]
  return sectionForm('工作与依赖',input('工作名称','dependency-name',node.name)+input('预算自然日','dependency-days',node.days,'number')+input('前置工作 ID（逗号分隔）','dependency-predecessors',node.predecessors.join(',')))
    +sectionForm('投入与放行',input('投入 SKU','dependency-inputSku',node.inputSku)+input('产出 SKU','dependency-outputSku',node.outputSku)+input('数量单位','dependency-unit',node.unit)+choice('放行方式','dependency-releaseMode',node.releaseMode,['全量','按批次','数量阈值'])+input('合格数量门槛','dependency-releaseQty',node.releaseQty,'number')+choice('质量放行','dependency-qualifiedOnly',node.qualifiedOnly?'仅合格数量':'含不合格数量',['仅合格数量','含不合格数量']))
    +note(`可引用：${config.dependencies.map(item=>`${item.id}（${item.name}）`).join('、')}。空前置代表从组起点进入。`)
}
function renderResponsibilities(state:ViewState):string {
  const columns:StandardListColumn<ResponsibilityRule>[]=[
    {key:'work',title:'工作类型',required:true,width:190,render:row=>`<strong>${e(label(row.work))}</strong><small class="block">${e(row.id)}</small>`},
    {key:'owner',title:'主责任',width:190,render:row=>`${e(row.team)} / ${e(row.owner)}`},
    {key:'receiver',title:'接收确认方',width:180,render:row=>e(row.receiver)},
    {key:'coordinator',title:'协调跟单',width:160,render:row=>e(row.coordinator)},
    {key:'at',title:'责任生效时间',width:180,render:row=>dt(row.effectiveAt)},
    {key:'actions',title:'操作',width:100,actionColumn:true,render:row=>button(editable?'查看 / 编辑':'查看','config-select-owner',`data-config-id="${e(row.id)}"`)},
  ]
  return summary('主责任、接收确认与跟单协调分开配置；脚本或创建人不自动承担业务责任。')
    +renderDataTable('pf-config-owners','责任规则',columns,data().responsibilities,state)
}
function renderOwnerEditor():string {
  const config=data(),owner=config.responsibilities.find(item=>item.id===selectedOwner)??config.responsibilities[0]
  return grid(choice('工作类型','owner-work',owner.work,config.works.map(work=>({value:work.id,label:work.name})))+input('主责任团队','owner-team',owner.team)+input('主责任人','owner-owner',owner.owner)+input('接收确认方','owner-receiver',owner.receiver)+input('协调跟单','owner-coordinator',owner.coordinator)+input('责任生效时间','owner-effectiveAt',owner.effectiveAt,'datetime-local'))
    +note('任务保留责任历史；空责任进入待指派。上游延误与本环节新增延误分别归因。')
}
function renderRisk():string {
  const risk=data().risk
  return card('预警与数据有效性',sectionForm('预警阈值',input('临期阈值（自然日）','risk-nearDueDays',risk.nearDueDays,'number')+input('数据有效期（自然日）','risk-staleDays',risk.staleDays,'number')+input('延误升级阈值（自然日）','risk-escalationDays',risk.escalationDays,'number'))
    +sectionForm('计时与预测',input('预测依据','risk-predictionSource',risk.predictionSource))
    +`<p class="pf-config-help">1 自然日 = 连续 24 小时，截止相等算按期。缺规则或有效预测时为待判定。</p>`)
}
function renderVersions():string {
  const current=versions.at(-1)?.version??'MOCK-RULE-V1'
  return summary(`当前版本 ${current} · 仅保存于本浏览器的 Mock 配置`,button('版本历史','config-history')+button('待确认口径','config-open-pending'))
    +card('发布设置',grid(input('变更依据 / 原因','publish-reason',publishReason)+choice('生效范围','publish-scope',publishScope,['仅新任务','选定在途任务本地重算并发布'])+input('在途任务 ID（逗号分隔）','publish-taskIds',publishTaskIds)+choice('首次基线','publish-initialBaseline',publishInitialBaseline?'建立':'不建立',['不建立','建立']))
      +note('默认只发布单项预算。选择建立首次基线时，必须全部来源、适用范围、依赖、必要发货终点与预算已确认；已有截止不允许重建。','amber')
      +`<p class="pf-config-help">原始基线、考核截止及实际事实保留。仅明确映射的工作参与重算；未命中时阻断。</p><div class="pf-config-actions">${button('查看发布影响','config-preview')}</div>`)
}
function renderPending():string {
  const config=data()
  return `<ul class="pf-config-pending"><li>准备 5 天、印染 3 / 5 天、本土辅料 5 天的精确起止和包含环节。</li><li>首批 4 天的有效数量门槛与交出 / 实收终点。</li><li>实际发货事件与客户订单要求版本、生产来源批次的关联。</li><li>组内动作预算及责任、备货无订单时的承诺边界。</li></ul>`
    +note(`${config.rules.length} 条样例规则、${config.mappings.length} 组映射、${config.works.length} 种候选动作。未配置目录项不以样例值兜底。`,'amber')
}
function renderIssues():string {
  if(issues===null)return ''
  const blocks=issues.filter(issue=>issue.severity==='阻断')
  return card('当前草稿校验结果',note(blocks.length?`${blocks.length} 项阻断，禁止发布。`:'已检查配置样例，未发现阻断；结果仅代表本地演示配置。',blocks.length?'red':'blue')+issues.map(issue=>`<div class="pf-config-issue">${badge(issue.severity)} <strong>${e(issue.code)}</strong> ${e(issue.message)}</div>`).join(''))
}
function selectedTaskIds():string[]{return publishScope==='仅新任务'?[]:publishTaskIds.split(/[,，\s]+/).filter(Boolean)}
function recalculationPreviews():TaskRuleRecalculation[]{
  const source=currentTasks(),ids=new Set(selectedTaskIds())
  return source.filter(task=>ids.has(task.id)).map(task=>previewTaskRuleRecalculation(task,data().rules,nextVersion(),task.asOf,{mappings:data().taskWorkMappings,establishBaseline:publishInitialBaseline}))
}
function publicationErrors():string[] {
  const errors=validateConfiguration(data()).filter(issue=>issue.severity==='阻断').map(issue=>issue.message)
  if(!publishReason.trim())errors.push('必须填写变更依据或原因。')
  if(publishScope!=='仅新任务'){
    const ids=selectedTaskIds()
    if(!ids.length)errors.push('请选择要重算路线标准的在途任务 ID。')
    const eligible=currentTasks().filter(task=>!task.completedAt&&!task.terminatedAt&&(task.shipmentQuantityKnown===false||task.remainingQty>0)).map(task=>task.id)
    ids.filter(id=>!eligible.includes(id)).forEach(id=>errors.push(`${id} 不存在或不是可重算的在途任务。`))
    recalculationPreviews().filter(result=>result.state!=='可重算').forEach(result=>errors.push(`${result.taskId} ${result.state}：${result.message}`))
  }
  return errors
}
function nextVersion():string{return `MOCK-RULE-V${versions.length+2}`}
function renderRecalculationRows(results:TaskRuleRecalculation[]):string {
  return `<div class="overflow-auto"><table class="pf-config-impact"><thead><tr><th>选定任务 / 结果</th><th>明确匹配工作</th><th>当前路线标准</th><th>预计完成</th><th>保留项</th></tr></thead><tbody>${results.map(result=>`<tr><td>${e(result.taskId)}<br>${badge(result.state)}<br>${e(result.message)}</td><td>${result.changes.map(change=>`${e(change.nodeId)} → ${e(change.work)}<br>${e(change.ruleId)}<br>${fmt(change.previousDays)} → ${fmt(change.nextDays)} 自然日<br><small>${e(change.mappingSource)}</small>`).join('<hr>')||'未命中，不猜预算'}</td><td>${fmt(result.previousDays)} → ${result.nextDays===null?'整体待定':fmt(result.nextDays)} 天<br>${e(result.previousVersion)} → ${result.state==='可重算'?e(result.version):'不发布'}</td><td>${dt(result.previousForecastAt)}<br>→ ${dt(result.nextForecastAt)}</td><td>原始基线 ${dt(result.baselineDueAt)}<br>考核截止 ${dt(result.effectiveDueAt)}<br>实际开始/结束及数量均保留${result.initialBaseline?`<br><strong>首次建立：T0 + ${fmt(result.initialBaseline.days)} 天 = ${dt(result.initialBaseline.dueAt)}</strong>`:''}</td></tr>`).join('')}</tbody></table></div>`
}
function renderPublishedOverrides():string {
  return publishedTaskOverrides.slice().reverse().map(item=>`<div class="pf-config-history"><strong>${e(item.id)} · ${e(item.taskId)}</strong> ${badge('已本地重算并发布')}<p>${e(item.version)} · ${dt(item.publishedAt)} · ${e(item.by)} · ${e(item.reason)}</p><p>当前路线标准 ${fmt(item.previousDays)} → ${fmt(item.nextDays)} 天；预计完成 ${dt(item.previousForecastAt)} → ${dt(item.nextForecastAt)}</p><p>${item.changes.map(change=>`${e(change.nodeId)}：${fmt(change.previousDays)} → ${fmt(change.nextDays)} 天（${e(change.ruleId)}）`).join('；')}</p><p>原始基线 ${dt(item.baselineDueAt)}；考核截止 ${dt(item.effectiveDueAt)}；${item.initialBaseline?`首次建立基线 ${dt(item.initialBaseline.dueAt)}（T0 + ${fmt(item.initialBaseline.days)} 天），已有截止不覆盖。`:'两者及实际数量/时刻均未覆盖。'}</p></div>`).join('')
}
function renderDialog():string {
  if(!dialog)return ''
  let body=''
  if(dialog==='history'){
    const detail=versions.find(version=>version.version===historyDetail)
    body=note('版本快照保留本次规则、映射、依赖、责任及生效范围；草稿修改不会倒写历史。')+`<div class="pf-config-history"><h3>MOCK-RULE-V1 · 初始演示版本</h3><p>来源：产品设计 Mock；现有任务基线保持原样。</p></div>`+versions.slice().reverse().map(version=>`<div class="pf-config-history"><strong>${e(version.version)}</strong> · ${dt(version.at)} · ${e(version.by)}<p>${e(version.scope)} · ${version.rules} 条生效 Mock 规则</p><p>${e(version.reason)}</p><small>选定在途：${e(version.affectedIds.join('、')||'无')}；原始基线与考核截止保留。</small>${button('查看此版内容','config-load-history',`data-config-id="${e(version.version)}"`)}</div>`).join('')+renderPublishedOverrides()+recalculationRequests.slice().reverse().map(request=>`<div class="pf-config-history"><strong>${e(request.id)}</strong> ${badge('历史请求未执行')}<p>${dt(request.at)} · ${e(request.by)} · ${e(request.reason)}</p><p>旧请求范围：${e(request.taskIds.join('、'))}；仅保留历史，不自动升级为已重算。</p></div>`).join('')+(detail?`<div class="pf-config-history"><h3>${e(detail.version)} 保存的规则快照</h3>${detail.draft.rules.map(rule=>`<p>${e(rule.id)}：${fmt(rule.days)} 天 · ${e(rule.region)} / ${e(rule.supplyMode)} / ${e(rule.process)} · ${e(rule.state)}</p>`).join('')}<p>临期 ${fmt(detail.draft.risk.nearDueDays)} 天；数据有效期 ${fmt(detail.draft.risk.staleDays)} 天；${detail.draft.mappings.length} 个事件映射。只读查看，未覆盖当前草稿。</p></div>`:'')
  }else if(dialog==='preview'){
    const errors=publicationErrors(),impact=publicationImpact(currentTasks(),nextVersion(),selectedTaskIds())
    const requesting=publishScope!=='仅新任务'
    body=note(requesting?`拟发布 ${nextVersion()} 并本地重算选定任务的当前路线标准与预测。原始基线、考核截止、实际时刻及数量保持不变。`:`拟发布 ${nextVersion()}，仅新任务生效。候选规则排除，在途历史基线不变。`,'amber')+(errors.length?note(errors.join(' '),'red'):note(requesting?'校验通过，以下前后差异可确认发布。':'校验通过，可以确认发布本地 Mock 版本。'))+(requesting?renderRecalculationRows(recalculationPreviews()):'')+`<div class="overflow-auto"><table class="pf-config-impact"><thead><tr><th>任务</th><th>原版本</th><th>原始基线</th><th>考核截止</th><th>影响</th></tr></thead><tbody>${impact.map(item=>`<tr><td>${e(item.taskId)}</td><td>${e(item.previousVersion)}</td><td>${dt(item.baselineDueAt)}</td><td>${dt(item.effectiveDueAt)}</td><td>${e(item.action)}</td></tr>`).join('')}</tbody></table></div><div class="pf-config-actions">${editButton(requesting?'确认本地重算并发布':'确认发布本地 Mock 版本','publish',errors.length?'disabled':'')}${button('返回修改','config-close')}</div>`
  }
  else if(dialog==='stage')body=renderStageEditor()
  else if(dialog==='work')body=renderWorkEditor()
  else if(dialog==='mapping')body=renderMappingEditor()
  else if(dialog==='task-mapping')body=renderTaskMappingEditor()
  else if(dialog==='mapping-test')body=renderMappingTest()
  else if(dialog==='rule')body=renderRuleEditor()
  else if(dialog==='rule-test')body=renderRuleTest()
  else if(dialog==='group')body=renderGroupEditor()
  else if(dialog==='dependency')body=renderDependencyEditor()
  else if(dialog==='owner')body=renderOwnerEditor()
  else if(dialog==='issues')body=renderIssues()
  else if(dialog==='pending')body=renderPending()
  const titles:Record<Exclude<DialogKind,''>,string>={history:'规则版本历史',preview:'发布影响预览',stage:`阶段设置 · ${selectedStage}`,work:`工作定义 · ${selectedWork}`,mapping:`单据与事件 · ${selectedMapping}`,'mapping-test':'事件匹配验证','task-mapping':'任务工作项明确映射',rule:`时效规则 · ${selectedRule}`,'rule-test':'规则匹配试算',group:'组设置与计算公式',dependency:`依赖与放行 · ${selectedDependency}`,owner:`责任规则 · ${selectedOwner}`,issues:'草稿校验结果',pending:'待确认业务口径'}
  const editing=['stage','work','mapping','rule','group','dependency','owner'].includes(dialog)
  return `<div class="pf-config-overlay" data-pf-action="config-close" data-skip-page-rerender="true"><section class="pf-config-dialog" role="dialog" aria-modal="true" aria-label="${e(titles[dialog])}" data-pf-action="config-dialog" data-skip-page-rerender="true"><header><h2>${e(titles[dialog])}</h2>${button('关闭','config-close','aria-label="关闭配置弹窗"')}</header><div class="pf-config-dialog-body">${body}</div><footer><span>${editing&&editable?'修改计入当前草稿；保存本地草稿后保留。':''}</span><div>${returnDialog?button('返回上一层','config-return'):''}${editing?button(editable?'完成编辑':'完成查看','config-close'):''}</div></footer></section></div>`
}
export function renderConfiguration(state:ViewState):string {
  editable=state.role==='规则管理员'||state.role==='供应链管理';currentUser=state.user;data()
  const content=configTab==='阶段与工作'?renderDirectory(state):configTab==='任务规则映射'?renderTaskMappings(state):configTab==='单据与事件'?renderMappings(state):configTab==='时效要求'?renderRules(state):configTab==='组上限与依赖'?renderDependencies(state):configTab==='责任规则'?renderResponsibilities(state):configTab==='风险与数据'?renderRisk():renderVersions()
  return `<div class="pf-configuration"><style>
  .pf-config-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;min-height:36px;margin-bottom:8px}.pf-config-toolbar-status,.pf-config-toolbar-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.pf-config-toolbar-status{font-size:12px;color:#64748b}
  .pf-config-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 12px}.pf-config-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}.pf-config-tabs{display:flex;gap:0;border-bottom:1px solid #e2e8f0;overflow-x:auto;margin-bottom:8px}.pf-config-tabs button{border:0;border-bottom:2px solid transparent;border-radius:0;white-space:nowrap;background:transparent;height:36px;padding:0 14px}.pf-config-tabs button[aria-selected=true]{border-bottom-color:#2563eb;color:#1d4ed8;font-weight:600;background:#eff6ff}
  .pf-config-summary{min-height:36px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px;color:#64748b;margin-bottom:8px}.pf-config-summary>.pf-config-actions{flex-shrink:0;margin:0}.pf-config-layout{display:grid;grid-template-columns:190px minmax(0,1fr);gap:12px;align-items:start}.pf-config-stage-nav{border:1px solid #e2e8f0;border-radius:8px;background:#fff;overflow:hidden}.pf-config-stage-nav>header{font-size:13px;font-weight:600;padding:10px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between}.pf-config-stage-item{display:grid;grid-template-columns:26px minmax(0,1fr) 18px;width:100%;gap:6px;align-items:center;text-align:left;padding:10px 9px;border-bottom:1px solid #f1f5f9;font-size:12px;line-height:1.5;min-height:48px}.pf-config-stage-item:hover{background:#f8fafc}.pf-config-stage-item[aria-pressed=true]{color:#1d4ed8;background:#eff6ff;box-shadow:inset 3px 0 #2563eb;font-weight:600}.pf-config-stage-code,.pf-config-stage-item small{font-size:11px;color:#64748b}.pf-config-stage-item small{text-align:right}.pf-config-main{min-width:0}.pf-config-stage-heading{display:flex;justify-content:space-between;gap:12px;align-items:center;min-height:52px;margin-bottom:8px}.pf-config-stage-heading h2{font-size:14px;font-weight:600}.pf-config-stage-heading p{font-size:12px;color:#64748b;margin-top:3px}
  .pf-config-note{border:1px solid #bfdbfe;background:#eff6ff;color:#1e40af;border-radius:6px;padding:8px 10px;font-size:12px;line-height:1.6;margin:8px 0}.pf-config-amber{border-color:#fcd34d;background:#fffbeb;color:#92400e}.pf-config-red{border-color:#fca5a5;background:#fef2f2;color:#b91c1c}.pf-config-help{font-size:12px;line-height:1.6;color:#64748b;margin-top:10px}.pf-config-form-section+ .pf-config-form-section{border-top:1px solid #e2e8f0;margin-top:16px;padding-top:14px}.pf-config-form-section>h3{font-size:13px;font-weight:600;margin-bottom:10px}.pf-config-formula{padding:12px;background:#f8fafc;line-height:1.9;border-radius:6px;font-size:12px;font-family:monospace;margin-top:12px}.pf-config-result,.pf-config-issue,.pf-config-history{padding:10px;border-bottom:1px solid #e2e8f0;line-height:1.7;font-size:12px}.pf-config-facts{margin:12px 0;padding:10px;background:#f8fafc;border-radius:6px;font-size:12px}.pf-config-facts>div{display:grid;grid-template-columns:90px 1fr;gap:12px;margin:6px 0}.pf-config-facts dt{color:#64748b}.pf-config-pending{list-style:disc;padding-left:20px;font-size:13px;line-height:1.8}.pf-config-pending li+li{margin-top:10px}
  .pf-config-overlay{position:fixed;inset:0;z-index:90;background:#0f172a66;display:flex;align-items:center;justify-content:center;padding:20px}.pf-config-dialog{background:white;border-radius:10px;width:min(1000px,100%);max-height:calc(100vh - 40px);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px #0f172a33}.pf-config-dialog>header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #e2e8f0;flex-shrink:0;gap:12px}.pf-config-dialog h2{font-size:16px;font-weight:600;overflow-wrap:anywhere}.pf-config-dialog-body{padding:16px;overflow:auto;min-height:0}.pf-config-dialog>footer{display:flex;justify-content:space-between;align-items:center;gap:12px;border-top:1px solid #e2e8f0;padding:10px 16px;flex-shrink:0;font-size:12px;color:#64748b}.pf-config-dialog>footer>div{display:flex;gap:8px}.pf-config-dialog>footer:has(>span:empty)>div:empty{display:none}.pf-config-impact{width:100%;font-size:12px;text-align:left}.pf-config-impact td,.pf-config-impact th{padding:10px;border-bottom:1px solid #e2e8f0;vertical-align:top}.pf-configuration input:disabled,.pf-configuration select:disabled{background:#f1f5f9;color:#64748b}
  @media(max-width:1100px){.pf-config-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.pf-config-layout{grid-template-columns:170px minmax(0,1fr)}.pf-config-summary{align-items:flex-start}.pf-config-tabs button{padding:0 10px}.pf-config-toolbar-status span:last-child{display:none}}@media(max-width:700px){.pf-config-grid{grid-template-columns:minmax(0,1fr)}.pf-config-toolbar{align-items:flex-start}.pf-config-toolbar-actions{justify-content:flex-end}.pf-config-layout{grid-template-columns:150px minmax(0,1fr)}}
  </style>
    <div class="pf-config-toolbar"><div class="pf-config-toolbar-status">${badge(editable?'规则维护':'只读权限')}${badge(dirty?'草稿有未保存修改':'本地草稿')}${savedAt?`<span>上次保存 ${dt(savedAt)}</span>`:''}</div><div class="pf-config-toolbar-actions">${anchor('规则验证示例','/dds/supply-chain/production-fulfillment/examples')}${editButton('保存本地草稿','save')}${button('检查配置','config-validate')}${button('发布影响预览','config-preview')}</div></div>
    <nav class="pf-config-tabs" role="tablist" aria-label="规则配置分区">${tabs.map(tab=>button(tab,'config-tab',`data-config-tab="${e(tab)}" role="tab" aria-selected="${configTab===tab}"`)).join('')}</nav><section class="pf-config-panel" role="tabpanel" aria-label="${e(configTab)}">${content}</section>${renderDialog()}</div>`
}

export function handleConfigurationAction(action:string,target:HTMLElement,refresh:()=>void,notice:(message:string)=>void):boolean {
  if(!action.startsWith('config-'))return false
  const config=data(),id=target.dataset.configId??''
  if(action==='config-dialog')return true
  if(action==='config-tab'){const value=target.dataset.configTab as ConfigTab;if(tabs.includes(value))configTab=value;issues=null;dialog='';returnDialog='';pendingRemoval='';refresh();return true}
  if(action.startsWith('config-select-')){
    returnDialog=''
    if(action==='config-select-stage'&&config.stages.some(item=>item.id===id)){selectedStage=id;ensureStageWork();dialog=''}
    if(action==='config-select-work'&&config.works.some(item=>item.id===id)){selectedWork=id;selectedStage=config.works.find(item=>item.id===id)!.stage;dialog='work'}
    if(action==='config-select-rule'&&config.rules.some(item=>item.id===id)){selectedRule=id;dialog='rule'}
    if(action==='config-select-mapping'&&config.mappings.some(item=>item.id===id)){selectedMapping=id;mappingResult=null;dialog='mapping'}
    if(action==='config-select-owner'&&config.responsibilities.some(item=>item.id===id)){selectedOwner=id;dialog='owner'}
    if(action==='config-select-dependency'&&config.dependencies.some(item=>item.id===id)){selectedDependency=id;dialog='dependency'}
    if(action==='config-select-task-mapping'){
      const task=currentTasks().find(item=>item.id===selectedMappingTask),node=task?.nodes.find(item=>item.id===id)
      if(task&&node){taskMappingEdit=structuredClone(config.taskWorkMappings?.find(item=>item.taskId===task.id&&item.nodeId===node.id)??{id:`TASK-MAP:${task.id}:${node.id}`,taskId:task.id,nodeId:node.id,facts:{work:'',region:'',supplyMode:'',process:'',route:'',quantity:node.requiredQty,unit:node.unit},sourceDocumentType:node.sourceDocumentType,sourceDocumentId:node.sourceDocumentId,sourceEntryId:node.sourceEntryId,startEvent:'',endEvent:'',startAnchor:'' as TaskWorkRuleMapping['startAnchor'],endAnchor:'' as TaskWorkRuleMapping['endAnchor'],source:''});taskMappingResult='';dialog='task-mapping'}
    }
    refresh();return true
  }
  const openers:Record<string,DialogKind>={'config-edit-stage':'stage','config-edit-group':'group','config-open-mapping-test':'mapping-test','config-open-rule-test':'rule-test','config-open-pending':'pending'}
  if(openers[action]){returnDialog=dialog;dialog=openers[action];refresh();return true}
  if(action==='config-return'){dialog=returnDialog;returnDialog='';refresh();return true}
  if(action==='config-close'){dialog='';returnDialog='';pendingRemoval='';refresh();return true}
  if(action==='config-cancel-remove-rule'){pendingRemoval='';refresh();return true}
  if(action==='config-history'){returnDialog='';dialog='history';refresh();return true}
  if(action==='config-load-history'){
    const version=versions.find(item=>item.version===id)
    if(version){historyDetail=id;refresh()}
    return true
  }
  if(action==='config-match-mapping'){
    const mapping=config.mappings.find(item=>item.id===selectedMapping)??config.mappings[0]
    const event:MappingSample={system:'FCS',document:'工厂接收单',event:'工厂合格实收',eventId:'EVT-RECEIVE-001',attributes:{'调拨明细ID':'TR-L01','物流批次ID':'BAT-01','接收明细ID':'REC-L01','工厂实收合格数量':1000,'实收单位':'PCS'}}
    if(mappingCase==='缺少物流批次关联')delete event.attributes['物流批次ID']
    if(mappingCase==='只有采购入库事件')event.event='采购入库确认'
    mappingResult=matchEventMapping(mapping,event,mappingCase==='重复读取同一事件'?['EVT-RECEIVE-001']:[]);refresh();return true
  }
  if(action==='config-match'){matchResult=matchTimingRules(config.rules,sample);refresh();return true}
  if(action==='config-load-task-mappings'){selectedMappingTask=mappingTaskQuery||selectedMappingTask;refresh();return true}
  if(action==='config-preview-mapping-task'){publishScope='选定在途任务本地重算并发布';publishTaskIds=selectedMappingTask;publishInitialBaseline=false;dialog='preview';returnDialog='';refresh();return true}
  if(action==='config-try-task-mapping'){
    const task=currentTasks().find(item=>item.id===taskMappingEdit?.taskId)
    if(task&&taskMappingEdit){try{const mappings=saveTaskWorkRuleMapping(config.taskWorkMappings??[],taskMappingEdit,task),result=previewTaskRuleRecalculation(task,config.rules,nextVersion(),task.asOf,{mappings});taskMappingResult=`${result.state}：${result.message} ${result.changes.map(change=>`${change.nodeId}：${change.previousDays??'待配置'} → ${change.nextDays} 自然日`).join('；')}`}catch(error){taskMappingResult=error instanceof Error?error.message:String(error)}}
    refresh();return true
  }
  if(action==='config-validate'||action==='config-validate-mapping'){
    issues=validateConfiguration(config)
    if(action==='config-validate-mapping')issues=issues.filter(issue=>issue.code==='MAPPING_MISSING')
    returnDialog=dialog;dialog='issues';refresh();return true
  }
  if(action==='config-preview'){returnDialog='';dialog='preview';refresh();return true}
  if(!editable){notice('当前角色只读，规则管理员或供应链管理可维护配置。');return true}
  if(action==='config-save-task-mapping'||action==='config-create-mapped-rule'){
    const task=currentTasks().find(item=>item.id===taskMappingEdit?.taskId)
    if(!task||!taskMappingEdit){notice('请先选择任务工作项。');return true}
    try{
      if(!config.works.some(work=>work.id===taskMappingEdit!.facts.work))throw new Error('请选择现有候选动作定义。')
      config.taskWorkMappings=saveTaskWorkRuleMapping(config.taskWorkMappings??[],taskMappingEdit,task)
      savedAt=new Date().toISOString();dirty=false;persist();taskMappingResult='已保存本浏览器的明确映射；尚未改变任何预算、截止或实际事实。'
      if(action==='config-create-mapped-rule'){
        const mapping=taskMappingEdit,facts=mapping.facts,id=`LOCAL-SLA-COPY-${Date.now()}`
        config.rules.push({id,name:`${label(facts.work)}（本地原型）`,work:facts.work,region:facts.region,supplyMode:facts.supplyMode,process:facts.process,route:facts.route,minQty:0,maxQty:null,days:null,priority:2,state:'Mock 已发布',startEvent:mapping.startEvent,endEvent:mapping.endEvent,unit:facts.unit,source:mapping.source,pending:''})
        selectedRule=id;configTab='时效要求';dialog='rule';returnDialog='task-mapping';dirty=true
      }
      notice(taskMappingResult)
    }catch(error){taskMappingResult=error instanceof Error?error.message:String(error);notice(taskMappingResult)}
    refresh();return true
  }
  if(action==='config-save'){
    savedAt=new Date().toISOString();dirty=false;persist();notice('已保存本浏览器 Mock 草稿；未发布线上、未改变任务基线。');refresh();return true
  }
  if(action==='config-duplicate-rule'){
    const current=config.rules.find(rule=>rule.id===selectedRule)
    if(current){const copy=structuredClone(current);copy.id=`${current.id.split('-COPY-')[0]}-COPY-${Date.now()}`;copy.name+='（复制草稿）';config.rules.push(copy);selectedRule=copy.id;dirty=true;notice('已复制规则。条件未修改时会产生同层冲突，发布校验将阻断。')}
    refresh();return true
  }
  if(action==='config-remove-rule'){
    if(selectedRule.includes('-COPY-'))pendingRemoval=selectedRule
    refresh();return true
  }
  if(action==='config-confirm-remove-rule'){
    if(pendingRemoval.includes('-COPY-')){config.rules=config.rules.filter(rule=>rule.id!==pendingRemoval);selectedRule=config.rules[0].id;pendingRemoval='';dirty=true;notice('已移除本地复制规则草稿；已发布版本快照仍保留。')}
    refresh();return true
  }
  if(action==='config-toggle-rule'){
    const rule=config.rules.find(item=>item.id===selectedRule)
    if(rule&&rule.state!=='候选待确认'){rule.state=rule.state==='停用'?'Mock 已发布':'停用';dirty=true;matchResult=null;issues=null;notice('已更新草稿启用状态；保存或发布前不会改变历史版本。')}
    refresh();return true
  }
  if(action==='config-publish'){
    const errors=publicationErrors()
    if(errors.length){notice(`发布已阻断：${errors.join(' ')}`);refresh();return true}
    const requesting=publishScope!=='仅新任务',version=nextVersion(),publishedAt=new Date().toISOString()
    const previews=requesting?recalculationPreviews():[]
    for(const result of previews)publishedTaskOverrides.push({id:`RULE-APPLY-${publishedTaskOverrides.length+1}`,taskId:result.taskId,version,publishedAt,by:currentUser,reason:publishReason.trim(),changes:structuredClone(result.changes),previousDays:result.previousDays,nextDays:result.nextDays,previousForecastAt:result.previousForecastAt,nextForecastAt:result.nextForecastAt,baselineDueAt:result.baselineDueAt,effectiveDueAt:result.effectiveDueAt,initialBaseline:result.initialBaseline})
    versions.push({version,at:publishedAt,by:currentUser,scope:publishScope,reason:publishReason.trim(),affectedIds:requesting?selectedTaskIds():[],rules:config.rules.filter(rule=>rule.state==='Mock 已发布').length,draft:structuredClone(config)})
    savedAt=publishedAt;dirty=false;dialog='history';returnDialog='';persist();notice(requesting?'已发布本地 Mock 版本并重算选定任务当前路线标准与预测。原始基线、生效截止和实际事实均保留。':'本地 Mock 版本已发布，仅新任务生效；保留在途原始基线、生效截止和历史逾期。');refresh();return true
  }
  return true
}
export function handleConfigurationField(field:string,target:HTMLInputElement|HTMLSelectElement):boolean {
  if(!field.startsWith('config-'))return false
  const key=field.slice(7),value=target.value,config=data()
  if(key==='mappingCase'){mappingCase=value;mappingResult=null;return true}
  if(key==='mappingTask'){mappingTaskQuery=value;return true}
  if(key.startsWith('sample-')){const property=key.slice(7) as keyof RuleSample;(sample as unknown as Record<string,unknown>)[property]=property==='quantity'?Number(value):value;matchResult=null;return true}
  if(!editable)return true
  if(key==='publish-reason'){publishReason=value;return true}
  if(key==='publish-scope'){publishScope=value;return true}
  if(key==='publish-taskIds'){publishTaskIds=value;return true}
  if(key==='publish-initialBaseline'){publishInitialBaseline=value==='建立';return true}
  if(key.startsWith('taskmap-')&&taskMappingEdit){
    const property=key.slice(8)
    if(['work','region','supplyMode','process','route','unit'].includes(property))(taskMappingEdit.facts as unknown as Record<string,unknown>)[property]=value
    else if(['startEvent','endEvent','startAnchor','endAnchor','source'].includes(property))(taskMappingEdit as unknown as Record<string,unknown>)[property]=value
    taskMappingResult='';return true
  }
  const split=key.indexOf('-'),section=key.slice(0,split),property=key.slice(split+1)
  const object=section==='stage'?config.stages.find(item=>item.id===selectedStage):section==='work'?config.works.find(item=>item.id===selectedWork):section==='rule'?config.rules.find(item=>item.id===selectedRule):section==='mapping'?config.mappings.find(item=>item.id===selectedMapping):section==='owner'?config.responsibilities.find(item=>item.id===selectedOwner):section==='dependency'?config.dependencies.find(item=>item.id===selectedDependency):section==='group'?config.group:section==='risk'?config.risk:null
  if(!object||!(property in object))return true
  let next:unknown=value
  if(['capDays','maxQty','days'].includes(property))next=value===''?null:Number(value)
  else if(['order','minQty','priority','releaseQty','proxyDays','nearDueDays','staleDays','escalationDays'].includes(property))next=Number(value)
  else if(property==='predecessors')next=value.split(/[,，\s]+/).filter(Boolean)
  else if(property==='qualifiedOnly')next=value==='仅合格数量'
  ;(object as unknown as Record<string,unknown>)[property]=next
  dirty=true;issues=null;matchResult=null
  return true
}
