/** Linked prototype fixtures. No confirmation is seeded; warehouse actions remain user actions. */
import { productionOrders } from '../production-orders.ts'
import { processTasks } from '../process-tasks.ts'
import { applyGreyHoodieConfirmationFixture } from '../production-tech-pack-snapshot-builder.ts'
import { clearRuntimeProcessTasksCache, listRuntimeProcessTasks, allocateRuntimeSkuTaskScope, captureRuntimeDirectDispatchState, restoreRuntimeDirectDispatchState, createFixedMergedTask } from '../runtime-process-tasks.ts'
import { listSewingFactoryMasterRecords, getFactoryActivePpicSnapshot } from '../factory-master-store.ts'
import { DEDICATED_CUTTING_FACTORY_ID, KOL_GOTO_FACTORY_ID, TEST_FACTORY_ID } from '../factory-mock-data.ts'
import { listGeneratedCutOrderSourceRecords } from './generated-cut-orders.ts'
import { appendCuttingRuntimeEventIdempotent, listCuttingRuntimeEvents } from './cutting-runtime-event-ledger.ts'
import { resolveDispatchTaskSheet, listDispatchTaskSheetAssignments, buildDispatchTaskSheetData } from '../dispatch-task-sheet.ts'
import { cancelEffectiveTaskAssignment } from '../effective-task-assignments.ts'
import { listSpreadingResultGeneratedFeiTickets } from './generated-fei-tickets.ts'
import { appendWaitHandoverBaggingEvent, buildWaitHandoverRuntimeTicketFromGeneratedTicket } from '../../../pages/process-factory/cutting/wait-handover-runtime.ts'
import { listCuttingSpecialCraftFeiTicketBindings, createSpecialCraftDispatchHandoverFromFeiTickets, markSpecialCraftFactoryReceivedFromHandover, linkSpecialCraftCompletionToReturnWaitHandoverStock, createSpecialCraftReturnHandover, receiveSpecialCraftReturnToCuttingWaitHandoverWarehouse, refreshGeneratedSpecialCraftFeiTicketBindings } from './special-craft-fei-ticket-flow.ts'
import { captureSpecialCraftTaskStore, restoreSpecialCraftTaskStore } from '../special-craft-task-orders.ts'
import { getBrowserLocalStorage } from '../../browser-storage.ts'

