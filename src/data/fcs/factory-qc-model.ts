export const HAND_FEELS = ['柔软手感', '增厚蓬松棉手感', '硬挺加厚手感', '加厚手感'] as const
export type HandFeel = typeof HAND_FEELS[number]
export const HAND_FEEL_ENGLISH: Record<HandFeel, string> = { 柔软手感: 'Soft', 增厚蓬松棉手感: 'Bulk', 硬挺加厚手感: 'Firm & Hard', 加厚手感: 'Firm' }
export const STENTER_FACTORY = { id: 'ID-F003', name: 'GTG' } as const
/** Reported quantity during a production pause is not an accepted final output batch. */
export function waterSolubleHasFinalQcOutput(completedQty: number, status: string): boolean {
  return completedQty > 0 && ['WAIT_HANDOVER', 'HANDOVER_WAIT_RECEIVE', 'RECEIPT_DIFFERENCE', 'WAIT_MANUAL_COMPLETION', 'DONE'].includes(status)
}
export type FactoryQcKind = 'PRINTING' | 'DYEING'
export type QcSourceKind = 'PRINTING' | 'DYEING' | 'WATER_SOLUBLE' | 'STENTER_HAND_FEEL'
export interface QcPartner { id: string; name: string; kind: 'FACTORY' | 'WAREHOUSE' | 'UNKNOWN'; factoryId?: string; warehouseId?: string; isDyeingFactory?: boolean }
export interface QcSourceRoll { id: string; barcode: string; batchId: string; qty: number; unit: string; confirmed: boolean; handedOut?: boolean }
export interface FactoryQcSource {
  kind: QcSourceKind; id: string; no: string; factoryId: string; factoryName: string
  materialSku: string; materialName: string; imageUrl: string; referenceImageUrl?: string
  requiredMaterialSku?: string; requirementVersion: string; unit: string; target: QcPartner
  hasFinalOutput: boolean; completedAt?: string; rolls: QcSourceRoll[]; handedOutRollIds: string[]
  /** Actual final-batch reported roll count, independent of registered barcodes. */
  reportedRollCount?: number
  sourceNo?: string; sourceType?: string; productionOrderId?: string; techPackVersionId?: string; demo?: boolean
  taskId?: string; materialProperties?: { composition?: string; widthCm?: number; gsm?: number }
}
export interface FactoryQcPhoto { id: string; name: string; type: string; size: number }
export interface QcResults { color: string; handfeel: string; material: string }
export interface FactoryQcRoll extends QcSourceRoll {
  photos: FactoryQcPhoto[]; results: QcResults; notes: string; version: number
  completedAt?: string; completedBy?: string; updatedAt?: string; updatedBy?: string
  referenceImageUrl: string; requiredMaterialSku: string; requirementVersion: string
}
export interface HandfeelDecision { needs: boolean; target?: HandFeel; at: string; by: string; orderId?: string; reason?: string }
export interface FactoryQcOrder { id: string; no: string; kind: FactoryQcKind; source: FactoryQcSource; rolls: FactoryQcRoll[]; createdAt: string; version: number; decision?: HandfeelDecision }
export interface StenterHandfeelRoll {
  id: string; sourceRollId: string; barcode: string; unit: string; inputQty: number
  sentAt?: string; receivedAt?: string; receivedQty?: number; warehouseId?: string; locationId?: string
  startedAt?: string; completedAt?: string; outputQty?: number; outputBarcode?: string
  handedOutAt?: string; downstreamReceivedAt?: string; downstreamQty?: number
}
export interface StenterHandfeelOrder {
  id: string; no: string; qcId: string; source: FactoryQcSource; handFeel?: HandFeel
  factoryId: string; factoryName: string; rolls: StenterHandfeelRoll[]
  createdAt: string; createdBy: string; completedAt?: string; version: number
}
export interface FactoryQcAction { id: string; kind: string; at: string; by: string; qcId?: string; orderId?: string; note?: string }
export interface FactoryQcState { qcOrders: FactoryQcOrder[]; handfeelOrders: StenterHandfeelOrder[]; actions: FactoryQcAction[] }
export const emptyFactoryQcState = (): FactoryQcState => ({ qcOrders: [], handfeelOrders: [], actions: [] })
export const qcSourceKey = (source: Pick<FactoryQcSource, 'kind' | 'id'>) => source.kind + ':' + source.id
export const qcIdForSource = (source: Pick<FactoryQcSource, 'kind' | 'id'>) => 'FQC-' + encodeURIComponent(qcSourceKey(source))
export function reportedDyeQcRollCount(records: Array<{ nodeRecordId: string; nodeCode: string; finishedAt?: string; outputQty?: number; outputRollCount?: number }>): number | undefined {
  const batches = new Map<string, number>()
  for (const record of records) if (record.nodeCode === 'PACK' && record.finishedAt && (record.outputQty ?? 0) > 0 && Number.isSafeInteger(record.outputRollCount) && record.outputRollCount! > 0) batches.set(record.nodeRecordId + '@' + record.finishedAt, record.outputRollCount!)
  return batches.size ? [...batches.values()].reduce((sum, count) => sum + count, 0) : undefined
}
export function qcProgress(order: FactoryQcOrder) {
  const reported = Number.isSafeInteger(order.source.reportedRollCount) && order.source.reportedRollCount! > 0 ? order.source.reportedRollCount! : 0
  const total = Math.max(order.rolls.length, reported), checked = order.rolls.filter(roll => !!roll.completedAt).length
  return { total, checked, status: !order.rolls.length ? '待补卷' : checked === total ? '已完成质检' : checked ? '质检中' : '待质检' }
}
export function handfeelStatus(order: StenterHandfeelOrder): string {
  if (order.completedAt) return '已完单'
  if (!order.handFeel) return '目标手感待补充'
  if (!order.rolls.length) return '待补卷'
  if (order.rolls.every(roll => !!roll.downstreamReceivedAt)) return '待人工完单'
  if (order.rolls.some(roll => roll.handedOutAt && !roll.downstreamReceivedAt)) return '待下游实收'
  if (order.rolls.some(roll => roll.completedAt && !roll.handedOutAt)) return '待交出'
  if (order.rolls.some(roll => roll.startedAt && !roll.completedAt)) return '加工中'
  if (order.rolls.some(roll => roll.receivedAt && !roll.startedAt)) return '待投入'
  if (order.rolls.some(roll => roll.sentAt && !roll.receivedAt)) return '待GTG实收'
  return order.source.factoryId === STENTER_FACTORY.id ? '待内部转入' : '待来源交出'
}
export function upsertFactoryQc(state: FactoryQcState, source: FactoryQcSource, at: string): FactoryQcOrder | undefined {
  if (!source.hasFinalOutput) return
  const id = qcIdForSource(source), prior = state.qcOrders.find(order => order.id === id)
  if (!prior && source.kind !== 'PRINTING' && (source.target.kind === 'UNKNOWN' || source.target.isDyeingFactory !== false)) return
  const qc: FactoryQcOrder = prior ?? { id, no: (source.kind === 'PRINTING' ? 'PQC-' : 'DQC-') + source.no, kind: source.kind === 'PRINTING' ? 'PRINTING' : 'DYEING', source: structuredClone(source), rolls: [], createdAt: at, version: 0 }
  const sourceChanged = !!prior && JSON.stringify(qc.source) !== JSON.stringify(source)
  qc.source = structuredClone(source)
  if (sourceChanged) qc.version++
  for (const roll of source.rolls) {
    // An upstream update must never rewrite the inspection snapshot of a completed roll.
    const existing = qc.rolls.find(existing => existing.id === roll.id)
    if (existing) {
      if (!existing.completedAt && JSON.stringify([existing.barcode, existing.batchId, existing.qty, existing.unit, existing.confirmed, existing.requirementVersion]) !== JSON.stringify([roll.barcode, roll.batchId, roll.qty, roll.unit, roll.confirmed, source.requirementVersion])) {
        Object.assign(existing, structuredClone(roll), { referenceImageUrl: source.referenceImageUrl || source.imageUrl, requiredMaterialSku: source.requiredMaterialSku || source.materialSku, requirementVersion: source.requirementVersion, version: existing.version + 1 })
      }
      continue
    }
    qc.rolls.push({ ...structuredClone(roll), photos: [], results: { color: '', handfeel: '', material: '' }, notes: '', version: 0, referenceImageUrl: source.referenceImageUrl || source.imageUrl, requiredMaterialSku: source.requiredMaterialSku || source.materialSku, requirementVersion: source.requirementVersion })
  }
  if (!prior) state.qcOrders.push(qc)
  const handfeel = qc.decision?.orderId ? state.handfeelOrders.find(order => order.id === qc.decision!.orderId) : undefined
  if (handfeel) {
    let changed = false
    for (const roll of source.rolls.filter(roll => roll.confirmed && roll.qty > 0)) if (!handfeel.rolls.some(existing => existing.sourceRollId === roll.id)) {
      handfeel.rolls.push({ id: roll.id, sourceRollId: roll.id, barcode: roll.barcode, inputQty: roll.qty, unit: roll.unit })
      changed = true
    }
    for (const roll of handfeel.rolls.filter(roll => !roll.sentAt)) {
      const actual = source.rolls.find(item => item.id === roll.sourceRollId && item.confirmed && item.qty > 0)
      if (actual && (roll.inputQty !== actual.qty || roll.barcode !== actual.barcode || roll.unit !== actual.unit)) {
        Object.assign(roll, { inputQty: actual.qty, barcode: actual.barcode, unit: actual.unit }); changed = true
      }
    }
    // Keep actual delivery destinations once a delivery has occurred. Later rolls
    // remain on this order, without undoing an explicit manual completion.
    if (!handfeel.rolls.some(roll => roll.handedOutAt) && JSON.stringify(handfeel.source) !== JSON.stringify(source)) { handfeel.source = structuredClone(source); changed = true }
    if (changed) handfeel.version++
  }
  return qc
}
export type FactoryQcCommand =
  | { type: 'SAVE_ROLL'; qcId: string; rollId: string; expectedVersion: number; photos: FactoryQcPhoto[]; results: QcResults; notes: string; complete: boolean }
  | { type: 'DECIDE'; qcId: string; expectedVersion: number; needs: boolean; target?: HandFeel }
  | { type: 'TARGET'; orderId: string; expectedVersion: number; target: HandFeel }
  | { type: 'SEND' | 'RECEIVE' | 'START' | 'OUTPUT' | 'HANDOUT' | 'DOWNSTREAM_RECEIVE'; orderId: string; expectedVersion: number; rolls: Array<{ id: string; qty?: number; barcode?: string; warehouseId?: string; locationId?: string }>; differenceConfirmed?: boolean }
  | { type: 'COMPLETE'; orderId: string; expectedVersion: number }
  | { type: 'CONTINUE'; orderId: string; expectedVersion: number }
  | { type: 'PRINT'; orderId: string; expectedVersion: number; document: 'ORDER' | 'TRANSFER' }
