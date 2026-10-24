import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateInitialFullInspection, resolveProductionInspectionSource, type ProductionInspectionSource } from '../../src/data/fcs/quality-management-source.ts'
import { getDefaultQualityConfigurations } from '../../src/data/fcs/quality-management-records.ts'
import { productionOrders } from '../../src/data/fcs/production-orders.ts'
import type { InspectionRuleConfig } from '../../src/data/fcs/quality-management-types.ts'
const conditions=(getDefaultQualityConfigurations().find(row=>row.kind==='RULE') as InspectionRuleConfig).initialFullInspection!
function source():ProductionInspectionSource{return {productionOrderId:'P1',productionOrderNo:'PO1',taskId:'T1',factoryId:'F1',styleId:'S1',styleCode:'ST1',productPosition:'普通款',productPositionIds:['ordinary'],difficulty:'B',difficultyPresent:true,fabrics:[{bomItemId:'fabric-1',spu:'CNIDML002',status:'RESOLVED'}],executionOrdinal:4,executionStatus:'RECORDED',unresolved:[]}}
test('四条件独立任一命中，前三类全单范围、真实前三任务本厂全单范围',()=>{
 const ordinary=source();assert.equal(evaluateInitialFullInspection(ordinary,conditions).fullInspection,false)
 for(const productPosition of ['基础款','冷启动基础款']){const result=evaluateInitialFullInspection({...ordinary,productPosition},conditions);assert.equal(result.reasons[0].scope,'PRODUCTION_ORDER');assert.equal(result.reasons[0].code,'BASIC_STYLE')}
 for(const difficulty of ['A','A+','A++'])assert.equal(evaluateInitialFullInspection({...ordinary,difficulty},conditions).reasons[0].code,'HIGH_DIFFICULTY')
 for(const difficulty of ['B','C','D','A+++','S'])assert.equal(evaluateInitialFullInspection({...ordinary,difficulty},conditions).fullInspection,false)
 for(const ordinal of [1,2,3]){const result=evaluateInitialFullInspection({...ordinary,executionOrdinal:ordinal},conditions);assert.equal(result.reasons[0].scope,'FACTORY_PRODUCTION_ORDER');assert.equal(result.reasons[0].factoryId,'F1')}
})
test('初始覆盖原因固定本次生产单正式技术包来源版本，不受后续来源对象修改影响',()=>{
 const actual={...source(),techPackVersionId:'formal-bound-v7',productPosition:'基础款',difficulty:'A++',executionOrdinal:2,
  fabrics:[{bomItemId:'formal-fabric',spu:'CNIDML999',status:'RESOLVED' as const}]}
 const result=evaluateInitialFullInspection(actual,conditions)
 assert.equal(result.reasons.length,4)
 assert.ok(result.reasons.every(reason=>reason.techPackVersionId==='formal-bound-v7'))
 actual.techPackVersionId='later-bound-v8'
 assert.equal(result.source.techPackVersionId,'formal-bound-v7')
 assert.ok(result.reasons.every(reason=>reason.techPackVersionId==='formal-bound-v7'))
})
test('正式定位多选显示名不是单一类别；基础款与冷启动基础款按正式定位别名分别命中',()=>{
 for(const position of ['基础款','冷启动基础款']){
  const result=evaluateInitialFullInspection({...source(),productPosition:`普通款、${position}`,styleCategoryAliases:['formal-ordinary','普通款','formal-basic',position]},conditions)
  assert.equal(result.fullInspection,true);assert.equal(result.reasons[0].code,'BASIC_STYLE');assert.equal(result.reasons[0].label,`正式定位：${position}`)
 }
 assert.equal(evaluateInitialFullInspection({...source(),productPosition:'普通款、主推款',styleCategoryAliases:['formal-ordinary','普通款','formal-focus','主推款']},conditions).fullInspection,false)
})
test('多面料任一名单外命中，不被名单内抵消；未知不假定在内或在外',()=>{
 const ordinary=source(),unknown={bomItemId:'unresolved',originalCode:'SOME-FABRIC-WITH-DASH',status:'UNRESOLVED' as const}
 assert.equal(evaluateInitialFullInspection({...ordinary,fabrics:[...ordinary.fabrics,unknown],unresolved:['未映射']},conditions).fullInspection,false)
 const result=evaluateInitialFullInspection({...ordinary,fabrics:[...ordinary.fabrics,{bomItemId:'out',spu:'CNIDML999',status:'RESOLVED'},unknown]},conditions)
 assert.equal(result.reasons[0].code,'OUTSIDE_FABRIC_WHITELIST');assert.deepEqual(result.reasons[0].fabricSpus,['CNIDML999'])
 const other=evaluateInitialFullInspection({...ordinary,productPosition:'基础款',fabrics:[unknown],unresolved:['未映射']},conditions);assert.equal(other.fullInspection,true);assert.deepEqual(other.unresolved,['未映射'])
})
test('缺失难度不按兼容B或未确认新等级判断；无真实历史按第一次且保留原因',()=>{
 assert.equal(evaluateInitialFullInspection({...source(),difficultyPresent:false,difficulty:'A'},conditions).fullInspection,false)
 const result=evaluateInitialFullInspection({...source(),executionStatus:'NO_HISTORY',executionOrdinal:1},conditions)
 assert.match(result.reasons[0].label,/没有真实历史/)
 assert.equal(evaluateInitialFullInspection({...source(),productPosition:'基础款'},null).fullInspection,false)
})
test('适配读生产单绑定原难度presence；不调用会默认B的快照克隆作登记依据',()=>{
 const order=productionOrders.find(row=>row.techPackSnapshot)!, original=structuredClone(order.techPackSnapshot)
 try{
  order.techPackSnapshot!.garmentDifficultyGrade='B';order.techPackSnapshot!.garmentDifficultyGradeSourcePresent=false
  order.techPackSnapshot!.bomItems=[]
  const result=resolveProductionInspectionSource({productionOrderId:order.productionOrderId,taskId:'task-without-real-history',factoryId:'factory-without-real-history'})
  assert.equal(result.difficultyPresent,false);assert.equal(result.difficulty,undefined);assert.equal(result.techPackVersionId,original!.sourceTechPackVersionId);assert.equal(result.executionOrdinal,1)
  order.techPackSnapshot!.garmentDifficultyGrade='A++';order.techPackSnapshot!.garmentDifficultyGradeSourcePresent=true
  assert.equal(resolveProductionInspectionSource({productionOrderNo:order.productionOrderNo,taskId:'unknown-task',factoryId:'unknown-factory'}).difficulty,'A++')
 }finally{order.techPackSnapshot=original}
})
test('关闭的初始全检条件不因该条件缺失资料阻断默认抽检',()=>{
 const missing={...source(),productPosition:undefined,difficultyPresent:false,fabrics:[],unresolved:['正式商品定位未登记','正式技术包做货难度未登记','面料BOM行x未能精确解析根SPU']}
 const off={...conditions,basicStyle:false,highDifficulty:false,outsideFabricWhitelist:false,firstFactoryTasks:false}
 assert.deepEqual(evaluateInitialFullInspection(missing,off).unresolved,[])
 assert.deepEqual(evaluateInitialFullInspection(missing,{...off,highDifficulty:true}).unresolved,['正式技术包做货难度未登记'])
 assert.deepEqual(evaluateInitialFullInspection(missing,{...off,outsideFabricWhitelist:true}).unresolved,['面料BOM行x未能精确解析根SPU'])
 assert.equal(evaluateInitialFullInspection(missing,{...off,firstFactoryTasks:true}).fullInspection,false)
})
