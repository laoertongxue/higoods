"""Design-only fixtures and static illustration. Does not import or change app code."""
from pathlib import Path
from datetime import datetime, timedelta
from collections import Counter
import json
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).parent
ROOT.joinpath('assets').mkdir(exist_ok=True)
T0 = datetime.fromisoformat('2026-08-28T10:00:00+08:00')
NOW = datetime.fromisoformat('2026-09-17T10:00:00+08:00')
def at(day): return (T0 + timedelta(days=day)).isoformat()

stages = [
 ('S01','需求受理与方案判断'),('S02','生产准备与技术放行'),
 ('S03','面辅料供给、加工与到厂'),('S04','生产建单与任务下发'),
 ('S05','裁床生产'),('S06','特殊工艺与车缝配套'),
 ('S07','车缝与回货交接'),('S08','后道、质检与成衣入库'),
 ('S09','实际发货与订单时效核算')]
teams = {
 '跟单组':'跟单甲','版房':'版师乙','调色厂':'调色丙','买手组':'买手丁',
 '采购组':'采购戊','供方':'供方己','物流组':'物流庚','仓储组':'仓管辛',
 '染厂':'染色壬','计划组':'计划癸','裁厂':'裁床甲','特殊工艺厂':'工艺乙',
 '车缝厂A':'车缝丙','后道厂':'后道丁','质检组':'质检戊','履约仓':'发货己'}

# Each row is one timing node (action or explicit group proxy).
raw = [
 ('W01','S01','确认供给路线与缺口','跟单组',1,[], '需求分析','份',1),
 ('W02','S02','确认生产准备计划','跟单组',.25,[], '准备单','份',1),
 ('W03','S02','产前样制作','版房',1,['W02'], '样衣任务','件',1),
 ('W04','S02','梭织尺码纸样','版房',1,['W02'], '纸样任务','套',1),
 ('W05','S02','调色要求提交','跟单组',.25,['W02'], '调色任务','份',1),
 ('W06','S02','调色执行','调色厂',2,['W05'], '调色任务','份',1),
 ('W07','S02','色样审核通过','买手组',.5,['W06'], '审核记录','份',1),
 ('W08','S02','技术资料确认','跟单组',.5,['W03','W04','W07','W12'], '资料确认任务','份',1),
 ('W09','S02','技术资料发布','跟单组',.5,['W08'], '资料版本','版',1),
 ('W10','S03','现货原料调拨出库','仓储组',1,[], '原料调拨单','M',1200),
 ('W11','S03','原料运输及染厂实收','物流组',1,['W10'], '调拨接收记录','M',1200),
 ('W12','S03','中国辅料采购下单','采购组',1,['W01'], '辅料采购单','PCS',1000),
 ('W13','S03','供应商备货与交出','供方',1,['W12'], '采购交货记录','PCS',1000),
 ('W14','S03','国内运输与集货接收','物流组',1,['W13'], '物流批次','PCS',1000),
 ('W15','S03','跨境转运与到仓','物流组',6,['W14'], '转运批次','PCS',1000),
 ('W16','S03','到仓验收并入库','仓储组',1,['W15'], '采购入库单','PCS',1000),
 ('W17','S03','安排调拨与等待出库','仓储组',2,['W16'], '辅料调拨单','PCS',1000),
 ('W18','S03','辅料调拨出库','仓储组',1,['W17'], '调拨出库记录','PCS',1000),
 ('W19','S03','运输及车缝厂实收','物流组',1,['W18'], '调拨接收记录','PCS',1000),
 ('W20','S03','面料染色加工','染厂',4,['W07','W11'], '染色加工单','M',1200),
 ('W21','S03','染色检验与交出','染厂',.5,['W20'], '加工交出单','M',1200),
 ('W22','S03','染色面料运输及裁厂实收','物流组',.5,['W21'], '加工接收记录','M',1200),
 ('W23','S04','创建并确认生产单','计划组',.5,['W09'], '生产单','件',1000),
 ('W24','S04','下发裁床任务','计划组',.5,['W23'], '任务下发记录','件',1000),
 ('W25','S05','齐料配料','裁厂',1,['W22','W24'], '配料记录','件',1000),
 ('W26','S05','裁剪及裁片验收','裁厂',2,['W25'], '裁床任务','件',1000),
 ('W27','S06','必要特殊工艺及交接','特殊工艺厂',3,['W26'], '特殊工艺任务','件',1000),
 ('W28','S06','厂内配套分单与车缝交接','计划组',1,['W27','W19'], '分单交接记录','件',1000),
 ('W29','S07','车缝及合格回货交接','车缝厂A',6,['W28'], '车缝任务及回货实收','件',1000),
 ('W30','S08','后道及质检入库','后道厂',1,['W29'], '后道任务、质检、入库','件',1000),
 ('W31','S09','拣配复核与实际发货','履约仓',1,['W30'], '出库发货单','件',1000),
]
nodes=[]; by_id={}
raw_by_id={r[0]:r for r in raw}
standard_windows={}
def window(wid):
    if wid not in standard_windows:
        row=raw_by_id[wid]
        start=max([window(p)[1] for p in row[5]] or [0])
        standard_windows[wid]=(start,start+row[4])
    return standard_windows[wid]
