import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync } from 'node:fs'
import { tasks, orders, snapshot, catalog, stages } from '../../src/pages/production-fulfillment/fixtures'
import { addDays, assessNodeTiming, assessTask, backwardSchedule, calculateNetwork, dayDiff, dedupeEvents, evaluateDemandClosure, filterTasks, getNodes, groupSpanCheck, orderStats, predictNetwork, projectManualForecast, restoreManualForecasts, quantityMilestone, resolveRule, scheduleBatches, shipmentProgress, supplyPosition, taskStats } from '../../src/pages/production-fulfillment/calculations'
import type { PFFilters } from '../../src/pages/production-fulfillment/model'
import { emptyFilters } from '../../src/pages/production-fulfillment/ui-state'
const at=(day:number)=>addDays(tasks[0].startedAt,day)
const defaults:PFFilters={query:'',health:'',follower:'',stage:'',team:'',region:'',supplyMode:'',scope:'',dateField:'startedAt',dateFrom:'',dateTo:'',issuesOnly:false}

test('all ten tasks have independent drill-down networks and one frozen aggregate snapshot',()=>{
  assert.equal(tasks.length,10);assert.equal(stages.length,9);assert.equal(catalog.length,77)
  assert.equal(tasks[0].nodes.length,31)
  assert.equal(tasks[0].nodes.flatMap(n=>n.childActions??[]).length,21)
  const statistics=taskStats(tasks)
  assert.deepEqual(statistics.activeHealth,{'预计逾期':2,'正常':3,'已逾期':1,'待判定':2})
  assert.equal(statistics.activeTasks,8);assert.equal(statistics.completedTasks,1);assert.equal(statistics.terminatedTasks,1)
  assert.equal(statistics.activeEffectiveQty,7000);assert.equal(statistics.activeShippedQty,400);assert.equal(statistics.activeRemainingQty,6600)
  for(const t of tasks){ assert.ok(t.nodes.length>0);assert.ok(t.nodes.every(n=>n.taskId===t.id));assert.ok(existsSync(`public${t.imageUrl}`));for(const n of t.nodes)if(n.material)assert.ok(existsSync(`public${n.material.imageUrl}`)) }
})
test('31-item dependency recursion proves 24 natural days and shows the actual sum/max formula',()=>{
 const result=calculateNetwork(tasks[0].nodes)
 assert.equal(result.durationDays,24)
 assert.equal(result.nodes.W09.finish,4);assert.equal(result.nodes.W22.finish,8);assert.equal(result.nodes.W26.finish,11)
 assert.equal(result.nodes.W27.finish,14);assert.equal(result.nodes.W19.finish,15)
 assert.equal(result.nodes.W29.finish,22);assert.equal(result.nodes.W31.finish,24)
 assert.match(result.nodes.W28.formula,/W27=14, W19=15/)
 assert.ok(result.criticalPath.includes('W19'));assert.ok(!result.criticalPath.includes('W27'))
})
test('improving procurement by ten days only improves whole-task timing by one day',()=>{
 const nodes=tasks[0].nodes.map(n=>({...n,predecessors:[...n.predecessors]}))
 const accessory=nodes.find(n=>n.id==='W19')!;accessory.predecessors=[];accessory.durationDays=5
 assert.equal(calculateNetwork(nodes,['W31']).durationDays,23)
})
test('network rejects circular/missing dependencies and unknown is never zero time',()=>{
 assert.throws(()=>calculateNetwork([{id:'a',durationDays:1,predecessors:['b']},{id:'b',durationDays:1,predecessors:['a']}]),/循环依赖/)
 assert.throws(()=>calculateNetwork([{id:'a',durationDays:1,predecessors:['missing']}]),/缺少前置/)
 assert.equal(calculateNetwork([{id:'unknown',durationDays:null,predecessors:[]},{id:'shipment',durationDays:1,predecessors:['unknown']}]).durationDays,null)
})
test('each complete standard mock network and live forecast agrees with the task summary',()=>{
 for(const t of tasks){
  const network=calculateNetwork(t.nodes)
  if(t.id!=='MOCK-PT-010') assert.equal(network.durationDays,t.standardDays,t.id)
  const predicted=predictNetwork(t).finishAt
  assert.equal(predicted?Date.parse(predicted):null,t.predictedFinishAt?Date.parse(t.predictedFinishAt):null,t.id)
 }
})
test('quantity forecast finds a one-day risk before any actual deadline is missed',()=>{
 const main=tasks[0],n=main.nodes.find(n=>n.id==='W29')!,prediction=predictNetwork(main)
 assert.equal(n.requiredQty-n.qualifiedQty,600);assert.equal(n.allocatedCapacityPerDay,200)
 assert.equal(dayDiff(prediction.nodes.W29.endAt!,main.startedAt),23)
 assert.equal(dayDiff(prediction.finishAt!,main.startedAt),25)
 assert.equal(assessTask(main).actualOverdueDays,0);assert.equal(assessTask(main).predictedDelayDays,1)
 const deadlines=backwardSchedule(main.nodes,24)
 assert.equal(deadlines.W29.latestFinish,22);assert.equal(deadlines.W27.floatDays,1)
 assert.equal(600/(22-20)-200,100)
})
test('all-natural-day clock includes Sundays, preserves timezones, equality is on time and one second is late',()=>{
 assert.equal(dayDiff(addDays('2026-09-11T10:00:00+08:00',3),'2026-09-11T10:00:00+08:00'),3)
 assert.equal(Date.parse(addDays('2026-09-11T10:00:00+08:00',3)),Date.parse('2026-09-14T09:00:00+07:00'))
 const t={...tasks[0],predictedFinishAt:tasks[0].effectiveDueAt}
 assert.equal(assessTask(t,t.effectiveDueAt!).actualOverdueDays,0)
 assert.ok(assessTask(t,addDays(t.effectiveDueAt!,1/86400)).actualOverdueDays>0)
 assert.equal(assessTask(t,addDays(t.effectiveDueAt!,1/86400)).health,'已逾期')
})
test('already-overdue outranks forecast missing; historical completion stops the clock',()=>{
 const late={...tasks[2],predictedFinishAt:null}
 assert.equal(assessTask(late).health,'已逾期');assert.equal(assessTask(late).actualOverdueDays,2)
 const finished={...tasks[7],completedAt:'2026-09-20T10:00:00+08:00'}
 assert.equal(assessTask(finished,'2026-10-30T10:00:00+08:00').actualOverdueDays,1)
 assert.equal(assessTask(finished).health,'完成但曾逾期')
})
test('upstream two-day delay and local catch-up pressure are distinct from current-team fault',()=>{
 const t=tasks[4],n=t.nodes.find(n=>n.id==='T5-07')!
 assert.equal(n.actualOverdueDays,0);assert.equal(dayDiff(n.localDueAt!,n.neededFinishAt!),2)
 assert.equal(n.team,'车缝厂A');assert.equal(t.responsibleTeam,'物流组')
 assert.equal(assessTask(t).predictedDelayDays,1)
})
test('manual forecast is local, propagates both earlier and later dates, and never relaxes baseline',()=>{
 const original=JSON.stringify(tasks[0]),improved=projectManualForecast(tasks[0],'W29',at(22))
 assert.equal(dayDiff(improved.predictedFinishAt!,improved.startedAt),24)
 assert.equal(improved.health,'正常');assert.equal(improved.effectiveDueAt,tasks[0].effectiveDueAt)
 const delayed=projectManualForecast(tasks[0],'W29',at(25))
 assert.equal(dayDiff(delayed.predictedFinishAt!,delayed.startedAt),27)
 assert.equal(JSON.stringify(tasks[0]),original)
 assert.throws(()=>projectManualForecast(tasks[0],'W01',at(23)),/未完成/)
})
test('saving a manual forecast refreshes all affected node labels without pretending capacity was increased',()=>{
 const original=tasks[0],improved=projectManualForecast(original,'W29',at(22))
 const source=original.nodes.find(n=>n.id==='W29')!,node=improved.nodes.find(n=>n.id==='W29')!
 assert.equal(improved.health,'正常')
 assert.equal(node.timeState,'临期');assert.equal(node.predictedDelayDays,0)
 assert.equal(node.forecastSource,'manual');assert.match(node.forecastNote!,/手工预计.*尚未落实/)
 assert.equal(node.allocatedCapacityPerDay,200);assert.equal(node.sourceUpdatedAt,source.sourceUpdatedAt)
 assert.equal(node.requiredCapacityPerDay,source.requiredCapacityPerDay)
 assert.equal(node.capacityGapPerDay,source.capacityGapPerDay)
 assert.equal(node.durationSource,source.durationSource);assert.equal(node.baselineDueAt,source.baselineDueAt)
 for(const id of ['W30','W31']) {
  const downstream=improved.nodes.find(n=>n.id===id)!
  assert.equal(downstream.timeState,'正常');assert.equal(downstream.predictedDelayDays,0)
  assert.equal(downstream.forecastSource,'schedule');assert.match(downstream.forecastNote!,/W29.*手工预计传播/)
 }
 const recalculated=predictNetwork(improved)
 assert.equal(dayDiff(recalculated.finishAt!,improved.startedAt),24)
 assert.match(recalculated.nodes.W29.method,/负责人手工预计/)
 assert.ok(!recalculated.nodes.W29.method.includes('÷'))
 assert.match(recalculated.nodes.W30.method,/手工预计传播/)
 const delayed=projectManualForecast(original,'W29',at(25))
 assert.ok(delayed.nodes.filter(n=>['W29','W30','W31'].includes(n.id)).every(n=>n.timeState==='预计逾期'&&n.predictedDelayDays===3))
 assert.equal(assessNodeTiming({...node,localDueAt:at(19)}).timeState,'已逾期')
})
test('zero capacity and stale progress never forecast zero remaining duration',()=>{
 const t={...tasks[0],nodes:tasks[0].nodes.map(n=>n.id==='W29'?{...n,allocatedCapacityPerDay:0}:n)}
 assert.equal(predictNetwork(t).finishAt,null)
 assert.equal(predictNetwork(tasks[9]).finishAt,null);assert.equal(assessTask(tasks[9]).health,'待判定')
 assert.equal(assessTask(tasks[3]).health,'待判定');assert.equal(tasks[3].decisionOverdueDays,9)
})
test('stock and purchase coverage do not imply factory readiness or a new purchase gap',()=>{
 const allocation=(id:string,qty:number,received:number)=>({id,qty,unit:'PCS',targetSku:'zipper',qualified:true,factoryReceivedQty:received})
 const stock=allocation('stock',300,300),purchase=allocation('purchase',700,200)
 const result=supplyPosition(1000,'PCS','zipper',[stock],[purchase,purchase])
 assert.deepEqual(result,{securedQty:1000,factoryAvailableQty:500,newPurchaseGap:0,factoryShortage:500})
 assert.throws(()=>supplyPosition(1000,'M','zipper',[stock],[]),/单位不同/)
 assert.equal(supplyPosition(1000,'PCS','black',[],[{...purchase,targetSku:'white',qty:1000,factoryReceivedQty:1000}]).factoryAvailableQty,0)
})
test('stock-only task still has transfer; purchased material must move beyond warehouse entry',()=>{
 const stock=tasks[1].nodes.filter(n=>n.stage==='S03');assert.ok(stock.some(n=>n.name.includes('调拨')));assert.ok(!stock.some(n=>n.name.includes('采购下单')))
 const warehouse=tasks[2].nodes.find(n=>n.id==='T3-04')!,factory=tasks[2].nodes.find(n=>n.id==='T3-08')!
 assert.equal(warehouse.qualifiedQty,800);assert.equal(factory.qualifiedQty,0);assert.equal(factory.businessState,'等待前置')
})
test('batch schedule conserves shared capacity and 90 percent occurs at a real batch event',()=>{
 const rows=scheduleBatches([{id:'B1',qty:400,readyDay:16},{id:'B2',qty:400,readyDay:18},{id:'B3',qty:200,readyDay:20}],200,400)
 assert.deepEqual(rows.map(b=>b.shippedDay),[19.5,21.5,22])
 assert.ok(rows[2].postStart>=rows[1].postEnd)
 const milestone=quantityMilestone(rows.map(b=>({at:at(b.shippedDay),qty:b.qty})),1000,.9)
 assert.equal(dayDiff(milestone!,tasks[0].startedAt),22)
 assert.throws(()=>scheduleBatches([],0,400),/可靠/)
})
test('customer cancellation without production allocation does not reduce any task',()=>{
 const result=evaluateDemandClosure({originalQty:1000,shippedQty:900,lastShipmentAt:at(20),reductionQty:100,reductionAt:at(25),reductionAppliesToTask:false})
 assert.equal(result.effectiveQty,1000);assert.equal(result.remainingQty,100);assert.equal(result.closedAt,null)
 const formal=evaluateDemandClosure({originalQty:1000,shippedQty:900,lastShipmentAt:at(20),reductionQty:100,reductionAt:at(25),reductionAppliesToTask:true})
 assert.equal(formal.type,'范围减少后关闭');assert.equal(dayDiff(formal.closedAt!,tasks[0].startedAt),25)
 const cancelled=evaluateDemandClosure({originalQty:1000,shippedQty:0,lastShipmentAt:null,reductionQty:1000,reductionAt:at(5),reductionAppliesToTask:true})
 assert.equal(cancelled.type,'已终止');assert.equal(cancelled.progressPct,null)
})
test('excess shipment of one SKU cannot hide shortage of another',()=>{
 assert.deepEqual(shipmentProgress([{sku:'red',effectiveQty:100,shippedQty:120},{sku:'blue',effectiveQty:100,shippedQty:80}]),{effectiveQty:200,creditedQty:180,remainingQty:20,progressPct:90})
 assert.equal(assessTask(tasks[6]).progressPct,44.44)
})
test('duplicate, out-of-order and corrected quantity events conserve the effective sum',()=>{
 const old={id:'old',occurredAt:at(2),recordedAt:at(3),qty:100}
 const corrected={id:'new',correctsId:'old',occurredAt:at(2),recordedAt:at(4),qty:80}
 const fresh={id:'later',occurredAt:at(3),recordedAt:at(3),qty:20}
 const result=dedupeEvents([fresh,old,corrected,old,corrected])
 assert.deepEqual(result.map(e=>e.id),['new','later']);assert.equal(result.reduce((s,e)=>s+e.qty,0),100)
})
test('shared work is counted once while merged source tasks preserve independent T0 and deadlines',()=>{
 assert.equal(getNodes(tasks).length,tasks.reduce((s,t)=>s+t.nodes.length,0)-1)
 assert.equal(tasks[4].nodes.find(n=>n.id==='SHARED-TECH-001')!.sourceDocumentId,tasks[5].nodes.find(n=>n.id==='SHARED-TECH-001')!.sourceDocumentId)
 assert.notEqual(tasks[4].startedAt,tasks[5].startedAt);assert.notEqual(tasks[4].effectiveDueAt,tasks[5].effectiveDueAt)
})
test('orders enter analysis only from actual shipment and have their own clock',()=>{
 const stats=orderStats([...orders,orders[0]])
 assert.equal(stats.knownShippedOrders,5);assert.equal(stats.overdueShippedOrders,3)
 assert.equal(stats.knownShippedQty,1400);assert.equal(stats.overdueShippedQty,900);assert.equal(stats.onTimeRate,40);assert.equal(stats.overdueQuantityRate,64.29)
 assert.equal(assessTask(tasks[7]).health,'按期完成')
 assert.ok(!orders.some(o=>o.taskId==='MOCK-PT-001'))
 assert.ok(orders.every(o=>Date.parse(o.associatedAt)>=Date.parse(o.shippedAt)))
 const cancellation={...orders[0],orderCompletionType:'余量取消后关闭'}
 assert.equal(orderStats([cancellation]).comparableCompletedOrders,0)
 const partial={...orders[0],shippedQty:100,orderEffectiveQty:300}
 assert.equal(orderStats([partial]).comparableCompletedOrders,0)
})
test('region and supply mode select rules together, unpublished candidate rules never apply',()=>{
 const base={version:'v1',published:true,validFrom:'2026-01-01T00:00:00Z',durationDays:5}
 const rules=[{...base,id:'ID-stock',conditions:{region:'ID',mode:'现货'}},{...base,id:'ID-made',conditions:{region:'ID',mode:'制作'},durationDays:10},{...base,id:'CN-candidate',published:false,conditions:{region:'CN'},durationDays:8}]
 assert.equal(resolveRule(rules,{region:'ID',mode:'现货'},snapshot).rule?.id,'ID-stock')
 assert.equal(resolveRule(rules,{region:'ID'},snapshot).state,'待判断')
 assert.equal(resolveRule(rules,{region:'CN'},snapshot).state,'缺规则')
 assert.equal(resolveRule([rules[0],{...rules[0],id:'duplicate'}],{region:'ID',mode:'现货'},snapshot).state,'规则冲突')
 assert.equal(groupSpanCheck([{id:'a',predecessors:[],durationDays:3},{id:'b',predecessors:['a'],durationDays:4}],5).state,'规则冲突')
})
test('filters share exact aggregate scope and date windows are left-closed right-open',()=>{
 assert.equal(filterTasks(tasks,{...defaults,health:'预计逾期'}).length,2)
 assert.equal(taskStats(filterTasks(tasks,{...defaults,follower:'跟单甲'})).activeTasks,2)
 assert.deepEqual(filterTasks(tasks,{...defaults,dateFrom:'2026-08-28',dateTo:'2026-08-28'}).map(t=>t.id),['MOCK-PT-001','MOCK-PT-002'])
 assert.equal(filterTasks(tasks,{...defaults,query:'MOCK-DEM-003'})[0].id,'MOCK-PT-003')
 assert.equal(filterTasks(tasks,{...defaults,scope:'active'}).length,8)
})
test('Chinese UI defaults and all scope options filter the intended task population',()=>{
 const filters=emptyFilters()
 assert.equal(filters.scope,'在途');assert.equal(filters.dateField,'生效到期')
 assert.equal(filterTasks(tasks,filters).length,8)
 assert.equal(filterTasks(tasks,{...filters,scope:'全部'}).length,10)
 assert.deepEqual(filterTasks(tasks,{...filters,scope:'已完成'}).map(t=>t.id),['MOCK-PT-008'])
 assert.deepEqual(filterTasks(tasks,{...filters,scope:'已终止'}).map(t=>t.id),['MOCK-PT-009'])
})
test('Chinese risk shortcut agrees with risk KPI and does not accidentally select completed or overdue tasks',()=>{
 const filters=emptyFilters()
 assert.deepEqual(filterTasks(tasks,{...filters,health:'有风险'}).map(t=>t.id),['MOCK-PT-001','MOCK-PT-005'])
 assert.equal(filterTasks(tasks,{...filters,health:'有风险'}).length,taskStats(tasks).riskTasks)
 assert.deepEqual(filterTasks(tasks,{...filters,health:'已逾期'}).map(t=>t.id),['MOCK-PT-003'])
 assert.deepEqual(filterTasks(tasks,{...filters,health:'待判定'}).map(t=>t.id),['MOCK-PT-004','MOCK-PT-010'])
 assert.deepEqual(filterTasks(tasks,{...filters,health:'正常'}).map(t=>t.id),['MOCK-PT-002','MOCK-PT-006','MOCK-PT-007'])
})
test('Chinese date-field labels use due date, start date and predicted completion respectively',()=>{
 const filters=emptyFilters()
 assert.deepEqual(filterTasks(tasks,{...filters,dateField:'生效到期',dateFrom:'2026-09-21',dateTo:'2026-09-21'}).map(t=>t.id),['MOCK-PT-001','MOCK-PT-002','MOCK-PT-005'])
 assert.deepEqual(filterTasks(tasks,{...filters,dateField:'起点',dateFrom:'2026-08-28',dateTo:'2026-08-28'}).map(t=>t.id),['MOCK-PT-001','MOCK-PT-002'])
 assert.deepEqual(filterTasks(tasks,{...filters,dateField:'预计完成',dateFrom:'2026-09-22',dateTo:'2026-09-22'}).map(t=>t.id),['MOCK-PT-001','MOCK-PT-005'])
 assert.ok(!filterTasks(tasks,{...filters,dateField:'预计完成',dateFrom:'2026-09-01',dateTo:'2026-10-30'}).some(t=>['MOCK-PT-004','MOCK-PT-010'].includes(t.id)))
})
test('team and stage filters match applicable work nodes rather than only current task responsibility',()=>{
 const filters=emptyFilters()
 assert.deepEqual(filterTasks(tasks,{...filters,team:'车缝厂B'}).map(t=>t.id),['MOCK-PT-002','MOCK-PT-006','MOCK-PT-007'])
 const materialOnly={...tasks[0],id:'material-only',nodes:tasks[0].nodes.filter(n=>n.stage==='S03')}
 assert.equal(filterTasks([materialOnly],{...filters,stage:'S07'}).length,0)
 assert.equal(filterTasks([materialOnly],{...filters,stage:'S03'}).length,1)
 assert.equal(filterTasks([tasks[4]],{...filters,team:'车缝厂A'}).length,1)
})

