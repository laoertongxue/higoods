/** Post-print physical decisions. This module has no storage or UI side effects. */
export const WASHING_HAND_FEELS = ['柔软手感', '增厚蓬松棉手感', '硬挺手感'] as const
export const WASHING_FACTORY_ID = 'ID-F003'
export const WASHING_FACTORY_NAME = 'GTG'
export type WashingHandFeel = typeof WASHING_HAND_FEELS[number]
export type WashingRole = '现场判断人员' | '计划跟单' | '染厂人员' | '接收人员' | '现场负责人'
export interface WashingActor { id: string; name: string; role: WashingRole; factoryId?: string; warehouseId?:string }
export interface WashingTarget { id: string; name: string; factoryId?: string; warehouseId?: string }
export interface WashingSourceRoll {
  id: string; barcode: string; qty: number; unit: string; confirmed: boolean; handedOut: boolean; revision?: string; blockedReason?:string
}
export interface WashingSource {
  objectType: 'FABRIC'; rootSource?: unknown
  id: string; printOrderId: string; printOrderNo: string; batchId: string
  sourceType: 'PRODUCTION' | 'PRODUCTION_DEMAND' | 'PURCHASE' | 'STOCK' | 'SUPPLEMENT' | 'DESIGN_REVISION'
  sourceNo: string; productionOrderId?: string; productionDemandId?: string; techPackVersionId?: string
  factoryId: string; factoryName: string; materialSku: string; materialName: string; imageUrl: string
  product?: { spu: string; productName: string; imageUrl: string; imageAlt: string }
  materialProperties?: { composition: string; gsm: number; widthCm: number }
  taskNo?: string; salesType?: string; creationMethod?: string
  revision: string; actualCompleted: boolean; blockedReason?: string; target?: WashingTarget
  rolls: WashingSourceRoll[]; demo?: boolean
}
export interface WashingJudgment {
  id: string; sourceId: string; printOrderId: string; rollId: string; sourceRevision: string
  decision: 'NO_WASH' | 'WASH'; handFeel?: WashingHandFeel; orderId?: string
  actorId: string; actorName: string; at: string; history: Array<Omit<WashingJudgment, 'history'>>
}
export interface WashingRoll {
  id: string; sourceRollId: string; barcode: string; inputQty: number; unit: string
  sentAt?: string; receivedAt?: string; receivedQty?: number; warehouseId?: string; locationId?: string
  startedAt?: string; completedAt?: string; outputQty?: number; outputBarcode?: string
  handedOutAt?: string; downstreamReceivedAt?: string; downstreamQty?: number; downstreamWarehouseId?:string; downstreamLocationId?:string
}
export interface WashingOrder {
  id: string; no: string; source: WashingSource; rollIds: string[]; handFeel: WashingHandFeel
  createdAt: string; createdBy: string; assignedFactoryId?: string; assignedFactoryName?: string
  acceptance: 'UNASSIGNED' | 'PENDING' | 'ACCEPTED' | 'REJECTED'
  rejectionReason?: string; assignedAt?: string; acceptedAt?: string; completedAt?: string; cancelledAt?: string
  exception?: string; revision: number; printedRevision?: number; printedContentSignature?:string
  rolls: WashingRoll[]
}
export interface WashingAction {
  id: string; orderId?: string; sourceId: string; action: string; actor: WashingActor; at: string
  rollIds: string[]; note: string; intent: string
}
export interface WashingState { judgments: WashingJudgment[]; orders: WashingOrder[]; actions: WashingAction[] }
export const emptyWashingState = (): WashingState => ({ judgments: [], orders: [], actions: [] })
export function washingPrintSignature(order:WashingOrder):string {
 return JSON.stringify([order.handFeel,order.assignedFactoryId,order.source.productionOrderId,order.source.target,order.rolls.map(r=>[r.id,r.barcode,r.outputBarcode,r.inputQty,r.receivedQty,r.outputQty,r.downstreamQty]),order.cancelledAt,order.exception])
}
export type WashingCommand =
  | { type: 'JUDGE'; source: WashingSource; rollIds: string[]; decision: 'NO_WASH' | 'WASH'; handFeel?: WashingHandFeel; correct?: boolean }
  | { type: 'ASSIGN'; orderId: string; factory: { id: string; name: string; enabled: boolean } }
  | { type: 'ACCEPT'; orderId: string }
  | { type: 'REJECT'; orderId: string; reason: string }
  | { type: 'SEND'; orderId: string; rollIds: string[]; scannedCodes: string[] }
  | { type: 'RECEIVE'; orderId: string; lines: Array<{ rollId: string; barcode: string; qty: number }>; warehouseId: string; locationId: string; differenceConfirmed?: boolean }
  | { type: 'START'; orderId: string; rollIds: string[] }
  | { type: 'OUTPUT'; orderId: string; lines: Array<{ rollId: string; qty: number; barcode?: string }>; differenceConfirmed?: boolean }
  | { type: 'HANDOUT'; orderId: string; rollIds: string[]; scannedCodes: string[]; target: WashingTarget }
  | { type: 'DOWNSTREAM_RECEIVE'; orderId: string; lines: Array<{ rollId: string; qty: number }>; warehouseId?:string; locationId?:string; differenceConfirmed?: boolean }
  | { type: 'COMPLETE'; orderId: string }
  | { type: 'CANCEL'; orderId: string; reason: string; confirmed: boolean }
  | { type: 'EXCEPTION'; orderId: string; reason: string; confirmed: boolean }
  | { type: 'RESOLVE_EXCEPTION'; orderId: string; reason: string; confirmed: boolean; handFeel?:WashingHandFeel; verifiedSource?:WashingSource }
  | { type: 'PRINT'; orderId: string }
  | { type: 'LINK'; printOrderId: string; productionOrderId: string; target?: WashingTarget }