for wid,stage,name,team,duration,preds,doc,unit,qty in raw:
    start,end=window(wid)
    state='已完成' if end<=20 else ('进行中' if start<20 else '未到可执行时间')
    actual_start=at(start) if state in ['已完成','进行中'] else None
    actual_end=at(end) if state=='已完成' else None
    forecast=end if end<=20 else {'W29':23,'W30':24,'W31':25}[wid]
    node=dict(id=wid,stage=stage,name=name,team=team,owner=teams[team],durationDays=duration,
      durationSource='MOCK演示预算，非正式发布标准',predecessors=preds,sourceDocumentType=doc,
      sourceDocumentId='MOCK-DOC-'+wid,unit=unit,requiredQty=qty,
      qualifiedQty=qty if state=='已完成' else (400 if wid=='W29' else 0),
      standardStartDay=start,standardEndDay=end,baselineDueAt=at(end),
      standardStartAt=at(start),actualStartAt=actual_start,actualEndAt=actual_end,
      predictedStartAt=at({'W30':23,'W31':24}.get(wid,start)),predictedEndAt=at(forecast),
      businessState=state,timeState='预计逾期' if forecast>end else '按期完成',
      actualElapsedDays=(end-start if state=='已完成' else (20-start if state=='进行中' else None)),
      actualOverdueDays=0,predictedDelayDays=max(0,forecast-end),
      mappingState='演示关联',sourceUpdatedAt=NOW.isoformat())
    if wid=='W29': node.update(allocatedCapacityPerDay=200,remainingQty=600,requiredCapacityPerDay=300,capacityGapPerDay=100,
                               firstQualifiedReturnAt=at(19),firstQualifiedReturnQty=200)
    if wid in ['W30','W31']: node['timeState']='受上游影响，预计逾期'
    if wid=='W30': node.update(releaseMode='ALL',releaseRequiredQty=1000,
      releaseRuleId='MOCK-RELEASE-001',releaseReason='本演示场景选择整批派入后道；非通用业务强制门槛，正式路线需确认是否可分批')
    if wid in ['W29','W30','W31']:
        node['timingKind']='groupProxy'
        child_names={'W29':['任务接收','排队开工','车缝执行','车缝自检','回货交出','回货运输','回货实收'],
          'W30':['回货接收检验','后道领取排队','后道执行','终检','成衣交出','成衣仓实收','成衣入库可发确认'],
          'W31':['发货条件确认','拣配','复核','包装交运准备','实际发货确认','实发订单与来源关联','订单时效核算']}[wid]
        child_teams={'W29':['车缝厂A']*5+['物流组','后道厂'],
          'W30':['质检组','后道厂','后道厂','质检组','后道厂','履约仓','履约仓'],
          'W31':['履约仓']*6+['数据责任团队']}[wid]
        node['childActions']=[dict(id=wid+'-C'+str(i+1),name=name,team=child_teams[i],
           owner=teams.get(child_teams[i],'数据专员庚'),sourceDocumentId='MOCK-DOC-'+wid+'-C'+str(i+1),
           requiredQty=1000,qualifiedQty=(1000 if i<2 else 400) if wid=='W29' else 0,
           unit='件',actualStartAt=at([16,16,16,18,18.5,18.75,19][i]) if wid=='W29' else None,
           actualEndAt=at(16) if wid=='W29' and i<2 else None,
           budgetDays=None,budgetState='尚未分配独立子预算，不能以父组预算考核每个团队',
           businessState=('已完成' if i<2 else '部分完成') if wid=='W29' else '等待前置',
           includedInProductionDuration=not(wid=='W31' and i>=5)) for i,name in enumerate(child_names)]
    else: node['timingKind']='action'
    by_id[wid]=node;nodes.append(node)

