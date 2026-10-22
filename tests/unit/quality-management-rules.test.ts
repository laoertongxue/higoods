import assert from 'node:assert/strict'
import test from 'node:test'
import { buildInspectionSnapshotFromConfigurations, DEFAULT_GARMENT_INSPECTION_STANDARD, getDefaultQualityConfigurations, DEFAULT_FABRIC_SPU_WHITELIST } from '../../src/data/fcs/quality-management-records.ts'
import { calculateInspectionTarget, evaluateRoundAudit, inspectionScopesOverlap, resolveInspectionStandard, validateAuditUpgrade, validateInspectionConfiguration, validateInspectionIssues } from '../../src/data/fcs/quality-management-rules.ts'
import type { AdditionalInspectionStandard, InspectionRuleConfig, InspectionStandard } from '../../src/data/fcs/quality-management-types.ts'
const basic=()=>structuredClone(DEFAULT_GARMENT_INSPECTION_STANDARD)
const context={sourceKind:'PRODUCTION_RETURN' as const,styleId:'STYLE-1',styleCategory:'BASIC',attributes:{size:'M'}}
function extra(level: AdditionalInspectionStandard['level'],id:string):AdditionalInspectionStandard{return {...basic(),kind:'ADDITIONAL',id,familyId:id,name:id,level,applicability:{sourceKinds:['PRODUCTION_RETURN'],stages:['POST_FINISHING_QC'],...(level==='STYLE'?{styleIds:['STYLE-1']}:{styleCategories:['BASIC']})},items:[],overrides:[{targetItemId:'garment-size-chest',fields:['criterion'],values:{criterion:id},applicability:{attributes:[{key:'size',value:'M'}]}}]}}
test('基本、类别、指定款覆盖顺序；仅M码胸围改变，其他字段/项目保留',()=>{
 const category=extra('STYLE_CATEGORY','category'),specific=extra('STYLE','specific')
 const get=(size:string)=>resolveInspectionStandard({basicStandards:[basic()],additionalStandards:[specific,category],context:{...context,attributes:{size}}})
 assert.equal(get('M').items.find(row=>row.id==='garment-size-chest')!.criterion,'specific')
 assert.equal(get('M').items.find(row=>row.id==='garment-size-chest')!.overriddenBy.length,2)
 assert.equal(get('L').items.find(row=>row.id==='garment-size-chest')!.criterion,basic().items.find(row=>row.id==='garment-size-chest')!.criterion)
 assert.equal(get('M').items.find(row=>row.id==='garment-size-length')!.criterion,basic().items.find(row=>row.id==='garment-size-length')!.criterion)
 assert.equal(get('M').items.find(row=>row.id==='garment-size-chest')!.content,basic().items.find(row=>row.id==='garment-size-chest')!.content)
})
test('附加新项目独立追加、没有附加只使用基本标准，禁用及草稿不匹配',()=>{
 const added=extra('STYLE','new');added.overrides=[];added.items=[{id:'fastener-strength',name:'拉力检查',dimension:'辅料配件',content:'按正式要求检查',criterion:'工艺单',references:[]}]
 assert.equal(resolveInspectionStandard({basicStandards:[basic()],additionalStandards:[added],context}).items.length,basic().items.length+1)
 assert.equal(resolveInspectionStandard({basicStandards:[basic()],additionalStandards:[{...added,status:'DRAFT'}],context}).items.length,basic().items.length)
})
test('同层重叠即使内容相同也拒绝，不按时间、严格度或姓名择一',()=>{
 assert.throws(()=>resolveInspectionStandard({basicStandards:[basic()],additionalStandards:[extra('STYLE','a'),extra('STYLE','b')],context}),/同一层级/)
 const bad={...extra('STYLE','b'),status:'DRAFT' as const};assert.throws(()=>validateInspectionConfiguration(bad,[basic(),extra('STYLE','a')]),/重叠/)
 const other={...basic(),id:'other',familyId:'other'};assert.throws(()=>resolveInspectionStandard({basicStandards:[basic(),other],additionalStandards:[],context}),/多份/)
})
test('不同对象和工序可分开；同对象同环节共用；未知交集保守阻止生效',()=>{
 const fabric:InspectionStandard={...basic(),id:'fabric',familyId:'fabric',objectType:'FABRIC',applicability:{sourceKinds:['PRODUCTION_RETURN'],stages:['PRINT']}}
 assert.doesNotThrow(()=>validateInspectionConfiguration(fabric,[basic()]))
 assert.equal(inspectionScopesOverlap({styleIds:['one']},{styleIds:['two']}),false)
 assert.equal(inspectionScopesOverlap({styleCategories:['basic']},{styleIds:['some-style']}),true)
 assert.equal(inspectionScopesOverlap({attributes:[{key:'size',value:'M'}]},{attributes:[{key:'size',value:'L'}]}),false)
 for(const sourceKind of ['PRODUCTION_RETURN','WAREHOUSE_STOCK','PRE_PRODUCTION_SAMPLE'] as const)assert.ok(buildInspectionSnapshotFromConfigurations({sourceKind}).items.find(item=>item.id==='garment-size-chest'))
})
test('明确原项及覆盖字段，新项不得冒充重名覆盖，适用条件在开检匹配',()=>{
 const invalid=extra('STYLE','bad');invalid.overrides[0].targetItemId='missing';assert.throws(()=>validateInspectionConfiguration(invalid,[basic()]),/原检查项不存在/)
 const another=extra('STYLE','another');another.overrides[0].fields=[];assert.throws(()=>resolveInspectionStandard({basicStandards:[basic()],additionalStandards:[another],context}),/覆盖字段/)
 const conditional=basic();conditional.items[0].applicability={sourceKinds:['PRODUCTION_RETURN'],attributes:[{key:'size',value:'L'}]}
 assert.equal(resolveInspectionStandard({basicStandards:[conditional],additionalStandards:[],context}).items.some(row=>row.id===conditional.items[0].id),false)
})
test('无有效基本标准拒绝开检；有标准但参照资料缺失不会自动全检或阻断',()=>{
 assert.throws(()=>buildInspectionSnapshotFromConfigurations(context,getDefaultQualityConfigurations().filter(row=>row.kind!=='BASIC')),/没有适用/)
 const snapshot=buildInspectionSnapshotFromConfigurations({...context,references:[{id:'missing-size',name:'尺寸图',kind:'DOCUMENT',missing:true}]})
 assert.equal(snapshot.references[0].missing,true);assert.equal(snapshot.ruleSnapshot!.defaultPercent,30)
})
test('开检快照为隔离副本，标准及抽检参数修改不改变原快照',()=>{
 const all=getDefaultQualityConfigurations(),snapshot=buildInspectionSnapshotFromConfigurations(context,all)
 const rule=all.find(row=>row.kind==='RULE') as InspectionRuleConfig;rule.defaultPercent=50;rule.roundThresholds[0].unqualifiedQuantity=8
 ;(all[0] as InspectionStandard).items[0].criterion='已改'
 assert.equal(snapshot.ruleSnapshot!.defaultPercent,30);assert.equal(snapshot.ruleSnapshot!.roundThresholds[0].unqualifiedQuantity,2);assert.notEqual(snapshot.items[0].criterion,'已改')
 const sample=buildInspectionSnapshotFromConfigurations({sourceKind:'PRE_PRODUCTION_SAMPLE'});assert.equal(sample.ruleSnapshot,null)
})
test('数量按百分数计算、向上取整、最低量与上限；无SKU选样分配',()=>{
 for(const [quantity,percent,minQuantity,target] of [[100,30,0,30],[101,30,0,31],[12,30,0,4],[1,30,0,1],[100,30,40,40],[12,30,40,12],[0,30,0,0]])assert.equal(calculateInspectionTarget({quantity,percent,minQuantity}),target)
 for(const value of [-1,NaN,100.1])assert.throws(()=>calculateInspectionTarget({quantity:value,percent:30}))
 for(const value of [0,-1,101,NaN])assert.throws(()=>calculateInspectionTarget({quantity:100,percent:value}))
})
test('各轮仅本轮坏件触发，最低量或取整成全量时不稽查',()=>{
 const rule=getDefaultQualityConfigurations().find(row=>row.kind==='RULE') as InspectionRuleConfig
 const evaluate=(roundNumber:number,bad:number,quantity=100,percent=30,minQuantity=0)=>evaluateRoundAudit({roundNumber,roundDefectQty:bad,roundReturnedQty:0,quantity,percent,rule:{...rule,minQuantity}})
 assert.equal(evaluate(1,3).requiresAudit,true);assert.equal(evaluate(2,2,100,50).requiresAudit,true);assert.equal(evaluate(2,1,100,50).requiresAudit,false)
 assert.equal(evaluate(3,99,100,50).requiresAudit,false)
 assert.equal(evaluate(1,40,100,100).requiresAudit,false);assert.equal(evaluate(1,1,1,30).requiresAudit,false);assert.equal(evaluate(1,4,4,30,4).requiresAudit,false)
})
test('稽查只允许本次档位更高比例或100，不允许维持、错误回降或新临时档位',()=>{
 assert.doesNotThrow(()=>validateAuditUpgrade({currentPercent:30,nextPercent:50,percentSteps:[30,50,100]}))
 assert.doesNotThrow(()=>validateAuditUpgrade({currentPercent:50,nextPercent:100,percentSteps:[30,50,100]}))
 for(const nextPercent of [30,20,40])assert.throws(()=>validateAuditUpgrade({currentPercent:30,nextPercent,percentSteps:[30,50,100]}))
})
test('问题项目不等于坏衣件数；项目必须属于固定快照且不重复',()=>{
 const snapshot=buildInspectionSnapshotFromConfigurations(context)
 assert.doesNotThrow(()=>validateInspectionIssues(snapshot,[{itemId:snapshot.items[0].id},{itemId:snapshot.items[1].id}]))
 assert.throws(()=>validateInspectionIssues(snapshot,[{itemId:'foreign'}]),/不属于/)
 assert.throws(()=>validateInspectionIssues(snapshot,[{itemId:snapshot.items[0].id},{itemId:snapshot.items[0].id}]),/重复/)
})
test('默认白名单精确20项，默认第1/2轮各2，产前版不能配抽检规则',()=>{
 assert.equal(DEFAULT_FABRIC_SPU_WHITELIST.length,20);assert.equal(new Set(DEFAULT_FABRIC_SPU_WHITELIST).size,20)
 const rule=getDefaultQualityConfigurations().find(row=>row.kind==='RULE') as InspectionRuleConfig
 assert.deepEqual(rule.percentSteps,[30,50,100]);assert.deepEqual(rule.roundThresholds.map(row=>[row.roundNumber,row.unqualifiedQuantity]),[[1,2],[2,2]])
 assert.throws(()=>validateInspectionConfiguration({...rule,applicability:{sourceKinds:['PRE_PRODUCTION_SAMPLE'],stages:['PRE_PRODUCTION_SAMPLE_APPROVAL']}},[]),/产前版/)
 assert.throws(()=>validateInspectionConfiguration({...rule,applicability:{sourceKinds:['WAREHOUSE_STOCK'],stages:['WAREHOUSE_STOCK_QC']}},[]),/四条初始/)
})