export const SIMPLE_CUT_PIECE_DEMO_ORDER_ID = 'PO-DEMO-SIMPLE-0916'
const stamp = '2026-09-16 09:00:00'
let initializing = false
let initialized = false
export function ensureSimpleCutPieceHandoverFixtures(): void {
  if (initializing || initialized) return
  initializing = true
  try {
    const base = productionOrders.find(order => order.productionOrderId === 'PO-202603-082')
    if (!base?.techPackSnapshot) throw new Error('简易裁片演示缺少卫衣上游技术资料')
    if (!productionOrders.some(order => order.productionOrderId === SIMPLE_CUT_PIECE_DEMO_ORDER_ID)) {
      const order = structuredClone(base)
      order.productionOrderId = SIMPLE_CUT_PIECE_DEMO_ORDER_ID
      order.productionOrderNo = SIMPLE_CUT_PIECE_DEMO_ORDER_ID
      order.demandSnapshot.spuName = '连帽拉链卫衣'
      order.demandSnapshot.skuLines = [{skuCode:'SKU-SIMPLE-M-GRY',color:'雾霾灰',size:'M',qty:100},{skuCode:'SKU-SIMPLE-L-GRY',color:'雾霾灰',size:'L',qty:80}]
      order.demandSnapshot.constraintsNote = '简易裁片交出演示：不同工厂完整 SKU 分配，首批帽片未裁。'
      const snapshot = order.techPackSnapshot!
      snapshot.productionOrderId = order.productionOrderId
      snapshot.productionOrderNo = order.productionOrderNo
      snapshot.snapshotId = 'TPS-' + order.productionOrderId
      snapshot.bomItems.forEach(item => { item.applicableSkuCodes = order.demandSnapshot.skuLines.map(line => line.skuCode) })
      applyGreyHoodieConfirmationFixture(snapshot)
      order.sourceDemandSnapshots = [structuredClone(order.demandSnapshot)]
      order.createdAt = stamp
      order.updatedAt = stamp
      productionOrders.push(order)
    }
    const baseTasks = processTasks.filter(task => task.productionOrderId === base.productionOrderId)
    for (const code of ['PROC_CUT','PROC_SEW']) {
      const taskId = `TASK-SIMPLE-0916-${code}`
      if (processTasks.some(task => task.taskId === taskId)) continue
      const source = baseTasks.find(task => task.processCode === code)
      if (!source) throw new Error('简易裁片演示缺少裁剪/车缝任务模板')
      const task = structuredClone(source)
      Object.assign(task,{taskId,taskNo:taskId,rootTaskNo:taskId,productionOrderId:SIMPLE_CUT_PIECE_DEMO_ORDER_ID,productionOrderNo:SIMPLE_CUT_PIECE_DEMO_ORDER_ID,qty:180,detailRows:[],detailRowKeys:[],dependsOnTaskIds:[],createdAt:stamp,updatedAt:stamp,status:'NOT_STARTED',assignmentStatus:code==='PROC_CUT'?'ASSIGNED':'UNASSIGNED',assignedFactoryId:code==='PROC_CUT'?DEDICATED_CUTTING_FACTORY_ID:undefined,assignedFactoryName:code==='PROC_CUT'?'自营裁床':undefined,dispatchedAt:stamp,businessAssignedAt:stamp,acceptanceStatus:'PENDING',taskQrValue:undefined})
      processTasks.push(task)
    }
    clearRuntimeProcessTasksCache()
    let tasks = listRuntimeProcessTasks().filter(task => task.productionOrderId === SIMPLE_CUT_PIECE_DEMO_ORDER_ID && task.processCode === 'PROC_SEW' && !task.isSplitSource)
    if (tasks.length === 1 && tasks[0].assignmentStatus === 'UNASSIGNED' && tasks[0].scopeSkuLines.length === 2) {
      allocateRuntimeSkuTaskScope({taskId:tasks[0].taskId,lines:[{skuCode:'SKU-SIMPLE-M-GRY',qty:100}],by:'演示初始化',operatedAt:stamp})
      tasks = listRuntimeProcessTasks().filter(task => task.productionOrderId === SIMPLE_CUT_PIECE_DEMO_ORDER_ID && task.processCode === 'PROC_SEW' && !task.isSplitSource)
    }
    const factories = listSewingFactoryMasterRecords().filter(factory => factory.factoryType === 'THIRD_SEWING' && factory.id !== KOL_GOTO_FACTORY_ID && !factory.isTestFactory && getFactoryActivePpicSnapshot(factory.id)).filter((factory,index,all) => all.findIndex(other => getFactoryActivePpicSnapshot(other.id)?.ppicId === getFactoryActivePpicSnapshot(factory.id)?.ppicId) === index)
    tasks.forEach(task => {
      if (task.assignmentStatus !== 'UNASSIGNED') return
      const index = task.scopeSkuLines[0]?.size === 'M' ? 0 : 1
      const factory = factories[index]
      if (!factory) throw new Error('简易裁片演示需要两个分别绑定 PPIC 的车缝工厂')
      // Import an explicit already-assigned demo snapshot; normal dispatch gates are unchanged.
      const state = captureRuntimeDirectDispatchState()
      const prior = state.taskOverrides.find(([id]) => id === task.taskId)?.[1] ?? {}
      state.taskOverrides = state.taskOverrides.filter(([id]) => id !== task.taskId)
      state.taskOverrides.push([task.taskId,{...prior,assignmentMode:'DIRECT',assignmentStatus:'ASSIGNED',assignedFactoryId:factory.id,assignedFactoryName:factory.name,dispatchedAt:stamp,businessAssignedAt:stamp,dispatchedBy:'人工分配演示',dispatchPrice:1000,acceptanceStatus:'PENDING',status:'NOT_STARTED',updatedAt:stamp}])
      restoreRuntimeDirectDispatchState(state)
    })
    ensureAdditionalTaskSheetDemoScenarios()
    if (getBrowserLocalStorage()) { appendSimpleCutPieceDemoCuttingBatch(1); appendSimpleCutPieceDemoCuttingBatch(1,'PO-DEMO-SEW-IRON-0916') }
    initialized = true
  } finally { initializing = false }
}