# Stage summaries are categories, not extra duration or a serial plan.
stage_data=[]
for sid,name in stages:
    members=[n for n in nodes if n['stage']==sid]
    stage_data.append(dict(id=sid,name=name,instanceCount=len(members),
       standardStartDay=min(n['standardStartDay'] for n in members),
       standardEndDay=max(n['standardEndDay'] for n in members)))

def task(i,scenario,start,days,qty,ship,state,health,forecast,owner='跟单甲',**extra):
    t=datetime.fromisoformat(start)
    return dict(id=f'MOCK-PT-{i:03}',purchaseNo=f'MOCK-PUR-{i:03}',demandNo=f'MOCK-DEM-{i:03}',
      scenario=scenario,startedAt=start,standardDays=days,baselineDueAt=(t+timedelta(days=days)).isoformat() if days else None,
      effectiveDueAt=(t+timedelta(days=days)).isoformat() if days else None,predictedFinishAt=forecast,
      originalQty=qty,effectiveQty=qty,shippedQty=ship,remainingQty=qty-ship,
      businessState=state,health=health,follower=owner,accountableTeam='跟单组',unit='件',
      styleRef='SPU-HOODIE-082',**extra)
tasks=[
 task(1,'数量进度导致预测延误',at(0),24,1000,0,'生产中','预计逾期',at(25),currentWork='W29'),
 task(2,'当前产能可守住交期',at(0),24,1000,0,'生产中','正常',at(23.5),'跟单乙',qualifiedReturnedQty=700,quantityMeaning='合格回货实收',allocatedCapacityPerDay=200,factory='车缝厂B'),
 task(3,'采购已入库，调拨未到厂',at(-4),22,800,0,'待到料','已逾期',at(26),'跟单乙',materialWarehouseQty=800,materialFactoryReceivedQty=0,blocker='调拨运输延误',responsibleTeam='物流组'),
 task(4,'采购来源与特殊工艺尚待判断',at(10),None,600,0,'方案待确认','待判定',None,'跟单丙',scenarioDays=[20,23,24,24],standardRangeDays=[20,24],decisionDueAt=at(11),decisionOverdueDays=9),
 task(5,'上游晚到，本环节需追回2天',at(4),20,1000,0,'生产中','预计逾期',at(25),'跟单甲',localBudgetDays=4,plannedInputAt=at(17),actualInputAt=at(19),localDueAt=at(23),neededFinishAt=at(21),tailDays=3,predictedLocalFinishAt=at(22),recoverDays=2),
 task(6,'部分现货加部分采购',at(13),24,1000,0,'待到料','正常',at(36),'跟单丙',materialNeed=1000,stockAllocatedReceived=300,purchasedQty=700,purchaseWarehouseReceived=500,purchaseFactoryReceived=200,warehouseUntransferred=300,purchaseNotYetWarehouseReceived=200,factoryAvailable=500,unitForMaterial='PCS'),
 task(7,'已正式减量且分批发货',at(5),20,1000,400,'部分发货','正常',at(24),'跟单乙',demandReductionQty=100,demandChangeAt=at(18),demandChangeId='MOCK-DEM-CHANGE-007'),
 task(8,'生产按期，部分客户订单超时',at(2),20,1000,1000,'全部发货','按期完成',at(20),'跟单甲',completedAt=at(20)),
 task(9,'生产需求正式全量取消',at(8),22,500,0,'已终止','不参与当前达成统计',None,'跟单丙',demandReductionQty=500,demandChangeAt=at(12),terminatedAt=at(12),terminationReason='生产需求正式取消'),
 task(10,'规则缺失与进度数据过期',at(7),24,700,0,'生产中','待判定',None,'跟单乙',missingRule='调拨到目标厂路线时效',lastProgressAt=at(15),uncertainty='既有基线可判断当前未逾期，缺少可靠预测'),
]
for t in tasks:
    if t.get('demandReductionQty'):
        t['effectiveQty']=t['originalQty']-t['demandReductionQty']
        t['remainingQty']=max(0,t['effectiveQty']-t['shippedQty'])
    t['progressPct']=round(t['shippedQty']/t['effectiveQty']*100,2) if t['effectiveQty'] else None
    t['hasActualShipmentOrderFacts']=t['shippedQty']>0
    t['knownShipmentOrderScope']='shippedOnly' if t['shippedQty']>0 else 'none'
    t['remainingQtyCustomerOrders']='尚未确定' if t['remainingQty'] else '无剩余应发数量'
