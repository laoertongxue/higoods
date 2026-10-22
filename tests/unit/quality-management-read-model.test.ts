import assert from 'node:assert/strict'
import test from 'node:test'
import { registerQualityInspectionSource, listQualityInspectionRecords, calculateQualityInspectionStatistics, listQualityInspectionAudits, getQualityInspectionRecord } from '../../src/data/fcs/quality-management-read-model.ts'
import { buildInspectionSnapshotFromConfigurations } from '../../src/data/fcs/quality-management-records.ts'
import type { QualityInspectionRecordView } from '../../src/data/fcs/quality-management-types.ts'
const record:QualityInspectionRecordView={id:'qc-1',sourceId:'original-1',sourceKind:'PRODUCTION_RETURN',displayNo:'QC-001',sourceHref:'/fcs/craft/post-finishing/qc-orders',styleCode:'STYLE-1',styleName:'对应成衣',factoryName:'厂甲',status:'已完成',quantity:100,inspectedQty:30,passedQty:29,defectQty:1,returnedQty:0,uninspectedReleaseQty:70,normalReleaseQty:99,completedAt:'2026-10-22T02:00:00Z',issues:[{itemId:'garment-size-chest'},{itemId:'garment-clean'}],snapshot:buildInspectionSnapshotFromConfigurations({sourceKind:'PRODUCTION_RETURN'})}

test('审查补缺：稽查触发、待处理及升检次数按同范围实际决定分别统计',()=>{
 const audits:NonNullable<QualityInspectionRecordView['audits']>=[
  {id:'first',roundNumber:1,threshold:2,unqualifiedQty:3,status:'UPGRADED',fromPercent:30,toPercent:50},
  {id:'second',roundNumber:2,threshold:2,unqualifiedQty:2,status:'UPGRADED',fromPercent:50,toPercent:100},
  {id:'other-pending',roundNumber:1,threshold:2,unqualifiedQty:2,status:'PENDING',fromPercent:30},
 ]
 const remove=registerQualityInspectionSource('PRODUCTION_RETURN',{list:()=>[{...record,audits}]})
 try{
  const stats=calculateQualityInspectionStatistics({sourceKind:'PRODUCTION_RETURN',factoryName:'厂甲'})[0]
  assert.equal(stats.auditCount,3);assert.equal(stats.pendingAuditCount,1);assert.equal(stats.upgradedAuditCount,2)
  const excluded=calculateQualityInspectionStatistics({sourceKind:'PRODUCTION_RETURN',factoryName:'厂乙'})[0]
  assert.equal(excluded.auditCount,0);assert.equal(excluded.upgradedAuditCount,0)
 }finally{remove()}
})