export const SIMPLE_TASK_SHEET_DEMO_VARIANTS = [
  {orderId:'PO-DEMO-SEW-IRON-0916',mode:'SEW_IRON'},
  {orderId:'PO-DEMO-TRIPLE-0916',mode:'TRIPLE'},
  {orderId:'PO-DEMO-UNASSIGNED-0916',mode:'UNASSIGNED'},
] as const
function ensureAdditionalTaskSheetDemoScenarios() {
  const base = productionOrders.find(order=>order.productionOrderId===SIMPLE_CUT_PIECE_DEMO_ORDER_ID)!
  const source = processTasks.find(task=>task.taskId==='TASK-SIMPLE-0916-PROC_SEW')!
  const factories = listSewingFactoryMasterRecords().filter(factory=>factory.factoryType==='THIRD_SEWING' && factory.id!==KOL_GOTO_FACTORY_ID && !factory.isTestFactory && getFactoryActivePpicSnapshot(factory.id))
  for (const variant of SIMPLE_TASK_SHEET_DEMO_VARIANTS) {
    if (!productionOrders.some(order=>order.productionOrderId===variant.orderId)) {
      const order = structuredClone(base)
      order.productionOrderId=variant.orderId;order.productionOrderNo=variant.orderId
      order.techPackSnapshot!.productionOrderId=variant.orderId;order.techPackSnapshot!.productionOrderNo=variant.orderId
      order.techPackSnapshot!.snapshotId='TPS-'+variant.orderId
      order.demandSnapshot.constraintsNote='任务单打印关联演示：'+variant.mode
      productionOrders.push(order)
    }
    const codes = variant.mode==='TRIPLE'?['CUT_PANEL','SEW','IRON_PACK']:variant.mode==='SEW_IRON'?['CUT_PANEL','SEW','IRON_PACK']:['SEW']
    for (const code of codes) {
      const id=`TASK-${variant.orderId}-${code}`
      if(processTasks.some(task=>task.taskId===id)) continue
      const name=code==='CUT_PANEL'?'裁片':code==='SEW'?'车缝':'烫包'
      const task=structuredClone(source)
      Object.assign(task,{taskId:id,taskNo:id,rootTaskNo:id,productionOrderId:variant.orderId,productionOrderNo:variant.orderId,processCode:code==='SEW'?'PROC_SEW':code==='CUT_PANEL'?'PROC_CUT':'IRON_PACK',processBusinessCode:code,processBusinessName:name,processNameZh:name,taskCategoryZh:name,seq:codes.indexOf(code)+1,assignmentStatus:'UNASSIGNED',assignedFactoryId:undefined,assignedFactoryName:undefined,taskUnitType:'SINGLE_PROCESS_TASK',coveredProcesses:[{processCode:code,processName:name,sourceArtifactIds:[]}],stageCode:'PROD',detailRows:[],detailRowKeys:[],dependsOnTaskIds:[]})
      if(variant.mode==='SEW_IRON' && code==='CUT_PANEL') Object.assign(task,{assignmentStatus:'ASSIGNED',assignedFactoryId:DEDICATED_CUTTING_FACTORY_ID,assignedFactoryName:'自营裁床'})
      processTasks.push(task)
    }
    clearRuntimeProcessTasksCache()
    if(variant.mode==='UNASSIGNED') continue
    let tasks=listRuntimeProcessTasks().filter(task=>task.productionOrderId===variant.orderId && task.executionEnabled!==false && !task.mergedIntoTaskId && !task.isSplitSource)
    let merged=tasks.find(task=>task.taskUnitType==='MERGED_PRODUCTION_TASK')
    if(!merged) merged=createFixedMergedTask(tasks.filter(task=>variant.mode==='TRIPLE'||task.processBusinessCode!=='CUT_PANEL').map(task=>task.taskId),'演示初始化')??undefined
    if(!merged) throw new Error('关联演示合并任务生成失败：'+variant.orderId)
    if(merged.assignmentStatus!=='UNASSIGNED') continue
    const state=captureRuntimeDirectDispatchState()
    const factory=factories[0]
    const prior=state.taskOverrides.find(([id])=>id===merged!.taskId)?.[1]??{}
    state.taskOverrides=state.taskOverrides.filter(([id])=>id!==merged!.taskId)
    state.taskOverrides.push([merged.taskId,{...prior,assignmentMode:variant.mode==='SEW_IRON'?'BIDDING':'DIRECT',assignmentStatus:variant.mode==='SEW_IRON'?'AWARDED':'ASSIGNED',awardedAt:variant.mode==='SEW_IRON'?stamp:undefined,biddingDeadline:variant.mode==='SEW_IRON'?'2026-09-15 18:00:00':undefined,assignedFactoryId:factory.id,assignedFactoryName:factory.name,dispatchedAt:stamp,businessAssignedAt:stamp,dispatchedBy:variant.mode==='SEW_IRON'?'竞价中标演示':'人工分配演示',dispatchPrice:1000,acceptanceStatus:'PENDING',status:'NOT_STARTED',updatedAt:stamp}])
    restoreRuntimeDirectDispatchState(state)
  }
}