tasks[0].update(preparationNo='MOCK-PREP-001',productionOrderNos=['MOCK-PO-001'],ruleVersion='MOCK-RULE-V1',nodes=nodes)

orders=[]
for oid,tid,qty,placed,shipped,sla in [
 ('A',8,300,'2026-09-06T10:00:00+08:00','2026-09-16T10:00:00+08:00',7),
 ('B',8,300,'2026-09-10T10:00:00+08:00','2026-09-16T10:00:00+08:00',7),
 ('C',8,400,'2026-09-01T10:00:00+08:00','2026-09-17T10:00:00+08:00',14),
 ('D',7,200,'2026-09-09T10:00:00+08:00','2026-09-17T10:00:00+08:00',7),
 ('E',7,200,'2026-09-12T10:00:00+08:00','2026-09-17T10:00:00+08:00',7),
]:
    elapsed=(datetime.fromisoformat(shipped)-datetime.fromisoformat(placed)).total_seconds()/86400
    orders.append(dict(orderNo='MOCK-ORDER-'+oid,taskId=f'MOCK-PT-{tid:03}',orderLineId='MOCK-OL-'+oid,
      shipmentId='MOCK-SHP-'+('008-1' if oid in ['A','B'] else '008-2' if oid=='C' else '007-1'),
      placedAt=placed,shippedAt=shipped,associatedAt=shipped,requiredQty=qty,shippedQty=qty,unit='件',
      requiredDays=sla,actualDays=elapsed,overdueDays=max(0,elapsed-sla),source='MOCK实际发货关联记录',
      orderScopeConfirmed=True,allOrderLineIds=['MOCK-OL-'+oid],orderEffectiveQty=qty,
      orderCompletedAt=shipped,orderCompletionType='全部实发'))
active=[t for t in tasks if t['businessState'] not in ['全部发货','已终止']]
stats=dict(totalTasks=len(tasks),activeTasks=len(active),activeHealth=dict(Counter(t['health'] for t in active)),
 completedTasks=1,terminatedTasks=1,activeEffectiveQty=sum(t['effectiveQty'] for t in active),
 activeShippedQty=sum(t['shippedQty'] for t in active),activeRemainingQty=sum(t['remainingQty'] for t in active),
 knownShippedOrders=len(orders),overdueShippedOrders=sum(o['overdueDays']>0 for o in orders),
 knownShippedQty=sum(o['shippedQty'] for o in orders),overdueShippedQty=sum(o['shippedQty'] for o in orders if o['overdueDays']>0))