const fail = (message: string): never => { throw new Error(message) }
const positive = (n: number) => Number.isFinite(n) && n > 0
function actorRole(actor: WashingActor, roles: WashingRole[]) {
  if (!actor.id?.trim() || !actor.name?.trim() || !roles.includes(actor.role)) fail('当前人员不能执行此动作。')
}
function scope<T extends { id: string }>(rows: T[], ids: string[]): T[] {
  if (!ids.length || new Set(ids).size !== ids.length) fail('请选择不重复的实际卷。')
  const found = ids.map(id => rows.find(row => row.id === id) ?? fail('所选卷不属于当前单据。'))
  return found
}
export function washingJudgmentId(printOrderId: string, rollId: string): string {
  return 'WJ/' + encodeURIComponent(printOrderId) + '/' + encodeURIComponent(rollId)
}
export function assertWashingSource(source: WashingSource): void {
  if (source.objectType !== 'FABRIC') fail('洗水仅适用于面料。')
  if (!source.actualCompleted || source.blockedReason) fail(source.blockedReason || '面料尚未实际完成印花，不能登记触摸判断。')
  if (!source.id || !source.printOrderId || !source.batchId || !source.materialSku || !source.revision) fail('实际产出来源不完整，请核对批次。')
  if (!source.imageUrl) fail('请先核对面料对应图片，用户图片须使用已保存的文件引用。')
}
/** Undecided physical rolls that can start a new washing order. */
export function washingInitiationRolls(state: WashingState, source: WashingSource): WashingSourceRoll[] {
  try { assertWashingSource(source) } catch { return [] }
  return source.rolls.filter(roll => roll.confirmed && positive(roll.qty) && !!roll.unit?.trim()
    && !roll.handedOut && !roll.blockedReason
    && !state.judgments.some(judgment => judgment.printOrderId === source.printOrderId && judgment.rollId === roll.id))
}
function selectOrder(state: WashingState, id: string, historical=false): WashingOrder {
  const order = state.orders.find(row => row.id === id) ?? fail('洗水加工单不存在。')
  if (order.cancelledAt&&!historical) fail('本单已作废，不能新增执行。')
  return order
}
function factoryActor(actor: WashingActor, order: WashingOrder) {
  actorRole(actor, ['染厂人员'])
  if (!actor.factoryId || actor.factoryId !== order.assignedFactoryId) fail('只能处理本厂获派的洗水加工单。')
}
function scanning(rolls: WashingRoll[], codes: string[], output = false) {
  if (codes.length !== rolls.length || new Set(codes).size !== codes.length
      || rolls.some(roll => !codes.includes(output ? roll.outputBarcode || roll.barcode : roll.barcode))) fail('请扫齐本次交出的实际卷，不能混入其他卷码。')
}
/** A complete business command changes only its selected records. The repository commits the result atomically. */
export function applyWashingCommand(
  original: WashingState, command: WashingCommand, actor: WashingActor, operationId: string, at: string,
): { state: WashingState; orderId?: string } {
  if (!operationId || !at) fail('操作标识与时间不能为空。')
  const duplicate = original.actions.find(action => action.id === operationId)
  const intent = JSON.stringify({ command: command.type === 'JUDGE' ? { ...command, source: { id: command.source.id, revision: command.source.revision } } : command, actor })
  if (duplicate) {
    if (duplicate.intent !== intent) fail('操作标识已用于其他动作。')
    return { state: original, orderId: duplicate.orderId }
  }
  const state = structuredClone(original)
  let order: WashingOrder | undefined
  let selectedIds: string[] = []
  let sourceId = ''
  let note = ''
  if (command.type === 'JUDGE') {
    actorRole(actor, ['现场判断人员'])
    assertWashingSource(command.source)
    if (actor.factoryId !== command.source.factoryId) fail('只能登记当前现场面料的触摸判断。')
    const rolls = scope(command.source.rolls, command.rollIds)
    if(command.decision==='WASH'&&rolls.some(roll=>roll.blockedReason))fail(rolls.find(roll=>roll.blockedReason)!.blockedReason!)
    if (rolls.some(roll => !roll.confirmed || !positive(roll.qty) || !roll.unit || roll.handedOut)) fail('所选卷未核实数量或已经交出，请重新核对。')
    if (new Set(rolls.map(roll => roll.unit)).size !== 1) fail('同一洗水单的面料数量单位须一致。')
    const previous = rolls.map(roll => state.judgments.find(row => row.id === washingJudgmentId(command.source.printOrderId, roll.id)))
    for (const row of previous) if (row) {
      if (row.actorId !== actor.id) fail('只能纠正本人登记的触摸结果。')
      const oldOrder = row.orderId && state.orders.find(item => item.id === row.orderId && !item.cancelledAt)
      if (oldOrder && (oldOrder.acceptedAt || oldOrder.rolls.some(item => item.sentAt))) fail('GTG 已接单或本批已交出，请先由跟单协调纠正原单。')
      if (oldOrder && oldOrder.rollIds.some(id => !command.rollIds.includes(id))) fail('请完整选择原洗水单的卷后纠正，避免留下半套占用。')
    }
    if(previous.some(Boolean)&&!command.correct)fail('所选卷已有触摸结果，请查看对应单据；需调整时使用纠正结果。')
    if (command.decision === 'WASH') {
      if (!WASHING_HAND_FEELS.includes(command.handFeel as WashingHandFeel)) fail('请选择目标洗水手感。')
      const id = 'WASH-' + operationId
      order = {
        id, no: 'WS-' + new Date(at).toLocaleDateString('sv-SE').replaceAll('-','') + '-' + operationId.replace(/[^A-Za-z0-9]/g, '').slice(0,8).toUpperCase(),
        source: structuredClone(command.source), rollIds: rolls.map(roll => roll.id), handFeel: command.handFeel!,
        createdAt: at, createdBy: actor.name, assignedFactoryId: WASHING_FACTORY_ID, assignedFactoryName: WASHING_FACTORY_NAME,
        assignedAt: at, acceptance: 'PENDING', revision: 1,
        rolls: rolls.map(roll => ({ id: roll.id, sourceRollId: roll.id, barcode: roll.barcode, inputQty: roll.qty, unit: roll.unit })),
      }
      if(state.orders.some(row=>row.no===order!.no&&row.id!==order!.id)) order.no += '-' + operationId.replace(/[^A-Za-z0-9]/g,'').slice(-8).toUpperCase()
      if(state.orders.some(row=>row.no===order!.no)) fail('洗水单号冲突，请重新核对操作。')
      state.orders.push(order)
    } else if (command.handFeel !== undefined) fail('不需要洗水时无需填写手感。')
    for (const row of previous) if (row?.orderId) {
      const old = state.orders.find(item => item.id === row.orderId && !item.cancelledAt)
      if (old) { old.cancelledAt = at; old.revision++; }
    }
    for (const roll of rolls) {
      const id = washingJudgmentId(command.source.printOrderId, roll.id)
      const old = state.judgments.find(row => row.id === id)
      const { history: oldHistory = [], ...oldValue } = old || { history: [] }
      const judgment: WashingJudgment = {
        id, sourceId: command.source.id, printOrderId: command.source.printOrderId, rollId: roll.id,
        sourceRevision: roll.revision ?? command.source.revision, decision: command.decision,
        ...(order ? { orderId: order.id, handFeel: order.handFeel } : {}),
        actorId: actor.id, actorName: actor.name, at,
        history: old ? [...oldHistory, oldValue as Omit<WashingJudgment, 'history'>] : [],
      }
      const index = state.judgments.findIndex(row => row.id === id)
      if (index < 0) state.judgments.push(judgment); else state.judgments[index] = judgment
    }
    sourceId = command.source.id; selectedIds = command.rollIds
  } else if (command.type === 'LINK') {
    actorRole(actor, ['计划跟单'])
    for (const item of state.orders.filter(row => row.source.printOrderId === command.printOrderId)) {
      if (item.source.productionOrderId && item.source.productionOrderId !== command.productionOrderId) fail('提前加工已经匹配其他生产单。')
      item.source.productionOrderId = command.productionOrderId
      if (command.target && !item.rolls.some(roll => roll.handedOutAt)) item.source.target = command.target
      item.revision++
    }
    sourceId = command.printOrderId
  } else {
    order = selectOrder(state, command.orderId,command.type==='PRINT')
    sourceId = order.source.id
    if (order.exception && !['PRINT', 'EXCEPTION', 'RESOLVE_EXCEPTION'].includes(command.type)) fail('本单存在实物异常，须先由负责人核对恢复。')
    if (order.completedAt && !['PRINT', 'EXCEPTION', 'RESOLVE_EXCEPTION'].includes(command.type)) fail('本单已人工完成，不能新增执行。')
    if (command.type === 'ASSIGN') {
      actorRole(actor, ['计划跟单'])
      if (command.factory.id !== WASHING_FACTORY_ID) fail('洗水由 GTG 承接，不能派给其他工厂。')
      if (!command.factory.enabled || !command.factory.id || !command.factory.name) fail('请选择已启用的承接染厂。')
      if (order.rolls.some(roll => roll.sentAt)) fail('已经交出实物，不能直接变更染厂。')
      order.assignedFactoryId = WASHING_FACTORY_ID; order.assignedFactoryName = WASHING_FACTORY_NAME
      order.acceptance = 'PENDING'; order.assignedAt = at; delete order.acceptedAt; delete order.rejectionReason
    } else if (command.type === 'ACCEPT' || command.type === 'REJECT') {
      factoryActor(actor, order)
      if (order.acceptance !== 'PENDING') fail('本单当前不是待接单。')
      if (command.type === 'REJECT') {
        if (!command.reason.trim()) fail('请填写拒单原因。')
        order.acceptance = 'REJECTED'; order.rejectionReason = command.reason; note = command.reason
      } else { order.acceptance = 'ACCEPTED'; order.acceptedAt = at }
    } else if (command.type === 'SEND') {
      actorRole(actor, ['现场判断人员'])
      if (actor.factoryId !== order.source.factoryId) fail('只能交出本现场的实物。')
      if (order.acceptance !== 'ACCEPTED') fail('请先由承接染厂接单。')
      const rolls = scope(order.rolls, command.rollIds); scanning(rolls, command.scannedCodes)
      if (rolls.some(roll => roll.sentAt)) fail('所选卷已经交出，不能重复交出。')
      rolls.forEach(roll => { roll.sentAt = at }); selectedIds = command.rollIds
    } else if (command.type === 'RECEIVE') {
      factoryActor(actor, order)
      if (!command.warehouseId.trim() || !command.locationId.trim()) fail('请选择本厂实际接收库位。')
      const rolls = scope(order.rolls, command.lines.map(line => line.rollId))
      command.lines.forEach((line, index) => {
        const roll = rolls[index]
        if (!roll.sentAt || roll.receivedAt || line.barcode !== roll.barcode || !positive(line.qty) || line.qty > roll.inputQty) fail('卷码、实收数量或交出状态不符，不能接收。')
        if (line.qty !== roll.inputQty && !command.differenceConfirmed) fail('本次实收存在差异，请确认对应卷和数量。')
        roll.receivedAt = at; roll.receivedQty = line.qty; roll.warehouseId = command.warehouseId; roll.locationId = command.locationId
      }); selectedIds = command.lines.map(line => line.rollId)
    } else if (command.type === 'START') {
      factoryActor(actor, order)
      const rolls = scope(order.rolls, command.rollIds)
      if (rolls.some(roll => !roll.receivedAt || roll.startedAt || !positive(roll.receivedQty!))) fail('只能使用本厂已接收且未投入的实际卷。')
      rolls.forEach(roll => { roll.startedAt = at }); selectedIds = command.rollIds
    } else if (command.type === 'OUTPUT') {
      factoryActor(actor, order)
      const rolls = scope(order.rolls, command.lines.map(line => line.rollId))
      const labels=command.lines.map(line=>line.barcode?.trim()||rolls.find(r=>r.id===line.rollId)!.barcode)
      if(new Set(labels).size!==labels.length||labels.some((label,index)=>state.orders.some(o=>o.rolls.some(r=>r.id!==rolls[index].id&&(r.outputBarcode===label||r.barcode===label)))))fail('产出卷码已被其他实物使用，请保留原卷或使用唯一新卷码。')
      command.lines.forEach((line, index) => {
        const roll = rolls[index]
        if (!roll.startedAt || roll.completedAt || !positive(line.qty)) fail('请选择已开工且未完成的卷，填写实际产出；零产出请登记异常。')
        if (line.qty !== roll.receivedQty && !command.differenceConfirmed) fail('加工数量有变化，请核对实际投入与产出后确认。')
        roll.completedAt = at; roll.outputQty = line.qty; roll.outputBarcode = line.barcode?.trim() || roll.barcode
      }); selectedIds = command.lines.map(line => line.rollId)
    } else if (command.type === 'HANDOUT') {
      factoryActor(actor, order)
      const target = order.source.target
      if (!target || command.target.id !== target.id) fail('请先核对原来源对应的唯一接收方。')
      const rolls = scope(order.rolls, command.rollIds); scanning(rolls, command.scannedCodes, true)
      if (rolls.some(roll => !roll.completedAt || roll.handedOutAt)) fail('只能交出已经洗水完成且尚未交出的卷。')
      rolls.forEach(roll => { roll.handedOutAt = at }); selectedIds = command.rollIds
    } else if (command.type === 'DOWNSTREAM_RECEIVE') {
      actorRole(actor, ['接收人员'])
      if(order.source.target?.warehouseId && (actor.warehouseId!==order.source.target.warehouseId||command.warehouseId!==order.source.target.warehouseId||!command.locationId?.trim())) fail('请由原接收仓责任人登记本仓实际库位。')
      if (order.source.target?.factoryId && actor.factoryId !== order.source.target.factoryId) fail('只能由本次下游责任方接收。')
      if(!command.warehouseId?.trim()||!command.locationId?.trim())fail('请填写本次下游实际接收库位。')
      const rolls = scope(order.rolls, command.lines.map(line => line.rollId))
      command.lines.forEach((line, index) => {
        const roll = rolls[index]
        if (!roll.handedOutAt || roll.downstreamReceivedAt || !positive(line.qty) || line.qty > roll.outputQty!) fail('交出状态或实际接收数量不符。')
        if (line.qty !== roll.outputQty && !command.differenceConfirmed) fail('交回实收存在差异，请核对后确认。')
        roll.downstreamReceivedAt = at; roll.downstreamQty = line.qty; roll.downstreamWarehouseId=command.warehouseId;roll.downstreamLocationId=command.locationId
      }); selectedIds = command.lines.map(line => line.rollId)
    } else if (command.type === 'COMPLETE') {
      factoryActor(actor, order)
      if (!order.rolls.every(roll => roll.completedAt && roll.downstreamReceivedAt)) fail('仍有未加工或未完成下游实收的卷，不能人工完单。')
      order.completedAt = at
    } else if (command.type === 'CANCEL') {
      actorRole(actor, ['计划跟单', '现场负责人'])
      if (!command.confirmed || !command.reason.trim()) fail('请确认作废对象和后果并填写原因。')
      if (order.rolls.some(roll => roll.sentAt)) fail('已有实物交接，不能直接作废；请登记异常并核对实物责任。')
      order.cancelledAt = at; note = command.reason
      state.judgments.filter(row => row.orderId === order!.id).forEach(row => { row.sourceRevision = '需重新触摸判断' })
    } else if (command.type === 'EXCEPTION') {
      actorRole(actor, ['现场负责人', '染厂人员'])
      if (actor.role === '染厂人员') factoryActor(actor, order)
      if (!command.confirmed || !command.reason.trim()) fail('请确认异常涉及的面料并填写实际情况。')
      order.exception = command.reason; note = command.reason
    } else if (command.type === 'RESOLVE_EXCEPTION') {
      actorRole(actor, ['现场负责人'])
      if (!order.exception || !command.confirmed || !command.reason.trim()) fail('请记录实物核对和恢复原因。')
      note = order.exception + '；恢复：' + command.reason
      if(command.handFeel&&command.handFeel!==order.handFeel){
        if(!WASHING_HAND_FEELS.includes(command.handFeel)||order.rolls.some(r=>r.downstreamReceivedAt))fail('手感无效或已有下游实收，不能覆盖已发生要求。')
        note+='；原手感 '+order.handFeel+' → '+command.handFeel;order.handFeel=command.handFeel
      }
      if(command.verifiedSource){
        const source=command.verifiedSource
        assertWashingSource(source)
        if(source.id!==order.source.id||source.materialSku!==order.source.materialSku||order.rolls.some(roll=>{const current=source.rolls.find(r=>r.id===roll.sourceRollId);return !current||current.barcode!==roll.barcode||current.qty!==roll.inputQty||current.unit!==roll.unit}))fail('来源实物范围或数量已改变，请先协调更正原记录；不能覆盖已发生的交接。')
        for(const judgment of state.judgments.filter(j=>j.orderId===order!.id)){
          const revision=source.rolls.find(r=>r.id===judgment.rollId)!.revision??source.revision
          if(revision!==judgment.sourceRevision){const {history,...previous}=judgment;judgment.history=[...history,previous];judgment.sourceRevision=revision}
        }
        order.source=structuredClone(source)
        note+='；负责人重新核对原印花实物版本'
      }
      delete order.exception
    } else if (command.type === 'PRINT') {
      actorRole(actor, ['现场判断人员', '计划跟单', '染厂人员', '接收人员', '现场负责人'])
      if(actor.role==='染厂人员')factoryActor(actor,order)
      order.printedRevision = order.revision
      order.printedContentSignature=washingPrintSignature(order)
    }
    if (command.type !== 'PRINT') order.revision++
  }
  state.actions.push({ id: operationId, orderId: order?.id, sourceId, action: command.type, actor, at, rollIds: selectedIds, note, intent })
  return { state, orderId: order?.id }
}

export function washingRollRelease(state: WashingState, printOrderId: string, rollId: string, revision?: string): string {
  const row = state.judgments.find(item => item.id === washingJudgmentId(printOrderId, rollId))
  if (!row || (revision && row.sourceRevision !== revision) || row.sourceRevision === '需重新触摸判断') return '请先实际触摸本卷面料，登记是否需要洗水。'
  if (row.decision === 'NO_WASH') return ''
  const order = state.orders.find(item => item.id === row.orderId && !item.cancelledAt)
  const roll = order?.rolls.find(item => item.sourceRollId === rollId)
  return order?.exception ? '本卷存在洗水异常，请先由负责人核对。'
    : roll?.completedAt && roll.downstreamReceivedAt ? '' : '本卷需要洗水，请按对应洗水单流转，完成加工及下游实收后再领用。'
}