/** Second batch is explicit: never silently completes missing cuts on refresh. */
export function appendSimpleCutPieceDemoCuttingBatch(batch: 1 | 2 = 2, orderId: string = SIMPLE_CUT_PIECE_DEMO_ORDER_ID) {
  const order = productionOrders.find(order => order.productionOrderId === orderId)
  if (!order?.techPackSnapshot) throw new Error('请先初始化简易裁片演示')
  const source = listGeneratedCutOrderSourceRecords().find(row => row.productionOrderId === orderId)
  if (!source) throw new Error('演示裁剪任务未生成有效裁片单')
  const idempotencyKey = `simple-demo-cutting-${orderId}-${batch}`
  const prior = listCuttingRuntimeEvents().find(event => event.idempotencyKey === idempotencyKey)
  if (prior) return {event:prior,appended:false}
  const parts = order.techPackSnapshot.cutPieceParts.filter(part => batch === 1 ? part.partCode !== 'HOOD' : part.partCode === 'HOOD')
  return appendCuttingRuntimeEventIdempotent({idempotencyKey,eventType:'完成裁剪',eventSource:'MOCK',operatorId:'DEMO-CUTTER',operatorName:'演示裁床组长',operatorRole:'裁床组长',occurredAt:batch===1?stamp:'2026-09-16 14:00:00',refs:{productionOrderId:order.productionOrderId,productionOrderNo:order.productionOrderNo,cutOrderId:source.cutOrderId,cutOrderNo:source.cutOrderNo,spreadingOrderId:`SPREAD-${orderId}-${batch}`,spreadingOrderNo:`SPREAD-${orderId}-${batch}`},payload:{spreadingOrderId:`SPREAD-${orderId}-${batch}`,spreadingOrderNo:`SPREAD-${orderId}-${batch}`,cuttingCompletedAt:stamp,cuttingCompletedBy:'演示裁床组长',actualMaterialUsage:batch===1?180:36,actualMaterialUsageUnit:'yard',outputLines:order.demandSnapshot.skuLines.flatMap(sku => parts.map(part => ({outputId:`SIMPLE-OUTPUT-${orderId}-${batch}-${sku.size}-${part.partCode}`,color:sku.color,size:sku.size,partCode:part.partCode,partName:part.partNameCn,actualPieceQty:sku.qty*part.pieceCountPerGarment,actualGarmentQty:sku.qty,unit:'片' as const}))),hasDifference:false,differenceTypes:[]}})
}

/** Opt-in boundary facts for demonstrations; never alter the normal opening inventory. */
export function appendSimpleCutPieceDemoBoundaryCutting(scenario: 'OVER_REMAINING' | 'UNMATCHED_PART') {
  const source = listGeneratedCutOrderSourceRecords().find(row=>row.productionOrderId===SIMPLE_CUT_PIECE_DEMO_ORDER_ID)
  if(!source) throw new Error('请先初始化简易裁片演示')
  const suffix = scenario === 'OVER_REMAINING' ? 'EXCESS' : 'UNKNOWN'
  return appendCuttingRuntimeEventIdempotent({idempotencyKey:`simple-demo-boundary-${scenario}`,eventType:'完成裁剪',eventSource:'MOCK',operatorId:'DEMO-CUTTER',operatorName:'演示裁床组长',operatorRole:'裁床组长',occurredAt:'2026-09-16 15:00:00',refs:{productionOrderId:SIMPLE_CUT_PIECE_DEMO_ORDER_ID,productionOrderNo:SIMPLE_CUT_PIECE_DEMO_ORDER_ID,cutOrderId:source.cutOrderId,cutOrderNo:source.cutOrderNo,spreadingOrderId:`SPREAD-SIMPLE-${suffix}`,spreadingOrderNo:`SPREAD-SIMPLE-${suffix}`},payload:{spreadingOrderId:`SPREAD-SIMPLE-${suffix}`,spreadingOrderNo:`SPREAD-SIMPLE-${suffix}`,cuttingCompletedAt:'2026-09-16 15:00:00',cuttingCompletedBy:'演示裁床组长',actualMaterialUsage:1,actualMaterialUsageUnit:'yard',outputLines:[{outputId:`SIMPLE-BOUNDARY-${suffix}`,color:'雾霾灰',size:'M',partCode:scenario==='OVER_REMAINING'?'FRONT-L':'UNMATCHED-DEMO-PART',partName:scenario==='OVER_REMAINING'?'左前片':'未纳入本任务的演示部位',actualPieceQty:scenario==='OVER_REMAINING'?101:1,actualGarmentQty:scenario==='OVER_REMAINING'?101:1,unit:'片'}],hasDifference:true,differenceTypes:['其他异常']}})
}