fixture=dict(schemaVersion='design-1',isMock=True,clock=NOW.isoformat(),timezone='Asia/Shanghai',
 sourceCodeHead='4804328a822eec3c77eee1ffa5b10911bb77c9fe',durationPolicy='continuous-24h-natural-days',
 notices=['所有人员、业务单号、交易数量和日期为设计演示，非线上事实。','预算为Mock；会议规则需定义起止与责任后发布。'],
 stages=stage_data,teams=teams,tasks=tasks,shipmentOrderFacts=orders,statistics=stats,
 assets=[dict(object='SPU-HOODIE-082',name='连帽拉链卫衣',path='/production-confirmation-demo/grey-zip-hoodie.png',
 source='src/data/fcs/production-demands.ts:466',status='沿用明确对象映射；实施时验缩略图和大图'),
 dict(object='MOCK-RAW-001',name='待染原料',path=None,status='缺对应实物素材，实施前必须补齐'),
 dict(object='MOCK-ACC-001',name='中国采购辅料',path=None,status='缺对应实物素材，实施前必须补齐')],
 additionalCases=[
 dict(id='BATCH',readyDays=[16,18,20],qty=[400,400,200],sewingCapacity=200,postCapacity=400,returnTransportDays=.25,shippingDays=.25,shipmentDays=[19.5,21.5,22]),
 dict(id='CANCEL-UNALLOCATED',customerOrder='MOCK-ORDER-X',cancelledQty=100,assignedTask=None,productionQtyChange=0),
 dict(id='FINISH-BY-REDUCTION',originalQty=1000,shippedQty=900,lastShipmentDay=20,reductionQty=100,reductionEffectiveDay=25,closedDay=25,completionType='范围减少后关闭'),
 dict(id='UNKNOWN',legalScenarios=[dict(route='ID现货',special=False,days=20),dict(route='ID现货',special=True,days=23),dict(route='CN采购',special=False,days=24),dict(route='CN采购',special=True,days=24)],note='独立简化场景；非从主任务删一条固定边自动推导'),
 dict(id='CAP-CONFLICT',groupLimitDays=5,childrenNetworkDays=7,expected='规则冲突，不截断，不自动扩限'),
 dict(id='LATE-DONE',dueAt=at(18),finishedAt=at(19),expected='已完成，曾逾期1天'),
 dict(id='ORDER-CLOSE-BY-CANCEL',orderedQty=100,shippedQty=80,lastShipmentDay=18,cancelledQty=20,cancellationDay=21,closedDay=21,completionType='余量取消后关闭',expected='保留部分实发时效；不倒填D18全单发完，不混入纯发货全单及时率'),
 dict(id='RAW-TO-TARGET',inputSku='MOCK-RAW-WHITE',outputSku='MOCK-TARGET-BLACK',rawQty=1000,targetQualifiedQty=0,expected='目标辅料尚未齐套'),
 ])
ROOT.joinpath('mock-data.json').write_text(json.dumps(fixture,ensure_ascii=False,indent=2)+'\n')

rows=['# 冻结 Mock 数据与完整任务实例','',
 '快照：2026-09-17 10:00，Asia/Shanghai。所有业务记录为演示；标准时长不是已发布的线上考核值。',
 '', '## 主任务 MOCK-PT-001：9 个阶段、31 个计时工作实例', '',
 'T0=2026-08-28 10:00；D24=2026-09-21 10:00；当前D20；预测D25=2026-09-22 10:00。D值均相对T0。', '',
 '|阶段|实例数|标准起止D值（允许与其他阶段重叠）|','|---|---:|---|']
