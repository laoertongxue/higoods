import { getEffectiveTaskAssignment } from '../fcs/effective-task-assignments.ts'
import { getProductionOrderTechPackSnapshot } from '../fcs/production-order-tech-pack-runtime.ts'
import {
  initializeSewingMaterialHandoverForAssignment, getSewingMaterialHandoverProjection,
  installSewingMaterialHandoverBridge, captureSewingMaterialState,
  type SewingMaterialHandoverContext, type SewingMaterialHandoverEvent,
} from '../fcs/sewing-material-handover.ts'
import {
  installSewingPickupWarehouseBridge, readLegacySewingPickupStorage, cleanupLegacySewingPickupStorage,
  getCurrentSewingPickupSlip, getSewingPickupSlipVersion,
  type SewingPickupIssueInput, type SewingPickupConfirmInput, type SewingPickupSlipVersion, type SewingPickupSlipLine, type SewingPickupHandoverResult,
} from '../fcs/sewing-pickup-slips.ts'
import {
  createAccessoryPickup, createAccessoryPostTransfer, recordAccessoryPickup,
  type AccessoryPickup, type AccessoryPreparation, type AccessoryTransfer,
} from './accessory-warehouse-flow.ts'
import { getAccessorySewingTaskScopes, type AccessorySewingTaskScope } from './accessory-warehouse-task-scope.ts'
import { prepareAccessoryWarehouseSources, listAccessoryPreparations, listAccessoryWarehouseSourceIssues } from './accessory-warehouse-sources.ts'
import { accessoryRecord, findAccessoryRecord, listAccessoryRecords, saveAccessoryWarehouseAction, ensureAccessoryWarehouseRecords } from './accessory-warehouse-records.ts'
import { dispatchAccessoryPickupStock, getAccessoryStockAvailable, getAccessoryStockId, type AccessoryStock } from './accessory-warehouse-stock.ts'
import { listAccessoryStockSources } from './accessory-warehouse-stock-sources.ts'
import { listAccessoryWarehouses } from './accessory-warehouse-master.ts'
import type { AccessoryReceipt, AccessoryWarehouseActor } from './accessory-warehouse-commands.ts'
import { cuttingRecordFingerprint } from '../fcs/cutting/cutting-record-identity.ts'
import type { CuttingRecordChange } from '../fcs/cutting/cutting-record-repository.ts'

