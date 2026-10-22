import { listPrintingWorkOrders, getPrintWorkOrderById, getPrintingWorkOrderById, capturePrintProcessMutationState, markPrintingHandfeelTransfer } from './printing-task-domain.ts'
import { listDyeWorkOrders, getDyeWorkOrderById, captureDyeProcessMutationState, getDyeDispatchPartner, getDyeDispatchMaterial, markDyeHandfeelTransfer, listDyeDispatchDocuments, isDyeYarnOrder } from './dyeing-task-domain.ts'
import { listWaterSolubleWorkOrders, getWaterSolubleWorkOrderById, getWaterSolubleReceivingMaterial } from './water-soluble-task-domain.ts'
import { listWaterOutputRows } from './water-soluble-output.ts'
import { listFactoryInternalWarehouses } from './factory-internal-warehouse-locations.ts'
import { getFactoryMasterRecordById } from './factory-master-store.ts'
import { classifyFactoryQcRecipient } from './factory-qc-recipient.ts'
import { listHandoverOrdersByTaskId, getPdaHandoverRecordsByHead } from './pda-handover-events.ts'
import { DYE_DEMO_DETAILS } from './dye-work-order-demo-details.ts'
import { getPdaSession } from './store-domain-pda.ts'
import { registerFactoryReceivingSource, listFactoryReceivingSources, prepareFactoryReceipt, savePreparedFactoryReceipt, recordStenterHandfeelMaterialUsage, assertReceiptPosition } from './factory-receiving.ts'
import { ensureFactoryQcRecords as ensureRecords, readFactoryQcState, stageFactoryQcState, runFactoryQcRecordCommand, adoptFactoryProcessRows, removeLegacyWashingData, ensureFactoryQcRetirement, assertFactoryQcFiles, factoryQcPhotoUrl } from './factory-qc-records.ts'
import { applyFactoryQcCommand, upsertFactoryQc, reportedDyeQcRollCount, waterSolubleHasFinalQcOutput, emptyFactoryQcState, qcIdForSource, qcSourceKey, STENTER_FACTORY, type FactoryQcSource, type FactoryQcKind, type FactoryQcOrder, type FactoryQcPhoto, type FactoryQcCommand, type FactoryQcState, type QcResults, type QcPartner, type HandFeel } from './factory-qc-model.ts'
export * from './factory-qc-model.ts'
export { factoryQcPhotoUrl, removeLegacyWashingData }
const actor = () => getPdaSession()?.userName || 'Web现场操作员'