test('STD031-037: 默认成衣六维内容与判定资料完整，已明确尺寸部位独立且不编公差',()=>{
 const base=getDefaultQualityConfigurations().find(row=>row.kind==='BASIC')!
 if(base.kind!=='BASIC')throw Error('missing basic')
 assert.deepEqual([...new Set(base.items.map(item=>item.dimension))],['尺寸规格','面料外观','缝制工艺','辅料配件','整烫外观','清洁度'])
 for(const [id,name] of [['neck','领围'],['shoulder','肩宽'],['chest','胸围'],['length','衣长'],['sleeve','袖长'],['hem','下摆']]){
  const item=base.items.find(row=>row.id==='garment-size-'+id)!;assert.equal(item.name,name);assert.deepEqual(item.references.map(row=>row.name),['封版样衣','尺寸公差表']);assert.match(item.criterion,/不另编公差/)
 }
 const required=[['garment-fabric',['缸差','边差','件差','破洞','瑕疵点','纬斜'],['色卡','标准光源箱']],['garment-sewing',['跳线','浮线','断线','针距','缝份','线迹歪斜'],['工艺单','工艺标准']],['garment-accessory',['扣子','拉链','唛头','洗标','吊牌'],['BOM清单']],['garment-ironing',['死褶','极光','烫黄','版型走样'],['封版样衣']],['garment-clean',['污渍','油渍','线头','毛屑'],['目视及手感']]] as const
 for(const [id,contents,references] of required){const item=base.items.find(row=>row.id===id)!;for(const text of contents)assert.ok(item.content.includes(text),id+' '+text);assert.deepEqual(item.references.map(row=>row.name),references)}
})