test('审查补缺：库存申请、出库实收及分类返仓上架与实际检查分别统计',()=>{
 const stock:QualityInspectionRecordView={...record,id:'stock-qc',sourceId:'app-1',sourceKind:'WAREHOUSE_STOCK',factoryName:undefined,warehouseName:'原仓甲',quantity:79,inspectedQty:79,passedQty:74,defectQty:2,returnedQty:3,uninspectedReleaseQty:0,normalReleaseQty:74,sentQty:80,receivedQty:79,returnReceivedQty:74,putawayQty:70,defectReceivedQty:2,defectPutawayQty:1,gotoReceivedQty:3}
 const pending:QualityInspectionRecordView={id:'inventory-application:app-2',sourceId:'app-2',sourceKind:'WAREHOUSE_STOCK',displayNo:'APP-2',sourceHref:'/wls/finished/inventory-quality?id=app-2',styleCode:'STYLE-1',styleName:'对应成衣',warehouseName:'原仓甲',status:'待后道实收',inventoryApplicationOnly:true,sentQty:50,issues:[]}
 const remove=registerQualityInspectionSource('WAREHOUSE_STOCK',{list:()=>[stock,pending,{...stock,id:'other-warehouse',sourceId:'app-3',warehouseName:'其他仓'}]})
 try{
  const stats=calculateQualityInspectionStatistics({sourceKind:'WAREHOUSE_STOCK',warehouseName:'原仓甲'})[0]
  assert.equal(stats.inventoryApplicationCount,2);assert.equal(stats.pendingInventoryReceiptCount,1)
  assert.equal(stats.sentQty,130);assert.equal(stats.receivedQty,79);assert.equal(stats.inspectedQty,79)
  assert.equal(stats.returnReceivedQty,74);assert.equal(stats.putawayQty,70);assert.equal(stats.defectReceivedQty,2);assert.equal(stats.defectPutawayQty,1);assert.equal(stats.gotoReceivedQty,3)
  assert.equal(stats.unknownInspectionCount,0,'未形成QC的送检申请不是旧实检未知记录')
  assert.equal(stock.sentQty,80);assert.equal(pending.inspectedQty,undefined,'不为未开检申请制造实检0或合格事实')
 }finally{remove()}
})
test('实检三类及未检物流分开；多项目不重复坏件；返回隔离副本',()=>{
 const remove=registerQualityInspectionSource('PRODUCTION_RETURN',{list:()=>[record]})
 try{const stats=calculateQualityInspectionStatistics({sourceKind:'PRODUCTION_RETURN'})[0];assert.equal(stats.quantity,100);assert.equal(stats.inspectedQty,30);assert.equal(stats.passedQty,29);assert.equal(stats.unqualifiedRate,1/30);assert.equal(stats.normalReleaseQty,99);assert.equal(stats.issueDistribution.length,2)
 const returned=getQualityInspectionRecord('PRODUCTION_RETURN','qc-1')!;returned.passedQty=99;assert.equal(record.passedQty,29)
 }finally{remove()}
})
test('三来源分开单位，样衣按件和48小时，过滤统计明细同范围',()=>{
 const remove=registerQualityInspectionSource('PRODUCTION_RETURN',{list:()=>[record]})
 const sampleRemove=registerQualityInspectionSource('PRE_PRODUCTION_SAMPLE',{list:()=>[{...record,sourceKind:'PRE_PRODUCTION_SAMPLE',id:'sample',sourceId:'sample',quantity:undefined,inspectedQty:undefined,passedQty:undefined,defectQty:undefined,returnedQty:undefined,uninspectedReleaseQty:undefined,normalReleaseQty:undefined,sampleResult:'HAS_ISSUE',openedAt:'2026-10-16T00:00:00Z',dueAt:'2026-10-18T00:00:00Z',completedAt:'2026-10-18T00:00:01Z'}]})
 try{const stats=calculateQualityInspectionStatistics();assert.equal(stats[0].inspectedQty,30);assert.equal(stats[2].sampleHasIssueCount,1);assert.equal(stats[2].sampleOverdueCount,1);assert.equal(stats[2].inspectedQty,0)
 assert.equal(listQualityInspectionRecords({factoryName:'厂乙'}).length,0);assert.equal(calculateQualityInspectionStatistics({factoryName:'厂乙'})[0].recordCount,0);assert.equal(listQualityInspectionRecords({dateTo:'2026-10-21',sourceKind:'PRODUCTION_RETURN'}).length,0)
 }finally{remove();sampleRemove()}
})
test('未知历史实检不会按送检量补填，新来源失败不兜底',()=>{
 const remove=registerQualityInspectionSource('PRODUCTION_RETURN',{list:()=>[{...record,inspectedQty:undefined,passedQty:undefined}]})
 try{assert.equal(listQualityInspectionRecords()[0].inspectedQty,undefined);assert.equal(calculateQualityInspectionStatistics()[0].unknownInspectionCount,1);assert.equal(calculateQualityInspectionStatistics()[0].unqualifiedRate,null)}finally{remove()}
 const failure=registerQualityInspectionSource('PRODUCTION_RETURN',{list:()=>{throw new Error('原来源读取失败')}})
 try{assert.throws(()=>listQualityInspectionRecords(),/读取失败/)}finally{failure()}
})
test('重复唯一业务身份拒绝合并，稽查只读可追触发轮',()=>{
 const duplicate=registerQualityInspectionSource('PRODUCTION_RETURN',{list:()=>[record,record]})
 try{assert.throws(()=>listQualityInspectionRecords(),/重复/)}finally{duplicate()}
 const remove=registerQualityInspectionSource('PRODUCTION_RETURN',{list:()=>[{...record,audits:[{id:'audit-1',roundNumber:1,threshold:2,unqualifiedQty:3,status:'UPGRADED',fromPercent:30,toPercent:50}]}]})
 try{assert.equal(listQualityInspectionAudits()[0].recordId,'qc-1');assert.equal(listQualityInspectionAudits()[0].toPercent,50)}finally{remove()}
})