function partner(input: { id?: string; name?: string; kind?: string; factoryType?: string }): QcPartner {
  if (!input.id) return { id: '', name: '接收方待核对', kind: 'UNKNOWN' }
  const warehouse = listFactoryInternalWarehouses().find(row => row.warehouseId === input.id)
  const factoryId = input.kind === 'FACTORY' ? input.id : warehouse?.factoryId
  const factory = factoryId ? getFactoryMasterRecordById(factoryId) : undefined
  const isDyeingFactory = classifyFactoryQcRecipient({ id: input.id, kind: input.kind, factoryType: input.factoryType, masterFactoryType: factory?.factoryType })
  return { id: input.id, name: input.name || input.id, kind: input.kind === 'FACTORY' ? 'FACTORY' : 'WAREHOUSE', ...(factoryId ? { factoryId } : { warehouseId: input.id }), isDyeingFactory }
}
function legacyHandout(taskId: string): boolean {
  return listHandoverOrdersByTaskId(taskId, { includeWool: false }).some(head => getPdaHandoverRecordsByHead(head.handoverId).some(row => row.handoverRecordStatus !== 'VOIDED' && !!row.factorySubmittedAt && (row.submittedQty ?? 0) > 0))
}
function addActualHandfeelTransfers(source: FactoryQcSource): FactoryQcSource {
  const sent = readFactoryQcState().handfeelOrders.filter(order => qcSourceKey(order.source) === qcSourceKey(source)).flatMap(order => order.rolls.filter(roll => !!roll.sentAt).map(roll => roll.sourceRollId))
  source.handedOutRollIds = [...new Set([...source.handedOutRollIds, ...sent])]
  for (const roll of source.rolls) if (source.handedOutRollIds.includes(roll.id)) roll.handedOut = true
  return source
}
export function listFactoryQcSources(scope?: Pick<FactoryQcSource, 'kind' | 'id'>): FactoryQcSource[] {
  // Commands already own one source identity. Read that current source through
  // its original getter; lists/discovery still enumerate the complete set.
  const printingViews = !scope ? listPrintingWorkOrders() : scope.kind === 'PRINTING' ? [getPrintingWorkOrderById(scope.id)].flatMap(view => view ? [view] : []) : []
  const printing = printingViews.flatMap(view => {
    const raw = getPrintWorkOrderById(view.workOrderId)
    if (!raw || raw.printOrderId.startsWith('PWO-WASH-DEMO-') || view.output.objectType === '纱线' || raw.status === 'CANCELLED') return []
    const batches = view.productionBatches ?? [], batchIds = new Set(batches.map(batch => batch.id))
    return [addActualHandfeelTransfers({ kind: 'PRINTING', id: raw.printOrderId, no: view.printOrderNo, taskId: raw.taskId, factoryId: raw.printFactoryId, factoryName: raw.printFactoryName, materialSku: view.output.sku, materialName: view.output.materialName, imageUrl: view.output.imageUrl, referenceImageUrl: view.output.imageUrl, requiredMaterialSku: view.plannedInput.sku, requirementVersion: String(view.requirementVersion), materialProperties: { composition: view.output.composition, gsm: view.output.gsm, widthCm: view.output.widthCm }, unit: view.output.qtyUnit, target: partner({ id: view.receivingTargetId, name: view.receivingTargetName || view.receivingTargetWarehouseName, kind: raw.receiverKind === 'FACTORY' ? 'FACTORY' : 'WAREHOUSE' }), hasFinalOutput: batches.some(batch => batch.qty > 0), completedAt: batches[0]?.at, rolls: view.barcodes.filter(roll => batchIds.has(roll.batchId || '')).map(roll => ({ id: roll.id, barcode: roll.barcode, batchId: roll.batchId || '', qty: roll.lengthY, unit: view.output.qtyUnit, confirmed: roll.quantityConfirmed === true, handedOut: ['已交出', '已入库'].includes(roll.status) })), handedOutRollIds: view.barcodes.filter(roll => ['已交出', '已入库'].includes(roll.status)).map(roll => roll.id).concat(view.handover.handedOverQty > 0 ? ['__ACTUAL_HANDOUT__'] : []), sourceNo: view.demandSource.sourceNo, sourceType: view.demandSource.type, productionOrderId: raw.sourceSnapshot?.productionOrderId || raw.sourceProductionOrderId, techPackVersionId: raw.sourceSnapshot?.techPackVersionId, demo: !!raw.factoryDemoInitialized })]
  })
  const dyeOrders = !scope ? listDyeWorkOrders() : scope.kind === 'DYEING' ? [getDyeWorkOrderById(scope.id)].flatMap(order => order ? [order] : []) : []
  const nodes = new Map(dyeOrders.length ? captureDyeProcessMutationState().nodeRecords : [])
  const dye = dyeOrders.filter(order => !isDyeYarnOrder(order)).map(order => {
    let target: QcPartner = { id: '', name: '接收方待核对', kind: 'UNKNOWN' }
    try { target = partner(getDyeDispatchPartner(order.dyeOrderId)) } catch { /* An unassigned downstream is not a non-dyeing factory. */ }
    let material = { sku: order.rawMaterialSku, name: order.stockMaterialName || order.rawMaterialSku, imageUrl: '', composition: order.composition || '' }
    try { material = getDyeDispatchMaterial(order.dyeOrderId) } catch { /* QC creation is not silently gated by material metadata. */ }
    const completed = [...(nodes.get(order.dyeOrderId) ?? []), ...(order.completedExecutionBatches ?? []).flat()].filter(node => node.nodeCode === 'PACK' && !!node.finishedAt && (node.outputQty ?? 0) > 0)
    return addActualHandfeelTransfers({ kind: 'DYEING', id: order.dyeOrderId, no: order.dyeOrderNo, taskId: order.taskId, factoryId: order.dyeFactoryId, factoryName: order.dyeFactoryName, materialSku: material.sku, materialName: material.name, imageUrl: material.imageUrl, referenceImageUrl: material.imageUrl, requiredMaterialSku: order.rawMaterialSku, requirementVersion: JSON.stringify([order.rawMaterialSku, order.targetColor, order.sourceSnapshot?.techPackVersionId]), materialProperties: { composition: material.composition, widthCm: parseFloat(order.width || '') || undefined, gsm: order.weightGsm }, unit: order.qtyUnit, target, hasFinalOutput: completed.length > 0, completedAt: completed[0]?.finishedAt, reportedRollCount: reportedDyeQcRollCount(completed), rolls: (order.outputRolls ?? []).map(roll => ({ id: roll.id, barcode: roll.barcode, batchId: roll.vatNo || order.dyeOrderId, qty: roll.qty, unit: order.qtyUnit, confirmed: roll.qty > 0, handedOut: !!roll.dispatchId && order.dispatchDocuments?.some(doc => doc.id === roll.dispatchId && doc.status === '已交出') })), handedOutRollIds: (order.outputRolls ?? []).filter(roll => !!roll.dispatchId && order.dispatchDocuments?.some(doc => doc.id === roll.dispatchId && doc.status === '已交出')).map(roll => roll.id).concat(legacyHandout(order.taskId) ? ['__ACTUAL_HANDOUT__'] : []), sourceNo: order.sourceProductionOrderNo, sourceType: order.sourceType, productionOrderId: order.sourceSnapshot?.productionOrderId || order.sourceProductionOrderId, techPackVersionId: order.sourceSnapshot?.techPackVersionId, demo: !!DYE_DEMO_DETAILS[order.dyeOrderId] })
  })
  const waterOrders = !scope ? listWaterSolubleWorkOrders() : scope.kind === 'WATER_SOLUBLE' ? [getWaterSolubleWorkOrderById(scope.id)].flatMap(order => order ? [order] : []) : []
  const waterViews = new Map((waterOrders.length ? listWaterOutputRows() : []).map(view => [view.orderId, view]))
  const water = waterOrders.map(order => {
    const view = waterViews.get(order.waterOrderId)
    let material = { sku: order.materialCode, name: order.materialName, imageUrl: '', composition: '' }
    try { material = getWaterSolubleReceivingMaterial(order.waterOrderId) } catch { /* Missing reference data is visible, not a hidden creation condition. */ }
    return addActualHandfeelTransfers({ kind: 'WATER_SOLUBLE', id: order.waterOrderId, no: order.waterOrderNo, taskId: order.taskId, factoryId: order.factoryId || '', factoryName: order.factoryName || '待分配', materialSku: material.sku, materialName: material.name, imageUrl: material.imageUrl, referenceImageUrl: material.imageUrl, requiredMaterialSku: order.materialCode, requirementVersion: order.techPackVersionId, materialProperties: { composition: material.composition }, unit: order.qtyUnit, target: partner(view?.downstreamPartner || {}), hasFinalOutput: waterSolubleHasFinalQcOutput(order.completedQty, order.status), completedAt: order.actionLogs.find(log => log.action === '完成水溶' || log.action === '主管确认按实际数量继续')?.at, rolls: (order.outputRolls ?? []).map(roll => ({ id: roll.id, barcode: roll.barcode, batchId: order.waterOrderId, qty: roll.qty, unit: order.qtyUnit, confirmed: roll.qty > 0, handedOut: !!roll.dispatchId && order.dispatchDocuments?.some(doc => doc.id === roll.dispatchId && doc.status === '已交出') })), handedOutRollIds: (order.outputRolls ?? []).filter(roll => !!roll.dispatchId && order.dispatchDocuments?.some(doc => doc.id === roll.dispatchId && doc.status === '已交出')).map(roll => roll.id).concat((order.handoverQty ?? 0) > 0 ? ['__ACTUAL_HANDOUT__'] : []), productionOrderId: order.productionOrderId, techPackVersionId: order.techPackVersionId, demo: !!order.handoverDemoSourceOrderId })
  })
  return [...printing, ...dye, ...water]
}
let staticState: FactoryQcState | undefined
function staticQc() {
  if (!staticState) {
    staticState = emptyFactoryQcState()
    const sources = listFactoryQcSources().filter(source => source.demo && source.hasFinalOutput && !!source.imageUrl)
    for (const kind of ['PRINTING', 'DYEING', 'WATER_SOLUBLE'] as const) for (const source of sources.filter(source => source.kind === kind).slice(0, 2)) upsertFactoryQc(staticState, source, source.completedAt || '2026-10-22 09:00:00')
  }
  return staticState
}
function visibleState(): FactoryQcState {
  const saved = readFactoryQcState(), demo = staticQc()
  return { ...saved, qcOrders: [...demo.qcOrders.filter(order => !saved.qcOrders.some(row => row.id === order.id)), ...saved.qcOrders] }
}
export async function ensureFactoryQcRecords(force = false) { await ensureRecords(force) }
/** Shipped and original finishing receipts read the process ledger without loading samples. */
export async function ensureFactoryQcViewRecords() { await ensureRecords(true, true) }
export const listFactoryQcOrders = (kind?: FactoryQcKind) => visibleState().qcOrders.filter(order => !kind || order.kind === kind)
export const getFactoryQcOrder = (id: string) => {
  const saved = readFactoryQcState().qcOrders.find(order => order.id === id)
  // Handfeel output QC is created from actual output, never a static demo.
  // A saved order or absent output QC needs no unrelated printing/dyeing scan.
  if (saved || id.startsWith(qcIdForSource({ kind: 'STENTER_HAND_FEEL', id: '' }))) return saved
  return staticQc().qcOrders.find(order => order.id === id)
}
export const listStenterHandfeelOrders = () => readFactoryQcState().handfeelOrders
export const getStenterHandfeelOrder = (id: string) => listStenterHandfeelOrders().find(order => order.id === id)
export const listFactoryQcActions = (id?: string) => readFactoryQcState().actions.filter(action => !id || action.orderId === id || action.qcId === id)
function sourceFor(qc: Pick<FactoryQcOrder, 'source'>): FactoryQcSource | undefined { return listFactoryQcSources(qc.source).find(source => qcSourceKey(source) === qcSourceKey(qc.source)) }
function adoptSource(source: FactoryQcSource) {
  const ids = new Set([source.id, source.taskId, ...source.rolls.map(roll => roll.id)])
  adoptFactoryProcessRows(row => ids.has(row.key) || ids.has((row.value as any)?.taskId) || ids.has((row.value as any)?.printingOrderId) || ids.has((row.value as any)?.dyeOrderId) || ids.has((row.value as any)?.waterOrderId) || (row.value as any)?.lines?.some((line: any) => ids.has(line.printingOrderId) || ids.has(line.dyeOrderId) || ids.has(line.waterOrderId) || ids.has(line.originPrintOrderId)))
}
async function execute(command: FactoryQcCommand, operationId: string, newFiles: Array<{ id: string; blob: Blob }> = []) {
  await ensureFactoryQcRetirement()
  await runFactoryQcRecordCommand(() => {
    const state = readFactoryQcState()
    if ('qcId' in command && !state.qcOrders.some(order => order.id === command.qcId)) { const demo = staticQc().qcOrders.find(order => order.id === command.qcId); if (demo) state.qcOrders.push(structuredClone(demo)) }
    const qc = 'qcId' in command ? state.qcOrders.find(order => order.id === command.qcId) : undefined
    const handfeel = 'orderId' in command ? state.handfeelOrders.find(order => order.id === command.orderId) : undefined
    const source = qc ? sourceFor(qc) : handfeel ? sourceFor(handfeel) : undefined
    const fresh = qc ? source : undefined
    if (typeof location !== 'undefined' && location.pathname.startsWith('/fcs/pda/') && handfeel) {
      const session = getPdaSession(), responsible = command.type === 'SEND' ? handfeel.source.factoryId : command.type === 'DOWNSTREAM_RECEIVE' ? handfeel.source.target.factoryId : STENTER_FACTORY.id
      if (!session || !responsible || session.factoryId !== responsible) throw new Error('当前工厂不能代其他工厂登记本项实物操作。')
    }
    if (command.type === 'SEND') {
      if (!source || source.handedOutRollIds.includes('__ACTUAL_HANDOUT__') && !handfeel?.rolls.some(roll => roll.sentAt)) throw new Error('来源已有实际交出，请重新核对原始移交记录。')
      for (const input of command.rolls) {
        const roll = source.rolls.find(roll => roll.id === input.id), planned = handfeel?.rolls.find(roll => roll.id === input.id)
        if (!roll || !planned || roll.handedOut || !roll.confirmed || roll.qty !== planned.inputQty || roll.barcode !== planned.barcode) throw new Error('来源卷已交出或实物资料已变化，本次未保存。')
      }
    }
    if (source) adoptSource(source)
    const next = applyFactoryQcCommand(state, command, actor(), operationId, new Date().toISOString(), fresh)
    applyPhysicalHandfeelEffects(state, next, command, operationId)
    stageFactoryQcState(next)
  }, operationId, JSON.stringify(command), newFiles)
}
export async function saveFactoryQcRoll(input: { qcId: string; rollId: string; expectedVersion: number; photos: FactoryQcPhoto[]; results: QcResults; notes: string; complete: boolean; newFiles?: File[] }, operationId: string) {
  await ensureFactoryQcRecords(true)
  const { newFiles: _, ...payload } = input
  if (listFactoryQcActions().some(action => action.id === operationId)) { await execute({ type: 'SAVE_ROLL', ...payload }, operationId); return }
  const prior = getFactoryQcOrder(input.qcId)?.rolls.find(roll => roll.id === input.rollId)
  if (prior?.completedAt) throw new Error('本卷已完成质检，不允许修改。')
  const photos = input.photos.filter(photo => !prior?.photos.some(old => old.id === photo.id)), picked = input.newFiles ?? []
  if (photos.length !== picked.length) throw new Error('照片与原始文件未对应，本次未保存。')
  const blobs = photos.map((photo, i) => { const file = picked[i]; if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024 || !file.size) throw new Error('照片支持JPEG、PNG、WebP，每张不超过10MB。'); if (photo.type !== file.type || photo.size !== file.size) throw new Error('照片元数据与原文件不符。'); return { id: photo.id, blob: file } })
  await assertFactoryQcFiles(input.photos.map(photo => photo.id), blobs)
  await execute({ type: 'SAVE_ROLL', ...payload }, operationId, blobs)
}
export const decideFactoryQcHandfeel = (input: { qcId: string; expectedVersion: number; needs: boolean; target?: HandFeel }, operationId: string) => execute({ type: 'DECIDE', ...input }, operationId)
export const submitStenterHandfeelCommand = (command: FactoryQcCommand, operationId: string) => execute(command, operationId)