for s in stage_data: rows.append(f"|{s['id']} {s['name']}|{s['instanceCount']}|{s['standardStartDay']:g}～{s['standardEndDay']:g}|")
rows += ['', '|工作项|责任团队／人|前置|标准天数|标准起止D|实际起止D|当前状态|合格数量／要求|预测结束D|', '|---|---|---|---:|---|---|---|---|---:|']
for n in nodes:
    actual=f"{n['standardStartDay']:g}～{n['standardEndDay']:g}" if n['businessState']=='已完成' else ('16～进行中（已用4天）' if n['id']=='W29' else '尚未开始')
    rows.append(f"|{n['id']} {n['name']}|{n['team']}／{n['owner']}|{','.join(n['predecessors']) or 'T0'}|{n['durationDays']:g}|{n['standardStartDay']:g}～{n['standardEndDay']:g}|{actual}|{n['businessState']}；{n['timeState']}|{n['qualifiedQty']}/{n['requiredQty']} {n['unit']}|{(datetime.fromisoformat(n['predictedEndAt'])-T0).total_seconds()/86400:g}|")
rows += ['', 'W10是调拨出库动作，其内部操作事件不另起计时节点；W29包含到后道的合格回货交接，W30包含后道、质检及成衣入库，W31包含拣配复核到实际发货。三个组代理的21个子动作已在JSON列出团队、数量、状态，但尚无独立子预算，细化后替换代理，不叠加计时。主例MOCK-RELEASE-001选择整批1000件进入后道，故已有400件回货时W30仍等齐批；此为演示选择，非通用强制门槛。允许分批的路线必须采用BATCH场景的释放逻辑。W28仅为厂内配套，不重复计算W19的外部调拨运输。',
 '', '## 十笔任务及大屏对账', '', '|任务|场景|跟单|业务状态／时效|有效应发|实发|剩余|当前截止|预计全部发货|', '|---|---|---|---|---:|---:|---:|---|---|']
for t in tasks:
    rows.append(f"|{t['id']}|{t['scenario']}|{t['follower']}|{t['businessState']}／{t['health']}|{t['effectiveQty']}|{t['shippedQty']}|{t['remainingQty']}|{t['effectiveDueAt'] or '待确认；20～24天'}|{t['predictedFinishAt'] or '未知'}|")
rows += ['', '```json',json.dumps(stats,ensure_ascii=False,indent=2),'```','', '## 发货后才出现的订单明细','',
 '|订单|生产任务|实际关联／发货时刻|客户下单时刻|数量|要求天数|实际天数|逾期天数|', '|---|---|---|---|---:|---:|---:|---:|']
for o in orders:
    rows.append(f"|{o['orderNo']}|{o['taskId']}|{o['shippedAt']}|{o['placedAt']}|{o['shippedQty']}|{o['requiredDays']}|{o['actualDays']:g}|{o['overdueDays']:g}|")
rows += ['', '上述5个客户订单仅存在于实际发货记录中。其余未发货任务的客户订单集合为“尚未建立”，不是0个待发订单。订单超时率=3/5=60%；按本次发货数量加权的超时占比=900/1400=64.29%。不能把这两个指标混称为同一种及时率。', '',
 '## 其他边界场景','', '|场景|输入与预期|','|---|---|']
for c in fixture['additionalCases']: rows.append('|'+c['id']+'|'+json.dumps(c,ensure_ascii=False)+'|')
ROOT.joinpath('mock-scenarios.md').write_text('\n'.join(rows)+'\n')

# Static diagram intentionally shows task identifiers, no substitute style/material images.
fontpath='/System/Library/Fonts/STHeiti Light.ttc'
def font(size): return ImageFont.truetype(fontpath,size)
W=1800; rowh=54; top=280; H=top+len(nodes)*rowh+220
im=Image.new('RGB',(W,H),'#f6f8fc'); d=ImageDraw.Draw(im)
def txt(x,y,text,size=21,color='#172b4d'): d.text((x,y),str(text),font=font(size),fill=color)
d.rounded_rectangle((24,24,W-24,205),18,fill='white')
txt(48,42,'生产与履约时效 · 单任务分层甘特图',34)
txt(48,94,'MOCK-PT-001  |  主跟单：跟单甲  |  快照：2026-09-17 10:00（D20）',23)
txt(48,138,'整体要求 D24  ·  当前未逾期  ·  预计 D25 全部发货，风险 +1 天  ·  已发货 0 / 1,000 件',25,'#a54c00')
txt(48,174,'设计示意｜9阶段、31个计时实例｜自然日｜组代理有内部动作，尚未分配子预算',18,'#52627a')
left=760; right=1750; unit=(right-left)/26
def x(day): return left+day*unit
txt(38,225,'工作项（按阶段分组）',22); txt(402,225,'责任团队',22);txt(556,225,'合格/要求 · SLA',20)
for tick in [0,2,4,6,8,10,12,14,16,18,20,22,24,26]:
    xx=x(tick);d.line((xx,top-10,xx,H-160),fill='#dfe5ed',width=1);txt(xx-15,240,f'D{tick}',16)