test('问题校验保留空/单项/多项、外来项、重复项及损坏标准拒绝，不缓存会变化的未固定项目',()=>{
 const snapshot={items:[{id:'ONE'},{id:'TWO'},{id:'THREE'}]} as any
 for(const issues of [[],[{itemId:'ONE'}],[{itemId:'ONE'},{itemId:'TWO'}],[{itemId:'ONE'},{itemId:'TWO'},{itemId:'THREE'}]])assert.doesNotThrow(()=>validateInspectionIssues(snapshot,issues))
 for(const issues of [[{itemId:'FOREIGN'}],[{itemId:'ONE'},{itemId:'FOREIGN'}],[{itemId:'ONE'},{itemId:'TWO'},{itemId:'FOREIGN'}]])assert.throws(()=>validateInspectionIssues(snapshot,issues),/不属于/)
 for(const issues of [[{itemId:'ONE'},{itemId:'ONE'}],[{itemId:'ONE'},{itemId:'TWO'},{itemId:'ONE'}]])assert.throws(()=>validateInspectionIssues(snapshot,issues),/重复/)
 snapshot.items[0].id='CHANGED';assert.throws(()=>validateInspectionIssues(snapshot,[{itemId:'ONE'}]),/不属于/)
 for(const items of [undefined,null,[null],[undefined]])assert.throws(()=>validateInspectionIssues({items} as any,[]))
})