type Stored<T> = T & { id: string }
interface SewingMigration { id: string; phase: 'COPIED' | 'COMPLETE'; versionIds: string[]; resultIds: string[]; sourceFingerprint: string; migratedAt: string; migratedBy: string }
export interface AccessorySewingMigrationInspection { state: '无需迁移' | '待迁移' | '待清理' | '已完成' | '已阻塞'; versionCount: number; resultCount: number; message: string }
const migrationId = 'sewing-pickup-v1'
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000
function requireValue(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
const stored = <T>(value: T, id: string): Stored<T> => ({ ...structuredClone(value), id })
const preparationForOrder = (id: string) => listAccessoryPreparations().find(row => row.productionOrderId === id)
const owned = (assignmentId: string) => Boolean(preparationForOrder(getEffectiveTaskAssignment(assignmentId)?.productionOrderId || '') || listAccessoryRecords<Stored<SewingMaterialHandoverContext>>('sewing-context').some(row => row.assignmentId === assignmentId))
const versions = () => listAccessoryRecords<Stored<SewingPickupSlipVersion>>('sewing-slip').map(({ id: _id, ...row }) => row)
const results = () => listAccessoryRecords<Stored<SewingPickupHandoverResult>>('sewing-result').map(({ id: _id, ...row }) => row)
const contexts = () => listAccessoryRecords<Stored<SewingMaterialHandoverContext>>('sewing-context').map(({ id: _id, ...row }) => row)
const events = () => listAccessoryRecords<Stored<SewingMaterialHandoverEvent>>('sewing-handover').map(({ id: _id, ...row }) => row)
const warehouseName = (code: string) => listAccessoryWarehouses().find(row => row.code === code)?.name || code
export function listAccessorySewingPickups(warehouseCode?: string): AccessoryPickup[] {
  return listAccessoryRecords<AccessoryPickup>('pickup').filter(row => !warehouseCode || row.warehouseCode === warehouseCode)
}
export function getAccessorySewingPickup(id: string): AccessoryPickup | undefined { return listAccessorySewingPickups().find(row => row.id === id) }
function receivedForPreparation(preparation: AccessoryPreparation): AccessoryTransfer {
  const transfers = listAccessoryRecords<AccessoryTransfer>('transfer').filter(row => row.preparationId === preparation.id && row.kind !== 'SITE_TO_POST')
  const received = transfers.filter(row => row.status === '已收货' && !transfers.some(next => next.sourceTransferId === row.id))
  requireValue(received.length === 1, '辅料须先完成当前目的仓整单收货上架；存在改厂调拨时先完成当前流转。')
  return received[0]
}
function assertPreparation(preparation: AccessoryPreparation): void {
  const issue = listAccessoryWarehouseSourceIssues(preparation.id).find(row => row.blocking)
  requireValue(!issue, issue?.message || '辅料来源待核对。')
  const migration = inspectLegacySewingPickupMigration()
  requireValue(!['待迁移', '待清理', '已阻塞'].includes(migration.state), migration.message)
  const manifest = findAccessoryRecord<SewingMigration>('migration', migrationId)
  const migratedResults = results().filter(row => manifest?.resultIds?.includes(row.commandId))
  requireValue(!migratedResults.some(result => {
    const slip = versions().find(row => row.versionId === result.versionId && row.productionOrderId === preparation.productionOrderId)
    return slip && result.quantities.some(entry => entry.actualQty > 0 && slip.lines.some(line => line.lineId === entry.lineId && line.objectType === '辅料'))
  }), '原领料凭证已有辅料实交，但缺少可核对的仓库库位来源。历史已保留，须先核对原实物去向，不能建立新领料或再次扣库。')
}
function scopeContext(preparation: AccessoryPreparation, scope: AccessorySewingTaskScope): SewingMaterialHandoverContext {
  const assignment = getEffectiveTaskAssignment(scope.assignmentId)
  requireValue(assignment?.status === 'EFFECTIVE', '车缝分配已失效，请重新读取。')
  const original = initializeSewingMaterialHandoverForAssignment({ ...assignment, ppicId: assignment.ppicId!, ppicName: assignment.ppicName! })
  requireValue(original, '当前任务缺少车缝物料需求。')
  const snapshot = getProductionOrderTechPackSnapshot(preparation.productionOrderId)
  requireValue(snapshot, '当前生产单缺少冻结技术包。')
  const managed = new Map(scope.bomQuantities.map(row => [row.bomItemId, row]))
  const sewingBoms = new Set(scope.bomQuantities.filter(bom => {
    return preparation.lines.some(line => line.id === bom.sourceLineId && (scope.taskType !== 'SEWING' || ['价格吊牌', '品牌吊牌', '吊粒', '车缝线'].includes(line.purpose)))
  }).map(row => row.bomItemId))
  const requirementLines = original.requirementLines.filter(line => !managed.has(line.bomItemId) || sewingBoms.has(line.bomItemId)).map(line => {
    const bom = managed.get(line.bomItemId)
    return bom ? { ...line, assignedGarmentQty: bom.assignedGarmentQty, requiredQty: bom.requiredQty } : line
  }).filter(line => line.requiredQty > 0)
  for (const bom of scope.bomQuantities.filter(row => sewingBoms.has(row.bomItemId) && row.requiredQty > 0)) {
    if (requirementLines.some(line => line.bomItemId === bom.bomItemId)) continue
    const source = preparation.lines.find(row => row.id === bom.sourceLineId)!
    requirementLines.push({ requirementLineId: `MAT-REQ-${scope.assignmentId}-BOM-${encodeURIComponent(bom.bomItemId)}`, bomItemId: bom.bomItemId, materialType: '辅料', materialCode: source.materialSku, materialName: source.materialName, materialSpec: source.spec, unit: source.unit, unitConsumption: bom.unitConsumption, lossRate: bom.lossRate, assignedGarmentQty: bom.assignedGarmentQty, requiredQty: bom.requiredQty, imageUrl: source.imageUrl })
  }
  return { ...original, requirementLines, dataCompleteness: requirementLines.length ? 'COMPLETE' : 'MATERIAL_REQUIREMENT_MISSING' }
}
function scopeForPickup(pickup: AccessoryPickup): { preparation: AccessoryPreparation; transfer: AccessoryTransfer; scope: AccessorySewingTaskScope; context: SewingMaterialHandoverContext } {
  requireValue(pickup.status !== '已失效', '该领料清单已失效，请从当前仓库清单办理。')
  const preparation = listAccessoryPreparations().find(row => row.id === pickup.preparationId)
  requireValue(preparation, '配料来源已变化，请重新读取。')
  const transfer = receivedForPreparation(preparation)
  requireValue(transfer.id === pickup.sourceTransferId && transfer.toWarehouse === pickup.warehouseCode, '领料仓已发生变化，旧清单不能继续交出。')
  const scope = getAccessorySewingTaskScopes(preparation, transfer).find(row => row.assignmentId === pickup.assignmentId)
  requireValue(scope && scope.taskVersion === pickup.taskVersion, '车缝任务、SKU 或分配版本已变化，旧清单不能继续交出。')
  const context = scopeContext(preparation, scope)
  for (const [fragmentId] of Object.entries(scope.sewingQuantitiesByLine)) {
    const sourceLineId = transfer.lines.find(line => line.id === fragmentId)?.sourceLineId || fragmentId
    const bom = scope.bomQuantities.find(row => row.sourceLineId === sourceLineId)
    const requirement = context.requirementLines.find(row => row.bomItemId === bom?.bomItemId)
    requireValue(requirement, '领料明细无法关联当前车缝实交账。')
    scope.requirementLineIdByLine[fragmentId] = requirement.requirementLineId
  }
  return { preparation, transfer, scope, context }
}

export function getAccessorySewingPickupPath(assignmentId: string, versionId?: string): string | undefined {
  const pickup = listAccessorySewingPickups().find(row => row.assignmentId === assignmentId && row.status !== '已失效')
  if (!pickup) return undefined
  const key = listAccessoryWarehouses().find(row => row.code === pickup.warehouseCode)?.key
  return key ? `/wls/accessory-warehouses/${key}/pickups?pickupId=${encodeURIComponent(pickup.id)}${versionId ? `&versionId=${encodeURIComponent(versionId)}` : ''}` : undefined
}
/** 页面独立读取；安装的是原实交账/凭证的受限桥，普通访问不生成单据。 */
export async function prepareAccessorySewing(options:{readOnly?:boolean}={}): Promise<void> {
  await prepareAccessoryWarehouseSources({postFinishingReadOnly:options.readOnly})
  installSewingMaterialHandoverBridge({ context: id => contexts().find(row => row.assignmentId === id), contexts, events: id => events().filter(row => row.assignmentId === id), ownsLines: (id, lines) => {
    if (!owned(id)) return false
    const context = contexts().find(row => row.assignmentId === id) || captureSewingMaterialState().contexts.find(([key]) => key === id)?.[1]
    const preparation = preparationForOrder(context?.productionOrderId || getEffectiveTaskAssignment(id)?.productionOrderId || '')
    return lines.some(lineId => context?.requirementLines.some(line => line.requirementLineId === lineId && line.materialType !== '面料' && preparation?.lines.some(source => source.materialSku === line.materialCode)))
  } })
  installSewingPickupWarehouseBridge({ ownsAssignment: owned, usesCanonical: id => owned(id) && (Boolean(findAccessoryRecord<SewingMigration>('migration', migrationId)) || contexts().some(row => row.assignmentId === id) || versions().some(row => row.assignmentId === id)), versions, results, availability: (id, kind) => {
    try { scopedPrintData(id, kind); return { available: true, reason: '' } }
    catch (error) { return { available: false, reason: error instanceof Error ? error.message : String(error) } }
  }, issue: issueAccessorySewingPickupSlip, record: recordManagedLegacyFabricHandover, pickupPath: getAccessorySewingPickupPath })
}

/** 显式动作，按每个有效分配建立本任务辅料清单与独立车缝的后道调拨。 */
export async function createAccessorySewingPickups(input: { preparationId: string; commandId: string; at: string; actor: AccessoryWarehouseActor }): Promise<{ pickups: AccessoryPickup[]; postTransfers: AccessoryTransfer[] }> {
  const preparation = listAccessoryPreparations().find(row => row.id === input.preparationId)
  requireValue(preparation, '没有找到当前配料单。')
  const transfer = receivedForPreparation(preparation)
  requireActor(input.actor, transfer.toWarehouse!)
  await migrateLegacySewingPickupSlips({ commandId: `${input.commandId}:legacy`, at: input.at, by: input.actor.name })
  assertPreparation(preparation)
  const scopes = getAccessorySewingTaskScopes(preparation, transfer)
  const pickups: AccessoryPickup[] = [], postTransfers: AccessoryTransfer[] = [], puts: CuttingRecordChange['puts'] = []
  for (const scope of scopes) {
    const id = `ACCESSORY-PICKUP:${transfer.id}:${scope.assignmentId}`
    const existing = getAccessorySewingPickup(id)
    const context = scopeContext(preparation, scope)
    puts.push(accessoryRecord('sewing-context', scope.assignmentId, stored(context, scope.assignmentId)))
    if (Object.keys(scope.sewingQuantitiesByLine).length) {
      const pickup = createAccessoryPickup(transfer, { id, ...scope, quantitiesByLine: scope.sewingQuantitiesByLine })
      if (existing) requireValue(existing.taskVersion === scope.taskVersion && JSON.stringify(existing.lines.map(row => [row.id, row.requiredQty])) === JSON.stringify(pickup.lines.map(row => [row.id, row.requiredQty])), '已建立的领料清单范围已变化，须先核对原实交。')
      else puts.push(accessoryRecord('pickup', pickup.id, pickup))
      pickups.push(existing || pickup)
    }
    if (Object.keys(scope.postQuantitiesByLine).length) {
      const post = createAccessoryPostTransfer(transfer, { id: `ACCESSORY-POST:${transfer.id}:${scope.assignmentId}`, taskType: scope.taskType, responsibilityKey: scope.taskVersion, quantitiesByLine: scope.postQuantitiesByLine, at: input.at, by: input.actor.name })
      const existingPost = findAccessoryRecord<AccessoryTransfer>('transfer', post.id)
      if (existingPost) requireValue(existingPost.responsibilityKey === post.responsibilityKey, '既有后道调拨的任务责任已变化，须核对原单。')
      else {
        puts.push(accessoryRecord('transfer', post.id, post))
        const receipt: AccessoryReceipt = { id: `ACCESSORY-RECEIPT:${post.id}`, transferId: post.id, warehouseCode: 'DLN', version: 1, status: '待收货', lines: [] }
        puts.push(accessoryRecord('receipt', receipt.id, receipt))
      }
      postTransfers.push(existingPost || post)
    }
  }
  requireValue(puts.some(row => row.collection.endsWith(':pickup') || row.collection.endsWith(':transfer')), '当前有效任务已建立领料和后道清单，无需重复建立。')
  return saveAccessoryWarehouseAction({ commandId: input.commandId, intent: `create-sewing-pickups:${transfer.id}`, result: { pickups, postTransfers }, change: { puts }, assertSourcesCurrent: () => {
    assertPreparation(preparation)
    requireValue(JSON.stringify(getAccessorySewingTaskScopes(preparation, transfer).map(row => row.taskVersion)) === JSON.stringify(scopes.map(row => row.taskVersion)), '任务分配发生变化，请重新读取后办理。')
  } })
}
function requireActor(actor: AccessoryWarehouseActor, warehouseCode: string): void {
  requireValue(actor.role === '仓管' && actor.warehouseCode === warehouseCode && actor.name.trim(), '只能由本仓仓管确认实交，PPIC 和领料工厂只可查看。')
}
function scopedPrintData(assignmentId: string, kind: SewingPickupIssueInput['objectKind']): { pickup: AccessoryPickup; preparation: AccessoryPreparation; scope: AccessorySewingTaskScope; context: SewingMaterialHandoverContext; lines: SewingPickupSlipLine[] } {
  requireValue(kind !== 'CUT_PIECE', '裁片领料旧入口已退役，请打印当前任务单。')
  const pickup = listAccessorySewingPickups().find(row => row.assignmentId === assignmentId && row.status !== '已失效')
  requireValue(pickup, '目的仓尚未按有效车缝任务建立领料清单。')
  const { preparation, scope, context } = scopeForPickup(pickup)
  assertPreparation(preparation)
  requireValue((scope.taskType === 'CUTTING_SEWING_IRONING_PACKING' ? 'FABRIC_ACCESSORY' : 'ACCESSORY') === kind, '凭证类型与当前任务责任不一致。')
  const projection = getSewingMaterialHandoverProjection(assignmentId)
  const handed = new Map(projection.lines.map(row => [row.requirementLineId, row.cumulativeHandedOverQty]))
  const lines = context.requirementLines.filter(row => kind === 'FABRIC_ACCESSORY' || row.materialType === '辅料').map(row => ({
    lineId: `PICKUP-LINE-${row.requirementLineId}`, sourceLineId: row.requirementLineId, objectType: row.materialType, objectCode: row.materialCode, objectName: row.materialName,
    color: row.materialSpec || '按技术包', size: '不适用', part: row.materialType === '面料' ? '面料 · 原物料交出仓' : `辅料 · ${warehouseName(pickup.warehouseCode)}`,
    unit: row.unit, requiredQty: row.requiredQty, previouslyHandedOverQty: handed.get(row.requirementLineId) || 0, availableQty: round(Math.max(0, row.requiredQty - (handed.get(row.requirementLineId) || 0))), imageUrl: row.imageUrl || '',
  }))
  requireValue(preparation.styleImageUrl && lines.length && lines.every(row => row.imageUrl), '款式或当前领料物料缺少对应正式图片，不能打印。')
  return { pickup, preparation, scope, context, lines }
}
export async function issueAccessorySewingPickupSlip(input: SewingPickupIssueInput): Promise<SewingPickupSlipVersion> {
  const { pickup, preparation, scope, context, lines } = scopedPrintData(input.assignmentId, input.objectKind)
  requireValue(scope.ppicId === input.printedByPpicId && scope.ppicName === input.printedByPpicName, '只能由当前任务冻结 PPIC 打印领料单。')
  const id = `PPIC-PICKUP-${input.assignmentId}-${input.objectKind}`
  const previous = getCurrentSewingPickupSlip(input.assignmentId, input.objectKind)
  // 改厂会作废所有当前版；版本序号仍须跨全部历史单调递增，不能复用已作废身份。
  const priorVersions = versions().filter(row => row.slipId === id)
  const versionNo = Math.max(0, previous?.versionNo || 0, ...priorVersions.map(row => row.versionNo)) + 1
  const version: SewingPickupSlipVersion = { slipId: id, slipNo: `LL-${scope.taskNo}-${input.objectKind === 'ACCESSORY' ? 'ACC' : 'MAT'}`, versionId: `${id}-V${versionNo}`, versionNo, versionLabel: `V${versionNo}`, status: 'CURRENT', assignmentId: scope.assignmentId, runtimeTaskId: scope.taskId, taskNo: scope.taskNo, productionOrderId: preparation.productionOrderId, productionOrderNo: preparation.productionOrderNo, taskKindLabel: ({ SEWING: '独立车缝', SEWING_IRONING_PACKING: '车缝+烫包', CUTTING_SEWING_IRONING_PACKING: '裁剪+车缝+烫包' })[scope.taskType], factoryId: scope.factoryId, factoryName: scope.factoryName, ppicId: scope.ppicId, ppicName: scope.ppicName, warehouseName: input.objectKind === 'FABRIC_ACCESSORY' ? `${warehouseName(pickup.warehouseCode)}（辅料） / 原物料仓（面料）` : warehouseName(pickup.warehouseCode), objectKind: input.objectKind, styleCode: getProductionOrderTechPackSnapshot(preparation.productionOrderId)?.styleCode || preparation.productionOrderNo, styleName: preparation.styleName, styleImageUrl: preparation.styleImageUrl, lines, printedAt: input.printedAt, printedByPpicId: input.printedByPpicId, printedByPpicName: input.printedByPpicName, ...(previous ? { reprintReason: input.reprintReason?.trim() || 'PPIC任务页补打' } : {}) }
  const puts = [accessoryRecord('sewing-slip', version.versionId, stored(version, version.versionId)), accessoryRecord('sewing-context', context.assignmentId, stored(context, context.assignmentId))]
  if (previous) puts.push(accessoryRecord('sewing-slip', previous.versionId, stored({ ...previous, status: 'VOIDED' as const, voidedAt: input.printedAt }, previous.versionId)))
  return saveAccessoryWarehouseAction({ commandId: `print:${version.versionId}`, intent: `issue-sewing-slip:${id}:${versionNo}`, result: version, change: { puts }, assertSourcesCurrent: () => { const current = scopeForPickup(pickup); assertPreparation(current.preparation); requireValue(current.scope.taskVersion === scope.taskVersion, '任务范围已变化，请重新读取。') } })
}

/** 纯计算：新领料量、共享实物库存、原实交账事件与当前凭证引用一次保存。 */
export function buildAccessorySewingHandover(input: { pickup: AccessoryPickup; scope: AccessorySewingTaskScope; context: SewingMaterialHandoverContext; version: SewingPickupSlipVersion; stocks: readonly AccessoryStock[]; entries: readonly { lineId: string; qty: number }[]; actor: AccessoryWarehouseActor; commandId: string; at: string }): { pickup: AccessoryPickup; event: SewingMaterialHandoverEvent; result: SewingPickupHandoverResult; change: CuttingRecordChange } {
  requireActor(input.actor, input.pickup.warehouseCode)
  const { version, context, pickup, scope } = input
  requireValue(version.status === 'CURRENT' && version.assignmentId === pickup.assignmentId && version.runtimeTaskId === pickup.taskId && version.factoryId === pickup.factoryId && version.ppicId === context.ppicId, '领料凭证不属于当前任务、工厂或 PPIC。')
  const availableByLine: Record<string, number> = {}
  for (const line of pickup.lines) {
    const stock = input.stocks.find(row => row.id === getAccessoryStockId(pickup.warehouseCode, line.fromLocationId, line.materialSku, line.unit))
    availableByLine[line.id] = stock ? getAccessoryStockAvailable(stock) : 0
  }
  const next = recordAccessoryPickup(pickup, { taskVersion: scope.taskVersion, role: 'WAREHOUSE', entries: input.entries, at: input.at, by: input.actor.name }, availableByLine)
  const stock = dispatchAccessoryPickupStock(input.stocks, pickup, input.entries, { operationId: input.commandId, expectedVersions: Object.fromEntries(input.stocks.map(row => [row.id, row.version])) })
  const aggregated = new Map<string, number>()
  for (const entry of input.entries) {
    const requirementId = scope.requirementLineIdByLine[entry.lineId]
    requireValue(requirementId && version.lines.some(row => row.sourceLineId === requirementId && row.objectType === '辅料'), '本仓领料明细与当前凭证明细不一致。')
    aggregated.set(requirementId, round((aggregated.get(requirementId) || 0) + entry.qty))
  }
  const sourceRecordId = `PPIC-PICKUP-HAND-${input.commandId}`, sourceRecordNo = `${version.slipNo}-${input.commandId.slice(-6)}`
  const event: SewingMaterialHandoverEvent = { handoverEventId: `MAT-HAND-${input.commandId}`, commandId: input.commandId, assignmentId: pickup.assignmentId, runtimeTaskId: pickup.taskId, sourceRecordId, sourceRecordNo, handedOverAt: input.at, handedOverBy: input.actor.name, handedOverByRole: 'MATERIAL_WAREHOUSE', lines: [...aggregated].map(([requirementLineId, actualQty]) => {
    const line = context.requirementLines.find(row => row.requirementLineId === requirementLineId)
    requireValue(line && line.materialType !== '面料', '本仓只确认对应辅料，面料须从原物料入口交出。')
    const previously = pickup.lines.filter(row => scope.requirementLineIdByLine[row.id] === requirementLineId).reduce((sum, row) => sum + row.handedQty, 0)
    requireValue(Math.abs((scope.cumulativeHandedQtyByRequirement[requirementLineId] || 0) - previously) < 0.000001, '原实交账与本仓领料累计不一致，先核对历史，不能再次扣减实物。')
    return { requirementLineId, actualQty, materialCode: line.materialCode, materialName: line.materialName, unit: line.unit }
  }) }
  const result: SewingPickupHandoverResult = { commandId: input.commandId, versionId: version.versionId, sourceRecordId, sourceRecordNo, recordedAt: input.at, recordedBy: input.actor.name, actorFactoryId: input.actor.warehouseCode, objectKind: version.objectKind, recordedByRole: 'MATERIAL_WAREHOUSE', quantities: [...aggregated].map(([requirementId, actualQty]) => ({ lineId: version.lines.find(row => row.sourceLineId === requirementId)!.lineId, actualQty })) }
  return { pickup: next, event, result, change: { puts: [accessoryRecord('pickup', next.id, next), ...stock.changed.map(row => accessoryRecord('stock', row.id, row)), accessoryRecord('sewing-handover', event.handoverEventId, stored(event, event.handoverEventId)), accessoryRecord('sewing-result', result.commandId, stored(result, result.commandId)), accessoryRecord('sewing-slip', version.versionId, stored(version, version.versionId)), accessoryRecord('sewing-context', context.assignmentId, stored(context, context.assignmentId))] } }
}
export async function confirmAccessorySewingPickup(input: { pickupId: string; versionId: string; entries: readonly { lineId: string; qty: number }[]; actor: AccessoryWarehouseActor; commandId: string; at: string }): Promise<SewingPickupHandoverResult> {
  const pickup = getAccessorySewingPickup(input.pickupId)
  requireValue(pickup, '领料清单不存在，请重新读取。')
  requireActor(input.actor, pickup.warehouseCode)
  await migrateLegacySewingPickupSlips({ commandId: `${input.commandId}:legacy`, at: input.at, by: input.actor.name })
  const { preparation, scope, context } = scopeForPickup(pickup)
  assertPreparation(preparation)
  const prior = results().find(row => row.commandId === input.commandId)
  if (prior) {
    const quantities = new Map<string, number>()
    for (const entry of input.entries) { const requirement = scope.requirementLineIdByLine[entry.lineId]; requireValue(requirement, '重复确认的明细来源已变化。'); quantities.set(`PICKUP-LINE-${requirement}`, round((quantities.get(`PICKUP-LINE-${requirement}`) || 0) + entry.qty)) }
    requireValue(prior.versionId === input.versionId && prior.recordedBy === input.actor.name && prior.actorFactoryId === input.actor.warehouseCode && prior.quantities.length === quantities.size && prior.quantities.every(row => quantities.get(row.lineId) === row.actualQty), '同一确认编号对应的数量或责任人不同，未重复办理。')
    return structuredClone(prior)
  }
  const version = getSewingPickupSlipVersion(input.versionId), current = getCurrentSewingPickupSlip(pickup.assignmentId, version?.objectKind || 'ACCESSORY')
  requireValue(version && current?.versionId === version.versionId && version.status === 'CURRENT', '该二维码版本已失效，请使用当前 PPIC 领料凭证。')
  const built = buildAccessorySewingHandover({ pickup, scope, context, version, stocks: listAccessoryStockSources(listAccessoryRecords<AccessoryStock>('stock')), entries: input.entries, actor: input.actor, commandId: input.commandId, at: input.at })
  return saveAccessoryWarehouseAction({ commandId: input.commandId, intent: `sewing-handover:${pickup.id}:${version.versionId}`, result: built.result, change: built.change, assertSourcesCurrent: () => {
    const latest = scopeForPickup(pickup); assertPreparation(latest.preparation)
    requireValue(getCurrentSewingPickupSlip(pickup.assignmentId, version.objectKind)?.versionId === version.versionId, 'PPIC 已补打新版本，请重新扫描。')
  } })
}

/** 混合凭证仍保留原面料办理；本仓辅料只能走有库存扣减的仓库动作。 */
async function recordManagedLegacyFabricHandover(input: SewingPickupConfirmInput): Promise<SewingPickupHandoverResult> {
  requireValue(input.recordedByRole === 'MATERIAL_WAREHOUSE' && input.recordedBy.trim(), '面料实交须由原交出仓库确认，PPIC 不能代确认。')
  const prior = results().find(row => row.commandId === input.commandId)
  if (prior) { requireValue(prior.versionId === input.versionId && prior.recordedBy === input.recordedBy && prior.actorFactoryId === input.actorFactoryId && JSON.stringify(prior.quantities) === JSON.stringify(input.quantities), '同一确认编号的面料明细已变化，未重复办理。'); return structuredClone(prior) }
  const version = getSewingPickupSlipVersion(input.versionId)
  requireValue(version && version.objectKind !== 'CUT_PIECE' && version.status === 'CURRENT' && getCurrentSewingPickupSlip(version.assignmentId, version.objectKind)?.versionId === version.versionId, '凭证版本已失效，请扫描当前版本。')
  const pickup = listAccessorySewingPickups().find(row => row.assignmentId === version.assignmentId && row.status !== '已失效')
  requireValue(pickup, '当前任务缺少有效仓库领料清单。')
  const { preparation, context } = scopeForPickup(pickup); assertPreparation(preparation)
  requireValue(input.quantities.length && new Set(input.quantities.map(row => row.lineId)).size === input.quantities.length, '本次面料实交明细为空或重复。')
  const projection = getSewingMaterialHandoverProjection(version.assignmentId)
  const lines = input.quantities.map(entry => {
    const slipLine = version.lines.find(row => row.lineId === entry.lineId)
    requireValue(slipLine?.objectType === '面料', '辅料须到对应辅料仓办理车缝领料，不能在原物料入口重复交出。')
    const requirement = context.requirementLines.find(row => row.requirementLineId === slipLine.sourceLineId)
    const remaining = projection.lines.find(row => row.requirementLineId === slipLine.sourceLineId)?.shortageQty || 0
    requireValue(requirement && Number.isFinite(entry.actualQty) && entry.actualQty > 0 && entry.actualQty <= remaining, '本次面料实交超过当前待交数量或数量无效。')
    return { requirementLineId: requirement.requirementLineId, actualQty: entry.actualQty, materialCode: requirement.materialCode, materialName: requirement.materialName, unit: requirement.unit }
  })
  const sourceRecordId = `PPIC-PICKUP-HAND-${input.commandId}`, sourceRecordNo = `${version.slipNo}-${input.commandId.slice(-6)}`
  const event: SewingMaterialHandoverEvent = { handoverEventId: `MAT-HAND-${input.commandId}`, commandId: input.commandId, assignmentId: version.assignmentId, runtimeTaskId: version.runtimeTaskId, sourceRecordId, sourceRecordNo, handedOverAt: input.recordedAt, handedOverBy: input.recordedBy, handedOverByRole: 'MATERIAL_WAREHOUSE', lines }
  const result: SewingPickupHandoverResult = { ...input, recordedByRole: 'MATERIAL_WAREHOUSE', sourceRecordId, sourceRecordNo, objectKind: version.objectKind }
  return saveAccessoryWarehouseAction({ commandId: input.commandId, intent: `legacy-fabric-handover:${version.versionId}`, result, change: { puts: [accessoryRecord('sewing-handover', event.handoverEventId, stored(event, event.handoverEventId)), accessoryRecord('sewing-result', result.commandId, stored(result, result.commandId)), accessoryRecord('sewing-slip', version.versionId, stored(version, version.versionId))] }, assertSourcesCurrent: () => { assertPreparation(preparation); scopeForPickup(pickup); requireValue(getCurrentSewingPickupSlip(version.assignmentId, version.objectKind)?.versionId === version.versionId, '凭证已补打，请重新扫描。') } })
}

function sameLegacyRow(canonical: unknown, legacy: unknown): boolean {
  if (!canonical || !legacy) return false
  const { id: _canonicalId, ...value } = canonical as Record<string, unknown>
  const { id: _legacyId, ...original } = legacy as Record<string, unknown>
  return JSON.stringify(value) === JSON.stringify(original)
}
export function inspectLegacySewingPickupMigration(): AccessorySewingMigrationInspection {
  const manifest = findAccessoryRecord<SewingMigration>('migration', migrationId)
  try {
    const legacy = readLegacySewingPickupStorage()
    const relevant = legacy.versions.filter(row => preparationForOrder(row.productionOrderId) && row.objectKind !== 'CUT_PIECE')
    const ids = new Set(relevant.map(row => row.versionId)), count = legacy.handoverResults.filter(row => ids.has(row.versionId)).length
    if (manifest?.phase === 'COMPLETE' && relevant.length) return { state: '已阻塞', versionCount: relevant.length, resultCount: count, message: '旧页面再次写入了本范围车缝领料资料。新旧事实尚未核对，保留原资料并停止办理。' }
    if (manifest?.phase === 'COPIED' && (relevant.some(row => !manifest.versionIds.includes(row.versionId) || !sameLegacyRow(versions().find(saved => saved.versionId === row.versionId), row)) || legacy.handoverResults.some(row => ids.has(row.versionId) && (!manifest.resultIds.includes(row.commandId) || !sameLegacyRow(results().find(saved => saved.commandId === row.commandId), row))))) return { state: '已阻塞', versionCount: relevant.length, resultCount: count, message: '旧标签页在迁移后修改了受管领料资料，新旧内容不同，已保留原资料并停止清理。' }
    if (manifest?.phase === 'COPIED') return { state: '待清理', versionCount: relevant.length, resultCount: count, message: '车缝领料历史已保存，须继续回读核对并清理已验证旧项。' }
    return { state: relevant.length ? '待迁移' : manifest ? '已完成' : '无需迁移', versionCount: relevant.length, resultCount: count, message: relevant.length ? '本生产范围存在旧 PPIC 领料凭证及实交历史，请先迁移，避免重复交出。' : '' }
  } catch (error) {
    if (manifest?.phase === 'COMPLETE') return { state: '已完成', versionCount: 0, resultCount: 0, message: '旧领料键无法读取，当前使用已迁移资料。' }
    return { state: '已阻塞', versionCount: 0, resultCount: 0, message: `旧领料资料无法核对，未改动原资料。${error instanceof Error ? error.message : String(error)}` }
  }
}
export async function migrateLegacySewingPickupSlips(input: { commandId: string; at: string; by: string }): Promise<AccessorySewingMigrationInspection> {
  requireValue(input.by.trim(), '需要迁移操作人。')
  const inspection = inspectLegacySewingPickupMigration()
  requireValue(inspection.state !== '已阻塞', inspection.message)
  if (['无需迁移', '已完成'].includes(inspection.state)) return inspection
  const legacy = readLegacySewingPickupStorage()
  let manifest = findAccessoryRecord<SewingMigration>('migration', migrationId)
  if (!manifest) {
    const scoped = legacy.versions.filter(row => preparationForOrder(row.productionOrderId) && row.objectKind !== 'CUT_PIECE')
    const versionIds = new Set(scoped.map(row => row.versionId))
    const scopedResults = legacy.handoverResults.filter(row => versionIds.has(row.versionId))
    requireValue(versionIds.size === scoped.length && scoped.every(row => row.versionId && row.slipId && row.assignmentId && row.runtimeTaskId && row.productionOrderId && Number.isSafeInteger(row.versionNo) && row.versionNo > 0 && ['CURRENT', 'VOIDED'].includes(row.status)), '旧领料凭证身份、版本或状态重复/无效，保留原资料。')
    requireValue(new Set(scoped.filter(row => row.status === 'CURRENT').map(row => row.slipId)).size === scoped.filter(row => row.status === 'CURRENT').length, '旧领料凭证存在多个当前版本，保留原资料并停止迁移。')
    requireValue(new Set(scopedResults.map(row => row.commandId)).size === scopedResults.length && scopedResults.every(row => row.commandId && row.sourceRecordId && row.sourceRecordNo && row.recordedAt && row.recordedBy), '旧领料实交身份缺失或重复，保留原资料。')
    const puts: CuttingRecordChange['puts'] = []
    const originalEvents = captureSewingMaterialState().events.map(([, row]) => row)
    for (const version of scoped) {
      requireValue(version.lines.every(row => row.lineId && row.sourceLineId && row.unit && Number.isFinite(row.requiredQty) && row.requiredQty >= 0 && !/^(data:|blob:)/.test(row.imageUrl)), '旧领料明细或图片引用无法完整核对，保留原资料。')
      requireValue(!versions().some(row => row.versionId === version.versionId), '旧领料凭证与已保存版本冲突，未覆盖。')
      puts.push(accessoryRecord('sewing-slip', version.versionId, stored(version, version.versionId)))
      const assignment = getEffectiveTaskAssignment(version.assignmentId)
      const context: SewingMaterialHandoverContext = { assignmentId: version.assignmentId, runtimeTaskId: version.runtimeTaskId, productionOrderId: version.productionOrderId, productionOrderNo: version.productionOrderNo, taskNo: version.taskNo, factoryId: version.factoryId, factoryName: version.factoryName, ppicId: version.ppicId, ppicName: version.ppicName, dataCompleteness: 'COMPLETE', requirementLines: version.lines.map(row => ({ requirementLineId: row.sourceLineId, bomItemId: getProductionOrderTechPackSnapshot(version.productionOrderId)?.bomItems.find(bom => (bom.materialCode || bom.materialSkuId || bom.id) === row.objectCode)?.id || row.sourceLineId, materialType: row.objectType === '面料' ? '面料' : '辅料', materialCode: row.objectCode, materialName: row.objectName, materialSpec: row.color, unit: row.unit, unitConsumption: 0, lossRate: 0, assignedGarmentQty: assignment?.assignedQty || 0, requiredQty: row.requiredQty, imageUrl: row.imageUrl })) }
      const existing = puts.find(row => row.id === accessoryRecord('sewing-context', version.assignmentId, {}).id)
      if (!existing || version.status === 'CURRENT') { const row = accessoryRecord('sewing-context', version.assignmentId, stored(context, version.assignmentId)); if (existing) puts.splice(puts.indexOf(existing), 1, row); else puts.push(row) }
    }
    for (const result of scopedResults) {
      const version = scoped.find(row => row.versionId === result.versionId)!
      requireValue(result.quantities.length && result.quantities.every(row => version.lines.some(line => line.lineId === row.lineId) && Number.isFinite(row.actualQty) && row.actualQty > 0), '旧实交明细引用缺失或数量无效，保留原资料。')
      const event = originalEvents.find(row => row.commandId === result.commandId) || { handoverEventId: `MAT-HAND-LEGACY-${result.sourceRecordId}`, commandId: result.commandId, assignmentId: version.assignmentId, runtimeTaskId: version.runtimeTaskId, sourceRecordId: result.sourceRecordId, sourceRecordNo: result.sourceRecordNo, handedOverAt: result.recordedAt, handedOverBy: result.recordedBy, handedOverByRole: result.recordedByRole, lines: result.quantities.map(entry => { const line = version.lines.find(row => row.lineId === entry.lineId)!; return { requirementLineId: line.sourceLineId, actualQty: entry.actualQty, materialCode: line.objectCode, materialName: line.objectName, unit: line.unit } }) }
      puts.push(accessoryRecord('sewing-handover', event.handoverEventId, stored(event, event.handoverEventId)), accessoryRecord('sewing-result', result.commandId, stored(result, result.commandId)))
    }
    manifest = { id: migrationId, phase: 'COPIED', versionIds: scoped.map(row => row.versionId), resultIds: scopedResults.map(row => row.commandId), sourceFingerprint: await cuttingRecordFingerprint(legacy.raw || 'null'), migratedAt: input.at, migratedBy: input.by }
    puts.push(accessoryRecord('migration', migrationId, manifest))
    await saveAccessoryWarehouseAction({ commandId: `${input.commandId}:copy`, intent: 'migrate-sewing-pickup-slips', result: manifest, change: { puts }, assertSourcesCurrent: () => { requireValue(readLegacySewingPickupStorage().raw === legacy.raw, '旧领料资料已变化，请刷新后重试。') } })
  }
  await ensureAccessoryWarehouseRecords()
  // LS 与 IDB 不跨库假装原子：COPIED 进度先保存，重新读取目标并逐条核验后只清对应条目。
  for (const id of manifest.versionIds) requireValue(versions().some(row => row.versionId === id), '迁移目标版本回读不完整，保留旧源。')
  for (const id of manifest.resultIds) requireValue(results().some(row => row.commandId === id), '迁移目标实交回读不完整，保留旧源。')
  const currentRaw = readLegacySewingPickupStorage()
  const remainingVersions = currentRaw.versions.filter(row => preparationForOrder(row.productionOrderId) && row.objectKind !== 'CUT_PIECE')
  if (remainingVersions.length) {
    requireValue(await cuttingRecordFingerprint(currentRaw.raw || 'null') === manifest.sourceFingerprint, '旧领料资料在迁移后发生变化，保留原源；请刷新核对冲突。')
    requireValue(remainingVersions.length === manifest.versionIds.length && remainingVersions.every(row => manifest!.versionIds.includes(row.versionId) && sameLegacyRow(versions().find(saved => saved.versionId === row.versionId), row)), '迁移目标版本内容回读不一致，保留旧源。')
    const remainingResults = currentRaw.handoverResults.filter(row => manifest!.versionIds.includes(row.versionId))
    requireValue(remainingResults.length === manifest.resultIds.length && remainingResults.every(row => manifest!.resultIds.includes(row.commandId) && sameLegacyRow(results().find(saved => saved.commandId === row.commandId), row)), '迁移目标实交内容回读不一致，保留旧源。')
    cleanupLegacySewingPickupStorage(currentRaw.raw, manifest.versionIds)
  } else requireValue(!currentRaw.handoverResults.some(row => manifest!.versionIds.includes(row.versionId)), '旧实交资料缺少原凭证，保留原源。')
  await saveAccessoryWarehouseAction({ commandId: `${input.commandId}:complete`, intent: 'complete-sewing-pickup-migration', result: true, change: { puts: [accessoryRecord('migration', migrationId, { ...manifest, phase: 'COMPLETE' })] } })
  return inspectLegacySewingPickupMigration()
}

/** 仅导出未解决的受管旧写片段；不把新旧数量合成有效实交事实。 */
export async function exportAccessorySewingLegacyConflict(): Promise<{
  sourceKey: 'higood:ppic:sewing-pickup-slips:v1'
  sourceFingerprint: string
  versions: SewingPickupSlipVersion[]
  handoverResults: SewingPickupHandoverResult[]
} | null> {
  if (inspectLegacySewingPickupMigration().state !== '已阻塞') return null
  const source = readLegacySewingPickupStorage()
  const affected = source.versions.filter(row => preparationForOrder(row.productionOrderId) && row.objectKind !== 'CUT_PIECE')
  requireValue(affected.length, '受管旧领料源格式无法完整核对，不能声称已导出完整冲突备份。')
  const ids = new Set(affected.map(row => row.versionId))
  return { sourceKey: 'higood:ppic:sewing-pickup-slips:v1', sourceFingerprint: await cuttingRecordFingerprint(source.raw || 'null'), versions: structuredClone(affected), handoverResults: structuredClone(source.handoverResults.filter(row => ids.has(row.versionId))) }
}