colours={'已完成':'#198569','进行中':'#2675c9','未到可执行时间':'#94a3b8'}
previous=None
for i,n in enumerate(nodes):
    y=top+i*rowh
    d.rectangle((28,y,W-28,y+rowh),fill='white' if i%2==0 else '#f1f5fa')
    if n['stage']!=previous: d.line((28,y,W-28,y),fill='#9bacbf',width=2)
    previous=n['stage']
    txt(38,y+8,n['stage']+' '+n['id']+' '+n['name'],19)
    txt(402,y+8,n['team'],19)
    txt(556,y+8,f"{n['qualifiedQty']}/{n['requiredQty']} · {n['durationDays']:g}天",17)
    a=n['standardStartDay']; b=n['standardEndDay']
    d.rounded_rectangle((x(a),y+8,max(x(a)+3,x(b)),y+15),3,fill='#c9d2df')
    if n['actualStartAt']:
        e=b if n['actualEndAt'] else 20
        d.rounded_rectangle((x(a),y+23,max(x(a)+3,x(e)),y+36),4,fill=colours[n['businessState']])
    f=(datetime.fromisoformat(n['predictedEndAt'])-T0).total_seconds()/86400
    if f>20:
        s=20 if n['id']=='W29' else f-n['durationDays']
        xa=x(s); xb=x(f)
        for xx in range(int(xa),int(xb),9):d.line((xx,y+29,min(xx+5,xb),y+29),fill='#da8500',width=4)
        d.line((xb,y+22,xb,y+36),fill='#da8500',width=2)
        txt(min(xb+6,W-105),y+16,'预测'+str(int(f)),16,'#9c5a00')
    if n['id'] in ['W01','W12','W13','W14','W15','W16','W17','W18','W19','W28','W29','W30','W31']:
        d.rectangle((x(a)-2,y+5,max(x(a)+5,x(b)+2),y+40),outline='#536277',width=1)
for day,label,c in [(20,'当前 D20','#2463a7'),(24,'要求 D24','#27364f'),(25,'预测 D25','#bd6d00')]:
    xx=x(day);d.line((xx,top-6,xx,H-160),fill=c,width=2);txt(xx-55,H-146,label,18,c)
txt(42,H-105,'灰细条：标准时间    绿实线：已完成    蓝实线：实际进行中    橙虚线：预测剩余    深色边框：标准关键路径',21)
txt(42,H-67,'实际图支持展开阶段/组内动作、前置连线、数量批次、计算公式和责任明细；颜色同时配文字，避免只凭颜色判断。',20,'#52627a')
im.save(ROOT/'assets/task-timeline.png')

# A compact overview for discussion, generated anew from the same underlying nodes.
summary=[('准备与技术发布','跟单/版房/调色',0,4,4,'已完成'),
 ('原料现货调拨到染厂','仓储/物流',0,2,2,'已到厂'),
 ('面料染色与到裁厂','染厂/物流',3,8,8,'已完成'),
 ('中国辅料采购到入库','采购/物流/仓储',0,11,11,'已入库'),
 ('辅料调拨到车缝厂','仓储/物流',11,15,15,'已到厂'),
 ('生产建单与下发','计划',4,5,5,'已完成'),
 ('配料及裁床','裁厂',8,11,11,'已完成'),
 ('特殊工艺','特殊工艺厂',11,14,14,'已完成'),
 ('厂内配套分单','计划/车缝厂',15,16,16,'已完成'),
 ('车缝及合格回货','车缝厂A',16,22,23,'400/1000；预计晚1天'),
 ('后道质检与入库','后道/质检/仓储',22,23,24,'等待齐批；受上游影响'),
 ('实际发货','履约仓',23,24,25,'0/1000；预计晚1天')]