/** Explicit old-paper scenario: only a demo assignment can be cancelled here. */
export function cancelSimpleCutPieceDemoTaskSheet(taskSheetNo: string) {
  const sheet = resolveDispatchTaskSheet(taskSheetNo)
  if(!sheet.assignment.productionOrderId.startsWith('PO-DEMO-')) throw new Error('该场景只允许操作本次演示订单')
  cancelEffectiveTaskAssignment(sheet.assignment.assignmentId,'演示旧纸失效场景','演示计划员','2026-09-16 16:00:00')
  return {oldTaskSheetNo:sheet.taskSheetNo,assignmentId:sheet.assignment.assignmentId,message:'分配已取消，旧纸不再允许交出；历史记录保留。'}
}

/** Explicit MOCK-005 scenario. Keeps the normal M/L and merged-task inventory unchanged. */
export function initializeSimpleCutPieceBagDemo() {
  ensureSimpleCutPieceHandoverFixtures()
  const orderId = 'PO-DEMO-SIMPLE-BAG-0916'
  if (!productionOrders.some(order => order.productionOrderId === orderId)) {
    const order = structuredClone(productionOrders.find(order => order.productionOrderId === SIMPLE_CUT_PIECE_DEMO_ORDER_ID)!)
    Object.assign(order, { productionOrderId: orderId, productionOrderNo: orderId })
    Object.assign(order.techPackSnapshot!, { productionOrderId: orderId, productionOrderNo: orderId, snapshotId: 'TPS-' + orderId })
    productionOrders.push(order)
    const factory = listSewingFactoryMasterRecords().find(item => item.factoryType === 'THIRD_SEWING' && item.id !== KOL_GOTO_FACTORY_ID && !item.isTestFactory && getFactoryActivePpicSnapshot(item.id))!
    for (const code of ['PROC_CUT', 'PROC_SEW']) {
      const template = processTasks.find(task => task.taskId === `TASK-SIMPLE-0916-${code}`)!
      const task = structuredClone(template)
      const id = `TASK-SIMPLE-BAG-0916-${code}`
      Object.assign(task, { taskId:id, taskNo:id, rootTaskNo:id, productionOrderId:orderId, productionOrderNo:orderId, assignmentStatus:'ASSIGNED', assignedFactoryId:code==='PROC_CUT'?DEDICATED_CUTTING_FACTORY_ID:factory.id, assignedFactoryName:code==='PROC_CUT'?'自营裁床':factory.name, dispatchedBy:code==='PROC_CUT'?'系统自动分配（固定裁床）':'人工分配演示', businessAssignedAt:stamp, dispatchedAt:stamp, updatedAt:stamp })
      processTasks.push(task)
    }
    clearRuntimeProcessTasksCache()
  }
  appendSimpleCutPieceDemoCuttingBatch(1, orderId)
  const ticket = listSpreadingResultGeneratedFeiTickets().find(ticket => ticket.productionOrderId === orderId && ticket.skuSize === 'M' && ticket.partCode === 'BACK')!
  const bagCode = 'TB-SIMPLE-MOCK005-0916'
  const event = appendWaitHandoverBaggingEvent({ source:'MOCK', operator:{operatorId:'DEMO-WAREHOUSE',operatorName:'演示裁床仓管',operatorRole:'WAREHOUSE'}, bagCode, tickets:[buildWaitHandoverRuntimeTicketFromGeneratedTicket(ticket)], occurredAt:stamp, idempotencyKey:'simple-demo-bag-0916' })
  const sheets = listDispatchTaskSheetAssignments().filter(row => row.productionOrderId === orderId).map(row => buildDispatchTaskSheetData(row.assignmentId))
  return { orderId, bagCode, feiTicketNo:ticket.feiTicketNo, eventId:event.eventId, taskSheetNo:sheets.find(sheet=>sheet.supportsCutPieceHandover)!.taskSheetNo, automaticCuttingTaskSheetNo:sheets.find(sheet=>!sheet.supportsCutPieceHandover)!.taskSheetNo, warehousePath:'/fcs/craft/cutting/warehouse-management/wait-handover' }
}