test('V3 team and factory must match the same node and empty all-scope still keeps a task',()=>{
  const task={...tasks[0],nodes:[{...tasks[0].nodes[0],team:'团队甲',factory:'工厂甲'},{...tasks[0].nodes[1],team:'团队乙',factory:'工厂乙'}]}
  assert.equal(filterTasks([task],{...defaults,team:'团队甲',factory:'工厂乙'}).length,0)
  assert.equal(filterTasks([task],{...defaults,team:'团队甲',factory:'工厂甲'}).length,1)
  assert.equal(filterTasks([{...task,nodes:[]}],defaults).length,1)
})
test('V3 unknown shipment has no percentage and completed work without deadline is not on time',()=>{
  assert.equal(assessTask({...tasks[0],quantityKnown:false}).progressPct,null)
  const node={...tasks[0].nodes[0],localDueAt:null,baselineDueAt:null}
  assert.equal(assessNodeTiming(node).timeState,'已完成·时效待判')
})

test('恢复预测保留不同工作和日期的顺序，只合并连续相同计算且不改写历史',()=>{
 const original=JSON.stringify(tasks),first={taskId:tasks[0].id,nodeId:'W29',endAt:at(25)},second={...first,nodeId:'W30',endAt:at(27)}
 const records=[first,first,first,second,second,{...first,endAt:at(26)},first],history=JSON.stringify(records)
 let expected=tasks[0]
 for(const row of records)expected=projectManualForecast(expected,row.nodeId,row.endAt)
 const actual=restoreManualForecasts(tasks,records)
 assert.deepEqual(actual[0],expected);assert.equal(JSON.stringify(records),history);assert.equal(JSON.stringify(tasks),original)
 assert.equal(actual[1],tasks[1])
 const recovered=restoreManualForecasts(tasks,[null,{},{...first,nodeId:'missing'},first])
 assert.deepEqual(recovered[0],projectManualForecast(tasks[0],first.nodeId,first.endAt))
 assert.equal(restoreManualForecasts(tasks,{}),tasks)
})