/** Called from the existing awaited Web/PDA command boundary, never from a read. */
export async function runFactoryQcProcessCommand<T>(target: unknown, recipe: () => T): Promise<{ handled: boolean; result?: T }> {
  await ensureFactoryQcRecords()
  const text = JSON.stringify(target ?? ''), before = listFactoryQcSources(), dispatchIds = new Set(listDyeDispatchDocuments().filter(doc => text.includes(doc.id)).flatMap(doc => doc.lines.map(line => line.orderId)))
  const matched = before.filter(source => dispatchIds.has(source.id) || [source.id, source.no, source.taskId, ...source.rolls.map(roll => roll.id)].some(id => !!id && text.includes(id)))
  if (!matched.length) return { handled: false }
  await ensureFactoryQcRetirement()
  const result = await runFactoryQcRecordCommand(() => {
    for (const source of matched) adoptSource(source)
    const returned = recipe()
    const state = readFactoryQcState(), old = new Map(before.map(source => [qcSourceKey(source), JSON.stringify(source)]))
    for (const source of listFactoryQcSources()) if (JSON.stringify(source) !== old.get(qcSourceKey(source))) upsertFactoryQc(state, source, new Date().toISOString())
    stageFactoryQcState(state)
    return returned
  }, crypto.randomUUID(), 'factory-process:' + text)
  return { handled: true, result }
}