/** Existing TEST_FACTORY craft-only demonstration. This does not claim eligibility for dedicated-cutting simple handover. All movement uses real flow commands. */
export function advanceSimpleCutPieceSpecialCraftDemo(stage: 'OUTSIDE' | 'RETURNED') {
  const bindings = listCuttingSpecialCraftFeiTicketBindings()
  const selected = bindings.find(item => item.specialCraftFlowStatus === '待发料' && !bindings.some(other=>other.feiTicketNo===item.feiTicketNo && other.bindingId!==item.bindingId))
  if (!selected) throw new Error('当前没有可供演示的单工艺待发料菲票，请使用全新演示会话。')
  return moveSimpleCutPieceSpecialCraftDemo(selected.bindingId, stage)
}

export function moveSimpleCutPieceSpecialCraftDemo(bindingId: string, stage: 'OUTSIDE' | 'RETURNED') {
  let binding = listCuttingSpecialCraftFeiTicketBindings().find(item=>item.bindingId===bindingId)
  if (!binding) throw new Error('未找到演示特殊工艺菲票')
  if (binding.specialCraftFlowStatus === '待发料') {
    createSpecialCraftDispatchHandoverFromFeiTickets({cuttingFactoryId:binding.cuttingFactoryId || TEST_FACTORY_ID,cuttingFactoryName:'自营裁床',targetFactoryId:binding.targetFactoryId,targetFactoryName:binding.targetFactoryName,operationId:binding.operationId,operationName:binding.operationName,selectedFeiTicketNos:[binding.feiTicketNo],operatorName:'演示裁床仓管',submittedAt:stamp})
    binding = listCuttingSpecialCraftFeiTicketBindings().find(item=>item.bindingId===bindingId)!
  }
  if (stage === 'RETURNED' && binding.specialCraftFlowStatus !== '已回仓') {
    markSpecialCraftFactoryReceivedFromHandover({handoverRecordId:binding.dispatchHandoverRecordId!,receivedFeiTicketNos:[binding.feiTicketNo],receiverWrittenQty:binding.currentQty,receiverName:'演示工艺仓管',receivedAt:stamp})
    linkSpecialCraftCompletionToReturnWaitHandoverStock({taskOrderId:binding.taskOrderId,completedFeiTicketNos:[binding.feiTicketNo],completedQty:binding.currentQty,operatorName:'演示工艺组长',completedAt:stamp})
    const result = createSpecialCraftReturnHandover({specialCraftFactoryId:binding.targetFactoryId,specialCraftFactoryName:binding.targetFactoryName,cuttingFactoryId:binding.cuttingFactoryId || TEST_FACTORY_ID,cuttingFactoryName:'自营裁床',operationId:binding.operationId,operationName:binding.operationName,selectedFeiTicketNos:[binding.feiTicketNo],operatorName:'演示工艺仓管',submittedAt:stamp})
    receiveSpecialCraftReturnToCuttingWaitHandoverWarehouse({returnHandoverRecordId:result.handoverRecord.handoverRecordId || result.handoverRecord.recordId,receivedFeiTicketNos:[binding.feiTicketNo],receiverWrittenQty:binding.currentQty,receiverName:'演示裁床仓管',receivedAt:stamp})
  }
  return listCuttingSpecialCraftFeiTicketBindings().find(item=>item.bindingId===bindingId)!
}