sw,sh=1720,1100; sim=Image.new('RGB',(sw,sh),'#f5f7fb'); sd=ImageDraw.Draw(sim)
def st(xv,yv,t,size=20,color='#18304f'): sd.text((xv,yv),t,font=font(size),fill=color)
sd.rounded_rectangle((24,24,sw-24,185),16,fill='white')
st(44,40,'生产与履约时效｜跟单首屏图示',34)
st(44,94,'MOCK-PT-001 · 9阶段 / 31计时项（摘要展开为12条关键工作线）',23)
st(44,135,'当前 D20｜要求 D24｜预测 D25｜实际逾期 0 天｜预计延误 1 天',26,'#a96000')
sx0=650; su=(1670-sx0)/26
def sx(v):return sx0+su*v
st(40,216,'工作 / 责任团队',22);st(320,216,'当前结果',22)
for tick in range(0,27,2):st(sx(tick)-12,218,'D'+str(tick),16)
for i,(name,team,a,b,forecast,label) in enumerate(summary):
    y=255+i*57
    sd.rounded_rectangle((28,y,sw-28,y+53),4,fill='white')
    st(40,y+5,name,21);st(40,y+30,team,16,'#627187')
    st(320,y+14,label,20,'#a96000' if forecast>b else '#168268')
    sd.rectangle((sx(a),y+8,max(sx(a)+3,sx(b)),y+14),fill='#c3ccd8')
    if a<20:
        sd.rounded_rectangle((sx(a),y+25,sx(min(b,20)),y+37),4,fill='#168268' if b<=20 else '#2676c8')
    if forecast>20:
        start=20 if a<20 else forecast-(b-a)
        for xx in range(int(sx(start)),int(sx(forecast)),10):sd.line((xx,y+31,min(xx+6,sx(forecast)),y+31),fill='#d88700',width=4)
for day,col in [(20,'#2872bf'),(24,'#22344e'),(25,'#cc7900')]:sd.line((sx(day),250,sx(day),945),fill=col,width=2)
st(40,963,'灰细条 标准    绿实线 已完成    蓝实线 实际进行中    橙虚线 预测剩余',21)
st(40,1004,'卡点：余600件 ÷ 当前200件/日 = 3天；守D22需300件/日，能力缺口100件/日。',23,'#a96000')
st(40,1045,'全程公式：max(裁片及工艺14, 辅料到厂15) + 配套1 + 回货6 + 后道1 + 实发1 = 24自然日',21)
sim.save(ROOT/'assets/follower-overview.png')

assert len(nodes)==31 and by_id['W31']['standardEndDay']==24
assert by_id['W19']['standardEndDay']==15 and by_id['W22']['standardEndDay']==8
assert stats['activeTasks']==8 and sum(stats['activeHealth'].values())==8
assert stats['activeEffectiveQty']==7000 and stats['activeShippedQty']==400 and stats['activeRemainingQty']==6600
assert stats['knownShippedQty']==1400 and stats['overdueShippedQty']==900
for t in tasks:
    assert t['effectiveQty']==t['shippedQty']+t['remainingQty']
    assert t['hasActualShipmentOrderFacts']==any(o['taskId']==t['id'] for o in orders)
    assert sum(o['shippedQty'] for o in orders if o['taskId']==t['id'])==t['shippedQty']
for n in nodes:
    assert all(by_id[p]['standardEndDay']<=n['standardStartDay'] for p in n['predecessors'])
    assert n['actualOverdueDays']==0
assert (datetime.fromisoformat(at(24))-T0).total_seconds()/86400==24
print(json.dumps({'validation':'passed','nodes':len(nodes),'stageCounts':{s['id']:s['instanceCount'] for s in stage_data},'statistics':stats},ensure_ascii=False,indent=2))