function applyPhysicalHandfeelEffects(before: FactoryQcState, after: FactoryQcState, command: FactoryQcCommand, operationId: string) {
  if (!('orderId' in command) || !('rolls' in command) || before.actions.some(action => action.id === operationId)) return
  const order = after.handfeelOrders.find(row => row.id === command.orderId)!, at = new Date().toISOString(), selected = order.rolls.filter(roll => command.rolls.some(line => line.id === roll.id))
  if (command.type === 'SEND' || command.type === 'HANDOUT') {
    const outbound = command.type === 'HANDOUT', target = outbound ? order.source.target : { id: STENTER_FACTORY.id, name: STENTER_FACTORY.name, factoryId: STENTER_FACTORY.id }
    registerFactoryReceivingSource({ id: 'SHF-TRANSFER-' + operationId, documentNo: order.no + '-' + operationId.slice(0, 8), type: 'HANDOUT', processCode: 'STENTER_HANDFEEL', origin: { kind: 'FACTORY', id: outbound ? STENTER_FACTORY.id : order.source.factoryId, name: outbound ? STENTER_FACTORY.name : order.source.factoryName, factoryType: outbound ? '染厂' : order.source.kind === 'PRINTING' ? '印花厂' : '染厂' }, targetFactoryId: target.factoryId || target.id, targetFactoryName: target.name, createdAt: at, createdBy: actor(), handedOutAt: at, workOrderNo: order.no, lines: [{ id: 'SHF-LINE-' + operationId, material: { sku: order.source.materialSku, name: order.source.materialName, kind: 'FABRIC', imageUrl: order.source.imageUrl, color: '按来源要求', composition: order.source.materialProperties?.composition || '', specification: order.source.requirementVersion, batchNo: order.id }, plannedQty: selected.reduce((sum, roll) => sum + (outbound ? roll.outputQty! : roll.inputQty), 0), sentQty: selected.reduce((sum, roll) => sum + (outbound ? roll.outputQty! : roll.inputQty), 0), unit: selected[0].unit, rolls: selected.map(roll => ({ barcode: outbound ? roll.outputBarcode! : roll.barcode, yard: outbound ? roll.outputQty! : roll.inputQty, qty: outbound ? roll.outputQty! : roll.inputQty, unit: roll.unit, originRollId: roll.sourceRollId })), label: order.no, stenterHandfeelOrderId: order.id, handfeelDirection: outbound ? 'AFTER_HANDFEEL' : 'TO_HANDFEEL', productionOrderNo: order.source.productionOrderId }] })
    if (!outbound && order.source.kind === 'PRINTING') markPrintingHandfeelTransfer(order.source.id, selected.map(roll => roll.sourceRollId), 'SHF-TRANSFER-' + operationId, actor(), at)
    if (!outbound && order.source.kind === 'DYEING') markDyeHandfeelTransfer(order.source.id, selected.map(roll => roll.sourceRollId), 'SHF-TRANSFER-' + operationId)
  }
  if (command.type === 'RECEIVE' || command.type === 'DOWNSTREAM_RECEIVE') {
    const outbound = command.type === 'DOWNSTREAM_RECEIVE', factoryId = outbound ? order.source.target.factoryId || order.source.target.id : STENTER_FACTORY.id
    if (outbound && order.source.target.kind === 'WAREHOUSE') return // Warehouse receipt remains the explicit per-roll fact in this order.
    const sources = listFactoryReceivingSources().filter(source => source.lines.some(line => line.stenterHandfeelOrderId === order.id && line.handfeelDirection === (outbound ? 'AFTER_HANDFEEL' : 'TO_HANDFEEL')))
    const bySource = new Map<string, any>()
    for (const input of command.rolls) {
      const roll = order.rolls.find(row => row.id === input.id)!, code = outbound ? roll.outputBarcode! : roll.barcode
      const source = sources.find(row => row.lines.some(line => line.rolls.some(item => item.barcode === code)))
      if (!source) throw new Error('未找到本卷真实移交来源，不能凭建单接收。')
      const position = { warehouseId: input.warehouseId || roll.warehouseId || '', locationId: input.locationId || roll.locationId || '' }; assertReceiptPosition(factoryId, position)
      const sourceLine = source.lines.find(line => line.rolls.some(item => item.barcode === code))!
      const key = source.id + '/' + sourceLine.id, line = bySource.get(key) || { sourceId: source.id, sourceLineId: sourceLine.id, ...position, businessQty: 0, businessUnit: roll.unit, rolls: [] }
      line.businessQty += input.qty!; line.rolls.push({ ...position, barcode: code, yard: input.qty!, qty: input.qty, unit: roll.unit, originRollId: roll.sourceRollId }); bySource.set(key, line)
    }
    const lines = [...bySource.values()]
    savePreparedFactoryReceipt(prepareFactoryReceipt({ id: 'SHF-RECEIPT-' + operationId, factoryId, operatorId: getPdaSession()?.userId || 'web-operator', operatorName: actor(), receivedAt: at, remark: outbound ? '手感产出逐卷实收' : 'GTG手感逐卷实收', lines }))
    if (!outbound && order.source.kind === 'PRINTING') markPrintingHandfeelTransfer(order.source.id, selected.map(roll => roll.sourceRollId), 'SHF-RECEIPT-' + operationId, actor(), at, selected.reduce((sum, roll) => sum + roll.receivedQty!, 0))
  }
  if (command.type === 'START') recordStenterHandfeelMaterialUsage({ id: 'SHF-USE-' + operationId, stenterHandfeelOrderId: order.id, factoryId: STENTER_FACTORY.id, operatorName: actor(), at, barcodes: selected.map(roll => roll.barcode) })
}