/** Dedicated-cutting actual output -> special craft -> returned -> simple handover candidate. */
export function initializeSimpleCutPieceSpecialCraftDemo() {
  ensureSimpleCutPieceHandoverFixtures()
  const orderId = 'PO-DEMO-SIMPLE-CRAFT-0916'
  const taskStore = captureSpecialCraftTaskStore()
  const template = taskStore.taskOrders.find(task => task.targetObject === '已裁部位' && task.demandLines?.length && task.operationName === '花朵加工')
    || taskStore.taskOrders.find(task => task.targetObject === '已裁部位' && task.demandLines?.length)!
  if (!template) throw new Error('缺少可用特殊工艺模板')
  if (!productionOrders.some(order=>order.productionOrderId===orderId)) {
    const order = structuredClone(productionOrders.find(order=>order.productionOrderId===SIMPLE_CUT_PIECE_DEMO_ORDER_ID)!)
    Object.assign(order,{productionOrderId:orderId,productionOrderNo:orderId})
    Object.assign(order.techPackSnapshot!,{productionOrderId:orderId,productionOrderNo:orderId,snapshotId:'TPS-'+orderId})
    const craft = { processCode:template.processCode,processName:template.processName,craftCode:template.craftCode,craftName:template.operationName,displayName:template.operationName,selectedTargetObject:'已裁部位' as const,supportedTargetObjects:['CUT_PIECE' as const],supportedTargetObjectLabels:['已裁部位' as const] }
    order.techPackSnapshot!.cutPieceParts.find(part=>part.partCode==='FRONT-L')!.specialCrafts=[craft]
    order.techPackSnapshot!.patternFiles.forEach(pattern=>(pattern.pieceRows || []).filter(row=>row.id==='FRONT-L').forEach(row=>{row.specialCrafts=[craft]}))
    productionOrders.push(order)
    const factory=listSewingFactoryMasterRecords().find(item=>item.factoryType==='THIRD_SEWING' && item.id!==KOL_GOTO_FACTORY_ID && !item.isTestFactory && getFactoryActivePpicSnapshot(item.id))!
    for (const code of ['PROC_CUT','PROC_SEW']) {
      const task=structuredClone(processTasks.find(task=>task.taskId===`TASK-SIMPLE-0916-${code}`)!)
      const id=`TASK-SIMPLE-CRAFT-0916-${code}`
      Object.assign(task,{taskId:id,taskNo:id,rootTaskNo:id,productionOrderId:orderId,productionOrderNo:orderId,assignmentStatus:'ASSIGNED',assignedFactoryId:code==='PROC_CUT'?DEDICATED_CUTTING_FACTORY_ID:factory.id,assignedFactoryName:code==='PROC_CUT'?'自营裁床':factory.name,dispatchedBy:'人工分配演示',businessAssignedAt:stamp,dispatchedAt:stamp,updatedAt:stamp})
      processTasks.push(task)
    }
    clearRuntimeProcessTasksCache()
    const task = structuredClone(template)
    const id='SPECIAL-SIMPLE-CRAFT-0916'
    Object.assign(task,{taskOrderId:id,taskOrderNo:id,productionOrderId:orderId,productionOrderNo:orderId,partName:'左前片',fabricColor:'雾霾灰',sizeCode:'M',feiTicketNos:[],sourceFactoryId:DEDICATED_CUTTING_FACTORY_ID,sourceFactoryName:'自营裁床'})
    task.demandLines=order.demandSnapshot.skuLines.map(sku=>({...structuredClone(template.demandLines![0]),demandLineId:id+'-'+sku.size,taskOrderId:id,productionOrderId:orderId,productionOrderNo:orderId,skuCode:sku.skuCode,partName:'左前片',pieceRowId:'FRONT-L',colorName:sku.color,sizeCode:sku.size,orderQty:sku.qty,planPieceQty:sku.qty,pieceCountPerGarment:1,feiTicketNos:[]}))
    taskStore.taskOrders.push(task)
    restoreSpecialCraftTaskStore(taskStore)
  }
  appendSimpleCutPieceDemoCuttingBatch(1,orderId)
  refreshGeneratedSpecialCraftFeiTicketBindings()
  const bindings=listCuttingSpecialCraftFeiTicketBindings().filter(binding=>binding.productionOrderId===orderId)
  if (!bindings.length) throw new Error('实际完裁菲票尚未与特殊工艺任务匹配')
  const assignment=listDispatchTaskSheetAssignments().find(item=>item.productionOrderId===orderId && item.processCodes.includes('SEWING'))!
  return {orderId,taskSheetNo:buildDispatchTaskSheetData(assignment.assignmentId).taskSheetNo,bindings}
}