test('列表仅返回轻摘要，详情只读指定来源单记录，查询统计不读取冻结快照',async()=>{
 let listCalls=0,getCalls=0,prepared=''
 const detail={...record,rounds:[{id:'r1',roundNumber:1,percent:30,targetQty:30,passedQty:29,defectQty:1,returnedQty:0,issues:[],submittedAt:'2026-10-22T02:00:00Z'}]}
 const remove=registerQualityInspectionSource('PRODUCTION_RETURN',{list:()=>{listCalls++;return [detail]},get:(id:string)=>{getCalls++;return id===detail.id?detail:undefined},prepareDetail:async(id:string)=>{prepared=id}} as any)
 try{
  const list=listQualityInspectionRecords({sourceKind:'PRODUCTION_RETURN'});assert.equal(list[0].snapshot,undefined);assert.equal(list[0].rounds,undefined)
  const stats=calculateQualityInspectionStatistics({sourceKind:'PRODUCTION_RETURN'});assert.equal(stats[0].issueDistribution.find(item=>item.itemId==='garment-size-chest')?.name,'胸围')
  const before=listCalls,full=getQualityInspectionRecord('PRODUCTION_RETURN','qc-1')!;assert.equal(listCalls,before);assert.equal(getCalls,1);assert.equal(full.snapshot?.items.length,record.snapshot?.items.length)
  full.snapshot!.items[0].name='不影响原记录';assert.notEqual(record.snapshot!.items[0].name,'不影响原记录')
  const read=await import('../../src/data/fcs/quality-management-read-model.ts');await (read as any).ensureQualityInspectionRecordDetails('PRODUCTION_RETURN','qc-1');assert.equal(prepared,'qc-1')
 }finally{remove()}
})

test('已知零实检不计算不合格率，历史未知保持未知而不借物流量补算',()=>{
 const remove=registerQualityInspectionSource('PRODUCTION_RETURN',{list:()=>[{...record,id:'explicit-zero',inspectedQty:0,passedQty:0,defectQty:0,returnedQty:0},{...record,id:'unknown',inspectedQty:undefined,passedQty:undefined,defectQty:undefined,returnedQty:undefined}]})
 try{const stats=calculateQualityInspectionStatistics({sourceKind:'PRODUCTION_RETURN'})[0];assert.equal(stats.inspectedQty,0);assert.equal(stats.unqualifiedRate,null);assert.equal(stats.unknownInspectionCount,1);const list=listQualityInspectionRecords();assert.equal(list.find(row=>row.id==='unknown')!.inspectedQty,undefined);assert.equal(list.find(row=>row.id==='explicit-zero')!.inspectedQty,0)}finally{remove()}
})

test('工厂当地业务日期筛选：Jakarta午夜完成或未完领取均按当地日期，旧墙钟及未知时区保留原日期',()=>{
 const sample=(id:string,times:Partial<QualityInspectionRecordView>):QualityInspectionRecordView=>({...record,sourceKind:'PRE_PRODUCTION_SAMPLE',id,sourceId:id,quantity:undefined,inspectedQty:undefined,passedQty:undefined,defectQty:undefined,returnedQty:undefined,uninspectedReleaseQty:undefined,normalReleaseQty:undefined,timeZone:'Asia/Jakarta',...times})
 const rows=[
  sample('completed-local-next-day',{openedAt:'2026-10-20T02:00:00Z',completedAt:'2026-10-21T17:00:00Z'}),
  sample('pending-local-next-day',{openedAt:'2026-10-21T17:01:00Z',completedAt:undefined}),
  sample('completed-local-before-midnight',{completedAt:'2026-10-21T16:59:59Z'}),
  sample('offset-instant-local-prior-day',{completedAt:'2026-10-22T00:30:00+08:00'}),
  sample('legacy-wall-clock',{completedAt:'2026-10-21 23:59:00'}),
  sample('legacy-unknown-zone',{completedAt:'2026-10-21T17:00:00Z',timeZone:undefined}),
 ]
 const remove=registerQualityInspectionSource('PRE_PRODUCTION_SAMPLE',{list:()=>rows})
 try{
  const query={sourceKind:'PRE_PRODUCTION_SAMPLE' as const,dateFrom:'2026-10-22',dateTo:'2026-10-22'}
  assert.deepEqual(listQualityInspectionRecords(query).map(row=>row.id).sort(),['completed-local-next-day','pending-local-next-day'])
  assert.equal(calculateQualityInspectionStatistics(query)[0].recordCount,2)
  assert.deepEqual(listQualityInspectionRecords({...query,dateFrom:'2026-10-21',dateTo:'2026-10-21'}).map(row=>row.id).sort(),['completed-local-before-midnight','legacy-unknown-zone','legacy-wall-clock','offset-instant-local-prior-day'])
  assert.equal(rows[0].completedAt,'2026-10-21T17:00:00Z','筛选不改原持久时间')
 }finally{remove()}
})