function check(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message) }
export function applyFactoryQcCommand(original: FactoryQcState, command: FactoryQcCommand, by: string, operationId: string, at: string, currentSource?: FactoryQcSource): FactoryQcState {
  if (original.actions.some(action => action.id === operationId)) return structuredClone(original)
  const state = structuredClone(original)
  check(by.trim(), '记录人不能为空。')
  if (command.type === 'SAVE_ROLL' || command.type === 'DECIDE') {
    const qc = state.qcOrders.find(order => order.id === command.qcId)
    check(qc, 'QC单不存在，请重新读取。')
    if (command.type === 'SAVE_ROLL') {
      const roll = qc.rolls.find(item => item.id === command.rollId)
      check(roll, '本卷不属于当前QC单。')
      check(!roll.completedAt, '本卷已完成质检，不允许修改结果、照片或完成信息。')
      check(roll.version === command.expectedVersion, '本卷已在其他页面更新，请重新读取。')
      check(new Set(command.photos.map(photo => photo.id)).size === command.photos.length, '照片引用重复，请核对。')
      if (command.complete) check(command.photos.length > 0 && ['color', 'handfeel', 'material'].every(key => typeof command.results?.[key as keyof QcResults] === 'string' && command.results[key as keyof QcResults].trim()), '记录本卷照片及色差、手感、面料种类三个结果后才能完成质检。')
      roll.photos = structuredClone(command.photos); roll.results = { ...command.results }; roll.notes = command.notes
      roll.version++; roll.updatedAt = at; roll.updatedBy = by
      if (command.complete) { roll.completedAt = at; roll.completedBy = by }
    } else {
      check(qc.version === command.expectedVersion, '整单判断已在其他页面更新，请重新读取。')
      check(qc.source.kind === 'PRINTING' || qc.source.kind === 'DYEING', '只有印花和染色来源QC可以发起手感处理。')
      check(currentSource && qcSourceKey(currentSource) === qcSourceKey(qc.source), '来源加工单无法核对，本次未保存。')
      check(qc.source.requirementVersion === currentSource.requirementVersion, '来源加工要求版本已变化，请重新读取并核对。')
      const physical = (source: FactoryQcSource) => JSON.stringify(source.rolls.map(({ id, barcode, batchId, qty, unit, confirmed }) => ({ id, barcode, batchId, qty, unit, confirmed })).sort((a, b) => a.id.localeCompare(b.id)))
      check(physical(qc.source) === physical(currentSource), '来源实物卷或实际数量已变化，请重新读取并核对。')
      check(!command.target || HAND_FEELS.includes(command.target), '目标手感只能使用已确认的四类。')
      if (qc.decision && qc.decision.needs !== command.needs) throw new Error('整单判断已记录，新增批次不得另作相反判断。')
      if (qc.decision && command.target && command.target !== qc.decision.target) throw new Error('整单决定已经记录，目标要求须在关联手感单补充，不能在QC另写相反要求。')
      const old = qc.decision
      let orderId = old?.orderId, reason = ''
      if (command.needs && !orderId) {
        if (currentSource.handedOutRollIds.length || currentSource.rolls.some(roll => roll.handedOut)) reason = '来源已有实际交出，本次仅保存判断，整单不创建定型机手感单。'
        else {
          orderId = 'SHF-' + encodeURIComponent(qcSourceKey(currentSource))
          if (!state.handfeelOrders.some(order => order.id === orderId)) state.handfeelOrders.push({ id: orderId, no: 'SHF-' + currentSource.no, qcId: qc.id, source: structuredClone(currentSource), handFeel: command.target, factoryId: STENTER_FACTORY.id, factoryName: STENTER_FACTORY.name, rolls: currentSource.rolls.filter(roll => roll.confirmed && roll.qty > 0).map(roll => ({ id: roll.id, sourceRollId: roll.id, barcode: roll.barcode, inputQty: roll.qty, unit: roll.unit })), createdAt: at, createdBy: by, version: 0 })
        }
      }
      qc.decision = { needs: command.needs, target: command.target ?? old?.target, at, by, ...(orderId ? { orderId } : {}), ...(reason ? { reason } : {}) }
    }
    qc.version++
    state.actions.push({ id: operationId, kind: command.type, qcId: qc.id, at, by })
    return state
  }
  const order = state.handfeelOrders.find(item => item.id === command.orderId)
  check(order, '定型机手感单不存在。')
  check(order.version === command.expectedVersion, '加工单已在其他页面更新，请重新读取。')
  if (command.type === 'PRINT') {
    state.actions.push({ id: operationId, kind: 'PRINT', orderId: order.id, at, by, note: command.document === 'ORDER' ? '加工单打印预览' : '交接与卷标打印预览' })
    order.version++
    return state
  }
  if (command.type === 'CONTINUE') {
    check(order.completedAt && order.rolls.some(roll => !roll.sentAt), '只有已完单后补入尚未移交的新卷，才能明确继续处理。')
    const previous = order.completedAt
    order.completedAt = undefined; order.version++
    state.actions.push({ id: operationId, kind: 'CONTINUE', orderId: order.id, at, by, note: '明确继续处理后补卷；原人工完单时间 ' + previous })
    return state
  }
  check(!order.completedAt, '本单已人工完结，不能自动重开或修改已发生实物。')
  if (command.type === 'TARGET') {
    check(HAND_FEELS.includes(command.target), '请选择四类目标手感。'); check(!order.rolls.some(roll => roll.startedAt), '已投入加工，不允许改变已执行要求。'); order.handFeel = command.target
    const qc = state.qcOrders.find(item => item.id === order.qcId)
    if (qc?.decision) { qc.decision.target = command.target; qc.version++ }
  }
  else if (command.type === 'COMPLETE') { check(order.rolls.length && order.rolls.every(roll => roll.downstreamReceivedAt), '全部实际卷经下游实收后才能人工完单。'); order.completedAt = at }
  else {
    check(command.rolls.length, '选择本次实际操作的卷。')
    check(new Set(command.rolls.map(item => item.id)).size === command.rolls.length, '同一卷不能重复操作。')
    for (const input of command.rolls) {
      const roll = order.rolls.find(item => item.id === input.id); check(roll, '卷不属于本单。')
      switch (command.type) {
        case 'SEND': check(input.barcode === roll.barcode, '扫描本次来源卷码后交出。'); check(!roll.sentAt, '本卷已经交出。'); roll.sentAt = at; break
        case 'RECEIVE': check(input.barcode === roll.barcode, '扫描本次来源卷码后接收。'); check(roll.sentAt && !roll.receivedAt, '本卷尚未实际交出或已经实收。'); check(Number.isFinite(input.qty) && input.qty! > 0, '填写本卷实际接收数量。'); check(input.qty === roll.inputQty || command.differenceConfirmed, '实收数量不同，核对差异后确认。'); check(input.warehouseId && input.locationId, '选择GTG实际接收仓库及库位。'); Object.assign(roll, { receivedAt: at, receivedQty: input.qty, warehouseId: input.warehouseId, locationId: input.locationId }); break
        case 'START': check(roll.receivedAt && !roll.startedAt, '本卷尚未实收或已经投入。'); check(order.handFeel, '补充目标手感后再按实际要求投入。'); roll.startedAt = at; break
        case 'OUTPUT': check(roll.startedAt && !roll.completedAt, '本卷尚未投入或已经登记产出。'); check(Number.isFinite(input.qty) && input.qty! > 0, '填写本卷实际产出数量。'); check(input.qty === roll.receivedQty || command.differenceConfirmed, '产出数量不同，核对差异后确认。'); check(input.barcode?.trim(), '填写实际产出卷码。'); check(!state.handfeelOrders.some(other => other.rolls.some(existing => existing.outputBarcode === input.barcode?.trim() && existing !== roll)), '产出卷码已使用。'); Object.assign(roll, { completedAt: at, outputQty: input.qty, outputBarcode: input.barcode!.trim() }); break
        case 'HANDOUT': check(roll.completedAt && !roll.handedOutAt, '本卷尚未完成实际加工或已经交出。'); check(order.source.target.kind !== 'UNKNOWN' && order.source.target.id, '核对实际接收方后交出。'); check(input.barcode === (roll.outputBarcode || roll.barcode), '扫描本卷实际产出卷码后交出。'); roll.handedOutAt = at; break
        case 'DOWNSTREAM_RECEIVE': check(roll.handedOutAt && !roll.downstreamReceivedAt, '本卷尚未实际交出或已被下游接收。'); check(Number.isFinite(input.qty) && input.qty! > 0, '填写下游实际接收数量。'); check(input.qty === roll.outputQty || command.differenceConfirmed, '下游实收不同，核对差异后确认。'); Object.assign(roll, { downstreamReceivedAt: at, downstreamQty: input.qty }); break
      }
    }
  }
  order.version++
  if (command.type === 'OUTPUT') {
    const output = order.rolls.filter(roll => !!roll.completedAt)
    upsertFactoryQc(state, { ...order.source, kind: 'STENTER_HAND_FEEL', id: order.id, no: order.no, factoryId: STENTER_FACTORY.id, factoryName: STENTER_FACTORY.name, hasFinalOutput: true, completedAt: at, handedOutRollIds: order.rolls.filter(roll => !!roll.handedOutAt).map(roll => roll.id), rolls: output.map(roll => ({ id: roll.id, barcode: roll.outputBarcode!, batchId: order.id, qty: roll.outputQty!, unit: roll.unit, confirmed: true, handedOut: !!roll.handedOutAt })) }, at)
  }
  state.actions.push({ id: operationId, kind: command.type, orderId: order.id, at, by })
  return state
}

/** Present the frozen source requirement in business language, keeping its stored comparison signature unchanged. */
export function factoryQcRequirementText(value: string): string {
  const version = value?.trim()
  if (!version) return '来源要求待补充'
  if (!/^[\[{]/.test(version)) return '要求版本 ' + version
  try {
    const fields: unknown = JSON.parse(version)
    if (Array.isArray(fields) && fields.length === 3 && typeof fields[0] === 'string' && typeof fields[1] === 'string' && (fields[2] === null || typeof fields[2] === 'string')) {
      return [fields[1] ? '颜色要求：' + fields[1] : '', fields[2] ? '技术包版本 ' + fields[2] : ''].filter(Boolean).join(' · ') || '按本卷来源要求核对'
    }
  } catch { /* The comparison signature remains internal; never guess a displayed version. */ }
  return '按本卷来源要求核对'
}
